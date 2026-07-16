/**
 * Centralized local cleanup for a Curriculum Reader resource.
 *
 * This service removes all browser-side data linked to a syllabus:
 * - Elvy Library record
 * - Academic profile
 * - Curriculum tree record
 * - Generated level
 * - Lesson Plan Studio localStorage records
 * - Preflight state
 * - Pending Library open/re-analysis requests
 *
 * Original PDF/DOCX source-file cleanup was removed in the GSRP-only architecture.
 * Supabase cleanup can later replace or extend this service while keeping
 * the same public contract.
 */

import { ElvyLibrary } from "./elvy-library";

const SYLLABUS_UPLOADS_KEY = "elvy-syllabus-uploads-v1";
const CURRICULUM_TREES_KEY = "elvy-curriculum-reader-trees-v1";
const LIBRARY_OPEN_REQUEST_KEY = "elvy-library-open-resource";
const LIBRARY_REANALYSE_REQUEST_KEY = "elvy-library-reanalyse-resource";

const KNOWN_PREFLIGHT_KEYS = [
  "elvy-curriculum-preflight-v1",
  "elvy-curriculum-reader-preflight-v1",
  "elvy-curriculum-preflight-summary-v1",
  "elvy-curriculum-reader-preflight-summary-v1",
];

type LocalStorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

type SyllabusUploadRecord = {
  id: string;
  [key: string]: unknown;
};

type CurriculumTreeRecord = {
  syllabusId: string;
  levelId?: string;
  sublevelIds?: string[];
  [key: string]: unknown;
};

type CurriculumLevel = {
  id: string;
  title?: string;
  sublevels?: Array<{
    id: string;
    units?: Array<{
      id: string;
      lessons?: Array<{
        id: string;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

type CurriculumApiShape = {
  levels?: CurriculumLevel[];
  [key: string]: unknown;
};

export type DeleteCurriculumResourceInput = {
  resourceId?: string;
  syllabusId: string;
  levelId?: string;
  /**
   * Optional endpoint used by the founder dashboard to persist generated
   * curriculum levels. Defaults to /api/curriculum.
   */
  curriculumApiPath?: string;
};

export type DeleteCurriculumResourceResult = {
  success: boolean;
  syllabusId: string;
  resourceId?: string;
  levelId?: string;
  removed: {
    libraryRecord: boolean;
    academicProfile: boolean;
    curriculumTreeRecord: boolean;
    generatedLevel: boolean;
    lessonPlanRecords: number;
    preflightRecords: number;
    pendingRequests: number;
    structureArtifacts: number;
    sourceFile: boolean;
  };
  warnings: string[];
};

export type CurriculumResourceCleanupErrorCode =
  | "UNSUPPORTED_ENVIRONMENT"
  | "INVALID_INPUT"
  | "CURRICULUM_LOAD_FAILED"
  | "CURRICULUM_SAVE_FAILED"
  | "CLEANUP_FAILED";

export class CurriculumResourceCleanupError extends Error {
  readonly code: CurriculumResourceCleanupErrorCode;
  readonly cause?: unknown;

  constructor(
    code: CurriculumResourceCleanupErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "CurriculumResourceCleanupError";
    this.code = code;
    this.cause = cause;
  }
}

function ensureBrowserEnvironment(): {
  storage: LocalStorageLike;
  fetcher: typeof fetch;
} {
  if (
    typeof window === "undefined" ||
    !window.localStorage ||
    typeof window.fetch !== "function"
  ) {
    throw new CurriculumResourceCleanupError(
      "UNSUPPORTED_ENVIRONMENT",
      "Curriculum resource cleanup can only run in the browser.",
    );
  }

  return {
    storage: window.localStorage,
    fetcher: window.fetch.bind(window),
  };
}

function normalizeRequiredId(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new CurriculumResourceCleanupError(
      "INVALID_INPUT",
      `${label} is required.`,
    );
  }

  return normalized;
}

function parseArray<T>(rawValue: string | null): T[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function setJson(storage: LocalStorageLike, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value));
}

function collectLessonIdsFromLevel(level: CurriculumLevel | undefined): string[] {
  if (!level?.sublevels?.length) return [];

  return level.sublevels.flatMap((sublevel) =>
    (sublevel.units || []).flatMap((unit) =>
      (unit.lessons || [])
        .map((lesson) => lesson.id)
        .filter((lessonId): lessonId is string => Boolean(lessonId)),
    ),
  );
}

function removeLessonPlanRecords(
  storage: LocalStorageLike,
  lessonIds: string[],
): number {
  const keysToDelete = new Set<string>();

  for (const lessonId of lessonIds) {
    keysToDelete.add(`elvy-lesson-plan-${lessonId}`);
  }

  // Also remove records that explicitly contain the syllabus/lesson relation
  // in their key when custom variants are used.
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;

    if (
      key.startsWith("elvy-lesson-plan-") &&
      lessonIds.some((lessonId) => key.includes(lessonId))
    ) {
      keysToDelete.add(key);
    }
  }

  keysToDelete.forEach((key) => storage.removeItem(key));
  return keysToDelete.size;
}

function removePreflightRecords(
  storage: LocalStorageLike,
  syllabusId: string,
): number {
  const keysToDelete = new Set<string>();

  for (const key of KNOWN_PREFLIGHT_KEYS) {
    const rawValue = storage.getItem(key);
    if (!rawValue) continue;

    try {
      const parsed = JSON.parse(rawValue);

      if (Array.isArray(parsed)) {
        const nextValue = parsed.filter(
          (item) =>
            !item ||
            typeof item !== "object" ||
            !("syllabusId" in item) ||
            item.syllabusId !== syllabusId,
        );

        if (nextValue.length !== parsed.length) {
          setJson(storage, key, nextValue);
          keysToDelete.add(key);
        }
      } else if (
        parsed &&
        typeof parsed === "object" &&
        "syllabusId" in parsed &&
        parsed.syllabusId === syllabusId
      ) {
        storage.removeItem(key);
        keysToDelete.add(key);
      }
    } catch {
      // Ignore malformed unrelated data.
    }
  }

  // Catch custom per-syllabus preflight keys.
  const dynamicKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;

    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("preflight") &&
      normalizedKey.includes(syllabusId.toLowerCase())
    ) {
      dynamicKeys.push(key);
    }
  }

  dynamicKeys.forEach((key) => {
    storage.removeItem(key);
    keysToDelete.add(key);
  });

  return keysToDelete.size;
}

