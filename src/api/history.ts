import type { WorkoutExercise } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type HistorySession = {
  id: number
  created_at: string
  workout_name: string
  exercise_count: number
  rounds: number
  total_series: number
  elapsed_seconds: number
  exercises: Array<{
    name: string
    series: number
    reps: number
    reps_label?: string
    work_seconds: number
    rest_seconds: number
  }>
}

export type WeeklyKpis = {
  planned_sessions_per_week: number
  week_start: string
  this_week: {
    sessions: number
    total_seconds: number
    total_minutes: number
    total_series: number
    avg_session_seconds: number
    avg_session_minutes: number
    adherence_pct: number
    workout_mix: {
      push: number
      pull: number
      legs: number
      other: number
    }
    best_reps: Record<string, number>
    best_hang_seconds: number
  }
  last_week: WeeklyKpis['this_week']
  deltas: {
    sessions_pct: number | null
    minutes_pct: number | null
    series_pct: number | null
  }
  streak_weeks: number
  recent_sessions: HistorySession[]
}

export type SaveSessionPayload = {
  workout_name: string
  exercise_count: number
  rounds: number
  total_series: number
  elapsed_seconds: number
  exercises: WorkoutExercise[]
}

function mapExercises(exercises: WorkoutExercise[]) {
  return exercises.map((item) => ({
    name: item.exercise.name,
    series: item.series,
    reps: item.reps,
    reps_label: item.repsLabel,
    work_seconds: item.workSeconds,
    rest_seconds: item.restSeconds,
  }))
}

export async function saveWorkoutSession(
  payload: SaveSessionPayload,
): Promise<HistorySession> {
  const response = await fetch(`${API_URL}/api/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workout_name: payload.workout_name,
      exercise_count: payload.exercise_count,
      rounds: payload.rounds,
      total_series: payload.total_series,
      elapsed_seconds: payload.elapsed_seconds,
      exercises: mapExercises(payload.exercises),
    }),
  })
  if (!response.ok) {
    throw new Error('Could not save workout history')
  }
  return response.json()
}

export async function fetchWeeklyKpis(): Promise<WeeklyKpis> {
  const response = await fetch(`${API_URL}/api/kpis/weekly`)
  if (!response.ok) {
    throw new Error('Could not load weekly KPIs')
  }
  return response.json()
}
