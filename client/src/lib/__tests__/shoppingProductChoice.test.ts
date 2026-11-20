/** @jest-environment jsdom */
import { createDevelopmentShoppingListStore } from "../../stores/developmentShoppingListStore";
import { makeIngredientMetadata } from "@shared/shoppingIngredientMetadata";
import type { ShoppingProductSelection } from "@shared/shoppingProductSelection";
import { parseShoppingProductReference, parseShoppingProductSelection } from "@shared/shoppingProductSelection";
import { buildConsolidatedItems } from "../shoppingConsolidation";
import { applyShoppingProductChoice } from "../shoppingProductChoice";
import { useShoppingListStore } from "../../stores/shoppingListStore";

jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn(() => { throw new Error("Live requests forbidden"); }) }));
jest.mock("@/lib/shoppingMetadataGate", () => ({ shoppingMetadataEnabled: true }));
jest.mock("@/stores/shoppingListStore", () => ({ useShoppingListStore: { getState: jest.fn() } }));
const clone = (value: any) => JSON.parse(JSON.stringify(value));
const product = (key = "synthetic-a"): ShoppingProductSelection => ({
  ingredient: { originalName: "Pasta sauce", requirements: [] },
  product: { productKey: key, name: "Synthetic sauce", brand: "Synthetic", variant: key,
    source: { source: "synthetic-catalog", sourceRecordId: key },
    evidence: [
      { kind: "ingredients", statement: "Tomatoes", provenance: { source: "synthetic-catalog" } },
      { kind: "nutrition", statement: "Sodium 100 mg per 60 g",
        measurement: { value: 100, unit: "mg", basis: "per_serving", servingSize: "60 g" },
        provenance: { source: "synthetic-catalog" } },
    ],
    assessment: { status: "eligible_at_evaluation", unresolvedRequirements: [], reasons: ["Synthetic fixture"],
      subjectReference: "synthetic-owner", contextReference: "synthetic-context",
      policyVersion: "synthetic-only", evaluatedAt: "2026-10-21" },
  },
});
function reference(key = "synthetic-reference") {
  const choice = clone(product(key));
  choice.product.selectionKind = "unverified_shopping_reference";
  choice.product.assessment.status = "review_required";
  choice.product.assessment.unresolvedRequirements = ["Synthetic avoidance verification unresolved", "Not medical or restricted-diet clearance"];
  choice.product.sourcePayloadJson = JSON.stringify({
    identity: { key, match: "exact_variant", name: choice.product.name, brand: choice.product.brand,
      variant: choice.product.variant, provenance: choice.product.source },
    decision: { status: "needs_verification", productKey: key, subjectId: "synthetic-owner",
      contextFingerprint: "synthetic-context", reasons: [] },
  });
  return parseShoppingProductReference(choice);
}
function fixture() {
  let rows = [1, 2].map(n => ({
    id: `server-${n}`, userId: "synthetic-owner", name: "Pasta sauce", quantity: String(n),
    unit: n === 1 ? "tbsp" : "cup", category: "Other", checked: false,
    ingredientMetadata: makeIngredientMetadata({ name: "Pasta sauce", quantity: n, unit: n === 1 ? "tbsp" : "cup", recipeId: `r${n}` }),
  }));
  let capability = true, failId = "", dropEvidence = false;
  const api = jest.fn(async (path: string, init: RequestInit = {}) => {
    if (init.method === "PATCH") {
      const row = rows.find(r => path.endsWith(`/${r.id}`))!;
      if (row.id === failId) throw Error("Synthetic write failure");
      Object.assign(row, clone(JSON.parse(String(init.body))));
      if (dropEvidence && row.ingredientMetadata.selectedProduct) row.ingredientMetadata.selectedProduct.evidence = [];
      return { item: clone(row) };
    }
    return { items: clone(rows), ...(capability ? { ownerUserId: localStorage.getItem("userId"), shoppingMetadataVersion: 1 } : {}) };
  });
  const store = createDevelopmentShoppingListStore(api);
  return { store, api, rows: () => clone(rows), oldApi: () => { capability = false; }, fail: (id: string) => { failId = id; },
    loseEvidence: () => { dropEvidence = true; } };
}
beforeEach(() => { localStorage.clear(); localStorage.setItem("userId", "synthetic-owner"); });

