/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { createDevelopmentShoppingListStore } from "@/stores/developmentShoppingListStore";
import { groceryCoachSelectedProductMetadata } from "@/lib/groceryCoachShoppingTransfer";
import { recipeIngredientTransfer } from "@/lib/shoppingIngredientTransfer";
import { buildConsolidatedItems } from "@/lib/shoppingConsolidation";
import SmartShoppingProductChoice from "@/components/shopping/SmartShoppingProductChoice";
import { developmentShoppingGroups, mergeDevelopmentShoppingMetadata } from "@shared/developmentShoppingMerge";
import { makeIngredientMetadata } from "@shared/shoppingIngredientMetadata";
import { parseShoppingProductSelection } from "@shared/shoppingProductSelection";

jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn(() => { throw new Error("Unexpected live request"); }) }));
jest.mock("@/lib/shoppingMetadataGate", () => ({ shoppingMetadataEnabled: true }));

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const product = {
  productKey: "synthetic-sauce-a", brand: "Synthetic Brand", name: "Tomato Sauce",
  barcode: "012345678901", ingredients: "Tomatoes, water", serving: "125 g",
  source: "Synthetic catalog", sourceRecordId: "record-a", catalogDate: "2026-10-20",
  evidenceStatus: "needs_verification" as const, recommendationStatus: "review" as const,
  verificationMessage: "Check the current label; suitability remains unverified.",
  nutrition: [{ statement: "Sodium 100 mg per 100 g", source: "Synthetic catalog" }],
  allergenInformation: [{ statement: "May contain milk.", source: "Synthetic catalog" }],
};
const ingredient = { item: "low-sodium spaghetti sauce", quantity: "1/2", unit: "cup" };
function selected(name = ingredient.item) {
  return {
    name, quantity: .5, unit: "cup",
    ingredientMetadata: groceryCoachSelectedProductMetadata(
      { ...ingredient, item: name }, product, { id: "coach-card", name: "Coach Recipe" }),
  };
}
function generic(name = ingredient.item, quantity = 1, unit = "cup") {
  const prepared = recipeIngredientTransfer({ name, quantity, unit },
    { id: "meal-card", name: "Meal Recipe", source: "meal_card" });
  return { name: prepared.name, quantity: prepared.qty, unit: prepared.unit, ingredientMetadata: prepared.ingredientMetadata };
}
function fixture() {
  let rows: any[] = [];
  let serial = 0;
  const request = jest.fn(async (path: string, init: RequestInit = {}) => {
    if (!init.method || init.method === "GET") return {
      items: clone(rows), shoppingMetadataVersion: 1, ownerUserId: "synthetic-member",
    };
    const body = JSON.parse(String(init.body));
    if (init.method === "POST" && path === "/api/shopping-list") {
      const created = body.items.map((item: any) => ({
        ...clone(item), id: `synthetic-row-${++serial}`, userId: "synthetic-member",
      }));
      rows.push(...created);
      return { items: clone(created) };
    }
    if (init.method === "PATCH") {
      const row = rows.find(r => path === `/api/shopping-list-v2/${r.id}`);
      if (!row) throw new Error("Unknown synthetic row");
      Object.assign(row, clone(body));
      return { item: clone(row) };
    }
    throw new Error(`Unexpected synthetic operation ${init.method} ${path}`);
  });
  return {
    store: createDevelopmentShoppingListStore(request), request,
    seed: (items: any[]) => { rows = clone(items); },
    rows: () => clone(rows),
  };
}
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("userId", "synthetic-member");
  global.fetch = jest.fn(() => { throw new Error("Network forbidden"); });
});

