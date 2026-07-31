/**
 * Elvy Teaching Brain
 * Lesson Plan -> TeachingBrainLesson adapter
 *
 * File: services/teaching-brain/blueprint-adapter.ts
 *
 * Converts the editable Lesson Plan Studio model into the normalized,
 * runtime-validated lesson contract consumed by the Teaching Brain.
 */

import type {
  ElvyBlueprintStage,
  IntegratedSkillRow,
  LessonPlan,
  LessonPlanStage,
} from "../lesson-plan/lesson-plan-types";

import {
  parseTeachingBrainLesson,
  safeParseTeachingBrainLesson,
  type LessonValidationIssue,
} from "./lesson-schema";

import type {
  LanguageCode,
  TeachingBrainError,
  TeachingBrainLesson,
  TeachingBrainResult,
} from "./types";

export type BlueprintAdapterSource = {
  /**
   * The canonical, separately stored Elvy Teaching Blueprint from the GSRP.
   * It may be either the complete executable Blueprint v1.4 object
   * ({ objectives, stages, nativeLanguageSupport, adaptation,
   * lessonCompletionRule, teachingRules }) or the legacy stages array.
   */
  blueprintData?: unknown;
};

export type BlueprintAdapterContext = {
  lessonId: string;
  curriculumId: string;

  resourceId?: string;
  academicProfileId?: string;
  levelId?: string;
  sublevelId?: string;
  unitId?: string;

  curriculumTitle?: string;
  sourceEdition?: string;
  sourceLanguage?: LanguageCode;
  targetLanguage?: LanguageCode;

  learnerL1?: LanguageCode;
  sourceBlueprintId?: string;
  sourceBlueprintVersion?: string;

  createdAt?: string;
  updatedAt?: string;
};

export type LessonPlanValidationIssue = {
  path: string;
  code:
    | "REQUIRED"
    | "INVALID_VALUE"
    | "NOT_APPROVED"
    | "NOT_READY_FOR_ELVY"
    | "EMPTY_COLLECTION";
  message: string;
  value?: unknown;
};

export type LessonPlanValidationReport = {
  valid: boolean;
  issues: LessonPlanValidationIssue[];
};

export type SafeBlueprintAdapterResult =
  | {
      success: true;
      data: TeachingBrainLesson;
      issues: [];
    }
  | {
      success: false;
      issues: Array<LessonPlanValidationIssue | LessonValidationIssue>;
    };

export class BlueprintAdapterError extends Error {
  readonly issues: Array<LessonPlanValidationIssue | LessonValidationIssue>;

  constructor(
    message: string,
    issues: Array<LessonPlanValidationIssue | LessonValidationIssue>,
  ) {
    const details = issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");

    super(details ? `${message}\n${details}` : message);
    this.name = "BlueprintAdapterError";
    this.issues = issues;
  }
}

const PLACEHOLDER_PATTERNS = [
  /^needs vision reader$/i,
  /^to be detected(?: by curriculum reader)?$/i,
  /^page analysis required$/i,
  /^not analy[sz]ed$/i,
  /^to be confirmed$/i,
];

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isMeaningful(value: unknown): boolean {
  const normalized = clean(value);
  return (
    normalized.length > 0 &&
    !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

function slugify(value: string, fallback: string): string {
  const normalized = clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item === "object" &&
          !Array.isArray(item),
      )
    : [];
}

function textArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(clean).filter(Boolean)
    : [];
}

function executableBlueprintObject(
  source?: BlueprintAdapterSource,
): Record<string, unknown> | null {
  return asObject(source?.blueprintData);
}

function hasExecutableBlueprint(
  source?: BlueprintAdapterSource,
): boolean {
  const blueprint = executableBlueprintObject(source);
  if (!blueprint) return false;

  const objectives = asObjectArray(blueprint.objectives);
  const stages = asObjectArray(blueprint.stages);

  return (
    objectives.length > 0 &&
    stages.some((stage) => {
      const stageId = clean(stage.stageId);
      const scenes = asObjectArray(stage.scenes);
      return Boolean(stageId || scenes.length > 0);
    })
  );
}

function executableObjectives(
  source: BlueprintAdapterSource | undefined,
) {
  const blueprint = executableBlueprintObject(source);
  const objectives = asObjectArray(blueprint?.objectives);

  return objectives.map((objective, index) => {
    const id =
      clean(objective.id) ||
      `objective-executable-${index + 1}`;
    const description =
      clean(objective.description) ||
      `Complete objective ${index + 1}.`;
    const evidence =
      clean(objective.evidence) ||
      `The learner demonstrates: ${description}`;

    return {
      id,
      type: inferObjectiveType(description),
      statement: description,
      measurableOutcome: evidence,
      successThreshold: 70,
      required: true,
      priority: "essential" as const,
      relatedContentIds: [] as string[],
      prerequisiteObjectiveIds: [] as string[],
    };
  });
}

function mapExecutableActivityType(value: unknown):
  | "greeting"
  | "conversation"
  | "explanation"
  | "demonstration"
  | "modeling"
  | "repeat_after_me"
  | "question_answer"
  | "open_question"
  | "dialogue"
  | "role_play"
  | "listening"
  | "reading"
  | "writing"
  | "quiz"
  | "review"
  | "reflection"
  | "custom" {
  const normalized = clean(value).toLowerCase();

  if (normalized.includes("repeat")) return "repeat_after_me";
  if (normalized.includes("dialogue")) return "dialogue";
  if (normalized.includes("role")) return "role_play";
  if (normalized.includes("listen")) return "listening";
  if (normalized.includes("read")) return "reading";
  if (normalized.includes("write") || normalized.includes("spell")) {
    return "writing";
  }
  if (
    normalized.includes("assessment") ||
    normalized.includes("choose") ||
    normalized.includes("match") ||
    normalized.includes("quiz")
  ) {
    return "quiz";
  }
  if (
    normalized.includes("answer") ||
    normalized.includes("question")
  ) {
    return "question_answer";
  }
  if (
    normalized.includes("greet") ||
    normalized.includes("hello")
  ) {
    return "greeting";
  }
  if (
    normalized.includes("conversation") ||
    normalized.includes("production") ||
    normalized.includes("personal")
  ) {
    return "conversation";
  }

  return "custom";
}

function mapExecutableInputMode(
  value: unknown,
): "text" | "voice" | "choice" | "tap" | "drag" | "none" {
  const normalized = clean(value).toLowerCase();

  if (normalized.includes("choice")) return "choice";
  if (
    normalized.includes("text") ||
    normalized.includes("write") ||
    normalized.includes("type")
  ) {
    return "text";
  }
  if (
    normalized.includes("voice") ||
    normalized.includes("speak") ||
    normalized.includes("oral")
  ) {
    return "voice";
  }
  if (normalized.includes("tap")) return "tap";
  if (normalized.includes("drag")) return "drag";

  return "voice";
}

