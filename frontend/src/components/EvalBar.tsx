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
  const flip = orientation === 'black'
  const text = mate != null ? 'M' + Math.abs(mate) : (ev >= 0 ? '+' : '') + ev.toFixed(1)
  // The white/black boundary, as a percentage from the top, clamped so the
  // floating number never clips off either end of the bar.
  const boundaryTop = Math.min(93, Math.max(7, flip ? wp : 100 - wp))

  return (
    <div className="relative h-full w-5 shrink-0">
      {/* Thin, sleek track — white's win-probability fill grows from white's side */}
      <div className="relative h-full w-full overflow-hidden rounded-full bg-zinc-700 ring-1 ring-black/25">
        <div
          className="absolute inset-x-0 bg-zinc-100 transition-[height] duration-300 ease-out"
          style={{ height: `${wp}%`, [flip ? 'top' : 'bottom']: 0 }}
        />
      </div>
      {/* Eval number runs along the bar, riding the boundary as the score shifts */}
      <div
        className="absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-[5px] bg-background/85 px-1 py-px text-[9px] font-bold leading-none tabular-nums text-foreground shadow-sm ring-1 ring-border backdrop-blur-sm transition-[top] duration-300 ease-out"
        style={{ top: `${boundaryTop}%` }}
      >
        {text}
      </div>
    </div>
  )
}
