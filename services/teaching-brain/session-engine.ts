/**
 * Elvy Teaching Brain
 * Session runtime and lesson navigation
 *
 * File: services/teaching-brain/session-engine.ts
 *
 * Responsibilities:
 * - create and restore teaching sessions
 * - manage session lifecycle
 * - track the active stage and activity
 * - record attempts, support usage, scores, and objective progress
 * - enforce stage/activity navigation rules
 * - expose deterministic snapshots for persistence
 *
 * Deliberately excluded:
 * - interpreting learner language (response-evaluator.ts)
 * - choosing pedagogical interventions (decision-engine.ts)
 * - generating support content (support-engine.ts)
 * - final lesson mastery decisions (lesson-completion.ts)
 */

import type {
  TeachingActivity,
  TeachingBrainLesson,
  TeachingStage,
} from "./types";

export type SessionStatus =
  | "created"
  | "active"
  | "paused"
  | "completed"
  | "abandoned"
  | "expired"
  | "error";

export type RuntimeItemStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped"
  | "blocked";

export type SessionEventType =
  | "session_created"
  | "session_started"
  | "session_paused"
  | "session_resumed"
  | "session_completed"
  | "session_abandoned"
  | "session_expired"
  | "stage_started"
  | "stage_completed"
  | "stage_skipped"
  | "activity_started"
  | "activity_attempt_recorded"
  | "activity_support_used"
  | "activity_completed"
  | "activity_skipped"
  | "activity_changed"
  | "objective_progress_updated"
  | "assessment_updated"
  | "session_note_added"
  | "state_restored";

export type SessionEvent = {
  id: string;
  sessionId: string;
  type: SessionEventType;
  timestamp: string;
  stageId?: string;
  activityId?: string;
  objectiveId?: string;
  payload?: Record<string, unknown>;
};

export type ActivityAttemptOutcome =
  | "successful"
  | "partly_successful"
  | "unsuccessful"
  | "no_response"
  | "off_topic"
  | "help_requested"
  | "not_evaluated";

export type SessionActivityAttempt = {
  id: string;
  number: number;
  startedAt: string;
  completedAt: string;
  outcome: ActivityAttemptOutcome;
  score?: number;
  confidence?: number;
  learnerTurnId?: string;
  evaluationId?: string;
  teachingDecisionId?: string;
  supportLevelBefore: number;
  supportLevelAfter: number;
  notes?: string[];
};

export type SupportUsageRecord = {
  id: string;
  supportLevel: number;
  supportType: string;
  usedAt: string;
  attemptNumber: number;
  content?: string;
};

export type ActivityRuntimeState = {
  activityId: string;
  stageId: string;
  status: RuntimeItemStatus;
  startedAt?: string;
  completedAt?: string;
  skippedAt?: string;
  attempts: SessionActivityAttempt[];
  supportHistory: SupportUsageRecord[];
  currentSupportLevel: number;
  successfulTurns: number;
  correctAnswers: number;
  latestScore?: number;
  bestScore?: number;
  averageScore?: number;
  completionReason?: string;
  skipReason?: string;
};

export type StageRuntimeState = {
  stageId: string;
  status: RuntimeItemStatus;
  startedAt?: string;
  completedAt?: string;
  skippedAt?: string;
  currentActivityId?: string;
  completedActivityIds: string[];
  skippedActivityIds: string[];
  score?: number;
  completionReason?: string;
  skipReason?: string;
};

export type ObjectiveRuntimeState = {
  objectiveId: string;
  status: "not_started" | "in_progress" | "mastered" | "needs_support";
  progress: number;
  masteryScore: number;
  attempts: number;
  successes: number;
  lastUpdatedAt?: string;
  evidenceActivityIds: string[];
};

export type AssessmentRuntimeState = {
  status: "not_started" | "in_progress" | "passed" | "failed";
  startedAt?: string;
  completedAt?: string;
  score?: number;
  passingPercentage: number;
  attempts: number;
  criterionScores: Record<string, number>;
};

export type SessionNote = {
  id: string;
  createdAt: string;
  category:
    | "teacher"
    | "learner"
    | "system"
    | "technical"
    | "safety"
    | "adaptation";
  text: string;
  stageId?: string;
  activityId?: string;
};

export type TeachingSessionState = {
  schemaVersion: "1.0";
  id: string;
  lessonId: string;
  learnerId: string;
  status: SessionStatus;

  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  abandonedAt?: string;
  expiresAt?: string;

  activeStageId?: string;
  activeActivityId?: string;

  stageStates: Record<string, StageRuntimeState>;
  activityStates: Record<string, ActivityRuntimeState>;
  objectiveStates: Record<string, ObjectiveRuntimeState>;
  assessment: AssessmentRuntimeState;

  totalActiveSeconds: number;
  activePeriodStartedAt?: string;

  completedStageIds: string[];
  skippedStageIds: string[];
  completedActivityIds: string[];
  skippedActivityIds: string[];

  events: SessionEvent[];
  notes: SessionNote[];

  revision: number;
  metadata: Record<string, unknown>;
};

export type CreateSessionInput = {
  lesson: TeachingBrainLesson;
  learnerId: string;
  sessionId?: string;
  now?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};

export type RestoreSessionInput = {
  lesson: TeachingBrainLesson;
  state: TeachingSessionState;
  now?: string;
};

export type RecordAttemptInput = {
  outcome: ActivityAttemptOutcome;
  score?: number;
  confidence?: number;
  learnerTurnId?: string;
  evaluationId?: string;
  teachingDecisionId?: string;
  notes?: string[];
  occurredAt?: string;
};

