import {
  canonicalDevelopmentMealImageUrl,
  developmentMealImagePublicOrigin,
  generatedMealPhotographResponse,
  serializeGeneratedMealPhotograph,
  type DevelopmentMealImageUrlEnvironment,
} from "../services/developmentMealImageUrls";
import {
  DEVELOPMENT_MEAL_IMAGE_BUCKET_ID,
  PRODUCTION_MEAL_IMAGE_BUCKET_ID,
  publicMealImageUrl,
} from "../services/mealImageBucket";
import { photographFromResponse, placeholderResult, type ImageResult } from "../../shared/imageResult";
jest.mock("../objectStorage", () => ({
  ObjectStorageService: jest.fn(),
  StorageUnavailableError: class extends Error {},
}));
import { parseMealImageObjectUrl } from "../services/mealImageAuthority";

const env: DevelopmentMealImageUrlEnvironment = {
  NODE_ENV: "development",
  DEVELOPMENT_ABSOLUTE_MEAL_IMAGE_URLS: "true",
  REPLIT_DEV_DOMAIN: "meal-image-fixture.replit.dev",
  MEAL_IMAGE_STORAGE_ENV: "development",
  DEFAULT_OBJECT_STORAGE_BUCKET_ID: DEVELOPMENT_MEAL_IMAGE_BUCKET_ID,
};
const origin = "https://meal-image-fixture.replit.dev";
const path = publicMealImageUrl("meal-images/fixture-display.png", {
  environment: "development", bucketId: DEVELOPMENT_MEAL_IMAGE_BUCKET_ID,
});
const evidence: ImageResult = {
  generation: "succeeded", verification: "passed", persistence: "durable",
  display: "photograph", url: path, reason: null, attempts: 1, cancellation: "not_requested",
};
const image = { url: path, imageResult: evidence, hash: "unchanged-cache-key", templateRef: "fixture-meal" };

