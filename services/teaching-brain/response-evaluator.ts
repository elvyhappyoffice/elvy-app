/**
 * Elvy Teaching Brain
 * Learner response evaluator
 *
 * File: services/teaching-brain/response-evaluator.ts
 *
 * Responsibilities:
 * - validate learner turns against the active lesson activity
 * - perform deterministic answer, keyword, choice, spelling, and relevance checks
 * - combine optional AI/voice evaluation signals with deterministic evidence
 * - classify the learner response
 * - produce a normalized ResponseEvaluation for the Decision Engine
 *
 * Deliberately excluded:
 * - selecting the next teaching action (decision-engine.ts)
 * - mutating teaching session state (session-engine.ts)
 * - generating clues or corrections (support-engine.ts)
 */

import type {
  CorrectionFocus,
  EvaluatedError,
  EvaluationEvidence,
  EvaluationGrade,
  ExpectedResponse,
  FluencyGrade,
  LanguageCode,
  LearnerResponseStatus,
  LearnerTurn,
  PronunciationGrade,
  ResponseEvaluation,
  ResponseEvaluationFocus,
  TeachingActivity,
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
  TeachingStage,
} from "./types";

import {
  normalizeConfidence,
  normalizeScore,
} from "./types";

/* -------------------------------------------------------------------------- */
/*                               Public Types                                 */
/* -------------------------------------------------------------------------- */

export type ResponseEvaluatorMode =
  | "deterministic"
  | "hybrid"
  | "provider_only";

export type SemanticEvaluationInput = {
  lesson: TeachingBrainLesson;
  stage: TeachingStage;
  activity: TeachingActivity;
  learnerTurn: LearnerTurn;
  normalizedResponse: string;
  expectedResponses: ExpectedResponse[];
};

export type SemanticEvaluationResult = {
  score: number;
  confidence: number;
  equivalentMeaning: boolean;
  offTopic: boolean;
  matchedExpectedResponseId?: string;
  positiveEvidence?: string[];
  missingMeaning?: string[];
  explanation?: string;
  detectedErrors?: EvaluatedError[];
};

export type LanguageEvaluationInput = {
  lesson: TeachingBrainLesson;
  stage: TeachingStage;
  activity: TeachingActivity;
  learnerTurn: LearnerTurn;
  normalizedResponse: string;
  expectedResponses: ExpectedResponse[];
};

export type LanguageEvaluationResult = {
  grammar?: EvaluationGrade;
  vocabulary?: EvaluationGrade;
  spelling?: EvaluationGrade;
  punctuation?: EvaluationGrade;
  fluency?: FluencyGrade;
  score?: number;
  confidence?: number;
  errors?: EvaluatedError[];
  positiveEvidence?: string[];
  explanation?: string;
};

export type PronunciationEvaluationInput = {
  lesson: TeachingBrainLesson;
  stage: TeachingStage;
  activity: TeachingActivity;
  learnerTurn: LearnerTurn;
  normalizedResponse: string;
  expectedResponses: ExpectedResponse[];
};

export type PronunciationEvaluationResult = {
  grade: PronunciationGrade;
  score: number;
  confidence: number;
  errors?: EvaluatedError[];
  positiveEvidence?: string[];
  explanation?: string;
};

export interface ResponseEvaluationProvider {
  evaluateSemantic?(
    input: SemanticEvaluationInput,
  ): Promise<SemanticEvaluationResult>;

  evaluateLanguage?(
    input: LanguageEvaluationInput,
  ): Promise<LanguageEvaluationResult>;

  evaluatePronunciation?(
    input: PronunciationEvaluationInput,
  ): Promise<PronunciationEvaluationResult>;
}

export type ResponseEvaluatorConfig = {
  mode?: ResponseEvaluatorMode;

  provider?: ResponseEvaluationProvider;

  semanticWeight?: number;
  exactAnswerWeight?: number;
  keywordWeight?: number;
  languageAccuracyWeight?: number;
  pronunciationWeight?: number;

  correctThreshold?: number;
  mostlyCorrectThreshold?: number;
  partlyCorrectThreshold?: number;

  minimumResponseCharacters?: number;
  noResponseTimeoutMs?: number;
  helpRequestPhrases?: string[];
  offTopicMinimumConfidence?: number;

  enableHeuristicLanguageChecks?: boolean;
  enableHeuristicFluencyChecks?: boolean;
  enableAutomaticCorrectionRecommendation?: boolean;

  now?: () => string;
};

export type EvaluateResponseInput = {
  lesson: TeachingBrainLesson;
  learnerTurn: LearnerTurn;

  stage?: TeachingStage;
  activity?: TeachingActivity;

  expectedResponseId?: string;

  previousEvaluations?: ResponseEvaluation[];

  metadata?: Record<string, unknown>;
};

export type ResponseEvaluationBreakdown = {
  exactAnswerScore: number;
  acceptableAnswerScore: number;
  keywordScore: number;
  semanticScore: number;
  languageScore: number;
  pronunciationScore: number;
  relevanceScore: number;
  completenessScore: number;
};

export type DetailedResponseEvaluation = {
  evaluation: ResponseEvaluation;
  breakdown: ResponseEvaluationBreakdown;
  normalizedResponse: string;
  matchedExpectedResponse?: ExpectedResponse;
  diagnostics: string[];
};

export type SafeEvaluationResult =
  TeachingBrainResult<DetailedResponseEvaluation>;

export type ResponseEvaluatorErrorCode =
  | "INVALID_INPUT"
  | "STAGE_NOT_FOUND"
  | "ACTIVITY_NOT_FOUND"
  | "TURN_CONTEXT_MISMATCH"
  | "EXPECTED_RESPONSE_NOT_FOUND"
  | "UNSUPPORTED_MODALITY"
  | "PROVIDER_REQUIRED"
  | "PROVIDER_FAILED"
  | "EVALUATION_FAILED";

export class ResponseEvaluatorError extends Error {
  readonly code: ResponseEvaluatorErrorCode;
  readonly details?: Record<string, unknown>;
  readonly recoverable: boolean;

  constructor(
    code: ResponseEvaluatorErrorCode,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      recoverable?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "ResponseEvaluatorError";
    this.code = code;
    this.details = options?.details;
    this.recoverable = options?.recoverable ?? true;
  }
}

/* -------------------------------------------------------------------------- */
/*                              Internal Types                                */
/* -------------------------------------------------------------------------- */

