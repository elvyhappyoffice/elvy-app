/**
 * Elvy Lesson Loader
 *
 * File: services/lesson-loader/lesson-loader.ts
 *
 * Responsibility:
 * Load one approved, runtime-ready lesson for one student and return the
 * validated TeachingBrainLesson consumed by the Lesson Director.
 *
 * Design:
 * - No direct database dependency.
 * - No AI calls.
 * - No student-response evaluation.
 * - No progress mutation.
 * - Stateless public API with optional short-lived caching.
 * - Concurrent requests for the same lesson share one in-flight load.
 */

import {
  parseTeachingBrainLesson,
  type LessonValidationIssue,
} from "../teaching-brain/lesson-schema";

import type {
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
} from "../teaching-brain/types";

/* -------------------------------------------------------------------------- */
/*                                  Contracts                                 */
/* -------------------------------------------------------------------------- */

export type LessonLocation = Readonly<{
  curriculumId: string;
  lessonId?: string;
  levelId?: string;
  sublevelId?: string;
  unitId?: string;
  lessonNumber?: number;
}>;

export type LessonLearnerContext = Readonly<{
  studentId: string;
  learnerL1?: string;
}>;

export type LoadLessonInput = Readonly<{
  location: LessonLocation;
  learner: LessonLearnerContext;

  /**
   * Bypasses the memory cache and asks the repository for the latest record.
   */
  forceRefresh?: boolean;
}>;

export type StoredLessonRecord = Readonly<{
  id: string;
  curriculumId: string;
  lessonId: string;

  levelId?: string;
  sublevelId?: string;
  unitId?: string;
  lessonNumber?: number;

  status: "draft" | "active" | "suspended" | "archived";
  version?: string;
  updatedAt?: string;

  /**
   * The normalized runtime lesson produced by the Curriculum Intelligence
   * Engine / Blueprint Adapter.
   */
  lesson: unknown;
}>;

export interface LessonRepository {
  findLesson(
    location: LessonLocation,
  ): Promise<StoredLessonRecord | null>;
}

export type LoadedLessonPackage = Readonly<{
  lesson: TeachingBrainLesson;

  source: Readonly<{
    recordId: string;
    curriculumId: string;
    lessonId: string;
    version?: string;
    updatedAt?: string;
  }>;

  learner: LessonLearnerContext;

  loadedAt: string;
  cache: Readonly<{
    hit: boolean;
    key: string;
  }>;
}>;

export type LoadLessonResult = TeachingBrainResult<LoadedLessonPackage>;

/* -------------------------------------------------------------------------- */
/*                                  Utilities                                 */
/* -------------------------------------------------------------------------- */

type CacheEntry = Readonly<{
  record: StoredLessonRecord;
  expiresAt: number;
}>;

export type LessonLoaderOptions = Readonly<{
  cacheTtlMs?: number;
  now?: () => Date;
}>;

