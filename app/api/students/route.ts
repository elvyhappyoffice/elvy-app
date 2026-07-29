import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const filePath = path.join(process.cwd(), "data", "students.json");
const STUDENTS_TABLE = "language_center_students";

function hasSupabaseConfig() {
  const hasUrl = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  );
  const hasKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY,
  );

  return hasUrl && hasKey;
}

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

function normalizeStatus(value: unknown) {
  const status = String(value || "Suspended");

  if (
    status === "Active" ||
    status === "Waiting Approval" ||
    status === "Suspended"
  ) {
    return status;
  }

  return "Suspended";
}

function normalizeStudent(student: any) {
  return {
    id: String(student?.id || crypto.randomUUID()),
    name: String(student?.name || ""),
    username: String(student?.username || ""),
    password: String(student?.password || ""),
    code: cleanCode(student?.code),
    nativeLanguage: String(
      student?.nativeLanguage || student?.native_language || "Arabic",
    ),
    level: String(student?.level || ""),
    sublevel: String(student?.sublevel || ""),
    unit: String(student?.unit || ""),
    lesson: safeNumber(student?.lesson, 1),
    lessonTitle: String(student?.lessonTitle || student?.lesson_title || ""),
    status: normalizeStatus(student?.status),
    passHours: safeNumber(student?.passHours ?? student?.pass_hours, 15),
    secondsRemaining: safeNumber(
      student?.secondsRemaining ?? student?.seconds_remaining,
      0,
    ),
    secondsUsed: safeNumber(student?.secondsUsed ?? student?.seconds_used, 0),
    lastMobileReplyAt: String(
      student?.lastMobileReplyAt || student?.last_mobile_reply_at || "",
    ),
    updatedAt: String(student?.updatedAt || student?.updated_at || ""),
  };
}

function mapSupabaseStudent(row: any) {
  return normalizeStudent({
    id: row.id,
    name: row.name,
    username: row.username,
    password: row.password,
    code: row.code,
    nativeLanguage: row.native_language,
    level: row.level,
    sublevel: row.sublevel,
    unit: row.unit,
    lesson: row.lesson,
    lessonTitle: row.lesson_title,
    status: row.status,
    passHours: row.pass_hours,
    secondsRemaining: row.seconds_remaining,
    secondsUsed: row.seconds_used,
    lastMobileReplyAt: row.last_mobile_reply_at,
    updatedAt: row.updated_at,
  });
}

function mapStudentToSupabase(student: any) {
  const normalized = normalizeStudent(student);

  return {
    id: normalized.id,
    name: normalized.name,
    username: normalized.username,
    password: normalized.password,
    code: normalized.code,
    native_language: normalized.nativeLanguage,
    level: normalized.level,
    sublevel: normalized.sublevel,
    unit: normalized.unit,
    lesson: normalized.lesson,
    lesson_title: normalized.lessonTitle,
    status: normalized.status,
    pass_hours: normalized.passHours,
    seconds_remaining: normalized.secondsRemaining,
    seconds_used: normalized.secondsUsed,
    last_mobile_reply_at: normalized.lastMobileReplyAt,
    updated_at: new Date().toISOString(),
  };
}

async function readStudents() {
  if (!hasSupabaseConfig()) {
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

async function addOrUpdateStudent(student: any) {
  const normalizedStudent = normalizeStudent(student);

  if (!hasSupabaseConfig()) {
    const students = await readStudentsFile();

    const exists = students.some(
      (item: any) => String(item?.id || "") === normalizedStudent.id,
    );

    const nextStudents = exists
      ? students.map((item: any) =>
          String(item?.id || "") === normalizedStudent.id
            ? normalizedStudent
            : item,
        )
      : [...students, normalizedStudent];

    await saveStudentsFile(nextStudents);
    return normalizedStudent;
  }

  const { data, error } = await supabase
    .from(STUDENTS_TABLE)
    .upsert(mapStudentToSupabase(normalizedStudent), {
      onConflict: "id",
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Supabase student upsert error:", error);
    throw error || new Error("Student upsert failed.");
  }

  return mapSupabaseStudent(data);
}

async function deleteStudentByIdOrCode(id: string, code: string) {
  if (!id && !code) {
    throw new Error("Student ID or code is required.");
  }

  if (!hasSupabaseConfig()) {
    const students = await readStudentsFile();

    const nextStudents = students.filter((student: any) => {
      const sameId = id && String(student?.id || "") === id;
      const sameCode = code && cleanCode(student?.code) === code;

      return !sameId && !sameCode;
    });

    await saveStudentsFile(nextStudents);

    return {
      deleted: nextStudents.length !== students.length,
    };
  }

  let query = supabase.from(STUDENTS_TABLE).delete();

  if (id) {
    query = query.eq("id", id);
  } else {
    query = query.eq("code", code);
  }

  const { error } = await query;

  if (error) {
    console.error("Supabase student delete error:", error);
    throw error;
  }

  return { deleted: true };
}

async function upsertStudents(students: any[]) {
  const normalizedStudents = students.map(normalizeStudent);

  if (!hasSupabaseConfig()) {
    await saveStudentsFile(normalizedStudents);
    return normalizedStudents;
  }

  if (normalizedStudents.length === 0) {
    return [];
  }

  const rows = normalizedStudents.map(mapStudentToSupabase);

  const { data, error } = await supabase
    .from(STUDENTS_TABLE)
    .upsert(rows, {
      onConflict: "id",
    })
    .select("*");

  if (error) {
    console.error("Supabase students bulk upsert error:", error);
    throw error;
  }

  return (data || []).map(mapSupabaseStudent);
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

  if (!hasSupabaseConfig()) {
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

      updatedStudent = normalizeStudent({
        ...student,
        secondsRemaining: nextRemaining,
        secondsUsed: previousUsed + secondsUsedThisTurn,
        lastMobileReplyAt: new Date().toISOString(),
        ...(nextRemaining <= 0 ? { status: "Suspended" } : {}),
      });

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
    const action = String(body?.action || "").trim().toLowerCase();

    if (action === "add" || action === "update" || action === "upsert") {
      const student = body?.student;

      if (!student || typeof student !== "object") {
        return NextResponse.json(
          { success: false, message: "Student data is required." },
          { status: 400 },
        );
      }

      const updatedStudent = await addOrUpdateStudent(student);

      return NextResponse.json({
        success: true,
        student: updatedStudent,
      });
    }

    if (action === "delete") {
      const id = String(body?.id || body?.studentId || "").trim();
      const code = cleanCode(body?.code || body?.studentCode);

      if (!id && !code) {
        return NextResponse.json(
          { success: false, message: "Student ID or code is required." },
          { status: 400 },
        );
      }

      await deleteStudentByIdOrCode(id, code);

      return NextResponse.json({
        success: true,
        deleted: true,
      });
    }

    // Safe backward compatibility:
    // If an older dashboard still sends the full array, we UPSERT rows.
    // We do NOT delete the whole table anymore.
    if (Array.isArray(body?.students)) {
      const savedStudents = await upsertStudents(body.students);

      return NextResponse.json({
        success: true,
        students: savedStudents,
      });
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
