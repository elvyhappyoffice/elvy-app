import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type FounderSettings = {
  automaticPaymentOpen: boolean;
};

const SETTINGS_FILE = path.join(process.cwd(), "data", "founderSettings.json");

const DEFAULT_SETTINGS: FounderSettings = {
  automaticPaymentOpen: false,
};

function readSettings(): FounderSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }

    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    return {
      ...DEFAULT_SETTINGS,
      ...data,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: FounderSettings) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("founder_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!error && data) {
      return NextResponse.json({
        ok: true,
        settings: {
          automaticPaymentOpen: Boolean(data.automatic_payment_open),
        },
      });
    }
  } catch (error) {
    console.log("Supabase founder settings GET fallback:", error);
  }

  const settings = readSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const settings: FounderSettings = {
      automaticPaymentOpen: Boolean(body.automaticPaymentOpen),
    };

    // Local JSON only outside Vercel
    if (!process.env.VERCEL) {
      saveSettings(settings);
    }

    // Supabase save
    const { error } = await supabase
      .from("founder_settings")
      .upsert({
        id: 1,
        automatic_payment_open: settings.automaticPaymentOpen,
      });

    if (error) {
      console.error("Founder settings Supabase save error:", error);
    }

    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not update founder settings." },
      { status: 500 }
    );
  }
}