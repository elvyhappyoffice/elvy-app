"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ElvyLibrary,
  type ElvyLibraryResource,
  type ElvyLibraryResourceType,
  type ElvyLibraryStatus,
} from "../../../services/curriculum-reader/elvy-library";
import { CurriculumResourceCleanup } from "../../../services/curriculum-reader/curriculum-resource-cleanup";

const RESOURCE_TYPES: Array<"All" | ElvyLibraryResourceType> = [
  "All",
  "Textbook",
  "Syllabus",
  "Workbook",
  "Teacher Guide",
  "Novel",
  "Short Story",
  "Reading Book",
  "Assessment Pack",
  "Other",
];

const STATUS_OPTIONS: Array<"All" | ElvyLibraryStatus> = [
  "All",
  "Draft",
  "Uploaded",
  "Analyzing",
  "Needs Review",
  "Approved",
  "Published",
  "Suspended",
  "Archived",
];

type LibraryEditorForm = {
  title: string;
  subtitle: string;
  resourceType: ElvyLibraryResourceType;
  language: string;
  level: string;
  schoolLevel: string;
  authors: string;
  publisher: string;
  edition: string;
  isbn: string;
  publicSummary: string;
  targetAudience: string;
  learningGoals: string;
  topics: string;
};

type EditorSaveMode = "save" | "publish" | "reanalyse";

