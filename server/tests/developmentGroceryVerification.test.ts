jest.mock("../services/protocolEnvelope", () => ({
  scanGeneratedOutput: jest.fn(() => ({ passed: true })),
}));
import { scanGeneratedOutput } from "../services/protocolEnvelope";
import { verifiedGroceryCatalog, verifyDevelopmentScanResult, developmentGroceryVerificationEnabled } from "../services/productDiscovery/developmentGroceryVerification";
import { projectCurrentShoppingAssessments, productProfileReference, currentShoppingAssessments } from "../services/productDiscovery/productProfileAssessment";
import { DEVELOPMENT_CATALOG_IDENTITY_POLICY } from "../services/productDiscovery/ruleEvidenceRegistry";
import { evaluateProductCandidate } from "../services/productDiscovery/evaluateProductCandidate";
import { shoppingRejectionExplanation } from "../services/productDiscovery/shoppingRejectionExplanation";
import { makeIngredientMetadata } from "../../shared/shoppingIngredientMetadata";
import type { ProductSubjectSnapshot } from "../services/productDiscovery/subjectAuthority";
import type { IngredientScanResult } from "../services/ingredientScanService";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const subject = (): ProductSubjectSnapshot => ({
  actorUserId: "synthetic", subjectId: "synthetic", subjectKind: "account",
  dateISO: "2026-11-21", status: "resolved", issues: [], fingerprint: "request-1",
  protocolStateReference: "current-authorized-protocol",
  dietaryIdentity: [], allergies: [], explicitAvoidances: [], dislikes: [], preferences: [],
  profileFactors: [], medicalHardLimitNames: [], medicalOptimizationNames: [],
  glp1Active: false, alphaGalActive: false, pregnancyActive: false,
  providerInterventionKeys: [], dailyNutritionAvailable: true,
  clinicalDirectiveAuthority: "shadow_only_not_effective_for_food",
});
const product = (eligible = false) => ({
  productKey: "synthetic-product", name: "Olive Oil", brand: "Alpha",
  shoppingDisplay: eligible ? "selectable" : "label_review",
  shoppingSelection: eligible ? { eligible: true } : { eligible: false },
  shoppingReference: eligible ? undefined : { historical: "synthetic reference" },
  evidenceStatus: eligible ? "eligible" : "needs_verification",
  needsProfileReview: false, policyUnresolved: !eligible,
  ingredients: "Olive oil", source: "USDA FoodData Central",
  nutrition: [{ statement: "Fat 14g per 14g", source: "synthetic catalog" }],
});
const lookup = (products = [product()]) => jest.fn(async () => ({
  catalogMatches: products, profileUsed: [], catalogSearchAvailable: true,
})) as any;
const scan = (): IngredientScanResult => ({
  productName: "Alpha Olive Oil", alignmentGrade: "A", verdictLevel: "buy",
  verdict: "Model says compatible", overallSummary: "Model praise",
  extractedIngredients: ["Olive oil"], betterAlternatives: [{
    category: "Invented product", whyBetter: ["Unsupported clinical claim"], targetCriteria: "Good for you",
  }], betterFor: ["Unsupported medical benefit"], scoreCards: [], outcomeCards: [],
} as any);
beforeEach(() => jest.clearAllMocks());

test.each<[string, string | undefined, boolean]>([
  ["development", undefined, true],
  ["development", "true", false],
  ["development", "1", false],
  ["production", undefined, false],
  ["test", undefined, false],
])("the new recommendation path remains Development-only: %s / %s", (environment, deployment, enabled) => {
  const originalEnvironment = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  try {
    process.env.NODE_ENV = environment;
    if (deployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = deployment;
    expect(developmentGroceryVerificationEnabled()).toBe(enabled);
  } finally {
    process.env.NODE_ENV = originalEnvironment;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
  }
});

test("Production saved-choice reads remain unchanged and never initialize Development assessment", async () => {
  const environment = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    const rows = savedRows();
    expect(await currentShoppingAssessments("synthetic", rows)).toBe(rows);
  } finally { process.env.NODE_ENV = environment; }
});

test("all shared alternatives have exact catalog identity; unknown evidence never becomes eligibility", async () => {
  const find = lookup();
  const result = await verifiedGroceryCatalog("synthetic", "olive oil", find);
  expect(find).toHaveBeenCalledWith("synthetic", { originalName: "olive oil", requirements: [] });
  expect(result.alternatives).toEqual([expect.objectContaining({
    category: "Alpha Olive Oil", productKey: "synthetic-product", evidenceStatus: "needs_verification",
  })]);
  expect(result.alternatives[0].targetCriteria).toContain("Compatibility is not confirmed");
  expect(result.alternatives[0].whyBetter.join(" ")).not.toContain("clinical");
});

test("scan alternatives discard model praise and use the same catalog evidence", async () => {
  const result = await verifyDevelopmentScanResult("synthetic", scan(), { userId: "synthetic" } as any, lookup());
  expect(result.betterAlternatives.map(option => option.category)).toEqual(["Alpha Olive Oil"]);
  expect(result.verdictLevel).toBe("caution");
  expect(result.gradeUnavailable).toBe(true);
  expect(result.betterFor).toEqual([]);
  expect(result.verdict).toMatch(/rules.*unknown/i);
});

test("only an exact, currently eligible primary product can retain a positive verdict", async () => {
  const result = await verifyDevelopmentScanResult("synthetic", scan(), { userId: "synthetic" } as any, lookup([product(true)]));
  expect(result.verdictLevel).toBe("buy");
  const other = product(true); other.name = "Different Oil";
  expect((await verifyDevelopmentScanResult("synthetic", scan(), { userId: "synthetic" } as any,
    lookup([other]))).verdictLevel).toBe("caution");
});

