/**
 * Offline handler integration: real Dessert normalization, protocol scanning,
 * final validation and shared coordinator; synthetic authority, DB and model.
 * No customer records or external providers are accessed.
 */
import type { HumanFoodContext } from "../../shared/humanFoodContext";
import { resolveDessertYield } from "../../shared/dessertYields";
import { dessertFavoritePayload } from "../../client/src/lib/dessertResult";
import { dessertChoiceSignature } from "../services/dessertChoiceEvidence";

const mockCreate = jest.fn();
const mockComplete = jest.fn();
const mockRelease = jest.fn();
const mockScope = jest.fn();
const mockImage = jest.fn();
const mockEvent = jest.fn();
const mockScan = jest.fn();
let mockContext: HumanFoodContext;
let mockOverride: string | undefined;
let mockTransform = (meal: any) => meal;
let mockEnvelope: any;
jest.mock("openai", () => ({ __esModule: true, default: class {
  chat = { completions: { create: (...args: any[]) => mockCreate(...args) } };
} }));
jest.mock("../db", () => {
  const query: any = { then: (resolve: any) => resolve([]) };
  for (const name of ["from", "where", "limit", "orderBy", "innerJoin", "leftJoin"]) query[name] = () => query;
  return { db: { select: () => query, execute: jest.fn(() => { throw Error("Unexpected database write"); }) } };
});
jest.mock("../utils/getAuthUserId", () => ({ getAuthUserId: () => "synthetic-dessert-account" }));
jest.mock("../services/safetyProfileService", () => ({
  enforceSafetyProfile: async () => ({ result: "ALLOWED", overriddenAllergen: mockOverride }),
}));
jest.mock("../services/behavioralMemoryService", () => ({
  derivePreferenceProfile: async () => null, buildBehavioralMemoryPromptSection: () => "",
}));
jest.mock("../services/creatorSystems/resolveCreatorSystemForUser", () => ({
  resolveCreatorSystemForUser: async () => ({ enabled: true }),
}));
jest.mock("../services/creatorSystems/applyCreatorTransformation", () => ({
  applyCreatorTransformation: async (meal: any) => mockTransform(meal),
}));
jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: async () => ({ isActive: false }),
}));
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: (...args: any[]) => mockImage(...args),
}));
jest.mock("../services/coaching/activityEvents", () => ({
  emitActivityEvent: (...args: any[]) => mockEvent(...args),
}));
jest.mock("../services/dishAdaptation/dishAdaptationLayer", () => ({
  getDishAdaptationDirective: async () => null, buildGuardrailContext: () => ({}),
}));
jest.mock("../services/humanFoodContext/requestScope", () => ({
  createHumanFoodRequestScope: (...args: any[]) => mockScope(...args),
}));
jest.mock("../services/protocolEnvelope", () => {
  const actual = jest.requireActual("../services/protocolEnvelope");
  return {
    ...actual,
    loadGenerationProtocolEnvelope: async () => mockEnvelope,
    scanGeneratedOutput: (...args: any[]) => mockScan(...args),
  };
});

import router from "../routes/dessert-creator";
const actualProtocol = jest.requireActual("../services/protocolEnvelope");
const yieldCases = [
  ["cake", "cake-9-2-12"], ["pie", "pie-9-8"],
  ["cookies", "cookies-24"], ["brownies", "brownies-9x13-12"],
  ["bars", "bars-8x8-6"], ["cheesecake", "cheesecake-9-12"],
  ["cake", "medium-wedding"],
] as const;

