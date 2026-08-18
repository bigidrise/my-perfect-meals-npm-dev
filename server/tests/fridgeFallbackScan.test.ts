/**
 * fridgeFallbackScan.test.ts
 *
 * Regression: the fridge-rescue/premade deterministic FALLBACK path (AI
 * generator failure) must run the same full-envelope post-generation scan as
 * generated and cached meals — with the request-scoped PIN override context.
 *
 *   1. Fallback containing a non-overridden allergen → safe failure, never served.
 *   2. Fallback containing the authorized (overridden) allergen → served.
 *   3. Fallback violating an independent avoidance → safe failure even when the
 *      allergy itself was overridden.
 *   4. Clean fallback → served (control).
 *
 * Unit tests — generator forced to throw; scan logic is REAL.
 *
 * Run: npx jest server/tests/fridgeFallbackScan.test.ts --runInBand
 */

jest.mock("../db", () => ({ db: {} }));
jest.mock("../storage", () => ({ storage: {} }));
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImage: jest.fn(async () => "https://example.com/img.jpg"),
}));

jest.mock("../services/mealCachePersistent", () => ({
  getCachedMeals: jest.fn(async () => null), // always cache miss
  cacheMeals: jest.fn(),
}));

// AI generator always fails → force the deterministic fallback path
jest.mock("../services/fridgeRescueGenerator", () => ({
  generateFridgeRescueMeals: jest.fn(async () => {
    throw new Error("simulated generator outage");
  }),
}));

const mockGetDeterministicFallback = jest.fn();
jest.mock("../services/templateMatcher", () => {
  const actual = jest.requireActual("../services/templateMatcher");
  return {
    ...actual,
    getDeterministicFallback: (...args: any[]) => mockGetDeterministicFallback(...args),
  };
});

const mockLoadEnvelope = jest.fn();
jest.mock("../services/protocolEnvelope", () => {
  const actual = jest.requireActual("../services/protocolEnvelope");
  return {
    ...actual,
    loadUserProtocolEnvelope: (...args: any[]) => mockLoadEnvelope(...args),
  };
});

import { generateFridgeRescueUnified } from "../services/unifiedMealPipeline";
import { buildGuestEnvelope } from "../services/protocolEnvelope";

const dbModule = jest.requireMock("../db");
dbModule.db.select = () => ({
  from: () => ({
    where: () => ({
      limit: async () => [{ dietaryRestrictions: [], specialtyConditions: [] }],
    }),
  }),
});

function envelope(allergies: string[], avoidances: string[] = []) {
  return { ...buildGuestEnvelope(), allergies, avoidances };
}

function fallbackTemplate(ingredientNames: string[]) {
  return {
    id: "fb-1",
    name: "Pantry Bowl",
    description: "A simple pantry bowl.",
    ingredients: ingredientNames.map(name => ({ name, quantity: "4", unit: "oz" })),
    instructions: "Combine and serve.",
    calories: 400, protein: 25, carbs: 30, fat: 12,
    imageUrl: "https://example.com/fb.jpg",
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("generateFridgeRescueUnified — deterministic fallback is scanned", () => {
  test("fallback with a non-overridden allergen returns safe failure", async () => {
    mockLoadEnvelope.mockResolvedValue(envelope(["shellfish"]));
    mockGetDeterministicFallback.mockReturnValue(fallbackTemplate(["shrimp", "rice"]));

    const result = await generateFridgeRescueUnified(
      ["rice", "shrimp"], "dinner", "user-1",
    );
    expect(result.success).toBe(false);
    expect(result.source).toBe("error");
  });

  test("fallback with the PIN-authorized allergen is served", async () => {
    mockLoadEnvelope.mockResolvedValue(envelope(["shellfish"]));
    mockGetDeterministicFallback.mockReturnValue(fallbackTemplate(["shrimp", "rice"]));

    const result = await generateFridgeRescueUnified(
      ["rice", "shrimp"], "dinner", "user-1",
      undefined, 1, false, undefined,
      ["shellfish"],
    );
    expect(result.success).toBe(true);
    expect(result.meal?.name).toBe("Pantry Bowl");
    expect(result.source).toBe("fallback");
  });

  test("shellfish override does not relax an independent seafood avoidance on the fallback", async () => {
    mockLoadEnvelope.mockResolvedValue(envelope(["shellfish"], ["seafood"]));
    mockGetDeterministicFallback.mockReturnValue(fallbackTemplate(["shrimp", "rice"]));

    const result = await generateFridgeRescueUnified(
      ["rice", "shrimp"], "dinner", "user-1",
      undefined, 1, false, undefined,
      ["shellfish"],
    );
    expect(result.success).toBe(false);
    expect(result.source).toBe("error");
  });

  test("clean fallback is served (control)", async () => {
    mockLoadEnvelope.mockResolvedValue(envelope(["shellfish"]));
    mockGetDeterministicFallback.mockReturnValue(fallbackTemplate(["chicken breast", "rice"]));

    const result = await generateFridgeRescueUnified(
      ["rice", "chicken"], "dinner", "user-1",
    );
    expect(result.success).toBe(true);
    expect(result.source).toBe("fallback");
  });
});
