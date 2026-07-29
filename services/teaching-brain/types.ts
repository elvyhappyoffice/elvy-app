/**
 * Elvy Teaching Brain
 * Core domain contracts
 *
 * This file defines the shared data language used by:
 * - Elvy Teaching Blueprints
 * - Teaching session engine
 * - Learner response evaluator
 * - Teaching decision engine
 * - Future Elvy Director
 *
 * Keep this file independent from React, Next.js, Supabase,
 * animation libraries, and AI-provider SDKs.
 */

/* -------------------------------------------------------------------------- */
/*                                  Utilities                                 */
/* -------------------------------------------------------------------------- */

export type ISODateTimeString = string;
export type UUID = string;

export type ConfidenceScore = number;
export type ProgressScore = number;
export type PercentageScore = number;

export type LanguageCode =
  | "en"
  | "ar"
  | "fr"
  | "es"
  | "de"
  | "it"
  | "pt"
  | "tr"
  | "nl"
  | "other";

export type CEFRLevel =
  | "pre_a1"
  | "a1"
  | "a2"
  | "b1"
  | "b2"
  | "c1"
  | "c2"
  | "mixed"
  | "custom";

export type TeachingMode =
  | "text"
  | "voice"
  | "multimodal"
  | "classroom";

export type DifficultyLevel =
  | "very_easy"
  | "easy"
  | "appropriate"
  | "challenging"
  | "very_challenging";

export type SessionStatus =
  | "not_started"
  | "active"
  | "paused"
  | "completed"
  | "abandoned"
  | "expired";

export type AttemptOutcome =
  | "successful"
  | "partially_successful"
  | "unsuccessful"
  | "not_evaluated";

export type EntityStatus =
  | "draft"
  | "active"
  | "suspended"
  | "archived";

/* -------------------------------------------------------------------------- */
/*                              Curriculum Context                            */
/* -------------------------------------------------------------------------- */

export type CurriculumReference = {
  curriculumId: UUID;
  resourceId?: UUID;
  academicProfileId?: UUID;

  levelId?: UUID;
  sublevelId?: UUID;
  unitId?: UUID;
  lessonId: UUID;

  curriculumTitle?: string;
  levelTitle?: string;
  sublevelTitle?: string;
  unitTitle?: string;
  lessonTitle: string;

  sourceBookTitle?: string;
  sourceEdition?: string;
  sourceLanguage?: LanguageCode;
  pageRange?: {
    startPage: number;
    endPage: number;
  };
};

/* -------------------------------------------------------------------------- */
/*                            Objectives and Content                          */
/* -------------------------------------------------------------------------- */

export type TeachingObjectiveType =
  | "knowledge"
  | "comprehension"
  | "vocabulary"
  | "grammar"
  | "function"
  | "pronunciation"
  | "listening"
  | "speaking"
  | "reading"
  | "writing"
  | "interaction"
  | "culture"
  | "study_skill"
  | "custom";

export type TeachingObjective = {
  id: string;
  type: TeachingObjectiveType;
  statement: string;

  measurableOutcome: string;
  successThreshold: number;

  required: boolean;
  priority: "essential" | "important" | "extension";

  relatedContentIds?: string[];
  prerequisiteObjectiveIds?: string[];

  metadata?: Record<string, unknown>;
};

export type VocabularyItem = {
  id: string;
  term: string;
  language: LanguageCode;

  definition?: string;
  translation?: string;
  translationLanguage?: LanguageCode;

  partOfSpeech?: string;
  pronunciationGuide?: string;
  phoneticTranscription?: string;

  examples: string[];
  acceptableVariants?: string[];
  commonErrors?: string[];

  imagePrompt?: string;
  audioReference?: string;

  required: boolean;
  difficulty?: DifficultyLevel;
};

export type GrammarTarget = {
  id: string;
  title: string;
  description: string;

  form?: string;
  meaning?: string;
  use?: string;

  examples: string[];
  negativeExamples?: string[];
  commonErrors?: string[];

  required: boolean;
  difficulty?: DifficultyLevel;
};

