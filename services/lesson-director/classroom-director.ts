/**
 * Elvy Lesson Director — Classroom Director
 *
 * Converts a structured Teaching Script into an ordered classroom execution
 * plan for the whiteboard, voice, avatar, chat, and control layers.
 *
 * This module is deterministic and renderer-independent.
 *
 * It does not:
 * - decide what to teach,
 * - select a lesson scene,
 * - evaluate the learner,
 * - call AI providers,
 * - access Supabase or local storage,
 * - update ticket time,
 * - manipulate React components directly.
 */

import {
  type AvatarActionKind,
  type ChatActionKind,
  type ClassroomChannel,
  type ClassroomInstruction,
  type VoiceActionKind,
  type WhiteboardActionKind,
} from "./types";

import {
  type TeachingScript,
  type TeachingScriptStep,
  type TeachingScriptStepChannel,
  type TeachingScriptStepKind,
} from "./elvy-teaching-script-engine";

export type ClassroomExecutionStatus =
  | "READY"
  | "RUNNING"
  | "WAITING_FOR_STUDENT"
  | "COMPLETED"
  | "PAUSED"
  | "FAILED";

export type ClassroomCommandKind =
  | "WHITEBOARD_COMMAND"
  | "VOICE_COMMAND"
  | "AVATAR_COMMAND"
  | "CHAT_COMMAND"
  | "WAIT_COMMAND";

export interface ClassroomDirectorConfig {
  readonly defaultAvatarDurationMs?: number;
  readonly minimumCommandDurationMs?: number;
  readonly speakingWordsPerMinute?: number;
  readonly addListeningAvatarBeforeWait?: boolean;
  readonly keepBoardVisibleWhileWaiting?: boolean;
  readonly mirrorVoiceToChat?: boolean;
}

export interface ClassroomDirectorInput {
  readonly sessionId: string;
  readonly studentId: string;
  readonly script: TeachingScript;
  readonly startedAt?: string;
}

export interface ClassroomCommand {
  readonly id: string;
  readonly sequence: number;
  readonly scriptStepId: string;
  readonly scriptStepKind: TeachingScriptStepKind;
  readonly kind: ClassroomCommandKind;
  readonly channel: ClassroomChannel | "CONTROL";
  readonly instruction?: ClassroomInstruction;
  readonly waitMs?: number;
  readonly startsAfterMs: number;
  readonly estimatedDurationMs: number;
  readonly blocksFollowingCommands: boolean;
  readonly waitsForStudentResponse: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ClassroomExecutionPlan {
  readonly id: string;
  readonly sessionId: string;
  readonly studentId: string;
  readonly lessonId: string;
  readonly sceneId: string;
  readonly sceneTitle: string;
  readonly status: ClassroomExecutionStatus;
  readonly commands: readonly ClassroomCommand[];
  readonly totalEstimatedDurationMs: number;
  readonly waitsForStudentResponse: boolean;
  readonly responseWaitCommandId: string | null;
  readonly generatedAt: string;
  readonly reason: string;
}

export interface ClassroomExecutionCursor {
  readonly planId: string;
  readonly status: ClassroomExecutionStatus;
  readonly nextCommandIndex: number;
  readonly completedCommandIds: readonly string[];
  readonly activeCommandId: string | null;
  readonly waitingForStudentResponse: boolean;
  readonly pausedAtCommandId: string | null;
  readonly failureReason: string | null;
  readonly updatedAt: string;
}

export interface ClassroomCommandBatch {
  readonly planId: string;
  readonly commands: readonly ClassroomCommand[];
  readonly cursor: ClassroomExecutionCursor;
  readonly hasMoreCommands: boolean;
  readonly waitsForStudentResponse: boolean;
}

export interface ClassroomDirectorError {
  readonly code:
    | "INVALID_INPUT"
    | "INVALID_CONFIG"
    | "INVALID_PLAN"
    | "INVALID_CURSOR"
    | "COMMAND_NOT_FOUND"
    | "CLASSROOM_DIRECTOR_FAILED";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type ClassroomDirectorResult<T> =
  | {
      readonly ok: true;
      readonly data: T;
    }
  | {
      readonly ok: false;
      readonly error: ClassroomDirectorError;
    };

const DEFAULT_CONFIG: Required<ClassroomDirectorConfig> = {
  defaultAvatarDurationMs: 1200,
  minimumCommandDurationMs: 250,
  speakingWordsPerMinute: 145,
  addListeningAvatarBeforeWait: true,
  keepBoardVisibleWhileWaiting: true,
  mirrorVoiceToChat: false,
};

export class ClassroomDirectorRuntimeError extends Error {
  readonly code: ClassroomDirectorError["code"];
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: ClassroomDirectorError["code"],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "ClassroomDirectorRuntimeError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Stateless classroom orchestration service.
 *
 * Every method returns immutable values and never mutates the supplied
 * script, plan, or cursor.
 */
export class ClassroomDirector {
  private readonly config: Required<ClassroomDirectorConfig>;

