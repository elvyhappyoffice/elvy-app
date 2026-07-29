import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CloudTeachingAsset = {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  file?: string;
  mimeType?: string;
  lessonStage?: string;
  pedagogicalRole?: string;
  learningObjective?: string;
  tags?: string[];
  visibleText?: string[];
  metadata?: Record<string, unknown>;
};

export type CloudLesson = {
  id: string;
  title: string;
  label?: string;
  lessonNumber?: string;
  pageRange?: string;
  duration?: string;
  order?: number;
  theme?: string;
  cefrLevel?: string;
  schoolGrade?: string;
  lessonPlanData: Record<string, unknown>;
  recordBookData?: Record<string, unknown>;
  blueprintData?: Record<string, unknown>;
  teachingAssets?: CloudTeachingAsset[];
};

export type CloudUnit = {
  id: string;
  title: string;
  label?: string;
  order?: number;
  pageRange?: string;
  mission?: string;
  objectives?: unknown[];
  competencies?: unknown[];
  lessons: CloudLesson[];
};

export type CloudSublevel = {
  id: string;
  title: string;
  code?: string;
  label?: string;
  order?: number;
  units: CloudUnit[];
};

export type CloudLevel = {
  id: string;
  title: string;
  code?: string;
  label?: string;
  order?: number;
  sublevels: CloudSublevel[];
};

export type SaveElvyPackageInput = {
  packageId: string;
  syllabusId: string;
  title: string;
  packageVersion?: string;
  schemaVersion?: number;
  packageType?: string;
  subjectCode?: string;
  subjectSlug?: string;
  language?: string;
  country?: string;
  curriculumName?: string;
  educationLevel?: string;
  schoolGrade?: string;
  targetStage?: string;
  publisher?: string;
  publicSummary?: string;
  targetAudience?: string[];
  sourceAlignment?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  originalFilename?: string;
  checksum?: string;
  importedBy?: string;
  createdBy?: string;
  level: CloudLevel;
  validation?: {
    status?: string;
    score?: number;
    engineVersion?: string;
    checks?: Record<string, unknown>;
    warnings?: unknown[];
    errors?: unknown[];
    missingSections?: unknown[];
  };
};

export type ElvyPackageListItem = {
  id: string;
  packageId: string;
  title: string;
  packageVersion: string;
  packageStatus: string;
  visibility: string;
  language: string | null;
  educationLevel: string | null;
  importedAt: string;
  unitCount: number;
  lessonCount: number;
  assetCount: number;
  subject: {
    code: string;
    name: string;
    slug: string;
  } | null;
};


export type ElvyDashboardPackage = {
  packageId: string;
  syllabusId: string;
  title: string;
  packageVersion: string;
  importedAt: string;
  level: CloudLevel;
  treeRecord: {
    syllabusId: string;
    title: string;
    levelId: string;
    levelTitle: string;
    sublevelIds: string[];
    units: number;
    lessons: number;
    generatedAt: string;
    status: "Approved";
  };
};

export type ElvyPackageDetails = {
  package: Record<string, unknown>;
  levels: Array<Record<string, unknown>>;
  sublevels: Array<Record<string, unknown>>;
  units: Array<Record<string, unknown>>;
  lessons: Array<Record<string, unknown>>;
  teacherPlans: Array<Record<string, unknown>>;
  recordBookEntries: Array<Record<string, unknown>>;
  elvyBlueprints: Array<Record<string, unknown>>;
  teachingAssets: Array<Record<string, unknown>>;
  lessonCompletion: Array<Record<string, unknown>>;
};

function requireEnvironment(name: string, fallbackName?: string): string {
  const value =
    process.env[name]?.trim() ||
    (fallbackName ? process.env[fallbackName]?.trim() : "");

  if (!value) {
    throw new Error(
      fallbackName
        ? `Missing ${name} (or ${fallbackName}) environment variable.`
        : `Missing ${name} environment variable.`,
    );
  }

  return value;
}

