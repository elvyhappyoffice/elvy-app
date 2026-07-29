/**
 * Elvy Teaching Runtime
 * Educational Memory Engine
 *
 * File: services/teaching-runtime/memory.ts
 *
 * Responsibility:
 * Build and update durable educational memory from completed teaching turns.
 *
 * This file focuses only on learning:
 * - objective mastery
 * - vocabulary and grammar retention
 * - skill performance
 * - recurring errors
 * - learner strengths and challenges
 * - unfinished work
 * - review recommendations
 *
 * It does not:
 * - store chat transcripts
 * - call AI
 * - access Supabase
 * - modify ticket time
 * - control animation
 * - mutate the supplied memory
 */

import type {
  CorrectionFocus,
  LanguageCode,
  LessonSkill,
  ResponseEvaluation,
  TeachingActivity,
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
  TeachingObjectiveType,
  TeachingSession,
  UUID,
} from "../teaching-brain/types";

/* -------------------------------------------------------------------------- */
/*                                  Contracts                                 */
/* -------------------------------------------------------------------------- */

export type MemoryMasteryStatus =
  | "not_started"
  | "emerging"
  | "developing"
  | "secure"
  | "mastered"
  | "needs_review";

export type MemoryPriority =
  | "low"
  | "medium"
  | "high"
  | "urgent";

export type MemoryContentKind =
  | "objective"
  | "vocabulary"
  | "grammar"
  | "skill"
  | "function"
  | "activity"
  | "lesson";

export type MemoryEvidenceOutcome =
  | "successful"
  | "partially_successful"
  | "unsuccessful"
  | "not_evaluated";

export type MemoryEvidence = Readonly<{
  id: UUID;
  sessionId: UUID;
  lessonId: UUID;
  stageId: string;
  activityId: string;
  learnerTurnId?: UUID;

  outcome: MemoryEvidenceOutcome;
  score: number;
  confidence: number;
  supportLevel: number;
  attempt: number;

  correctionFocuses: readonly CorrectionFocus[];
  observedAt: string;
}>;

export type MasteryRecord = Readonly<{
  id: string;
  kind: Exclude<MemoryContentKind, "lesson" | "activity">;
  title: string;

  attempts: number;
  successfulAttempts: number;
  averageScore: number;
  bestScore: number;
  lastScore: number;

  masteryScore: number;
  status: MemoryMasteryStatus;

  consecutiveSuccesses: number;
  consecutiveDifficulties: number;
  supportLevelLastUsed: number;

  firstSeenAt: string;
  lastPractisedAt: string;
  masteredAt?: string;
  reviewDueAt?: string;

  relatedLessonIds: readonly UUID[];
  evidenceIds: readonly UUID[];
}>;

export type ErrorPattern = Readonly<{
  id: string;
  focus: CorrectionFocus;
  contentId?: string;
  contentKind?: MemoryContentKind;

  occurrences: number;
  resolvedOccurrences: number;
  severity: MemoryPriority;

  firstSeenAt: string;
  lastSeenAt: string;
  lastResolvedAt?: string;

  exampleActivityIds: readonly string[];
  lessonIds: readonly UUID[];
}>;

export type LearnerStrength = Readonly<{
  id: string;
  kind: MemoryContentKind;
  referenceId: string;
  title: string;
  evidenceCount: number;
  masteryScore: number;
  lastConfirmedAt: string;
}>;

export type LearnerChallenge = Readonly<{
  id: string;
  kind: MemoryContentKind;
  referenceId: string;
  title: string;
  priority: MemoryPriority;
  evidenceCount: number;
  masteryScore: number;
  supportLevelNeeded: number;
  lastObservedAt: string;
}>;

export type UnfinishedWork = Readonly<{
  id: string;
  lessonId: UUID;
  stageId: string;
  activityId: string;
  activityTitle: string;
  objectiveIds: readonly string[];

  reason:
    | "session_paused"
    | "session_abandoned"
    | "activity_incomplete"
    | "attempt_limit"
    | "lesson_incomplete";

  attempts: number;
  lastScore?: number;
  supportLevel: number;

  createdAt: string;
  updatedAt: string;
}>;

export type ReviewRecommendation = Readonly<{
  id: string;
  kind: MemoryContentKind;
  referenceId: string;
  title: string;
  priority: MemoryPriority;
  reason:
    | "low_mastery"
    | "repeated_error"
    | "high_support"
    | "retention_review"
    | "unfinished_work"
    | "prerequisite_risk";

  recommendedAfter: string;
  estimatedMinutes: number;
  lessonId?: UUID;
  activityId?: string;
}>;

export type LessonMemorySummary = Readonly<{
  lessonId: UUID;
  title: string;

  sessionsStarted: number;
  sessionsCompleted: number;
  totalAttempts: number;

  averageScore: number;
  completionPercentage: number;

  lastSessionId?: UUID;
  lastPractisedAt?: string;
  completedAt?: string;

  masteredObjectiveIds: readonly string[];
  weakObjectiveIds: readonly string[];
  unfinishedActivityIds: readonly string[];
}>;

export type LearnerEducationalMemory = Readonly<{
  schemaVersion: "1.0";
  learnerId: UUID;
  targetLanguage: LanguageCode;

  revision: number;
  createdAt: string;
  updatedAt: string;

  objectives: Readonly<Record<string, MasteryRecord>>;
  vocabulary: Readonly<Record<string, MasteryRecord>>;
  grammar: Readonly<Record<string, MasteryRecord>>;
  skills: Readonly<Record<string, MasteryRecord>>;
  functions: Readonly<Record<string, MasteryRecord>>;

  errorPatterns: readonly ErrorPattern[];
  strengths: readonly LearnerStrength[];
  challenges: readonly LearnerChallenge[];
  unfinishedWork: readonly UnfinishedWork[];
  reviewQueue: readonly ReviewRecommendation[];

  lessons: Readonly<Record<string, LessonMemorySummary>>;
  recentEvidence: readonly MemoryEvidence[];

  metadata?: Readonly<Record<string, unknown>>;
}>;

