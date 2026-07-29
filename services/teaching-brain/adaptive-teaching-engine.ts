/**
 * ELVY Teaching Engine
 * TE-800 — Adaptive Teaching Engine
 * Part 1: Foundation
 *
 * Defines the core contracts, learner adaptation profile,
 * deterministic rule framework, validation, diagnostics, and immutable
 * baseline decision output for adaptive teaching.
 *
 * Educational law:
 * Adapt the teaching process without lowering the curriculum objective.
 */

import type {
  ClassroomIdentifier,
  ISODateTime,
  Percentage,
} from "./classroom-state";
import type {
  StudentResponseEvaluation,
} from "./student-response-engine";
import type {
  StrategyDifficultyAdjustment,
  StrategyPace,
  StrategySupportLevel,
  TeachingStrategyDecision,
} from "./teaching-strategy-engine";

export type AdaptivePace =
  | "very_slow"
  | "slow"
  | "normal"
  | "fast";

export type AdaptiveDifficulty =
  | "foundational"
  | "supported"
  | "standard"
  | "challenging"
  | "advanced";

export type AdaptiveSupport =
  | "none"
  | "light"
  | "moderate"
  | "high"
  | "intensive";

export type LearnerEngagement =
  | "unknown"
  | "low"
  | "variable"
  | "steady"
  | "high";

export type LearnerFatigue =
  | "unknown"
  | "none"
  | "mild"
  | "moderate"
  | "high";

export type LearnerConfidence =
  | "unknown"
  | "very_low"
  | "low"
  | "developing"
  | "secure"
  | "high";

export type AdaptationAction =
  | "continue_lesson"
  | "slow_pace"
  | "increase_pace"
  | "maintain_pace"
  | "reduce_difficulty"
  | "maintain_difficulty"
  | "increase_difficulty"
  | "increase_support"
  | "maintain_support"
  | "reduce_support"
  | "repeat_current_step"
  | "repeat_current_scene"
  | "add_guided_practice"
  | "add_independent_practice"
  | "schedule_review"
  | "offer_brief_break"
  | "increase_challenge"
  | "protect_confidence"
  | "request_teacher_review";

export type AdaptationPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

export type ReviewUrgency =
  | "none"
  | "later"
  | "soon"
  | "immediate";

export interface LearnerAdaptationProfile {
  readonly learnerId: ClassroomIdentifier;
  readonly pace: AdaptivePace;
  readonly difficulty: AdaptiveDifficulty;
  readonly support: AdaptiveSupport;
  readonly engagement: LearnerEngagement;
  readonly fatigue: LearnerFatigue;
  readonly confidence: LearnerConfidence;
  readonly currentMastery: Percentage;
  readonly averageRecentScore: Percentage;
  readonly successfulResponses: number;
  readonly partiallyCorrectResponses: number;
  readonly incorrectResponses: number;
  readonly consecutiveCorrectResponses: number;
  readonly consecutiveIncorrectResponses: number;
  readonly totalAttempts: number;
  readonly hintsUsed: number;
  readonly reteachCount: number;
  readonly reviewItemsPending: number;
  readonly lastAdaptedAt?: ISODateTime;
  readonly revision: number;
}

