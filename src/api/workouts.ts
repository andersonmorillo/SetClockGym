import {
  isValidSavedWorkout,
  normalizeWorkout,
} from '../data/savedWorkouts'
import type { SavedWorkout, WorkoutExercise, WorkoutSettings } from '../types'
import { apiFetch } from './config'

export type DbSavedWorkout = {
  id: number
  name: string
  slug: string
  settings: WorkoutSettings
  exercises: WorkoutExercise[]
  updated_at: string
}

function toSavedWorkout(row: DbSavedWorkout): SavedWorkout {
  const candidate = {
    name: row.name,
    savedAt: row.updated_at,
    settings: row.settings,
    exercises: row.exercises,
  }
  if (!isValidSavedWorkout(candidate)) {
    throw new Error('Saved workout data is invalid.')
  }
  return normalizeWorkout(candidate)
}

function workoutBody(workout: SavedWorkout) {
  return {
    name: workout.name,
    settings: workout.settings,
    exercises: workout.exercises,
  }
}

export async function fetchSavedWorkouts(): Promise<DbSavedWorkout[]> {
  const response = await apiFetch('/api/workouts')
  if (!response.ok) {
    throw new Error('Could not load saved workouts from the API.')
  }
  return response.json()
}

export async function fetchSavedWorkout(id: number): Promise<SavedWorkout> {
  const response = await apiFetch(`/api/workouts/${id}`)
  if (!response.ok) {
    throw new Error('Could not load that workout.')
  }
  const row: DbSavedWorkout = await response.json()
  return toSavedWorkout(row)
}

export async function saveWorkoutToDb(
  workout: SavedWorkout,
): Promise<DbSavedWorkout> {
  const response = await apiFetch('/api/workouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workoutBody(workout)),
  })
  if (response.status === 409) {
    throw new Error('A workout with that name already exists.')
  }
  if (!response.ok) {
    throw new Error('Could not save workout to the database.')
  }
  return response.json()
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await response.json()
    if (
      data &&
      typeof data === 'object' &&
      'detail' in data &&
      typeof (data as { detail: unknown }).detail === 'string'
    ) {
      return (data as { detail: string }).detail
    }
  } catch {
    // ignore parse errors
  }
  return `${fallback} (HTTP ${response.status})`
}

export async function updateWorkoutInDb(
  id: number,
  workout: SavedWorkout,
): Promise<DbSavedWorkout> {
  const response = await apiFetch(`/api/workouts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workoutBody(workout)),
  })
  if (response.status === 409) {
    throw new Error('Another workout already uses that name.')
  }
  if (response.status === 405) {
    throw new Error(
      'Update is not available on this API process. Restart the Gym Timer API window and try again.',
    )
  }
  if (!response.ok) {
    throw new Error(await readApiError(response, 'Could not update that workout.'))
  }
  return response.json()
}

export async function deleteWorkoutFromDb(id: number): Promise<void> {
  const response = await apiFetch(`/api/workouts/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Could not delete that workout.')
  }
}