export type CreateEducationalMemoryInput = Readonly<{
  learnerId: UUID;
  targetLanguage: LanguageCode;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}>;

export type UpdateEducationalMemoryInput = Readonly<{
  memory: LearnerEducationalMemory;
  lesson: TeachingBrainLesson;
  session: TeachingSession;
  activity: TeachingActivity;
  evaluation: ResponseEvaluation;

  stageId?: string;
  supportLevel?: number;
  attempt?: number;

  activityCompleted?: boolean;
  lessonCompleted?: boolean;
  prerequisiteRisk?: boolean;

  evidenceId?: UUID;
  observedAt?: string;
}>;

export type EducationalMemoryUpdate = Readonly<{
  memory: LearnerEducationalMemory;
  evidence: MemoryEvidence;

  newlyMastered: readonly MasteryRecord[];
  newlyIdentifiedChallenges: readonly LearnerChallenge[];
  addedReviews: readonly ReviewRecommendation[];
  resolvedUnfinishedWorkIds: readonly string[];
}>;

export type EducationalMemoryResult =
  TeachingBrainResult<EducationalMemoryUpdate>;

export type EducationalMemoryOptions = Readonly<{
  now?: () => string;
  createId?: () => UUID;

  masteryThreshold?: number;
  secureThreshold?: number;
  developingThreshold?: number;
  challengeThreshold?: number;

  maximumRecentEvidence?: number;
  maximumReviewItems?: number;
}>;

/* -------------------------------------------------------------------------- */
/*                                  Defaults                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_OPTIONS = Object.freeze({
  masteryThreshold: 85,
  secureThreshold: 75,
  developingThreshold: 55,
  challengeThreshold: 50,
  maximumRecentEvidence: 100,
  maximumReviewItems: 50,
});

const DAY_MS = 24 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*                                  Utilities                                 */
/* -------------------------------------------------------------------------- */

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function clamp(
  value: number,
  minimum = 0,
  maximum = 100,
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

function nonNegativeInteger(
  value: unknown,
  fallback = 0,
): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : fallback;
}

