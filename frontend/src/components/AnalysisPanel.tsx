import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Loader2, PanelRightClose, PanelRightOpen } from 'lucide-react'

import type { UseAnalysis } from '@/hooks/useAnalysis'
import { CLASS_BG, CLASS_LABEL, ISSUE_CLASSES } from '@/lib/chess-assets'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MoveCard } from './MoveCard'

const CLASS_ORDER = ['brilliant', 'great', 'best', 'good', 'inaccuracy', 'mistake', 'blunder', 'critical_blunder']

export function AnalysisPanel({
  analysis,
  collapsed = false,
  onToggleCollapse,
  embedded = false,
}: {
  analysis: UseAnalysis
  collapsed?: boolean
  onToggleCollapse?: () => void
  /** Embedded mode drops the card chrome + collapse button (used inside the mobile Moves tab). */
  embedded?: boolean
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // Scroll the active move into view *within the list* (never the window).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [analysis.currentIndex])

  function jumpIssue(forward: boolean) {
    const idxs = analysis.moves
      .map((m, i) => (ISSUE_CLASSES.has(m.classification) ? i : -1))
      .filter((i) => i >= 0)
    if (!idxs.length) return
    let target: number | undefined
    if (forward) target = idxs.find((i) => i > analysis.currentIndex)
    else {
      const before = idxs.filter((i) => i < analysis.currentIndex)
      target = before.length ? before[before.length - 1] : undefined
    }
    if (target === undefined) target = forward ? idxs[0] : idxs[idxs.length - 1]
    analysis.goToMove(target)
  }

  const issueCount = analysis.moves.filter((m) => ISSUE_CLASSES.has(m.classification)).length

  const totals: Record<string, number> = {}
  if (analysis.summary) {
    for (const c of CLASS_ORDER) {
      totals[c] = (analysis.summary.white[c] || 0) + (analysis.summary.black[c] || 0)
    }
  }

  if (collapsed && onToggleCollapse) {
    return (
      <div className="flex w-10 flex-col items-center overflow-hidden rounded-xl border bg-card shadow">
        <button
          onClick={onToggleCollapse}
          className="flex h-12 w-full items-center justify-center text-muted-foreground hover:text-foreground"
          title="Expand analysis"
        >
          <PanelRightOpen className="h-5 w-5" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden',
        embedded ? 'h-full' : 'rounded-xl border bg-card shadow',
      )}
    >
      {!embedded && (
        <div className="flex flex-shrink-0 items-center justify-between px-4 py-3">
          <span className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
            Move analysis
          </span>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Collapse"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Game header — moved here so the board card stays all-board */}
      {analysis.meta && (
        <div className={cn('flex-shrink-0 border-b px-4 pb-3', embedded && 'pt-4')}>
          <div className="truncate text-sm font-bold tracking-tight">
            {analysis.meta.white} vs {analysis.meta.black} · {analysis.meta.result}
          </div>
          {analysis.meta.opening && analysis.meta.opening !== 'Unknown' && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              Opening: {analysis.meta.opening}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">
              ⬜ <b className="text-good">{analysis.accuracies ? `${analysis.accuracies.white}%` : '…'}</b>
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">
              ⬛ <b className="text-good">{analysis.accuracies ? `${analysis.accuracies.black}%` : '…'}</b>
            </span>
            {analysis.summary &&
              CLASS_ORDER.filter((c) => totals[c] > 0).map((c) => (
                <span key={c} className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${CLASS_BG[c]}`}>
                  {totals[c]} {CLASS_LABEL[c]}
                </span>
              ))}
          </div>
        </div>
      )}

      {analysis.streaming && (
        <div className="mx-4 mb-1 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-gradient-to-r from-primary to-good transition-[width] duration-200"
            style={{ width: `${Math.round(analysis.progress * 100)}%` }}
          />
        </div>
      )}

      {analysis.summary && (
        <div className="flex items-center gap-2 px-4 pb-3 pt-1">
          <Button size="sm" variant="secondary" onClick={() => jumpIssue(false)}>
            <ChevronLeft className="h-4 w-4" /> Prev issue
          </Button>
          <Button size="sm" variant="secondary" onClick={() => jumpIssue(true)}>
            Next issue <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-auto text-[0.71rem] text-muted-foreground">
            {issueCount} inaccuracies / mistakes / blunders
          </span>
        </div>
      )}

      <div ref={listRef} className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 pb-3.5 [overscroll-behavior:contain]">
        {analysis.moves.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3.5 p-7 text-center text-muted-foreground">
            <div className="text-5xl opacity-70">♟</div>
            <p className="max-w-[300px] text-sm leading-relaxed">
              Pick a game or paste a PGN. Analysis streams in move-by-move with evaluations, the engine's
              best alternatives, and plain-English explanations.
            </p>
          </div>
        ) : (
          analysis.moves.map((m, i) => (
            <div key={i} ref={i === analysis.currentIndex ? activeRef : undefined}>
              <MoveCard
                move={m}
                index={i}
                active={i === analysis.currentIndex}
                onSelect={analysis.goToMove}
                onPlayAlt={analysis.playAlternative}
              />
            </div>
          ))
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 border-t px-4 py-2.5 text-sm text-muted-foreground">
        {analysis.streaming && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        <span>{analysis.status}</span>
      </div>
    </div>
  )
}
