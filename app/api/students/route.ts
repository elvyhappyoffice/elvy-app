import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const filePath = path.join(process.cwd(), "data", "students.json");
const STUDENTS_TABLE = "language_center_students";

async function readStudentsFile() {
  try {
    const file = await fs.readFile(filePath, "utf8");
    const data = JSON.parse(file);

    return Array.isArray(data?.students) ? data.students : [];
  } catch {
    return [];
  }
}

async function saveStudentsFile(students: any[]) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(
    filePath,
    JSON.stringify({ students }, null, 2),
    "utf8",
  );
}

function cleanCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function safeNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function mapSupabaseStudent(row: any) {
  return {
    id: row.id || "",
    name: row.name || "",
    username: row.username || "",
    password: row.password || "",
    code: row.code || "",
    level: row.level || "",
    sublevel: row.sublevel || "",
    unit: row.unit || "",
    lesson: safeNumber(row.lesson, 1),
    lessonTitle: row.lesson_title || "",
    status: row.status || "Suspended",
    passHours: safeNumber(row.pass_hours, 10),
    secondsRemaining: safeNumber(row.seconds_remaining, 0),
    secondsUsed: safeNumber(row.seconds_used, 0),
    lastMobileReplyAt: row.last_mobile_reply_at || "",
    updatedAt: row.updated_at || "",
  };
}

function mapStudentToSupabase(student: any) {
  return {
    id: String(student?.id || crypto.randomUUID()),
    name: String(student?.name || ""),
    username: String(student?.username || ""),
    password: String(student?.password || ""),
    code: cleanCode(student?.code),
    level: String(student?.level || ""),
    sublevel: String(student?.sublevel || ""),
    unit: String(student?.unit || ""),
    lesson: safeNumber(student?.lesson, 1),
    lesson_title: String(student?.lessonTitle || student?.lesson_title || ""),
    status: String(student?.status || "Suspended"),
    pass_hours: safeNumber(student?.passHours ?? student?.pass_hours, 10),
    seconds_remaining: safeNumber(
      student?.secondsRemaining ?? student?.seconds_remaining,
      0,
    ),
    seconds_used: safeNumber(student?.secondsUsed ?? student?.seconds_used, 0),
    last_mobile_reply_at: String(
      student?.lastMobileReplyAt || student?.last_mobile_reply_at || "",
    ),
    updated_at: new Date().toISOString(),
  };
}

async function readStudents() {
  if (!process.env.VERCEL) {
    return readStudentsFile();
  }

  const { data, error } = await supabase
    .from(STUDENTS_TABLE)
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Supabase students load error:", error);
    return [];
  }

  return (data || []).map(mapSupabaseStudent);
}

async function replaceStudents(students: any[]) {
  if (!process.env.VERCEL) {
    await saveStudentsFile(students);
    return;
  }

  const { error: deleteError } = await supabase
    .from(STUDENTS_TABLE)
    .delete()
    .neq("id", "__never_matching_id__");

  if (deleteError) {
    console.error("Supabase students delete before replace error:", deleteError);
    throw deleteError;
  }

  if (students.length === 0) return;

  const rows = students.map(mapStudentToSupabase);

  const { error: insertError } = await supabase
    .from(STUDENTS_TABLE)
    .insert(rows);

  if (insertError) {
    console.error("Supabase students replace error:", insertError);
    throw insertError;
  }
}