function createMemoryId(): UUID {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `memory-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function validIsoOrNow(
  value: string | undefined,
  now: () => string,
): string {
  const candidate = clean(value) || now();
  const parsed = new Date(candidate);

  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function addDays(
  isoDate: string,
  days: number,
): string {
  const date = new Date(isoDate);
  return new Date(
    date.getTime() + Math.max(0, days) * DAY_MS,
  ).toISOString();
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function failure<T>(
  error: TeachingBrainError,
): TeachingBrainResult<T> {
  return {
    ok: false,
    error,
  };
}

function outcomeFromEvaluation(
  evaluation: ResponseEvaluation,
): MemoryEvidenceOutcome {
  switch (evaluation.status) {
    case "correct":
      return "successful";
    case "mostly_correct":
    case "partly_correct":
      return "partially_successful";
    case "incorrect":
    case "unclear":
    case "no_response":
    case "off_topic":
    case "help_requested":
      return "unsuccessful";
    default:
      return "not_evaluated";
  }
}

function isSuccessful(
  evaluation: ResponseEvaluation,
): boolean {
  return (
    evaluation.status === "correct" ||
    evaluation.status === "mostly_correct"
  );
}

function correctionFocuses(
  evaluation: ResponseEvaluation,
): readonly CorrectionFocus[] {
  return Object.freeze([
    ...(evaluation.recommendedCorrectionFocus ?? []),
  ]);
}

function weightedAverage(
  previousAverage: number,
  previousCount: number,
  nextValue: number,
): number {
  if (previousCount <= 0) {
    return clamp(nextValue);
  }

  return clamp(
    (
      previousAverage * previousCount +
      nextValue
    ) /
      (previousCount + 1),
  );
}

function masteryStatus(
  score: number,
  attempts: number,
  consecutiveDifficulties: number,
  options: Required<
    Pick<
      EducationalMemoryOptions,
      | "masteryThreshold"
      | "secureThreshold"
      | "developingThreshold"
    >
  >,
): MemoryMasteryStatus {
  if (attempts <= 0) {
    return "not_started";
  }

  if (
    consecutiveDifficulties >= 2 &&
    score < options.secureThreshold
  ) {
    return "needs_review";
  }

  if (score >= options.masteryThreshold) {
    return "mastered";
  }

  if (score >= options.secureThreshold) {
    return "secure";
  }

  if (score >= options.developingThreshold) {
    return "developing";
  }

  return "emerging";
}

function reviewDelayDays(
  status: MemoryMasteryStatus,
): number {
  switch (status) {
    case "mastered":
      return 14;
    case "secure":
      return 7;
    case "developing":
      return 3;
    case "emerging":
    case "needs_review":
      return 1;
    case "not_started":
    default:
      return 0;
  }
}

function priorityFromScore(
  score: number,
  occurrences = 1,
): MemoryPriority {
  if (score < 30 || occurrences >= 5) {
    return "urgent";
  }

  if (score < 50 || occurrences >= 3) {
    return "high";
  }

  if (score < 70 || occurrences >= 2) {
    return "medium";
  }

  return "low";
}

function estimateReviewMinutes(
  kind: MemoryContentKind,
  priority: MemoryPriority,
): number {
  const base =
    kind === "lesson"
      ? 12
      : kind === "activity"
        ? 8
        : 5;

  switch (priority) {
    case "urgent":
      return base + 5;
    case "high":
      return base + 3;
    case "medium":
      return base + 1;
    case "low":
    default:
      return base;
  }
}

/* -------------------------------------------------------------------------- */
/*                             Content resolution                             */
/* -------------------------------------------------------------------------- */

type MemoryTarget = Readonly<{
  id: string;
  kind: Exclude<MemoryContentKind, "lesson" | "activity">;
  title: string;
}>;

function objectiveTitle(
  lesson: TeachingBrainLesson,
  objectiveId: string,
): string {
  return (
    lesson.objectives.find(
      (objective) => objective.id === objectiveId,
    )?.statement ??
    objectiveId
  );
}

function vocabularyTitle(
  lesson: TeachingBrainLesson,
  vocabularyId: string,
): string {
  return (
    lesson.vocabulary.find(
      (item) => item.id === vocabularyId,
    )?.term ??
    vocabularyId
  );
}

function grammarTitle(
  lesson: TeachingBrainLesson,
  grammarId: string,
): string {
  return (
    lesson.grammar.find(
      (item) => item.id === grammarId,
    )?.title ??
    grammarId
  );
}

function functionTitle(
  lesson: TeachingBrainLesson,
  functionId: string,
): string {
  return (
    lesson.functions.find(
      (item) => item.id === functionId,
    )?.name ??
    functionId
  );
}

function skillTitle(
  lesson: TeachingBrainLesson,
  skillId: string,
): string {
  const skill = lesson.skills.find(
    (item) => item.id === skillId,
  );

  return skill
    ? `${skill.skill}: ${skill.description}`
    : skillId;
}

function resolveTargets(
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
): readonly MemoryTarget[] {
  const targets: MemoryTarget[] = [];

  for (const id of activity.targetObjectiveIds) {
    targets.push({
      id,
      kind: "objective",
      title: objectiveTitle(lesson, id),
    });
  }

  for (const id of activity.targetVocabularyIds ?? []) {
    targets.push({
      id,
      kind: "vocabulary",
      title: vocabularyTitle(lesson, id),
    });
  }

  for (const id of activity.targetGrammarIds ?? []) {
    targets.push({
      id,
      kind: "grammar",
      title: grammarTitle(lesson, id),
    });
  }

  for (const id of activity.targetFunctionIds ?? []) {
    targets.push({
      id,
      kind: "function",
      title: functionTitle(lesson, id),
    });
  }

  const objectiveTypes = new Set<TeachingObjectiveType>(
    activity.targetObjectiveIds
      .map(
        (id) =>
          lesson.objectives.find(
            (objective) => objective.id === id,
          )?.type,
      )
      .filter(
        (
          type,
        ): type is TeachingObjectiveType =>
          type !== undefined,
      ),
  );

  const mappedSkills: LessonSkill[] = [];

  for (const objectiveType of objectiveTypes) {
    if (
      objectiveType === "listening" ||
      objectiveType === "speaking" ||
      objectiveType === "reading" ||
      objectiveType === "writing" ||
      objectiveType === "pronunciation" ||
      objectiveType === "grammar" ||
      objectiveType === "vocabulary" ||
      objectiveType === "interaction" ||
      objectiveType === "culture"
    ) {
      mappedSkills.push(objectiveType);
    }
  }

  for (const skill of lesson.skills) {
    if (mappedSkills.includes(skill.skill)) {
      targets.push({
        id: skill.id,
        kind: "skill",
        title: skillTitle(lesson, skill.id),
      });
    }
  }

  const seen = new Set<string>();

  return Object.freeze(
    targets.filter((target) => {
      const key = `${target.kind}:${target.id}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    }),
  );
}

/* -------------------------------------------------------------------------- */
/*                            Mastery record update                           */
/* -------------------------------------------------------------------------- */

function recordMap(
  memory: LearnerEducationalMemory,
  kind: MemoryTarget["kind"],
): Readonly<Record<string, MasteryRecord>> {
  switch (kind) {
    case "objective":
      return memory.objectives;
    case "vocabulary":
      return memory.vocabulary;
    case "grammar":
      return memory.grammar;
    case "skill":
      return memory.skills;
    case "function":
      return memory.functions;
  }
}