export interface AdaptiveTeachingContext {
  readonly adaptationRequestId: ClassroomIdentifier;
  readonly sessionId: ClassroomIdentifier;
  readonly learnerId: ClassroomIdentifier;
  readonly lessonId: ClassroomIdentifier;
  readonly sceneId: ClassroomIdentifier;
  readonly objectiveId?: ClassroomIdentifier;
  readonly profile: LearnerAdaptationProfile;
  readonly responseEvaluation: StudentResponseEvaluation;
  readonly strategyDecision: TeachingStrategyDecision;
  readonly lessonProgress: Percentage;
  readonly sceneProgress: Percentage;
  readonly objectiveMastery: Percentage;
  readonly elapsedLessonMinutes?: number;
  readonly expectedLessonMinutes?: number;
  readonly recentResponseScores?: readonly Percentage[];
  readonly recentResponseDurationsMs?: readonly number[];
  readonly recentHelpRequests?: number;
  readonly recentSkippedActivities?: number;
  readonly currentActivityDifficulty?: AdaptiveDifficulty;
  readonly currentActivityIndex?: number;
  readonly totalActivities?: number;
  readonly canRepeatScene?: boolean;
  readonly canSkipScene?: boolean;
  readonly canAddPractice?: boolean;
  readonly canScheduleReview?: boolean;
  readonly teacherReviewAvailable?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AdaptiveTeachingDecision {
  readonly adaptationRequestId: ClassroomIdentifier;
  readonly learnerId: ClassroomIdentifier;
  readonly sessionId: ClassroomIdentifier;
  readonly lessonId: ClassroomIdentifier;
  readonly sceneId: ClassroomIdentifier;
  readonly objectiveId?: ClassroomIdentifier;
  readonly priority: AdaptationPriority;
  readonly actions: readonly AdaptationAction[];
  readonly primaryAction: AdaptationAction;
  readonly reason: string;
  readonly pace: AdaptivePaceDecision;
  readonly difficulty: AdaptiveDifficultyDecision;
  readonly support: AdaptiveSupportDecision;
  readonly progression: AdaptiveProgressionDecision;
  readonly review: AdaptiveReviewDecision;
  readonly confidence: AdaptiveConfidenceDecision;
  readonly updatedProfile: LearnerAdaptationProfile;
  readonly decisionConfidence: Percentage;
  readonly generatedAt: ISODateTime;
  readonly diagnostics: AdaptiveTeachingDiagnostics;
}

export interface AdaptivePaceDecision {
  readonly current: AdaptivePace;
  readonly recommended: AdaptivePace;
  readonly changed: boolean;
  readonly reason: string;
}

export interface AdaptiveDifficultyDecision {
  readonly current: AdaptiveDifficulty;
  readonly recommended: AdaptiveDifficulty;
  readonly changed: boolean;
  readonly preserveObjective: true;
  readonly reason: string;
}

export interface AdaptiveSupportDecision {
  readonly current: AdaptiveSupport;
  readonly recommended: AdaptiveSupport;
  readonly changed: boolean;
  readonly maximumTeacherTurns: number;
  readonly reason: string;
}

export interface AdaptiveProgressionDecision {
  readonly continueLesson: boolean;
  readonly repeatCurrentStep: boolean;
  readonly repeatCurrentScene: boolean;
  readonly skipCurrentScene: boolean;
  readonly addGuidedPractice: boolean;
  readonly addIndependentPractice: boolean;
  readonly increaseChallenge: boolean;
}

export interface AdaptiveReviewDecision {
  readonly scheduleReview: boolean;
  readonly urgency: ReviewUrgency;
  readonly objectiveId?: ClassroomIdentifier;
  readonly reason?: string;
}

export interface AdaptiveConfidenceDecision {
  readonly protectConfidence: boolean;
  readonly avoidPublicCorrection: boolean;
  readonly encouragementNeeded: boolean;
  readonly reason?: string;
}

export interface AdaptiveTeachingDiagnostics {
  readonly engineVersion: string;
  readonly profileRevisionBefore: number;
  readonly profileRevisionAfter: number;
  readonly appliedRuleIds: readonly string[];
  readonly candidateRuleIds: readonly string[];
  readonly rejectedRuleIds: readonly string[];
  readonly signals: AdaptiveSignalSnapshot;
  readonly warnings: readonly string[];
}

export interface AdaptiveSignalSnapshot {
  readonly responseScore: Percentage;
  readonly objectiveMastery: Percentage;
  readonly recentAverageScore: Percentage;
  readonly consecutiveCorrect: number;
  readonly consecutiveIncorrect: number;
  readonly helpRequests: number;
  readonly fatigue: LearnerFatigue;
  readonly engagement: LearnerEngagement;
  readonly confidence: LearnerConfidence;
  readonly maximumAttemptsReached: boolean;
}

export interface AdaptiveTeachingEngineOptions {
  readonly engineVersion?: string;
  readonly now?: () => ISODateTime;
  readonly maximumAppliedRules?: number;
  readonly strictValidation?: boolean;
}

export interface AdaptationRuleResult {
  readonly ruleId: string;
  readonly matched: boolean;
  readonly score: number;
  readonly reason: string;
  readonly actions: readonly AdaptationAction[];
  readonly pace?: AdaptivePace;
  readonly difficulty?: AdaptiveDifficulty;
  readonly support?: AdaptiveSupport;
  readonly priority?: AdaptationPriority;
  readonly reviewUrgency?: ReviewUrgency;
}

export interface AdaptationRule {
  readonly id: string;
  readonly description: string;
  evaluate(context: AdaptiveTeachingContext): AdaptationRuleResult;
}

const DEFAULT_OPTIONS: Required<AdaptiveTeachingEngineOptions> = {
  engineVersion: "1.0.0-part1",
  now: () => new Date().toISOString(),
  maximumAppliedRules: 5,
  strictValidation: true,
};

const PACE_ORDER: readonly AdaptivePace[] = [
  "very_slow",
  "slow",
  "normal",
  "fast",
];

const DIFFICULTY_ORDER: readonly AdaptiveDifficulty[] = [
  "foundational",
  "supported",
  "standard",
  "challenging",
  "advanced",
];

const SUPPORT_ORDER: readonly AdaptiveSupport[] = [
  "none",
  "light",
  "moderate",
  "high",
  "intensive",
];

export class AdaptiveTeachingEngine {
  private readonly options: Required<AdaptiveTeachingEngineOptions>;
  private readonly rules: AdaptationRule[];

