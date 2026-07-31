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

import {
  defineScene,
  type SceneContentKind,
  type SceneDefinition,
} from "./scene-definition";
import { createSceneEngineState } from "./scene-engine";

import type {
  ConfidenceLevel,
  LessonDirectorContext,
  LessonStage,
  ObjectiveStatus,
  SupportLevel,
  WhiteboardMode,
} from "./lesson-director-types";

/* -------------------------------------------------------------------------- */
/*                                  Contracts                                 */
/* -------------------------------------------------------------------------- */

export type RuntimeTurnModality =
  | "text"
  | "voice"
  | "choice"
  | "none";

export type RuntimeLessonEntryMode =
  | "new"
  | "resume"
  | "continue";

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

  /**
   * Set to true only for the first turn after an unfinished lesson has been
   * restored following logout, disconnect, or classroom re-entry.
   * Do not set this on every normal turn that carries an existing session.
   */
  resumeLesson?: boolean;

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



function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readText(
  record: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readNumber(
  record: Record<string, unknown>,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function normalizeLessonStage(value: unknown): LessonStage {
  const normalized = clean(value)
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");

  const stages: readonly LessonStage[] = [
    "welcome",
    "warm-up",
    "objective",
    "presentation",
    "vocabulary",
    "grammar",
    "reading",
    "listening",
    "dialogue",
    "guided-practice",
    "independent-practice",
    "production",
    "review",
    "assessment",
    "complete",
  ];

  return stages.includes(normalized as LessonStage)
    ? (normalized as LessonStage)
    : "presentation";
}

function normalizeObjectiveStatus(value: unknown): ObjectiveStatus {
  const normalized = clean(value)
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");

  if (
    normalized === "achieved" ||
    normalized === "mastered" ||
    normalized === "completed"
  ) {
    return "achieved";
  }

  if (
    normalized === "needs-review" ||
    normalized === "review" ||
    normalized === "struggling"
  ) {
    return "needs-review";
  }

  if (
    normalized === "in-progress" ||
    normalized === "active" ||
    normalized === "started"
  ) {
    return "in-progress";
  }

  return "not-started";
}

function normalizeSupportLevel(value: unknown): SupportLevel {
  const normalized = clean(value).toLowerCase();
  if (
    normalized === "light" ||
    normalized === "guided" ||
    normalized === "full"
  ) {
    return normalized;
  }
  return "none";
}

function normalizeConfidence(value: unknown): ConfidenceLevel {
  const normalized = clean(value).toLowerCase();
  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high"
  ) {
    return normalized;
  }
  return "unknown";
}

function buildLessonDirectorInput(input: {
  resolved: ResolvedStudentLesson;
  session: TeachingSessionState;
  occurredAt: string;
  entryMode: RuntimeLessonEntryMode;
  learnerName?: string;
  nativeLanguage?: LanguageCode;
}): Omit<LessonDirectorContext, "now"> {
  const {
    resolved,
    session,
    occurredAt,
    entryMode,
    learnerName,
    nativeLanguage,
  } = input;

  const sessionRecord = asRecord(session);
  const sessionMetadata = asRecord(sessionRecord.metadata);
  const objectiveStates = asRecord(
    sessionRecord.objectiveStates ?? sessionRecord.objectiveProgress,
  );
  const activityStates = asRecord(sessionRecord.activityStates);

  const activeStageId =
    clean(session.activeStageId) ||
    readText(sessionRecord, "currentStageId", "stageId") ||
    `${resolved.lessonId}:welcome`;

  const activeActivityId =
    clean(session.activeActivityId) ||
    readText(sessionRecord, "currentActivityId", "activityId") ||
    `${resolved.lessonId}:opening`;

  const activeStage = resolved.teachingBrainLesson.stages.find(
    (stage) => stage.id === session.activeStageId,
  );
  const activeStageRecord = asRecord(activeStage);

  const stage =
    entryMode === "new"
      ? "welcome"
      : normalizeLessonStage(
          activeStageRecord.type ??
            activeStageRecord.stage ??
            activeStageRecord.category ??
            activeStageRecord.title ??
            activeStageId,
        );

  const activeActivityState = asRecord(activityStates[activeActivityId]);

  const objectiveProgress =
    resolved.teachingBrainLesson.objectives.map((objective) => {
      const objectiveRecord = asRecord(objective);
      const objectiveId =
        readText(objectiveRecord, "id", "objectiveId") ??
        `${resolved.lessonId}:objective`;

      const stored = asRecord(objectiveStates[objectiveId]);
      const score =
        readNumber(stored, "score", "masteryScore", "progress") ?? 0;
      const evidenceCount =
        readNumber(stored, "evidenceCount", "evidence_count") ?? 0;
      const requiredEvidenceCount =
        readNumber(
          stored,
          "requiredEvidenceCount",
          "required_evidence_count",
        ) ?? 1;

      return {
        objectiveId,
        description:
          readText(objectiveRecord, "description", "title", "text") ??
          resolved.lessonTitle,
        status: normalizeObjectiveStatus(
          stored.status ?? stored.state ?? stored.masteryStatus,
        ),
        score,
        evidenceCount,
        requiredEvidenceCount,
        lastEvidenceAt: readText(
          stored,
          "lastEvidenceAt",
          "last_evidence_at",
        ),
      };
    });

  const attemptsInCurrentTask =
    readNumber(
      activeActivityState,
      "attempts",
      "attemptCount",
      "attempt_count",
    ) ?? 0;

  const startedAt =
    readText(sessionRecord, "startedAt", "createdAt") ?? occurredAt;
  const updatedAt =
    readText(sessionRecord, "updatedAt", "lastActivityAt") ?? occurredAt;

  return {
    lessonState: {
      lesson: {
        lessonId: resolved.teachingBrainLesson.id,
        packageId: resolved.packageId,
        courseId: resolved.syllabusId,
        level: resolved.levelId,
        sublevel: resolved.sublevelId,
        unitId: resolved.unitId,
        lessonTitle: resolved.lessonTitle,
        version: resolved.packageVersion,
      },
      sessionId: session.id,
      startedAt,
      updatedAt,
      currentStage: stage,
      currentSceneId:
        entryMode === "new" ? `${resolved.lessonId}:opening` : activeStageId,
      currentSceneStatus:
        entryMode === "new" ? "not-started" : "active",
      sceneHistory: [],
      objectiveProgress,
      studentState: {
        studentId: session.learnerId,
        displayName: clean(learnerName) || undefined,
        attemptsInCurrentTask,
        totalAttemptsInScene: attemptsInCurrentTask,
        supportLevel: normalizeSupportLevel(
          activeActivityState.currentSupportLevel ??
            activeActivityState.supportLevel,
        ),
        confidence: normalizeConfidence(
          sessionMetadata.confidence ??
            activeActivityState.confidence,
        ),
        recentErrors: [],
        strengths: [],
        needsSupportWith: [],
        preferredLanguage:
          clean(nativeLanguage) ||
          readText(sessionMetadata, "nativeLanguage", "preferredLanguage"),
      },
      waitingFor:
        entryMode === "new" ? "none" : "student-answer",
      elapsedSeconds:
        readNumber(sessionRecord, "elapsedSeconds", "elapsed_seconds") ?? 0,
      paused: false,
      completed: false,
      nextAllowedActions:
        entryMode === "new"
          ? ["start-lesson"]
          : entryMode === "resume"
            ? ["resume", "continue-scene", "ask-student"]
            : ["continue-scene", "ask-student"],
    },
    lessonPackage: resolved.lessonPlan,
    teachingPolicy: {
      maxAttemptsBeforeHint: 2,
      maxAttemptsBeforeModel: 3,
      maxAttemptsBeforeReview: 4,
      minimumObjectiveScore: 0.7,
      requiredEvidencePerObjective: 1,
      allowSceneSkipping: true,
      allowObjectiveSkipping: false,
      requireStudentResponseBeforeAdvance: true,
      languageSupportPolicy: {
        allowL1Support: Boolean(nativeLanguage && nativeLanguage !== "en"),
        supportLanguage: nativeLanguage,
        triggerAfterAttempts: 2,
      },
    },
  };
}

type DynamicWhiteboardSource = Readonly<{
  stage: LessonStage;
  mode: WhiteboardMode;
  kind: SceneContentKind;
  packagePath: string;
  title: string;
  description: string;
  category: "instruction" | "practice" | "assessment";
  allowScroll: boolean;
}>;

function hasContent(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function resolveDynamicWhiteboardSource(
  resolved: ResolvedStudentLesson,
  session: TeachingSessionState,
  entryMode: RuntimeLessonEntryMode,
): DynamicWhiteboardSource {
  const lessonPlan = asRecord(resolved.lessonPlan);
  const lessonStages = readArray(lessonPlan.stages);
  const blueprintStages = readArray(lessonPlan.elvyBlueprint);

  const stageIndex = Math.max(
    0,
    resolved.teachingBrainLesson.stages.findIndex(
      (stage) => stage.id === session.activeStageId,
    ),
  );

  const activeStage =
    resolved.teachingBrainLesson.stages[stageIndex] ??
    resolved.teachingBrainLesson.stages[0];

  const activeStageRecord = asRecord(activeStage);
  const normalizedStage =
    entryMode === "new"
      ? "objective"
      : normalizeLessonStage(
          activeStageRecord.type ??
            activeStageRecord.stage ??
            activeStageRecord.category ??
            activeStageRecord.title ??
            session.activeStageId,
        );

  const activities = readArray(activeStageRecord.activities);
  const activityIndex = Math.max(
    0,
    activities.findIndex(
      (activity) =>
        readText(asRecord(activity), "id") === session.activeActivityId,
    ),
  );

  const blueprintStage = asRecord(blueprintStages[stageIndex]);
  const lessonStage = asRecord(lessonStages[stageIndex]);

  const blueprintWhiteboardPath = hasContent(blueprintStage.whiteboardPlan)
    ? `lessonPlan.elvyBlueprint.${stageIndex}.whiteboardPlan`
    : undefined;

  const activeActivityPath = activities.length > 0
    ? `teachingBrainLesson.stages.${stageIndex}.activities.${activityIndex}`
    : undefined;

  const stageStudentPath = hasContent(lessonStage.studentActivities)
    ? `lessonPlan.stages.${stageIndex}.studentActivities`
    : undefined;

  const stageTeacherPath = hasContent(lessonStage.teacherActivities)
    ? `lessonPlan.stages.${stageIndex}.teacherActivities`
    : undefined;

  const firstAvailable = (...paths: Array<string | undefined>): string =>
    paths.find((path): path is string => Boolean(path)) ??
    "lessonPlan.lessonObjectives";

  if (entryMode === "new") {
    return { stage: "objective", mode: "objective", kind: "lesson-objectives", packagePath: "lessonPlan.lessonObjectives", title: resolved.lessonTitle, description: "Display the lesson objectives before teaching begins.", category: "instruction", allowScroll: false };
  }

  switch (normalizedStage) {
    case "welcome":
    case "warm-up":
      return { stage: normalizedStage, mode: "question", kind: "warm-up-prompt", packagePath: firstAvailable(blueprintWhiteboardPath, activeActivityPath, stageStudentPath, "lessonPlan.prerequisites"), title: readText(activeStageRecord, "title", "name") ?? "Warm-up", description: "Display the active warm-up prompt.", category: "instruction", allowScroll: false };
    case "vocabulary":
      return { stage: normalizedStage, mode: "vocabulary", kind: "vocabulary-set", packagePath: hasContent(lessonPlan.vocabulary) ? "lessonPlan.vocabulary" : firstAvailable(blueprintWhiteboardPath, activeActivityPath, stageTeacherPath), title: "Vocabulary", description: "Display the vocabulary for the active lesson stage.", category: "instruction", allowScroll: true };
    case "grammar":
      return { stage: normalizedStage, mode: "grammar", kind: "grammar-point", packagePath: hasContent(lessonPlan.grammar) ? "lessonPlan.grammar" : firstAvailable(blueprintWhiteboardPath, activeActivityPath, stageTeacherPath), title: "Grammar", description: "Display the active grammar point and examples.", category: "instruction", allowScroll: true };
    case "reading":
      return { stage: normalizedStage, mode: "reading", kind: "reading-text", packagePath: firstAvailable(blueprintWhiteboardPath, activeActivityPath, stageStudentPath), title: readText(activeStageRecord, "title", "name") ?? "Reading", description: "Display the reading content for the active stage.", category: "instruction", allowScroll: true };
    case "listening":
      return { stage: normalizedStage, mode: "listening", kind: "listening-script", packagePath: firstAvailable(blueprintWhiteboardPath, activeActivityPath, stageStudentPath), title: readText(activeStageRecord, "title", "name") ?? "Listening", description: "Display the listening support for the active stage.", category: "instruction", allowScroll: true };
    case "dialogue":
      return { stage: normalizedStage, mode: "dialogue", kind: "dialogue", packagePath: hasContent(lessonPlan.usefulExpressions) ? "lessonPlan.usefulExpressions" : firstAvailable(blueprintWhiteboardPath, activeActivityPath, stageStudentPath), title: "Dialogue", description: "Display the active classroom dialogue.", category: "practice", allowScroll: true };
    case "guided-practice":
    case "independent-practice":
    case "production":
      return { stage: normalizedStage, mode: "exercise", kind: normalizedStage === "production" ? "speaking-prompt" : "exercise", packagePath: firstAvailable(activeActivityPath, blueprintWhiteboardPath, stageStudentPath), title: readText(activeStageRecord, "title", "name") ?? "Your turn", description: "Display only the current learner task.", category: "practice", allowScroll: false };
    case "assessment":
      return { stage: normalizedStage, mode: "question", kind: "assessment-item", packagePath: hasContent(lessonStage.assessment) ? `lessonPlan.stages.${stageIndex}.assessment` : firstAvailable(activeActivityPath, "lessonPlan.formativeAssessment", "lessonPlan.summativeAssessment"), title: "Check your learning", description: "Display the active assessment task.", category: "assessment", allowScroll: false };
    case "review":
    case "complete":
      return { stage: normalizedStage, mode: "summary", kind: "review-summary", packagePath: hasContent(lessonPlan.outcomes) ? "lessonPlan.outcomes" : firstAvailable(blueprintWhiteboardPath, "lessonPlan.successCriteria", stageTeacherPath), title: normalizedStage === "complete" ? "Lesson complete" : "Review", description: "Display the lesson review and key learning.", category: "instruction", allowScroll: true };
    case "objective":
      return { stage: normalizedStage, mode: "objective", kind: "lesson-objectives", packagePath: "lessonPlan.lessonObjectives", title: resolved.lessonTitle, description: "Display the lesson objectives.", category: "instruction", allowScroll: false };
    case "presentation":
    default:
      return { stage: normalizedStage, mode: "instructions", kind: "instructions", packagePath: firstAvailable(blueprintWhiteboardPath, activeActivityPath, stageTeacherPath, stageStudentPath), title: readText(activeStageRecord, "title", "name") ?? resolved.lessonTitle, description: "Display the content for the active teaching stage.", category: "instruction", allowScroll: true };
  }
}

function buildResolvedLessonClassroom(
  resolved: ResolvedStudentLesson,
  session: TeachingSessionState,
  supplied: TeachingTurnClassroomRuntimeInput | undefined,
  occurredAt: string,
  entryMode: RuntimeLessonEntryMode,
  learnerName?: string,
  nativeLanguage?: LanguageCode,
): TeachingTurnClassroomRuntimeInput | undefined {
  if (!supplied) return undefined;

  const lessonDirector =
    supplied.lessonDirector ??
    buildLessonDirectorInput({ resolved, session, occurredAt, entryMode, learnerName, nativeLanguage });

  const packageRoot = {
    lessonPlan: resolved.lessonPlan,
    teachingBrainLesson: resolved.teachingBrainLesson,
  };

  if (supplied.scene) {
    return {
      ...supplied,
      lessonDirector,
      whiteboard: {
        ...supplied.whiteboard,
        packageRoot: supplied.whiteboard?.packageRoot ?? packageRoot,
      },
    };
  }

  const source = resolveDynamicWhiteboardSource(resolved, session, entryMode);

  const sceneDefinition: Readonly<SceneDefinition> = defineScene({
    id: `${resolved.lessonId}:${session.activeStageId}:lesson-board`,
    version: resolved.packageVersion || "1.0",
    stage: source.stage,
    category: source.category,
    title: source.title,
    description: source.description,
    requirement: "required",
    order: 1,
    objectiveIds: resolved.teachingBrainLesson.objectives.map((objective) => objective.id),
    contentReferences: [
      { id: "lesson-title", kind: "lesson-title", packagePath: "lessonPlan.lessonTitle", required: true },
      { id: "active-stage-content", kind: source.kind, packagePath: source.packagePath, required: false, metadata: { stageId: session.activeStageId ?? "", activityId: session.activeActivityId ?? "", dynamic: true } },
    ],
    steps: [
      {
        id: `${resolved.lessonId}:${session.activeActivityId}:display-board`,
        order: 1,
        kind: "display",
        title: source.title,
        description: source.description,
        required: true,
        whiteboard: {
          mode: source.mode,
          titleReferenceId: "lesson-title",
          contentReferenceId: "active-stage-content",
          clearBeforeDisplay: entryMode === "new",
          allowScroll: source.allowScroll,
        },
      },
    ],
    completionRules: [{ type: "all-required-steps-completed" }],
    transitionRules: [],
    supportRules: [],
    estimatedMinutes: 1,
    skippable: false,
    repeatable: true,
    tags: ["runtime-generated", "dynamic-whiteboard", source.stage],
  });

  return {
    ...supplied,
    lessonDirector,
    scene: { definition: sceneDefinition, state: createSceneEngineState(sceneDefinition, occurredAt), event: { type: "start", now: occurredAt } },
    whiteboard: { ...supplied.whiteboard, packageRoot: supplied.whiteboard?.packageRoot ?? packageRoot },
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

      const entryMode: RuntimeLessonEntryMode = input.resumeLesson
        ? "resume"
        : input.session
          ? "continue"
          : "new";

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
        classroom: buildResolvedLessonClassroom(
          resolved,
          inputSession,
          input.classroom,
          occurredAt,
          entryMode,
          clean(input.learnerName) ||
            clean(input.assignment.studentName) ||
            undefined,
          resolveAssignmentNativeLanguage(input.assignment),
        ),
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
          lessonEntryMode: entryMode,
          lessonResumed: entryMode === "resume",
          lessonIntroductionCompleted: entryMode !== "new",
          resumeMainObjective:
            readText(
              asRecord(resolved.teachingBrainLesson.objectives[0]),
              "text",
              "title",
              "label",
              "name",
            ) ?? resolved.lessonTitle,
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
