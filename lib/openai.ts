import OpenAI from "openai";

let cachedOpenAI: OpenAI | null = null;

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  if (!cachedOpenAI) {
    cachedOpenAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return cachedOpenAI;
}

export const AI_MODELS = {
  chat: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  curriculum: process.env.OPENAI_CURRICULUM_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
  lesson: process.env.OPENAI_LESSON_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
};

type AIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type AITextOptions = {
  model?: string;
  instructions: string;
  input: AIMessage[] | string;
  maxOutputTokens?: number;
};

export async function generateAIText({
  model,
  instructions,
  input,
  maxOutputTokens = 500,
}: AITextOptions) {
  const openai = getOpenAIClient();

  const response = await openai.responses.create({
    model: model || AI_MODELS.chat,
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
  });

  return {
    text: response.output_text?.trim() || "",
    usage: response.usage || null,
    raw: response,
  };
}

export const AI = {
  client: getOpenAIClient,

  chat(options: Omit<AITextOptions, "model"> & { model?: string }) {
    return generateAIText({
      ...options,
      model: options.model || AI_MODELS.chat,
    });
  },

  curriculum(options: Omit<AITextOptions, "model"> & { model?: string }) {
    return generateAIText({
      ...options,
      model: options.model || AI_MODELS.curriculum,
      maxOutputTokens: options.maxOutputTokens || 2500,
    });
  },

  lesson(options: Omit<AITextOptions, "model"> & { model?: string }) {
    return generateAIText({
      ...options,
      model: options.model || AI_MODELS.lesson,
      maxOutputTokens: options.maxOutputTokens || 1800,
    });
  },
};
