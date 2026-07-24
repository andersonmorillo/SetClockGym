import { formatTime } from '../utils/formatTime'
import { Encouragement } from './Encouragement'

type Props = {
  exerciseCount: number
  rounds: number
  elapsedSeconds: number
  encouragementSeed: string
  historyStatus: 'idle' | 'saving' | 'saved' | 'error'
  onAgain: () => void
  onEdit: () => void
}

export function WorkoutComplete({
  exerciseCount,
  rounds,
  elapsedSeconds,
  encouragementSeed,
  historyStatus,
  onAgain,
  onEdit,
}: Props) {
  return (
    <div className="complete screen-enter">
      <span className="brand-mark">Session done</span>
      <h1>Workout complete</h1>
      <Encouragement seed={encouragementSeed} />
      <p>
        You finished {exerciseCount} exercises × {rounds} rounds.
      </p>
      <p className="total-time">{formatTime(elapsedSeconds)}</p>
      {historyStatus === 'saving' && (
        <p className="muted">Saving session to history…</p>
      )}
      {historyStatus === 'saved' && (
        <p className="estimate">Saved to SQLite history.</p>
      )}
      {historyStatus === 'error' && (
        <p className="error">
          Could not save history. Is the FastAPI server running?
        </p>
      )}
      <div className="actions">
        <button type="button" className="primary" onClick={onAgain}>
          Do it again
        </button>
        <button type="button" className="ghost" onClick={onEdit}>
          Edit workout
        </button>
      </div>
    </div>
  )
}
