/**
 * Elvy Lesson Director — Scene Engine
 *
 * The Scene Engine owns lesson-scene navigation and progression rules.
 * It is deterministic, stateless, and independent from storage, AI providers,
 * transport layers, and UI components.
 */

import {
  getOrderedLessonScenes,
  type LessonDirectorProgress,
  type LessonSceneDefinition,
  type LessonSceneKind,
  type StudentLearningSignal,
} from "./types";

export interface SceneEngineConfig {
  readonly defaultMinimumTurns?: number;
  readonly defaultMaximumTurns?: number;
  readonly masteryCorrectAnswers?: number;
  readonly incorrectAnswersBeforeReview?: number;
  readonly allowOptionalSceneSkipping?: boolean;
}

export interface SceneProgressEvaluation {
  readonly minimumTurnsSatisfied: boolean;
  readonly maximumTurnsReached: boolean;
  readonly masterySatisfied: boolean;
  readonly sceneComplete: boolean;
  readonly shouldReview: boolean;
  readonly shouldRepeat: boolean;
  readonly reason: string;
}

export interface SceneSelection {
  readonly currentScene: LessonSceneDefinition;
  readonly nextScene: LessonSceneDefinition | null;
  readonly skippedSceneIds: readonly string[];
  readonly completedCurrentScene: boolean;
  readonly lessonSequenceComplete: boolean;
  readonly reason: string;
}

export interface SceneEngineError {
  readonly code:
    | "NO_SCENES"
    | "SCENE_NOT_FOUND"
    | "INVALID_SCENE"
    | "INVALID_CONFIG";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type SceneEngineResult<T> =
  | {
      readonly ok: true;
      readonly data: T;
    }
  | {
      readonly ok: false;
      readonly error: SceneEngineError;
    };

const DEFAULT_CONFIG: Required<SceneEngineConfig> = {
  defaultMinimumTurns: 1,
  defaultMaximumTurns: 6,
  masteryCorrectAnswers: 2,
  incorrectAnswersBeforeReview: 2,
  allowOptionalSceneSkipping: true,
};

export class SceneEngineRuntimeError extends Error {
  readonly code: SceneEngineError["code"];
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: SceneEngineError["code"],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "SceneEngineRuntimeError";
    this.code = code;
    this.details = details;
  }
}

export class SceneEngine {
  private readonly config: Required<SceneEngineConfig>;

  constructor(config: SceneEngineConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.validateConfig();
  }

  getOrderedScenes(
    scenes: readonly LessonSceneDefinition[],
  ): readonly LessonSceneDefinition[] {
    this.validateScenes(scenes);
    return getOrderedLessonScenes(scenes);
  }

  getFirstScene(
    scenes: readonly LessonSceneDefinition[],
  ): LessonSceneDefinition {
    const ordered = this.getOrderedScenes(scenes);
    const first = ordered[0];

    if (!first) {
      throw new SceneEngineRuntimeError(
        "NO_SCENES",
        "The lesson contains no scenes.",
      );
    }

    return first;
  }

  getScene(
    sceneId: string,
    scenes: readonly LessonSceneDefinition[],
  ): LessonSceneDefinition {
    const ordered = this.getOrderedScenes(scenes);
    const scene = ordered.find((candidate) => candidate.id === sceneId);

    if (!scene) {
      throw new SceneEngineRuntimeError(
        "SCENE_NOT_FOUND",
        `Scene "${sceneId}" was not found.`,
        { sceneId },
      );
    }

    return scene;
  }

  getSceneByKind(
    kind: LessonSceneKind,
    scenes: readonly LessonSceneDefinition[],
  ): LessonSceneDefinition | null {
    const ordered = this.getOrderedScenes(scenes);
    return ordered.find((scene) => scene.kind === kind) ?? null;
  }

  getNextScene(
    currentSceneId: string,
    scenes: readonly LessonSceneDefinition[],
  ): LessonSceneDefinition | null {
    const ordered = this.getOrderedScenes(scenes);
    const index = ordered.findIndex((scene) => scene.id === currentSceneId);

    if (index < 0) {
      throw new SceneEngineRuntimeError(
        "SCENE_NOT_FOUND",
        `Scene "${currentSceneId}" was not found.`,
        { currentSceneId },
      );
    }

    return ordered[index + 1] ?? null;
  }

