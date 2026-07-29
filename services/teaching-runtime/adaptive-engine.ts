/**
 * Elvy Teaching Runtime
 * Adaptive Engine
 *
 * File: services/teaching-runtime/adaptive-engine.ts
 *
 * Responsibility:
 * Convert a learner-response evaluation and recent performance context into a
 * deterministic, policy-driven teaching adaptation.
 *
 * This engine:
 * - does not call AI
 * - does not access Supabase
 * - does not mutate session state
 * - does not generate the final teaching script
 * - returns a structured TeachingDecision for the Lesson Director
 */

import type {
  AdaptationPolicy,
  CorrectionFocus,
  L1SupportPolicy,
  ResponseEvaluation,
  TeachingActivity,
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
  TeachingDecision,
  TeachingDecisionReason,
  TeachingDecisionType,
  TeachingSession,
  TeachingStage,
  UUID,
} from "../teaching-brain/types";

export type AdaptivePerformanceSnapshot = Readonly<{
  recentEvaluations?: readonly ResponseEvaluation[];
  consecutiveSuccesses?: number;
  consecutiveFailures?: number;
  totalAttemptsForActivity?: number;
  successfulAttemptsForActivity?: number;
  currentSupportLevel?: number;
  learnerRequestedHelp?: boolean;
  instructionPreviouslyRepeated?: boolean;
  prerequisiteRisk?: boolean;
  remainingMinutes?: number;
}>;

export type AdaptiveEngineInput = Readonly<{
  lesson: TeachingBrainLesson;
  session: TeachingSession;
  stageId: string;
  activityId: string;
  evaluation: ResponseEvaluation;
  performance?: AdaptivePerformanceSnapshot;
  decisionId?: UUID;
  createdAt?: string;
}>;

export type DifficultyAdjustment =
  | "decrease"
  | "maintain"
  | "increase";

export type SupportAction =
  | "none"
  | "wait"
  | "repeat_instruction"
  | "slow_down"
  | "simplify_instruction"
  | "rephrase"
  | "give_general_clue"
  | "give_specific_clue"
  | "show_example"
  | "give_sentence_frame"
  | "translate_keyword"
  | "translate_instruction"
  | "model_answer"
  | "review_prerequisite"
  | "change_activity";

export type AdaptiveEngineOutput = Readonly<{
  decision: TeachingDecision;
  adaptation: Readonly<{
    difficulty: DifficultyAdjustment;
    supportAction: SupportAction;
    supportLevel: number;
    useL1: boolean;
    correctionFocuses: readonly CorrectionFocus[];
    shouldRetry: boolean;
    shouldCompleteActivity: boolean;
    shouldChangeActivity: boolean;
    shouldReviewPrerequisite: boolean;
  }>;
  evidence: Readonly<{
    score: number;
    confidence: number;
    status: ResponseEvaluation["status"];
    consecutiveSuccesses: number;
    consecutiveFailures: number;
    attempts: number;
    maximumAttempts: number;
  }>;
}>;

export type AdaptiveEngineResult =
  TeachingBrainResult<AdaptiveEngineOutput>;

export type AdaptiveEngineOptions = Readonly<{
  now?: () => string;
  createId?: () => UUID;
}>;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : fallback;
}

