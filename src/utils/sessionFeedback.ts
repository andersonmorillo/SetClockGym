export type ExerciseVerdict = 'strength' | 'weakness' | 'neutral'

export type ExerciseFeedback = {
  name: string
  instanceId: string
  planned_series: number
  completed_series: number
  skipped_series: number
  skipped_exercise: boolean
  pause_count: number
  pause_seconds: number
  skip_rest_count: number
  rest_opportunity_count: number
  rpe: number | null
  verdict: ExerciseVerdict
  tip: string | null
  progression_tip: string | null
  saved: boolean
}

export type SessionFeedback = {
  pause_count: number
  pause_seconds: number
  skip_rest_count: number
  rest_opportunity_count: number
  rest_compliance_pct: number | null
  skip_series_count: number
  skip_exercise_count: number
  planned_series: number
  completed_series: number
  series_completion_pct: number
  session_rpe: number | null
  training_load: number | null
  exercises: ExerciseFeedback[]
  strengths: ExerciseFeedback[]
  weaknesses: ExerciseFeedback[]
  tips: string[]
}

export type ExerciseDraft = {
  instanceId: string
  name: string
  plannedSeries: number
  completedSeries: number
  skippedSeries: number
  skippedExercise: boolean
  pauseCount: number
  pauseSeconds: number
  skipRestCount: number
  restOpportunityCount: number
  rpe: number | null
}

export function createEmptyDraft(
  instanceId: string,
  name: string,
  plannedSeries: number,
): ExerciseDraft {
  return {
    instanceId,
    name,
    plannedSeries: Math.max(1, plannedSeries),
    completedSeries: 0,
    skippedSeries: 0,
    skippedExercise: false,
    pauseCount: 0,
    pauseSeconds: 0,
    skipRestCount: 0,
    restOpportunityCount: 0,
    rpe: null,
  }
}

export function mergeDrafts(a: ExerciseDraft, b: ExerciseDraft): ExerciseDraft {
  const rpeValues = [a.rpe, b.rpe].filter(
    (value): value is number => value != null,
  )
  const rpe =
    rpeValues.length === 0
      ? null
      : Math.round(
          rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length,
        )

  return {
    instanceId: a.instanceId,
    name: a.name,
    plannedSeries: a.plannedSeries + b.plannedSeries,
    completedSeries: a.completedSeries + b.completedSeries,
    skippedSeries: a.skippedSeries + b.skippedSeries,
    skippedExercise: a.skippedExercise || b.skippedExercise,
    pauseCount: a.pauseCount + b.pauseCount,
    pauseSeconds: a.pauseSeconds + b.pauseSeconds,
    skipRestCount: a.skipRestCount + b.skipRestCount,
    restOpportunityCount: a.restOpportunityCount + b.restOpportunityCount,
    rpe,
  }
}

export function draftFromFeedback(item: ExerciseFeedback): ExerciseDraft {
  return {
    instanceId: item.instanceId,
    name: item.name,
    plannedSeries: item.planned_series,
    completedSeries: item.completed_series,
    skippedSeries: item.skipped_series,
    skippedExercise: item.skipped_exercise,
    pauseCount: item.pause_count,
    pauseSeconds: item.pause_seconds,
    skipRestCount: item.skip_rest_count,
    restOpportunityCount: item.rest_opportunity_count,
    rpe: item.rpe,
  }
}

function classifyVerdict(draft: ExerciseDraft): ExerciseVerdict {
  const unfinished =
    draft.skippedExercise ||
    draft.skippedSeries > 0 ||
    draft.completedSeries < draft.plannedSeries

  const heavyPauses =
    draft.pauseCount >= 2 || draft.pauseSeconds >= 30

  if (unfinished || heavyPauses) {
    return 'weakness'
  }

  const cleanFinish =
    draft.completedSeries >= draft.plannedSeries &&
    draft.skippedSeries === 0 &&
    !draft.skippedExercise &&
    draft.pauseCount === 0

  const lowRpe = draft.rpe != null && draft.rpe <= 6

  if (
    cleanFinish ||
    (draft.skipRestCount > 0 && !unfinished && !heavyPauses) ||
    lowRpe
  ) {
    return 'strength'
  }

  return 'neutral'
}

function buildTips(
  draft: ExerciseDraft,
  verdict: ExerciseVerdict,
): {
  tip: string | null
  progression_tip: string | null
} {
  const restHeavy =
    draft.restOpportunityCount > 0 &&
    draft.skipRestCount / draft.restOpportunityCount >= 0.5

  if (verdict === 'weakness') {
    if (draft.skippedExercise) {
      return {
        tip: 'You skipped this exercise — try fewer series or more rest next time.',
        progression_tip: null,
      }
    }
    if (draft.rpe != null && draft.rpe >= 8) {
      return {
        tip: 'Hard effort with incomplete volume — cut 1 series or lengthen rest next time.',
        progression_tip: null,
      }
    }
    if (draft.skippedSeries > 0) {
      return {
        tip: 'Volume was hard here — try fewer series or longer rest next time.',
        progression_tip: null,
      }
    }
    if (restHeavy) {
      return {
        tip: 'Many rests were cut short — keep full rest to protect next-set performance.',
        progression_tip: null,
      }
    }
    return {
      tip: 'Needed extra breaks — consider longer rest or shorter work next time.',
      progression_tip: null,
    }
  }

  if (verdict === 'strength') {
    if (draft.rpe != null && draft.rpe <= 6) {
      return {
        tip: null,
        progression_tip: 'Felt manageable — add 1–2 reps or 1 series next time.',
      }
    }
    if (draft.rpe != null && draft.rpe >= 9) {
      return {
        tip: null,
        progression_tip: 'Tough but complete — keep the same load next time.',
      }
    }
    if (draft.skipRestCount > 0) {
      return {
        tip: null,
        progression_tip: 'You handled this well — add 1 series next time.',
      }
    }
    return {
      tip: null,
      progression_tip: 'You handled this well — add 1–2 reps next time.',
    }
  }

  if (restHeavy) {
    return {
      tip: 'Rest was often skipped — finish prescribed rest when sets feel heavy.',
      progression_tip: null,
    }
  }

  return {
    tip: 'Finished as planned.',
    progression_tip: null,
  }
}

