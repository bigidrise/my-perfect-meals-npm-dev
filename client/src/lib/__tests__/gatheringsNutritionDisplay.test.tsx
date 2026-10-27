/** @jest-environment jsdom */
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import GatheringsNutritionPanel from "@/components/GatheringsNutritionPanel";
import ServingInstructionsBlock from "@/components/ServingInstructionsBlock";
import { creatorMealNutrition } from "@/lib/mealMacroSnapshot";
import { canUseGatheringsNutrition, gatheringsMealForPlan } from "@/lib/gatheringsNutrition";
import { gatheringsRecipeSignature } from "@shared/gatheringsNutrition";
jest.mock("@/lib/gatheringsNutritionGate", () => ({ gatheringsNutritionPilot: true }));
const course = {
  servings: 6, nutrition: { calories: 600, protein: 30, carbs: 90, fat: 12 },
  ingredients: [{ name: "apples", amount: 600, unit: "g", originalText: "600 g apples" }],
  nutritionResult: { version: "ingredient-recipe-v2", status: "available", basis: "whole_recipe", servings: 6, reasons: [], sources: [{ ingredientIndex: 0, fdcId: 123, grams: 600 }], assumptions: [], recipeSignature: "" },
};
course.nutritionResult.recipeSignature = gatheringsRecipeSignature(course, 6, course.nutrition);
afterEach(cleanup);
it("displays one serving consistently with saved recipe yield and macro handoff", () => {
  render(<GatheringsNutritionPanel course={course} />);
  expect(screen.getByText("100")).toBeTruthy();
  expect(screen.getByText("5g")).toBeTruthy();
  expect(creatorMealNutrition(course, 2).calories).toBe(100);
  expect(canUseGatheringsNutrition(course)).toBe(true);
  expect(gatheringsMealForPlan(course)).toMatchObject({ calories: 100, protein: 5, carbs: 15, fat: 2 });
});
it.each(["needs_review", "unavailable"])("unknown %s nutrition is not displayed as zero or loggable", status => {
  const meal = { ...course, nutrition: undefined, nutritionResult: { ...course.nutritionResult, status, reasons: ["frying_fat_retention_unknown"] } };
  render(<GatheringsNutritionPanel course={meal} />);
  expect(screen.getByRole("status").textContent).toContain("frying fat");
  expect(screen.queryByText("0")).toBeNull();
  expect(canUseGatheringsNutrition(meal)).toBe(false);
  expect(gatheringsMealForPlan(meal)).toBeNull();
});
it("legacy caches are not promoted, but other runtimes keep their behavior", () => {
  const legacy = { servings: 6, nutrition: course.nutrition };
  expect(canUseGatheringsNutrition(legacy)).toBe(false);
  expect(canUseGatheringsNutrition(legacy, false)).toBe(true);
});
it.each([[6, "16.7"], [3, "33.3"], [8, "12.5"], [4, "25"]])("percentages for %s servings are accurate", (servings, percent) => {
  render(<ServingInstructionsBlock servings={servings as number} mealName="Baked dish" portionMethod="slice-based" />);
  expect(screen.getByText(new RegExp(`~${percent}% each`))).toBeTruthy();
});
it("every numeric handoff and local medical badge is gated", () => {
  const source = readFileSync("client/src/pages/lifestyle/GatheringsPage.tsx", "utf8");
  expect(source).toContain("canUseGatheringsNutrition(course) && <FavoriteButton");
  expect(source).toContain("canUseGatheringsNutrition(course) && <AddToMealPlanButton");
  expect(source).toContain("canUseGatheringsNutrition(course) && <ShareRecipeButton");
  expect(source).toContain("if (!canUseGatheringsNutrition(course)) return;");
  expect(source).toContain("if (!canUseGatheringsNutrition(course)) return null;");
});