function updateMasteryRecord(
  previous: MasteryRecord | undefined,
  target: MemoryTarget,
  lessonId: UUID,
  evidence: MemoryEvidence,
  options: Required<
    Pick<
      EducationalMemoryOptions,
      | "masteryThreshold"
      | "secureThreshold"
      | "developingThreshold"
    >
  >,
): MasteryRecord {
  const attempts = (previous?.attempts ?? 0) + 1;
  const successful =
    evidence.outcome === "successful" ||
    evidence.outcome === "partially_successful";

  const successfulAttempts =
    (previous?.successfulAttempts ?? 0) +
    (successful ? 1 : 0);

  const averageScore = weightedAverage(
    previous?.averageScore ?? 0,
    previous?.attempts ?? 0,
    evidence.score,
  );

  const consecutiveSuccesses = successful
    ? (previous?.consecutiveSuccesses ?? 0) + 1
    : 0;

  const consecutiveDifficulties = successful
    ? 0
    : (previous?.consecutiveDifficulties ?? 0) + 1;

  /*
   * Mastery combines performance, repeat success, confidence, and support.
   * High support lowers certainty without erasing demonstrated knowledge.
   */
  const supportPenalty =
    Math.min(20, evidence.supportLevel * 4);

  const confidenceAdjustment =
    (clamp(evidence.confidence, 0, 1) - 0.5) * 10;

  const consistencyAdjustment =
    Math.min(10, consecutiveSuccesses * 2) -
    Math.min(15, consecutiveDifficulties * 4);

  const masteryScore = clamp(
    averageScore +
      confidenceAdjustment +
      consistencyAdjustment -
      supportPenalty,
  );

  const status = masteryStatus(
    masteryScore,
    attempts,
    consecutiveDifficulties,
    options,
  );

  const firstSeenAt =
    previous?.firstSeenAt ??
    evidence.observedAt;

  const masteredAt =
    status === "mastered"
      ? previous?.masteredAt ?? evidence.observedAt
      : undefined;

  return Object.freeze({
    id: target.id,
    kind: target.kind,
    title: target.title,

    attempts,
    successfulAttempts,
    averageScore,
    bestScore: Math.max(
      previous?.bestScore ?? 0,
      evidence.score,
    ),
    lastScore: evidence.score,

    masteryScore,
    status,

    consecutiveSuccesses,
    consecutiveDifficulties,
    supportLevelLastUsed:
      evidence.supportLevel,

    firstSeenAt,
    lastPractisedAt:
      evidence.observedAt,
    masteredAt,
    reviewDueAt: addDays(
      evidence.observedAt,
      reviewDelayDays(status),
    ),

    relatedLessonIds: Object.freeze(
      unique([
        ...(previous?.relatedLessonIds ?? []),
        lessonId,
      ]),
    ),
    evidenceIds: Object.freeze(
      unique([
        ...(previous?.evidenceIds ?? []),
        evidence.id,
      ]).slice(-25),
    ),
  });
}

function replaceRecord(
  records: Readonly<Record<string, MasteryRecord>>,
  record: MasteryRecord,
): Readonly<Record<string, MasteryRecord>> {
  return Object.freeze({
    ...records,
    [record.id]: record,
  });
}

/* -------------------------------------------------------------------------- */
/*                              Error patterns                                */
/* -------------------------------------------------------------------------- */

function errorPatternId(
  focus: CorrectionFocus,
  contentId?: string,
): string {
  return `${focus}:${contentId ?? "general"}`;
}

function updateErrorPatterns(
  previous: readonly ErrorPattern[],
  targets: readonly MemoryTarget[],
  evidence: MemoryEvidence,
): readonly ErrorPattern[] {
  const focuses = evidence.correctionFocuses;

  if (focuses.length === 0) {
    return Object.freeze(
      previous.map((pattern) => {
        const related = targets.some(
          (target) =>
            target.id === pattern.contentId,
        );

        if (!related || evidence.outcome !== "successful") {
          return pattern;
        }

        return Object.freeze({
          ...pattern,
          resolvedOccurrences:
            pattern.resolvedOccurrences + 1,
          lastResolvedAt: evidence.observedAt,
        });
      }),
    );
  }

  const next = [...previous];

  for (const focus of focuses) {
    const relatedTargets =
      targets.length > 0
        ? targets
        : [
            {
              id: undefined,
              kind: undefined,
            },
          ];

    for (const target of relatedTargets) {
      const contentId =
        "id" in target ? target.id : undefined;

      const contentKind =
        "kind" in target
          ? target.kind
          : undefined;

      const id = errorPatternId(
        focus,
        contentId,
      );

      const index = next.findIndex(
        (pattern) => pattern.id === id,
      );

      const current =
        index >= 0 ? next[index] : undefined;

      const occurrences =
        (current?.occurrences ?? 0) + 1;

      const updated: ErrorPattern =
        Object.freeze({
          id,
          focus,
          contentId,
          contentKind,
          occurrences,
          resolvedOccurrences:
            current?.resolvedOccurrences ?? 0,
          severity: priorityFromScore(
            evidence.score,
            occurrences,
          ),
          firstSeenAt:
            current?.firstSeenAt ??
            evidence.observedAt,
          lastSeenAt:
            evidence.observedAt,
          lastResolvedAt:
            current?.lastResolvedAt,
          exampleActivityIds: Object.freeze(
            unique([
              ...(current?.exampleActivityIds ?? []),
              evidence.activityId,
            ]).slice(-10),
          ),
          lessonIds: Object.freeze(
            unique([
              ...(current?.lessonIds ?? []),
              evidence.lessonId,
            ]),
          ),
        });

      if (index >= 0) {
        next[index] = updated;
      } else {
        next.push(updated);
      }
    }
  }

  return Object.freeze(next);
}

/* -------------------------------------------------------------------------- */
/*                      Strengths, challenges, reviews                        */
/* -------------------------------------------------------------------------- */

function buildStrengths(
  memory: LearnerEducationalMemory,
): readonly LearnerStrength[] {
  const records = allMasteryRecords(memory);

  return Object.freeze(
    records
      .filter(
        (record) =>
          (
            record.status === "mastered" ||
            record.status === "secure"
          ) &&
          record.successfulAttempts >= 2,
      )
      .sort(
        (left, right) =>
          right.masteryScore - left.masteryScore,
      )
      .slice(0, 20)
      .map((record) =>
        Object.freeze({
          id: `${record.kind}:${record.id}`,
          kind: record.kind,
          referenceId: record.id,
          title: record.title,
          evidenceCount: record.attempts,
          masteryScore: record.masteryScore,
          lastConfirmedAt: record.lastPractisedAt,
        }),
      ),
  );
}

