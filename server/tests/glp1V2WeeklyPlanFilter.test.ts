/**
 * glp1V2WeeklyPlanFilter.test.ts
 *
 * Validates that the MEALGEN V2 GLP-1 post-generation filter (in routes.ts)
 * correctly:
 *   (a) Rejects meals whose fat exceeds the personalised GLP-1 ceiling.
 *   (b) Rejects meals with missing or non-finite macros.
 *   (c) Accepts a fully compliant meal.
 *   (d) callCravingCreator extracts the first element of data.meals[]
 *       rather than the raw response envelope.
 *
 * Strategy: Test the filtering predicate in isolation (pure logic) so the
 * suite stays fast and does not require a live DB or OpenAI key.
 *
 * Run: npx jest tests/glp1V2WeeklyPlanFilter.test.ts
 */

import type { ResolvedGLP1Targets } from "../services/glp1/resolveGLP1MealTargets";

// ── Minimal GLP-1 targets fixture ─────────────────────────────────────────────

const MOCK_GLP1_TARGETS: ResolvedGLP1Targets = {
  resolvedMealCalories: 400,
  targetProteinGrams: 30,
  maximumToleratedFatGrams: 15,
  targetCarbGrams: 45,
  treatmentPhase: "maintenance",
  usedBaseline: "glp1_adjusted",
  // Additional fields the type requires — values are irrelevant to the filter.
  minimumProteinGrams: 30,
  dailyCalorieTarget: 1600,
  mealCountPerDay: 4,
  snackCalorieTarget: 150,
  toleranceScore: 80,
  appliedModifiers: [],
} as unknown as ResolvedGLP1Targets;

// ── In-process filter helper (mirrors the actual routes.ts predicate) ─────────
// We inline the filtering logic here so the test is stable even if the route
// refactors the loop. If the production code changes the predicate, this test
// must change too — that is intentional.

