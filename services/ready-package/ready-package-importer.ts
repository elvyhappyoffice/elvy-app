import JSZip from "jszip";

import { ElvyLibrary } from "../curriculum-reader/elvy-library";
import { ReadyPackageAssetStorage } from "./ready-package-asset-storage";
import {
  type ReadyPackageAsset,
  type ReadyPackageData,
  type ReadyPackageElvyBlueprint,
  type ReadyPackageTeacherPlan,
} from "./ready-package-types";
import { validateReadyPackage } from "./ready-package-validator";

const CURRICULUM_TREE_KEY = "elvy-curriculum-reader-trees-v1";
const ACTIVE_STUDIO_KEY = "elvy-active-lesson-studio-syllabus";

function requiredJson<T>(zip: JSZip, path: string): Promise<T> {
  const entry = zip.file(path);
  if (!entry) {
    throw new Error(`Ready package is missing required file: ${path}`);
  }
  return entry.async("string").then((text) => {
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(`Ready package file ${path} contains invalid JSON.`, {
        cause: error,
      });
    }
  });
}

function normalizePlan(
  planEntry: ReadyPackageTeacherPlan,
  blueprintEntry: ReadyPackageElvyBlueprint,
  context: {
    bookTitle: string;
    levelTitle: string;
    sublevelTitle: string;
    unitTitle: string;
    lessonLabel: string;
    lessonTitle: string;
    pageRange?: string;
    duration?: string;
    assets: ReadyPackageAsset[];
  },
): Record<string, unknown> {
  const imported = { ...(planEntry.plan || {}) } as Record<string, unknown>;

  return {
    status: imported.status || "Generated",
    level: imported.level || context.levelTitle,
    sublevel: imported.sublevel || context.sublevelTitle,
    unit: imported.unit || context.unitTitle,
    lessonNumber: imported.lessonNumber || context.lessonLabel,
    lessonTitle: imported.lessonTitle || context.lessonTitle,
    textbook: imported.textbook || context.bookTitle,
    pages: imported.pages || context.pageRange || "",
    duration: imported.duration || context.duration || "60 minutes",
    theme: imported.theme || "",
    cefrLevel: imported.cefrLevel || context.levelTitle,
    schoolGrade: imported.schoolGrade || "",
    unitObjectives: imported.unitObjectives || "",
    lessonObjectives: imported.lessonObjectives || "",
    communicativeObjective: imported.communicativeObjective || "",
    languageObjective: imported.languageObjective || "",
    successCriteria: imported.successCriteria || "",
    competencies: imported.competencies || "",
    prerequisites: imported.prerequisites || "",
    outcomes: imported.outcomes || "",
    vocabulary: imported.vocabulary || "",
    grammar: imported.grammar || "",
    functions: imported.functions || "",
    pronunciation: imported.pronunciation || "",
    usefulExpressions: imported.usefulExpressions || "",
    sentencePatterns: imported.sentencePatterns || "",
    integratedSkills: Array.isArray(imported.integratedSkills)
      ? imported.integratedSkills
      : [],
    teachingApproach: imported.teachingApproach || "",
    pedagogicalFramework: imported.pedagogicalFramework || "",
    udlStrategies: imported.udlStrategies || "",
    differentiation: imported.differentiation || "",
    assessmentForLearning: imported.assessmentForLearning || "",
    stages: Array.isArray(imported.stages) ? imported.stages : [],
    diagnosticAssessment: imported.diagnosticAssessment || "",
    formativeAssessment: imported.formativeAssessment || "",
    summativeAssessment: imported.summativeAssessment || "",
    selfAssessment: imported.selfAssessment || "",
    peerAssessment: imported.peerAssessment || "",
    teacherTips: imported.teacherTips || "",
    grouping: imported.grouping || "",
    timeManagement: imported.timeManagement || "",
    transitions: imported.transitions || "",
    commonDifficulties: imported.commonDifficulties || "",
    suggestedSolutions: imported.suggestedSolutions || "",
    resources: imported.resources || "",
    homework: imported.homework || "",
    fastFinishers: imported.fastFinishers || "",
    extraPractice: imported.extraPractice || "",
    parentSuggestions: imported.parentSuggestions || "",
    teacherNotes: imported.teacherNotes || "",
    elvyBlueprint: blueprintEntry.stages || [],
    elvyTeachingRules: blueprintEntry.teachingRules || {},
    teachingAssets: context.assets,
    generatedBy: imported.generatedBy || "Happy Office Ready Elvy Package",
    generationDate:
      imported.generationDate || new Date().toISOString().slice(0, 10),
    sourceBook: imported.sourceBook || context.bookTitle,
    confidenceScore: imported.confidenceScore || "Happy Office reviewed package",
    teacherApproved: imported.teacherApproved || "Yes",
    readyForElvy: imported.readyForElvy || "Yes",
  };
}

