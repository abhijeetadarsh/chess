"""Stockfish engine wrapper: move-by-move game analysis.

Design notes
------------
* Each board position is analysed exactly **once** with MultiPV. The evaluation
  of the position *after* a move is simply the evaluation of the next position,
  so we carry it forward instead of re-analysing (≈3x fewer engine calls than a
  naive before/after/multipv approach).
* Scores are normalised to **white-relative centipawns** internally; mate is
  mapped to a large magnitude so ordering and win% behave sensibly.
* Accuracy uses the win-percentage model popularised by Lichess.
"""
import asyncio
import atexit
import io
import math
import os
import sys
import threading
from contextlib import contextmanager
from statistics import mean
from typing import Iterator, Optional

import chess
import chess.engine
import chess.pgn

from config import (
    ANALYSIS_TIMEOUT,
    DEFAULT_DEPTH,
    ENGINE_HASH_MB,
    ENGINE_POOL_SIZE,
    ENGINE_THREADS,
    EVAL_DEPTH,
    MAX_DEPTH,
    STOCKFISH_PATH,
    THRESHOLDS,
    TOP_MOVES,
)


# ──────────────────────────────────────────────────────────────
# Engine pool — reuse warm Stockfish processes across requests
# ──────────────────────────────────────────────────────────────
def _ensure_subprocess_capable_loop_policy() -> None:
    """Guarantee Stockfish can be launched on Windows.

    python-chess talks to the engine over an asyncio subprocess. On Windows only
    the *Proactor* event loop can spawn subprocesses — the Selector loop raises
    ``NotImplementedError``. uvicorn installs ``WindowsSelectorEventLoopPolicy``
    whenever it runs with a subprocess (i.e. ``--reload`` or ``--workers``), so
    without this every engine call would fail with a bare 503. Force a Proactor
    policy before spawning; the engine's background loop is created from this
    global policy, and uvicorn's already-running loop is unaffected.
    """
    if sys.platform == "win32" and not isinstance(
        asyncio.get_event_loop_policy(), asyncio.WindowsProactorEventLoopPolicy
    ):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


class _EnginePool:
    """Thread-safe pool of persistent Stockfish processes.

    Reusing a warm process avoids ~100-300ms of startup + NNUE load on every call
    (a big deal for interactive move-testing). Bounded by ENGINE_POOL_SIZE.
    """

    def __init__(self, size: int):
        self._sem = threading.Semaphore(size)
        self._lock = threading.Lock()
        self._idle: list[chess.engine.SimpleEngine] = []

    def _spawn(self) -> chess.engine.SimpleEngine:
        _ensure_subprocess_capable_loop_policy()
        eng = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
        try:
            eng.configure({"Threads": ENGINE_THREADS, "Hash": ENGINE_HASH_MB})
        except Exception:
            pass
        return eng

    @contextmanager
    def get(self):
        if not os.path.isfile(STOCKFISH_PATH):
            raise RuntimeError(
                f"Stockfish not found at '{STOCKFISH_PATH}'. "
                "Run `python setup_stockfish.py` to download it."
            )
        self._sem.acquire()
        eng = None
        try:
            with self._lock:
                if self._idle:
                    eng = self._idle.pop()
            if eng is None:
                eng = self._spawn()
            yield eng
            # only return a healthy engine to the pool
            with self._lock:
                self._idle.append(eng)
            eng = None
        finally:
            if eng is not None:  # an error occurred — discard this engine
                try:
                    eng.quit()
                except Exception:
                    pass
            self._sem.release()

    def shutdown(self):
        with self._lock:
            for eng in self._idle:
                try:
                    eng.quit()
                except Exception:
                    pass
            self._idle.clear()


_POOL = _EnginePool(ENGINE_POOL_SIZE)
atexit.register(_POOL.shutdown)

PIECE_VALUE = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 0,
}
MATE_CP = 100_000  # internal magnitude for a forced mate


# ──────────────────────────────────────────────────────────────
# Score helpers
# ──────────────────────────────────────────────────────────────
def _white_cp(score: chess.engine.PovScore) -> int:
    """White-relative centipawns. Mate -> large magnitude (closer mate = larger)."""
    s = score.white()
    if s.is_mate():
        m = s.mate()
        if m == 0:
            return -MATE_CP  # the side to move has just been mated
        mag = MATE_CP - abs(m)
        return mag if m > 0 else -mag
    return s.score(mate_score=MATE_CP)


