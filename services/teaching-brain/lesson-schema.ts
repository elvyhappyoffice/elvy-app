/**
 * Elvy Teaching Brain
 * Runtime lesson validation
 *
 * File: services/teaching-brain/lesson-schema.ts
 *
 * This validator is dependency-free and safe for data coming from AI output,
 * Supabase, APIs, or imported JSON files.
 */

import type {
  TeachingActivity,
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
  TeachingStage,
} from "./types";

export type LessonValidationIssueCode =
  | "REQUIRED"
  | "INVALID_TYPE"
  | "INVALID_VALUE"
  | "INVALID_RANGE"
  | "EMPTY_ARRAY"
  | "DUPLICATE_ID"
  | "BROKEN_REFERENCE"
  | "INVALID_ORDER"
  | "POLICY_CONFLICT"
  | "UNSUPPORTED_SCHEMA_VERSION";

export type LessonValidationIssue = {
  path: string;
  code: LessonValidationIssueCode;
  message: string;
  value?: unknown;
};

export type LessonValidationReport = {
  valid: boolean;
  issues: LessonValidationIssue[];
};

export type LessonParseResult =
  | {
      success: true;
      data: TeachingBrainLesson;
      issues: [];
    }
  | {
      success: false;
      issues: LessonValidationIssue[];
    };

type UnknownRecord = Record<string, unknown>;

class ValidationContext {
  readonly issues: LessonValidationIssue[] = [];

  add(
    path: string,
    code: LessonValidationIssueCode,
    message: string,
    value?: unknown,
  ): void {
    this.issues.push({ path, code, message, value });
  }

  required(path: string): void {
    this.add(path, "REQUIRED", `${path} is required.`);
  }

  invalidType(path: string, expected: string, value: unknown): void {
    this.add(
      path,
      "INVALID_TYPE",
      `${path} must be ${expected}.`,
      value,
    );
  }

  invalidValue(path: string, message: string, value?: unknown): void {
    this.add(path, "INVALID_VALUE", message, value);
  }

  brokenReference(path: string, id: string, target: string): void {
    this.add(
      path,
      "BROKEN_REFERENCE",
      `${path} references unknown ${target} "${id}".`,
      id,
    );
  }
}

const LANGUAGE_CODES = new Set([
  "en",
  "ar",
  "fr",
  "es",
  "de",
  "it",
  "pt",
  "tr",
  "nl",
  "other",
]);

const ENTITY_STATUSES = new Set([
  "draft",
  "active",
  "suspended",
  "archived",
]);

const OBJECTIVE_TYPES = new Set([
  "knowledge",
  "comprehension",
  "vocabulary",
  "grammar",
  "function",
  "pronunciation",
  "listening",
  "speaking",
  "reading",
  "writing",
  "interaction",
  "culture",
  "study_skill",
  "custom",
]);

const OBJECTIVE_PRIORITIES = new Set([
  "essential",
  "important",
  "extension",
]);

const SKILLS = new Set([
  "listening",
  "speaking",
  "reading",
  "writing",
  "pronunciation",
  "grammar",
  "vocabulary",
  "interaction",
  "culture",
]);

const STAGE_TYPES = new Set([
  "welcome",
  "readiness_check",
  "previous_lesson_review",
  "warm_up",
  "lesson_introduction",
  "presentation",
  "comprehension_check",
  "guided_practice",
  "communicative_practice",
  "pronunciation_practice",
  "listening_practice",
  "reading_practice",
  "writing_practice",
  "feedback",
  "assessment",
  "summary",
  "homework",
  "goodbye",
  "custom",
]);

const STAGE_COMPLETION_TYPES = new Set([
  "all_required_activities_completed",
  "minimum_score_reached",
  "minimum_successes_reached",
  "teacher_brain_decision",
  "time_limit_reached",
  "manual",
]);

const ACTIVITY_TYPES = new Set([
  "greeting",
  "conversation",
  "explanation",
  "demonstration",
  "modeling",
  "repeat_after_me",
  "question_answer",
  "open_question",
  "yes_no_question",
  "multiple_choice",
  "true_false",
  "matching",
  "sorting",
  "gap_fill",
  "sentence_building",
  "pronunciation",
  "minimal_pairs",
  "dictation",
  "dialogue",
  "role_play",
  "picture_description",
  "storytelling",
  "listening",
  "reading",
  "writing",
  "quiz",
  "game",
  "review",
  "reflection",
  "custom",
]);

const INPUT_MODALITIES = new Set([
  "text",
  "voice",
  "choice",
  "tap",
  "drag",
  "none",
]);

const OUTPUT_MODALITIES = new Set([
  "speech",
  "text",
  "whiteboard",
  "image",
  "audio",
  "video",
  "animation",
]);

const SUPPORT_STEP_TYPES = new Set([
  "wait",
  "repeat_instruction",
  "slow_down",
  "simplify_instruction",
  "rephrase",
  "give_general_clue",
  "give_specific_clue",
  "show_visual_clue",
  "show_example",
  "give_first_word",
  "give_sentence_frame",
  "translate_keyword",
  "translate_instruction",
  "model_answer",
  "ask_to_repeat",
  "review_prerequisite",
  "change_activity",
]);

const ACTIVITY_SUCCESS_TYPES = new Set([
  "single_correct_response",
  "minimum_score",
  "minimum_correct_answers",
  "minimum_successful_turns",
  "semantic_match",
  "completion_only",
  "manual",
]);

const CORRECTION_TIMINGS = new Set([
  "immediate",
  "delayed",
  "end_of_activity",
  "end_of_stage",
  "only_when_requested",
]);

const CORRECTION_FOCUSES = new Set([
  "meaning",
  "grammar",
  "vocabulary",
  "pronunciation",
  "fluency",
  "spelling",
  "punctuation",
]);

const L1_SUPPORT_LEVELS = new Set([
  "disabled",
  "emergency_only",
  "limited",
  "moderate",
  "frequent",
]);

const L1_SUPPORT_TRIGGERS = new Set([
  "learner_requests_help",
  "instruction_not_understood",
  "repeated_failure",
  "complex_grammar",
  "safety_or_critical_information",
  "beginner_support",
  "teacher_override",
]);

