import { getRoastAudioPath } from '../data/encouragements'

const STORAGE_KEY = 'gym-timer-speak-roasts'

let currentAudio: HTMLAudioElement | null = null

export function isSpeakRoastsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return true
    return raw === 'true'
  } catch {
    return true
  }
}

export function setSpeakRoastsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch {
    // Ignore storage errors.
  }
}

export function stopSpeaking(): void {
  if (!currentAudio) return
  currentAudio.pause()
  currentAudio.currentTime = 0
  currentAudio = null
}

export function speakRoast(index: number): void {
  if (typeof window === 'undefined') return
  if (!isSpeakRoastsEnabled()) return

  stopSpeaking()

  const audio = new Audio(getRoastAudioPath(index))
  audio.preload = 'auto'
  currentAudio = audio

  void audio.play().catch(() => {
    // Autoplay may be blocked until a user gesture.
  })
}
