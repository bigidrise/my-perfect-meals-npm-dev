import fs from "fs";
import path from "path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
const canonical = read("server/services/canonicalWeeklyMealPlanning.ts");
const context = read("server/services/humanFoodContext/resolveHumanFoodContext.ts");
const nutrition = read("server/services/nutritionStateService.ts");
const board = read("server/routes/weekBoard.ts");
const singular = read("server/routes.ts");
const plural = read("server/routes/mealPlans.routes.ts");

describe("Stage 2F weekly canonicalization contract", () => {
  test("uses seven independent, Sunday-through-Saturday, date-local contexts", () => {
    expect(canonical).toContain("Array.from({ length: weeks * 7 }");
    expect(canonical).toContain("date.getUTCDay()");
    expect(canonical).toContain("dateISO,");
    expect(context).toContain("resolveDailyNutritionState(input.subjectUserId, dateISO, input.excludeItemId)");
    expect(nutrition).toContain("mb.start_date::date");
    expect(nutrition).toContain("projectedRemaining");
    expect(nutrition).toContain("consumedRemaining");
    expect(nutrition).toContain("consumedStarchExhausted");
  });

  test("preserves constrained dietary, clinical, allergy, flavor and variety validation", () => {
    expect(canonical).toContain("userAllergens: contexts[0].safety.allergies");
    expect(canonical).toContain("medicalFlags: contexts[0].safety.healthConditions");
    expect(canonical).toContain("validateHumanFoodCandidate");
    expect(canonical).toContain("enforceWeeklyCaps");
    expect(canonical).toContain("meetsVariety");
    expect(canonical).toContain('outcome !== "pass"');
    // Validation is evidence-driven: no clinical compliance is asserted here.
    expect(canonical).not.toContain("glp1Compliant: true");
    expect(canonical).not.toContain("diabetesCompliant: true");
  });

  test("reroll and day regeneration preserve scope and exclude old reservation", () => {
    expect(canonical).toContain("regenerateCanonicalWeeklyDay");
    expect(canonical).toContain("const days = oldDays.slice()");
    expect(canonical).toContain("rerollCanonicalWeeklyMeal");
    expect(canonical).toContain("excludeItemId: input.excludeItemId");
    expect(canonical).toContain("REROLL_NOT_MATERIALLY_DIFFERENT");
    expect(canonical).toContain("for (let attempt = 0; attempt < 2; attempt++)");
    expect(canonical).toContain("context, { executionState }");
    expect(canonical).toContain('result.outcome !== "repairable"');
    expect(board).toContain('/api/weekly-board/regenerate-day');
    expect(board).toContain('/api/weekly-board/reroll-meal');
    expect(board).toContain("dayIndexFor(dateISO)");
  });

  test("day regeneration resolves exactly its requested context rather than a generated week", () => {
    const dayFn = canonical.slice(canonical.indexOf("export async function regenerateCanonicalWeeklyDay"),
      canonical.indexOf("export async function rerollCanonicalWeeklyMeal"));
    expect(dayFn).toContain("generateCanonicalDay({");
    expect(dayFn).toContain("dateISO");
    expect(dayFn).not.toContain("generateCanonicalWeeklyMealPlan({");
  });

  test("aliases are authenticated canonical paths and client identity cannot select a subject", () => {
    expect(singular).toContain('app.post("/api/meal-plan/generate", requireAuth');
    expect(singular).toContain("generateCanonicalWeeklyMealPlan");
    expect(plural).toContain("getAuthUserId(req)");
    expect(plural).toContain("generateCanonicalWeeklyMealPlan");
    expect(board).toContain("getAuthUserId(req)");
    expect(board).toContain('requireAuth, async');
    expect(read("server/routes/meal-plan-replace.ts")).not.toContain('req.headers["x-user-id"]');
  });

  test("generated invalid candidates have a board persistence gate", () => {
    expect(board).toContain("GENERATED_MEAL_VALIDATION_REQUIRED");
    expect(board).toContain('validation.outcome !== "pass"');
  });
});