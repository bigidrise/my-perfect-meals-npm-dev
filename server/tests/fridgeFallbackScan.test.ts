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
    // The unified generator now uses the generation-context entry point. Keep
    // this fallback-scan fixture at that boundary, not on a stale export only.
    loadGenerationProtocolEnvelope: (...args: any[]) => mockLoadEnvelope(...args),
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
    starchyCarbs: 30, fibrousCarbs: 0,
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


describe("Fridge Rescue cache integrity", () => {
  const cache = jest.requireMock("../services/mealCachePersistent");
  const generator = jest.requireMock("../services/fridgeRescueGenerator");

  const validMeal = {
    ...fallbackTemplate(["chicken breast", "broccoli"]),
    source: "ai",
    carbs: 6,
    starchyCarbs: 0,
    fibrousCarbs: 6,
  };

  beforeEach(() => {
    mockLoadEnvelope.mockResolvedValue(envelope([]));
    cache.getCachedMeals.mockResolvedValue(null);
    generator.generateFridgeRescueMeals.mockRejectedValue(
      new Error("simulated generator outage"),
    );
  });

  afterEach(() => {
    cache.getCachedMeals.mockResolvedValue(null);
  });

  test.each([
    ["missing quantity", { ingredients: [{ name: "chicken breast", unit: "g" }] }],
    ["missing unit", { ingredients: [{ name: "chicken breast", quantity: "170" }] }],
    ["zero quantity", { ingredients: [{ name: "chicken breast", quantity: "0", unit: "g" }] }],
    ["vague measurement", { ingredients: [{ name: "chicken breast", quantity: "1", unit: "handful" }] }],
    ["missing protein", { protein: undefined }],
    ["negative protein", { protein: -1 }],
    ["missing starch", { starchyCarbs: undefined }],
    ["missing fibrous carbs", { fibrousCarbs: undefined }],
    ["contradictory carbs", { carbs: 30 }],
    ["invalid calories", { calories: NaN }],
  ])("regenerates instead of serving cached %s", async (_label, changes) => {
    cache.getCachedMeals.mockResolvedValueOnce({
      meals: [{ ...validMeal, ...changes }],
      source: "memory",
      signature: "test-cache",
    });

    await generateFridgeRescueUnified(
      ["chicken breast", "broccoli"], "dinner", "user-1",
      undefined, 1,
    );

    expect(generator.generateFridgeRescueMeals).toHaveBeenCalled();
  });

  test("reuses a valid cached meal without regeneration", async () => {
    cache.getCachedMeals.mockResolvedValueOnce({
      meals: [validMeal],
      source: "memory",
      signature: "test-cache",
    });

    const result = await generateFridgeRescueUnified(
      ["chicken breast", "broccoli"], "dinner", "user-1",
      undefined, 1,
    );

    expect(result.success).toBe(true);
    expect(result.meal).toEqual(validMeal);
    expect(generator.generateFridgeRescueMeals).not.toHaveBeenCalled();
  });

  test("uses an isolated Fridge Rescue cache policy version", async () => {
    cache.getCachedMeals.mockResolvedValueOnce({
      meals: [validMeal],
      source: "memory",
      signature: "test-cache",
    });

    await generateFridgeRescueUnified(
      ["chicken breast", "broccoli"], "dinner", "user-1",
      undefined, 1,
    );

    expect(cache.getCachedMeals).toHaveBeenCalledWith(
      expect.stringContaining("|v:fridge-integrity-v2"),
    );
  });
});


describe("Fridge Rescue fresh generation integrity", () => {
  const cache = jest.requireMock("../services/mealCachePersistent");
  const generator = jest.requireMock("../services/fridgeRescueGenerator");

  const validMeal = {
    ...fallbackTemplate(["chicken breast", "broccoli"]),
    ingredients: [
      { name: "chicken breast", quantity: "170", unit: "g" },
      { name: "broccoli", quantity: "0.125", unit: "cup" },
    ],
    carbs: 6,
    starchyCarbs: 0,
    fibrousCarbs: 6,
    cookingTime: "15 minutes",
    difficulty: "Easy",
    medicalBadges: [],
  };

  beforeEach(() => {
    mockLoadEnvelope.mockResolvedValue(envelope([]));
    cache.getCachedMeals.mockResolvedValue(null);
  });

  afterEach(() => {
    generator.generateFridgeRescueMeals.mockRejectedValue(
      new Error("simulated generator outage"),
    );
  });

  test("preserves verified ingredient quantities and units", async () => {
    generator.generateFridgeRescueMeals.mockResolvedValueOnce([validMeal]);

    const result = await generateFridgeRescueUnified(
      ["chicken breast", "broccoli"], "dinner", "user-1",
      undefined, 1,
    );

    expect(result.success).toBe(true);
    expect(result.meal?.ingredients).toEqual(validMeal.ingredients);
  });

  test.each([
    ["missing quantity", { ingredients: [{ name: "chicken breast", unit: "g" }] }],
    ["missing unit", { ingredients: [{ name: "chicken breast", quantity: "170" }] }],
    ["zero quantity", { ingredients: [{ name: "chicken breast", quantity: "0", unit: "g" }] }],
    ["vague measurement", { ingredients: [{ name: "chicken breast", quantity: "1", unit: "handful" }] }],
    ["missing calories", { calories: undefined }],
    ["negative protein", { protein: -1 }],
    ["missing fat", { fat: undefined }],
    ["missing starch", { starchyCarbs: undefined }],
    ["missing fibrous carbs", { fibrousCarbs: undefined }],
    ["contradictory carbohydrates", { carbs: 30 }],
  ])("does not serve or cache fresh meals with %s", async (_label, changes) => {
    generator.generateFridgeRescueMeals.mockResolvedValueOnce([
      { ...validMeal, ...changes },
    ]);

    const result = await generateFridgeRescueUnified(
      ["chicken breast", "broccoli"], "dinner", "user-1",
      undefined, 1,
    );

    expect(result.success && result.source === "ai").toBe(false);
    expect(cache.cacheMeals).not.toHaveBeenCalled();
  });
});


