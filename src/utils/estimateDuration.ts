import type { WorkoutExercise, WorkoutSettings } from '../types'

const VIDEO_SECONDS = 5 * 60

function countVideoSteps(settings: WorkoutSettings): number {
  return (
    (settings.includeUpperWarmUp ? 1 : 0) +
    (settings.includeLegWarmUp ? 1 : 0) +
    (settings.includeUpperCoolDown ? 1 : 0) +
    (settings.includeLegCoolDown ? 1 : 0)
  )
}

export function estimateWorkoutSeconds(
  workout: WorkoutExercise[],
  settings: WorkoutSettings,
): number {
  if (workout.length === 0) return 0

  let total = 0
  for (let round = 1; round <= settings.rounds; round += 1) {
    workout.forEach((item, index) => {
      const series = Math.max(1, item.series || 1)
      const work = item.workSeconds || settings.workSeconds
      const rest = item.restSeconds ?? settings.restSeconds
      total += series * work

      const isLastExercise = index === workout.length - 1
      const isLastRound = round === settings.rounds
      const rests = isLastExercise && isLastRound ? series - 1 : series
      total += Math.max(0, rests) * rest
    })
  }

  return total + countVideoSteps(settings) * VIDEO_SECONDS
}
