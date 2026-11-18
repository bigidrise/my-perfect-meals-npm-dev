/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, renderHook, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { foodWorkflowSpanish } from "@/i18n/foodWorkflowCopy";
import { consumerEnglish, consumerSpanish } from "@/i18n/consumerJourney";
import Footer from "@/components/UniversalMealCardFooter";
import MealGenerationProgress from "@/components/MealGenerationProgress";
import BarcodeScanButton from "@/components/shopping/BarcodeScanButton";
import VoiceShoppingModal from "@/components/shopping/VoiceShoppingModal";
import BuilderShoppingBar from "@/components/BuilderShoppingBar";
import VoiceInputButton from "@/components/voice/VoiceInputButton";
import { KeepItSimpleToggle } from "@/components/KeepItSimpleToggle";
import AddOtherItems from "@/components/AddOtherItems";
import { post } from "@/lib/api";
import { apiRequest } from "@/lib/apiRequest";
import { getMealGenerationCopy } from "@/lib/mealGenerationProgress";
import type { MealGenerationContext, MealGenerationMode } from "@/lib/mealGenerationProgress";
import { useMealGenerationProgress } from "@/hooks/useMealGenerationProgress";

const mockToast = jest.fn();
const mockNavigate = jest.fn();
const mockInvalidate = jest.fn();
const mockAddItems = jest.fn();
const mockAddItem = jest.fn();
const mockWeekCache = { getWeek: () => null, setWeek: jest.fn(), invalidateWeeks: jest.fn() };
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("wouter", () => ({ useLocation: () => ["/", mockNavigate] }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidate }) }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "offline-food-copy" } }) }));
jest.mock("@/lib/api", () => ({ post: jest.fn() }));
jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));
jest.mock("@/hooks/useMealShopping", () => ({
  useMealShopping: () => ({ checked: true, available: false, legacyAllowed: true, pending: false }),
}));
jest.mock("@/hooks/useWeekBoardCache", () => ({ useWeekBoardCache: () => mockWeekCache }));
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => false }));
jest.mock("@/stores/shoppingListStore", () => ({
  useShoppingListStore: Object.assign(() => ({ addItem: mockAddItem }), {
    getState: () => ({ addItems: mockAddItems }),
  }),
}));
jest.mock("@/lib/boardApi", () => ({
  getDayLists: () => ({ breakfast: [{ id: "board-meal", ingredients: ["Raw item"] }], lunch: [], dinner: [], snacks: [] }),
}));
jest.mock("@/utils/ingredientParser", () => ({
  normalizeIngredients: () => [{ name: "Raw item", qty: 2, unit: "oz" }],
}));
jest.mock("@/lib/macroLogGuard", () => ({
  canLogMealToMacros: () => true, markMealLogged: jest.fn(), fingerprintMeal: () => "offline-meal",
}));

const meal = {
  id: "offline-meal", name: "Authored name stays unchanged", mealType: "lunch",
  nutritionPerServing: { calories: 321, protein: 22, carbs: 31, fat: 11, starchyCarbs: 10, fibrousCarbs: 21 },
};
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  (post as jest.Mock).mockResolvedValue({});
  (apiRequest as jest.Mock).mockResolvedValue({ items: [{ name: "Unchanged item", quantity: 2, unit: "oz" }] });
  // Any unexpected request fails locally, never reaching the shared database.
  global.fetch = jest.fn(() => Promise.reject(Error("Unexpected network in offline copy test"))) as any;
});
afterEach(() => cleanup());

test("all food resources have nonempty matching EN/ES interpolation without changing existing catalogs", () => {
  const variables = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map(x => x[1]).sort();
  for (const key of Object.keys(foodWorkflowSpanish)) {
    expect(consumerEnglish[key]).toBe(key);
    expect(consumerSpanish[key]?.trim()).toBeTruthy();
    expect(variables(consumerSpanish[key])).toEqual(variables(key));
  }
});

test.each(["en", "es"])("%s meal footer keeps macro payload, serving math and authored names intact", async language => {
  await i18n.changeLanguage(language);
  render(<Footer meal={meal as any} currentServings={2} />);
  fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Registrar en macros" : "Log to Macros" }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledWith("/api/macros/log", expect.objectContaining({
    mealId: meal.id, mealType: "lunch", source: "template_hub", qty: 2, unit: "serving",
    nutrition: { calories: 642, protein_g: 44, carbs_g: 62, fat_g: 22 },
    starchyCarbs: 20, fibrousCarbs: 42,
    meta: expect.objectContaining({ mealName: `${meal.name} (2 servings)`, servings: 2 }),
  }));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
    title: language === "es" ? "Registro completado" : "Logged Successfully",
    description: expect.stringContaining(meal.name),
  })));
});

test("replacement and weekly-plan actions keep their original meal data", async () => {
  await i18n.changeLanguage("es");
  const replace = jest.fn();
  render(<Footer meal={meal as any} currentServings={3} onReplace={replace} />);
  fireEvent.click(screen.getByRole("button", { name: "Reemplazar" }));
  expect(replace).toHaveBeenCalledWith(meal);
  fireEvent.click(screen.getByRole("button", { name: "Añadir al plan" }));
  expect(mockNavigate).toHaveBeenCalledWith("/weekly-meal-board");
  expect(JSON.parse(localStorage.getItem("weeklyPlanMealToAdd")!).meal).toEqual(expect.objectContaining({
    name: meal.name, servings: 3, nutritionPerServing: meal.nutritionPerServing,
    cookingTime: "30 minutes", difficulty: "Medium", source: "template",
  }));
  expect(post).not.toHaveBeenCalled();
});