async function syncOneStudentTicket(body: any) {
  const code = cleanCode(body?.code || body?.studentCode);
  const id = String(body?.id || body?.studentId || "").trim();

  if (!code && !id) {
    return {
      response: NextResponse.json(
        {
          success: false,
          message: "Student code or ID is required.",
        },
        { status: 400 },
      ),
    };
  }

  if (!process.env.VERCEL) {
    const students = await readStudentsFile();
    let updatedStudent: any = null;

    const updatedStudents = students.map((student: any) => {
      const sameCode = code && cleanCode(student?.code) === code;
      const sameId = id && String(student?.id || "").trim() === id;

      if (!sameCode && !sameId) return student;

      const previousRemaining = safeNumber(
        student?.secondsRemaining ?? student?.seconds_remaining,
        0,
      );
      const previousUsed = safeNumber(
        student?.secondsUsed ?? student?.seconds_used,
        0,
      );

      const nextRemaining = Math.max(
        0,
        Math.floor(
          safeNumber(
            body?.secondsRemaining ?? body?.seconds_remaining,
            previousRemaining,
          ),
        ),
      );

      const secondsUsedThisTurn = Math.max(
        0,
        Math.floor(
          safeNumber(
            body?.secondsUsedThisTurn ?? body?.secondsUsed ?? body?.seconds_used,
            0,
          ),
        ),
      );

      updatedStudent = {
        ...student,
        secondsRemaining: nextRemaining,
        secondsUsed: previousUsed + secondsUsedThisTurn,
        lastMobileReplyAt: new Date().toISOString(),
      };

      if (nextRemaining <= 0) {
        updatedStudent.status = "Suspended";
        updatedStudent.ticketStatus = "Expired";
      }

      return updatedStudent;
    });

    if (!updatedStudent) {
      return {
        response: NextResponse.json(
          {
            success: false,
            message: "Student not found.",
          },
          { status: 404 },
        ),
      };
    }

    await saveStudentsFile(updatedStudents);

    return { updatedStudent };
  }

  let query = supabase.from(STUDENTS_TABLE).select("*");

  if (code) {
    query = query.eq("code", code);
  } else {
    query = query.eq("id", id);
  }

  const { data, error: loadError } = await query.single();

  if (loadError || !data) {
    console.error("Supabase student ticket load error:", loadError);
    return {
      response: NextResponse.json(
        {
          success: false,
          message: "Student not found.",
        },
        { status: 404 },
      ),
    };
  }

  const previousRemaining = safeNumber(data.seconds_remaining, 0);
  const previousUsed = safeNumber(data.seconds_used, 0);

  const nextRemaining = Math.max(
    0,
    Math.floor(
      safeNumber(
        body?.secondsRemaining ?? body?.seconds_remaining,
        previousRemaining,
      ),
    ),
  );

  const secondsUsedThisTurn = Math.max(
    0,
    Math.floor(
      safeNumber(
        body?.secondsUsedThisTurn ?? body?.secondsUsed ?? body?.seconds_used,
        0,
      ),
    ),
  );

  const updatePayload = {
    seconds_remaining: nextRemaining,
    seconds_used: previousUsed + secondsUsedThisTurn,
    last_mobile_reply_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...(nextRemaining <= 0 ? { status: "Suspended" } : {}),
  };

  const { data: updatedData, error: updateError } = await supabase
    .from(STUDENTS_TABLE)
    .update(updatePayload)
    .eq("id", data.id)
    .select("*")
    .single();

  if (updateError || !updatedData) {
    console.error("Supabase student ticket update error:", updateError);
    return {
      response: NextResponse.json(
        {
          success: false,
          message: "Could not update student ticket.",
        },
        { status: 500 },
      ),
    };
  }

  return { updatedStudent: mapSupabaseStudent(updatedData) };
}

export async function GET() {
  try {
    const students = await readStudents();

    return NextResponse.json({
      success: true,
      students,
    });
  } catch (error) {
    console.error("Students load failed:", error);

    return NextResponse.json({
      success: true,
      students: [],
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Full dashboard save: keeps the existing Students Dashboard behavior.
    if (Array.isArray(body?.students)) {
      await replaceStudents(body.students);
      return NextResponse.json({ success: true, students: body.students });
    }

    // Mobile ticket sync: update only one student's remaining ticket time.
    const result = await syncOneStudentTicket(body);

    if (result.response) return result.response;

    const updatedStudent = result.updatedStudent;

    return NextResponse.json({
      success: true,
      student: updatedStudent,
      secondsRemaining: updatedStudent.secondsRemaining,
      secondsUsed: updatedStudent.secondsUsed,
    });
  } catch (error) {
    console.error("Students save failed:", error);

    return NextResponse.json(
      { success: false, message: "Could not save students." },
      { status: 500 },
    );
  }
}