export type LanguageFunction = {
  id: string;
  name: string;
  description: string;

  modelExpressions: string[];
  situationalContexts?: string[];
  expectedRegister?: "formal" | "neutral" | "informal" | "mixed";

  required: boolean;
};

export type LessonSkill =
  | "listening"
  | "speaking"
  | "reading"
  | "writing"
  | "pronunciation"
  | "grammar"
  | "vocabulary"
  | "interaction"
  | "culture";

export type SkillTarget = {
  id: string;
  skill: LessonSkill;
  description: string;
  required: boolean;
  successThreshold?: number;
};

/* -------------------------------------------------------------------------- */
/*                              Teaching Policies                             */
/* -------------------------------------------------------------------------- */

export type TeachingTone = {
  primary:
    | "calm"
    | "encouraging"
    | "friendly"
    | "energetic"
    | "formal"
    | "playful";

  secondary?: Array<
    | "patient"
    | "warm"
    | "humorous"
    | "supportive"
    | "direct"
    | "gentle"
    | "enthusiastic"
  >;

  avoid?: string[];

  maximumSentenceLength?: number;
  useLearnerName?: boolean;
  praiseFrequency?: "low" | "moderate" | "high";
};

export type L1SupportLevel =
  | "disabled"
  | "emergency_only"
  | "limited"
  | "moderate"
  | "frequent";

export type L1SupportTrigger =
  | "learner_requests_help"
  | "instruction_not_understood"
  | "repeated_failure"
  | "complex_grammar"
  | "safety_or_critical_information"
  | "beginner_support"
  | "teacher_override";

export type L1SupportPolicy = {
  enabled: boolean;
  learnerL1?: LanguageCode;
  level: L1SupportLevel;

  allowedTriggers: L1SupportTrigger[];

  translateInstructions: boolean;
  translateKeyVocabulary: boolean;
  translateGrammarExplanations: boolean;

  maximumConsecutiveL1Turns?: number;

  returnToTargetLanguageAfterSupport: boolean;
};

export type CorrectionTiming =
  | "immediate"
  | "delayed"
  | "end_of_activity"
  | "end_of_stage"
  | "only_when_requested";

export type CorrectionFocus =
  | "meaning"
  | "grammar"
  | "vocabulary"
  | "pronunciation"
  | "fluency"
  | "spelling"
  | "punctuation";

export type CorrectionPolicy = {
  defaultTiming: CorrectionTiming;

  priorityFocuses: CorrectionFocus[];
  ignoredMinorErrors?: CorrectionFocus[];

  interruptForMeaningBreakdown: boolean;
  interruptForTargetLanguageError: boolean;
  protectSpeakingFluency: boolean;

  maximumCorrectionsPerTurn?: number;
  maximumCorrectionsPerActivity?: number;

  usePositiveFraming: boolean;
  askLearnerToSelfCorrect: boolean;
  provideModelAfterFailedSelfCorrection: boolean;
};

export type AdaptationPolicy = {
  allowDifficultyAdjustment: boolean;
  allowActivityReplacement: boolean;
  allowStageSkipping: boolean;
  allowPrerequisiteReview: boolean;

  reduceDifficultyAfterFailedAttempts: number;
  increaseDifficultyAfterSuccessfulAttempts: number;

  maximumRetriesPerActivity: number;
  maximumSupportLevel: number;

  protectRequiredObjectives: boolean;
};

/* -------------------------------------------------------------------------- */
/*                                Lesson Stages                               */
/* -------------------------------------------------------------------------- */

export type TeachingStageType =
  | "welcome"
  | "readiness_check"
  | "previous_lesson_review"
  | "warm_up"
  | "lesson_introduction"
  | "presentation"
  | "comprehension_check"
  | "guided_practice"
  | "communicative_practice"
  | "pronunciation_practice"
  | "listening_practice"
  | "reading_practice"
  | "writing_practice"
  | "feedback"
  | "assessment"
  | "summary"
  | "homework"
  | "goodbye"
  | "custom";

