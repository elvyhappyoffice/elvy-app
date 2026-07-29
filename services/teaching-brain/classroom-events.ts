/**
 * ELVY Teaching Engine
 * TE-500 — Classroom Events
 *
 * Shared event contracts used by the Classroom Director and the teaching
 * engines. Events describe what happened; they do not decide what should
 * happen next.
 *
 * Rules:
 * - No React imports.
 * - No database access.
 * - No AI calls.
 * - No educational decision logic.
 * - Every event is immutable and serializable.
 */

import type {
  ClassroomError,
  ClassroomIdentifier,
  ClassroomMemoryItem,
  ClassroomNotification,
  ClassroomObjectiveState,
  ClassroomSceneState,
  ClassroomSpeechState,
  ClassroomStudentState,
  ClassroomTeacherState,
  ClassroomWhiteboardState,
  EngineHealth,
  ISODateTime,
  Percentage,
} from "./classroom-state";

export type ClassroomEventId = ClassroomIdentifier;

export type ClassroomEventSource =
  | "lesson_director"
  | "scene_engine"
  | "whiteboard_engine"
  | "teaching_script_engine"
  | "student_response_engine"
  | "adaptive_teaching_engine"
  | "classroom_memory"
  | "classroom_director"
  | "system";

export type ClassroomEventType =
  | "CLASSROOM_INITIALIZED"
  | "CLASSROOM_READY"
  | "CLASSROOM_PAUSED"
  | "CLASSROOM_RESUMED"
  | "CLASSROOM_COMPLETED"
  | "LESSON_STARTED"
  | "LESSON_PAUSED"
  | "LESSON_RESUMED"
  | "LESSON_COMPLETED"
  | "LESSON_BLOCKED"
  | "OBJECTIVE_STARTED"
  | "OBJECTIVE_UPDATED"
  | "OBJECTIVE_MASTERED"
  | "OBJECTIVE_COMPLETED"
  | "SCENE_STARTED"
  | "SCENE_UPDATED"
  | "SCENE_WAITING"
  | "SCENE_COMPLETED"
  | "SCENE_SKIPPED"
  | "WHITEBOARD_UPDATED"
  | "WHITEBOARD_CLEARED"
  | "WHITEBOARD_HIGHLIGHT_CHANGED"
  | "TEACHER_STATE_UPDATED"
  | "TEACHER_STARTED_SPEAKING"
  | "TEACHER_SPEECH_PROGRESS"
  | "TEACHER_FINISHED_SPEAKING"
  | "TEACHER_STOPPED_SPEAKING"
  | "STUDENT_INPUT_ENABLED"
  | "STUDENT_INPUT_DISABLED"
  | "STUDENT_ANSWER_DRAFTED"
  | "STUDENT_ANSWER_RECEIVED"
  | "STUDENT_ANSWER_EVALUATED"
  | "STUDENT_SUPPORT_REQUESTED"
  | "STUDENT_SUPPORT_PROVIDED"
  | "PROGRESS_UPDATED"
  | "MEMORY_UPDATED"
  | "NOTIFICATION_ADDED"
  | "NOTIFICATION_DISMISSED"
  | "ENGINE_HEALTH_CHANGED"
  | "ENGINE_ERROR"
  | "SYSTEM_ERROR";

export interface ClassroomEventMetadata {
  readonly correlationId?: ClassroomIdentifier;
  readonly causationId?: ClassroomEventId;
  readonly lessonId?: ClassroomIdentifier;
  readonly sceneId?: ClassroomIdentifier;
  readonly objectiveId?: ClassroomIdentifier;
  readonly stepId?: ClassroomIdentifier;
  readonly attemptNumber?: number;
  readonly tags?: readonly string[];
}

export interface ClassroomEventBase<
  TType extends ClassroomEventType,
  TPayload,
> {
  readonly id: ClassroomEventId;
  readonly type: TType;
  readonly source: ClassroomEventSource;
  readonly sessionId: ClassroomIdentifier;
  readonly occurredAt: ISODateTime;
  readonly sequence: number;
  readonly payload: Readonly<TPayload>;
  readonly metadata?: Readonly<ClassroomEventMetadata>;
}

export type ClassroomInitializedEvent = ClassroomEventBase<
  "CLASSROOM_INITIALIZED",
  {
    readonly classroomId: ClassroomIdentifier;
    readonly lessonId: ClassroomIdentifier;
    readonly sceneId: ClassroomIdentifier;
  }
>;

export type ClassroomReadyEvent = ClassroomEventBase<
  "CLASSROOM_READY",
  Record<string, never>
>;

