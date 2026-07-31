export const READY_PACKAGE_SCHEMA_VERSION = 1;

export type ReadyPackageAssetType =
  | "textbook-image"
  | "textbook-page"
  | "image"
  | "flashcard"
  | "grammar-chart"
  | "speaking-prompt"
  | "reading-text"
  | "dialogue"
  | "worksheet"
  | "exercise"
  | "assessment"
  | "whiteboard-slide"
  | "audio"
  | "video"
  | "document"
  | "other";

export type ReadyPackageAsset = {
  id: string;

  lessonId: string;

  type: ReadyPackageAssetType;

  title: string;

  purpose: string;

  file: string;

  mimeType?: string;

  pageNumber?: number;

  sourcePageRange?: string;

  textbookReference?: string;

  origin:
    | "textbook"
    | "founder"
    | "ai-generated";

  preserveOriginal: boolean;

  stage?:
    | "Warm-up"
    | "Presentation"
    | "Practice"
    | "Production"
    | "Assessment"
    | "Homework";

  displayMode?:
    | "fullscreen"
    | "side-panel"
    | "popup"
    | "background"
    | "whiteboard";

  whiteboardPriority?: number;

  elvyInstruction?: string;

  learnerInstruction?: string;

  expectedAnswer?: string;

  duration?: string;

  order?: number;

  altText?: string;

  keywords?: string[];
};

export type ReadyPackageLesson = {
  id: string;
  label: string;
  title: string;
  order: number;
  pageRange?: string;
  duration?: string;
  teacherPlanId: string;
  elvyBlueprintId: string;
  assetIds?: string[];
};

export type ReadyPackageUnit = {
  id: string;
  label: string;
  title: string;
  order: number;
  lessons: ReadyPackageLesson[];
};

export type ReadyPackageCurriculum = {
  levelId: string;
  levelTitle: string;
  sublevelId: string;
  sublevelTitle: string;
  units: ReadyPackageUnit[];
};

export type ReadyPackageTeacherPlan = {
  id: string;
  lessonId: string;
  plan: Record<string, unknown>;
};

export type ReadyPackageBlueprintObjective = {
  id: string;
  description: string;
  evidence: string;
};

export type ReadyPackageWhiteboardItem = {
  text: string;
  meaning?: string;
  pronunciationSupport?: string;
};

export type ReadyPackageWhiteboardDialogueLine = {
  speaker: string;
  text: string;
};

export type ReadyPackageWhiteboardBlock = {
  id: string;
  type: string;
  heading?: string;
  text?: string;
  items?: ReadyPackageWhiteboardItem[];
  lines?: ReadyPackageWhiteboardDialogueLine[];
};

export type ReadyPackageSceneWhiteboard = {
  boardId: string;
  title: string;
  instruction: string;
  blocks: ReadyPackageWhiteboardBlock[];
  clearPolicy?: string;
  highlightSequence?: string[];
};

export type ReadyPackageTeacherTurnDelivery = {
  tone?: string;
  pace?: string;
  pauseAfterMs?: number;
};

export type ReadyPackageTeacherTurnWhiteboardAction = {
  type: string;
  target?: string;
};

export type ReadyPackageTeacherTurn = {
  turnId: string;
  action: string;
  text: string;
  waitForLearner: boolean;
  expectedActivityId?: string | null;
  delivery?: ReadyPackageTeacherTurnDelivery;
  whiteboardAction?: ReadyPackageTeacherTurnWhiteboardAction;
};

export type ReadyPackageBlueprintCommonError = {
  pattern: string;
  errorType: string;
  feedback: string;
};

export type ReadyPackageBlueprintEvaluation = {
  mode: string;
  passRule: string;
  partialRule: string;
  failRule: string;
};

export type ReadyPackageBlueprintFeedback = {
  success: string;
  partial: string;
  incorrect: string;
};

export type ReadyPackageBlueprintHint = {
  level: number;
  type: string;
  content: string;
};

export type ReadyPackageBlueprintActivityTransition = {
  action: string;
  nextActivityId?: string | null;
  recoveryActivityId?: string | null;
};

export type ReadyPackageBlueprintEvidence = {
  objectiveId: string;
  evidenceType: string;
  masteryWeight: number;
};

export type ReadyPackageBlueprintActivity = {
  activityId: string;
  type: string;
  objectiveIds: string[];
  prompt: string;
  inputMode: string;

  expectedAnswers?: string[];
  correctAnswer?: string;
  acceptedVariants?: string[];
  options?: string[];

  meaningCriteria?: string[];
  pronunciationTargets?: string[];
  commonErrors?: ReadyPackageBlueprintCommonError[];

  evaluation: ReadyPackageBlueprintEvaluation;
  feedback: ReadyPackageBlueprintFeedback;
  hints: ReadyPackageBlueprintHint[];

  retryLimit: number;
  onSuccess: ReadyPackageBlueprintActivityTransition;
  onFailure: ReadyPackageBlueprintActivityTransition;
  evidence: ReadyPackageBlueprintEvidence;
};