  constructor(config: ClassroomDirectorConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.validateConfig();
  }

  /**
   * Converts a Teaching Script into a complete ordered execution plan.
   */
  createPlan(input: ClassroomDirectorInput): ClassroomExecutionPlan {
    this.validateInput(input);

    const generatedAt =
      input.startedAt?.trim() || new Date().toISOString();

    const commands = this.buildCommands(input.script);
    const responseWaitCommand = commands.find(
      (command) => command.waitsForStudentResponse,
    );

    const totalEstimatedDurationMs = commands.reduce(
      (total, command) =>
        total + command.estimatedDurationMs,
      0,
    );

    return freezePlan({
      id: createPlanId(
        input.sessionId,
        input.script.lessonId,
        input.script.sceneId,
      ),
      sessionId: input.sessionId,
      studentId: input.studentId,
      lessonId: input.script.lessonId,
      sceneId: input.script.sceneId,
      sceneTitle: input.script.sceneTitle,
      status: "READY",
      commands,
      totalEstimatedDurationMs,
      waitsForStudentResponse: Boolean(responseWaitCommand),
      responseWaitCommandId: responseWaitCommand?.id ?? null,
      generatedAt,
      reason:
        "The classroom execution plan synchronizes the Teaching Script " +
        "across whiteboard, voice, avatar, chat, and control channels.",
    });
  }

  safeCreatePlan(
    input: ClassroomDirectorInput,
  ): ClassroomDirectorResult<ClassroomExecutionPlan> {
    try {
      return {
        ok: true,
        data: this.createPlan(input),
      };
    } catch (error) {
      return {
        ok: false,
        error: toClassroomDirectorError(error),
      };
    }
  }

  /**
   * Creates a fresh cursor for a plan.
   */
  createCursor(
    plan: ClassroomExecutionPlan,
    now = new Date().toISOString(),
  ): ClassroomExecutionCursor {
    this.validatePlan(plan);

    return freezeCursor({
      planId: plan.id,
      status:
        plan.commands.length === 0 ? "COMPLETED" : "READY",
      nextCommandIndex: 0,
      completedCommandIds: [],
      activeCommandId: null,
      waitingForStudentResponse: false,
      pausedAtCommandId: null,
      failureReason: null,
      updatedAt: now,
    });
  }

  safeCreateCursor(
    plan: ClassroomExecutionPlan,
    now?: string,
  ): ClassroomDirectorResult<ClassroomExecutionCursor> {
    try {
      return {
        ok: true,
        data: this.createCursor(plan, now),
      };
    } catch (error) {
      return {
        ok: false,
        error: toClassroomDirectorError(error),
      };
    }
  }

  /**
   * Returns the next executable command batch.
   *
   * Commands are returned until:
   * - a blocking command is reached,
   * - a student-response wait is reached,
   * - the requested batch size is reached,
   * - or the plan ends.
   */
  nextBatch(
    plan: ClassroomExecutionPlan,
    cursor: ClassroomExecutionCursor,
    maxCommands = 10,
    now = new Date().toISOString(),
  ): ClassroomCommandBatch {
    this.validatePlanAndCursor(plan, cursor);

    if (!Number.isInteger(maxCommands) || maxCommands <= 0) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_INPUT",
        "maxCommands must be a positive integer.",
        { maxCommands },
      );
    }

