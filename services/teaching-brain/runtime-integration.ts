import "server-only";

import {
  TeachingBrainRuntime,
  type ProcessTeachingTurnOutput,
  type TeachingBrainRuntimeConfig,
  type TeachingTurnClassroomRuntimeInput,
} from "./index";

import {
  TeachingSessionEngine,
  type TeachingSessionState,
} from "./session-engine";

import type {
  LanguageCode,
  LearnerTurn,
  ResponseEvaluation,
} from "./types";

import {
  resolveStudentTeachingLesson,
  type ResolvedStudentLesson,
  type StudentLessonAssignment,
} from "./student-lesson-resolver";

/* -------------------------------------------------------------------------- */
/*                                  Contracts                                 */
/* -------------------------------------------------------------------------- */

export type RuntimeTurnModality =
  | "text"
  | "voice"
  | "choice"
  | "none";

export type ProcessStudentTeachingTurnInput = Readonly<{
  assignment: StudentLessonAssignment;

  /**
   * State previously returned by this integration service.
   * Omit it to create a fresh Teaching Session.
   */
  session?: TeachingSessionState;

  /**
   * Optional classroom orchestration data forwarded unchanged to the
   * Teaching Brain runtime. When omitted, the existing teaching pipeline
   * continues without Lesson Director, Scene Engine, or whiteboard output.
   */
  classroom?: TeachingTurnClassroomRuntimeInput;

  message?: string;
  normalizedMessage?: string;
  modality?: RuntimeTurnModality;
  selectedOptionId?: string;

  detectedLanguage?: LanguageCode;
  audioReference?: string;
  speechConfidence?: number;
  responseTimeMs?: number;

  previousEvaluations?: ResponseEvaluation[];

  learnerName?: string;
  requestedL1?: boolean;
  consecutiveL1Turns?: number;
  timeRemainingMinutes?: number;
  learnerReady?: boolean;
  humanSupportAvailable?: boolean;

  finalCompletionCheck?: boolean;
  recommendedNextLessonId?: string;

  /**
   * Optional IDs from the caller. They are useful when the API route already
   * creates request/turn identifiers.
   */
  sessionId?: string;
  learnerTurnId?: string;
  occurredAt?: string;
  expiresAt?: string;

  metadata?: Record<string, unknown>;
}>;

export type ProcessStudentTeachingTurnOutput = Readonly<{
  lesson: ResolvedStudentLesson;
  learnerTurn: LearnerTurn;

  /**
   * Session immediately before TeachingBrainRuntime.processTurn().
   * It is always active.
   */
  inputSession: TeachingSessionState;

  /**
   * Full Teaching Brain result. The updated session is available at
   * teaching.session and must be persisted by the API integration layer.
   */
  teaching: ProcessTeachingTurnOutput;
}>;

export type RuntimeIntegrationErrorCode =
  | "INVALID_INPUT"
  | "SESSION_LEARNER_MISMATCH"
  | "SESSION_LESSON_MISMATCH"
  | "SESSION_TERMINAL"
  | "ACTIVE_CONTEXT_MISSING"
  | "TEACHING_RUNTIME_FAILED";

export class RuntimeIntegrationError extends Error {
  readonly code: RuntimeIntegrationErrorCode;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: RuntimeIntegrationErrorCode,
    message: string,
    options: {
      recoverable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "RuntimeIntegrationError";
    this.code = code;
    this.recoverable = options.recoverable ?? true;
    this.details = options.details;
  }
}

export type RuntimeIntegrationOptions = Readonly<{
  runtime?: TeachingBrainRuntime;
  runtimeConfig?: TeachingBrainRuntimeConfig;
  now?: () => string;
  createId?: (prefix: string) => string;
}>;

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function resolveAssignmentNativeLanguage(
  assignment: StudentLessonAssignment,
): LanguageCode | undefined {
  const assignmentRecord = assignment as unknown as Record<string, unknown>;

  const rawLanguage =
    assignmentRecord.nativeLanguage ??
    assignmentRecord.native_language ??
    assignmentRecord.firstLanguage;

  const normalized = clean(rawLanguage).toLowerCase();

  if (!normalized) return undefined;

  const aliases: Record<string, LanguageCode> = {
    ar: "ar",
    arabic: "ar",
    "العربية": "ar",
    fr: "fr",
    french: "fr",
    français: "fr",
    francais: "fr",
    es: "es",
    spanish: "es",
    español: "es",
    de: "de",
    german: "de",
    deutsch: "de",
    it: "it",
    italian: "it",
    italiano: "it",
    pt: "pt",
    portuguese: "pt",
    português: "pt",
    en: "en",
    english: "en",
  };

  return aliases[normalized] ?? (normalized as LanguageCode);
}