def _cp_to_pawns(white_cp: int) -> float:
    """Convert white-relative cp to pawns for display, capping mate scores."""
    if abs(white_cp) >= 50_000:
        return 99.0 if white_cp > 0 else -99.0
    return round(white_cp / 100, 2)


def _mate_in(white_cp: int) -> Optional[int]:
    """If the score represents a mate, return the (signed) number of moves."""
    if abs(white_cp) >= 50_000:
        dist = MATE_CP - abs(white_cp)
        return dist if white_cp > 0 else -dist
    return None


def _win_percent(cp: float) -> float:
    """Win probability (0-100) for the side whose relative score is `cp`.

    Symmetric around 0, so passing a mover-relative score yields the mover's win%.
    """
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def _move_accuracy(win_before: float, win_after: float) -> float:
    """Single-move accuracy (0-100) from the drop in win% (Lichess model)."""
    delta = max(0.0, win_before - win_after)
    acc = 103.1668 * math.exp(-0.04354 * delta) - 3.1669
    return max(0.0, min(100.0, acc))


def _terminal_white_cp(board: chess.Board) -> int:
    """White-relative score for a finished position."""
    if board.is_checkmate():
        return -MATE_CP if board.turn == chess.WHITE else MATE_CP
    return 0  # stalemate / insufficient material / repetition / 50-move = draw


def _is_sacrifice(board: chess.Board, move: chess.Move) -> bool:
    """Heuristic: does `move` give up material on a square the opponent can win?"""
    piece = board.piece_at(move.from_square)
    if piece is None or piece.piece_type == chess.PAWN:
        return False
    captured = board.piece_at(move.to_square)
    gained = PIECE_VALUE.get(captured.piece_type, 0) if captured else 0
    risked = PIECE_VALUE.get(piece.piece_type, 0)

    after = board.copy(stack=False)
    after.push(move)
    to = move.to_square
    attackers = after.attackers(not piece.color, to)
    defenders = after.attackers(piece.color, to)

    if attackers and len(attackers) > len(defenders) and (risked - gained) >= 3:
        return True
    return False


# ──────────────────────────────────────────────────────────────
# Classification + explanations
# ──────────────────────────────────────────────────────────────
def classify(
    cp_loss: float,
    *,
    is_sacrifice: bool,
    gap_to_second: float,
    eval_after_mover: float,
    n_legal: int,
) -> str:
    if cp_loss <= THRESHOLDS["best"]:
        if is_sacrifice and eval_after_mover >= THRESHOLDS["brilliant_min_eval"]:
            return "brilliant"
        if n_legal > 1 and gap_to_second >= THRESHOLDS["only_move_gap"]:
            return "great"
        return "best"
    if cp_loss <= THRESHOLDS["good"]:
        return "good"
    if cp_loss <= THRESHOLDS["inaccuracy"]:
        return "inaccuracy"
    if cp_loss <= THRESHOLDS["mistake"]:
        return "mistake"
    if cp_loss <= THRESHOLDS["blunder"]:
        return "blunder"
    return "critical_blunder"


def _explain(cls: str, san: str, best_san: str, cp_loss: float, mover_mate: Optional[int]) -> str:
    """Build a human-readable explanation. `mover_mate` is mover-relative:
    >0 the mover forces mate, <0 the move allows the opponent to mate."""
    loss = f"{min(cp_loss, 2000):.0f}"
    win_note = f" It forces mate in {mover_mate}." if (mover_mate and mover_mate > 0) else ""
    lose_note = f" It allows a forced mate in {abs(mover_mate)}." if (mover_mate and mover_mate < 0) else ""

    text = {
        "brilliant": f"{san}!! A brilliant move — a sound sacrifice the engine confirms is strongest.{win_note}",
        "great": f"{san}! The only move that holds your advantage; every alternative is clearly worse.{win_note}",
        "best": f"{san} is the engine's top choice. Precise play.{win_note}",
        "good": f"{san} is a solid move — only ~{loss}cp behind the best ({best_san}).",
        "inaccuracy": f"{san} is an inaccuracy (≈{loss}cp lost). {best_san} was more precise and keeps a better position.{lose_note}",
        "mistake": f"{san} is a mistake (≈{loss}cp lost). The engine prefers {best_san}, which holds a clearly better position.{lose_note}",
        "blunder": f"{san} is a blunder (≈{loss}cp lost). {best_san} was correct — this seriously damages your position.{lose_note}",
        "critical_blunder": (
            f"{san} is a decisive blunder.{lose_note} {best_san} was needed; this likely throws the game away."
            if lose_note else
            f"{san} is a decisive blunder (≈{loss}cp lost). {best_san} was needed; this likely throws the game away."
        ),
    }
    return text.get(cls, f"{san}.")


