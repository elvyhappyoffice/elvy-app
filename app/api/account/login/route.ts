import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ACCOUNTS_FILE = path.join(process.cwd(), "data", "elvyAccounts.json");

function readAccounts() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function verifyPassword(password: string, stored: string) {
  const [salt, originalHash] = stored.split(":");

  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  return hash === originalHash;
}

function mapAccountToClient(account: any) {
  return {
    username: account.username,
    displayName:
      account.displayName ||
      account.display_name ||
      account.username,
    userCode:
      account.userCode ||
      account.user_code,
    creditsLeft: Number(
      account.creditsLeft ??
      account.credits_left ??
      0
    ),
    ticketStatus:
      account.ticketStatus ||
      account.ticket_status ||
      "Free",
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const username = String(body.username || "")
    .trim()
    .toLowerCase();

  const password = String(body.password || "").trim();

  if (!username || !password) {
    return NextResponse.json(
      {
        ok: false,
        error: "Username and password are required.",
      },
      { status: 400 }
    );
  }

  let account: any = null;
  let accounts: any[] = [];

  if (process.env.VERCEL) {
    const { data, error } = await supabase
      .from("elvy_accounts")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid username or password.",
        },
        { status: 401 }
      );
    }

    account = {
      username: data.username,
      passwordHash: data.password_hash,
      displayName: data.display_name,
      userCode: data.user_code,
      creditsLeft: data.credits_left,
      ticketStatus: data.ticket_status,
    };
  } else {
    accounts = readAccounts();

    account = accounts.find(
      (a: any) => a.username === username
    );

    if (!account) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid username or password.",
        },
        { status: 401 }
      );
    }
  }

  const validPassword = verifyPassword(
    password,
    account.passwordHash
  );

  if (!validPassword) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid username or password.",
      },
      { status: 401 }
    );
  }

  account.lastLoginAt = new Date().toISOString();

  if (process.env.VERCEL) {
    await supabase
      .from("elvy_accounts")
      .update({
        last_login_at: account.lastLoginAt,
      })
      .eq("username", username);
  } else {
    fs.writeFileSync(
      ACCOUNTS_FILE,
      JSON.stringify(accounts, null, 2)
    );
  }

  return NextResponse.json({
    ok: true,
    account: mapAccountToClient(account),
  });
}