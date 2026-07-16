import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ACCOUNTS_FILE = path.join(
  process.cwd(),
  "data",
  "elvyAccounts.json"
);

const USERS_FILE = path.join(
  process.cwd(),
  "data",
  "dailySupportUsers.json"
);

function readAccounts() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return [];

    return JSON.parse(
      fs.readFileSync(ACCOUNTS_FILE, "utf8")
    );
  } catch {
    return [];
  }
}

function saveAccounts(accounts: any[]) {
  const dir = path.dirname(ACCOUNTS_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    ACCOUNTS_FILE,
    JSON.stringify(accounts, null, 2)
  );
}

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];

    return JSON.parse(
      fs.readFileSync(USERS_FILE, "utf8")
    );
  } catch {
    return [];
  }
}

function saveUsers(users: any[]) {
  const dir = path.dirname(USERS_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    USERS_FILE,
    JSON.stringify(users, null, 2)
  );
}

function hashPassword(password: string) {
  const salt = crypto
    .randomBytes(16)
    .toString("hex");

  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  return `${salt}:${hash}`;
}

function mapAccountToClient(account: any) {
  return {
    username: account.username,
    displayName: account.displayName || account.display_name || account.username,
    userCode: account.userCode || account.user_code,
    creditsLeft: Number(account.creditsLeft ?? account.credits_left ?? 0),
    secondsRemaining: Number(account.secondsRemaining ?? account.seconds_remaining ?? 0),
    ticketStatus: account.ticketStatus || account.ticket_status || "Free",
  };
}

async function createSupabaseAccount(
  username: string,
  passwordHash: string,
  displayName: string,
  userCode: string
) {
  const { error: accountError } = await supabase
    .from("elvy_accounts")
    .insert({
      username,
      password_hash: passwordHash,
      display_name: displayName,
      user_code: userCode,
      credits_left: 3,
      seconds_remaining: 54000,
      ticket_status: "Free",
      last_messages: [],
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    });

  if (accountError) {
    if (
      accountError.code === "23505" ||
      accountError.message.toLowerCase().includes("duplicate")
    ) {
      return {
        ok: false,
        status: 409,
        error: "This username is already used.",
      };
    }

    console.error("Supabase account register error:", accountError);

    return {
      ok: false,
      status: 500,
      error: "Could not create account.",
    };
  }

  const { error: userError } = await supabase
    .from("daily_support_users")
    .upsert(
      {
        code: userCode,
        name: displayName,
        age_group: "18–30",
        help_type: "Free trial",
        contact_method: "Mobile",
        contact_value: username,
        status: "Pending",
        replies_limit: 3,
        replies_used: 0,
        admin_messages: [],
        user_messages: [],
        memory: {
          account: true,
          username,
          createdAt: new Date().toISOString(),
        },
        payment_notice_sent: false,
        paid: false,
        payment_status: "Unpaid",
        last_mobile_reply_at: "",
      },
      {
        onConflict: "code",
      }
    );

  if (userError) {
    console.error("Supabase dashboard user register error:", userError);
  }

  return {
    ok: true,
    account: {
      username,
      displayName,
      userCode,
      creditsLeft: 3,
      secondsRemaining: 54000,
      ticketStatus: "Free",
    },
  };
}


export async function POST(req: NextRequest) {
  const body = await req.json();

  const username = String(body.username || "")
    .trim()
    .toLowerCase();

  const password = String(body.password || "").trim();

  const displayName = String(
    body.displayName || username
  ).trim();

  if (!username || !password) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Username and password are required.",
      },
      { status: 400 }
    );
  }

  const userCode = `ELVY-${Date.now()}`;
  const passwordHash = hashPassword(password);

  if (process.env.VERCEL) {
    const result = await createSupabaseAccount(
      username,
      passwordHash,
      displayName,
      userCode
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
        },
        { status: result.status || 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      account: result.account,
    });
  }

  const accounts = readAccounts();

  if (
    accounts.some(
      (a: any) => a.username === username
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This username is already used.",
      },
      { status: 409 }
    );
  }

  const account = {
    username,
    passwordHash,
    displayName,
    userCode,
    creditsLeft: 3,
    secondsRemaining: 54000,
    ticketStatus: "Free",
    lastMessages: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  accounts.push(account);

  saveAccounts(accounts);

  const users = readUsers();

  users.push({
    code: userCode,
    name: displayName,
    ageGroup: "18–30",
    helpType: "Free trial",
    contactMethod: "Mobile",
    contactValue: username,
    status: "Pending",
    repliesLimit: 3,
    repliesUsed: 0,
    repliesLeft: 3,
    secondsRemaining: 54000,
    activated: true,
    adminMessages: [],
    userMessages: [],
    memory: {
      account: true,
      username,
      createdAt: new Date().toISOString(),
    },
    paymentNoticeSent: false,
    paid: false,
    paymentStatus: "Unpaid",
    createdAt: new Date().toISOString(),
  });

  saveUsers(users);

  return NextResponse.json({
    ok: true,
    account: mapAccountToClient(account),
  });
}