export type ClassroomPausedEvent = ClassroomEventBase<
  "CLASSROOM_PAUSED",
  {
    readonly reason?: string;
  }
>;

export type ClassroomResumedEvent = ClassroomEventBase<
  "CLASSROOM_RESUMED",
  Record<string, never>
>;

export type ClassroomCompletedEvent = ClassroomEventBase<
  "CLASSROOM_COMPLETED",
  {
    readonly completedAt: ISODateTime;
  }
>;

export type LessonStartedEvent = ClassroomEventBase<
  "LESSON_STARTED",
  {
    readonly lessonId: ClassroomIdentifier;
    readonly title: string;
    readonly startedAt: ISODateTime;
  }
>;

export type LessonPausedEvent = ClassroomEventBase<
  "LESSON_PAUSED",
  {
    readonly reason?: string;
  }
>;

export type LessonResumedEvent = ClassroomEventBase<
  "LESSON_RESUMED",
  Record<string, never>
>;

export type LessonCompletedEvent = ClassroomEventBase<
  "LESSON_COMPLETED",
  {
    readonly lessonId: ClassroomIdentifier;
    readonly completedAt: ISODateTime;
    readonly masteryEstimate?: Percentage;
  }
>;

export type LessonBlockedEvent = ClassroomEventBase<
  "LESSON_BLOCKED",
  {
    readonly reason: string;
    readonly recoverable: boolean;
  }
>;

export type ObjectiveStartedEvent = ClassroomEventBase<
  "OBJECTIVE_STARTED",
  {
    readonly objective: ClassroomObjectiveState;
  }
>;

export type ObjectiveUpdatedEvent = ClassroomEventBase<
  "OBJECTIVE_UPDATED",
  {
    readonly objective: ClassroomObjectiveState;
  }
>;

export type ObjectiveMasteredEvent = ClassroomEventBase<
  "OBJECTIVE_MASTERED",
  {
    readonly objectiveId: ClassroomIdentifier;
    readonly masteryEstimate: Percentage;
    readonly evidenceCount: number;
  }
>;

export type ObjectiveCompletedEvent = ClassroomEventBase<
  "OBJECTIVE_COMPLETED",
  {
    readonly objectiveId: ClassroomIdentifier;
    readonly completedAt: ISODateTime;
  }
>;

export type SceneStartedEvent = ClassroomEventBase<
  "SCENE_STARTED",
  {
    readonly scene: ClassroomSceneState;
  }
>;

export type SceneUpdatedEvent = ClassroomEventBase<
  "SCENE_UPDATED",
  {
    readonly scene: ClassroomSceneState;
  }
>;

export type SceneWaitingEvent = ClassroomEventBase<
  "SCENE_WAITING",
  {
    readonly reason: string;
    readonly waitingForStudent: boolean;
  }
>;

export type SceneCompletedEvent = ClassroomEventBase<
  "SCENE_COMPLETED",
  {
    readonly sceneId: ClassroomIdentifier;
    readonly completedAt: ISODateTime;
    readonly outcome?: string;
  }
>;

export type SceneSkippedEvent = ClassroomEventBase<
  "SCENE_SKIPPED",
  {
    readonly sceneId: ClassroomIdentifier;
    readonly reason: string;
  }
>;

export type WhiteboardUpdatedEvent = ClassroomEventBase<
  "WHITEBOARD_UPDATED",
  {
    readonly whiteboard: ClassroomWhiteboardState;
  }
>;

export type WhiteboardClearedEvent = ClassroomEventBase<
  "WHITEBOARD_CLEARED",
  {
    readonly revision: number;
  }
>;

export type WhiteboardHighlightChangedEvent = ClassroomEventBase<
  "WHITEBOARD_HIGHLIGHT_CHANGED",
  {
    readonly highlightedBlockIds: readonly ClassroomIdentifier[];
    readonly activeBlockId?: ClassroomIdentifier;
  }
>;

export type TeacherStateUpdatedEvent = ClassroomEventBase<
  "TEACHER_STATE_UPDATED",
  {
    readonly teacher: ClassroomTeacherState;
  }
>;

export type TeacherStartedSpeakingEvent = ClassroomEventBase<
  "TEACHER_STARTED_SPEAKING",
  {
    readonly speech: ClassroomSpeechState;
  }
>;

export type TeacherSpeechProgressEvent = ClassroomEventBase<
  "TEACHER_SPEECH_PROGRESS",
  {
    readonly progress: Percentage;
    readonly currentSegmentIndex: number;
  }
>;

export type TeacherFinishedSpeakingEvent = ClassroomEventBase<
  "TEACHER_FINISHED_SPEAKING",
  {
    readonly completedAt: ISODateTime;
  }
