/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BuilderShoppingBar from "@/components/BuilderShoppingBar";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import { createDevelopmentShoppingListStore } from "@/stores/developmentShoppingListStore";
import { recipeIngredientTransfer } from "@/lib/shoppingIngredientTransfer";

let mockStore: ReturnType<typeof createDevelopmentShoppingListStore>;
const mockNavigate = jest.fn();
const mockToast = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/weekly-meal-board", mockNavigate] }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => false }));
jest.mock("@/lib/shoppingMetadataGate", () => ({ shoppingMetadataEnabled: true }));
jest.mock("@/stores/shoppingListStore", () => ({
  useShoppingListStore: { getState: () => mockStore.getState() },
}));
jest.mock("@/lib/apiRequest", () => ({ apiRequest: () => { throw new Error("Live API forbidden"); } }));
jest.mock("@/lib/boardApi", () => ({
  getDayLists: (board: any, day: string) => board.days[day] || { breakfast: [], lunch: [], dinner: [], snacks: [] },
}));
jest.mock("@/hooks/useWeekBoardCache", () => ({
  useWeekBoardCache: () => ({ getWeek: () => null, setWeek: jest.fn(), invalidateWeeks: jest.fn() }),
}));
jest.mock("@/lib/activeBuilderNs", () => ({ getActiveBuilderNs: () => null }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (p: string) => p }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/utils/dateRange", () => ({
  getRolling7Days: () => ["2026-11-09", "2026-11-10", "2026-11-11"],
}));
jest.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));
jest.mock("@capacitor/share", () => ({ Share: { share: jest.fn() } }));

let rows: any[];
let serial: number;
const clone = (value: any) => JSON.parse(JSON.stringify(value));
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("userId", "synthetic-builder-audit");
  rows = [];
  serial = 0;
  jest.clearAllMocks();
  global.fetch = jest.fn(() => { throw new Error("Network forbidden"); });
  mockStore = createDevelopmentShoppingListStore(jest.fn(async (url: string, init: RequestInit = {}) => {
    if (!init.method) return { items: clone(rows), shoppingMetadataVersion: 1, ownerUserId: "synthetic-builder-audit" };
    const body = JSON.parse(String(init.body));
    if (init.method === "POST" && url === "/api/shopping-list") {
      const items = body.items.map((i: any) => ({ ...clone(i), id: `audit-${++serial}`, userId: "synthetic-builder-audit" }));
      rows.push(...items);
      return { items: clone(items) };
    }
    if (init.method === "PATCH") {
      const item = rows.find(i => url === `/api/shopping-list-v2/${i.id}`);
      if (!item) throw new Error("Unknown synthetic shopping row");
      Object.assign(item, clone(body));
      return { item: clone(item) };
    }
    throw new Error(`Unexpected synthetic request ${url}`);
  }));
});
const meal = (id: string, quantity: number | string, servings = 3) => ({
  id, name: id, servings, ingredients: [{ name: "chicken breast", quantity, unit: "lb" }],
});
const empty = () => ({ breakfast: [], lunch: [], dinner: [], snacks: [] });
function board() {
  return { days: {
    "2026-11-09": { ...empty(), lunch: [meal("recipe-a", 2)] },
    "2026-11-10": { ...empty(), dinner: [meal("recipe-b", 2)] },
    "2026-11-11": { ...empty(), dinner: [meal("not-selected", 9)] },
  } } as any;
}
test("existing builder selects multiple days, combines 2 lb + 2 lb, and persists only selected meals", async () => {
  render(<BuilderShoppingBar board={board()} activeDayISO="2026-11-09" currentWeekStartISO="2026-11-09" />);
  fireEvent.click(screen.getByTestId("button-choose-days-shopping"));
  fireEvent.click(screen.getByRole("button", { name: /11\/9/ }));
  fireEvent.click(screen.getByRole("button", { name: /11\/10/ }));
  fireEvent.click(screen.getByTestId("button-confirm-days-shopping"));
  await mockStore.getState().hydrate();
  expect(rows).toHaveLength(1);
  expect(Number(rows[0].quantity)).toBe(4);
  expect(mockStore.getState().items[0].quantity).toBe(4);
  expect(mockNavigate).toHaveBeenCalledWith("/shopping-list-v2");
});
test("recipe-total ingredients are not multiplied again by the meal's three servings", async () => {
  render(<BuilderShoppingBar board={board()} activeDayISO="2026-11-09" currentWeekStartISO="2026-11-09" />);
  fireEvent.click(screen.getByTestId("button-send-day-shopping"));
  await mockStore.getState().hydrate();
  expect(Number(rows[0].quantity)).toBe(2);
});
test("a six-serving recipe already scaled to 4 lb transfers 4 lb, not 24 lb", async () => {
  const adjusted = board();
  adjusted.days["2026-11-09"].lunch = [meal("scaled-recipe", 4, 6)];
  render(<BuilderShoppingBar board={adjusted} activeDayISO="2026-11-09" currentWeekStartISO="2026-11-09" />);
  fireEvent.click(screen.getByTestId("button-send-day-shopping"));
  await mockStore.getState().hydrate();
  expect(Number(rows[0].quantity)).toBe(4);
});
test.each(["1/2", "½", "1 1/2"])("shared preparation and real Development store preserve fraction %s", async q => {
  const prepared = recipeIngredientTransfer({ name: "flour", quantity: q, unit: "cup" }, { id: "fraction", name: "Fraction" });
  mockStore.getState().addItems([{ name: prepared.name, quantity: prepared.qty, unit: prepared.unit, ingredientMetadata: prepared.ingredientMetadata }]);
  await mockStore.getState().hydrate();
  expect(Number(rows[0].quantity)).toBe(q === "1 1/2" ? 1.5 : .5);
});
test("different recipes preserve previous groceries and incompatible weight/volume units stay separate", async () => {
  mockStore.getState().addItems([
    { name: "chicken breast", quantity: 2, unit: "lb" },
    { name: "chicken breast", quantity: 16, unit: "oz" },
    { name: "chicken breast", quantity: 1, unit: "cup" },
    { name: "apples", quantity: 3, unit: "" },
  ]);
  await mockStore.getState().hydrate();
  expect(mockStore.getState().items.find(i => i.unit === "lb")?.quantity).toBe(3);
  expect(mockStore.getState().items.find(i => i.unit === "cup")?.quantity).toBe(1);
  expect(mockStore.getState().items.find(i => i.name === "apples")?.quantity).toBe(3);
});
test("characterization: current aggregate bar loses a fraction; Phase 1 must not silently rewrite shopping", async () => {
  render(<ShoppingAggregateBar ingredients={[{ name: "flour", qty: "1/2", unit: "cup" }]} />);
  fireEvent.click(screen.getByTestId("button-go-to-shopping-list"));
  await mockStore.getState().hydrate();
  expect(Number(rows[0].quantity)).toBe(1); // Known Phase 2 gap, not desired behavior.
});
test("characterization: repeated current builder sends add again; Phase 2 must supply repeat protection", async () => {
  render(<BuilderShoppingBar board={board()} activeDayISO="2026-11-09" currentWeekStartISO="2026-11-09" />);
  fireEvent.click(screen.getByTestId("button-send-day-shopping"));
  await mockStore.getState().hydrate();
  fireEvent.click(screen.getByTestId("button-send-day-shopping"));
  await mockStore.getState().hydrate();
  expect(Number(rows[0].quantity)).toBe(4); // Known gap, deliberately unchanged here.
});
