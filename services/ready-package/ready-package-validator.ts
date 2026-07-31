import {
  READY_PACKAGE_SCHEMA_VERSION,
  type ReadyPackageBlueprintActivity,
  type ReadyPackageBlueprintScene,
  type ReadyPackageData,
  type ReadyPackageElvyBlueprint,
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

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function duplicateIds(
  values: Array<{ id: string }>,
  path: string,
  errors: ReadyPackageValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    const id = text(value?.id);
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

function duplicateKey(
  values: unknown[],
  key: string,
  path: string,
  errors: ReadyPackageValidationIssue[],
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (!value || typeof value !== "object") return;
    const id = text((value as Record<string, unknown>)[key]);
    if (!id) return;
    if (seen.has(id)) {
      errors.push({
        code: "DUPLICATE_EXECUTABLE_ID",
        message: `Duplicate ${key} "${id}" in ${path}.`,
        path: `${path}[${index}].${key}`,
      });
    }
    seen.add(id);
  });
}

function validateReferences(
  values: unknown,
  validIds: Set<string>,
  code: string,
  label: string,
  path: string,
  errors: ReadyPackageValidationIssue[],
): void {
  if (!Array.isArray(values)) return;
  values.forEach((value, index) => {
    const id = text(value);
    if (!id) {
      errors.push({
        code: "EMPTY_REFERENCE_ID",
        message: `${path}[${index}] must contain a non-empty id.`,
        path: `${path}[${index}]`,
      });
    } else if (!validIds.has(id)) {
      errors.push({
        code,
        message: `${label} "${id}" does not exist.`,
        path: `${path}[${index}]`,
      });
    }
  });
}

