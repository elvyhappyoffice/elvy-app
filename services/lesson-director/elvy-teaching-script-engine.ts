/**
 * Elvy Lesson Director — Teaching Script Engine
 *
 * Converts a Lesson Director decision and Strategy Engine recommendation
 * into a structured, deterministic teaching script.
 *
 * This engine does not:
 * - call OpenAI or any external model,
 * - access Supabase or other storage,
 * - decide lesson progression,
 * - render UI,
 * - play audio,
 * - animate Elvy directly.
 */

import {
  type AvatarActionKind,
  type ChatActionKind,
  type LessonDirectorDecision,
  type LessonSceneDefinition,
  type StudentLearningSignal,
  type VoiceActionKind,
  type WhiteboardActionKind,
} from "./types";

import {
  type CorrectionStyle,
  type InteractionPattern,
  type ScaffoldingMode,
  type StrategyRecommendation,
} from "./strategy-engine";

export type TeachingScriptStepKind =
  | "INTRODUCE"
  | "EXPLAIN"
  | "MODEL"
  | "ASK"
  | "WAIT"
  | "HINT"
  | "CORRECT"
  | "ENCOURAGE"
  | "REVIEW"
  | "ASSESS"
  | "CLOSE";

export type TeachingScriptStepChannel =
  | "VOICE"
  | "WHITEBOARD"
  | "AVATAR"
  | "CHAT"
  | "CONTROL";

export interface TeachingScriptEngineConfig {
  readonly defaultWaitMs?: number;
  readonly shortWaitMs?: number;
  readonly longWaitMs?: number;
  readonly includeChatMirror?: boolean;
  readonly includeAvatarActions?: boolean;
  readonly includeWhiteboardActions?: boolean;
}

export interface TeachingScriptInput {
  readonly lessonId: string;
  readonly scene: LessonSceneDefinition;
  readonly decision: LessonDirectorDecision;
  readonly strategy: StrategyRecommendation;
  readonly studentSignal: StudentLearningSignal;
  readonly lessonTitle?: string;
  readonly sceneContent?: string;
  readonly targetLanguage?: string;
  readonly learnerLanguage?: string;
}

export interface TeachingScriptStep {
  readonly id: string;
  readonly order: number;
  readonly kind: TeachingScriptStepKind;
  readonly channel: TeachingScriptStepChannel;
  readonly text?: string;
  readonly waitMs?: number;
  readonly whiteboardAction?: WhiteboardActionKind;
  readonly voiceAction?: VoiceActionKind;
  readonly avatarAction?: AvatarActionKind;
  readonly chatAction?: ChatActionKind;
  readonly targetId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface TeachingScript {
  readonly lessonId: string;
  readonly sceneId: string;
  readonly sceneTitle: string;
  readonly strategy: StrategyRecommendation["strategy"];
  readonly interactionPattern: InteractionPattern;
  readonly steps: readonly TeachingScriptStep[];
  readonly waitsForStudentResponse: boolean;
  readonly estimatedDurationMs: number;
  readonly reason: string;
}

export interface TeachingScriptEngineError {
  readonly code:
    | "INVALID_INPUT"
    | "INVALID_CONFIG"
    | "SCRIPT_GENERATION_FAILED";
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type TeachingScriptEngineResult =
  | {
      readonly ok: true;
      readonly data: TeachingScript;
    }
  | {
      readonly ok: false;
      readonly error: TeachingScriptEngineError;
    };

const DEFAULT_CONFIG: Required<TeachingScriptEngineConfig> = {
  defaultWaitMs: 6000,
  shortWaitMs: 3000,
  longWaitMs: 10000,
  includeChatMirror: true,
  includeAvatarActions: true,
  includeWhiteboardActions: true,
};

export class TeachingScriptEngineRuntimeError extends Error {
  readonly code: TeachingScriptEngineError["code"];
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: TeachingScriptEngineError["code"],
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "TeachingScriptEngineRuntimeError";
    this.code = code;
    this.details = details;
  }
}

export class TeachingScriptEngine {
  private readonly config: Required<TeachingScriptEngineConfig>;

