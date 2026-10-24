const mockGenerate = jest.fn();
const mockGenerateBatch = jest.fn();
const mockCached = jest.fn();
const mockResolve = jest.fn();
const mockValidate = jest.fn();
jest.mock("../db", () => ({ db: {} }));
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.authUser = { id: "fixture-user" };
    next();
  },
}));
jest.mock("../middleware/rateLimit", () => ({
  createApiRateLimit: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock("../utils/getAuthUserId", () => ({ getAuthUserId: () => "fixture-user" }));
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageResult: (...args: any[]) => mockGenerate(...args),
  generateMealImage: (...args: any[]) => mockGenerate(...args),
  generateMealImages: (...args: any[]) => mockGenerateBatch(...args),
  getCachedImage: (...args: any[]) => mockCached(...args),
  getImageCacheStats: jest.fn(),
}));
jest.mock("../services/mealImageRecovery", () => ({ getMealImageRecoveryStatus: jest.fn() }));
jest.mock("../services/humanFoodContext/requestScope", () => ({
  createHumanFoodRequestScope: () => ({ resolve: mockResolve }),
}));
jest.mock("../services/humanFoodContext/finalValidation", () => ({ validateHumanFoodCandidate: mockValidate }));
jest.mock("../services/mealInstructionResolver", () => ({ hydrateMeal: jest.fn() }));
jest.mock("../services/mealValidation", () => ({
  validateAndFixMeal: (meal: any) => ({ meal }),
}));

import express from "express";
import request from "supertest";
import mealsRouter from "../routes/meals";
import { mealImagesRouter } from "../routes/mealImages";
import { DEVELOPMENT_MEAL_IMAGE_BUCKET_ID } from "../services/mealImageBucket";
import { photographFromResponse, placeholderResult, type ImageResult } from "../../shared/imageResult";

const domain = "meal-image-fixture.replit.dev";
const origin = `https://${domain}`;
const path = `/public-objects/${DEVELOPMENT_MEAL_IMAGE_BUCKET_ID}/meal-images/fixture-display.png`;
const evidence: ImageResult = {
  generation: "succeeded", verification: "passed", persistence: "durable", display: "photograph",
  url: path, reason: null, attempts: 1, cancellation: "not_requested",
};
const image = { url: path, imageResult: evidence, hash: "fixture-recipe-key", templateRef: "fixture-meal" };
const body = { mealName: "Fixture meal", ingredients: [{ name: "rice" }], sourceType: "meal" };
const app = express();
app.use(express.json());
app.use("/api/meals", mealsRouter);
app.use("/api", mealImagesRouter);
const deliver = jest.fn((_req: any, res: any) => res.type("image/png").send(Buffer.from("mock-photograph-bytes")));
app.get(path, deliver);
app.get("/public-objects/*", (_req, res) => res.status(404).json({ error: "File not found" }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(process, "env", {
    NODE_ENV: "development", DEVELOPMENT_ABSOLUTE_MEAL_IMAGE_URLS: "true",
    REPLIT_DEV_DOMAIN: domain, MEAL_IMAGE_STORAGE_ENV: "development",
    DEFAULT_OBJECT_STORAGE_BUCKET_ID: DEVELOPMENT_MEAL_IMAGE_BUCKET_ID,
  });
  mockGenerate.mockResolvedValue(image);
  mockGenerateBatch.mockResolvedValue([image]);
  mockCached.mockReturnValue(image);
  mockResolve.mockResolvedValue({ status: "resolved" });
  mockValidate.mockReturnValue({ outcome: "pass", findings: [] });
});
afterEach(() => jest.restoreAllMocks());

