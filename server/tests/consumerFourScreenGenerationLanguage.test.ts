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

test("actual Fridge Rescue provider fallback preserves all nutrition and canonical difficulty across EN/ES", async () => {
  mockCreate.mockRejectedValue(Error("Offline provider failure"));
  const common = { fridgeItems: ["chicken", "rice"], servings: 2, user: { healthConditions: [] } };
  const before = JSON.stringify(common);
  const en = await generateFridgeRescueMeals({ ...common, preferredLanguage: "en" });
  const es = await generateFridgeRescueMeals({ ...common, preferredLanguage: "es" });
  const unchanged = (meals: any[]) => meals.map(({ calories, protein, carbs, fat, starchyCarbs, fibrousCarbs, difficulty, ingredients }) => ({
    calories, protein, carbs, fat, starchyCarbs, fibrousCarbs, difficulty,
    ingredients: ingredients.map(({ name, unit }: any) => ({ name, unit })),
  }));
  expect(unchanged(es)).toEqual(unchanged(en));
  expect(es[0].name).toBe("Sartén sencilla de chicken");
  expect(es[0].instructions).toContain("Calienta una sartén");
  expect(es.map(m => m.calories)).toEqual([285, 320, 265]);
  expect(JSON.stringify(common)).toBe(before);
});