const ASSESSMENT_TYPES = new Set([
  "diagnostic",
  "formative",
  "summative",
  "self_assessment",
  "teacher_observation",
]);

const PRIMARY_TONES = new Set([
  "calm",
  "encouraging",
  "friendly",
  "energetic",
  "formal",
  "playful",
]);

const SECONDARY_TONES = new Set([
  "patient",
  "warm",
  "humorous",
  "supportive",
  "direct",
  "gentle",
  "enthusiastic",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function isISODateTime(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function requiredString(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): value is string {
  if (value === undefined || value === null) {
    ctx.required(path);
    return false;
  }

  if (!isNonEmptyString(value)) {
    ctx.invalidType(path, "a non-empty string", value);
    return false;
  }

  return true;
}

function optionalString(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): boolean {
  if (value === undefined) return true;
  if (!isString(value)) {
    ctx.invalidType(path, "a string", value);
    return false;
  }
  return true;
}

function requiredBoolean(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): value is boolean {
  if (!isBoolean(value)) {
    ctx.invalidType(path, "a boolean", value);
    return false;
  }
  return true;
}

function optionalBoolean(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): boolean {
  if (value === undefined) return true;
  return requiredBoolean(value, path, ctx);
}

function numberRange(
  value: unknown,
  path: string,
  ctx: ValidationContext,
  min: number,
  max: number,
): value is number {
  if (!isFiniteNumber(value)) {
    ctx.invalidType(path, "a finite number", value);
    return false;
  }

  if (value < min || value > max) {
    ctx.add(
      path,
      "INVALID_RANGE",
      `${path} must be between ${min} and ${max}.`,
      value,
    );
    return false;
  }

  return true;
}

function optionalNumberRange(
  value: unknown,
  path: string,
  ctx: ValidationContext,
  min: number,
  max: number,
): boolean {
  if (value === undefined) return true;
  return numberRange(value, path, ctx, min, max);
}

function positiveInteger(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): value is number {
  if (!isInteger(value)) {
    ctx.invalidType(path, "an integer", value);
    return false;
  }

  if (value < 1) {
    ctx.add(
      path,
      "INVALID_RANGE",
      `${path} must be at least 1.`,
      value,
    );
    return false;
  }

  return true;
}

function nonNegativeInteger(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): value is number {
  if (!isInteger(value)) {
    ctx.invalidType(path, "an integer", value);
    return false;
  }

  if (value < 0) {
    ctx.add(
      path,
      "INVALID_RANGE",
      `${path} must be zero or greater.`,
      value,
    );
    return false;
  }

  return true;
}

function enumValue(
  value: unknown,
  path: string,
  ctx: ValidationContext,
  allowed: ReadonlySet<string>,
): value is string {
  if (!isString(value)) {
    ctx.invalidType(path, "a string", value);
    return false;
  }

  if (!allowed.has(value)) {
    ctx.invalidValue(path, `${path} has unsupported value "${value}".`, value);
    return false;
  }

  return true;
}

function stringArray(
  value: unknown,
  path: string,
  ctx: ValidationContext,
  required = false,
  nonEmpty = false,
): value is string[] {
  if (value === undefined) {
    if (required) ctx.required(path);
    return !required;
  }

  if (!Array.isArray(value) || !value.every(isString)) {
    ctx.invalidType(path, "an array of strings", value);
    return false;
  }

  if (nonEmpty && value.length === 0) {
    ctx.add(path, "EMPTY_ARRAY", `${path} must not be empty.`, value);
    return false;
  }

  return true;
}

function uniqueIds(
  values: Array<{ id: string }>,
  path: string,
  ctx: ValidationContext,
): void {
  const seen = new Set<string>();

  values.forEach((item, index) => {
    if (seen.has(item.id)) {
      ctx.add(
        `${path}[${index}].id`,
        "DUPLICATE_ID",
        `Duplicate id "${item.id}" in ${path}.`,
        item.id,
      );
    }
    seen.add(item.id);
  });
}

function strictOrder(
  values: Array<{ order: number }>,
  path: string,
  ctx: ValidationContext,
): void {
  const seen = new Set<number>();

  values.forEach((item, index) => {
    if (!isInteger(item.order) || item.order < 1) {
      ctx.add(
        `${path}[${index}].order`,
        "INVALID_ORDER",
        "Order must be a positive integer.",
        item.order,
      );
    } else if (seen.has(item.order)) {
      ctx.add(
        `${path}[${index}].order`,
        "INVALID_ORDER",
        `Duplicate order value ${item.order}.`,
        item.order,
      );
    }
    seen.add(item.order);
  });
}

function validateCurriculum(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType(path, "an object", value);
    return;
  }

  requiredString(value.curriculumId, `${path}.curriculumId`, ctx);
  requiredString(value.lessonId, `${path}.lessonId`, ctx);
  requiredString(value.lessonTitle, `${path}.lessonTitle`, ctx);

  [
    "resourceId",
    "academicProfileId",
    "levelId",
    "sublevelId",
    "unitId",
    "curriculumTitle",
    "levelTitle",
    "sublevelTitle",
    "unitTitle",
    "sourceBookTitle",
    "sourceEdition",
  ].forEach((field) => optionalString(value[field], `${path}.${field}`, ctx));

  if (value.sourceLanguage !== undefined) {
    enumValue(value.sourceLanguage, `${path}.sourceLanguage`, ctx, LANGUAGE_CODES);
  }

  if (value.pageRange !== undefined) {
    if (!isRecord(value.pageRange)) {
      ctx.invalidType(`${path}.pageRange`, "an object", value.pageRange);
    } else {
      positiveInteger(
        value.pageRange.startPage,
        `${path}.pageRange.startPage`,
        ctx,
      );
      positiveInteger(
        value.pageRange.endPage,
        `${path}.pageRange.endPage`,
        ctx,
      );

      if (
        isInteger(value.pageRange.startPage) &&
        isInteger(value.pageRange.endPage) &&
        value.pageRange.endPage < value.pageRange.startPage
      ) {
        ctx.add(
          `${path}.pageRange.endPage`,
          "INVALID_RANGE",
          "End page must be greater than or equal to start page.",
          value.pageRange.endPage,
        );
      }
    }
  }
}

function validateObjective(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType(path, "an object", value);
    return;
  }

  requiredString(value.id, `${path}.id`, ctx);
  enumValue(value.type, `${path}.type`, ctx, OBJECTIVE_TYPES);
  requiredString(value.statement, `${path}.statement`, ctx);
  requiredString(value.measurableOutcome, `${path}.measurableOutcome`, ctx);
  numberRange(value.successThreshold, `${path}.successThreshold`, ctx, 0, 100);
  requiredBoolean(value.required, `${path}.required`, ctx);
  enumValue(value.priority, `${path}.priority`, ctx, OBJECTIVE_PRIORITIES);
  stringArray(value.relatedContentIds, `${path}.relatedContentIds`, ctx);
  stringArray(
    value.prerequisiteObjectiveIds,
    `${path}.prerequisiteObjectiveIds`,
    ctx,
  );
}

function validateVocabulary(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType(path, "an object", value);
    return;
  }

  requiredString(value.id, `${path}.id`, ctx);
  requiredString(value.term, `${path}.term`, ctx);
  enumValue(value.language, `${path}.language`, ctx, LANGUAGE_CODES);
  requiredBoolean(value.required, `${path}.required`, ctx);

  [
    "definition",
    "translation",
    "partOfSpeech",
    "pronunciationGuide",
    "phoneticTranscription",
    "imagePrompt",
    "audioReference",
  ].forEach((field) => optionalString(value[field], `${path}.${field}`, ctx));

  if (value.translationLanguage !== undefined) {
    enumValue(
      value.translationLanguage,
      `${path}.translationLanguage`,
      ctx,
      LANGUAGE_CODES,
    );
  }

  stringArray(value.examples, `${path}.examples`, ctx, true);
  stringArray(value.acceptableVariants, `${path}.acceptableVariants`, ctx);
  stringArray(value.commonErrors, `${path}.commonErrors`, ctx);
}

