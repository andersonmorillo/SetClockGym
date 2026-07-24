import type { VideoStep as VideoStepType } from '../types'
import { formatTime } from '../utils/formatTime'
import { Encouragement } from './Encouragement'

type Props = {
  mode: 'warmup' | 'cooldown'
  step: VideoStepType
  stepIndex: number
  stepCount: number
  elapsedSeconds: number
  encouragementSeed: string
  onSkip: () => void
  onContinue: () => void
  onExit: () => void
}

export function VideoStep({
  mode,
  step,
  stepIndex,
  stepCount,
  elapsedSeconds,
  encouragementSeed,
  onSkip,
  onContinue,
  onExit,
}: Props) {
  const isLast = stepIndex >= stepCount - 1
  const label = mode === 'warmup' ? 'Warm-up' : 'Cool-down'

  let continueLabel = 'Continue'
  if (mode === 'warmup') {
    continueLabel = isLast ? 'Start workout' : 'Next warm-up'
  } else {
    continueLabel = isLast ? 'Finish' : 'Next cool-down'
  }

  return (
    <div className="warmup screen-enter">
      <div className="timer-top">
        <button type="button" className="ghost" onClick={onExit}>
          Exit
        </button>
        <span className="elapsed">Total {formatTime(elapsedSeconds)}</span>
        {stepCount > 1 && (
          <span className="meta-pill">
            {label} {stepIndex + 1}/{stepCount}
          </span>
        )}
      </div>

      <span className="brand-mark">{label}</span>
      <h1>{step.title}</h1>
      <Encouragement seed={encouragementSeed} />
      <p className="muted">Follow along, then continue.</p>

      <div className="video-wrap">
        <iframe
          title={step.title}
          src={`https://www.youtube.com/embed/${step.videoId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      <div className="actions">
        <button type="button" className="primary" onClick={onContinue}>
          {continueLabel}
        </button>
        <button type="button" className="ghost" onClick={onSkip}>
          Skip {mode === 'warmup' ? 'warm-up' : 'cool-down'}
        </button>
      </div>
    </div>
  )
}
