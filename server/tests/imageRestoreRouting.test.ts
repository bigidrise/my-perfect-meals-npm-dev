jest.mock("../db", () => ({ db: {} }));
jest.mock("../middleware/requireAuth", () => ({ requireAuth: (_req: any, _res: any, next: any) => next() }));
jest.mock("../middleware/rateLimit", () => ({ createApiRateLimit: () => (_req: any, _res: any, next: any) => next() }));
jest.mock("../utils/getAuthUserId", () => ({ getAuthUserId: () => "offline-owner" }));
jest.mock("../services/mealImageGenerator", () => ({ generateMealImageUnified: jest.fn() }));
jest.mock("../services/humanFoodContext/requestScope", () => ({ createHumanFoodRequestScope: jest.fn() }));
jest.mock("../services/humanFoodContext/finalValidation", () => ({ validateHumanFoodCandidate: jest.fn(() => ({ findings: [] })) }));
import express from "express";
import request from "supertest";
import router from "../routes/meals";
import { generateMealImageUnified } from "../services/mealImageGenerator";
import { createHumanFoodRequestScope } from "../services/humanFoodContext/requestScope";
const app = express().use(express.json()).use("/api/meals", router);
const body = { mealName: "Turkey stew", ingredients: ["turkey", "carrots"], sourceType: "meal" };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(generateMealImageUnified).mockResolvedValue("/public-objects/fixture/meal-images/original.jpg");
  jest.mocked(createHumanFoodRequestScope).mockReturnValue({
    resolve: async () => ({ status: "resolved", diabetesFoodPreferences: null }),
  } as any);
});
test.each([undefined, "restore", "unknown"])("intent %s is read-only and skips mutable nutrition context resolution", async generationIntent => {
  const res = await request(app).post("/api/meals/generate-image").send({ ...body, generationIntent });
  expect(res.status).toBe(200);
  expect(generateMealImageUnified).toHaveBeenCalledWith(
    body.mealName, body.ingredients, "meal", undefined, undefined,
    expect.objectContaining({ lookupOnly: true }),
  );
  expect(createHumanFoodRequestScope).not.toHaveBeenCalled();
});
test("only explicit initial intent runs the existing food-context safety gate", async () => {
  const res = await request(app).post("/api/meals/generate-image").send({ ...body, generationIntent: "initial" });
  expect(res.status).toBe(200);
  expect(createHumanFoodRequestScope).toHaveBeenCalledTimes(1);
  expect(generateMealImageUnified).toHaveBeenCalledWith(
    body.mealName, body.ingredients, "meal", undefined, undefined,
    expect.not.objectContaining({ lookupOnly: true }),
  );
});
test("a lookup failure does not masquerade as a successfully saved photograph", async () => {
  jest.mocked(generateMealImageUnified).mockImplementation(async (...args) => {
    args[5]?.onFailure?.("storage_unavailable");
    return "/images/fallback/meal.svg";
  });
  const res = await request(app).post("/api/meals/generate-image").send(body);
  expect(res.body).toMatchObject({
    imageUrl: null, imageStatus: "unavailable", imageFailureCode: "storage_unavailable",
  });
});
test("malformed image lookup inputs fail locally", async () => {
  const res = await request(app).post("/api/meals/generate-image").send({ mealName: 5 });
  expect(res.status).toBe(400);
  expect(generateMealImageUnified).not.toHaveBeenCalled();
});
