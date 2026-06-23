import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Chessboard } from 'react-chessboard'
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  FlipVertical2,
  Lightbulb,
  Search,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import type { UseAnalysis } from '@/hooks/useAnalysis'
import { BOARD_THEMES, PIECE_CODES, pieceUrl } from '@/lib/chess-assets'
import { Button } from '@/components/ui/button'
import { EvalBar } from './EvalBar'

const EVAL_BAR_SPACE = 36 // eval bar width (28) + gap (8)

export function BoardPanel({ analysis }: { analysis: UseAnalysis }) {
  const { settings } = useAuth()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [boardSize, setBoardSize] = useState(420)

  // Size the square board to the *actual* free area (width × height) of the
  // board region. Because the chrome around it has fixed height, this never
  // changes when the explore/hint bar swaps — so the board never jumps.
  useEffect(() => {
    const compute = () => {
      const w = wrapRef.current?.clientWidth ?? 0
      const h = wrapRef.current?.clientHeight ?? 0
      if (w < 10 || h < 10) return
      setBoardSize(Math.floor(Math.min(w - EVAL_BAR_SPACE, h, 1100)))
    }
    compute()
    const ro = new ResizeObserver(compute)
    if (wrapRef.current) ro.observe(wrapRef.current)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [])

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

  // Keyboard navigation
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

  const counter =
    analysis.currentIndex < 0 ? 'Start' : `Move ${analysis.currentIndex + 1} / ${analysis.moves.length}`

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card p-3">
        {/* Board + eval bar — fills all remaining vertical space */}
        <div ref={wrapRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
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
                animationDuration={260}
                arePiecesDraggable
              />
            </div>
          </div>
        </div>

        {/* Controls — fixed height */}
        <div className="mt-2 flex flex-shrink-0 items-center justify-center gap-2">
          <NavBtn title="Start" onClick={() => analysis.goToMove(-1)}>
            <ChevronFirst />
          </NavBtn>
          <NavBtn
            title="Previous (←)"
            onClick={() => analysis.currentIndex > -1 && analysis.goToMove(analysis.currentIndex - 1)}
          >
            <ChevronLeft />
          </NavBtn>
          <span className="min-w-[98px] text-center text-sm font-medium text-muted-foreground">
            {counter}
          </span>
          <NavBtn
            title="Next (→)"
            onClick={() =>
              analysis.currentIndex < analysis.moves.length - 1 &&
              analysis.goToMove(analysis.currentIndex + 1)
            }
          >
            <ChevronRight />
          </NavBtn>
          <NavBtn title="End" onClick={() => analysis.goToMove(analysis.moves.length - 1)}>
            <ChevronLast />
          </NavBtn>
          <NavBtn title="Flip board (F)" onClick={() => analysis.flip()}>
            <FlipVertical2 />
          </NavBtn>
        </div>

        {/* Action bar — FIXED height so swapping hint↔explore never moves the board */}
        <div className="mt-2 flex h-11 flex-shrink-0 items-center">
          {analysis.exploring ? (
            <div className="flex w-full items-center gap-2.5 rounded-xl border border-good/40 bg-good/10 px-3.5 py-2">
              <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-extrabold text-good">
                <Search className="h-3.5 w-3.5" /> Exploring
              </span>
              <span className="flex-1 truncate text-xs text-muted-foreground">{analysis.exploreHint}</span>
              <Button size="sm" variant="secondary" onClick={() => analysis.backToGame()}>
                ↩ Back to game
              </Button>
            </div>
          ) : analysis.meta ? (
            <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" /> Drag a piece to test a line, or click an engine move to
              play it.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function NavBtn({
  children,
  onClick,
  title,
}: {
  children: ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground transition-all hover:-translate-y-px hover:bg-primary hover:text-primary-foreground [&_svg]:h-5 [&_svg]:w-5"
    >
      {children}
    </button>
  )
}
