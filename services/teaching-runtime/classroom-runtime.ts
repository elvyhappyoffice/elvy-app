/**
 * Elvy Teaching Runtime
 * Classroom Runtime
 *
 * File: services/teaching-runtime/classroom-runtime.ts
 *
 * Responsibility:
 * Coordinate one live teaching turn across the Response Engine and Adaptive
 * Engine, apply the resulting pedagogical transition to an immutable teaching
 * session, and return renderer-neutral classroom output.
 *
 * Teaching is the priority. This runtime does not control 2D/3D animation,
 * access Supabase, update ticket time, call React, or generate final AI speech.
 */

import {
  AdaptiveEngine,
  type AdaptiveEngineOptions,
  type AdaptiveEngineOutput,
  type AdaptivePerformanceSnapshot,
} from "./adaptive-engine";

import {
  ResponseEngine,
  type ResponseEngineOptions,
  type RuntimeResponseInput,
  type RuntimeResponseResult,
} from "./response-engine";

import type {
  ActivityProgress,
  BoardAction,
  InputModality,
  ObjectiveProgress,
  ResponseEvaluation,
  StageProgress,
  TeachingActivity,
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
  TeachingDecision,
  TeachingSession,
  TeachingSessionState,
  TeachingStage,
  UUID,
} from "../teaching-brain/types";
/* -------------------------------------------------------------------------- */
/*                                  Contracts                                 */
/* -------------------------------------------------------------------------- */

export type ClassroomRuntimeEventType =
  | "learner_turn_received"
  | "response_evaluated"
  | "teaching_decision_created"
  | "activity_started"
  | "activity_retried"
  | "activity_completed"
  | "activity_changed"
  | "stage_completed"
  | "lesson_completed"
  | "session_paused"
  | "session_updated";

