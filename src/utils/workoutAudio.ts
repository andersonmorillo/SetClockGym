/**
 * Single HTMLAudioElement session for mobile Brave/iOS:
 * - Near-silent keep-alive loop keeps the media session alive
 * - Cues swap src on the same element (MediaTick pattern) so autoplay trust is preserved
 */

export type WorkoutCueKind =
  | 'tick'
  | 'tickUrgent'
  | 'ending3'
  | 'ending2'
  | 'ending1'
  | 'phase'
  | 'seriesStart'
  | 'seriesEnd'
  | 'exerciseStart'
  | 'exerciseEnd'

type MediaHandlers = {
  onPlay?: () => void
  onPause?: () => void
}

const KEEP_ALIVE_SRC = '/audio/keep-alive.wav'
const KEEP_ALIVE_VOLUME = 0.01
const CUE_VOLUME = 1
/** Shown on lock-screen scrubber (seconds) — long ongoing workout, not 0:08. */
const MEDIA_DURATION_SECONDS = 60 * 60

const CUE_SRC: Record<WorkoutCueKind, string> = {
  tick: '/audio/beep-tick.wav',
  tickUrgent: '/audio/beep-urgent.wav',
  ending3: '/audio/beep-ending-3.wav',
  ending2: '/audio/beep-ending-2.wav',
  ending1: '/audio/beep-ending-1.wav',
  phase: '/audio/beep-start.wav',
  seriesStart: '/audio/beep-start.wav',
  exerciseStart: '/audio/beep-start.wav',
  seriesEnd: '/audio/beep-end.wav',
  exerciseEnd: '/audio/beep-end.wav',
}

const LONG_CUE: Partial<Record<WorkoutCueKind, number>> = {
  ending3: 900,
  ending2: 900,
  ending1: 1100,
  tickUrgent: 900,
  exerciseEnd: 1000,
}

let audio: HTMLAudioElement | null = null
let unlocked = false
let playingSession = false
let cueActive = false
let handlers: MediaHandlers = {}
let restoreTimer: number | null = null
let mediaPositionTimer: number | null = null
let mediaElapsed = 0

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = document.createElement('audio')
    audio.setAttribute('playsinline', 'true')
    audio.setAttribute('webkit-playsinline', 'true')
    audio.preload = 'auto'
    audio.src = KEEP_ALIVE_SRC
    audio.loop = true
    audio.volume = KEEP_ALIVE_VOLUME
    document.body.appendChild(audio)
    audio.addEventListener('ended', onAudioEnded)
  }
  return audio
}

function onAudioEnded() {
  if (cueActive) {
    void restoreKeepAlive()
  }
}

function clearRestoreTimer() {
  if (restoreTimer != null) {
    window.clearTimeout(restoreTimer)
    restoreTimer = null
  }
}

function updateMediaSession(playing: boolean) {
  if (!('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Gym Timer',
      artist: 'Workout in progress',
      album: 'Gym Timer',
    })
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
    navigator.mediaSession.setActionHandler('play', () => {
      void resumeWorkoutAudio()
      handlers.onPlay?.()
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      // Keep silent loop running; only pause the workout countdown.
      handlers.onPause?.()
      navigator.mediaSession.playbackState = 'paused'
      stopMediaPositionTicker()
    })
    if (playing) {
      startMediaPositionTicker()
    } else {
      stopMediaPositionTicker()
    }
  } catch {
    // Media Session not fully supported.
  }
}

function applyPositionState() {
  if (!('mediaSession' in navigator)) return
  if (typeof navigator.mediaSession.setPositionState !== 'function') return
  try {
    navigator.mediaSession.setPositionState({
      duration: MEDIA_DURATION_SECONDS,
      playbackRate: 1,
      position: Math.min(mediaElapsed, MEDIA_DURATION_SECONDS - 1),
    })
  } catch {
    // Some browsers reject position state while src is changing.
  }
}

function startMediaPositionTicker() {
  if (mediaPositionTimer != null) return
  applyPositionState()
  mediaPositionTimer = window.setInterval(() => {
    mediaElapsed += 1
    applyPositionState()
  }, 1000)
}