function executableSupportSteps(
  activity: Record<string, unknown>,
  l1Enabled: boolean,
) {
  const hints = asObjectArray(activity.hints);

  if (hints.length > 0) {
    return hints.map((hint, index) => ({
      level:
        typeof hint.level === "number"
          ? Math.max(0, Math.min(5, hint.level))
          : Math.min(index + 1, 5),
      type: (
        clean(hint.type)
          .toLowerCase()
          .replace(/-/g, "_") || "show_example"
      ) as
        | "wait"
        | "repeat_instruction"
        | "simplify_instruction"
        | "give_sentence_frame"
        | "translate_keyword"
        | "show_example"
        | "model_answer",
      instruction:
        clean(hint.content) ||
        "Give one focused support step.",
      content: clean(hint.content) || undefined,
      maximumUses: 1,
      useL1:
        l1Enabled &&
        /l1|translation|native/i.test(clean(hint.type)),
    }));
  }

  return [];
}

function executableStages(
  source: BlueprintAdapterSource | undefined,
  fallbackObjectiveIds: string[],
  vocabularyIds: string[],
  grammarIds: string[],
  functionIds: string[],
) {
  const blueprint = executableBlueprintObject(source);
  const stages = asObjectArray(blueprint?.stages);

  return stages.map((stage, stageIndex) => {
    const sourceScenes = asObjectArray(stage.scenes);
    const stageId =
      clean(stage.stageId) ||
      `stage-${stageIndex + 1}-${slugify(clean(stage.stage), "stage")}`;
    const stageObjectiveIds =
      textArray(stage.objectiveIds).length > 0
        ? textArray(stage.objectiveIds)
        : fallbackObjectiveIds;

    const activities = sourceScenes.flatMap((scene, sceneIndex) => {
      const sceneActivities = asObjectArray(scene.activities);
      const teacherTurns = asObjectArray(scene.teacherTurns);
      const whiteboard = asObject(scene.whiteboard);

      return sceneActivities.map((activity, activityIndex) => {
        const activityId =
          clean(activity.activityId) ||
          `${stageId}-scene-${sceneIndex + 1}-activity-${activityIndex + 1}`;
        const acceptedVariants = textArray(activity.acceptedVariants);
        const expectedAnswers = textArray(activity.expectedAnswers);
        const options = textArray(activity.options);
        const feedback = asObject(activity.feedback);
        const evaluation = asObject(activity.evaluation);
        const evidence = asObject(activity.evidence);
        const prompt =
          clean(activity.prompt) ||
          clean(
            teacherTurns.find(
              (turn) =>
                clean(turn.expectedActivityId) === activityId,
            )?.text,
          ) ||
          clean(scene.purpose) ||
          `Complete ${clean(stage.stage) || "the activity"}.`;

        const exactAnswers = uniqueStrings([
          ...expectedAnswers,
          clean(activity.correctAnswer),
        ]);

        const semanticDescription =
          textArray(activity.meaningCriteria).join(" ") ||
          clean(evaluation?.passRule) ||
          clean(scene.completionCondition) ||
          `A response that satisfies the activity prompt.`;

        const modelAnswer =
          exactAnswers[0] ||
          acceptedVariants[0] ||
          options[0] ||
          undefined;

        const activityObjectiveIds =
          textArray(activity.objectiveIds).length > 0
            ? textArray(activity.objectiveIds)
            : stageObjectiveIds;

        const inputMode = mapExecutableInputMode(
          activity.inputMode,
        );

        return {
          id: activityId,
          order: activityIndex + 1,
          type: mapExecutableActivityType(activity.type),
          title:
            clean(activity.title) ||
            clean(scene.title) ||
            `Activity ${activityIndex + 1}`,
          purpose:
            clean(scene.purpose) ||
            semanticDescription,
          instruction: prompt,
          teacherPrompt: prompt,
          targetObjectiveIds: activityObjectiveIds,
          targetVocabularyIds: vocabularyIds,
          targetGrammarIds: grammarIds,
          targetFunctionIds: functionIds,
          inputModality: inputMode,
          outputModalities: uniqueStrings([
            "speech",
            whiteboard ? "whiteboard" : "",
          ]).filter(
            (
              modality,
            ): modality is
              | "speech"
              | "text"
              | "whiteboard"
              | "image"
              | "audio"
              | "video"
              | "animation" =>
              [
                "speech",
                "text",
                "whiteboard",
                "image",
                "audio",
                "video",
                "animation",
              ].includes(modality),
          ),
          expectedResponses: [
            {
              id: `${activityId}-response-1`,
              exactAnswers,
              acceptableAnswers: acceptedVariants,
              requiredKeywords: [] as string[],
              forbiddenKeywords: [] as string[],
              semanticDescription,
              modelAnswer,
              caseSensitive: false,
              allowMinorSpellingErrors: true,
              allowEquivalentMeaning: true,
              evaluationFocus: {
                meaning: true,
                grammar: grammarIds.length > 0,
                vocabulary: vocabularyIds.length > 0,
                pronunciation:
                  inputMode === "voice",
                fluency:
                  /production|dialogue|role|conversation/i.test(
                    clean(activity.type),
                  ),
                spelling: inputMode === "text",
                punctuation: inputMode === "text",
              },
            },
          ],
          minimumAttempts: 1,
          maximumAttempts:
            typeof activity.retryLimit === "number"
              ? Math.max(1, activity.retryLimit)
              : 3,
          estimatedMinutes: 2,
          required: true,
          supportSteps: executableSupportSteps(
            activity,
            true,
          ),
          successRule: {
            type: "minimum_score" as const,
            minimumScore: 65,
            requireTargetVocabulary:
              vocabularyIds.length > 0,
            requireTargetGrammar:
              grammarIds.length > 0,
            requireUnderstandablePronunciation:
              inputMode === "voice",
          },
          allowSkip: false,
          allowAlternativeActivity: false,
          metadata: {
            sceneId:
              clean(scene.sceneId) ||
              `${stageId}-scene-${sceneIndex + 1}`,
            whiteboard,
            teacherTurns,
            evidence,
            feedback,
            evaluation,
            onSuccess: asObject(activity.onSuccess),
            onFailure: asObject(activity.onFailure),
            assetIds: textArray(scene.assetIds),
          },
        };
      });
    });

    const stageCompletion = asObject(
      stage.stageCompletionRule,
    );
    const firstTeacherTurn = sourceScenes
      .flatMap((scene) => asObjectArray(scene.teacherTurns))
      .find((turn) => clean(turn.text));

    return {
      id: stageId,
      order: stageIndex + 1,
      type: normalizeStageType(clean(stage.stage)),
      title:
        clean(stage.stage) ||
        `Stage ${stageIndex + 1}`,
      purpose:
        clean(stage.teachingObjective) ||
        clean(stage.elvyScript) ||
        `Complete stage ${stageIndex + 1}.`,
      objectiveIds: stageObjectiveIds,
      estimatedMinutes: parseMinutes(
        clean(stage.duration),
        5,
      ),
      required: true,
      skippable: false,
      activities:
        activities.length > 0
          ? activities
          : [
              {
                id: `${stageId}-activity-1`,
                order: 1,
                type: "custom" as const,
                title:
                  clean(stage.stage) ||
                  `Stage ${stageIndex + 1}`,
                purpose:
                  clean(stage.teachingObjective) ||
                  "Complete the stage objective.",
                instruction:
                  clean(stage.elvyScript) ||
                  clean(stage.teachingObjective) ||
                  "Continue with the lesson.",
                teacherPrompt:
                  clean(stage.elvyScript) || undefined,
                targetObjectiveIds: stageObjectiveIds,
                targetVocabularyIds: vocabularyIds,
                targetGrammarIds: grammarIds,
                targetFunctionIds: functionIds,
                inputModality: "voice" as const,
                outputModalities: ["speech"] as const,
                expectedResponses: [
                  {
                    id: `${stageId}-activity-1-response-1`,
                    exactAnswers: [] as string[],
                    acceptableAnswers:
                      textArray(stage.expectedResponses),
                    requiredKeywords: [] as string[],
                    forbiddenKeywords: [] as string[],
                    semanticDescription:
                      clean(stage.evaluationCriteria) ||
                      "A relevant learner response.",
                    modelAnswer:
                      textArray(stage.expectedResponses)[0] ||
                      undefined,
                    caseSensitive: false,
                    allowMinorSpellingErrors: true,
                    allowEquivalentMeaning: true,
                    evaluationFocus: {
                      meaning: true,
                      grammar: grammarIds.length > 0,
                      vocabulary: vocabularyIds.length > 0,
                      pronunciation: true,
                      fluency: false,
                      spelling: false,
                      punctuation: false,
                    },
                  },
                ],
                minimumAttempts: 1,
                maximumAttempts:
                  typeof stage.retryLimit === "number"
                    ? Math.max(1, stage.retryLimit)
                    : 3,
                estimatedMinutes: parseMinutes(
                  clean(stage.duration),
                  5,
                ),
                required: true,
                supportSteps: [],
                successRule: {
                  type: "minimum_score" as const,
                  minimumScore: 65,
                  requireTargetVocabulary:
                    vocabularyIds.length > 0,
                  requireTargetGrammar:
                    grammarIds.length > 0,
                  requireUnderstandablePronunciation: true,
                },
                allowSkip: false,
                allowAlternativeActivity: false,
              },
            ],
      completionRule: {
        type: "all_required_activities_completed" as const,
        requiredActivityIds:
          activities.length > 0
            ? activities.map((activity) => activity.id)
            : [`${stageId}-activity-1`],
        minimumCompletedActivities:
          typeof stageCompletion?.minimumObjectiveEvidence ===
          "number"
            ? Math.max(
                1,
                Math.min(
                  activities.length || 1,
                  stageCompletion.minimumObjectiveEvidence,
                ),
              )
            : activities.length || 1,
      },
      entryMessage:
        clean(firstTeacherTurn?.text) ||
        clean(stage.elvyScript) ||
        undefined,
      completionMessage:
        clean(stage.successAction) ||
        `Good work. ${clean(stage.stage) || "This stage"} is complete.`,
      metadata: {
        sourceStageId: clean(stage.stageId),
        sourceScenes,
        stageCompletionRule: stageCompletion,
        whiteboardPlan: stage.whiteboardPlan,
      },
    };
  });
}

