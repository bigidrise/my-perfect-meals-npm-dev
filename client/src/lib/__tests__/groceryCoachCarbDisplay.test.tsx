/** @jest-environment node */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GroceryCoachMacroTiles, GroceryCoachCarbStatus } from "@/components/shopping/GroceryCoachMacroTiles";
import { groceryCoachPlanHandoff } from "@/lib/groceryCoachPlanHandoff";
import { mealMacroSnapshot } from "@/lib/mealMacroSnapshot";
import { builderMealMacros } from "@/lib/builderMacroCalculation";
jest.mock("@/lib/groceryCoachCatalogGate", () => ({ groceryCoachCatalogEnabled: true }));

const nutrition = { calories: 800, protein: 40, carbs: 80, fat: 20, starchyCarbs: 60, fibrousCarbs: 20 };
it("uses identical one-serving values on Coach, Favorites, and the plan", () => {
  const review = { version: 1 as const, status: "validated" as const, reason: "ingredient_sources_verified" };
  const coach = { macros: nutrition, meal: { servings: 4 }, carbohydrateReview: review };
  const saved = { nutrition, servings: 4, carbohydrateReview: review };
  const before = JSON.stringify(saved);
  const plan = groceryCoachPlanHandoff(saved);
  for (const item of [coach, saved, plan]) {
    const html = renderToStaticMarkup(<GroceryCoachMacroTiles
      macros={mealMacroSnapshot(item)} showReview review={item.carbohydrateReview} />);
    expect(html).toContain("15g");
    expect(html).toContain("5g");
    expect(html).toContain("breakdown verified");
    expect(html).not.toContain("breakdown unresolved");
  }
  expect(JSON.stringify(saved)).toBe(before);
  expect(plan).toMatchObject({ recipeServings: 4, servings: 1, nutritionBasis: "per-serving" });
});
it("labels historical meals unresolved without modifying their retained estimates", () => {
  const saved = { nutrition, servings: 4 };
  const before = JSON.stringify(saved);
  const plan = groceryCoachPlanHandoff(saved);
  expect(plan.carbohydrateReview.status).toBe("unresolved");
  expect(plan.nutrition.starchyCarbs).toBe(15);
  expect(JSON.stringify(saved)).toBe(before);
});
it("shows dashes for unknowns and incomplete nutrition review rather than fabricated zeroes", () => {
  const saved = { nutrition: { calories: 800, protein: 40, carbs: 80, fat: 20 }, servings: 4 };
  const plan = groceryCoachPlanHandoff(saved);
  expect(plan.nutrition.starchyCarbs).toBeNull();
  const html = renderToStaticMarkup(<GroceryCoachMacroTiles macros={plan.nutrition}
    showReview review={plan.carbohydrateReview} />);
  expect(html).toContain("—");
  expect(html).toContain("breakdown unresolved");
  expect(html).toContain("nutrition review incomplete");
});
it("does not introduce Grocery Coach status on unrelated cards", () => {
  const html = renderToStaticMarkup(<GroceryCoachMacroTiles macros={nutrition} />);
  expect(html).not.toContain("grocery-coach-carb-status");
});
it("keeps missing Grocery Coach categories uncertain in meal-plan totals instead of deriving a split", () => {
  const plan = {
    ...groceryCoachPlanHandoff({ nutrition: { calories: 400, protein: 10, carbs: 40, fat: 5 } }),
    ingredients: [{ item: "rice", amount: 100, unit: "g" }],
  };
  const summary = builderMealMacros(plan);
  expect(summary.uncertainFields).toEqual(expect.arrayContaining(["starchyCarbs", "fibrousCarbs"]));
  expect(summary.estimated).toBe(false);
  expect(plan.nutrition.starchyCarbs).toBeNull();
});
it("never displays complete review for an invalid split even with stale completion metadata", () => {
  const html = renderToStaticMarkup(<GroceryCoachMacroTiles macros={{ ...nutrition, starchyCarbs: 100 }}
    showReview review={{ version: 1, status: "validated", reason: "stale" }} />);
  expect(html).toContain("breakdown unresolved");
  expect(html).not.toContain("breakdown verified");
});
it("invalidates source verification when a later edit changes the ingredient quantity", () => {
  const evidence = [{ name: "broccoli", quantity: "100", unit: "g" }] as any;
  const html = renderToStaticMarkup(<GroceryCoachCarbStatus
    review={{ version: 1, status: "validated", reason: "verified", evidence }}
    ingredients={[{ name: "broccoli", amount: 200, unit: "g" }]} />);
  expect(html).toContain("breakdown unresolved");
});
