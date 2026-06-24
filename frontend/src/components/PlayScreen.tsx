import { ArrowLeft, FlipVertical2, Loader2, RotateCcw } from 'lucide-react'

import { usePlay, type UsePlay } from '@/hooks/usePlay'
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

export function PlayScreen({ onClose }: { onClose: () => void }) {
  const play = usePlay()

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="z-20 flex h-14 flex-shrink-0 items-center gap-2.5 border-b bg-card/95 px-3 backdrop-blur">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Back to analysis"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold tracking-tight">Play vs Bot</div>
          <div className="truncate text-[0.7rem] text-muted-foreground">
            {play.started
              ? `Stockfish · ${play.elo} Elo · you play ${play.userColor}`
              : 'Pick a level and play Stockfish with live coaching'}
          </div>
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
      </header>

      {play.started ? <PlayGame play={play} /> : <PlaySetup play={play} />}
    </div>
  )
}

/* ── Setup: choose Elo + color ──────────────────────────────────────────────── */
function PlaySetup({ play }: { play: UsePlay }) {
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

/* ── Active game: board + feedback + move list ──────────────────────────────── */
function PlayGame({ play }: { play: UsePlay }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden">
        {/* Board */}
        <div className="flex-shrink-0 px-2 pt-3">
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

        {/* Feedback + history */}
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-3 [overscroll-behavior:contain]">
          <PlayFeedbackCard play={play} />
          {play.moves.length > 0 && (
            <div className="mt-4">
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PlayFeedbackCard({ play }: { play: UsePlay }) {
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

function PlayMoveRow({ move, active, onClick }: { move: MoveData; active: boolean; onClick: () => void }) {
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