export type StageCompletionRuleType =
  | "all_required_activities_completed"
  | "minimum_score_reached"
  | "minimum_successes_reached"
  | "teacher_brain_decision"
  | "time_limit_reached"
  | "manual";

export type StageCompletionRule = {
  type: StageCompletionRuleType;

  minimumScore?: number;
  minimumSuccessfulActivities?: number;
  minimumCompletedActivities?: number;
  maximumMinutes?: number;

  requiredActivityIds?: string[];
};

export type TeachingStage = {
  id: string;
  order: number;

  type: TeachingStageType;
  title: string;
  purpose: string;

  objectiveIds: string[];
  estimatedMinutes: number;

  required: boolean;
  skippable: boolean;

  activities: TeachingActivity[];
  completionRule: StageCompletionRule;

  entryMessage?: string;
  completionMessage?: string;

  metadata?: Record<string, unknown>;
};

/* -------------------------------------------------------------------------- */
/*                            Teaching Activities                             */
/* -------------------------------------------------------------------------- */

export type TeachingActivityType =
  | "greeting"
  | "conversation"
  | "explanation"
  | "demonstration"
  | "modeling"
  | "repeat_after_me"
  | "question_answer"
  | "open_question"
  | "yes_no_question"
  | "multiple_choice"
  | "true_false"
  | "matching"
  | "sorting"
  | "gap_fill"
  | "sentence_building"
  | "pronunciation"
  | "minimal_pairs"
  | "dictation"
  | "dialogue"
  | "role_play"
  | "picture_description"
  | "storytelling"
  | "listening"
  | "reading"
  | "writing"
  | "quiz"
  | "game"
  | "review"
  | "reflection"
  | "custom";

export type InputModality =
  | "text"
  | "voice"
  | "choice"
  | "tap"
  | "drag"
  | "none";

export type OutputModality =
  | "speech"
  | "text"
  | "whiteboard"
  | "image"
  | "audio"
  | "video"
  | "animation";

export type ResponseEvaluationFocus = {
  meaning: boolean;
  grammar: boolean;
  vocabulary: boolean;
  pronunciation: boolean;
  fluency: boolean;
  spelling: boolean;
  punctuation: boolean;
};

export type ExpectedResponse = {
  id: string;

  exactAnswers?: string[];
  acceptableAnswers?: string[];
  requiredKeywords?: string[];
  forbiddenKeywords?: string[];

  semanticDescription?: string;
  modelAnswer?: string;

  caseSensitive?: boolean;
  allowMinorSpellingErrors?: boolean;
  allowEquivalentMeaning?: boolean;

  evaluationFocus: ResponseEvaluationFocus;
};

export type ActivitySuccessRuleType =
  | "single_correct_response"
  | "minimum_score"
  | "minimum_correct_answers"
  | "minimum_successful_turns"
  | "semantic_match"
  | "completion_only"
  | "manual";

export type ActivitySuccessRule = {
  type: ActivitySuccessRuleType;

  minimumScore?: number;
  minimumCorrectAnswers?: number;
  minimumSuccessfulTurns?: number;
  semanticThreshold?: number;

  requireTargetVocabulary?: boolean;
  requireTargetGrammar?: boolean;
  requireUnderstandablePronunciation?: boolean;
};

export type SupportStepType =
  | "wait"
  | "repeat_instruction"
  | "slow_down"
  | "simplify_instruction"
  | "rephrase"
  | "give_general_clue"
  | "give_specific_clue"
  | "show_visual_clue"
  | "show_example"
  | "give_first_word"
  | "give_sentence_frame"
  | "translate_keyword"
  | "translate_instruction"
  | "model_answer"
  | "ask_to_repeat"
  | "review_prerequisite"
  | "change_activity";

export type SupportStep = {
  level: number;
  type: SupportStepType;

  instruction?: string;
  content?: string;

  useL1?: boolean;
  maximumUses?: number;

  metadata?: Record<string, unknown>;
};

