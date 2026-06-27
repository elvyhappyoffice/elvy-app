import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "students.json");

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

export async function GET() {
  try {
    const students = await readStudentsFile();

    return NextResponse.json({
      success: true,
      students,
    });
  } catch {
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
      await saveStudentsFile(body.students);
      return NextResponse.json({ success: true, students: body.students });
    }

    // Mobile ticket sync: update only one student's remaining ticket time.
    const code = cleanCode(body?.code || body?.studentCode);
    const id = String(body?.id || body?.studentId || "").trim();

    if (!code && !id) {
      return NextResponse.json(
        {
          success: false,
          message: "Student code or ID is required.",
        },
        { status: 400 },
      );
    }

    const students = await readStudentsFile();

    let updatedStudent: any = null;

    const updatedStudents = students.map((student: any) => {
      const sameCode =
        code && cleanCode(student?.code) === code;
      const sameId =
        id && String(student?.id || "").trim() === id;

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
      return NextResponse.json(
        {
          success: false,
          message: "Student not found.",
        },
        { status: 404 },
      );
    }

    await saveStudentsFile(updatedStudents);

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
