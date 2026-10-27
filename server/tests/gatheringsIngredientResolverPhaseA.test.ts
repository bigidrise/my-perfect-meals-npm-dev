import { normalizeGatheringsIngredient, verifiedGatheringsCandidate } from "../services/gatheringsIngredientNormalization";
import { parseGatheringsIngredient } from "../services/gatheringsIngredientParser";
import { gatheringsReviewedUsda } from "./fixtures/gatheringsReviewedUsda";
import { christmasSmokeGatheringsRecipes } from "./fixtures/gatheringsChristmasRecipes";
import type { createGatheringsIngredientResolverPhaseA } from "../services/gatheringsIngredientResolverPhaseA";

type Factory = typeof createGatheringsIngredientResolverPhaseA;
const originalEnv = process.env.NODE_ENV;
const originalDeployment = process.env.REPLIT_DEPLOYMENT;
let create: Factory;
beforeEach(() => {
  jest.resetModules();
  process.env.NODE_ENV = "development";
  delete process.env.REPLIT_DEPLOYMENT;
  create = require("../services/gatheringsIngredientResolverPhaseA").createGatheringsIngredientResolverPhaseA;
});
afterEach(() => {
  jest.useRealTimers();
  if (originalEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv;
  if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
  else process.env.REPLIT_DEPLOYMENT = originalDeployment;
});

// Only the existing captured, public USDA records supply nutrition/weights.
// Simulated HTTP behavior below tests mechanics, not live coverage or latency.
function sourceFetch(options: {
  missingProtein?: boolean; mismatch?: boolean; duplicate?: boolean; wholeOnly?: boolean;
} = {}): jest.MockedFunction<typeof fetch> {
  return jest.fn(async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/foods/search")) {
      const foods = gatheringsReviewedUsda.map(({ fdcId, description, dataType }) => ({ fdcId, description, dataType }));
      if (options.duplicate) foods.push({ ...foods[1], fdcId: 999999 });
      return { ok: true, status: 200, json: async () => ({ foods }) } as Response;
    }
    const row = gatheringsReviewedUsda.find(food => String(food.fdcId) === url.pathname.split("/").pop())!;
    const nutrientIds = { calories: 1008, protein: 1003, carbs: 1005, fat: 1004 };
    return {
      ok: true, status: 200, json: async () => ({
        fdcId: options.mismatch ? 999999 : row.fdcId, description: row.description, dataType: row.dataType,
        foodNutrients: Object.entries(row.macrosPer100g)
          .filter(([name]) => !(options.missingProtein && name === "protein"))
          .map(([name, amount]) => ({
            nutrient: { id: nutrientIds[name as keyof typeof nutrientIds], unitName: name === "calories" ? "kcal" : "g" },
            amount,
          })),
        foodPortions: (options.wholeOnly ? [{ amount: 1, grams: 100, measure: "cup whole" }] : row.portions)
          .map(portion => ({ amount: portion.amount, gramWeight: portion.grams, modifier: portion.measure })),
      }),
    } as Response;
  });
}

it("preserves every original ingredient field and material preparation", () => {
  for (const recipe of christmasSmokeGatheringsRecipes) {
    for (const line of recipe.ingredientLines) {
      const row = parseGatheringsIngredient(line);
      const before = { ...row };
      const normalized = normalizeGatheringsIngredient(row);
      expect(normalized.original).toEqual(before);
      expect(row).toEqual(before);
    }
  }
  expect(normalizeGatheringsIngredient(parseGatheringsIngredient("50 g toasted walnuts, chopped"))).toMatchObject({
    searchName: "toasted walnuts", physicalForm: "chopped", formulation: ["toasted"],
  });
  expect(normalizeGatheringsIngredient(parseGatheringsIngredient("50 g Japanese sweet potatoes, peeled and cubed")).searchName)
    .toContain("peeled");
  expect(normalizeGatheringsIngredient(parseGatheringsIngredient("1 tsp ground nutmeg"))).toMatchObject({
    foodIdentity: "nutmeg", physicalForm: "ground", searchName: "ground nutmeg",
  });
});

