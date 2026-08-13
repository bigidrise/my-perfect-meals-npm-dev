/**
 * localDayUTCBounds — timezone-correct day boundary computation
 *
 * Exported as a standalone utility so it can be unit-tested independently
 * of the route that uses it.
 *
 * Correct for all practical UTC offsets (−12 to +14) and DST transitions.
 *
 * Strategy:
 *   1. Sample UTC noon of the requested local date (adjusted ±1 day for extreme
 *      positive offsets where noon UTC lands on the wrong local date).
 *   2. Derive a rough UTC offset via `formatToParts` with hourCycle "h23" so
 *      midnight is always rendered as 00, never as 24.
 *   3. Compute rough local midnight = UTC midnight of local date − rough offset.
 *   4. **Bootstrapping step**: re-derive the offset at rough midnight + 1 s
 *      (the +1 s avoids `hour: 24` that some ICU builds emit exactly at midnight).
 *      This fixes DST transition days where midnight and noon are in different
 *      DST phases (spring-forward: midnight is EST, noon is EDT).
 *   5. Compute true local midnight = UTC midnight − bootstrapped offset.
 *   6. Compute end = next local midnight − 1 ms (same algorithm, independent, so
 *      25-hour fall-back and 23-hour spring-forward days are handled correctly).
 *
 * Why one bootstrapping step is enough:
 *   DST changes are at most ±1 hour and always happen well after midnight
 *   (typically at 2 AM). The rough midnight is at most 1 h from true midnight,
 *   keeping it before the DST transition. So the offset at rough midnight
 *   equals the offset at true midnight — one iteration is always sufficient.
 */
export function localDayUTCBounds(
  dateISO: string,
  timezone: string,
): { start: Date; end: Date } {
  const [y, m, d] = dateISO.split("-").map(Number);

  /**
   * Return the UTC offset in minutes for the given UTC millisecond instant
   * in the target timezone.
   *
   * Uses `formatToParts` with `hourCycle: "h23"` so midnight is always
   * rendered as hour "00" rather than "24" (some ICU builds emit "24").
   * The offset is: (local date-time treated as UTC) − actual UTC instant.
   */
  function utcOffsetAt(utcMs: number): number {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hourCycle: "h23",        // force 0-23; midnight = 0, never 24
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(utcMs));

    const get = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

    const localAsUtcMs = Date.UTC(
      get("year"), get("month") - 1, get("day"),
      get("hour"), get("minute"), 0,
    );
    return Math.round((localAsUtcMs - utcMs) / 60_000);
  }

  /** Local midnight in UTC for a given local date (ly, lm, ld). */
  function localMidnightUTC(ly: number, lm: number, ld: number): number {
    // ── Step 1: Sample at noon UTC of the target local date ──────────────────
    // For most offsets, noon UTC falls within the target local date.
    // For large positive offsets (e.g. UTC+14), noon UTC Aug 12 = Aug 13 02:00
    // local — one day ahead — so shift the sample back one UTC day.
    let sampleUtcMs = Date.UTC(ly, lm - 1, ld, 12, 0, 0);

    const sampleParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(sampleUtcMs));

    const pad = (n: number) => String(n).padStart(2, "0");
    const targetDate  = `${String(ly).padStart(4, "0")}-${pad(lm)}-${pad(ld)}`;
    const sampleLocal =
      `${sampleParts.find((p) => p.type === "year")!.value}-` +
      `${sampleParts.find((p) => p.type === "month")!.value}-` +
      `${sampleParts.find((p) => p.type === "day")!.value}`;

    if (sampleLocal > targetDate) {
      sampleUtcMs -= 86_400_000; // sample is a day ahead — shift back
    } else if (sampleLocal < targetDate) {
      sampleUtcMs += 86_400_000; // sample is a day behind — shift forward
    }

    // ── Step 2: Rough offset (from corrected noon sample) ────────────────────
    const roughOffsetMin = utcOffsetAt(sampleUtcMs);

    // ── Step 3: Rough local midnight ─────────────────────────────────────────
    const roughMidnightMs = Date.UTC(ly, lm - 1, ld, 0, 0, 0) - roughOffsetMin * 60_000;

    // ── Step 4: Bootstrapped offset at rough midnight + 1 s ──────────────────
    // Sampling at roughMidnightMs + 1000 ms (one second into the local day)
    // avoids the rare ICU edge case where `hour12: false` emits "24" exactly at
    // midnight (which inflates the computed offset by 1440 min).
    //
    // DST transitions always happen at 2 AM or later, so sampling at
    // roughly-midnight + 1 s is guaranteed to be in the pre-DST phase.
    const actualOffsetMin = utcOffsetAt(roughMidnightMs + 1_000);

    // ── Step 5: True local midnight ──────────────────────────────────────────
    return Date.UTC(ly, lm - 1, ld, 0, 0, 0) - actualOffsetMin * 60_000;
  }

  const startMs = localMidnightUTC(y, m, d);

  // End = next local midnight − 1 ms, computed independently so that
  // 23-hour (spring-forward) and 25-hour (fall-back) days are correct.
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1)); // JS handles month/year overflow
  const endMs = localMidnightUTC(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
  ) - 1;

  return { start: new Date(startMs), end: new Date(endMs) };
}