function normalizeBlueprintStages(
  plan: LessonPlan,
  source?: BlueprintAdapterSource,
): ElvyBlueprintStage[] {
  const external = source?.blueprintData;
  const externalObject = asObject(external);
  const externalStages = Array.isArray(external)
    ? external
    : Array.isArray(externalObject?.stages)
      ? externalObject.stages
      : [];

  if (externalStages.length > 0) {
    return externalStages.filter(asObject) as unknown as ElvyBlueprintStage[];
  }

  return Array.isArray(plan.elvyBlueprint)
    ? plan.elvyBlueprint.filter(asObject) as unknown as ElvyBlueprintStage[]
    : [];
}

function normalizeLessonPlanCollections(
  plan: LessonPlan,
  source?: BlueprintAdapterSource,
): LessonPlan {
  return {
    ...plan,
    stages: Array.isArray(plan.stages) ? plan.stages : [],
    integratedSkills: Array.isArray(plan.integratedSkills)
      ? plan.integratedSkills
      : [],
    elvyBlueprint: normalizeBlueprintStages(plan, source),
  };
}


function splitList(value: string): string[] {
  const normalized = clean(value);
  if (!normalized) return [];

  return uniqueStrings(
    normalized
      .split(/\r?\n|[;,•]|\s+\|\s+/)
      .map((item) => item.replace(/^[-–—]\s*/, "").trim())
      .filter(Boolean),
  );
}

function splitSentences(value: string): string[] {
  const normalized = clean(value);
  if (!normalized) return [];

  return uniqueStrings(
    normalized
      .split(/\r?\n|(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((item) => item.replace(/^[-–—]\s*/, "").trim())
      .filter(Boolean),
  );
}

function parseMinutes(value: string, fallback = 5): number {
  const normalized = clean(value).toLowerCase();

  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:hour|hours|hr|hrs|h)\b/);
  const minuteMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:minute|minutes|min|mins|m)\b/);

  const hours = hourMatch ? Number(hourMatch[1]) * 60 : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;

  if (hours + minutes > 0) return Math.max(1, Math.round(hours + minutes));

  const firstNumber = normalized.match(/\d+(?:\.\d+)?/);
  if (firstNumber) return Math.max(1, Math.round(Number(firstNumber[0])));

  return fallback;
}

function parsePageRange(value: string):
  | { startPage: number; endPage: number }
  | undefined {
  const numbers = clean(value)
    .match(/\d+/g)
    ?.map(Number)
    .filter((number) => Number.isInteger(number) && number > 0);

  if (!numbers?.length) return undefined;

  const startPage = numbers[0];
  const endPage = numbers.length > 1 ? numbers[numbers.length - 1] : startPage;

  return {
    startPage: Math.min(startPage, endPage),
    endPage: Math.max(startPage, endPage),
  };
}