  public constructor(
    options: AdaptiveTeachingEngineOptions = {},
    rules: readonly AdaptationRule[] = [],
  ) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    if (this.options.maximumAppliedRules < 1) {
      throw new Error("maximumAppliedRules must be at least 1.");
    }

    this.rules = [...createFoundationRules(), ...rules];
  }

  public registerRule(rule: AdaptationRule): void {
    if (!rule.id.trim()) {
      throw new Error("Adaptation rule id is required.");
    }

    if (this.rules.some((existing) => existing.id === rule.id)) {
      throw new Error(
        `An adaptation rule with id "${rule.id}" is already registered.`,
      );
    }

    this.rules.push(rule);
  }

  public evaluate(
    context: AdaptiveTeachingContext,
  ): AdaptiveTeachingDecision {
    const validationErrors =
      validateAdaptiveTeachingContext(context);

    if (
      validationErrors.length > 0 &&
      this.options.strictValidation
    ) {
      throw new Error(
        `Cannot evaluate adaptive teaching: ${validationErrors.join(" ")}`,
      );
    }

    const evaluatedRules = this.rules.map((rule) =>
      safelyEvaluateRule(rule, context),
    );

    const matchedRules = evaluatedRules
      .filter((result) => result.matched)
      .sort(compareRuleResults)
      .slice(0, this.options.maximumAppliedRules);

    const signals = buildSignalSnapshot(context);
    const actions = selectActions(matchedRules);
    const pace = selectPaceDecision(context, matchedRules);
    const difficulty = selectDifficultyDecision(context, matchedRules);
    const support = selectSupportDecision(context, matchedRules);
    const progression = selectProgressionDecision(context, actions);
    const review = selectReviewDecision(context, matchedRules, actions);
    const confidence = selectConfidenceDecision(context, actions);
    const primaryAction = actions[0] ?? "continue_lesson";
    const priority = selectPriority(matchedRules);
    const generatedAt = this.options.now();

    const updatedProfile = updateProfile({
      profile: context.profile,
      evaluation: context.responseEvaluation,
      pace: pace.recommended,
      difficulty: difficulty.recommended,
      support: support.recommended,
      scheduleReview: review.scheduleReview,
      generatedAt,
    });

    return deepFreezeDecision({
      adaptationRequestId: context.adaptationRequestId,
      learnerId: context.learnerId,
      sessionId: context.sessionId,
      lessonId: context.lessonId,
      sceneId: context.sceneId,
      objectiveId: context.objectiveId,
      priority,
      actions,
      primaryAction,
      reason: buildDecisionReason(matchedRules, primaryAction),
      pace,
      difficulty,
      support,
      progression,
      review,
      confidence,
      updatedProfile,
      decisionConfidence: calculateDecisionConfidence(
        matchedRules,
        validationErrors,
      ),
      generatedAt,
      diagnostics: {
        engineVersion: this.options.engineVersion,
        profileRevisionBefore: context.profile.revision,
        profileRevisionAfter: updatedProfile.revision,
        appliedRuleIds: matchedRules.map((rule) => rule.ruleId),
        candidateRuleIds: evaluatedRules.map((rule) => rule.ruleId),
        rejectedRuleIds: evaluatedRules
          .filter((rule) => !rule.matched)
          .map((rule) => rule.ruleId),
        signals,
        warnings: validationErrors,
      },
    });
  }
}