describe("mocked HTTP photograph delivery, without provider/storage/database IO", () => {
  it.each(["https://remote-app.example.invalid/meal-board", "capacitor://localhost/meal-board"])(
    "resolves and delivers the exact same photograph from %s", async documentUrl => {
      const response = await request(app).post("/api/meals/generate-image")
        .set("Host", "attacker.invalid").set("X-Forwarded-Host", "app.myperfectmeals.ai")
        .set("X-Forwarded-Proto", "http").send(body);
      expect(response.status).toBe(200);
      expect(response.body.imageUrl).toBe(origin + path);
      expect(response.body.imageResult.url).toBe(response.body.imageUrl);
      expect(response.body.imageStatus).toBe("generated");
      expect(photographFromResponse(response.body)).toBe(origin + path);
      const resolved = new URL(response.body.imageUrl, documentUrl);
      expect(resolved.origin).toBe(origin);
      expect(resolved.pathname).toBe(path);
      // Mock the delivery server, not a real workspace, image provider or bucket.
      const delivered = await request(app).get(resolved.pathname).set("Host", resolved.hostname);
      expect(delivered.status).toBe(200);
      expect(delivered.headers["content-type"]).toMatch(/image\/png/);
      expect(delivered.body).toEqual(Buffer.from("mock-photograph-bytes"));
      expect(deliver).toHaveBeenCalledTimes(1);
      expect(image.url).toBe(path);
      expect(evidence.url).toBe(path);
    },
  );

  it("serializes single, batch and cached image envelopes without changing their metadata", async () => {
    for (const route of ["generate", "generate-batch", "cached"]) {
      const response = await request(app).post(`/api/meal-images/${route}`)
        .send(route === "generate-batch" ? { meals: [{ name: body.mealName, ingredients: body.ingredients }] } : body);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const output = route === "generate-batch" ? response.body.images[0] : response.body.image;
      expect(output.url).toBe(origin + path);
      expect(output.imageResult.url).toBe(output.url);
      expect(output.hash).toBe(image.hash);
      expect(output.templateRef).toBe(image.templateRef);
    }
    expect(mockCached.mock.results[0].value).toBe(image);
    expect(image.url).toBe(path);
  });

  it("changes only freshly generated hydration photos, not an existing saved photograph", async () => {
    const meal = { id: "fixture-meal", title: "Fixture meal", ingredients: body.ingredients };
    const generated = await request(app).post("/api/meal-images/hydrate-with-image")
      .send({ meal, generateImage: true });
    expect(generated.body.meal.imageUrl).toBe(origin + path);
    expect(generated.body.meal.imageResult.url).toBe(origin + path);
    mockGenerate.mockClear();
    const historical = "/public-objects/historical-bucket/meal-images/old.png";
    const saved = await request(app).post("/api/meal-images/hydrate-with-image")
      .send({ meal: { ...meal, imageUrl: historical }, generateImage: true });
    expect(saved.body.meal.imageUrl).toBe(historical);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it.each([
    placeholderResult(null, "storage_unavailable"),
    placeholderResult("/images/fallback/meal.jpg", "generation_failed"),
    { ...evidence, verification: "unavailable", reason: "verification_unavailable" },
    { ...evidence, url: path + ".mismatched" },
  ] as ImageResult[])("never reports an unavailable/unverified image as successful", async imageResult => {
    const failed = { ...image, url: imageResult.url === null ? null : path, imageResult };
    mockGenerate.mockResolvedValue(failed);
    mockGenerateBatch.mockResolvedValue([failed]);
    mockCached.mockReturnValue(failed);
    const response = await request(app).post("/api/meals/generate-image").send(body);
    expect(response.body.imageUrl).toBeNull();
    expect(response.body.imageResult.url).toBeNull();
    expect(response.body.imageStatus).not.toBe("generated");
    expect(photographFromResponse(response.body)).toBeNull();
    for (const route of ["generate", "generate-batch", "cached"]) {
      const result = await request(app).post(`/api/meal-images/${route}`)
        .send(route === "generate-batch" ? { meals: [body] } : body);
      expect(result.body.success).toBe(false);
      const output = route === "generate-batch" ? result.body.images[0] : result.body.image;
      expect(output.url).toBeNull();
      expect(output.imageResult.url).toBeNull();
    }
    expect(deliver).not.toHaveBeenCalled();
  });

  it("does not invent a successful photograph when delivery returns 404", async () => {
    const missingPath = path.replace("fixture-display.png", "missing.png");
    const response = await request(app).get(missingPath);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "File not found" });
    expect(deliver).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("fails closed on invalid origin configuration, with no Host-header fallback", async () => {
    delete process.env.REPLIT_DEV_DOMAIN;
    const response = await request(app).post("/api/meal-images/generate").set("Host", domain).send(body);
    expect(response.status).toBe(500);
    expect(response.body.success).not.toBe(true);
    expect(response.body.image).toBeUndefined();
  });

  it("retains relative URLs when disabled and in Production even if the flag is set", async () => {
    for (const mode of ["disabled", "production"]) {
      process.env.NODE_ENV = mode === "production" ? "production" : "development";
      process.env.DEVELOPMENT_ABSOLUTE_MEAL_IMAGE_URLS = mode === "disabled" ? "false" : "true";
      const response = await request(app).post("/api/meals/generate-image").send(body);
      expect(response.body.imageUrl).toBe(path);
      expect(response.body.imageResult).toEqual(evidence);
    }
  });
});
