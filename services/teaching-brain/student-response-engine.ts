/**
 * ELVY Teaching Engine
 * TE-600 — Student Response Engine
 *
 * Deterministic, renderer-independent evaluation of learner responses.
 *
 * Responsibilities:
 * - Normalize learner answers.
 * - Compare answers with explicit evaluation criteria.
 * - Classify correctness and likely error categories.
 * - Estimate confidence and mastery evidence.
 * - Recommend the next educational action.
 * - Produce serializable results suitable for ClassroomEvents.
 *
 * Non-responsibilities:
 * - It does not render UI.
 * - It does not mutate ClassroomState.
 * - It does not call databases or external AI services.
 * - It does not directly advance lesson or scene state.
 */

import type {
  ClassroomIdentifier,
  InputMode,
  ISODateTime,
  Percentage,
  StudentAnswerStatus,
} from "./classroom-state";
import type {
  ClassroomEventMetadata,
  StudentAnswerEvaluatedEvent,
} from "./classroom-events";
import { createClassroomEvent } from "./classroom-events";

export type ResponseActivityType =
  | "open_response"
  | "short_answer"
  | "multiple_choice"
  | "true_false"
  | "matching"
  | "vocabulary"
  | "grammar"
  | "reading_comprehension"
  | "listening_comprehension"
  | "speaking"
  | "pronunciation"
  | "writing";

export type ResponseErrorCategory =
  | "none"
  | "empty"
  | "off_topic"
  | "comprehension"
  | "vocabulary"
  | "grammar"
  | "spelling"
  | "punctuation"
  | "word_order"
  | "pronunciation"
  | "fluency"
  | "incomplete"
  | "ambiguous"
  | "unknown";

export type ResponseDecision =
  | "continue"
  | "praise_and_continue"
  | "ask_to_expand"
  | "ask_to_retry"
  | "give_hint"
  | "explain_again"
  | "model_answer"
  | "switch_strategy"
  | "request_clarification"
  | "provide_pronunciation_support"
  | "pause_for_teacher_review";

export type FeedbackTone =
  | "neutral"
  | "warm"
  | "encouraging"
  | "celebratory"
  | "supportive"
  | "corrective";

export type ComparisonMode =
  | "exact"
  | "case_insensitive"
  | "normalized"
  | "contains_keywords"
  | "semantic_manual";

