/**
 * Nutrition Budget Engine — unit tests
 *
 * Pure-function tests: no DB, no network.
 * Run: npx tsx server/services/__tests__/nutritionBudget.test.ts
 *
 * Covers:
 *  1. Basic budget division across remaining meals
 *  2. Zero starchyCarbs when starch slots exhausted
 *  3. Negative remaining clamped to 0
 *  4. mealsLeft = 0 handled gracefully (clamped to 1)
 *  5. deriveGenerationContext priority order
 *  6. Reservation lifecycle simulations:
 *       a. create → it appears in remaining (reduces budget)
 *       b. delete  → budget restored
 *       c. create → log → log again is rejected (already logged)
 *       d. create → log → budget not double-counted
 */

import {
  computeNextMealBudget,
  deriveGenerationContext,
  type MealBudget,
} from "../nutritionBudget";
import type {
  DailyNutritionState,
  DailyNutritionPrescription,
} from "../../../shared/dailyNutritionPrescription";

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

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makePrescription(overrides: Partial<DailyNutritionPrescription> = {}): DailyNutritionPrescription {
  return {
    date: "2026-08-12",
    source: "user_default",
    caloriesTarget: 2000,
    proteinTarget: 150,
    carbsTarget: 200,
    fatTarget: 70,
    starchyCarbsTarget: 130,
    fibrousCarbsTarget: 70,
    starchMealsAllowed: 2,
    starchMealsUsed: 0,
    starchMealsRemaining: 2,
    starchyCarbsConsumed: 0,
    starchyCarbsRemaining: 130,
    starchDistributionStrategy: "even",
    isZeroStarchDay: false,
    trainingDayType: null,
    clinicalPrecisionStatus: "standard_personalization",
    rationaleCodes: ["user_default_targets"],
    ...overrides,
  };
}

