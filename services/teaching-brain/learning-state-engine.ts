/**
 * ELVY Teaching Engine
 * TE-900 — Learning State Engine
 *
 * Authoritative educational state for one learner in one active lesson.
 * Deterministic, immutable, stateless, database-independent and scalable.
 */

import type {
  ClassroomIdentifier,
  ISODateTime,
  Percentage,
} from "./classroom-state";

export type LearningDomain =
  | "vocabulary"
  | "grammar"
  | "pronunciation"
  | "listening"
  | "speaking"
  | "reading"
  | "writing"
  | "functional_language"
  | "culture"
  | "other";

export type LearningStateStatus =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed"
  | "needs_review";

export type ObjectiveStatus =
  | "not_started"
  | "in_progress"
  | "reinforce"
  | "mastered"
  | "review_required";

export type ReviewPriority = "low" | "normal" | "high" | "urgent";
export type ReviewStatus = "pending" | "in_progress" | "completed" | "dismissed";

export type CompletionDecision =
  | "continue_lesson"
  | "repeat_scene"
  | "review_objectives"
  | "pause_and_resume"
  | "complete_lesson";

export type LearningStateEventType =
  | "lesson_started"
  | "scene_started"
  | "scene_completed"
  | "objective_started"
  | "objective_evidence_recorded"
  | "review_scheduled"
  | "review_completed"
  | "checkpoint_created"
  | "lesson_paused"
  | "lesson_resumed"
  | "lesson_completed";

export interface ObjectiveEvidence {
  readonly evidenceId: ClassroomIdentifier;
  readonly objectiveId: ClassroomIdentifier;
  readonly domain: LearningDomain;
  readonly score: Percentage;
  readonly successful: boolean;
  readonly activityId?: ClassroomIdentifier;
  readonly sceneId?: ClassroomIdentifier;
  readonly recordedAt: ISODateTime;
}

export interface LearningObjectiveState {
  readonly objectiveId: ClassroomIdentifier;
  readonly title: string;
  readonly domain: LearningDomain;
  readonly required: boolean;
  readonly status: ObjectiveStatus;
  readonly mastery: Percentage;
  readonly attempts: number;
  readonly successfulEvidenceCount: number;
  readonly evidenceCount: number;
  readonly lastEvidenceAt?: ISODateTime;
}

export interface ReviewItem {
  readonly reviewId: ClassroomIdentifier;
  readonly objectiveId?: ClassroomIdentifier;
  readonly domain: LearningDomain;
  readonly label: string;
  readonly priority: ReviewPriority;
  readonly status: ReviewStatus;
  readonly reason: string;
  readonly createdAt: ISODateTime;
  readonly updatedAt: ISODateTime;
  readonly attempts: number;
}

export interface LearningCheckpoint {
  readonly checkpointId: ClassroomIdentifier;
  readonly lessonId: ClassroomIdentifier;
  readonly sceneId?: ClassroomIdentifier;
  readonly objectiveId?: ClassroomIdentifier;
  readonly lessonProgress: Percentage;
  readonly sceneProgress: Percentage;
  readonly createdAt: ISODateTime;
}

export interface LearnerEducationalSnapshot {
  readonly learnerId: ClassroomIdentifier;
  readonly sessionId: ClassroomIdentifier;
  readonly lessonId: ClassroomIdentifier;
  readonly currentSceneId?: ClassroomIdentifier;
  readonly currentObjectiveId?: ClassroomIdentifier;
  readonly status: LearningStateStatus;
  readonly lessonProgress: Percentage;
  readonly sceneProgress: Percentage;
  readonly objectives: readonly LearningObjectiveState[];
  readonly reviewQueue: readonly ReviewItem[];
  readonly completedSceneIds: readonly ClassroomIdentifier[];
  readonly checkpoint?: LearningCheckpoint;
  readonly startedAt: ISODateTime;
  readonly updatedAt: ISODateTime;
  readonly completedAt?: ISODateTime;
  readonly revision: number;
}

