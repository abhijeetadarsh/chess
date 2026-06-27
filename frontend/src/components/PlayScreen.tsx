import { useState } from 'react'
import { ArrowLeft, Bot, FlipVertical2, Loader2, Lock, Swords, Users } from 'lucide-react'

import { type UsePlay } from '@/hooks/usePlay'
import {
  BOT_ELO_PRESETS,
  CLASS_BG,
  CLASS_ICON,
  CLASS_LABEL,
  CLASS_TEXT,
  formatEval,
} from '@/lib/chess-assets'
import type { MoveData } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { BoardView } from './BoardView'
import { MobileNav, type MobileSection } from './MobileNav'

/** Pre-game phase: the game-type menu, then the bot difficulty/colour picker. */
type PlayView = 'home' | 'setup'
/** In-game phase: which Play tab is showing (mirrors the shared bottom nav). */
type PlayTab = 'board' | 'moves'

export function PlayScreen({
  play,
  onClose,
  onSelectNav,
}: {
  play: UsePlay
  onClose: () => void
  onSelectNav: (section: MobileSection) => void
}) {
  // Pre-game step (only relevant while no game is running) and, during a game,
  // which Play tab is active. The game state itself lives in `play` (owned by
  // App) so it survives leaving and re-entering Play mode.
  const [view, setView] = useState<PlayView>('home')
  const [tab, setTab] = useState<PlayTab>('board')

  // Bottom-nav wiring: Games leaves Play for the analysis games tab; Board/Moves
  // switch the in-game Play tabs (so the bot game's moves live in the Moves tab);
  // Play returns to the game-type menu when idle.
  const handleNav = (section: MobileSection) => {
    if (section === 'games') return onSelectNav('games')
    if (section === 'play') {
      setTab('board')
      if (!play.started) setView('home')
      return
    }
    if (play.started) setTab(section as PlayTab)
    else setView('home')
  }
  const navActive: MobileSection = play.started ? tab : 'play'

  const back = () => {
    if (!play.started && view === 'setup') setView('home')
    else onClose()
  }

  const subtitle = play.started
    ? `Stockfish · ${play.elo} Elo · you play ${play.userColor}`
    : view === 'setup'
      ? 'Pick a level and play Stockfish with live coaching'
      : 'Choose how you want to play'

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Header — outer element carries the status-bar inset so its card
          background fills the area behind the clock (edge-to-edge). */}
      <header className="z-20 flex-shrink-0 border-b bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 items-center gap-2.5 px-3">
          <button
            onClick={back}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            title={!play.started && view === 'setup' ? 'Back' : 'Back to analysis'}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold tracking-tight">
              {play.started || view === 'setup' ? 'Play vs Bot' : 'Play'}
            </div>
            <div className="truncate text-[0.7rem] text-muted-foreground">{subtitle}</div>
          </div>
          {play.started && (
            <button
              onClick={play.flip}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Flip board"
            >
              <FlipVertical2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {play.started ? (
        tab === 'board' ? (
          <PlayBoardTab play={play} />
        ) : (
          <PlayMovesTab play={play} />
        )
      ) : view === 'setup' ? (
        <PlaySetup play={play} />
      ) : (
        <PlayHome onPlayBot={() => setView('setup')} />
      )}

      <MobileNav
        active={navActive}
        onSelect={handleNav}
        movesBadge={play.started ? play.moves.length || undefined : undefined}
      />
    </div>
  )
}

/* ── Home: choose a game type ───────────────────────────────────────────────── */
function PlayHome({ onPlayBot }: { onPlayBot: () => void }) {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-6">
      <div className="mx-auto w-full max-w-md space-y-3">
        <div className="mb-1 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
          New game
        </div>
        <GameTypeCard
          icon={<Bot className="h-6 w-6" />}
          title="Play with Bot"
          subtitle="Challenge Stockfish at any level — every move is coached."
          onClick={onPlayBot}
        />
        <GameTypeCard
          icon={<Users className="h-6 w-6" />}
          title="Play a random person"
          subtitle="Get matched with another player online."
          comingSoon
        />
        <GameTypeCard
          icon={<Swords className="h-6 w-6" />}
          title="Play with a friend"
          subtitle="Invite a friend with a private link."
          comingSoon
        />
      </div>
    </div>
  )
}

