import "server-only";

import type { LessonPlan } from "@/services/lesson-plan/lesson-plan-types";
import {
  ElvyPackageRepository,
  type CloudLesson,
  type CloudSublevel,
  type CloudUnit,
  type ElvyDashboardPackage,
} from "@/services/supabase/elvy-package-repository";
import {
  buildTeachingBrainLesson,
  type BlueprintAdapterContext,
} from "@/services/teaching-brain/blueprint-adapter";
import type {
  LanguageCode,
  TeachingBrainLesson,
} from "@/services/teaching-brain/types";

export type StudentLessonAssignment = Readonly<{
  studentId: string;
  studentCode: string;
  studentName?: string;
  level: string;
  sublevel: string;
  unit: string;
  lesson: string | number;
  lessonTitle?: string;
  firstLanguage?: LanguageCode;
}>;

export type ResolvedStudentLesson = Readonly<{
  packageId: string;
  syllabusId: string;
  packageTitle: string;
  packageVersion: string;
  levelId: string;
  levelTitle: string;
  sublevelId: string;
  sublevelTitle: string;
  unitId: string;
  unitTitle: string;
  lessonId: string;
  lessonTitle: string;
  lessonPlan: LessonPlan;
  teachingBrainLesson: TeachingBrainLesson;
}>;

export class StudentLessonResolverError extends Error {
  readonly code:
    | "INVALID_ASSIGNMENT"
    | "PACKAGE_NOT_FOUND"
    | "LEVEL_NOT_FOUND"
    | "SUBLEVEL_NOT_FOUND"
    | "UNIT_NOT_FOUND"
    | "LESSON_NOT_FOUND"
    | "LESSON_PLAN_INVALID";

  readonly details?: Record<string, unknown>;

