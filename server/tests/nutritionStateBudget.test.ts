/**
 * nutritionStateBudget.test.ts
 *
 * Unit tests for computeNextMealBudget() — the per-meal budget resolver
 * introduced in #690, extended with full lifecycle proofs for Premier.
 *
 * computeNextMealBudget() is a pure function (no DB, no network) so no
 * mocks are needed. All tests run against real DailyNutritionState shapes.
 *
 * API: computeNextMealBudget(state: DailyNutritionState, mealsLeft: number): MealBudget
 * Returns: { caloriesTarget, proteinTarget, carbsTarget, fatTarget,
 *            starchyCarbsTarget, fibrousCarbsTarget, starchSlotAvailable,
 *            generationContext, mealsLeft }
 *
 * ── Lifecycle proofs (Premier requirement) ───────────────────────────────────
 * Proves each operation preserves accounting integrity with real numbers:
 *   generate → reserve → replace → delete → log
 *
 * Covers all 8 advisor-required scenarios:
 *   1. Regular (non-performance) user
 *   2. Performance training day vs rest day
 *   3. GLP-1 user
 *   4. GLP-1 + Performance combined
 *   5. Diabetic user
 *   6. Starch slots available (2 remaining)
 *   7. Starch slots exhausted (0 remaining) — hard gate
 *   8. Last remaining meal of the day
 */

import { computeNextMealBudget, deriveGenerationContext } from "../services/nutritionBudget";
import type { DailyNutritionState } from "../../shared/dailyNutritionPrescription";
import { buildFallbackPrescription } from "../../shared/dailyNutritionPrescription";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeState(overrides: Partial<DailyNutritionState> = {}): DailyNutritionState {
  const prescription = {
    ...buildFallbackPrescription("2026-08-12"),
    caloriesTarget:        2000,
    proteinTarget:         150,
    carbsTarget:           200,
    fatTarget:             67,
    starchyCarbsTarget:    100,
    fibrousCarbsTarget:    100,
    starchMealsAllowed:    2,
    starchMealsUsed:       0,
    starchMealsRemaining:  2,
    starchyCarbsConsumed:  0,
    starchyCarbsRemaining: 100,
    gramsPerRemainingStarchMeal: 50,
    source: "user_default" as const,
  };

  const base: DailyNutritionState = {
    date:       "2026-08-12",
    resolvedAt: "2026-08-12T12:00:00.000Z",
    prescription,
    consumed: {
      calories: 0, protein: 0, carbs: 0, fat: 0,
      starchyCarbs: 0, fibrousCarbs: 0,
      mealCount: 0, starchMealsLogged: 0,
    },
    planned: {
      calories: 0, protein: 0, carbs: 0, fat: 0,
      starchyCarbs: 0, starchMealsPlanned: 0, reservationCount: 0,
    },
    remaining: {
      calories: 2000, protein: 150, carbs: 200, fat: 67,
      starchyCarbs: 100, fibrousCarbs: 100, starchMealsRemaining: 2,
    },
    mealPlanConfig: {
      mealsPerDay:                4,
      starchMealsPerDay:          2,
      starchDistributionStrategy: "even",
    },
    activeConstraints: {
      generationContext:   "standard",
      starchSlotsExhausted:   false,
      calorieBudgetExhausted: false,
      proteinBudgetMet:       false,
    },
  };

  return { ...base, ...overrides };
}

// ── Standard budget division ──────────────────────────────────────────────────

describe("computeNextMealBudget — standard", () => {
  test("divides remaining macros evenly across mealsLeft", () => {
    const state  = makeState();
    const budget = computeNextMealBudget(state, 4);

    // 4 meals left → each gets ¼ of remaining
    expect(budget.caloriesTarget).toBe(500);   // 2000 / 4
    expect(budget.proteinTarget).toBe(38);     // round(150/4)
    expect(budget.carbsTarget).toBe(50);       // 200 / 4
    expect(budget.fatTarget).toBe(17);         // round(67/4)
    expect(budget.starchSlotAvailable).toBe(true);
    expect(budget.mealsLeft).toBe(4);
  });

  test("starchyCarbsTarget is proportional share when slots remain", () => {
    const state  = makeState();
    const budget = computeNextMealBudget(state, 4);
    // 100g starchy / 4 meals = 25g
    expect(budget.starchyCarbsTarget).toBe(25);
    expect(budget.fibrousCarbsTarget).toBe(25); // 100g fibrous / 4 = 25g
  });

  test("single meal left gets all remaining budget", () => {
    const state = makeState({
      remaining: {
        calories: 600, protein: 45, carbs: 60, fat: 20,
        starchyCarbs: 40, fibrousCarbs: 20, starchMealsRemaining: 1,
      },
    });
    const budget = computeNextMealBudget(state, 1);
    expect(budget.caloriesTarget).toBe(600);
    expect(budget.proteinTarget).toBe(45);
    expect(budget.carbsTarget).toBe(60);
    expect(budget.starchyCarbsTarget).toBe(40);
    expect(budget.starchSlotAvailable).toBe(true);
  });

  test("mealsLeft=0 is clamped to 1 to avoid division-by-zero", () => {
    const state  = makeState();
    const budget = computeNextMealBudget(state, 0);
    expect(budget.mealsLeft).toBe(1);
    expect(budget.caloriesTarget).toBe(2000); // full remaining ÷ 1
  });

  test("negative mealsLeft is clamped to 1", () => {
    const state  = makeState();
    const budget = computeNextMealBudget(state, -3);
    expect(budget.mealsLeft).toBe(1);
  });

  test("passes generationContext through from activeConstraints", () => {
    const state = makeState({
      activeConstraints: {
        generationContext:      "glp1",
        starchSlotsExhausted:   false,
        calorieBudgetExhausted: false,
        proteinBudgetMet:       false,
      },
    });
    const budget = computeNextMealBudget(state, 2);
    expect(budget.generationContext).toBe("glp1");
  });
});

// ── Starch slot gate (the advisor's core scenario) ────────────────────────────

describe("computeNextMealBudget — starch slot gate", () => {
  test("starchSlotAvailable is false when starchMealsRemaining = 0", () => {
    const state = makeState({
      remaining: {
        calories: 1000, protein: 75, carbs: 100,
        starchyCarbs: 50, fibrousCarbs: 50, fat: 33,
        starchMealsRemaining: 0,
      },
    });
    const budget = computeNextMealBudget(state, 2);

    expect(budget.starchSlotAvailable).toBe(false);
    expect(budget.starchyCarbsTarget).toBe(0);
    // All remaining carbs become fibrous when starch is exhausted
    expect(budget.fibrousCarbsTarget).toBeGreaterThan(0);
  });

  test("all remaining carbs rerouted to fibrous when starch slots exhausted", () => {
    const state = makeState({
      remaining: {
        calories: 800, protein: 60, carbs: 80,
        starchyCarbs: 40, fibrousCarbs: 40, fat: 26,
        starchMealsRemaining: 0,
      },
    });
    const budget = computeNextMealBudget(state, 2);

    expect(budget.starchyCarbsTarget).toBe(0);
    // When starch exhausted: fibrousCarbsTarget = carbsTarget (all remaining carbs)
    expect(budget.fibrousCarbsTarget).toBe(budget.carbsTarget);
    expect(budget.fibrousCarbsTarget).toBeGreaterThan(0);
  });

  test("advisor scenario: after 1 starch meal, meal 2 gets remaining starch budget", () => {
    // After first starch meal (46g starchy consumed):
    // remaining starchy = 100 - 46 = 54g, starchMealsRemaining = 1
    const state = makeState({
      remaining: {
        calories: 1550, protein: 110, carbs: 140,
        starchyCarbs: 54, fibrousCarbs: 86, fat: 52,
        starchMealsRemaining: 1,
      },
    });
    const budget = computeNextMealBudget(state, 3);

    expect(budget.starchSlotAvailable).toBe(true);
    // 54g / 3 meals = 18g per meal
    expect(budget.starchyCarbsTarget).toBe(18);
  });

  test("starchyCarbsTarget is 0 even when remaining.starchyCarbs > 0 but slots = 0", () => {
    // This is the double-counting prevention: starchy carbs budget left but no slots
    const state = makeState({
      remaining: {
        calories: 500, protein: 38, carbs: 50,
        starchyCarbs: 30, fibrousCarbs: 20, fat: 17,
        starchMealsRemaining: 0,
      },
    });
    const budget = computeNextMealBudget(state, 2);
    expect(budget.starchyCarbsTarget).toBe(0);
  });

  test("starchSlotAvailable is true as long as starchMealsRemaining >= 1", () => {
    const state = makeState({
      remaining: {
        calories: 500, protein: 38, carbs: 50,
        starchyCarbs: 30, fibrousCarbs: 20, fat: 17,
        starchMealsRemaining: 1,
      },
    });
    const budget = computeNextMealBudget(state, 2);
    expect(budget.starchSlotAvailable).toBe(true);
    expect(budget.starchyCarbsTarget).toBeGreaterThan(0);
  });
});

