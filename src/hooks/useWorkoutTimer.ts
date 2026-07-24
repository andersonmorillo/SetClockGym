import { useEffect, useRef, useState } from 'react'
import type { TimerPhase, WorkoutExercise, WorkoutSettings } from '../types'
import { playBeep } from '../utils/beep'

type UseWorkoutTimerArgs = {
  exercises: WorkoutExercise[]
  settings: WorkoutSettings
  onComplete: () => void
}

type TimerState = {
  phase: TimerPhase
  exerciseIndex: number
  series: number
  round: number
  secondsLeft: number
}

function workSecondsFor(
  exercises: WorkoutExercise[],
  index: number,
  settings: WorkoutSettings,
): number {
  return exercises[index]?.workSeconds ?? settings.workSeconds
}

function restSecondsFor(
  exercises: WorkoutExercise[],
  index: number,
  settings: WorkoutSettings,
): number {
  return exercises[index]?.restSeconds ?? settings.restSeconds
}

function seriesFor(exercises: WorkoutExercise[], index: number): number {
  return Math.max(1, exercises[index]?.series ?? 1)
}

function advanceAfterRest(
  state: TimerState,
  exercises: WorkoutExercise[],
  settings: WorkoutSettings,
): TimerState | 'done' {
  const exercisesLength = exercises.length
  const totalSeries = seriesFor(exercises, state.exerciseIndex)
  const isLastSeries = state.series >= totalSeries
  const isLastExercise = state.exerciseIndex >= exercisesLength - 1
  const isLastRound = state.round >= settings.rounds

  if (!isLastSeries) {
    return {
      ...state,
      phase: 'work',
      series: state.series + 1,
      secondsLeft: workSecondsFor(exercises, state.exerciseIndex, settings),
    }
  }

  if (isLastExercise && isLastRound) {
    return 'done'
  }

  if (isLastExercise) {
    return {
      phase: 'work',
      exerciseIndex: 0,
      series: 1,
      round: state.round + 1,
      secondsLeft: workSecondsFor(exercises, 0, settings),
    }
  }

  const nextIndex = state.exerciseIndex + 1
  return {
    phase: 'work',
    exerciseIndex: nextIndex,
    series: 1,
    round: state.round,
    secondsLeft: workSecondsFor(exercises, nextIndex, settings),
  }
}

function advance(
  state: TimerState,
  exercises: WorkoutExercise[],
  settings: WorkoutSettings,
): TimerState | 'done' {
  const exercisesLength = exercises.length

  if (state.phase === 'work') {
    const totalSeries = seriesFor(exercises, state.exerciseIndex)
    const isLastSeries = state.series >= totalSeries
    const isLastExercise = state.exerciseIndex >= exercisesLength - 1
    const isLastRound = state.round >= settings.rounds

    if (isLastSeries && isLastExercise && isLastRound) {
      return 'done'
    }

    const restSeconds = restSecondsFor(
      exercises,
      state.exerciseIndex,
      settings,
    )

    if (restSeconds > 0) {
      return { ...state, phase: 'rest', secondsLeft: restSeconds }
    }

    return advanceAfterRest(state, exercises, settings)
  }

  return advanceAfterRest(state, exercises, settings)
}

function skipToNextSeries(
  state: TimerState,
  exercises: WorkoutExercise[],
  settings: WorkoutSettings,
): TimerState | 'done' {
  const totalSeries = seriesFor(exercises, state.exerciseIndex)
  const isLastSeries = state.series >= totalSeries
  const isLastExercise = state.exerciseIndex >= exercises.length - 1
  const isLastRound = state.round >= settings.rounds

  if (!isLastSeries) {
    return {
      phase: 'work',
      exerciseIndex: state.exerciseIndex,
      series: state.series + 1,
      round: state.round,
      secondsLeft: workSecondsFor(exercises, state.exerciseIndex, settings),
    }
  }

  if (isLastExercise && isLastRound) {
    return 'done'
  }

  if (isLastExercise) {
    return {
      phase: 'work',
      exerciseIndex: 0,
      series: 1,
      round: state.round + 1,
      secondsLeft: workSecondsFor(exercises, 0, settings),
    }
  }

  const nextIndex = state.exerciseIndex + 1
  return {
    phase: 'work',
    exerciseIndex: nextIndex,
    series: 1,
    round: state.round,
    secondsLeft: workSecondsFor(exercises, nextIndex, settings),
  }
}

function skipToNextExercise(
  state: TimerState,
  exercises: WorkoutExercise[],
  settings: WorkoutSettings,
): TimerState | 'done' {
  const isLastExercise = state.exerciseIndex >= exercises.length - 1
  const isLastRound = state.round >= settings.rounds

  if (isLastExercise && isLastRound) {
    return 'done'
  }

  if (isLastExercise) {
    return {
      phase: 'work',
      exerciseIndex: 0,
      series: 1,
      round: state.round + 1,
      secondsLeft: workSecondsFor(exercises, 0, settings),
    }
  }

  const nextIndex = state.exerciseIndex + 1
  return {
    phase: 'work',
    exerciseIndex: nextIndex,
    series: 1,
    round: state.round,
    secondsLeft: workSecondsFor(exercises, nextIndex, settings),
  }
}

