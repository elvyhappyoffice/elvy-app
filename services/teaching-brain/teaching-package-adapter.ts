/**
 * Elvy Teaching Engine
 * Teaching Package -> Whiteboard Content adapter
 *
 * Resolves SceneContentReference.packagePath values against an already-loaded
 * teaching package and converts the selected value into the normalized,
 * renderer-independent content contract required by WhiteboardEngine.
 *
 * This adapter does not read a database, call AI, render React, mutate the
 * package, or decide lesson progression.
 */

import type {
  SceneContentKind,
  SceneContentReference,
} from "./scene-definition";

import type {
  ResolvedWhiteboardContent,
  WhiteboardBlock,
  WhiteboardContentResolver,
  WhiteboardDialogueLine,
  WhiteboardImageContent,
  WhiteboardListItem,
} from "./whiteboard-engine";

export type TeachingPackageRoot = Readonly<Record<string, unknown>>;

export type TeachingPackageAdapterOptions = Readonly<{
  /**
   * The already-loaded lesson package. In runtime integration this may be
   * either the editable LessonPlan or the normalized TeachingBrainLesson.
   */
  packageRoot: TeachingPackageRoot;

  /**
   * Optional prefix removed from packagePath before traversal.
   * Example: packagePathPrefix: "lessonPlan"
   */
  packagePathPrefix?: string;

  /**
   * When true, an unresolved required reference throws instead of returning
   * undefined. WhiteboardEngine can otherwise handle the missing reference
   * and add a diagnostic warning.
   */
  strictRequiredReferences?: boolean;
}>;

export type TeachingPackageAdapterErrorCode =
  | "INVALID_PACKAGE"
  | "INVALID_PACKAGE_PATH"
  | "REQUIRED_CONTENT_MISSING"
  | "UNSUPPORTED_CONTENT";

export class TeachingPackageAdapterError extends Error {
  readonly code: TeachingPackageAdapterErrorCode;
  readonly reference?: SceneContentReference;
  readonly details?: Record<string, unknown>;

