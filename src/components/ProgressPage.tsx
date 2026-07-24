import { useCallback, useEffect, useState } from 'react'
import {
  deleteWorkoutSession,
  fetchMonthlyKpis,
  fetchWeeklyKpis,
  type PeriodStats,
  type KpiDeltas,
  type HistorySession,
} from '../api/history'
import { formatTime } from '../utils/formatTime'

type Props = {
  onBack: () => void
}

type Range = 'week' | 'month'

type ViewModel = {
  range: Range
  periodStart: string
  planned: number
  current: PeriodStats
  previous: PeriodStats
  deltas: KpiDeltas
  streak: number
  recentSessions: HistorySession[]
}

function deltaText(value: number | null): string {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}%`
}

function deltaClass(value: number | null): string {
  if (value === null || value === 0) return 'kpi-delta flat'
  return value > 0 ? 'kpi-delta up' : 'kpi-delta down'
}

function formatMonthLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function ProgressPage({ onBack }: Props) {
  const [range, setRange] = useState<Range>('week')
  const [view, setView] = useState<ViewModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const loadKpis = useCallback(async (selected: Range) => {
    if (selected === 'week') {
      const kpis = await fetchWeeklyKpis()
      setView({
        range: 'week',
        periodStart: kpis.week_start,
        planned: kpis.planned_sessions_per_week,
        current: kpis.this_week,
        previous: kpis.last_week,
        deltas: kpis.deltas,
        streak: kpis.streak_weeks,
        recentSessions: kpis.recent_sessions,
      })
      return
    }

    const kpis = await fetchMonthlyKpis()
    setView({
      range: 'month',
      periodStart: kpis.month_start,
      planned: kpis.planned_sessions_per_month,
      current: kpis.this_month,
      previous: kpis.last_month,
      deltas: kpis.deltas,
      streak: kpis.streak_months,
      recentSessions: kpis.recent_sessions,
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadKpis(range)
      .then(() => {
        if (!cancelled) setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'Could not load KPIs. Start the FastAPI backend on port 8000.',
          )
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [range, loadKpis])

  async function handleConfirmDelete(sessionId: number) {
    setDeleteError(null)
    setDeletingId(sessionId)
    try {
      await deleteWorkoutSession(sessionId)
      setConfirmDeleteId(null)
      await loadKpis(range)
    } catch {
      setDeleteError('Could not delete session. Is the backend running?')
    } finally {
      setDeletingId(null)
    }
  }

  const current = view?.current
  const previous = view?.previous
  const bestReps = Object.entries(current?.best_reps ?? {}).slice(0, 6)
  const periodWord = range === 'week' ? 'week' : 'month'
  const periodLabel =
    range === 'week'
      ? `Week of ${view?.periodStart ?? '—'}`
      : formatMonthLabel(view?.periodStart ?? '')

  return (
    <div className="progress-page screen-enter">
      <header className="header">
        <div className="progress-top">
          <button type="button" className="ghost" onClick={onBack}>
            Back
          </button>
          <span className="brand-mark">
            {range === 'week' ? 'Weekly KPIs' : 'Monthly KPIs'}
          </span>
        </div>
        <h1>Progress</h1>
        <div className="range-toggle" role="group" aria-label="KPI range">
          <button
            type="button"
            className={`range-btn${range === 'week' ? ' is-selected' : ''}`}
            onClick={() => setRange('week')}
          >
            Week
          </button>
          <button
            type="button"
            className={`range-btn${range === 'month' ? ' is-selected' : ''}`}
            onClick={() => setRange('month')}
          >
            Month
          </button>
        </div>
        <p>
          {periodLabel} · Planned {view?.planned ?? '—'} sessions
        </p>
      </header>

      {loading && <p className="muted">Loading KPIs…</p>}
      {error && <p className="error">{error}</p>}

      {current && previous && view && !loading && (
        <>
          <section className="kpi-grid">
            <article className="kpi-card">
              <h3>Sessions</h3>
              <p className="kpi-value">
                {current.sessions}
                <span>/{view.planned}</span>
              </p>
              <p className={deltaClass(view.deltas.sessions_pct)}>
                {deltaText(view.deltas.sessions_pct)} vs last {periodWord}
              </p>
            </article>

            <article className="kpi-card">
              <h3>Adherence</h3>
              <p className="kpi-value">{current.adherence_pct}%</p>
              <p className="muted">Target: 100% of planned sessions</p>
            </article>

            <article className="kpi-card">
              <h3>Training time</h3>
              <p className="kpi-value">{current.total_minutes}m</p>
              <p className={deltaClass(view.deltas.minutes_pct)}>
                {deltaText(view.deltas.minutes_pct)} vs last {periodWord}
              </p>
            </article>

            <article className="kpi-card">
              <h3>Hard sets</h3>
              <p className="kpi-value">{current.total_series}</p>
              <p className={deltaClass(view.deltas.series_pct)}>
                {deltaText(view.deltas.series_pct)} vs last {periodWord}
              </p>
            </article>

            <article className="kpi-card">
              <h3>Avg session</h3>
              <p className="kpi-value">{current.avg_session_minutes}m</p>
              <p className="muted">
                Last {periodWord}: {previous.avg_session_minutes}m
              </p>
            </article>

            <article className="kpi-card">
              <h3>Streak</h3>
              <p className="kpi-value">{view.streak}</p>
              <p className="muted">
                {range === 'week' ? 'Weeks' : 'Months'} hitting planned sessions
              </p>
            </article>

            <article className="kpi-card">
              <h3>Series completion</h3>
              <p className="kpi-value">
                {current.series_completion_pct == null
                  ? '—'
                  : `${current.series_completion_pct}%`}
              </p>
              <p className="muted">From saved exercise feedback</p>
            </article>

            <article className="kpi-card">
              <h3>Pauses / skips</h3>
              <p className="kpi-value">{current.pause_count}</p>
              <p className="muted">
                {current.skip_series_count} series ·{' '}
                {current.skip_exercise_count} exercises skipped ·{' '}
                {current.skip_rest_count} rests skipped
              </p>
            </article>

            <article className="kpi-card">
              <h3>Avg session RPE</h3>
              <p className="kpi-value">
                {current.avg_session_rpe == null
                  ? '—'
                  : current.avg_session_rpe}
              </p>
              <p className="muted">
                Load{' '}
                {current.avg_training_load == null
                  ? '—'
                  : current.avg_training_load}
                {current.rest_compliance_pct != null
                  ? ` · Rest ${current.rest_compliance_pct}%`
                  : ''}
              </p>
            </article>
          </section>

          <section className="section-card">
            <h2>Strengths this {periodWord}</h2>
            <p className="section-kicker">
              Exercises you handled well — consider more reps or series.
            </p>
            {current.strengths.length === 0 ? (
              <p className="muted">No saved strengths yet this {periodWord}.</p>
            ) : (
              <ul className="best-list">
                {current.strengths.map((item) => (
                  <li key={item.name}>
                    <strong>{item.name}</strong>
                    <span>{item.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="section-card">
            <h2>Weaknesses this {periodWord}</h2>
            <p className="section-kicker">
              Exercises with skips or heavy pausing — ease volume or add rest.
            </p>
            {current.weaknesses.length === 0 ? (
              <p className="muted">
                No saved weaknesses yet this {periodWord}.
              </p>
            ) : (
              <ul className="best-list">
                {current.weaknesses.map((item) => (
                  <li key={item.name}>
                    <strong>{item.name}</strong>
                    <span>{item.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="section-card">
            <h2>Workout mix</h2>
            <p className="section-kicker">
              Push / Pull / Legs balance this {periodWord}.
            </p>
            <div className="mix-row">
              <div>
                <strong>{current.workout_mix.push}</strong>
                <span>Push</span>
              </div>
              <div>
                <strong>{current.workout_mix.pull}</strong>
                <span>Pull</span>
              </div>
              <div>
                <strong>{current.workout_mix.legs}</strong>
                <span>Legs</span>
              </div>
              <div>
                <strong>{current.workout_mix.other}</strong>
                <span>Other</span>
              </div>
            </div>
          </section>

          <section className="section-card">
            <h2>Best marks</h2>
            <p className="section-kicker">
              Top logged reps and hang time this {periodWord}.
            </p>
            {current.best_hang_seconds > 0 && (
              <p className="estimate">
                Best hang / timed hold: {current.best_hang_seconds}s
              </p>
            )}
            {bestReps.length === 0 ? (
              <p className="muted">
                No rep PRs logged this {periodWord} yet.
              </p>
            ) : (
              <ul className="best-list">
                {bestReps.map(([name, reps]) => (
                  <li key={name}>
                    <strong>{name}</strong>
                    <span>{reps} reps</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="section-card">
            <h2>Recent sessions</h2>
            {deleteError && <p className="error">{deleteError}</p>}
            {view.recentSessions.length === 0 ? (
              <p className="muted">Finish a workout to start your history.</p>
            ) : (
              <ul className="history-list">
                {view.recentSessions.map((session) => {
                  const confirming = confirmDeleteId === session.id
                  const deleting = deletingId === session.id
                  return (
                    <li key={session.id}>
                      <div>
                        <strong>{session.workout_name}</strong>
                        <span className="muted">
                          {new Date(session.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="history-meta">
                        <span>{session.total_series} sets</span>
                        <span>{formatTime(session.elapsed_seconds)}</span>
                        {session.feedback?.series_completion_pct != null && (
                          <span>
                            {session.feedback.series_completion_pct}% done
                          </span>
                        )}
                        {session.feedback?.session_rpe != null && (
                          <span>RPE {session.feedback.session_rpe}</span>
                        )}
                      </div>
                      {confirming ? (
                        <div className="history-delete-confirm">
                          <p className="muted">
                            Delete this session and its feedback?
                          </p>
                          <div className="history-delete-actions">
                            <button
                              type="button"
                              className="danger"
                              disabled={deleting}
                              onClick={() => {
                                void handleConfirmDelete(session.id)
                              }}
                            >
                              {deleting ? 'Deleting…' : 'Confirm delete'}
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              disabled={deleting}
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="ghost history-delete-btn"
                          onClick={() => {
                            setDeleteError(null)
                            setConfirmDeleteId(session.id)
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
