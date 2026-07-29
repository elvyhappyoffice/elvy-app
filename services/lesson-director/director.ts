/**
 * Elvy Lesson Director
 *
 * The Lesson Director answers one question:
 * "What should Elvy do next in this lesson?"
 *
 * It is deterministic and stateless. It does not call OpenAI, Supabase,
 * React, the API route, the whiteboard, voice, avatar, or chat directly.
 * It only produces the next immutable Director state, a pedagogical decision,
 * classroom instructions, and domain events.
 */

import {
  getOrderedLessonScenes,
  isTerminalLessonDirectorState,
  type AvatarInstruction,
  type ClassroomInstruction,
  type DirectorAction,
  type LessonDirectorContext,
  type LessonDirectorDecision,
  type LessonDirectorError,
  type LessonDirectorEvent,
  type LessonDirectorExecutionResult,
  type LessonDirectorResult,
  type LessonDirectorState,
  type LessonDirectorStatus,
  type LessonSceneDefinition,
  type LessonSceneKind,
  type StudentLearningSignal,
  type SupportLevel,
  type TeachingStrategyKind,
  type WhiteboardInstruction,
} from "./types";

export interface LessonDirectorConfig {
  /**
   * Number of consecutive incorrect answers before the Director enters review.
   */
  readonly reviewAfterIncorrectAnswers?: number;

  /**
   * Number of consecutive correct answers that may allow a scene to finish
   * after its minimum turn requirement has been satisfied.
   */
  readonly advanceAfterCorrectAnswers?: number;

  /**
   * Maximum number of reviews allowed before the Director moves to assessment.
   */
  readonly maximumReviews?: number;

  /**
   * When true, optional scenes may be skipped after their minimum requirements
   * are met and the learner demonstrates mastery.
   */
  readonly allowOptionalSceneSkipping?: boolean;
}

const DEFAULT_CONFIG: Required<LessonDirectorConfig> = {
  reviewAfterIncorrectAnswers: 2,
  advanceAfterCorrectAnswers: 2,
  maximumReviews: 2,
  allowOptionalSceneSkipping: true,
};

export class LessonDirectorRuntimeError extends Error {
  readonly code: LessonDirectorError["code"];
  readonly recoverable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: LessonDirectorError["code"],
    message: string,
    options: {
      readonly recoverable?: boolean;
      readonly details?: Readonly<Record<string, unknown>>;
      readonly cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "LessonDirectorRuntimeError";
    this.code = code;
    this.recoverable = options.recoverable ?? false;
    this.details = options.details;
  }
}

export class LessonDirector {
  private readonly config: Required<LessonDirectorConfig>;

  constructor(config: LessonDirectorConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.validateConfig();
  }

  decide(context: LessonDirectorContext): LessonDirectorResult {
    this.validateContext(context);

    const now = new Date().toISOString();
    const scenes = getOrderedLessonScenes(context.scenes);
    const previousState = context.state;

    if (isTerminalLessonDirectorState(previousState)) {
      throw new LessonDirectorRuntimeError(
        "LESSON_ALREADY_COMPLETED",
        `Lesson "${previousState.lessonId}" has already been completed.`,
        {
          recoverable: false,
          details: {
            sessionId: previousState.sessionId,
            lessonId: previousState.lessonId,
          },
        },
      );
    }

    const requestedAction = context.requestedAction;

    if (requestedAction === "PAUSE") {
      return this.buildPauseResult(previousState, now);
    }

    if (previousState.status === "PAUSED") {
      if (requestedAction !== "RESUME") {
        return this.buildPausedWaitingResult(previousState, now);
      }

      return this.buildResumeResult(context, scenes, now);
    }

    if (
      previousState.status === "IDLE" ||
      requestedAction === "START_LESSON"
    ) {
      return this.buildStartResult(context, scenes, now);
    }

    if (
      context.lessonCompletedByTeachingBrain ||
      requestedAction === "COMPLETE_LESSON"
    ) {
      return this.buildCompletionResult(context, now);
    }

    if (requestedAction === "REVIEW") {
      return this.buildReviewResult(
        context,
        scenes,
        now,
        "Review was explicitly requested.",
      );
    }

    if (requestedAction === "ASSESS") {
      return this.buildAssessmentResult(
        context,
        scenes,
        now,
        "Assessment was explicitly requested.",
      );
    }

    return this.buildTeachingResult(context, scenes, now);
  }

  safeDecide(context: LessonDirectorContext): LessonDirectorExecutionResult {
    try {
      return {
        ok: true,
        data: this.decide(context),
      };
    } catch (error) {
      return {
        ok: false,
        error: toLessonDirectorError(error),
      };
    }
  }