  constructor(config: TeachingScriptEngineConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.validateConfig();
  }

  generate(input: TeachingScriptInput): TeachingScript {
    this.validateInput(input);

    const builder = new ScriptBuilder();
    const context = createScriptContext(input);

    this.addOpening(builder, input, context);
    this.addInstruction(builder, input, context);
    this.addScaffolding(builder, input, context);
    this.addCorrection(builder, input, context);
    this.addInteraction(builder, input, context);
    this.addClosing(builder, input, context);

    const steps = builder.build();
    const waitsForStudentResponse = steps.some(
      (step) => step.kind === "WAIT",
    );

    return {
      lessonId: input.lessonId,
      sceneId: input.scene.id,
      sceneTitle: input.scene.title,
      strategy: input.strategy.strategy,
      interactionPattern: input.strategy.interactionPattern,
      steps,
      waitsForStudentResponse,
      estimatedDurationMs: estimateDuration(steps),
      reason:
        `The script applies ${input.strategy.strategy.toLowerCase()} ` +
        `through ${input.strategy.interactionPattern.toLowerCase()} ` +
        `for the current Director decision.`,
    };
  }

  safeGenerate(
    input: TeachingScriptInput,
  ): TeachingScriptEngineResult {
    try {
      return {
        ok: true,
        data: this.generate(input),
      };
    } catch (error) {
      return {
        ok: false,
        error: toTeachingScriptEngineError(error),
      };
    }
  }

  private addOpening(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    if (this.config.includeAvatarActions) {
      builder.add({
        kind: "INTRODUCE",
        channel: "AVATAR",
        avatarAction:
          input.decision.action === "COMPLETE_LESSON"
            ? "CELEBRATE"
            : input.decision.action === "ASSESS"
              ? "LISTEN"
              : "SMILE",
      });
    }

    if (
      input.decision.action === "START_LESSON" ||
      input.decision.action === "MOVE_TO_NEXT_SCENE"
    ) {
      const introduction = buildSceneIntroduction(input);

      builder.add({
        kind: "INTRODUCE",
        channel: "VOICE",
        voiceAction: "SPEAK",
        text: introduction,
      });

      if (this.config.includeChatMirror) {
        builder.add({
          kind: "INTRODUCE",
          channel: "CHAT",
          chatAction: "SHOW_MESSAGE",
          text: introduction,
        });
      }

      if (this.config.includeWhiteboardActions) {
        builder.add({
          kind: "INTRODUCE",
          channel: "WHITEBOARD",
          whiteboardAction: "SHOW_TITLE",
          text: input.scene.title,
          targetId: input.scene.id,
        });
      }

      return;
    }

    if (input.decision.action === "REVIEW") {
      const reviewText =
        "Let us review this carefully before we continue.";

      builder.add({
        kind: "REVIEW",
        channel: "VOICE",
        voiceAction: "SPEAK",
        text: reviewText,
      });

      if (this.config.includeWhiteboardActions) {
        builder.add({
          kind: "REVIEW",
          channel: "WHITEBOARD",
          whiteboardAction: "HIGHLIGHT",
          text: context.focusText,
          targetId: input.scene.id,
        });
      }

      return;
    }

    if (
      input.decision.action === "GIVE_SUPPORT" ||
      input.decision.action === "SIMPLIFY"
    ) {
      const supportText =
        input.decision.action === "SIMPLIFY"
          ? "Let us make this easier and work through it step by step."
          : "You are doing well. Here is a little help.";

      builder.add({
        kind: "ENCOURAGE",
        channel: "VOICE",
        voiceAction: "SPEAK",
        text: supportText,
      });

      if (this.config.includeAvatarActions) {
        builder.add({
          kind: "ENCOURAGE",
          channel: "AVATAR",
          avatarAction: "ENCOURAGE",
        });
      }
    }
  }

