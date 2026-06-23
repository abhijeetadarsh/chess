let ctx: AudioContext | null = null

/** Synthesises a short wooden "click" for a piece move (no audio asset needed). */
export function playMoveSound(isCapture: boolean, enabled: boolean) {
  if (!enabled) return
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const t = ctx.currentTime
    const len = Math.floor(ctx.sampleRate * 0.1)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25))
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = isCapture ? 650 : 950
    lp.Q.value = 1.0
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(isCapture ? 0.72 : 0.52, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    src.connect(lp)
    lp.connect(gain)
    gain.connect(ctx.destination)
    src.start(t)
  } catch {
    /* audio not available */
  }
}
