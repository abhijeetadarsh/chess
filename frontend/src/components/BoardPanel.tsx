import { type ReactNode } from 'react'
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  FlipVertical2,
  Lightbulb,
  Search,
} from 'lucide-react'

import type { UseAnalysis } from '@/hooks/useAnalysis'
import { Button } from '@/components/ui/button'
import { BoardView, useBoardKeyboardNav } from './BoardView'

export function BoardPanel({ analysis }: { analysis: UseAnalysis }) {
  useBoardKeyboardNav(analysis)

  const counter =
    analysis.currentIndex < 0 ? 'Start' : `Move ${analysis.currentIndex + 1} / ${analysis.moves.length}`

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card p-3">
        {/* Board + eval bar — fills all remaining vertical space */}
        <BoardView analysis={analysis} />

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