export function createInitialLearnerAdaptationProfile(
  learnerId: ClassroomIdentifier,
): LearnerAdaptationProfile {
  if (!learnerId.trim()) {
    throw new Error("learnerId is required.");
  }

  return Object.freeze({
    learnerId,
    pace: "normal",
    difficulty: "standard",
    support: "light",
    engagement: "unknown",
    fatigue: "unknown",
    confidence: "unknown",
    currentMastery: 0,
    averageRecentScore: 0,
    successfulResponses: 0,
    partiallyCorrectResponses: 0,
    incorrectResponses: 0,
    consecutiveCorrectResponses: 0,
    consecutiveIncorrectResponses: 0,
    totalAttempts: 0,
    hintsUsed: 0,
    reteachCount: 0,
    reviewItemsPending: 0,
    revision: 0,
  });
}

export function validateAdaptiveTeachingContext(
  context: AdaptiveTeachingContext,
): readonly string[] {
  const errors: string[] = [];

  requireText(context.adaptationRequestId, "adaptationRequestId", errors);
  requireText(context.sessionId, "sessionId", errors);
  requireText(context.learnerId, "learnerId", errors);
  requireText(context.lessonId, "lessonId", errors);
  requireText(context.sceneId, "sceneId", errors);

  if (context.profile.learnerId !== context.learnerId) {
    errors.push("profile.learnerId must match context.learnerId.");
  }

  validatePercentage(context.lessonProgress, "lessonProgress", errors);
  validatePercentage(context.sceneProgress, "sceneProgress", errors);
  validatePercentage(context.objectiveMastery, "objectiveMastery", errors);
  validatePercentage(
    context.profile.currentMastery,
    "profile.currentMastery",
    errors,
  );
  validatePercentage(
    context.profile.averageRecentScore,
    "profile.averageRecentScore",
    errors,
  );

  for (const [index, score] of (
    context.recentResponseScores ?? []
  ).entries()) {
    validatePercentage(score, `recentResponseScores[${index}]`, errors);
  }

  for (const [index, duration] of (
    context.recentResponseDurationsMs ?? []
  ).entries()) {
    if (!Number.isFinite(duration) || duration < 0) {
      errors.push(
        `recentResponseDurationsMs[${index}] must be non-negative.`,
      );
    }
  }

  validateNonNegativeOptional(
    context.elapsedLessonMinutes,
    "elapsedLessonMinutes",
    errors,
  );
  validateNonNegativeOptional(
    context.expectedLessonMinutes,
    "expectedLessonMinutes",
    errors,
  );
  validateNonNegativeOptional(
    context.recentHelpRequests,
    "recentHelpRequests",
    errors,
  );
  validateNonNegativeOptional(
    context.recentSkippedActivities,
    "recentSkippedActivities",
    errors,
  );
  validateNonNegativeOptional(
    context.currentActivityIndex,
    "currentActivityIndex",
    errors,
  );
  validateNonNegativeOptional(
    context.totalActivities,
    "totalActivities",
    errors,
  );

  return Object.freeze(errors);
}

