/**
 * Pure data and helpers for the Platform Mastery lesson sequence.
 * Kept in a separate file so they can be imported by tests without
 * pulling in DB / ORM dependencies.
 */

export const LESSON_IDS = [
  "lesson-01",
  "lesson-02",
  "lesson-03",
  "lesson-04",
  "lesson-05",
  "lesson-06",
  "lesson-07",
  "lesson-08",
  "lesson-09",
];

/**
 * Returns the lesson that must be completed before accessing lessonId in
 * Certification Mode. Returns null for the first lesson (no prerequisite).
 */
export function getPrerequisiteId(lessonId: string): string | null {
  const idx = LESSON_IDS.indexOf(lessonId);
  if (idx <= 0) return null;
  return LESSON_IDS[idx - 1];
}
