import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'

import { useAuth } from '@/hooks/useAuth'
import type { EvalInfo, UseAnalysis } from '@/hooks/useAnalysis'
import { BOARD_THEMES, PIECE_CODES, pieceUrl } from '@/lib/chess-assets'
import { playCheckSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { EvalBar } from './EvalBar'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

/** The square of the king currently in check (side to move), or null. */
function findCheckSquare(fen: string): string | null {
  try {
    const game = new Chess(fen)
    if (!game.inCheck()) return null
    const turn = game.turn() // side to move is the one in check
    const board = game.board()
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c]
        if (p && p.type === 'k' && p.color === turn) return FILES[c] + (8 - r)
      }
    }
  } catch {
    /* invalid fen */
  }
  return null
}

const EVAL_BAR_SPACE = 22 // horizontal eval bar row (16) + gap (6), stacked above the board

export interface BoardHighlight {
  from: string
  to: string
}

/** Arrow keys step through moves; `f` flips the board. Shared by both layouts. */
export function useBoardKeyboardNav(analysis: UseAnalysis) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft' && analysis.currentIndex > -1) analysis.goToMove(analysis.currentIndex - 1)
      else if (e.key === 'ArrowRight' && analysis.currentIndex < analysis.moves.length - 1)
        analysis.goToMove(analysis.currentIndex + 1)
      else if (e.key.toLowerCase() === 'f') analysis.flip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [analysis])
}

/**
 * The board + eval bar, sized to the *actual* free area of its wrapper
 * (width × height). Shared by the desktop BoardPanel and the mobile layout so
 * the sizing logic and piece/theme rendering never diverge between the two.
 */
