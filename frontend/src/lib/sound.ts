let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    return ctx
  } catch {
    return null
  }
}

/** A filtered noise burst — the "knock" family (wood / soft / click). */
function noiseHit(
  c: AudioContext,
  t: number,
  { dur, cutoff, gain, q }: { dur: number; cutoff: number; gain: number; q: number },
) {
  const len = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25))
  const src = c.createBufferSource()
  src.buffer = buf
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = cutoff
  lp.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(lp)
  lp.connect(g)
  g.connect(c.destination)
  src.start(t)
}

/** A short pitched blip — the "tone" family (marble / glass). */
function toneHit(
  c: AudioContext,
  t: number,
  { freq, dur, gain, type }: { freq: number; dur: number; gain: number; type: OscillatorType },
) {
  const osc = c.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.72, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

/** Plays the configured move sound (no audio assets — everything is synthesised). */
export function playMoveSound(isCapture: boolean, enabled: boolean, style = 'wood') {
  if (!enabled) return
  previewMoveSound(style, isCapture)
}

/** Same synthesis, but always audible — used to preview a style in Settings. */
export function previewMoveSound(style: string, isCapture = false) {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  switch (style) {
    case 'soft':
      noiseHit(c, t, { dur: 0.14, cutoff: isCapture ? 420 : 560, gain: isCapture ? 0.5 : 0.34, q: 0.7 })
      break
    case 'click':
      noiseHit(c, t, { dur: 0.05, cutoff: isCapture ? 1200 : 1700, gain: isCapture ? 0.6 : 0.46, q: 1.2 })
      break
    case 'marble':
      toneHit(c, t, { freq: isCapture ? 180 : 264, dur: 0.16, gain: isCapture ? 0.5 : 0.4, type: 'triangle' })
      break
    case 'glass':
      toneHit(c, t, { freq: isCapture ? 520 : 760, dur: 0.18, gain: isCapture ? 0.32 : 0.26, type: 'sine' })
      break
    case 'wood':
    default:
      noiseHit(c, t, { dur: 0.1, cutoff: isCapture ? 650 : 950, gain: isCapture ? 0.72 : 0.52, q: 1.0 })
      break
  }
}