type DeterministicMatch = {
  expected?: ExpectedResponse;
  exactScore: number;
  acceptableScore: number;
  keywordScore: number;
  semanticProxyScore: number;
  completenessScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  incorrectKeywords: string[];
  positiveEvidence: string[];
  errors: EvaluatedError[];
  explanation?: string;
};

type SpecialResponseClassification =
  | "no_response"
  | "help_requested"
  | "off_topic"
  | "unclear"
  | undefined;

type GradeBundle = {
  meaning: EvaluationGrade;
  grammar: EvaluationGrade;
  vocabulary: EvaluationGrade;
  pronunciation: PronunciationGrade;
  fluency: FluencyGrade;
  spelling: EvaluationGrade;
  punctuation: EvaluationGrade;
};

/* -------------------------------------------------------------------------- */
/*                             Default Settings                               */
/* -------------------------------------------------------------------------- */

const DEFAULT_HELP_REQUEST_PHRASES = [
  "help",
  "help me",
  "i need help",
  "i don't know",
  "i do not know",
  "i don't understand",
  "i do not understand",
  "can you explain",
  "please explain",
  "what does it mean",
  "what should i say",
  "give me a clue",
  "give me a hint",
  "aide-moi",
  "je ne sais pas",
  "je ne comprends pas",
  "ساعدني",
  "لا أعرف",
  "لم أفهم",
];

const DEFAULT_FOCUS: ResponseEvaluationFocus = {
  meaning: true,
  grammar: false,
  vocabulary: false,
  pronunciation: false,
  fluency: false,
  spelling: false,
  punctuation: false,
};

const DEFAULT_CONFIG: Required<
  Omit<ResponseEvaluatorConfig, "provider" | "now">
> = {
  mode: "hybrid",

  semanticWeight: 0.3,
  exactAnswerWeight: 0.25,
  keywordWeight: 0.15,
  languageAccuracyWeight: 0.2,
  pronunciationWeight: 0.1,

  correctThreshold: 85,
  mostlyCorrectThreshold: 70,
  partlyCorrectThreshold: 45,

  minimumResponseCharacters: 1,
  noResponseTimeoutMs: 15_000,
  helpRequestPhrases: DEFAULT_HELP_REQUEST_PHRASES,
  offTopicMinimumConfidence: 0.65,

  enableHeuristicLanguageChecks: true,
  enableHeuristicFluencyChecks: true,
  enableAutomaticCorrectionRecommendation: true,
};

/* -------------------------------------------------------------------------- */
/*                               Utilities                                    */
/* -------------------------------------------------------------------------- */

function nowIso(config: ResponseEvaluatorConfig): string {
  const value = config.now?.() ?? new Date().toISOString();
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function createId(prefix: string): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

  return `${prefix}-${uuid}`;
}

function cleanWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeUnicode(value: string): string {
  return value.normalize("NFKC");
}

