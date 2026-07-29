/**
 * Elvy Lesson Director — shared contracts
 *
 * Stable contracts shared by the Lesson Director, Scene Engine,
 * Strategy Engine, Teaching Script Engine, and Classroom Director.
 *
 * No database, OpenAI, React, Supabase, or API-route concerns belong here.
 */

export type LessonDirectorStatus =
  | "IDLE"
  | "STARTING"
  | "TEACHING"
  | "PRACTISING"
  | "REVIEWING"
  | "ASSESSING"
  | "COMPLETED"
  | "PAUSED";

export type LessonSceneKind =
  | "WARM_UP"
  | "PRESENTATION"
  | "GUIDED_PRACTICE"
  | "INDEPENDENT_PRACTICE"
  | "PRODUCTION"
  | "ASSESSMENT"
  | "WRAP_UP";

export type TeachingStrategyKind =
  | "VOCABULARY"
  | "GRAMMAR"
  | "LISTENING"
  | "SPEAKING"
  | "READING"
  | "WRITING"
  | "PRONUNCIATION"
  | "REVIEW"
  | "ENCOURAGEMENT";

export type DirectorAction =
  | "START_LESSON"
  | "CONTINUE_SCENE"
  | "REPEAT_SCENE"
  | "SIMPLIFY"
  | "GIVE_SUPPORT"
  | "MOVE_TO_NEXT_SCENE"
  | "REVIEW"
  | "ASSESS"
  | "PAUSE"
  | "RESUME"
  | "COMPLETE_LESSON";

export type StudentResponseQuality =
  | "NOT_EVALUATED"
  | "NO_RESPONSE"
  | "INCORRECT"
  | "PARTIALLY_CORRECT"
  | "CORRECT"
  | "MASTERED";

export type SupportLevel = "NONE" | "LIGHT" | "GUIDED" | "INTENSIVE";

export type ClassroomChannel =
  | "WHITEBOARD"
  | "VOICE"
  | "AVATAR"
  | "CHAT";

export type WhiteboardActionKind =
  | "KEEP"
  | "CLEAR"
  | "SHOW_TITLE"
  | "SHOW_TEXT"
  | "SHOW_VOCABULARY"
  | "SHOW_EXAMPLE"
  | "SHOW_QUESTION"
  | "SHOW_FEEDBACK"
  | "HIGHLIGHT"
  | "REVEAL"
  | "HIDE";

export type AvatarActionKind =
  | "IDLE"
  | "LISTEN"
  | "SPEAK"
  | "SMILE"
  | "ENCOURAGE"
  | "THINK"
  | "POINT_TO_BOARD"
  | "WAVE"
  | "CELEBRATE";

export type VoiceActionKind =
  | "SILENT"
  | "SPEAK"
  | "REPEAT"
  | "MODEL_PRONUNCIATION";

export type ChatActionKind =
  | "NONE"
  | "SHOW_MESSAGE"
  | "ASK_QUESTION"
  | "SHOW_FEEDBACK";

export interface LessonObjectiveRef {
  readonly id: string;
  readonly title: string;
  readonly required: boolean;
}

export interface LessonSceneDefinition {
  readonly id: string;
  readonly kind: LessonSceneKind;
  readonly title: string;
  readonly order: number;
  readonly objectiveIds: readonly string[];
  readonly preferredStrategies: readonly TeachingStrategyKind[];
  readonly minimumTurns?: number;
  readonly maximumTurns?: number;
  readonly required: boolean;
}

export interface LessonDirectorProgress {
  readonly completedSceneIds: readonly string[];
  readonly completedObjectiveIds: readonly string[];
  readonly currentSceneTurnCount: number;
  readonly totalTurnCount: number;
  readonly consecutiveCorrectAnswers: number;
  readonly consecutiveIncorrectAnswers: number;
  readonly reviewCount: number;
}

export interface StudentLearningSignal {
  readonly responseQuality: StudentResponseQuality;
  readonly confidence?: number;
  readonly engagement?: number;
  readonly needsSupport: boolean;
  readonly supportLevel: SupportLevel;
  readonly detectedDifficulty?: string;
  readonly completedObjectiveIds?: readonly string[];
}