function buildChallenges(
  memory: LearnerEducationalMemory,
  threshold: number,
): readonly LearnerChallenge[] {
  const records = allMasteryRecords(memory);

  return Object.freeze(
    records
      .filter(
        (record) =>
          record.attempts >= 2 &&
          (
            record.masteryScore < threshold ||
            record.status === "needs_review" ||
            record.consecutiveDifficulties >= 2
          ),
      )
      .sort(
        (left, right) =>
          left.masteryScore - right.masteryScore,
      )
      .slice(0, 30)
      .map((record) =>
        Object.freeze({
          id: `${record.kind}:${record.id}`,
          kind: record.kind,
          referenceId: record.id,
          title: record.title,
          priority: priorityFromScore(
            record.masteryScore,
            record.consecutiveDifficulties,
          ),
          evidenceCount: record.attempts,
          masteryScore: record.masteryScore,
          supportLevelNeeded:
            record.supportLevelLastUsed,
          lastObservedAt:
            record.lastPractisedAt,
        }),
      ),
  );
}

function allMasteryRecords(
  memory: LearnerEducationalMemory,
): MasteryRecord[] {
  return [
    ...Object.values(memory.objectives),
    ...Object.values(memory.vocabulary),
    ...Object.values(memory.grammar),
    ...Object.values(memory.skills),
    ...Object.values(memory.functions),
  ];
}

function recommendationId(
  kind: MemoryContentKind,
  referenceId: string,
  reason: ReviewRecommendation["reason"],
): string {
  return `${kind}:${referenceId}:${reason}`;
}

function upsertReview(
  reviews: readonly ReviewRecommendation[],
  recommendation: ReviewRecommendation,
): readonly ReviewRecommendation[] {
  return Object.freeze([
    ...reviews.filter(
      (item) => item.id !== recommendation.id,
    ),
    recommendation,
  ]);
}

function createReviews(
  memory: LearnerEducationalMemory,
  lesson: TeachingBrainLesson,
  activity: TeachingActivity,
  prerequisiteRisk: boolean,
  observedAt: string,
): readonly ReviewRecommendation[] {
  let reviews = [...memory.reviewQueue];

  for (const challenge of memory.challenges) {
    const reason: ReviewRecommendation["reason"] =
      challenge.supportLevelNeeded >= 2
        ? "high_support"
        : "low_mastery";

    reviews = [
      ...upsertReview(
        reviews,
        Object.freeze({
          id: recommendationId(
            challenge.kind,
            challenge.referenceId,
            reason,
          ),
          kind: challenge.kind,
          referenceId: challenge.referenceId,
          title: challenge.title,
          priority: challenge.priority,
          reason,
          recommendedAfter: addDays(
            observedAt,
            challenge.priority === "urgent" ? 0 : 1,
          ),
          estimatedMinutes: estimateReviewMinutes(
            challenge.kind,
            challenge.priority,
          ),
          lessonId: lesson.id,
          activityId: activity.id,
        }),
      ),
    ];
  }

  for (const pattern of memory.errorPatterns) {
    const unresolved =
      pattern.occurrences -
      pattern.resolvedOccurrences;

    if (unresolved < 2) {
      continue;
    }

    const referenceId =
      pattern.contentId ??
      pattern.id;

    reviews = [
      ...upsertReview(
        reviews,
        Object.freeze({
          id: recommendationId(
            pattern.contentKind ?? "activity",
            referenceId,
            "repeated_error",
          ),
          kind:
            pattern.contentKind ??
            "activity",
          referenceId,
          title:
            pattern.contentId ??
            `${pattern.focus} practice`,
          priority: pattern.severity,
          reason: "repeated_error",
          recommendedAfter: addDays(
            observedAt,
            pattern.severity === "urgent" ? 0 : 1,
          ),
          estimatedMinutes: estimateReviewMinutes(
            pattern.contentKind ?? "activity",
            pattern.severity,
          ),
          lessonId: lesson.id,
          activityId: activity.id,
        }),
      ),
    ];
  }

  if (prerequisiteRisk) {
    reviews = [
      ...upsertReview(
        reviews,
        Object.freeze({
          id: recommendationId(
            "activity",
            activity.id,
            "prerequisite_risk",
          ),
          kind: "activity",
          referenceId: activity.id,
          title: activity.title,
          priority: "high",
          reason: "prerequisite_risk",
          recommendedAfter: observedAt,
          estimatedMinutes: 8,
          lessonId: lesson.id,
          activityId: activity.id,
        }),
      ),
    ];
  }

  return Object.freeze(reviews);
}

/* -------------------------------------------------------------------------- */
/*                            Unfinished work                                 */
/* -------------------------------------------------------------------------- */

function unfinishedWorkId(
  lessonId: UUID,
  activityId: string,
): string {
  return `${lessonId}:${activityId}`;
}

function updateUnfinishedWork(
  previous: readonly UnfinishedWork[],
  lesson: TeachingBrainLesson,
  session: TeachingSession,
  activity: TeachingActivity,
  evidence: MemoryEvidence,
  activityCompleted: boolean,
  lessonCompleted: boolean,
): Readonly<{
  items: readonly UnfinishedWork[];
  resolvedIds: readonly string[];
}> {
  const id = unfinishedWorkId(
    lesson.id,
    activity.id,
  );

  if (activityCompleted || lessonCompleted) {
    const exists = previous.some(
      (item) => item.id === id,
    );

    return Object.freeze({
      items: Object.freeze(
        previous.filter((item) => item.id !== id),
      ),
      resolvedIds: Object.freeze(
        exists ? [id] : [],
      ),
    });
  }

  const shouldTrack =
    session.status === "paused" ||
    session.status === "abandoned" ||
    evidence.outcome === "unsuccessful";

  if (!shouldTrack) {
    return Object.freeze({
      items: Object.freeze([...previous]),
      resolvedIds: Object.freeze([]),
    });
  }

  const current = previous.find(
    (item) => item.id === id,
  );

  const reason: UnfinishedWork["reason"] =
    session.status === "paused"
      ? "session_paused"
      : session.status === "abandoned"
        ? "session_abandoned"
        : evidence.attempt >=
            Math.max(1, activity.maximumAttempts)
          ? "attempt_limit"
          : "activity_incomplete";

  const updated: UnfinishedWork =
    Object.freeze({
      id,
      lessonId: lesson.id,
      stageId: evidence.stageId,
      activityId: activity.id,
      activityTitle: activity.title,
      objectiveIds: Object.freeze([
        ...activity.targetObjectiveIds,
      ]),
      reason,
      attempts: Math.max(
        current?.attempts ?? 0,
        evidence.attempt,
      ),
      lastScore: evidence.score,
      supportLevel: evidence.supportLevel,
      createdAt:
        current?.createdAt ??
        evidence.observedAt,
      updatedAt:
        evidence.observedAt,
    });

  return Object.freeze({
    items: Object.freeze([
      ...previous.filter((item) => item.id !== id),
      updated,
    ]),
    resolvedIds: Object.freeze([]),
  });
}