  private buildStartResult(
    context: LessonDirectorContext,
    scenes: readonly LessonSceneDefinition[],
    now: string,
  ): LessonDirectorResult {
    const firstScene = scenes[0];

    if (!firstScene) {
      throw new LessonDirectorRuntimeError(
        "NO_SCENES",
        "The lesson cannot start because it has no scenes.",
        { recoverable: false },
      );
    }

    const strategy = chooseStrategy(firstScene, context.studentSignal);
    const decision: LessonDirectorDecision = {
      action: "START_LESSON",
      nextStatus: statusForScene(firstScene.kind),
      nextSceneId: firstScene.id,
      nextSceneKind: firstScene.kind,
      strategy,
      supportLevel: normalizeSupportLevel(context.studentSignal),
      waitForStudentResponse: true,
      repeatCurrentScene: false,
      requiresReview: false,
      finishLesson: false,
      reason: `Start the lesson with the first scene: ${firstScene.title}.`,
    };

    const nextState = createNextState({
      previousState: context.state,
      decision,
      signal: context.studentSignal,
      now,
      sceneChanged: true,
      completedSceneId: null,
      completedObjectiveIds:
        context.studentSignal.completedObjectiveIds ?? [],
      started: true,
    });

    return {
      previousState: context.state,
      nextState,
      decision,
      classroomInstructions: buildClassroomInstructions(
        decision,
        firstScene,
        context.studentSignal,
      ),
      emittedEvents: [
        createEvent("LESSON_STARTED", nextState, now, firstScene, strategy),
        createEvent("SCENE_STARTED", nextState, now, firstScene, strategy),
      ],
    };
  }

  private buildTeachingResult(
    context: LessonDirectorContext,
    scenes: readonly LessonSceneDefinition[],
    now: string,
  ): LessonDirectorResult {
    const currentScene = resolveCurrentScene(context.state, scenes);
    const signal = context.studentSignal;
    const progress = context.state.progress;

    if (
      signal.needsSupport ||
      signal.responseQuality === "INCORRECT" ||
      signal.responseQuality === "NO_RESPONSE"
    ) {
      if (
        progress.consecutiveIncorrectAnswers + 1 >=
          this.config.reviewAfterIncorrectAnswers &&
        progress.reviewCount < this.config.maximumReviews
      ) {
        return this.buildReviewResult(
          context,
          scenes,
          now,
          "The learner needs review after repeated difficulty.",
        );
      }

      return this.buildSupportResult(context, currentScene, now);
    }

    const minimumTurns = Math.max(1, currentScene.minimumTurns ?? 1);
    const maximumTurns = Math.max(
      minimumTurns,
      currentScene.maximumTurns ?? Number.POSITIVE_INFINITY,
    );

    const projectedSceneTurns = progress.currentSceneTurnCount + 1;
    const projectedCorrectAnswers =
      signal.responseQuality === "CORRECT" ||
      signal.responseQuality === "MASTERED"
        ? progress.consecutiveCorrectAnswers + 1
        : 0;

    const minimumSatisfied = projectedSceneTurns >= minimumTurns;
    const masterySatisfied =
      signal.responseQuality === "MASTERED" ||
      projectedCorrectAnswers >= this.config.advanceAfterCorrectAnswers;
    const maximumReached = projectedSceneTurns >= maximumTurns;

    const mayAdvance =
      maximumReached ||
      (minimumSatisfied && masterySatisfied) ||
      context.requestedAction === "MOVE_TO_NEXT_SCENE";

    if (mayAdvance) {
      const nextScene = findNextScene(currentScene, scenes);

      if (!nextScene) {
        return this.buildCompletionResult(
          {
            ...context,
            lessonCompletedByTeachingBrain:
              context.lessonCompletedByTeachingBrain ||
              requiredObjectivesCompleted(context),
          },
          now,
        );
      }

      if (
        this.config.allowOptionalSceneSkipping &&
        !nextScene.required &&
        signal.responseQuality === "MASTERED"
      ) {
        const requiredSceneAfterOptional = findNextRequiredScene(
          nextScene,
          scenes,
        );

        if (requiredSceneAfterOptional) {
          return this.buildMoveResult(
            context,
            currentScene,
            requiredSceneAfterOptional,
            now,
            `The learner mastered the current material, so the optional scene "${nextScene.title}" was skipped.`,
          );
        }
      }

      return this.buildMoveResult(
        context,
        currentScene,
        nextScene,
        now,
        `The learner is ready to move from "${currentScene.title}" to "${nextScene.title}".`,
      );
    }

    return this.buildContinueResult(context, currentScene, now);
  }

