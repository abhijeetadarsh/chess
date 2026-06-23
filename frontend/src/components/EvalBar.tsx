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

  return (
    <div className="relative h-full w-7 shrink-0 overflow-hidden rounded-md bg-zinc-600 ring-1 ring-black/30">
      {/* White's win-probability fill, growing from white's side of the board */}
      <div
        className="absolute inset-x-0 bg-zinc-100 transition-[height] duration-300 ease-out"
        style={{ height: `${wp}%`, [flip ? 'top' : 'bottom']: 0 }}
      />
      {/* Eval number — always white with a dark halo so it reads on either fill */}
      <div
        className="absolute inset-x-0 z-10 px-px text-center text-[10px] font-bold leading-none tabular-nums text-white"
        style={{
          [flip ? 'bottom' : 'top']: 3,
          textShadow: '0 0 2px #000, 0 0 3px #000, 0 1px 2px #000',
        }}
      >
        {text}
      </div>
    </div>
  )
}
