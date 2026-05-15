import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

type SupportUser = {
  code: string;
  name: string;
  status: string;
  repliesLimit: number;
  repliesUsed: number;
  telegramChatId?: string;
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

    const users = readUsers();
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