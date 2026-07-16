"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Lesson = {
  id: string;
  title: string;
  fileName?: string;
  fileText?: string;
  uploadedAt?: string;
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

type SyllabusUpload = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status:
    | "Uploaded"
    | "Needs Confirmation"
    | "Confirmed"
    | "Reading"
    | "Analyzing"
    | "Needs Review"
    | "Approved"
    | "Archived";
  uploadedAt: string;
  bookTitle?: string;
  pages?: number;
  detectedStage?: "Beginner" | "Intermediate" | "Advanced" | "";
  detectedLevel?: string;
  schoolLevel?: string;
  suggestedSublevels?: string[];
  units?: number;
  lessons?: number;
  blueprintStatus?: "Not generated" | "Generated";
};

type CurriculumReaderLesson = {
  title: string;
  objective: string;
  vocabulary: string[];
  grammar: string;
  communicativeFunction: string;
  skills: string[];
};

type CurriculumReaderUnit = {
  title: string;
  theme: string;
  lessons: CurriculumReaderLesson[];
};

type CurriculumReaderDraft = {
  syllabusId: string;
  bookTitle: string;
  levelTitle: string;
  sublevelTitle: string;
  units: CurriculumReaderUnit[];
  generatedAt: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function createSpotlightReaderUnits(): CurriculumReaderUnit[] {
  return [
    {
      title: "Unit 1: Hello",
      theme: "Greetings, names, classroom English, and first contact",
      lessons: [
        {
          title: "Greetings",
          objective: "Students greet people and respond politely.",
          vocabulary: ["hello", "hi", "good morning", "good afternoon", "goodbye"],
          grammar: "Verb be: I am / You are",
          communicativeFunction: "Greeting and saying goodbye",
          skills: ["Speaking", "Listening"],
        },
        {
          title: "Introducing Yourself",
          objective: "Students introduce themselves and ask for names.",
          vocabulary: ["name", "first name", "last name", "student", "teacher"],
          grammar: "What is your name? My name is...",
          communicativeFunction: "Asking for and giving personal information",
          skills: ["Speaking", "Writing"],
        },
        {
          title: "Classroom Language",
          objective: "Students understand simple classroom instructions.",
          vocabulary: ["open", "close", "listen", "repeat", "write"],
          grammar: "Imperatives",
          communicativeFunction: "Following classroom instructions",
          skills: ["Listening", "Speaking"],
        },
        {
          title: "Numbers 1-20",
          objective: "Students count and use numbers in simple exchanges.",
          vocabulary: ["one", "two", "three", "ten", "twenty"],
          grammar: "How old are you? I am...",
          communicativeFunction: "Asking and answering about age",
          skills: ["Speaking", "Reading"],
        },
      ],
    },
    {
      title: "Unit 2: Family and Friends",
      theme: "Family members, relationships, age, and simple descriptions",
      lessons: [
        {
          title: "My Family",
          objective: "Students name family members and talk about family.",
          vocabulary: ["mother", "father", "brother", "sister", "family"],
          grammar: "This is / These are",
          communicativeFunction: "Introducing family members",
          skills: ["Speaking", "Writing"],
        },
        {
          title: "He / She / They",
          objective: "Students use subject pronouns in short sentences.",
          vocabulary: ["he", "she", "they", "friend", "classmate"],
          grammar: "Subject pronouns + be",
          communicativeFunction: "Describing people simply",
          skills: ["Reading", "Writing"],
        },
        {
          title: "Ages",
          objective: "Students ask and answer questions about age.",
          vocabulary: ["old", "young", "age", "years old", "birthday"],
          grammar: "How old is he/she?",
          communicativeFunction: "Asking about age",
          skills: ["Speaking", "Listening"],
        },
        {
          title: "Family Project",
          objective: "Students produce a short family presentation.",
          vocabulary: ["poster", "photo", "family tree", "present", "describe"],
          grammar: "Review: be + family vocabulary",
          communicativeFunction: "Presenting personal information",
          skills: ["Writing", "Speaking"],
        },
      ],
    },
    {
      title: "Unit 3: School Life",
      theme: "School subjects, objects, timetable, and daily classroom life",
      lessons: [
        {
          title: "School Objects",
          objective: "Students identify and name classroom objects.",
          vocabulary: ["book", "pen", "pencil", "bag", "board"],
          grammar: "a / an",
          communicativeFunction: "Naming classroom objects",
          skills: ["Reading", "Speaking"],
        },
        {
          title: "School Subjects",
          objective: "Students talk about school subjects they study.",
          vocabulary: ["English", "Arabic", "French", "maths", "science"],
          grammar: "I have / We have",
          communicativeFunction: "Talking about subjects",
          skills: ["Speaking", "Writing"],
        },
        {
          title: "My Timetable",
          objective: "Students read and talk about a simple timetable.",
          vocabulary: ["Monday", "Tuesday", "morning", "afternoon", "lesson"],
          grammar: "Prepositions of time: on / at",
          communicativeFunction: "Talking about time and school schedule",
          skills: ["Reading", "Speaking"],
        },
        {
          title: "My Favourite Subject",
          objective: "Students express simple preferences about school.",
          vocabulary: ["like", "favourite", "easy", "interesting", "difficult"],
          grammar: "I like / I don't like",
          communicativeFunction: "Expressing likes and dislikes",
          skills: ["Writing", "Speaking"],
        },
      ],
    },
  ];
}

function createGenericReaderUnits(syllabus: SyllabusUpload): CurriculumReaderUnit[] {
  const baseTitle = syllabus.bookTitle || syllabus.fileName.replace(/\.[^/.]+$/, "");

  return [
    {
      title: "Unit 1: Getting Started",
      theme: `First learning sequence from ${baseTitle}`,
      lessons: [
        {
          title: "First Contact",
          objective: "Students understand and use the first target expressions.",
          vocabulary: ["key words", "classroom words", "basic expressions"],
          grammar: "Simple starter structures",
          communicativeFunction: "Starting communication",
          skills: ["Listening", "Speaking"],
        },
        {
          title: "Guided Practice",
          objective: "Students practise the new language with support.",
          vocabulary: ["review words", "new words", "useful phrases"],
          grammar: "Controlled practice of target structure",
          communicativeFunction: "Using language in short exchanges",
          skills: ["Reading", "Speaking"],
        },
        {
          title: "Production",
          objective: "Students produce a short spoken or written task.",
          vocabulary: ["project words", "personal words", "task language"],
          grammar: "Review and consolidation",
          communicativeFunction: "Producing a simple task",
          skills: ["Writing", "Speaking"],
        },
      ],
    },
    {
      title: "Unit 2: Building Communication",
      theme: "Second learning sequence detected from the academic profile",
      lessons: [
        {
          title: "Vocabulary Input",
          objective: "Students learn the main vocabulary of the unit.",
          vocabulary: ["unit words", "topic words", "phrases"],
          grammar: "Vocabulary in context",
          communicativeFunction: "Understanding the unit topic",
          skills: ["Reading", "Listening"],
        },
        {
          title: "Grammar in Use",
          objective: "Students use the target grammar in meaningful examples.",
          vocabulary: ["examples", "questions", "answers"],
          grammar: "Target grammar from the unit",
          communicativeFunction: "Forming correct sentences",
          skills: ["Writing", "Speaking"],
        },
        {
          title: "Communicative Task",
          objective: "Students use the unit language in a short task.",
          vocabulary: ["task language", "interaction phrases", "review words"],
          grammar: "Grammar review",
          communicativeFunction: "Completing a communicative task",
          skills: ["Speaking", "Writing"],
        },
      ],
    },
  ];
}

function buildCurriculumReaderDraft(syllabus: SyllabusUpload): CurriculumReaderDraft {
  const bookTitle = syllabus.bookTitle || syllabus.fileName.replace(/\.[^/.]+$/, "");
  const combinedName = normalize(`${bookTitle} ${syllabus.fileName}`);
  const isSpotlightOne = combinedName.includes("spotlight1") || combinedName.includes("spolight1");

  return {
    syllabusId: syllabus.id,
    bookTitle,
    levelTitle: syllabus.detectedLevel || "Level A",
    sublevelTitle: syllabus.suggestedSublevels?.[0] || "A1",
    units: isSpotlightOne ? createSpotlightReaderUnits() : createGenericReaderUnits(syllabus),
    generatedAt: new Date().toISOString(),
  };
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CurriculumReaderPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<SyllabusUpload | null>(null);
  const [draft, setDraft] = useState<CurriculumReaderDraft | null>(null);
  const [status, setStatus] = useState("Loading Curriculum Reader...");
  const [openUnitTitles, setOpenUnitTitles] = useState<string[]>([]);

  useEffect(() => {
    try {
      const savedProfile = window.localStorage.getItem("elvy-active-reader-profile-v1");
      const allProfiles = window.localStorage.getItem("elvy-syllabus-uploads-v1");
      const parsedProfiles = allProfiles ? (JSON.parse(allProfiles) as SyllabusUpload[]) : [];
      const activeProfile = savedProfile
        ? (JSON.parse(savedProfile) as SyllabusUpload)
        : parsedProfiles.find((item) => item.status === "Confirmed" || item.status === "Approved") ||
          parsedProfiles[0];

      if (!activeProfile) {
        setStatus("No academic profile found. Go back and upload or confirm a syllabus first.");
        return;
      }

      const nextDraft = buildCurriculumReaderDraft(activeProfile);
      setProfile(activeProfile);
      setDraft(nextDraft);
      setOpenUnitTitles([nextDraft.units[0]?.title].filter(Boolean));
      setStatus("Curriculum Reader v1 created a reviewable teaching blueprint.");
    } catch (error) {
      console.error("Curriculum Reader load failed:", error);
      setStatus("Could not load Curriculum Reader profile.");
    }
  }, []);

  const totalLessons = useMemo(
    () => draft?.units.reduce((total, unit) => total + unit.lessons.length, 0) || 0,
    [draft],
  );

  function toggleUnit(title: string) {
    setOpenUnitTitles((prev) =>
      prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title],
    );
  }

  function updateStoredProfile(statusValue: SyllabusUpload["status"]) {
    if (!profile || !draft) return;

    const updatedProfile: SyllabusUpload = {
      ...profile,
      status: statusValue,
      blueprintStatus: "Generated",
      units: draft.units.length,
      lessons: totalLessons,
    };

    setProfile(updatedProfile);
    window.localStorage.setItem("elvy-active-reader-profile-v1", JSON.stringify(updatedProfile));

    const savedProfiles = window.localStorage.getItem("elvy-syllabus-uploads-v1");
    const profiles = savedProfiles ? (JSON.parse(savedProfiles) as SyllabusUpload[]) : [];
    window.localStorage.setItem(
      "elvy-syllabus-uploads-v1",
      JSON.stringify(
        profiles.map((item) => (item.id === updatedProfile.id ? updatedProfile : item)),
      ),
    );
  }

  function approveBlueprint() {
    updateStoredProfile("Approved");
    setStatus("Blueprint approved. You can now apply it to the dashboard.");
  }

  async function applyToDashboard() {
    if (!draft) return;

    const timestamp = Date.now();
    const nextSublevel: Sublevel = {
      id: `reader-${draft.sublevelTitle.toLowerCase()}-${timestamp}`,
      title: draft.sublevelTitle,
      units: draft.units.map((unit, unitIndex) => ({
        id: `reader-unit-${unitIndex + 1}-${timestamp}`,
        title: unit.title.replace(/^Unit\s+\d+:\s*/i, ""),
        lessons: unit.lessons.map((lesson, lessonIndex) => ({
          id: `reader-lesson-${unitIndex + 1}-${lessonIndex + 1}-${timestamp}`,
          title: lesson.title.replace(/^Lesson\s+\d+:\s*/i, ""),
          fileText: [
            `Objective: ${lesson.objective}`,
            `Vocabulary: ${lesson.vocabulary.join(", ")}`,
            `Grammar: ${lesson.grammar}`,
            `Function: ${lesson.communicativeFunction}`,
            `Skills: ${lesson.skills.join(", ")}`,
          ].join("\n"),
          uploadedAt: new Date().toISOString(),
          fileName: `${draft.bookTitle} - ${unit.title} - ${lesson.title}.blueprint.txt`,
        })),
      })),
    };

    try {
      const response = await fetch("/api/curriculum", { cache: "no-store" });
      const data = await response.json();
      const previousLevels = Array.isArray(data?.curriculum?.levels)
        ? (data.curriculum.levels as Level[])
        : [];
      const targetLevelTitle = draft.levelTitle.toUpperCase();
      const existingLevel = previousLevels.find(
        (level) => level.title.toLowerCase() === targetLevelTitle.toLowerCase(),
      );
      const nextLevels = existingLevel
        ? previousLevels.map((level) =>
            level.id === existingLevel.id
              ? {
                  ...level,
                  sublevels: [
                    ...level.sublevels.filter(
                      (sublevel) =>
                        sublevel.title.toLowerCase() !== nextSublevel.title.toLowerCase(),
                    ),
                    nextSublevel,
                  ],
                }
              : level,
          )
        : [
            ...previousLevels,
            {
              id: `reader-${draft.levelTitle.toLowerCase().replace(/\s+/g, "-")}-${timestamp}`,
              title: targetLevelTitle,
              sublevels: [nextSublevel],
            },
          ];

      const saveResponse = await fetch("/api/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levels: nextLevels }),
      });

      if (!saveResponse.ok) throw new Error("Save request failed.");

      updateStoredProfile("Approved");
      setStatus("Blueprint applied to the dashboard. You can go back and review the Levels section.");
    } catch (error) {
      console.error("Apply blueprint failed:", error);
      setStatus("Could not apply blueprint. Please try again.");
    }
  }

  if (!draft || !profile) {
    return (
      <main className="min-h-screen bg-[#fbfcfb] px-4 py-6 text-[#111827] sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black">Curriculum Reader</h1>
          <p className="mt-3 text-sm font-bold text-[#536174]">{status}</p>
          <button
            type="button"
            onClick={() => router.push("/founder/curriculum")}
            className="mt-5 rounded-xl bg-[#078d3c] px-5 py-3 text-sm font-black text-white"
          >
            Back to Curriculum Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfcfb] px-4 py-6 text-[#111827] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff6ff] text-3xl shadow-sm">
              🧠
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[#1d4ed8]">
                Curriculum Reader v1
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-[#111827]">
                {draft.bookTitle}
              </h1>
              <p className="mt-2 text-sm font-medium text-[#536174]">
                Review the teaching blueprint before applying it to Elvy's curriculum.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/founder/curriculum")}
              className="rounded-xl border border-[#d7dee8] bg-white px-5 py-3 text-sm font-black text-[#111827] shadow-sm active:scale-[0.98]"
            >
              ← Dashboard
            </button>
            <button
              type="button"
              onClick={approveBlueprint}
              className="rounded-xl bg-[#078d3c] px-5 py-3 text-sm font-black text-white shadow active:scale-[0.98]"
            >
              ✅ Approve Blueprint
            </button>
            <button
              type="button"
              onClick={applyToDashboard}
              className="rounded-xl bg-[#1d7fe2] px-5 py-3 text-sm font-black text-white shadow active:scale-[0.98]"
            >
              📚 Apply to Dashboard
            </button>
          </div>
        </header>

        <section className="mb-6 rounded-[2rem] border border-[#dbeafe] bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="mb-5 rounded-2xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-3 text-sm font-bold text-[#1d4ed8]">
            {status}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-black uppercase text-[#7b8794]">Status</p>
              <p className="mt-1 text-sm font-black text-[#111827]">{profile.status}</p>
            </div>
            <div className="rounded-2xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-black uppercase text-[#7b8794]">Level</p>
              <p className="mt-1 text-sm font-black text-[#111827]">{draft.levelTitle}</p>
            </div>
            <div className="rounded-2xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-black uppercase text-[#7b8794]">Sublevel</p>
              <p className="mt-1 text-sm font-black text-[#111827]">{draft.sublevelTitle}</p>
            </div>
            <div className="rounded-2xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-black uppercase text-[#7b8794]">Units</p>
              <p className="mt-1 text-sm font-black text-[#111827]">{draft.units.length}</p>
            </div>
            <div className="rounded-2xl bg-[#f8fafc] p-4">
              <p className="text-[11px] font-black uppercase text-[#7b8794]">Lessons</p>
              <p className="mt-1 text-sm font-black text-[#111827]">{totalLessons}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-[#e5e7eb] bg-white p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#7b8794]">Source File</p>
            <p className="mt-2 break-all text-sm font-black text-[#111827]">{profile.fileName}</p>
            <p className="mt-1 text-xs font-bold text-[#536174]">
              {profile.fileType} · {formatFileSize(profile.fileSize)}
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#e5e7eb] bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-black text-[#111827]">Teaching Blueprint</h2>
            <p className="mt-1 text-sm font-medium text-[#536174]">
              Units are collapsed to keep the page simple. Open one unit at a time.
            </p>
          </div>

          <div className="space-y-4">
            {draft.units.map((unit, unitIndex) => {
              const isOpen = openUnitTitles.includes(unit.title);

              return (
                <div key={`${unit.title}-${unitIndex}`} className="rounded-3xl border border-[#e5e7eb] bg-[#fbfcff] p-4">
                  <button
                    type="button"
                    onClick={() => toggleUnit(unit.title)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <div>
                      <h3 className="text-lg font-black text-[#111827]">{unit.title}</h3>
                      <p className="mt-1 text-sm font-bold text-[#536174]">{unit.theme}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#1d4ed8] shadow-sm">
                      {isOpen ? "Hide" : "Open"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {unit.lessons.map((lesson, lessonIndex) => (
                        <div key={`${lesson.title}-${lessonIndex}`} className="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
                          <p className="text-sm font-black text-[#111827]">
                            Lesson {lessonIndex + 1}: {lesson.title}
                          </p>
                          <p className="mt-2 text-xs font-bold leading-5 text-[#536174]">{lesson.objective}</p>
                          <div className="mt-3 space-y-1 text-[11px] font-bold text-[#374151]">
                            <p><span className="text-[#7b8794]">Vocabulary:</span> {lesson.vocabulary.join(", ")}</p>
                            <p><span className="text-[#7b8794]">Grammar:</span> {lesson.grammar}</p>
                            <p><span className="text-[#7b8794]">Function:</span> {lesson.communicativeFunction}</p>
                            <p><span className="text-[#7b8794]">Skills:</span> {lesson.skills.join(", ")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
