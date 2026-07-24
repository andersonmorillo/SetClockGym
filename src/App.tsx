import { useEffect, useMemo, useRef, useState } from 'react'
import { saveWorkoutSession } from './api/history'
import { ActiveTimer } from './components/ActiveTimer'
import { ProgressPage } from './components/ProgressPage'
import { SoundsPage } from './components/SoundsPage'
import { VideoStep } from './components/VideoStep'
import { WorkoutBuilder } from './components/WorkoutBuilder'
import { WorkoutComplete } from './components/WorkoutComplete'
import {
  ACTIVE_SESSION_VERSION,
  clearActiveSession,
  loadActiveSession,
  saveActiveSession,
  type ActiveSessionSnapshot,
  type ActiveTimerSnapshot,
} from './data/activeSession'
import { loadWorkoutFromLocalStorage } from './data/savedWorkouts'
import { useElapsedTimer } from './hooks/useElapsedTimer'
import { stopWorkoutAudio } from './utils/workoutAudio'
import {
  getCoolDownQueue,
  getWarmUpQueue,
  type AppScreen,
  type WorkoutExercise,
  type WorkoutSettings,
} from './types'
import type { SessionFeedback } from './utils/sessionFeedback'
import './App.css'

const DEFAULT_SETTINGS: WorkoutSettings = {
  workSeconds: 40,
  restSeconds: 20,
  rounds: 1,
  includeUpperWarmUp: true,
  includeLegWarmUp: false,
  includeUpperCoolDown: true,
  includeLegCoolDown: false,
}

const savedOnLoad = loadWorkoutFromLocalStorage()
const restoredOnLoad = loadActiveSession()

