/**
 * Elvy Teaching Brain
 * Lesson completion and progression gate
 *
 * File: services/teaching-brain/lesson-completion.ts
 *
 * Responsibilities:
 * - determine whether a learner may complete the current lesson
 * - verify required objectives, stages, activities, and assessment rules
 * - calculate lesson completion and mastery scores
 * - identify pedagogical blockers and minor gaps
 * - recommend review, reassessment, continuation, or human support
 * - produce a structured completion result and Session Engine command
 *
 * Deliberately excluded:
 * - evaluating learner responses (response-evaluator.ts)
 * - choosing per-turn pedagogical decisions (decision-engine.ts)
 * - generating learner-facing support (support-engine.ts)
 * - mutating session state directly (session-engine.ts)
 */

import type {
  LessonCompletionResult,
  TeachingActivity,
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
  TeachingObjective,
  TeachingStage,
} from "./types";

import type {
  ActivityRuntimeState,
  AssessmentRuntimeState,
  ObjectiveRuntimeState,
  StageRuntimeState,
  TeachingSessionState,
} from "./session-engine";

/* -------------------------------------------------------------------------- */
/*                               Public Types                                 */
/* -------------------------------------------------------------------------- */

export type LessonCompletionStatus =
  | "not_ready"
  | "ready_with_minor_gaps"
  | "ready"
  | "already_completed"
  | "blocked"
  | "requires_human_review";

export type LessonCompletionBlockerCode =
  | "SESSION_TERMINAL"
  | "SESSION_NOT_STARTED"
  | "REQUIRED_OBJECTIVE_NOT_MASTERED"
  | "REQUIRED_OBJECTIVE_MISSING"
  | "OBJECTIVE_THRESHOLD_NOT_REACHED"
  | "REQUIRED_STAGE_NOT_COMPLETED"
  | "REQUIRED_STAGE_SKIPPED"
  | "REQUIRED_ACTIVITY_NOT_COMPLETED"
  | "REQUIRED_ACTIVITY_SKIPPED"
  | "ASSESSMENT_NOT_COMPLETED"
  | "ASSESSMENT_FAILED"
  | "ASSESSMENT_SCORE_TOO_LOW"
  | "LESSON_SCORE_TOO_LOW"
  | "OBJECTIVE_MASTERY_TOO_LOW"
  | "SPEAKING_PARTICIPATION_MISSING"
  | "UNMET_PREREQUISITE"
  | "EXCESSIVE_SUPPORT_DEPENDENCE"
  | "PERSISTENT_CRITICAL_FAILURE"
  | "DATA_INCOMPLETE"
  | "POLICY_CONFLICT";

export type LessonCompletionBlockerSeverity =
  | "minor"
  | "major"
  | "critical";

export type LessonCompletionBlocker = {
  code: LessonCompletionBlockerCode;
  severity: LessonCompletionBlockerSeverity;
  message: string;

  objectiveId?: string;
  stageId?: string;
  activityId?: string;
  assessmentCriterionId?: string;

  currentValue?: number | string | boolean;
  requiredValue?: number | string | boolean;

  recoverable: boolean;
  metadata?: Record<string, unknown>;
};

export type LessonCompletionRecommendation =
  | "complete_lesson"
  | "continue_current_activity"
  | "repeat_required_activity"
  | "review_objectives"
  | "review_prerequisites"
  | "repeat_assessment"
  | "reduce_support_and_reassess"
  | "request_human_support"
  | "resume_session"
  | "no_action";

export type ObjectiveCompletionSummary = {
  objectiveId: string;
  statement: string;
  required: boolean;
  threshold: number;

  status: ObjectiveRuntimeState["status"];
  masteryScore: number;
  progress: number;
  attempts: number;
  successes: number;

  thresholdReached: boolean;
  mastered: boolean;
  prerequisiteObjectiveIds: string[];
  unmetPrerequisiteObjectiveIds: string[];

  evidenceActivityIds: string[];
};

export type StageCompletionSummary = {
  stageId: string;
  title: string;
  required: boolean;

  status: StageRuntimeState["status"];
  completed: boolean;
  skipped: boolean;

  requiredActivityIds: string[];
  completedRequiredActivityIds: string[];
  missingRequiredActivityIds: string[];
  skippedRequiredActivityIds: string[];

  score?: number;
};

export type ActivityCompletionSummary = {
  activityId: string;
  stageId: string;
  title: string;
  required: boolean;

  status: ActivityRuntimeState["status"];
  completed: boolean;
  skipped: boolean;

  attempts: number;
  successfulAttempts: number;
  bestScore?: number;
  averageScore?: number;

  supportUses: number;
  highestSupportLevel: number;
  supportDependencyRatio: number;

  successRuleSatisfied: boolean;
};

export type AssessmentCompletionSummary = {
  required: boolean;
  status: AssessmentRuntimeState["status"];

  completed: boolean;
  passed: boolean;

  score?: number;
  passingPercentage: number;
  attempts: number;

  criterionScores: Record<string, number>;
  failedCriterionIds: string[];

  retryAllowed: boolean;
  retriesRemaining?: number;
};

export type LessonCompletionMetrics = {
  completionPercentage: number;
  overallLessonScore: number;
  overallObjectiveMastery: number;
  requiredObjectiveMastery: number;

  completedRequiredStages: number;
  totalRequiredStages: number;

  completedRequiredActivities: number;
  totalRequiredActivities: number;

  masteredRequiredObjectives: number;
  totalRequiredObjectives: number;

  speakingParticipationCount: number;

  totalAttempts: number;
  successfulAttempts: number;
  successRate: number;

  totalSupportUses: number;
  highSupportActivityCount: number;
};

export type LessonCompletionEvaluation = {
  sessionId: string;
  lessonId: string;
  learnerId: string;

  status: LessonCompletionStatus;
  canComplete: boolean;
  passed: boolean;

  completionReason: string;

  blockers: LessonCompletionBlocker[];
  minorGaps: LessonCompletionBlocker[];

  objectives: ObjectiveCompletionSummary[];
  stages: StageCompletionSummary[];
  activities: ActivityCompletionSummary[];
  assessment: AssessmentCompletionSummary;
  metrics: LessonCompletionMetrics;

  masteredObjectiveIds: string[];
  developingObjectiveIds: string[];
  unmetObjectiveIds: string[];

  strengths: string[];
  improvementAreas: string[];

  recommendedNextAction: LessonCompletionRecommendation;
  recommendedReviewObjectiveIds: string[];
  recommendedReviewActivityIds: string[];
  recommendedPrerequisiteObjectiveIds: string[];

  completionResult?: LessonCompletionResult;
  evaluatedAt: string;

  metadata?: Record<string, unknown>;
};

