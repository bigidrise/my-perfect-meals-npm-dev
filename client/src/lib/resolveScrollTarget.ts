/**
 * Module types that count as numbered "lessons" for deep-link (?lesson=N) indexing.
 *
 * Only types listed here are included when building the 1-based lesson index.
 * If a new type should be scroll-addressable, add it here — the filter in
 * resolveScrollTarget and the useMemo in PlatformCertDashboard both read from
 * this constant, so adding a type in one place is sufficient.
 *
 * Intentionally NOT included (not numbered lessons):
 *   - "quiz"          — graded assessments, not lessons
 *   - "text"          — reading blurbs, not numbered in UX
 */
export const LESSON_MODULE_TYPES = ["video"] as const;

export type LessonModuleType = (typeof LESSON_MODULE_TYPES)[number];

/**
 * Pure helper that determines which element the cert dashboard should scroll
 * to when a `?lesson=N` deep-link param is present.
 *
 * Extracted from the PlatformCertDashboard scroll effect so the selection
 * logic can be unit-tested without a DOM or React environment.
 *
 * @param modules        - Full ordered module list from the API.
 * @param targetLessonNum - 1-based lesson index (from parseLessonParam).
 *                          Pass null to indicate no target (no-op).
 * @param elementMap     - A Map of module slug → DOM element (or any T).
 * @returns The element that should receive scrollIntoView, or null when the
 *          params are missing / out of range / the element isn't mounted yet.
 */
export function resolveScrollTarget<T>(
  modules: Array<{ slug: string; moduleType: string }>,
  targetLessonNum: number | null,
  elementMap: Map<string, T>,
): T | null {
  if (targetLessonNum == null || modules.length === 0) return null;
  const lessonModules = modules.filter((m) =>
    (LESSON_MODULE_TYPES as readonly string[]).includes(m.moduleType),
  );
  const target = lessonModules[targetLessonNum - 1];
  if (!target) return null;
  return elementMap.get(target.slug) ?? null;
}
