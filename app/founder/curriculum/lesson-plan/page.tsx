"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
type TeachingAssetMetadata = {
  type: string;
  file: string;
  title?: string;
  purpose?: string;
  altText?: string;
  stage?: string;
  keywords?: string[];
};

type CloudTeachingAsset = {
  key: string;
  assetId: string;
  lessonId?: string;
  metadata: TeachingAssetMetadata;
  blob?: Blob;
  url?: string;
};

type LessonStatus = "Draft" | "Generated" | "Reviewed" | "Approved" | "Ready for Elvy";

type LessonPlanStage = {
  stage: string;
  time: string;
  teacherActivities: string;
  studentActivities: string;
  interaction: string;
  resources: string;
  assessment: string;
};

type IntegratedSkillRow = {
  skill: string;
  objective: string;
  textbookActivities: string;
  elvyStrategy: string;
};

type JsonRecord = Record<string, unknown>;

type ElvyBlueprintObjective = {
  id: string;
  description: string;
  evidence: string;
};

type ElvyBlueprintScene = {
  sceneId: string;
  title: string;
  purpose: string;
  objectiveIds: string[];
  activityIds: string[];
  entryCondition: string;
  completionCondition: string;
  nextSceneId?: string;
  recoverySceneId?: string;
  whiteboard?: JsonRecord;
  teacherTurns: JsonRecord[];
  activities: JsonRecord[];
  assetIds: string[];
};

type ElvyBlueprintStage = {
  stage: string;
  duration: string;
  teachingObjective: string;
  whiteboardPlan: string | string[];
  elvyScript: string;
  learnerTaskSequence: string[];
  expectedResponses: string[];
  evaluationCriteria: string;
  feedbackStrategy: string;
  supportLadder: string[];
  successCriteria: string[];
  retryLimit: number;
  successAction: string;
  recoveryAction: string;
  transition: string;

  /** Executable Blueprint v1.4 fields. */
  stageId?: string;
  objectiveIds: string[];
  scenes: ElvyBlueprintScene[];
  stageCompletionRule?: JsonRecord;

  /** Legacy field kept so older locally saved lesson plans still open. */
  instructions?: string;
};

type ElvyBlueprintMetadata = {
  id?: string;
  lessonId?: string;
  objectives: ElvyBlueprintObjective[];
  nativeLanguageSupport?: JsonRecord;
  adaptation?: JsonRecord;
  lessonCompletionRule?: JsonRecord;
  teachingRules?: JsonRecord;
};

type LessonPlan = {
  status: LessonStatus;
  level: string;
  sublevel: string;
  unit: string;
  lessonNumber: string;
  lessonTitle: string;
  textbook: string;
  pages: string;
  duration: string;
  theme: string;
  cefrLevel: string;
  schoolGrade: string;

  unitObjectives: string;
  lessonObjectives: string;
  communicativeObjective: string;
  languageObjective: string;
  successCriteria: string;
  competencies: string;
  prerequisites: string;
  outcomes: string;

  vocabulary: string;
  grammar: string;
  functions: string;
  pronunciation: string;
  usefulExpressions: string;
  sentencePatterns: string;

  integratedSkills: IntegratedSkillRow[];

  teachingApproach: string;
  pedagogicalFramework: string;
  udlStrategies: string;
  differentiation: string;
  assessmentForLearning: string;

  stages: LessonPlanStage[];

  diagnosticAssessment: string;
  formativeAssessment: string;
  summativeAssessment: string;
  selfAssessment: string;
  peerAssessment: string;

  teacherTips: string;
  grouping: string;
  timeManagement: string;
  transitions: string;
  commonDifficulties: string;
  suggestedSolutions: string;

  resources: string;
  homework: string;
  fastFinishers: string;
  extraPractice: string;
  parentSuggestions: string;
  teacherNotes: string;

  elvyBlueprint: ElvyBlueprintStage[];
  elvyBlueprintMetadata: ElvyBlueprintMetadata;

  generatedBy: string;
  generationDate: string;
  sourceBook: string;
  confidenceScore: string;
  teacherApproved: string;
  readyForElvy: string;
};

type CurriculumNavigatorLesson = {
  id: string;
  title: string;
};

type CurriculumNavigatorUnit = {
  id: string;
  title: string;
  displayTitle: string;
  sublevelTitle: string;
  lessons: CurriculumNavigatorLesson[];
};

type CurriculumTreeRecord = {
  syllabusId: string;
  title: string;
  levelId: string;
  levelTitle: string;
  sublevelIds: string[];
  units: number;
  lessons: number;
  generatedAt: string;
};

const ACTIVE_STUDIO_SYLLABUS_KEY = "elvy-active-lesson-studio-syllabus";
const CURRICULUM_TREE_RECORDS_KEY = "elvy-curriculum-reader-trees-v1";


const statusOptions: LessonStatus[] = [
  "Draft",
  "Generated",
  "Reviewed",
  "Approved",
  "Ready for Elvy",
];

const starterPlan: LessonPlan = {
  status: "Draft",
  level: "Level A",
  sublevel: "A1",
  unit: "Unit 1: Getting Started",
  lessonNumber: "Lesson 1",
  lessonTitle: "First Contact",
  textbook: "English Spotlight 1",
  pages: "To be detected by Curriculum Reader",
  duration: "60 minutes",
  theme: "Greetings and first communication",
  cefrLevel: "Pre-A1 / A1",
  schoolGrade: "Year 1 Middle School",

  unitObjectives:
    "Students begin using simple English for classroom communication and first social interaction.",
  lessonObjectives:
    "Students greet people, introduce themselves, listen to a model dialogue, practise speaking, and produce a short guided exchange.",
  communicativeObjective:
    "Students can start a short conversation by greeting someone and giving their name.",
  languageObjective:
    "Students use simple greeting expressions and forms of be: I am / I’m; My name is / My name’s.",
  successCriteria:
    "Students can greet a partner, say their name clearly, respond politely, and complete a short role-play with support.",
  competencies: "Listening, Speaking, Interaction, Vocabulary building, Social communication",
  prerequisites: "Basic classroom language, alphabet awareness, simple greetings if known",
  outcomes:
    "By the end of the lesson, students can greet someone, introduce themselves, respond politely, and participate in a short guided exchange.",

  vocabulary: "hello, hi, name, nice to meet you, goodbye",
  grammar: "Verb be: I am / I’m; My name is / My name’s",
  functions: "Greeting, introducing oneself, responding politely",
  pronunciation: "Stress and intonation in greetings; clear pronunciation of names",
  usefulExpressions: "Hello. Hi. I’m ___. My name is ___. Nice to meet you. Nice to meet you too.",
  sentencePatterns: "I’m + name. / My name is + name. / Nice to meet you, + name.",

  integratedSkills: [
    {
      skill: "Listening",
      objective: "Recognize greetings and names in a short model dialogue.",
      textbookActivities: "Look and listen; listen again; tick what students hear.",
      elvyStrategy: "Play or model short utterances, pause, ask recognition questions, and repeat slowly when needed.",
    },
    {
      skill: "Speaking",
      objective: "Use greetings and self-introduction expressions in a guided dialogue.",
      textbookActivities: "Practice speaking in pairs and repeat the dialogue with personal names.",
      elvyStrategy: "Model the exchange, prompt the learner, provide sentence starters, then gradually remove support.",
    },
    {
      skill: "Reading",
      objective: "Recognize short written greeting expressions and names.",
      textbookActivities: "Read speech bubbles and classroom expressions.",
      elvyStrategy: "Display short expressions, ask the learner to choose or read, and connect written form to spoken form.",
    },
    {
      skill: "Writing",
      objective: "Write simple personal information or short greeting expressions.",
      textbookActivities: "Copy or complete short expressions when appropriate.",
      elvyStrategy: "Ask the learner to type a short self-introduction and give gentle feedback on accuracy.",
    },
  ],

  teachingApproach: "Communicative Language Teaching with PPP and integrated skills.",
  pedagogicalFramework:
    "Warm-up → Presentation → Guided Practice → Communicative Practice → Production → Reflection. Grammar is introduced in context after students hear and use language meaningfully.",
  udlStrategies:
    "Use audio, pictures, gestures, repetition, pair work, modelling, and short achievable tasks to include different learner profiles.",
  differentiation:
    "Give sentence starters and repetition to learners who need support; ask stronger learners to change partners and extend the dialogue.",
  assessmentForLearning:
    "Use observation, choral repetition, pair-work monitoring, short oral performance, and exit response.",

  stages: [
    {
      stage: "Warm-up",
      time: "5 min",
      teacherActivities: "Greet students warmly, smile, wave, and elicit Hello / Hi using gestures.",
      studentActivities: "Respond to greetings and repeat familiar expressions.",
      interaction: "T ↔ Ss",
      resources: "Board / gestures / pictures",
      assessment: "Observe participation and confidence",
    },
    {
      stage: "Presentation",
      time: "10 min",
      teacherActivities: "Present the model dialogue and highlight key greeting expressions.",
      studentActivities: "Listen, repeat, identify greetings and names.",
      interaction: "T ↔ Ss",
      resources: "Audio / textbook",
      assessment: "Check pronunciation and comprehension",
    },
    {
      stage: "Guided Practice",
      time: "15 min",
      teacherActivities: "Model the dialogue with a student, then organize controlled pair practice.",
      studentActivities: "Practise the model using their own names and switch roles.",
      interaction: "Pair work",
      resources: "Textbook / board",
      assessment: "Monitor pair work and correct gently",
    },
    {
      stage: "Communicative Practice",
      time: "15 min",
      teacherActivities: "Organize a mingle or partner-change activity so students greet different classmates.",
      studentActivities: "Greet classmates, exchange names, and respond politely.",
      interaction: "Ss ↔ Ss",
      resources: "Classroom space",
      assessment: "Observe fluency and confidence",
    },
    {
      stage: "Production",
      time: "10 min",
      teacherActivities: "Invite volunteer pairs to perform short dialogues and provide feedback.",
      studentActivities: "Perform short exchanges in front of the class.",
      interaction: "Pairs / class",
      resources: "None",
      assessment: "Oral performance checklist",
    },
    {
      stage: "Reflection & Homework",
      time: "5 min",
      teacherActivities: "Review the lesson objective and assign a short self-introduction homework.",
      studentActivities: "Say one expression they learned and copy homework.",
      interaction: "T ↔ Ss",
      resources: "Board",
      assessment: "Exit response",
    },
  ],

  diagnosticAssessment: "Ask students if they already know Hello / Hi and note prior knowledge.",
  formativeAssessment: "Monitor repetition, pair work, and oral responses during guided practice.",
  summativeAssessment: "Short role-play performance at the end of the lesson.",
  selfAssessment: "Students say whether they can greet someone and introduce themselves.",
  peerAssessment: "Partners check if the greeting exchange is complete and polite.",

  teacherTips:
    "Model every speaking task first. Assign how many times students practise before switching roles. Encourage equal participation.",
  grouping: "Whole class, pairs, volunteer pairs, possible partner change for extra practice.",
  timeManagement: "Keep teacher talk short; move quickly from model to practice.",
  transitions: "Use simple classroom language: Listen, repeat, work in pairs, switch roles, stop, look here.",
  commonDifficulties:
    "Students may be shy, mispronounce names, confuse I’m and My name is, or avoid speaking in front of classmates.",
  suggestedSolutions:
    "Use choral repetition, gestures, sentence starters, pair rehearsal before performance, and praise small successes.",

  resources: "Student Book, board, pictures, audio, flashcards, classroom space",
  homework: "Write three short sentences introducing yourself.",
  fastFinishers: "Ask two extra classmates their names and write them down.",
  extraPractice: "Repeat the dialogue with a family member or record a short greeting.",
  parentSuggestions: "Parents can ask the learner to say Hello and introduce themselves in English at home.",
  teacherNotes: "Adapt the amount of L1 support according to learners’ level.",

  elvyBlueprint: [
    {
      stage: "Warm-up",
      duration: "5 minutes",
      teachingObjective: "Activate prior knowledge and prepare the learner to use simple greetings.",
      whiteboardPlan: ["Hello", "Hi", "What is your name?"],
      elvyScript: "Greet the learner warmly, model Hello and Hi, and invite a short response.",
      learnerTaskSequence: ["Listen to the greeting", "Repeat the greeting", "Reply using Hello or Hi"],
      expectedResponses: ["Hello", "Hi"],
      evaluationCriteria: "The learner responds to a greeting with an appropriate expression.",
      feedbackStrategy: "Praise the response, then model once more if pronunciation needs support.",
      supportLadder: ["Repeat slowly", "Show the expression on the board", "Allow brief L1 clarification"],
      successCriteria: ["Responds appropriately", "Attempts clear pronunciation"],
      retryLimit: 3,
      successAction: "Continue to the presentation stage.",
      recoveryAction: "Model the greeting again and let the learner choose between Hello and Hi.",
      transition: "Now let us learn how to introduce ourselves.",
      objectiveIds: [],
      scenes: [],
    },
    {
      stage: "Presentation",
      duration: "10 minutes",
      teachingObjective: "Present the target dialogue and connect meaning, sound, and written form.",
      whiteboardPlan: ["I’m ___.", "My name is ___.", "Nice to meet you."],
      elvyScript: "Model the dialogue line by line. Ask the learner to listen first, then repeat each line.",
      learnerTaskSequence: ["Listen", "Repeat", "Match expressions to their meanings"],
      expectedResponses: ["I’m ...", "My name is ...", "Nice to meet you"],
      evaluationCriteria: "The learner recognizes and repeats the key expressions.",
      feedbackStrategy: "Correct one feature at a time and keep the focus on meaning before accuracy.",
      supportLadder: ["Replay or repeat", "Chunk the sentence", "Provide a sentence starter"],
      successCriteria: ["Recognizes the expressions", "Repeats the model intelligibly"],
      retryLimit: 3,
      successAction: "Move to guided practice.",
      recoveryAction: "Reduce the model to shorter chunks and rebuild the full expression.",
      transition: "Let us practise the dialogue together.",
      objectiveIds: [],
      scenes: [],
    },
    {
      stage: "Practice",
      duration: "15 minutes",
      teachingObjective: "Help the learner use greetings and introductions with guided support.",
      whiteboardPlan: ["Hello. I’m ___.", "What is your name?", "Nice to meet you."],
      elvyScript: "Prompt the learner with sentence starters, alternate roles, and gradually remove support.",
      learnerTaskSequence: ["Complete sentence starters", "Answer Elvy", "Switch roles"],
      expectedResponses: ["Hello. I’m ...", "My name is ...", "Nice to meet you too"],
      evaluationCriteria: "The learner completes the exchange with limited prompting.",
      feedbackStrategy: "Give brief corrective feedback after each completed exchange.",
      supportLadder: ["Show the full model", "Show only the first words", "Use a visual cue"],
      successCriteria: ["Completes the exchange", "Uses the target expressions appropriately"],
      retryLimit: 3,
      successAction: "Advance to independent production.",
      recoveryAction: "Return to one guided exchange before trying again.",
      transition: "Now try the conversation with less help.",
      objectiveIds: [],
      scenes: [],
    },
    {
      stage: "Production",
      duration: "15 minutes",
      teachingObjective: "Enable the learner to produce a short personal introduction independently.",
      whiteboardPlan: "Display only a small prompt: Greet → Name → Polite response.",
      elvyScript: "Ask the learner to introduce themselves without a full model. Offer hints only when needed.",
      learnerTaskSequence: ["Greet", "Say their name", "Respond politely", "Repeat with a variation"],
      expectedResponses: ["Hello. I’m ...", "Nice to meet you"],
      evaluationCriteria: "The learner performs a complete and understandable short exchange.",
      feedbackStrategy: "Acknowledge successful communication first, then give one improvement point.",
      supportLadder: ["Give a keyword", "Give a sentence starter", "Restore the model temporarily"],
      successCriteria: ["Communicates the intended meaning", "Completes all parts of the exchange"],
      retryLimit: 2,
      successAction: "Proceed to assessment.",
      recoveryAction: "Repeat the production task with a visual sequence prompt.",
      transition: "Let us check what you can do by yourself.",
      objectiveIds: [],
      scenes: [],
    },
    {
      stage: "Assessment",
      duration: "10 minutes",
      teachingObjective: "Check whether the learner can greet, introduce themselves, and respond politely.",
      whiteboardPlan: "Hide full answers and display only the assessment task.",
      elvyScript: "Conduct one short role-play, listen without interrupting, then provide concise feedback.",
      learnerTaskSequence: ["Complete the role-play", "Listen to feedback", "Correct one sentence if needed"],
      expectedResponses: ["A complete greeting and introduction exchange"],
      evaluationCriteria: "Appropriate greeting, clear name statement, polite response, and understandable pronunciation.",
      feedbackStrategy: "State what was successful, identify one next step, and invite one corrected attempt.",
      supportLadder: ["Repeat the question", "Provide one keyword", "Allow one guided retry"],
      successCriteria: ["Meets the communicative objective", "Uses the main expressions accurately enough"],
      retryLimit: 2,
      successAction: "Mark the lesson objective as achieved and assign homework.",
      recoveryAction: "Return to the weakest expression for a short focused practice.",
      transition: "You are ready for a short follow-up task.",
      objectiveIds: [],
      scenes: [],
    },
    {
      stage: "Homework",
      duration: "5 minutes",
      teachingObjective: "Consolidate the lesson through a short personal introduction task.",
      whiteboardPlan: "Write: Hello. I’m ___. My name is ___. Nice to meet you.",
      elvyScript: "Explain the homework clearly and ask the learner to repeat what they need to do.",
      learnerTaskSequence: ["Read the task", "Explain the task in their own words", "Complete it after the lesson"],
      expectedResponses: ["I will write or record a short introduction"],
      evaluationCriteria: "The learner understands the homework instructions.",
      feedbackStrategy: "Confirm the task and encourage the learner to keep it short and accurate.",
      supportLadder: ["Show an example", "Break the task into three steps"],
      successCriteria: ["Can explain the homework task"],
      retryLimit: 2,
      successAction: "Close the lesson positively.",
      recoveryAction: "Restate the homework using simpler language.",
      transition: "End the lesson and save progress.",
      objectiveIds: [],
      scenes: [],
    },
  ],
  elvyBlueprintMetadata: {
    objectives: [],
  },

  generatedBy: "Manual starter plan / Curriculum Reader later",
  generationDate: new Date().toISOString().slice(0, 10),
  sourceBook: "English Spotlight 1",
  confidenceScore: "Starter plan - not AI scored yet",
  teacherApproved: "No",
  readyForElvy: "No",
};


