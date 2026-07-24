import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchExercises, getExerciseImageUrl } from '../api/exercises'
import {
  deleteWorkoutFromDb,
  fetchSavedWorkout,
  fetchSavedWorkouts,
  saveWorkoutToDb,
  updateWorkoutInDb,
  type DbSavedWorkout,
} from '../api/workouts'
import {
  createSavedWorkout,
  readWorkoutFromFile,
  saveWorkoutToLocalStorage,
} from '../data/savedWorkouts'
import type {
  Exercise,
  WorkoutExercise,
  WorkoutSettings,
} from '../types'
import { estimateWorkoutSeconds } from '../utils/estimateDuration'
import { formatTime } from '../utils/formatTime'
import {
  isSpeakRoastsEnabled,
  setSpeakRoastsEnabled,
  stopSpeaking,
} from '../utils/speech'
import { Encouragement } from './Encouragement'

type Props = {
  settings: WorkoutSettings
  workout: WorkoutExercise[]
  workoutName: string
  onSettingsChange: (settings: WorkoutSettings) => void
  onWorkoutChange: (workout: WorkoutExercise[]) => void
  onWorkoutNameChange: (name: string) => void
  onLoadWorkout: (payload: {
    name: string
    settings: WorkoutSettings
    exercises: WorkoutExercise[]
  }) => void
  onStart: () => void
  onOpenProgress: () => void
  onOpenSounds: () => void
}

