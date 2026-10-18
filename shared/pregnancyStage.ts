/**
 * Stage/date interpretation only. This does not calculate nutrition targets.
 * Explicit non-pregnant stages must never be converted by an old due date.
 */
export function derivePregnancyStage(
  savedStage: string,
  dueDate: string | null,
  trackingMode: string = "manual",
  now: Date = new Date(),
): { resolvedStage: string; weekOfPregnancy: number | null } {
  const unchanged = { resolvedStage: savedStage, weekOfPregnancy: null };
  if (!savedStage.startsWith("trimester-") || trackingMode !== "due-date" || !dueDate) {
    return unchanged;
  }
  // Date inputs are calendar dates. Use the same UTC noon in the browser and
  // server, and reject impossible dates instead of turning NaN into trimester 3.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return unchanged;
  const due = new Date(`${dueDate}T12:00:00Z`);
  if (!Number.isFinite(due.getTime()) || due.toISOString().slice(0, 10) !== dueDate ||
      !Number.isFinite(now.getTime())) {
    return unchanged;
  }
  const weeksUntilDue = (due.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000);
  const week = Math.max(1, Math.min(42, Math.round(40 - weeksUntilDue)));
  return {
    resolvedStage: week <= 13 ? "trimester-1" : week <= 27 ? "trimester-2" : "trimester-3",
    weekOfPregnancy: week,
  };
}