/* -------------------------------------------------------------------------- */
/*                              Lesson summary                                */
/* -------------------------------------------------------------------------- */

function updateLessonSummary(
  previous: LessonMemorySummary | undefined,
  lesson: TeachingBrainLesson,
  session: TeachingSession,
  memory: LearnerEducationalMemory,
  evidence: MemoryEvidence,
  lessonCompleted: boolean,
): LessonMemorySummary {
  const lessonObjectiveIds = new Set(
    lesson.objectives.map((objective) => objective.id),
  );

  const objectiveRecords = Object.values(
    memory.objectives,
  ).filter((record) =>
    lessonObjectiveIds.has(record.id),
  );

  const lessonUnfinished = memory.unfinishedWork.filter(
    (item) => item.lessonId === lesson.id,
  );

  return Object.freeze({
    lessonId: lesson.id,
    title: lesson.title,

    sessionsStarted: Math.max(
      1,
      previous?.sessionsStarted ?? 0,
    ),
    sessionsCompleted:
      (previous?.sessionsCompleted ?? 0) +
      (
        lessonCompleted &&
        previous?.lastSessionId !== session.id
          ? 1
          : 0
      ),
    totalAttempts:
      (previous?.totalAttempts ?? 0) + 1,

    averageScore: weightedAverage(
      previous?.averageScore ?? 0,
      previous?.totalAttempts ?? 0,
      evidence.score,
    ),
    completionPercentage:
      lessonCompleted
        ? 100
        : session.completionPercentage,

    lastSessionId: session.id,
    lastPractisedAt:
      evidence.observedAt,
    completedAt:
      lessonCompleted
        ? evidence.observedAt
        : previous?.completedAt,

    masteredObjectiveIds: Object.freeze(
      objectiveRecords
        .filter(
          (record) =>
            record.status === "mastered" ||
            record.status === "secure",
        )
        .map((record) => record.id),
    ),
    weakObjectiveIds: Object.freeze(
      objectiveRecords
        .filter(
          (record) =>
            record.status === "emerging" ||
            record.status === "needs_review",
        )
        .map((record) => record.id),
    ),
    unfinishedActivityIds: Object.freeze(
      lessonUnfinished.map(
        (item) => item.activityId,
      ),
    ),
  });
}

/* -------------------------------------------------------------------------- */
/*                           Educational Memory                               */
/* -------------------------------------------------------------------------- */

export class EducationalMemoryEngine {
  private readonly now: () => string;
  private readonly createId: () => UUID;
  private readonly options: Required<
    Omit<
      EducationalMemoryOptions,
      "now" | "createId"
    >
  >;

  constructor(options: EducationalMemoryOptions = {}) {
    this.now =
      options.now ?? (() => new Date().toISOString());

    this.createId =
      options.createId ?? createMemoryId;

    this.options = {
      masteryThreshold:
        options.masteryThreshold ??
        DEFAULT_OPTIONS.masteryThreshold,
      secureThreshold:
        options.secureThreshold ??
        DEFAULT_OPTIONS.secureThreshold,
      developingThreshold:
        options.developingThreshold ??
        DEFAULT_OPTIONS.developingThreshold,
      challengeThreshold:
        options.challengeThreshold ??
        DEFAULT_OPTIONS.challengeThreshold,
      maximumRecentEvidence:
        options.maximumRecentEvidence ??
        DEFAULT_OPTIONS.maximumRecentEvidence,
      maximumReviewItems:
        options.maximumReviewItems ??
        DEFAULT_OPTIONS.maximumReviewItems,
    };
  }

  create(
    input: CreateEducationalMemoryInput,
  ): LearnerEducationalMemory {
    const now = validIsoOrNow(
      input.createdAt,
      this.now,
    );

    return Object.freeze({
      schemaVersion: "1.0",
      learnerId: clean(input.learnerId),
      targetLanguage: input.targetLanguage,
      revision: 0,
      createdAt: now,
      updatedAt: now,

      objectives: Object.freeze({}),
      vocabulary: Object.freeze({}),
      grammar: Object.freeze({}),
      skills: Object.freeze({}),
      functions: Object.freeze({}),

      errorPatterns: Object.freeze([]),
      strengths: Object.freeze([]),
      challenges: Object.freeze([]),
      unfinishedWork: Object.freeze([]),
      reviewQueue: Object.freeze([]),

      lessons: Object.freeze({}),
      recentEvidence: Object.freeze([]),

      metadata:
        input.metadata
          ? Object.freeze({ ...input.metadata })
          : undefined,
    });
  }