  constructor(
    code: TeachingPackageAdapterErrorCode,
    message: string,
    options: {
      reference?: SceneContentReference;
      details?: Record<string, unknown>;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "TeachingPackageAdapterError";
    this.code = code;
    this.reference = options.reference;
    this.details = options.details;
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasText(value: unknown): boolean {
  return clean(value).length > 0;
}

function firstText(
  record: UnknownRecord,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (hasText(value)) return clean(value);
  }

  return undefined;
}

function slugify(value: string, fallback: string): string {
  const slug = clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

/**
 * Supports:
 * - dot paths: stages.0.activities
 * - bracket paths: stages[0].activities
 * - quoted brackets: sections["languageContent"]
 * - JSON Pointer: /stages/0/activities
 */
function tokenizePackagePath(path: string): string[] {
  const value = clean(path);
  if (!value) return [];

  if (value.startsWith("/")) {
    return value
      .split("/")
      .slice(1)
      .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
      .filter(Boolean);
  }

  const tokens: string[] = [];
  const pattern =
    /(?:^|\.)([^.[\]]+)|\[(?:"([^"]+)"|'([^']+)'|(\d+)|([^[\]]+))\]/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    const token = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5];
    if (token !== undefined && clean(token)) {
      tokens.push(clean(token));
    }
  }

  return tokens;
}

function stripPrefix(
  tokens: readonly string[],
  prefix?: string,
): string[] {
  const prefixTokens = tokenizePackagePath(prefix ?? "");
  if (prefixTokens.length === 0) return [...tokens];

  const matches = prefixTokens.every(
    (token, index) => tokens[index] === token,
  );

  return matches ? tokens.slice(prefixTokens.length) : [...tokens];
}

function resolvePackagePath(
  root: TeachingPackageRoot,
  path: string,
  prefix?: string,
): unknown {
  const tokens = stripPrefix(tokenizePackagePath(path), prefix);

  if (tokens.length === 0) {
    return root;
  }

  let current: unknown = root;

  for (const token of tokens) {
    if (Array.isArray(current)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    if (!isRecord(current) || !(token in current)) {
      return undefined;
    }

    current = current[token];
  }

  return current;
}

function splitTextList(value: string): string[] {
  return value
    .split(/\r?\n|[;•]+/)
    .map(clean)
    .filter(Boolean);
}

function metadataFromReference(
  reference: Readonly<SceneContentReference>,
): Record<string, string | number | boolean> {
  return {
    packagePath: reference.packagePath,
    required: reference.required,
    ...(reference.metadata ?? {}),
  };
}

function makeListItems(
  values: readonly unknown[],
  referenceId: string,
): WhiteboardListItem[] {
  return values
    .map((value, index): WhiteboardListItem | undefined => {
      if (isRecord(value)) {
        const text = firstText(value, [
          "word",
          "term",
          "text",
          "title",
          "label",
          "question",
          "prompt",
          "instruction",
          "answer",
          "name",
        ]);

        if (!text) return undefined;

        return {
          id: clean(value.id) || `${referenceId}:item:${index + 1}`,
          text,
          secondaryText: firstText(value, [
            "meaning",
            "definition",
            "secondaryText",
            "description",
          ]),
          pronunciation: firstText(value, [
            "pronunciation",
            "phonetic",
            "phonetics",
          ]),
          translation: firstText(value, [
            "translation",
            "l1",
            "translatedText",
          ]),
          example: firstText(value, [
            "example",
            "exampleSentence",
            "sentence",
          ]),
          correct:
            typeof value.correct === "boolean" ? value.correct : undefined,
        };
      }

      const text = clean(value);
      if (!text) return undefined;

      return {
        id: `${referenceId}:item:${index + 1}`,
        text,
      };
    })
    .filter((item): item is WhiteboardListItem => Boolean(item));
}

function makeDialogueLines(
  values: readonly unknown[],
  referenceId: string,
): WhiteboardDialogueLine[] {
  return values
    .map((value, index): WhiteboardDialogueLine | undefined => {
      if (isRecord(value)) {
        const text = firstText(value, [
          "text",
          "line",
          "utterance",
          "content",
        ]);

        if (!text) return undefined;

        return {
          id: clean(value.id) || `${referenceId}:line:${index + 1}`,
          speaker:
            firstText(value, ["speaker", "character", "role", "name"]) ??
            "Speaker",
          text,
          translation: firstText(value, [
            "translation",
            "l1",
            "translatedText",
          ]),
        };
      }

      const text = clean(value);
      if (!text) return undefined;

      const separator = text.indexOf(":");
      return {
        id: `${referenceId}:line:${index + 1}`,
        speaker:
          separator > 0 ? clean(text.slice(0, separator)) : "Speaker",
        text: separator > 0 ? clean(text.slice(separator + 1)) : text,
      };
    })
    .filter((line): line is WhiteboardDialogueLine => Boolean(line));
}

function makeImage(value: unknown): WhiteboardImageContent | undefined {
  if (typeof value === "string" && hasText(value)) {
    return {
      source: clean(value),
      alt: "Lesson image",
      objectFit: "contain",
    };
  }

  if (!isRecord(value)) return undefined;

  const source = firstText(value, [
    "source",
    "src",
    "url",
    "imageUrl",
    "asset",
    "path",
  ]);

  if (!source) return undefined;

  return {
    source,
    alt:
      firstText(value, ["alt", "altText", "title", "description"]) ??
      "Lesson image",
    caption: firstText(value, ["caption", "description"]),
    objectFit:
      value.objectFit === "cover" || value.objectFit === "contain"
        ? value.objectFit
        : "contain",
  };
}

function extractArray(record: UnknownRecord): readonly unknown[] | undefined {
  const keys = [
    "items",
    "values",
    "entries",
    "words",
    "vocabulary",
    "questions",
    "exercises",
    "examples",
    "lines",
    "dialogue",
    "content",
  ] as const;

  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key];
  }

  return undefined;
}

function blockForText(
  reference: Readonly<SceneContentReference>,
  text: string,
  title?: string,
): WhiteboardBlock {
  const kindMap: Partial<Record<SceneContentKind, WhiteboardBlock["kind"]>> = {
    "lesson-title": "heading",
    "lesson-objectives": "list",
    instructions: "paragraph",
    "warm-up-prompt": "question",
    "grammar-point": "grammar-rule",
    "reading-text": "paragraph",
    "listening-script": "paragraph",
    "worked-example": "example",
    exercise: "exercise",
    "question-set": "question",
    "speaking-prompt": "question",
    "writing-prompt": "question",
    "assessment-item": "question",
    "review-summary": "paragraph",
    homework: "exercise",
    custom: "custom",
  };

  return {
    id: `${reference.id}:block:1`,
    kind: kindMap[reference.kind] ?? "paragraph",
    title,
    text,
    alignment: reference.kind === "lesson-title" ? "center" : "left",
    emphasis:
      reference.kind === "lesson-title" ? "strong" : "normal",
  };
}

function convertValueToBlocks(
  reference: Readonly<SceneContentReference>,
  value: unknown,
): WhiteboardBlock[] {
  if (reference.kind === "image") {
    const image = makeImage(value);
    return image
      ? [
          {
            id: `${reference.id}:image:1`,
            kind: "image",
            image,
            alignment: "center",
          },
        ]
      : [];
  }

  if (reference.kind === "dialogue") {
    const source = Array.isArray(value)
      ? value
      : isRecord(value)
        ? extractArray(value) ?? []
        : splitTextList(clean(value));

    const dialogue = makeDialogueLines(source, reference.id);
    return dialogue.length > 0
      ? [
          {
            id: `${reference.id}:dialogue:1`,
            kind: "dialogue",
            title: isRecord(value)
              ? firstText(value, ["title", "heading", "name"])
              : undefined,
            dialogue,
          },
        ]
      : [];
  }

  if (
    reference.kind === "vocabulary-set" ||
    reference.kind === "lesson-objectives" ||
    reference.kind === "question-set" ||
    reference.kind === "exercise" ||
    reference.kind === "assessment-item"
  ) {
    const title = isRecord(value)
      ? firstText(value, ["title", "heading", "name"])
      : undefined;

    const source = Array.isArray(value)
      ? value
      : isRecord(value)
        ? extractArray(value) ??
          (hasText(value.text) ? splitTextList(clean(value.text)) : [])
        : splitTextList(clean(value));

    const items = makeListItems(source, reference.id);

    if (items.length > 0) {
      const kind: WhiteboardBlock["kind"] =
        reference.kind === "vocabulary-set"
          ? "vocabulary"
          : reference.kind === "exercise"
            ? "exercise"
            : reference.kind === "question-set" ||
                reference.kind === "assessment-item"
              ? "question"
              : "list";

      return [
        {
          id: `${reference.id}:list:1`,
          kind,
          title,
          items,
        },
      ];
    }
  }

  if (Array.isArray(value)) {
    const items = makeListItems(value, reference.id);
    return items.length > 0
      ? [
          {
            id: `${reference.id}:list:1`,
            kind: "list",
            items,
          },
        ]
      : [];
  }

  if (isRecord(value)) {
    const title = firstText(value, ["title", "heading", "name", "label"]);
    const text = firstText(value, [
      "text",
      "content",
      "description",
      "instruction",
      "prompt",
      "summary",
      "rule",
      "script",
      "body",
    ]);

    if (text) {
      return [blockForText(reference, text, title)];
    }

    const values = Object.entries(value)
      .filter(([, item]) => hasText(item))
      .map(([key, item]) => ({
        id: `${reference.id}:${slugify(key, "field")}`,
        text: clean(item),
        secondaryText: key,
      }));

    if (values.length > 0) {
      return [
        {
          id: `${reference.id}:fields:1`,
          kind: "list",
          title,
          items: values,
        },
      ];
    }

    return [];
  }

  const text = clean(value);
  return text ? [blockForText(reference, text)] : [];
}

function inferTitle(
  reference: Readonly<SceneContentReference>,
  value: unknown,
  blocks: readonly WhiteboardBlock[],
): string | undefined {
  if (isRecord(value)) {
    const explicit = firstText(value, ["title", "heading", "name", "label"]);
    if (explicit) return explicit;
  }

  const blockTitle = blocks.find((block) => hasText(block.title))?.title;
  if (blockTitle) return blockTitle;

  if (reference.kind === "lesson-title") {
    return blocks.find((block) => hasText(block.text))?.text;
  }

  return undefined;
}

export class TeachingPackageAdapter implements WhiteboardContentResolver {
  private readonly packageRoot: TeachingPackageRoot;
  private readonly packagePathPrefix?: string;
  private readonly strictRequiredReferences: boolean;

