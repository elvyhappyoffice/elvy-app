/**
 * ELVY Teaching Engine
 * TE-920 — Classroom Analytics
 *
 * Purpose:
 * - transform classroom events and learner snapshots into analytics records
 * - calculate learner, lesson, objective, domain and curriculum metrics
 * - expose compact aggregates for dashboards and reporting
 * - preserve educational meaning without changing live teaching
 *
 * Design rules:
 * - observation only: this module never changes teaching decisions
 * - deterministic and immutable
 * - no database access
 * - no AI calls
 * - no UI dependencies
 * - no timers or background jobs
 * - stateless input -> aggregate output
 * - suitable for horizontal scaling and event pipelines
 */

import type {
  ClassroomIdentifier,
  ISODateTime,
  Percentage,
} from "./classroom-state";

import type {
  LearnerEducationalSnapshot,
  LearningDomain,
  LearningObjectiveState,
  LearningStateEvent,
  LearningStateStatus,
  ObjectiveStatus,
  ReviewItem,
} from "./learning-state-engine";

import type {
  ConfidenceLevel,
  EngagementLevel,
  LearnerMotivationSnapshot,
  MotivationActionType,
  MotivationLevel,
} from "./motivation-engine";

export type AnalyticsEventType =
  | "session_started"
  | "session_resumed"
  | "session_paused"
  | "session_completed"
  | "lesson_started"
  | "lesson_completed"
  | "scene_started"
  | "scene_completed"
  | "objective_started"
  | "objective_evidence_recorded"
  | "objective_mastered"
  | "review_scheduled"
  | "review_completed"
  | "response_evaluated"
  | "motivation_action"
  | "checkpoint_created"
  | "learner_inactive";

export type ResponseOutcome =
  | "correct"
  | "partially_correct"
  | "incorrect"
  | "not_evaluated";

export type AnalyticsTrendDirection =
  | "improving"
  | "stable"
  | "declining"
  | "insufficient_data";

export type AnalyticsSeverity =
  | "info"
  | "attention"
  | "warning"
  | "critical";

export type AnalyticsInsightType =
  | "strong_mastery"
  | "mastery_gap"
  | "review_pressure"
  | "slow_progress"
  | "engagement_risk"
  | "confidence_risk"
  | "high_hint_dependency"
  | "objective_difficulty"
  | "lesson_dropoff"
  | "curriculum_difficulty"
  | "positive_momentum"
  | "insufficient_data";

export type AnalyticsScope =
  | "learner"
  | "session"
  | "lesson"
  | "objective"
  | "domain"
  | "unit"
  | "curriculum"
  | "platform";

export interface ClassroomAnalyticsEvent {
  readonly eventId: ClassroomIdentifier;
  readonly type: AnalyticsEventType;
  readonly occurredAt: ISODateTime;

  readonly learnerId: ClassroomIdentifier;
  readonly sessionId: ClassroomIdentifier;
  readonly lessonId: ClassroomIdentifier;

  readonly curriculumId?: ClassroomIdentifier;
  readonly levelId?: ClassroomIdentifier;
  readonly sublevelId?: ClassroomIdentifier;
  readonly unitId?: ClassroomIdentifier;
  readonly sceneId?: ClassroomIdentifier;
  readonly objectiveId?: ClassroomIdentifier;
  readonly activityId?: ClassroomIdentifier;

  readonly domain?: LearningDomain;
  readonly responseOutcome?: ResponseOutcome;
  readonly responseScore?: Percentage;
  readonly responseDurationMs?: number;
  readonly hintsUsed?: number;
  readonly attemptNumber?: number;

  readonly lessonProgress?: Percentage;
  readonly sceneProgress?: Percentage;
  readonly objectiveMastery?: Percentage;