>;

export type TeacherStoppedSpeakingEvent = ClassroomEventBase<
  "TEACHER_STOPPED_SPEAKING",
  {
    readonly reason: "cancelled" | "interrupted" | "error";
  }
>;

export type StudentInputEnabledEvent = ClassroomEventBase<
  "STUDENT_INPUT_ENABLED",
  {
    readonly allowedInputModes: readonly ClassroomStudentState["inputMode"][];
  }
>;

export type StudentInputDisabledEvent = ClassroomEventBase<
  "STUDENT_INPUT_DISABLED",
  {
    readonly reason?: string;
  }
>;

export type StudentAnswerDraftedEvent = ClassroomEventBase<
  "STUDENT_ANSWER_DRAFTED",
  {
    readonly answer: string;
    readonly inputMode: ClassroomStudentState["inputMode"];
  }
>;

export type StudentAnswerReceivedEvent = ClassroomEventBase<
  "STUDENT_ANSWER_RECEIVED",
  {
    readonly answer: string;
    readonly inputMode: ClassroomStudentState["inputMode"];
    readonly submittedAt: ISODateTime;
  }
>;

export type StudentAnswerEvaluatedEvent = ClassroomEventBase<
  "STUDENT_ANSWER_EVALUATED",
  {
    readonly status: ClassroomStudentState["answerStatus"];
    readonly confidenceEstimate?: Percentage;
    readonly feedback?: string;
    readonly evidence?: readonly string[];
  }
>;

export type StudentSupportRequestedEvent = ClassroomEventBase<
  "STUDENT_SUPPORT_REQUESTED",
  {
    readonly reason: string;
    readonly supportLevel?: number;
  }
>;

export type StudentSupportProvidedEvent = ClassroomEventBase<
  "STUDENT_SUPPORT_PROVIDED",
  {
    readonly supportType: string;
    readonly message?: string;
  }
>;

export type ProgressUpdatedEvent = ClassroomEventBase<
  "PROGRESS_UPDATED",
  {
    readonly lessonProgress?: Percentage;
    readonly sceneProgress?: Percentage;
    readonly objectiveProgress?: Percentage;
    readonly masteryEstimate?: Percentage;
    readonly completedActivities?: number;
    readonly totalActivities?: number;
  }
>;

export type MemoryUpdatedEvent = ClassroomEventBase<
  "MEMORY_UPDATED",
  {
    readonly recentMistakes?: readonly ClassroomMemoryItem[];
    readonly learnedConcepts?: readonly ClassroomMemoryItem[];
    readonly reviewTargets?: readonly ClassroomMemoryItem[];
    readonly persistedAt?: ISODateTime;
  }
>;

export type NotificationAddedEvent = ClassroomEventBase<
  "NOTIFICATION_ADDED",
  {
    readonly notification: ClassroomNotification;
  }
>;

export type NotificationDismissedEvent = ClassroomEventBase<
  "NOTIFICATION_DISMISSED",
  {
    readonly notificationId: ClassroomIdentifier;
  }
>;

export type EngineHealthChangedEvent = ClassroomEventBase<
  "ENGINE_HEALTH_CHANGED",
  {
    readonly engine: ClassroomEventSource;
    readonly health: EngineHealth;
  }
>;

export type EngineErrorEvent = ClassroomEventBase<
  "ENGINE_ERROR",
  {
    readonly error: ClassroomError;
  }
>;

export type SystemErrorEvent = ClassroomEventBase<
  "SYSTEM_ERROR",
  {
    readonly error: ClassroomError;
  }
>;

export type ClassroomEvent =
  | ClassroomInitializedEvent
  | ClassroomReadyEvent
  | ClassroomPausedEvent
  | ClassroomResumedEvent
  | ClassroomCompletedEvent
  | LessonStartedEvent
  | LessonPausedEvent
  | LessonResumedEvent
  | LessonCompletedEvent
  | LessonBlockedEvent
  | ObjectiveStartedEvent
  | ObjectiveUpdatedEvent
  | ObjectiveMasteredEvent
  | ObjectiveCompletedEvent
  | SceneStartedEvent
  | SceneUpdatedEvent
  | SceneWaitingEvent
  | SceneCompletedEvent
  | SceneSkippedEvent
  | WhiteboardUpdatedEvent
  | WhiteboardClearedEvent
  | WhiteboardHighlightChangedEvent
  | TeacherStateUpdatedEvent
  | TeacherStartedSpeakingEvent
  | TeacherSpeechProgressEvent
  | TeacherFinishedSpeakingEvent
  | TeacherStoppedSpeakingEvent
  | StudentInputEnabledEvent
  | StudentInputDisabledEvent
  | StudentAnswerDraftedEvent
  | StudentAnswerReceivedEvent
  | StudentAnswerEvaluatedEvent
  | StudentSupportRequestedEvent
  | StudentSupportProvidedEvent
  | ProgressUpdatedEvent
  | MemoryUpdatedEvent
  | NotificationAddedEvent
  | NotificationDismissedEvent
  | EngineHealthChangedEvent
  | EngineErrorEvent
  | SystemErrorEvent;

