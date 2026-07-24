import { playWorkoutCue, type WorkoutCueKind } from './workoutAudio'

export type BeepKind = WorkoutCueKind

/** Thin wrapper — cues play on the shared workout audio element. */
export function playBeep(kind: BeepKind = 'tick') {
  void playWorkoutCue(kind)
}