  readonly confidence?: ConfidenceLevel;
  readonly engagement?: EngagementLevel;
  readonly motivation?: MotivationLevel;
  readonly motivationAction?: MotivationActionType;

  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AnalyticsWindow {
  readonly startedAt: ISODateTime;
  readonly endedAt: ISODateTime;
}

export interface NumericDistribution {
  readonly count: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly average: number;
  readonly median: number;
  readonly p75: number;
  readonly p90: number;
}

export interface PercentageDistribution
  extends NumericDistribution {
  readonly minimum: Percentage;
  readonly maximum: Percentage;
  readonly average: Percentage;
  readonly median: Percentage;
  readonly p75: Percentage;
  readonly p90: Percentage;
}

export interface ResponseAnalytics {
  readonly totalResponses: number;
  readonly evaluatedResponses: number;
  readonly correctResponses: number;
  readonly partiallyCorrectResponses: number;
  readonly incorrectResponses: number;
  readonly accuracy: Percentage;
  readonly averageScore: Percentage;
  readonly averageDurationMs: number;
  readonly totalHintsUsed: number;
  readonly averageHintsPerResponse: number;
  readonly hintDependencyRate: Percentage;
  readonly firstAttemptSuccessRate: Percentage;
}

export interface ObjectiveAnalytics {
  readonly objectiveId: ClassroomIdentifier;
  readonly title?: string;
  readonly domain?: LearningDomain;
  readonly status?: ObjectiveStatus;
  readonly learnerCount: number;
  readonly attemptCount: number;
  readonly successCount: number;
  readonly mastery: Percentage;
  readonly responseAnalytics: ResponseAnalytics;
  readonly reviewScheduledCount: number;
  readonly reviewCompletedCount: number;
  readonly reviewCompletionRate: Percentage;
  readonly trend: AnalyticsTrendDirection;
}

export interface DomainAnalytics {
  readonly domain: LearningDomain;
  readonly objectiveCount: number;
  readonly learnerCount: number;
  readonly mastery: Percentage;
  readonly responseAnalytics: ResponseAnalytics;
  readonly reviewItemCount: number;
  readonly trend: AnalyticsTrendDirection;
}

export interface LearnerAnalytics {
  readonly learnerId: ClassroomIdentifier;
  readonly sessionCount: number;
  readonly lessonCount: number;
  readonly completedLessonCount: number;
  readonly completionRate: Percentage;
  readonly averageLessonProgress: Percentage;
  readonly averageObjectiveMastery: Percentage;
  readonly masteredObjectiveCount: number;
  readonly pendingReviewCount: number;
  readonly responseAnalytics: ResponseAnalytics;
  readonly averageConfidence: Percentage;
  readonly averageEngagement: Percentage;
  readonly averageMotivation: Percentage;
  readonly confidenceTrend: AnalyticsTrendDirection;
  readonly engagementTrend: AnalyticsTrendDirection;
  readonly masteryTrend: AnalyticsTrendDirection;
  readonly totalLearningTimeMs: number;
  readonly averageSessionDurationMs: number;
  readonly lastActiveAt?: ISODateTime;
}

export interface LessonAnalytics {
  readonly lessonId: ClassroomIdentifier;
  readonly curriculumId?: ClassroomIdentifier;
  readonly unitId?: ClassroomIdentifier;
  readonly learnerCount: number;
  readonly sessionCount: number;
  readonly startedCount: number;
  readonly completedCount: number;
  readonly completionRate: Percentage;
  readonly dropoffRate: Percentage;
  readonly averageProgress: Percentage;
  readonly averageMastery: Percentage;
  readonly averageCompletionTimeMs: number;
  readonly responseAnalytics: ResponseAnalytics;
  readonly reviewScheduledCount: number;
  readonly reviewCompletedCount: number;
  readonly difficultObjectiveIds: readonly ClassroomIdentifier[];
  readonly strongObjectiveIds: readonly ClassroomIdentifier[];
}

export interface UnitAnalytics {
  readonly unitId: ClassroomIdentifier;
  readonly lessonCount: number;
  readonly learnerCount: number;
  readonly averageCompletionRate: Percentage;
  readonly averageMastery: Percentage;
  readonly averageLessonProgress: Percentage;
  readonly difficultLessonIds: readonly ClassroomIdentifier[];
}

export interface CurriculumAnalytics {
  readonly curriculumId: ClassroomIdentifier;
  readonly learnerCount: number;
  readonly lessonCount: number;
  readonly unitCount: number;
  readonly completionRate: Percentage;
  readonly averageMastery: Percentage;
  readonly responseAnalytics: ResponseAnalytics;
  readonly difficultUnitIds: readonly ClassroomIdentifier[];
  readonly difficultLessonIds: readonly ClassroomIdentifier[];
  readonly difficultObjectiveIds: readonly ClassroomIdentifier[];
  readonly strongestDomains: readonly LearningDomain[];
  readonly weakestDomains: readonly LearningDomain[];
}

export interface PlatformAnalytics {
  readonly learnerCount: number;
  readonly sessionCount: number;
  readonly lessonCount: number;
  readonly completedLessonCount: number;
  readonly completionRate: Percentage;
  readonly averageSessionDurationMs: number;
  readonly averageLessonProgress: Percentage;
  readonly averageMastery: Percentage;
  readonly responseAnalytics: ResponseAnalytics;
  readonly reviewPressure: Percentage;
  readonly activeLearners: number;
}

export interface AnalyticsInsight {
  readonly insightId: ClassroomIdentifier;
  readonly scope: AnalyticsScope;
  readonly scopeId: ClassroomIdentifier;
  readonly type: AnalyticsInsightType;
  readonly severity: AnalyticsSeverity;
  readonly title: string;
  readonly explanation: string;
  readonly evidence: Readonly<Record<string, number | string | boolean>>;
  readonly createdAt: ISODateTime;
}

export interface ClassroomAnalyticsReport {
  readonly reportId: ClassroomIdentifier;
  readonly window: AnalyticsWindow;
  readonly generatedAt: ISODateTime;
  readonly learnerAnalytics: readonly LearnerAnalytics[];
  readonly lessonAnalytics: readonly LessonAnalytics[];
  readonly unitAnalytics: readonly UnitAnalytics[];
  readonly curriculumAnalytics: readonly CurriculumAnalytics[];
  readonly objectiveAnalytics: readonly ObjectiveAnalytics[];
  readonly domainAnalytics: readonly DomainAnalytics[];
  readonly platformAnalytics: PlatformAnalytics;
  readonly insights: readonly AnalyticsInsight[];
  readonly diagnostics: AnalyticsDiagnostics;
}

export interface AnalyticsDiagnostics {
  readonly engineVersion: string;
  readonly eventCount: number;
  readonly learnerSnapshotCount: number;
  readonly motivationSnapshotCount: number;
  readonly rejectedEventCount: number;
  readonly warnings: readonly string[];
}

export interface ClassroomAnalyticsInput {
  readonly events: readonly ClassroomAnalyticsEvent[];
  readonly learningSnapshots?: readonly LearnerEducationalSnapshot[];
  readonly motivationSnapshots?: readonly LearnerMotivationSnapshot[];
  readonly window?: AnalyticsWindow;
}

export interface ClassroomAnalyticsOptions {
  readonly engineVersion?: string;
  readonly now?: () => ISODateTime;
  readonly activeLearnerWindowMs?: number;
  readonly difficultMasteryThreshold?: Percentage;
  readonly strongMasteryThreshold?: Percentage;
  readonly lowCompletionThreshold?: Percentage;
  readonly highHintDependencyThreshold?: Percentage;
  readonly maximumInsights?: number;
}

interface PreparedAnalyticsInput {
  readonly events: readonly ClassroomAnalyticsEvent[];
  readonly learningSnapshots: readonly LearnerEducationalSnapshot[];
  readonly motivationSnapshots: readonly LearnerMotivationSnapshot[];
  readonly window: AnalyticsWindow;
  readonly rejectedEventCount: number;
  readonly warnings: readonly string[];
}

interface ResponseAccumulator {
  totalResponses: number;
  evaluatedResponses: number;
  correctResponses: number;
  partiallyCorrectResponses: number;
  incorrectResponses: number;
  scores: number[];
  durations: number[];
  totalHintsUsed: number;
  responsesWithHints: number;
  firstAttempts: number;
  successfulFirstAttempts: number;
}

const DEFAULT_OPTIONS: Required<ClassroomAnalyticsOptions> = {
  engineVersion: "1.0.0",
  now: () => new Date().toISOString(),
  activeLearnerWindowMs: 24 * 60 * 60 * 1000,
  difficultMasteryThreshold: 60,
  strongMasteryThreshold: 85,
  lowCompletionThreshold: 65,
  highHintDependencyThreshold: 40,
  maximumInsights: 100,
};

export class ClassroomAnalyticsEngine {
  private readonly options: Required<ClassroomAnalyticsOptions>;

  public constructor(options: ClassroomAnalyticsOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    validateOptions(this.options);
  }

  public analyze(
    input: ClassroomAnalyticsInput,
  ): ClassroomAnalyticsReport {
    const prepared = this.prepareInput(input);
    const generatedAt = this.options.now();

    const objectiveAnalytics =
      this.buildObjectiveAnalytics(prepared);
    const domainAnalytics =
      this.buildDomainAnalytics(prepared);
    const learnerAnalytics =
      this.buildLearnerAnalytics(prepared);
    const lessonAnalytics =
      this.buildLessonAnalytics(
        prepared,
        objectiveAnalytics,
      );
    const unitAnalytics =
      this.buildUnitAnalytics(
        prepared,
        lessonAnalytics,
      );
    const curriculumAnalytics =
      this.buildCurriculumAnalytics(
        prepared,
        lessonAnalytics,
        unitAnalytics,
        objectiveAnalytics,
        domainAnalytics,
      );
    const platformAnalytics =
      this.buildPlatformAnalytics(
        prepared,
        learnerAnalytics,
      );
    const insights = this.buildInsights({
      generatedAt,
      learnerAnalytics,
      lessonAnalytics,
      curriculumAnalytics,
      objectiveAnalytics,
      domainAnalytics,
      platformAnalytics,
    });

    return Object.freeze({
      reportId: createReportId(
        prepared.window,
        generatedAt,
      ),
      window: Object.freeze({ ...prepared.window }),
      generatedAt,
      learnerAnalytics: Object.freeze(
        learnerAnalytics,
      ),
      lessonAnalytics: Object.freeze(
        lessonAnalytics,
      ),
      unitAnalytics: Object.freeze(unitAnalytics),
      curriculumAnalytics: Object.freeze(
        curriculumAnalytics,
      ),
      objectiveAnalytics: Object.freeze(
        objectiveAnalytics,
      ),
      domainAnalytics: Object.freeze(
        domainAnalytics,
      ),
      platformAnalytics,
      insights: Object.freeze(
        insights.slice(
          0,
          this.options.maximumInsights,
        ),
      ),
      diagnostics: Object.freeze({
        engineVersion: this.options.engineVersion,
        eventCount: prepared.events.length,
        learnerSnapshotCount:
          prepared.learningSnapshots.length,
        motivationSnapshotCount:
          prepared.motivationSnapshots.length,
        rejectedEventCount:
          prepared.rejectedEventCount,
        warnings: Object.freeze([
          ...prepared.warnings,
        ]),
      }),
    });
  }