export function BoardView({
  fen,
  orientation,
  onPieceDrop,
  highlight,
  evalInfo,
  animationMs = 260,
  draggable = true,
  maxSize = 1100,
  className,
  widthDriven = false,
  heightVh = 0.6,
  active = true,
}: {
  fen: string
  orientation: 'white' | 'black'
  onPieceDrop: (source: string, target: string) => boolean
  highlight: BoardHighlight | null
  evalInfo: EvalInfo
  animationMs?: number
  draggable?: boolean
  maxSize?: number
  className?: string
  /**
   * Mobile board tab: size the board from the container *width* and a viewport
   * cap instead of the wrapper's height. The card below the board changes height
   * as you step through moves, so height-based sizing would resize the board on
   * every move — width + viewport are stable, so the board stays put.
   */
  widthDriven?: boolean
  /** Fraction of the viewport height the board may use in width-driven mode. */
  heightVh?: number
  /**
   * Whether the board is currently visible. When the board lives in a tab that
   * is hidden with `display:none`, the ResizeObserver doesn't fire on un-hide —
   * so we recompute the size whenever this flips back to true.
   */
  active?: boolean
}) {
  const { settings } = useAuth()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [boardSize, setBoardSize] = useState(320)

  useEffect(() => {
    if (!active) return
    const compute = () => {
      const w = wrapRef.current?.clientWidth ?? 0
      if (w < 10) return
      // In width-driven mode the height limit comes from the viewport (stable),
      // not the wrapper — so content changes below the board never resize it.
      const heightLimit = widthDriven ? window.innerHeight * heightVh : wrapRef.current?.clientHeight ?? 0
      if (heightLimit < 10) return
      // The eval bar sits *above* the board now, so it eats vertical space (not
      // width); the board can use the full container width.
      setBoardSize(Math.floor(Math.min(w, heightLimit - EVAL_BAR_SPACE, maxSize)))
    }
    // Recompute on the next frame too: when un-hidden, layout isn't final yet
    // on the first synchronous pass.
    compute()
    const raf = requestAnimationFrame(compute)
    const ro = new ResizeObserver(compute)
    if (wrapRef.current) ro.observe(wrapRef.current)
    window.addEventListener('resize', compute)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [maxSize, widthDriven, heightVh, active])

  const [light, dark] = BOARD_THEMES[settings.board_theme] ?? BOARD_THEMES.green

  const customPieces = useMemo(() => {
    const set = settings.piece_set
    const obj: Record<string, (p: { squareWidth: number }) => ReactNode> = {}
    for (const code of PIECE_CODES) {
      obj[code] = ({ squareWidth }) => (
        <img
          src={pieceUrl(set, code)}
          alt=""
          draggable={false}
          style={{ width: squareWidth, height: squareWidth }}
        />
      )
    }
    return obj
  }, [settings.piece_set])

  // The king in check gets a pulsing red marker, and a distinct alert sound is
  // played whenever the *displayed* position transitions into check (covers both
  // live play and stepping through analysis).
  const checkSquare = useMemo(() => findCheckSquare(fen), [fen])
  const wasCheckRef = useRef(false)
  useEffect(() => {
    if (checkSquare && !wasCheckRef.current) playCheckSound(!!settings.sound_enabled)
    wasCheckRef.current = !!checkSquare
  }, [checkSquare, fen, settings.sound_enabled])

  const highlightStyles = useMemo(() => {
    const s: Record<string, CSSProperties> = {}
    if (highlight) {
      s[highlight.from] = { boxShadow: 'inset 0 0 0 4px rgba(255,199,0,.45)' }
      s[highlight.to] = { boxShadow: 'inset 0 0 0 4px rgba(0,113,227,.5)' }
    }
    if (checkSquare) {
      s[checkSquare] = {
        ...(s[checkSquare] ?? {}),
        background: 'radial-gradient(circle, rgba(220,38,38,.9) 0%, rgba(220,38,38,.45) 45%, transparent 72%)',
        boxShadow: 'inset 0 0 0 4px rgba(220,38,38,.65)',
        animation: 'checkPulse 1s ease-in-out infinite',
      }
    }
    return s
  }, [highlight, checkSquare])

  // ── Tap-to-move ──────────────────────────────────────────────────────────
  const tapMove = !!settings.tap_to_move
  const interactive = draggable // both drag and tap are blocked when this is false
  const [selected, setSelected] = useState<string | null>(null)

  // Clear any selection whenever the position changes (a move was made/navigated)
  // or tap-to-move is switched off.
  useEffect(() => setSelected(null), [fen, tapMove])

  const legalTargets = useMemo(() => {
    const map = new Map<string, boolean>() // square -> isCapture
    if (!tapMove || !selected) return map
    try {
      const game = new Chess(fen)
      for (const m of game.moves({ square: selected as Square, verbose: true })) {
        map.set(m.to, !!m.captured || m.flags.includes('e'))
      }
    } catch {
      /* invalid fen / square */
    }
    return map
  }, [tapMove, selected, fen])

  const handleSquareClick = (square: string) => {
    if (!tapMove || !interactive) return
    if (selected === square) {
      setSelected(null)
      return
    }
    if (selected && legalTargets.has(square)) {
      onPieceDrop(selected, square)
      setSelected(null)
      return
    }
    try {
      const game = new Chess(fen)
      const piece = game.get(square as Square)
      setSelected(piece && piece.color === game.turn() ? square : null)
    } catch {
      setSelected(null)
    }
  }

  const squareStyles = useMemo(() => {
    if (!tapMove || !selected) return highlightStyles
    const merged: Record<string, CSSProperties> = { ...highlightStyles }
    const add = (sq: string, style: CSSProperties) => {
      merged[sq] = { ...(merged[sq] ?? {}), ...style }
    }
    add(selected, { background: 'rgba(255,199,0,.42)' })
    for (const [sq, isCapture] of legalTargets) {
      add(
        sq,
        isCapture
          ? { background: 'radial-gradient(circle, transparent 52%, rgba(0,0,0,.22) 54%, rgba(0,0,0,.22) 62%, transparent 64%)' }
          : { background: 'radial-gradient(circle, rgba(0,0,0,.24) 0 19%, transparent 21%)' },
      )
    }
    return merged
  }, [tapMove, selected, legalTargets, highlightStyles])

  return (
    <div
      ref={wrapRef}
      className={cn(
        'flex items-center justify-center overflow-hidden',
        widthDriven ? 'w-full' : 'min-h-0 flex-1',
        className,
      )}
    >
      <div className="flex flex-col gap-1.5" style={{ width: boardSize, height: boardSize + EVAL_BAR_SPACE }}>
        <EvalBar evalInfo={evalInfo} orientation={orientation} />
        <div className="overflow-hidden rounded-md shadow" style={{ width: boardSize, height: boardSize }}>
          <Chessboard
            id="board"
            position={fen}
            boardOrientation={orientation}
            boardWidth={boardSize}
            onPieceDrop={(s, t) => onPieceDrop(s, t)}
            onSquareClick={handleSquareClick}
            customPieces={customPieces}
            customLightSquareStyle={{ backgroundColor: light }}
            customDarkSquareStyle={{ backgroundColor: dark }}
            customSquareStyles={squareStyles}
            animationDuration={animationMs}
            arePiecesDraggable={draggable && !tapMove}
          />
        </div>
      </div>
    </div>
  )
}