function removePendingRequest(
  storage: LocalStorageLike,
  key: string,
  resourceId: string | undefined,
  syllabusId: string,
): boolean {
  const rawValue = storage.getItem(key);
  if (!rawValue) return false;

  try {
    const request = JSON.parse(rawValue) as {
      resourceId?: string;
      syllabusId?: string;
    };

    const matches =
      request.syllabusId === syllabusId ||
      Boolean(resourceId && request.resourceId === resourceId);

    if (!matches) return false;
  } catch {
    // A malformed pending request is safer to clear.
  }

  storage.removeItem(key);
  return true;
}

async function loadCurriculum(
  fetcher: typeof fetch,
  apiPath: string,
): Promise<CurriculumApiShape> {
  const response = await fetcher(apiPath, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new CurriculumResourceCleanupError(
      "CURRICULUM_LOAD_FAILED",
      "Elvy could not load the saved curriculum before cleanup.",
    );
  }

  const data = await response.json();

  if (data?.success && data?.curriculum) {
    return data.curriculum as CurriculumApiShape;
  }

  if (Array.isArray(data?.levels)) {
    return { levels: data.levels as CurriculumLevel[] };
  }

  return { levels: [] };
}

async function saveCurriculum(
  fetcher: typeof fetch,
  apiPath: string,
  curriculum: CurriculumApiShape,
): Promise<void> {
  const response = await fetcher(apiPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...curriculum,
      levels: curriculum.levels || [],
    }),
  });

  if (!response.ok) {
    throw new CurriculumResourceCleanupError(
      "CURRICULUM_SAVE_FAILED",
      "Elvy removed local records but could not save the updated curriculum.",
    );
  }
}

/**
 * Deletes every local record linked to a Curriculum Reader resource.
 */