it.each([
  ["1 tsp nutmeg, ground", "Spices, nutmeg, ground"],
  ["100 g raw red onions", "Onions, red, raw"],
  ["100 g almonds", "Nuts, almonds"],
])("accepts only token-equivalent source wording: %s", (line, description) => {
  expect(verifiedGatheringsCandidate(normalizeGatheringsIngredient(parseGatheringsIngredient(line)), description)).toBe(true);
});

it.each([
  ["100 g red onion", "Onions, red, raw"],
  ["100 g cooked red onion", "Onions, red, raw"],
  ["100 g sliced cucumber", "Cucumber, with peel, raw"],
  ["100 g Japanese sweet potatoes", "Sweet potato, raw, unprepared"],
  ["100 g toasted walnuts", "Nuts, walnuts, english"],
  ["1 tbsp soy sauce", "Soy sauce made from soy and wheat (shoyu)"],
  ["1 tbsp rice vinegar", "Vinegar, cider"],
  ["1 tbsp sesame seeds", "Seeds, sesame seeds, whole, dried"],
  ["1 tbsp toasted sesame oil", "Oil, sesame, salad or cooking"],
  ["100 g grated ginger", "Ginger root, raw"],
  ["100 g raw sliced onions", "Onions, raw, chopped"],
])("rejects extra/missing material identity evidence: %s", (line, description) => {
  expect(verifiedGatheringsCandidate(normalizeGatheringsIngredient(parseGatheringsIngredient(line)), description)).toBe(false);
});

it.each([
  ["12 oz sashimi-grade salmon", "salmon_identity_unspecified"],
  ["3 pounds bone-in ham", "edible_weight_unspecified"],
  ["2 cups rehydrated wakame seaweed", "hydrated_composition_unverified"],
  ["1/2 cup coconut milk", "coconut_milk_formulation_unspecified"],
])("does not request or fabricate missing facts: %s", async (line, reason) => {
  const fetcher = sourceFetch();
  const result = await create(fetcher).resolve(parseGatheringsIngredient(line));
  expect(result).toMatchObject({ status: "needs_review", reason });
  expect(result.grams).toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
});