function createFoundationRules(): readonly AdaptationRule[] {
  return Object.freeze([
    createRule({
      id: "foundation.correct-response",
      description: "Maintain progression after a correct response.",
      evaluate: (context) => {
        const matched = context.responseEvaluation.status === "correct";
        return {
          ruleId: "foundation.correct-response",
          matched,
          score: matched ? 70 : 0,
          reason: "The learner answered correctly and can continue.",
          actions: matched
            ? ["continue_lesson", "maintain_pace"]
            : [],
          pace: context.profile.pace,
          difficulty: context.profile.difficulty,
          support: context.profile.support,
          priority: "normal",
        };
      },
    }),
    createRule({
      id: "foundation.partial-response",
      description: "Add light support after a partially correct response.",
      evaluate: (context) => {
        const matched =
          context.responseEvaluation.status === "partially_correct";
        return {
          ruleId: "foundation.partial-response",
          matched,
          score: matched ? 78 : 0,
          reason:
            "The learner shows partial understanding and needs guided completion.",
          actions: matched
            ? [
                "increase_support",
                "repeat_current_step",
                "add_guided_practice",
              ]
            : [],
          pace: matched
            ? stepPace(context.profile.pace, -1)
            : context.profile.pace,
          support: matched
            ? stepSupport(context.profile.support, 1)
            : context.profile.support,
          difficulty: context.profile.difficulty,
          priority: "normal",
        };
      },
    }),
    createRule({
      id: "foundation.incorrect-response",
      description:
        "Slow down and increase support after an incorrect response.",
      evaluate: (context) => {
        const matched = context.responseEvaluation.status === "incorrect";
        return {
          ruleId: "foundation.incorrect-response",
          matched,
          score: matched ? 85 : 0,
          reason:
            "The learner needs additional support before progression.",
          actions: matched
            ? ["slow_pace", "increase_support", "repeat_current_step"]
            : [],
          pace: matched
            ? stepPace(context.profile.pace, -1)
            : context.profile.pace,
          support: matched
            ? stepSupport(context.profile.support, 1)
            : context.profile.support,
          difficulty: context.profile.difficulty,
          priority: "high",
        };
      },
    }),
    createRule({
      id: "foundation.maximum-attempts",
      description:
        "Schedule review when the response engine reports maximum attempts.",
      evaluate: (context) => {
        const matched =
          context.responseEvaluation.diagnostics.maximumAttemptsReached;
        return {
          ruleId: "foundation.maximum-attempts",
          matched,
          score: matched ? 95 : 0,
          reason: "The learner reached the current attempt limit.",
          actions: matched
            ? [
                "schedule_review",
                "increase_support",
                "protect_confidence",
              ]
            : [],
          pace: matched
            ? stepPace(context.profile.pace, -1)
            : context.profile.pace,
          support: matched
            ? stepSupport(context.profile.support, 1)
            : context.profile.support,
          difficulty: context.profile.difficulty,
          priority: "high",
          reviewUrgency: "soon",
        };
      },
    }),
    createRule({
      id: "foundation.teacher-review",
      description:
        "Request teacher review when automated judgment is unsafe.",
      evaluate: (context) => {
        const matched =
          context.strategyDecision.shouldRequestTeacherReview;
        return {
          ruleId: "foundation.teacher-review",
          matched,
          score: matched ? 100 : 0,
          reason: "The teaching strategy requires teacher review.",
          actions: matched ? ["request_teacher_review"] : [],
          pace: context.profile.pace,
          support: context.profile.support,
          difficulty: context.profile.difficulty,
          priority: "urgent",
        };
      },
    }),
  ]);
}

function createRule(rule: AdaptationRule): AdaptationRule {
  return Object.freeze(rule);
}

function safelyEvaluateRule(
  rule: AdaptationRule,
  context: AdaptiveTeachingContext,
): AdaptationRuleResult {
  try {
    const result = rule.evaluate(context);
    return Object.freeze({
      ruleId: rule.id,
      matched: result.matched,
      score: clampNumber(result.score, 0, 100),
      reason: result.reason,
      actions: Object.freeze([...result.actions]),
      pace: result.pace,
      difficulty: result.difficulty,
      support: result.support,
      priority: result.priority,
      reviewUrgency: result.reviewUrgency,
    });
  } catch (error) {
    return Object.freeze({
      ruleId: rule.id,
      matched: false,
      score: 0,
      reason:
        error instanceof Error
          ? `Rule failed: ${error.message}`
          : "Rule failed.",
      actions: Object.freeze([]),
    });
  }
}

function compareRuleResults(
  left: AdaptationRuleResult,
  right: AdaptationRuleResult,
): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  return left.ruleId.localeCompare(right.ruleId);
}