  private buildContinueResult(
    context: LessonDirectorContext,
    scene: LessonSceneDefinition,
    now: string,
  ): LessonDirectorResult {
    const strategy =
      context.state.activeStrategy ??
      chooseStrategy(scene, context.studentSignal);

    const decision: LessonDirectorDecision = {
      action: "CONTINUE_SCENE",
      nextStatus: statusForScene(scene.kind),
      nextSceneId: scene.id,
      nextSceneKind: scene.kind,
      strategy,
      supportLevel: normalizeSupportLevel(context.studentSignal),
      waitForStudentResponse: true,
      repeatCurrentScene: false,
      requiresReview: false,
      finishLesson: false,
      reason: `Continue "${scene.title}" because its learning goal is still in progress.`,
    };

    const nextState = createNextState({
      previousState: context.state,
      decision,
      signal: context.studentSignal,
      now,
      sceneChanged: false,
      completedSceneId: null,
      completedObjectiveIds:
        context.studentSignal.completedObjectiveIds ?? [],
    });

    return {
      previousState: context.state,
      nextState,
      decision,
      classroomInstructions: buildClassroomInstructions(
        decision,
        scene,
        context.studentSignal,
      ),
      emittedEvents: strategyChangeEvents(
        context.state,
        nextState,
        scene,
        strategy,
        now,
      ),
    };
  }

  private buildSupportResult(
    context: LessonDirectorContext,
    scene: LessonSceneDefinition,
    now: string,
  ): LessonDirectorResult {
    const signal = context.studentSignal;
    const supportLevel = normalizeSupportLevel(signal);
    const shouldSimplify =
      supportLevel === "GUIDED" || supportLevel === "INTENSIVE";

    const decision: LessonDirectorDecision = {
      action: shouldSimplify ? "SIMPLIFY" : "GIVE_SUPPORT",
      nextStatus: statusForScene(scene.kind),
      nextSceneId: scene.id,
      nextSceneKind: scene.kind,
      strategy: chooseSupportStrategy(scene),
      supportLevel,
      waitForStudentResponse: true,
      repeatCurrentScene: true,
      requiresReview: false,
      finishLesson: false,
      reason: shouldSimplify
        ? `Simplify "${scene.title}" and provide guided support before trying again.`
        : `Give light support and repeat the current learning step.`,
    };

    const nextState = createNextState({
      previousState: context.state,
      decision,
      signal,
      now,
      sceneChanged: false,
      completedSceneId: null,
      completedObjectiveIds: signal.completedObjectiveIds ?? [],
    });

    const events: LessonDirectorEvent[] = [
      createEvent(
        "SUPPORT_REQUESTED",
        nextState,
        now,
        scene,
        decision.strategy,
        {
          supportLevel,
          detectedDifficulty: signal.detectedDifficulty,
        },
      ),
      createEvent(
        "SCENE_REPEATED",
        nextState,
        now,
        scene,
        decision.strategy,
      ),
    ];

    return {
      previousState: context.state,
      nextState,
      decision,
      classroomInstructions: buildClassroomInstructions(
        decision,
        scene,
        signal,
      ),
      emittedEvents: events,
    };
  }

  private buildReviewResult(
    context: LessonDirectorContext,
    scenes: readonly LessonSceneDefinition[],
    now: string,
    reason: string,
  ): LessonDirectorResult {
    const currentScene = resolveCurrentScene(context.state, scenes);
    const reviewScene =
      findSceneByKind("GUIDED_PRACTICE", scenes) ??
      findSceneByKind("PRESENTATION", scenes) ??
      currentScene;

    const decision: LessonDirectorDecision = {
      action: "REVIEW",
      nextStatus: "REVIEWING",
      nextSceneId: reviewScene.id,
      nextSceneKind: reviewScene.kind,
      strategy: "REVIEW",
      supportLevel: normalizeSupportLevel(context.studentSignal),
      waitForStudentResponse: true,
      repeatCurrentScene: reviewScene.id === currentScene.id,
      requiresReview: true,
      finishLesson: false,
      reason,
    };

    const nextState = createNextState({
      previousState: context.state,
      decision,
      signal: context.studentSignal,
      now,
      sceneChanged: reviewScene.id !== currentScene.id,
      completedSceneId: null,
      completedObjectiveIds:
        context.studentSignal.completedObjectiveIds ?? [],
      incrementReviewCount: true,
    });

    return {
      previousState: context.state,
      nextState,
      decision,
      classroomInstructions: buildClassroomInstructions(
        decision,
        reviewScene,
        context.studentSignal,
      ),
      emittedEvents: [
        createEvent(
          "REVIEW_STARTED",
          nextState,
          now,
          reviewScene,
          "REVIEW",
          { previousSceneId: currentScene.id },
        ),
      ],
    };
  }

