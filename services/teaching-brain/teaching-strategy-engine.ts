/**
 * ELVY Teaching Engine
 * TE-700 — Teaching Strategy Engine
 *
 * Deterministic selection of the instructional approach Elvy should use after
 * a learner response has been evaluated.
 *
 * Responsibilities:
 * - Select a teaching strategy from the learner evaluation and lesson context.
 * - Define the next instructional move without mutating ClassroomState.
 * - Set support, challenge, pacing, feedback, and presentation guidance.
 * - Produce an immutable, serializable strategy decision.
 *
 * Non-responsibilities:
 * - It does not evaluate whether the learner answer is correct.
 * - It does not render UI or control React.
 * - It does not mutate the ClassroomState.
 * - It does not directly advance a lesson or scene.
 * - It does not call databases or external AI services.
 */

import type {
  ClassroomIdentifier,
  ISODateTime,
  Percentage,
  StudentAnswerStatus,
  TeacherExpression,
  TeacherGesture,
} from "./classroom-state";
import type {
  FeedbackTone,
  ResponseActivityType,
  ResponseDecision,
  ResponseErrorCategory,
  StudentResponseEvaluation,
} from "./student-response-engine";

export type TeachingDomain =
  | "general"
  | "vocabulary"
  | "grammar"
  | "reading"
  | "listening"
  | "speaking"
  | "pronunciation"
  | "writing"
  | "comprehension";

export type TeachingStrategyId =
  | "affirm_and_advance"
  | "confirm_and_extend"
  | "guided_retry"
  | "single_hint"
  | "scaffolded_hint"
  | "simplified_reteach"
  | "worked_example"
  | "model_then_practice"
  | "contrastive_explanation"
  | "keyword_focus"
  | "contextual_vocabulary"
  | "grammar_recast"
  | "grammar_micro_explanation"
  | "sentence_reordering"
  | "reading_evidence_prompt"
  | "listening_replay_focus"
  | "pronunciation_model"
  | "pronunciation_chunking"
  | "fluency_rehearsal"
  | "writing_expansion"
  | "clarification_prompt"
  | "l1_brief_support"
  | "strategy_switch"
  | "teacher_review";

export type TeachingMove =
  | "praise"
  | "confirm"
  | "advance"
  | "extend"
  | "ask_retry"
  | "ask_clarification"
  | "give_hint"
  | "highlight"
  | "rephrase"
  | "simplify"
  | "explain"
  | "demonstrate"
  | "model"
  | "contrast"
  | "chunk"
  | "repeat"
  | "replay"
  | "recast"
  | "elicit"
  | "prompt_evidence"
  | "provide_example"
  | "use_l1"
  | "pause_for_review";

export type StrategySupportLevel = 0 | 1 | 2 | 3 | 4;

export type StrategyPace =
  | "slower"
  | "slow"
  | "normal"
  | "brisk";

export type StrategyDifficultyAdjustment =
  | "reduce"
  | "maintain"
  | "increase";

export type StrategyResponseLength =
  | "very_short"
  | "short"
  | "medium";

export type StrategyBoardAction =
  | "none"
  | "keep_current"
  | "highlight_error"
  | "highlight_keyword"
  | "show_hint"
  | "show_rule"
  | "show_example"
  | "show_model"
  | "show_contrast"
  | "show_sentence_chunks";

