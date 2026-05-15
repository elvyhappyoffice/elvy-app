import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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

  saveUsers(users);

  return NextResponse.json({ success: true, users });
}