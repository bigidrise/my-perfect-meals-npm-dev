import express from "express";
import request from "supertest";
import router from "../routes/gatherings";
import { generateMealFromPrompt } from "../services/universalMealGenerator";
import { parseUniversalRecipeResponse } from "../services/universalRecipeContract";
import { SAFE_RECIPE_FAILURE, SafeRecipeGenerationError } from "../../shared/recipeDraftSafety";
import { scanGeneratedOutput, loadGenerationProtocolEnvelope } from "../services/protocolEnvelope";
import { calculateGatheringsNutrition } from "../services/gatheringsNutrition";
import { generateMealImageUnified } from "../services/mealImageGenerator";

const mockCompletion = jest.fn();
jest.mock("openai", () => ({
  __esModule: true, default: jest.fn(() => ({
    chat: { completions: { create: (...args: unknown[]) => mockCompletion(...args) } },
  })),
}));
jest.mock("../services/protocolEnvelope", () => ({
  loadGenerationProtocolEnvelope: jest.fn(async () => ({
    dietaryIdentity: ["kosher"], allergies: ["nuts"], medicalHardLimits: [],
  })),
  enforceBeforeGenerate: () => ({ combined: "INTERNAL_PROMPT_SENTINEL PROFILE_DATA_SENTINEL" }),
  scanGeneratedOutput: jest.fn(() => ({ passed: true })),
}));
jest.mock("../services/gatheringsNutrition", () => ({
  gatheringsNutritionEnabled: () => true,
  createGatheringsLookup: () => ({ lookup: jest.fn(), metrics: {} }),
  calculateGatheringsNutrition: jest.fn(async () => ({
    nutritionResult: { version: "ingredient-recipe-v2", status: "needs_review", servings: 6,
      basis: "whole_recipe", reasons: ["source_missing"], sources: [], assumptions: [] },
  })),
}));
jest.mock("../services/wholeFoodStandard", () => ({
  appendWholeFoodStandardPrompt: (text: string) => text,
  evaluateWholeFoodCandidate: () => ({ shouldBlock: false }),
}));
jest.mock("../services/mealImageGenerator", () => ({ generateMealImageUnified: jest.fn(async () => null) }));
jest.mock("../services/allergyGuardrails", () => ({
  buildDietPromptBlock: () => "", violatesDietaryConstraints: () => ({ violates: false, reasons: [] }),
  AVOIDANCE_EXPANSION: {},
}));
jest.mock("../services/guardrails/promptPolicyGate", () => ({ getBaselineMacroPrompt: () => "" }));

const PRIVATE = "INTERNAL_PROMPT_SENTINEL PROFILE_DATA_SENTINEL";
const valid = "Meal Name: Baked Apples\nDescription: Apples baked until tender.\nIngredients:\n- 6 oz apples\nInstructions:\n1. Bake the apples until tender.\nNutrition:\nCalories: 120\nProtein: 1g\nCarbs: 28g\nFat: 1g";
const invalidCases = [
  ["missing name", valid.replace("Meal Name: Baked Apples\n", "")],
  ["missing description", valid.replace("Description: Apples baked until tender.\n", "")],
  ["refusal", `I'm sorry, I cannot provide that meal. ${PRIVATE}`],
  ["empty ingredients", valid.replace("- 6 oz apples\n", "")],
  ["invalid ingredient", valid.replace("- 6 oz apples", "- 123")],
  ["missing food identity", valid.replace("- 6 oz apples", "- 6 oz")],
  ["placeholder ingredient", valid.replace("- 6 oz apples", "- [ingredient]")],
  ["missing instructions", valid.replace("1. Bake the apples until tender.\n", "")],
  ["JSON", JSON.stringify({ name: "Baked Apples", description: PRIVATE })],
  ["placeholder name", valid.replace("Meal Name: Baked Apples", "Meal Name: [name]")],
  ["unexpected sections", valid.replace("Ingredients:", "Ingredients: []")],
  ["duplicate fields", `Meal Name: ${PRIVATE}\n${valid}`],
  ["structured refusal", valid.replace("Baked Apples", "I cannot provide that recipe")],
  ["echoed internal block", valid.replace("Apples baked until tender.", `Recipe.\nCOURSE POSITION: ${PRIVATE}`)],
] as const;
const app = express();
app.use(express.json());
app.use((req, _res, next) => { (req as any).authUser = { id: "synthetic-account" }; next(); });
app.use("/api/gatherings", router);
let logs: jest.SpyInstance[];
beforeEach(() => {
  mockCompletion.mockReset();
  mockCompletion.mockResolvedValue({ choices: [{ message: { content: valid } }] });
  jest.mocked(scanGeneratedOutput).mockReturnValue({ passed: true } as any);
  logs = ["log", "warn", "error"].map(method => jest.spyOn(console, method as "log").mockImplementation(() => {}));
});
afterEach(() => { logs.forEach(spy => spy.mockRestore()); });
const safe = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  expect(text).not.toContain("INTERNAL_PROMPT_SENTINEL");
  expect(text).not.toContain("PROFILE_DATA_SENTINEL");
};
const generate = () => request(app).post("/api/gatherings/generate").send({
  situation: "holiday", eventType: "christmas", totalCourses: 3, servingSize: 6, notes: PRIVATE,
});