function inferLanguageCode(value: string | undefined): LanguageCode {
  const normalized = clean(value).toLowerCase();

  if (
    normalized === "en" ||
    normalized.includes("english") ||
    normalized.includes("anglais")
  ) {
    return "en";
  }
  if (
    normalized === "ar" ||
    normalized.includes("arabic") ||
    normalized.includes("arabe")
  ) {
    return "ar";
  }
  if (
    normalized === "fr" ||
    normalized.includes("french") ||
    normalized.includes("français") ||
    normalized.includes("francais")
  ) {
    return "fr";
  }
  if (normalized === "es" || normalized.includes("spanish")) return "es";
  if (normalized === "de" || normalized.includes("german")) return "de";
  if (normalized === "it" || normalized.includes("italian")) return "it";
  if (normalized === "pt" || normalized.includes("portuguese")) return "pt";
  if (normalized === "tr" || normalized.includes("turkish")) return "tr";
  if (normalized === "nl" || normalized.includes("dutch")) return "nl";

  return "other";
}

function inferObjectiveType(
  label: string,
):
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
  | "custom" {
  const normalized = clean(label).toLowerCase();

  if (normalized.includes("communicat") || normalized.includes("interaction")) {
    return "interaction";
  }
  if (normalized.includes("language")) return "grammar";
  if (normalized.includes("pronunciation")) return "pronunciation";
  if (normalized.includes("listen")) return "listening";
  if (normalized.includes("speak")) return "speaking";
  if (normalized.includes("read")) return "reading";
  if (normalized.includes("writ")) return "writing";
  if (normalized.includes("vocab")) return "vocabulary";
  if (normalized.includes("grammar")) return "grammar";
  if (normalized.includes("function")) return "function";
  if (normalized.includes("understand") || normalized.includes("compreh")) {
    return "comprehension";
  }

  return "custom";
}

function normalizeSkill(
  value: string,
):
  | "listening"
  | "speaking"
  | "reading"
  | "writing"
  | "pronunciation"
  | "grammar"
  | "vocabulary"
  | "interaction"
  | "culture" {
  const normalized = clean(value).toLowerCase();

  if (normalized.includes("listen")) return "listening";
  if (normalized.includes("speak")) return "speaking";
  if (normalized.includes("read")) return "reading";
  if (normalized.includes("writ")) return "writing";
  if (normalized.includes("pronun")) return "pronunciation";
  if (normalized.includes("grammar")) return "grammar";
  if (normalized.includes("vocab")) return "vocabulary";
  if (normalized.includes("culture")) return "culture";

  return "interaction";
}

function normalizeStageType(
  value: string,
):
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
  | "custom" {
  const normalized = clean(value).toLowerCase();

  if (normalized.includes("welcome") || normalized.includes("greet")) return "welcome";
  if (normalized.includes("readiness")) return "readiness_check";
  if (normalized.includes("previous") || normalized.includes("review")) {
    return "previous_lesson_review";
  }
  if (normalized.includes("warm")) return "warm_up";
  if (normalized.includes("intro")) return "lesson_introduction";
  if (
    normalized.includes("present") ||
    normalized.includes("model") ||
    normalized.includes("input")
  ) {
    return "presentation";
  }
  if (normalized.includes("comprehension")) return "comprehension_check";
  if (normalized.includes("pronunciation")) return "pronunciation_practice";
  if (normalized.includes("listening")) return "listening_practice";
  if (normalized.includes("reading")) return "reading_practice";
  if (normalized.includes("writing")) return "writing_practice";
  if (
    normalized.includes("communicative") ||
    normalized.includes("production") ||
    normalized.includes("role")
  ) {
    return "communicative_practice";
  }
  if (
    normalized.includes("guided") ||
    normalized.includes("controlled") ||
    normalized === "practice"
  ) {
    return "guided_practice";
  }
  if (normalized.includes("feedback")) return "feedback";
  if (normalized.includes("assess") || normalized.includes("test")) return "assessment";
  if (normalized.includes("summary") || normalized.includes("reflect")) return "summary";
  if (normalized.includes("homework")) return "homework";
  if (normalized.includes("goodbye") || normalized.includes("close")) return "goodbye";

  return "custom";
}

function inferActivityType(
  stage: LessonPlanStage,
):
  | "greeting"
  | "conversation"
  | "explanation"
  | "demonstration"
  | "modeling"
  | "repeat_after_me"
  | "question_answer"
  | "open_question"
  | "dialogue"
  | "role_play"
  | "listening"
  | "reading"
  | "writing"
  | "quiz"
  | "review"
  | "reflection"
  | "custom" {
  const text = [
    stage.stage,
    stage.teacherActivities,
    stage.studentActivities,
    stage.assessment,
  ]
    .join(" ")
    .toLowerCase();

  if (text.includes("role-play") || text.includes("role play")) return "role_play";
  if (text.includes("dialogue")) return "dialogue";
  if (text.includes("repeat")) return "repeat_after_me";
  if (text.includes("listen")) return "listening";
  if (text.includes("read")) return "reading";
  if (text.includes("write")) return "writing";
  if (text.includes("quiz") || text.includes("test")) return "quiz";
  if (text.includes("question")) return "question_answer";
  if (text.includes("model")) return "modeling";
  if (text.includes("demonstrat")) return "demonstration";
  if (text.includes("explain") || text.includes("present")) return "explanation";
  if (text.includes("reflect")) return "reflection";
  if (text.includes("review")) return "review";
  if (text.includes("greet")) return "greeting";
  if (text.includes("conversation") || text.includes("exchange")) return "conversation";

  return "custom";
}

function inferInputModality(stage: LessonPlanStage):
  | "text"
  | "voice"
  | "choice"
  | "tap"
  | "drag"
  | "none" {
  const text = `${stage.studentActivities} ${stage.assessment}`.toLowerCase();

  if (text.includes("write") || text.includes("type")) return "text";
  if (
    text.includes("speak") ||
    text.includes("say") ||
    text.includes("repeat") ||
    text.includes("dialogue") ||
    text.includes("role")
  ) {
    return "voice";
  }
  if (
    text.includes("choose") ||
    text.includes("tick") ||
    text.includes("multiple choice")
  ) {
    return "choice";
  }

  return "voice";
}

function inferOutputModalities(stage: LessonPlanStage):
  Array<"speech" | "text" | "whiteboard" | "image" | "audio" | "video" | "animation"> {
  const text = `${stage.resources} ${stage.teacherActivities}`.toLowerCase();
  const modalities: Array<
    "speech" | "text" | "whiteboard" | "image" | "audio" | "video" | "animation"
  > = ["speech"];

  if (text.includes("board")) modalities.push("whiteboard");
  if (
    text.includes("picture") ||
    text.includes("flashcard") ||
    text.includes("image")
  ) {
    modalities.push("image");
  }
  if (text.includes("audio") || text.includes("listen")) modalities.push("audio");
  if (text.includes("video")) modalities.push("video");
  if (text.includes("textbook") || text.includes("text")) modalities.push("text");

  return [...new Set(modalities)];
}

