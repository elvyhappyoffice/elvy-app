/**
 * Elvy Teaching Engine
 * Sprint 1 — Lesson Director v1
 *
 * A deterministic, side-effect-free decision engine. It does not render UI,
 * call an AI model, write to a database, or mutate the supplied lesson state.
 */

import type {
  ElvyInstruction,
  EvaluationInstruction,
  LessonDirector,
  LessonDirectorActionType,
  LessonDirectorContext,
  LessonDirectorDecision,
  LessonStage,
  ResponseEvaluationResult,
  SceneProgress,
  StudentTaskInstruction,
  TeachingPolicy,
  TransitionCondition,
  WaitingFor,
  WhiteboardInstruction,
  WhiteboardMode,
} from "./lesson-director-types";

const NOOP_BOARD: WhiteboardInstruction = {
  mode: "custom",
  clearBeforeDisplay: false,
};

const IDLE_ELVY: ElvyInstruction = {
  expression: "neutral",
  gesture: "idle",
  speakAutomatically: false,
};

/**
 * Public Lesson Director entry point.
 */
export const decideLesson: LessonDirector = (
  context: Readonly<LessonDirectorContext>,
): LessonDirectorDecision => {
  const validationWarnings = validateContext(context);
  const { lessonState: state, teachingPolicy: policy } = context;

  if (validationWarnings.length > 0) {
    return safetyFallback(context, validationWarnings);
  }

  if (state.paused) {
    return buildDecision(context, {
      actionType: "pause",
      reasonCode: "manual-control",
      elvy: IDLE_ELVY,
      whiteboard: NOOP_BOARD,
      transition: { type: "manual", targetAction: "resume" },
      statePatch: {
        paused: true,
        currentSceneStatus: "paused",
        waitingFor: "teacher-action",
      },
      notes: ["The session is paused; no pedagogical transition is permitted."],
    });
  }

  if (state.completed || state.currentStage === "complete") {
    return completeLesson(context, "manual-control");
  }

  if (allRequiredObjectivesAchieved(context)) {
    return completeLesson(context, "all-objectives-achieved");
  }

  if (state.currentSceneStatus === "completed") {
    return advanceFromCompletedScene(context);
  }

  if (state.currentSceneStatus === "not-started") {
    return state.currentStage === "welcome"
      ? startLesson(context)
      : startScene(context);
  }

  const evaluation =
    context.externalEvaluation ?? state.lastStudentResponse?.evaluation;

  if (state.waitingFor !== "none") {
    if (!evaluation || evaluation.result === "not-evaluated") {
      return waitForStudent(context);
    }

    return handleEvaluation(context, evaluation.result, policy);
  }

  if (evaluation && evaluation.result !== "not-evaluated") {
    return handleEvaluation(context, evaluation.result, policy);
  }

  return continueScene(context);
};

/** Alias matching the LessonDirector type name. */
export const lessonDirector = decideLesson;
export default decideLesson;

function startLesson(
  context: Readonly<LessonDirectorContext>,
): LessonDirectorDecision {
  const { lessonState: state } = context;
  const learnerName = state.studentState.displayName?.trim();
  const studentState = state.studentState as unknown as Record<string, unknown>;
  const openingLanguage = String(
    studentState.nativeLanguage ||
      studentState.preferredLanguage ||
      studentState.supportLanguage ||
      "English",
  ).trim();

  return buildDecision(context, {
    actionType: "start-lesson",
    reasonCode: "lesson-start",
    elvy: {
      speech: buildNativeLanguageOpening(
        openingLanguage,
        learnerName,
        state.lesson.lessonTitle,
      ),
      speechKey: "lesson.native-language-welcome",
      expression: "smile",
      gesture: "greet",
      speakAutomatically: true,
    },
    whiteboard: {
      mode: "title",
      title: "Welcome to your English class",
      contentReference: `lesson:${state.lesson.lessonId}:welcome`,
      clearBeforeDisplay: true,
      allowScroll: false,
    },
    studentTask: {
      taskId: `${state.currentSceneId}:ready`,
      type: "observe",
      instruction: "Listen to Elvy's introduction and confirm when you are ready.",
      expectedResponse: { type: "confirmation" },
      required: true,
    },
    evaluation: {
      evaluator: "semantic",
      criteriaReference: "lesson-opening:readiness-confirmation",
      successScore: 60,
      partialSuccessScore: 40,
      maxAttempts: 3,
    },
    transition: {
      type: "after-student-response",
      targetAction: "advance",
    },
    statePatch: {
      currentSceneStatus: "waiting-for-student",
      waitingFor: "student-confirmation",
    },
    notes: [
      "The lesson opens in the learner's preferred language.",
      "The whiteboard shows only the welcome title until the learner confirms readiness.",
    ],
  });
}

