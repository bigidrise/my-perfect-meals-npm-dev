/**
 * nutritionStateBudget.test.ts
 *
 * Unit tests for computeNextMealBudget() — the per-meal budget resolver
 * introduced in #690.
 *
 * computeNextMealBudget() is a pure function (no DB, no network) so no
 * mocks are needed. All tests run against real DailyNutritionState shapes.
 */

import { computeNextMealBudget } from "../services/nutritionBudget";
import type {
  DailyNutritionState,
  MealContext,
} from "../../shared/dailyNutritionPrescription";
import { buildFallbackPrescription } from "../../shared/dailyNutritionPrescription";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeState(overrides: Partial<DailyNutritionState> = {}): DailyNutritionState {
  const base = buildFallbackPrescription("2026-08-12");
  const prescription = {
    ...base,
    caloriesTarget:    2000,
    proteinTarget:     150,
    carbsTarget:       200,
    fatTarget:         67,
    starchyCarbsTarget: 100,
    fibrousCarbsTarget: 100,
    starchMealsAllowed: 2,
    starchMealsUsed:    0,
    starchMealsRemaining: 2,
    starchyCarbsConsumed: 0,
    starchyCarbsRemaining: 100,
    gramsPerRemainingStarchMeal: 50,
    source: "user_default" as const,
  };

  const zeros = {
    calories: 0, protein: 0, totalCarbs: 0,
    starchyCarbs: 0, fibrousCarbs: 0, fat: 0,
    starchMeals: 0, mealCount: 0,
  };

  return {
    date: "2026-08-12",
    resolvedPrescription: prescription,
    consumed: { ...zeros },
    planned:  { ...zeros },
    remaining: {
      calories: 2000, protein: 150, totalCarbs: 200,
      starchyCarbs: 100, fibrousCarbs: 100, fat: 67,
      starchMeals: 2, nonStarchMeals: 2,
    },
    mealPlan: {
      mealsPerDay:          4,
      mealsConsumed:        0,
      mealsPlanned:         0,
      mealsRemaining:       4,
      starchMealsPerDay:    2,
      starchMealsConsumed:  0,
      starchMealsPlanned:   0,
      starchMealsRemaining: 2,
      starchDistributionStrategy: "even",
      gramsPerRemainingStarchMeal: 50,
      isZeroStarchDay: false,
    },
    activeConstraints: {
      performanceActive: false,
      glp1Active:        false,
      diabeticActive:    false,
      clinicalActive:    false,
      procareActive:     false,
    },
    ...overrides,
  };
}

const standardContext: MealContext = {
  generationContext: "standard",
  mealIndex: 0,
};

// ── Standard budget division ──────────────────────────────────────────────────

describe("computeNextMealBudget — standard", () => {
  test("divides remaining equally across mealsRemaining", () => {
    const state  = makeState();
    const budget = computeNextMealBudget(state, standardContext);

    // 4 meals left → each gets ¼ of remaining
    expect(budget.caloriesBudget).toBe(500);   // 2000 / 4
    expect(budget.proteinBudget).toBe(38);     // round(150/4)
    expect(budget.carbsBudget).toBe(50);       // 200 / 4
    expect(budget.fatBudget).toBe(17);         // round(67/4)
    expect(budget.starchAllowed).toBe(true);
    expect(budget.mealsRemaining).toBe(4);
    expect(budget.starchMealsRemaining).toBe(2);
    expect(budget.clinicalNotes).toHaveLength(0);
  });

  test("starchyBudget capped to gramsPerRemainingStarchMeal when over adaptive target", () => {
    // gramsPerRemainingStarchMeal = 50, but even split of 100g / 4 meals = 25g
    // — below the cap so no cap fires in default state
    const state  = makeState();
    const budget = computeNextMealBudget(state, standardContext);
    expect(budget.starchyBudget).toBe(25); // 100/4, under 50g cap → no cap note
    expect(budget.clinicalNotes).not.toContain("starchy_carbs_capped_to_adaptive_per_meal_target");
  });

  test("starchyBudget is capped when per-meal share exceeds adaptive target", () => {
    // Only 1 meal remaining but 100g starchy carbs left (50g was already used).
    // gramsPerRemainingStarchMeal = 50 (100g / 2 starch slots remaining).
    // Even split = 100g / 1 meal = 100g — exceeds the 50g adaptive cap.
    const state = makeState({
      remaining: {
        calories: 500, protein: 38, totalCarbs: 100,
        starchyCarbs: 100, fibrousCarbs: 0, fat: 17,
        starchMeals: 2, nonStarchMeals: 0,
      },
      mealPlan: {
        mealsPerDay: 4, mealsConsumed: 3, mealsPlanned: 0, mealsRemaining: 1,
        starchMealsPerDay: 2, starchMealsConsumed: 0, starchMealsPlanned: 0,
        starchMealsRemaining: 2,
        starchDistributionStrategy: "even",
        gramsPerRemainingStarchMeal: 50,
        isZeroStarchDay: false,
      },
    });
    const budget = computeNextMealBudget(state, standardContext);
    expect(budget.starchyBudget).toBe(50);
    expect(budget.fibrousBudget).toBe(50); // excess rerouted
    expect(budget.clinicalNotes).toContain("starchy_carbs_capped_to_adaptive_per_meal_target");
  });
});