function blueprintText(stage: ElvyBlueprintStage): string {
  return [
    stage.instructions,
    stage.teachingObjective,
    stage.whiteboardPlan ? `Whiteboard: ${clean(stage.whiteboardPlan)}` : "",
    stage.elvyScript,
    stage.learnerTaskSequence?.length
      ? `Learner tasks: ${stage.learnerTaskSequence.map(clean).filter(Boolean).join(" ")}`
      : "",
    stage.evaluationCriteria
      ? `Evaluation: ${clean(stage.evaluationCriteria)}`
      : "",
    stage.feedbackStrategy
      ? `Feedback: ${clean(stage.feedbackStrategy)}`
      : "",
    stage.successAction ? `On success: ${clean(stage.successAction)}` : "",
    stage.recoveryAction ? `If support is needed: ${clean(stage.recoveryAction)}` : "",
    stage.transition ? `Transition: ${clean(stage.transition)}` : "",
  ]
    .filter(isMeaningful)
    .map(clean)
    .join(" ");
}

function blueprintStageForStage(
  stageName: string,
  plan: LessonPlan,
): ElvyBlueprintStage | undefined {
  const target = normalizeStageType(stageName);

  const directMatch = plan.elvyBlueprint.find(
    (item) => normalizeStageType(item.stage) === target,
  );

  if (directMatch) return directMatch;

  return plan.elvyBlueprint.find((item) => {
    const itemType = normalizeStageType(item.stage);
    return (
      (target === "guided_practice" &&
        itemType === "communicative_practice") ||
      (target === "communicative_practice" &&
        itemType === "guided_practice")
    );
  });
}

function blueprintInstructionForStage(
  stageName: string,
  plan: LessonPlan,
): string {
  const blueprintStage = blueprintStageForStage(stageName, plan);

  return [blueprintStage ? blueprintText(blueprintStage) : "", plan.teacherTips]
    .filter(isMeaningful)
    .map(clean)
    .join(" ");
}

function createObjectives(plan: LessonPlan) {
  const sources = [
    {
      label: "Lesson objective",
      value: plan.lessonObjectives,
      priority: "essential" as const,
      required: true,
    },
    {
      label: "Communicative objective",
      value: plan.communicativeObjective,
      priority: "essential" as const,
      required: true,
    },
    {
      label: "Language objective",
      value: plan.languageObjective,
      priority: "important" as const,
      required: true,
    },
    {
      label: "Expected outcome",
      value: plan.outcomes,
      priority: "important" as const,
      required: false,
    },
  ];

  const objectives = sources.flatMap((source) =>
    splitSentences(source.value).map((statement, index) => ({
      id: `objective-${slugify(source.label, "objective")}-${index + 1}`,
      type: inferObjectiveType(`${source.label} ${statement}`),
      statement,
      measurableOutcome:
        source.label === "Expected outcome"
          ? statement
          : `The learner demonstrates: ${statement}`,
      successThreshold: source.priority === "essential" ? 70 : 60,
      required: source.required,
      priority: source.priority,
      relatedContentIds: [] as string[],
      prerequisiteObjectiveIds: [] as string[],
    })),
  );

  if (objectives.length > 0) return objectives;

  return [
    {
      id: "objective-primary-1",
      type: "custom" as const,
      statement: clean(plan.successCriteria) || `Complete ${clean(plan.lessonTitle)}.`,
      measurableOutcome:
        clean(plan.successCriteria) ||
        `The learner completes the required lesson activities.`,
      successThreshold: 70,
      required: true,
      priority: "essential" as const,
      relatedContentIds: [] as string[],
      prerequisiteObjectiveIds: [] as string[],
    },
  ];
}

function createVocabulary(plan: LessonPlan, targetLanguage: LanguageCode) {
  return splitList(plan.vocabulary).map((term, index) => ({
    id: `vocabulary-${index + 1}-${slugify(term, "item")}`,
    term,
    language: targetLanguage,
    required: true,
    examples: [] as string[],
    acceptableVariants: [] as string[],
    commonErrors: [] as string[],
  }));
}

function createGrammar(plan: LessonPlan) {
  return splitList(plan.grammar).map((item, index) => ({
    id: `grammar-${index + 1}-${slugify(item, "item")}`,
    title: item,
    description: item,
    form: clean(plan.sentencePatterns) || undefined,
    meaning: clean(plan.languageObjective) || undefined,
    use: clean(plan.functions) || undefined,
    examples: splitList(plan.usefulExpressions),
    negativeExamples: [] as string[],
    commonErrors: splitList(plan.commonDifficulties),
    required: true,
  }));
}

function createFunctions(plan: LessonPlan) {
  const expressions = splitList(plan.usefulExpressions);

  return splitList(plan.functions).map((item, index) => ({
    id: `function-${index + 1}-${slugify(item, "item")}`,
    name: item,
    description: item,
    modelExpressions:
      expressions.length > 0
        ? expressions
        : [clean(plan.sentencePatterns) || item],
    situationalContexts: uniqueStrings([plan.theme, plan.communicativeObjective]),
    expectedRegister: "neutral" as const,
    required: true,
  }));
}

function createSkills(plan: LessonPlan) {
  return plan.integratedSkills
    .filter((row) => isMeaningful(row.skill) || isMeaningful(row.objective))
    .map((row: IntegratedSkillRow, index) => ({
      id: `skill-${index + 1}-${slugify(row.skill, "skill")}`,
      skill: normalizeSkill(row.skill),
      description:
        clean(row.objective) ||
        clean(row.elvyStrategy) ||
        `Practise ${clean(row.skill) || "interaction"}.`,
      required: true,
      successThreshold: 65,
    }));
}

function createSupportSteps(
  plan: LessonPlan,
  blueprintStage?: ElvyBlueprintStage,
) {
  const blueprintSupport = Array.isArray(blueprintStage?.supportLadder)
    ? blueprintStage.supportLadder.map(clean).filter(Boolean)
    : [];

  const blueprintCorpus = plan.elvyBlueprint
    .map((item) => blueprintText(item))
    .join(" ");

  const useL1 = /l1|first language|mother tongue|translation/i.test(
    `${plan.teacherNotes} ${plan.differentiation} ${blueprintCorpus}`,
  );

  const fallbackSteps = [
    "Give the learner enough thinking time.",
    "Repeat the instruction slowly and clearly.",
    "Use shorter language without changing the objective.",
    "Provide a partial sentence or structured prompt.",
    useL1
      ? "Translate only the essential keyword, then return to the target language."
      : "Show one clear model example.",
    "Model a correct answer and ask the learner to try again.",
  ];

  const instructions = blueprintSupport.length > 0
    ? blueprintSupport
    : fallbackSteps;

  return instructions.map((instruction, index) => {
    const level = Math.min(index, 5);
    const types = [
      "wait",
      "repeat_instruction",
      "simplify_instruction",
      "give_sentence_frame",
      useL1 ? "translate_keyword" : "show_example",
      "model_answer",
    ] as const;

    return {
      level,
      type: types[level],
      instruction,
      content:
        level === 3
          ? clean(plan.sentencePatterns) || undefined
          : level === 5
            ? splitList(plan.usefulExpressions)[0] || undefined
            : undefined,
      maximumUses: level === 2 || level === 3 ? 2 : 1,
      useL1: level === 4 && useL1,
    };
  });
}

