import { readFileSync } from "node:fs";
import ts from "typescript";
import { savedMealSourceLabel, withSavedMealBuilderOrigin, type SavedMealBuilder } from "../savedMealSource";
import english from "../../i18n/locales/en.json";

const builders: ReadonlyArray<readonly [SavedMealBuilder, string]> = [
  ["general_nutrition", "General Nutrition"],
  ["diabetic", "Diabetic"],
  ["anti_inflammatory", "Anti-Inflammatory"],
  ["metabolic_medication", "Metabolic Medication"],
  ["performance", "Performance"],
];

describe("Saved Meals source identity", () => {
  it.each(builders)("saves and displays %s independently of cardiac mode", (builder, label) => {
    const meal = {
      title: "Synthetic dessert", builderType: "heart-failure",
      nutrition: { calories: 230, protein: 12, carbs: 20, fat: 10 },
      ingredients: [{ name: "strawberries", quantity: "1", unit: "cup" }],
      instructions: ["Chill."],
      diabeticMemory: { bglBucket: "elevated", generatedBglMgdl: 140 },
    };
    const original = JSON.stringify(meal);
    const saved = withSavedMealBuilderOrigin(meal, builder);
    const restored = JSON.parse(JSON.stringify(saved));
    expect(savedMealSourceLabel("heart-failure", restored)).toBe(label);
    expect(JSON.stringify(meal)).toBe(original);
    expect(saved.builderType).toBe("heart-failure");
    expect(saved.nutrition).toBe(meal.nutrition);
    expect(saved.ingredients).toBe(meal.ingredients);
    expect(saved.instructions).toBe(meal.instructions);
    expect(saved.diabeticMemory).toBe(meal.diabeticMemory);
    expect(label).not.toContain("Builder");
  });

  it("uses the exact English Metabolic Medication label", () => {
    expect(english.savedMeals.sourceMetabolic).toBe("Metabolic Medication");
    expect(english.savedMeals.sourceSavedMeal).toBe("Saved Meal");
  });

  it.each([
    ["diabetic", "Diabetic"], ["general-nutrition", "General Nutrition"],
    ["anti-inflammatory", "Anti-Inflammatory"], ["glp1", "Metabolic Medication"],
    ["performance-competition", "Performance"], ["performance-nutrition", "Performance"],
  ])("preserves established legacy Builder source %s", (source, expected) => {
    expect(savedMealSourceLabel(source)).toBe(expected);
  });

  it.each([
    ["beverage-creator", "Beverage Creator"], ["Beverage Creator", "Beverage Creator"],
    ["grocery-coach", "Grocery Coach"], ["create-dish", "Create a Dish"],
    ["Create a Dish", "Create a Dish"], ["chefs-kitchen", "Chef's Kitchen"],
    ["Chef's Kitchen", "Chef's Kitchen"], ["craving-creator", "Craving Creator"],
    ["dessert-creator", "Dessert Creator"], ["fridge-rescue", "Fridge Rescue"],
    ["recipe-maker", "Recipe Maker"],
    ["find-meals", "Find Meals"],
  ])("keeps the actual creator for %s even with cardiac safeguards", (source, expected) => {
    const meal = { builderType: "heart-failure", nutrition: { calories: 100 } };
    expect(withSavedMealBuilderOrigin(meal)).toBe(meal);
    expect(savedMealSourceLabel(source, meal)).toBe(expected);
  });

  it.each([
    "heart-failure", "heartFailure", "cardiac", "kidney-disease", "renal",
    "liver-support", "liver-disease", "oncology-support", "thyroid-support",
    "unknown", "", "__proto__", "constructor",
  ])("does not guess an originating Builder from legacy source %s", source => {
    const meal = { builderType: "anti-inflammatory", title: "Heart-healthy cheesecake" };
    const snapshot = JSON.stringify(meal);
    expect(savedMealSourceLabel(source, meal)).toBe("Saved Meal");
    expect(JSON.stringify(meal)).toBe(snapshot);
  });

  it.each([
    null, [], "anti_inflammatory",
    { version: 1, kind: "builder", builder: "heart-failure" },
    { version: 2, kind: "builder", builder: "anti_inflammatory" },
    { version: 1, kind: "clinical", builder: "anti_inflammatory" },
    { version: 1, kind: "builder", builder: "__proto__" },
  ])("ignores malformed or unsupported origin metadata: %j", origin => {
    expect(savedMealSourceLabel("heart-failure", { savedMealOrigin: origin })).toBe("Saved Meal");
    expect(savedMealSourceLabel("beverage-creator", { savedMealOrigin: origin })).toBe("Beverage Creator");
  });

  it("uses the localized origin label rather than the clinical label", () => {
    const translate = jest.fn((_key: string, fallback: string) => `localized ${fallback}`);
    expect(savedMealSourceLabel("heart-failure",
      withSavedMealBuilderOrigin({ builderType: "heart-failure" }, "anti_inflammatory"), translate))
      .toBe("localized Anti-Inflammatory");
    expect(translate).toHaveBeenCalledWith("savedMeals.sourceAntiInflam", "Anti-Inflammatory");
  });

  it.each<[string, SavedMealBuilder]>([
    ["client/src/pages/pro/GeneralNutritionBuilder.tsx", "general_nutrition"],
    ["client/src/pages/pro/PerformanceCompetitionBuilder.tsx", "performance"],
    ["client/src/pages/physician/DiabeticMenuBuilder.tsx", "diabetic"],
    ["client/src/pages/physician/GLP1MealBuilder.tsx", "metabolic_medication"],
    ["client/src/pages/physician/AntiInflammatoryMenuBuilder.tsx", "anti_inflammatory"],
    ["client/src/pages/BeachBodyMealBoard.tsx", "performance"],
  ])("wires every day/week/overview card in %s to its actual Builder", (path, expected) => {
    const file = ts.createSourceFile(path, readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let cards = 0;
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText(file) === "MealCard") {
        cards++;
        const origin = node.attributes.properties.find(attribute =>
          ts.isJsxAttribute(attribute) && attribute.name.getText(file) === "originBuilder");
        expect(origin && ts.isJsxAttribute(origin) && origin.initializer &&
          ts.isStringLiteral(origin.initializer) ? origin.initializer.text : null).toBe(expected);
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
    expect(cards).toBeGreaterThanOrEqual(3);
  });

  it("leaves existing favorite hash identity and the clinical payload intact", () => {
    const card = readFileSync("client/src/components/MealCard.tsx", "utf8");
    expect(card).toContain('sourceType={builderType ?? meal.builderType ?? "meal-builder"}');
    expect(card).toContain("mealData={withSavedMealBuilderOrigin(");
    expect(card).toContain("builderType: builderType ?? meal.builderType");
    expect(card).toContain("}, originBuilder)");
    const row = readFileSync("client/src/components/SavedMealRow.tsx", "utf8");
    expect(row).toContain("sourceLabel(row.sourceType, row.mealData)");
  });
});
