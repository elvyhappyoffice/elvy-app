// TODO: Simplified student ticket timing model
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type StudentStatus = "Active" | "Waiting Approval" | "Suspended";

type Lesson = {
  id: string;
  title: string;
  fileName?: string;
  fileText?: string;
};

type Unit = {
  id: string;
  title: string;
  lessons: Lesson[];
};

type Sublevel = {
  id: string;
  title: string;
  units: Unit[];
};

type Level = {
  id: string;
  title: string;
  sublevels: Sublevel[];
};

type Student = {
  id: string;
  name: string;
  username: string;
  password: string;
  code: string;
  level: string;
  sublevel: string;
  unit: string;
  lesson: number;
  lessonTitle?: string;
  status: StudentStatus;
  passHours: number;
  secondsRemaining: number;
  secondsUsed: number;
};

const DEFAULT_TICKET_HOURS = 15;

const initialStudents: Student[] = [
  {
    id: "student-1",
    name: "Ahmed RAM",
    username: "ahmed021",
    password: "X7P9K2",
    code: "STUDENT-A7K9X2",
    level: "LEVEL A",
    sublevel: "A1",
    unit: "Hello",
    lesson: 1,
    lessonTitle: "Greetings",
    status: "Active",
    passHours: DEFAULT_TICKET_HOURS,
    secondsRemaining: DEFAULT_TICKET_HOURS * 60 * 60,
    secondsUsed: 0,
  },
];