export function finalizeExerciseFeedback(
  draft: ExerciseDraft,
  saved: boolean,
): ExerciseFeedback {
  const verdict = classifyVerdict(draft)
  const { tip, progression_tip } = buildTips(draft, verdict)
  return {
    name: draft.name,
    instanceId: draft.instanceId,
    planned_series: draft.plannedSeries,
    completed_series: draft.completedSeries,
    skipped_series: draft.skippedSeries,
    skipped_exercise: draft.skippedExercise,
    pause_count: draft.pauseCount,
    pause_seconds: draft.pauseSeconds,
    skip_rest_count: draft.skipRestCount,
    rest_opportunity_count: draft.restOpportunityCount,
    rpe: draft.rpe,
    verdict,
    tip,
    progression_tip,
    saved,
  }
}

export function buildSessionFeedback(
  savedExercises: ExerciseFeedback[],
  plannedSeriesTotal: number,
  sessionRpe: number | null = null,
  elapsedSeconds: number | null = null,
): SessionFeedback {
  const exercises = savedExercises.filter((item) => item.saved)
  const completed = exercises.reduce((sum, item) => sum + item.completed_series, 0)
  const plannedFromSaved = exercises.reduce(
    (sum, item) => sum + item.planned_series,
    0,
  )
  const planned =
    plannedFromSaved > 0 ? plannedFromSaved : plannedSeriesTotal
  const pct =
    planned > 0 ? Math.round((completed / planned) * 100) : 0

  const skipRest = exercises.reduce(
    (sum, item) => sum + item.skip_rest_count,
    0,
  )
  const restOpportunities = exercises.reduce(
    (sum, item) => sum + item.rest_opportunity_count,
    0,
  )
  const restCompliance =
    restOpportunities > 0
      ? Math.round(
          ((restOpportunities - skipRest) / restOpportunities) * 100,
        )
      : null

  const tips: string[] = []
  if (pct >= 90) {
    tips.push('Strong session — you finished nearly all planned series.')
  } else if (pct >= 70) {
    tips.push('Mixed session — some exercises need more recovery or less volume.')
  } else if (planned > 0) {
    tips.push('Volume looked high — consider fewer series on tough moves next time.')
  }

  if (restCompliance != null && restCompliance < 70 && skipRest >= 2) {
    tips.push(
      'Rest compliance was low — keeping full rest helps next-set strength.',
    )
  }

  const strengths = exercises.filter((item) => item.verdict === 'strength')
  const weaknesses = exercises.filter((item) => item.verdict === 'weakness')

  if (strengths.length > 0) {
    tips.push('Push progression on your strengths with more reps or series.')
  }
  if (weaknesses.length > 0) {
    tips.push('Ease volume or add rest on your weaknesses.')
  }

  if (sessionRpe != null && sessionRpe >= 9 && pct < 90) {
    tips.push('Very hard session with incomplete volume — recover or reduce load next time.')
  } else if (sessionRpe != null && sessionRpe <= 5 && pct >= 90) {
    tips.push('Session felt easy — consider adding reps or series next time.')
  }

  const trainingLoad =
    sessionRpe != null && elapsedSeconds != null && elapsedSeconds > 0
      ? Math.round(sessionRpe * (elapsedSeconds / 60))
      : null

  return {
    pause_count: exercises.reduce((sum, item) => sum + item.pause_count, 0),
    pause_seconds: exercises.reduce((sum, item) => sum + item.pause_seconds, 0),
    skip_rest_count: skipRest,
    rest_opportunity_count: restOpportunities,
    rest_compliance_pct: restCompliance,
    skip_series_count: exercises.reduce(
      (sum, item) => sum + item.skipped_series,
      0,
    ),
    skip_exercise_count: exercises.filter((item) => item.skipped_exercise).length,
    planned_series: planned,
    completed_series: completed,
    series_completion_pct: pct,
    session_rpe: sessionRpe,
    training_load: trainingLoad,
    exercises,
    strengths,
    weaknesses,
    tips: tips.slice(0, 3),
  }
}

export function withSessionRpe(
  feedback: SessionFeedback,
  sessionRpe: number | null,
  elapsedSeconds: number,
): SessionFeedback {
  return buildSessionFeedback(
    feedback.exercises,
    feedback.planned_series,
    sessionRpe,
    elapsedSeconds,
  )
}

export function emptySessionFeedback(plannedSeries = 0): SessionFeedback {
  return {
    pause_count: 0,
    pause_seconds: 0,
    skip_rest_count: 0,
    rest_opportunity_count: 0,
    rest_compliance_pct: null,
    skip_series_count: 0,
    skip_exercise_count: 0,
    planned_series: plannedSeries,
    completed_series: 0,
    series_completion_pct: 0,
    session_rpe: null,
    training_load: null,
    exercises: [],
    strengths: [],
    weaknesses: [],
    tips: [],
  }
}
