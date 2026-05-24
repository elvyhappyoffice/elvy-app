import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const DATA_FILE = path.join(process.cwd(), "data", "dailySupportUsers.json");
const ACCOUNTS_FILE = path.join(process.cwd(), "data", "elvyAccounts.json");

function readUsers() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function readAccounts() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveAccounts(accounts: any[]) {
  const dir = path.dirname(ACCOUNTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

async function updateAccountTicket(user: any, repliesLeft: number) {
  if (process.env.VERCEL) {
    const { error } = await supabase
      .from("elvy_accounts")
      .update({
        credits_left: repliesLeft,
        ticket_status: "Active",
        activated_at: new Date().toISOString(),
      })
      .eq("user_code", user.code);

    if (error) {
      console.error(
        "Supabase activate-code account update error:",
        error
      );
    }

    return;
  }

  const accounts = readAccounts();

  const updatedAccounts = accounts.map((account: any) => {
    if (
      String(account.userCode || "").trim().toLowerCase() !==
      String(user.code || "").trim().toLowerCase()
    ) {
      return account;
    }

    return {
      ...account,
      displayName:
        account.displayName ||
        user.name ||
        account.username,
      creditsLeft: repliesLeft,
      ticketStatus: "Active",
      activatedAt: new Date().toISOString(),
    };
  });

  saveAccounts(updatedAccounts);
}

function mapSupabaseUser(user: any) {
  return {
    code: user.code || "",
    name: user.name || "",
    status: user.status || "Pending",
    repliesLimit: Number(user.replies_limit || 0),
    repliesUsed: Number(user.replies_used || 0),
    paid: Boolean(user.paid),
    paymentStatus: user.payment_status || "Unpaid",
  };
}

async function loadUsers() {
  if (!process.env.VERCEL) {
    return readUsers();
  }

  const { data, error } = await supabase
    .from("daily_support_users")
    .select("*");

  if (error) {
    console.error("Supabase activate-code load error:", error);
    return [];
  }

  return (data || []).map(mapSupabaseUser);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const fullCode = String(body.code || "").trim();

const code = fullCode.includes("-")
  ? fullCode.split("-").slice(0, 2).join("-")
  : fullCode;
  if (!code) {
    return NextResponse.json({
      success: false,
      message: "Please enter an activation code.",
    });
  }

  const users = await loadUsers();

  const user = users.find(
    (u: any) => String(u.code || "").trim().toLowerCase() === code.toLowerCase()
  );

  if (!user) {
    return NextResponse.json({
      success: false,
      message: "This activation code was not found.",
    });
  }

  const isActive =
    user.status === "Active" ||
    user.paymentStatus === "Paid" ||
    user.paid === true;

  if (!isActive) {
    return NextResponse.json({
      success: false,
      message: "This code is not active yet.",
    });
  }

  const repliesLimit = Number(user.repliesLimit || 0);
  const repliesUsed = Number(user.repliesUsed || 0);
  const repliesLeft = Math.max(repliesLimit - repliesUsed, 0);

  if (repliesLeft <= 0) {
    return NextResponse.json({
      success: false,
      message: "This ticket has no credits left.",
    });
  }

  await updateAccountTicket(user, repliesLeft);

  return NextResponse.json({
    success: true,
    message: "Elvy is activated.",
    user: {
      code: user.code,
      name: user.name || "User",
      repliesLimit,
      repliesUsed,
      repliesLeft,
      status: user.status,
    },
  });
}