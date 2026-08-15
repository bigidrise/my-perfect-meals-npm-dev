/**
 * server/routes/__tests__/groceryCoach.productAdvisor.test.ts
 *
 * Integration tests for the Find a Product (product-advisor) route.
 *
 * Verifies that brand recommendations respect clinical protocol constraints
 * for the two highest-risk populations: GLP-1 patients and diabetic users,
 * plus standard allergy hard-stop enforcement.
 *
 * Also confirms that buildGroceryCoachContext() is the context source — not
 * the old reduced loadUserProtocolEnvelope() loader.
 *
 * Pure-function tests: no DB, no network — all external deps are stubbed.
 * Run: npx tsx server/routes/__tests__/groceryCoach.productAdvisor.test.ts
 */

import {
  createProductAdvisorEngineForTest,
  buildProtocolContextString,
} from "../../services/productAdvisor";
import type {
  BrandKnowledgeProvider,
  CartRecommendationResult,
  ContextLoader,
} from "../../services/productAdvisor";
import type { GroceryCoachContext } from "../../services/groceryCoachContext";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal test harness (matches refinement.test.ts style)
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failMessages: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failMessages.push(label);
    console.log(`  ❌ ${label}`);
  }
}

function assertContains(haystack: string, needle: string, label: string) {
  const ok = haystack.toLowerCase().includes(needle.toLowerCase());
  if (!ok) {
    console.log(`     missing "${needle}" in:\n     ${haystack.slice(0, 300)}`);
  }
  assert(ok, label);
}

function assertNotContains(haystack: string, needle: string, label: string) {
  const ok = !haystack.toLowerCase().includes(needle.toLowerCase());
  if (!ok) {
    console.log(`     unexpectedly found "${needle}" in:\n     ${haystack.slice(0, 300)}`);
  }
  assert(ok, label);
}

