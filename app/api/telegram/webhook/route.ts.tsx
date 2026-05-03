import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

type SupportUser = {
  code: string;
  name: string;
  contactMethod: string;
  contactValue: string;
  status: "Pending" | "Setup Sent" | "In Chat" | "Active" | "Suspended" | "Blocked";
  repliesLimit: number;
  repliesUsed: number;
  adminMessages: string[];
  userMessages: string[];
  telegramChatId?: string;
  memory?: any;
};

const DATA_FILE = path.join(process.cwd(), "data", "dailySupportUsers.json");

function readUsers(): SupportUser[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveUsers(users: SupportUser[]) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN");

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function getElvyAIReply(user: SupportUser, userMessage: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return "Elvy is here. Please contact Happy Office support for activation.";
  }

const prompt = `
You are Elvy.

Identity:
A calm human communication companion from Happy Office.
Never mention AI. Never call yourself an assistant or chatbot.

Purpose:
Help the user communicate, remember, organize, or calm one situation.

Reply method:
1. Detect the user's need silently.
2. Answer only that need.
3. Give one clear next step when useful.

Voice:
calm, human, simple, steady, respectful.

Limits:
- 1–3 short sentences
- Max 40 words
- One idea only
- One question only if needed
- No repeated greetings
- No “How can I assist you?”
- No medical, legal, or financial advice

If asked who you are:
"I am Elvy. I help you keep things clear and move forward one step at a time."

User: ${user.name}
Message: ${userMessage}
`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: prompt,
      max_output_tokens: 120,
    }),
  });

  if (!res.ok) {
    return "I’m here. Please try again in a moment.";
  }

  const data = await res.json();

  return (
    data.output_text ||
    data.output?.[0]?.content?.[0]?.text ||
    "I’m here with you. Say one clear thing."
  );
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const message = update.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = String(message.text).trim();

    const username = message.from?.username
      ? `@${String(message.from.username).toLowerCase()}`
      : "";

    const users = readUsers();

    let user = users.find((u) => u.telegramChatId === chatId);
if (!user && username) {
  const normalizedUsername = username.trim().toLowerCase();

  user = users.find(
    (u) => u.contactValue.trim().toLowerCase() === normalizedUsername
  );

  if (user) {
    user.telegramChatId = chatId;

    // Optional: mark as "In Chat" automatically
    if (user.status === "Setup Sent") {
      user.status = "In Chat";
    }

    saveUsers(users);

    await sendTelegramMessage(
      chatId,
      `Hello ${user.name}. Your connection is ready.`
    );
  }
}

    if (!user) {
      await sendTelegramMessage(
        chatId,
        "Please register first from the Daily Support room, then generate your code."
      );
      return NextResponse.json({ ok: true });
    }

    if (user.status !== "Active") {
      await sendTelegramMessage(
        chatId,
        "Your request is received. Please wait for activation from the Happy Office team."
      );
      return NextResponse.json({ ok: true });
    }

    if (user.repliesUsed >= user.repliesLimit) {
      await sendTelegramMessage(
        chatId,
        "Your replies are finished. Please contact support."
      );
      return NextResponse.json({ ok: true });
    }

    const reply = await getElvyAIReply(user, text);

    user.userMessages.push(text);
    user.adminMessages.push(reply);
    user.repliesUsed += 1;

    saveUsers(users);

    await sendTelegramMessage(chatId, reply);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}