function buildNativeLanguageOpening(
  language: string,
  learnerName: string | undefined,
  lessonTitle: string,
): string {
  const normalizedLanguage = language.trim().toLowerCase();
  const name = learnerName ? ` ${learnerName}` : "";
  const title = lessonTitle.trim();

  if (
    normalizedLanguage === "ar" ||
    normalizedLanguage.startsWith("ar-") ||
    normalizedLanguage.includes("arab") ||
    normalizedLanguage.includes("العربية")
  ) {
    return `مرحباً${name}. درس اليوم هو: ${title}. سنتعرف أولاً على هدف الدرس، ثم نبدأ خطوة بخطوة. هل أنت مستعد؟`;
  }

  if (
    normalizedLanguage === "fr" ||
    normalizedLanguage.startsWith("fr-") ||
    normalizedLanguage.includes("french") ||
    normalizedLanguage.includes("français") ||
    normalizedLanguage.includes("french")
  ) {
    return `Bonjour${name}. La leçon d'aujourd'hui est : ${title}. Nous allons d'abord découvrir l'objectif, puis avancer étape par étape. Es-tu prêt ?`;
  }

  return `Welcome${name}. Today's lesson is ${title}. First, we will look at the lesson goal, then begin step by step. Are you ready?`;
}

function startScene(
  context: Readonly<LessonDirectorContext>,
): LessonDirectorDecision {
  const { lessonState: state } = context;

  return buildDecision(context, {
    actionType: "start-scene",
    reasonCode: "scene-start",
    elvy: {
      speechKey: `scene.${state.currentStage}.start`,
      expression: "smile",
      gesture: sceneGesture(state.currentStage),
      speakAutomatically: true,
    },
    whiteboard: sceneBoard(state.currentStage, state.currentSceneId, true),
    transition: {
      type: "after-speech",
      targetAction: "continue-scene",
    },
    statePatch: {
      currentSceneStatus: "active",
      waitingFor: "none",
    },
  });
}

function continueScene(
  context: Readonly<LessonDirectorContext>,
): LessonDirectorDecision {
  const { lessonState: state } = context;
  const waitingFor = defaultWaitingFor(state.currentStage);
  const task = defaultStudentTask(state.currentStage, state.currentSceneId);

  return buildDecision(context, {
    actionType: "ask-student",
    reasonCode: "scene-start",
    elvy: {
      speechKey: `scene.${state.currentStage}.task`,
      expression: "encouraging",
      gesture: task.type === "listen" || task.type === "read" ? "point-board" : "listen",
      speakAutomatically: true,
    },
    whiteboard: sceneBoard(state.currentStage, state.currentSceneId, false),
    studentTask: task,
    evaluation: defaultEvaluation(state.currentStage, context.teachingPolicy),
    transition: {
      type: "after-student-response",
      targetAction: "advance",
    },
    statePatch: {
      currentSceneStatus: "waiting-for-student",
      waitingFor,
    },
  });
}

function waitForStudent(
  context: Readonly<LessonDirectorContext>,
): LessonDirectorDecision {
  const { lessonState: state } = context;

  return buildDecision(context, {
    actionType: "wait",
    reasonCode: "no-response",
    elvy: {
      expression: "listening",
      gesture: "wait",
      speakAutomatically: false,
    },
    whiteboard: NOOP_BOARD,
    transition: {
      type: "after-student-response",
      targetAction: "advance",
    },
    statePatch: {
      currentSceneStatus: "waiting-for-student",
      waitingFor: state.waitingFor,
    },
  });
}