function validateGrammar(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType(path, "an object", value);
    return;
  }

  requiredString(value.id, `${path}.id`, ctx);
  requiredString(value.title, `${path}.title`, ctx);
  requiredString(value.description, `${path}.description`, ctx);
  requiredBoolean(value.required, `${path}.required`, ctx);
  optionalString(value.form, `${path}.form`, ctx);
  optionalString(value.meaning, `${path}.meaning`, ctx);
  optionalString(value.use, `${path}.use`, ctx);
  stringArray(value.examples, `${path}.examples`, ctx, true);
  stringArray(value.negativeExamples, `${path}.negativeExamples`, ctx);
  stringArray(value.commonErrors, `${path}.commonErrors`, ctx);
}

function validateFunction(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType(path, "an object", value);
    return;
  }

  requiredString(value.id, `${path}.id`, ctx);
  requiredString(value.name, `${path}.name`, ctx);
  requiredString(value.description, `${path}.description`, ctx);
  stringArray(value.modelExpressions, `${path}.modelExpressions`, ctx, true, true);
  stringArray(value.situationalContexts, `${path}.situationalContexts`, ctx);
  requiredBoolean(value.required, `${path}.required`, ctx);

  if (
    value.expectedRegister !== undefined &&
    !["formal", "neutral", "informal", "mixed"].includes(
      String(value.expectedRegister),
    )
  ) {
    ctx.invalidValue(
      `${path}.expectedRegister`,
      "Expected register must be formal, neutral, informal, or mixed.",
      value.expectedRegister,
    );
  }
}

function validateSkill(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType(path, "an object", value);
    return;
  }

  requiredString(value.id, `${path}.id`, ctx);
  enumValue(value.skill, `${path}.skill`, ctx, SKILLS);
  requiredString(value.description, `${path}.description`, ctx);
  requiredBoolean(value.required, `${path}.required`, ctx);
  optionalNumberRange(
    value.successThreshold,
    `${path}.successThreshold`,
    ctx,
    0,
    100,
  );
}

function validateExpectedResponse(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType(path, "an object", value);
    return;
  }

  requiredString(value.id, `${path}.id`, ctx);

  [
    "exactAnswers",
    "acceptableAnswers",
    "requiredKeywords",
    "forbiddenKeywords",
  ].forEach((field) => stringArray(value[field], `${path}.${field}`, ctx));

  optionalString(value.semanticDescription, `${path}.semanticDescription`, ctx);
  optionalString(value.modelAnswer, `${path}.modelAnswer`, ctx);
  optionalBoolean(value.caseSensitive, `${path}.caseSensitive`, ctx);
  optionalBoolean(
    value.allowMinorSpellingErrors,
    `${path}.allowMinorSpellingErrors`,
    ctx,
  );
  optionalBoolean(
    value.allowEquivalentMeaning,
    `${path}.allowEquivalentMeaning`,
    ctx,
  );

  if (!isRecord(value.evaluationFocus)) {
    ctx.invalidType(
      `${path}.evaluationFocus`,
      "an object",
      value.evaluationFocus,
    );
  } else {
    const evaluationFocus = value.evaluationFocus;

    [
      "meaning",
      "grammar",
      "vocabulary",
      "pronunciation",
      "fluency",
      "spelling",
      "punctuation",
    ].forEach((field) =>
      requiredBoolean(
        evaluationFocus[field],
        `${path}.evaluationFocus.${field}`,
        ctx,
      ),
    );
  }

  const answerSources = [
    value.exactAnswers,
    value.acceptableAnswers,
    value.requiredKeywords,
  ];

  const hasArrayAnswer = answerSources.some(
    (item) => Array.isArray(item) && item.length > 0,
  );

  if (
    !hasArrayAnswer &&
    !isNonEmptyString(value.semanticDescription) &&
    !isNonEmptyString(value.modelAnswer)
  ) {
    ctx.invalidValue(
      path,
      "Expected response must define an answer, keywords, semantic description, or model answer.",
      value,
    );
  }
}

