/**
 * Elvy Teaching Brain
 * Public entry point and end-to-end runtime orchestrator.
 *
 * File: services/teaching-brain/index.ts
 */

import type {
  DirectorHints,
  LanguageCode,
  LearnerTurn,
  ResponseEvaluation,
  TeachingActivity,
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
  TeachingDecision,
  TeachingStage,
} from "./types";

import {
  ResponseEvaluator,
  mapEvaluationToAttemptOutcome,
  type DetailedResponseEvaluation,
  type ResponseEvaluatorConfig,
} from "./response-evaluator";

import {
  TeachingDecisionEngine,
  decisionToSessionAction,
  type DecisionEngineConfig,
  type DetailedTeachingDecision,
} from "./decision-engine";

import {
  TeachingSupportEngine,
  supportDeliveryToDirectorCommand,
  supportDeliveryToSessionUsage,
  type DetailedSupportDelivery,
  type SupportChannel,
  type SupportEngineConfig,
} from "./support-engine";

import {
  TeachingObjectiveTracker,
  objectiveTrackingToSessionCommands,
  type ObjectiveTrackerConfig,
  type ObjectiveTrackingResult,
} from "./objective-tracker";

import {
  TeachingLessonCompletionEngine,
  lessonCompletionToSessionCommand,
  type LessonCompletionEngineConfig,
  type LessonCompletionEvaluation,
} from "./lesson-completion";

import {
  TeachingSessionEngine,
  createTeachingSession,
  restoreTeachingSession,
  type CreateSessionInput,
  type SessionSnapshot,
  type TeachingSessionState,
} from "./session-engine";

import {
  assertValidTeachingBrainLesson,
  validateTeachingBrainLesson,
} from "./lesson-schema";

import type {
  TeachingSessionRecord,
  TeachingSessionRepository,
} from "../supabase/teaching-session-repository";

import { decideLesson } from "./lesson-director";
import type {
  LessonDirectorContext,
  LessonDirectorDecision,
} from "./lesson-director-types";

import { runSceneEngine } from "./scene-engine";
import type {
  SceneEngineContext,
  SceneEngineOutput,
  SceneEngineState,
  SceneEngineEvent,
} from "./scene-engine";
import type { SceneDefinition } from "./scene-definition";

import {
  buildWhiteboardPresentation,
  type WhiteboardEngineResult,
  type WhiteboardViewport,
} from "./whiteboard-engine";

import {
  createTeachingPackageAdapter,
  type TeachingPackageRoot,
} from "./teaching-package-adapter";


/* -------------------------------------------------------------------------- */
/*                              Public contracts                              */
/* -------------------------------------------------------------------------- */

export type TeachingBrainRuntimeConfig = {
  responseEvaluator?: ResponseEvaluatorConfig;
  decisionEngine?: DecisionEngineConfig;
  supportEngine?: SupportEngineConfig;
  objectiveTracker?: ObjectiveTrackerConfig;
  lessonCompletion?: LessonCompletionEngineConfig;

  /** Generate a Director-ready delivery after every decision. */
  generateSupportForEveryDecision?: boolean;

  /** Evaluate lesson completion after every processed learner turn. */
  evaluateCompletionAfterEveryTurn?: boolean;

  /** Apply safe Session Engine actions selected by the Decision Engine. */
  applyDecisionActions?: boolean;

  /** Stop the turn pipeline when support generation fails. */
  supportFailureIsFatal?: boolean;

  /** Optional runtime clock. */
  now?: () => string;
};

export type TeachingTurnClassroomRuntimeInput = {
  /**
   * Optional Lesson Director context. The runtime supplies its own timestamp
   * so every engine in one learner turn shares the same clock source.
   */
  lessonDirector?: Omit<LessonDirectorContext, "now"> & { now?: string };

  /**
   * Optional active Scene Engine execution. Scene definitions and runtime
   * state remain external data so this orchestrator does not invent scenes.
   */
  scene?: {
    definition: SceneDefinition;
    state: SceneEngineState;
    event: SceneEngineEvent;
  };

  /**
   * Whiteboard generation is enabled when a Scene Engine output exposes an
   * active step. By default, the normalized TeachingBrainLesson is used as
   * the package root; callers may provide the original LessonPlan instead.
   */
  whiteboard?: {
    packageRoot?: TeachingPackageRoot;
    packagePathPrefix?: string;
    strictRequiredReferences?: boolean;
    viewport?: WhiteboardViewport;
    speechHighlight?: {
      text?: string;
      targetId?: string;
      occurrence?: number;
    };
    activePageIndex?: number;
  };
};

export type ProcessTeachingTurnInput = {
  lesson: TeachingBrainLesson;
  session: TeachingSessionState;
  learnerTurn: LearnerTurn;

  /** Optional classroom orchestration inputs for Director, Scene, and board. */
  classroom?: TeachingTurnClassroomRuntimeInput;

  previousEvaluations?: ResponseEvaluation[];

  learnerName?: string;
  learnerL1?: LanguageCode;
  requestedL1?: boolean;
  consecutiveL1Turns?: number;
  preferredSupportChannels?: SupportChannel[];

  timeRemainingMinutes?: number;
  learnerReady?: boolean;
  humanSupportAvailable?: boolean;

  finalCompletionCheck?: boolean;
  recommendedNextLessonId?: string;

  metadata?: Record<string, unknown>;
};

