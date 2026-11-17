/**
 * Execute the actual registered handler without importing server/index/routes
 * and their startup writers. All external dependencies are explicit fixtures;
 * an unexpected import fails locally. Completion itself is real.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { completeFridgeRescueChoices } from "../services/fridgeRescueChoiceCompletion";
import { getFridgeRescueReleaseStatus } from "../services/fridgeRescueHumanFoodAdapter";

jest.mock("../db", () => ({ db: {}, pool: {} }));

const source = fs.readFileSync(path.resolve("server/routes.ts"), "utf8");
const sourceFile = ts.createSourceFile("routes.ts", source, ts.ScriptTarget.Latest, true);
let registration: ts.CallExpression | undefined;
function visit(node: ts.Node) {
  if (!registration && ts.isCallExpression(node) &&
      node.expression.getText(sourceFile) === "app.post" &&
      node.arguments[0] && ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === "/api/meals/fridge-rescue") registration = node;
  ts.forEachChild(node, visit);
}
visit(sourceFile);
if (!registration) throw new Error("Active Fridge Rescue registration not found");
const handlerCode = ts.transpileModule(`${registration.getText(sourceFile)};`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const makeMeal = (name: string) => ({
  id: name, name, description: `${name} using the listed ingredients`,
  ingredients: [{ name: "chicken", quantity: "4", unit: "oz" }],
  instructions: `Cook using the ${name} method.`,
  calories: 350, protein: 30, fat: 8, carbs: 25, starchyCarbs: 20, fibrousCarbs: 5,
  cookingTime: "20 minutes", difficulty: "Easy" as const, medicalBadges: [],
});
const generate = jest.fn();
const cuisine = jest.fn(async ({ meals }) => meals.filter((meal: any) => !meal.name.startsWith("Cuisine unsafe")));
const protocol = jest.fn((meals: any[], _envelope?: unknown, _options?: unknown) =>
  meals.filter(meal => !meal.name.startsWith("Protocol unsafe")));
const glp1 = jest.fn((meal: any) => ({ isValid: !meal.name.startsWith("GLP unsafe"), violations: [] }));
const humanFood = jest.fn((meals: any[], _context?: unknown, _evidence?: unknown) => ({
  accepted: meals.filter(meal => !meal.name.startsWith("Human unsafe")),
  rejected: meals.filter(meal => meal.name.startsWith("Human unsafe")).map(meal => ({
    meal, validation: { findings: [{ code: "FIXTURE_CLINICAL_REJECTION" }] },
  })),
}));
const quota = jest.fn();
const image = jest.fn(async () => "/fixture-image.jpg");
const context = { status: "resolved", actorUserId: "fixture-a", subjectUserId: "fixture-a" };
const envelope = { userId: "fixture-a", dietaryIdentity: [], allergies: ["peanut"], avoidances: ["shellfish"], cuisinePreference: "Mexican" };
const targets = { resolvedMealCalories: 350, maximumToleratedFatGrams: 12, targetProteinGrams: 20 };
const quiet = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

async function invoke(body: Record<string, unknown> = {}, mode = "development") {
  let handler: any;
  const modules: Record<string, unknown> = {
    "./services/humanFoodContext/requestScope": { createHumanFoodRequestScope: () => ({ resolve: async () => context }) },
    "./services/humanFoodContext/buildHumanFoodPromptBlock": { buildHumanFoodPromptBlock: () => "fixture food context" },
    "./services/glp1/resolveGLP1GlobalContext": { resolveGLP1GlobalContext: async () => ({ isActive: true, resolvedTargets: targets, activationSources: ["fixture"] }) },
    "./services/fridgeRescueChoiceCompletion": { completeFridgeRescueChoices },
    "./services/fridgeRescueCuisineCompliance": { enforceFridgeRescueCuisineCompliance: cuisine },
    "./services/guardrails/index": { validateMealForDiet: glp1 },
    "./services/fridgeRescueHumanFoodAdapter": { getFridgeRescueReleaseStatus, validateFridgeRescueMealsWithHumanFood: humanFood },
    "./services/aiHealthMetrics": { recordGeneration: jest.fn() },
    "./services/mealImageGenerator": { generateMealImageUnified: image },
  };
  vm.runInNewContext(handlerCode, {
    app: { post: (_url: string, ...handlers: any[]) => { handler = handlers[handlers.length - 1]; } },
    process: { env: { NODE_ENV: mode } }, console: quiet,
    require: (id: string) => {
      if (!(id in modules)) throw new Error(`Unexpected offline import: ${id}`);
      return modules[id];
    },
    requireAuth: jest.fn(), normalizeFridgeRescue: jest.fn(),
    getAuthUserId: () => "fixture-a",
    checkAndIncrementQuota: quota, AiFeature: { FRIDGE_RESCUE: "FRIDGE_RESCUE" },
    runEnforcement: async () => ({ blocked: false, reviewRequired: false }),
    toRouteResponse: (result: unknown) => result,
    db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: "fixture-a", healthConditions: [] }] }) }) }) },
    users: { id: "id" }, eq: () => null,
    getActiveNutritionContext: async () => ({ envelope, diet: [], medical: [], builderBlock: "fixture clinical block" }),
    buildAcePromptBlock: async () => null,
    generateFridgeRescueMeals: generate,
    filterMealsByProtocol: protocol,
    buildMealComplianceBundle: () => ({ complianceSection: "fixture compliance" }),
    computeAlphaGalBadge: () => undefined,
    emitActivityEvent: jest.fn().mockResolvedValue(undefined),
  });
  const res: any = { statusCode: 200 };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (value: unknown) => { res.body = value; return res; };
  await handler({
    headers: {}, contentType: "application/json", get: () => "application/json",
    body: { fridgeItems: ["chicken"], servings: 2, ...body },
  }, res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  generate.mockReset();
  quota.mockResolvedValue({ allowed: true, remaining: 4, limit: 5, used: 1 });
});

test("the real handler replenishes rejected choices through every stage using the same request context", async () => {
  generate.mockResolvedValueOnce([makeMeal("Skillet"), makeMeal("Cuisine unsafe"), makeMeal("Protocol unsafe")])
    .mockResolvedValueOnce([makeMeal("Soup"), makeMeal("Salad")]);
  const res = await invoke({ strictMode: true, macroTargets: { protein_g: 30 } });
  expect(res.statusCode).toBe(200);
  expect(res.body.meals.map((meal: any) => meal.name)).toEqual(["Skillet", "Soup", "Salad"]);
  expect(res.body.completion).toMatchObject({ partial: false, attempts: 2 });
  expect(quota).toHaveBeenCalledTimes(1);
  expect(cuisine).toHaveBeenCalledTimes(2);
  expect(protocol).toHaveBeenCalledTimes(2);
  expect(humanFood).toHaveBeenCalledTimes(2);
  for (const [request] of generate.mock.calls) {
    expect(request).toMatchObject({ strictMode: true, servings: 2, macroTargets: { protein_g: 30 } });
    expect(request.protocolEnvelope).toBe(envelope);
    expect(request.builderBlock).toContain("fixture clinical block");
    expect(request.builderBlock).toContain("fixture food context");
  }
  expect(generate.mock.calls[1][0]).toMatchObject({ count: 2, excludedMeals: ["Skillet"] });
  for (const [request] of cuisine.mock.calls) expect(request).toMatchObject({ strictMode: true, fridgeItems: ["chicken"], cuisine: "Mexican" });
  for (const [, passedEnvelope, options] of protocol.mock.calls) {
    expect(passedEnvelope).toBe(envelope);
    expect(options).toEqual({ generatorName: "fridge_rescue", skipAdaptableConflicts: false });
  }
  for (const [, passedContext, evidence] of humanFood.mock.calls) {
    expect(passedContext).toBe(context);
    expect(evidence).toEqual({ protocolValidated: true, glp1Validated: true });
  }
  expect(glp1).toHaveBeenCalledWith(expect.objectContaining({ name: "Soup" }), "glp1", undefined, false, targets);
  expect(image).toHaveBeenCalledTimes(3);
});

test("GLP-1 and clinical rejections are never returned when retries exhaust", async () => {
  generate.mockResolvedValue([makeMeal("Skillet"), makeMeal("GLP unsafe"), makeMeal("Human unsafe")]);
  const res = await invoke();
  expect(res.statusCode).toBe(200);
  expect(res.body.meals.map((meal: any) => meal.name)).toEqual(["Skillet"]);
  expect(res.body.completion).toMatchObject({ partial: true, attempts: 3, returnedCount: 1 });
  expect(res.body.completion.reasonCodes).toEqual(expect.arrayContaining([
    "GLP1_CANDIDATES_REJECTED", "FIXTURE_CLINICAL_REJECTION", "RETRY_LIMIT_REACHED", "DUPLICATE_CANDIDATES",
  ]));
  expect(res.body.completion.message).toContain("Showing 1 of 3");
  expect(image).toHaveBeenCalledTimes(1);
});

test("a zero-survivor protocol batch can be replaced without accepting any rejected meal", async () => {
  generate.mockResolvedValueOnce([makeMeal("Protocol unsafe")])
    .mockResolvedValueOnce([makeMeal("Skillet"), makeMeal("Soup"), makeMeal("Salad")]);
  const res = await invoke();
  expect(res.statusCode).toBe(200);
  expect(res.body.meals).toHaveLength(3);
  expect(res.body.meals.every((meal: any) => !meal.name.includes("unsafe"))).toBe(true);
});

test("zero verified choices returns an explained failure, never a successful empty list", async () => {
  generate.mockResolvedValue([makeMeal("Protocol unsafe")]);
  const res = await invoke();
  expect(res.statusCode).toBe(422);
  expect(res.body.error).toBe("NO_VERIFIED_FRIDGE_CHOICES");
  expect(res.body.message).toContain("Showing 0 of 3");
  expect(res.body).not.toHaveProperty("meals");
  expect(generate).toHaveBeenCalledTimes(3);
  expect(image).not.toHaveBeenCalled();
});

test("distinct choices are enforced across replenishment batches", async () => {
  generate.mockResolvedValueOnce([makeMeal("Soup")])
    .mockResolvedValueOnce([makeMeal("SOUP"), makeMeal("Salad")])
    .mockResolvedValueOnce([makeMeal("Skillet")]);
  const res = await invoke();
  expect(res.body.meals.map((meal: any) => meal.name)).toEqual(["Soup", "Salad", "Skillet"]);
  expect(res.body.completion.attempts).toBe(3);
});

test("a failed replenishment preserves the original verified card", async () => {
  generate.mockResolvedValueOnce([makeMeal("Soup")]).mockRejectedValueOnce(new Error("offline provider unavailable"));
  const res = await invoke();
  expect(res.statusCode).toBe(200);
  expect(res.body.meals).toHaveLength(1);
  expect(res.body.completion.message).toContain("could not be completed");
});

test("Production retains one generation, existing protocol rejection, and no new completion metadata", async () => {
  generate.mockResolvedValue([makeMeal("Protocol unsafe")]);
  const failed = await invoke({}, "production");
  expect(failed.statusCode).toBe(400);
  expect(failed.body.error).toBe("PROTOCOL_VIOLATION_ALL_MEALS");
  expect(generate).toHaveBeenCalledTimes(1);
  generate.mockClear().mockResolvedValue([makeMeal("Soup")]);
  const partial = await invoke({}, "production");
  expect(partial.statusCode).toBe(200);
  expect(partial.body.meals).toHaveLength(1);
  expect(partial.body).not.toHaveProperty("completion");
  expect(generate).toHaveBeenCalledTimes(1);
});