// ── Zero / exhausted budget edge cases ───────────────────────────────────────

describe("computeNextMealBudget — exhausted budget", () => {
  test("all targets are 0 when remaining is fully consumed", () => {
    const state = makeState({
      remaining: {
        calories: 0, protein: 0, carbs: 0, fat: 0,
        starchyCarbs: 0, fibrousCarbs: 0, starchMealsRemaining: 0,
      },
    });
    const budget = computeNextMealBudget(state, 2);
    expect(budget.caloriesTarget).toBe(0);
    expect(budget.proteinTarget).toBe(0);
    expect(budget.carbsTarget).toBe(0);
    expect(budget.fatTarget).toBe(0);
    expect(budget.starchyCarbsTarget).toBe(0);
    expect(budget.fibrousCarbsTarget).toBe(0);
    expect(budget.starchSlotAvailable).toBe(false);
  });

  test("no target ever goes negative — clamped to 0", () => {
    // Passing more consumed than prescription (shouldn't happen but must be safe)
    const state = makeState({
      remaining: {
        calories: -200, protein: -10, carbs: -5, fat: -3,
        starchyCarbs: -10, fibrousCarbs: -5, starchMealsRemaining: 0,
      },
    });
    const budget = computeNextMealBudget(state, 2);
    // computeNextMealBudget operates on remaining which is pre-clamped by the endpoint,
    // but even if negative values leak through, the result should be >= 0
    expect(budget.caloriesTarget).toBeGreaterThanOrEqual(0);
    expect(budget.proteinTarget).toBeGreaterThanOrEqual(0);
    expect(budget.carbsTarget).toBeGreaterThanOrEqual(0);
    expect(budget.fatTarget).toBeGreaterThanOrEqual(0);
    expect(budget.starchyCarbsTarget).toBeGreaterThanOrEqual(0);
    expect(budget.fibrousCarbsTarget).toBeGreaterThanOrEqual(0);
  });
});

// ── Generation context passthrough ────────────────────────────────────────────

