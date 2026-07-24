import { useEffect, useRef, useState } from 'react'
import type { ActiveTimerSnapshot } from '../data/activeSession'
import type { TimerPhase, WorkoutExercise, WorkoutSettings } from '../types'
import { playBeep } from '../utils/beep'
import {
  buildSessionFeedback,
  createEmptyDraft,
  draftFromFeedback,
  finalizeExerciseFeedback,
  mergeDrafts,
  type ExerciseDraft,
  type ExerciseFeedback,
  type SessionFeedback,
} from '../utils/sessionFeedback'

type UseWorkoutTimerArgs = {
  exercises: WorkoutExercise[]
  settings: WorkoutSettings
  onComplete: (feedback: SessionFeedback) => void
  /** When set, resume from this snapshot and start paused. */
  restore?: ActiveTimerSnapshot | null
  onSnapshot?: (snapshot: ActiveTimerSnapshot) => void
}

type TimerState = {
  phase: TimerPhase
  exerciseIndex: number
  series: number
  round: number
  secondsLeft: number
}

function clampTimerState(
  state: TimerState,
  exercises: WorkoutExercise[],
): TimerState {
  const maxIndex = Math.max(0, exercises.length - 1)
  return {
    phase: state.phase,
    exerciseIndex: Math.min(Math.max(0, state.exerciseIndex), maxIndex),
    series: Math.max(1, state.series),
    round: Math.max(1, state.round),
    secondsLeft: Math.max(0, state.secondsLeft),
  }
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

function transitionSecondsFor(
  exercises: WorkoutExercise[],
  index: number,
): number {
  return Math.max(0, exercises[index]?.transitionSeconds ?? 0)
}

function seriesFor(exercises: WorkoutExercise[], index: number): number {
  return Math.max(1, exercises[index]?.series ?? 1)
}

function startExerciseState(
  exercises: WorkoutExercise[],
  settings: WorkoutSettings,
  exerciseIndex: number,
  series: number,
  round: number,
  includeTransition: boolean,
): TimerState {
  const transition = includeTransition
    ? transitionSecondsFor(exercises, exerciseIndex)
    : 0
  if (transition > 0) {
    return {
      phase: 'transition',
      exerciseIndex,
      series,
      round,
      secondsLeft: transition,
    }
  }
  return {
    phase: 'work',
    exerciseIndex,
    series,
    round,
    secondsLeft: workSecondsFor(exercises, exerciseIndex, settings),
  }
}

function initialTimerState(
  exercises: WorkoutExercise[],
  settings: WorkoutSettings,
): TimerState {
  return startExerciseState(exercises, settings, 0, 1, 1, true)
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
    return startExerciseState(
      exercises,
      settings,
      0,
      1,
      state.round + 1,
      true,
    )
  }

  return startExerciseState(
    exercises,
    settings,
    state.exerciseIndex + 1,
    1,
    state.round,
    true,
  )
}

function advanceAfterTransition(
  state: TimerState,
  exercises: WorkoutExercise[],
  settings: WorkoutSettings,
): TimerState {
  return {
    ...state,
    phase: 'work',
    secondsLeft: workSecondsFor(exercises, state.exerciseIndex, settings),
  }
}

function advance(
  state: TimerState,
  exercises: WorkoutExercise[],
  settings: WorkoutSettings,
): TimerState | 'done' {
  const exercisesLength = exercises.length

  if (state.phase === 'transition') {
    return advanceAfterTransition(state, exercises, settings)
  }

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
    return startExerciseState(
      exercises,
      settings,
      0,
      1,
      state.round + 1,
      true,
    )
  }

  return startExerciseState(
    exercises,
    settings,
    state.exerciseIndex + 1,
    1,
    state.round,
    true,
  )
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
    return startExerciseState(
      exercises,
      settings,
      0,
      1,
      state.round + 1,
      true,
    )
  }

  return startExerciseState(
    exercises,
    settings,
    state.exerciseIndex + 1,
    1,
    state.round,
    true,
  )
}

function leavesExercise(
  prev: TimerState,
  next: TimerState | 'done',
): boolean {
  if (next === 'done') return true
  return next.exerciseIndex !== prev.exerciseIndex
}

