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
  peak = 0.12,
) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.value = 0.0001
  oscillator.connect(gain)
  gain.connect(ctx.destination)

  const attack = Math.min(0.02, duration * 0.15)
  const release = Math.min(0.04, duration * 0.25)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(peak, startAt + attack)
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    startAt + Math.max(attack + 0.02, duration - release),
  )
  oscillator.start(startAt)
  oscillator.stop(startAt + duration)
}

export type BeepKind =
  | 'tick'
  | 'tickUrgent'
  | 'phase'
  | 'seriesStart'
  | 'seriesEnd'
  | 'exerciseStart'
  | 'exerciseEnd'

export function playBeep(kind: BeepKind = 'tick') {
  try {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const now = ctx.currentTime

    if (kind === 'exerciseEnd') {
      // Clear "this exercise is done" cue
      playTone(ctx, 740, now, 0.12, 0.16)
      playTone(ctx, 560, now + 0.14, 0.14, 0.16)
      playTone(ctx, 380, now + 0.3, 0.22, 0.18)
      return
    }

    if (kind === 'exerciseStart') {
      // Clear "exercise starting now" cue
      playTone(ctx, 520, now, 0.11, 0.15)
      playTone(ctx, 700, now + 0.13, 0.12, 0.16)
      playTone(ctx, 920, now + 0.28, 0.2, 0.2)
      return
    }

    if (kind === 'seriesEnd') {
      playTone(ctx, 520, now, 0.12, 0.14)
      playTone(ctx, 390, now + 0.16, 0.16, 0.14)
      return
    }

    if (kind === 'seriesStart') {
      playTone(ctx, 660, now, 0.12, 0.14)
      playTone(ctx, 880, now + 0.14, 0.16, 0.15)
      return
    }

    if (kind === 'tickUrgent') {
      playTone(ctx, 990, now, 0.18, 0.22)
      return
    }

    if (kind === 'phase') {
      playTone(ctx, 780, now, 0.12, 0.14)
      playTone(ctx, 980, now + 0.14, 0.16, 0.15)
      return
    }

    playTone(ctx, 720, now, 0.12, 0.16)
  } catch {
    // Ignore audio errors (autoplay policies, missing APIs).
  }
}
