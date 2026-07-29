/**
 * Elvy Lesson Director — Strategy Engine
 *
 * The Strategy Engine decides how Elvy should teach the current scene.
 *
 * It is deterministic and stateless. It does not select the next scene,
 * generate final dialogue, access storage, call AI providers, or control UI.
 */

import {
  type LessonObjectiveRef,
  type LessonSceneDefinition,
  type StudentLearningSignal,
  type SupportLevel,
  type TeachingStrategyKind,
} from "./types";

export type StrategyDifficulty =
  | "FOUNDATION"
  | "EASY"
  | "STANDARD"
  | "CHALLENGING";

export type ScaffoldingMode =
  | "NONE"
  | "EXAMPLE"
  | "HINT"
  | "STEP_BY_STEP"
  | "MODEL_AND_REPEAT"
  | "L1_SUPPORT";

export type CorrectionStyle =
  | "NONE"
  | "GENTLE_RECAST"
  | "GUIDED_CORRECTION"
  | "EXPLICIT_CORRECTION"
  | "SELF_CORRECTION";

export type InteractionPattern =
  | "TEACHER_MODEL"
  | "QUESTION_AND_ANSWER"
  | "GUIDED_PRACTICE"
  | "INDEPENDENT_RESPONSE"
  | "ROLE_PLAY"
  | "READ_AND_RESPOND"
  | "LISTEN_AND_RESPOND"
  | "WRITE_AND_REVISE";

export interface StrategyEngineConfig {
  readonly lowConfidenceThreshold?: number;
  readonly lowEngagementThreshold?: number;
  readonly highConfidenceThreshold?: number;
  readonly highEngagementThreshold?: number;
  readonly allowL1Support?: boolean;
  readonly preferSelfCorrectionOnMastery?: boolean;
}

export interface StrategySelectionInput {
  readonly scene: LessonSceneDefinition;
  readonly objectives: readonly LessonObjectiveRef[];
  readonly studentSignal: StudentLearningSignal;
  readonly currentStrategy?: TeachingStrategyKind | null;
  readonly learnerLevel?: string;
}

export interface StrategyRecommendation {
  readonly strategy: TeachingStrategyKind;
  readonly difficulty: StrategyDifficulty;
  readonly scaffolding: readonly ScaffoldingMode[];
  readonly correctionStyle: CorrectionStyle;
  readonly interactionPattern: InteractionPattern;
  readonly supportLevel: SupportLevel;
  readonly pace: "SLOW" | "NORMAL";
  readonly useExamples: boolean;
  readonly useHints: boolean;
  readonly useL1Support: boolean;
  readonly increaseChallenge: boolean;
  readonly preserveCurrentStrategy: boolean;
  readonly objectiveIds: readonly string[];
  readonly reason: string;
}

export interface StrategyEngineError {
  readonly code:
    | "INVALID_INPUT"
    | "INVALID_CONFIG"
    | "NO_STRATEGY_AVAILABLE"
    | "STRATEGY_ENGINE_FAILED";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type StrategyEngineResult =
  | {
      readonly ok: true;
      readonly data: StrategyRecommendation;
    }
  | {
      readonly ok: false;
      readonly error: StrategyEngineError;
    };

const DEFAULT_CONFIG: Required<StrategyEngineConfig> = {
  lowConfidenceThreshold: 0.4,
  lowEngagementThreshold: 0.4,
  highConfidenceThreshold: 0.8,
  highEngagementThreshold: 0.8,
  allowL1Support: true,
  preferSelfCorrectionOnMastery: true,
};

export class StrategyEngineRuntimeError extends Error {
  readonly code: StrategyEngineError["code"];
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: StrategyEngineError["code"],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "StrategyEngineRuntimeError";
    this.code = code;
    this.details = details;
  }
}

export class StrategyEngine {
  private readonly config: Required<StrategyEngineConfig>;

  constructor(config: StrategyEngineConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.validateConfig();
  }