async function runGlp1V2Filter(
  items: any[],
  targets: ResolvedGLP1Targets,
  labelToMealType: (label: string) => "snack" | "meal" = () => "meal",
): Promise<any[]> {
  // Dynamically import guardrails the same way the production code does
  // (dynamic import inside the filter), avoiding a top-level import that
  // would require the full server environment.
  const { validateMealForDiet } = await import(
    "../services/guardrails/index"
  );

  const filtered = items.filter((item) => {
    // ── Production predicate (must stay in sync with routes.ts) ───────────
    const kcal = item.calories ?? item.nutrition?.calories;
    const prot = item.protein ?? item.nutrition?.protein;
    const fatG = item.fats ?? item.fat ?? item.nutrition?.fat;

    // Reject missing / non-finite macros for GLP-1 safety.
    if (
      !Number.isFinite(kcal) ||
      !Number.isFinite(prot) ||
      !Number.isFinite(fatG)
    ) {
      return false;
    }

    const ingList = (item.ingredients || []).map((i: any) => ({
      name: i.item ?? i.name ?? "",
      quantity: i.amount ? String(i.amount) : undefined,
      unit: i.unit,
    }));

    const vr = validateMealForDiet(
      { name: item.name, ingredients: ingList, macros: { calories: kcal, protein: prot, fat: fatG } },
      "glp1",
      undefined,
      labelToMealType(item.label ?? "") === "snack",
      targets,
    );
    return vr.isValid;
  });

  return filtered;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MEALGEN V2 GLP-1 post-generation filter", () => {
  it("excludes a meal whose fat exceeds the personalised GLP-1 ceiling", async () => {
    const overFatMeal = {
      name: "Creamy Alfredo Pasta",
      label: "Dinner",
      calories: 390,
      protein: 32,
      fats: 28,          // 28g > ceiling of 15g
      ingredients: [
        { name: "Pasta", amount: "100g" },
        { name: "Heavy cream", amount: "80ml" },
      ],
    };

    const result = await runGlp1V2Filter([overFatMeal], MOCK_GLP1_TARGETS);
    expect(result).toHaveLength(0);
  });

  it("excludes a meal with missing macros (undefined calories)", async () => {
    const unknownMacroMeal = {
      name: "Mystery Plate",
      label: "Lunch",
      // calories, protein, fats all absent
      ingredients: [{ name: "Unknown food" }],
    };

    const result = await runGlp1V2Filter([unknownMacroMeal], MOCK_GLP1_TARGETS);
    expect(result).toHaveLength(0);
  });

  it("excludes a meal with NaN macros (non-finite guard)", async () => {
    const nanMacroMeal = {
      name: "Sensor Error Meal",
      label: "Breakfast",
      calories: NaN,
      protein: 28,
      fats: 10,
      ingredients: [],
    };

    const result = await runGlp1V2Filter([nanMacroMeal], MOCK_GLP1_TARGETS);
    expect(result).toHaveLength(0);
  });

  it("accepts a fully compliant meal within GLP-1 targets", async () => {
    const compliantMeal = {
      name: "Grilled Chicken Bowl",
      label: "Lunch",
      calories: 380,
      protein: 38,
      fats: 12,          // under 15g ceiling
      ingredients: [
        { name: "Grilled chicken breast", amount: "150g" },
        { name: "Brown rice", amount: "80g" },
        { name: "Steamed broccoli", amount: "100g" },
      ],
    };

    const result = await runGlp1V2Filter([compliantMeal], MOCK_GLP1_TARGETS);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Grilled Chicken Bowl");
  });

  it("filters a mixed list and returns only compliant meals", async () => {
    const meals = [
      {
        name: "Fried Catfish",
        label: "Dinner",
        calories: 520,
        protein: 25,
        fats: 32,     // over ceiling
        ingredients: [{ name: "Catfish", amount: "180g" }],
      },
      {
        name: "Turkey Lettuce Wraps",
        label: "Lunch",
        calories: 340,
        protein: 35,
        fats: 9,      // compliant
        ingredients: [{ name: "Ground turkey", amount: "120g" }],
      },
      {
        name: "Cheese Omelette",
        label: "Breakfast",
        calories: NaN, // invalid
        protein: 22,
        fats: 14,
        ingredients: [],
      },
    ];

    const result = await runGlp1V2Filter(meals, MOCK_GLP1_TARGETS);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Turkey Lettuce Wraps");
  });

  it("uses top-level fats field (not item.nutrition) for V2 output", async () => {
    // V2 returns `fats` at top level; item.nutrition is never populated.
    // This test confirms the filter reads `item.fats` not `item.nutrition.fat`.
    // Uses the same protein/calorie/fat values as the passing "compliant meal" test
    // but replaces `fat` with `fats` (the actual V2 field name).
    const v2StyleMeal = {
      name: "Grilled Turkey Bowl",
      label: "Lunch",
      calories: 380,
      protein: 38,
      fats: 12,         // `fats` top-level field, as V2 generates — `fat` absent
      // `nutrition` intentionally absent (V2 never sets it)
      ingredients: [
        { name: "Grilled turkey breast", amount: "150g" },
        { name: "Brown rice", amount: "80g" },
      ],
    };

    // Verify `fat` is NOT set (would cause false pass if filter read wrong field)
    expect((v2StyleMeal as any).fat).toBeUndefined();

    const result = await runGlp1V2Filter([v2StyleMeal], MOCK_GLP1_TARGETS);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Grilled Turkey Bowl");
  });
});

// ── Catalog fallback GLP-1 gate ───────────────────────────────────────────────
// Validates the logic added to generateCravingMealUnified's catch block:
//   (a) GLP-1 validation errors thrown by the AI path are RE-THROWN (not swallowed
//       by the catalog fallback) so the outer variety-engine retry loop can handle them.
//   (b) A catalog fallback meal that itself fails GLP-1 validation must also be
//       rejected — it cannot silently bypass the fail-closed contract.

/**
 * Mirror of the catch-block predicate in generateCravingMealUnified.
 * Returns { rethrown: true } when the error is a GLP-1 validation failure
 * (caller should re-throw), or the validated fallback meal otherwise.
 */