    if (
      cursor.status === "COMPLETED" ||
      cursor.status === "FAILED" ||
      cursor.status === "PAUSED" ||
      cursor.waitingForStudentResponse
    ) {
      return freezeBatch({
        planId: plan.id,
        commands: [],
        cursor,
        hasMoreCommands:
          cursor.nextCommandIndex < plan.commands.length,
        waitsForStudentResponse:
          cursor.waitingForStudentResponse,
      });
    }

    const selected: ClassroomCommand[] = [];
    let index = cursor.nextCommandIndex;

    while (
      index < plan.commands.length &&
      selected.length < maxCommands
    ) {
      const command = plan.commands[index];
      selected.push(command);
      index += 1;

      if (
        command.blocksFollowingCommands ||
        command.waitsForStudentResponse
      ) {
        break;
      }
    }

    const activeCommand =
      selected.length > 0 ? selected[0] : null;

    const nextCursor = freezeCursor({
      ...cursor,
      status:
        selected.length === 0
          ? "COMPLETED"
          : selected.some(
                (command) =>
                  command.waitsForStudentResponse,
              )
            ? "WAITING_FOR_STUDENT"
            : "RUNNING",
      activeCommandId: activeCommand?.id ?? null,
      waitingForStudentResponse: selected.some(
        (command) => command.waitsForStudentResponse,
      ),
      updatedAt: now,
    });

    return freezeBatch({
      planId: plan.id,
      commands: selected,
      cursor: nextCursor,
      hasMoreCommands: index < plan.commands.length,
      waitsForStudentResponse:
        nextCursor.waitingForStudentResponse,
    });
  }

  safeNextBatch(
    plan: ClassroomExecutionPlan,
    cursor: ClassroomExecutionCursor,
    maxCommands?: number,
    now?: string,
  ): ClassroomDirectorResult<ClassroomCommandBatch> {
    try {
      return {
        ok: true,
        data: this.nextBatch(
          plan,
          cursor,
          maxCommands,
          now,
        ),
      };
    } catch (error) {
      return {
        ok: false,
        error: toClassroomDirectorError(error),
      };
    }
  }

  /**
   * Marks a command as completed and advances the cursor.
   */
  completeCommand(
    plan: ClassroomExecutionPlan,
    cursor: ClassroomExecutionCursor,
    commandId: string,
    now = new Date().toISOString(),
  ): ClassroomExecutionCursor {
    this.validatePlanAndCursor(plan, cursor);

    const commandIndex = plan.commands.findIndex(
      (command) => command.id === commandId,
    );

    if (commandIndex < 0) {
      throw new ClassroomDirectorRuntimeError(
        "COMMAND_NOT_FOUND",
        `Classroom command "${commandId}" was not found.`,
        { commandId, planId: plan.id },
      );
    }

    if (commandIndex < cursor.nextCommandIndex) {
      return cursor;
    }

    if (commandIndex > cursor.nextCommandIndex) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_CURSOR",
        "Commands must be completed in sequence.",
        {
          commandId,
          expectedCommandId:
            plan.commands[cursor.nextCommandIndex]?.id ?? null,
        },
      );
    }

    const completedCommandIds = uniqueStrings([
      ...cursor.completedCommandIds,
      commandId,
    ]);

    const nextCommandIndex = commandIndex + 1;
    const completed =
      nextCommandIndex >= plan.commands.length;