function selectActions(
  matchedRules: readonly AdaptationRuleResult[],
): readonly AdaptationAction[] {
  const actions = unique(matchedRules.flatMap((rule) => rule.actions));

  if (actions.length === 0) {
    return Object.freeze([
      "continue_lesson",
      "maintain_pace",
      "maintain_difficulty",
      "maintain_support",
    ]);
  }

  return Object.freeze(actions);
}

function selectPaceDecision(
  context: AdaptiveTeachingContext,
  matchedRules: readonly AdaptationRuleResult[],
): AdaptivePaceDecision {
  const recommended =
    matchedRules.find((rule) => rule.pace)?.pace ??
    mapStrategyPace(context.strategyDecision.pace);

  return Object.freeze({
    current: context.profile.pace,
    recommended,
    changed: recommended !== context.profile.pace,
    reason:
      recommended === context.profile.pace
        ? "The current learner pace remains appropriate."
        : "The learner evidence supports a pacing adjustment.",
  });
}

function selectDifficultyDecision(
  context: AdaptiveTeachingContext,
  matchedRules: readonly AdaptationRuleResult[],
): AdaptiveDifficultyDecision {
  const recommended =
    matchedRules.find((rule) => rule.difficulty)?.difficulty ??
    applyStrategyDifficulty(
      context.profile.difficulty,
      context.strategyDecision.difficultyAdjustment,
    );

  return Object.freeze({
    current: context.profile.difficulty,
    recommended,
    changed: recommended !== context.profile.difficulty,
    preserveObjective: true,
    reason:
      "Difficulty may change, but the curriculum objective is preserved.",
  });
}

function selectSupportDecision(
  context: AdaptiveTeachingContext,
  matchedRules: readonly AdaptationRuleResult[],
): AdaptiveSupportDecision {
  const recommended =
    matchedRules.find((rule) => rule.support)?.support ??
    mapStrategySupport(context.strategyDecision.supportLevel);

  return Object.freeze({
    current: context.profile.support,
    recommended,
    changed: recommended !== context.profile.support,
    maximumTeacherTurns:
      context.strategyDecision.maximumTeacherTurns,
    reason:
      recommended === context.profile.support
        ? "The current support level remains appropriate."
        : "Support is adjusted to the current learner evidence.",
  });
}

function selectProgressionDecision(
  context: AdaptiveTeachingContext,
  actions: readonly AdaptationAction[],
): AdaptiveProgressionDecision {
  return Object.freeze({
    continueLesson:
      actions.includes("continue_lesson") &&
      !actions.includes("request_teacher_review"),
    repeatCurrentStep: actions.includes("repeat_current_step"),
    repeatCurrentScene:
      actions.includes("repeat_current_scene") &&
      (context.canRepeatScene ?? true),
    skipCurrentScene:
      actions.includes("increase_challenge") &&
      (context.canSkipScene ?? false),
    addGuidedPractice:
      actions.includes("add_guided_practice") &&
      (context.canAddPractice ?? true),
    addIndependentPractice:
      actions.includes("add_independent_practice") &&
      (context.canAddPractice ?? true),
    increaseChallenge: actions.includes("increase_challenge"),
  });
}

function selectReviewDecision(
  context: AdaptiveTeachingContext,
  matchedRules: readonly AdaptationRuleResult[],
  actions: readonly AdaptationAction[],
): AdaptiveReviewDecision {
  const scheduleReview =
    actions.includes("schedule_review") &&
    (context.canScheduleReview ?? true);

  const urgency =
    matchedRules.find((rule) => rule.reviewUrgency)?.reviewUrgency ??
    (scheduleReview ? "later" : "none");

  return Object.freeze({
    scheduleReview,
    urgency,
    objectiveId: scheduleReview ? context.objectiveId : undefined,
    reason: scheduleReview
      ? "Current evidence indicates that the objective should be revisited."
      : undefined,
  });
}

function selectConfidenceDecision(
  context: AdaptiveTeachingContext,
  actions: readonly AdaptationAction[],
): AdaptiveConfidenceDecision {
  const protectConfidence =
    actions.includes("protect_confidence") ||
    context.profile.confidence === "very_low" ||
    context.profile.confidence === "low";

  return Object.freeze({
    protectConfidence,
    avoidPublicCorrection: protectConfidence,
    encouragementNeeded:
      protectConfidence ||
      context.responseEvaluation.status !== "correct",
    reason: protectConfidence
      ? "Feedback should protect learner confidence while remaining accurate."
      : undefined,
  });
}