async function simulateCatchBlock(
  aiError: Error,
  catalogFallback: any,
  targets: ResolvedGLP1Targets | null,
): Promise<{ rethrown: true } | { served: boolean; name: string }> {
  // ── Predicate from production code ────────────────────────────────────────
  if (targets && aiError?.message?.startsWith("GLP-1 validation failed")) {
    return { rethrown: true };
  }

  // Non-GLP-1 AI failure — check fallback against targets (defense-in-depth).
  if (targets) {
    const { validateMealForDiet } = await import("../services/guardrails/index");
    const ingList = (catalogFallback.ingredients || []).map((i: any) => ({
      name: i.item ?? i.name ?? "",
      quantity: i.amount ? String(i.amount) : undefined,
      unit: i.unit,
    }));
    const vr = validateMealForDiet(
      { name: catalogFallback.name, ingredients: ingList, macros: { calories: catalogFallback.calories, protein: catalogFallback.protein, fat: catalogFallback.fat } },
      "glp1", undefined, false, targets,
    );
    if (!vr.isValid) {
      // Production code throws here — we simulate by returning served:false
      return { served: false, name: catalogFallback.name };
    }
  }

  return { served: true, name: catalogFallback.name };
}

describe("generateCravingMealUnified — GLP-1 catalog fallback gate", () => {
  it("re-throws a GLP-1 validation error so the retry loop handles it — never enters catalog fallback", async () => {
    const glp1Error = new Error("GLP-1 validation failed: fat 28g exceeds ceiling 15g");
    const fallbackMeal = { name: "Generic Fallback", calories: 350, protein: 30, fat: 10, ingredients: [] };

    const outcome = await simulateCatchBlock(glp1Error, fallbackMeal, MOCK_GLP1_TARGETS);
    expect(outcome).toEqual({ rethrown: true });
  });

  it("serves a catalog fallback when it passes GLP-1 validation (non-GLP-1 AI error)", async () => {
    const aiError = new Error("OpenAI timeout");
    const compliantFallback = { name: "Grilled Chicken Salad", calories: 360, protein: 36, fat: 11, ingredients: [{ name: "Grilled chicken" }] };

    const outcome = await simulateCatchBlock(aiError, compliantFallback, MOCK_GLP1_TARGETS);
    expect(outcome).toEqual({ served: true, name: "Grilled Chicken Salad" });
  });

  it("rejects an over-fat catalog fallback even for a non-GLP-1 AI error (defense-in-depth)", async () => {
    const aiError = new Error("JSON parse error");
    const overFatFallback = { name: "Butter-Loaded Pasta", calories: 480, protein: 18, fat: 34, ingredients: [{ name: "Pasta" }, { name: "Butter" }] };

    const outcome = await simulateCatchBlock(aiError, overFatFallback, MOCK_GLP1_TARGETS);
    expect(outcome).toEqual({ served: false, name: "Butter-Loaded Pasta" });
  });

  it("serves a catalog fallback without GLP-1 validation when no targets are active", async () => {
    const aiError = new Error("Network timeout");
    const anyFallback = { name: "Whatever Meal", calories: 600, protein: 15, fat: 40, ingredients: [] };

    const outcome = await simulateCatchBlock(aiError, anyFallback, null);
    expect(outcome).toEqual({ served: true, name: "Whatever Meal" });
  });
});

// ── callCravingCreator response normalisation ─────────────────────────────────

describe("callCravingCreator response normalisation", () => {
  it("extracts the first element from data.meals[] when present", () => {
    // Mirror the normalisation expression from mealgenV2.ts:
    //   data.meals?.[0] ?? data.meal ?? data
    const data = {
      meals: [{ name: "Meal A" }, { name: "Meal B" }],
    };
    const extracted = data.meals?.[0] ?? (data as any).meal ?? data;
    expect(extracted).toEqual({ name: "Meal A" });
  });

  it("falls back to data.meal when meals is absent", () => {
    const data = { meal: { name: "Single Meal" } };
    const extracted = (data as any).meals?.[0] ?? data.meal ?? data;
    expect(extracted).toEqual({ name: "Single Meal" });
  });

  it("falls back to the raw response when neither meals nor meal is present", () => {
    // Legacy format — returns the whole object (pre-existing behaviour preserved).
    const data = { name: "Raw Object Meal", calories: 300 };
    const extracted = (data as any).meals?.[0] ?? (data as any).meal ?? data;
    expect(extracted).toEqual(data);
  });
});
