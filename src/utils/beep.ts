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

export function playBeep(kind: 'tick' | 'phase' = 'tick') {
  try {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = kind === 'phase' ? 880 : 660
    gain.gain.value = 0.0001
    oscillator.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    oscillator.start(now)
    oscillator.stop(now + 0.14)
  } catch {
    // Ignore audio errors (autoplay policies, missing APIs).
  }
}