it.each(invalidCases)("rejects %s before a draft or image can be returned", async (_label, text) => {
  mockCompletion.mockResolvedValue({ choices: [{ message: { content: text } }] });
  const error = await generateMealFromPrompt(PRIVATE, "dinner", { skipImage: true }).catch(error => error);
  expect(error).toBeInstanceOf(SafeRecipeGenerationError);
  expect(error.message).toBe(SAFE_RECIPE_FAILURE);
  safe(error.message);
  safe(logs.flatMap(spy => spy.mock.calls));
  expect(generateMealImageUnified).not.toHaveBeenCalled();
});

it.each(invalidCases)("exhausts retries safely for %s", async (_label, text) => {
  mockCompletion.mockResolvedValue({ choices: [{ message: { content: text } }] });
  const response = await generate();
  expect(response.status).toBe(200); // existing endpoint/partial-result contract
  expect(response.body.courses).toHaveLength(3);
  expect(response.body.courses.every((course: any) =>
    course._fallback === true && course.description === SAFE_RECIPE_FAILURE &&
    course.ingredients.length === 0 && !course.nutrition)).toBe(true);
  expect(mockCompletion).toHaveBeenCalledTimes(9);
  expect(scanGeneratedOutput).not.toHaveBeenCalled();
  expect(calculateGatheringsNutrition).not.toHaveBeenCalled();
  safe(response.text);
  safe(logs.flatMap(spy => spy.mock.calls));
});

it.each([null, {}, { choices: [] }, { choices: [{ message: { refusal: PRIVATE, content: valid } }] }])(
  "rejects empty/provider-refusal envelopes safely", async envelope => {
    mockCompletion.mockResolvedValue(envelope);
    await expect(generateMealFromPrompt(PRIVATE, "dinner", { skipImage: true }))
      .rejects.toThrow(SAFE_RECIPE_FAILURE);
    safe(logs.flatMap(spy => spy.mock.calls));
  },
);

it("never exposes raw provider error messages or attached responses", async () => {
  mockCompletion.mockRejectedValue(Object.assign(new Error(PRIVATE), { status: 429, response: { data: PRIVATE } }));
  const response = await generate();
  safe(response.text);
  safe(logs.flatMap(spy => spy.mock.calls));
  expect(response.body.courses.every((course: any) => course._fallback)).toBe(true);
});

it.each(["dinner", "snack"] as const)("preserves valid non-Gatherings %s recipe contracts", async type => {
  const meal = await generateMealFromPrompt("Baked apples", type, { skipImage: true });
  expect(meal).toMatchObject({
    name: "Baked Apples", description: "Apples baked until tender.", mealType: type,
    ingredients: [{ name: "apples", amount: 6, unit: "oz" }],
    instructions: ["Bake the apples until tender."],
    nutrition: { calories: 120, protein: 1, carbs: 28, fat: 1 },
    medicalBadges: [], flags: ["ai_generated"], servingSize: "1 serving",
  });
});

