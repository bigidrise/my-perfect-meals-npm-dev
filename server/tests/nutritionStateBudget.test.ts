/**
 * nutritionStateBudget.test.ts
 *
 * Unit tests for computeNextMealBudget() — the per-meal budget resolver
 * introduced in #690.
 *
 * computeNextMealBudget() is a pure function (no DB, no network) so no
 * mocks are needed. All tests run against real DailyNutritionState shapes.
 *
 * API: computeNextMealBudget(state: DailyNutritionState, mealsLeft: number): MealBudget
 * Returns: { caloriesTarget, proteinTarget, carbsTarget, fatTarget,
 *            starchyCarbsTarget, fibrousCarbsTarget, starchSlotAvailable,
 *            generationContext, mealsLeft }
 */

import { computeNextMealBudget } from "../services/nutritionBudget";
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
