/**
 * ELVY Teaching Engine
 * TE-500 — Classroom State
 *
 * The single, renderer-independent source of truth for the live classroom.
 *
 * Rules:
 * - This file contains types only.
 * - It must not import React, UI components, database clients, or AI services.
 * - Educational decisions remain owned by their respective engines.
 * - The Classroom Director composes these sections into one ClassroomState.
 */

export type ClassroomIdentifier = string;
export type ISODateTime = string;
export type Milliseconds = number;
export type Percentage = number;

export type ClassroomStatus =
  | "idle"
  | "initializing"
  | "ready"
  | "teaching"
  | "waiting_for_student"
  | "evaluating"
  | "supporting"
  | "paused"
  | "completed"
  | "error";

export type LessonStatus =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed"
  | "blocked"
  | "error";

export type SceneStatus =
  | "not_started"
  | "active"
  | "waiting"
  | "evaluating"
  | "supporting"
  | "completed"
  | "skipped"
  | "error";

export type ObjectiveStatus =
  | "not_started"
  | "in_progress"
  | "needs_support"
  | "mastered"
  | "completed";

export type StudentAnswerStatus =
  | "none"
  | "draft"
  | "submitted"
  | "correct"
  | "partially_correct"
  | "incorrect"
  | "unclear"
  | "not_evaluated";

export type InputMode = "text" | "voice" | "choice" | "board" | "none";

export type TeacherExpression =
  | "neutral"
  | "smile"
  | "encouraging"
  | "thinking"
  | "listening"
  | "concerned"
  | "celebrating"
  | "correcting";

export type TeacherGesture =
  | "idle"
  | "wave"
  | "point_board"
  | "point_left"
  | "point_right"
  | "open_hand"
  | "encourage"
  | "clap"
  | "think"
  | "listen"
  | "none";

export type TeacherBodyPose =
  | "standing"
  | "leaning_forward"
  | "stepping_to_board"
  | "stepping_back"
  | "celebrating"
  | "idle";

export type TeacherHeadDirection =
  | "student"
  | "whiteboard"
  | "left"
  | "right"
  | "forward";

export type TeacherEyeFocus =
  | "student"
  | "whiteboard"
  | "content"
  | "neutral";

export type TeacherEmotion =
  | "calm"
  | "warm"
  | "encouraging"
  | "focused"
  | "supportive"
  | "celebratory";

export type SpeechStatus =
  | "idle"
  | "queued"
  | "speaking"
  | "paused"
  | "completed"
  | "cancelled"
  | "error";

export type WhiteboardVisibility = "hidden" | "visible" | "dimmed";

export type WhiteboardLayout =
  | "blank"
  | "title"
  | "single_column"
  | "two_column"
  | "cards"
  | "dialogue"
  | "reading"
  | "exercise"
  | "image_focus"
  | "custom";

export type WhiteboardBlockType =
  | "heading"
  | "text"
  | "example"
  | "instruction"
  | "question"
  | "answer"
  | "vocabulary"
  | "grammar"
  | "dialogue"
  | "image"
  | "audio"
  | "divider"
  | "highlight"
  | "custom";

export type WhiteboardAnimationState =
  | "idle"
  | "entering"
  | "highlighting"
  | "scrolling"
  | "changing_page"
  | "clearing";

export type NotificationKind =
  | "information"
  | "encouragement"
  | "celebration"
  | "warning"
  | "error";

export type EngineHealth = "healthy" | "degraded" | "unavailable";

export interface ClassroomState {
  readonly classroomId: ClassroomIdentifier;
  readonly sessionId: ClassroomIdentifier;
  readonly status: ClassroomStatus;

  readonly lesson: ClassroomLessonState;
  readonly scene: ClassroomSceneState;
  readonly objective: ClassroomObjectiveState;
  readonly whiteboard: ClassroomWhiteboardState;
  readonly teacher: ClassroomTeacherState;
  readonly speech: ClassroomSpeechState;
  readonly student: ClassroomStudentState;
  readonly interaction: ClassroomInteractionState;
  readonly progress: ClassroomProgressState;
  readonly timing: ClassroomTimingState;
  readonly memory: ClassroomMemoryState;
  readonly notifications: readonly ClassroomNotification[];
  readonly system: ClassroomSystemState;
}

