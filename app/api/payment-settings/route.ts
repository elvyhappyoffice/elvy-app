import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type PaymentSettings = {
  paypalActive: boolean;
  paypalLink: string;
  skrillActive: boolean;
  skrillLink: string;
};

const SETTINGS_FILE = path.join(process.cwd(), "data", "paymentSettings.json");

const DEFAULT_SETTINGS: PaymentSettings = {
  paypalActive: false,
  paypalLink: "",
  skrillActive: false,
  skrillLink: "",
};

function readSettings(): PaymentSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }

    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: PaymentSettings) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("payment_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!error && data) {
      return NextResponse.json({
        ok: true,
        settings: {
          paypalActive: Boolean(data.paypal_active),
          paypalLink: data.paypal_link || "",
          skrillActive: Boolean(data.skrill_active),
          skrillLink: data.skrill_link || "",
        },
      });
    }
  } catch (error) {
    console.log("Supabase payment settings GET fallback:", error);
  }

  return NextResponse.json({
    ok: true,
    settings: readSettings(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const settings: PaymentSettings = {
      paypalActive: Boolean(body.paypalActive),
      paypalLink: String(body.paypalLink || "").trim(),
      skrillActive: Boolean(body.skrillActive),
      skrillLink: String(body.skrillLink || "").trim(),
    };

    // Local JSON only outside Vercel
    if (!process.env.VERCEL) {
      saveSettings(settings);
    }

    // Supabase save
    const { error } = await supabase
      .from("payment_settings")
      .upsert({
        id: 1,
        paypal_active: settings.paypalActive,
        paypal_link: settings.paypalLink,
        skrill_active: settings.skrillActive,
        skrill_link: settings.skrillLink,
      });

    if (error) {
      console.error("Payment settings Supabase save error:", error);
    }

    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not update payment settings." },
      { status: 500 }
    );
  }
}