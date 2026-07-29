/**
 * Elvy Teaching Runtime
 * Response Engine
 *
 * File: services/teaching-runtime/response-engine.ts
 *
 * Responsibility:
 * Convert a live learner reply into a validated LearnerTurn, evaluate it with
 * the Teaching Brain ResponseEvaluator, and return a runtime-ready result.
 *
 * This file deliberately does not:
 * - choose the next teaching action
 * - mutate session state
 * - update learner memory
 * - generate correction/support wording
 * - call Supabase directly
 */

import {
  ResponseEvaluator,
  ResponseEvaluatorError,
  type DetailedResponseEvaluation,
  type ResponseEvaluationProvider,
  type ResponseEvaluatorConfig,
} from "../teaching-brain/response-evaluator";

import type {
  InputModality,
  LearnerTurn,
  ResponseEvaluation,
  TeachingActivity,
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
  TeachingStage,
  UUID,
} from "../teaching-brain/types";

/* -------------------------------------------------------------------------- */
/*                                  Contracts                                 */
/* -------------------------------------------------------------------------- */

export type RuntimeResponseInput = Readonly<{
  sessionId: UUID;
  lesson: TeachingBrainLesson;

  stageId: string;
  activityId: string;

  /**
   * The learner-facing answer. For choice activities, selectedOptionId may be
   * supplied instead.
   */
  response?: string;
  selectedOptionId?: string;

  modality?: Exclude<InputModality, "tap" | "drag">;

  detectedLanguage?: LearnerTurn["detectedLanguage"];
  audioReference?: string;
  speechConfidence?: number;
  responseTimeMs?: number;

  expectedResponseId?: string;
  previousEvaluations?: ResponseEvaluation[];

  turnId?: UUID;
  createdAt?: string;

  metadata?: Record<string, unknown>;
}>;

export type RuntimeResponseResult = Readonly<{
  learnerTurn: LearnerTurn;
  stage: TeachingStage;
  activity: TeachingActivity;

  evaluation: ResponseEvaluation;
  details: DetailedResponseEvaluation;

  summary: Readonly<{
    status: ResponseEvaluation["status"];
    score: number;
    confidence: number;
    shouldCorrect: boolean;
    correctionFocuses: readonly string[];
    successful: boolean;
  }>;
}>;

export type ProcessResponseResult =
  TeachingBrainResult<RuntimeResponseResult>;

export type ResponseEngineOptions = Readonly<{
  evaluatorConfig?: ResponseEvaluatorConfig;
  provider?: ResponseEvaluationProvider;

  /**
   * Injectable clock and ID factory keep tests deterministic.
   */
  now?: () => string;
  createId?: () => UUID;
}>;

