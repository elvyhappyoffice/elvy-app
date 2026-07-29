/**
 * Elvy Teaching Brain
 * Pedagogical decision engine
 *
 * File: services/teaching-brain/decision-engine.ts
 *
 * Responsibilities:
 * - inspect the current lesson, session runtime, activity, and response evaluation
 * - apply correction, adaptation, L1, support, and progression policies
 * - select one deterministic pedagogical action
 * - produce a TeachingDecision for the Support Engine and Elvy Director
 *
 * Deliberately excluded:
 * - evaluating learner language (response-evaluator.ts)
 * - mutating session state (session-engine.ts)
 * - generating final support wording (support-engine.ts)
 * - making final lesson mastery calculations (lesson-completion.ts)
 */

import type {
  CorrectionFocus,
  DirectorHints,
  InputModality,
  LearnerResponseStatus,
  ResponseEvaluation,
  SupportStep,
  SupportStepType,
  TeachingActivity,
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
  TeachingDecision,
  TeachingDecisionReason,
  TeachingDecisionType,
  TeachingSessionState as PedagogicalSessionState,
  TeachingStage,
} from "./types";

import type {
  ActivityRuntimeState,
  StageRuntimeState,
  TeachingSessionState,
} from "./session-engine";

/* -------------------------------------------------------------------------- */
/*                               Public Types                                 */
/* -------------------------------------------------------------------------- */

export type DecisionEngineMode =
  | "deterministic"
  | "provider_assisted"
  | "provider_only";

export type DecisionProviderInput = {
  lesson: TeachingBrainLesson;
  session: TeachingSessionState;
  stage: TeachingStage;
  activity: TeachingActivity;
  activityRuntime: ActivityRuntimeState;
  stageRuntime: StageRuntimeState;
  evaluation: ResponseEvaluation;
  deterministicDecision: TeachingDecision;
};

