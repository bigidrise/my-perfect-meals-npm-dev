/** @jest-environment jsdom */
import React from "react";
import fs from "node:fs";
import ts from "typescript";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { consumerEnglish, consumerSpanish } from "@/i18n/consumerJourney";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";

let mockFree = false;
const mockGuard = jest.fn((_message, action) => { if (!mockFree) action(); });
jest.mock("@/hooks/useFreeLock", () => ({ useFreeLock: () => ({
  isFree: mockFree, showLockModal: false, lockMessage: "", guardAction: mockGuard, closeLockModal: jest.fn(),
}) }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (value: string) => value }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/lib/groceryCoachCatalogGate", () => ({ groceryCoachCatalogEnabled: false }));
jest.mock("@/components/upgrade/UpgradeLockModal", () => ({ UpgradeLockModal: () => null }));
jest.mock("@/components/MealPlanDestinationPicker", () => ({
  MealPlanDestinationPicker: ({ open, busyLabel, onSelect }: any) => open ? <div>
    <span>{busyLabel}</span>
    <button onClick={() => onSelect({ dateISO: "2026-11-18", slot: "dinner", builderType: "general" })}>Confirm destination</button>
  </div> : null,
}));
const instance = createInstance();
const meal = {
  id: "synthetic-localization", name: "ORIGINAL_RECIPE", calories: 480, protein: 30, carbs: 45, fat: 20,
  starchyCarbs: 25, fibrousCarbs: 20, ingredients: [{ name: "ORIGINAL_INGREDIENT", amount: 100, unit: "g" }],
  instructions: ["ORIGINAL_INSTRUCTIONS"], builderType: "general",
};
function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
beforeAll(async () => {
  await instance.use(initReactI18next).init({
    lng: "en", fallbackLng: "en", interpolation: { escapeValue: false },
    resources: { en: { consumerJourney: consumerEnglish }, es: { consumerJourney: consumerSpanish } },
  });
});
beforeEach(async () => {
  mockFree = false; mockGuard.mockClear();
  await instance.changeLanguage("en");
  global.fetch = jest.fn().mockRejectedValue(new Error("Unexpected offline request"));
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); });

test.each(["en", "es"])("the real Add to Plan control and outcomes use %s without changing its payload", async language => {
  await instance.changeLanguage(language);
  const dispatch = jest.spyOn(window, "dispatchEvent");
  const success = jest.fn(), before = JSON.stringify(meal);
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true, json: async () => ({ wasOccupied: false, dateISO: "2026-11-18", slot: "dinner" }),
  });
  render(<AddToMealPlanButton meal={meal} onSuccess={success} />, { wrapper: Wrapper });
  fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Añadir al plan" : "Add to Plan" }));
  expect(screen.getByText(language === "es" ? "Añadiendo…" : "Adding…")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Confirm destination" }));
  await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
  const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe("/api/weekly-board/add-meal");
  expect(JSON.parse(options.body)).toMatchObject({
    dateISO: "2026-11-18", slot: "dinner", bt: "general",
    meal: { name: meal.name, ingredients: meal.ingredients, instructions: meal.instructions,
      calories: 480, protein: 30, carbs: 45, fat: 20, starchyCarbs: 25, fibrousCarbs: 20 },
  });
  const notice = dispatch.mock.calls.map(([event]) => event as CustomEvent).find(event => event.type === "show-toast")!;
  expect(notice.detail).toMatchObject({
    title: language === "es" ? "¡Añadido al plan de comidas!" : "Added to Meal Plan!",
    description: language === "es" ? "ORIGINAL_RECIPE se añadió a tu plan." : "ORIGINAL_RECIPE was added to your plan.",
  });
  expect(JSON.stringify(meal)).toBe(before);
});

test("Spanish locked access keeps the guard and prevents any board write", async () => {
  mockFree = true;
  await instance.changeLanguage("es");
  render(<AddToMealPlanButton meal={meal} />, { wrapper: Wrapper });
  fireEvent.click(screen.getByRole("button", { name: "Añadir al plan" }));
  expect(mockGuard).toHaveBeenCalledWith("Añade comidas a tu plan semanal y registra tu nutrición con Essential.", expect.any(Function));
  expect(screen.queryByRole("button", { name: "Confirm destination" })).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test.each([true, false])("Spanish replacement/error feedback retains its existing outcome (ok=%s)", async ok => {
  await instance.changeLanguage("es");
  const dispatch = jest.spyOn(window, "dispatchEvent"), success = jest.fn();
  jest.spyOn(console, "error").mockImplementation(() => {});
  (global.fetch as jest.Mock).mockResolvedValue({ ok, json: async () => ({ wasOccupied: true }) });
  render(<AddToMealPlanButton meal={meal} onSuccess={success} />, { wrapper: Wrapper });
  fireEvent.click(screen.getByRole("button", { name: "Añadir al plan" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm destination" }));
  await waitFor(() => expect(dispatch.mock.calls.some(([event]) => event.type === "show-toast")).toBe(true));
  const notice = dispatch.mock.calls.map(([event]) => event as CustomEvent).find(event => event.type === "show-toast")!;
  if (ok) {
    expect(notice.detail.title).toBe("¡Comida reemplazada!");
    expect(success).toHaveBeenCalledTimes(1);
  } else {
    expect(notice.detail.description).toBe("No se pudo añadir la comida a tu plan. Inténtalo de nuevo.");
    expect(success).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm destination" })).toBeVisible();
  }
});

test("the actual MealCard estimate paragraph follows live language and preserves numbers/evidence", async () => {
  const file = "client/src/components/MealCard.tsx";
  const tree = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let paragraph: ts.JsxElement | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === "p" &&
      node.getText(tree).includes("Carb split estimated.")) paragraph = node;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (!paragraph) throw new Error("Expected actual MealCard estimate paragraph");
  const code = ts.transpileModule(`return (${paragraph.getText(tree)});`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText;
  const actual = new Function("React", "t", "builderSnapshot", code);
  const snapshot = { estimated: true, unclassifiedCarbs: 7.4, issues: ["ORIGINAL_EVIDENCE"] };
  const before = JSON.stringify(snapshot);
  function Paragraph() { const { t } = useConsumerCopy("mealCard"); return actual(React, t, snapshot); }
  render(<Paragraph />, { wrapper: Wrapper });
  expect(screen.getByText(/ORIGINAL_EVIDENCE/)).toHaveTextContent("Carb split estimated. 7g other/unclassified carbs.");
  await act(async () => { await instance.changeLanguage("es"); });
  expect(screen.getByText(/ORIGINAL_EVIDENCE/)).toHaveTextContent("Distribución de carbohidratos estimada. 7g de otros carbohidratos o sin clasificar.");
  expect(screen.queryByText(/Carb split estimated/)).not.toBeInTheDocument();
  expect(JSON.stringify(snapshot)).toBe(before);
  expect(global.fetch).not.toHaveBeenCalled();
});
