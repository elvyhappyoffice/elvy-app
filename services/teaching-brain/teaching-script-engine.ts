/**
 * Elvy Teaching Engine
 * Sprint 4 — Teaching Script Engine
 *
 * Converts a scene step and lesson-package references into a deterministic
 * teaching performance plan. The engine does not call an AI model, mutate
 * lesson state, play audio, render the whiteboard, or animate Elvy.
 */

import type {
  ElvyExpression,
  ElvyGesture,
  LessonDirectorActionType,
  SupportLevel,
  WaitingFor,
} from "./lesson-director-types";
import type {
  SceneContentReference,
  SceneDefinition,
  SceneElvyCue,
  SceneStepDefinition,
} from "./scene-definition";

export type TeachingScriptSegmentKind =
  | "speech"
  | "pause"
  | "board-focus"
  | "gesture"
  | "student-prompt"
  | "wait"
  | "transition";

export type TeachingSpeechPurpose =
  | "greeting"
  | "instruction"
  | "explanation"
  | "model"
  | "question"
  | "feedback"
  | "hint"
  | "correction"
  | "encouragement"
  | "review"
  | "transition";

export type TeachingScriptSource =
  | "lesson-package"
  | "template"
  | "director"
  | "fallback";

export interface TeachingScriptTemplateVariables {
  studentName?: string;
  lessonTitle?: string;
  sceneTitle?: string;
  stepTitle?: string;
  supportLanguage?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface TeachingScriptTiming {
  pauseBeforeMs: number;
  pauseAfterMs: number;
  estimatedSpeechMs?: number;
  maximumWaitMs?: number;
}

export interface TeachingSpeechSegment {
  id: string;
  kind: "speech";
  order: number;
  purpose: TeachingSpeechPurpose;
  text: string;
  source: TeachingScriptSource;
  sourceReferenceId?: string;
  language?: string;
  speakAutomatically: boolean;
  interruptible: boolean;
  expression: ElvyExpression;
  gesture: ElvyGesture;
  timing: TeachingScriptTiming;
  boardSync?: {
    highlightTargetIds?: string[];
    highlightText?: string[];
    clearHighlightAfterSpeech: boolean;
  };
}

export interface TeachingPauseSegment {
  id: string;
  kind: "pause";
  order: number;
  durationMs: number;
  reason:
    | "natural-speech"
    | "allow-reading"
    | "allow-thinking"
    | "before-question"
    | "after-model"
    | "transition";
}

export interface TeachingBoardFocusSegment {
  id: string;
  kind: "board-focus";
  order: number;
  contentReferenceId?: string;
  targetIds?: string[];
  targetText?: string[];
  action: "show" | "highlight" | "clear-highlight" | "keep-visible";
}

export interface TeachingGestureSegment {
  id: string;
  kind: "gesture";
  order: number;
  expression: ElvyExpression;
  gesture: ElvyGesture;
  durationMs?: number;
}

export interface TeachingStudentPromptSegment {
  id: string;
  kind: "student-prompt";
  order: number;
  taskId: string;
  instruction: string;
  instructionSource: TeachingScriptSource;
  waitingFor: WaitingFor;
  repeatable: boolean;
  maximumAttempts?: number;
}

export interface TeachingWaitSegment {
  id: string;
  kind: "wait";
  order: number;
  waitingFor: WaitingFor;
  maximumWaitMs?: number;
  allowInterruption: boolean;
}

export interface TeachingTransitionSegment {
  id: string;
  kind: "transition";
  order: number;
  action: LessonDirectorActionType;
  targetStepId?: string;
  targetSceneId?: string;
}

export type TeachingScriptSegment =
  | TeachingSpeechSegment
  | TeachingPauseSegment
  | TeachingBoardFocusSegment
  | TeachingGestureSegment
  | TeachingStudentPromptSegment
  | TeachingWaitSegment
  | TeachingTransitionSegment;

export interface TeachingScriptPlan {
  id: string;
  sceneId: string;
  stepId: string;
  createdAt: string;
  language?: string;
  supportLevel: SupportLevel;
  segments: TeachingScriptSegment[];
  speechText: string;
  requiresStudentResponse: boolean;
  waitingFor: WaitingFor;
  diagnostics: {
    warnings: string[];
    notes: string[];
  };
}

export interface TeachingScriptEngineContext {
  scene: Readonly<SceneDefinition>;
  step: Readonly<SceneStepDefinition>;
  lessonPackage: unknown;
  now: string;
  supportLevel: SupportLevel;
  preferredLanguage?: string;
  supportLanguage?: string;
  variables?: TeachingScriptTemplateVariables;
  directorAction?: LessonDirectorActionType;
  directorSpeech?: string;
  templates?: Readonly<Record<string, string>>;
  overrides?: {
    expression?: ElvyExpression;
    gesture?: ElvyGesture;
    speakAutomatically?: boolean;
    addThinkingPauseMs?: number;
  };
}

export interface TeachingScriptValidationIssue {
  severity: "error" | "warning";
  code:
    | "missing-scene"
    | "missing-step"
    | "step-not-in-scene"
    | "missing-speech-reference"
    | "unresolved-speech"
    | "unresolved-instruction"
    | "invalid-wait-state";
  message: string;
}

export interface TeachingScriptValidationResult {
  valid: boolean;
  issues: TeachingScriptValidationIssue[];
}

const DEFAULT_TEMPLATES: Readonly<Record<string, string>> = Object.freeze({
  welcome: "Welcome, {{studentName}}. Today we are going to learn {{lessonTitle}}.",
  introduce_scene: "Now let us work on {{sceneTitle}}.",
  look_at_board: "Look at the board.",
  listen_carefully: "Listen carefully.",
  repeat_after_me: "Repeat after me.",
  your_turn: "Now it is your turn.",
  answer_question: "Answer the question.",
  try_again: "Good effort. Try again.",
  give_hint: "Here is a hint.",
  model_answer: "Listen to the model answer.",
  encouragement: "Well done. Let us continue.",
  scene_complete: "Good work. We can move to the next part.",
});

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function getByPath(source: unknown, path: string): unknown {
  if (!path.trim()) return undefined;

  return path.split(".").reduce<unknown>((current, key) => {
    const record = asRecord(current);
    return record ? record[key] : undefined;
  }, source);
}

function stringifyResolvedValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const lines = value
      .map((item) => stringifyResolvedValue(item))
      .filter((item): item is string => Boolean(item));
    return lines.length > 0 ? lines.join("\n") : undefined;
  }

  const record = asRecord(value);
  if (!record) return undefined;

  for (const key of ["speech", "text", "instruction", "content", "value", "title"]) {
    const candidate = stringifyResolvedValue(record[key]);
    if (candidate) return candidate;
  }

  return undefined;
}

