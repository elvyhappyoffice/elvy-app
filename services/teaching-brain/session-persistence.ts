/**
 * ELVY Teaching Platform
 * Teaching Session persistence coordinator.
 *
 * File: services/teaching-brain/session-persistence.ts
 *
 * This service:
 * - restores the latest resumable session for the learner and lesson
 * - creates the first persisted session
 * - saves the updated Teaching Brain session with optimistic concurrency
 */

import type { TeachingSessionState } from "./session-engine";
import type {
  TeachingSessionRecord,
  TeachingSessionRepository,
} from "../supabase/teaching-session-repository";

export type SessionPersistenceScope = Readonly<{
  learnerId: string;
  lessonId: string;
  curriculumId?: string;
  organizationId?: string;
}>;

export type PersistTeachingSessionInput = Readonly<{
  repository: TeachingSessionRepository;
  session: TeachingSessionState;

  /**
   * The record loaded before the turn. Omit it when this is a new session.
   */
  previousRecord?: TeachingSessionRecord | null;

  curriculumId?: string;
  organizationId?: string;
}>;

export class SessionPersistenceError extends Error {
  readonly code:
    | "SESSION_ID_MISMATCH"
    | "SESSION_SCOPE_MISMATCH"
    | "INVALID_REVISION";

  constructor(
    code: SessionPersistenceError["code"],
    message: string,
  ) {
    super(message);
    this.name = "SessionPersistenceError";
    this.code = code;
  }
}

export async function restoreStudentTeachingSession(
  repository: TeachingSessionRepository,
  scope: SessionPersistenceScope,
): Promise<TeachingSessionRecord | null> {
  return repository.findResumableSession(scope);
}

export async function persistStudentTeachingSession(
  input: PersistTeachingSessionInput,
): Promise<TeachingSessionRecord> {
  const {
    repository,
    session,
    previousRecord,
    curriculumId,
    organizationId,
  } = input;

  if (!previousRecord) {
    return repository.createSession({
      session,
      curriculumId,
      organizationId,
    });
  }

  if (previousRecord.sessionId !== session.id) {
    throw new SessionPersistenceError(
      "SESSION_ID_MISMATCH",
      "The updated Teaching Session does not match the restored session.",
    );
  }

  if (
    previousRecord.learnerId !== session.learnerId ||
    previousRecord.lessonId !== session.lessonId
  ) {
    throw new SessionPersistenceError(
      "SESSION_SCOPE_MISMATCH",
      "The updated Teaching Session changed learner or lesson ownership.",
    );
  }

  if (session.revision <= previousRecord.revision) {
    throw new SessionPersistenceError(
      "INVALID_REVISION",
      "The updated Teaching Session must have a newer revision.",
    );
  }

  return repository.saveSession({
    session,
    expectedRevision: previousRecord.revision,
    curriculumId,
    organizationId,
  });
}

export const TeachingSessionPersistence = Object.freeze({
  restore: restoreStudentTeachingSession,
  persist: persistStudentTeachingSession,
});
