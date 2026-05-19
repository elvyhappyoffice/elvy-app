import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type SupportUser = {
  code: string;
  name: string;
  status: string;
  repliesLimit: number;
  repliesUsed: number;
  telegramChatId?: string;
  contactMethod?: string;
  contactValue?: string;
  adminMessages?: string[];
  userMessages?: string[];
  memory?: any;
  paymentNoticeSent?: boolean;
  paid?: boolean;
  paymentStatus?: "Unpaid" | "Pending" | "Paid" | "Failed";
  paymentMethod?: "PayPal" | "Skrill";
  paymentReference?: string;
  paidAt?: string;
};

const DATA_FILE = path.join(process.cwd(), "data", "dailySupportUsers.json");
const REPLIES_LIMIT = 2000;
const CREDITS = 2000;

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

function mapSupabaseUser(user: any): SupportUser {
  return {
    code: user.code || "",
    name: user.name || "",
    status: user.status || "Pending",
    repliesLimit: Number(user.replies_limit || 0),
    repliesUsed: Number(user.replies_used || 0),
    telegramChatId: user.telegram_chat_id || "",
    contactMethod: user.contact_method || "Telegram",
    contactValue: user.contact_value || "",
    adminMessages: user.admin_messages || [],
    userMessages: user.user_messages || [],
    memory: user.memory || {},
    paymentNoticeSent: Boolean(user.payment_notice_sent),
    paid: Boolean(user.paid),
    paymentStatus: user.payment_status || "Unpaid",
    paymentMethod: user.payment_method || undefined,
    paymentReference: user.payment_reference || "",
    paidAt: user.paid_at || "",
  };
}

function mapUserToSupabase(user: SupportUser) {
  return {
    code: user.code || "",
    name: user.name || "",
    status: user.status || "Pending",
    replies_limit: Number(user.repliesLimit || 0),
    replies_used: Number(user.repliesUsed || 0),
    telegram_chat_id: user.telegramChatId || "",
    contact_method: user.contactMethod || "Telegram",
    contact_value: user.contactValue || "",
    admin_messages: user.adminMessages || [],
    user_messages: user.userMessages || [],
    memory: user.memory || {},
    payment_notice_sent: Boolean(user.paymentNoticeSent),
    paid: Boolean(user.paid),
    payment_status: user.paymentStatus || "Unpaid",
    payment_method: user.paymentMethod || "",
    payment_reference: user.paymentReference || "",
    paid_at: user.paidAt || "",
  };
}

async function loadUsers(): Promise<SupportUser[]> {
  if (!process.env.VERCEL) {
    return readUsers();
  }

  const { data, error } = await supabase
    .from("daily_support_users")
    .select("*");

  if (error) {
    console.error("Supabase payment activation load error:", error);
    return [];
  }

  return (data || []).map(mapSupabaseUser);
}

async function persistUsers(users: SupportUser[]) {
  if (!process.env.VERCEL) {
    await persistUsers(users);
    return;
  }

  if (users.length === 0) return;

  const supabaseUsers = users.map(mapUserToSupabase);

  const { error } = await supabase
    .from("daily_support_users")
    .upsert(supabaseUsers, { onConflict: "code" });

  if (error) {
    console.error("Supabase payment activation save error:", error);
    throw error;
  }
}

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const code = String(body.code || "").trim();
    const method = body.method === "Skrill" ? "Skrill" : "PayPal";
    const reference = String(body.reference || `MANUAL-${Date.now()}`);

    if (!code) {
      return NextResponse.json(
        { ok: false, error: "Missing user code." },
        { status: 400 }
      );
    }

    const users = await loadUsers();
    const user = users.find((u) => u.code === code);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "User code not found." },
        { status: 404 }
      );
    }

    user.status = "Active";
    user.repliesLimit = REPLIES_LIMIT;
    user.repliesUsed = 0;
    user.paymentNoticeSent = false;
    user.paid = true;
    user.paymentStatus = "Paid";
    user.paymentMethod = method;
    user.paymentReference = reference;
    user.paidAt = new Date().toISOString();

    saveUsers(users);

    if (user.telegramChatId) {
      await sendTelegramMessage(
        user.telegramChatId,
        `Your new Happy Office ticket is now active.

Your current balance is ${CREDITS} credits.

We can continue our conversation from where we stopped.`
      );
    }

    return NextResponse.json({
      ok: true,
      message: "User activated successfully.",
      user: {
        code: user.code,
        name: user.name,
        status: user.status,
        credits: CREDITS,
        paymentStatus: user.paymentStatus,
      },
    });
  } catch (error) {
    console.error("Payment activation error:", error);
    return NextResponse.json(
      { ok: false, error: "Payment activation failed." },
      { status: 500 }
    );
  }
}