import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { buildCravingCategoryPrompt } from "../../../shared/cravingCategories";

// No routes/index/db/provider imports. Execute the unchanged source expression,
// not a hand-written handler. Every dynamic import is confined to this allowlist.
const routeText = readFileSync("server/routes.ts", "utf8");
const routeAst = ts.createSourceFile("routes.ts", routeText, ts.ScriptTarget.Latest, true);
const pageText = readFileSync("client/src/pages/craving-creator.tsx", "utf8");
const pageAst = ts.createSourceFile("page.tsx", pageText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findNode(root: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node {
  let found: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (!found && predicate(node)) found = node;
    if (!found) ts.forEachChild(node, visit);
  }
  visit(root);
  if (!found) throw new Error("Saved source contract not found");
  return found;
}

function initializer(name: string, root: ts.Node = routeAst): string {
  const node = findNode(root, n =>
    ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name,
  ) as ts.VariableDeclaration;
  if (!node.initializer) throw new Error(`No initializer: ${name}`);
  return node.initializer.getText(root.getSourceFile());
}

function compile(source: string) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

export function clientPayload(values: Record<string, unknown> = {}) {
  const call = findNode(pageAst, n =>
    ts.isCallExpression(n) && n.expression.getText(pageAst) === "JSON.stringify" &&
    n.arguments[0]?.getText(pageAst).includes("cravingCategory: cravingCategory"),
  ) as ts.CallExpression;
  const context = {
    submittedCravingInput: "chicken bowl", cravingCategory: "",
    dietOverrideEnabled: false, dietOverrideValue: "", dietaryRestrictions: "dairy-free",
    servings: 3, sweetenerPreferences: [], hasActiveOverride: false, overrideToken: undefined,
    flavorPersonal: true, getRecentMeals: () => [], keepItSimple: false,
    dietAdaptOverride: false, userDietOverride: false, cookMethod: "air-fryer",
    cuisineOverrideEnabled: true, cuisineOverrideValue: "Thai", ...values,
  };
  return JSON.parse(vm.runInNewContext(call.getText(pageAst), context, { timeout: 1000 }));
}

export function isolatedCravingHarness(savedRouteSource?: string) {
  const selectedAst = savedRouteSource
    ? ts.createSourceFile("baseline-routes.ts", savedRouteSource, ts.ScriptTarget.Latest, true)
    : routeAst;
  const handlerDeclaration = findNode(selectedAst, n =>
    ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === "cravingCreatorHandler",
  ) as ts.VariableDeclaration;
  const envelope: any = {
    dietaryIdentity: ["vegan"], allergies: ["shellfish", "dairy"],
    avoidances: [], procedural: [], hasDiabetes: false,
  };
  const context: any = {
    status: "resolved", notices: [], diet: { effective: ["vegan"] },
    safety: { avoidedFoods: [] }, internalFingerprint: "synthetic-fixture",
  };
  const generate = jest.fn(async (..._args: any[]) => []);
  const safety = jest.fn(async (..._args: any[]) => ({ result: "ALLOWED" }));
  const resolveScope = jest.fn(async () => context);
  const scope = jest.fn((input: any) => {
    context.diet.effective = input.dietOverride ? [input.dietOverride] : ["vegan"];
    return { resolve: resolveScope, executionState: {} };
  });
  const glp = jest.fn(async (..._args: any[]) => ({ isActive: false }));
  const allergenPrompt = jest.fn((allergies: string[]) => `[AVOID: ${allergies.join(",")}]`);
  const imports: string[] = [];
  const denied: string[] = [];
  const logs: any[][] = [];
  const errors: any[][] = [];
  const modules: Record<string, any> = {
    "./services/oneTouch/internalRequest": { getOneTouchDiet: () => undefined },
    "./services/oneTouch/dietAuthority": {
      withOneTouchDiet: (value: any) => value, mutableProfileStyles: () => ["vegan"],
    },
    "./services/humanFoodContext/requestScope": { createHumanFoodRequestScope: scope },
    "./services/humanFoodContext/adapters": { buildCreatorHumanFoodPrompt: () => "[SYNTHETIC CONTEXT]" },
    "./services/humanFoodContext/requestExecutionState": {
      recordRejectedHumanFoodCandidate: jest.fn(), buildRejectedCandidatePrompt: () => "",
    },
    "./services/glp1/resolveGLP1GlobalContext": { resolveGLP1GlobalContext: glp },
    "./services/unifiedMealPipeline": {
      generateCravingMealOptions: generate,
      generateSingleCompliantFallback: () => { throw new Error("Unexpected fallback"); },
    },
    "./services/dishAdaptation/dishAdaptationLayer": {
      getDishAdaptationDirective: async () => null, buildGuardrailContext: (input: any) => input,
    },
    "./services/allergyGuardrails": { buildAllergenAdaptPromptBlock: allergenPrompt },
  };
  const chain: any = {
    from: () => chain, where: () => chain,
    limit: async () => [{ id: "synthetic-user", dietaryRestrictions: ["vegan"], healthConditions: [] }],
  };
  const sandbox: any = {
    module: { exports: {} },
    process: { env: { NODE_ENV: "test" } },
    console: {
      log: (...args: any[]) => logs.push(args), warn: (...args: any[]) => logs.push(args),
      error: (...args: any[]) => errors.push(args),
    },
    require: (name: string) => {
      imports.push(name);
      if (!Object.prototype.hasOwnProperty.call(modules, name)) {
        denied.push(name);
        throw new Error(`ISOLATION: module denied: ${name}`);
      }
      return modules[name];
    },
    fetch: () => { throw new Error("ISOLATION: network denied"); },
    buildCravingCategoryPrompt,
    loadUserProtocolEnvelope: async () => envelope,
    buildGuestEnvelope: () => { throw new Error("Unexpected guest fallback"); },
    enforceSafetyProfile: safety,
    db: { select: jest.fn(() => chain) },
    users: { id: "synthetic-column" }, eq: () => "synthetic-predicate",
  };
  const registered = new Map<string, any>();
  sandbox.app = { post: (path: string, handler: any) => registered.set(path, handler) };
  const registration = findNode(selectedAst, n =>
    ts.isCallExpression(n) && n.expression.getText(selectedAst) === "app.post" &&
    ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === "/api/meals/craving-creator",
  );
  vm.runInNewContext(compile(
    `const cravingCreatorHandler = ${initializer("cravingCreatorHandler", selectedAst)};\n${registration.getText(selectedAst)};`,
  ), sandbox, { timeout: 1000 });

  async function request(body: any, authenticated = true) {
    const res: any = {
      statusCode: 200, body: undefined,
      status(code: number) { this.statusCode = code; return this; },
      json(value: any) { this.body = value; return this; },
    };
    await registered.get("/api/meals/craving-creator")({
      body, session: authenticated ? { userId: "synthetic-user" } : {},
      headers: {}, id: "synthetic-correlation",
    }, res);
    if (denied.length) throw new Error(`Unexpected imports: ${denied.join(", ")}`);
    const unexpectedErrors = errors.filter(e => String(e[0]).includes("Craving creator error:"));
    if (unexpectedErrors.length) throw new Error(`Unexpected route error: ${unexpectedErrors.map(e => String(e[1])).join("; ")}`);
    return res;
  }

  // Exercise the original formatter separately; generation intentionally stops
  // at the empty fixture result, before final validation/image/persistence work.
  function format(meal: any, servings: any) {
    const nutrition = jest.fn((_meal: any, count: number) => ({ fixtureServingCount: count }));
    const local: any = {
      module: { exports: {} }, servings,
      formatCreatorNutrition: nutrition,
      buildMealComplianceBundle: () => ({ complianceSection: "", dietClassification: "" }),
      protocolEnvelope: envelope, dietAdapted: false, user: {},
      computeAlphaGalBadge: () => null, scaleIngredientQuantity: (q: any, n: number) => Number(q) * n,
    };
    vm.runInNewContext(compile(
      `const validatedServings = ${initializer("validatedServings", handlerDeclaration)}; module.exports = ${initializer("formatCreatorOption", handlerDeclaration)};`,
    ), local, { timeout: 1000 });
    return { meal: local.module.exports(meal), nutrition };
  }
  return { request, generate, scope, context, envelope, safety, glp, allergenPrompt, logs, format };
}