export interface ClassroomLessonState {
  readonly lessonId: ClassroomIdentifier;
  readonly packageId?: ClassroomIdentifier;
  readonly title: string;
  readonly courseTitle?: string;
  readonly level?: string;
  readonly sublevel?: string;
  readonly unitId?: ClassroomIdentifier;
  readonly unitTitle?: string;
  readonly lessonNumber?: number;
  readonly status: LessonStatus;
  readonly startedAt?: ISODateTime;
  readonly completedAt?: ISODateTime;
}

export interface ClassroomSceneState {
  readonly sceneId: ClassroomIdentifier;
  readonly sceneType: string;
  readonly title?: string;
  readonly status: SceneStatus;
  readonly currentStepId?: ClassroomIdentifier;
  readonly currentStepIndex: number;
  readonly totalSteps: number;
  readonly remainingSteps: number;
  readonly expectedOutcome?: string;
  readonly startedAt?: ISODateTime;
  readonly completedAt?: ISODateTime;
}

export interface ClassroomObjectiveState {
  readonly objectiveId?: ClassroomIdentifier;
  readonly text?: string;
  readonly status: ObjectiveStatus;
  readonly evidenceCount: number;
  readonly requiredEvidenceCount?: number;
  readonly masteryEstimate?: Percentage;
}

export interface ClassroomWhiteboardState {
  readonly visibility: WhiteboardVisibility;
  readonly layout: WhiteboardLayout;
  readonly title?: string;
  readonly blocks: readonly ClassroomWhiteboardBlock[];
  readonly highlightedBlockIds: readonly ClassroomIdentifier[];
  readonly activeBlockId?: ClassroomIdentifier;
  readonly pointer?: ClassroomWhiteboardPointer;
  readonly page: number;
  readonly totalPages: number;
  readonly scrollPosition: number;
  readonly animationState: WhiteboardAnimationState;
  readonly revision: number;
}