  private addInstruction(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    switch (input.strategy.interactionPattern) {
      case "TEACHER_MODEL":
        this.addTeacherModel(builder, input, context);
        break;

      case "QUESTION_AND_ANSWER":
        this.addQuestionAndAnswer(builder, input, context);
        break;

      case "GUIDED_PRACTICE":
        this.addGuidedPractice(builder, input, context);
        break;

      case "INDEPENDENT_RESPONSE":
        this.addIndependentResponse(builder, input, context);
        break;

      case "ROLE_PLAY":
        this.addRolePlay(builder, input, context);
        break;

      case "READ_AND_RESPOND":
        this.addReadAndRespond(builder, input, context);
        break;

      case "LISTEN_AND_RESPOND":
        this.addListenAndRespond(builder, input, context);
        break;

      case "WRITE_AND_REVISE":
        this.addWriteAndRevise(builder, input, context);
        break;
    }
  }

  private addTeacherModel(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    const modelText = buildModelText(input, context);

    builder.add({
      kind: "MODEL",
      channel: "VOICE",
      voiceAction:
        input.strategy.strategy === "PRONUNCIATION"
          ? "MODEL_PRONUNCIATION"
          : "SPEAK",
      text: modelText,
    });

    if (this.config.includeWhiteboardActions) {
      builder.add({
        kind: "MODEL",
        channel: "WHITEBOARD",
        whiteboardAction: "SHOW_EXAMPLE",
        text: context.focusText,
        targetId: input.scene.id,
      });
    }

    builder.add({
      kind: "ASK",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text: "Now try it with me.",
    });

    builder.add({
      kind: "WAIT",
      channel: "CONTROL",
      waitMs: this.config.defaultWaitMs,
    });
  }

  private addQuestionAndAnswer(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    const question = buildQuestion(input, context);

    if (this.config.includeWhiteboardActions) {
      builder.add({
        kind: "ASK",
        channel: "WHITEBOARD",
        whiteboardAction: "SHOW_QUESTION",
        text: question,
        targetId: input.scene.id,
      });
    }

    builder.add({
      kind: "ASK",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text: question,
    });

    if (this.config.includeChatMirror) {
      builder.add({
        kind: "ASK",
        channel: "CHAT",
        chatAction: "ASK_QUESTION",
        text: question,
      });
    }

    builder.add({
      kind: "WAIT",
      channel: "CONTROL",
      waitMs: selectWaitDuration(
        input.strategy.pace,
        this.config,
      ),
    });
  }

  private addGuidedPractice(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    const explanation =
      `We will practise ${context.focusText} together, one step at a time.`;

    builder.add({
      kind: "EXPLAIN",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text: explanation,
    });

    if (this.config.includeWhiteboardActions) {
      builder.add({
        kind: "EXPLAIN",
        channel: "WHITEBOARD",
        whiteboardAction: "SHOW_EXAMPLE",
        text: context.focusText,
        targetId: input.scene.id,
      });
    }

    builder.add({
      kind: "ASK",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text: buildQuestion(input, context),
    });

    builder.add({
      kind: "WAIT",
      channel: "CONTROL",
      waitMs: this.config.longWaitMs,
    });
  }

  private addIndependentResponse(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    const instruction =
      `Now complete this independently: ${context.focusText}.`;

    builder.add({
      kind: "ASK",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text: instruction,
    });

    if (this.config.includeChatMirror) {
      builder.add({
        kind: "ASK",
        channel: "CHAT",
        chatAction: "ASK_QUESTION",
        text: instruction,
      });
    }

    builder.add({
      kind: "WAIT",
      channel: "CONTROL",
      waitMs: this.config.longWaitMs,
    });
  }