  public fromLearningStateEvent(
    event: LearningStateEvent,
    state?: LearnerEducationalSnapshot,
  ): ClassroomAnalyticsEvent {
    return Object.freeze({
      eventId: event.eventId,
      type: mapLearningStateEventType(event.type),
      occurredAt: event.occurredAt,
      learnerId: event.learnerId,
      sessionId: event.sessionId,
      lessonId: event.lessonId,
      sceneId: event.sceneId,
      objectiveId: event.objectiveId,
      lessonProgress: state?.lessonProgress,
      sceneProgress: state?.sceneProgress,
      objectiveMastery:
        event.objectiveId && state
          ? state.objectives.find(
              (objective) =>
                objective.objectiveId ===
                event.objectiveId,
            )?.mastery
          : undefined,
      metadata: event.metadata,
    });
  }

  private prepareInput(
    input: ClassroomAnalyticsInput,
  ): PreparedAnalyticsInput {
    const validEvents: ClassroomAnalyticsEvent[] = [];
    const warnings: string[] = [];
    let rejectedEventCount = 0;

    for (const event of input.events) {
      try {
        validateEvent(event);
        validEvents.push(
          Object.freeze({ ...event }),
        );
      } catch (error) {
        rejectedEventCount += 1;
        warnings.push(
          error instanceof Error
            ? `Rejected event ${event.eventId}: ${error.message}`
            : `Rejected event ${event.eventId}.`,
        );
      }
    }

    validEvents.sort((left, right) =>
      left.occurredAt.localeCompare(
        right.occurredAt,
      ),
    );

    const learningSnapshots = [
      ...(input.learningSnapshots ?? []),
    ].map((snapshot) =>
      freezeLearningSnapshotReference(snapshot),
    );

    const motivationSnapshots = [
      ...(input.motivationSnapshots ?? []),
    ].map((snapshot) =>
      freezeMotivationSnapshotReference(
        snapshot,
      ),
    );

    const window =
      input.window ??
      deriveWindow(
        validEvents,
        learningSnapshots,
        this.options.now(),
      );

    validateWindow(window);

    return Object.freeze({
      events: Object.freeze(validEvents),
      learningSnapshots: Object.freeze(
        learningSnapshots,
      ),
      motivationSnapshots: Object.freeze(
        motivationSnapshots,
      ),
      window: Object.freeze({ ...window }),
      rejectedEventCount,
      warnings: Object.freeze(warnings),
    });
  }

  private buildObjectiveAnalytics(
    input: PreparedAnalyticsInput,
  ): ObjectiveAnalytics[] {
    const objectiveIds = new Set<string>();

    for (const event of input.events) {
      if (event.objectiveId) {
        objectiveIds.add(event.objectiveId);
      }
    }

    for (const snapshot of input.learningSnapshots) {
      for (const objective of snapshot.objectives) {
        objectiveIds.add(objective.objectiveId);
      }
    }

    return [...objectiveIds]
      .map((objectiveId) => {
        const events = input.events.filter(
          (event) =>
            event.objectiveId === objectiveId,
        );
        const objectiveStates =
          input.learningSnapshots
            .flatMap(
              (snapshot) =>
                snapshot.objectives,
            )
            .filter(
              (objective) =>
                objective.objectiveId ===
                objectiveId,
            );
        const learnerIds = new Set(
          events.map((event) => event.learnerId),
        );
        const responses =
          buildResponseAnalytics(events);
        const reviewScheduledCount =
          events.filter(
            (event) =>
              event.type === "review_scheduled",
          ).length;
        const reviewCompletedCount =
          events.filter(
            (event) =>
              event.type === "review_completed",
          ).length;
        const masteryValues = [
          ...objectiveStates.map(
            (objective) => objective.mastery,
          ),
          ...events
            .map(
              (event) =>
                event.objectiveMastery,
            )
            .filter(isNumber),
        ];
        const mastery =
          percentageAverage(masteryValues);
        const representative =
          objectiveStates.at(-1);
        const trendValues = events
          .map(
            (event) =>
              event.objectiveMastery ??
              event.responseScore,
          )
          .filter(isNumber);

        return Object.freeze({
          objectiveId,
          title: representative?.title,
          domain:
            representative?.domain ??
            events.find(
              (event) => event.domain,
            )?.domain,
          status:
            representative?.status ??
            deriveObjectiveStatus(
              mastery,
              responses.totalResponses,
            ),
          learnerCount: learnerIds.size,
          attemptCount:
            responses.totalResponses,
          successCount:
            responses.correctResponses,
          mastery,
          responseAnalytics: responses,
          reviewScheduledCount,
          reviewCompletedCount,
          reviewCompletionRate:
            safePercentage(
              reviewCompletedCount,
              reviewScheduledCount,
            ),
          trend: calculateTrend(
            trendValues,
          ),
        } satisfies ObjectiveAnalytics);
      })
      .sort((left, right) =>
        left.objectiveId.localeCompare(
          right.objectiveId,
        ),
      );
  }

  private buildDomainAnalytics(
    input: PreparedAnalyticsInput,
  ): DomainAnalytics[] {
    const domains = new Set<LearningDomain>();

    for (const event of input.events) {
      if (event.domain) {
        domains.add(event.domain);
      }
    }

    for (const snapshot of input.learningSnapshots) {
      for (const objective of snapshot.objectives) {
        domains.add(objective.domain);
      }
    }

    return [...domains]
      .map((domain) => {
        const events = input.events.filter(
          (event) => event.domain === domain,
        );
        const objectives =
          input.learningSnapshots.flatMap(
            (snapshot) =>
              snapshot.objectives.filter(
                (objective) =>
                  objective.domain === domain,
              ),
          );
        const masteryValues = [
          ...objectives.map(
            (objective) => objective.mastery,
          ),
          ...events
            .map(
              (event) =>
                event.objectiveMastery ??
                event.responseScore,
            )
            .filter(isNumber),
        ];
        const trendValues = events
          .map(
            (event) =>
              event.responseScore ??
              event.objectiveMastery,
          )
          .filter(isNumber);

        return Object.freeze({
          domain,
          objectiveCount: new Set(
            objectives.map(
              (objective) =>
                objective.objectiveId,
            ),
          ).size,
          learnerCount: new Set(
            events.map(
              (event) => event.learnerId,
            ),
          ).size,
          mastery:
            percentageAverage(masteryValues),
          responseAnalytics:
            buildResponseAnalytics(events),
          reviewItemCount:
            input.learningSnapshots.reduce(
              (count, snapshot) =>
                count +
                snapshot.reviewQueue.filter(
                  (item) =>
                    item.domain === domain &&
                    isUnresolvedReview(item),
                ).length,
              0,
            ),
          trend: calculateTrend(
            trendValues,
          ),
        } satisfies DomainAnalytics);
      })
      .sort((left, right) =>
        left.domain.localeCompare(
          right.domain,
        ),
      );
  }

