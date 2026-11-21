/** @jest-environment jsdom */

import { apiRequest } from "@/lib/apiRequest";
import { useShoppingListStore } from "@/stores/shoppingListStore";
import { makeIngredientMetadata } from "@shared/shoppingIngredientMetadata";
import type { ShoppingProductSelection } from "@shared/shoppingProductSelection";
import { saveProductionShoppingProductChoice } from "../productionShoppingProductChoice";

jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));
jest.mock("@/stores/shoppingListStore", () => ({
  useShoppingListStore: { getState: jest.fn() },
}));

const request = apiRequest as jest.Mock;
const getState = useShoppingListStore.getState as jest.Mock;
const clone = (value: any) => JSON.parse(JSON.stringify(value));

function setup() {
  localStorage.clear();
  localStorage.setItem("userId", "synthetic-owner");

  const row: any = {
    id: "server-1",
    userId: "synthetic-owner",
    name: "Pasta sauce",
    quantity: "1",
    unit: "cup",
    category: "Other",
    checked: false,
    ingredientMetadata: makeIngredientMetadata({
      name: "Pasta sauce",
      quantity: 1,
      unit: "cup",
      recipeId: "synthetic-recipe",
    }),
  };

  let items: any[] = [{
    id: row.id,
    serverId: row.id,
    name: row.name,
    quantity: 1,
    unit: row.unit,
    ingredientMetadata: clone(row.ingredientMetadata),
  }];

  const replaceItems = jest.fn((next: any[]) => {
    items = next;
  });

  getState.mockImplementation(() => ({ items, replaceItems }));

  request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (!init) {
      return {
        ownerUserId: "synthetic-owner",
        shoppingMetadataVersion: 1,
        items: [clone(row)],
      };
    }

    if (init.method === "PATCH") {
      row.ingredientMetadata = clone(
        JSON.parse(String(init.body)).ingredientMetadata
      );
      return { item: clone(row) };
    }

    throw new Error("Unexpected request");
  });

  const selection: ShoppingProductSelection = {
    ingredient: {
      originalName: "Pasta sauce",
      requirements: [],
    },
    product: {
      productKey: "synthetic-product",
      name: "Synthetic Sauce",
      brand: "Synthetic",
      variant: "Original",
      source: {
        source: "synthetic-catalog",
        sourceRecordId: "synthetic-product",
      },
      evidence: [{
        kind: "ingredients",
        statement: "Tomatoes",
        provenance: { source: "synthetic-catalog" },
      }, {
        kind: "nutrition",
        statement: "Sodium 100 mg per 60 g",
        measurement: {
          value: 100,
          unit: "mg",
          basis: "per_serving",
          servingSize: "60 g",
        },
        provenance: { source: "synthetic-catalog" },
      }],
      assessment: {
        status: "eligible_at_evaluation",
        unresolvedRequirements: [],
        reasons: ["Synthetic test"],
        subjectReference: "synthetic-owner",
        contextReference: "synthetic-context",
        policyVersion: "synthetic-only",
        evaluatedAt: "2026-10-21",
      },
    },
  };

  return {
    row,
    selection,
    replaceItems,
    items: () => items,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("saves a verified choice without changing recipe contributions", async () => {
  const f = setup();
  const contributions = clone(f.row.ingredientMetadata.contributions);

  await saveProductionShoppingProductChoice(["server-1"], f.selection);

  expect(f.row.ingredientMetadata.selectedProduct.productKey)
    .toBe("synthetic-product");
  expect(f.row.ingredientMetadata.contributions).toEqual(contributions);
  expect(f.items()[0].ingredientMetadata.selectedProduct.productKey)
    .toBe("synthetic-product");
  expect(f.replaceItems).toHaveBeenCalledTimes(1);
  expect(request.mock.calls.filter(([, init]) => init?.method === "PATCH"))
    .toHaveLength(1);
});

test("rejects a selection belonging to another account", async () => {
  const f = setup();
  f.selection.product.assessment.subjectReference = "another-owner";

  await expect(
    saveProductionShoppingProductChoice(["server-1"], f.selection)
  ).rejects.toThrow();

  expect(request.mock.calls.some(([, init]) => init?.method === "PATCH"))
    .toBe(false);
});

test("rejects a mismatched ingredient", async () => {
  const f = setup();
  f.selection.ingredient.originalName = "Milk";

  await expect(
    saveProductionShoppingProductChoice(["server-1"], f.selection)
  ).rejects.toThrow();

  expect(request.mock.calls.some(([, init]) => init?.method === "PATCH"))
    .toBe(false);
});

test("rejects duplicate legacy server records", async () => {
  const f = setup();
  request.mockResolvedValueOnce({
    ownerUserId: "synthetic-owner",
    shoppingMetadataVersion: 1,
    items: [
      clone(f.row),
      { ...clone(f.row), id: "server-2" },
    ],
  });

  await expect(
    saveProductionShoppingProductChoice(["server-1"], f.selection)
  ).rejects.toThrow(/multiple or missing server records/);

  expect(request.mock.calls.some(([, init]) => init?.method === "PATCH"))
    .toBe(false);
});

test("rejects a server response that does not preserve the choice", async () => {
  const f = setup();

  request.mockImplementationOnce(async () => ({
    ownerUserId: "synthetic-owner",
    shoppingMetadataVersion: 1,
    items: [clone(f.row)],
  })).mockImplementationOnce(async () => ({
    item: clone(f.row),
  }));

  await expect(
    saveProductionShoppingProductChoice(["server-1"], f.selection)
  ).rejects.toThrow(/Server did not confirm/);

  expect(f.replaceItems).not.toHaveBeenCalled();
});

test("refuses to save when the account changes before queued execution", async () => {
  const f = setup();
  const operation = saveProductionShoppingProductChoice(
    ["server-1"],
    f.selection
  );

  localStorage.setItem("userId", "another-owner");

  await expect(operation).rejects.toThrow(/account changed/i);
  expect(request).not.toHaveBeenCalled();
  expect(f.replaceItems).not.toHaveBeenCalled();
});
