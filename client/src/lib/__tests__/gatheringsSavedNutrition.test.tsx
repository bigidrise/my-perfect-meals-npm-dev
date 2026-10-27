/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import SavedMeals from "@/pages/SavedMeals";
import { setQuickView } from "@/lib/macrosQuickView";
import { gatheringsRecipeSignature, GATHERINGS_NUTRITION_VERSION, hasGatheringsNutrition } from "@shared/gatheringsNutrition";
import { savedGatheringsNutritionPolicy } from "@/lib/gatheringsNutrition";
import { FavoritesPickerModal } from "@/components/FavoritesPickerModal";

let mockMeals: any[] = [];
const mockPlan = jest.fn();
const mockActions = jest.fn();
jest.mock("@/lib/gatheringsNutritionGate", () => ({ gatheringsNutritionPilot: true }));
jest.mock("@/hooks/useSavedMeals", () => ({
  useSavedMealsFeed: () => ({
    data: { pages: [{ meals: mockMeals }] }, hasNextPage: false,
    isFetchingNextPage: false, fetchNextPage: jest.fn(),
  }),
  useDeleteSavedMeal: () => ({ mutate: jest.fn() }),
  useSavedMealsList: () => ({ data: mockMeals, isLoading: false }),
}));
jest.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children }: any) => <div>{children}</div>,
  DrawerContent: ({ children }: any) => <div>{children}</div>,
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <h2>{children}</h2>,
}));
jest.mock("@/hooks/useStarchGuardPrecheck", () => ({
  useStarchGuardPrecheck: () => ({ checkStarch: () => true, clearAlert: jest.fn(), alert: { show: false } }),
}));
jest.mock("@/components/StarchGuardIntercept", () => ({ StarchGuardIntercept: () => null }));
jest.mock("@/hooks/useTranslatedMeal", () => ({ useTranslatedMeal: () => ({ data: undefined, isLoading: false }) }));
jest.mock("wouter", () => ({ useLocation: () => ["/saved-meals", jest.fn()] }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/lib/macrosQuickView", () => ({ setQuickView: jest.fn() }));
jest.mock("@/components/layout/MobileHeaderGuard", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ui/MealImageSlot", () => ({ MealImageSlot: () => null }));
jest.mock("@/components/AlphaGalBadge", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/DiabetesProtocolIndicator", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/AddToMealPlanButton", () => ({
  __esModule: true, default: ({ meal }: any) => { mockPlan(meal); return <button>Add to Plan</button>; },
}));
jest.mock("@/components/MealCardActions", () => ({
  __esModule: true, default: (props: any) => { mockActions(props); return <button>Recipe actions</button>; },
}));

function verified() {
  const meal = {
    sourceFeature: "my-perfect-gatherings", servings: 6,
    ingredients: [{ name: "apples", amount: 600, unit: "g", originalText: "600 g apples" }],
    nutrition: { calories: 600, protein: 30, carbs: 90, fat: 12 },
    nutritionResult: {
      version: GATHERINGS_NUTRITION_VERSION, status: "available", basis: "whole_recipe", servings: 6,
      reasons: [], assumptions: [], sources: [{ ingredientIndex: 0, fdcId: 123, grams: 600 }],
      recipeSignature: "",
    },
  };
  meal.nutritionResult.recipeSignature = gatheringsRecipeSignature(meal, 6, meal.nutrition);
  return meal;
}
function open(mealData: any) {
  mockMeals = [{ id: "test-gathering", title: "Saved Gathering", sourceType: "create-dish", mealData }];
  render(<SavedMeals />);
  fireEvent.click(screen.getByText("Saved Gathering"));
}
afterEach(() => { cleanup(); jest.clearAllMocks(); });

it("Favorites preserves totals/yield but displays, logs, plans and shares one portion", () => {
  const meal = verified();
  const before = JSON.stringify(meal);
  // JSON round trip represents save/cache restoration, not a live database write.
  open(JSON.parse(before));
  expect(screen.getByText("100")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "savedMeals.addToMacros" }));
  expect(setQuickView).toHaveBeenCalledWith(expect.objectContaining({ calories: 100, protein: 5, carbs: 15, fat: 2 }));
  expect(mockPlan).toHaveBeenLastCalledWith(expect.objectContaining({ calories: 100, protein: 5, carbs: 15, fat: 2 }));
  expect(mockActions).toHaveBeenLastCalledWith(expect.objectContaining({
    meal: expect.objectContaining({ servings: 6, nutrition: meal.nutrition }),
    shareNutrition: expect.objectContaining({ calories: 100 }),
  }));
  expect(JSON.stringify(meal)).toBe(before);
});
it.each(["needs_review", "unavailable"])("Favorites never displays or logs cached %s values as valid", status => {
  const meal = verified();
  meal.nutritionResult.status = status;
  open(meal);
  expect(screen.queryByText("100")).toBeNull();
  expect(screen.getByRole("status")).toBeTruthy();
  const button = screen.getByRole("button", { name: "savedMeals.addToMacros" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(setQuickView).not.toHaveBeenCalled();
  expect(mockPlan).not.toHaveBeenCalled();
  expect(mockActions).not.toHaveBeenCalled();
});
it("recognizable legacy Gatherings favorites require regeneration", () => {
  const meal = { courseType: "main", courseLabel: "Main", assignedDish: null, servings: 6, nutrition: verified().nutrition };
  expect(savedGatheringsNutritionPolicy(meal)).toEqual({ applies: true, allowed: false });
  open(meal);
  expect(screen.queryByText("100")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("older result");
});
it.each([
  (m: any) => { m.nutritionResult.sources = []; },
  (m: any) => { m.nutritionResult.sources[0].ingredientIndex = 4; },
  (m: any) => { m.nutritionResult.sources[0] = null; },
  (m: any) => { m.ingredients[0].amount = 60; },
  (m: any) => { m.nutrition.calories = 100; },
  (m: any) => { m.servings = 3; },
  (m: any) => { m.nutritionResult.version = "ingredient-recipe-v1"; },
  (m: any) => { m.nutritionResult.recipeSignature = undefined; },
  (m: any) => { m.ingredients = null; },
  (m: any) => { m.instructions = ["Fry in unspecified oil"]; },
])("rejects incomplete or inconsistent cache evidence %#", mutate => {
  const meal = verified();
  mutate(meal);
  expect(hasGatheringsNutrition(meal)).toBe(false);
  expect(savedGatheringsNutritionPolicy(meal).allowed).toBe(false);
});
it("leaves non-Gatherings recipes and published runtimes unchanged", () => {
  expect(savedGatheringsNutritionPolicy({ nutrition: { calories: 400 } })).toEqual({ applies: false, allowed: true });
  expect(savedGatheringsNutritionPolicy(verified(), false)).toEqual({ applies: false, allowed: true });
  expect(savedGatheringsNutritionPolicy({ sourceFeature: "my-perfect-gatherings" }, false).allowed).toBe(true);
});
it("the Favorites picker blocks unverified gatherings and previews verified portions", () => {
  mockMeals = [
    { id: "unknown", title: "Unknown Gathering", sourceType: "create-dish",
      mealData: { ...verified(), nutritionResult: undefined } },
    { id: "known", title: "Known Gathering", sourceType: "create-dish", mealData: verified() },
  ];
  const selected = jest.fn();
  render(<FavoritesPickerModal open onClose={jest.fn()} onSelect={selected} />);
  const buttons = screen.getAllByRole("button", { name: "Use This" }) as HTMLButtonElement[];
  expect(buttons[0].disabled).toBe(true);
  fireEvent.click(buttons[0]);
  expect(selected).not.toHaveBeenCalled();
  expect(screen.getByText("100 cal · 5g protein")).toBeTruthy();
  fireEvent.click(buttons[1]);
  expect(selected).toHaveBeenCalledWith(mockMeals[1]);
});
