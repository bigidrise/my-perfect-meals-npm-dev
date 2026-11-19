/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { consumerFeatureSpanish } from "@/i18n/consumerFeatureCopy";
import { consumerEnglish, consumerSpanish } from "@/i18n/consumerJourney";
import { useCreatorOptionLabels } from "@/i18n/useCreatorOptionLabels";
import { CREATOR_CUISINE_OPTIONS, CREATOR_DIET_OPTIONS } from "@/utils/getEffectiveDietPreference";
import { DietOverrideControl } from "@/components/ui/DietOverrideControl";
import { CuisineOverrideControl } from "@/components/ui/CuisineOverrideControl";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import ServingInstructionsBlock from "@/components/ServingInstructionsBlock";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import { useMenuDisplayCopy } from "@/i18n/useMenuDisplayCopy";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let mockDesktop = false;
let mockShopping: any;
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => mockDesktop }));
jest.mock("@/hooks/useMealShopping", () => ({ useMealShopping: () => mockShopping }));
jest.mock("wouter", () => ({ useLocation: () => ["/lifestyle/create-a-dish", jest.fn()] }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/stores/shoppingListStore", () => ({ useShoppingListStore: { getState: () => ({ addItems: jest.fn() }) } }));
jest.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));
jest.mock("@capacitor/share", () => ({ Share: { share: jest.fn() } }));
beforeEach(() => {
  mockShopping = { pending: false, result: null, message: "", checked: true, available: true, send: jest.fn() };
  global.fetch = jest.fn(() => Promise.reject(Error("Unexpected network in offline localization test"))) as any;
});
afterEach(cleanup);

test("new ordinary copy has exact English source keys and matching Spanish variables", () => {
  const variables = (value: string) => [...value.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).sort();
  for (const key of Object.keys(consumerFeatureSpanish)) {
    expect(consumerEnglish[key]).toBe(key);
    expect(consumerSpanish[key]?.trim()).toBeTruthy();
    expect(variables(consumerSpanish[key])).toEqual(variables(key));
  }
});

test.each(["en", "es"])("%s screenshot labels resolve through the real namespaces", async language => {
  await i18n.changeLanguage(language);
  const { result } = renderHook(() => useConsumerCopy("lifestyle"));
  expect(result.current.t("My Perfect Beginning")).toBe(
    language === "es" ? "Mis Comienzos Perfectos" : "My Perfect Beginning",
  );
  expect(result.current.t("NEW")).toBe(language === "es" ? "NUEVO" : "NEW");
  expect(result.current.t("Stage-by-stage child nutrition — from first foods to growing years")).toBe(
    language === "es"
      ? "Nutrición infantil por etapas: desde los primeros alimentos hasta los años de crecimiento"
      : "Stage-by-stage child nutrition — from first foods to growing years",
  );
  const backLabel = i18n.t("diabeticBuilder.backLabel");
  expect(backLabel).toBe(language === "es" ? "Centro para diabéticos" : "Diabetes Hub");
  const menu = renderHook(useMenuDisplayCopy);
  expect(menu.result.current.builders.diabetic).toBe(
    language === "es" ? "Creador de comidas para la diabetes" : "Diabetic Builder",
  );
});

test("Create a Dish source keeps voice and clear controls in the same action row", () => {
  const source = readFileSync(resolve("client/src/pages/lifestyle/CreateDishPage.tsx"), "utf8");
  const actions = source.slice(source.indexOf('data-testid="dish-input-actions"'), source.indexOf("{dishInput.length}/300"));
  expect(actions).toContain("<VoiceInputButton");
  expect(actions).toContain("<TrashButton");
  expect(actions.indexOf("<VoiceInputButton")).toBeLessThan(actions.indexOf("<TrashButton"));
  expect(actions).toContain('className="ml-auto shrink-0"');
  expect(actions).not.toContain('className="absolute');
  expect(actions).toContain('onClick={() => updateDishInput("")}');
  const builder = readFileSync(resolve("client/src/pages/physician/DiabeticMenuBuilder.tsx"), "utf8");
  expect(builder).not.toContain(">Diabetes Hub</span>");
  expect(builder).toContain('{t("diabeticBuilder.backLabel")}');
});

test.each(["en", "es"])("%s closed option labels never change canonical selections", async language => {
  await i18n.changeLanguage(language);
  const before = JSON.stringify([CREATOR_DIET_OPTIONS, CREATOR_CUISINE_OPTIONS]);
  const { result } = renderHook(useCreatorOptionLabels);
  expect(result.current.Thanksgiving).toBe(language === "es" ? "Acción de Gracias" : "Thanksgiving");
  expect(result.current.Mexican).toBe(language === "es" ? "Mexicana" : "Mexican");
  expect(result.current.Vegan).toBe(language === "es" ? "Vegano" : "Vegan");
  const onDietToggle = jest.fn(), onCuisineToggle = jest.fn();
  render(React.createElement(React.Fragment, null,
    React.createElement(DietOverrideControl, { overrideEnabled: false, overrideDiet: "vegan", onToggle: onDietToggle, onDietChange: jest.fn() }),
    React.createElement(CuisineOverrideControl, { overrideEnabled: false, overrideCuisine: "mexican", onToggle: onCuisineToggle, onCuisineChange: jest.fn() }),
  ));
  fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Otra alimentación" : "Different Diet" }));
  fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Otra cocina" : "Different Cuisine" }));
  expect(onDietToggle).toHaveBeenCalledWith(true);
  expect(onCuisineToggle).toHaveBeenCalledWith(true);
  expect(JSON.stringify([CREATOR_DIET_OPTIONS, CREATOR_CUISINE_OPTIONS])).toBe(before);
});

describe.each(["en", "es"])("%s shopping aggregate states", language => {
  test.each([true, false])("desktop=%s retains its real add/update/pending labels", async desktop => {
    await i18n.changeLanguage(language); mockDesktop = desktop;
    const props = { ingredients: [{ name: "Original ingredient", qty: 2, unit: "oz" }, { name: "Otro ingrediente", qty: 250, unit: "g" }] };
    const before = JSON.stringify(props);
    const view = render(React.createElement(ShoppingAggregateBar, props));
    expect(screen.getAllByText(language === "es" ? "Lista de compras preparada" : "Grocery List Ready")).toHaveLength(2);
    expect(screen.getByRole("button", { name: language === "es" ? "Añadir y ver lista" : "Add & View List" })).toBeEnabled();
    mockShopping.result = { committed: false };
    view.rerender(React.createElement(ShoppingAggregateBar, props));
    expect(screen.getByRole("button", { name: language === "es" ? "Actualizar compras" : "Update Shopping" })).toBeEnabled();
    mockShopping.pending = true;
    view.rerender(React.createElement(ShoppingAggregateBar, props));
    expect(screen.getByRole("button", { name: language === "es" ? "Guardando…" : "Saving…" })).toBeDisabled();
    expect(JSON.stringify(props)).toBe(before);
    expect(mockShopping.send).not.toHaveBeenCalled();
  });
});

test.each(["en", "es"])("%s serving guidance preserves classification, count and percentage", async language => {
  await i18n.changeLanguage(language);
  render(React.createElement(ServingInstructionsBlock, { servings: 4, portionMethod: "container-divided", mealName: "Unchanged family recipe" }));
  expect(screen.getByText(language === "es" ? "Reparte por igual en 4 tarros o boles." : "Divide evenly into 4 jars or bowls.")).toBeInTheDocument();
  expect(screen.getByText(/~30%|30 %/)).toBeInTheDocument();
});