describe("Development-only absolute photograph transport", () => {
  it("is opt-in, and is inert in test, unset, Production and published Development runtimes", () => {
    for (const disabled of [
      { ...env, DEVELOPMENT_ABSOLUTE_MEAL_IMAGE_URLS: undefined },
      { ...env, DEVELOPMENT_ABSOLUTE_MEAL_IMAGE_URLS: "false" },
      { ...env, NODE_ENV: undefined },
      { ...env, NODE_ENV: "test" },
      { ...env, NODE_ENV: "production" },
      { ...env, NODE_ENV: "production", MEAL_IMAGE_STORAGE_ENV: "production" },
    ]) {
      expect(developmentMealImagePublicOrigin(disabled)).toBeNull();
      expect(serializeGeneratedMealPhotograph(image, disabled)).toBe(image);
      expect(generatedMealPhotographResponse(image, disabled)).toEqual({ imageUrl: path, imageResult: evidence });
    }
  });

  it("copies both URL fields without mutating cache, evidence, recipe identity or object path", () => {
    Object.freeze(evidence);
    Object.freeze(image);
    const output = serializeGeneratedMealPhotograph(image, env);
    expect(output).toEqual({ ...image, url: origin + path, imageResult: { ...evidence, url: origin + path } });
    expect(output.hash).toBe(image.hash);
    expect(output.templateRef).toBe(image.templateRef);
    expect(image.url).toBe(path);
    expect(evidence.url).toBe(path);
    expect(new URL(output.url!).pathname).toBe(path);
    expect(serializeGeneratedMealPhotograph(output, env)).toEqual(output);
    expect(photographFromResponse(generatedMealPhotographResponse(image, env))).toBe(origin + path);
  });

  it.each([
    undefined, "", "app.myperfectmeals.ai", "http://fixture.replit.dev",
    "fixture.replit.dev/elsewhere", "fixture.replit.dev?redirect=production",
    "fixture.replit.dev#fragment", "user@fixture.replit.dev",
    "fixture.replit.dev:444", "fixture.replit.dev.attacker.invalid", "a..replit.dev",
  ])("fails closed for missing or invalid trusted Development hostname %s", domain => {
    expect(() => developmentMealImagePublicOrigin({ ...env, REPLIT_DEV_DOMAIN: domain })).toThrow();
  });

  it("rejects Production storage and never rehosts a Production, foreign or traversing path", () => {
    expect(() => developmentMealImagePublicOrigin({ ...env, MEAL_IMAGE_STORAGE_ENV: "production" })).toThrow();
    expect(() => developmentMealImagePublicOrigin({ ...env, DEFAULT_OBJECT_STORAGE_BUCKET_ID: PRODUCTION_MEAL_IMAGE_BUCKET_ID })).toThrow();
    for (const bad of [
      path.replace(DEVELOPMENT_MEAL_IMAGE_BUCKET_ID, PRODUCTION_MEAL_IMAGE_BUCKET_ID),
      `https://app.myperfectmeals.ai${path}`, `//attacker.invalid${path}`,
      path.replace("fixture-display.png", "../other.png"),
      path.replace("fixture-display.png", "%2e%2e/other.png"),
    ]) {
      expect(() => serializeGeneratedMealPhotograph({ ...image, url: bad, imageResult: { ...evidence, url: bad } }, env)).toThrow();
    }
  });

  it("canonicalizes only this exact Development transport origin for save/authority round trips", () => {
    expect(canonicalDevelopmentMealImageUrl(origin + path, env)).toBe(path);
    for (const historical of [path, `https://other.replit.dev${path}`, `https://app.myperfectmeals.ai${path}`, "/images/old.jpg"]) {
      expect(canonicalDevelopmentMealImageUrl(historical, env)).toBe(historical);
    }
    expect(canonicalDevelopmentMealImageUrl(origin + path, { ...env, NODE_ENV: "production" })).toBe(origin + path);
  });

  it("binds a returned HTTPS URL to the same authority object without trusting another hostname", () => {
    const replacement = jest.replaceProperty(process, "env", { ...env });
    try {
      expect(parseMealImageObjectUrl(origin + path)).toEqual(parseMealImageObjectUrl(path));
      expect(parseMealImageObjectUrl(origin + path)).toEqual({
        bucketId: DEVELOPMENT_MEAL_IMAGE_BUCKET_ID, objectName: "meal-images/fixture-display.png",
      });
      expect(parseMealImageObjectUrl(`https://attacker.invalid${path}`)).toBeNull();
      expect(parseMealImageObjectUrl(`https://app.myperfectmeals.ai${path}`)).toBeNull();
    } finally {
      replacement.restore();
    }
  });

  it.each(["failed", "unavailable", "pending", "not_started"] as const)(
    "does not expose a photograph when verification is %s", verification => {
      const result = { ...evidence, verification, reason: "original-failure-reason" };
      const output = generatedMealPhotographResponse({ ...image, imageResult: result }, env);
      expect(output.imageUrl).toBeNull();
      expect(output.imageResult.url).toBeNull();
      expect(output.imageResult.verification).toBe(verification);
      expect(output.imageResult.reason).toBe("original-failure-reason");
      expect(photographFromResponse(output)).toBeNull();
      expect(result.url).toBe(path);
    },
  );

  it("keeps missing, placeholder and mismatched photograph states truthful", () => {
    for (const result of [
      placeholderResult(null, "storage_unavailable"),
      placeholderResult("/images/fallback/meal.jpg", "generation_failed"),
      { ...evidence, url: null },
      { ...evidence, url: path + ".different" },
    ]) {
      const output = generatedMealPhotographResponse({ ...image, imageResult: result }, env);
      expect(output.imageUrl).toBeNull();
      expect(output.imageResult.url).toBeNull();
      expect(photographFromResponse(output)).toBeNull();
      expect(output.imageResult.display).not.toBe("photograph");
    }
  });
});
