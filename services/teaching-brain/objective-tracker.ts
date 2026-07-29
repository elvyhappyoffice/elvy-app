/**
 * Elvy Teaching Brain
 * Objective mastery tracker
 *
 * File: services/teaching-brain/objective-tracker.ts
 *
 * Responsibilities:
 * - map learner-response evidence to lesson objectives
 * - calculate weighted objective mastery updates
 * - distinguish exposure, progress, mastery, and support needs
 * - protect required objectives from accidental completion
 * - produce Session Engine objective-update commands
 * - provide lesson-wide objective summaries and recommendations
 *
 * Deliberately excluded:
 * - evaluating the learner response (response-evaluator.ts)
 * - selecting the next pedagogical action (decision-engine.ts)
 * - deciding final lesson completion (lesson-completion.ts)
 * - mutating session state directly (session-engine.ts)
 */

import type {
  CorrectionFocus,
  EvaluationGrade,
  FluencyGrade,
  PronunciationGrade,
  ResponseEvaluation,
  TeachingActivity,
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
  TeachingObjective,
  TeachingObjectiveType,
} from "./types";

import type {
  ObjectiveRuntimeState,
  TeachingSessionState,
  UpdateObjectiveInput,
} from "./session-engine";

/* -------------------------------------------------------------------------- */
/*                               Public Types                                 */
/* -------------------------------------------------------------------------- */

export type ObjectiveEvidenceSource =
  | "response_evaluation"
  | "activity_completion"
  | "assessment"
  | "teacher_observation"
  | "self_assessment"
  | "imported";

export type ObjectiveEvidenceStrength =
  | "weak"
  | "moderate"
  | "strong"
  | "decisive";

export type ObjectiveMasteryBand =
  | "not_started"
  | "emerging"
  | "developing"
  | "nearly_mastered"
  | "mastered"
  | "secure";

export type ObjectiveRisk =
  | "none"
  | "low"
  | "moderate"
  | "high"
  | "critical";

