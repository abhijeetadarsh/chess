import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Chessboard } from 'react-chessboard'

import { useAuth } from '@/hooks/useAuth'
import type { UseAnalysis } from '@/hooks/useAnalysis'
import { BOARD_THEMES, PIECE_CODES, pieceUrl } from '@/lib/chess-assets'
import { cn } from '@/lib/utils'
import { EvalBar } from './EvalBar'

const EVAL_BAR_SPACE = 28 // eval bar width (20) + gap (8)

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
  analysis,
  maxSize = 1100,
  className,
  widthDriven = false,
  heightVh = 0.6,
  active = true,
}: {
  analysis: UseAnalysis
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
      setBoardSize(Math.floor(Math.min(w - EVAL_BAR_SPACE, heightLimit, maxSize)))
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

  const highlightStyles = useMemo(() => {
    if (!analysis.highlight) return {}
    return {
      [analysis.highlight.from]: { boxShadow: 'inset 0 0 0 4px rgba(255,199,0,.45)' },
      [analysis.highlight.to]: { boxShadow: 'inset 0 0 0 4px rgba(0,113,227,.5)' },
    }
  }, [analysis.highlight])

  return (
    <div
      ref={wrapRef}
      className={cn(
        'flex items-center justify-center overflow-hidden',
        widthDriven ? 'w-full' : 'min-h-0 flex-1',
        className,
      )}
    >
      <div className="flex items-stretch gap-2" style={{ height: boardSize, width: boardSize + EVAL_BAR_SPACE }}>
        <EvalBar evalInfo={analysis.evalInfo} orientation={analysis.orientation} />
        <div className="overflow-hidden rounded-md shadow" style={{ width: boardSize, height: boardSize }}>
          <Chessboard
            id="board"
            position={analysis.currentFen}
            boardOrientation={analysis.orientation}
            boardWidth={boardSize}
            onPieceDrop={(s, t) => analysis.onPieceDrop(s, t)}
            customPieces={customPieces}
            customLightSquareStyle={{ backgroundColor: light }}
            customDarkSquareStyle={{ backgroundColor: dark }}
            customSquareStyles={highlightStyles}
            animationDuration={analysis.animationMs}
            arePiecesDraggable
          />
        </div>
      </div>
    </div>
  )
}