export function WorkoutBuilder({
  settings,
  workout,
  workoutName,
  onSettingsChange,
  onWorkoutChange,
  onWorkoutNameChange,
  onLoadWorkout,
  onStart,
  onOpenProgress,
  onOpenSounds,
}: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [speakRoasts, setSpeakRoasts] = useState(isSpeakRoastsEnabled)
  const [dbWorkouts, setDbWorkouts] = useState<DbSavedWorkout[]>([])
  const [activeWorkoutId, setActiveWorkoutId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function refreshDbWorkouts() {
    try {
      const rows = await fetchSavedWorkouts()
      setDbWorkouts(rows)
    } catch {
      // Keep existing buttons if API is briefly unavailable.
    }
  }

  useEffect(() => {
    void refreshDbWorkouts()
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchExercises()
      .then((data) => {
        if (!cancelled) {
          setExercises(data)
          setLoading(false)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'Could not load the exercise library. Check your internet connection and try refreshing.',
          )
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return exercises.slice(0, 40)
    return exercises
      .filter(
        (ex) =>
          ex.name.toLowerCase().includes(q) ||
          ex.category.toLowerCase().includes(q) ||
          ex.primaryMuscles.some((m) => m.toLowerCase().includes(q)) ||
          (ex.equipment ?? '').toLowerCase().includes(q),
      )
      .slice(0, 40)
  }, [exercises, query])

  const estimatedSeconds = useMemo(
    () => estimateWorkoutSeconds(workout, settings),
    [workout, settings],
  )

  async function handleSave() {
    try {
      if (workout.length === 0) {
        setSaveError('Add at least one exercise before saving.')
        setSaveMessage(null)
        return
      }
      const saved = createSavedWorkout(workoutName, settings, workout)
      const stored =
        activeWorkoutId == null
          ? await saveWorkoutToDb(saved)
          : await updateWorkoutInDb(activeWorkoutId, saved)
      saveWorkoutToLocalStorage(saved)
      setActiveWorkoutId(stored.id)
      onWorkoutNameChange(stored.name)
      await refreshDbWorkouts()
      setSaveError(null)
      setSaveMessage(
        `Saved “${stored.name}” to the database and public/workouts/${stored.slug}.json.`,
      )
    } catch (err) {
      setSaveMessage(null)
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Could not save the workout. Is the API running?',
      )
    }
  }

  async function handleSaveAsNew() {
    try {
      if (workout.length === 0) {
        setSaveError('Add at least one exercise before saving.')
        setSaveMessage(null)
        return
      }
      const saved = createSavedWorkout(workoutName, settings, workout)
      const stored = await saveWorkoutToDb(saved)
      saveWorkoutToLocalStorage(saved)
      setActiveWorkoutId(stored.id)
      onWorkoutNameChange(stored.name)
      await refreshDbWorkouts()
      setSaveError(null)
      setSaveMessage(
        `Created “${stored.name}” as public/workouts/${stored.slug}.json.`,
      )
    } catch (err) {
      setSaveMessage(null)
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Could not save the workout. Is the API running?',
      )
    }
  }

  async function handleDelete(id: number, name: string) {
    const confirmed = window.confirm(
      `Delete “${name}” from the database and its JSON file?`,
    )
    if (!confirmed) return
    try {
      await deleteWorkoutFromDb(id)
      if (activeWorkoutId === id) setActiveWorkoutId(null)
      await refreshDbWorkouts()
      setSaveError(null)
      setSaveMessage(`Deleted “${name}”.`)
    } catch (err) {
      setSaveMessage(null)
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Could not delete that workout.',
      )
    }
  }

  function applyLoadedWorkout(saved: {
    name: string
    settings: WorkoutSettings
    exercises: WorkoutExercise[]
  }) {
    onLoadWorkout(saved)
    saveWorkoutToLocalStorage({
      ...saved,
      savedAt: new Date().toISOString(),
    })
    setSaveError(null)
    setSaveMessage(`Loaded “${saved.name}”.`)
  }

  async function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return
    try {
      const saved = await readWorkoutFromFile(file)
      setActiveWorkoutId(null)
      applyLoadedWorkout(saved)
    } catch (err) {
      setSaveMessage(null)
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Could not load that workout file.',
      )
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDbLoad(id: number) {
    try {
      const saved = await fetchSavedWorkout(id)
      setActiveWorkoutId(id)
      applyLoadedWorkout(saved)
    } catch (err) {
      setSaveMessage(null)
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Could not load that saved workout.',
      )
    }
  }

  function addExercise(exercise: Exercise) {
    onWorkoutChange([
      ...workout,
      {
        instanceId: `${exercise.id}-${crypto.randomUUID()}`,
        exercise,
        series: 3,
        reps: 10,
        repsLabel: '10',
        workSeconds: settings.workSeconds,
        restSeconds: settings.restSeconds,
        transitionSeconds: 0,
      },
    ])
  }

  function removeExercise(instanceId: string) {
    onWorkoutChange(workout.filter((item) => item.instanceId !== instanceId))
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

  function updateItem(
    instanceId: string,
    patch: Partial<
      Pick<
        WorkoutExercise,
        | 'series'
        | 'reps'
        | 'repsLabel'
        | 'notes'
        | 'workSeconds'
        | 'restSeconds'
        | 'transitionSeconds'
      >
    >,
  ) {
    onWorkoutChange(
      workout.map((item) => {
        if (item.instanceId !== instanceId) return item
        return {
          ...item,
          ...patch,
          series:
            patch.series !== undefined
              ? Math.max(1, patch.series)
              : item.series,
          reps:
            patch.reps !== undefined ? Math.max(0, patch.reps) : item.reps,
          workSeconds:
            patch.workSeconds !== undefined
              ? Math.max(5, patch.workSeconds)
              : item.workSeconds,
          restSeconds:
            patch.restSeconds !== undefined
              ? Math.max(0, patch.restSeconds)
              : item.restSeconds,
          transitionSeconds:
            patch.transitionSeconds !== undefined
              ? Math.max(0, patch.transitionSeconds)
              : item.transitionSeconds,
        }
      }),
    )
  }

  return (
    <div className="builder screen-enter">
      <header className="header">
        <div className="progress-top">
          <span className="brand-mark">Gym Timer</span>
          <div className="header-actions">
            <button type="button" className="ghost" onClick={onOpenSounds}>
              Sounds
            </button>
            <button type="button" className="ghost" onClick={onOpenProgress}>
              Progress KPIs
            </button>
          </div>
        </div>
        <h1>Build your session</h1>
        <p>Set timings, load a preset, then hit start.</p>
        <Encouragement seed={`builder-${workout.length}-${settings.rounds}`} />
      </header>

      <section className="section-card">
        <h2>Settings</h2>
        <p className="section-kicker">Defaults used when you add exercises.</p>
        <div className="settings">
          <label>
            Work (sec)
            <input
              type="number"
              min={5}
              value={settings.workSeconds}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  workSeconds: Math.max(5, Number(e.target.value) || 5),
                })
              }
            />
          </label>
          <label>
            Rest (sec)
            <input
              type="number"
              min={0}
              value={settings.restSeconds}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  restSeconds: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </label>
          <label>
            Rounds
            <input
              type="number"
              min={1}
              value={settings.rounds}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  rounds: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </label>
        </div>
      </section>

      <section className="section-card">
        <h2>Warm-up & cool-down</h2>
        <p className="section-kicker">Videos and roast voice.</p>
        <div className="checkbox-group">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.includeUpperWarmUp}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  includeUpperWarmUp: e.target.checked,
                })
              }
            />
            Upper warm-up
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.includeLegWarmUp}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  includeLegWarmUp: e.target.checked,
                })
              }
            />
            Leg warm-up
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.includeUpperCoolDown}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  includeUpperCoolDown: e.target.checked,
                })
              }
            />
            Upper cool-down
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.includeLegCoolDown}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  includeLegCoolDown: e.target.checked,
                })
              }
            />
            Lower cool-down
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={speakRoasts}
              onChange={(e) => {
                const enabled = e.target.checked
                setSpeakRoasts(enabled)
                setSpeakRoastsEnabled(enabled)
                if (!enabled) stopSpeaking()
              }}
            />
            Speak roasts aloud
          </label>
        </div>
      </section>

      <section className="section-card">
        <h2>Your workout ({workout.length})</h2>
        <p className="section-kicker">Presets, save/load, and series setup.</p>
        <label className="workout-name">
          Workout name
          <input
            type="text"
            value={workoutName}
            placeholder="My workout"
            onChange={(e) => onWorkoutNameChange(e.target.value)}
          />
        </label>
        <div className="save-actions">
          <button
            type="button"
            disabled={workout.length === 0}
            onClick={() => void handleSave()}
          >
            {activeWorkoutId == null ? 'Save workout' : 'Update workout'}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={workout.length === 0}
            onClick={() => void handleSaveAsNew()}
          >
            Save as new
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setActiveWorkoutId(null)
              onWorkoutNameChange('My workout')
              onWorkoutChange([])
              setSaveMessage('Cleared editor for a new workout.')
              setSaveError(null)
            }}
          >
            New workout
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => handleFileChange(e.target.files)}
          />
        </div>
        {activeWorkoutId != null && (
          <p className="muted">
            Editing saved workout #{activeWorkoutId}. Updates sync to
            public/workouts.
          </p>
        )}
        <div className="preset-actions">
          {dbWorkouts.length === 0 ? (
            <p className="muted">
              No saved workouts yet. Start the API to load day presets, then
              Save.
            </p>
          ) : (
            dbWorkouts.map((item) => (
              <div
                key={item.id}
                className={`preset-item${
                  activeWorkoutId === item.id ? ' is-active' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => void handleDbLoad(item.id)}
                >
                  {item.name}
                </button>
                <button
                  type="button"
                  className="ghost preset-delete"
                  onClick={() => void handleDelete(item.id, item.name)}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
        <div className="start-inline">
          {workout.length > 0 && (
            <p className="estimate">Est. {formatTime(estimatedSeconds)}</p>
          )}
          <button
            type="button"
            className="primary"
            disabled={workout.length === 0}
            onClick={onStart}
          >
            Start workout
          </button>
        </div>
        {saveMessage && <p className="muted">{saveMessage}</p>}
        {saveError && <p className="error">{saveError}</p>}
        {workout.length === 0 ? (
          <p className="muted">Add exercises from the library below.</p>
        ) : (
          <ul className="workout-list">
            {workout.map((item, index) => {
              const image = getExerciseImageUrl(item.exercise)
              return (
                <li key={item.instanceId}>
                  {image ? (
                    <img src={image} alt="" width={56} height={56} />
                  ) : (
                    <div className="img-fallback" />
                  )}
                  <div className="item-info">
                    <strong>
                      {index + 1}. {item.exercise.name}
                    </strong>
                    <div className="item-controls">
                      <label>
                        Series
                        <input
                          type="number"
                          min={1}
                          value={item.series}
                          onChange={(e) =>
                            updateItem(item.instanceId, {
                              series: Number(e.target.value) || 1,
                            })
                          }
                        />
                      </label>
                      <label>
                        Reps #
                        <input
                          type="number"
                          min={0}
                          value={item.reps}
                          onChange={(e) =>
                            updateItem(item.instanceId, {
                              reps: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                      <label>
                        Work
                        <input
                          type="number"
                          min={5}
                          value={item.workSeconds}
                          onChange={(e) =>
                            updateItem(item.instanceId, {
                              workSeconds: Number(e.target.value) || 5,
                            })
                          }
                        />
                      </label>
                      <label>
                        Rest
                        <input
                          type="number"
                          min={0}
                          value={item.restSeconds}
                          onChange={(e) =>
                            updateItem(item.instanceId, {
                              restSeconds: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                      <label>
                        Transition
                        <input
                          type="number"
                          min={0}
                          value={item.transitionSeconds ?? 0}
                          onChange={(e) =>
                            updateItem(item.instanceId, {
                              transitionSeconds: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="reps-label">
                      Reps label
                      <input
                        type="text"
                        value={item.repsLabel ?? ''}
                        placeholder="5-12, AMRAP…"
                        onChange={(e) =>
                          updateItem(item.instanceId, {
                            repsLabel: e.target.value,
                          })
                        }
                      />
                    </label>
                    {item.notes && <span className="muted">{item.notes}</span>}
                  </div>
                  <div className="item-actions">
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
                      onClick={() => removeExercise(item.instanceId)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="section-card">
        <h2>Exercise library</h2>
        <p className="section-kicker">Search and add moves to your list.</p>
        <input
          className="search"
          type="search"
          placeholder="Search by name, muscle, or equipment"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && <p className="muted">Loading exercises…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="muted">No exercises match your search.</p>
        )}
        {!loading && !error && (
          <ul className="library-list">
            {filtered.map((exercise) => {
              const image = getExerciseImageUrl(exercise)
              return (
                <li key={exercise.id}>
                  {image ? (
                    <img src={image} alt="" width={48} height={48} />
                  ) : (
                    <div className="img-fallback" />
                  )}
                  <div className="item-info">
                    <strong>{exercise.name}</strong>
                    <span className="muted">
                      {(exercise.primaryMuscles[0] ?? 'general') +
                        (exercise.equipment
                          ? ` · ${exercise.equipment}`
                          : '')}
                    </span>
                  </div>
                  <button type="button" onClick={() => addExercise(exercise)}>
                    Add
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="credit">
          Exercises from{' '}
          <a
            href="https://github.com/hasaneyldrm/exercises-dataset"
            target="_blank"
            rel="noreferrer"
          >
            exercises-dataset
          </a>
          . Media © Gym visual.
        </p>
      </section>

      <div className="sticky-start">
        <div className="sticky-start-inner">
          {workout.length > 0 && (
            <p className="estimate">Est. {formatTime(estimatedSeconds)}</p>
          )}
          <button
            type="button"
            className="primary"
            disabled={workout.length === 0}
            onClick={onStart}
          >
            Start workout
          </button>
        </div>
      </div>
    </div>
  )
}
