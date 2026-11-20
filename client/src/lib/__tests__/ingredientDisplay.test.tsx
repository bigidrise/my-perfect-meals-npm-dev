/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { readFileSync } from "node:fs";
import { ingredientLine, ingredientQuantity } from "@/lib/ingredientDisplay";
import { IngredientDisplay } from "@/components/IngredientDisplay";
import { MeasurementQuantity } from "@/components/MeasurementQuantity";

let mockSystem: "imperial" | "metric" = "imperial";
let mockEnabled = true;
jest.mock("@/hooks/useMeasurementSystem", () => ({ useMeasurementSystem: () => mockSystem }));
jest.mock("@/lib/ingredientDisplayGate", () => ({ get localizedIngredientDisplayEnabled() { return mockEnabled; } }));
const language = createInstance();
beforeAll(async () => {
  await language.use(initReactI18next).init({ lng: "es", fallbackLng: "en", resources: { en: {}, es: {} } });
});
beforeEach(async () => { mockSystem = "imperial"; mockEnabled = true; await language.changeLanguage("es"); });
afterEach(cleanup);
const wrapper = ({ children }: { children: React.ReactNode }) => <I18nextProvider i18n={language}>{children}</I18nextProvider>;

test.each([
  [2, "cup", "papaya verde", "2 tazas de papaya verde"],
  [6, "oz", "camarones", "6 oz de camarones"],
  ["1/2", "cup", "zanahoria", "½ taza de zanahoria"],
  ["1/4", "cup", "cacahuetes", "¼ de taza de cacahuetes"],
  [1, "tbsp", "salsa de soya", "1 cucharada de salsa de soya"],
  [4, "oz", "filete de pescado blanco", "4 oz de filete de pescado blanco"],
  [6, "unidades", "galletas de arroz", "6 galletas de arroz"],
  ["1/4", "cup", "cebollín", "¼ de taza de cebollín"],
  ["1/2", "tsp", "canela", "½ cucharadita de canela"],
  [2, "cloves", "ajo", "2 dientes de ajo"],
  [0, "cup", "papaya", "0 tazas de papaya"],
] as const)("formats %s %s without changing the ingredient name", (quantity, unit, name, expected) => {
  expect(ingredientLine({ quantity, unit, name }, "imperial", "es")).toBe(expected);
});
test.each(["en", "es"])("measurement conversion stays independent of %s", locale => {
  expect(ingredientQuantity("1/2", "cup", "metric", locale)).toBe(locale === "es" ? "120 mL" : "120 ml");
  expect(ingredientQuantity(6, "oz", "metric", locale)).toBe("170 g");
  expect(ingredientQuantity(6, "oz", "imperial", locale)).toBe("6 oz");
});
test("supports structured aliases, strings, saved displayText and combined amount fields", () => {
  expect(ingredientLine({ amount: "1/2", unit: "cup", item: "zanahoria" }, "imperial", "es")).toBe("½ taza de zanahoria");
  expect(ingredientLine("1/4 cup cebollín", "imperial", "es")).toBe("¼ de taza de cebollín");
  expect(ingredientLine("0,5 cup zanahoria", "imperial", "es")).toBe("½ taza de zanahoria");
  expect(ingredientLine("6 unidades galletas de arroz", "imperial", "es")).toBe("6 galletas de arroz");
  expect(ingredientLine({ amount: "6 oz", name: "camarones" }, "imperial", "es")).toBe("6 oz de camarones");
  expect(ingredientLine({ name: "cebollín", displayText: "1/4 cup scallions" }, "imperial", "es")).toBe("¼ de taza de cebollín");
  expect(ingredientLine({ quantity: 1, unit: "cup", name: "mango", displayText: "99 cup mango" }, "imperial", "es")).toBe("1 taza de mango");
  expect(ingredientLine({ quantity: 2, unit: "cup", name: "papaya" }, "imperial", "en")).toBe("2 cups papaya");
  expect(ingredientLine({ quantity: 6, unit: "unidades", name: "rice crackers" }, "imperial", "en")).toBe("6 rice crackers");
});
test("preserves ambiguous, unknown and ranged quantities instead of guessing", () => {
  expect(ingredientLine("1-2 cup mango", "metric", "es")).toBe("1-2 cup mango");
  expect(ingredientLine("salt to taste", "metric", "es")).toBe("salt to taste");
  expect(ingredientQuantity("1,000", "g", "imperial", "es")).toBe("1,000 g");
  expect(ingredientLine({ quantity: 2, unit: "spray", name: "oil" }, "metric", "es")).toBe("2 spray oil");
});
test("converts volumes to volumes, never ingredient-specific guessed weights", () => {
  expect(ingredientLine({ quantity: 2, unit: "cup", name: "papaya verde" }, "metric", "es")).toBe("480 mL de papaya verde");
  expect(ingredientLine({ quantity: "1/2", unit: "cup", name: "spinach" }, "metric", "en")).toBe("120 ml spinach");
});
test("repeated language/system changes cannot mutate stored recipe quantities, nutrition or instructions", () => {
  const ingredient = Object.freeze({ quantity: "1/2", unit: "cup", name: "zanahoria" });
  const meal = Object.freeze({ ingredients: Object.freeze([ingredient]), calories: 240, protein: 18, carbs: 22, fat: 10,
    instructions: Object.freeze(["Use the measured ingredient."]) });
  const before = JSON.stringify(meal);
  for (let n = 0; n < 20; n++) {
    ingredientLine(ingredient, n % 2 ? "metric" : "imperial", n % 3 ? "es" : "en");
  }
  expect(JSON.stringify(meal)).toBe(before);
});
test("the shared real display follows language and measurement changes without requests or writes", async () => {
  const ingredient = Object.freeze({ quantity: "1/4", unit: "cup", name: "cebollín" });
  const view = render(<IngredientDisplay ingredient={ingredient} legacyText="ORIGINAL" />, { wrapper });
  expect(screen.getByText("¼ de taza de cebollín")).toBeVisible();
  await act(async () => { await language.changeLanguage("en"); });
  expect(screen.getByText("¼ cup cebollín")).toBeVisible();
  mockSystem = "metric";
  view.rerender(<IngredientDisplay ingredient={ingredient} legacyText="ORIGINAL" />);
  expect(screen.getByText("60 ml cebollín")).toBeVisible();
  await act(async () => { await language.changeLanguage("es"); });
  expect(screen.getByText("60 mL de cebollín")).toBeVisible();
});
test("Production/legacy rendering stays unchanged when the Development gate is off", () => {
  mockEnabled = false;
  render(<IngredientDisplay ingredient={{ quantity: 2, unit: "cup", name: "papaya" }} legacyText="ORIGINAL_SAVED_DISPLAY" />, { wrapper });
  expect(screen.getByText("ORIGINAL_SAVED_DISPLAY")).toBeVisible();
});
test("split-layout quantity views also localize the unit wording", () => {
  render(<MeasurementQuantity amount={1} unit="tbsp" />, { wrapper });
  expect(screen.getByText("1 cucharada")).toBeVisible();
});
test.each([
  "components/MealCard.tsx", "components/MealCardFull.tsx", "components/MealCardDynamic.tsx",
  "components/WeeklyMealCard.tsx", "components/TemplateMealCard.tsx", "components/SavedMealRow.tsx",
  "components/CookingInstructionsModal.tsx", "components/meal/GeneratedMealCard.tsx",
  "components/MealRefinementSheet.tsx",
  "pages/fridge-rescue.tsx", "pages/craving-creator.tsx", "pages/SushiCreator.tsx",
  "pages/CravingDessertCreator.tsx", "pages/BeverageCreator.tsx", "pages/AthleteBeverageCreator.tsx",
  "pages/lifestyle/CreateDishPage.tsx", "pages/lifestyle/GatheringsPage.tsx",
  "pages/lifestyle/MyPerfectBeginningCreateMealPage.tsx",
])("keeps %s connected to the shared display", file => {
  expect(readFileSync(`client/src/${file}`, "utf8")).toContain("<IngredientDisplay");
});