  select(input: StrategySelectionInput): StrategyRecommendation {
    this.validateInput(input);

    const signal = input.studentSignal;
    const preferred = input.scene.preferredStrategies;
    const supportLevel = normalizeSupportLevel(signal);
    const confidence = normalizeScore(signal.confidence);
    const engagement = normalizeScore(signal.engagement);

    const struggling =
      signal.needsSupport ||
      signal.responseQuality === "INCORRECT" ||
      signal.responseQuality === "NO_RESPONSE";

    const partiallyCorrect =
      signal.responseQuality === "PARTIALLY_CORRECT";

    const mastered =
      signal.responseQuality === "MASTERED";

    const highReadiness =
      mastered ||
      (signal.responseQuality === "CORRECT" &&
        confidence >= this.config.highConfidenceThreshold &&
        engagement >= this.config.highEngagementThreshold);

    const lowConfidence =
      confidence < this.config.lowConfidenceThreshold;

    const lowEngagement =
      engagement < this.config.lowEngagementThreshold;

    const strategy = this.chooseStrategy({
      input,
      preferred,
      struggling,
      partiallyCorrect,
      mastered,
      lowConfidence,
      lowEngagement,
    });

    const difficulty = chooseDifficulty({
      struggling,
      partiallyCorrect,
      highReadiness,
      supportLevel,
    });

    const scaffolding = chooseScaffolding({
      strategy,
      supportLevel,
      struggling,
      partiallyCorrect,
      lowConfidence,
      allowL1Support: this.config.allowL1Support,
      learnerLevel: input.learnerLevel,
    });

    const correctionStyle = chooseCorrectionStyle({
      strategy,
      signal,
      supportLevel,
      preferSelfCorrectionOnMastery:
        this.config.preferSelfCorrectionOnMastery,
    });

    const interactionPattern = chooseInteractionPattern(
      strategy,
      supportLevel,
      highReadiness,
    );

    const preserveCurrentStrategy =
      input.currentStrategy === strategy &&
      !struggling &&
      !lowEngagement;

    const useL1Support = scaffolding.includes("L1_SUPPORT");
    const useExamples =
      scaffolding.includes("EXAMPLE") ||
      scaffolding.includes("MODEL_AND_REPEAT") ||
      scaffolding.includes("STEP_BY_STEP");

    const useHints =
      scaffolding.includes("HINT") ||
      scaffolding.includes("STEP_BY_STEP");

    return {
      strategy,
      difficulty,
      scaffolding,
      correctionStyle,
      interactionPattern,
      supportLevel,
      pace:
        supportLevel === "GUIDED" ||
        supportLevel === "INTENSIVE" ||
        lowConfidence
          ? "SLOW"
          : "NORMAL",
      useExamples,
      useHints,
      useL1Support,
      increaseChallenge: highReadiness && supportLevel === "NONE",
      preserveCurrentStrategy,
      objectiveIds: selectObjectiveIds(
        input.scene,
        input.objectives,
      ),
      reason: buildReason({
        strategy,
        signal,
        supportLevel,
        lowConfidence,
        lowEngagement,
        highReadiness,
        preserveCurrentStrategy,
      }),
    };
  }

  safeSelect(input: StrategySelectionInput): StrategyEngineResult {
    try {
      return {
        ok: true,
        data: this.select(input),
      };
    } catch (error) {
      return {
        ok: false,
        error: toStrategyEngineError(error),
      };
    }
  }

  private chooseStrategy(input: {
    readonly input: StrategySelectionInput;
    readonly preferred: readonly TeachingStrategyKind[];
    readonly struggling: boolean;
    readonly partiallyCorrect: boolean;
    readonly mastered: boolean;
    readonly lowConfidence: boolean;
    readonly lowEngagement: boolean;
  }): TeachingStrategyKind {
    const {
      input: selectionInput,
      preferred,
      struggling,
      partiallyCorrect,
      mastered,
      lowConfidence,
      lowEngagement,
    } = input;

    if (struggling) {
      if (lowConfidence || lowEngagement) {
        return preferred.includes("ENCOURAGEMENT")
          ? "ENCOURAGEMENT"
          : "REVIEW";
      }

      if (preferred.includes("REVIEW")) {
        return "REVIEW";
      }

      return strategyForDifficulty(
        selectionInput.scene,
        preferred,
      );
    }

    if (partiallyCorrect) {
      if (preferred.includes("PRONUNCIATION")) {
        return "PRONUNCIATION";
      }

      return preferred[0] ?? strategyForScene(
        selectionInput.scene,
      );
    }

    if (mastered) {
      return chooseChallengeStrategy(
        selectionInput.scene,
        preferred,
      );
    }

    if (
      selectionInput.currentStrategy &&
      preferred.includes(selectionInput.currentStrategy)
    ) {
      return selectionInput.currentStrategy;
    }

    return preferred[0] ?? strategyForScene(
      selectionInput.scene,
    );
  }

