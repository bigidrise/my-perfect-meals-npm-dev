jest.mock("../db", () => ({
  db: { select: jest.fn(), insert: jest.fn(), update: jest.fn(), delete: jest.fn() },
}));
jest.mock("openai", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../services/imageLifecycle", () => ({ ingestImageToPermanentStorage: jest.fn() }));
jest.mock("../services/mealImageAuthority", () => ({ validateMealImageAuthority: jest.fn() }));
jest.mock("../services/mealImageValidator", () => ({
  computeRecipeSignature: jest.fn(() => "exact-recipe-signature"),
  validateImageAgainstRecipe: jest.fn(async () => ({ verdict: "PASS", model: "fixture" })),
  buildRetryExclusionAddendum: jest.fn(() => ""),
}));

import OpenAI from "openai";
import { db } from "../db";
import { ingestImageToPermanentStorage } from "../services/imageLifecycle";
import { validateMealImageAuthority } from "../services/mealImageAuthority";
import { clearImageCache, generateMealImageUnified } from "../services/mealImageGenerator";
import { photographFromResponse, imageOutcome, type ImageResult } from "../../shared/imageResult";
import { isFirstPartyPermanentImageUrl } from "../../shared/mediaImageUrls";

const photo = "/public-objects/replit-objstore-11111111/meal-images/original.jpg";
const provider = jest.fn();
const select = jest.mocked(db.select);
function cacheRow(row: object | null) {
  select.mockReturnValue({
    from: () => ({ where: () => ({ limit: async () => row ? [row] : [] }) }),
  } as any);
}
beforeEach(() => {
  jest.clearAllMocks();
  clearImageCache();
  cacheRow(null);
  (OpenAI as unknown as jest.Mock).mockImplementation(() => ({ images: { generate: provider } }));
  provider.mockResolvedValue({ data: [{ b64_json: "Zml4dHVyZQ==" }] });
  jest.mocked(validateMealImageAuthority).mockResolvedValue({
    status: "available", canonicalUrl: photo, bucketId: "fixture", objectName: "meal-images/original.jpg",
  });
  process.env.OPENAI_API_KEY = "offline-fixture-not-a-real-key";
});

function expectReadOnly() {
  expect(provider).not.toHaveBeenCalled();
  expect(db.insert).not.toHaveBeenCalled();
  expect(db.update).not.toHaveBeenCalled();
  expect(db.delete).not.toHaveBeenCalled();
  expect(ingestImageToPermanentStorage).not.toHaveBeenCalled();
}

test("restoring a recipe without any cache reference does not generate or write", async () => {
  const failed = jest.fn();
  await generateMealImageUnified("Turkey vegetable stew", ["turkey", "carrots"], "meal",
    undefined, undefined, { lookupOnly: true, onFailure: failed });
  expect(failed).toHaveBeenCalledWith("validation_unavailable");
  expectReadOnly();
});

test("restoring returns the exact durable photograph without paid work", async () => {
  cacheRow({ imageUrl: photo, validationStatus: "PASS", recipeSignature: "exact-recipe-signature" });
  expect(await generateMealImageUnified("Turkey vegetable stew", ["turkey", "carrots"], "meal",
    undefined, undefined, { lookupOnly: true })).toBe(photo);
  expectReadOnly();
});

test.each(["missing", "unavailable"] as const)("a %s original never falls through to generation or cache deletion", async status => {
  cacheRow({ imageUrl: photo, validationStatus: "PASS", recipeSignature: "exact-recipe-signature" });
  jest.mocked(validateMealImageAuthority).mockResolvedValue(
    status === "missing" ? { status, reason: "missing" } : { status, reason: "storage_unavailable" },
  );
  const failed = jest.fn();
  await generateMealImageUnified("Turkey vegetable stew", ["turkey", "carrots"], "meal",
    undefined, undefined, { onFailure: failed });
  expect(failed).toHaveBeenCalledWith("storage_unavailable");
  expectReadOnly();
});

test("reference storage outage is not permission to generate another photograph", async () => {
  select.mockImplementation(() => { throw new Error("offline fixture: DB unavailable"); });
  await generateMealImageUnified("Turkey vegetable stew", ["turkey", "carrots"], "meal");
  expectReadOnly();
});

test("initial upload failure is explicit and never returns temporary bytes as success", async () => {
  jest.mocked(ingestImageToPermanentStorage).mockResolvedValue({
    success: false, permanentUrl: null, error: "offline storage failure",
  });
  const failed = jest.fn();
  const url = await generateMealImageUnified("Turkey vegetable stew", ["turkey", "carrots"], "meal",
    undefined, undefined, { onFailure: failed });
  expect(provider).toHaveBeenCalledTimes(1);
  expect(failed).toHaveBeenCalledWith("storage_unavailable");
  expect(photographFromResponse({ imageUrl: url })).toBeNull();
  expect(db.insert).not.toHaveBeenCalled();
});

test.each([
  "data:image/png;base64,Zml4dHVyZQ==",
  "https://temporary.blob.core.windows.net/image.png",
  "https://untrusted.example/amazonaws.com/image.jpg",
  "https://bucket.s3.amazonaws.com/image.jpg?X-Amz-Signature=expires",
])("temporary or unowned URL is not a permanent photograph: %s", imageUrl => {
  expect(photographFromResponse({ imageUrl })).toBeNull();
  expect(isFirstPartyPermanentImageUrl(imageUrl)).toBe(false);
});

test("typed generation success cannot conceal failed persistence", () => {
  const result: ImageResult = {
    generation: "succeeded", verification: "passed", persistence: "failed",
    display: "photograph", url: photo, reason: "storage_unavailable", attempts: 1,
    cancellation: "not_requested",
  };
  expect(photographFromResponse({ imageUrl: photo, imageResult: result })).toBeNull();
  expect(imageOutcome(result)).toBe("failed");
});
