import { useEffect, useState } from 'react'
import { fetchWeeklyKpis, type WeeklyKpis } from '../api/history'
import { formatTime } from '../utils/formatTime'

type Props = {
  onBack: () => void
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

export function ProgressPage({ onBack }: Props) {
  const [data, setData] = useState<WeeklyKpis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchWeeklyKpis()
      .then((kpis) => {
        if (!cancelled) {
          setData(kpis)
          setLoading(false)
        }
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
  }, [])

  const thisWeek = data?.this_week
  const lastWeek = data?.last_week
  const bestReps = Object.entries(thisWeek?.best_reps ?? {}).slice(0, 6)

  return (
    <div className="progress-page screen-enter">
      <header className="header">
        <div className="progress-top">
          <button type="button" className="ghost" onClick={onBack}>
            Back
          </button>
          <span className="brand-mark">Weekly KPIs</span>
        </div>
        <h1>Progress</h1>
        <p>
          Week of {data?.week_start ?? '—'} · Planned{' '}
          {data?.planned_sessions_per_week ?? 3} sessions
        </p>
      </header>

      {loading && <p className="muted">Loading KPIs…</p>}
      {error && <p className="error">{error}</p>}

      {thisWeek && lastWeek && data && (
        <>
          <section className="kpi-grid">
            <article className="kpi-card">
              <h3>Sessions</h3>
              <p className="kpi-value">
                {thisWeek.sessions}
                <span>/{data.planned_sessions_per_week}</span>
              </p>
              <p className={deltaClass(data.deltas.sessions_pct)}>
                {deltaText(data.deltas.sessions_pct)} vs last week
              </p>
            </article>

            <article className="kpi-card">
              <h3>Adherence</h3>
              <p className="kpi-value">{thisWeek.adherence_pct}%</p>
              <p className="muted">Target: 100% of planned sessions</p>
            </article>

            <article className="kpi-card">
              <h3>Training time</h3>
              <p className="kpi-value">{thisWeek.total_minutes}m</p>
              <p className={deltaClass(data.deltas.minutes_pct)}>
                {deltaText(data.deltas.minutes_pct)} vs last week
              </p>
            </article>

            <article className="kpi-card">
              <h3>Hard sets</h3>
              <p className="kpi-value">{thisWeek.total_series}</p>
              <p className={deltaClass(data.deltas.series_pct)}>
                {deltaText(data.deltas.series_pct)} vs last week
              </p>
            </article>

            <article className="kpi-card">
              <h3>Avg session</h3>
              <p className="kpi-value">{thisWeek.avg_session_minutes}m</p>
              <p className="muted">
                Last week: {lastWeek.avg_session_minutes}m
              </p>
            </article>

            <article className="kpi-card">
              <h3>Streak</h3>
              <p className="kpi-value">{data.streak_weeks}</p>
              <p className="muted">Weeks hitting planned sessions</p>
            </article>
          </section>

          <section className="section-card">
            <h2>Workout mix</h2>
            <p className="section-kicker">Push / Pull / Legs balance this week.</p>
            <div className="mix-row">
              <div>
                <strong>{thisWeek.workout_mix.push}</strong>
                <span>Push</span>
              </div>
              <div>
                <strong>{thisWeek.workout_mix.pull}</strong>
                <span>Pull</span>
              </div>
              <div>
                <strong>{thisWeek.workout_mix.legs}</strong>
                <span>Legs</span>
              </div>
              <div>
                <strong>{thisWeek.workout_mix.other}</strong>
                <span>Other</span>
              </div>
            </div>
          </section>

          <section className="section-card">
            <h2>Best marks</h2>
            <p className="section-kicker">Top logged reps and hang time this week.</p>
            {thisWeek.best_hang_seconds > 0 && (
              <p className="estimate">
                Best hang / timed hold: {thisWeek.best_hang_seconds}s
              </p>
            )}
            {bestReps.length === 0 ? (
              <p className="muted">No rep PRs logged this week yet.</p>
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
            {data.recent_sessions.length === 0 ? (
              <p className="muted">Finish a workout to start your history.</p>
            ) : (
              <ul className="history-list">
                {data.recent_sessions.map((session) => (
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
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