  constructor(
    code: StudentLessonResolverError["code"],
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "StudentLessonResolverError";
    this.code = code;
    this.details = details;
  }
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeCompact(value: unknown): string {
  return normalize(value).replace(/[^a-z0-9]+/g, "");
}

function extractSublevelCode(value: unknown): string {
  const match = String(value ?? "")
    .trim()
    .toUpperCase()
    .match(/\b(A1|A2|B1|B2|C1|C2)\b/);

  return match?.[1] ?? "";
}

function unitReferenceVariants(value: unknown): string[] {
  const raw = String(value ?? "").trim();

  if (!raw) return [];

  const variants = new Set<string>([raw]);
  const colonIndex = raw.indexOf(":");

  if (colonIndex >= 0) {
    const beforeColon = raw.slice(0, colonIndex).trim();
    const afterColon = raw.slice(colonIndex + 1).trim();

    if (beforeColon) variants.add(beforeColon);
    if (afterColon) variants.add(afterColon);
  }

  return [...variants];
}

function unitMatchesReference(
  expected: unknown,
  ...candidates: unknown[]
): boolean {
  const expectedVariants = unitReferenceVariants(expected);
  const candidateVariants = candidates.flatMap(unitReferenceVariants);

  return expectedVariants.some((expectedVariant) =>
    matchesReference(expectedVariant, ...candidateVariants),
  );
}

function lessonReferenceVariants(value: unknown): string[] {
  const raw = String(value ?? "").trim();

  if (!raw) return [];

  const variants = new Set<string>([raw]);
  const colonIndex = raw.indexOf(":");

  if (colonIndex >= 0) {
    const beforeColon = raw.slice(0, colonIndex).trim();
    const afterColon = raw.slice(colonIndex + 1).trim();

    if (beforeColon) variants.add(beforeColon);
    if (afterColon) variants.add(afterColon);
  }

  const lessonNumberMatch = raw.match(/\blesson\s*(\d+)\b/i);
  if (lessonNumberMatch?.[1]) {
    variants.add(lessonNumberMatch[1]);
    variants.add(`Lesson ${lessonNumberMatch[1]}`);
  }

  return [...variants];
}

function extractLessonNumber(value: unknown): string {
  const raw = String(value ?? "").trim();

  if (!raw) return "";

  const explicitLessonMatch = raw.match(/\blesson\s*(\d+)\b/i);
  if (explicitLessonMatch?.[1]) return explicitLessonMatch[1];

  return /^\d+$/.test(raw) ? raw : "";
}

function lessonReferenceMatches(
  expected: unknown,
  ...candidates: unknown[]
): boolean {
  const expectedVariants = lessonReferenceVariants(expected);
  const candidateVariants = candidates.flatMap(lessonReferenceVariants);

  return expectedVariants.some((expectedVariant) =>
    matchesReference(expectedVariant, ...candidateVariants),
  );
}

function matchesReference(
  expected: unknown,
  ...candidates: unknown[]
): boolean {
  const expectedNormal = normalize(expected);
  const expectedCompact = normalizeCompact(expected);

  if (!expectedNormal) return false;

  return candidates.some((candidate) => {
    const candidateNormal = normalize(candidate);
    const candidateCompact = normalizeCompact(candidate);

    return (
      candidateNormal === expectedNormal ||
      candidateCompact === expectedCompact ||
      candidateNormal.endsWith(` ${expectedNormal}`) ||
      candidateNormal.startsWith(`${expectedNormal}:`)
    );
  });
}

function lessonMatches(
  lesson: CloudLesson,
  assignment: StudentLessonAssignment,
): boolean {
  const assignmentNumber =
    extractLessonNumber(assignment.lesson) ||
    extractLessonNumber(assignment.lessonTitle);

  const storedNumber =
    extractLessonNumber(lesson.lessonNumber) ||
    extractLessonNumber(lesson.order) ||
    extractLessonNumber(lesson.label) ||
    extractLessonNumber(lesson.title) ||
    extractLessonNumber(lesson.id);

  const numberMatch =
    lessonReferenceMatches(
      assignment.lesson,
      lesson.id,
      lesson.label,
      lesson.lessonNumber,
      lesson.order,
      lesson.title,
    ) ||
    Boolean(assignmentNumber && storedNumber === assignmentNumber);

  const titleRequested = normalize(assignment.lessonTitle);
  const titleMatch =
    !titleRequested ||
    lessonReferenceMatches(
      assignment.lessonTitle,
      lesson.title,
      lesson.label,
      lesson.id,
    );

  return numberMatch && titleMatch;
}

function findPackageLevel(
  packages: ElvyDashboardPackage[],
  assignment: StudentLessonAssignment,
): {
  package: ElvyDashboardPackage;
  levelTitle: string;
} | null {
  for (const item of packages) {
    if (
      matchesReference(
        assignment.level,
        item.level.id,
        item.level.code,
        item.level.label,
        item.level.title,
      )
    ) {
      return {
        package: item,
        levelTitle: item.level.title,
      };
    }
  }

  return null;
}

function findSublevel(
  packageItem: ElvyDashboardPackage,
  assignment: StudentLessonAssignment,
): CloudSublevel | undefined {
  const assignmentCode = extractSublevelCode(assignment.sublevel);

  return packageItem.level.sublevels.find((sublevel) => {
    const storedCode =
      extractSublevelCode(sublevel.code) ||
      extractSublevelCode(sublevel.label) ||
      extractSublevelCode(sublevel.title) ||
      extractSublevelCode(sublevel.id);

    return (
      matchesReference(
        assignment.sublevel,
        sublevel.id,
        sublevel.code,
        sublevel.label,
        sublevel.title,
      ) ||
      Boolean(assignmentCode && storedCode === assignmentCode)
    );
  });
}

function findUnit(
  sublevel: CloudSublevel,
  assignment: StudentLessonAssignment,
): CloudUnit | undefined {
  return sublevel.units.find((unit) =>
    unitMatchesReference(
      assignment.unit,
      unit.id,
      unit.label,
      unit.order,
      unit.title,
    ),
  );
}

function assertLessonPlan(value: unknown): asserts value is LessonPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StudentLessonResolverError(
      "LESSON_PLAN_INVALID",
      "The assigned lesson does not contain a valid Lesson Plan.",
    );
  }

  const plan = value as Partial<LessonPlan>;

  if (
    !String(plan.lessonTitle ?? "").trim() ||
    !String(plan.level ?? "").trim() ||
    !String(plan.duration ?? "").trim() ||
    !Array.isArray(plan.stages)
  ) {
    throw new StudentLessonResolverError(
      "LESSON_PLAN_INVALID",
      "The assigned lesson plan is incomplete and cannot be loaded by the Teaching Brain.",
      {
        lessonTitle: plan.lessonTitle,
        level: plan.level,
        duration: plan.duration,
        stagesAvailable: Array.isArray(plan.stages),
      },
    );
  }
}

