jest.mock("../services/productDiscovery/usdaIngredientAdapter", () => ({
  lookupUsdaIngredient: jest.fn(() => { throw new Error("Live USDA access forbidden in tests"); }),
}));
import { repairGroceryCoachCarbs } from "../services/groceryCoachCarbRepair";
import type { IngredientComposition } from "../services/productDiscovery/usdaIngredientAdapter";
import { lookupUsdaIngredient } from "../services/productDiscovery/usdaIngredientAdapter";

// Synthetic composition fixtures: tests do not make nutritional claims.
const lookup = jest.fn(async (description: string): Promise<IngredientComposition> => ({
  description, fdcId: 123, dataType: "SR Legacy", retrievedAt: "2026-11-07T00:00:00Z",
  macrosPer100g: { calories: null, protein: null, carbs: description === "Broccoli, raw" ? 20 : 60, fat: null },
  portions: [{ amount: 1, grams: 50, measure: "cup" }], carbSource: "unknown",
}));
function meal(macros: Record<string, any> = {}) {
  return {
    meal: { name: "Synthetic recipe", servings: 2 },
    macros: { calories: 400, protein: 20, carbs: 40, fat: 10, ...macros },
    ownedIngredients: [{ item: "sugar", quantity: "50", unit: "g" }],
    shoppingList: [{ item: "broccoli", quantity: "50", unit: "g" }],
    instructions: ["Use existing ingredients."],
  };
}
const run = (candidate: ReturnType<typeof meal>) =>
  repairGroceryCoachCarbs(candidate, { enabled: true, lookup });
beforeEach(() => jest.clearAllMocks());

it("preserves valid ingredient-backed estimates, ingredients, other macros, and input", async () => {
  const input = meal({ starchyCarbs: 30, fibrousCarbs: 10 });
  const before = JSON.stringify(input);
  const result = await run(input);
  expect(result.macros).toEqual(input.macros);
  expect(result.meal).toBe(input.meal);
  expect(result.shoppingList).toBe(input.shoppingList);
  expect(result.instructions).toBe(input.instructions);
  expect(JSON.stringify(input)).toBe(before);
  expect(result.carbohydrateReview).toMatchObject({ status: "validated", evidence: [
    { ingredientIndex: 0, grams: 50, category: "starchy", carbs: 30, fdcId: 123 },
    { ingredientIndex: 1, grams: 50, category: "fibrous", carbs: 10, fdcId: 123 },
  ] });
});
it.each([
  {}, { starchyCarbs: null, fibrousCarbs: null },
  { starchyCarbs: -1, fibrousCarbs: Infinity },
  { starchyCarbs: 35, fibrousCarbs: 35 },
  { starchyCarbs: "30", fibrousCarbs: "10" },
])("repairs missing/invalid estimates with source quantities, not regeneration: %j", async macros => {
  const result = await run(meal(macros));
  expect(result.macros).toEqual({ calories: 400, protein: 20, carbs: 40, fat: 10, starchyCarbs: 30, fibrousCarbs: 10 });
  expect(result.carbohydrateReview?.status).toBe("validated");
  expect(lookup).toHaveBeenCalledTimes(2);
});
it("preserves a valid category while repairing the missing one", async () => {
  const result = await run(meal({ starchyCarbs: 29.5 }));
  expect(result.macros).toMatchObject({ starchyCarbs: 29.5, fibrousCarbs: 10 });
});
it("does not overwrite arithmetically valid but source-conflicting estimates", async () => {
  const input = meal({ starchyCarbs: 20, fibrousCarbs: 20 });
  const result = await run(input);
  expect(result.macros).toEqual(input.macros);
  expect(result.carbohydrateReview).toMatchObject({ status: "unresolved", reason: "existing_estimate_conflict" });
});
it("preserves total carbs and other nutrition when sources contradict the total", async () => {
  const result = await run(meal({ carbs: 20 }));
  expect(result.macros).toEqual({ calories: 400, protein: 20, carbs: 20, fat: 10, starchyCarbs: null, fibrousCarbs: null });
  expect(result.carbohydrateReview?.reason).toBe("total_carbs_conflict");
});
it("rejects a repaired split that exceeds total carbs even within rounding tolerance", async () => {
  const result = await run(meal({ carbs: 39.5 }));
  expect(result.carbohydrateReview?.status).toBe("unresolved");
  expect(result.macros.starchyCarbs).toBeNull();
});
it("uses ingredient-specific portions rather than an invented volume density", async () => {
  const input = meal();
  input.shoppingList[0] = { item: "broccoli", quantity: "1", unit: "cup" };
  expect((await run(input)).carbohydrateReview?.status).toBe("validated");
  input.shoppingList[0].unit = "bag";
  expect((await run(input)).carbohydrateReview?.status).toBe("unresolved");
});
it.each(["rice", "cooked broccoli", "special sauce", "apple"])("does not guess unsupported ingredient identities: %s", async item => {
  const input = meal();
  input.shoppingList[0].item = item;
  expect((await run(input)).carbohydrateReview?.reason).toBe("ingredient_identity_unresolved");
});
it("never uses dietary fiber as fibrous carbohydrate", async () => {
  const result = await run(meal({ fiber: 99 }));
  expect(result.macros.fibrousCarbs).toBe(10);
  expect(result.macros.fiber).toBe(99);
});
it("keeps source failures unresolved, never silently zero", async () => {
  lookup.mockRejectedValueOnce(new Error("unavailable"));
  const result = await run(meal());
  expect(result.carbohydrateReview).toMatchObject({ status: "unresolved", reason: "source_unavailable" });
  expect(result.macros.starchyCarbs).toBeNull();
  expect(result.macros.fibrousCarbs).toBeNull();
});
it("does not double-count duplicate ingredients that the finalizer would deduplicate", async () => {
  const input = meal();
  input.shoppingList.push({ ...input.ownedIngredients[0] });
  expect((await run(input)).carbohydrateReview?.reason).toBe("duplicate_ingredient_quantities");
  expect(lookup).not.toHaveBeenCalled();
});
it("accepts zero only when complete source coverage establishes it", async () => {
  const input = { ...meal({ carbs: 0 }), ownedIngredients: [],
    shoppingList: [{ item: "olive oil", quantity: "10", unit: "g" }] };
  const result = await repairGroceryCoachCarbs(input, {
    enabled: true, lookup: async description => ({
      ...await lookup(description), macrosPer100g: { calories: null, protein: null, carbs: 0, fat: null },
    }),
  });
  expect(result.macros).toMatchObject({ starchyCarbs: 0, fibrousCarbs: 0 });
  expect(result.carbohydrateReview?.status).toBe("validated");
});
it("does not trust client-supplied completion or evidence", async () => {
  const result = await repairGroceryCoachCarbs({
    ...meal({ carbs: 1 }), carbohydrateReview: { version: 1, status: "validated", reason: "client" },
  }, { enabled: true, lookup });
  expect(result.carbohydrateReview?.status).toBe("unresolved");
});
it("is inert outside Development and makes no source calls", async () => {
  const input = meal();
  expect(await repairGroceryCoachCarbs(input, { enabled: false, lookup })).toBe(input);
  expect(lookup).not.toHaveBeenCalled();
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    expect(await repairGroceryCoachCarbs(input)).toBe(input);
    expect(lookupUsdaIngredient).not.toHaveBeenCalled();
  } finally { process.env.NODE_ENV = previous; }
});