export interface LessonDirectorState {
  readonly sessionId: string;
  readonly lessonId: string;
  readonly studentId: string;
  readonly status: LessonDirectorStatus;
  readonly currentSceneId: string | null;
  readonly currentSceneKind: LessonSceneKind | null;
  readonly activeStrategy: TeachingStrategyKind | null;
  readonly progress: LessonDirectorProgress;
  readonly revision: number;
  readonly startedAt: string | null;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export interface LessonDirectorContext {
  readonly state: LessonDirectorState;
  readonly scenes: readonly LessonSceneDefinition[];
  readonly objectives: readonly LessonObjectiveRef[];
  readonly studentSignal: StudentLearningSignal;
  readonly lessonCompletedByTeachingBrain: boolean;
  readonly requestedAction?: DirectorAction;
}

export interface WhiteboardInstruction {
  readonly channel: "WHITEBOARD";
  readonly action: WhiteboardActionKind;
  readonly content?: string;
  readonly targetId?: string;
  readonly emphasis?: "LOW" | "MEDIUM" | "HIGH";
}

export interface AvatarInstruction {
  readonly channel: "AVATAR";
  readonly action: AvatarActionKind;
  readonly durationMs?: number;
}

export interface VoiceInstruction {
  readonly channel: "VOICE";
  readonly action: VoiceActionKind;
  readonly text?: string;
  readonly pace?: "SLOW" | "NORMAL";
}

export interface ChatInstruction {
  readonly channel: "CHAT";
  readonly action: ChatActionKind;
  readonly text?: string;
}

export type ClassroomInstruction =
  | WhiteboardInstruction
  | AvatarInstruction
  | VoiceInstruction
  | ChatInstruction;

export interface LessonDirectorDecision {
  readonly action: DirectorAction;
  readonly nextStatus: LessonDirectorStatus;
  readonly nextSceneId: string | null;
  readonly nextSceneKind: LessonSceneKind | null;
  readonly strategy: TeachingStrategyKind | null;
  readonly supportLevel: SupportLevel;
  readonly waitForStudentResponse: boolean;
  readonly repeatCurrentScene: boolean;
  readonly requiresReview: boolean;
  readonly finishLesson: boolean;
  readonly reason: string;
}

export interface LessonDirectorResult {
  readonly previousState: LessonDirectorState;
  readonly nextState: LessonDirectorState;
  readonly decision: LessonDirectorDecision;
  readonly classroomInstructions: readonly ClassroomInstruction[];
  readonly emittedEvents: readonly LessonDirectorEvent[];
}

export type LessonDirectorEventType =
  | "LESSON_STARTED"
  | "SCENE_STARTED"
  | "SCENE_REPEATED"
  | "SCENE_COMPLETED"
  | "STRATEGY_CHANGED"
  | "SUPPORT_REQUESTED"
  | "REVIEW_STARTED"
  | "ASSESSMENT_STARTED"
  | "LESSON_PAUSED"
  | "LESSON_RESUMED"
  | "LESSON_COMPLETED";

export interface LessonDirectorEvent {
  readonly type: LessonDirectorEventType;
  readonly sessionId: string;
  readonly lessonId: string;
  readonly sceneId?: string;
  readonly sceneKind?: LessonSceneKind;
  readonly strategy?: TeachingStrategyKind;
  readonly occurredAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CreateLessonDirectorStateInput {
  readonly sessionId: string;
  readonly lessonId: string;
  readonly studentId: string;
  readonly now?: string;
}

export interface LessonDirectorError {
  readonly code:
    | "INVALID_INPUT"
    | "INVALID_STATE"
    | "SCENE_NOT_FOUND"
    | "NO_SCENES"
    | "LESSON_ALREADY_COMPLETED"
    | "DIRECTOR_FAILED";
  readonly message: string;
  readonly recoverable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type LessonDirectorExecutionResult =
  | {
      readonly ok: true;
      readonly data: LessonDirectorResult;
    }
  | {
      readonly ok: false;
      readonly error: LessonDirectorError;
    };

export function createInitialLessonDirectorState(
  input: CreateLessonDirectorStateInput,
): LessonDirectorState {
  const now = input.now ?? new Date().toISOString();

  return {
    sessionId: input.sessionId,
    lessonId: input.lessonId,
    studentId: input.studentId,
    status: "IDLE",
    currentSceneId: null,
    currentSceneKind: null,
    activeStrategy: null,
    progress: {
      completedSceneIds: [],
      completedObjectiveIds: [],
      currentSceneTurnCount: 0,
      totalTurnCount: 0,
      consecutiveCorrectAnswers: 0,
      consecutiveIncorrectAnswers: 0,
      reviewCount: 0,
    },
    revision: 0,
    startedAt: null,
    updatedAt: now,
    completedAt: null,
  };
}

export function isTerminalLessonDirectorState(
  state: LessonDirectorState,
): boolean {
  return state.status === "COMPLETED";
}

export function getOrderedLessonScenes(
  scenes: readonly LessonSceneDefinition[],
): readonly LessonSceneDefinition[] {
  return [...scenes].sort((left, right) => left.order - right.order);
}
