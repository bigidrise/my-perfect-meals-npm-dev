import type { HumanFoodContext } from "../../shared/humanFoodContext";
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";
import type { ProductSubjectSources, ProductSubjectSnapshot } from "../services/productDiscovery/subjectAuthority";
import type { ProductEvidenceAdapter, SourceProductRecord } from "../services/productDiscovery/productEvidenceAdapters";
import { findProductDevelopment } from "../services/productDiscovery/findProductDevelopment";
import { shoppingCatalogTip, shoppingCatalogPresentation } from "../services/productDiscovery/shoppingCatalogGuidance";
import { normalizeProductEvidence } from "../services/productDiscovery/productEvidenceAdapters";
import { resolveProductSubjectAuthority } from "../services/productDiscovery/subjectAuthority";

jest.mock("../db", () => ({
  db: new Proxy({}, { get() { throw new Error("Live database access prohibited"); } }),
  pool: { query() { throw new Error("Live database access prohibited"); } },
}));
jest.mock("../services/ingredientScanService", () => ({ buildAnalysisProfile: () => [] }));
jest.mock("../services/productDiscovery/catalogProductInterpretation", () => ({
  interpretCatalogProduct() { throw new Error("AI calls prohibited"); },
}));

const originalFetch = global.fetch;
const blockedFetch = jest.fn(() => { throw new Error("Live network calls prohibited"); });
beforeAll(() => { global.fetch = blockedFetch as typeof fetch; });
afterAll(() => { global.fetch = originalFetch; expect(blockedFetch).not.toHaveBeenCalled(); });
const ingredient = { originalName: "cream cheese", requirements: [] };
const request = { actorUserId: "synthetic-owner", subjectUserId: "synthetic-owner",
  subjectKind: "account" as const, dateISO: "2026-10-20" };

function sources(options: { allergies?: string[]; diet?: string[]; avoided?: string[];
  hard?: string[]; guidance?: string[]; status?: string } = {}): ProductSubjectSources {
  return {
    resolveFoodContext: jest.fn(async () => ({
      actorUserId: request.actorUserId, subjectUserId: request.subjectUserId,
      status: options.status ?? "resolved", internalFingerprint: "synthetic-context",
      diet: { stored: options.diet ?? [], source: "profile" },
      safety: { allergies: options.allergies ?? [], avoidedFoods: options.avoided ?? [],
        dislikedFoods: [], glp1MealAuthorityActive: false },
      nutrition: null, gaps: [],
    } as unknown as HumanFoodContext)),
    loadEnvelope: jest.fn(async () => ({
      userId: request.subjectUserId, dietaryIdentity: options.diet ?? [], allergies: options.allergies ?? [],
      medicalHardLimits: options.hard ?? [], medicalOptimization: [],
      conditionGuidanceBlocks: options.guidance ?? [], preferences: [], providerInterventions: [],
    } as unknown as UserProtocolEnvelope)),
    activeHouseholdProfileId: jest.fn(async () => null),
  };
}

function record(overrides: Partial<SourceProductRecord> = {}): SourceProductRecord {
  return {
    source: "usda_branded", sourceRecordId: "synthetic-cream-cheese", observedAt: null,
    identityObservedAt: new Date().toISOString(), retrievedAt: new Date().toISOString(),
    name: "Cream cheese", brand: "Synthetic Brand", variant: "Original 8 oz",
    barcode: "0000000000012", market: "US", exactVariantMatch: true,
    facts: [
      { kind: "ingredients", originalStatement: "Milk, cream, salt, cultures", completeness: "unknown" },
      { kind: "nutrition", target: "sodium_mg_per_100g", originalStatement: "Sodium 300 mg per 100 g",
        completeness: "unknown", nutritionMeasurement: { value: 300, unit: "mg", basis: "per_100g" } },
    ],
    ...overrides,
  };
}
function adapter(row: SourceProductRecord): ProductEvidenceAdapter {
  return {
    source: row.source,
    search: jest.fn(async () => ({ references: [{ source: row.source, sourceRecordId: row.sourceRecordId }], nextCursor: null })),
    read: jest.fn(async () => row),
  };
}