export type UseSupportInput = {
  level: number;
  type: string;
  content?: string;
  occurredAt?: string;
};

export type UpdateObjectiveInput = {
  objectiveId: string;
  progress?: number;
  masteryScore?: number;
  success?: boolean;
  evidenceActivityId?: string;
  occurredAt?: string;
};

export type UpdateAssessmentInput = {
  score?: number;
  criterionScores?: Record<string, number>;
  completed?: boolean;
  occurredAt?: string;
};

export type SessionSnapshot = {
  session: TeachingSessionState;
  lessonId: string;
  currentStage?: TeachingStage;
  currentActivity?: TeachingActivity;
  canMoveNext: boolean;
  canMovePrevious: boolean;
  isTerminal: boolean;
};

export type SessionEngineErrorCode =
  | "INVALID_SESSION"
  | "INVALID_TRANSITION"
  | "SESSION_NOT_ACTIVE"
  | "SESSION_TERMINAL"
  | "STAGE_NOT_FOUND"
  | "ACTIVITY_NOT_FOUND"
  | "STAGE_BLOCKED"
  | "ACTIVITY_BLOCKED"
  | "ACTIVITY_NOT_COMPLETE"
  | "STAGE_NOT_COMPLETE"
  | "SKIP_NOT_ALLOWED"
  | "SUPPORT_LEVEL_INVALID"
  | "ATTEMPT_LIMIT_REACHED"
  | "OBJECTIVE_NOT_FOUND"
  | "ASSESSMENT_INVALID";

export class SessionEngineError extends Error {
  readonly code: SessionEngineErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: SessionEngineErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SessionEngineError";
    this.code = code;
    this.details = details;
  }
}

function nowIso(value?: string): string {
  if (value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new SessionEngineError(
        "INVALID_SESSION",
        `Invalid ISO date: ${value}`,
      );
    }
    return date.toISOString();
  }

  return new Date().toISOString();
}

function createId(prefix: string): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

  return `${prefix}-${uuid}`;
}