function createStages(
  plan: LessonPlan,
  objectiveIds: string[],
  vocabularyIds: string[],
  grammarIds: string[],
  functionIds: string[],
) {
  const sourceStages =
    plan.stages.length > 0
      ? plan.stages
      : [
          {
            stage: "Lesson",
            time: plan.duration,
            teacherActivities: plan.lessonObjectives,
            studentActivities: plan.outcomes,
            interaction: "Elvy ↔ Learner",
            resources: plan.resources,
            assessment: plan.formativeAssessment,
          },
        ];

  return sourceStages.map((stage, stageIndex) => {
    const stageId = `stage-${stageIndex + 1}-${slugify(stage.stage, "stage")}`;
    const activityId = `${stageId}-activity-1`;
    const estimatedMinutes = parseMinutes(
      stage.time,
      Math.max(1, Math.round(parseMinutes(plan.duration, 60) / sourceStages.length)),
    );
    const blueprintStage = blueprintStageForStage(stage.stage, plan);
    const blueprintInstruction = blueprintInstructionForStage(stage.stage, plan);
    const instruction = [
      blueprintInstruction,
      stage.teacherActivities,
      stage.studentActivities
        ? `Learner task: ${clean(stage.studentActivities)}`
        : "",
    ]
      .filter(isMeaningful)
      .map(clean)
      .join(" ");

    return {
      id: stageId,
      order: stageIndex + 1,
      type: normalizeStageType(stage.stage),
      title: clean(stage.stage) || `Stage ${stageIndex + 1}`,
      purpose:
        clean(blueprintStage?.teachingObjective) ||
        clean(stage.assessment) ||
        clean(stage.studentActivities) ||
        clean(stage.teacherActivities) ||
        `Complete stage ${stageIndex + 1}.`,
      objectiveIds,
      estimatedMinutes,
      required: true,
      skippable: false,
      activities: [
        {
          id: activityId,
          order: 1,
          type: inferActivityType(stage),
          title: clean(stage.stage) || `Activity ${stageIndex + 1}`,
          purpose:
            clean(blueprintStage?.teachingObjective) ||
            clean(stage.studentActivities) ||
            clean(stage.assessment) ||
            `Practise the lesson objectives.`,
          instruction:
            instruction ||
            `Guide the learner through ${clean(stage.stage) || "the activity"}.`,
          teacherPrompt:
            clean(blueprintStage?.elvyScript) ||
            clean(stage.teacherActivities) ||
            undefined,
          targetObjectiveIds: objectiveIds,
          targetVocabularyIds: vocabularyIds,
          targetGrammarIds: grammarIds,
          targetFunctionIds: functionIds,
          inputModality: inferInputModality(stage),
          outputModalities: inferOutputModalities(stage),
          expectedResponses: [
            {
              id: `${activityId}-response-1`,
              exactAnswers: [] as string[],
              acceptableAnswers:
                blueprintStage?.expectedResponses?.map(clean).filter(Boolean) ||
                ([] as string[]),
              requiredKeywords: [] as string[],
              forbiddenKeywords: [] as string[],
              semanticDescription:
                clean(blueprintStage?.evaluationCriteria) ||
                clean(stage.studentActivities) ||
                clean(stage.assessment) ||
                `A relevant response that satisfies the activity purpose.`,
              modelAnswer:
                blueprintStage?.expectedResponses?.map(clean).find(Boolean) ||
                splitList(plan.usefulExpressions)[0] ||
                undefined,
              caseSensitive: false,
              allowMinorSpellingErrors: true,
              allowEquivalentMeaning: true,
              evaluationFocus: {
                meaning: true,
                grammar: grammarIds.length > 0,
                vocabulary: vocabularyIds.length > 0,
                pronunciation: inferInputModality(stage) === "voice",
                fluency: normalizeStageType(stage.stage) === "communicative_practice",
                spelling: inferInputModality(stage) === "text",
                punctuation: inferInputModality(stage) === "text",
              },
            },
          ],
          minimumAttempts: 1,
          maximumAttempts: Math.max(1, blueprintStage?.retryLimit || 3),
          estimatedMinutes,
          required: true,
          supportSteps: createSupportSteps(plan, blueprintStage),
          successRule: {
            type: "minimum_score" as const,
            minimumScore: 65,
            requireTargetVocabulary: vocabularyIds.length > 0,
            requireTargetGrammar: grammarIds.length > 0,
            requireUnderstandablePronunciation:
              inferInputModality(stage) === "voice",
          },
          allowSkip: false,
          allowAlternativeActivity: false,
        },
      ],
      completionRule: {
        type: "all_required_activities_completed" as const,
        requiredActivityIds: [activityId],
        minimumCompletedActivities: 1,
      },
      entryMessage:
        clean(blueprintStage?.elvyScript) || blueprintInstruction || undefined,
      completionMessage:
        clean(blueprintStage?.successAction) ||
        `Good work. ${clean(stage.stage) || "This stage"} is complete.`,
    };
  });
}

function createAssessment(plan: LessonPlan, objectiveIds: string[]) {
  const sourceCriteria = [
    {
      name: "Meaning and task completion",
      description:
        clean(plan.successCriteria) ||
        clean(plan.communicativeObjective) ||
        "The learner communicates the intended meaning and completes the task.",
    },
    {
      name: "Target language use",
      description:
        clean(plan.languageObjective) ||
        "The learner uses the target vocabulary, grammar, and expressions appropriately.",
    },
    {
      name: "Participation and intelligibility",
      description:
        clean(plan.formativeAssessment) ||
        clean(plan.summativeAssessment) ||
        "The learner participates and produces an understandable response.",
    },
  ];

  const weight = 100 / sourceCriteria.length;

  const criteria = sourceCriteria.map((criterion, index) => ({
    id: `assessment-criterion-${index + 1}`,
    name: criterion.name,
    description: criterion.description,
    objectiveIds,
    maximumScore: 100,
    passingScore: 65,
    weight:
      index === sourceCriteria.length - 1
        ? 100 - weight * (sourceCriteria.length - 1)
        : weight,
  }));

  return {
    type: isMeaningful(plan.summativeAssessment)
      ? ("summative" as const)
      : ("formative" as const),
    criterionIds: criteria.map((criterion) => criterion.id),
    criteria,
    passingPercentage: 65,
    allowRetry: true,
    maximumRetries: 2,
    recordDetailedErrors: true,
  };
}