export type EvaluateLessonCompletionInput = {
  lesson: TeachingBrainLesson;
  session: TeachingSessionState;

  /**
   * Allows the caller to force a final quality check after the final activity.
   * It does not bypass required objectives, activities, or assessment rules.
   */
  finalCheck?: boolean;

  /**
   * Optional override used by a human teacher or founder.
   * Only minor gaps may be overridden by default.
   */
  teacherOverride?: {
    approved: boolean;
    approvedBy?: string;
    reason?: string;
    allowMajorGaps?: boolean;
  };

  recommendedNextLessonId?: string;
  evaluatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type LessonCompletionEngineConfig = {
  minimumSpeakingParticipationCount?: number;

  excessiveSupportLevel?: number;
  excessiveSupportRatio?: number;
  maximumHighSupportActivities?: number;

  persistentFailureAttempts?: number;
  persistentFailureSuccessRate?: number;

  minimumSuccessfulAttempts?: number;

  allowCompletedSessionReevaluation?: boolean;
  allowTeacherOverrideForMinorGaps?: boolean;
  allowTeacherOverrideForMajorGaps?: boolean;

  countSkippedOptionalItemsAsCompleted?: boolean;
  requireIndependentObjectiveEvidence?: boolean;

  now?: () => string;
};

export type LessonCompletionSessionCommand =
  | {
      type: "complete_session";
      occurredAt: string;
      finalScore: number;
      completionPercentage: number;
      reason: string;
      result: LessonCompletionResult;
    }
  | {
      type: "continue_session";
      recommendedAction: LessonCompletionRecommendation;
      reviewObjectiveIds: string[];
      reviewActivityIds: string[];
      reason: string;
    };

export type SafeLessonCompletionResult =
  TeachingBrainResult<LessonCompletionEvaluation>;

export type LessonCompletionEngineErrorCode =
  | "INVALID_INPUT"
  | "LESSON_SESSION_MISMATCH"
  | "SESSION_ALREADY_COMPLETED"
  | "SESSION_TERMINAL"
  | "OBJECTIVE_STATE_MISSING"
  | "STAGE_STATE_MISSING"
  | "ACTIVITY_STATE_MISSING"
  | "INVALID_COMPLETION_POLICY"
  | "COMPLETION_EVALUATION_FAILED";

export class LessonCompletionEngineError extends Error {
  readonly code: LessonCompletionEngineErrorCode;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: LessonCompletionEngineErrorCode,
    message: string,
    options?: {
      recoverable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "LessonCompletionEngineError";
    this.code = code;
    this.recoverable = options?.recoverable ?? true;
    this.details = options?.details;
  }
}

/* -------------------------------------------------------------------------- */
/*                               Defaults                                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_CONFIG: Required<
  Omit<LessonCompletionEngineConfig, "now">
> = {
  minimumSpeakingParticipationCount: 1,

  excessiveSupportLevel: 3,
  excessiveSupportRatio: 0.75,
  maximumHighSupportActivities: 2,

  persistentFailureAttempts: 3,
  persistentFailureSuccessRate: 0.34,

  minimumSuccessfulAttempts: 1,

  allowCompletedSessionReevaluation: true,
  allowTeacherOverrideForMinorGaps: true,
  allowTeacherOverrideForMajorGaps: false,

  countSkippedOptionalItemsAsCompleted: true,
  requireIndependentObjectiveEvidence: false,
};

/* -------------------------------------------------------------------------- */
/*                               Utilities                                    */
/* -------------------------------------------------------------------------- */

function clamp(
  value: number,
  minimum = 0,
  maximum = 100,
): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number {
  const valid = values.filter(Number.isFinite);
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function weightedAverage(
  entries: Array<{ value: number; weight: number }>,
): number {
  const valid = entries.filter(
    (entry) =>
      Number.isFinite(entry.value) &&
      Number.isFinite(entry.weight) &&
      entry.weight > 0,
  );

  const totalWeight = valid.reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );

  if (totalWeight <= 0) return 0;

  return valid.reduce(
    (sum, entry) => sum + entry.value * entry.weight,
    0,
  ) / totalWeight;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function nowIso(
  config: LessonCompletionEngineConfig,
  explicit?: string,
): string {
  const raw = explicit ?? config.now?.() ?? new Date().toISOString();
  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new LessonCompletionEngineError(
      "INVALID_INPUT",
      `Invalid completion date: ${raw}`,
    );
  }

  return date.toISOString();
}

function isTerminalStatus(
  status: TeachingSessionState["status"],
): boolean {
  return (
    status === "completed" ||
    status === "abandoned" ||
    status === "expired" ||
    status === "error"
  );
}

function objectiveWeight(objective: TeachingObjective): number {
  if (objective.required || objective.priority === "essential") {
    return 1.5;
  }

  if (objective.priority === "important") {
    return 1;
  }

  return 0.65;
}

function activitySuccessfulAttempts(
  runtime: ActivityRuntimeState,
): number {
  return runtime.attempts.filter(
    (attempt) => attempt.outcome === "successful",
  ).length;
}

function activitySuccessRuleSatisfied(
  activity: TeachingActivity,
  runtime: ActivityRuntimeState,
): boolean {
  if (runtime.status === "completed") return true;

  if (runtime.attempts.length < activity.minimumAttempts) {
    return false;
  }

  switch (activity.successRule.type) {
    case "minimum_score":
      return (
        runtime.bestScore !== undefined &&
        runtime.bestScore >=
          (activity.successRule.minimumScore ?? 0)
      );

    case "minimum_correct_answers":
      return (
        runtime.correctAnswers >=
        (activity.successRule.minimumCorrectAnswers ?? 1)
      );

    case "minimum_successful_turns":
      return (
        runtime.successfulTurns >=
        (activity.successRule.minimumSuccessfulTurns ?? 1)
      );

    case "semantic_match":
      return (
        runtime.bestScore !== undefined &&
        runtime.bestScore >=
          (activity.successRule.semanticThreshold ?? 0)
      );

    case "single_correct_response":
      return runtime.attempts.some(
        (attempt) => attempt.outcome === "successful",
      );

    case "completion_only":
    case "manual":
      // A completed runtime was already handled by the early return above.
      // If execution reaches this branch, the activity is not completed.
      return false;

    default:
      return false;
  }
}

function requiredActivityIdsForStage(
  stage: TeachingStage,
): string[] {
  return (
    stage.completionRule.requiredActivityIds ??
    stage.activities
      .filter((activity) => activity.required)
      .map((activity) => activity.id)
  );
}

function allLessonActivities(
  lesson: TeachingBrainLesson,
): Array<{ stage: TeachingStage; activity: TeachingActivity }> {
  return lesson.stages.flatMap((stage) =>
    stage.activities.map((activity) => ({ stage, activity })),
  );
}

function activityById(
  lesson: TeachingBrainLesson,
  activityId: string,
): { stage: TeachingStage; activity: TeachingActivity } | undefined {
  return allLessonActivities(lesson).find(
    (entry) => entry.activity.id === activityId,
  );
}

function isSpeakingActivity(activity: TeachingActivity): boolean {
  return (
    activity.inputModality === "voice" ||
    [
      "conversation",
      "repeat_after_me",
      "pronunciation",
      "minimal_pairs",
      "dialogue",
      "role_play",
      "picture_description",
      "storytelling",
      "open_question",
      "question_answer",
    ].includes(activity.type)
  );
}

function speakingParticipationCount(
  lesson: TeachingBrainLesson,
  session: TeachingSessionState,
): number {
  return allLessonActivities(lesson)
    .filter(({ activity }) => isSpeakingActivity(activity))
    .reduce((count, { activity }) => {
      const runtime = session.activityStates[activity.id];
      return count + (runtime?.attempts.length ?? 0);
    }, 0);
}

function prerequisiteState(
  lesson: TeachingBrainLesson,
  session: TeachingSessionState,
  objectiveId: string,
): {
  objective?: TeachingObjective;
  state?: ObjectiveRuntimeState;
  mastered: boolean;
} {
  const objective = lesson.objectives.find(
    (candidate) => candidate.id === objectiveId,
  );
  const state = session.objectiveStates[objectiveId];

  return {
    objective,
    state,
    mastered: Boolean(
      objective &&
        state &&
        state.masteryScore >= objective.successThreshold &&
        state.status === "mastered",
    ),
  };
}

function makeBlocker(
  code: LessonCompletionBlockerCode,
  severity: LessonCompletionBlockerSeverity,
  message: string,
  options: Partial<
    Omit<
      LessonCompletionBlocker,
      "code" | "severity" | "message"
    >
  > = {},
): LessonCompletionBlocker {
  return {
    code,
    severity,
    message,
    ...options,
    recoverable: options.recoverable ?? true,
  };
}

/* -------------------------------------------------------------------------- */
/*                          Summary Construction                              */
/* -------------------------------------------------------------------------- */

function buildObjectiveSummaries(
  lesson: TeachingBrainLesson,
  session: TeachingSessionState,
): ObjectiveCompletionSummary[] {
  return lesson.objectives.map((objective) => {
    const runtime = session.objectiveStates[objective.id];

    if (!runtime) {
      throw new LessonCompletionEngineError(
        "OBJECTIVE_STATE_MISSING",
        `Runtime state for objective "${objective.id}" is missing.`,
      );
    }

    const unmetPrerequisiteObjectiveIds =
      objective.prerequisiteObjectiveIds?.filter(
        (prerequisiteId) =>
          !prerequisiteState(
            lesson,
            session,
            prerequisiteId,
          ).mastered,
      ) ?? [];

    return {
      objectiveId: objective.id,
      statement: objective.statement,
      required:
        objective.required ||
        lesson.completionCriteria.requiredObjectiveIds.includes(
          objective.id,
        ),
      threshold: Math.max(
        objective.successThreshold,
        lesson.completionCriteria.minimumObjectiveMastery,
      ),
      status: runtime.status,
      masteryScore: runtime.masteryScore,
      progress: runtime.progress,
      attempts: runtime.attempts,
      successes: runtime.successes,
      thresholdReached:
        runtime.masteryScore >=
        Math.max(
          objective.successThreshold,
          lesson.completionCriteria.minimumObjectiveMastery,
        ),
      mastered:
        runtime.status === "mastered" &&
        runtime.masteryScore >=
          Math.max(
            objective.successThreshold,
            lesson.completionCriteria.minimumObjectiveMastery,
          ),
      prerequisiteObjectiveIds: [
        ...(objective.prerequisiteObjectiveIds ?? []),
      ],
      unmetPrerequisiteObjectiveIds,
      evidenceActivityIds: [...runtime.evidenceActivityIds],
    };
  });
}

function buildActivitySummaries(
  lesson: TeachingBrainLesson,
  session: TeachingSessionState,
): ActivityCompletionSummary[] {
  const explicitRequired = new Set(
    lesson.completionCriteria.requiredActivityIds ?? [],
  );

  return allLessonActivities(lesson).map(({ stage, activity }) => {
    const runtime = session.activityStates[activity.id];

    if (!runtime) {
      throw new LessonCompletionEngineError(
        "ACTIVITY_STATE_MISSING",
        `Runtime state for activity "${activity.id}" is missing.`,
      );
    }

    const supportUses = runtime.supportHistory.length;
    const highestSupportLevel = runtime.supportHistory.reduce(
      (maximum, item) => Math.max(maximum, item.supportLevel),
      runtime.currentSupportLevel,
    );

    const supportDependencyRatio =
      runtime.attempts.length > 0
        ? clamp(
            (supportUses / runtime.attempts.length) * 100,
          )
        : supportUses > 0
          ? 100
          : 0;

    return {
      activityId: activity.id,
      stageId: stage.id,
      title: activity.title,
      required:
        activity.required ||
        explicitRequired.has(activity.id) ||
        requiredActivityIdsForStage(stage).includes(activity.id),
      status: runtime.status,
      completed: runtime.status === "completed",
      skipped: runtime.status === "skipped",
      attempts: runtime.attempts.length,
      successfulAttempts: activitySuccessfulAttempts(runtime),
      bestScore: runtime.bestScore,
      averageScore: runtime.averageScore,
      supportUses,
      highestSupportLevel,
      supportDependencyRatio: round(supportDependencyRatio),
      successRuleSatisfied: activitySuccessRuleSatisfied(
        activity,
        runtime,
      ),
    };
  });
}

function buildStageSummaries(
  lesson: TeachingBrainLesson,
  session: TeachingSessionState,
): StageCompletionSummary[] {
  return lesson.stages.map((stage) => {
    const runtime = session.stageStates[stage.id];

    if (!runtime) {
      throw new LessonCompletionEngineError(
        "STAGE_STATE_MISSING",
        `Runtime state for stage "${stage.id}" is missing.`,
      );
    }

    const requiredActivityIds =
      requiredActivityIdsForStage(stage);

    const completedRequiredActivityIds =
      requiredActivityIds.filter(
        (activityId) =>
          session.activityStates[activityId]?.status ===
          "completed",
      );

    const skippedRequiredActivityIds =
      requiredActivityIds.filter(
        (activityId) =>
          session.activityStates[activityId]?.status ===
          "skipped",
      );

    const missingRequiredActivityIds =
      requiredActivityIds.filter(
        (activityId) =>
          session.activityStates[activityId]?.status !==
            "completed" &&
          session.activityStates[activityId]?.status !== "skipped",
      );

    return {
      stageId: stage.id,
      title: stage.title,
      required: stage.required,
      status: runtime.status,
      completed: runtime.status === "completed",
      skipped: runtime.status === "skipped",
      requiredActivityIds,
      completedRequiredActivityIds,
      missingRequiredActivityIds,
      skippedRequiredActivityIds,
      score: runtime.score,
    };
  });
}

function buildAssessmentSummary(
  lesson: TeachingBrainLesson,
  session: TeachingSessionState,
): AssessmentCompletionSummary {
  const runtime = session.assessment;

  const failedCriterionIds = lesson.assessment.criteria
    .filter((criterion) => {
      const score = runtime.criterionScores[criterion.id];
      return score !== undefined && score < criterion.passingScore;
    })
    .map((criterion) => criterion.id);

  const maximumRetries = lesson.assessment.maximumRetries;
  const retriesRemaining =
    maximumRetries === undefined
      ? undefined
      : Math.max(0, maximumRetries - Math.max(0, runtime.attempts - 1));

  return {
    required:
      lesson.completionCriteria.requireAssessmentCompletion,
    status: runtime.status,
    completed:
      runtime.status === "passed" ||
      runtime.status === "failed",
    passed:
      runtime.status === "passed" &&
      (runtime.score ?? 0) >=
        lesson.assessment.passingPercentage,
    score: runtime.score,
    passingPercentage: lesson.assessment.passingPercentage,
    attempts: runtime.attempts,
    criterionScores: { ...runtime.criterionScores },
    failedCriterionIds,
    retryAllowed:
      lesson.assessment.allowRetry &&
      (retriesRemaining === undefined || retriesRemaining > 0),
    retriesRemaining,
  };
}

/* -------------------------------------------------------------------------- */
/*                           Blocker Evaluation                               */
/* -------------------------------------------------------------------------- */

function evaluateObjectiveBlockers(
  lesson: TeachingBrainLesson,
  summaries: ObjectiveCompletionSummary[],
): LessonCompletionBlocker[] {
  const blockers: LessonCompletionBlocker[] = [];

  for (const summary of summaries) {
    if (!summary.required) continue;

    if (!summary.thresholdReached) {
      blockers.push(
        makeBlocker(
          "OBJECTIVE_THRESHOLD_NOT_REACHED",
          "major",
          `Required objective "${summary.statement}" has not reached its mastery threshold.`,
          {
            objectiveId: summary.objectiveId,
            currentValue: summary.masteryScore,
            requiredValue: summary.threshold,
            recoverable: true,
          },
        ),
      );
    } else if (!summary.mastered) {
      blockers.push(
        makeBlocker(
          "REQUIRED_OBJECTIVE_NOT_MASTERED",
          "major",
          `Required objective "${summary.statement}" has enough score but is not yet marked as mastered.`,
          {
            objectiveId: summary.objectiveId,
            currentValue: summary.status,
            requiredValue: "mastered",
            recoverable: true,
          },
        ),
      );
    }

    for (const prerequisiteId of summary.unmetPrerequisiteObjectiveIds) {
      blockers.push(
        makeBlocker(
          "UNMET_PREREQUISITE",
          "major",
          `Objective "${summary.statement}" still depends on prerequisite objective "${prerequisiteId}".`,
          {
            objectiveId: summary.objectiveId,
            currentValue: prerequisiteId,
            requiredValue: "mastered prerequisite",
            recoverable: true,
            metadata: {
              prerequisiteObjectiveId: prerequisiteId,
            },
          },
        ),
      );
    }
  }

  return blockers;
}

function evaluateStageBlockers(
  summaries: StageCompletionSummary[],
): LessonCompletionBlocker[] {
  const blockers: LessonCompletionBlocker[] = [];

  for (const summary of summaries) {
    if (!summary.required) continue;

    if (summary.skipped) {
      blockers.push(
        makeBlocker(
          "REQUIRED_STAGE_SKIPPED",
          "critical",
          `Required stage "${summary.title}" was skipped.`,
          {
            stageId: summary.stageId,
            currentValue: "skipped",
            requiredValue: "completed",
            recoverable: true,
          },
        ),
      );
      continue;
    }

    if (!summary.completed) {
      blockers.push(
        makeBlocker(
          "REQUIRED_STAGE_NOT_COMPLETED",
          "major",
          `Required stage "${summary.title}" is not completed.`,
          {
            stageId: summary.stageId,
            currentValue: summary.status,
            requiredValue: "completed",
            recoverable: true,
          },
        ),
      );
    }
  }

  return blockers;
}

function evaluateActivityBlockers(
  summaries: ActivityCompletionSummary[],
): LessonCompletionBlocker[] {
  const blockers: LessonCompletionBlocker[] = [];

  for (const summary of summaries) {
    if (!summary.required) continue;

    if (summary.skipped) {
      blockers.push(
        makeBlocker(
          "REQUIRED_ACTIVITY_SKIPPED",
          "critical",
          `Required activity "${summary.title}" was skipped.`,
          {
            activityId: summary.activityId,
            stageId: summary.stageId,
            currentValue: "skipped",
            requiredValue: "completed",
            recoverable: true,
          },
        ),
      );
      continue;
    }

    if (!summary.completed || !summary.successRuleSatisfied) {
      blockers.push(
        makeBlocker(
          "REQUIRED_ACTIVITY_NOT_COMPLETED",
          "major",
          `Required activity "${summary.title}" has not satisfied its completion rule.`,
          {
            activityId: summary.activityId,
            stageId: summary.stageId,
            currentValue: summary.status,
            requiredValue: "completed with success rule satisfied",
            recoverable: true,
          },
        ),
      );
    }
  }

  return blockers;
}

function evaluateAssessmentBlockers(
  lesson: TeachingBrainLesson,
  summary: AssessmentCompletionSummary,
): LessonCompletionBlocker[] {
  if (!summary.required) return [];

  if (!summary.completed) {
    return [
      makeBlocker(
        "ASSESSMENT_NOT_COMPLETED",
        "major",
        "The required lesson assessment has not been completed.",
        {
          currentValue: summary.status,
          requiredValue: "passed",
          recoverable: true,
        },
      ),
    ];
  }

  const blockers: LessonCompletionBlocker[] = [];

  if (!summary.passed) {
    blockers.push(
      makeBlocker(
        "ASSESSMENT_FAILED",
        "major",
        "The learner has not passed the required lesson assessment.",
        {
          currentValue: summary.status,
          requiredValue: "passed",
          recoverable: summary.retryAllowed,
        },
      ),
    );
  }

  if (
    summary.score !== undefined &&
    summary.score < lesson.assessment.passingPercentage
  ) {
    blockers.push(
      makeBlocker(
        "ASSESSMENT_SCORE_TOO_LOW",
        "major",
        "The assessment score is below the passing percentage.",
        {
          currentValue: summary.score,
          requiredValue: lesson.assessment.passingPercentage,
          recoverable: summary.retryAllowed,
        },
      ),
    );
  }

  for (const criterionId of summary.failedCriterionIds) {
    blockers.push(
      makeBlocker(
        "ASSESSMENT_SCORE_TOO_LOW",
        "minor",
        `Assessment criterion "${criterionId}" is below its passing score.`,
        {
          assessmentCriterionId: criterionId,
          recoverable: summary.retryAllowed,
        },
      ),
    );
  }

  return blockers;
}

function evaluateParticipationBlockers(
  lesson: TeachingBrainLesson,
  metrics: LessonCompletionMetrics,
  config: Required<
    Omit<LessonCompletionEngineConfig, "now">
  >,
): LessonCompletionBlocker[] {
  const blockers: LessonCompletionBlocker[] = [];

  if (
    lesson.completionCriteria.requireSpeakingParticipation &&
    metrics.speakingParticipationCount <
      config.minimumSpeakingParticipationCount
  ) {
    blockers.push(
      makeBlocker(
        "SPEAKING_PARTICIPATION_MISSING",
        "major",
        "The lesson requires speaking participation before completion.",
        {
          currentValue: metrics.speakingParticipationCount,
          requiredValue:
            config.minimumSpeakingParticipationCount,
          recoverable: true,
        },
      ),
    );
  }

  if (
    metrics.successfulAttempts <
    config.minimumSuccessfulAttempts
  ) {
    blockers.push(
      makeBlocker(
        "PERSISTENT_CRITICAL_FAILURE",
        "major",
        "The learner has not yet recorded enough successful attempts.",
        {
          currentValue: metrics.successfulAttempts,
          requiredValue: config.minimumSuccessfulAttempts,
          recoverable: true,
        },
      ),
    );
  }

  return blockers;
}

function evaluateSupportAndFailureBlockers(
  activities: ActivityCompletionSummary[],
  config: Required<
    Omit<LessonCompletionEngineConfig, "now">
  >,
): LessonCompletionBlocker[] {
  const blockers: LessonCompletionBlocker[] = [];

  const highSupportActivities = activities.filter(
    (activity) =>
      activity.highestSupportLevel >=
        config.excessiveSupportLevel &&
      activity.supportDependencyRatio >=
        config.excessiveSupportRatio * 100,
  );

  if (
    highSupportActivities.length >
    config.maximumHighSupportActivities
  ) {
    blockers.push(
      makeBlocker(
        "EXCESSIVE_SUPPORT_DEPENDENCE",
        "minor",
        "The learner completed too many activities with heavy support and should be reassessed more independently.",
        {
          currentValue: highSupportActivities.length,
          requiredValue:
            config.maximumHighSupportActivities,
          recoverable: true,
          metadata: {
            activityIds: highSupportActivities.map(
              (activity) => activity.activityId,
            ),
          },
        },
      ),
    );
  }

  for (const activity of activities) {
    if (activity.attempts < config.persistentFailureAttempts) {
      continue;
    }

    const successRate =
      activity.attempts > 0
        ? activity.successfulAttempts / activity.attempts
        : 0;

    if (
      successRate <
        config.persistentFailureSuccessRate &&
      activity.required
    ) {
      blockers.push(
        makeBlocker(
          "PERSISTENT_CRITICAL_FAILURE",
          "major",
          `Required activity "${activity.title}" shows persistent failure.`,
          {
            activityId: activity.activityId,
            stageId: activity.stageId,
            currentValue: round(successRate * 100),
            requiredValue: round(
              config.persistentFailureSuccessRate * 100,
            ),
            recoverable: true,
          },
        ),
      );
    }
  }

  return blockers;
}

/* -------------------------------------------------------------------------- */
/*                          Metrics and Recommendations                       */
/* -------------------------------------------------------------------------- */

function buildMetrics(
  lesson: TeachingBrainLesson,
  session: TeachingSessionState,
  objectives: ObjectiveCompletionSummary[],
  stages: StageCompletionSummary[],
  activities: ActivityCompletionSummary[],
): LessonCompletionMetrics {
  const requiredStages = stages.filter(
    (stage) => stage.required,
  );
  const requiredActivities = activities.filter(
    (activity) => activity.required,
  );
  const requiredObjectives = objectives.filter(
    (objective) => objective.required,
  );

  const totalAttempts = activities.reduce(
    (sum, activity) => sum + activity.attempts,
    0,
  );
  const successfulAttempts = activities.reduce(
    (sum, activity) =>
      sum + activity.successfulAttempts,
    0,
  );

  const activityCompletion =
    requiredActivities.length > 0
      ? (requiredActivities.filter(
          (activity) =>
            activity.completed &&
            activity.successRuleSatisfied,
        ).length /
          requiredActivities.length) *
        100
      : 100;

  const stageCompletion =
    requiredStages.length > 0
      ? (requiredStages.filter((stage) => stage.completed)
          .length /
          requiredStages.length) *
        100
      : 100;

  const objectiveCompletion =
    requiredObjectives.length > 0
      ? (requiredObjectives.filter(
          (objective) => objective.mastered,
        ).length /
          requiredObjectives.length) *
        100
      : 100;

  const assessmentCompletion =
    lesson.completionCriteria.requireAssessmentCompletion
      ? session.assessment.status === "passed"
        ? 100
        : session.assessment.status === "failed"
          ? 50
          : 0
      : 100;

  const completionPercentage = round(
    weightedAverage([
      { value: objectiveCompletion, weight: 0.35 },
      { value: activityCompletion, weight: 0.3 },
      { value: stageCompletion, weight: 0.2 },
      { value: assessmentCompletion, weight: 0.15 },
    ]),
  );

  const overallObjectiveMastery = round(
    weightedAverage(
      lesson.objectives.map((objective) => ({
        value:
          session.objectiveStates[objective.id]?.masteryScore ??
          0,
        weight: objectiveWeight(objective),
      })),
    ),
  );

  const requiredObjectiveMastery = round(
    average(
      requiredObjectives.map(
        (objective) => objective.masteryScore,
      ),
    ),
  );

  const activityScore = average(
    activities
      .map((activity) => activity.bestScore)
      .filter((score): score is number => score !== undefined),
  );

  const assessmentScore =
    session.assessment.score ??
    (lesson.completionCriteria.requireAssessmentCompletion
      ? 0
      : overallObjectiveMastery);

  const overallLessonScore = round(
    weightedAverage([
      { value: overallObjectiveMastery, weight: 0.5 },
      { value: activityScore, weight: 0.3 },
      { value: assessmentScore, weight: 0.2 },
    ]),
  );

  return {
    completionPercentage,
    overallLessonScore,
    overallObjectiveMastery,
    requiredObjectiveMastery,

    completedRequiredStages: requiredStages.filter(
      (stage) => stage.completed,
    ).length,
    totalRequiredStages: requiredStages.length,

    completedRequiredActivities: requiredActivities.filter(
      (activity) =>
        activity.completed &&
        activity.successRuleSatisfied,
    ).length,
    totalRequiredActivities: requiredActivities.length,

    masteredRequiredObjectives: requiredObjectives.filter(
      (objective) => objective.mastered,
    ).length,
    totalRequiredObjectives: requiredObjectives.length,

    speakingParticipationCount:
      speakingParticipationCount(lesson, session),

    totalAttempts,
    successfulAttempts,
    successRate:
      totalAttempts > 0
        ? round((successfulAttempts / totalAttempts) * 100)
        : 0,

    totalSupportUses: activities.reduce(
      (sum, activity) => sum + activity.supportUses,
      0,
    ),
    highSupportActivityCount: activities.filter(
      (activity) => activity.highestSupportLevel >= 3,
    ).length,
  };
}

function determineRecommendation(
  blockers: LessonCompletionBlocker[],
  assessment: AssessmentCompletionSummary,
): LessonCompletionRecommendation {
  if (blockers.length === 0) {
    return "complete_lesson";
  }

  if (
    blockers.some(
      (blocker) =>
        blocker.code === "UNMET_PREREQUISITE",
    )
  ) {
    return "review_prerequisites";
  }

  if (
    blockers.some(
      (blocker) =>
        blocker.code === "ASSESSMENT_FAILED" ||
        blocker.code === "ASSESSMENT_SCORE_TOO_LOW" ||
        blocker.code === "ASSESSMENT_NOT_COMPLETED",
    )
  ) {
    return assessment.retryAllowed
      ? "repeat_assessment"
      : "request_human_support";
  }

  if (
    blockers.some(
      (blocker) =>
        blocker.code === "REQUIRED_ACTIVITY_NOT_COMPLETED" ||
        blocker.code === "REQUIRED_ACTIVITY_SKIPPED",
    )
  ) {
    return "repeat_required_activity";
  }

  if (
    blockers.some(
      (blocker) =>
        blocker.code === "REQUIRED_OBJECTIVE_NOT_MASTERED" ||
        blocker.code === "OBJECTIVE_THRESHOLD_NOT_REACHED",
    )
  ) {
    return "review_objectives";
  }

  if (
    blockers.some(
      (blocker) =>
        blocker.code === "EXCESSIVE_SUPPORT_DEPENDENCE",
    )
  ) {
    return "reduce_support_and_reassess";
  }

  if (
    blockers.some(
      (blocker) =>
        blocker.severity === "critical" &&
        !blocker.recoverable,
    )
  ) {
    return "request_human_support";
  }

  return "continue_current_activity";
}

function completionReason(
  status: LessonCompletionStatus,
  blockers: LessonCompletionBlocker[],
): string {
  switch (status) {
    case "ready":
      return "All required completion criteria have been satisfied.";

    case "ready_with_minor_gaps":
      return "The lesson may be completed because only permitted minor gaps remain.";

    case "already_completed":
      return "The teaching session is already completed.";

    case "requires_human_review":
      return "The lesson requires a human decision before progression.";

    case "blocked":
      return (
        blockers[0]?.message ??
        "Lesson completion is blocked by a critical requirement."
      );

    case "not_ready":
    default:
      return (
        blockers[0]?.message ??
        "The learner is not yet ready to complete the lesson."
      );
  }
}

function buildStrengths(
  objectives: ObjectiveCompletionSummary[],
  activities: ActivityCompletionSummary[],
  assessment: AssessmentCompletionSummary,
): string[] {
  const strengths: string[] = [];

  for (const objective of objectives
    .filter((item) => item.mastered)
    .sort(
      (left, right) =>
        right.masteryScore - left.masteryScore,
    )
    .slice(0, 3)) {
    strengths.push(
      `${objective.statement} (${round(
        objective.masteryScore,
      )}% mastery)`,
    );
  }

  const strongestActivity = [...activities]
    .filter(
      (activity) => activity.bestScore !== undefined,
    )
    .sort(
      (left, right) =>
        (right.bestScore ?? 0) - (left.bestScore ?? 0),
    )[0];

  if (strongestActivity) {
    strengths.push(
      `Strong performance in ${strongestActivity.title}.`,
    );
  }

  if (assessment.passed && assessment.score !== undefined) {
    strengths.push(
      `Passed the lesson assessment with ${round(
        assessment.score,
      )}%.`,
    );
  }

  return unique(strengths).slice(0, 5);
}

function buildImprovementAreas(
  blockers: LessonCompletionBlocker[],
  objectives: ObjectiveCompletionSummary[],
  activities: ActivityCompletionSummary[],
): string[] {
  const areas: string[] = [];

  for (const blocker of blockers) {
    if (blocker.objectiveId) {
      const objective = objectives.find(
        (item) => item.objectiveId === blocker.objectiveId,
      );
      if (objective) areas.push(objective.statement);
    }

    if (blocker.activityId) {
      const activity = activities.find(
        (item) => item.activityId === blocker.activityId,
      );
      if (activity) areas.push(activity.title);
    }
  }

  return unique(areas).slice(0, 6);
}

/* -------------------------------------------------------------------------- */
/*                              Error Mapping                                 */
/* -------------------------------------------------------------------------- */

function toTeachingBrainError(
  error: unknown,
  input?: Partial<EvaluateLessonCompletionInput>,
): TeachingBrainError {
  if (error instanceof LessonCompletionEngineError) {
    return {
      code:
        error.code === "SESSION_ALREADY_COMPLETED"
          ? "SESSION_ALREADY_COMPLETED"
          : error.code === "LESSON_SESSION_MISMATCH"
            ? "INVALID_SESSION"
            : error.code === "OBJECTIVE_STATE_MISSING"
              ? "OBJECTIVE_NOT_FOUND"
              : error.code === "STAGE_STATE_MISSING"
                ? "STAGE_NOT_FOUND"
                : error.code === "ACTIVITY_STATE_MISSING"
                  ? "ACTIVITY_NOT_FOUND"
                  : "INTERNAL_ERROR",
      message: error.message,
      lessonId: input?.lesson?.id,
      sessionId: input?.session?.id,
      recoverable: error.recoverable,
      details: error.details,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message:
      error instanceof Error
        ? error.message
        : "An unknown lesson completion error occurred.",
    lessonId: input?.lesson?.id,
    sessionId: input?.session?.id,
    recoverable: true,
    details: {
      cause:
        error instanceof Error
          ? error.name
          : String(error),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                         Main Completion Engine                             */
/* -------------------------------------------------------------------------- */

export class TeachingLessonCompletionEngine {
  private readonly config: Required<
    Omit<LessonCompletionEngineConfig, "now">
  > &
    Pick<LessonCompletionEngineConfig, "now">;

  constructor(config: LessonCompletionEngineConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      now: config.now,
    };

    this.validateConfig();
  }

  evaluate(
    input: EvaluateLessonCompletionInput,
  ): LessonCompletionEvaluation {
    this.validateInput(input);

    const evaluatedAt = nowIso(
      this.config,
      input.evaluatedAt,
    );

    const objectives = buildObjectiveSummaries(
      input.lesson,
      input.session,
    );
    const stages = buildStageSummaries(
      input.lesson,
      input.session,
    );
    const activities = buildActivitySummaries(
      input.lesson,
      input.session,
    );
    const assessment = buildAssessmentSummary(
      input.lesson,
      input.session,
    );
    const metrics = buildMetrics(
      input.lesson,
      input.session,
      objectives,
      stages,
      activities,
    );

    const blockers: LessonCompletionBlocker[] = [];

    if (
      input.session.status === "created" &&
      !input.finalCheck
    ) {
      blockers.push(
        makeBlocker(
          "SESSION_NOT_STARTED",
          "major",
          "The teaching session has not started.",
          {
            currentValue: input.session.status,
            requiredValue: "active or paused",
            recoverable: true,
          },
        ),
      );
    }

    blockers.push(
      ...evaluateObjectiveBlockers(
        input.lesson,
        objectives,
      ),
      ...evaluateStageBlockers(stages),
      ...evaluateActivityBlockers(activities),
      ...evaluateAssessmentBlockers(
        input.lesson,
        assessment,
      ),
      ...evaluateParticipationBlockers(
        input.lesson,
        metrics,
        this.config,
      ),
      ...evaluateSupportAndFailureBlockers(
        activities,
        this.config,
      ),
    );

    if (
      metrics.overallLessonScore <
      input.lesson.completionCriteria.minimumLessonScore
    ) {
      blockers.push(
        makeBlocker(
          "LESSON_SCORE_TOO_LOW",
          "major",
          "The overall lesson score is below the completion threshold.",
          {
            currentValue: metrics.overallLessonScore,
            requiredValue:
              input.lesson.completionCriteria.minimumLessonScore,
            recoverable: true,
          },
        ),
      );
    }

    if (
      metrics.requiredObjectiveMastery <
      input.lesson.completionCriteria.minimumObjectiveMastery
    ) {
      blockers.push(
        makeBlocker(
          "OBJECTIVE_MASTERY_TOO_LOW",
          "major",
          "Required-objective mastery is below the lesson completion threshold.",
          {
            currentValue:
              metrics.requiredObjectiveMastery,
            requiredValue:
              input.lesson.completionCriteria.minimumObjectiveMastery,
            recoverable: true,
          },
        ),
      );
    }

    const deduplicated = Array.from(
      new Map(
        blockers.map((blocker) => [
          [
            blocker.code,
            blocker.objectiveId,
            blocker.stageId,
            blocker.activityId,
            blocker.assessmentCriterionId,
          ].join(":"),
          blocker,
        ]),
      ).values(),
    );

    const minorGaps = deduplicated.filter(
      (blocker) => blocker.severity === "minor",
    );
    let majorBlockers = deduplicated.filter(
      (blocker) => blocker.severity !== "minor",
    );

    const override = input.teacherOverride;

    if (override?.approved) {
      if (
        this.config.allowTeacherOverrideForMinorGaps &&
        minorGaps.length > 0
      ) {
        // Minor gaps remain visible in the result but do not block.
      }

      if (
        override.allowMajorGaps &&
        this.config.allowTeacherOverrideForMajorGaps
      ) {
        majorBlockers = majorBlockers.filter(
          (blocker) => blocker.severity === "critical",
        );
      }
    }

    const onlyMinorGaps =
      majorBlockers.length === 0 &&
      minorGaps.length > 0;

    const minorGapsAllowed =
      input.lesson.completionCriteria
        .allowCompletionWithMinorGaps ||
      Boolean(
        override?.approved &&
          this.config.allowTeacherOverrideForMinorGaps,
      );

    let canComplete =
      majorBlockers.length === 0 &&
      (minorGaps.length === 0 ||
        (onlyMinorGaps && minorGapsAllowed));

    if (
      input.session.status === "completed" &&
      this.config.allowCompletedSessionReevaluation
    ) {
      canComplete = true;
    }

    const passed =
      canComplete &&
      metrics.overallLessonScore >=
        input.lesson.completionCriteria.minimumLessonScore &&
      metrics.requiredObjectiveMastery >=
        input.lesson.completionCriteria.minimumObjectiveMastery &&
      (!assessment.required || assessment.passed);

    let status: LessonCompletionStatus;

    if (input.session.status === "completed") {
      status = "already_completed";
    } else if (canComplete && minorGaps.length > 0) {
      status = "ready_with_minor_gaps";
    } else if (canComplete) {
      status = "ready";
    } else if (
      majorBlockers.some(
        (blocker) =>
          blocker.severity === "critical" &&
          !blocker.recoverable,
      )
    ) {
      status = "requires_human_review";
    } else if (
      majorBlockers.some(
        (blocker) => blocker.severity === "critical",
      )
    ) {
      status = "blocked";
    } else {
      status = "not_ready";
    }

    const recommendedReviewObjectiveIds = unique(
      deduplicated
        .map((blocker) => blocker.objectiveId)
        .filter((value): value is string => Boolean(value)),
    );

    const recommendedReviewActivityIds = unique([
      ...deduplicated
        .map((blocker) => blocker.activityId)
        .filter((value): value is string => Boolean(value)),
      ...objectives
        .filter(
          (objective) =>
            recommendedReviewObjectiveIds.includes(
              objective.objectiveId,
            ),
        )
        .flatMap(
          (objective) => objective.evidenceActivityIds,
        ),
    ]);

    const recommendedPrerequisiteObjectiveIds = unique(
      objectives.flatMap(
        (objective) =>
          objective.unmetPrerequisiteObjectiveIds,
      ),
    );

    const masteredObjectiveIds = objectives
      .filter((objective) => objective.mastered)
      .map((objective) => objective.objectiveId);

    const developingObjectiveIds = objectives
      .filter(
        (objective) =>
          !objective.mastered &&
          objective.masteryScore > 0,
      )
      .map((objective) => objective.objectiveId);

    const unmetObjectiveIds = objectives
      .filter(
        (objective) =>
          objective.required && !objective.mastered,
      )
      .map((objective) => objective.objectiveId);

    const recommendation = canComplete
      ? "complete_lesson"
      : determineRecommendation(
          deduplicated,
          assessment,
        );

    const strengths = buildStrengths(
      objectives,
      activities,
      assessment,
    );
    const improvementAreas = buildImprovementAreas(
      deduplicated,
      objectives,
      activities,
    );

    const completionResult: LessonCompletionResult | undefined =
      canComplete
        ? {
            sessionId: input.session.id,
            lessonId: input.lesson.id,
            learnerId: input.session.learnerId,
            completed: true,
            passed,
            finalScore: metrics.overallLessonScore,
            completionPercentage:
              metrics.completionPercentage,
            masteredObjectiveIds,
            developingObjectiveIds,
            unmetObjectiveIds,
            strengths,
            improvementAreas,
            recommendedReviewActivityIds,
            recommendedNextLessonId:
              input.recommendedNextLessonId,
            completedAt: evaluatedAt,
          }
        : undefined;

    return {
      sessionId: input.session.id,
      lessonId: input.lesson.id,
      learnerId: input.session.learnerId,

      status,
      canComplete,
      passed,

      completionReason: completionReason(
        status,
        deduplicated,
      ),

      blockers: majorBlockers,
      minorGaps,

      objectives,
      stages,
      activities,
      assessment,
      metrics,

      masteredObjectiveIds,
      developingObjectiveIds,
      unmetObjectiveIds,

      strengths,
      improvementAreas,

      recommendedNextAction: recommendation,
      recommendedReviewObjectiveIds,
      recommendedReviewActivityIds,
      recommendedPrerequisiteObjectiveIds,

      completionResult,
      evaluatedAt,

      metadata: {
        finalCheck: input.finalCheck ?? false,
        teacherOverride: input.teacherOverride,
        ...input.metadata,
      },
    };
  }

  safeEvaluate(
    input: EvaluateLessonCompletionInput,
  ): SafeLessonCompletionResult {
    try {
      return {
        ok: true,
        data: this.evaluate(input),
      };
    } catch (error) {
      return {
        ok: false,
        error: toTeachingBrainError(error, input),
      };
    }
  }

  private validateConfig(): void {
    if (
      this.config.minimumSpeakingParticipationCount < 0 ||
      this.config.minimumSuccessfulAttempts < 0 ||
      this.config.maximumHighSupportActivities < 0 ||
      this.config.persistentFailureAttempts < 1
    ) {
      throw new LessonCompletionEngineError(
        "INVALID_COMPLETION_POLICY",
        "Lesson completion count settings are invalid.",
        { recoverable: false },
      );
    }

    if (
      this.config.excessiveSupportRatio < 0 ||
      this.config.excessiveSupportRatio > 1 ||
      this.config.persistentFailureSuccessRate < 0 ||
      this.config.persistentFailureSuccessRate > 1
    ) {
      throw new LessonCompletionEngineError(
        "INVALID_COMPLETION_POLICY",
        "Lesson completion ratio settings must be between 0 and 1.",
        { recoverable: false },
      );
    }
  }

  private validateInput(
    input: EvaluateLessonCompletionInput,
  ): void {
    if (!input.lesson?.id || !input.session?.id) {
      throw new LessonCompletionEngineError(
        "INVALID_INPUT",
        "A valid lesson and teaching session are required.",
      );
    }

    if (input.session.lessonId !== input.lesson.id) {
      throw new LessonCompletionEngineError(
        "LESSON_SESSION_MISMATCH",
        `Session lesson "${input.session.lessonId}" does not match lesson "${input.lesson.id}".`,
      );
    }

    if (
      input.session.status === "completed" &&
      !this.config.allowCompletedSessionReevaluation
    ) {
      throw new LessonCompletionEngineError(
        "SESSION_ALREADY_COMPLETED",
        `Session "${input.session.id}" is already completed.`,
        { recoverable: false },
      );
    }

    if (
      isTerminalStatus(input.session.status) &&
      input.session.status !== "completed"
    ) {
      throw new LessonCompletionEngineError(
        "SESSION_TERMINAL",
        `Session "${input.session.id}" is ${input.session.status} and cannot be completed.`,
        {
          recoverable: false,
          details: {
            status: input.session.status,
          },
        },
      );
    }

    for (const objective of input.lesson.objectives) {
      if (!input.session.objectiveStates[objective.id]) {
        throw new LessonCompletionEngineError(
          "OBJECTIVE_STATE_MISSING",
          `Runtime state for objective "${objective.id}" is missing.`,
        );
      }
    }

    for (const stage of input.lesson.stages) {
      if (!input.session.stageStates[stage.id]) {
        throw new LessonCompletionEngineError(
          "STAGE_STATE_MISSING",
          `Runtime state for stage "${stage.id}" is missing.`,
        );
      }

      for (const activity of stage.activities) {
        if (!input.session.activityStates[activity.id]) {
          throw new LessonCompletionEngineError(
            "ACTIVITY_STATE_MISSING",
            `Runtime state for activity "${activity.id}" is missing.`,
          );
        }
      }
    }

    for (const requiredObjectiveId of input.lesson
      .completionCriteria.requiredObjectiveIds) {
      if (
        !input.lesson.objectives.some(
          (objective) =>
            objective.id === requiredObjectiveId,
        )
      ) {
        throw new LessonCompletionEngineError(
          "INVALID_COMPLETION_POLICY",
          `Completion criteria reference unknown objective "${requiredObjectiveId}".`,
          { recoverable: false },
        );
      }
    }

    for (const requiredActivityId of input.lesson
      .completionCriteria.requiredActivityIds ?? []) {
      if (!activityById(input.lesson, requiredActivityId)) {
        throw new LessonCompletionEngineError(
          "INVALID_COMPLETION_POLICY",
          `Completion criteria reference unknown activity "${requiredActivityId}".`,
          { recoverable: false },
        );
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                           Functional API                                   */
/* -------------------------------------------------------------------------- */

export function createLessonCompletionEngine(
  config: LessonCompletionEngineConfig = {},
): TeachingLessonCompletionEngine {
  return new TeachingLessonCompletionEngine(config);
}

export function evaluateLessonCompletion(
  input: EvaluateLessonCompletionInput,
  config: LessonCompletionEngineConfig = {},
): LessonCompletionEvaluation {
  return new TeachingLessonCompletionEngine(config).evaluate(
    input,
  );
}

export function safeEvaluateLessonCompletion(
  input: EvaluateLessonCompletionInput,
  config: LessonCompletionEngineConfig = {},
): SafeLessonCompletionResult {
  return new TeachingLessonCompletionEngine(
    config,
  ).safeEvaluate(input);
}

/**
 * Converts the completion evaluation into a command that the integration
 * service can apply through TeachingSessionEngine.complete() or by continuing
 * the current session with review recommendations.
 */
export function lessonCompletionToSessionCommand(
  evaluation: LessonCompletionEvaluation,
): LessonCompletionSessionCommand {
  if (
    evaluation.canComplete &&
    evaluation.completionResult
  ) {
    return {
      type: "complete_session",
      occurredAt: evaluation.evaluatedAt,
      finalScore:
        evaluation.completionResult.finalScore,
      completionPercentage:
        evaluation.completionResult.completionPercentage,
      reason: evaluation.completionReason,
      result: evaluation.completionResult,
    };
  }

  return {
    type: "continue_session",
    recommendedAction:
      evaluation.recommendedNextAction,
    reviewObjectiveIds:
      evaluation.recommendedReviewObjectiveIds,
    reviewActivityIds:
      evaluation.recommendedReviewActivityIds,
    reason: evaluation.completionReason,
  };
}

/**
 * Returns the next required review activity, prioritising direct blockers,
 * then activities that provided evidence for unmet objectives.
 */
export function findNextReviewActivity(
  lesson: TeachingBrainLesson,
  evaluation: LessonCompletionEvaluation,
): TeachingActivity | undefined {
  for (const activityId of evaluation.recommendedReviewActivityIds) {
    const found = activityById(lesson, activityId);
    if (found) return found.activity;
  }

  return undefined;
}

export const LessonCompletionService = {
  create: createLessonCompletionEngine,
  evaluate: evaluateLessonCompletion,
  safeEvaluate: safeEvaluateLessonCompletion,
  toSessionCommand: lessonCompletionToSessionCommand,
  findNextReviewActivity,
};
