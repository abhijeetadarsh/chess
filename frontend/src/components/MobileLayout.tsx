import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  FlipVertical2,
  Gamepad2,
  ListOrdered,
  Search,
  Settings,
  Swords,
} from 'lucide-react'

import type { UseAnalysis } from '@/hooks/useAnalysis'
import {
  CLASS_BG,
  CLASS_ICON,
  CLASS_LABEL,
  CLASS_TEXT,
  ISSUE_CLASSES,
  formatEval,
} from '@/lib/chess-assets'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AnalysisPanel } from './AnalysisPanel'
import { AltMoveButtons } from './MoveCard'
import { BoardView, useBoardKeyboardNav } from './BoardView'
import { GameItem, SourceForm } from './SourcesPanel'

type MobileTab = 'board' | 'moves' | 'games'

export function MobileLayout({
  analysis,
  onOpenSettings,
  onPlayBot,
}: {
  analysis: UseAnalysis
  onOpenSettings: () => void
  onPlayBot?: () => void
}) {
  useBoardKeyboardNav(analysis)
  const [tab, setTab] = useState<MobileTab>('games')

  // Jump to the board the moment a new game starts analysing (a fresh `meta`
  // object lands once per analysis — from a game tap *or* a pasted PGN).
  const prevMeta = useRef(analysis.meta)
  useEffect(() => {
    if (analysis.meta && analysis.meta !== prevMeta.current) setTab('board')
    prevMeta.current = analysis.meta
  }, [analysis.meta])

  const issueCount = analysis.moves.filter((m) => ISSUE_CLASSES.has(m.classification)).length
  const atStart = analysis.currentIndex < 0
  const total = analysis.moves.length
  const current = atStart ? null : analysis.moves[analysis.currentIndex]

  const title = analysis.meta ? `${analysis.meta.white} vs ${analysis.meta.black}` : 'Chess Analysis'
  const subtitle =
    analysis.meta?.opening && analysis.meta.opening !== 'Unknown'
      ? analysis.meta.opening
      : analysis.meta?.result
        ? `Result ${analysis.meta.result}`
        : 'Deep analysis powered by Stockfish'

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* ── Top app bar ─────────────────────────────────────────────── */}
      <header className="z-20 flex-shrink-0 border-b bg-card/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2.5 px-3">
          <span className="text-xl leading-none">♟</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold tracking-tight">{title}</div>
            <div className="truncate text-[0.7rem] text-muted-foreground">{subtitle}</div>
          </div>
          <button
            onClick={() => analysis.flip()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Flip board"
          >
            <FlipVertical2 className="h-5 w-5" />
          </button>
          <button
            onClick={onOpenSettings}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
        {analysis.streaming && (
          <div className="h-1 w-full overflow-hidden bg-secondary">
            <div
              className="h-full bg-gradient-to-r from-primary to-good transition-[width] duration-200"
              style={{ width: `${Math.round(analysis.progress * 100)}%` }}
            />
          </div>
        )}
      </header>

      {/* ── Tab bodies (all mounted; inactive ones hidden to preserve state) ── */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {/* Board — fixed size (width + viewport driven), pinned to the top so the
            card below never resizes it as you step through moves. */}
        <div className={cn('flex h-full flex-col', tab !== 'board' && 'hidden')}>
          <div className="flex-shrink-0 px-2 pt-3">
            <BoardView
              fen={analysis.currentFen}
              orientation={analysis.orientation}
              onPieceDrop={analysis.onPieceDrop}
              highlight={analysis.highlight}
              evalInfo={analysis.evalInfo}
              animationMs={analysis.animationMs}
              maxSize={680}
              widthDriven
              heightVh={0.58}
              active={tab === 'board'}
            />
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-t px-3 py-3 [overscroll-behavior:contain]">
            <MoveCoachCard analysis={analysis} current={current} atStart={atStart} hasGame={total > 0} />
          </div>
        </div>

        {/* Moves */}
        <div className={cn('h-full', tab !== 'moves' && 'hidden')}>
          <AnalysisPanel analysis={analysis} embedded />
        </div>

        {/* Games */}
        <div
          className={cn(
            'scrollbar-thin h-full overflow-y-auto [overscroll-behavior:contain]',
            tab !== 'games' && 'hidden',
          )}
        >
          <div className="px-4 pb-4 pt-4">
            <SourceForm analysis={analysis} onPlayBot={onPlayBot} />
          </div>
          <div className="border-t px-4 py-3 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
            Games
          </div>
          <div className="px-3 pb-4">
            {analysis.games.length === 0 ? (
              <div className="flex h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                Fetch games above, or paste a PGN.
              </div>
            ) : (
              analysis.games.map((g, i) => (
                <GameItem
                  key={i}
                  game={g}
                  selected={i === analysis.selectedGameIndex}
                  onClick={() => analysis.selectGame(i)}
                />
              ))
            )}
          </div>
        </div>
      </main>

      {/* ── Bottom controls ─────────────────────────────────────────── */}
      <footer className="z-20 flex-shrink-0 border-t bg-card pb-[env(safe-area-inset-bottom)]">
        {/* Move navigation — relevant on board & moves tabs */}
        {tab !== 'games' && (
          <div className="flex items-center gap-1 border-b px-2 py-2">
            <NavBtn title="Start" onClick={() => analysis.goToMove(-1)} disabled={atStart}>
              <ChevronFirst />
            </NavBtn>
            <NavBtn
              title="Previous"
              onClick={() => analysis.currentIndex > -1 && analysis.goToMove(analysis.currentIndex - 1)}
              disabled={atStart}
            >
              <ChevronLeft />
            </NavBtn>
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-1 leading-none">
              <span className="truncate font-mono text-sm font-extrabold">
                {current ? current.san : 'Start'}
              </span>
              <span className="mt-0.5 text-[0.66rem] text-muted-foreground">
                {total ? `${analysis.currentIndex + 1} / ${total}` : 'No game'}
              </span>
            </div>
            <NavBtn
              title="Next"
              onClick={() =>
                analysis.currentIndex < total - 1 && analysis.goToMove(analysis.currentIndex + 1)
              }
              disabled={analysis.currentIndex >= total - 1}
            >
              <ChevronRight />
            </NavBtn>
            <NavBtn
              title="End"
              onClick={() => total && analysis.goToMove(total - 1)}
              disabled={analysis.currentIndex >= total - 1}
            >
              <ChevronLast />
            </NavBtn>
          </div>
        )}

        {/* Tab bar */}
        <nav className="flex items-stretch">
          <TabButton
            active={tab === 'board'}
            onClick={() => setTab('board')}
            icon={<Swords className="h-5 w-5" />}
            label="Board"
          />
          <TabButton
            active={tab === 'moves'}
            onClick={() => setTab('moves')}
            icon={<ListOrdered className="h-5 w-5" />}
            label="Moves"
            badge={issueCount || undefined}
          />
          <TabButton
            active={tab === 'games'}
            onClick={() => setTab('games')}
            icon={<Gamepad2 className="h-5 w-5" />}
            label="Games"
          />
        </nav>
      </footer>
    </div>
  )
}