export type ObjectiveEvidence = {
  id: string;
  objectiveId: string;
  source: ObjectiveEvidenceSource;

  activityId?: string;
  learnerTurnId?: string;
  assessmentId?: string;

  score: number;
  success: boolean;
  confidence: number;
  strength: ObjectiveEvidenceStrength;

  focusScores?: Partial<Record<CorrectionFocus, number>>;
  detectedErrorCount?: number;
  majorErrorCount?: number;

  supportLevelUsed?: number;
  independent: boolean;

  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export type ObjectiveMasteryUpdate = {
  objectiveId: string;
  objective: TeachingObjective;

  previous: ObjectiveRuntimeState;
  next: ObjectiveRuntimeState;

  evidence: ObjectiveEvidence;

  scoreDelta: number;
  progressDelta: number;

  thresholdReached: boolean;
  newlyMastered: boolean;
  masteryMaintained: boolean;
  regressed: boolean;

  band: ObjectiveMasteryBand;
  risk: ObjectiveRisk;

  recommendedAction:
    | "continue"
    | "increase_challenge"
    | "provide_support"
    | "review_prerequisite"
    | "collect_more_evidence"
    | "reassess"
    | "protect_mastery";

  reasons: string[];
};

export type ObjectiveTrackingResult = {
  updates: ObjectiveMasteryUpdate[];
  sessionCommands: UpdateObjectiveInput[];

  affectedObjectiveIds: string[];
  masteredObjectiveIds: string[];
  needsSupportObjectiveIds: string[];
  prerequisiteReviewObjectiveIds: string[];

  overallMasteryScore: number;
  requiredObjectiveMasteryScore: number;
  requiredObjectivesMastered: boolean;

  createdAt: string;
};

export type ObjectiveSummaryItem = {
  objectiveId: string;
  statement: string;
  type: TeachingObjectiveType;
  required: boolean;
  priority: TeachingObjective["priority"];

  masteryScore: number;
  progress: number;
  attempts: number;
  successes: number;
  successRate: number;

  status: ObjectiveRuntimeState["status"];
  band: ObjectiveMasteryBand;
  risk: ObjectiveRisk;

  threshold: number;
  evidenceActivityIds: string[];

  prerequisiteObjectiveIds: string[];
  unmetPrerequisiteObjectiveIds: string[];

  recommendedAction:
    ObjectiveMasteryUpdate["recommendedAction"];
};

export type ObjectiveTrackerSummary = {
  objectives: ObjectiveSummaryItem[];

  overallMasteryScore: number;
  requiredObjectiveMasteryScore: number;
  optionalObjectiveMasteryScore: number;

  masteredCount: number;
  needsSupportCount: number;
  notStartedCount: number;

  requiredObjectivesMastered: boolean;
  lessonMasteryReady: boolean;

  weakestObjectiveIds: string[];
  strongestObjectiveIds: string[];
  prerequisiteReviewObjectiveIds: string[];

  generatedAt: string;
};

export type TrackResponseInput = {
  lesson: TeachingBrainLesson;
  session: TeachingSessionState;
  evaluation: ResponseEvaluation;

  activity?: TeachingActivity;
  objectiveIds?: string[];

  supportLevelUsed?: number;
  independent?: boolean;

  previousEvidence?: ObjectiveEvidence[];

  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

export type RecordObjectiveEvidenceInput = {
  lesson: TeachingBrainLesson;
  session: TeachingSessionState;

  objectiveId: string;
  source: ObjectiveEvidenceSource;

  score: number;
  confidence?: number;
  success?: boolean;
  strength?: ObjectiveEvidenceStrength;

  activityId?: string;
  learnerTurnId?: string;
  assessmentId?: string;

  focusScores?: Partial<Record<CorrectionFocus, number>>;
  detectedErrorCount?: number;
  majorErrorCount?: number;

  supportLevelUsed?: number;
  independent?: boolean;

  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

export type ObjectiveTrackerConfig = {
  /**
   * Percentage of the new mastery value contributed by new evidence.
   * A value of 0.35 means 35% new evidence and 65% prior mastery.
   */
  baseEvidenceWeight?: number;

  minimumEvidenceWeight?: number;
  maximumEvidenceWeight?: number;

  supportPenaltyPerLevel?: number;
  majorErrorPenalty?: number;
  repeatedEvidencePenalty?: number;

  confidenceFloor?: number;
  masteryRetentionFloor?: number;

  secureMasteryMargin?: number;
  nearlyMasteredMargin?: number;

  needsSupportScore?: number;
  minimumAttemptsBeforeNeedsSupport?: number;
  minimumIndependentSuccessesForMastery?: number;

  requiredObjectiveWeight?: number;
  importantObjectiveWeight?: number;
  extensionObjectiveWeight?: number;

  allowMasteryRegression?: boolean;
  protectMasteryAfterIndependentSuccess?: boolean;

  now?: () => string;
};

export type SafeObjectiveTrackingResult =
  TeachingBrainResult<ObjectiveTrackingResult>;

export type SafeObjectiveSummaryResult =
  TeachingBrainResult<ObjectiveTrackerSummary>;

export type ObjectiveTrackerErrorCode =
  | "INVALID_INPUT"
  | "LESSON_SESSION_MISMATCH"
  | "ACTIVITY_NOT_FOUND"
  | "OBJECTIVE_NOT_FOUND"
  | "OBJECTIVE_STATE_MISSING"
  | "EVALUATION_OBJECTIVE_MISMATCH"
  | "TRACKING_FAILED";

export class ObjectiveTrackerError extends Error {
  readonly code: ObjectiveTrackerErrorCode;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ObjectiveTrackerErrorCode,
    message: string,
    options?: {
      recoverable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "ObjectiveTrackerError";
    this.code = code;
    this.recoverable = options?.recoverable ?? true;
    this.details = options?.details;
  }
}

/* -------------------------------------------------------------------------- */
/*                               Defaults                                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_CONFIG: Required<Omit<ObjectiveTrackerConfig, "now">> = {
  baseEvidenceWeight: 0.35,
  minimumEvidenceWeight: 0.12,
  maximumEvidenceWeight: 0.65,

  supportPenaltyPerLevel: 0.06,
  majorErrorPenalty: 5,
  repeatedEvidencePenalty: 0.05,

  confidenceFloor: 0.35,
  masteryRetentionFloor: 0.7,

  secureMasteryMargin: 10,
  nearlyMasteredMargin: 10,

  needsSupportScore: 40,
  minimumAttemptsBeforeNeedsSupport: 2,
  minimumIndependentSuccessesForMastery: 1,

  requiredObjectiveWeight: 1.5,
  importantObjectiveWeight: 1,
  extensionObjectiveWeight: 0.65,

  allowMasteryRegression: true,
  protectMasteryAfterIndependentSuccess: true,
};

/* -------------------------------------------------------------------------- */
/*                               Utilities                                    */
/* -------------------------------------------------------------------------- */

function createId(prefix: string): string {
  const value =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

  return `${prefix}-${value}`;
}

function nowIso(
  config: ObjectiveTrackerConfig,
  explicit?: string,
): string {
  const raw = explicit ?? config.now?.() ?? new Date().toISOString();
  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function clamp(
  value: number,
  minimum = 0,
  maximum = 100,
): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value > 1 ? clamp(value / 100, 0, 1) : clamp(value, 0, 1);
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

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
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

function cloneRuntime(
  runtime: ObjectiveRuntimeState,
): ObjectiveRuntimeState {
  return {
    ...runtime,
    evidenceActivityIds: [...runtime.evidenceActivityIds],
  };
}

function findActivity(
  lesson: TeachingBrainLesson,
  activityId: string,
): TeachingActivity | undefined {
  for (const stage of lesson.stages) {
    const activity = stage.activities.find(
      (candidate) => candidate.id === activityId,
    );

    if (activity) return activity;
  }

  return undefined;
}

function objectiveWeight(
  objective: TeachingObjective,
  config: Required<Omit<ObjectiveTrackerConfig, "now">>,
): number {
  if (objective.required || objective.priority === "essential") {
    return config.requiredObjectiveWeight;
  }

  if (objective.priority === "important") {
    return config.importantObjectiveWeight;
  }

  return config.extensionObjectiveWeight;
}

function gradeToScore(
  grade: EvaluationGrade,
): number {
  switch (grade) {
    case "correct":
      return 100;
    case "minor_error":
      return 85;
    case "partial":
      return 62;
    case "major_error":
      return 35;
    case "incorrect":
      return 20;
    case "not_checked":
      return 50;
    default:
      return 50;
  }
}

function pronunciationToScore(
  grade: PronunciationGrade,
): number {
  switch (grade) {
    case "clear":
      return 100;
    case "understandable":
      return 80;
    case "needs_support":
      return 58;
    case "unclear":
      return 28;
    case "not_checked":
      return 50;
    default:
      return 50;
  }
}

function fluencyToScore(
  grade: FluencyGrade,
): number {
  switch (grade) {
    case "fluent":
      return 100;
    case "mostly_fluent":
      return 82;
    case "hesitant":
      return 60;
    case "very_hesitant":
      return 35;
    case "not_checked":
      return 50;
    default:
      return 50;
  }
}

function scoreForObjectiveType(
  objective: TeachingObjective,
  evaluation: ResponseEvaluation,
): {
  score: number;
  focusScores: Partial<Record<CorrectionFocus, number>>;
} {
  const meaning = gradeToScore(evaluation.meaning);
  const grammar = gradeToScore(evaluation.grammar);
  const vocabulary = gradeToScore(evaluation.vocabulary);
  const pronunciation = pronunciationToScore(
    evaluation.pronunciation,
  );
  const fluency = fluencyToScore(evaluation.fluency);
  const spelling = gradeToScore(evaluation.spelling);
  const punctuation = gradeToScore(evaluation.punctuation);

  const focusScores: Partial<Record<CorrectionFocus, number>> = {
    meaning,
    grammar,
    vocabulary,
    pronunciation,
    fluency,
    spelling,
    punctuation,
  };

  switch (objective.type) {
    case "grammar":
      return {
        score: weightedAverage([
          { value: grammar, weight: 0.65 },
          { value: meaning, weight: 0.2 },
          { value: evaluation.score, weight: 0.15 },
        ]),
        focusScores,
      };

    case "vocabulary":
      return {
        score: weightedAverage([
          { value: vocabulary, weight: 0.65 },
          { value: meaning, weight: 0.2 },
          { value: evaluation.score, weight: 0.15 },
        ]),
        focusScores,
      };

    case "pronunciation":
      return {
        score: weightedAverage([
          { value: pronunciation, weight: 0.75 },
          { value: fluency, weight: 0.15 },
          { value: evaluation.score, weight: 0.1 },
        ]),
        focusScores,
      };

    case "speaking":
    case "interaction":
      return {
        score: weightedAverage([
          { value: meaning, weight: 0.35 },
          { value: fluency, weight: 0.25 },
          { value: pronunciation, weight: 0.2 },
          { value: grammar, weight: 0.1 },
          { value: vocabulary, weight: 0.1 },
        ]),
        focusScores,
      };

    case "writing":
      return {
        score: weightedAverage([
          { value: meaning, weight: 0.3 },
          { value: grammar, weight: 0.25 },
          { value: vocabulary, weight: 0.2 },
          { value: spelling, weight: 0.15 },
          { value: punctuation, weight: 0.1 },
        ]),
        focusScores,
      };

    case "listening":
    case "reading":
    case "comprehension":
      return {
        score: weightedAverage([
          { value: meaning, weight: 0.7 },
          { value: evaluation.score, weight: 0.3 },
        ]),
        focusScores,
      };

    case "function":
      return {
        score: weightedAverage([
          { value: meaning, weight: 0.5 },
          { value: vocabulary, weight: 0.2 },
          { value: grammar, weight: 0.15 },
          { value: evaluation.score, weight: 0.15 },
        ]),
        focusScores,
      };

    case "knowledge":
    case "culture":
    case "study_skill":
    case "custom":
    default:
      return {
        score: weightedAverage([
          { value: meaning, weight: 0.55 },
          { value: evaluation.score, weight: 0.45 },
        ]),
        focusScores,
      };
  }
}

function evidenceStrength(
  score: number,
  confidence: number,
  independent: boolean,
  supportLevelUsed: number,
): ObjectiveEvidenceStrength {
  const effective =
    score *
    (0.65 + 0.35 * confidence) *
    (independent ? 1 : 0.85) *
    Math.max(0.65, 1 - supportLevelUsed * 0.07);

  if (effective >= 88) return "decisive";
  if (effective >= 72) return "strong";
  if (effective >= 50) return "moderate";
  return "weak";
}

function strengthMultiplier(
  strength: ObjectiveEvidenceStrength,
): number {
  switch (strength) {
    case "decisive":
      return 1.25;
    case "strong":
      return 1;
    case "moderate":
      return 0.75;
    case "weak":
      return 0.5;
    default:
      return 0.75;
  }
}

function repeatedEvidenceCount(
  evidence: ObjectiveEvidence[],
  objectiveId: string,
  activityId?: string,
): number {
  return evidence.filter(
    (item) =>
      item.objectiveId === objectiveId &&
      item.activityId === activityId,
  ).length;
}

function calculateEvidenceWeight(
  evidence: ObjectiveEvidence,
  repeatedCount: number,
  config: Required<Omit<ObjectiveTrackerConfig, "now">>,
): number {
  const confidenceFactor = Math.max(
    config.confidenceFloor,
    evidence.confidence,
  );

  const supportFactor = Math.max(
    0.45,
    1 - evidence.supportLevelUsed! * config.supportPenaltyPerLevel,
  );

  const independenceFactor = evidence.independent ? 1 : 0.82;

  const repetitionFactor = Math.max(
    0.6,
    1 - repeatedCount * config.repeatedEvidencePenalty,
  );

  return clamp(
    config.baseEvidenceWeight *
      strengthMultiplier(evidence.strength) *
      confidenceFactor *
      supportFactor *
      independenceFactor *
      repetitionFactor,
    config.minimumEvidenceWeight,
    config.maximumEvidenceWeight,
  );
}

function independentSuccessCount(
  existing: ObjectiveEvidence[],
  newEvidence: ObjectiveEvidence,
): number {
  return (
    existing.filter(
      (item) =>
        item.objectiveId === newEvidence.objectiveId &&
        item.success &&
        item.independent,
    ).length +
    (newEvidence.success && newEvidence.independent ? 1 : 0)
  );
}

function masteryBand(
  score: number,
  threshold: number,
  config: Required<Omit<ObjectiveTrackerConfig, "now">>,
): ObjectiveMasteryBand {
  if (score <= 0) return "not_started";
  if (score < 40) return "emerging";
  if (score < threshold - config.nearlyMasteredMargin) {
    return "developing";
  }
  if (score < threshold) return "nearly_mastered";
  if (score < threshold + config.secureMasteryMargin) {
    return "mastered";
  }
  return "secure";
}

function objectiveRisk(
  objective: TeachingObjective,
  runtime: ObjectiveRuntimeState,
): ObjectiveRisk {
  if (runtime.status === "mastered") return "none";
  if (runtime.attempts === 0) {
    return objective.required ? "moderate" : "low";
  }

  const gap = objective.successThreshold - runtime.masteryScore;
  const successRate =
    runtime.attempts > 0
      ? runtime.successes / runtime.attempts
      : 0;

  if (objective.required && gap >= 35 && successRate < 0.25) {
    return "critical";
  }

  if (gap >= 25 || successRate < 0.35) {
    return objective.required ? "high" : "moderate";
  }

  if (gap > 0) {
    return objective.required ? "moderate" : "low";
  }

  return "none";
}

function determineStatus(
  objective: TeachingObjective,
  masteryScore: number,
  attempts: number,
  config: Required<Omit<ObjectiveTrackerConfig, "now">>,
  independentSuccesses: number,
): ObjectiveRuntimeState["status"] {
  const thresholdReached =
    masteryScore >= objective.successThreshold;

  if (
    thresholdReached &&
    independentSuccesses >=
      config.minimumIndependentSuccessesForMastery
  ) {
    return "mastered";
  }

  if (
    attempts >= config.minimumAttemptsBeforeNeedsSupport &&
    masteryScore < config.needsSupportScore
  ) {
    return "needs_support";
  }

  return attempts > 0 ? "in_progress" : "not_started";
}

function recommendedAction(
  objective: TeachingObjective,
  runtime: ObjectiveRuntimeState,
  risk: ObjectiveRisk,
  unmetPrerequisites: string[],
): ObjectiveMasteryUpdate["recommendedAction"] {
  if (unmetPrerequisites.length > 0 && risk !== "none") {
    return "review_prerequisite";
  }

  if (runtime.status === "mastered") {
    return runtime.masteryScore >= objective.successThreshold + 10
      ? "increase_challenge"
      : "protect_mastery";
  }

  if (risk === "critical" || risk === "high") {
    return "provide_support";
  }

  if (runtime.attempts === 0 || runtime.attempts < 2) {
    return "collect_more_evidence";
  }

  if (
    runtime.masteryScore >= objective.successThreshold - 5
  ) {
    return "reassess";
  }

  return "continue";
}

function objectiveIdsForEvaluation(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity | undefined,
  evaluation: ResponseEvaluation,
  explicit: string[] | undefined,
): string[] {
  const requested =
    explicit?.length
      ? explicit
      : evaluation.targetObjectiveIds.length
        ? evaluation.targetObjectiveIds
        : activity?.targetObjectiveIds ?? [];

  return [...new Set(requested)].filter((objectiveId) =>
    lesson.objectives.some(
      (objective) => objective.id === objectiveId,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/*                          Update Calculation                                */
/* -------------------------------------------------------------------------- */

function calculateUpdate(
  objective: TeachingObjective,
  runtime: ObjectiveRuntimeState,
  evidence: ObjectiveEvidence,
  previousEvidence: ObjectiveEvidence[],
  lesson: TeachingBrainLesson,
  session: TeachingSessionState,
  config: Required<Omit<ObjectiveTrackerConfig, "now">>,
): ObjectiveMasteryUpdate {
  const previous = cloneRuntime(runtime);

  const repeatedCount = repeatedEvidenceCount(
    previousEvidence,
    objective.id,
    evidence.activityId,
  );

  const weight = calculateEvidenceWeight(
    evidence,
    repeatedCount,
    config,
  );

  const errorPenalty =
    (evidence.majorErrorCount ?? 0) *
    config.majorErrorPenalty;

  const adjustedEvidenceScore = clamp(
    evidence.score - errorPenalty,
  );

  let nextMastery =
    previous.attempts === 0
      ? adjustedEvidenceScore
      : previous.masteryScore * (1 - weight) +
        adjustedEvidenceScore * weight;

  const previousMastered =
    previous.status === "mastered" ||
    previous.masteryScore >= objective.successThreshold;

  if (
    previousMastered &&
    config.protectMasteryAfterIndependentSuccess &&
    !evidence.success
  ) {
    nextMastery = Math.max(
      nextMastery,
      previous.masteryScore * config.masteryRetentionFloor,
    );
  }

  if (!config.allowMasteryRegression && previousMastered) {
    nextMastery = Math.max(
      nextMastery,
      objective.successThreshold,
    );
  }

  nextMastery = round(clamp(nextMastery));

  const nextAttempts = previous.attempts + 1;
  const nextSuccesses =
    previous.successes + (evidence.success ? 1 : 0);

  const independentSuccesses = independentSuccessCount(
    previousEvidence,
    evidence,
  );

  const nextProgress = round(
    clamp(
      weightedAverage([
        { value: nextMastery, weight: 0.75 },
        {
          value:
            nextAttempts > 0
              ? (nextSuccesses / nextAttempts) * 100
              : 0,
          weight: 0.25,
        },
      ]),
    ),
  );

  const nextStatus = determineStatus(
    objective,
    nextMastery,
    nextAttempts,
    config,
    independentSuccesses,
  );

  const evidenceActivityIds = [
    ...previous.evidenceActivityIds,
  ];

  if (
    evidence.activityId &&
    !evidenceActivityIds.includes(evidence.activityId)
  ) {
    evidenceActivityIds.push(evidence.activityId);
  }

  const next: ObjectiveRuntimeState = {
    objectiveId: objective.id,
    status: nextStatus,
    progress: nextProgress,
    masteryScore: nextMastery,
    attempts: nextAttempts,
    successes: nextSuccesses,
    lastUpdatedAt: evidence.occurredAt,
    evidenceActivityIds,
  };

  const unmetPrerequisites =
    objective.prerequisiteObjectiveIds?.filter((id) => {
      const prerequisite = lesson.objectives.find(
        (candidate) => candidate.id === id,
      );
      const state = session.objectiveStates[id];

      return Boolean(
        prerequisite &&
          (!state ||
            state.masteryScore <
              prerequisite.successThreshold),
      );
    }) ?? [];

  const risk = objectiveRisk(objective, next);

  const reasons: string[] = [
    `Evidence score ${round(adjustedEvidenceScore)} with weight ${round(
      weight,
      3,
    )}.`,
  ];

  if (evidence.supportLevelUsed && evidence.supportLevelUsed > 0) {
    reasons.push(
      `Support level ${evidence.supportLevelUsed} reduced evidence independence.`,
    );
  }

  if ((evidence.majorErrorCount ?? 0) > 0) {
    reasons.push(
      `${evidence.majorErrorCount} major error(s) reduced the evidence score.`,
    );
  }

  if (unmetPrerequisites.length > 0) {
    reasons.push(
      `Unmet prerequisite objectives: ${unmetPrerequisites.join(", ")}.`,
    );
  }

  if (
    nextMastery >= objective.successThreshold &&
    nextStatus !== "mastered"
  ) {
    reasons.push(
      "The score threshold was reached, but more independent success evidence is required.",
    );
  }

  return {
    objectiveId: objective.id,
    objective,
    previous,
    next,
    evidence,
    scoreDelta: round(next.masteryScore - previous.masteryScore),
    progressDelta: round(next.progress - previous.progress),
    thresholdReached:
      next.masteryScore >= objective.successThreshold,
    newlyMastered:
      previous.status !== "mastered" &&
      next.status === "mastered",
    masteryMaintained:
      previous.status === "mastered" &&
      next.status === "mastered",
    regressed:
      previous.status === "mastered" &&
      next.status !== "mastered",
    band: masteryBand(
      next.masteryScore,
      objective.successThreshold,
      config,
    ),
    risk,
    recommendedAction: recommendedAction(
      objective,
      next,
      risk,
      unmetPrerequisites,
    ),
    reasons,
  };
}

/* -------------------------------------------------------------------------- */
/*                             Error Mapping                                  */
/* -------------------------------------------------------------------------- */

function toTeachingBrainError(
  error: unknown,
  input?:
    | Partial<TrackResponseInput>
    | Partial<RecordObjectiveEvidenceInput>,
): TeachingBrainError {
  if (error instanceof ObjectiveTrackerError) {
    return {
      code:
        error.code === "OBJECTIVE_NOT_FOUND"
          ? "OBJECTIVE_NOT_FOUND"
          : error.code === "ACTIVITY_NOT_FOUND"
            ? "ACTIVITY_NOT_FOUND"
            : "INTERNAL_ERROR",
      message: error.message,
      lessonId: input?.lesson?.id,
      sessionId: input?.session?.id,
      activityId:
        input && "activity" in input
          ? input.activity?.id
          : input && "activityId" in input
            ? input.activityId
            : undefined,
      recoverable: error.recoverable,
      details: error.details,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message:
      error instanceof Error
        ? error.message
        : "An unknown objective tracking error occurred.",
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
/*                         Main Objective Tracker                             */
/* -------------------------------------------------------------------------- */

export class TeachingObjectiveTracker {
  private readonly config: Required<
    Omit<ObjectiveTrackerConfig, "now">
  > &
    Pick<ObjectiveTrackerConfig, "now">;

  constructor(config: ObjectiveTrackerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      now: config.now,
    };

    this.validateConfig();
  }

  trackResponse(
    input: TrackResponseInput,
  ): ObjectiveTrackingResult {
    this.validateLessonSession(input.lesson, input.session);

    const activity =
      input.activity ??
      this.resolveActivity(input.lesson, input.session);

    const objectiveIds = objectiveIdsForEvaluation(
      input.lesson,
      activity,
      input.evaluation,
      input.objectiveIds,
    );

    if (objectiveIds.length === 0) {
      throw new ObjectiveTrackerError(
        "EVALUATION_OBJECTIVE_MISMATCH",
        "The evaluation does not resolve to any lesson objective.",
        {
          details: {
            learnerTurnId: input.evaluation.learnerTurnId,
            activityId: activity?.id,
          },
        },
      );
    }

    const occurredAt = nowIso(this.config, input.occurredAt);
    const previousEvidence = input.previousEvidence ?? [];

    const updates = objectiveIds.map((objectiveId) => {
      const objective = this.requireObjective(
        input.lesson,
        objectiveId,
      );

      const runtime = this.requireRuntime(
        input.session,
        objectiveId,
      );

      const calculated = scoreForObjectiveType(
        objective,
        input.evaluation,
      );

      const relatedErrors =
        input.evaluation.evidence.detectedErrors?.filter(
          (error) =>
            !error.relatedObjectiveId ||
            error.relatedObjectiveId === objectiveId,
        ) ?? [];

      const majorErrorCount = relatedErrors.filter(
        (error) => error.severity === "major",
      ).length;

      const supportLevelUsed =
        input.supportLevelUsed ??
        (activity
          ? input.session.activityStates[activity.id]
              ?.currentSupportLevel ?? 0
          : 0);

      const independent =
        input.independent ??
        supportLevelUsed === 0;

      const confidence = clamp01(
        input.evaluation.confidence,
      );

      const score = round(
        clamp(
          calculated.score -
            supportLevelUsed *
              this.config.supportPenaltyPerLevel *
              100,
        ),
      );

      const success =
        score >= objective.successThreshold &&
        input.evaluation.status !== "incorrect" &&
        input.evaluation.status !== "no_response" &&
        input.evaluation.status !== "off_topic" &&
        input.evaluation.status !== "unclear";

      const evidence: ObjectiveEvidence = {
        id: createId("objective-evidence"),
        objectiveId,
        source: "response_evaluation",
        activityId: activity?.id,
        learnerTurnId: input.evaluation.learnerTurnId,
        score,
        success,
        confidence,
        strength: evidenceStrength(
          score,
          confidence,
          independent,
          supportLevelUsed,
        ),
        focusScores: calculated.focusScores,
        detectedErrorCount: relatedErrors.length,
        majorErrorCount,
        supportLevelUsed,
        independent,
        occurredAt,
        metadata: {
          evaluationStatus: input.evaluation.status,
          evaluationScore: input.evaluation.score,
          ...input.metadata,
        },
      };

      return calculateUpdate(
        objective,
        runtime,
        evidence,
        previousEvidence,
        input.lesson,
        input.session,
        this.config,
      );
    });

    return this.buildTrackingResult(
      input.lesson,
      input.session,
      updates,
      occurredAt,
    );
  }

  recordEvidence(
    input: RecordObjectiveEvidenceInput,
  ): ObjectiveTrackingResult {
    this.validateLessonSession(input.lesson, input.session);

    const objective = this.requireObjective(
      input.lesson,
      input.objectiveId,
    );
    const runtime = this.requireRuntime(
      input.session,
      input.objectiveId,
    );

    if (
      input.activityId &&
      !findActivity(input.lesson, input.activityId)
    ) {
      throw new ObjectiveTrackerError(
        "ACTIVITY_NOT_FOUND",
        `Activity "${input.activityId}" was not found in lesson "${input.lesson.id}".`,
      );
    }

    const occurredAt = nowIso(this.config, input.occurredAt);
    const confidence = clamp01(input.confidence ?? 1);
    const supportLevelUsed = Math.max(
      0,
      input.supportLevelUsed ?? 0,
    );
    const independent =
      input.independent ?? supportLevelUsed === 0;
    const score = round(clamp(input.score));
    const success =
      input.success ?? score >= objective.successThreshold;

    const evidence: ObjectiveEvidence = {
      id: createId("objective-evidence"),
      objectiveId: objective.id,
      source: input.source,
      activityId: input.activityId,
      learnerTurnId: input.learnerTurnId,
      assessmentId: input.assessmentId,
      score,
      success,
      confidence,
      strength:
        input.strength ??
        evidenceStrength(
          score,
          confidence,
          independent,
          supportLevelUsed,
        ),
      focusScores: input.focusScores,
      detectedErrorCount: input.detectedErrorCount,
      majorErrorCount: input.majorErrorCount,
      supportLevelUsed,
      independent,
      occurredAt,
      metadata: input.metadata,
    };

    const update = calculateUpdate(
      objective,
      runtime,
      evidence,
      [],
      input.lesson,
      input.session,
      this.config,
    );

    return this.buildTrackingResult(
      input.lesson,
      input.session,
      [update],
      occurredAt,
    );
  }

  summarize(
    lesson: TeachingBrainLesson,
    session: TeachingSessionState,
  ): ObjectiveTrackerSummary {
    this.validateLessonSession(lesson, session);

    const objectives = lesson.objectives.map((objective) => {
      const runtime = this.requireRuntime(
        session,
        objective.id,
      );

      const unmetPrerequisiteObjectiveIds =
        objective.prerequisiteObjectiveIds?.filter((id) => {
          const prerequisite = lesson.objectives.find(
            (candidate) => candidate.id === id,
          );
          const prerequisiteRuntime =
            session.objectiveStates[id];

          return Boolean(
            prerequisite &&
              (!prerequisiteRuntime ||
                prerequisiteRuntime.masteryScore <
                  prerequisite.successThreshold),
          );
        }) ?? [];

      const risk = objectiveRisk(objective, runtime);

      return {
        objectiveId: objective.id,
        statement: objective.statement,
        type: objective.type,
        required: objective.required,
        priority: objective.priority,
        masteryScore: runtime.masteryScore,
        progress: runtime.progress,
        attempts: runtime.attempts,
        successes: runtime.successes,
        successRate:
          runtime.attempts > 0
            ? round(
                (runtime.successes / runtime.attempts) * 100,
              )
            : 0,
        status: runtime.status,
        band: masteryBand(
          runtime.masteryScore,
          objective.successThreshold,
          this.config,
        ),
        risk,
        threshold: objective.successThreshold,
        evidenceActivityIds: [...runtime.evidenceActivityIds],
        prerequisiteObjectiveIds: [
          ...(objective.prerequisiteObjectiveIds ?? []),
        ],
        unmetPrerequisiteObjectiveIds,
        recommendedAction: recommendedAction(
          objective,
          runtime,
          risk,
          unmetPrerequisiteObjectiveIds,
        ),
      } satisfies ObjectiveSummaryItem;
    });

    const required = objectives.filter(
      (item) => item.required,
    );
    const optional = objectives.filter(
      (item) => !item.required,
    );

    const overallMasteryScore = round(
      weightedAverage(
        objectives.map((item) => {
          const objective = this.requireObjective(
            lesson,
            item.objectiveId,
          );

          return {
            value: item.masteryScore,
            weight: objectiveWeight(
              objective,
              this.config,
            ),
          };
        }),
      ),
    );

    const requiredObjectiveMasteryScore = round(
      average(required.map((item) => item.masteryScore)),
    );

    const optionalObjectiveMasteryScore = round(
      average(optional.map((item) => item.masteryScore)),
    );

    const requiredObjectivesMastered = required.every(
      (item) => item.status === "mastered",
    );

    const ranked = [...objectives].sort(
      (left, right) =>
        left.masteryScore - right.masteryScore,
    );

    return {
      objectives,
      overallMasteryScore,
      requiredObjectiveMasteryScore,
      optionalObjectiveMasteryScore,
      masteredCount: objectives.filter(
        (item) => item.status === "mastered",
      ).length,
      needsSupportCount: objectives.filter(
        (item) => item.status === "needs_support",
      ).length,
      notStartedCount: objectives.filter(
        (item) => item.status === "not_started",
      ).length,
      requiredObjectivesMastered,
      lessonMasteryReady:
        requiredObjectivesMastered &&
        requiredObjectiveMasteryScore >=
          lesson.completionCriteria.minimumObjectiveMastery,
      weakestObjectiveIds: ranked
        .slice(0, Math.min(3, ranked.length))
        .map((item) => item.objectiveId),
      strongestObjectiveIds: ranked
        .slice(Math.max(0, ranked.length - 3))
        .reverse()
        .map((item) => item.objectiveId),
      prerequisiteReviewObjectiveIds: unique(
        objectives.flatMap(
          (item) => item.unmetPrerequisiteObjectiveIds,
        ),
      ),
      generatedAt: nowIso(this.config),
    };
  }

  safeTrackResponse(
    input: TrackResponseInput,
  ): SafeObjectiveTrackingResult {
    try {
      return {
        ok: true,
        data: this.trackResponse(input),
      };
    } catch (error) {
      return {
        ok: false,
        error: toTeachingBrainError(error, input),
      };
    }
  }

  safeRecordEvidence(
    input: RecordObjectiveEvidenceInput,
  ): SafeObjectiveTrackingResult {
    try {
      return {
        ok: true,
        data: this.recordEvidence(input),
      };
    } catch (error) {
      return {
        ok: false,
        error: toTeachingBrainError(error, input),
      };
    }
  }

  safeSummarize(
    lesson: TeachingBrainLesson,
    session: TeachingSessionState,
  ): SafeObjectiveSummaryResult {
    try {
      return {
        ok: true,
        data: this.summarize(lesson, session),
      };
    } catch (error) {
      return {
        ok: false,
        error: toTeachingBrainError(error, {
          lesson,
          session,
        }),
      };
    }
  }

  private validateConfig(): void {
    const probabilities = [
      this.config.baseEvidenceWeight,
      this.config.minimumEvidenceWeight,
      this.config.maximumEvidenceWeight,
      this.config.confidenceFloor,
      this.config.masteryRetentionFloor,
      this.config.supportPenaltyPerLevel,
      this.config.repeatedEvidencePenalty,
    ];

    if (
      probabilities.some(
        (value) =>
          !Number.isFinite(value) ||
          value < 0 ||
          value > 1,
      )
    ) {
      throw new ObjectiveTrackerError(
        "INVALID_INPUT",
        "Objective Tracker probability and weight settings must be between 0 and 1.",
        { recoverable: false },
      );
    }

    if (
      this.config.minimumEvidenceWeight >
      this.config.maximumEvidenceWeight
    ) {
      throw new ObjectiveTrackerError(
        "INVALID_INPUT",
        "minimumEvidenceWeight cannot exceed maximumEvidenceWeight.",
        { recoverable: false },
      );
    }

    if (
      this.config.minimumIndependentSuccessesForMastery < 0 ||
      this.config.minimumAttemptsBeforeNeedsSupport < 1
    ) {
      throw new ObjectiveTrackerError(
        "INVALID_INPUT",
        "Objective attempt and independent-success thresholds are invalid.",
        { recoverable: false },
      );
    }
  }

  private validateLessonSession(
    lesson: TeachingBrainLesson,
    session: TeachingSessionState,
  ): void {
    if (!lesson?.id || !session?.id) {
      throw new ObjectiveTrackerError(
        "INVALID_INPUT",
        "A valid lesson and session are required.",
      );
    }

    if (session.lessonId !== lesson.id) {
      throw new ObjectiveTrackerError(
        "LESSON_SESSION_MISMATCH",
        `Session lesson "${session.lessonId}" does not match lesson "${lesson.id}".`,
      );
    }
  }

  private resolveActivity(
    lesson: TeachingBrainLesson,
    session: TeachingSessionState,
  ): TeachingActivity | undefined {
    if (!session.activeActivityId) return undefined;

    const activity = findActivity(
      lesson,
      session.activeActivityId,
    );

    if (!activity) {
      throw new ObjectiveTrackerError(
        "ACTIVITY_NOT_FOUND",
        `Active activity "${session.activeActivityId}" was not found in lesson "${lesson.id}".`,
      );
    }

    return activity;
  }

  private requireObjective(
    lesson: TeachingBrainLesson,
    objectiveId: string,
  ): TeachingObjective {
    const objective = lesson.objectives.find(
      (candidate) => candidate.id === objectiveId,
    );

    if (!objective) {
      throw new ObjectiveTrackerError(
        "OBJECTIVE_NOT_FOUND",
        `Objective "${objectiveId}" was not found in lesson "${lesson.id}".`,
      );
    }

    return objective;
  }

  private requireRuntime(
    session: TeachingSessionState,
    objectiveId: string,
  ): ObjectiveRuntimeState {
    const runtime = session.objectiveStates[objectiveId];

    if (!runtime) {
      throw new ObjectiveTrackerError(
        "OBJECTIVE_STATE_MISSING",
        `Runtime state for objective "${objectiveId}" is missing.`,
      );
    }

    return runtime;
  }

  private buildTrackingResult(
    lesson: TeachingBrainLesson,
    session: TeachingSessionState,
    updates: ObjectiveMasteryUpdate[],
    createdAt: string,
  ): ObjectiveTrackingResult {
    const projectedStates: Record<
      string,
      ObjectiveRuntimeState
    > = {
      ...session.objectiveStates,
    };

    for (const update of updates) {
      projectedStates[update.objectiveId] = update.next;
    }

    const requiredObjectives = lesson.objectives.filter(
      (objective) => objective.required,
    );

    const overallMasteryScore = round(
      weightedAverage(
        lesson.objectives.map((objective) => ({
          value:
            projectedStates[objective.id]?.masteryScore ?? 0,
          weight: objectiveWeight(
            objective,
            this.config,
          ),
        })),
      ),
    );

    const requiredObjectiveMasteryScore = round(
      average(
        requiredObjectives.map(
          (objective) =>
            projectedStates[objective.id]?.masteryScore ?? 0,
        ),
      ),
    );

    const requiredObjectivesMastered =
      requiredObjectives.every(
        (objective) =>
          projectedStates[objective.id]?.status === "mastered",
      );

    return {
      updates,
      sessionCommands: updates.map((update) => ({
        objectiveId: update.objectiveId,
        progress: update.next.progress,
        masteryScore: update.next.masteryScore,
        success: update.evidence.success,
        evidenceActivityId: update.evidence.activityId,
        occurredAt: update.evidence.occurredAt,
      })),
      affectedObjectiveIds: updates.map(
        (update) => update.objectiveId,
      ),
      masteredObjectiveIds: updates
        .filter((update) => update.next.status === "mastered")
        .map((update) => update.objectiveId),
      needsSupportObjectiveIds: updates
        .filter(
          (update) => update.next.status === "needs_support",
        )
        .map((update) => update.objectiveId),
      prerequisiteReviewObjectiveIds: unique(
        updates
          .filter(
            (update) =>
              update.recommendedAction ===
              "review_prerequisite",
          )
          .flatMap(
            (update) =>
              update.objective.prerequisiteObjectiveIds ?? [],
          ),
      ),
      overallMasteryScore,
      requiredObjectiveMasteryScore,
      requiredObjectivesMastered,
      createdAt,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                          Functional Service API                            */
/* -------------------------------------------------------------------------- */

export function createTeachingObjectiveTracker(
  config: ObjectiveTrackerConfig = {},
): TeachingObjectiveTracker {
  return new TeachingObjectiveTracker(config);
}

export function trackResponseObjectives(
  input: TrackResponseInput,
  config: ObjectiveTrackerConfig = {},
): ObjectiveTrackingResult {
  return new TeachingObjectiveTracker(config).trackResponse(input);
}

export function recordObjectiveEvidence(
  input: RecordObjectiveEvidenceInput,
  config: ObjectiveTrackerConfig = {},
): ObjectiveTrackingResult {
  return new TeachingObjectiveTracker(config).recordEvidence(input);
}

export function summarizeObjectives(
  lesson: TeachingBrainLesson,
  session: TeachingSessionState,
  config: ObjectiveTrackerConfig = {},
): ObjectiveTrackerSummary {
  return new TeachingObjectiveTracker(config).summarize(
    lesson,
    session,
  );
}

export function safeTrackResponseObjectives(
  input: TrackResponseInput,
  config: ObjectiveTrackerConfig = {},
): SafeObjectiveTrackingResult {
  return new TeachingObjectiveTracker(config).safeTrackResponse(
    input,
  );
}

export function safeRecordObjectiveEvidence(
  input: RecordObjectiveEvidenceInput,
  config: ObjectiveTrackerConfig = {},
): SafeObjectiveTrackingResult {
  return new TeachingObjectiveTracker(config).safeRecordEvidence(
    input,
  );
}

export function safeSummarizeObjectives(
  lesson: TeachingBrainLesson,
  session: TeachingSessionState,
  config: ObjectiveTrackerConfig = {},
): SafeObjectiveSummaryResult {
  return new TeachingObjectiveTracker(config).safeSummarize(
    lesson,
    session,
  );
}

/**
 * Returns commands that can be applied through
 * TeachingSessionEngine.updateObjective().
 */
export function objectiveTrackingToSessionCommands(
  result: ObjectiveTrackingResult,
): UpdateObjectiveInput[] {
  return result.sessionCommands.map((command) => ({
    ...command,
  }));
}

export const TeachingObjectiveService = {
  create: createTeachingObjectiveTracker,
  trackResponse: trackResponseObjectives,
  recordEvidence: recordObjectiveEvidence,
  summarize: summarizeObjectives,
  safeTrackResponse: safeTrackResponseObjectives,
  safeRecordEvidence: safeRecordObjectiveEvidence,
  safeSummarize: safeSummarizeObjectives,
  toSessionCommands: objectiveTrackingToSessionCommands,
};