    return freezeCursor({
      ...cursor,
      status: completed ? "COMPLETED" : "RUNNING",
      nextCommandIndex,
      completedCommandIds,
      activeCommandId: null,
      waitingForStudentResponse: false,
      pausedAtCommandId: null,
      failureReason: null,
      updatedAt: now,
    });
  }

  /**
   * Releases a cursor that is waiting for the learner.
   */
  continueAfterStudentResponse(
    plan: ClassroomExecutionPlan,
    cursor: ClassroomExecutionCursor,
    now = new Date().toISOString(),
  ): ClassroomExecutionCursor {
    this.validatePlanAndCursor(plan, cursor);

    if (!cursor.waitingForStudentResponse) {
      return cursor;
    }

    const waitCommand =
      plan.commands[cursor.nextCommandIndex];

    if (!waitCommand?.waitsForStudentResponse) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_CURSOR",
        "The cursor says it is waiting, but the next command is not a response wait.",
        {
          nextCommandIndex: cursor.nextCommandIndex,
          nextCommandId: waitCommand?.id ?? null,
        },
      );
    }

    return this.completeCommand(
      plan,
      cursor,
      waitCommand.id,
      now,
    );
  }

  pause(
    plan: ClassroomExecutionPlan,
    cursor: ClassroomExecutionCursor,
    now = new Date().toISOString(),
  ): ClassroomExecutionCursor {
    this.validatePlanAndCursor(plan, cursor);

    if (
      cursor.status === "COMPLETED" ||
      cursor.status === "FAILED"
    ) {
      return cursor;
    }

    return freezeCursor({
      ...cursor,
      status: "PAUSED",
      pausedAtCommandId:
        cursor.activeCommandId ??
        plan.commands[cursor.nextCommandIndex]?.id ??
        null,
      updatedAt: now,
    });
  }

  resume(
    plan: ClassroomExecutionPlan,
    cursor: ClassroomExecutionCursor,
    now = new Date().toISOString(),
  ): ClassroomExecutionCursor {
    this.validatePlanAndCursor(plan, cursor);

    if (cursor.status !== "PAUSED") {
      return cursor;
    }

    return freezeCursor({
      ...cursor,
      status: cursor.waitingForStudentResponse
        ? "WAITING_FOR_STUDENT"
        : "RUNNING",
      pausedAtCommandId: null,
      updatedAt: now,
    });
  }

  fail(
    plan: ClassroomExecutionPlan,
    cursor: ClassroomExecutionCursor,
    reason: string,
    now = new Date().toISOString(),
  ): ClassroomExecutionCursor {
    this.validatePlanAndCursor(plan, cursor);

    const failureReason = reason.trim();

    if (!failureReason) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_INPUT",
        "A failure reason is required.",
      );
    }

    return freezeCursor({
      ...cursor,
      status: "FAILED",
      activeCommandId: null,
      waitingForStudentResponse: false,
      pausedAtCommandId: null,
      failureReason,
      updatedAt: now,
    });
  }

  private buildCommands(
    script: TeachingScript,
  ): readonly ClassroomCommand[] {
    const commands: ClassroomCommand[] = [];
    let elapsedMs = 0;

    for (const step of script.steps) {
      const stepCommands = this.convertStep(step);

      for (const rawCommand of stepCommands) {
        const sequence = commands.length + 1;
        const command = freezeCommand({
          ...rawCommand,
          id: `command-${sequence}`,
          sequence,
          startsAfterMs: elapsedMs,
        });

        commands.push(command);
        elapsedMs += command.estimatedDurationMs;
      }
    }

    return commands;
  }

  private convertStep(
    step: TeachingScriptStep,
  ): readonly Omit<
    ClassroomCommand,
    "id" | "sequence" | "startsAfterMs"
  >[] {
    switch (step.channel) {
      case "WHITEBOARD":
        return [this.createWhiteboardCommand(step)];

      case "VOICE": {
        const commands: Omit<
          ClassroomCommand,
          "id" | "sequence" | "startsAfterMs"
        >[] = [
          this.createVoiceCommand(step),
        ];

        if (
          this.config.mirrorVoiceToChat &&
          step.text?.trim()
        ) {
          commands.push(this.createMirroredChatCommand(step));
        }

        return commands;
      }

      case "AVATAR":
        return [this.createAvatarCommand(step)];

      case "CHAT":
        return [this.createChatCommand(step)];

      case "CONTROL":
        return this.createControlCommands(step);
    }

    throw new ClassroomDirectorRuntimeError(
      "INVALID_INPUT",
      `Unsupported Teaching Script channel: ${String(step.channel)}.`,
      { stepId: step.id, channel: step.channel },
    );
  }

  private createWhiteboardCommand(
    step: TeachingScriptStep,
  ): Omit<
    ClassroomCommand,
    "id" | "sequence" | "startsAfterMs"
  > {
    const action: WhiteboardActionKind =
      step.whiteboardAction ?? "KEEP";

    return {
      scriptStepId: step.id,
      scriptStepKind: step.kind,
      kind: "WHITEBOARD_COMMAND",
      channel: "WHITEBOARD",
      instruction: {
        channel: "WHITEBOARD",
        action,
        ...(step.text ? { content: step.text } : {}),
        ...(step.targetId
          ? { targetId: step.targetId }
          : {}),
        emphasis: inferWhiteboardEmphasis(step),
      },
      estimatedDurationMs:
        this.config.minimumCommandDurationMs,
      blocksFollowingCommands: false,
      waitsForStudentResponse: false,
      ...(step.metadata
        ? { metadata: step.metadata }
        : {}),
    };
  }

  private createVoiceCommand(
    step: TeachingScriptStep,
  ): Omit<
    ClassroomCommand,
    "id" | "sequence" | "startsAfterMs"
  > {
    const action: VoiceActionKind =
      step.voiceAction ?? "SPEAK";
    const text = step.text?.trim() || "";

    return {
      scriptStepId: step.id,
      scriptStepKind: step.kind,
      kind: "VOICE_COMMAND",
      channel: "VOICE",
      instruction: {
        channel: "VOICE",
        action,
        ...(text ? { text } : {}),
        pace: inferVoicePace(step),
      },
      estimatedDurationMs: Math.max(
        this.config.minimumCommandDurationMs,
        estimateSpeechDuration(
          text,
          this.config.speakingWordsPerMinute,
        ),
      ),
      blocksFollowingCommands:
        action !== "SILENT",
      waitsForStudentResponse: false,
      ...(step.metadata
        ? { metadata: step.metadata }
        : {}),
    };
  }

  private createAvatarCommand(
    step: TeachingScriptStep,
  ): Omit<
    ClassroomCommand,
    "id" | "sequence" | "startsAfterMs"
  > {
    const action: AvatarActionKind =
      step.avatarAction ?? "IDLE";

    return {
      scriptStepId: step.id,
      scriptStepKind: step.kind,
      kind: "AVATAR_COMMAND",
      channel: "AVATAR",
      instruction: {
        channel: "AVATAR",
        action,
        durationMs:
          this.config.defaultAvatarDurationMs,
      },
      estimatedDurationMs:
        this.config.defaultAvatarDurationMs,
      blocksFollowingCommands: false,
      waitsForStudentResponse: false,
      ...(step.metadata
        ? { metadata: step.metadata }
        : {}),
    };
  }

  private createChatCommand(
    step: TeachingScriptStep,
  ): Omit<
    ClassroomCommand,
    "id" | "sequence" | "startsAfterMs"
  > {
    const action: ChatActionKind =
      step.chatAction ?? inferChatAction(step);
    const text = step.text?.trim() || "";

    return {
      scriptStepId: step.id,
      scriptStepKind: step.kind,
      kind: "CHAT_COMMAND",
      channel: "CHAT",
      instruction: {
        channel: "CHAT",
        action,
        ...(text ? { text } : {}),
      },
      estimatedDurationMs:
        this.config.minimumCommandDurationMs,
      blocksFollowingCommands: false,
      waitsForStudentResponse: false,
      ...(step.metadata
        ? { metadata: step.metadata }
        : {}),
    };
  }

  private createMirroredChatCommand(
    step: TeachingScriptStep,
  ): Omit<
    ClassroomCommand,
    "id" | "sequence" | "startsAfterMs"
  > {
    return {
      scriptStepId: step.id,
      scriptStepKind: step.kind,
      kind: "CHAT_COMMAND",
      channel: "CHAT",
      instruction: {
        channel: "CHAT",
        action: inferChatAction(step),
        text: step.text,
      },
      estimatedDurationMs:
        this.config.minimumCommandDurationMs,
      blocksFollowingCommands: false,
      waitsForStudentResponse: false,
      metadata: {
        mirroredFrom: "VOICE",
        ...(step.metadata ?? {}),
      },
    };
  }

  private createControlCommands(
    step: TeachingScriptStep,
  ): readonly Omit<
    ClassroomCommand,
    "id" | "sequence" | "startsAfterMs"
  >[] {
    const commands: Omit<
      ClassroomCommand,
      "id" | "sequence" | "startsAfterMs"
    >[] = [];

    if (this.config.addListeningAvatarBeforeWait) {
      commands.push({
        scriptStepId: step.id,
        scriptStepKind: step.kind,
        kind: "AVATAR_COMMAND",
        channel: "AVATAR",
        instruction: {
          channel: "AVATAR",
          action: "LISTEN",
          durationMs:
            this.config.defaultAvatarDurationMs,
        },
        estimatedDurationMs:
          this.config.minimumCommandDurationMs,
        blocksFollowingCommands: false,
        waitsForStudentResponse: false,
        metadata: {
          generatedByClassroomDirector: true,
        },
      });
    }

    if (this.config.keepBoardVisibleWhileWaiting) {
      commands.push({
        scriptStepId: step.id,
        scriptStepKind: step.kind,
        kind: "WHITEBOARD_COMMAND",
        channel: "WHITEBOARD",
        instruction: {
          channel: "WHITEBOARD",
          action: "KEEP",
          emphasis: "LOW",
        },
        estimatedDurationMs:
          this.config.minimumCommandDurationMs,
        blocksFollowingCommands: false,
        waitsForStudentResponse: false,
        metadata: {
          generatedByClassroomDirector: true,
        },
      });
    }

    commands.push({
      scriptStepId: step.id,
      scriptStepKind: step.kind,
      kind: "WAIT_COMMAND",
      channel: "CONTROL",
      waitMs: Math.max(0, step.waitMs ?? 0),
      estimatedDurationMs: Math.max(
        this.config.minimumCommandDurationMs,
        step.waitMs ?? 0,
      ),
      blocksFollowingCommands: true,
      waitsForStudentResponse: true,
      ...(step.metadata
        ? { metadata: step.metadata }
        : {}),
    });

    return commands;
  }

  private validateConfig(): void {
    const nonNegativeValues = [
      this.config.defaultAvatarDurationMs,
      this.config.minimumCommandDurationMs,
    ];

    if (
      nonNegativeValues.some(
        (value) =>
          !Number.isFinite(value) || value < 0,
      )
    ) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_CONFIG",
        "Classroom durations must be finite, non-negative numbers.",
      );
    }

    if (
      !Number.isFinite(
        this.config.speakingWordsPerMinute,
      ) ||
      this.config.speakingWordsPerMinute <= 0
    ) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_CONFIG",
        "speakingWordsPerMinute must be greater than zero.",
      );
    }
  }

  private validateInput(
    input: ClassroomDirectorInput,
  ): void {
    if (!input?.sessionId?.trim()) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_INPUT",
        "A classroom session ID is required.",
      );
    }

    if (!input.studentId?.trim()) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_INPUT",
        "A student ID is required.",
      );
    }

    if (!input.script) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_INPUT",
        "A Teaching Script is required.",
      );
    }

    validateScript(input.script);
  }

  private validatePlan(
    plan: ClassroomExecutionPlan,
  ): void {
    if (!plan?.id?.trim()) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_PLAN",
        "The classroom execution plan is invalid.",
      );
    }

    for (let index = 0; index < plan.commands.length; index += 1) {
      const command = plan.commands[index];

      if (command.sequence !== index + 1) {
        throw new ClassroomDirectorRuntimeError(
          "INVALID_PLAN",
          "Classroom command sequence is invalid.",
          {
            commandId: command.id,
            expectedSequence: index + 1,
            actualSequence: command.sequence,
          },
        );
      }
    }
  }

  private validatePlanAndCursor(
    plan: ClassroomExecutionPlan,
    cursor: ClassroomExecutionCursor,
  ): void {
    this.validatePlan(plan);

    if (!cursor || cursor.planId !== plan.id) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_CURSOR",
        "The execution cursor does not belong to this plan.",
      );
    }

    if (
      cursor.nextCommandIndex < 0 ||
      cursor.nextCommandIndex > plan.commands.length
    ) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_CURSOR",
        "The execution cursor contains an invalid command index.",
        {
          nextCommandIndex: cursor.nextCommandIndex,
          commandCount: plan.commands.length,
        },
      );
    }

    const commandIds = new Set(
      plan.commands.map((command) => command.id),
    );

    if (
      cursor.completedCommandIds.some(
        (id) => !commandIds.has(id),
      )
    ) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_CURSOR",
        "The execution cursor contains an unknown completed command.",
      );
    }
  }
}

