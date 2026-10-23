const mockImageGenerate = jest.fn();
const mockValidate = jest.fn();
const mockIngest = jest.fn();
const mockCacheRead = jest.fn();
const mockCacheWrite = jest.fn();

jest.mock("../services/images/imageModelRegistry", () => {
  const actual = jest.requireActual("../services/images/imageModelRegistry");
  return { ...actual, APPROVED_IMAGE_MODEL: { ...actual.APPROVED_IMAGE_MODEL, shutdownDate: null, reservationUSD: .01 } };
});

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ images: { generate: mockImageGenerate } })),
}));
jest.mock("../db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: mockCacheRead }) }) }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: mockCacheWrite }) }),
    delete: () => ({ where: jest.fn() }),
  },
}));
jest.mock("../services/imageLifecycle", () => ({ ingestImageToPermanentStorage: mockIngest }));
jest.mock("../services/mealImageAuthority", () => ({
  validateMealImageAuthority: async (url: string) => ({ status: "available", canonicalUrl: url }),
}));
jest.mock("../services/mealImageValidator", () => ({
  ...jest.requireActual("../services/mealImageValidator"),
  validateImageAgainstRecipe: mockValidate,
}));

import {
  generateMealImageUnified,
  clearImageCache,
  buildStableCacheKey,
  __testables,
} from "../services/mealImageGenerator";
import { buildPediatricImageContext } from "../../shared/pediatricMealImage";

const context = buildPediatricImageContext({
  stageKey: "preschool", textureClass: "family_modified",
  textureAndChokingPreparation: "Serve soft pancakes cut into small manageable pieces.",
});
const ingredients = ["oats", "egg", "milk"];

beforeEach(() => {
  clearImageCache();
  jest.clearAllMocks();
  // Synthetic key only. The OpenAI constructor and all I/O surfaces are mocked.
  process.env.OPENAI_API_KEY = "mock-no-network";
  mockCacheRead.mockResolvedValue([]);
  mockCacheWrite.mockResolvedValue(undefined);
  mockImageGenerate.mockResolvedValue({ data: [{ b64_json: "mock-png" }] });
  mockValidate.mockResolvedValue({ verdict: "PASS", model: "mock-validator" });
  mockIngest.mockResolvedValue({ success: true, permanentUrl: "/public-objects/test/pancakes.jpg" });
});

describe("shared pipeline pediatric photo contracts (no external services)", () => {
  it("generates and stores a realistic prepared-food image once, joining identical in-flight calls", async () => {
    const results = await Promise.all([
      generateMealImageUnified("Preschool Pancakes", ingredients, "meal", context),
      generateMealImageUnified("Preschool Pancakes", ingredients, "meal", context),
    ]);
    expect(results).toEqual(["/public-objects/test/pancakes.jpg", "/public-objects/test/pancakes.jpg"]);
    expect(mockImageGenerate).toHaveBeenCalledTimes(1);
    expect(mockIngest).toHaveBeenCalledTimes(1);
    expect(mockCacheWrite).toHaveBeenCalledTimes(1);
    const prompt = mockImageGenerate.mock.calls[0][0].prompt;
    expect(prompt).toContain("photorealistic");
    expect(prompt).toContain("Preschool");
    expect(prompt).toContain("4–5 years");
    expect(prompt).toContain("soft bite-sized pieces");
    expect(prompt).toContain("Preschool Pancakes");
    expect(prompt).toContain("recognizable prepared-food identity");
    expect(prompt).toContain(context.textureHint);
    expect(mockValidate.mock.calls[0][3].visualRequirements.join("\n")).toContain("soft bite-sized pieces");
  });

  it("retains a failure fallback without attempting storage or a second paid request", async () => {
    mockImageGenerate.mockRejectedValue(new Error("mock timeout"));
    await expect(generateMealImageUnified("Preschool Pancakes", ingredients, "meal", context))
      .resolves.toBe("/images/fallback/breakfast.svg");
    expect(mockImageGenerate).toHaveBeenCalledTimes(1);
    expect(mockIngest).not.toHaveBeenCalled();
    expect(mockCacheWrite).not.toHaveBeenCalled();
  });

  it("retains pediatric appearance on the existing bounded validation retry", async () => {
    mockValidate.mockResolvedValue({ verdict: "FAIL", model: "mock-validator", reason: "adult-sized whole pancakes" });
    await expect(generateMealImageUnified("Preschool Pancakes", ingredients, "meal", context))
      .resolves.toBe("/images/fallback/breakfast.svg");
    expect(mockImageGenerate).toHaveBeenCalledTimes(2);
    for (const [request] of mockImageGenerate.mock.calls) {
      expect(request.prompt).toContain(context.textureHint);
      expect(request.prompt).toContain("soft bite-sized pieces");
    }
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("does not pay for an image without usable recipe ingredients", async () => {
    await expect(generateMealImageUnified("Pancakes", [], "meal", context))
      .resolves.toBe("/images/fallback/breakfast.svg");
    expect(mockImageGenerate).not.toHaveBeenCalled();
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("partitions the cache by all pediatric prompt context while preserving adult keys", () => {
    const base = buildStableCacheKey("Pancakes", ingredients, "meal", context);
    for (const field of ["ageRange", "portionNote", "textureClass", "textureStrategy", "textureHint", "presentationStrategy"] as const) {
      expect(buildStableCacheKey("Pancakes", ingredients, "meal", { ...context, [field]: "different" })).not.toBe(base);
    }
    expect(buildStableCacheKey("Pancakes", ingredients, "meal", { ...context, activeConditionIds: ["COND-0004"] })).not.toBe(base);
    expect(buildStableCacheKey("Pancakes", ingredients, "meal")).not.toBe(base);
    const { activeConditionIds, ...rest } = context;
    expect(buildStableCacheKey("Pancakes", ingredients, "meal", { activeConditionIds, ...rest })).toBe(base);
  });

  it("keeps the recipe ingredient contract and smooth-purée requirements in the prompt", () => {
    const pureeContext = buildPediatricImageContext({ stageKey: "beginning_foods", textureClass: "puree_only" });
    const prompt = __testables.buildMealImagePrompt("Carrot Purée", ["carrot", "water"], "meal", pureeContext);
    expect(prompt).toContain("completely smooth");
    expect(prompt).toContain("no visible chunks");
    expect(prompt).toContain("UNAUTHORIZED INGREDIENTS");
    expect(prompt).toContain("carrot, water");
    expect(prompt).not.toMatch(/pancakes?/i);
  });

  it("retains pediatric requirements on the existing third-attempt savory-side recovery", async () => {
    mockValidate
      .mockResolvedValueOnce({ verdict: "FAIL", reason: "side looks like dessert", model: "mock" })
      .mockResolvedValueOnce({ verdict: "FAIL", reason: "side still looks like dessert", model: "mock" })
      .mockResolvedValueOnce({ verdict: "PASS", model: "mock" });
    await expect(generateMealImageUnified(
      "Flank Steak with Cauliflower Mash", ["flank steak", "cauliflower mash"], "meal", context,
    )).resolves.toBe("/public-objects/test/pancakes.jpg");
    expect(mockImageGenerate).toHaveBeenCalledTimes(3);
    expect(mockImageGenerate.mock.calls[2][0].prompt).toContain("SIMPLIFIED MEAL IMAGE RECOVERY");
    expect(mockImageGenerate.mock.calls[2][0].prompt).toContain("PEDIATRIC CONTEXT");
    expect(mockImageGenerate.mock.calls[2][0].prompt).toContain(context.textureHint);
  });
});
