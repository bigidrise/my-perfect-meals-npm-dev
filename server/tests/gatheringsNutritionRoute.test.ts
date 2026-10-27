import express from "express";
import request from "supertest";
import router from "../routes/gatherings";
import { loadGenerationProtocolEnvelope, scanGeneratedOutput } from "../services/protocolEnvelope";
import { generateMealFromPrompt } from "../services/universalMealGenerator";
import { calculateGatheringsNutrition, gatheringsNutritionEnabled } from "../services/gatheringsNutrition";

jest.mock("../services/protocolEnvelope", () => ({
  loadGenerationProtocolEnvelope: jest.fn(),
  enforceBeforeGenerate: jest.fn(() => ({ combined: "Existing safety rules" })),
  scanGeneratedOutput: jest.fn(),
}));
jest.mock("../services/universalMealGenerator", () => ({ generateMealFromPrompt: jest.fn() }));
jest.mock("../services/gatheringsNutrition", () => ({
  gatheringsNutritionEnabled: jest.fn(() => true),
  createGatheringsLookup: jest.fn(() => ({ lookup: jest.fn(), metrics: {} })),
  calculateGatheringsNutrition: jest.fn(),
}));
jest.mock("../services/wholeFoodStandard", () => ({
  appendWholeFoodStandardPrompt: (s: string) => s,
  evaluateWholeFoodCandidate: () => ({ shouldBlock: false }),
}));
jest.mock("../services/mealImageGenerator", () => ({ generateMealImageUnified: jest.fn(async () => "/images/test.jpg") }));
const app = express();
app.use(express.json());
app.use((req, _res, next) => { (req as any).authUser = { id: "synthetic-owner" }; next(); });
app.use("/api/gatherings", router);
const envelope = { dietaryIdentity: ["kosher"], allergies: ["nuts"], medicalHardLimits: [] as string[] };
const estimate = (status: string) => ({
  ...(status === "available" ? { nutrition: { calories: 600, protein: 30, carbs: 60, fat: 26.6667 } } : {}),
  nutritionResult: {
    version: "ingredient-recipe-v1", status, basis: "whole_recipe", servings: 6,
    reasons: status === "available" ? [] : ["source_missing"], sources: [], assumptions: [],
  },
});
beforeEach(() => {
  jest.mocked(loadGenerationProtocolEnvelope).mockResolvedValue(envelope as any);
  jest.mocked(scanGeneratedOutput).mockReturnValue({ passed: true } as any);
  jest.mocked(gatheringsNutritionEnabled).mockReturnValue(true);
  jest.mocked(calculateGatheringsNutrition).mockResolvedValue(estimate("available") as any);
  let count = 0;
  jest.mocked(generateMealFromPrompt).mockImplementation(async () => ({
    id: `course-${++count}`, name: ["Soup Starter", "Roasted Chicken", "Fruit Finale"][count - 1],
    ingredients: [{ name: "apples", amount: 300, unit: "g", originalText: "300 g apples" }],
    instructions: ["Bake"], medicalBadges: [],
  }) as any);
});
const generate = () => request(app).post("/api/gatherings/generate").send({
  situation: "holiday", eventType: "hanukkah", totalCourses: 3, servingSize: 6,
});
it("returns recipe totals, saved yield and source status, with existing safety scans", async () => {
  const response = await generate();
  expect(response.status).toBe(200);
  expect(response.body.courses).toHaveLength(3);
  expect(response.body.courses[0]).toMatchObject({
    servings: 6, servingSize: "6 servings", nutrition: { calories: 600 },
    nutritionResult: { status: "available" },
  });
  expect(scanGeneratedOutput).toHaveBeenCalledTimes(3);
  expect(generateMealFromPrompt).toHaveBeenCalledWith(expect.any(String), expect.any(String),
    expect.objectContaining({ allergies: ["nuts"], dietaryRestrictions: ["kosher"] }),
    { gatheringsIngredientNutrition: true });
});
it("unknown nutrition cannot masquerade as clearance for medical hard limits", async () => {
  jest.mocked(loadGenerationProtocolEnvelope).mockResolvedValue({ ...envelope, medicalHardLimits: ["cardiac"] } as any);
  jest.mocked(calculateGatheringsNutrition).mockResolvedValue(estimate("needs_review") as any);
  const response = await generate();
  for (const course of response.body.courses) {
    expect(course._fallback).toBe(true);
    expect(course.ingredients).toEqual([]);
    expect(course.nutrition).toBeUndefined();
  }
});
it("allergy/diet rejection still prevents returning the candidate", async () => {
  jest.mocked(scanGeneratedOutput).mockReturnValue({ passed: false, message: "allergen rejected" } as any);
  const response = await generate();
  expect(scanGeneratedOutput).toHaveBeenCalledTimes(9);
  expect(calculateGatheringsNutrition).not.toHaveBeenCalled();
  for (const course of response.body.courses) {
    expect(course._fallback).toBe(true);
    expect(course.nutrition).toBeUndefined();
    expect(course.nutritionResult.status).toBe("unavailable");
  }
});
it("outside pilot uses the unchanged legacy generator signature", async () => {
  jest.mocked(gatheringsNutritionEnabled).mockReturnValue(false);
  await generate();
  expect(generateMealFromPrompt.mock.calls[0]).toHaveLength(3);
  expect(calculateGatheringsNutrition).not.toHaveBeenCalled();
});
