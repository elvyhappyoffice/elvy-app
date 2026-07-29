/**
 * ELVY Teaching Engine
 * TE-500 — Classroom Director
 *
 * Central renderer-independent orchestrator for the live classroom.
 *
 * Responsibilities:
 * - Own the authoritative ClassroomState.
 * - Receive and validate ClassroomEvents.
 * - Apply deterministic, immutable state transitions.
 * - Maintain event ordering, engine registration, and diagnostics.
 * - Publish updated snapshots to subscribers.
 *
 * Non-responsibilities:
 * - It does not generate curriculum content.
 * - It does not evaluate answers.
 * - It does not choose teaching strategies.
 * - It does not decide lesson progression.
 */

import type {
  ClassroomError,
  ClassroomIdentifier,
  ClassroomState,
  ClassroomStatus,
  EngineHealth,
  ISODateTime,
  InputMode,
} from "./classroom-state";
import {
  validateClassroomState,
} from "./classroom-state";
import type {
  ClassroomEvent,
  ClassroomEventSource,
  ClassroomEventType,
} from "./classroom-events";
import {
  sortClassroomEvents,
  validateClassroomEvent,
} from "./classroom-events";

export type ClassroomStateListener = (
  state: ClassroomState,
  event: ClassroomEvent,
) => void;

export type ClassroomDirectorWarningCode =
  | "DUPLICATE_EVENT"
  | "SESSION_MISMATCH"
  | "OUT_OF_ORDER_EVENT"
  | "UNREGISTERED_ENGINE"
  | "STATE_VALIDATION_FAILED"
  | "SUBSCRIBER_FAILED";

export interface ClassroomDirectorWarning {
  readonly code: ClassroomDirectorWarningCode;
  readonly message: string;
  readonly occurredAt: ISODateTime;
  readonly eventId?: ClassroomIdentifier;
  readonly source?: ClassroomEventSource;
}

export interface ClassroomDirectorDiagnostics {
  readonly processedEvents: number;
  readonly rejectedEvents: number;
  readonly duplicateEvents: number;
  readonly publishedStates: number;
  readonly subscriberFailures: number;
  readonly lastProcessedSequence: number;
  readonly queueLength: number;
  readonly isProcessing: boolean;
  readonly lastEvent?: ClassroomEvent;
  readonly warnings: readonly ClassroomDirectorWarning[];
  readonly errors: readonly ClassroomError[];
  readonly registeredEngines: readonly EngineRegistration[];
}

export interface EngineRegistration {
  readonly source: ClassroomEventSource;
  readonly registeredAt: ISODateTime;
  readonly health: EngineHealth;
  readonly version?: string;
}

export interface RegisterEngineInput {
  readonly source: ClassroomEventSource;
  readonly registeredAt: ISODateTime;
  readonly health?: EngineHealth;
  readonly version?: string;
}

export interface ClassroomDirectorOptions {
  readonly strictSessionMatching?: boolean;
  readonly rejectOutOfOrderEvents?: boolean;
  readonly requireRegisteredEngines?: boolean;
  readonly maxDiagnosticWarnings?: number;
  readonly maxDiagnosticErrors?: number;
}

interface MutableDiagnostics {
  processedEvents: number;
  rejectedEvents: number;
  duplicateEvents: number;
  publishedStates: number;
  subscriberFailures: number;
  lastProcessedSequence: number;
  lastEvent?: ClassroomEvent;
  warnings: ClassroomDirectorWarning[];
  errors: ClassroomError[];
}

const DEFAULT_OPTIONS: Required<ClassroomDirectorOptions> = {
  strictSessionMatching: true,
  rejectOutOfOrderEvents: true,
  requireRegisteredEngines: false,
  maxDiagnosticWarnings: 100,
  maxDiagnosticErrors: 100,
};

const DIRECTOR_SOURCE: ClassroomEventSource = "classroom_director";

export class ClassroomDirector {
  private state: ClassroomState;
  private readonly initialState: ClassroomState;
  private readonly options: Required<ClassroomDirectorOptions>;
  private readonly eventQueue: ClassroomEvent[] = [];
  private readonly subscribers = new Set<ClassroomStateListener>();
  private readonly engines = new Map<ClassroomEventSource, EngineRegistration>();
  private readonly processedEventIds = new Set<ClassroomIdentifier>();
  private isProcessing = false;