export interface StudentResponseInput {
  readonly responseId: ClassroomIdentifier;
  readonly studentId?: ClassroomIdentifier;
  readonly sessionId: ClassroomIdentifier;
  readonly lessonId: ClassroomIdentifier;
  readonly sceneId: ClassroomIdentifier;
  readonly objectiveId?: ClassroomIdentifier;
  readonly stepId?: ClassroomIdentifier;
  readonly answer: string;
  readonly inputMode: InputMode;
  readonly submittedAt: ISODateTime;
  readonly attemptNumber: number;
  readonly activityType: ResponseActivityType;
  readonly language?: string;
  readonly expectedAnswer?: string;
  readonly acceptedAnswers?: readonly string[];
  readonly requiredKeywords?: readonly string[];
  readonly optionalKeywords?: readonly string[];
  readonly forbiddenKeywords?: readonly string[];
  readonly criteria?: readonly ResponseCriterion[];
  readonly comparisonMode?: ComparisonMode;
  readonly minimumScore?: Percentage;
  readonly partialCreditThreshold?: Percentage;
  readonly maximumAttempts?: number;
  readonly speechEvidence?: SpeechEvidence;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ResponseCriterion {
  readonly id: ClassroomIdentifier;
  readonly description: string;
  readonly weight: number;
  readonly required: boolean;
  readonly evaluator: ResponseCriterionEvaluator;
}

export type ResponseCriterionEvaluator =
  | {
      readonly type: "contains";
      readonly value: string;
      readonly caseSensitive?: boolean;
    }
  | {
      readonly type: "equals";
      readonly value: string;
      readonly caseSensitive?: boolean;
    }
  | {
      readonly type: "matches";
      readonly pattern: string;
      readonly flags?: string;
    }
  | {
      readonly type: "minimum_words";
      readonly count: number;
    }
  | {
      readonly type: "maximum_words";
      readonly count: number;
    }
  | {
      readonly type: "manual";
      readonly score?: Percentage;
      readonly note?: string;
    };

export interface SpeechEvidence {
  readonly transcript?: string;
  readonly pronunciationScore?: Percentage;
  readonly fluencyScore?: Percentage;
  readonly completenessScore?: Percentage;
  readonly confidenceScore?: Percentage;
  readonly detectedLanguage?: string;
}

export interface CriterionResult {
  readonly criterionId: ClassroomIdentifier;
  readonly description: string;
  readonly passed: boolean;
  readonly score: Percentage;
  readonly weight: number;
  readonly required: boolean;
  readonly evidence?: string;
}

export interface StudentResponseEvaluation {
  readonly responseId: ClassroomIdentifier;
  readonly status: StudentAnswerStatus;
  readonly score: Percentage;
  readonly confidenceEstimate: Percentage;
  readonly masteryEvidence: Percentage;
  readonly decision: ResponseDecision;
  readonly feedbackTone: FeedbackTone;
  readonly feedback: string;
  readonly evidence: readonly string[];
  readonly errorCategories: readonly ResponseErrorCategory[];
  readonly criterionResults: readonly CriterionResult[];
  readonly matchedAnswer?: string;
  readonly normalizedAnswer: string;
  readonly shouldRecordMistake: boolean;
  readonly shouldRecordLearningEvidence: boolean;
  readonly shouldRequestSupport: boolean;
  readonly recommendedSupportLevel?: number;
  readonly nextAttemptNumber: number;
  readonly evaluatedAt: ISODateTime;
  readonly diagnostics: ResponseEvaluationDiagnostics;
}

export interface ResponseEvaluationDiagnostics {
  readonly engineVersion: string;
  readonly comparisonMode: ComparisonMode;
  readonly totalCriteria: number;
  readonly passedCriteria: number;
  readonly requiredCriteriaFailed: number;
  readonly answerWordCount: number;
  readonly answerCharacterCount: number;
  readonly maximumAttemptsReached: boolean;
  readonly rulesApplied: readonly string[];
}

export interface StudentResponseEngineOptions {
  readonly engineVersion?: string;
  readonly defaultMinimumScore?: Percentage;
  readonly defaultPartialCreditThreshold?: Percentage;
  readonly defaultMaximumAttempts?: number;
  readonly spellingTolerance?: number;
  readonly now?: () => ISODateTime;
}

export interface EvaluationEventInput {
  readonly eventId: ClassroomIdentifier;
  readonly sequence: number;
  readonly evaluation: StudentResponseEvaluation;
  readonly metadata?: ClassroomEventMetadata;
}

const DEFAULT_OPTIONS: Required<StudentResponseEngineOptions> = {
  engineVersion: "1.0.0",
  defaultMinimumScore: 80,
  defaultPartialCreditThreshold: 40,
  defaultMaximumAttempts: 3,
  spellingTolerance: 1,
  now: () => new Date().toISOString(),
};

export class StudentResponseEngine {
  private readonly options: Required<StudentResponseEngineOptions>;

  public constructor(options: StudentResponseEngineOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    validatePercentageOption(
      "defaultMinimumScore",
      this.options.defaultMinimumScore,
    );
    validatePercentageOption(
      "defaultPartialCreditThreshold",
      this.options.defaultPartialCreditThreshold,
    );

    if (this.options.defaultMaximumAttempts < 1) {
      throw new Error("defaultMaximumAttempts must be at least 1.");
    }

    if (this.options.spellingTolerance < 0) {
      throw new Error("spellingTolerance cannot be negative.");
    }
  }