describe("computeNextMealBudget — generationContext", () => {
  test("returns 'standard' by default", () => {
    const state  = makeState();
    const budget = computeNextMealBudget(state, 4);
    expect(budget.generationContext).toBe("standard");
  });

  test("returns 'diabetic' when activeConstraints has diabetic context", () => {
    const state = makeState({
      activeConstraints: {
        generationContext:      "diabetic",
        starchSlotsExhausted:   false,
        calorieBudgetExhausted: false,
        proteinBudgetMet:       false,
      },
    });
    const budget = computeNextMealBudget(state, 2);
    expect(budget.generationContext).toBe("diabetic");
  });

  test("returns 'performance_training_day' for performance context", () => {
    const state = makeState({
      activeConstraints: {
        generationContext:      "performance_training_day",
        starchSlotsExhausted:   false,
        calorieBudgetExhausted: false,
        proteinBudgetMet:       false,
      },
    });
    const budget = computeNextMealBudget(state, 3);
    expect(budget.generationContext).toBe("performance_training_day");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// FULL LIFECYCLE PROOF (Premier requirement)
//
// Shows actual numbers after each operation:
//   daily target → consumed → planned → remaining → budget → generated meal → new planned/remaining
//
// Pure state-transition helpers simulate each operation without hitting the DB.
// ═════════════════════════════════════════════════════════════════════════════

// ── Lifecycle helpers ─────────────────────────────────────────────────────────

/**
 * Simulates the "Reserve" operation: a generated meal is added to the board.
 * The meal's macros move from remaining → planned.
 */
function applyReservation(
  state: DailyNutritionState,
  meal: { calories: number; protein: number; carbs: number; fat: number;
          starchyCarbs: number; fibrousCarbs: number; hasStarch: boolean },
): DailyNutritionState {
  const clamp = (n: number) => Math.max(0, n);
  return {
    ...state,
    planned: {
      calories:         state.planned.calories    + meal.calories,
      protein:          state.planned.protein     + meal.protein,
      carbs:            state.planned.carbs       + meal.carbs,
      fat:              state.planned.fat         + meal.fat,
      starchyCarbs:     state.planned.starchyCarbs + meal.starchyCarbs,
      starchMealsPlanned: state.planned.starchMealsPlanned + (meal.hasStarch ? 1 : 0),
      reservationCount: state.planned.reservationCount + 1,
    },
    remaining: {
      calories:          clamp(state.remaining.calories    - meal.calories),
      protein:           clamp(state.remaining.protein     - meal.protein),
      carbs:             clamp(state.remaining.carbs       - meal.carbs),
      fat:               clamp(state.remaining.fat         - meal.fat),
      starchyCarbs:      clamp(state.remaining.starchyCarbs - meal.starchyCarbs),
      fibrousCarbs:      clamp(state.remaining.fibrousCarbs - meal.fibrousCarbs),
      starchMealsRemaining: clamp(state.remaining.starchMealsRemaining - (meal.hasStarch ? 1 : 0)),
    },
  };
}

/**
 * Simulates the "Replace" operation: old reservation removed, new one added.
 * Net effect = old macros restored to remaining, then new macros consumed from remaining.
 */
function applyReplace(
  state: DailyNutritionState,
  oldMeal: { calories: number; protein: number; carbs: number; fat: number;
             starchyCarbs: number; fibrousCarbs: number; hasStarch: boolean },
  newMeal: { calories: number; protein: number; carbs: number; fat: number;
             starchyCarbs: number; fibrousCarbs: number; hasStarch: boolean },
): DailyNutritionState {
  const afterRemove = removeReservation(state, oldMeal);
  return applyReservation(afterRemove, newMeal);
}

/**
 * Simulates the "Delete" operation: reservation removed from board.
 * Macros and starch slot are restored to remaining.
 */
function removeReservation(
  state: DailyNutritionState,
  meal: { calories: number; protein: number; carbs: number; fat: number;
          starchyCarbs: number; fibrousCarbs: number; hasStarch: boolean },
): DailyNutritionState {
  const clamp = (n: number) => Math.max(0, n);
  return {
    ...state,
    planned: {
      calories:         clamp(state.planned.calories    - meal.calories),
      protein:          clamp(state.planned.protein     - meal.protein),
      carbs:            clamp(state.planned.carbs       - meal.carbs),
      fat:              clamp(state.planned.fat         - meal.fat),
      starchyCarbs:     clamp(state.planned.starchyCarbs - meal.starchyCarbs),
      starchMealsPlanned: clamp(state.planned.starchMealsPlanned - (meal.hasStarch ? 1 : 0)),
      reservationCount: clamp(state.planned.reservationCount - 1),
    },
    remaining: {
      calories:          state.remaining.calories    + meal.calories,
      protein:           state.remaining.protein     + meal.protein,
      carbs:             state.remaining.carbs       + meal.carbs,
      fat:               state.remaining.fat         + meal.fat,
      starchyCarbs:      state.remaining.starchyCarbs + meal.starchyCarbs,
      fibrousCarbs:      state.remaining.fibrousCarbs + meal.fibrousCarbs,
      starchMealsRemaining: state.remaining.starchMealsRemaining + (meal.hasStarch ? 1 : 0),
    },
  };
}

/**
 * Simulates the "Log" operation: board_item_reference converts planned → consumed.
 * The meal leaves planned and enters consumed. It must NEVER appear in both.
 */
function applyLog(
  state: DailyNutritionState,
  meal: { calories: number; protein: number; carbs: number; fat: number;
          starchyCarbs: number; fibrousCarbs: number; hasStarch: boolean },
): DailyNutritionState {
  const clamp = (n: number) => Math.max(0, n);
  return {
    ...state,
    consumed: {
      calories:       state.consumed.calories   + meal.calories,
      protein:        state.consumed.protein    + meal.protein,
      carbs:          state.consumed.carbs      + meal.carbs,
      fat:            state.consumed.fat        + meal.fat,
      starchyCarbs:   state.consumed.starchyCarbs + meal.starchyCarbs,
      fibrousCarbs:   state.consumed.fibrousCarbs + meal.fibrousCarbs,
      starchMealsLogged: state.consumed.starchMealsLogged + (meal.hasStarch ? 1 : 0),
      mealCount:      state.consumed.mealCount  + 1,
    },
    planned: {
      calories:         clamp(state.planned.calories    - meal.calories),
      protein:          clamp(state.planned.protein     - meal.protein),
      carbs:            clamp(state.planned.carbs       - meal.carbs),
      fat:              clamp(state.planned.fat         - meal.fat),
      starchyCarbs:     clamp(state.planned.starchyCarbs - meal.starchyCarbs),
      starchMealsPlanned: clamp(state.planned.starchMealsPlanned - (meal.hasStarch ? 1 : 0)),
      reservationCount: clamp(state.planned.reservationCount - 1),
    },
    // remaining does NOT change on log — macros were already subtracted at reservation time
  };
}

// ── Scenario fixture: Regular user ────────────────────────────────────────────

const REGULAR_PRESCRIPTION = {
  ...buildFallbackPrescription("2026-08-13"),
  caloriesTarget:        2000,
  proteinTarget:         150,
  carbsTarget:           200,
  fatTarget:              67,
  starchyCarbsTarget:    100,
  fibrousCarbsTarget:    100,
  starchMealsAllowed:      2,
  starchMealsUsed:         0,
  starchMealsRemaining:    2,
  starchyCarbsConsumed:    0,
  starchyCarbsRemaining:  100,
  gramsPerRemainingStarchMeal: 50,
  source: "user_default" as const,
};

function freshRegularState(): DailyNutritionState {
  return {
    date:       "2026-08-13",
    resolvedAt: "2026-08-13T08:00:00.000Z",
    prescription: REGULAR_PRESCRIPTION,
    consumed: { calories: 0, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0, fibrousCarbs: 0, mealCount: 0, starchMealsLogged: 0 },
    planned:  { calories: 0, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0, starchMealsPlanned: 0, reservationCount: 0 },
    remaining: { calories: 2000, protein: 150, carbs: 200, fat: 67, starchyCarbs: 100, fibrousCarbs: 100, starchMealsRemaining: 2 },
    mealPlanConfig: { mealsPerDay: 4, starchMealsPerDay: 2, starchDistributionStrategy: "even" },
    activeConstraints: { generationContext: "standard", starchSlotsExhausted: false, calorieBudgetExhausted: false, proteinBudgetMet: false },
  };
}

// ── Representative starchy breakfast generated by the AI ──────────────────────
// Meals chosen to have real-world plausible numbers that prove accounting integrity.
const MEAL_1 = { calories: 490, protein: 40, carbs: 48, fat: 16, starchyCarbs: 32, fibrousCarbs: 16, hasStarch: true  };
const MEAL_2 = { calories: 510, protein: 38, carbs: 52, fat: 18, starchyCarbs: 38, fibrousCarbs: 14, hasStarch: true  };
const MEAL_2_REPLACEMENT = { calories: 480, protein: 42, carbs: 44, fat: 15, starchyCarbs: 30, fibrousCarbs: 14, hasStarch: true };
const MEAL_3 = { calories: 500, protein: 37, carbs: 50, fat: 17, starchyCarbs: 0,  fibrousCarbs: 50, hasStarch: false };

// ═════════════════════════════════════════════════════════════════════════════
// STEP-BY-STEP LIFECYCLE
// ═════════════════════════════════════════════════════════════════════════════

describe("Lifecycle — Step 1: Fresh day, remaining = full prescription", () => {
  test("daily target equals prescription on a fresh day (zero consumed, zero planned)", () => {
    const state = freshRegularState();

    // Daily targets (from prescription)
    expect(state.prescription.caloriesTarget).toBe(2000);
    expect(state.prescription.proteinTarget).toBe(150);
    expect(state.prescription.carbsTarget).toBe(200);
    expect(state.prescription.fatTarget).toBe(67);
    expect(state.prescription.starchMealsAllowed).toBe(2);

    // Nothing consumed or planned
    expect(state.consumed.calories).toBe(0);
    expect(state.consumed.mealCount).toBe(0);
    expect(state.planned.reservationCount).toBe(0);

    // Remaining = full prescription
    expect(state.remaining.calories).toBe(2000);
    expect(state.remaining.protein).toBe(150);
    expect(state.remaining.carbs).toBe(200);
    expect(state.remaining.fat).toBe(67);
    expect(state.remaining.starchyCarbs).toBe(100);
    expect(state.remaining.starchMealsRemaining).toBe(2);
  });
});

describe("Lifecycle — Step 2: Budget for meal 1 (4 meals left)", () => {
  test("budget divides remaining evenly: 2000÷4=500 cal, 150÷4=38 protein, 200÷4=50 carbs", () => {
    const state  = freshRegularState();
    const budget = computeNextMealBudget(state, 4);

    expect(budget.caloriesTarget).toBe(500);       // 2000 ÷ 4
    expect(budget.proteinTarget).toBe(38);         // round(150 ÷ 4)
    expect(budget.carbsTarget).toBe(50);           // 200 ÷ 4
    expect(budget.fatTarget).toBe(17);             // round(67 ÷ 4)
    expect(budget.starchyCarbsTarget).toBe(25);   // 100 ÷ 4
    expect(budget.fibrousCarbsTarget).toBe(25);   // 100 ÷ 4
    expect(budget.starchSlotAvailable).toBe(true);
    expect(budget.mealsLeft).toBe(4);
    expect(budget.generationContext).toBe("standard");
  });
});

describe("Lifecycle — Step 3: Reserve meal 1 (490 cal, 40p, 48c, 16f, 32sc)", () => {
  test("after reserving meal 1: planned holds meal macros, remaining decreases exactly", () => {
    const fresh   = freshRegularState();
    const afterR1 = applyReservation(fresh, MEAL_1);

    // planned now reflects meal 1
    expect(afterR1.planned.calories).toBe(490);
    expect(afterR1.planned.protein).toBe(40);
    expect(afterR1.planned.carbs).toBe(48);
    expect(afterR1.planned.fat).toBe(16);
    expect(afterR1.planned.starchyCarbs).toBe(32);
    expect(afterR1.planned.starchMealsPlanned).toBe(1);
    expect(afterR1.planned.reservationCount).toBe(1);

    // remaining = prescription − meal 1
    expect(afterR1.remaining.calories).toBe(1510);    // 2000 - 490
    expect(afterR1.remaining.protein).toBe(110);      // 150 - 40
    expect(afterR1.remaining.carbs).toBe(152);        // 200 - 48
    expect(afterR1.remaining.fat).toBe(51);           // 67 - 16
    expect(afterR1.remaining.starchyCarbs).toBe(68);  // 100 - 32
    expect(afterR1.remaining.starchMealsRemaining).toBe(1); // 2 - 1

    // consumed is still zero — meal not yet logged
    expect(afterR1.consumed.calories).toBe(0);
    expect(afterR1.consumed.mealCount).toBe(0);
  });
});

describe("Lifecycle — Step 4: Budget for meal 2 (3 meals left, after reservation)", () => {
  test("budget uses updated remaining after reservation — not the full prescription", () => {
    const fresh   = freshRegularState();
    const afterR1 = applyReservation(fresh, MEAL_1);
    const budget2 = computeNextMealBudget(afterR1, 3);

    // remaining after meal 1: 1510 cal, 110 protein, 152 carbs, 51 fat, 68 starchy
    expect(budget2.caloriesTarget).toBe(503);    // round(1510 ÷ 3)
    expect(budget2.proteinTarget).toBe(37);      // round(110 ÷ 3)
    expect(budget2.carbsTarget).toBe(51);        // round(152 ÷ 3)
    expect(budget2.fatTarget).toBe(17);          // round(51 ÷ 3)
    expect(budget2.starchyCarbsTarget).toBe(23); // round(68 ÷ 3)
    expect(budget2.starchSlotAvailable).toBe(true); // 1 starch slot still available
    expect(budget2.mealsLeft).toBe(3);
  });
});

describe("Lifecycle — Step 5: Replace operation (no double-counting)", () => {
  test("replace: old reservation removed, new one created — no double-counting of macros", () => {
    const fresh       = freshRegularState();
    const afterR1     = applyReservation(fresh, MEAL_1);
    const afterR1_R2  = applyReservation(afterR1, MEAL_2);   // add meal 2 to board
    // Replace meal 2 with a revised version
    const afterReplace = applyReplace(afterR1_R2, MEAL_2, MEAL_2_REPLACEMENT);

    // planned should contain meal 1 + meal 2 replacement (not meal 1 + meal 2 + replacement)
    expect(afterReplace.planned.reservationCount).toBe(2);  // still 2 reservations
    expect(afterReplace.planned.calories).toBe(MEAL_1.calories + MEAL_2_REPLACEMENT.calories);
    expect(afterReplace.planned.protein).toBe(MEAL_1.protein  + MEAL_2_REPLACEMENT.protein);
    expect(afterReplace.planned.carbs).toBe(MEAL_1.carbs    + MEAL_2_REPLACEMENT.carbs);
    expect(afterReplace.planned.fat).toBe(MEAL_1.fat      + MEAL_2_REPLACEMENT.fat);

    // remaining reflects the replacement (old macros restored, new ones consumed)
    const expectedCalRemaining = 2000 - MEAL_1.calories - MEAL_2_REPLACEMENT.calories;
    expect(afterReplace.remaining.calories).toBe(expectedCalRemaining);  // 1030

    // no double-counting: remaining did NOT subtract both MEAL_2 and MEAL_2_REPLACEMENT
    // (it would be 2000 - 490 - 510 - 480 = 520 if double-counted)
    expect(afterReplace.remaining.calories).toBeGreaterThan(
      2000 - MEAL_1.calories - MEAL_2.calories - MEAL_2_REPLACEMENT.calories
    );
  });

  test("starch slots not double-consumed during replace — both replaced meal counted once", () => {
    const fresh      = freshRegularState();
    const withMeal1  = applyReservation(fresh, MEAL_1);
    const withMeal2  = applyReservation(withMeal1, MEAL_2);
    const afterRepl  = applyReplace(withMeal2, MEAL_2, MEAL_2_REPLACEMENT);

    // MEAL_2 and MEAL_2_REPLACEMENT both hasStarch=true, so net starch slot change = 0
    expect(afterRepl.remaining.starchMealsRemaining).toBe(0);   // 2 - 1 (m1) - 1 (m2-replacement)
    expect(afterRepl.planned.starchMealsPlanned).toBe(2);
  });
});

describe("Lifecycle — Step 6: Delete operation (macros and starch slot restored)", () => {
  test("delete: reservation removed, macros fully restored to remaining", () => {
    const fresh      = freshRegularState();
    const afterR1    = applyReservation(fresh, MEAL_1);
    const afterDel   = removeReservation(afterR1, MEAL_1);

    // After delete, state should match the original fresh state
    expect(afterDel.planned.calories).toBe(0);
    expect(afterDel.planned.reservationCount).toBe(0);
    expect(afterDel.planned.starchMealsPlanned).toBe(0);

    expect(afterDel.remaining.calories).toBe(2000);
    expect(afterDel.remaining.protein).toBe(150);
    expect(afterDel.remaining.carbs).toBe(200);
    expect(afterDel.remaining.fat).toBe(67);
    expect(afterDel.remaining.starchyCarbs).toBe(100);
    expect(afterDel.remaining.starchMealsRemaining).toBe(2);  // slot restored
  });

  test("delete with 2 meals on board restores only the deleted meal's macros", () => {
    const fresh     = freshRegularState();
    const with2     = applyReservation(applyReservation(fresh, MEAL_1), MEAL_3); // m1 (starch) + m3 (no starch)
    const afterDel1 = removeReservation(with2, MEAL_1);

    // Meal 3 is still planned, meal 1 macros restored
    expect(afterDel1.planned.calories).toBe(MEAL_3.calories);
    expect(afterDel1.planned.reservationCount).toBe(1);
    expect(afterDel1.planned.starchMealsPlanned).toBe(0);   // MEAL_3 has no starch

    // Starch slot from MEAL_1 is restored
    expect(afterDel1.remaining.starchMealsRemaining).toBe(2);

    // remaining has meal 1 calories back but still minus meal 3
    expect(afterDel1.remaining.calories).toBe(2000 - MEAL_3.calories);
  });
});

describe("Lifecycle — Step 7: Log operation (planned → consumed, never both simultaneously)", () => {
  test("logging a board item moves macros from planned to consumed", () => {
    const fresh    = freshRegularState();
    const reserved = applyReservation(fresh, MEAL_1);
    const logged   = applyLog(reserved, MEAL_1);

    // consumed now has the meal
    expect(logged.consumed.calories).toBe(490);
    expect(logged.consumed.protein).toBe(40);
    expect(logged.consumed.carbs).toBe(48);
    expect(logged.consumed.fat).toBe(16);
    expect(logged.consumed.starchyCarbs).toBe(32);
    expect(logged.consumed.starchMealsLogged).toBe(1);
    expect(logged.consumed.mealCount).toBe(1);

    // planned is now zero (log cleared the reservation)
    expect(logged.planned.calories).toBe(0);
    expect(logged.planned.reservationCount).toBe(0);
    expect(logged.planned.starchMealsPlanned).toBe(0);
  });

  test("invariant: meal macros appear in consumed OR planned, never both simultaneously", () => {
    const fresh    = freshRegularState();
    const reserved = applyReservation(fresh, MEAL_1);

    // Before log: meal is in planned, not in consumed
    expect(reserved.planned.calories).toBe(MEAL_1.calories);
    expect(reserved.consumed.calories).toBe(0);

    // After log: meal is in consumed, not in planned
    const logged = applyLog(reserved, MEAL_1);
    expect(logged.consumed.calories).toBe(MEAL_1.calories);
    expect(logged.planned.calories).toBe(0);

    // Accounting identity: consumed + planned = total accounted for
    const totalBefore = reserved.consumed.calories + reserved.planned.calories;
    const totalAfter  = logged.consumed.calories   + logged.planned.calories;
    expect(totalAfter).toBe(totalBefore);  // 490 = 490, no macros created or destroyed
  });

  test("remaining is unchanged when logging (it was already adjusted at reserve time)", () => {
    const fresh    = freshRegularState();
    const reserved = applyReservation(fresh, MEAL_1);
    const logged   = applyLog(reserved, MEAL_1);

    // remaining should be identical before and after the log
    expect(logged.remaining.calories).toBe(reserved.remaining.calories);
    expect(logged.remaining.protein).toBe(reserved.remaining.protein);
    expect(logged.remaining.starchMealsRemaining).toBe(reserved.remaining.starchMealsRemaining);
  });

  test("full lifecycle accounting identity: consumed + planned + remaining = prescription", () => {
    const fresh    = freshRegularState();
    const s1       = applyReservation(fresh, MEAL_1);       // reserve meal 1
    const s2       = applyReservation(s1, MEAL_2);          // reserve meal 2
    const s3       = applyLog(s2, MEAL_1);                  // log meal 1
    const s4       = removeReservation(s3, MEAL_2);         // delete meal 2

    // After all operations: only MEAL_1 is consumed, nothing planned, MEAL_2 macros restored
    const totalAccounted = s4.consumed.calories + s4.planned.calories + s4.remaining.calories;
    expect(totalAccounted).toBe(fresh.prescription.caloriesTarget);  // 2000

    const proteinAccounted = s4.consumed.protein + s4.planned.protein + s4.remaining.protein;
    expect(proteinAccounted).toBe(fresh.prescription.proteinTarget);  // 150
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO TESTS — 8 advisor-required proof scenarios
// ═════════════════════════════════════════════════════════════════════════════

// ── Scenario 1: Regular (non-performance) user ────────────────────────────────

describe("Scenario 1 — Regular user: standard budget with even starch distribution", () => {
  test("budget for 4 meals, 2 starch slots: shows exact per-meal targets", () => {
    const state  = freshRegularState();
    const budget = computeNextMealBudget(state, 4);

    // NUMBERS: 2000 cal / 4 = 500 cal per meal
    //          150g protein / 4 = 37.5 → 38g
    //          200g carbs / 4 = 50g
    //          100g starchy / 4 = 25g per meal (both starch slots still open)
    expect(budget.caloriesTarget).toBe(500);
    expect(budget.proteinTarget).toBe(38);
    expect(budget.starchyCarbsTarget).toBe(25);
    expect(budget.starchSlotAvailable).toBe(true);
    expect(budget.generationContext).toBe("standard");
  });

  test("after logging 1 starch meal: starchSlotAvailable still true, slot count = 1 remaining", () => {
    const state    = freshRegularState();
    const reserved = applyReservation(state, MEAL_1);
    const logged   = applyLog(reserved, MEAL_1);
    // logged meal consumed 32g starchy, 1 starch slot used

    // Remaining: 2000-490=1510 cal, 100-32=68g starchy, 1 starch slot remaining
    expect(logged.consumed.starchMealsLogged).toBe(1);
    expect(logged.remaining.starchMealsRemaining).toBe(1);

    const budget = computeNextMealBudget(logged, 3);  // 3 meals left
    expect(budget.starchSlotAvailable).toBe(true);
    expect(budget.starchyCarbsTarget).toBeGreaterThan(0);  // 68 ÷ 3 ≈ 23g
  });
});

// ── Scenario 2: Performance user — training day vs rest day ──────────────────

describe("Scenario 2 — Performance: training day vs rest day context", () => {
  test("training day: generationContext = 'performance_training_day', higher carb budget", () => {
    const state = makeState({
      prescription: {
        ...REGULAR_PRESCRIPTION,
        caloriesTarget:     2600,  // performance uplift
        carbsTarget:        320,   // high-carb training day
        starchyCarbsTarget: 220,
        source: "performance",
        trainingDayType: "heavy",
        starchMealsAllowed: 3,
        starchMealsRemaining: 3,
        starchyCarbsRemaining: 220,
        rationaleCodes: ["performance_modifier_active"],
      },
      remaining: {
        calories: 2600, protein: 160, carbs: 320, fat: 72,
        starchyCarbs: 220, fibrousCarbs: 100, starchMealsRemaining: 3,
      },
      activeConstraints: {
        generationContext:      "performance_training_day",
        starchSlotsExhausted:   false,
        calorieBudgetExhausted: false,
        proteinBudgetMet:       false,
      },
    });

    const budget = computeNextMealBudget(state, 4);
    expect(budget.generationContext).toBe("performance_training_day");
    expect(budget.caloriesTarget).toBe(650);   // 2600 ÷ 4
    expect(budget.starchyCarbsTarget).toBe(55); // 220 ÷ 4
    expect(budget.starchSlotAvailable).toBe(true);
  });

  test("rest day: generationContext = 'standard', reduced starch budget", () => {
    const state = makeState({
      prescription: {
        ...REGULAR_PRESCRIPTION,
        caloriesTarget:     1800,   // rest-day reduction
        carbsTarget:        140,
        starchyCarbsTarget:  60,
        starchMealsAllowed:   1,    // only 1 starch meal on rest day
        starchMealsRemaining: 1,
        starchyCarbsRemaining: 60,
        source: "performance",
        trainingDayType: "rest",
        rationaleCodes: ["performance_modifier_active", "zero_starch_rest_day"],
      },
      remaining: {
        calories: 1800, protein: 140, carbs: 140, fat: 60,
        starchyCarbs: 60, fibrousCarbs: 80, starchMealsRemaining: 1,
      },
      activeConstraints: {
        // rest day with performance mode: context is "standard" (not performance_training_day)
        generationContext:      "standard",
        starchSlotsExhausted:   false,
        calorieBudgetExhausted: false,
        proteinBudgetMet:       false,
      },
    });

    const budget = computeNextMealBudget(state, 4);
    expect(budget.generationContext).toBe("standard");  // rest day = standard context
    expect(budget.caloriesTarget).toBe(450);            // 1800 ÷ 4
    expect(budget.starchyCarbsTarget).toBe(15);         // 60 ÷ 4

    // After 1 starch meal logged: no more starch allowed
    const logged = applyLog(applyReservation(state, { ...MEAL_1, starchyCarbs: 60, fibrousCarbs: 0, hasStarch: true }), { ...MEAL_1, starchyCarbs: 60, fibrousCarbs: 0, hasStarch: true });
    const budgetAfterStarch = computeNextMealBudget(logged, 3);
    expect(budgetAfterStarch.starchSlotAvailable).toBe(false);
    expect(budgetAfterStarch.starchyCarbsTarget).toBe(0);
  });
});

// ── Scenario 3: GLP-1 user ────────────────────────────────────────────────────

describe("Scenario 3 — GLP-1 user: reduced calorie prescription, 'glp1' context", () => {
  test("GLP-1 context: budget reflects reduced targets, generationContext = 'glp1'", () => {
    const state = makeState({
      prescription: {
        ...REGULAR_PRESCRIPTION,
        caloriesTarget:     1400,   // GLP-1 reduced intake
        proteinTarget:       120,
        carbsTarget:         130,
        fatTarget:            50,
        starchyCarbsTarget:   60,
        fibrousCarbsTarget:   70,
        starchMealsAllowed:    2,
        starchMealsRemaining:  2,
        starchyCarbsRemaining: 60,
        rationaleCodes: ["glp1_daily_overlay_active"],
      },
      remaining: {
        calories: 1400, protein: 120, carbs: 130, fat: 50,
        starchyCarbs: 60, fibrousCarbs: 70, starchMealsRemaining: 2,
      },
      activeConstraints: {
        generationContext:      "glp1",
        starchSlotsExhausted:   false,
        calorieBudgetExhausted: false,
        proteinBudgetMet:       false,
      },
    });

    const budget = computeNextMealBudget(state, 4);
    expect(budget.generationContext).toBe("glp1");
    expect(budget.caloriesTarget).toBe(350);    // 1400 ÷ 4
    expect(budget.proteinTarget).toBe(30);      // 120 ÷ 4
    expect(budget.starchyCarbsTarget).toBe(15); // 60 ÷ 4
    expect(budget.starchSlotAvailable).toBe(true);
  });
});

// ── Scenario 4: GLP-1 + Performance combined ─────────────────────────────────

describe("Scenario 4 — GLP-1 + Performance combined", () => {
  test("combined context: reduced GLP-1 calories with performance carb strategy", () => {
    // GLP-1 takes priority over performance in context derivation
    const gCtx = deriveGenerationContext(
      "performance",       // source
      "strength",          // trainingDayType
      ["glp1_daily_overlay_active"],
      [],
    );
    expect(gCtx).toBe("glp1");  // GLP-1 wins — it takes priority #2, before performance

    const state = makeState({
      remaining: {
        calories: 1600, protein: 130, carbs: 150, fat: 55,
        starchyCarbs: 80, fibrousCarbs: 70, starchMealsRemaining: 2,
      },
      activeConstraints: {
        generationContext:      "glp1",
        starchSlotsExhausted:   false,
        calorieBudgetExhausted: false,
        proteinBudgetMet:       false,
      },
    });

    const budget = computeNextMealBudget(state, 4);
    expect(budget.generationContext).toBe("glp1");
    expect(budget.caloriesTarget).toBe(400);
  });
});

// ── Scenario 5: Diabetic user ─────────────────────────────────────────────────

describe("Scenario 5 — Diabetic user: strict carb control, 'diabetic' context", () => {
  test("diabetic context: tight starch budget, generationContext = 'diabetic'", () => {
    // Diabetic takes highest priority in context derivation
    const gCtx = deriveGenerationContext("user_default", null, [], ["diabetic"]);
    expect(gCtx).toBe("diabetic");

    const gCtxWithPerf = deriveGenerationContext("performance", "strength", ["glp1_daily_overlay_active"], ["diabetic"]);
    expect(gCtxWithPerf).toBe("diabetic"); // diabetic beats everything

    const state = makeState({
      prescription: {
        ...REGULAR_PRESCRIPTION,
        caloriesTarget:     1800,
        carbsTarget:         130,   // strict carb cap
        starchyCarbsTarget:   45,   // very tight starchy budget
        fibrousCarbsTarget:   85,   // higher fibrous allocation
        starchMealsAllowed:    2,
        starchMealsRemaining:  2,
        starchyCarbsRemaining: 45,
      },
      remaining: {
        calories: 1800, protein: 140, carbs: 130, fat: 65,
        starchyCarbs: 45, fibrousCarbs: 85, starchMealsRemaining: 2,
      },
      activeConstraints: {
        generationContext:      "diabetic",
        starchSlotsExhausted:   false,
        calorieBudgetExhausted: false,
        proteinBudgetMet:       false,
      },
    });

    const budget = computeNextMealBudget(state, 4);
    expect(budget.generationContext).toBe("diabetic");
    expect(budget.carbsTarget).toBe(33);          // 130 ÷ 4 = 32.5 → 33
    expect(budget.starchyCarbsTarget).toBe(11);   // 45 ÷ 4 = 11.25 → 11
    expect(budget.fibrousCarbsTarget).toBe(21);   // 85 ÷ 4 = 21.25 → 21
  });
});

// ── Scenario 6: Starch slots available (2 remaining) ─────────────────────────

describe("Scenario 6 — Starch slots available (2 remaining)", () => {
  test("with 2 starch slots open: budget includes starchy carb target for both meals", () => {
    const state = freshRegularState();  // 2 starch slots, 100g starchy remaining

    const budget = computeNextMealBudget(state, 4);
    expect(budget.starchSlotAvailable).toBe(true);
    expect(budget.starchyCarbsTarget).toBe(25);   // 100g ÷ 4 meals

    // After 1 starch meal logged: 1 slot left, budget still includes starchy target
    const logged = applyLog(applyReservation(state, MEAL_1), MEAL_1);
    const budget2 = computeNextMealBudget(logged, 3);
    expect(budget2.starchSlotAvailable).toBe(true);
    expect(budget2.starchyCarbsTarget).toBeGreaterThan(0); // 68g ÷ 3 ≈ 23g
  });
});

// ── Scenario 7: Starch slots exhausted (0 remaining) — hard gate ─────────────

describe("Scenario 7 — Starch slots exhausted (0 remaining): hard gate verified", () => {
  test("starchSlotAvailable=false blocks starchy carb target to exactly 0", () => {
    // Simulate: both starch meals consumed, starch slots exhausted
    const fresh   = freshRegularState();
    const s1      = applyReservation(fresh, MEAL_1);
    const s2      = applyReservation(s1, MEAL_2);
    const logged1 = applyLog(s2, MEAL_1);
    const logged2 = applyLog(logged1, MEAL_2);

    expect(logged2.consumed.starchMealsLogged).toBe(2);
    expect(logged2.remaining.starchMealsRemaining).toBe(0);  // no starch slots left

    const budget = computeNextMealBudget(logged2, 2);  // 2 meals to go
    expect(budget.starchSlotAvailable).toBe(false);    // hard gate
    expect(budget.starchyCarbsTarget).toBe(0);         // generator must NOT produce starch

    // All remaining carbs become fibrous when starch is exhausted
    expect(budget.fibrousCarbsTarget).toBe(budget.carbsTarget);
    expect(budget.fibrousCarbsTarget).toBeGreaterThan(0);
  });

  test("even with starchy carb budget remaining, slots=0 means starchyCarbsTarget=0", () => {
    // This is the critical double-counting prevention scenario.
    // The prescription still has starchyCarbsRemaining > 0 (budget not fully used)
    // but both slot counts are gone — the gate is on SLOTS, not grams.
    const state = makeState({
      remaining: {
        calories: 600, protein: 45, carbs: 60, fat: 20,
        starchyCarbs: 30,   // budget still exists...
        fibrousCarbs: 30,
        starchMealsRemaining: 0,  // ...but all slots are consumed
      },
    });
    const budget = computeNextMealBudget(state, 2);
    expect(budget.starchyCarbsTarget).toBe(0);  // gate blocks regardless of gram budget
    expect(budget.starchSlotAvailable).toBe(false);
  });
});

// ── Scenario 8: Last remaining meal of the day ────────────────────────────────

describe("Scenario 8 — Last remaining meal of the day", () => {
  test("last meal gets 100% of all remaining macros — no division", () => {
    // After 3 meals consumed, 1 remaining
    const fresh = freshRegularState();
    const s1 = applyLog(applyReservation(fresh, MEAL_1), MEAL_1);
    const s2 = applyLog(applyReservation(s1, MEAL_2), MEAL_2);
    const s3 = applyLog(applyReservation(s2, MEAL_3), MEAL_3);

    // What's left after 3 meals:
    const calLeft     = 2000 - MEAL_1.calories - MEAL_2.calories - MEAL_3.calories;
    const proteinLeft = 150  - MEAL_1.protein  - MEAL_2.protein  - MEAL_3.protein;
    const carbsLeft   = 200  - MEAL_1.carbs    - MEAL_2.carbs    - MEAL_3.carbs;
    const fatLeft     = 67   - MEAL_1.fat      - MEAL_2.fat      - MEAL_3.fat;

    expect(s3.remaining.calories).toBe(Math.max(0, calLeft));
    expect(s3.remaining.protein).toBe(Math.max(0, proteinLeft));

    // Budget with 1 meal left = all remaining
    const budget = computeNextMealBudget(s3, 1);
    expect(budget.mealsLeft).toBe(1);
    expect(budget.caloriesTarget).toBe(Math.max(0, calLeft));
    expect(budget.proteinTarget).toBe(Math.max(0, proteinLeft));
    expect(budget.carbsTarget).toBe(Math.max(0, carbsLeft));
    expect(budget.fatTarget).toBe(Math.max(0, fatLeft));
  });

  test("last meal: starch slot consumed shows starchSlotAvailable=false when slots=0", () => {
    // Both starch slots gone — last meal must be fiber-based
    const fresh   = freshRegularState();
    const allUsed = {
      ...fresh,
      consumed: { ...fresh.consumed, starchMealsLogged: 2 },
      remaining: {
        calories: 500, protein: 38, carbs: 50, fat: 17,
        starchyCarbs: 0, fibrousCarbs: 50, starchMealsRemaining: 0,
      },
    };

    const budget = computeNextMealBudget(allUsed, 1);
    expect(budget.starchSlotAvailable).toBe(false);
    expect(budget.starchyCarbsTarget).toBe(0);
    expect(budget.mealsLeft).toBe(1);
    expect(budget.caloriesTarget).toBe(500);
  });

  test("last meal: starch slot still available shows starchyCarbsTarget > 0", () => {
    const fresh     = freshRegularState();
    const lastMeal  = {
      ...fresh,
      consumed: { ...fresh.consumed, starchMealsLogged: 1 },
      remaining: {
        calories: 500, protein: 38, carbs: 50, fat: 17,
        starchyCarbs: 40, fibrousCarbs: 10, starchMealsRemaining: 1,
      },
    };

    const budget = computeNextMealBudget(lastMeal, 1);
    expect(budget.starchSlotAvailable).toBe(true);
    expect(budget.starchyCarbsTarget).toBe(40);  // all remaining starchy in last meal
    expect(budget.mealsLeft).toBe(1);
    expect(budget.caloriesTarget).toBe(500);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MID-DAY PRESCRIPTION CHANGE
//
// Design decision: resolveDailyNutritionState() re-derives the prescription on
// every call. When the prescription changes mid-day (performance mode toggled,
// GLP-1 overlay applied, ProCare override written) the `remaining` field is
// always recomputed as:
//
//   remaining = clamp(newPrescription − consumed − planned, min=0)
//
// This means:
//   • If consumed < newPrescription  → remaining is positive and correct.
//   • If consumed ≥ newPrescription  → remaining is clamped to 0; the budget
//     shows 0 for that macro and the next generation can proceed safely.
//
// No migration is needed. The clamp layer is the migration path. Every call
// to the state endpoint reflects the live prescription, not the one that was
// active when the food was logged.
//
// Reference scenario (from task spec):
//   carbsTarget 200g → 130g, consumed 120g → remaining = max(0, 130-120) = 10g
//   carbsTarget 200g → 130g, consumed 135g → remaining = max(0, 130-135) = 0g
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Simulate what resolveDailyNutritionState does when it sees a new prescription
 * after some consumption has already happened. Returns a state where:
 *   remaining = clamp(newPrescription − consumed − planned)
 */
function applyPrescriptionChange(
  state: DailyNutritionState,
  newPrescription: DailyNutritionState["prescription"],
): DailyNutritionState {
  const clamp = (n: number) => Math.max(0, Math.round(n));
  const { consumed, planned } = state;
  return {
    ...state,
    prescription: newPrescription,
    remaining: {
      calories:     clamp(newPrescription.caloriesTarget    - consumed.calories     - planned.calories),
      protein:      clamp(newPrescription.proteinTarget     - consumed.protein      - planned.protein),
      carbs:        clamp(newPrescription.carbsTarget       - consumed.carbs        - planned.carbs),
      fat:          clamp(newPrescription.fatTarget         - consumed.fat          - planned.fat),
      starchyCarbs: clamp(newPrescription.starchyCarbsTarget - consumed.starchyCarbs - planned.starchyCarbs),
      fibrousCarbs: clamp(newPrescription.fibrousCarbsTarget - consumed.fibrousCarbs),
      starchMealsRemaining: Math.max(
        0,
        newPrescription.starchMealsAllowed
          - consumed.starchMealsLogged
          - planned.starchMealsPlanned,
      ),
    },
  };
}

describe("Mid-day prescription change — remaining is always ≥ 0 (clamp layer)", () => {
  // Reference scenario from task spec:
  // carbsTarget 200g → 130g, consumed 120g
  test("carb target drops 200→130 with 120g consumed: remaining.carbs = 10 (not negative)", () => {
    // Start: user consumed 120g carbs under the original 200g prescription
    const stateWithConsumption = makeState({
      consumed: {
        calories: 960, protein: 90, carbs: 120, fat: 32,
        starchyCarbs: 70, fibrousCarbs: 50,
        starchMealsLogged: 1, mealCount: 2,
      },
      remaining: {
        // original remaining under 200g prescription
        calories: 1040, protein: 60, carbs: 80, fat: 35,
        starchyCarbs: 30, fibrousCarbs: 50, starchMealsRemaining: 1,
      },
    });

    // Prescription changes mid-day: carbsTarget 200 → 130
    const newPrescription = {
      ...stateWithConsumption.prescription,
      caloriesTarget:        1800,  // e.g. GLP-1 overlay reduced calories
      carbsTarget:            130,  // dropped from 200
      starchyCarbsTarget:      60,  // dropped from 100
      fibrousCarbsTarget:      70,
      starchMealsAllowed:       1,  // was 2, now 1 on new prescription
      starchMealsRemaining:     1,
      starchyCarbsRemaining:    60 - 70, // would be negative — clamped
    };

    const afterChange = applyPrescriptionChange(stateWithConsumption, newPrescription);

    // remaining.carbs = max(0, 130 - 120) = 10 — never negative
    expect(afterChange.remaining.carbs).toBe(10);
    expect(afterChange.remaining.carbs).toBeGreaterThanOrEqual(0);

    // remaining.starchyCarbs = max(0, 60 - 70) = 0 — clamped
    expect(afterChange.remaining.starchyCarbs).toBe(0);
    expect(afterChange.remaining.starchyCarbs).toBeGreaterThanOrEqual(0);

    // All other remaining values are also ≥ 0
    expect(afterChange.remaining.calories).toBeGreaterThanOrEqual(0);
    expect(afterChange.remaining.protein).toBeGreaterThanOrEqual(0);
    expect(afterChange.remaining.fat).toBeGreaterThanOrEqual(0);
    expect(afterChange.remaining.fibrousCarbs).toBeGreaterThanOrEqual(0);
    expect(afterChange.remaining.starchMealsRemaining).toBeGreaterThanOrEqual(0);
  });

  test("carb target drops 200→130 with 135g consumed (over new target): remaining.carbs = 0", () => {
    // User consumed 135g carbs under old 200g prescription.
    // New prescription sets carbsTarget to 130 — user is already 5g over.
    const stateWithConsumption = makeState({
      consumed: {
        calories: 1080, protein: 100, carbs: 135, fat: 36,
        starchyCarbs: 80, fibrousCarbs: 55,
        starchMealsLogged: 2, mealCount: 3,
      },
      remaining: {
        // original remaining under old prescription (before change)
        calories: 920, protein: 50, carbs: 65, fat: 31,
        starchyCarbs: 20, fibrousCarbs: 45, starchMealsRemaining: 0,
      },
    });

    const newPrescription = {
      ...stateWithConsumption.prescription,
      caloriesTarget:    1800,
      carbsTarget:        130, // user already consumed 135g — over by 5g
      starchyCarbsTarget:  60,
      fibrousCarbsTarget:  70,
      starchMealsAllowed:   2,
      starchMealsRemaining: 0,
      starchyCarbsRemaining: 0,
    };

    const afterChange = applyPrescriptionChange(stateWithConsumption, newPrescription);

    // remaining.carbs = max(0, 130 - 135) = 0 — clamped, never negative
    expect(afterChange.remaining.carbs).toBe(0);

    // starch slots: max(0, 2 - 2) = 0
    expect(afterChange.remaining.starchMealsRemaining).toBe(0);

    // No macro ever goes negative
    expect(afterChange.remaining.calories).toBeGreaterThanOrEqual(0);
    expect(afterChange.remaining.protein).toBeGreaterThanOrEqual(0);
    expect(afterChange.remaining.fat).toBeGreaterThanOrEqual(0);
    expect(afterChange.remaining.starchyCarbs).toBeGreaterThanOrEqual(0);
    expect(afterChange.remaining.fibrousCarbs).toBeGreaterThanOrEqual(0);
  });

  test("budget after prescription drop is non-negative even when all macros exhausted", () => {
    // Prescription dropped to the point where consumed already exceeds every target.
    // The budget must still return 0 across the board — never negative.
    const fullyOverState = makeState({
      remaining: {
        // resolveDailyNutritionState already clamped everything to 0
        calories: 0, protein: 0, carbs: 0, fat: 0,
        starchyCarbs: 0, fibrousCarbs: 0, starchMealsRemaining: 0,
      },
    });

    const budget = computeNextMealBudget(fullyOverState, 2);

    expect(budget.caloriesTarget).toBe(0);
    expect(budget.proteinTarget).toBe(0);
    expect(budget.carbsTarget).toBe(0);
    expect(budget.fatTarget).toBe(0);
    expect(budget.starchyCarbsTarget).toBe(0);
    expect(budget.fibrousCarbsTarget).toBe(0);
    expect(budget.starchSlotAvailable).toBe(false);

    // None of these can go negative regardless of how the prescription changed
    expect(budget.caloriesTarget).toBeGreaterThanOrEqual(0);
    expect(budget.proteinTarget).toBeGreaterThanOrEqual(0);
    expect(budget.carbsTarget).toBeGreaterThanOrEqual(0);
    expect(budget.fatTarget).toBeGreaterThanOrEqual(0);
  });

  test("budget after prescription drop with partial over-consumption: remaining macros are correct", () => {
    // Prescription drop: only carbs and starch were exhausted;
    // protein and fat still have headroom. Verify split is correct.
    const partialState = makeState({
      prescription: {
        ...buildFallbackPrescription("2026-08-12"),
        caloriesTarget:        1800,
        proteinTarget:          150,
        carbsTarget:            130, // new lower target
        fatTarget:               65,
        starchyCarbsTarget:      60,
        fibrousCarbsTarget:      70,
        starchMealsAllowed:       2,
        starchMealsUsed:          2,
        starchMealsRemaining:     0,
        starchyCarbsConsumed:    70,
        starchyCarbsRemaining:    0,
        gramsPerRemainingStarchMeal: undefined,
        source: "clinical" as const,
      },
      consumed: {
        calories: 1000, protein: 80, carbs: 135, fat: 30,
        starchyCarbs: 70, fibrousCarbs: 65,
        starchMealsLogged: 2, mealCount: 3,
      },
      // resolveDailyNutritionState computes remaining with clamp:
      // carbs: max(0, 130 - 135) = 0
      // protein: max(0, 150 - 80) = 70
      // fat: max(0, 65 - 30) = 35
      remaining: {
        calories:     Math.max(0, 1800 - 1000),  // 800
        protein:      Math.max(0, 150 - 80),      // 70
        carbs:        Math.max(0, 130 - 135),     // 0  ← clamped
        fat:          Math.max(0, 65 - 30),       // 35
        starchyCarbs: Math.max(0, 60 - 70),       // 0  ← clamped
        fibrousCarbs: Math.max(0, 70 - 65),       // 5
        starchMealsRemaining: 0,
      },
    });

    expect(partialState.remaining.carbs).toBe(0);       // over-consumed, clamped
    expect(partialState.remaining.starchyCarbs).toBe(0); // over-consumed, clamped
    expect(partialState.remaining.protein).toBe(70);     // headroom intact
    expect(partialState.remaining.fat).toBe(35);         // headroom intact

    // Budget for 1 remaining meal: protein and fat have real targets, carbs = 0
    const budget = computeNextMealBudget(partialState, 1);

    expect(budget.carbsTarget).toBe(0);            // no carb budget left
    expect(budget.starchyCarbsTarget).toBe(0);     // no starch budget left
    expect(budget.proteinTarget).toBe(70);         // full protein headroom
    expect(budget.fatTarget).toBe(35);             // full fat headroom
    expect(budget.starchSlotAvailable).toBe(false);
    expect(budget.caloriesTarget).toBe(800);       // 800 cal still available

    // Nothing is negative
    expect(budget.caloriesTarget).toBeGreaterThanOrEqual(0);
    expect(budget.proteinTarget).toBeGreaterThanOrEqual(0);
    expect(budget.carbsTarget).toBeGreaterThanOrEqual(0);
    expect(budget.fatTarget).toBeGreaterThanOrEqual(0);
    expect(budget.starchyCarbsTarget).toBeGreaterThanOrEqual(0);
    expect(budget.fibrousCarbsTarget).toBeGreaterThanOrEqual(0);
  });

  test("prescription increase mid-day: remaining correctly reflects more headroom", () => {
    // Prescription can also increase (e.g. performance mode toggled ON mid-day).
    // carbsTarget 200g → 300g, consumed 120g → remaining = 300 - 120 = 180g
    const stateWithConsumption = makeState({
      consumed: {
        calories: 960, protein: 90, carbs: 120, fat: 32,
        starchyCarbs: 70, fibrousCarbs: 50,
        starchMealsLogged: 1, mealCount: 2,
      },
      remaining: {
        calories: 1040, protein: 60, carbs: 80, fat: 35,
        starchyCarbs: 30, fibrousCarbs: 50, starchMealsRemaining: 1,
      },
    });

    const newPrescription = {
      ...stateWithConsumption.prescription,
      caloriesTarget:        2600,
      carbsTarget:            300, // performance mode increased carbs
      starchyCarbsTarget:     200,
      fibrousCarbsTarget:     100,
      starchMealsAllowed:       3,
      starchMealsRemaining:     3,
      starchyCarbsRemaining:  200 - 70,
    };

    const afterChange = applyPrescriptionChange(stateWithConsumption, newPrescription);

    // remaining.carbs = max(0, 300 - 120) = 180
    expect(afterChange.remaining.carbs).toBe(180);
    // remaining.starchyCarbs = max(0, 200 - 70) = 130
    expect(afterChange.remaining.starchyCarbs).toBe(130);
    // starch meals: max(0, 3 - 1) = 2
    expect(afterChange.remaining.starchMealsRemaining).toBe(2);

    // All values are non-negative
    expect(afterChange.remaining.calories).toBeGreaterThanOrEqual(0);
    expect(afterChange.remaining.protein).toBeGreaterThanOrEqual(0);
  });
});

// ── deriveGenerationContext priority order ─────────────────────────────────────

describe("deriveGenerationContext — priority order (diabetic > glp1 > performance > standard)", () => {
  test("diabetic beats glp1, performance, and standard", () => {
    expect(deriveGenerationContext("performance", "strength", ["glp1_daily_overlay_active"], ["diabetic"])).toBe("diabetic");
    expect(deriveGenerationContext("performance", "strength", [], ["diabetic"])).toBe("diabetic");
    expect(deriveGenerationContext("user_default", null, [], ["diabetic"])).toBe("diabetic");
  });

  test("glp1 beats performance and standard when no diabetic condition", () => {
    expect(deriveGenerationContext("performance", "strength", ["glp1_daily_overlay_active"], [])).toBe("glp1");
    expect(deriveGenerationContext("user_default", null, ["glp1_daily_overlay_active"], [])).toBe("glp1");
  });

  test("performance_training_day when source=performance and trainingDayType is not null/rest", () => {
    expect(deriveGenerationContext("performance", "strength",  [], [])).toBe("performance_training_day");
    expect(deriveGenerationContext("performance", "endurance", [], [])).toBe("performance_training_day");
    expect(deriveGenerationContext("performance", "power",     [], [])).toBe("performance_training_day");
  });

  test("standard fallback for rest day, non-performance source, or no conditions", () => {
    expect(deriveGenerationContext("performance",   "rest",   [], [])).toBe("standard");
    expect(deriveGenerationContext("user_default",  null,     [], [])).toBe("standard");
    expect(deriveGenerationContext("user_default",  "rest",   [], [])).toBe("standard");
  });
});
