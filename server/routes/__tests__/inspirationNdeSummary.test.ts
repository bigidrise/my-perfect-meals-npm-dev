/**
 * server/routes/__tests__/inspirationNdeSummary.test.ts
 *
 * Unit tests for the NDE "Adapted for today" banner logic.
 *
 * Covers three key branches required by the task:
 *  (a) starch-budget exhausted but HIGH-carb recipes → wasAdapted MUST be false
 *  (b) diabetic flag → wasAdapted true, correct diabetes note
 *  (c) cardiac conditionGuidanceBlock → wasAdapted true, correct cardiac note
 *
 * Also tests:
 *  (d) starch-budget exhausted + LOW-carb recipes → wasAdapted true (starch honoured)
 *  (e) starch-budget exhausted, zero policy, low carbs → "zero" note variant
 *  (f) plain user with no clinical flags → null (banner not shown)
 *  (g) glp1 guidance block → wasAdapted true, correct glp1 note
 *  (h) multiple constraints → diabetes wins (priority order)
 *  (i) starch check skipped when clinical constraint already active
 *
 * Pure-function tests: no DB, no network.
 * Run: npx tsx server/routes/__tests__/inspirationNdeSummary.test.ts
 */

import { computeNdeSummary } from "../inspiration-nde-helper";
import type { MealCarbView } from "../inspiration-nde-helper";
import type { UserProtocolEnvelope } from "../../services/protocolEnvelope";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal test harness (matches the existing test-file style in this directory)
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
    failMessages.push(label);
    console.log(`  ❌ ${label}`);
  }
}

function eq(a: unknown, b: unknown, label: string) {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok)
    console.log(
      `     expected: ${JSON.stringify(b)}\n     received: ${JSON.stringify(a)}`
    );
  assert(ok, label);
}