export function validateLessonPlan(
  plan: LessonPlan,
  context: BlueprintAdapterContext,
): LessonPlanValidationReport {
  const issues: LessonPlanValidationIssue[] = [];

  const requireValue = (
    path: keyof LessonPlan | keyof BlueprintAdapterContext,
    value: unknown,
  ) => {
    if (!isMeaningful(value)) {
      issues.push({
        path: String(path),
        code: "REQUIRED",
        message: `${String(path)} is required before the lesson can be adapted.`,
        value,
      });
    }
  };

  requireValue("lessonId", context.lessonId);
  requireValue("curriculumId", context.curriculumId);
  requireValue("lessonTitle", plan.lessonTitle);
  requireValue("level", plan.level);
  requireValue("duration", plan.duration);

  if (
    !isMeaningful(plan.lessonObjectives) &&
    !isMeaningful(plan.communicativeObjective) &&
    !isMeaningful(plan.languageObjective) &&
    !isMeaningful(plan.successCriteria)
  ) {
    issues.push({
      path: "lessonObjectives",
      code: "REQUIRED",
      message:
        "At least one lesson objective, communicative objective, language objective, or success criterion is required.",
    });
  }

  if (!Array.isArray(plan.stages) || plan.stages.length === 0) {
    issues.push({
      path: "stages",
      code: "EMPTY_COLLECTION",
      message: "The lesson plan must contain at least one teaching stage.",
      value: plan.stages,
    });
  }

  if (
    plan.status === "Approved" ||
    plan.status === "Ready for Elvy"
  ) {
    if (clean(plan.teacherApproved).toLowerCase() !== "yes") {
      issues.push({
        path: "teacherApproved",
        code: "NOT_APPROVED",
        message:
          "Approved lessons must have teacherApproved set to Yes.",
        value: plan.teacherApproved,
      });
    }
  }

  if (
    plan.status === "Ready for Elvy" &&
    clean(plan.readyForElvy).toLowerCase() !== "yes"
  ) {
    issues.push({
      path: "readyForElvy",
      code: "NOT_READY_FOR_ELVY",
      message:
        "A lesson with status Ready for Elvy must have readyForElvy set to Yes.",
      value: plan.readyForElvy,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function buildTeachingBrainLesson(
  plan: LessonPlan,
  context: BlueprintAdapterContext,
  source?: BlueprintAdapterSource,
): TeachingBrainLesson {
  // GSRP Teacher Plans and Elvy Teaching Blueprints are intentionally stored
  // as separate artifacts. Normalize optional collections here so a valid
  // Teacher Plan never crashes merely because its Blueprint is separate.
  const normalizedPlan = normalizeLessonPlanCollections(plan, source);

  const targetLanguage =
    context.targetLanguage ||
    inferLanguageCode(normalizedPlan.textbook || normalizedPlan.sourceBook);
  const sourceLanguage = context.sourceLanguage || "other";
  const objectives = hasExecutableBlueprint(source)
    ? executableObjectives(source)
    : createObjectives(normalizedPlan);
  const vocabulary = createVocabulary(normalizedPlan, targetLanguage);
  const grammar = createGrammar(normalizedPlan);
  const functions = createFunctions(normalizedPlan);
  const skills = createSkills(normalizedPlan);
  const objectiveIds = objectives.map((item) => item.id);
  const vocabularyIds = vocabulary.map((item) => item.id);
  const grammarIds = grammar.map((item) => item.id);
  const functionIds = functions.map((item) => item.id);
  const stages = hasExecutableBlueprint(source)
    ? executableStages(
        source,
        objectiveIds,
        vocabularyIds,
        grammarIds,
        functionIds,
      )
    : createStages(
        normalizedPlan,
        objectiveIds,
        vocabularyIds,
        grammarIds,
        functionIds,
      );
  const assessment = createAssessment(normalizedPlan, objectiveIds);
  const now = new Date().toISOString();
  const learnerL1 = context.learnerL1;
  const executableBlueprint = executableBlueprintObject(source);
  const nativeLanguageSupport = asObject(
    executableBlueprint?.nativeLanguageSupport,
  );
  const adaptation = asObject(
    executableBlueprint?.adaptation,
  );
  const lessonCompletionRule = asObject(
    executableBlueprint?.lessonCompletionRule,
  );
  const teachingRules = asObject(
    executableBlueprint?.teachingRules,
  );

  const l1Enabled =
    nativeLanguageSupport?.enabled === true ||
    Boolean(learnerL1) ||
    /l1|first language|mother tongue|translation/i.test(
      `${normalizedPlan.teacherNotes} ${normalizedPlan.differentiation} ${normalizedPlan.elvyBlueprint
        .map((item) => blueprintText(item))
        .join(" ")}`,
    );

  const rawLesson = {
    schemaVersion: "1.0",
    id: clean(context.lessonId),
    curriculum: {
      curriculumId: clean(context.curriculumId),
      resourceId: clean(context.resourceId) || undefined,
      academicProfileId: clean(context.academicProfileId) || undefined,
      levelId: clean(context.levelId) || undefined,
      sublevelId: clean(context.sublevelId) || undefined,
      unitId: clean(context.unitId) || undefined,
      lessonId: clean(context.lessonId),
      curriculumTitle: clean(context.curriculumTitle) || undefined,
      levelTitle: clean(normalizedPlan.level) || undefined,
      sublevelTitle: clean(normalizedPlan.sublevel) || undefined,
      unitTitle: clean(normalizedPlan.unit) || undefined,
      lessonTitle: clean(normalizedPlan.lessonTitle),
      sourceBookTitle: clean(normalizedPlan.sourceBook || normalizedPlan.textbook) || undefined,
      sourceEdition: clean(context.sourceEdition) || undefined,
      sourceLanguage,
      pageRange: parsePageRange(normalizedPlan.pages),
    },
    title: clean(normalizedPlan.lessonTitle),
    description:
      clean(normalizedPlan.theme) ||
      clean(normalizedPlan.lessonObjectives) ||
      `${clean(normalizedPlan.lessonNumber)}: ${clean(normalizedPlan.lessonTitle)}`,
    targetLanguage,
    level: clean(normalizedPlan.cefrLevel || normalizedPlan.sublevel || normalizedPlan.level),
    estimatedMinutes: parseMinutes(normalizedPlan.duration, 60),
    objectives,
    prerequisites: splitList(normalizedPlan.prerequisites),
    vocabulary,
    grammar,
    functions,
    skills,
    stages,
    assessment,
    completionCriteria: {
      minimumLessonScore: 65,
      minimumObjectiveMastery:
        typeof lessonCompletionRule?.minimumEvidencePerObjective ===
        "number"
          ? Math.max(
              1,
              Math.min(
                100,
                lessonCompletionRule.minimumEvidencePerObjective * 65,
              ),
            )
          : 65,
      requiredObjectiveIds:
        textArray(
          lessonCompletionRule?.requiredObjectiveIds,
        ).length > 0
          ? textArray(
              lessonCompletionRule?.requiredObjectiveIds,
            )
          : objectives
              .filter((objective) => objective.required)
              .map((objective) => objective.id),
      requiredActivityIds: stages.flatMap((stage) =>
        stage.activities
          .filter((activity) => activity.required)
          .map((activity) => activity.id),
      ),
      requireAssessmentCompletion: true,
      requireSpeakingParticipation: skills.some(
        (skill) =>
          skill.skill === "speaking" ||
          skill.skill === "pronunciation" ||
          skill.skill === "interaction",
      ),
      allowCompletionWithMinorGaps: true,
    },
    l1Policy: {
      enabled: l1Enabled,
      level: l1Enabled ? "limited" : "disabled",
      learnerL1,
      allowedTriggers: l1Enabled
        ? [
            "learner_requests_help",
            "instruction_not_understood",
            "repeated_failure",
            "beginner_support",
          ]
        : [],
      translateInstructions: l1Enabled,
      translateKeyVocabulary: l1Enabled,
      translateGrammarExplanations: false,
      returnToTargetLanguageAfterSupport: true,
      maximumConsecutiveL1Turns: l1Enabled
        ? typeof nativeLanguageSupport?.maximumConsecutiveL1Turns ===
          "number"
          ? nativeLanguageSupport.maximumConsecutiveL1Turns
          : 1
        : undefined,
    },
    correctionPolicy: {
      defaultTiming: "immediate",
      priorityFocuses: [
        "meaning",
        "grammar",
        "vocabulary",
        "pronunciation",
      ],
      interruptForMeaningBreakdown: true,
      interruptForTargetLanguageError: false,
      protectSpeakingFluency: true,
      usePositiveFraming: true,
      askLearnerToSelfCorrect: true,
      provideModelAfterFailedSelfCorrection: true,
    },
    adaptationPolicy: {
      allowDifficultyAdjustment: true,
      allowActivityReplacement: true,
      allowStageSkipping: false,
      allowPrerequisiteReview: true,
      protectRequiredObjectives: true,
      reduceDifficultyAfterFailedAttempts:
        textArray(adaptation?.whenStruggling).length > 0
          ? 2
          : 2,
      increaseDifficultyAfterSuccessfulAttempts:
        textArray(adaptation?.whenSuccessful).length > 0
          ? 2
          : 3,
      maximumRetriesPerActivity: 3,
      maximumSupportLevel: 5,
    },
    metadata: {
      executableBlueprint: hasExecutableBlueprint(source),
      sourceBlueprint: executableBlueprint || undefined,
      nativeLanguageSupport:
        nativeLanguageSupport || undefined,
      adaptation: adaptation || undefined,
      lessonCompletionRule:
        lessonCompletionRule || undefined,
      teachingRules: teachingRules || undefined,
    },
    teachingTone: {
      primary: "encouraging",
      secondary: ["patient", "warm", "supportive", "gentle"],
      avoid: ["shaming", "sarcasm", "overcorrection", "unnecessary complexity"],
      useLearnerName: true,
      maximumSentenceLength:
        /pre-a1|a1|beginner/i.test(normalizedPlan.cefrLevel || normalizedPlan.level) ? 14 : 22,
      praiseFrequency: "moderate",
    },
    status:
      normalizedPlan.status === "Ready for Elvy"
        ? "active"
        : normalizedPlan.status === "Approved"
          ? "active"
          : "draft",
    sourceBlueprintId:
      clean(context.sourceBlueprintId) ||
      `${clean(context.lessonId)}-lesson-plan`,
    sourceBlueprintVersion:
      clean(context.sourceBlueprintVersion) ||
      (hasExecutableBlueprint(source)
        ? "executable-blueprint-v1.4"
        : "lesson-plan-v1"),
    createdAt: context.createdAt || now,
    updatedAt: context.updatedAt || now,
  };

  // Runtime validation is the final authority. Casting happens only after
  // the complete object has been assembled.
  return parseTeachingBrainLesson(rawLesson);
}

export function safeAdaptLessonPlan(
  plan: LessonPlan,
  context: BlueprintAdapterContext,
  source?: BlueprintAdapterSource,
): SafeBlueprintAdapterResult {
  const sourceValidation = validateLessonPlan(plan, context);

  if (!sourceValidation.valid) {
    return {
      success: false,
      issues: sourceValidation.issues,
    };
  }

  try {
    const lesson = buildTeachingBrainLesson(plan, context, source);
    const parsed = safeParseTeachingBrainLesson(lesson);

    if (!parsed.success) {
      return {
        success: false,
        issues: parsed.issues,
      };
    }

    return {
      success: true,
      data: parsed.data,
      issues: [],
    };
  } catch (error) {
    if (error instanceof BlueprintAdapterError) {
      return {
        success: false,
        issues: error.issues,
      };
    }

    const candidate =
      error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
        ? ((error as { issues: LessonValidationIssue[] }).issues)
        : [];

    return {
      success: false,
      issues:
        candidate.length > 0
          ? candidate
          : [
              {
                path: "adapter",
                code: "INVALID_VALUE",
                message:
                  error instanceof Error
                    ? error.message
                    : "The lesson plan could not be adapted.",
              },
            ],
    };
  }
}

export function adaptLessonPlan(
  plan: LessonPlan,
  context: BlueprintAdapterContext,
  source?: BlueprintAdapterSource,
): TeachingBrainLesson {
  const result = safeAdaptLessonPlan(plan, context, source);

  if (!result.success) {
    throw new BlueprintAdapterError(
      "Lesson Plan to Teaching Brain adaptation failed.",
      result.issues,
    );
  }

  return result.data;
}

export function adaptLessonPlanResult(
  plan: LessonPlan,
  context: BlueprintAdapterContext,
  source?: BlueprintAdapterSource,
): TeachingBrainResult<TeachingBrainLesson> {
  const result = safeAdaptLessonPlan(plan, context, source);

  if (result.success) {
    return {
      ok: true,
      data: result.data,
    };
  }

  const error: TeachingBrainError = {
    code: "INVALID_LESSON",
    message: "The lesson plan could not be converted for the Teaching Brain.",
    recoverable: true,
    details: {
      issues: result.issues,
    },
  };

  return {
    ok: false,
    error,
  };
}

export const BlueprintAdapter = {
  validateLessonPlan,
  buildTeachingBrainLesson,
  safeAdaptLessonPlan,
  adaptLessonPlan,
  adaptLessonPlanResult,
};