  private buildLearnerAnalytics(
    input: PreparedAnalyticsInput,
  ): LearnerAnalytics[] {
    const learnerIds = new Set<string>();

    for (const event of input.events) {
      learnerIds.add(event.learnerId);
    }

    for (const snapshot of input.learningSnapshots) {
      learnerIds.add(snapshot.learnerId);
    }

    for (const snapshot of input.motivationSnapshots) {
      learnerIds.add(snapshot.learnerId);
    }

    return [...learnerIds]
      .map((learnerId) => {
        const events = input.events.filter(
          (event) =>
            event.learnerId === learnerId,
        );
        const learningSnapshots =
          input.learningSnapshots.filter(
            (snapshot) =>
              snapshot.learnerId ===
              learnerId,
          );
        const motivationSnapshots =
          input.motivationSnapshots.filter(
            (snapshot) =>
              snapshot.learnerId ===
              learnerId,
          );

        const sessionIds = new Set(
          events.map((event) => event.sessionId),
        );
        const lessonIds = new Set(
          [
            ...events.map(
              (event) => event.lessonId,
            ),
            ...learningSnapshots.map(
              (snapshot) =>
                snapshot.lessonId,
            ),
          ],
        );
        const completedLessonIds = new Set(
          [
            ...events
              .filter(
                (event) =>
                  event.type ===
                  "lesson_completed",
              )
              .map(
                (event) => event.lessonId,
              ),
            ...learningSnapshots
              .filter(
                (snapshot) =>
                  snapshot.status === "completed",
              )
              .map(
                (snapshot) =>
                  snapshot.lessonId,
              ),
          ],
        );

        const objectiveStates =
          latestObjectiveStates(
            learningSnapshots,
          );
        const masteryValues =
          objectiveStates.map(
            (objective) =>
              objective.mastery,
          );
        const confidenceValues =
          motivationSnapshots.map(
            (snapshot) =>
              confidenceToScore(
                snapshot.confidence,
              ),
          );
        const engagementValues =
          motivationSnapshots.map(
            (snapshot) =>
              engagementToScore(
                snapshot.engagement,
              ),
          );
        const motivationValues =
          motivationSnapshots.map(
            (snapshot) =>
              motivationToScore(
                snapshot.motivation,
              ),
          );
        const durations =
          calculateSessionDurations(events);

        return Object.freeze({
          learnerId,
          sessionCount: sessionIds.size,
          lessonCount: lessonIds.size,
          completedLessonCount:
            completedLessonIds.size,
          completionRate: safePercentage(
            completedLessonIds.size,
            lessonIds.size,
          ),
          averageLessonProgress:
            percentageAverage(
              learningSnapshots.map(
                (snapshot) =>
                  snapshot.lessonProgress,
              ),
            ),
          averageObjectiveMastery:
            percentageAverage(
              masteryValues,
            ),
          masteredObjectiveCount:
            objectiveStates.filter(
              (objective) =>
                objective.status ===
                "mastered",
            ).length,
          pendingReviewCount:
            learningSnapshots.reduce(
              (count, snapshot) =>
                count +
                snapshot.reviewQueue.filter(
                  isUnresolvedReview,
                ).length,
              0,
            ),
          responseAnalytics:
            buildResponseAnalytics(events),
          averageConfidence:
            percentageAverage(
              confidenceValues,
            ),
          averageEngagement:
            percentageAverage(
              engagementValues,
            ),
          averageMotivation:
            percentageAverage(
              motivationValues,
            ),
          confidenceTrend:
            calculateTrend(
              confidenceValues,
            ),
          engagementTrend:
            calculateTrend(
              engagementValues,
            ),
          masteryTrend:
            calculateTrend(
              events
                .map(
                  (event) =>
                    event.objectiveMastery ??
                    event.responseScore,
                )
                .filter(isNumber),
            ),
          totalLearningTimeMs:
            durations.reduce(
              (sum, duration) =>
                sum + duration,
              0,
            ),
          averageSessionDurationMs:
            numericAverage(durations),
          lastActiveAt:
            events.at(-1)?.occurredAt ??
            learningSnapshots
              .map(
                (snapshot) =>
                  snapshot.updatedAt,
              )
              .sort()
              .at(-1),
        } satisfies LearnerAnalytics);
      })
      .sort((left, right) =>
        left.learnerId.localeCompare(
          right.learnerId,
        ),
      );
  }

  private buildLessonAnalytics(
    input: PreparedAnalyticsInput,
    objectiveAnalytics: readonly ObjectiveAnalytics[],
  ): LessonAnalytics[] {
    const lessonIds = new Set<string>();

    for (const event of input.events) {
      lessonIds.add(event.lessonId);
    }

    for (const snapshot of input.learningSnapshots) {
      lessonIds.add(snapshot.lessonId);
    }

    return [...lessonIds]
      .map((lessonId) => {
        const events = input.events.filter(
          (event) =>
            event.lessonId === lessonId,
        );
        const snapshots =
          input.learningSnapshots.filter(
            (snapshot) =>
              snapshot.lessonId === lessonId,
          );
        const learnerIds = new Set(
          [
            ...events.map(
              (event) => event.learnerId,
            ),
            ...snapshots.map(
              (snapshot) =>
                snapshot.learnerId,
            ),
          ],
        );
        const sessionIds = new Set(
          events.map(
            (event) => event.sessionId,
          ),
        );
        const startedCount =
          uniqueSessionEventCount(
            events,
            "lesson_started",
          );
        const completedCount =
          uniqueSessionEventCount(
            events,
            "lesson_completed",
          ) ||
          snapshots.filter(
            (snapshot) =>
              snapshot.status === "completed",
          ).length;
        const objectiveIds = new Set(
          events
            .map(
              (event) =>
                event.objectiveId,
            )
            .filter(isString),
        );
        const relatedObjectives =
          objectiveAnalytics.filter(
            (objective) =>
              objectiveIds.has(
                objective.objectiveId,
              ),
          );
        const completionTimes =
          calculateLessonCompletionDurations(
            events,
          );
        const representative =
          events.find(
            (event) =>
              event.curriculumId ||
              event.unitId,
          );

        return Object.freeze({
          lessonId,
          curriculumId:
            representative?.curriculumId,
          unitId: representative?.unitId,
          learnerCount: learnerIds.size,
          sessionCount: sessionIds.size,
          startedCount,
          completedCount,
          completionRate:
            safePercentage(
              completedCount,
              Math.max(startedCount, sessionIds.size),
            ),
          dropoffRate:
            clampPercentage(
              100 -
                safePercentage(
                  completedCount,
                  Math.max(
                    startedCount,
                    sessionIds.size,
                  ),
                ),
            ),
          averageProgress:
            percentageAverage(
              snapshots.map(
                (snapshot) =>
                  snapshot.lessonProgress,
              ),
            ),
          averageMastery:
            percentageAverage(
              snapshots.flatMap(
                (snapshot) =>
                  snapshot.objectives.map(
                    (objective) =>
                      objective.mastery,
                  ),
              ),
            ),
          averageCompletionTimeMs:
            numericAverage(
              completionTimes,
            ),
          responseAnalytics:
            buildResponseAnalytics(events),
          reviewScheduledCount:
            events.filter(
              (event) =>
                event.type ===
                "review_scheduled",
            ).length,
          reviewCompletedCount:
            events.filter(
              (event) =>
                event.type ===
                "review_completed",
            ).length,
          difficultObjectiveIds:
            Object.freeze(
              relatedObjectives
                .filter(
                  (objective) =>
                    objective.mastery <
                    this.options
                      .difficultMasteryThreshold,
                )
                .map(
                  (objective) =>
                    objective.objectiveId,
                ),
            ),
          strongObjectiveIds:
            Object.freeze(
              relatedObjectives
                .filter(
                  (objective) =>
                    objective.mastery >=
                    this.options
                      .strongMasteryThreshold,
                )
                .map(
                  (objective) =>
                    objective.objectiveId,
                ),
            ),
        } satisfies LessonAnalytics);
      })
      .sort((left, right) =>
        left.lessonId.localeCompare(
          right.lessonId,
        ),
      );
  }