export type DecisionProviderResult = {
  type: TeachingDecisionType;
  reason?: TeachingDecisionReason;
  priority?: TeachingDecision["priority"];
  supportLevel?: number;
  messageIntent?: TeachingDecision["messageIntent"];
  speechContent?: string;
  textContent?: string;
  correction?: TeachingDecision["correction"];
  targetState?: PedagogicalSessionState;
  targetStageId?: string;
  targetActivityId?: string;
  shouldWaitForLearner?: boolean;
  expectedInputModality?: InputModality;
  directorHints?: DirectorHints;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export interface TeachingDecisionProvider {
  decide(input: DecisionProviderInput): Promise<DecisionProviderResult>;
}

export type DecisionEngineConfig = {
  mode?: DecisionEngineMode;
  provider?: TeachingDecisionProvider;

  lowEvaluationConfidenceThreshold?: number;
  praiseMinimumScore?: number;
  followUpMinimumScore?: number;
  selfCorrectionMinimumScore?: number;
  repeatedErrorThreshold?: number;
  noResponsePauseThreshold?: number;

  allowProviderToOverrideProgression?: boolean;
  includeDefaultSpeechContent?: boolean;

  now?: () => string;
};

export type MakeTeachingDecisionInput = {
  lesson: TeachingBrainLesson;
  session: TeachingSessionState;
  evaluation: ResponseEvaluation;

  stage?: TeachingStage;
  activity?: TeachingActivity;

  previousEvaluations?: ResponseEvaluation[];

  timeRemainingMinutes?: number;
  learnerReady?: boolean;
  humanSupportAvailable?: boolean;

  metadata?: Record<string, unknown>;
};

export type DecisionDiagnostics = {
  attemptsUsed: number;
  attemptsRemaining: number;
  currentSupportLevel: number;
  consecutiveFailureCount: number;
  repeatedErrorCount: number;
  activityRuleMet: boolean;
  stageRuleMet: boolean;
  lessonCanComplete: boolean;
  selectedSupportStep?: SupportStep;
  consideredDecisions: TeachingDecisionType[];
  notes: string[];
};

export type DetailedTeachingDecision = {
  decision: TeachingDecision;
  diagnostics: DecisionDiagnostics;
};

export type SafeDecisionResult =
  TeachingBrainResult<DetailedTeachingDecision>;

export type DecisionEngineErrorCode =
  | "INVALID_INPUT"
  | "SESSION_NOT_ACTIVE"
  | "SESSION_TERMINAL"
  | "STAGE_NOT_FOUND"
  | "ACTIVITY_NOT_FOUND"
  | "SESSION_CONTEXT_MISMATCH"
  | "EVALUATION_CONTEXT_MISMATCH"
  | "PROVIDER_REQUIRED"
  | "PROVIDER_FAILED"
  | "DECISION_FAILED";

export class DecisionEngineError extends Error {
  readonly code: DecisionEngineErrorCode;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: DecisionEngineErrorCode,
    message: string,
    options?: {
      recoverable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "DecisionEngineError";
    this.code = code;
    this.recoverable = options?.recoverable ?? true;
    this.details = options?.details;
  }
}

/* -------------------------------------------------------------------------- */
/*                              Internal Types                                */
/* -------------------------------------------------------------------------- */

type ResolvedContext = {
  stage: TeachingStage;
  activity: TeachingActivity;
  stageRuntime: StageRuntimeState;
  activityRuntime: ActivityRuntimeState;
};

type CandidateDecision = {
  type: TeachingDecisionType;
  reason: TeachingDecisionReason;
  priority: TeachingDecision["priority"];
  supportLevel: number;
  messageIntent: TeachingDecision["messageIntent"];
  speechContent?: string;
  textContent?: string;
  correction?: TeachingDecision["correction"];
  targetState?: PedagogicalSessionState;
  targetStageId?: string;
  targetActivityId?: string;
  shouldWaitForLearner: boolean;
  expectedInputModality?: InputModality;
  directorHints?: DirectorHints;
  selectedSupportStep?: SupportStep;
  metadata?: Record<string, unknown>;
};

type DecisionFacts = {
  attemptsUsed: number;
  attemptsRemaining: number;
  currentSupportLevel: number;
  consecutiveFailureCount: number;
  repeatedErrorCount: number;
  activityRuleMet: boolean;
  stageRuleMet: boolean;
  lessonCanComplete: boolean;
  lowConfidence: boolean;
  attemptsExhausted: boolean;
  correctionFocus: CorrectionFocus[];
};

/* -------------------------------------------------------------------------- */
/*                               Defaults                                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_CONFIG: Required<
  Omit<DecisionEngineConfig, "provider" | "now">
> = {
  mode: "deterministic",
  lowEvaluationConfidenceThreshold: 0.55,
  praiseMinimumScore: 85,
  followUpMinimumScore: 90,
  selfCorrectionMinimumScore: 45,
  repeatedErrorThreshold: 2,
  noResponsePauseThreshold: 3,
  allowProviderToOverrideProgression: false,
  includeDefaultSpeechContent: true,
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

function nowIso(config: DecisionEngineConfig): string {
  const raw = config.now?.() ?? new Date().toISOString();
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value > 1
    ? clamp(value / 100, 0, 1)
    : clamp(value, 0, 1);
}

function orderedStages(lesson: TeachingBrainLesson): TeachingStage[] {
  return [...lesson.stages].sort((a, b) => a.order - b.order);
}

function orderedActivities(stage: TeachingStage): TeachingActivity[] {
  return [...stage.activities].sort((a, b) => a.order - b.order);
}

function findStage(
  lesson: TeachingBrainLesson,
  stageId: string,
): TeachingStage | undefined {
  return lesson.stages.find((stage) => stage.id === stageId);
}

function findActivity(
  lesson: TeachingBrainLesson,
  activityId: string,
): { stage: TeachingStage; activity: TeachingActivity } | undefined {
  for (const stage of lesson.stages) {
    const activity = stage.activities.find((item) => item.id === activityId);
    if (activity) return { stage, activity };
  }

  return undefined;
}

function average(values: number[]): number | undefined {
  const valid = values.filter(Number.isFinite);
  if (valid.length === 0) return undefined;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function isSuccessfulStatus(status: LearnerResponseStatus): boolean {
  return status === "correct" || status === "mostly_correct";
}

function isFailureStatus(status: LearnerResponseStatus): boolean {
  return (
    status === "incorrect" ||
    status === "no_response" ||
    status === "off_topic" ||
    status === "unclear"
  );
}

function attemptWasSuccessful(
  outcome: ActivityRuntimeState["attempts"][number]["outcome"],
): boolean {
  return outcome === "successful";
}

function attemptWasFailure(
  outcome: ActivityRuntimeState["attempts"][number]["outcome"],
): boolean {
  return (
    outcome === "unsuccessful" ||
    outcome === "no_response" ||
    outcome === "off_topic"
  );
}

function countConsecutiveFailures(
  runtime: ActivityRuntimeState,
  evaluation: ResponseEvaluation,
): number {
  let count = isFailureStatus(evaluation.status) ? 1 : 0;

  for (let index = runtime.attempts.length - 1; index >= 0; index -= 1) {
    const attempt = runtime.attempts[index];

    if (attemptWasFailure(attempt.outcome)) {
      count += 1;
      continue;
    }

    break;
  }

  return count;
}

function countRepeatedErrors(
  evaluation: ResponseEvaluation,
  previous: ResponseEvaluation[],
): number {
  const currentErrors = evaluation.evidence.detectedErrors ?? [];
  if (currentErrors.length === 0) return 0;

  const signatures = new Set(
    currentErrors.map((error) =>
      [
        error.type,
        error.relatedGrammarId ?? "",
        error.relatedVocabularyId ?? "",
        error.correction ?? "",
        error.explanation ?? "",
      ].join("|"),
    ),
  );

  let repeated = 0;

  for (const prior of previous) {
    const priorErrors = prior.evidence.detectedErrors ?? [];
    if (
      priorErrors.some((error) =>
        signatures.has(
          [
            error.type,
            error.relatedGrammarId ?? "",
            error.relatedVocabularyId ?? "",
            error.correction ?? "",
            error.explanation ?? "",
          ].join("|"),
        ),
      )
    ) {
      repeated += 1;
    }
  }

  return repeated;
}

function activityRuleMet(
  activity: TeachingActivity,
  runtime: ActivityRuntimeState,
  evaluation: ResponseEvaluation,
): boolean {
  const attemptsAfter = runtime.attempts.length + 1;
  if (attemptsAfter < activity.minimumAttempts) return false;

  const bestScore = Math.max(runtime.bestScore ?? 0, evaluation.score);
  const successfulTurnsAfter =
    runtime.successfulTurns + (isSuccessfulStatus(evaluation.status) ? 1 : 0);
  const correctAnswersAfter =
    runtime.correctAnswers + (evaluation.status === "correct" ? 1 : 0);

  switch (activity.successRule.type) {
    case "single_correct_response":
      return evaluation.status === "correct";

    case "minimum_score":
      return bestScore >= (activity.successRule.minimumScore ?? 0);

    case "minimum_correct_answers":
      return (
        correctAnswersAfter >=
        (activity.successRule.minimumCorrectAnswers ?? 1)
      );

    case "minimum_successful_turns":
      return (
        successfulTurnsAfter >=
        (activity.successRule.minimumSuccessfulTurns ?? 1)
      );

    case "semantic_match":
      return (
        evaluation.meaning === "correct" ||
        evaluation.score >= (activity.successRule.semanticThreshold ?? 0)
      );

    case "completion_only":
      return attemptsAfter >= activity.minimumAttempts;

    case "manual":
      return false;

    default:
      return false;
  }
}

function effectiveActivityStatus(
  activityId: string,
  currentActivityId: string,
  activityRuleSatisfied: boolean,
  session: TeachingSessionState,
): "completed" | "skipped" | "other" {
  if (activityId === currentActivityId && activityRuleSatisfied) {
    return "completed";
  }

  const status = session.activityStates[activityId]?.status;
  if (status === "completed") return "completed";
  if (status === "skipped") return "skipped";
  return "other";
}

function stageRuleMet(
  stage: TeachingStage,
  activity: TeachingActivity,
  activitySucceeded: boolean,
  session: TeachingSessionState,
): boolean {
  const rule = stage.completionRule;
  const activities = orderedActivities(stage);

  const completed = activities.filter(
    (item) =>
      effectiveActivityStatus(
        item.id,
        activity.id,
        activitySucceeded,
        session,
      ) === "completed",
  );

  const successful = activities.filter((item) => {
    if (item.id === activity.id && activitySucceeded) return true;
    const runtime = session.activityStates[item.id];
    return (
      runtime?.status === "completed" &&
      runtime.attempts.some((attempt) => attemptWasSuccessful(attempt.outcome))
    );
  });

  const requiredIds =
    rule.requiredActivityIds ??
    activities.filter((item) => item.required).map((item) => item.id);

  switch (rule.type) {
    case "all_required_activities_completed":
      return requiredIds.every(
        (id) =>
          effectiveActivityStatus(
            id,
            activity.id,
            activitySucceeded,
            session,
          ) === "completed",
      );

    case "minimum_score_reached": {
      const scores = activities
        .map((item) => {
          if (item.id === activity.id && activitySucceeded) {
            return Math.max(
              session.activityStates[item.id]?.bestScore ?? 0,
              0,
            );
          }
          return session.activityStates[item.id]?.bestScore;
        })
        .filter((score): score is number => score !== undefined);

      return (average(scores) ?? 0) >= (rule.minimumScore ?? 0);
    }

    case "minimum_successes_reached":
      return (
        successful.length >=
        (rule.minimumSuccessfulActivities ?? 1)
      );

    case "time_limit_reached": {
      const runtime = session.stageStates[stage.id];
      if (!runtime?.startedAt || !rule.maximumMinutes) return false;

      return (
        Date.now() - new Date(runtime.startedAt).getTime() >=
        rule.maximumMinutes * 60_000
      );
    }

    case "manual":
    case "teacher_brain_decision":
      return false;

    default:
      return completed.length === activities.length;
  }
}

function requiredObjectivesMet(
  lesson: TeachingBrainLesson,
  session: TeachingSessionState,
): boolean {
  return lesson.completionCriteria.requiredObjectiveIds.every(
    (objectiveId) => {
      const definition = lesson.objectives.find(
        (objective) => objective.id === objectiveId,
      );
      const runtime = session.objectiveStates[objectiveId];

      return Boolean(
        definition &&
          runtime &&
          runtime.masteryScore >= definition.successThreshold,
      );
    },
  );
}

function lessonCanComplete(
  lesson: TeachingBrainLesson,
  stage: TeachingStage,
  stageSucceeded: boolean,
  session: TeachingSessionState,
): boolean {
  const requiredStagesComplete = lesson.stages
    .filter((item) => item.required)
    .every((item) => {
      if (item.id === stage.id && stageSucceeded) return true;
      return session.stageStates[item.id]?.status === "completed";
    });

  const assessmentMet =
    !lesson.completionCriteria.requireAssessmentCompletion ||
    session.assessment.status === "passed";

  return (
    requiredStagesComplete &&
    requiredObjectivesMet(lesson, session) &&
    assessmentMet
  );
}

function nextActivity(
  stage: TeachingStage,
  currentActivityId: string,
  session: TeachingSessionState,
): TeachingActivity | undefined {
  const activities = orderedActivities(stage);
  const currentIndex = activities.findIndex(
    (activity) => activity.id === currentActivityId,
  );

  return activities.slice(currentIndex + 1).find((activity) => {
    const status = session.activityStates[activity.id]?.status;
    return status !== "completed" && status !== "skipped";
  });
}

function nextStage(
  lesson: TeachingBrainLesson,
  currentStageId: string,
  session: TeachingSessionState,
): TeachingStage | undefined {
  const stages = orderedStages(lesson);
  const currentIndex = stages.findIndex((stage) => stage.id === currentStageId);

  return stages.slice(currentIndex + 1).find((stage) => {
    const status = session.stageStates[stage.id]?.status;
    return status !== "completed" && status !== "skipped";
  });
}

function selectCorrection(
  evaluation: ResponseEvaluation,
): TeachingDecision["correction"] | undefined {
  const errors = evaluation.evidence.detectedErrors ?? [];
  const firstCorrectable = errors.find(
    (error) =>
      error.correction ||
      error.explanation ||
      error.original,
  );

  if (!firstCorrectable) return undefined;

  return {
    original: firstCorrectable.original,
    corrected: firstCorrectable.correction,
    explanation: firstCorrectable.explanation,
    requestRepetition:
      firstCorrectable.type === "pronunciation" ||
      firstCorrectable.type === "grammar" ||
      firstCorrectable.type === "vocabulary",
  };
}

function correctionFocus(
  evaluation: ResponseEvaluation,
): CorrectionFocus[] {
  if (evaluation.recommendedCorrectionFocus?.length) {
    return [...evaluation.recommendedCorrectionFocus];
  }

  const allowed = new Set<CorrectionFocus>([
    "meaning",
    "grammar",
    "vocabulary",
    "pronunciation",
    "fluency",
    "spelling",
    "punctuation",
  ]);

  return [
    ...new Set(
      (evaluation.evidence.detectedErrors ?? [])
        .map((error) => error.type)
        .filter(
          (type): type is CorrectionFocus =>
            allowed.has(type as CorrectionFocus),
        ),
    ),
  ];
}

function availableSupportSteps(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
  runtime: ActivityRuntimeState,
): SupportStep[] {
  const maximumLevel = Math.min(
    lesson.adaptationPolicy.maximumSupportLevel,
    Math.max(
      0,
      ...activity.supportSteps.map((step) => step.level),
    ),
  );

  return [...activity.supportSteps]
    .filter((step) => step.level <= maximumLevel)
    .filter((step) => {
      if (step.maximumUses === undefined) return true;

      const uses = runtime.supportHistory.filter(
        (record) =>
          record.supportLevel === step.level &&
          record.supportType === step.type,
      ).length;

      return uses < step.maximumUses;
    })
    .sort((left, right) => left.level - right.level);
}

function supportStepForType(
  steps: SupportStep[],
  preferredTypes: SupportStepType[],
  minimumLevel: number,
): SupportStep | undefined {
  for (const type of preferredTypes) {
    const exact = steps.find(
      (step) => step.type === type && step.level >= minimumLevel,
    );
    if (exact) return exact;
  }

  return steps.find((step) => step.level >= minimumLevel);
}

function decisionTypeForSupport(
  type: SupportStepType,
): TeachingDecisionType {
  switch (type) {
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
    case "give_first_word":
    case "give_sentence_frame":
      return "give_clue";
    case "show_visual_clue":
    case "show_example":
      return "show_visual_support";
    case "translate_keyword":
    case "translate_instruction":
      return "translate_support";
    case "model_answer":
      return "model_answer";
    case "ask_to_repeat":
      return "request_repetition";
    case "review_prerequisite":
      return "review_prerequisite";
    case "change_activity":
      return "change_activity";
    case "wait":
    default:
      return "continue";
  }
}

function targetStateForStage(stage: TeachingStage): PedagogicalSessionState {
  const allowed = new Set<PedagogicalSessionState>([
    "welcome",
    "readiness_check",
    "previous_lesson_review",
    "warm_up",
    "lesson_introduction",
    "presentation",
    "comprehension_check",
    "guided_practice",
    "communicative_practice",
    "feedback",
    "assessment",
    "summary",
  ]);

  return allowed.has(stage.type as PedagogicalSessionState)
    ? (stage.type as PedagogicalSessionState)
    : "guided_practice";
}

function defaultDirectorHints(
  type: TeachingDecisionType,
): DirectorHints {
  switch (type) {
    case "praise_and_continue":
      return {
        preferredPosition: "near_learner",
        preferredGesture: "thumbs_up",
        facialExpression: "happy",
        speakingPace: "normal",
        allowMovement: true,
        allowAnimation: true,
      };

    case "give_clue":
    case "show_visual_support":
      return {
        preferredPosition: "near_whiteboard",
        preferredGesture: "point",
        facialExpression: "encouraging",
        speakingPace: "slow",
        allowMovement: true,
        allowAnimation: true,
      };

    case "correct_gently":
    case "request_self_correction":
      return {
        preferredPosition: "near_learner",
        preferredGesture: "encourage",
        facialExpression: "encouraging",
        speakingPace: "slow",
        allowMovement: false,
        allowAnimation: true,
      };

    case "model_answer":
      return {
        preferredPosition: "near_whiteboard",
        preferredGesture: "write",
        facialExpression: "encouraging",
        speakingPace: "slow",
        allowMovement: true,
        allowAnimation: true,
      };

    case "complete_lesson":
      return {
        preferredPosition: "center",
        preferredGesture: "clap",
        facialExpression: "celebrating",
        speakingPace: "normal",
        allowMovement: true,
        allowAnimation: true,
      };

    case "pause":
    case "request_human_support":
      return {
        preferredPosition: "center",
        preferredGesture: "listen",
        facialExpression: "concerned",
        speakingPace: "slow",
        allowMovement: false,
        allowAnimation: true,
      };

    default:
      return {
        preferredPosition: "center",
        preferredGesture: "nod",
        facialExpression: "encouraging",
        speakingPace: "normal",
        allowMovement: false,
        allowAnimation: true,
      };
  }
}

/* -------------------------------------------------------------------------- */
/*                          Default Decision Wording                          */
/* -------------------------------------------------------------------------- */

function defaultSpeech(
  type: TeachingDecisionType,
  evaluation: ResponseEvaluation,
): string | undefined {
  switch (type) {
    case "praise_and_continue":
      return evaluation.status === "correct"
        ? "Excellent. That is correct. Let us continue."
        : "Good job. Your answer is clear enough. Let us continue.";

    case "ask_follow_up":
      return "Good answer. Can you tell me a little more?";

    case "continue":
      return "Let us continue.";

    case "request_self_correction":
      return "You are close. Look at your answer once more and try to correct it.";

    case "correct_gently":
      return "Good attempt. Let us correct one small part together.";

    case "give_clue":
      return "Here is a clue. Think about the key word in the question.";

    case "simplify":
      return "Let me make the instruction simpler.";

    case "rephrase":
      return "Let me say the question in another way.";

    case "repeat_instruction":
      return "I will repeat the instruction.";

    case "slow_down":
      return "Let us go more slowly.";

    case "translate_support":
      return "I will give you brief language support, then we will return to the target language.";

    case "show_visual_support":
      return "Look at the visual clue and try again.";

    case "model_answer":
      return "Listen to the model answer, then try it yourself.";

    case "request_repetition":
      return "Please repeat your answer once more.";

    case "review_prerequisite":
      return "Let us quickly review the idea you need before trying again.";

    case "retry_activity":
      return "Let us try this activity again.";

    case "change_activity":
      return "We will practise the same objective in a different way.";

    case "skip_optional_activity":
      return "We can skip this optional activity and continue.";

    case "complete_activity":
      return "You have completed this activity.";

    case "complete_stage":
      return "You have completed this part of the lesson.";

    case "complete_lesson":
      return "Well done. You have completed the lesson.";

    case "pause":
      return "Let us pause here. We can continue when you are ready.";

    case "request_human_support":
      return "This needs help from a teacher or support person.";

    default:
      return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/*                            Decision Construction                           */
/* -------------------------------------------------------------------------- */

function buildDecision(
  input: MakeTeachingDecisionInput,
  context: ResolvedContext,
  candidate: CandidateDecision,
  config: DecisionEngineConfig,
): TeachingDecision {
  const { session, evaluation } = input;
  const speech =
    candidate.speechContent ??
    (config.includeDefaultSpeechContent === false
      ? undefined
      : defaultSpeech(candidate.type, evaluation));

  return {
    id: createId("decision"),
    sessionId: session.id,
    stageId: context.stage.id,
    activityId: context.activity.id,
    learnerTurnId: evaluation.learnerTurnId,
    type: candidate.type,
    reason: candidate.reason,
    priority: candidate.priority,
    supportLevel: candidate.supportLevel,
    messageIntent: candidate.messageIntent,
    speechContent: speech,
    textContent: candidate.textContent ?? speech,
    correction: candidate.correction,
    targetState: candidate.targetState,
    targetStageId: candidate.targetStageId,
    targetActivityId: candidate.targetActivityId,
    shouldWaitForLearner: candidate.shouldWaitForLearner,
    expectedInputModality: candidate.expectedInputModality,
    directorHints:
      candidate.directorHints ??
      defaultDirectorHints(candidate.type),
    createdAt: nowIso(config),
    metadata: {
      selectedSupportStep: candidate.selectedSupportStep
        ? {
            level: candidate.selectedSupportStep.level,
            type: candidate.selectedSupportStep.type,
          }
        : undefined,
      ...candidate.metadata,
      ...input.metadata,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                         Deterministic Policy Engine                        */
/* -------------------------------------------------------------------------- */

function selectDeterministicCandidate(
  input: MakeTeachingDecisionInput,
  context: ResolvedContext,
  facts: DecisionFacts,
  config: Required<Omit<DecisionEngineConfig, "provider" | "now">>,
): CandidateDecision {
  const { lesson, evaluation } = input;
  const { stage, activity, activityRuntime } = context;
  const steps = availableSupportSteps(lesson, activity, activityRuntime);
  const nextSupportLevel = Math.min(
    lesson.adaptationPolicy.maximumSupportLevel,
    Math.max(1, facts.currentSupportLevel + 1),
  );

  const withSupport = (
    step: SupportStep,
    reason: TeachingDecisionReason,
    priority: TeachingDecision["priority"] = "normal",
  ): CandidateDecision => ({
    type: decisionTypeForSupport(step.type),
    reason,
    priority,
    supportLevel: step.level,
    messageIntent:
      step.type === "model_answer"
        ? "explain"
        : step.type === "translate_instruction" ||
            step.type === "translate_keyword"
          ? "clarify"
          : "prompt",
    speechContent: step.instruction ?? step.content,
    textContent: step.content ?? step.instruction,
    targetState: targetStateForStage(stage),
    shouldWaitForLearner: step.type !== "wait",
    expectedInputModality: activity.inputModality,
    selectedSupportStep: step,
    directorHints:
      step.type === "show_visual_clue" ||
      step.type === "show_example"
        ? {
            ...defaultDirectorHints("show_visual_support"),
            boardActions: [
              {
                type:
                  step.type === "show_example"
                    ? "show_sentence"
                    : "show_question",
                content: step.content ?? step.instruction,
                preserveExistingContent: true,
              },
            ],
          }
        : undefined,
  });

  if (input.learnerReady === false) {
    return {
      type: "pause",
      reason: "readiness_constraint",
      priority: "high",
      supportLevel: facts.currentSupportLevel,
      messageIntent: "encourage",
      targetState: "paused",
      shouldWaitForLearner: false,
    };
  }

  if (
    input.timeRemainingMinutes !== undefined &&
    input.timeRemainingMinutes <= 0
  ) {
    return {
      type: "pause",
      reason: "time_constraint",
      priority: "high",
      supportLevel: facts.currentSupportLevel,
      messageIntent: "summarize",
      targetState: "paused",
      shouldWaitForLearner: false,
    };
  }

  if (facts.lowConfidence) {
    return {
      type: "request_repetition",
      reason: "low_confidence_evaluation",
      priority: "normal",
      supportLevel: facts.currentSupportLevel,
      messageIntent: "clarify",
      targetState: targetStateForStage(stage),
      shouldWaitForLearner: true,
      expectedInputModality: activity.inputModality,
    };
  }

  if (evaluation.status === "help_requested") {
    const helpStep = supportStepForType(
      steps,
      [
        "simplify_instruction",
        "rephrase",
        "give_general_clue",
        "give_specific_clue",
        "translate_instruction",
        "show_example",
      ],
      nextSupportLevel,
    );

    if (helpStep) {
      return withSupport(helpStep, "learner_requested_help", "high");
    }

    return {
      type: input.humanSupportAvailable
        ? "request_human_support"
        : "model_answer",
      reason: "learner_requested_help",
      priority: "high",
      supportLevel: facts.currentSupportLevel,
      messageIntent: input.humanSupportAvailable
        ? "clarify"
        : "explain",
      targetState: targetStateForStage(stage),
      shouldWaitForLearner: !input.humanSupportAvailable,
      expectedInputModality: activity.inputModality,
    };
  }

  if (evaluation.status === "no_response") {
    if (
      facts.consecutiveFailureCount >=
      config.noResponsePauseThreshold
    ) {
      return {
        type: "pause",
        reason: "no_response",
        priority: "high",
        supportLevel: facts.currentSupportLevel,
        messageIntent: "encourage",
        targetState: "paused",
        shouldWaitForLearner: false,
      };
    }

    const noResponseStep = supportStepForType(
      steps,
      [
        "wait",
        "repeat_instruction",
        "slow_down",
        "simplify_instruction",
        "show_visual_clue",
      ],
      nextSupportLevel,
    );

    if (noResponseStep) {
      return withSupport(noResponseStep, "no_response");
    }

    return {
      type: "repeat_instruction",
      reason: "no_response",
      priority: "normal",
      supportLevel: facts.currentSupportLevel,
      messageIntent: "instruct",
      targetState: targetStateForStage(stage),
      shouldWaitForLearner: true,
      expectedInputModality: activity.inputModality,
    };
  }

  if (evaluation.status === "off_topic") {
    const rephraseStep = supportStepForType(
      steps,
      ["rephrase", "repeat_instruction", "simplify_instruction"],
      nextSupportLevel,
    );

    if (rephraseStep) {
      return withSupport(rephraseStep, "off_topic_response");
    }

    return {
      type: "rephrase",
      reason: "off_topic_response",
      priority: "normal",
      supportLevel: facts.currentSupportLevel,
      messageIntent: "clarify",
      targetState: targetStateForStage(stage),
      shouldWaitForLearner: true,
      expectedInputModality: activity.inputModality,
    };
  }

  if (facts.activityRuleMet) {
    if (facts.stageRuleMet) {
      if (facts.lessonCanComplete) {
        return {
          type: "complete_lesson",
          reason: "lesson_completion_rule_met",
          priority: "high",
          supportLevel: facts.currentSupportLevel,
          messageIntent: "close",
          targetState: "session_end",
          shouldWaitForLearner: false,
        };
      }

      const followingStage = nextStage(
        lesson,
        stage.id,
        input.session,
      );

      return {
        type: "complete_stage",
        reason: "stage_completion_rule_met",
        priority: "normal",
        supportLevel: facts.currentSupportLevel,
        messageIntent: "transition",
        targetState: followingStage
          ? targetStateForStage(followingStage)
          : "next_step",
        targetStageId: followingStage?.id,
        shouldWaitForLearner: false,
      };
    }

    const followingActivity = nextActivity(
      stage,
      activity.id,
      input.session,
    );

    return {
      type:
        evaluation.score >= config.praiseMinimumScore
          ? "praise_and_continue"
          : "complete_activity",
      reason: "activity_success_rule_met",
      priority: "normal",
      supportLevel: facts.currentSupportLevel,
      messageIntent:
        evaluation.score >= config.praiseMinimumScore
          ? "praise"
          : "transition",
      targetState: targetStateForStage(stage),
      targetActivityId: followingActivity?.id,
      shouldWaitForLearner: false,
    };
  }

  if (
    evaluation.status === "correct" &&
    evaluation.score >= config.followUpMinimumScore &&
    activity.type === "open_question" &&
    facts.attemptsRemaining > 0
  ) {
    return {
      type: "ask_follow_up",
      reason: "correct_response",
      priority: "low",
      supportLevel: facts.currentSupportLevel,
      messageIntent: "ask",
      targetState: targetStateForStage(stage),
      shouldWaitForLearner: true,
      expectedInputModality: activity.inputModality,
    };
  }

  if (isSuccessfulStatus(evaluation.status)) {
    return {
      type: "continue",
      reason:
        evaluation.status === "correct"
          ? "correct_response"
          : "partial_success",
      priority: "low",
      supportLevel: facts.currentSupportLevel,
      messageIntent:
        evaluation.status === "correct"
          ? "praise"
          : "encourage",
      targetState: targetStateForStage(stage),
      shouldWaitForLearner:
        activity.minimumAttempts >
        facts.attemptsUsed + 1,
      expectedInputModality: activity.inputModality,
    };
  }

  if (facts.attemptsExhausted) {
    if (
      lesson.adaptationPolicy.allowActivityReplacement &&
      activity.allowAlternativeActivity &&
      activity.alternativeActivityId
    ) {
      return {
        type: "change_activity",
        reason: "activity_attempt_limit_reached",
        priority: "high",
        supportLevel: facts.currentSupportLevel,
        messageIntent: "transition",
        targetState: targetStateForStage(stage),
        targetActivityId: activity.alternativeActivityId,
        shouldWaitForLearner: false,
      };
    }

    if (
      !activity.required &&
      activity.allowSkip &&
      lesson.adaptationPolicy.allowStageSkipping
    ) {
      return {
        type: "skip_optional_activity",
        reason: "activity_attempt_limit_reached",
        priority: "normal",
        supportLevel: facts.currentSupportLevel,
        messageIntent: "transition",
        targetState: targetStateForStage(stage),
        shouldWaitForLearner: false,
      };
    }

    if (
      lesson.adaptationPolicy.allowPrerequisiteReview &&
      activity.targetObjectiveIds.some((objectiveId) => {
        const objective = lesson.objectives.find(
          (item) => item.id === objectiveId,
        );
        return Boolean(objective?.prerequisiteObjectiveIds?.length);
      })
    ) {
      return {
        type: "review_prerequisite",
        reason: "activity_attempt_limit_reached",
        priority: "high",
        supportLevel: facts.currentSupportLevel,
        messageIntent: "explain",
        targetState: targetStateForStage(stage),
        shouldWaitForLearner: true,
        expectedInputModality: activity.inputModality,
      };
    }

    const modelStep = supportStepForType(
      steps,
      ["model_answer", "show_example"],
      facts.currentSupportLevel,
    );

    if (modelStep) {
      return withSupport(
        modelStep,
        "activity_attempt_limit_reached",
        "high",
      );
    }

    return {
      type: input.humanSupportAvailable
        ? "request_human_support"
        : "model_answer",
      reason: "activity_attempt_limit_reached",
      priority: "high",
      supportLevel: facts.currentSupportLevel,
      messageIntent: "explain",
      targetState: targetStateForStage(stage),
      shouldWaitForLearner: !input.humanSupportAvailable,
      expectedInputModality: activity.inputModality,
    };
  }

  if (
    evaluation.shouldCorrect &&
    evaluation.score >= config.selfCorrectionMinimumScore &&
    lesson.correctionPolicy.askLearnerToSelfCorrect &&
    facts.repeatedErrorCount < config.repeatedErrorThreshold
  ) {
    return {
      type: "request_self_correction",
      reason:
        evaluation.status === "partly_correct"
          ? "partial_success"
          : "incorrect_response",
      priority: "normal",
      supportLevel: facts.currentSupportLevel,
      messageIntent: "correct",
      correction: selectCorrection(evaluation),
      targetState: targetStateForStage(stage),
      shouldWaitForLearner: true,
      expectedInputModality: activity.inputModality,
    };
  }

  if (
    facts.repeatedErrorCount >= config.repeatedErrorThreshold
  ) {
    const repeatedStep = supportStepForType(
      steps,
      [
        "show_example",
        "give_sentence_frame",
        "model_answer",
        "review_prerequisite",
        "change_activity",
      ],
      nextSupportLevel,
    );

    if (repeatedStep) {
      return withSupport(repeatedStep, "repeated_error", "high");
    }
  }

  const meaningBreakdown =
    evaluation.meaning === "incorrect" ||
    evaluation.evidence.detectedErrors?.some(
      (error) =>
        error.type === "meaning" &&
        error.severity === "major",
    );

  if (meaningBreakdown) {
    const meaningStep = supportStepForType(
      steps,
      [
        "simplify_instruction",
        "rephrase",
        "give_general_clue",
        "show_visual_clue",
        "translate_instruction",
      ],
      nextSupportLevel,
    );

    if (meaningStep) {
      return withSupport(meaningStep, "meaning_breakdown", "high");
    }
  }

  const nextStep = supportStepForType(
    steps,
    [
      "give_general_clue",
      "give_specific_clue",
      "give_first_word",
      "give_sentence_frame",
      "show_example",
      "model_answer",
    ],
    nextSupportLevel,
  );

  if (nextStep) {
    return withSupport(
      nextStep,
      evaluation.status === "partly_correct"
        ? "partial_success"
        : "incorrect_response",
    );
  }

  if (evaluation.shouldCorrect) {
    return {
      type: "correct_gently",
      reason:
        evaluation.status === "partly_correct"
          ? "partial_success"
          : "incorrect_response",
      priority: "normal",
      supportLevel: facts.currentSupportLevel,
      messageIntent: "correct",
      correction: selectCorrection(evaluation),
      targetState: targetStateForStage(stage),
      shouldWaitForLearner:
        lesson.correctionPolicy.provideModelAfterFailedSelfCorrection,
      expectedInputModality: activity.inputModality,
    };
  }

  return {
    type: "retry_activity",
    reason: "incorrect_response",
    priority: "normal",
    supportLevel: facts.currentSupportLevel,
    messageIntent: "encourage",
    targetState: targetStateForStage(stage),
    shouldWaitForLearner: true,
    expectedInputModality: activity.inputModality,
  };
}

/* -------------------------------------------------------------------------- */
/*                             Error Mapping                                  */
/* -------------------------------------------------------------------------- */

function toTeachingBrainError(
  error: unknown,
  input?: Partial<MakeTeachingDecisionInput>,
): TeachingBrainError {
  if (error instanceof DecisionEngineError) {
    return {
      code:
        error.code === "STAGE_NOT_FOUND"
          ? "STAGE_NOT_FOUND"
          : error.code === "ACTIVITY_NOT_FOUND"
            ? "ACTIVITY_NOT_FOUND"
            : error.code === "SESSION_CONTEXT_MISMATCH"
              ? "INVALID_SESSION"
              : "DECISION_FAILED",
      message: error.message,
      sessionId: input?.session?.id,
      lessonId: input?.lesson?.id,
      stageId: input?.session?.activeStageId,
      activityId: input?.session?.activeActivityId,
      recoverable: error.recoverable,
      details: error.details,
    };
  }

  return {
    code: "DECISION_FAILED",
    message:
      error instanceof Error
        ? error.message
        : "An unknown decision engine error occurred.",
    sessionId: input?.session?.id,
    lessonId: input?.lesson?.id,
    stageId: input?.session?.activeStageId,
    activityId: input?.session?.activeActivityId,
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
/*                           Main Decision Engine                             */
/* -------------------------------------------------------------------------- */

export class TeachingDecisionEngine {
  private readonly config: Required<
    Omit<DecisionEngineConfig, "provider" | "now">
  > &
    Pick<DecisionEngineConfig, "provider" | "now">;

  constructor(config: DecisionEngineConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      provider: config.provider,
      now: config.now,
    };

    this.validateConfig();
  }

  async decide(
    input: MakeTeachingDecisionInput,
  ): Promise<DetailedTeachingDecision> {
    this.validateInput(input);
    const context = this.resolveContext(input);

    const facts = this.buildFacts(input, context);
    const consideredDecisions: TeachingDecisionType[] = [];
    const notes: string[] = [];

    const candidate = selectDeterministicCandidate(
      input,
      context,
      facts,
      this.config,
    );
    consideredDecisions.push(candidate.type);

    let decision = buildDecision(
      input,
      context,
      candidate,
      this.config,
    );

    if (
      this.config.mode === "provider_only" &&
      !this.config.provider
    ) {
      throw new DecisionEngineError(
        "PROVIDER_REQUIRED",
        "Provider-only decision mode requires a teaching decision provider.",
        { recoverable: false },
      );
    }

    if (
      this.config.provider &&
      this.config.mode !== "deterministic"
    ) {
      try {
        const providerResult = await this.config.provider.decide({
          lesson: input.lesson,
          session: input.session,
          stage: context.stage,
          activity: context.activity,
          activityRuntime: context.activityRuntime,
          stageRuntime: context.stageRuntime,
          evaluation: input.evaluation,
          deterministicDecision: decision,
        });

        decision = this.mergeProviderDecision(
          decision,
          providerResult,
          input,
          context,
        );
        consideredDecisions.push(providerResult.type);
      } catch (error) {
        if (this.config.mode === "provider_only") {
          throw new DecisionEngineError(
            "PROVIDER_FAILED",
            "The teaching decision provider failed.",
            { cause: error, recoverable: true },
          );
        }

        notes.push(
          `Provider decision failed; deterministic decision retained: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return {
      decision,
      diagnostics: {
        attemptsUsed: facts.attemptsUsed,
        attemptsRemaining: facts.attemptsRemaining,
        currentSupportLevel: facts.currentSupportLevel,
        consecutiveFailureCount: facts.consecutiveFailureCount,
        repeatedErrorCount: facts.repeatedErrorCount,
        activityRuleMet: facts.activityRuleMet,
        stageRuleMet: facts.stageRuleMet,
        lessonCanComplete: facts.lessonCanComplete,
        selectedSupportStep: candidate.selectedSupportStep,
        consideredDecisions,
        notes,
      },
    };
  }

  async safeDecide(
    input: MakeTeachingDecisionInput,
  ): Promise<SafeDecisionResult> {
    try {
      return {
        ok: true,
        data: await this.decide(input),
      };
    } catch (error) {
      return {
        ok: false,
        error: toTeachingBrainError(error, input),
      };
    }
  }

  private validateConfig(): void {
    const percentages = [
      this.config.praiseMinimumScore,
      this.config.followUpMinimumScore,
      this.config.selfCorrectionMinimumScore,
    ];

    if (
      percentages.some(
        (value) =>
          !Number.isFinite(value) ||
          value < 0 ||
          value > 100,
      )
    ) {
      throw new DecisionEngineError(
        "INVALID_INPUT",
        "Decision score thresholds must be between 0 and 100.",
        { recoverable: false },
      );
    }

    if (
      !Number.isFinite(
        this.config.lowEvaluationConfidenceThreshold,
      ) ||
      this.config.lowEvaluationConfidenceThreshold < 0 ||
      this.config.lowEvaluationConfidenceThreshold > 1
    ) {
      throw new DecisionEngineError(
        "INVALID_INPUT",
        "The low-confidence threshold must be between 0 and 1.",
        { recoverable: false },
      );
    }

    if (
      this.config.repeatedErrorThreshold < 1 ||
      this.config.noResponsePauseThreshold < 1
    ) {
      throw new DecisionEngineError(
        "INVALID_INPUT",
        "Repeated-error and no-response thresholds must be positive integers.",
        { recoverable: false },
      );
    }
  }

  private validateInput(input: MakeTeachingDecisionInput): void {
    if (!input.lesson?.id) {
      throw new DecisionEngineError(
        "INVALID_INPUT",
        "A valid TeachingBrainLesson is required.",
      );
    }

    if (!input.session?.id) {
      throw new DecisionEngineError(
        "INVALID_INPUT",
        "A valid TeachingSessionState is required.",
      );
    }

    if (!input.evaluation?.learnerTurnId) {
      throw new DecisionEngineError(
        "INVALID_INPUT",
        "A valid ResponseEvaluation is required.",
      );
    }

    if (input.session.lessonId !== input.lesson.id) {
      throw new DecisionEngineError(
        "SESSION_CONTEXT_MISMATCH",
        `Session lesson "${input.session.lessonId}" does not match lesson "${input.lesson.id}".`,
      );
    }

    if (
      input.session.status === "completed" ||
      input.session.status === "abandoned" ||
      input.session.status === "expired" ||
      input.session.status === "error"
    ) {
      throw new DecisionEngineError(
        "SESSION_TERMINAL",
        `Cannot make a teaching decision for a ${input.session.status} session.`,
      );
    }

    if (input.session.status !== "active") {
      throw new DecisionEngineError(
        "SESSION_NOT_ACTIVE",
        `The session must be active. Current status: ${input.session.status}.`,
      );
    }
  }

  private resolveContext(
    input: MakeTeachingDecisionInput,
  ): ResolvedContext {
    const { lesson, session } = input;

    const activityId =
      input.activity?.id ??
      session.activeActivityId;

    if (!activityId) {
      throw new DecisionEngineError(
        "ACTIVITY_NOT_FOUND",
        "The session has no active activity.",
      );
    }

    const found =
      input.activity && input.stage
        ? { stage: input.stage, activity: input.activity }
        : findActivity(lesson, activityId);

    if (!found) {
      throw new DecisionEngineError(
        "ACTIVITY_NOT_FOUND",
        `Activity "${activityId}" was not found in lesson "${lesson.id}".`,
      );
    }

    const stage =
      input.stage ??
      findStage(
        lesson,
        session.activeStageId ?? found.stage.id,
      ) ??
      found.stage;

    if (!stage) {
      throw new DecisionEngineError(
        "STAGE_NOT_FOUND",
        `The active stage was not found in lesson "${lesson.id}".`,
      );
    }

    if (
      session.activeActivityId &&
      session.activeActivityId !== found.activity.id
    ) {
      throw new DecisionEngineError(
        "SESSION_CONTEXT_MISMATCH",
        "The supplied activity does not match the session's active activity.",
      );
    }

    if (
      session.activeStageId &&
      session.activeStageId !== stage.id
    ) {
      throw new DecisionEngineError(
        "SESSION_CONTEXT_MISMATCH",
        "The supplied stage does not match the session's active stage.",
      );
    }

    if (
      !stage.activities.some(
        (activity) => activity.id === found.activity.id,
      )
    ) {
      throw new DecisionEngineError(
        "SESSION_CONTEXT_MISMATCH",
        `Activity "${found.activity.id}" does not belong to stage "${stage.id}".`,
      );
    }

    const activityRuntime =
      session.activityStates[found.activity.id];
    const stageRuntime = session.stageStates[stage.id];

    if (!activityRuntime) {
      throw new DecisionEngineError(
        "SESSION_CONTEXT_MISMATCH",
        `Runtime state for activity "${found.activity.id}" is missing.`,
      );
    }

    if (!stageRuntime) {
      throw new DecisionEngineError(
        "SESSION_CONTEXT_MISMATCH",
        `Runtime state for stage "${stage.id}" is missing.`,
      );
    }

    return {
      stage,
      activity: found.activity,
      stageRuntime,
      activityRuntime,
    };
  }

  private buildFacts(
    input: MakeTeachingDecisionInput,
    context: ResolvedContext,
  ): DecisionFacts {
    const attemptsUsed = context.activityRuntime.attempts.length;
    const attemptsRemaining = Math.max(
      0,
      context.activity.maximumAttempts -
        (attemptsUsed + 1),
    );

    const activitySucceeded = activityRuleMet(
      context.activity,
      context.activityRuntime,
      input.evaluation,
    );

    const stageSucceeded = stageRuleMet(
      context.stage,
      context.activity,
      activitySucceeded,
      input.session,
    );

    return {
      attemptsUsed,
      attemptsRemaining,
      currentSupportLevel:
        context.activityRuntime.currentSupportLevel,
      consecutiveFailureCount: countConsecutiveFailures(
        context.activityRuntime,
        input.evaluation,
      ),
      repeatedErrorCount: countRepeatedErrors(
        input.evaluation,
        input.previousEvaluations ?? [],
      ),
      activityRuleMet: activitySucceeded,
      stageRuleMet: stageSucceeded,
      lessonCanComplete: lessonCanComplete(
        input.lesson,
        context.stage,
        stageSucceeded,
        input.session,
      ),
      lowConfidence:
        normalizeConfidence(input.evaluation.confidence) <
        this.config.lowEvaluationConfidenceThreshold,
      attemptsExhausted:
        attemptsUsed + 1 >= context.activity.maximumAttempts,
      correctionFocus: correctionFocus(input.evaluation),
    };
  }

  private mergeProviderDecision(
    deterministic: TeachingDecision,
    provider: DecisionProviderResult,
    input: MakeTeachingDecisionInput,
    context: ResolvedContext,
  ): TeachingDecision {
    const progressionTypes = new Set<TeachingDecisionType>([
      "complete_activity",
      "complete_stage",
      "complete_lesson",
      "skip_optional_activity",
      "change_activity",
    ]);

    const providerType =
      progressionTypes.has(provider.type) &&
      !this.config.allowProviderToOverrideProgression
        ? deterministic.type
        : provider.type;

    return {
      ...deterministic,
      type: providerType,
      reason: provider.reason ?? deterministic.reason,
      priority: provider.priority ?? deterministic.priority,
      supportLevel:
        provider.supportLevel ?? deterministic.supportLevel,
      messageIntent:
        provider.messageIntent ?? deterministic.messageIntent,
      speechContent:
        provider.speechContent ?? deterministic.speechContent,
      textContent:
        provider.textContent ?? deterministic.textContent,
      correction:
        provider.correction ?? deterministic.correction,
      targetState:
        provider.targetState ?? deterministic.targetState,
      targetStageId:
        provider.targetStageId ?? deterministic.targetStageId,
      targetActivityId:
        provider.targetActivityId ??
        deterministic.targetActivityId,
      shouldWaitForLearner:
        provider.shouldWaitForLearner ??
        deterministic.shouldWaitForLearner,
      expectedInputModality:
        provider.expectedInputModality ??
        deterministic.expectedInputModality,
      directorHints:
        provider.directorHints ??
        deterministic.directorHints,
      createdAt: nowIso(this.config),
      metadata: {
        ...deterministic.metadata,
        providerConfidence: provider.confidence,
        providerSuggestedType: provider.type,
        providerProgressionOverrideAllowed:
          this.config.allowProviderToOverrideProgression,
        ...provider.metadata,
        ...input.metadata,
        stageId: context.stage.id,
        activityId: context.activity.id,
      },
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                          Functional Service API                            */
/* -------------------------------------------------------------------------- */

export function createTeachingDecisionEngine(
  config: DecisionEngineConfig = {},
): TeachingDecisionEngine {
  return new TeachingDecisionEngine(config);
}

export async function makeTeachingDecision(
  input: MakeTeachingDecisionInput,
  config: DecisionEngineConfig = {},
): Promise<DetailedTeachingDecision> {
  return new TeachingDecisionEngine(config).decide(input);
}

export async function safeMakeTeachingDecision(
  input: MakeTeachingDecisionInput,
  config: DecisionEngineConfig = {},
): Promise<SafeDecisionResult> {
  return new TeachingDecisionEngine(config).safeDecide(input);
}

/**
 * Returns the session-engine action represented by a decision.
 * This keeps the Decision Engine independent from a concrete session instance.
 */
export function decisionToSessionAction(
  decision: TeachingDecision,
):
  | {
      action: "record_only";
    }
  | {
      action: "use_support";
      level: number;
      type: string;
      content?: string;
    }
  | {
      action: "complete_activity";
      reason: string;
    }
  | {
      action: "complete_stage";
      reason: string;
    }
  | {
      action: "complete_lesson";
      reason: string;
    }
  | {
      action: "skip_activity";
      reason: string;
    }
  | {
      action: "change_activity";
      reason: string;
    }
  | {
      action: "pause";
      reason: string;
    } {
  const support = decision.metadata?.selectedSupportStep as
    | { level?: number; type?: string }
    | undefined;

  if (
    support?.type &&
    typeof support.level === "number"
  ) {
    return {
      action: "use_support",
      level: support.level,
      type: support.type,
      content:
        decision.textContent ??
        decision.speechContent,
    };
  }

  switch (decision.type) {
    case "complete_activity":
    case "praise_and_continue":
      return {
        action: "complete_activity",
        reason: decision.reason,
      };

    case "complete_stage":
      return {
        action: "complete_stage",
        reason: decision.reason,
      };

    case "complete_lesson":
      return {
        action: "complete_lesson",
        reason: decision.reason,
      };

    case "skip_optional_activity":
      return {
        action: "skip_activity",
        reason: decision.reason,
      };

    case "change_activity":
      return {
        action: "change_activity",
        reason: decision.reason,
      };

    case "pause":
      return {
        action: "pause",
        reason: decision.reason,
      };

    default:
      return { action: "record_only" };
  }
}

export const TeachingDecisionService = {
  create: createTeachingDecisionEngine,
  decide: makeTeachingDecision,
  safeDecide: safeMakeTeachingDecision,
  toSessionAction: decisionToSessionAction,
};
