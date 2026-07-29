import {
  READY_PACKAGE_SCHEMA_VERSION,
  type ReadyPackageData,
  type ReadyPackageValidationIssue,
  type ReadyPackageValidationResult,
} from "./ready-package-types";

function requiredText(
  value: unknown,
  path: string,
  errors: ReadyPackageValidationIssue[],
): string {
  const text = String(value ?? "").trim();
  if (!text) {
    errors.push({
      code: "REQUIRED_TEXT",
      message: `${path} is required.`,
      path,
    });
  }
  return text;
}

function duplicateIds(
  values: Array<{ id: string }>,
  path: string,
  errors: ReadyPackageValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    const id = String(value?.id || "").trim();
    if (!id) continue;
    if (seen.has(id)) {
      errors.push({
        code: "DUPLICATE_ID",
        message: `Duplicate id "${id}" in ${path}.`,
        path,
      });
    }
    seen.add(id);
  }
}

export function validateReadyPackage(
  pkg: ReadyPackageData,
  availableAssetFiles: Set<string> = new Set(),
): ReadyPackageValidationResult {
  const errors: ReadyPackageValidationIssue[] = [];
  const warnings: ReadyPackageValidationIssue[] = [];

  if (!pkg || typeof pkg !== "object") {
    return {
      valid: false,
      errors: [{ code: "INVALID_PACKAGE", message: "Package data is missing." }],
      warnings,
    };
  }

  requiredText(pkg.manifest?.packageId, "manifest.packageId", errors);
  requiredText(pkg.manifest?.title, "manifest.title", errors);
  requiredText(pkg.manifest?.language, "manifest.language", errors);
  requiredText(pkg.manifest?.level, "manifest.level", errors);
  requiredText(pkg.manifest?.publicSummary, "manifest.publicSummary", errors);

  if (pkg.manifest?.schemaVersion !== READY_PACKAGE_SCHEMA_VERSION) {
    errors.push({
      code: "UNSUPPORTED_SCHEMA",
      message:
        `Unsupported schemaVersion ${String(pkg.manifest?.schemaVersion)}. ` +
        `Expected ${READY_PACKAGE_SCHEMA_VERSION}.`,
      path: "manifest.schemaVersion",
    });
  }

  const units = Array.isArray(pkg.curriculum?.units)
    ? pkg.curriculum.units
    : [];
  if (!units.length) {
    errors.push({
      code: "NO_UNITS",
      message: "curriculum.units must contain at least one unit.",
      path: "curriculum.units",
    });
  }

  duplicateIds(units, "curriculum.units", errors);
  const lessons = units.flatMap((unit) => {
    requiredText(unit.id, "curriculum.units[].id", errors);
    requiredText(unit.title, `unit ${unit.id}.title`, errors);
    duplicateIds(unit.lessons || [], `unit ${unit.id}.lessons`, errors);
    return unit.lessons || [];
  });
  duplicateIds(lessons, "all curriculum lessons", errors);

  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  const teacherPlans = Array.isArray(pkg.teacherPlans) ? pkg.teacherPlans : [];
  const blueprints = Array.isArray(pkg.elvyBlueprints) ? pkg.elvyBlueprints : [];
  const assets = Array.isArray(pkg.assets) ? pkg.assets : [];

  duplicateIds(teacherPlans, "teacherPlans", errors);
  duplicateIds(blueprints, "elvyBlueprints", errors);
  duplicateIds(assets, "assets", errors);

  const teacherPlansById = new Map(teacherPlans.map((item) => [item.id, item]));
  const blueprintsById = new Map(blueprints.map((item) => [item.id, item]));
  const assetsById = new Map(assets.map((item) => [item.id, item]));

  for (const lesson of lessons) {
    requiredText(lesson.id, "lesson.id", errors);
    requiredText(lesson.title, `lesson ${lesson.id}.title`, errors);

    const teacherPlan = teacherPlansById.get(lesson.teacherPlanId);
    if (!teacherPlan) {
      errors.push({
        code: "TEACHER_PLAN_MISSING",
        message: `Lesson "${lesson.id}" references missing teacher plan "${lesson.teacherPlanId}".`,
      });
    } else if (teacherPlan.lessonId !== lesson.id) {
      errors.push({
        code: "TEACHER_PLAN_LESSON_MISMATCH",
        message: `Teacher plan "${teacherPlan.id}" belongs to another lesson.`,
      });
    }

    const blueprint = blueprintsById.get(lesson.elvyBlueprintId);
    if (!blueprint) {
      errors.push({
        code: "ELVY_BLUEPRINT_MISSING",
        message: `Lesson "${lesson.id}" references missing blueprint "${lesson.elvyBlueprintId}".`,
      });
    } else if (blueprint.lessonId !== lesson.id) {
      errors.push({
        code: "ELVY_BLUEPRINT_LESSON_MISMATCH",
        message: `Elvy blueprint "${blueprint.id}" belongs to another lesson.`,
      });
    }

    for (const assetId of lesson.assetIds || []) {
      const asset = assetsById.get(assetId);
      if (!asset) {
        errors.push({
          code: "ASSET_REFERENCE_MISSING",
          message: `Lesson "${lesson.id}" references missing asset "${assetId}".`,
        });
      } else if (asset.lessonId !== lesson.id) {
        errors.push({
          code: "ASSET_LESSON_MISMATCH",
          message: `Asset "${asset.id}" belongs to another lesson.`,
        });
      }
    }
  }

  for (const plan of teacherPlans) {
    if (!lessonIds.has(plan.lessonId)) {
      errors.push({
        code: "ORPHAN_TEACHER_PLAN",
        message: `Teacher plan "${plan.id}" references unknown lesson "${plan.lessonId}".`,
      });
    }
  }

for (const blueprint of blueprints) {
  if (!lessonIds.has(blueprint.lessonId)) {
    errors.push({
      code: "ORPHAN_ELVY_BLUEPRINT",
      message: `Elvy blueprint "${blueprint.id}" references unknown lesson "${blueprint.lessonId}".`,
    });
  }
}

  for (const asset of assets) {
    if (!lessonIds.has(asset.lessonId)) {
      errors.push({
        code: "ORPHAN_ASSET",
        message: `Asset "${asset.id}" references unknown lesson "${asset.lessonId}".`,
      });
    }
    if (!availableAssetFiles.has(asset.file)) {
      errors.push({
        code: "ASSET_FILE_MISSING",
        message: `Asset file "${asset.file}" was not found in the ZIP.`,
        path: asset.file,
      });
    }
  }

  if (pkg.manifest.units !== units.length) {
    warnings.push({
      code: "UNIT_COUNT_MISMATCH",
      message:
        `Manifest says ${pkg.manifest.units} units, but curriculum contains ${units.length}.`,
    });
  }
  if (pkg.manifest.lessons !== lessons.length) {
    warnings.push({
      code: "LESSON_COUNT_MISMATCH",
      message:
        `Manifest says ${pkg.manifest.lessons} lessons, but curriculum contains ${lessons.length}.`,
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}
