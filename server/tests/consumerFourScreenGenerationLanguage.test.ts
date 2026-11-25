import { requestLanguageContext } from "../utils/languageInstruction";
import { fridgeRescueDisplayCopy } from "../utils/fridgeRescueDisplayCopy";

const mockCreate = jest.fn();
jest.mock("openai", () => ({ __esModule: true, default: jest.fn(() => ({ chat: { completions: { create: mockCreate } } })) }));
jest.mock("../db", () => ({ db: {}, pool: {} }));
jest.mock("../storage", () => ({ storage: {} }));
jest.mock("../services/mealImageGenerator", () => ({ generateMealImageUnified: jest.fn() }));
jest.mock("../services/protocolEnvelope", () => ({
  loadGenerationProtocolEnvelope: jest.fn(),
  enforceBeforeGenerate: jest.fn(),
  scanGeneratedOutput: jest.fn(),
  buildGuestEnvelope: jest.fn(),
}));
jest.mock("../services/wholeFoodStandard", () => ({
  appendWholeFoodStandardPrompt: (s: string) => s,
  evaluateWholeFoodCandidate: jest.fn(),
}));
jest.mock("../services/behavioralMemoryService", () => ({
  derivePreferenceProfile: jest.fn(),
  buildBehavioralMemoryPromptSection: jest.fn(),
}));
import { generateHarvestToTableGuide } from "../routes/gatherings";
import { generateFridgeRescueMeals } from "../services/fridgeRescueGenerator";
import { generateSingleCompliantFallback } from "../services/unifiedMealPipeline";

function inLanguage<T>(language: string, run: () => T): T {
  let result!: T;
  requestLanguageContext({ headers: { "x-mpm-ui-language": language } }, null, () => { result = run(); });
  return result;
}
beforeEach(() => {
  mockCreate.mockReset();
  global.fetch = jest.fn(() => Promise.reject(Error("Unexpected external fetch in offline language test"))) as any;
});

test.each([["en", "es", false], ["es", "en", true], ["auto", "es", true], ["fr", "es", false]])(
  "outdoor provider prompt respects saved %s with UI %s", async (saved, header, spanish) => {
    const response = { title: "Fixture guide", sections: [{ heading: "Fixture heading", text: "Fixture text" }] };
    mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(response) } }] });
    const result = await inLanguage(header as string, () => generateHarvestToTableGuide("Trout", "Campfire", true, saved as string));
    const request = mockCreate.mock.calls[0][0];
    expect(request.messages[0].content.includes("entirely in Spanish")).toBe(spanish);
    expect(request.response_format).toEqual({ type: "json_object" });
    expect(result).toEqual(response); // No post-generation rewrite, including JSON keys.
  },
);

test("Spanish default/fallback prose never rewrites supplied ingredient names", () => {
  const items = ["Owner's ingredient 42", "arroz"];
  const before = JSON.stringify(items);
  const es = fridgeRescueDisplayCopy("es", items);
  expect(es.fallbacks[0].name).toBe("Sartén sencilla de Owner's ingredient 42");
  expect(es.fallbacks[1].instructions).toContain(items.join(", "));
  expect(es.minutes(15)).toBe("15 minutos");
  expect(JSON.stringify(items)).toBe(before);
  expect(fridgeRescueDisplayCopy("en", items).fallbacks[0].name).toBe("Simple Owner's ingredient 42 Skillet");
});

test.each([["en", "es", false], ["es", "en", true], ["auto", "es", true]])(
  "emergency fallback uses saved %s with UI %s without changing allergy overrides", async (saved, header, spanish) => {
    mockCreate.mockRejectedValue(Error("Offline stop after capturing provider request"));
    const options = { preferredLanguage: saved as string, storedAllergies: ["Milk", "Peanuts"], overriddenAllergens: ["Milk"] };
    const before = JSON.stringify(options);
    await inLanguage(header as string, () => generateSingleCompliantFallback("dinner", "dinner", [], options));
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt.includes("entirely in Spanish")).toBe(spanish);
    expect(prompt).toContain("confirmed allergies to: Peanuts.");
    expect(prompt).not.toContain("confirmed allergies to: Milk");
    expect(JSON.stringify(options)).toBe(before);
  },
);

