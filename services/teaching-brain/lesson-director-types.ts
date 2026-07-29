/**
 * Elvy Teaching Engine
 * Sprint 1 — Lesson Director contract
 *
 * This file defines the stable language used by the Lesson Director.
 * It contains types only. It does not control the UI, generate lesson
 * content, call an AI model, or mutate lesson state.
 */

export type LessonStage =
  | "welcome"
  | "warm-up"
  | "objective"
  | "presentation"
  | "vocabulary"
  | "grammar"
  | "reading"
  | "listening"
  | "dialogue"
  | "guided-practice"
  | "independent-practice"
  | "production"
  | "review"
  | "assessment"
  | "complete";

export type SceneStatus =
  | "not-started"
  | "active"
  | "waiting-for-student"
  | "evaluating"
  | "paused"
  | "completed"
  | "skipped";

export type ObjectiveStatus =
  | "not-started"
  | "in-progress"
  | "achieved"
  | "needs-review";

export type SupportLevel = "none" | "light" | "guided" | "full";
export type ConfidenceLevel = "low" | "medium" | "high" | "unknown";

export type WaitingFor =
  | "none"
  | "student-answer"
  | "student-repeat"
  | "student-choice"
  | "student-speaking"
  | "student-writing"
  | "student-confirmation"
  | "teacher-action";

export type StudentTaskType =
  | "listen"
  | "read"
  | "repeat"
  | "answer"
  | "choose"
  | "match"
  | "complete"
  | "speak"
  | "write"
  | "observe"
  | "reflect";

export type LessonDirectorActionType =
  | "start-lesson"
  | "start-scene"
  | "continue-scene"
  | "ask-student"
  | "wait"
  | "repeat"
  | "rephrase"
  | "give-hint"
  | "give-example"
  | "model-answer"
  | "correct"
  | "encourage"
  | "increase-support"
  | "reduce-support"
  | "advance"
  | "review"
  | "pause"
  | "resume"
  | "complete-scene"
  | "complete-objective"
  | "complete-lesson";

export type WhiteboardMode =
  | "clear"
  | "title"
  | "objective"
  | "instructions"
  | "vocabulary"
  | "dialogue"
  | "grammar"
  | "reading"
  | "listening"
  | "exercise"
  | "question"
  | "feedback"
  | "summary"
  | "image"
  | "custom";

export type ElvyExpression =
  | "neutral"
  | "smile"
  | "encouraging"
  | "thinking"
  | "listening"
  | "correcting"
  | "celebrating"
  | "concerned";

export type ElvyGesture =
  | "idle"
  | "greet"
  | "point-board"
  | "point-item"
  | "listen"
  | "think"
  | "encourage"
  | "correct"
  | "celebrate"
  | "repeat"
  | "wait";

export type ResponseEvaluationResult =
  | "not-evaluated"
  | "correct"
  | "partially-correct"
  | "incorrect"
  | "unclear"
  | "off-topic"
  | "no-response";

export interface LessonIdentity {
  lessonId: string;
  packageId: string;
  courseId?: string;
  level?: string;
  sublevel?: string;
  unitId?: string;
  lessonTitle: string;
  version?: string;
}

export interface LessonObjectiveProgress {
  objectiveId: string;
  description: string;
  status: ObjectiveStatus;
  score: number;
  evidenceCount: number;
  requiredEvidenceCount: number;
  lastEvidenceAt?: string;
  notes?: string[];
}

export interface StudentErrorRecord {
  id: string;
  type:
    | "grammar"
    | "vocabulary"
    | "pronunciation"
    | "spelling"
    | "comprehension"
    | "task"
    | "other";
  sourceText?: string;
  correctedText?: string;
  objectiveId?: string;
  sceneId?: string;
  occurredAt: string;
  resolved: boolean;
}

export interface StudentState {
  studentId: string;
  displayName?: string;
  attemptsInCurrentTask: number;
  totalAttemptsInScene: number;
  supportLevel: SupportLevel;
  confidence: ConfidenceLevel;
  recentErrors: StudentErrorRecord[];
  strengths: string[];
  needsSupportWith: string[];
  preferredLanguage?: string;
  lastResponseAt?: string;
}

export interface StudentResponse {
  responseId: string;
  text?: string;
  selectedOptionIds?: string[];
  audioReference?: string;
  submittedAt: string;
  evaluation?: {
    result: ResponseEvaluationResult;
    score: number;
    feedback?: string;
    matchedCriteria?: string[];
    missedCriteria?: string[];
  };
}