export default function FounderElvyLibraryPage() {
  const router = useRouter();

  const [resources, setResources] = useState<ElvyLibraryResource[]>([]);
  const [search, setSearch] = useState("");
  const [resourceType, setResourceType] = useState<
    "All" | ElvyLibraryResourceType
  >("All");
  const [status, setStatus] = useState<"All" | ElvyLibraryStatus>("All");
  const [isLoading, setIsLoading] = useState(true);
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(
    null,
  );
  const [editingResource, setEditingResource] =
    useState<ElvyLibraryResource | null>(null);
  const [editorForm, setEditorForm] = useState<LibraryEditorForm | null>(null);
  const [editorError, setEditorError] = useState("");
  const [editorSaveMode, setEditorSaveMode] =
    useState<EditorSaveMode | null>(null);
  const [message, setMessage] = useState("Loading Elvy Library...");

  useEffect(() => {
    loadLibrary();
  }, []);

  function loadLibrary() {
    try {
      const loaded = ElvyLibrary.loadAll();
      setResources(loaded);
      setMessage(
        loaded.length
          ? `${loaded.length} library resource${loaded.length === 1 ? "" : "s"} loaded.`
          : "No resources have been added to Elvy Library yet.",
      );
    } catch (error) {
      console.error("Elvy Library load failed:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Elvy Library could not be loaded.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const filteredResources = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return resources.filter((resource) => {
      if (resourceType !== "All" && resource.resourceType !== resourceType) {
        return false;
      }

      if (status !== "All" && resource.status !== status) {
        return false;
      }

      if (!normalizedSearch) return true;

      const searchable = [
        resource.title,
        resource.subtitle,
        resource.resourceType,
        resource.language,
        resource.level,
        resource.schoolLevel,
        resource.publisher,
        resource.edition,
        resource.uploadedBy,
        resource.publicSummary,
        ...(resource.authors || []),
        ...(resource.targetAudience || []),
        ...(resource.topics || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [resources, resourceType, search, status]);

  function formatDate(value?: string) {
    if (!value) return "—";

    try {
      return new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function formatFileSize(bytes?: number) {
    if (!bytes && bytes !== 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function statusClasses(resourceStatus: ElvyLibraryStatus) {
    if (resourceStatus === "Published") {
      return "bg-emerald-100 text-emerald-800";
    }

    if (resourceStatus === "Approved") {
      return "bg-green-100 text-green-800";
    }

    if (resourceStatus === "Suspended" || resourceStatus === "Archived") {
      return "bg-slate-200 text-slate-700";
    }

    if (
      resourceStatus === "Analyzing" ||
      resourceStatus === "Needs Review"
    ) {
      return "bg-blue-100 text-blue-800";
    }

    return "bg-amber-100 text-amber-800";
  }

  function openResource(resource: ElvyLibraryResource) {
    window.localStorage.setItem(
      "elvy-library-open-resource",
      JSON.stringify({
        resourceId: resource.id,
        syllabusId: resource.syllabusId,
        levelId: resource.levelId,
      }),
    );

    router.push("/founder/curriculum");
  }

  function joinEditorValues(values?: string[]) {
    return (values || []).join("\n");
  }

  function splitEditorValues(value: string) {
    return Array.from(
      new Set(
        value
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  function openEditor(resource: ElvyLibraryResource) {
    setEditingResource(resource);
    setEditorForm({
      title: resource.title,
      subtitle: resource.subtitle || "",
      resourceType: resource.resourceType,
      language: resource.language,
      level: resource.level || "",
      schoolLevel: resource.schoolLevel || "",
      authors: (resource.authors || []).join(", "),
      publisher: resource.publisher || "",
      edition: resource.edition || "",
      isbn: resource.isbn || "",
      publicSummary: resource.publicSummary,
      targetAudience: joinEditorValues(resource.targetAudience),
      learningGoals: joinEditorValues(resource.learningGoals),
      topics: joinEditorValues(resource.topics),
    });
    setEditorError("");
    setEditorSaveMode(null);
  }

  function closeEditor() {
    if (editorSaveMode) return;
    setEditingResource(null);
    setEditorForm(null);
    setEditorError("");
  }

  function updateEditorField<K extends keyof LibraryEditorForm>(
    field: K,
    value: LibraryEditorForm[K],
  ) {
    setEditorForm((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }

  function validateEditorForm(form: LibraryEditorForm) {
    if (!form.title.trim()) return "Book title is required.";
    if (!form.language.trim()) return "Language is required.";
    if (!form.publicSummary.trim()) return "Public summary is required.";
    if (!splitEditorValues(form.targetAudience).length) {
      return "Add at least one target audience.";
    }
    return "";
  }

  function saveEditorMetadata(
    resource: ElvyLibraryResource,
    form: LibraryEditorForm,
  ) {
    return ElvyLibrary.update(resource.id, {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || undefined,
      resourceType: form.resourceType,
      language: form.language.trim(),
      level: form.level.trim() || undefined,
      schoolLevel: form.schoolLevel.trim() || undefined,
      authors: splitEditorValues(form.authors),
      publisher: form.publisher.trim() || undefined,
      edition: form.edition.trim() || undefined,
      isbn: form.isbn.trim() || undefined,
      publicSummary: form.publicSummary.trim(),
      targetAudience: splitEditorValues(form.targetAudience),
      learningGoals: splitEditorValues(form.learningGoals),
      topics: splitEditorValues(form.topics),
    });
  }

  async function submitEditor(mode: EditorSaveMode) {
    if (!editingResource || !editorForm) return;

    const validationError = validateEditorForm(editorForm);
    if (validationError) {
      setEditorError(validationError);
      return;
    }

    try {
      setEditorSaveMode(mode);
      setEditorError("");

      let updated = saveEditorMetadata(editingResource, editorForm);

      if (mode === "publish") {
        updated = ElvyLibrary.publish(updated.id);
        setMessage(`${updated.title} was saved and published.`);
      } else if (mode === "reanalyse") {
        if (!updated.syllabusId) {
          throw new Error(
            "This resource is not linked to a syllabusId and cannot be re-analysed.",
          );
        }

        updated = ElvyLibrary.updateForReanalysis(updated.id);

        window.localStorage.setItem(
          "elvy-library-reanalyse-resource",
          JSON.stringify({
            resourceId: updated.id,
            syllabusId: updated.syllabusId,
            levelId: updated.levelId,
            requestedAt: new Date().toISOString(),
          }),
        );

        setResources(ElvyLibrary.loadAll());
        setMessage(
          `${updated.title} was saved and opened for re-analysis in Curriculum Reader.`,
        );
        setEditingResource(null);
        setEditorForm(null);
        router.push("/founder/curriculum");
        return;
      } else {
        setMessage(`${updated.title} metadata was saved.`);
      }

      setResources(ElvyLibrary.loadAll());
      setEditingResource(null);
      setEditorForm(null);
    } catch (error) {
      console.error("Library editor save failed:", error);
      setEditorError(
        error instanceof Error
          ? error.message
          : "The resource metadata could not be saved.",
      );
    } finally {
      setEditorSaveMode(null);
    }
  }

  function suspendResource(resource: ElvyLibraryResource) {
    const confirmed = window.confirm(
      `Suspend "${resource.title}"? It will remain stored but will not be visible to public users.`,
    );
    if (!confirmed) return;

    try {
      ElvyLibrary.suspend(resource.id);
      setResources(ElvyLibrary.loadAll());
      setMessage(`${resource.title} has been suspended.`);
    } catch (error) {
      console.error("Suspend failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "The resource could not be suspended.",
      );
    }
  }

  function reactivateResource(resource: ElvyLibraryResource) {
    try {
      const updated = ElvyLibrary.reactivate(resource.id);
      setResources(ElvyLibrary.loadAll());
      setMessage(
        `${updated.title} has been reactivated with status ${updated.status}.`,
      );
    } catch (error) {
      console.error("Reactivate failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "The resource could not be reactivated.",
      );
    }
  }

  async function deleteResource(resource: ElvyLibraryResource) {
    const syllabusId = resource.syllabusId?.trim();

    if (!syllabusId) {
      alert(
        "This resource is not linked to a syllabusId, so Elvy cannot safely remove all associated curriculum data.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete "${resource.title}"?\n\nThis will remove the Library record, academic profile, generated curriculum tree and level, Lesson Plan Studio records, preflight data, pending requests, and the locally stored source file. This action cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      setDeletingResourceId(resource.id);
      setMessage(`Deleting ${resource.title} and all linked curriculum data...`);

      const result =
        await CurriculumResourceCleanup.deleteCurriculumResource({
          resourceId: resource.id,
          syllabusId,
          levelId: resource.levelId,
        });

      setResources(ElvyLibrary.loadAll());

      const removedItems = [
        result.removed.libraryRecord ? "library record" : "",
        result.removed.academicProfile ? "academic profile" : "",
        result.removed.curriculumTreeRecord ? "curriculum tree" : "",
        result.removed.generatedLevel ? "generated level" : "",
        result.removed.lessonPlanRecords
          ? `${result.removed.lessonPlanRecords} lesson-plan record${
              result.removed.lessonPlanRecords === 1 ? "" : "s"
            }`
          : "",
        result.removed.preflightRecords
          ? `${result.removed.preflightRecords} preflight record${
              result.removed.preflightRecords === 1 ? "" : "s"
            }`
          : "",
        result.removed.pendingRequests
          ? `${result.removed.pendingRequests} pending request${
              result.removed.pendingRequests === 1 ? "" : "s"
            }`
          : "",
        result.removed.sourceFile ? "stored source file" : "",
      ].filter(Boolean);

      const cleanupSummary = removedItems.length
        ? ` Removed: ${removedItems.join(", ")}.`
        : "";

      const warningSummary = result.warnings.length
        ? ` Warning: ${result.warnings.join(" ")}`
        : "";

      setMessage(
        `${resource.title} was deleted from Elvy Library and Curriculum Reader.${cleanupSummary}${warningSummary}`,
      );

      if (result.warnings.length) {
        console.warn("Curriculum cleanup completed with warnings:", result);
      }
    } catch (error) {
      console.error("Delete failed:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "The resource could not be deleted.";

      setMessage(`Delete failed: ${errorMessage}`);
      alert(errorMessage);
    } finally {
      setDeletingResourceId(null);
    }
  }

  function publishResource(resource: ElvyLibraryResource) {
    const confirmed = window.confirm(
      `Publish "${resource.title}" to the public Elvy Library?`,
    );
    if (!confirmed) return;

    try {
      const updated = ElvyLibrary.publish(resource.id);
      setResources(ElvyLibrary.loadAll());
      setMessage(`${updated.title} is now published.`);
    } catch (error) {
      console.error("Publish failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "The resource could not be published.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f1ea] px-4 py-6 text-[#2f241f] md:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-[28px] border border-[#e5d8ca] bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8b6b55]">
                Founder Management
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#2e211a] md:text-4xl">
                Elvy Library
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f5a4b] md:text-base">
                Manage all textbooks, syllabi, novels, short stories, reading
                books, and future learning resources from one library.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/founder/curriculum")}
                className="rounded-xl border border-[#cdb9a6] bg-white px-4 py-2.5 text-sm font-black text-[#4b3326] shadow-sm transition hover:bg-[#f8f1ea]"
              >
                Back to Curriculum Reader
              </button>

              <button
                type="button"
                onClick={() => router.push("/founder/curriculum")}
                className="rounded-xl bg-[#1d7fe2] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#176dc3]"
              >
                Upload New Resource
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, author, language, level, publisher..."
              className="h-11 rounded-xl border border-[#d9cbbb] bg-[#fffdf9] px-4 text-sm outline-none transition focus:border-[#1d7fe2] focus:ring-2 focus:ring-blue-100"
            />

            <select
              value={resourceType}
              onChange={(event) =>
                setResourceType(
                  event.target.value as "All" | ElvyLibraryResourceType,
                )
              }
              className="h-11 rounded-xl border border-[#d9cbbb] bg-[#fffdf9] px-3 text-sm font-bold outline-none focus:border-[#1d7fe2]"
            >
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === "All" ? "All resource types" : type}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "All" | ElvyLibraryStatus)
              }
              className="h-11 rounded-xl border border-[#d9cbbb] bg-[#fffdf9] px-3 text-sm font-bold outline-none focus:border-[#1d7fe2]"
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All statuses" : item}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadLibrary}
              className="h-11 rounded-xl bg-[#3b2a21] px-4 text-sm font-black text-white transition hover:bg-[#241912]"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f8f3ed] px-4 py-3 text-sm">
            <span className="font-bold text-[#6a5141]">{message}</span>
            <span className="font-black text-[#3b2a21]">
              Showing {filteredResources.length} of {resources.length}
            </span>
          </div>
        </section>

        {isLoading ? (
          <section className="mt-6 rounded-[28px] border border-[#e5d8ca] bg-white p-10 text-center shadow-sm">
            <p className="font-bold text-[#6f5a4b]">Loading Elvy Library...</p>
          </section>
        ) : filteredResources.length === 0 ? (
          <section className="mt-6 rounded-[28px] border border-dashed border-[#ccb9a7] bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-16 items-center justify-center rounded-lg bg-[#efe3d7] text-3xl">
              📚
            </div>
            <h2 className="mt-5 text-xl font-black text-[#35251d]">
              No matching resources
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#756052]">
              Upload and analyse a resource in Curriculum Reader. Once it is
              registered, it will appear here automatically in alphabetical
              order.
            </p>
          </section>
        ) : (
          <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredResources.map((resource) => (
              <article
                key={resource.id}
                className="flex min-h-[620px] flex-col overflow-hidden rounded-[24px] border border-[#dfd1c2] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative flex h-64 items-center justify-center overflow-hidden bg-gradient-to-br from-[#eee3d8] to-[#d9c3ae]">
                  {resource.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resource.coverImageUrl}
                      alt={`${resource.title} cover`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-48 w-36 flex-col items-center justify-center rounded-lg border border-white/60 bg-white/75 px-4 text-center shadow-lg">
                      <span className="text-4xl">📘</span>
                      <span className="mt-3 line-clamp-4 text-sm font-black leading-5 text-[#3c2a20]">
                        {resource.title}
                      </span>
                    </div>
                  )}

                  <span
                    className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-black ${statusClasses(
                      resource.status,
                    )}`}
                  >
                    {resource.status}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a7157]">
                      {resource.resourceType}
                    </p>
                    <h2 className="mt-1 line-clamp-2 text-xl font-black leading-7 text-[#2f211a]">
                      {resource.title}
                    </h2>
                    {resource.subtitle ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[#765f50]">
                        {resource.subtitle}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-[#faf6f1] p-4 text-xs">
                    <Metadata label="Language" value={resource.language} />
                    <Metadata
                      label="Level"
                      value={
                        resource.level ||
                        resource.schoolLevel ||
                        resource.targetStage ||
                        "—"
                      }
                    />
                    <Metadata
                      label="Uploaded"
                      value={formatDate(resource.uploadedAt)}
                    />
                    <Metadata
                      label="Uploaded by"
                      value={resource.uploadedBy}
                    />
                    <Metadata
                      label="Pages"
                      value={
                        resource.sourceFile.pageCount
                          ? String(resource.sourceFile.pageCount)
                          : "—"
                      }
                    />
                    <Metadata
                      label="File size"
                      value={formatFileSize(resource.sourceFile.fileSize)}
                    />
                    <Metadata
                      label="Last analysis"
                      value={formatDate(resource.analysis?.lastAnalyzedAt)}
                    />
                    <Metadata
                      label="Units / Lessons"
                      value={`${resource.units ?? "—"} / ${
                        resource.lessons ?? "—"
                      }`}
                    />
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#92725d]">
                      Public summary
                    </p>
                    <p className="mt-1 line-clamp-4 text-sm leading-6 text-[#5f4a3d]">
                      {resource.publicSummary}
                    </p>
                  </div>

                  <div className="mt-auto pt-5">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openResource(resource)}
                        className="rounded-xl bg-[#3b2a21] px-3 py-2.5 text-xs font-black text-white transition hover:bg-[#241912]"
                      >
                        Open
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditor(resource)}
                        className="rounded-xl bg-[#1d7fe2] px-3 py-2.5 text-xs font-black text-white transition hover:bg-[#176dc3]"
                      >
                        Edit
                      </button>

                      {resource.status === "Suspended" ? (
                        <button
                          type="button"
                          onClick={() => reactivateResource(resource)}
                          className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700"
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => suspendResource(resource)}
                          className="rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-black text-white transition hover:bg-amber-600"
                        >
                          Suspend
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void deleteResource(resource)}
                        disabled={deletingResourceId === resource.id}
                        className="rounded-xl bg-red-600 px-3 py-2.5 text-xs font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingResourceId === resource.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>

                    {resource.status === "Approved" ? (
                      <button
                        type="button"
                        onClick={() => publishResource(resource)}
                        className="mt-2 w-full rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-800 transition hover:bg-emerald-100"
                      >
                        Publish to Public Library
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {editingResource && editorForm ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-6 md:py-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="library-editor-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <section className="w-full max-w-6xl overflow-hidden rounded-[28px] border border-[#ddcdbd] bg-[#fffdf9] shadow-2xl">
            <div className="flex flex-col gap-4 border-b border-[#e8dbcf] bg-white px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8b6b55]">
                  Founder Editor
                </p>
                <h2
                  id="library-editor-title"
                  className="mt-1 text-2xl font-black text-[#2f211a]"
                >
                  Edit Library Resource
                </h2>
                <p className="mt-1 text-sm text-[#715b4d]">
                  Review the AI-generated description before it appears in the
                  public Elvy Library.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={Boolean(editorSaveMode)}
                className="self-start rounded-xl border border-[#d5c4b4] bg-white px-4 py-2 text-sm font-black text-[#4a3428] transition hover:bg-[#f7efe8] disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-5 md:p-7">
              {editorError ? (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {editorError}
                </div>
              ) : null}

              <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
                <div className="space-y-6">
                  <EditorSection
                    title="Book Information"
                    description="Founder-controlled identity and catalogue information."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <EditorField label="Book title" required>
                        <input
                          value={editorForm.title}
                          onChange={(event) =>
                            updateEditorField("title", event.target.value)
                          }
                          className={editorInputClasses}
                        />
                      </EditorField>

                      <EditorField label="Subtitle">
                        <input
                          value={editorForm.subtitle}
                          onChange={(event) =>
                            updateEditorField("subtitle", event.target.value)
                          }
                          className={editorInputClasses}
                        />
                      </EditorField>

                      <EditorField label="Resource type">
                        <select
                          value={editorForm.resourceType}
                          onChange={(event) =>
                            updateEditorField(
                              "resourceType",
                              event.target.value as ElvyLibraryResourceType,
                            )
                          }
                          className={editorInputClasses}
                        >
                          {RESOURCE_TYPES.filter((item) => item !== "All").map(
                            (item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ),
                          )}
                        </select>
                      </EditorField>

                      <EditorField label="Language" required>
                        <input
                          value={editorForm.language}
                          onChange={(event) =>
                            updateEditorField("language", event.target.value)
                          }
                          className={editorInputClasses}
                        />
                      </EditorField>

                      <EditorField label="Level">
                        <input
                          value={editorForm.level}
                          onChange={(event) =>
                            updateEditorField("level", event.target.value)
                          }
                          placeholder="Example: Level A"
                          className={editorInputClasses}
                        />
                      </EditorField>

                      <EditorField label="School level">
                        <input
                          value={editorForm.schoolLevel}
                          onChange={(event) =>
                            updateEditorField(
                              "schoolLevel",
                              event.target.value,
                            )
                          }
                          placeholder="Example: 1st Year Middle School"
                          className={editorInputClasses}
                        />
                      </EditorField>

                      <EditorField label="Authors">
                        <input
                          value={editorForm.authors}
                          onChange={(event) =>
                            updateEditorField("authors", event.target.value)
                          }
                          placeholder="Separate names with commas"
                          className={editorInputClasses}
                        />
                      </EditorField>

                      <EditorField label="Publisher">
                        <input
                          value={editorForm.publisher}
                          onChange={(event) =>
                            updateEditorField("publisher", event.target.value)
                          }
                          className={editorInputClasses}
                        />
                      </EditorField>

                      <EditorField label="Edition">
                        <input
                          value={editorForm.edition}
                          onChange={(event) =>
                            updateEditorField("edition", event.target.value)
                          }
                          className={editorInputClasses}
                        />
                      </EditorField>

                      <EditorField label="ISBN">
                        <input
                          value={editorForm.isbn}
                          onChange={(event) =>
                            updateEditorField("isbn", event.target.value)
                          }
                          className={editorInputClasses}
                        />
                      </EditorField>
                    </div>
                  </EditorSection>

                  <EditorSection
                    title="Public Description"
                    description="This is the learner-friendly information that public users will see."
                  >
                    <div className="space-y-4">
                      <EditorField label="Short summary" required>
                        <textarea
                          value={editorForm.publicSummary}
                          onChange={(event) =>
                            updateEditorField(
                              "publicSummary",
                              event.target.value,
                            )
                          }
                          rows={5}
                          className={`${editorInputClasses} min-h-32 resize-y py-3`}
                        />
                      </EditorField>

                      <div className="grid gap-4 md:grid-cols-3">
                        <EditorField
                          label="Target audience"
                          hint="One item per line"
                          required
                        >
                          <textarea
                            value={editorForm.targetAudience}
                            onChange={(event) =>
                              updateEditorField(
                                "targetAudience",
                                event.target.value,
                              )
                            }
                            rows={7}
                            className={`${editorInputClasses} resize-y py-3`}
                          />
                        </EditorField>

                        <EditorField
                          label="Learning goals"
                          hint="One goal per line"
                        >
                          <textarea
                            value={editorForm.learningGoals}
                            onChange={(event) =>
                              updateEditorField(
                                "learningGoals",
                                event.target.value,
                              )
                            }
                            rows={7}
                            className={`${editorInputClasses} resize-y py-3`}
                          />
                        </EditorField>

                        <EditorField
                          label="Main topics"
                          hint="One topic per line"
                        >
                          <textarea
                            value={editorForm.topics}
                            onChange={(event) =>
                              updateEditorField("topics", event.target.value)
                            }
                            rows={7}
                            className={`${editorInputClasses} resize-y py-3`}
                          />
                        </EditorField>
                      </div>
                    </div>
                  </EditorSection>
                </div>

                <div className="space-y-6">
                  <EditorSection
                    title="Curriculum Statistics"
                    description="Read-only operational information generated by Curriculum Reader."
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <EditorStat
                        label="Status"
                        value={editingResource.status}
                      />
                      <EditorStat
                        label="Visibility"
                        value={editingResource.visibility}
                      />
                      <EditorStat
                        label="Units"
                        value={String(editingResource.units ?? "—")}
                      />
                      <EditorStat
                        label="Lessons"
                        value={String(editingResource.lessons ?? "—")}
                      />
                      <EditorStat
                        label="Pages"
                        value={String(
                          editingResource.sourceFile.pageCount ?? "—",
                        )}
                      />
                      <EditorStat
                        label="File size"
                        value={formatFileSize(
                          editingResource.sourceFile.fileSize,
                        )}
                      />
                      <EditorStat
                        label="Uploaded"
                        value={formatDate(editingResource.uploadedAt)}
                      />
                      <EditorStat
                        label="Last analysis"
                        value={formatDate(
                          editingResource.analysis?.lastAnalyzedAt,
                        )}
                      />
                      <EditorStat
                        label="Revision"
                        value={String(editingResource.revision)}
                      />
                      <EditorStat
                        label="AI cost"
                        value={
                          editingResource.analysis
                            ?.estimatedPreparationCost !== undefined
                            ? `${editingResource.analysis.estimatedPreparationCost.toFixed(
                                4,
                              )} ${
                                editingResource.analysis.currency || "USD"
                              }`
                            : "—"
                        }
                      />
                    </div>

                    <div className="mt-4 space-y-3">
                      <ReadOnlyDetail
                        label="Source file"
                        value={editingResource.sourceFile.fileName}
                      />
                      <ReadOnlyDetail
                        label="Fingerprint"
                        value={
                          editingResource.sourceFile.contentHash || "—"
                        }
                        mono
                      />
                      <ReadOnlyDetail
                        label="Syllabus ID"
                        value={editingResource.syllabusId || "—"}
                        mono
                      />
                      <ReadOnlyDetail
                        label="Curriculum tree"
                        value={editingResource.curriculumTreeId || "—"}
                        mono
                      />
                    </div>
                  </EditorSection>

                  <div className="rounded-2xl border border-[#ddcdbd] bg-white p-5">
                    <h3 className="text-lg font-black text-[#32231c]">
                      Save Actions
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[#725c4d]">
                      Metadata edits do not require AI analysis. Use
                      re-analysis only when the curriculum source or structure
                      needs to be processed again.
                    </p>

                    <div className="mt-5 space-y-3">
                      <button
                        type="button"
                        onClick={() => void submitEditor("save")}
                        disabled={Boolean(editorSaveMode)}
                        className="w-full rounded-xl bg-[#3b2a21] px-4 py-3 text-sm font-black text-white transition hover:bg-[#241912] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {editorSaveMode === "save"
                          ? "Saving..."
                          : "Save Metadata"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void submitEditor("publish")}
                        disabled={Boolean(editorSaveMode)}
                        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {editorSaveMode === "publish"
                          ? "Publishing..."
                          : "Save & Publish"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void submitEditor("reanalyse")}
                        disabled={Boolean(editorSaveMode)}
                        className="w-full rounded-xl bg-[#1d7fe2] px-4 py-3 text-sm font-black text-white transition hover:bg-[#176dc3] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {editorSaveMode === "reanalyse"
                          ? "Preparing..."
                          : "Save & Re-analyse"}
                      </button>

                      <button
                        type="button"
                        onClick={closeEditor}
                        disabled={Boolean(editorSaveMode)}
                        className="w-full rounded-xl border border-[#cfbdac] bg-white px-4 py-3 text-sm font-black text-[#4b3427] transition hover:bg-[#f8f1ea] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

const editorInputClasses =
  "w-full rounded-xl border border-[#d9cbbb] bg-[#fffdf9] px-3 py-2.5 text-sm text-[#34251d] outline-none transition placeholder:text-[#aa9484] focus:border-[#1d7fe2] focus:ring-2 focus:ring-blue-100";

function EditorSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#ddcdbd] bg-white p-5">
      <h3 className="text-lg font-black text-[#32231c]">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[#725c4d]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EditorField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.1em] text-[#816754]">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      {hint ? (
        <span className="ml-2 text-[11px] font-semibold normal-case tracking-normal text-[#a08776]">
          {hint}
        </span>
      ) : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function EditorStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#faf6f1] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.09em] text-[#9a8170]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-[#3e2c22]">
        {value}
      </p>
    </div>
  );
}

function ReadOnlyDetail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.09em] text-[#9a8170]">
        {label}
      </p>
      <p
        className={`mt-1 break-all rounded-lg bg-[#faf6f1] px-3 py-2 text-xs font-bold text-[#4c382d] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-black uppercase tracking-[0.08em] text-[#9a8170]">
        {label}
      </p>
      <p className="mt-1 line-clamp-2 font-bold text-[#3e2c22]">{value}</p>
    </div>
  );
}
