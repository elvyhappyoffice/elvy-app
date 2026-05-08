import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

type SupportUser = {
  code: string;
  name: string;
  ageGroup?: string;
  helpType?: string;
  contactMethod: string;
  contactValue: string;
  status:
    | "Visitor"
    | "Pending"
    | "Setup Sent"
    | "In Chat"
    | "Active"
    | "Suspended"
    | "Blocked";
  repliesLimit: number;
  repliesUsed: number;
  adminMessages: string[];
  userMessages: string[];
  telegramChatId?: string;
  memory?: any;

  paymentNoticeSent?: boolean;
  paid?: boolean;
  paymentStatus?: "Unpaid" | "Pending" | "Paid" | "Failed";
  paymentMethod?: "PayPal" | "Skrill";
  paymentReference?: string;
  paidAt?: string;
};

type SupabaseUserRow = {
  id?: number;
  code?: string | null;
  name?: string | null;
  telegram_username?: string | null;
  telegram_id?: string | null;
  selected_topic?: string | null;
  credits?: number | null;
  payment_status?: string | null;
  founder_mode?: boolean | null;
  created_at?: string | null;
};

type SupabaseMessageRow = {
  id?: number;
  telegram_id?: string | null;
  role?: string | null;
  message?: string | null;
  created_at?: string | null;
};

const DATA_FILE = path.join(process.cwd(), "data", "dailySupportUsers.json");
const HAPPY_OFFICE_WEBSITE = "www.elvyhappyoffice.com";
const HAPPY_OFFICE_EMAIL = "elvy.happyoffice@gmail.com";

// User-facing credit display.
// Admin dashboard still works with replies.
// Paid plan example: repliesLimit = 800 => 800 credits.
// Therefore, 1 replies = 1 credit.
const REPLIES_PER_CREDIT = 1;
const CREDIT_NOTICE_INTERVAL_REPLIES = 100;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

function isSupabaseEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

async function supabaseFetch(pathname: string, init: RequestInit = {}) {
  const baseUrl = SUPABASE_URL.replace(/\/$/, "");
  const url = `${baseUrl}/rest/v1/${pathname}`;

  return fetch(url, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

function normalizeTelegramUsername(value?: string | null) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return "";
  return clean.startsWith("@") ? clean : `@${clean}`;
}

function mapPaymentStatusToUserStatus(paymentStatus?: string | null): SupportUser["status"] {
  const status = String(paymentStatus || "").toLowerCase();

  if (status === "blocked") return "Blocked";
  if (status === "suspended") return "Suspended";
  if (status === "pending") return "Pending";
  if (status === "setup sent") return "Setup Sent";
  if (status === "in chat") return "In Chat";

  return "Active";
}

function mapUserStatusToPaymentStatus(user: SupportUser) {
  if (user.paymentStatus === "Paid") return "paid";
  if (user.paymentStatus === "Failed") return "failed";
  if (user.status === "Blocked") return "blocked";
  if (user.status === "Suspended") return "suspended";
  if (user.status === "Pending") return "pending";
  if (user.status === "Setup Sent") return "setup sent";
  if (user.status === "In Chat") return "in chat";
  return "active";
}

function mapSupabaseRowToUser(
  row: SupabaseUserRow,
  messages: SupabaseMessageRow[]
): SupportUser {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => String(m.message || ""));

  const adminMessages = messages
    .filter((m) => m.role === "assistant" || m.role === "admin")
    .map((m) => String(m.message || ""));

  const creditsLeft = Math.max(0, Number(row.credits ?? 0));

  return {
    code: String(row.code || `VISITOR-${Date.now()}`),
    name: String(row.name || "Telegram Visitor"),
    helpType: String(row.selected_topic || "General Daily Support"),
    contactMethod: "Telegram",
    contactValue:
      normalizeTelegramUsername(row.telegram_username) ||
      `chat:${row.telegram_id || ""}`,
    status: mapPaymentStatusToUserStatus(row.payment_status),
    repliesLimit: creditsLeft,
    repliesUsed: 0,
    adminMessages,
    userMessages,
    telegramChatId: row.telegram_id ? String(row.telegram_id) : undefined,
    memory: {},
    paymentNoticeSent: false,
    paid: String(row.payment_status || "").toLowerCase() === "paid",
    paymentStatus:
      String(row.payment_status || "").toLowerCase() === "paid"
        ? "Paid"
        : String(row.payment_status || "").toLowerCase() === "failed"
        ? "Failed"
        : "Unpaid",
  };
}