export type ClassroomEventOfType<TType extends ClassroomEventType> = Extract<
  ClassroomEvent,
  { readonly type: TType }
>;

export interface CreateClassroomEventInput<
  TType extends ClassroomEventType,
> {
  readonly id: ClassroomEventId;
  readonly type: TType;
  readonly source: ClassroomEventSource;
  readonly sessionId: ClassroomIdentifier;
  readonly occurredAt: ISODateTime;
  readonly sequence: number;
  readonly payload: ClassroomEventOfType<TType>["payload"];
  readonly metadata?: ClassroomEventMetadata;
}

export function createClassroomEvent<TType extends ClassroomEventType>(
  input: CreateClassroomEventInput<TType>,
): ClassroomEventOfType<TType> {
  return Object.freeze({
    id: input.id,
    type: input.type,
    source: input.source,
    sessionId: input.sessionId,
    occurredAt: input.occurredAt,
    sequence: input.sequence,
    payload: Object.freeze(input.payload),
    metadata: input.metadata ? Object.freeze(input.metadata) : undefined,
  }) as unknown as ClassroomEventOfType<TType>;
}

export function isClassroomEventType<TType extends ClassroomEventType>(
  event: ClassroomEvent,
  type: TType,
): event is ClassroomEventOfType<TType> {
  return event.type === type;
}

export function validateClassroomEvent(
  event: ClassroomEvent,
): readonly string[] {
  const errors: string[] = [];

  if (!event.id.trim()) {
    errors.push("event.id is required.");
  }

  if (!event.sessionId.trim()) {
    errors.push("event.sessionId is required.");
  }

  if (!event.occurredAt.trim()) {
    errors.push("event.occurredAt is required.");
  }

  if (!Number.isInteger(event.sequence) || event.sequence < 0) {
    errors.push("event.sequence must be a non-negative integer.");
  }

  if (
    event.metadata?.attemptNumber !== undefined &&
    (!Number.isInteger(event.metadata.attemptNumber) ||
      event.metadata.attemptNumber < 1)
  ) {
    errors.push("metadata.attemptNumber must be a positive integer.");
  }

  switch (event.type) {
    case "TEACHER_SPEECH_PROGRESS":
      validatePercentage("payload.progress", event.payload.progress, errors);
      break;

    case "OBJECTIVE_MASTERED":
      validatePercentage(
        "payload.masteryEstimate",
        event.payload.masteryEstimate,
        errors,
      );
      break;

    case "PROGRESS_UPDATED":
      if (event.payload.lessonProgress !== undefined) {
        validatePercentage(
          "payload.lessonProgress",
          event.payload.lessonProgress,
          errors,
        );
      }

      if (event.payload.sceneProgress !== undefined) {
        validatePercentage(
          "payload.sceneProgress",
          event.payload.sceneProgress,
          errors,
        );
      }

      if (event.payload.objectiveProgress !== undefined) {
        validatePercentage(
          "payload.objectiveProgress",
          event.payload.objectiveProgress,
          errors,
        );
      }

      if (event.payload.masteryEstimate !== undefined) {
        validatePercentage(
          "payload.masteryEstimate",
          event.payload.masteryEstimate,
          errors,
        );
      }
      break;

    case "STUDENT_ANSWER_RECEIVED":
    case "STUDENT_ANSWER_DRAFTED":
      if (!event.payload.answer.trim()) {
        errors.push("payload.answer cannot be empty.");
      }
      break;

    case "ENGINE_ERROR":
    case "SYSTEM_ERROR":
      if (!event.payload.error.code.trim()) {
        errors.push("payload.error.code is required.");
      }
      break;

    default:
      break;
  }

  return errors;
}

export function sortClassroomEvents(
  events: readonly ClassroomEvent[],
): readonly ClassroomEvent[] {
  return [...events].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    return left.occurredAt.localeCompare(right.occurredAt);
  });
}

function validatePercentage(
  field: string,
  value: Percentage,
  errors: string[],
): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    errors.push(`${field} must be a finite number from 0 to 100.`);
  }
}