describe("Fridge Rescue deterministic fallback nutrition integrity", () => {
  beforeEach(() => {
    mockLoadEnvelope.mockResolvedValue(envelope([]));
  });

  const validFallback = {
    ...fallbackTemplate(["chicken breast", "broccoli"]),
    carbs: 7.2,
    starchyCarbs: 0,
    fibrousCarbs: 7.2,
  };

  test("preserves verified fallback carbohydrate quantities", async () => {
    mockGetDeterministicFallback.mockReturnValue(validFallback);

    const result = await generateFridgeRescueUnified(
      ["chicken breast", "broccoli"], "dinner", "user-1",
      undefined, 1,
    );

    expect(result.success).toBe(true);
    expect(result.source).toBe("fallback");
    expect(result.meal?.carbs).toBe(7.2);
    expect(result.meal?.starchyCarbs).toBe(0);
    expect(result.meal?.fibrousCarbs).toBe(7.2);
  });

  test.each([
    ["missing starch", { starchyCarbs: undefined }],
    ["missing fibrous carbs", { fibrousCarbs: undefined }],
    ["negative starch", { starchyCarbs: -1 }],
    ["negative fibrous carbs", { fibrousCarbs: -1 }],
    ["contradictory carbohydrate totals", { carbs: 30 }],
    ["fabricated zero split", { starchyCarbs: 0, fibrousCarbs: 0 }],
    ["invalid protein", { protein: NaN }],
    ["missing measurement", {
      ingredients: [{ name: "chicken breast", unit: "g" }],
    }],
    ["zero measurement", {
      ingredients: [{ name: "chicken breast", quantity: "0", unit: "g" }],
    }],
  ])("rejects fallback with %s", async (_label, changes) => {
    mockGetDeterministicFallback.mockReturnValue({
      ...validFallback,
      ...changes,
    });

    const result = await generateFridgeRescueUnified(
      ["chicken breast", "broccoli"], "dinner", "user-1",
      undefined, 1,
    );

    expect(result.success).toBe(false);
    expect(result.source).toBe("error");
  });
});


describe("Fridge Rescue language isolation", () => {
  const cache = jest.requireMock("../services/mealCachePersistent");
  const generator = jest.requireMock("../services/fridgeRescueGenerator");
  const { requestLanguageContext } = require("../utils/languageInstruction");

  beforeEach(() => {
    mockLoadEnvelope.mockResolvedValue(envelope([]));
    cache.getCachedMeals.mockResolvedValue(null);
    generator.generateFridgeRescueMeals.mockRejectedValue(
      new Error("simulated generator outage"),
    );
    mockGetDeterministicFallback.mockReturnValue(
      fallbackTemplate(["chicken breast", "broccoli"]),
    );
  });

  const run = (preference?: string, device = "en") =>
    new Promise<Awaited<ReturnType<typeof generateFridgeRescueUnified>>>(
      (resolve, reject) => {
        requestLanguageContext(
          { headers: { "x-mpm-ui-language": device } },
          undefined,
          () => {
            generateFridgeRescueUnified(
              ["chicken breast", "broccoli"], "dinner", "user-1",
              undefined, 1, false, preference,
            ).then(resolve, reject);
          },
        );
      },
    );

  test.each([
    ["en", "en", "en"],
    ["es", "en", "es"],
    ["es-MX", "en", "es"],
    ["auto", "es", "es"],
    [undefined, "es", "es"],
    ["en", "es", "en"],
    ["auto", "en", "en"],
  ])("isolates cache for preference %s and device %s", async (
    preference, device, expected,
  ) => {
    await run(preference, device);

    expect(cache.getCachedMeals).toHaveBeenCalledWith(
      expect.stringContaining(`|v:fridge-integrity-v2-${expected}`),
    );
  });

  test.each([
    ["es", "en"],
    ["auto", "es"],
    [undefined, "es"],
  ])("never serves untranslated fallback for %s / %s", async (
    preference, device,
  ) => {
    const result = await run(preference, device);

    expect(result.success).toBe(false);
    expect(result.source).toBe("error");
    expect(result.error).toMatch(/Inténtalo de nuevo/);
    expect(mockGetDeterministicFallback).not.toHaveBeenCalled();
  });

  test("preserves English fallback with explicit English preference", async () => {
    const result = await run("en", "es");

    expect(result.success).toBe(true);
    expect(result.source).toBe("fallback");
    expect(result.meal?.name).toBe("Pantry Bowl");
  });
});

