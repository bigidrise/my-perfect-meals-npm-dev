/** @jest-environment jsdom */
jest.mock("@/lib/shoppingMetadataGate", () => ({ shoppingMetadataEnabled: false }));
jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { apiRequest } from "@/lib/apiRequest";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { groceryCoachSelectedProductMetadata } from "@/lib/groceryCoachShoppingTransfer";
import SmartShoppingProductChoice from "@/components/shopping/SmartShoppingProductChoice";
import { buildConsolidatedItems } from "@/lib/shoppingConsolidation";
import type { IngredientScanResult } from "@/lib/photoIngredientCapture";

const clone = (value: any) => JSON.parse(JSON.stringify(value));
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function selected(item = "Whole wheat spaghetti", product = "Example pasta", recipe = "recipe-a") {
  return {
    name: item, quantity: .5, unit: "cups",
    ingredientMetadata: groceryCoachSelectedProductMetadata(
      { item, quantity: "1/2", unit: "cups" },
      { name: product, byNameAnalysis: { educationalFooter: "Check the current label." } as IngredientScanResult },
      { id: recipe, name: "Synthetic dinner" },
    ),
  };
}
let rows: any[];
beforeEach(() => {
  localStorage.clear();
  rows = [];
  useShoppingListStore.setState({ items: [], isHydrating: false });
  (apiRequest as jest.Mock).mockImplementation(async (_path: string, init: any = {}) => {
    if (init.method === "POST") {
      const created = JSON.parse(init.body).items.map((i: any, n: number) => ({
        ...i, id: `row-${rows.length + n}`, checked: false,
      }));
      rows.push(...clone(created));
      return { ok: true, items: clone(created) };
    }
    if (init.method) throw new Error("Unexpected mutation in save/reload test");
    return { items: clone(rows) };
  });
});

test("Production store saves and reloads exact ingredient/product associations without the Development store", async () => {
  const a = selected(), b = selected("Parmesan cheese", "Example cheese", "recipe-b");
  useShoppingListStore.getState().addItems([a, b]);
  await settle();
  expect(rows).toHaveLength(2);
  expect(useShoppingListStore.getState().items.every(i => i.serverId)).toBe(true);
  expect(rows[0]).toMatchObject({ name: a.name, quantity: .5, unit: "cups", ingredientMetadata: a.ingredientMetadata });
  // Simulate a fresh cache, forcing authority to come from the server read.
  useShoppingListStore.setState({ items: [] });
  await useShoppingListStore.getState().hydrate();
  const restored = useShoppingListStore.getState().items;
  expect(restored).toHaveLength(2);
  expect(restored[0].ingredientMetadata).toEqual(a.ingredientMetadata);
  expect(restored[1].ingredientMetadata).toEqual(b.ingredientMetadata);
  expect(restored[0].ingredientMetadata?.contributions[0]).toMatchObject({ quantity: "1/2", recipeId: "recipe-a" });
  expect(restored[1].ingredientMetadata?.contributions[0].recipeId).toBe("recipe-b");
  // Zustand browser-cache restoration preserves the same historical evidence.
  const saved = localStorage.getItem("shopping-list-storage")!;
  useShoppingListStore.setState({ items: [] });
  localStorage.setItem("shopping-list-storage", saved);
  const cachedStore = useShoppingListStore as typeof useShoppingListStore & {
    persist: { rehydrate: () => Promise<void> | void };
  };
  await cachedStore.persist.rehydrate();
  expect(useShoppingListStore.getState().items[0].ingredientMetadata).toEqual(a.ingredientMetadata);
});

test("different selections and recipes cannot overwrite each other or merge into generic ingredients", async () => {
  useShoppingListStore.getState().addItems([
    selected(), selected("Whole wheat spaghetti", "Other pasta"),
    selected("Whole wheat spaghetti", "Example pasta", "recipe-b"),
    { name: "Whole wheat spaghetti", quantity: 1, unit: "cups" },
  ]);
  await settle();
  useShoppingListStore.setState({ items: [] });
  await useShoppingListStore.getState().hydrate();
  const items = useShoppingListStore.getState().items;
  expect(items).toHaveLength(4);
  expect(items.filter(i => i.ingredientMetadata)).toHaveLength(3);
  expect(items.map(i => i.ingredientMetadata?.selectedProduct?.name)).toEqual(["Example pasta", "Other pasta", "Example pasta", undefined]);
  const display = buildConsolidatedItems(items);
  expect(display).toHaveLength(4);
  expect(display.filter(i => i.ingredientMetadata).map(i => i.ingredientMetadata?.selectedProduct?.name))
    .toEqual(["Example pasta", "Other pasta", "Example pasta"]);
});

test("ordinary shopping additions retain their existing merge behavior", async () => {
  useShoppingListStore.getState().addItems([
    { name: "Cucumber", quantity: 2, unit: "" },
    { name: "Cucumber", quantity: 3, unit: "" },
  ]);
  await settle();
  expect(useShoppingListStore.getState().items).toHaveLength(1);
  expect(useShoppingListStore.getState().items[0].quantity).toBe(5);
});

test("saved Coach choices remain visible without activating catalog Change/Clear/Choose experiments", () => {
  render(<SmartShoppingProductChoice item={{ ...selected(), id: "local", normalizedName: "pasta", category: "Grains & Starches", isPantryStaple: false, isChecked: false } as any}
    enabled={false} hasAccess onChoose={jest.fn()} onUpgrade={jest.fn()} onClear={jest.fn()} />);
  expect(screen.getByText("Example pasta")).toBeInTheDocument();
  expect(screen.getByText("Saved with review required")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
