import { useState } from 'react'
import { formatTime } from '../utils/formatTime'
import {
  withSessionRpe,
  type SessionFeedback,
} from '../utils/sessionFeedback'
import { Encouragement } from './Encouragement'

type Props = {
  exerciseCount: number
  rounds: number
  elapsedSeconds: number
  encouragementSeed: string
  historyStatus: 'idle' | 'saving' | 'saved' | 'error'
  feedback: SessionFeedback | null
  onPersist: (feedback: SessionFeedback | null) => void
  onAgain: () => void
  onEdit: () => void
}

const RPE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function WorkoutComplete({
  exerciseCount,
  rounds,
  elapsedSeconds,
  encouragementSeed,
  historyStatus,
  feedback,
  onPersist,
  onAgain,
  onEdit,
}: Props) {
  const [sessionRpe, setSessionRpe] = useState<number | null>(
    feedback?.session_rpe ?? null,
  )

  const displayFeedback =
    feedback == null
      ? null
      : withSessionRpe(feedback, sessionRpe, elapsedSeconds)

  const strengths = displayFeedback?.strengths ?? []
  const weaknesses = displayFeedback?.weaknesses ?? []
  const canNavigate = historyStatus === 'saved' || historyStatus === 'error'
  const awaitingSave = historyStatus === 'idle' || historyStatus === 'saving'

  function persist(rpe: number | null) {
    if (historyStatus === 'saving' || historyStatus === 'saved') return
    setSessionRpe(rpe)
    if (feedback == null) {
      onPersist(null)
      return
    }
    onPersist(withSessionRpe(feedback, rpe, elapsedSeconds))
  }

  return (
    <div className="complete screen-enter">
      <span className="brand-mark">Session done</span>
      <h1>Workout complete</h1>
      <Encouragement seed={encouragementSeed} />
      <p>
        You finished {exerciseCount} exercises × {rounds} rounds.
      </p>
      <p className="total-time">{formatTime(elapsedSeconds)}</p>

      {displayFeedback && (
        <section className="session-feedback-summary">
          <p className="estimate">
            Series completion {displayFeedback.series_completion_pct}% (
            {displayFeedback.completed_series}/{displayFeedback.planned_series})
          </p>
          <p className="muted">
            Pauses {displayFeedback.pause_count} · Skipped series{' '}
            {displayFeedback.skip_series_count} · Skipped exercises{' '}
            {displayFeedback.skip_exercise_count}
          </p>
          {displayFeedback.rest_compliance_pct != null && (
            <p className="muted">
              Rest compliance {displayFeedback.rest_compliance_pct}% (
              {displayFeedback.rest_opportunity_count -
                displayFeedback.skip_rest_count}
              /{displayFeedback.rest_opportunity_count} full rests)
            </p>
          )}
          {displayFeedback.tips.map((tip) => (
            <p key={tip} className="feedback-tip">
              {tip}
            </p>
          ))}

          <div className="verdict-columns">
            <div className="verdict-column">
              <h2>Strengths</h2>
              {strengths.length === 0 ? (
                <p className="muted">No strengths saved this session.</p>
              ) : (
                <ul className="verdict-list">
                  {strengths.map((item) => (
                    <li key={item.instanceId}>
                      <strong>
                        {item.name}
                        {item.rpe != null ? ` · RPE ${item.rpe}` : ''}
                      </strong>
                      <span>
                        {item.progression_tip ??
                          'Ready for more volume next time.'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="verdict-column">
              <h2>Weaknesses</h2>
              {weaknesses.length === 0 ? (
                <p className="muted">No weaknesses saved this session.</p>
              ) : (
                <ul className="verdict-list">
                  {weaknesses.map((item) => (
                    <li key={item.instanceId}>
                      <strong>
                        {item.name}
                        {item.rpe != null ? ` · RPE ${item.rpe}` : ''}
                      </strong>
                      <span>
                        {item.tip ??
                          'Ease volume or add rest next time.'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {awaitingSave && (
        <div className="rpe-picker session-rpe-picker">
          <p className="rpe-label">Session RPE — how hard was the whole workout?</p>
          <div className="rpe-scale" role="group" aria-label="Session RPE">
            {RPE_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                className={`rpe-btn${sessionRpe === value ? ' is-selected' : ''}`}
                disabled={historyStatus === 'saving'}
                onClick={() => setSessionRpe(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <p className="muted rpe-hint">Optional · used for weekly training load</p>
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={historyStatus === 'saving'}
              onClick={() => persist(sessionRpe)}
            >
              {historyStatus === 'saving' ? 'Saving…' : 'Save session'}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={historyStatus === 'saving'}
              onClick={() => persist(null)}
            >
              Skip rating &amp; save
            </button>
          </div>
        </div>
      )}

      {historyStatus === 'saved' && (
        <p className="estimate">
          Saved to SQLite history
          {displayFeedback?.session_rpe != null
            ? ` · Session RPE ${displayFeedback.session_rpe}`
            : ''}
          {displayFeedback?.training_load != null
            ? ` · Load ${displayFeedback.training_load}`
            : ''}
          .
        </p>
      )}
      {historyStatus === 'error' && (
        <p className="error">
          Could not save history. Is the FastAPI server running?
        </p>
      )}

      {canNavigate && (
        <div className="actions">
          <button type="button" className="primary" onClick={onAgain}>
            Do it again
          </button>
          <button type="button" className="ghost" onClick={onEdit}>
            Edit workout
          </button>
        </div>
      )}
    </div>
  )
}