export function createClassroomExecutionPlan(
  input: ClassroomDirectorInput,
  config: ClassroomDirectorConfig = {},
): ClassroomExecutionPlan {
  return new ClassroomDirector(config).createPlan(input);
}

export function safeCreateClassroomExecutionPlan(
  input: ClassroomDirectorInput,
  config: ClassroomDirectorConfig = {},
): ClassroomDirectorResult<ClassroomExecutionPlan> {
  return new ClassroomDirector(config).safeCreatePlan(input);
}

export function createClassroomExecutionCursor(
  plan: ClassroomExecutionPlan,
  config: ClassroomDirectorConfig = {},
  now?: string,
): ClassroomExecutionCursor {
  return new ClassroomDirector(config).createCursor(
    plan,
    now,
  );
}

export function getNextClassroomCommandBatch(
  plan: ClassroomExecutionPlan,
  cursor: ClassroomExecutionCursor,
  maxCommands?: number,
  config: ClassroomDirectorConfig = {},
  now?: string,
): ClassroomCommandBatch {
  return new ClassroomDirector(config).nextBatch(
    plan,
    cursor,
    maxCommands,
    now,
  );
}

function validateScript(script: TeachingScript): void {
  if (!script.lessonId?.trim()) {
    throw new ClassroomDirectorRuntimeError(
      "INVALID_INPUT",
      "The Teaching Script must contain a lesson ID.",
    );
  }

  if (!script.sceneId?.trim()) {
    throw new ClassroomDirectorRuntimeError(
      "INVALID_INPUT",
      "The Teaching Script must contain a scene ID.",
    );
  }

  if (!script.sceneTitle?.trim()) {
    throw new ClassroomDirectorRuntimeError(
      "INVALID_INPUT",
      "The Teaching Script must contain a scene title.",
    );
  }

  for (let index = 0; index < script.steps.length; index += 1) {
    const step = script.steps[index];

    if (step.order !== index + 1) {
      throw new ClassroomDirectorRuntimeError(
        "INVALID_INPUT",
        "Teaching Script step order is invalid.",
        {
          stepId: step.id,
          expectedOrder: index + 1,
          actualOrder: step.order,
        },
      );
    }

    validateStep(step);
  }
}