function GameTypeCard({
  icon,
  title,
  subtitle,
  onClick,
  comingSoon,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick?: () => void
  comingSoon?: boolean
}) {
  return (
    <button
      onClick={comingSoon ? undefined : onClick}
      disabled={comingSoon}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-2xl border px-4 py-4 text-left transition-all',
        comingSoon
          ? 'cursor-not-allowed border-border bg-secondary/40 opacity-70'
          : 'border-primary/30 bg-primary/5 hover:-translate-y-px hover:border-primary/60 hover:shadow',
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl',
          comingSoon ? 'bg-secondary text-muted-foreground' : 'bg-primary/15 text-primary',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-extrabold tracking-tight">{title}</span>
          {comingSoon && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">
              <Lock className="h-2.5 w-2.5" /> Soon
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[0.74rem] leading-snug text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  )
}

/* ── Setup: choose Elo + color ──────────────────────────────────────────────── */
export function PlaySetup({ play }: { play: UsePlay }) {
  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-6">
      <div className="mx-auto w-full max-w-md space-y-7">
        <div className="text-center">
          <div className="text-4xl">🤖</div>
          <h2 className="mt-2 text-lg font-extrabold tracking-tight">Play against Stockfish</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every move you make is scored and explained, just like the game review.
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
            Bot strength
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BOT_ELO_PRESETS.map((p) => (
              <button
                key={p.elo}
                onClick={() => play.setElo(p.elo)}
                className={cn(
                  'flex flex-col items-center rounded-xl border px-2 py-2.5 transition-all',
                  play.elo === p.elo
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border bg-secondary/50 hover:border-primary/50',
                )}
              >
                <span className="text-base font-extrabold tabular-nums">{p.elo}</span>
                <span className="text-[0.68rem] text-muted-foreground">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
            Play as
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['white', 'black'] as const).map((c) => (
              <button
                key={c}
                onClick={() => play.setUserColor(c)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold capitalize transition-all',
                  play.userColor === c
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border bg-secondary/50 hover:border-primary/50',
                )}
              >
                <span className="text-lg">{c === 'white' ? '⬜' : '⬛'}</span>
                {c}
              </button>
            ))}
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={play.start}>
          Start game
        </Button>
      </div>
    </div>
  )
}

/* ── Board tab: last-move coaching above the board + status/controls ─────────── */
function PlayBoardTab({ play }: { play: UsePlay }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden">
        {/* Last-move feedback above the board (mirrors the analysis coach card). */}
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-3 [overscroll-behavior:contain]">
          <PlayFeedbackCard play={play} />
        </div>

        {/* Status + controls */}
        <div className="flex flex-shrink-0 items-center gap-2 border-y px-3 py-2">
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {play.thinking && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            <span className="truncate">{play.status}</span>
          </span>
          {play.reviewing && (
            <Button size="sm" variant="secondary" onClick={play.resume}>
              ↩ Resume
            </Button>
          )}
          {play.gameOver ? (
            <Button size="sm" onClick={play.newGame}>
              New game
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={play.resign} disabled={play.thinking}>
              Resign
            </Button>
          )}
        </div>

        {/* Board pinned to the bottom */}
        <div className="flex-shrink-0 px-2 pb-3 pt-3">
          <BoardView
            fen={play.currentFen}
            orientation={play.orientation}
            onPieceDrop={play.onPieceDrop}
            highlight={play.highlight}
            evalInfo={play.evalInfo}
            animationMs={play.animationMs}
            draggable={!play.reviewing && !play.thinking && !play.gameOver}
            widthDriven
            heightVh={0.5}
            maxSize={560}
          />
        </div>
      </div>
    </div>
  )
}