  private validateConfig(): void {
    const values = [
      this.config.lowConfidenceThreshold,
      this.config.lowEngagementThreshold,
      this.config.highConfidenceThreshold,
      this.config.highEngagementThreshold,
    ];

    if (values.some((value) => value < 0 || value > 1)) {
      throw new StrategyEngineRuntimeError(
        "INVALID_CONFIG",
        "Strategy thresholds must be between 0 and 1.",
      );
    }

    if (
      this.config.lowConfidenceThreshold >
      this.config.highConfidenceThreshold
    ) {
      throw new StrategyEngineRuntimeError(
        "INVALID_CONFIG",
        "lowConfidenceThreshold cannot exceed highConfidenceThreshold.",
      );
    }

    if (
      this.config.lowEngagementThreshold >
      this.config.highEngagementThreshold
    ) {
      throw new StrategyEngineRuntimeError(
        "INVALID_CONFIG",
        "lowEngagementThreshold cannot exceed highEngagementThreshold.",
      );
    }
  }

  private validateInput(input: StrategySelectionInput): void {
    if (!input?.scene) {
      throw new StrategyEngineRuntimeError(
        "INVALID_INPUT",
        "A lesson scene is required.",
      );
    }

    if (!input.scene.id.trim()) {
      throw new StrategyEngineRuntimeError(
        "INVALID_INPUT",
        "The lesson scene must contain an ID.",
      );
    }

    if (!input.scene.title.trim()) {
      throw new StrategyEngineRuntimeError(
        "INVALID_INPUT",
        "The lesson scene must contain a title.",
      );
    }

    if (!input.studentSignal) {
      throw new StrategyEngineRuntimeError(
        "INVALID_INPUT",
        "A student learning signal is required.",
      );
    }

    validateOptionalScore(
      input.studentSignal.confidence,
      "confidence",
    );

    validateOptionalScore(
      input.studentSignal.engagement,
      "engagement",
    );
  }
}

export function selectTeachingStrategy(
  input: StrategySelectionInput,
  config: StrategyEngineConfig = {},
): StrategyRecommendation {
  return new StrategyEngine(config).select(input);
}

export function safeSelectTeachingStrategy(
  input: StrategySelectionInput,
  config: StrategyEngineConfig = {},
): StrategyEngineResult {
  return new StrategyEngine(config).safeSelect(input);
}

function strategyForDifficulty(
  scene: LessonSceneDefinition,
  preferred: readonly TeachingStrategyKind[],
): TeachingStrategyKind {
  if (preferred.includes("VOCABULARY")) {
    return "VOCABULARY";
  }

  if (preferred.includes("GRAMMAR")) {
    return "GRAMMAR";
  }

  if (preferred.includes("PRONUNCIATION")) {
    return "PRONUNCIATION";
  }

  return preferred[0] ?? strategyForScene(scene);
}

function strategyForScene(
  scene: LessonSceneDefinition,
): TeachingStrategyKind {
  switch (scene.kind) {
    case "WARM_UP":
      return "SPEAKING";
    case "PRESENTATION":
      return "VOCABULARY";
    case "GUIDED_PRACTICE":
      return "REVIEW";
    case "INDEPENDENT_PRACTICE":
      return "WRITING";
    case "PRODUCTION":
      return "SPEAKING";
    case "ASSESSMENT":
      return "REVIEW";
    case "WRAP_UP":
      return "ENCOURAGEMENT";
  }
}

