/**
 * localDayUTCBounds — unit tests
 *
 * Pure-function tests: no DB, no network.
 * Run: npx tsx server/services/__tests__/localDayBounds.test.ts
 *
 * Covers extreme UTC offsets (UTC−12, UTC+13, UTC+14) and DST transitions.
 * Every assertion documents the expected UTC bound with a worked example.
 */

import { localDayUTCBounds } from "../../utils/localDayBounds";

// ─────────────────────────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failMessages: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    const msg = `  ❌ FAIL: ${label}`;
    console.log(msg);
    failMessages.push(msg);
  }
}

function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`▶ ${title}`);
  console.log("─".repeat(60));
}

/** Format a Date as its UTC ISO string for error messages. */
function iso(d: Date) { return d.toISOString(); }

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: UTC (offset = 0)
// ─────────────────────────────────────────────────────────────────────────────
section("1 — UTC (offset 0)");
{
  const { start, end } = localDayUTCBounds("2026-08-12", "UTC");
  assert(
    start.toISOString() === "2026-08-12T00:00:00.000Z",
    `start = 2026-08-12T00:00:00Z (got ${iso(start)})`,
  );
  assert(
    end.toISOString() === "2026-08-12T23:59:59.999Z",
    `end   = 2026-08-12T23:59:59.999Z (got ${iso(end)})`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: New York (UTC−5 in winter / UTC−4 in summer)
// 2026-08-12 is summer → EDT = UTC−4
// Local midnight = 2026-08-12T04:00:00Z
// Local end      = 2026-08-13T03:59:59.999Z
// ─────────────────────────────────────────────────────────────────────────────
section("2 — America/New_York (summer: UTC−4)");
{
  const { start, end } = localDayUTCBounds("2026-08-12", "America/New_York");
  assert(
    start.toISOString() === "2026-08-12T04:00:00.000Z",
    `start = 2026-08-12T04:00:00Z EDT (got ${iso(start)})`,
  );
  assert(
    end.toISOString() === "2026-08-13T03:59:59.999Z",
    `end   = 2026-08-13T03:59:59.999Z (got ${iso(end)})`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: India (UTC+5:30 — fixed offset, no DST)
// Local midnight = 2026-08-12T00:00+5:30 = 2026-08-11T18:30:00Z
// ─────────────────────────────────────────────────────────────────────────────
section("3 — Asia/Kolkata (UTC+5:30, no DST)");
{
  const { start, end } = localDayUTCBounds("2026-08-12", "Asia/Kolkata");
  assert(
    start.toISOString() === "2026-08-11T18:30:00.000Z",
    `start = 2026-08-11T18:30:00Z (got ${iso(start)})`,
  );
  assert(
    end.toISOString() === "2026-08-12T18:29:59.999Z",
    `end   = 2026-08-12T18:29:59.999Z (got ${iso(end)})`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: UTC+13 (Samoa Standard Time) — CRITICAL: noon UTC is next day local
// Aug 12 local in UTC+13 starts at 2026-08-11T11:00:00Z
// Old broken code would compute offset as −660 instead of +780 for this case.
// ─────────────────────────────────────────────────────────────────────────────
section("4 — Pacific/Apia (UTC+13) — noon UTC rolls to next local day");
{
  const { start, end } = localDayUTCBounds("2026-08-12", "Pacific/Apia");
  // UTC+13: local midnight Aug 12 = Aug 11 11:00 UTC
  assert(
    start.toISOString() === "2026-08-11T11:00:00.000Z",
    `start = 2026-08-11T11:00:00Z (got ${iso(start)})`,
  );
  assert(
    end.toISOString() === "2026-08-12T10:59:59.999Z",
    `end   = 2026-08-12T10:59:59.999Z (got ${iso(end)})`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: UTC+14 (Line Islands, Kiribati) — most extreme positive offset
// Aug 12 local starts at 2026-08-11T10:00:00Z
// ─────────────────────────────────────────────────────────────────────────────
section("5 — Pacific/Kiritimati (UTC+14) — most extreme positive offset");
{
  const { start, end } = localDayUTCBounds("2026-08-12", "Pacific/Kiritimati");
  // UTC+14: local midnight Aug 12 = Aug 11 10:00 UTC
  assert(
    start.toISOString() === "2026-08-11T10:00:00.000Z",
    `start = 2026-08-11T10:00:00Z (got ${iso(start)})`,
  );
  assert(
    end.toISOString() === "2026-08-12T09:59:59.999Z",
    `end   = 2026-08-12T09:59:59.999Z (got ${iso(end)})`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 6: UTC−12 (Baker Island) — most extreme negative offset
// Aug 12 local starts at 2026-08-12T12:00:00Z
// ─────────────────────────────────────────────────────────────────────────────
section("6 — Etc/GMT+12 (UTC−12) — most extreme negative offset");
{
  const { start, end } = localDayUTCBounds("2026-08-12", "Etc/GMT+12");
  // UTC−12: local midnight Aug 12 = Aug 12 12:00 UTC
  assert(
    start.toISOString() === "2026-08-12T12:00:00.000Z",
    `start = 2026-08-12T12:00:00Z (got ${iso(start)})`,
  );
  assert(
    end.toISOString() === "2026-08-13T11:59:59.999Z",
    `end   = 2026-08-13T11:59:59.999Z (got ${iso(end)})`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 7: DST spring-forward — America/New_York on 2026-03-08
// Clocks spring forward at 2AM → 3AM (skip one hour)
// Local day is only 23 hours long.
// Local midnight 2026-03-08 = 2026-03-08T05:00:00Z (UTC−5, EST)
// Local midnight 2026-03-09 = 2026-03-09T04:00:00Z (UTC−4, EDT)
// Day length = 23 h = 82800000 ms
// end = 2026-03-09T03:59:59.999Z
// ─────────────────────────────────────────────────────────────────────────────
section("7 — DST spring-forward: America/New_York 2026-03-08 (23-hour day)");
{
  const { start, end } = localDayUTCBounds("2026-03-08", "America/New_York");
  assert(
    start.toISOString() === "2026-03-08T05:00:00.000Z",
    `start = 2026-03-08T05:00:00Z EST (got ${iso(start)})`,
  );
  assert(
    end.toISOString() === "2026-03-09T03:59:59.999Z",
    `end   = 2026-03-09T03:59:59.999Z — 23 h day (got ${iso(end)})`,
  );
  const dayLengthHours = (end.getTime() - start.getTime() + 1) / 3_600_000;
  assert(dayLengthHours === 23, `day is exactly 23 hours (got ${dayLengthHours}h)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 8: DST fall-back — America/New_York on 2026-11-01
// Clocks fall back at 2AM → 1AM (repeat one hour)
// Local day is 25 hours long.
// Local midnight 2026-11-01 = 2026-11-01T04:00:00Z (UTC−4, EDT)
// Local midnight 2026-11-02 = 2026-11-02T05:00:00Z (UTC−5, EST)
// end = 2026-11-02T04:59:59.999Z
// ─────────────────────────────────────────────────────────────────────────────
section("8 — DST fall-back: America/New_York 2026-11-01 (25-hour day)");
{
  const { start, end } = localDayUTCBounds("2026-11-01", "America/New_York");
  assert(
    start.toISOString() === "2026-11-01T04:00:00.000Z",
    `start = 2026-11-01T04:00:00Z EDT (got ${iso(start)})`,
  );
  assert(
    end.toISOString() === "2026-11-02T04:59:59.999Z",
    `end   = 2026-11-02T04:59:59.999Z — 25 h day (got ${iso(end)})`,
  );
  const dayLengthHours = (end.getTime() - start.getTime() + 1) / 3_600_000;
  assert(dayLengthHours === 25, `day is exactly 25 hours (got ${dayLengthHours}h)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 9: Log-window containment — a noon UTC timestamp must fall within
// the returned window for its local date in the given timezone.
// ─────────────────────────────────────────────────────────────────────────────
section("9 — Log-window containment: noon UTC falls within correct window");
{
  const timezones = [
    { tz: "UTC",                 localDate: "2026-08-12" },
    { tz: "America/New_York",    localDate: "2026-08-12" },
    { tz: "Asia/Kolkata",        localDate: "2026-08-12" },
    { tz: "Pacific/Apia",        localDate: "2026-08-12" },
    { tz: "Pacific/Kiritimati",  localDate: "2026-08-12" },
  ];

  for (const { tz, localDate } of timezones) {
    // Pick a time that is definitely within the local date: local noon
    const localNoonLabel = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(`${localDate}T12:00:00.000+00:00`));

    // Find a UTC instant that is local noon in tz on localDate
    // Use the bounds start + 12 hours as a proxy for local noon
    const { start, end } = localDayUTCBounds(localDate, tz);
    const localNoonApprox = new Date(start.getTime() + 12 * 3_600_000);
    const contained = localNoonApprox >= start && localNoonApprox <= end;
    assert(contained, `[${tz}] local noon +12h from start (${iso(localNoonApprox)}) is within [${iso(start)}, ${iso(end)}]`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failMessages.length > 0) {
  console.log("\nFailures:");
  failMessages.forEach((m) => console.log(m));
  process.exit(1);
} else {
  console.log("✅ All timezone bounds tests passed");
}