  private readonly diagnostics: MutableDiagnostics = {
    processedEvents: 0,
    rejectedEvents: 0,
    duplicateEvents: 0,
    publishedStates: 0,
    subscriberFailures: 0,
    lastProcessedSequence: -1,
    warnings: [],
    errors: [],
  };

  public constructor(
    initialState: ClassroomState,
    options: ClassroomDirectorOptions = {},
  ) {
    const stateErrors = validateClassroomState(initialState);

    if (stateErrors.length > 0) {
      throw new Error(
        `Cannot create ClassroomDirector with invalid state: ${stateErrors.join(
          " ",
        )}`,
      );
    }

    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    this.initialState = freezeClassroomState(initialState);
    this.state = this.initialState;

    this.engines.set(DIRECTOR_SOURCE, {
      source: DIRECTOR_SOURCE,
      registeredAt: initialState.system.generatedAt,
      health: "healthy",
      version: initialState.system.teachingEngineVersion,
    });
  }

  /**
   * Returns the current authoritative classroom snapshot.
   */
  public getState(): ClassroomState {
    return this.state;
  }

  /**
   * Adds a listener and returns an unsubscribe function.
   */
  public subscribe(listener: ClassroomStateListener): () => void {
    this.subscribers.add(listener);

    return () => {
      this.unsubscribe(listener);
    };
  }

  public unsubscribe(listener: ClassroomStateListener): void {
    this.subscribers.delete(listener);
  }

  /**
   * Registers or replaces an engine registration.
   */
  public registerEngine(input: RegisterEngineInput): EngineRegistration {
    const registration: EngineRegistration = Object.freeze({
      source: input.source,
      registeredAt: input.registeredAt,
      health: input.health ?? "healthy",
      version: input.version,
    });

    this.engines.set(input.source, registration);
    return registration;
  }

  public unregisterEngine(source: ClassroomEventSource): boolean {
    if (source === DIRECTOR_SOURCE) {
      return false;
    }

    return this.engines.delete(source);
  }

  public isEngineRegistered(source: ClassroomEventSource): boolean {
    return this.engines.has(source);
  }

  /**
   * Queues and synchronously processes an event.
   *
   * Returns true when the event is accepted. A true result means the event
   * entered the processing pipeline; diagnostics record any later rejection.
   */
  public dispatch(event: ClassroomEvent): boolean {
    const validationErrors = validateClassroomEvent(event);

    if (validationErrors.length > 0) {
      this.rejectEvent(
        event,
        validationErrors.map((message, index) =>
          createDirectorError({
            code: `INVALID_EVENT_${index + 1}`,
            message,
            source: "classroom_director",
            occurredAt: event.occurredAt,
            recoverable: true,
          }),
        ),
      );
      return false;
    }

    if (this.processedEventIds.has(event.id)) {
      this.diagnostics.duplicateEvents += 1;
      this.addWarning({
        code: "DUPLICATE_EVENT",
        message: `Event "${event.id}" has already been processed.`,
        occurredAt: event.occurredAt,
        eventId: event.id,
        source: event.source,
      });
      return false;
    }

    if (
      this.options.strictSessionMatching &&
      event.sessionId !== this.state.sessionId
    ) {
      this.rejectEvent(event, [
        createDirectorError({
          code: "SESSION_MISMATCH",
          message: `Event session "${event.sessionId}" does not match active session "${this.state.sessionId}".`,
          source: "classroom_director",
          occurredAt: event.occurredAt,
          recoverable: true,
        }),
      ]);
      this.addWarning({
        code: "SESSION_MISMATCH",
        message: `Rejected event "${event.id}" because its session does not match the active classroom session.`,
        occurredAt: event.occurredAt,
        eventId: event.id,
        source: event.source,
      });
      return false;
    }

    if (
      this.options.requireRegisteredEngines &&
      !this.engines.has(event.source)
    ) {
      this.rejectEvent(event, [
        createDirectorError({
          code: "UNREGISTERED_ENGINE",
          message: `Event source "${event.source}" is not registered.`,
          source: "classroom_director",
          occurredAt: event.occurredAt,
          recoverable: true,
        }),
      ]);
      this.addWarning({
        code: "UNREGISTERED_ENGINE",
        message: `Rejected event "${event.id}" from unregistered engine "${event.source}".`,
        occurredAt: event.occurredAt,
        eventId: event.id,
        source: event.source,
      });
      return false;
    }

    if (
      this.options.rejectOutOfOrderEvents &&
      event.sequence <= this.diagnostics.lastProcessedSequence
    ) {
      this.rejectEvent(event, [
        createDirectorError({
          code: "OUT_OF_ORDER_EVENT",
          message: `Event sequence ${event.sequence} is not greater than the last processed sequence ${this.diagnostics.lastProcessedSequence}.`,
          source: "classroom_director",
          occurredAt: event.occurredAt,
          recoverable: true,
        }),
      ]);
      this.addWarning({
        code: "OUT_OF_ORDER_EVENT",
        message: `Rejected out-of-order event "${event.id}".`,
        occurredAt: event.occurredAt,
        eventId: event.id,
        source: event.source,
      });
      return false;
    }

    this.eventQueue.push(event);
    this.processQueue();
    return true;
  }