function fixture(category = "cake", key = "cake-9-2-12", index = 1) {
  const yieldChoice = resolveDessertYield(key, category, key === "medium-wedding")!;
  const bases = ["almond flour", "oat flour", "chickpea flour", "coconut flour"];
  return {
    name: `Chocolate ${bases[index - 1]} ${category}`, category,
    description: `A complete chocolate ${category} with ${bases[index - 1]}.`,
    servings: yieldChoice.count, servingSize: yieldChoice.label, tiers: yieldChoice.tiers,
    ingredients: [
      { name: bases[index - 1], amount: "240", unit: "g" },
      { name: "cocoa powder", amount: "30", unit: "g" },
    ],
    instructions: `Mix the batter for the entire ${yieldChoice.label}. Bake at 350 F for 30 minutes, cool, then divide into ${yieldChoice.count} servings.`,
    nutrition: { calories: 1200, protein: 60, carbs: 120, fat: 60, starchyCarbs: 40 },
    perServingNutrition: { calories: 9999, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0 },
  };
}
const completion = (meal: any) => ({ choices: [{ message: { content: JSON.stringify(meal) } }] });
async function generate(body: any = {}) {
  let status = 200; let data: any;
  const res: any = { status: (code: number) => { status = code; return res; },
    json: (value: any) => { data = value; return res; } };
  const handler = (router as any).stack.find((layer: any) => layer.route?.path === "/").route.stack[0].handle;
  await handler({ body: { dessertCategory: "cake", flavorFamily: "chocolate", servingSize: "cake-9-2-12", choiceCount: 3, ...body }, id: "offline-dessert" }, res);
  return { status, data };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockReset();
  mockImage.mockReset().mockImplementation(async (name: string) => `/fixture/${name}.jpg`);
  mockComplete.mockResolvedValue(undefined); mockRelease.mockResolvedValue(undefined);
  mockEvent.mockResolvedValue(undefined);
  mockTransform = (meal) => meal; mockOverride = undefined;
  mockEnvelope = actualProtocol.buildGuestEnvelope();
  mockScan.mockImplementation(actualProtocol.scanGeneratedOutput);
  mockContext = {
    version: "human-food-context.v1", actorUserId: "synthetic-dessert-account", subjectUserId: "synthetic-dessert-account",
    status: "resolved", notices: [], internalFingerprint: "offline-dessert",
    diet: { stored: [], effective: [], source: "unavailable", requestOverride: null },
    safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
    flavor: Object.fromEntries(["cuisine", "cuisineIntensity", "heat", "seasoningIntensity", "broadFlavor", "flavorStyle"]
      .map(key => [key, { value: null, available: false, source: "unavailable" }])),
    sweeteners: { preferred: [], avoided: [] },
    authorization: { status: "not_required", waivers: [] }, nutrition: null, behavior: null, gaps: [],
  } as unknown as HumanFoodContext;
  mockScope.mockImplementation(() => ({
    resolve: async () => mockContext, completeAuthorization: mockComplete, releaseAuthorization: mockRelease,
  }));
});