function updateProfile(input: {
  profile: LearnerAdaptationProfile;
  evaluation: StudentResponseEvaluation;
  pace: AdaptivePace;
  difficulty: AdaptiveDifficulty;
  support: AdaptiveSupport;
  scheduleReview: boolean;
  generatedAt: ISODateTime;
}): LearnerAdaptationProfile {
  const isCorrect = input.evaluation.status === "correct";
  const isPartial = input.evaluation.status === "partially_correct";
  const isIncorrect = input.evaluation.status === "incorrect";
  const totalAttempts = input.profile.totalAttempts + 1;

  const averageRecentScore = clampPercentage(
    Math.round(
      (input.profile.averageRecentScore * input.profile.totalAttempts +
        input.evaluation.score) /
        totalAttempts,
    ),
  );

  return Object.freeze({
    ...input.profile,
    pace: input.pace,
    difficulty: input.difficulty,
    support: input.support,
    currentMastery: input.evaluation.masteryEvidence,
    averageRecentScore,
    successfulResponses:
      input.profile.successfulResponses + (isCorrect ? 1 : 0),
    partiallyCorrectResponses:
      input.profile.partiallyCorrectResponses + (isPartial ? 1 : 0),
    incorrectResponses:
      input.profile.incorrectResponses + (isIncorrect ? 1 : 0),
    consecutiveCorrectResponses: isCorrect
      ? input.profile.consecutiveCorrectResponses + 1
      : 0,
    consecutiveIncorrectResponses: isIncorrect
      ? input.profile.consecutiveIncorrectResponses + 1
      : 0,
    totalAttempts,
    hintsUsed:
      input.profile.hintsUsed +
      (input.evaluation.decision === "give_hint" ? 1 : 0),
    reteachCount:
      input.profile.reteachCount +
      (input.evaluation.decision === "explain_again" ? 1 : 0),
    reviewItemsPending:
      input.profile.reviewItemsPending +
      (input.scheduleReview ? 1 : 0),
    lastAdaptedAt: input.generatedAt,
    revision: input.profile.revision + 1,
  });
}

function buildSignalSnapshot(
  context: AdaptiveTeachingContext,
): AdaptiveSignalSnapshot {
  return Object.freeze({
    responseScore: context.responseEvaluation.score,
    objectiveMastery: context.objectiveMastery,
    recentAverageScore: averagePercentage(
      context.recentResponseScores ??
        [context.profile.averageRecentScore],
    ),
    consecutiveCorrect:
      context.profile.consecutiveCorrectResponses,
    consecutiveIncorrect:
      context.profile.consecutiveIncorrectResponses,
    helpRequests: context.recentHelpRequests ?? 0,
    fatigue: context.profile.fatigue,
    engagement: context.profile.engagement,
    confidence: context.profile.confidence,
    maximumAttemptsReached:
      context.responseEvaluation.diagnostics.maximumAttemptsReached,
  });
}

function buildDecisionReason(
  matchedRules: readonly AdaptationRuleResult[],
  fallbackAction: AdaptationAction,
): string {
  if (matchedRules.length === 0) {
    return `No stronger adaptation signal was detected; apply "${fallbackAction}".`;
  }

  return matchedRules.map((rule) => rule.reason).join(" ");
}

function selectPriority(
  matchedRules: readonly AdaptationRuleResult[],
): AdaptationPriority {
  const priorityOrder: readonly AdaptationPriority[] = [
    "urgent",
    "high",
    "normal",
    "low",
  ];

  return (
    priorityOrder.find((priority) =>
      matchedRules.some((rule) => rule.priority === priority),
    ) ?? "normal"
  );
}

function calculateDecisionConfidence(
  matchedRules: readonly AdaptationRuleResult[],
  validationWarnings: readonly string[],
): Percentage {
  if (matchedRules.length === 0) {
    return validationWarnings.length > 0 ? 40 : 60;
  }

  const averageScore =
    matchedRules.reduce((sum, rule) => sum + rule.score, 0) /
    matchedRules.length;
  const penalty = Math.min(30, validationWarnings.length * 5);

  return clampPercentage(Math.round(averageScore - penalty));
}

