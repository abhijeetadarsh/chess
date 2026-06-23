# ♟ Chess Analysis Server

Deep, move-by-move analysis of chess games from **Chess.com** and **Lichess**,
powered by **Stockfish**. Fetch a player's recent games (or paste a PGN), and get
per-move evaluations, the engine's best alternatives, accuracy scores, and a plain-
English explanation of *why* each move is good or bad.

![stack](https://img.shields.io/badge/Python-3.12-blue) ![stack](https://img.shields.io/badge/FastAPI-3.0-009688) ![stack](https://img.shields.io/badge/Engine-Stockfish-green) ![stack](https://img.shields.io/badge/UI-React%20%2B%20shadcn-61dafb)

---

## Features

- **Fetch games** from Chess.com or Lichess by username (no auth needed).
- **Streaming analysis** — moves appear one-by-one with a live progress bar.
- **Move classification**: Brilliant ‼ · Great ! · Best ★ · Good ✓ · Inaccuracy ?! · Mistake ? · Blunder ?? · Critical ✗
- **Best alternatives** for every position with their evaluations.
- **Win%-based accuracy** scores per player (Lichess model).
- **Interactive web UI** (React + shadcn/ui): board with evaluation bar, drag any piece
  to test a line, click an engine move to play it, last-move highlight, board flip,
  keyboard navigation (← → F), and "jump to next mistake".
- **User accounts** (local SQLite) with a login page and per-user saved settings.
- **Settings drawer**: link Chess.com/Lichess usernames, default fetch source & count,
  engine speed, 5 interface themes, 6 board colors, 12 piece sets, and move sounds.
- **REST API** with OpenAPI docs at `/docs`.

---

## Setup

### 1. Create the conda environment

```bash
conda env create -f environment.yml
```

This creates an isolated env named **`chess-analysis`**.

### 2. Install Stockfish

```bash
conda run -n chess-analysis python setup_stockfish.py
```

This downloads the latest Stockfish build into `stockfish/stockfish.exe`.
(Or download manually from https://stockfishchess.org/download/ and place
`stockfish.exe` in the `stockfish/` folder.)

### 3. Build the web UI

The frontend is a **React + Vite + shadcn/ui** app. Build it once (and again after any
UI change). Requires **Node 18+**:

```bash
npm --prefix frontend install
npm --prefix frontend run build
```

This compiles to `frontend/dist/`, which the FastAPI server serves at `/`.

> For live UI development with hot-reload, run `npm --prefix frontend run dev` (Vite on
> :5173, which proxies the API to the FastAPI server on :8000) alongside the server.

### 4. Run

```bash
start.bat
```

Then open **http://localhost:8000** in your browser. First run, create an account on the
login screen — it's stored locally in `data/users.db`.

> **Deploying to a server?** See **[DEPLOYMENT.md](DEPLOYMENT.md)** for production setup
> (Linux + systemd + nginx + HTTPS, a Docker option, and Windows notes).

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/games/chesscom/{username}?max_games=10` | Recent Chess.com games |
| `GET`  | `/games/lichess/{username}?max_games=10`  | Recent Lichess games |
| `POST` | `/analyze` | Analyze a PGN, return full result |
| `POST` | `/analyze/stream` | Analyze a PGN, stream NDJSON progress |
| `POST` | `/analyze/game?source=&username=&game_index=` | Fetch + analyze one game |
| `POST` | `/evaluate` | Evaluate a single FEN (interactive move-testing) |
| `POST` | `/auth/register` · `/auth/login` · `/auth/logout` | Account & session management |
| `GET`  | `/auth/me` · `PUT /auth/settings` | Current user & saved settings |
| `GET`  | `/health` | Server + Stockfish status |

Interactive docs: **http://localhost:8000/docs**

### Example

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"pgn": "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ...", "depth": 16}'
```

---

## Configuration

Edit `config.py` or set environment variables:

| Variable | Default | Meaning |
|----------|---------|---------|
| `STOCKFISH_PATH` | `stockfish/stockfish.exe` | Path to the engine binary |
| `ENGINE_THREADS` | CPU count − 1 | Engine threads |
| `ENGINE_HASH_MB` | 256 | Engine hash table size |

`DEFAULT_DEPTH` (16) trades speed vs. strength. Higher depth = stronger but slower.

---

## Project layout

| File | Purpose |
|------|---------|
| `main.py` | FastAPI app & endpoints |
| `engine.py` | Stockfish wrapper, classification, explanations |
| `fetcher.py` | Chess.com & Lichess API clients |
| `config.py` | Tunable settings & thresholds |
| `setup_stockfish.py` | Auto-downloads Stockfish |
| `auth.py` | SQLite user accounts, sessions & settings |
| `frontend/` | React + Vite + shadcn/ui web UI (builds to `frontend/dist/`) |
| `environment.yml` | Conda environment spec |
| `start.bat` | Launcher |
| `DEPLOYMENT.md` | Production deployment guide |

---

## Notes

- Analysis is CPU-bound: a full game at depth 16 takes ~1–3 minutes depending on
  your hardware. Lower the depth for faster (weaker) results.
- Results are cached in memory for an hour; game lists for 5 minutes.
- "Brilliant" detection is heuristic (a sound piece sacrifice that the engine
  confirms as best) and intentionally rare.
