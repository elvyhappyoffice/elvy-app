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
  const code = String(body.code || "").trim();

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