import { useMemo, useState } from 'react'
import {
  draftFromFeedback,
  finalizeExerciseFeedback,
  type ExerciseFeedback,
} from '../utils/sessionFeedback'

type Props = {
  preview: ExerciseFeedback
  onSave: (rpe: number | null) => void
  onDiscard: () => void
}

const RPE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function verdictLabel(verdict: ExerciseFeedback['verdict']): string {
  if (verdict === 'strength') return 'Strength'
  if (verdict === 'weakness') return 'Weakness'
  return 'Neutral'
}

export function ExerciseFeedbackConfirm({
  preview,
  onSave,
  onDiscard,
}: Props) {
  const [rpe, setRpe] = useState<number | null>(preview.rpe)

  const live = useMemo(() => {
    const draft = draftFromFeedback(preview)
    draft.rpe = rpe
    return finalizeExerciseFeedback(draft, true)
  }, [preview, rpe])

  const restCompleted = Math.max(
    0,
    live.rest_opportunity_count - live.skip_rest_count,
  )

  return (
    <div className="exercise-feedback-confirm" role="dialog" aria-modal="true">
      <span className="brand-mark">Exercise done</span>
      <h2>{live.name}</h2>
      <p className={`verdict-badge verdict-${live.verdict}`}>
        {verdictLabel(live.verdict)}
      </p>

      <ul className="feedback-stats">
        <li>
          <strong>
            {live.completed_series}/{live.planned_series}
          </strong>
          <span>Series completed</span>
        </li>
        <li>
          <strong>{live.pause_count}</strong>
          <span>Pauses ({live.pause_seconds}s)</span>
        </li>
        <li>
          <strong>{live.skipped_series}</strong>
          <span>Skipped series</span>
        </li>
        <li>
          <strong>
            {restCompleted}/{live.rest_opportunity_count || 0}
          </strong>
          <span>Rests completed</span>
        </li>
      </ul>

      <div className="rpe-picker">
        <p className="rpe-label">How hard was this exercise? (RPE)</p>
        <div className="rpe-scale" role="group" aria-label="Exercise RPE">
          {RPE_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              className={`rpe-btn${rpe === value ? ' is-selected' : ''}`}
              onClick={() => setRpe(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="muted rpe-hint">1 easy · 10 max effort · optional</p>
      </div>

      {live.progression_tip && (
        <p className="feedback-tip strength-tip">{live.progression_tip}</p>
      )}
      {live.tip && <p className="feedback-tip">{live.tip}</p>}

      <p className="muted">
        Save this feedback for your session summary and progress metrics?
      </p>

      <div className="actions">
        <button type="button" className="primary" onClick={() => onSave(rpe)}>
          Save feedback
        </button>
        <button type="button" className="ghost" onClick={onDiscard}>
          Don&apos;t save
        </button>
      </div>
    </div>
  )
}