function validateSuccessRule(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType(path, "an object", value);
    return;
  }

  enumValue(value.type, `${path}.type`, ctx, ACTIVITY_SUCCESS_TYPES);
  optionalNumberRange(value.minimumScore, `${path}.minimumScore`, ctx, 0, 100);

  if (value.minimumCorrectAnswers !== undefined) {
    positiveInteger(
      value.minimumCorrectAnswers,
      `${path}.minimumCorrectAnswers`,
      ctx,
    );
  }

  if (value.minimumSuccessfulTurns !== undefined) {
    positiveInteger(
      value.minimumSuccessfulTurns,
      `${path}.minimumSuccessfulTurns`,
      ctx,
    );
  }

  optionalNumberRange(
    value.semanticThreshold,
    `${path}.semanticThreshold`,
    ctx,
    0,
    1,
  );

  optionalBoolean(
    value.requireTargetVocabulary,
    `${path}.requireTargetVocabulary`,
    ctx,
  );
  optionalBoolean(
    value.requireTargetGrammar,
    `${path}.requireTargetGrammar`,
    ctx,
  );
  optionalBoolean(
    value.requireUnderstandablePronunciation,
    `${path}.requireUnderstandablePronunciation`,
    ctx,
  );

  if (value.type === "minimum_score" && value.minimumScore === undefined) {
    ctx.required(`${path}.minimumScore`);
  }

  if (
    value.type === "minimum_correct_answers" &&
    value.minimumCorrectAnswers === undefined
  ) {
    ctx.required(`${path}.minimumCorrectAnswers`);
  }

  if (
    value.type === "minimum_successful_turns" &&
    value.minimumSuccessfulTurns === undefined
  ) {
    ctx.required(`${path}.minimumSuccessfulTurns`);
  }

  if (
    value.type === "semantic_match" &&
    value.semanticThreshold === undefined
  ) {
    ctx.required(`${path}.semanticThreshold`);
  }
}

function validateSupportStep(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType(path, "an object", value);
    return;
  }

  nonNegativeInteger(value.level, `${path}.level`, ctx);
  enumValue(value.type, `${path}.type`, ctx, SUPPORT_STEP_TYPES);
  optionalString(value.instruction, `${path}.instruction`, ctx);
  optionalString(value.content, `${path}.content`, ctx);
  optionalBoolean(value.useL1, `${path}.useL1`, ctx);

  if (value.maximumUses !== undefined) {
    positiveInteger(value.maximumUses, `${path}.maximumUses`, ctx);
  }
}

function validateActivity(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType(path, "an object", value);
    return;
  }

  requiredString(value.id, `${path}.id`, ctx);
  positiveInteger(value.order, `${path}.order`, ctx);
  enumValue(value.type, `${path}.type`, ctx, ACTIVITY_TYPES);
  requiredString(value.title, `${path}.title`, ctx);
  requiredString(value.purpose, `${path}.purpose`, ctx);
  requiredString(value.instruction, `${path}.instruction`, ctx);
  optionalString(value.teacherPrompt, `${path}.teacherPrompt`, ctx);

  stringArray(
    value.targetObjectiveIds,
    `${path}.targetObjectiveIds`,
    ctx,
    true,
    true,
  );
  stringArray(value.targetVocabularyIds, `${path}.targetVocabularyIds`, ctx);
  stringArray(value.targetGrammarIds, `${path}.targetGrammarIds`, ctx);
  stringArray(value.targetFunctionIds, `${path}.targetFunctionIds`, ctx);

  enumValue(value.inputModality, `${path}.inputModality`, ctx, INPUT_MODALITIES);

  if (!Array.isArray(value.outputModalities) || value.outputModalities.length === 0) {
    ctx.add(
      `${path}.outputModalities`,
      "EMPTY_ARRAY",
      "Activity must have at least one output modality.",
      value.outputModalities,
    );
  } else {
    value.outputModalities.forEach((item, index) =>
      enumValue(
        item,
        `${path}.outputModalities[${index}]`,
        ctx,
        OUTPUT_MODALITIES,
      ),
    );
  }

  if (value.expectedResponses !== undefined) {
    if (!Array.isArray(value.expectedResponses)) {
      ctx.invalidType(
        `${path}.expectedResponses`,
        "an array",
        value.expectedResponses,
      );
    } else {
      value.expectedResponses.forEach((item, index) =>
        validateExpectedResponse(
          item,
          `${path}.expectedResponses[${index}]`,
          ctx,
        ),
      );
    }
  }

  nonNegativeInteger(value.minimumAttempts, `${path}.minimumAttempts`, ctx);
  positiveInteger(value.maximumAttempts, `${path}.maximumAttempts`, ctx);

  if (
    isInteger(value.minimumAttempts) &&
    isInteger(value.maximumAttempts) &&
    value.minimumAttempts > value.maximumAttempts
  ) {
    ctx.add(
      `${path}.minimumAttempts`,
      "INVALID_RANGE",
      "Minimum attempts cannot exceed maximum attempts.",
      value.minimumAttempts,
    );
  }

  positiveInteger(value.estimatedMinutes, `${path}.estimatedMinutes`, ctx);
  requiredBoolean(value.required, `${path}.required`, ctx);

  if (!Array.isArray(value.supportSteps)) {
    ctx.invalidType(`${path}.supportSteps`, "an array", value.supportSteps);
  } else {
    value.supportSteps.forEach((item, index) =>
      validateSupportStep(item, `${path}.supportSteps[${index}]`, ctx),
    );
  }

  validateSuccessRule(value.successRule, `${path}.successRule`, ctx);
  optionalBoolean(value.allowSkip, `${path}.allowSkip`, ctx);
  optionalBoolean(
    value.allowAlternativeActivity,
    `${path}.allowAlternativeActivity`,
    ctx,
  );
  optionalString(
    value.alternativeActivityId,
    `${path}.alternativeActivityId`,
    ctx,
  );

  if (
    value.allowAlternativeActivity === true &&
    !isNonEmptyString(value.alternativeActivityId)
  ) {
    ctx.required(`${path}.alternativeActivityId`);
  }
}