  public evaluate(input: StudentResponseInput): StudentResponseEvaluation {
    const validationErrors = validateStudentResponseInput(input);

    if (validationErrors.length > 0) {
      throw new Error(
        `Cannot evaluate invalid student response: ${validationErrors.join(" ")}`,
      );
    }

    const evaluatedAt = this.options.now();
    const normalizedAnswer = normalizeAnswer(input.answer);
    const maximumAttempts =
      input.maximumAttempts ?? this.options.defaultMaximumAttempts;
    const minimumScore =
      input.minimumScore ?? this.options.defaultMinimumScore;
    const partialCreditThreshold =
      input.partialCreditThreshold ??
      this.options.defaultPartialCreditThreshold;
    const comparisonMode =
      input.comparisonMode ?? inferComparisonMode(input);
    const rulesApplied: string[] = [];

    if (!normalizedAnswer) {
      return Object.freeze({
        responseId: input.responseId,
        status: "unclear",
        score: 0,
        confidenceEstimate: 100,
        masteryEvidence: 0,
        decision: "request_clarification",
        feedbackTone: "supportive",
        feedback: "Please give an answer so I can help you.",
        evidence: Object.freeze(["The submitted answer was empty."]),
        errorCategories: Object.freeze(["empty"] as const),
        criterionResults: Object.freeze([]),
        normalizedAnswer,
        shouldRecordMistake: false,
        shouldRecordLearningEvidence: false,
        shouldRequestSupport: true,
        recommendedSupportLevel: 1,
        nextAttemptNumber: input.attemptNumber + 1,
        evaluatedAt,
        diagnostics: Object.freeze({
          engineVersion: this.options.engineVersion,
          comparisonMode,
          totalCriteria: 0,
          passedCriteria: 0,
          requiredCriteriaFailed: 0,
          answerWordCount: 0,
          answerCharacterCount: 0,
          maximumAttemptsReached:
            input.attemptNumber >= maximumAttempts,
          rulesApplied: Object.freeze(["empty_answer_rule"]),
        }),
      });
    }

    const criterionResults = evaluateCriteria(input, normalizedAnswer);
    const answerComparison = evaluateAcceptedAnswers(
      input,
      normalizedAnswer,
      comparisonMode,
      this.options.spellingTolerance,
    );
    const keywordEvaluation = evaluateKeywords(input, normalizedAnswer);
    const speechEvaluation = evaluateSpeech(input.speechEvidence);

    const scoreComponents: WeightedScore[] = [];

    if (answerComparison.available) {
      scoreComponents.push({
        score: answerComparison.score,
        weight: 5,
        rule: "accepted_answer_comparison",
      });
      rulesApplied.push("accepted_answer_comparison");
    }

    if (keywordEvaluation.available) {
      scoreComponents.push({
        score: keywordEvaluation.score,
        weight: 3,
        rule: "keyword_coverage",
      });
      rulesApplied.push("keyword_coverage");
    }

    if (criterionResults.length > 0) {
      scoreComponents.push({
        score: weightedCriterionScore(criterionResults),
        weight: 5,
        rule: "explicit_criteria",
      });
      rulesApplied.push("explicit_criteria");
    }

    if (speechEvaluation.available) {
      scoreComponents.push({
        score: speechEvaluation.score,
        weight: 3,
        rule: "speech_evidence",
      });
      rulesApplied.push("speech_evidence");
    }

    if (scoreComponents.length === 0) {
      scoreComponents.push({
        score: openResponseBaseline(input, normalizedAnswer),
        weight: 1,
        rule: "open_response_baseline",
      });
      rulesApplied.push("open_response_baseline");
    }

    const score = roundPercentage(weightedAverage(scoreComponents));
    const requiredCriteriaFailed = criterionResults.filter(
      (criterion) => criterion.required && !criterion.passed,
    ).length;
    const forbiddenKeywordFound = keywordEvaluation.forbiddenMatches.length > 0;
    const status = classifyStatus({
      score,
      minimumScore,
      partialCreditThreshold,
      requiredCriteriaFailed,
      forbiddenKeywordFound,
    });
    const errorCategories = classifyErrors({
      input,
      normalizedAnswer,
      status,
      answerComparison,
      keywordEvaluation,
      speechEvaluation,
      criterionResults,
    });
    const maximumAttemptsReached = input.attemptNumber >= maximumAttempts;
    const decision = chooseDecision({
      status,
      attemptNumber: input.attemptNumber,
      maximumAttempts,
      errorCategories,
      score,
    });
    const confidenceEstimate = estimateConfidence({
      scoreComponents,
      answerComparison,
      criterionResults,
      speechEvidence: input.speechEvidence,
    });
    const masteryEvidence = calculateMasteryEvidence({
      status,
      score,
      attemptNumber: input.attemptNumber,
      confidenceEstimate,
    });
    const feedbackTone = chooseFeedbackTone(status, decision);
    const feedback = buildFeedback({
      status,
      decision,
      errorCategories,
      matchedAnswer: answerComparison.matchedAnswer,
      maximumAttemptsReached,
    });
    const evidence = buildEvidence({
      answerComparison,
      keywordEvaluation,
      criterionResults,
      speechEvaluation,
      score,
    });

    return Object.freeze({
      responseId: input.responseId,
      status,
      score,
      confidenceEstimate,
      masteryEvidence,
      decision,
      feedbackTone,
      feedback,
      evidence: Object.freeze(evidence),
      errorCategories: Object.freeze(errorCategories),
      criterionResults: Object.freeze(criterionResults),
      matchedAnswer: answerComparison.matchedAnswer,
      normalizedAnswer,
      shouldRecordMistake:
        status === "incorrect" || status === "partially_correct",
      shouldRecordLearningEvidence:
        status === "correct" || status === "partially_correct",
      shouldRequestSupport:
        decision === "give_hint" ||
        decision === "explain_again" ||
        decision === "model_answer" ||
        decision === "switch_strategy" ||
        decision === "provide_pronunciation_support",
      recommendedSupportLevel: supportLevelForDecision(decision),
      nextAttemptNumber: input.attemptNumber + 1,
      evaluatedAt,
      diagnostics: Object.freeze({
        engineVersion: this.options.engineVersion,
        comparisonMode,
        totalCriteria: criterionResults.length,
        passedCriteria: criterionResults.filter((result) => result.passed)
          .length,
        requiredCriteriaFailed,
        answerWordCount: countWords(normalizedAnswer),
        answerCharacterCount: normalizedAnswer.length,
        maximumAttemptsReached,
        rulesApplied: Object.freeze(rulesApplied),
      }),
    });
  }