export type TeachingBrainDirectorCommand = ReturnType<
  typeof supportDeliveryToDirectorCommand
> & {
  decisionId: string;
  decisionType: TeachingDecision["type"];
  decisionReason: TeachingDecision["reason"];
};

export type AppliedSessionAction = {
  action:
    | "record_attempt"
    | "update_objective"
    | "use_support"
    | "complete_activity"
    | "complete_stage"
    | "complete_lesson"
    | "skip_activity"
    | "change_activity"
    | "pause"
    | "record_only";
  applied: boolean;
  reason?: string;
  details?: Record<string, unknown>;
};

export type TeachingTurnTrace = {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stages: Array<{
    name:
      | "validate"
      | "evaluate_response"
      | "track_objectives"
      | "make_decision"
      | "record_attempt"
      | "apply_objectives"
      | "generate_support"
      | "apply_support"
      | "lesson_director"
      | "scene_engine"
      | "whiteboard"
      | "apply_decision"
      | "evaluate_completion";
    startedAt: string;
    completedAt: string;
    durationMs: number;
    ok: boolean;
    note?: string;
  }>;
};

export type ProcessTeachingTurnOutput = {
  lessonId: string;
  sessionId: string;
  learnerTurnId: string;

  evaluation: DetailedResponseEvaluation;
  objectiveTracking: ObjectiveTrackingResult;
  decision: DetailedTeachingDecision;
  support?: DetailedSupportDelivery;
  directorCommand?: TeachingBrainDirectorCommand;

  /** Structured classroom orchestration outputs. */
  lessonDirectorDecision?: LessonDirectorDecision;
  sceneEngineOutput?: SceneEngineOutput;
  whiteboard?: WhiteboardEngineResult;

  completion?: LessonCompletionEvaluation;

  session: TeachingSessionState;
  snapshot: SessionSnapshot;
  appliedActions: AppliedSessionAction[];
  warnings: TeachingBrainError[];
  trace: TeachingTurnTrace;
};

export type ProcessPersistedTeachingTurnInput = Omit<
  ProcessTeachingTurnInput,
  "session"
> & {
  readonly repository: TeachingSessionRepository;
  readonly sessionId: string;
  readonly curriculumId?: string;
  readonly organizationId?: string;
};

export type ProcessPersistedTeachingTurnOutput =
  ProcessTeachingTurnOutput & {
    readonly persistedSession: TeachingSessionRecord;
  };

export type SafeTeachingTurnResult =
  TeachingBrainResult<ProcessTeachingTurnOutput>;

export type SafePersistedTeachingTurnResult =
  TeachingBrainResult<ProcessPersistedTeachingTurnOutput>;

export type TeachingBrainRuntimeErrorCode =
  | "INVALID_INPUT"
  | "LESSON_SESSION_MISMATCH"
  | "TURN_SESSION_MISMATCH"
  | "TURN_CONTEXT_MISMATCH"
  | "SESSION_NOT_ACTIVE"
  | "SESSION_NOT_FOUND"
  | "PERSISTED_RUNTIME_MISMATCH"
  | "PERSISTENCE_FAILED"
  | "PIPELINE_FAILED";

export class TeachingBrainRuntimeError extends Error {
  readonly code: TeachingBrainRuntimeErrorCode;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: TeachingBrainRuntimeErrorCode,
    message: string,
    options?: {
      recoverable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "TeachingBrainRuntimeError";
    this.code = code;
    this.recoverable = options?.recoverable ?? true;
    this.details = options?.details;
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_RUNTIME_CONFIG: Required<
  Pick<
    TeachingBrainRuntimeConfig,
    | "generateSupportForEveryDecision"
    | "evaluateCompletionAfterEveryTurn"
    | "applyDecisionActions"
    | "supportFailureIsFatal"
  >
> = {
  generateSupportForEveryDecision: true,
  evaluateCompletionAfterEveryTurn: true,
  applyDecisionActions: true,
  supportFailureIsFatal: false,
};

function currentIso(now?: () => string): string {
  const raw = now?.() ?? new Date().toISOString();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new TeachingBrainRuntimeError(
      "INVALID_INPUT",
      `Invalid runtime date: ${raw}`,
      { recoverable: false },
    );
  }
  return parsed.toISOString();
}

function performanceNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function resolveContext(
  lesson: TeachingBrainLesson,
  turn: LearnerTurn,
): { stage: TeachingStage; activity: TeachingActivity } {
  const stage = lesson.stages.find((item) => item.id === turn.stageId);
  if (!stage) {
    throw new TeachingBrainRuntimeError(
      "TURN_CONTEXT_MISMATCH",
      `Stage "${turn.stageId}" was not found in lesson "${lesson.id}".`,
    );
  }

  const activity = stage.activities.find(
    (item) => item.id === turn.activityId,
  );
  if (!activity) {
    throw new TeachingBrainRuntimeError(
      "TURN_CONTEXT_MISMATCH",
      `Activity "${turn.activityId}" was not found in stage "${stage.id}".`,
    );
  }

  return { stage, activity };
}

function evaluationId(evaluation: ResponseEvaluation): string {
  return `${evaluation.learnerTurnId}:${evaluation.createdAt}`;
}

function cleanErrorMessage(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isAttemptLimitReachedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const errorRecord = error as {
    code?: unknown;
    message?: unknown;
  };

  return (
    errorRecord.code === "ATTEMPT_LIMIT_REACHED" ||
    cleanErrorMessage(errorRecord.message).includes(
      "has reached its maximum",
    )
  );
}

function isStageNotCompleteError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const errorRecord = error as {
    code?: unknown;
    message?: unknown;
  };

