import { useEffect, useRef, useState } from 'react'
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
}

type TimerState = {
  phase: TimerPhase
  exerciseIndex: number
  series: number
  round: number
  secondsLeft: number
}

export type PendingExerciseConfirm = {
  draft: ExerciseDraft
  preview: ExerciseFeedback
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
}: UseWorkoutTimerArgs) {
  const [state, setState] = useState<TimerState>({
    phase: 'work',
    exerciseIndex: 0,
    series: 1,
    round: 1,
    secondsLeft: workSecondsFor(exercises, 0, settings),
  })
  const [running, setRunning] = useState(true)
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingExerciseConfirm | null>(null)
  const [sessionFeedback, setSessionFeedback] = useState<SessionFeedback>(() =>
    emptyPlannedFeedback(exercises, settings),
  )

  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const pendingConfirmRef = useRef<PendingExerciseConfirm | null>(null)
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

  const draftRef = useRef<ExerciseDraft | null>(null)
  const savedRef = useRef<ExerciseFeedback[]>([])
  const nextAfterConfirmRef = useRef<TimerState | 'done' | null>(null)
  const pauseStartedAtRef = useRef<number | null>(null)
  const confirmingRef = useRef(false)
  const exercisesRef = useRef(exercises)
  exercisesRef.current = exercises
  const settingsRef = useRef(settings)
  settingsRef.current = settings

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

  function requestConfirm(prev: TimerState, next: TimerState | 'done') {
    confirmingRef.current = true
    const draft = ensureDraft(prev)
    closePauseClock(draft)
    if (draft.skippedExercise) {
      const remaining = Math.max(
        0,
        draft.plannedSeries - draft.completedSeries - draft.skippedSeries,
      )
      draft.skippedSeries += remaining
    }
    const preview = finalizeExerciseFeedback(draft, true)
    nextAfterConfirmRef.current = next
    setRunning(false)
    pauseStartedAtRef.current = null
    const pending = { draft: { ...draft }, preview }
    pendingConfirmRef.current = pending
    setPendingConfirm(pending)
  }

  function applyResolvedConfirm(saved: boolean, rpe: number | null = null) {
    const pending = pendingConfirmRef.current
    const next = nextAfterConfirmRef.current
    if (!pending || next == null) return

    if (saved) {
      const draftWithRpe: ExerciseDraft = { ...pending.draft, rpe }
      const finalized = finalizeExerciseFeedback(draftWithRpe, true)
      const existingIndex = savedRef.current.findIndex(
        (item) => item.instanceId === finalized.instanceId,
      )
      if (existingIndex >= 0) {
        const previous = savedRef.current[existingIndex]
        const mergedDraft = mergeDrafts(
          draftFromFeedback(previous),
          draftWithRpe,
        )
        savedRef.current[existingIndex] = finalizeExerciseFeedback(
          mergedDraft,
          true,
        )
      } else {
        savedRef.current = [...savedRef.current, finalized]
      }
    }

    const feedback = rebuildSessionFeedback(savedRef.current)
    draftRef.current = null
    nextAfterConfirmRef.current = null
    pendingConfirmRef.current = null
    confirmingRef.current = false
    setPendingConfirm(null)

    if (next === 'done') {
      playBeep('seriesEnd')
      onCompleteRef.current(feedback)
      return
    }

    setState(next)
    setRunning(true)
  }

  useEffect(() => {
    ensureDraft(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.exerciseIndex])

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
    if (!running || pendingConfirm) return
    if (state.secondsLeft <= 3 && state.secondsLeft >= 1) {
      if (lastTickBeepRef.current !== state.secondsLeft) {
        playBeep('tick')
        lastTickBeepRef.current = state.secondsLeft
      }
    }
  }, [running, state.secondsLeft, pendingConfirm])

  useEffect(() => {
    if (!running || pendingConfirm || confirmingRef.current) return

    const id = window.setInterval(() => {
      if (confirmingRef.current) return
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
          confirmingRef.current = true
          window.setTimeout(() => requestConfirm(prev, next), 0)
          return { ...prev, secondsLeft: 0 }
        }

        return next
      })
    }, 1000)

    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, pendingConfirm, exercises, settings])

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
    pendingConfirm,
    sessionFeedback,
    saveExerciseFeedback: (rpe: number | null = null) =>
      applyResolvedConfirm(true, rpe),
    discardExerciseFeedback: () => applyResolvedConfirm(false, null),
    toggleRunning: () => {
      if (pendingConfirm) return
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
    skipRest: () => {
      if (pendingConfirm || confirmingRef.current) return
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
          confirmingRef.current = true
          window.setTimeout(() => requestConfirm(prev, next), 0)
          return { ...prev, secondsLeft: 0 }
        }
        return next === 'done' ? prev : next
      })
    },
    skipSeries: () => {
      if (pendingConfirm || confirmingRef.current) return
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
          confirmingRef.current = true
          window.setTimeout(() => requestConfirm(prev, next), 0)
          return { ...prev, secondsLeft: 0 }
        }
        return next === 'done' ? prev : next
      })
    },
    skipExercise: () => {
      if (pendingConfirm || confirmingRef.current) return
      setState((prev) => {
        const draft = ensureDraft(prev)
        draft.skippedExercise = true
        const next = skipToNextExercise(
          prev,
          exercisesRef.current,
          settingsRef.current,
        )
        confirmingRef.current = true
        window.setTimeout(() => requestConfirm(prev, next), 0)
        return { ...prev, secondsLeft: 0 }
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