// ── Starch slot gate (the advisor's core scenario) ────────────────────────────

describe("computeNextMealBudget — starch slot gate", () => {
  test("starchAllowed is false when starchMealsRemaining = 0", () => {
    const state = makeState({
      remaining: {
        calories: 1000, protein: 75, totalCarbs: 100,
        starchyCarbs: 50, fibrousCarbs: 50, fat: 33,
        starchMeals: 0, nonStarchMeals: 2,
      },
      mealPlan: {
        mealsPerDay: 4, mealsConsumed: 2, mealsPlanned: 0, mealsRemaining: 2,
        starchMealsPerDay: 2, starchMealsConsumed: 2, starchMealsPlanned: 0,
        starchMealsRemaining: 0,
        starchDistributionStrategy: "even",
        gramsPerRemainingStarchMeal: undefined,
        isZeroStarchDay: false,
      },
    });
    const budget = computeNextMealBudget(state, standardContext);

    expect(budget.starchAllowed).toBe(false);
    expect(budget.starchyBudget).toBe(0);
    // Rerouted to fibrous: 50/2 = 25g starchy → fibrous (50/2 base + 25 rerouted = 50)
    expect(budget.fibrousBudget).toBeGreaterThan(0);
    expect(budget.clinicalNotes).toContain("starch_slots_exhausted_rerouted_to_fibrous");
  });

  test("advisor scenario: 100g starchy, 2 starch meals, meal 1 uses 46g → meal 2 gets ~54g", () => {
    // After first starch meal (46g starchy consumed):
    // remaining starchy = 100 - 46 = 54g, starchMealsRemaining = 1
    // gramsPerRemainingStarchMeal = 54g (all remaining for the last slot)
    const state = makeState({
      consumed: {
        calories: 450, protein: 40, totalCarbs: 60,
        starchyCarbs: 46, fibrousCarbs: 14, fat: 15,
        starchMeals: 1, mealCount: 1,
      },
      remaining: {
        calories: 1550, protein: 110, totalCarbs: 140,
        starchyCarbs: 54, fibrousCarbs: 86, fat: 52,
        starchMeals: 1, nonStarchMeals: 2,
      },
      mealPlan: {
        mealsPerDay: 4, mealsConsumed: 1, mealsPlanned: 0, mealsRemaining: 3,
        starchMealsPerDay: 2, starchMealsConsumed: 1, starchMealsPlanned: 0,
        starchMealsRemaining: 1,
        starchDistributionStrategy: "even",
        gramsPerRemainingStarchMeal: 54, // all remaining starchy for the last slot
        isZeroStarchDay: false,
      },
      resolvedPrescription: {
        ...buildFallbackPrescription("2026-08-12"),
        caloriesTarget: 2000, proteinTarget: 150, carbsTarget: 200,
        fatTarget: 67, starchyCarbsTarget: 100, fibrousCarbsTarget: 100,
        starchMealsAllowed: 2, starchMealsUsed: 1, starchMealsRemaining: 1,
        starchyCarbsConsumed: 46, starchyCarbsRemaining: 54,
        gramsPerRemainingStarchMeal: 54,
        source: "user_default" as const,
      },
    });
    const budget = computeNextMealBudget(state, { ...standardContext, mealIndex: 1 });

    // Next starch meal should get approximately 54g (the adaptive target)
    expect(budget.starchAllowed).toBe(true);
    expect(budget.starchyBudget).toBeLessThanOrEqual(54);
    expect(budget.starchyBudget).toBeGreaterThan(0);
    expect(budget.starchMealsRemaining).toBe(1);
  });

  test("after second starch meal accepted, starchMealsRemaining = 0 → next request gets 0", () => {
    const state = makeState({
      remaining: {
        calories: 1100, protein: 72, totalCarbs: 80,
        starchyCarbs: 0, fibrousCarbs: 80, fat: 35,
        starchMeals: 0, nonStarchMeals: 2,
      },
      mealPlan: {
        mealsPerDay: 4, mealsConsumed: 2, mealsPlanned: 0, mealsRemaining: 2,
        starchMealsPerDay: 2, starchMealsConsumed: 2, starchMealsPlanned: 0,
        starchMealsRemaining: 0,
        starchDistributionStrategy: "even",
        gramsPerRemainingStarchMeal: undefined,
        isZeroStarchDay: false,
      },
    });
    const budget = computeNextMealBudget(state, { ...standardContext, mealIndex: 2 });

    expect(budget.starchAllowed).toBe(false);
    expect(budget.starchyBudget).toBe(0);
    // Fibrous budget gets the rerouted starchy grams (0g since starchyCarbs remaining = 0)
    expect(budget.clinicalNotes).not.toContain("starch_slots_exhausted_rerouted_to_fibrous");
  });
});