  private buildUnitAnalytics(
    input: PreparedAnalyticsInput,
    lessonAnalytics: readonly LessonAnalytics[],
  ): UnitAnalytics[] {
    const unitIds = new Set(
      input.events
        .map((event) => event.unitId)
        .filter(isString),
    );

    return [...unitIds]
      .map((unitId) => {
        const lessons =
          lessonAnalytics.filter(
            (lesson) =>
              lesson.unitId === unitId,
          );
        const events = input.events.filter(
          (event) =>
            event.unitId === unitId,
        );

        return Object.freeze({
          unitId,
          lessonCount: lessons.length,
          learnerCount: new Set(
            events.map(
              (event) =>
                event.learnerId,
            ),
          ).size,
          averageCompletionRate:
            percentageAverage(
              lessons.map(
                (lesson) =>
                  lesson.completionRate,
              ),
            ),
          averageMastery:
            percentageAverage(
              lessons.map(
                (lesson) =>
                  lesson.averageMastery,
              ),
            ),
          averageLessonProgress:
            percentageAverage(
              lessons.map(
                (lesson) =>
                  lesson.averageProgress,
              ),
            ),
          difficultLessonIds:
            Object.freeze(
              lessons
                .filter(
                  (lesson) =>
                    lesson.averageMastery <
                      this.options
                        .difficultMasteryThreshold ||
                    lesson.completionRate <
                      this.options
                        .lowCompletionThreshold,
                )
                .map(
                  (lesson) =>
                    lesson.lessonId,
                ),
            ),
        } satisfies UnitAnalytics);
      })
      .sort((left, right) =>
        left.unitId.localeCompare(
          right.unitId,
        ),
      );
  }

  private buildCurriculumAnalytics(
    input: PreparedAnalyticsInput,
    lessonAnalytics: readonly LessonAnalytics[],
    unitAnalytics: readonly UnitAnalytics[],
    objectiveAnalytics: readonly ObjectiveAnalytics[],
    domainAnalytics: readonly DomainAnalytics[],
  ): CurriculumAnalytics[] {
    const curriculumIds = new Set(
      input.events
        .map((event) => event.curriculumId)
        .filter(isString),
    );

    return [...curriculumIds]
      .map((curriculumId) => {
        const events = input.events.filter(
          (event) =>
            event.curriculumId ===
            curriculumId,
        );
        const lessonIds = new Set(
          events.map(
            (event) => event.lessonId,
          ),
        );
        const unitIds = new Set(
          events
            .map((event) => event.unitId)
            .filter(isString),
        );
        const lessons =
          lessonAnalytics.filter(
            (lesson) =>
              lessonIds.has(
                lesson.lessonId,
              ),
          );
        const units =
          unitAnalytics.filter(
            (unit) =>
              unitIds.has(unit.unitId),
          );
        const objectiveIds = new Set(
          events
            .map(
              (event) =>
                event.objectiveId,
            )
            .filter(isString),
        );
        const objectives =
          objectiveAnalytics.filter(
            (objective) =>
              objectiveIds.has(
                objective.objectiveId,
              ),
          );
        const domainRows =
          domainAnalytics.filter((domain) =>
            events.some(
              (event) =>
                event.domain ===
                domain.domain,
            ),
          );
        const sortedDomains = [
          ...domainRows,
        ].sort(
          (left, right) =>
            right.mastery -
            left.mastery,
        );

        return Object.freeze({
          curriculumId,
          learnerCount: new Set(
            events.map(
              (event) =>
                event.learnerId,
            ),
          ).size,
          lessonCount: lessons.length,
          unitCount: units.length,
          completionRate:
            percentageAverage(
              lessons.map(
                (lesson) =>
                  lesson.completionRate,
              ),
            ),
          averageMastery:
            percentageAverage(
              lessons.map(
                (lesson) =>
                  lesson.averageMastery,
              ),
            ),
          responseAnalytics:
            buildResponseAnalytics(events),
          difficultUnitIds:
            Object.freeze(
              units
                .filter(
                  (unit) =>
                    unit.averageMastery <
                      this.options
                        .difficultMasteryThreshold ||
                    unit.averageCompletionRate <
                      this.options
                        .lowCompletionThreshold,
                )
                .map(
                  (unit) => unit.unitId,
                ),
            ),
          difficultLessonIds:
            Object.freeze(
              lessons
                .filter(
                  (lesson) =>
                    lesson.averageMastery <
                      this.options
                        .difficultMasteryThreshold ||
                    lesson.completionRate <
                      this.options
                        .lowCompletionThreshold,
                )
                .map(
                  (lesson) =>
                    lesson.lessonId,
                ),
            ),
          difficultObjectiveIds:
            Object.freeze(
              objectives
                .filter(
                  (objective) =>
                    objective.mastery <
                    this.options
                      .difficultMasteryThreshold,
                )
                .map(
                  (objective) =>
                    objective.objectiveId,
                ),
            ),
          strongestDomains:
            Object.freeze(
              sortedDomains
                .slice(0, 3)
                .map(
                  (domain) =>
                    domain.domain,
                ),
            ),
          weakestDomains:
            Object.freeze(
              sortedDomains
                .slice(-3)
                .reverse()
                .map(
                  (domain) =>
                    domain.domain,
                ),
            ),
        } satisfies CurriculumAnalytics);
      })
      .sort((left, right) =>
        left.curriculumId.localeCompare(
          right.curriculumId,
        ),
      );
  }

  private buildPlatformAnalytics(
    input: PreparedAnalyticsInput,
    learnerAnalytics: readonly LearnerAnalytics[],
  ): PlatformAnalytics {
    const lessonIds = new Set(
      input.events.map(
        (event) => event.lessonId,
      ),
    );
    const sessionIds = new Set(
      input.events.map(
        (event) => event.sessionId,
      ),
    );
    const completedLessonCount =
      uniqueSessionEventCount(
        input.events,
        "lesson_completed",
      );
    const nowMs = Date.parse(
      this.options.now(),
    );
    const activeLearners =
      learnerAnalytics.filter(
        (learner) =>
          learner.lastActiveAt &&
          nowMs -
            Date.parse(
              learner.lastActiveAt,
            ) <=
            this.options
              .activeLearnerWindowMs,
      ).length;
    const unresolvedReviews =
      input.learningSnapshots.reduce(
        (count, snapshot) =>
          count +
          snapshot.reviewQueue.filter(
            isUnresolvedReview,
          ).length,
        0,
      );
    const totalObjectives =
      input.learningSnapshots.reduce(
        (count, snapshot) =>
          count +
          snapshot.objectives.length,
        0,
      );

    return Object.freeze({
      learnerCount:
        learnerAnalytics.length,
      sessionCount: sessionIds.size,
      lessonCount: lessonIds.size,
      completedLessonCount,
      completionRate:
        safePercentage(
          completedLessonCount,
          sessionIds.size,
        ),
      averageSessionDurationMs:
        numericAverage(
          learnerAnalytics.map(
            (learner) =>
              learner
                .averageSessionDurationMs,
          ),
        ),
      averageLessonProgress:
        percentageAverage(
          learnerAnalytics.map(
            (learner) =>
              learner
                .averageLessonProgress,
          ),
        ),
      averageMastery:
        percentageAverage(
          learnerAnalytics.map(
            (learner) =>
              learner
                .averageObjectiveMastery,
          ),
        ),
      responseAnalytics:
        buildResponseAnalytics(
          input.events,
        ),
      reviewPressure:
        safePercentage(
          unresolvedReviews,
          totalObjectives,
        ),
      activeLearners,
    });
  }

  private buildInsights(input: {
    readonly generatedAt: ISODateTime;
    readonly learnerAnalytics: readonly LearnerAnalytics[];
    readonly lessonAnalytics: readonly LessonAnalytics[];
    readonly curriculumAnalytics: readonly CurriculumAnalytics[];
    readonly objectiveAnalytics: readonly ObjectiveAnalytics[];
    readonly domainAnalytics: readonly DomainAnalytics[];
    readonly platformAnalytics: PlatformAnalytics;
  }): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];

