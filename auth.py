"""SQLite-backed user management for Chess Analysis Server."""
import hashlib
import hmac
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "users.db"


@contextmanager
def _db():
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with _db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                username     TEXT    UNIQUE NOT NULL COLLATE NOCASE,
                email        TEXT,
                password_hash TEXT   NOT NULL,
                created_at   TEXT    DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id             INTEGER PRIMARY KEY,
                chesscom_username    TEXT    DEFAULT '',
                lichess_username     TEXT    DEFAULT '',
                default_games       INTEGER DEFAULT 10,
                default_source      TEXT    DEFAULT 'chesscom',
                sound_enabled       INTEGER DEFAULT 1,
                sound_style         TEXT    DEFAULT 'wood',
                ui_theme            TEXT    DEFAULT 'light',
                board_theme         TEXT    DEFAULT 'green',
                piece_set           TEXT    DEFAULT 'cburnett',
                engine_depth        INTEGER DEFAULT 14,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token       TEXT PRIMARY KEY,
                user_id     INTEGER NOT NULL,
                created_at  TEXT    DEFAULT (datetime('now')),
                expires_at  TEXT    NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)
        # Migrations: add columns introduced after a DB was first created.
        cols = {r[1] for r in conn.execute("PRAGMA table_info(user_settings)")}
        if "sound_style" not in cols:
            conn.execute("ALTER TABLE user_settings ADD COLUMN sound_style TEXT DEFAULT 'wood'")


# ── Password hashing ──────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"{salt}:{dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, dk_hex = stored.split(":", 1)
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return hmac.compare_digest(check.hex(), dk_hex)
    except Exception:
        return False


# ── User operations ───────────────────────────────────────────────────────────

def create_user(username: str, password: str, email: str | None = None) -> int:
    username = username.strip()
    if len(username) < 2:
        raise ValueError("Username must be at least 2 characters")
    if len(password) < 4:
        raise ValueError("Password must be at least 4 characters")
    with _db() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                (username, email or None, _hash_password(password)),
            )
        except sqlite3.IntegrityError:
            raise ValueError(f"Username '{username}' is already taken")
        uid = cur.lastrowid
        conn.execute("INSERT INTO user_settings (user_id) VALUES (?)", (uid,))
        return uid


def authenticate(username: str, password: str) -> dict | None:
    with _db() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username.strip(),),
        ).fetchone()
    if not row or not _verify_password(password, row["password_hash"]):
        return None
    token = secrets.token_urlsafe(32)
    expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
    with _db() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, row["id"], expires),
        )
    return {"token": token, "user_id": row["id"], "username": row["username"]}


def get_user_by_token(token: str) -> dict | None:
    if not token:
        return None
    with _db() as conn:
        row = conn.execute(
            """SELECT u.id, u.username, u.email
               FROM users u
               JOIN sessions s ON s.user_id = u.id
               WHERE s.token = ? AND s.expires_at > datetime('now')""",
            (token,),
        ).fetchone()
    return dict(row) if row else None


def get_settings(user_id: int) -> dict:
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM user_settings WHERE user_id = ?", (user_id,)
        ).fetchone()
    return dict(row) if row else {}


def save_settings(user_id: int, data: dict):
    allowed = {
        "chesscom_username", "lichess_username", "default_games", "default_source",
        "sound_enabled", "sound_style", "ui_theme", "board_theme", "piece_set", "engine_depth",
    }
    fields = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        return
    sets = ", ".join(f"{k} = ?" for k in fields)
    with _db() as conn:
        conn.execute(
            f"UPDATE user_settings SET {sets} WHERE user_id = ?",
            [*fields.values(), user_id],
        )


def revoke_session(token: str):
    with _db() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def revoke_all_sessions(user_id: int):
    with _db() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
