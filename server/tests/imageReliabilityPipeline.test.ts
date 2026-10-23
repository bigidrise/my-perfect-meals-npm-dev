const mockGenerate = jest.fn();
const mockVerify = jest.fn();
const mockIngest = jest.fn();
const mockRead = jest.fn();
const mockWrite = jest.fn();
const mockDelete = jest.fn();
const mockAuthority = jest.fn();

jest.mock("openai", () => ({
  __esModule: true, default: jest.fn().mockImplementation(() => ({ images: { generate: mockGenerate } })),
}));
jest.mock("../db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: mockRead }) }) }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: mockWrite }) }),
    delete: () => ({ where: mockDelete }),
  },
}));
jest.mock("../services/images/imageModelRegistry", () => {
  const actual = jest.requireActual("../services/images/imageModelRegistry");
  return { ...actual, APPROVED_IMAGE_MODEL: { ...actual.APPROVED_IMAGE_MODEL, requiresDevelopmentActivation: false, shutdownDate: null, reservationUSD: .01 } };
});
jest.mock("../services/mealImageValidator", () => ({
  ...jest.requireActual("../services/mealImageValidator"), validateImageAgainstRecipe: mockVerify,
}));
jest.mock("../services/imageLifecycle", () => ({ ingestImageToPermanentStorage: mockIngest }));
jest.mock("../services/mealImageAuthority", () => ({ validateMealImageAuthority: mockAuthority }));

import { generateMealImage, generateMealImageResult, generateMealImageUnified, clearImageCache, getCachedImage, isCacheRowServable } from "../services/mealImageGenerator";
import { computeRecipeSignature } from "../services/mealImageValidator";
import { isVerifiedPhotograph } from "../../shared/imageResult";
import { APPROVED_IMAGE_MODEL } from "../services/images/imageModelRegistry";

let name = "Berry Coconut Chia Parfait";
const ingredients = ["berries", "coconut", "chia"];
const permanentUrl = "/public-objects/fixture/photo.png";