function validateActivity(
  activity: ReadyPackageBlueprintActivity,
  path: string,
  objectiveIds: Set<string>,
  activityIds: Set<string>,
  errors: ReadyPackageValidationIssue[],
): void {
  requiredText(activity.activityId, `${path}.activityId`, errors);
  requiredText(activity.type, `${path}.type`, errors);
  requiredText(activity.prompt, `${path}.prompt`, errors);
  requiredText(activity.inputMode, `${path}.inputMode`, errors);

  validateReferences(
    activity.objectiveIds,
    objectiveIds,
    "ACTIVITY_OBJECTIVE_REFERENCE_MISSING",
    "Activity objective reference",
    `${path}.objectiveIds`,
    errors,
  );

  if (!activity.evaluation || typeof activity.evaluation !== "object") {
    errors.push({
      code: "ACTIVITY_EVALUATION_MISSING",
      message: `${path}.evaluation is required.`,
      path: `${path}.evaluation`,
    });
  } else {
    requiredText(activity.evaluation.mode, `${path}.evaluation.mode`, errors);
    requiredText(activity.evaluation.passRule, `${path}.evaluation.passRule`, errors);
    requiredText(activity.evaluation.partialRule, `${path}.evaluation.partialRule`, errors);
    requiredText(activity.evaluation.failRule, `${path}.evaluation.failRule`, errors);
  }

  if (!activity.feedback || typeof activity.feedback !== "object") {
    errors.push({
      code: "ACTIVITY_FEEDBACK_MISSING",
      message: `${path}.feedback is required.`,
      path: `${path}.feedback`,
    });
  } else {
    requiredText(activity.feedback.success, `${path}.feedback.success`, errors);
    requiredText(activity.feedback.partial, `${path}.feedback.partial`, errors);
    requiredText(activity.feedback.incorrect, `${path}.feedback.incorrect`, errors);
  }

  if (!Array.isArray(activity.hints)) {
    errors.push({
      code: "ACTIVITY_HINTS_MISSING",
      message: `${path}.hints must be an array.`,
      path: `${path}.hints`,
    });
  } else {
    activity.hints.forEach((hint, index) => {
      const hintPath = `${path}.hints[${index}]`;
      if (typeof hint.level !== "number" || hint.level < 1) {
        errors.push({
          code: "INVALID_HINT_LEVEL",
          message: `${hintPath}.level must be a positive number.`,
          path: `${hintPath}.level`,
        });
      }
      requiredText(hint.type, `${hintPath}.type`, errors);
      requiredText(hint.content, `${hintPath}.content`, errors);
    });
  }

  if (
    typeof activity.retryLimit !== "number" ||
    !Number.isFinite(activity.retryLimit) ||
    activity.retryLimit < 0
  ) {
    errors.push({
      code: "INVALID_RETRY_LIMIT",
      message: `${path}.retryLimit must be a finite number of zero or more.`,
      path: `${path}.retryLimit`,
    });
  }

  for (const [name, transition] of [
    ["onSuccess", activity.onSuccess],
    ["onFailure", activity.onFailure],
  ] as const) {
    if (!transition || typeof transition !== "object") {
      errors.push({
        code: "ACTIVITY_TRANSITION_MISSING",
        message: `${path}.${name} is required.`,
        path: `${path}.${name}`,
      });
      continue;
    }
    requiredText(transition.action, `${path}.${name}.action`, errors);
    const nextId = text(transition.nextActivityId);
    const recoveryId = text(transition.recoveryActivityId);
    if (nextId && !activityIds.has(nextId)) {
      errors.push({
        code: "NEXT_ACTIVITY_REFERENCE_MISSING",
        message: `Activity "${activity.activityId}" references unknown activity "${nextId}".`,
        path: `${path}.${name}.nextActivityId`,
      });
    }
    if (recoveryId && !activityIds.has(recoveryId)) {
      errors.push({
        code: "RECOVERY_ACTIVITY_REFERENCE_MISSING",
        message: `Activity "${activity.activityId}" references unknown recovery activity "${recoveryId}".`,
        path: `${path}.${name}.recoveryActivityId`,
      });
    }
  }

  if (!activity.evidence || typeof activity.evidence !== "object") {
    errors.push({
      code: "ACTIVITY_EVIDENCE_MISSING",
      message: `${path}.evidence is required.`,
      path: `${path}.evidence`,
    });
  } else {
    const objectiveId = requiredText(
      activity.evidence.objectiveId,
      `${path}.evidence.objectiveId`,
      errors,
    );
    if (objectiveId && !objectiveIds.has(objectiveId)) {
      errors.push({
        code: "EVIDENCE_OBJECTIVE_REFERENCE_MISSING",
        message: `Activity "${activity.activityId}" references unknown evidence objective "${objectiveId}".`,
        path: `${path}.evidence.objectiveId`,
      });
    }
    requiredText(
      activity.evidence.evidenceType,
      `${path}.evidence.evidenceType`,
      errors,
    );
    if (
      typeof activity.evidence.masteryWeight !== "number" ||
      activity.evidence.masteryWeight <= 0 ||
      activity.evidence.masteryWeight > 1
    ) {
      errors.push({
        code: "INVALID_MASTERY_WEIGHT",
        message: `${path}.evidence.masteryWeight must be greater than 0 and no greater than 1.`,
        path: `${path}.evidence.masteryWeight`,
      });
    }
  }
}

