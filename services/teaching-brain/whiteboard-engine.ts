/**
 * Elvy Teaching Engine
 * Sprint 3 — Whiteboard Engine
 *
 * The Whiteboard Engine converts a scene whiteboard cue plus resolved lesson
 * content into a deterministic, renderer-independent whiteboard presentation.
 *
 * It does not render React, read a database, call an AI model, synthesize
 * speech, mutate lesson content, or decide pedagogical progression.
 */

import type {
  WhiteboardInstruction,
  WhiteboardMode,
} from "./lesson-director-types";
import type {
  SceneContentKind,
  SceneContentReference,
  SceneStepDefinition,
  SceneWhiteboardCue,
} from "./scene-definition";

export type WhiteboardBlockKind =
  | "heading"
  | "paragraph"
  | "list"
  | "vocabulary"
  | "dialogue"
  | "grammar-rule"
  | "example"
  | "question"
  | "exercise"
  | "feedback"
  | "image"
  | "divider"
  | "spacer"
  | "custom";

export type WhiteboardTextSize = "xs" | "sm" | "md" | "lg" | "xl";
export type WhiteboardDensity = "comfortable" | "compact" | "dense";
export type WhiteboardAlignment = "left" | "center" | "right";
export type WhiteboardEmphasis = "normal" | "strong" | "muted" | "success" | "attention";

export interface WhiteboardTextSegment {
  id: string;
  text: string;
  emphasis?: WhiteboardEmphasis;
  speakable?: boolean;
}

export interface WhiteboardListItem {
  id: string;
  text: string;
  secondaryText?: string;
  pronunciation?: string;
  translation?: string;
  example?: string;
  correct?: boolean;
}

export interface WhiteboardDialogueLine {
  id: string;
  speaker: string;
  text: string;
  translation?: string;
}

export interface WhiteboardImageContent {
  source: string;
  alt: string;
  caption?: string;
  objectFit?: "contain" | "cover";
}

export interface WhiteboardBlock {
  id: string;
  kind: WhiteboardBlockKind;
  title?: string;
  text?: string;
  segments?: WhiteboardTextSegment[];
  items?: WhiteboardListItem[];
  dialogue?: WhiteboardDialogueLine[];
  image?: WhiteboardImageContent;
  alignment?: WhiteboardAlignment;
  emphasis?: WhiteboardEmphasis;
  visible?: boolean;
  metadata?: Record<string, string | number | boolean>;
}

export interface ResolvedWhiteboardContent {
  referenceId: string;
  kind: SceneContentKind;
  title?: string;
  blocks: WhiteboardBlock[];
  metadata?: Record<string, string | number | boolean>;
}

export interface WhiteboardHighlight {
  id: string;
  targetType: "block" | "item" | "segment" | "dialogue-line" | "text";
  targetId?: string;
  text?: string;
  occurrence?: number;
  active: boolean;
  source: "scene" | "speech" | "evaluation" | "manual";
}

export interface WhiteboardViewport {
  width: number;
  height: number;
}

export interface WhiteboardPresentationHints {
  textSize: WhiteboardTextSize;
  density: WhiteboardDensity;
  columns: 1 | 2;
  allowScroll: boolean;
  paginate: boolean;
  maxVisibleBlocks?: number;
  preferredLineLength?: number;
}

export interface WhiteboardPage {
  id: string;
  index: number;
  blockIds: string[];
}

export interface WhiteboardPresentation {
  presentationId: string;
  mode: WhiteboardMode;
  title?: string;
  blocks: WhiteboardBlock[];
  highlights: WhiteboardHighlight[];
  clearBeforeDisplay: boolean;
  hints: WhiteboardPresentationHints;
  pages: WhiteboardPage[];
  activePageIndex: number;
  contentReferenceId?: string;
  titleReferenceId?: string;
  generatedAt: string;
  diagnostics: {
    warnings: string[];
    notes: string[];
  };
}

export interface WhiteboardContentResolver {
  resolve(
    reference: Readonly<SceneContentReference>,
  ): ResolvedWhiteboardContent | undefined;
}