  public createEvaluationEvent(
    input: StudentResponseInput,
    eventInput: EvaluationEventInput,
  ): StudentAnswerEvaluatedEvent {
    const evaluation = eventInput.evaluation;

    return createClassroomEvent({
      id: eventInput.eventId,
      type: "STUDENT_ANSWER_EVALUATED",
      source: "student_response_engine",
      sessionId: input.sessionId,
      occurredAt: evaluation.evaluatedAt,
      sequence: eventInput.sequence,
      payload: {
        status: evaluation.status,
        confidenceEstimate: evaluation.confidenceEstimate,
        feedback: evaluation.feedback,
        evidence: evaluation.evidence,
      },
      metadata: {
        ...eventInput.metadata,
        lessonId: input.lessonId,
        sceneId: input.sceneId,
        objectiveId: input.objectiveId,
        stepId: input.stepId,
        attemptNumber: input.attemptNumber,
        correlationId:
          eventInput.metadata?.correlationId ?? input.responseId,
      },
    });
  }
}

export function validateStudentResponseInput(
  input: StudentResponseInput,
): readonly string[] {
  const errors: string[] = [];

  if (!input.responseId.trim()) errors.push("responseId is required.");
  if (!input.sessionId.trim()) errors.push("sessionId is required.");
  if (!input.lessonId.trim()) errors.push("lessonId is required.");
  if (!input.sceneId.trim()) errors.push("sceneId is required.");
  if (!input.submittedAt.trim()) errors.push("submittedAt is required.");
  if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1) {
    errors.push("attemptNumber must be a positive integer.");
  }
  if (input.inputMode === "none") {
    errors.push("inputMode cannot be none for a submitted response.");
  }
  if (
    input.minimumScore !== undefined &&
    !isPercentage(input.minimumScore)
  ) {
    errors.push("minimumScore must be from 0 to 100.");
  }
  if (
    input.partialCreditThreshold !== undefined &&
    !isPercentage(input.partialCreditThreshold)
  ) {
    errors.push("partialCreditThreshold must be from 0 to 100.");
  }
  if (
    input.minimumScore !== undefined &&
    input.partialCreditThreshold !== undefined &&
    input.partialCreditThreshold > input.minimumScore
  ) {
    errors.push(
      "partialCreditThreshold cannot be greater than minimumScore.",
    );
  }
  if (
    input.maximumAttempts !== undefined &&
    (!Number.isInteger(input.maximumAttempts) || input.maximumAttempts < 1)
  ) {
    errors.push("maximumAttempts must be a positive integer.");
  }

  for (const criterion of input.criteria ?? []) {
    if (!criterion.id.trim()) {
      errors.push("Every criterion must have an id.");
    }
    if (!criterion.description.trim()) {
      errors.push(`Criterion "${criterion.id}" needs a description.`);
    }
    if (!Number.isFinite(criterion.weight) || criterion.weight <= 0) {
      errors.push(`Criterion "${criterion.id}" weight must be positive.`);
    }
  }

  return errors;
}

function evaluateCriteria(
  input: StudentResponseInput,
  normalizedAnswer: string,
): CriterionResult[] {
  return (input.criteria ?? []).map((criterion) => {
    const outcome = evaluateCriterion(
      criterion,
      input.answer,
      normalizedAnswer,
    );

    return Object.freeze({
      criterionId: criterion.id,
      description: criterion.description,
      passed: outcome.score >= 80,
      score: outcome.score,
      weight: criterion.weight,
      required: criterion.required,
      evidence: outcome.evidence,
    });
  });
}

