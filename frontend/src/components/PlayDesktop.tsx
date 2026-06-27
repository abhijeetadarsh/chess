import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, FlipVertical2, Lightbulb, Loader2, Search, Settings, Swords } from 'lucide-react'

import { type UsePlay } from '@/hooks/usePlay'
import { BOT_ELO_PRESETS } from '@/lib/chess-assets'
import { Button } from '@/components/ui/button'
import { BoardView } from './BoardView'
import { GameTypeMenu, PlayFeedbackCard, PlayMoveRow, PlaySetup } from './PlayScreen'

/**
 * Desktop Play-vs-Bot layout. Mirrors the analysis view's three-pane grid
 * (controls · board · coaching) instead of reusing the cramped mobile column,
 * so a wide screen gets a full-size board with the setup and the move review
 * side-by-side. Mobile/tablet still use `PlayScreen`.
 */
export function PlayDesktop({
  play,
  onClose,
  onOpenSettings,
}: {
  play: UsePlay
  onClose: () => void
  onOpenSettings: () => void
}) {
  return (
    <div
      className="grid h-screen gap-[18px] p-[18px] pt-[max(18px,env(safe-area-inset-top))]"
      style={{ gridTemplateColumns: '300px minmax(440px,1.1fr) minmax(320px,1fr)' }}
    >
      <PlayControlPanel play={play} onClose={onClose} onOpenSettings={onOpenSettings} />
      <PlayBoardPanel play={play} />
      <PlayReviewPanel play={play} />
    </div>
  )
}

/* ── Left pane: setup before the game, game meta + actions during it ─────────── */
function PlayControlPanel({
  play,
  onClose,
  onOpenSettings,
}: {
  play: UsePlay
  onClose: () => void
  onOpenSettings: () => void
}) {
  const preset = BOT_ELO_PRESETS.find((p) => p.elo === play.elo)
  // Pre-game step: the game-type menu, then the bot difficulty/colour picker.
  const [view, setView] = useState<'home' | 'setup'>('home')
  const inSetup = play.started || view === 'setup'
  const back = () => (!play.started && view === 'setup' ? setView('home') : onClose())

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow">
      <div className="flex flex-shrink-0 items-center gap-2 border-b px-3 py-3">
        <button
          onClick={back}
          title={!play.started && view === 'setup' ? 'Back' : 'Back to analysis'}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate text-sm font-extrabold tracking-tight">
            <Swords className="h-4 w-4 text-primary" /> {inSetup ? 'Play vs Bot' : 'Play'}
          </div>
          <div className="truncate text-[0.7rem] text-muted-foreground">
            {play.started
              ? `Stockfish · ${play.elo} Elo`
              : view === 'setup'
                ? 'Pick a level and play with live coaching'
                : 'Choose how you want to play'}
          </div>
        </div>
        <button
          onClick={onOpenSettings}
          title="Settings"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 [overscroll-behavior:contain]">
        {play.started ? (
          <div className="space-y-4">
            {/* Current game */}
            <div className="rounded-xl border bg-secondary/40 p-4 text-center">
              <div className="text-3xl">🤖</div>
              <div className="mt-1 text-base font-extrabold tabular-nums">{play.elo} Elo</div>
              {preset && <div className="text-xs text-muted-foreground">{preset.label}</div>}
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-semibold capitalize">
                <span>{play.userColor === 'white' ? '⬜' : '⬛'}</span> You play {play.userColor}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {play.reviewing && (
                <Button variant="secondary" className="w-full" onClick={play.resume}>
                  ↩ Resume live game
                </Button>
              )}
              {play.gameOver ? (
                <Button className="w-full" onClick={play.newGame}>
                  New game
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={play.resign}
                  disabled={play.thinking}
                >
                  Resign
                </Button>
              )}
            </div>
          </div>
        ) : view === 'setup' ? (
          <PlaySetup play={play} />
        ) : (
          <GameTypeMenu onPlayBot={() => setView('setup')} />
        )}
      </div>
    </div>
  )
}

/* ── Center pane: full-size board (mirrors the analysis BoardPanel) ──────────── */
function PlayBoardPanel({ play }: { play: UsePlay }) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card p-3">
        <BoardView
          fen={play.currentFen}
          orientation={play.orientation}
          onPieceDrop={play.onPieceDrop}
          highlight={play.highlight}
          evalInfo={play.evalInfo}
          animationMs={play.animationMs}
          draggable={play.started && !play.reviewing && !play.thinking && !play.gameOver}
        />

        {/* Flip + live status */}
        <div className="mt-2 flex flex-shrink-0 items-center justify-center gap-2">
          <NavBtn title="Flip board" onClick={play.flip}>
            <FlipVertical2 />
          </NavBtn>
          <span className="flex min-w-[160px] items-center justify-center gap-1.5 text-center text-sm font-medium text-muted-foreground">
            {play.thinking && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            <span className="truncate">{play.started ? play.status : 'Set up your game on the left'}</span>
          </span>
        </div>

        {/* Action bar — FIXED height so swapping review↔hint never moves the board */}
        <div className="mt-2 flex h-11 flex-shrink-0 items-center">
          {play.reviewing ? (
            <div className="flex w-full items-center gap-2.5 rounded-xl border border-good/40 bg-good/10 px-3.5 py-2">
              <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-extrabold text-good">
                <Search className="h-3.5 w-3.5" /> Reviewing
              </span>
              <span className="flex-1 truncate text-xs text-muted-foreground">
                Your move {play.reviewIndex + 1} — play is paused
              </span>
              <Button size="sm" variant="secondary" onClick={play.resume}>
                ↩ Resume
              </Button>
            </div>
          ) : play.started && !play.gameOver ? (
            <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5" /> Drag a piece to make your move — it's scored and
              explained on the right.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ── Right pane: coaching feedback + your-move history (mirrors AnalysisPanel) ── */
function PlayReviewPanel({ play }: { play: UsePlay }) {
  const activeRef = useRef<HTMLDivElement>(null)
  const activeIndex = play.reviewing ? play.reviewIndex : play.moves.length - 1

  // Keep the active move in view within the list (never scroll the window).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeIndex])

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow">
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
        <span className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
          Move coaching
        </span>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 [overscroll-behavior:contain]">
        <PlayFeedbackCard play={play} />
        {play.moves.length > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">
              Your moves
            </div>
            <div className="flex flex-col gap-1">
              {play.moves.map((m, i) => (
                <div key={i} ref={i === activeIndex ? activeRef : undefined}>
                  <PlayMoveRow
                    move={m}
                    active={play.reviewing ? i === play.reviewIndex : i === play.moves.length - 1}
                    onClick={() => play.reviewMove(i)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 border-t px-4 py-2.5 text-sm text-muted-foreground">
        {play.thinking && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        <span>
          {play.moves.length} {play.moves.length === 1 ? 'move' : 'moves'} scored
        </span>
      </div>
    </div>
  )
}

function NavBtn({ children, onClick, title }: { children: ReactNode; onClick: () => void; title: string }) {
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