  private buildAssessmentResult(
    context: LessonDirectorContext,
    scenes: readonly LessonSceneDefinition[],
    now: string,
    reason: string,
  ): LessonDirectorResult {
    const currentScene = resolveCurrentScene(context.state, scenes);
    const assessmentScene =
      findSceneByKind("ASSESSMENT", scenes) ??
      findSceneByKind("WRAP_UP", scenes) ??
      currentScene;

    const decision: LessonDirectorDecision = {
      action: "ASSESS",
      nextStatus: "ASSESSING",
      nextSceneId: assessmentScene.id,
      nextSceneKind: assessmentScene.kind,
      strategy:
        assessmentScene.preferredStrategies[0] ??
        context.state.activeStrategy ??
        "REVIEW",
      supportLevel: "NONE",
      waitForStudentResponse: true,
      repeatCurrentScene: false,
      requiresReview: false,
      finishLesson: false,
      reason,
    };

    const nextState = createNextState({
      previousState: context.state,
      decision,
      signal: context.studentSignal,
      now,
      sceneChanged: assessmentScene.id !== currentScene.id,
      completedSceneId:
        assessmentScene.id !== currentScene.id ? currentScene.id : null,
      completedObjectiveIds:
        context.studentSignal.completedObjectiveIds ?? [],
    });

    return {
      previousState: context.state,
      nextState,
      decision,
      classroomInstructions: buildClassroomInstructions(
        decision,
        assessmentScene,
        context.studentSignal,
      ),
      emittedEvents: [
        ...(assessmentScene.id !== currentScene.id
          ? [
              createEvent(
                "SCENE_COMPLETED",
                nextState,
                now,
                currentScene,
                context.state.activeStrategy,
              ),
            ]
          : []),
        createEvent(
          "ASSESSMENT_STARTED",
          nextState,
          now,
          assessmentScene,
          decision.strategy,
        ),
      ],
    };
  }

  private buildMoveResult(
    context: LessonDirectorContext,
    currentScene: LessonSceneDefinition,
    nextScene: LessonSceneDefinition,
    now: string,
    reason: string,
  ): LessonDirectorResult {
    const strategy = chooseStrategy(nextScene, context.studentSignal);

    const action: DirectorAction =
      nextScene.kind === "ASSESSMENT"
        ? "ASSESS"
        : "MOVE_TO_NEXT_SCENE";

    const decision: LessonDirectorDecision = {
      action,
      nextStatus: statusForScene(nextScene.kind),
      nextSceneId: nextScene.id,
      nextSceneKind: nextScene.kind,
      strategy,
      supportLevel: normalizeSupportLevel(context.studentSignal),
      waitForStudentResponse: true,
      repeatCurrentScene: false,
      requiresReview: false,
      finishLesson: false,
      reason,
    };

    const nextState = createNextState({
      previousState: context.state,
      decision,
      signal: context.studentSignal,
      now,
      sceneChanged: true,
      completedSceneId: currentScene.id,
      completedObjectiveIds:
        context.studentSignal.completedObjectiveIds ?? [],
    });

    const events: LessonDirectorEvent[] = [
      createEvent(
        "SCENE_COMPLETED",
        nextState,
        now,
        currentScene,
        context.state.activeStrategy,
      ),
      createEvent("SCENE_STARTED", nextState, now, nextScene, strategy),
    ];

    if (nextScene.kind === "ASSESSMENT") {
      events.push(
        createEvent(
          "ASSESSMENT_STARTED",
          nextState,
          now,
          nextScene,
          strategy,
        ),
      );
    }

    return {
      previousState: context.state,
      nextState,
      decision,
      classroomInstructions: buildClassroomInstructions(
        decision,
        nextScene,
        context.studentSignal,
      ),
      emittedEvents: events,
    };
  }

  private buildCompletionResult(
    context: LessonDirectorContext,
    now: string,
  ): LessonDirectorResult {
    const decision: LessonDirectorDecision = {
      action: "COMPLETE_LESSON",
      nextStatus: "COMPLETED",
      nextSceneId: context.state.currentSceneId,
      nextSceneKind: context.state.currentSceneKind,
      strategy: context.state.activeStrategy,
      supportLevel: "NONE",
      waitForStudentResponse: false,
      repeatCurrentScene: false,
      requiresReview: false,
      finishLesson: true,
      reason: context.lessonCompletedByTeachingBrain
        ? "The Teaching Brain confirmed that the lesson is complete."
        : "All required lesson objectives and scenes are complete.",
    };

    const nextState: LessonDirectorState = {
      ...context.state,
      status: "COMPLETED",
      progress: {
        ...context.state.progress,
        completedObjectiveIds: mergeUnique(
          context.state.progress.completedObjectiveIds,
          context.studentSignal.completedObjectiveIds ?? [],
        ),
        totalTurnCount: context.state.progress.totalTurnCount + 1,
      },
      revision: context.state.revision + 1,
      updatedAt: now,
      completedAt: now,
    };

    const completionInstructions: readonly ClassroomInstruction[] = [
      {
        channel: "WHITEBOARD",
        action: "SHOW_FEEDBACK",
        content: "Lesson completed",
        emphasis: "HIGH",
      },
      {
        channel: "AVATAR",
        action: "CELEBRATE",
      },
      {
        channel: "VOICE",
        action: "SPEAK",
        text: "Well done. You have completed this lesson.",
        pace: "NORMAL",
      },
      {
        channel: "CHAT",
        action: "SHOW_FEEDBACK",
        text: "You have completed this lesson.",
      },
    ];

    return {
      previousState: context.state,
      nextState,
      decision,
      classroomInstructions: completionInstructions,
      emittedEvents: [
        createEvent(
          "LESSON_COMPLETED",
          nextState,
          now,
          undefined,
          context.state.activeStrategy,
        ),
      ],
    };
  }