function evaluateCriterion(
  criterion: ResponseCriterion,
  rawAnswer: string,
  normalizedAnswer: string,
): { readonly score: Percentage; readonly evidence?: string } {
  const evaluator = criterion.evaluator;

  switch (evaluator.type) {
    case "contains": {
      const source = evaluator.caseSensitive
        ? rawAnswer
        : rawAnswer.toLocaleLowerCase();
      const expected = evaluator.caseSensitive
        ? evaluator.value
        : evaluator.value.toLocaleLowerCase();
      const passed = source.includes(expected);
      return {
        score: passed ? 100 : 0,
        evidence: passed
          ? `Contains "${evaluator.value}".`
          : `Does not contain "${evaluator.value}".`,
      };
    }

    case "equals": {
      const source = evaluator.caseSensitive
        ? rawAnswer.trim()
        : normalizeAnswer(rawAnswer);
      const expected = evaluator.caseSensitive
        ? evaluator.value.trim()
        : normalizeAnswer(evaluator.value);
      const passed = source === expected;
      return {
        score: passed ? 100 : 0,
        evidence: passed
          ? "Matches the expected answer."
          : "Does not match the expected answer.",
      };
    }

    case "matches": {
      try {
        const regex = new RegExp(evaluator.pattern, evaluator.flags);
        const passed = regex.test(rawAnswer);
        return {
          score: passed ? 100 : 0,
          evidence: passed
            ? "Matches the required pattern."
            : "Does not match the required pattern.",
        };
      } catch {
        return {
          score: 0,
          evidence: "The criterion contains an invalid pattern.",
        };
      }
    }

    case "minimum_words": {
      const count = countWords(normalizedAnswer);
      const score = clampPercentage(
        (count / Math.max(1, evaluator.count)) * 100,
      );
      return {
        score,
        evidence: `${count} of at least ${evaluator.count} words supplied.`,
      };
    }

    case "maximum_words": {
      const count = countWords(normalizedAnswer);
      return {
        score: count <= evaluator.count ? 100 : 0,
        evidence: `${count} words supplied; maximum is ${evaluator.count}.`,
      };
    }

    case "manual":
      return {
        score: evaluator.score ?? 50,
        evidence: evaluator.note ?? "Manual evaluation pending.",
      };

    default:
      return assertNever(evaluator);
  }
}

interface AnswerComparison {
  readonly available: boolean;
  readonly score: Percentage;
  readonly matchedAnswer?: string;
  readonly exactMatch: boolean;
  readonly nearMatch: boolean;
}

function evaluateAcceptedAnswers(
  input: StudentResponseInput,
  normalizedAnswer: string,
  mode: ComparisonMode,
  spellingTolerance: number,
): AnswerComparison {
  const accepted = uniqueStrings([
    ...(input.expectedAnswer ? [input.expectedAnswer] : []),
    ...(input.acceptedAnswers ?? []),
  ]);

  if (accepted.length === 0 || mode === "semantic_manual") {
    return {
      available: false,
      score: 0,
      exactMatch: false,
      nearMatch: false,
    };
  }

  let bestScore = 0;
  let matchedAnswer: string | undefined;
  let exactMatch = false;
  let nearMatch = false;

  for (const candidate of accepted) {
    const comparison = compareAnswer(
      input.answer,
      normalizedAnswer,
      candidate,
      mode,
      spellingTolerance,
    );

    if (comparison.score > bestScore) {
      bestScore = comparison.score;
      matchedAnswer = candidate;
      exactMatch = comparison.exactMatch;
      nearMatch = comparison.nearMatch;
    }
  }

  return {
    available: true,
    score: bestScore,
    matchedAnswer,
    exactMatch,
    nearMatch,
  };
}

function compareAnswer(
  rawAnswer: string,
  normalizedAnswer: string,
  candidate: string,
  mode: ComparisonMode,
  spellingTolerance: number,
): {
  readonly score: Percentage;
  readonly exactMatch: boolean;
  readonly nearMatch: boolean;
} {
  const normalizedCandidate = normalizeAnswer(candidate);

  switch (mode) {
    case "exact": {
      const exact = rawAnswer.trim() === candidate.trim();
      return { score: exact ? 100 : 0, exactMatch: exact, nearMatch: false };
    }

    case "case_insensitive": {
      const exact =
        rawAnswer.trim().toLocaleLowerCase() ===
        candidate.trim().toLocaleLowerCase();
      return { score: exact ? 100 : 0, exactMatch: exact, nearMatch: false };
    }

    case "contains_keywords": {
      const candidateWords = tokenize(normalizedCandidate);
      if (candidateWords.length === 0) {
        return { score: 0, exactMatch: false, nearMatch: false };
      }
      const answerWords = new Set(tokenize(normalizedAnswer));
      const matched = candidateWords.filter((word) => answerWords.has(word));
      const score = clampPercentage(
        (matched.length / candidateWords.length) * 100,
      );
      return {
        score,
        exactMatch: score === 100,
        nearMatch: score >= 70 && score < 100,
      };
    }

    case "normalized": {
      if (normalizedAnswer === normalizedCandidate) {
        return { score: 100, exactMatch: true, nearMatch: false };
      }

      const distance = levenshteinDistance(
        normalizedAnswer,
        normalizedCandidate,
      );
      const longest = Math.max(
        normalizedAnswer.length,
        normalizedCandidate.length,
        1,
      );
      const similarity = clampPercentage((1 - distance / longest) * 100);
      const nearMatch = distance <= spellingTolerance || similarity >= 85;
      return {
        score: nearMatch ? Math.max(75, similarity) : similarity,
        exactMatch: false,
        nearMatch,
      };
    }

    case "semantic_manual":
      return { score: 0, exactMatch: false, nearMatch: false };

    default:
      return assertNever(mode);
  }
}

