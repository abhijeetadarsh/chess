"""Fetch games from the Chess.com and Lichess public APIs."""
import json
from typing import Optional

import httpx

from config import CHESSCOM_API, LICHESS_API, HTTP_USER_AGENT

_HEADERS = {"User-Agent": HTTP_USER_AGENT}


async def fetch_chesscom_games(username: str, max_games: int = 10) -> list[dict]:
    """Fetch the most recent games for a Chess.com user (newest first)."""
    username = username.strip().lower()
    async with httpx.AsyncClient(timeout=30, headers=_HEADERS) as client:
        resp = await client.get(f"{CHESSCOM_API}/player/{username}/games/archives")
        resp.raise_for_status()
        archives = resp.json().get("archives", [])
        if not archives:
            return []

        # Walk archives backwards (newest month first) until we have enough games.
        games: list[dict] = []
        for archive_url in reversed(archives):
            resp = await client.get(archive_url)
            resp.raise_for_status()
            month_games = resp.json().get("games", [])
            for g in reversed(month_games):
                pgn = g.get("pgn", "")
                if not pgn:
                    continue
                games.append({
                    "source": "chess.com",
                    "game_id": g.get("url", "").rstrip("/").split("/")[-1],
                    "url": g.get("url", ""),
                    "pgn": pgn,
                    "time_control": g.get("time_control", ""),
                    "time_class": g.get("time_class", ""),
                    "rated": g.get("rated", False),
                    "white": g.get("white", {}).get("username", ""),
                    "black": g.get("black", {}).get("username", ""),
                    "white_rating": g.get("white", {}).get("rating"),
                    "black_rating": g.get("black", {}).get("rating"),
                    "white_result": g.get("white", {}).get("result", ""),
                    "black_result": g.get("black", {}).get("result", ""),
                    "end_time": g.get("end_time", 0),
                })
                if len(games) >= max_games:
                    return games
        return games


async def fetch_lichess_games(username: str, max_games: int = 10) -> list[dict]:
    """Fetch the most recent games for a Lichess user (newest first)."""
    username = username.strip()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{LICHESS_API}/games/user/{username}",
            params={"max": max_games, "pgnInJson": True, "opening": True, "clocks": False, "evals": False},
            headers={"Accept": "application/x-ndjson", **_HEADERS},
        )
        resp.raise_for_status()

        games: list[dict] = []
        for line in resp.text.strip().split("\n"):
            if not line:
                continue
            try:
                g = json.loads(line)
            except json.JSONDecodeError:
                continue

            players = g.get("players", {})
            white = players.get("white", {})
            black = players.get("black", {})
            clock = g.get("clock", {})
            opening = g.get("opening", {})

            games.append({
                "source": "lichess",
                "game_id": g.get("id", ""),
                "url": f"https://lichess.org/{g.get('id', '')}",
                "pgn": g.get("pgn", ""),
                "time_control": f"{clock.get('initial', 0)}+{clock.get('increment', 0)}" if clock else "",
                "time_class": g.get("speed", ""),
                "rated": g.get("rated", False),
                "opening": opening.get("name", ""),
                "white": white.get("user", {}).get("name", white.get("name", "Anonymous")),
                "black": black.get("user", {}).get("name", black.get("name", "Anonymous")),
                "white_rating": white.get("rating"),
                "black_rating": black.get("rating"),
                "white_result": _lichess_result(g.get("winner"), "white", g.get("status", "")),
                "black_result": _lichess_result(g.get("winner"), "black", g.get("status", "")),
                "end_time": g.get("lastMoveAt", 0) // 1000,
            })
        return games


def _lichess_result(winner: Optional[str], color: str, status: str) -> str:
    if status in ("draw", "stalemate", "repetition", "insufficientMaterial", "fiftyMoves"):
        return "draw"
    if winner == color:
        return "win"
    if winner:  # someone won and it wasn't this color
        return "lose"
    return status or "unknown"