  private addRolePlay(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    const prompt =
      `Let us use ${context.focusText} in a short role-play. I will begin, then you respond.`;

    builder.add({
      kind: "INTRODUCE",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text: prompt,
    });

    builder.add({
      kind: "MODEL",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text: buildRolePlayOpening(input),
    });

    builder.add({
      kind: "WAIT",
      channel: "CONTROL",
      waitMs: this.config.longWaitMs,
    });
  }

  private addReadAndRespond(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    if (this.config.includeWhiteboardActions) {
      builder.add({
        kind: "INTRODUCE",
        channel: "WHITEBOARD",
        whiteboardAction: "SHOW_TEXT",
        text: context.focusText,
        targetId: input.scene.id,
      });
    }

    builder.add({
      kind: "ASK",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text: "Read the text, then explain the main idea.",
    });

    builder.add({
      kind: "WAIT",
      channel: "CONTROL",
      waitMs: this.config.longWaitMs,
    });
  }

  private addListenAndRespond(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    const listeningText = buildModelText(input, context);

    builder.add({
      kind: "MODEL",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text: listeningText,
    });

    builder.add({
      kind: "ASK",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text: "What did you understand?",
    });

    builder.add({
      kind: "WAIT",
      channel: "CONTROL",
      waitMs: this.config.defaultWaitMs,
    });
  }

  private addWriteAndRevise(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    const instruction =
      `Write a short answer using ${context.focusText}. Then check it once before sending it.`;

    if (this.config.includeWhiteboardActions) {
      builder.add({
        kind: "ASK",
        channel: "WHITEBOARD",
        whiteboardAction: "SHOW_QUESTION",
        text: instruction,
        targetId: input.scene.id,
      });
    }

    builder.add({
      kind: "ASK",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text: instruction,
    });

    builder.add({
      kind: "WAIT",
      channel: "CONTROL",
      waitMs: this.config.longWaitMs,
    });
  }

  private addScaffolding(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    for (const mode of input.strategy.scaffolding) {
      switch (mode) {
        case "NONE":
          break;

        case "EXAMPLE":
          this.addExample(builder, input, context);
          break;

        case "HINT":
          this.addHint(builder, input, context);
          break;

        case "STEP_BY_STEP":
          this.addStepByStep(builder, input, context);
          break;

        case "MODEL_AND_REPEAT":
          this.addModelAndRepeat(builder, input, context);
          break;

        case "L1_SUPPORT":
          this.addL1Support(builder, input);
          break;
      }
    }
  }

  private addExample(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    const text = `Here is an example: ${context.exampleText}`;

    builder.add({
      kind: "MODEL",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text,
    });

    if (this.config.includeWhiteboardActions) {
      builder.add({
        kind: "MODEL",
        channel: "WHITEBOARD",
        whiteboardAction: "SHOW_EXAMPLE",
        text: context.exampleText,
        targetId: input.scene.id,
      });
    }
  }

  private addHint(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    const text =
      `Hint: focus on ${context.focusText}.`;

    builder.add({
      kind: "HINT",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text,
    });

    if (this.config.includeChatMirror) {
      builder.add({
        kind: "HINT",
        channel: "CHAT",
        chatAction: "SHOW_FEEDBACK",
        text,
      });
    }
  }

  private addStepByStep(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    const steps = buildStepByStepText(input, context);

    for (const text of steps) {
      builder.add({
        kind: "EXPLAIN",
        channel: "VOICE",
        voiceAction: "SPEAK",
        text,
      });
    }
  }

  private addModelAndRepeat(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    builder.add({
      kind: "MODEL",
      channel: "VOICE",
      voiceAction:
        input.strategy.strategy === "PRONUNCIATION"
          ? "MODEL_PRONUNCIATION"
          : "SPEAK",
      text: context.exampleText,
    });

    builder.add({
      kind: "ASK",
      channel: "VOICE",
      voiceAction: "REPEAT",
      text: "Repeat after me.",
    });

    builder.add({
      kind: "WAIT",
      channel: "CONTROL",
      waitMs: this.config.shortWaitMs,
    });
  }