interface KeywordEvaluation {
  readonly available: boolean;
  readonly score: Percentage;
  readonly requiredMatches: readonly string[];
  readonly missingRequired: readonly string[];
  readonly optionalMatches: readonly string[];
  readonly forbiddenMatches: readonly string[];
}

function evaluateKeywords(
  input: StudentResponseInput,
  normalizedAnswer: string,
): KeywordEvaluation {
  const required = uniqueStrings(input.requiredKeywords ?? []);
  const optional = uniqueStrings(input.optionalKeywords ?? []);
  const forbidden = uniqueStrings(input.forbiddenKeywords ?? []);
  const hasAny = required.length + optional.length + forbidden.length > 0;

  if (!hasAny) {
    return {
      available: false,
      score: 0,
      requiredMatches: [],
      missingRequired: [],
      optionalMatches: [],
      forbiddenMatches: [],
    };
  }

  const includes = (keyword: string): boolean =>
    normalizedAnswer.includes(normalizeAnswer(keyword));
  const requiredMatches = required.filter(includes);
  const missingRequired = required.filter((keyword) => !includes(keyword));
  const optionalMatches = optional.filter(includes);
  const forbiddenMatches = forbidden.filter(includes);

  const requiredScore =
    required.length === 0
      ? 100
      : (requiredMatches.length / required.length) * 100;
  const optionalBonus =
    optional.length === 0
      ? 0
      : (optionalMatches.length / optional.length) * 10;
  const forbiddenPenalty = forbiddenMatches.length * 30;

  return {
    available: true,
    score: clampPercentage(
      requiredScore + optionalBonus - forbiddenPenalty,
    ),
    requiredMatches,
    missingRequired,
    optionalMatches,
    forbiddenMatches,
  };
}

interface SpeechEvaluationResult {
  readonly available: boolean;
  readonly score: Percentage;
  readonly pronunciationScore?: Percentage;
  readonly fluencyScore?: Percentage;
}

function evaluateSpeech(
  evidence?: SpeechEvidence,
): SpeechEvaluationResult {
  if (!evidence) {
    return { available: false, score: 0 };
  }

  const scores = [
    evidence.pronunciationScore,
    evidence.fluencyScore,
    evidence.completenessScore,
  ].filter((score): score is Percentage => score !== undefined);

  if (scores.length === 0) {
    return { available: false, score: 0 };
  }

  return {
    available: true,
    score: roundPercentage(
      scores.reduce((sum, score) => sum + score, 0) / scores.length,
    ),
    pronunciationScore: evidence.pronunciationScore,
    fluencyScore: evidence.fluencyScore,
  };
}

function classifyStatus(input: {
  readonly score: Percentage;
  readonly minimumScore: Percentage;
  readonly partialCreditThreshold: Percentage;
  readonly requiredCriteriaFailed: number;
  readonly forbiddenKeywordFound: boolean;
}): StudentAnswerStatus {
  if (
    input.score >= input.minimumScore &&
    input.requiredCriteriaFailed === 0 &&
    !input.forbiddenKeywordFound
  ) {
    return "correct";
  }

  if (input.score >= input.partialCreditThreshold) {
    return "partially_correct";
  }

  return "incorrect";
}

