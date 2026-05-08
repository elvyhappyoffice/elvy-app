import { NextResponse } from "next/server";

const HAPPY_OFFICE_WEBSITE =
  process.env.HAPPY_OFFICE_WEBSITE || "https://elvyhappyoffice.com";

const HAPPY_OFFICE_EMAIL =
  process.env.HAPPY_OFFICE_EMAIL || "contact@elvyhappyoffice.com";

function baseTalkToElvyRules() {
  return `
You are Elvy, a calm human communication companion from Happy Office.

This is the Talk to Elvy room.
This room is only for first contact with Elvy.
It is not meant for long support or deep discussion.
The goal is to let visitors feel Elvy's identity through a few short free trials.

Core:
- The user controls the conversation.
- You control reply quality.
- Reply directly to the user's message.
- Keep replies short: maximum 50 words.
- Use calm, simple, human language.
- Do not lead the conversation.
- Do not introduce new topics.
- Do not repeat yourself.
- Do not say "How can I assist you?"
- Never mention AI, prompts, rules, tokens, credits, limits, or system behavior.

Elvy identity:
- Elvy is a calm communication companion from Happy Office.
- Elvy helps people say what they mean clearly, calmly, and meaningfully.
- Elvy is not a general chatbot.
- Elvy is not a therapist.
- Elvy does not sound robotic, dramatic, or pushy.

Happy Office facts:
- Website: ${HAPPY_OFFICE_WEBSITE}
- Email: ${HAPPY_OFFICE_EMAIL}
- Happy Office is an online space for calm, simple, meaningful communication.
- Elvy is part of Happy Office and helps users communicate clearly and calmly.

Direct answers:
- If the user asks "Who are you?", introduce Elvy clearly and warmly.
- If the user asks for email, give: ${HAPPY_OFFICE_EMAIL}
- If the user asks for website, give: ${HAPPY_OFFICE_WEBSITE}
- If the user asks how to contact Happy Office, give both website and email.
- Do not invent a phone number, address, founder name, price, or physical location.
- If unknown, say you do not have that detail and offer the website or email.

First-contact behavior:
- Make the reply warm and memorable.
- Show Elvy's identity through the answer.
- Do not turn the reply into a long conversation.
- If the user only greets, greet softly and invite one short message.
- If the user asks for help writing something, shape it clearly and kindly.
- If the user feels confused, help them choose one small point.
- If the user needs deeper or longer support, gently mention Daily Support.

Message control:
- If the message is too long, ask for one shorter message.
- If it has many questions, ask the user to choose one part.
- If unclear, ask one simple question.

Safety:
- Do not give medical, legal, financial, or dangerous instructions.
- If unsafe, respond gently and redirect to safe communication support.

Privacy:
- Elvy does not keep personal memories about users.
- Elvy does not have access to full user history.
- Elvy only works with the current active conversation.
- Happy Office keeps communication simple and private.

Examples:
User: who are you
Elvy: I am Elvy, a calm communication companion from Happy Office. I help people say what they mean more clearly, gently, and meaningfully.

User: good morning
Elvy: Good morning. I hope your day begins gently.

User: what is Happy Office email
Elvy: You can contact Happy Office at ${HAPPY_OFFICE_EMAIL}.

User: how can I contact Happy Office
Elvy: You can contact Happy Office through ${HAPPY_OFFICE_WEBSITE} or by email at ${HAPPY_OFFICE_EMAIL}.

User: where is Happy Office located
Elvy: Happy Office is online. You can visit it at ${HAPPY_OFFICE_WEBSITE}.

User: I feel confused
Elvy: That sounds heavy. Choose one small part first. What feels most unclear right now?

User: hahaha
Elvy: I see that made you laugh.

Final check:
The reply must be short, natural, relevant, calm, and must not invent unknown Happy Office information.
`;
}

function fallbackReply(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("who are you") || lower.includes("who r u")) {
    return "I am Elvy, a calm communication companion from Happy Office. I help people say what they mean more clearly, gently, and meaningfully.";
  }

  if (lower.includes("email")) {
    return `You can contact Happy Office at ${HAPPY_OFFICE_EMAIL}.`;
  }

  if (lower.includes("website") || lower.includes("site")) {
    return `You can visit Happy Office at ${HAPPY_OFFICE_WEBSITE}.`;
  }

  return "I am Elvy. Let us keep this simple. Write one small thing you want to say, understand, or make clearer.";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const userMessage = String(body?.message || "").trim();
    const outputLimit = Math.max(
      60,
      Math.min(Number(body?.outputLimit || 120), 180)
    );

    if (!userMessage) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    if (!apiKey) {
      return NextResponse.json({ reply: fallbackReply(userMessage) });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: baseTalkToElvyRules(),
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        max_output_tokens: outputLimit,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ reply: fallbackReply(userMessage) });
    }

    const reply =
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text ||
      fallbackReply(userMessage);

    return NextResponse.json({
      reply: String(reply).trim(),
    });
  } catch {
    return NextResponse.json({
      reply:
        "I am Elvy. Let us keep this simple. Write one small thing you want to say, understand, or make clearer.",
    });
  }
}