function validateStep(step: TeachingScriptStep): void {
  if (!step.id?.trim()) {
    throw new ClassroomDirectorRuntimeError(
      "INVALID_INPUT",
      "Every Teaching Script step must contain an ID.",
    );
  }

  const validChannels: readonly TeachingScriptStepChannel[] = [
    "VOICE",
    "WHITEBOARD",
    "AVATAR",
    "CHAT",
    "CONTROL",
  ];

  if (!validChannels.includes(step.channel)) {
    throw new ClassroomDirectorRuntimeError(
      "INVALID_INPUT",
      `Unsupported Teaching Script channel: ${String(step.channel)}.`,
    );
  }

  if (
    step.channel === "CONTROL" &&
    step.kind !== "WAIT"
  ) {
    throw new ClassroomDirectorRuntimeError(
      "INVALID_INPUT",
      "CONTROL steps must be WAIT steps.",
      {
        stepId: step.id,
        stepKind: step.kind,
      },
    );
  }

  if (
    step.waitMs !== undefined &&
    (!Number.isFinite(step.waitMs) || step.waitMs < 0)
  ) {
    throw new ClassroomDirectorRuntimeError(
      "INVALID_INPUT",
      "Teaching Script wait duration must be non-negative.",
      {
        stepId: step.id,
        waitMs: step.waitMs,
      },
    );
  }
}