function classifyErrors(input: {
  readonly input: StudentResponseInput;
  readonly normalizedAnswer: string;
  readonly status: StudentAnswerStatus;
  readonly answerComparison: AnswerComparison;
  readonly keywordEvaluation: KeywordEvaluation;
  readonly speechEvaluation: SpeechEvaluationResult;
  readonly criterionResults: readonly CriterionResult[];
}): ResponseErrorCategory[] {
  if (input.status === "correct") return ["none"];

  const categories = new Set<ResponseErrorCategory>();

  if (input.answerComparison.nearMatch) categories.add("spelling");
  if (input.keywordEvaluation.missingRequired.length > 0) {
    categories.add("incomplete");
  }
  if (input.keywordEvaluation.forbiddenMatches.length > 0) {
    categories.add("comprehension");
  }
  if (input.input.activityType === "grammar") {
    categories.add("grammar");
  }
  if (input.input.activityType === "vocabulary") {
    categories.add("vocabulary");
  }
  if (
    input.input.activityType === "reading_comprehension" ||
    input.input.activityType === "listening_comprehension"
  ) {
    categories.add("comprehension");
  }
  if (
    input.input.activityType === "pronunciation" &&
    (input.speechEvaluation.pronunciationScore ?? 100) < 70
  ) {
    categories.add("pronunciation");
  }
  if (
    input.input.activityType === "speaking" &&
    (input.speechEvaluation.fluencyScore ?? 100) < 70
  ) {
    categories.add("fluency");
  }
  if (
    input.criterionResults.some(
      (criterion) =>
        !criterion.passed &&
        criterion.description.toLocaleLowerCase().includes("word order"),
    )
  ) {
    categories.add("word_order");
  }
  if (categories.size === 0) categories.add("unknown");

  return [...categories];
}

function chooseDecision(input: {
  readonly status: StudentAnswerStatus;
  readonly attemptNumber: number;
  readonly maximumAttempts: number;
  readonly errorCategories: readonly ResponseErrorCategory[];
  readonly score: Percentage;
}): ResponseDecision {
  if (input.status === "correct") {
    return input.attemptNumber === 1
      ? "praise_and_continue"
      : "continue";
  }

  if (input.status === "unclear") return "request_clarification";

  if (input.errorCategories.includes("pronunciation")) {
    return "provide_pronunciation_support";
  }

  if (input.status === "partially_correct" && input.score >= 65) {
    return "ask_to_expand";
  }

  if (input.attemptNumber >= input.maximumAttempts) {
    return "model_answer";
  }

  if (input.attemptNumber === 1) return "give_hint";
  if (input.attemptNumber === 2) return "explain_again";
  return "switch_strategy";
}

function chooseFeedbackTone(
  status: StudentAnswerStatus,
  decision: ResponseDecision,
): FeedbackTone {
  if (status === "correct") return "celebratory";
  if (decision === "request_clarification") return "supportive";
  if (decision === "model_answer") return "corrective";
  if (status === "partially_correct") return "encouraging";
  return "warm";
}

function buildFeedback(input: {
  readonly status: StudentAnswerStatus;
  readonly decision: ResponseDecision;
  readonly errorCategories: readonly ResponseErrorCategory[];
  readonly matchedAnswer?: string;
  readonly maximumAttemptsReached: boolean;
}): string {
  if (input.status === "correct") {
    return "Well done. Your answer is correct.";
  }

  if (input.decision === "ask_to_expand") {
    return "Good start. Add one more detail to complete your answer.";
  }

  if (input.decision === "request_clarification") {
    return "I did not understand the answer clearly. Please try again.";
  }

  if (input.decision === "provide_pronunciation_support") {
    return "Good effort. Let us practise the pronunciation together.";
  }

  if (input.decision === "give_hint") {
    return "Not quite yet. I will give you a small hint, then you can try again.";
  }

  if (input.decision === "explain_again") {
    return "Let us look at the idea again in an easier way.";
  }

  if (input.decision === "model_answer") {
    return input.matchedAnswer
      ? `Let us learn from this model answer: ${input.matchedAnswer}`
      : "Let us study a model answer together.";
  }

  if (input.maximumAttemptsReached) {
    return "You made a good effort. Let us change the strategy and try another way.";
  }

  if (input.errorCategories.includes("spelling")) {
    return "Your idea is close. Check the spelling and try once more.";
  }

  return "Good effort. Think carefully and try again.";
}