# ──────────────────────────────────────────────────────────────
# Core analysis (streaming generator)
# ──────────────────────────────────────────────────────────────
def iter_analysis(
    pgn_text: str,
    depth: int = DEFAULT_DEPTH,
    top_moves: int = TOP_MOVES,
) -> Iterator[dict]:
    """Yield analysis events: one `meta`, one `move` per ply, one `summary`.

    Raises ValueError for bad PGN and RuntimeError if Stockfish is missing.
    """
    depth = max(1, min(depth, MAX_DEPTH))

    game = chess.pgn.read_game(io.StringIO(pgn_text))
    if game is None:
        raise ValueError("Could not parse PGN.")

    headers = dict(game.headers)
    moves = list(game.mainline_moves())
    total = len(moves)
    if total == 0:
        raise ValueError("PGN contains no moves to analyse.")

    with _POOL.get() as engine:
        limit = chess.engine.Limit(depth=depth, time=ANALYSIS_TIMEOUT)
        board = game.board()

        yield {
            "type": "meta",
            "headers": headers,
            "white": headers.get("White", "White"),
            "black": headers.get("Black", "Black"),
            "result": headers.get("Result", "*"),
            "opening": headers.get("Opening") or headers.get("ECO") or "Unknown",
            "eco": headers.get("ECO", ""),
            "time_control": headers.get("TimeControl", ""),
            "total": total,
            "depth": depth,
        }

        # Analysis of the current (pre-move) position, reused each iteration.
        current_info = engine.analyse(board, limit, multipv=top_moves)

        accuracies: dict[str, list[float]] = {"white": [], "black": []}
        class_log: list[tuple[str, str]] = []  # (color, classification)

        for i, move in enumerate(moves):
            mover = board.turn
            color = "white" if mover == chess.WHITE else "black"
            sign = 1 if mover == chess.WHITE else -1
            move_number = board.fullmove_number
            n_legal = board.legal_moves.count()

            infos = current_info if isinstance(current_info, list) else [current_info]
            best_white_cp = _white_cp(infos[0]["score"])
            best_mover = sign * best_white_cp
            second_mover = (
                sign * _white_cp(infos[1]["score"]) if len(infos) > 1 else best_mover
            )
            gap_to_second = best_mover - second_mover

            san = board.san(move)
            uci = move.uci()
            from_sq = chess.square_name(move.from_square)
            to_sq = chess.square_name(move.to_square)

            alternatives = []
            for entry in infos[:top_moves]:
                pv = entry.get("pv")
                if not pv:
                    continue
                cand = pv[0]
                cand_white = _white_cp(entry["score"])
                alternatives.append({
                    "san": board.san(cand),
                    "uci": cand.uci(),
                    "eval": _cp_to_pawns(cand_white),
                    "mate": _mate_in(cand_white),
                    "is_played": cand == move,
                })
            best_san = alternatives[0]["san"] if alternatives else san

            sacrifice = _is_sacrifice(board, move)
            win_before = _win_percent(best_mover)

            # Play the move and evaluate the resulting position.
            board.push(move)
            if board.is_game_over():
                next_white_cp = _terminal_white_cp(board)
                next_info = None
            else:
                next_info = engine.analyse(board, limit, multipv=top_moves)
                ne = next_info if isinstance(next_info, list) else [next_info]
                next_white_cp = _white_cp(ne[0]["score"])

            played_mover = sign * next_white_cp
            cp_loss = max(0.0, best_mover - played_mover)
            win_after = _win_percent(played_mover)
            move_acc = _move_accuracy(win_before, win_after)

            cls = classify(
                cp_loss,
                is_sacrifice=sacrifice,
                gap_to_second=gap_to_second,
                eval_after_mover=played_mover,
                n_legal=n_legal,
            )
            mate_in = _mate_in(next_white_cp)              # white-relative (for the eval bar)
            mover_mate = _mate_in(int(played_mover))        # mover-relative (for the explanation)

            accuracies[color].append(move_acc)
            class_log.append((color, cls))

            yield {
                "type": "move",
                "index": i,
                "total": total,
                "data": {
                    "ply": i + 1,
                    "move_number": move_number,
                    "color": color,
                    "san": san,
                    "uci": uci,
                    "from": from_sq,
                    "to": to_sq,
                    "fen": board.fen(),  # position AFTER the move
                    "classification": cls,
                    "cp_loss": round(min(cp_loss, 2000), 0),
                    "eval": _cp_to_pawns(next_white_cp),  # white-relative, after the move
                    "mate_in": mate_in,
                    "accuracy": round(move_acc, 1),
                    "best_move": best_san,
                    "alternatives": alternatives,
                    "explanation": _explain(cls, san, best_san, cp_loss, mover_mate),
                },
            }

            current_info = next_info  # carry forward; unused after the final move

        yield {
            "type": "summary",
            "white_accuracy": round(mean(accuracies["white"]), 1) if accuracies["white"] else 0.0,
            "black_accuracy": round(mean(accuracies["black"]), 1) if accuracies["black"] else 0.0,
            "summary": _summarise(class_log),
        }