test("ordinary progress changes language live while protected context wording stays exact", async () => {
  await i18n.changeLanguage("es");
  const view = render(<MealGenerationProgress context="create-dish" mode="options" />);
  expect(screen.getByText("Chef está preparando tus opciones de comida…")).toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage("en"); });
  expect(screen.getByText("Chef is crafting your meal options…")).toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage("es"); });
  for (const context of ["pregnancy", "pediatric", "diabetes", "glp1"] as const) {
    view.rerender(<MealGenerationProgress context={context} />);
    expect(screen.getByText(getMealGenerationCopy(context).messages[0])).toBeInTheDocument();
  }
});

test("all shared progress contexts and modes preserve exact English titles and full message order", async () => {
  await i18n.changeLanguage("en");
  jest.useFakeTimers();
  try {
    const contexts: MealGenerationContext[] = [
      "general", "create-dish", "snack", "dessert", "fridge-rescue", "pediatric", "pregnancy",
      "companion", "gathering", "diabetes", "glp1", "performance", "sushi", "restaurant", "fast-food", "beverage", "pairing",
    ];
    for (const context of contexts) for (const mode of ["single", "options", "search", "pairing"] as MealGenerationMode[]) {
      const expected = getMealGenerationCopy(context, mode);
      const view = renderHook(() => useMealGenerationProgress(true, context, mode, 1000));
      expect(view.result.current.title).toBe(expected.title);
      for (const message of expected.messages) {
        expect(view.result.current.message).toBe(message);
        act(() => { jest.advanceTimersByTime(1000); });
      }
      view.unmount();
    }
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test("Spanish manual barcode entry passes the unmodified barcode to its handler", async () => {
  await i18n.changeLanguage("es");
  const prompt = jest.spyOn(window, "prompt").mockReturnValue("0012345678905");
  const onScan = jest.fn();
  render(<BarcodeScanButton onScan={onScan} />);
  fireEvent.click(screen.getByRole("button", { name: "Introducción manual" }));
  expect(prompt).toHaveBeenCalledWith("Introduce el número del código de barras:");
  expect(onScan).toHaveBeenCalledWith("0012345678905");
  prompt.mockRestore();
});

test.each(["en", "es"])("%s shopping bar localizes day labels without changing transferred items or saved notes", async language => {
  await i18n.changeLanguage(language);
  render(<BuilderShoppingBar board={{} as any} activeDayISO="2026-11-17" currentWeekStartISO="2026-11-16" />);
  const buttonName = language === "es" ? "Send martes" : "Send Tuesday";
  // The Spanish verb changes; the stored legacy note does not.
  const sendName = language === "es" ? "Enviar martes" : buttonName;
  fireEvent.click(screen.getByRole("button", { name: sendName }));
  expect(mockAddItems).toHaveBeenCalledWith([{
    name: "Raw item", quantity: 2, unit: "oz", notes: "Tuesday Meal Plan",
  }]);
  expect(mockNavigate).toHaveBeenCalledWith("/shopping-list-v2");
});

test("Spanish voice-shopping review preserves transcript, item quantities and confirm behavior", async () => {
  await i18n.changeLanguage("es");
  const confirm = jest.fn(), close = jest.fn();
  render(<VoiceShoppingModal open onClose={close} onConfirm={confirm} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "original typed input" } });
  fireEvent.click(screen.getByRole("button", { name: "Interpretar artículos con IA" }));
  await waitFor(() => expect(screen.getByText("1 artículo encontrado")).toBeInTheDocument());
  expect(apiRequest).toHaveBeenCalledWith("/api/shopping-list-v2/parse-voice", {
    method: "POST", body: JSON.stringify({ transcript: "original typed input" }),
  });
  fireEvent.click(screen.getByRole("button", { name: "Añadir 1 artículo" }));
  expect(confirm).toHaveBeenCalledWith([{ name: "Unchanged item", quantity: 2, unit: "oz" }]);
  expect(close).toHaveBeenCalled();
});

test("shared voice caption and unsupported feedback are Spanish without changing the typed value", async () => {
  await i18n.changeLanguage("es");
  const change = jest.fn();
  render(<VoiceInputButton value="Do not change this" onChange={change} />);
  expect(screen.getByText("Entrada por voz")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Usar entrada por voz" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Este navegador no admite la entrada por voz. Puedes seguir escribiendo.");
  expect(change).not.toHaveBeenCalled();
});

test("ordinary ingredient-control wording is Spanish and keeps its boolean toggle contract", async () => {
  await i18n.changeLanguage("es");
  const toggle = jest.fn();
  render(<KeepItSimpleToggle keepItSimple={false} onToggle={toggle} />);
  expect(screen.getByText("Hazlo sencillo")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Hazlo sencillo desactivado: toca para activar" }));
  expect(toggle).toHaveBeenCalledWith(true);
});

test("Spanish Add Other Items preserves user text, numeric quantity and saved unit/category", async () => {
  await i18n.changeLanguage("es");
  render(<AddOtherItems />);
  expect(screen.getByText("Añadir otros artículos")).toBeInTheDocument();
  fireEvent.change(screen.getByTestId("input-other-item-name"), { target: { value: "My unchanged item" } });
  fireEvent.change(screen.getByTestId("input-other-item-brand"), { target: { value: "My brand" } });
  fireEvent.change(screen.getByTestId("input-other-item-qty"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir a la lista" }));
  expect(mockAddItem).toHaveBeenCalledWith({
    name: "My brand My unchanged item", quantity: 3, unit: "unit", category: "Other",
  });
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Añadido a tu lista" }));
});
