export type Exercise = {
  id: string
  name: string
  equipment: string | null
  primaryMuscles: string[]
  category: string
  image: string | null
  gifUrl: string | null
  attribution: string | null
}

export type WorkoutExercise = {
  instanceId: string
  exercise: Exercise
  series: number
  reps: number
  repsLabel?: string
  notes?: string
  workSeconds: number
  restSeconds: number
  /** Seconds to get ready before this exercise starts (machine change, setup). */
  transitionSeconds?: number
}

export type WarmUpKind = 'upper' | 'legs'

export type WorkoutSettings = {
  workSeconds: number
  restSeconds: number
  rounds: number
  includeUpperWarmUp: boolean
  includeLegWarmUp: boolean
  includeUpperCoolDown: boolean
  includeLegCoolDown: boolean
}

export type SavedWorkout = {
  name: string
  savedAt: string
  settings: WorkoutSettings
  exercises: WorkoutExercise[]
}

export type AppScreen =
  | 'builder'
  | 'progress'
  | 'sounds'
  | 'warmup'
  | 'timer'
  | 'cooldown'
  | 'complete'

export type TimerPhase = 'work' | 'rest' | 'transition'

export const UPPER_BODY_WARMUP_VIDEO_ID = 'k9MY1ijAvGo'
export const LEG_WARMUP_VIDEO_ID = 'QLkLKfL_7F0'
export const UPPER_BODY_COOLDOWN_VIDEO_ID = '0ZkuKwjyWtI'
export const LEG_COOLDOWN_VIDEO_ID = 'myN0dGpJabc'

export const PRESET_WORKOUTS = [
  { label: 'Push', path: '/workouts/push.json' },
  { label: 'Pull', path: '/workouts/pull.json' },
  { label: 'Legs', path: '/workouts/legs.json' },
] as const

export type VideoStep = {
  kind: WarmUpKind
  title: string
  videoId: string
}

export function getWarmUpQueue(settings: WorkoutSettings): VideoStep[] {
  const queue: VideoStep[] = []
  if (settings.includeUpperWarmUp) {
    queue.push({
      kind: 'upper',
      title: 'Upper body warm-up',
      videoId: UPPER_BODY_WARMUP_VIDEO_ID,
    })
  }
  if (settings.includeLegWarmUp) {
    queue.push({
      kind: 'legs',
      title: 'Leg warm-up',
      videoId: LEG_WARMUP_VIDEO_ID,
    })
  }
  return queue
}

export function getCoolDownQueue(settings: WorkoutSettings): VideoStep[] {
  const queue: VideoStep[] = []
  if (settings.includeUpperCoolDown) {
    queue.push({
      kind: 'upper',
      title: 'Upper body cool-down',
      videoId: UPPER_BODY_COOLDOWN_VIDEO_ID,
    })
  }
  if (settings.includeLegCoolDown) {
    queue.push({
      kind: 'legs',
      title: 'Lower body cool-down',
      videoId: LEG_COOLDOWN_VIDEO_ID,
    })
  }
  return queue
}
