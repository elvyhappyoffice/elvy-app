import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const filePath = path.join(process.cwd(), "data", "curriculum.json");
const CURRICULUM_TABLE = "language_center_curriculum";
const CURRICULUM_ID = "main";

const starterCurriculum = {
  levels: [
    {
      id: "level-a",
      title: "LEVEL A",
      sublevels: [
        {
          id: "a1",
          title: "A1",
          units: [
            {
              id: "unit-hello",
              title: "Hello",
              lessons: [
                { id: "lesson-1", title: "Greetings" },
                { id: "lesson-2", title: "Asking Names" },
              ],
            },
          ],
        },
      ],
    },
    { id: "level-b", title: "LEVEL B", sublevels: [] },
    { id: "level-c", title: "LEVEL C", sublevels: [] },
  ],
};

async function readLocalCurriculum() {
  try {
    const file = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(file);

    if (Array.isArray(data?.levels)) {
      return data;
    }

    return starterCurriculum;
  } catch {
    return starterCurriculum;
  }
}

async function saveLocalCurriculum(curriculum: any) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(
    filePath,
    JSON.stringify(curriculum, null, 2),
    "utf8",
  );
}

function normalizeCurriculum(value: any) {
  if (Array.isArray(value?.levels)) {
    return value;
  }

  if (Array.isArray(value?.curriculum?.levels)) {
    return value.curriculum;
  }

  return starterCurriculum;
}

export async function GET() {
  try {
    if (!process.env.VERCEL) {
      const curriculum = await readLocalCurriculum();

      return NextResponse.json({
        success: true,
        curriculum,
      });
    }

    const { data, error } = await supabase
      .from(CURRICULUM_TABLE)
      .select("curriculum")
      .eq("id", CURRICULUM_ID)
      .maybeSingle();

    if (error) {
      console.error("Supabase curriculum load error:", error);

      return NextResponse.json(
        {
          success: false,
          message: "Could not load curriculum.",
        },
        { status: 500 },
      );
    }

    const curriculum = normalizeCurriculum(data?.curriculum);

    return NextResponse.json({
      success: true,
      curriculum,
    });
  } catch (error) {
    console.error("Curriculum load failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not load curriculum.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const curriculum = normalizeCurriculum(body);

    if (!process.env.VERCEL) {
      await saveLocalCurriculum(curriculum);

      return NextResponse.json({
        success: true,
        curriculum,
      });
    }

    const { error } = await supabase
      .from(CURRICULUM_TABLE)
      .upsert(
        {
          id: CURRICULUM_ID,
          curriculum,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (error) {
      console.error("Supabase curriculum save error:", error);

      return NextResponse.json(
        {
          success: false,
          message: "Could not save curriculum.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      curriculum,
    });
  } catch (error) {
    console.error("Curriculum save failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Could not save curriculum.",
      },
      { status: 500 },
    );
  }
}