export interface LearningStateEvent {
  readonly eventId: ClassroomIdentifier;
  readonly type: LearningStateEventType;
  readonly learnerId: ClassroomIdentifier;
  readonly sessionId: ClassroomIdentifier;
  readonly lessonId: ClassroomIdentifier;
  readonly occurredAt: ISODateTime;
  readonly sceneId?: ClassroomIdentifier;
  readonly objectiveId?: ClassroomIdentifier;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface LearningStateTransition {
  readonly previous: LearnerEducationalSnapshot;
  readonly current: LearnerEducationalSnapshot;
  readonly event: LearningStateEvent;
  readonly diagnostics: Readonly<{
    engineVersion: string;
    revisionBefore: number;
    revisionAfter: number;
    warnings: readonly string[];
    eventType: LearningStateEventType;
  }>;
}

export interface LessonCompletionAssessment {
  readonly decision: CompletionDecision;
  readonly completionReady: boolean;
  readonly requiredObjectives: number;
  readonly masteredRequiredObjectives: number;
  readonly unresolvedReviewItems: number;
  readonly lessonProgress: Percentage;
  readonly reasons: readonly string[];
}

export interface LearningStateEngineOptions {
  readonly engineVersion?: string;
  readonly now?: () => ISODateTime;
  readonly objectiveMasteryThreshold?: Percentage;
  readonly lessonCompletionThreshold?: Percentage;
  readonly maximumReviewItems?: number;
}

export interface CreateLearningStateInput {
  readonly learnerId: ClassroomIdentifier;
  readonly sessionId: ClassroomIdentifier;
  readonly lessonId: ClassroomIdentifier;
  readonly objectives: readonly {
    readonly objectiveId: ClassroomIdentifier;
    readonly title: string;
    readonly domain: LearningDomain;
    readonly required?: boolean;
  }[];
  readonly startedAt?: ISODateTime;
}

const DEFAULT_OPTIONS: Required<LearningStateEngineOptions> = {
  engineVersion: "1.0.0",
  now: () => new Date().toISOString(),
  objectiveMasteryThreshold: 80,
  lessonCompletionThreshold: 100,
  maximumReviewItems: 50,
};

export class LearningStateEngine {
  private readonly options: Required<LearningStateEngineOptions>;

  public constructor(options: LearningStateEngineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    validatePercentage(this.options.objectiveMasteryThreshold, "objectiveMasteryThreshold");
    validatePercentage(this.options.lessonCompletionThreshold, "lessonCompletionThreshold");

    if (!Number.isInteger(this.options.maximumReviewItems) || this.options.maximumReviewItems < 1) {
      throw new Error("maximumReviewItems must be a positive integer.");
    }
  }

  public createInitialState(input: CreateLearningStateInput): LearnerEducationalSnapshot {
    requireText(input.learnerId, "learnerId");
    requireText(input.sessionId, "sessionId");
    requireText(input.lessonId, "lessonId");

    if (input.objectives.length === 0) {
      throw new Error("At least one learning objective is required.");
    }

    const seen = new Set<string>();
    const objectives = input.objectives.map((objective) => {
      requireText(objective.objectiveId, "objectiveId");
      requireText(objective.title, "objective.title");

      if (seen.has(objective.objectiveId)) {
        throw new Error(`Duplicate objective id "${objective.objectiveId}".`);
      }
      seen.add(objective.objectiveId);

      return Object.freeze<LearningObjectiveState>({
        objectiveId: objective.objectiveId,
        title: objective.title,
        domain: objective.domain,
        required: objective.required ?? true,
        status: "not_started",
        mastery: 0,
        attempts: 0,
        successfulEvidenceCount: 0,
        evidenceCount: 0,
      });
    });

    const startedAt = input.startedAt ?? this.options.now();

    return freezeSnapshot({
      learnerId: input.learnerId,
      sessionId: input.sessionId,
      lessonId: input.lessonId,
      status: "not_started",
      lessonProgress: 0,
      sceneProgress: 0,
      objectives,
      reviewQueue: [],
      completedSceneIds: [],
      startedAt,
      updatedAt: startedAt,
      revision: 0,
    });
  }