function clamp(value: number, minimum = 0, maximum = 100): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number | undefined {
  const valid = values.filter(Number.isFinite);
  if (valid.length === 0) return undefined;
  return round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function stageById(
  lesson: TeachingBrainLesson,
  stageId: string,
): TeachingStage | undefined {
  return lesson.stages.find((stage) => stage.id === stageId);
}

function activityById(
  lesson: TeachingBrainLesson,
  activityId: string,
): { stage: TeachingStage; activity: TeachingActivity } | undefined {
  for (const stage of lesson.stages) {
    const activity = stage.activities.find((item) => item.id === activityId);
    if (activity) return { stage, activity };
  }

  return undefined;
}

function orderedStages(lesson: TeachingBrainLesson): TeachingStage[] {
  return [...lesson.stages].sort((a, b) => a.order - b.order);
}

function orderedActivities(stage: TeachingStage): TeachingActivity[] {
  return [...stage.activities].sort((a, b) => a.order - b.order);
}

function ensureNonTerminal(state: TeachingSessionState): void {
  if (
    state.status === "completed" ||
    state.status === "abandoned" ||
    state.status === "expired" ||
    state.status === "error"
  ) {
    throw new SessionEngineError(
      "SESSION_TERMINAL",
      `Session "${state.id}" is already ${state.status}.`,
      { sessionId: state.id, status: state.status },
    );
  }
}

function ensureActive(state: TeachingSessionState): void {
  ensureNonTerminal(state);

  if (state.status !== "active") {
    throw new SessionEngineError(
      "SESSION_NOT_ACTIVE",
      `Session "${state.id}" must be active. Current status: ${state.status}.`,
      { sessionId: state.id, status: state.status },
    );
  }
}

function addEvent(
  state: TeachingSessionState,
  type: SessionEventType,
  timestamp: string,
  input: Omit<SessionEvent, "id" | "sessionId" | "type" | "timestamp"> = {},
): void {
  state.events.push({
    id: createId("event"),
    sessionId: state.id,
    type,
    timestamp,
    ...input,
  });
}

function touch(state: TeachingSessionState, timestamp: string): void {
  state.updatedAt = timestamp;
  state.revision += 1;
}

function finalizeActivePeriod(
  state: TeachingSessionState,
  timestamp: string,
): void {
  if (!state.activePeriodStartedAt) return;

  const started = new Date(state.activePeriodStartedAt).getTime();
  const ended = new Date(timestamp).getTime();

  if (Number.isFinite(started) && Number.isFinite(ended) && ended >= started) {
    state.totalActiveSeconds += Math.floor((ended - started) / 1000);
  }

  state.activePeriodStartedAt = undefined;
}

function initializeStageState(stage: TeachingStage): StageRuntimeState {
  return {
    stageId: stage.id,
    status: "not_started",
    completedActivityIds: [],
    skippedActivityIds: [],
  };
}

function initializeActivityState(
  stage: TeachingStage,
  activity: TeachingActivity,
): ActivityRuntimeState {
  return {
    activityId: activity.id,
    stageId: stage.id,
    status: "not_started",
    attempts: [],
    supportHistory: [],
    currentSupportLevel: 0,
    successfulTurns: 0,
    correctAnswers: 0,
  };
}

function initializeObjectiveState(objectiveId: string): ObjectiveRuntimeState {
  return {
    objectiveId,
    status: "not_started",
    progress: 0,
    masteryScore: 0,
    attempts: 0,
    successes: 0,
    evidenceActivityIds: [],
  };
}

function validateSessionAgainstLesson(
  lesson: TeachingBrainLesson,
  state: TeachingSessionState,
): void {
  if (state.lessonId !== lesson.id) {
    throw new SessionEngineError(
      "INVALID_SESSION",
      `Session lesson "${state.lessonId}" does not match loaded lesson "${lesson.id}".`,
    );
  }

  for (const stage of lesson.stages) {
    if (!state.stageStates[stage.id]) {
      throw new SessionEngineError(
        "INVALID_SESSION",
        `Session is missing runtime state for stage "${stage.id}".`,
      );
    }

    for (const activity of stage.activities) {
      if (!state.activityStates[activity.id]) {
        throw new SessionEngineError(
          "INVALID_SESSION",
          `Session is missing runtime state for activity "${activity.id}".`,
        );
      }
    }
  }

  for (const objective of lesson.objectives) {
    if (!state.objectiveStates[objective.id]) {
      throw new SessionEngineError(
        "INVALID_SESSION",
        `Session is missing runtime state for objective "${objective.id}".`,
      );
    }
  }

  if (state.activeStageId && !stageById(lesson, state.activeStageId)) {
    throw new SessionEngineError(
      "INVALID_SESSION",
      `Active stage "${state.activeStageId}" does not exist in the lesson.`,
    );
  }

  if (state.activeActivityId && !activityById(lesson, state.activeActivityId)) {
    throw new SessionEngineError(
      "INVALID_SESSION",
      `Active activity "${state.activeActivityId}" does not exist in the lesson.`,
    );
  }
}

function isActivityCompleteByRule(
  activity: TeachingActivity,
  runtime: ActivityRuntimeState,
): boolean {
  if (runtime.status === "completed") return true;

  const rule = activity.successRule;
  const attempts = runtime.attempts.length;

  if (attempts < activity.minimumAttempts) return false;

  switch (rule.type) {
    case "minimum_score":
      return (
        runtime.bestScore !== undefined &&
        runtime.bestScore >= (rule.minimumScore ?? 0)
      );

    case "minimum_correct_answers":
      return runtime.correctAnswers >= (rule.minimumCorrectAnswers ?? 1);

    case "minimum_successful_turns":
      return runtime.successfulTurns >= (rule.minimumSuccessfulTurns ?? 1);

    case "semantic_match":
      return (
        runtime.bestScore !== undefined &&
        runtime.bestScore >= (rule.semanticThreshold ?? 0)
      );

    case "manual":
      // A manual activity is complete only when completeActivity(..., force=true)
      // has already marked it completed; that case is handled at the top.
      return false;

    default:
      return runtime.attempts.some(
        (attempt) => attempt.outcome === "successful",
      );
  }
}

function calculateStageScore(
  stage: TeachingStage,
  state: TeachingSessionState,
): number | undefined {
  return average(
    stage.activities
      .map((activity) => state.activityStates[activity.id]?.bestScore)
      .filter((score): score is number => score !== undefined),
  );
}

function isStageCompleteByRule(
  stage: TeachingStage,
  state: TeachingSessionState,
): boolean {
  const runtime = state.stageStates[stage.id];
  if (runtime.status === "completed") return true;

  const activities = orderedActivities(stage);
  const completed = activities.filter(
    (activity) =>
      state.activityStates[activity.id]?.status === "completed",
  );
  const successful = activities.filter((activity) =>
    isActivityCompleteByRule(activity, state.activityStates[activity.id]),
  );
  const requiredIds =
    stage.completionRule.requiredActivityIds ??
    activities.filter((activity) => activity.required).map((item) => item.id);

  switch (stage.completionRule.type) {
    case "all_required_activities_completed":
      return requiredIds.every(
        (id) => state.activityStates[id]?.status === "completed",
      );

    case "minimum_score_reached":
      return (
        (calculateStageScore(stage, state) ?? 0) >=
        (stage.completionRule.minimumScore ?? 0)
      );

    case "minimum_successes_reached":
      return (
        successful.length >=
        (stage.completionRule.minimumSuccessfulActivities ?? 1)
      );

    case "time_limit_reached": {
      if (!runtime.startedAt || !stage.completionRule.maximumMinutes) {
        return false;
      }
      const elapsed =
        Date.now() - new Date(runtime.startedAt).getTime();
      return elapsed >= stage.completionRule.maximumMinutes * 60_000;
    }

    case "manual":
    case "teacher_brain_decision":
      // These rules require an explicit engine/teacher action. A completed
      // runtime is handled by the early return at the top of this function.
      return false;

    default:
      return completed.length === activities.length;
  }
}

function nextIncompleteActivity(
  stage: TeachingStage,
  state: TeachingSessionState,
): TeachingActivity | undefined {
  return orderedActivities(stage).find((activity) => {
    const runtime = state.activityStates[activity.id];
    return runtime.status !== "completed" && runtime.status !== "skipped";
  });
}

function firstAvailableStage(
  lesson: TeachingBrainLesson,
  state: TeachingSessionState,
): TeachingStage | undefined {
  return orderedStages(lesson).find((stage) => {
    const runtime = state.stageStates[stage.id];
    return runtime.status !== "completed" && runtime.status !== "skipped";
  });
}

export function createTeachingSession(
  input: CreateSessionInput,
): TeachingSessionState {
  const timestamp = nowIso(input.now);

  if (!input.learnerId.trim()) {
    throw new SessionEngineError(
      "INVALID_SESSION",
      "learnerId is required.",
    );
  }

  if (!Array.isArray(input.lesson.stages) || input.lesson.stages.length === 0) {
    throw new SessionEngineError(
      "INVALID_SESSION",
      "Cannot create a session for a lesson without stages.",
    );
  }

  const stageStates: Record<string, StageRuntimeState> = {};
  const activityStates: Record<string, ActivityRuntimeState> = {};
  const objectiveStates: Record<string, ObjectiveRuntimeState> = {};

  for (const stage of input.lesson.stages) {
    stageStates[stage.id] = initializeStageState(stage);

    for (const activity of stage.activities) {
      activityStates[activity.id] = initializeActivityState(stage, activity);
    }
  }

  for (const objective of input.lesson.objectives) {
    objectiveStates[objective.id] = initializeObjectiveState(objective.id);
  }

  const state: TeachingSessionState = {
    schemaVersion: "1.0",
    id: input.sessionId?.trim() || createId("session"),
    lessonId: input.lesson.id,
    learnerId: input.learnerId.trim(),
    status: "created",
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt: input.expiresAt ? nowIso(input.expiresAt) : undefined,
    stageStates,
    activityStates,
    objectiveStates,
    assessment: {
      status: "not_started",
      passingPercentage: input.lesson.assessment.passingPercentage,
      attempts: 0,
      criterionScores: {},
    },
    totalActiveSeconds: 0,
    completedStageIds: [],
    skippedStageIds: [],
    completedActivityIds: [],
    skippedActivityIds: [],
    events: [],
    notes: [],
    revision: 1,
    metadata: deepClone(input.metadata ?? {}),
  };

  addEvent(state, "session_created", timestamp, {
    payload: {
      lessonId: input.lesson.id,
      learnerId: input.learnerId,
    },
  });

  validateSessionAgainstLesson(input.lesson, state);
  return state;
}

export function restoreTeachingSession(
  input: RestoreSessionInput,
): TeachingSessionState {
  const state = deepClone(input.state);
  const timestamp = nowIso(input.now);

  validateSessionAgainstLesson(input.lesson, state);

  if (state.status === "active" && !state.activePeriodStartedAt) {
    state.activePeriodStartedAt = timestamp;
  }

  addEvent(state, "state_restored", timestamp, {
    payload: { previousRevision: state.revision },
  });
  touch(state, timestamp);

  return state;
}

export class TeachingSessionEngine {
  readonly lesson: TeachingBrainLesson;
  private state: TeachingSessionState;

  constructor(lesson: TeachingBrainLesson, state: TeachingSessionState) {
    this.lesson = lesson;
    this.state = deepClone(state);
    validateSessionAgainstLesson(this.lesson, this.state);
  }

  static create(input: CreateSessionInput): TeachingSessionEngine {
    return new TeachingSessionEngine(
      input.lesson,
      createTeachingSession(input),
    );
  }

  static restore(input: RestoreSessionInput): TeachingSessionEngine {
    return new TeachingSessionEngine(
      input.lesson,
      restoreTeachingSession(input),
    );
  }

  getState(): TeachingSessionState {
    return deepClone(this.state);
  }

  snapshot(): SessionSnapshot {
    const currentStage = this.getCurrentStage();
    const currentActivity = this.getCurrentActivity();

    return {
      session: this.getState(),
      lessonId: this.lesson.id,
      currentStage,
      currentActivity,
      canMoveNext: Boolean(this.peekNextActivity()),
      canMovePrevious: Boolean(this.peekPreviousActivity()),
      isTerminal:
        this.state.status === "completed" ||
        this.state.status === "abandoned" ||
        this.state.status === "expired" ||
        this.state.status === "error",
    };
  }

  start(occurredAt?: string): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureNonTerminal(this.state);

    if (this.state.status === "active") return this.snapshot();

    if (this.state.status === "paused") {
      return this.resume(timestamp);
    }

    if (this.state.status !== "created") {
      throw new SessionEngineError(
        "INVALID_TRANSITION",
        `Cannot start a session from status "${this.state.status}".`,
      );
    }

    this.state.status = "active";
    this.state.startedAt = timestamp;
    this.state.activePeriodStartedAt = timestamp;

    addEvent(this.state, "session_started", timestamp);
    touch(this.state, timestamp);

    const stage = firstAvailableStage(this.lesson, this.state);
    if (!stage) return this.complete("No teachable stage remains.", timestamp);

    this.startStage(stage.id, timestamp);
    return this.snapshot();
  }

  pause(reason?: string, occurredAt?: string): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureActive(this.state);

    finalizeActivePeriod(this.state, timestamp);
    this.state.status = "paused";
    this.state.pausedAt = timestamp;

    addEvent(this.state, "session_paused", timestamp, {
      payload: reason ? { reason } : undefined,
    });
    touch(this.state, timestamp);

    return this.snapshot();
  }

  resume(occurredAt?: string): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureNonTerminal(this.state);

    if (this.state.status !== "paused") {
      throw new SessionEngineError(
        "INVALID_TRANSITION",
        `Cannot resume a session from status "${this.state.status}".`,
      );
    }

    this.state.status = "active";
    this.state.pausedAt = undefined;
    this.state.activePeriodStartedAt = timestamp;

    addEvent(this.state, "session_resumed", timestamp);
    touch(this.state, timestamp);

    return this.snapshot();
  }

  abandon(reason: string, occurredAt?: string): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureNonTerminal(this.state);

    finalizeActivePeriod(this.state, timestamp);
    this.state.status = "abandoned";
    this.state.abandonedAt = timestamp;

    addEvent(this.state, "session_abandoned", timestamp, {
      payload: { reason },
    });
    touch(this.state, timestamp);

    return this.snapshot();
  }

  expire(reason = "Session expired.", occurredAt?: string): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureNonTerminal(this.state);

    finalizeActivePeriod(this.state, timestamp);
    this.state.status = "expired";

    addEvent(this.state, "session_expired", timestamp, {
      payload: { reason },
    });
    touch(this.state, timestamp);

    return this.snapshot();
  }

  complete(reason = "Lesson completed.", occurredAt?: string): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureNonTerminal(this.state);

    finalizeActivePeriod(this.state, timestamp);
    this.state.status = "completed";
    this.state.completedAt = timestamp;
    this.state.activeStageId = undefined;
    this.state.activeActivityId = undefined;

    addEvent(this.state, "session_completed", timestamp, {
      payload: {
        reason,
        assessmentScore: this.state.assessment.score,
      },
    });
    touch(this.state, timestamp);

    return this.snapshot();
  }

  getCurrentStage(): TeachingStage | undefined {
    return this.state.activeStageId
      ? stageById(this.lesson, this.state.activeStageId)
      : undefined;
  }

  getCurrentActivity(): TeachingActivity | undefined {
    if (!this.state.activeActivityId) return undefined;
    return activityById(this.lesson, this.state.activeActivityId)?.activity;
  }

  startStage(stageId: string, occurredAt?: string): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureActive(this.state);

    const stage = stageById(this.lesson, stageId);
    if (!stage) {
      throw new SessionEngineError(
        "STAGE_NOT_FOUND",
        `Stage "${stageId}" was not found.`,
      );
    }

    const runtime = this.state.stageStates[stageId];

    if (runtime.status === "completed" || runtime.status === "skipped") {
      throw new SessionEngineError(
        "STAGE_BLOCKED",
        `Stage "${stageId}" is already ${runtime.status}.`,
      );
    }

    this.state.activeStageId = stageId;
    runtime.status = "in_progress";
    runtime.startedAt ??= timestamp;

    addEvent(this.state, "stage_started", timestamp, {
      stageId,
      payload: { title: stage.title },
    });

    const activity = nextIncompleteActivity(stage, this.state);
    if (activity) {
      this.startActivity(activity.id, timestamp);
    } else if (isStageCompleteByRule(stage, this.state)) {
      this.completeStage("Stage completion rule satisfied.", timestamp);
    }

    touch(this.state, timestamp);
    return this.snapshot();
  }

  completeStage(
    reason = "Stage completed.",
    occurredAt?: string,
    force = false,
  ): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureActive(this.state);

    const stage = this.getCurrentStage();
    if (!stage) {
      throw new SessionEngineError(
        "STAGE_NOT_FOUND",
        "There is no active stage.",
      );
    }

    if (!force && !isStageCompleteByRule(stage, this.state)) {
      throw new SessionEngineError(
        "STAGE_NOT_COMPLETE",
        `Stage "${stage.id}" has not satisfied its completion rule.`,
      );
    }

    const runtime = this.state.stageStates[stage.id];
    runtime.status = "completed";
    runtime.completedAt = timestamp;
    runtime.score = calculateStageScore(stage, this.state);
    runtime.completionReason = reason;
    runtime.currentActivityId = undefined;

    if (!this.state.completedStageIds.includes(stage.id)) {
      this.state.completedStageIds.push(stage.id);
    }

    this.state.activeActivityId = undefined;

    addEvent(this.state, "stage_completed", timestamp, {
      stageId: stage.id,
      payload: { reason, score: runtime.score },
    });

    const nextStage = this.peekNextStage();
    touch(this.state, timestamp);

    if (nextStage) {
      return this.startStage(nextStage.id, timestamp);
    }

    return this.complete("All lesson stages are complete.", timestamp);
  }

  skipStage(reason: string, occurredAt?: string): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureActive(this.state);

    const stage = this.getCurrentStage();
    if (!stage) {
      throw new SessionEngineError(
        "STAGE_NOT_FOUND",
        "There is no active stage.",
      );
    }

    if (!stage.skippable) {
      throw new SessionEngineError(
        "SKIP_NOT_ALLOWED",
        `Stage "${stage.id}" is not skippable.`,
      );
    }

    const runtime = this.state.stageStates[stage.id];
    runtime.status = "skipped";
    runtime.skippedAt = timestamp;
    runtime.skipReason = reason;
    runtime.currentActivityId = undefined;

    if (!this.state.skippedStageIds.includes(stage.id)) {
      this.state.skippedStageIds.push(stage.id);
    }

    this.state.activeActivityId = undefined;

    addEvent(this.state, "stage_skipped", timestamp, {
      stageId: stage.id,
      payload: { reason },
    });
    touch(this.state, timestamp);

    const next = this.peekNextStage();
    return next
      ? this.startStage(next.id, timestamp)
      : this.complete("No remaining lesson stages.", timestamp);
  }

  startActivity(activityId: string, occurredAt?: string): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureActive(this.state);

    const found = activityById(this.lesson, activityId);
    if (!found) {
      throw new SessionEngineError(
        "ACTIVITY_NOT_FOUND",
        `Activity "${activityId}" was not found.`,
      );
    }

    if (
      this.state.activeStageId &&
      found.stage.id !== this.state.activeStageId
    ) {
      throw new SessionEngineError(
        "ACTIVITY_BLOCKED",
        `Activity "${activityId}" does not belong to the active stage.`,
      );
    }

    const runtime = this.state.activityStates[activityId];

    if (runtime.status === "completed" || runtime.status === "skipped") {
      throw new SessionEngineError(
        "ACTIVITY_BLOCKED",
        `Activity "${activityId}" is already ${runtime.status}.`,
      );
    }

    this.state.activeStageId = found.stage.id;
    this.state.activeActivityId = activityId;
    runtime.status = "in_progress";
    runtime.startedAt ??= timestamp;

    const stageRuntime = this.state.stageStates[found.stage.id];
    stageRuntime.status = "in_progress";
    stageRuntime.startedAt ??= timestamp;
    stageRuntime.currentActivityId = activityId;

    addEvent(this.state, "activity_started", timestamp, {
      stageId: found.stage.id,
      activityId,
      payload: { title: found.activity.title },
    });
    touch(this.state, timestamp);

    return this.snapshot();
  }

  recordAttempt(input: RecordAttemptInput): SessionSnapshot {
    const timestamp = nowIso(input.occurredAt);
    ensureActive(this.state);

    const activity = this.getCurrentActivity();
    const stage = this.getCurrentStage();

    if (!activity || !stage) {
      throw new SessionEngineError(
        "ACTIVITY_NOT_FOUND",
        "There is no active activity.",
      );
    }

    const runtime = this.state.activityStates[activity.id];

    if (runtime.attempts.length >= activity.maximumAttempts) {
      throw new SessionEngineError(
        "ATTEMPT_LIMIT_REACHED",
        `Activity "${activity.id}" has reached its maximum of ${activity.maximumAttempts} attempts.`,
      );
    }

    const score =
      input.score === undefined ? undefined : clamp(input.score);
    const confidence =
      input.confidence === undefined
        ? undefined
        : clamp(input.confidence);

    const attempt: SessionActivityAttempt = {
      id: createId("attempt"),
      number: runtime.attempts.length + 1,
      startedAt: timestamp,
      completedAt: timestamp,
      outcome: input.outcome,
      score,
      confidence,
      learnerTurnId: input.learnerTurnId,
      evaluationId: input.evaluationId,
      teachingDecisionId: input.teachingDecisionId,
      supportLevelBefore: runtime.currentSupportLevel,
      supportLevelAfter: runtime.currentSupportLevel,
      notes: input.notes ? [...input.notes] : undefined,
    };

    runtime.attempts.push(attempt);
    runtime.latestScore = score;

    if (score !== undefined) {
      runtime.bestScore =
        runtime.bestScore === undefined
          ? score
          : Math.max(runtime.bestScore, score);
      runtime.averageScore = average(
        runtime.attempts
          .map((item) => item.score)
          .filter((item): item is number => item !== undefined),
      );
    }

    if (input.outcome === "successful") {
      runtime.successfulTurns += 1;
      runtime.correctAnswers += 1;
    } else if (input.outcome === "partly_successful") {
      runtime.successfulTurns += 1;
    }

    addEvent(this.state, "activity_attempt_recorded", timestamp, {
      stageId: stage.id,
      activityId: activity.id,
      payload: {
        attemptNumber: attempt.number,
        outcome: input.outcome,
        score,
        confidence,
      },
    });

    touch(this.state, timestamp);

    if (isActivityCompleteByRule(activity, runtime)) {
      return this.completeActivity(
        "Activity success rule satisfied.",
        timestamp,
      );
    }

    return this.snapshot();
  }

  useSupport(input: UseSupportInput): SessionSnapshot {
    const timestamp = nowIso(input.occurredAt);
    ensureActive(this.state);

    const activity = this.getCurrentActivity();
    const stage = this.getCurrentStage();

    if (!activity || !stage) {
      throw new SessionEngineError(
        "ACTIVITY_NOT_FOUND",
        "There is no active activity.",
      );
    }

    const runtime = this.state.activityStates[activity.id];
    const available = activity.supportSteps.find(
      (step) => step.level === input.level && step.type === input.type,
    );

    if (!available) {
      throw new SessionEngineError(
        "SUPPORT_LEVEL_INVALID",
        `Support level ${input.level} (${input.type}) is not defined for activity "${activity.id}".`,
      );
    }

    const uses = runtime.supportHistory.filter(
      (record) =>
        record.supportLevel === input.level &&
        record.supportType === input.type,
    ).length;

    if (
      available.maximumUses !== undefined &&
      uses >= available.maximumUses
    ) {
      throw new SessionEngineError(
        "SUPPORT_LEVEL_INVALID",
        `Support "${input.type}" has reached its maximum usage count.`,
      );
    }

    runtime.currentSupportLevel = Math.max(
      runtime.currentSupportLevel,
      input.level,
    );

    runtime.supportHistory.push({
      id: createId("support"),
      supportLevel: input.level,
      supportType: input.type,
      usedAt: timestamp,
      attemptNumber: runtime.attempts.length + 1,
      content: input.content,
    });

    const latestAttempt = runtime.attempts.at(-1);
    if (latestAttempt) {
      latestAttempt.supportLevelAfter = runtime.currentSupportLevel;
    }

    addEvent(this.state, "activity_support_used", timestamp, {
      stageId: stage.id,
      activityId: activity.id,
      payload: {
        level: input.level,
        type: input.type,
        useL1: available.useL1 ?? false,
      },
    });
    touch(this.state, timestamp);

    return this.snapshot();
  }

  completeActivity(
    reason = "Activity completed.",
    occurredAt?: string,
    force = false,
  ): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureActive(this.state);

    const activity = this.getCurrentActivity();
    const stage = this.getCurrentStage();

    if (!activity || !stage) {
      throw new SessionEngineError(
        "ACTIVITY_NOT_FOUND",
        "There is no active activity.",
      );
    }

    const runtime = this.state.activityStates[activity.id];

    if (!force && !isActivityCompleteByRule(activity, runtime)) {
      throw new SessionEngineError(
        "ACTIVITY_NOT_COMPLETE",
        `Activity "${activity.id}" has not satisfied its success rule.`,
      );
    }

    runtime.status = "completed";
    runtime.completedAt = timestamp;
    runtime.completionReason = reason;

    if (!this.state.completedActivityIds.includes(activity.id)) {
      this.state.completedActivityIds.push(activity.id);
    }

    const stageRuntime = this.state.stageStates[stage.id];
    if (!stageRuntime.completedActivityIds.includes(activity.id)) {
      stageRuntime.completedActivityIds.push(activity.id);
    }

    addEvent(this.state, "activity_completed", timestamp, {
      stageId: stage.id,
      activityId: activity.id,
      payload: {
        reason,
        score: runtime.bestScore,
        attempts: runtime.attempts.length,
      },
    });

    const next = nextIncompleteActivity(stage, this.state);
    touch(this.state, timestamp);

    if (next) {
      return this.startActivity(next.id, timestamp);
    }

    if (isStageCompleteByRule(stage, this.state)) {
      return this.completeStage(
        "All required stage activities are complete.",
        timestamp,
      );
    }

    this.state.activeActivityId = undefined;
    stageRuntime.currentActivityId = undefined;
    return this.snapshot();
  }

  skipActivity(reason: string, occurredAt?: string): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureActive(this.state);

    const activity = this.getCurrentActivity();
    const stage = this.getCurrentStage();

    if (!activity || !stage) {
      throw new SessionEngineError(
        "ACTIVITY_NOT_FOUND",
        "There is no active activity.",
      );
    }

    if (!activity.allowSkip) {
      throw new SessionEngineError(
        "SKIP_NOT_ALLOWED",
        `Activity "${activity.id}" is not skippable.`,
      );
    }

    const runtime = this.state.activityStates[activity.id];
    runtime.status = "skipped";
    runtime.skippedAt = timestamp;
    runtime.skipReason = reason;

    if (!this.state.skippedActivityIds.includes(activity.id)) {
      this.state.skippedActivityIds.push(activity.id);
    }

    const stageRuntime = this.state.stageStates[stage.id];
    if (!stageRuntime.skippedActivityIds.includes(activity.id)) {
      stageRuntime.skippedActivityIds.push(activity.id);
    }

    addEvent(this.state, "activity_skipped", timestamp, {
      stageId: stage.id,
      activityId: activity.id,
      payload: { reason },
    });

    const next = nextIncompleteActivity(stage, this.state);
    touch(this.state, timestamp);

    if (next) return this.startActivity(next.id, timestamp);
    if (isStageCompleteByRule(stage, this.state)) {
      return this.completeStage("Stage activities resolved.", timestamp);
    }

    this.state.activeActivityId = undefined;
    stageRuntime.currentActivityId = undefined;
    return this.snapshot();
  }

  changeToAlternativeActivity(
    reason: string,
    occurredAt?: string,
  ): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureActive(this.state);

    const activity = this.getCurrentActivity();
    const stage = this.getCurrentStage();

    if (!activity || !stage) {
      throw new SessionEngineError(
        "ACTIVITY_NOT_FOUND",
        "There is no active activity.",
      );
    }

    if (
      !activity.allowAlternativeActivity ||
      !activity.alternativeActivityId
    ) {
      throw new SessionEngineError(
        "ACTIVITY_BLOCKED",
        `Activity "${activity.id}" has no permitted alternative.`,
      );
    }

    const alternative = activityById(
      this.lesson,
      activity.alternativeActivityId,
    );

    if (!alternative || alternative.stage.id !== stage.id) {
      throw new SessionEngineError(
        "ACTIVITY_NOT_FOUND",
        `Alternative activity "${activity.alternativeActivityId}" is unavailable in the current stage.`,
      );
    }

    addEvent(this.state, "activity_changed", timestamp, {
      stageId: stage.id,
      activityId: activity.id,
      payload: {
        alternativeActivityId: alternative.activity.id,
        reason,
      },
    });
    touch(this.state, timestamp);

    return this.startActivity(alternative.activity.id, timestamp);
  }

  updateObjective(input: UpdateObjectiveInput): SessionSnapshot {
    const timestamp = nowIso(input.occurredAt);
    ensureNonTerminal(this.state);

    const objective = this.lesson.objectives.find(
      (item) => item.id === input.objectiveId,
    );

    if (!objective) {
      throw new SessionEngineError(
        "OBJECTIVE_NOT_FOUND",
        `Objective "${input.objectiveId}" was not found.`,
      );
    }

    const runtime = this.state.objectiveStates[input.objectiveId];
    runtime.attempts += 1;

    if (input.success) runtime.successes += 1;
    if (input.progress !== undefined) {
      runtime.progress = clamp(input.progress);
    }
    if (input.masteryScore !== undefined) {
      runtime.masteryScore = clamp(input.masteryScore);
    }

    if (input.evidenceActivityId) {
      const exists = activityById(this.lesson, input.evidenceActivityId);
      if (!exists) {
        throw new SessionEngineError(
          "ACTIVITY_NOT_FOUND",
          `Evidence activity "${input.evidenceActivityId}" was not found.`,
        );
      }
      if (!runtime.evidenceActivityIds.includes(input.evidenceActivityId)) {
        runtime.evidenceActivityIds.push(input.evidenceActivityId);
      }
    }

    runtime.status =
      runtime.masteryScore >= objective.successThreshold
        ? "mastered"
        : runtime.attempts > 0 && runtime.masteryScore < 40
          ? "needs_support"
          : "in_progress";
    runtime.lastUpdatedAt = timestamp;

    addEvent(this.state, "objective_progress_updated", timestamp, {
      objectiveId: objective.id,
      activityId: input.evidenceActivityId,
      payload: {
        progress: runtime.progress,
        masteryScore: runtime.masteryScore,
        status: runtime.status,
      },
    });
    touch(this.state, timestamp);

    return this.snapshot();
  }

  updateAssessment(input: UpdateAssessmentInput): SessionSnapshot {
    const timestamp = nowIso(input.occurredAt);
    ensureNonTerminal(this.state);

    const assessment = this.state.assessment;
    assessment.status =
      assessment.status === "not_started"
        ? "in_progress"
        : assessment.status;
    assessment.startedAt ??= timestamp;
    assessment.attempts = Math.max(1, assessment.attempts);

    if (input.score !== undefined) assessment.score = clamp(input.score);

    if (input.criterionScores) {
      for (const [criterionId, score] of Object.entries(
        input.criterionScores,
      )) {
        const known = this.lesson.assessment.criteria.some(
          (criterion) => criterion.id === criterionId,
        );
        if (!known) {
          throw new SessionEngineError(
            "ASSESSMENT_INVALID",
            `Assessment criterion "${criterionId}" was not found.`,
          );
        }
        assessment.criterionScores[criterionId] = clamp(score);
      }
    }

    if (input.completed) {
      assessment.completedAt = timestamp;
      assessment.status =
        (assessment.score ?? 0) >= assessment.passingPercentage
          ? "passed"
          : "failed";
    }

    addEvent(this.state, "assessment_updated", timestamp, {
      payload: {
        score: assessment.score,
        status: assessment.status,
      },
    });
    touch(this.state, timestamp);

    return this.snapshot();
  }

  beginAssessment(occurredAt?: string): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    ensureActive(this.state);

    this.state.assessment.status = "in_progress";
    this.state.assessment.startedAt ??= timestamp;
    this.state.assessment.attempts += 1;

    addEvent(this.state, "assessment_updated", timestamp, {
      payload: {
        action: "started",
        attempt: this.state.assessment.attempts,
      },
    });
    touch(this.state, timestamp);

    return this.snapshot();
  }

  addNote(
    category: SessionNote["category"],
    text: string,
    occurredAt?: string,
  ): SessionSnapshot {
    const timestamp = nowIso(occurredAt);
    const normalized = text.trim();

    if (!normalized) {
      throw new SessionEngineError(
        "INVALID_SESSION",
        "Session note text cannot be empty.",
      );
    }

    const note: SessionNote = {
      id: createId("note"),
      createdAt: timestamp,
      category,
      text: normalized,
      stageId: this.state.activeStageId,
      activityId: this.state.activeActivityId,
    };

    this.state.notes.push(note);
    addEvent(this.state, "session_note_added", timestamp, {
      stageId: note.stageId,
      activityId: note.activityId,
      payload: { noteId: note.id, category },
    });
    touch(this.state, timestamp);

    return this.snapshot();
  }

  peekNextStage(): TeachingStage | undefined {
    const stages = orderedStages(this.lesson);
    const currentIndex = this.state.activeStageId
      ? stages.findIndex((stage) => stage.id === this.state.activeStageId)
      : -1;

    return stages.slice(currentIndex + 1).find((stage) => {
      const runtime = this.state.stageStates[stage.id];
      return runtime.status !== "completed" && runtime.status !== "skipped";
    });
  }

  peekNextActivity(): TeachingActivity | undefined {
    const stage = this.getCurrentStage();
    const activity = this.getCurrentActivity();

    if (!stage) {
      const nextStage = this.peekNextStage() ?? firstAvailableStage(
        this.lesson,
        this.state,
      );
      return nextStage
        ? nextIncompleteActivity(nextStage, this.state)
        : undefined;
    }

    const activities = orderedActivities(stage);
    const currentIndex = activity
      ? activities.findIndex((item) => item.id === activity.id)
      : -1;

    const inStage = activities.slice(currentIndex + 1).find((item) => {
      const runtime = this.state.activityStates[item.id];
      return runtime.status !== "completed" && runtime.status !== "skipped";
    });

    if (inStage) return inStage;

    const nextStage = this.peekNextStage();
    return nextStage
      ? nextIncompleteActivity(nextStage, this.state)
      : undefined;
  }

  peekPreviousActivity(): TeachingActivity | undefined {
    const stage = this.getCurrentStage();
    const activity = this.getCurrentActivity();
    if (!stage || !activity) return undefined;

    const activities = orderedActivities(stage);
    const index = activities.findIndex((item) => item.id === activity.id);
    return index > 0 ? activities[index - 1] : undefined;
  }

  canCompleteLesson(): boolean {
    const requiredStagesComplete = this.lesson.stages
      .filter((stage) => stage.required)
      .every(
        (stage) => this.state.stageStates[stage.id].status === "completed",
      );

    const requiredObjectivesMet =
      this.lesson.completionCriteria.requiredObjectiveIds.every(
        (objectiveId) => {
          const objective = this.lesson.objectives.find(
            (item) => item.id === objectiveId,
          );
          const runtime = this.state.objectiveStates[objectiveId];
          return (
            objective !== undefined &&
            runtime !== undefined &&
            runtime.masteryScore >= objective.successThreshold
          );
        },
      );

    const assessmentMet =
      !this.lesson.completionCriteria.requireAssessmentCompletion ||
      this.state.assessment.status === "passed";

    return requiredStagesComplete && requiredObjectivesMet && assessmentMet;
  }

  serialize(pretty = false): string {
    return JSON.stringify(this.state, null, pretty ? 2 : undefined);
  }
}

export const SessionEngine = {
  create: TeachingSessionEngine.create,
  restore: TeachingSessionEngine.restore,
  createState: createTeachingSession,
  restoreState: restoreTeachingSession,
};
