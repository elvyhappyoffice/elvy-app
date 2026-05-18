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

function mapSupabaseUser(user: any) {
  return {
    code: user.code || "",
    name: user.name || "",
    ageGroup: "18–30",
    helpType: "General support",
    contactMethod: user.contact_method || "Telegram",
    contactValue: user.contact_value || "",
    status: user.status || "Pending",
    repliesLimit: Number(user.replies_limit || 0),
    repliesUsed: Number(user.replies_used || 0),
    aiCost: 0,
    contactCost: 0,
    startDate: "",
    endDate: "",
    telegramChatId: user.telegram_chat_id || "",
    adminMessages: user.admin_messages || [],
    userMessages: user.user_messages || [],
    memory: user.memory || {},
    paymentNoticeSent: Boolean(user.payment_notice_sent),
    paid: Boolean(user.paid),
    paymentStatus: user.payment_status || "Unpaid",
    paymentMethod: user.payment_method || "",
    paymentReference: user.payment_reference || "",
    paidAt: user.paid_at || "",
  };
}

function mapUserToSupabase(user: any) {
  return {
    code: user.code || "",
    name: user.name || "",
    contact_method: user.contactMethod || "Telegram",
    contact_value: user.contactValue || "",
    status: user.status || "Pending",
    replies_limit: Number(user.repliesLimit || 0),
    replies_used: Number(user.repliesUsed || 0),
    telegram_chat_id: user.telegramChatId || "",
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

export async function GET() {
  // Local development uses JSON only.
  if (!process.env.VERCEL) {
    const users = readUsers();

    return NextResponse.json({
      success: true,
      users,
    });
  }

  // Vercel/online uses Supabase only.
  try {
    const { data, error } = await supabase
      .from("daily_support_users")
      .select("*");

    if (error) {
      console.error("Supabase GET error:", error);

      return NextResponse.json({
        success: false,
        error: "Supabase GET failed.",
        details: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      users: (data || []).map(mapSupabaseUser),
    });
  } catch (error: any) {
    console.error("Supabase connection failed:", error);

    return NextResponse.json({
      success: false,
      error: "Supabase connection failed.",
      details: error?.message || String(error),
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const users = Array.isArray(body.users) ? body.users : [];

    // Local development uses JSON only.
    if (!process.env.VERCEL) {
      saveUsers(users);

      return NextResponse.json({
        success: true,
        users,
      });
    }

    const codes = users
      .map((user: any) => user.code)
      .filter(Boolean);

    let deleteQuery = supabase.from("daily_support_users").delete();

    let deleteResult;

    if (codes.length > 0) {
      deleteResult = await deleteQuery.not(
        "code",
        "in",
        `(${codes.map((code: string) => `"${code}"`).join(",")})`
      );
    } else {
      deleteResult = await deleteQuery.not("id", "is", null);
    }

    if (deleteResult.error) {
      console.error("Supabase delete error:", deleteResult.error);
      return NextResponse.json({
        success: false,
        error: "Supabase delete failed.",
        details: deleteResult.error.message,
      }, { status: 500 });
    }

    if (users.length > 0) {
      const supabaseUsers = users.map(mapUserToSupabase);

      const { error: upsertError } = await supabase
        .from("daily_support_users")
        .upsert(supabaseUsers, {
          onConflict: "code",
        });

      if (upsertError) {
        console.error("Supabase upsert error:", upsertError);
        return NextResponse.json({
          success: false,
          error: "Supabase upsert failed.",
          details: upsertError.message,
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error: any) {
    console.error("Daily Support POST error:", error);

    return NextResponse.json({
      success: false,
      error: "Daily Support save failed.",
      details: error?.message || String(error),
    }, { status: 500 });
  }
}