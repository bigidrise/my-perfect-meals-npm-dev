/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SavedMealRow from "@/components/SavedMealRow";
jest.mock("@/lib/groceryCoachCatalogGate", () => ({ groceryCoachCatalogEnabled: true }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/hooks/useTranslatedMeal", () => ({ useTranslatedMeal: () => ({ data: null }) }));
jest.mock("@/components/ui/MealImageSlot", () => ({ MealImageSlot: () => null }));
jest.mock("@/components/MealCardActions", () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
  MealCardAction: ({ children }: any) => <>{children}</>,
}));
jest.mock("@/components/AlphaGalBadge", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/DiabetesProtocolIndicator", () => ({ __esModule: true, default: () => null }));
jest.mock("@/hooks/useFreeLock", () => ({ useFreeLock: () => ({
  isFree: false, showLockModal: false, guardAction: (_message: string, action: () => void) => action(),
  closeLockModal: jest.fn(),
}) }));
jest.mock("@/components/upgrade/UpgradeLockModal", () => ({ UpgradeLockModal: () => null }));
jest.mock("@/components/MealPlanDestinationPicker", () => ({
  MealPlanDestinationPicker: ({ open, onSelect }: any) => open
    ? <button onClick={() => onSelect({ dateISO: "2026-11-07", slot: "dinner", builderType: "general" })}>Confirm destination</button>
    : null,
}));
const fetchMock = jest.fn();
beforeEach(() => {
  Element.prototype.scrollIntoView = jest.fn();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  global.fetch = fetchMock;
});
afterEach(() => { cleanup(); jest.clearAllMocks(); });

it.each(["validated", "unresolved"])("preserves %s nutrition from expanded Favorites through the actual Add to Plan button", async status => {
  const resolved = status === "validated";
  const row = { id: "synthetic", title: "Synthetic Dinner", sourceType: "grocery-coach", mealData: {
    servings: 4, ingredients: [{ name: "broccoli", amount: 400, unit: "g" }],
    instructions: ["Cook the original recipe."],
    nutrition: { calories: 800, protein: 40, carbs: 80, fat: 20,
      starchyCarbs: resolved ? 60 : null, fibrousCarbs: resolved ? 20 : null },
    carbohydrateReview: { version: 1, status, reason: "fixture" },
  } };
  const before = JSON.stringify(row);
  render(<SavedMealRow row={row} sourceLabel={() => "Grocery Coach"} onRemove={jest.fn()}
    onAddToMacros={jest.fn()} initialExpanded />);
  expect(screen.getByRole("status").textContent).toContain(resolved ? "breakdown verified" : "breakdown unresolved");
  fireEvent.click(screen.getByRole("button", { name: "Add to Plan" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm destination" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/weekly-board/add-meal");
  expect(JSON.parse(init.body).meal).toMatchObject({
    sourceType: "grocery-coach", groceryCoachNutritionHandoff: true,
    servings: 1, recipeServings: 4, nutritionBasis: "per-serving",
    carbohydrateReview: row.mealData.carbohydrateReview,
    nutrition: { calories: 200, protein: 10, carbs: 20, fat: 5,
      starchyCarbs: resolved ? 15 : null, fibrousCarbs: resolved ? 5 : null },
    ingredients: row.mealData.ingredients,
  });
  expect(JSON.stringify(row)).toBe(before);
});
