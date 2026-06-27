"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
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

const initialLevels: Level[] = [
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
];

export default function CurriculumDashboard() {
  const [levels, setLevels] = useState<Level[]>(initialLevels);
  const [selectedLevelId, setSelectedLevelId] = useState("level-a");
  const [selectedSublevelId, setSelectedSublevelId] = useState("a1");
  const [selectedUnitId, setSelectedUnitId] = useState("unit-hello");
  const [selectedLessonIdForUpload, setSelectedLessonIdForUpload] = useState<string | null>(null);
  const [isLoadingCurriculum, setIsLoadingCurriculum] = useState(true);
  const [saveStatus, setSaveStatus] = useState("Loading curriculum...");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasLoadedCurriculumRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const router = useRouter();

  const selectedLevel = levels.find((level) => level.id === selectedLevelId);
  const selectedSublevel = selectedLevel?.sublevels.find(
    (sublevel) => sublevel.id === selectedSublevelId
  );
  const selectedUnit = selectedSublevel?.units.find((unit) => unit.id === selectedUnitId);

  useEffect(() => {
    async function loadCurriculum() {
      try {
        const response = await fetch("/api/curriculum", { cache: "no-store" });
        const data = await response.json();

        if (data?.success && Array.isArray(data?.curriculum?.levels)) {
          const loadedLevels = data.curriculum.levels as Level[];
          const firstLevel = loadedLevels[0];
          const firstSublevel = firstLevel?.sublevels?.[0];
          const firstUnit = firstSublevel?.units?.[0];

          setLevels(loadedLevels);
          setSelectedLevelId(firstLevel?.id || "");
          setSelectedSublevelId(firstSublevel?.id || "");
          setSelectedUnitId(firstUnit?.id || "");
          setSaveStatus("Curriculum loaded.");
        } else {
          setSaveStatus("Using starter curriculum.");
        }
      } catch (error) {
        console.error("Curriculum load failed:", error);
        setSaveStatus("Could not load saved curriculum. Using starter curriculum.");
      } finally {
        hasLoadedCurriculumRef.current = true;
        setIsLoadingCurriculum(false);
      }
    }

    loadCurriculum();
  }, []);

  useEffect(() => {
    if (!hasLoadedCurriculumRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    setSaveStatus("Saving curriculum...");

    saveTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/curriculum", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ levels }),
        });

        if (!response.ok) {
          throw new Error("Save request failed.");
        }

        setSaveStatus("Saved.");
      } catch (error) {
        console.error("Curriculum save failed:", error);
        setSaveStatus("Save failed. Try again.");
      }
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [levels]);

  function cleanTitle(value: string | null) {
    return value?.trim() || "";
  }

  function selectLevel(level: Level) {
    setSelectedLevelId(level.id);
    setSelectedSublevelId(level.sublevels[0]?.id || "");
    setSelectedUnitId(level.sublevels[0]?.units[0]?.id || "");
  }

  function selectSublevel(sublevel: Sublevel) {
    setSelectedSublevelId(sublevel.id);
    setSelectedUnitId(sublevel.units[0]?.id || "");
  }

  function addSublevel() {
    if (!selectedLevel) return;

    const title = cleanTitle(prompt("Sublevel name, example: A2"));
    if (!title) return;

    const newSublevel: Sublevel = {
      id: crypto.randomUUID(),
      title,
      units: [],
    };

    setLevels((prev) =>
      prev.map((level) =>
        level.id === selectedLevel.id
          ? {
              ...level,
              sublevels: [...level.sublevels, newSublevel],
            }
          : level
      )
    );

    setSelectedSublevelId(newSublevel.id);
    setSelectedUnitId("");
  }

  function editSublevel(sublevelId: string) {
    if (!selectedLevel) return;

    const currentSublevel = selectedLevel.sublevels.find((sub) => sub.id === sublevelId);
    if (!currentSublevel) return;

    const title = cleanTitle(prompt("Edit sublevel name", currentSublevel.title));
    if (!title) return;

    setLevels((prev) =>
      prev.map((level) =>
        level.id === selectedLevel.id
          ? {
              ...level,
              sublevels: level.sublevels.map((sub) =>
                sub.id === sublevelId ? { ...sub, title } : sub
              ),
            }
          : level
      )
    );
  }

  function deleteSublevel(sublevelId: string) {
    if (!selectedLevel) return;

    const currentSublevel = selectedLevel.sublevels.find((sub) => sub.id === sublevelId);
    if (!currentSublevel) return;

    const confirmed = window.confirm(
      `Delete ${currentSublevel.title}? All units and lessons inside this sublevel will also be deleted.`
    );

    if (!confirmed) return;

    const remainingSublevels = selectedLevel.sublevels.filter((sub) => sub.id !== sublevelId);
    const nextSublevel = remainingSublevels[0];

    setLevels((prev) =>
      prev.map((level) =>
        level.id === selectedLevel.id
          ? {
              ...level,
              sublevels: remainingSublevels,
            }
          : level
      )
    );

    if (selectedSublevelId === sublevelId) {
      setSelectedSublevelId(nextSublevel?.id || "");
      setSelectedUnitId(nextSublevel?.units[0]?.id || "");
    }
  }

  function addUnit() {
    if (!selectedLevel || !selectedSublevel) return;

    const title = cleanTitle(prompt("Unit name, example: Family"));
    if (!title) return;

    const newUnit: Unit = {
      id: crypto.randomUUID(),
      title,
      lessons: [],
    };

    setLevels((prev) =>
      prev.map((level) =>
        level.id === selectedLevel.id
          ? {
              ...level,
              sublevels: level.sublevels.map((sublevel) =>
                sublevel.id === selectedSublevel.id
                  ? {
                      ...sublevel,
                      units: [...sublevel.units, newUnit],
                    }
                  : sublevel
              ),
            }
          : level
      )
    );

    setSelectedUnitId(newUnit.id);
  }

  function editUnit(unitId: string) {
    if (!selectedLevel || !selectedSublevel) return;

    const currentUnit = selectedSublevel.units.find((unit) => unit.id === unitId);
    if (!currentUnit) return;

    const title = cleanTitle(prompt("Edit unit name", currentUnit.title));
    if (!title) return;

    setLevels((prev) =>
      prev.map((level) =>
        level.id === selectedLevel.id
          ? {
              ...level,
              sublevels: level.sublevels.map((sublevel) =>
                sublevel.id === selectedSublevel.id
                  ? {
                      ...sublevel,
                      units: sublevel.units.map((unit) =>
                        unit.id === unitId ? { ...unit, title } : unit
                      ),
                    }
                  : sublevel
              ),
            }
          : level
      )
    );
  }

  function deleteUnit(unitId: string) {
    if (!selectedLevel || !selectedSublevel) return;

    const currentUnit = selectedSublevel.units.find((unit) => unit.id === unitId);
    if (!currentUnit) return;

    const confirmed = window.confirm(
      `Delete Unit: ${currentUnit.title}? All lessons inside this unit will also be deleted.`
    );

    if (!confirmed) return;

    const remainingUnits = selectedSublevel.units.filter((unit) => unit.id !== unitId);
    const nextUnit = remainingUnits[0];

    setLevels((prev) =>
      prev.map((level) =>
        level.id === selectedLevel.id
          ? {
              ...level,
              sublevels: level.sublevels.map((sublevel) =>
                sublevel.id === selectedSublevel.id
                  ? {
                      ...sublevel,
                      units: remainingUnits,
                    }
                  : sublevel
              ),
            }
          : level
      )
    );

    if (selectedUnitId === unitId) {
      setSelectedUnitId(nextUnit?.id || "");
    }
  }

  function addLesson() {
    if (!selectedLevel || !selectedSublevel || !selectedUnit) return;

    const title = cleanTitle(prompt("Lesson title, example: Greetings"));
    if (!title) return;

    const newLesson: Lesson = {
      id: crypto.randomUUID(),
      title,
    };

    setLevels((prev) =>
      prev.map((level) =>
        level.id === selectedLevel.id
          ? {
              ...level,
              sublevels: level.sublevels.map((sublevel) =>
                sublevel.id === selectedSublevel.id
                  ? {
                      ...sublevel,
                      units: sublevel.units.map((unit) =>
                        unit.id === selectedUnit.id
                          ? {
                              ...unit,
                              lessons: [...unit.lessons, newLesson],
                            }
                          : unit
                      ),
                    }
                  : sublevel
              ),
            }
          : level
      )
    );
  }

  function editLesson(lessonId: string) {
    if (!selectedLevel || !selectedSublevel || !selectedUnit) return;

    const currentLesson = selectedUnit.lessons.find((lesson) => lesson.id === lessonId);
    if (!currentLesson) return;

    const title = cleanTitle(prompt("Edit lesson title", currentLesson.title));
    if (!title) return;

    setLevels((prev) =>
      prev.map((level) =>
        level.id === selectedLevel.id
          ? {
              ...level,
              sublevels: level.sublevels.map((sublevel) =>
                sublevel.id === selectedSublevel.id
                  ? {
                      ...sublevel,
                      units: sublevel.units.map((unit) =>
                        unit.id === selectedUnit.id
                          ? {
                              ...unit,
                              lessons: unit.lessons.map((lesson) =>
                                lesson.id === lessonId ? { ...lesson, title } : lesson
                              ),
                            }
                          : unit
                      ),
                    }
                  : sublevel
              ),
            }
          : level
      )
    );
  }

  function deleteLesson(lessonId: string) {
    if (!selectedLevel || !selectedSublevel || !selectedUnit) return;

    const currentLesson = selectedUnit.lessons.find((lesson) => lesson.id === lessonId);
    if (!currentLesson) return;

    const confirmed = window.confirm(`Delete lesson: ${currentLesson.title}?`);
    if (!confirmed) return;

    setLevels((prev) =>
      prev.map((level) =>
        level.id === selectedLevel.id
          ? {
              ...level,
              sublevels: level.sublevels.map((sublevel) =>
                sublevel.id === selectedSublevel.id
                  ? {
                      ...sublevel,
                      units: sublevel.units.map((unit) =>
                        unit.id === selectedUnit.id
                          ? {
                              ...unit,
                              lessons: unit.lessons.filter((lesson) => lesson.id !== lessonId),
                            }
                          : unit
                      ),
                    }
                  : sublevel
              ),
            }
          : level
      )
    );
  }

  function openLessonUpload(lessonId: string) {
    setSelectedLessonIdForUpload(lessonId);
    fileInputRef.current?.click();
  }

  async function handleLessonUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !selectedLessonIdForUpload || !selectedLevel || !selectedSublevel || !selectedUnit) {
      event.target.value = "";
      return;
    }

    const fileName = file.name;
    const isTextLesson =
      file.type.startsWith("text/") || fileName.toLowerCase().endsWith(".txt");

    if (!isTextLesson) {
      alert("For now, please upload a .txt lesson file. PDF and Word lesson reading will be added later.");
      setSelectedLessonIdForUpload(null);
      event.target.value = "";
      return;
    }

    const fileText = (await file.text()).trim();

    if (!fileText) {
      alert("This lesson file is empty. Please upload a lesson file that contains the lesson plan text.");
      setSelectedLessonIdForUpload(null);
      event.target.value = "";
      return;
    }

    setLevels((prev) =>
      prev.map((level) =>
        level.id === selectedLevel.id
          ? {
              ...level,
              sublevels: level.sublevels.map((sublevel) =>
                sublevel.id === selectedSublevel.id
                  ? {
                      ...sublevel,
                      units: sublevel.units.map((unit) =>
                        unit.id === selectedUnit.id
                          ? {
                              ...unit,
                              lessons: unit.lessons.map((lesson) =>
                                lesson.id === selectedLessonIdForUpload
                                  ? {
                                      ...lesson,
                                      fileName,
                                      fileText,
                                      uploadedAt: new Date().toISOString(),
                                    }
                                  : lesson
                              ),
                            }
                          : unit
                      ),
                    }
                  : sublevel
              ),
            }
          : level
      )
    );

    setSaveStatus("Lesson uploaded. Saving curriculum...");
    setSelectedLessonIdForUpload(null);
    event.target.value = "";
  }

  function smallButtonClasses(kind: "edit" | "delete" | "upload") {
    if (kind === "delete") {
      return "rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white shadow-sm active:scale-[0.98]";
    }

    if (kind === "upload") {
      return "rounded-lg bg-[#1d7fe2] px-2 py-1 text-[11px] font-bold text-white shadow-sm active:scale-[0.98]";
    }

    return "rounded-lg bg-[#f1e1cf] px-2 py-1 text-[11px] font-bold text-[#3b2418] shadow-sm active:scale-[0.98]";
  }

  return (
    <main className="min-h-screen bg-[#f4efe8] p-6 text-[#2b1a12]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">Curriculum Dashboard</h1>
            <p className="mt-1 text-sm font-medium text-[#6b5a4c]">
              Build levels, sublevels, units, and lessons for Elvy Language Center.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/founder/language_center")}
              className="rounded-xl bg-[#1d7fe2] px-4 py-2 text-sm font-bold text-black shadow active:scale-[0.98]"
            >
              ← Back to language center
            </button>

            <div className="text-right">
              <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#1f6b2b] shadow">
                Level → Sublevel → Unit → Lesson
              </div>
              <p className="mt-2 text-xs font-bold text-[#6b5a4c]">
                {saveStatus}
              </p>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".txt"
          onChange={handleLessonUpload}
        />

        {isLoadingCurriculum && (
          <div className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#6b5a4c] shadow">
            Loading saved curriculum...
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <section className="rounded-3xl bg-white p-4 shadow">
            <h2 className="mb-3 font-bold">Levels</h2>
            {levels.map((level) => (
              <button
                key={level.id}
                onClick={() => selectLevel(level)}
                className="mb-2 block w-full rounded-xl px-4 py-3 text-left font-bold transition-all active:scale-[0.98]"
                style={{
                  background: selectedLevelId === level.id ? "#1f6b2b" : "#f1e1cf",
                  color: selectedLevelId === level.id ? "white" : "#3b2418",
                }}
              >
                {level.title}
              </button>
            ))}
          </section>

          <section className="rounded-3xl bg-white p-4 shadow">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Sublevels</h2>
              <button
                onClick={addSublevel}
                className="rounded-xl bg-green-700 px-3 py-1 text-sm font-bold text-white active:scale-[0.98]"
              >
                + Add
              </button>
            </div>

            {!selectedLevel?.sublevels.length && (
              <p className="rounded-xl bg-[#f8ead8] p-3 text-sm font-medium text-[#6b5a4c]">
                No sublevels yet. Add the first one.
              </p>
            )}

            {selectedLevel?.sublevels.map((sublevel) => (
              <div
                key={sublevel.id}
                className="mb-2 rounded-xl p-3"
                style={{
                  background: selectedSublevelId === sublevel.id ? "#1d7fe2" : "#eef7ff",
                  color: selectedSublevelId === sublevel.id ? "white" : "#11314d",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => selectSublevel(sublevel)}
                    className="min-w-0 flex-1 text-left font-bold"
                  >
                    {sublevel.title}
                  </button>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => editSublevel(sublevel.id)}
                      className={smallButtonClasses("edit")}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSublevel(sublevel.id)}
                      className={smallButtonClasses("delete")}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-3xl bg-white p-4 shadow">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Units</h2>
              <button
                onClick={addUnit}
                disabled={!selectedSublevel}
                className="rounded-xl bg-green-700 px-3 py-1 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-40"
              >
                + Add
              </button>
            </div>

            {!selectedSublevel && (
              <p className="rounded-xl bg-[#f8ead8] p-3 text-sm font-medium text-[#6b5a4c]">
                Select or add a sublevel first.
              </p>
            )}

            {selectedSublevel && selectedSublevel.units.length === 0 && (
              <p className="rounded-xl bg-[#f8ead8] p-3 text-sm font-medium text-[#6b5a4c]">
                No units yet. Add a unit to this sublevel.
              </p>
            )}

            {selectedSublevel?.units.map((unit, index) => (
              <div
                key={unit.id}
                className="mb-2 rounded-xl p-3"
                style={{
                  background: selectedUnitId === unit.id ? "#d2ad62" : "#fff7e8",
                  color: "#3b2418",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedUnitId(unit.id)}
                    className="min-w-0 flex-1 text-left font-bold"
                  >
                    Unit {index + 1}: {unit.title}
                  </button>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => editUnit(unit.id)}
                      className={smallButtonClasses("edit")}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteUnit(unit.id)}
                      className={smallButtonClasses("delete")}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-3xl bg-white p-4 shadow">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Lessons</h2>
              <button
                onClick={addLesson}
                disabled={!selectedUnit}
                className="rounded-xl bg-green-700 px-3 py-1 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-40"
              >
                + Add Lesson
              </button>
            </div>

            {!selectedUnit && (
              <p className="rounded-xl bg-[#f8ead8] p-3 text-sm font-medium text-[#6b5a4c]">
                Select or add a unit first.
              </p>
            )}

            {selectedUnit && selectedUnit.lessons.length === 0 && (
              <p className="rounded-xl bg-[#f8ead8] p-3 text-sm font-medium text-[#6b5a4c]">
                No lessons yet. Add the first lesson.
              </p>
            )}

            {selectedUnit?.lessons.map((lesson, index) => (
              <div key={lesson.id} className="mb-3 rounded-xl bg-[#f8ead8] px-4 py-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">
                      Lesson {index + 1}: {lesson.title}
                    </p>

                    {lesson.fileName ? (
                      <div className="mt-2">
                        <div className="space-y-1">
                          <span
                            className="inline-flex items-center rounded-lg px-3 py-1 text-xs font-bold shadow-sm"
                            style={{ backgroundColor: "#dcfce7", color: "#15803d" }}
                          >
                            ✓ Lesson Uploaded
                          </span>

                          <p className="break-all text-[10px] font-bold text-green-700">
                            {lesson.fileName}
                          </p>

                          {lesson.fileText && (
                            <p className="text-[10px] font-semibold text-[#6b5a4c]">
                              Stored for Elvy · {lesson.fileText.length} characters
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openLessonUpload(lesson.id)}
                        className="mt-2 inline-flex items-center rounded-lg px-3 py-1 text-xs font-bold text-white shadow-sm active:scale-[0.98]"
                        style={{ backgroundColor: "#1d7fe2", color: "#ffffff" }}
                      >
                        ⬆ Upload
                      </button>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => editLesson(lesson.id)}
                      className={smallButtonClasses("edit")}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLesson(lesson.id)}
                      className={smallButtonClasses("delete")}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