describe("Fridge Rescue dietary retry integrity", () => {
  const cache = jest.requireMock("../services/mealCachePersistent");
  const generator = jest.requireMock("../services/fridgeRescueGenerator");
  const { requestLanguageContext } = require("../utils/languageInstruction");

  const violatingMeal = {
    ...fallbackTemplate(["chicken breast", "broccoli"]),
    name: "Chicken Bowl",
    cookingTime: "15 minutes",
    difficulty: "Easy",
    medicalBadges: [],
  };

  const validRetry = {
    ...violatingMeal,
    id: "retry-1",
    name: "Tofu and Broccoli Bowl",
    ingredients: [
      { name: "tofu", quantity: "170", unit: "g" },
      { name: "broccoli", quantity: "0.125", unit: "cup" },
    ],
  };

  beforeEach(() => {
    mockLoadEnvelope.mockResolvedValue({
      ...envelope([]),
      dietaryIdentity: ["vegan"],
    });
    cache.getCachedMeals.mockResolvedValue(null);
    generator.generateFridgeRescueMeals.mockReset();
    generator.generateFridgeRescueMeals.mockRejectedValue(
      new Error("Unexpected additional generation"),
    );
  });

  afterEach(() => {
    generator.generateFridgeRescueMeals.mockReset();
    generator.generateFridgeRescueMeals.mockRejectedValue(
      new Error("simulated generator outage"),
    );
  });

  const run = (preference?: string, device = "en") =>
    new Promise<Awaited<ReturnType<typeof generateFridgeRescueUnified>>>(
      (resolve, reject) => {
        requestLanguageContext(
          { headers: { "x-mpm-ui-language": device } },
          undefined,
          () => {
            generateFridgeRescueUnified(
              ["tofu", "broccoli"], "dinner", "user-1",
              undefined, 1, false, preference,
            ).then(resolve, reject);
          },
        );
      },
    );

  test.each([
    ["en", "es", "en"],
    ["es", "en", "es"],
    ["es-MX", "en", "es"],
    ["auto", "es", "es"],
    [undefined, "es", "es"],
    ["auto", "en", "en"],
  ])("propagates resolved language %s / %s through both attempts", async (
    preference, device, expected,
  ) => {
    generator.generateFridgeRescueMeals
      .mockResolvedValueOnce([violatingMeal])
      .mockResolvedValueOnce([validRetry]);

    const result = await run(preference, device);

    expect(result.success).toBe(true);
    expect(result.meal?.ingredients).toEqual(validRetry.ingredients);
    expect(generator.generateFridgeRescueMeals).toHaveBeenCalledTimes(2);
    expect(generator.generateFridgeRescueMeals).toHaveBeenNthCalledWith(
      1, expect.objectContaining({ preferredLanguage: expected }),
    );
    expect(generator.generateFridgeRescueMeals).toHaveBeenNthCalledWith(
      2, expect.objectContaining({
        preferredLanguage: expected,
        strictMode: true,
      }),
    );
    expect(cache.cacheMeals).toHaveBeenCalledTimes(1);
    expect(cache.cacheMeals.mock.calls[0][1]).toEqual([result.meal]);
  });

  test.each([
    ["missing measurement", {
      ingredients: [{ name: "tofu", unit: "g" }],
    }],
    ["zero measurement", {
      ingredients: [{ name: "tofu", quantity: "0", unit: "g" }],
    }],
    ["missing protein", { protein: undefined }],
    ["negative fat", { fat: -1 }],
    ["missing carbohydrate split", { fibrousCarbs: undefined }],
    ["contradictory carbohydrates", { carbs: 100 }],
  ])("rejects and never caches retry with %s", async (_label, changes) => {
    generator.generateFridgeRescueMeals
      .mockResolvedValueOnce([violatingMeal])
      .mockResolvedValueOnce([{ ...validRetry, ...changes }]);

    const result = await run("en");

    expect(generator.generateFridgeRescueMeals).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(false);
    expect(result.source).toBe("error");
    expect(cache.cacheMeals).not.toHaveBeenCalled();
  });

  test("rejects a retry that still violates dietary identity", async () => {
    generator.generateFridgeRescueMeals
      .mockResolvedValueOnce([violatingMeal])
      .mockResolvedValueOnce([violatingMeal]);

    const result = await run("en");

    expect(generator.generateFridgeRescueMeals).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(false);
    expect(cache.cacheMeals).not.toHaveBeenCalled();
  });
});
