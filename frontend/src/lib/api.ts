import type {
  AuthResponse,
  AuthUser,
  BotMoveResult,
  EvalResult,
  GameInfo,
  PlayMoveResult,
  SavedBotGame,
  StreamEvent,
  UserSettings,
} from './types'

// Base URL for the backend. Empty (the default) means same-origin, which is
// correct when FastAPI serves the built SPA. The Android APK bundles the SPA
// with no backend, so set VITE_API_BASE at build time (e.g. https://your-host)
// to point at a deployed backend — otherwise the app's API calls will fail.
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '')
const apiUrl = (path: string) => `${API_BASE}${path}`

const TOKEN_KEY = 'ca_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

function authHeaders(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function asError(r: Response): Promise<never> {
  let detail = r.statusText
  try {
    const j = await r.json()
    detail = j.detail || detail
  } catch {
    /* ignore */
  }
  throw new Error(detail)
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<AuthResponse> {
  const r = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!r.ok) return asError(r)
  return r.json()
}

export async function register(username: string, password: string): Promise<AuthResponse> {
  const r = await fetch(apiUrl('/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!r.ok) return asError(r)
  return r.json()
}

export async function fetchMe(): Promise<AuthUser> {
  const r = await fetch(apiUrl('/auth/me'), { headers: authHeaders() })
  if (!r.ok) return asError(r)
  return r.json()
}

export async function logoutRequest(): Promise<void> {
  await fetch(apiUrl('/auth/logout'), { method: 'POST', headers: authHeaders() }).catch(() => {})
}

export async function saveSettings(partial: Partial<UserSettings>): Promise<void> {
  await fetch(apiUrl('/auth/settings'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(partial),
  }).catch(() => {})
}

// ── Games / analysis ───────────────────────────────────────────────────────────

export async function fetchGames(
  source: 'chesscom' | 'lichess',
  username: string,
  maxGames: number,
): Promise<GameInfo[]> {
  const r = await fetch(apiUrl(`/games/${source}/${encodeURIComponent(username)}?max_games=${maxGames}`))
  if (!r.ok) return asError(r)
  const data = await r.json()
  return data.games
}

// ── Play vs bot ────────────────────────────────────────────────────────────────

export async function playMove(
  fen: string,
  uci: string,
  elo: number,
  depth: number,
): Promise<PlayMoveResult> {
  const r = await fetch(apiUrl('/play/move'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, uci, elo, depth }),
  })
  if (!r.ok) return asError(r)
  return r.json()
}

export async function botMove(fen: string, elo: number): Promise<BotMoveResult> {
  const r = await fetch(apiUrl('/play/bot'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, elo }),
  })
  if (!r.ok) return asError(r)
  return r.json()
}

export interface SaveBotGamePayload {
  pgn: string
  user_color: 'white' | 'black'
  elo: number
  result: string | null
  reason: string | null
}

/** Persist a finished game vs the bot. Best-effort: never throws (fire-and-forget). */
export async function saveBotGame(payload: SaveBotGamePayload): Promise<void> {
  await fetch(apiUrl('/play/games'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }).catch(() => {})
}

/** List the current user's saved bot games (most recent first). */
export async function listBotGames(): Promise<SavedBotGame[]> {
  const r = await fetch(apiUrl('/play/games'), { headers: authHeaders() })
  if (!r.ok) return asError(r)
  const data = await r.json()
  return data.games
}

export async function evaluateFen(fen: string, depth = 12): Promise<EvalResult> {
  const r = await fetch(apiUrl('/evaluate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, depth }),
  })
  if (!r.ok) return asError(r)
  return r.json()
}

/**
 * Stream NDJSON analysis events from POST /analyze/stream as an async generator.
 * Pass an AbortSignal to cancel an in-flight analysis.
 */
export async function* streamAnalysis(
  pgn: string,
  depth: number,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const r = await fetch(apiUrl('/analyze/stream'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pgn, depth }),
    signal,
  })
  if (!r.ok || !r.body) return asError(r)

  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line) yield JSON.parse(line) as StreamEvent
    }
  }
  const tail = buf.trim()
  if (tail) yield JSON.parse(tail) as StreamEvent
}