function findContentReference(
  scene: Readonly<SceneDefinition>,
  referenceId: string | undefined,
): SceneContentReference | undefined {
  if (!referenceId) return undefined;
  return scene.contentReferences.find((reference) => reference.id === referenceId);
}

function resolveContentReference(
  scene: Readonly<SceneDefinition>,
  lessonPackage: unknown,
  referenceId: string | undefined,
  visited = new Set<string>(),
): { text?: string; reference?: SceneContentReference } {
  if (!referenceId || visited.has(referenceId)) return {};
  visited.add(referenceId);

  const reference = findContentReference(scene, referenceId);
  if (!reference) return {};

  const text = stringifyResolvedValue(getByPath(lessonPackage, reference.packagePath));
  if (text) return { text, reference };

  if (reference.fallbackReferenceId) {
    return resolveContentReference(
      scene,
      lessonPackage,
      reference.fallbackReferenceId,
      visited,
    );
  }

  return { reference };
}

function interpolate(
  template: string,
  variables: Readonly<TeachingScriptTemplateVariables>,
): string {
  return template.replace(/{{\s*([\w.-]+)\s*}}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined ? "" : String(value);
  }).replace(/\s{2,}/g, " ").trim();
}

function inferSpeechPurpose(
  step: Readonly<SceneStepDefinition>,
  action?: LessonDirectorActionType,
): TeachingSpeechPurpose {
  if (action === "give-hint") return "hint";
  if (action === "correct") return "correction";
  if (action === "encourage") return "encouragement";
  if (action === "review") return "review";
  if (action === "advance" || action === "complete-scene") return "transition";

  switch (step.kind) {
    case "ask":
      return "question";
    case "explain":
      return "explanation";
    case "model":
    case "demonstrate":
      return "model";
    case "feedback":
      return "feedback";
    case "review":
      return "review";
    case "transition":
      return "transition";
    default:
      return "instruction";
  }
}