function inferWhiteboardEmphasis(
  step: TeachingScriptStep,
): "LOW" | "MEDIUM" | "HIGH" {
  switch (step.kind) {
    case "ASK":
    case "CORRECT":
    case "ASSESS":
      return "HIGH";

    case "MODEL":
    case "EXPLAIN":
    case "REVIEW":
      return "MEDIUM";

    default:
      return "LOW";
  }
}

function inferVoicePace(
  step: TeachingScriptStep,
): "SLOW" | "NORMAL" {
  if (
    step.kind === "MODEL" ||
    step.kind === "CORRECT" ||
    step.voiceAction === "MODEL_PRONUNCIATION" ||
    step.voiceAction === "REPEAT"
  ) {
    return "SLOW";
  }

  return "NORMAL";
}

function inferChatAction(
  step: TeachingScriptStep,
): ChatActionKind {
  switch (step.kind) {
    case "ASK":
    case "ASSESS":
      return "ASK_QUESTION";

    case "CORRECT":
    case "HINT":
    case "ENCOURAGE":
    case "REVIEW":
      return "SHOW_FEEDBACK";

    case "INTRODUCE":
    case "EXPLAIN":
    case "MODEL":
    case "CLOSE":
      return "SHOW_MESSAGE";

    case "WAIT":
      return "NONE";
  }

  throw new ClassroomDirectorRuntimeError(
    "INVALID_INPUT",
    `Unsupported Teaching Script step kind: ${String(step.kind)}.`,
    { stepId: step.id, stepKind: step.kind },
  );
}