function mapStrategyPace(pace: StrategyPace): AdaptivePace {
  switch (pace) {
    case "slower":
      return "very_slow";
    case "slow":
      return "slow";
    case "normal":
      return "normal";
    case "brisk":
      return "fast";
    default:
      return assertNever(pace);
  }
}

function mapStrategySupport(
  support: StrategySupportLevel,
): AdaptiveSupport {
  switch (support) {
    case 0:
      return "none";
    case 1:
      return "light";
    case 2:
      return "moderate";
    case 3:
      return "high";
    case 4:
      return "intensive";
    default:
      return assertNever(support);
  }
}

function applyStrategyDifficulty(
  current: AdaptiveDifficulty,
  adjustment: StrategyDifficultyAdjustment,
): AdaptiveDifficulty {
  switch (adjustment) {
    case "reduce":
      return stepDifficulty(current, -1);
    case "maintain":
      return current;
    case "increase":
      return stepDifficulty(current, 1);
    default:
      return assertNever(adjustment);
  }
}

function stepPace(
  current: AdaptivePace,
  amount: -1 | 1,
): AdaptivePace {
  return stepOrderedValue(PACE_ORDER, current, amount);
}

function stepDifficulty(
  current: AdaptiveDifficulty,
  amount: -1 | 1,
): AdaptiveDifficulty {
  return stepOrderedValue(DIFFICULTY_ORDER, current, amount);
}

function stepSupport(
  current: AdaptiveSupport,
  amount: -1 | 1,
): AdaptiveSupport {
  return stepOrderedValue(SUPPORT_ORDER, current, amount);
}

function stepOrderedValue<T>(
  values: readonly T[],
  current: T,
  amount: -1 | 1,
): T {
  const currentIndex = values.indexOf(current);

  if (currentIndex < 0) {
    return current;
  }

  const nextIndex = Math.max(
    0,
    Math.min(values.length - 1, currentIndex + amount),
  );

  return values[nextIndex] ?? current;
}

function deepFreezeDecision(
  decision: AdaptiveTeachingDecision,
): AdaptiveTeachingDecision {
  return Object.freeze({
    ...decision,
    actions: Object.freeze([...decision.actions]),
    pace: Object.freeze({ ...decision.pace }),
    difficulty: Object.freeze({ ...decision.difficulty }),
    support: Object.freeze({ ...decision.support }),
    progression: Object.freeze({ ...decision.progression }),
    review: Object.freeze({ ...decision.review }),
    confidence: Object.freeze({ ...decision.confidence }),
    updatedProfile: Object.freeze({ ...decision.updatedProfile }),
    diagnostics: Object.freeze({
      ...decision.diagnostics,
      appliedRuleIds: Object.freeze([
        ...decision.diagnostics.appliedRuleIds,
      ]),
      candidateRuleIds: Object.freeze([
        ...decision.diagnostics.candidateRuleIds,
      ]),
      rejectedRuleIds: Object.freeze([
        ...decision.diagnostics.rejectedRuleIds,
      ]),
      signals: Object.freeze({ ...decision.diagnostics.signals }),
      warnings: Object.freeze([...decision.diagnostics.warnings]),
    }),
  });
}

function requireText(
  value: string,
  field: string,
  errors: string[],
): void {
  if (!value.trim()) {
    errors.push(`${field} is required.`);
  }
}

function validatePercentage(
  value: number,
  field: string,
  errors: string[],
): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    errors.push(`${field} must be between 0 and 100.`);
  }
}

function validateNonNegativeOptional(
  value: number | undefined,
  field: string,
  errors: string[],
): void {
  if (
    value !== undefined &&
    (!Number.isFinite(value) || value < 0)
  ) {
    errors.push(`${field} must be non-negative.`);
  }
}

function averagePercentage(
  values: readonly Percentage[],
): Percentage {
  if (values.length === 0) {
    return 0;
  }

  return clampPercentage(
    Math.round(
      values.reduce((sum, value) => sum + value, 0) /
        values.length,
    ),
  );
}

function clampPercentage(value: number): Percentage {
  return clampNumber(value, 0, 100);
}

function clampNumber(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