  constructor(options: TeachingPackageAdapterOptions) {
    if (!isRecord(options?.packageRoot)) {
      throw new TeachingPackageAdapterError(
        "INVALID_PACKAGE",
        "TeachingPackageAdapter requires an object packageRoot.",
      );
    }

    this.packageRoot = options.packageRoot;
    this.packagePathPrefix = clean(options.packagePathPrefix) || undefined;
    this.strictRequiredReferences =
      options.strictRequiredReferences ?? false;
  }

  resolve(
    reference: Readonly<SceneContentReference>,
  ): ResolvedWhiteboardContent | undefined {
    const packagePath = clean(reference.packagePath);

    if (!packagePath) {
      return this.handleMissing(
        reference,
        "The scene content reference has an empty packagePath.",
        "INVALID_PACKAGE_PATH",
      );
    }

    const value = resolvePackagePath(
      this.packageRoot,
      packagePath,
      this.packagePathPrefix,
    );

    if (value === undefined || value === null) {
      return this.handleMissing(
        reference,
        `Teaching package content was not found at "${packagePath}".`,
        "REQUIRED_CONTENT_MISSING",
      );
    }

    const blocks = convertValueToBlocks(reference, value);

    if (blocks.length === 0) {
      return this.handleMissing(
        reference,
        `Teaching package content at "${packagePath}" could not be converted into whiteboard blocks.`,
        "UNSUPPORTED_CONTENT",
      );
    }

    return {
      referenceId: reference.id,
      kind: reference.kind,
      title: inferTitle(reference, value, blocks),
      blocks,
      metadata: metadataFromReference(reference),
    };
  }

  private handleMissing(
    reference: Readonly<SceneContentReference>,
    message: string,
    code: TeachingPackageAdapterErrorCode,
  ): undefined {
    if (reference.required && this.strictRequiredReferences) {
      throw new TeachingPackageAdapterError(code, message, {
        reference: { ...reference },
        details: {
          packagePath: reference.packagePath,
          contentKind: reference.kind,
        },
      });
    }

    return undefined;
  }
}

export function createTeachingPackageAdapter(
  options: TeachingPackageAdapterOptions,
): TeachingPackageAdapter {
  return new TeachingPackageAdapter(options);
}

export function resolveTeachingPackageContent(
  packageRoot: TeachingPackageRoot,
  reference: Readonly<SceneContentReference>,
  options: Omit<TeachingPackageAdapterOptions, "packageRoot"> = {},
): ResolvedWhiteboardContent | undefined {
  return createTeachingPackageAdapter({
    packageRoot,
    ...options,
  }).resolve(reference);
}

export const TeachingPackageContentAdapter = Object.freeze({
  create: createTeachingPackageAdapter,
  resolve: resolveTeachingPackageContent,
});