export type TeachingActivity = {
  id: string;
  order: number;

  type: TeachingActivityType;
  title: string;
  purpose: string;

  instruction: string;
  teacherPrompt?: string;

  targetObjectiveIds: string[];
  targetVocabularyIds?: string[];
  targetGrammarIds?: string[];
  targetFunctionIds?: string[];

  inputModality: InputModality;
  outputModalities: OutputModality[];

  expectedResponses?: ExpectedResponse[];

  minimumAttempts: number;
  maximumAttempts: number;

  estimatedMinutes: number;
  required: boolean;

  supportSteps: SupportStep[];
  successRule: ActivitySuccessRule;

  allowSkip?: boolean;
  allowAlternativeActivity?: boolean;
  alternativeActivityId?: string;

  correctionOverride?: Partial<CorrectionPolicy>;
  l1Override?: Partial<L1SupportPolicy>;

  metadata?: Record<string, unknown>;
};

/* -------------------------------------------------------------------------- */
/*                                Assessment                                  */
/* -------------------------------------------------------------------------- */

export type AssessmentType =
  | "diagnostic"
  | "formative"
  | "summative"
  | "self_assessment"
  | "teacher_observation";

export type AssessmentCriterion = {
  id: string;
  name: string;
  description: string;

  objectiveIds: string[];

  maximumScore: number;
  passingScore: number;

  weight: number;
};

export type AssessmentPlan = {
  type: AssessmentType;

  criterionIds: string[];
  criteria: AssessmentCriterion[];

  passingPercentage: number;
  allowRetry: boolean;
  maximumRetries?: number;

  recordDetailedErrors: boolean;
};

export type CompletionCriteria = {
  minimumLessonScore: number;
  minimumObjectiveMastery: number;

  requiredObjectiveIds: string[];
  requiredActivityIds?: string[];

  requireAssessmentCompletion: boolean;
  requireSpeakingParticipation?: boolean;

  allowCompletionWithMinorGaps: boolean;
};

/* -------------------------------------------------------------------------- */
/*                          Main Teaching Brain Lesson                        */
/* -------------------------------------------------------------------------- */

export type TeachingBrainLesson = {
  schemaVersion: "1.0";

  id: UUID;
  curriculum: CurriculumReference;

  title: string;
  description?: string;

  targetLanguage: LanguageCode;
  level: CEFRLevel | string;

  estimatedMinutes: number;

  objectives: TeachingObjective[];
  prerequisites: string[];

  vocabulary: VocabularyItem[];
  grammar: GrammarTarget[];
  functions: LanguageFunction[];
  skills: SkillTarget[];

  stages: TeachingStage[];

  assessment: AssessmentPlan;
  completionCriteria: CompletionCriteria;

  l1Policy: L1SupportPolicy;
  correctionPolicy: CorrectionPolicy;
  adaptationPolicy: AdaptationPolicy;
  teachingTone: TeachingTone;

  status: EntityStatus;

  sourceBlueprintId?: UUID;
  sourceBlueprintVersion?: string;

  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;

  metadata?: Record<string, unknown>;
};

/* -------------------------------------------------------------------------- */
/*                              Learner Context                               */
/* -------------------------------------------------------------------------- */

export type LearnerProfileSnapshot = {
  learnerId: UUID;

  displayName?: string;

  targetLanguage: LanguageCode;
  firstLanguage?: LanguageCode;

  level?: CEFRLevel | string;

  preferredMode?: TeachingMode;
  preferredTone?: TeachingTone["primary"];

  knownStrengths?: string[];
  knownChallenges?: string[];

  pronunciationChallenges?: string[];
  commonGrammarErrors?: string[];
  commonVocabularyErrors?: string[];

  accessibilityNeeds?: string[];

  metadata?: Record<string, unknown>;
};

export type LearnerReadiness = {
  ready: boolean;

  energy:
    | "very_low"
    | "low"
    | "normal"
    | "high"
    | "unknown";

  confidence:
    | "very_low"
    | "low"
    | "normal"
    | "high"
    | "unknown";

  availableMinutes?: number;

  learnerMessage?: string;
};

/* -------------------------------------------------------------------------- */
/*                           Session Runtime State                            */
/* -------------------------------------------------------------------------- */