function buildEvidence(input: {
  readonly answerComparison: AnswerComparison;
  readonly keywordEvaluation: KeywordEvaluation;
  readonly criterionResults: readonly CriterionResult[];
  readonly speechEvaluation: SpeechEvaluationResult;
  readonly score: Percentage;
}): string[] {
  const evidence: string[] = [`Overall response score: ${input.score}%.`];

  if (input.answerComparison.available) {
    evidence.push(
      input.answerComparison.exactMatch
        ? "The answer matched an accepted answer."
        : `Accepted-answer similarity score: ${input.answerComparison.score}%.`,
    );
  }

  if (input.keywordEvaluation.available) {
    if (input.keywordEvaluation.requiredMatches.length > 0) {
      evidence.push(
        `Required ideas found: ${input.keywordEvaluation.requiredMatches.join(", ")}.`,
      );
    }
    if (input.keywordEvaluation.missingRequired.length > 0) {
      evidence.push(
        `Required ideas missing: ${input.keywordEvaluation.missingRequired.join(", ")}.`,
      );
    }
  }

  for (const criterion of input.criterionResults) {
    if (criterion.evidence) evidence.push(criterion.evidence);
  }

  if (input.speechEvaluation.available) {
    evidence.push(
      `Speech evidence score: ${input.speechEvaluation.score}%.`,
    );
  }

  return evidence;
}

interface WeightedScore {
  readonly score: Percentage;
  readonly weight: number;
  readonly rule: string;
}

function weightedAverage(scores: readonly WeightedScore[]): number {
  const totalWeight = scores.reduce((sum, score) => sum + score.weight, 0);
  if (totalWeight === 0) return 0;
  return (
    scores.reduce(
      (sum, component) => sum + component.score * component.weight,
      0,
    ) / totalWeight
  );
}

function weightedCriterionScore(
  results: readonly CriterionResult[],
): Percentage {
  const totalWeight = results.reduce((sum, result) => sum + result.weight, 0);
  if (totalWeight === 0) return 0;
  return roundPercentage(
    results.reduce(
      (sum, result) => sum + result.score * result.weight,
      0,
    ) / totalWeight,
  );
}

function openResponseBaseline(
  input: StudentResponseInput,
  normalizedAnswer: string,
): Percentage {
  const words = countWords(normalizedAnswer);

  switch (input.activityType) {
    case "open_response":
    case "writing":
      return words >= 5 ? 70 : words >= 2 ? 50 : 30;

    case "speaking":
      return words >= 3 ? 65 : 40;

    default:
      return words >= 1 ? 50 : 0;
  }
}

function estimateConfidence(input: {
  readonly scoreComponents: readonly WeightedScore[];
  readonly answerComparison: AnswerComparison;
  readonly criterionResults: readonly CriterionResult[];
  readonly speechEvidence?: SpeechEvidence;
}): Percentage {
  let confidence = 45;

  if (input.answerComparison.available) confidence += 25;
  if (input.criterionResults.length > 0) confidence += 20;
  if (input.speechEvidence?.confidenceScore !== undefined) {
    confidence =
      confidence * 0.6 + input.speechEvidence.confidenceScore * 0.4;
  }
  if (input.scoreComponents.length >= 3) confidence += 10;

  return roundPercentage(clampPercentage(confidence));
}

function calculateMasteryEvidence(input: {
  readonly status: StudentAnswerStatus;
  readonly score: Percentage;
  readonly attemptNumber: number;
  readonly confidenceEstimate: Percentage;
}): Percentage {
  const attemptFactor = Math.max(0.6, 1 - (input.attemptNumber - 1) * 0.1);
  const statusFactor =
    input.status === "correct"
      ? 1
      : input.status === "partially_correct"
        ? 0.65
        : 0.25;

  return roundPercentage(
    clampPercentage(
      input.score *
        statusFactor *
        attemptFactor *
        (0.75 + input.confidenceEstimate / 400),
    ),
  );
}

function supportLevelForDecision(
  decision: ResponseDecision,
): number | undefined {
  switch (decision) {
    case "give_hint":
    case "provide_pronunciation_support":
      return 1;
    case "explain_again":
    case "ask_to_expand":
      return 2;
    case "model_answer":
    case "switch_strategy":
      return 3;
    default:
      return undefined;
  }
}

function inferComparisonMode(input: StudentResponseInput): ComparisonMode {
  if ((input.requiredKeywords?.length ?? 0) > 0) {
    return "contains_keywords";
  }

  if (input.activityType === "open_response" || input.activityType === "writing") {
    return "semantic_manual";
  }

  return "normalized";
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeAnswer(value).split(" ").filter(Boolean);
}

function countWords(value: string): number {
  return tokenize(value).length;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }

    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function clampPercentage(value: number): Percentage {
  return Math.min(100, Math.max(0, value));
}

function roundPercentage(value: number): Percentage {
  return Math.round(clampPercentage(value) * 100) / 100;
}

function isPercentage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function validatePercentageOption(name: string, value: number): void {
  if (!isPercentage(value)) {
    throw new Error(`${name} must be from 0 to 100.`);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled student-response value: ${String(value)}`);
}
