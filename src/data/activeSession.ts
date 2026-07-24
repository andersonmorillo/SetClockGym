import type { TimerPhase, WorkoutExercise, WorkoutSettings } from '../types'
import type { ExerciseDraft, ExerciseFeedback } from '../utils/sessionFeedback'
import {
  isValidSavedWorkout,
  normalizeWorkout,
} from './savedWorkouts'

const STORAGE_KEY = 'gym-timer-active-session'
const MAX_AGE_MS = 12 * 60 * 60 * 1000
export const ACTIVE_SESSION_VERSION = 1

export type ActiveSessionScreen = 'warmup' | 'timer' | 'cooldown'

export type ActiveTimerSnapshot = {
  phase: TimerPhase
  exerciseIndex: number
  series: number
  round: number
  secondsLeft: number
  savedFeedback: ExerciseFeedback[]
  currentDraft: ExerciseDraft | null
}

export type ActiveSessionSnapshot = {
  version: number
  savedAt: string
  screen: ActiveSessionScreen
  workoutName: string
  settings: WorkoutSettings
  workout: WorkoutExercise[]
  warmUpIndex: number
  coolDownIndex: number
  elapsedSeconds: number
  timer: ActiveTimerSnapshot | null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidPhase(value: unknown): value is TimerPhase {
  return value === 'work' || value === 'rest' || value === 'transition'
}

function isValidDraft(value: unknown): value is ExerciseDraft {
  if (!isObject(value)) return false
  return (
    typeof value.instanceId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.plannedSeries === 'number' &&
    typeof value.completedSeries === 'number' &&
    typeof value.skippedSeries === 'number' &&
    typeof value.skippedExercise === 'boolean' &&
    typeof value.pauseCount === 'number' &&
    typeof value.pauseSeconds === 'number' &&
    typeof value.skipRestCount === 'number' &&
    typeof value.restOpportunityCount === 'number' &&
    (value.rpe === null || typeof value.rpe === 'number')
  )
}

function isValidExerciseFeedback(value: unknown): value is ExerciseFeedback {
  if (!isObject(value)) return false
  return (
    typeof value.name === 'string' &&
    typeof value.instanceId === 'string' &&
    typeof value.planned_series === 'number' &&
    typeof value.completed_series === 'number' &&
    typeof value.skipped_series === 'number' &&
    typeof value.skipped_exercise === 'boolean' &&
    typeof value.pause_count === 'number' &&
    typeof value.pause_seconds === 'number' &&
    typeof value.skip_rest_count === 'number' &&
    typeof value.rest_opportunity_count === 'number' &&
    (value.rpe === null || typeof value.rpe === 'number') &&
    typeof value.saved === 'boolean'
  )
}

function isValidTimerSnapshot(value: unknown): value is ActiveTimerSnapshot {
  if (!isObject(value)) return false
  if (!isValidPhase(value.phase)) return false
  if (typeof value.exerciseIndex !== 'number') return false
  if (typeof value.series !== 'number') return false
  if (typeof value.round !== 'number') return false
  if (typeof value.secondsLeft !== 'number') return false
  if (!Array.isArray(value.savedFeedback)) return false
  if (!value.savedFeedback.every(isValidExerciseFeedback)) return false
  if (value.currentDraft != null && !isValidDraft(value.currentDraft)) {
    return false
  }
  return true
}

export function isValidActiveSession(
  value: unknown,
): value is ActiveSessionSnapshot {
  if (!isObject(value)) return false
  if (value.version !== ACTIVE_SESSION_VERSION) return false
  if (typeof value.savedAt !== 'string') return false
  if (
    value.screen !== 'warmup' &&
    value.screen !== 'timer' &&
    value.screen !== 'cooldown'
  ) {
    return false
  }
  if (typeof value.workoutName !== 'string') return false
  if (typeof value.warmUpIndex !== 'number') return false
  if (typeof value.coolDownIndex !== 'number') return false
  if (typeof value.elapsedSeconds !== 'number') return false

  const candidate = {
    name: value.workoutName,
    savedAt: value.savedAt,
    settings: value.settings,
    exercises: value.workout,
  }
  if (!isValidSavedWorkout(candidate)) return false

  if (value.screen === 'timer') {
    if (!isValidTimerSnapshot(value.timer)) return false
    const maxIndex = candidate.exercises.length - 1
    if (value.timer.exerciseIndex < 0 || value.timer.exerciseIndex > maxIndex) {
      return false
    }
  } else if (value.timer != null && !isValidTimerSnapshot(value.timer)) {
    return false
  }

  return true
}

function normalizeSnapshot(
  snapshot: ActiveSessionSnapshot,
): ActiveSessionSnapshot {
  const normalized = normalizeWorkout({
    name: snapshot.workoutName,
    savedAt: snapshot.savedAt,
    settings: snapshot.settings,
    exercises: snapshot.workout,
  })
  const workout = normalized.exercises
  const maxIndex = Math.max(0, workout.length - 1)
  const timer =
    snapshot.timer == null
      ? null
      : {
          ...snapshot.timer,
          exerciseIndex: Math.min(
            Math.max(0, snapshot.timer.exerciseIndex),
            maxIndex,
          ),
          series: Math.max(1, snapshot.timer.series),
          round: Math.max(1, snapshot.timer.round),
          secondsLeft: Math.max(0, snapshot.timer.secondsLeft),
        }

  return {
    ...snapshot,
    workoutName: normalized.name,
    settings: normalized.settings,
    workout,
    warmUpIndex: Math.max(0, snapshot.warmUpIndex),
    coolDownIndex: Math.max(0, snapshot.coolDownIndex),
    elapsedSeconds: Math.max(0, snapshot.elapsedSeconds),
    timer,
  }
}

export function saveActiveSession(snapshot: ActiveSessionSnapshot): void {
  try {
    const payload: ActiveSessionSnapshot = {
      ...snapshot,
      version: ACTIVE_SESSION_VERSION,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore quota / private mode errors.
  }
}

export function loadActiveSession(): ActiveSessionSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isValidActiveSession(parsed)) return null
    const age = Date.now() - Date.parse(parsed.savedAt)
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) {
      clearActiveSession()
      return null
    }
    return normalizeSnapshot(parsed)
  } catch {
    return null
  }
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors.
  }
}