function section(name: string) {
  console.log(`\n── ${name}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Bare-minimum plain-user envelope — no clinical flags, no schedule. */
function plainEnvelope(
  overrides: Partial<UserProtocolEnvelope> = {}
): UserProtocolEnvelope {
  return {
    hasDiabetes: false,
    conditionGuidanceBlocks: [],
    hormoneOptimization: false,
    pregnancySupport: false,
    therapeuticSupport: false,
    dailyNutritionState: null,
    // The remaining fields are present on the real interface but not read
    // by computeNdeSummary, so we cast via unknown to keep the fixture lean.
    ...overrides,
  } as unknown as UserProtocolEnvelope;
}

/** Envelope with a schedule configured and starchy budget exhausted. */
function starchExhaustedEnvelope(
  starchPolicy: "zero" | "limited" | "unlimited" = "limited"
): UserProtocolEnvelope {
  return plainEnvelope({
    dailyNutritionState: {
      scheduleConfigured: true,
      starchyBudgetExhausted: true,
      starchPolicy,
      dayLabel: "Tuesday",
    } as any,
  });
}

/** High-carb meals — starch restriction was clearly NOT honoured. */
const highCarbMeals: MealCarbView[] = [
  { nutrition: { carbs: 80 } },
  { nutrition: { carbs: 95 } },
  { nutrition: { carbs: 75 } },
];

/** Low-carb meals — average well under 50 g. */
const lowCarbMeals: MealCarbView[] = [
  { nutrition: { carbs: 20 } },
  { nutrition: { carbs: 30 } },
  { nutrition: { carbs: 25 } },
];

/** Mixed meals that average exactly at the boundary (avg = 50 — NOT < 50). */
const borderlineMeals: MealCarbView[] = [
  { nutrition: { carbs: 50 } },
  { nutrition: { carbs: 50 } },
];

// ─────────────────────────────────────────────────────────────────────────────
// (a) Starch budget exhausted + HIGH-carb recipes → banner MUST NOT show
// ─────────────────────────────────────────────────────────────────────────────
section("(a) Starch-budget exhausted — high-carb meals — banner must NOT show");
{
  const result = computeNdeSummary(starchExhaustedEnvelope("limited"), highCarbMeals);

  // scheduleConfigured is true so result won't be null, but wasAdapted must be false.
  assert(result !== null, "result is non-null (scheduleConfigured=true)");
  eq(result?.wasAdapted, false, "wasAdapted is false");
  eq(result?.adaptedNote, null, "adaptedNote is null");
  eq(result?.adaptationContext, [], "adaptationContext is empty");
}

// ─────────────────────────────────────────────────────────────────────────────
// (b) Diabetic flag → banner shows with diabetes note
// ─────────────────────────────────────────────────────────────────────────────
section("(b) hasDiabetes=true — banner shows with diabetes note");
{
  const envelope = plainEnvelope({ hasDiabetes: true });
  const result = computeNdeSummary(envelope, highCarbMeals);

  assert(result !== null, "result is non-null");
  eq(result?.wasAdapted, true, "wasAdapted is true");
  assert(
    (result?.adaptedNote ?? "").toLowerCase().includes("diabetes"),
    "adaptedNote mentions diabetes"
  );
  assert(
    (result?.adaptationContext ?? []).includes("diabetes"),
    "adaptationContext includes 'diabetes'"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// (c) Cardiac conditionGuidanceBlock → banner shows with cardiac note
// ─────────────────────────────────────────────────────────────────────────────
section("(c) cardiac conditionGuidanceBlock — banner shows with cardiac note");
{
  const envelope = plainEnvelope({
    conditionGuidanceBlocks: ["You have a cardiac condition — apply heart-health limits."],
  });
  const result = computeNdeSummary(envelope, highCarbMeals);

  assert(result !== null, "result is non-null");
  eq(result?.wasAdapted, true, "wasAdapted is true");
  assert(
    (result?.adaptedNote ?? "").toLowerCase().includes("heart"),
    "adaptedNote mentions heart"
  );
  assert(
    (result?.adaptationContext ?? []).includes("cardiac"),
    "adaptationContext includes 'cardiac'"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// (d) Starch-budget exhausted + LOW-carb recipes → starch was honoured
// ─────────────────────────────────────────────────────────────────────────────
section("(d) Starch-budget exhausted — low-carb meals — banner shows (starch honoured)");
{
  const result = computeNdeSummary(starchExhaustedEnvelope("limited"), lowCarbMeals);

  assert(result !== null, "result is non-null");
  eq(result?.wasAdapted, true, "wasAdapted is true");
  assert(
    (result?.adaptationContext ?? []).includes("starch-restriction"),
    "adaptationContext includes 'starch-restriction'"
  );
  assert(
    (result?.adaptedNote ?? "").toLowerCase().includes("budget"),
    "adaptedNote mentions budget (limited policy)"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// (e) Starch policy = zero + low-carb → uses "minimized" note variant
// ─────────────────────────────────────────────────────────────────────────────
section("(e) starchPolicy=zero + low-carb meals — uses minimized note");
{
  const result = computeNdeSummary(starchExhaustedEnvelope("zero"), lowCarbMeals);

  assert(result !== null, "result is non-null");
  eq(result?.wasAdapted, true, "wasAdapted is true");
  assert(
    (result?.adaptedNote ?? "").toLowerCase().includes("minimized"),
    "adaptedNote says 'minimized'"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// (f) Plain user — no flags, no schedule → null returned (no banner)
// ─────────────────────────────────────────────────────────────────────────────
section("(f) Plain user — no clinical flags, no schedule → null");
{
  const result = computeNdeSummary(plainEnvelope(), highCarbMeals);
  eq(result, null, "result is null (banner not shown)");
}

// ─────────────────────────────────────────────────────────────────────────────
// (g) GLP-1 guidance block → wasAdapted true, glp1 note
// ─────────────────────────────────────────────────────────────────────────────
section("(g) GLP-1 guidance block → banner shows with GLP-1 note");
{
  const envelope = plainEnvelope({
    conditionGuidanceBlocks: ["GLP-1 / semaglutide protocol: restrict portions and ultra-processed foods."],
  });
  const result = computeNdeSummary(envelope, highCarbMeals);

  assert(result !== null, "result is non-null");
  eq(result?.wasAdapted, true, "wasAdapted is true");
  assert(
    (result?.adaptedNote ?? "").toLowerCase().includes("glp-1"),
    "adaptedNote mentions GLP-1"
  );
  assert(
    (result?.adaptationContext ?? []).includes("glp1"),
    "adaptationContext includes 'glp1'"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// (h) Diabetes + cardiac active simultaneously → diabetes wins (priority order)
// ─────────────────────────────────────────────────────────────────────────────
section("(h) Diabetes + cardiac simultaneously — diabetes note wins");
{
  const envelope = plainEnvelope({
    hasDiabetes: true,
    conditionGuidanceBlocks: ["cardiac protocol — limit saturated fat."],
  });
  const result = computeNdeSummary(envelope, highCarbMeals);

  assert(result !== null, "result is non-null");
  eq(result?.wasAdapted, true, "wasAdapted is true");
  assert(
    (result?.adaptedNote ?? "").toLowerCase().includes("diabetes"),
    "diabetes note takes priority over cardiac"
  );
  assert(
    (result?.adaptationContext ?? []).includes("diabetes"),
    "adaptationContext includes 'diabetes'"
  );
  assert(
    (result?.adaptationContext ?? []).includes("cardiac"),
    "adaptationContext also includes 'cardiac'"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// (i) Starch check is skipped when a clinical constraint is already active
// ─────────────────────────────────────────────────────────────────────────────
section("(i) Starch carb-check skipped when clinical constraint already active");
{
  // hasDiabetes is set AND starch budget exhausted but high-carb meals.
  // wasAdapted should be true (via diabetes) and starch-restriction should
  // NOT appear in adaptationContext even though avgCarbs > 50.
  const envelope: UserProtocolEnvelope = {
    ...plainEnvelope({ hasDiabetes: true }),
    dailyNutritionState: {
      scheduleConfigured: true,
      starchyBudgetExhausted: true,
      starchPolicy: "limited",
      dayLabel: "Monday",
    } as any,
  } as unknown as UserProtocolEnvelope;

  const result = computeNdeSummary(envelope, highCarbMeals);

  assert(result !== null, "result is non-null");
  eq(result?.wasAdapted, true, "wasAdapted is true");
  assert(
    !(result?.adaptationContext ?? []).includes("starch-restriction"),
    "starch-restriction NOT in adaptationContext when clinical constraint active"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Borderline carb average (exactly 50 g) — must NOT trigger starch banner
// ─────────────────────────────────────────────────────────────────────────────
section("(j) avgCarbs = 50 exactly — NOT below threshold, banner stays off");
{
  const result = computeNdeSummary(starchExhaustedEnvelope("limited"), borderlineMeals);

  // scheduleConfigured=true so result is non-null, but wasAdapted must be false.
  assert(result !== null, "result is non-null");
  eq(result?.wasAdapted, false, "wasAdapted is false (50 is not < 50)");
}

// ─────────────────────────────────────────────────────────────────────────────
// Carbs expressed as `carbohydrates` key (alternate nutrition field name)
// ─────────────────────────────────────────────────────────────────────────────
section("(k) nutrition.carbohydrates key accepted alongside nutrition.carbs");
{
  const altKeyMeals: MealCarbView[] = [
    { nutrition: { carbohydrates: 15 } },
    { nutrition: { carbohydrates: 25 } },
  ];
  const result = computeNdeSummary(starchExhaustedEnvelope("limited"), altKeyMeals);

  assert(result !== null, "result is non-null");
  eq(result?.wasAdapted, true, "wasAdapted is true (avg 20 g via carbohydrates key)");
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failMessages.length > 0) {
  console.log("\nFailed assertions:");
  failMessages.forEach(m => console.log(`  ✗ ${m}`));
  process.exit(1);
} else {
  console.log("All assertions passed ✅");
}
