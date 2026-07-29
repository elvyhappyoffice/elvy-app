/**
 * Elvy Teaching Engine
 * Sprint 2 — Scene definition contract
 *
 * A scene definition is a reusable pedagogical blueprint. It describes
 * what a scene is expected to accomplish, which lesson-package content it
 * may use, the ordered teaching steps it contains, and the evidence required
 * before the Lesson Director may move forward.
 *
 * This file does not render the classroom, call an AI model, read a database,
 * or mutate lesson state.
 */

import type {
  ElvyExpression,
  ElvyGesture,
  EvaluationInstruction,
  LessonDirectorActionType,
  LessonStage,
  StudentTaskType,
  WaitingFor,
  WhiteboardMode,
} from "./lesson-director-types";

export type SceneDefinitionId = string;
export type SceneStepId = string;

export type SceneCategory =
  | "opening"
  | "instruction"
  | "input"
  | "guided-learning"
  | "practice"
  | "production"
  | "assessment"
  | "reflection"
  | "closing";

export type SceneRequirement = "required" | "recommended" | "optional";

export type SceneStepKind =
  | "prepare"
  | "display"
  | "explain"
  | "model"
  | "demonstrate"
  | "ask"
  | "listen"
  | "practice"
  | "evaluate"
  | "feedback"
  | "support"
  | "review"
  | "transition";

export type SceneStepStatus =
  | "not-started"
  | "active"
  | "waiting"
  | "completed"
  | "skipped";

export type SceneContentKind =
  | "lesson-title"
  | "lesson-objectives"
  | "instructions"
  | "warm-up-prompt"
  | "image"
  | "vocabulary-set"
  | "grammar-point"
  | "reading-text"
  | "listening-script"
  | "dialogue"
  | "worked-example"
  | "exercise"
  | "question-set"
  | "speaking-prompt"
  | "writing-prompt"
  | "assessment-item"
  | "review-summary"
  | "homework"
  | "custom";

/**
 * A stable reference to content already prepared inside the lesson package.
 * The Scene Engine selects these references; it does not invent replacements.
 */
export interface SceneContentReference {
  id: string;
  kind: SceneContentKind;
  packagePath: string;
  required: boolean;
  fallbackReferenceId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface SceneWhiteboardCue {
  mode: WhiteboardMode;
  contentReferenceId?: string;
  titleReferenceId?: string;
  clearBeforeDisplay: boolean;
  highlightedItemIds?: string[];
  allowScroll?: boolean;
}

export interface SceneElvyCue {
  speechReferenceId?: string;
  speechTemplateKey?: string;
  expression: ElvyExpression;
  gesture: ElvyGesture;
  speakAutomatically: boolean;
}

export interface SceneStudentTask {
  taskId: string;
  type: StudentTaskType;
  instructionReferenceId?: string;
  instructionTemplateKey?: string;
  contentReferenceId?: string;
  waitingFor: WaitingFor;
  required: boolean;
  repeatable: boolean;
  maximumAttempts?: number;
  evaluation?: EvaluationInstruction;
  objectiveIds?: string[];
}

export type SceneCompletionRuleType =
  | "all-required-steps-completed"
  | "all-required-tasks-completed"
  | "minimum-success-score"
  | "required-objective-evidence"
  | "student-confirmation"
  | "manual";

export interface SceneCompletionRule {
  type: SceneCompletionRuleType;
  minimumScore?: number;
  requiredEvidenceCount?: number;
  objectiveIds?: string[];
  taskIds?: string[];
}

export type SceneTransitionTrigger =
  | "scene-started"
  | "step-completed"
  | "student-response-received"
  | "response-correct"
  | "response-partially-correct"
  | "response-incorrect"
  | "attempt-limit-reached"
  | "task-completed"
  | "scene-completed"
  | "manual";

export interface SceneTransitionRule {
  trigger: SceneTransitionTrigger;
  fromStepId?: SceneStepId;
  toStepId?: SceneStepId;
  targetAction: LessonDirectorActionType;
  targetSceneId?: SceneDefinitionId;
  priority: number;
  condition?: {
    minimumScore?: number;
    maximumAttempts?: number;
    requiredTaskIds?: string[];
    requiredObjectiveIds?: string[];
  };
}

export interface SceneSupportRule {
  trigger:
    | "first-error"
    | "repeated-error"
    | "low-confidence"
    | "unclear-response"
    | "no-response"
    | "attempt-limit";
  action:
    | "repeat-instruction"
    | "rephrase"
    | "give-hint"
    | "give-example"
    | "model-answer"
    | "use-l1-support"
    | "reduce-task-difficulty"
    | "return-to-previous-step";
  afterAttempts?: number;
  targetStepId?: SceneStepId;
  priority: number;
}

export interface SceneStepDefinition {
  id: SceneStepId;
  order: number;
  kind: SceneStepKind;
  title?: string;
  description?: string;
  required: boolean;
  estimatedSeconds?: number;
  elvy?: SceneElvyCue;
  whiteboard?: SceneWhiteboardCue;
  studentTask?: SceneStudentTask;
  nextStepId?: SceneStepId;
}

export interface SceneDefinition {
  id: SceneDefinitionId;
  version: string;
  stage: LessonStage;
  category: SceneCategory;
  title: string;
  description: string;
  requirement: SceneRequirement;
  order: number;

