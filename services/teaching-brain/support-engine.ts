/**
 * Elvy Teaching Brain
 * Support content engine
 *
 * File: services/teaching-brain/support-engine.ts
 *
 * Responsibilities:
 * - turn a TeachingDecision into concrete learner-facing support
 * - resolve lesson/activity support steps
 * - enforce L1 policy and consecutive-L1 limits
 * - produce speech, text, whiteboard, media, and Director instructions
 * - preserve the Decision Engine as the authority for pedagogical choice
 *
 * Deliberately excluded:
 * - evaluating learner responses (response-evaluator.ts)
 * - choosing the pedagogical action (decision-engine.ts)
 * - mutating the teaching session (session-engine.ts)
 * - final lesson completion decisions (lesson-completion.ts)
 */

import type {
  BoardAction,
  CorrectionPolicy,
  DirectorHints,
  ExpectedResponse,
  InputModality,
  L1SupportPolicy,
  L1SupportTrigger,
  LanguageCode,
  OutputModality,
  ResponseEvaluation,
  SupportStep,
  SupportStepType,
  TeachingActivity,
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
  TeachingDecision,
  TeachingDecisionType,
  TeachingStage,
  VocabularyItem,
} from "./types";

import type {
  ActivityRuntimeState,
  TeachingSessionState,
} from "./session-engine";

/* -------------------------------------------------------------------------- */
/*                               Public Types                                 */
/* -------------------------------------------------------------------------- */

export type SupportEngineMode =
  | "deterministic"
  | "provider_assisted"
  | "provider_only";

export type SupportChannel =
  | "speech"
  | "text"
  | "whiteboard"
  | "image"
  | "audio"
  | "video"
  | "animation";

export type SupportContentKind =
  | "instruction"
  | "repetition"
  | "simplification"
  | "rephrase"
  | "general_clue"
  | "specific_clue"
  | "first_word"
  | "sentence_frame"
  | "visual_clue"
  | "example"
  | "keyword_translation"
  | "instruction_translation"
  | "model_answer"
  | "correction"
  | "pronunciation_model"
  | "prerequisite_review"
  | "transition"
  | "praise"
  | "pause"
  | "human_support"
  | "generic";

export type SupportMedia = {
  type: "image" | "audio" | "video";
  reference?: string;
  prompt?: string;
  altText?: string;
  autoplay?: boolean;
  metadata?: Record<string, unknown>;
};

