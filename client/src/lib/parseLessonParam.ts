/**
 * Parses the `?lesson=` query-string parameter into a 1-based lesson index.
 *
 * Returns the integer when it is a finite number ≥ 1 and (if `totalLessons` is
 * provided) does not exceed the total.  Every other input — missing param,
 * non-numeric strings, negatives, zero, and out-of-range values — returns null
 * so callers never receive a value that could crash an array lookup.
 *
 * @param search         - The raw query string (e.g. window.location.search).
 * @param totalLessons   - Optional upper bound (inclusive).  When omitted the
 *                         upper bound is not enforced here; callers are expected
 *                         to guard their own array access.
 */
export function parseLessonParam(
  search: string,
  totalLessons?: number,
): number | null {
  try {
    const raw = new URLSearchParams(search).get("lesson") ?? "";
    if (!/^\d+$/.test(raw)) return null;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return null;
    if (totalLessons !== undefined && n > totalLessons) return null;
    return n;
  } catch {
    return null;
  }
}