export type ReadyPackageBlueprintScene = {
  sceneId: string;
  title: string;
  purpose: string;

  objectiveIds: string[];
  activityIds: string[];

  entryCondition: string;
  completionCondition: string;

  nextSceneId?: string | null;
  recoverySceneId?: string | null;

  whiteboard: ReadyPackageSceneWhiteboard;
  teacherTurns: ReadyPackageTeacherTurn[];
  activities: ReadyPackageBlueprintActivity[];
  assetIds: string[];
};

export type ReadyPackageStageCompletionRule = {
  requiredSceneIds: string[];
  minimumObjectiveEvidence: number;
  allowSupportedCompletion: boolean;
};

export type ReadyPackageBlueprintStage = {
  stage:
    | "Warm-up"
    | "Presentation"
    | "Practice"
    | "Production"
    | "Assessment"
    | "Homework";

  duration: string;
  teachingObjective: string;

  /**
   * Compatibility field used by the current Lesson Plan Studio.
   * New packages may keep either one board summary or several lines.
   */
  whiteboardPlan: string | string[];

  /**
   * Compatibility summary used by older Studio and runtime code.
   * Exact executable teacher turns live inside scenes.
   */
  elvyScript: string;

  learnerTaskSequence: string[];
  expectedResponses: string[];
  evaluationCriteria: string;
  feedbackStrategy: string;
  supportLadder: string[];
  successCriteria: string[];
  retryLimit: number;
  successAction: string;
  recoveryAction: string;
  transition: string;

  /** Executable Blueprint v1.4 fields. */
  stageId?: string;
  objectiveIds?: string[];
  scenes?: ReadyPackageBlueprintScene[];
  stageCompletionRule?: ReadyPackageStageCompletionRule;

  // Optional compatibility field for older packages.
  instructions?: string;
};

export type ReadyPackageNativeLanguageSupportItem = {
  supportId: string;
  purpose: string;
  targetLanguageText: string;
  translationKey: string;
};

export type ReadyPackageNativeLanguageSupport = {
  enabled: boolean;
  activationRules: string[];
  maximumConsecutiveL1Turns: number;
  returnToTargetLanguageImmediately: boolean;
  supportItems: ReadyPackageNativeLanguageSupportItem[];
};

export type ReadyPackageAdaptationRules = {
  whenStruggling: string[];
  whenSuccessful: string[];
  whenSilent: string[];
};

export type ReadyPackageLessonCompletionRule = {
  requiredObjectiveIds: string[];
  minimumEvidencePerObjective: number;
  maximumAssessmentSupportLevel: number;
  allowCompletionWithScheduledReview: boolean;
};

export type ReadyPackageTeachingRules = {
  teachBeforeTesting?: boolean;
  finiteRetryLoops?: boolean;
  useNativeLanguageStrategically?: boolean;
  meaningBeforeCorrection?: boolean;
  onePriorityCorrectionAtATime?: boolean;
  whiteboardMustBeLearnerFacing?: boolean;
  exactLessonContentRequired?: boolean;
  advanceAfterSuccess?: boolean;
  noPlanReuseAcrossLessons?: boolean;
  noBlueprintReuseAcrossLessons?: boolean;
  objectiveEvidenceRequiredForCompletion?: boolean;

  /**
   * Allows future additive teaching rules without forcing a schema redesign.
   */
  [rule: string]: unknown;
};

export type ReadyPackageElvyBlueprint = {
  id: string;
  lessonId: string;

  /**
   * Executable Blueprint v1.4 lesson objectives.
   * Optional so existing v1 packages remain loadable.
   */
  objectives?: ReadyPackageBlueprintObjective[];

  stages: ReadyPackageBlueprintStage[];

  nativeLanguageSupport?: ReadyPackageNativeLanguageSupport;
  adaptation?: ReadyPackageAdaptationRules;
  lessonCompletionRule?: ReadyPackageLessonCompletionRule;

  teachingRules: ReadyPackageTeachingRules;
};

export type ReadyPackageManifest = {
  schemaVersion: number;
  packageId: string;
  title: string;
  subtitle?: string;
  language: string;
  level: string;
  schoolLevel?: string;
  targetStage?: "Beginner" | "Intermediate" | "Advanced";
  publicSummary: string;
  targetAudience: string[];
  createdAt: string;
  createdBy: string;
  units: number;
  lessons: number;
  coverAssetId?: string;
};

export type ReadyPackageData = {
  manifest: ReadyPackageManifest;
  curriculum: ReadyPackageCurriculum;
  teacherPlans: ReadyPackageTeacherPlan[];
  elvyBlueprints: ReadyPackageElvyBlueprint[];
  assets: ReadyPackageAsset[];
};

export type ReadyPackageValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

export type ReadyPackageValidationResult = {
  valid: boolean;
  errors: ReadyPackageValidationIssue[];
  warnings: ReadyPackageValidationIssue[];
};