export type ClassroomRuntimeEvent = Readonly<{
  id: UUID;
  type: ClassroomRuntimeEventType;
  sessionId: UUID;
  lessonId: UUID;
  stageId?: string;
  activityId?: string;
  learnerTurnId?: UUID;
  occurredAt: string;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type ClassroomOutput = Readonly<{
  messageIntent: TeachingDecision["messageIntent"];
  speechContent?: string;
  textContent?: string;
  shouldWaitForLearner: boolean;
  expectedInputModality?: InputModality;
  boardActions: readonly BoardAction[];

  /**
   * Renderer-neutral hints only. The teaching runtime never executes animation.
   */
  presentationHints?: TeachingDecision["directorHints"];
}>;

export type ClassroomRuntimeInput = Readonly<{
  lesson: TeachingBrainLesson;
  session: TeachingSession;

  response?: string;
  selectedOptionId?: string;
  modality?: RuntimeResponseInput["modality"];

  detectedLanguage?: RuntimeResponseInput["detectedLanguage"];
  audioReference?: string;
  speechConfidence?: number;
  responseTimeMs?: number;
  expectedResponseId?: string;

  previousEvaluations?: ResponseEvaluation[];
  performance?: AdaptivePerformanceSnapshot;

  learnerTurnId?: UUID;
  decisionId?: UUID;
  createdAt?: string;

  metadata?: Record<string, unknown>;
}>;

export type ClassroomRuntimeOutput = Readonly<{
  previousSession: TeachingSession;
  session: TeachingSession;

  stage: TeachingStage;
  activity: TeachingActivity;

  response: RuntimeResponseResult;
  adaptation: AdaptiveEngineOutput;
  decision: TeachingDecision;

  classroom: ClassroomOutput;
  events: readonly ClassroomRuntimeEvent[];

  transition: Readonly<{
    activityCompleted: boolean;
    stageCompleted: boolean;
    lessonCompleted: boolean;
    activityChanged: boolean;
    nextStageId?: string;
    nextActivityId?: string;
  }>;
}>;

export type ClassroomRuntimeResult =
  TeachingBrainResult<ClassroomRuntimeOutput>;

export type ClassroomRuntimeOptions = Readonly<{
  responseEngine?: ResponseEngine;
  adaptiveEngine?: AdaptiveEngine;
  responseEngineOptions?: ResponseEngineOptions;
  adaptiveEngineOptions?: AdaptiveEngineOptions;
  now?: () => string;
  createId?: () => UUID;
}>;

/* -------------------------------------------------------------------------- */
/*                                  Utilities                                 */
/* -------------------------------------------------------------------------- */

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function createRuntimeId(): UUID {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `runtime-${Date.now()}-${Math.random()
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

function failure<T>(
  error: TeachingBrainError,
): TeachingBrainResult<T> {
  return {
    ok: false,
    error,
  };
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function resolveStage(
  lesson: TeachingBrainLesson,
  stageId: string | undefined,
): TeachingStage | undefined {
  if (!stageId) {
    return undefined;
  }

  return lesson.stages.find((stage) => stage.id === stageId);
}

function resolveActivity(
  stage: TeachingStage | undefined,
  activityId: string | undefined,
): TeachingActivity | undefined {
  if (!stage || !activityId) {
    return undefined;
  }

  return stage.activities.find(
    (activity) => activity.id === activityId,
  );
}

function orderedStages(
  lesson: TeachingBrainLesson,
): readonly TeachingStage[] {
  return [...lesson.stages].sort(
    (left, right) => left.order - right.order,
  );
}

function orderedActivities(
  stage: TeachingStage,
): readonly TeachingActivity[] {
  return [...stage.activities].sort(
    (left, right) => left.order - right.order,
  );
}

function nextActivity(
  stage: TeachingStage,
  activityId: string,
): TeachingActivity | undefined {
  const activities = orderedActivities(stage);
  const index = activities.findIndex(
    (activity) => activity.id === activityId,
  );

  return index >= 0
    ? activities[index + 1]
    : undefined;
}

function nextStage(
  lesson: TeachingBrainLesson,
  stageId: string,
): TeachingStage | undefined {
  const stages = orderedStages(lesson);
  const index = stages.findIndex(
    (stage) => stage.id === stageId,
  );

  return index >= 0
    ? stages[index + 1]
    : undefined;
}

function firstRequiredOrFirstActivity(
  stage: TeachingStage,
): TeachingActivity | undefined {
  const activities = orderedActivities(stage);

  return (
    activities.find((activity) => activity.required) ??
    activities[0]
  );
}

function stateForStage(
  stage: TeachingStage,
): TeachingSessionState {
  switch (stage.type) {
    case "welcome":
      return "welcome";
    case "readiness_check":
      return "readiness_check";
    case "previous_lesson_review":
      return "previous_lesson_review";
    case "warm_up":
      return "warm_up";
    case "lesson_introduction":
      return "lesson_introduction";
    case "presentation":
      return "presentation";
    case "comprehension_check":
      return "comprehension_check";
    case "guided_practice":
      return "guided_practice";
    case "communicative_practice":
    case "pronunciation_practice":
    case "listening_practice":
    case "reading_practice":
    case "writing_practice":
      return "communicative_practice";
    case "feedback":
      return "feedback";
    case "assessment":
      return "assessment";
    case "summary":
    case "homework":
      return "summary";
    case "goodbye":
      return "session_end";
    case "custom":
    default:
      return "next_step";
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

function average(
  values: readonly number[],
): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return (
    values.reduce((total, value) => total + value, 0) /
    values.length
  );
}

/* -------------------------------------------------------------------------- */
/*                              Progress updates                              */
/* -------------------------------------------------------------------------- */

function updateActivityProgress(
  session: TeachingSession,
  stageId: string,
  activityId: string,
  evaluation: ResponseEvaluation,
  supportLevel: number,
  completed: boolean,
  changed: boolean,
  now: string,
): readonly ActivityProgress[] {
  const current = session.activityProgress.find(
    (progress) => progress.activityId === activityId,
  );

  const updated: ActivityProgress = {
    activityId,
    stageId,
    status:
      completed
        ? "completed"
        : changed
          ? "failed"
          : "active",
    attempts: (current?.attempts ?? 0) + 1,
    successfulAttempts:
      (current?.successfulAttempts ?? 0) +
      (isSuccessful(evaluation) ? 1 : 0),
    supportLevelUsed: Math.max(
      current?.supportLevelUsed ?? 0,
      supportLevel,
    ),
    score: clampScore(evaluation.score),
    startedAt: current?.startedAt ?? now,
    completedAt: completed ? now : undefined,
  };

  return Object.freeze([
    ...session.activityProgress.filter(
      (progress) => progress.activityId !== activityId,
    ),
    Object.freeze(updated),
  ]);
}

function updateStageProgress(
  session: TeachingSession,
  stage: TeachingStage,
  activityId: string,
  activityCompleted: boolean,
  stageCompleted: boolean,
  evaluation: ResponseEvaluation,
  now: string,
): readonly StageProgress[] {
  const current = session.stageProgress.find(
    (progress) => progress.stageId === stage.id,
  );

  const completedActivityIds = new Set(
    current?.completedActivityIds ?? [],
  );

  if (activityCompleted) {
    completedActivityIds.add(activityId);
  }

  const stageScores = [
    ...session.activityProgress
      .filter((progress) => progress.stageId === stage.id)
      .map((progress) => progress.score)
      .filter((score): score is number => score !== undefined),
    evaluation.score,
  ];

  const updated: StageProgress = {
    stageId: stage.id,
    status:
      stageCompleted
        ? "completed"
        : "active",
    completedActivityIds: [...completedActivityIds],
    skippedActivityIds: [
      ...(current?.skippedActivityIds ?? []),
    ],
    score: average(stageScores),
    startedAt: current?.startedAt ?? now,
    completedAt: stageCompleted ? now : undefined,
  };

  return Object.freeze([
    ...session.stageProgress.filter(
      (progress) => progress.stageId !== stage.id,
    ),
    Object.freeze(updated),
  ]);
}

function updateObjectiveProgress(
  session: TeachingSession,
  activity: TeachingActivity,
  evaluation: ResponseEvaluation,
  now: string,
): readonly ObjectiveProgress[] {
  const targetIds = new Set(activity.targetObjectiveIds);

  return Object.freeze(
    session.objectiveProgress.map((progress) => {
      if (!targetIds.has(progress.objectiveId)) {
        return progress;
      }

      const attempts = progress.attempts + 1;
      const successfulAttempts =
        progress.successfulAttempts +
        (isSuccessful(evaluation) ? 1 : 0);

      const previousWeight = Math.max(0, attempts - 1);
      const masteryScore = clampScore(
        (
          progress.masteryScore * previousWeight +
          evaluation.score
        ) / attempts,
      );

      return Object.freeze({
        ...progress,
        attempts,
        successfulAttempts,
        masteryScore,
        completed: masteryScore >= 80,
        lastEvaluatedAt: now,
      });
    }),
  );
}

function calculateCompletionPercentage(
  lesson: TeachingBrainLesson,
  activityProgress: readonly ActivityProgress[],
): number {
  const allActivities = lesson.stages.flatMap(
    (stage) => stage.activities,
  );

  if (allActivities.length === 0) {
    return 0;
  }

  const completed = new Set(
    activityProgress
      .filter((progress) => progress.status === "completed")
      .map((progress) => progress.activityId),
  );

  return clampScore(
    (completed.size / allActivities.length) * 100,
  );
}

function requiredObjectivesCompleted(
  lesson: TeachingBrainLesson,
  progress: readonly ObjectiveProgress[],
): boolean {
  const requiredIds =
    lesson.completionCriteria.requiredObjectiveIds;

  if (requiredIds.length === 0) {
    return true;
  }

  return requiredIds.every((objectiveId) => {
    const objective = progress.find(
      (item) => item.objectiveId === objectiveId,
    );

    return (
      objective?.masteryScore ??
      0
    ) >= lesson.completionCriteria.minimumObjectiveMastery;
  });
}

function requiredActivitiesCompleted(
  lesson: TeachingBrainLesson,
  progress: readonly ActivityProgress[],
): boolean {
  const explicitlyRequired =
    lesson.completionCriteria.requiredActivityIds;

  const requiredIds =
    explicitlyRequired && explicitlyRequired.length > 0
      ? explicitlyRequired
      : lesson.stages.flatMap((stage) =>
          stage.activities
            .filter((activity) => activity.required)
            .map((activity) => activity.id),
        );

  const completed = new Set(
    progress
      .filter((item) => item.status === "completed")
      .map((item) => item.activityId),
  );

  return requiredIds.every((id) => completed.has(id));
}

/* -------------------------------------------------------------------------- */
/*                              Runtime events                                */
/* -------------------------------------------------------------------------- */

function createEvent(
  createId: () => UUID,
  type: ClassroomRuntimeEventType,
  lesson: TeachingBrainLesson,
  session: TeachingSession,
  now: string,
  metadata?: Record<string, unknown>,
): ClassroomRuntimeEvent {
  return Object.freeze({
    id: createId(),
    type,
    sessionId: session.id,
    lessonId: lesson.id,
    stageId: session.currentStageId,
    activityId: session.currentActivityId,
    occurredAt: now,
    metadata:
      metadata
        ? Object.freeze({ ...metadata })
        : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/*                            Classroom Runtime                               */
/* -------------------------------------------------------------------------- */

export class ClassroomRuntime {
  private readonly responseEngine: ResponseEngine;
  private readonly adaptiveEngine: AdaptiveEngine;
  private readonly now: () => string;
  private readonly createId: () => UUID;

  constructor(options: ClassroomRuntimeOptions = {}) {
    this.now =
      options.now ?? (() => new Date().toISOString());

    this.createId =
      options.createId ?? createRuntimeId;

    this.responseEngine =
      options.responseEngine ??
      new ResponseEngine({
        ...options.responseEngineOptions,
        now:
          options.responseEngineOptions?.now ??
          this.now,
      });

    this.adaptiveEngine =
      options.adaptiveEngine ??
      new AdaptiveEngine({
        ...options.adaptiveEngineOptions,
        now:
          options.adaptiveEngineOptions?.now ??
          this.now,
        createId:
          options.adaptiveEngineOptions?.createId ??
          this.createId,
      });
  }

  async processTurn(
    input: ClassroomRuntimeInput,
  ): Promise<ClassroomRuntimeResult> {
    const inputError = this.validateInput(input);

    if (inputError) {
      return failure(inputError);
    }

    const stage = resolveStage(
      input.lesson,
      input.session.currentStageId,
    );

    const activity = resolveActivity(
      stage,
      input.session.currentActivityId,
    );

    if (!stage) {
      return failure({
        code: "STAGE_NOT_FOUND",
        message:
          `Current stage "${String(
            input.session.currentStageId,
          )}" was not found in lesson "${input.lesson.id}".`,
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        stageId: input.session.currentStageId,
        activityId: input.session.currentActivityId,
        recoverable: false,
      });
    }

    if (!activity) {
      return failure({
        code: "ACTIVITY_NOT_FOUND",
        message:
          `Current activity "${String(
            input.session.currentActivityId,
          )}" was not found in stage "${stage.id}".`,
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        stageId: stage.id,
        activityId: input.session.currentActivityId,
        recoverable: false,
      });
    }

    const now = validIsoOrNow(
      input.createdAt,
      this.now,
    );

    const responseResult =
      await this.responseEngine.process({
        sessionId: input.session.id,
        lesson: input.lesson,
        stageId: stage.id,
        activityId: activity.id,
        response: input.response,
        selectedOptionId: input.selectedOptionId,
        modality: input.modality,
        detectedLanguage: input.detectedLanguage,
        audioReference: input.audioReference,
        speechConfidence: input.speechConfidence,
        responseTimeMs: input.responseTimeMs,
        expectedResponseId: input.expectedResponseId,
        previousEvaluations: input.previousEvaluations,
        turnId: input.learnerTurnId,
        createdAt: now,
        metadata: input.metadata,
      });

    if (!responseResult.ok) {
      return responseResult;
    }

    const adaptationResult =
      this.adaptiveEngine.adapt({
        lesson: input.lesson,
        session: input.session,
        stageId: stage.id,
        activityId: activity.id,
        evaluation: responseResult.data.evaluation,
        performance: input.performance,
        decisionId: input.decisionId,
        createdAt: now,
      });

    if (!adaptationResult.ok) {
      return adaptationResult;
    }

    const transition = this.resolveTransition(
      input.lesson,
      stage,
      activity,
      adaptationResult.data,
    );

    const session = this.applyTransition(
      input.lesson,
      input.session,
      stage,
      activity,
      responseResult.data.evaluation,
      adaptationResult.data,
      transition,
      now,
    );

    const classroom = this.buildClassroomOutput(
      adaptationResult.data.decision,
    );

    const events = this.buildEvents(
      input.lesson,
      input.session,
      session,
      responseResult.data,
      adaptationResult.data,
      transition,
      now,
    );

    return {
      ok: true,
      data: Object.freeze({
        previousSession: input.session,
        session,
        stage,
        activity,
        response: responseResult.data,
        adaptation: adaptationResult.data,
        decision: adaptationResult.data.decision,
        classroom,
        events,
        transition,
      }),
    };
  }

  private resolveTransition(
    lesson: TeachingBrainLesson,
    stage: TeachingStage,
    activity: TeachingActivity,
    adaptation: AdaptiveEngineOutput,
  ): ClassroomRuntimeOutput["transition"] {
    const activityCompleted =
      adaptation.adaptation.shouldCompleteActivity ||
      adaptation.decision.type === "complete_activity";

    const activityChanged =
      adaptation.adaptation.shouldChangeActivity ||
      adaptation.decision.type === "change_activity";

    const followingActivity = activityCompleted
      ? nextActivity(stage, activity.id)
      : undefined;

    const stageCompleted =
      activityCompleted &&
      !followingActivity;

    const followingStage = stageCompleted
      ? nextStage(lesson, stage.id)
      : undefined;

    const lessonCompleted =
      stageCompleted &&
      !followingStage;

    const alternativeActivityId =
      activityChanged
        ? adaptation.decision.targetActivityId
        : undefined;

    const nextActivityId =
      alternativeActivityId ??
      followingActivity?.id ??
      (
        followingStage
          ? firstRequiredOrFirstActivity(followingStage)?.id
          : undefined
      ) ??
      (
        activityCompleted
          ? undefined
          : activity.id
      );

    return Object.freeze({
      activityCompleted,
      stageCompleted,
      lessonCompleted,
      activityChanged,
      nextStageId:
        followingStage?.id ??
        (
          lessonCompleted
            ? undefined
            : stage.id
        ),
      nextActivityId,
    });
  }

  private applyTransition(
    lesson: TeachingBrainLesson,
    session: TeachingSession,
    stage: TeachingStage,
    activity: TeachingActivity,
    evaluation: ResponseEvaluation,
    adaptation: AdaptiveEngineOutput,
    transition: ClassroomRuntimeOutput["transition"],
    now: string,
  ): TeachingSession {
    const activityProgress = updateActivityProgress(
      session,
      stage.id,
      activity.id,
      evaluation,
      adaptation.adaptation.supportLevel,
      transition.activityCompleted,
      transition.activityChanged,
      now,
    );

    const stageProgress = updateStageProgress(
      session,
      stage,
      activity.id,
      transition.activityCompleted,
      transition.stageCompleted,
      evaluation,
      now,
    );

    const objectiveProgress = updateObjectiveProgress(
      session,
      activity,
      evaluation,
      now,
    );

    const completionPercentage =
      calculateCompletionPercentage(
        lesson,
        activityProgress,
      );

    const rulesSatisfied =
      requiredObjectivesCompleted(
        lesson,
        objectiveProgress,
      ) &&
      requiredActivitiesCompleted(
        lesson,
        activityProgress,
      );

    const lessonCompleted =
      transition.lessonCompleted &&
      rulesSatisfied;

    const targetStage = resolveStage(
      lesson,
      transition.nextStageId,
    );

    const scores = activityProgress
      .map((progress) => progress.score)
      .filter((score): score is number => score !== undefined);

    return Object.freeze({
      ...session,
      status:
        lessonCompleted
          ? "completed"
          : session.status,
      currentState:
        lessonCompleted
          ? "session_end"
          : targetStage
            ? stateForStage(targetStage)
            : session.currentState,
      currentStageId:
        lessonCompleted
          ? undefined
          : transition.nextStageId,
      currentActivityId:
        lessonCompleted
          ? undefined
          : transition.nextActivityId,
      currentAttempt:
        transition.activityCompleted ||
        transition.activityChanged
          ? 0
          : session.currentAttempt + 1,
      currentSupportLevel:
        transition.activityCompleted ||
        transition.activityChanged
          ? 0
          : adaptation.adaptation.supportLevel,
objectiveProgress: [...objectiveProgress],
stageProgress: [...stageProgress],
activityProgress: [...activityProgress],
      totalScore: average(scores),
      completionPercentage:
        lessonCompleted
          ? 100
          : completionPercentage,
      lastActivityAt: now,
      completedAt:
        lessonCompleted
          ? now
          : session.completedAt,
      metadata: {
        ...(session.metadata ?? {}),
        lastLearnerTurnId:
          adaptation.decision.learnerTurnId,
        lastTeachingDecisionId:
          adaptation.decision.id,
        lastDecisionType:
          adaptation.decision.type,
        lastDecisionReason:
          adaptation.decision.reason,
      },
    });
  }

  private buildClassroomOutput(
    decision: TeachingDecision,
  ): ClassroomOutput {
    return Object.freeze({
      messageIntent: decision.messageIntent,
      speechContent: decision.speechContent,
      textContent: decision.textContent,
      shouldWaitForLearner:
        decision.shouldWaitForLearner,
      expectedInputModality:
        decision.expectedInputModality,
      boardActions: Object.freeze([
        ...(decision.directorHints?.boardActions ?? []),
      ]),
      presentationHints:
        decision.directorHints,
    });
  }

  private buildEvents(
    lesson: TeachingBrainLesson,
    previousSession: TeachingSession,
    session: TeachingSession,
    response: RuntimeResponseResult,
    adaptation: AdaptiveEngineOutput,
    transition: ClassroomRuntimeOutput["transition"],
    now: string,
  ): readonly ClassroomRuntimeEvent[] {
    const events: ClassroomRuntimeEvent[] = [
      Object.freeze({
        ...createEvent(
          this.createId,
          "learner_turn_received",
          lesson,
          previousSession,
          now,
        ),
        learnerTurnId: response.learnerTurn.id,
      }),
      Object.freeze({
        ...createEvent(
          this.createId,
          "response_evaluated",
          lesson,
          previousSession,
          now,
          {
            status: response.evaluation.status,
            score: response.evaluation.score,
            confidence: response.evaluation.confidence,
          },
        ),
        learnerTurnId: response.learnerTurn.id,
      }),
      Object.freeze({
        ...createEvent(
          this.createId,
          "teaching_decision_created",
          lesson,
          previousSession,
          now,
          {
            decisionId: adaptation.decision.id,
            decisionType: adaptation.decision.type,
            reason: adaptation.decision.reason,
          },
        ),
        learnerTurnId: response.learnerTurn.id,
      }),
    ];

    if (transition.activityCompleted) {
      events.push(
        createEvent(
          this.createId,
          "activity_completed",
          lesson,
          previousSession,
          now,
        ),
      );
    } else if (transition.activityChanged) {
      events.push(
        createEvent(
          this.createId,
          "activity_changed",
          lesson,
          previousSession,
          now,
          {
            nextActivityId: transition.nextActivityId,
          },
        ),
      );
    } else {
      events.push(
        createEvent(
          this.createId,
          "activity_retried",
          lesson,
          previousSession,
          now,
          {
            supportLevel:
              adaptation.adaptation.supportLevel,
          },
        ),
      );
    }

    if (transition.stageCompleted) {
      events.push(
        createEvent(
          this.createId,
          "stage_completed",
          lesson,
          previousSession,
          now,
        ),
      );
    }

    if (session.status === "completed") {
      events.push(
        createEvent(
          this.createId,
          "lesson_completed",
          lesson,
          session,
          now,
        ),
      );
    }

    events.push(
      createEvent(
        this.createId,
        "session_updated",
        lesson,
        session,
        now,
        {
          completionPercentage:
            session.completionPercentage,
          currentState: session.currentState,
        },
      ),
    );

    return Object.freeze(events);
  }

  private validateInput(
    input: ClassroomRuntimeInput,
  ): TeachingBrainError | null {
    if (!input || typeof input !== "object") {
      return {
        code: "UNSUPPORTED_INPUT",
        message:
          "A classroom-runtime input object is required.",
        recoverable: true,
      };
    }

    if (!input.lesson || typeof input.lesson !== "object") {
      return {
        code: "INVALID_LESSON",
        message:
          "A valid Teaching Brain lesson is required.",
        sessionId: input.session?.id,
        recoverable: true,
      };
    }

    if (!input.session || typeof input.session !== "object") {
      return {
        code: "INVALID_SESSION",
        message:
          "A valid teaching session is required.",
        lessonId: input.lesson.id,
        recoverable: true,
      };
    }

    if (input.lesson.id !== input.session.lessonId) {
      return {
        code: "INVALID_SESSION",
        message:
          "The teaching session does not belong to the supplied lesson.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        recoverable: false,
        details: {
          sessionLessonId: input.session.lessonId,
        },
      };
    }

    if (input.lesson.status !== "active") {
      return {
        code: "LESSON_NOT_ACTIVE",
        message:
          "The lesson must be active before the classroom runtime can process a turn.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        recoverable: true,
      };
    }

    if (input.session.status !== "active") {
      return {
        code: "INVALID_SESSION",
        message:
          `The classroom runtime requires an active session; received "${input.session.status}".`,
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        recoverable:
          input.session.status === "paused",
      };
    }

    if (!clean(input.session.currentStageId)) {
      return {
        code: "STAGE_NOT_FOUND",
        message:
          "session.currentStageId is required.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        recoverable: false,
      };
    }

    if (!clean(input.session.currentActivityId)) {
      return {
        code: "ACTIVITY_NOT_FOUND",
        message:
          "session.currentActivityId is required.",
        sessionId: input.session.id,
        lessonId: input.lesson.id,
        stageId: input.session.currentStageId,
        recoverable: false,
      };
    }

    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                              Factory helpers                               */
/* -------------------------------------------------------------------------- */

export function createClassroomRuntime(
  options?: ClassroomRuntimeOptions,
): ClassroomRuntime {
  return new ClassroomRuntime(options);
}

export async function processClassroomTurn(
  input: ClassroomRuntimeInput,
  options?: ClassroomRuntimeOptions,
): Promise<ClassroomRuntimeResult> {
  return createClassroomRuntime(options).processTurn(input);
}

export const TeachingClassroomRuntime =
  Object.freeze({
    create: createClassroomRuntime,
    processTurn: processClassroomTurn,
  });
