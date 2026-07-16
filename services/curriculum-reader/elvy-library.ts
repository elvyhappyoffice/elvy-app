/**
 * Elvy Library — local repository service
 *
 * One stored resource record supports two views:
 * - Founder view: full operational metadata and lifecycle controls.
 * - Public view: learner-friendly information only.
 *
 * This localStorage implementation is for local development. Later it can be
 * replaced internally with Supabase without changing the dashboard API.
 */

export const ELVY_LIBRARY_STORAGE_KEY = "elvy-library-resources-v1";

export type ElvyLibraryResourceType =
  | "Textbook"
  | "Syllabus"
  | "Workbook"
  | "Teacher Guide"
  | "Novel"
  | "Short Story"
  | "Reading Book"
  | "Assessment Pack"
  | "Other";

export type ElvyLibraryStatus =
  | "Draft"
  | "Uploaded"
  | "Analyzing"
  | "Needs Review"
  | "Approved"
  | "Published"
  | "Suspended"
  | "Archived";

export type ElvyLibraryVisibility = "private" | "public";

export type ElvyLibrarySourceFile = {
  fileName: string;
  fileType: string;
  fileSize: number;
  mimeType?: string;
  contentHash?: string;
  pageCount?: number;
  pageCountSource?: "actual-pdf" | "estimated-docx" | "estimated" | "unknown";
};

export type ElvyLibraryAnalysisMetadata = {
  analysisVersion?: string;
  model?: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  estimatedPreparationCost?: number;
  currency?: "USD" | "MAD" | "EUR";
  lastAnalyzedAt?: string;
  confidenceScore?: number;
  warnings?: string[];
};

export type ElvyLibraryResource = {
  id: string;
  syllabusId?: string;
  title: string;
  sortTitle: string;
  subtitle?: string;
  coverImageUrl?: string;
  resourceType: ElvyLibraryResourceType;
  language: string;
  level?: string;
  schoolLevel?: string;
  targetStage?: "Beginner" | "Intermediate" | "Advanced";
  publisher?: string;
  edition?: string;
  publicationYear?: number;
  authors?: string[];
  isbn?: string;
  publicSummary: string;
  targetAudience: string[];
  learningGoals?: string[];
  topics?: string[];
  status: ElvyLibraryStatus;
  visibility: ElvyLibraryVisibility;
  uploadedAt: string;
  uploadedBy: string;
  updatedAt: string;
  publishedAt?: string;
  suspendedAt?: string;
  archivedAt?: string;
  sourceFile: ElvyLibrarySourceFile;
  analysis?: ElvyLibraryAnalysisMetadata;
  curriculumTreeId?: string;
  levelId?: string;
  units?: number;
  lessons?: number;
  packageSource?: "ready-package" | "curriculum-reader";
  packageVersion?: number;
  packageId?: string;
  packageStatus?: "Incomplete" | "Complete";
  teacherPlansReady?: boolean;
  elvyBlueprintsReady?: boolean;
  teachingAssetsReady?: boolean;
  revision: number;
};

export type FounderLibraryItem = ElvyLibraryResource;

export type PublicLibraryItem = {
  id: string;
  title: string;
  subtitle?: string;
  coverImageUrl?: string;
  resourceType: ElvyLibraryResourceType;
  language: string;
  level?: string;
  schoolLevel?: string;
  targetStage?: "Beginner" | "Intermediate" | "Advanced";
  summary: string;
  targetAudience: string[];
  learningGoals: string[];
  topics: string[];
};

