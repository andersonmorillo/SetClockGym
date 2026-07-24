let audioCtx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration = 0.14,
) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.value = 0.0001
  oscillator.connect(gain)
  gain.connect(ctx.destination)

  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration - 0.02)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration)
}

export function playBeep(
  kind: 'tick' | 'phase' | 'seriesStart' | 'seriesEnd' = 'tick',
) {
  try {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const now = ctx.currentTime

    if (kind === 'seriesEnd') {
      playTone(ctx, 520, now, 0.12)
      playTone(ctx, 390, now + 0.16, 0.16)
      return
    }

    if (kind === 'seriesStart') {
      playTone(ctx, 660, now, 0.12)
      playTone(ctx, 880, now + 0.14, 0.16)
      return
    }

    playTone(ctx, kind === 'phase' ? 880 : 660, now, 0.14)
  } catch {
    // Ignore audio errors (autoplay policies, missing APIs).
  }
}
