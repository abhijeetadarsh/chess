import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  Bot,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  CornerUpLeft,
  Flag,
  FlipVertical2,
  Loader2,
  Lock,
  RotateCcw,
  Settings,
  Swords,
  Users,
} from 'lucide-react'

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
import { MoveCard } from './MoveCard'
import { MobileNav, type MobileSection } from './MobileNav'

/** Pre-game phase: the game-type menu, then the bot difficulty/colour picker. */
type PlayView = 'home' | 'setup'
/** In-game phase: which Play tab is showing (mirrors the shared bottom nav). */
type PlayTab = 'board' | 'moves'

/**
 * Mobile Play-vs-Bot screen. It deliberately reuses the *same* shell as the
 * analysis `MobileLayout` — identical top app bar (back · title · controls ·
 * settings), a Board tab with the board pinned to the bottom and the ⏮◀▶⏭
 * move-navigation strip beneath it, and a Moves tab rendered with the very same
 * `MoveCard` the analysis review uses. Only the data comes from the live game.
 */
export function PlayScreen({
  play,
  onClose,
  onOpenSettings,
  onSelectNav,
}: {
  play: UsePlay
  onClose: () => void
  onOpenSettings: () => void
  onSelectNav: (section: MobileSection) => void
}) {
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

  const title = play.started || view === 'setup' ? 'Play vs Bot' : 'Play'
  const subtitle = play.started
    ? `Stockfish · ${play.elo} Elo · you play ${play.userColor}`
    : view === 'setup'
      ? 'Pick a level and play Stockfish with live coaching'
      : 'Choose how you want to play'

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* ── Top app bar (mirrors the analysis MobileLayout header) ──────────── */}
      <header className="z-20 flex-shrink-0 border-b bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 items-center gap-1.5 px-3">
          <HeaderBtn onClick={back} title={!play.started && view === 'setup' ? 'Back' : 'Back to analysis'}>
            <ArrowLeft className="h-5 w-5" />
          </HeaderBtn>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold tracking-tight">{title}</div>
            <div className="truncate text-[0.7rem] text-muted-foreground">{subtitle}</div>
          </div>

          {/* Live-game controls live in the top bar so the bottom strip can stay
              an identical copy of the analysis move-navigation bar. */}
          {play.started && (
            <>
              {play.reviewing && (
                <HeaderBtn onClick={play.resume} title="Resume live game">
                  <CornerUpLeft className="h-5 w-5" />
                </HeaderBtn>
              )}
              {play.gameOver ? (
                <HeaderBtn onClick={play.newGame} title="New game">
                  <RotateCcw className="h-5 w-5" />
                </HeaderBtn>
              ) : (
                <HeaderBtn onClick={play.resign} title="Resign" disabled={play.thinking}>
                  <Flag className="h-5 w-5" />
                </HeaderBtn>
              )}
              <HeaderBtn onClick={play.flip} title="Flip board">
                <FlipVertical2 className="h-5 w-5" />
              </HeaderBtn>
            </>
          )}
          <HeaderBtn onClick={onOpenSettings} title="Settings">
            <Settings className="h-5 w-5" />
          </HeaderBtn>
        </div>
      </header>

      {/* ── Tab body ────────────────────────────────────────────────────────── */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
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
      </main>

      {/* ── Bottom controls: move-nav strip (in game) + persistent nav ──────── */}
      <div className="z-20 flex-shrink-0">
        {play.started && <PlayMoveNav play={play} />}
        <MobileNav
          active={navActive}
          onSelect={handleNav}
          movesBadge={play.started ? play.moves.length || undefined : undefined}
        />
      </div>
    </div>
  )
}

/* ── Board tab: coaching above, board pinned to the bottom (like analysis) ───── */
function PlayBoardTab({ play }: { play: UsePlay }) {
  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-3 [overscroll-behavior:contain]">
        <PlayFeedbackCard play={play} />
      </div>
      <div className="flex-shrink-0 border-t px-2 pb-3 pt-3">
        <BoardView
          fen={play.currentFen}
          orientation={play.orientation}
          onPieceDrop={play.onPieceDrop}
          highlight={play.highlight}
          evalInfo={play.evalInfo}
          animationMs={play.animationMs}
          draggable={!play.reviewing && !play.thinking && !play.gameOver}
          widthDriven
          heightVh={0.58}
          maxSize={680}
        />
      </div>
    </div>
  )
}

