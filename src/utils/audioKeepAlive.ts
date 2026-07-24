/**
 * @deprecated Use workoutAudio.ts. Re-exports kept for compatibility.
 */
export {
  unlockWorkoutAudio as startKeepAlive,
  resumeWorkoutAudio as resumeKeepAlive,
  setWorkoutAudioPlaying as setKeepAlivePlaying,
  stopWorkoutAudio as stopKeepAlive,
  isWorkoutAudioUnlocked as isKeepAliveStarted,
  startWorkoutAudio,
  unlockWorkoutAudio,
} from './workoutAudio'