test("Fridge Rescue provider failure preserves request data across EN/ES", async () => {
  mockCreate.mockRejectedValue(Error("Offline provider failure"));
  const common = {
    fridgeItems: ["chicken", "rice"],
    servings: 2,
    user: { healthConditions: [] },
  };
  const before = JSON.stringify(common);

  for (const language of ["en", "es"]) {
    await expect(generateFridgeRescueMeals({
      ...common,
      preferredLanguage: language,
    })).rejects.toThrow("Offline provider failure");
    expect(JSON.stringify(common)).toBe(before);
  }
});

describe("Fridge Rescue nutrition integrity", () => {
  const request = {
    fridgeItems: ["chicken", "rice"],
    servings: 2,
    user: { healthConditions: [] },
  };

  const validMeal = {
    name: "Chicken and rice",
    description: "Measured ingredients",
    ingredients: [
      { name: "chicken breast", amount: 170, unit: "g" },
      { name: "cooked rice", amount: 0.125, unit: "cup" },
    ],
    instructions: "Cook chicken thoroughly and add cooked rice.",
    calories: 320,
    protein: 40,
    carbs: 6,
    fat: 8,
    starchyCarbs: 6,
    fibrousCarbs: 0,
    cookingTime: "20 minutes",
    difficulty: "Easy",
  };

  function respond(meal: unknown) {
    mockCreate.mockResolvedValue({
      choices: [{ message: {
        content: JSON.stringify({ meals: [meal] }),
      } }],
    });
  }

  test.each([
    ["missing ingredients", { ingredients: undefined }],
    ["empty ingredients", { ingredients: [] }],
    ["missing quantity", { ingredients: [{ name: "chicken", unit: "g" }] }],
    ["missing unit", { ingredients: [{ name: "chicken", amount: 170 }] }],
    ["zero quantity", { ingredients: [{ name: "chicken", amount: 0, unit: "g" }] }],
    ["invalid quantity", { ingredients: [{ name: "chicken", amount: "invalid", unit: "g" }] }],
    ["vague unit", { ingredients: [{ name: "chicken", amount: 1, unit: "handful" }] }],
    ["missing calories", { calories: undefined }],
    ["missing protein", { protein: undefined }],
    ["missing fat", { fat: undefined }],
    ["negative protein", { protein: -1 }],
    ["boolean fat", { fat: true }],
    ["invalid calories", { calories: "invalid" }],
    ["missing starch", { starchyCarbs: undefined }],
    ["missing fibrous carbs", { fibrousCarbs: undefined }],
    ["negative starch", { starchyCarbs: -1 }],
    ["contradictory carbohydrate split", { starchyCarbs: 20 }],
  ])("rejects %s without fabricated replacement", async (_label, changes) => {
    respond({ ...validMeal, ...changes });
    await expect(generateFridgeRescueMeals({
      ...request, preferredLanguage: "en",
    })).rejects.toThrow();
  });

  test.each(["en", "es"])(
    "preserves measured quantities in %s", async language => {
      respond(validMeal);
      const meals = await generateFridgeRescueMeals({
        ...request, preferredLanguage: language,
      });
      expect(meals[0].ingredients).toEqual([
        expect.objectContaining({
          name: "chicken breast", quantity: "170", unit: "g",
        }),
        expect.objectContaining({
          name: "cooked rice", quantity: "0.125", unit: "cup",
        }),
      ]);
    },
  );

  test("preserves genuine zero macro values", async () => {
    respond({
      ...validMeal,
      ingredients: [{ name: "water", amount: 240, unit: "ml" }],
      name: "Water",
      instructions: "Pour into a glass.",
      calories: 0, protein: 0, fat: 0, carbs: 0,
      starchyCarbs: 0, fibrousCarbs: 0,
    });
    const meals = await generateFridgeRescueMeals({
      ...request, preferredLanguage: "en",
    });
    expect(meals[0]).toMatchObject({
      calories: 0, protein: 0, fat: 0, carbs: 0,
      starchyCarbs: 0, fibrousCarbs: 0,
    });
  });

  test.each(["en", "es"])(
    "provider failure cannot fabricate nutrition in %s", async language => {
      mockCreate.mockRejectedValue(Error("Offline provider failure"));
      await expect(generateFridgeRescueMeals({
        ...request, preferredLanguage: language,
      })).rejects.toThrow();
    },
  );
});