describe("Dessert Creator shared three-choice handler", () => {
  it.each(yieldCases)("preserves complete %s recipes and %s yields for three choices", async (category, key) => {
    [1, 2, 3].forEach(index => mockCreate.mockResolvedValueOnce(completion(fixture(category, key, index))));
    const { status, data } = await generate({ dessertCategory: category, servingSize: key, ...(key === "medium-wedding" ? { cakeType: "wedding-cake", cakeStyle: "semi-naked" } : {}) });
    expect(status).toBe(200);
    expect(data.choices).toHaveLength(3);
    expect(new Set(data.choices.map((meal: any) => meal.id)).size).toBe(3);
    const yieldChoice = resolveDessertYield(key, category, key === "medium-wedding")!;
    for (const meal of data.choices) {
      expect(meal.servings).toBe(yieldChoice.count);
      expect(meal.servingSize).toBe(yieldChoice.label);
      expect(meal.instructions).toContain(yieldChoice.label);
      expect(meal.instructions).toContain("350 F");
      expect(meal.nutrition.calories).toBe(1200);
      for (const nutrient of ["calories", "protein", "carbs", "fat", "starchyCarbs"]) {
        expect(meal.perServingNutrition[nutrient] * meal.servings).toBeCloseTo(meal.nutrition[nutrient]);
      }
      expect(meal.recipeIngredientQuantities).toHaveLength(2);
      expect(dessertFavoritePayload(meal).servings).toBe(yieldChoice.count);
      expect(meal.imageUrl).toContain(meal.name);
      if (category === "cake") expect(meal.totalSlices).toBe(yieldChoice.count);
      if (key === "medium-wedding") expect(meal.tiers).toBe(3);
    }
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(mockScope).toHaveBeenCalledTimes(1);
    expect(mockComplete).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(mockEvent).toHaveBeenCalledTimes(1);
    expect(mockImage).toHaveBeenCalledTimes(3);
  });

  it("rejects renamed and decorated duplicates, refills once, then explains partial success", async () => {
    const first = fixture();
    mockCreate
      .mockResolvedValueOnce(completion(first))
      .mockResolvedValueOnce(completion({ ...first, name: "Renamed chocolate cake" }))
      .mockResolvedValueOnce(completion({ ...first, name: "Decorated cake", ingredients: [...first.ingredients, { name: "sprinkles garnish", amount: "2", unit: "g" }] }))
      .mockResolvedValueOnce(completion(fixture("cake", "cake-9-2-12", 2)));
    const { data } = await generate();
    expect(data.choices).toHaveLength(2);
    expect(data.choiceNotice).toContain("Only 2 distinct desserts");
    expect(mockImage).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].messages[0].content).toContain(first.name);
  });

  it.each(["allergy", "vegan", "clinical", "nutrition", "quantity", "yield"])("never presents candidates failing %s checks", async (failure) => {
    const invalid: any = fixture();
    if (failure === "allergy") {
      mockContext.safety.allergies = ["milk"]; mockEnvelope.allergies = ["milk"];
      invalid.ingredients.push({ name: "milk", amount: "100", unit: "g" });
    }
    if (failure === "vegan") {
      mockContext.diet.effective = ["vegan"]; mockEnvelope.dietaryIdentity = ["vegan"];
      invalid.ingredients.push({ name: "egg", amount: "50", unit: "g" });
    }
    if (failure === "clinical") mockContext.safety.healthConditions = ["heart failure"];
    if (failure === "nutrition") delete invalid.nutrition.protein;
    if (failure === "quantity") invalid.ingredients[0].amount = "to taste";
    if (failure === "yield") invalid.servings = 1;
    mockCreate.mockResolvedValue(completion(invalid));
    const result = await generate();
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.data.choices).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledTimes(4);
    expect(mockComplete).not.toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(mockImage).not.toHaveBeenCalled();
    expect(mockEvent).not.toHaveBeenCalled();
  });

  it("retains accepted recipes after a model failure and an unsafe transformed candidate", async () => {
    mockContext.safety.allergies = ["milk"];
    mockTransform = meal => meal.name.includes("oat flour")
      ? { ...meal, ingredients: meal.ingredients.map((row: any, index: number) =>
          index === 0 ? { ...row, name: "milk" } : row) } : meal;
    mockCreate.mockResolvedValueOnce(completion(fixture()))
      .mockRejectedValueOnce(Error("Synthetic provider failure"))
      .mockResolvedValueOnce(completion(fixture("cake", "cake-9-2-12", 2)))
      .mockResolvedValueOnce(completion(fixture("cake", "cake-9-2-12", 3)));
    const { status, data } = await generate();
    expect(status).toBe(200);
    expect(data.choices.map((meal: any) => meal.name)).toEqual([fixture().name, fixture("cake", "cake-9-2-12", 3).name]);
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  it("never releases a dessert without preparation instructions, including an incomplete repair", async () => {
    mockCreate.mockResolvedValue(completion({ ...fixture(), instructions: "" }));
    const { status, data } = await generate();
    expect(status).toBe(422);
    expect(data.choices).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledTimes(8); // Four attempts, at most one repair each.
    expect(mockImage).not.toHaveBeenCalled();
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("uses repaired final ingredients for imagery and never reuses the rejected recipe's image", async () => {
    mockCreate.mockResolvedValueOnce(completion({ ...fixture(), servingSize: "wrong yield" }))
      .mockResolvedValueOnce(completion(fixture("cake", "cake-9-2-12", 2)))
      .mockResolvedValue(completion(fixture("cake", "cake-9-2-12", 3)));
    const { data } = await generate();
    expect(data.choices).toHaveLength(2);
    expect(mockImage.mock.calls[0][0]).toBe(fixture("cake", "cake-9-2-12", 2).name);
    expect(mockImage.mock.calls[0][1]).toContain("oat flour");
  });

  it("propagates the same exact-allergen override through every protocol scan", async () => {
    mockOverride = "milk"; mockEnvelope.allergies = ["milk"];
    [1, 2, 3].forEach(index => mockCreate.mockResolvedValueOnce(completion(fixture("cake", "cake-9-2-12", index))));
    const { status } = await generate({ overrideToken: "synthetic-override" });
    expect(status).toBe(200);
    for (const [, , options] of mockScan.mock.calls) expect(options.overriddenAllergens).toEqual(["milk"]);
    expect(mockScope).toHaveBeenCalledTimes(1);
  });

  it("retains only validated choices when the shared time budget expires", async () => {
    const clock = jest.spyOn(Date, "now");
    let now = 1000; clock.mockImplementation(() => now);
    mockCreate.mockResolvedValueOnce(completion(fixture())).mockImplementationOnce(async () => {
      now += 100001; return completion(fixture("cake", "cake-9-2-12", 2));
    });
    try {
      const { data } = await generate();
      expect(data.choices).toHaveLength(1);
      expect(data.choiceNotice).toContain("Only 1 distinct dessert");
      expect(mockImage).toHaveBeenCalledTimes(1);
    } finally { clock.mockRestore(); }
  });

  it("preserves validated results when images fail and retains the legacy single-response contract", async () => {
    mockCreate.mockResolvedValue(completion(fixture()));
    mockImage.mockRejectedValue(Error("Synthetic media failure"));
    const { status, data } = await generate({ choiceCount: undefined });
    expect(status).toBe(200);
    expect(data.name).toBe(fixture().name);
    expect(data.choices).toBeUndefined();
    expect(data.imageUrl).toBeNull();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("compares base recipes, not serving amounts, seasoning, decoration or names", () => {
    const first = fixture();
    expect(dessertChoiceSignature(first)).toBe(dessertChoiceSignature({
      ...first, name: "Another name", ingredients: [...first.ingredients.map(row => ({ ...row, amount: "999" })),
        { name: "ground cinnamon", amount: "2", unit: "g" }],
    }));
    expect(dessertChoiceSignature(first)).not.toBe(dessertChoiceSignature(fixture("cake", "cake-9-2-12", 2)));
  });
});