function defaultSpeechTemplateKey(
  step: Readonly<SceneStepDefinition>,
  action?: LessonDirectorActionType,
): string | undefined {
  if (action === "give-hint") return "give_hint";
  if (action === "model-answer") return "model_answer";
  if (action === "encourage") return "encouragement";
  if (action === "repeat") return "repeat_after_me";
  if (action === "complete-scene" || action === "advance") return "scene_complete";

  switch (step.kind) {
    case "display":
      return "look_at_board";
    case "listen":
      return "listen_carefully";
    case "ask":
      return "your_turn";
    case "practice":
      return "repeat_after_me";
    case "transition":
      return "scene_complete";
    default:
      return undefined;
  }
}

function estimateSpeechDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(900, Math.round((words / 155) * 60_000));
}

function defaultCue(): SceneElvyCue {
  return {
    expression: "neutral",
    gesture: "idle",
    speakAutomatically: true,
  };
}

function createSegmentId(planId: string, order: number, kind: string): string {
  return `${planId}:${String(order).padStart(2, "0")}:${kind}`;
}

function resolveSpeech(
  context: Readonly<TeachingScriptEngineContext>,
  variables: Readonly<TeachingScriptTemplateVariables>,
): {
  text?: string;
  source: TeachingScriptSource;
  sourceReferenceId?: string;
  warning?: string;
} {
  if (context.directorSpeech?.trim()) {
    return { text: context.directorSpeech.trim(), source: "director" };
  }

  const cue = context.step.elvy;
  const resolved = resolveContentReference(
    context.scene,
    context.lessonPackage,
    cue?.speechReferenceId,
  );

  if (resolved.text) {
    return {
      text: interpolate(resolved.text, variables),
      source: "lesson-package",
      sourceReferenceId: resolved.reference?.id,
    };
  }

  const templateKey = cue?.speechTemplateKey ?? defaultSpeechTemplateKey(
    context.step,
    context.directorAction,
  );
  const templates = { ...DEFAULT_TEMPLATES, ...(context.templates ?? {}) };
  const template = templateKey ? templates[templateKey] : undefined;

  if (template) {
    return {
      text: interpolate(template, variables),
      source: "template",
      sourceReferenceId: templateKey,
    };
  }

  if (cue?.speechReferenceId) {
    return {
      source: "fallback",
      warning: `Speech reference ${cue.speechReferenceId} could not be resolved.`,
    };
  }

  return { source: "fallback" };
}

function resolveTaskInstruction(
  context: Readonly<TeachingScriptEngineContext>,
  variables: Readonly<TeachingScriptTemplateVariables>,
): { text?: string; source: TeachingScriptSource; warning?: string } {
  const task = context.step.studentTask;
  if (!task) return { source: "fallback" };

  const resolved = resolveContentReference(
    context.scene,
    context.lessonPackage,
    task.instructionReferenceId,
  );
  if (resolved.text) {
    return { text: interpolate(resolved.text, variables), source: "lesson-package" };
  }

  const templates = { ...DEFAULT_TEMPLATES, ...(context.templates ?? {}) };
  const template = task.instructionTemplateKey
    ? templates[task.instructionTemplateKey]
    : undefined;

  if (template) {
    return { text: interpolate(template, variables), source: "template" };
  }

  const fallbackKey = task.type === "repeat"
    ? "repeat_after_me"
    : task.type === "listen"
      ? "listen_carefully"
      : task.type === "answer" || task.type === "choose"
        ? "answer_question"
        : "your_turn";

  const fallback = templates[fallbackKey];
  return {
    text: fallback ? interpolate(fallback, variables) : undefined,
    source: "fallback",
    warning: task.instructionReferenceId
      ? `Instruction reference ${task.instructionReferenceId} could not be resolved.`
      : undefined,
  };
}