function validateStage(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType(path, "an object", value);
    return;
  }

  requiredString(value.id, `${path}.id`, ctx);
  positiveInteger(value.order, `${path}.order`, ctx);
  enumValue(value.type, `${path}.type`, ctx, STAGE_TYPES);
  requiredString(value.title, `${path}.title`, ctx);
  requiredString(value.purpose, `${path}.purpose`, ctx);
  stringArray(value.objectiveIds, `${path}.objectiveIds`, ctx, true);
  positiveInteger(value.estimatedMinutes, `${path}.estimatedMinutes`, ctx);
  requiredBoolean(value.required, `${path}.required`, ctx);
  requiredBoolean(value.skippable, `${path}.skippable`, ctx);

  if (!Array.isArray(value.activities)) {
    ctx.invalidType(`${path}.activities`, "an array", value.activities);
  } else {
    value.activities.forEach((item, index) =>
      validateActivity(item, `${path}.activities[${index}]`, ctx),
    );
  }

  if (!isRecord(value.completionRule)) {
    ctx.invalidType(
      `${path}.completionRule`,
      "an object",
      value.completionRule,
    );
  } else {
    const completionRule = value.completionRule;

    enumValue(
      completionRule.type,
      `${path}.completionRule.type`,
      ctx,
      STAGE_COMPLETION_TYPES,
    );
    optionalNumberRange(
      completionRule.minimumScore,
      `${path}.completionRule.minimumScore`,
      ctx,
      0,
      100,
    );

    [
      "minimumSuccessfulActivities",
      "minimumCompletedActivities",
      "maximumMinutes",
    ].forEach((field) => {
      if (completionRule[field] !== undefined) {
        positiveInteger(
          completionRule[field],
          `${path}.completionRule.${field}`,
          ctx,
        );
      }
    });

    stringArray(
      completionRule.requiredActivityIds,
      `${path}.completionRule.requiredActivityIds`,
      ctx,
    );

    if (
      value.completionRule.type === "minimum_score_reached" &&
      completionRule.minimumScore === undefined
    ) {
      ctx.required(`${path}.completionRule.minimumScore`);
    }

    if (
      value.completionRule.type === "minimum_successes_reached" &&
      value.completionRule.minimumSuccessfulActivities === undefined
    ) {
      ctx.required(
        `${path}.completionRule.minimumSuccessfulActivities`,
      );
    }

    if (
      value.completionRule.type === "time_limit_reached" &&
      value.completionRule.maximumMinutes === undefined
    ) {
      ctx.required(`${path}.completionRule.maximumMinutes`);
    }
  }

  optionalString(value.entryMessage, `${path}.entryMessage`, ctx);
  optionalString(value.completionMessage, `${path}.completionMessage`, ctx);
}

function validateAssessment(
  value: unknown,
  path: string,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType(path, "an object", value);
    return;
  }

  enumValue(value.type, `${path}.type`, ctx, ASSESSMENT_TYPES);
  stringArray(value.criterionIds, `${path}.criterionIds`, ctx, true);

  if (!Array.isArray(value.criteria)) {
    ctx.invalidType(`${path}.criteria`, "an array", value.criteria);
  } else {
    value.criteria.forEach((criterion, index) => {
      const criterionPath = `${path}.criteria[${index}]`;

      if (!isRecord(criterion)) {
        ctx.invalidType(criterionPath, "an object", criterion);
        return;
      }

      requiredString(criterion.id, `${criterionPath}.id`, ctx);
      requiredString(criterion.name, `${criterionPath}.name`, ctx);
      requiredString(
        criterion.description,
        `${criterionPath}.description`,
        ctx,
      );
      stringArray(
        criterion.objectiveIds,
        `${criterionPath}.objectiveIds`,
        ctx,
        true,
        true,
      );
      numberRange(
        criterion.maximumScore,
        `${criterionPath}.maximumScore`,
        ctx,
        0,
        100,
      );
      numberRange(
        criterion.passingScore,
        `${criterionPath}.passingScore`,
        ctx,
        0,
        100,
      );
      numberRange(criterion.weight, `${criterionPath}.weight`, ctx, 0, 100);

      if (
        isFiniteNumber(criterion.maximumScore) &&
        isFiniteNumber(criterion.passingScore) &&
        criterion.passingScore > criterion.maximumScore
      ) {
        ctx.add(
          `${criterionPath}.passingScore`,
          "INVALID_RANGE",
          "Passing score cannot exceed maximum score.",
          criterion.passingScore,
        );
      }
    });
  }

  numberRange(
    value.passingPercentage,
    `${path}.passingPercentage`,
    ctx,
    0,
    100,
  );
  requiredBoolean(value.allowRetry, `${path}.allowRetry`, ctx);

  if (value.maximumRetries !== undefined) {
    nonNegativeInteger(value.maximumRetries, `${path}.maximumRetries`, ctx);
  }

  requiredBoolean(
    value.recordDetailedErrors,
    `${path}.recordDetailedErrors`,
    ctx,
  );

  if (
    value.allowRetry === false &&
    isFiniteNumber(value.maximumRetries) &&
    value.maximumRetries > 0
  ) {
    ctx.add(
      `${path}.maximumRetries`,
      "POLICY_CONFLICT",
      "Maximum retries must be 0 or omitted when retries are disabled.",
      value.maximumRetries,
    );
  }
}