export type CreateElvyLibraryResourceInput = {
  id?: string;
  syllabusId?: string;
  title: string;
  subtitle?: string;
  coverImageUrl?: string;
  resourceType?: ElvyLibraryResourceType;
  language?: string;
  level?: string;
  schoolLevel?: string;
  targetStage?: "Beginner" | "Intermediate" | "Advanced";
  publisher?: string;
  edition?: string;
  publicationYear?: number;
  authors?: string[];
  isbn?: string;
  publicSummary?: string;
  targetAudience?: string[];
  learningGoals?: string[];
  topics?: string[];
  status?: ElvyLibraryStatus;
  visibility?: ElvyLibraryVisibility;
  uploadedAt?: string;
  uploadedBy?: string;
  sourceFile: ElvyLibrarySourceFile;
  analysis?: ElvyLibraryAnalysisMetadata;
  curriculumTreeId?: string;
  levelId?: string;
  units?: number;
  lessons?: number;
  packageSource?: "ready-package" | "curriculum-reader";
  packageVersion?: number;
  packageId?: string;
  packageStatus?: "Incomplete" | "Complete";
  teacherPlansReady?: boolean;
  elvyBlueprintsReady?: boolean;
  teachingAssetsReady?: boolean;
};

export type UpdateElvyLibraryResourceInput = Partial<
  Omit<ElvyLibraryResource, "id" | "sortTitle" | "uploadedAt" | "updatedAt" | "revision">
> & { title?: string };

export type ElvyLibraryQuery = {
  search?: string;
  resourceType?: ElvyLibraryResourceType;
  language?: string;
  level?: string;
  status?: ElvyLibraryStatus;
  visibility?: ElvyLibraryVisibility;
};

export class ElvyLibraryError extends Error {
  readonly code:
    | "INVALID_RESOURCE"
    | "NOT_FOUND"
    | "STORAGE_UNAVAILABLE"
    | "STORAGE_READ_FAILED"
    | "STORAGE_WRITE_FAILED";

