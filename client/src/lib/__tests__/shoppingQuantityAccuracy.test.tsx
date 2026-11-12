/** @jest-environment jsdom */
import React from "react";
import { render as renderComponent, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import "@testing-library/jest-dom";
import { buildConsolidatedItems } from "@/lib/shoppingConsolidation";
import { getRetailQuantity } from "@/lib/retailIntelligence";
import { ShoppingQuantity } from "@/components/shopping/ShoppingQuantity";
import { selectionForRecipe, prepareShoppingSelection } from "@shared/mealShoppingSelection";
jest.unmock("react-i18next");
jest.mock("@/lib/shoppingMetadataGate", () => ({ shoppingMetadataEnabled: true }));
const languages = ["en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko", "ar", "hi", "ru", "vi", "tl"];
const translations = Object.fromEntries(languages.map(language => [
  language, require(`../../i18n/locales/${language}.json`).shoppingTransfer,
]));
const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({
    lng: "en", fallbackLng: "en",
    resources: Object.fromEntries(languages.map(language => [language, { shoppingTransfer: translations[language] }])),
    interpolation: { escapeValue: false },
  });
});
beforeEach(async () => { await i18n.changeLanguage("en"); });
const render = (element: React.ReactElement) =>
  renderComponent(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>);
const item = (id: string, quantity: number, unit: string, name = "salmon fillet") => ({
  id, name, normalizedName: name, quantity, unit, category: "Meat" as const, isChecked: false, isPantryStaple: false,
});
test.each(languages)("Shopping quantities use registered %s text without changing measurements", async language => {
  await i18n.changeLanguage(language);
  const consolidated = buildConsolidatedItems([item("a", 12, "oz")])[0];
  render(<ShoppingQuantity item={consolidated} />);
  expect(screen.getByText(translations[language].quantityNeeded.replace("{{quantity}}", "12 oz"))).toBeVisible();
  expect(screen.getByText(translations[language].quantityBuy.replace("{{quantity}}", "0.75 lb"))).toBeVisible();
  expect(screen.getByTitle(translations[language].quantityEstimateHint)).toBeVisible();
  expect(consolidated.requiredAmounts).toEqual([{ quantity: 12, unit: "oz" }]);
});
test("the two-serving salmon recipe transfers its total 12 oz exactly once", () => {
  const { selection } = selectionForRecipe({ id: "salmon", name: "Baked Salmon", servings: 2,
    ingredients: [{ name: "salmon fillet", quantity: "12", unit: "oz" }] }, "create-dish");
  expect(selection).toMatchObject({ recipeYield: 2, shoppingServings: 2, quantityBasis: "recipe_total" });
  expect(prepareShoppingSelection(selection!)[0]).toMatchObject({ quantity: 12, unit: "oz" });
  const consolidated = buildConsolidatedItems([item("a", 12, "oz")])[0];
  expect(consolidated.requiredAmounts).toEqual([{ quantity: 12, unit: "oz" }]);
  expect(getRetailQuantity(consolidated)).toBe("0.75 lb");
  render(<ShoppingQuantity item={consolidated} />);
  expect(screen.getByText("Needed: 12 oz")).toBeVisible();
  expect(screen.getByText(/Buy: 0.75 lb/)).toBeVisible();
});
test("doubling shopping servings scales the recipe total only once", () => {
  const { selection } = selectionForRecipe({ id: "salmon", name: "Salmon", servings: 2,
    shoppingServings: 4, ingredients: [{ name: "salmon", quantity: 12, unit: "oz" }] }, "create-dish");
  expect(prepareShoppingSelection(selection!)[0].quantity).toBe(24);
});
test("the reported three additions total 36 oz, not one recipe, with no forced half-pound rounding", () => {
  const consolidated = buildConsolidatedItems([item("a", 12, "oz"), item("b", 12, "oz"), item("c", 12, "oz")])[0];
  expect(consolidated.requiredAmounts).toEqual([{ quantity: 36, unit: "oz" }]);
  expect(consolidated.mergedCount).toBe(3);
  expect(getRetailQuantity(consolidated)).toBe("2.25 lb");
});
test("another meal's half-pound salmon combines with 12 oz to exactly 1.25 lb", () => {
  const consolidated = buildConsolidatedItems([item("a", 12, "oz"), item("b", 0.5, "lb")]);
  expect(consolidated).toHaveLength(1);
  expect(getRetailQuantity(consolidated[0])).toBe("1.25 lb");
  expect(consolidated[0].requiredAmounts).toEqual([{ quantity: 12, unit: "oz" }, { quantity: 0.5, unit: "lb" }]);
});
test("volume and weight do not merge using an invented water density", () => {
  expect(buildConsolidatedItems([item("a", 2, "cup", "zucchini"), item("b", 100, "g", "zucchini")])).toHaveLength(2);
});
test("unknown units and fractional counts are preserved rather than dropped or rounded", () => {
  const bunch = buildConsolidatedItems([item("a", 0.5, "bunch", "asparagus"), item("b", 0.25, "bunch", "asparagus")])[0];
  expect(bunch.quantity).toBe(0.75);
  expect(bunch.unit).toBe("bunch");
  expect(buildConsolidatedItems([item("a", 0.25, "", "onion")])[0].quantity).toBe(0.25);
});
test("cloves and bulbs stay distinct; produce volume does not invent purchase counts", () => {
  expect(buildConsolidatedItems([item("a", 4, "cloves", "garlic"), item("b", 1, "bulb", "garlic")])).toHaveLength(2);
  expect(getRetailQuantity({ ...item("a", 473.176, "ml", "zucchini"), category: "Produce" })).toBeNull();
});