  public dispatchMany(events: readonly ClassroomEvent[]): number {
    let accepted = 0;

    for (const event of sortClassroomEvents(events)) {
      if (this.dispatch(event)) {
        accepted += 1;
      }
    }

    return accepted;
  }

  public getDiagnostics(): ClassroomDirectorDiagnostics {
    return Object.freeze({
      processedEvents: this.diagnostics.processedEvents,
      rejectedEvents: this.diagnostics.rejectedEvents,
      duplicateEvents: this.diagnostics.duplicateEvents,
      publishedStates: this.diagnostics.publishedStates,
      subscriberFailures: this.diagnostics.subscriberFailures,
      lastProcessedSequence: this.diagnostics.lastProcessedSequence,
      queueLength: this.eventQueue.length,
      isProcessing: this.isProcessing,
      lastEvent: this.diagnostics.lastEvent,
      warnings: Object.freeze([...this.diagnostics.warnings]),
      errors: Object.freeze([...this.diagnostics.errors]),
      registeredEngines: Object.freeze([...this.engines.values()]),
    });
  }

  /**
   * Restores the initial snapshot and clears runtime diagnostics and queues.
   * Subscribers and engine registrations remain attached.
   */
  public reset(): ClassroomState {
    this.eventQueue.length = 0;
    this.processedEventIds.clear();
    this.isProcessing = false;

    this.diagnostics.processedEvents = 0;
    this.diagnostics.rejectedEvents = 0;
    this.diagnostics.duplicateEvents = 0;
    this.diagnostics.publishedStates = 0;
    this.diagnostics.subscriberFailures = 0;
    this.diagnostics.lastProcessedSequence = -1;
    this.diagnostics.lastEvent = undefined;
    this.diagnostics.warnings.length = 0;
    this.diagnostics.errors.length = 0;

    this.state = this.initialState;
    return this.state;
  }

