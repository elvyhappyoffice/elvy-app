import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const ACCOUNTS_FILE = path.join(process.cwd(), "data", "elvyAccounts.json");
const STUDENTS_FILE = path.join(process.cwd(), "data", "students.json");
const STUDENTS_TABLE = "language_center_students";

function readAccounts() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function readStudents() {
  try {
    if (!fs.existsSync(STUDENTS_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(STUDENTS_FILE, "utf8"));
    return Array.isArray(data?.students) ? data.students : [];
  } catch {
    return [];
  }
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanUsername(value: unknown) {
  return cleanText(value).toLowerCase();
}

function cleanCode(value: unknown) {
  return cleanText(value).toUpperCase();
}

function safeNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function verifyPassword(password: string, stored: string) {
  const [salt, originalHash] = String(stored || "").split(":");

  if (!salt || !originalHash) return false;

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

    secondsRemaining: Number(
      account.secondsRemaining ??
      account.seconds_remaining ??
      0
    ),

    ticketStatus:
      account.ticketStatus ||
      account.ticket_status ||
      "Free",
  };
}

function mapStudentToClient(student: any) {
  return {
    id: student.id || "",
    name: student.name || "",
    username: student.username || "",
    password: student.password || "",
    code: student.code || "",
    level: student.level || "",
    sublevel: student.sublevel || "",
    unit: student.unit || "",
    lesson: safeNumber(student.lesson, 1),
    lessonTitle: student.lessonTitle || student.lesson_title || "",
    status: student.status || "Suspended",
    passHours: safeNumber(student.passHours ?? student.pass_hours, 10),
    secondsRemaining: safeNumber(
      student.secondsRemaining ?? student.seconds_remaining,
      0,
    ),
    secondsUsed: safeNumber(student.secondsUsed ?? student.seconds_used, 0),
  };
}

async function findStudentAccount(
  username: string,
  password: string,
  studentCode: string,
) {
  if (!studentCode.startsWith("STUDENT-")) return null;

  if (process.env.VERCEL) {
    const { data, error } = await supabase
      .from(STUDENTS_TABLE)
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .eq("code", studentCode)
      .single();

    if (error || !data) {
      console.error("Student login lookup failed:", error);
      return null;
    }

    return mapStudentToClient(data);
  }

  const students = readStudents();

  const student = students.find((item: any) => {
    return (
      cleanUsername(item?.username) === username &&
      cleanText(item?.password) === password &&
      cleanCode(item?.code) === studentCode
    );
  });

  return student ? mapStudentToClient(student) : null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const username = cleanUsername(body.username);
  const password = cleanText(body.password);
  const studentCode = cleanCode(body.studentCode || body.code || body.userCode);

  if (!username || !password) {
    return NextResponse.json(
      {
        ok: false,
        error: "Username and password are required.",
      },
      { status: 400 }
    );
  }

  if (studentCode.startsWith("STUDENT-")) {
    const student = await findStudentAccount(username, password, studentCode);

    if (!student) {
      return NextResponse.json(
        {
          ok: false,
          error: "This student account was not found. Please contact the language center.",
        },
        { status: 401 },
      );
    }

    if (student.status === "Suspended") {
      return NextResponse.json(
        {
          ok: false,
          error: "This student account is suspended. Please contact the language center.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      studentMode: true,
      studentProfile: student,
      account: {
        username: student.username,
        displayName: student.name || student.username,
        userCode: student.code,
        creditsLeft: 0,
        secondsRemaining: student.secondsRemaining,
        ticketStatus: "StudentActive",
      },
    });
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
      secondsRemaining: data.seconds_remaining ?? 0,
      ticketStatus: data.ticket_status,
    };
  } else {
    accounts = readAccounts();

    account = accounts.find(
      (a: any) => cleanUsername(a.username) === username
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
