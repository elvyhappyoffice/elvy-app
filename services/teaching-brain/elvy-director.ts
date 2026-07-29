/**
 * ELVY Teaching Engine
 * TE-1000 — Elvy Director
 *
 * File: services/teaching-brain/elvy-director.ts
 *
 * Purpose:
 * - act as the single orchestration boundary for the Teaching Brain
 * - coordinate engine adapters without owning their pedagogical logic
 * - execute deterministic, ordered classroom turns
 * - return one immutable, synchronized instruction package to the UI/runtime
 *
 * Architecture:
 * - dependency-injected ports
 * - no database access
 * - no UI access
 * - no direct AI calls
 * - stateless orchestration
 * - immutable input/output
 * - deterministic stage order
 * - explicit diagnostics and recoverable failure handling
 */

export type ElvyDirectorId = string;
export type ElvyDirectorDateTime = string;

export type ElvyDirectorMode =
  | "lesson_start"
  | "teacher_turn"
  | "learner_turn"
  | "resume"
  | "system_event";

export type ElvyDirectorStatus =
  | "completed"
  | "completed_with_warnings"
  | "blocked"
  | "failed";

export type ElvyDirectorStageName =
  | "lesson"
  | "scene"
  | "response"
  | "strategy"
  | "adaptation"
  | "learning_state"
  | "motivation"
  | "whiteboard"
  | "teaching_script"
  | "classroom"
  | "analytics";

export type ElvyDirectorCommandType =
  | "speak"
  | "show_text"
  | "clear_whiteboard"
  | "write_whiteboard"
  | "highlight_whiteboard"
  | "show_image"
  | "play_audio"
  | "play_video"
  | "set_avatar_state"
  | "set_avatar_gesture"
  | "set_avatar_expression"
  | "wait_for_learner"
  | "open_input"
  | "close_input"
  | "start_scene"
  | "complete_scene"
  | "complete_lesson"
  | "pause_lesson"
  | "resume_lesson"
  | "persist_learning_state"
  | "persist_motivation_state"
  | "persist_analytics"
  | "emit_event"
  | "custom";

export type ElvyDirectorChannel =
  | "speech"
  | "chat"
  | "whiteboard"
  | "avatar"
  | "audio"
  | "video"
  | "classroom"
  | "storage"
  | "system";

export type ElvyDirectorPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";

export type ElvyDirectorEventType =
  | "lesson_requested"
  | "lesson_started"
  | "lesson_resumed"
  | "scene_started"
  | "scene_completed"
  | "teacher_turn_requested"
  | "learner_response_received"
  | "learner_response_evaluated"
  | "strategy_selected"
  | "adaptation_selected"
  | "objective_updated"
  | "objective_mastered"
  | "motivation_updated"
  | "whiteboard_updated"
  | "teaching_script_ready"
  | "classroom_instruction_ready"
  | "analytics_updated"
  | "lesson_completed"
  | "lesson_paused"
  | "warning"
  | "error"
  | "custom";