function plannedSeriesTotal(
  exercises: WorkoutExercise[],
  settings: WorkoutSettings,
): number {
  const perRound = exercises.reduce(
    (sum, item) => sum + Math.max(1, item.series || 1),
    0,
  )
  return perRound * Math.max(1, settings.rounds)
}

export function useWorkoutTimer({
  exercises,
  settings,
  onComplete,
  restore = null,
  onSnapshot,
}: UseWorkoutTimerArgs) {
  const restored = Boolean(restore)
  const [state, setState] = useState<TimerState>(() => {
    if (restore) {
      return clampTimerState(
        {
          phase: restore.phase,
          exerciseIndex: restore.exerciseIndex,
          series: restore.series,
          round: restore.round,
          secondsLeft: restore.secondsLeft,
        },
        exercises,
      )
    }
    return initialTimerState(exercises, settings)
  })
  const [running, setRunning] = useState(!restored)
  const [sessionFeedback, setSessionFeedback] = useState<SessionFeedback>(() => {
    if (restore?.savedFeedback?.length) {
      return buildSessionFeedback(
        restore.savedFeedback,
        plannedSeriesTotal(exercises, settings),
      )
    }
    return emptyPlannedFeedback(exercises, settings)
  })

  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const onSnapshotRef = useRef(onSnapshot)
  onSnapshotRef.current = onSnapshot
  const lastTickBeepRef = useRef<number | null>(null)
  const prevSeriesCueRef = useRef<{
    primed: boolean
    phase: TimerPhase
    series: number
    exerciseIndex: number
    round: number
  }>({
    primed: restored,
    phase: state.phase,
    series: state.series,
    exerciseIndex: state.exerciseIndex,
    round: state.round,
  })

  const draftRef = useRef<ExerciseDraft | null>(
    restore?.currentDraft ? { ...restore.currentDraft } : null,
  )
  const savedRef = useRef<ExerciseFeedback[]>(
    restore?.savedFeedback ? [...restore.savedFeedback] : [],
  )
  const pauseStartedAtRef = useRef<number | null>(null)
  const completingRef = useRef(false)
  const exercisesRef = useRef(exercises)
  exercisesRef.current = exercises
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const currentInstanceIdRef = useRef(
    exercises[state.exerciseIndex]?.instanceId ??
      exercises[0]?.instanceId ??
      '',
  )

  // Keep exerciseIndex aligned when the list is reordered mid-session.
  useEffect(() => {
    const currentId = currentInstanceIdRef.current
    if (!currentId) return
    const nextIndex = exercises.findIndex(
      (item) => item.instanceId === currentId,
    )
    if (nextIndex < 0) return
    setState((prev) =>
      prev.exerciseIndex === nextIndex
        ? prev
        : { ...prev, exerciseIndex: nextIndex },
    )
  }, [exercises])

  function ensureDraft(forState: TimerState = state): ExerciseDraft {
    const list = exercisesRef.current
    const item = list[forState.exerciseIndex]
    if (!item) {
      return createEmptyDraft('unknown', 'Exercise', 1)
    }
    if (
      !draftRef.current ||
      draftRef.current.instanceId !== item.instanceId
    ) {
      draftRef.current = createEmptyDraft(
        item.instanceId,
        item.exercise.name,
        seriesFor(list, forState.exerciseIndex),
      )
    }
    return draftRef.current
  }

  function rebuildSessionFeedback(saved: ExerciseFeedback[]) {
    const feedback = buildSessionFeedback(
      saved,
      plannedSeriesTotal(exercisesRef.current, settingsRef.current),
    )
    setSessionFeedback(feedback)
    return feedback
  }

  function closePauseClock(draft: ExerciseDraft) {
    if (pauseStartedAtRef.current == null) return
    const elapsed = Math.max(
      0,
      Math.round((Date.now() - pauseStartedAtRef.current) / 1000),
    )
    draft.pauseSeconds += elapsed
    pauseStartedAtRef.current = null
  }

  function saveExerciseLeaving(prev: TimerState): void {
    const draft = ensureDraft(prev)
    closePauseClock(draft)
    if (draft.skippedExercise) {
      const remaining = Math.max(
        0,
        draft.plannedSeries - draft.completedSeries - draft.skippedSeries,
      )
      draft.skippedSeries += remaining
    }

    const finalized = finalizeExerciseFeedback({ ...draft }, true)
    const existingIndex = savedRef.current.findIndex(
      (item) => item.instanceId === finalized.instanceId,
    )
    if (existingIndex >= 0) {
      const previous = savedRef.current[existingIndex]
      const mergedDraft = mergeDrafts(draftFromFeedback(previous), draft)
      savedRef.current[existingIndex] = finalizeExerciseFeedback(
        mergedDraft,
        true,
      )
    } else {
      savedRef.current = [...savedRef.current, finalized]
    }

    draftRef.current = null
    pauseStartedAtRef.current = null
  }

  function resolveLeavingExercise(
    prev: TimerState,
    next: TimerState | 'done',
  ): TimerState {
    saveExerciseLeaving(prev)

    if (next === 'done') {
      completingRef.current = true
      // Rest already played exerciseEnd when the last series finished.
      if (prev.phase === 'work' || prev.phase === 'transition') {
        playBeep('exerciseEnd')
      }
      window.setTimeout(() => {
        const feedback = rebuildSessionFeedback(savedRef.current)
        setRunning(false)
        onCompleteRef.current(feedback)
      }, 0)
      return { ...prev, secondsLeft: 0 }
    }

    currentInstanceIdRef.current =
      exercisesRef.current[next.exerciseIndex]?.instanceId ??
      currentInstanceIdRef.current

    window.setTimeout(() => {
      rebuildSessionFeedback(savedRef.current)
    }, 0)
    return next
  }

  useEffect(() => {
    const item = exercises[state.exerciseIndex]
    if (item) currentInstanceIdRef.current = item.instanceId
    ensureDraft(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.exerciseIndex])

  useEffect(() => {
    const prev = prevSeriesCueRef.current
    const { phase, series, exerciseIndex, round } = state

    if (!prev.primed) {
      if (phase === 'work') playBeep('exerciseStart')
      else if (phase === 'transition') playBeep('phase')
      prevSeriesCueRef.current = {
        primed: true,
        phase,
        series,
        exerciseIndex,
        round,
      }
      return
    }

    const exerciseChanged = exerciseIndex !== prev.exerciseIndex
    const seriesIdentityChanged =
      series !== prev.series || exerciseChanged || round !== prev.round

    const leftWork =
      prev.phase === 'work' && (phase !== 'work' || seriesIdentityChanged)
    const enteredWork =
      phase === 'work' && (prev.phase !== 'work' || seriesIdentityChanged)
    const enteredTransition =
      phase === 'transition' && prev.phase !== 'transition'
    const finishedLastSeries =
      leftWork &&
      prev.series >= seriesFor(exercisesRef.current, prev.exerciseIndex)

    // One clear end cue per exercise (not again when rest rolls into the next move)
    if (
      exerciseChanged &&
      (prev.phase === 'work' || prev.phase === 'transition')
    ) {
      playBeep('exerciseEnd')
    } else if (!exerciseChanged && finishedLastSeries) {
      playBeep('exerciseEnd')
    } else if (leftWork) {
      playBeep('seriesEnd')
    }

    if (enteredWork && (exerciseChanged || prev.phase === 'transition')) {
      playBeep('exerciseStart')
    } else if (enteredWork) {
      playBeep('seriesStart')
    } else if (enteredTransition) {
      // Transition means the next exercise is about to start
      playBeep('phase')
    }

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
    if (!running || completingRef.current) return
    if (state.secondsLeft <= 3 && state.secondsLeft >= 1) {
      if (lastTickBeepRef.current !== state.secondsLeft) {
        // Work ending: loud escalating multi-beeps so you hear the set finish.
        if (state.phase === 'work') {
          if (state.secondsLeft === 3) playBeep('ending3')
          else if (state.secondsLeft === 2) playBeep('ending2')
          else playBeep('ending1')
        } else if (state.secondsLeft === 1) {
          playBeep('tickUrgent')
        } else {
          playBeep('tick')
        }
        lastTickBeepRef.current = state.secondsLeft
      }
    }
  }, [running, state.secondsLeft, state.phase])

  useEffect(() => {
    if (!running || completingRef.current) return

    const id = window.setInterval(() => {
      if (completingRef.current) return
      setState((prev) => {
        if (prev.secondsLeft > 1) {
          return { ...prev, secondsLeft: prev.secondsLeft - 1 }
        }

        const draft = ensureDraft(prev)
        if (prev.phase === 'work') {
          draft.completedSeries += 1
        }

        const next = advance(prev, exercisesRef.current, settingsRef.current)
        if (next !== 'done' && next.phase === 'rest' && prev.phase === 'work') {
          draft.restOpportunityCount += 1
        }
        if (leavesExercise(prev, next)) {
          return resolveLeavingExercise(prev, next)
        }

        return next === 'done' ? prev : next
      })
    }, 1000)

    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, exercises, settings])

  useEffect(() => {
    if (completingRef.current) return
    onSnapshotRef.current?.({
      phase: state.phase,
      exerciseIndex: state.exerciseIndex,
      series: state.series,
      round: state.round,
      secondsLeft: state.secondsLeft,
      savedFeedback: savedRef.current.map((item) => ({ ...item })),
      currentDraft: draftRef.current ? { ...draftRef.current } : null,
    })
  }, [
    state.phase,
    state.exerciseIndex,
    state.series,
    state.round,
    state.secondsLeft,
    running,
    sessionFeedback,
  ])

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
    exerciseIndex: state.exerciseIndex,
    progress: Math.min(completedSteps / totalSteps, 1),
    sessionFeedback,
    toggleRunning: () => {
      if (completingRef.current) return
      setRunning((value) => {
        const draft = ensureDraft()
        if (value) {
          // pausing
          draft.pauseCount += 1
          pauseStartedAtRef.current = Date.now()
        } else {
          closePauseClock(draft)
        }
        return !value
      })
    },
    pauseCountdown: () => {
      if (completingRef.current) return
      setRunning((value) => {
        if (!value) return value
        const draft = ensureDraft()
        draft.pauseCount += 1
        pauseStartedAtRef.current = Date.now()
        return false
      })
    },
    resumeCountdown: () => {
      if (completingRef.current) return
      setRunning((value) => {
        if (value) return value
        const draft = ensureDraft()
        closePauseClock(draft)
        return true
      })
    },
    skipRest: () => {
      if (completingRef.current) return
      setState((prev) => {
        if (prev.phase !== 'rest') return prev
        const draft = ensureDraft(prev)
        draft.skipRestCount += 1
        const next = advanceAfterRest(
          prev,
          exercisesRef.current,
          settingsRef.current,
        )
        if (leavesExercise(prev, next)) {
          return resolveLeavingExercise(prev, next)
        }
        return next === 'done' ? prev : next
      })
    },
    skipTransition: () => {
      if (completingRef.current) return
      setState((prev) => {
        if (prev.phase !== 'transition') return prev
        return advanceAfterTransition(
          prev,
          exercisesRef.current,
          settingsRef.current,
        )
      })
    },
    skipSeries: () => {
      if (completingRef.current) return
      setState((prev) => {
        const draft = ensureDraft(prev)
        if (prev.phase === 'work') {
          draft.skippedSeries += 1
        }
        const next = skipToNextSeries(
          prev,
          exercisesRef.current,
          settingsRef.current,
        )
        if (leavesExercise(prev, next)) {
          return resolveLeavingExercise(prev, next)
        }
        return next === 'done' ? prev : next
      })
    },
    skipExercise: () => {
      if (completingRef.current) return
      setState((prev) => {
        const draft = ensureDraft(prev)
        draft.skippedExercise = true
        const next = skipToNextExercise(
          prev,
          exercisesRef.current,
          settingsRef.current,
        )
        return resolveLeavingExercise(prev, next)
      })
    },
    jumpToExercise: (instanceId: string) => {
      if (completingRef.current) return
      setState((prev) => {
        const list = exercisesRef.current
        const targetIndex = list.findIndex(
          (item) => item.instanceId === instanceId,
        )
        if (targetIndex < 0 || targetIndex === prev.exerciseIndex) return prev
        const next = startExerciseState(
          list,
          settingsRef.current,
          targetIndex,
          1,
          prev.round,
          true,
        )
        return resolveLeavingExercise(prev, next)
      })
    },
  }
}

function emptyPlannedFeedback(
  exercises: WorkoutExercise[],
  settings: WorkoutSettings,
): SessionFeedback {
  return buildSessionFeedback([], plannedSeriesTotal(exercises, settings))
}
