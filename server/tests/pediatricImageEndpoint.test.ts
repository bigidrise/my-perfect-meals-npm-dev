const mockGenerate = jest.fn();
const mockResolve = jest.fn();
const mockValidate = jest.fn();

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.authUser = { id: "mock-parent" };
    next();
  },
}));
jest.mock("../middleware/rateLimit", () => ({
  createApiRateLimit: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock("../utils/getAuthUserId", () => ({ getAuthUserId: () => "mock-parent" }));
jest.mock("../services/mealImageGenerator", () => ({ generateMealImageUnified: mockGenerate }));
jest.mock("../services/humanFoodContext/requestScope", () => ({
  createHumanFoodRequestScope: () => ({ resolve: mockResolve }),
}));
jest.mock("../services/humanFoodContext/finalValidation", () => ({ validateHumanFoodCandidate: mockValidate }));

import express from "express";
import request from "supertest";
import mealsRouter from "../routes/meals";
import { buildPediatricImageContext } from "../../shared/pediatricMealImage";

const app = express();
app.use(express.json());
app.use("/api/meals", mealsRouter);
const pediatricContext = buildPediatricImageContext({
  stageKey: "preschool",
  textureClass: "family_modified",
  textureAndChokingPreparation: "Soft pancakes in small manageable pieces.",
});
const body = { mealName: "Preschool Pancakes", ingredients: [{ name: "oats" }], sourceType: "meal", pediatricContext };

beforeEach(() => {
  jest.clearAllMocks();
  mockResolve.mockResolvedValue({ status: "resolved" });
  mockValidate.mockReturnValue({ outcome: "pass", findings: [] });
  mockGenerate.mockResolvedValue("/public-objects/test/pancakes.jpg");
});

describe("effective shared pediatric image endpoint", () => {
  it("forwards the full pediatric context to the shared generator exactly once", async () => {
    const result = await request(app).post("/api/meals/generate-image").send(body);
    expect(result.status).toBe(200);
    expect(result.body.imageStatus).toBe("generated");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith(body.mealName, body.ingredients, "meal", pediatricContext);
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockValidate).toHaveBeenCalledTimes(1);
  });

  it("preserves adult callers without a pediatric context", async () => {
    const result = await request(app).post("/api/meals/generate-image").send({ ...body, pediatricContext: undefined });
    expect(result.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledWith(body.mealName, body.ingredients, "meal", undefined);
  });

  it("marks a fallback explicitly without another generation", async () => {
    mockGenerate.mockResolvedValue("/images/fallback/breakfast.svg");
    const result = await request(app).post("/api/meals/generate-image").send(body);
    expect(result.body.imageStatus).toBe("fallback");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed pediatric visual context before any image work", async () => {
    const result = await request(app).post("/api/meals/generate-image").send({ ...body, pediatricContext: { stage: 123 } });
    expect(result.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("does not bypass the existing unresolved-context safeguard", async () => {
    mockResolve.mockResolvedValue({ status: "review_required" });
    const result = await request(app).post("/api/meals/generate-image").send(body);
    expect(result.status).toBe(409);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("does not bypass the existing ingredient safeguard", async () => {
    mockValidate.mockReturnValue({ findings: [{ dimension: "glucose_food_preference", message: "Not allowed" }] });
    const result = await request(app).post("/api/meals/generate-image").send(body);
    expect(result.status).toBe(422);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