  private processQueue(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();

        if (!event) {
          continue;
        }

        this.processEvent(event);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private processEvent(event: ClassroomEvent): void {
    const nextState = this.routeEvent(this.state, event);
    const stampedState = this.stampState(nextState, event);
    const stateErrors = validateClassroomState(stampedState);

    if (stateErrors.length > 0) {
      this.rejectEvent(
        event,
        stateErrors.map((message, index) =>
          createDirectorError({
            code: `INVALID_STATE_${index + 1}`,
            message,
            source: "classroom_director",
            occurredAt: event.occurredAt,
            recoverable: false,
          }),
        ),
      );
      this.addWarning({
        code: "STATE_VALIDATION_FAILED",
        message: `Event "${event.id}" produced an invalid ClassroomState.`,
        occurredAt: event.occurredAt,
        eventId: event.id,
        source: event.source,
      });
      return;
    }

    this.state = freezeClassroomState(stampedState);
    this.processedEventIds.add(event.id);
    this.diagnostics.processedEvents += 1;
    this.diagnostics.lastProcessedSequence = event.sequence;
    this.diagnostics.lastEvent = event;

    this.publish(event);
  }

  private routeEvent(
    state: ClassroomState,
    event: ClassroomEvent,
  ): ClassroomState {
    switch (event.type) {
      case "CLASSROOM_INITIALIZED":
        return {
          ...state,
          classroomId: event.payload.classroomId,
          status: "initializing",
        };

      case "CLASSROOM_READY":
        return {
          ...state,
          status: "ready",
        };

      case "CLASSROOM_PAUSED":
        return {
          ...state,
          status: "paused",
          lesson: {
            ...state.lesson,
            status:
              state.lesson.status === "in_progress"
                ? "paused"
                : state.lesson.status,
          },
          speech: {
            ...state.speech,
            status:
              state.speech.status === "speaking"
                ? "paused"
                : state.speech.status,
          },
          interaction: this.disableInteraction(
            state.interaction,
            event.payload.reason ?? "Classroom paused.",
          ),
        };

      case "CLASSROOM_RESUMED":
        return {
          ...state,
          status: deriveActiveClassroomStatus(state),
          lesson: {
            ...state.lesson,
            status:
              state.lesson.status === "paused"
                ? "in_progress"
                : state.lesson.status,
          },
          speech: {
            ...state.speech,
            status:
              state.speech.status === "paused"
                ? "queued"
                : state.speech.status,
          },
        };

      case "CLASSROOM_COMPLETED":
        return {
          ...state,
          status: "completed",
          interaction: this.disableInteraction(
            state.interaction,
            "Classroom completed.",
          ),
          timing: {
            ...state.timing,
            lastUpdatedAt: event.payload.completedAt,
          },
        };

      case "LESSON_STARTED":
        return {
          ...state,
          status: "teaching",
          lesson: {
            ...state.lesson,
            lessonId: event.payload.lessonId,
            title: event.payload.title,
            status: "in_progress",
            startedAt: event.payload.startedAt,
            completedAt: undefined,
          },
          timing: {
            ...state.timing,
            lessonStartedAt: event.payload.startedAt,
          },
        };

      case "LESSON_PAUSED":
        return {
          ...state,
          status: "paused",
          lesson: {
            ...state.lesson,
            status: "paused",
          },
          interaction: this.disableInteraction(
            state.interaction,
            event.payload.reason ?? "Lesson paused.",
          ),
        };

      case "LESSON_RESUMED":
        return {
          ...state,
          status: deriveActiveClassroomStatus(state),
          lesson: {
            ...state.lesson,
            status: "in_progress",
          },
        };

      case "LESSON_COMPLETED":
        return {
          ...state,
          status: "completed",
          lesson: {
            ...state.lesson,
            status: "completed",
            completedAt: event.payload.completedAt,
          },
          objective: {
            ...state.objective,
            masteryEstimate:
              event.payload.masteryEstimate ??
              state.objective.masteryEstimate,
          },
          progress: {
            ...state.progress,
            lessonProgress: 100,
            masteryEstimate:
              event.payload.masteryEstimate ??
              state.progress.masteryEstimate,
            remainingActivities: 0,
          },
          interaction: this.disableInteraction(
            state.interaction,
            "Lesson completed.",
          ),
        };

      case "LESSON_BLOCKED":
        return {
          ...state,
          status: event.payload.recoverable ? "paused" : "error",
          lesson: {
            ...state.lesson,
            status: "blocked",
          },
          interaction: this.disableInteraction(
            state.interaction,
            event.payload.reason,
          ),
        };

      case "OBJECTIVE_STARTED":
        return {
          ...state,
          objective: {
            ...event.payload.objective,
            status: "in_progress",
          },
        };

      case "OBJECTIVE_UPDATED":
        return {
          ...state,
          objective: event.payload.objective,
        };

      case "OBJECTIVE_MASTERED":
        return {
          ...state,
          objective: {
            ...state.objective,
            objectiveId: event.payload.objectiveId,
            status: "mastered",
            masteryEstimate: event.payload.masteryEstimate,
            evidenceCount: event.payload.evidenceCount,
          },
          progress: {
            ...state.progress,
            objectiveProgress: 100,
            masteryEstimate: event.payload.masteryEstimate,
          },
        };

      case "OBJECTIVE_COMPLETED":
        return {
          ...state,
          objective: {
            ...state.objective,
            objectiveId: event.payload.objectiveId,
            status: "completed",
          },
          progress: {
            ...state.progress,
            objectiveProgress: 100,
          },
        };

      case "SCENE_STARTED":
        return {
          ...state,
          status: "teaching",
          scene: {
            ...event.payload.scene,
            status: "active",
          },
          timing: {
            ...state.timing,
            sceneStartedAt:
              event.payload.scene.startedAt ?? event.occurredAt,
            waitStartedAt: undefined,
            waitReason: undefined,
          },
        };

      case "SCENE_UPDATED":
        return {
          ...state,
          scene: event.payload.scene,
        };

      case "SCENE_WAITING":
        return {
          ...state,
          status: event.payload.waitingForStudent
            ? "waiting_for_student"
            : "teaching",
          scene: {
            ...state.scene,
            status: "waiting",
          },
          student: {
            ...state.student,
            waitingForInput: event.payload.waitingForStudent,
          },
          timing: {
            ...state.timing,
            waitStartedAt: event.occurredAt,
            waitReason: event.payload.reason,
          },
        };

      case "SCENE_COMPLETED":
        return {
          ...state,
          scene: {
            ...state.scene,
            sceneId: event.payload.sceneId,
            status: "completed",
            completedAt: event.payload.completedAt,
            expectedOutcome:
              event.payload.outcome ?? state.scene.expectedOutcome,
            remainingSteps: 0,
          },
          progress: {
            ...state.progress,
            sceneProgress: 100,
          },
        };

      case "SCENE_SKIPPED":
        return {
          ...state,
          scene: {
            ...state.scene,
            sceneId: event.payload.sceneId,
            status: "skipped",
            expectedOutcome: event.payload.reason,
            remainingSteps: 0,
          },
        };

      case "WHITEBOARD_UPDATED":
        return {
          ...state,
          whiteboard: event.payload.whiteboard,
        };

      case "WHITEBOARD_CLEARED":
        return {
          ...state,
          whiteboard: {
            ...state.whiteboard,
            layout: "blank",
            blocks: [],
            highlightedBlockIds: [],
            activeBlockId: undefined,
            pointer: undefined,
            page: 1,
            totalPages: 1,
            scrollPosition: 0,
            animationState: "clearing",
            revision: event.payload.revision,
          },
        };

      case "WHITEBOARD_HIGHLIGHT_CHANGED":
        return {
          ...state,
          whiteboard: {
            ...state.whiteboard,
            highlightedBlockIds: event.payload.highlightedBlockIds,
            activeBlockId: event.payload.activeBlockId,
            animationState: "highlighting",
          },
        };

      case "TEACHER_STATE_UPDATED":
        return {
          ...state,
          teacher: event.payload.teacher,
        };

      case "TEACHER_STARTED_SPEAKING":
        return {
          ...state,
          status: "teaching",
          speech: {
            ...event.payload.speech,
            status: "speaking",
          },
          teacher: {
            ...state.teacher,
            isSpeaking: true,
            isListening: false,
            isThinking: false,
          },
          interaction: this.disableInteraction(
            state.interaction,
            "Elvy is speaking.",
          ),
        };

      case "TEACHER_SPEECH_PROGRESS":
        return {
          ...state,
          speech: {
            ...state.speech,
            status: "speaking",
            progress: event.payload.progress,
            currentSegmentIndex: event.payload.currentSegmentIndex,
          },
          teacher: {
            ...state.teacher,
            isSpeaking: true,
          },
        };

      case "TEACHER_FINISHED_SPEAKING":
        return {
          ...state,
          speech: {
            ...state.speech,
            status: "completed",
            progress: 100,
            completedAt: event.payload.completedAt,
          },
          teacher: {
            ...state.teacher,
            isSpeaking: false,
          },
        };

      case "TEACHER_STOPPED_SPEAKING":
        return {
          ...state,
          speech: {
            ...state.speech,
            status:
              event.payload.reason === "error" ? "error" : "cancelled",
          },
          teacher: {
            ...state.teacher,
            isSpeaking: false,
          },
        };

      case "STUDENT_INPUT_ENABLED":
        return {
          ...state,
          status: "waiting_for_student",
          student: {
            ...state.student,
            inputMode: selectPrimaryInputMode(
              event.payload.allowedInputModes,
            ),
            waitingForInput: true,
          },
          interaction: {
            ...state.interaction,
            inputEnabled: true,
            textInputEnabled:
              event.payload.allowedInputModes.includes("text"),
            voiceEnabled:
              event.payload.allowedInputModes.includes("voice"),
            choiceInputEnabled:
              event.payload.allowedInputModes.includes("choice"),
            boardInteractionEnabled:
              event.payload.allowedInputModes.includes("board"),
            submitEnabled: false,
            allowedInputModes: event.payload.allowedInputModes,
            disabledReason: undefined,
          },
        };

      case "STUDENT_INPUT_DISABLED":
        return {
          ...state,
          student: {
            ...state.student,
            waitingForInput: false,
            inputMode: "none",
          },
          interaction: this.disableInteraction(
            state.interaction,
            event.payload.reason ?? "Student input disabled.",
          ),
        };

      case "STUDENT_ANSWER_DRAFTED":
        return {
          ...state,
          student: {
            ...state.student,
            currentAnswer: event.payload.answer,
            answerStatus: "draft",
            inputMode: event.payload.inputMode,
            typingState:
              event.payload.inputMode === "text" ? "typing" : "idle",
          },
          interaction: {
            ...state.interaction,
            submitEnabled: event.payload.answer.trim().length > 0,
          },
        };

      case "STUDENT_ANSWER_RECEIVED":
        return {
          ...state,
          status: "evaluating",
          student: {
            ...state.student,
            currentAnswer: event.payload.answer,
            answerStatus: "submitted",
            inputMode: event.payload.inputMode,
            attemptCount: state.student.attemptCount + 1,
            waitingForInput: false,
            typingState: "submitted",
            microphoneState:
              event.payload.inputMode === "voice"
                ? "processing"
                : state.student.microphoneState,
            lastSubmissionAt: event.payload.submittedAt,
          },
          interaction: this.disableInteraction(
            state.interaction,
            "Answer is being evaluated.",
          ),
        };

      case "STUDENT_ANSWER_EVALUATED":
        return {
          ...state,
          status: "teaching",
          student: {
            ...state.student,
            answerStatus: event.payload.status,
            confidenceEstimate: event.payload.confidenceEstimate,
            microphoneState:
              state.student.microphoneState === "processing"
                ? "idle"
                : state.student.microphoneState,
          },
          notifications: event.payload.feedback
            ? [
                ...state.notifications,
                {
                  id: `${event.id}:feedback`,
                  kind: evaluationNotificationKind(
                    event.payload.status,
                  ),
                  message: event.payload.feedback,
                  createdAt: event.occurredAt,
                  dismissible: true,
                },
              ]
            : state.notifications,
        };

      case "STUDENT_SUPPORT_REQUESTED":
        return {
          ...state,
          status: "supporting",
          scene: {
            ...state.scene,
            status: "supporting",
          },
          teacher: {
            ...state.teacher,
            isThinking: true,
            emotion: "supportive",
          },
          interaction: this.disableInteraction(
            state.interaction,
            event.payload.reason,
          ),
        };

      case "STUDENT_SUPPORT_PROVIDED":
        return {
          ...state,
          status: "teaching",
          scene: {
            ...state.scene,
            status: "active",
          },
          teacher: {
            ...state.teacher,
            isThinking: false,
            emotion: "supportive",
          },
          notifications: event.payload.message
            ? [
                ...state.notifications,
                {
                  id: `${event.id}:support`,
                  kind: "encouragement",
                  message: event.payload.message,
                  createdAt: event.occurredAt,
                  dismissible: true,
                },
              ]
            : state.notifications,
        };

      case "PROGRESS_UPDATED": {
        const completedActivities =
          event.payload.completedActivities ??
          state.progress.completedActivities;
        const totalActivities =
          event.payload.totalActivities ??
          state.progress.totalActivities;

        return {
          ...state,
          progress: {
            ...state.progress,
            lessonProgress:
              event.payload.lessonProgress ??
              state.progress.lessonProgress,
            sceneProgress:
              event.payload.sceneProgress ??
              state.progress.sceneProgress,
            objectiveProgress:
              event.payload.objectiveProgress ??
              state.progress.objectiveProgress,
            masteryEstimate:
              event.payload.masteryEstimate ??
              state.progress.masteryEstimate,
            completedActivities,
            totalActivities,
            remainingActivities: Math.max(
              0,
              totalActivities - completedActivities,
            ),
          },
        };
      }

      case "MEMORY_UPDATED":
        return {
          ...state,
          memory: {
            ...state.memory,
            recentMistakes:
              event.payload.recentMistakes ??
              state.memory.recentMistakes,
            learnedConcepts:
              event.payload.learnedConcepts ??
              state.memory.learnedConcepts,
            reviewTargets:
              event.payload.reviewTargets ??
              state.memory.reviewTargets,
            lastPersistedAt:
              event.payload.persistedAt ??
              state.memory.lastPersistedAt,
            dirty: event.payload.persistedAt === undefined,
          },
        };

      case "NOTIFICATION_ADDED":
        return {
          ...state,
          notifications: [
            ...state.notifications,
            event.payload.notification,
          ],
        };

      case "NOTIFICATION_DISMISSED":
        return {
          ...state,
          notifications: state.notifications.filter(
            (notification) =>
              notification.id !== event.payload.notificationId,
          ),
        };

      case "ENGINE_HEALTH_CHANGED":
        this.updateEngineHealth(
          event.payload.engine,
          event.payload.health,
          event.occurredAt,
        );

        return {
          ...state,
          system: {
            ...state.system,
            engineHealth: {
              ...state.system.engineHealth,
              [event.payload.engine]: event.payload.health,
            },
          },
        };

      case "ENGINE_ERROR":
        this.recordError(event.payload.error);

        return {
          ...state,
          status: event.payload.error.recoverable
            ? state.status
            : "error",
          system: {
            ...state.system,
            errors: [...state.system.errors, event.payload.error],
            engineHealth: {
              ...state.system.engineHealth,
              [event.source]: event.payload.error.recoverable
                ? "degraded"
                : "unavailable",
            },
          },
        };

      case "SYSTEM_ERROR":
        this.recordError(event.payload.error);

        return {
          ...state,
          status: "error",
          interaction: this.disableInteraction(
            state.interaction,
            event.payload.error.message,
          ),
          system: {
            ...state.system,
            errors: [...state.system.errors, event.payload.error],
          },
        };

      default:
        return assertNever(event);
    }
  }

  private stampState(
    state: ClassroomState,
    event: ClassroomEvent,
  ): ClassroomState {
    const nextRevision = state.system.revision + 1;

    return {
      ...state,
      timing: {
        ...state.timing,
        lastUpdatedAt: event.occurredAt,
      },
      system: {
        ...state.system,
        synchronizationId: `${state.sessionId}:${event.sequence}:${event.id}`,
        revision: nextRevision,
        generatedAt: event.occurredAt,
        diagnostics: {
          ...(state.system.diagnostics ?? {}),
          lastEventId: event.id,
          lastEventType: event.type,
          lastEventSource: event.source,
          lastEventSequence: event.sequence,
        },
      },
    };
  }

  private publish(event: ClassroomEvent): void {
    this.diagnostics.publishedStates += 1;

    for (const listener of this.subscribers) {
      try {
        listener(this.state, event);
      } catch (error) {
        this.diagnostics.subscriberFailures += 1;
        this.addWarning({
          code: "SUBSCRIBER_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "A classroom state subscriber failed.",
          occurredAt: event.occurredAt,
          eventId: event.id,
          source: event.source,
        });
      }
    }
  }

  private rejectEvent(
    event: ClassroomEvent,
    errors: readonly ClassroomError[],
  ): void {
    this.diagnostics.rejectedEvents += 1;
    this.diagnostics.lastEvent = event;

    for (const error of errors) {
      this.recordError(error);
    }
  }

  private recordError(error: ClassroomError): void {
    this.diagnostics.errors.push(error);
    trimArray(
      this.diagnostics.errors,
      this.options.maxDiagnosticErrors,
    );
  }

  private addWarning(warning: ClassroomDirectorWarning): void {
    this.diagnostics.warnings.push(Object.freeze(warning));
    trimArray(
      this.diagnostics.warnings,
      this.options.maxDiagnosticWarnings,
    );
  }

  private updateEngineHealth(
    source: ClassroomEventSource,
    health: EngineHealth,
    occurredAt: ISODateTime,
  ): void {
    const current = this.engines.get(source);

    this.engines.set(
      source,
      Object.freeze({
        source,
        registeredAt: current?.registeredAt ?? occurredAt,
        health,
        version: current?.version,
      }),
    );
  }

  private disableInteraction(
    interaction: ClassroomState["interaction"],
    reason: string,
  ): ClassroomState["interaction"] {
    return {
      ...interaction,
      inputEnabled: false,
      textInputEnabled: false,
      voiceEnabled: false,
      choiceInputEnabled: false,
      boardInteractionEnabled: false,
      submitEnabled: false,
      allowedInputModes: [],
      disabledReason: reason,
    };
  }
}

/**
 * Backward-compatible alias matching the broader runtime terminology.
 */
export { ClassroomDirector as TeachingRuntime };

function deriveActiveClassroomStatus(
  state: ClassroomState,
): ClassroomStatus {
  if (state.student.waitingForInput) {
    return "waiting_for_student";
  }

  if (state.speech.status === "speaking") {
    return "teaching";
  }

  if (state.scene.status === "evaluating") {
    return "evaluating";
  }

  if (state.scene.status === "supporting") {
    return "supporting";
  }

  return "teaching";
}

function selectPrimaryInputMode(
  modes: readonly InputMode[],
): InputMode {
  const priority: readonly InputMode[] = [
    "text",
    "voice",
    "choice",
    "board",
  ];

  return priority.find((mode) => modes.includes(mode)) ?? "none";
}

function evaluationNotificationKind(
  status: ClassroomState["student"]["answerStatus"],
): "celebration" | "encouragement" | "information" {
  switch (status) {
    case "correct":
      return "celebration";

    case "partially_correct":
    case "incorrect":
    case "unclear":
      return "encouragement";

    default:
      return "information";
  }
}

function createDirectorError(input: {
  code: string;
  message: string;
  source: string;
  recoverable: boolean;
  occurredAt: ISODateTime;
}): ClassroomError {
  return Object.freeze({
    code: input.code,
    message: input.message,
    source: input.source,
    recoverable: input.recoverable,
    occurredAt: input.occurredAt,
  });
}

function trimArray<T>(items: T[], maximumLength: number): void {
  if (items.length <= maximumLength) {
    return;
  }

  items.splice(0, items.length - maximumLength);
}

function freezeClassroomState(state: ClassroomState): ClassroomState {
  return Object.freeze({
    ...state,
    lesson: Object.freeze({ ...state.lesson }),
    scene: Object.freeze({ ...state.scene }),
    objective: Object.freeze({ ...state.objective }),
    whiteboard: Object.freeze({
      ...state.whiteboard,
      blocks: Object.freeze(
        state.whiteboard.blocks.map((block) =>
          Object.freeze({ ...block }),
        ),
      ),
      highlightedBlockIds: Object.freeze([
        ...state.whiteboard.highlightedBlockIds,
      ]),
      pointer: state.whiteboard.pointer
        ? Object.freeze({ ...state.whiteboard.pointer })
        : undefined,
    }),
    teacher: Object.freeze({ ...state.teacher }),
    speech: Object.freeze({
      ...state.speech,
      segments: Object.freeze(
        state.speech.segments.map((segment) =>
          Object.freeze({ ...segment }),
        ),
      ),
      error: state.speech.error
        ? Object.freeze({ ...state.speech.error })
        : undefined,
    }),
    student: Object.freeze({ ...state.student }),
    interaction: Object.freeze({
      ...state.interaction,
      allowedInputModes: Object.freeze([
        ...state.interaction.allowedInputModes,
      ]),
    }),
    progress: Object.freeze({ ...state.progress }),
    timing: Object.freeze({ ...state.timing }),
    memory: Object.freeze({
      ...state.memory,
      recentMistakes: Object.freeze([
        ...state.memory.recentMistakes,
      ]),
      learnedConcepts: Object.freeze([
        ...state.memory.learnedConcepts,
      ]),
      reviewTargets: Object.freeze([
        ...state.memory.reviewTargets,
      ]),
    }),
    notifications: Object.freeze(
      state.notifications.map((notification) =>
        Object.freeze({ ...notification }),
      ),
    ),
    system: Object.freeze({
      ...state.system,
      engineHealth: Object.freeze({
        ...state.system.engineHealth,
      }),
      errors: Object.freeze(
        state.system.errors.map((error) =>
          Object.freeze({ ...error }),
        ),
      ),
      diagnostics: state.system.diagnostics
        ? Object.freeze({ ...state.system.diagnostics })
        : undefined,
    }),
  });
}

function assertNever(value: never): never {
  const eventType =
    typeof value === "object" &&
    value !== null &&
    "type" in value
      ? String((value as { readonly type: unknown }).type)
      : "unknown";

  throw new Error(`Unhandled ClassroomEvent type: ${eventType}`);
}