test("reuses the same catalog evidence, current profile and eligibility without additional interpretation", async () => {
  const context = sources({ allergies: ["SHELLFISH"], avoided: ["quinoa", "pork"], guidance: ["Reduce saturated fat."] });
  const catalog = adapter(record());
  const interpret = jest.fn(() => { throw new Error("Unexpected AI interpretation"); });
  const result = await findProductDevelopment(request.actorUserId, ingredient.originalName, {
    sources: context, adapter: catalog, interpret, shoppingIngredient: ingredient,
  });
  expect(result.catalogMatches[0]).toMatchObject({
    shoppingDisplay: "label_review", evidenceStatus: "needs_verification",
    shoppingSelection: { eligible: false },
    ingredients: "Milk, cream, salt, cultures",
    nutrition: [{ statement: "Sodium 300 mg per 100 g" }],
  });
  expect(result.catalogMatches[0].shoppingSelection?.selection).toBeUndefined();
  expect(result.shoppingTip).toBe("Compare saturated fat using the same serving size.");
  expect(context.loadEnvelope).toHaveBeenCalledTimes(2);
  expect(catalog.search).toHaveBeenCalledTimes(1);
  expect(catalog.read).toHaveBeenCalledTimes(1);
  expect(interpret).not.toHaveBeenCalled();
});

test("a supported choice retains its exact structured selection", async () => {
  const result = await findProductDevelopment(request.actorUserId, ingredient.originalName, {
    sources: sources(), adapter: adapter(record()), shoppingIngredient: ingredient,
  });
  expect(result.catalogMatches[0]).toMatchObject({ shoppingDisplay: "selectable",
    evidenceStatus: "eligible", shoppingSelection: { eligible: true, selection: { ingredient } } });
  expect(result.catalogMatches[0].shoppingSelection?.selection?.product.evidence
    .find(fact => fact.kind === "nutrition")?.measurement).toEqual({ value: 300, unit: "mg", basis: "per_100g" });
});

test.each([
  { allergies: ["MILK"] },
  { diet: ["vegan"] },
  { avoided: ["cream"] },
])("existing known-conflict screen excludes products for %j", async restrictions => {
  const result = await findProductDevelopment(request.actorUserId, ingredient.originalName, {
    sources: sources(restrictions), adapter: adapter(record()), shoppingIngredient: ingredient,
  });
  expect(result.catalogMatches).toEqual([]);
  expect(result.excludedReasons.length).toBeGreaterThan(0);
  expect(result.shoppingTip).toContain("cream cheese");
});

test("the fallback uses the final resolved guidance, not the first snapshot or condition names", async () => {
  const context = sources();
  const first = await context.loadEnvelope(request);
  (context.loadEnvelope as jest.Mock)
    .mockResolvedValueOnce({ ...first, conditionGuidanceBlocks: ["Reduce sodium."] })
    .mockResolvedValueOnce({ ...first, conditionGuidanceBlocks: ["Limit saturated fat."] });
  const result = await findProductDevelopment(request.actorUserId, ingredient.originalName, {
    sources: context, adapter: adapter(record()), shoppingIngredient: ingredient,
  });
  expect(result.shoppingTip).toBe("Compare saturated fat using the same serving size.");
});

test("an explicit qualifier stays unapproved and supplies a practical comparison tip", async () => {
  const input = { originalName: "low-sodium soy sauce", requirements: [] };
  const before = JSON.stringify(input);
  const result = await findProductDevelopment(request.actorUserId, input.originalName, {
    sources: sources(), adapter: adapter(record({ name: "Low-sodium soy sauce" })), shoppingIngredient: input,
  });
  expect(result.catalogMatches[0]).toMatchObject({
    shoppingDisplay: "label_review", shoppingSelection: { eligible: false },
    shoppingCaution: expect.stringContaining("low sodium"),
  });
  expect(result.shoppingTip).toContain("Compare sodium across lower-sodium varieties");
  expect(JSON.stringify(input)).toBe(before);
});