  private addL1Support(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
  ): void {
    const learnerLanguage =
      input.learnerLanguage?.trim() || "your first language";

    builder.add({
      kind: "EXPLAIN",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text:
        `A brief explanation in ${learnerLanguage} may be used only to clarify the instruction.`,
      metadata: {
        supportMode: "L1",
        learnerLanguage,
      },
    });
  }

  private addCorrection(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    if (input.strategy.correctionStyle === "NONE") {
      return;
    }

    const correction = buildCorrectionText(
      input.strategy.correctionStyle,
      context,
    );

    builder.add({
      kind: "CORRECT",
      channel: "VOICE",
      voiceAction: "SPEAK",
      text: correction,
    });

    if (this.config.includeChatMirror) {
      builder.add({
        kind: "CORRECT",
        channel: "CHAT",
        chatAction: "SHOW_FEEDBACK",
        text: correction,
      });
    }
  }

  private addInteraction(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    if (input.strategy.increaseChallenge) {
      const challenge =
        `Challenge: use ${context.focusText} in a new example of your own.`;

      builder.add({
        kind: "ASK",
        channel: "VOICE",
        voiceAction: "SPEAK",
        text: challenge,
      });

      builder.add({
        kind: "WAIT",
        channel: "CONTROL",
        waitMs: this.config.longWaitMs,
      });
    }

    if (
      input.studentSignal.responseQuality === "CORRECT" ||
      input.studentSignal.responseQuality === "MASTERED"
    ) {
      builder.add({
        kind: "ENCOURAGE",
        channel: "VOICE",
        voiceAction: "SPEAK",
        text:
          input.studentSignal.responseQuality === "MASTERED"
            ? "Excellent. You are ready for a more challenging task."
            : "Good work. Let us continue.",
      });

      if (this.config.includeAvatarActions) {
        builder.add({
          kind: "ENCOURAGE",
          channel: "AVATAR",
          avatarAction:
            input.studentSignal.responseQuality === "MASTERED"
              ? "CELEBRATE"
              : "SMILE",
        });
      }
    }
  }

  private addClosing(
    builder: ScriptBuilder,
    input: TeachingScriptInput,
    context: ScriptContext,
  ): void {
    if (input.decision.finishLesson) {
      builder.add({
        kind: "CLOSE",
        channel: "VOICE",
        voiceAction: "SPEAK",
        text:
          "Well done. You have completed this lesson.",
      });

      if (this.config.includeWhiteboardActions) {
        builder.add({
          kind: "CLOSE",
          channel: "WHITEBOARD",
          whiteboardAction: "SHOW_FEEDBACK",
          text: "Lesson completed",
          targetId: input.scene.id,
        });
      }

      if (this.config.includeAvatarActions) {
        builder.add({
          kind: "CLOSE",
          channel: "AVATAR",
          avatarAction: "CELEBRATE",
        });
      }

      return;
    }

    if (
      input.decision.action === "ASSESS" &&
      !builder.hasWaitStep()
    ) {
      builder.add({
        kind: "ASSESS",
        channel: "VOICE",
        voiceAction: "SPEAK",
        text:
          `Show what you can do with ${context.focusText}.`,
      });

      builder.add({
        kind: "WAIT",
        channel: "CONTROL",
        waitMs: this.config.longWaitMs,
      });
    }
  }

  private validateConfig(): void {
    const values = [
      this.config.defaultWaitMs,
      this.config.shortWaitMs,
      this.config.longWaitMs,
    ];

    if (
      values.some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    ) {
      throw new TeachingScriptEngineRuntimeError(
        "INVALID_CONFIG",
        "Wait durations must be finite, non-negative numbers.",
      );
    }

    if (
      this.config.shortWaitMs >
      this.config.longWaitMs
    ) {
      throw new TeachingScriptEngineRuntimeError(
        "INVALID_CONFIG",
        "shortWaitMs cannot exceed longWaitMs.",
      );
    }
  }