function handleEvaluation(
  context: Readonly<LessonDirectorContext>,
  result: ResponseEvaluationResult,
  policy: TeachingPolicy,
): LessonDirectorDecision {
  switch (result) {
    case "correct":
      return handleCorrectResponse(context);
    case "partially-correct":
      return handlePartialResponse(context, policy);
    case "incorrect":
    case "off-topic":
      return handleIncorrectResponse(context, policy);
    case "unclear":
      return requestRephrase(context);
    case "no-response":
      return waitForStudent(context);
    case "not-evaluated":
    default:
      return waitForStudent(context);
  }
}

function handleCorrectResponse(
  context: Readonly<LessonDirectorContext>,
): LessonDirectorDecision {
  const { lessonState: state } = context;
  const nextScene = findNextScene(state.sceneHistory, state.currentSceneId);

  if (!nextScene) {
    return buildDecision(context, {
      actionType: "complete-scene",
      reasonCode: "response-correct",
      elvy: {
        speech: "Excellent. You completed this part.",
        speechKey: "feedback.correct.scene-complete",
        expression: "celebrating",
        gesture: "celebrate",
        speakAutomatically: true,
      },
      whiteboard: feedbackBoard("correct"),
      transition: {
        type: "after-objective-achieved",
        targetAction: "complete-lesson",
      },
      statePatch: {
        currentSceneStatus: "completed",
        waitingFor: "none",
      },
    });
  }

  return buildDecision(context, {
    actionType: "advance",
    reasonCode: "response-correct",
    nextSceneId: nextScene.sceneId,
    elvy: {
      speech: "Excellent. Let us continue.",
      speechKey: "feedback.correct.advance",
      expression: "smile",
      gesture: "encourage",
      speakAutomatically: true,
    },
    whiteboard: feedbackBoard("correct"),
    transition: {
      type: "after-speech",
      targetSceneId: nextScene.sceneId,
      targetAction: "start-scene",
    },
    statePatch: {
      currentStage: nextScene.sceneType,
      currentSceneId: nextScene.sceneId,
      currentSceneStatus: "not-started",
      waitingFor: "none",
    },
  });
}

function handlePartialResponse(
  context: Readonly<LessonDirectorContext>,
  policy: TeachingPolicy,
): LessonDirectorDecision {
  const attempts = context.lessonState.studentState.attemptsInCurrentTask;
  const shouldModel = attempts >= policy.maxAttemptsBeforeModel;

  return buildDecision(context, {
    actionType: shouldModel ? "model-answer" : "give-hint",
    reasonCode: shouldModel ? "attempt-limit" : "response-partial",
    elvy: {
      speech: shouldModel
        ? "You are close. Let me model the answer, then you can try again."
        : "Good start. Here is a small hint. Try once more.",
      speechKey: shouldModel
        ? "support.model-after-partial"
        : "support.hint-after-partial",
      expression: "encouraging",
      gesture: shouldModel ? "repeat" : "encourage",
      speakAutomatically: true,
    },
    whiteboard: {
      mode: "feedback",
      contentReference: shouldModel
        ? `scene:${context.lessonState.currentSceneId}:model`
        : `scene:${context.lessonState.currentSceneId}:hint`,
      clearBeforeDisplay: false,
    },
    studentTask: retryTask(context, shouldModel),
    evaluation: defaultEvaluation(
      context.lessonState.currentStage,
      context.teachingPolicy,
    ),
    transition: {
      type: "after-student-response",
      targetAction: "advance",
    },
    statePatch: {
      currentSceneStatus: "waiting-for-student",
      waitingFor: context.lessonState.waitingFor,
    },
  });
}

