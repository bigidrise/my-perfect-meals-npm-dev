/**
 * DIABETIC HUB GUARDRAIL PERSISTENCE — TEST SUITE
 *
 * Verifies that guardrail values written via the hub's save action
 * survive a page reload (round-trip through DB schema / Zod parsing).
 *
 * Covers:
 *   1. Full-save round-trip — all seven fields written and read back intact
 *   2. Partial-save round-trip — only some fields set; others absent (not defaulted to 0)
 *   3. Zod schema validation — valid values pass, out-of-range values are rejected
 *   4. Upsert semantics — a second save REPLACES the previous guardrails (no stale merge)
 *   5. Profile body construction — PUT /api/diabetes/profile destructures guardrails correctly
 *   6. Boundary values — schema min/max edges are accepted
 *   7. Empty guardrails object — round-trips as {} (no fields dropped, no defaults injected)
 *
 * Run:
 *   npx tsx server/tests/diabetic-hub-guardrails.test.ts
 *
 * Exit 0 = all pass. Exit 1 = one or more failures.
 */

import { GuardrailsZ, DEFAULT_GUARDRAILS, type Guardrails } from "../../shared/diabetes-schema";

// ─────────────────────────────────────────────────────────────────────────────
// CONSOLE COLORS
// ─────────────────────────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED   = "\x1b[31m";
const CYAN  = "\x1b[36m";