def evaluate_fen(fen: str, depth: int = EVAL_DEPTH) -> dict:
    """Evaluate a single position (for interactive 'what-if' exploration).

    Returns white-relative eval (pawns), mate distance, and the engine's best move.
    Raises ValueError for an invalid FEN, RuntimeError if Stockfish is missing.
    """
    depth = max(1, min(depth, MAX_DEPTH))
    try:
        board = chess.Board(fen)
    except ValueError as e:
        raise ValueError(f"Invalid FEN: {e}")

    if board.is_game_over():
        wc = _terminal_white_cp(board)
        return {
            "eval": _cp_to_pawns(wc), "mate": _mate_in(wc),
            "best_san": None, "best_uci": None,
            "turn": "white" if board.turn == chess.WHITE else "black",
            "game_over": True,
        }

    with _POOL.get() as engine:
        info = engine.analyse(board, chess.engine.Limit(depth=depth, time=ANALYSIS_TIMEOUT), multipv=1)
        entry = info[0] if isinstance(info, list) else info
        wc = _white_cp(entry["score"])
        pv = entry.get("pv")
        best = pv[0] if pv else None
        return {
            "eval": _cp_to_pawns(wc),
            "mate": _mate_in(wc),
            "best_san": board.san(best) if best else None,
            "best_uci": best.uci() if best else None,
            "turn": "white" if board.turn == chess.WHITE else "black",
            "game_over": False,
        }


# ──────────────────────────────────────────────────────────────
# Play vs bot — Stockfish at a chosen Elo, with per-move feedback
# ──────────────────────────────────────────────────────────────
MIN_BOT_ELO = 400
MAX_BOT_ELO = 3000
# Stockfish's UCI_Elo only goes down to ~1320; below that we weaken it with the
# Skill Level option instead (0 = very weak … 20 = full strength).
_UCI_ELO_FLOOR = 1320


def _configure_strength(engine: chess.engine.SimpleEngine, elo: int):
    elo = max(MIN_BOT_ELO, min(int(elo), MAX_BOT_ELO))
    try:
        if elo >= _UCI_ELO_FLOOR:
            engine.configure({"UCI_LimitStrength": True, "UCI_Elo": elo, "Skill Level": 20})
        else:
            skill = round((elo - MIN_BOT_ELO) / (_UCI_ELO_FLOOR - MIN_BOT_ELO) * 19)
            engine.configure({"UCI_LimitStrength": False, "Skill Level": max(0, min(20, skill))})
    except Exception:
        pass  # some engine builds lack these options — fall back to full strength


def _reset_strength(engine: chess.engine.SimpleEngine):
    """Return a pooled engine to full strength so later analysis is unaffected."""
    try:
        engine.configure({"UCI_LimitStrength": False, "Skill Level": 20})
    except Exception:
        pass


def _game_status(board: chess.Board) -> dict:
    if not board.is_game_over(claim_draw=True):
        return {"over": False, "result": None, "reason": None, "winner": None}
    result = board.result(claim_draw=True)
    if board.is_checkmate():
        reason = "checkmate"
    elif board.is_stalemate():
        reason = "stalemate"
    elif board.is_insufficient_material():
        reason = "insufficient material"
    elif board.is_seventyfive_moves() or board.can_claim_fifty_moves():
        reason = "fifty-move rule"
    elif board.is_fivefold_repetition() or board.can_claim_threefold_repetition():
        reason = "repetition"
    else:
        reason = "draw"
    winner = "white" if result == "1-0" else "black" if result == "0-1" else None
    return {"over": True, "result": result, "reason": reason, "winner": winner}