function removeDiacritics(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function stripPunctuation(value: string): string {
  return value.replace(/[.,!?;:()[\]{}"'“”‘’…ـ،؛؟]/g, " ");
}

function normalizeForComparison(
  value: string,
  caseSensitive = false,
): string {
  const normalized = cleanWhitespace(
    stripPunctuation(removeDiacritics(normalizeUnicode(value))),
  );

  return caseSensitive ? normalized : normalized.toLocaleLowerCase();
}

function tokenize(value: string, caseSensitive = false): string[] {
  const normalized = normalizeForComparison(value, caseSensitive);
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function average(values: Array<number | undefined>): number {
  const valid = values.filter(
    (value): value is number => value !== undefined && Number.isFinite(value),
  );

  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function weightedAverage(
  values: Array<{ value: number; weight: number; enabled?: boolean }>,
): number {
  const enabled = values.filter(
    (item) => item.enabled !== false && item.weight > 0,
  );

  const totalWeight = enabled.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return 0;

  return enabled.reduce(
    (sum, item) => sum + item.value * item.weight,
    0,
  ) / totalWeight;
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );

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

function similarity(left: string, right: string): number {
  const a = normalizeForComparison(left);
  const b = normalizeForComparison(right);

  if (!a && !b) return 1;
  if (!a || !b) return 0;

  const maximumLength = Math.max(a.length, b.length);
  return 1 - levenshteinDistance(a, b) / maximumLength;
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }

  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

function containsPhrase(
  response: string,
  phrase: string,
  caseSensitive = false,
): boolean {
  const normalizedResponse = normalizeForComparison(response, caseSensitive);
  const normalizedPhrase = normalizeForComparison(phrase, caseSensitive);

  return Boolean(
    normalizedPhrase &&
      (normalizedResponse === normalizedPhrase ||
        normalizedResponse.includes(normalizedPhrase)),
  );
}

function bestSimilarity(
  response: string,
  candidates: string[],
): { score: number; candidate?: string } {
  let score = 0;
  let candidate: string | undefined;

  for (const current of candidates) {
    const currentScore = similarity(response, current);
    if (currentScore > score) {
      score = currentScore;
      candidate = current;
    }
  }

  return { score, candidate };
}

function isMeaningfulText(value: string | undefined): boolean {
  return Boolean(value && cleanWhitespace(value).length > 0);
}

function mergeErrors(...collections: Array<EvaluatedError[] | undefined>): EvaluatedError[] {
  const seen = new Set<string>();
  const merged: EvaluatedError[] = [];

  for (const collection of collections) {
    for (const error of collection ?? []) {
      const signature = [
        error.type,
        error.severity,
        error.original ?? "",
        error.correction ?? "",
        error.relatedObjectiveId ?? "",
        error.relatedGrammarId ?? "",
        error.relatedVocabularyId ?? "",
      ].join("|");

      if (!seen.has(signature)) {
        seen.add(signature);
        merged.push(error);
      }
    }
  }

  return merged;
}

function resolveStage(
  lesson: TeachingBrainLesson,
  stageId: string,
): TeachingStage | undefined {
  return lesson.stages.find((stage) => stage.id === stageId);
}

function resolveActivity(
  lesson: TeachingBrainLesson,
  activityId: string,
): { stage: TeachingStage; activity: TeachingActivity } | undefined {
  for (const stage of lesson.stages) {
    const activity = stage.activities.find((item) => item.id === activityId);
    if (activity) return { stage, activity };
  }

  return undefined;
}

function effectiveFocus(
  expectedResponses: ExpectedResponse[],
): ResponseEvaluationFocus {
  if (expectedResponses.length === 0) return DEFAULT_FOCUS;

  return expectedResponses.reduce<ResponseEvaluationFocus>(
    (focus, expected) => ({
      meaning: focus.meaning || expected.evaluationFocus.meaning,
      grammar: focus.grammar || expected.evaluationFocus.grammar,
      vocabulary: focus.vocabulary || expected.evaluationFocus.vocabulary,
      pronunciation:
        focus.pronunciation || expected.evaluationFocus.pronunciation,
      fluency: focus.fluency || expected.evaluationFocus.fluency,
      spelling: focus.spelling || expected.evaluationFocus.spelling,
      punctuation:
        focus.punctuation || expected.evaluationFocus.punctuation,
    }),
    {
      meaning: false,
      grammar: false,
      vocabulary: false,
      pronunciation: false,
      fluency: false,
      spelling: false,
      punctuation: false,
    },
  );
}

/* -------------------------------------------------------------------------- */
/*                       Response Text and Classification                     */
/* -------------------------------------------------------------------------- */

function extractResponseText(turn: LearnerTurn): string {
  if (isMeaningfulText(turn.normalizedText)) {
    return cleanWhitespace(turn.normalizedText!);
  }

  if (isMeaningfulText(turn.rawText)) {
    return cleanWhitespace(turn.rawText!);
  }

  if (isMeaningfulText(turn.selectedOptionId)) {
    return cleanWhitespace(turn.selectedOptionId!);
  }

  return "";
}

function isHelpRequest(
  response: string,
  phrases: string[],
): boolean {
  const normalized = normalizeForComparison(response);

  return phrases.some((phrase) => {
    const normalizedPhrase = normalizeForComparison(phrase);
    return (
      normalized === normalizedPhrase ||
      normalized.startsWith(`${normalizedPhrase} `) ||
      normalized.includes(` ${normalizedPhrase} `)
    );
  });
}

function classifySpecialResponse(
  turn: LearnerTurn,
  response: string,
  config: Required<Omit<ResponseEvaluatorConfig, "provider" | "now">>,
): SpecialResponseClassification {
  if (
    turn.modality === "none" ||
    (!response && !turn.selectedOptionId) ||
    response.length < config.minimumResponseCharacters
  ) {
    return "no_response";
  }

  if (
    turn.responseTimeMs !== undefined &&
    turn.responseTimeMs >= config.noResponseTimeoutMs &&
    !response
  ) {
    return "no_response";
  }

  if (isHelpRequest(response, config.helpRequestPhrases)) {
    return "help_requested";
  }

  const tokens = tokenize(response);

  if (
    tokens.length === 1 &&
    ["what", "why", "how", "huh", "sorry", "pardon"].includes(tokens[0])
  ) {
    return "unclear";
  }

  return undefined;
}

/* -------------------------------------------------------------------------- */
/*                         Deterministic Evaluation                           */
/* -------------------------------------------------------------------------- */

function scoreKeywords(
  response: string,
  expected: ExpectedResponse,
): {
  score: number;
  matched: string[];
  missing: string[];
  forbidden: string[];
} {
  const required = expected.requiredKeywords ?? [];
  const forbidden = expected.forbiddenKeywords ?? [];
  const matched = required.filter((keyword) =>
    containsPhrase(response, keyword, expected.caseSensitive),
  );
  const missing = required.filter(
    (keyword) =>
      !containsPhrase(response, keyword, expected.caseSensitive),
  );
  const foundForbidden = forbidden.filter((keyword) =>
    containsPhrase(response, keyword, expected.caseSensitive),
  );

  const requiredScore =
    required.length === 0 ? 100 : (matched.length / required.length) * 100;

  const forbiddenPenalty =
    forbidden.length === 0
      ? 0
      : (foundForbidden.length / forbidden.length) * 50;

  return {
    score: normalizeScore(requiredScore - forbiddenPenalty),
    matched,
    missing,
    forbidden: foundForbidden,
  };
}

function compareExpectedResponse(
  response: string,
  expected: ExpectedResponse,
): DeterministicMatch {
  const exactAnswers = expected.exactAnswers ?? [];
  const acceptableAnswers = expected.acceptableAnswers ?? [];

  const normalizedResponse = normalizeForComparison(
    response,
    expected.caseSensitive,
  );

  const exactMatch = exactAnswers.find(
    (answer) =>
      normalizeForComparison(answer, expected.caseSensitive) ===
      normalizedResponse,
  );

  const acceptableMatch = acceptableAnswers.find(
    (answer) =>
      normalizeForComparison(answer, expected.caseSensitive) ===
      normalizedResponse,
  );

  const exactSimilarity = bestSimilarity(response, exactAnswers);
  const acceptableSimilarity = bestSimilarity(response, acceptableAnswers);
  const keywordResult = scoreKeywords(response, expected);

  let exactScore = exactMatch ? 100 : exactSimilarity.score * 100;
  let acceptableScore = acceptableMatch
    ? 100
    : acceptableSimilarity.score * 100;

  if (!expected.allowMinorSpellingErrors) {
    if (!exactMatch) exactScore = exactAnswers.length > 0 ? 0 : exactScore;
    if (!acceptableMatch) {
      acceptableScore =
        acceptableAnswers.length > 0 ? 0 : acceptableScore;
    }
  }

  const modelSource =
    expected.modelAnswer ??
    expected.semanticDescription ??
    exactAnswers[0] ??
    acceptableAnswers[0] ??
    "";

  const semanticProxyScore = modelSource
    ? Math.max(
        similarity(response, modelSource) * 100,
        tokenOverlap(response, modelSource) * 100,
      )
    : keywordResult.score;

  const targetLength = tokenize(modelSource).length;
  const responseLength = tokenize(response).length;
  const completenessScore =
    targetLength === 0
      ? responseLength > 0
        ? 100
        : 0
      : normalizeScore(
          Math.min(1, responseLength / Math.max(1, targetLength)) * 100,
        );

  const positiveEvidence: string[] = [];
  const errors: EvaluatedError[] = [];

  if (exactMatch) {
    positiveEvidence.push("The response exactly matches an expected answer.");
  } else if (acceptableMatch) {
    positiveEvidence.push("The response matches an acceptable answer.");
  } else if (
    expected.allowMinorSpellingErrors &&
    Math.max(exactSimilarity.score, acceptableSimilarity.score) >= 0.8
  ) {
    positiveEvidence.push(
      "The response closely matches an expected answer with minor differences.",
    );
  }

  if (keywordResult.matched.length > 0) {
    positiveEvidence.push(
      `Matched required keywords: ${keywordResult.matched.join(", ")}.`,
    );
  }

  if (keywordResult.missing.length > 0) {
    errors.push({
      id: createId("error"),
      type: "vocabulary",
      severity:
        keywordResult.missing.length ===
        (expected.requiredKeywords?.length ?? 0)
          ? "major"
          : "moderate",
      explanation: `Missing required keywords: ${keywordResult.missing.join(", ")}.`,
    });
  }

  if (keywordResult.forbidden.length > 0) {
    errors.push({
      id: createId("error"),
      type: "meaning",
      severity: "major",
      original: keywordResult.forbidden.join(", "),
      explanation: `The response contains forbidden or contradictory keywords: ${keywordResult.forbidden.join(", ")}.`,
    });
  }

  return {
    expected,
    exactScore,
    acceptableScore,
    keywordScore: keywordResult.score,
    semanticProxyScore,
    completenessScore,
    matchedKeywords: keywordResult.matched,
    missingKeywords: keywordResult.missing,
    incorrectKeywords: keywordResult.forbidden,
    positiveEvidence,
    errors,
  };
}

function chooseBestExpectedResponse(
  response: string,
  expectedResponses: ExpectedResponse[],
): DeterministicMatch {
  if (expectedResponses.length === 0) {
    return {
      exactScore: 0,
      acceptableScore: 0,
      keywordScore: 0,
      semanticProxyScore: response ? 50 : 0,
      completenessScore: response ? 100 : 0,
      matchedKeywords: [],
      missingKeywords: [],
      incorrectKeywords: [],
      positiveEvidence: response
        ? ["The learner provided a response."]
        : [],
      errors: [],
      explanation:
        "The activity does not define structured expected responses.",
    };
  }

  const matches = expectedResponses.map((expected) =>
    compareExpectedResponse(response, expected),
  );

  return matches.sort((left, right) => {
    const leftScore = Math.max(
      left.exactScore,
      left.acceptableScore,
      left.keywordScore,
      left.semanticProxyScore,
    );
    const rightScore = Math.max(
      right.exactScore,
      right.acceptableScore,
      right.keywordScore,
      right.semanticProxyScore,
    );

    return rightScore - leftScore;
  })[0];
}

/* -------------------------------------------------------------------------- */
/*                       Heuristic Language Evaluation                        */
/* -------------------------------------------------------------------------- */

function sentenceStartsWithCapital(text: string): boolean {
  const firstLetter = text.match(/\p{L}/u)?.[0];
  return !firstLetter || firstLetter === firstLetter.toLocaleUpperCase();
}

function hasTerminalPunctuation(text: string): boolean {
  return /[.!?؟。]$/.test(text.trim());
}

function repeatedWordErrors(text: string): EvaluatedError[] {
  const tokens = tokenize(text);
  const errors: EvaluatedError[] = [];

  for (let index = 1; index < tokens.length; index += 1) {
    if (tokens[index] === tokens[index - 1]) {
      errors.push({
        id: createId("error"),
        type: "fluency",
        severity: "minor",
        original: `${tokens[index - 1]} ${tokens[index]}`,
        correction: tokens[index],
        explanation: "The same word appears twice consecutively.",
      });
    }
  }

  return errors;
}

function unmatchedBracketOrQuoteErrors(text: string): EvaluatedError[] {
  const pairs: Array<[string, string]> = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
    ['"', '"'],
  ];

  const errors: EvaluatedError[] = [];

  for (const [open, close] of pairs) {
    const openCount = text.split(open).length - 1;
    const closeCount = text.split(close).length - 1;

    if (openCount !== closeCount) {
      errors.push({
        id: createId("error"),
        type: "punctuation",
        severity: "minor",
        original: text,
        explanation: `Unbalanced punctuation: ${open}${close}.`,
      });
    }
  }

  return errors;
}

function heuristicLanguageEvaluation(
  response: string,
  focus: ResponseEvaluationFocus,
  turn: LearnerTurn,
): LanguageEvaluationResult {
  const errors: EvaluatedError[] = [];
  const positiveEvidence: string[] = [];

  if (focus.punctuation && turn.modality === "text") {
    if (!hasTerminalPunctuation(response) && tokenize(response).length >= 4) {
      errors.push({
        id: createId("error"),
        type: "punctuation",
        severity: "minor",
        original: response,
        correction: `${response}.`,
        explanation: "A complete sentence normally needs final punctuation.",
      });
    }

    errors.push(...unmatchedBracketOrQuoteErrors(response));
  }

  if (focus.spelling && /\s{2,}/.test(turn.rawText ?? "")) {
    errors.push({
      id: createId("error"),
      type: "spelling",
      severity: "minor",
      original: turn.rawText,
      correction: cleanWhitespace(turn.rawText ?? ""),
      explanation: "The response contains unnecessary repeated spaces.",
    });
  }

  if (
    focus.grammar &&
    turn.modality === "text" &&
    tokenize(response).length >= 4 &&
    !sentenceStartsWithCapital(response)
  ) {
    errors.push({
      id: createId("error"),
      type: "grammar",
      severity: "minor",
      original: response,
      explanation: "The sentence may need an initial capital letter.",
    });
  }

  if (focus.fluency) {
    errors.push(...repeatedWordErrors(response));
  }

  if (errors.length === 0) {
    positiveEvidence.push(
      "No clear surface-level language error was detected.",
    );
  }

  const severityPenalty = errors.reduce((penalty, error) => {
    if (error.severity === "major") return penalty + 35;
    if (error.severity === "moderate") return penalty + 20;
    return penalty + 8;
  }, 0);

  const score = normalizeScore(100 - severityPenalty);

  return {
    grammar: focus.grammar
      ? gradeFromScore(score)
      : "not_checked",
    vocabulary: focus.vocabulary
      ? gradeFromScore(score)
      : "not_checked",
    spelling: focus.spelling
      ? gradeFromScore(score)
      : "not_checked",
    punctuation: focus.punctuation
      ? gradeFromScore(score)
      : "not_checked",
    fluency: focus.fluency
      ? fluencyFromScore(score)
      : "not_checked",
    score,
    confidence: errors.length === 0 ? 0.45 : 0.6,
    errors,
    positiveEvidence,
    explanation:
      "This is a conservative heuristic language check. A provider can supply deeper linguistic analysis.",
  };
}

/* -------------------------------------------------------------------------- */
/*                             Grade Conversion                               */
/* -------------------------------------------------------------------------- */

function gradeFromScore(score: number): EvaluationGrade {
  if (score >= 90) return "correct";
  if (score >= 75) return "minor_error";
  if (score >= 55) return "partial";
  if (score >= 35) return "major_error";
  return "incorrect";
}

function pronunciationFromScore(score: number): PronunciationGrade {
  if (score >= 85) return "clear";
  if (score >= 65) return "understandable";
  if (score >= 40) return "needs_support";
  return "unclear";
}

function fluencyFromScore(score: number): FluencyGrade {
  if (score >= 85) return "fluent";
  if (score >= 65) return "mostly_fluent";
  if (score >= 40) return "hesitant";
  return "very_hesitant";
}

function statusFromScore(
  score: number,
  config: Required<Omit<ResponseEvaluatorConfig, "provider" | "now">>,
): LearnerResponseStatus {
  if (score >= config.correctThreshold) return "correct";
  if (score >= config.mostlyCorrectThreshold) return "mostly_correct";
  if (score >= config.partlyCorrectThreshold) return "partly_correct";
  return "incorrect";
}

function gradeBundleForSpecialStatus(
  status: Exclude<SpecialResponseClassification, undefined>,
): GradeBundle {
  const unchecked: GradeBundle = {
    meaning: "not_checked",
    grammar: "not_checked",
    vocabulary: "not_checked",
    pronunciation: "not_checked",
    fluency: "not_checked",
    spelling: "not_checked",
    punctuation: "not_checked",
  };

  if (status === "off_topic") {
    return { ...unchecked, meaning: "incorrect" };
  }

  if (status === "unclear") {
    return {
      ...unchecked,
      meaning: "partial",
      pronunciation: "unclear",
    };
  }

  return unchecked;
}

/* -------------------------------------------------------------------------- */
/*                         Correction Recommendation                          */
/* -------------------------------------------------------------------------- */

function recommendedCorrectionFocus(
  errors: EvaluatedError[],
  focus: ResponseEvaluationFocus,
): CorrectionFocus[] {
  const severityWeight: Record<EvaluatedError["severity"], number> = {
    major: 3,
    moderate: 2,
    minor: 1,
  };

  const scores = new Map<CorrectionFocus, number>();

  for (const error of errors) {
    if (error.type === "instruction_misunderstanding") continue;

    const correctionFocus = error.type as CorrectionFocus;
    scores.set(
      correctionFocus,
      (scores.get(correctionFocus) ?? 0) + severityWeight[error.severity],
    );
  }

  const correctionFocuses: CorrectionFocus[] = [
    "meaning",
    "grammar",
    "vocabulary",
    "pronunciation",
    "fluency",
    "spelling",
    "punctuation",
  ];

  const allowed = correctionFocuses.filter((item) => focus[item]);

  return [...scores.entries()]
    .filter(([item]) => allowed.includes(item))
    .sort((left, right) => right[1] - left[1])
    .map(([item]) => item)
    .slice(0, 3);
}

function shouldCorrectResponse(
  status: LearnerResponseStatus,
  errors: EvaluatedError[],
  focus: ResponseEvaluationFocus,
): boolean {
  if (
    status === "no_response" ||
    status === "help_requested" ||
    status === "off_topic"
  ) {
    return false;
  }

  const relevantErrors = errors.filter((error) => {
    if (error.type === "instruction_misunderstanding") return true;
    return focus[error.type as CorrectionFocus];
  });

  return (
    status === "incorrect" ||
    status === "partly_correct" ||
    relevantErrors.some(
      (error) => error.severity === "major" || error.severity === "moderate",
    )
  );
}

/* -------------------------------------------------------------------------- */
/*                            Error Conversion                                */
/* -------------------------------------------------------------------------- */

function toTeachingBrainError(
  error: unknown,
  input?: Partial<EvaluateResponseInput>,
): TeachingBrainError {
  if (error instanceof ResponseEvaluatorError) {
    return {
      code:
        error.code === "STAGE_NOT_FOUND"
          ? "STAGE_NOT_FOUND"
          : error.code === "ACTIVITY_NOT_FOUND"
            ? "ACTIVITY_NOT_FOUND"
            : error.code === "UNSUPPORTED_MODALITY"
              ? "UNSUPPORTED_INPUT"
              : "EVALUATION_FAILED",
      message: error.message,
      lessonId: input?.lesson?.id,
      stageId: input?.learnerTurn?.stageId,
      activityId: input?.learnerTurn?.activityId,
      sessionId: input?.learnerTurn?.sessionId,
      recoverable: error.recoverable,
      details: error.details,
    };
  }

  return {
    code: "EVALUATION_FAILED",
    message:
      error instanceof Error
        ? error.message
        : "An unknown response evaluation error occurred.",
    lessonId: input?.lesson?.id,
    stageId: input?.learnerTurn?.stageId,
    activityId: input?.learnerTurn?.activityId,
    sessionId: input?.learnerTurn?.sessionId,
    recoverable: true,
    details: {
      cause:
        error instanceof Error
          ? error.name
          : String(error),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                           Main Evaluator Class                             */
/* -------------------------------------------------------------------------- */

export class ResponseEvaluator {
  private readonly config: Required<
    Omit<ResponseEvaluatorConfig, "provider" | "now">
  > &
    Pick<ResponseEvaluatorConfig, "provider" | "now">;

  constructor(config: ResponseEvaluatorConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      helpRequestPhrases:
        config.helpRequestPhrases ?? DEFAULT_HELP_REQUEST_PHRASES,
      provider: config.provider,
      now: config.now,
    };

    this.validateConfig();
  }

  async evaluate(
    input: EvaluateResponseInput,
  ): Promise<DetailedResponseEvaluation> {
    this.validateInput(input);

    const { lesson, learnerTurn } = input;
    const resolved = this.resolveContext(input);
    const { stage, activity } = resolved;

    const response = extractResponseText(learnerTurn);
    const normalizedResponse = normalizeForComparison(response);
    const expectedResponses = this.resolveExpectedResponses(
      activity,
      input.expectedResponseId,
    );
    const focus = effectiveFocus(expectedResponses);
    const diagnostics: string[] = [];

    const special = classifySpecialResponse(
      learnerTurn,
      response,
      this.config,
    );

    if (special) {
      return this.buildSpecialEvaluation(
        input,
        stage,
        activity,
        normalizedResponse,
        special,
        diagnostics,
      );
    }

    const deterministic = chooseBestExpectedResponse(
      response,
      expectedResponses,
    );

    let semanticResult: SemanticEvaluationResult | undefined;
    let languageResult: LanguageEvaluationResult | undefined;
    let pronunciationResult: PronunciationEvaluationResult | undefined;

    if (this.config.mode === "provider_only" && !this.config.provider) {
      throw new ResponseEvaluatorError(
        "PROVIDER_REQUIRED",
        "Provider-only evaluation mode requires a response evaluation provider.",
        { recoverable: false },
      );
    }

    if (
      this.config.provider &&
      this.config.mode !== "deterministic"
    ) {
      const providerInput = {
        lesson,
        stage,
        activity,
        learnerTurn,
        normalizedResponse,
        expectedResponses,
      };

      try {
        if (this.config.provider.evaluateSemantic) {
          semanticResult =
            await this.config.provider.evaluateSemantic(providerInput);
        }

        if (this.config.provider.evaluateLanguage) {
          languageResult =
            await this.config.provider.evaluateLanguage(providerInput);
        }

        if (
          focus.pronunciation &&
          learnerTurn.modality === "voice" &&
          this.config.provider.evaluatePronunciation
        ) {
          pronunciationResult =
            await this.config.provider.evaluatePronunciation(providerInput);
        }
      } catch (error) {
        if (this.config.mode === "provider_only") {
          throw new ResponseEvaluatorError(
            "PROVIDER_FAILED",
            "The response evaluation provider failed.",
            { cause: error, recoverable: true },
          );
        }

        diagnostics.push(
          `Provider evaluation failed; deterministic fallback was used: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (
      !languageResult &&
      this.config.enableHeuristicLanguageChecks
    ) {
      languageResult = heuristicLanguageEvaluation(
        response,
        focus,
        learnerTurn,
      );
    }

    const semanticScore =
      semanticResult?.score ??
      deterministic.semanticProxyScore;

    const exactAnswerScore = deterministic.exactScore;
    const acceptableAnswerScore = deterministic.acceptableScore;
    const keywordScore = deterministic.keywordScore;

    const languageScore =
      languageResult?.score ??
      this.inferLanguageScoreFromDeterministic(
        deterministic,
        focus,
      );

    const pronunciationScore =
      pronunciationResult?.score ??
      this.inferPronunciationScore(learnerTurn, focus);

    const relevanceScore = semanticResult?.offTopic
      ? 0
      : Math.max(
          semanticScore,
          exactAnswerScore,
          acceptableAnswerScore,
          keywordScore,
        );

    const completenessScore = deterministic.completenessScore;

    const finalScore = normalizeScore(
      weightedAverage([
        {
          value: Math.max(exactAnswerScore, acceptableAnswerScore),
          weight: this.config.exactAnswerWeight,
          enabled:
            expectedResponses.some(
              (item) =>
                (item.exactAnswers?.length ?? 0) > 0 ||
                (item.acceptableAnswers?.length ?? 0) > 0,
            ),
        },
        {
          value: keywordScore,
          weight: this.config.keywordWeight,
          enabled: expectedResponses.some(
            (item) => (item.requiredKeywords?.length ?? 0) > 0,
          ),
        },
        {
          value: semanticScore,
          weight: this.config.semanticWeight,
          enabled:
            focus.meaning ||
            expectedResponses.some(
              (item) =>
                Boolean(item.semanticDescription) ||
                Boolean(item.modelAnswer) ||
                item.allowEquivalentMeaning === true,
            ),
        },
        {
          value: languageScore,
          weight: this.config.languageAccuracyWeight,
          enabled:
            focus.grammar ||
            focus.vocabulary ||
            focus.spelling ||
            focus.punctuation ||
            focus.fluency,
        },
        {
          value: pronunciationScore,
          weight: this.config.pronunciationWeight,
          enabled:
            focus.pronunciation &&
            learnerTurn.modality === "voice",
        },
        {
          value: completenessScore,
          weight: 0.05,
          enabled: true,
        },
      ]),
    );

    let status = statusFromScore(finalScore, this.config);

    if (
      semanticResult?.offTopic &&
      normalizeConfidence(semanticResult.confidence) >=
        this.config.offTopicMinimumConfidence
    ) {
      status = "off_topic";
    }

    if (
      semanticResult &&
      semanticResult.equivalentMeaning &&
      status === "partly_correct"
    ) {
      status = "mostly_correct";
    }

    const errors = mergeErrors(
      deterministic.errors,
      semanticResult?.detectedErrors,
      languageResult?.errors,
      pronunciationResult?.errors,
    );

    const confidence = this.calculateConfidence({
      deterministic,
      semanticResult,
      languageResult,
      pronunciationResult,
      expectedResponses,
    });

    const grades = this.buildGrades({
      status,
      finalScore,
      semanticScore,
      languageScore,
      pronunciationScore,
      focus,
      languageResult,
      pronunciationResult,
    });

    const correctionFocus = this.config
      .enableAutomaticCorrectionRecommendation
      ? recommendedCorrectionFocus(errors, focus)
      : [];

    const evidence: EvaluationEvidence = {
      matchedExpectedResponseId:
        semanticResult?.matchedExpectedResponseId ??
        deterministic.expected?.id,
      matchedKeywords: unique(deterministic.matchedKeywords),
      missingKeywords: unique(deterministic.missingKeywords),
      incorrectKeywords: unique(deterministic.incorrectKeywords),
      detectedErrors: errors,
      positiveEvidence: unique([
        ...deterministic.positiveEvidence,
        ...(semanticResult?.positiveEvidence ?? []),
        ...(languageResult?.positiveEvidence ?? []),
        ...(pronunciationResult?.positiveEvidence ?? []),
      ]),
      explanation: [
        deterministic.explanation,
        semanticResult?.explanation,
        languageResult?.explanation,
        pronunciationResult?.explanation,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" "),
    };

    const evaluation: ResponseEvaluation = {
      learnerTurnId: learnerTurn.id,
      status,
      ...grades,
      score: round(finalScore),
      confidence: normalizeConfidence(confidence),
      targetObjectiveIds: [...activity.targetObjectiveIds],
      evidence,
      shouldCorrect: shouldCorrectResponse(status, errors, focus),
      recommendedCorrectionFocus:
        correctionFocus.length > 0 ? correctionFocus : undefined,
      createdAt: nowIso(this.config),
    };

    return {
      evaluation,
      breakdown: {
        exactAnswerScore: round(exactAnswerScore),
        acceptableAnswerScore: round(acceptableAnswerScore),
        keywordScore: round(keywordScore),
        semanticScore: round(semanticScore),
        languageScore: round(languageScore),
        pronunciationScore: round(pronunciationScore),
        relevanceScore: round(relevanceScore),
        completenessScore: round(completenessScore),
      },
      normalizedResponse,
      matchedExpectedResponse: deterministic.expected,
      diagnostics,
    };
  }

  async safeEvaluate(
    input: EvaluateResponseInput,
  ): Promise<SafeEvaluationResult> {
    try {
      return {
        ok: true,
        data: await this.evaluate(input),
      };
    } catch (error) {
      return {
        ok: false,
        error: toTeachingBrainError(error, input),
      };
    }
  }

  private validateConfig(): void {
    const thresholds = [
      this.config.correctThreshold,
      this.config.mostlyCorrectThreshold,
      this.config.partlyCorrectThreshold,
    ];

    if (
      thresholds.some(
        (threshold) =>
          !Number.isFinite(threshold) ||
          threshold < 0 ||
          threshold > 100,
      )
    ) {
      throw new ResponseEvaluatorError(
        "INVALID_INPUT",
        "Evaluation thresholds must be between 0 and 100.",
        { recoverable: false },
      );
    }

    if (
      !(
        this.config.correctThreshold >
          this.config.mostlyCorrectThreshold &&
        this.config.mostlyCorrectThreshold >
          this.config.partlyCorrectThreshold
      )
    ) {
      throw new ResponseEvaluatorError(
        "INVALID_INPUT",
        "Evaluation thresholds must descend from correct to mostly correct to partly correct.",
        { recoverable: false },
      );
    }

    const weights = [
      this.config.semanticWeight,
      this.config.exactAnswerWeight,
      this.config.keywordWeight,
      this.config.languageAccuracyWeight,
      this.config.pronunciationWeight,
    ];

    if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
      throw new ResponseEvaluatorError(
        "INVALID_INPUT",
        "Evaluation weights must be finite non-negative numbers.",
        { recoverable: false },
      );
    }
  }

  private validateInput(input: EvaluateResponseInput): void {
    if (!input.lesson?.id) {
      throw new ResponseEvaluatorError(
        "INVALID_INPUT",
        "A valid TeachingBrainLesson is required.",
      );
    }

    if (!input.learnerTurn?.id) {
      throw new ResponseEvaluatorError(
        "INVALID_INPUT",
        "A valid LearnerTurn is required.",
      );
    }

    if (
      !["text", "voice", "choice", "none"].includes(
        input.learnerTurn.modality,
      )
    ) {
      throw new ResponseEvaluatorError(
        "UNSUPPORTED_MODALITY",
        `Unsupported learner modality: ${String(
          input.learnerTurn.modality,
        )}.`,
      );
    }
  }

  private resolveContext(input: EvaluateResponseInput): {
    stage: TeachingStage;
    activity: TeachingActivity;
  } {
    const { lesson, learnerTurn } = input;

    const resolvedActivity =
      input.activity
        ? {
            activity: input.activity,
            stage:
              input.stage ??
              resolveStage(lesson, learnerTurn.stageId),
          }
        : resolveActivity(lesson, learnerTurn.activityId);

    if (!resolvedActivity?.activity) {
      throw new ResponseEvaluatorError(
        "ACTIVITY_NOT_FOUND",
        `Activity "${learnerTurn.activityId}" was not found in lesson "${lesson.id}".`,
        {
          details: {
            lessonId: lesson.id,
            activityId: learnerTurn.activityId,
          },
        },
      );
    }

    const stage =
      input.stage ??
      resolvedActivity.stage ??
      resolveStage(lesson, learnerTurn.stageId);

    if (!stage) {
      throw new ResponseEvaluatorError(
        "STAGE_NOT_FOUND",
        `Stage "${learnerTurn.stageId}" was not found in lesson "${lesson.id}".`,
      );
    }

    if (
      resolvedActivity.activity.id !== learnerTurn.activityId ||
      stage.id !== learnerTurn.stageId
    ) {
      throw new ResponseEvaluatorError(
        "TURN_CONTEXT_MISMATCH",
        "The learner turn does not match the supplied stage and activity context.",
        {
          details: {
            learnerTurnStageId: learnerTurn.stageId,
            resolvedStageId: stage.id,
            learnerTurnActivityId: learnerTurn.activityId,
            resolvedActivityId: resolvedActivity.activity.id,
          },
        },
      );
    }

    if (
      !stage.activities.some(
        (activity) => activity.id === resolvedActivity.activity.id,
      )
    ) {
      throw new ResponseEvaluatorError(
        "TURN_CONTEXT_MISMATCH",
        `Activity "${resolvedActivity.activity.id}" does not belong to stage "${stage.id}".`,
      );
    }

    return {
      stage,
      activity: resolvedActivity.activity,
    };
  }

  private resolveExpectedResponses(
    activity: TeachingActivity,
    expectedResponseId?: string,
  ): ExpectedResponse[] {
    const expectedResponses = activity.expectedResponses ?? [];

    if (!expectedResponseId) return expectedResponses;

    const expected = expectedResponses.find(
      (item) => item.id === expectedResponseId,
    );

    if (!expected) {
      throw new ResponseEvaluatorError(
        "EXPECTED_RESPONSE_NOT_FOUND",
        `Expected response "${expectedResponseId}" was not found in activity "${activity.id}".`,
      );
    }

    return [expected];
  }

  private buildSpecialEvaluation(
    input: EvaluateResponseInput,
    stage: TeachingStage,
    activity: TeachingActivity,
    normalizedResponse: string,
    status: Exclude<SpecialResponseClassification, undefined>,
    diagnostics: string[],
  ): DetailedResponseEvaluation {
    const grades = gradeBundleForSpecialStatus(status);
    const explanationByStatus: Record<
      Exclude<SpecialResponseClassification, undefined>,
      string
    > = {
      no_response: "No usable learner response was received.",
      help_requested: "The learner explicitly requested help.",
      off_topic: "The response appears unrelated to the activity.",
      unclear: "The response is too unclear to evaluate reliably.",
    };

    const evaluation: ResponseEvaluation = {
      learnerTurnId: input.learnerTurn.id,
      status,
      ...grades,
      score: 0,
      confidence:
        status === "no_response" || status === "help_requested"
          ? 1
          : 0.65,
      targetObjectiveIds: [...activity.targetObjectiveIds],
      evidence: {
        matchedKeywords: [],
        missingKeywords: [],
        incorrectKeywords: [],
        detectedErrors:
          status === "unclear"
            ? [
                {
                  id: createId("error"),
                  type:
                    input.learnerTurn.modality === "voice"
                      ? "pronunciation"
                      : "instruction_misunderstanding",
                  severity: "moderate",
                  original:
                    input.learnerTurn.rawText ??
                    input.learnerTurn.normalizedText,
                  explanation: explanationByStatus[status],
                },
              ]
            : [],
        positiveEvidence: [],
        explanation: explanationByStatus[status],
      },
      shouldCorrect: false,
      createdAt: nowIso(this.config),
    };

    diagnostics.push(
      `Special response classification applied: ${status}.`,
    );

    return {
      evaluation,
      breakdown: {
        exactAnswerScore: 0,
        acceptableAnswerScore: 0,
        keywordScore: 0,
        semanticScore: 0,
        languageScore: 0,
        pronunciationScore: 0,
        relevanceScore: 0,
        completenessScore: 0,
      },
      normalizedResponse,
      diagnostics,
    };
  }

  private inferLanguageScoreFromDeterministic(
    deterministic: DeterministicMatch,
    focus: ResponseEvaluationFocus,
  ): number {
    if (
      !focus.grammar &&
      !focus.vocabulary &&
      !focus.spelling &&
      !focus.punctuation &&
      !focus.fluency
    ) {
      return 100;
    }

    return average([
      deterministic.acceptableScore,
      deterministic.keywordScore,
      deterministic.semanticProxyScore,
    ]);
  }

  private inferPronunciationScore(
    turn: LearnerTurn,
    focus: ResponseEvaluationFocus,
  ): number {
    if (!focus.pronunciation || turn.modality !== "voice") return 100;

    if (turn.speechConfidence === undefined) return 50;

    const confidence =
      turn.speechConfidence > 1
        ? turn.speechConfidence / 100
        : turn.speechConfidence;

    return normalizeScore(confidence * 100);
  }

  private calculateConfidence(input: {
    deterministic: DeterministicMatch;
    semanticResult?: SemanticEvaluationResult;
    languageResult?: LanguageEvaluationResult;
    pronunciationResult?: PronunciationEvaluationResult;
    expectedResponses: ExpectedResponse[];
  }): number {
    const signals: number[] = [];

    if (
      input.deterministic.exactScore === 100 ||
      input.deterministic.acceptableScore === 100
    ) {
      signals.push(0.98);
    } else if (
      input.deterministic.exactScore >= 80 ||
      input.deterministic.acceptableScore >= 80
    ) {
      signals.push(0.8);
    } else if (input.expectedResponses.length > 0) {
      signals.push(0.55);
    }

    if (input.semanticResult) {
      signals.push(normalizeConfidence(input.semanticResult.confidence));
    }

    if (input.languageResult?.confidence !== undefined) {
      signals.push(
        normalizeConfidence(input.languageResult.confidence),
      );
    }

    if (input.pronunciationResult) {
      signals.push(
        normalizeConfidence(input.pronunciationResult.confidence),
      );
    }

    if (signals.length === 0) return 0.4;
    return clamp01(average(signals));
  }

  private buildGrades(input: {
    status: LearnerResponseStatus;
    finalScore: number;
    semanticScore: number;
    languageScore: number;
    pronunciationScore: number;
    focus: ResponseEvaluationFocus;
    languageResult?: LanguageEvaluationResult;
    pronunciationResult?: PronunciationEvaluationResult;
  }): GradeBundle {
    if (
      input.status === "no_response" ||
      input.status === "help_requested" ||
      input.status === "off_topic" ||
      input.status === "unclear"
    ) {
      return gradeBundleForSpecialStatus(input.status);
    }

    return {
      meaning: input.focus.meaning
        ? gradeFromScore(input.semanticScore)
        : "not_checked",
      grammar: input.focus.grammar
        ? input.languageResult?.grammar ??
          gradeFromScore(input.languageScore)
        : "not_checked",
      vocabulary: input.focus.vocabulary
        ? input.languageResult?.vocabulary ??
          gradeFromScore(input.languageScore)
        : "not_checked",
      pronunciation: input.focus.pronunciation
        ? input.pronunciationResult?.grade ??
          pronunciationFromScore(input.pronunciationScore)
        : "not_checked",
      fluency: input.focus.fluency
        ? input.languageResult?.fluency ??
          fluencyFromScore(input.languageScore)
        : "not_checked",
      spelling: input.focus.spelling
        ? input.languageResult?.spelling ??
          gradeFromScore(input.languageScore)
        : "not_checked",
      punctuation: input.focus.punctuation
        ? input.languageResult?.punctuation ??
          gradeFromScore(input.languageScore)
        : "not_checked",
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                          Functional Service API                            */
/* -------------------------------------------------------------------------- */

export async function evaluateLearnerResponse(
  input: EvaluateResponseInput,
  config: ResponseEvaluatorConfig = {},
): Promise<DetailedResponseEvaluation> {
  return new ResponseEvaluator(config).evaluate(input);
}

export async function safeEvaluateLearnerResponse(
  input: EvaluateResponseInput,
  config: ResponseEvaluatorConfig = {},
): Promise<SafeEvaluationResult> {
  return new ResponseEvaluator(config).safeEvaluate(input);
}

export function createResponseEvaluator(
  config: ResponseEvaluatorConfig = {},
): ResponseEvaluator {
  return new ResponseEvaluator(config);
}

/**
 * Maps a ResponseEvaluation to the attempt vocabulary used by
 * session-engine.ts without importing that engine and creating a circular
 * dependency.
 */
export function mapEvaluationToAttemptOutcome(
  evaluation: ResponseEvaluation,
):
  | "successful"
  | "partly_successful"
  | "unsuccessful"
  | "no_response"
  | "off_topic"
  | "help_requested"
  | "not_evaluated" {
  switch (evaluation.status) {
    case "correct":
    case "mostly_correct":
      return "successful";

    case "partly_correct":
      return "partly_successful";

    case "incorrect":
    case "unclear":
      return "unsuccessful";

    case "no_response":
      return "no_response";

    case "off_topic":
      return "off_topic";

    case "help_requested":
      return "help_requested";

    default:
      return "not_evaluated";
  }
}

export const ResponseEvaluatorService = {
  create: createResponseEvaluator,
  evaluate: evaluateLearnerResponse,
  safeEvaluate: safeEvaluateLearnerResponse,
  mapToAttemptOutcome: mapEvaluationToAttemptOutcome,
};
