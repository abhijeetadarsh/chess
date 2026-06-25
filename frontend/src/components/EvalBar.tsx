import { winPercent } from '@/lib/chess-assets'
import type { EvalInfo } from '@/hooks/useAnalysis'

export function EvalBar({
  evalInfo,
  orientation,
}: {
  evalInfo: EvalInfo
  orientation: 'white' | 'black'
}) {
  const ev = evalInfo.eval || 0
  const mate = evalInfo.mate
  const wp = mate != null ? (mate > 0 ? 100 : 0) : winPercent(ev * 100)
  // White sits on the side of the board it's drawn on: left when the board faces
  // white, right when it's flipped.
  const flip = orientation === 'black'
  const text = mate != null ? 'M' + Math.abs(mate) : (ev >= 0 ? '+' : '') + ev.toFixed(1)
  // The white/black boundary, as a percentage from the left, clamped so the
  // floating number never clips off either end of the bar.
  const boundaryLeft = Math.min(93, Math.max(7, flip ? 100 - wp : wp))

  return (
    <div className="relative h-4 w-full shrink-0">
      {/* Thin, sleek horizontal track — white's win-probability fill grows from white's side */}
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-zinc-700 ring-1 ring-black/25">
        <div
          className="absolute inset-y-0 bg-zinc-100 transition-[width] duration-300 ease-out"
          style={{ width: `${wp}%`, [flip ? 'right' : 'left']: 0 }}
        />
      </div>
      {/* Eval number rides the boundary as the score shifts */}
      <div
        className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-[5px] bg-background/85 px-1 py-px text-[9px] font-bold leading-none tabular-nums text-foreground shadow-sm ring-1 ring-border backdrop-blur-sm transition-[left] duration-300 ease-out"
        style={{ left: `${boundaryLeft}%` }}
      >
        {text}
      </div>
    </div>
  )
}
