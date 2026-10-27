import express from "express";
import request from "supertest";
import router from "../routes/gatherings";
import { loadGenerationProtocolEnvelope, scanGeneratedOutput } from "../services/protocolEnvelope";
import { generateMealFromPrompt } from "../services/universalMealGenerator";
import { calculateGatheringsNutrition, gatheringsNutritionEnabled } from "../services/gatheringsNutrition";
import { SafeRecipeGenerationError } from "../../shared/recipeDraftSafety";

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
    version: "ingredient-recipe-v2", status, basis: "whole_recipe", servings: 6,
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
    id: `course-${++count}`, name: ["Soup Starter", "Roasted Chicken", "Fruit Finale"][(count - 1) % 3],
    description: "A complete recipe.",
    ingredients: [{ name: "apples", amount: 300, unit: "g", originalText: "300 g apples" }],
    instructions: ["Bake"], medicalBadges: [],
    nutrition: { calories: 53, protein: 1, carbs: 8, fat: 3 },
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
  expect(response.body.completion).toMatchObject({ state: "complete", completed: 3, requested: 3 });
  expect(response.body.courses.every((course: any) => course.outcome === "success" && !course._fallback)).toBe(true);
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
    expect(course.outcome).toBe("clinical_withheld");
  }
});
it("unknown nonclinical courses do not retain any upstream AI/default nutrition", async () => {
  jest.mocked(calculateGatheringsNutrition).mockResolvedValue(estimate("needs_review") as any);
  const response = await generate();
  expect(response.status).toBe(200);
  for (const course of response.body.courses) {
    expect(course.nutrition).toBeUndefined();
    expect(course.nutritionResult.status).toBe("needs_review");
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
    expect(course.outcome).toBe("protocol_rejected");
  }
});
it("outside pilot uses the unchanged legacy generator signature", async () => {
  jest.mocked(gatheringsNutritionEnabled).mockReturnValue(false);
  await generate();
  expect(generateMealFromPrompt.mock.calls[0]).toHaveLength(3);
  expect(calculateGatheringsNutrition).not.toHaveBeenCalled();
});

const completeRecipe = (name: string, instructions: unknown = ["Bake until tender."]) => ({
  name, description: "A complete recipe.", ingredients: [{ name: "apples", amount: 300, unit: "g" }],
  instructions, medicalBadges: [],
});
it("returns truthful partial completion after bounded provider retries", async () => {
  let calls = 0;
  jest.mocked(generateMealFromPrompt).mockImplementation(async () => {
    calls++;
    if (calls >= 2 && calls <= 4) throw new SafeRecipeGenerationError("provider_error");
    return completeRecipe(calls === 1 ? "Soup Starter" : "Fruit Finale") as any;
  });
  const response = await generate();
  expect(response.body.courses.map((course: any) => course.outcome)).toEqual(["success", "generation_failed", "success"]);
  expect(response.body.completion).toMatchObject({ state: "partial", completed: 2, requested: 3 });
  expect(response.body.courses[1].instructions).toEqual([]);
  expect(generateMealFromPrompt).toHaveBeenCalledTimes(5);
});
it("returns complete failure and no invented steps after all nine provider attempts fail", async () => {
  jest.mocked(generateMealFromPrompt).mockRejectedValue(new SafeRecipeGenerationError("provider_error"));
  const response = await generate();
  expect(generateMealFromPrompt).toHaveBeenCalledTimes(9);
  expect(response.body.completion).toMatchObject({ state: "failed", completed: 0 });
  expect(response.body.courses.every((course: any) => course._fallback && course.outcome === "generation_failed" &&
    course.instructions.length === 0)).toBe(true);
});
it("distinguishes duplicate exhaustion from generation and safety failures", async () => {
  jest.mocked(generateMealFromPrompt).mockResolvedValue(completeRecipe("Baked Apples") as any);
  const response = await generate();
  expect(response.body.courses.map((course: any) => course.outcome)).toEqual(["success", "duplicate_exhausted", "duplicate_exhausted"]);
  expect(response.body.completion).toMatchObject({ state: "partial", completed: 1 });
  expect(generateMealFromPrompt).toHaveBeenCalledTimes(7);
});
it.each([[], "", ["Cook using appropriate methods"]].map(instructions => ({ instructions })))("does not complete incomplete recipes: %j", async ({ instructions }) => {
  jest.mocked(generateMealFromPrompt).mockResolvedValue(completeRecipe("Baked Apples", instructions) as any);
  const response = await generate();
  expect(response.body.completion).toMatchObject({ state: "failed", completed: 0 });
  expect(response.body.courses.every((course: any) => course.outcome === "incomplete" && course.instructions.length === 0)).toBe(true);
  expect(scanGeneratedOutput).not.toHaveBeenCalled();
});
it("normalizes historical structured cookingInstructions before safety scans and response", async () => {
  let count = 0;
  jest.mocked(generateMealFromPrompt).mockImplementation(async () => ({
    ...completeRecipe(["Soup Starter", "Roasted Chicken", "Fruit Finale"][count++], undefined),
    instructions: undefined, cookingInstructions: [{ step: 1, text: "Bake until tender." }],
  }) as any);
  const response = await generate();
  expect(response.body.completion).toMatchObject({ state: "complete", completed: 3 });
  expect(response.body.courses[0].instructions).toEqual(["Bake until tender."]);
  expect(jest.mocked(scanGeneratedOutput).mock.calls[0][0].instructions).toEqual(["Bake until tender."]);
});