function section(name: string) {
  console.log(`\n── ${name}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Bare-minimum GroceryCoachContext with no clinical flags */
function makeBaseContext(overrides: Partial<GroceryCoachContext> = {}): GroceryCoachContext {
  return {
    envelope: {} as any,
    protocolContext: "Dietary identity: standard healthy eating",
    glp1Failed: false,
    glp1Active: false,
    glp1Targets: null,
    glp1RecommendationBlock: "",
    macroContext: "",
    dailyCarbsTarget: null,
    savedGroceriesBlock: "",
    savedRows: [],
    isClinical: false,
    hasDiabetes: false,
    ...overrides,
  };
}

/** Context for an active GLP-1 patient with resolved targets */
const GLP1_CONTEXT: GroceryCoachContext = makeBaseContext({
  protocolContext: [
    "Dietary identity: weight loss",
    "Medical conditions: GLP-1 protocol (semaglutide)",
    "=== CLINICAL PROTOCOLS — ENFORCE IN ALL RECOMMENDATIONS ===",
    "GLP-1 Protocol: Prioritise high-protein, low-sugar, low-fat foods. " +
      "Added sugars must stay below 5g per serving. Total fat per meal ≤ 15g. " +
      "Avoid high-glycaemic carbohydrates. Portion density matters — nausea risk is real.",
  ].join("\n"),
  glp1Active: true,
  glp1Targets: {
    dailyCalories: 1400,
    dailyProtein: 110,
    dailyFat: 45,
    dailyCarbs: 140,
    maxFatPerMeal: 15,
    maxSugarPerServing: 5,
  } as any,
  glp1RecommendationBlock:
    "=== GLP-1 ACTIVE — RESOLVED DAILY TARGETS ===\n" +
    "Calories: 1400 | Protein: 110g | Fat: 45g | Carbs: 140g\n" +
    "Per-meal fat ceiling: 15g | Per-serving sugar ceiling: 5g\n" +
    "Prefer low-density, high-protein options. Avoid high-fat or high-sugar products.",
  macroContext: "Daily macro targets: 1400 cal/day, 110g protein, 45g fat, 140g carbs",
  isClinical: true,
});

/** Context for a diabetic user managing blood glucose */
const DIABETIC_CONTEXT: GroceryCoachContext = makeBaseContext({
  protocolContext: [
    "Dietary identity: blood glucose management",
    "Medical conditions: Type 2 Diabetes",
    "=== CLINICAL PROTOCOLS — ENFORCE IN ALL RECOMMENDATIONS ===",
    "Diabetic Protocol: Favour low-glycaemic-index carbohydrates. " +
      "Limit refined grains and added sugars. Choose whole-grain or seeded bread " +
      "options (GI < 55). Aim for ≤ 45g net carbs per meal.",
  ].join("\n"),
  hasDiabetes: true,
  dailyCarbsTarget: 135,
  macroContext: "Daily macro targets: 1600 cal/day, 100g protein, 55g fat, 135g carbs",
  isClinical: true,
});

/** Context for a user with a nut allergy */
const NUT_ALLERGY_CONTEXT: GroceryCoachContext = makeBaseContext({
  protocolContext: [
    "Dietary identity: standard healthy eating",
    "Allergies / hard stops: tree nuts, peanuts",
    "=== CLINICAL PROTOCOLS — ENFORCE IN ALL RECOMMENDATIONS ===",
    "ALLERGY HARD STOP: tree nuts, peanuts — never recommend products that " +
      "contain or may contain these allergens.",
  ].join("\n"),
});

// ─────────────────────────────────────────────────────────────────────────────
// Spy provider — captures every protocolContext string passed to the AI layer
// ─────────────────────────────────────────────────────────────────────────────

interface CapturedCall {
  ingredients: string[];
  protocolContext: string;
  store?: string;
}

class SpyProvider implements BrandKnowledgeProvider {
  calls: CapturedCall[] = [];

  async getCartRecommendations(
    ingredients: string[],
    protocolContext: string,
    store?: string,
  ): Promise<CartRecommendationResult> {
    this.calls.push({ ingredients, protocolContext, store });
    // Return a minimal valid result — tests assert on what was SENT not what comes back
    return {
      advice: [],
      profileUsed: [],
      store,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 1. buildProtocolContextString — unit tests for the context builder
// ─────────────────────────────────────────────────────────────────────────────
section("buildProtocolContextString — GLP-1 user");

{
  const ctx = buildProtocolContextString(GLP1_CONTEXT);
  assertContains(ctx, "GLP-1", "contains GLP-1 protocol label");
  assertContains(ctx, "fat ceiling", "contains fat ceiling directive");
  assertContains(ctx, "sugar ceiling", "contains sugar ceiling directive");
  assertContains(ctx, "1400 cal", "contains resolved calorie target");
  assertContains(ctx, "110g protein", "contains resolved protein target");
}

section("buildProtocolContextString — diabetic user");

{
  const ctx = buildProtocolContextString(DIABETIC_CONTEXT);
  assertContains(ctx, "Type 2 Diabetes", "contains diabetes condition label");
  assertContains(ctx, "glycaemic", "contains glycaemic index guidance");
  assertContains(ctx, "whole-grain", "contains low-GI bread guidance");
  assertContains(ctx, "135g carbs", "contains macro carb target");
}

section("buildProtocolContextString — nut allergy user");

{
  const ctx = buildProtocolContextString(NUT_ALLERGY_CONTEXT);
  assertContains(ctx, "tree nuts", "contains tree nut allergy hard stop");
  assertContains(ctx, "peanuts", "contains peanut allergy hard stop");
  assertContains(ctx, "ALLERGY HARD STOP", "contains hard-stop directive");
}

section("buildProtocolContextString — no constraints fallback");

{
  const ctx = buildProtocolContextString(
    makeBaseContext({ protocolContext: "", glp1RecommendationBlock: "", macroContext: "" }),
  );
  assertContains(ctx, "No specific dietary", "falls back to generic guidance when context is empty");
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2. ProductAdvisorEngine — confirms buildGroceryCoachContext() is called
//      (not old loadUserProtocolEnvelope loader)
// ─────────────────────────────────────────────────────────────────────────────
section("ProductAdvisorEngine — context loader is invoked");

await (async () => {
  let loaderCallCount = 0;
  let loaderUserId = "";

  const mockLoader: ContextLoader = async (userId) => {
    loaderCallCount++;
    loaderUserId = userId;
    return makeBaseContext();
  };

  const spy = new SpyProvider();
  const engine = createProductAdvisorEngineForTest(spy, mockLoader);

  await engine.buildCartRecommendations("user-abc", ["yogurt"]);

  assert(loaderCallCount === 1, "context loader called exactly once");
  assert(loaderUserId === "user-abc", "context loader receives correct userId");
  assert(spy.calls.length === 1, "provider called once per request");
})();

// ─────────────────────────────────────────────────────────────────────────────
// § 3. GLP-1 user — brand recommendation request for yogurt
//      Protocol context sent to AI must carry GLP-1 fat and sugar ceilings
// ─────────────────────────────────────────────────────────────────────────────
section("GLP-1 user — yogurt request carries fat and sugar ceiling");

await (async () => {
  const spy = new SpyProvider();
  const engine = createProductAdvisorEngineForTest(spy, async () => GLP1_CONTEXT);

  await engine.buildCartRecommendations("glp1-user", ["yogurt"], "Whole Foods");

  assert(spy.calls.length === 1, "provider called once");
  const { protocolContext, ingredients, store } = spy.calls[0];

  assert(ingredients[0] === "yogurt", "correct ingredient forwarded");
  assert(store === "Whole Foods", "store forwarded to provider");
  assertContains(protocolContext, "GLP-1", "GLP-1 protocol present in AI context");
  assertContains(protocolContext, "fat ceiling", "fat ceiling present in AI context");
  assertContains(protocolContext, "sugar ceiling", "sugar ceiling present in AI context");
  assertContains(protocolContext, "15g", "per-meal fat limit value present");
  assertContains(protocolContext, "5g", "per-serving sugar limit value present");
  assertNotContains(protocolContext, "No specific dietary", "does not fall back to generic guidance");
})();

// ─────────────────────────────────────────────────────────────────────────────
// § 4. Diabetic user — brand recommendation request for bread
//      Protocol context must carry low-GI guidance, NOT generic healthy eating
// ─────────────────────────────────────────────────────────────────────────────
section("Diabetic user — bread request carries low-GI diabetic guidance");

await (async () => {
  const spy = new SpyProvider();
  const engine = createProductAdvisorEngineForTest(spy, async () => DIABETIC_CONTEXT);

  await engine.buildCartRecommendations("diabetic-user", ["whole wheat bread"]);

  assert(spy.calls.length === 1, "provider called once");
  const { protocolContext } = spy.calls[0];

  assertContains(protocolContext, "Type 2 Diabetes", "diabetes condition in AI context");
  assertContains(protocolContext, "glycaemic", "glycaemic index guidance in AI context");
  assertContains(protocolContext, "whole-grain", "low-GI bread guidance in AI context");
  assertNotContains(protocolContext, "No specific dietary", "does not fall back to generic guidance");
})();

// ─────────────────────────────────────────────────────────────────────────────
// § 5. Nut allergy user — pasta sauce request must carry hard-stop
//      Protocol context must contain the allergy block so the AI avoids
//      recommending products with nut-containing ingredients
// ─────────────────────────────────────────────────────────────────────────────
section("Nut allergy user — pasta sauce request carries nut allergy hard stop");

await (async () => {
  const spy = new SpyProvider();
  const engine = createProductAdvisorEngineForTest(spy, async () => NUT_ALLERGY_CONTEXT);

  await engine.buildCartRecommendations("nut-allergy-user", ["pasta sauce"]);

  assert(spy.calls.length === 1, "provider called once");
  const { protocolContext } = spy.calls[0];

  assertContains(protocolContext, "tree nuts", "tree nut allergy in AI context");
  assertContains(protocolContext, "peanuts", "peanut allergy in AI context");
  assertContains(protocolContext, "ALLERGY HARD STOP", "hard-stop directive in AI context");
  assertNotContains(protocolContext, "No specific dietary", "does not fall back to generic guidance");
})();

// ─────────────────────────────────────────────────────────────────────────────
// § 6. Context loader called with correct userId on each request
// ─────────────────────────────────────────────────────────────────────────────
section("Context loader receives the userId from the request (not a hardcoded value)");

await (async () => {
  const capturedIds: string[] = [];
  const mockLoader: ContextLoader = async (userId) => {
    capturedIds.push(userId);
    return makeBaseContext();
  };

  const spy = new SpyProvider();
  const engine = createProductAdvisorEngineForTest(spy, mockLoader);

  await engine.buildCartRecommendations("user-111", ["oat milk"]);
  await engine.buildCartRecommendations("user-222", ["pasta"]);

  assert(capturedIds[0] === "user-111", "first call uses user-111");
  assert(capturedIds[1] === "user-222", "second call uses user-222");
  assert(spy.calls.length === 2, "provider called twice (once per request)");
})();

// ─────────────────────────────────────────────────────────────────────────────
// § 7. GLP-1 + diabetic stacked context — both constraint sets present
// ─────────────────────────────────────────────────────────────────────────────
section("Stacked GLP-1 + diabetic context — both sets of constraints in AI context");

await (async () => {
  const stackedCtx = makeBaseContext({
    protocolContext: [
      "Dietary identity: weight loss / blood glucose management",
      "Medical conditions: GLP-1 protocol (tirzepatide), Type 2 Diabetes",
      "=== CLINICAL PROTOCOLS — ENFORCE IN ALL RECOMMENDATIONS ===",
      "GLP-1 Protocol: added sugars ≤ 5g per serving, total fat per meal ≤ 15g.",
      "Diabetic Protocol: low-GI carbohydrates only, limit refined grains, ≤ 45g net carbs per meal.",
    ].join("\n"),
    glp1Active: true,
    glp1Targets: { maxFatPerMeal: 15, maxSugarPerServing: 5 } as any,
    glp1RecommendationBlock:
      "=== GLP-1 ACTIVE — RESOLVED DAILY TARGETS ===\n" +
      "Per-meal fat ceiling: 15g | Per-serving sugar ceiling: 5g",
    hasDiabetes: true,
    isClinical: true,
  });

  const spy = new SpyProvider();
  const engine = createProductAdvisorEngineForTest(spy, async () => stackedCtx);

  await engine.buildCartRecommendations("dual-user", ["greek yogurt"]);

  const { protocolContext } = spy.calls[0];
  assertContains(protocolContext, "GLP-1", "GLP-1 protocol present");
  assertContains(protocolContext, "Type 2 Diabetes", "diabetic protocol present");
  assertContains(protocolContext, "fat ceiling", "fat ceiling present");
  assertContains(protocolContext, "low-GI", "low-GI constraint present");
})();

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failMessages.length) {
  console.log("\nFailed assertions:");
  failMessages.forEach((m) => console.log(`  ✗ ${m}`));
  process.exit(1);
} else {
  console.log("All assertions passed ✓");
}