export type SupportDelivery = {
  id: string;

  sessionId: string;
  lessonId: string;
  stageId: string;
  activityId: string;
  decisionId: string;

  kind: SupportContentKind;
  supportType?: SupportStepType;
  supportLevel: number;

  speech?: string;
  text?: string;

  language: LanguageCode;
  usesL1: boolean;
  returnToTargetLanguage: boolean;

  boardActions: BoardAction[];
  media: SupportMedia[];

  directorHints: DirectorHints;

  shouldWaitForLearner: boolean;
  expectedInputModality?: InputModality;

  recordSupportUsage: boolean;

  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type SupportProviderInput = {
  lesson: TeachingBrainLesson;
  session: TeachingSessionState;
  stage: TeachingStage;
  activity: TeachingActivity;
  activityRuntime: ActivityRuntimeState;
  decision: TeachingDecision;
  evaluation?: ResponseEvaluation;
  selectedStep?: SupportStep;
  deterministicDelivery: SupportDelivery;
  learnerName?: string;
};

export type SupportProviderResult = {
  speech?: string;
  text?: string;
  language?: LanguageCode;
  usesL1?: boolean;
  returnToTargetLanguage?: boolean;
  boardActions?: BoardAction[];
  media?: SupportMedia[];
  directorHints?: DirectorHints;
  shouldWaitForLearner?: boolean;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export interface TeachingSupportProvider {
  generate(input: SupportProviderInput): Promise<SupportProviderResult>;
}

export type TranslationProviderInput = {
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  purpose: "instruction" | "keyword" | "grammar" | "support";
  lesson: TeachingBrainLesson;
  activity: TeachingActivity;
};

export interface TeachingTranslationProvider {
  translate(input: TranslationProviderInput): Promise<string>;
}

export type SupportEngineConfig = {
  mode?: SupportEngineMode;

  provider?: TeachingSupportProvider;
  translationProvider?: TeachingTranslationProvider;

  defaultLearnerL1?: LanguageCode;
  fallbackLanguage?: LanguageCode;

  includePositiveFraming?: boolean;
  appendRetryPrompt?: boolean;
  enforceMaximumSentenceLength?: boolean;
  allowMetadataTranslations?: boolean;
  allowProviderToEnableL1?: boolean;

  now?: () => string;
};

export type GenerateSupportInput = {
  lesson: TeachingBrainLesson;
  session: TeachingSessionState;
  decision: TeachingDecision;

  stage?: TeachingStage;
  activity?: TeachingActivity;
  evaluation?: ResponseEvaluation;

  learnerName?: string;
  learnerL1?: LanguageCode;

  consecutiveL1Turns?: number;
  requestedL1?: boolean;
  l1Trigger?: L1SupportTrigger;

  preferredChannels?: SupportChannel[];

  metadata?: Record<string, unknown>;
};

export type SupportDiagnostics = {
  selectedStep?: SupportStep;
  selectedStepSource:
    | "decision_metadata"
    | "activity_match"
    | "activity_level"
    | "generated_fallback"
    | "none";

  l1Requested: boolean;
  l1Allowed: boolean;
  l1Reason?: string;

  maximumSentenceLength?: number;
  truncatedForTonePolicy: boolean;

  providerUsed: boolean;
  fallbackUsed: boolean;

  notes: string[];
};

export type DetailedSupportDelivery = {
  delivery: SupportDelivery;
  diagnostics: SupportDiagnostics;
};

export type SafeSupportResult =
  TeachingBrainResult<DetailedSupportDelivery>;

export type SupportEngineErrorCode =
  | "INVALID_INPUT"
  | "SESSION_CONTEXT_MISMATCH"
  | "STAGE_NOT_FOUND"
  | "ACTIVITY_NOT_FOUND"
  | "DECISION_CONTEXT_MISMATCH"
  | "SUPPORT_STEP_NOT_FOUND"
  | "L1_NOT_ALLOWED"
  | "TRANSLATION_UNAVAILABLE"
  | "PROVIDER_REQUIRED"
  | "PROVIDER_FAILED"
  | "SUPPORT_GENERATION_FAILED";

export class SupportEngineError extends Error {
  readonly code: SupportEngineErrorCode;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: SupportEngineErrorCode,
    message: string,
    options?: {
      recoverable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "SupportEngineError";
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
  activityRuntime: ActivityRuntimeState;
};

type ResolvedSupportStep = {
  step?: SupportStep;
  source: SupportDiagnostics["selectedStepSource"];
};

type L1Decision = {
  requested: boolean;
  allowed: boolean;
  language: LanguageCode;
  trigger?: L1SupportTrigger;
  reason?: string;
};

type GeneratedContent = {
  kind: SupportContentKind;
  speech?: string;
  text?: string;
  boardActions: BoardAction[];
  media: SupportMedia[];
  directorHints: DirectorHints;
  recordSupportUsage: boolean;
};

/* -------------------------------------------------------------------------- */
/*                               Defaults                                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_CONFIG: Required<
  Omit<
    SupportEngineConfig,
    "provider" | "translationProvider" | "now"
  >
> = {
  mode: "deterministic",
  defaultLearnerL1: "other",
  fallbackLanguage: "en",
  includePositiveFraming: true,
  appendRetryPrompt: true,
  enforceMaximumSentenceLength: true,
  allowMetadataTranslations: true,
  allowProviderToEnableL1: false,
};

const SUPPORT_DECISION_TYPES = new Set<TeachingDecisionType>([
  "give_clue",
  "simplify",
  "rephrase",
  "model_answer",
  "correct_gently",
  "request_self_correction",
  "request_repetition",
  "repeat_instruction",
  "slow_down",
  "translate_support",
  "show_visual_support",
  "review_prerequisite",
  "retry_activity",
  "change_activity",
]);

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

function nowIso(config: SupportEngineConfig): string {
  const raw = config.now?.() ?? new Date().toISOString();
  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
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

function mergeDirectorHints(
  base: DirectorHints,
  override?: DirectorHints,
): DirectorHints {
  return {
    ...base,
    ...override,
    boardActions: [
      ...(base.boardActions ?? []),
      ...(override?.boardActions ?? []),
    ],
  };
}

function mergeL1Policy(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
): L1SupportPolicy {
  return {
    ...lesson.l1Policy,
    ...(activity.l1Override ?? {}),
    allowedTriggers:
      activity.l1Override?.allowedTriggers ??
      lesson.l1Policy.allowedTriggers,
  };
}

function mergeCorrectionPolicy(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
): CorrectionPolicy {
  return {
    ...lesson.correctionPolicy,
    ...(activity.correctionOverride ?? {}),
    priorityFocuses:
      activity.correctionOverride?.priorityFocuses ??
      lesson.correctionPolicy.priorityFocuses,
  };
}

function stepUsesL1(step: SupportStep | undefined): boolean {
  return Boolean(
    step?.useL1 ||
      step?.type === "translate_instruction" ||
      step?.type === "translate_keyword",
  );
}

function metadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? clean(value) : undefined;
}

function metadataStringArray(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const value = metadata?.[key];

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function expectedModel(activity: TeachingActivity): string | undefined {
  const expected = activity.expectedResponses ?? [];

  for (const response of expected) {
    const model =
      clean(response.modelAnswer) ??
      clean(response.exactAnswers?.[0]) ??
      clean(response.acceptableAnswers?.[0]);

    if (model) return model;
  }

  return undefined;
}

function expectedFirstWord(activity: TeachingActivity): string | undefined {
  const model = expectedModel(activity);
  return model?.split(/\s+/)[0];
}

function expectedSentenceFrame(
  activity: TeachingActivity,
): string | undefined {
  const explicit = metadataString(
    activity.metadata,
    "sentenceFrame",
  );
  if (explicit) return explicit;

  const model = expectedModel(activity);
  if (!model) return undefined;

  const words = model.split(/\s+/);

  if (words.length <= 2) {
    return `${words[0] ?? "_____"} _____`;
  }

  return `${words.slice(0, Math.min(2, words.length)).join(" ")} _____`;
}

function targetVocabulary(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
): VocabularyItem[] {
  const ids = new Set(activity.targetVocabularyIds ?? []);
  return lesson.vocabulary.filter((item) => ids.has(item.id));
}

function targetGrammarExample(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
): string | undefined {
  const ids = new Set(activity.targetGrammarIds ?? []);
  const grammar = lesson.grammar.find((item) => ids.has(item.id));
  return grammar?.examples[0] ?? grammar?.form ?? grammar?.description;
}

function alternativeActivityTitle(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
): string | undefined {
  if (!activity.alternativeActivityId) return undefined;

  return findActivity(
    lesson,
    activity.alternativeActivityId,
  )?.activity.title;
}

function decisionSelectedStep(
  decision: TeachingDecision,
  activity: TeachingActivity,
): SupportStep | undefined {
  const raw = decision.metadata?.selectedSupportStep;

  if (!raw || typeof raw !== "object") return undefined;

  const candidate = raw as {
    level?: unknown;
    type?: unknown;
  };

  if (
    typeof candidate.level !== "number" ||
    typeof candidate.type !== "string"
  ) {
    return undefined;
  }

  return activity.supportSteps.find(
    (step) =>
      step.level === candidate.level &&
      step.type === candidate.type,
  );
}

function supportTypesForDecision(
  type: TeachingDecisionType,
): SupportStepType[] {
  switch (type) {
    case "repeat_instruction":
      return ["repeat_instruction"];

    case "slow_down":
      return ["slow_down", "repeat_instruction"];

    case "simplify":
      return ["simplify_instruction"];

    case "rephrase":
      return ["rephrase"];

    case "give_clue":
      return [
        "give_general_clue",
        "give_specific_clue",
        "give_first_word",
        "give_sentence_frame",
      ];

    case "show_visual_support":
      return ["show_visual_clue", "show_example"];

    case "translate_support":
      return ["translate_instruction", "translate_keyword"];

    case "model_answer":
      return ["model_answer", "show_example"];

    case "request_repetition":
      return ["ask_to_repeat"];

    case "review_prerequisite":
      return ["review_prerequisite"];

    case "change_activity":
      return ["change_activity"];

    case "retry_activity":
      return [
        "repeat_instruction",
        "rephrase",
        "give_general_clue",
      ];

    default:
      return [];
  }
}

function resolveSupportStep(
  decision: TeachingDecision,
  activity: TeachingActivity,
  runtime: ActivityRuntimeState,
): ResolvedSupportStep {
  const selected = decisionSelectedStep(decision, activity);

  if (selected) {
    return {
      step: selected,
      source: "decision_metadata",
    };
  }

  const preferredTypes = supportTypesForDecision(decision.type);
  const available = activity.supportSteps
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

  for (const type of preferredTypes) {
    const matching = available.find(
      (step) =>
        step.type === type &&
        step.level >= decision.supportLevel,
    );

    if (matching) {
      return {
        step: matching,
        source: "activity_match",
      };
    }
  }

  const atLevel = available.find(
    (step) => step.level >= decision.supportLevel,
  );

  if (atLevel) {
    return {
      step: atLevel,
      source: "activity_level",
    };
  }

  return {
    source: SUPPORT_DECISION_TYPES.has(decision.type)
      ? "generated_fallback"
      : "none",
  };
}

function inferL1Trigger(
  decision: TeachingDecision,
  input: GenerateSupportInput,
): L1SupportTrigger | undefined {
  if (input.l1Trigger) return input.l1Trigger;

  switch (decision.reason) {
    case "learner_requested_help":
      return "learner_requests_help";

    case "meaning_breakdown":
    case "off_topic_response":
    case "low_confidence_evaluation":
      return "instruction_not_understood";

    case "repeated_error":
    case "activity_attempt_limit_reached":
      return "repeated_failure";

    case "safety_requirement":
      return "safety_or_critical_information";

    default:
      return undefined;
  }
}

function evaluateL1Use(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
  decision: TeachingDecision,
  step: SupportStep | undefined,
  input: GenerateSupportInput,
  config: Required<
    Omit<
      SupportEngineConfig,
      "provider" | "translationProvider" | "now"
    >
  >,
): L1Decision {
  const policy = mergeL1Policy(lesson, activity);
  const trigger = inferL1Trigger(decision, input);

  const requested =
    input.requestedL1 === true ||
    decision.type === "translate_support" ||
    stepUsesL1(step);

  const language =
    input.learnerL1 ??
    policy.learnerL1 ??
    config.defaultLearnerL1;

  if (!requested) {
    return {
      requested: false,
      allowed: false,
      language: lesson.targetLanguage,
    };
  }

  if (!policy.enabled || policy.level === "disabled") {
    return {
      requested: true,
      allowed: false,
      language: lesson.targetLanguage,
      trigger,
      reason: "L1 support is disabled by the effective activity policy.",
    };
  }

  if (language === "other") {
    return {
      requested: true,
      allowed: false,
      language: lesson.targetLanguage,
      trigger,
      reason: "The learner's L1 is not available.",
    };
  }

  if (trigger && !policy.allowedTriggers.includes(trigger)) {
    return {
      requested: true,
      allowed: false,
      language: lesson.targetLanguage,
      trigger,
      reason: `The L1 trigger "${trigger}" is not allowed by policy.`,
    };
  }

  const consecutive = input.consecutiveL1Turns ?? 0;

  if (
    policy.maximumConsecutiveL1Turns !== undefined &&
    consecutive >= policy.maximumConsecutiveL1Turns
  ) {
    return {
      requested: true,
      allowed: false,
      language: lesson.targetLanguage,
      trigger,
      reason: "The consecutive L1 turn limit has been reached.",
    };
  }

  if (
    step?.type === "translate_instruction" &&
    !policy.translateInstructions
  ) {
    return {
      requested: true,
      allowed: false,
      language: lesson.targetLanguage,
      trigger,
      reason: "Instruction translation is disabled.",
    };
  }

  if (
    step?.type === "translate_keyword" &&
    !policy.translateKeyVocabulary
  ) {
    return {
      requested: true,
      allowed: false,
      language: lesson.targetLanguage,
      trigger,
      reason: "Keyword translation is disabled.",
    };
  }

  return {
    requested: true,
    allowed: true,
    language,
    trigger,
  };
}

function positivePrefix(
  lesson: TeachingBrainLesson,
  input: GenerateSupportInput,
  config: Required<
    Omit<
      SupportEngineConfig,
      "provider" | "translationProvider" | "now"
    >
  >,
): string {
  if (
    !config.includePositiveFraming ||
    !lesson.correctionPolicy.usePositiveFraming
  ) {
    return "";
  }

  const name =
    lesson.teachingTone.useLearnerName && input.learnerName
      ? `, ${input.learnerName}`
      : "";

  return `Good effort${name}. `;
}

function retrySuffix(
  decision: TeachingDecision,
  config: Required<
    Omit<
      SupportEngineConfig,
      "provider" | "translationProvider" | "now"
    >
  >,
): string {
  if (!config.appendRetryPrompt || !decision.shouldWaitForLearner) {
    return "";
  }

  return " Now try again.";
}

function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?؟])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function limitSentenceLength(
  value: string | undefined,
  maximumWords: number | undefined,
): { value?: string; changed: boolean } {
  if (!value || !maximumWords || maximumWords < 2) {
    return { value, changed: false };
  }

  let changed = false;

  const sentences = splitSentences(value).flatMap((sentence) => {
    const words = sentence.split(/\s+/);

    if (words.length <= maximumWords) {
      return [sentence];
    }

    changed = true;
    const chunks: string[] = [];

    for (let index = 0; index < words.length; index += maximumWords) {
      const chunk = words.slice(index, index + maximumWords).join(" ");
      chunks.push(
        /[.!?؟]$/.test(chunk)
          ? chunk
          : `${chunk}.`,
      );
    }

    return chunks;
  });

  return {
    value: sentences.join(" "),
    changed,
  };
}


/* -------------------------------------------------------------------------- */
/*                          Translation Resolution                            */
/* -------------------------------------------------------------------------- */

function metadataTranslation(
  activity: TeachingActivity,
  step: SupportStep | undefined,
  language: LanguageCode,
  purpose: "instruction" | "keyword",
): string | undefined {
  const stepKey = `translation_${language}`;
  const activityKey =
    purpose === "instruction"
      ? `instructionTranslation_${language}`
      : `keywordTranslation_${language}`;

  return (
    metadataString(step?.metadata, stepKey) ??
    metadataString(activity.metadata, activityKey)
  );
}

async function resolveTranslation(
  input: {
    text: string;
    purpose: "instruction" | "keyword";
    targetLanguage: LanguageCode;
    lesson: TeachingBrainLesson;
    activity: TeachingActivity;
    step?: SupportStep;
  },
  config: Required<
    Omit<
      SupportEngineConfig,
      "provider" | "translationProvider" | "now"
    >
  > &
    Pick<
      SupportEngineConfig,
      "provider" | "translationProvider" | "now"
    >,
): Promise<string | undefined> {
  if (config.allowMetadataTranslations) {
    const stored = metadataTranslation(
      input.activity,
      input.step,
      input.targetLanguage,
      input.purpose,
    );

    if (stored) return stored;
  }

  if (!config.translationProvider) return undefined;

  return clean(
    await config.translationProvider.translate({
      text: input.text,
      sourceLanguage: input.lesson.targetLanguage,
      targetLanguage: input.targetLanguage,
      purpose: input.purpose,
      lesson: input.lesson,
      activity: input.activity,
    }),
  );
}

/* -------------------------------------------------------------------------- */
/*                        Deterministic Content Builders                      */
/* -------------------------------------------------------------------------- */

function defaultHints(
  decision: TeachingDecision,
  boardActions: BoardAction[] = [],
): DirectorHints {
  return mergeDirectorHints(
    {
      preferredPosition: "center",
      preferredGesture: "encourage",
      facialExpression: "encouraging",
      speakingPace:
        decision.type === "slow_down" ||
        decision.type === "model_answer" ||
        decision.type === "correct_gently"
          ? "slow"
          : "normal",
      speakingVolume: "normal",
      allowMovement: true,
      allowAnimation: true,
      boardActions,
    },
    decision.directorHints,
  );
}

function contentFromStep(
  step: SupportStep | undefined,
): string | undefined {
  return clean(step?.content) ?? clean(step?.instruction);
}

function buildGeneralClue(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
): string {
  const vocabulary = targetVocabulary(lesson, activity);
  const target = vocabulary[0]?.term;

  if (target) {
    return `Think about the lesson word connected to "${target}".`;
  }

  return "Think about the main idea in the question.";
}

function buildSpecificClue(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
): string {
  const vocabulary = targetVocabulary(lesson, activity);
  const first = vocabulary[0];

  if (first?.definition) {
    return `The answer is connected to this meaning: ${first.definition}`;
  }

  const expected = activity.expectedResponses?.[0];
  const required = expected?.requiredKeywords?.[0];

  if (required) {
    return `Use the word "${required}" in your answer.`;
  }

  return "Use the key words from the instruction to build your answer.";
}

function buildExample(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
): string | undefined {
  return (
    targetGrammarExample(lesson, activity) ??
    targetVocabulary(lesson, activity)[0]?.examples[0] ??
    expectedModel(activity)
  );
}

function buildModelAnswer(
  activity: TeachingActivity,
  decision: TeachingDecision,
): string | undefined {
  return (
    clean(decision.correction?.corrected) ??
    expectedModel(activity) ??
    clean(decision.textContent) ??
    clean(decision.speechContent)
  );
}

function buildCorrection(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
  decision: TeachingDecision,
  input: GenerateSupportInput,
  config: Required<
    Omit<
      SupportEngineConfig,
      "provider" | "translationProvider" | "now"
    >
  >,
): GeneratedContent {
  const correctionPolicy = mergeCorrectionPolicy(lesson, activity);
  const prefix = positivePrefix(lesson, input, config);

  const original = clean(decision.correction?.original);
  const corrected = clean(decision.correction?.corrected);
  const explanation = clean(decision.correction?.explanation);

  const correctionParts: string[] = [];

  if (original && corrected) {
    correctionParts.push(`You said: "${original}".`);
    correctionParts.push(`A better answer is: "${corrected}".`);
  } else if (corrected) {
    correctionParts.push(`A better answer is: "${corrected}".`);
  } else if (explanation) {
    correctionParts.push(explanation);
  } else {
    correctionParts.push("Let us correct one small part of the answer.");
  }

  if (explanation && !correctionParts.includes(explanation)) {
    correctionParts.push(explanation);
  }

  const maximum =
    correctionPolicy.maximumCorrectionsPerTurn ?? 1;

  const selected = correctionParts.slice(
    0,
    Math.max(1, maximum + 1),
  );

  const speech =
    `${prefix}${selected.join(" ")}${
      decision.correction?.requestRepetition
        ? " Please say it once more."
        : retrySuffix(decision, config)
    }`.trim();

  const boardActions: BoardAction[] = corrected
    ? [
        {
          type: "show_correction",
          content: corrected,
          preserveExistingContent: true,
        },
      ]
    : [];

  return {
    kind: "correction",
    speech,
    text: speech,
    boardActions,
    media: [],
    directorHints: defaultHints(decision, boardActions),
    recordSupportUsage: true,
  };
}

async function buildDeterministicContent(
  input: GenerateSupportInput,
  context: ResolvedContext,
  resolvedStep: ResolvedSupportStep,
  l1: L1Decision,
  config: Required<
    Omit<
      SupportEngineConfig,
      "provider" | "translationProvider" | "now"
    >
  > &
    Pick<
      SupportEngineConfig,
      "provider" | "translationProvider" | "now"
    >,
): Promise<GeneratedContent> {
  const { lesson, decision } = input;
  const { activity, stage } = context;
  const step = resolvedStep.step;

  const stepContent = contentFromStep(step);
  const retry = retrySuffix(decision, config);
  const prefix = positivePrefix(lesson, input, config);

  switch (decision.type) {
    case "repeat_instruction": {
      const speech =
        stepContent ??
        clean(decision.speechContent) ??
        activity.instruction;

      return {
        kind: "repetition",
        speech: `${speech}${retry}`,
        text: `${speech}${retry}`,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: true,
      };
    }

    case "slow_down": {
      const speech =
        stepContent ??
        activity.instruction;

      return {
        kind: "repetition",
        speech: `${speech}${retry}`,
        text: `${speech}${retry}`,
        boardActions: [],
        media: [],
        directorHints: mergeDirectorHints(
          defaultHints(decision),
          {
            speakingPace: "slow",
            pauseAfterSpeechMs: 600,
          },
        ),
        recordSupportUsage: true,
      };
    }

    case "simplify": {
      const simplified =
        stepContent ??
        metadataString(activity.metadata, "simplifiedInstruction") ??
        activity.instruction;

      return {
        kind: "simplification",
        speech: `${simplified}${retry}`,
        text: `${simplified}${retry}`,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: true,
      };
    }

    case "rephrase": {
      const rephrased =
        stepContent ??
        metadataString(activity.metadata, "rephrasedInstruction") ??
        activity.teacherPrompt ??
        activity.instruction;

      return {
        kind: "rephrase",
        speech: `${rephrased}${retry}`,
        text: `${rephrased}${retry}`,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: true,
      };
    }

    case "give_clue": {
      let clue = stepContent;
      let kind: SupportContentKind = "general_clue";

      switch (step?.type) {
        case "give_specific_clue":
          clue ??= buildSpecificClue(lesson, activity);
          kind = "specific_clue";
          break;

        case "give_first_word":
          clue ??= expectedFirstWord(activity)
            ? `Start with: "${expectedFirstWord(activity)}".`
            : buildSpecificClue(lesson, activity);
          kind = "first_word";
          break;

        case "give_sentence_frame":
          clue ??= expectedSentenceFrame(activity)
            ? `Use this frame: ${expectedSentenceFrame(activity)}`
            : buildSpecificClue(lesson, activity);
          kind = "sentence_frame";
          break;

        default:
          clue ??= buildGeneralClue(lesson, activity);
          kind = "general_clue";
      }

      const boardActions: BoardAction[] =
        kind === "sentence_frame" || kind === "first_word"
          ? [
              {
                type: "show_text",
                content: clue,
                preserveExistingContent: true,
              },
            ]
          : [];

      const speech = `${prefix}${clue}${retry}`.trim();

      return {
        kind,
        speech,
        text: speech,
        boardActions,
        media: [],
        directorHints: defaultHints(decision, boardActions),
        recordSupportUsage: true,
      };
    }

    case "show_visual_support": {
      const content =
        stepContent ??
        buildExample(lesson, activity) ??
        activity.instruction;

      const imageReference =
        metadataString(step?.metadata, "imageReference") ??
        metadataString(activity.metadata, "imageReference");

      const imagePrompt =
        metadataString(step?.metadata, "imagePrompt") ??
        metadataString(activity.metadata, "imagePrompt") ??
        targetVocabulary(lesson, activity)[0]?.imagePrompt;

      const boardActions: BoardAction[] = [
        imageReference || imagePrompt
          ? {
              type: "show_image",
              imageReference: imageReference ?? imagePrompt,
              content,
              preserveExistingContent: true,
            }
          : {
              type: "show_text",
              content,
              preserveExistingContent: true,
            },
      ];

      const media: SupportMedia[] =
        imageReference || imagePrompt
          ? [
              {
                type: "image",
                reference: imageReference,
                prompt: imagePrompt,
                altText: content,
              },
            ]
          : [];

      return {
        kind:
          step?.type === "show_example"
            ? "example"
            : "visual_clue",
        speech: `${prefix}Look at this support. ${content}${retry}`,
        text: content,
        boardActions,
        media,
        directorHints: defaultHints(decision, boardActions),
        recordSupportUsage: true,
      };
    }

    case "translate_support": {
      const translateKeyword =
        step?.type === "translate_keyword";

      const sourceText = translateKeyword
        ? targetVocabulary(lesson, activity)[0]?.term ??
          stepContent ??
          activity.instruction
        : stepContent ?? activity.instruction;

      if (!l1.allowed) {
        return {
          kind: "simplification",
          speech:
            `I will keep the support in ${lesson.targetLanguage}. ` +
            `${activity.instruction}${retry}`,
          text: `${activity.instruction}${retry}`,
          boardActions: [],
          media: [],
          directorHints: defaultHints(decision),
          recordSupportUsage: true,
        };
      }

      const translated = await resolveTranslation(
        {
          text: sourceText,
          purpose: translateKeyword ? "keyword" : "instruction",
          targetLanguage: l1.language,
          lesson,
          activity,
          step,
        },
        config,
      );

      if (!translated) {
        throw new SupportEngineError(
          "TRANSLATION_UNAVAILABLE",
          `No ${l1.language} translation is available for the selected support.`,
          {
            details: {
              activityId: activity.id,
              supportType: step?.type,
              language: l1.language,
            },
          },
        );
      }

      const returnText = mergeL1Policy(
        lesson,
        activity,
      ).returnToTargetLanguageAfterSupport
        ? ` ${activity.instruction}`
        : "";

      const speech = `${translated}${returnText}${retry}`.trim();

      const boardActions: BoardAction[] = [
        {
          type: "show_text",
          content: translated,
          preserveExistingContent: true,
        },
      ];

      return {
        kind: translateKeyword
          ? "keyword_translation"
          : "instruction_translation",
        speech,
        text: speech,
        boardActions,
        media: [],
        directorHints: defaultHints(decision, boardActions),
        recordSupportUsage: true,
      };
    }

    case "model_answer": {
      const model =
        stepContent ??
        buildModelAnswer(activity, decision) ??
        "Listen to the model, then try the activity again.";

      const boardActions: BoardAction[] = [
        {
          type: "show_sentence",
          content: model,
          preserveExistingContent: true,
        },
      ];

      const speech =
        `${prefix}Model answer: ${model}` +
        (decision.shouldWaitForLearner
          ? " Now say or write your own answer."
          : "");

      return {
        kind: "model_answer",
        speech,
        text: model,
        boardActions,
        media: [],
        directorHints: defaultHints(decision, boardActions),
        recordSupportUsage: true,
      };
    }

    case "correct_gently":
      return buildCorrection(
        lesson,
        activity,
        decision,
        input,
        config,
      );

    case "request_self_correction": {
      const correction = clean(decision.correction?.explanation);
      const speech = correction
        ? `${prefix}${correction} Check your answer and correct it yourself.`
        : `${prefix}You are close. Check your answer and correct one part.`;

      return {
        kind: "correction",
        speech,
        text: speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: true,
      };
    }

    case "request_repetition": {
      const speech =
        stepContent ??
        (activity.inputModality === "voice"
          ? "Please say your answer once more, slowly and clearly."
          : "Please give your answer once more.");

      return {
        kind:
          activity.inputModality === "voice"
            ? "pronunciation_model"
            : "repetition",
        speech,
        text: speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: true,
      };
    }

    case "review_prerequisite": {
      const prerequisite =
        stepContent ??
        metadataString(activity.metadata, "prerequisiteReview") ??
        lesson.prerequisites[0] ??
        "Let us review the key idea needed for this activity.";

      const boardActions: BoardAction[] = [
        {
          type: "show_text",
          content: prerequisite,
          preserveExistingContent: true,
        },
      ];

      return {
        kind: "prerequisite_review",
        speech: `${prefix}${prerequisite}${retry}`,
        text: prerequisite,
        boardActions,
        media: [],
        directorHints: defaultHints(decision, boardActions),
        recordSupportUsage: true,
      };
    }

    case "retry_activity": {
      const speech =
        stepContent ??
        `${prefix}Let us try the activity again. ${activity.instruction}`;

      return {
        kind: "instruction",
        speech,
        text: speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: Boolean(step),
      };
    }

    case "change_activity": {
      const alternative =
        alternativeActivityTitle(lesson, activity);
      const speech =
        stepContent ??
        (alternative
          ? `We will practise the same objective with "${alternative}".`
          : "We will practise the same objective in a different way.");

      return {
        kind: "transition",
        speech,
        text: speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: true,
      };
    }

    case "praise_and_continue": {
      const speech =
        clean(decision.speechContent) ??
        `${prefix}That is correct. Let us continue.`;

      return {
        kind: "praise",
        speech,
        text: clean(decision.textContent) ?? speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: false,
      };
    }

    case "ask_follow_up":
    case "continue": {
      const speech =
        clean(decision.speechContent) ??
        clean(decision.textContent) ??
        (decision.type === "ask_follow_up"
          ? "Can you tell me a little more?"
          : "Let us continue.");

      return {
        kind:
          decision.type === "ask_follow_up"
            ? "instruction"
            : "transition",
        speech,
        text: speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: false,
      };
    }

    case "complete_activity": {
      const speech =
        clean(decision.speechContent) ??
        `You have completed "${activity.title}".`;

      return {
        kind: "transition",
        speech,
        text: speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: false,
      };
    }

    case "complete_stage": {
      const speech =
        clean(decision.speechContent) ??
        stage.completionMessage ??
        `You have completed "${stage.title}".`;

      return {
        kind: "transition",
        speech,
        text: speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: false,
      };
    }

    case "complete_lesson": {
      const speech =
        clean(decision.speechContent) ??
        `Well done. You have completed "${lesson.title}".`;

      return {
        kind: "praise",
        speech,
        text: speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: false,
      };
    }

    case "skip_optional_activity": {
      const speech =
        clean(decision.speechContent) ??
        "We can skip this optional activity and continue.";

      return {
        kind: "transition",
        speech,
        text: speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: false,
      };
    }

    case "pause": {
      const speech =
        clean(decision.speechContent) ??
        "Let us pause here. We can continue when you are ready.";

      return {
        kind: "pause",
        speech,
        text: speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: false,
      };
    }

    case "request_human_support": {
      const speech =
        clean(decision.speechContent) ??
        "A teacher or support person should help with this step.";

      return {
        kind: "human_support",
        speech,
        text: speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: false,
      };
    }

    default: {
      const speech =
        clean(decision.speechContent) ??
        clean(decision.textContent) ??
        activity.instruction;

      return {
        kind: "generic",
        speech,
        text: speech,
        boardActions: [],
        media: [],
        directorHints: defaultHints(decision),
        recordSupportUsage: false,
      };
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                           Channel Filtering                                */
/* -------------------------------------------------------------------------- */

function channelAllowed(
  channel: SupportChannel,
  preferred: SupportChannel[] | undefined,
  activity: TeachingActivity,
): boolean {
  if (preferred?.length) {
    return preferred.includes(channel);
  }

  if (channel === "speech" || channel === "text") return true;

  return activity.outputModalities.includes(
    channel as OutputModality,
  );
}

function applyChannelPreferences(
  content: GeneratedContent,
  preferred: SupportChannel[] | undefined,
  activity: TeachingActivity,
): GeneratedContent {
  return {
    ...content,
    speech: channelAllowed("speech", preferred, activity)
      ? content.speech
      : undefined,
    text: channelAllowed("text", preferred, activity)
      ? content.text
      : undefined,
    boardActions: channelAllowed(
      "whiteboard",
      preferred,
      activity,
    )
      ? content.boardActions
      : [],
    media: content.media.filter((item) =>
      channelAllowed(item.type, preferred, activity),
    ),
  };
}

/* -------------------------------------------------------------------------- */
/*                             Error Mapping                                  */
/* -------------------------------------------------------------------------- */

function toTeachingBrainError(
  error: unknown,
  input?: Partial<GenerateSupportInput>,
): TeachingBrainError {
  if (error instanceof SupportEngineError) {
    return {
      code:
        error.code === "STAGE_NOT_FOUND"
          ? "STAGE_NOT_FOUND"
          : error.code === "ACTIVITY_NOT_FOUND"
            ? "ACTIVITY_NOT_FOUND"
            : "INTERNAL_ERROR",
      message: error.message,
      lessonId: input?.lesson?.id,
      sessionId: input?.session?.id,
      stageId: input?.decision?.stageId,
      activityId: input?.decision?.activityId,
      recoverable: error.recoverable,
      details: error.details,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message:
      error instanceof Error
        ? error.message
        : "An unknown support generation error occurred.",
    lessonId: input?.lesson?.id,
    sessionId: input?.session?.id,
    stageId: input?.decision?.stageId,
    activityId: input?.decision?.activityId,
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
/*                           Main Support Engine                              */
/* -------------------------------------------------------------------------- */

export class TeachingSupportEngine {
  private readonly config: Required<
    Omit<
      SupportEngineConfig,
      "provider" | "translationProvider" | "now"
    >
  > &
    Pick<
      SupportEngineConfig,
      "provider" | "translationProvider" | "now"
    >;

  constructor(config: SupportEngineConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      provider: config.provider,
      translationProvider: config.translationProvider,
      now: config.now,
    };

    this.validateConfig();
  }

  async generate(
    input: GenerateSupportInput,
  ): Promise<DetailedSupportDelivery> {
    this.validateInput(input);

    const context = this.resolveContext(input);
    const resolvedStep = resolveSupportStep(
      input.decision,
      context.activity,
      context.activityRuntime,
    );

    const l1 = evaluateL1Use(
      input.lesson,
      context.activity,
      input.decision,
      resolvedStep.step,
      input,
      this.config,
    );

    const notes: string[] = [];

    if (l1.requested && !l1.allowed && l1.reason) {
      notes.push(l1.reason);
    }

    let content = await buildDeterministicContent(
      input,
      context,
      resolvedStep,
      l1,
      this.config,
    );

    content = applyChannelPreferences(
      content,
      input.preferredChannels,
      context.activity,
    );

    let truncatedForTonePolicy = false;

    if (this.config.enforceMaximumSentenceLength) {
      const maximum =
        input.lesson.teachingTone.maximumSentenceLength;

      const limitedSpeech = limitSentenceLength(
        content.speech,
        maximum,
      );
      const limitedText = limitSentenceLength(
        content.text,
        maximum,
      );

      content = {
        ...content,
        speech: limitedSpeech.value,
        text: limitedText.value,
      };

      truncatedForTonePolicy =
        limitedSpeech.changed || limitedText.changed;
    }

    const effectiveLanguage = l1.allowed
      ? l1.language
      : input.lesson.targetLanguage;

    const deterministicDelivery: SupportDelivery = {
      id: createId("support"),
      sessionId: input.session.id,
      lessonId: input.lesson.id,
      stageId: context.stage.id,
      activityId: context.activity.id,
      decisionId: input.decision.id,
      kind: content.kind,
      supportType: resolvedStep.step?.type,
      supportLevel: resolvedStep.step?.level ??
        input.decision.supportLevel,
      speech: clean(content.speech),
      text: clean(content.text),
      language: effectiveLanguage,
      usesL1: l1.allowed,
      returnToTargetLanguage:
        l1.allowed &&
        mergeL1Policy(
          input.lesson,
          context.activity,
        ).returnToTargetLanguageAfterSupport,
      boardActions: content.boardActions,
      media: content.media,
      directorHints: content.directorHints,
      shouldWaitForLearner:
        input.decision.shouldWaitForLearner,
      expectedInputModality:
        input.decision.expectedInputModality ??
        context.activity.inputModality,
      recordSupportUsage:
        content.recordSupportUsage &&
        Boolean(resolvedStep.step),
      createdAt: nowIso(this.config),
      metadata: {
        decisionType: input.decision.type,
        decisionReason: input.decision.reason,
        selectedStepSource: resolvedStep.source,
        l1Trigger: l1.trigger,
        ...input.metadata,
      },
    };

    if (
      this.config.mode === "provider_only" &&
      !this.config.provider
    ) {
      throw new SupportEngineError(
        "PROVIDER_REQUIRED",
        "Provider-only support mode requires a support provider.",
        { recoverable: false },
      );
    }

    let delivery = deterministicDelivery;
    let providerUsed = false;
    let fallbackUsed = false;

    if (
      this.config.provider &&
      this.config.mode !== "deterministic"
    ) {
      try {
        const provider = await this.config.provider.generate({
          lesson: input.lesson,
          session: input.session,
          stage: context.stage,
          activity: context.activity,
          activityRuntime: context.activityRuntime,
          decision: input.decision,
          evaluation: input.evaluation,
          selectedStep: resolvedStep.step,
          deterministicDelivery,
          learnerName: input.learnerName,
        });

        const providerUsesL1 =
          provider.usesL1 === true &&
          (l1.allowed || this.config.allowProviderToEnableL1);

        delivery = {
          ...deterministicDelivery,
          speech:
            clean(provider.speech) ??
            deterministicDelivery.speech,
          text:
            clean(provider.text) ??
            deterministicDelivery.text,
          language:
            providerUsesL1
              ? provider.language ?? l1.language
              : deterministicDelivery.language,
          usesL1: providerUsesL1,
          returnToTargetLanguage:
            provider.returnToTargetLanguage ??
            deterministicDelivery.returnToTargetLanguage,
          boardActions:
            provider.boardActions ??
            deterministicDelivery.boardActions,
          media:
            provider.media ??
            deterministicDelivery.media,
          directorHints:
            provider.directorHints
              ? mergeDirectorHints(
                  deterministicDelivery.directorHints,
                  provider.directorHints,
                )
              : deterministicDelivery.directorHints,
          shouldWaitForLearner:
            provider.shouldWaitForLearner ??
            deterministicDelivery.shouldWaitForLearner,
          metadata: {
            ...deterministicDelivery.metadata,
            providerConfidence: provider.confidence,
            ...provider.metadata,
          },
        };

        providerUsed = true;
      } catch (error) {
        if (this.config.mode === "provider_only") {
          throw new SupportEngineError(
            "PROVIDER_FAILED",
            "The support provider failed.",
            { cause: error, recoverable: true },
          );
        }

        fallbackUsed = true;
        notes.push(
          `Support provider failed; deterministic content was retained: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return {
      delivery,
      diagnostics: {
        selectedStep: resolvedStep.step,
        selectedStepSource: resolvedStep.source,
        l1Requested: l1.requested,
        l1Allowed: l1.allowed,
        l1Reason: l1.reason,
        maximumSentenceLength:
          input.lesson.teachingTone.maximumSentenceLength,
        truncatedForTonePolicy,
        providerUsed,
        fallbackUsed,
        notes,
      },
    };
  }

  async safeGenerate(
    input: GenerateSupportInput,
  ): Promise<SafeSupportResult> {
    try {
      return {
        ok: true,
        data: await this.generate(input),
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
      ![
        "deterministic",
        "provider_assisted",
        "provider_only",
      ].includes(this.config.mode)
    ) {
      throw new SupportEngineError(
        "INVALID_INPUT",
        `Unsupported support engine mode: ${this.config.mode}.`,
        { recoverable: false },
      );
    }
  }

  private validateInput(input: GenerateSupportInput): void {
    if (!input.lesson?.id) {
      throw new SupportEngineError(
        "INVALID_INPUT",
        "A valid TeachingBrainLesson is required.",
      );
    }

    if (!input.session?.id) {
      throw new SupportEngineError(
        "INVALID_INPUT",
        "A valid TeachingSessionState is required.",
      );
    }

    if (!input.decision?.id) {
      throw new SupportEngineError(
        "INVALID_INPUT",
        "A valid TeachingDecision is required.",
      );
    }

    if (input.session.lessonId !== input.lesson.id) {
      throw new SupportEngineError(
        "SESSION_CONTEXT_MISMATCH",
        `Session lesson "${input.session.lessonId}" does not match lesson "${input.lesson.id}".`,
      );
    }

    if (input.decision.sessionId !== input.session.id) {
      throw new SupportEngineError(
        "DECISION_CONTEXT_MISMATCH",
        `Decision session "${input.decision.sessionId}" does not match session "${input.session.id}".`,
      );
    }
  }

  private resolveContext(
    input: GenerateSupportInput,
  ): ResolvedContext {
    const activityId =
      input.activity?.id ??
      input.decision.activityId ??
      input.session.activeActivityId;

    if (!activityId) {
      throw new SupportEngineError(
        "ACTIVITY_NOT_FOUND",
        "No activity could be resolved for support generation.",
      );
    }

    const found =
      input.activity && input.stage
        ? {
            stage: input.stage,
            activity: input.activity,
          }
        : findActivity(input.lesson, activityId);

    if (!found) {
      throw new SupportEngineError(
        "ACTIVITY_NOT_FOUND",
        `Activity "${activityId}" was not found in lesson "${input.lesson.id}".`,
      );
    }

    const stage =
      input.stage ??
      input.lesson.stages.find(
        (candidate) =>
          candidate.id ===
          (input.decision.stageId ??
            input.session.activeStageId ??
            found.stage.id),
      ) ??
      found.stage;

    if (!stage) {
      throw new SupportEngineError(
        "STAGE_NOT_FOUND",
        "No stage could be resolved for support generation.",
      );
    }

    if (
      input.decision.activityId &&
      input.decision.activityId !== found.activity.id
    ) {
      throw new SupportEngineError(
        "DECISION_CONTEXT_MISMATCH",
        "The decision activity does not match the resolved activity.",
      );
    }

    if (
      input.decision.stageId &&
      input.decision.stageId !== stage.id
    ) {
      throw new SupportEngineError(
        "DECISION_CONTEXT_MISMATCH",
        "The decision stage does not match the resolved stage.",
      );
    }

    if (
      !stage.activities.some(
        (activity) => activity.id === found.activity.id,
      )
    ) {
      throw new SupportEngineError(
        "SESSION_CONTEXT_MISMATCH",
        `Activity "${found.activity.id}" does not belong to stage "${stage.id}".`,
      );
    }

    const activityRuntime =
      input.session.activityStates[found.activity.id];

    if (!activityRuntime) {
      throw new SupportEngineError(
        "SESSION_CONTEXT_MISMATCH",
        `Runtime state for activity "${found.activity.id}" is missing.`,
      );
    }

    return {
      stage,
      activity: found.activity,
      activityRuntime,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                          Functional Service API                            */
/* -------------------------------------------------------------------------- */

export function createTeachingSupportEngine(
  config: SupportEngineConfig = {},
): TeachingSupportEngine {
  return new TeachingSupportEngine(config);
}

export async function generateTeachingSupport(
  input: GenerateSupportInput,
  config: SupportEngineConfig = {},
): Promise<DetailedSupportDelivery> {
  return new TeachingSupportEngine(config).generate(input);
}

export async function safeGenerateTeachingSupport(
  input: GenerateSupportInput,
  config: SupportEngineConfig = {},
): Promise<SafeSupportResult> {
  return new TeachingSupportEngine(config).safeGenerate(input);
}

/**
 * Converts a generated support delivery to the payload expected by
 * TeachingSessionEngine.useSupport().
 */
export function supportDeliveryToSessionUsage(
  delivery: SupportDelivery,
):
  | {
      level: number;
      type: string;
      content?: string;
    }
  | undefined {
  if (!delivery.recordSupportUsage || !delivery.supportType) {
    return undefined;
  }

  return {
    level: delivery.supportLevel,
    type: delivery.supportType,
    content: delivery.text ?? delivery.speech,
  };
}

/**
 * Produces the minimal execution package required by the future Elvy Director.
 */
export function supportDeliveryToDirectorCommand(
  delivery: SupportDelivery,
): {
  speech?: string;
  text?: string;
  language: LanguageCode;
  boardActions: BoardAction[];
  media: SupportMedia[];
  hints: DirectorHints;
  waitForLearner: boolean;
  expectedInputModality?: InputModality;
} {
  return {
    speech: delivery.speech,
    text: delivery.text,
    language: delivery.language,
    boardActions: delivery.boardActions,
    media: delivery.media,
    hints: delivery.directorHints,
    waitForLearner: delivery.shouldWaitForLearner,
    expectedInputModality: delivery.expectedInputModality,
  };
}

export const TeachingSupportService = {
  create: createTeachingSupportEngine,
  generate: generateTeachingSupport,
  safeGenerate: safeGenerateTeachingSupport,
  toSessionUsage: supportDeliveryToSessionUsage,
  toDirectorCommand: supportDeliveryToDirectorCommand,
};