function stopMediaPositionTicker() {
  if (mediaPositionTimer != null) {
    window.clearInterval(mediaPositionTimer)
    mediaPositionTimer = null
  }
}

async function restoreKeepAlive() {
  clearRestoreTimer()
  cueActive = false
  const el = ensureAudio()
  el.loop = true
  el.volume = KEEP_ALIVE_VOLUME
  if (!el.src.includes('keep-alive.wav')) {
    el.src = KEEP_ALIVE_SRC
  }
  try {
    if (playingSession || unlocked) {
      await el.play()
    }
  } catch {
    // Will retry on next Resume gesture.
  }
}

function preloadCues() {
  for (const src of Object.values(CUE_SRC)) {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'audio'
    link.href = src
    document.head.appendChild(link)
  }
}

/** Call from a direct user tap (Start workout). */
export async function unlockWorkoutAudio(): Promise<void> {
  const el = ensureAudio()
  handlers = {}
  try {
    el.loop = true
    el.volume = KEEP_ALIVE_VOLUME
    el.src = KEEP_ALIVE_SRC
    await el.play()
    unlocked = true
    playingSession = true
    mediaElapsed = 0
    preloadCues()
    updateMediaSession(true)
  } catch {
    unlocked = false
    playingSession = false
  }
}

/** Call from Resume / after unlock with Media Session handlers. */
export async function startWorkoutAudio(
  nextHandlers: MediaHandlers = {},
): Promise<void> {
  handlers = nextHandlers
  const el = ensureAudio()
  // Already unlocked on Start — just bind handlers; do not require a new gesture.
  if (unlocked && !el.paused) {
    playingSession = true
    updateMediaSession(true)
    return
  }
  try {
    if (!el.src.includes('keep-alive.wav') && !cueActive) {
      el.src = KEEP_ALIVE_SRC
    }
    el.loop = !cueActive
    el.volume = cueActive ? CUE_VOLUME : KEEP_ALIVE_VOLUME
    await el.play()
    unlocked = true
    playingSession = true
    updateMediaSession(true)
  } catch {
    // Need another user gesture (e.g. Resume after restore).
  }
}

export async function resumeWorkoutAudio(): Promise<void> {
  if (!unlocked && !playingSession) return
  const el = ensureAudio()
  try {
    if (el.paused) await el.play()
    playingSession = true
    updateMediaSession(true)
  } catch {
    // ignore
  }
}

export function setWorkoutAudioPlaying(playing: boolean) {
  if (!unlocked && !playingSession) return
  if (playing) {
    updateMediaSession(true)
  } else if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'paused'
    } catch {
      // ignore
    }
    stopMediaPositionTicker()
  }
}

export async function playWorkoutCue(kind: WorkoutCueKind): Promise<void> {
  if (!unlocked && !playingSession) {
    return
  }
  const el = ensureAudio()
  const src = CUE_SRC[kind]
  clearRestoreTimer()
  cueActive = true
  el.loop = false
  el.volume = CUE_VOLUME
  el.src = src
  try {
    el.currentTime = 0
    await el.play()
    // Safety restore if ended event is skipped on some mobile browsers.
    const restoreMs = LONG_CUE[kind] ?? 800
    restoreTimer = window.setTimeout(() => {
      void restoreKeepAlive()
    }, restoreMs)
  } catch {
    cueActive = false
    void restoreKeepAlive()
  }
}

export function stopWorkoutAudio() {
  clearRestoreTimer()
  stopMediaPositionTicker()
  cueActive = false
  playingSession = false
  unlocked = false
  handlers = {}
  mediaElapsed = 0
  if (audio) {
    audio.pause()
    try {
      audio.currentTime = 0
      audio.src = KEEP_ALIVE_SRC
      audio.loop = true
      audio.volume = KEEP_ALIVE_VOLUME
    } catch {
      // ignore
    }
  }
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = 'none'
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
    } catch {
      // ignore
    }
  }
}

export function isWorkoutAudioUnlocked() {
  return unlocked
}