  update(
    input: UpdateEducationalMemoryInput,
  ): EducationalMemoryResult {
    const validationError =
      this.validateUpdate(input);

    if (validationError) {
      return failure(validationError);
    }

    const observedAt = validIsoOrNow(
      input.observedAt,
      this.now,
    );

    const stageId =
      clean(input.stageId) ||
      clean(input.session.currentStageId);

    const supportLevel = nonNegativeInteger(
      input.supportLevel,
      input.session.currentSupportLevel,
    );

    const attempt = Math.max(
      1,
      nonNegativeInteger(
        input.attempt,
        input.session.currentAttempt,
      ),
    );

    const evidence: MemoryEvidence =
      Object.freeze({
        id:
          clean(input.evidenceId) ||
          this.createId(),
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        stageId,
        activityId: input.activity.id,
        learnerTurnId:
          input.evaluation.learnerTurnId,
        outcome: outcomeFromEvaluation(
          input.evaluation,
        ),
        score: clamp(
          input.evaluation.score,
        ),
        confidence: clamp(
          input.evaluation.confidence,
          0,
          1,
        ),
        supportLevel,
        attempt,
        correctionFocuses:
          correctionFocuses(input.evaluation),
        observedAt,
      });

    const targets = resolveTargets(
      input.lesson,
      input.activity,
    );

    let objectives = input.memory.objectives;
    let vocabulary = input.memory.vocabulary;
    let grammar = input.memory.grammar;
    let skills = input.memory.skills;
    let functions = input.memory.functions;

    const newlyMastered: MasteryRecord[] = [];

    for (const target of targets) {
      const previous =
        recordMap(input.memory, target.kind)[
          target.id
        ];

      const updated = updateMasteryRecord(
        previous,
        target,
        input.lesson.id,
        evidence,
        this.options,
      );

      if (
        updated.status === "mastered" &&
        previous?.status !== "mastered"
      ) {
        newlyMastered.push(updated);
      }

      switch (target.kind) {
        case "objective":
          objectives = replaceRecord(
            objectives,
            updated,
          );
          break;
        case "vocabulary":
          vocabulary = replaceRecord(
            vocabulary,
            updated,
          );
          break;
        case "grammar":
          grammar = replaceRecord(
            grammar,
            updated,
          );
          break;
        case "skill":
          skills = replaceRecord(
            skills,
            updated,
          );
          break;
        case "function":
          functions = replaceRecord(
            functions,
            updated,
          );
          break;
      }
    }

    const errorPatterns =
      updateErrorPatterns(
        input.memory.errorPatterns,
        targets,
        evidence,
      );

    const unfinished =
      updateUnfinishedWork(
        input.memory.unfinishedWork,
        input.lesson,
        input.session,
        input.activity,
        evidence,
        Boolean(input.activityCompleted),
        Boolean(input.lessonCompleted),
      );

    const preliminary: LearnerEducationalMemory =
      Object.freeze({
        ...input.memory,
        revision: input.memory.revision + 1,
        updatedAt: observedAt,
        objectives,
        vocabulary,
        grammar,
        skills,
        functions,
        errorPatterns,
        unfinishedWork: unfinished.items,
        recentEvidence: Object.freeze([
          ...input.memory.recentEvidence,
          evidence,
        ].slice(
          -this.options.maximumRecentEvidence,
        )),
      });

    const previousChallengeIds = new Set(
      input.memory.challenges.map(
        (challenge) => challenge.id,
      ),
    );

    const strengths =
      buildStrengths(preliminary);

    const challenges =
      buildChallenges(
        preliminary,
        this.options.challengeThreshold,
      );

    const newlyIdentifiedChallenges =
      challenges.filter(
        (challenge) =>
          !previousChallengeIds.has(challenge.id),
      );

    const memoryWithInsights:
      LearnerEducationalMemory =
      Object.freeze({
        ...preliminary,
        strengths,
        challenges,
      });

    const reviewQueue = [
      ...createReviews(
        memoryWithInsights,
        input.lesson,
        input.activity,
        Boolean(input.prerequisiteRisk),
        observedAt,
      ),
    ]
      .sort(
        (
          left: ReviewRecommendation,
          right: ReviewRecommendation,
        ) => {
          const priorities: Record<
            MemoryPriority,
            number
          > = {
            urgent: 4,
            high: 3,
            medium: 2,
            low: 1,
          };

          return (
            priorities[right.priority] -
            priorities[left.priority]
          );
        },
      )
      .slice(
        0,
        this.options.maximumReviewItems,
      );

    const previousReviewIds = new Set(
      input.memory.reviewQueue.map(
        (review) => review.id,
      ),
    );

    const addedReviews = reviewQueue.filter(
      (
        review: ReviewRecommendation,
      ) => !previousReviewIds.has(review.id),
    );

    const lessonSummary =
      updateLessonSummary(
        input.memory.lessons[
          input.lesson.id
        ],
        input.lesson,
        input.session,
        memoryWithInsights,
        evidence,
        Boolean(input.lessonCompleted),
      );

    const memory: LearnerEducationalMemory =
      Object.freeze({
        ...memoryWithInsights,
        reviewQueue: Object.freeze(
          reviewQueue,
        ),
        lessons: Object.freeze({
          ...input.memory.lessons,
          [input.lesson.id]: lessonSummary,
        }),
      });

    return {
      ok: true,
      data: Object.freeze({
        memory,
        evidence,
        newlyMastered:
          Object.freeze(newlyMastered),
        newlyIdentifiedChallenges:
          Object.freeze(
            newlyIdentifiedChallenges,
          ),
        addedReviews:
          Object.freeze(addedReviews),
        resolvedUnfinishedWorkIds:
          unfinished.resolvedIds,
      }),
    };
  }

  getDueReviews(
    memory: LearnerEducationalMemory,
    at?: string,
  ): readonly ReviewRecommendation[] {
    const now = new Date(
      validIsoOrNow(at, this.now),
    ).getTime();

    return Object.freeze(
      memory.reviewQueue.filter(
        (review) =>
          new Date(
            review.recommendedAfter,
          ).getTime() <= now,
      ),
    );
  }