test("known scanned-label conflicts cannot be upgraded by an eligible catalog record", async () => {
  (scanGeneratedOutput as jest.Mock).mockReturnValueOnce({ passed: false });
  const result = await verifyDevelopmentScanResult("synthetic", scan(), { userId: "synthetic" } as any, lookup([product(true)]));
  expect(result.verdictLevel).toBe("skip");
  expect(result.verdict).toMatch(/conflict/i);
  expect(result.gradeUnavailable).toBe(true);
});

test("missing profile and unavailable catalog have different unknown outcomes; neither keeps model alternatives", async () => {
  const find = lookup();
  const missing = await verifyDevelopmentScanResult("synthetic", scan(), null, find);
  expect(find).not.toHaveBeenCalled();
  expect(missing.verdict).toMatch(/profile/i);
  expect(missing.betterAlternatives).toEqual([]);
  const failed = await verifyDevelopmentScanResult("synthetic", scan(), { userId: "synthetic" } as any,
    jest.fn(async () => { throw new Error("catalog unavailable"); }) as any);
  expect(failed.verdict).not.toMatch(/profile/i);
  expect(failed.verdictLevel).toBe("caution");
  expect(failed.betterAlternatives).toEqual([]);
});

test("a missing evidence-backed option is not padded to three", async () => {
  expect((await verifiedGroceryCatalog("synthetic", "oil", lookup([]))).alternatives).toEqual([]);
  const many = Array.from({ length: 5 }, (_, index) => ({ ...product(), productKey: `synthetic-${index}` }));
  expect((await verifiedGroceryCatalog("synthetic", "oil", lookup(many))).alternatives).toHaveLength(3);
});

function savedRows() {
  const current = subject();
  return [{ id: "existing-row", quantity: "2", unit: "tbsp", checked: true,
    ingredientMetadata: {
      ...makeIngredientMetadata({ name: "olive oil", quantity: 2, unit: "tbsp", recipeId: "existing-recipe" }),
      selectedProduct: { name: "Alpha Olive Oil", productKey: "synthetic-product",
        sourcePayloadJson: JSON.stringify({ original: "untouched historical evidence" }),
        evidence: [{ kind: "nutrition", statement: "Calories 120, protein 0g, carbs 0g, fat 14g" }],
        assessment: { status: "eligible_at_evaluation", unresolvedRequirements: [], reasons: ["original"],
          subjectReference: current.subjectId, contextReference: "request-1",
          profileContextReference: productProfileReference(current),
          policyVersion: DEVELOPMENT_CATALOG_IDENTITY_POLICY.version, evaluatedAt: current.dateISO },
      },
    },
  }];
}

test("fresh request IDs alone do not invalidate a same-profile assessment", () => {
  const rows = savedRows();
  expect(projectCurrentShoppingAssessments(rows, { ...subject(), fingerprint: "request-2" })).toEqual(rows);
});

test.each([
  { dietaryIdentity: ["pescatarian"], explicitAvoidances: ["quinoa"] },
  { dietaryIdentity: ["vegan"] }, { dietaryIdentity: ["vegetarian"] },
  { allergies: ["shellfish"] }, { medicalHardLimitNames: ["cardiac"] },
  { protocolStateReference: "changed-labs-or-physician-protocol" },
  { dateISO: "2026-11-22" },
])("changed current requirements require reassessment without losing shopping state: %j", change => {
  const rows = savedRows(); const before = clone(rows);
  const projected = projectCurrentShoppingAssessments(rows, { ...subject(), ...change });
  expect(projected[0].ingredientMetadata.selectedProduct.assessment.status).toBe("review_required");
  expect(rows).toEqual(before);
  const { assessment: _old, ...oldProduct } = before[0].ingredientMetadata.selectedProduct;
  const { assessment: _new, ...newProduct } = projected[0].ingredientMetadata.selectedProduct;
  expect(newProduct).toEqual(oldProduct);
  expect(projected[0].ingredientMetadata.contributions).toEqual(before[0].ingredientMetadata.contributions);
  expect([projected[0].quantity, projected[0].unit, projected[0].checked]).toEqual(["2", "tbsp", true]);
});

test("legacy assessments and unavailable current authority remain unknown", () => {
  const rows = savedRows();
  delete (rows[0].ingredientMetadata.selectedProduct.assessment as any).profileContextReference;
  expect(projectCurrentShoppingAssessments(rows, subject())[0].ingredientMetadata.selectedProduct.assessment.status)
    .toBe("review_required");
  expect(projectCurrentShoppingAssessments(savedRows(), null)[0].ingredientMetadata.selectedProduct.assessment.unresolvedRequirements)
    .toContain("customer_profile_unavailable");
});

test.each([
  [false, "unresolved", "context_unavailable", /profile/i],
  [true, "unresolved", "policy_unavailable", /rules/i],
  [true, "resolved", "identity_unverified", /exact product/i],
])("diagnostics distinguish profile, verification rules and identity", (resolved, policyStatus, code, message) => {
  const decision = evaluateProductCandidate({
    identity: { key: "synthetic", name: "Oil", brand: "Alpha", variant: "Oil", match: "unverified" }, facts: [],
  } as any, {
    subjectId: "synthetic", contextFingerprint: "current", policyVersion: "current",
    resolved, policyStatus, distinctVerificationReasons: true,
    activeHardRestrictionIds: [], hardRequirements: [], rankingFactors: [],
    identityMaxAgeDays: 1, evaluatedAt: "2026-11-21T12:00:00Z",
  } as any, []);
  expect(decision.reasons[0].code).toBe(code);
  expect(shoppingRejectionExplanation(decision, subject(), [])).toMatch(message as RegExp);
});
