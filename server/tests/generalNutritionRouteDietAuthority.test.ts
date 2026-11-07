import express from "express";
import request from "supertest";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { resolveRequestDietOverride } from "../services/humanFoodContext/requestDiet";

// Execute the actual registered HTTP callback from routes.ts. Never import the
// production router: its unrelated boot paths can access the shared database.
// All reachable dynamic imports have explicit offline test implementations.
const source = ts.createSourceFile("routes.ts", readFileSync("server/routes.ts", "utf8"),
  ts.ScriptTarget.Latest, true);
let registration: ts.CallExpression | undefined;
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "app.post" &&
      node.arguments[0]?.getText(source) === '"/api/meals/generate"') registration = node;
  if (!registration) ts.forEachChild(node, visit);
}
visit(source);
if (!registration || !ts.isArrowFunction(registration.arguments[3] ?? registration.arguments[2])) {
  throw new Error("Real unified meal-generation HTTP handler not found");
}
const callback = registration.arguments[3] ?? registration.arguments[2];
const compiled = ts.transpileModule(`module.exports = (${callback.getText(source)});`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture(savedDiet: string[], options: {
  currentGlp1?: boolean; historicalShots?: boolean; antiInflammatory?: boolean;
} = {}) {
  const actorId = "synthetic-person";
  const envelope = {
    dietaryIdentity: savedDiet, allergies: ["peanut"], avoidances: ["quinoa"],
    medicalHardLimits: ["clinical-rule"], personalAntiInflammatorySupport: options.antiInflammatory === true,
  };
  const scopes: any[] = [];
  const enforced = jest.fn(async () => ({ result: "ALLOWED" }));
  const generated = jest.fn(async () => ({ success: false, source: "error", error: "Synthetic stop before food persistence" }));
  const glp = jest.fn(async () => ({
    isActive: options.currentGlp1 === true,
    activationSources: options.currentGlp1 ? ["memberReportedMedication"] : [],
    resolvedTargets: options.currentGlp1 ? {
      resolvedMealCalories: 350, maximumToleratedFatGrams: 12,
      targetProteinGrams: 25, treatmentPhase: "active",
    } : null,
  }));
  const modules: Record<string, unknown> = {
    "./services/humanFoodContext/requestScope": {
      createHumanFoodRequestScope: (args: any) => {
        scopes.push(args);
        return {
          resolve: async () => ({
            status: "resolved", notices: [],
            diet: { effective: args.dietOverride ? [args.dietOverride] : savedDiet },
            safety: { allergies: envelope.allergies, avoidedFoods: envelope.avoidances },
          }),
          executionState: {},
          completeAuthorization: jest.fn(() => { throw new Error("No saves permitted"); }),
          releaseAuthorization: jest.fn(),
        };
      },
    },
    "./services/humanFoodContext/adapters": { buildCreatorHumanFoodPrompt: (_: unknown, ctx: any) =>
      `Authoritative diet: ${ctx.diet.effective.join(",")}` },
    "./services/humanFoodContext/requestDiet": { resolveRequestDietOverride },
    "./services/unifiedMealPipeline": { generateMealUnified: generated },
    "./services/aiHealthMetrics": { recordGeneration: jest.fn() },
    "./services/chefBudgetService": { resolveChefBudget: jest.fn(async () => ({
      remainingMacros: null, generationContext: "standard",
      starchAllowed: 2, gramsPerRemainingStarchMeal: 30,
    })) },
    "./services/glp1/resolveGLP1GlobalContext": { resolveGLP1GlobalContext: glp },
    "./services/protocolEnvelope": { loadUserProtocolEnvelope: async () => envelope },
    "./services/requestedMealMacros": { extractRequestedMealMacroTargets: () => undefined },
  };
  const accessed: string[] = [];
  const context: any = {
    module: { exports: {} },
    require: (path: string) => {
      accessed.push(path);
      if (!Object.prototype.hasOwnProperty.call(modules, path)) {
        throw new Error(`Unexpected external import: ${path}`);
      }
      return modules[path];
    },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Date, setTimeout, clearTimeout,
    runEnforcement: enforced,
    toRouteResponse: () => ({ blocked: false, reviewRequired: false }),
    AiFeature: { FRIDGE_RESCUE: "not-used" },
  };
  vm.runInNewContext(compiled, context, { timeout: 1500 });
  const app = express();
  app.use(express.json());
  app.post("/api/meals/generate", (req, _res, next) => {
    (req as any).authUser = { id: actorId };
    (req as any).id = "synthetic-request";
    next();
  }, context.module.exports);

  async function submit(body: Record<string, unknown> = {}) {
    const response = await request(app).post("/api/meals/generate").send({
      type: "create-with-chef", dietType: "general-nutrition",
      mealType: "lunch", input: "Vegetable soup", strictMode: true, skipImage: true,
      ...body,
    });
    if (response.status !== 200 || response.body.error !== "Synthetic stop before food persistence") {
      throw new Error(`Route fixture failed: ${response.status} ${JSON.stringify(response.body)}; imports=${accessed.join(",")}`);
    }
    expect(generated).toHaveBeenCalledTimes(1);
    return { sent: generated.mock.calls[0][0] as any, scopes, enforced, glp, envelope, response };
  }
  return { submit };
}

describe("real meal-generation HTTP callback: General Nutrition authority", () => {
  it.each(["vegan", "vegetarian", "pescatarian"])(
    "keeps saved %s dietary restrictions and the allergy/clinical envelope",
    async diet => {
      const { sent, scopes, enforced } = await fixture([diet], { historicalShots: true }).submit();
      expect(scopes[0].dietOverride).toBeNull();
      expect(sent.dietType).toBe("general-nutrition");
      expect(sent.dietaryRestrictionsOverride).toEqual([diet]);
      expect(sent.generationContext).toContain(`Authoritative diet: ${diet}`);
      expect(enforced).toHaveBeenCalledWith(expect.objectContaining({
        userId: "synthetic-person", phase: "pre_generation", safetyMode: "STRICT",
      }));
      expect(sent.userId).toBe("synthetic-person");
      expect(sent.glp1Targets).toBeUndefined();
      expect(sent.overriddenAllergens).toBeUndefined();
    },
  );

  it("preserves all saved dietary tags without fabricating a primary diet", async () => {
    const { sent } = await fixture(["vegan", "dairy-free"]).submit();
    expect(sent.dietaryRestrictionsOverride).toEqual(["vegan", "dairy-free"]);
  });

  it("keeps an explicitly selected one-action diet override", async () => {
    const { sent, scopes } = await fixture(["vegan"]).submit({ dietOverride: "vegetarian" });
    expect(scopes[0].dietOverride).toBe("vegetarian");
    expect(sent.dietaryRestrictionsOverride).toEqual(["vegetarian"]);
  });

  it("keeps optional Anti-Inflammatory source independent of General Nutrition", async () => {
    const { sent, envelope } = await fixture(["vegetarian"], { antiInflammatory: true }).submit();
    expect(envelope.personalAntiInflammatorySupport).toBe(true);
    expect(sent.dietaryRestrictionsOverride).toEqual(["vegetarian"]);
    // Final optional verification is applied by generateMealUnified using its
    // authorized envelope; the fixture stops before invoking paid generation.
    expect(sent.userId).toBe("synthetic-person");
  });

  it("keeps legitimate current GLP-1 guidance and the saved diet together", async () => {
    const { sent, glp } = await fixture(["pescatarian"], { currentGlp1: true }).submit();
    expect(glp).toHaveBeenCalledWith("synthetic-person", expect.any(String), "lunch");
    expect(sent.dietType).toBe("glp1");
    expect(sent.glp1Targets.maximumToleratedFatGrams).toBe(12);
    expect(sent.dietaryRestrictionsOverride).toEqual(["pescatarian"]);
  });

  it("does not activate GLP-1 merely from historical injection records", async () => {
    const { sent } = await fixture(["vegan"], { historicalShots: true }).submit();
    expect(sent.dietType).toBe("general-nutrition");
    expect(sent.glp1Targets).toBeUndefined();
    expect(sent.dietaryRestrictionsOverride).toEqual(["vegan"]);
  });

  it("does not change the explicitly selected GLP-1 Builder path", async () => {
    const { sent } = await fixture([], { currentGlp1: true }).submit({ dietType: "glp1" });
    expect(sent.dietType).toBe("glp1");
    expect(sent.glp1Targets).toBeDefined();
  });
});