export function useWorkoutTimer({
  exercises,
  settings,
  onComplete,
}: UseWorkoutTimerArgs) {
  const [state, setState] = useState<TimerState>({
    phase: 'work',
    exerciseIndex: 0,
    series: 1,
    round: 1,
    secondsLeft: workSecondsFor(exercises, 0, settings),
  })
  const [running, setRunning] = useState(true)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const lastTickBeepRef = useRef<number | null>(null)
  const prevSeriesCueRef = useRef<{
    primed: boolean
    phase: TimerPhase
    series: number
    exerciseIndex: number
    round: number
  }>({
    primed: false,
    phase: state.phase,
    series: state.series,
    exerciseIndex: state.exerciseIndex,
    round: state.round,
  })

  useEffect(() => {
    const prev = prevSeriesCueRef.current
    const { phase, series, exerciseIndex, round } = state

    if (!prev.primed) {
      playBeep('seriesStart')
      prevSeriesCueRef.current = {
        primed: true,
        phase,
        series,
        exerciseIndex,
        round,
      }
      return
    }

    const seriesIdentityChanged =
      series !== prev.series ||
      exerciseIndex !== prev.exerciseIndex ||
      round !== prev.round

    const leftWork =
      prev.phase === 'work' && (phase !== 'work' || seriesIdentityChanged)
    const enteredWork =
      phase === 'work' && (prev.phase !== 'work' || seriesIdentityChanged)

    if (leftWork) playBeep('seriesEnd')
    if (enteredWork) playBeep('seriesStart')

    if (leftWork || enteredWork || phase !== prev.phase) {
      lastTickBeepRef.current = null
    }

    prevSeriesCueRef.current = {
      primed: true,
      phase,
      series,
      exerciseIndex,
      round,
    }
  }, [state.phase, state.series, state.exerciseIndex, state.round])

  useEffect(() => {
    if (!running) return
    if (state.secondsLeft <= 3 && state.secondsLeft >= 1) {
      if (lastTickBeepRef.current !== state.secondsLeft) {
        playBeep('tick')
        lastTickBeepRef.current = state.secondsLeft
      }
    }
  }, [running, state.secondsLeft])

  useEffect(() => {
    if (!running) return

    const id = window.setInterval(() => {
      setState((prev) => {
        if (prev.secondsLeft > 1) {
          return { ...prev, secondsLeft: prev.secondsLeft - 1 }
        }

        const next = advance(prev, exercises, settings)
        if (next === 'done') {
          setRunning(false)
          playBeep('seriesEnd')
          onCompleteRef.current()
          return { ...prev, secondsLeft: 0 }
        }
        return next
      })
    }, 1000)

    return () => window.clearInterval(id)
  }, [running, exercises, settings])

  const current = exercises[state.exerciseIndex]
  const seriesPerRound = exercises.reduce(
    (sum, item) => sum + Math.max(1, item.series || 1),
    0,
  )
  const totalSteps = Math.max(1, seriesPerRound * settings.rounds)

  let completedInRound = 0
  for (let i = 0; i < state.exerciseIndex; i += 1) {
    completedInRound += seriesFor(exercises, i)
  }
  completedInRound += state.series - 1
  if (state.phase === 'rest') completedInRound += 1

  const completedSteps =
    (state.round - 1) * seriesPerRound + completedInRound

  return {
    phase: state.phase,
    round: state.round,
    series: state.series,
    seriesTotal: seriesFor(exercises, state.exerciseIndex),
    secondsLeft: state.secondsLeft,
    running,
    current,
    progress: Math.min(completedSteps / totalSteps, 1),
    toggleRunning: () => setRunning((value) => !value),
    skipRest: () => {
      setState((prev) => {
        if (prev.phase !== 'rest') return prev
        const next = advanceAfterRest(prev, exercises, settings)
        if (next === 'done') {
          setRunning(false)
          playBeep('seriesEnd')
          onCompleteRef.current()
          return { ...prev, secondsLeft: 0 }
        }
        return next
      })
    },
    skipSeries: () => {
      setState((prev) => {
        const next = skipToNextSeries(prev, exercises, settings)
        if (next === 'done') {
          setRunning(false)
          playBeep('seriesEnd')
          onCompleteRef.current()
          return { ...prev, secondsLeft: 0 }
        }
        return next
      })
    },
    skipExercise: () => {
      setState((prev) => {
        const next = skipToNextExercise(prev, exercises, settings)
        if (next === 'done') {
          setRunning(false)
          playBeep('seriesEnd')
          onCompleteRef.current()
          return { ...prev, secondsLeft: 0 }
        }
        return next
      })
    },
  }
}