export type TeachingSessionState =
  | "session_start"
  | "welcome"
  | "readiness_check"
  | "previous_lesson_review"
  | "warm_up"
  | "lesson_introduction"
  | "presentation"
  | "comprehension_check"
  | "guided_practice"
  | "communicative_practice"
  | "feedback"
  | "assessment"
  | "summary"
  | "next_step"
  | "session_end"
  | "paused";

export type ObjectiveProgress = {
  objectiveId: string;

  attempts: number;
  successfulAttempts: number;

  masteryScore: number;
  completed: boolean;

  lastEvaluatedAt?: ISODateTimeString;
};

export type ActivityProgress = {
  activityId: string;
  stageId: string;

  status:
    | "not_started"
    | "active"
    | "completed"
    | "skipped"
    | "failed";

  attempts: number;
  successfulAttempts: number;

  supportLevelUsed: number;
  score?: number;

  startedAt?: ISODateTimeString;
  completedAt?: ISODateTimeString;
};

export type StageProgress = {
  stageId: string;

  status:
    | "not_started"
    | "active"
    | "completed"
    | "skipped";

  completedActivityIds: string[];
  skippedActivityIds: string[];

  score?: number;

  startedAt?: ISODateTimeString;
  completedAt?: ISODateTimeString;
};

export type TeachingSession = {
  id: UUID;

  learnerId: UUID;
  lessonId: UUID;

  status: SessionStatus;
  teachingMode: TeachingMode;

  currentState: TeachingSessionState;
  currentStageId?: string;
  currentActivityId?: string;

  currentAttempt: number;
  currentSupportLevel: number;

  readiness?: LearnerReadiness;

  objectiveProgress: ObjectiveProgress[];
  stageProgress: StageProgress[];
  activityProgress: ActivityProgress[];

  totalScore?: number;
  completionPercentage: number;

  startedAt: ISODateTimeString;
  lastActivityAt: ISODateTimeString;
  pausedAt?: ISODateTimeString;
  completedAt?: ISODateTimeString;

  metadata?: Record<string, unknown>;
};

/* -------------------------------------------------------------------------- */
/*                           Learner Turn and Response                        */
/* -------------------------------------------------------------------------- */

export type LearnerResponseStatus =
  | "correct"
  | "mostly_correct"
  | "partly_correct"
  | "incorrect"
  | "unclear"
  | "no_response"
  | "off_topic"
  | "help_requested";

export type EvaluationGrade =
  | "correct"
  | "minor_error"
  | "partial"
  | "major_error"
  | "incorrect"
  | "not_checked";

export type PronunciationGrade =
  | "clear"
  | "understandable"
  | "needs_support"
  | "unclear"
  | "not_checked";

export type FluencyGrade =
  | "fluent"
  | "mostly_fluent"
  | "hesitant"
  | "very_hesitant"
  | "not_checked";

export type LearnerTurn = {
  id: UUID;

  sessionId: UUID;
  stageId: string;
  activityId: string;

  modality: "text" | "voice" | "choice" | "none";

  rawText?: string;
  normalizedText?: string;

  selectedOptionId?: string;

  detectedLanguage?: LanguageCode;

  audioReference?: string;
  speechConfidence?: number;

  responseTimeMs?: number;

  createdAt: ISODateTimeString;
};

export type EvaluationEvidence = {
  matchedExpectedResponseId?: string;

  matchedKeywords?: string[];
  missingKeywords?: string[];
  incorrectKeywords?: string[];

  detectedErrors?: EvaluatedError[];
  positiveEvidence?: string[];

  explanation?: string;
};

export type EvaluatedError = {
  id: string;

  type:
    | "meaning"
    | "grammar"
    | "vocabulary"
    | "pronunciation"
    | "fluency"
    | "spelling"
    | "punctuation"
    | "instruction_misunderstanding";

  severity: "minor" | "moderate" | "major";

  original?: string;
  correction?: string;
  explanation?: string;

  relatedObjectiveId?: string;
  relatedGrammarId?: string;
  relatedVocabularyId?: string;
};