it("reuses real search evidence and the shared detail adapter for reordered wording", async () => {
  const fetcher = sourceFetch();
  const resolver = create(fetcher);
  const row = parseGatheringsIngredient("1/4 tsp nutmeg, ground");
  const result = await resolver.resolve(row);
  expect(result).toMatchObject({
    status: "available", grams: 0.55,
    source: { fdcId: 171326, description: "Spices, nutmeg, ground" },
  });
  expect(fetcher).toHaveBeenCalledTimes(2); // one search + one detail, no duplicate search
  expect(resolver.metrics.searchReuses).toBe(1);
  expect(await resolver.resolve(row)).toEqual(result);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("requires form-specific source portions, including after preparation removal", async () => {
  const resolver = create(sourceFetch());
  const result = await resolver.resolve(parseGatheringsIngredient("1 tbsp green onions, finely chopped"));
  expect(result).toMatchObject({ status: "available", grams: 6 });
  expect(result.source?.portions.every(portion => /chopped/.test(portion.measure))).toBe(true);
});

it("never borrows whole or unqualified volume for chopped food", async () => {
  const result = await create(sourceFetch({ wholeOnly: true })).resolve(
    parseGatheringsIngredient("1 tbsp green onions, finely chopped"));
  expect(result).toMatchObject({ status: "needs_review", reason: "compatible_portion_unverified" });
  expect(result.grams).toBeUndefined();
});

it("permits exact edible mass for cut food without inventing volume weights", async () => {
  const result = await create(sourceFetch({ wholeOnly: true })).resolve(
    parseGatheringsIngredient("15 g green onions, finely chopped"));
  expect(result).toMatchObject({ status: "available", grams: 15 });
});

it("rejects missing core nutrients", async () => {
  const result = await create(sourceFetch({ missingProtein: true })).resolve(parseGatheringsIngredient("1 tsp ground nutmeg"));
  expect(result).toMatchObject({ status: "unavailable", reason: "required_nutrients_missing" });
});

it("uses unqualified tsp only when the composition record itself establishes the ground form", async () => {
  const result = await create(sourceFetch()).resolve(parseGatheringsIngredient("1 tsp ground nutmeg"));
  expect(result).toMatchObject({ status: "available", grams: 2.2 });
});

it("rejects detail identity changes", async () => {
  const result = await create(sourceFetch({ mismatch: true })).resolve(parseGatheringsIngredient("1 tsp nutmeg, ground"));
  expect(result.status).toBe("unavailable");
  expect(result.grams).toBeUndefined();
});

it("does not arbitrarily choose between duplicate matching source identities", async () => {
  const result = await create(sourceFetch({ duplicate: true })).resolve(parseGatheringsIngredient("1 tsp nutmeg, ground"));
  expect(result).toMatchObject({ status: "needs_review", reason: "multiple_verified_candidates" });
});

it.each([429, 403, 503])("distinguishes HTTP %s without retry floods", async status => {
  const fetcher = jest.fn(async (..._args: Parameters<typeof fetch>) =>
    new Response(null, { status })) as jest.MockedFunction<typeof fetch>;
  const resolver = create(fetcher);
  expect(await resolver.resolve(parseGatheringsIngredient("1 tsp ground nutmeg")))
    .toMatchObject({ status: "unavailable", reason: `usda_http_${status}` });
  expect(await resolver.resolve(parseGatheringsIngredient("1 tsp ground ginger"))).toMatchObject({ status: "unavailable" });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(resolver.metrics.responseStatuses).toEqual([status]);
});

it("bounds even a fetch implementation that ignores cancellation", async () => {
  jest.useFakeTimers();
  const resolver = create(jest.fn(() => new Promise<Response>(() => {})));
  const pending = resolver.resolve(parseGatheringsIngredient("1 tsp ground nutmeg"));
  await jest.advanceTimersByTimeAsync(6001);
  expect((await pending).status).toBe("unavailable");
  expect(resolver.metrics.httpRequests).toBe(1);
});

it("retains the existing lookup cap across unresolved ingredients", async () => {
  const fetcher = jest.fn(async (..._args: Parameters<typeof fetch>) =>
    new Response(JSON.stringify({ foods: [] }), { status: 200 })) as jest.MockedFunction<typeof fetch>;
  const resolver = create(fetcher);
  for (let index = 0; index < 35; index++) {
    const result = await resolver.resolve(parseGatheringsIngredient(`1 g unresolved${index}`));
    expect(result.status).not.toBe("available");
  }
  expect(fetcher.mock.calls.length).toBeLessThanOrEqual(32);
  expect(resolver.lookupMetrics.lookups).toBe(32);
});

it.each(christmasSmokeGatheringsRecipes)("$name remains incomplete with the captured five-record evidence set", async recipe => {
  const resolver = create(sourceFetch());
  const results = await Promise.all(recipe.ingredientLines.map(line => resolver.resolve(parseGatheringsIngredient(line))));
  expect(results.every(result => result.status === "available")).toBe(false);
  expect(results[0].status).toBe("needs_review");
});

it.each(["test", "production"])("cannot run outside Development: %s", env => {
  process.env.NODE_ENV = env;
  expect(() => create(sourceFetch())).toThrow("Development-only");
});

it("cannot run in a deployed runtime, even with Development mode", () => {
  process.env.REPLIT_DEPLOYMENT = "1";
  expect(() => create(sourceFetch())).toThrow("Development-only");
});
