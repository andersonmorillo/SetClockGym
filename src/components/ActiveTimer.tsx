import { useEffect, useRef } from 'react'
import { getExerciseMediaUrl } from '../api/exercises'
import { useWorkoutTimer } from '../hooks/useWorkoutTimer'
import type { WorkoutExercise, WorkoutSettings } from '../types'
import type { SessionFeedback } from '../utils/sessionFeedback'
import { formatTime } from '../utils/formatTime'
import { Encouragement } from './Encouragement'

type Props = {
  workout: WorkoutExercise[]
  settings: WorkoutSettings
  elapsedSeconds: number
  encouragementSeed: string
  onExit: () => void
  onComplete: (feedback: SessionFeedback) => void
}

export function ActiveTimer({
  workout,
  settings,
  elapsedSeconds,
  encouragementSeed,
  onExit,
  onComplete,
}: Props) {
  const {
    phase,
    round,
    series,
    seriesTotal,
    secondsLeft,
    running,
    current,
    progress,
    toggleRunning,
    skipRest,
    skipSeries,
    skipExercise,
  } = useWorkoutTimer({ exercises: workout, settings, onComplete })

  const toggleRunningRef = useRef(toggleRunning)
  toggleRunningRef.current = toggleRunning

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' && event.key !== ' ') return
      if (event.repeat) return

      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return
        }
      }

      event.preventDefault()
      toggleRunningRef.current()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!current) return null

  const image = getExerciseMediaUrl(current.exercise, true)
  const nextIndex =
    workout.findIndex((item) => item.instanceId === current.instanceId) + 1
  const nextExercise =
    nextIndex < workout.length
      ? workout[nextIndex]
      : round < settings.rounds
        ? workout[0]
        : null
  const nextLabel =
    series < seriesTotal
      ? `Series ${series + 1}/${seriesTotal}`
      : nextExercise
        ? nextExercise.exercise.name
        : null

  const repsText =
    current.repsLabel ??
    (current.reps === 0 ? 'AMRAP' : String(current.reps))

  return (
    <div className={`timer-screen screen-enter ${phase}`}>
      <div className="timer-top">
        <button type="button" className="ghost" onClick={onExit}>
          Exit
        </button>
        <span className="elapsed">Total {formatTime(elapsedSeconds)}</span>
      </div>

      <Encouragement seed={`${encouragementSeed}-${current.instanceId}`} />

      <p className="phase-label">{phase === 'work' ? 'Work' : 'Rest'}</p>
      <p
        className={`countdown${secondsLeft <= 3 ? ' is-urgent' : ''}`}
      >
        {formatTime(secondsLeft)}
      </p>

      <div className="timer-meta">
        <span>
          Round {round}/{settings.rounds}
        </span>
        <span>
          Series {series}/{seriesTotal}
        </span>
        <span>Reps {repsText}</span>
      </div>

      {image && (
        <img
          className="timer-image"
          src={image}
          alt={current.exercise.name}
          width={220}
          height={220}
        />
      )}

      <h2>{current.exercise.name}</h2>
      {current.notes && <p className="notes">{current.notes}</p>}

      {nextLabel && phase === 'work' && (
        <p className="next">Up next: {nextLabel}</p>
      )}
      {phase === 'rest' && nextLabel && (
        <p className="next">Coming up: {nextLabel}</p>
      )}
      {phase === 'rest' && (
        <p className="muted rest-cue">
          Full rest supports next-set performance.
        </p>
      )}

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="control-stack">
        <button type="button" className="primary" onClick={toggleRunning}>
          {running ? 'Pause' : 'Resume'}
        </button>
        <div className="skip-actions">
          <button
            type="button"
            className="ghost"
            disabled={phase !== 'rest'}
            onClick={skipRest}
          >
            Skip rest
          </button>
          <button type="button" className="ghost" onClick={skipSeries}>
            Skip series
          </button>
          <button type="button" className="ghost" onClick={skipExercise}>
            Skip exercise
          </button>
        </div>
      </div>
    </div>
  )
}
