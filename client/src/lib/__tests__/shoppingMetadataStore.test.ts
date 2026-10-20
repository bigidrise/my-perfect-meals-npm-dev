/** @jest-environment jsdom */
import { createDevelopmentShoppingListStore } from "../../stores/developmentShoppingListStore";
import { makeIngredientMetadata } from "@shared/shoppingIngredientMetadata";
import { recipeIngredientTransfer } from "../shoppingIngredientTransfer";
import { buildConsolidatedItems } from "../shoppingConsolidation";

jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn(() => { throw new Error("Unexpected live request"); }) }));
jest.mock("@/lib/shoppingMetadataGate", () => ({ shoppingMetadataEnabled: true }));
const clone = (value: any) => JSON.parse(JSON.stringify(value));

function fixture() {
  let rows: any[] = [];
  let serial = 0;
  const calls: Array<{ path: string; init: RequestInit }> = [];
  const api = jest.fn(async (path: string, init: RequestInit = {}) => {
    calls.push({ path, init });
    const account = localStorage.getItem("userId");
    const body = init.body ? JSON.parse(String(init.body)) : {};
    if (init.method === "POST") {
      const created = body.items.map((i: any) => ({ ...i, id: `server-${++serial}`, userId: account, checked: false }));
      rows.push(...clone(created)); return { items: clone(created) };
    }
    if (init.method === "PATCH") {
      const item = rows.find(i => i.id === path.split("/").pop() && i.userId === account);
      if (!item) throw new Error("Unknown account item");
      Object.assign(item, clone(body)); return { item: clone(item) };
    }
    if (init.method === "DELETE") {
      rows = rows.filter(i => i.userId !== account || (path !== "/api/shopping-list-v2/" && i.id !== path.split("/").pop()));
      return { ok: true };
    }
    return { items: clone(rows.filter(i => i.userId === account)), shoppingMetadataVersion: 1, ownerUserId: account };
  });
  const store = createDevelopmentShoppingListStore(api);
  return { store, api, calls, seed: (items: any[]) => { rows = items; } };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
beforeEach(() => { localStorage.clear(); localStorage.setItem("userId", "synthetic-a"); });

test("transfer preserves original quantity and source before numeric normalization", () => {
  const item = recipeIngredientTransfer({ name: "low-sodium soy sauce", quantity: "1/2", unit: "cup" }, { id: "r1", name: "Synthetic recipe", source: "builder" });
  expect(item.qty).toBe(.5);
  expect(item.ingredientMetadata.contributions[0]).toMatchObject({ quantity: "1/2", unit: "cup", recipeId: "r1" });
});
test("save, update, refresh and browser-cache restoration retain metadata", async () => {
  const { store, api } = fixture();
  const m = makeIngredientMetadata({ name: "reduced-sugar jam", quantity: "1/4", unit: "cup" });
  store.getState().addItems([{ name: "reduced-sugar jam", quantity: .25, unit: "cup", ingredientMetadata: m }]);
  await store.getState().hydrate();
  expect(store.getState().items[0].ingredientMetadata).toEqual(m);
  const id = store.getState().items[0].id;
  store.getState().updateItem(id, { quantity: 2 });
  await store.getState().hydrate();
  expect(store.getState().items[0].quantity).toBe(2);
  expect(store.getState().items[0].ingredientMetadata?.contributions[0].quantity).toBe("1/4");
  const restored = createDevelopmentShoppingListStore(api);
  expect(restored.getState().items[0].ingredientMetadata).toEqual(m);
});
test("consolidation never merges incompatible qualifiers, product identities or generic choices", async () => {
  const { store } = fixture();
  for (const name of ["soy sauce", "low-sodium soy sauce", "low-sodium soy sauce"]) {
    store.getState().addItems([{ name, quantity: 1, unit: "tbsp" }]);
  }
  await store.getState().hydrate();
  const list = buildConsolidatedItems(store.getState().items);
  expect(list).toHaveLength(2);
  expect(list.find(i => i.name === "low-sodium soy sauce")?.ingredientMetadata?.contributions).toHaveLength(2);
  const base = makeIngredientMetadata({ name: "Bread", quantity: 1 });
  const product = (key: string) => ({
    ...base, selectedProduct: {
      productKey: key, name: "Bread", brand: "Example", variant: key,
      source: { source: "synthetic-catalog", sourceRecordId: key }, evidence: [],
      assessment: { status: "review_required" as const, unresolvedRequirements: ["label"], reasons: [] },
    },
  });
  const row = store.getState().items[0];
  expect(buildConsolidatedItems([
    { ...row, id: "p1", name: "Bread", ingredientMetadata: product("p1") },
    { ...row, id: "p2", name: "Bread", ingredientMetadata: product("p2") },
    { ...row, id: "generic", name: "Bread", ingredientMetadata: base },
  ])).toHaveLength(3);
});
test("same ingredient retains multiple recipe contributions and selected product through refresh", async () => {
  const { store } = fixture();
  for (const recipeId of ["r1", "r2"]) {
    store.getState().addItems([{ name: "gluten-free bread", quantity: 1, unit: "slice", ingredientMetadata:
      makeIngredientMetadata({ name: "gluten-free bread", quantity: 1, unit: "slice", recipeId }) }]);
  }
  await store.getState().hydrate();
  expect(store.getState().items).toHaveLength(1);
  expect(store.getState().items[0].ingredientMetadata?.contributions).toHaveLength(2);
  const row = store.getState().items[0];
  const m = row.ingredientMetadata!;
  store.getState().updateItem(row.id, { ingredientMetadata: { ...m, selectedProduct: {
    productKey: "upc::12345678", name: "Bread", brand: "Synthetic", upc: "12345678",
    source: { source: "fixture", sourceRecordId: "exact" }, evidence: [],
    retailQuantity: 1, assessment: { status: "review_required", unresolvedRequirements: ["label"], reasons: [] },
  } } });
  await store.getState().hydrate();
  expect(store.getState().items[0].ingredientMetadata?.selectedProduct?.upc).toBe("12345678");
  expect(store.getState().items[0].ingredientMetadata?.contributions).toHaveLength(2);
});
test("legacy rows are read without backfill writes and remain backward compatible", async () => {
  const { store, seed, calls } = fixture();
  seed([{ id: "legacy", userId: "synthetic-a", name: "Broccoli", quantity: "1", unit: "head" }]);
  await store.getState().hydrate();
  expect(store.getState().items[0].name).toBe("Broccoli");
  expect(store.getState().items[0].ingredientMetadata).toBeUndefined();
  expect(calls.every(c => !c.init.method)).toBe(true);
});
test("account switches neither upload the former cache nor accept its late response", async () => {
  const { store, calls } = fixture();
  store.getState().addItems([{ name: "vegan cheese", quantity: 1, unit: "oz" }]);
  await store.getState().hydrate();
  const old = store.getState().items[0];
  localStorage.setItem("userId", "synthetic-b");
  await store.getState().hydrate();
  expect(store.getState().items).toEqual([]);
  store.getState().updateItem(old.id, { quantity: 99 });
  await settle();
  expect(calls.filter(c => c.init.method === "PATCH")).toHaveLength(0);
  expect(localStorage.getItem("shopping-list-storage:development:synthetic-a")).toContain("vegan cheese");
});
test("late hydration from the previous account cannot replace the active account's list", async () => {
  let release!: (value: any) => void;
  const pending = new Promise(resolve => { release = resolve; });
  const api = jest.fn(async () => localStorage.getItem("userId") === "synthetic-a" ? pending : {
    items: [{ id: "b", name: "Account B item", quantity: "1", unit: "" }],
    shoppingMetadataVersion: 1, ownerUserId: "synthetic-b",
  });
  const store = createDevelopmentShoppingListStore(api);
  const first = store.getState().hydrate();
  await settle();
  localStorage.setItem("userId", "synthetic-b");
  await store.getState().hydrate();
  release({ items: [{ id: "a", name: "Account A item", quantity: "1" }], shoppingMetadataVersion: 1, ownerUserId: "synthetic-a" });
  await first;
  expect(store.getState().items.map(i => i.name)).toEqual(["Account B item"]);
});
test("an older Production API never receives a metadata save or patch", async () => {
  const api = jest.fn(async () => ({ items: [] }));
  const store = createDevelopmentShoppingListStore(api);
  store.getState().addItems([{ name: "low sodium broth", quantity: 1, unit: "cup" }]);
  await store.getState().hydrate();
  expect(api.mock.calls.every(call => call.length === 1)).toBe(true);
  expect(store.getState().lastSyncError).toContain("does not support");
  expect(store.getState().items[0].ingredientMetadata?.ingredient.originalName).toBe("low sodium broth");
});