function nowIso(now?: () => string, supplied?: string): string {
  const raw = supplied || now?.() || new Date().toISOString();
  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    throw new RuntimeIntegrationError(
      "INVALID_INPUT",
      `Invalid turn date: ${raw}`,
      { recoverable: false },
    );
  }

  return parsed.toISOString();
}

function createRuntimeId(prefix: string): string {
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

  return `${prefix}-${id}`;
}

function normalizeMessage(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isTerminalSession(session: TeachingSessionState): boolean {
  return (
    session.status === "completed" ||
    session.status === "abandoned" ||
    session.status === "expired" ||
    session.status === "error"
  );
}

function validateSessionOwnership(
  session: TeachingSessionState,
  resolved: ResolvedStudentLesson,
  assignment: StudentLessonAssignment,
): void {
  if (session.learnerId !== assignment.studentId) {
    throw new RuntimeIntegrationError(
      "SESSION_LEARNER_MISMATCH",
      "The restored Teaching Session belongs to another learner.",
      {
        recoverable: false,
        details: {
          sessionLearnerId: session.learnerId,
          requestedLearnerId: assignment.studentId,
          sessionId: session.id,
        },
      },
    );
  }

  if (session.lessonId !== resolved.teachingBrainLesson.id) {
    throw new RuntimeIntegrationError(
      "SESSION_LESSON_MISMATCH",
      "The restored Teaching Session belongs to another lesson.",
      {
        recoverable: false,
        details: {
          sessionLessonId: session.lessonId,
          requestedLessonId: resolved.teachingBrainLesson.id,
          sessionId: session.id,
        },
      },
    );
  }

  if (isTerminalSession(session)) {
    throw new RuntimeIntegrationError(
      "SESSION_TERMINAL",
      `Teaching Session "${session.id}" is already ${session.status}.`,
      {
        recoverable: false,
        details: {
          sessionId: session.id,
          status: session.status,
        },
      },
    );
  }
}

function createOrRestoreActiveSession(input: {
  resolved: ResolvedStudentLesson;
  assignment: StudentLessonAssignment;
  existingSession?: TeachingSessionState;
  sessionId?: string;
  occurredAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}): TeachingSessionState {
  const {
    resolved,
    assignment,
    existingSession,
    sessionId,
    occurredAt,
    expiresAt,
    metadata,
  } = input;

  const lesson = resolved.teachingBrainLesson;

  if (!existingSession) {
    const engine = TeachingSessionEngine.create({
      lesson,
      learnerId: assignment.studentId,
      sessionId: clean(sessionId) || undefined,
      now: occurredAt,
      expiresAt,
      metadata: {
        ...(metadata ?? {}),
        studentCode: assignment.studentCode,
        nativeLanguage: resolveAssignmentNativeLanguage(assignment),
        packageId: resolved.packageId,
        syllabusId: resolved.syllabusId,
        levelId: resolved.levelId,
        sublevelId: resolved.sublevelId,
        unitId: resolved.unitId,
        lessonId: resolved.lessonId,
      },
    });

    return engine.start(occurredAt).session;
  }

  validateSessionOwnership(existingSession, resolved, assignment);

  if (existingSession.status === "active") {
    return existingSession;
  }

  const engine = TeachingSessionEngine.restore({
    lesson,
    state: existingSession,
    now: occurredAt,
  });

  return engine.start(occurredAt).session;
}

function buildLearnerTurn(input: {
  session: TeachingSessionState;
  message?: string;
  normalizedMessage?: string;
  modality?: RuntimeTurnModality;
  selectedOptionId?: string;
  detectedLanguage?: LanguageCode;
  audioReference?: string;
  speechConfidence?: number;
  responseTimeMs?: number;
  learnerTurnId?: string;
  occurredAt: string;
  createId: (prefix: string) => string;
}): LearnerTurn {
  const stageId = clean(input.session.activeStageId);
  const activityId = clean(input.session.activeActivityId);

  if (!stageId || !activityId) {
    throw new RuntimeIntegrationError(
      "ACTIVE_CONTEXT_MISSING",
      "The active Teaching Session does not contain an active stage and activity.",
      {
        recoverable: false,
        details: {
          sessionId: input.session.id,
          activeStageId: input.session.activeStageId,
          activeActivityId: input.session.activeActivityId,
        },
      },
    );
  }

  const rawText = clean(input.message);
  const normalizedText = clean(input.normalizedMessage)
    ? normalizeMessage(input.normalizedMessage as string)
    : rawText
      ? normalizeMessage(rawText)
      : undefined;

  const modality =
    input.modality ??
    (input.selectedOptionId
      ? "choice"
      : rawText
        ? "text"
        : "none");

  return {
    id:
      clean(input.learnerTurnId) ||
      input.createId("learner-turn"),
    sessionId: input.session.id,
    stageId,
    activityId,
    modality,
    rawText: rawText || undefined,
    normalizedText,
    selectedOptionId: clean(input.selectedOptionId) || undefined,
    detectedLanguage: input.detectedLanguage,
    audioReference: clean(input.audioReference) || undefined,
    speechConfidence:
      typeof input.speechConfidence === "number"
        ? input.speechConfidence
        : undefined,
    responseTimeMs:
      typeof input.responseTimeMs === "number"
        ? input.responseTimeMs
        : undefined,
    createdAt: input.occurredAt,
  };
}

/* -------------------------------------------------------------------------- */
/*                            Integration service                             */
/* -------------------------------------------------------------------------- */

export class TeachingRuntimeIntegration {
  private readonly runtime: TeachingBrainRuntime;
  private readonly now?: () => string;
  private readonly createId: (prefix: string) => string;

  constructor(options: RuntimeIntegrationOptions = {}) {
    this.runtime =
      options.runtime ??
      new TeachingBrainRuntime(options.runtimeConfig);

    this.now = options.now;
    this.createId = options.createId ?? createRuntimeId;
  }

  async processStudentTurn(
    input: ProcessStudentTeachingTurnInput,
  ): Promise<ProcessStudentTeachingTurnOutput> {
    const occurredAt = nowIso(this.now, input.occurredAt);

    if (!clean(input.assignment?.studentId)) {
      throw new RuntimeIntegrationError(
        "INVALID_INPUT",
        "A student assignment with studentId is required.",
        { recoverable: false },
      );
    }

    try {
      const resolved = await resolveStudentTeachingLesson(
        input.assignment,
      );

      const inputSession = createOrRestoreActiveSession({
        resolved,
        assignment: input.assignment,
        existingSession: input.session,
        sessionId: input.sessionId,
        occurredAt,
        expiresAt: input.expiresAt,
        metadata: input.metadata,
      });

      const learnerTurn = buildLearnerTurn({
        session: inputSession,
        message: input.message,
        normalizedMessage: input.normalizedMessage,
        modality: input.modality,
        selectedOptionId: input.selectedOptionId,
        detectedLanguage: input.detectedLanguage,
        audioReference: input.audioReference,
        speechConfidence: input.speechConfidence,
        responseTimeMs: input.responseTimeMs,
        learnerTurnId: input.learnerTurnId,
        occurredAt,
        createId: this.createId,
      });

      const teaching = await this.runtime.processTurn({
        lesson: resolved.teachingBrainLesson,
        session: inputSession,
        learnerTurn,
        classroom: input.classroom,
        previousEvaluations: input.previousEvaluations,
        learnerName:
          clean(input.learnerName) ||
          clean(input.assignment.studentName) ||
          undefined,
        learnerL1: resolveAssignmentNativeLanguage(input.assignment),
        requestedL1: input.requestedL1,
        consecutiveL1Turns: input.consecutiveL1Turns,
        timeRemainingMinutes: input.timeRemainingMinutes,
        learnerReady: input.learnerReady,
        humanSupportAvailable: input.humanSupportAvailable,
        finalCompletionCheck: input.finalCompletionCheck,
        recommendedNextLessonId: input.recommendedNextLessonId,
        metadata: {
          ...(input.metadata ?? {}),
          studentCode: input.assignment.studentCode,
          nativeLanguage: resolveAssignmentNativeLanguage(input.assignment),
          packageId: resolved.packageId,
          syllabusId: resolved.syllabusId,
          unitId: resolved.unitId,
          sourceLessonId: resolved.lessonId,
        },
      });

      return Object.freeze({
        lesson: resolved,
        learnerTurn,
        inputSession,
        teaching,
      });
    } catch (error) {
      if (error instanceof RuntimeIntegrationError) {
        throw error;
      }

      throw new RuntimeIntegrationError(
        "TEACHING_RUNTIME_FAILED",
        error instanceof Error
          ? error.message
          : "The Teaching Runtime integration failed.",
        {
          recoverable: true,
          cause: error,
          details: {
            studentId: input.assignment.studentId,
            level: input.assignment.level,
            sublevel: input.assignment.sublevel,
            unit: input.assignment.unit,
            lesson: input.assignment.lesson,
          },
        },
      );
    }
  }
}

export function createTeachingRuntimeIntegration(
  options: RuntimeIntegrationOptions = {},
): TeachingRuntimeIntegration {
  return new TeachingRuntimeIntegration(options);
}

export async function processStudentTeachingTurn(
  input: ProcessStudentTeachingTurnInput,
  options: RuntimeIntegrationOptions = {},
): Promise<ProcessStudentTeachingTurnOutput> {
  return createTeachingRuntimeIntegration(options).processStudentTurn(input);
}

export const RuntimeIntegration = Object.freeze({
  create: createTeachingRuntimeIntegration,
  processStudentTurn: processStudentTeachingTurn,
});