function validatePolicies(
  value: UnknownRecord,
  ctx: ValidationContext,
): void {
  const l1 = value.l1Policy;

  if (!isRecord(l1)) {
    ctx.invalidType("l1Policy", "an object", l1);
  } else {
    requiredBoolean(l1.enabled, "l1Policy.enabled", ctx);
    enumValue(l1.level, "l1Policy.level", ctx, L1_SUPPORT_LEVELS);

    if (l1.learnerL1 !== undefined) {
      enumValue(l1.learnerL1, "l1Policy.learnerL1", ctx, LANGUAGE_CODES);
    }

    if (!Array.isArray(l1.allowedTriggers)) {
      ctx.invalidType(
        "l1Policy.allowedTriggers",
        "an array",
        l1.allowedTriggers,
      );
    } else {
      l1.allowedTriggers.forEach((item, index) =>
        enumValue(
          item,
          `l1Policy.allowedTriggers[${index}]`,
          ctx,
          L1_SUPPORT_TRIGGERS,
        ),
      );
    }

    [
      "translateInstructions",
      "translateKeyVocabulary",
      "translateGrammarExplanations",
      "returnToTargetLanguageAfterSupport",
    ].forEach((field) =>
      requiredBoolean(l1[field], `l1Policy.${field}`, ctx),
    );

    if (l1.maximumConsecutiveL1Turns !== undefined) {
      positiveInteger(
        l1.maximumConsecutiveL1Turns,
        "l1Policy.maximumConsecutiveL1Turns",
        ctx,
      );
    }

    if (l1.enabled === false && l1.level !== "disabled") {
      ctx.add(
        "l1Policy.level",
        "POLICY_CONFLICT",
        "L1 level must be disabled when L1 support is disabled.",
        l1.level,
      );
    }

    if (l1.enabled === true && l1.level === "disabled") {
      ctx.add(
        "l1Policy.level",
        "POLICY_CONFLICT",
        "L1 level cannot be disabled when L1 support is enabled.",
        l1.level,
      );
    }
  }

  const correction = value.correctionPolicy;

  if (!isRecord(correction)) {
    ctx.invalidType("correctionPolicy", "an object", correction);
  } else {
    enumValue(
      correction.defaultTiming,
      "correctionPolicy.defaultTiming",
      ctx,
      CORRECTION_TIMINGS,
    );

    if (!Array.isArray(correction.priorityFocuses)) {
      ctx.invalidType(
        "correctionPolicy.priorityFocuses",
        "an array",
        correction.priorityFocuses,
      );
    } else {
      correction.priorityFocuses.forEach((item, index) =>
        enumValue(
          item,
          `correctionPolicy.priorityFocuses[${index}]`,
          ctx,
          CORRECTION_FOCUSES,
        ),
      );
    }

    [
      "interruptForMeaningBreakdown",
      "interruptForTargetLanguageError",
      "protectSpeakingFluency",
      "usePositiveFraming",
      "askLearnerToSelfCorrect",
      "provideModelAfterFailedSelfCorrection",
    ].forEach((field) =>
      requiredBoolean(
        correction[field],
        `correctionPolicy.${field}`,
        ctx,
      ),
    );
  }

  const adaptation = value.adaptationPolicy;

  if (!isRecord(adaptation)) {
    ctx.invalidType("adaptationPolicy", "an object", adaptation);
  } else {
    [
      "allowDifficultyAdjustment",
      "allowActivityReplacement",
      "allowStageSkipping",
      "allowPrerequisiteReview",
      "protectRequiredObjectives",
    ].forEach((field) =>
      requiredBoolean(
        adaptation[field],
        `adaptationPolicy.${field}`,
        ctx,
      ),
    );

    [
      "reduceDifficultyAfterFailedAttempts",
      "increaseDifficultyAfterSuccessfulAttempts",
      "maximumRetriesPerActivity",
      "maximumSupportLevel",
    ].forEach((field) =>
      nonNegativeInteger(
        adaptation[field],
        `adaptationPolicy.${field}`,
        ctx,
      ),
    );
  }

  const tone = value.teachingTone;

  if (!isRecord(tone)) {
    ctx.invalidType("teachingTone", "an object", tone);
  } else {
    enumValue(tone.primary, "teachingTone.primary", ctx, PRIMARY_TONES);

    if (tone.secondary !== undefined) {
      if (!Array.isArray(tone.secondary)) {
        ctx.invalidType(
          "teachingTone.secondary",
          "an array",
          tone.secondary,
        );
      } else {
        tone.secondary.forEach((item, index) =>
          enumValue(
            item,
            `teachingTone.secondary[${index}]`,
            ctx,
            SECONDARY_TONES,
          ),
        );
      }
    }

    stringArray(tone.avoid, "teachingTone.avoid", ctx);
    optionalBoolean(
      tone.useLearnerName,
      "teachingTone.useLearnerName",
      ctx,
    );

    if (tone.maximumSentenceLength !== undefined) {
      positiveInteger(
        tone.maximumSentenceLength,
        "teachingTone.maximumSentenceLength",
        ctx,
      );
    }

    if (
      tone.praiseFrequency !== undefined &&
      !["low", "moderate", "high"].includes(String(tone.praiseFrequency))
    ) {
      ctx.invalidValue(
        "teachingTone.praiseFrequency",
        "Praise frequency must be low, moderate, or high.",
        tone.praiseFrequency,
      );
    }
  }
}

function validateCompletionCriteria(
  value: unknown,
  ctx: ValidationContext,
): void {
  if (!isRecord(value)) {
    ctx.invalidType("completionCriteria", "an object", value);
    return;
  }

  numberRange(
    value.minimumLessonScore,
    "completionCriteria.minimumLessonScore",
    ctx,
    0,
    100,
  );
  numberRange(
    value.minimumObjectiveMastery,
    "completionCriteria.minimumObjectiveMastery",
    ctx,
    0,
    100,
  );
  stringArray(
    value.requiredObjectiveIds,
    "completionCriteria.requiredObjectiveIds",
    ctx,
    true,
  );
  stringArray(
    value.requiredActivityIds,
    "completionCriteria.requiredActivityIds",
    ctx,
  );
  requiredBoolean(
    value.requireAssessmentCompletion,
    "completionCriteria.requireAssessmentCompletion",
    ctx,
  );
  optionalBoolean(
    value.requireSpeakingParticipation,
    "completionCriteria.requireSpeakingParticipation",
    ctx,
  );
  requiredBoolean(
    value.allowCompletionWithMinorGaps,
    "completionCriteria.allowCompletionWithMinorGaps",
    ctx,
  );
}

