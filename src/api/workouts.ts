import {
  isValidSavedWorkout,
  normalizeWorkout,
} from '../data/savedWorkouts'
import type { SavedWorkout, WorkoutExercise, WorkoutSettings } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type DbSavedWorkout = {
  id: number
  name: string
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

export async function fetchSavedWorkouts(): Promise<DbSavedWorkout[]> {
  const response = await fetch(`${API_URL}/api/workouts`)
  if (!response.ok) {
    throw new Error('Could not load saved workouts from the API.')
  }
  return response.json()
}

export async function fetchSavedWorkout(id: number): Promise<SavedWorkout> {
  const response = await fetch(`${API_URL}/api/workouts/${id}`)
  if (!response.ok) {
    throw new Error('Could not load that workout.')
  }
  const row: DbSavedWorkout = await response.json()
  return toSavedWorkout(row)
}

export async function saveWorkoutToDb(
  workout: SavedWorkout,
): Promise<DbSavedWorkout> {
  const response = await fetch(`${API_URL}/api/workouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: workout.name,
      settings: workout.settings,
      exercises: workout.exercises,
    }),
  })
  if (!response.ok) {
    throw new Error('Could not save workout to the database.')
  }
  return response.json()
}
