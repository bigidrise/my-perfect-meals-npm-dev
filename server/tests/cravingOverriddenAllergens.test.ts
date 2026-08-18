/**
 * cravingOverriddenAllergens.test.ts
 *
 * Regression: the Craving Creator path inside the unified pipeline
 * (generateCravingMealUnified) must honor a claimed Safety PIN allergen
 * override — and ONLY the exact authorized allergen. Cached meals are also
 * re-validated against the user's current full protocol envelope.
 *
 *   1. Shellfish-allergic user, no override → cached shrimp meal is blocked.
 *   2. Shellfish-allergic user, claimed shellfish override → shrimp meal served.
 *   3. Shellfish-allergic user, fish override → shrimp meal STILL blocked
 *      (exact canonical-key matching; fish must never unlock shellfish).
 *   4. Second, non-overridden allergy (dairy) remains enforced under a
 *      shellfish override.
 *
 * Unit tests — db/cache/envelope-load mocked; scan logic is REAL.
 *
 * Run: npx jest server/tests/cravingOverriddenAllergens.test.ts --runInBand
 */

jest.mock("../db", () => ({ db: {} }));
jest.mock("../storage", () => ({ storage: {} }));
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImage: jest.fn(async () => "https://example.com/img.jpg"),
}));

const mockGetCachedMeals = jest.fn();
jest.mock("../services/mealCachePersistent", () => ({
  getCachedMeals: (...args: any[]) => mockGetCachedMeals(...args),
  cacheMeals: jest.fn(),
}));

const mockLoadEnvelope = jest.fn();
jest.mock("../services/protocolEnvelope", () => {
  const actual = jest.requireActual("../services/protocolEnvelope");
  return {
    ...actual,
    loadUserProtocolEnvelope: (...args: any[]) => mockLoadEnvelope(...args),
  };
});

import { generateCravingMealUnified } from "../services/unifiedMealPipeline";
import { buildGuestEnvelope } from "../services/protocolEnvelope";

// Mock the db.select chain used for dietary restrictions lookup
const dbModule = jest.requireMock("../db");
dbModule.db.select = () => ({
  from: () => ({
    where: () => ({
      limit: async () => [{ dietaryRestrictions: [] }],
    }),
  }),
});

function envelopeWithAllergies(allergies: string[]) {
  return { ...buildGuestEnvelope(), allergies };
}

const shrimpMeal = {
  id: "cached-1",
  name: "Shrimp Fried Rice",
  description: "Fried rice with shrimp.",
  ingredients: [{ name: "shrimp", quantity: "6", unit: "oz" }, { name: "rice", quantity: "4", unit: "oz" }],
  instructions: "Fry everything.",
  calories: 500, protein: 30, carbs: 50, starchyCarbs: 40, fibrousCarbs: 5, fat: 12,
  cookingTime: "20 minutes", difficulty: "Easy" as const,
  imageUrl: "https://example.com/x.jpg", medicalBadges: [], source: "ai" as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCachedMeals.mockResolvedValue({ meals: [shrimpMeal], source: "ai" });
});

describe("generateCravingMealUnified — PIN override on the craving path", () => {
  test("no override: cached shrimp meal is blocked for a shellfish-allergic user", async () => {
    mockLoadEnvelope.mockResolvedValue(envelopeWithAllergies(["shellfish"]));
    const result = await generateCravingMealUnified(
      "shrimp fried rice", "dinner", "user-1",
    );
    expect(result.success).toBe(false);
    expect(result.source).toBe("error");
  });

  test("claimed shellfish override: cached shrimp meal is served", async () => {
    mockLoadEnvelope.mockResolvedValue(envelopeWithAllergies(["shellfish"]));
    const result = await generateCravingMealUnified(
      "shrimp fried rice", "dinner", "user-1",
      undefined, false, undefined, undefined, undefined,
      ["shellfish"],
    );
    expect(result.success).toBe(true);
    expect(result.meal?.name).toBe("Shrimp Fried Rice");
  });

  test("fish override does NOT unlock shellfish (exact canonical-key matching)", async () => {
    mockLoadEnvelope.mockResolvedValue(envelopeWithAllergies(["shellfish"]));
    const result = await generateCravingMealUnified(
      "shrimp fried rice", "dinner", "user-1",
      undefined, false, undefined, undefined, undefined,
      ["fish"],
    );
    expect(result.success).toBe(false);
    expect(result.source).toBe("error");
  });

  test("shellfish override leaves a second (dairy) allergy fully enforced", async () => {
    mockLoadEnvelope.mockResolvedValue(envelopeWithAllergies(["shellfish", "dairy"]));
    mockGetCachedMeals.mockResolvedValue({
      meals: [{
        ...shrimpMeal,
        name: "Shrimp Alfredo",
        ingredients: [...shrimpMeal.ingredients, { name: "butter", quantity: "2", unit: "tbsp" }],
      }],
      source: "ai",
    });
    const result = await generateCravingMealUnified(
      "shrimp alfredo", "dinner", "user-1",
      undefined, false, undefined, undefined, undefined,
      ["shellfish"],
    );
    expect(result.success).toBe(false);
    expect(result.source).toBe("error");
  });
});