export type ResponseEvaluation = {
  learnerTurnId: UUID;

  status: LearnerResponseStatus;

  meaning: EvaluationGrade;
  grammar: EvaluationGrade;
  vocabulary: EvaluationGrade;
  pronunciation: PronunciationGrade;
  fluency: FluencyGrade;
  spelling: EvaluationGrade;
  punctuation: EvaluationGrade;

  score: number;
  confidence: ConfidenceScore;

  targetObjectiveIds: string[];

  evidence: EvaluationEvidence;

  shouldCorrect: boolean;
  recommendedCorrectionFocus?: CorrectionFocus[];

  createdAt: ISODateTimeString;
};

/* -------------------------------------------------------------------------- */
/*                          Teaching Decision Engine                         */
/* -------------------------------------------------------------------------- */

export type TeachingDecisionType =
  | "continue"
  | "praise_and_continue"
  | "ask_follow_up"
  | "give_clue"
  | "simplify"
  | "rephrase"
  | "model_answer"
  | "correct_gently"
  | "request_self_correction"
  | "request_repetition"
  | "repeat_instruction"
  | "slow_down"
  | "translate_support"
  | "show_visual_support"
  | "review_prerequisite"
  | "retry_activity"
  | "change_activity"
  | "skip_optional_activity"
  | "pause"
  | "complete_activity"
  | "complete_stage"
  | "complete_lesson"
  | "request_human_support";

export type TeachingDecisionReason =
  | "correct_response"
  | "partial_success"
  | "incorrect_response"
  | "repeated_error"
  | "meaning_breakdown"
  | "learner_requested_help"
  | "no_response"
  | "off_topic_response"
  | "low_confidence_evaluation"
  | "activity_success_rule_met"
  | "activity_attempt_limit_reached"
  | "stage_completion_rule_met"
  | "lesson_completion_rule_met"
  | "time_constraint"
  | "readiness_constraint"
  | "policy_requirement"
  | "safety_requirement";

export type TeachingDecision = {
  id: UUID;

  sessionId: UUID;
  stageId?: string;
  activityId?: string;
  learnerTurnId?: UUID;

  type: TeachingDecisionType;
  reason: TeachingDecisionReason;

  priority: "low" | "normal" | "high" | "critical";

  supportLevel: number;

  messageIntent:
    | "greet"
    | "instruct"
    | "explain"
    | "ask"
    | "prompt"
    | "encourage"
    | "praise"
    | "correct"
    | "clarify"
    | "summarize"
    | "transition"
    | "close";

  speechContent?: string;
  textContent?: string;

  correction?: {
    original?: string;
    corrected?: string;
    explanation?: string;
    requestRepetition: boolean;
  };

  targetState?: TeachingSessionState;
  targetStageId?: string;
  targetActivityId?: string;

  shouldWaitForLearner: boolean;
  expectedInputModality?: InputModality;

  directorHints?: DirectorHints;

  createdAt: ISODateTimeString;

  metadata?: Record<string, unknown>;
};

/* -------------------------------------------------------------------------- */
/*                    Bridge to the Future Elvy Director                      */
/* -------------------------------------------------------------------------- */

export type ElvyPosition =
  | "center"
  | "left"
  | "right"
  | "near_whiteboard"
  | "near_learner"
  | "offscreen";

export type ElvyGesture =
  | "idle"
  | "smile"
  | "wave"
  | "nod"
  | "shake_head"
  | "point"
  | "clap"
  | "thumbs_up"
  | "listen"
  | "think"
  | "encourage"
  | "write"
  | "erase"
  | "turn_to_board"
  | "turn_to_learner";

export type BoardActionType =
  | "none"
  | "clear"
  | "show_title"
  | "show_text"
  | "show_sentence"
  | "show_vocabulary"
  | "show_image"
  | "show_question"
  | "show_options"
  | "show_correction"
  | "highlight"
  | "underline"
  | "circle"
  | "erase";

