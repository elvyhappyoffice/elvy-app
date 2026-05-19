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
  if (!process.env.VERCEL) {
    const settings = readSettings();
    return NextResponse.json({ ok: true, settings });
  }

  try {
    const { data, error } = await supabase
      .from("founder_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Founder settings Supabase GET error:", error);
      return NextResponse.json(
        {
          ok: false,
          error: "Could not load founder settings from Supabase.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      const { error: insertError } = await supabase
        .from("founder_settings")
        .upsert({
          id: 1,
          automatic_payment_open: DEFAULT_SETTINGS.automaticPaymentOpen,
        });

      if (insertError) {
        console.error("Founder settings Supabase default save error:", insertError);
      }

      return NextResponse.json({ ok: true, settings: DEFAULT_SETTINGS });
    }

    return NextResponse.json({
      ok: true,
      settings: {
        automaticPaymentOpen: Boolean(data.automatic_payment_open),
      },
    });
  } catch (error: any) {
    console.error("Founder settings Supabase GET failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Could not load founder settings.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const settings: FounderSettings = {
      automaticPaymentOpen: Boolean(body.automaticPaymentOpen),
    };

    if (!process.env.VERCEL) {
      saveSettings(settings);
      return NextResponse.json({ ok: true, settings });
    }

    const { error } = await supabase
      .from("founder_settings")
      .upsert({
        id: 1,
        automatic_payment_open: settings.automaticPaymentOpen,
      });

    if (error) {
      console.error("Founder settings Supabase save error:", error);
      return NextResponse.json(
        {
          ok: false,
          error: "Could not update founder settings in Supabase.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, settings });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Could not update founder settings.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