export type ImportedReadyPackage = {
  packageId: string;
  syllabusId: string;
  title: string;
  level: {
    id: string;
    title: string;
    sublevels: Array<{
      id: string;
      title: string;
      units: Array<{
        id: string;
        title: string;
        lessons: Array<{
          id: string;
          title: string;
          fileName: string;
          fileText: string;
          uploadedAt: string;
          pageRange?: string;
          lessonPlanData: Record<string, unknown>;
        }>;
      }>;
    }>;
  };
  treeRecord: {
    syllabusId: string;
    title: string;
    levelId: string;
    levelTitle: string;
    sublevelIds: string[];
    units: number;
    lessons: number;
    generatedAt: string;
    status: "Generated";
  };
};

export async function importReadyPackageZip(
  file: File,
): Promise<ImportedReadyPackage> {
  const zip = await JSZip.loadAsync(file);

  const [manifest, curriculum, teacherPlans, elvyBlueprints, assets] =
    await Promise.all([
      requiredJson<ReadyPackageData["manifest"]>(zip, "manifest.json"),
      requiredJson<ReadyPackageData["curriculum"]>(zip, "curriculum.json"),
      requiredJson<ReadyPackageData["teacherPlans"]>(zip, "teacher-plans.json"),
      requiredJson<ReadyPackageData["elvyBlueprints"]>(zip, "elvy-blueprints.json"),
      requiredJson<ReadyPackageData["assets"]>(zip, "assets.json"),
    ]);

  const packageData: ReadyPackageData = {
    manifest,
    curriculum,
    teacherPlans,
    elvyBlueprints,
    assets,
  };

  const availableAssetFiles = new Set(
    Object.keys(zip.files).filter((path) => !zip.files[path].dir),
  );
  const validation = validateReadyPackage(packageData, availableAssetFiles);

  if (!validation.valid) {
    throw new Error(
      "Ready package validation failed:\n" +
        validation.errors.map((issue) => `• ${issue.message}`).join("\n"),
    );
  }

  const assetBlobs = await Promise.all(
    assets.map(async (asset) => {
      const entry = zip.file(asset.file);
      if (!entry) {
        throw new Error(`Asset file not found: ${asset.file}`);
      }
      const blob = await entry.async("blob");
      return { metadata: asset, blob };
    }),
  );

  await ReadyPackageAssetStorage.storeAssets(
    manifest.packageId,
    assetBlobs,
  );

  const teacherPlanById = new Map(
    teacherPlans.map((entry) => [entry.id, entry]),
  );
  const blueprintById = new Map(
    elvyBlueprints.map((entry) => [entry.id, entry]),
  );
  const assetById = new Map(assets.map((entry) => [entry.id, entry]));

  const syllabusId = `ready-package:${manifest.packageId}`;
  const generatedAt = new Date().toISOString();

  const units = [...curriculum.units]
    .sort((a, b) => a.order - b.order)
    .map((unit) => ({
      id: unit.id,
      title: unit.label && unit.title
        ? `${unit.label}: ${unit.title}`
        : unit.title || unit.label,
      lessons: [...unit.lessons]
        .sort((a, b) => a.order - b.order)
        .map((lesson) => {
          const planEntry = teacherPlanById.get(lesson.teacherPlanId);
          const blueprintEntry = blueprintById.get(lesson.elvyBlueprintId);
          if (!planEntry || !blueprintEntry) {
            throw new Error(`Lesson ${lesson.id} has incomplete plan data.`);
          }

          const lessonAssets = (lesson.assetIds || [])
            .map((assetId) => assetById.get(assetId))
            .filter((asset): asset is ReadyPackageAsset => Boolean(asset));

          const lessonPlanData = normalizePlan(
            planEntry,
            blueprintEntry,
            {
              bookTitle: manifest.title,
              levelTitle: curriculum.levelTitle,
              sublevelTitle: curriculum.sublevelTitle,
              unitTitle: unit.title,
              lessonLabel: lesson.label,
              lessonTitle: lesson.title,
              pageRange: lesson.pageRange,
              duration: lesson.duration,
              assets: lessonAssets,
            },
          );

          window.localStorage.setItem(
            `elvy-lesson-plan-${lesson.id}`,
            JSON.stringify(lessonPlanData),
          );
          window.localStorage.setItem(
            `elvy-ready-assets-${lesson.id}`,
            JSON.stringify({
              packageId: manifest.packageId,
              assets: lessonAssets,
            }),
          );

          return {
            id: lesson.id,
            title:
              lesson.label && lesson.title
                ? `${lesson.label}: ${lesson.title}`
                : lesson.title || lesson.label,
            fileName: `${manifest.title} - ${lesson.title}.ready-package.json`,
            fileText: JSON.stringify(lessonPlanData, null, 2),
            uploadedAt: generatedAt,
            pageRange: lesson.pageRange,
            lessonPlanData,
          };
        }),
    }));

  const level = {
    id: curriculum.levelId || `ready-level-${manifest.packageId}`,
    title: curriculum.levelTitle || manifest.level,
    sublevels: [
      {
        id:
          curriculum.sublevelId ||
          `ready-sublevel-${manifest.packageId}`,
        title: curriculum.sublevelTitle || manifest.level,
        units,
      },
    ],
  };

  const lessonCount = units.reduce(
    (total, unit) => total + unit.lessons.length,
    0,
  );

  const treeRecord = {
    syllabusId,
    title: manifest.title,
    levelId: level.id,
    levelTitle: level.title,
    sublevelIds: level.sublevels.map((item) => item.id),
    units: units.length,
    lessons: lessonCount,
    generatedAt,
    status: "Generated" as const,
  };

  const existingTrees = JSON.parse(
    window.localStorage.getItem(CURRICULUM_TREE_KEY) || "[]",
  );
  const trees = Array.isArray(existingTrees) ? existingTrees : [];
  window.localStorage.setItem(
    CURRICULUM_TREE_KEY,
    JSON.stringify([
      treeRecord,
      ...trees.filter((item: any) => item?.syllabusId !== syllabusId),
    ]),
  );
  window.localStorage.setItem(ACTIVE_STUDIO_KEY, syllabusId);

  ElvyLibrary.upsertBySyllabusId(syllabusId, {
    syllabusId,
    title: manifest.title,
    subtitle: manifest.subtitle,
    resourceType: "Textbook",
    language: manifest.language,
    level: manifest.level,
    schoolLevel: manifest.schoolLevel,
    targetStage: manifest.targetStage,
    publicSummary: manifest.publicSummary,
    targetAudience: manifest.targetAudience,
    status: "Approved",
    visibility: "private",
    uploadedAt: generatedAt,
    uploadedBy: manifest.createdBy || "Happy Office",
    sourceFile: {
      fileName: file.name,
      fileType: "ELVY READY PACKAGE",
      fileSize: file.size,
      mimeType: file.type || "application/zip",
      pageCountSource: "unknown",
    },
    curriculumTreeId: syllabusId,
    levelId: level.id,
    units: units.length,
    lessons: lessonCount,
    packageSource: "ready-package",
    packageVersion: manifest.schemaVersion,
    packageId: manifest.packageId,
    packageStatus: "Complete",
    teacherPlansReady: true,
    elvyBlueprintsReady: true,
    teachingAssetsReady: assets.length > 0,
  } as any);

  return {
    packageId: manifest.packageId,
    syllabusId,
    title: manifest.title,
    level,
    treeRecord,
  };
}