  public startLesson(state: LearnerEducationalSnapshot): LearningStateTransition {
    return this.transition(state, "lesson_started", {}, (current, now) => ({
      ...current,
      status: "in_progress",
      updatedAt: now,
    }));
  }

  public startScene(
    state: LearnerEducationalSnapshot,
    sceneId: ClassroomIdentifier,
  ): LearningStateTransition {
    requireText(sceneId, "sceneId");

    return this.transition(state, "scene_started", { sceneId }, (current, now) => ({
      ...current,
      status: "in_progress",
      currentSceneId: sceneId,
      sceneProgress: 0,
      updatedAt: now,
    }));
  }

  public updateSceneProgress(
    state: LearnerEducationalSnapshot,
    progress: Percentage,
  ): LearnerEducationalSnapshot {
    validatePercentage(progress, "progress");

    return freezeSnapshot({
      ...state,
      sceneProgress: progress,
      lessonProgress: calculateLessonProgress(state.objectives, progress),
      updatedAt: this.options.now(),
      revision: state.revision + 1,
    });
  }

  public completeScene(
    state: LearnerEducationalSnapshot,
    sceneId: ClassroomIdentifier,
  ): LearningStateTransition {
    requireText(sceneId, "sceneId");

    return this.transition(state, "scene_completed", { sceneId }, (current, now) => ({
      ...current,
      completedSceneIds: unique([...current.completedSceneIds, sceneId]),
      currentSceneId: current.currentSceneId === sceneId ? undefined : current.currentSceneId,
      sceneProgress: 100,
      lessonProgress: calculateLessonProgress(current.objectives, 100),
      updatedAt: now,
    }));
  }

  public startObjective(
    state: LearnerEducationalSnapshot,
    objectiveId: ClassroomIdentifier,
  ): LearningStateTransition {
    requireObjective(state, objectiveId);

    return this.transition(state, "objective_started", { objectiveId }, (current, now) => ({
      ...current,
      currentObjectiveId: objectiveId,
      objectives: current.objectives.map((objective) =>
        objective.objectiveId === objectiveId
          ? Object.freeze({
              ...objective,
              status: objective.status === "mastered" ? "mastered" : "in_progress",
            })
          : objective,
      ),
      updatedAt: now,
    }));
  }

  public recordObjectiveEvidence(
    state: LearnerEducationalSnapshot,
    evidence: ObjectiveEvidence,
  ): LearningStateTransition {
    requireText(evidence.evidenceId, "evidenceId");
    requireObjective(state, evidence.objectiveId);
    validatePercentage(evidence.score, "evidence.score");

    return this.transition(
      state,
      "objective_evidence_recorded",
      {
        objectiveId: evidence.objectiveId,
        sceneId: evidence.sceneId,
        metadata: Object.freeze({
          evidenceId: evidence.evidenceId,
          score: evidence.score,
          successful: evidence.successful,
        }),
      },
      (current, now) => {
        const objectives = current.objectives.map((objective) => {
          if (objective.objectiveId !== evidence.objectiveId) {
            return objective;
          }

          const evidenceCount = objective.evidenceCount + 1;
          const mastery = clampPercentage(
            Math.round(
              (objective.mastery * objective.evidenceCount + evidence.score) /
                evidenceCount,
            ),
          );

          return Object.freeze<LearningObjectiveState>({
            ...objective,
            mastery,
            attempts: objective.attempts + 1,
            evidenceCount,
            successfulEvidenceCount:
              objective.successfulEvidenceCount + (evidence.successful ? 1 : 0),
            status: determineObjectiveStatus(
              mastery,
              evidenceCount,
              this.options.objectiveMasteryThreshold,
            ),
            lastEvidenceAt: evidence.recordedAt,
          });
        });

        return {
          ...current,
          currentObjectiveId: evidence.objectiveId,
          objectives,
          lessonProgress: calculateLessonProgress(objectives, current.sceneProgress),
          updatedAt: now,
        };
      },
    );
  }