  getPreviousScene(
    currentSceneId: string,
    scenes: readonly LessonSceneDefinition[],
  ): LessonSceneDefinition | null {
    const ordered = this.getOrderedScenes(scenes);
    const index = ordered.findIndex((scene) => scene.id === currentSceneId);

    if (index < 0) {
      throw new SceneEngineRuntimeError(
        "SCENE_NOT_FOUND",
        `Scene "${currentSceneId}" was not found.`,
        { currentSceneId },
      );
    }

    return index > 0 ? ordered[index - 1] ?? null : null;
  }

  findReviewScene(
    currentSceneId: string,
    scenes: readonly LessonSceneDefinition[],
  ): LessonSceneDefinition {
    const ordered = this.getOrderedScenes(scenes);
    const current = this.getScene(currentSceneId, ordered);

    const preferredKinds: readonly LessonSceneKind[] = [
      "GUIDED_PRACTICE",
      "PRESENTATION",
      "WARM_UP",
    ];

    for (const kind of preferredKinds) {
      const candidate = [...ordered]
        .reverse()
        .find(
          (scene) =>
            scene.kind === kind &&
            scene.order <= current.order,
        );

      if (candidate) {
        return candidate;
      }
    }

    return current;
  }

  findAssessmentScene(
    scenes: readonly LessonSceneDefinition[],
  ): LessonSceneDefinition | null {
    const ordered = this.getOrderedScenes(scenes);

    return (
      ordered.find((scene) => scene.kind === "ASSESSMENT") ??
      ordered.find((scene) => scene.kind === "WRAP_UP") ??
      null
    );
  }

  evaluateProgress(
    scene: LessonSceneDefinition,
    progress: LessonDirectorProgress,
    signal: StudentLearningSignal,
  ): SceneProgressEvaluation {
    this.validateScene(scene);

    const minimumTurns = Math.max(
      1,
      scene.minimumTurns ?? this.config.defaultMinimumTurns,
    );

    const maximumTurns = Math.max(
      minimumTurns,
      scene.maximumTurns ?? this.config.defaultMaximumTurns,
    );

    const projectedTurns = progress.currentSceneTurnCount + 1;

    const projectedCorrectAnswers =
      signal.responseQuality === "CORRECT" ||
      signal.responseQuality === "MASTERED"
        ? progress.consecutiveCorrectAnswers + 1
        : 0;

    const projectedIncorrectAnswers =
      signal.responseQuality === "INCORRECT" ||
      signal.responseQuality === "NO_RESPONSE"
        ? progress.consecutiveIncorrectAnswers + 1
        : 0;

    const minimumTurnsSatisfied = projectedTurns >= minimumTurns;
    const maximumTurnsReached = projectedTurns >= maximumTurns;
    const masterySatisfied =
      signal.responseQuality === "MASTERED" ||
      projectedCorrectAnswers >= this.config.masteryCorrectAnswers;

    const shouldReview =
      projectedIncorrectAnswers >=
      this.config.incorrectAnswersBeforeReview;

    const shouldRepeat =
      signal.needsSupport ||
      signal.responseQuality === "INCORRECT" ||
      signal.responseQuality === "NO_RESPONSE" ||
      signal.responseQuality === "PARTIALLY_CORRECT";

    const sceneComplete =
      maximumTurnsReached ||
      (minimumTurnsSatisfied && masterySatisfied);

    let reason: string;

    if (shouldReview) {
      reason =
        "The learner has shown repeated difficulty and should enter review.";
    } else if (maximumTurnsReached) {
      reason =
        "The scene reached its maximum turn limit and should progress.";
    } else if (sceneComplete) {
      reason =
        "The scene minimum was satisfied and the learner demonstrated mastery.";
    } else if (shouldRepeat) {
      reason =
        "The learner needs another attempt or additional support in this scene.";
    } else {
      reason =
        "The scene remains active because its completion conditions are not yet satisfied.";
    }

    return {
      minimumTurnsSatisfied,
      maximumTurnsReached,
      masterySatisfied,
      sceneComplete,
      shouldReview,
      shouldRepeat,
      reason,
    };
  }

