/** Shared placeholder-aware completion logic for Lesson Plan Studio. */
const PLACEHOLDER_PATTERNS = [
  /^needs vision reader$/i,
  /^to be detected$/i,
  /^page analysis required$/i,
  /^not analyzed$/i,
  /^not analysed$/i,
  /^to be confirmed$/i,
];

export function isMeaningfulLessonValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(isMeaningfulLessonValue);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some(isMeaningfulLessonValue);
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function calculateLessonCompletion(sections: Record<string, unknown>, requiredSectionKeys: string[]): number {
  if (!requiredSectionKeys.length) return 0;
  const completed = requiredSectionKeys.filter((key) => isMeaningfulLessonValue(sections[key])).length;
  return Math.round((completed / requiredSectionKeys.length) * 100);
}

export const LessonCompletion = { isMeaningfulValue: isMeaningfulLessonValue, calculate: calculateLessonCompletion };
