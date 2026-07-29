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

  whiteboardPlan: string;

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

  // Optional compatibility field for older packages.
  instructions?: string;
};

export type ReadyPackageElvyBlueprint = {
  id: string;
  lessonId: string;
  stages: ReadyPackageBlueprintStage[];
  teachingRules: Record<string, unknown>;
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