  private buildPauseResult(
    previousState: LessonDirectorState,
    now: string,
  ): LessonDirectorResult {
    const decision: LessonDirectorDecision = {
      action: "PAUSE",
      nextStatus: "PAUSED",
      nextSceneId: previousState.currentSceneId,
      nextSceneKind: previousState.currentSceneKind,
      strategy: previousState.activeStrategy,
      supportLevel: "NONE",
      waitForStudentResponse: false,
      repeatCurrentScene: false,
      requiresReview: false,
      finishLesson: false,
      reason: "Pause the lesson and preserve the current teaching position.",
    };

    const nextState: LessonDirectorState = {
      ...previousState,
      status: "PAUSED",
      revision: previousState.revision + 1,
      updatedAt: now,
    };

    return {
      previousState,
      nextState,
      decision,
      classroomInstructions: [
        {
          channel: "VOICE",
          action: "SILENT",
        },
        {
          channel: "AVATAR",
          action: "IDLE",
        },
      ],
      emittedEvents: [
        createEvent("LESSON_PAUSED", nextState, now),
      ],
    };
  }

  private buildPausedWaitingResult(
    previousState: LessonDirectorState,
    now: string,
  ): LessonDirectorResult {
    const decision: LessonDirectorDecision = {
      action: "PAUSE",
      nextStatus: "PAUSED",
      nextSceneId: previousState.currentSceneId,
      nextSceneKind: previousState.currentSceneKind,
      strategy: previousState.activeStrategy,
      supportLevel: "NONE",
      waitForStudentResponse: false,
      repeatCurrentScene: false,
      requiresReview: false,
      finishLesson: false,
      reason: "The lesson remains paused until a resume action is requested.",
    };

    return {
      previousState,
      nextState: previousState,
      decision,
      classroomInstructions: [
        {
          channel: "VOICE",
          action: "SILENT",
        },
        {
          channel: "AVATAR",
          action: "IDLE",
        },
      ],
      emittedEvents: [],
    };
  }

  private buildResumeResult(
    context: LessonDirectorContext,
    scenes: readonly LessonSceneDefinition[],
    now: string,
  ): LessonDirectorResult {
    const currentScene = resolveCurrentScene(context.state, scenes);
    const strategy =
      context.state.activeStrategy ??
      chooseStrategy(currentScene, context.studentSignal);

    const decision: LessonDirectorDecision = {
      action: "RESUME",
      nextStatus: statusForScene(currentScene.kind),
      nextSceneId: currentScene.id,
      nextSceneKind: currentScene.kind,
      strategy,
      supportLevel: normalizeSupportLevel(context.studentSignal),
      waitForStudentResponse: true,
      repeatCurrentScene: false,
      requiresReview: false,
      finishLesson: false,
      reason: `Resume the lesson from "${currentScene.title}".`,
    };

    const nextState: LessonDirectorState = {
      ...context.state,
      status: decision.nextStatus,
      activeStrategy: strategy,
      revision: context.state.revision + 1,
      updatedAt: now,
    };

    return {
      previousState: context.state,
      nextState,
      decision,
      classroomInstructions: buildClassroomInstructions(
        decision,
        currentScene,
        context.studentSignal,
      ),
      emittedEvents: [
        createEvent(
          "LESSON_RESUMED",
          nextState,
          now,
          currentScene,
          strategy,
        ),
      ],
    };
  }

  private validateConfig(): void {
    if (this.config.reviewAfterIncorrectAnswers < 1) {
      throw new LessonDirectorRuntimeError(
        "INVALID_INPUT",
        "reviewAfterIncorrectAnswers must be at least 1.",
      );
    }

    if (this.config.advanceAfterCorrectAnswers < 1) {
      throw new LessonDirectorRuntimeError(
        "INVALID_INPUT",
        "advanceAfterCorrectAnswers must be at least 1.",
      );
    }

    if (this.config.maximumReviews < 0) {
      throw new LessonDirectorRuntimeError(
        "INVALID_INPUT",
        "maximumReviews cannot be negative.",
      );
    }
  }