  selectNextScene(input: {
    readonly currentSceneId: string;
    readonly scenes: readonly LessonSceneDefinition[];
    readonly progress: LessonDirectorProgress;
    readonly signal: StudentLearningSignal;
    readonly forceAdvance?: boolean;
  }): SceneSelection {
    const ordered = this.getOrderedScenes(input.scenes);
    const currentScene = this.getScene(
      input.currentSceneId,
      ordered,
    );

    const evaluation = this.evaluateProgress(
      currentScene,
      input.progress,
      input.signal,
    );

    const shouldAdvance =
      input.forceAdvance === true || evaluation.sceneComplete;

    if (!shouldAdvance) {
      return {
        currentScene,
        nextScene: currentScene,
        skippedSceneIds: [],
        completedCurrentScene: false,
        lessonSequenceComplete: false,
        reason: evaluation.reason,
      };
    }

    const immediateNext = this.getNextScene(
      currentScene.id,
      ordered,
    );

    if (!immediateNext) {
      return {
        currentScene,
        nextScene: null,
        skippedSceneIds: [],
        completedCurrentScene: true,
        lessonSequenceComplete: true,
        reason:
          "The current scene is complete and there are no remaining scenes.",
      };
    }

    if (
      !this.config.allowOptionalSceneSkipping ||
      immediateNext.required ||
      input.signal.responseQuality !== "MASTERED"
    ) {
      return {
        currentScene,
        nextScene: immediateNext,
        skippedSceneIds: [],
        completedCurrentScene: true,
        lessonSequenceComplete: false,
        reason: `Move to the next scene: ${immediateNext.title}.`,
      };
    }

    const immediateIndex = ordered.findIndex(
      (scene) => scene.id === immediateNext.id,
    );

    const requiredIndex = ordered.findIndex(
      (scene, index) =>
        index > immediateIndex && scene.required,
    );

    if (requiredIndex < 0) {
      return {
        currentScene,
        nextScene: null,
        skippedSceneIds: ordered
          .slice(immediateIndex)
          .filter((scene) => !scene.required)
          .map((scene) => scene.id),
        completedCurrentScene: true,
        lessonSequenceComplete: true,
        reason:
          "The learner demonstrated mastery, so the remaining optional scenes were skipped.",
      };
    }

    const requiredScene = ordered[requiredIndex];
    const skippedSceneIds = ordered
      .slice(immediateIndex, requiredIndex)
      .filter((scene) => !scene.required)
      .map((scene) => scene.id);

    return {
      currentScene,
      nextScene: requiredScene,
      skippedSceneIds,
      completedCurrentScene: true,
      lessonSequenceComplete: false,
      reason:
        skippedSceneIds.length > 0
          ? `The learner demonstrated mastery, so ${skippedSceneIds.length} optional scene(s) were skipped.`
          : `Move to the next required scene: ${requiredScene.title}.`,
    };
  }

  areRequiredScenesComplete(
    scenes: readonly LessonSceneDefinition[],
    completedSceneIds: readonly string[],
  ): boolean {
    const ordered = this.getOrderedScenes(scenes);
    const completed = new Set(completedSceneIds);

    return ordered
      .filter((scene) => scene.required)
      .every((scene) => completed.has(scene.id));
  }

  safeGetFirstScene(
    scenes: readonly LessonSceneDefinition[],
  ): SceneEngineResult<LessonSceneDefinition> {
    return this.safe(() => this.getFirstScene(scenes));
  }

  safeEvaluateProgress(
    scene: LessonSceneDefinition,
    progress: LessonDirectorProgress,
    signal: StudentLearningSignal,
  ): SceneEngineResult<SceneProgressEvaluation> {
    return this.safe(() =>
      this.evaluateProgress(scene, progress, signal),
    );
  }

  safeSelectNextScene(input: {
    readonly currentSceneId: string;
    readonly scenes: readonly LessonSceneDefinition[];
    readonly progress: LessonDirectorProgress;
    readonly signal: StudentLearningSignal;
    readonly forceAdvance?: boolean;
  }): SceneEngineResult<SceneSelection> {
    return this.safe(() => this.selectNextScene(input));
  }

  private safe<T>(operation: () => T): SceneEngineResult<T> {
    try {
      return {
        ok: true,
        data: operation(),
      };
    } catch (error) {
      return {
        ok: false,
        error: toSceneEngineError(error),
      };
    }
  }

  private validateConfig(): void {
    if (this.config.defaultMinimumTurns < 1) {
      throw new SceneEngineRuntimeError(
        "INVALID_CONFIG",
        "defaultMinimumTurns must be at least 1.",
      );
    }

    if (
      this.config.defaultMaximumTurns <
      this.config.defaultMinimumTurns
    ) {
      throw new SceneEngineRuntimeError(
        "INVALID_CONFIG",
        "defaultMaximumTurns cannot be smaller than defaultMinimumTurns.",
      );
    }

    if (this.config.masteryCorrectAnswers < 1) {
      throw new SceneEngineRuntimeError(
        "INVALID_CONFIG",
        "masteryCorrectAnswers must be at least 1.",
      );
    }

    if (this.config.incorrectAnswersBeforeReview < 1) {
      throw new SceneEngineRuntimeError(
        "INVALID_CONFIG",
        "incorrectAnswersBeforeReview must be at least 1.",
      );
    }
  }