/* ── Coach-style card describing the current move ───────────────────────── */
function MoveCoachCard({
  analysis,
  current,
  atStart,
  hasGame,
}: {
  analysis: UseAnalysis
  current: UseAnalysis['moves'][number] | null
  atStart: boolean
  hasGame: boolean
}) {
  if (analysis.exploring) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-good/40 bg-good/10 px-3.5 py-3">
        <Search className="h-4 w-4 flex-shrink-0 text-good" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold text-good">Exploring a line</div>
          <div className="truncate text-xs text-muted-foreground">{analysis.exploreHint}</div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => analysis.backToGame()}>
          ↩ Back
        </Button>
      </div>
    )
  }

  if (!hasGame) {
    return (
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <div className="text-3xl opacity-70">♟</div>
        <p className="max-w-[260px] text-sm leading-relaxed text-muted-foreground">
          Open the <b className="text-foreground">Games</b> tab to fetch your games or paste a PGN, then step
          through the analysis here.
        </p>
      </div>
    )
  }

  if (atStart || !current) {
    return (
      <div className="py-2 text-center text-sm text-muted-foreground">
        Starting position — tap <ChevronRight className="inline h-4 w-4 align-text-bottom" /> below to walk
        through the game move by move.
      </div>
    )
  }

  const colorIcon = current.color === 'white' ? '⬜' : '⬛'
  return (
    <div>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-base font-black',
            CLASS_BG[current.classification],
          )}
        >
          {CLASS_ICON[current.classification]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={cn('font-mono text-lg font-extrabold tracking-tight', CLASS_TEXT[current.classification])}>
              {current.san}
            </span>
            <span className="text-sm text-muted-foreground">is {CLASS_LABEL[current.classification]}</span>
          </div>
          <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
            {colorIcon} Move {current.move_number} · {current.accuracy}% accuracy
          </div>
        </div>
        <span className="flex-shrink-0 rounded-lg bg-secondary px-2 py-1 font-mono text-xs font-bold tabular-nums">
          {formatEval(current.eval, current.mate_in)}
        </span>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{current.explanation}</p>

      {current.alternatives && current.alternatives.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">
            Top engine moves · tap to play
          </div>
          <AltMoveButtons
            alternatives={current.alternatives}
            onPlay={(uci) => analysis.playAlternative(analysis.currentIndex, uci)}
          />
        </div>
      )}
    </div>
  )
}

/* ── Bottom-bar building blocks ─────────────────────────────────────────── */
function NavBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors active:bg-primary active:text-primary-foreground disabled:opacity-35 [&_svg]:h-5 [&_svg]:w-5"
    >
      {children}
    </button>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[0.66rem] font-semibold transition-colors',
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span className="relative">
        {icon}
        {badge ? (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blunder px-1 text-[0.6rem] font-bold leading-none text-white">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
    </button>
  )
}
