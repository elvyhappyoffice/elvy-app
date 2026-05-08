import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const PAYMENT_SECRET =
  process.env.PAYMENT_SECRET || "change-this-secret-later";

function signPayment(code: string, method: string) {
  return crypto
    .createHmac("sha256", PAYMENT_SECRET)
    .update(`${code}:${method}`)
    .digest("hex");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const code = String(searchParams.get("code") || "").trim();
  const method = String(searchParams.get("method") || "").trim();
  const signature = String(searchParams.get("signature") || "").trim();

  const expectedSignature = signPayment(code, method);

  if (!code || !method || signature !== expectedSignature) {
    return NextResponse.json(
      { ok: false, error: "Invalid payment link." },
      { status: 403 }
    );
  }

  return new NextResponse(
    `
    <html>
      <body style="font-family: Arial; padding: 40px;">
        <h2>Happy Office Test Payment</h2>
        <p>User code: <strong>${code}</strong></p>
        <p>Method: <strong>${method}</strong></p>

        <form method="POST" action="/api/payment/mock-pay">
          <input type="hidden" name="code" value="${code}" />
          <input type="hidden" name="method" value="${method}" />
          <input type="hidden" name="signature" value="${signature}" />
          <button
            type="submit"
            style="padding: 12px 20px; background: green; color: white; border: none; border-radius: 6px;"
          >
            Simulate Successful Payment
          </button>
        </form>
      </body>
    </html>
    `,
    {
      headers: {
        "Content-Type": "text/html",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const code = String(formData.get("code") || "").trim();
  const method = String(formData.get("method") || "").trim();
  const signature = String(formData.get("signature") || "").trim();

  const expectedSignature = signPayment(code, method);

  if (!code || !method || signature !== expectedSignature) {
    return NextResponse.json(
      { ok: false, error: "Invalid payment confirmation." },
      { status: 403 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const res = await fetch(`${siteUrl}/api/payment/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      method,
      reference: `MOCK-${Date.now()}`,
    }),
  });

  const data = await res.json();

  return NextResponse.json(data);
}