  public scheduleReview(
    state: LearnerEducationalSnapshot,
    input: Readonly<{
      reviewId: ClassroomIdentifier;
      objectiveId?: ClassroomIdentifier;
      domain: LearningDomain;
      label: string;
      priority: ReviewPriority;
      reason: string;
    }>,
  ): LearningStateTransition {
    requireText(input.reviewId, "reviewId");
    requireText(input.label, "review.label");
    requireText(input.reason, "review.reason");

    if (input.objectiveId) {
      requireObjective(state, input.objectiveId);
    }

    return this.transition(
      state,
      "review_scheduled",
      {
        objectiveId: input.objectiveId,
        metadata: Object.freeze({
          reviewId: input.reviewId,
          priority: input.priority,
        }),
      },
      (current, now) => {
        const duplicate = current.reviewQueue.find(
          (item) =>
            item.status !== "completed" &&
            item.status !== "dismissed" &&
            item.objectiveId === input.objectiveId &&
            item.domain === input.domain &&
            item.label.trim().toLowerCase() === input.label.trim().toLowerCase(),
        );

        const reviewQueue = duplicate
          ? current.reviewQueue.map((item) =>
              item.reviewId === duplicate.reviewId
                ? Object.freeze<ReviewItem>({
                    ...item,
                    priority: higherPriority(item.priority, input.priority),
                    reason: input.reason,
                    updatedAt: now,
                  })
                : item,
            )
          : [
              ...current.reviewQueue,
              Object.freeze<ReviewItem>({
                reviewId: input.reviewId,
                objectiveId: input.objectiveId,
                domain: input.domain,
                label: input.label,
                priority: input.priority,
                status: "pending",
                reason: input.reason,
                createdAt: now,
                updatedAt: now,
                attempts: 0,
              }),
            ]
              .sort(compareReviewItems)
              .slice(0, this.options.maximumReviewItems);

        return {
          ...current,
          reviewQueue,
          status: current.status === "completed" ? "needs_review" : current.status,
          updatedAt: now,
        };
      },
    );
  }

  public completeReview(
    state: LearnerEducationalSnapshot,
    reviewId: ClassroomIdentifier,
  ): LearningStateTransition {
    const review = state.reviewQueue.find((item) => item.reviewId === reviewId);

    if (!review) {
      throw new Error(`Unknown review item "${reviewId}".`);
    }

    return this.transition(
      state,
      "review_completed",
      {
        objectiveId: review.objectiveId,
        metadata: Object.freeze({ reviewId }),
      },
      (current, now) => ({
        ...current,
        reviewQueue: current.reviewQueue.map((item) =>
          item.reviewId === reviewId
            ? Object.freeze<ReviewItem>({
                ...item,
                status: "completed",
                attempts: item.attempts + 1,
                updatedAt: now,
              })
            : item,
        ),
        updatedAt: now,
      }),
    );
  }

  public createCheckpoint(
    state: LearnerEducationalSnapshot,
    checkpointId: ClassroomIdentifier,
  ): LearningStateTransition {
    requireText(checkpointId, "checkpointId");

    return this.transition(state, "checkpoint_created", {}, (current, now) => ({
      ...current,
      checkpoint: Object.freeze({
        checkpointId,
        lessonId: current.lessonId,
        sceneId: current.currentSceneId,
        objectiveId: current.currentObjectiveId,
        lessonProgress: current.lessonProgress,
        sceneProgress: current.sceneProgress,
        createdAt: now,
      }),
      updatedAt: now,
    }));
  }

  public pauseLesson(state: LearnerEducationalSnapshot): LearningStateTransition {
    return this.transition(state, "lesson_paused", {}, (current, now) => ({
      ...current,
      status: "paused",
      updatedAt: now,
    }));
  }

