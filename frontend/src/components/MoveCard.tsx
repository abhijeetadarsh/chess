import { memo } from 'react'

import { CLASS_BG, CLASS_BORDER, CLASS_ICON, CLASS_LABEL, CLASS_TEXT, formatEval } from '@/lib/chess-assets'
import type { MoveData } from '@/lib/types'
import { cn } from '@/lib/utils'

interface MoveCardProps {
  move: MoveData
  index: number
  active: boolean
  onSelect: (index: number) => void
  onPlayAlt: (index: number, uci: string) => void
}

function MoveCardImpl({ move, index, active, onSelect, onPlayAlt }: MoveCardProps) {
  const icon = CLASS_ICON[move.classification] || ''
  const moveNum = move.color === 'white' ? `${move.move_number}.` : `${move.move_number}…`
  const colorIcon = move.color === 'white' ? '⬜' : '⬛'

  return (
    <div
      onClick={() => onSelect(index)}
      className={cn(
        'cursor-pointer rounded-xl border border-l-4 bg-card p-3 transition-all hover:translate-x-0.5 hover:shadow',
        CLASS_BORDER[move.classification],
        active && 'shadow ring-1 ring-primary',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-[48px] text-xs font-medium text-muted-foreground">
          {colorIcon} {moveNum}
        </span>
        <span className={cn('font-mono text-base font-extrabold tracking-tight', CLASS_TEXT[move.classification])}>
          {move.san} {icon}
        </span>
        <span className="text-sm font-semibold text-muted-foreground">
          {formatEval(move.eval, move.mate_in)}
        </span>
        <span className="text-[0.7rem] text-muted-foreground">· {move.accuracy}%</span>
        <span
          className={cn(
            'ml-auto rounded-full px-2 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wide',
            CLASS_BG[move.classification],
          )}
        >
          {CLASS_LABEL[move.classification]}
        </span>
      </div>

      <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{move.explanation}</div>

      {move.alternatives && move.alternatives.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1.5 text-[0.62rem] font-bold uppercase tracking-wide text-muted-foreground">
            Top engine moves · click to play
          </div>
          <div className="flex flex-wrap gap-1.5">
            {move.alternatives.map((a, i) => (
              <button
                key={i}
                title={`Play ${a.san}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onPlayAlt(index, a.uci)
                }}
                className={cn(
                  'flex items-center gap-1 rounded-lg border bg-secondary px-2.5 py-1.5 font-mono text-xs transition-all hover:-translate-y-px hover:border-good hover:text-good hover:shadow-sm',
                  a.is_played ? 'border-primary text-primary' : 'border-transparent',
                )}
              >
                {a.san}
                <span className="text-[0.7rem] text-muted-foreground">
                  {a.mate != null ? `#${Math.abs(a.mate)}` : (a.eval >= 0 ? '+' : '') + a.eval}
                </span>
                <span className="text-[0.62rem] opacity-50">▶</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const MoveCard = memo(MoveCardImpl)