  private validateInput(input: TeachingScriptInput): void {
    if (!input?.lessonId?.trim()) {
      throw new TeachingScriptEngineRuntimeError(
        "INVALID_INPUT",
        "A lesson ID is required.",
      );
    }

    if (!input.scene?.id?.trim()) {
      throw new TeachingScriptEngineRuntimeError(
        "INVALID_INPUT",
        "A valid scene is required.",
      );
    }

    if (!input.scene.title.trim()) {
      throw new TeachingScriptEngineRuntimeError(
        "INVALID_INPUT",
        "The scene must contain a title.",
      );
    }

    if (!input.decision) {
      throw new TeachingScriptEngineRuntimeError(
        "INVALID_INPUT",
        "A Lesson Director decision is required.",
      );
    }

    if (!input.strategy) {
      throw new TeachingScriptEngineRuntimeError(
        "INVALID_INPUT",
        "A strategy recommendation is required.",
      );
    }

    if (!input.studentSignal) {
      throw new TeachingScriptEngineRuntimeError(
        "INVALID_INPUT",
        "A student learning signal is required.",
      );
    }
  }
}

export function generateTeachingScript(
  input: TeachingScriptInput,
  config: TeachingScriptEngineConfig = {},
): TeachingScript {
  return new TeachingScriptEngine(config).generate(input);
}

export function safeGenerateTeachingScript(
  input: TeachingScriptInput,
  config: TeachingScriptEngineConfig = {},
): TeachingScriptEngineResult {
  return new TeachingScriptEngine(config).safeGenerate(input);
}

interface ScriptContext {
  readonly focusText: string;
  readonly exampleText: string;
}

class ScriptBuilder {
  private readonly steps: TeachingScriptStep[] = [];

  add(
    step: Omit<TeachingScriptStep, "id" | "order">,
  ): void {
    const order = this.steps.length + 1;

    this.steps.push({
      ...step,
      id: `step-${order}`,
      order,
    });
  }

  hasWaitStep(): boolean {
    return this.steps.some((step) => step.kind === "WAIT");
  }

