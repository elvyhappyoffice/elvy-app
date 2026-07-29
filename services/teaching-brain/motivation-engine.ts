/**
 * ELVY Teaching Engine
 * TE-910 — Motivation Engine
 *
 * Purpose:
 * - protect learner confidence
 * - recognize meaningful effort and progress
 * - celebrate mastery without exaggeration
 * - introduce suitable mini challenges
 * - vary motivational actions to avoid repetition
 * - keep motivation educational, lightweight and deterministic
 *
 * Design rules:
 * - no AI calls
 * - no database access
 * - no timers or background jobs
 * - stateless input -> decision -> output
 * - immutable outputs
 * - bounded history
 * - horizontally scalable
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
} from "./learning-state-engine";

export type MotivationLevel =
  | "very_low"
  | "low"
  | "stable"
  | "high"
  | "very_high";

export type ConfidenceLevel =
  | "fragile"
  | "developing"
  | "stable"
  | "strong";

export type EngagementLevel =
  | "disengaged"
  | "low"
  | "stable"
  | "engaged"
  | "highly_engaged";

export type MotivationActionType =
  | "none"
  | "gentle_encouragement"
  | "effort_recognition"
  | "progress_recognition"
  | "mastery_celebration"
  | "confidence_reassurance"
  | "mini_challenge"
  | "activity_refresh"
  | "short_break_suggestion"
  | "review_success"
  | "streak_recognition";

export type MotivationIntensity =
  | "subtle"
  | "light"
  | "moderate"
  | "strong";

export type MotivationTone =
  | "calm"
  | "warm"
  | "cheerful"
  | "playful"
  | "proud"
  | "reassuring";

export type ChallengeDifficulty =
  | "gentle"
  | "balanced"
  | "stretch";

export type MotivationReasonCode =
  | "no_action_needed"
  | "repeated_difficulty"
  | "confidence_drop"
  | "low_engagement"
  | "fatigue_risk"
  | "meaningful_effort"
  | "recent_progress"
  | "objective_mastered"
  | "multiple_objectives_mastered"
  | "review_completed"
  | "stable_success"
  | "challenge_ready"
  | "activity_repetition"
  | "positive_streak";

export interface MotivationObservation {
  readonly observationId: ClassroomIdentifier;
  readonly learnerId: ClassroomIdentifier;
  readonly sessionId: ClassroomIdentifier;
  readonly lessonId: ClassroomIdentifier;
  readonly recordedAt: ISODateTime;

  readonly responseCorrect?: boolean;
  readonly responseScore?: Percentage;
  readonly responseDurationMs?: number;
  readonly hintsUsed?: number;
  readonly attemptNumber?: number;

  readonly confidence: ConfidenceLevel;
  readonly engagement: EngagementLevel;
  readonly motivation: MotivationLevel;

  readonly effortDetected?: boolean;
  readonly frustrationDetected?: boolean;
  readonly fatigueDetected?: boolean;
  readonly reviewCompleted?: boolean;
  readonly objectiveMastered?: boolean;
  readonly masteredObjectiveId?: ClassroomIdentifier;
  readonly domain?: LearningDomain;
  readonly activityId?: ClassroomIdentifier;
  readonly activityType?: string;
}

export interface MotivationHistoryItem {
  readonly decisionId: ClassroomIdentifier;
  readonly actionType: MotivationActionType;
  readonly reasonCode: MotivationReasonCode;
  readonly createdAt: ISODateTime;
}

export interface LearnerMotivationSnapshot {
  readonly learnerId: ClassroomIdentifier;
  readonly sessionId: ClassroomIdentifier;
  readonly lessonId: ClassroomIdentifier;
  readonly confidence: ConfidenceLevel;
  readonly engagement: EngagementLevel;
  readonly motivation: MotivationLevel;
  readonly consecutiveSuccesses: number;
  readonly consecutiveDifficulties: number;
  readonly recentActivityTypes: readonly string[];
  readonly recentActions: readonly MotivationHistoryItem[];
  readonly updatedAt: ISODateTime;
  readonly revision: number;
}

export interface MiniChallenge {
  readonly challengeId: ClassroomIdentifier;
  readonly objectiveId?: ClassroomIdentifier;
  readonly domain?: LearningDomain;
  readonly difficulty: ChallengeDifficulty;
  readonly instructionKey:
    | "use_without_hint"
    | "respond_faster"
    | "give_extra_example"
    | "use_in_new_context"
    | "explain_in_own_words"
    | "complete_short_dialogue";
  readonly optional: true;
}

export interface MotivationMessagePlan {
  readonly messageKey:
    | "keep_trying"
    | "effort_matters"
    | "you_are_improving"
    | "objective_mastered"
    | "excellent_progress"
    | "take_your_time"
    | "small_step_forward"
    | "review_success"
    | "challenge_invitation"
    | "refresh_activity"
    | "short_break"
    | "success_streak";
  readonly tone: MotivationTone;
  readonly intensity: MotivationIntensity;
  readonly personalizationTokens: Readonly<{
    learnerName?: string;
    objectiveTitle?: string;
    masteredCount?: number;
    lessonProgress?: Percentage;
    streakCount?: number;
  }>;
}

export interface MotivationDecision {
  readonly decisionId: ClassroomIdentifier;
  readonly actionType: MotivationActionType;
  readonly reasonCode: MotivationReasonCode;
  readonly shouldInterruptTeaching: boolean;
  readonly message?: MotivationMessagePlan;
  readonly miniChallenge?: MiniChallenge;
  readonly recommendedActivityChange?: boolean;
  readonly recommendShortBreak?: boolean;
  readonly educationalPurpose: string;
  readonly createdAt: ISODateTime;
}

export interface MotivationDiagnostics {
  readonly engineVersion: string;
  readonly evaluatedRules: readonly string[];
  readonly selectedRule: string;
  readonly suppressedActions: readonly MotivationActionType[];
  readonly warnings: readonly string[];
}

export interface MotivationResult {
  readonly previous: LearnerMotivationSnapshot;
  readonly current: LearnerMotivationSnapshot;
  readonly decision: MotivationDecision;
  readonly diagnostics: MotivationDiagnostics;
}

export interface MotivationEngineInput {
  readonly learnerName?: string;
  readonly learningState: LearnerEducationalSnapshot;
  readonly motivationState: LearnerMotivationSnapshot;
  readonly observation: MotivationObservation;
}

export interface CreateMotivationStateInput {
  readonly learnerId: ClassroomIdentifier;
  readonly sessionId: ClassroomIdentifier;
  readonly lessonId: ClassroomIdentifier;
  readonly confidence?: ConfidenceLevel;
  readonly engagement?: EngagementLevel;
  readonly motivation?: MotivationLevel;
  readonly createdAt?: ISODateTime;
}

export interface MotivationEngineOptions {
  readonly engineVersion?: string;
  readonly now?: () => ISODateTime;
  readonly maximumRecentActions?: number;
  readonly maximumRecentActivityTypes?: number;
  readonly repeatedDifficultyThreshold?: number;
  readonly successStreakThreshold?: number;
  readonly minimumChallengeMastery?: Percentage;
  readonly repeatedActionCooldown?: number;
}

interface MotivationRuleContext {
  readonly input: MotivationEngineInput;
  readonly nextState: LearnerMotivationSnapshot;
  readonly recentlyUsedActions: readonly MotivationActionType[];
  readonly repeatedActivity: boolean;
  readonly newlyMasteredObjective?: LearningObjectiveState;
  readonly masteredObjectiveCount: number;
}

interface MotivationRule {
  readonly id: string;
  readonly priority: number;
  readonly matches: (context: MotivationRuleContext) => boolean;
  readonly decide: (
    context: MotivationRuleContext,
    now: ISODateTime,
  ) => MotivationDecision;
}

const DEFAULT_OPTIONS: Required<MotivationEngineOptions> = {
  engineVersion: "1.0.0",
  now: () => new Date().toISOString(),
  maximumRecentActions: 20,
  maximumRecentActivityTypes: 8,
  repeatedDifficultyThreshold: 2,
  successStreakThreshold: 3,
  minimumChallengeMastery: 80,
  repeatedActionCooldown: 3,
};

export class MotivationEngine {
  private readonly options: Required<MotivationEngineOptions>;
  private readonly rules: readonly MotivationRule[];

  public constructor(options: MotivationEngineOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    validateOptions(this.options);
    this.rules = Object.freeze(this.buildRules());
  }

  public createInitialState(
    input: CreateMotivationStateInput,
  ): LearnerMotivationSnapshot {
    requireText(input.learnerId, "learnerId");
    requireText(input.sessionId, "sessionId");
    requireText(input.lessonId, "lessonId");

    const createdAt = input.createdAt ?? this.options.now();

    return freezeMotivationState({
      learnerId: input.learnerId,
      sessionId: input.sessionId,
      lessonId: input.lessonId,
      confidence: input.confidence ?? "stable",
      engagement: input.engagement ?? "stable",
      motivation: input.motivation ?? "stable",
      consecutiveSuccesses: 0,
      consecutiveDifficulties: 0,
      recentActivityTypes: [],
      recentActions: [],
      updatedAt: createdAt,
      revision: 0,
    });
  }

  public evaluate(input: MotivationEngineInput): MotivationResult {
    this.validateInput(input);

    const now = this.options.now();
    const nextState = this.deriveNextState(
      input.motivationState,
      input.observation,
      now,
    );

    const masteredObjectiveCount =
      input.learningState.objectives.filter(
        (objective) => objective.status === "mastered",
      ).length;

    const newlyMasteredObjective =
      input.observation.masteredObjectiveId
        ? input.learningState.objectives.find(
            (objective) =>
              objective.objectiveId ===
              input.observation.masteredObjectiveId,
          )
        : undefined;

    const recentlyUsedActions =
      input.motivationState.recentActions
        .slice(-this.options.repeatedActionCooldown)
        .map((item) => item.actionType);

    const repeatedActivity = detectRepeatedActivity(
      nextState.recentActivityTypes,
    );

    const context: MotivationRuleContext = Object.freeze({
      input,
      nextState,
      recentlyUsedActions: Object.freeze(recentlyUsedActions),
      repeatedActivity,
      newlyMasteredObjective,
      masteredObjectiveCount,
    });

    const evaluatedRules: string[] = [];
    const suppressedActions: MotivationActionType[] = [];

    let selectedRule: MotivationRule | undefined;
    let decision: MotivationDecision | undefined;

    for (const rule of this.rules) {
      evaluatedRules.push(rule.id);

      if (!rule.matches(context)) {
        continue;
      }

      const candidate = rule.decide(context, now);

      if (
        candidate.actionType !== "none" &&
        recentlyUsedActions.includes(candidate.actionType) &&
        canBeSuppressed(candidate.actionType)
      ) {
        suppressedActions.push(candidate.actionType);
        continue;
      }

      selectedRule = rule;
      decision = candidate;
      break;
    }

    const finalDecision =
      decision ??
      createNoActionDecision(
        input.motivationState.sessionId,
        nextState.revision,
        now,
      );

    const current = this.applyDecisionToState(
      nextState,
      finalDecision,
      now,
    );

    return Object.freeze({
      previous: input.motivationState,
      current,
      decision: finalDecision,
      diagnostics: Object.freeze({
        engineVersion: this.options.engineVersion,
        evaluatedRules: Object.freeze(evaluatedRules),
        selectedRule: selectedRule?.id ?? "no_action",
        suppressedActions: Object.freeze(suppressedActions),
        warnings: Object.freeze([]),
      }),
    });
  }

  private buildRules(): MotivationRule[] {
    const rules: MotivationRule[] = [
      {
        id: "fatigue-protection",
        priority: 100,
        matches: (context: MotivationRuleContext): boolean =>
          context.input.observation.fatigueDetected === true,
        decide: (
          context: MotivationRuleContext,
          now: ISODateTime,
        ): MotivationDecision => {
          const { input } = context;

          return Object.freeze({
            decisionId: createDecisionId(
              input.motivationState.sessionId,
              input.motivationState.revision + 1,
              "short_break_suggestion",
            ),
            actionType: "short_break_suggestion",
            reasonCode: "fatigue_risk",
            shouldInterruptTeaching: true,
            message: createMessage(
              "short_break",
              "reassuring",
              "light",
              {
                learnerName: input.learnerName,
                lessonProgress:
                  input.learningState.lessonProgress,
              },
            ),
            recommendShortBreak: true,
            educationalPurpose:
              "Protect attention and prevent avoidable cognitive overload.",
            createdAt: now,
          });
        },
      },
      {
        id: "confidence-protection",
        priority: 95,
        matches: (context: MotivationRuleContext): boolean =>
          context.input.observation.frustrationDetected === true ||
          context.nextState.confidence === "fragile",
        decide: (
          context: MotivationRuleContext,
          now: ISODateTime,
        ): MotivationDecision => {
          const { input } = context;

          return Object.freeze({
            decisionId: createDecisionId(
              input.motivationState.sessionId,
              input.motivationState.revision + 1,
              "confidence_reassurance",
            ),
            actionType: "confidence_reassurance",
            reasonCode: "confidence_drop",
            shouldInterruptTeaching: true,
            message: createMessage(
              "take_your_time",
              "reassuring",
              "moderate",
              {
                learnerName: input.learnerName,
                lessonProgress:
                  input.learningState.lessonProgress,
              },
            ),
            educationalPurpose:
              "Protect learner confidence while keeping the original objective unchanged.",
            createdAt: now,
          });
        },
      },
      {
        id: "repeated-difficulty",
        priority: 90,
        matches: (context: MotivationRuleContext): boolean =>
          context.nextState.consecutiveDifficulties >=
          this.options.repeatedDifficultyThreshold,
        decide: (
          context: MotivationRuleContext,
          now: ISODateTime,
        ): MotivationDecision => {
          const { input } = context;

          return Object.freeze({
            decisionId: createDecisionId(
              input.motivationState.sessionId,
              input.motivationState.revision + 1,
              "gentle_encouragement",
            ),
            actionType: "gentle_encouragement",
            reasonCode: "repeated_difficulty",
            shouldInterruptTeaching: false,
            message: createMessage(
              "keep_trying",
              "warm",
              "light",
              {
                learnerName: input.learnerName,
                lessonProgress:
                  input.learningState.lessonProgress,
              },
            ),
            educationalPurpose:
              "Sustain effort after repeated difficulty without lowering expectations.",
            createdAt: now,
          });
        },
      },
      {
        id: "mastery-celebration",
        priority: 85,
        matches: (context: MotivationRuleContext): boolean =>
          context.input.observation.objectiveMastered === true,
        decide: (
          context: MotivationRuleContext,
          now: ISODateTime,
        ): MotivationDecision => {
          const {
            input,
            newlyMasteredObjective,
            masteredObjectiveCount,
          } = context;

          return Object.freeze({
            decisionId: createDecisionId(
              input.motivationState.sessionId,
              input.motivationState.revision + 1,
              "mastery_celebration",
            ),
            actionType: "mastery_celebration",
            reasonCode:
              masteredObjectiveCount > 1
                ? "multiple_objectives_mastered"
                : "objective_mastered",
            shouldInterruptTeaching: false,
            message: createMessage(
              masteredObjectiveCount > 1
                ? "excellent_progress"
                : "objective_mastered",
              "proud",
              masteredObjectiveCount > 1
                ? "strong"
                : "moderate",
              {
                learnerName: input.learnerName,
                objectiveTitle:
                  newlyMasteredObjective?.title,
                masteredCount: masteredObjectiveCount,
                lessonProgress:
                  input.learningState.lessonProgress,
              },
            ),
            educationalPurpose:
              "Reinforce meaningful mastery and make progress visible to the learner.",
            createdAt: now,
          });
        },
      },
      {
        id: "review-success",
        priority: 80,
        matches: (context: MotivationRuleContext): boolean =>
          context.input.observation.reviewCompleted === true,
        decide: (
          context: MotivationRuleContext,
          now: ISODateTime,
        ): MotivationDecision => {
          const { input } = context;

          return Object.freeze({
            decisionId: createDecisionId(
              input.motivationState.sessionId,
              input.motivationState.revision + 1,
              "review_success",
            ),
            actionType: "review_success",
            reasonCode: "review_completed",
            shouldInterruptTeaching: false,
            message: createMessage(
              "review_success",
              "proud",
              "moderate",
              {
                learnerName: input.learnerName,
                lessonProgress:
                  input.learningState.lessonProgress,
              },
            ),
            educationalPurpose:
              "Show the learner that successful review is valuable progress.",
            createdAt: now,
          });
        },
      },
      {
        id: "activity-refresh",
        priority: 75,
        matches: (context: MotivationRuleContext): boolean =>
          context.repeatedActivity &&
          (context.nextState.engagement === "low" ||
            context.nextState.engagement === "disengaged"),
        decide: (
          context: MotivationRuleContext,
          now: ISODateTime,
        ): MotivationDecision => {
          const { input } = context;

          return Object.freeze({
            decisionId: createDecisionId(
              input.motivationState.sessionId,
              input.motivationState.revision + 1,
              "activity_refresh",
            ),
            actionType: "activity_refresh",
            reasonCode: "activity_repetition",
            shouldInterruptTeaching: false,
            message: createMessage(
              "refresh_activity",
              "playful",
              "light",
              {
                learnerName: input.learnerName,
              },
            ),
            recommendedActivityChange: true,
            educationalPurpose:
              "Restore attention by changing activity format while preserving the objective.",
            createdAt: now,
          });
        },
      },
      {
        id: "low-engagement",
        priority: 70,
        matches: (context: MotivationRuleContext): boolean =>
          context.nextState.engagement === "low" ||
          context.nextState.engagement === "disengaged",
        decide: (
          context: MotivationRuleContext,
          now: ISODateTime,
        ): MotivationDecision => {
          const { input } = context;

          return Object.freeze({
            decisionId: createDecisionId(
              input.motivationState.sessionId,
              input.motivationState.revision + 1,
              "progress_recognition",
            ),
            actionType: "progress_recognition",
            reasonCode: "low_engagement",
            shouldInterruptTeaching: false,
            message: createMessage(
              "small_step_forward",
              "warm",
              "light",
              {
                learnerName: input.learnerName,
                lessonProgress:
                  input.learningState.lessonProgress,
              },
            ),
            educationalPurpose:
              "Reconnect the learner with visible progress and the current goal.",
            createdAt: now,
          });
        },
      },
      {
        id: "meaningful-effort",
        priority: 65,
        matches: (context: MotivationRuleContext): boolean =>
          context.input.observation.effortDetected === true &&
          context.input.observation.responseCorrect !== true,
        decide: (
          context: MotivationRuleContext,
          now: ISODateTime,
        ): MotivationDecision => {
          const { input } = context;

          return Object.freeze({
            decisionId: createDecisionId(
              input.motivationState.sessionId,
              input.motivationState.revision + 1,
              "effort_recognition",
            ),
            actionType: "effort_recognition",
            reasonCode: "meaningful_effort",
            shouldInterruptTeaching: false,
            message: createMessage(
              "effort_matters",
              "warm",
              "light",
              {
                learnerName: input.learnerName,
              },
            ),
            educationalPurpose:
              "Recognize productive effort without presenting an incorrect answer as success.",
            createdAt: now,
          });
        },
      },
      {
        id: "challenge-readiness",
        priority: 60,
        matches: (context: MotivationRuleContext): boolean =>
          context.nextState.consecutiveSuccesses >=
            this.options.successStreakThreshold &&
          averageMastery(
            context.input.learningState.objectives,
          ) >= this.options.minimumChallengeMastery &&
          (context.nextState.engagement === "engaged" ||
            context.nextState.engagement === "highly_engaged"),
        decide: (
          context: MotivationRuleContext,
          now: ISODateTime,
        ): MotivationDecision => {
          const { input, nextState } = context;
          const currentObjective =
            findCurrentObjective(
              input.learningState,
            );

          return Object.freeze({
            decisionId: createDecisionId(
              input.motivationState.sessionId,
              input.motivationState.revision + 1,
              "mini_challenge",
            ),
            actionType: "mini_challenge",
            reasonCode: "challenge_ready",
            shouldInterruptTeaching: false,
            message: createMessage(
              "challenge_invitation",
              "playful",
              "moderate",
              {
                learnerName: input.learnerName,
                objectiveTitle:
                  currentObjective?.title,
                streakCount:
                  nextState.consecutiveSuccesses,
              },
            ),
            miniChallenge: Object.freeze({
              challengeId: createChallengeId(
                input.motivationState.sessionId,
                nextState.revision,
              ),
              objectiveId:
                currentObjective?.objectiveId,
              domain:
                currentObjective?.domain ??
                input.observation.domain,
              difficulty:
                nextState.confidence === "strong"
                  ? "stretch"
                  : "balanced",
              instructionKey:
                chooseChallengeInstruction(
                  currentObjective?.domain ??
                    input.observation.domain,
                ),
              optional: true,
            }),
            educationalPurpose:
              "Offer an optional stretch task after stable success without advancing curriculum prematurely.",
            createdAt: now,
          });
        },
      },
      {
        id: "success-streak",
        priority: 55,
        matches: (context: MotivationRuleContext): boolean =>
          context.nextState.consecutiveSuccesses ===
          this.options.successStreakThreshold,
        decide: (
          context: MotivationRuleContext,
          now: ISODateTime,
        ): MotivationDecision => {
          const { input, nextState } = context;

          return Object.freeze({
            decisionId: createDecisionId(
              input.motivationState.sessionId,
              input.motivationState.revision + 1,
              "streak_recognition",
            ),
            actionType: "streak_recognition",
            reasonCode: "positive_streak",
            shouldInterruptTeaching: false,
            message: createMessage(
              "success_streak",
              "cheerful",
              "light",
              {
                learnerName: input.learnerName,
                streakCount:
                  nextState.consecutiveSuccesses,
              },
            ),
            educationalPurpose:
              "Recognize stable performance while keeping praise proportional.",
            createdAt: now,
          });
        },
      },
      {
        id: "recent-progress",
        priority: 50,
        matches: (context: MotivationRuleContext): boolean =>
          context.input.observation.responseCorrect === true &&
          (context.input.observation.responseScore ?? 0) >= 70,
        decide: (
          context: MotivationRuleContext,
          now: ISODateTime,
        ): MotivationDecision => {
          const { input } = context;

          return Object.freeze({
            decisionId: createDecisionId(
              input.motivationState.sessionId,
              input.motivationState.revision + 1,
              "progress_recognition",
            ),
            actionType: "progress_recognition",
            reasonCode: "recent_progress",
            shouldInterruptTeaching: false,
            message: createMessage(
              "you_are_improving",
              "cheerful",
              "subtle",
              {
                learnerName: input.learnerName,
                lessonProgress:
                  input.learningState.lessonProgress,
              },
            ),
            educationalPurpose:
              "Make genuine progress visible without interrupting lesson flow.",
            createdAt: now,
          });
        },
      },
      {
        id: "no-action",
        priority: 0,
        matches: (_context: MotivationRuleContext): boolean =>
          true,
        decide: (
          context: MotivationRuleContext,
          now: ISODateTime,
        ): MotivationDecision =>
          createNoActionDecision(
            context.input.motivationState.sessionId,
            context.input.motivationState.revision + 1,
            now,
          ),
      },
    ];

    return rules.sort(
      (left, right) =>
        right.priority - left.priority,
    );
  }

  private deriveNextState(
    state: LearnerMotivationSnapshot,
    observation: MotivationObservation,
    now: ISODateTime,
  ): LearnerMotivationSnapshot {
    const success =
      observation.responseCorrect === true ||
      (observation.responseScore ?? 0) >= 70;

    const difficulty =
      observation.responseCorrect === false ||
      observation.frustrationDetected === true ||
      (observation.responseScore !== undefined &&
        observation.responseScore < 50);

    const recentActivityTypes =
      observation.activityType?.trim()
        ? [
            ...state.recentActivityTypes,
            observation.activityType.trim(),
          ].slice(-this.options.maximumRecentActivityTypes)
        : state.recentActivityTypes;

    return freezeMotivationState({
      ...state,
      confidence: observation.confidence,
      engagement: observation.engagement,
      motivation: observation.motivation,
      consecutiveSuccesses: success
        ? state.consecutiveSuccesses + 1
        : 0,
      consecutiveDifficulties: difficulty
        ? state.consecutiveDifficulties + 1
        : 0,
      recentActivityTypes,
      updatedAt: now,
      revision: state.revision + 1,
    });
  }

  private applyDecisionToState(
    state: LearnerMotivationSnapshot,
    decision: MotivationDecision,
    now: ISODateTime,
  ): LearnerMotivationSnapshot {
    if (decision.actionType === "none") {
      return state;
    }

    const historyItem =
      Object.freeze<MotivationHistoryItem>({
        decisionId: decision.decisionId,
        actionType: decision.actionType,
        reasonCode: decision.reasonCode,
        createdAt: now,
      });

    return freezeMotivationState({
      ...state,
      recentActions: [
        ...state.recentActions,
        historyItem,
      ].slice(-this.options.maximumRecentActions),
    });
  }

  private validateInput(
    input: MotivationEngineInput,
  ): void {
    const state = input.motivationState;
    const observation = input.observation;
    const learningState = input.learningState;

    requireText(
      observation.observationId,
      "observationId",
    );

    if (
      state.learnerId !== observation.learnerId ||
      state.learnerId !== learningState.learnerId
    ) {
      throw new Error(
        "Learner identifiers do not match.",
      );
    }

    if (
      state.sessionId !== observation.sessionId ||
      state.sessionId !== learningState.sessionId
    ) {
      throw new Error(
        "Session identifiers do not match.",
      );
    }

    if (
      state.lessonId !== observation.lessonId ||
      state.lessonId !== learningState.lessonId
    ) {
      throw new Error(
        "Lesson identifiers do not match.",
      );
    }

    if (
      observation.responseScore !== undefined
    ) {
      validatePercentage(
        observation.responseScore,
        "observation.responseScore",
      );
    }

    if (
      observation.responseDurationMs !== undefined &&
      (!Number.isFinite(
        observation.responseDurationMs,
      ) ||
        observation.responseDurationMs < 0)
    ) {
      throw new Error(
        "responseDurationMs must be zero or greater.",
      );
    }

    if (
      observation.hintsUsed !== undefined &&
      (!Number.isInteger(
        observation.hintsUsed,
      ) ||
        observation.hintsUsed < 0)
    ) {
      throw new Error(
        "hintsUsed must be a non-negative integer.",
      );
    }
  }
}

export function buildMotivationSummary(
  state: LearnerMotivationSnapshot,
): Readonly<{
  learnerId: ClassroomIdentifier;
  lessonId: ClassroomIdentifier;
  confidence: ConfidenceLevel;
  engagement: EngagementLevel;
  motivation: MotivationLevel;
  successStreak: number;
  difficultyStreak: number;
  lastAction?: MotivationActionType;
}> {
  return Object.freeze({
    learnerId: state.learnerId,
    lessonId: state.lessonId,
    confidence: state.confidence,
    engagement: state.engagement,
    motivation: state.motivation,
    successStreak: state.consecutiveSuccesses,
    difficultyStreak:
      state.consecutiveDifficulties,
    lastAction:
      state.recentActions.at(-1)?.actionType,
  });
}

function createMessage(
  messageKey: MotivationMessagePlan["messageKey"],
  tone: MotivationTone,
  intensity: MotivationIntensity,
  personalizationTokens: MotivationMessagePlan["personalizationTokens"],
): MotivationMessagePlan {
  return Object.freeze({
    messageKey,
    tone,
    intensity,
    personalizationTokens:
      Object.freeze({
        ...personalizationTokens,
      }),
  });
}

function createNoActionDecision(
  sessionId: ClassroomIdentifier,
  revision: number,
  now: ISODateTime,
): MotivationDecision {
  return Object.freeze({
    decisionId: createDecisionId(
      sessionId,
      revision,
      "none",
    ),
    actionType: "none",
    reasonCode: "no_action_needed",
    shouldInterruptTeaching: false,
    educationalPurpose:
      "Avoid unnecessary interruption when no motivational action is educationally justified.",
    createdAt: now,
  });
}

function createDecisionId(
  sessionId: ClassroomIdentifier,
  revision: number,
  actionType: MotivationActionType,
): ClassroomIdentifier {
  return `${sessionId}:${revision}:motivation:${actionType}`;
}

function createChallengeId(
  sessionId: ClassroomIdentifier,
  revision: number,
): ClassroomIdentifier {
  return `${sessionId}:${revision}:challenge`;
}

function findCurrentObjective(
  learningState: LearnerEducationalSnapshot,
): LearningObjectiveState | undefined {
  if (!learningState.currentObjectiveId) {
    return undefined;
  }

  return learningState.objectives.find(
    (objective) =>
      objective.objectiveId ===
      learningState.currentObjectiveId,
  );
}

function averageMastery(
  objectives: readonly LearningObjectiveState[],
): Percentage {
  if (objectives.length === 0) {
    return 0;
  }

  return Math.round(
    objectives.reduce(
      (sum, objective) =>
        sum + objective.mastery,
      0,
    ) / objectives.length,
  );
}

function chooseChallengeInstruction(
  domain: LearningDomain | undefined,
): MiniChallenge["instructionKey"] {
  switch (domain) {
    case "speaking":
    case "functional_language":
      return "complete_short_dialogue";

    case "vocabulary":
      return "use_in_new_context";

    case "grammar":
      return "give_extra_example";

    case "reading":
    case "listening":
      return "explain_in_own_words";

    case "pronunciation":
      return "respond_faster";

    default:
      return "use_without_hint";
  }
}

function detectRepeatedActivity(
  recentActivityTypes: readonly string[],
): boolean {
  if (recentActivityTypes.length < 3) {
    return false;
  }

  const recent =
    recentActivityTypes.slice(-3);
  return recent.every(
    (activity) => activity === recent[0],
  );
}

function canBeSuppressed(
  actionType: MotivationActionType,
): boolean {
  return ![
    "confidence_reassurance",
    "short_break_suggestion",
    "mastery_celebration",
  ].includes(actionType);
}

function validateOptions(
  options: Required<MotivationEngineOptions>,
): void {
  const integerFields: readonly [
    keyof Pick<
      Required<MotivationEngineOptions>,
      | "maximumRecentActions"
      | "maximumRecentActivityTypes"
      | "repeatedDifficultyThreshold"
      | "successStreakThreshold"
      | "repeatedActionCooldown"
    >,
    number,
  ][] = [
    [
      "maximumRecentActions",
      options.maximumRecentActions,
    ],
    [
      "maximumRecentActivityTypes",
      options.maximumRecentActivityTypes,
    ],
    [
      "repeatedDifficultyThreshold",
      options.repeatedDifficultyThreshold,
    ],
    [
      "successStreakThreshold",
      options.successStreakThreshold,
    ],
    [
      "repeatedActionCooldown",
      options.repeatedActionCooldown,
    ],
  ];

  for (const [field, value] of integerFields) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(
        `${field} must be a positive integer.`,
      );
    }
  }

  validatePercentage(
    options.minimumChallengeMastery,
    "minimumChallengeMastery",
  );
}

function requireText(
  value: string,
  field: string,
): void {
  if (!value.trim()) {
    throw new Error(`${field} is required.`);
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

function freezeMotivationState(
  state: LearnerMotivationSnapshot,
): LearnerMotivationSnapshot {
  return Object.freeze({
    ...state,
    recentActivityTypes: Object.freeze([
      ...state.recentActivityTypes,
    ]),
    recentActions: Object.freeze(
      state.recentActions.map((item) =>
        Object.freeze({ ...item }),
      ),
    ),
  });
}