function generatePassword() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function generateStudentCode() {
  return `STUDENT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function makeUsername(name: string) {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  const number = Math.floor(100 + Math.random() * 900);
  return `${clean}${number}`;
}

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

function statusBadgeClasses(status: StudentStatus) {
  if (status === "Active") {
    return "bg-green-100 text-green-700";
  }

  if (status === "Waiting Approval") {
    return "bg-yellow-100 text-yellow-700";
  }

  return "bg-red-100 text-red-700";
}

function formatTicketTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));

  if (safeSeconds <= 0) {
    return "Expired";
  }

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  return `${hours}h ${String(minutes).padStart(2, "0")}m left`;
}

function createDefaultTicket() {
  return {
    passHours: DEFAULT_TICKET_HOURS,
    secondsRemaining: DEFAULT_TICKET_HOURS * 60 * 60,
    secondsUsed: 0,
  };
}

function normalizeStatus(status: unknown): StudentStatus {
  if (
    status === "Active" ||
    status === "Waiting Approval" ||
    status === "Suspended"
  ) {
    return status;
  }

  return "Suspended";
}

function normalizeStudent(student: any): Student {
  const passHours = Number(student?.passHours ?? DEFAULT_TICKET_HOURS);
  const fallbackSeconds = passHours * 60 * 60;

  return {
    id: String(student?.id || crypto.randomUUID()),
    name: String(student?.name || "Unnamed Student"),
    username: String(student?.username || makeUsername(student?.name || "student")),
    password: String(student?.password || generatePassword()),
    code: String(student?.code || generateStudentCode()),
    level: String(student?.level || ""),
    sublevel: String(student?.sublevel || ""),
    unit: String(student?.unit || ""),
    lesson: Number(student?.lesson || 1),
    lessonTitle: student?.lessonTitle || "",
    status: normalizeStatus(student?.status),
    passHours,
    secondsRemaining: Number(student?.secondsRemaining ?? fallbackSeconds),
    secondsUsed: Number(student?.secondsUsed ?? 0),
  };
}

function selectFromList<T extends { title: string }>(
  label: string,
  items: T[],
): T | null {
  if (items.length === 0) {
    alert(
      `No ${label.toLowerCase()} found. Please add it in the Curriculum Dashboard first.`,
    );
    return null;
  }

  const listText = items
    .map((item, index) => `${index + 1}. ${item.title}`)
    .join("\n");

  const answer = prompt(`Choose ${label}:\n\n${listText}\n\nType the number:`);
  if (!answer) return null;

  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    alert("Invalid choice.");
    return null;
  }

  return items[index];
}

export default function StudentsDashboard() {
  const [students, setStudents] = useState<Student[]>(
    initialStudents.map(normalizeStudent),
  );
  const [curriculumLevels, setCurriculumLevels] = useState<Level[]>([]);
  const [curriculumStatus, setCurriculumStatus] = useState(
    "Loading curriculum...",
  );
  const [studentsStatus, setStudentsStatus] = useState("Loading students...");
  const hasLoadedStudentsRef = useRef(false);
  const saveStudentsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    async function loadCurriculum() {
      try {
        const response = await fetch("/api/curriculum", { cache: "no-store" });
        const data = await response.json();

        if (data?.success && Array.isArray(data?.curriculum?.levels)) {
          setCurriculumLevels(data.curriculum.levels);
          setCurriculumStatus("Curriculum connected.");
          return;
        }

        setCurriculumStatus("Curriculum not loaded.");
      } catch (error) {
        console.error("Curriculum load failed:", error);
        setCurriculumStatus("Curriculum connection failed.");
      }
    }

    loadCurriculum();
  }, []);

  useEffect(() => {
    async function loadStudents() {
      try {
        const response = await fetch("/api/students", { cache: "no-store" });
        const data = await response.json();

        if (data?.success && Array.isArray(data?.students)) {
          setStudents(data.students.map(normalizeStudent));
          setStudentsStatus("Students loaded.");
        } else {
          setStudentsStatus("Using starter students.");
        }
      } catch (error) {
        console.error("Students load failed:", error);
        setStudentsStatus("Could not load saved students.");
      } finally {
        hasLoadedStudentsRef.current = true;
      }
    }

    loadStudents();
  }, []);

  useEffect(() => {
    if (!hasLoadedStudentsRef.current) return;

    if (saveStudentsTimerRef.current) {
      clearTimeout(saveStudentsTimerRef.current);
    }

    setStudentsStatus("Saving students...");

    saveStudentsTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/students", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ students }),
        });

        if (!response.ok) {
          throw new Error("Save request failed.");
        }

        setStudentsStatus("Students saved.");
      } catch (error) {
        console.error("Students save failed:", error);
        setStudentsStatus("Students save failed.");
      }
    }, 500);

    return () => {
      if (saveStudentsTimerRef.current) {
        clearTimeout(saveStudentsTimerRef.current);
      }
    };
  }, [students]);

  function chooseCurriculumPath() {
    const level = selectFromList("Level", curriculumLevels);
    if (!level) return null;

    const sublevel = selectFromList("Sublevel", level.sublevels);
    if (!sublevel) return null;

    const unit = selectFromList("Unit", sublevel.units);
    if (!unit) return null;

    const lesson = selectFromList("Lesson", unit.lessons);
    if (!lesson) return null;

    const lessonIndex = unit.lessons.findIndex((item) => item.id === lesson.id);

    return {
      level: level.title,
      sublevel: sublevel.title,
      unit: unit.title,
      lesson: lessonIndex + 1,
      lessonTitle: lesson.title,
    };
  }

  function addStudent() {
    const name = cleanText(prompt("Student full name, example: Ahmed RAM"));
    if (!name) return;

    const selectedPath = chooseCurriculumPath();
    if (!selectedPath) return;

    const newStudent: Student = {
      id: crypto.randomUUID(),
      name,
      username: makeUsername(name),
      password: generatePassword(),
      code: generateStudentCode(),
      ...selectedPath,
      status: "Suspended",
      ...createDefaultTicket(),
    };

    setStudents((prev) => [...prev, newStudent]);
  }

  function editStudent(id: string) {
    const student = students.find((item) => item.id === id);
    if (!student) return;

    const name = cleanText(prompt("Edit student name", student.name));
    if (!name) return;

    const changeCurriculum = window.confirm(
      "Do you want to change this student's level / sublevel / unit / lesson?",
    );

    const selectedPath = changeCurriculum ? chooseCurriculumPath() : null;

    const statusAnswer = prompt(
      "Status: Active / Waiting Approval / Suspended",
      student.status,
    );

    const cleanStatus = cleanText(statusAnswer) as StudentStatus;
    const nextStatus: StudentStatus =
      cleanStatus === "Active" ||
      cleanStatus === "Waiting Approval" ||
      cleanStatus === "Suspended"
        ? cleanStatus
        : student.status;

    const ticketAnswer = prompt(
      "Ticket hours. Leave empty to keep current time.",
      String(student.passHours || DEFAULT_TICKET_HOURS),
    );
    const cleanTicketHours = Number(ticketAnswer);
    const shouldUpdateTicket =
      ticketAnswer !== null && ticketAnswer.trim() !== "" && cleanTicketHours > 0;

    setStudents((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              name,
              ...(selectedPath || {}),
              status: nextStatus,
              ...(shouldUpdateTicket
                ? {
                    passHours: cleanTicketHours,
                    secondsRemaining: cleanTicketHours * 60 * 60,
                    secondsUsed: 0,
                  }
                : {}),
            }
          : item,
      ),
    );
  }

  function deleteStudent(id: string) {
    const student = students.find((item) => item.id === id);
    if (!student) return;

    const confirmed = window.confirm(`Delete ${student.name}?`);
    if (!confirmed) return;

    setStudents((prev) => prev.filter((item) => item.id !== id));
  }

  function findStudentCurriculumPath(student: Student) {
    const level = curriculumLevels.find((item) => item.title === student.level);
    const sublevel = level?.sublevels.find(
      (item) => item.title === student.sublevel,
    );
    const unit = sublevel?.units.find((item) => item.title === student.unit);

    if (!level || !sublevel || !unit) return null;

    return { level, sublevel, unit };
  }

  function getNextLessonPath(student: Student) {
    const path = findStudentCurriculumPath(student);
    if (!path) return null;

    const { level, sublevel, unit } = path;
    const currentLessonIndex = Math.max(0, student.lesson - 1);
    const nextLesson = unit.lessons[currentLessonIndex + 1];

    if (nextLesson) {
      return {
        level: level.title,
        sublevel: sublevel.title,
        unit: unit.title,
        lesson: currentLessonIndex + 2,
        lessonTitle: nextLesson.title,
      };
    }

    const unitIndex = sublevel.units.findIndex(
      (item) => item.title === unit.title,
    );
    const nextUnit = sublevel.units[unitIndex + 1];
    const firstLessonOfNextUnit = nextUnit?.lessons?.[0];

    if (nextUnit && firstLessonOfNextUnit) {
      return {
        level: level.title,
        sublevel: sublevel.title,
        unit: nextUnit.title,
        lesson: 1,
        lessonTitle: firstLessonOfNextUnit.title,
      };
    }

    const sublevelIndex = level.sublevels.findIndex(
      (item) => item.title === sublevel.title,
    );
    const nextSublevel = level.sublevels[sublevelIndex + 1];
    const firstUnitOfNextSublevel = nextSublevel?.units?.[0];
    const firstLessonOfNextSublevel = firstUnitOfNextSublevel?.lessons?.[0];

    if (nextSublevel && firstUnitOfNextSublevel && firstLessonOfNextSublevel) {
      return {
        level: level.title,
        sublevel: nextSublevel.title,
        unit: firstUnitOfNextSublevel.title,
        lesson: 1,
        lessonTitle: firstLessonOfNextSublevel.title,
      };
    }

    return null;
  }

  function moveToNextLesson(id: string) {
    setStudents((prev) =>
      prev.map((student) => {
        if (student.id !== id) return student;

        const nextPath = getNextLessonPath(student);

        if (!nextPath) {
          alert("No next lesson found in the current curriculum.");
          return student;
        }

        return {
          ...student,
          ...nextPath,
          status: "Active",
        };
      }),
    );
  }

  function markWaitingApproval(id: string) {
    setStudents((prev) =>
      prev.map((student) =>
        student.id === id
          ? {
              ...student,
              status: "Waiting Approval",
            }
          : student,
      ),
    );
  }

  return (
    <main className="min-h-screen bg-[#f4efe8] p-6 text-[#2b1a12]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Link
            href="/founder/language_center"
            className="inline-flex items-center rounded-xl shadow-lg active:scale-[0.98]"
            style={{
              backgroundColor: "#1f6b2b",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "12px",
              fontWeight: "bold",
              fontSize: "14px",
              border: "1px solid #14501d",
            }}
          >
            ← Back to Language Center
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#1f6b2b] shadow">
              {curriculumStatus}
            </span>
            <span className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#1d7fe2] shadow">
              {studentsStatus}
            </span>
          </div>
        </div>

        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">Students Dashboard</h1>
            <p className="mt-1 text-sm font-medium text-[#6b5a4c]">
              Add students, generate accounts, activate tickets, and assign
              learning levels.
            </p>
          </div>

          <button
            onClick={addStudent}
            className="rounded-2xl shadow active:scale-[0.98]"
            style={{
              backgroundColor: "#1f6b2b",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "16px",
              fontWeight: "bold",
              fontSize: "14px",
              border: "1px solid #14501d",
            }}
          >
            + Add New Student
          </button>
        </div>

        <section className="overflow-x-auto rounded-3xl bg-white p-4 shadow">
          <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#ead8c0] text-[#6b5a4c]">
                <th className="p-3">Name</th>
                <th className="p-3">Username</th>
                <th className="p-3">Password</th>
                <th className="p-3">Code</th>
                <th className="p-3">Level</th>
                <th className="p-3">Sublevel</th>
                <th className="p-3">Unit</th>
                <th className="p-3">Lesson</th>
                <th className="p-3">Ticket</th>
                <th className="p-3">Student Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {students.map((student) => {
                const ticketExpired = Number(student.secondsRemaining || 0) <= 0;

                return (
                  <tr key={student.id} className="border-b border-[#f1e1cf]">
                    <td className="p-3 font-bold">{student.name}</td>
                    <td className="p-3">{student.username}</td>
                    <td className="p-3 font-mono">{student.password}</td>
                    <td className="p-3 font-mono text-[#1d7fe2]">
                      {student.code}
                    </td>
                    <td className="p-3">{student.level}</td>
                    <td className="p-3">{student.sublevel}</td>
                    <td className="p-3">{student.unit}</td>
                    <td className="p-3">
                      <div className="font-bold">{student.lesson}</div>
                      {student.lessonTitle && (
                        <div className="text-xs text-[#6b5a4c]">
                          {student.lessonTitle}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div
                        className={`font-bold ${
                          ticketExpired ? "text-red-600" : "text-[#1d7fe2]"
                        }`}
                      >
                        {formatTicketTime(student.secondsRemaining)}
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClasses(
                          student.status,
                        )}`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => editStudent(student.id)}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-sm active:scale-[0.98]"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteStudent(student.id)}
                          className="rounded-lg bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm active:scale-[0.98]"
                        >
                          Delete
                        </button>

                        <button
                          disabled={student.status !== "Waiting Approval"}
                          onClick={() => moveToNextLesson(student.id)}
                          className={`rounded-lg px-3 py-1 text-xs font-bold text-white shadow-sm active:scale-[0.98] ${
                            student.status === "Waiting Approval"
                              ? "bg-green-600"
                              : "cursor-not-allowed bg-gray-400 opacity-60"
                          }`}
                          title={
                            student.status === "Waiting Approval"
                              ? "Move student to the next lesson"
                              : "NEXT becomes active when the lesson is completed"
                          }
                        >
                          NEXT
                        </button>

                        <button
                          onClick={() => markWaitingApproval(student.id)}
                          className="rounded-lg px-3 py-1 text-xs font-bold shadow-sm active:scale-[0.98]"
                          style={{
                            backgroundColor: "#eab308",
                            color: "#ffffff",
                            fontWeight: "bold",
                          }}
                          title="Temporary test button. Later Elvy will set this automatically."
                        >
                          Complete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