it("preserves optional images and absent-nutrition legacy defaults for valid drafts", async () => {
  mockCompletion.mockResolvedValue({ choices: [{ message: { content: valid.split("\nNutrition:")[0] } }] });
  const meal = await generateMealFromPrompt("Baked apples", "dinner");
  expect(meal.nutrition).toEqual({ calories: 400, protein: 25, carbs: 30, fat: 15 });
  expect(generateMealImageUnified).toHaveBeenCalledTimes(1);
});

it("keeps valid Gatherings drafts free of AI/default macros", async () => {
  const meal = await generateMealFromPrompt("six servings", "dinner", { skipImage: true }, { gatheringsIngredientNutrition: true });
  expect(meal).not.toHaveProperty("nutrition");
  expect(meal.ingredients[0]).toMatchObject({ name: "apples", amount: 6, unit: "oz" });
});

it("preserves previously accepted ingredient subheadings and wrapped instruction formatting", async () => {
  const text = valid.replace("Ingredients:\n", "Ingredients:\nFor the apples:\n")
    .replace("1. Bake the apples until tender.", "1. Bake the apples until tender.\nPreparation note.");
  mockCompletion.mockResolvedValue({ choices: [{ message: { content: text } }] });
  const meal = await generateMealFromPrompt("Baked apples", "dinner", { skipImage: true });
  expect(meal.ingredients[0].name).toBe("apples");
  expect(meal.instructions).toEqual(["Bake the apples until tender."]);
});

it("retains protocol rejection and redacts its diagnostic message", async () => {
  jest.mocked(scanGeneratedOutput).mockReturnValue({ passed: false, message: PRIVATE } as any);
  const response = await generate();
  expect(scanGeneratedOutput).toHaveBeenCalledTimes(9);
  expect(calculateGatheringsNutrition).not.toHaveBeenCalled();
  expect(response.body.courses.every((course: any) => course._fallback)).toBe(true);
  safe(response.text);
  safe(logs.flatMap(spy => spy.mock.calls));
});

it("preserves clinical withholding rather than releasing a nutrition-unverified recipe", async () => {
  jest.mocked(loadGenerationProtocolEnvelope).mockResolvedValueOnce({
    dietaryIdentity: [], allergies: [], medicalHardLimits: ["synthetic-clinical-limit"],
  } as any);
  const response = await generate();
  expect(response.body.courses.every((course: any) =>
    course._fallback && course.instructions.length === 0 &&
    course.description.includes("reliable nutrition") && !course.nutrition)).toBe(true);
});

it("does not manufacture instructions or accept a duplicate recipe block", () => {
  expect(() => parseUniversalRecipeResponse(valid.replace("1. Bake the apples until tender.", "")))
    .toThrow(SAFE_RECIPE_FAILURE);
  expect(() => parseUniversalRecipeResponse(`${valid}\n${valid}`)).toThrow(SAFE_RECIPE_FAILURE);
});

it("retains hash/category diagnostics without output previews in full-debug mode", () => {
  const previous = process.env.AI_DEBUG;
  process.env.AI_DEBUG = "true";
  try {
    jest.isolateModules(() => {
      const telemetry = require("../services/aiTelemetry");
      const session = telemetry.createSession("universalMealGenerator");
      telemetry.logRawOutput(session, PRIVATE, { model: "gpt-4o", suppressContent: true });
      telemetry.tagFallback(session, "parse_failed", "missing_description");
      telemetry.closeSession(session);
    });
    safe(logs.flatMap(spy => spy.mock.calls));
    expect(JSON.stringify(logs.flatMap(spy => spy.mock.calls))).toContain("missing_description");
  } finally {
    if (previous === undefined) delete process.env.AI_DEBUG;
    else process.env.AI_DEBUG = previous;
  }
});
