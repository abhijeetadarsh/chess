import os

# ──────────────────────────────────────────────────────────────
# Stockfish
# ──────────────────────────────────────────────────────────────
# Path to Stockfish binary. Run `setup_stockfish.py` to download it
# automatically, or download manually from https://stockfishchess.org/download/
# and place stockfish.exe in the "stockfish/" subfolder.
STOCKFISH_PATH = os.environ.get(
    "STOCKFISH_PATH",
    os.path.join(os.path.dirname(__file__), "stockfish", "stockfish.exe"),
)

# Engine resources
ENGINE_THREADS = int(os.environ.get("ENGINE_THREADS", max(1, (os.cpu_count() or 2) - 1)))
ENGINE_HASH_MB = int(os.environ.get("ENGINE_HASH_MB", 256))
# Reuse a small pool of warm Stockfish processes instead of spawning one per request
# (big win for interactive move-testing). NOTE: Stockfish is CPU-only — no GPU mode exists;
# the GPU alternative would be Leela Chess Zero (Lc0), a much heavier setup.
ENGINE_POOL_SIZE = int(os.environ.get("ENGINE_POOL_SIZE", 2))

# ──────────────────────────────────────────────────────────────
# Analysis settings
# ──────────────────────────────────────────────────────────────
DEFAULT_DEPTH = 14          # Balanced default. Fast=10, Deep=18 (see UI speed selector)
EVAL_DEPTH = 12             # Depth for interactive single-position evaluation
MAX_DEPTH = 25
TOP_MOVES = 3               # How many alternative moves to show per position
ANALYSIS_TIMEOUT = 5.0      # Hard time cap per position (seconds)

# ──────────────────────────────────────────────────────────────
# External APIs
# ──────────────────────────────────────────────────────────────
CHESSCOM_API = "https://api.chess.com/pub"
LICHESS_API = "https://lichess.org/api"
HTTP_USER_AGENT = "chess-analysis-server/2.0 (+https://github.com/local)"

# ──────────────────────────────────────────────────────────────
# Move classification thresholds (centipawn loss vs. the best move)
# ──────────────────────────────────────────────────────────────
THRESHOLDS = {
    "best": 12,           # cp_loss <= 12  -> best move (or great/brilliant)
    "good": 40,           # cp_loss <= 40  -> good
    "inaccuracy": 90,     # cp_loss <= 90  -> inaccuracy
    "mistake": 180,       # cp_loss <= 180 -> mistake
    "blunder": 320,       # cp_loss <= 320 -> blunder; above -> critical blunder
    "only_move_gap": 150, # best move counts as "great" if it beats the 2nd best by this much
    "brilliant_min_eval": 80,  # mover must stay at least this far ahead (cp) for a sacrifice to be brilliant
}