export interface ClassroomWhiteboardBlock {
  readonly id: ClassroomIdentifier;
  readonly type: WhiteboardBlockType;
  readonly text?: string;
  readonly contentReference?: string;
  readonly imageUrl?: string;
  readonly altText?: string;
  readonly language?: string;
  readonly order: number;
  readonly visible: boolean;
  readonly highlighted?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ClassroomWhiteboardPointer {
  readonly visible: boolean;
  readonly blockId?: ClassroomIdentifier;
  readonly x?: number;
  readonly y?: number;
}

export interface ClassroomTeacherState {
  readonly expression: TeacherExpression;
  readonly gesture: TeacherGesture;
  readonly bodyPose: TeacherBodyPose;
  readonly headDirection: TeacherHeadDirection;
  readonly eyeFocus: TeacherEyeFocus;
  readonly emotion: TeacherEmotion;
  readonly animation?: string;
  readonly isListening: boolean;
  readonly isThinking: boolean;
  readonly isSpeaking: boolean;
}

export interface ClassroomSpeechState {
  readonly status: SpeechStatus;
  readonly text: string;
  readonly segments: readonly ClassroomSpeechSegment[];
  readonly currentSegmentIndex: number;
  readonly language: string;
  readonly voiceId?: string;
  readonly speed: number;
  readonly progress: Percentage;
  readonly startedAt?: ISODateTime;
  readonly completedAt?: ISODateTime;
  readonly error?: ClassroomError;
}

export interface ClassroomSpeechSegment {
  readonly id: ClassroomIdentifier;
  readonly text: string;
  readonly order: number;
  readonly pauseAfterMs?: Milliseconds;
  readonly boardBlockId?: ClassroomIdentifier;
  readonly gesture?: TeacherGesture;
  readonly expression?: TeacherExpression;
}

export interface ClassroomStudentState {
  readonly studentId?: ClassroomIdentifier;
  readonly displayName?: string;
  readonly inputMode: InputMode;
  readonly currentAnswer: string;
  readonly answerStatus: StudentAnswerStatus;
  readonly confidenceEstimate?: Percentage;
  readonly attemptCount: number;
  readonly waitingForInput: boolean;
  readonly microphoneState: "unavailable" | "idle" | "listening" | "processing" | "error";
  readonly typingState: "idle" | "typing" | "submitted";
  readonly lastSubmissionAt?: ISODateTime;
}

export interface ClassroomInteractionState {
  readonly inputEnabled: boolean;
  readonly textInputEnabled: boolean;
  readonly voiceEnabled: boolean;
  readonly choiceInputEnabled: boolean;
  readonly boardInteractionEnabled: boolean;
  readonly menuEnabled: boolean;
  readonly submitEnabled: boolean;
  readonly pauseEnabled: boolean;
  readonly allowedInputModes: readonly InputMode[];
  readonly disabledReason?: string;
}

export interface ClassroomProgressState {
  readonly lessonProgress: Percentage;
  readonly sceneProgress: Percentage;
  readonly objectiveProgress: Percentage;
  readonly masteryEstimate?: Percentage;
  readonly completedActivities: number;
  readonly totalActivities: number;
  readonly remainingActivities: number;
}

export interface ClassroomTimingState {
  readonly sessionStartedAt?: ISODateTime;
  readonly lessonStartedAt?: ISODateTime;
  readonly sceneStartedAt?: ISODateTime;
  readonly lastUpdatedAt: ISODateTime;
  readonly expectedSceneFinishAt?: ISODateTime;
  readonly idleTimeMs: Milliseconds;
  readonly waitStartedAt?: ISODateTime;
  readonly waitReason?: string;
}

export interface ClassroomMemoryState {
  readonly recentMistakes: readonly ClassroomMemoryItem[];
  readonly learnedConcepts: readonly ClassroomMemoryItem[];
  readonly reviewTargets: readonly ClassroomMemoryItem[];
  readonly studentHistoryReference?: ClassroomIdentifier;
  readonly lastPersistedAt?: ISODateTime;
  readonly dirty: boolean;
}

export interface ClassroomMemoryItem {
  readonly id: ClassroomIdentifier;
  readonly concept: string;
  readonly note?: string;
  readonly confidence?: Percentage;
  readonly recordedAt: ISODateTime;
}

export interface ClassroomNotification {
  readonly id: ClassroomIdentifier;
  readonly kind: NotificationKind;
  readonly message: string;
  readonly createdAt: ISODateTime;
  readonly expiresAt?: ISODateTime;
  readonly dismissible: boolean;
}

export interface ClassroomSystemState {
  readonly teachingEngineVersion: string;
  readonly classroomStateVersion: string;
  readonly synchronizationId: ClassroomIdentifier;
  readonly revision: number;
  readonly generatedAt: ISODateTime;
  readonly engineHealth: Readonly<Record<string, EngineHealth>>;
  readonly errors: readonly ClassroomError[];
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export interface ClassroomError {
  readonly code: string;
  readonly message: string;
  readonly source: string;
  readonly recoverable: boolean;
  readonly occurredAt: ISODateTime;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Creates the smallest valid classroom state.
 *
 * This helper is intentionally deterministic apart from the caller-provided
 * timestamp and identifiers. The Classroom Director may use it when starting
 * a new classroom session.
 */
export function createInitialClassroomState(input: {
  classroomId: ClassroomIdentifier;
  sessionId: ClassroomIdentifier;
  lessonId: ClassroomIdentifier;
  lessonTitle: string;
  sceneId: ClassroomIdentifier;
  sceneType: string;
  now: ISODateTime;
  teachingEngineVersion?: string;
  synchronizationId?: ClassroomIdentifier;
}): ClassroomState {
  return {
    classroomId: input.classroomId,
    sessionId: input.sessionId,
    status: "initializing",

    lesson: {
      lessonId: input.lessonId,
      title: input.lessonTitle,
      status: "not_started",
    },

    scene: {
      sceneId: input.sceneId,
      sceneType: input.sceneType,
      status: "not_started",
      currentStepIndex: 0,
      totalSteps: 0,
      remainingSteps: 0,
    },

    objective: {
      status: "not_started",
      evidenceCount: 0,
    },

    whiteboard: {
      visibility: "hidden",
      layout: "blank",
      blocks: [],
      highlightedBlockIds: [],
      page: 1,
      totalPages: 1,
      scrollPosition: 0,
      animationState: "idle",
      revision: 0,
    },

    teacher: {
      expression: "neutral",
      gesture: "idle",
      bodyPose: "standing",
      headDirection: "student",
      eyeFocus: "student",
      emotion: "calm",
      isListening: false,
      isThinking: false,
      isSpeaking: false,
    },

    speech: {
      status: "idle",
      text: "",
      segments: [],
      currentSegmentIndex: -1,
      language: "en",
      speed: 1,
      progress: 0,
    },

    student: {
      inputMode: "none",
      currentAnswer: "",
      answerStatus: "none",
      attemptCount: 0,
      waitingForInput: false,
      microphoneState: "idle",
      typingState: "idle",
    },

    interaction: {
      inputEnabled: false,
      textInputEnabled: false,
      voiceEnabled: false,
      choiceInputEnabled: false,
      boardInteractionEnabled: false,
      menuEnabled: true,
      submitEnabled: false,
      pauseEnabled: false,
      allowedInputModes: [],
    },

    progress: {
      lessonProgress: 0,
      sceneProgress: 0,
      objectiveProgress: 0,
      completedActivities: 0,
      totalActivities: 0,
      remainingActivities: 0,
    },

    timing: {
      lastUpdatedAt: input.now,
      idleTimeMs: 0,
    },

    memory: {
      recentMistakes: [],
      learnedConcepts: [],
      reviewTargets: [],
      dirty: false,
    },

    notifications: [],

    system: {
      teachingEngineVersion: input.teachingEngineVersion ?? "1.0.0",
      classroomStateVersion: "1.0.0",
      synchronizationId:
        input.synchronizationId ??
        `${input.sessionId}:${input.sceneId}:0`,
      revision: 0,
      generatedAt: input.now,
      engineHealth: {},
      errors: [],
    },
  };
}

/**
 * Performs lightweight structural validation.
 *
 * Detailed ownership and synchronization validation belongs in the
 * Classroom Director.
 */
export function validateClassroomState(
  state: ClassroomState,
): readonly string[] {
  const errors: string[] = [];

  if (!state.classroomId.trim()) {
    errors.push("classroomId is required.");
  }

  if (!state.sessionId.trim()) {
    errors.push("sessionId is required.");
  }

  if (!state.lesson.lessonId.trim()) {
    errors.push("lesson.lessonId is required.");
  }

  if (!state.scene.sceneId.trim()) {
    errors.push("scene.sceneId is required.");
  }

  if (state.scene.currentStepIndex < 0) {
    errors.push("scene.currentStepIndex cannot be negative.");
  }

  if (state.scene.totalSteps < 0) {
    errors.push("scene.totalSteps cannot be negative.");
  }

  if (state.scene.remainingSteps < 0) {
    errors.push("scene.remainingSteps cannot be negative.");
  }

  if (state.whiteboard.page < 1) {
    errors.push("whiteboard.page must be at least 1.");
  }

  if (state.whiteboard.totalPages < 1) {
    errors.push("whiteboard.totalPages must be at least 1.");
  }

  if (state.whiteboard.page > state.whiteboard.totalPages) {
    errors.push("whiteboard.page cannot exceed whiteboard.totalPages.");
  }

  if (
    state.speech.currentSegmentIndex < -1 ||
    state.speech.currentSegmentIndex >= state.speech.segments.length
  ) {
    errors.push("speech.currentSegmentIndex is outside the segment range.");
  }

  validatePercentage(
    "progress.lessonProgress",
    state.progress.lessonProgress,
    errors,
  );
  validatePercentage(
    "progress.sceneProgress",
    state.progress.sceneProgress,
    errors,
  );
  validatePercentage(
    "progress.objectiveProgress",
    state.progress.objectiveProgress,
    errors,
  );
  validatePercentage("speech.progress", state.speech.progress, errors);

  if (state.progress.masteryEstimate !== undefined) {
    validatePercentage(
      "progress.masteryEstimate",
      state.progress.masteryEstimate,
      errors,
    );
  }

  if (state.objective.masteryEstimate !== undefined) {
    validatePercentage(
      "objective.masteryEstimate",
      state.objective.masteryEstimate,
      errors,
    );
  }

  return errors;
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