function createRuntimeId(): UUID {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `decision-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function validIsoOrNow(
  value: string | undefined,
  now: () => string,
): string {
  const candidate = clean(value) || now();
  const parsed = new Date(candidate);

  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function failure<T>(
  error: TeachingBrainError,
): TeachingBrainResult<T> {
  return {
    ok: false,
    error,
  };
}

function findStage(
  lesson: TeachingBrainLesson,
  stageId: string,
): TeachingStage | undefined {
  return lesson.stages.find((stage) => stage.id === stageId);
}

function findActivity(
  stage: TeachingStage,
  activityId: string,
): TeachingActivity | undefined {
  return stage.activities.find(
    (activity) => activity.id === activityId,
  );
}

function isSuccessful(
  evaluation: ResponseEvaluation,
): boolean {
  return (
    evaluation.status === "correct" ||
    evaluation.status === "mostly_correct"
  );
}

function isPartial(
  evaluation: ResponseEvaluation,
): boolean {
  return evaluation.status === "partly_correct";
}

function isFailure(
  evaluation: ResponseEvaluation,
): boolean {
  return (
    evaluation.status === "incorrect" ||
    evaluation.status === "unclear" ||
    evaluation.status === "no_response" ||
    evaluation.status === "off_topic"
  );
}

function calculateConsecutiveSuccesses(
  evaluation: ResponseEvaluation,
  recent: readonly ResponseEvaluation[],
): number {
  if (!isSuccessful(evaluation)) {
    return 0;
  }

  let count = 1;

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    if (!isSuccessful(recent[index])) {
      break;
    }

    count += 1;
  }

  return count;
}

function calculateConsecutiveFailures(
  evaluation: ResponseEvaluation,
  recent: readonly ResponseEvaluation[],
): number {
  if (!isFailure(evaluation)) {
    return 0;
  }

  let count = 1;

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    if (!isFailure(recent[index])) {
      break;
    }

    count += 1;
  }

  return count;
}

function maximumSupportLevel(
  policy: AdaptationPolicy,
  activity: TeachingActivity,
): number {
  const activityMaximum = activity.supportSteps.reduce(
    (maximum, step) => Math.max(maximum, step.level),
    0,
  );

  return Math.max(
    0,
    Math.min(
      policy.maximumSupportLevel,
      activityMaximum || policy.maximumSupportLevel,
    ),
  );
}

function correctionFocuses(
  evaluation: ResponseEvaluation,
): readonly CorrectionFocus[] {
  return Object.freeze([
    ...(evaluation.recommendedCorrectionFocus ?? []),
  ]);
}

function l1Allowed(
  policy: L1SupportPolicy,
  failures: number,
  helpRequested: boolean,
): boolean {
  if (!policy.enabled || policy.level === "disabled") {
    return false;
  }

  if (
    helpRequested &&
    policy.allowedTriggers.includes("learner_requests_help")
  ) {
    return true;
  }

  if (
    failures >= 2 &&
    policy.allowedTriggers.includes("repeated_failure")
  ) {
    return true;
  }

  return (
    failures >= 1 &&
    policy.allowedTriggers.includes("beginner_support") &&
    (
      policy.level === "moderate" ||
      policy.level === "frequent"
    )
  );
}

function chooseSupportAction(
  evaluation: ResponseEvaluation,
  failures: number,
  supportLevel: number,
  helpRequested: boolean,
  prerequisiteRisk: boolean,
  policy: AdaptationPolicy,
  activity: TeachingActivity,
): SupportAction {
  if (prerequisiteRisk && policy.allowPrerequisiteReview) {
    return "review_prerequisite";
  }

  if (helpRequested) {
    if (supportLevel <= 1) {
      return "rephrase";
    }

    if (supportLevel === 2) {
      return "give_specific_clue";
    }

    return "show_example";
  }

  if (evaluation.status === "no_response") {
    return supportLevel <= 1
      ? "wait"
      : "repeat_instruction";
  }

  if (evaluation.status === "off_topic") {
    return "rephrase";
  }

  if (evaluation.status === "unclear") {
    return supportLevel <= 1
      ? "repeat_instruction"
      : "simplify_instruction";
  }

  if (isPartial(evaluation)) {
    return supportLevel <= 1
      ? "give_general_clue"
      : "give_specific_clue";
  }

  if (evaluation.status === "incorrect") {
    if (failures <= 1) {
      return "give_general_clue";
    }

    if (failures === 2) {
      return "give_specific_clue";
    }

    if (
      failures >= policy.maximumRetriesPerActivity &&
      policy.allowActivityReplacement &&
      activity.allowAlternativeActivity
    ) {
      return "change_activity";
    }

    return "model_answer";
  }

  return "none";
}

function mapSupportActionToDecision(
  action: SupportAction,
): TeachingDecisionType {
  switch (action) {
    case "wait":
      return "ask_follow_up";
    case "repeat_instruction":
      return "repeat_instruction";
    case "slow_down":
      return "slow_down";
    case "simplify_instruction":
      return "simplify";
    case "rephrase":
      return "rephrase";
    case "give_general_clue":
    case "give_specific_clue":
    case "give_sentence_frame":
      return "give_clue";
    case "show_example":
    case "model_answer":
      return "model_answer";
    case "translate_keyword":
    case "translate_instruction":
      return "translate_support";
    case "review_prerequisite":
      return "review_prerequisite";
    case "change_activity":
      return "change_activity";
    case "none":
    default:
      return "continue";
  }
}

function messageIntentFor(
  decisionType: TeachingDecisionType,
): TeachingDecision["messageIntent"] {
  switch (decisionType) {
    case "praise_and_continue":
      return "praise";
    case "ask_follow_up":
      return "ask";
    case "give_clue":
      return "prompt";
    case "simplify":
    case "rephrase":
    case "repeat_instruction":
    case "slow_down":
      return "clarify";
    case "model_answer":
    case "review_prerequisite":
      return "explain";
    case "correct_gently":
    case "request_self_correction":
      return "correct";
    case "translate_support":
      return "clarify";
    case "change_activity":
    case "complete_activity":
      return "transition";
    default:
      return "encourage";
  }
}

function reasonFor(
  evaluation: ResponseEvaluation,
  attempts: number,
  maximumAttempts: number,
  helpRequested: boolean,
): TeachingDecisionReason {
  if (helpRequested || evaluation.status === "help_requested") {
    return "learner_requested_help";
  }

  if (evaluation.status === "correct") {
    return "correct_response";
  }

  if (
    evaluation.status === "mostly_correct" ||
    evaluation.status === "partly_correct"
  ) {
    return "partial_success";
  }

  if (evaluation.status === "no_response") {
    return "no_response";
  }

  if (evaluation.status === "off_topic") {
    return "off_topic_response";
  }

  if (attempts >= maximumAttempts) {
    return "activity_attempt_limit_reached";
  }

  if (evaluation.confidence < 0.5) {
    return "low_confidence_evaluation";
  }

  return "incorrect_response";
}

export class AdaptiveEngine {
  private readonly now: () => string;
  private readonly createId: () => UUID;

  constructor(options: AdaptiveEngineOptions = {}) {
    this.now =
      options.now ?? (() => new Date().toISOString());

    this.createId =
      options.createId ?? createRuntimeId;
  }

  adapt(
    input: AdaptiveEngineInput,
  ): AdaptiveEngineResult {
    const validationError = this.validateInput(input);

    if (validationError) {
      return failure(validationError);
    }

    const stage = findStage(
      input.lesson,
      input.stageId,
    );

    if (!stage) {
      return failure({
        code: "STAGE_NOT_FOUND",
        message:
          `Stage "${input.stageId}" was not found in lesson "${input.lesson.id}".`,
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        stageId: input.stageId,
        activityId: input.activityId,
        recoverable: false,
      });
    }

    const activity = findActivity(
      stage,
      input.activityId,
    );

    if (!activity) {
      return failure({
        code: "ACTIVITY_NOT_FOUND",
        message:
          `Activity "${input.activityId}" was not found in stage "${stage.id}".`,
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        stageId: stage.id,
        activityId: input.activityId,
        recoverable: false,
      });
    }

    if (input.lesson.status !== "active") {
      return failure({
        code: "LESSON_NOT_ACTIVE",
        message:
          "The lesson must be active before an adaptive decision can be made.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        stageId: stage.id,
        activityId: activity.id,
        recoverable: true,
      });
    }

    const performance = input.performance ?? {};
    const recent = performance.recentEvaluations ?? [];

    const successes =
      performance.consecutiveSuccesses ??
      calculateConsecutiveSuccesses(
        input.evaluation,
        recent,
      );

    const failures =
      performance.consecutiveFailures ??
      calculateConsecutiveFailures(
        input.evaluation,
        recent,
      );

    const attempts = Math.max(
      1,
      nonNegativeInteger(
        performance.totalAttemptsForActivity,
        input.session.currentAttempt,
      ),
    );

    const maximumAttempts = Math.max(
      1,
      activity.maximumAttempts,
    );

    const policy = input.lesson.adaptationPolicy;

    const maximumSupport =
      maximumSupportLevel(policy, activity);

    const currentSupport = clamp(
      nonNegativeInteger(
        performance.currentSupportLevel,
        input.session.currentSupportLevel,
      ),
      0,
      maximumSupport,
    );

    const helpRequested =
      Boolean(performance.learnerRequestedHelp) ||
      input.evaluation.status === "help_requested";

    const successful =
      isSuccessful(input.evaluation);

    const failed =
      isFailure(input.evaluation);

    const shouldCompleteActivity =
      successful &&
      (
        input.evaluation.status === "correct" ||
        successes >=
          policy.increaseDifficultyAfterSuccessfulAttempts ||
        attempts >= activity.minimumAttempts
      );

    const attemptLimitReached =
      attempts >= maximumAttempts;

    const shouldChangeActivity =
      failed &&
      attemptLimitReached &&
      policy.allowActivityReplacement &&
      Boolean(
        activity.allowAlternativeActivity &&
        activity.alternativeActivityId,
      );

    const shouldReviewPrerequisite =
      failed &&
      Boolean(performance.prerequisiteRisk) &&
      policy.allowPrerequisiteReview;

    const nextSupportLevel = successful
      ? Math.max(0, currentSupport - 1)
      : clamp(
          currentSupport +
            (
              failed || helpRequested
                ? 1
                : 0
            ),
          0,
          maximumSupport,
        );

    let difficulty: DifficultyAdjustment = "maintain";

    if (
      successful &&
      policy.allowDifficultyAdjustment &&
      successes >=
        policy.increaseDifficultyAfterSuccessfulAttempts
    ) {
      difficulty = "increase";
    } else if (
      failed &&
      policy.allowDifficultyAdjustment &&
      failures >=
        policy.reduceDifficultyAfterFailedAttempts
    ) {
      difficulty = "decrease";
    }

    const supportAction = chooseSupportAction(
      input.evaluation,
      failures,
      nextSupportLevel,
      helpRequested,
      shouldReviewPrerequisite,
      policy,
      activity,
    );

    const useL1 =
      l1Allowed(
        input.lesson.l1Policy,
        failures,
        helpRequested,
      ) &&
      (
        supportAction === "repeat_instruction" ||
        supportAction === "simplify_instruction" ||
        supportAction === "model_answer" ||
        supportAction === "show_example"
      );

    let decisionType: TeachingDecisionType;

    if (shouldCompleteActivity) {
      decisionType = "complete_activity";
    } else if (shouldChangeActivity) {
      decisionType = "change_activity";
    } else if (shouldReviewPrerequisite) {
      decisionType = "review_prerequisite";
    } else if (
      successful &&
      input.evaluation.status === "correct"
    ) {
      decisionType = "praise_and_continue";
    } else if (
      successful &&
      input.evaluation.shouldCorrect
    ) {
      decisionType = "correct_gently";
    } else if (
      isPartial(input.evaluation) &&
      input.lesson.correctionPolicy.askLearnerToSelfCorrect
    ) {
      decisionType = "request_self_correction";
    } else {
      decisionType =
        mapSupportActionToDecision(
          useL1
            ? "translate_instruction"
            : supportAction,
        );
    }

    const shouldRetry =
      !shouldCompleteActivity &&
      !shouldChangeActivity &&
      !shouldReviewPrerequisite &&
      (
        failed ||
        isPartial(input.evaluation) ||
        helpRequested
      ) &&
      !attemptLimitReached;

    const directorHints: NonNullable<
      TeachingDecision["directorHints"]
    > = Object.freeze({
      preferredGesture: successful
        ? "encourage"
        : helpRequested
          ? "listen"
          : "think",
      facialExpression: successful
        ? "encouraging"
        : "thinking",
      speakingPace:
        difficulty === "decrease"
          ? "slow"
          : "normal",
      allowAnimation: true,
      allowMovement: false,
    });

    const decision: TeachingDecision = Object.freeze({
      id:
        clean(input.decisionId) ||
        this.createId(),
      sessionId: input.session.id,
      stageId: stage.id,
      activityId: activity.id,
      learnerTurnId:
        input.evaluation.learnerTurnId,
      type: decisionType,
      reason: reasonFor(
        input.evaluation,
        attempts,
        maximumAttempts,
        helpRequested,
      ),
      priority:
        shouldReviewPrerequisite ||
        shouldChangeActivity
          ? "high"
          : input.evaluation.status === "incorrect"
            ? "normal"
            : "low",
      supportLevel: nextSupportLevel,
      messageIntent:
        messageIntentFor(decisionType),
      targetStageId: stage.id,
      targetActivityId:
        shouldChangeActivity
          ? activity.alternativeActivityId
          : activity.id,
      shouldWaitForLearner:
        decisionType !== "complete_activity" &&
        decisionType !== "change_activity",
      expectedInputModality:
        activity.inputModality,
      directorHints,
      createdAt: validIsoOrNow(
        input.createdAt,
        this.now,
      ),
      metadata: {
        difficultyAdjustment: difficulty,
        supportAction:
          useL1
            ? "translate_instruction"
            : supportAction,
        useL1,
        shouldRetry,
        shouldCompleteActivity,
        shouldChangeActivity,
        shouldReviewPrerequisite,
        attempts,
        maximumAttempts,
        consecutiveSuccesses: successes,
        consecutiveFailures: failures,
        evaluationScore:
          input.evaluation.score,
        evaluationConfidence:
          input.evaluation.confidence,
      },
    });

    return {
      ok: true,
      data: Object.freeze({
        decision,
        adaptation: Object.freeze({
          difficulty,
          supportAction:
            useL1
              ? "translate_instruction"
              : supportAction,
          supportLevel: nextSupportLevel,
          useL1,
          correctionFocuses:
            correctionFocuses(
              input.evaluation,
            ),
          shouldRetry,
          shouldCompleteActivity,
          shouldChangeActivity,
          shouldReviewPrerequisite,
        }),
        evidence: Object.freeze({
          score: input.evaluation.score,
          confidence:
            input.evaluation.confidence,
          status: input.evaluation.status,
          consecutiveSuccesses: successes,
          consecutiveFailures: failures,
          attempts,
          maximumAttempts,
        }),
      }),
    };
  }

  private validateInput(
    input: AdaptiveEngineInput,
  ): TeachingBrainError | null {
    if (!input || typeof input !== "object") {
      return {
        code: "UNSUPPORTED_INPUT",
        message:
          "An adaptive-engine input object is required.",
        recoverable: true,
      };
    }

    if (!input.lesson || typeof input.lesson !== "object") {
      return {
        code: "INVALID_LESSON",
        message:
          "A valid Teaching Brain lesson is required.",
        sessionId: input.session?.id,
        recoverable: true,
      };
    }

    if (!input.session || typeof input.session !== "object") {
      return {
        code: "INVALID_SESSION",
        message:
          "A valid teaching session is required.",
        lessonId: input.lesson.id,
        recoverable: true,
      };
    }

    if (!clean(input.stageId)) {
      return {
        code: "STAGE_NOT_FOUND",
        message: "stageId is required.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        recoverable: true,
      };
    }

    if (!clean(input.activityId)) {
      return {
        code: "ACTIVITY_NOT_FOUND",
        message: "activityId is required.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        stageId: input.stageId,
        recoverable: true,
      };
    }

    if (
      !input.evaluation ||
      typeof input.evaluation !== "object"
    ) {
      return {
        code: "EVALUATION_FAILED",
        message:
          "A valid response evaluation is required.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        stageId: input.stageId,
        activityId: input.activityId,
        recoverable: true,
      };
    }

    if (
      clean(input.evaluation.learnerTurnId) === ""
    ) {
      return {
        code: "EVALUATION_FAILED",
        message:
          "evaluation.learnerTurnId is required.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        stageId: input.stageId,
        activityId: input.activityId,
        recoverable: true,
      };
    }

    return null;
  }
}

export function createAdaptiveEngine(
  options?: AdaptiveEngineOptions,
): AdaptiveEngine {
  return new AdaptiveEngine(options);
}

export function adaptTeaching(
  input: AdaptiveEngineInput,
  options?: AdaptiveEngineOptions,
): AdaptiveEngineResult {
  return createAdaptiveEngine(options).adapt(input);
}

export const TeachingAdaptiveEngine =
  Object.freeze({
    create: createAdaptiveEngine,
    adapt: adaptTeaching,
  });
