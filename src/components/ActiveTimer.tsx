import { useEffect, useRef, useState } from 'react'
import { getExerciseMediaUrl } from '../api/exercises'
import { useWakeLock } from '../hooks/useWakeLock'
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
  onWorkoutChange: (workout: WorkoutExercise[]) => void
  onExit: () => void
  onComplete: (feedback: SessionFeedback) => void
}

function phaseLabel(phase: 'work' | 'rest' | 'transition'): string {
  if (phase === 'work') return 'Work'
  if (phase === 'rest') return 'Rest'
  return 'Transition'
}

export function ActiveTimer({
  workout,
  settings,
  elapsedSeconds,
  encouragementSeed,
  onWorkoutChange,
  onExit,
  onComplete,
}: Props) {
  const [routineOpen, setRoutineOpen] = useState(false)
  const resumeAfterRoutineRef = useRef(false)
  const {
    phase,
    round,
    series,
    seriesTotal,
    secondsLeft,
    running,
    current,
    exerciseIndex,
    progress,
    toggleRunning,
    pauseCountdown,
    resumeCountdown,
    skipRest,
    skipTransition,
    skipSeries,
    skipExercise,
    jumpToExercise,
  } = useWorkoutTimer({ exercises: workout, settings, onComplete })

  useWakeLock(true)

  const toggleRunningRef = useRef(toggleRunning)
  toggleRunningRef.current = toggleRunning

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' && event.key !== ' ') return
      if (event.repeat) return
      if (routineOpen) return

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
  }, [routineOpen])

  function openRoutine() {
    resumeAfterRoutineRef.current = running
    pauseCountdown()
    setRoutineOpen(true)
  }

  function closeRoutine() {
    setRoutineOpen(false)
    if (resumeAfterRoutineRef.current) resumeCountdown()
    resumeAfterRoutineRef.current = false
  }

  function moveExercise(instanceId: string, direction: -1 | 1) {
    const index = workout.findIndex((item) => item.instanceId === instanceId)
    if (index < 0) return
    const target = index + direction
    if (target < 0 || target >= workout.length) return
    const next = [...workout]
    ;[next[index], next[target]] = [next[target], next[index]]
    onWorkoutChange(next)
  }

  function goToExercise(instanceId: string) {
    jumpToExercise(instanceId)
    setRoutineOpen(false)
    if (resumeAfterRoutineRef.current) resumeCountdown()
    resumeAfterRoutineRef.current = false
  }

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
    phase === 'transition'
      ? current.exercise.name
      : series < seriesTotal
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
        <button type="button" className="ghost" onClick={openRoutine}>
          Routine
        </button>
      </div>

      <Encouragement seed={`${encouragementSeed}-${current.instanceId}`} />

      <p className="phase-label">{phaseLabel(phase)}</p>
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
          width={360}
          height={360}
        />
      )}

      <h2>{current.exercise.name}</h2>
      {current.notes && <p className="notes">{current.notes}</p>}

      {phase === 'transition' && (
        <p className="muted rest-cue">
          Get ready — move to the equipment for this exercise.
        </p>
      )}
      {nextLabel && phase === 'work' && (
        <p className="next">Up next: {nextLabel}</p>
      )}
      {phase === 'rest' && nextLabel && (
        <p className="next">Coming up: {nextLabel}</p>
      )}
      {phase === 'transition' && nextLabel && (
        <p className="next">Starting: {nextLabel}</p>
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
          <button
            type="button"
            className="ghost"
            disabled={phase !== 'transition'}
            onClick={skipTransition}
          >
            Skip transition
          </button>
          <button
            type="button"
            className="ghost"
            disabled={phase === 'transition'}
            onClick={skipSeries}
          >
            Skip series
          </button>
          <button type="button" className="ghost" onClick={skipExercise}>
            Skip exercise
          </button>
        </div>
      </div>

      {routineOpen && (
        <div className="routine-overlay" role="dialog" aria-modal="true">
          <div className="routine-panel">
            <div className="routine-panel-top">
              <h2>Routine</h2>
              <button type="button" className="ghost" onClick={closeRoutine}>
                Close
              </button>
            </div>
            <p className="muted routine-hint">
              Countdown paused. Total time keeps running. Reorder or jump to any
              exercise.
            </p>
            <ul className="routine-list">
              {workout.map((item, index) => {
                const isCurrent = index === exerciseIndex
                const transition = Math.max(0, item.transitionSeconds ?? 0)
                return (
                  <li
                    key={item.instanceId}
                    className={isCurrent ? 'is-current' : undefined}
                  >
                    <div className="routine-item-info">
                      <strong>
                        {index + 1}. {item.exercise.name}
                      </strong>
                      <span className="muted">
                        {item.series}×
                        {item.repsLabel ??
                          (item.reps === 0 ? 'AMRAP' : item.reps)}
                        {transition > 0 ? ` · transition ${transition}s` : ''}
                        {isCurrent ? ' · now' : ''}
                      </span>
                    </div>
                    <div className="routine-item-actions">
                      <button
                        type="button"
                        className="ghost"
                        disabled={index === 0}
                        onClick={() => moveExercise(item.instanceId, -1)}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={index === workout.length - 1}
                        onClick={() => moveExercise(item.instanceId, 1)}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={isCurrent}
                        onClick={() => goToExercise(item.instanceId)}
                      >
                        Go
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