  private validateContext(context: LessonDirectorContext): void {
    if (!context?.state) {
      throw new LessonDirectorRuntimeError(
        "INVALID_INPUT",
        "Lesson Director state is required.",
      );
    }

    if (!context.state.sessionId.trim()) {
      throw new LessonDirectorRuntimeError(
        "INVALID_STATE",
        "Lesson Director state must contain a session ID.",
      );
    }

    if (!context.state.lessonId.trim()) {
      throw new LessonDirectorRuntimeError(
        "INVALID_STATE",
        "Lesson Director state must contain a lesson ID.",
      );
    }

    if (!context.state.studentId.trim()) {
      throw new LessonDirectorRuntimeError(
        "INVALID_STATE",
        "Lesson Director state must contain a student ID.",
      );
    }

    if (!Array.isArray(context.scenes) || context.scenes.length === 0) {
      throw new LessonDirectorRuntimeError(
        "NO_SCENES",
        "At least one lesson scene is required.",
        { recoverable: false },
      );
    }

    const sceneIds = new Set<string>();

    for (const scene of context.scenes) {
      if (!scene.id.trim()) {
        throw new LessonDirectorRuntimeError(
          "INVALID_INPUT",
          "Every lesson scene must contain an ID.",
        );
      }

      if (sceneIds.has(scene.id)) {
        throw new LessonDirectorRuntimeError(
          "INVALID_INPUT",
          `Duplicate lesson scene ID "${scene.id}".`,
        );
      }

      sceneIds.add(scene.id);
    }

    if (
      context.state.currentSceneId &&
      !sceneIds.has(context.state.currentSceneId)
    ) {
      throw new LessonDirectorRuntimeError(
        "SCENE_NOT_FOUND",
        `Current scene "${context.state.currentSceneId}" was not found.`,
        {
          recoverable: false,
          details: { currentSceneId: context.state.currentSceneId },
        },
      );
    }
  }
}

export function directLesson(
  context: LessonDirectorContext,
  config: LessonDirectorConfig = {},
): LessonDirectorResult {
  return new LessonDirector(config).decide(context);
}

export function safeDirectLesson(
  context: LessonDirectorContext,
  config: LessonDirectorConfig = {},
): LessonDirectorExecutionResult {
  return new LessonDirector(config).safeDecide(context);
}

function resolveCurrentScene(
  state: LessonDirectorState,
  scenes: readonly LessonSceneDefinition[],
): LessonSceneDefinition {
  if (!state.currentSceneId) {
    const first = scenes[0];

    if (!first) {
      throw new LessonDirectorRuntimeError(
        "NO_SCENES",
        "The lesson contains no scenes.",
      );
    }

    return first;
  }

  const scene = scenes.find(
    (candidate) => candidate.id === state.currentSceneId,
  );

  if (!scene) {
    throw new LessonDirectorRuntimeError(
      "SCENE_NOT_FOUND",
      `Scene "${state.currentSceneId}" was not found.`,
      {
        recoverable: false,
        details: { sceneId: state.currentSceneId },
      },
    );
  }

  return scene;
}

function findNextScene(
  currentScene: LessonSceneDefinition,
  scenes: readonly LessonSceneDefinition[],
): LessonSceneDefinition | null {
  const index = scenes.findIndex(
    (scene) => scene.id === currentScene.id,
  );

  if (index < 0) {
    throw new LessonDirectorRuntimeError(
      "SCENE_NOT_FOUND",
      `Scene "${currentScene.id}" was not found in the lesson sequence.`,
    );
  }

  return scenes[index + 1] ?? null;
}

function findNextRequiredScene(
  currentScene: LessonSceneDefinition,
  scenes: readonly LessonSceneDefinition[],
): LessonSceneDefinition | null {
  const index = scenes.findIndex(
    (scene) => scene.id === currentScene.id,
  );

  if (index < 0) return null;

  return (
    scenes
      .slice(index + 1)
      .find((scene) => scene.required) ?? null
  );
}

function findSceneByKind(
  kind: LessonSceneKind,
  scenes: readonly LessonSceneDefinition[],
): LessonSceneDefinition | null {
  return scenes.find((scene) => scene.kind === kind) ?? null;
}

function chooseStrategy(
  scene: LessonSceneDefinition,
  signal: StudentLearningSignal,
): TeachingStrategyKind {
  if (
    signal.needsSupport ||
    signal.responseQuality === "INCORRECT" ||
    signal.responseQuality === "NO_RESPONSE"
  ) {
    return chooseSupportStrategy(scene);
  }

  return scene.preferredStrategies[0] ?? strategyForScene(scene.kind);
}