  public resumeLesson(state: LearnerEducationalSnapshot): LearningStateTransition {
    return this.transition(
      state,
      "lesson_resumed",
      {
        sceneId: state.checkpoint?.sceneId,
        objectiveId: state.checkpoint?.objectiveId,
      },
      (current, now) => ({
        ...current,
        status: "in_progress",
        currentSceneId: current.checkpoint?.sceneId ?? current.currentSceneId,
        currentObjectiveId:
          current.checkpoint?.objectiveId ?? current.currentObjectiveId,
        lessonProgress:
          current.checkpoint?.lessonProgress ?? current.lessonProgress,
        sceneProgress: current.checkpoint?.sceneProgress ?? current.sceneProgress,
        updatedAt: now,
      }),
    );
  }

  public assessCompletion(
    state: LearnerEducationalSnapshot,
  ): LessonCompletionAssessment {
    const required = state.objectives.filter((objective) => objective.required);
    const mastered = required.filter((objective) => objective.status === "mastered");
    const unresolved = state.reviewQueue.filter(
      (item) => item.status === "pending" || item.status === "in_progress",
    );
    const reasons: string[] = [];

    if (mastered.length < required.length) {
      reasons.push("One or more required objectives are not yet mastered.");
    }
    if (unresolved.length > 0) {
      reasons.push("The learner has unresolved review items.");
    }
    if (state.lessonProgress < this.options.lessonCompletionThreshold) {
      reasons.push("The lesson has not reached the completion threshold.");
    }

    const completionReady =
      required.length > 0 &&
      mastered.length === required.length &&
      unresolved.length === 0 &&
      state.lessonProgress >= this.options.lessonCompletionThreshold;

    const decision: CompletionDecision = completionReady
      ? "complete_lesson"
      : unresolved.length > 0
        ? "review_objectives"
        : state.status === "paused"
          ? "pause_and_resume"
          : state.currentSceneId && state.sceneProgress < 100
            ? "repeat_scene"
            : "continue_lesson";

    return Object.freeze({
      decision,
      completionReady,
      requiredObjectives: required.length,
      masteredRequiredObjectives: mastered.length,
      unresolvedReviewItems: unresolved.length,
      lessonProgress: state.lessonProgress,
      reasons: Object.freeze(reasons),
    });
  }

  public completeLesson(
    state: LearnerEducationalSnapshot,
  ): LearningStateTransition {
    const assessment = this.assessCompletion(state);

    if (!assessment.completionReady) {
      throw new Error(`Lesson cannot be completed: ${assessment.reasons.join(" ")}`);
    }

    return this.transition(state, "lesson_completed", {}, (current, now) => ({
      ...current,
      status: "completed",
      lessonProgress: 100,
      sceneProgress: 100,
      currentSceneId: undefined,
      currentObjectiveId: undefined,
      completedAt: now,
      updatedAt: now,
    }));
  }