  private validateScenes(
    scenes: readonly LessonSceneDefinition[],
  ): void {
    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new SceneEngineRuntimeError(
        "NO_SCENES",
        "At least one scene is required.",
      );
    }

    const ids = new Set<string>();
    const orders = new Set<number>();

    for (const scene of scenes) {
      this.validateScene(scene);

      if (ids.has(scene.id)) {
        throw new SceneEngineRuntimeError(
          "INVALID_SCENE",
          `Duplicate scene ID "${scene.id}".`,
          { sceneId: scene.id },
        );
      }

      if (orders.has(scene.order)) {
        throw new SceneEngineRuntimeError(
          "INVALID_SCENE",
          `Duplicate scene order "${scene.order}".`,
          { order: scene.order },
        );
      }

      ids.add(scene.id);
      orders.add(scene.order);
    }
  }

  private validateScene(
    scene: LessonSceneDefinition,
  ): void {
    if (!scene.id.trim()) {
      throw new SceneEngineRuntimeError(
        "INVALID_SCENE",
        "Every scene must have a non-empty ID.",
      );
    }

    if (!scene.title.trim()) {
      throw new SceneEngineRuntimeError(
        "INVALID_SCENE",
        `Scene "${scene.id}" must have a title.`,
        { sceneId: scene.id },
      );
    }

    if (!Number.isFinite(scene.order)) {
      throw new SceneEngineRuntimeError(
        "INVALID_SCENE",
        `Scene "${scene.id}" must have a finite order.`,
        { sceneId: scene.id, order: scene.order },
      );
    }

    if (
      scene.minimumTurns !== undefined &&
      scene.minimumTurns < 1
    ) {
      throw new SceneEngineRuntimeError(
        "INVALID_SCENE",
        `Scene "${scene.id}" minimumTurns must be at least 1.`,
        { sceneId: scene.id },
      );
    }

    if (
      scene.maximumTurns !== undefined &&
      scene.maximumTurns < 1
    ) {
      throw new SceneEngineRuntimeError(
        "INVALID_SCENE",
        `Scene "${scene.id}" maximumTurns must be at least 1.`,
        { sceneId: scene.id },
      );
    }

    if (
      scene.minimumTurns !== undefined &&
      scene.maximumTurns !== undefined &&
      scene.maximumTurns < scene.minimumTurns
    ) {
      throw new SceneEngineRuntimeError(
        "INVALID_SCENE",
        `Scene "${scene.id}" maximumTurns cannot be smaller than minimumTurns.`,
        { sceneId: scene.id },
      );
    }
  }
}

export function createSceneEngine(
  config: SceneEngineConfig = {},
): SceneEngine {
  return new SceneEngine(config);
}

export function selectNextLessonScene(
  input: {
    readonly currentSceneId: string;
    readonly scenes: readonly LessonSceneDefinition[];
    readonly progress: LessonDirectorProgress;
    readonly signal: StudentLearningSignal;
    readonly forceAdvance?: boolean;
  },
  config: SceneEngineConfig = {},
): SceneSelection {
  return new SceneEngine(config).selectNextScene(input);
}

export function safeSelectNextLessonScene(
  input: {
    readonly currentSceneId: string;
    readonly scenes: readonly LessonSceneDefinition[];
    readonly progress: LessonDirectorProgress;
    readonly signal: StudentLearningSignal;
    readonly forceAdvance?: boolean;
  },
  config: SceneEngineConfig = {},
): SceneEngineResult<SceneSelection> {
  return new SceneEngine(config).safeSelectNextScene(input);
}

function toSceneEngineError(
  error: unknown,
): SceneEngineError {
  if (error instanceof SceneEngineRuntimeError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  return {
    code: "INVALID_SCENE",
    message:
      error instanceof Error
        ? error.message
        : "The Scene Engine failed.",
  };
}

export const LessonSceneEngine = {
  create: createSceneEngine,
  selectNext: selectNextLessonScene,
  safeSelectNext: safeSelectNextLessonScene,
} as const;
