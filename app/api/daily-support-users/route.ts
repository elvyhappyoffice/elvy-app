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
  const ticketHours = Number(user.ticket_hours ?? 0);
  const secondsRemaining = Number(user.seconds_remaining ?? 0);
  const secondsUsed = Number(user.seconds_used ?? 0);

  return {
    code: user.code || "",
    name: user.name || "",
    ageGroup: user.age_group || "18–30",
    helpType: user.help_type || "General support",
    contactMethod: user.contact_method || "Telegram",
    contactValue: user.contact_value || "",
    status: user.status || "Pending",

    // Old reply fields kept for safe backwards compatibility.
    repliesLimit: Number(user.replies_limit || 0),
    repliesUsed: Number(user.replies_used || 0),

    // New time-ticket fields for public users.
    ticketType: user.ticket_type || "Starter",
    ticketHours,
    secondsRemaining,
    secondsUsed,

    aiCost: Number(user.ai_cost || 0),
    contactCost: Number(user.contact_cost || 0),
    startDate: user.start_date || "",
    endDate: user.end_date || "",
    telegramChatId: user.telegram_chat_id || "",
    adminMessages: user.admin_messages || [],
    userMessages: user.user_messages || [],
    privateAdminMessages: user.private_admin_messages || [],
    privateUserMessages: user.private_user_messages || [],
    setupAccessNumber: user.setup_access_number || "",
    needsAdminReply: Boolean(user.needs_admin_reply),
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
    age_group: user.ageGroup || "18–30",
    help_type: user.helpType || "General support",
    contact_method: user.contactMethod || "Telegram",
    contact_value: user.contactValue || "",
    status: user.status || "Pending",

    // Old reply fields kept for safe backwards compatibility.
    replies_limit: Number(user.repliesLimit || 0),
    replies_used: Number(user.repliesUsed || 0),

    // New time-ticket fields for public users.
    ticket_type: user.ticketType || "Starter",
    ticket_hours: Number(user.ticketHours || 0),
    seconds_remaining: Number(user.secondsRemaining || 0),
    seconds_used: Number(user.secondsUsed || 0),

    ai_cost: Number(user.aiCost || 0),
    contact_cost: Number(user.contactCost || 0),
    start_date: user.startDate || "",
    end_date: user.endDate || "",
    telegram_chat_id: user.telegramChatId || "",
    admin_messages: user.adminMessages || [],
    user_messages: user.userMessages || [],
    private_admin_messages: user.privateAdminMessages || [],
    private_user_messages: user.privateUserMessages || [],
    setup_access_number: user.setupAccessNumber || "",
    needs_admin_reply: Boolean(user.needsAdminReply),
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

  // ALSO CLEAN elvyAccounts.json
  try {
    const accountsFile = path.join(
      process.cwd(),
      "data",
      "elvyAccounts.json"
    );

    let accounts: any[] = [];

    if (fs.existsSync(accountsFile)) {
      accounts = JSON.parse(
        fs.readFileSync(accountsFile, "utf8")
      );
    }

    const activeCodes = users.map(
      (u: any) => u.code
    );

    accounts = accounts.filter((account: any) =>
      activeCodes.includes(account.userCode)
    );

    fs.writeFileSync(
      accountsFile,
      JSON.stringify(accounts, null, 2)
    );
  } catch (error) {
    console.error(
      "Local elvyAccounts cleanup failed:",
      error
    );
  }

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

    // ALSO CLEAN elvy_accounts
    let accountDeleteQuery =
      supabase.from("elvy_accounts").delete();

    let accountDeleteResult;

    if (codes.length > 0) {
      accountDeleteResult =
        await accountDeleteQuery.not(
          "user_code",
          "in",
          `(${codes
            .map((code: string) => `"${code}"`)
            .join(",")})`
        );
    } else {
      accountDeleteResult =
        await accountDeleteQuery.not(
          "id",
          "is",
          null
        );
    }

    if (accountDeleteResult.error) {
      console.error(
        "Supabase elvy_accounts delete error:",
        accountDeleteResult.error
      );
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