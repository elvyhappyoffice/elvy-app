import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "curriculum.json");

export async function GET() {
  try {
    const file = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(file);

    return NextResponse.json({
      success: true,
      curriculum: data,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Could not load curriculum.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    await fs.writeFile(
      filePath,
      JSON.stringify(body, null, 2),
      "utf8"
    );

    return NextResponse.json({
      success: true,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Could not save curriculum.",
      },
      { status: 500 }
    );
  }
}