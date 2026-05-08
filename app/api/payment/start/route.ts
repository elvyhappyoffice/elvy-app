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

const DATA_FILE = path.join(process.cwd(), "data", "dailySupportUsers.json");
const HAPPY_OFFICE_LINK = "https://elvyhappyoffice.com";
const HAPPY_OFFICE_WEBSITE = "www.elvyhappyoffice.com";
const HAPPY_OFFICE_EMAIL = "elvy.happyoffice@gmail.com";

// User-facing credit display.
// Admin dashboard still works with replies.
// Paid plan example: repliesLimit = 800 => 800 credits.
// Therefore, 1 replies = 1 credit.
const REPLIES_PER_CREDIT = 1;
const CREDIT_NOTICE_INTERVAL_REPLIES = 100;

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

// === Founder Payment Setting Helper (NEW) ===
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

async function getElvyAIReply(user: SupportUser, userMessage: string) {
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
          content: baseElvyRules(user),
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
  badReply: string
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
          content: baseElvyRules(user),
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
    const text = String(message.text).trim();

    const username = message.from?.username
      ? `@${String(message.from.username).toLowerCase()}`
      : "";

    const firstName = message.from?.first_name
      ? String(message.from.first_name)
      : "Telegram Visitor";

    const users = readUsers();

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

        saveUsers(users);

        await sendTelegramMessage(
          chatId,
          `Hello ${user.name}. Your connection is ready.`
        );
      }
    }

    if (!user) {
      const visitorNumber =
        users.filter((u) => u.status === "Visitor").length + 1;

      const visitor: SupportUser = {
        code: `VISITOR-${Date.now()}`,
        name: `Visitor ${visitorNumber}`,
        contactMethod: "Telegram",
        contactValue: username || `chat:${chatId}`,
        status: "Visitor",
        repliesLimit: 0,
        repliesUsed: 0,
        adminMessages: [],
        userMessages: [text],
        telegramChatId: chatId,
        memory: {
          telegramFirstName: firstName,
          telegramUsername: username,
          firstContactAt: new Date().toISOString(),
        },
      };

      users.push(visitor);
      saveUsers(users);

      await sendTelegramMessage(
        chatId,
        `Welcome to Happy Office.

I’m glad you are here.

To begin, please visit the link below and generate your personal access code.

After activation, you can start your conversation with Elvy.

🔒 Please do not share your code. It is your personal access to contact the Happy Office team directly.

${HAPPY_OFFICE_LINK}`
      );

      return NextResponse.json({ ok: true });
    }

    if (user.status === "Visitor") {
      await sendTelegramMessage(
        chatId,
        `Welcome again to Happy Office.

Please visit Happy Office and generate your personal access code.

🔒 Keep your code private. It is used to contact the Happy Office team directly.

${HAPPY_OFFICE_LINK}`
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
  if (user.paymentNoticeSent) {
    return NextResponse.json({ ok: true });
  }

  const settings = readFounderSettings();

  if (settings.automaticPaymentOpen) {
    await sendTelegramMessage(
      chatId,
      `As Elvy, I am so sorry that this conversation has come to an end.

I’m truly sorry that I cannot reply to your last message right now.

I sincerely hope that your time with Elvy has helped you reflect, understand yourself better, and move forward with more clarity and confidence.

Sometimes, even a few calm conversations can leave meaningful lessons that stay with us for a very long time.

To continue your journey with Elvy, you are warmly invited to activate a new ticket.

PayPal: ${HAPPY_OFFICE_LINK}/api/payment/start?code=${encodeURIComponent(user.code)}&method=PayPal
Skrill: ${HAPPY_OFFICE_LINK}/api/payment/start?code=${encodeURIComponent(user.code)}&method=Skrill

With a new ticket, we will continue our conversation from where we stopped.

Thank you for being part of Happy Office.`
    );
  } else {
    await sendTelegramMessage(
      chatId,
      `As Elvy, I am so sorry that this conversation has come to an end.

I’m truly sorry that I cannot reply to your last message right now.

Ticket activation is not available at the moment.

If you need help, you can contact Happy Office using your personal code.

Thank you for being part of Happy Office.`
    );
  }

  user.paymentNoticeSent = true;
  saveUsers(users);

  return NextResponse.json({ ok: true });
}

    let reply = await getElvyAIReply(user, text);
    let replyScore = scoreElvyReply(text, reply);
    let wasAutoCorrected = false;

    if (replyScore < 70) {
      const correctedReply = await getCorrectedElvyReply(user, text, reply);
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

    saveUsers(users);

    await sendTelegramMessage(chatId, reply);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
