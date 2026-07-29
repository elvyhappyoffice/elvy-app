/**
 * ELVY Teaching Platform
 * Supabase persistence boundary for TeachingSessionState.
 *
 * File: services/supabase/teaching-session-repository.ts
 *
 * The Teaching Brain owns session behavior. This repository only loads,
 * creates, saves, and deletes immutable session snapshots.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SessionStatus,
  TeachingSessionState,
} from "../teaching-brain/session-engine";

export const TEACHING_SESSIONS_TABLE = "teaching_sessions" as const;

export type TeachingSessionRecord = Readonly<{
  id?: string;
  sessionId: string;
  learnerId: string;
  lessonId: string;
  status: SessionStatus;
  revision: number;
  session: TeachingSessionState;
  curriculumId?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}>;

export type FindTeachingSessionInput = Readonly<{
  learnerId: string;
  lessonId: string;
  curriculumId?: string;
  organizationId?: string;
}>;

export type CreateTeachingSessionInput = Readonly<{
  session: TeachingSessionState;
  curriculumId?: string;
  organizationId?: string;
}>;

export type SaveTeachingSessionInput = Readonly<{
  session: TeachingSessionState;
  expectedRevision: number;
  curriculumId?: string;
  organizationId?: string;
}>;

export interface TeachingSessionRepository {
  loadSession(sessionId: string): Promise<TeachingSessionRecord | null>;

  findLatestSession(
    input: FindTeachingSessionInput,
  ): Promise<TeachingSessionRecord | null>;

  findResumableSession(
    input: FindTeachingSessionInput,
  ): Promise<TeachingSessionRecord | null>;

  createSession(
    input: CreateTeachingSessionInput,
  ): Promise<TeachingSessionRecord>;

  saveSession(
    input: SaveTeachingSessionInput,
  ): Promise<TeachingSessionRecord>;

  deleteSession(sessionId: string): Promise<void>;
}

export type TeachingSessionRepositoryErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "REVISION_CONFLICT"
  | "DATABASE_ERROR"
  | "INVALID_DATABASE_ROW";

export class TeachingSessionRepositoryError extends Error {
  readonly code: TeachingSessionRepositoryErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: TeachingSessionRepositoryErrorCode,
    message: string,
    options: {
      cause?: unknown;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "TeachingSessionRepositoryError";
    this.code = code;
    this.details = options.details;
  }
}

type TeachingSessionRow = {
  id?: string | null;
  session_id: string;
  learner_id: string;
  lesson_id: string;
  status: string;
  revision: number;
  session_state: unknown;
  curriculum_id?: string | null;
  organization_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const SESSION_SELECT = [
  "id",
  "session_id",
  "learner_id",
  "lesson_id",
  "status",
  "revision",
  "session_state",
  "curriculum_id",
  "organization_id",
  "created_at",
  "updated_at",
].join(", ");

const RESUMABLE_STATUSES: readonly SessionStatus[] = [
  "created",
  "active",
  "paused",
];

export type SupabaseTeachingSessionRepositoryOptions = Readonly<{
  tableName?: string;
}>;

export class SupabaseTeachingSessionRepository
  implements TeachingSessionRepository
{
  private readonly tableName: string;

  constructor(
    private readonly supabase: SupabaseClient,
    options: SupabaseTeachingSessionRepositoryOptions = {},
  ) {
    this.tableName =
      clean(options.tableName) || TEACHING_SESSIONS_TABLE;
  }

  async loadSession(
    sessionId: string,
  ): Promise<TeachingSessionRecord | null> {
    requireText(sessionId, "sessionId");

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select(SESSION_SELECT)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      throw databaseError("Failed to load Teaching Session.", error);
    }

    return data ? mapRow(data) : null;
  }

  async findLatestSession(
    input: FindTeachingSessionInput,
  ): Promise<TeachingSessionRecord | null> {
    validateFindInput(input);

    let query = this.supabase
      .from(this.tableName)
      .select(SESSION_SELECT)
      .eq("learner_id", input.learnerId)
      .eq("lesson_id", input.lessonId);

    query = applyOptionalScope(query, input);

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw databaseError(
        "Failed to find the latest Teaching Session.",
        error,
      );
    }

    return data ? mapRow(data) : null;
  }

  async findResumableSession(
    input: FindTeachingSessionInput,
  ): Promise<TeachingSessionRecord | null> {
    validateFindInput(input);

    let query = this.supabase
      .from(this.tableName)
      .select(SESSION_SELECT)
      .eq("learner_id", input.learnerId)
      .eq("lesson_id", input.lessonId)
      .in("status", [...RESUMABLE_STATUSES]);

    query = applyOptionalScope(query, input);

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw databaseError(
        "Failed to find a resumable Teaching Session.",
        error,
      );
    }

    return data ? mapRow(data) : null;
  }

  async createSession(
    input: CreateTeachingSessionInput,
  ): Promise<TeachingSessionRecord> {
    validateSession(input.session);
    validateOptionalScope(input);

    const row = {
      session_id: input.session.id,
      learner_id: input.session.learnerId,
      lesson_id: input.session.lessonId,
      status: input.session.status,
      revision: input.session.revision,
      session_state: toJson(input.session),
      curriculum_id: input.curriculumId ?? null,
      organization_id: input.organizationId ?? null,
      updated_at: input.session.updatedAt,
    };

    const { data, error } = await this.supabase
      .from(this.tableName)
      .insert(row)
      .select(SESSION_SELECT)
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        throw new TeachingSessionRepositoryError(
          "ALREADY_EXISTS",
          `Teaching Session "${input.session.id}" already exists.`,
          { cause: error },
        );
      }

      throw databaseError("Failed to create Teaching Session.", error);
    }

    return mapRow(data);
  }

  async saveSession(
    input: SaveTeachingSessionInput,
  ): Promise<TeachingSessionRecord> {
    validateSession(input.session);
    validateExpectedRevision(input.expectedRevision);
    validateOptionalScope(input);

    if (input.session.revision <= input.expectedRevision) {
      throw new TeachingSessionRepositoryError(
        "INVALID_INPUT",
        "The new session revision must be greater than expectedRevision.",
        {
          details: {
            expectedRevision: input.expectedRevision,
            newRevision: input.session.revision,
          },
        },
      );
    }

    const update: Record<string, unknown> = {
      learner_id: input.session.learnerId,
      lesson_id: input.session.lessonId,
      status: input.session.status,
      revision: input.session.revision,
      session_state: toJson(input.session),
      updated_at: input.session.updatedAt,
    };

    if (input.curriculumId !== undefined) {
      update.curriculum_id = input.curriculumId;
    }

    if (input.organizationId !== undefined) {
      update.organization_id = input.organizationId;
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .update(update)
      .eq("session_id", input.session.id)
      .eq("revision", input.expectedRevision)
      .select(SESSION_SELECT)
      .maybeSingle();

    if (error) {
      throw databaseError("Failed to save Teaching Session.", error);
    }

    if (data) {
      return mapRow(data);
    }

    const current = await this.loadSession(input.session.id);

    if (!current) {
      throw new TeachingSessionRepositoryError(
        "NOT_FOUND",
        `Teaching Session "${input.session.id}" was not found.`,
      );
    }

    throw new TeachingSessionRepositoryError(
      "REVISION_CONFLICT",
      `Teaching Session "${input.session.id}" was updated by another request.`,
      {
        details: {
          expectedRevision: input.expectedRevision,
          databaseRevision: current.revision,
        },
      },
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    requireText(sessionId, "sessionId");

    const { error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq("session_id", sessionId);

    if (error) {
      throw databaseError("Failed to delete Teaching Session.", error);
    }
  }
}

export function createTeachingSessionRepository(
  supabase: SupabaseClient,
  options: SupabaseTeachingSessionRepositoryOptions = {},
): TeachingSessionRepository {
  return new SupabaseTeachingSessionRepository(supabase, options);
}

function mapRow(value: unknown): TeachingSessionRecord {
  const row = asRow(value);
  const session = parseSession(row.session_state);

  if (
    session.id !== row.session_id ||
    session.learnerId !== row.learner_id ||
    session.lessonId !== row.lesson_id ||
    session.status !== row.status ||
    session.revision !== row.revision
  ) {
    throw new TeachingSessionRepositoryError(
      "INVALID_DATABASE_ROW",
      `Teaching Session "${row.session_id}" has inconsistent indexed columns.`,
    );
  }

  return deepFreeze({
    id: row.id ?? undefined,
    sessionId: row.session_id,
    learnerId: row.learner_id,
    lessonId: row.lesson_id,
    status: session.status,
    revision: row.revision,
    session,
    curriculumId: row.curriculum_id ?? undefined,
    organizationId: row.organization_id ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  });
}

function asRow(value: unknown): TeachingSessionRow {
  if (!isRecord(value)) {
    throw invalidRow("The database response is not an object.");
  }

  const row: TeachingSessionRow = {
    id: optionalString(value.id),
    session_id: requiredString(value.session_id, "session_id"),
    learner_id: requiredString(value.learner_id, "learner_id"),
    lesson_id: requiredString(value.lesson_id, "lesson_id"),
    status: requiredString(value.status, "status"),
    revision: requiredInteger(value.revision, "revision"),
    session_state: value.session_state,
    curriculum_id: optionalString(value.curriculum_id),
    organization_id: optionalString(value.organization_id),
    created_at: optionalString(value.created_at),
    updated_at: optionalString(value.updated_at),
  };

  return row;
}

function parseSession(value: unknown): TeachingSessionState {
  if (!isTeachingSessionState(value)) {
    throw invalidRow("session_state is not a valid TeachingSessionState.");
  }

  return clone(value);
}

function isTeachingSessionState(
  value: unknown,
): value is TeachingSessionState {
  if (!isRecord(value)) return false;

  return (
    value.schemaVersion === "1.0" &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.lessonId) &&
    isNonEmptyString(value.learnerId) &&
    isSessionStatus(value.status) &&
    isIsoDate(value.createdAt) &&
    isIsoDate(value.updatedAt) &&
    isRecord(value.stageStates) &&
    isRecord(value.activityStates) &&
    isRecord(value.objectiveStates) &&
    isRecord(value.assessment) &&
    Array.isArray(value.completedStageIds) &&
    Array.isArray(value.skippedStageIds) &&
    Array.isArray(value.completedActivityIds) &&
    Array.isArray(value.skippedActivityIds) &&
    Array.isArray(value.events) &&
    Array.isArray(value.notes) &&
    Number.isInteger(value.revision) &&
    Number(value.revision) >= 0 &&
    isRecord(value.metadata)
  );
}

function validateSession(session: TeachingSessionState): void {
  if (!isTeachingSessionState(session)) {
    throw new TeachingSessionRepositoryError(
      "INVALID_INPUT",
      "session must be a valid TeachingSessionState.",
    );
  }
}

function validateFindInput(input: FindTeachingSessionInput): void {
  requireText(input.learnerId, "learnerId");
  requireText(input.lessonId, "lessonId");
  validateOptionalScope(input);
}

function validateOptionalScope(input: {
  curriculumId?: string;
  organizationId?: string;
}): void {
  if (input.curriculumId !== undefined) {
    requireText(input.curriculumId, "curriculumId");
  }

  if (input.organizationId !== undefined) {
    requireText(input.organizationId, "organizationId");
  }
}

function validateExpectedRevision(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new TeachingSessionRepositoryError(
      "INVALID_INPUT",
      "expectedRevision must be a non-negative integer.",
    );
  }
}

function applyOptionalScope<T extends {
  eq(column: string, value: string): T;
}>(
  query: T,
  input: {
    curriculumId?: string;
    organizationId?: string;
  },
): T {
  let scoped = query;

  if (input.curriculumId !== undefined) {
    scoped = scoped.eq("curriculum_id", input.curriculumId);
  }

  if (input.organizationId !== undefined) {
    scoped = scoped.eq("organization_id", input.organizationId);
  }

  return scoped;
}

function requireText(value: string, field: string): void {
  if (!clean(value)) {
    throw new TeachingSessionRepositoryError(
      "INVALID_INPUT",
      `${field} is required.`,
    );
  }
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(value: unknown, field: string): string {
  const result = clean(value);

  if (!result) {
    throw invalidRow(`${field} is missing.`);
  }

  return result;
}

function optionalString(value: unknown): string | undefined {
  const result = clean(value);
  return result || undefined;
}

function requiredInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw invalidRow(`${field} must be a non-negative integer.`);
  }

  return Number(value);
}

function isSessionStatus(value: unknown): value is SessionStatus {
  return [
    "created",
    "active",
    "paused",
    "completed",
    "abandoned",
    "expired",
    "error",
  ].includes(String(value));
}

function isIsoDate(value: unknown): boolean {
  return (
    typeof value === "string" &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value;

  Object.freeze(value);

  for (const child of Object.values(value as Record<string, unknown>)) {
    if (
      child &&
      typeof child === "object" &&
      !Object.isFrozen(child)
    ) {
      deepFreeze(child);
    }
  }

  return value;
}

function toJson<T>(value: T): T {
  return clone(value);
}

function invalidRow(
  message: string,
): TeachingSessionRepositoryError {
  return new TeachingSessionRepositoryError(
    "INVALID_DATABASE_ROW",
    message,
  );
}

function databaseError(
  message: string,
  cause: unknown,
): TeachingSessionRepositoryError {
  return new TeachingSessionRepositoryError(
    "DATABASE_ERROR",
    message,
    { cause },
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    isRecord(error) &&
    (error.code === "23505" ||
      String(error.message ?? "")
        .toLowerCase()
        .includes("duplicate key"))
  );
}