function validateAssignment(
  assignment: StudentLessonAssignment,
): void {
  const required = {
    studentId: assignment.studentId,
    studentCode: assignment.studentCode,
    level: assignment.level,
    sublevel: assignment.sublevel,
    unit: assignment.unit,
    lesson: assignment.lesson,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !String(value ?? "").trim())
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new StudentLessonResolverError(
      "INVALID_ASSIGNMENT",
      `The student assignment is missing: ${missing.join(", ")}.`,
      { missing },
    );
  }
}

export async function resolveStudentTeachingLesson(
  assignment: StudentLessonAssignment,
): Promise<ResolvedStudentLesson> {
  validateAssignment(assignment);

  const packages = await ElvyPackageRepository.listDashboardPackages();
  const levelMatch = findPackageLevel(packages, assignment);

  if (!levelMatch) {
    throw new StudentLessonResolverError(
      "LEVEL_NOT_FOUND",
      `No Elvy package contains the assigned level "${assignment.level}".`,
    );
  }

  const packageItem = levelMatch.package;
  const sublevel = findSublevel(packageItem, assignment);

  if (!sublevel) {
    throw new StudentLessonResolverError(
      "SUBLEVEL_NOT_FOUND",
      `Sublevel "${assignment.sublevel}" was not found in "${packageItem.title}".`,
      { packageId: packageItem.packageId },
    );
  }

  const unit = findUnit(sublevel, assignment);

  if (!unit) {
    throw new StudentLessonResolverError(
      "UNIT_NOT_FOUND",
      `Unit "${assignment.unit}" was not found in sublevel "${sublevel.title}".`,
      { packageId: packageItem.packageId, sublevelId: sublevel.id },
    );
  }

  const lesson = unit.lessons.find((item) =>
    lessonMatches(item, assignment),
  );

  if (!lesson) {
    throw new StudentLessonResolverError(
      "LESSON_NOT_FOUND",
      `Lesson "${assignment.lesson}" was not found in unit "${unit.title}".`,
      {
        packageId: packageItem.packageId,
        sublevelId: sublevel.id,
        unitId: unit.id,
        requestedLessonTitle: assignment.lessonTitle,
      },
    );
  }

  assertLessonPlan(lesson.lessonPlanData);

  const lessonPlan = lesson.lessonPlanData;
  const adapterContext: BlueprintAdapterContext = {
    lessonId: lesson.id,
    curriculumId: packageItem.syllabusId,
    levelId: packageItem.level.id,
    sublevelId: sublevel.id,
    unitId: unit.id,
    curriculumTitle: packageItem.title,
    targetLanguage: "en",
    learnerL1: assignment.firstLanguage,
    sourceBlueprintId: `${lesson.id}:elvy-blueprint`,
    sourceBlueprintVersion: packageItem.packageVersion,
  };

  const teachingBrainLesson = buildTeachingBrainLesson(
    lessonPlan,
    adapterContext,
    {
      blueprintData: lesson.blueprintData,
    },
  );

  return Object.freeze({
    packageId: packageItem.packageId,
    syllabusId: packageItem.syllabusId,
    packageTitle: packageItem.title,
    packageVersion: packageItem.packageVersion,
    levelId: packageItem.level.id,
    levelTitle: packageItem.level.title,
    sublevelId: sublevel.id,
    sublevelTitle: sublevel.title,
    unitId: unit.id,
    unitTitle: unit.title,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    lessonPlan,
    teachingBrainLesson,
  });
}

export const StudentLessonResolver = Object.freeze({
  resolve: resolveStudentTeachingLesson,
});