export interface TeachingStrategyContext {
  readonly strategyRequestId: ClassroomIdentifier;
  readonly sessionId: ClassroomIdentifier;
  readonly lessonId: ClassroomIdentifier;
  readonly sceneId: ClassroomIdentifier;
  readonly objectiveId?: ClassroomIdentifier;
  readonly activityType: ResponseActivityType;
  readonly evaluation: StudentResponseEvaluation;
  readonly currentStrategyId?: TeachingStrategyId;
  readonly learnerLevel?: string;
  readonly learnerL1?: string;
  readonly targetLanguage?: string;
  readonly objectiveMastery?: Percentage;
  readonly recentIncorrectCount?: number;
  readonly consecutiveCorrectCount?: number;
  readonly supportAlreadyGiven?: number;
  readonly allowsL1Support?: boolean;
  readonly availableStrategies?: readonly TeachingStrategyId[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface TeachingStrategyDecision {
  readonly strategyRequestId: ClassroomIdentifier;
  readonly strategyId: TeachingStrategyId;
  readonly domain: TeachingDomain;
  readonly reason: string;
  readonly primaryMove: TeachingMove;
  readonly moves: readonly TeachingMove[];
  readonly supportLevel: StrategySupportLevel;
  readonly pace: StrategyPace;
  readonly difficultyAdjustment: StrategyDifficultyAdjustment;
  readonly shouldAdvance: boolean;
  readonly shouldRetry: boolean;
  readonly shouldSwitchStrategy: boolean;
  readonly shouldUseL1: boolean;
  readonly shouldRequestTeacherReview: boolean;
  readonly maximumTeacherTurns: number;
  readonly responseLength: StrategyResponseLength;
  readonly teacherGuidance: TeacherGuidance;
  readonly whiteboardGuidance: WhiteboardGuidance;
  readonly learnerPrompt: LearnerPromptGuidance;
  readonly successCondition: StrategySuccessCondition;
  readonly confidence: Percentage;
  readonly selectedAt: ISODateTime;
  readonly diagnostics: TeachingStrategyDiagnostics;
}

export interface TeacherGuidance {
  readonly tone: FeedbackTone;
  readonly expression: TeacherExpression;
  readonly gesture: TeacherGesture;
  readonly instruction: string;
  readonly avoid: readonly string[];
}

export interface WhiteboardGuidance {
  readonly action: StrategyBoardAction;
  readonly focus?: string;
  readonly content?: string;
  readonly preserveExistingContent: boolean;
}

export interface LearnerPromptGuidance {
  readonly promptType:
    | "none"
    | "retry"
    | "clarify"
    | "expand"
    | "repeat"
    | "choose"
    | "produce_example";
  readonly expectedResponseLength: StrategyResponseLength;
  readonly allowVoice: boolean;
  readonly allowText: boolean;
  readonly allowChoice: boolean;
}

export interface StrategySuccessCondition {
  readonly requiredStatus: readonly StudentAnswerStatus[];
  readonly minimumScore?: Percentage;
  readonly maximumAdditionalAttempts: number;
  readonly evidenceRequired?: string;
}

export interface TeachingStrategyDiagnostics {
  readonly engineVersion: string;
  readonly rulesApplied: readonly string[];
  readonly candidateStrategies: readonly TeachingStrategyId[];
  readonly rejectedStrategies: readonly TeachingStrategyId[];
  readonly dominantError?: ResponseErrorCategory;
  readonly attemptNumber: number;
  readonly maximumAttemptsReached: boolean;
}

export interface TeachingStrategyEngineOptions {
  readonly engineVersion?: string;
  readonly defaultAllowsL1Support?: boolean;
  readonly defaultMaximumTeacherTurns?: number;
  readonly now?: () => ISODateTime;
}

interface StrategyCandidate {
  readonly id: TeachingStrategyId;
  readonly score: number;
  readonly reason: string;
  readonly rule: string;
}

interface StrategyProfile {
  readonly domain: TeachingDomain;
  readonly primaryMove: TeachingMove;
  readonly moves: readonly TeachingMove[];
  readonly supportLevel: StrategySupportLevel;
  readonly pace: StrategyPace;
  readonly difficultyAdjustment: StrategyDifficultyAdjustment;
  readonly responseLength: StrategyResponseLength;
  readonly boardAction: StrategyBoardAction;
  readonly promptType: LearnerPromptGuidance["promptType"];
  readonly teacherInstruction: string;
  readonly teacherExpression: TeacherExpression;
  readonly teacherGesture: TeacherGesture;
}

const DEFAULT_OPTIONS: Required<TeachingStrategyEngineOptions> = {
  engineVersion: "1.0.0",
  defaultAllowsL1Support: true,
  defaultMaximumTeacherTurns: 2,
  now: () => new Date().toISOString(),
};

const STRATEGY_PROFILES: Readonly<
  Record<TeachingStrategyId, StrategyProfile>
> = Object.freeze({
  affirm_and_advance: {
    domain: "general",
    primaryMove: "advance",
    moves: ["praise", "confirm", "advance"],
    supportLevel: 0,
    pace: "brisk",
    difficultyAdjustment: "maintain",
    responseLength: "very_short",
    boardAction: "keep_current",
    promptType: "none",
    teacherInstruction:
      "Briefly confirm the correct answer, praise the learner naturally, and continue.",
    teacherExpression: "celebrating",
    teacherGesture: "encourage",
  },
  confirm_and_extend: {
    domain: "general",
    primaryMove: "extend",
    moves: ["confirm", "extend", "elicit"],
    supportLevel: 0,
    pace: "normal",
    difficultyAdjustment: "increase",
    responseLength: "short",
    boardAction: "keep_current",
    promptType: "expand",
    teacherInstruction:
      "Confirm what is correct, then ask one small extension question.",
    teacherExpression: "encouraging",
    teacherGesture: "open_hand",
  },
  guided_retry: {
    domain: "general",
    primaryMove: "ask_retry",
    moves: ["rephrase", "give_hint", "ask_retry"],
    supportLevel: 1,
    pace: "slow",
    difficultyAdjustment: "maintain",
    responseLength: "short",
    boardAction: "show_hint",
    promptType: "retry",
    teacherInstruction:
      "Keep the task the same, provide one precise cue, and invite another attempt.",
    teacherExpression: "encouraging",
    teacherGesture: "open_hand",
  },
  single_hint: {
    domain: "general",
    primaryMove: "give_hint",
    moves: ["give_hint", "ask_retry"],
    supportLevel: 1,
    pace: "normal",
    difficultyAdjustment: "maintain",
    responseLength: "very_short",
    boardAction: "show_hint",
    promptType: "retry",
    teacherInstruction:
      "Give only one useful hint without revealing the complete answer.",
    teacherExpression: "encouraging",
    teacherGesture: "point_board",
  },
  scaffolded_hint: {
    domain: "general",
    primaryMove: "give_hint",
    moves: ["simplify", "give_hint", "elicit", "ask_retry"],
    supportLevel: 2,
    pace: "slow",
    difficultyAdjustment: "reduce",
    responseLength: "short",
    boardAction: "show_sentence_chunks",
    promptType: "retry",
    teacherInstruction:
      "Break the task into a smaller step, provide a partial cue, and ask the learner to complete it.",
    teacherExpression: "encouraging",
    teacherGesture: "point_board",
  },
  simplified_reteach: {
    domain: "general",
    primaryMove: "explain",
    moves: ["simplify", "rephrase", "provide_example", "ask_retry"],
    supportLevel: 3,
    pace: "slower",
    difficultyAdjustment: "reduce",
    responseLength: "medium",
    boardAction: "show_example",
    promptType: "retry",
    teacherInstruction:
      "Explain the idea again using simpler language and one clear example before retrying.",
    teacherExpression: "correcting",
    teacherGesture: "point_board",
  },
  worked_example: {
    domain: "general",
    primaryMove: "demonstrate",
    moves: ["demonstrate", "explain", "ask_retry"],
    supportLevel: 3,
    pace: "slower",
    difficultyAdjustment: "reduce",
    responseLength: "medium",
    boardAction: "show_example",
    promptType: "produce_example",
    teacherInstruction:
      "Solve one parallel example step by step, then give the learner a similar item.",
    teacherExpression: "neutral",
    teacherGesture: "point_board",
  },
  model_then_practice: {
    domain: "general",
    primaryMove: "model",
    moves: ["model", "chunk", "repeat", "ask_retry"],
    supportLevel: 4,
    pace: "slower",
    difficultyAdjustment: "reduce",
    responseLength: "medium",
    boardAction: "show_model",
    promptType: "repeat",
    teacherInstruction:
      "Provide a concise model, practise it in small parts, and then ask for independent production.",
    teacherExpression: "encouraging",
    teacherGesture: "point_board",
  },
  contrastive_explanation: {
    domain: "grammar",
    primaryMove: "contrast",
    moves: ["contrast", "explain", "highlight", "ask_retry"],
    supportLevel: 2,
    pace: "slow",
    difficultyAdjustment: "maintain",
    responseLength: "medium",
    boardAction: "show_contrast",
    promptType: "retry",
    teacherInstruction:
      "Contrast the learner form with the target form and explain only the important difference.",
    teacherExpression: "correcting",
    teacherGesture: "point_board",
  },
  keyword_focus: {
    domain: "comprehension",
    primaryMove: "highlight",
    moves: ["highlight", "prompt_evidence", "ask_retry"],
    supportLevel: 1,
    pace: "slow",
    difficultyAdjustment: "maintain",
    responseLength: "short",
    boardAction: "highlight_keyword",
    promptType: "retry",
    teacherInstruction:
      "Direct attention to the key word or phrase and ask the learner to use it in the answer.",
    teacherExpression: "encouraging",
    teacherGesture: "point_board",
  },
  contextual_vocabulary: {
    domain: "vocabulary",
    primaryMove: "provide_example",
    moves: ["provide_example", "highlight", "elicit"],
    supportLevel: 2,
    pace: "slow",
    difficultyAdjustment: "maintain",
    responseLength: "short",
    boardAction: "show_example",
    promptType: "produce_example",
    teacherInstruction:
      "Teach the word through a simple context, then ask the learner to use it.",
    teacherExpression: "encouraging",
    teacherGesture: "open_hand",
  },
  grammar_recast: {
    domain: "grammar",
    primaryMove: "recast",
    moves: ["recast", "highlight", "ask_retry"],
    supportLevel: 1,
    pace: "normal",
    difficultyAdjustment: "maintain",
    responseLength: "short",
    boardAction: "highlight_error",
    promptType: "repeat",
    teacherInstruction:
      "Recast the sentence correctly without a long explanation, highlight the changed part, and ask for repetition.",
    teacherExpression: "correcting",
    teacherGesture: "point_board",
  },
  grammar_micro_explanation: {
    domain: "grammar",
    primaryMove: "explain",
    moves: ["highlight", "explain", "provide_example", "ask_retry"],
    supportLevel: 2,
    pace: "slow",
    difficultyAdjustment: "reduce",
    responseLength: "medium",
    boardAction: "show_rule",
    promptType: "retry",
    teacherInstruction:
      "Give one short grammar rule, one example, and immediately return to practice.",
    teacherExpression: "correcting",
    teacherGesture: "point_board",
  },
  sentence_reordering: {
    domain: "grammar",
    primaryMove: "chunk",
    moves: ["chunk", "highlight", "elicit", "ask_retry"],
    supportLevel: 2,
    pace: "slow",
    difficultyAdjustment: "reduce",
    responseLength: "short",
    boardAction: "show_sentence_chunks",
    promptType: "choose",
    teacherInstruction:
      "Show the sentence in meaningful chunks and ask the learner to rebuild the correct order.",
    teacherExpression: "encouraging",
    teacherGesture: "point_board",
  },
  reading_evidence_prompt: {
    domain: "reading",
    primaryMove: "prompt_evidence",
    moves: ["highlight", "prompt_evidence", "elicit"],
    supportLevel: 1,
    pace: "slow",
    difficultyAdjustment: "maintain",
    responseLength: "short",
    boardAction: "highlight_keyword",
    promptType: "expand",
    teacherInstruction:
      "Ask the learner to locate and use evidence from the text rather than giving the answer.",
    teacherExpression: "thinking",
    teacherGesture: "point_board",
  },
  listening_replay_focus: {
    domain: "listening",
    primaryMove: "replay",
    moves: ["highlight", "replay", "elicit"],
    supportLevel: 2,
    pace: "slow",
    difficultyAdjustment: "reduce",
    responseLength: "short",
    boardAction: "show_hint",
    promptType: "retry",
    teacherInstruction:
      "Set one listening focus, replay only the relevant part, and ask the question again.",
    teacherExpression: "listening",
    teacherGesture: "listen",
  },
  pronunciation_model: {
    domain: "pronunciation",
    primaryMove: "model",
    moves: ["model", "repeat", "ask_retry"],
    supportLevel: 2,
    pace: "slower",
    difficultyAdjustment: "maintain",
    responseLength: "very_short",
    boardAction: "show_model",
    promptType: "repeat",
    teacherInstruction:
      "Model the target pronunciation clearly once or twice, then invite repetition.",
    teacherExpression: "encouraging",
    teacherGesture: "listen",
  },
  pronunciation_chunking: {
    domain: "pronunciation",
    primaryMove: "chunk",
    moves: ["chunk", "model", "repeat", "ask_retry"],
    supportLevel: 3,
    pace: "slower",
    difficultyAdjustment: "reduce",
    responseLength: "short",
    boardAction: "show_sentence_chunks",
    promptType: "repeat",
    teacherInstruction:
      "Split the difficult word or phrase into manageable sound chunks, practise them, then blend them.",
    teacherExpression: "encouraging",
    teacherGesture: "listen",
  },
  fluency_rehearsal: {
    domain: "speaking",
    primaryMove: "repeat",
    moves: ["model", "chunk", "repeat", "elicit"],
    supportLevel: 2,
    pace: "slow",
    difficultyAdjustment: "maintain",
    responseLength: "short",
    boardAction: "show_sentence_chunks",
    promptType: "repeat",
    teacherInstruction:
      "Provide a short speaking frame, rehearse it once, and ask the learner to say it more smoothly.",
    teacherExpression: "encouraging",
    teacherGesture: "listen",
  },
  writing_expansion: {
    domain: "writing",
    primaryMove: "extend",
    moves: ["highlight", "elicit", "extend"],
    supportLevel: 1,
    pace: "normal",
    difficultyAdjustment: "maintain",
    responseLength: "short",
    boardAction: "show_hint",
    promptType: "expand",
    teacherInstruction:
      "Acknowledge the correct core idea and ask for one missing detail or complete sentence.",
    teacherExpression: "encouraging",
    teacherGesture: "open_hand",
  },
  clarification_prompt: {
    domain: "general",
    primaryMove: "ask_clarification",
    moves: ["rephrase", "ask_clarification"],
    supportLevel: 1,
    pace: "slow",
    difficultyAdjustment: "maintain",
    responseLength: "very_short",
    boardAction: "keep_current",
    promptType: "clarify",
    teacherInstruction:
      "Ask one simple clarification question without assuming what the learner meant.",
    teacherExpression: "listening",
    teacherGesture: "listen",
  },
  l1_brief_support: {
    domain: "general",
    primaryMove: "use_l1",
    moves: ["use_l1", "rephrase", "ask_retry"],
    supportLevel: 3,
    pace: "slower",
    difficultyAdjustment: "reduce",
    responseLength: "short",
    boardAction: "show_hint",
    promptType: "retry",
    teacherInstruction:
      "Use the learner's first language only for one brief instruction or key meaning, then return immediately to the target language.",
    teacherExpression: "encouraging",
    teacherGesture: "open_hand",
  },
  strategy_switch: {
    domain: "general",
    primaryMove: "simplify",
    moves: ["simplify", "provide_example", "elicit"],
    supportLevel: 3,
    pace: "slower",
    difficultyAdjustment: "reduce",
    responseLength: "medium",
    boardAction: "show_example",
    promptType: "retry",
    teacherInstruction:
      "Stop repeating the same explanation. Present the objective through a different representation or task.",
    teacherExpression: "thinking",
    teacherGesture: "think",
  },
  teacher_review: {
    domain: "general",
    primaryMove: "pause_for_review",
    moves: ["pause_for_review"],
    supportLevel: 4,
    pace: "slow",
    difficultyAdjustment: "maintain",
    responseLength: "very_short",
    boardAction: "keep_current",
    promptType: "none",
    teacherInstruction:
      "Pause automated progression and flag the response for teacher review.",
    teacherExpression: "concerned",
    teacherGesture: "none",
  },
});

export class TeachingStrategyEngine {
  private readonly options: Required<TeachingStrategyEngineOptions>;

  public constructor(options: TeachingStrategyEngineOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    if (this.options.defaultMaximumTeacherTurns < 1) {
      throw new Error(
        "defaultMaximumTeacherTurns must be at least 1.",
      );
    }
  }

  public selectStrategy(
    context: TeachingStrategyContext,
  ): TeachingStrategyDecision {
    const errors = validateTeachingStrategyContext(context);

    if (errors.length > 0) {
      throw new Error(
        `Cannot select a teaching strategy: ${errors.join(" ")}`,
      );
    }

    const candidates = this.buildCandidates(context);
    const availableCandidates = candidates.filter((candidate) =>
      isStrategyAllowed(candidate.id, context.availableStrategies),
    );
    const usableCandidates =
      availableCandidates.length > 0
        ? availableCandidates
        : candidates;
    const selected = [...usableCandidates].sort(compareCandidates)[0];

    if (!selected) {
      throw new Error("No teaching strategy candidate was produced.");
    }

    const profile = STRATEGY_PROFILES[selected.id];
    const attemptNumber = Math.max(
      1,
      context.evaluation.nextAttemptNumber - 1,
    );
    const maximumAttemptsReached =
      context.evaluation.diagnostics.maximumAttemptsReached;
    const shouldRequestTeacherReview =
      selected.id === "teacher_review";
    const shouldUseL1 = selected.id === "l1_brief_support";
    const shouldAdvance =
      selected.id === "affirm_and_advance" ||
      (selected.id === "confirm_and_extend" &&
        context.evaluation.status === "correct");
    const shouldRetry =
      !shouldAdvance &&
      !shouldRequestTeacherReview &&
      profile.promptType !== "none";
    const shouldSwitchStrategy =
      selected.id === "strategy_switch" ||
      (context.currentStrategyId !== undefined &&
        context.currentStrategyId !== selected.id &&
        (context.supportAlreadyGiven ?? 0) > 0);
    const dominantError = chooseDominantError(
      context.evaluation.errorCategories,
    );
    const rejectedStrategies = candidates
      .filter(
        (candidate) =>
          !usableCandidates.some(
            (usable) => usable.id === candidate.id,
          ),
      )
      .map((candidate) => candidate.id);

    return Object.freeze({
      strategyRequestId: context.strategyRequestId,
      strategyId: selected.id,
      domain: profile.domain,
      reason: selected.reason,
      primaryMove: profile.primaryMove,
      moves: Object.freeze([...profile.moves]),
      supportLevel: profile.supportLevel,
      pace: adjustPace(profile.pace, context),
      difficultyAdjustment: adjustDifficulty(
        profile.difficultyAdjustment,
        context,
      ),
      shouldAdvance,
      shouldRetry,
      shouldSwitchStrategy,
      shouldUseL1,
      shouldRequestTeacherReview,
      maximumTeacherTurns:
        shouldRequestTeacherReview
          ? 1
          : this.options.defaultMaximumTeacherTurns,
      responseLength: profile.responseLength,
      teacherGuidance: Object.freeze({
        tone: selectTone(
          context.evaluation.feedbackTone,
          selected.id,
        ),
        expression: profile.teacherExpression,
        gesture: profile.teacherGesture,
        instruction: profile.teacherInstruction,
        avoid: Object.freeze(buildAvoidList(selected.id)),
      }),
      whiteboardGuidance: Object.freeze({
        action: profile.boardAction,
        focus: buildBoardFocus(context, dominantError),
        content: buildBoardContent(context, selected.id),
        preserveExistingContent:
          selected.id !== "worked_example" &&
          selected.id !== "model_then_practice",
      }),
      learnerPrompt: Object.freeze({
        promptType: profile.promptType,
        expectedResponseLength: profile.responseLength,
        allowVoice: allowsVoice(context.activityType),
        allowText: allowsText(context.activityType),
        allowChoice:
          context.activityType === "multiple_choice" ||
          context.activityType === "true_false" ||
          context.activityType === "matching",
      }),
      successCondition: Object.freeze(
        buildSuccessCondition(context, selected.id),
      ),
      confidence: calculateDecisionConfidence(
        selected,
        usableCandidates,
        context,
      ),
      selectedAt: this.options.now(),
      diagnostics: Object.freeze({
        engineVersion: this.options.engineVersion,
        rulesApplied: Object.freeze(
          unique(candidates.map((candidate) => candidate.rule)),
        ),
        candidateStrategies: Object.freeze(
          unique(candidates.map((candidate) => candidate.id)),
        ),
        rejectedStrategies: Object.freeze(
          unique(rejectedStrategies),
        ),
        dominantError,
        attemptNumber,
        maximumAttemptsReached,
      }),
    });
  }

  private buildCandidates(
    context: TeachingStrategyContext,
  ): readonly StrategyCandidate[] {
    const candidates: StrategyCandidate[] = [];
    const evaluation = context.evaluation;
    const errors = evaluation.errorCategories;
    const supportAlreadyGiven = context.supportAlreadyGiven ?? 0;
    const recentIncorrectCount = context.recentIncorrectCount ?? 0;
    const consecutiveCorrectCount = context.consecutiveCorrectCount ?? 0;

    if (evaluation.decision === "pause_for_teacher_review") {
      addCandidate(
        candidates,
        "teacher_review",
        100,
        "The response evaluation requires teacher review.",
        "evaluation_teacher_review",
      );
    }

    if (evaluation.status === "correct") {
      addCandidate(
        candidates,
        consecutiveCorrectCount >= 2
          ? "confirm_and_extend"
          : "affirm_and_advance",
        95,
        consecutiveCorrectCount >= 2
          ? "The learner is correct and ready for a small extension."
          : "The learner answered correctly and can continue.",
        "correct_answer",
      );
    }

    if (evaluation.status === "partially_correct") {
      addCandidate(
        candidates,
        context.activityType === "writing"
          ? "writing_expansion"
          : "guided_retry",
        82,
        "The learner shows partial understanding and needs a focused prompt.",
        "partial_answer",
      );

      addCandidate(
        candidates,
        "single_hint",
        78,
        "A small hint may help the learner complete the answer independently.",
        "partial_answer_hint",
      );
    }

    if (
      evaluation.status === "unclear" ||
      errors.includes("empty") ||
      errors.includes("ambiguous")
    ) {
      addCandidate(
        candidates,
        "clarification_prompt",
        94,
        "The learner's meaning is not clear enough for reliable instruction.",
        "unclear_answer",
      );
    }

    if (errors.includes("pronunciation")) {
      addCandidate(
        candidates,
        supportAlreadyGiven >= 1
          ? "pronunciation_chunking"
          : "pronunciation_model",
        96,
        "Pronunciation evidence shows that focused sound support is needed.",
        "pronunciation_error",
      );
    }

    if (errors.includes("fluency")) {
      addCandidate(
        candidates,
        "fluency_rehearsal",
        93,
        "The learner needs supported rehearsal to improve fluency.",
        "fluency_error",
      );
    }

    if (errors.includes("grammar")) {
      addCandidate(
        candidates,
        supportAlreadyGiven >= 1
          ? "grammar_micro_explanation"
          : "grammar_recast",
        91,
        "The main obstacle is grammatical form.",
        "grammar_error",
      );
    }

    if (errors.includes("word_order")) {
      addCandidate(
        candidates,
        "sentence_reordering",
        95,
        "The response shows a word-order problem that benefits from chunking.",
        "word_order_error",
      );
    }

    if (
      errors.includes("vocabulary") ||
      context.activityType === "vocabulary"
    ) {
      addCandidate(
        candidates,
        "contextual_vocabulary",
        89,
        "The learner needs vocabulary support in a meaningful context.",
        "vocabulary_support",
      );
    }

    if (
      errors.includes("comprehension") &&
      context.activityType === "reading_comprehension"
    ) {
      addCandidate(
        candidates,
        "reading_evidence_prompt",
        93,
        "The learner should return to evidence in the reading text.",
        "reading_comprehension_support",
      );
    }

    if (
      errors.includes("comprehension") &&
      context.activityType === "listening_comprehension"
    ) {
      addCandidate(
        candidates,
        "listening_replay_focus",
        93,
        "The learner needs a focused replay of the relevant listening segment.",
        "listening_comprehension_support",
      );
    }

    if (errors.includes("incomplete")) {
      addCandidate(
        candidates,
        context.activityType === "writing"
          ? "writing_expansion"
          : "keyword_focus",
        86,
        "The answer is incomplete and needs one focused addition.",
        "incomplete_answer",
      );
    }

    if (
      evaluation.decision === "give_hint" ||
      evaluation.decision === "ask_to_retry"
    ) {
      addCandidate(
        candidates,
        supportAlreadyGiven >= 1
          ? "scaffolded_hint"
          : "single_hint",
        84,
        "The evaluation recommends another learner attempt with support.",
        "evaluation_retry",
      );
    }

    if (evaluation.decision === "explain_again") {
      addCandidate(
        candidates,
        "simplified_reteach",
        90,
        "The concept should be explained again in a simpler form.",
        "evaluation_reteach",
      );
    }

    if (evaluation.decision === "model_answer") {
      addCandidate(
        candidates,
        "model_then_practice",
        92,
        "The learner has reached the point where a concise model is appropriate.",
        "evaluation_model",
      );
    }

    if (evaluation.decision === "switch_strategy") {
      addCandidate(
        candidates,
        "strategy_switch",
        98,
        "Repeating the current approach is unlikely to help.",
        "evaluation_switch_strategy",
      );
    }

    if (
      evaluation.decision === "provide_pronunciation_support"
    ) {
      addCandidate(
        candidates,
        "pronunciation_model",
        96,
        "The evaluation explicitly requests pronunciation support.",
        "evaluation_pronunciation",
      );
    }

    if (
      evaluation.decision === "request_clarification"
    ) {
      addCandidate(
        candidates,
        "clarification_prompt",
        96,
        "The evaluation explicitly requests clarification.",
        "evaluation_clarification",
      );
    }

    if (
      shouldOfferL1(context, this.options.defaultAllowsL1Support)
    ) {
      addCandidate(
        candidates,
        "l1_brief_support",
        88,
        "Repeated difficulty suggests that one brief L1 clarification may reduce unnecessary cognitive load.",
        "brief_l1_support",
      );
    }

    if (
      recentIncorrectCount >= 3 ||
      supportAlreadyGiven >= 3
    ) {
      addCandidate(
        candidates,
        "strategy_switch",
        97,
        "The learner has struggled repeatedly with the current approach.",
        "repeated_difficulty",
      );
    }

    if (
      evaluation.status === "incorrect" &&
      candidates.length === 0
    ) {
      addCandidate(
        candidates,
        "guided_retry",
        70,
        "The learner needs a supported second attempt.",
        "incorrect_answer_fallback",
      );
    }

    if (candidates.length === 0) {
      addCandidate(
        candidates,
        strategyFromDecision(evaluation.decision),
        60,
        "The strategy follows the response engine recommendation.",
        "response_decision_fallback",
      );
    }

    return Object.freeze(candidates);
  }
}

export function validateTeachingStrategyContext(
  context: TeachingStrategyContext,
): readonly string[] {
  const errors: string[] = [];

  if (!context.strategyRequestId.trim()) {
    errors.push("strategyRequestId is required.");
  }

  if (!context.sessionId.trim()) {
    errors.push("sessionId is required.");
  }

  if (!context.lessonId.trim()) {
    errors.push("lessonId is required.");
  }

  if (!context.sceneId.trim()) {
    errors.push("sceneId is required.");
  }

  if (
    context.objectiveMastery !== undefined &&
    !isPercentage(context.objectiveMastery)
  ) {
    errors.push("objectiveMastery must be between 0 and 100.");
  }

  if (
    context.recentIncorrectCount !== undefined &&
    context.recentIncorrectCount < 0
  ) {
    errors.push("recentIncorrectCount cannot be negative.");
  }

  if (
    context.consecutiveCorrectCount !== undefined &&
    context.consecutiveCorrectCount < 0
  ) {
    errors.push("consecutiveCorrectCount cannot be negative.");
  }

  if (
    context.supportAlreadyGiven !== undefined &&
    context.supportAlreadyGiven < 0
  ) {
    errors.push("supportAlreadyGiven cannot be negative.");
  }

  if (
    context.availableStrategies !== undefined &&
    context.availableStrategies.length === 0
  ) {
    errors.push(
      "availableStrategies must contain at least one strategy when supplied.",
    );
  }

  return Object.freeze(errors);
}

function addCandidate(
  candidates: StrategyCandidate[],
  id: TeachingStrategyId,
  score: number,
  reason: string,
  rule: string,
): void {
  const existingIndex = candidates.findIndex(
    (candidate) => candidate.id === id,
  );

  if (
    existingIndex >= 0 &&
    candidates[existingIndex] &&
    candidates[existingIndex].score >= score
  ) {
    return;
  }

  const candidate: StrategyCandidate = Object.freeze({
    id,
    score,
    reason,
    rule,
  });

  if (existingIndex >= 0) {
    candidates[existingIndex] = candidate;
  } else {
    candidates.push(candidate);
  }
}

function compareCandidates(
  left: StrategyCandidate,
  right: StrategyCandidate,
): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.id.localeCompare(right.id);
}

function isStrategyAllowed(
  strategyId: TeachingStrategyId,
  available?: readonly TeachingStrategyId[],
): boolean {
  return available === undefined || available.includes(strategyId);
}

function chooseDominantError(
  errors: readonly ResponseErrorCategory[],
): ResponseErrorCategory | undefined {
  const priority: readonly ResponseErrorCategory[] = [
    "pronunciation",
    "fluency",
    "word_order",
    "grammar",
    "vocabulary",
    "comprehension",
    "incomplete",
    "spelling",
    "punctuation",
    "ambiguous",
    "off_topic",
    "unknown",
    "empty",
  ];

  return priority.find((error) => errors.includes(error));
}

function adjustPace(
  basePace: StrategyPace,
  context: TeachingStrategyContext,
): StrategyPace {
  if (
    (context.recentIncorrectCount ?? 0) >= 3 ||
    (context.supportAlreadyGiven ?? 0) >= 3
  ) {
    return "slower";
  }

  if (
    context.evaluation.status === "correct" &&
    (context.consecutiveCorrectCount ?? 0) >= 3
  ) {
    return "brisk";
  }

  return basePace;
}

function adjustDifficulty(
  base: StrategyDifficultyAdjustment,
  context: TeachingStrategyContext,
): StrategyDifficultyAdjustment {
  if (
    context.evaluation.status === "correct" &&
    (context.consecutiveCorrectCount ?? 0) >= 2 &&
    (context.objectiveMastery ?? 0) >= 80
  ) {
    return "increase";
  }

  if (
    context.evaluation.status === "incorrect" &&
    ((context.recentIncorrectCount ?? 0) >= 2 ||
      (context.supportAlreadyGiven ?? 0) >= 2)
  ) {
    return "reduce";
  }

  return base;
}

function selectTone(
  evaluationTone: FeedbackTone,
  strategyId: TeachingStrategyId,
): FeedbackTone {
  if (
    strategyId === "affirm_and_advance" ||
    strategyId === "confirm_and_extend"
  ) {
    return "celebratory";
  }

  if (
    strategyId === "teacher_review" ||
    strategyId === "clarification_prompt"
  ) {
    return "supportive";
  }

  if (
    strategyId === "grammar_recast" ||
    strategyId === "grammar_micro_explanation" ||
    strategyId === "contrastive_explanation"
  ) {
    return "corrective";
  }

  return evaluationTone;
}

function buildAvoidList(
  strategyId: TeachingStrategyId,
): readonly string[] {
  const common = [
    "Do not shame the learner.",
    "Do not give several corrections at once.",
    "Do not use unnecessarily long explanations.",
  ];

  switch (strategyId) {
    case "single_hint":
    case "scaffolded_hint":
    case "guided_retry":
      return [
        ...common,
        "Do not reveal the full answer before the retry.",
      ];

    case "l1_brief_support":
      return [
        ...common,
        "Do not continue the whole interaction in L1.",
      ];

    case "affirm_and_advance":
      return [
        ...common,
        "Do not delay progression with extra explanation.",
      ];

    case "teacher_review":
      return [
        ...common,
        "Do not invent a confident judgment.",
      ];

    default:
      return common;
  }
}

function buildBoardFocus(
  context: TeachingStrategyContext,
  dominantError?: ResponseErrorCategory,
): string | undefined {
  if (dominantError) {
    return dominantError;
  }

  if (
    context.evaluation.matchedAnswer &&
    context.evaluation.status !== "correct"
  ) {
    return context.evaluation.matchedAnswer;
  }

  return context.objectiveId;
}

function buildBoardContent(
  context: TeachingStrategyContext,
  strategyId: TeachingStrategyId,
): string | undefined {
  if (
    strategyId === "model_then_practice" ||
    strategyId === "pronunciation_model"
  ) {
    return context.evaluation.matchedAnswer;
  }

  if (
    strategyId === "single_hint" ||
    strategyId === "scaffolded_hint" ||
    strategyId === "keyword_focus"
  ) {
    return context.evaluation.evidence[0];
  }

  return undefined;
}

function buildSuccessCondition(
  context: TeachingStrategyContext,
  strategyId: TeachingStrategyId,
): StrategySuccessCondition {
  if (
    strategyId === "affirm_and_advance" ||
    strategyId === "confirm_and_extend"
  ) {
    return {
      requiredStatus: ["correct"],
      minimumScore: context.evaluation.score,
      maximumAdditionalAttempts: 0,
    };
  }

  if (strategyId === "teacher_review") {
    return {
      requiredStatus: [],
      maximumAdditionalAttempts: 0,
      evidenceRequired: "Teacher review completed.",
    };
  }

  if (
    strategyId === "pronunciation_model" ||
    strategyId === "pronunciation_chunking" ||
    strategyId === "fluency_rehearsal"
  ) {
    return {
      requiredStatus: ["correct", "partially_correct"],
      minimumScore: 60,
      maximumAdditionalAttempts: 2,
      evidenceRequired:
        "Improved speech evidence from the learner's next attempt.",
    };
  }

  return {
    requiredStatus: ["correct", "partially_correct"],
    minimumScore: 60,
    maximumAdditionalAttempts:
      context.evaluation.diagnostics.maximumAttemptsReached ? 1 : 2,
  };
}

function calculateDecisionConfidence(
  selected: StrategyCandidate,
  candidates: readonly StrategyCandidate[],
  context: TeachingStrategyContext,
): Percentage {
  const sorted = [...candidates].sort(compareCandidates);
  const second = sorted[1];
  const margin = second
    ? Math.max(0, selected.score - second.score)
    : 20;
  const evaluationConfidence =
    context.evaluation.confidenceEstimate;
  const confidence =
    selected.score * 0.55 +
    evaluationConfidence * 0.35 +
    Math.min(20, margin) * 0.5;

  return clampPercentage(Math.round(confidence));
}

function shouldOfferL1(
  context: TeachingStrategyContext,
  defaultAllowsL1Support: boolean,
): boolean {
  const allowed =
    context.allowsL1Support ?? defaultAllowsL1Support;

  if (!allowed || !context.learnerL1) {
    return false;
  }

  if (context.evaluation.status === "correct") {
    return false;
  }

  return (
    (context.recentIncorrectCount ?? 0) >= 2 ||
    (context.supportAlreadyGiven ?? 0) >= 2
  );
}

function strategyFromDecision(
  decision: ResponseDecision,
): TeachingStrategyId {
  switch (decision) {
    case "continue":
    case "praise_and_continue":
      return "affirm_and_advance";

    case "ask_to_expand":
      return "confirm_and_extend";

    case "ask_to_retry":
      return "guided_retry";

    case "give_hint":
      return "single_hint";

    case "explain_again":
      return "simplified_reteach";

    case "model_answer":
      return "model_then_practice";

    case "switch_strategy":
      return "strategy_switch";

    case "request_clarification":
      return "clarification_prompt";

    case "provide_pronunciation_support":
      return "pronunciation_model";

    case "pause_for_teacher_review":
      return "teacher_review";

    default:
      return assertNever(decision);
  }
}

function allowsVoice(
  activityType: ResponseActivityType,
): boolean {
  return (
    activityType === "open_response" ||
    activityType === "short_answer" ||
    activityType === "vocabulary" ||
    activityType === "grammar" ||
    activityType === "reading_comprehension" ||
    activityType === "listening_comprehension" ||
    activityType === "speaking" ||
    activityType === "pronunciation"
  );
}

function allowsText(
  activityType: ResponseActivityType,
): boolean {
  return (
    activityType !== "pronunciation" &&
    activityType !== "speaking"
  );
}

function isPercentage(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

function clampPercentage(value: number): Percentage {
  return Math.max(0, Math.min(100, value));
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
