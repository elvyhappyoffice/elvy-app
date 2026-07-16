export const READY_PACKAGE_SCHEMA_VERSION = 1;

export type ReadyPackageAssetType =
  | "image"
  | "flashcard"
  | "grammar-chart"
  | "speaking-prompt"
  | "worksheet"
  | "audio"
  | "video"
  | "document"
  | "other";

export type ReadyPackageAsset = {
  id: string;
  lessonId: string;
  type: ReadyPackageAssetType;
  file: string;
  title: string;
  purpose: string;
  stage?: string;
  altText?: string;
  keywords?: string[];
  mimeType?: string;
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

export type ReadyPackageElvyBlueprint = {
  id: string;
  lessonId: string;
  stages: Array<{
    stage: string;
    instructions: string;
  }>;
  teachingRules?: Record<string, unknown>;
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
