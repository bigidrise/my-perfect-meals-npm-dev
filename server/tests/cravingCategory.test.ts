import { readFileSync } from "node:fs";
import { CRAVING_CATEGORIES, CRAVING_EXTRA_DIET_OPTIONS, buildCravingCategoryPrompt } from "../../shared/cravingCategories";

describe("optional Craving categories", () => {
  it("provides all 15 distinct optional food-family choices", () => {
    expect(CRAVING_CATEGORIES).toHaveLength(15);
    expect(new Set(CRAVING_CATEGORIES.map(category => category.value)).size).toBe(15);
    expect(CRAVING_CATEGORIES[0].label).toBe("Surprise Me!");
  });
  it.each([undefined, null, "", "__none__", "unknown", { value: "sweet" }])("does not change generation for absent/unsupported context %s", value => {
    expect(buildCravingCategoryPrompt(value)).toBe("");
  });
  it.each(CRAVING_CATEGORIES)("keeps $label subordinate to explicit requests and existing requirements", category => {
    const prompt = buildCravingCategoryPrompt(category.value);
    expect(prompt).toContain(category.label);
    expect(prompt).toContain("explicit craving description takes priority");
    expect(prompt).toContain("not a dietary restriction");
    expect(prompt).toContain("serving count");
    expect(prompt).toContain("meal-slot assignment");
  });
  it("keeps sweets small by default and shakes eligible for either destination", () => {
    expect(buildCravingCategoryPrompt("sweet")).toContain("not a whole dessert or batch by default");
    expect(buildCravingCategoryPrompt("shakes-smoothies")).toContain("can be meals or snacks");
  });
  it("preserves the lower diet dropdown's unique choices", () => {
    expect(CRAVING_EXTRA_DIET_OPTIONS.map(option => option.value)).toEqual(["dairy-free", "mediterranean"]);
  });
  it("connects optional context to the active Craving path without changing nutrition or destination arguments", () => {
    const route = readFileSync("server/routes.ts", "utf8");
    const handler = route.slice(route.indexOf("const cravingCreatorHandler"), route.indexOf('app.post("/api/meals/craving-creator"'));
    expect(handler).toContain('humanFoodCreator === "craving_creator"');
    expect(handler).toContain("buildCravingCategoryPrompt(req.body.cravingCategory)");
    expect(handler).toContain("if (cravingCategoryPrompt) cravingInput");
    expect(handler).toContain('humanFoodCreator === "create_a_dish" || cravingCategoryPrompt ? rawCravingInput : undefined');
    expect(handler).toContain("normalizedTargetMealType,");
    expect(handler).toContain("bodyDietRestrictions,");
    expect(handler).toContain("validatedServings");
    expect(handler).toContain("validateHumanFoodCandidate");
  });
  it("replaces only the lower dropdown and preserves top controls, custom restrictions and request fields", () => {
    const page = readFileSync("client/src/pages/craving-creator.tsx", "utf8");
    expect(page).not.toContain("Dietary Preferences (Optional)");
    expect(page).not.toContain("selectedDiet");
    expect(page).toContain("Craving Category (Optional)");
    expect(page).toContain("CRAVING_CATEGORIES.map");
    expect(page).toContain("DietCuisineControlRow");
    expect(page).toContain("CRAVING_EXTRA_DIET_OPTIONS.filter");
    expect(page).toContain("Custom Dietary Restrictions");
    expect(page).toContain("cravingCategory: cravingCategory || undefined");
    expect(page).toContain("cookMethod: cookMethod || undefined");
    expect(page).toContain("servings: servings");
    expect(page).toContain("cultureOverride: cuisineOverrideValue");
    expect(page).toContain('cravingCategory ? "something delicious" : ""');
  });
});