// ── Meals exhausted ───────────────────────────────────────────────────────────

describe("computeNextMealBudget — meals exhausted", () => {
  test("mealsRemaining = 0 → uses divisor of 1 (not NaN/Infinity), budgets reflect full remaining", () => {
    const state = makeState({
      remaining: {
        calories: 200, protein: 20, totalCarbs: 25,
        starchyCarbs: 10, fibrousCarbs: 15, fat: 5,
        starchMeals: 1, nonStarchMeals: 0,
      },
      mealPlan: {
        mealsPerDay: 4, mealsConsumed: 4, mealsPlanned: 0, mealsRemaining: 0,
        starchMealsPerDay: 2, starchMealsConsumed: 2, starchMealsPlanned: 0,
        starchMealsRemaining: 1,
        starchDistributionStrategy: "even",
        gramsPerRemainingStarchMeal: 10,
        isZeroStarchDay: false,
      },
    });
    const budget = computeNextMealBudget(state, standardContext);

    // mealsLeft is clamped to 1 when 0 → budgets equal remaining totals
    expect(budget.caloriesBudget).toBe(200);
    expect(budget.mealsRemaining).toBe(0);
    expect(isNaN(budget.caloriesBudget)).toBe(false);
    expect(isFinite(budget.caloriesBudget)).toBe(true);
  });
});

// ── Clinical ceilings ─────────────────────────────────────────────────────────

