/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { GroceryCoachMacroTiles } from "@/components/shopping/GroceryCoachMacroTiles";
import { groceryCoachCarbBreakdown } from "@shared/groceryCoachCarbs";

const macros = { calories: 680, protein: 75, carbs: 60, fat: 12, starchyCarbs: 48, fibrousCarbs: 12 };
it("shows five distinct tiles, using the recipe's fibrous carbs rather than dietary fiber", () => {
  render(<GroceryCoachMacroTiles macros={{ ...macros, ...{ fiber: 99 } }} />);
  const grid = screen.getByTestId("grocery-coach-macro-grid");
  expect(grid.children).toHaveLength(5);
  expect(within(screen.getByText("Fibrous Carbs").parentElement!).getByText("12g")).toBeInTheDocument();
  expect(screen.getByText("Starchy Carbs")).toBeInTheDocument();
  expect(screen.getByText("Fat")).toBeInTheDocument();
});
it("keeps two shrinkable columns on mobile and gives fibrous carbs a full row", () => {
  render(<GroceryCoachMacroTiles macros={macros} />);
  expect(screen.getByTestId("grocery-coach-macro-grid").style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
  expect(screen.getByText("Fibrous Carbs").parentElement!.style.gridColumn).toBe("1 / -1");
});
it("preserves an explicit zero and does not invent values for older meals", () => {
  const view = render(<GroceryCoachMacroTiles macros={{ ...macros, fibrousCarbs: 0 }} />);
  expect(within(screen.getByText("Fibrous Carbs").parentElement!).getByText("0g")).toBeInTheDocument();
  view.rerender(<GroceryCoachMacroTiles macros={{ ...macros, fibrousCarbs: undefined }} />);
  expect(within(screen.getByText("Fibrous Carbs").parentElement!).getByText("—")).toBeInTheDocument();
  expect(screen.getByText(/breakdown partly unavailable/)).toBeInTheDocument();
});
it.each([
  { fibrousCarbs: -1 },
  { fibrousCarbs: NaN },
  { fibrousCarbs: 61 },
  { starchyCarbs: 50, fibrousCarbs: 20 },
])("does not display an invalid or inconsistent breakdown: %o", override => {
  expect(groceryCoachCarbBreakdown({ ...macros, ...override }).fibrousCarbs).toBeNull();
});