  return (
    errorRecord.code === "STAGE_NOT_COMPLETE" ||
    cleanErrorMessage(errorRecord.message).includes(
      "has not satisfied its completion rule",
    )
  );
}

function shouldGenerateSupport(decision: TeachingDecision): boolean {
  return ![
    "complete_lesson",
    "complete_stage",
    "pause",
  ].includes(decision.type);
}

function runtimeErrorToTeachingBrainError(
  error: unknown,
  input?: Partial<ProcessTeachingTurnInput>,
): TeachingBrainError {
  if (error instanceof TeachingBrainRuntimeError) {
    return {
      code:
        error.code === "SESSION_NOT_ACTIVE"
          ? "LESSON_NOT_ACTIVE"
          : error.code === "TURN_CONTEXT_MISMATCH"
            ? "ACTIVITY_NOT_FOUND"
            : error.code === "LESSON_SESSION_MISMATCH" ||
                error.code === "TURN_SESSION_MISMATCH" ||
                error.code === "SESSION_NOT_FOUND" ||
                error.code === "PERSISTED_RUNTIME_MISMATCH"
              ? "INVALID_SESSION"
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
        : "The Teaching Brain pipeline failed.",
    lessonId: input?.lesson?.id,
    sessionId: input?.session?.id,
    recoverable: true,
    details: {
      cause: error instanceof Error ? error.name : String(error),
    },
  };
}

function readRuntimeMetadataFlag(
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
): boolean {
  return metadata?.[key] === true;
}

function readRuntimeMetadataText(
  metadata: Readonly<Record<string, unknown>> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function readRecordText(
  value: unknown,
  ...keys: string[]
): string | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return undefined;
  }

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const field = record[key];

    if (typeof field === "string" && field.trim()) {
      return field.trim();
    }
  }

  return undefined;
}

function lessonDirectorControlsOpening(
  input: ProcessTeachingTurnInput,
): boolean {
  return (
    Boolean(input.classroom?.lessonDirector) &&
    readRuntimeMetadataText(input.metadata, "lessonEntryMode") === "new" &&
    !readRuntimeMetadataFlag(input.metadata, "lessonIntroductionCompleted")
  );
}

/**
 * The Lesson Director still decides the active pedagogical action. On the
 * first turn after an unfinished lesson is restored, this helper changes only
 * Elvy's opening speech and prevents the objectives board from being shown
 * again. The saved scene/activity state remains untouched.
 */