def _choose_bot_move(engine: chess.engine.SimpleEngine, board: chess.Board, elo: int) -> Optional[chess.Move]:
    """Pick Stockfish's Elo-limited move on `board` (does NOT mutate the board)."""
    _configure_strength(engine, elo)
    try:
        result = engine.play(board, chess.engine.Limit(depth=16, time=1.0))
    finally:
        _reset_strength(engine)
    move = result.move
    if move is None or move not in board.legal_moves:
        return None
    return move


def _current_eval(engine: chess.engine.SimpleEngine, board: chess.Board) -> int:
    """White-relative cp for `board` (terminal-aware, light depth for the eval bar)."""
    if board.is_game_over(claim_draw=True):
        return _terminal_white_cp(board)
    info = engine.analyse(board, chess.engine.Limit(depth=EVAL_DEPTH, time=ANALYSIS_TIMEOUT), multipv=1)
    entry = info[0] if isinstance(info, list) else info
    return _white_cp(entry["score"])


def _score_move(
    engine: chess.engine.SimpleEngine,
    board: chess.Board,
    move: chess.Move,
    limit: chess.engine.Limit,
    top_moves: int,
) -> dict:
    """Score `move` from the pre-move `board` (same logic as analysis) and play it.

    Mutates `board` by pushing `move`. Returns a MoveData-shaped feedback dict, so
    both the user's move and the bot's reply can be scored the same way.
    """
    mover = board.turn
    sign = 1 if mover == chess.WHITE else -1
    color = "white" if mover == chess.WHITE else "black"
    move_number = board.fullmove_number
    n_legal = board.legal_moves.count()
    san = board.san(move)
    from_sq = chess.square_name(move.from_square)
    to_sq = chess.square_name(move.to_square)

    # 1) Best line(s) from the pre-move position (full strength).
    infos = engine.analyse(board, limit, multipv=top_moves)
    infos = infos if isinstance(infos, list) else [infos]
    best_white_cp = _white_cp(infos[0]["score"])
    best_mover = sign * best_white_cp
    second_mover = sign * _white_cp(infos[1]["score"]) if len(infos) > 1 else best_mover
    gap_to_second = best_mover - second_mover

    alternatives = []
    for entry in infos[:top_moves]:
        pv = entry.get("pv")
        if not pv:
            continue
        cand = pv[0]
        cand_white = _white_cp(entry["score"])
        alternatives.append({
            "san": board.san(cand),
            "uci": cand.uci(),
            "eval": _cp_to_pawns(cand_white),
            "mate": _mate_in(cand_white),
            "is_played": cand == move,
        })
    best_san = alternatives[0]["san"] if alternatives else san
    sacrifice = _is_sacrifice(board, move)
    win_before = _win_percent(best_mover)

    # 2) Evaluate the position after the move.
    board.push(move)
    after_fen = board.fen()
    status = _game_status(board)
    if status["over"]:
        next_white_cp = _terminal_white_cp(board)
    else:
        ne = engine.analyse(board, limit, multipv=1)
        ne = ne if isinstance(ne, list) else [ne]
        next_white_cp = _white_cp(ne[0]["score"])

    played_mover = sign * next_white_cp
    cp_loss = max(0.0, best_mover - played_mover)
    move_acc = _move_accuracy(win_before, _win_percent(played_mover))
    cls = classify(
        cp_loss, is_sacrifice=sacrifice, gap_to_second=gap_to_second,
        eval_after_mover=played_mover, n_legal=n_legal,
    )
    mover_mate = _mate_in(int(played_mover))
    return {
        "move_number": move_number, "color": color, "san": san, "uci": move.uci(),
        "from": from_sq, "to": to_sq, "fen": after_fen,
        "classification": cls, "cp_loss": round(min(cp_loss, 2000), 0),
        "eval": _cp_to_pawns(next_white_cp), "mate_in": _mate_in(next_white_cp),
        "accuracy": round(move_acc, 1), "best_move": best_san,
        "alternatives": alternatives,
        "explanation": _explain(cls, san, best_san, cp_loss, mover_mate),
    }


def _bot_summary(feedback: dict) -> dict:
    """The compact bot-move shape the client uses for animation + sound."""
    return {k: feedback[k] for k in ("san", "uci", "from", "to", "fen")}