function App() {
  const [screen, setScreen] = useState<AppScreen>(
    restoredOnLoad?.screen ?? 'builder',
  )
  const [settings, setSettings] = useState<WorkoutSettings>(
    restoredOnLoad?.settings ?? savedOnLoad?.settings ?? DEFAULT_SETTINGS,
  )
  const [workout, setWorkout] = useState<WorkoutExercise[]>(
    restoredOnLoad?.workout ?? savedOnLoad?.exercises ?? [],
  )
  const [workoutName, setWorkoutName] = useState(
    restoredOnLoad?.workoutName ?? savedOnLoad?.name ?? 'My workout',
  )
  const [timerKey, setTimerKey] = useState(0)
  const [sessionKey, setSessionKey] = useState(0)
  const [historyStatus, setHistoryStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const [sessionFeedback, setSessionFeedback] = useState<SessionFeedback | null>(
    null,
  )
  const [sessionRestored, setSessionRestored] = useState(Boolean(restoredOnLoad))
  const [restoreBundle, setRestoreBundle] = useState<{
    warmUpIndex: number
    coolDownIndex: number
    elapsedSeconds: number
    timer: ActiveTimerSnapshot | null
  } | null>(
    restoredOnLoad
      ? {
          warmUpIndex: restoredOnLoad.warmUpIndex,
          coolDownIndex: restoredOnLoad.coolDownIndex,
          elapsedSeconds: restoredOnLoad.elapsedSeconds,
          timer: restoredOnLoad.timer,
        }
      : null,
  )
  const historySavedRef = useRef(false)
  const sessionFeedbackRef = useRef<SessionFeedback | null>(null)

  async function persistHistory(
    elapsedSeconds: number,
    feedback: SessionFeedback | null,
  ) {
    if (historySavedRef.current) return
    historySavedRef.current = true
    setHistoryStatus('saving')
    try {
      await saveWorkoutSession({
        workout_name: workoutName,
        exercise_count: workout.length,
        rounds: settings.rounds,
        total_series: workout.reduce(
          (sum, item) => sum + Math.max(1, item.series || 1),
          0,
        ),
        elapsed_seconds: elapsedSeconds,
        exercises: workout,
        feedback,
      })
      setHistoryStatus('saved')
    } catch {
      setHistoryStatus('error')
    }
  }

  function discardActiveSession() {
    clearActiveSession()
    setSessionRestored(false)
    setRestoreBundle(null)
  }

  function beginSession() {
    // Do not stopWorkoutAudio here — Start already unlocked it in the same tap.
    discardActiveSession()
    historySavedRef.current = false
    setHistoryStatus('idle')
    sessionFeedbackRef.current = null
    setSessionFeedback(null)
    setSessionKey((k) => k + 1)
    const queue = getWarmUpQueue(settings)
    if (queue.length > 0) {
      setScreen('warmup')
      return
    }
    setTimerKey((k) => k + 1)
    setScreen('timer')
  }

  function goToTimer() {
    setTimerKey((k) => k + 1)
    setScreen('timer')
  }

  function finishSession(
    _elapsedSeconds: number,
    feedback: SessionFeedback | null,
  ) {
    discardActiveSession()
    stopWorkoutAudio()
    sessionFeedbackRef.current = feedback
    setSessionFeedback(feedback)
    setScreen('complete')
  }

  function goToCoolDownOrComplete(
    elapsedSeconds: number,
    feedback: SessionFeedback,
  ) {
    sessionFeedbackRef.current = feedback
    setSessionFeedback(feedback)
    if (getCoolDownQueue(settings).length > 0) {
      setScreen('cooldown')
      return
    }
    finishSession(elapsedSeconds, feedback)
  }

  function exitToBuilder() {
    discardActiveSession()
    stopWorkoutAudio()
    setScreen('builder')
  }

  if (screen === 'builder') {
    return (
      <main className="app">
        <WorkoutBuilder
          settings={settings}
          workout={workout}
          workoutName={workoutName}
          onSettingsChange={setSettings}
          onWorkoutChange={setWorkout}
          onWorkoutNameChange={setWorkoutName}
          onLoadWorkout={({ name, settings: nextSettings, exercises }) => {
            setWorkoutName(name)
            setSettings(nextSettings)
            setWorkout(exercises)
          }}
          onStart={beginSession}
          onOpenProgress={() => setScreen('progress')}
          onOpenSounds={() => setScreen('sounds')}
        />
      </main>
    )
  }

  if (screen === 'progress') {
    return (
      <main className="app">
        <ProgressPage onBack={() => setScreen('builder')} />
      </main>
    )
  }

  if (screen === 'sounds') {
    return (
      <main className="app">
        <SoundsPage onBack={() => setScreen('builder')} />
      </main>
    )
  }

  return (
    <main className="app">
      <WorkoutSession
        key={sessionKey}
        screen={screen}
        workout={workout}
        settings={settings}
        workoutName={workoutName}
        timerKey={timerKey}
        encouragementSeed={`session-${sessionKey}`}
        historyStatus={historyStatus}
        sessionFeedback={sessionFeedback}
        sessionRestored={sessionRestored}
        initialWarmUpIndex={restoreBundle?.warmUpIndex ?? 0}
        initialCoolDownIndex={restoreBundle?.coolDownIndex ?? 0}
        initialElapsedSeconds={restoreBundle?.elapsedSeconds ?? 0}
        timerRestore={restoreBundle?.timer ?? null}
        onExit={exitToBuilder}
        onWorkoutChange={setWorkout}
        onGoToTimer={goToTimer}
        onTimerComplete={goToCoolDownOrComplete}
        onSessionComplete={(elapsed) => {
          finishSession(elapsed, sessionFeedbackRef.current)
        }}
        onPersistHistory={(elapsed, feedback) => {
          sessionFeedbackRef.current = feedback
          setSessionFeedback(feedback)
          void persistHistory(elapsed, feedback)
        }}
        onAgain={beginSession}
        onEdit={exitToBuilder}
      />
    </main>
  )
}

type WorkoutSessionProps = {
  screen: Exclude<AppScreen, 'builder' | 'progress' | 'sounds'>
  workout: WorkoutExercise[]
  settings: WorkoutSettings
  workoutName: string
  timerKey: number
  encouragementSeed: string
  historyStatus: 'idle' | 'saving' | 'saved' | 'error'
  sessionFeedback: SessionFeedback | null
  sessionRestored: boolean
  initialWarmUpIndex: number
  initialCoolDownIndex: number
  initialElapsedSeconds: number
  timerRestore: ActiveTimerSnapshot | null
  onExit: () => void
  onWorkoutChange: (workout: WorkoutExercise[]) => void
  onGoToTimer: () => void
  onTimerComplete: (elapsedSeconds: number, feedback: SessionFeedback) => void
  onSessionComplete: (elapsedSeconds: number) => void
  onPersistHistory: (
    elapsedSeconds: number,
    feedback: SessionFeedback | null,
  ) => void
  onAgain: () => void
  onEdit: () => void
}

function WorkoutSession({
  screen,
  workout,
  settings,
  workoutName,
  timerKey,
  encouragementSeed,
  historyStatus,
  sessionFeedback,
  sessionRestored,
  initialWarmUpIndex,
  initialCoolDownIndex,
  initialElapsedSeconds,
  timerRestore,
  onExit,
  onWorkoutChange,
  onGoToTimer,
  onTimerComplete,
  onSessionComplete,
  onPersistHistory,
  onAgain,
  onEdit,
}: WorkoutSessionProps) {
  const warmUpQueue = useMemo(() => getWarmUpQueue(settings), [settings])
  const coolDownQueue = useMemo(() => getCoolDownQueue(settings), [settings])
  const [warmUpIndex, setWarmUpIndex] = useState(initialWarmUpIndex)
  const [coolDownIndex, setCoolDownIndex] = useState(initialCoolDownIndex)
  const [finalElapsed, setFinalElapsed] = useState(0)
  const feedbackRef = useRef<SessionFeedback | null>(sessionFeedback)
  feedbackRef.current = sessionFeedback
  const timerSnapshotRef = useRef<ActiveTimerSnapshot | null>(timerRestore)
  const persistTimerRef = useRef<number | null>(null)
  const elapsedSeconds = useElapsedTimer(
    screen === 'warmup' || screen === 'timer' || screen === 'cooldown',
    initialElapsedSeconds,
  )
  const elapsedRef = useRef(elapsedSeconds)
  elapsedRef.current = elapsedSeconds

  function buildSnapshot(): ActiveSessionSnapshot | null {
    if (screen === 'complete') return null
    if (screen !== 'warmup' && screen !== 'timer' && screen !== 'cooldown') {
      return null
    }
    return {
      version: ACTIVE_SESSION_VERSION,
      savedAt: new Date().toISOString(),
      screen,
      workoutName,
      settings,
      workout,
      warmUpIndex,
      coolDownIndex,
      elapsedSeconds: elapsedRef.current,
      timer: screen === 'timer' ? timerSnapshotRef.current : null,
    }
  }

  function flushSnapshot() {
    const snapshot = buildSnapshot()
    if (!snapshot) return
    if (snapshot.screen === 'timer' && !snapshot.timer) return
    saveActiveSession(snapshot)
  }

  function scheduleSnapshot() {
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current)
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null
      flushSnapshot()
    }, 300)
  }

  useEffect(() => {
    if (screen === 'complete') {
      clearActiveSession()
      return
    }
    scheduleSnapshot()
    return () => {
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    screen,
    workout,
    settings,
    workoutName,
    warmUpIndex,
    coolDownIndex,
    elapsedSeconds,
  ])

  useEffect(() => {
    function onHide() {
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
      flushSnapshot()
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') onHide()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    screen,
    workout,
    settings,
    workoutName,
    warmUpIndex,
    coolDownIndex,
  ])

  function continueWarmUp() {
    if (warmUpIndex < warmUpQueue.length - 1) {
      setWarmUpIndex((index) => index + 1)
      return
    }
    onGoToTimer()
  }

  function continueCoolDown() {
    if (coolDownIndex < coolDownQueue.length - 1) {
      setCoolDownIndex((index) => index + 1)
      return
    }
    const total = elapsedRef.current
    setFinalElapsed(total)
    onSessionComplete(total)
  }

  if (screen === 'warmup') {
    const step = warmUpQueue[Math.min(warmUpIndex, warmUpQueue.length - 1)]

    return (
      <VideoStep
        mode="warmup"
        step={step}
        stepIndex={warmUpIndex}
        stepCount={warmUpQueue.length}
        elapsedSeconds={elapsedSeconds}
        encouragementSeed={`${encouragementSeed}-warmup-${step.kind}`}
        onExit={onExit}
        onSkip={onGoToTimer}
        onContinue={continueWarmUp}
      />
    )
  }

  if (screen === 'timer') {
    return (
      <ActiveTimer
        key={timerKey}
        workout={workout}
        settings={settings}
        elapsedSeconds={elapsedSeconds}
        encouragementSeed={encouragementSeed}
        restore={timerRestore}
        sessionRestored={sessionRestored}
        onTimerSnapshot={(snapshot) => {
          timerSnapshotRef.current = snapshot
          scheduleSnapshot()
        }}
        onWorkoutChange={onWorkoutChange}
        onExit={onExit}
        onComplete={(feedback) => {
          const total = elapsedRef.current
          setFinalElapsed(total)
          feedbackRef.current = feedback
          onTimerComplete(total, feedback)
        }}
      />
    )
  }

  if (screen === 'cooldown') {
    const step =
      coolDownQueue[Math.min(coolDownIndex, coolDownQueue.length - 1)]

    return (
      <VideoStep
        mode="cooldown"
        step={step}
        stepIndex={coolDownIndex}
        stepCount={coolDownQueue.length}
        elapsedSeconds={elapsedSeconds}
        encouragementSeed={`${encouragementSeed}-cooldown-${step.kind}`}
        onExit={onExit}
        onSkip={() => {
          const total = elapsedRef.current
          setFinalElapsed(total)
          onSessionComplete(total)
        }}
        onContinue={continueCoolDown}
      />
    )
  }

  return (
    <WorkoutComplete
      exerciseCount={workout.length}
      rounds={settings.rounds}
      elapsedSeconds={finalElapsed}
      encouragementSeed={`${encouragementSeed}-complete`}
      historyStatus={historyStatus}
      feedback={sessionFeedback}
      onPersist={(feedback) => onPersistHistory(finalElapsed, feedback)}
      onAgain={onAgain}
      onEdit={onEdit}
    />
  )
}

export default App