test("a known dietary conflict with an explicit ingredient request is not displayed for review", async () => {
  const input = { originalName: "vegan cream cheese", requirements: [] };
  const result = await findProductDevelopment(request.actorUserId, input.originalName, {
    sources: sources(), adapter: adapter(record()), shoppingIngredient: input,
  });
  expect(result.catalogMatches).toEqual([]);
  expect(result.excludedReasons.length).toBeGreaterThan(0);
});

test("unusable incomplete evidence is hidden, not promoted into a useful review choice", async () => {
  const result = await findProductDevelopment(request.actorUserId, ingredient.originalName, {
    sources: sources(), adapter: adapter(record({ facts: [record().facts[0]] })), shoppingIngredient: ingredient,
  });
  expect(result.catalogMatches[0]).toMatchObject({ shoppingDisplay: "hidden", shoppingSelection: { eligible: false } });
});

test("catalog outage remains explicit while the already-resolved guidance supplies a tip", async () => {
  const catalog = adapter(record());
  (catalog.search as jest.Mock).mockRejectedValue(new Error("Synthetic outage"));
  const result = await findProductDevelopment(request.actorUserId, ingredient.originalName, {
    sources: sources({ guidance: ["Reduce sodium."] }), adapter: catalog, shoppingIngredient: ingredient,
  });
  expect(result.catalogSearchAvailable).toBe(false);
  expect(result.catalogMatches).toEqual([]);
  expect(result.shoppingTip).toBe("Compare sodium using the same serving size.");
});

test("unavailable profile context stops the lookup without using stale medical guidance", async () => {
  const catalog = adapter(record());
  await expect(findProductDevelopment(request.actorUserId, ingredient.originalName, {
    sources: sources({ status: "review_required", guidance: ["Reduce sodium."] }),
    adapter: catalog, shoppingIngredient: ingredient,
  })).rejects.toThrow("profile could not be resolved");
  expect(catalog.search).not.toHaveBeenCalled();
});

test("ordinary Grocery Coach keeps its original result shape and selection behavior", async () => {
  const result = await findProductDevelopment(request.actorUserId, ingredient.originalName, {
    sources: sources({ allergies: ["SHELLFISH"], guidance: ["Reduce sodium."] }), adapter: adapter(record()),
  });
  expect(result).not.toHaveProperty("shoppingTip");
  expect(result.catalogMatches[0]).not.toHaveProperty("shoppingDisplay");
  expect(result.catalogMatches[0]).not.toHaveProperty("shoppingSelection");
  expect(result.catalogMatches[0].recommendationStatus).toBe("profile_matched_pick");
});

test.each([
  [["Reduce sodium."], "Compare sodium using the same serving size."],
  [["Limit saturated fat."], "Compare saturated fat using the same serving size."],
  [["Reduce sodium and saturated fat."], "Compare sodium and saturated fat using the same serving size."],
  [["Cardiac protocol", "Hypertension", "Renal protocol"], null],
  [["No sodium restriction.", "Sodium is unrestricted."], null],
  [["Nutrition information includes sodium and saturated fat."], null],
] as const)("uses only established reduction guidance: %j", (guidance, expected) => {
  const subject = { status: "resolved", shoppingGuidance: guidance } as ProductSubjectSnapshot;
  const tip = shoppingCatalogTip(ingredient, subject);
  if (expected) expect(tip).toBe(expected);
  else expect(tip).toContain("compare ingredient lists and nutrition");
  expect(tip).not.toMatch(/\d+\s*(mg|g|calories)/);
});

test("even a full catalog record rejected by the evaluator is hidden", () => {
  const candidate = normalizeProductEvidence(record());
  const result = shoppingCatalogPresentation(candidate, { status: "rejected" } as any,
    { eligible: false }, ingredient);
  expect(result.shoppingDisplay).toBe("hidden");
});

test("guidance is retained only for the explicit Smart Grocery path", async () => {
  const context = sources({ guidance: ["Reduce sodium."] });
  expect(await resolveProductSubjectAuthority(request, context)).not.toHaveProperty("shoppingGuidance");
  expect(await resolveProductSubjectAuthority({ ...request, includeShoppingGuidance: true }, context))
    .toHaveProperty("shoppingGuidance", ["Reduce sodium."]);
});