    for (const learner of input.learnerAnalytics) {
      if (
        learner.averageObjectiveMastery >=
        this.options.strongMasteryThreshold
      ) {
        insights.push(
          createInsight(
            "learner",
            learner.learnerId,
            "strong_mastery",
            "info",
            "Strong learner mastery",
            "The learner is demonstrating consistently strong mastery.",
            {
              mastery:
                learner.averageObjectiveMastery,
              completedLessons:
                learner.completedLessonCount,
            },
            input.generatedAt,
          ),
        );
      }

      if (
        learner.averageConfidence < 40
      ) {
        insights.push(
          createInsight(
            "learner",
            learner.learnerId,
            "confidence_risk",
            "warning",
            "Learner confidence requires attention",
            "The learner's recent confidence indicators are low.",
            {
              confidence:
                learner.averageConfidence,
              mastery:
                learner.averageObjectiveMastery,
            },
            input.generatedAt,
          ),
        );
      }

      if (
        learner.averageEngagement < 40
      ) {
        insights.push(
          createInsight(
            "learner",
            learner.learnerId,
            "engagement_risk",
            "warning",
            "Learner engagement requires attention",
            "The learner's recent engagement indicators are low.",
            {
              engagement:
                learner.averageEngagement,
              completionRate:
                learner.completionRate,
            },
            input.generatedAt,
          ),
        );
      }

      if (
        learner.responseAnalytics
          .hintDependencyRate >=
        this.options
          .highHintDependencyThreshold
      ) {
        insights.push(
          createInsight(
            "learner",
            learner.learnerId,
            "high_hint_dependency",
            "attention",
            "High hint dependency",
            "The learner is relying on hints frequently and may need more guided practice.",
            {
              hintDependencyRate:
                learner.responseAnalytics
                  .hintDependencyRate,
              totalHints:
                learner.responseAnalytics
                  .totalHintsUsed,
            },
            input.generatedAt,
          ),
        );
      }
    }

    for (const objective of input.objectiveAnalytics) {
      if (
        objective.learnerCount > 0 &&
        objective.mastery <
          this.options
            .difficultMasteryThreshold
      ) {
        insights.push(
          createInsight(
            "objective",
            objective.objectiveId,
            "objective_difficulty",
            objective.mastery < 40
              ? "critical"
              : "warning",
            "Objective difficulty detected",
            "Learners are showing weak mastery on this objective.",
            {
              mastery: objective.mastery,
              learnerCount:
                objective.learnerCount,
              attempts:
                objective.attemptCount,
            },
            input.generatedAt,
          ),
        );
      }

      if (
        objective.reviewScheduledCount > 0 &&
        objective.reviewCompletionRate < 50
      ) {
        insights.push(
          createInsight(
            "objective",
            objective.objectiveId,
            "review_pressure",
            "attention",
            "Review pressure detected",
            "Many reviews are being scheduled, but fewer are being completed.",
            {
              scheduled:
                objective.reviewScheduledCount,
              completed:
                objective.reviewCompletedCount,
              completionRate:
                objective.reviewCompletionRate,
            },
            input.generatedAt,
          ),
        );
      }
    }

    for (const lesson of input.lessonAnalytics) {
      if (
        lesson.startedCount > 0 &&
        lesson.completionRate <
          this.options
            .lowCompletionThreshold
      ) {
        insights.push(
          createInsight(
            "lesson",
            lesson.lessonId,
            "lesson_dropoff",
            lesson.completionRate < 40
              ? "critical"
              : "warning",
            "Lesson drop-off detected",
            "A significant share of learners start this lesson but do not complete it.",
            {
              completionRate:
                lesson.completionRate,
              started:
                lesson.startedCount,
              completed:
                lesson.completedCount,
            },
            input.generatedAt,
          ),
        );
      }
    }

    for (const curriculum of input.curriculumAnalytics) {
      if (
        curriculum.difficultLessonIds.length >
          0 ||
        curriculum.difficultObjectiveIds.length >
          0
      ) {
        insights.push(
          createInsight(
            "curriculum",
            curriculum.curriculumId,
            "curriculum_difficulty",
            "warning",
            "Curriculum difficulty pattern detected",
            "Multiple difficult lessons or objectives may require curriculum review.",
            {
              difficultLessons:
                curriculum
                  .difficultLessonIds.length,
              difficultObjectives:
                curriculum
                  .difficultObjectiveIds
                  .length,
              averageMastery:
                curriculum.averageMastery,
            },
            input.generatedAt,
          ),
        );
      }
    }

    if (
      input.platformAnalytics
        .averageMastery >=
        this.options
          .strongMasteryThreshold
    ) {
      insights.push(
        createInsight(
          "platform",
          "platform",
          "positive_momentum",
          "info",
          "Positive learning momentum",
          "Platform-wide mastery is currently strong.",
          {
            averageMastery:
              input.platformAnalytics
                .averageMastery,
            activeLearners:
              input.platformAnalytics
                .activeLearners,
          },
          input.generatedAt,
        ),
      );
    }

    if (insights.length === 0) {
      insights.push(
        createInsight(
          "platform",
          "platform",
          "insufficient_data",
          "info",
          "No significant analytics pattern yet",
          "More classroom activity is required before strong conclusions can be drawn.",
          {
            learnerCount:
              input.platformAnalytics
                .learnerCount,
            sessionCount:
              input.platformAnalytics
                .sessionCount,
          },
          input.generatedAt,
        ),
      );
    }

    return insights.sort(
      (left, right) =>
        severityRank(right.severity) -
          severityRank(left.severity) ||
        left.scopeId.localeCompare(
          right.scopeId,
        ),
    );
  }
}

export function buildResponseAnalytics(
  events: readonly ClassroomAnalyticsEvent[],
): ResponseAnalytics {
  const accumulator =
    createResponseAccumulator();

  for (const event of events) {
    if (
      event.type !== "response_evaluated" &&
      event.responseOutcome === undefined &&
      event.responseScore === undefined
    ) {
      continue;
    }

    accumulator.totalResponses += 1;

    if (
      event.responseOutcome &&
      event.responseOutcome !==
        "not_evaluated"
    ) {
      accumulator.evaluatedResponses += 1;
    }

    if (
      event.responseOutcome === "correct"
    ) {
      accumulator.correctResponses += 1;
    } else if (
      event.responseOutcome ===
      "partially_correct"
    ) {
      accumulator.partiallyCorrectResponses += 1;
    } else if (
      event.responseOutcome === "incorrect"
    ) {
      accumulator.incorrectResponses += 1;
    }

    if (event.responseScore !== undefined) {
      accumulator.scores.push(
        event.responseScore,
      );
    }

    if (
      event.responseDurationMs !== undefined
    ) {
      accumulator.durations.push(
        event.responseDurationMs,
      );
    }

    const hints = event.hintsUsed ?? 0;
    accumulator.totalHintsUsed += hints;

    if (hints > 0) {
      accumulator.responsesWithHints += 1;
    }

    if (
      event.attemptNumber === 1
    ) {
      accumulator.firstAttempts += 1;

      if (
        event.responseOutcome ===
          "correct" ||
        (event.responseScore ?? 0) >= 70
      ) {
        accumulator
          .successfulFirstAttempts += 1;
      }
    }
  }

  return Object.freeze({
    totalResponses:
      accumulator.totalResponses,
    evaluatedResponses:
      accumulator.evaluatedResponses,
    correctResponses:
      accumulator.correctResponses,
    partiallyCorrectResponses:
      accumulator
        .partiallyCorrectResponses,
    incorrectResponses:
      accumulator.incorrectResponses,
    accuracy: safePercentage(
      accumulator.correctResponses,
      accumulator.evaluatedResponses,
    ),
    averageScore:
      percentageAverage(
        accumulator.scores,
      ),
    averageDurationMs:
      numericAverage(
        accumulator.durations,
      ),
    totalHintsUsed:
      accumulator.totalHintsUsed,
    averageHintsPerResponse:
      accumulator.totalResponses > 0
        ? round(
            accumulator.totalHintsUsed /
              accumulator.totalResponses,
            2,
          )
        : 0,
    hintDependencyRate:
      safePercentage(
        accumulator.responsesWithHints,
        accumulator.totalResponses,
      ),
    firstAttemptSuccessRate:
      safePercentage(
        accumulator
          .successfulFirstAttempts,
        accumulator.firstAttempts,
      ),
  });
}