function validateReferences(
  lesson: TeachingBrainLesson,
  ctx: ValidationContext,
): void {
  const objectiveIds = new Set(lesson.objectives.map((item) => item.id));
  const vocabularyIds = new Set(lesson.vocabulary.map((item) => item.id));
  const grammarIds = new Set(lesson.grammar.map((item) => item.id));
  const functionIds = new Set(lesson.functions.map((item) => item.id));
  const criterionIds = new Set(
    lesson.assessment.criteria.map((item) => item.id),
  );

  const allActivities = lesson.stages.flatMap((stage) => stage.activities);
  const activityIds = new Set(allActivities.map((item) => item.id));

  lesson.objectives.forEach((objective, objectiveIndex) => {
    objective.prerequisiteObjectiveIds?.forEach((id, idIndex) => {
      if (!objectiveIds.has(id)) {
        ctx.brokenReference(
          `objectives[${objectiveIndex}].prerequisiteObjectiveIds[${idIndex}]`,
          id,
          "objective",
        );
      }

      if (id === objective.id) {
        ctx.invalidValue(
          `objectives[${objectiveIndex}].prerequisiteObjectiveIds[${idIndex}]`,
          "An objective cannot depend on itself.",
          id,
        );
      }
    });
  });

  lesson.stages.forEach((stage, stageIndex) => {
    const stageActivityIds = new Set(
      stage.activities.map((activity) => activity.id),
    );

    stage.objectiveIds.forEach((id, index) => {
      if (!objectiveIds.has(id)) {
        ctx.brokenReference(
          `stages[${stageIndex}].objectiveIds[${index}]`,
          id,
          "objective",
        );
      }
    });

    stage.completionRule.requiredActivityIds?.forEach((id, index) => {
      if (!stageActivityIds.has(id)) {
        ctx.brokenReference(
          `stages[${stageIndex}].completionRule.requiredActivityIds[${index}]`,
          id,
          "activity in the same stage",
        );
      }
    });

    stage.activities.forEach((activity, activityIndex) => {
      const base = `stages[${stageIndex}].activities[${activityIndex}]`;

      activity.targetObjectiveIds.forEach((id, index) => {
        if (!objectiveIds.has(id)) {
          ctx.brokenReference(
            `${base}.targetObjectiveIds[${index}]`,
            id,
            "objective",
          );
        }
      });

      activity.targetVocabularyIds?.forEach((id, index) => {
        if (!vocabularyIds.has(id)) {
          ctx.brokenReference(
            `${base}.targetVocabularyIds[${index}]`,
            id,
            "vocabulary item",
          );
        }
      });

      activity.targetGrammarIds?.forEach((id, index) => {
        if (!grammarIds.has(id)) {
          ctx.brokenReference(
            `${base}.targetGrammarIds[${index}]`,
            id,
            "grammar target",
          );
        }
      });

      activity.targetFunctionIds?.forEach((id, index) => {
        if (!functionIds.has(id)) {
          ctx.brokenReference(
            `${base}.targetFunctionIds[${index}]`,
            id,
            "language function",
          );
        }
      });

      if (
        activity.alternativeActivityId &&
        !activityIds.has(activity.alternativeActivityId)
      ) {
        ctx.brokenReference(
          `${base}.alternativeActivityId`,
          activity.alternativeActivityId,
          "activity",
        );
      }

      if (activity.alternativeActivityId === activity.id) {
        ctx.invalidValue(
          `${base}.alternativeActivityId`,
          "An activity cannot use itself as its alternative.",
          activity.alternativeActivityId,
        );
      }
    });
  });

  lesson.assessment.criterionIds.forEach((id, index) => {
    if (!criterionIds.has(id)) {
      ctx.brokenReference(
        `assessment.criterionIds[${index}]`,
        id,
        "assessment criterion",
      );
    }
  });

  lesson.assessment.criteria.forEach((criterion, criterionIndex) => {
    criterion.objectiveIds.forEach((id, index) => {
      if (!objectiveIds.has(id)) {
        ctx.brokenReference(
          `assessment.criteria[${criterionIndex}].objectiveIds[${index}]`,
          id,
          "objective",
        );
      }
    });
  });

  lesson.completionCriteria.requiredObjectiveIds.forEach((id, index) => {
    if (!objectiveIds.has(id)) {
      ctx.brokenReference(
        `completionCriteria.requiredObjectiveIds[${index}]`,
        id,
        "objective",
      );
    }
  });

  lesson.completionCriteria.requiredActivityIds?.forEach((id, index) => {
    if (!activityIds.has(id)) {
      ctx.brokenReference(
        `completionCriteria.requiredActivityIds[${index}]`,
        id,
        "activity",
      );
    }
  });
}

function validateIntegrity(
  lesson: TeachingBrainLesson,
  ctx: ValidationContext,
): void {
  uniqueIds(lesson.objectives, "objectives", ctx);
  uniqueIds(lesson.vocabulary, "vocabulary", ctx);
  uniqueIds(lesson.grammar, "grammar", ctx);
  uniqueIds(lesson.functions, "functions", ctx);
  uniqueIds(lesson.skills, "skills", ctx);
  uniqueIds(lesson.stages, "stages", ctx);
  strictOrder(lesson.stages, "stages", ctx);

  lesson.stages.forEach((stage, stageIndex) => {
    uniqueIds(stage.activities, `stages[${stageIndex}].activities`, ctx);
    strictOrder(stage.activities, `stages[${stageIndex}].activities`, ctx);
  });

  const allActivities = lesson.stages.flatMap((stage) => stage.activities);
  uniqueIds(allActivities, "all lesson activities", ctx);

  uniqueIds(lesson.assessment.criteria, "assessment.criteria", ctx);

  if (lesson.curriculum.lessonId !== lesson.id) {
    ctx.invalidValue(
      "curriculum.lessonId",
      "curriculum.lessonId must match lesson.id.",
      lesson.curriculum.lessonId,
    );
  }

  const stageMinutes = lesson.stages.reduce(
    (total, stage) => total + stage.estimatedMinutes,
    0,
  );

  if (stageMinutes > lesson.estimatedMinutes * 1.5) {
    ctx.add(
      "estimatedMinutes",
      "INVALID_RANGE",
      `Stage durations total ${stageMinutes} minutes, much more than lesson duration ${lesson.estimatedMinutes}.`,
      lesson.estimatedMinutes,
    );
  }

  const weightTotal = lesson.assessment.criteria.reduce(
    (total, criterion) => total + criterion.weight,
    0,
  );

  if (
    lesson.assessment.criteria.length > 0 &&
    Math.abs(weightTotal - 100) > 0.01
  ) {
    ctx.invalidValue(
      "assessment.criteria",
      `Assessment criterion weights must total 100. Current total: ${weightTotal}.`,
      weightTotal,
    );
  }

  validateReferences(lesson, ctx);
}