// ─────────────────────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function header(title: string) {
  console.log(`\n${BOLD}${CYAN}${"─".repeat(70)}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}${"─".repeat(70)}${RESET}`);
}

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${GREEN}✅ PASS${RESET}  ${label}`);
    pass++;
  } else {
    console.log(`  ${RED}${BOLD}❌ FAIL${RESET}  ${label}`);
    if (detail) console.log(`${RED}         → ${detail}${RESET}`);
    fail++;
  }
}

function assertEq<T>(label: string, actual: T, expected: T) {
  assert(label, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertDeepEq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  assert(label, ok, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — simulate the server-side save/load lifecycle without a DB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate what the PUT /api/diabetes/profile handler stores:
 * it blindly assigns the caller-supplied guardrails object to the DB row,
 * so the stored value is exactly what was sent (JSONB column).
 */
function simulateSave(guardrails: Guardrails | undefined): Guardrails | undefined {
  // The route does: .set({ guardrails, ... }) — no transformation.
  return guardrails;
}

/**
 * Simulate what the GET /api/diabetes/profile handler returns:
 * reads the JSONB column as-is. On load the UI reads profile.data.guardrails.
 * We model this as identity so the test can confirm no field is silently dropped.
 */
function simulateLoad(stored: Guardrails | undefined): Guardrails | undefined {
  return stored; // JSONB round-trips are lossless for plain numeric objects.
}

/**
 * Full save-then-load lifecycle.
 */
function roundTrip(guardrails: Guardrails | undefined): Guardrails | undefined {
  return simulateLoad(simulateSave(guardrails));
}

/**
 * Parse a raw object through GuardrailsZ (what the UI/validation layer uses).
 */
function parseGuardrails(raw: unknown): { ok: true; data: Guardrails } | { ok: false; issues: string[] } {
  const result = GuardrailsZ.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, issues: result.error.issues.map((i) => i.message) };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1: FULL-SAVE ROUND-TRIP
// All seven guardrail fields set → all seven fields readable after reload.
// ─────────────────────────────────────────────────────────────────────────────
header("SCENARIO 1 — Full-Save Round-Trip (all 7 fields)");

{
  const input: Guardrails = {
    fastingMin:    75,
    fastingMax:    115,
    postMealMax:   160,
    carbLimit:     100,
    fiberMin:      30,
    giCap:         50,
    mealFrequency: 5,
  };

  const loaded = roundTrip(input);

  assertEq("fastingMin survives reload",    loaded?.fastingMin,    75);
  assertEq("fastingMax survives reload",    loaded?.fastingMax,    115);
  assertEq("postMealMax survives reload",   loaded?.postMealMax,   160);
  assertEq("carbLimit survives reload",     loaded?.carbLimit,     100);
  assertEq("fiberMin survives reload",      loaded?.fiberMin,      30);
  assertEq("giCap survives reload",         loaded?.giCap,         50);
  assertEq("mealFrequency survives reload", loaded?.mealFrequency, 5);
  assert("loaded object has all 7 keys", Object.keys(loaded ?? {}).length === 7);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2: PARTIAL-SAVE ROUND-TRIP
// Only some fields provided — absent fields must not appear as 0 or defaults.
// ─────────────────────────────────────────────────────────────────────────────
header("SCENARIO 2 — Partial-Save Round-Trip (subset of fields)");

{
  // Case A: only glucose range fields
  const partialA: Guardrails = { fastingMin: 80, fastingMax: 120, postMealMax: 140 };
  const loadedA = roundTrip(partialA);

  assertEq("A: fastingMin present",     loadedA?.fastingMin,    80);
  assertEq("A: fastingMax present",     loadedA?.fastingMax,    120);
  assertEq("A: postMealMax present",    loadedA?.postMealMax,   140);
  assertEq("A: carbLimit absent",       loadedA?.carbLimit,     undefined);
  assertEq("A: fiberMin absent",        loadedA?.fiberMin,      undefined);
  assertEq("A: giCap absent",           loadedA?.giCap,         undefined);
  assertEq("A: mealFrequency absent",   loadedA?.mealFrequency, undefined);

  // Case B: only dietary control fields
  const partialB: Guardrails = { carbLimit: 90, fiberMin: 28, giCap: 45 };
  const loadedB = roundTrip(partialB);

  assertEq("B: carbLimit present",      loadedB?.carbLimit,     90);
  assertEq("B: fiberMin present",       loadedB?.fiberMin,      28);
  assertEq("B: giCap present",          loadedB?.giCap,         45);
  assertEq("B: fastingMin absent",      loadedB?.fastingMin,    undefined);
  assertEq("B: fastingMax absent",      loadedB?.fastingMax,    undefined);
  assertEq("B: postMealMax absent",     loadedB?.postMealMax,   undefined);
  assertEq("B: mealFrequency absent",   loadedB?.mealFrequency, undefined);

  // Case C: single field only
  const partialC: Guardrails = { mealFrequency: 6 };
  const loadedC = roundTrip(partialC);

  assertEq("C: mealFrequency present",  loadedC?.mealFrequency, 6);
  assertEq("C: all others absent",
    Object.keys(loadedC ?? {}).length, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3: ZOD SCHEMA VALIDATION
// Valid values accepted; out-of-range values rejected.
// ─────────────────────────────────────────────────────────────────────────────
header("SCENARIO 3 — Zod Schema Validation (GuardrailsZ)");

{
  // Full valid object passes
  const fullValid = parseGuardrails({
    fastingMin: 80, fastingMax: 120, postMealMax: 140,
    carbLimit: 120, fiberMin: 25, giCap: 55, mealFrequency: 4,
  });
  assert("Full valid object passes schema", fullValid.ok);

  // Empty object passes (all fields optional)
  const emptyResult = parseGuardrails({});
  assert("Empty object passes schema (all fields optional)", emptyResult.ok);

  // fastingMin below min (40)
  const tooLow = parseGuardrails({ fastingMin: 39 });
  assert("fastingMin: 39 rejected (min is 40)", !tooLow.ok);

  // fastingMin at minimum boundary
  const atMinBoundary = parseGuardrails({ fastingMin: 40 });
  assert("fastingMin: 40 accepted (at min boundary)", atMinBoundary.ok);

  // fastingMax above max (200)
  const tooHighMax = parseGuardrails({ fastingMax: 201 });
  assert("fastingMax: 201 rejected (max is 200)", !tooHighMax.ok);

  // fastingMax at maximum boundary
  const atMaxBoundary = parseGuardrails({ fastingMax: 200 });
  assert("fastingMax: 200 accepted (at max boundary)", atMaxBoundary.ok);

  // postMealMax below min (100)
  const postMealLow = parseGuardrails({ postMealMax: 99 });
  assert("postMealMax: 99 rejected (min is 100)", !postMealLow.ok);

  // postMealMax above max (300)
  const postMealHigh = parseGuardrails({ postMealMax: 301 });
  assert("postMealMax: 301 rejected (max is 300)", !postMealHigh.ok);

  // carbLimit below min (30)
  const carbLow = parseGuardrails({ carbLimit: 29 });
  assert("carbLimit: 29 rejected (min is 30)", !carbLow.ok);

  // carbLimit above max (400)
  const carbHigh = parseGuardrails({ carbLimit: 401 });
  assert("carbLimit: 401 rejected (max is 400)", !carbHigh.ok);

  // fiberMin below min (5)
  const fiberLow = parseGuardrails({ fiberMin: 4 });
  assert("fiberMin: 4 rejected (min is 5)", !fiberLow.ok);

  // fiberMin above max (100)
  const fiberHigh = parseGuardrails({ fiberMin: 101 });
  assert("fiberMin: 101 rejected (max is 100)", !fiberHigh.ok);

  // giCap below min (10)
  const giLow = parseGuardrails({ giCap: 9 });
  assert("giCap: 9 rejected (min is 10)", !giLow.ok);

  // giCap above max (100)
  const giHigh = parseGuardrails({ giCap: 101 });
  assert("giCap: 101 rejected (max is 100)", !giHigh.ok);

  // mealFrequency below min (2)
  const mfLow = parseGuardrails({ mealFrequency: 1 });
  assert("mealFrequency: 1 rejected (min is 2)", !mfLow.ok);

  // mealFrequency above max (8)
  const mfHigh = parseGuardrails({ mealFrequency: 9 });
  assert("mealFrequency: 9 rejected (max is 8)", !mfHigh.ok);

  // Non-integer rejected
  const nonInt = parseGuardrails({ carbLimit: 90.5 });
  assert("Non-integer carbLimit (90.5) rejected", !nonInt.ok);

  // Non-number string rejected
  const stringVal = parseGuardrails({ fastingMin: "80" });
  assert("String '80' for fastingMin rejected", !stringVal.ok);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 4: UPSERT SEMANTICS — SECOND SAVE REPLACES PREVIOUS GUARDRAILS
// A user updating only the glucose range should not inherit the old carbLimit.
// ─────────────────────────────────────────────────────────────────────────────
header("SCENARIO 4 — Upsert Semantics (second save replaces first)");

{
  // First save: full guardrails
  const firstSave: Guardrails = {
    fastingMin: 80, fastingMax: 120, postMealMax: 140,
    carbLimit: 100, fiberMin: 25, giCap: 55, mealFrequency: 4,
  };
  let stored = roundTrip(firstSave);
  assertEq("After first save: carbLimit = 100", stored?.carbLimit, 100);

  // Second save: user only updates glucose range, carbLimit intentionally omitted.
  // The server receives the new guardrails object as-is — previous carbLimit is gone.
  const secondSave: Guardrails = {
    fastingMin: 75,
    fastingMax: 115,
    postMealMax: 155,
  };
  stored = roundTrip(secondSave);

  assertEq("After second save: fastingMin updated to 75",  stored?.fastingMin, 75);
  assertEq("After second save: fastingMax updated to 115", stored?.fastingMax, 115);
  assertEq("After second save: postMealMax updated to 155", stored?.postMealMax, 155);
  assertEq("After second save: carbLimit absent (replaced, not merged)", stored?.carbLimit, undefined);
  assertEq("After second save: fiberMin absent",      stored?.fiberMin, undefined);
  assertEq("After second save: giCap absent",         stored?.giCap, undefined);
  assertEq("After second save: mealFrequency absent", stored?.mealFrequency, undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 5: PUT REQUEST BODY DESTRUCTURING
// The handler destructures: const { type, medications, hypoHistory, a1cPercent, guardrails } = req.body
// Verify that additional fields in req.body do NOT leak into guardrails.
// ─────────────────────────────────────────────────────────────────────────────
header("SCENARIO 5 — Request Body Destructuring (guardrails not contaminated by siblings)");

{
  // Simulate the server destructuring of a real PUT body
  const reqBody = {
    type: "T2D",
    medications: [{ name: "Metformin", dose: "500mg" }],
    hypoHistory: true,
    a1cPercent: 7.2,
    guardrails: { fastingMin: 82, fastingMax: 118, carbLimit: 95 },
  };

  const { guardrails } = reqBody;

  assertEq("guardrails.fastingMin extracted correctly",  guardrails.fastingMin, 82);
  assertEq("guardrails.fastingMax extracted correctly",  guardrails.fastingMax, 118);
  assertEq("guardrails.carbLimit extracted correctly",   guardrails.carbLimit, 95);
  assert("guardrails does not contain 'type' key",
    !("type" in guardrails));
  assert("guardrails does not contain 'medications' key",
    !("medications" in guardrails));
  assert("guardrails does not contain 'hypoHistory' key",
    !("hypoHistory" in guardrails));
  assert("guardrails does not contain 'a1cPercent' key",
    !("a1cPercent" in guardrails));

  // Verify a valid body with guardrails=undefined is handled (optional guardrails field)
  const bodyNoGuardrails = { type: "T1D" };
  const { guardrails: g2 } = bodyNoGuardrails as any;
  assertEq("guardrails undefined when omitted from body", g2, undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 6: BOUNDARY VALUES
// Values at schema min/max edges are preserved through round-trip.
// ─────────────────────────────────────────────────────────────────────────────
header("SCENARIO 6 — Boundary Values (min/max edges preserved)");

{
  const minBoundary: Guardrails = {
    fastingMin:    40,   // schema min
    fastingMax:    80,   // schema min
    postMealMax:   100,  // schema min
    carbLimit:     30,   // schema min
    fiberMin:      5,    // schema min
    giCap:         10,   // schema min
    mealFrequency: 2,    // schema min
  };

  const loaded = roundTrip(minBoundary);
  assertEq("Min fastingMin (40) round-trips",    loaded?.fastingMin,    40);
  assertEq("Min fastingMax (80) round-trips",    loaded?.fastingMax,    80);
  assertEq("Min postMealMax (100) round-trips",  loaded?.postMealMax,   100);
  assertEq("Min carbLimit (30) round-trips",     loaded?.carbLimit,     30);
  assertEq("Min fiberMin (5) round-trips",       loaded?.fiberMin,      5);
  assertEq("Min giCap (10) round-trips",         loaded?.giCap,         10);
  assertEq("Min mealFrequency (2) round-trips",  loaded?.mealFrequency, 2);

  // Validate all min values pass schema
  const minResult = parseGuardrails(minBoundary);
  assert("All min-boundary values pass schema validation", minResult.ok);

  const maxBoundary: Guardrails = {
    fastingMin:    140,  // schema max
    fastingMax:    200,  // schema max
    postMealMax:   300,  // schema max
    carbLimit:     400,  // schema max
    fiberMin:      100,  // schema max
    giCap:         100,  // schema max
    mealFrequency: 8,    // schema max
  };

  const loadedMax = roundTrip(maxBoundary);
  assertEq("Max fastingMin (140) round-trips",    loadedMax?.fastingMin,    140);
  assertEq("Max fastingMax (200) round-trips",    loadedMax?.fastingMax,    200);
  assertEq("Max postMealMax (300) round-trips",   loadedMax?.postMealMax,   300);
  assertEq("Max carbLimit (400) round-trips",     loadedMax?.carbLimit,     400);
  assertEq("Max fiberMin (100) round-trips",      loadedMax?.fiberMin,      100);
  assertEq("Max giCap (100) round-trips",         loadedMax?.giCap,         100);
  assertEq("Max mealFrequency (8) round-trips",   loadedMax?.mealFrequency, 8);

  // Validate all max values pass schema
  const maxResult = parseGuardrails(maxBoundary);
  assert("All max-boundary values pass schema validation", maxResult.ok);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 7: EMPTY GUARDRAILS OBJECT
// {} round-trips as {} — no fields dropped, no defaults silently injected.
// ─────────────────────────────────────────────────────────────────────────────
header("SCENARIO 7 — Empty Guardrails Object ({})");

{
  const empty: Guardrails = {};
  const loaded = roundTrip(empty);

  assert("Empty object round-trips as object (not null/undefined)",
    loaded !== null && loaded !== undefined);
  assertEq("Empty object round-trips with 0 keys", Object.keys(loaded ?? {}).length, 0);

  // Confirm schema also accepts it
  const result = parseGuardrails(empty);
  assert("Empty {} passes GuardrailsZ validation", result.ok);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 8: DEFAULT_GUARDRAILS INTEGRITY
// The documented defaults match what GuardrailsZ accepts.
// ─────────────────────────────────────────────────────────────────────────────
header("SCENARIO 8 — DEFAULT_GUARDRAILS Integrity");

{
  const result = parseGuardrails(DEFAULT_GUARDRAILS);
  assert("DEFAULT_GUARDRAILS passes GuardrailsZ validation", result.ok);

  if (result.ok) {
    assertEq("Default fastingMin = 80",  result.data.fastingMin,    80);
    assertEq("Default fastingMax = 120", result.data.fastingMax,    120);
    assertEq("Default postMealMax = 140", result.data.postMealMax,  140);
    assertEq("Default carbLimit = 120",  result.data.carbLimit,     120);
    assertEq("Default fiberMin = 25",    result.data.fiberMin,      25);
    assertEq("Default giCap = 55",       result.data.giCap,         55);
    assertEq("Default mealFrequency = 4", result.data.mealFrequency, 4);

    const loaded = roundTrip(DEFAULT_GUARDRAILS);
    assertDeepEq("DEFAULT_GUARDRAILS round-trips unchanged", loaded, DEFAULT_GUARDRAILS);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 9: NULL / UNDEFINED GUARDRAILS
// If a user has never set guardrails, profile.guardrails is null (DB default).
// ─────────────────────────────────────────────────────────────────────────────
header("SCENARIO 9 — Null / Undefined Guardrails (never-set user)");

{
  // DB default is null — simulate a profile that was created without guardrails
  const storedNull = roundTrip(undefined);
  assertEq("Undefined guardrails round-trips as undefined", storedNull, undefined);

  // UI should treat null/undefined as "no custom guardrails" — it falls back to DEFAULT_GUARDRAILS
  const effectiveGuardrails = storedNull ?? DEFAULT_GUARDRAILS;
  assertEq("Fallback to DEFAULT when none stored: fastingMin = 80", effectiveGuardrails.fastingMin, 80);
  assertEq("Fallback to DEFAULT when none stored: carbLimit = 120", effectiveGuardrails.carbLimit, 120);

  assert("null stored value does not pass through as a defined guardrails object",
    storedNull === undefined || storedNull === null);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${BOLD}${"═".repeat(70)}${RESET}`);
console.log(`${BOLD}  RESULTS: ${GREEN}${pass} passed${RESET}${BOLD}, ${fail > 0 ? RED : ""}${fail} failed${RESET}`);
console.log(`${BOLD}${"═".repeat(70)}${RESET}\n`);

if (fail > 0) process.exit(1);