const DEFAULT_CACHE_TTL_MS = 60_000;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePositiveInteger(value: unknown): number | undefined {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function buildLocationKey(location: LessonLocation): string {
  return [
    clean(location.curriculumId),
    clean(location.levelId),
    clean(location.sublevelId),
    clean(location.unitId),
    clean(location.lessonId),
    normalizePositiveInteger(location.lessonNumber) ?? "",
  ].join("::");
}

function validateInput(input: LoadLessonInput): TeachingBrainError | null {
  const studentId = clean(input?.learner?.studentId);
  const curriculumId = clean(input?.location?.curriculumId);
  const lessonId = clean(input?.location?.lessonId);
  const lessonNumber = normalizePositiveInteger(
    input?.location?.lessonNumber,
  );

  if (!studentId) {
    return {
      code: "INVALID_LESSON",
      message: "studentId is required.",
      recoverable: true,
    };
  }

  if (!curriculumId) {
    return {
      code: "INVALID_LESSON",
      message: "curriculumId is required.",
      recoverable: true,
    };
  }

  if (!lessonId && !lessonNumber) {
    return {
      code: "INVALID_LESSON",
      message: "Either lessonId or a positive lessonNumber is required.",
      recoverable: true,
    };
  }

  return null;
}

function toLoaderError(
  error: unknown,
  fallbackMessage: string,
): TeachingBrainError {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error
  ) {
    const candidate = error as {
      code?: unknown;
      message?: unknown;
      recoverable?: unknown;
      details?: unknown;
    };

    return {
      code: "INTERNAL_ERROR",
      message: clean(candidate.message) || fallbackMessage,
      recoverable:
        typeof candidate.recoverable === "boolean"
          ? candidate.recoverable
          : true,
      details:
        candidate.details &&
        typeof candidate.details === "object" &&
        !Array.isArray(candidate.details)
          ? (candidate.details as Record<string, unknown>)
          : undefined,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message:
      error instanceof Error && clean(error.message)
        ? error.message
        : fallbackMessage,
    recoverable: true,
  };
}

function invalidLessonError(
  issues: readonly LessonValidationIssue[],
): TeachingBrainError {
  return {
    code: "INVALID_LESSON",
    message:
      "The stored lesson is not valid for the Teaching Brain runtime.",
    recoverable: false,
    details: {
      issues: issues.map((issue) => ({
        path: issue.path,
        code: issue.code,
        message: issue.message,
      })),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                Lesson Loader                               */
/* -------------------------------------------------------------------------- */

export class LessonLoaderService {
  private readonly cache = new Map<string, CacheEntry>();

  private readonly inFlight = new Map<
    string,
    Promise<StoredLessonRecord | null>
  >();

  private readonly cacheTtlMs: number;

  private readonly now: () => Date;

  constructor(
    private readonly repository: LessonRepository,
    options: LessonLoaderOptions = {},
  ) {
    this.cacheTtlMs = Math.max(
      0,
      Number(options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS),
    );

    this.now = options.now ?? (() => new Date());
  }

  async load(input: LoadLessonInput): Promise<LoadLessonResult> {
    const inputError = validateInput(input);

    if (inputError) {
      return {
        ok: false,
        error: inputError,
      };
    }

    const location: LessonLocation = Object.freeze({
      curriculumId: clean(input.location.curriculumId),
      lessonId: clean(input.location.lessonId) || undefined,
      levelId: clean(input.location.levelId) || undefined,
      sublevelId: clean(input.location.sublevelId) || undefined,
      unitId: clean(input.location.unitId) || undefined,
      lessonNumber: normalizePositiveInteger(
        input.location.lessonNumber,
      ),
    });

    const learner: LessonLearnerContext = Object.freeze({
      studentId: clean(input.learner.studentId),
      learnerL1: clean(input.learner.learnerL1) || undefined,
    });

    const cacheKey = buildLocationKey(location);
    const nowMs = this.now().getTime();

    let cacheHit = false;
    let record: StoredLessonRecord | null = null;

    if (!input.forceRefresh) {
      const cached = this.cache.get(cacheKey);

      if (cached && cached.expiresAt > nowMs) {
        record = cached.record;
        cacheHit = true;
      } else if (cached) {
        this.cache.delete(cacheKey);
      }
    }

    if (!record) {
      try {
        record = await this.loadFromRepository(cacheKey, location);
      } catch (error) {
        return {
          ok: false,
          error: toLoaderError(
            error,
            "The lesson repository could not load the requested lesson.",
          ),
        };
      }

      if (record && this.cacheTtlMs > 0) {
        this.cache.set(cacheKey, {
          record,
          expiresAt: nowMs + this.cacheTtlMs,
        });
      }
    }

    if (!record) {
      return {
        ok: false,
        error: {
          code: "INVALID_LESSON",
          message: "The requested lesson could not be found.",
          recoverable: true,
          details: {
            curriculumId: location.curriculumId,
            lessonId: location.lessonId,
            lessonNumber: location.lessonNumber,
          },
        },
      };
    }

    if (record.status !== "active") {
      return {
        ok: false,
        error: {
          code: "LESSON_NOT_ACTIVE",
          message: "The requested lesson is not active.",
          recoverable: true,
          details: {
            recordId: record.id,
            status: record.status,
          },
        },
      };
    }

    if (
      location.lessonId &&
      clean(record.lessonId) !== location.lessonId
    ) {
      return {
        ok: false,
        error: {
          code: "INVALID_LESSON",
          message:
            "The loaded lesson does not match the requested lessonId.",
          recoverable: false,
          details: {
            requestedLessonId: location.lessonId,
            loadedLessonId: record.lessonId,
          },
        },
      };
    }

    let lesson: TeachingBrainLesson;

    try {
      lesson = parseTeachingBrainLesson(record.lesson);
    } catch (error) {
      const issues =
        error &&
        typeof error === "object" &&
        "issues" in error &&
        Array.isArray(
          (error as { issues?: unknown }).issues,
        )
          ? ((error as {
              issues: LessonValidationIssue[];
            }).issues)
          : [];

      return {
        ok: false,
        error:
          issues.length > 0
            ? invalidLessonError(issues)
            : {
                code: "INVALID_LESSON",
                message:
                  error instanceof Error
                    ? error.message
                    : "The stored lesson is invalid.",
                recoverable: false,
              },
      };
    }

    return {
      ok: true,
      data: Object.freeze({
        lesson,
        source: Object.freeze({
          recordId: record.id,
          curriculumId: record.curriculumId,
          lessonId: record.lessonId,
          version: record.version,
          updatedAt: record.updatedAt,
        }),
        learner,
        loadedAt: this.now().toISOString(),
        cache: Object.freeze({
          hit: cacheHit,
          key: cacheKey,
        }),
      }),
    };
  }

  clearCache(location?: LessonLocation): void {
    if (!location) {
      this.cache.clear();
      return;
    }

    this.cache.delete(buildLocationKey(location));
  }

  private async loadFromRepository(
    cacheKey: string,
    location: LessonLocation,
  ): Promise<StoredLessonRecord | null> {
    const existing = this.inFlight.get(cacheKey);

    if (existing) {
      return existing;
    }

    const request = this.repository.findLesson(location);

    this.inFlight.set(cacheKey, request);

    try {
      return await request;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                              Functional helpers                            */
/* -------------------------------------------------------------------------- */

export function createLessonLoader(
  repository: LessonRepository,
  options?: LessonLoaderOptions,
): LessonLoaderService {
  return new LessonLoaderService(repository, options);
}

export async function loadLesson(
  repository: LessonRepository,
  input: LoadLessonInput,
  options?: LessonLoaderOptions,
): Promise<LoadLessonResult> {
  return createLessonLoader(repository, options).load(input);
}

export const LessonLoader = Object.freeze({
  create: createLessonLoader,
  load: loadLesson,
});