export interface WhiteboardEngineContext {
  step: Readonly<SceneStepDefinition>;
  cue?: Readonly<SceneWhiteboardCue>;
  contentReferences: readonly SceneContentReference[];
  resolver: WhiteboardContentResolver;
  now: string;
  viewport?: WhiteboardViewport;
  speechHighlight?: {
    text?: string;
    targetId?: string;
    occurrence?: number;
  };
  manualHighlights?: readonly WhiteboardHighlight[];
  activePageIndex?: number;
}

export interface WhiteboardEngineResult {
  presentation: WhiteboardPresentation;
  instruction: WhiteboardInstruction;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function findReference(
  references: readonly SceneContentReference[],
  id: string | undefined,
): SceneContentReference | undefined {
  return id ? references.find((reference) => reference.id === id) : undefined;
}

function resolveWithFallback(
  reference: SceneContentReference | undefined,
  references: readonly SceneContentReference[],
  resolver: WhiteboardContentResolver,
  visited = new Set<string>(),
): ResolvedWhiteboardContent | undefined {
  if (!reference || visited.has(reference.id)) return undefined;

  visited.add(reference.id);
  const resolved = resolver.resolve(reference);
  if (resolved) return resolved;

  return resolveWithFallback(
    findReference(references, reference.fallbackReferenceId),
    references,
    resolver,
    visited,
  );
}

function estimateContentWeight(blocks: readonly WhiteboardBlock[]): number {
  return blocks.reduce((total, block) => {
    const textWeight = (block.text?.length ?? 0) / 55;
    const segmentWeight =
      (block.segments ?? []).reduce((sum, item) => sum + item.text.length, 0) /
      55;
    const itemWeight =
      (block.items ?? []).reduce(
        (sum, item) =>
          sum +
          item.text.length +
          (item.secondaryText?.length ?? 0) +
          (item.example?.length ?? 0),
        0,
      ) / 45;
    const dialogueWeight =
      (block.dialogue ?? []).reduce(
        (sum, line) => sum + line.speaker.length + line.text.length,
        0,
      ) / 45;
    const imageWeight = block.image ? 4 : 0;

    return total + 1 + textWeight + segmentWeight + itemWeight + dialogueWeight + imageWeight;
  }, 0);
}

function buildPresentationHints(
  mode: WhiteboardMode,
  blocks: readonly WhiteboardBlock[],
  allowScroll: boolean | undefined,
  viewport: WhiteboardViewport | undefined,
): WhiteboardPresentationHints {
  const weight = estimateContentWeight(blocks);
  const viewportFactor = viewport
    ? Math.max(0.65, Math.min(1.4, (viewport.width * viewport.height) / 180_000))
    : 1;
  const adjustedWeight = weight / viewportFactor;

  let textSize: WhiteboardTextSize = "lg";
  let density: WhiteboardDensity = "comfortable";

  if (adjustedWeight > 24) {
    textSize = "xs";
    density = "dense";
  } else if (adjustedWeight > 16) {
    textSize = "sm";
    density = "dense";
  } else if (adjustedWeight > 10) {
    textSize = "md";
    density = "compact";
  } else if (adjustedWeight <= 4) {
    textSize = "xl";
  }

  const columns: 1 | 2 =
    mode === "vocabulary" && blocks.some((block) => (block.items?.length ?? 0) >= 8)
      ? 2
      : 1;

  const shouldScroll = allowScroll ?? adjustedWeight > 14;
  const paginate = !shouldScroll && adjustedWeight > 18;

  return {
    textSize,
    density,
    columns,
    allowScroll: shouldScroll,
    paginate,
    maxVisibleBlocks: paginate ? 5 : undefined,
    preferredLineLength: mode === "reading" ? 72 : 54,
  };
}

function buildPages(
  blocks: readonly WhiteboardBlock[],
  hints: WhiteboardPresentationHints,
): WhiteboardPage[] {
  if (!hints.paginate || blocks.length === 0) {
    return [{ id: "page-1", index: 0, blockIds: blocks.map((block) => block.id) }];
  }

  const maxBlocks = hints.maxVisibleBlocks ?? 5;
  const pages: WhiteboardPage[] = [];

  for (let index = 0; index < blocks.length; index += maxBlocks) {
    pages.push({
      id: `page-${pages.length + 1}`,
      index: pages.length,
      blockIds: blocks.slice(index, index + maxBlocks).map((block) => block.id),
    });
  }

  return pages;
}

function normalizeHighlights(
  cue: Readonly<SceneWhiteboardCue> | undefined,
  speechHighlight: WhiteboardEngineContext["speechHighlight"],
  manualHighlights: readonly WhiteboardHighlight[] | undefined,
): WhiteboardHighlight[] {
  const highlights: WhiteboardHighlight[] = [];

  for (const targetId of cue?.highlightedItemIds ?? []) {
    highlights.push({
      id: `scene:${targetId}`,
      targetType: "item",
      targetId,
      active: true,
      source: "scene",
    });
  }

  if (speechHighlight?.targetId || speechHighlight?.text) {
    highlights.push({
      id: `speech:${speechHighlight.targetId ?? speechHighlight.text ?? "active"}`,
      targetType: speechHighlight.targetId ? "segment" : "text",
      targetId: speechHighlight.targetId,
      text: speechHighlight.text,
      occurrence: speechHighlight.occurrence,
      active: true,
      source: "speech",
    });
  }

  highlights.push(...(manualHighlights ?? []).map((highlight) => ({ ...highlight })));

  const seen = new Set<string>();
  return highlights.filter((highlight) => {
    const key = `${highlight.source}:${highlight.targetType}:${highlight.targetId ?? ""}:${highlight.text ?? ""}:${highlight.occurrence ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildEmptyBlocks(
  mode: WhiteboardMode,
  step: Readonly<SceneStepDefinition>,
): WhiteboardBlock[] {
  if (mode === "clear") return [];

  const placeholder: WhiteboardBlock = {
    id: `placeholder:${step.id}`,
    kind: mode === "question" ? "question" : "heading",
    title: step.title,
    text: step.description,
    alignment: mode === "title" ? "center" : "left",
    emphasis: "normal",
  };

  return placeholder.title || placeholder.text ? [placeholder] : [];
}

function toInstruction(
  presentation: Readonly<WhiteboardPresentation>,
): WhiteboardInstruction {
  return {
    mode: presentation.mode,
    title: presentation.title,
    content: {
      presentationId: presentation.presentationId,
      blocks: presentation.blocks,
      pages: presentation.pages,
      activePageIndex: presentation.activePageIndex,
      hints: presentation.hints,
      highlights: presentation.highlights,
    },
    contentReference: presentation.contentReferenceId,
    clearBeforeDisplay: presentation.clearBeforeDisplay,
    highlightedItemIds: presentation.highlights
      .map((highlight) => highlight.targetId)
      .filter((value): value is string => Boolean(value)),
    highlightedText: presentation.highlights
      .map((highlight) => highlight.text)
      .filter((value): value is string => Boolean(value)),
    allowScroll: presentation.hints.allowScroll,
  };
}

/**
 * Creates one deterministic whiteboard presentation for the active scene step.
 */
export function buildWhiteboardPresentation(
  context: Readonly<WhiteboardEngineContext>,
): WhiteboardEngineResult {
  const cue = context.cue ?? context.step.whiteboard;
  const mode = cue?.mode ?? "clear";
  const warnings: string[] = [];
  const notes: string[] = [];

  const contentReference = findReference(
    context.contentReferences,
    cue?.contentReferenceId,
  );
  const titleReference = findReference(
    context.contentReferences,
    cue?.titleReferenceId,
  );

  if (cue?.contentReferenceId && !contentReference) {
    warnings.push(
      `Whiteboard content reference ${cue.contentReferenceId} was not declared by the scene.`,
    );
  }

  if (cue?.titleReferenceId && !titleReference) {
    warnings.push(
      `Whiteboard title reference ${cue.titleReferenceId} was not declared by the scene.`,
    );
  }

  const resolvedContent = resolveWithFallback(
    contentReference,
    context.contentReferences,
    context.resolver,
  );
  const resolvedTitle = resolveWithFallback(
    titleReference,
    context.contentReferences,
    context.resolver,
  );

  if (contentReference && !resolvedContent) {
    const severity = contentReference.required ? "Required" : "Optional";
    warnings.push(
      `${severity} whiteboard content ${contentReference.id} could not be resolved.`,
    );
  }

  const title =
    resolvedTitle?.title ??
    resolvedTitle?.blocks.find((block) => block.title || block.text)?.title ??
    resolvedTitle?.blocks.find((block) => block.title || block.text)?.text ??
    resolvedContent?.title ??
    context.step.title;

  const blocks = (resolvedContent?.blocks ?? buildEmptyBlocks(mode, context.step))
    .filter((block) => block.visible !== false)
    .map((block) => ({ ...block }));

  const hints = buildPresentationHints(
    mode,
    blocks,
    cue?.allowScroll,
    context.viewport,
  );
  const pages = buildPages(blocks, hints);
  const requestedPage = context.activePageIndex ?? 0;
  const activePageIndex = Math.max(0, Math.min(requestedPage, pages.length - 1));

  if (requestedPage !== activePageIndex) {
    notes.push(`Active page was clamped from ${requestedPage} to ${activePageIndex}.`);
  }

  if (!cue && context.step.whiteboard === undefined) {
    notes.push("The active step has no whiteboard cue; a clear instruction was produced.");
  }

  const presentation: WhiteboardPresentation = {
    presentationId: `whiteboard:${context.step.id}:${context.now}`,
    mode,
    title,
    blocks,
    highlights: normalizeHighlights(
      cue,
      context.speechHighlight,
      context.manualHighlights,
    ),
    clearBeforeDisplay: cue?.clearBeforeDisplay ?? mode === "clear",
    hints,
    pages,
    activePageIndex,
    contentReferenceId: contentReference?.id,
    titleReferenceId: titleReference?.id,
    generatedAt: context.now,
    diagnostics: {
      warnings: unique(warnings),
      notes: unique(notes),
    },
  };

  return {
    presentation,
    instruction: toInstruction(presentation),
  };
}

/** Returns only the blocks visible on the active whiteboard page. */
export function getActiveWhiteboardBlocks(
  presentation: Readonly<WhiteboardPresentation>,
): WhiteboardBlock[] {
  const page = presentation.pages[presentation.activePageIndex];
  if (!page) return [];
  const ids = new Set(page.blockIds);
  return presentation.blocks.filter((block) => ids.has(block.id));
}

/** Creates a new presentation with a safely selected page. */
export function setWhiteboardPage(
  presentation: Readonly<WhiteboardPresentation>,
  pageIndex: number,
): WhiteboardPresentation {
  const activePageIndex = Math.max(
    0,
    Math.min(pageIndex, presentation.pages.length - 1),
  );

  return {
    ...presentation,
    activePageIndex,
    blocks: presentation.blocks.map((block) => ({ ...block })),
    highlights: presentation.highlights.map((highlight) => ({ ...highlight })),
    hints: { ...presentation.hints },
    pages: presentation.pages.map((page) => ({
      ...page,
      blockIds: [...page.blockIds],
    })),
    diagnostics: {
      warnings: [...presentation.diagnostics.warnings],
      notes: [...presentation.diagnostics.notes],
    },
  };
}

/** Adds or replaces speech highlighting without rebuilding lesson content. */
export function updateWhiteboardSpeechHighlight(
  presentation: Readonly<WhiteboardPresentation>,
  highlight?: { text?: string; targetId?: string; occurrence?: number },
): WhiteboardPresentation {
  const retained = presentation.highlights.filter(
    (item) => item.source !== "speech",
  );

  const speech: WhiteboardHighlight[] =
    highlight?.text || highlight?.targetId
      ? [
          {
            id: `speech:${highlight.targetId ?? highlight.text ?? "active"}`,
            targetType: highlight.targetId ? "segment" : "text",
            targetId: highlight.targetId,
            text: highlight.text,
            occurrence: highlight.occurrence,
            active: true,
            source: "speech",
          },
        ]
      : [];

  return {
    ...presentation,
    highlights: [...retained, ...speech],
    blocks: presentation.blocks.map((block) => ({ ...block })),
    hints: { ...presentation.hints },
    pages: presentation.pages.map((page) => ({
      ...page,
      blockIds: [...page.blockIds],
    })),
    diagnostics: {
      warnings: [...presentation.diagnostics.warnings],
      notes: [...presentation.diagnostics.notes],
    },
  };
}