export function calculateNumericDistribution(
  values: readonly number[],
): NumericDistribution {
  const cleanValues = values
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

  if (cleanValues.length === 0) {
    return Object.freeze({
      count: 0,
      minimum: 0,
      maximum: 0,
      average: 0,
      median: 0,
      p75: 0,
      p90: 0,
    });
  }

  return Object.freeze({
    count: cleanValues.length,
    minimum: cleanValues[0] ?? 0,
    maximum:
      cleanValues.at(-1) ?? 0,
    average:
      numericAverage(cleanValues),
    median:
      percentile(cleanValues, 50),
    p75: percentile(cleanValues, 75),
    p90: percentile(cleanValues, 90),
  });
}

export function calculatePercentageDistribution(
  values: readonly Percentage[],
): PercentageDistribution {
  const distribution =
    calculateNumericDistribution(
      values,
    );

  return Object.freeze({
    count: distribution.count,
    minimum: clampPercentage(
      distribution.minimum,
    ),
    maximum: clampPercentage(
      distribution.maximum,
    ),
    average: clampPercentage(
      distribution.average,
    ),
    median: clampPercentage(
      distribution.median,
    ),
    p75: clampPercentage(
      distribution.p75,
    ),
    p90: clampPercentage(
      distribution.p90,
    ),
  });
}

function createResponseAccumulator(): ResponseAccumulator {
  return {
    totalResponses: 0,
    evaluatedResponses: 0,
    correctResponses: 0,
    partiallyCorrectResponses: 0,
    incorrectResponses: 0,
    scores: [],
    durations: [],
    totalHintsUsed: 0,
    responsesWithHints: 0,
    firstAttempts: 0,
    successfulFirstAttempts: 0,
  };
}

function mapLearningStateEventType(
  type: LearningStateEvent["type"],
): AnalyticsEventType {
  switch (type) {
    case "lesson_started":
      return "lesson_started";
    case "scene_started":
      return "scene_started";
    case "scene_completed":
      return "scene_completed";
    case "objective_started":
      return "objective_started";
    case "objective_evidence_recorded":
      return "objective_evidence_recorded";
    case "review_scheduled":
      return "review_scheduled";
    case "review_completed":
      return "review_completed";
    case "checkpoint_created":
      return "checkpoint_created";
    case "lesson_paused":
      return "session_paused";
    case "lesson_resumed":
      return "session_resumed";
    case "lesson_completed":
      return "lesson_completed";
    default:
      return "response_evaluated";
  }
}

function deriveObjectiveStatus(
  mastery: Percentage,
  attempts: number,
): ObjectiveStatus {
  if (mastery >= 80 && attempts >= 2) {
    return "mastered";
  }

  if (mastery < 60 && attempts >= 3) {
    return "review_required";
  }

  if (attempts > 0) {
    return "in_progress";
  }

  return "not_started";
}

function latestObjectiveStates(
  snapshots: readonly LearnerEducationalSnapshot[],
): LearningObjectiveState[] {
  const byObjective =
    new Map<
      ClassroomIdentifier,
      LearningObjectiveState
    >();

  const sorted = [...snapshots].sort(
    (left, right) =>
      left.updatedAt.localeCompare(
        right.updatedAt,
      ),
  );

  for (const snapshot of sorted) {
    for (const objective of snapshot.objectives) {
      byObjective.set(
        objective.objectiveId,
        objective,
      );
    }
  }

  return [...byObjective.values()];
}

function calculateSessionDurations(
  events: readonly ClassroomAnalyticsEvent[],
): number[] {
  const bySession =
    groupBy(events, (event) => event.sessionId);
  const durations: number[] = [];

  for (const sessionEvents of bySession.values()) {
    const sorted = [...sessionEvents].sort(
      (left, right) =>
        left.occurredAt.localeCompare(
          right.occurredAt,
        ),
    );
    const start = sorted[0];
    const end = sorted.at(-1);

    if (!start || !end) {
      continue;
    }

    const duration =
      Date.parse(end.occurredAt) -
      Date.parse(start.occurredAt);

    if (
      Number.isFinite(duration) &&
      duration >= 0
    ) {
      durations.push(duration);
    }
  }

  return durations;
}

function calculateLessonCompletionDurations(
  events: readonly ClassroomAnalyticsEvent[],
): number[] {
  const bySession =
    groupBy(events, (event) => event.sessionId);
  const durations: number[] = [];

  for (const sessionEvents of bySession.values()) {
    const start = sessionEvents.find(
      (event) =>
        event.type === "lesson_started",
    );
    const completion = [...sessionEvents]
      .reverse()
      .find(
        (event) =>
          event.type ===
          "lesson_completed",
      );

    if (!start || !completion) {
      continue;
    }

    const duration =
      Date.parse(completion.occurredAt) -
      Date.parse(start.occurredAt);

    if (
      Number.isFinite(duration) &&
      duration >= 0
    ) {
      durations.push(duration);
    }
  }

  return durations;
}

function uniqueSessionEventCount(
  events: readonly ClassroomAnalyticsEvent[],
  type: AnalyticsEventType,
): number {
  return new Set(
    events
      .filter(
        (event) => event.type === type,
      )
      .map(
        (event) => event.sessionId,
      ),
  ).size;
}

function deriveWindow(
  events: readonly ClassroomAnalyticsEvent[],
  snapshots: readonly LearnerEducationalSnapshot[],
  fallbackNow: ISODateTime,
): AnalyticsWindow {
  const timestamps = [
    ...events.map(
      (event) => event.occurredAt,
    ),
    ...snapshots.flatMap(
      (snapshot) => [
        snapshot.startedAt,
        snapshot.updatedAt,
      ],
    ),
  ].sort();

  const startedAt =
    timestamps[0] ?? fallbackNow;
  const endedAt =
    timestamps.at(-1) ?? fallbackNow;

  return Object.freeze({
    startedAt,
    endedAt,
  });
}

function calculateTrend(
  values: readonly number[],
): AnalyticsTrendDirection {
  const clean = values.filter(
    Number.isFinite,
  );

  if (clean.length < 4) {
    return "insufficient_data";
  }

  const midpoint =
    Math.floor(clean.length / 2);
  const firstAverage =
    numericAverage(
      clean.slice(0, midpoint),
    );
  const secondAverage =
    numericAverage(
      clean.slice(midpoint),
    );
  const difference =
    secondAverage - firstAverage;

  if (difference >= 5) {
    return "improving";
  }

  if (difference <= -5) {
    return "declining";
  }

  return "stable";
}

function confidenceToScore(
  level: ConfidenceLevel,
): Percentage {
  const mapping: Record<
    ConfidenceLevel,
    Percentage
  > = {
    fragile: 25,
    developing: 50,
    stable: 75,
    strong: 100,
  };

  return mapping[level];
}

function engagementToScore(
  level: EngagementLevel,
): Percentage {
  const mapping: Record<
    EngagementLevel,
    Percentage
  > = {
    disengaged: 0,
    low: 25,
    stable: 50,
    engaged: 75,
    highly_engaged: 100,
  };

  return mapping[level];
}

function motivationToScore(
  level: MotivationLevel,
): Percentage {
  const mapping: Record<
    MotivationLevel,
    Percentage
  > = {
    very_low: 0,
    low: 25,
    stable: 50,
    high: 75,
    very_high: 100,
  };

  return mapping[level];
}

function isUnresolvedReview(
  item: ReviewItem,
): boolean {
  return (
    item.status === "pending" ||
    item.status === "in_progress"
  );
}

