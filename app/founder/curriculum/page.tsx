"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importReadyPackageZip } from "../../../services/ready-package/ready-package-importer";

type Lesson = {
  id: string;
  title: string;
  pageRange?: string;
  duration?: string;
  lessonPlanData?: unknown;
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

type CurriculumTreeRecord = {
  syllabusId: string;
  title: string;
  levelId: string;
  levelTitle: string;
  sublevelIds: string[];
  units: number;
  lessons: number;
  generatedAt: string;
  status?: "Needs Review" | "Approved" | "Generated";
};

type ImportedPackageSummary = {
  syllabusId: string;
  title: string;
  units: number;
  lessons: number;
  levelTitle: string;
  importedAt: string;
  packageId?: string;
  packageVersion?: string;
  source?: string;
};

type PendingReadyPackage = {
  level: Level;
  treeRecord: CurriculumTreeRecord;
  summary: ImportedPackageSummary;
};

const ACTIVE_LESSON_STUDIO_SYLLABUS_KEY = "elvy-active-lesson-studio-syllabus";
const CURRICULUM_TREE_STORAGE_KEY = "elvy-curriculum-reader-trees-v1";

const starterLevels: Level[] = [
  { id: "level-a", title: "LEVEL A", sublevels: [] },
  { id: "level-b", title: "LEVEL B", sublevels: [] },
  { id: "level-c", title: "LEVEL C", sublevels: [] },
];

export default function CurriculumDashboard() {
  const router = useRouter();
  const readyPackageInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedCurriculumRef = useRef(false);

  const [levels, setLevels] = useState<Level[]>(starterLevels);
  const [curriculumTreeRecords, setCurriculumTreeRecords] = useState<
    CurriculumTreeRecord[]
  >([]);
  const [lastImportedPackage, setLastImportedPackage] =
    useState<ImportedPackageSummary | null>(null);
  const [pendingReadyPackage, setPendingReadyPackage] =
    useState<PendingReadyPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedTrees, setHasLoadedTrees] = useState(false);
  const [isImportingReadyPackage, setIsImportingReadyPackage] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Loading curriculum...");
  const [packageStatus, setPackageStatus] = useState(
    "No GSRP imported in this session.",
  );

  useEffect(() => {
    async function loadCurriculum() {
      try {
        const response = await fetch("/api/curriculum", {
          cache: "no-store",
        });
        const data = await response.json();

        if (data?.success && Array.isArray(data?.curriculum?.levels)) {
          setLevels(data.curriculum.levels as Level[]);
          setSaveStatus("Curriculum loaded.");
        } else {
          setSaveStatus("Using starter curriculum.");
        }
      } catch (error) {
        console.error("Curriculum load failed:", error);
        setSaveStatus("Could not load saved curriculum.");
      } finally {
        hasLoadedCurriculumRef.current = true;
        setIsLoading(false);
      }
    }

    loadCurriculum();
  }, []);

  useEffect(() => {
    try {
      const savedTrees = window.localStorage.getItem(
        CURRICULUM_TREE_STORAGE_KEY,
      );
      if (savedTrees) {
        const parsed = JSON.parse(savedTrees) as CurriculumTreeRecord[];
        if (Array.isArray(parsed)) {
          setCurriculumTreeRecords(parsed);
        }
      }
    } catch (error) {
      console.error("GSRP dashboard state load failed:", error);
    } finally {
      setHasLoadedTrees(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedTrees) return;

    try {
      window.localStorage.setItem(
        CURRICULUM_TREE_STORAGE_KEY,
        JSON.stringify(curriculumTreeRecords),
      );
    } catch (error) {
      console.error("Curriculum tree save failed:", error);
    }
  }, [curriculumTreeRecords, hasLoadedTrees]);

  useEffect(() => {
    if (!hasLoadedCurriculumRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("Saving curriculum...");

    saveTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/curriculum", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ levels }),
        });

        if (!response.ok) throw new Error("Save request failed.");
        setSaveStatus("Saved.");
      } catch (error) {
        console.error("Curriculum save failed:", error);
        setSaveStatus("Save failed. Try again.");
      }
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [levels]);

  function openReadyPackageImport() {
    readyPackageInputRef.current?.click();
  }

  async function handleReadyPackageImport(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const supported =
      lowerName.endsWith(".zip") ||
      lowerName.endsWith(".elvy") ||
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed";

    if (!supported) {
      alert(
        "Elvy accepts only a validated GSRP package (.elvy or .zip). PDF, DOCX, images, and other files are not accepted here.",
      );
      return;
    }

    setIsImportingReadyPackage(true);
    setSaveStatus("Validating GSRP...");
    setPackageStatus(
      "Checking package structure, lessons, blueprints, and assets...",
    );

    try {
      const imported = await importReadyPackageZip(file);
      const importedLevel = imported.level as Level;
      const importedTreeRecord = imported.treeRecord as CurriculumTreeRecord;

      const summary: ImportedPackageSummary = {
        syllabusId: imported.syllabusId,
        title: imported.title,
        units: importedTreeRecord.units,
        lessons: importedTreeRecord.lessons,
        levelTitle: importedTreeRecord.levelTitle,
        importedAt: new Date().toISOString(),
        packageId: imported.syllabusId,
        packageVersion: "1.0",
        source: "Happy Office Curriculum Engineering",
      };

      setPendingReadyPackage({
        level: importedLevel,
        treeRecord: {
          ...importedTreeRecord,
          generatedAt: summary.importedAt,
        },
        summary,
      });
      setLastImportedPackage(summary);

      setSaveStatus(`GSRP validated: ${imported.title}.`);
      setPackageStatus(
        "Package validation succeeded. Review the Package Profile and click Confirm Import.",
      );
    } catch (error) {
      console.error("GSRP import failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : "The GSRP package could not be imported.";
      alert(message);
      setSaveStatus("GSRP import failed.");
      setPackageStatus(message);
    } finally {
      setIsImportingReadyPackage(false);
    }
  }

  function confirmReadyPackageImport() {
    if (!pendingReadyPackage) return;

    const { level, treeRecord, summary } = pendingReadyPackage;

    setLevels((previousLevels) => [
      level,
      ...previousLevels.filter((item) => item.id !== level.id),
    ]);

    setCurriculumTreeRecords((previousRecords) => [
      treeRecord,
      ...previousRecords.filter(
        (record) => record.syllabusId !== treeRecord.syllabusId,
      ),
    ]);

    window.localStorage.setItem(
      ACTIVE_LESSON_STUDIO_SYLLABUS_KEY,
      summary.syllabusId,
    );

    setSaveStatus(`GSRP imported: ${summary.title}.`);
    setPackageStatus(
      `${summary.units} unit${summary.units === 1 ? "" : "s"} and ${
        summary.lessons
      } lesson${summary.lessons === 1 ? "" : "s"} are ready in Lesson Plan Studio.`,
    );

    setPendingReadyPackage(null);
    setLastImportedPackage(null);
  }

  function openLessonPlanStudio(record: CurriculumTreeRecord) {
    const level = levels.find((item) => item.id === record.levelId);
    if (!level) {
      alert(`${record.title} is registered, but its level could not be found.`);
      return;
    }

    const firstLesson = record.sublevelIds
      .map((sublevelId) =>
        level.sublevels.find((sublevel) => sublevel.id === sublevelId),
      )
      .filter((sublevel): sublevel is Sublevel => Boolean(sublevel))
      .flatMap((sublevel) => sublevel.units)
      .flatMap((unit) => unit.lessons)[0];

    if (!firstLesson) {
      alert(`${record.title} does not contain any lessons.`);
      return;
    }

    window.localStorage.setItem(
      ACTIVE_LESSON_STUDIO_SYLLABUS_KEY,
      record.syllabusId,
    );

    router.push(
      `/founder/curriculum/lesson-plan?syllabusId=${encodeURIComponent(
        record.syllabusId,
      )}&lessonId=${encodeURIComponent(firstLesson.id)}`,
    );
  }

  function formatDate(value: string) {
    try {
      return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  return (
    <main className="min-h-screen bg-[#edf3fb] text-slate-950">
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        .crd-hero { position: relative; overflow: hidden; background: linear-gradient(108deg, #0757c9 0%, #087eae 53%, #08aa77 100%); color: white; padding: 24px 32px 30px; }
        .crd-hero::after { content: ""; position: absolute; inset: 0; opacity: .09; background-image: radial-gradient(circle at 75% 35%, #fff 0 2px, transparent 3px), linear-gradient(120deg, transparent 45%, rgba(255,255,255,.25) 46%, transparent 47%); background-size: 140px 100px, 260px 180px; pointer-events: none; }
        .crd-hero-inner { position: relative; z-index: 1; max-width: 1480px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 32px; }
        .crd-back { border: 1px solid rgba(255,255,255,.65); border-radius: 12px; background: rgba(255,255,255,.07); color: white; padding: 10px 17px; font-weight: 900; cursor: pointer; }
        .crd-title-row { margin-top: 18px; display: flex; align-items: center; gap: 18px; }
        .crd-title-icon { width: 68px; height: 68px; display: grid; place-items: center; font-size: 42px; filter: drop-shadow(0 5px 8px rgba(0,0,0,.2)); }
        .crd-title { margin: 0; font-size: 39px; line-height: 1.05; font-weight: 950; letter-spacing: -.035em; }
        .crd-subtitle { margin: 10px 0 0; max-width: 650px; font-size: 16px; line-height: 1.45; font-weight: 750; }
        .crd-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 18px; }
        .crd-pill { min-height: 52px; border: 1px solid rgba(255,255,255,.7); border-radius: 15px; background: rgba(3,82,120,.18); color: white; padding: 13px 25px; font-size: 15px; font-weight: 950; cursor: pointer; }
        .crd-main { max-width: 1480px; margin: 0 auto; padding: 20px 30px 42px; }
        .crd-status { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #d7e2ef; border-radius: 14px; overflow: hidden; background: white; margin-bottom: 20px; box-shadow: 0 7px 20px rgba(15,23,42,.04); }
        .crd-status-box { min-height: 50px; padding: 14px 20px; font-size: 13px; font-weight: 850; color: #334155; display: flex; align-items: center; gap: 10px; }
        .crd-status-box + .crd-status-box { border-left: 1px solid #d7e2ef; }
        .crd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .crd-card { border: 1px solid #e1e8f0; border-radius: 22px; background: white; padding: 24px; box-shadow: 0 15px 35px rgba(15,23,42,.08); }
        .crd-card-title { margin: 0; display: flex; align-items: center; gap: 12px; font-size: 22px; font-weight: 950; }
        .crd-step { width: 34px; height: 34px; border-radius: 999px; display: inline-grid; place-items: center; color: white; font-size: 16px; font-weight: 950; background: #1266d5; }
        .crd-step.green { background: #0aaa69; }
        .crd-card-desc { margin: 12px 0 0; color: #475569; font-size: 14px; line-height: 1.55; font-weight: 750; }
        .crd-import-zone { margin-top: 22px; min-height: 310px; border: 2px dashed #8462ff; border-radius: 18px; background: linear-gradient(145deg, #fff, #fbfaff); padding: 30px; display: grid; place-items: center; text-align: center; }
        .crd-import-icon { font-size: 62px; line-height: 1; }
        .crd-import-title { margin-top: 18px; font-size: 22px; font-weight: 950; }
        .crd-import-copy { margin: 11px auto 0; max-width: 520px; color: #52627a; font-size: 14px; font-weight: 700; line-height: 1.55; }
        .crd-import-btn { margin-top: 22px; border: 0; border-radius: 11px; background: linear-gradient(100deg, #6d28d9, #315eea); color: white; padding: 14px 25px; font-size: 15px; font-weight: 950; cursor: pointer; box-shadow: 0 12px 24px rgba(86,52,220,.25); }
        .crd-import-btn:disabled { cursor: not-allowed; opacity: .65; }
        .crd-format { margin-top: 15px; color: #334155; font-size: 13px; font-weight: 900; }
        .crd-rejection { margin-top: 18px; border: 1px solid #fecaca; border-radius: 13px; background: #fff7f5; padding: 13px 15px; color: #a51d1d; font-size: 12px; line-height: 1.45; font-weight: 850; }
        .crd-profile { margin-top: 22px; border: 1px solid #a7e6cc; border-radius: 16px; background: linear-gradient(145deg,#f8fffb,#effcf5); padding: 22px; }
        .crd-profile-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
        .crd-profile-book { display: flex; align-items: flex-start; gap: 18px; min-width: 0; }
        .crd-cover { width: 76px; height: 104px; flex: 0 0 auto; border-radius: 10px; background: linear-gradient(145deg,#1368d5,#06a88a); color: white; display: grid; place-items: center; text-align: center; font-size: 11px; font-weight: 950; padding: 8px; box-shadow: 0 8px 18px rgba(20,78,140,.2); }
        .crd-badge { display: inline-flex; border-radius: 999px; background: #d4f9e6; color: #087443; padding: 7px 11px; font-size: 11px; font-weight: 950; white-space: nowrap; }
        .crd-profile-name { font-size: 21px; line-height: 1.2; font-weight: 950; overflow-wrap: anywhere; }
        .crd-profile-details { margin-top: 18px; display: grid; grid-template-columns: 150px minmax(0,1fr); gap: 10px 18px; font-size: 13px; }
        .crd-profile-label { color: #64748b; font-weight: 850; }
        .crd-profile-value { color: #172033; font-weight: 900; overflow-wrap: anywhere; }
        .crd-confirm { margin-top: 22px; width: 100%; border: 0; border-radius: 11px; background: linear-gradient(100deg,#07894e,#06ae6e); color: white; padding: 14px 18px; font-size: 16px; font-weight: 950; cursor: pointer; box-shadow: 0 12px 24px rgba(5,150,92,.2); }
        .crd-confirm-note { margin-top: 10px; text-align: center; color: #53627a; font-size: 12px; font-weight: 750; }
        .crd-profile-empty { margin-top: 22px; min-height: 310px; border: 1px solid #d8e1ec; border-radius: 16px; display: grid; place-items: center; text-align: center; color: #64748b; font-weight: 850; }
        .crd-tree { margin-top: 24px; border: 1px solid #e1e8f0; border-radius: 22px; background: white; padding: 24px; box-shadow: 0 15px 35px rgba(15,23,42,.08); }
        .crd-tree-list { margin-top: 18px; display: grid; gap: 14px; }
        .crd-tree-row { width: min(100%, 1240px); margin: 0 auto; border: 1px solid #b8d0ff; border-radius: 14px; background: linear-gradient(90deg,#f8fbff,#f5f8ff); padding: 15px 18px; display: grid; grid-template-columns: minmax(220px,1.35fr) .55fr .55fr .75fr auto; align-items: center; gap: 18px; color: #14213d; text-align: left; }
        .crd-tree-title { display: flex; align-items: center; gap: 14px; min-width: 0; font-size: 15px; font-weight: 950; }
        .crd-mini-cover { width: 58px; height: 76px; border-radius: 8px; background: linear-gradient(145deg,#1268d6,#0baa85); color: white; display: grid; place-items: center; font-size: 24px; flex: 0 0 auto; }
        .crd-tree-meta { border-left: 1px solid #d6e2f2; padding-left: 18px; color: #506078; font-size: 12px; font-weight: 800; }
        .crd-tree-meta strong { display: block; margin-top: 4px; color: #111827; font-size: 14px; }
        .crd-open { border: 1.5px solid #5689ff; border-radius: 11px; background: white; color: #0758d1; padding: 11px 17px; font-size: 13px; font-weight: 950; cursor: pointer; }
        .crd-empty-tree { margin-top: 18px; min-height: 150px; border: 1px solid #dbe5f2; border-radius: 16px; display: grid; place-items: center; color: #64748b; font-weight: 850; text-align: center; }
        @media (max-width: 1050px) { .crd-hero-inner, .crd-grid { display: grid; grid-template-columns: 1fr; } .crd-actions { justify-content: flex-start; } .crd-tree-row { grid-template-columns: 1fr 1fr; } .crd-open { grid-column: 1 / -1; } }
        @media (max-width: 650px) { .crd-title { font-size: 29px; } .crd-main { padding: 16px; } .crd-status, .crd-profile-details, .crd-tree-row { grid-template-columns: 1fr; } .crd-status-box + .crd-status-box { border-left: 0; border-top: 1px solid #d7e2ef; } .crd-hero { padding: 20px 16px; } .crd-profile-head { display: grid; } }
      `}</style>

      <header className="crd-hero">
        <div className="crd-hero-inner">
          <div>
            <button
              className="crd-back"
              type="button"
              onClick={() => router.push("/founder/language_center")}
            >
              ← Back
            </button>
            <div className="crd-title-row">
              <div className="crd-title-icon">📦</div>
              <div>
                <h1 className="crd-title">Elvy Ready Package Dashboard</h1>
                <p className="crd-subtitle">
                  Import validated Gold Standard Ready Packages and open their
                  complete curricula in Lesson Plan Studio.
                </p>
              </div>
            </div>
          </div>

          <div className="crd-actions">
            <button
              className="crd-pill"
              type="button"
              onClick={() => router.push("/founder/elvy-library")}
            >
              Open Elvy Library
            </button>
            <button className="crd-pill" type="button">
              ? Help
            </button>
            <button className="crd-pill" type="button">
              Teacher
            </button>
          </div>
        </div>
      </header>

      <section className="crd-main">
        <input
          ref={readyPackageInputRef}
          type="file"
          accept=".elvy,.zip,application/zip,application/x-zip-compressed"
          onChange={handleReadyPackageImport}
          hidden
        />

        <div className="crd-status">
          <div className="crd-status-box"><span>🔖</span>{saveStatus}</div>
          <div className="crd-status-box"><span>⬡</span>{packageStatus}</div>
        </div>

        <div className="crd-grid">
          <article className="crd-card">
            <h2 className="crd-card-title">
              <span className="crd-step">1</span> Import Gold Standard Ready Package
            </h2>
            <p className="crd-card-desc">
              This dashboard no longer uploads textbooks, PDFs, DOCX files,
              images, or syllabi to AI. It accepts only a prepared and validated
              GSRP created for Elvy.
            </p>

            <div className="crd-import-zone">
              <div>
                <div className="crd-import-icon">☁️</div>
                <div className="crd-import-title">
                  Import a validated Elvy package
                </div>
                <p className="crd-import-copy">
                  Elvy will validate the manifest, curriculum hierarchy, Teacher
                  Plans, Record Book data, Elvy Teaching Blueprints,
                  assessments, and linked Teaching Assets before importing.
                </p>
                <button
                  className="crd-import-btn"
                  type="button"
                  onClick={openReadyPackageImport}
                  disabled={isImportingReadyPackage || isLoading}
                >
                  {isImportingReadyPackage
                    ? "Validating and importing..."
                    : "📦 Choose GSRP File"}
                </button>
                <div className="crd-format">
                  Accepted package formats: .elvy and validated .zip
                </div>
              </div>
            </div>

            <div className="crd-rejection">
              PDF, DOCX, TXT, image, audio, and ordinary ZIP files are rejected.
              Raw curricula must first be transformed into a GSRP by the Happy
              Office Curriculum Engineering process.
            </div>
          </article>

          <article className="crd-card">
            <h2 className="crd-card-title">
              <span className="crd-step green">2</span> Package Profile
            </h2>
            <p className="crd-card-desc">
              A validated GSRP appears here for founder review. Confirm it to
              add the curriculum permanently to the Curriculum Tree and make it
              ready to open in Lesson Plan Studio.
            </p>

            {lastImportedPackage && pendingReadyPackage ? (
              <div className="crd-profile">
                <div className="crd-profile-head">
                  <div className="crd-profile-book">
                    <div className="crd-cover">ELVY<br />GSRP</div>
                    <div>
                      <div className="crd-profile-name">
                        {lastImportedPackage.title}
                      </div>
                      <div className="crd-profile-details">
                        <span className="crd-profile-label">Package ID</span>
                        <span className="crd-profile-value">{lastImportedPackage.packageId}</span>
                        <span className="crd-profile-label">Imported on</span>
                        <span className="crd-profile-value">{formatDate(lastImportedPackage.importedAt)}</span>
                        <span className="crd-profile-label">Level</span>
                        <span className="crd-profile-value">{lastImportedPackage.levelTitle}</span>
                        <span className="crd-profile-label">Units</span>
                        <span className="crd-profile-value">{lastImportedPackage.units}</span>
                        <span className="crd-profile-label">Lessons</span>
                        <span className="crd-profile-value">{lastImportedPackage.lessons}</span>
                        <span className="crd-profile-label">Package Version</span>
                        <span className="crd-profile-value">{lastImportedPackage.packageVersion}</span>
                        <span className="crd-profile-label">Source</span>
                        <span className="crd-profile-value">{lastImportedPackage.source}</span>
                      </div>
                    </div>
                  </div>
                  <span className="crd-badge">GSRP Validated</span>
                </div>
                <button
                  type="button"
                  className="crd-confirm"
                  onClick={confirmReadyPackageImport}
                >
                  ✓ Confirm Import
                </button>
                <div className="crd-confirm-note">
                  Click to confirm and make this package ready to open in Lesson Plan Studio.
                </div>
              </div>
            ) : (
              <div className="crd-profile-empty">
                <div>
                  <div style={{ fontSize: 42 }}>📄</div>
                  <div style={{ marginTop: 10 }}>Ready for the next GSRP.</div>
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    Completed packages remain available as Curriculum Tree tiles.
                  </div>
                </div>
              </div>
            )}
          </article>
        </div>

        <section className="crd-tree" aria-label="Imported curricula">
          <h2 className="crd-card-title">
            <span className="crd-step">3</span><span>🌳</span> Curriculum Tree
          </h2>
          <p className="crd-card-desc">
            Imported GSRPs open directly in Lesson Plan Studio. Delete, suspend,
            edit, and publish resources from Elvy Library.
          </p>

          {curriculumTreeRecords.length ? (
            <div className="crd-tree-list">
              {curriculumTreeRecords.map((record) => (
                <article key={record.syllabusId} className="crd-tree-row">
                  <div className="crd-tree-title">
                    <div className="crd-mini-cover">📘</div>
                    <span>{record.title}</span>
                  </div>
                  <div className="crd-tree-meta">
                    Level
                    <strong>{record.levelTitle}</strong>
                  </div>
                  <div className="crd-tree-meta">
                    Units / Lessons
                    <strong>{record.units} / {record.lessons}</strong>
                  </div>
                  <div className="crd-tree-meta">
                    Imported on
                    <strong>{formatDate(record.generatedAt)}</strong>
                  </div>
                  <button
                    className="crd-open"
                    type="button"
                    onClick={() => openLessonPlanStudio(record)}
                  >
                    ↗ Open in Lesson Plan Studio
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="crd-empty-tree">
              No imported curriculum yet. Import a validated GSRP to add it
              here.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