function chooseChallengeStrategy(
  scene: LessonSceneDefinition,
  preferred: readonly TeachingStrategyKind[],
): TeachingStrategyKind {
  const challengeOrder: readonly TeachingStrategyKind[] = [
    "SPEAKING",
    "WRITING",
    "READING",
    "LISTENING",
    "GRAMMAR",
    "VOCABULARY",
    "PRONUNCIATION",
  ];

  const preferredChallenge = challengeOrder.find((strategy) =>
    preferred.includes(strategy),
  );

  if (preferredChallenge) {
    return preferredChallenge;
  }

  if (scene.kind === "PRODUCTION") {
    return "SPEAKING";
  }

  if (scene.kind === "INDEPENDENT_PRACTICE") {
    return "WRITING";
  }

  return preferred[0] ?? strategyForScene(scene);
}

function chooseDifficulty(input: {
  readonly struggling: boolean;
  readonly partiallyCorrect: boolean;
  readonly highReadiness: boolean;
  readonly supportLevel: SupportLevel;
}): StrategyDifficulty {
  if (
    input.struggling &&
    input.supportLevel === "INTENSIVE"
  ) {
    return "FOUNDATION";
  }

  if (
    input.struggling ||
    input.partiallyCorrect ||
    input.supportLevel === "GUIDED"
  ) {
    return "EASY";
  }

  if (input.highReadiness) {
    return "CHALLENGING";
  }

  return "STANDARD";
}

function chooseScaffolding(input: {
  readonly strategy: TeachingStrategyKind;
  readonly supportLevel: SupportLevel;
  readonly struggling: boolean;
  readonly partiallyCorrect: boolean;
  readonly lowConfidence: boolean;
  readonly allowL1Support: boolean;
  readonly learnerLevel?: string;
}): readonly ScaffoldingMode[] {
  const modes: ScaffoldingMode[] = [];

  if (!input.struggling && !input.partiallyCorrect) {
    return ["NONE"];
  }

  if (input.supportLevel === "LIGHT") {
    modes.push("HINT");
  }

  if (input.supportLevel === "GUIDED") {
    modes.push("EXAMPLE", "STEP_BY_STEP");
  }

  if (input.supportLevel === "INTENSIVE") {
    modes.push("MODEL_AND_REPEAT", "STEP_BY_STEP", "EXAMPLE");
  }

  if (
    input.strategy === "PRONUNCIATION" ||
    input.strategy === "LISTENING" ||
    input.strategy === "SPEAKING"
  ) {
    modes.push("MODEL_AND_REPEAT");
  }

  if (input.lowConfidence && !modes.includes("EXAMPLE")) {
    modes.push("EXAMPLE");
  }

  if (
    input.allowL1Support &&
    shouldUseL1Support(
      input.learnerLevel,
      input.supportLevel,
    )
  ) {
    modes.push("L1_SUPPORT");
  }

  return uniqueScaffolding(modes);
}

function chooseCorrectionStyle(input: {
  readonly strategy: TeachingStrategyKind;
  readonly signal: StudentLearningSignal;
  readonly supportLevel: SupportLevel;
  readonly preferSelfCorrectionOnMastery: boolean;
}): CorrectionStyle {
  if (
    input.signal.responseQuality === "NOT_EVALUATED" ||
    input.signal.responseQuality === "CORRECT"
  ) {
    return "NONE";
  }

  if (
    input.signal.responseQuality === "MASTERED" &&
    input.preferSelfCorrectionOnMastery
  ) {
    return "SELF_CORRECTION";
  }

  if (
    input.strategy === "SPEAKING" ||
    input.strategy === "PRONUNCIATION"
  ) {
    return input.supportLevel === "INTENSIVE"
      ? "EXPLICIT_CORRECTION"
      : "GENTLE_RECAST";
  }

  if (input.signal.responseQuality === "PARTIALLY_CORRECT") {
    return "GUIDED_CORRECTION";
  }

  if (input.supportLevel === "INTENSIVE") {
    return "EXPLICIT_CORRECTION";
  }

  return "GUIDED_CORRECTION";
}