describe("computeNextMealBudget — diabetic carb ceiling", () => {
  test("caps carbs at 35g and reroutes excess to protein", () => {
    const state = makeState({
      activeConstraints: {
        performanceActive: false, glp1Active: false,
        diabeticActive: true, clinicalActive: false, procareActive: false,
      },
      // remaining carbs / 4 meals = 200/4 = 50g → exceeds 35g ceiling
    });
    const budget = computeNextMealBudget(state, {
      generationContext: "diabetic",
      mealIndex: 0,
    });

    expect(budget.carbsBudget).toBe(35);
    // Excess 15g carbs rerouted to protein
    expect(budget.proteinBudget).toBe(Math.round(150 / 4) + 15);
    expect(budget.clinicalNotes).toContain("diabetic_carb_ceiling_applied_35g");
  });

  test("does not fire when carbs per meal is already under 35g", () => {
    const state = makeState({
      remaining: {
        calories: 500, protein: 38, totalCarbs: 100,
        starchyCarbs: 50, fibrousCarbs: 50, fat: 17,
        starchMeals: 2, nonStarchMeals: 2,
      },
      activeConstraints: {
        performanceActive: false, glp1Active: false,
        diabeticActive: true, clinicalActive: false, procareActive: false,
      },
      mealPlan: {
        mealsPerDay: 4, mealsConsumed: 0, mealsPlanned: 0, mealsRemaining: 4,
        starchMealsPerDay: 2, starchMealsConsumed: 0, starchMealsPlanned: 0,
        starchMealsRemaining: 2,
        starchDistributionStrategy: "even",
        gramsPerRemainingStarchMeal: 50,
        isZeroStarchDay: false,
      },
    });
    const budget = computeNextMealBudget(state, { generationContext: "diabetic", mealIndex: 0 });

    // 100g / 4 meals = 25g — already under ceiling
    expect(budget.carbsBudget).toBe(25);
    expect(budget.clinicalNotes).not.toContain("diabetic_carb_ceiling_applied_35g");
  });
});

describe("computeNextMealBudget — GLP-1 fat ceiling", () => {
  test("caps fat per meal to fatTarget / mealsPerDay", () => {
    const state = makeState({
      // 67g fat / 4 meals = 16.75 → 17g ceiling per meal
      // But remaining.fat / mealsRemaining = 67/4 ≈ 17g — right at the ceiling
      // To trigger it, reduce mealsRemaining so per-meal share > ceiling
      remaining: {
        calories: 1000, protein: 75, totalCarbs: 100,
        starchyCarbs: 50, fibrousCarbs: 50, fat: 67, // full day fat remaining
        starchMeals: 2, nonStarchMeals: 0,
      },
      mealPlan: {
        mealsPerDay: 4, mealsConsumed: 2, mealsPlanned: 0, mealsRemaining: 2,
        starchMealsPerDay: 2, starchMealsConsumed: 0, starchMealsPlanned: 0,
        starchMealsRemaining: 2,
        starchDistributionStrategy: "even",
        gramsPerRemainingStarchMeal: 50,
        isZeroStarchDay: false,
      },
      activeConstraints: {
        performanceActive: false, glp1Active: true,
        diabeticActive: false, clinicalActive: false, procareActive: false,
      },
    });
    const budget = computeNextMealBudget(state, { generationContext: "glp1", mealIndex: 2 });

    // per-meal share = 67/2 = 33.5g; fat ceiling = 67/4 = 16.75 → 17g
    expect(budget.fatBudget).toBe(17); // capped at fatTarget / mealsPerDay
    expect(budget.clinicalNotes).toContain("glp1_per_meal_fat_ceiling_applied");
  });
});

// ── Floor enforcement ─────────────────────────────────────────────────────────

describe("computeNextMealBudget — floors", () => {
  test("all budgets are ≥ 0 even when remaining is negative (edge case)", () => {
    const state = makeState({
      remaining: {
        calories: -100, protein: -50, totalCarbs: -30,
        starchyCarbs: -20, fibrousCarbs: -10, fat: -5,
        starchMeals: 0, nonStarchMeals: 1,
      },
    });
    const budget = computeNextMealBudget(state, standardContext);

    expect(budget.caloriesBudget).toBeGreaterThanOrEqual(0);
    expect(budget.proteinBudget).toBeGreaterThanOrEqual(0);
    expect(budget.carbsBudget).toBeGreaterThanOrEqual(0);
    expect(budget.fatBudget).toBeGreaterThanOrEqual(0);
    expect(budget.starchyBudget).toBeGreaterThanOrEqual(0);
    expect(budget.fibrousBudget).toBeGreaterThanOrEqual(0);
  });
});