function handleIncorrectResponse(
  context: Readonly<LessonDirectorContext>,
  policy: TeachingPolicy,
): LessonDirectorDecision {
  const attempts = context.lessonState.studentState.attemptsInCurrentTask;

  if (attempts >= policy.maxAttemptsBeforeReview) {
    return buildDecision(context, {
      actionType: "review",
      reasonCode: "attempt-limit",
      elvy: {
        speech: "Let us review this part together before we try again.",
        speechKey: "support.review",
        expression: "encouraging",
        gesture: "point-board",
        speakAutomatically: true,
      },
      whiteboard: {
        mode: "summary",
        contentReference: `scene:${context.lessonState.currentSceneId}:review`,
        clearBeforeDisplay: true,
        allowScroll: true,
      },
      studentTask: retryTask(context, true),
      evaluation: defaultEvaluation(
        context.lessonState.currentStage,
        context.teachingPolicy,
      ),
      transition: {
        type: "after-student-response",
        targetAction: "advance",
      },
      statePatch: {
        currentSceneStatus: "waiting-for-student",
        waitingFor: context.lessonState.waitingFor,
      },
    });
  }

  if (attempts >= policy.maxAttemptsBeforeModel) {
    return buildDecision(context, {
      actionType: "model-answer",
      reasonCode: "attempt-limit",
      elvy: {
        speech: "Listen to the model, then try it yourself.",
        speechKey: "support.model-answer",
        expression: "encouraging",
        gesture: "repeat",
        speakAutomatically: true,
      },
      whiteboard: {
        mode: "feedback",
        contentReference: `scene:${context.lessonState.currentSceneId}:model`,
        clearBeforeDisplay: false,
      },
      studentTask: retryTask(context, true),
      evaluation: defaultEvaluation(
        context.lessonState.currentStage,
        context.teachingPolicy,
      ),
      transition: {
        type: "after-student-response",
        targetAction: "advance",
      },
      statePatch: {
        currentSceneStatus: "waiting-for-student",
        waitingFor: context.lessonState.waitingFor,
      },
    });
  }

  const shouldHint = attempts >= policy.maxAttemptsBeforeHint;

  return buildDecision(context, {
    actionType: shouldHint ? "give-hint" : "correct",
    reasonCode: shouldHint ? "attempt-limit" : "response-incorrect",
    elvy: {
      speech: shouldHint
        ? "Not yet. Look at the hint and try again."
        : "Almost. Let us correct that together, then you can try again.",
      speechKey: shouldHint
        ? "support.hint-after-error"
        : "feedback.corrective",
      expression: "correcting",
      gesture: shouldHint ? "point-board" : "correct",
      speakAutomatically: true,
    },
    whiteboard: {
      mode: "feedback",
      contentReference: shouldHint
        ? `scene:${context.lessonState.currentSceneId}:hint`
        : `scene:${context.lessonState.currentSceneId}:correction`,
      clearBeforeDisplay: false,
    },
    studentTask: retryTask(context, false),
    evaluation: defaultEvaluation(
      context.lessonState.currentStage,
      context.teachingPolicy,
    ),
    transition: {
      type: "after-student-response",
      targetAction: "advance",
    },
    statePatch: {
      currentSceneStatus: "waiting-for-student",
      waitingFor: context.lessonState.waitingFor,
    },
  });
}

function requestRephrase(
  context: Readonly<LessonDirectorContext>,
): LessonDirectorDecision {
  return buildDecision(context, {
    actionType: "rephrase",
    reasonCode: "response-unclear",
    elvy: {
      speech: "I did not understand clearly. Please try once more.",
      speechKey: "feedback.unclear",
      expression: "listening",
      gesture: "listen",
      speakAutomatically: true,
    },
    whiteboard: NOOP_BOARD,
    studentTask: retryTask(context, false),
    evaluation: defaultEvaluation(
      context.lessonState.currentStage,
      context.teachingPolicy,
    ),
    transition: {
      type: "after-student-response",
      targetAction: "advance",
    },
    statePatch: {
      currentSceneStatus: "waiting-for-student",
      waitingFor: context.lessonState.waitingFor,
    },
  });
}

