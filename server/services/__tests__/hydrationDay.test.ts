/**
 * Hydration subject-local day tests.
 *
 * Pure boundary checks: explicit timezones avoid database access.
 * Run: npx tsx server/services/__tests__/hydrationDay.test.ts
 */

import {
  hydrationCalendarWindow,
  resolveHydrationDay,
} from "../hydration/hydrationDay";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed += 1;
    console.log(`  PASS: ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL: ${label}`);
  }
}

async function run() {
  const beforeCentralMidnight = await resolveHydrationDay({
    subjectUserId: "test-subject",
    timezone: "America/Chicago",
    now: new Date("2026-08-29T04:59:59.999Z"),
  });
  assert(
    beforeCentralMidnight.localDate === "2026-08-28",
    "Central Time remains on the previous local date before midnight",
  );

  const atCentralMidnight = await resolveHydrationDay({
    subjectUserId: "test-subject",
    timezone: "America/Chicago",
    now: new Date("2026-08-29T05:00:00.000Z"),
  });
  assert(
    atCentralMidnight.localDate === "2026-08-29",
    "Central Time advances exactly at subject-local midnight",
  );

  const springForward = await resolveHydrationDay({
    subjectUserId: "test-subject",
    localDate: "2026-03-08",
    timezone: "America/Chicago",
  });
  assert(
    springForward.end.getTime() - springForward.start.getTime() + 1 === 23 * 60 * 60 * 1000,
    "spring-forward hydration day is 23 hours",
  );

  const fallBack = await resolveHydrationDay({
    subjectUserId: "test-subject",
    localDate: "2026-11-01",
    timezone: "America/Chicago",
  });
  assert(
    fallBack.end.getTime() - fallBack.start.getTime() + 1 === 25 * 60 * 60 * 1000,
    "fall-back hydration day is 25 hours",
  );

  const backdatedInstant = new Date("2026-08-29T01:00:00.000Z");
  assert(
    backdatedInstant >= beforeCentralMidnight.start &&
      backdatedInstant <= beforeCentralMidnight.end,
    "a backdated UTC intake is assigned to the subject's Central Time day",
  );
  assert(
    !(backdatedInstant >= atCentralMidnight.start &&
      backdatedInstant <= atCentralMidnight.end),
    "the same intake does not leak into the next subject-local day",
  );

  const sevenDayWindow = hydrationCalendarWindow({
    endingLocalDate: "2026-08-29",
    timezone: "America/Chicago",
    days: 7,
  });
  assert(
    sevenDayWindow.start.toISOString() === "2026-08-23T05:00:00.000Z",
    "seven-day window starts at local midnight six calendar dates earlier",
  );
  assert(
    sevenDayWindow.end.toISOString() === "2026-08-30T04:59:59.999Z",
    "seven-day window ends at the current subject-local day boundary",
  );

  console.log(`\nHydration day tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void run();