/* ── Moves tab: the scored move history, rendered with the analysis MoveCard ─── */
function PlayMovesTab({ play }: { play: UsePlay }) {
  const activeRef = useRef<HTMLDivElement>(null)
  const liveIdx = play.moves.length - 1
  const activeIndex = play.reviewing ? play.reviewIndex : liveIdx

  // Keep the active move in view within the list (never scroll the window).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeIndex])

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 py-3.5 [overscroll-behavior:contain]">
        {play.moves.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3.5 p-7 text-center text-muted-foreground">
            <div className="text-5xl opacity-70">♟</div>
            <p className="max-w-[300px] text-sm leading-relaxed">
              Every move — yours and the bot's — appears here as you play, each scored with the
              engine's best alternatives and a plain-English explanation, just like the game review.
            </p>
          </div>
        ) : (
          play.moves.map((m, i) => (
            <div key={i} ref={i === activeIndex ? activeRef : undefined}>
              <MoveCard
                move={m}
                index={i}
                active={i === activeIndex}
                onSelect={play.reviewMove}
                onPlayAlt={() => {}}
              />
            </div>
          ))
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 border-t px-4 py-2.5 text-sm text-muted-foreground">
        {play.thinking && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        <span className="truncate">{play.status}</span>
      </div>
    </div>
  )
}

/**
 * Move-navigation strip: ⏮◀▶⏭ stepping one ply at a time through the whole game
 * (your moves and the bot's). Reaching the latest ply resumes live play (so you
 * can move again). Shared by the mobile board tab and the desktop board panel.
 */
export function PlayMoveNav({ play }: { play: UsePlay }) {
  const total = play.moves.length
  const liveIdx = total - 1
  const idx = play.reviewing ? play.reviewIndex : liveIdx
  const cur = idx >= 0 ? play.moves[idx] : null
  const stepNext = () => {
    const t = idx + 1
    if (t >= liveIdx) play.resume()
    else play.reviewMove(t)
  }

  return (
    <div className="flex items-center gap-1 border-t bg-card px-2 py-2">
      <NavBtn title="First move" onClick={() => total && play.reviewMove(0)} disabled={total === 0 || idx <= 0}>
        <ChevronFirst />
      </NavBtn>
      <NavBtn
        title="Previous"
        onClick={() => idx > 0 && play.reviewMove(idx - 1)}
        disabled={total === 0 || idx <= 0}
      >
        <ChevronLeft />
      </NavBtn>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-1 leading-none">
        <span className="truncate font-mono text-sm font-extrabold">{cur ? cur.san : '—'}</span>
        <span className="mt-0.5 text-[0.66rem] text-muted-foreground">
          {total ? `${idx + 1} / ${total}` : 'No moves'}
        </span>
      </div>
      <NavBtn title="Next" onClick={stepNext} disabled={total === 0 || idx >= liveIdx}>
        <ChevronRight />
      </NavBtn>
      <NavBtn title="Live position" onClick={() => play.resume()} disabled={!play.reviewing}>
        <ChevronLast />
      </NavBtn>
    </div>
  )
}

/* ── Home: choose a game type ───────────────────────────────────────────────── */
function PlayHome({ onPlayBot }: { onPlayBot: () => void }) {
  return (
    <div className="scrollbar-thin h-full overflow-y-auto px-5 py-6">
      <GameTypeMenu onPlayBot={onPlayBot} />
    </div>
  )
}

/**
 * The game-type chooser (Play with Bot · random · friend). Shared by the mobile
 * Play home and the desktop control panel so both offer the same entry menu.
 */
export function GameTypeMenu({ onPlayBot }: { onPlayBot: () => void }) {
  return (
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
  )
}

function GameTypeCard({
  icon,
  title,
  subtitle,
  onClick,
  comingSoon,
}: {
  icon: ReactNode
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
    <div className="scrollbar-thin h-full overflow-y-auto px-5 py-6">
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

/* ── Shared bits ─────────────────────────────────────────────────────────────── */
function HeaderBtn({
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
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  )
}

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