type CloudLessonContext = {
  packageId?: string;
  syllabusId?: string;
  packageTitle?: string;
  level?: { id?: string; title?: string };
  sublevel?: { id?: string; title?: string };
  unit?: { id?: string; title?: string };
  lesson?: {
    id?: string;
    title?: string;
    lessonNumber?: string;
    pageRange?: string;
    duration?: string;
    theme?: string;
    cefrLevel?: string;
    schoolGrade?: string;
    lessonPlanData?: Record<string, unknown>;
    blueprintData?: Record<string, unknown>;
    elvyBlueprint?: unknown[];
    blueprintId?: string;
    teachingAssets?: unknown[];
  };
  teachingAssets?: unknown[];
};

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeIntegratedSkills(value: unknown): IntegratedSkillRow[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object",
    )
    .map((item) => ({
      skill: stringValue(item.skill),
      objective: stringValue(item.objective),
      textbookActivities: stringValue(item.textbookActivities),
      elvyStrategy: stringValue(item.elvyStrategy),
    }));
}

function normalizeStages(value: unknown): LessonPlanStage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object",
    )
    .map((item) => ({
      stage: stringValue(item.stage),
      time: stringValue(item.time),
      teacherActivities: stringValue(item.teacherActivities),
      studentActivities: stringValue(item.studentActivities),
      interaction: stringValue(item.interaction),
      resources: stringValue(item.resources),
      assessment: stringValue(item.assessment),
    }));
}

function recordValue(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function recordArrayValue(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function normalizeBlueprintScene(value: unknown): ElvyBlueprintScene | null {
  const item = recordValue(value);
  if (!item) return null;

  return {
    sceneId: stringValue(item.sceneId),
    title: stringValue(item.title),
    purpose: stringValue(item.purpose),
    objectiveIds: stringArrayValue(item.objectiveIds),
    activityIds: stringArrayValue(item.activityIds),
    entryCondition: stringValue(item.entryCondition),
    completionCondition: stringValue(item.completionCondition),
    nextSceneId: stringValue(item.nextSceneId) || undefined,
    recoverySceneId: stringValue(item.recoverySceneId) || undefined,
    whiteboard: recordValue(item.whiteboard),
    teacherTurns: recordArrayValue(item.teacherTurns),
    activities: recordArrayValue(item.activities),
    assetIds: stringArrayValue(item.assetIds),
  };
}

function normalizeBlueprintMetadata(
  value: unknown,
  fallbackLessonId = "",
): ElvyBlueprintMetadata {
  const item = recordValue(value) || {};
  const objectives = recordArrayValue(item.objectives).map((objective) => ({
    id: stringValue(objective.id),
    description: stringValue(objective.description),
    evidence: stringValue(objective.evidence),
  }));

  return {
    id: stringValue(item.id) || undefined,
    lessonId: stringValue(item.lessonId, fallbackLessonId) || undefined,
    objectives,
    nativeLanguageSupport: recordValue(item.nativeLanguageSupport),
    adaptation: recordValue(item.adaptation),
    lessonCompletionRule: recordValue(item.lessonCompletionRule),
    teachingRules: recordValue(item.teachingRules),
  };
}

function normalizeBlueprint(value: unknown): ElvyBlueprintStage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object",
    )
    .map((item) => ({
      stage: stringValue(item.stage),
      duration: stringValue(item.duration),
      teachingObjective: stringValue(item.teachingObjective),
      whiteboardPlan: Array.isArray(item.whiteboardPlan)
        ? stringArrayValue(item.whiteboardPlan)
        : stringValue(item.whiteboardPlan),
      elvyScript: stringValue(item.elvyScript),
      learnerTaskSequence: stringArrayValue(item.learnerTaskSequence),
      expectedResponses: stringArrayValue(item.expectedResponses),
      evaluationCriteria: stringValue(item.evaluationCriteria),
      feedbackStrategy: stringValue(item.feedbackStrategy),
      supportLadder: stringArrayValue(item.supportLadder),
      successCriteria: stringArrayValue(item.successCriteria),
      retryLimit:
        typeof item.retryLimit === "number" ? item.retryLimit : 0,
      successAction: stringValue(item.successAction),
      recoveryAction: stringValue(item.recoveryAction),
      transition: stringValue(item.transition),
      stageId: stringValue(item.stageId) || undefined,
      objectiveIds: stringArrayValue(item.objectiveIds),
      scenes: Array.isArray(item.scenes)
        ? item.scenes
            .map(normalizeBlueprintScene)
            .filter((scene): scene is ElvyBlueprintScene => scene !== null)
        : [],
      stageCompletionRule: recordValue(item.stageCompletionRule),
      instructions: stringValue(item.instructions) || undefined,
    }));
}

function normalizeTeachingAssets(value: unknown): CloudTeachingAsset[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object",
    )
    .map((item, index) => {
      const metadataSource =
        item.metadata && typeof item.metadata === "object"
          ? (item.metadata as Record<string, unknown>)
          : item;

      const assetId =
        stringValue(item.assetId) ||
        stringValue(item.id) ||
        stringValue(metadataSource.assetId) ||
        `teaching-asset-${index + 1}`;

      const file =
        stringValue(metadataSource.file) ||
        stringValue(item.file) ||
        stringValue(item.path);

      const url =
        stringValue(item.url) ||
        stringValue(item.publicUrl) ||
        stringValue(item.storageUrl) ||
        stringValue(metadataSource.url) ||
        stringValue(metadataSource.publicUrl);

      return {
        key: stringValue(item.key, assetId),
        assetId,
        lessonId: stringValue(item.lessonId) || undefined,
        metadata: {
          type: stringValue(metadataSource.type, "resource"),
          file,
          title: stringValue(metadataSource.title) || undefined,
          purpose: stringValue(metadataSource.purpose) || undefined,
          altText: stringValue(metadataSource.altText) || undefined,
          stage: stringValue(metadataSource.stage) || undefined,
          keywords: stringArrayValue(metadataSource.keywords),
        },
        url: url || undefined,
      };
    });
}

function normalizeCloudLessonPlan(
  context: CloudLessonContext,
): LessonPlan {
  const lesson = context.lesson || {};
  const raw =
    lesson.lessonPlanData &&
    typeof lesson.lessonPlanData === "object"
      ? lesson.lessonPlanData
      : {};

  const blueprintFromPlan = normalizeBlueprint(raw.elvyBlueprint);
  const blueprintFromCloud = normalizeBlueprint(lesson.elvyBlueprint);
  const blueprintFromData = normalizeBlueprint(
    lesson.blueprintData &&
    typeof lesson.blueprintData === "object"
      ? lesson.blueprintData.stages
      : [],
  );
  const blueprintMetadata = normalizeBlueprintMetadata(
    lesson.blueprintData,
    lesson.id || "",
  );

  return {
    status:
      raw.status === "Draft" ||
      raw.status === "Generated" ||
      raw.status === "Reviewed" ||
      raw.status === "Approved" ||
      raw.status === "Ready for Elvy"
        ? raw.status
        : "Generated",
    level: stringValue(raw.level, context.level?.title || ""),
    sublevel: stringValue(raw.sublevel, context.sublevel?.title || ""),
    unit: stringValue(raw.unit, context.unit?.title || ""),
    lessonNumber: stringValue(
      raw.lessonNumber,
      lesson.lessonNumber || "",
    ),
    lessonTitle: stringValue(
      raw.lessonTitle,
      lesson.title || "",
    ),
    textbook: stringValue(raw.textbook, context.packageTitle || ""),
    pages: stringValue(raw.pages, lesson.pageRange || ""),
    duration: stringValue(raw.duration, lesson.duration || ""),
    theme: stringValue(raw.theme, lesson.theme || ""),
    cefrLevel: stringValue(raw.cefrLevel, lesson.cefrLevel || ""),
    schoolGrade: stringValue(
      raw.schoolGrade,
      lesson.schoolGrade || "",
    ),

    unitObjectives: stringValue(raw.unitObjectives),
    lessonObjectives: stringValue(raw.lessonObjectives),
    communicativeObjective: stringValue(raw.communicativeObjective),
    languageObjective: stringValue(raw.languageObjective),
    successCriteria: stringValue(raw.successCriteria),
    competencies: stringValue(raw.competencies),
    prerequisites: stringValue(raw.prerequisites),
    outcomes: stringValue(raw.outcomes),

    vocabulary: stringValue(raw.vocabulary),
    grammar: stringValue(raw.grammar),
    functions: stringValue(raw.functions),
    pronunciation: stringValue(raw.pronunciation),
    usefulExpressions: stringValue(raw.usefulExpressions),
    sentencePatterns: stringValue(raw.sentencePatterns),

    integratedSkills: normalizeIntegratedSkills(raw.integratedSkills),

    teachingApproach: stringValue(raw.teachingApproach),
    pedagogicalFramework: stringValue(raw.pedagogicalFramework),
    udlStrategies: stringValue(raw.udlStrategies),
    differentiation: stringValue(raw.differentiation),
    assessmentForLearning: stringValue(raw.assessmentForLearning),

    stages: normalizeStages(raw.stages),

    diagnosticAssessment: stringValue(raw.diagnosticAssessment),
    formativeAssessment: stringValue(raw.formativeAssessment),
    summativeAssessment: stringValue(raw.summativeAssessment),
    selfAssessment: stringValue(raw.selfAssessment),
    peerAssessment: stringValue(raw.peerAssessment),

    teacherTips: stringValue(raw.teacherTips),
    grouping: stringValue(raw.grouping),
    timeManagement: stringValue(raw.timeManagement),
    transitions: stringValue(raw.transitions),
    commonDifficulties: stringValue(raw.commonDifficulties),
    suggestedSolutions: stringValue(raw.suggestedSolutions),

    resources: stringValue(raw.resources),
    homework: stringValue(raw.homework),
    fastFinishers: stringValue(raw.fastFinishers),
    extraPractice: stringValue(raw.extraPractice),
    parentSuggestions: stringValue(raw.parentSuggestions),
    teacherNotes: stringValue(raw.teacherNotes),

    elvyBlueprint:
      blueprintFromPlan.length > 0
        ? blueprintFromPlan
        : blueprintFromCloud.length > 0
          ? blueprintFromCloud
          : blueprintFromData,
    elvyBlueprintMetadata: blueprintMetadata,

    generatedBy: stringValue(raw.generatedBy, "Elvy GSRP"),
    generationDate: stringValue(raw.generationDate),
    sourceBook: stringValue(
      raw.sourceBook,
      context.packageTitle || "",
    ),
    confidenceScore: stringValue(raw.confidenceScore),
    teacherApproved: stringValue(raw.teacherApproved, "No"),
    readyForElvy: stringValue(raw.readyForElvy, "No"),
  };
}

function JsonTextCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">
        {value || "Not provided"}
      </p>
    </div>
  );
}

function JsonDetailCard({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  const hasValue =
    value !== undefined &&
    value !== null &&
    (!Array.isArray(value) || value.length > 0) &&
    (typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value as JsonRecord).length > 0);

  return (
    <details className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer list-none px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-black text-slate-800">{title}</span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
            hasValue
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-200 text-slate-500"
          }`}>
            {hasValue
              ? Array.isArray(value)
                ? `${value.length} item${value.length === 1 ? "" : "s"}`
                : "Available"
              : "Not provided"}
          </span>
        </div>
      </summary>
      {hasValue ? (
        <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap border-t border-slate-200 bg-white p-4 text-xs font-semibold leading-5 text-slate-700">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : null}
    </details>
  );
}

function LessonPlanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryLessonId = searchParams.get("lessonId");
  const querySyllabusId = searchParams.get("syllabusId");
  const queryPackageId = searchParams.get("packageId");
  const pathParts = typeof window !== "undefined"
    ? window.location.pathname.split("/").filter(Boolean)
    : [];
  const pathLessonId = pathParts.length ? pathParts[pathParts.length - 1] : "";
  const lessonId = queryLessonId || (pathLessonId && pathLessonId !== "lesson-plan-studio" ? pathLessonId : "starter-lesson");
  const [activeSyllabusId, setActiveSyllabusId] = useState(
    querySyllabusId || "",
  );
  const [activeSyllabusTitle, setActiveSyllabusTitle] = useState("");
  const [plan, setPlan] = useState<LessonPlan>(starterPlan);
  const [saveStatus, setSaveStatus] = useState("Loading lesson from Elvy Cloud...");
  const [openSection, setOpenSection] = useState("lesson-information");
  const [previewMode, setPreviewMode] = useState<"" | "teacher" | "record" | "elvy">("");
  const [curriculumUnits, setCurriculumUnits] = useState<CurriculumNavigatorUnit[]>([]);
  const [focusedUnitId, setFocusedUnitId] = useState<string | null>(null);
  const [curriculumNavigatorStatus, setCurriculumNavigatorStatus] = useState(
    "Loading curriculum units...",
  );
  const [teachingAssets, setTeachingAssets] = useState<
    CloudTeachingAsset[]
  >([]);
  const [teachingAssetUrls, setTeachingAssetUrls] = useState<
    Record<string, string>
  >({});
  const [teachingAssetsStatus, setTeachingAssetsStatus] = useState(
    "No teaching assets loaded.",
  );

  useEffect(() => {
    const resolvedSyllabusId =
      querySyllabusId ||
      window.localStorage.getItem(ACTIVE_STUDIO_SYLLABUS_KEY) ||
      "";

    setActiveSyllabusId(resolvedSyllabusId);

    if (resolvedSyllabusId) {
      window.localStorage.setItem(
        ACTIVE_STUDIO_SYLLABUS_KEY,
        resolvedSyllabusId,
      );
    }
  }, [querySyllabusId]);

  useEffect(() => {
    let cancelled = false;

    async function loadLessonFromCloud() {
      setOpenSection("lesson-information");
      setPreviewMode("");

      if (!lessonId || lessonId === "starter-lesson") {
        setPlan(starterPlan);
        setSaveStatus("Starter lesson plan");
        return;
      }

      const resolvedSyllabusId =
        querySyllabusId ||
        activeSyllabusId ||
        window.localStorage.getItem(ACTIVE_STUDIO_SYLLABUS_KEY) ||
        "";

      if (!resolvedSyllabusId && !queryPackageId) {
        setSaveStatus("No active cloud curriculum selected.");
        return;
      }

      try {
        setSaveStatus("Loading lesson from Elvy Cloud...");

        const params = new URLSearchParams();
        if (queryPackageId) {
          params.set("packageId", queryPackageId);
        } else {
          params.set("syllabusId", resolvedSyllabusId);
        }
        params.set("lessonId", lessonId);

        const response = await fetch(
          `/api/elvy-packages?${params.toString()}`,
          {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          },
        );
        const data = await response.json();

        if (!response.ok || !data?.success || !data?.lessonContext) {
          throw new Error(
            data?.error ||
              "The lesson could not be loaded from Elvy Cloud.",
          );
        }

        if (cancelled) return;

        const context = data.lessonContext as CloudLessonContext;
        const cloudPlan = normalizeCloudLessonPlan(context);

        setPlan(cloudPlan);
        setActiveSyllabusTitle(context.packageTitle || "");

        const cloudAssets = normalizeTeachingAssets(
          context.teachingAssets || context.lesson?.teachingAssets,
        );
        const cloudAssetUrls = cloudAssets.reduce<Record<string, string>>(
          (urls, asset) => {
            if (asset.url) urls[asset.assetId] = asset.url;
            return urls;
          },
          {},
        );
        setTeachingAssets(cloudAssets);
        setTeachingAssetUrls(cloudAssetUrls);
        setTeachingAssetsStatus(
          cloudAssets.length
            ? `${cloudAssets.length} teaching asset${
                cloudAssets.length === 1 ? "" : "s"
              } loaded from Elvy Cloud.`
            : "No teaching assets are linked to this lesson in Elvy Cloud.",
        );

        if (context.syllabusId) {
          setActiveSyllabusId(context.syllabusId);
          window.localStorage.setItem(
            ACTIVE_STUDIO_SYLLABUS_KEY,
            context.syllabusId,
          );
        }

        setSaveStatus("Loaded from Elvy Cloud");
      } catch (error) {
        console.error("Could not load cloud lesson plan:", error);
        if (!cancelled) {
          setSaveStatus(
            error instanceof Error
              ? error.message
              : "Could not load the cloud lesson plan.",
          );
        }
      }
    }

    void loadLessonFromCloud();

    return () => {
      cancelled = true;
    };
  }, [
    activeSyllabusId,
    lessonId,
    queryPackageId,
    querySyllabusId,
  ]);

  useEffect(() => {
    let isCancelled = false;

    async function loadCurriculumNavigator() {
      try {
        setCurriculumNavigatorStatus("Loading curriculum units...");
        const response = await fetch("/api/curriculum", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok || !data?.success || !Array.isArray(data?.curriculum?.levels)) {
          throw new Error("The saved curriculum could not be loaded.");
        }

        const levels = data.curriculum.levels as Array<{
          id: string;
          title: string;
          sublevels?: Array<{
            id: string;
            title: string;
            units?: Array<{
              id: string;
              title: string;
              lessons?: Array<{ id: string; title: string }>;
            }>;
          }>;
        }>;

        let treeRecords: CurriculumTreeRecord[] = [];

        try {
          const rawTreeRecords = window.localStorage.getItem(
            CURRICULUM_TREE_RECORDS_KEY,
          );
          const parsedTreeRecords = rawTreeRecords
            ? (JSON.parse(rawTreeRecords) as CurriculumTreeRecord[])
            : [];
          treeRecords = Array.isArray(parsedTreeRecords)
            ? parsedTreeRecords
            : [];
        } catch (error) {
          console.error(
            "Could not read Curriculum Reader tree records:",
            error,
          );
        }

        const requestedTreeRecord = activeSyllabusId
          ? treeRecords.find(
              (record) => record.syllabusId === activeSyllabusId,
            )
          : null;

        const levelFromSyllabus = requestedTreeRecord
          ? levels.find((level) => level.id === requestedTreeRecord.levelId)
          : null;

        const levelFromLesson = levels.find((level) =>
          (level.sublevels || []).some((sublevel) =>
            (sublevel.units || []).some((unit) =>
              (unit.lessons || []).some((lesson) => lesson.id === lessonId),
            ),
          ),
        );

        const levelToDisplay =
          levelFromSyllabus ||
          levelFromLesson ||
          (!activeSyllabusId
            ? levels.find((level) =>
                (level.sublevels || []).some((sublevel) =>
                  (sublevel.units || []).some(
                    (unit) => (unit.lessons || []).length > 0,
                  ),
                ),
              )
            : null);

        if (!levelToDisplay) {
          if (!isCancelled) {
            setCurriculumUnits([]);
            setCurriculumNavigatorStatus("No curriculum units are available yet.");
          }
          return;
        }

        let unitNumber = 0;
        const units = (levelToDisplay.sublevels || []).flatMap((sublevel) =>
          (sublevel.units || []).map((unit) => {
            unitNumber += 1;
            const cleanTitle = String(unit.title || `Unit ${unitNumber}`).replace(
              /^Unit\s+\d+\s*:\s*/i,
              "",
            );

            return {
              id: unit.id,
              title: unit.title || `Unit ${unitNumber}`,
              displayTitle: `Unit ${unitNumber}: ${cleanTitle}`,
              sublevelTitle: sublevel.title,
              lessons: (unit.lessons || []).map((lesson) => ({
                id: lesson.id,
                title: lesson.title,
              })),
            };
          }),
        );

        const activeUnit = units.find((unit) =>
          unit.lessons.some((lesson) => lesson.id === lessonId),
        );

        if (!isCancelled) {
          const resolvedTreeRecord =
            requestedTreeRecord ||
            treeRecords.find(
              (record) => record.levelId === levelToDisplay.id,
            ) ||
            null;
          const resolvedSyllabusId =
            resolvedTreeRecord?.syllabusId || activeSyllabusId;

          if (resolvedSyllabusId) {
            setActiveSyllabusId(resolvedSyllabusId);
            window.localStorage.setItem(
              ACTIVE_STUDIO_SYLLABUS_KEY,
              resolvedSyllabusId,
            );
          }

          setActiveSyllabusTitle(resolvedTreeRecord?.title || "");
          setCurriculumUnits(units);
          setFocusedUnitId(activeUnit?.id || units[0]?.id || null);
          setCurriculumNavigatorStatus(
            `${levelToDisplay.title} • ${units.length} unit${units.length === 1 ? "" : "s"}`,
          );
        }
      } catch (error) {
        console.error("Could not load Lesson Plan Studio curriculum navigator:", error);
        if (!isCancelled) {
          setCurriculumUnits([]);
          setCurriculumNavigatorStatus(
            error instanceof Error
              ? error.message
              : "The curriculum navigator could not be loaded.",
          );
        }
      }
    }

    void loadCurriculumNavigator();

    return () => {
      isCancelled = true;
    };
  }, [activeSyllabusId, lessonId]);

  // Teaching assets are loaded with the lesson from Elvy Cloud.
  // Browser-local IndexedDB/localStorage must never determine lesson completion.

  const fileName = useMemo(() => {
    return `${plan.lessonNumber} - ${plan.lessonTitle} Lesson Plan`.replace(/[\\/:*?"<>|]/g, "");
  }, [plan.lessonNumber, plan.lessonTitle]);

  function updateField(field: keyof LessonPlan, value: string) {
    setPlan((prev) => ({ ...prev, [field]: value }));
    setSaveStatus("Unsaved changes");
  }

  function updateStatus(status: LessonStatus) {
    setPlan((prev) => ({
      ...prev,
      status,
      teacherApproved: status === "Approved" || status === "Ready for Elvy" ? "Yes" : prev.teacherApproved,
      readyForElvy: status === "Ready for Elvy" ? "Yes" : "No",
    }));
    setSaveStatus("Unsaved changes");
  }

  function updateStage(index: number, field: keyof LessonPlanStage, value: string) {
    setPlan((prev) => ({
      ...prev,
      stages: prev.stages.map((stage, stageIndex) =>
        stageIndex === index ? { ...stage, [field]: value } : stage,
      ),
    }));
    setSaveStatus("Unsaved changes");
  }

  function addStage() {
    setPlan((prev) => ({
      ...prev,
      stages: [
        ...prev.stages,
        {
          stage: "New Stage",
          time: "5 min",
          teacherActivities: "",
          studentActivities: "",
          interaction: "",
          resources: "",
          assessment: "",
        },
      ],
    }));
    setSaveStatus("Unsaved changes");
  }

  function removeStage(index: number) {
    setPlan((prev) => ({
      ...prev,
      stages: prev.stages.filter((_, stageIndex) => stageIndex !== index),
    }));
    setSaveStatus("Unsaved changes");
  }

  function updateSkill(index: number, field: keyof IntegratedSkillRow, value: string) {
    setPlan((prev) => ({
      ...prev,
      integratedSkills: prev.integratedSkills.map((skill, skillIndex) =>
        skillIndex === index ? { ...skill, [field]: value } : skill,
      ),
    }));
    setSaveStatus("Unsaved changes");
  }

  function updateBlueprint(
    index: number,
    field: keyof ElvyBlueprintStage,
    value: ElvyBlueprintStage[keyof ElvyBlueprintStage],
  ) {
    setPlan((prev) => ({
      ...prev,
      elvyBlueprint: prev.elvyBlueprint.map((stage, stageIndex) =>
        stageIndex === index ? { ...stage, [field]: value } : stage,
      ),
    }));
    setSaveStatus("Unsaved changes");
  }

  function savePlan() {
    setSaveStatus(
      "Lesson content is loaded from Elvy Cloud. Browser-local lesson copies are disabled.",
    );
  }

  function openLessonFromNavigator(nextLessonId: string) {
    if (!nextLessonId || nextLessonId === lessonId) return;

    const nextUnit = curriculumUnits.find((unit) =>
      unit.lessons.some((lesson) => lesson.id === nextLessonId),
    );
    if (nextUnit) setFocusedUnitId(nextUnit.id);

    const params = new URLSearchParams();

    if (activeSyllabusId) {
      params.set("syllabusId", activeSyllabusId);
      window.localStorage.setItem(
        ACTIVE_STUDIO_SYLLABUS_KEY,
        activeSyllabusId,
      );
    }

    params.set("lessonId", nextLessonId);

    router.replace(
      `/founder/curriculum/lesson-plan?${params.toString()}`,
      { scroll: false },
    );
  }

  const activeCurriculumUnit = curriculumUnits.find((unit) =>
    unit.lessons.some((lesson) => lesson.id === lessonId),
  );

  const visibleNavigatorUnits = focusedUnitId
    ? curriculumUnits.filter((unit) => unit.id === focusedUnitId)
    : curriculumUnits;

  function returnToCurriculumReader() {
    if (activeSyllabusId) {
      window.localStorage.setItem(
        ACTIVE_STUDIO_SYLLABUS_KEY,
        activeSyllabusId,
      );
    }

    router.push("/founder/curriculum");
  }

  function escapeHtml(value: string) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function blueprintText(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value.filter(Boolean).join(" • ");
    return String(value || "");
  }

  function blueprintLines(value: string) {
    return value
      .split(/\r?\n|•/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function prettyJson(value: unknown) {
    if (value === undefined || value === null) return "";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function jsonSummary(value: unknown) {
    if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
    if (value && typeof value === "object") return `${Object.keys(value as JsonRecord).length} field${Object.keys(value as JsonRecord).length === 1 ? "" : "s"}`;
    return String(value || "");
  }

  function renderJsonBlock(value: unknown) {
    const content = prettyJson(value);
    if (!content) return "";
    return `<pre class="json-block">${escapeHtml(content)}</pre>`;
  }

  function renderPrintableLessonPlanHtml() {
    const skillRows = plan.integratedSkills
      .map(
        (skill) => `
          <tr>
            <td>${escapeHtml(skill.skill)}</td>
            <td>${escapeHtml(skill.objective)}</td>
            <td>${escapeHtml(skill.textbookActivities)}</td>
            <td>${escapeHtml(skill.elvyStrategy)}</td>
          </tr>
        `,
      )
      .join("");

    const stageRows = plan.stages
      .map(
        (stage) => `
          <tr>
            <td>${escapeHtml(stage.stage)}</td>
            <td>${escapeHtml(stage.time)}</td>
            <td>${escapeHtml(stage.teacherActivities)}</td>
            <td>${escapeHtml(stage.studentActivities)}</td>
            <td>${escapeHtml(stage.interaction)}</td>
            <td>${escapeHtml(stage.resources)}</td>
            <td>${escapeHtml(stage.assessment)}</td>
          </tr>
        `,
      )
      .join("");


    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(fileName)}</title>
  <style>
    @page { size: A4 landscape; margin: 1.1cm; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      font-size: 10.5pt;
      line-height: 1.3;
      margin: 0;
      background: #ffffff;
    }
    .page { width: 100%; margin: 0 auto; }
    .header {
      text-align: center;
      border: 2px solid #111827;
      padding: 10px;
      margin-bottom: 10px;
    }
    .header h1 {
      margin: 0;
      font-size: 17pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header p { margin: 4px 0 0; font-weight: 700; }
    .section-title {
      background: #eaf2ff;
      border: 1px solid #111827;
      padding: 6px 8px;
      font-weight: 800;
      text-transform: uppercase;
      margin-top: 10px;
      margin-bottom: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 0 0 8px;
    }
    th, td {
      border: 1px solid #111827;
      padding: 6px;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    th {
      background: #f1f5f9;
      font-weight: 800;
      text-align: center;
    }
    .info td:first-child {
      width: 18%;
      font-weight: 800;
      background: #f8fafc;
    }
    .two-col td:first-child,
    .two-col td:nth-child(3) {
      width: 16%;
      font-weight: 800;
      background: #f8fafc;
    }
    .procedure th:nth-child(1) { width: 11%; }
    .procedure th:nth-child(2) { width: 8%; }
    .procedure th:nth-child(3) { width: 23%; }
    .procedure th:nth-child(4) { width: 23%; }
    .procedure th:nth-child(5) { width: 9%; }
    .procedure th:nth-child(6) { width: 12%; }
    .procedure th:nth-child(7) { width: 14%; }
    .small-note {
      font-size: 9.5pt;
      color: #374151;
      margin-top: 8px;
    }
    .print-footer {
      margin-top: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      font-weight: 700;
    }
    .signature-line {
      border-top: 1px solid #111827;
      padding-top: 6px;
      min-height: 28px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>Professional Lesson Plan</h1>
      <p>${escapeHtml(plan.lessonNumber)}: ${escapeHtml(plan.lessonTitle)}</p>
      <p>${escapeHtml(plan.level)} • ${escapeHtml(plan.sublevel)} • ${escapeHtml(plan.unit)}</p>
    </div>

    <div class="section-title">1. Lesson Information</div>
    <table class="two-col">
      <tr>
        <td>Textbook</td><td>${escapeHtml(plan.textbook)}</td>
        <td>Pages</td><td>${escapeHtml(plan.pages)}</td>
      </tr>
      <tr>
        <td>Duration</td><td>${escapeHtml(plan.duration)}</td>
        <td>CEFR Level</td><td>${escapeHtml(plan.cefrLevel)}</td>
      </tr>
      <tr>
        <td>Theme</td><td>${escapeHtml(plan.theme)}</td>
        <td>School Grade</td><td>${escapeHtml(plan.schoolGrade)}</td>
      </tr>
    </table>

    <div class="section-title">2. Objectives and Competencies</div>
    <table class="info">
      <tr><td>Unit Objectives</td><td>${escapeHtml(plan.unitObjectives)}</td></tr>
      <tr><td>Lesson Objectives</td><td>${escapeHtml(plan.lessonObjectives)}</td></tr>
      <tr><td>Communicative Objective</td><td>${escapeHtml(plan.communicativeObjective)}</td></tr>
      <tr><td>Language Objective</td><td>${escapeHtml(plan.languageObjective)}</td></tr>
      <tr><td>Success Criteria</td><td>${escapeHtml(plan.successCriteria)}</td></tr>
      <tr><td>Competencies</td><td>${escapeHtml(plan.competencies)}</td></tr>
      <tr><td>Prerequisites</td><td>${escapeHtml(plan.prerequisites)}</td></tr>
      <tr><td>Outcomes</td><td>${escapeHtml(plan.outcomes)}</td></tr>
    </table>

    <div class="section-title">3. Language Focus</div>
    <table class="two-col">
      <tr><td>Vocabulary</td><td>${escapeHtml(plan.vocabulary)}</td><td>Grammar</td><td>${escapeHtml(plan.grammar)}</td></tr>
      <tr><td>Functions</td><td>${escapeHtml(plan.functions)}</td><td>Pronunciation</td><td>${escapeHtml(plan.pronunciation)}</td></tr>
      <tr><td>Useful Expressions</td><td>${escapeHtml(plan.usefulExpressions)}</td><td>Sentence Patterns</td><td>${escapeHtml(plan.sentencePatterns)}</td></tr>
    </table>

    <div class="section-title">4. Integrated Skills</div>
    <table>
      <thead>
        <tr>
          <th>Skill</th>
          <th>Objective</th>
          <th>Textbook Activities</th>
          <th>Elvy Strategy</th>
        </tr>
      </thead>
      <tbody>${skillRows}</tbody>
    </table>

    <div class="section-title">5. Horizontal Teaching Procedure</div>
    <table class="procedure">
      <thead>
        <tr>
          <th>Stage</th>
          <th>Time</th>
          <th>Teacher Activities</th>
          <th>Student Activities</th>
          <th>Interaction</th>
          <th>Resources</th>
          <th>Assessment</th>
        </tr>
      </thead>
      <tbody>${stageRows}</tbody>
    </table>

    <div class="section-title">6. Assessment Strategy</div>
    <table class="info">
      <tr><td>Diagnostic</td><td>${escapeHtml(plan.diagnosticAssessment)}</td></tr>
      <tr><td>Formative</td><td>${escapeHtml(plan.formativeAssessment)}</td></tr>
      <tr><td>Summative</td><td>${escapeHtml(plan.summativeAssessment)}</td></tr>
      <tr><td>Self Assessment</td><td>${escapeHtml(plan.selfAssessment)}</td></tr>
      <tr><td>Peer Assessment</td><td>${escapeHtml(plan.peerAssessment)}</td></tr>
    </table>

    <div class="section-title">7. Classroom Management</div>
    <table class="info">
      <tr><td>Teacher Tips</td><td>${escapeHtml(plan.teacherTips)}</td></tr>
      <tr><td>Grouping</td><td>${escapeHtml(plan.grouping)}</td></tr>
      <tr><td>Time Management</td><td>${escapeHtml(plan.timeManagement)}</td></tr>
      <tr><td>Transitions</td><td>${escapeHtml(plan.transitions)}</td></tr>
      <tr><td>Common Difficulties</td><td>${escapeHtml(plan.commonDifficulties)}</td></tr>
      <tr><td>Suggested Solutions</td><td>${escapeHtml(plan.suggestedSolutions)}</td></tr>
    </table>

    <div class="section-title">8. Resources, Homework and Teacher Notes</div>
    <table class="info">
      <tr><td>Resources</td><td>${escapeHtml(plan.resources)}</td></tr>
      <tr><td>Homework</td><td>${escapeHtml(plan.homework)}</td></tr>
      <tr><td>Fast Finishers</td><td>${escapeHtml(plan.fastFinishers)}</td></tr>
      <tr><td>Extra Practice</td><td>${escapeHtml(plan.extraPractice)}</td></tr>
      <tr><td>Parent Suggestions</td><td>${escapeHtml(plan.parentSuggestions)}</td></tr>
      <tr><td>Teacher Notes</td><td>${escapeHtml(plan.teacherNotes)}</td></tr>
    </table>


    <p class="small-note">Generated by: ${escapeHtml(plan.generatedBy)} • Generation date: ${escapeHtml(plan.generationDate)} • Source: ${escapeHtml(plan.sourceBook)} • Status: ${escapeHtml(plan.status)}</p>

    <div class="print-footer">
      <div class="signature-line">Teacher Signature:</div>
      <div class="signature-line">Supervisor / Administration:</div>
    </div>
  </div>
</body>
</html>`;
  }

  function downloadWordPlan() {
    const html = renderPrintableLessonPlanHtml();
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }


  function recordBookStageLabel(stageName: string) {
    const normalized = String(stageName || "").toLowerCase();

    if (normalized.includes("warm")) return "Warm-up";
    if (
      normalized.includes("present") ||
      normalized.includes("input") ||
      normalized.includes("model")
    ) {
      return "Presentation";
    }
    if (
      normalized.includes("guided") ||
      normalized.includes("controlled") ||
      normalized.includes("practice")
    ) {
      return "Practice";
    }
    if (
      normalized.includes("production") ||
      normalized.includes("communicative") ||
      normalized.includes("task")
    ) {
      return "Production";
    }
    if (
      normalized.includes("assess") ||
      normalized.includes("reflect") ||
      normalized.includes("homework")
    ) {
      return "Assessment / Follow-up";
    }

    return stageName || "Lesson Stage";
  }

  function recordBookActivitiesText() {
    const preferredOrder = [
      "Warm-up",
      "Presentation",
      "Practice",
      "Production",
      "Assessment / Follow-up",
    ];

    const grouped = new Map<string, string[]>();

    plan.stages.forEach((stage) => {
      const label = recordBookStageLabel(stage.stage);
      const activity = [
        stage.teacherActivities,
        stage.studentActivities,
      ]
        .filter((value) => String(value || "").trim())
        .join(" Learners: ");

      if (!activity) return;

      grouped.set(label, [...(grouped.get(label) || []), activity]);
    });

    const lines = preferredOrder
      .filter((label) => grouped.has(label))
      .map(
        (label) =>
          `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(
            (grouped.get(label) || []).join(" "),
          )}</p>`,
      );

    for (const [label, activities] of grouped.entries()) {
      if (preferredOrder.includes(label)) continue;
      lines.push(
        `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(
          activities.join(" "),
        )}</p>`,
      );
    }

    return lines.join("");
  }

  function nextLessonRecordText() {
    const orderedLessons = curriculumUnits.flatMap((unit) =>
      unit.lessons.map((lesson) => ({
        ...lesson,
        unitTitle: unit.displayTitle,
      })),
    );
    const currentIndex = orderedLessons.findIndex(
      (lesson) => lesson.id === lessonId,
    );
    const nextLesson =
      currentIndex >= 0 ? orderedLessons[currentIndex + 1] : undefined;

    if (nextLesson) {
      return `Continue with ${nextLesson.title} (${nextLesson.unitTitle}).`;
    }

    return plan.homework
      ? `Consolidate the current lesson and check homework: ${plan.homework}`
      : "Consolidate the current lesson and prepare the next learning sequence.";
  }

  function renderRecordBookHtml() {
    const objectivesAndCompetencies = [
      plan.lessonObjectives,
      plan.communicativeObjective
        ? `Communicative objective: ${plan.communicativeObjective}`
        : "",
      plan.languageObjective
        ? `Language objective: ${plan.languageObjective}`
        : "",
      plan.competencies
        ? `Competencies: ${plan.competencies}`
        : "",
      plan.successCriteria
        ? `Success criteria: ${plan.successCriteria}`
        : "",
    ]
      .filter((value) => String(value || "").trim())
      .map((value) => `<p>${escapeHtml(value)}</p>`)
      .join("");

    const activities = recordBookActivitiesText();
    const nextText = nextLessonRecordText();

    const blankDateRows = Array.from({ length: 5 })
      .map(
        () => `
          <tr class="schedule-row">
            <td></td>
            <td class="date-cell">………./………./20……</td>
            <td>
              <div class="writing-line"></div>
              <div class="writing-line"></div>
            </td>
          </tr>
        `,
      )
      .join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(plan.lessonNumber)} - Record Book Entry</title>
  <style>
    @page { size: A4 portrait; margin: 0.8cm; }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: #ffffff;
      color: #111111;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
    }

    .record-page {
      width: 100%;
      min-height: 27.7cm;
      border: 1.5px solid #111111;
      position: relative;
      background: #ffffff;
    }

    .lesson-number {
      position: absolute;
      top: -0.52cm;
      left: 50%;
      transform: translateX(-50%);
      min-width: 5cm;
      border: 1.5px solid #111111;
      border-radius: 8px;
      background: #ffffff;
      padding: 0.18cm 0.35cm;
      text-align: center;
      font-weight: 800;
      font-style: italic;
      letter-spacing: 0.3px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th, td {
      border: 1px solid #111111;
      vertical-align: top;
    }

    .main-table {
      height: 15.8cm;
      margin-top: 0.72cm;
    }

    .main-table thead th {
      height: 0.8cm;
      background: #fff200;
      font-weight: 800;
      font-size: 11pt;
      text-align: center;
      padding: 0.12cm;
    }

    .unit-column { width: 15%; }
    .objectives-column { width: 34%; }
    .activities-column { width: 51%; }

    .unit-cell {
      padding: 0.25cm;
      text-align: center;
      position: relative;
      overflow: hidden;
    }

    .vertical-unit {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-size: 21pt;
      font-style: italic;
      font-weight: 800;
      letter-spacing: 1px;
      margin: auto;
      max-height: 12cm;
    }

    .unit-subtitle {
      margin-top: 0.35cm;
      font-size: 9pt;
      font-weight: 700;
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      max-height: 12cm;
    }

    .content-cell {
      padding: 0.32cm 0.38cm;
      font-size: 9.4pt;
      line-height: 1.3;
      background-image:
        repeating-linear-gradient(
          to bottom,
          transparent 0,
          transparent 0.56cm,
          #9fd8cf 0.57cm,
          transparent 0.59cm
        );
    }

    .content-cell p {
      margin: 0 0 0.18cm;
      background: rgba(255, 255, 255, 0.86);
    }

    .activities-cell p {
      margin-bottom: 0.22cm;
    }

    .schedule-table thead th {
      height: 0.8cm;
      background: #ffffff;
      font-weight: 800;
      font-size: 11pt;
      text-align: center;
      padding: 0.13cm;
    }

    .highlight {
      display: inline-block;
      background: #fff200;
      padding: 0.02cm 0.16cm;
    }

    .class-column { width: 15%; }
    .date-column { width: 34%; }
    .next-column { width: 51%; }

    .schedule-row {
      height: 1.28cm;
    }

    .schedule-row td {
      padding: 0.15cm 0.22cm;
      vertical-align: middle;
    }

    .date-cell {
      text-align: center;
      font-size: 11pt;
      font-weight: 700;
    }

    .writing-line {
      border-bottom: 1px dotted #777777;
      height: 0.4cm;
    }

    .next-prefill {
      font-size: 8.5pt;
      line-height: 1.25;
      font-weight: 700;
      padding: 0.1cm 0.15cm;
    }

    .comments {
      min-height: 2.7cm;
      border-top: 1px solid #111111;
      padding: 0.18cm 0.28cm;
    }

    .comments-heading {
      display: flex;
      justify-content: space-between;
      font-size: 11pt;
      font-weight: 800;
      font-style: italic;
      text-decoration: underline;
    }

    .comment-line {
      border-bottom: 1px dotted #777777;
      height: 0.43cm;
    }

    .inspection {
      min-height: 1.75cm;
      border-top: 1px solid #111111;
      padding: 0.55cm 0.35cm 0.2cm;
      direction: rtl;
      text-align: right;
      font-family: Arial, "Tahoma", sans-serif;
      font-size: 9pt;
    }

    .prefilled-next {
      position: absolute;
      left: 50.3%;
      top: 17.55cm;
      width: 48.5%;
      padding: 0.08cm 0.25cm;
      font-size: 8.5pt;
      line-height: 1.2;
      font-weight: 700;
      background: #ffffff;
    }
  </style>
</head>
<body>
  <div class="record-page">
    <div class="lesson-number">
      LESSON NUMBER: ${escapeHtml(plan.lessonNumber)}
    </div>

    <table class="main-table">
      <colgroup>
        <col class="unit-column" />
        <col class="objectives-column" />
        <col class="activities-column" />
      </colgroup>
      <thead>
        <tr>
          <th>Unit الوحدة</th>
          <th>Objectives &amp; Competencies الكفايات والأهداف</th>
          <th>Activities الأنشطة</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="unit-cell">
            <div class="vertical-unit">${escapeHtml(plan.unit)}</div>
            <div class="unit-subtitle">${escapeHtml(plan.lessonTitle)}</div>
          </td>
          <td class="content-cell">
            ${objectivesAndCompetencies}
          </td>
          <td class="content-cell activities-cell">
            ${activities}
          </td>
        </tr>
      </tbody>
    </table>

    <table class="schedule-table">
      <colgroup>
        <col class="class-column" />
        <col class="date-column" />
        <col class="next-column" />
      </colgroup>
      <thead>
        <tr>
          <th><span class="highlight">Class القسم</span></th>
          <th>
            <span class="highlight">Date</span>
            &nbsp;
            <span class="highlight">تاريخ الإنجاز</span>
          </th>
          <th><span class="highlight">To do next</span></th>
        </tr>
      </thead>
      <tbody>
        ${blankDateRows}
      </tbody>
    </table>

    <div class="prefilled-next">
      Suggested next step: ${escapeHtml(nextText)}
    </div>

    <section class="comments">
      <div class="comments-heading">
        <span>Comments:</span>
        <span>ملاحظات</span>
      </div>
      <div class="comment-line"></div>
      <div class="comment-line"></div>
      <div class="comment-line"></div>
      <div class="comment-line"></div>
    </section>

    <section class="inspection">
      اطلع عليه بتاريخ ........................ / ........................ / ........................
      من طرف ..................................................................................................................
    </section>
  </div>
</body>
</html>`;
  }

  function downloadRecordBook() {
    const html = renderRecordBookHtml();
    const blob = new Blob(
      ["\ufeff", html],
      { type: "application/msword;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      `${plan.lessonNumber} - ${plan.lessonTitle} Record Book Entry`
        .replace(/[\\/:*?"<>|]/g, "") + ".doc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function renderElvyBlueprintHtml() {
    const blueprintRows = plan.elvyBlueprint
      .map((stage) => {
        const scenesHtml = stage.scenes
          .map(
            (scene) => `
              <div class="scene">
                <h4>${escapeHtml(scene.title || scene.sceneId || "Scene")}</h4>
                <p><strong>Scene ID:</strong> ${escapeHtml(scene.sceneId)}</p>
                <p><strong>Purpose:</strong> ${escapeHtml(scene.purpose)}</p>
                <p><strong>Objective IDs:</strong> ${escapeHtml(blueprintText(scene.objectiveIds))}</p>
                <p><strong>Entry condition:</strong> ${escapeHtml(scene.entryCondition)}</p>
                <p><strong>Completion condition:</strong> ${escapeHtml(scene.completionCondition)}</p>
                <p><strong>Next scene:</strong> ${escapeHtml(scene.nextSceneId || "")}</p>
                <p><strong>Recovery scene:</strong> ${escapeHtml(scene.recoverySceneId || "")}</p>
                <p><strong>Whiteboard:</strong></p>
                ${renderJsonBlock(scene.whiteboard)}
                <p><strong>Teacher turns:</strong></p>
                ${renderJsonBlock(scene.teacherTurns)}
                <p><strong>Learner activities:</strong></p>
                ${renderJsonBlock(scene.activities)}
                <p><strong>Asset IDs:</strong> ${escapeHtml(blueprintText(scene.assetIds))}</p>
              </div>
            `,
          )
          .join("");

        return `
          <tr>
            <td>${escapeHtml(stage.stage)}</td>
            <td>${escapeHtml(stage.duration)}</td>
            <td>
              <p><strong>Stage ID:</strong> ${escapeHtml(stage.stageId || "")}</p>
              <p><strong>Objective IDs:</strong> ${escapeHtml(blueprintText(stage.objectiveIds))}</p>
              <p><strong>Teaching objective:</strong> ${escapeHtml(stage.teachingObjective)}</p>
              <p><strong>Whiteboard plan:</strong> ${escapeHtml(blueprintText(stage.whiteboardPlan))}</p>
              <p><strong>Elvy script:</strong> ${escapeHtml(stage.elvyScript || stage.instructions || "")}</p>
              <p><strong>Learner tasks:</strong> ${escapeHtml(blueprintText(stage.learnerTaskSequence))}</p>
              <p><strong>Expected responses:</strong> ${escapeHtml(blueprintText(stage.expectedResponses))}</p>
              <p><strong>Evaluation:</strong> ${escapeHtml(stage.evaluationCriteria)}</p>
              <p><strong>Feedback:</strong> ${escapeHtml(stage.feedbackStrategy)}</p>
              <p><strong>Support ladder:</strong> ${escapeHtml(blueprintText(stage.supportLadder))}</p>
              <p><strong>Success criteria:</strong> ${escapeHtml(blueprintText(stage.successCriteria))}</p>
              <p><strong>Retry limit:</strong> ${escapeHtml(String(stage.retryLimit ?? ""))}</p>
              <p><strong>On success:</strong> ${escapeHtml(stage.successAction)}</p>
              <p><strong>Recovery:</strong> ${escapeHtml(stage.recoveryAction)}</p>
              <p><strong>Transition:</strong> ${escapeHtml(stage.transition)}</p>
              <p><strong>Stage completion rule:</strong></p>
              ${renderJsonBlock(stage.stageCompletionRule)}
              <div class="scene-list">${scenesHtml}</div>
            </td>
          </tr>
        `;
      })
      .join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(plan.lessonNumber)} - Elvy Teaching Blueprint</title>
  <style>
    @page { size: A4 portrait; margin: 1.4cm; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      font-size: 11pt;
      line-height: 1.35;
      margin: 0;
      background: #ffffff;
    }
    .page { width: 100%; margin: 0 auto; }
    .header {
      text-align: center;
      border: 2px solid #6d28d9;
      padding: 12px;
      margin-bottom: 12px;
      background: #f5f3ff;
    }
    .header h1 {
      margin: 0;
      font-size: 17pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #5b21b6;
    }
    .header p { margin: 5px 0 0; font-weight: 700; }
    .notice {
      border: 1px solid #c4b5fd;
      background: #faf5ff;
      padding: 10px;
      margin-bottom: 12px;
      font-weight: 700;
      color: #4c1d95;
    }
    .section-title {
      background: #ede9fe;
      border: 1px solid #6d28d9;
      padding: 6px 8px;
      font-weight: 800;
      text-transform: uppercase;
      margin-top: 10px;
      margin-bottom: 0;
      color: #4c1d95;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 0 0 10px;
    }
    th, td {
      border: 1px solid #6d28d9;
      padding: 7px;
      vertical-align: top;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    th {
      background: #f5f3ff;
      color: #4c1d95;
      font-weight: 800;
      text-align: center;
    }
    th:first-child, td:first-child { width: 16%; font-weight: 800; }
    th:nth-child(2), td:nth-child(2) { width: 12%; font-weight: 800; }
    .metadata td:first-child {
      width: 22%;
      background: #faf5ff;
      font-weight: 800;
    }
    .scene {
      margin-top: 10px;
      border: 1px solid #c4b5fd;
      background: #faf5ff;
      padding: 8px;
      page-break-inside: avoid;
    }
    .scene h4 {
      margin: 0 0 6px;
      color: #5b21b6;
    }
    .json-block {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border: 1px solid #ddd6fe;
      background: #ffffff;
      padding: 7px;
      font-family: Consolas, Monaco, monospace;
      font-size: 8.5pt;
      line-height: 1.25;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>Elvy Teaching Blueprint</h1>
      <p>${escapeHtml(plan.lessonNumber)}: ${escapeHtml(plan.lessonTitle)}</p>
      <p>${escapeHtml(plan.level)} • ${escapeHtml(plan.sublevel)} • ${escapeHtml(plan.unit)}</p>
    </div>

    <div class="notice">
      Internal AI teaching document. This blueprint is for Elvy's lesson delivery and stays separate from the teacher's printable lesson plan.
    </div>

    <div class="section-title">Lesson Metadata</div>
    <table class="metadata">
      <tr><td>Textbook</td><td>${escapeHtml(plan.textbook)}</td></tr>
      <tr><td>Theme</td><td>${escapeHtml(plan.theme)}</td></tr>
      <tr><td>CEFR Level</td><td>${escapeHtml(plan.cefrLevel)}</td></tr>
      <tr><td>Source Book</td><td>${escapeHtml(plan.sourceBook)}</td></tr>
      <tr><td>Ready for Elvy</td><td>${escapeHtml(plan.readyForElvy)}</td></tr>
    </table>

    <div class="section-title">Executable Blueprint Metadata</div>
    <table class="metadata">
      <tr><td>Blueprint ID</td><td>${escapeHtml(plan.elvyBlueprintMetadata.id || "")}</td></tr>
      <tr><td>Lesson ID</td><td>${escapeHtml(plan.elvyBlueprintMetadata.lessonId || "")}</td></tr>
      <tr><td>Objectives</td><td>${renderJsonBlock(plan.elvyBlueprintMetadata.objectives)}</td></tr>
      <tr><td>Native-language Support</td><td>${renderJsonBlock(plan.elvyBlueprintMetadata.nativeLanguageSupport)}</td></tr>
      <tr><td>Adaptation</td><td>${renderJsonBlock(plan.elvyBlueprintMetadata.adaptation)}</td></tr>
      <tr><td>Lesson Completion Rule</td><td>${renderJsonBlock(plan.elvyBlueprintMetadata.lessonCompletionRule)}</td></tr>
      <tr><td>Teaching Rules</td><td>${renderJsonBlock(plan.elvyBlueprintMetadata.teachingRules)}</td></tr>
    </table>

    <div class="section-title">Internal Teaching Instructions</div>
    <table>
      <thead>
        <tr>
          <th>Stage</th>
          <th>Duration</th>
          <th>Complete Elvy Teaching Instructions</th>
        </tr>
      </thead>
      <tbody>${blueprintRows}</tbody>
    </table>
  </div>
</body>
</html>`;
  }

  function downloadElvyBlueprint() {
    const html = renderElvyBlueprintHtml();
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${plan.lessonNumber} - ${plan.lessonTitle} Elvy Blueprint`.replace(/[\\/:*?"<>|]/g, "") + ".doc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function openTeachingAsset(asset: CloudTeachingAsset) {
    const url = teachingAssetUrls[asset.assetId];
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function downloadTeachingAsset(asset: CloudTeachingAsset) {
    const url = teachingAssetUrls[asset.assetId];
    if (!url) return;

    const extension =
      (asset.metadata.file || "").split(".").pop()?.toLowerCase() || "bin";
    const safeTitle = (
      asset.metadata.title ||
      asset.assetId ||
      "teaching-asset"
    ).replace(/[\\/:*?"<>|]/g, "");

    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function assetTypeLabel(value: string) {
    return value
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function isPreviewableImage(asset: CloudTeachingAsset) {
    return (
      asset.metadata.type === "image" ||
      asset.metadata.type === "flashcard" ||
      asset.metadata.type === "grammar-chart" ||
      asset.metadata.type === "speaking-prompt" ||
      asset.blob?.type.startsWith("image/") === true
    );
  }

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
  const compactInputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
  const tableInputClass =
    "min-h-[80px] w-full resize-y rounded-xl border border-transparent bg-white/70 p-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100";
  const labelClass = "mb-2 block text-xs font-black uppercase tracking-wide text-slate-500";

  type SectionCompletionState = "complete" | "in-progress" | "empty";

  function hasContent(value: unknown): boolean {
    if (typeof value === "string") return value.trim().length > 0;
    return value !== undefined && value !== null;
  }

  function completionState(
    completedItems: number,
    totalItems: number,
  ): SectionCompletionState {
    if (completedItems <= 0) return "empty";
    if (completedItems >= totalItems) return "complete";
    return "in-progress";
  }

  const sectionCompletion = useMemo(() => {
    const textFieldsState = (fields: Array<keyof LessonPlan>) => {
      const completed = fields.filter((field) => hasContent(plan[field])).length;
      return {
        completed,
        total: fields.length,
        state: completionState(completed, fields.length),
      };
    };

    const skillFieldCount = plan.integratedSkills.length * 4;
    const completedSkillFields = plan.integratedSkills.reduce(
      (total, skill) =>
        total +
        [skill.skill, skill.objective, skill.textbookActivities, skill.elvyStrategy].filter(
          hasContent,
        ).length,
      0,
    );

    const stageFieldCount = plan.stages.length * 7;
    const completedStageFields = plan.stages.reduce(
      (total, stage) =>
        total +
        [
          stage.stage,
          stage.time,
          stage.teacherActivities,
          stage.studentActivities,
          stage.interaction,
          stage.resources,
          stage.assessment,
        ].filter(hasContent).length,
      0,
    );

    const blueprintCompatibilityFieldCount = plan.elvyBlueprint.length * 15;
    const completedBlueprintCompatibilityFields = plan.elvyBlueprint.reduce(
      (total, stage) =>
        total +
        [
          stage.stage,
          stage.duration,
          stage.teachingObjective,
          stage.whiteboardPlan,
          stage.elvyScript || stage.instructions,
          stage.learnerTaskSequence,
          stage.expectedResponses,
          stage.evaluationCriteria,
          stage.feedbackStrategy,
          stage.supportLadder,
          stage.successCriteria,
          stage.retryLimit,
          stage.successAction,
          stage.recoveryAction,
          stage.transition,
        ].filter((value) =>
          Array.isArray(value) ? value.length > 0 : hasContent(value),
        ).length,
      0,
    );

    const executableBlueprintFieldCount =
      plan.elvyBlueprint.length * 4 + 5;
    const completedExecutableBlueprintFields =
      plan.elvyBlueprint.reduce(
        (total, stage) =>
          total +
          [
            stage.stageId,
            stage.objectiveIds,
            stage.scenes,
            stage.stageCompletionRule,
          ].filter((value) =>
            Array.isArray(value) ? value.length > 0 : hasContent(value),
          ).length,
        0,
      ) +
      [
        plan.elvyBlueprintMetadata.objectives,
        plan.elvyBlueprintMetadata.nativeLanguageSupport,
        plan.elvyBlueprintMetadata.adaptation,
        plan.elvyBlueprintMetadata.lessonCompletionRule,
        plan.elvyBlueprintMetadata.teachingRules,
      ].filter((value) =>
        Array.isArray(value) ? value.length > 0 : hasContent(value),
      ).length;

    const blueprintFieldCount =
      blueprintCompatibilityFieldCount + executableBlueprintFieldCount;
    const completedBlueprintFields =
      completedBlueprintCompatibilityFields +
      completedExecutableBlueprintFields;

    const result = {
      "lesson-information": textFieldsState([
        "level",
        "sublevel",
        "unit",
        "lessonNumber",
        "lessonTitle",
        "textbook",
        "pages",
        "duration",
        "theme",
        "cefrLevel",
        "schoolGrade",
      ]),
      "curriculum-intelligence": textFieldsState([
        "unitObjectives",
        "lessonObjectives",
        "communicativeObjective",
        "languageObjective",
        "successCriteria",
      ]),
      "learning-foundation": textFieldsState([
        "competencies",
        "prerequisites",
        "outcomes",
      ]),
      "language-content": textFieldsState([
        "vocabulary",
        "grammar",
        "functions",
        "pronunciation",
        "usefulExpressions",
        "sentencePatterns",
      ]),
      "integrated-skills": {
        completed: completedSkillFields,
        total: Math.max(skillFieldCount, 1),
        state: completionState(
          completedSkillFields,
          Math.max(skillFieldCount, 1),
        ),
      },
      "pedagogical-framework": textFieldsState([
        "teachingApproach",
        "pedagogicalFramework",
        "udlStrategies",
        "differentiation",
        "assessmentForLearning",
      ]),
      "assessment-strategy": textFieldsState([
        "diagnosticAssessment",
        "formativeAssessment",
        "summativeAssessment",
        "selfAssessment",
        "peerAssessment",
      ]),
      "teaching-procedure": {
        completed: completedStageFields,
        total: Math.max(stageFieldCount, 1),
        state: completionState(
          completedStageFields,
          Math.max(stageFieldCount, 1),
        ),
      },
      "classroom-management": textFieldsState([
        "teacherTips",
        "grouping",
        "timeManagement",
        "transitions",
        "commonDifficulties",
        "suggestedSolutions",
      ]),
      "resources-homework": textFieldsState([
        "resources",
        "homework",
        "fastFinishers",
        "extraPractice",
        "parentSuggestions",
        "teacherNotes",
      ]),
      "elvy-blueprint": {
        completed: completedBlueprintFields,
        total: Math.max(blueprintFieldCount, 1),
        state: completionState(
          completedBlueprintFields,
          Math.max(blueprintFieldCount, 1),
        ),
      },
      "teaching-assets": {
        completed: teachingAssets.length > 0 ? 1 : 0,
        total: 1,
        state: teachingAssets.length > 0 ? "complete" : "empty",
      },
    } as const;

    return result;
  }, [plan, teachingAssets]);

  const statusStyles: Record<LessonStatus, string> = {
    Draft: "bg-slate-100 text-slate-700 ring-slate-200",
    Generated: "bg-blue-100 text-blue-700 ring-blue-200",
    Reviewed: "bg-amber-100 text-amber-700 ring-amber-200",
    Approved: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    "Ready for Elvy": "bg-violet-100 text-violet-700 ring-violet-200",
  };

  const sectionStyles: Record<
    string,
    { icon: string; gradient: string; soft: string; title: string; border: string }
  > = {
    "lesson-information": {
      icon: "📘",
      gradient: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
      soft: "bg-blue-50 text-blue-700",
      title: "text-blue-700",
      border: "border-blue-200",
    },
    "curriculum-intelligence": {
      icon: "🎯",
      gradient: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
      soft: "bg-violet-50 text-violet-700",
      title: "text-violet-700",
      border: "border-violet-200",
    },
    "learning-foundation": {
      icon: "🧠",
      gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
      soft: "bg-emerald-50 text-emerald-700",
      title: "text-emerald-700",
      border: "border-emerald-200",
    },
    "language-content": {
      icon: "💬",
      gradient: "linear-gradient(135deg, #fb923c 0%, #f97316 45%, #ea580c 100%)",
      soft: "bg-orange-50 text-orange-700",
      title: "text-orange-700",
      border: "border-orange-200",
    },
    "integrated-skills": {
      icon: "🎧",
      gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
      soft: "bg-cyan-50 text-cyan-700",
      title: "text-cyan-700",
      border: "border-cyan-200",
    },
    "pedagogical-framework": {
      icon: "👨‍🏫",
      gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      soft: "bg-teal-50 text-teal-700",
      title: "text-teal-700",
      border: "border-teal-200",
    },
    "assessment-strategy": {
      icon: "📝",
      gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      soft: "bg-rose-50 text-rose-700",
      title: "text-rose-700",
      border: "border-rose-200",
    },
    "teaching-procedure": {
      icon: "📋",
      gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      soft: "bg-amber-50 text-amber-700",
      title: "text-amber-700",
      border: "border-amber-200",
    },
    "classroom-management": {
      icon: "👥",
      gradient: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
      soft: "bg-indigo-50 text-indigo-700",
      title: "text-indigo-700",
      border: "border-indigo-200",
    },
    "resources-homework": {
      icon: "📚",
      gradient: "linear-gradient(135deg, #d946ef 0%, #c026d3 100%)",
      soft: "bg-fuchsia-50 text-fuchsia-700",
      title: "text-fuchsia-700",
      border: "border-fuchsia-200",
    },
    "elvy-blueprint": {
      icon: "🤖",
      gradient: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
      soft: "bg-purple-50 text-purple-700",
      title: "text-purple-700",
      border: "border-purple-200",
    },
    "teaching-assets": {
      icon: "🖼️",
      gradient: "linear-gradient(135deg, #ec4899 0%, #c026d3 55%, #7c3aed 100%)",
      soft: "bg-pink-50 text-pink-700",
      title: "text-pink-700",
      border: "border-pink-200",
    },
  };

  function TextAreaField({
    field,
    label,
    rows = 3,
  }: {
    field: keyof LessonPlan;
    label: string;
    rows?: number;
  }) {
    return (
      <label className="block">
        <span className={labelClass}>{label}</span>
        <textarea
          className={inputClass}
          rows={rows}
          value={plan[field] as string}
          onChange={(event) => updateField(field, event.target.value)}
        />
      </label>
    );
  }

  function InputField({ field, label }: { field: keyof LessonPlan; label: string }) {
    return (
      <label>
        <span className={labelClass}>{label}</span>
        <input
          className={inputClass}
          value={plan[field] as string}
          onChange={(event) => updateField(field, event.target.value)}
        />
      </label>
    );
  }

  const sectionCards = [
    { id: "lesson-information", title: "Lesson Information", subtitle: "Level, unit, title, book, duration, theme, and grade", number: "1" },
    { id: "curriculum-intelligence", title: "Curriculum Intelligence", subtitle: "Unit objectives, lesson objectives, success criteria", number: "2" },
    { id: "learning-foundation", title: "Learning Foundation", subtitle: "Competencies, prerequisites, and outcomes", number: "3" },
    { id: "language-content", title: "Language Content", subtitle: "Vocabulary, grammar, functions, expressions", number: "4" },
    { id: "integrated-skills", title: "Integrated Skills", subtitle: "Listening, speaking, reading, writing together", number: "5" },
    { id: "pedagogical-framework", title: "Pedagogical Framework", subtitle: "Approach, UDL, differentiation, assessment", number: "6" },
    { id: "assessment-strategy", title: "Assessment Strategy", subtitle: "Diagnostic, formative, summative, self, peer", number: "7" },
    { id: "teaching-procedure", title: "Horizontal Procedure", subtitle: "Printable teacher lesson plan table", number: "8" },
    { id: "classroom-management", title: "Classroom Management", subtitle: "Tips, grouping, timing, transitions, solutions", number: "9" },
    { id: "resources-homework", title: "Resources & Extension", subtitle: "Teacher resources, homework, notes, extra practice", number: "10" },
    { id: "teaching-assets", title: "Teaching Assets", subtitle: "Images, flashcards, prompts, audio, video, and worksheets", number: "11" },
    { id: "elvy-blueprint", title: "Elvy Teaching Blueprint", subtitle: "Professional internal instructions for Elvy lesson delivery", number: "12" },
  ];

  const completedSectionCount = sectionCards.filter(
    (section) =>
      sectionCompletion[section.id as keyof typeof sectionCompletion]?.state ===
      "complete",
  ).length;
  const inProgressSectionCount = sectionCards.filter(
    (section) =>
      sectionCompletion[section.id as keyof typeof sectionCompletion]?.state ===
      "in-progress",
  ).length;
  const emptySectionCount =
    sectionCards.length - completedSectionCount - inProgressSectionCount;

  const totalCompletionItems = Object.values(sectionCompletion).reduce(
    (total, section) => total + section.total,
    0,
  );
  const completedCompletionItems = Object.values(sectionCompletion).reduce(
    (total, section) => total + section.completed,
    0,
  );
  const completionPercent = totalCompletionItems
    ? Math.round((completedCompletionItems / totalCompletionItems) * 100)
    : 0;

  const activeCard = sectionCards.find((section) => section.id === openSection) || sectionCards[0];
  const activeStyle = sectionStyles[activeCard.id] || sectionStyles["lesson-information"];

  function ContentPanel({ children }: { children: ReactNode }) {
    return (
      <section className={`overflow-hidden rounded-[1.75rem] border bg-white shadow-xl shadow-slate-900/10 ${activeStyle.border}`}>
        <div className="flex items-center justify-between gap-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white shadow-lg"
              style={{ background: activeStyle.gradient }}
            >
              {activeCard.number}
            </span>
            <div className="min-w-0">
              <h2 className="text-2xl font-black text-slate-950">{activeCard.title}</h2>
              <p className="mt-1 text-sm font-bold text-blue-700">{activeCard.subtitle}</p>
            </div>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">
            Active Section
          </span>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </section>
    );
  }

  function ActiveSectionContent() {
    switch (openSection) {
      case "lesson-information":
        return (
          <ContentPanel>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                ["level", "Level"],
                ["sublevel", "Sublevel"],
                ["unit", "Unit"],
                ["lessonNumber", "Lesson Number"],
                ["lessonTitle", "Lesson Title"],
                ["textbook", "Textbook"],
                ["pages", "Pages"],
                ["duration", "Duration"],
                ["cefrLevel", "CEFR Level"],
                ["schoolGrade", "School Grade"],
              ].map(([field, label]) => (
                <InputField key={field} field={field as keyof LessonPlan} label={label} />
              ))}
              <div className="md:col-span-2">
                <InputField field="theme" label="Theme" />
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
              <span className="font-black">Note:</span> This information is extracted from the curriculum and can be edited by the teacher.
            </div>
          </ContentPanel>
        );

      case "curriculum-intelligence":
        return (
          <ContentPanel>
            <div className="grid gap-4 lg:grid-cols-2">
              <TextAreaField field="unitObjectives" label="Unit Objectives" />
              <TextAreaField field="lessonObjectives" label="Lesson Objectives" />
              <TextAreaField field="communicativeObjective" label="Communicative Objective" />
              <TextAreaField field="languageObjective" label="Language Objective" />
              <div className="lg:col-span-2">
                <TextAreaField field="successCriteria" label="Success Criteria" />
              </div>
            </div>
          </ContentPanel>
        );

      case "learning-foundation":
        return (
          <ContentPanel>
            <div className="grid gap-4 lg:grid-cols-3">
              <TextAreaField field="competencies" label="Competencies" rows={4} />
              <TextAreaField field="prerequisites" label="Prerequisites" rows={4} />
              <TextAreaField field="outcomes" label="Expected Learning Outcomes" rows={4} />
            </div>
          </ContentPanel>
        );

      case "language-content":
        return (
          <ContentPanel>
            <div className="grid gap-4 md:grid-cols-2">
              <TextAreaField field="vocabulary" label="Vocabulary" />
              <TextAreaField field="grammar" label="Grammar" />
              <TextAreaField field="functions" label="Language Functions" />
              <TextAreaField field="pronunciation" label="Pronunciation" />
              <TextAreaField field="usefulExpressions" label="Useful Expressions" />
              <TextAreaField field="sentencePatterns" label="Sentence Patterns" />
            </div>
          </ContentPanel>
        );

      case "integrated-skills":
        return (
          <ContentPanel>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[950px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-100 to-blue-50 text-xs uppercase text-slate-600">
                    <th className="border border-slate-200 p-3">Skill</th>
                    <th className="border border-slate-200 p-3">Objective</th>
                    <th className="border border-slate-200 p-3">Textbook Activities</th>
                    <th className="border border-slate-200 p-3">Elvy Strategy</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.integratedSkills.map((skill, index) => (
                    <tr key={skill.skill}>
                      {(Object.keys(skill) as (keyof IntegratedSkillRow)[]).map((field) => (
                        <td key={field} className="border border-slate-200 p-2 align-top">
                          <textarea
                            className={tableInputClass}
                            value={skill[field]}
                            onChange={(event) => updateSkill(index, field, event.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ContentPanel>
        );

      case "pedagogical-framework":
        return (
          <ContentPanel>
            <div className="grid gap-4 lg:grid-cols-2">
              <TextAreaField field="teachingApproach" label="Teaching Approach" />
              <TextAreaField field="pedagogicalFramework" label="Pedagogical Framework" />
              <TextAreaField field="udlStrategies" label="UDL / Inclusion Strategies" />
              <TextAreaField field="differentiation" label="Differentiation" />
              <TextAreaField field="assessmentForLearning" label="Assessment for Learning" />
            </div>
          </ContentPanel>
        );

      case "assessment-strategy":
        return (
          <ContentPanel>
            <div className="grid gap-4 lg:grid-cols-2">
              <TextAreaField field="diagnosticAssessment" label="Diagnostic Assessment" rows={2} />
              <TextAreaField field="formativeAssessment" label="Formative Assessment" rows={2} />
              <TextAreaField field="summativeAssessment" label="Summative Assessment" rows={2} />
              <TextAreaField field="selfAssessment" label="Self Assessment" rows={2} />
              <TextAreaField field="peerAssessment" label="Peer Assessment" rows={2} />
            </div>
          </ContentPanel>
        );

      case "teaching-procedure":
        return (
          <ContentPanel>
            <div className="mb-4 flex items-center justify-end">
              <button
                onClick={addStage}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.98]"
              >
                + Add Stage
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-100 to-blue-50 text-xs uppercase text-slate-600">
                    <th className="border border-slate-200 p-3">Stage</th>
                    <th className="border border-slate-200 p-3">Time</th>
                    <th className="border border-slate-200 p-3">Teacher Activities</th>
                    <th className="border border-slate-200 p-3">Student Activities</th>
                    <th className="border border-slate-200 p-3">Interaction</th>
                    <th className="border border-slate-200 p-3">Resources</th>
                    <th className="border border-slate-200 p-3">Assessment</th>
                    <th className="border border-slate-200 p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.stages.map((stage, index) => (
                    <tr key={`${stage.stage}-${index}`}>
                      {(Object.keys(stage) as (keyof LessonPlanStage)[]).map((field) => (
                        <td key={field} className="border border-slate-200 p-2 align-top">
                          <textarea
                            className={tableInputClass}
                            value={stage[field]}
                            onChange={(event) => updateStage(index, field, event.target.value)}
                          />
                        </td>
                      ))}
                      <td className="border border-slate-200 p-2 align-top">
                        <button
                          onClick={() => removeStage(index)}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ContentPanel>
        );

      case "classroom-management":
        return (
          <ContentPanel>
            <div className="grid gap-4 lg:grid-cols-2">
              <TextAreaField field="teacherTips" label="Teacher Tips" rows={2} />
              <TextAreaField field="grouping" label="Grouping" rows={2} />
              <TextAreaField field="timeManagement" label="Time Management" rows={2} />
              <TextAreaField field="transitions" label="Transitions" rows={2} />
              <TextAreaField field="commonDifficulties" label="Common Difficulties" rows={2} />
              <TextAreaField field="suggestedSolutions" label="Suggested Solutions" rows={2} />
            </div>
          </ContentPanel>
        );

      case "resources-homework":
        return (
          <ContentPanel>
            <div className="grid gap-4 lg:grid-cols-2">
              <TextAreaField field="resources" label="Teacher & Learner Resources" rows={3} />
              <TextAreaField field="homework" label="Homework" rows={3} />
              <TextAreaField field="fastFinishers" label="Fast Finishers" rows={3} />
              <TextAreaField field="extraPractice" label="Extra Practice" rows={3} />
              <TextAreaField field="parentSuggestions" label="Parent Suggestions" rows={3} />
              <TextAreaField field="teacherNotes" label="Teacher Notes" rows={3} />
            </div>

            <div className="mt-6 rounded-2xl border border-fuchsia-100 bg-fuchsia-50/70 p-4 text-sm font-semibold text-fuchsia-900">
              <span className="font-black">Professional separation:</span>{" "}
              downloadable and visual media are managed in Section 11 — Teaching Assets.
            </div>
          </ContentPanel>
        );

      case "teaching-assets":
        return (
          <ContentPanel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-950">
                  Lesson Media Center
                </h3>
                <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                  Professional visual aids and resources imported with this lesson.
                  Elvy can use each asset at its assigned teaching stage.
                </p>
              </div>
              <span className="rounded-full bg-pink-50 px-4 py-2 text-xs font-black text-pink-700 ring-1 ring-pink-100">
                {teachingAssets.length} asset{teachingAssets.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              {teachingAssetsStatus}
            </div>

            {teachingAssets.length ? (
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {teachingAssets.map((asset) => {
                  const previewUrl = teachingAssetUrls[asset.assetId];
                  const metadata = asset.metadata;

                  return (
                    <article
                      key={asset.key}
                      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-xl"
                    >
                      <div className="flex h-56 items-center justify-center bg-gradient-to-br from-slate-100 via-pink-50 to-violet-50 p-4">
                        {previewUrl && isPreviewableImage(asset) ? (
                          <img
                            src={previewUrl}
                            alt={
                              metadata.altText ||
                              metadata.title ||
                              "Teaching asset"
                            }
                            className="h-full w-full rounded-2xl bg-white object-contain shadow-sm"
                          />
                        ) : (
                          <div className="text-center">
                            <div className="text-6xl">
                              {metadata.type === "audio"
                                ? "🎧"
                                : metadata.type === "video"
                                  ? "🎬"
                                  : metadata.type === "worksheet"
                                    ? "📝"
                                    : metadata.type === "grammar-chart"
                                      ? "📊"
                                      : metadata.type === "flashcard"
                                        ? "🃏"
                                        : "📎"}
                            </div>
                            <p className="mt-3 text-sm font-black text-slate-600">
                              {assetTypeLabel(metadata.type)}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4 p-5">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-pink-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-pink-700">
                              {assetTypeLabel(metadata.type)}
                            </span>
                            {metadata.stage ? (
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
                                {metadata.stage}
                              </span>
                            ) : null}
                          </div>
                          <h4 className="mt-3 text-lg font-black text-slate-950">
                            {metadata.title || asset.assetId}
                          </h4>
                          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                            {metadata.purpose || "Lesson teaching resource"}
                          </p>
                        </div>

                        {metadata.altText ? (
                          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
                            {metadata.altText}
                          </p>
                        ) : null}

                        {metadata.keywords?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {metadata.keywords.map((keyword) => (
                              <span
                                key={keyword}
                                className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => openTeachingAsset(asset)}
                            disabled={!previewUrl}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadTeachingAsset(asset)}
                            disabled={!previewUrl}
                            className="rounded-xl bg-gradient-to-r from-pink-600 to-violet-600 px-3 py-2.5 text-xs font-black text-white transition hover:from-pink-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <div className="text-5xl">🖼️</div>
                <h4 className="mt-4 text-lg font-black text-slate-900">
                  No teaching assets in this lesson
                </h4>
                <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
                  Add images, flashcards, grammar charts, speaking prompts, audio,
                  video, or worksheets to the Ready Elvy Package.
                </p>
              </div>
            )}
          </ContentPanel>
        );

      case "elvy-blueprint":
        return (
          <ContentPanel>
            <div className="space-y-5">
              <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-violet-950">
                      Executable Blueprint Metadata
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Runtime-level objectives, adaptation, native-language support,
                      completion logic, and teaching rules loaded from the GSRP.
                    </p>
                  </div>
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">
                    Blueprint v1.4
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-violet-50 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-violet-600">Blueprint ID</p>
                    <p className="mt-1 break-all text-sm font-bold text-slate-800">{plan.elvyBlueprintMetadata.id || "Not provided"}</p>
                  </div>
                  <div className="rounded-xl bg-violet-50 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wide text-violet-600">Lesson ID</p>
                    <p className="mt-1 break-all text-sm font-bold text-slate-800">{plan.elvyBlueprintMetadata.lessonId || lessonId}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <JsonDetailCard title={`Objectives (${plan.elvyBlueprintMetadata.objectives.length})`} value={plan.elvyBlueprintMetadata.objectives} />
                  <JsonDetailCard title="Native-language Support" value={plan.elvyBlueprintMetadata.nativeLanguageSupport} />
                  <JsonDetailCard title="Adaptive Teaching" value={plan.elvyBlueprintMetadata.adaptation} />
                  <JsonDetailCard title="Lesson Completion Rule" value={plan.elvyBlueprintMetadata.lessonCompletionRule} />
                  <div className="xl:col-span-2">
                    <JsonDetailCard title="Teaching Rules" value={plan.elvyBlueprintMetadata.teachingRules} />
                  </div>
                </div>
              </section>

              {plan.elvyBlueprint.map((stage, index) => (
                <div
                  key={`${stage.stage}-${index}`}
                  className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5"
                >
                  <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                    <label>
                      <span className={labelClass}>Stage</span>
                      <input
                        className={inputClass}
                        value={stage.stage || ""}
                        onChange={(event) => updateBlueprint(index, "stage", event.target.value)}
                      />
                    </label>
                    <label>
                      <span className={labelClass}>Duration</span>
                      <input
                        className={inputClass}
                        value={stage.duration || ""}
                        onChange={(event) => updateBlueprint(index, "duration", event.target.value)}
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <label className="block">
                      <span className={labelClass}>Teaching Objective</span>
                      <textarea className={inputClass} rows={3} value={stage.teachingObjective || ""} onChange={(event) => updateBlueprint(index, "teachingObjective", event.target.value)} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Whiteboard Plan</span>
                      <textarea className={inputClass} rows={3} value={blueprintText(stage.whiteboardPlan)} onChange={(event) => updateBlueprint(index, "whiteboardPlan", blueprintLines(event.target.value))} />
                    </label>
                    <label className="block lg:col-span-2">
                      <span className={labelClass}>Elvy Script</span>
                      <textarea className={inputClass} rows={4} value={stage.elvyScript || stage.instructions || ""} onChange={(event) => updateBlueprint(index, "elvyScript", event.target.value)} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Learner Task Sequence — one item per line</span>
                      <textarea className={inputClass} rows={4} value={blueprintText(stage.learnerTaskSequence)} onChange={(event) => updateBlueprint(index, "learnerTaskSequence", blueprintLines(event.target.value))} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Expected Responses — one item per line</span>
                      <textarea className={inputClass} rows={4} value={blueprintText(stage.expectedResponses)} onChange={(event) => updateBlueprint(index, "expectedResponses", blueprintLines(event.target.value))} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Evaluation Criteria</span>
                      <textarea className={inputClass} rows={3} value={stage.evaluationCriteria || ""} onChange={(event) => updateBlueprint(index, "evaluationCriteria", event.target.value)} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Feedback Strategy</span>
                      <textarea className={inputClass} rows={3} value={stage.feedbackStrategy || ""} onChange={(event) => updateBlueprint(index, "feedbackStrategy", event.target.value)} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Support Ladder — one item per line</span>
                      <textarea className={inputClass} rows={4} value={blueprintText(stage.supportLadder)} onChange={(event) => updateBlueprint(index, "supportLadder", blueprintLines(event.target.value))} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Success Criteria — one item per line</span>
                      <textarea className={inputClass} rows={4} value={blueprintText(stage.successCriteria)} onChange={(event) => updateBlueprint(index, "successCriteria", blueprintLines(event.target.value))} />
                    </label>
                    <label>
                      <span className={labelClass}>Retry Limit</span>
                      <input
                        className={inputClass}
                        type="number"
                        min={1}
                        value={stage.retryLimit ?? 1}
                        onChange={(event) => updateBlueprint(index, "retryLimit", Math.max(1, Number(event.target.value) || 1))}
                      />
                    </label>
                    <div />
                    <label className="block">
                      <span className={labelClass}>Success Action</span>
                      <textarea className={inputClass} rows={3} value={stage.successAction || ""} onChange={(event) => updateBlueprint(index, "successAction", event.target.value)} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Recovery Action</span>
                      <textarea className={inputClass} rows={3} value={stage.recoveryAction || ""} onChange={(event) => updateBlueprint(index, "recoveryAction", event.target.value)} />
                    </label>
                    <label className="block lg:col-span-2">
                      <span className={labelClass}>Transition</span>
                      <textarea className={inputClass} rows={2} value={stage.transition || ""} onChange={(event) => updateBlueprint(index, "transition", event.target.value)} />
                    </label>
                  </div>

                  <div className="mt-5 border-t border-violet-200 pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="font-black text-violet-950">Executable Stage Structure</h4>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Stage ID, linked objectives, scenes, whiteboards, teacher turns,
                          learner activities, evaluation rules, and recovery logic.
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-700 shadow-sm">
                        {stage.scenes.length} scene{stage.scenes.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-violet-100 bg-white p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-violet-600">Stage ID</p>
                        <p className="mt-1 break-all text-sm font-bold text-slate-800">{stage.stageId || "Not provided"}</p>
                      </div>
                      <div className="rounded-xl border border-violet-100 bg-white p-3">
                        <p className="text-[11px] font-black uppercase tracking-wide text-violet-600">Objective IDs</p>
                        <p className="mt-1 text-sm font-bold text-slate-800">{stage.objectiveIds.length ? stage.objectiveIds.join(" • ") : "Not provided"}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <JsonDetailCard title="Stage Completion Rule" value={stage.stageCompletionRule} />
                    </div>

                    <div className="mt-4 space-y-4">
                      {stage.scenes.map((scene, sceneIndex) => (
                        <details
                          key={scene.sceneId || `${stage.stage}-${sceneIndex}`}
                          className="overflow-hidden rounded-2xl border border-violet-200 bg-white"
                        >
                          <summary className="cursor-pointer list-none bg-violet-100/70 px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-black text-violet-950">
                                  {scene.title || `Scene ${sceneIndex + 1}`}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  {scene.sceneId || "No scene ID"}
                                </p>
                              </div>
                              <div className="flex gap-2 text-[11px] font-black">
                                <span className="rounded-full bg-white px-2.5 py-1 text-blue-700">
                                  {scene.teacherTurns.length} turns
                                </span>
                                <span className="rounded-full bg-white px-2.5 py-1 text-emerald-700">
                                  {scene.activities.length} activities
                                </span>
                              </div>
                            </div>
                          </summary>

                          <div className="space-y-4 p-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              <JsonTextCard title="Purpose" value={scene.purpose} />
                              <JsonTextCard title="Objective IDs" value={scene.objectiveIds.join(" • ")} />
                              <JsonTextCard title="Entry Condition" value={scene.entryCondition} />
                              <JsonTextCard title="Completion Condition" value={scene.completionCondition} />
                              <JsonTextCard title="Next Scene" value={scene.nextSceneId || ""} />
                              <JsonTextCard title="Recovery Scene" value={scene.recoverySceneId || ""} />
                            </div>
                            <JsonDetailCard title="Learner-facing Whiteboard" value={scene.whiteboard} />
                            <JsonDetailCard title={`Exact Elvy Teacher Turns (${scene.teacherTurns.length})`} value={scene.teacherTurns} />
                            <JsonDetailCard title={`Learner Activities and Evaluation (${scene.activities.length})`} value={scene.activities} />
                            <JsonDetailCard title="Teaching Asset IDs" value={scene.assetIds} />
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ContentPanel>
        );

      default:
        return null;
    }
  }

  const selectedNavigatorUnit =
    curriculumUnits.find((unit) => unit.id === focusedUnitId) ||
    activeCurriculumUnit ||
    curriculumUnits[0] ||
    null;

  const activeSectionIndex = Math.max(
    sectionCards.findIndex((section) => section.id === openSection),
    0,
  );
  const previousSection = sectionCards[activeSectionIndex - 1];
  const nextSection = sectionCards[activeSectionIndex + 1];

  return (
    <main className="min-h-screen bg-[#f7faff] text-slate-900">
      <header
        className="relative overflow-hidden px-4 py-5 text-white sm:px-8 lg:px-10"
        style={{
          background:
            "linear-gradient(120deg, #0284c7 0%, #2563eb 48%, #6d28d9 100%)",
        }}
      >
        <div className="absolute -left-20 top-8 h-48 w-48 rounded-full bg-white/10" />
        <div className="absolute right-16 top-8 h-5 w-5 rounded-full bg-white/20" />

        <div className="relative mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4">
          <button
            type="button"
            onClick={returnToCurriculumReader}
            className="rounded-xl border border-white/35 bg-white/10 px-4 py-2.5 text-sm font-black text-white backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
          >
            ← Back
          </button>

          <div className="min-w-0 text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl">📖</span>
              <h1 className="truncate text-3xl font-black tracking-tight sm:text-4xl">
                Lesson Plan Studio
              </h1>
            </div>
            <p className="mt-2 text-xs font-semibold text-blue-50 sm:text-sm">
              Universal pedagogical framework for teacher planning and Elvy teaching.
            </p>
          </div>

          <button
            type="button"
            onClick={savePlan}
            className="rounded-xl border border-white/35 bg-white/10 px-5 py-2.5 text-sm font-black text-white backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
          >
            💾 Save
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8 lg:px-10">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">
              1. Select Unit
            </h2>
            <div className="text-right">
              {activeSyllabusTitle ? (
                <p className="text-xs font-black text-blue-700">
                  {activeSyllabusTitle}
                </p>
              ) : null}
              <p className="text-xs font-bold text-slate-500">
                {curriculumNavigatorStatus}
              </p>
            </div>
          </div>

          {curriculumUnits.length ? (
            <>
              <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
                {curriculumUnits.map((unit, unitIndex) => {
                  const selected = selectedNavigatorUnit?.id === unit.id;
                  const unitColors = [
                    "text-blue-700 bg-blue-50 border-blue-300",
                    "text-emerald-700 bg-emerald-50 border-emerald-300",
                    "text-orange-700 bg-orange-50 border-orange-300",
                    "text-violet-700 bg-violet-50 border-violet-300",
                    "text-cyan-700 bg-cyan-50 border-cyan-300",
                  ];
                  const tone = unitColors[unitIndex % unitColors.length];

                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => setFocusedUnitId(unit.id)}
                      className={`min-w-[190px] rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${
                        selected
                          ? `${tone} shadow-md ring-2 ring-blue-100`
                          : "border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
                            selected ? "bg-white/80" : "bg-slate-100"
                          }`}
                        >
                          📘
                        </span>
                        <div className="min-w-0">
                          <p className="font-black">
                            Unit {unitIndex + 1}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs font-bold">
                            {unit.displayTitle.replace(/^Unit\s+\d+\s*:\s*/i, "")}
                          </p>
                        </div>
                      </div>
                      <span className="mt-4 inline-flex rounded-full bg-white/80 px-3 py-1 text-[11px] font-black">
                        {unit.lessons.length} Lesson
                        {unit.lessons.length === 1 ? "" : "s"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                    2. Select Lesson
                    {selectedNavigatorUnit
                      ? ` (${selectedNavigatorUnit.displayTitle})`
                      : ""}
                  </h3>
                  <span className="text-xs font-black text-slate-500">
                    {selectedNavigatorUnit?.lessons.length || 0} Lessons
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {(selectedNavigatorUnit?.lessons || []).map(
                    (lesson, lessonIndex) => {
                      const selected = lesson.id === lessonId;
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => openLessonFromNavigator(lesson.id)}
                          className={`min-w-[230px] rounded-xl border-2 px-4 py-3 text-left transition active:scale-[0.98] ${
                            selected
                              ? "border-blue-500 bg-blue-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${
                                selected
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              📄
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-black text-blue-600">
                                Lesson {lessonIndex + 1}
                              </p>
                              <p className="mt-0.5 truncate text-sm font-black text-slate-900">
                                {lesson.title}
                              </p>
                            </div>
                            <span
                              className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                                selected
                                  ? "border-blue-600 bg-blue-600 ring-2 ring-blue-100"
                                  : "border-slate-300 bg-white"
                              }`}
                            />
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-500">
              {curriculumNavigatorStatus}
            </div>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="self-start rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/5 lg:sticky lg:top-5">
            <p className="px-2 text-xs font-black uppercase tracking-[0.1em] text-slate-600">
              Lesson Plan Sections
            </p>

            <nav className="mt-4 space-y-1.5">
              {sectionCards.map((section) => {
                const style =
                  sectionStyles[section.id] || sectionStyles["lesson-information"];
                const active = section.id === openSection;
                const completion =
                  sectionCompletion[
                    section.id as keyof typeof sectionCompletion
                  ];
                const state = completion?.state || "empty";

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setOpenSection(section.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-blue-300 bg-blue-50 text-blue-800 shadow-sm"
                        : "border-slate-100 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/50"
                    }`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                      style={{ background: style.gradient }}
                    >
                      {section.number}
                    </span>
                    <span className="text-base">{style.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-black">
                      {section.title}
                    </span>
                    <span
                      title={
                        state === "complete"
                          ? "Completed"
                          : state === "in-progress"
                            ? "In progress"
                            : "Empty"
                      }
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                        state === "complete"
                          ? "bg-emerald-100 text-emerald-700"
                          : state === "in-progress"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {state === "complete"
                        ? "✓"
                        : state === "in-progress"
                          ? "◐"
                          : "○"}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                Section Completion
              </p>
              <div className="mt-3 grid gap-2 text-[11px] font-bold">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-emerald-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px]">✓</span>
                    Completed
                  </span>
                  <span>{completedSectionCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-amber-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px]">◐</span>
                    In progress
                  </span>
                  <span>{inProgressSectionCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-500">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px]">○</span>
                    Empty
                  </span>
                  <span>{emptySectionCount}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">
                Lesson Status
              </p>
              <div className="mt-3 space-y-2">
                {statusOptions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => updateStatus(status)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-xs font-black ring-1 transition ${
                      plan.status === status
                        ? "bg-slate-950 text-white ring-slate-950"
                        : statusStyles[status]
                    }`}
                  >
                    {status}
                    {plan.status === status ? " ✓" : ""}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5">
            <div className="border-b border-slate-200 pb-5">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-700">
                Current Lesson
              </p>

              <div className="mt-1 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <h2 className="text-3xl font-black text-slate-950">
                    {plan.lessonNumber}: {plan.lessonTitle}
                  </h2>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      ["📘", plan.unit],
                      ["⏱️", plan.duration.replace("minutes", "min")],
                      ["🎯", plan.cefrLevel],
                      ["🎓", plan.schoolGrade],
                    ].map(([icon, value]) => (
                      <span
                        key={`${icon}-${value}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm"
                      >
                        <span>{icon}</span>
                        <span>{value}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <span className="self-start rounded-full bg-violet-100 px-4 py-2 text-xs font-black text-violet-700">
                  {plan.status}
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-violet-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.1em] text-blue-700">
                      Lesson Completion
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-600">
                      {completedSectionCount} completed · {inProgressSectionCount} in progress · {emptySectionCount} empty
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-blue-700">
                      {completionPercent}%
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      {completedSectionCount} / {sectionCards.length} sections completed
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-[width] duration-300"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-lg">📘</span>
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        Teacher Lesson Plan
                      </p>
                      <p className="text-[11px] font-bold text-blue-700">
                        Complete classroom planning document
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("teacher")}
                      className="w-full rounded-xl border border-blue-400 bg-white px-3 py-2.5 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                    >
                      👁 Preview Teacher Plan
                    </button>
                    <button
                      type="button"
                      onClick={downloadWordPlan}
                      className="w-full rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white transition hover:bg-blue-700"
                    >
                      ⬇ Download Teacher Plan
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-lg">📝</span>
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        Record Book Entry
                      </p>
                      <p className="text-[11px] font-bold text-amber-700">
                        Inspector-ready official lesson record
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("record")}
                      className="w-full rounded-xl border border-amber-400 bg-white px-3 py-2.5 text-xs font-black text-amber-700 transition hover:bg-amber-100"
                    >
                      👁 Preview Record Book Entry
                    </button>
                    <button
                      type="button"
                      onClick={downloadRecordBook}
                      className="w-full rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-black text-white transition hover:bg-amber-600"
                    >
                      ⬇ Download Record Book Entry
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        Elvy Teaching Blueprint
                      </p>
                      <p className="text-[11px] font-bold text-violet-700">
                        Internal instructions for Elvy delivery
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("elvy")}
                      className="w-full rounded-xl border border-violet-400 bg-white px-3 py-2.5 text-xs font-black text-violet-700 transition hover:bg-violet-100"
                    >
                      👁 Preview Elvy Blueprint
                    </button>
                    <button
                      type="button"
                      onClick={downloadElvyBlueprint}
                      className="w-full rounded-xl bg-violet-950 px-3 py-2.5 text-xs font-black text-white transition hover:bg-violet-900"
                    >
                      ⬇ Download Elvy Blueprint
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <ActiveSectionContent />
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={!previousSection}
                onClick={() =>
                  previousSection && setOpenSection(previousSection.id)
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous Section
              </button>

              <span className="text-sm font-black text-slate-500">
                Section {activeSectionIndex + 1} of {sectionCards.length}
              </span>

              <button
                type="button"
                disabled={!nextSection}
                onClick={() => nextSection && setOpenSection(nextSection.id)}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next Section →
              </button>
            </div>
          </div>
        </section>
      </div>

      {previewMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-blue-600">
                  {previewMode === "teacher"
                    ? "Teacher lesson plan preview"
                    : previewMode === "record"
                      ? "Record book entry preview"
                      : "Elvy teaching blueprint preview"}
                </p>
                <h2 className="text-xl font-black text-slate-950">
                  {plan.lessonNumber}: {plan.lessonTitle}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={
                    previewMode === "teacher"
                      ? downloadWordPlan
                      : previewMode === "record"
                        ? downloadRecordBook
                        : downloadElvyBlueprint
                  }
                  className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
                >
                  {previewMode === "teacher"
                    ? "⬇ Download Teacher Plan"
                    : previewMode === "record"
                      ? "⬇ Download Record Book"
                      : "⬇ Download Elvy Blueprint"}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("")}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-100 active:scale-[0.98]"
                >
                  Close
                </button>
              </div>
            </div>

            <iframe
              title="Lesson document preview"
              className="h-full w-full bg-white"
              srcDoc={
                previewMode === "teacher"
                  ? renderPrintableLessonPlanHtml()
                  : previewMode === "record"
                    ? renderRecordBookHtml()
                    : renderElvyBlueprintHtml()
              }
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default function LessonPlanPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-100 p-6">
          <div className="mx-auto max-w-4xl rounded-3xl bg-white p-10 text-center shadow-sm">
            <div className="text-4xl">📘</div>
            <p className="mt-4 font-bold text-slate-700">
              Loading Lesson Plan Studio...
            </p>
          </div>
        </main>
      }
    >
      <LessonPlanPageContent />
    </Suspense>
  );
}