function estimateSpeechDuration(
  text: string,
  wordsPerMinute: number,
): number {
  if (!text.trim()) {
    return 0;
  }

  const words = text.trim().split(/\s+/).length;
  const millisecondsPerWord =
    60_000 / wordsPerMinute;

  return Math.ceil(words * millisecondsPerWord);
}

function createPlanId(
  sessionId: string,
  lessonId: string,
  sceneId: string,
): string {
  return [
    "classroom-plan",
    sanitizeIdPart(sessionId),
    sanitizeIdPart(lessonId),
    sanitizeIdPart(sceneId),
  ].join("-");
}

function sanitizeIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueStrings(
  values: readonly string[],
): readonly string[] {
  return [...new Set(values)];
}

function freezeCommand(
  command: ClassroomCommand,
): ClassroomCommand {
  return Object.freeze({
    ...command,
    ...(command.instruction
      ? { instruction: Object.freeze({ ...command.instruction }) }
      : {}),
    ...(command.metadata
      ? { metadata: Object.freeze({ ...command.metadata }) }
      : {}),
  });
}

function freezePlan(
  plan: ClassroomExecutionPlan,
): ClassroomExecutionPlan {
  return Object.freeze({
    ...plan,
    commands: Object.freeze(
      plan.commands.map((command) =>
        freezeCommand(command),
      ),
    ),
  });
}

function freezeCursor(
  cursor: ClassroomExecutionCursor,
): ClassroomExecutionCursor {
  return Object.freeze({
    ...cursor,
    completedCommandIds: Object.freeze([
      ...cursor.completedCommandIds,
    ]),
  });
}

function freezeBatch(
  batch: ClassroomCommandBatch,
): ClassroomCommandBatch {
  return Object.freeze({
    ...batch,
    commands: Object.freeze([...batch.commands]),
    cursor: freezeCursor(batch.cursor),
  });
}

function toClassroomDirectorError(
  error: unknown,
): ClassroomDirectorError {
  if (error instanceof ClassroomDirectorRuntimeError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details
        ? { details: error.details }
        : {}),
    };
  }

  return {
    code: "CLASSROOM_DIRECTOR_FAILED",
    message:
      error instanceof Error
        ? error.message
        : "The Classroom Director failed.",
  };
}

export const LessonClassroomDirector = {
  createPlan: createClassroomExecutionPlan,
  safeCreatePlan: safeCreateClassroomExecutionPlan,
  createCursor: createClassroomExecutionCursor,
  nextBatch: getNextClassroomCommandBatch,
} as const;