test("a separate reference action persists, reloads, changes and clears existing consolidated rows without changing recipe amounts", async () => {
  const f = fixture();
  const before = f.rows();
  await f.store.getState().hydrate();
  const ids = f.store.getState().items.map(item => item.id);
  const first = reference();
  await f.store.getState().chooseReference(ids, first);
  expect(f.store.getState().items.every(item => item.ingredientMetadata?.selectedProduct?.selectionKind === "unverified_shopping_reference")).toBe(true);
  expect(() => parseShoppingProductSelection(first)).toThrow();
  const reloaded = createDevelopmentShoppingListStore(f.api);
  await reloaded.getState().hydrate();
  expect(reloaded.getState().items.every(item => item.ingredientMetadata?.selectedProduct?.assessment.status === "review_required")).toBe(true);
  await reloaded.getState().chooseReference(ids, reference("synthetic-reference-other"));
  expect(f.rows().every((row: any) => row.ingredientMetadata.selectedProduct.productKey === "synthetic-reference-other")).toBe(true);
  await reloaded.getState().chooseProduct(ids, null);
  expect(f.rows().map((row: any) => ({ ...row, ingredientMetadata: {
    ...row.ingredientMetadata, selectedProduct: undefined,
  } }))).toEqual(before.map((row: any) => ({ ...row, ingredientMetadata: {
    ...row.ingredientMetadata, selectedProduct: undefined,
  } })));
  expect(f.api.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(6);
  expect(f.api.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
});

test("verified action cannot accept a reference; wrong account and ingredient references never write", async () => {
  const f = fixture();
  await f.store.getState().hydrate();
  const ids = f.store.getState().items.map(item => item.id);
  expect(() => f.store.getState().chooseProduct(ids, reference())).toThrow();
  expect(() => f.store.getState().chooseReference(ids, null as any)).toThrow();
  const wrongIngredient = reference();
  wrongIngredient.ingredient.originalName = "milk";
  await expect(f.store.getState().chooseReference(ids, wrongIngredient)).rejects.toThrow();
  localStorage.setItem("userId", "another-owner");
  await expect(f.store.getState().chooseReference(ids, reference())).rejects.toThrow();
  expect(f.api.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
});

test("the UI helper awaits the SAME Development store used by the list, not a separate singleton", async () => {
  const f = fixture(); await f.store.getState().hydrate();
  (useShoppingListStore.getState as jest.Mock).mockReturnValue(f.store.getState());
  await applyShoppingProductChoice(["server-1"], product());
  expect(f.store.getState().items[0].ingredientMetadata?.selectedProduct?.productKey).toBe("synthetic-a");
  expect(f.api.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true);
});
test("choose, change, clear and refresh preserve each consolidated source quantity and contribution", async () => {
  const f = fixture(); await f.store.getState().hydrate();
  const original = f.rows();
  const combined = buildConsolidatedItems(f.store.getState().items);
  expect(combined).toHaveLength(1);
  const ids = combined[0].allIds;
  await f.store.getState().chooseProduct(ids, product());
  await f.store.getState().hydrate();
  expect(f.rows().every((r: any) => r.ingredientMetadata.selectedProduct.productKey === "synthetic-a")).toBe(true);
  await f.store.getState().chooseProduct(ids, product("synthetic-b"));
  await f.store.getState().hydrate();
  expect(f.rows().every((r: any) => r.ingredientMetadata.selectedProduct.productKey === "synthetic-b")).toBe(true);
  await f.store.getState().chooseProduct(ids, null);
  await f.store.getState().hydrate();
  f.rows().forEach((row: any, i: number) => {
    expect(row.name).toBe(original[i].name);
    expect(row.quantity).toBe(original[i].quantity);
    expect(row.unit).toBe(original[i].unit);
    expect(row.ingredientMetadata.contributions).toEqual(original[i].ingredientMetadata.contributions);
    expect(row.ingredientMetadata.selectedProduct).toBeNull();
  });
});
test("an existing Product Scan branded row stays unchanged until an explicit alternative, then survives reload without duplication", async () => {
  const f = fixture();
  const name = "Existing Synthetic Mill Olive Oil";
  for (const row of f.rows()) {
    const metadata = makeIngredientMetadata({ name, quantity: Number(row.quantity), unit: row.unit, recipeId: "original-recipe" });
    await f.api(`/api/shopping-list-v2/${row.id}`, { method: "PATCH", body: JSON.stringify({
      name, ingredientMetadata: { ...metadata, selectedProduct: {
        ...product("original-product-scan").product,
        assessment: { status: "review_required", unresolvedRequirements: ["current_profile_and_label_review"], reasons: [] },
      } },
    }) });
  }
  f.api.mockClear();
  await f.store.getState().hydrate();
  expect(f.api.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  expect(f.rows().every((row: any) => row.ingredientMetadata.selectedProduct.productKey === "original-product-scan")).toBe(true);
  const original = f.rows();
  const alternative = { ...product("explicit-alternative"), ingredient: { originalName: name, requirements: [] } };
  await f.store.getState().chooseProduct(["server-1"], alternative);
  await f.store.getState().hydrate();
  expect(f.rows()).toHaveLength(original.length);
  expect(f.rows()[0].ingredientMetadata.selectedProduct.productKey).toBe("explicit-alternative");
  expect(f.rows()[1].ingredientMetadata.selectedProduct.productKey).toBe("original-product-scan");
  f.rows().forEach((row: any, index: number) => {
    expect(row.name).toBe(original[index].name);
    expect(row.quantity).toBe(original[index].quantity);
    expect(row.unit).toBe(original[index].unit);
    expect(row.ingredientMetadata.contributions).toEqual(original[index].ingredientMetadata.contributions);
  });
});
test("different choices remain separate after consolidation and refresh", async () => {
  const f = fixture(); await f.store.getState().hydrate();
  await f.store.getState().chooseProduct(["server-1"], product("a"));
  await f.store.getState().chooseProduct(["server-2"], product("b"));
  await f.store.getState().hydrate();
  expect(buildConsolidatedItems(f.store.getState().items)).toHaveLength(2);
});
test("older API refuses all metadata writes", async () => {
  const f = fixture(); await f.store.getState().hydrate(); f.oldApi();
  await expect(f.store.getState().chooseProduct(["server-1"], product())).rejects.toThrow("does not support");
  expect(f.api.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
});
test("a success response that drops structured evidence is NOT reported as a successful save", async () => {
  const f = fixture(); await f.store.getState().hydrate(); f.loseEvidence();
  await expect(f.store.getState().chooseProduct(["server-1"], product())).rejects.toThrow("did not preserve");
  expect(f.store.getState().items[0].ingredientMetadata?.selectedProduct).toBeUndefined();
});
test("a group failure is surfaced, does not overwrite unsaved rows or alter quantities, and does not claim atomic success", async () => {
  const f = fixture(); await f.store.getState().hydrate(); f.fail("server-2");
  await expect(f.store.getState().chooseProduct(["server-1", "server-2"], product())).rejects.toThrow("Synthetic write failure");
  expect(f.store.getState().lastSyncError).toContain("Some rows may already have saved");
  expect(f.store.getState().items[0].ingredientMetadata?.selectedProduct?.productKey).toBe("synthetic-a");
  expect(f.store.getState().items[1].ingredientMetadata?.selectedProduct).toBeUndefined();
  expect(f.store.getState().items.map(r => r.quantity)).toEqual([1, 2]);
});
test("invalid or missing consolidated IDs abort before first write", async () => {
  const f = fixture(); await f.store.getState().hydrate();
  await expect(f.store.getState().chooseProduct(["server-1", "missing"], product())).rejects.toThrow();
  expect(f.api.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
});
test("a lookup for another subject cannot write", async () => {
  const f = fixture(); await f.store.getState().hydrate();
  const wrong = product(); wrong.product.assessment.subjectReference = "other";
  await expect(f.store.getState().chooseProduct(["server-1"], wrong)).rejects.toThrow("account");
  expect(f.api.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
});
test("an account switch while waiting prevents the queued choice from writing", async () => {
  const f = fixture(); await f.store.getState().hydrate();
  const pending = f.store.getState().chooseProduct(["server-1"], product());
  localStorage.setItem("userId", "other");
  await expect(pending).rejects.toThrow("account changed");
  expect(f.api.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
});
