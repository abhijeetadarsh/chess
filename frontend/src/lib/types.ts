export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'critical_blunder'

export interface GameInfo {
  source: string
  game_id: string
  url: string
  pgn: string
  time_control: string
  time_class: string
  rated: boolean
  white: string
  black: string
  white_rating?: number
  black_rating?: number
  white_result: string
  black_result: string
  end_time?: number
  opening?: string
}

export interface AltMove {
  san: string
  uci: string
  eval: number
  mate: number | null
  is_played: boolean
}

export interface MoveData {
  move_number: number
  color: 'white' | 'black'
  san: string
  uci?: string
  from: string
  to: string
  fen: string
  eval: number
  mate_in: number | null
  accuracy: number
  classification: Classification
  explanation: string
  alternatives: AltMove[]
}

export type ClassSummary = Record<string, number>

export interface MetaEvent {
  type: 'meta'
  white: string
  black: string
  result: string
  opening: string
}
export interface MoveEvent {
  type: 'move'
  index: number
  total: number
  data: MoveData
}
export interface SummaryEvent {
  type: 'summary'
  white_accuracy: number
  black_accuracy: number
  summary: { white: ClassSummary; black: ClassSummary }
}
export interface ErrorEvent {
  type: 'error'
  detail: string
}
export type StreamEvent = MetaEvent | MoveEvent | SummaryEvent | ErrorEvent

export interface EvalResult {
  eval: number
  mate: number | null
  best_san?: string
  best_uci?: string
  turn: string
  game_over: boolean
}

// ── Play vs bot ────────────────────────────────────────────────────────────────
export interface BotMove {
  san: string
  uci: string
  from: string
  to: string
  fen: string
}

export interface PlayMoveResult {
  feedback: MoveData // the user's move, scored like an analysed move
  bot: BotMove | null
  fen: string
  eval: number
  mate: number | null
  turn: 'white' | 'black'
  game_over: boolean
  result: string | null
  reason: string | null
  winner: 'white' | 'black' | null
}

export interface BotMoveResult {
  bot: BotMove | null
  fen: string
  eval: number
  mate: number | null
  turn: 'white' | 'black'
  game_over: boolean
  result: string | null
  reason: string | null
  winner: 'white' | 'black' | null
}

export interface UserSettings {
  chesscom_username: string
  lichess_username: string
  default_games: number
  default_source: string
  sound_enabled: number
  sound_style: string
  tap_to_move: number
  ui_theme: string
  board_theme: string
  piece_set: string
  engine_depth: number
}

export interface AuthUser {
  id: number
  username: string
  email?: string
  settings: UserSettings
}

export interface AuthResponse {
  token: string
  user_id: number
  username: string
  settings: UserSettings
}
