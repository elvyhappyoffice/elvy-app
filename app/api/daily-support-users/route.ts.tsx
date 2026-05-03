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

  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

async function getElvyAIReply(user: SupportUser, userMessage: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return "Elvy is not connected to AI yet. Please contact Happy Office support.";
  }

  const prompt = `
You are Elvy, the calm communication companion of Happy Office.

Core identity:
- Calm, simple, human, clear, meaningful.
- You help with daily communication, reminders, routines, organization, and gentle support.
- You are not a doctor, therapist, lawyer, or financial advisor.
- Never present yourself as a medical professional.
- If the user asks about health, symptoms, treatment, or medicine, give only general supportive wording and tell them to consult a qualified professional.
- Keep replies short, warm, and practical.
- Do not sound like a machine.
- Do not mention AI.

User name: ${user.name}
User code: ${user.code}

User message:
${userMessage}
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
      max_output_tokens: 220,
    }),
  });

  if (!res.ok) {
    return "Elvy could not prepare a reply at this moment. Please try again later.";
  }

  const data = await res.json();

  return (
    data.output_text ||
    data.output?.[0]?.content?.[0]?.text ||
    "Elvy is here with you. Please send one short clear message."
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
      user = users.find(
        (u) => u.contactValue.trim().toLowerCase() === username
      );

      if (user) {
        user.telegramChatId = chatId;
      }
    }

    if (!user) {
      await sendTelegramMessage(
        chatId,
        "Welcome to Happy Office. Please register first from the Daily Support room, then generate your code."
      );
      return NextResponse.json({ ok: true });
    }

    if (user.status === "Blocked" || user.status === "Suspended") {
      await sendTelegramMessage(
        chatId,
        "Your access is not active at the moment. Please contact Happy Office support."
      );
      return NextResponse.json({ ok: true });
    }

    if (user.status !== "Active") {
      await sendTelegramMessage(
        chatId,
        "Your Elvy support is not active yet. Please complete activation with the Happy Office admin."
      );
      return NextResponse.json({ ok: true });
    }

    if (user.repliesUsed >= user.repliesLimit) {
      await sendTelegramMessage(
        chatId,
        "Your Elvy replies are finished. Please contact Happy Office support to renew your access."
      );
      return NextResponse.json({ ok: true });
    }
if (!user) {
  user = {
    code: "TEST",
    name: "Test User",
    contactMethod: "telegram",
    contactValue: username || "unknown",
    status: "Active",
    repliesLimit: 500,
    repliesUsed: 0,
    adminMessages: [],
    userMessages: [],
    telegramChatId: chatId,
  };

  users.push(user);
  saveUsers(users);
}
    }

    const elvyReply = await getElvyAIReply(user, text);

    user.userMessages = [...(user.userMessages || []), text];
    user.adminMessages = [...(user.adminMessages || []), elvyReply];
    user.repliesUsed = user.repliesUsed + 1;

    saveUsers(users);

    await sendTelegramMessage(chatId, elvyReply);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}