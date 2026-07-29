/**
 * Elvy Teaching Engine
 * Sprint 2 — Scene Engine
 *
 * The Scene Engine executes one validated SceneDefinition at a time. It keeps
 * deterministic runtime progress, selects the active step, waits for learner
 * input when required, evaluates completion rules, applies support rules, and
 * returns structured cues for the Lesson Director and later classroom engines.
 *
 * It does not render React, call an AI model, read or write a database, mutate
 * lesson-package content, or choose the next lesson scene.
 */

import type {
  EvaluationInstruction,
  LessonDirectorActionType,
  ResponseEvaluationResult,
  WaitingFor,
} from "./lesson-director-types";
import {
  getFirstSceneStep,
  getNextSceneStep,
  getOrderedSceneSteps,
  getSceneStep,
  validateSceneDefinition,
  type SceneDefinition,
  type SceneStepDefinition,
  type SceneStepId,
  type SceneStepStatus,
  type SceneSupportRule,
  type SceneTransitionRule,
} from "./scene-definition";

export type SceneEngineStatus =
  | "not-started"
  | "active"
  | "waiting"
  | "evaluating"
  | "completed"
  | "paused"
  | "failed";

export type SceneEngineEventType =
  | "start"
  | "step-completed"
  | "student-response"
  | "evaluation-received"
  | "continue"
  | "pause"
  | "resume"
  | "manual-complete"
  | "manual-skip";

export interface SceneStepRuntime {
  stepId: SceneStepId;
  status: SceneStepStatus;
  attempts: number;
  startedAt?: string;
  completedAt?: string;
  lastEvaluation?: SceneEvaluation;
}

export interface SceneEvaluation {
  result: ResponseEvaluationResult;
  score: number;
  feedback?: string;
  matchedCriteria?: string[];
  missedCriteria?: string[];
}

export interface SceneStudentResponse {
  responseId: string;
  text?: string;
  selectedOptionIds?: string[];
  audioReference?: string;
  submittedAt: string;
}

export interface SceneObjectiveEvidence {
  objectiveId: string;
  count: number;
  bestScore: number;
}

export interface SceneEngineState {
  sceneId: string;
  sceneVersion: string;
  status: SceneEngineStatus;
  activeStepId?: SceneStepId;
  waitingFor: WaitingFor;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
  stepRuntime: SceneStepRuntime[];
  completedTaskIds: string[];
  objectiveEvidence: SceneObjectiveEvidence[];
  lastStudentResponse?: SceneStudentResponse;
  lastEvaluation?: SceneEvaluation;
  lastAction?: LessonDirectorActionType;
  supportActionCount: number;
  warnings: string[];
}

export interface SceneEngineEvent {
  type: SceneEngineEventType;
  now: string;
  studentResponse?: SceneStudentResponse;
  evaluation?: SceneEvaluation;
  stepId?: SceneStepId;
}

export interface SceneEngineContext {
  definition: Readonly<SceneDefinition>;
  state: Readonly<SceneEngineState>;
  event: Readonly<SceneEngineEvent>;
}

