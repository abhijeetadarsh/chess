"""Chess Analysis Server — FastAPI application."""
import asyncio
import json
import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Header
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from cachetools import TTLCache

import auth as _auth
from config import DEFAULT_DEPTH, MAX_DEPTH, STOCKFISH_PATH
from engine import (
    MAX_BOT_ELO,
    MIN_BOT_ELO,
    analyze_game,
    bot_move,
    evaluate_fen,
    iter_analysis,
    play_and_feedback,
)
from fetcher import fetch_chesscom_games, fetch_lichess_games

app = FastAPI(
    title="Chess Analysis Server",
    description="Deep, move-by-move analysis of chess games from Chess.com and Lichess.",
    version="3.0.0",
)


@app.on_event("startup")
async def _startup():
    _auth.init_db()


# ── Auth helpers ──────────────────────────────────────────────────────────────

def _require_user(authorization: Optional[str]) -> dict:
    token = (authorization or "").removeprefix("Bearer ").strip()
    user = _auth.get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


# ── Auth models ───────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.post("/auth/register", tags=["Auth"])
async def register(req: RegisterRequest):
    try:
        _auth.create_user(req.username, req.password, req.email)
    except ValueError as e:
        raise HTTPException(400, str(e))
    result = _auth.authenticate(req.username, req.password)
    if not result:
        raise HTTPException(500, "Account created but login failed")
    settings = _auth.get_settings(result["user_id"])
    return {**result, "settings": settings}


@app.post("/auth/login", tags=["Auth"])
async def login(req: LoginRequest):
    result = _auth.authenticate(req.username, req.password)
    if not result:
        raise HTTPException(401, "Invalid username or password")
    settings = _auth.get_settings(result["user_id"])
    return {**result, "settings": settings}


@app.post("/auth/logout", tags=["Auth"])
async def logout(authorization: Optional[str] = Header(None)):
    token = (authorization or "").removeprefix("Bearer ").strip()
    if token:
        _auth.revoke_session(token)
    return {"ok": True}


@app.get("/auth/me", tags=["Auth"])
async def me(authorization: Optional[str] = Header(None)):
    user = _require_user(authorization)
    settings = _auth.get_settings(user["id"])
    return {**user, "settings": settings}


@app.put("/auth/settings", tags=["Auth"])
async def update_settings(data: dict, authorization: Optional[str] = Header(None)):
    user = _require_user(authorization)
    _auth.save_settings(user["id"], data)
    return {"ok": True}

# In-memory caches
_analysis_cache: TTLCache = TTLCache(maxsize=200, ttl=3600)  # analysis: 1 hour
_games_cache: TTLCache = TTLCache(maxsize=100, ttl=300)      # game lists: 5 min


# ──────────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    pgn: str = Field(..., description="PGN text of the game to analyse")
    depth: int = Field(DEFAULT_DEPTH, ge=1, le=MAX_DEPTH)


class GameFetchResponse(BaseModel):
    username: str
    source: str
    count: int
    games: list


class EvalRequest(BaseModel):
    fen: str = Field(..., description="FEN of the position to evaluate")
    depth: int = Field(14, ge=1, le=MAX_DEPTH)


class PlayMoveRequest(BaseModel):
    fen: str = Field(..., description="FEN before the user's move")
    uci: str = Field(..., description="The user's move in UCI (e.g. e2e4, e7e8q)")
    elo: int = Field(1500, ge=MIN_BOT_ELO, le=MAX_BOT_ELO)
    depth: int = Field(DEFAULT_DEPTH, ge=1, le=MAX_DEPTH)


class BotMoveRequest(BaseModel):
    fen: str = Field(..., description="FEN of the position for the bot to move in")
    elo: int = Field(1500, ge=MIN_BOT_ELO, le=MAX_BOT_ELO)


def _clamp_depth(depth: int) -> int:
    return min(max(depth, 1), MAX_DEPTH)


# ──────────────────────────────────────────────────────────────
# Fetch games
# ──────────────────────────────────────────────────────────────
@app.get("/games/chesscom/{username}", response_model=GameFetchResponse, tags=["Fetch Games"])
async def get_chesscom_games(username: str, max_games: int = Query(10, ge=1, le=50)):
    """Fetch recent games for a Chess.com user."""
    cache_key = f"chesscom:{username}:{max_games}"
    if cache_key not in _games_cache:
        try:
            _games_cache[cache_key] = await fetch_chesscom_games(username, max_games)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Chess.com API error: {e}")
    games = _games_cache[cache_key]
    if not games:
        raise HTTPException(status_code=404, detail=f"No games found for '{username}' on Chess.com")
    return {"username": username, "source": "chess.com", "count": len(games), "games": games}


@app.get("/games/lichess/{username}", response_model=GameFetchResponse, tags=["Fetch Games"])
async def get_lichess_games(username: str, max_games: int = Query(10, ge=1, le=50)):
    """Fetch recent games for a Lichess user."""
    cache_key = f"lichess:{username}:{max_games}"
    if cache_key not in _games_cache:
        try:
            _games_cache[cache_key] = await fetch_lichess_games(username, max_games)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Lichess API error: {e}")
    games = _games_cache[cache_key]
    if not games:
        raise HTTPException(status_code=404, detail=f"No games found for '{username}' on Lichess")
    return {"username": username, "source": "lichess", "count": len(games), "games": games}