function validateScene(
  scene: ReadyPackageBlueprintScene,
  path: string,
  objectiveIds: Set<string>,
  sceneIds: Set<string>,
  activityIds: Set<string>,
  lessonAssetIds: Set<string>,
  errors: ReadyPackageValidationIssue[],
): void {
  requiredText(scene.sceneId, `${path}.sceneId`, errors);
  requiredText(scene.title, `${path}.title`, errors);
  requiredText(scene.purpose, `${path}.purpose`, errors);
  requiredText(scene.entryCondition, `${path}.entryCondition`, errors);
  requiredText(scene.completionCondition, `${path}.completionCondition`, errors);

  validateReferences(
    scene.objectiveIds,
    objectiveIds,
    "SCENE_OBJECTIVE_REFERENCE_MISSING",
    "Scene objective reference",
    `${path}.objectiveIds`,
    errors,
  );
  validateReferences(
    scene.activityIds,
    activityIds,
    "SCENE_ACTIVITY_REFERENCE_MISSING",
    "Scene activity reference",
    `${path}.activityIds`,
    errors,
  );

  const nextSceneId = text(scene.nextSceneId);
  const recoverySceneId = text(scene.recoverySceneId);
  if (nextSceneId && !sceneIds.has(nextSceneId)) {
    errors.push({
      code: "NEXT_SCENE_REFERENCE_MISSING",
      message: `Scene "${scene.sceneId}" references unknown next scene "${nextSceneId}".`,
      path: `${path}.nextSceneId`,
    });
  }
  if (recoverySceneId && !sceneIds.has(recoverySceneId)) {
    errors.push({
      code: "RECOVERY_SCENE_REFERENCE_MISSING",
      message: `Scene "${scene.sceneId}" references unknown recovery scene "${recoverySceneId}".`,
      path: `${path}.recoverySceneId`,
    });
  }

  if (!scene.whiteboard || typeof scene.whiteboard !== "object") {
    errors.push({
      code: "SCENE_WHITEBOARD_MISSING",
      message: `${path}.whiteboard is required.`,
      path: `${path}.whiteboard`,
    });
  } else {
    requiredText(scene.whiteboard.boardId, `${path}.whiteboard.boardId`, errors);
    requiredText(scene.whiteboard.title, `${path}.whiteboard.title`, errors);
    requiredText(scene.whiteboard.instruction, `${path}.whiteboard.instruction`, errors);
    if (!Array.isArray(scene.whiteboard.blocks)) {
      errors.push({
        code: "WHITEBOARD_BLOCKS_MISSING",
        message: `${path}.whiteboard.blocks must be an array.`,
        path: `${path}.whiteboard.blocks`,
      });
    }
  }

  if (!Array.isArray(scene.teacherTurns)) {
    errors.push({
      code: "TEACHER_TURNS_MISSING",
      message: `${path}.teacherTurns must be an array.`,
      path: `${path}.teacherTurns`,
    });
  } else {
    duplicateKey(scene.teacherTurns, "turnId", `${path}.teacherTurns`, errors);
    scene.teacherTurns.forEach((turn, index) => {
      const turnPath = `${path}.teacherTurns[${index}]`;
      requiredText(turn.turnId, `${turnPath}.turnId`, errors);
      requiredText(turn.action, `${turnPath}.action`, errors);
      requiredText(turn.text, `${turnPath}.text`, errors);
      if (typeof turn.waitForLearner !== "boolean") {
        errors.push({
          code: "INVALID_WAIT_FOR_LEARNER",
          message: `${turnPath}.waitForLearner must be boolean.`,
          path: `${turnPath}.waitForLearner`,
        });
      }
      const expectedActivityId = text(turn.expectedActivityId);
      if (expectedActivityId && !activityIds.has(expectedActivityId)) {
        errors.push({
          code: "TEACHER_TURN_ACTIVITY_REFERENCE_MISSING",
          message: `Teacher turn "${turn.turnId}" references unknown activity "${expectedActivityId}".`,
          path: `${turnPath}.expectedActivityId`,
        });
      }
    });
  }

  if (!Array.isArray(scene.activities)) {
    errors.push({
      code: "SCENE_ACTIVITIES_MISSING",
      message: `${path}.activities must be an array.`,
      path: `${path}.activities`,
    });
  } else {
    scene.activities.forEach((activity, index) =>
      validateActivity(
        activity,
        `${path}.activities[${index}]`,
        objectiveIds,
        activityIds,
        errors,
      ),
    );
  }

  validateReferences(
    scene.assetIds,
    lessonAssetIds,
    "SCENE_ASSET_REFERENCE_MISSING",
    "Scene asset reference",
    `${path}.assetIds`,
    errors,
  );
}

