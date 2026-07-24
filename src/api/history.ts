import type { WorkoutExercise } from '../types'
import type { SessionFeedback } from '../utils/sessionFeedback'
import { apiFetch } from './config'

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
  feedback?: SessionFeedback | null
}

export type PeriodStats = {
  sessions: number
  total_seconds: number
  total_minutes: number
  total_series: number
  avg_session_seconds: number
  avg_session_minutes: number
  adherence_pct: number
  series_completion_pct: number | null
  pause_count: number
  skip_series_count: number
  skip_exercise_count: number
  skip_rest_count: number
  rest_compliance_pct: number | null
  avg_session_rpe: number | null
  avg_training_load: number | null
  strengths: Array<{ name: string; count: number }>
  weaknesses: Array<{ name: string; count: number }>
  workout_mix: {
    push: number
    pull: number
    legs: number
    other: number
  }
  best_reps: Record<string, number>
  best_hang_seconds: number
}

export type KpiDeltas = {
  sessions_pct: number | null
  minutes_pct: number | null
  series_pct: number | null
}

export type WeeklyKpis = {
  planned_sessions_per_week: number
  week_start: string
  this_week: PeriodStats
  last_week: PeriodStats
  deltas: KpiDeltas
  streak_weeks: number
  recent_sessions: HistorySession[]
}

export type MonthlyKpis = {
  planned_sessions_per_month: number
  month_start: string
  this_month: PeriodStats
  last_month: PeriodStats
  deltas: KpiDeltas
  streak_months: number
  recent_sessions: HistorySession[]
}

export type SaveSessionPayload = {
  workout_name: string
  exercise_count: number
  rounds: number
  total_series: number
  elapsed_seconds: number
  exercises: WorkoutExercise[]
  feedback?: SessionFeedback | null
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
  const response = await apiFetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workout_name: payload.workout_name,
      exercise_count: payload.exercise_count,
      rounds: payload.rounds,
      total_series: payload.total_series,
      elapsed_seconds: payload.elapsed_seconds,
      exercises: mapExercises(payload.exercises),
      feedback: payload.feedback ?? null,
    }),
  })
  if (!response.ok) {
    throw new Error('Could not save workout history')
  }
  return response.json()
}

export async function fetchWeeklyKpis(): Promise<WeeklyKpis> {
  const response = await apiFetch('/api/kpis/weekly')
  if (!response.ok) {
    throw new Error('Could not load weekly KPIs')
  }
  return response.json()
}

export async function fetchMonthlyKpis(): Promise<MonthlyKpis> {
  const response = await apiFetch('/api/kpis/monthly')
  if (!response.ok) {
    throw new Error('Could not load monthly KPIs')
  }
  return response.json()
}

export async function deleteWorkoutSession(sessionId: number): Promise<void> {
  const response = await apiFetch(`/api/history/${sessionId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Could not delete workout session')
  }
}