function advanceFromCompletedScene(
  context: Readonly<LessonDirectorContext>,
): LessonDirectorDecision {
  const { lessonState: state } = context;
  const nextScene = findNextScene(state.sceneHistory, state.currentSceneId);

  if (!nextScene) {
    return allRequiredObjectivesAchieved(context)
      ? completeLesson(context, "all-objectives-achieved")
      : buildDecision(context, {
          actionType: "review",
          reasonCode: "objective-needs-review",
          elvy: {
            speech: "Before we finish, let us review the objectives that still need practice.",
            speechKey: "lesson.review-required",
            expression: "encouraging",
            gesture: "point-board",
            speakAutomatically: true,
          },
          whiteboard: {
            mode: "summary",
            contentReference: `lesson:${state.lesson.lessonId}:objective-review`,
            clearBeforeDisplay: true,
            allowScroll: true,
          },
          transition: {
            type: "after-speech",
            targetAction: "continue-scene",
          },
          statePatch: {
            currentStage: "review",
            currentSceneStatus: "active",
            waitingFor: "none",
          },
        });
  }

  return buildDecision(context, {
    actionType: "advance",
    reasonCode: "scene-complete",
    nextSceneId: nextScene.sceneId,
    elvy: {
      speech: "Good work. Let us move to the next part.",
      speechKey: "scene.advance",
      expression: "smile",
      gesture: "encourage",
      speakAutomatically: true,
    },
    whiteboard: NOOP_BOARD,
    transition: {
      type: "after-speech",
      targetSceneId: nextScene.sceneId,
      targetAction: "start-scene",
    },
    statePatch: {
      currentStage: nextScene.sceneType,
      currentSceneId: nextScene.sceneId,
      currentSceneStatus: "not-started",
      waitingFor: "none",
    },
  });
}

function completeLesson(
  context: Readonly<LessonDirectorContext>,
  reasonCode: "all-objectives-achieved" | "manual-control",
): LessonDirectorDecision {
  const { lessonState: state } = context;

  return buildDecision(context, {
    actionType: "complete-lesson",
    reasonCode,
    elvy: {
      speech: "Excellent work. You have completed the lesson.",
      speechKey: "lesson.complete",
      expression: "celebrating",
      gesture: "celebrate",
      speakAutomatically: true,
    },
    whiteboard: {
      mode: "summary",
      title: "Lesson complete",
      contentReference: `lesson:${state.lesson.lessonId}:completion-summary`,
      clearBeforeDisplay: true,
      allowScroll: true,
    },
    transition: {
      type: "manual",
    },
    statePatch: {
      currentStage: "complete",
      currentSceneStatus: "completed",
      waitingFor: "none",
      completed: true,
      completedAt: state.completedAt ?? context.now,
    },
  });
}

function safetyFallback(
  context: Readonly<LessonDirectorContext>,
  warnings: string[],
): LessonDirectorDecision {
  return buildDecision(context, {
    actionType: "wait",
    reasonCode: "safety-fallback",
    elvy: {
      speech: "The lesson needs a moment before it can continue.",
      speechKey: "system.safe-pause",
      expression: "concerned",
      gesture: "wait",
      speakAutomatically: false,
    },
    whiteboard: NOOP_BOARD,
    transition: { type: "manual" },
    statePatch: {
      currentSceneStatus: "paused",
      waitingFor: "teacher-action",
      paused: true,
    },
    warnings,
    notes: ["The Director entered a safe paused state instead of guessing."],
  });
}

interface DecisionParts {
  actionType: LessonDirectorActionType;
  reasonCode: LessonDirectorDecision["reasonCode"];
  nextSceneId?: string;
  elvy: ElvyInstruction;
  whiteboard: WhiteboardInstruction;
  studentTask?: StudentTaskInstruction;
  evaluation?: EvaluationInstruction;
  transition: TransitionCondition;
  statePatch: LessonDirectorDecision["statePatch"];
  warnings?: string[];
  notes?: string[];
}