# ──────────────────────────────────────────────────────────────
# Analyse (blocking, returns the full result)
# ──────────────────────────────────────────────────────────────
@app.post("/analyze", tags=["Analysis"])
async def analyze_pgn(request: AnalyzeRequest):
    """Analyse a game from PGN and return the complete result."""
    if not request.pgn.strip():
        raise HTTPException(status_code=400, detail="PGN text is required")

    depth = _clamp_depth(request.depth)
    cache_key = f"pgn:{hash(request.pgn)}:{depth}"
    if cache_key in _analysis_cache:
        return _analysis_cache[cache_key]

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, analyze_game, request.pgn, depth)
        _analysis_cache[cache_key] = result
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")


# ──────────────────────────────────────────────────────────────
# Analyse (streaming NDJSON — progress + moves as they're computed)
# ──────────────────────────────────────────────────────────────
@app.post("/analyze/stream", tags=["Analysis"])
async def analyze_pgn_stream(request: AnalyzeRequest):
    """Stream analysis as newline-delimited JSON.

    Emits one `meta` event, a `move` event per ply, then a `summary` event
    (or an `error` event). The sync generator runs in a worker thread, so the
    event loop stays responsive.
    """
    if not request.pgn.strip():
        raise HTTPException(status_code=400, detail="PGN text is required")
    depth = _clamp_depth(request.depth)

    def generate():
        try:
            for ev in iter_analysis(request.pgn, depth):
                yield json.dumps(ev) + "\n"
        except (ValueError, RuntimeError) as e:
            yield json.dumps({"type": "error", "detail": str(e)}) + "\n"
        except Exception as e:  # noqa: BLE001
            yield json.dumps({"type": "error", "detail": f"Analysis failed: {e}"}) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/evaluate", tags=["Analysis"])
async def evaluate_position(request: EvalRequest):
    """Evaluate a single position (for interactive move testing)."""
    depth = _clamp_depth(request.depth)
    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, evaluate_fen, request.fen, depth)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {e}")


# ──────────────────────────────────────────────────────────────
# Play vs bot
# ──────────────────────────────────────────────────────────────
@app.post("/play/move", tags=["Play"])
async def play_user_move(request: PlayMoveRequest):
    """Score the user's move (like analysis) and return the bot's Elo-limited reply."""
    depth = _clamp_depth(request.depth)
    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, play_and_feedback, request.fen, request.uci, request.elo, depth
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Play failed: {e}")


@app.post("/play/bot", tags=["Play"])
async def play_bot_move(request: BotMoveRequest):
    """Play just the bot's move (used for its opening move when the user is Black)."""
    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, bot_move, request.fen, request.elo)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bot move failed: {e}")


@app.post("/analyze/game", tags=["Analysis"])
async def analyze_fetched_game(
    source: str = Query(..., description="'chesscom' or 'lichess'"),
    username: str = Query(...),
    game_index: int = Query(0, ge=0, description="0 = most recent game"),
    depth: int = Query(DEFAULT_DEPTH, ge=1, le=MAX_DEPTH),
):
    """Fetch a specific game and return its full analysis."""
    try:
        if source.lower() == "chesscom":
            games = await fetch_chesscom_games(username, max_games=game_index + 1)
        elif source.lower() == "lichess":
            games = await fetch_lichess_games(username, max_games=game_index + 1)
        else:
            raise HTTPException(status_code=400, detail="source must be 'chesscom' or 'lichess'")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch games: {e}")

    if not games or game_index >= len(games):
        raise HTTPException(status_code=404, detail="Game not found")

    game = games[game_index]
    pgn = game.get("pgn", "")
    if not pgn:
        raise HTTPException(status_code=404, detail="No PGN available for this game")

    depth = _clamp_depth(depth)
    cache_key = f"game:{game.get('game_id')}:{depth}"
    if cache_key in _analysis_cache:
        cached = dict(_analysis_cache[cache_key])
        cached["game_info"] = game
        return cached

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, analyze_game, pgn, depth)
        _analysis_cache[cache_key] = result
        result = dict(result)
        result["game_info"] = game
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")


# ──────────────────────────────────────────────────────────────
# System
# ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    ok = os.path.isfile(STOCKFISH_PATH)
    return {
        "status": "ok",
        "stockfish_path": STOCKFISH_PATH,
        "stockfish_found": ok,
        "message": "Ready" if ok else "Stockfish not found — run `python setup_stockfish.py`",
    }


# ──────────────────────────────────────────────────────────────
# Web UI
# ──────────────────────────────────────────────────────────────
# ──────────────────────────────────────────────────────────────
# Web UI — the built React/Vite SPA (frontend/dist)
# ──────────────────────────────────────────────────────────────
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend", "dist")


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def serve_ui():
    index = os.path.join(FRONTEND_DIST, "index.html")
    if not os.path.isfile(index):
        return HTMLResponse(
            "<h1>Frontend not built</h1>"
            "<p>Run <code>npm --prefix frontend install</code> then "
            "<code>npm --prefix frontend run build</code>.</p>",
            status_code=503,
        )
    return FileResponse(index)


# Hashed JS/CSS bundles emitted by Vite
_assets_dir = os.path.join(FRONTEND_DIST, "assets")
if os.path.isdir(_assets_dir):
    app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")