  private transition(
    previous: LearnerEducationalSnapshot,
    type: LearningStateEventType,
    eventInput: Readonly<{
      sceneId?: ClassroomIdentifier;
      objectiveId?: ClassroomIdentifier;
      metadata?: Readonly<Record<string, unknown>>;
    }>,
    reducer: (
      current: LearnerEducationalSnapshot,
      now: ISODateTime,
    ) => Omit<LearnerEducationalSnapshot, "revision"> & { readonly revision?: number },
  ): LearningStateTransition {
    const now = this.options.now();
    const event = Object.freeze<LearningStateEvent>({
      eventId: `${previous.sessionId}:${previous.revision + 1}:${type}`,
      type,
      learnerId: previous.learnerId,
      sessionId: previous.sessionId,
      lessonId: previous.lessonId,
      occurredAt: now,
      sceneId: eventInput.sceneId,
      objectiveId: eventInput.objectiveId,
      metadata: eventInput.metadata,
    });

    const current = freezeSnapshot({
      ...reducer(previous, now),
      revision: previous.revision + 1,
    });

    return Object.freeze({
      previous,
      current,
      event,
      diagnostics: Object.freeze({
        engineVersion: this.options.engineVersion,
        revisionBefore: previous.revision,
        revisionAfter: current.revision,
        warnings: Object.freeze([]),
        eventType: type,
      }),
    });
  }
}

export function buildCompactLearningSummary(
  state: LearnerEducationalSnapshot,
): Readonly<{
  learnerId: ClassroomIdentifier;
  lessonId: ClassroomIdentifier;
  status: LearningStateStatus;
  lessonProgress: Percentage;
  masteredObjectives: number;
  totalObjectives: number;
  pendingReviews: number;
  currentSceneId?: ClassroomIdentifier;
  currentObjectiveId?: ClassroomIdentifier;
}> {
  return Object.freeze({
    learnerId: state.learnerId,
    lessonId: state.lessonId,
    status: state.status,
    lessonProgress: state.lessonProgress,
    masteredObjectives: state.objectives.filter(
      (objective) => objective.status === "mastered",
    ).length,
    totalObjectives: state.objectives.length,
    pendingReviews: state.reviewQueue.filter(
      (item) => item.status === "pending" || item.status === "in_progress",
    ).length,
    currentSceneId: state.currentSceneId,
    currentObjectiveId: state.currentObjectiveId,
  });
}

function determineObjectiveStatus(
  mastery: Percentage,
  evidenceCount: number,
  threshold: Percentage,
): ObjectiveStatus {
  if (mastery >= threshold && evidenceCount >= 2) return "mastered";
  if (evidenceCount >= 3 && mastery < 60) return "review_required";
  if (evidenceCount >= 2 && mastery < threshold) return "reinforce";
  return "in_progress";
}

function calculateLessonProgress(
  objectives: readonly LearningObjectiveState[],
  sceneProgress: Percentage,
): Percentage {
  const objectiveAverage =
    objectives.reduce((sum, objective) => sum + objective.mastery, 0) /
    objectives.length;

  return clampPercentage(
    Math.round(objectiveAverage * 0.85 + sceneProgress * 0.15),
  );
}

function requireObjective(
  state: LearnerEducationalSnapshot,
  objectiveId: ClassroomIdentifier,
): LearningObjectiveState {
  const objective = state.objectives.find(
    (item) => item.objectiveId === objectiveId,
  );

  if (!objective) {
    throw new Error(`Unknown objective "${objectiveId}".`);
  }

  return objective;
}

function compareReviewItems(left: ReviewItem, right: ReviewItem): number {
  const order: Record<ReviewPriority, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };

  return order[right.priority] - order[left.priority] ||
    left.createdAt.localeCompare(right.createdAt);
}

function higherPriority(
  left: ReviewPriority,
  right: ReviewPriority,
): ReviewPriority {
  const order: readonly ReviewPriority[] = ["low", "normal", "high", "urgent"];
  return order[Math.max(order.indexOf(left), order.indexOf(right))] ?? left;
}

function requireText(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`${field} is required.`);
  }
}

function validatePercentage(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${field} must be between 0 and 100.`);
  }
}

function clampPercentage(value: number): Percentage {
  return Math.max(0, Math.min(100, value));
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function freezeSnapshot(
  snapshot: LearnerEducationalSnapshot,
): LearnerEducationalSnapshot {
  return Object.freeze({
    ...snapshot,
    objectives: Object.freeze(
      snapshot.objectives.map((objective) => Object.freeze({ ...objective })),
    ),
    reviewQueue: Object.freeze(
      snapshot.reviewQueue.map((item) => Object.freeze({ ...item })),
    ),
    completedSceneIds: Object.freeze([...snapshot.completedSceneIds]),
    checkpoint: snapshot.checkpoint
      ? Object.freeze({ ...snapshot.checkpoint })
      : undefined,
  });
}
