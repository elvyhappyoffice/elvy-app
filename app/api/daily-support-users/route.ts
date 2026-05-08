import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const DATA_FILE = path.join(process.cwd(), "data", "dailySupportUsers.json");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

function isSupabaseEnabled() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function getSupabaseBaseUrl() {
  return SUPABASE_URL.replace(/\/$/, "").replace(/\/rest\/v1$/, "");
}

async function supabaseFetch(pathname: string, init: RequestInit = {}) {
  const baseUrl = getSupabaseBaseUrl();
  const cleanPath = pathname.replace(/^\//, "");
  const url = `${baseUrl}/rest/v1/${cleanPath}`;

  return fetch(url, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

function readUsersFromJson() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveUsersToJson(users: any[]) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

function normalizeTelegramUsername(value: any) {
  const clean = String(value || "").trim().toLowerCase();
  if (!clean) return "";
  return clean.startsWith("@") ? clean : `@${clean}`;
}

function getTelegramId(user: any) {
  return String(user.telegramChatId || user.telegram_id || user.telegramId || "").trim();
}

function mapStatusToPaymentStatus(user: any) {
  const paymentStatus = String(user.paymentStatus || "").toLowerCase();
  const status = String(user.status || "").toLowerCase();

  if (paymentStatus === "paid") return "paid";
  if (paymentStatus === "failed") return "failed";
  if (paymentStatus === "pending") return "pending";
  if (status === "blocked") return "blocked";
  if (status === "suspended") return "suspended";
  if (status === "pending") return "pending";
  if (status === "setup sent") return "setup sent";
  if (status === "in chat") return "in chat";
  return "active";
}

function mapPaymentStatusToStatus(paymentStatus: any) {
  const status = String(paymentStatus || "").toLowerCase();

  if (status === "blocked") return "Blocked";
  if (status === "suspended") return "Suspended";
  if (status === "pending") return "Pending";
  if (status === "setup sent") return "Setup Sent";
  if (status === "in chat") return "In Chat";
  return "Active";
}

function mapRowToUser(row: any, usedReplies: number) {
  const creditsLeft = Math.max(0, Number(row.credits ?? 0));
  const repliesUsed = Math.max(0, Number(usedReplies || 0));

  return {
    code: String(row.code || `VISITOR-${Date.now()}`),
    name: String(row.name || "Telegram Visitor"),
    ageGroup: "",
    helpType: String(row.selected_topic || "General Daily Support"),
    contactMethod: "Telegram",
    contactValue:
      normalizeTelegramUsername(row.telegram_username) ||
      (row.telegram_id ? `chat:${row.telegram_id}` : ""),
    status: mapPaymentStatusToStatus(row.payment_status),
    repliesLimit: creditsLeft + repliesUsed,
    repliesUsed,
    adminMessages: [],
    userMessages: [],
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

async function readUsersFromSupabase() {
  const usersRes = await supabaseFetch("daily_support_users?select=*");

  if (!usersRes.ok) {
    const details = await usersRes.text();
    console.error("Supabase read users error", details);
    throw new Error(`Supabase read users error: ${details}`);
  }

  const rows = await usersRes.json();

  const messagesRes = await supabaseFetch("elvy_messages?select=telegram_id,role");
  const messages = messagesRes.ok ? await messagesRes.json() : [];

  const usedByTelegramId = new Map<string, number>();

  if (Array.isArray(messages)) {
    for (const msg of messages) {
      if (msg?.role !== "user") continue;
      const telegramId = String(msg?.telegram_id || "").trim();
      if (!telegramId) continue;
      usedByTelegramId.set(telegramId, (usedByTelegramId.get(telegramId) || 0) + 1);
    }
  }

  if (!Array.isArray(rows)) return [];

  return rows.map((row: any) =>
    mapRowToUser(row, usedByTelegramId.get(String(row.telegram_id || "")) || 0)
  );
}

async function saveUserToSupabase(user: any) {
  const telegramId = getTelegramId(user);
  if (!telegramId) return;

  const repliesLimit = Math.max(0, Number(user.repliesLimit || 0));
  const repliesUsed = Math.max(0, Number(user.repliesUsed || 0));
  const creditsLeft = Math.max(0, repliesLimit - repliesUsed);

  const contactValue = String(user.contactValue || "").trim();
  const row = {
    code: String(user.code || `VISITOR-${Date.now()}`),
    name: String(user.name || "Telegram Visitor"),
    telegram_username: contactValue.startsWith("@")
      ? normalizeTelegramUsername(contactValue)
      : null,
    telegram_id: telegramId,
    selected_topic: String(user.helpType || user.selected_topic || "General Daily Support"),
    credits: creditsLeft,
    payment_status: mapStatusToPaymentStatus(user),
    founder_mode: telegramId === process.env.FOUNDER_TELEGRAM_ID,
  };

  const existingRes = await supabaseFetch(
    `daily_support_users?telegram_id=eq.${encodeURIComponent(telegramId)}&select=id`
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

async function readUsers() {
  if (isSupabaseEnabled()) {
    return readUsersFromSupabase();
  }

  return readUsersFromJson();
}

async function saveUsers(users: any[]) {
  if (isSupabaseEnabled()) {
    await Promise.all(users.map((user) => saveUserToSupabase(user)));
    return;
  }

  saveUsersToJson(users);
}

export async function GET() {
  try {
    const users = await readUsers();
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to read users" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const users = Array.isArray(body.users) ? body.users : [];

    await saveUsers(users);

    const updatedUsers = await readUsers();

    return NextResponse.json({ success: true, users: updatedUsers });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save users" },
      { status: 500 }
    );
  }
}