function buildDecision(
  context: Readonly<LessonDirectorContext>,
  parts: DecisionParts,
): LessonDirectorDecision {
  const decisionId = createDecisionId(context, parts.actionType);

  return {
    decisionId,
    createdAt: context.now,
    actionType: parts.actionType,
    reasonCode: parts.reasonCode,
    currentSceneId: context.lessonState.currentSceneId,
    nextSceneId: parts.nextSceneId,
    elvy: parts.elvy,
    whiteboard: parts.whiteboard,
    studentTask: parts.studentTask,
    evaluation: parts.evaluation,
    transition: parts.transition,
    statePatch: {
      ...parts.statePatch,
      lastDirectorActionId: decisionId,
      updatedAt: context.now,
    },
    diagnostics:
      parts.warnings?.length || parts.notes?.length
        ? {
            warnings: parts.warnings ?? [],
            notes: parts.notes ?? [],
          }
        : undefined,
  };
}

function createDecisionId(
  context: Readonly<LessonDirectorContext>,
  action: LessonDirectorActionType,
): string {
  const seed = [
    context.lessonState.sessionId,
    context.lessonState.currentSceneId,
    action,
    context.now,
  ].join("|");

  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `ld-${(hash >>> 0).toString(36)}`;
}

function validateContext(
  context: Readonly<LessonDirectorContext>,
): string[] {
  const warnings: string[] = [];
  const { lessonState: state, teachingPolicy: policy } = context;

  if (!context.now || Number.isNaN(Date.parse(context.now))) {
    warnings.push("LessonDirectorContext.now must be a valid ISO timestamp.");
  }
  if (!state.sessionId) warnings.push("A sessionId is required.");
  if (!state.lesson.lessonId) warnings.push("A lessonId is required.");
  if (!state.currentSceneId) warnings.push("A currentSceneId is required.");
  if (policy.maxAttemptsBeforeHint < 0) {
    warnings.push("maxAttemptsBeforeHint cannot be negative.");
  }
  if (policy.maxAttemptsBeforeModel < policy.maxAttemptsBeforeHint) {
    warnings.push("maxAttemptsBeforeModel must be at least maxAttemptsBeforeHint.");
  }
  if (policy.maxAttemptsBeforeReview < policy.maxAttemptsBeforeModel) {
    warnings.push("maxAttemptsBeforeReview must be at least maxAttemptsBeforeModel.");
  }
  if (policy.minimumObjectiveScore < 0 || policy.minimumObjectiveScore > 100) {
    warnings.push("minimumObjectiveScore must be between 0 and 100.");
  }

  return warnings;
}

function allRequiredObjectivesAchieved(
  context: Readonly<LessonDirectorContext>,
): boolean {
  const { objectiveProgress } = context.lessonState;
  const { teachingPolicy: policy } = context;

  if (objectiveProgress.length === 0) return false;

  return objectiveProgress.every((objective) => {
    const enoughEvidence =
      objective.evidenceCount >=
      Math.max(
        objective.requiredEvidenceCount,
        policy.requiredEvidencePerObjective,
      );

    return (
      objective.status === "achieved" &&
      objective.score >= policy.minimumObjectiveScore &&
      enoughEvidence
    );
  });
}

function findNextScene(
  scenes: readonly SceneProgress[],
  currentSceneId: string,
): SceneProgress | undefined {
  const ordered = [...scenes].sort((a, b) => a.order - b.order);
  const currentIndex = ordered.findIndex(
    (scene) => scene.sceneId === currentSceneId,
  );

  if (currentIndex < 0) return undefined;

  return ordered
    .slice(currentIndex + 1)
    .find((scene) => scene.status !== "skipped");
}

function sceneBoard(
  stage: LessonStage,
  sceneId: string,
  clearBeforeDisplay: boolean,
): WhiteboardInstruction {
  return {
    mode: boardModeForStage(stage),
    contentReference: `scene:${sceneId}:primary`,
    clearBeforeDisplay,
    allowScroll: stage === "reading" || stage === "dialogue" || stage === "grammar",
  };
}