function applyResumeLessonOpening(
  decision: LessonDirectorDecision,
  input: ProcessTeachingTurnInput,
): LessonDirectorDecision {
  if (!readRuntimeMetadataFlag(input.metadata, "lessonResumed")) {
    return decision;
  }

  const learnerName = input.learnerName?.trim();
  const mainObjective =
    readRuntimeMetadataText(input.metadata, "resumeMainObjective") ??
    readRecordText(
      input.lesson.objectives[0],
      "text",
      "title",
      "label",
      "name",
    ) ??
    input.lesson.title?.trim() ??
    "this lesson";

  const welcome = learnerName
    ? `Welcome back, ${learnerName}.`
    : "Welcome back.";

  return {
    ...decision,
    elvy: {
      ...decision.elvy,
      speech: `${welcome} Let's continue working on ${mainObjective}.`,
      speechKey: "lesson.resume",
      expression: "smile",
      gesture: "encourage",
      speakAutomatically: true,
    },
    whiteboard: {
      mode: "custom",
      clearBeforeDisplay: false,
    },
    diagnostics: {
      warnings: decision.diagnostics?.warnings ?? [],
      notes: [
        ...(decision.diagnostics?.notes ?? []),
        "The unfinished lesson was restored.",
        "The lesson introduction and objective explanation were not repeated.",
        "The saved stage and activity remain active.",
      ],
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                            Runtime orchestrator                            */
/* -------------------------------------------------------------------------- */

export class TeachingBrainRuntime {
  readonly responseEvaluator: ResponseEvaluator;
  readonly decisionEngine: TeachingDecisionEngine;
  readonly supportEngine: TeachingSupportEngine;
  readonly objectiveTracker: TeachingObjectiveTracker;
  readonly lessonCompletion: TeachingLessonCompletionEngine;

  private readonly config: TeachingBrainRuntimeConfig &
    typeof DEFAULT_RUNTIME_CONFIG;

  constructor(config: TeachingBrainRuntimeConfig = {}) {
    this.config = {
      ...DEFAULT_RUNTIME_CONFIG,
      ...config,
    };

    this.responseEvaluator = new ResponseEvaluator({
      ...config.responseEvaluator,
      now: config.responseEvaluator?.now ?? config.now,
    });
    this.decisionEngine = new TeachingDecisionEngine({
      ...config.decisionEngine,
      now: config.decisionEngine?.now ?? config.now,
    });
    this.supportEngine = new TeachingSupportEngine({
      ...config.supportEngine,
      now: config.supportEngine?.now ?? config.now,
    });
    this.objectiveTracker = new TeachingObjectiveTracker({
      ...config.objectiveTracker,
      now: config.objectiveTracker?.now ?? config.now,
    });
    this.lessonCompletion = new TeachingLessonCompletionEngine({
      ...config.lessonCompletion,
      now: config.lessonCompletion?.now ?? config.now,
    });
  }

  createSession(input: CreateSessionInput): TeachingSessionState {
    assertValidTeachingBrainLesson(input.lesson);
    return createTeachingSession(input);
  }

  restoreSession(
    lesson: TeachingBrainLesson,
    session: TeachingSessionState,
  ): TeachingSessionEngine {
    assertValidTeachingBrainLesson(lesson);
    return TeachingSessionEngine.restore({ lesson, state: session });
  }

  async processTurn(
    input: ProcessTeachingTurnInput,
  ): Promise<ProcessTeachingTurnOutput> {
    const traceStarted = performanceNow();
    const traceStartedAt = currentIso(this.config.now);
    const traceStages: TeachingTurnTrace["stages"] = [];
    const actions: AppliedSessionAction[] = [];
    const warnings: TeachingBrainError[] = [];
    let attemptLimitRecovered = false;

    const runStage = async <T>(
      name: TeachingTurnTrace["stages"][number]["name"],
      operation: () => Promise<T> | T,
    ): Promise<T> => {
      const started = performanceNow();
      const startedAt = currentIso(this.config.now);
      try {
        const value = await operation();
        const completedAt = currentIso(this.config.now);
        traceStages.push({
          name,
          startedAt,
          completedAt,
          durationMs: Math.max(0, performanceNow() - started),
          ok: true,
        });
        return value;
      } catch (error) {
        const completedAt = currentIso(this.config.now);
        traceStages.push({
          name,
          startedAt,
          completedAt,
          durationMs: Math.max(0, performanceNow() - started),
          ok: false,
          note: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };

    const context = await runStage("validate", () => {
      this.validateTurnInput(input);
      assertValidTeachingBrainLesson(input.lesson);
      return resolveContext(input.lesson, input.learnerTurn);
    });

    const sessionEngine = TeachingSessionEngine.restore({
      lesson: input.lesson,
      state: input.session,
    });

    /*
     * During a brand-new lesson opening, the Lesson Director is the
     * authoritative classroom controller. The legacy evaluator/decision
     * pipeline may still calculate diagnostics, but it must not generate a
     * competing learner-facing response or mutate lesson progression.
     */
    const directorOwnsOpening = lessonDirectorControlsOpening(input);

    const evaluation = await runStage("evaluate_response", () =>
      this.responseEvaluator.evaluate({
        lesson: input.lesson,
        learnerTurn: input.learnerTurn,
        stage: context.stage,
        activity: context.activity,
        previousEvaluations: input.previousEvaluations,
        metadata: input.metadata,
      }),
    );

    const objectiveTracking = await runStage("track_objectives", () =>
      this.objectiveTracker.trackResponse({
        lesson: input.lesson,
        session: sessionEngine.getState(),
        evaluation: evaluation.evaluation,
        activity: context.activity,
        supportLevelUsed:
          input.session.activityStates[context.activity.id]
            ?.currentSupportLevel ?? 0,
        independent:
          (input.session.activityStates[context.activity.id]
            ?.currentSupportLevel ?? 0) === 0,
        metadata: input.metadata,
      }),
    );

    const decision = await runStage("make_decision", () =>
      this.decisionEngine.decide({
        lesson: input.lesson,
        session: sessionEngine.getState(),
        evaluation: evaluation.evaluation,
        stage: context.stage,
        activity: context.activity,
        previousEvaluations: input.previousEvaluations,
        timeRemainingMinutes: input.timeRemainingMinutes,
        learnerReady: input.learnerReady,
        humanSupportAvailable: input.humanSupportAvailable,
        metadata: input.metadata,
      }),
    );

    await runStage("record_attempt", () => {
      if (directorOwnsOpening) {
        actions.push({
          action: "record_attempt",
          applied: false,
          reason:
            "The Lesson Director controls the new-lesson introduction; the opening response is not recorded as a teaching attempt.",
        });
        return;
      }

      const state = sessionEngine.getState();
      if (
        state.status !== "active" ||
        state.activeActivityId !== context.activity.id
      ) {
        actions.push({
          action: "record_attempt",
          applied: false,
          reason: "The learner turn no longer matches the active activity.",
        });
        return;
      }

      try {
        sessionEngine.recordAttempt({
          outcome: mapEvaluationToAttemptOutcome(evaluation.evaluation),
          score: evaluation.evaluation.score,
          confidence: evaluation.evaluation.confidence,
          learnerTurnId: input.learnerTurn.id,
          evaluationId: evaluationId(evaluation.evaluation),
          teachingDecisionId: decision.decision.id,
          notes: evaluation.diagnostics,
          occurredAt: evaluation.evaluation.createdAt,
        });
        actions.push({ action: "record_attempt", applied: true });
      } catch (error) {
        if (!isAttemptLimitReachedError(error)) {
          throw error;
        }

        attemptLimitRecovered = true;

        actions.push({
          action: "record_attempt",
          applied: false,
          reason:
            "The activity had already reached its maximum number of attempts.",
          details: {
            activityId: context.activity.id,
            maximumAttempts: context.activity.maximumAttempts,
          },
        });

        warnings.push({
          code: "INTERNAL_ERROR",
          message:
            `Activity "${context.activity.id}" reached its attempt limit. ` +
            "Elvy advanced safely instead of ending the lesson.",
          lessonId: input.lesson.id,
          sessionId: input.session.id,
          recoverable: true,
          details: {
            cause: "ATTEMPT_LIMIT_REACHED",
            activityId: context.activity.id,
            maximumAttempts: context.activity.maximumAttempts,
          },
        });

        const currentState = sessionEngine.getState();
        if (
          currentState.status === "active" &&
          currentState.activeActivityId === context.activity.id
        ) {
          if (context.activity.allowSkip) {
            sessionEngine.skipActivity(
              "Maximum attempts reached. Continue with the next teaching activity.",
              evaluation.evaluation.createdAt,
            );

            actions.push({
              action: "skip_activity",
              applied: true,
              reason:
                "Maximum attempts reached; the lesson continued with the next activity.",
              details: {
                exhaustedActivityId: context.activity.id,
              },
            });
          } else {
            sessionEngine.completeActivity(
              "Maximum attempts reached on a required activity. Continue safely with the next teaching activity.",
              evaluation.evaluation.createdAt,
              true,
            );

            actions.push({
              action: "complete_activity",
              applied: true,
              reason:
                "Maximum attempts reached on a non-skippable activity; it was closed safely so the lesson could continue.",
              details: {
                exhaustedActivityId: context.activity.id,
              },
            });
          }
        }
      }
    });

    await runStage("apply_objectives", () => {
      if (directorOwnsOpening) {
        actions.push({
          action: "update_objective",
          applied: false,
          reason:
            "Objective evidence is not recorded during the Lesson Director introduction.",
        });
        return;
      }

      for (const command of objectiveTrackingToSessionCommands(
        objectiveTracking,
      )) {
        sessionEngine.updateObjective(command);
        actions.push({
          action: "update_objective",
          applied: true,
          details: { objectiveId: command.objectiveId },
        });
      }
    });

    let support: DetailedSupportDelivery | undefined;
    let directorCommand: TeachingBrainDirectorCommand | undefined;

    if (
      !directorOwnsOpening &&
      this.config.generateSupportForEveryDecision &&
      shouldGenerateSupport(decision.decision)
    ) {
      try {
        support = await runStage("generate_support", () =>
          this.supportEngine.generate({
            lesson: input.lesson,
            session: sessionEngine.getState(),
            decision: decision.decision,
            stage: context.stage,
            activity: context.activity,
            evaluation: evaluation.evaluation,
            learnerName: input.learnerName,
            learnerL1: input.learnerL1,
            consecutiveL1Turns: input.consecutiveL1Turns,
            requestedL1: input.requestedL1,
            preferredChannels: input.preferredSupportChannels,
            metadata: input.metadata,
          }),
        );

        const command = supportDeliveryToDirectorCommand(support.delivery);
        directorCommand = {
          ...command,
          decisionId: decision.decision.id,
          decisionType: decision.decision.type,
          decisionReason: decision.decision.reason,
        };

        await runStage("apply_support", () => {
          const usage = supportDeliveryToSessionUsage(support!.delivery);
          const state = sessionEngine.getState();
          if (!usage || state.status !== "active" || !state.activeActivityId) {
            actions.push({
              action: "use_support",
              applied: false,
              reason: usage
                ? "No active activity is available for support usage."
                : "The delivery does not require support usage tracking.",
            });
            return;
          }

          sessionEngine.useSupport({
            ...usage,
            occurredAt: support!.delivery.createdAt,
          });
          actions.push({ action: "use_support", applied: true });
        });
      } catch (error) {
        const warning = runtimeErrorToTeachingBrainError(error, input);
        warnings.push(warning);
        if (this.config.supportFailureIsFatal) throw error;
      }
    }

    let lessonDirectorDecision: LessonDirectorDecision | undefined;
    let sceneEngineOutput: SceneEngineOutput | undefined;
    let whiteboard: WhiteboardEngineResult | undefined;

    if (input.classroom?.lessonDirector) {
      lessonDirectorDecision = await runStage("lesson_director", () => {
        const decision = decideLesson({
          ...input.classroom!.lessonDirector!,
          now: currentIso(this.config.now),
        });

        return applyResumeLessonOpening(decision, input);
      });
    }

    if (input.classroom?.scene) {
      const sceneInput = input.classroom.scene;
      sceneEngineOutput = await runStage("scene_engine", () =>
        runSceneEngine({
          definition: sceneInput.definition,
          state: sceneInput.state,
          event: {
            ...sceneInput.event,
            now: currentIso(this.config.now),
          },
        } satisfies SceneEngineContext),
      );
    }

    if (sceneEngineOutput?.activeStep && input.classroom?.scene) {
      const whiteboardInput = input.classroom.whiteboard;
      whiteboard = await runStage("whiteboard", () => {
        const resolver = createTeachingPackageAdapter({
          packageRoot:
            whiteboardInput?.packageRoot ??
            (input.lesson as unknown as TeachingPackageRoot),
          packagePathPrefix: whiteboardInput?.packagePathPrefix,
          strictRequiredReferences:
            whiteboardInput?.strictRequiredReferences ?? false,
        });

        return buildWhiteboardPresentation({
          step: sceneEngineOutput!.activeStep!,
          contentReferences: input.classroom!.scene!.definition.contentReferences,
          resolver,
          now: currentIso(this.config.now),
          viewport: whiteboardInput?.viewport,
          speechHighlight: whiteboardInput?.speechHighlight,
          activePageIndex: whiteboardInput?.activePageIndex,
        });
      });
    }

    if (this.config.applyDecisionActions) {
      await runStage("apply_decision", () => {
        if (directorOwnsOpening) {
          actions.push({
            action: "record_only",
            applied: false,
            reason:
              "The legacy Decision Engine action was suppressed because the Lesson Director controls the new-lesson introduction.",
          });
          return;
        }

        if (attemptLimitRecovered) {
          actions.push({
            action: "record_only",
            applied: false,
            reason:
              "The original decision was not applied because attempt-limit recovery already advanced the lesson.",
            details: {
              exhaustedActivityId: context.activity.id,
            },
          });
          return;
        }

        this.applyDecisionAction(
          sessionEngine,
          decision.decision,
          context.activity.id,
          actions,
        );
      });
    }

    let completion: LessonCompletionEvaluation | undefined;
    if (
      !directorOwnsOpening &&
      (
        this.config.evaluateCompletionAfterEveryTurn ||
        input.finalCompletionCheck ||
        decision.decision.type === "complete_lesson"
      )
    ) {
      completion = await runStage("evaluate_completion", () =>
        this.lessonCompletion.evaluate({
          lesson: input.lesson,
          session: sessionEngine.getState(),
          finalCheck:
            input.finalCompletionCheck ||
            decision.decision.type === "complete_lesson",
          recommendedNextLessonId: input.recommendedNextLessonId,
          metadata: input.metadata,
        }),
      );

      const completionCommand = lessonCompletionToSessionCommand(completion);
      const state = sessionEngine.getState();
      if (
        completionCommand.type === "complete_session" &&
        state.status === "active"
      ) {
        sessionEngine.complete(
          completionCommand.reason,
          completionCommand.occurredAt,
        );
        actions.push({
          action: "complete_lesson",
          applied: true,
          reason: completionCommand.reason,
        });
      }
    }

    const snapshot = sessionEngine.snapshot();
    const traceCompletedAt = currentIso(this.config.now);

    return {
      lessonId: input.lesson.id,
      sessionId: snapshot.session.id,
      learnerTurnId: input.learnerTurn.id,
      evaluation,
      objectiveTracking,
      decision,
      support,
      directorCommand,
      lessonDirectorDecision,
      sceneEngineOutput,
      whiteboard,
      completion,
      session: snapshot.session,
      snapshot,
      appliedActions: actions,
      warnings,
      trace: {
        startedAt: traceStartedAt,
        completedAt: traceCompletedAt,
        durationMs: Math.max(0, performanceNow() - traceStarted),
        stages: traceStages,
      },
    };
  }

  async processPersistedTurn(
    input: ProcessPersistedTeachingTurnInput,
  ): Promise<ProcessPersistedTeachingTurnOutput> {
    const {
      repository,
      sessionId,
      curriculumId,
      organizationId,
      ...turnInput
    } = input;

    if (!sessionId.trim()) {
      throw new TeachingBrainRuntimeError(
        "INVALID_INPUT",
        "A persisted teaching session ID is required.",
      );
    }

    let persisted: TeachingSessionRecord | null;

    try {
      persisted = await repository.loadSession(sessionId);
    } catch (error) {
      throw new TeachingBrainRuntimeError(
        "PERSISTENCE_FAILED",
        `Failed to load teaching session "${sessionId}".`,
        {
          recoverable: true,
          details: { operation: "load", sessionId },
          cause: error,
        },
      );
    }

    if (!persisted) {
      throw new TeachingBrainRuntimeError(
        "SESSION_NOT_FOUND",
        `Teaching session "${sessionId}" was not found.`,
        {
          recoverable: true,
          details: { sessionId },
        },
      );
    }

    const session = persisted.session;

    if (session.id !== persisted.sessionId) {
      throw new TeachingBrainRuntimeError(
        "PERSISTED_RUNTIME_MISMATCH",
        `Restored session "${session.id}" does not match persisted session "${persisted.sessionId}".`,
        {
          recoverable: false,
          details: {
            restoredSessionId: session.id,
            persistedSessionId: persisted.sessionId,
          },
        },
      );
    }

    if (session.lessonId !== turnInput.lesson.id) {
      throw new TeachingBrainRuntimeError(
        "LESSON_SESSION_MISMATCH",
        `Persisted session lesson "${session.lessonId}" does not match lesson "${turnInput.lesson.id}".`,
      );
    }

    const turnResult = await this.processTurn({
      ...turnInput,
      session,
    });

    const nextSession = turnResult.session;

    if (
      nextSession.id !== persisted.sessionId ||
      nextSession.lessonId !== turnResult.lessonId ||
      nextSession.revision <= persisted.revision
    ) {
      throw new TeachingBrainRuntimeError(
        "PERSISTED_RUNTIME_MISMATCH",
        "The updated Teaching Session contains inconsistent identifiers or revision.",
        {
          recoverable: false,
          details: {
            expectedSessionId: persisted.sessionId,
            actualSessionId: nextSession.id,
            expectedLessonId: turnResult.lessonId,
            actualLessonId: nextSession.lessonId,
            previousRevision: persisted.revision,
            actualRevision: nextSession.revision,
          },
        },
      );
    }

    let saved: TeachingSessionRecord;

    try {
      saved = await repository.saveSession({
        expectedRevision: persisted.revision,
        session: nextSession,
        curriculumId,
        organizationId,
      });
    } catch (error) {
      throw new TeachingBrainRuntimeError(
        "PERSISTENCE_FAILED",
        `Failed to save teaching session "${sessionId}".`,
        {
          recoverable: true,
          details: {
            operation: "save",
            sessionId,
            expectedRevision: persisted.revision,
          },
          cause: error,
        },
      );
    }

    return {
      ...turnResult,
      persistedSession: saved,
    };
  }

  async safeProcessPersistedTurn(
    input: ProcessPersistedTeachingTurnInput,
  ): Promise<SafePersistedTeachingTurnResult> {
    try {
      return {
        ok: true,
        data: await this.processPersistedTurn(input),
      };
    } catch (error) {
      return {
        ok: false,
        error: runtimeErrorToTeachingBrainError(error, input),
      };
    }
  }

  async safeProcessTurn(
    input: ProcessTeachingTurnInput,
  ): Promise<SafeTeachingTurnResult> {
    try {
      return { ok: true, data: await this.processTurn(input) };
    } catch (error) {
      return {
        ok: false,
        error: runtimeErrorToTeachingBrainError(error, input),
      };
    }
  }

  private validateTurnInput(input: ProcessTeachingTurnInput): void {
    if (!input.lesson?.id || !input.session?.id || !input.learnerTurn?.id) {
      throw new TeachingBrainRuntimeError(
        "INVALID_INPUT",
        "A valid lesson, session, and learner turn are required.",
      );
    }

    if (input.session.lessonId !== input.lesson.id) {
      throw new TeachingBrainRuntimeError(
        "LESSON_SESSION_MISMATCH",
        `Session lesson "${input.session.lessonId}" does not match lesson "${input.lesson.id}".`,
      );
    }

    if (input.learnerTurn.sessionId !== input.session.id) {
      throw new TeachingBrainRuntimeError(
        "TURN_SESSION_MISMATCH",
        `Learner turn session "${input.learnerTurn.sessionId}" does not match session "${input.session.id}".`,
      );
    }

    if (input.session.status !== "active") {
      throw new TeachingBrainRuntimeError(
        "SESSION_NOT_ACTIVE",
        `Session "${input.session.id}" is ${input.session.status}; an active session is required.`,
      );
    }

    if (
      input.session.activeStageId !== input.learnerTurn.stageId ||
      input.session.activeActivityId !== input.learnerTurn.activityId
    ) {
      throw new TeachingBrainRuntimeError(
        "TURN_CONTEXT_MISMATCH",
        "The learner turn does not match the active session stage and activity.",
        {
          details: {
            activeStageId: input.session.activeStageId,
            turnStageId: input.learnerTurn.stageId,
            activeActivityId: input.session.activeActivityId,
            turnActivityId: input.learnerTurn.activityId,
          },
        },
      );
    }
  }

  private applyDecisionAction(
    engine: TeachingSessionEngine,
    decision: TeachingDecision,
    originalActivityId: string,
    actions: AppliedSessionAction[],
  ): void {
    const action = decisionToSessionAction(decision);
    const state = engine.getState();

    if (action.action === "record_only") {
      actions.push({ action: "record_only", applied: true });
      return;
    }

    if (action.action === "complete_lesson") {
      actions.push({
        action: "complete_lesson",
        applied: false,
        reason: "Deferred to the Lesson Completion Engine quality gate.",
      });
      return;
    }

    if (state.status !== "active") {
      actions.push({
        action: action.action,
        applied: false,
        reason: `Session is ${state.status}.`,
      });
      return;
    }

    switch (action.action) {
      case "use_support": {
        if (!state.activeActivityId) {
          actions.push({
            action: "use_support",
            applied: false,
            reason: "There is no active activity.",
          });
          return;
        }
        engine.useSupport({
          level: action.level,
          type: action.type,
          content: action.content,
          occurredAt: decision.createdAt,
        });
        actions.push({ action: "use_support", applied: true });
        return;
      }

      case "complete_activity": {
        if (state.activeActivityId !== originalActivityId) {
          actions.push({
            action: "complete_activity",
            applied: false,
            reason: "The activity was already completed or navigation advanced.",
          });
          return;
        }
        engine.completeActivity(action.reason, decision.createdAt);
        actions.push({
          action: "complete_activity",
          applied: true,
          reason: action.reason,
        });
        return;
      }

      case "complete_stage": {
        try {
          engine.completeStage(action.reason, decision.createdAt);
          actions.push({
            action: "complete_stage",
            applied: true,
            reason: action.reason,
          });
        } catch (error) {
          if (!isStageNotCompleteError(error)) {
            throw error;
          }

          actions.push({
            action: "complete_stage",
            applied: false,
            reason:
              "The stage completion decision was not applied because the stage completion rule is not satisfied yet.",
            details: {
              stageId: state.activeStageId,
              originalActivityId,
              decisionId: decision.id,
            },
          });
        }
        return;
      }

      case "skip_activity": {
        engine.skipActivity(action.reason, decision.createdAt);
        actions.push({
          action: "skip_activity",
          applied: true,
          reason: action.reason,
        });
        return;
      }

      case "change_activity": {
        engine.changeToAlternativeActivity(action.reason, decision.createdAt);
        actions.push({
          action: "change_activity",
          applied: true,
          reason: action.reason,
        });
        return;
      }

      case "pause": {
        engine.pause(action.reason, decision.createdAt);
        actions.push({
          action: "pause",
          applied: true,
          reason: action.reason,
        });
        return;
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                              Functional API                                */
/* -------------------------------------------------------------------------- */

export function createTeachingBrainRuntime(
  config: TeachingBrainRuntimeConfig = {},
): TeachingBrainRuntime {
  return new TeachingBrainRuntime(config);
}

export async function processTeachingTurn(
  input: ProcessTeachingTurnInput,
  config: TeachingBrainRuntimeConfig = {},
): Promise<ProcessTeachingTurnOutput> {
  return new TeachingBrainRuntime(config).processTurn(input);
}

export async function safeProcessTeachingTurn(
  input: ProcessTeachingTurnInput,
  config: TeachingBrainRuntimeConfig = {},
): Promise<SafeTeachingTurnResult> {
  return new TeachingBrainRuntime(config).safeProcessTurn(input);
}

export async function processPersistedTeachingTurn(
  input: ProcessPersistedTeachingTurnInput,
  config: TeachingBrainRuntimeConfig = {},
): Promise<ProcessPersistedTeachingTurnOutput> {
  return new TeachingBrainRuntime(config).processPersistedTurn(input);
}

export async function safeProcessPersistedTeachingTurn(
  input: ProcessPersistedTeachingTurnInput,
  config: TeachingBrainRuntimeConfig = {},
): Promise<SafePersistedTeachingTurnResult> {
  return new TeachingBrainRuntime(config).safeProcessPersistedTurn(input);
}

export const TeachingBrain = {
  create: createTeachingBrainRuntime,
  processTurn: processTeachingTurn,
  safeProcessTurn: safeProcessTeachingTurn,
  processPersistedTurn: processPersistedTeachingTurn,
  safeProcessPersistedTurn: safeProcessPersistedTeachingTurn,
  validateLesson: validateTeachingBrainLesson,
  assertLesson: assertValidTeachingBrainLesson,
  createSession: createTeachingSession,
  restoreSession: restoreTeachingSession,
};

/* -------------------------------------------------------------------------- */
/*                        Stable module-level exports                         */
/* -------------------------------------------------------------------------- */

export * from "./types";

export {
  validateTeachingBrainLesson,
  safeParseTeachingBrainLesson,
  parseTeachingBrainLesson,
  assertValidTeachingBrainLesson,
  validateLessonForTeachingBrain,
  formatLessonValidationIssues,
  getStageById,
  getActivityById,
  TeachingBrainLessonValidationError,
} from "./lesson-schema";

export {
  validateLessonPlan,
  buildTeachingBrainLesson,
  safeAdaptLessonPlan,
  adaptLessonPlan,
  adaptLessonPlanResult,
  BlueprintAdapter,
  BlueprintAdapterError,
} from "./blueprint-adapter";

export {
  TeachingSessionEngine,
  SessionEngine,
  SessionEngineError,
  createTeachingSession,
  restoreTeachingSession,
} from "./session-engine";

export {
  ResponseEvaluator,
  ResponseEvaluatorService,
  ResponseEvaluatorError,
  createResponseEvaluator,
  evaluateLearnerResponse,
  safeEvaluateLearnerResponse,
  mapEvaluationToAttemptOutcome,
} from "./response-evaluator";

export {
  TeachingDecisionEngine,
  TeachingDecisionService,
  DecisionEngineError,
  createTeachingDecisionEngine,
  makeTeachingDecision,
  safeMakeTeachingDecision,
  decisionToSessionAction,
} from "./decision-engine";

export {
  TeachingSupportEngine,
  TeachingSupportService,
  SupportEngineError,
  createTeachingSupportEngine,
  generateTeachingSupport,
  safeGenerateTeachingSupport,
  supportDeliveryToSessionUsage,
  supportDeliveryToDirectorCommand,
} from "./support-engine";

export {
  TeachingObjectiveTracker,
  TeachingObjectiveService,
  ObjectiveTrackerError,
  createTeachingObjectiveTracker,
  trackResponseObjectives,
  recordObjectiveEvidence,
  summarizeObjectives,
  safeTrackResponseObjectives,
  safeRecordObjectiveEvidence,
  safeSummarizeObjectives,
  objectiveTrackingToSessionCommands,
} from "./objective-tracker";

export {
  TeachingLessonCompletionEngine,
  LessonCompletionService,
  LessonCompletionEngineError,
  createLessonCompletionEngine,
  evaluateLessonCompletion,
  safeEvaluateLessonCompletion,
  lessonCompletionToSessionCommand,
  findNextReviewActivity,
} from "./lesson-completion";
