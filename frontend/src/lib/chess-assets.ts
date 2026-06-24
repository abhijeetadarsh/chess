export const UI_THEMES: Record<string, { label: string; dot: string; bg: string }> = {
  light: { label: 'Light', dot: '#0071e3', bg: '#ffffff' },
  dark: { label: 'Dark', dot: '#0a84ff', bg: '#1c1c1e' },
  midnight: { label: 'Midnight', dot: '#6c63ff', bg: '#181b24' },
  slate: { label: 'Slate', dot: '#3b82f6', bg: '#161c25' },
  contrast: { label: 'Contrast', dot: '#ffd60a', bg: '#000000' },
}

export const BOARD_THEMES: Record<string, [string, string]> = {
  green: ['#ebecd0', '#779556'],
  brown: ['#f0d9b5', '#b58863'],
  blue: ['#dee3e6', '#8ca2ad'],
  gray: ['#dcdcdc', '#7f8a99'],
  purple: ['#e9e4f3', '#9a86c4'],
  wood: ['#e8c99b', '#a16f4a'],
}

export const PIECE_SETS = [
  'cburnett',
  'merida',
  'alpha',
  'gioco',
  'staunty',
  'horsey',
  'fresca',
  'cardinal',
  'tatiana',
  'governor',
  'maestro',
  'pixel',
]

const PIECE_BASE = 'https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/'

export const pieceUrl = (set: string, piece: string) => `${PIECE_BASE}${set}/${piece}.svg`

export const PIECE_CODES = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK']

export interface SpeedPreset {
  depth: number
  label: string
  hint: string
}

export const SPEED_PRESETS: SpeedPreset[] = [
  { depth: 10, label: 'Fast', hint: 'Fast · depth 10 — quick scan, ~15–30s/game' },
  { depth: 14, label: 'Balanced', hint: 'Balanced · depth 14 — good accuracy, ~30–60s/game' },
  { depth: 18, label: 'Deep', hint: 'Deep · depth 18 — strongest, can take a few minutes' },
]

export const SOUND_OPTIONS: { value: string; label: string }[] = [
  { value: 'wood', label: 'Wood' },
  { value: 'soft', label: 'Soft' },
  { value: 'click', label: 'Click' },
  { value: 'marble', label: 'Marble' },
  { value: 'glass', label: 'Glass' },
]

export const BOT_ELO_PRESETS: { elo: number; label: string }[] = [
  { elo: 400, label: 'Beginner' },
  { elo: 800, label: 'Casual' },
  { elo: 1200, label: 'Intermediate' },
  { elo: 1600, label: 'Advanced' },
  { elo: 2000, label: 'Expert' },
  { elo: 2400, label: 'Master' },
  { elo: 2800, label: 'Grandmaster' },
]

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export const CLASS_ICON: Record<string, string> = {
  brilliant: '!!',
  great: '!',
  best: '★',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  critical_blunder: '✗',
}

export const CLASS_LABEL: Record<string, string> = {
  brilliant: 'brilliant',
  great: 'great',
  best: 'best',
  good: 'good',
  inaccuracy: 'inaccuracy',
  mistake: 'mistake',
  blunder: 'blunder',
  critical_blunder: 'critical',
}

// Tailwind class fragments per classification (text / soft-bg / left-border)
export const CLASS_TEXT: Record<string, string> = {
  brilliant: 'text-brilliant',
  great: 'text-great',
  best: 'text-best',
  good: 'text-good',
  inaccuracy: 'text-inaccuracy',
  mistake: 'text-mistake',
  blunder: 'text-blunder',
  critical_blunder: 'text-critical',
}

export const CLASS_BG: Record<string, string> = {
  brilliant: 'bg-brilliant/15 text-brilliant',
  great: 'bg-great/15 text-great',
  best: 'bg-best/15 text-best',
  good: 'bg-good/15 text-good',
  inaccuracy: 'bg-inaccuracy/20 text-inaccuracy',
  mistake: 'bg-mistake/20 text-mistake',
  blunder: 'bg-blunder/20 text-blunder',
  critical_blunder: 'bg-blunder/20 text-blunder',
}

export const CLASS_BORDER: Record<string, string> = {
  brilliant: 'border-l-brilliant',
  great: 'border-l-great',
  best: 'border-l-best',
  good: 'border-l-good',
  inaccuracy: 'border-l-inaccuracy',
  mistake: 'border-l-mistake',
  blunder: 'border-l-blunder',
  critical_blunder: 'border-l-critical',
}

export const ISSUE_CLASSES = new Set(['inaccuracy', 'mistake', 'blunder', 'critical_blunder'])

export function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

export function formatEval(ev: number, mate: number | null): string {
  if (mate != null) return `#${mate > 0 ? '+' : ''}${mate}`
  return (ev >= 0 ? '+' : '') + ev.toFixed(2)
}