function chooseInteractionPattern(
  strategy: TeachingStrategyKind,
  supportLevel: SupportLevel,
  highReadiness: boolean,
): InteractionPattern {
  if (supportLevel === "INTENSIVE") {
    return "TEACHER_MODEL";
  }

  switch (strategy) {
    case "VOCABULARY":
    case "GRAMMAR":
    case "REVIEW":
      return supportLevel === "GUIDED"
        ? "GUIDED_PRACTICE"
        : "QUESTION_AND_ANSWER";

    case "LISTENING":
      return "LISTEN_AND_RESPOND";

    case "SPEAKING":
    case "PRONUNCIATION":
      return highReadiness
        ? "ROLE_PLAY"
        : "QUESTION_AND_ANSWER";

    case "READING":
      return "READ_AND_RESPOND";

    case "WRITING":
      return highReadiness
        ? "INDEPENDENT_RESPONSE"
        : "WRITE_AND_REVISE";

    case "ENCOURAGEMENT":
      return "QUESTION_AND_ANSWER";
  }
}

function selectObjectiveIds(
  scene: LessonSceneDefinition,
  objectives: readonly LessonObjectiveRef[],
): readonly string[] {
  const objectiveIds = new Set(
    objectives.map((objective) => objective.id),
  );

  return scene.objectiveIds.filter((id) =>
    objectiveIds.has(id),
  );
}

function normalizeSupportLevel(
  signal: StudentLearningSignal,
): SupportLevel {
  if (signal.needsSupport && signal.supportLevel === "NONE") {
    return "LIGHT";
  }

  return signal.supportLevel;
}

function normalizeScore(value: number | undefined): number {
  return value ?? 0.5;
}

function validateOptionalScore(
  value: number | undefined,
  field: string,
): void {
  if (value === undefined) return;

  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new StrategyEngineRuntimeError(
      "INVALID_INPUT",
      `${field} must be a number between 0 and 1.`,
      { field, value },
    );
  }
}

function shouldUseL1Support(
  learnerLevel: string | undefined,
  supportLevel: SupportLevel,
): boolean {
  if (
    supportLevel !== "GUIDED" &&
    supportLevel !== "INTENSIVE"
  ) {
    return false;
  }

  if (!learnerLevel) {
    return supportLevel === "INTENSIVE";
  }

  const normalized = learnerLevel.trim().toUpperCase();

  return (
    normalized === "PRE-A1" ||
    normalized === "A1" ||
    normalized.startsWith("A1.")
  );
}

function uniqueScaffolding(
  modes: readonly ScaffoldingMode[],
): readonly ScaffoldingMode[] {
  const unique = [...new Set(modes)];

  if (unique.length === 0) {
    return ["NONE"];
  }

  return unique.filter((mode) => mode !== "NONE");
}

function buildReason(input: {
  readonly strategy: TeachingStrategyKind;
  readonly signal: StudentLearningSignal;
  readonly supportLevel: SupportLevel;
  readonly lowConfidence: boolean;
  readonly lowEngagement: boolean;
  readonly highReadiness: boolean;
  readonly preserveCurrentStrategy: boolean;
}): string {
  if (input.highReadiness) {
    return `${input.strategy} was selected to increase challenge after strong learner performance.`;
  }

  if (
    input.signal.needsSupport ||
    input.signal.responseQuality === "INCORRECT" ||
    input.signal.responseQuality === "NO_RESPONSE"
  ) {
    return `${input.strategy} was selected with ${input.supportLevel.toLowerCase()} support because the learner is experiencing difficulty.`;
  }

  if (input.lowConfidence) {
    return `${input.strategy} was selected with slower pacing and scaffolding because learner confidence is low.`;
  }

  if (input.lowEngagement) {
    return `${input.strategy} was selected to restore engagement through a more interactive teaching pattern.`;
  }

  if (input.preserveCurrentStrategy) {
    return `${input.strategy} remains appropriate, so the current strategy is preserved.`;
  }

  return `${input.strategy} best matches the current scene and learner response.`;
}

function toStrategyEngineError(
  error: unknown,
): StrategyEngineError {
  if (error instanceof StrategyEngineRuntimeError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  return {
    code: "STRATEGY_ENGINE_FAILED",
    message:
      error instanceof Error
        ? error.message
        : "The Strategy Engine failed.",
  };
}

export const LessonStrategyEngine = {
  select: selectTeachingStrategy,
  safeSelect: safeSelectTeachingStrategy,
} as const;