function createInsight(
  scope: AnalyticsScope,
  scopeId: ClassroomIdentifier,
  type: AnalyticsInsightType,
  severity: AnalyticsSeverity,
  title: string,
  explanation: string,
  evidence: Readonly<
    Record<
      string,
      number | string | boolean
    >
  >,
  createdAt: ISODateTime,
): AnalyticsInsight {
  return Object.freeze({
    insightId: `${scope}:${scopeId}:${type}:${createdAt}`,
    scope,
    scopeId,
    type,
    severity,
    title,
    explanation,
    evidence: Object.freeze({
      ...evidence,
    }),
    createdAt,
  });
}

function createReportId(
  window: AnalyticsWindow,
  generatedAt: ISODateTime,
): ClassroomIdentifier {
  return `analytics:${window.startedAt}:${window.endedAt}:${generatedAt}`;
}

function severityRank(
  severity: AnalyticsSeverity,
): number {
  const mapping: Record<
    AnalyticsSeverity,
    number
  > = {
    info: 1,
    attention: 2,
    warning: 3,
    critical: 4,
  };

  return mapping[severity];
}

function validateOptions(
  options: Required<ClassroomAnalyticsOptions>,
): void {
  if (
    !Number.isFinite(
      options.activeLearnerWindowMs,
    ) ||
    options.activeLearnerWindowMs < 1
  ) {
    throw new Error(
      "activeLearnerWindowMs must be greater than zero.",
    );
  }

  validatePercentage(
    options.difficultMasteryThreshold,
    "difficultMasteryThreshold",
  );
  validatePercentage(
    options.strongMasteryThreshold,
    "strongMasteryThreshold",
  );
  validatePercentage(
    options.lowCompletionThreshold,
    "lowCompletionThreshold",
  );
  validatePercentage(
    options.highHintDependencyThreshold,
    "highHintDependencyThreshold",
  );

  if (
    !Number.isInteger(
      options.maximumInsights,
    ) ||
    options.maximumInsights < 1
  ) {
    throw new Error(
      "maximumInsights must be a positive integer.",
    );
  }

  if (
    options.difficultMasteryThreshold >=
    options.strongMasteryThreshold
  ) {
    throw new Error(
      "difficultMasteryThreshold must be lower than strongMasteryThreshold.",
    );
  }
}

function validateEvent(
  event: ClassroomAnalyticsEvent,
): void {
  requireText(event.eventId, "eventId");
  requireText(
    event.learnerId,
    "learnerId",
  );
  requireText(
    event.sessionId,
    "sessionId",
  );
  requireText(
    event.lessonId,
    "lessonId",
  );
  requireValidDate(
    event.occurredAt,
    "occurredAt",
  );

  if (
    event.responseScore !== undefined
  ) {
    validatePercentage(
      event.responseScore,
      "responseScore",
    );
  }

  if (
    event.lessonProgress !== undefined
  ) {
    validatePercentage(
      event.lessonProgress,
      "lessonProgress",
    );
  }

  if (
    event.sceneProgress !== undefined
  ) {
    validatePercentage(
      event.sceneProgress,
      "sceneProgress",
    );
  }

  if (
    event.objectiveMastery !== undefined
  ) {
    validatePercentage(
      event.objectiveMastery,
      "objectiveMastery",
    );
  }

  if (
    event.responseDurationMs !== undefined &&
    (!Number.isFinite(
      event.responseDurationMs,
    ) ||
      event.responseDurationMs < 0)
  ) {
    throw new Error(
      "responseDurationMs must be zero or greater.",
    );
  }

  if (
    event.hintsUsed !== undefined &&
    (!Number.isInteger(
      event.hintsUsed,
    ) ||
      event.hintsUsed < 0)
  ) {
    throw new Error(
      "hintsUsed must be a non-negative integer.",
    );
  }

  if (
    event.attemptNumber !== undefined &&
    (!Number.isInteger(
      event.attemptNumber,
    ) ||
      event.attemptNumber < 1)
  ) {
    throw new Error(
      "attemptNumber must be a positive integer.",
    );
  }
}

function validateWindow(
  window: AnalyticsWindow,
): void {
  requireValidDate(
    window.startedAt,
    "window.startedAt",
  );
  requireValidDate(
    window.endedAt,
    "window.endedAt",
  );

  if (
    Date.parse(window.startedAt) >
    Date.parse(window.endedAt)
  ) {
    throw new Error(
      "Analytics window start must not be after its end.",
    );
  }
}

function requireText(
  value: string,
  field: string,
): void {
  if (!value.trim()) {
    throw new Error(
      `${field} is required.`,
    );
  }
}

function requireValidDate(
  value: string,
  field: string,
): void {
  requireText(value, field);

  if (
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(
      `${field} must be a valid ISO date-time.`,
    );
  }
}

function validatePercentage(
  value: number,
  field: string,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  ) {
    throw new Error(
      `${field} must be between 0 and 100.`,
    );
  }
}

function numericAverage(
  values: readonly number[],
): number {
  const clean = values.filter(
    Number.isFinite,
  );

  if (clean.length === 0) {
    return 0;
  }

  return round(
    clean.reduce(
      (sum, value) => sum + value,
      0,
    ) / clean.length,
    2,
  );
}

function percentageAverage(
  values: readonly number[],
): Percentage {
  return clampPercentage(
    numericAverage(values),
  );
}

function safePercentage(
  numerator: number,
  denominator: number,
): Percentage {
  if (
    denominator <= 0 ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator)
  ) {
    return 0;
  }

  return clampPercentage(
    round(
      (numerator / denominator) * 100,
      2,
    ),
  );
}

function clampPercentage(
  value: number,
): Percentage {
  return Math.max(
    0,
    Math.min(100, round(value, 2)),
  );
}

function round(
  value: number,
  digits: number,
): number {
  const factor = 10 ** digits;
  return (
    Math.round(
      (value + Number.EPSILON) *
        factor,
    ) / factor
  );
}

function percentile(
  sortedValues: readonly number[],
  percentileValue: number,
): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index =
    (percentileValue / 100) *
    (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const lowerValue =
    sortedValues[lower] ?? 0;
  const upperValue =
    sortedValues[upper] ?? lowerValue;

  if (lower === upper) {
    return lowerValue;
  }

  return round(
    lowerValue +
      (upperValue - lowerValue) *
        (index - lower),
    2,
  );
}

function groupBy<T, K>(
  values: readonly T[],
  keySelector: (value: T) => K,
): Map<K, T[]> {
  const result = new Map<K, T[]>();

  for (const value of values) {
    const key = keySelector(value);
    const group = result.get(key);

    if (group) {
      group.push(value);
    } else {
      result.set(key, [value]);
    }
  }

  return result;
}

function isNumber(
  value: number | undefined,
): value is number {
  return (
    value !== undefined &&
    Number.isFinite(value)
  );
}

function isString(
  value: string | undefined,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function freezeLearningSnapshotReference(
  snapshot: LearnerEducationalSnapshot,
): LearnerEducationalSnapshot {
  return Object.freeze({
    ...snapshot,
    objectives: Object.freeze([
      ...snapshot.objectives,
    ]),
    reviewQueue: Object.freeze([
      ...snapshot.reviewQueue,
    ]),
    completedSceneIds: Object.freeze([
      ...snapshot.completedSceneIds,
    ]),
  });
}

function freezeMotivationSnapshotReference(
  snapshot: LearnerMotivationSnapshot,
): LearnerMotivationSnapshot {
  return Object.freeze({
    ...snapshot,
    recentActivityTypes: Object.freeze([
      ...snapshot.recentActivityTypes,
    ]),
    recentActions: Object.freeze([
      ...snapshot.recentActions,
    ]),
  });
}
