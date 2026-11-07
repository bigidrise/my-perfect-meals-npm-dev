const mockSave = jest.fn(async () => "synthetic-saved-id");
jest.mock("../services/groceryCoachCardSave", () => ({
  saveGroceryCardOnce: (...args: any[]) => mockSave(...args),
}));
jest.mock("../services/productDiscovery/usdaIngredientAdapter", () => ({
  lookupUsdaIngredient: jest.fn(async (description: string) => ({
    description, fdcId: 123, dataType: "SR Legacy", retrievedAt: "2026-11-07T00:00:00Z",
    macrosPer100g: { calories: null, protein: null, carbs: description === "Broccoli, raw" ? 20 : 60, fat: null },
    portions: [], carbSource: "unknown",
  })),
}));
jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn(async () => ({
    userId: "synthetic", dietaryIdentity: [], allergies: [], medicalHardLimits: [], hasDiabetes: false,
  })),
  enforceBeforeGenerate: () => ({ combined: "Synthetic constraints" }),
  scanGeneratedOutput: () => ({ passed: true }),
}));
const mockInstructions = jest.fn(async () => ({
  choices: [{ message: { content: JSON.stringify({ steps: ["Use the listed ingredients."] }) } }],
}));
jest.mock("openai", () => ({
  __esModule: true, default: jest.fn(() => ({ chat: { completions: {
    create: (...args: any[]) => mockInstructions(...args),
  } } })),
}));
jest.mock("../services/mealImageGenerator", () => ({ generateMealImageUnified: jest.fn(async () => null) }));
jest.mock("../services/imageLifecycle", () => ({ processMealImageForSave: jest.fn() }));
import { finalizeMealCard } from "../services/mealCardFinalizer";
import { mealMacroSnapshot } from "../../client/src/lib/mealMacroSnapshot";
import { groceryCoachPlanHandoff } from "../../client/src/lib/groceryCoachPlanHandoff";

const environment = process.env.NODE_ENV;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.NODE_ENV = "development";
});
afterAll(() => { process.env.NODE_ENV = environment; });
const recommendation = () => ({
  meal: { name: "Synthetic Dinner", description: "Existing recipe", prepTime: "10 minutes", servings: 2 },
  macros: { calories: 400, protein: 20, carbs: 40, fat: 10 },
  ownedIngredients: [{ item: "sugar", quantity: "50", unit: "g" }],
  shoppingList: [{ item: "broccoli", quantity: "50", unit: "g" }],
});

it("saves the verified breakdown and evidence through Favorites and the one-serving plan handoff", async () => {
  const input = recommendation();
  const before = JSON.stringify(input);
  await finalizeMealCard({ userId: "synthetic", recommendation: input });
  const saved = JSON.parse(JSON.stringify(mockSave.mock.calls[0][0].mealData));
  expect(saved.nutrition).toEqual({ calories: 400, protein: 20, carbs: 40, fat: 10, starchyCarbs: 30, fibrousCarbs: 10 });
  expect(saved.carbohydrateReview.status).toBe("validated");
  expect(saved.servings).toBe(2);
  const favorite = mealMacroSnapshot(saved);
  const plan = groceryCoachPlanHandoff(saved);
  expect(plan.nutrition).toEqual(expect.objectContaining({
    calories: 200, protein: 10, carbs: 20, fat: 5, starchyCarbs: 15, fibrousCarbs: 5,
  }));
  expect(mealMacroSnapshot(plan)).toEqual({ ...favorite, servings: 1 });
  expect(plan.carbohydrateReview).toEqual(saved.carbohydrateReview);
  expect(JSON.stringify(input)).toBe(before);
  // The only model call is the pre-existing instruction writer, not a repair/regeneration.
  expect(mockInstructions).toHaveBeenCalledTimes(1);
});
it("preserves a meal with unresolved source data and does not trust browser completion", async () => {
  const input = { ...recommendation(), carbohydrateReview: {
    version: 1 as const, status: "validated" as const, reason: "client_assertion",
  } };
  input.shoppingList[0].item = "unknown sauce";
  const result = await finalizeMealCard({ userId: "synthetic", recommendation: input });
  expect(result.id).toBe("synthetic-saved-id");
  const saved = mockSave.mock.calls[0][0].mealData;
  expect(saved.carbohydrateReview.status).toBe("unresolved");
  expect(saved.nutrition).toMatchObject({ carbs: 40, starchyCarbs: null, fibrousCarbs: null });
  expect(saved.ingredients).toHaveLength(2);
  expect(saved.instructions).toHaveLength(1);
  expect(groceryCoachPlanHandoff(saved)).toMatchObject({
    carbohydrateReview: { status: "unresolved" },
    nutrition: { carbs: 20, starchyCarbs: null, fibrousCarbs: null },
  });
});
it("does not activate the correction in Production", async () => {
  process.env.NODE_ENV = "production";
  await finalizeMealCard({ userId: "synthetic", recommendation: recommendation() });
  const saved = mockSave.mock.calls[0][0].mealData;
  expect(saved.carbohydrateReview).toBeUndefined();
  expect(saved.nutrition.starchyCarbs).toBeNull();
});