/* -------------------------------------------------------------------------- */
/*                                  Utilities                                 */
/* -------------------------------------------------------------------------- */

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function createRuntimeId(): UUID {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `turn-${Date.now()}-${Math.random()
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

function resolveStage(
  lesson: TeachingBrainLesson,
  stageId: string,
): TeachingStage | undefined {
  return lesson.stages.find((stage) => stage.id === stageId);
}

function resolveActivity(
  stage: TeachingStage,
  activityId: string,
): TeachingActivity | undefined {
  return stage.activities.find(
    (activity) => activity.id === activityId,
  );
}

function failure<T>(
  error: TeachingBrainError,
): TeachingBrainResult<T> {
  return {
    ok: false,
    error,
  };
}

function invalidInput(
  input: Partial<RuntimeResponseInput>,
  message: string,
  details?: Record<string, unknown>,
): TeachingBrainError {
  return {
    code: "UNSUPPORTED_INPUT",
    message,
    sessionId: input.sessionId,
    lessonId: input.lesson?.id,
    stageId: input.stageId,
    activityId: input.activityId,
    recoverable: true,
    details,
  };
}

function evaluatorFailure(
  error: unknown,
  input: RuntimeResponseInput,
): TeachingBrainError {
  if (error instanceof ResponseEvaluatorError) {
    return {
      code:
        error.code === "STAGE_NOT_FOUND"
          ? "STAGE_NOT_FOUND"
          : error.code === "ACTIVITY_NOT_FOUND"
            ? "ACTIVITY_NOT_FOUND"
            : error.code === "UNSUPPORTED_MODALITY"
              ? "UNSUPPORTED_INPUT"
              : "EVALUATION_FAILED",
      message: error.message,
      sessionId: input.sessionId,
      lessonId: input.lesson.id,
      stageId: input.stageId,
      activityId: input.activityId,
      recoverable: error.recoverable,
      details: error.details,
    };
  }

  return {
    code: "EVALUATION_FAILED",
    message:
      error instanceof Error
        ? error.message
        : "The learner response could not be evaluated.",
    sessionId: input.sessionId,
    lessonId: input.lesson.id,
    stageId: input.stageId,
    activityId: input.activityId,
    recoverable: true,
    details: {
      cause:
        error instanceof Error
          ? error.name
          : String(error),
    },
  };
}

function isSuccessfulEvaluation(
  evaluation: ResponseEvaluation,
): boolean {
  return (
    evaluation.status === "correct" ||
    evaluation.status === "mostly_correct"
  );
}

/* -------------------------------------------------------------------------- */
/*                              Response Engine                               */
/* -------------------------------------------------------------------------- */

export class ResponseEngine {
  private readonly evaluator: ResponseEvaluator;

  private readonly now: () => string;

  private readonly createId: () => UUID;

  constructor(options: ResponseEngineOptions = {}) {
    this.now =
      options.now ?? (() => new Date().toISOString());

    this.createId =
      options.createId ?? createRuntimeId;

    this.evaluator = new ResponseEvaluator({
      ...options.evaluatorConfig,
      provider:
        options.provider ??
        options.evaluatorConfig?.provider,
      now:
        options.evaluatorConfig?.now ??
        this.now,
    });
  }

  async process(
    input: RuntimeResponseInput,
  ): Promise<ProcessResponseResult> {
    const inputError = this.validateInput(input);

    if (inputError) {
      return failure(inputError);
    }

    const stage = resolveStage(
      input.lesson,
      clean(input.stageId),
    );

    if (!stage) {
      return failure({
        code: "STAGE_NOT_FOUND",
        message:
          `Stage "${input.stageId}" was not found in lesson "${input.lesson.id}".`,
        sessionId: input.sessionId,
        lessonId: input.lesson.id,
        stageId: input.stageId,
        activityId: input.activityId,
        recoverable: false,
      });
    }

    const activity = resolveActivity(
      stage,
      clean(input.activityId),
    );

    if (!activity) {
      return failure({
        code: "ACTIVITY_NOT_FOUND",
        message:
          `Activity "${input.activityId}" was not found in stage "${stage.id}".`,
        sessionId: input.sessionId,
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
          "The learner response cannot be processed because the lesson is not active.",
        sessionId: input.sessionId,
        lessonId: input.lesson.id,
        stageId: stage.id,
        activityId: activity.id,
        recoverable: true,
        details: {
          lessonStatus: input.lesson.status,
        },
      });
    }

    const learnerTurn = this.createLearnerTurn(
      input,
      stage,
      activity,
    );

    try {
      const details = await this.evaluator.evaluate({
        lesson: input.lesson,
        learnerTurn,
        stage,
        activity,
        expectedResponseId:
          clean(input.expectedResponseId) || undefined,
        previousEvaluations:
          input.previousEvaluations,
        metadata: input.metadata,
      });

      return {
        ok: true,
        data: Object.freeze({
          learnerTurn,
          stage,
          activity,
          evaluation: details.evaluation,
          details,
          summary: Object.freeze({
            status: details.evaluation.status,
            score: details.evaluation.score,
            confidence: details.evaluation.confidence,
            shouldCorrect:
              details.evaluation.shouldCorrect,
            correctionFocuses: Object.freeze([
              ...(
                details.evaluation
                  .recommendedCorrectionFocus ?? []
              ),
            ]),
            successful: isSuccessfulEvaluation(
              details.evaluation,
            ),
          }),
        }),
      };
    } catch (error) {
      return failure(
        evaluatorFailure(error, input),
      );
    }
  }

  private validateInput(
    input: RuntimeResponseInput,
  ): TeachingBrainError | null {
    if (!input || typeof input !== "object") {
      return invalidInput(
        {},
        "A response-engine input object is required.",
      );
    }

    if (!clean(input.sessionId)) {
      return invalidInput(
        input,
        "sessionId is required.",
      );
    }

    if (!input.lesson || typeof input.lesson !== "object") {
      return invalidInput(
        input,
        "A Teaching Brain lesson is required.",
      );
    }

    if (!clean(input.stageId)) {
      return invalidInput(
        input,
        "stageId is required.",
      );
    }

    if (!clean(input.activityId)) {
      return invalidInput(
        input,
        "activityId is required.",
      );
    }

    const modality =
      input.modality ??
      (clean(input.selectedOptionId)
        ? "choice"
        : clean(input.response)
          ? "text"
          : "none");

    if (
      modality !== "text" &&
      modality !== "voice" &&
      modality !== "choice" &&
      modality !== "none"
    ) {
      return invalidInput(
        input,
        `Unsupported response modality: "${String(modality)}".`,
      );
    }

    if (
      modality === "choice" &&
      !clean(input.selectedOptionId)
    ) {
      return invalidInput(
        input,
        "selectedOptionId is required for choice responses.",
      );
    }

    if (
      modality !== "none" &&
      modality !== "choice" &&
      !clean(input.response)
    ) {
      return invalidInput(
        input,
        "response is required for text and voice responses.",
      );
    }

    if (
      input.speechConfidence !== undefined &&
      (
        !Number.isFinite(input.speechConfidence) ||
        input.speechConfidence < 0 ||
        input.speechConfidence > 1
      )
    ) {
      return invalidInput(
        input,
        "speechConfidence must be between 0 and 1.",
      );
    }

    if (
      input.responseTimeMs !== undefined &&
      (
        !Number.isFinite(input.responseTimeMs) ||
        input.responseTimeMs < 0
      )
    ) {
      return invalidInput(
        input,
        "responseTimeMs must be zero or greater.",
      );
    }

    return null;
  }

  private createLearnerTurn(
    input: RuntimeResponseInput,
    stage: TeachingStage,
    activity: TeachingActivity,
  ): LearnerTurn {
    const modality =
      input.modality ??
      (clean(input.selectedOptionId)
        ? "choice"
        : clean(input.response)
          ? "text"
          : "none");

    const rawText =
      clean(input.response) || undefined;

    return Object.freeze({
      id:
        clean(input.turnId) ||
        this.createId(),
      sessionId: clean(input.sessionId),
      stageId: stage.id,
      activityId: activity.id,
      modality,
      rawText,
      normalizedText: rawText,
      selectedOptionId:
        clean(input.selectedOptionId) || undefined,
      detectedLanguage:
        input.detectedLanguage,
      audioReference:
        clean(input.audioReference) || undefined,
      speechConfidence:
        input.speechConfidence,
      responseTimeMs:
        input.responseTimeMs,
      createdAt: validIsoOrNow(
        input.createdAt,
        this.now,
      ),
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                              Public helpers                                */
/* -------------------------------------------------------------------------- */

export function createResponseEngine(
  options?: ResponseEngineOptions,
): ResponseEngine {
  return new ResponseEngine(options);
}

export async function processLearnerResponse(
  input: RuntimeResponseInput,
  options?: ResponseEngineOptions,
): Promise<ProcessResponseResult> {
  return createResponseEngine(options).process(input);
}

export const TeachingResponseEngine =
  Object.freeze({
    create: createResponseEngine,
    process: processLearnerResponse,
  });
