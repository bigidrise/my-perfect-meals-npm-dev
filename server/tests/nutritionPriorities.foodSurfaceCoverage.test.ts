import fs from "fs";
import path from "path";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function routeBlock(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("Nutrition Priorities Phase 6 food-surface coverage", () => {
  const routes = read("server/routes.ts");

  it("passes the fresh canonical HFC block into Create With Chef and Snack Creator generation", () => {
    const unifiedRoute = routeBlock(
      routes,
      'app.post("/api/meals/generate"',
      'app.post("/api/meals/fridge-rescue"',
    );

    expect(unifiedRoute).toContain(
      'const contextBlock = buildCreatorHumanFoodPrompt("recipe_maker", humanFoodContext)',
    );
    expect(unifiedRoute).toContain(
      "effectiveGenerationContext = [effectiveGenerationContext, contextBlock]",
    );
    expect(unifiedRoute).toContain(
      "generationContext: typeof effectiveGenerationContext === 'string' ? effectiveGenerationContext : undefined",
    );
    expect(unifiedRoute).not.toContain(
      "generationContext: typeof generationContext === 'string' ? generationContext : undefined",
    );

    const pipeline = read("server/services/unifiedMealPipeline.ts");
    expect(pipeline).toContain(
      "=== AUTHORITATIVE REQUEST AND HUMAN FOOD CONTEXT ===",
    );
    expect(pipeline).toContain("const requestedIdentityText = cravingDescription");
    expect(pipeline).not.toContain(
      "const requestedIdentityText = [cravingDescription, generationContext]",
    );
  });

  it("keeps active craving and Create a Dish generation on the shared creator projection", () => {
    const cravingRoute = routeBlock(
      routes,
      'app.post("/api/meals/craving-creator"',
      'app.post("/api/meals/craving-creator-enforced"',
    );

    expect(cravingRoute).toContain(
      "buildCreatorHumanFoodPrompt(humanFoodCreator, humanFoodContext, humanFoodExecutionState)",
    );
  });

  it("keeps Grocery Coach, Fridge Rescue, dessert, beverage, and restaurant guidance on the shared HFC projection", () => {
    expect(read("server/routes/groceryCoach.ts")).toContain(
      "buildHumanFoodPromptBlock(humanFoodContext)",
    );
    expect(routes).toContain("const fridgeHumanFoodPrompt =");
    expect(routes).toContain("buildHumanFoodPromptBlock(fridgeHumanFoodContext)");
    expect(read("server/routes/dessert-creator.ts")).toContain(
      'buildCreatorHumanFoodPrompt("dessert_creator", humanFoodContext',
    );
    expect(read("server/routes/beverage-creator.ts")).toContain(
      'buildCreatorHumanFoodPrompt("beverage_creator", humanFoodContext',
    );
    expect(read("server/routes/restaurants.ts")).toContain(
      "const humanFoodPrompt = buildHumanFoodPromptBlock(humanFoodContext)",
    );
  });

  it("keeps restaurant priority guidance behind verified menu evidence", () => {
    const restaurantRoute = read("server/routes/restaurants.ts");

    expect(restaurantRoute).toContain("RESTAURANT NUTRITION PRIORITY EVIDENCE BOUNDARY");
    expect(restaurantRoute).toContain(
      "Do not claim or imply that an item satisfies a Nutrition Priority unless the menu provider supplies explicit, structured evidence",
    );
    expect(restaurantRoute).toContain(
      "Never infer hidden ingredients or nutrient characteristics from an item name, description, cuisine, or AI-generated estimate",
    );
    expect(restaurantRoute.match(/nutritionPriorityEvidenceBoundary/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps pediatric single-child priorities and multi-child omission at the canonical boundary", () => {
    const pediatricRoute = read("server/routes/my-perfect-beginning.ts");

    expect(pediatricRoute).toContain(
      "foodInclusionPriorities: isMultiChildMode ? null : childFoodInclusionPriorities",
    );
    expect(pediatricRoute).toContain(
      'buildCreatorHumanFoodPrompt("my_perfect_beginning", humanFoodContext)',
    );
  });

  it("does not create generator-specific priority registries or validators", () => {
    const activeGenerators = [
      "server/services/unifiedMealPipeline.ts",
      "server/routes/groceryCoach.ts",
      "server/routes/dessert-creator.ts",
      "server/routes/beverage-creator.ts",
      "server/routes/restaurants.ts",
    ].map(read).join("\n");

    expect(activeGenerators).not.toContain("FOOD_INCLUSION_PRIORITY_REGISTRY");
    expect(activeGenerators).not.toMatch(/validateNutritionPriorit/i);
  });
});