  build(): readonly TeachingScriptStep[] {
    return this.steps.map((step) => ({ ...step }));
  }
}

function createScriptContext(
  input: TeachingScriptInput,
): ScriptContext {
  const focusText =
    input.sceneContent?.trim() ||
    input.scene.title.trim();

  return {
    focusText,
    exampleText: createExampleText(input, focusText),
  };
}

function createExampleText(
  input: TeachingScriptInput,
  focusText: string,
): string {
  switch (input.strategy.strategy) {
    case "VOCABULARY":
      return `Use the key word from "${focusText}" in a simple sentence.`;

    case "GRAMMAR":
      return `Build one correct sentence using the grammar from "${focusText}".`;

    case "LISTENING":
      return `Listen for the main idea in "${focusText}".`;

    case "SPEAKING":
      return `Say one clear sentence about "${focusText}".`;

    case "READING":
      return `Read "${focusText}" and identify its main idea.`;

    case "WRITING":
      return `Write one complete sentence about "${focusText}".`;

    case "PRONUNCIATION":
      return `Say "${focusText}" slowly and clearly.`;

    case "REVIEW":
      return `Recall the most important point from "${focusText}".`;

    case "ENCOURAGEMENT":
      return `Try one small step using "${focusText}".`;
  }
}

function buildSceneIntroduction(
  input: TeachingScriptInput,
): string {
  if (input.lessonTitle) {
    return `Now we will work on ${input.scene.title} in ${input.lessonTitle}.`;
  }

  return `Now we will work on ${input.scene.title}.`;
}

function buildModelText(
  input: TeachingScriptInput,
  context: ScriptContext,
): string {
  switch (input.strategy.strategy) {
    case "PRONUNCIATION":
      return `Listen carefully: ${context.focusText}.`;

    case "LISTENING":
      return `Listen carefully to this: ${context.focusText}.`;

    case "GRAMMAR":
      return `Watch how this pattern works: ${context.exampleText}`;

    default:
      return context.exampleText;
  }
}

function buildQuestion(
  input: TeachingScriptInput,
  context: ScriptContext,
): string {
  switch (input.strategy.strategy) {
    case "VOCABULARY":
      return `What does the key word in "${context.focusText}" mean?`;

    case "GRAMMAR":
      return `Can you make a correct sentence using this pattern?`;

    case "LISTENING":
      return `What is the main idea you heard?`;

    case "SPEAKING":
      return `Can you say one sentence about ${context.focusText}?`;

    case "READING":
      return `What is the main idea of the text?`;

    case "WRITING":
      return `Can you write one complete sentence about ${context.focusText}?`;

    case "PRONUNCIATION":
      return `Can you repeat ${context.focusText} clearly?`;

    case "REVIEW":
      return `What do you remember about ${context.focusText}?`;

    case "ENCOURAGEMENT":
      return `What is one thing you can try now?`;
  }
}

function buildRolePlayOpening(
  input: TeachingScriptInput,
): string {
  const targetLanguage =
    input.targetLanguage?.trim() || "the target language";

  return `I will start the conversation in ${targetLanguage}. Your turn comes next.`;
}

function buildStepByStepText(
  input: TeachingScriptInput,
  context: ScriptContext,
): readonly string[] {
  switch (input.strategy.strategy) {
    case "WRITING":
      return [
        "First, choose the main idea.",
        "Next, write one complete sentence.",
        "Finally, check the sentence before sending it.",
      ];

    case "READING":
      return [
        "First, read the text once.",
        "Next, find the key words.",
        "Finally, explain the main idea.",
      ];

    case "LISTENING":
      return [
        "First, listen without answering.",
        "Next, identify the important words.",
        "Finally, explain what you understood.",
      ];

    default:
      return [
        `First, look at ${context.focusText}.`,
        "Next, follow the example.",
        "Finally, try it independently.",
      ];
  }
}

function buildCorrectionText(
  style: CorrectionStyle,
  context: ScriptContext,
): string {
  switch (style) {
    case "NONE":
      return "";

    case "GENTLE_RECAST":
      return `Good attempt. A clearer way to say it is: ${context.exampleText}`;

    case "GUIDED_CORRECTION":
      return "Check the key word or pattern, then try again.";

    case "EXPLICIT_CORRECTION":
      return `That answer needs correction. Use this model: ${context.exampleText}`;

    case "SELF_CORRECTION":
      return "Read your answer once more and correct anything that does not sound right.";
  }
}

function selectWaitDuration(
  pace: StrategyRecommendation["pace"],
  config: Required<TeachingScriptEngineConfig>,
): number {
  return pace === "SLOW"
    ? config.longWaitMs
    : config.defaultWaitMs;
}

function estimateDuration(
  steps: readonly TeachingScriptStep[],
): number {
  return steps.reduce((total, step) => {
    if (step.waitMs !== undefined) {
      return total + step.waitMs;
    }

    if (step.text) {
      const words = step.text.trim().split(/\s+/).length;
      return total + Math.max(1200, words * 350);
    }

    return total + 500;
  }, 0);
}

function toTeachingScriptEngineError(
  error: unknown,
): TeachingScriptEngineError {
  if (error instanceof TeachingScriptEngineRuntimeError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  return {
    code: "SCRIPT_GENERATION_FAILED",
    message:
      error instanceof Error
        ? error.message
        : "The Teaching Script Engine failed.",
  };
}

export const LessonTeachingScriptEngine = {
  generate: generateTeachingScript,
  safeGenerate: safeGenerateTeachingScript,
} as const;