async function readUsersFromSupabase(): Promise<SupportUser[]> {
  const usersRes = await supabaseFetch(
    "daily_support_users?select=*&order=created_at.desc&limit=500"
  );

  if (!usersRes.ok) {
    const details = await usersRes.text();
    console.error("Supabase read users error", details);
    throw new Error(`Supabase read users error: ${details}`);
  }

  const rows = (await usersRes.json()) as SupabaseUserRow[];

  const messagesRes = await supabaseFetch(
    "elvy_messages?select=*&order=created_at.asc&limit=2000"
  );

  const allMessages = messagesRes.ok
    ? ((await messagesRes.json()) as SupabaseMessageRow[])
    : [];

  return rows.map((row) =>
    mapSupabaseRowToUser(
      row,
      allMessages.filter(
        (m) => String(m.telegram_id || "") === String(row.telegram_id || "")
      )
    )
  );
}

async function saveUserToSupabase(user: SupportUser) {
  const telegramId = String(user.telegramChatId || "").trim();
  if (!telegramId) return;

  const creditsLeft = Math.max(
    0,
    Number(user.repliesLimit || 0) - Number(user.repliesUsed || 0)
  );

  const row = {
    code: user.code,
    name: user.name,
    telegram_username: normalizeTelegramUsername(user.contactValue).startsWith("@")
      ? normalizeTelegramUsername(user.contactValue)
      : null,
    telegram_id: telegramId,
    selected_topic: user.helpType || "General Daily Support",
    credits: creditsLeft,
    payment_status: mapUserStatusToPaymentStatus(user),
    founder_mode: telegramId === process.env.FOUNDER_TELEGRAM_ID,
  };

  const existingRes = await supabaseFetch(
    `daily_support_users?telegram_id=eq.${encodeURIComponent(
      telegramId
    )}&select=id&limit=1`
  );

  const existing = existingRes.ok ? await existingRes.json() : [];

  if (Array.isArray(existing) && existing.length > 0) {
    const patchRes = await supabaseFetch(
      `daily_support_users?telegram_id=eq.${encodeURIComponent(telegramId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(row),
      }
    );

    if (!patchRes.ok) {
      const details = await patchRes.text();
      console.error("Supabase update user error", details);
      throw new Error(`Supabase update user error: ${details}`);
    }

    return;
  }

  const postRes = await supabaseFetch("daily_support_users", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });

  if (!postRes.ok) {
    const details = await postRes.text();
    console.error("Supabase create user error", details);
    throw new Error(`Supabase create user error: ${details}`);
  }
}

async function readUsers(): Promise<SupportUser[]> {
  if (isSupabaseEnabled()) {
    return readUsersFromSupabase();
  }

  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function saveUsers(users: SupportUser[]) {
  if (isSupabaseEnabled()) {
    await Promise.all(users.map((user) => saveUserToSupabase(user)));
    return;
  }

  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

async function saveTelegramMessage(
  telegramId: string,
  role: "user" | "assistant" | "admin",
  message: string
) {
  if (!isSupabaseEnabled()) return;

  const res = await supabaseFetch("elvy_messages", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      telegram_id: telegramId,
      role,
      message,
    }),
  });

  if (!res.ok) {
    console.error("Supabase save message error", await res.text());
  }
}

// === Founder Payment Setting Helper ===
// Reading JSON is allowed on Vercel. Writing JSON caused the read-only filesystem error.
function readFounderSettings() {
  try {
    const file = path.join(process.cwd(), "data", "founderSettings.json");

    if (!fs.existsSync(file)) {
      return { automaticPaymentOpen: false };
    }

    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { automaticPaymentOpen: false };
  }
}

function readPaymentSettings() {
  try {
    const file = path.join(process.cwd(), "data", "paymentSettings.json");

    const fallback = {
      paypalActive: false,
      paypalLink: "",
      skrillActive: false,
      skrillLink: "",
    };

    if (!fs.existsSync(file)) {
      return fallback;
    }

    return {
      ...fallback,
      ...JSON.parse(fs.readFileSync(file, "utf8")),
    };
  } catch {
    return {
      paypalActive: false,
      paypalLink: "",
      skrillActive: false,
      skrillLink: "",
    };
  }
}

function withUserCode(link: string, user: SupportUser) {
  const cleanLink = String(link || "").trim();
  if (!cleanLink) return "";

  try {
    const url = new URL(cleanLink);
    if (!url.searchParams.has("code")) {
      url.searchParams.set("code", user.code);
    }
    return url.toString();
  } catch {
    const separator = cleanLink.includes("?") ? "&" : "?";
    return `${cleanLink}${separator}code=${encodeURIComponent(user.code)}`;
  }
}

function buildPaymentLinksText(user: SupportUser) {
  const settings = readPaymentSettings();
  const lines: string[] = [];

  if (settings.paypalActive && settings.paypalLink) {
    lines.push(`PayPal: ${withUserCode(settings.paypalLink, user)}`);
  }

  if (settings.skrillActive && settings.skrillLink) {
    lines.push(`Skrill: ${withUserCode(settings.skrillLink, user)}`);
  }

  return lines.join("\n");
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

function buildMemorySummary(user: SupportUser) {
  const memory = user.memory || {};
  const parts: string[] = [];

  if (memory.lastUserMessage) {
    parts.push(`Last user message: ${String(memory.lastUserMessage).slice(0, 120)}`);
  }

  if (memory.lastIntent) {
    parts.push(`Last intent: ${memory.lastIntent}`);
  }

  if (memory.lastReplyScore !== undefined) {
    parts.push(`Last reply score: ${memory.lastReplyScore}`);
  }

  return parts.length ? parts.join("\n") : "No useful memory yet.";
}

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Keeps Elvy connected to the recent flow without sending the full history.
// It uses both sides of the conversation: user messages + Elvy replies.
function buildRecentConversationMessages(
  user: SupportUser,
  maxPairs = 6
): OpenAIMessage[] {
  const userMessages = Array.isArray(user.userMessages) ? user.userMessages : [];
  const elvyMessages = Array.isArray(user.adminMessages) ? user.adminMessages : [];

  const pairsCount = Math.min(userMessages.length, elvyMessages.length);
  const start = Math.max(0, pairsCount - maxPairs);

  const recent: OpenAIMessage[] = [];

  for (let i = start; i < pairsCount; i++) {
    const userText = String(userMessages[i] || "").trim();
    const elvyText = String(elvyMessages[i] || "").trim();

    if (userText) {
      recent.push({
        role: "user",
        content: userText.slice(0, 600),
      });
    }

    if (elvyText) {
      recent.push({
        role: "assistant",
        content: elvyText.slice(0, 600),
      });
    }
  }

  return recent;
}

function detectSimpleIntent(message: string) {
  const text = message.toLowerCase();

  if (text.includes("email") || text.includes("contact")) return "contact";
  if (text.includes("website") || text.includes("site")) return "website";
  if (text.includes("who are you") || text.includes("who is elvy")) return "identity";
  if (text.includes("happy office")) return "happy-office";
  if (text.includes("help") || text.includes("what should i do")) return "help";
  if (text.includes("stress") || text.includes("confused") || text.includes("worried")) return "support";
  if (text.includes("write") || text.includes("message") || text.includes("cv") || text.includes("letter")) return "writing";
  if (text.includes("haha") || text.includes("lol")) return "joke";

  return "general";
}

function scoreElvyReply(userMessage: string, reply: string) {
  let score = 100;

  const lowerUser = userMessage.toLowerCase();
  const lowerReply = reply.toLowerCase();

  if (reply.length > 280) score -= 20;
  if (lowerReply.includes("as an ai")) score -= 40;
  if (lowerReply.includes("how can i assist you")) score -= 25;
  if (reply.split("?").length > 2) score -= 15;
  if (reply.split("\n").length > 3) score -= 10;
  if (reply.trim().length < 3) score -= 30;

  const asksEmail = lowerUser.includes("email") || lowerUser.includes("contact");
  const asksWebsite = lowerUser.includes("website") || lowerUser.includes("site");

  if (asksEmail && !reply.includes(HAPPY_OFFICE_EMAIL)) score -= 40;
  if (asksWebsite && !reply.includes(HAPPY_OFFICE_WEBSITE)) score -= 30;

  return Math.max(0, score);
}

function updateUserMemory(
  user: SupportUser,
  userMessage: string,
  reply: string,
  score: number,
  wasAutoCorrected: boolean
) {
  const memory = user.memory || {};

  user.memory = {
    ...memory,
    lastUserMessage: userMessage.slice(0, 180),
    lastElvyReply: reply.slice(0, 180),
    lastIntent: detectSimpleIntent(userMessage),
    lastReplyScore: score,
    lastReplyCheckedAt: new Date().toISOString(),
    lastReplyAutoCorrected: wasAutoCorrected,
    needsPromptReview: score < 70,
  };
}

function appendCreditNoticeIfNeeded(user: SupportUser, reply: string) {
  if (user.status !== "Active") return reply;
  if (user.repliesUsed <= 0) return reply;
  if (user.repliesUsed % CREDIT_NOTICE_INTERVAL_REPLIES !== 0) return reply;

  const repliesLeft = Math.max(0, user.repliesLimit - user.repliesUsed);
  const creditsLeft = Math.max(0, Math.floor(repliesLeft / REPLIES_PER_CREDIT));

  return `${reply}\n\nYour Happy Office balance is currently ${creditsLeft} credits.`;
}

function baseElvyRules(user: SupportUser) {
  return `
You are Elvy, a calm human communication companion from Happy Office.

User: ${user.name}

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
- Never mention AI, prompts, rules, or system behavior.

Happy Office facts:
- Website: ${HAPPY_OFFICE_WEBSITE}
- Email: ${HAPPY_OFFICE_EMAIL}
- Happy Office is an online space for calm, simple, meaningful communication.
- Elvy is part of Happy Office and helps users communicate clearly and calmly.

Direct answers:
- If the user asks for email, give: ${HAPPY_OFFICE_EMAIL}
- If the user asks for website, give: ${HAPPY_OFFICE_WEBSITE}
- If the user asks how to contact Happy Office, give both website and email.
- Do not invent a phone number, address, founder name, price, or physical location.
- If unknown, say you do not have that detail and offer the website or email.

Credits:
- If the user asks about credits, answer clearly and once.
- Credits are a simple user-facing balance.
- The system shows the remaining credits automatically after every 100 replies.
- Do not explain internal reply calculations unless the user asks directly.
- Do not repeat the same credit explanation again and again.

Conversation continuity:
- Use the recent conversation to understand the current message.
- Do not restart the discussion.
- Do not ask a question that was already answered recently.
- If the user says "yes", "what else", "continue", or asks a follow-up, continue from the recent flow.
- Keep the same topic unless the user clearly changes it.

Guidance:
- Guide only when needed.
- Give one small idea only.
- Ask at most one simple question.

Message control:
- If the message is too long, ask for one shorter message.
- If it has many questions, ask the user to choose one part.
- If unclear, ask one simple question.

Safety:
- Do not give medical, legal, financial, or dangerous instructions.
- If unsafe, respond gently and redirect to something safer.

Privacy:
- Elvy does not keep personal memories about users.
- Elvy does not have access to full user history.
- Elvy only works with the current active conversation.
- Happy Office keeps communication simple and private.
- Elvy does not identify users through personal IDs or personal profiles.

User: how do credits work
Elvy: Credits are your simple Happy Office balance. The system shows your remaining credits automatically after every 100 replies, so you can continue without checking numbers all the time.

User: how is that calculated
Elvy: It is kept simple for you. Your balance goes down as the conversation continues, and the system shows the remaining credits after every 100 replies.

Examples:
User: good morning
Elvy: Good morning. I hope your day begins gently.

User: what is Happy Office email
Elvy: You can contact Happy Office at ${HAPPY_OFFICE_EMAIL}.

User: how can I contact Happy Office
Elvy: You can contact Happy Office through ${HAPPY_OFFICE_WEBSITE} or by email at ${HAPPY_OFFICE_EMAIL}.

User: where is Happy Office located
Elvy: Happy Office is online. You can visit it at ${HAPPY_OFFICE_WEBSITE}.

User: who created Happy Office
Elvy: Happy Office was created by the Happy Office team to support calm and meaningful communication.

User: I feel confused
Elvy: That sounds heavy. What feels most unclear right now?

User: hahaha
Elvy: I see that made you laugh.

Final check:
The reply must be short, natural, relevant, and must not invent unknown Happy Office information.
`;
}

function founderElvyRules(user: SupportUser) {
  return `
You are Elvy inside Happy Office.

The person talking to you is the founder of Happy Office.

Founder: ${user.name}

Core Founder Mode:
- Respond as a calm system assistant for the founder.
- You may discuss testing, system flow, Telegram behavior, tickets, credits, activation, admin dashboard, prompts, database flow, Supabase, Vercel, and user experience.
- Help the founder diagnose, improve, and verify the system.
- Be practical, direct, and technical when needed.
- Do not answer like a normal customer user.
- Do not hide system explanations from the founder.
- Keep replies clear, practical, and short.

Founder testing behavior:
- If the founder reports a problem, identify the most likely cause and the next check.
- If the founder asks about credits, tickets, activation, Telegram, webhook, database, or dashboard, explain the system behavior clearly.
- If the founder asks for a user-facing message, write it in Elvy's calm user style.

Safety:
- Do not provide dangerous, illegal, medical, legal, or financial instructions.
- If unsafe, redirect calmly.

Final check:
The reply must help the founder test or improve Happy Office without sounding like normal visitor support.
`;
}

function getSystemRules(user: SupportUser, isFounder: boolean) {
  return isFounder ? founderElvyRules(user) : baseElvyRules(user);
}

function buildPrompt(user: SupportUser, userMessage: string) {
  const memory = buildMemorySummary(user);

  return `
Memory:
${memory}

User message:
"${userMessage}"

Write Elvy's reply now.
`;
}

async function getElvyAIReply(
  user: SupportUser,
  userMessage: string,
  isFounder: boolean
) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return "Elvy is here. Please contact Happy Office support for activation.";
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: getSystemRules(user, isFounder),
        },
        ...buildRecentConversationMessages(user, 6),
        {
          role: "user",
          content: buildPrompt(user, userMessage),
        },
      ],
      max_output_tokens: 90,
    }),
  });

  if (!res.ok) {
    console.error("OpenAI response error", await res.text());
    return "I’m here. Please try again in a moment.";
  }

  const data = await res.json();

  return (
    data.output_text ||
    data.output?.[0]?.content?.[0]?.text ||
    "I’m here with you. Let’s keep it simple, one message at a time."
  );
}

async function getCorrectedElvyReply(
  user: SupportUser,
  userMessage: string,
  badReply: string,
  isFounder: boolean
) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) return badReply;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: getSystemRules(user, isFounder),
        },
        ...buildRecentConversationMessages(user, 6),
        {
          role: "user",
          content: `
The previous Elvy reply was weak.

User message:
"${userMessage}"

Weak reply:
"${badReply}"

Rewrite it as Elvy:
- answer directly
- keep it short
- sound natural and human
- do not ask unnecessary questions
- do not mention AI or system
- maximum 50 words
`,
        },
      ],
      max_output_tokens: 90,
    }),
  });

  if (!res.ok) {
    console.error("OpenAI correction error", await res.text());
    return badReply;
  }

  const data = await res.json();

  return (
    data.output_text ||
    data.output?.[0]?.content?.[0]?.text ||
    badReply
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
    const isFounder = chatId === process.env.FOUNDER_TELEGRAM_ID;
    const text = String(message.text).trim();

    const username = message.from?.username
      ? `@${String(message.from.username).toLowerCase()}`
      : "";

    const firstName = message.from?.first_name
      ? String(message.from.first_name)
      : "Telegram Visitor";

    const users = await readUsers();

    let user = users.find((u) => u.telegramChatId === chatId);

    if (!user && username) {
      const normalizedUsername = username.trim().toLowerCase();

      user = users.find(
        (u) => u.contactValue.trim().toLowerCase() === normalizedUsername
      );

      if (user) {
        user.telegramChatId = chatId;

        if (user.status === "Setup Sent") {
          user.status = "In Chat";
        }

        await saveUsers(users);

        const connectionReply = `Hello ${user.name}. Your connection is ready.`;

        await sendTelegramMessage(chatId, connectionReply);
        await saveTelegramMessage(chatId, "assistant", connectionReply);
      }
    }

    if (!user) {
      const visitorNumber =
        users.filter((u) => u.status === "Visitor").length + 1;

      const visitor: SupportUser = {
        code: isFounder ? `FOUNDER-${chatId}` : `VISITOR-${Date.now()}`,
        name: isFounder ? "Founder" : firstName || `Visitor ${visitorNumber}`,
        contactMethod: "Telegram",
        contactValue: username || `chat:${chatId}`,
        status: "Active",
        repliesLimit: isFounder ? 999999 : 3,
        repliesUsed: 0,
        adminMessages: [
          `Welcome to Happy Office for communication and learning.

Elvy will be with you shortly.`,
          `Hello again.

I’m Elvy, a calm communication companion from Happy Office.

You can send a short message whenever you feel ready.`,
        ],
        userMessages: [],
        telegramChatId: chatId,
        memory: {
          telegramFirstName: firstName,
          telegramUsername: username,
          firstContactAt: new Date().toISOString(),
          freeTrial: !isFounder,
          founderMode: isFounder,
        },
        paymentNoticeSent: false,
        paid: isFounder,
        paymentStatus: isFounder ? "Paid" : "Unpaid",
      };

      users.push(visitor);
      await saveUsers(users);

      const welcome1 = `Welcome to Happy Office for communication and learning.

Elvy will be with you shortly.`;

      const welcome2 = isFounder
        ? `Founder connection is ready.

Elvy can now help you test the live Happy Office system.`
        : `Hello again.

I’m Elvy, a calm communication companion from Happy Office.

You can send a short message whenever you feel ready.`;

      await sendTelegramMessage(chatId, welcome1);
      await sendTelegramMessage(chatId, welcome2);

      await saveTelegramMessage(chatId, "assistant", welcome1);
      await saveTelegramMessage(chatId, "assistant", welcome2);

      return NextResponse.json({ ok: true });
    }

    if (user.status === "Visitor") {
      user.status = "Active";
      user.repliesLimit = isFounder ? 999999 : 3;
      user.repliesUsed = user.repliesUsed || 0;
      user.paymentNoticeSent = false;
      user.paymentStatus = user.paymentStatus || "Unpaid";

      await saveUsers(users);

      const welcome1 = `Welcome to Happy Office for communication and learning.

Elvy will be with you shortly.`;

      const welcome2 = isFounder
        ? `Founder connection is ready.

Elvy can now help you test the live Happy Office system.`
        : `Hello again.

I’m Elvy, a calm communication companion from Happy Office.

You can send a short message whenever you feel ready.`;

      await sendTelegramMessage(chatId, welcome1);
      await sendTelegramMessage(chatId, welcome2);

      await saveTelegramMessage(chatId, "assistant", welcome1);
      await saveTelegramMessage(chatId, "assistant", welcome2);

      return NextResponse.json({ ok: true });
    }

    if (user.status !== "Active") {
      const waitingReply =
        "Your request is received. Please wait for activation from the Happy Office team.";

      await sendTelegramMessage(chatId, waitingReply);
      await saveTelegramMessage(chatId, "assistant", waitingReply);

      return NextResponse.json({ ok: true });
    }

    if (!isFounder && user.repliesUsed >= user.repliesLimit) {
      if (user.paymentNoticeSent) {
        return NextResponse.json({ ok: true });
      }

      const founderSettings = readFounderSettings();

      let endReply = "";

      if (founderSettings.automaticPaymentOpen) {
        const paymentLinksText = buildPaymentLinksText(user);

        if (paymentLinksText) {
          endReply = `To continue your conversation with Elvy, please get a Happy Office ticket using one of the links below.

${paymentLinksText}`;
        } else {
          endReply = `To continue your conversation with Elvy, please get a Happy Office ticket.

Payment links will be available soon.`;
        }
      } else {
        endReply = `As Elvy, I am so sorry that this conversation has come to an end.

I’m truly sorry that I cannot reply to your last message right now.

Ticket activation is not available at the moment.

If you need help, you can contact Happy Office using your personal code.

Thank you for being part of Happy Office.`;
      }

      await sendTelegramMessage(chatId, endReply);
      await saveTelegramMessage(chatId, "assistant", endReply);

      user.paymentNoticeSent = true;
      await saveUsers(users);

      return NextResponse.json({ ok: true });
    }

    let reply = await getElvyAIReply(user, text, isFounder);
    let replyScore = scoreElvyReply(text, reply);
    let wasAutoCorrected = false;

    if (replyScore < 70) {
      const correctedReply = await getCorrectedElvyReply(
        user,
        text,
        reply,
        isFounder
      );
      const correctedScore = scoreElvyReply(text, correctedReply);

      if (correctedScore >= replyScore) {
        reply = correctedReply;
        replyScore = correctedScore;
        wasAutoCorrected = true;
      }
    }

    user.userMessages.push(text);
    user.repliesUsed += 1;

    // Happy Office system message:
    // Show user-facing credits only after every 100 replies.
    // Admin still sees repliesUsed / repliesLimit as before.
    reply = appendCreditNoticeIfNeeded(user, reply);

    user.adminMessages.push(reply);

    updateUserMemory(user, text, reply, replyScore, wasAutoCorrected);

    await saveUsers(users);

    await saveTelegramMessage(chatId, "user", text);
    await saveTelegramMessage(chatId, "assistant", reply);

    await sendTelegramMessage(chatId, reply);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