/* ── Moves tab: the scored move history of the bot game ──────────────────────── */
function PlayMovesTab({ play }: { play: UsePlay }) {
  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-3 [overscroll-behavior:contain]">
      <div className="mx-auto w-full max-w-3xl">
        {play.moves.length === 0 ? (
          <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
            Your moves will be listed here as you play — each one scored and explained.
          </div>
        ) : (
          <>
            <div className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">
              Your moves
            </div>
            <div className="flex flex-col gap-1">
              {play.moves.map((m, i) => (
                <PlayMoveRow
                  key={i}
                  move={m}
                  active={play.reviewing ? i === play.reviewIndex : i === play.moves.length - 1}
                  onClick={() => play.reviewMove(i)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function PlayFeedbackCard({ play }: { play: UsePlay }) {
  if (play.gameOver) {
    const won = play.gameOver.winner === play.userColor
    const draw = play.gameOver.winner === null
    return (
      <div
        className={cn(
          'rounded-xl border px-4 py-3 text-center',
          draw ? 'border-border bg-secondary/60' : won ? 'border-good/40 bg-good/10' : 'border-blunder/40 bg-blunder/10',
        )}
      >
        <div className="text-2xl">{draw ? '🤝' : won ? '🏆' : '😞'}</div>
        <div className="mt-1 text-sm font-bold">{play.status}</div>
        {play.gameOver.result && (
          <div className="mt-0.5 text-xs text-muted-foreground">Result {play.gameOver.result}</div>
        )}
      </div>
    )
  }

  const m = play.feedback
  if (!m) {
    return (
      <div className="py-2 text-center text-sm text-muted-foreground">
        {play.thinking ? 'The bot is choosing its move…' : 'Make a move — your move will be scored and explained here.'}
      </div>
    )
  }

  const colorIcon = m.color === 'white' ? '⬜' : '⬛'
  return (
    <div>
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-base font-black',
            CLASS_BG[m.classification],
          )}
        >
          {CLASS_ICON[m.classification]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className={cn('font-mono text-lg font-extrabold tracking-tight', CLASS_TEXT[m.classification])}>
              {m.san}
            </span>
            <span className="text-sm text-muted-foreground">is {CLASS_LABEL[m.classification]}</span>
          </div>
          <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
            {colorIcon} Move {m.move_number} · {m.accuracy}% accuracy
          </div>
        </div>
        <span className="flex-shrink-0 rounded-lg bg-secondary px-2 py-1 font-mono text-xs font-bold tabular-nums">
          {formatEval(m.eval, m.mate_in)}
        </span>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{m.explanation}</p>

      {m.alternatives && m.alternatives.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">
            Engine's top moves here
          </div>
          <div className="flex flex-wrap gap-1.5">
            {m.alternatives.map((a, i) => (
              <span
                key={i}
                className={cn(
                  'flex items-center gap-1 rounded-lg border bg-secondary px-2.5 py-1.5 font-mono text-xs',
                  a.is_played ? 'border-primary text-primary' : 'border-transparent',
                )}
              >
                {a.san}
                <span className="text-[0.7rem] text-muted-foreground">
                  {a.mate != null ? `#${Math.abs(a.mate)}` : (a.eval >= 0 ? '+' : '') + a.eval}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function PlayMoveRow({ move, active, onClick }: { move: MoveData; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
        active ? 'border-primary bg-primary/5' : 'border-transparent bg-secondary/50 hover:bg-secondary',
      )}
    >
      <span
        className={cn(
          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-black',
          CLASS_BG[move.classification],
        )}
      >
        {CLASS_ICON[move.classification]}
      </span>
      <span className="font-mono text-sm font-bold">
        {move.move_number}. {move.san}
      </span>
      <span className={cn('text-[0.7rem] font-semibold', CLASS_TEXT[move.classification])}>
        {CLASS_LABEL[move.classification]}
      </span>
      <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
        {formatEval(move.eval, move.mate_in)}
      </span>
    </button>
  )
}
