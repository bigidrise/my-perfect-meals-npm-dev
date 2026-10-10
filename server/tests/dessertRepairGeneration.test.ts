/**
 * Exercises the real Dessert handler, normalization and final validation.
 * Auth/profile/DB/media are synthetic fixtures; this is NOT signed-in E2E.
 * Set RUN_LIVE_DESSERT_REPAIR=1 to use real OpenAI generation for four cases.
 * No accounts, stored recipes, permissions, or schema are changed.
 */
import type { HumanFoodContext } from "../../shared/humanFoodContext";
import { dessertFavoritePayload } from "../../client/src/lib/dessertResult";
import { resolveDessertYield } from "../../shared/dessertYields";
import { DESSERT_NUTRIENTS } from "../services/dessertNutrition";

const mockModelCreate = jest.fn();
const mockLookup = jest.fn((..._args: any[]) => { throw new Error("Mandatory USDA lookup must not run"); });
jest.mock("../services/productDiscovery/usdaIngredientAdapter", () => ({
  lookupUsdaIngredient: (...args: any[]) => mockLookup(...args),
}));
jest.mock("openai", () => {
  const Actual = jest.requireActual("openai").default;
  return { __esModule: true, default: class {
    chat = { completions: { create: (params: any) => process.env.RUN_LIVE_DESSERT_REPAIR === "1"
      ? new Actual({ maxRetries: 0, timeout: 90000 }).chat.completions.create(params)
      : mockModelCreate(params) } };
  } };
});
jest.mock("../db", () => {
  const query: any = { then: (resolve: any) => resolve([]) };
  for (const key of ["from", "where", "limit", "orderBy", "innerJoin", "leftJoin"]) query[key] = () => query;
  return { db: { select: () => query, execute: async () => ({ rows: [] }) } };
});
jest.mock("../utils/getAuthUserId", () => ({ getAuthUserId: () => "1" }));
jest.mock("../services/safetyProfileService", () => ({
  enforceSafetyProfile: async () => ({ allowed: true }),
}));
jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: async () => ({ isActive: false }),
}));
jest.mock("../services/resolveEffectiveDiet", () => ({
  resolveEffectiveDiet: async () => ({ primaryDiet: "general-nutrition", supportProtocols: [] }),
}));
jest.mock("../services/mealImageGenerator", () => ({ generateMealImageUnified: async () => null }));
jest.mock("../services/humanFoodContext/requestScope", () => ({
  createHumanFoodRequestScope: () => ({
    resolve: async () => fixtureContext(), completeAuthorization: async () => {},
    releaseAuthorization: async () => {},
  }),
}));

function fixtureContext(): HumanFoodContext {
  return {
    version: "human-food-context.v1", actorUserId: "1", subjectUserId: "1",
    status: "resolved", notices: [], internalFingerprint: "synthetic-dessert-repair",
    diet: { stored: [], effective: [], source: "unavailable", requestOverride: null },
    safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
    flavor: Object.fromEntries(
      ["cuisine", "cuisineIntensity", "heat", "seasoningIntensity", "broadFlavor", "flavorStyle"]
        .map(key => [key, { value: null, available: false, source: "unavailable" }]),
    ),
    sweeteners: { preferred: [], avoided: [] },
    authorization: { status: "not_required", waivers: [] },
    nutrition: null, behavior: null, gaps: [],
  } as unknown as HumanFoodContext;
}

import router from "../routes/dessert-creator";
const live = process.env.RUN_LIVE_DESSERT_REPAIR === "1";
const cases = [
  ["Greek No-Bake Cinnamon Almond Bars", "bars", "bars-8x8-6", "nut-based"],
  ["Whole 9-inch apple pie", "pie", "pie-9-8", "fruit-based"],
  ["9×13-inch pan of chocolate brownies", "brownies", "brownies-9x13-12", "chocolate-based"],
  ["Batch of 24 chocolate-chip cookies", "cookies", "cookies-24", "chocolate-based"],
] as const;

async function generate(body: any) {
  let status = 200;
  let data: any;
  const res: any = {
    status: (code: number) => { status = code; return res; },
    json: (value: any) => { data = value; return res; },
  };
  const handler = (router as any).stack.find((layer: any) => layer.route?.path === "/").route.stack[0].handle;
  await handler({ body, id: "synthetic-dessert-repair" }, res);
  return { status, data };
}