export type BoardAction = {
  type: BoardActionType;

  content?: string;
  targetId?: string;

  imageReference?: string;

  preserveExistingContent?: boolean;
};

export type DirectorHints = {
  preferredPosition?: ElvyPosition;
  preferredGesture?: ElvyGesture;

  boardActions?: BoardAction[];

  facialExpression?:
    | "neutral"
    | "happy"
    | "encouraging"
    | "thinking"
    | "concerned"
    | "celebrating";

  speakingPace?: "slow" | "normal" | "fast";
  speakingVolume?: "soft" | "normal" | "strong";

  pauseBeforeSpeechMs?: number;
  pauseAfterSpeechMs?: number;

  allowMovement?: boolean;
  allowAnimation?: boolean;
};

/* -------------------------------------------------------------------------- */
/*                           Teaching Brain Results                           */
/* -------------------------------------------------------------------------- */

export type LessonCompletionResult = {
  sessionId: UUID;
  lessonId: UUID;
  learnerId: UUID;

  completed: boolean;
  passed: boolean;

  finalScore: number;
  completionPercentage: number;

  masteredObjectiveIds: string[];
  developingObjectiveIds: string[];
  unmetObjectiveIds: string[];

  strengths: string[];
  improvementAreas: string[];

  recommendedReviewActivityIds: string[];
  recommendedNextLessonId?: UUID;

  completedAt: ISODateTimeString;
};

export type TeachingBrainErrorCode =
  | "INVALID_LESSON"
  | "INVALID_SESSION"
  | "LESSON_NOT_ACTIVE"
  | "SESSION_ALREADY_COMPLETED"
  | "STAGE_NOT_FOUND"
  | "ACTIVITY_NOT_FOUND"
  | "OBJECTIVE_NOT_FOUND"
  | "INVALID_TRANSITION"
  | "EVALUATION_FAILED"
  | "DECISION_FAILED"
  | "POLICY_CONFLICT"
  | "UNSUPPORTED_INPUT"
  | "INTERNAL_ERROR";

export type TeachingBrainError = {
  code: TeachingBrainErrorCode;
  message: string;

  sessionId?: UUID;
  lessonId?: UUID;
  stageId?: string;
  activityId?: string;

  recoverable: boolean;

  details?: Record<string, unknown>;
};

/* -------------------------------------------------------------------------- */
/*                              Service Results                               */
/* -------------------------------------------------------------------------- */

export type TeachingBrainSuccess<T> = {
  ok: true;
  data: T;
};

export type TeachingBrainFailure = {
  ok: false;
  error: TeachingBrainError;
};

export type TeachingBrainResult<T> =
  | TeachingBrainSuccess<T>
  | TeachingBrainFailure;

/* -------------------------------------------------------------------------- */
/*                              Type Guards                                   */
/* -------------------------------------------------------------------------- */

export function isTeachingBrainSuccess<T>(
  result: TeachingBrainResult<T>,
): result is TeachingBrainSuccess<T> {
  return result.ok;
}

export function isTeachingBrainFailure<T>(
  result: TeachingBrainResult<T>,
): result is TeachingBrainFailure {
  return !result.ok;
}

export function isCompletedSession(
  session: TeachingSession,
): boolean {
  return session.status === "completed";
}

export function isActiveSession(
  session: TeachingSession,
): boolean {
  return session.status === "active";
}

export function isRequiredActivity(
  activity: TeachingActivity,
): boolean {
  return activity.required;
}

export function isCorrectResponse(
  evaluation: ResponseEvaluation,
): boolean {
  return (
    evaluation.status === "correct" ||
    evaluation.status === "mostly_correct"
  );
}

/* -------------------------------------------------------------------------- */
/*                          Safe Score Normalisation                          */
/* -------------------------------------------------------------------------- */

export function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.min(100, Math.max(0, score));
}

export function normalizeConfidence(
  confidence: number,
): number {
  if (!Number.isFinite(confidence)) {
    return 0;
  }

  return Math.min(1, Math.max(0, confidence));
}

export function normalizeProgress(
  progress: number,
): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(100, Math.max(0, progress));
}