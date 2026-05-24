import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const USERS_FILE = path.join(
  process.cwd(),
  "data",
  "dailySupportUsers.json"
);

function readUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];

    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") || "";

  if (!code.trim()) {
    return NextResponse.json({
      success: false,
      messages: [],
    });
  }

  if (process.env.VERCEL) {
    const { data, error } = await supabase
      .from("daily_support_users")
      .select("admin_messages")
      .eq("code", code.trim())
      .single();

    if (error || !data) {
      return NextResponse.json({
        success: false,
        messages: [],
      });
    }

    return NextResponse.json({
      success: true,
      messages: data.admin_messages || [],
    });
  }

  const users = readUsers();

  const user = users.find(
    (u: any) =>
      String(u.code || "").trim().toLowerCase() ===
      code.trim().toLowerCase()
  );

  if (!user) {
    return NextResponse.json({
      success: false,
      messages: [],
    });
  }

  return NextResponse.json({
    success: true,
    messages: user.adminMessages || [],
  });
}