describe(live ? "LIVE model generation / synthetic subject (not E2E)" : "Dessert handler regression", () => {
  it.each(cases)("%s retains whole yield, canonical totals and Favorites payload", async (name, category, key, flavor) => {
    mockLookup.mockClear();
    const yieldChoice = resolveDessertYield(key, category)!;
    // Deliberately unmappable identity proves the former USDA gate is absent.
    // Nutrients are explicit test fixtures, not composition evidence.
    const fixture = {
      name, category, servingSize: yieldChoice.label, servings: yieldChoice.count,
      ingredients: [{ name: "almond flour, finely ground for this recipe", amount: "240", unit: "g" }],
      instructions: `Prepare the entire ${yieldChoice.label}; divide into ${yieldChoice.count} portions.`,
      nutrition: { calories: 1200, protein: 60, carbs: 120, fat: 80, starchyCarbs: 30 },
      perServingNutrition: { calories: 9999, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0 },
    };
    mockModelCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(fixture) } }] });
    const result = await generate({
      dessertCategory: category, flavorFamily: flavor, specificDessert: name,
      servingSize: key, dietaryPreferences: "general-nutrition",
    });
    if (live) console.log(JSON.stringify({
      liveDessertCase: name, status: result.status, code: result.data?.code,
      findings: result.data?.findings?.map((finding: any) => finding.code),
      servings: result.data?.servings, caloriesPerPortion: result.data?.perServingNutrition?.calories,
    }));
    expect(result.status).toBe(200);
    expect(result.data.servings).toBe(yieldChoice.count);
    expect(result.data.servingSize).toBe(yieldChoice.label);
    for (const key of DESSERT_NUTRIENTS) {
      expect(Number.isFinite(result.data.nutrition[key])).toBe(true);
      expect(result.data.nutrition[key]).toBeCloseTo(result.data.perServingNutrition[key] * yieldChoice.count);
    }
    expect(mockLookup).not.toHaveBeenCalled();
    // Serialization only: real Favorites persistence is a separate E2E check.
    const restored = JSON.parse(JSON.stringify(dessertFavoritePayload(result.data)));
    expect(restored.servings).toBe(yieldChoice.count);
    expect(restored.nutrition).toEqual(result.data.nutrition);
    expect(restored.recipeIngredientQuantities).toEqual(result.data.recipeIngredientQuantities);
  }, 120000);

  (live ? it.skip : it)("rejects missing totals without falling back to supplied portion macros", async () => {
    mockLookup.mockClear(); mockModelCreate.mockClear();
    const choice = resolveDessertYield("bars-8x8-6", "bars")!;
    const fixture = {
      name: "Almond bars", category: "bars", servingSize: choice.label, servings: 6,
      ingredients: [{ name: "almond flour", amount: "240", unit: "g" }],
      instructions: "Mix and divide into six bars.",
      nutrition: { calories: 1200, carbs: 120, fat: 80, starchyCarbs: 30 },
      perServingNutrition: { calories: 200, protein: 10, carbs: 20, fat: 13, starchyCarbs: 5 },
    };
    mockModelCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(fixture) } }] });
    const result = await generate({ dessertCategory: "bars", flavorFamily: "nut-based", servingSize: "bars-8x8-6" });
    expect(result.status).toBe(422);
    expect(result.data.code).toBe("DESSERT_NUTRITION_UNVERIFIED");
    expect(mockModelCreate).toHaveBeenCalledTimes(1);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  (live ? it.skip : it)("uses the same source and no USDA call in the bounded repair path", async () => {
    mockLookup.mockClear(); mockModelCreate.mockReset();
    const choice = resolveDessertYield("bars-8x8-6", "bars")!;
    const fixture = {
      name: "Almond bars", category: "bars", servingSize: choice.label, servings: 6,
      ingredients: [{ name: "almond flour, finely ground for this recipe", amount: "240", unit: "g" }],
      instructions: "Mix and divide into six bars.",
      nutrition: { calories: 1200, protein: 60, carbs: 120, fat: 80, starchyCarbs: 30 },
      perServingNutrition: { calories: 9999, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0 },
    };
    mockModelCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
        ...fixture, servingSize: "Incorrect yield label",
      }) } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
        ...fixture, name: "Cinnamon Almond Bars",
        ingredients: [...fixture.ingredients, { name: "ground cinnamon", amount: "4", unit: "g" }],
        nutrition: { ...fixture.nutrition, calories: 1260, carbs: 126 },
      }) } }] });
    const result = await generate({ dessertCategory: "bars", flavorFamily: "nut-based", servingSize: "bars-8x8-6" });
    expect(result.status).toBe(200);
    expect(result.data.category).toBe("bars");
    expect(result.data.perServingNutrition.calories).toBe(210);
    expect(mockModelCreate).toHaveBeenCalledTimes(2);
    expect(mockLookup).not.toHaveBeenCalled();
  });
});