  constructor(code: ElvyLibraryError["code"], message: string, cause?: unknown) {
    super(message);
    this.name = "ElvyLibraryError";
    this.code = code;
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", { value: cause, configurable: true });
    }
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `elvy-resource-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeSortTitle(title: string): string {
  return normalizeText(title)
    .toLocaleLowerCase("en")
    .replace(/^(a|an|the)\s+/i, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeStringArray(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => normalizeText(String(value))).filter(Boolean)));
}

function fallbackPublicSummary(input: CreateElvyLibraryResourceInput): string {
  const level = input.level || input.schoolLevel || input.targetStage;
  const audience = input.targetAudience?.length ? input.targetAudience.join(", ") : "language learners";
  return `${normalizeText(input.title)} is a ${input.resourceType || "learning resource"} for ${level ? `${level} ` : ""}${audience}. Its curriculum content is prepared for guided learning with Elvy.`;
}

function ensureBrowserStorage(): Storage {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new ElvyLibraryError("STORAGE_UNAVAILABLE", "Elvy Library local storage is only available in the browser.");
  }
  return window.localStorage;
}

function validateResource(resource: ElvyLibraryResource): void {
  if (!resource.id?.trim()) throw new ElvyLibraryError("INVALID_RESOURCE", "A library resource must have an id.");
  if (!resource.title?.trim()) throw new ElvyLibraryError("INVALID_RESOURCE", "A library resource must have a title.");
  if (!resource.sourceFile?.fileName?.trim()) throw new ElvyLibraryError("INVALID_RESOURCE", "A library resource must reference its source file.");
  if (!resource.publicSummary?.trim()) throw new ElvyLibraryError("INVALID_RESOURCE", "A library resource must have a public summary.");
}

function parseStoredResources(raw: string | null): ElvyLibraryResource[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ElvyLibraryResource => Boolean(item && typeof item === "object" && typeof item.id === "string" && typeof item.title === "string" && item.sourceFile && typeof item.sourceFile.fileName === "string"))
      .map((item) => ({
        ...item,
        title: normalizeText(item.title),
        sortTitle: item.sortTitle || normalizeSortTitle(item.title),
        publicSummary: typeof item.publicSummary === "string" ? normalizeText(item.publicSummary) : `${item.title} is an Elvy learning resource.`,
        targetAudience: normalizeStringArray(item.targetAudience),
        learningGoals: normalizeStringArray(item.learningGoals),
        topics: normalizeStringArray(item.topics),
        authors: normalizeStringArray(item.authors),
        uploadedBy: item.uploadedBy || "Founder",
        language: item.language || "English",
        status: item.status || "Draft",
        visibility: item.visibility || "private",
        uploadedAt: item.uploadedAt || nowIso(),
        updatedAt: item.updatedAt || item.uploadedAt || nowIso(),
        revision: Number.isFinite(item.revision) && item.revision > 0 ? Math.floor(item.revision) : 1,
      }));
  } catch (error) {
    throw new ElvyLibraryError("STORAGE_READ_FAILED", "Elvy Library records could not be read from local storage.", error);
  }
}

function sortAlphabetically(resources: ElvyLibraryResource[]): ElvyLibraryResource[] {
  return [...resources].sort((a, b) => {
    const byTitle = a.sortTitle.localeCompare(b.sortTitle, "en", { sensitivity: "base", numeric: true });
    return byTitle !== 0 ? byTitle : a.title.localeCompare(b.title, "en", { sensitivity: "base" });
  });
}

function writeAll(resources: ElvyLibraryResource[]): void {
  const storage = ensureBrowserStorage();
  try {
    storage.setItem(ELVY_LIBRARY_STORAGE_KEY, JSON.stringify(sortAlphabetically(resources)));
  } catch (error) {
    throw new ElvyLibraryError("STORAGE_WRITE_FAILED", "Elvy Library records could not be saved locally.", error);
  }
}

function matchesQuery(resource: ElvyLibraryResource, query: ElvyLibraryQuery): boolean {
  if (query.resourceType && resource.resourceType !== query.resourceType) return false;
  if (query.language && resource.language.toLocaleLowerCase("en") !== query.language.toLocaleLowerCase("en")) return false;
  if (query.level && (resource.level || "").toLocaleLowerCase("en") !== query.level.toLocaleLowerCase("en")) return false;
  if (query.status && resource.status !== query.status) return false;
  if (query.visibility && resource.visibility !== query.visibility) return false;
  const search = query.search?.trim().toLocaleLowerCase("en");
  if (!search) return true;
  const searchable = [resource.title, resource.subtitle, resource.resourceType, resource.language, resource.level, resource.schoolLevel, resource.publisher, resource.edition, resource.publicSummary, ...resource.targetAudience, ...(resource.topics || []), ...(resource.authors || [])]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en");
  return searchable.includes(search);
}

function toPublicLibraryItem(resource: ElvyLibraryResource): PublicLibraryItem {
  return {
    id: resource.id,
    title: resource.title,
    subtitle: resource.subtitle,
    coverImageUrl: resource.coverImageUrl,
    resourceType: resource.resourceType,
    language: resource.language,
    level: resource.level,
    schoolLevel: resource.schoolLevel,
    targetStage: resource.targetStage,
    summary: resource.publicSummary,
    targetAudience: [...resource.targetAudience],
    learningGoals: [...(resource.learningGoals || [])],
    topics: [...(resource.topics || [])],
  };
}

export const ElvyLibrary = {
  loadAll(): ElvyLibraryResource[] {
    const storage = ensureBrowserStorage();
    return sortAlphabetically(parseStoredResources(storage.getItem(ELVY_LIBRARY_STORAGE_KEY)));
  },

  listFounderResources(query: ElvyLibraryQuery = {}): FounderLibraryItem[] {
    return this.loadAll().filter((resource) => matchesQuery(resource, query));
  },

  listPublicResources(query: Omit<ElvyLibraryQuery, "status"> = {}): PublicLibraryItem[] {
    return this.loadAll()
      .filter((resource) => resource.status === "Published" && resource.visibility === "public" && matchesQuery(resource, { ...query, status: "Published", visibility: "public" }))
      .map(toPublicLibraryItem);
  },

  getById(id: string): ElvyLibraryResource | null {
    return this.loadAll().find((resource) => resource.id === id.trim()) || null;
  },

  findBySyllabusId(syllabusId: string): ElvyLibraryResource | null {
    return this.loadAll().find((resource) => resource.syllabusId === syllabusId.trim()) || null;
  },

  findByContentHash(contentHash: string): ElvyLibraryResource | null {
    const normalized = contentHash.trim().toLowerCase();
    return this.loadAll().find((resource) => resource.sourceFile.contentHash?.toLowerCase() === normalized) || null;
  },

  create(input: CreateElvyLibraryResourceInput): ElvyLibraryResource {
    const resources = this.loadAll();
    const timestamp = input.uploadedAt || nowIso();
    const title = normalizeText(input.title);
    if (!title) throw new ElvyLibraryError("INVALID_RESOURCE", "A title is required to create an Elvy Library resource.");

    const resource: ElvyLibraryResource = {
      id: input.id || createId(),
      syllabusId: input.syllabusId,
      title,
      sortTitle: normalizeSortTitle(title),
      subtitle: input.subtitle ? normalizeText(input.subtitle) : undefined,
      coverImageUrl: input.coverImageUrl,
      resourceType: input.resourceType || "Textbook",
      language: normalizeText(input.language || "English"),
      level: input.level ? normalizeText(input.level) : undefined,
      schoolLevel: input.schoolLevel ? normalizeText(input.schoolLevel) : undefined,
      targetStage: input.targetStage,
      publisher: input.publisher ? normalizeText(input.publisher) : undefined,
      edition: input.edition ? normalizeText(input.edition) : undefined,
      publicationYear: input.publicationYear,
      authors: normalizeStringArray(input.authors),
      isbn: input.isbn ? normalizeText(input.isbn) : undefined,
      publicSummary: normalizeText(input.publicSummary || fallbackPublicSummary(input)),
      targetAudience: normalizeStringArray(input.targetAudience || ["Language learners"]),
      learningGoals: normalizeStringArray(input.learningGoals),
      topics: normalizeStringArray(input.topics),
      status: input.status || "Uploaded",
      visibility: input.visibility || "private",
      uploadedAt: timestamp,
      uploadedBy: normalizeText(input.uploadedBy || "Founder"),
      updatedAt: timestamp,
      sourceFile: { ...input.sourceFile, fileName: normalizeText(input.sourceFile.fileName), fileType: normalizeText(input.sourceFile.fileType) },
      analysis: input.analysis,
      curriculumTreeId: input.curriculumTreeId,
      levelId: input.levelId,
      units: input.units,
      lessons: input.lessons,
      packageSource: input.packageSource,
      packageVersion: input.packageVersion,
      packageId: input.packageId,
      packageStatus: input.packageStatus,
      teacherPlansReady: input.teacherPlansReady,
      elvyBlueprintsReady: input.elvyBlueprintsReady,
      teachingAssetsReady: input.teachingAssetsReady,
      revision: 1,
    };

    validateResource(resource);
    if (resources.some((item) => item.id === resource.id)) {
      throw new ElvyLibraryError("INVALID_RESOURCE", `A library resource with id "${resource.id}" already exists.`);
    }
    writeAll([...resources, resource]);
    return resource;
  },

  upsertBySyllabusId(syllabusId: string, input: CreateElvyLibraryResourceInput): ElvyLibraryResource {
    const existing = this.findBySyllabusId(syllabusId);
    return existing ? this.update(existing.id, { ...input, syllabusId, sourceFile: input.sourceFile }) : this.create({ ...input, syllabusId });
  },

  update(id: string, updates: UpdateElvyLibraryResourceInput): ElvyLibraryResource {
    const resources = this.loadAll();
    const index = resources.findIndex((resource) => resource.id === id);
    if (index < 0) throw new ElvyLibraryError("NOT_FOUND", `Elvy Library resource "${id}" was not found.`);

    const current = resources[index];
    const title = updates.title !== undefined ? normalizeText(updates.title) : current.title;
    const updated: ElvyLibraryResource = {
      ...current,
      ...updates,
      id: current.id,
      title,
      sortTitle: normalizeSortTitle(title),
      uploadedAt: current.uploadedAt,
      updatedAt: nowIso(),
      revision: current.revision + 1,
      authors: updates.authors !== undefined ? normalizeStringArray(updates.authors) : current.authors,
      targetAudience: updates.targetAudience !== undefined ? normalizeStringArray(updates.targetAudience) : current.targetAudience,
      learningGoals: updates.learningGoals !== undefined ? normalizeStringArray(updates.learningGoals) : current.learningGoals,
      topics: updates.topics !== undefined ? normalizeStringArray(updates.topics) : current.topics,
      publicSummary: updates.publicSummary !== undefined ? normalizeText(updates.publicSummary) : current.publicSummary,
      sourceFile: updates.sourceFile ? { ...current.sourceFile, ...updates.sourceFile } : current.sourceFile,
    };

    validateResource(updated);
    resources[index] = updated;
    writeAll(resources);
    return updated;
  },

  updateForReanalysis(id: string, updates: UpdateElvyLibraryResourceInput = {}): ElvyLibraryResource {
    return this.update(id, {
      ...updates,
      status: "Analyzing",
      visibility: "private",
      analysis: { ...this.getById(id)?.analysis, ...updates.analysis, lastAnalyzedAt: undefined },
    });
  },

  markNeedsReview(id: string, analysis?: ElvyLibraryAnalysisMetadata): ElvyLibraryResource {
    return this.update(id, {
      status: "Approved",
      visibility: "private",
      analysis: { ...this.getById(id)?.analysis, ...analysis, lastAnalyzedAt: analysis?.lastAnalyzedAt || nowIso() },
    });
  },

  approve(id: string): ElvyLibraryResource {
    return this.update(id, { status: "Approved", visibility: "private", suspendedAt: undefined });
  },

  publish(id: string): ElvyLibraryResource {
    return this.update(id, { status: "Published", visibility: "public", publishedAt: nowIso(), suspendedAt: undefined });
  },

  suspend(id: string): ElvyLibraryResource {
    return this.update(id, { status: "Suspended", visibility: "private", suspendedAt: nowIso() });
  },

  reactivate(id: string): ElvyLibraryResource {
    const resource = this.getById(id);
    if (!resource) throw new ElvyLibraryError("NOT_FOUND", `Elvy Library resource "${id}" was not found.`);
    const nextStatus: ElvyLibraryStatus = resource.publishedAt ? "Published" : "Approved";
    return this.update(id, { status: nextStatus, visibility: nextStatus === "Published" ? "public" : "private", suspendedAt: undefined });
  },

  archive(id: string): ElvyLibraryResource {
    return this.update(id, { status: "Archived", visibility: "private", archivedAt: nowIso() });
  },

  delete(id: string): boolean {
    const resources = this.loadAll();
    const next = resources.filter((resource) => resource.id !== id);
    if (next.length === resources.length) return false;
    writeAll(next);
    return true;
  },

  clearAll(): void {
    ensureBrowserStorage().removeItem(ELVY_LIBRARY_STORAGE_KEY);
  },

  exportJson(): string {
    return JSON.stringify(this.loadAll(), null, 2);
  },

  importJson(json: string, options: { replace?: boolean } = {}): ElvyLibraryResource[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      throw new ElvyLibraryError("INVALID_RESOURCE", "The imported Elvy Library JSON is invalid.", error);
    }
    if (!Array.isArray(parsed)) throw new ElvyLibraryError("INVALID_RESOURCE", "The imported Elvy Library data must be an array.");
    const imported = parseStoredResources(JSON.stringify(parsed));
    imported.forEach(validateResource);
    const result = options.replace ? imported : mergeResources(this.loadAll(), imported);
    writeAll(result);
    return sortAlphabetically(result);
  },
};

function mergeResources(existing: ElvyLibraryResource[], incoming: ElvyLibraryResource[]): ElvyLibraryResource[] {
  const merged = new Map(existing.map((resource) => [resource.id, resource]));
  incoming.forEach((resource) => {
    const current = merged.get(resource.id);
    if (!current || resource.revision >= current.revision) merged.set(resource.id, resource);
  });
  return Array.from(merged.values());
}
