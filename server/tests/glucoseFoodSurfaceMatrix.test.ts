import fs from "fs";
import path from "path";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("active food surfaces preserve canonical glucose preferences", () => {
  test("canonical weekly initial, regeneration, and reroll validate final candidates", () => {
    const source = read("server/services/canonicalWeeklyMealPlanning.ts");
    expect(source).toContain("resolveHumanFoodContext");
    expect(source).toContain("validateHumanFoodCandidate");
    expect(source).toContain("regenerateCanonicalWeeklyDay");
    expect(source).toContain("rerollCanonicalWeeklyMeal");
  });

  test("legacy stable generation uses canonical state and deterministic filtering", () => {
    const source = read("server/services/stableMealGenerator.ts");
    expect(source).toContain("resolveUserGlucoseState");
    expect(source).toContain("filterCatalogByGlucosePreferences");
    expect(source).not.toMatch(/glycemicSettings\\.preferredCarbs/);
    expect(source).not.toContain("glycemic_filter_fallback");
  });

  test("active recipe and craving creator performs final validation after transformation", () => {
    const source = read("server/routes.ts");
    const activeRoute = source.slice(
      source.indexOf('app.post("/api/meals/craving-creator"'),
      source.indexOf('app.post("/api/meals/craving-creator-enforced"'),
    );
    expect(activeRoute).toContain("createHumanFoodRequestScope");
    expect(activeRoute).toContain("applyCreatorTransformation");
    expect(activeRoute.lastIndexOf("validateHumanFoodCandidate"))
      .toBeGreaterThan(activeRoute.indexOf("applyCreatorTransformation"));
  });

  test("active Fridge Rescue prompts and final-validates with the same context", () => {
    const source = read("server/routes.ts");
    const activeRoute = source.slice(
      source.indexOf('app.post("/api/meals/fridge-rescue", requireAuth'),
      source.indexOf('app.post("/api/meals/fridge-rescue", requireFeature'),
    );
    expect(activeRoute).toContain("createHumanFoodRequestScope");
    expect(activeRoute).toContain("buildHumanFoodPromptBlock");
    expect(activeRoute).toContain("validateFridgeRescueMealsWithHumanFood");
    expect(activeRoute).toContain("getFridgeRescueReleaseStatus");
    expect(activeRoute).toContain("HUMAN_FOOD_VALIDATION_FAILED");
  });

  test("Dessert Creator resolves context and final-validates output", () => {
    const source = read("server/routes/dessert-creator.ts");
    expect(source).toContain("createHumanFoodRequestScope");
    expect(source).toContain("validateHumanFoodCandidate");
  });

  test("Grocery Coach validates both initial and retry results", () => {
    const source = read("server/routes/groceryCoach.ts");
    expect(source).toContain("createHumanFoodRequestScope");
    expect(source).toContain("passesCanonicalFinalValidation(retryResult)");
    expect(source).toContain("validateHumanFoodResult");
  });

  test("restaurant paths apply glucose advisory to AI and verified-menu results", () => {
    const source = read("server/routes/restaurants.ts");
    expect(
      source.match(/applyRestaurantGlucoseProduceAdvisory/g)?.length,
    ).toBeGreaterThanOrEqual(2);
    expect(source).toContain("createHumanFoodRequestScope");
  });

  test("Meal Finder applies canonical restaurant glucose advisory", () => {
    const source = read("server/routes/mealFinder.ts");
    expect(source).toContain("createHumanFoodRequestScope");
    expect(source).toContain("applyRestaurantGlucoseProduceAdvisory");
  });
});