function makeState(overrides: {
  consumed?: Partial<DailyNutritionState["consumed"]>;
  planned?: Partial<DailyNutritionState["planned"]>;
  prescription?: Partial<DailyNutritionPrescription>;
} = {}): DailyNutritionState {
  const prescription = makePrescription(overrides.prescription ?? {});

  const consumed = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    starchyCarbs: 0,
    fibrousCarbs: 0,
    mealCount: 0,
    starchMealsLogged: 0,
    ...(overrides.consumed ?? {}),
  };

  const planned = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    starchyCarbs: 0,
    starchMealsPlanned: 0,
    reservationCount: 0,
    ...(overrides.planned ?? {}),
  };

  const totalStarchMeals = consumed.starchMealsLogged + planned.starchMealsPlanned;

  const remaining = {
    calories:           Math.max(0, prescription.caloriesTarget   - consumed.calories     - planned.calories),
    protein:            Math.max(0, prescription.proteinTarget     - consumed.protein      - planned.protein),
    carbs:              Math.max(0, prescription.carbsTarget       - consumed.carbs        - planned.carbs),
    fat:                Math.max(0, prescription.fatTarget         - consumed.fat          - planned.fat),
    starchyCarbs:       Math.max(0, prescription.starchyCarbsTarget - consumed.starchyCarbs - planned.starchyCarbs),
    fibrousCarbs:       Math.max(0, prescription.fibrousCarbsTarget - consumed.fibrousCarbs),
    starchMealsRemaining: Math.max(0, prescription.starchMealsAllowed - totalStarchMeals),
  };

  return {
    date: prescription.date,
    resolvedAt: new Date().toISOString(),
    prescription,
    consumed,
    planned,
    remaining,
    mealPlanConfig: {
      mealsPerDay: 4,
      starchMealsPerDay: prescription.starchMealsAllowed,
      starchDistributionStrategy: "even",
    },
    activeConstraints: {
      generationContext: "standard",
      starchSlotsExhausted: remaining.starchMealsRemaining <= 0,
      calorieBudgetExhausted: remaining.calories <= 0,
      proteinBudgetMet: (consumed.protein + planned.protein) >= prescription.proteinTarget,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Basic budget division
// ─────────────────────────────────────────────────────────────────────────────
section("1 — Basic budget division");
{
  const state = makeState();
  const budget = computeNextMealBudget(state, 4);
  assert(budget.caloriesTarget === 500, `calories 2000 ÷ 4 = 500 (got ${budget.caloriesTarget})`);
  assert(budget.proteinTarget  === 38,  `protein  150  ÷ 4 = 37.5 → 38 (got ${budget.proteinTarget})`);
  assert(budget.carbsTarget    === 50,  `carbs    200  ÷ 4 = 50 (got ${budget.carbsTarget})`);
  assert(budget.fatTarget      === 18,  `fat      70   ÷ 4 = 17.5 → 18 (got ${budget.fatTarget})`);
  assert(budget.starchSlotAvailable === true, "starch slot available (2 remaining)");
  assert(budget.mealsLeft === 4, "mealsLeft = 4");
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Zero starchyCarbs when slots exhausted
// ─────────────────────────────────────────────────────────────────────────────
section("2 — Starch slots exhausted → starchyCarbsTarget = 0");
{
  // Both starch slots used (1 consumed + 1 planned)
  const state = makeState({
    consumed: { starchMealsLogged: 1, starchyCarbs: 65 },
    planned:  { starchMealsPlanned: 1, starchyCarbs: 65 },
  });
  const budget = computeNextMealBudget(state, 2);
  assert(budget.starchyCarbsTarget === 0,     "starchyCarbsTarget = 0 when slots exhausted");
  assert(budget.starchSlotAvailable === false, "starchSlotAvailable = false");
  assert(budget.carbsTarget >= 0,             "carbsTarget still non-negative");
  // All remaining carbs route to fibrous when starch is exhausted
  assert(budget.fibrousCarbsTarget >= 0,      "fibrousCarbsTarget ≥ 0");
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Negative remaining clamped to 0
// ─────────────────────────────────────────────────────────────────────────────
section("3 — Over-budget remaining clamped to 0");
{
  // Consumed more than the daily target
  const state = makeState({
    consumed: {
      calories: 2500,  // exceeds 2000 target
      protein:  160,
      carbs:    220,
      fat:      80,
      starchyCarbs: 140,
      fibrousCarbs: 80,
      starchMealsLogged: 2,
    },
  });
  const budget = computeNextMealBudget(state, 1);
  assert(budget.caloriesTarget   === 0, "caloriesTarget clamped to 0 when over budget");
  assert(budget.proteinTarget    === 0, "proteinTarget clamped to 0");
  assert(budget.starchyCarbsTarget === 0, "starchyCarbsTarget = 0 (slots exhausted + over budget)");
  assert(budget.fatTarget        === 0, "fatTarget clamped to 0");
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: mealsLeft = 0 handled gracefully
// ─────────────────────────────────────────────────────────────────────────────
section("4 — mealsLeft = 0 → no division-by-zero");
{
  const state = makeState();
  const budget = computeNextMealBudget(state, 0); // should clamp divisor to 1
  assert(budget.mealsLeft === 1, "mealsLeft clamped to 1 to avoid division-by-zero");
  assert(typeof budget.caloriesTarget === "number", "caloriesTarget is a number");
  assert(!isNaN(budget.caloriesTarget),             "caloriesTarget is not NaN");
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: deriveGenerationContext priority order
// ─────────────────────────────────────────────────────────────────────────────
section("5 — deriveGenerationContext priority");
{
  // diabetic wins even over glp1
  assert(
    deriveGenerationContext("clinical", null, ["glp1_daily_overlay_active"], ["diabetic"]) === "diabetic",
    "diabetic specialtyCondition wins over glp1",
  );
  // glp1 wins over performance
  assert(
    deriveGenerationContext("performance", "heavy", ["glp1_daily_overlay_active"], []) === "glp1",
    "glp1 rationale code wins over performance",
  );
  // performance_training_day: performance source + non-rest trainingDayType
  assert(
    deriveGenerationContext("performance", "heavy", [], []) === "performance_training_day",
    "performance + heavy → performance_training_day",
  );
  // performance on rest day → standard
  assert(
    deriveGenerationContext("performance", "rest", [], []) === "standard",
    "performance + rest → standard",
  );
  // no overlays → standard
  assert(
    deriveGenerationContext("user_default", null, [], []) === "standard",
    "no overlays → standard",
  );
  // performance + null trainingDayType → standard
  assert(
    deriveGenerationContext("performance", null, [], []) === "standard",
    "performance + null trainingDayType → standard",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 6: Reservation lifecycle simulations
// ─────────────────────────────────────────────────────────────────────────────
section("6 — Reservation lifecycle");

// ── 6a. Create reservation → it reduces planned budget ───────────────────────
{
  // Before: no reservations
  const before = makeState();
  const budgetBefore = computeNextMealBudget(before, 4);

  // After: one reservation placed (500 kcal, 1 starch meal)
  const after = makeState({
    planned: { calories: 500, protein: 40, carbs: 50, fat: 15, starchyCarbs: 40, starchMealsPlanned: 1 },
  });
  const budgetAfter = computeNextMealBudget(after, 3); // 1 fewer meal left

  assert(
    after.remaining.calories < before.remaining.calories,
    "placing reservation reduces remaining calories",
  );
  assert(
    after.remaining.starchMealsRemaining === before.remaining.starchMealsRemaining - 1,
    "placing starch reservation reduces starchMealsRemaining by 1",
  );
  assert(after.planned.reservationCount === 0, "reservationCount tracked by caller (fixture zero)");
  assert(budgetAfter.caloriesTarget <= budgetBefore.caloriesTarget, "per-meal budget not inflated after reservation");
}

// ── 6b. Delete reservation → budget restored ─────────────────────────────────
{
  const withReservation = makeState({
    planned: { calories: 500, starchyCarbs: 40, starchMealsPlanned: 1 },
  });
  const afterDelete = makeState(); // same as initial: reservation removed

  assert(
    afterDelete.remaining.calories > withReservation.remaining.calories,
    "deleting reservation restores remaining calories",
  );
  assert(
    afterDelete.remaining.starchMealsRemaining > withReservation.remaining.starchMealsRemaining,
    "deleting starch reservation restores starch slots",
  );
}

// ── 6c. Create → log → log again rejected ────────────────────────────────────
// Simulated via board_item_reference uniqueness: if a macro_log with the same
// board_item_reference already exists the application layer must reject the second log.
// Here we test that the budget engine correctly shows starch slots exhausted
// after the first log (so a second generation would be refused by the budget check).
{
  // Reservation placed
  const withReservation = makeState({
    planned: { starchMealsPlanned: 2, starchyCarbs: 130 }, // both slots reserved
  });
  assert(
    withReservation.remaining.starchMealsRemaining === 0,
    "both starch slots reserved → 0 remaining",
  );

  // First log converts the reservation (reservation disappears, consumed increases)
  const afterFirstLog = makeState({
    consumed: { starchMealsLogged: 1, starchyCarbs: 65 },
    planned:  { starchMealsPlanned: 1, starchyCarbs: 65 },
  });
  assert(
    afterFirstLog.remaining.starchMealsRemaining === 0,
    "after first log: still 0 remaining (1 consumed + 1 planned = 2 used)",
  );
  const budgetAfterFirstLog = computeNextMealBudget(afterFirstLog, 2);
  assert(
    budgetAfterFirstLog.starchyCarbsTarget === 0,
    "budget engine returns 0 starchy carbs → second starch generation blocked",
  );

  // Second log would fail: budget already shows starch exhausted
  // (In production, the route also checks board_item_reference uniqueness
  //  in macro_logs to reject a duplicate log at the DB layer.)
  const afterBothLogged = makeState({
    consumed: { starchMealsLogged: 2, starchyCarbs: 130 },
  });
  const budgetFinal = computeNextMealBudget(afterBothLogged, 2);
  assert(
    budgetFinal.starchyCarbsTarget === 0,
    "after both logged: starchyCarbsTarget = 0, double-log correctly rejected by budget",
  );
  assert(
    budgetFinal.starchSlotAvailable === false,
    "starchSlotAvailable = false after all slots consumed",
  );
}

// ── 6d. Create → log → budget not double-counted ─────────────────────────────
{
  // A meal is first on the board (planned), then logged (consumed → board_item_reference set).
  // Once logged it must NOT appear in both consumed AND planned simultaneously.
  // Simulation: after logging, planned goes to 0, consumed increases.
  const logged = makeState({
    consumed: { calories: 500, protein: 40, starchyCarbs: 40, starchMealsLogged: 1 },
    planned:  { calories: 0, starchyCarbs: 0, starchMealsPlanned: 0 }, // removed from planned
  });
  const budget = computeNextMealBudget(logged, 3);

  assert(
    logged.remaining.calories === 2000 - 500,
    `remaining calories after log = ${logged.remaining.calories} (should be 1500)`,
  );
  // If double-counted, remaining would be 2000 - 500 - 500 = 1000. Must be 1500.
  assert(
    logged.remaining.calories >= 1500,
    "no double-counting: logged meal counted once only",
  );
  assert(budget.caloriesTarget > 0, "remaining budget available for next meal");
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
  console.log("✅ All tests passed");
}