export function validateTeachingScriptContext(
  context: Readonly<TeachingScriptEngineContext>,
): TeachingScriptValidationResult {
  const issues: TeachingScriptValidationIssue[] = [];

  if (!context.scene?.id) {
    issues.push({ severity: "error", code: "missing-scene", message: "A scene is required." });
  }
  if (!context.step?.id) {
    issues.push({ severity: "error", code: "missing-step", message: "A scene step is required." });
  }
  if (context.scene && context.step && !context.scene.steps.some((step) => step.id === context.step.id)) {
    issues.push({
      severity: "error",
      code: "step-not-in-scene",
      message: `Step ${context.step.id} does not belong to scene ${context.scene.id}.`,
    });
  }
  if (context.step?.studentTask?.required && context.step.studentTask.waitingFor === "none") {
    issues.push({
      severity: "error",
      code: "invalid-wait-state",
      message: `Required task ${context.step.studentTask.taskId} must define a wait state.`,
    });
  }

  return { valid: !issues.some((issue) => issue.severity === "error"), issues };
}

/**
 * Builds an immutable, renderer-independent teaching performance plan for one
 * scene step.
 */
export function buildTeachingScript(
  context: Readonly<TeachingScriptEngineContext>,
): TeachingScriptPlan {
  const validation = validateTeachingScriptContext(context);
  if (!validation.valid) {
    throw new Error(validation.issues.map((issue) => issue.message).join("; "));
  }

  const planId = `script:${context.scene.id}:${context.step.id}:${context.now}`;
  const variables: TeachingScriptTemplateVariables = {
    studentName: "learner",
    lessonTitle: "today's lesson",
    sceneTitle: context.scene.title,
    stepTitle: context.step.title ?? context.step.kind,
    supportLanguage: context.supportLanguage,
    ...(context.variables ?? {}),
  };

  const cue = context.step.elvy ?? defaultCue();
  const expression = context.overrides?.expression ?? cue.expression;
  const gesture = context.overrides?.gesture ?? cue.gesture;
  const speakAutomatically =
    context.overrides?.speakAutomatically ?? cue.speakAutomatically;

  const warnings = validation.issues
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message);
  const notes: string[] = [];
  const segments: TeachingScriptSegment[] = [];
  let order = 0;

  const boardReferenceId = context.step.whiteboard?.contentReferenceId;
  if (context.step.whiteboard) {
    order += 1;
    segments.push({
      id: createSegmentId(planId, order, "board-focus"),
      kind: "board-focus",
      order,
      contentReferenceId: boardReferenceId,
      targetIds: context.step.whiteboard.highlightedItemIds,
      action: "show",
    });
  }

  const speech = resolveSpeech(context, variables);
  if (speech.warning) warnings.push(speech.warning);

  if (speech.text) {
    order += 1;
    segments.push({
      id: createSegmentId(planId, order, "speech"),
      kind: "speech",
      order,
      purpose: inferSpeechPurpose(context.step, context.directorAction),
      text: speech.text,
      source: speech.source,
      sourceReferenceId: speech.sourceReferenceId,
      language: context.preferredLanguage,
      speakAutomatically,
      interruptible: context.step.kind !== "model" && context.step.kind !== "demonstrate",
      expression,
      gesture,
      timing: {
        pauseBeforeMs: 250,
        pauseAfterMs: context.step.studentTask ? 450 : 250,
        estimatedSpeechMs: estimateSpeechDurationMs(speech.text),
      },
      boardSync: context.step.whiteboard
        ? {
            highlightTargetIds: context.step.whiteboard.highlightedItemIds,
            clearHighlightAfterSpeech: false,
          }
        : undefined,
    });
  } else if (context.step.elvy?.speechReferenceId) {
    warnings.push(`No speech was produced for step ${context.step.id}.`);
  }

  const thinkingPauseMs = context.overrides?.addThinkingPauseMs ??
    (context.step.kind === "ask" ? 500 : 0);
  if (thinkingPauseMs > 0) {
    order += 1;
    segments.push({
      id: createSegmentId(planId, order, "pause"),
      kind: "pause",
      order,
      durationMs: thinkingPauseMs,
      reason: context.step.kind === "ask" ? "before-question" : "natural-speech",
    });
  }

  const task = context.step.studentTask;
  if (task) {
    const instruction = resolveTaskInstruction(context, variables);
    if (instruction.warning) warnings.push(instruction.warning);

    order += 1;
    segments.push({
      id: createSegmentId(planId, order, "student-prompt"),
      kind: "student-prompt",
      order,
      taskId: task.taskId,
      instruction: instruction.text ?? "Complete the task shown in the classroom.",
      instructionSource: instruction.source,
      waitingFor: task.waitingFor,
      repeatable: task.repeatable,
      maximumAttempts: task.maximumAttempts,
    });

    if (task.waitingFor !== "none") {
      order += 1;
      segments.push({
        id: createSegmentId(planId, order, "wait"),
        kind: "wait",
        order,
        waitingFor: task.waitingFor,
        allowInterruption: true,
      });
    }
  }

  if (!task || task.waitingFor === "none") {
    order += 1;
    segments.push({
      id: createSegmentId(planId, order, "transition"),
      kind: "transition",
      order,
      action: context.directorAction ?? "continue-scene",
      targetStepId: context.step.nextStepId,
    });
  }

  if (context.supportLevel !== "none") {
    notes.push(`Script generated with ${context.supportLevel} support.`);
  }
  if (!speech.text) {
    notes.push("This step contains no spoken utterance.");
  }

  const speechText = segments
    .filter((segment): segment is TeachingSpeechSegment => segment.kind === "speech")
    .map((segment) => segment.text)
    .join(" ");

  return Object.freeze({
    id: planId,
    sceneId: context.scene.id,
    stepId: context.step.id,
    createdAt: context.now,
    language: context.preferredLanguage,
    supportLevel: context.supportLevel,
    segments: Object.freeze(segments.map((segment) => Object.freeze({ ...segment }))) as unknown as TeachingScriptSegment[],
    speechText,
    requiresStudentResponse: Boolean(task && task.waitingFor !== "none"),
    waitingFor: task?.waitingFor ?? "none",
    diagnostics: Object.freeze({
      warnings: Object.freeze([...warnings]) as unknown as string[],
      notes: Object.freeze([...notes]) as unknown as string[],
    }),
  }) as TeachingScriptPlan;
}

export function getTeachingSpeechSegments(
  plan: Readonly<TeachingScriptPlan>,
): TeachingSpeechSegment[] {
  return plan.segments.filter(
    (segment): segment is TeachingSpeechSegment => segment.kind === "speech",
  );
}

export function getNextTeachingScriptSegment(
  plan: Readonly<TeachingScriptPlan>,
  currentSegmentId?: string,
): TeachingScriptSegment | undefined {
  if (!currentSegmentId) return plan.segments[0];
  const index = plan.segments.findIndex((segment) => segment.id === currentSegmentId);
  return index >= 0 ? plan.segments[index + 1] : undefined;
}

export function hasTeachingScriptCompleted(
  plan: Readonly<TeachingScriptPlan>,
  completedSegmentIds: readonly string[],
): boolean {
  const completed = new Set(completedSegmentIds);
  return plan.segments.every((segment) => completed.has(segment.id));
}
