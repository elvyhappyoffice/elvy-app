import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const defaultChatId = process.env.TELEGRAM_CHAT_ID;
    const text = body.message || body.text;
    const chatId = body.chatId || defaultChatId;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: "Missing TELEGRAM_BOT_TOKEN",
      });
    }

    if (!chatId) {
      return NextResponse.json({
        success: false,
        error: "Missing chat ID",
      });
    }

    if (!text) {
      return NextResponse.json({
        success: false,
        error: "Missing message text",
      });
    }

    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      }
    );

    const telegram = await res.json();

    return NextResponse.json({
      success: telegram.ok === true,
      telegram,
    });
  } catch {
    return NextResponse.json({
      success: false,
      error: "Failed to send Telegram message",
    });
  }
}

export async function GET() {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: "Missing TELEGRAM_BOT_TOKEN",
      });
    }

    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates`
    );

    const data = await res.json();

    const users =
      data.result
        ?.filter((u: any) => u.message?.chat?.username)
        .map((u: any) => ({
          username: "@" + u.message.chat.username,
          chatId: String(u.message.chat.id),
          firstName: u.message.chat.first_name || "",
          lastName: u.message.chat.last_name || "",
        })) || [];

    return NextResponse.json({
      success: true,
      users,
    });
  } catch {
    return NextResponse.json({
      success: false,
      error: "Failed to sync Telegram users",
    });
  }
}