export interface SceneEngineOutput {
  state: SceneEngineState;
  action: LessonDirectorActionType;
  reason:
    | "scene-started"
    | "step-started"
    | "waiting-for-student"
    | "response-received"
    | "response-correct"
    | "response-partially-correct"
    | "response-incorrect"
    | "response-unclear"
    | "no-response"
    | "support-applied"
    | "step-completed"
    | "scene-completed"
    | "scene-paused"
    | "scene-resumed"
    | "manual-control"
    | "invalid-state"
    | "no-transition";
  activeStep?: SceneStepDefinition;
  previousStepId?: SceneStepId;
  nextStepId?: SceneStepId;
  waitingFor: WaitingFor;
  evaluationInstruction?: EvaluationInstruction;
  appliedTransition?: SceneTransitionRule;
  appliedSupport?: SceneSupportRule;
  sceneCompleted: boolean;
  diagnostics: {
    warnings: string[];
    notes: string[];
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function cloneState(state: Readonly<SceneEngineState>): SceneEngineState {
  return {
    ...state,
    stepRuntime: state.stepRuntime.map((item) => ({
      ...item,
      lastEvaluation: item.lastEvaluation
        ? { ...item.lastEvaluation }
        : undefined,
    })),
    completedTaskIds: [...state.completedTaskIds],
    objectiveEvidence: state.objectiveEvidence.map((item) => ({ ...item })),
    lastStudentResponse: state.lastStudentResponse
      ? { ...state.lastStudentResponse }
      : undefined,
    lastEvaluation: state.lastEvaluation
      ? { ...state.lastEvaluation }
      : undefined,
    warnings: [...state.warnings],
  };
}

function getRuntime(
  state: SceneEngineState,
  stepId: SceneStepId,
): SceneStepRuntime | undefined {
  return state.stepRuntime.find((item) => item.stepId === stepId);
}

function requireRuntime(
  state: SceneEngineState,
  stepId: SceneStepId,
): SceneStepRuntime {
  const runtime = getRuntime(state, stepId);

  if (!runtime) {
    throw new Error(`Scene runtime is missing step ${stepId}.`);
  }

  return runtime;
}

function buildOutput(
  state: SceneEngineState,
  action: LessonDirectorActionType,
  reason: SceneEngineOutput["reason"],
  definition: Readonly<SceneDefinition>,
  options: Partial<
    Pick<
      SceneEngineOutput,
      | "previousStepId"
      | "nextStepId"
      | "evaluationInstruction"
      | "appliedTransition"
      | "appliedSupport"
    >
  > & { notes?: string[]; warnings?: string[] } = {},
): SceneEngineOutput {
  const activeStep = state.activeStepId
    ? getSceneStep(definition, state.activeStepId)
    : undefined;

  return {
    state,
    action,
    reason,
    activeStep,
    previousStepId: options.previousStepId,
    nextStepId: options.nextStepId,
    waitingFor: state.waitingFor,
    evaluationInstruction: options.evaluationInstruction,
    appliedTransition: options.appliedTransition,
    appliedSupport: options.appliedSupport,
    sceneCompleted: state.status === "completed",
    diagnostics: {
      warnings: unique([...(options.warnings ?? []), ...state.warnings]),
      notes: options.notes ?? [],
    },
  };
}

/** Creates deterministic runtime state for a validated scene definition. */
export function createSceneEngineState(
  definition: Readonly<SceneDefinition>,
  now: string,
): SceneEngineState {
  const validation = validateSceneDefinition(definition);

  if (!validation.valid) {
    const message = validation.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => `${issue.code}: ${issue.message}`)
      .join("; ");

    throw new Error(`Cannot create Scene Engine state: ${message}`);
  }

  return {
    sceneId: definition.id,
    sceneVersion: definition.version,
    status: "not-started",
    activeStepId: undefined,
    waitingFor: "none",
    updatedAt: now,
    stepRuntime: getOrderedSceneSteps(definition).map((step) => ({
      stepId: step.id,
      status: "not-started",
      attempts: 0,
    })),
    completedTaskIds: [],
    objectiveEvidence: definition.objectiveIds.map((objectiveId) => ({
      objectiveId,
      count: 0,
      bestScore: 0,
    })),
    supportActionCount: 0,
    warnings: [],
  };
}

export function getActiveSceneStep(
  definition: Readonly<SceneDefinition>,
  state: Readonly<SceneEngineState>,
): SceneStepDefinition | undefined {
  return state.activeStepId
    ? getSceneStep(definition, state.activeStepId)
    : undefined;
}

export function isSceneComplete(
  definition: Readonly<SceneDefinition>,
  state: Readonly<SceneEngineState>,
): boolean {
  if (state.status === "completed") {
    return true;
  }

  const requiredStepsComplete = definition.steps
    .filter((step) => step.required)
    .every(
      (step) =>
        state.stepRuntime.find((item) => item.stepId === step.id)?.status ===
        "completed",
    );

  const requiredTasks = definition.steps
    .map((step) => step.studentTask)
    .filter(
      (task): task is NonNullable<SceneStepDefinition["studentTask"]> =>
        Boolean(task?.required),
    );

  const requiredTasksComplete = requiredTasks.every((task) =>
    state.completedTaskIds.includes(task.taskId),
  );

  return definition.completionRules.every((rule) => {
    switch (rule.type) {
      case "all-required-steps-completed":
        return requiredStepsComplete;

      case "all-required-tasks-completed":
        return (rule.taskIds ?? requiredTasks.map((task) => task.taskId)).every(
          (taskId) => state.completedTaskIds.includes(taskId),
        );

      case "minimum-success-score":
        return (
          state.lastEvaluation !== undefined &&
          state.lastEvaluation.score >= (rule.minimumScore ?? 0)
        );

      case "required-objective-evidence":
        return (rule.objectiveIds ?? definition.objectiveIds).every(
          (objectiveId) =>
            (state.objectiveEvidence.find(
              (item) => item.objectiveId === objectiveId,
            )?.count ?? 0) >= (rule.requiredEvidenceCount ?? 1),
        );

      case "student-confirmation":
        return state.lastStudentResponse !== undefined;

      case "manual":
        return false;

      default: {
        const exhaustiveCheck: never = rule.type;
        return exhaustiveCheck;
      }
    }
  });
}

function activateStep(
  definition: Readonly<SceneDefinition>,
  state: SceneEngineState,
  step: SceneStepDefinition,
  now: string,
): SceneEngineOutput {
  const runtime = requireRuntime(state, step.id);
  runtime.status = step.studentTask ? "waiting" : "active";
  runtime.startedAt ??= now;

  state.activeStepId = step.id;
  state.status = step.studentTask ? "waiting" : "active";
  state.waitingFor = step.studentTask?.waitingFor ?? "none";
  state.updatedAt = now;
  state.lastAction = step.studentTask ? "ask-student" : "continue-scene";

  return buildOutput(
    state,
    state.lastAction,
    step.studentTask ? "waiting-for-student" : "step-started",
    definition,
    {
      nextStepId: step.id,
      evaluationInstruction: step.studentTask?.evaluation,
    },
  );
}

function completeScene(
  definition: Readonly<SceneDefinition>,
  state: SceneEngineState,
  now: string,
): SceneEngineOutput {
  state.status = "completed";
  state.waitingFor = "none";
  state.completedAt = now;
  state.updatedAt = now;
  state.lastAction = "complete-scene";

  return buildOutput(
    state,
    "complete-scene",
    "scene-completed",
    definition,
  );
}

function completeCurrentStepAndAdvance(
  definition: Readonly<SceneDefinition>,
  state: SceneEngineState,
  now: string,
): SceneEngineOutput {
  const currentStepId = state.activeStepId;

  if (!currentStepId) {
    state.status = "failed";
    state.warnings.push("Cannot complete a scene step because no step is active.");
    state.lastAction = "pause";
    state.updatedAt = now;
    return buildOutput(state, "pause", "invalid-state", definition);
  }

  const currentStep = getSceneStep(definition, currentStepId);

  if (!currentStep) {
    state.status = "failed";
    state.warnings.push(`Active step ${currentStepId} is not in the definition.`);
    state.lastAction = "pause";
    state.updatedAt = now;
    return buildOutput(state, "pause", "invalid-state", definition);
  }

  const runtime = requireRuntime(state, currentStepId);
  runtime.status = "completed";
  runtime.completedAt = now;

  if (currentStep.studentTask?.required) {
    state.completedTaskIds = unique([
      ...state.completedTaskIds,
      currentStep.studentTask.taskId,
    ]);
  }

  state.waitingFor = "none";
  state.updatedAt = now;

  if (isSceneComplete(definition, state)) {
    return completeScene(definition, state, now);
  }

  const nextStep = getNextSceneStep(definition, currentStepId);

  if (!nextStep) {
    const requiredIncomplete = definition.steps.filter(
      (step) =>
        step.required &&
        state.stepRuntime.find((item) => item.stepId === step.id)?.status !==
          "completed",
    );

    if (requiredIncomplete.length === 0) {
      return completeScene(definition, state, now);
    }

    state.status = "failed";
    state.warnings.push(
      `Scene reached its final step but required steps remain incomplete: ${requiredIncomplete
        .map((step) => step.id)
        .join(", ")}.`,
    );
    state.lastAction = "pause";
    return buildOutput(state, "pause", "invalid-state", definition, {
      previousStepId: currentStepId,
    });
  }

  const output = activateStep(definition, state, nextStep, now);
  output.previousStepId = currentStepId;
  output.nextStepId = nextStep.id;
  output.reason = "step-completed";
  return output;
}

function recordEvidence(
  state: SceneEngineState,
  evaluation: SceneEvaluation,
  evaluationInstruction?: EvaluationInstruction,
): void {
  if (
    evaluation.result !== "correct" &&
    evaluation.result !== "partially-correct"
  ) {
    return;
  }

  for (const objectiveId of
    evaluationInstruction?.recordEvidenceForObjectiveIds ?? []) {
    const evidence = state.objectiveEvidence.find(
      (item) => item.objectiveId === objectiveId,
    );

    if (evidence) {
      evidence.count += 1;
      evidence.bestScore = Math.max(evidence.bestScore, evaluation.score);
    } else {
      state.objectiveEvidence.push({
        objectiveId,
        count: 1,
        bestScore: evaluation.score,
      });
    }
  }
}

function chooseSupportRule(
  definition: Readonly<SceneDefinition>,
  evaluation: SceneEvaluation,
  attempts: number,
): SceneSupportRule | undefined {
  const trigger: SceneSupportRule["trigger"] =
    evaluation.result === "no-response"
      ? "no-response"
      : evaluation.result === "unclear"
        ? "unclear-response"
        : attempts <= 1
          ? "first-error"
          : "repeated-error";

  return [...definition.supportRules]
    .filter(
      (rule) =>
        (rule.trigger === trigger ||
          (rule.trigger === "attempt-limit" &&
            rule.afterAttempts !== undefined &&
            attempts >= rule.afterAttempts)) &&
        (rule.afterAttempts === undefined || attempts >= rule.afterAttempts),
    )
    .sort((left, right) => right.priority - left.priority)[0];
}

function supportActionToDirectorAction(
  action: SceneSupportRule["action"],
): LessonDirectorActionType {
  switch (action) {
    case "repeat-instruction":
      return "repeat";
    case "rephrase":
      return "rephrase";
    case "give-hint":
      return "give-hint";
    case "give-example":
      return "give-example";
    case "model-answer":
      return "model-answer";
    case "use-l1-support":
    case "reduce-task-difficulty":
      return "increase-support";
    case "return-to-previous-step":
      return "review";
    default: {
      const exhaustiveCheck: never = action;
      return exhaustiveCheck;
    }
  }
}

function applySupportRule(
  definition: Readonly<SceneDefinition>,
  state: SceneEngineState,
  rule: SceneSupportRule,
  now: string,
): SceneEngineOutput {
  const currentStepId = state.activeStepId;
  const targetStep = rule.targetStepId
    ? getSceneStep(definition, rule.targetStepId)
    : undefined;

  if (rule.targetStepId && !targetStep) {
    state.warnings.push(
      `Support rule points to missing step ${rule.targetStepId}.`,
    );
  }

  if (targetStep) {
    state.activeStepId = targetStep.id;
    const targetRuntime = requireRuntime(state, targetStep.id);
    targetRuntime.status = targetStep.studentTask ? "waiting" : "active";
    targetRuntime.startedAt ??= now;
    state.waitingFor = targetStep.studentTask?.waitingFor ?? "none";
    state.status = targetStep.studentTask ? "waiting" : "active";
  } else {
    const activeStep = currentStepId
      ? getSceneStep(definition, currentStepId)
      : undefined;
    state.waitingFor = activeStep?.studentTask?.waitingFor ?? "none";
    state.status = activeStep?.studentTask ? "waiting" : "active";
  }

  const action = supportActionToDirectorAction(rule.action);
  state.supportActionCount += 1;
  state.lastAction = action;
  state.updatedAt = now;

  return buildOutput(state, action, "support-applied", definition, {
    appliedSupport: rule,
    previousStepId: currentStepId,
    nextStepId: state.activeStepId,
  });
}

function findTransition(
  definition: Readonly<SceneDefinition>,
  trigger: SceneTransitionRule["trigger"],
  currentStepId: SceneStepId | undefined,
  evaluation: SceneEvaluation | undefined,
  attempts: number,
  completedTaskIds: readonly string[],
): SceneTransitionRule | undefined {
  return [...definition.transitionRules]
    .filter((rule) => {
      if (rule.trigger !== trigger) return false;
      if (rule.fromStepId && rule.fromStepId !== currentStepId) return false;
      if (
        rule.condition?.minimumScore !== undefined &&
        (evaluation?.score ?? 0) < rule.condition.minimumScore
      ) {
        return false;
      }
      if (
        rule.condition?.maximumAttempts !== undefined &&
        attempts > rule.condition.maximumAttempts
      ) {
        return false;
      }
      if (
        rule.condition?.requiredTaskIds &&
        !rule.condition.requiredTaskIds.every((taskId) =>
          completedTaskIds.includes(taskId),
        )
      ) {
        return false;
      }
      return true;
    })
    .sort((left, right) => right.priority - left.priority)[0];
}

function applyTransition(
  definition: Readonly<SceneDefinition>,
  state: SceneEngineState,
  transition: SceneTransitionRule,
  now: string,
): SceneEngineOutput {
  const previousStepId = state.activeStepId;

  if (transition.targetAction === "complete-scene") {
    const output = completeScene(definition, state, now);
    output.appliedTransition = transition;
    output.previousStepId = previousStepId;
    return output;
  }

  if (transition.toStepId) {
    const targetStep = getSceneStep(definition, transition.toStepId);

    if (!targetStep) {
      state.status = "failed";
      state.warnings.push(
        `Transition points to missing step ${transition.toStepId}.`,
      );
      state.lastAction = "pause";
      state.updatedAt = now;
      return buildOutput(state, "pause", "invalid-state", definition, {
        appliedTransition: transition,
      });
    }

    const output = activateStep(definition, state, targetStep, now);
    output.action = transition.targetAction;
    output.state.lastAction = transition.targetAction;
    output.appliedTransition = transition;
    output.previousStepId = previousStepId;
    output.nextStepId = targetStep.id;
    return output;
  }

  state.lastAction = transition.targetAction;
  state.updatedAt = now;
  return buildOutput(
    state,
    transition.targetAction,
    "no-transition",
    definition,
    { appliedTransition: transition },
  );
}

function handleEvaluation(
  definition: Readonly<SceneDefinition>,
  state: SceneEngineState,
  evaluation: SceneEvaluation,
  now: string,
): SceneEngineOutput {
  const activeStepId = state.activeStepId;
  const activeStep = activeStepId
    ? getSceneStep(definition, activeStepId)
    : undefined;

  if (!activeStepId || !activeStep) {
    state.status = "failed";
    state.warnings.push("Evaluation received without an active scene step.");
    state.lastAction = "pause";
    state.updatedAt = now;
    return buildOutput(state, "pause", "invalid-state", definition);
  }

  const runtime = requireRuntime(state, activeStepId);
  runtime.lastEvaluation = evaluation;
  state.lastEvaluation = evaluation;
  state.status = "evaluating";
  state.updatedAt = now;

  recordEvidence(state, evaluation, activeStep.studentTask?.evaluation);

  const trigger: SceneTransitionRule["trigger"] =
    evaluation.result === "correct"
      ? "response-correct"
      : evaluation.result === "partially-correct"
        ? "response-partially-correct"
        : "response-incorrect";

  const transition = findTransition(
    definition,
    trigger,
    activeStepId,
    evaluation,
    runtime.attempts,
    state.completedTaskIds,
  );

  if (transition) {
    return applyTransition(definition, state, transition, now);
  }

  if (evaluation.result === "correct") {
    const output = completeCurrentStepAndAdvance(definition, state, now);
    output.reason = "response-correct";
    return output;
  }

  if (evaluation.result === "partially-correct") {
    const supportRule = chooseSupportRule(
      definition,
      evaluation,
      runtime.attempts,
    );

    if (supportRule) {
      return applySupportRule(definition, state, supportRule, now);
    }

    state.status = "waiting";
    state.waitingFor = activeStep.studentTask?.waitingFor ?? "none";
    state.lastAction = "encourage";
    return buildOutput(
      state,
      "encourage",
      "response-partially-correct",
      definition,
      { evaluationInstruction: activeStep.studentTask?.evaluation },
    );
  }

  const supportRule = chooseSupportRule(
    definition,
    evaluation,
    runtime.attempts,
  );

  if (supportRule) {
    return applySupportRule(definition, state, supportRule, now);
  }

  state.status = "waiting";
  state.waitingFor = activeStep.studentTask?.waitingFor ?? "none";
  state.lastAction = evaluation.result === "unclear" ? "rephrase" : "correct";

  return buildOutput(
    state,
    state.lastAction,
    evaluation.result === "unclear"
      ? "response-unclear"
      : evaluation.result === "no-response"
        ? "no-response"
        : "response-incorrect",
    definition,
    { evaluationInstruction: activeStep.studentTask?.evaluation },
  );
}

/**
 * Advances the scene by exactly one deterministic event.
 * The supplied state is never mutated.
 */
export function runSceneEngine(
  context: Readonly<SceneEngineContext>,
): SceneEngineOutput {
  const { definition, event } = context;
  const state = cloneState(context.state);

  if (
    state.sceneId !== definition.id ||
    state.sceneVersion !== definition.version
  ) {
    state.status = "failed";
    state.updatedAt = event.now;
    state.lastAction = "pause";
    state.warnings.push(
      "Scene runtime does not match the supplied scene definition.",
    );
    return buildOutput(state, "pause", "invalid-state", definition);
  }

  if (state.status === "completed" && event.type !== "manual-skip") {
    return buildOutput(
      state,
      "complete-scene",
      "scene-completed",
      definition,
      { notes: ["The scene was already completed."] },
    );
  }

  switch (event.type) {
    case "start": {
      if (state.status !== "not-started") {
        return buildOutput(state, "continue-scene", "no-transition", definition, {
          notes: ["Start was ignored because the scene has already started."],
        });
      }

      const firstStep = getFirstSceneStep(definition);

      if (!firstStep) {
        state.status = "failed";
        state.updatedAt = event.now;
        state.lastAction = "pause";
        state.warnings.push("Scene definition contains no executable step.");
        return buildOutput(state, "pause", "invalid-state", definition);
      }

      state.startedAt = event.now;
      const output = activateStep(definition, state, firstStep, event.now);
      output.action = "start-scene";
      output.state.lastAction = "start-scene";
      output.reason = "scene-started";
      return output;
    }

    case "student-response": {
      const activeStep = getActiveSceneStep(definition, state);

      if (!activeStep?.studentTask) {
        state.status = "failed";
        state.updatedAt = event.now;
        state.lastAction = "pause";
        state.warnings.push(
          "Student response received while the active step has no student task.",
        );
        return buildOutput(state, "pause", "invalid-state", definition);
      }

      if (!event.studentResponse) {
        state.warnings.push("Student-response event did not contain a response.");
        state.updatedAt = event.now;
        return buildOutput(state, "wait", "invalid-state", definition);
      }

      const runtime = requireRuntime(state, activeStep.id);
      runtime.attempts += 1;
      runtime.status = "active";
      state.lastStudentResponse = { ...event.studentResponse };
      state.waitingFor = "none";
      state.updatedAt = event.now;

      if (activeStep.studentTask.evaluation?.evaluator === "none") {
        return completeCurrentStepAndAdvance(definition, state, event.now);
      }

      state.status = "evaluating";
      state.lastAction = "wait";
      return buildOutput(
        state,
        "wait",
        "response-received",
        definition,
        { evaluationInstruction: activeStep.studentTask.evaluation },
      );
    }

    case "evaluation-received": {
      if (!event.evaluation) {
        state.warnings.push("Evaluation event did not contain an evaluation.");
        state.updatedAt = event.now;
        return buildOutput(state, "wait", "invalid-state", definition);
      }

      return handleEvaluation(definition, state, event.evaluation, event.now);
    }

    case "step-completed":
    case "continue": {
      if (event.stepId && event.stepId !== state.activeStepId) {
        state.warnings.push(
          `Event step ${event.stepId} does not match active step ${state.activeStepId ?? "none"}.`,
        );
        state.updatedAt = event.now;
        return buildOutput(state, "pause", "invalid-state", definition);
      }

      return completeCurrentStepAndAdvance(definition, state, event.now);
    }

    case "pause":
      state.status = "paused";
      state.waitingFor = "none";
      state.updatedAt = event.now;
      state.lastAction = "pause";
      return buildOutput(state, "pause", "scene-paused", definition);

    case "resume": {
      if (state.status !== "paused") {
        return buildOutput(state, "continue-scene", "no-transition", definition, {
          notes: ["Resume was ignored because the scene was not paused."],
        });
      }

      const activeStep = getActiveSceneStep(definition, state);
      state.status = activeStep?.studentTask ? "waiting" : "active";
      state.waitingFor = activeStep?.studentTask?.waitingFor ?? "none";
      state.updatedAt = event.now;
      state.lastAction = "resume";
      return buildOutput(state, "resume", "scene-resumed", definition);
    }

    case "manual-complete":
      return completeScene(definition, state, event.now);

    case "manual-skip":
      state.stepRuntime = state.stepRuntime.map((runtime) =>
        runtime.status === "completed"
          ? runtime
          : { ...runtime, status: "skipped", completedAt: event.now },
      );
      state.status = "completed";
      state.waitingFor = "none";
      state.completedAt = event.now;
      state.updatedAt = event.now;
      state.lastAction = "complete-scene";
      return buildOutput(
        state,
        "complete-scene",
        "manual-control",
        definition,
      );

    default: {
      const exhaustiveCheck: never = event.type;
      return exhaustiveCheck;
    }
  }
}

/** Convenience wrapper for starting a newly created scene runtime. */
export function startScene(
  definition: Readonly<SceneDefinition>,
  now: string,
): SceneEngineOutput {
  return runSceneEngine({
    definition,
    state: createSceneEngineState(definition, now),
    event: { type: "start", now },
  });
}
