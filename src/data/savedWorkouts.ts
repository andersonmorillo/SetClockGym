import type { SavedWorkout, WorkoutExercise, WorkoutSettings } from '../types'

const STORAGE_KEY = 'gym-timer-last-workout'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidSettings(value: unknown): value is WorkoutSettings {
  if (!isObject(value)) return false
  return (
    typeof value.workSeconds === 'number' &&
    typeof value.restSeconds === 'number' &&
    typeof value.rounds === 'number' &&
    typeof value.includeUpperWarmUp === 'boolean' &&
    typeof value.includeLegWarmUp === 'boolean'
  )
}

function isValidExercise(value: unknown): value is WorkoutExercise {
  if (!isObject(value) || !isObject(value.exercise)) return false
  return (
    typeof value.instanceId === 'string' &&
    typeof value.reps === 'number' &&
    typeof value.workSeconds === 'number' &&
    typeof value.restSeconds === 'number' &&
    typeof value.exercise.id === 'string' &&
    typeof value.exercise.name === 'string' &&
    (value.series === undefined || typeof value.series === 'number')
  )
}

export function isValidSavedWorkout(value: unknown): value is SavedWorkout {
  if (!isObject(value)) return false
  if (typeof value.name !== 'string') return false
  if (!isValidSettings(value.settings)) return false
  if (!Array.isArray(value.exercises)) return false
  return value.exercises.every(isValidExercise)
}

function normalizeSettings(settings: WorkoutSettings): WorkoutSettings {
  return {
    workSeconds: settings.workSeconds,
    restSeconds: settings.restSeconds,
    rounds: settings.rounds,
    includeUpperWarmUp: settings.includeUpperWarmUp,
    includeLegWarmUp: settings.includeLegWarmUp,
    includeUpperCoolDown: settings.includeUpperCoolDown ?? false,
    includeLegCoolDown: settings.includeLegCoolDown ?? false,
  }
}

export function normalizeWorkout(workout: SavedWorkout): SavedWorkout {
  return {
    ...workout,
    settings: normalizeSettings(workout.settings),
    exercises: workout.exercises.map((item) => ({
      ...item,
      series: Math.max(1, item.series ?? 1),
      reps: Math.max(0, item.reps ?? 0),
      repsLabel: item.repsLabel,
      notes: item.notes,
      transitionSeconds: Math.max(0, item.transitionSeconds ?? 0),
      exercise: {
        id: item.exercise.id,
        name: item.exercise.name,
        equipment: item.exercise.equipment ?? null,
        primaryMuscles: item.exercise.primaryMuscles ?? [],
        category: item.exercise.category ?? '',
        image: item.exercise.image ?? null,
        gifUrl: item.exercise.gifUrl ?? null,
        attribution: item.exercise.attribution ?? null,
      },
    })),
  }
}

export function createSavedWorkout(
  name: string,
  settings: WorkoutSettings,
  exercises: WorkoutExercise[],
): SavedWorkout {
  return {
    name: name.trim() || 'My workout',
    savedAt: new Date().toISOString(),
    settings: normalizeSettings(settings),
    exercises,
  }
}

export function saveWorkoutToLocalStorage(workout: SavedWorkout): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workout))
}

export function loadWorkoutFromLocalStorage(): SavedWorkout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isValidSavedWorkout(parsed) ? normalizeWorkout(parsed) : null
  } catch {
    return null
  }
}

export function downloadWorkoutJson(workout: SavedWorkout): void {
  const blob = new Blob([JSON.stringify(workout, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const safeName = workout.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  link.href = url
  link.download = `${safeName || 'workout'}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export async function readWorkoutFromFile(file: File): Promise<SavedWorkout> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  if (!isValidSavedWorkout(parsed)) {
    throw new Error(
      'Invalid workout file. It needs name, settings, and exercises.',
    )
  }
  return normalizeWorkout(parsed)
}

export async function loadWorkoutFromUrl(path: string): Promise<SavedWorkout> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Could not load preset (${response.status}).`)
  }
  const parsed: unknown = await response.json()
  if (!isValidSavedWorkout(parsed)) {
    throw new Error('Preset workout file is invalid.')
  }
  return normalizeWorkout(parsed)
}