function chooseSupportStrategy(
  scene: LessonSceneDefinition,
): TeachingStrategyKind {
  if (scene.preferredStrategies.includes("ENCOURAGEMENT")) {
    return "ENCOURAGEMENT";
  }

  if (scene.preferredStrategies.includes("REVIEW")) {
    return "REVIEW";
  }

  return scene.preferredStrategies[0] ?? "REVIEW";
}

function strategyForScene(
  sceneKind: LessonSceneKind,
): TeachingStrategyKind {
  switch (sceneKind) {
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

function statusForScene(
  sceneKind: LessonSceneKind,
): LessonDirectorStatus {
  switch (sceneKind) {
    case "WARM_UP":
    case "PRESENTATION":
      return "TEACHING";
    case "GUIDED_PRACTICE":
    case "INDEPENDENT_PRACTICE":
    case "PRODUCTION":
      return "PRACTISING";
    case "ASSESSMENT":
      return "ASSESSING";
    case "WRAP_UP":
      return "TEACHING";
  }
}

function normalizeSupportLevel(
  signal: StudentLearningSignal,
): SupportLevel {
  if (signal.needsSupport && signal.supportLevel === "NONE") {
    return "LIGHT";
  }

  return signal.supportLevel;
}

function createNextState(input: {
  readonly previousState: LessonDirectorState;
  readonly decision: LessonDirectorDecision;
  readonly signal: StudentLearningSignal;
  readonly now: string;
  readonly sceneChanged: boolean;
  readonly completedSceneId: string | null;
  readonly completedObjectiveIds: readonly string[];
  readonly incrementReviewCount?: boolean;
  readonly started?: boolean;
}): LessonDirectorState {
  const {
    previousState,
    decision,
    signal,
    now,
    sceneChanged,
    completedSceneId,
    completedObjectiveIds,
    incrementReviewCount = false,
    started = false,
  } = input;

  const responseCounters = updateResponseCounters(
    previousState,
    signal,
  );

  return {
    ...previousState,
    status: decision.nextStatus,
    currentSceneId: decision.nextSceneId,
    currentSceneKind: decision.nextSceneKind,
    activeStrategy: decision.strategy,
    progress: {
      ...previousState.progress,
      completedSceneIds: completedSceneId
        ? mergeUnique(
            previousState.progress.completedSceneIds,
            [completedSceneId],
          )
        : previousState.progress.completedSceneIds,
      completedObjectiveIds: mergeUnique(
        previousState.progress.completedObjectiveIds,
        completedObjectiveIds,
      ),
      currentSceneTurnCount: sceneChanged
        ? 0
        : previousState.progress.currentSceneTurnCount + 1,
      totalTurnCount: previousState.progress.totalTurnCount + 1,
      consecutiveCorrectAnswers:
        responseCounters.consecutiveCorrectAnswers,
      consecutiveIncorrectAnswers:
        responseCounters.consecutiveIncorrectAnswers,
      reviewCount:
        previousState.progress.reviewCount +
        (incrementReviewCount ? 1 : 0),
    },
    revision: previousState.revision + 1,
    startedAt:
      previousState.startedAt ?? (started ? now : null),
    updatedAt: now,
    completedAt: null,
  };
}

function updateResponseCounters(
  state: LessonDirectorState,
  signal: StudentLearningSignal,
): Pick<
  LessonDirectorState["progress"],
  "consecutiveCorrectAnswers" | "consecutiveIncorrectAnswers"
> {
  switch (signal.responseQuality) {
    case "CORRECT":
    case "MASTERED":
      return {
        consecutiveCorrectAnswers:
          state.progress.consecutiveCorrectAnswers + 1,
        consecutiveIncorrectAnswers: 0,
      };

    case "INCORRECT":
    case "NO_RESPONSE":
      return {
        consecutiveCorrectAnswers: 0,
        consecutiveIncorrectAnswers:
          state.progress.consecutiveIncorrectAnswers + 1,
      };

    case "PARTIALLY_CORRECT":
      return {
        consecutiveCorrectAnswers: 0,
        consecutiveIncorrectAnswers: 0,
      };

    case "NOT_EVALUATED":
      return {
        consecutiveCorrectAnswers:
          state.progress.consecutiveCorrectAnswers,
        consecutiveIncorrectAnswers:
          state.progress.consecutiveIncorrectAnswers,
      };
  }
}

function requiredObjectivesCompleted(
  context: LessonDirectorContext,
): boolean {
  const completed = new Set([
    ...context.state.progress.completedObjectiveIds,
    ...(context.studentSignal.completedObjectiveIds ?? []),
  ]);

  return context.objectives
    .filter((objective) => objective.required)
    .every((objective) => completed.has(objective.id));
}

function buildClassroomInstructions(
  decision: LessonDirectorDecision,
  scene: LessonSceneDefinition,
  signal: StudentLearningSignal,
): readonly ClassroomInstruction[] {
  const instructions: ClassroomInstruction[] = [];

  instructions.push(buildWhiteboardInstruction(decision, scene, signal));

  if (
    decision.action === "GIVE_SUPPORT" ||
    decision.action === "SIMPLIFY" ||
    decision.action === "REVIEW"
  ) {
    instructions.push({
      channel: "AVATAR",
      action: "ENCOURAGE",
    });
  } else if (decision.action === "ASSESS") {
    instructions.push({
      channel: "AVATAR",
      action: "LISTEN",
    });
  } else {
    instructions.push({
      channel: "AVATAR",
      action: "POINT_TO_BOARD",
    });
  }

  instructions.push({
    channel: "VOICE",
    action:
      decision.action === "REPEAT_SCENE"
        ? "REPEAT"
        : decision.strategy === "PRONUNCIATION"
          ? "MODEL_PRONUNCIATION"
          : "SPEAK",
    pace:
      decision.supportLevel === "GUIDED" ||
      decision.supportLevel === "INTENSIVE"
        ? "SLOW"
        : "NORMAL",
  });

  instructions.push({
    channel: "CHAT",
    action:
      decision.action === "ASSESS"
        ? "ASK_QUESTION"
        : decision.action === "GIVE_SUPPORT" ||
            decision.action === "SIMPLIFY" ||
            decision.action === "REVIEW"
          ? "SHOW_FEEDBACK"
          : "SHOW_MESSAGE",
  });

  return instructions;
}

function buildWhiteboardInstruction(
  decision: LessonDirectorDecision,
  scene: LessonSceneDefinition,
  signal: StudentLearningSignal,
): WhiteboardInstruction {
  if (
    decision.action === "GIVE_SUPPORT" ||
    decision.action === "SIMPLIFY"
  ) {
    return {
      channel: "WHITEBOARD",
      action: "SHOW_EXAMPLE",
      content: signal.detectedDifficulty
        ? `Support for: ${signal.detectedDifficulty}`
        : scene.title,
      targetId: scene.id,
      emphasis: "HIGH",
    };
  }

  if (decision.action === "REVIEW") {
    return {
      channel: "WHITEBOARD",
      action: "HIGHLIGHT",
      content: scene.title,
      targetId: scene.id,
      emphasis: "HIGH",
    };
  }

  if (decision.action === "ASSESS") {
    return {
      channel: "WHITEBOARD",
      action: "SHOW_QUESTION",
      content: scene.title,
      targetId: scene.id,
      emphasis: "MEDIUM",
    };
  }

  return {
    channel: "WHITEBOARD",
    action:
      decision.action === "START_LESSON" ||
      decision.action === "MOVE_TO_NEXT_SCENE"
        ? "SHOW_TITLE"
        : "KEEP",
    content: scene.title,
    targetId: scene.id,
    emphasis: "MEDIUM",
  };
}

function strategyChangeEvents(
  previousState: LessonDirectorState,
  nextState: LessonDirectorState,
  scene: LessonSceneDefinition,
  strategy: TeachingStrategyKind,
  now: string,
): readonly LessonDirectorEvent[] {
  if (previousState.activeStrategy === strategy) {
    return [];
  }

  return [
    createEvent(
      "STRATEGY_CHANGED",
      nextState,
      now,
      scene,
      strategy,
      { previousStrategy: previousState.activeStrategy },
    ),
  ];
}

function createEvent(
  type: LessonDirectorEvent["type"],
  state: LessonDirectorState,
  occurredAt: string,
  scene?: LessonSceneDefinition,
  strategy?: TeachingStrategyKind | null,
  metadata?: Readonly<Record<string, unknown>>,
): LessonDirectorEvent {
  return {
    type,
    sessionId: state.sessionId,
    lessonId: state.lessonId,
    ...(scene
      ? {
          sceneId: scene.id,
          sceneKind: scene.kind,
        }
      : {}),
    ...(strategy ? { strategy } : {}),
    occurredAt,
    ...(metadata ? { metadata } : {}),
  };
}

function mergeUnique(
  current: readonly string[],
  incoming: readonly string[],
): readonly string[] {
  return [...new Set([...current, ...incoming])];
}

function toLessonDirectorError(
  error: unknown,
): LessonDirectorError {
  if (error instanceof LessonDirectorRuntimeError) {
    return {
      code: error.code,
      message: error.message,
      recoverable: error.recoverable,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  return {
    code: "DIRECTOR_FAILED",
    message:
      error instanceof Error
        ? error.message
        : "The Lesson Director failed.",
    recoverable: false,
  };
}

export const LessonDirectorEngine = {
  decide: directLesson,
  safeDecide: safeDirectLesson,
} as const;