test("Coach transfer preserves the generic qualifier, exact contribution and available evidence without medical promotion", () => {
  const metadata = selected().ingredientMetadata;
  expect(metadata.ingredient.originalName).toBe(ingredient.item);
  expect(metadata.ingredient.requirements).toContainEqual({ origin: "explicit_ingredient", value: "low sodium" });
  expect(metadata.contributions[0]).toMatchObject({
    quantity: "1/2", unit: "cup", recipeId: "coach-card", source: "grocery_coach",
    originalText: "1/2 cup low-sodium spaghetti sauce",
  });
  expect(metadata.selectedProduct).toMatchObject({
    productKey: product.productKey, upc: product.barcode, brand: product.brand,
    servingDescription: "125 g", assessment: { status: "review_required" },
  });
  expect(metadata.selectedProduct?.evidence.map(f => f.statement)).toEqual([
    product.ingredients, product.nutrition[0].statement, product.allergenInformation[0].statement,
  ]);
  expect(JSON.parse(metadata.selectedProduct!.sourcePayloadJson!)).toEqual(product);
  expect(() => parseShoppingProductSelection({
    ingredient: metadata.ingredient, product: metadata.selectedProduct,
  })).toThrow();
});

test("a Coach profile-matched record is historical profile matching, never picker eligibility", () => {
  const metadata = groceryCoachSelectedProductMetadata(ingredient, {
    ...product, evidenceStatus: "eligible", recommendationStatus: "profile_matched_pick",
  }, { name: "Coach Recipe" });
  expect(metadata.selectedProduct?.assessment.status).toBe("profile_matched");
  expect(() => parseShoppingProductSelection({
    ingredient: { originalName: "spaghetti sauce", requirements: [] }, product: metadata.selectedProduct,
  })).toThrow("complete evidence-supported");
});

