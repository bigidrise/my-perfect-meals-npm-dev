/**
 * Prescription Resolver — Pure Function Tests
 *
 * Run with: npx tsx scripts/test-prescription-pure-functions.ts
 *
 * Tests the pure, side-effect-free helpers that underpin the prescription
 * resolver. These cover the scenarios the architect identified without
 * needing a live database connection.
 *
 * DB-dependent scenarios (resolveDailyNutritionPrescription with real data)
 * require an integration test environment with a seeded user record.
 */

import {
  deriveStarchMealsAllowed,
  computeGramsPerRemainingMeal,
  sessionTypeToTrainingDayType,
  buildFallbackPrescription,
  deriveClinicalStatus,
} from "../shared/dailyNutritionPrescription";

// ── Tiny assertion helper ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}`);
    console.error(`       expected: ${JSON.stringify(expected)}`);
    console.error(`       received: ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── sessionTypeToTrainingDayType ──────────────────────────────────────────────

console.log("\n── sessionTypeToTrainingDayType ──────────────────────────────────");
expect("'off' → rest",       sessionTypeToTrainingDayType("off"),         "rest");
expect("'recovery' → rest",  sessionTypeToTrainingDayType("recovery"),    "rest");
expect("'strength' → moderate", sessionTypeToTrainingDayType("strength"), "moderate");
expect("'endurance' → heavy",   sessionTypeToTrainingDayType("endurance"),"heavy");
expect("'competition' → competition", sessionTypeToTrainingDayType("competition"), "competition");
expect("null → null",        sessionTypeToTrainingDayType(null),          null);
expect("undefined → null",   sessionTypeToTrainingDayType(undefined),     null);
expect("unknown → null",     sessionTypeToTrainingDayType("unknown_type"), null);

// ── deriveStarchMealsAllowed ──────────────────────────────────────────────────

console.log("\n── deriveStarchMealsAllowed ──────────────────────────────────────");
expect("zero-starch override → 0",               deriveStarchMealsAllowed(null, "flex", true), 0);
expect("rest day → 0",                           deriveStarchMealsAllowed("rest", "flex"), 0);
expect("light day → 1",                          deriveStarchMealsAllowed("light", "flex"), 1);
expect("moderate training → 2",                  deriveStarchMealsAllowed("moderate", "one"), 2);
expect("heavy training → 3",                     deriveStarchMealsAllowed("heavy", "one"), 3);
expect("competition → 4",                        deriveStarchMealsAllowed("competition", "one"), 4);
expect("no schedule + baseline one → 1",         deriveStarchMealsAllowed(null, "one"), 1);
expect("no schedule + baseline flex → 2",        deriveStarchMealsAllowed(null, "flex"), 2);
expect("no schedule + no baseline → 1 (default)",deriveStarchMealsAllowed(null, undefined), 1);

// ── computeGramsPerRemainingMeal ──────────────────────────────────────────────

console.log("\n── computeGramsPerRemainingMeal ──────────────────────────────────");
expect("80g target, 4 meals → ~20g each",
  computeGramsPerRemainingMeal(80, 4), 20);
expect("48g remaining, 3 meals → 16g each",
  computeGramsPerRemainingMeal(48, 3), 16);
expect("0 meals remaining → undefined",
  computeGramsPerRemainingMeal(48, 0), undefined);
expect("0g remaining, 2 meals → 0g",
  computeGramsPerRemainingMeal(0, 2), 0);
expect("rounds to nearest integer (50g / 3 meals → 17)",
  computeGramsPerRemainingMeal(50, 3), 17);

// ── deriveClinicalStatus ──────────────────────────────────────────────────────

console.log("\n── deriveClinicalStatus ──────────────────────────────────────────");
expect("non-clinical tier → standard_personalization",
  deriveClinicalStatus("pro", false, false), "standard_personalization");
expect("non-clinical tier with labs → still standard",
  deriveClinicalStatus("pro", false, true), "standard_personalization");
expect("clinical tier, no meds, no labs → clinical_information_needed",
  deriveClinicalStatus("ultimate", false, false), "clinical_information_needed");
expect("clinical tier, only meds → clinical_precision_available",
  deriveClinicalStatus("ultimate", true, false), "clinical_precision_available");
expect("clinical tier, only labs → clinical_precision_available",
  deriveClinicalStatus("ultimate", false, true), "clinical_precision_available");
expect("clinical tier, both meds AND labs → clinical_precision_active",
  deriveClinicalStatus("ultimate", true, true), "clinical_precision_active");

// ── buildFallbackPrescription ─────────────────────────────────────────────────

console.log("\n── buildFallbackPrescription ─────────────────────────────────────");
const fallback = buildFallbackPrescription("2026-07-18");
expect("fallback date",               fallback.date,                  "2026-07-18");
expect("fallback source",             fallback.source,                "fallback");
expect("fallback caloriesTarget = 0", fallback.caloriesTarget,        0);
expect("fallback starchMealsAllowed = 1", fallback.starchMealsAllowed, 1);
expect("fallback isZeroStarchDay = false", fallback.isZeroStarchDay,  false);
expect("fallback rationale code",     fallback.rationaleCodes[0],     "fallback_no_targets");
expect("fallback clinicalStatus",     fallback.clinicalPrecisionStatus, "standard_personalization");

// ── Adaptive redistribution scenario ─────────────────────────────────────────

console.log("\n── Adaptive redistribution scenario ──────────────────────────────");
// 80g target, 4 meals, user consumed 32g in 1 meal → 48g remaining across 3 meals
const target   = 80;
const consumed = 32;
const used     = 1;
const allowed  = 4;
const remaining      = Math.max(0, target - consumed);
const mealsRemaining = Math.max(0, allowed - used);
const perMeal        = computeGramsPerRemainingMeal(remaining, mealsRemaining);
expect("48g remaining after 32g consumed", remaining, 48);
expect("3 starch meals remaining",         mealsRemaining, 3);
expect("~16g per remaining meal",          perMeal, 16);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
if (failed === 0) {
  console.log(`✅  All ${passed} tests passed.`);
} else {
  console.error(`❌  ${failed} test(s) failed, ${passed} passed.`);
  process.exit(1);
}