function createAdminClient(): SupabaseClient {
  const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parsePageRange(value?: string): {
  pageStart: number | null;
  pageEnd: number | null;
} {
  if (!value) return { pageStart: null, pageEnd: null };

  const numbers = value.match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];

  if (!numbers.length) {
    return { pageStart: null, pageEnd: null };
  }

  return {
    pageStart: numbers[0],
    pageEnd: numbers[1] ?? numbers[0],
  };
}

function parseDurationMinutes(value?: string): number | null {
  if (!value) return null;
  const match = value.match(/\d+/);
  if (!match) return null;

  const minutes = Number(match[0]);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function titleParts(value: string): { label: string; title: string } {
  const normalized = value.trim();
  const match = normalized.match(/^([^:]{1,80}):\s*(.+)$/);

  if (!match) {
    return { label: "", title: normalized };
  }

  return {
    label: match[1].trim(),
    title: match[2].trim(),
  };
}

async function throwOnError<T>(
  operation: string,
  promise: PromiseLike<{ data: T; error: any }>,
): Promise<T> {
  const { data, error } = await promise;

  if (error) {
    throw new Error(`${operation} failed: ${error.message}`, { cause: error });
  }

  return data;
}

async function findSubjectId(
  client: SupabaseClient,
  input: SaveElvyPackageInput,
): Promise<string | null> {
  const subjectSlug = input.subjectSlug?.trim().toLowerCase();
  const subjectCode = input.subjectCode?.trim().toUpperCase();

  let query = client.from("subjects").select("id").limit(1);

  if (subjectSlug) {
    query = query.eq("slug", subjectSlug);
  } else if (subjectCode) {
    query = query.eq("code", subjectCode);
  } else {
    query = query.eq("slug", "english");
  }

  const rows = await throwOnError("Subject lookup", query);
  return Array.isArray(rows) && rows[0]?.id ? String(rows[0].id) : null;
}

function countPackage(input: SaveElvyPackageInput): {
  unitCount: number;
  lessonCount: number;
  assetCount: number;
} {
  const units = input.level.sublevels.flatMap((sublevel) => sublevel.units || []);
  const lessons = units.flatMap((unit) => unit.lessons || []);
  const assetIds = new Set(
    lessons.flatMap((lesson) =>
      (lesson.teachingAssets || []).map((asset) => asset.id),
    ),
  );

  return {
    unitCount: units.length,
    lessonCount: lessons.length,
    assetCount: assetIds.size,
  };
}

async function deletePackageChildren(
  client: SupabaseClient,
  packageUuid: string,
): Promise<void> {
  await throwOnError(
    "Existing teaching asset cleanup",
    client.from("teaching_assets").delete().eq("package_id", packageUuid),
  );

  await throwOnError(
    "Existing curriculum hierarchy cleanup",
    client.from("levels").delete().eq("package_id", packageUuid),
  );
}

async function saveValidationReport(
  client: SupabaseClient,
  packageUuid: string,
  input: SaveElvyPackageInput,
): Promise<void> {
  const validation = input.validation;

  await throwOnError(
    "Previous validation report cleanup",
    client
      .from("package_validation_reports")
      .delete()
      .eq("package_id", packageUuid),
  );

  await throwOnError(
    "Validation report insert",
    client.from("package_validation_reports").insert({
      package_id: packageUuid,
      validation_status: validation?.status || "passed",
      validation_score:
        typeof validation?.score === "number" ? validation.score : null,
      engine_version:
        validation?.engineVersion || "elvy-ready-package-validator",
      schema_version: input.schemaVersion || 1,
      checks: validation?.checks || {},
      warnings: validation?.warnings || [],
      errors: validation?.errors || [],
      missing_sections: validation?.missingSections || [],
      approved_by: input.importedBy || "Founder",
      approved_at: new Date().toISOString(),
    }),
  );
}

async function createImportLog(
  client: SupabaseClient,
  input: SaveElvyPackageInput,
  packageUuid: string | null,
  status:
    | "started"
    | "validated"
    | "confirmed"
    | "completed"
    | "rejected"
    | "failed",
  details: {
    warning?: string;
    error?: unknown;
    summary?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const errorValue =
    details.error instanceof Error
      ? { name: details.error.name, message: details.error.message }
      : details.error
        ? { message: String(details.error) }
        : {};

  await throwOnError(
    "Package import log insert",
    client.from("package_import_logs").insert({
      package_id: packageUuid,
      manifest_package_id: input.packageId,
      original_filename: input.originalFilename || null,
      imported_by: input.importedBy || "Founder",
      import_status: status,
      warnings: details.warning ? [details.warning] : [],
      error_details: errorValue,
      import_summary: details.summary || {},
    }),
  );
}

async function saveHierarchy(
  client: SupabaseClient,
  packageUuid: string,
  input: SaveElvyPackageInput,
): Promise<void> {
  const levelParts = titleParts(input.level.title);

  const levelRow = await throwOnError(
    "Level insert",
    client
      .from("levels")
      .insert({
        package_id: packageUuid,
        external_id: input.level.id,
        code: input.level.code || null,
        label: input.level.label || levelParts.label || null,
        title: levelParts.title || input.level.title,
        display_order: input.level.order || 1,
        level_metadata: {},
      })
      .select("id")
      .single(),
  );

  const levelUuid = String((levelRow as any).id);

  for (let sublevelIndex = 0; sublevelIndex < input.level.sublevels.length; sublevelIndex += 1) {
    const sublevel = input.level.sublevels[sublevelIndex];
    const sublevelParts = titleParts(sublevel.title);

    const sublevelRow = await throwOnError(
      `Sublevel ${sublevel.id} insert`,
      client
        .from("sublevels")
        .insert({
          level_id: levelUuid,
          external_id: sublevel.id,
          code: sublevel.code || null,
          label: sublevel.label || sublevelParts.label || null,
          title: sublevelParts.title || sublevel.title,
          display_order: sublevel.order || sublevelIndex + 1,
          sublevel_metadata: {},
        })
        .select("id")
        .single(),
    );

    const sublevelUuid = String((sublevelRow as any).id);

    for (let unitIndex = 0; unitIndex < sublevel.units.length; unitIndex += 1) {
      const unit = sublevel.units[unitIndex];
      const unitParts = titleParts(unit.title);
      const unitPages = parsePageRange(unit.pageRange);

      const unitRow = await throwOnError(
        `Unit ${unit.id} insert`,
        client
          .from("units")
          .insert({
            package_id: packageUuid,
            level_id: levelUuid,
            sublevel_id: sublevelUuid,
            external_id: unit.id,
            label: unit.label || unitParts.label || null,
            title: unitParts.title || unit.title,
            display_title: unit.title,
            page_start: unitPages.pageStart,
            page_end: unitPages.pageEnd,
            page_range: unit.pageRange || null,
            display_order: unit.order || unitIndex + 1,
            mission: unit.mission || null,
            objectives: unit.objectives || [],
            competencies: unit.competencies || [],
            unit_metadata: {},
          })
          .select("id")
          .single(),
      );

      const unitUuid = String((unitRow as any).id);

      for (let lessonIndex = 0; lessonIndex < unit.lessons.length; lessonIndex += 1) {
        const lesson = unit.lessons[lessonIndex];
        const plan = objectValue(lesson.lessonPlanData);
        const lessonParts = titleParts(lesson.title);
        const lessonPages = parsePageRange(
          lesson.pageRange || stringValue(plan.pages),
        );
        const duration = lesson.duration || stringValue(plan.duration) || undefined;

        const lessonRow = await throwOnError(
          `Lesson ${lesson.id} insert`,
          client
            .from("lessons")
            .insert({
              package_id: packageUuid,
              unit_id: unitUuid,
              external_id: lesson.id,
              label: lesson.label || lessonParts.label || null,
              lesson_number:
                lesson.lessonNumber || stringValue(plan.lessonNumber) || null,
              title: lessonParts.title || lesson.title,
              display_title: lesson.title,
              lesson_type: null,
              theme: lesson.theme || stringValue(plan.theme) || null,
              page_start: lessonPages.pageStart,
              page_end: lessonPages.pageEnd,
              page_range: lesson.pageRange || stringValue(plan.pages) || null,
              duration_minutes: parseDurationMinutes(duration),
              duration_label: duration || null,
              cefr_level: lesson.cefrLevel || stringValue(plan.cefrLevel) || null,
              school_grade:
                lesson.schoolGrade || stringValue(plan.schoolGrade) || null,
              lesson_status: "ready",
              display_order: lesson.order || lessonIndex + 1,
              objectives: stringArray(plan.lessonObjectives),
              competencies: stringArray(plan.competencies),
              success_criteria: stringArray(plan.successCriteria),
              lesson_metadata: { syllabusId: input.syllabusId },
            })
            .select("id")
            .single(),
        );

        const lessonUuid = String((lessonRow as any).id);
        const blueprint =
          lesson.blueprintData || {
            stages: Array.isArray(plan.elvyBlueprint) ? plan.elvyBlueprint : [],
            teachingRules: objectValue(plan.elvyTeachingRules),
          };
        const recordBook = lesson.recordBookData || {
          source: "teacher-plan",
          lessonPlan: plan,
        };

        await Promise.all([
          throwOnError(
            `Teacher plan ${lesson.id} insert`,
            client.from("teacher_plans").insert({
              lesson_id: lessonUuid,
              external_id: `${lesson.id}:teacher-plan`,
              plan_version: input.packageVersion || "1.0",
              plan_status: "ready",
              plan_data: plan,
              generated_by:
                stringValue(plan.generatedBy) || input.createdBy || "Happy Office",
              approved_by: input.importedBy || "Founder",
              approved_at: new Date().toISOString(),
            }),
          ),
          throwOnError(
            `Record book ${lesson.id} insert`,
            client.from("record_book_entries").insert({
              lesson_id: lessonUuid,
              external_id: `${lesson.id}:record-book`,
              entry_version: input.packageVersion || "1.0",
              entry_status: "ready",
              entry_data: recordBook,
              generated_by:
                stringValue(plan.generatedBy) || input.createdBy || "Happy Office",
              approved_by: input.importedBy || "Founder",
              approved_at: new Date().toISOString(),
            }),
          ),
          throwOnError(
            `Elvy blueprint ${lesson.id} insert`,
            client.from("elvy_blueprints").insert({
              lesson_id: lessonUuid,
              external_id: `${lesson.id}:elvy-blueprint`,
              blueprint_version: input.packageVersion || "1.0",
              blueprint_status: "ready",
              blueprint_data: blueprint,
              engine_version: "EULD-v1",
              generated_by:
                stringValue(plan.generatedBy) || input.createdBy || "Happy Office",
              approved_by: input.importedBy || "Founder",
              approved_at: new Date().toISOString(),
            }),
          ),
        ]);

        for (let assetIndex = 0; assetIndex < (lesson.teachingAssets || []).length; assetIndex += 1) {
          const asset = (lesson.teachingAssets || [])[assetIndex];

          await throwOnError(
            `Teaching asset ${asset.id} insert`,
            client.from("teaching_assets").insert({
              package_id: packageUuid,
              lesson_id: lessonUuid,
              external_id: asset.id,
              asset_type: asset.type || "other",
              title: asset.title || asset.id,
              description: asset.description || null,
              file_name: asset.file || null,
              storage_bucket: null,
              storage_path: null,
              mime_type: asset.mimeType || null,
              lesson_stage: asset.lessonStage || null,
              pedagogical_role: asset.pedagogicalRole || null,
              learning_objective: asset.learningObjective || null,
              tags: asset.tags || [],
              visible_text: asset.visibleText || [],
              asset_metadata: asset.metadata || {},
              asset_status: "ready",
              display_order: assetIndex + 1,
            }),
          );
        }

        await throwOnError(
          `Lesson completion ${lesson.id} insert`,
          client.from("lesson_completion").insert({
            lesson_id: lessonUuid,
            completion_percent: 100,
            completed_sections: 12,
            in_progress_sections: 0,
            empty_sections: 0,
            total_sections: 12,
            section_states: { source: "validated-gsrp", state: "complete" },
            completion_metadata: {
              packageId: input.packageId,
              externalLessonId: lesson.id,
            },
            calculated_at: new Date().toISOString(),
          }),
        );
      }
    }
  }
}


function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildDashboardLevel(details: ElvyPackageDetails): CloudLevel | null {
  const levelRows = details.levels as any[];
  const sublevelRows = details.sublevels as any[];
  const unitRows = details.units as any[];
  const lessonRows = details.lessons as any[];
  const teacherPlanRows = details.teacherPlans as any[];
  const recordBookRows = details.recordBookEntries as any[];
  const blueprintRows = details.elvyBlueprints as any[];
  const assetRows = details.teachingAssets as any[];

  const levelRow = [...levelRows].sort(
    (a, b) => numberValue(a.display_order, 1) - numberValue(b.display_order, 1),
  )[0];

  if (!levelRow) return null;

  const levelUuid = String(levelRow.id);
  const levelExternalId = String(levelRow.external_id || levelUuid);

  const levelSublevels = sublevelRows
    .filter((row) => String(row.level_id) === levelUuid)
    .sort(
      (a, b) =>
        numberValue(a.display_order, 1) - numberValue(b.display_order, 1),
    )
    .map((sublevelRow) => {
      const sublevelUuid = String(sublevelRow.id);
      const sublevelExternalId = String(
        sublevelRow.external_id || sublevelUuid,
      );

      const sublevelUnits = unitRows
        .filter((row) => String(row.sublevel_id) === sublevelUuid)
        .sort(
          (a, b) =>
            numberValue(a.display_order, 1) -
            numberValue(b.display_order, 1),
        )
        .map((unitRow) => {
          const unitUuid = String(unitRow.id);
          const unitExternalId = String(unitRow.external_id || unitUuid);

          const unitLessons = lessonRows
            .filter((row) => String(row.unit_id) === unitUuid)
            .sort(
              (a, b) =>
                numberValue(a.display_order, 1) -
                numberValue(b.display_order, 1),
            )
            .map((lessonRow) => {
              const lessonUuid = String(lessonRow.id);
              const lessonExternalId = String(
                lessonRow.external_id || lessonUuid,
              );
              const teacherPlan = teacherPlanRows.find(
                (row) => String(row.lesson_id) === lessonUuid,
              );
              const recordBook = recordBookRows.find(
                (row) => String(row.lesson_id) === lessonUuid,
              );
              const blueprint = blueprintRows.find(
                (row) => String(row.lesson_id) === lessonUuid,
              );
              const teachingAssets = assetRows
                .filter((row) => String(row.lesson_id) === lessonUuid)
                .sort(
                  (a, b) =>
                    numberValue(a.display_order, 1) -
                    numberValue(b.display_order, 1),
                )
                .map((assetRow) => ({
                  id: String(assetRow.external_id || assetRow.id),
                  type: assetRow.asset_type || undefined,
                  title: assetRow.title || undefined,
                  description: assetRow.description || undefined,
                  file: assetRow.file_name || undefined,
                  mimeType: assetRow.mime_type || undefined,
                  lessonStage: assetRow.lesson_stage || undefined,
                  pedagogicalRole: assetRow.pedagogical_role || undefined,
                  learningObjective: assetRow.learning_objective || undefined,
                  tags: Array.isArray(assetRow.tags) ? assetRow.tags : [],
                  visibleText: Array.isArray(assetRow.visible_text)
                    ? assetRow.visible_text
                    : [],
                  metadata: objectValue(assetRow.asset_metadata),
                }));

              return {
                id: lessonExternalId,
                title: String(
                  lessonRow.display_title ||
                    lessonRow.title ||
                    lessonExternalId,
                ),
                label: lessonRow.label || undefined,
                lessonNumber: lessonRow.lesson_number || undefined,
                pageRange: lessonRow.page_range || undefined,
                duration: lessonRow.duration_label || undefined,
                order: numberValue(lessonRow.display_order, 1),
                theme: lessonRow.theme || undefined,
                cefrLevel: lessonRow.cefr_level || undefined,
                schoolGrade: lessonRow.school_grade || undefined,
                lessonPlanData: objectValue(teacherPlan?.plan_data),
                recordBookData: objectValue(recordBook?.entry_data),
                blueprintData: objectValue(blueprint?.blueprint_data),
                teachingAssets,
              } satisfies CloudLesson;
            });

          return {
            id: unitExternalId,
            title: String(unitRow.display_title || unitRow.title || unitExternalId),
            label: unitRow.label || undefined,
            order: numberValue(unitRow.display_order, 1),
            pageRange: unitRow.page_range || undefined,
            mission: unitRow.mission || undefined,
            objectives: Array.isArray(unitRow.objectives)
              ? unitRow.objectives
              : [],
            competencies: Array.isArray(unitRow.competencies)
              ? unitRow.competencies
              : [],
            lessons: unitLessons,
          } satisfies CloudUnit;
        });

      return {
        id: sublevelExternalId,
        title: String(sublevelRow.title || sublevelExternalId),
        code: sublevelRow.code || undefined,
        label: sublevelRow.label || undefined,
        order: numberValue(sublevelRow.display_order, 1),
        units: sublevelUnits,
      } satisfies CloudSublevel;
    });

  return {
    id: levelExternalId,
    title: String(levelRow.title || levelExternalId),
    code: levelRow.code || undefined,
    label: levelRow.label || undefined,
    order: numberValue(levelRow.display_order, 1),
    sublevels: levelSublevels,
  };
}

export const ElvyPackageRepository = {
  async savePackage(
    input: SaveElvyPackageInput,
  ): Promise<{ id: string; packageId: string; title: string }> {
    const client = createAdminClient();
    const counts = countPackage(input);
    let packageUuid: string | null = null;

    await createImportLog(client, input, null, "started", { summary: counts });

    try {
      const subjectId = await findSubjectId(client, input);

      const packageRow = await throwOnError(
        "Elvy package upsert",
        client
          .from("elvy_packages")
          .upsert(
            {
              package_id: input.packageId,
              package_type: input.packageType || "GSRP",
              schema_version: input.schemaVersion || 1,
              package_version: input.packageVersion || "1.0",
              subject_id: subjectId,
              title: input.title,
              language: input.language || "English",
              country: input.country || null,
              curriculum_name: input.curriculumName || null,
              education_level: input.educationLevel || null,
              school_grade: input.schoolGrade || null,
              target_stage: input.targetStage || null,
              publisher: input.publisher || null,
              public_summary:
                input.publicSummary ||
                `${input.title} is a validated Elvy learning package.`,
              target_audience: input.targetAudience || [],
              source_alignment: input.sourceAlignment || {},
              package_metadata: {
                ...(input.metadata || {}),
                syllabusId: input.syllabusId,
              },
              original_filename: input.originalFilename || null,
              package_checksum: input.checksum || null,
              created_by: input.createdBy || "Happy Office",
              imported_by: input.importedBy || "Founder",
              package_status: "imported",
              visibility: "founder",
              quality_status: input.validation?.status || "passed",
              unit_count: counts.unitCount,
              lesson_count: counts.lessonCount,
              asset_count: counts.assetCount,
              imported_at: new Date().toISOString(),
            },
            { onConflict: "package_id" },
          )
          .select("id, package_id, title")
          .single(),
      );

      packageUuid = String((packageRow as any).id);

      await deletePackageChildren(client, packageUuid);
      await saveHierarchy(client, packageUuid, input);
      await saveValidationReport(client, packageUuid, input);
      await createImportLog(client, input, packageUuid, "completed", {
        summary: counts,
      });

      return {
        id: packageUuid,
        packageId: String((packageRow as any).package_id),
        title: String((packageRow as any).title),
      };
    } catch (error) {
      try {
        if (packageUuid) {
          await client
            .from("elvy_packages")
            .update({ package_status: "failed", quality_status: "failed" })
            .eq("id", packageUuid);
        }

        await createImportLog(client, input, packageUuid, "failed", {
          error,
          summary: counts,
        });
      } catch (loggingError) {
        console.error(
          "[ElvyPackageRepository] Could not write failure log:",
          loggingError,
        );
      }

      throw error;
    }
  },

  async listPackages(): Promise<ElvyPackageListItem[]> {
    const client = createAdminClient();

    const rows = await throwOnError(
      "Elvy package list",
      client
        .from("elvy_packages")
        .select(
          `
            id,
            package_id,
            title,
            package_version,
            package_status,
            visibility,
            language,
            education_level,
            imported_at,
            unit_count,
            lesson_count,
            asset_count,
            subjects (code, name, slug)
          `,
        )
        .neq("package_status", "archived")
        .order("imported_at", { ascending: false }),
    );

    return (rows as any[]).map((row) => ({
      id: String(row.id),
      packageId: String(row.package_id),
      title: String(row.title),
      packageVersion: String(row.package_version || "1.0"),
      packageStatus: String(row.package_status || "imported"),
      visibility: String(row.visibility || "founder"),
      language: row.language ? String(row.language) : null,
      educationLevel: row.education_level ? String(row.education_level) : null,
      importedAt: String(row.imported_at),
      unitCount: Number(row.unit_count || 0),
      lessonCount: Number(row.lesson_count || 0),
      assetCount: Number(row.asset_count || 0),
      subject: row.subjects
        ? {
            code: String(row.subjects.code),
            name: String(row.subjects.name),
            slug: String(row.subjects.slug),
          }
        : null,
    }));
  },

  async getPackage(packageId: string): Promise<ElvyPackageDetails | null> {
    const client = createAdminClient();

    const packageRow = await throwOnError(
      "Elvy package lookup",
      client
        .from("elvy_packages")
        .select("*")
        .eq("package_id", packageId)
        .maybeSingle(),
    );

    if (!packageRow) return null;

    const packageUuid = String((packageRow as any).id);

    const [
      levels,
      sublevels,
      units,
      lessons,
      teacherPlans,
      recordBookEntries,
      elvyBlueprints,
      teachingAssets,
      lessonCompletion,
    ] = await Promise.all([
      throwOnError(
        "Levels lookup",
        client.from("levels").select("*").eq("package_id", packageUuid),
      ),
      throwOnError(
        "Sublevels lookup",
        client
          .from("sublevels")
          .select("*, levels!inner(package_id)")
          .eq("levels.package_id", packageUuid),
      ),
      throwOnError(
        "Units lookup",
        client.from("units").select("*").eq("package_id", packageUuid),
      ),
      throwOnError(
        "Lessons lookup",
        client.from("lessons").select("*").eq("package_id", packageUuid),
      ),
      throwOnError(
        "Teacher plans lookup",
        client
          .from("teacher_plans")
          .select("*, lessons!inner(package_id)")
          .eq("lessons.package_id", packageUuid),
      ),
      throwOnError(
        "Record-book entries lookup",
        client
          .from("record_book_entries")
          .select("*, lessons!inner(package_id)")
          .eq("lessons.package_id", packageUuid),
      ),
      throwOnError(
        "Elvy blueprints lookup",
        client
          .from("elvy_blueprints")
          .select("*, lessons!inner(package_id)")
          .eq("lessons.package_id", packageUuid),
      ),
      throwOnError(
        "Teaching assets lookup",
        client
          .from("teaching_assets")
          .select("*")
          .eq("package_id", packageUuid),
      ),
      throwOnError(
        "Lesson completion lookup",
        client
          .from("lesson_completion")
          .select("*, lessons!inner(package_id)")
          .eq("lessons.package_id", packageUuid),
      ),
    ]);

    return {
      package: packageRow as Record<string, unknown>,
      levels: levels as Array<Record<string, unknown>>,
      sublevels: sublevels as Array<Record<string, unknown>>,
      units: units as Array<Record<string, unknown>>,
      lessons: lessons as Array<Record<string, unknown>>,
      teacherPlans: teacherPlans as Array<Record<string, unknown>>,
      recordBookEntries: recordBookEntries as Array<Record<string, unknown>>,
      elvyBlueprints: elvyBlueprints as Array<Record<string, unknown>>,
      teachingAssets: teachingAssets as Array<Record<string, unknown>>,
      lessonCompletion: lessonCompletion as Array<Record<string, unknown>>,
    };
  },


  async listDashboardPackages(): Promise<ElvyDashboardPackage[]> {
    const packageList = await this.listPackages();

    const dashboardPackages = await Promise.all(
      packageList.map(async (item) => {
        const details = await this.getPackage(item.packageId);
        if (!details) return null;

        const level = buildDashboardLevel(details);
        if (!level) return null;

        const packageRow = details.package as Record<string, unknown>;
        const metadata = objectValue(packageRow.package_metadata);
        const syllabusId =
          stringValue(metadata.syllabusId) || item.packageId;
        const unitCount = level.sublevels.reduce(
          (total, sublevel) => total + sublevel.units.length,
          0,
        );
        const lessonCount = level.sublevels.reduce(
          (total, sublevel) =>
            total +
            sublevel.units.reduce(
              (unitTotal, unit) => unitTotal + unit.lessons.length,
              0,
            ),
          0,
        );

        return {
          packageId: item.packageId,
          syllabusId,
          title: item.title,
          packageVersion: item.packageVersion,
          importedAt: item.importedAt,
          level,
          treeRecord: {
            syllabusId,
            title: item.title,
            levelId: level.id,
            levelTitle: level.title,
            sublevelIds: level.sublevels.map((sublevel) => sublevel.id),
            units: unitCount,
            lessons: lessonCount,
            generatedAt: item.importedAt,
            status: "Approved",
          },
        } satisfies ElvyDashboardPackage;
      }),
    );

    return dashboardPackages.filter(
      (item): item is ElvyDashboardPackage => Boolean(item),
    );
  },

  async deletePackage(packageId: string): Promise<boolean> {
    const client = createAdminClient();

    const packageRow = await throwOnError(
      "Package lookup before delete",
      client
        .from("elvy_packages")
        .select("id")
        .eq("package_id", packageId)
        .maybeSingle(),
    );

    if (!packageRow) return false;

    const packageUuid = String((packageRow as any).id);

    const lessonRows = await throwOnError(
      "Package lesson lookup before delete",
      client
        .from("lessons")
        .select("id")
        .eq("package_id", packageUuid),
    );

    const lessonIds = Array.isArray(lessonRows)
      ? lessonRows
          .map((row: any) => String(row?.id || "").trim())
          .filter(Boolean)
      : [];

    if (lessonIds.length > 0) {
      await throwOnError(
        "Lesson completion cleanup",
        client.from("lesson_completion").delete().in("lesson_id", lessonIds),
      );

      await throwOnError(
        "Teacher plan cleanup",
        client.from("teacher_plans").delete().in("lesson_id", lessonIds),
      );

      await throwOnError(
        "Record-book cleanup",
        client.from("record_book_entries").delete().in("lesson_id", lessonIds),
      );

      await throwOnError(
        "Elvy blueprint cleanup",
        client.from("elvy_blueprints").delete().in("lesson_id", lessonIds),
      );
    }

    await throwOnError(
      "Teaching asset cleanup",
      client.from("teaching_assets").delete().eq("package_id", packageUuid),
    );

    await throwOnError(
      "Lesson cleanup",
      client.from("lessons").delete().eq("package_id", packageUuid),
    );

    await throwOnError(
      "Unit cleanup",
      client.from("units").delete().eq("package_id", packageUuid),
    );

    await throwOnError(
      "Curriculum hierarchy cleanup",
      client.from("levels").delete().eq("package_id", packageUuid),
    );

    await throwOnError(
      "Validation report cleanup",
      client
        .from("package_validation_reports")
        .delete()
        .eq("package_id", packageUuid),
    );

    await throwOnError(
      "Package import log cleanup",
      client
        .from("package_import_logs")
        .delete()
        .eq("package_id", packageUuid),
    );

    await throwOnError(
      "Elvy package delete",
      client.from("elvy_packages").delete().eq("id", packageUuid),
    );

    return true;
  },
};
