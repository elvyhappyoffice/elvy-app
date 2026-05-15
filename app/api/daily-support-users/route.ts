import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const DATA_FILE = path.join(process.cwd(), "data", "dailySupportUsers.json");

function readUsers() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveUsers(users: any[]) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

export async function GET() {
  const users = readUsers();
  return NextResponse.json({ success: true, users });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const users = Array.isArray(body.users) ? body.users : [];

  // Keep local JSON as stable fallback
  saveUsers(users);

  // Parallel Supabase save
  try {
    await supabase.from("daily_support_users").delete().neq("id", 0);

    if (users.length > 0) {
      const supabaseUsers = users.map((user: any) => ({
        code: user.code || "",
        name: user.name || "",
        contact_method: user.contactMethod || "",
        contact_value: user.contactValue || "",
        status: user.status || "",
        replies_limit: user.repliesLimit || 0,
        replies_used: user.repliesUsed || 0,
        telegram_chat_id: user.telegramChatId || "",
        admin_messages: user.adminMessages || [],
        user_messages: user.userMessages || [],
        memory: user.memory || [],
        payment_notice_sent: user.paymentNoticeSent || false,
        paid: user.paid || false,
        payment_status: user.paymentStatus || "",
        payment_method: user.paymentMethod || "",
        payment_reference: user.paymentReference || "",
        paid_at: user.paidAt || "",
      }));

      await supabase.from("daily_support_users").insert(supabaseUsers);
    }
  } catch (error) {
    console.error("Supabase parallel save error:", error);
  }

  return NextResponse.json({ success: true, users });
}