export interface ElvyDirectorEvent {
  readonly eventId: ElvyDirectorId;
  readonly eventType: ElvyDirectorEventType;
  readonly occurredAt: ElvyDirectorDateTime;
  readonly learnerId: ElvyDirectorId;
  readonly sessionId: ElvyDirectorId;
  readonly lessonId: ElvyDirectorId;
  readonly sceneId?: ElvyDirectorId;
  readonly objectiveId?: ElvyDirectorId;
  readonly source: ElvyDirectorStageName | "director" | "runtime";
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface ElvyDirectorCommand {
  readonly commandId: ElvyDirectorId;
  readonly type: ElvyDirectorCommandType;
  readonly channel: ElvyDirectorChannel;
  readonly priority: ElvyDirectorPriority;
  readonly sequence: number;
  readonly blocking: boolean;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: ElvyDirectorDateTime;
}

export interface ElvyDirectorInstructionPackage {
  readonly packageId: ElvyDirectorId;
  readonly learnerId: ElvyDirectorId;
  readonly sessionId: ElvyDirectorId;
  readonly lessonId: ElvyDirectorId;
  readonly sceneId?: ElvyDirectorId;
  readonly commands: readonly ElvyDirectorCommand[];
  readonly events: readonly ElvyDirectorEvent[];
  readonly shouldWaitForLearner: boolean;
  readonly expectedInput?: Readonly<Record<string, unknown>>;
  readonly generatedAt: ElvyDirectorDateTime;
}

export interface ElvyDirectorRuntimeState {
  readonly learnerId: ElvyDirectorId;
  readonly sessionId: ElvyDirectorId;
  readonly lessonId: ElvyDirectorId;
  readonly sceneId?: ElvyDirectorId;
  readonly revision: number;
  readonly lessonState?: unknown;
  readonly sceneState?: unknown;
  readonly responseState?: unknown;
  readonly strategyState?: unknown;
  readonly adaptationState?: unknown;
  readonly learningState?: unknown;
  readonly motivationState?: unknown;
  readonly whiteboardState?: unknown;
  readonly teachingScriptState?: unknown;
  readonly classroomState?: unknown;
  readonly analyticsState?: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ElvyDirectorTurnInput {
  readonly turnId: ElvyDirectorId;
  readonly mode: ElvyDirectorMode;
  readonly runtime: ElvyDirectorRuntimeState;
  readonly learnerResponse?: unknown;
  readonly triggeringEvent?: ElvyDirectorEvent;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface ElvyDirectorStageContext {
  readonly input: ElvyDirectorTurnInput;
  readonly previousRuntime: ElvyDirectorRuntimeState;
  readonly runtime: ElvyDirectorRuntimeState;
  readonly outputs: Readonly<Partial<Record<ElvyDirectorStageName, unknown>>>;
  readonly commands: readonly ElvyDirectorCommand[];
  readonly events: readonly ElvyDirectorEvent[];
  readonly now: ElvyDirectorDateTime;
}

export interface ElvyDirectorStageResult<TOutput = unknown> {
  readonly output?: TOutput;
  readonly runtimePatch?: Readonly<Partial<ElvyDirectorRuntimeState>>;
  readonly commands?: readonly ElvyDirectorCommand[];
  readonly events?: readonly ElvyDirectorEvent[];
  readonly warnings?: readonly string[];
  readonly blocked?: boolean;
  readonly blockReason?: string;
}

export interface ElvyDirectorPort<TOutput = unknown> {
  readonly name: ElvyDirectorStageName;
  readonly shouldRun?: (context: ElvyDirectorStageContext) => boolean;
  readonly execute: (
    context: ElvyDirectorStageContext,
  ) =>
    | ElvyDirectorStageResult<TOutput>
    | Promise<ElvyDirectorStageResult<TOutput>>;
}

export type ElvyDirectorPorts = Readonly<
  Partial<Record<ElvyDirectorStageName, ElvyDirectorPort>>
>;

export interface ElvyDirectorOptions {
  readonly engineVersion?: string;
  readonly now?: () => ElvyDirectorDateTime;
  readonly idFactory?: (prefix: string, seed: string) => ElvyDirectorId;
  readonly stopOnStageFailure?: boolean;
  readonly maximumCommands?: number;
  readonly maximumEvents?: number;
  readonly stageOrder?: readonly ElvyDirectorStageName[];
}

export interface ElvyDirectorStageDiagnostic {
  readonly stage: ElvyDirectorStageName;
  readonly status: "completed" | "skipped" | "blocked" | "failed";
  readonly durationMs: number;
  readonly warningCount: number;
  readonly message?: string;
}

export interface ElvyDirectorDiagnostics {
  readonly engineVersion: string;
  readonly stageDiagnostics: readonly ElvyDirectorStageDiagnostic[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

export interface ElvyDirectorResult {
  readonly status: ElvyDirectorStatus;
  readonly previousRuntime: ElvyDirectorRuntimeState;
  readonly currentRuntime: ElvyDirectorRuntimeState;
  readonly instructionPackage: ElvyDirectorInstructionPackage;
  readonly outputs: Readonly<Partial<Record<ElvyDirectorStageName, unknown>>>;
  readonly diagnostics: ElvyDirectorDiagnostics;
}

const DEFAULT_STAGE_ORDER: readonly ElvyDirectorStageName[] = Object.freeze([
  "lesson",
  "scene",
  "response",
  "strategy",
  "adaptation",
  "learning_state",
  "motivation",
  "whiteboard",
  "teaching_script",
  "classroom",
  "analytics",
]);

const DEFAULT_OPTIONS: Required<ElvyDirectorOptions> = {
  engineVersion: "1.0.0",
  now: () => new Date().toISOString(),
  idFactory: (prefix: string, seed: string) => `${prefix}:${stableHash(seed)}`,
  stopOnStageFailure: true,
  maximumCommands: 200,
  maximumEvents: 200,
  stageOrder: DEFAULT_STAGE_ORDER,
};

export class ElvyDirector {
  private readonly ports: ElvyDirectorPorts;
  private readonly options: Required<ElvyDirectorOptions>;

  public constructor(
    ports: ElvyDirectorPorts,
    options: ElvyDirectorOptions = {},
  ) {
    this.ports = Object.freeze({ ...ports });
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      stageOrder: Object.freeze([
        ...(options.stageOrder ?? DEFAULT_STAGE_ORDER),
      ]),
    };

    validateOptions(this.options);
    validatePorts(this.ports, this.options.stageOrder);
  }

  public async executeTurn(
    input: ElvyDirectorTurnInput,
  ): Promise<ElvyDirectorResult> {
    validateTurnInput(input);

    const now = this.options.now();
    const previousRuntime = freezeRuntime(input.runtime);

    let runtime = previousRuntime;
    let commands: readonly ElvyDirectorCommand[] = Object.freeze([]);
    let events: readonly ElvyDirectorEvent[] = Object.freeze([]);
    let outputs: Readonly<Partial<Record<ElvyDirectorStageName, unknown>>> =
      Object.freeze({});

    const warnings: string[] = [];
    const errors: string[] = [];
    const stageDiagnostics: ElvyDirectorStageDiagnostic[] = [];

    let blocked = false;
    let failed = false;

    for (const stage of this.options.stageOrder) {
      const port = this.ports[stage];

      if (!port) {
        stageDiagnostics.push(
          Object.freeze({
            stage,
            status: "skipped",
            durationMs: 0,
            warningCount: 0,
            message: "No adapter registered.",
          }),
        );
        continue;
      }

      const context = freezeStageContext({
        input,
        previousRuntime,
        runtime,
        outputs,
        commands,
        events,
        now,
      });

      if (port.shouldRun && !port.shouldRun(context)) {
        stageDiagnostics.push(
          Object.freeze({
            stage,
            status: "skipped",
            durationMs: 0,
            warningCount: 0,
            message: "Adapter declined this turn.",
          }),
        );
        continue;
      }

      const startedAt = monotonicNow();

      try {
        const result = await port.execute(context);
        validateStageResult(stage, result);

        const stageWarnings = [...(result.warnings ?? [])];
        warnings.push(...stageWarnings);

        if (result.output !== undefined) {
          outputs = Object.freeze({
            ...outputs,
            [stage]: result.output,
          });
        }

        if (result.runtimePatch) {
          runtime = mergeRuntime(runtime, result.runtimePatch);
        }

        if (result.commands?.length) {
          commands = appendCommands(
            commands,
            result.commands,
            this.options.maximumCommands,
          );
        }

        if (result.events?.length) {
          events = appendEvents(
            events,
            result.events,
            this.options.maximumEvents,
          );
        }

        if (result.blocked) {
          blocked = true;
          stageDiagnostics.push(
            Object.freeze({
              stage,
              status: "blocked",
              durationMs: monotonicNow() - startedAt,
              warningCount: stageWarnings.length,
              message: result.blockReason ?? "The stage blocked the turn.",
            }),
          );
          break;
        }

        stageDiagnostics.push(
          Object.freeze({
            stage,
            status: "completed",
            durationMs: monotonicNow() - startedAt,
            warningCount: stageWarnings.length,
          }),
        );
      } catch (error: unknown) {
        failed = true;
        const message = errorMessage(error);
        errors.push(`${stage}: ${message}`);

        stageDiagnostics.push(
          Object.freeze({
            stage,
            status: "failed",
            durationMs: monotonicNow() - startedAt,
            warningCount: 0,
            message,
          }),
        );

        if (this.options.stopOnStageFailure) {
          break;
        }
      }
    }

    const currentRuntime = freezeRuntime({
      ...runtime,
      revision: runtime.revision + 1,
    });

    const instructionPackage = buildInstructionPackage({
      input,
      runtime: currentRuntime,
      commands,
      events,
      now,
      idFactory: this.options.idFactory,
    });

    const status = resolveDirectorStatus({
      blocked,
      failed,
      warnings,
    });

    return Object.freeze({
      status,
      previousRuntime,
      currentRuntime,
      instructionPackage,
      outputs,
      diagnostics: Object.freeze({
        engineVersion: this.options.engineVersion,
        stageDiagnostics: Object.freeze(stageDiagnostics),
        warnings: Object.freeze(warnings),
        errors: Object.freeze(errors),
      }),
    });
  }
}

export function createElvyDirectorPort<TOutput>(
  port: ElvyDirectorPort<TOutput>,
): ElvyDirectorPort<TOutput> {
  return Object.freeze({ ...port });
}

export function createElvyDirectorCommand(
  input: Omit<ElvyDirectorCommand, "commandId" | "sequence"> & {
    readonly commandId?: ElvyDirectorId;
    readonly sequence?: number;
  },
): ElvyDirectorCommand {
  return Object.freeze({
    ...input,
    commandId:
      input.commandId ??
      `command:${stableHash(
        `${input.type}:${input.channel}:${input.createdAt}:${JSON.stringify(
          input.payload,
        )}`,
      )}`,
    sequence: input.sequence ?? 0,
    payload: Object.freeze({ ...input.payload }),
  });
}

export function createElvyDirectorEvent(
  input: Omit<ElvyDirectorEvent, "eventId"> & {
    readonly eventId?: ElvyDirectorId;
  },
): ElvyDirectorEvent {
  return Object.freeze({
    ...input,
    eventId:
      input.eventId ??
      `event:${stableHash(
        `${input.eventType}:${input.occurredAt}:${input.sessionId}:${input.source}`,
      )}`,
    payload: input.payload ? Object.freeze({ ...input.payload }) : undefined,
  });
}

function buildInstructionPackage(input: {
  readonly input: ElvyDirectorTurnInput;
  readonly runtime: ElvyDirectorRuntimeState;
  readonly commands: readonly ElvyDirectorCommand[];
  readonly events: readonly ElvyDirectorEvent[];
  readonly now: ElvyDirectorDateTime;
  readonly idFactory: Required<ElvyDirectorOptions>["idFactory"];
}): ElvyDirectorInstructionPackage {
  const normalizedCommands = Object.freeze(
    input.commands.map((command, index) =>
      Object.freeze({
        ...command,
        sequence: index + 1,
        payload: Object.freeze({ ...command.payload }),
      }),
    ),
  );

  const waitCommand = [...normalizedCommands]
    .reverse()
    .find(
      (command) =>
        command.type === "wait_for_learner" ||
        command.type === "open_input",
    );

  const expectedInput =
    waitCommand?.payload.expectedInput &&
    isRecord(waitCommand.payload.expectedInput)
      ? Object.freeze({ ...waitCommand.payload.expectedInput })
      : undefined;

  return Object.freeze({
    packageId: input.idFactory(
      "instruction-package",
      `${input.input.turnId}:${input.runtime.revision}:${input.now}`,
    ),
    learnerId: input.runtime.learnerId,
    sessionId: input.runtime.sessionId,
    lessonId: input.runtime.lessonId,
    sceneId: input.runtime.sceneId,
    commands: normalizedCommands,
    events: Object.freeze([...input.events]),
    shouldWaitForLearner: waitCommand !== undefined,
    expectedInput,
    generatedAt: input.now,
  });
}

function resolveDirectorStatus(input: {
  readonly blocked: boolean;
  readonly failed: boolean;
  readonly warnings: readonly string[];
}): ElvyDirectorStatus {
  if (input.failed) return "failed";
  if (input.blocked) return "blocked";
  if (input.warnings.length > 0) return "completed_with_warnings";
  return "completed";
}

function mergeRuntime(
  current: ElvyDirectorRuntimeState,
  patch: Readonly<Partial<ElvyDirectorRuntimeState>>,
): ElvyDirectorRuntimeState {
  assertIdentityIsNotChanged(current, patch);

  return freezeRuntime({
    ...current,
    ...patch,
    learnerId: current.learnerId,
    sessionId: current.sessionId,
    lessonId: current.lessonId,
    revision: current.revision,
    metadata: patch.metadata
      ? Object.freeze({ ...(current.metadata ?? {}), ...patch.metadata })
      : current.metadata,
  });
}

function freezeRuntime(
  runtime: ElvyDirectorRuntimeState,
): ElvyDirectorRuntimeState {
  return Object.freeze({
    ...runtime,
    metadata: runtime.metadata
      ? Object.freeze({ ...runtime.metadata })
      : undefined,
  });
}

function freezeStageContext(
  context: ElvyDirectorStageContext,
): ElvyDirectorStageContext {
  return Object.freeze({
    ...context,
    outputs: Object.freeze({ ...context.outputs }),
    commands: Object.freeze([...context.commands]),
    events: Object.freeze([...context.events]),
  });
}

function appendCommands(
  current: readonly ElvyDirectorCommand[],
  additions: readonly ElvyDirectorCommand[],
  maximum: number,
): readonly ElvyDirectorCommand[] {
  const merged = [
    ...current,
    ...additions.map((command) =>
      Object.freeze({
        ...command,
        payload: Object.freeze({ ...command.payload }),
      }),
    ),
  ];

  if (merged.length > maximum) {
    throw new Error(`Director command limit exceeded (${maximum}).`);
  }

  return Object.freeze(merged);
}

function appendEvents(
  current: readonly ElvyDirectorEvent[],
  additions: readonly ElvyDirectorEvent[],
  maximum: number,
): readonly ElvyDirectorEvent[] {
  const merged = [
    ...current,
    ...additions.map((event) =>
      Object.freeze({
        ...event,
        payload: event.payload
          ? Object.freeze({ ...event.payload })
          : undefined,
      }),
    ),
  ];

  if (merged.length > maximum) {
    throw new Error(`Director event limit exceeded (${maximum}).`);
  }

  return Object.freeze(merged);
}

function validateTurnInput(input: ElvyDirectorTurnInput): void {
  requireText(input.turnId, "turnId");
  requireText(input.runtime.learnerId, "runtime.learnerId");
  requireText(input.runtime.sessionId, "runtime.sessionId");
  requireText(input.runtime.lessonId, "runtime.lessonId");

  if (!Number.isInteger(input.runtime.revision) || input.runtime.revision < 0) {
    throw new Error("runtime.revision must be a non-negative integer.");
  }

  if (input.mode === "learner_turn" && input.learnerResponse === undefined) {
    throw new Error("learnerResponse is required for learner_turn mode.");
  }

  if (input.triggeringEvent) {
    const event = input.triggeringEvent;
    if (
      event.learnerId !== input.runtime.learnerId ||
      event.sessionId !== input.runtime.sessionId ||
      event.lessonId !== input.runtime.lessonId
    ) {
      throw new Error(
        "triggeringEvent identifiers do not match runtime identifiers.",
      );
    }
  }
}

function validateOptions(options: Required<ElvyDirectorOptions>): void {
  requireText(options.engineVersion, "engineVersion");

  if (!Number.isInteger(options.maximumCommands) || options.maximumCommands < 1) {
    throw new Error("maximumCommands must be a positive integer.");
  }

  if (!Number.isInteger(options.maximumEvents) || options.maximumEvents < 1) {
    throw new Error("maximumEvents must be a positive integer.");
  }

  const seen = new Set<ElvyDirectorStageName>();
  for (const stage of options.stageOrder) {
    if (seen.has(stage)) {
      throw new Error(`Duplicate stage in stageOrder: ${stage}.`);
    }
    seen.add(stage);
  }
}

function validatePorts(
  ports: ElvyDirectorPorts,
  stageOrder: readonly ElvyDirectorStageName[],
): void {
  for (const [key, port] of Object.entries(ports)) {
    if (!port) continue;

    if (port.name !== key) {
      throw new Error(
        `Director adapter key "${key}" does not match adapter name "${port.name}".`,
      );
    }

    if (!stageOrder.includes(port.name)) {
      throw new Error(
        `Director adapter "${port.name}" is not present in stageOrder.`,
      );
    }
  }
}

function validateStageResult(
  stage: ElvyDirectorStageName,
  result: ElvyDirectorStageResult,
): void {
  if (!result || typeof result !== "object") {
    throw new Error(`${stage} adapter returned an invalid result.`);
  }

  if (result.blocked && !result.blockReason?.trim()) {
    throw new Error(`${stage} adapter blocked the turn without a blockReason.`);
  }

  for (const command of result.commands ?? []) {
    validateCommand(command, stage);
  }

  for (const event of result.events ?? []) {
    validateEvent(event, stage);
  }
}

function validateCommand(
  command: ElvyDirectorCommand,
  stage: ElvyDirectorStageName,
): void {
  requireText(command.commandId, `${stage}.command.commandId`);

  if (!Number.isInteger(command.sequence)) {
    throw new Error(`${stage} command sequence must be an integer.`);
  }

  if (!isRecord(command.payload)) {
    throw new Error(`${stage} command payload must be an object.`);
  }
}

function validateEvent(
  event: ElvyDirectorEvent,
  stage: ElvyDirectorStageName,
): void {
  requireText(event.eventId, `${stage}.event.eventId`);
  requireText(event.learnerId, `${stage}.event.learnerId`);
  requireText(event.sessionId, `${stage}.event.sessionId`);
  requireText(event.lessonId, `${stage}.event.lessonId`);
}

function assertIdentityIsNotChanged(
  current: ElvyDirectorRuntimeState,
  patch: Readonly<Partial<ElvyDirectorRuntimeState>>,
): void {
  if (patch.learnerId !== undefined && patch.learnerId !== current.learnerId) {
    throw new Error("A stage cannot change learnerId.");
  }

  if (patch.sessionId !== undefined && patch.sessionId !== current.sessionId) {
    throw new Error("A stage cannot change sessionId.");
  }

  if (patch.lessonId !== undefined && patch.lessonId !== current.lessonId) {
    throw new Error("A stage cannot change lessonId.");
  }

  if (patch.revision !== undefined && patch.revision !== current.revision) {
    throw new Error("A stage cannot change runtime revision directly.");
  }
}

function requireText(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`${field} is required.`);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function monotonicNow(): number {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return Math.round(performance.now());
  }
  return Date.now();
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