export function validateTeachingBrainLesson(
  value: unknown,
): LessonValidationReport {
  const ctx = new ValidationContext();

  if (!isRecord(value)) {
    ctx.invalidType("lesson", "an object", value);
    return { valid: false, issues: ctx.issues };
  }

  if (value.schemaVersion !== "1.0") {
    ctx.add(
      "schemaVersion",
      "UNSUPPORTED_SCHEMA_VERSION",
      'schemaVersion must be exactly "1.0".',
      value.schemaVersion,
    );
  }

  requiredString(value.id, "id", ctx);
  validateCurriculum(value.curriculum, "curriculum", ctx);
  requiredString(value.title, "title", ctx);
  optionalString(value.description, "description", ctx);
  enumValue(value.targetLanguage, "targetLanguage", ctx, LANGUAGE_CODES);
  requiredString(value.level, "level", ctx);
  positiveInteger(value.estimatedMinutes, "estimatedMinutes", ctx);

  if (!Array.isArray(value.objectives) || value.objectives.length === 0) {
    ctx.add(
      "objectives",
      "EMPTY_ARRAY",
      "Lesson must contain at least one objective.",
      value.objectives,
    );
  } else {
    value.objectives.forEach((item, index) =>
      validateObjective(item, `objectives[${index}]`, ctx),
    );
  }

  stringArray(value.prerequisites, "prerequisites", ctx, true);

  const collections: Array<{
    key: "vocabulary" | "grammar" | "functions" | "skills";
    validate: (
      item: unknown,
      path: string,
      context: ValidationContext,
    ) => void;
  }> = [
    { key: "vocabulary", validate: validateVocabulary },
    { key: "grammar", validate: validateGrammar },
    { key: "functions", validate: validateFunction },
    { key: "skills", validate: validateSkill },
  ];

  collections.forEach(({ key, validate }) => {
    const collection = value[key];

    if (!Array.isArray(collection)) {
      ctx.invalidType(key, "an array", collection);
      return;
    }

    collection.forEach((item, index) =>
      validate(item, `${key}[${index}]`, ctx),
    );
  });

  if (!Array.isArray(value.stages) || value.stages.length === 0) {
    ctx.add(
      "stages",
      "EMPTY_ARRAY",
      "Lesson must contain at least one stage.",
      value.stages,
    );
  } else {
    value.stages.forEach((item, index) =>
      validateStage(item, `stages[${index}]`, ctx),
    );
  }

  validateAssessment(value.assessment, "assessment", ctx);
  validateCompletionCriteria(value.completionCriteria, ctx);
  validatePolicies(value, ctx);
  enumValue(value.status, "status", ctx, ENTITY_STATUSES);
  optionalString(value.sourceBlueprintId, "sourceBlueprintId", ctx);
  optionalString(
    value.sourceBlueprintVersion,
    "sourceBlueprintVersion",
    ctx,
  );

  if (!isISODateTime(value.createdAt)) {
    ctx.invalidType("createdAt", "a valid ISO date-time string", value.createdAt);
  }

  if (!isISODateTime(value.updatedAt)) {
    ctx.invalidType("updatedAt", "a valid ISO date-time string", value.updatedAt);
  }

  if (ctx.issues.length === 0) {
    validateIntegrity(value as TeachingBrainLesson, ctx);
  }

  return {
    valid: ctx.issues.length === 0,
    issues: ctx.issues,
  };
}

export function safeParseTeachingBrainLesson(
  value: unknown,
): LessonParseResult {
  const report = validateTeachingBrainLesson(value);

  if (!report.valid) {
    return {
      success: false,
      issues: report.issues,
    };
  }

  return {
    success: true,
    data: value as TeachingBrainLesson,
    issues: [],
  };
}

export class TeachingBrainLessonValidationError extends Error {
  readonly issues: LessonValidationIssue[];

  constructor(
    message: string,
    issues: LessonValidationIssue[],
  ) {
    const details = issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");

    super(details ? `${message}\n${details}` : message);
    this.name = "TeachingBrainLessonValidationError";
    this.issues = issues;
  }
}

export function parseTeachingBrainLesson(
  value: unknown,
): TeachingBrainLesson {
  const result = safeParseTeachingBrainLesson(value);

  if (!result.success) {
    throw new TeachingBrainLessonValidationError(
      "Teaching Brain lesson validation failed.",
      result.issues,
    );
  }

  return result.data;
}

export function assertValidTeachingBrainLesson(
  value: unknown,
): asserts value is TeachingBrainLesson {
  parseTeachingBrainLesson(value);
}

export function validateLessonForTeachingBrain(
  value: unknown,
): TeachingBrainResult<TeachingBrainLesson> {
  const parsed = safeParseTeachingBrainLesson(value);

  if (parsed.success) {
    return {
      ok: true,
      data: parsed.data,
    };
  }

  const error: TeachingBrainError = {
    code: "INVALID_LESSON",
    message: "The Teaching Brain lesson is invalid.",
    recoverable: true,
    details: {
      issues: parsed.issues,
    },
  };

  return {
    ok: false,
    error,
  };
}

export function formatLessonValidationIssues(
  issues: LessonValidationIssue[],
): string {
  if (issues.length === 0) {
    return "No validation issues.";
  }

  return issues
    .map(
      (issue, index) =>
        `${index + 1}. [${issue.code}] ${issue.path}: ${issue.message}`,
    )
    .join("\n");
}

export function getStageById(
  lesson: TeachingBrainLesson,
  stageId: string,
): TeachingStage | undefined {
  return lesson.stages.find((stage) => stage.id === stageId);
}

export function getActivityById(
  lesson: TeachingBrainLesson,
  activityId: string,
): TeachingActivity | undefined {
  for (const stage of lesson.stages) {
    const activity = stage.activities.find(
      (candidate) => candidate.id === activityId,
    );

    if (activity) return activity;
  }

  return undefined;
}