  /** Objectives this scene is designed to support or assess. */
  objectiveIds: string[];

  /** Lesson-package content that must be available to execute the scene. */
  contentReferences: SceneContentReference[];

  /** Ordered pedagogical actions performed inside this scene. */
  steps: SceneStepDefinition[];

  completionRules: SceneCompletionRule[];
  transitionRules: SceneTransitionRule[];
  supportRules: SceneSupportRule[];

  estimatedMinutes?: number;
  skippable: boolean;
  repeatable: boolean;
  tags?: string[];
}

export interface SceneDefinitionValidationIssue {
  severity: "error" | "warning";
  code:
    | "missing-id"
    | "missing-title"
    | "missing-steps"
    | "duplicate-step-id"
    | "duplicate-step-order"
    | "invalid-next-step"
    | "invalid-transition-step"
    | "invalid-content-reference"
    | "missing-completion-rule"
    | "required-task-without-wait-state"
    | "invalid-attempt-limit";
  message: string;
  path?: string;
}

export interface SceneDefinitionValidationResult {
  valid: boolean;
  issues: SceneDefinitionValidationIssue[];
}

/**
 * Returns scene steps in deterministic execution order without mutating the
 * supplied definition.
 */
export function getOrderedSceneSteps(
  scene: Readonly<SceneDefinition>,
): SceneStepDefinition[] {
  return [...scene.steps].sort((left, right) => left.order - right.order);
}

export function getSceneStep(
  scene: Readonly<SceneDefinition>,
  stepId: SceneStepId,
): SceneStepDefinition | undefined {
  return scene.steps.find((step) => step.id === stepId);
}

export function getFirstSceneStep(
  scene: Readonly<SceneDefinition>,
): SceneStepDefinition | undefined {
  return getOrderedSceneSteps(scene)[0];
}

export function getNextSceneStep(
  scene: Readonly<SceneDefinition>,
  currentStepId: SceneStepId,
): SceneStepDefinition | undefined {
  const currentStep = getSceneStep(scene, currentStepId);

  if (!currentStep) {
    return undefined;
  }

  if (currentStep.nextStepId) {
    return getSceneStep(scene, currentStep.nextStepId);
  }

  const orderedSteps = getOrderedSceneSteps(scene);
  const currentIndex = orderedSteps.findIndex((step) => step.id === currentStepId);

  return currentIndex >= 0 ? orderedSteps[currentIndex + 1] : undefined;
}

/**
 * Validates structural integrity only. Pedagogical quality is evaluated by
 * higher-level Teaching Strategy and curriculum validation modules.
 */
export function validateSceneDefinition(
  scene: Readonly<SceneDefinition>,
): SceneDefinitionValidationResult {
  const issues: SceneDefinitionValidationIssue[] = [];

  if (!scene.id.trim()) {
    issues.push({
      severity: "error",
      code: "missing-id",
      message: "Scene definition must have a non-empty id.",
      path: "id",
    });
  }

  if (!scene.title.trim()) {
    issues.push({
      severity: "error",
      code: "missing-title",
      message: "Scene definition must have a non-empty title.",
      path: "title",
    });
  }

  if (scene.steps.length === 0) {
    issues.push({
      severity: "error",
      code: "missing-steps",
      message: "Scene definition must contain at least one step.",
      path: "steps",
    });
  }

  if (scene.completionRules.length === 0) {
    issues.push({
      severity: "error",
      code: "missing-completion-rule",
      message: "Scene definition must contain at least one completion rule.",
      path: "completionRules",
    });
  }

  const stepIds = new Set<string>();
  const stepOrders = new Set<number>();
  const contentReferenceIds = new Set(
    scene.contentReferences.map((reference) => reference.id),
  );

  scene.steps.forEach((step, index) => {
    const path = `steps[${index}]`;

    if (stepIds.has(step.id)) {
      issues.push({
        severity: "error",
        code: "duplicate-step-id",
        message: `Duplicate scene step id: ${step.id}.`,
        path: `${path}.id`,
      });
    }
    stepIds.add(step.id);

    if (stepOrders.has(step.order)) {
      issues.push({
        severity: "error",
        code: "duplicate-step-order",
        message: `Duplicate scene step order: ${step.order}.`,
        path: `${path}.order`,
      });
    }
    stepOrders.add(step.order);

    if (
      step.studentTask?.required &&
      step.studentTask.waitingFor === "none"
    ) {
      issues.push({
        severity: "error",
        code: "required-task-without-wait-state",
        message: `Required task ${step.studentTask.taskId} must define a student wait state.`,
        path: `${path}.studentTask.waitingFor`,
      });
    }

    if (
      step.studentTask?.maximumAttempts !== undefined &&
      step.studentTask.maximumAttempts < 1
    ) {
      issues.push({
        severity: "error",
        code: "invalid-attempt-limit",
        message: `Task ${step.studentTask.taskId} must allow at least one attempt.`,
        path: `${path}.studentTask.maximumAttempts`,
      });
    }

    const referencedContentIds = [
      step.elvy?.speechReferenceId,
      step.whiteboard?.contentReferenceId,
      step.whiteboard?.titleReferenceId,
      step.studentTask?.instructionReferenceId,
      step.studentTask?.contentReferenceId,
    ].filter((value): value is string => Boolean(value));

    referencedContentIds.forEach((referenceId) => {
      if (!contentReferenceIds.has(referenceId)) {
        issues.push({
          severity: "error",
          code: "invalid-content-reference",
          message: `Step ${step.id} references unknown content ${referenceId}.`,
          path,
        });
      }
    });
  });

  scene.steps.forEach((step, index) => {
    if (step.nextStepId && !stepIds.has(step.nextStepId)) {
      issues.push({
        severity: "error",
        code: "invalid-next-step",
        message: `Step ${step.id} points to unknown next step ${step.nextStepId}.`,
        path: `steps[${index}].nextStepId`,
      });
    }
  });

  scene.transitionRules.forEach((rule, index) => {
    if (rule.fromStepId && !stepIds.has(rule.fromStepId)) {
      issues.push({
        severity: "error",
        code: "invalid-transition-step",
        message: `Transition references unknown source step ${rule.fromStepId}.`,
        path: `transitionRules[${index}].fromStepId`,
      });
    }

    if (rule.toStepId && !stepIds.has(rule.toStepId)) {
      issues.push({
        severity: "error",
        code: "invalid-transition-step",
        message: `Transition references unknown target step ${rule.toStepId}.`,
        path: `transitionRules[${index}].toStepId`,
      });
    }
  });

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues,
  };
}

/**
 * Creates and validates an immutable scene definition.
 */
export function defineScene(
  definition: SceneDefinition,
): Readonly<SceneDefinition> {
  const validation = validateSceneDefinition(definition);

  if (!validation.valid) {
    const details = validation.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => `${issue.code}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid scene definition: ${details}`);
  }

  return Object.freeze({
    ...definition,
    objectiveIds: Object.freeze([...definition.objectiveIds]),
    contentReferences: Object.freeze(
      definition.contentReferences.map((reference) => Object.freeze({ ...reference })),
    ),
    steps: Object.freeze(
      definition.steps.map((step) => Object.freeze({ ...step })),
    ),
    completionRules: Object.freeze(
      definition.completionRules.map((rule) => Object.freeze({ ...rule })),
    ),
    transitionRules: Object.freeze(
      definition.transitionRules.map((rule) => Object.freeze({ ...rule })),
    ),
    supportRules: Object.freeze(
      definition.supportRules.map((rule) => Object.freeze({ ...rule })),
    ),
  }) as Readonly<SceneDefinition>;
}