function boardModeForStage(stage: LessonStage): WhiteboardMode {
  const map: Record<LessonStage, WhiteboardMode> = {
    welcome: "title",
    "warm-up": "question",
    objective: "objective",
    presentation: "instructions",
    vocabulary: "vocabulary",
    grammar: "grammar",
    reading: "reading",
    listening: "listening",
    dialogue: "dialogue",
    "guided-practice": "exercise",
    "independent-practice": "exercise",
    production: "instructions",
    review: "summary",
    assessment: "exercise",
    complete: "summary",
  };

  return map[stage];
}

function sceneGesture(stage: LessonStage): ElvyInstruction["gesture"] {
  if (stage === "listening" || stage === "dialogue") return "listen";
  if (stage === "review" || stage === "assessment") return "think";
  if (stage === "complete") return "celebrate";
  return "point-board";
}

function defaultWaitingFor(stage: LessonStage): WaitingFor {
  switch (stage) {
    case "listening":
    case "vocabulary":
    case "dialogue":
      return "student-repeat";
    case "production":
      return "student-speaking";
    case "reading":
    case "grammar":
    case "guided-practice":
    case "independent-practice":
    case "assessment":
    case "warm-up":
      return "student-answer";
    case "objective":
      return "student-confirmation";
    default:
      return "student-answer";
  }
}

function defaultStudentTask(
  stage: LessonStage,
  sceneId: string,
): StudentTaskInstruction {
  switch (stage) {
    case "vocabulary":
    case "listening":
    case "dialogue":
      return {
        taskId: `${sceneId}:repeat`,
        type: "repeat",
        instruction: "Listen, then repeat.",
        contentReference: `scene:${sceneId}:task`,
        expectedResponse: { type: "speech" },
        required: true,
      };
    case "reading":
      return {
        taskId: `${sceneId}:read-answer`,
        type: "answer",
        instruction: "Read the board, then answer the question.",
        contentReference: `scene:${sceneId}:task`,
        expectedResponse: { type: "text", minLength: 1 },
        required: true,
      };
    case "production":
      return {
        taskId: `${sceneId}:speak`,
        type: "speak",
        instruction: "Use what you learned to speak in your own words.",
        contentReference: `scene:${sceneId}:task`,
        expectedResponse: { type: "speech" },
        required: true,
      };
    case "objective":
      return {
        taskId: `${sceneId}:confirm`,
        type: "observe",
        instruction: "Look at today's objectives and confirm when you are ready.",
        contentReference: `scene:${sceneId}:task`,
        expectedResponse: { type: "confirmation" },
        required: true,
      };
    default:
      return {
        taskId: `${sceneId}:answer`,
        type: "answer",
        instruction: "Complete the task shown on the board.",
        contentReference: `scene:${sceneId}:task`,
        expectedResponse: { type: "text", minLength: 1 },
        required: true,
      };
  }
}

function defaultEvaluation(
  stage: LessonStage,
  policy: TeachingPolicy,
): EvaluationInstruction {
  const evaluator: EvaluationInstruction["evaluator"] =
    stage === "vocabulary" || stage === "listening" || stage === "dialogue"
      ? "pronunciation"
      : stage === "grammar"
        ? "grammar"
        : stage === "production" || stage === "assessment"
          ? "rubric"
          : "objective-evidence";

  return {
    evaluator,
    criteriaReference: `stage:${stage}:evaluation`,
    successScore: policy.minimumObjectiveScore,
    partialSuccessScore: Math.max(1, policy.minimumObjectiveScore - 20),
    maxAttempts: policy.maxAttemptsBeforeReview,
  };
}

function retryTask(
  context: Readonly<LessonDirectorContext>,
  afterModel: boolean,
): StudentTaskInstruction {
  const base = defaultStudentTask(
    context.lessonState.currentStage,
    context.lessonState.currentSceneId,
  );

  return {
    ...base,
    taskId: `${base.taskId}:retry:${context.lessonState.studentState.attemptsInCurrentTask + 1}`,
    instruction: afterModel
      ? "Now try the task again using the model as support."
      : "Try the task again.",
  };
}

function feedbackBoard(
  result: "correct" | "partial" | "incorrect",
): WhiteboardInstruction {
  return {
    mode: "feedback",
    contentReference: `feedback:${result}`,
    clearBeforeDisplay: false,
  };
}