beforeEach(() => {
  // Uncertain operation tombstones intentionally survive display-cache invalidation.
  // Isolate fixture identities rather than weakening the production replay guard.
  name = `Berry Coconut Chia Parfait ${expect.getState().currentTestName}`;
  clearImageCache();
  jest.clearAllMocks();
  process.env.OPENAI_API_KEY = "synthetic-no-network";
  mockRead.mockResolvedValue([]);
  mockGenerate.mockResolvedValue({ data: [{ b64_json: "fixture-image" }], _request_id: "req_generation_fixture",
    usage: { input_tokens: 1, input_tokens_details: { text_tokens: 1, image_tokens: 0 }, output_tokens: 196, total_tokens: 197 } });
  mockVerify.mockResolvedValue({ verdict: "PASS", model: "fixture", requestId: "req_verification_fixture",
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  mockIngest.mockResolvedValue({ success: true, permanentUrl });
  mockAuthority.mockImplementation(async url => ({ status: "available", canonicalUrl: url }));
  // This mutable object exists only in the mocked module, never the real frozen registry.
  (APPROVED_IMAGE_MODEL as { shutdownDate: string | null }).shutdownDate = null;
});

describe("shared image pipeline result and cache contracts (all IO mocked)", () => {
  it("provider retirement error becomes a typed placeholder, not a successful cache entry", async () => {
    mockGenerate.mockRejectedValue({ status: 400, message: "The model 'gpt-image-1' does not exist." });
    const result = await generateMealImageResult(name, ingredients, "snack");
    expect(result.imageResult.reason).toBe("model_unavailable");
    expect(result.imageResult.generation).toBe("failed");
    expect(result.url).toBe("/images/fallback/meal.svg");
    expect(isVerifiedPhotograph(result.imageResult)).toBe(false);
    expect(getCachedImage({ mealName: name, ingredients, sourceType: "snack" })).toBeNull();
    expect(mockIngest).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("joins identical requests and returns independent generation/verification/persistence evidence", async () => {
    const [a, b] = await Promise.all([generateMealImageResult(name, ingredients, "snack"), generateMealImageResult(name, ingredients, "snack")]);
    expect(a).toEqual(b);
    expect(a.imageResult).toMatchObject({ generation: "succeeded", verification: "passed", persistence: "durable", display: "photograph" });
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate.mock.calls[0][1]).toMatchObject({ maxRetries: 0, signal: expect.any(AbortSignal) });
    expect(mockGenerate.mock.calls[0][0]).toMatchObject({
      model: "gpt-image-2.5-flare-2026-09-08", n: 1, size: "1024x1024",
      quality: "low", output_format: "png", background: "opaque", moderation: "auto",
    });
    expect(mockIngest).toHaveBeenCalledTimes(1);
  });

  it("serves a verified cache without generating again", async () => {
    await generateMealImageResult(name, ingredients, "snack");
    const cached = await generateMealImageResult(name, ingredients, "snack");
    expect(isVerifiedPhotograph(cached.imageResult)).toBe(true);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(cached.imageResult.attempts).toBe(0);
  });

  it("retirement does not prevent returning an existing verified stored photograph", async () => {
    (APPROVED_IMAGE_MODEL as { shutdownDate: string | null }).shutdownDate = "2000-01-01";
    mockRead.mockResolvedValue([{ imageUrl: permanentUrl, validationStatus: "PASS", recipeSignature: computeRecipeSignature(ingredients) }]);
    const result = await generateMealImageResult(name, ingredients, "snack");
    expect(result.url).toBe(permanentUrl);
    expect(isVerifiedPhotograph(result.imageResult)).toBe(true);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockIngest).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("does not duplicate an uncertain timed-out generation or ingest its late result", async () => {
    jest.useFakeTimers();
    try {
      let complete!: (value: any) => void;
      mockGenerate.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
      const pending = generateMealImageResult("Timeout fixture parfait", ingredients, "snack");
      await jest.advanceTimersByTimeAsync(150_001);
      const result = await pending;
      expect(result.imageResult).toMatchObject({
        generation: "pending", display: "placeholder", cancellation: "requested_unconfirmed",
      });
      complete({ data: [{ b64_json: "late-fixture" }] });
      await Promise.resolve();
      await expect(generateMealImageResult("Timeout fixture parfait", ingredients, "snack")).resolves.toEqual(result);
      await expect(generateMealImage({ mealName: "Timeout fixture parfait", ingredients, sourceType: "snack" })).resolves.toEqual(result);
      expect(mockGenerate).toHaveBeenCalledTimes(1);
      expect(mockIngest).not.toHaveBeenCalled();
      expect(mockWrite).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
  });

  it.each(["SKIPPED", "FAIL"])("does not publish/cache unverified output: %s", async verdict => {
    mockVerify.mockResolvedValue({ verdict, reason: "fixture", model: "fixture" });
    const result = await generateMealImageResult(name, ingredients, "snack");
    expect(result.imageResult.verification).toBe(verdict === "FAIL" ? "failed" : "unavailable");
    expect(result.imageResult.display).toBe("placeholder");
    expect(mockIngest).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockGenerate.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("keeps a verified photo distinct from failed persistence", async () => {
    mockIngest.mockResolvedValue({ success: false });
    const result = await generateMealImageResult(name, ingredients, "snack");
    expect(result.imageResult).toMatchObject({ generation: "succeeded", verification: "passed", persistence: "failed", display: "photograph" });
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("does not call a provider without recipe authority; URL compatibility remains", async () => {
    const result = await generateMealImageResult(name, [], "snack");
    expect(result.imageResult.reason).toBe("no_recipe_contract");
    expect(await generateMealImageUnified(name, [], "snack")).toBe(result.url);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("ignores old SKIPPED rows without deleting or overwriting historical records on failure", async () => {
    mockRead.mockResolvedValue([{ imageUrl: permanentUrl, validationStatus: "SKIPPED", recipeSignature: computeRecipeSignature(ingredients) }]);
    mockGenerate.mockRejectedValue(new Error("provider unavailable"));
    await generateMealImageResult(name, ingredients, "snack");
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it("storage uncertainty does not delete or regenerate an existing cached photo", async () => {
    mockRead.mockResolvedValue([{ imageUrl: permanentUrl, validationStatus: "PASS", recipeSignature: computeRecipeSignature(ingredients) }]);
    mockAuthority.mockResolvedValue({ status: "uncertain" });
    const result = await generateMealImageResult(name, ingredients, "snack");
    expect(result.imageResult.reason).toBe("storage_unavailable");
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("rejects even PASS-labeled placeholders and SKIPPED cache entries", () => {
    const signature = computeRecipeSignature(ingredients);
    expect(isCacheRowServable({ validationStatus: "PASS", recipeSignature: signature, imageUrl: "/images/fallback/meal.svg" }, signature)).toBe(false);
    expect(isCacheRowServable({ validationStatus: "SKIPPED", recipeSignature: signature, imageUrl: permanentUrl }, signature)).toBe(false);
  });

  it("overall timeout does not publish late persistence, write a late cache row, or generate again", async () => {
    jest.useFakeTimers();
    try {
      let finish!: (value: any) => void;
      mockIngest.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
      const pending = generateMealImageResult(name, ingredients, "snack");
      await jest.advanceTimersByTimeAsync(180_001);
      const result = await pending;
      expect(result.imageResult.cancellation).toBe("requested_unconfirmed");
      expect(result.imageResult.display).toBe("placeholder");
      finish({ success: true, permanentUrl });
      await jest.advanceTimersByTimeAsync(1);
      expect(mockWrite).not.toHaveBeenCalled();
      expect(getCachedImage({ mealName: name, ingredients, sourceType: "snack" })).toBeNull();
      await expect(generateMealImageResult(name, ingredients, "snack")).resolves.toEqual(result);
      expect(mockGenerate).toHaveBeenCalledTimes(1);
    } finally { jest.useRealTimers(); }
  });

  it("an unexpected verifier response with unavailable usage cannot create a photograph", async () => {
    mockVerify.mockResolvedValue({ verdict: "SKIPPED", model: "gpt-4o" });
    const first = await generateMealImageResult(name, ingredients, "snack");
    expect(first.imageResult.verification).toBe("unavailable");
    expect(first.imageResult.spending?.accountingUncertain).toBe(true);
    await generateMealImageResult(name, ingredients, "snack");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockIngest).not.toHaveBeenCalled();
  });
});