test.each(["coach-first", "meal-first"])("compatible %s contributions merge, save and hydrate with the same product", async order => {
  const f = fixture();
  const inputs = order === "coach-first" ? [selected(), generic()] : [generic(), selected()];
  f.store.getState().addItems(inputs);
  await f.store.getState().hydrate();
  expect(f.store.getState().lastSyncError).toBeNull();
  expect(f.rows()).toHaveLength(1);
  expect(f.store.getState().items).toHaveLength(1);
  const row = f.store.getState().items[0];
  expect(row.quantity).toBe(1.5);
  expect(row.name).toBe(ingredient.item);
  expect(row.productKey).toBe(product.productKey);
  expect(row.ingredientMetadata?.selectedProduct).toEqual(selected().ingredientMetadata.selectedProduct);
  expect(row.ingredientMetadata?.contributions.map(c => c.recipeId).sort()).toEqual(["coach-card", "meal-card"]);
  expect(row.ingredientMetadata?.contributions.find(c => c.recipeId === "coach-card")?.quantity).toBe("1/2");
  render(<SmartShoppingProductChoice item={row} enabled hasAccess onChoose={jest.fn()}
    onClear={jest.fn()} onUpgrade={jest.fn()} />);
  expect(screen.getByText("Synthetic Brand Tomato Sauce")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Choose Product" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("a standalone generic meal-card ingredient retains Choose Product and no automatic lookup", async () => {
  const f = fixture();
  f.store.getState().addItems([generic()]);
  await f.store.getState().hydrate();
  render(<SmartShoppingProductChoice item={f.store.getState().items[0]} enabled hasAccess
    onChoose={jest.fn()} onClear={jest.fn()} onUpgrade={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Choose Product" })).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(f.request.mock.calls.every(([path]) => !path.includes("product-advisor"))).toBe(true);
});

test("compatible volume units sum accurately without replacing recipe units or quantities", async () => {
  const f = fixture();
  f.store.getState().addItems([selected(), generic(ingredient.item, 2, "tbsp")]);
  await f.store.getState().hydrate();
  const [row] = f.store.getState().items;
  expect(f.store.getState().items).toHaveLength(1);
  expect(row.quantity).toBeCloseTo(.5 + 2 * 14.787 / 236.588, 10);
  expect(row.ingredientMetadata?.contributions.map(c => [c.quantity, c.unit])).toEqual([
    ["1/2", "cup"], [2, "tbsp"],
  ]);
});

test.each(["different qualifier", "different brand", "different evidence", "conflicting contribution", "different dimension", "different count unit", "orphan identity"])(
  "%s remains separate and survives synthetic hydration without data loss", async conflict => {
    const a = selected();
    let b: any = generic();
    if (conflict === "different qualifier") b = generic("spaghetti sauce");
    if (conflict === "different brand") {
      b = selected();
      b.ingredientMetadata.selectedProduct = {
        ...b.ingredientMetadata.selectedProduct, productKey: "synthetic-b", brand: "Other Brand",
      };
    }
    if (conflict === "different evidence") {
      b = selected();
      b.ingredientMetadata.selectedProduct!.assessment.reasons = ["Different unresolved evidence"];
    }
    if (conflict === "conflicting contribution") {
      b.ingredientMetadata.contributions[0].id = a.ingredientMetadata.contributions[0].id;
    }
    if (conflict === "different dimension") b = generic(ingredient.item, 100, "g");
    if (conflict === "different count unit") { a.unit = "can"; b.unit = "bottle"; }
    if (conflict === "orphan identity") b.productKey = "unmapped-product";
    const f = fixture();
    f.store.getState().addItems([a, b]);
    await f.store.getState().hydrate();
    const rows = f.store.getState().items;
    expect(rows).toHaveLength(2);
    expect(buildConsolidatedItems(rows)).toHaveLength(2);
    expect(rows[0].ingredientMetadata).toEqual(a.ingredientMetadata);
    expect(rows[1].ingredientMetadata).toEqual(b.ingredientMetadata);
    expect(rows.map(r => r.quantity)).toEqual([a.quantity, b.quantity]);
    expect(f.store.getState().lastSyncError).toBeNull();
  });

test("two different selected brands never absorb an ambiguous generic ingredient", async () => {
  const a = selected(), b = selected();
  b.ingredientMetadata.selectedProduct!.productKey = "other-brand";
  b.ingredientMetadata.selectedProduct!.brand = "Other Brand";
  const f = fixture();
  f.store.getState().addItems([a, b, generic()]);
  await f.store.getState().hydrate();
  expect(f.store.getState().items).toHaveLength(3);
  expect(buildConsolidatedItems(f.store.getState().items)).toHaveLength(3);
  expect(f.store.getState().items.map(r => r.ingredientMetadata?.contributions.length)).toEqual([1, 1, 1]);
});

test("already persisted compatible rows consolidate without losing their source IDs or recipe contributions", async () => {
  const f = fixture();
  f.seed([selected(), generic()].map((item, i) => ({
    ...item, id: `persisted-${i}`, userId: "synthetic-member", checked: false,
  })));
  await f.store.getState().hydrate();
  const rows = buildConsolidatedItems(f.store.getState().items);
  expect(rows).toHaveLength(1);
  expect(rows[0].allIds.sort()).toEqual(["persisted-0", "persisted-1"]);
  expect(rows[0].quantity).toBeCloseTo(1.5 * 236.588);
  expect(rows[0].ingredientMetadata?.selectedProduct?.productKey).toBe(product.productKey);
  expect(rows[0].ingredientMetadata?.contributions).toHaveLength(2);
});

test("incompatible requirement origins and authority references never merge", () => {
  const a = selected(), b = generic();
  b.ingredientMetadata.ingredient.requirements.push({
    value: "low sodium", origin: "explicit_request", authorityReference: "synthetic-request",
  });
  expect(developmentShoppingGroups([a, b])).toHaveLength(2);
  expect(() => mergeDevelopmentShoppingMetadata(a.ingredientMetadata, b.ingredientMetadata)).toThrow();
});

test("unrelated identical generic ingredients still consolidate as before", () => {
  const a = makeIngredientMetadata({ name: "zucchini", quantity: 71, unit: "g" });
  const b = makeIngredientMetadata({ name: "zucchini", quantity: .5, unit: "cup" });
  const rows = [a, b].map((ingredientMetadata, i) => ({
    id: String(i), name: "zucchini", quantity: i ? .5 : 71, unit: i ? "cup" : "g",
    normalizedName: "zucchini", category: "Produce", isChecked: false, isPantryStaple: false,
    ingredientMetadata,
  }));
  expect(buildConsolidatedItems(rows as any)).toHaveLength(1);
  expect(buildConsolidatedItems(rows as any)[0].quantity).toBeCloseTo(71 + .5 * 236.588);
});