def play_and_feedback(
    fen: str, uci: str, elo: int, depth: int = DEFAULT_DEPTH, top_moves: int = TOP_MOVES,
) -> dict:
    """Score the user's move, play the bot's reply, and score that too.

    Returns the user's move feedback, the bot's reply (scored) and the resulting
    position. Raises ValueError for bad input, RuntimeError if Stockfish is missing.
    """
    depth = max(1, min(depth, MAX_DEPTH))
    try:
        board = chess.Board(fen)
    except ValueError as e:
        raise ValueError(f"Invalid FEN: {e}")
    if board.is_game_over(claim_draw=True):
        raise ValueError("The game is already over.")
    try:
        move = chess.Move.from_uci(uci)
    except ValueError:
        raise ValueError(f"Invalid move: {uci}")
    if move not in board.legal_moves:
        raise ValueError(f"Illegal move: {uci}")

    with _POOL.get() as engine:
        limit = chess.engine.Limit(depth=depth, time=ANALYSIS_TIMEOUT)

        # 1) Score the user's move (pushes it onto `board`).
        feedback = _score_move(engine, board, move, limit, top_moves)
        status = _game_status(board)

        # 2) Bot reply (Elo-limited), scored the same way so it's navigable too.
        bot = None
        bot_feedback = None
        if not status["over"]:
            bmove = _choose_bot_move(engine, board, elo)
            if bmove is not None:
                bot_feedback = _score_move(engine, board, bmove, limit, top_moves)
                bot = _bot_summary(bot_feedback)
                status = _game_status(board)
        cur_white_cp = _current_eval(engine, board)

    return {
        "feedback": feedback,
        "bot": bot,
        "bot_feedback": bot_feedback,
        "fen": board.fen(),
        "eval": _cp_to_pawns(cur_white_cp),
        "mate": _mate_in(cur_white_cp),
        "turn": "white" if board.turn == chess.WHITE else "black",
        "game_over": status["over"],
        "result": status["result"],
        "reason": status["reason"],
        "winner": status["winner"],
    }


def bot_move(fen: str, elo: int, depth: int = DEFAULT_DEPTH, top_moves: int = TOP_MOVES) -> dict:
    """Play (and score) the bot's move from `fen` — used for its opening move as White."""
    depth = max(1, min(depth, MAX_DEPTH))
    try:
        board = chess.Board(fen)
    except ValueError as e:
        raise ValueError(f"Invalid FEN: {e}")
    status = _game_status(board)
    bot = None
    bot_feedback = None
    with _POOL.get() as engine:
        if not status["over"]:
            limit = chess.engine.Limit(depth=depth, time=ANALYSIS_TIMEOUT)
            bmove = _choose_bot_move(engine, board, elo)
            if bmove is not None:
                bot_feedback = _score_move(engine, board, bmove, limit, top_moves)
                bot = _bot_summary(bot_feedback)
                status = _game_status(board)
        cur_white_cp = _current_eval(engine, board)
    return {
        "bot": bot,
        "bot_feedback": bot_feedback,
        "fen": board.fen(),
        "eval": _cp_to_pawns(cur_white_cp),
        "mate": _mate_in(cur_white_cp),
        "turn": "white" if board.turn == chess.WHITE else "black",
        "game_over": status["over"],
        "result": status["result"],
        "reason": status["reason"],
        "winner": status["winner"],
    }


def _summarise(class_log: list[tuple[str, str]]) -> dict:
    classes = ["brilliant", "great", "best", "good", "inaccuracy", "mistake", "blunder", "critical_blunder"]
    out: dict[str, dict[str, int]] = {}
    for color in ("white", "black"):
        out[color] = {c: 0 for c in classes}
        for col, cls in class_log:
            if col == color:
                out[color][cls] += 1
    return out


# ──────────────────────────────────────────────────────────────
# Convenience: collect the stream into a single dict
# ──────────────────────────────────────────────────────────────
def analyze_game(pgn_text: str, depth: int = DEFAULT_DEPTH) -> dict:
    """Run a full analysis and return one aggregated result dict."""
    result: dict = {"moves": []}
    for ev in iter_analysis(pgn_text, depth):
        t = ev["type"]
        if t == "meta":
            result.update({
                "headers": ev["headers"],
                "white": ev["white"],
                "black": ev["black"],
                "result": ev["result"],
                "opening": ev["opening"],
                "eco": ev["eco"],
                "time_control": ev["time_control"],
                "depth": ev["depth"],
                "total_moves": ev["total"],
            })
        elif t == "move":
            result["moves"].append(ev["data"])
        elif t == "summary":
            result["white_accuracy"] = ev["white_accuracy"]
            result["black_accuracy"] = ev["black_accuracy"]
            result["summary"] = ev["summary"]
    return result