  getLessonSummary(
    memory: LearnerEducationalMemory,
    lessonId: UUID,
  ): LessonMemorySummary | undefined {
    return memory.lessons[lessonId];
  }

  getPerformanceSnapshot(
    memory: LearnerEducationalMemory,
    activityId?: string,
  ): Readonly<{
    consecutiveSuccesses: number;
    consecutiveFailures: number;
    totalAttemptsForActivity: number;
    successfulAttemptsForActivity: number;
    currentSupportLevel: number;
    prerequisiteRisk: boolean;
  }> {
    const relevant = clean(activityId)
      ? memory.recentEvidence.filter(
          (evidence) =>
            evidence.activityId === activityId,
        )
      : memory.recentEvidence;

    let consecutiveSuccesses = 0;
    let consecutiveFailures = 0;

    for (
      let index = relevant.length - 1;
      index >= 0;
      index -= 1
    ) {
      const item = relevant[index];

      if (
        item.outcome === "successful" ||
        item.outcome ===
          "partially_successful"
      ) {
        if (consecutiveFailures > 0) {
          break;
        }

        consecutiveSuccesses += 1;
      } else if (
        item.outcome === "unsuccessful"
      ) {
        if (consecutiveSuccesses > 0) {
          break;
        }

        consecutiveFailures += 1;
      }
    }

    const successfulAttempts =
      relevant.filter(
        (item) =>
          item.outcome === "successful" ||
          item.outcome ===
            "partially_successful",
      ).length;

    const currentSupportLevel =
      relevant.at(-1)?.supportLevel ?? 0;

    const prerequisiteRisk =
      memory.reviewQueue.some(
        (review) =>
          review.reason ===
            "prerequisite_risk" &&
          (
            !activityId ||
            review.activityId === activityId
          ),
      );

    return Object.freeze({
      consecutiveSuccesses,
      consecutiveFailures,
      totalAttemptsForActivity:
        relevant.length,
      successfulAttemptsForActivity:
        successfulAttempts,
      currentSupportLevel,
      prerequisiteRisk,
    });
  }

  private validateUpdate(
    input: UpdateEducationalMemoryInput,
  ): TeachingBrainError | null {
    if (!input || typeof input !== "object") {
      return {
        code: "UNSUPPORTED_INPUT",
        message:
          "An educational-memory update input is required.",
        recoverable: true,
      };
    }

    if (
      !input.memory ||
      typeof input.memory !== "object"
    ) {
      return {
        code: "UNSUPPORTED_INPUT",
        message:
          "A learner educational memory is required.",
        recoverable: true,
      };
    }

    if (
      !input.lesson ||
      typeof input.lesson !== "object"
    ) {
      return {
        code: "INVALID_LESSON",
        message:
          "A Teaching Brain lesson is required.",
        recoverable: true,
      };
    }

    if (
      !input.session ||
      typeof input.session !== "object"
    ) {
      return {
        code: "INVALID_SESSION",
        message:
          "A teaching session is required.",
        lessonId: input.lesson.id,
        recoverable: true,
      };
    }

    if (
      !input.activity ||
      typeof input.activity !== "object"
    ) {
      return {
        code: "ACTIVITY_NOT_FOUND",
        message:
          "A teaching activity is required.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        recoverable: true,
      };
    }

    if (
      !input.evaluation ||
      typeof input.evaluation !== "object"
    ) {
      return {
        code: "EVALUATION_FAILED",
        message:
          "A response evaluation is required.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        activityId: input.activity.id,
        recoverable: true,
      };
    }

    if (
      input.memory.learnerId !==
      input.session.learnerId
    ) {
      return {
        code: "INVALID_SESSION",
        message:
          "The teaching session belongs to a different learner.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        recoverable: false,
        details: {
          memoryLearnerId:
            input.memory.learnerId,
          sessionLearnerId:
            input.session.learnerId,
        },
      };
    }

    if (
      input.session.lessonId !==
      input.lesson.id
    ) {
      return {
        code: "INVALID_SESSION",
        message:
          "The teaching session does not belong to the supplied lesson.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        recoverable: false,
      };
    }

    const activityExists =
      input.lesson.stages.some((stage) =>
        stage.activities.some(
          (activity) =>
            activity.id === input.activity.id,
        ),
      );

    if (!activityExists) {
      return {
        code: "ACTIVITY_NOT_FOUND",
        message:
          `Activity "${input.activity.id}" was not found in lesson "${input.lesson.id}".`,
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        activityId: input.activity.id,
        recoverable: false,
      };
    }

    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                              Public helpers                                */
/* -------------------------------------------------------------------------- */

export function createEducationalMemory(
  input: CreateEducationalMemoryInput,
  options?: EducationalMemoryOptions,
): LearnerEducationalMemory {
  return new EducationalMemoryEngine(
    options,
  ).create(input);
}

export function updateEducationalMemory(
  input: UpdateEducationalMemoryInput,
  options?: EducationalMemoryOptions,
): EducationalMemoryResult {
  return new EducationalMemoryEngine(
    options,
  ).update(input);
}

export function getDueMemoryReviews(
  memory: LearnerEducationalMemory,
  at?: string,
  options?: EducationalMemoryOptions,
): readonly ReviewRecommendation[] {
  return new EducationalMemoryEngine(
    options,
  ).getDueReviews(memory, at);
}

export const TeachingMemory =
  Object.freeze({
    create: createEducationalMemory,
    update: updateEducationalMemory,
    getDueReviews: getDueMemoryReviews,
  });