function validateExecutableBlueprint(
  blueprint: ReadyPackageElvyBlueprint,
  blueprintIndex: number,
  lessonAssetIds: Set<string>,
  errors: ReadyPackageValidationIssue[],
  warnings: ReadyPackageValidationIssue[],
): void {
  const path = `elvyBlueprints[${blueprintIndex}]`;

  const hasExecutableFields =
    Array.isArray(blueprint.objectives) ||
    blueprint.nativeLanguageSupport !== undefined ||
    blueprint.adaptation !== undefined ||
    blueprint.lessonCompletionRule !== undefined ||
    blueprint.stages.some(
      (stage) =>
        stage.stageId !== undefined ||
        stage.objectiveIds !== undefined ||
        stage.scenes !== undefined ||
        stage.stageCompletionRule !== undefined,
    );

  if (!hasExecutableFields) {
    warnings.push({
      code: "LEGACY_BLUEPRINT_STRUCTURE",
      message: `Elvy blueprint "${blueprint.id}" uses the legacy structure and contains no executable v1.4 scenes.`,
      path,
    });
    return;
  }

  if (!Array.isArray(blueprint.objectives) || !blueprint.objectives.length) {
    errors.push({
      code: "BLUEPRINT_OBJECTIVES_MISSING",
      message: `Elvy blueprint "${blueprint.id}" must contain objectives.`,
      path: `${path}.objectives`,
    });
  }

  const objectives = Array.isArray(blueprint.objectives)
    ? blueprint.objectives
    : [];
  duplicateKey(objectives, "id", `${path}.objectives`, errors);

  const objectiveIds = new Set(
    objectives.map((objective) => text(objective.id)).filter(Boolean),
  );

  objectives.forEach((objective, index) => {
    const objectivePath = `${path}.objectives[${index}]`;
    requiredText(objective.id, `${objectivePath}.id`, errors);
    requiredText(objective.description, `${objectivePath}.description`, errors);
    requiredText(objective.evidence, `${objectivePath}.evidence`, errors);
  });

  duplicateKey(blueprint.stages, "stageId", `${path}.stages`, errors);

  const scenes = blueprint.stages.flatMap((stage) => stage.scenes || []);
  duplicateKey(scenes, "sceneId", `${path}.scenes`, errors);
  const sceneIds = new Set(
    scenes.map((scene) => text(scene.sceneId)).filter(Boolean),
  );

  const activities = scenes.flatMap((scene) => scene.activities || []);
  duplicateKey(activities, "activityId", `${path}.activities`, errors);
  const activityIds = new Set(
    activities.map((activity) => text(activity.activityId)).filter(Boolean),
  );

  blueprint.stages.forEach((stage, stageIndex) => {
    const stagePath = `${path}.stages[${stageIndex}]`;
    requiredText(stage.stageId, `${stagePath}.stageId`, errors);

    validateReferences(
      stage.objectiveIds,
      objectiveIds,
      "STAGE_OBJECTIVE_REFERENCE_MISSING",
      "Stage objective reference",
      `${stagePath}.objectiveIds`,
      errors,
    );

    if (!Array.isArray(stage.scenes) || !stage.scenes.length) {
      errors.push({
        code: "STAGE_SCENES_MISSING",
        message: `${stagePath}.scenes must contain at least one scene.`,
        path: `${stagePath}.scenes`,
      });
    } else {
      stage.scenes.forEach((scene, sceneIndex) =>
        validateScene(
          scene,
          `${stagePath}.scenes[${sceneIndex}]`,
          objectiveIds,
          sceneIds,
          activityIds,
          lessonAssetIds,
          errors,
        ),
      );
    }

    if (!stage.stageCompletionRule) {
      errors.push({
        code: "STAGE_COMPLETION_RULE_MISSING",
        message: `${stagePath}.stageCompletionRule is required.`,
        path: `${stagePath}.stageCompletionRule`,
      });
    } else {
      validateReferences(
        stage.stageCompletionRule.requiredSceneIds,
        sceneIds,
        "STAGE_REQUIRED_SCENE_REFERENCE_MISSING",
        "Required scene reference",
        `${stagePath}.stageCompletionRule.requiredSceneIds`,
        errors,
      );
      if (
        typeof stage.stageCompletionRule.minimumObjectiveEvidence !== "number" ||
        stage.stageCompletionRule.minimumObjectiveEvidence < 0
      ) {
        errors.push({
          code: "INVALID_MINIMUM_OBJECTIVE_EVIDENCE",
          message: `${stagePath}.stageCompletionRule.minimumObjectiveEvidence must be zero or more.`,
          path: `${stagePath}.stageCompletionRule.minimumObjectiveEvidence`,
        });
      }
      if (
        typeof stage.stageCompletionRule.allowSupportedCompletion !== "boolean"
      ) {
        errors.push({
          code: "INVALID_SUPPORTED_COMPLETION_FLAG",
          message: `${stagePath}.stageCompletionRule.allowSupportedCompletion must be boolean.`,
          path: `${stagePath}.stageCompletionRule.allowSupportedCompletion`,
        });
      }
    }
  });

  if (!blueprint.nativeLanguageSupport) {
    errors.push({
      code: "NATIVE_LANGUAGE_SUPPORT_MISSING",
      message: `Elvy blueprint "${blueprint.id}" must define nativeLanguageSupport.`,
      path: `${path}.nativeLanguageSupport`,
    });
  }
  if (!blueprint.adaptation) {
    errors.push({
      code: "ADAPTATION_RULES_MISSING",
      message: `Elvy blueprint "${blueprint.id}" must define adaptation rules.`,
      path: `${path}.adaptation`,
    });
  }
  if (!blueprint.lessonCompletionRule) {
    errors.push({
      code: "LESSON_COMPLETION_RULE_MISSING",
      message: `Elvy blueprint "${blueprint.id}" must define lessonCompletionRule.`,
      path: `${path}.lessonCompletionRule`,
    });
  } else {
    validateReferences(
      blueprint.lessonCompletionRule.requiredObjectiveIds,
      objectiveIds,
      "LESSON_OBJECTIVE_REFERENCE_MISSING",
      "Lesson completion objective reference",
      `${path}.lessonCompletionRule.requiredObjectiveIds`,
      errors,
    );
    if (
      typeof blueprint.lessonCompletionRule.minimumEvidencePerObjective !==
        "number" ||
      blueprint.lessonCompletionRule.minimumEvidencePerObjective < 1
    ) {
      errors.push({
        code: "INVALID_MINIMUM_EVIDENCE",
        message: `${path}.lessonCompletionRule.minimumEvidencePerObjective must be at least 1.`,
        path: `${path}.lessonCompletionRule.minimumEvidencePerObjective`,
      });
    }
  }

  if (!blueprint.teachingRules || typeof blueprint.teachingRules !== "object") {
    errors.push({
      code: "TEACHING_RULES_MISSING",
      message: `Elvy blueprint "${blueprint.id}" must define teachingRules.`,
      path: `${path}.teachingRules`,
    });
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

  const teacherPlanUse = new Map<string, string[]>();
  const blueprintUse = new Map<string, string[]>();

  for (const lesson of lessons) {
    requiredText(lesson.id, "lesson.id", errors);
    requiredText(lesson.title, `lesson ${lesson.id}.title`, errors);
    requiredText(
      lesson.teacherPlanId,
      `lesson ${lesson.id}.teacherPlanId`,
      errors,
    );
    requiredText(
      lesson.elvyBlueprintId,
      `lesson ${lesson.id}.elvyBlueprintId`,
      errors,
    );

    teacherPlanUse.set(lesson.teacherPlanId, [
      ...(teacherPlanUse.get(lesson.teacherPlanId) || []),
      lesson.id,
    ]);
    blueprintUse.set(lesson.elvyBlueprintId, [
      ...(blueprintUse.get(lesson.elvyBlueprintId) || []),
      lesson.id,
    ]);

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

  for (const [id, lessonUses] of teacherPlanUse) {
    if (id && lessonUses.length > 1) {
      errors.push({
        code: "TEACHER_PLAN_REUSED",
        message: `Teacher plan "${id}" is reused by lessons: ${lessonUses.join(", ")}.`,
        path: "curriculum.units[].lessons[].teacherPlanId",
      });
    }
  }
  for (const [id, lessonUses] of blueprintUse) {
    if (id && lessonUses.length > 1) {
      errors.push({
        code: "ELVY_BLUEPRINT_REUSED",
        message: `Elvy blueprint "${id}" is reused by lessons: ${lessonUses.join(", ")}.`,
        path: "curriculum.units[].lessons[].elvyBlueprintId",
      });
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

  blueprints.forEach((blueprint, index) => {
    if (!lessonIds.has(blueprint.lessonId)) {
      errors.push({
        code: "ORPHAN_ELVY_BLUEPRINT",
        message: `Elvy blueprint "${blueprint.id}" references unknown lesson "${blueprint.lessonId}".`,
      });
    }

    const lesson = lessons.find((item) => item.id === blueprint.lessonId);
    validateExecutableBlueprint(
      blueprint,
      index,
      new Set(lesson?.assetIds || []),
      errors,
      warnings,
    );
  });

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
      message: `Manifest says ${pkg.manifest.units} units, but curriculum contains ${units.length}.`,
    });
  }
  if (pkg.manifest.lessons !== lessons.length) {
    warnings.push({
      code: "LESSON_COUNT_MISMATCH",
      message: `Manifest says ${pkg.manifest.lessons} lessons, but curriculum contains ${lessons.length}.`,
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}
