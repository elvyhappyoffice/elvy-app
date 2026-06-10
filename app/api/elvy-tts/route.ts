import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return new Response("Missing text", { status: 400 });
  }

  const audio = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "ash",
    input: text,
  });

  const buffer = Buffer.from(await audio.arrayBuffer());

  return new Response(buffer, {
    headers: {
      "Content-Type": "audio/mpeg",
    },
  });
}