export async function deleteCurriculumResource(
  input: DeleteCurriculumResourceInput,
): Promise<DeleteCurriculumResourceResult> {
  const syllabusId = normalizeRequiredId(input.syllabusId, "syllabusId");
  const resourceId = input.resourceId?.trim() || undefined;
  const requestedLevelId = input.levelId?.trim() || undefined;
  const curriculumApiPath = input.curriculumApiPath || "/api/curriculum";
  const { storage, fetcher } = ensureBrowserEnvironment();

  const result: DeleteCurriculumResourceResult = {
    success: false,
    syllabusId,
    resourceId,
    levelId: requestedLevelId,
    removed: {
      libraryRecord: false,
      academicProfile: false,
      curriculumTreeRecord: false,
      generatedLevel: false,
      lessonPlanRecords: 0,
      preflightRecords: 0,
      pendingRequests: 0,
      structureArtifacts: 0,
      sourceFile: false,
    },
    warnings: [],
  };

  try {
    const treeRecords = parseArray<CurriculumTreeRecord>(
      storage.getItem(CURRICULUM_TREES_KEY),
    );
    const linkedTreeRecord = treeRecords.find(
      (record) => record.syllabusId === syllabusId,
    );
    const effectiveLevelId = requestedLevelId || linkedTreeRecord?.levelId;

    result.levelId = effectiveLevelId;

    // Load the curriculum first so lesson IDs can be removed safely.
    let curriculum: CurriculumApiShape = { levels: [] };
    try {
      curriculum = await loadCurriculum(fetcher, curriculumApiPath);
    } catch (error) {
      result.warnings.push(
        error instanceof Error
          ? error.message
          : "The generated curriculum could not be loaded.",
      );
    }

    const levels = Array.isArray(curriculum.levels) ? curriculum.levels : [];
    const linkedLevel = effectiveLevelId
      ? levels.find((level) => level.id === effectiveLevelId)
      : levels.find((level) => level.id.includes(syllabusId));

    const lessonIds = collectLessonIdsFromLevel(linkedLevel);

    if (linkedLevel) {
      const nextCurriculum: CurriculumApiShape = {
        ...curriculum,
        levels: levels.filter((level) => level.id !== linkedLevel.id),
      };

      try {
        await saveCurriculum(fetcher, curriculumApiPath, nextCurriculum);
        result.removed.generatedLevel = true;
      } catch (error) {
        result.warnings.push(
          error instanceof Error
            ? error.message
            : "The generated curriculum level could not be removed.",
        );
      }
    }

    result.removed.lessonPlanRecords = removeLessonPlanRecords(
      storage,
      lessonIds,
    );

    const syllabusProfiles = parseArray<SyllabusUploadRecord>(
      storage.getItem(SYLLABUS_UPLOADS_KEY),
    );
    const nextProfiles = syllabusProfiles.filter(
      (profile) => profile.id !== syllabusId,
    );

    if (nextProfiles.length !== syllabusProfiles.length) {
      setJson(storage, SYLLABUS_UPLOADS_KEY, nextProfiles);
      result.removed.academicProfile = true;
    }

    const nextTreeRecords = treeRecords.filter(
      (record) => record.syllabusId !== syllabusId,
    );

    if (nextTreeRecords.length !== treeRecords.length) {
      setJson(storage, CURRICULUM_TREES_KEY, nextTreeRecords);
      result.removed.curriculumTreeRecord = true;
    }

    result.removed.preflightRecords = removePreflightRecords(
      storage,
      syllabusId,
    );

    for (const key of [
      `elvy-page-manifest-${syllabusId}`,
      `elvy-detected-structure-${syllabusId}`,
    ]) {
      if (storage.getItem(key) !== null) {
        storage.removeItem(key);
        result.removed.structureArtifacts += 1;
      }
    }

    if (
      removePendingRequest(
        storage,
        LIBRARY_OPEN_REQUEST_KEY,
        resourceId,
        syllabusId,
      )
    ) {
      result.removed.pendingRequests += 1;
    }

    if (
      removePendingRequest(
        storage,
        LIBRARY_REANALYSE_REQUEST_KEY,
        resourceId,
        syllabusId,
      )
    ) {
      result.removed.pendingRequests += 1;
    }

    // GSRP-only architecture does not retain original PDF/DOCX source files.
    // Keep this compatibility flag false for existing callers.
    result.removed.sourceFile = false;

    const libraryResource =
      (resourceId ? ElvyLibrary.getById(resourceId) : null) ||
      ElvyLibrary.findBySyllabusId(syllabusId);

    if (libraryResource) {
      result.removed.libraryRecord = ElvyLibrary.delete(libraryResource.id);
    }

    result.success =
      result.removed.libraryRecord ||
      result.removed.academicProfile ||
      result.removed.curriculumTreeRecord ||
      result.removed.generatedLevel ||
      result.removed.lessonPlanRecords > 0 ||
      result.removed.preflightRecords > 0 ||
      result.removed.pendingRequests > 0;

    return result;
  } catch (error) {
    if (error instanceof CurriculumResourceCleanupError) throw error;

    throw new CurriculumResourceCleanupError(
      "CLEANUP_FAILED",
      "Elvy could not complete the curriculum resource cleanup.",
      error,
    );
  }
}

export const CurriculumResourceCleanup = {
  deleteCurriculumResource,
};