export interface SceneProgress {
  sceneId: string;
  sceneType: LessonStage;
  title?: string;
  order: number;
  status: SceneStatus;
  enteredAt?: string;
  completedAt?: string;
  attempts: number;
  completedTaskIds: string[];
  activeTaskId?: string;
}

export interface LessonState {
  lesson: LessonIdentity;
  sessionId: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  currentStage: LessonStage;
  currentSceneId: string;
  currentSceneStatus: SceneStatus;
  sceneHistory: SceneProgress[];
  objectiveProgress: LessonObjectiveProgress[];
  studentState: StudentState;
  waitingFor: WaitingFor;
  lastStudentResponse?: StudentResponse;
  lastDirectorActionId?: string;
  elapsedSeconds: number;
  paused: boolean;
  completed: boolean;
  nextAllowedActions: LessonDirectorActionType[];
}

export interface TeachingPolicy {
  maxAttemptsBeforeHint: number;
  maxAttemptsBeforeModel: number;
  maxAttemptsBeforeReview: number;
  minimumObjectiveScore: number;
  requiredEvidencePerObjective: number;
  allowSceneSkipping: boolean;
  allowObjectiveSkipping: boolean;
  requireStudentResponseBeforeAdvance: boolean;
  languageSupportPolicy?: {
    allowL1Support: boolean;
    supportLanguage?: string;
    triggerAfterAttempts?: number;
  };
}

export interface LessonDirectorContext {
  lessonState: LessonState;
  lessonPackage: unknown;
  teachingPolicy: TeachingPolicy;
  externalEvaluation?: StudentResponse["evaluation"];
  now: string;
}

export interface ElvyInstruction {
  speech?: string;
  speechKey?: string;
  expression: ElvyExpression;
  gesture: ElvyGesture;
  speakAutomatically: boolean;
}

export interface WhiteboardInstruction {
  mode: WhiteboardMode;
  title?: string;
  content?: unknown;
  contentReference?: string;
  clearBeforeDisplay: boolean;
  highlightedItemIds?: string[];
  highlightedText?: string[];
  allowScroll?: boolean;
}

export interface StudentTaskInstruction {
  taskId: string;
  type: StudentTaskType;
  instruction: string;
  contentReference?: string;
  expectedResponse?: {
    type: "text" | "choice" | "speech" | "writing" | "confirmation";
    minLength?: number;
    maxLength?: number;
    optionIds?: string[];
  };
  required: boolean;
}

export interface EvaluationInstruction {
  evaluator:
    | "exact-match"
    | "keyword-match"
    | "semantic"
    | "grammar"
    | "pronunciation"
    | "rubric"
    | "objective-evidence"
    | "none";
  criteriaReference?: string;
  successScore: number;
  partialSuccessScore?: number;
  maxAttempts?: number;
  recordEvidenceForObjectiveIds?: string[];
}

export interface TransitionCondition {
  type:
    | "immediate"
    | "after-speech"
    | "after-student-response"
    | "after-correct-response"
    | "after-partial-or-correct-response"
    | "after-attempt-limit"
    | "after-objective-achieved"
    | "after-all-objectives-achieved"
    | "manual";
  targetSceneId?: string;
  targetAction?: LessonDirectorActionType;
  objectiveId?: string;
  attemptLimit?: number;
}

export interface LessonDirectorDecision {
  decisionId: string;
  createdAt: string;
  actionType: LessonDirectorActionType;
  reasonCode:
    | "lesson-start"
    | "scene-start"
    | "scene-complete"
    | "response-correct"
    | "response-partial"
    | "response-incorrect"
    | "response-unclear"
    | "no-response"
    | "attempt-limit"
    | "objective-achieved"
    | "objective-needs-review"
    | "all-objectives-achieved"
    | "manual-control"
    | "safety-fallback";
  currentSceneId: string;
  nextSceneId?: string;
  elvy: ElvyInstruction;
  whiteboard: WhiteboardInstruction;
  studentTask?: StudentTaskInstruction;
  evaluation?: EvaluationInstruction;
  transition: TransitionCondition;
  statePatch: Partial<
    Pick<
      LessonState,
      | "currentStage"
      | "currentSceneId"
      | "currentSceneStatus"
      | "waitingFor"
      | "paused"
      | "completed"
      | "completedAt"
      | "lastDirectorActionId"
      | "updatedAt"
    >
  >;
  diagnostics?: {
    warnings: string[];
    notes: string[];
  };
}

/**
 * A pure Lesson Director receives context and returns one structured decision.
 * It must not mutate the supplied context.
 */
export type LessonDirector = (
  context: Readonly<LessonDirectorContext>,
) => LessonDirectorDecision;
