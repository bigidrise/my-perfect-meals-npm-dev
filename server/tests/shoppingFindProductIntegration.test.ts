import { findShoppingProductRecommendationsDevelopment as lookup } from
  "../services/productDiscovery/findShoppingProductRecommendationsDevelopment";
import type { ProductSubjectSources } from "../services/productDiscovery/subjectAuthority";
import type { ProductEvidenceAdapter, SourceProductRecord } from "../services/productDiscovery/productEvidenceAdapters";
import type { IngredientScanResult } from "../services/ingredientScanService";
import { findProductDevelopment } from "../services/productDiscovery/findProductDevelopment";
import { analyzeProductByName } from "../services/ingredientScanService";
import { normalizeProductEvidence } from "../services/productDiscovery/productEvidenceAdapters";
import { shoppingRecommendationIdentityMatches } from "../services/productDiscovery/shoppingRecommendationIdentity";
import { shoppingRecommendationNamesProduct } from "../../shared/shoppingRecommendationName";
import { parseShoppingProductReference, parseShoppingProductSelection } from "../../shared/shoppingProductSelection";
import { developmentItemPatch } from "../services/shopping-list/metadataPersistence";
import { makeIngredientMetadata } from "../../shared/shoppingIngredientMetadata";
import { writeFileSync } from "node:fs";

jest.mock("../services/ingredientScanService", () => ({
  buildAnalysisProfile: jest.fn(() => []),
  analyzeProductByName: jest.fn(),
}));

const owner = "synthetic-shopping-member";
const ingredient = { originalName: "olive oil", requirements: [] };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test("an actual unresolved-profile response offers distinct references, never verified selections", async () => {
  const f = fixture({ avoided: ["quinoa"], ingredients: "Olive oil" });
  const result = await f.run();
  if (process.env.SHOPPING_REFERENCE_CAPTURE === "true") {
    writeFileSync("generated-artifacts/smart-shopping-shared-cards/reference-service-response.json", JSON.stringify(result, null, 2));
  }
  expect(result.recommendationChecks).toHaveLength(3);
  expect(result.recommendationNotice).toContain("unverified shopping references");
  for (const check of result.recommendationChecks) {
    expect(check.status).toBe("review_only");
    expect(check.productKey).toBeUndefined();
    expect(check.catalogProductKey).toBeDefined();
    const reference = parseShoppingProductReference(check.reference);
    expect(reference.product.productKey).toBe(check.catalogProductKey);
    expect(reference.product.assessment.status).toBe("review_required");
    expect(reference.product.assessment.unresolvedRequirements.join(" ")).toMatch(/quinoa/i);
    expect(reference.product.assessment.unresolvedRequirements.join(" ")).toContain("not medical");
    const match = result.catalogMatches.find(item => item.productKey === check.catalogProductKey)!;
    expect(match.recommendationIdentityVerified).toBe(true);
    expect(match.shoppingReference).toEqual(reference);
    expect(match.shoppingSelection?.eligible).toBe(false);
    expect(() => parseShoppingProductSelection(reference)).toThrow();
    const snapshot = JSON.parse(reference.product.sourcePayloadJson!);
    expect(snapshot.decision.status).toBe("needs_verification");
    expect(snapshot.identity.variant).toBe(reference.product.variant);
    // Use the real PATCH projection against a synthetic, existing row only.
    const metadata = makeIngredientMetadata({ name: "olive oil", quantity: 3, unit: "tsp", recipeId: "synthetic-recipe" });
    const before = clone(metadata);
    const update = developmentItemPatch({
      ingredientMetadata: { ...metadata, selectedProduct: reference.product },
    }, { userId: owner, name: "olive oil", quantity: "3", unit: "tsp", checked: true, ingredientMetadata: metadata });
    expect(update.ingredientMetadata).toEqual({ ...before, selectedProduct: reference.product });
    expect(update).not.toHaveProperty("quantity");
    expect(update).not.toHaveProperty("unit");
    expect(update).not.toHaveProperty("checked");
    expect(metadata).toEqual(before);
  }
  expect(f.recommend).toHaveBeenCalledTimes(1);
});

test("reference workflow excludes known conflicts, unconfirmed variants and stale identity", async () => {
  const conflict = await fixture({ avoided: ["quinoa"], ingredients: "Olive oil, quinoa" }).run();
  expect(conflict.recommendationChecks).toEqual([]);
  expect(conflict.catalogMatches).toEqual([]);
  const f = fixture({ avoided: ["quinoa"] });
  f.records[0].variant = "Light Olive Oil 500ml";
  f.records[1].identityObservedAt = "2001-01-01T00:00:00.000Z";
  const result = await f.run();
  expect(result.recommendationChecks.find(check => check.recommendationCategory.includes("Alpha"))?.reference).toBeUndefined();
  expect(result.recommendationChecks.find(check => check.recommendationCategory.includes("Beta"))?.reference).toBeUndefined();
  expect(result.recommendationChecks.find(check => check.recommendationCategory.includes("Gamma"))?.reference).toBeDefined();
});

test("reference persistence rejects warning removal, status upgrades and account/ingredient substitution", async () => {
  const result = await fixture({ avoided: ["quinoa"] }).run();
  const reference = parseShoppingProductReference(result.recommendationChecks[0].reference);
  const metadata = makeIngredientMetadata({ name: "olive oil", quantity: 2, unit: "tbsp" });
  const existing = { userId: owner, ingredientMetadata: metadata };
  for (const mutate of [
    (r: any) => { r.product.assessment.unresolvedRequirements = []; },
    (r: any) => { r.product.assessment.status = "eligible_at_evaluation"; },
    (r: any) => { r.product.variant = "Different variant"; },
    (r: any) => { r.product.packageDescription = "Different package"; },
    (r: any) => { r.product.assessment.subjectReference = "different-account"; },
  ]) {
    const invalid = clone(reference);
    mutate(invalid);
    expect(() => parseShoppingProductReference(invalid)).toThrow();
    expect(() => developmentItemPatch({
      ingredientMetadata: { ...metadata, selectedProduct: invalid.product },
    }, existing)).toThrow();
  }
  expect(() => developmentItemPatch({ ingredientMetadata: { ...metadata, ingredient: {
    ...metadata.ingredient, requirements: [{ value: "new constraint", origin: "explicit_request" }],
  }, selectedProduct: reference.product } }, existing)).toThrow();
});
const suggestion = (brand: string) => ({
  category: `${brand} Olive Oil 500ml`, whyBetter: [`${brand} personalized explanation, not source evidence`],
  targetCriteria: "Check the current label and serving basis.",
});
function analysis(alternatives = [suggestion("Synthetic Alpha"), suggestion("Synthetic Beta"), suggestion("Synthetic Gamma")]) {
  return { analysisMethod: "by_name", fallbackUsed: false, betterAlternatives: alternatives } as IngredientScanResult;
}
function fixture(options: { avoided?: string[]; ingredients?: string; missing?: boolean; readDelay?: number } = {}) {
  let active = 0, maxActive = 0;
  const food = { actorUserId: owner, subjectUserId: owner, status: "resolved",
    internalFingerprint: "synthetic-context", diet: { stored: [], source: "profile" },
    safety: { allergies: [], avoidedFoods: options.avoided || [], dislikedFoods: [], glp1MealAuthorityActive: false },
    nutrition: null, gaps: [] };
  const sources: ProductSubjectSources = {
    resolveFoodContext: jest.fn(async () => food as any),
    loadEnvelope: jest.fn(async () => ({ userId: owner, dietaryIdentity: [], allergies: [],
      medicalHardLimits: [], medicalOptimization: [], preferences: [], providerInterventions: [] }) as any),
    activeHouseholdProfileId: jest.fn(async () => null),
  };
  const records: SourceProductRecord[] = ["Synthetic Alpha", "Synthetic Beta", "Synthetic Gamma"].map((brand, index) => ({
    source: "usda_branded", sourceRecordId: `synthetic-${index}`,
    name: "Olive Oil", brand, variant: "Olive Oil 500ml",
    barcode: `012345678900${index}`, market: "United States",
    observedAt: null, identityObservedAt: new Date().toISOString(), retrievedAt: new Date().toISOString(),
    exactVariantMatch: true, servingDescription: "14g",
    facts: [
      ...(!options.missing ? [{
        kind: "ingredients" as const, originalStatement: options.ingredients || "Olive oil", completeness: "unknown" as const,
      }] : []),
      { kind: "nutrition" as const, target: "fat_g_per_100g", originalStatement: "Fat 100 g per 100g",
        completeness: "unknown" as const, nutritionMeasurement: { value: 100, unit: "g", basis: "per_100g" as const } },
    ],
  }));
  const adapter: ProductEvidenceAdapter = {
    source: "usda_branded",
    search: jest.fn(async () => ({
      references: records.map(record => ({ source: record.source, sourceRecordId: record.sourceRecordId })), nextCursor: null,
    })),
    read: jest.fn(async reference => {
      active++; maxActive = Math.max(maxActive, active);
      await delay(options.readDelay || 0); active--;
      return records.find(record => record.sourceRecordId === reference.sourceRecordId)!;
    }),
  };
  const recommend = jest.fn(async () => analysis());
  return { sources, adapter, records, recommend, maxActive: () => maxActive,
    run: (input = ingredient) => lookup(owner, input, { recommend, discoveryOptions: { sources, adapter } }) };
}

describe("catalog-first Development shopping options", () => {
  let originalEnvironment: string | undefined;
  beforeEach(() => { originalEnvironment = process.env.NODE_ENV; process.env.NODE_ENV = "development"; });
  afterEach(() => { process.env.NODE_ENV = originalEnvironment; });

  test.each(["avocado oil", "tomato sauce", "oatmeal", "yogurt", "seasoning blend", "canned beans"])(
    "%s uses actual catalog identities, not invented AI names or health claims",
    async originalName => {
      const f = fixture();
      for (const record of f.records) {
        record.name = originalName;
        record.variant = `${originalName} 500g`;
        record.facts[0].originalStatement = originalName;
      }
      f.recommend.mockResolvedValue(analysis([{
        category: "Invented AI product with no catalog identity",
        whyBetter: ["Supports anti-inflammatory and hormone-supportive goals"],
        targetCriteria: "Available everywhere",
      }]));
      const result = await f.run({ originalName, requirements: [] });
      expect(f.recommend).not.toHaveBeenCalled();
      expect(result.recommendations).toHaveLength(3);
      expect(result.recommendationChecks).toHaveLength(3);
      expect(JSON.stringify(result)).not.toMatch(/hormone-supportive|Available everywhere|Invented AI/);
      for (const match of result.catalogMatches) {
        expect(match.name).toBe(originalName);
        expect(result.recommendations.some(alt => alt.category === match.recommendationLead)).toBe(true);
        const check = result.recommendationChecks.find(item => item.catalogProductKey === match.productKey)!;
        const selected = check.status === "eligible"
          ? parseShoppingProductSelection(match.shoppingSelection!.selection!)
          : parseShoppingProductReference(check.reference);
        expect(selected.ingredient.originalName).toBe(originalName);
        expect(selected.product.name).toBe(originalName);
        expect(selected.product.source.sourceRecordId).toBe(match.sourceRecordId);
      }
      expect(f.adapter.search).toHaveBeenCalledWith(expect.objectContaining({
        searchCategories: [expect.objectContaining({ category: originalName })],
      }), null, 8);
    },
  );

  test("searches beyond unrelated buffalo sauce and an unverified identity for real avocado oils", async () => {
    const f = fixture();
    f.records.forEach(record => { record.name = "Avocado Oil"; record.variant = "Original 500ml"; });
    f.records[0].name = "Hot Buffalo Sauce Made With Avocado Oil";
    f.records[1].exactVariantMatch = false;
    const extra = clone(f.records[2]);
    extra.sourceRecordId = "actual-fourth-record"; extra.brand = "Another Catalog Brand"; extra.barcode = "0123456789018";
    f.records.push(extra);
    const result = await f.run({ originalName: "avocado oil", requirements: [] });
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations.map(alt => alt.category)).toEqual(expect.arrayContaining([
      "Synthetic Gamma Avocado Oil", "Another Catalog Brand Avocado Oil",
    ]));
    expect(JSON.stringify(result.recommendations)).not.toMatch(/Buffalo|Synthetic Alpha|Synthetic Beta/);
    expect(result.recommendationChecks.every(check => check.status === "eligible" || !!check.reference)).toBe(true);
  });

  test("known conflicts, stale identity and missing facts never fill the three options", async () => {
    const conflict = await fixture({ avoided: ["quinoa"], ingredients: "Olive oil, quinoa" }).run();
    expect(conflict.recommendations).toEqual([]);
    const f = fixture({ avoided: ["quinoa"] });
    f.records[0].identityObservedAt = "2001-01-01T00:00:00Z";
    f.records[1].facts = [];
    const result = await f.run();
    expect(result.recommendations).toHaveLength(1);
    const reference = parseShoppingProductReference(result.recommendationChecks[0].reference);
    expect(reference.product.brand).toBe("Synthetic Gamma");
    expect(reference.product.assessment.status).toBe("review_required");
    expect(reference.product.assessment.unresolvedRequirements.join(" ")).toMatch(/quinoa/i);
  });

  test("catalog outage returns zero options without AI or fabricated identities", async () => {
    const f = fixture();
    (f.adapter.search as jest.Mock).mockRejectedValue(new Error("offline"));
    const result = await f.run();
    expect(result.catalogSearchAvailable).toBe(false);
    expect(result.recommendations).toEqual([]);
    expect(result.recommendationChecks).toEqual([]);
    expect(f.recommend).not.toHaveBeenCalled();
  });

  test("a deployment keeps the original recommendation pipeline", async () => {
    const previous = process.env.REPLIT_DEPLOYMENT;
    process.env.REPLIT_DEPLOYMENT = "1";
    try {
      const f = fixture();
      await f.run();
      expect(f.recommend).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined) delete process.env.REPLIT_DEPLOYMENT;
      else process.env.REPLIT_DEPLOYMENT = previous;
    }
  });
});

test("reuses one by-name recommendation, source evidence and the existing selection bridge", async () => {
  const f = fixture({ readDelay: 15 });
  const before = clone(f.records);
  const result = await f.run();
  expect(f.recommend).toHaveBeenCalledTimes(1);
  expect(f.recommend).toHaveBeenCalledWith("olive oil", owner);
  expect(f.adapter.search).toHaveBeenCalledWith(expect.objectContaining({
    requestedFood: "olive oil", searchCategories: expect.arrayContaining([
      expect.objectContaining({ category: "Synthetic Alpha Olive Oil 500ml" }),
    ]),
  }), null, 3);
  expect(f.sources.resolveFoodContext).toHaveBeenCalledTimes(2);
  expect(result.catalogMatches).toHaveLength(3);
  expect(result.catalogMatches.every(match => match.shoppingSelection?.eligible)).toBe(true);
  expect(result.recommendations).toEqual(analysis().betterAlternatives);
  expect(result.recommendationChecks).toHaveLength(3);
  expect(result.recommendationChecks.every(check => check.status === "eligible" &&
    result.catalogMatches.some(match => match.productKey === check.productKey &&
      match.recommendationLead === check.recommendationCategory))).toBe(true);
  expect(f.maxActive()).toBe(2);
  for (const match of result.catalogMatches) {
    expect(match.recommendationExplanation?.whyBetter[0]).toContain("personalized explanation");
    const selection = match.shoppingSelection!.selection!;
    expect(selection.ingredient).toEqual(ingredient);
    expect(selection.product.assessment.subjectReference).toBe(owner);
    expect(selection.product.evidence.map(item => item.statement).join(" ")).not.toContain("personalized explanation");
    expect(selection.product.sourcePayloadJson).not.toContain("personalized explanation");
  }
  expect(f.records).toEqual(before);
  expect(result.lookupTiming.totalMs).toBeGreaterThanOrEqual(result.lookupTiming.recommendationMs);
});

test("the default Shopping path calls the existing Find a Product service with the authenticated subject and row name", async () => {
  const f = fixture();
  (analyzeProductByName as jest.Mock).mockResolvedValueOnce(analysis());
  const result = await lookup(owner, ingredient, {
    discoveryOptions: { sources: f.sources, adapter: f.adapter },
  });
  expect(analyzeProductByName).toHaveBeenCalledTimes(1);
  expect(analyzeProductByName).toHaveBeenCalledWith(ingredient.originalName, owner, {
    ingredient, findNewOptions: undefined,
  });
  expect(f.recommend).not.toHaveBeenCalled();
  expect(result.catalogMatches).toHaveLength(3);
  expect(result.catalogMatches.every(match => match.shoppingSelection?.eligible)).toBe(true);
  expect(result.catalogMatches.every(match =>
    match.shoppingSelection?.selection?.product.assessment.subjectReference === owner)).toBe(true);
});

test("recommendations and Add-style names never bypass unresolved profile policy", async () => {
  const result = await fixture({ avoided: ["synthetic-avoidance"] }).run();
  expect(result.catalogMatches).toHaveLength(3);
  expect(result.catalogMatches.every(match => !match.shoppingSelection?.eligible)).toBe(true);
  expect(result.catalogMatches[0].shoppingCaution).toContain("Reviewed checks aren't available");
  expect(result.recommendationNotice).toContain("suitability is not cleared");
  expect(result.recommendations).toEqual(analysis().betterAlternatives);
  expect(result.recommendationChecks.every(check => check.status === "review_only" &&
    check.productKey === undefined)).toBe(true);
});

test("known conflicts remain excluded instead of being exposed as review-only suggestions", async () => {
  const result = await fixture({ avoided: ["synthetic-avoidance"],
    ingredients: "Olive oil, synthetic-avoidance" }).run();
  expect(result.catalogMatches).toEqual([]);
  expect(result.rejected).toBe(3);
  expect(result.excludedReasons[0]).toContain("explicitly avoided");
  expect(result.recommendationNotice).toContain("known conflict");
  expect(result.recommendations).toEqual([]);
  expect(result.recommendationChecks).toEqual([]);
});

test("preserves complete recommendation objects without treating their details as product evidence", async () => {
  const f = fixture();
  const recommendation = { ...suggestion("Synthetic Alpha"), brand: "Synthetic Alpha",
    productName: "Olive Oil", futurePresentationField: { note: "Original content" } };
  f.recommend.mockResolvedValueOnce({
    ...analysis([recommendation]), educationalFooter: "Original educational footer",
    verdictLevel: "buy", productName: "olive oil",
  } as IngredientScanResult);
  const result = await f.run();
  expect(result.recommendations).toEqual([recommendation]);
  expect(result.recommendationContext).toEqual({
    query: "olive oil", educationalFooter: "Original educational footer", verdictLevel: "buy",
  });
  expect(result.catalogMatches[0].shoppingSelection?.selection?.product.sourcePayloadJson)
    .not.toContain("Original content");
});

test("a known conflicting brand cannot return through the raw recommendation fallback", async () => {
  const f = fixture({ avoided: ["synthetic-avoidance"] });
  f.records[0].facts.find(fact => fact.kind === "ingredients")!.originalStatement =
    "Olive oil, synthetic-avoidance";
  const result = await f.run();
  expect(result.recommendations.map(alt => alt.category)).toEqual([
    "Synthetic Beta Olive Oil 500ml", "Synthetic Gamma Olive Oil 500ml",
  ]);
  expect(result.recommendationChecks).toHaveLength(2);
  expect(result.recommendationChecks.every(check => check.status === "review_only")).toBe(true);
});
test("an unsupported original qualifier remains unselectable without changing the ingredient", async () => {
  const original = { originalName: "low-sodium olive oil", requirements: [] };
  const f = fixture();
  const result = await f.run(original);
  expect(f.recommend).toHaveBeenCalledWith(original.originalName, owner);
  expect(result.catalogMatches.every(match => !match.shoppingSelection?.eligible)).toBe(true);
  expect(result.catalogMatches[0].shoppingCaution).toContain("requested ingredient requirement");
  expect(original.requirements).toEqual([]);
});

test("a quinoa avoidance remains unresolved even when the catalog ingredient text does not mention quinoa", async () => {
  const f = fixture({ avoided: ["quinoa"], ingredients: "Tomatoes, olive oil, garlic, basil" });
  const result = await f.run();
  expect(result.recommendationChecks).toHaveLength(3);
  result.recommendationChecks.forEach(check => {
    expect(check.status).toBe("review_only");
    expect(check.reason).toContain("quinoa");
    expect(check.reason).toContain("does not mean the product contains");
    expect(check.productKey).toBeUndefined();
    expect(result.catalogMatches.some(match => match.productKey === check.catalogProductKey)).toBe(true);
  });
});

test("a positive quinoa ingredient conflict is excluded rather than offered for review", async () => {
  const f = fixture({ avoided: ["quinoa"], ingredients: "Tomatoes, quinoa, garlic" });
  const result = await f.run();
  expect(result.recommendations).toEqual([]);
  expect(result.catalogMatches).toEqual([]);
});

test("an otherwise eligible but different variant is review-only and retains its inspectable source identity", async () => {
  const f = fixture();
  f.records[0].variant = "Light Olive Oil 500ml";
  const result = await f.run();
  const alpha = result.recommendationChecks.find(check => check.recommendationCategory.includes("Alpha"))!;
  expect(alpha).toMatchObject({ status: "review_only" });
  expect(alpha.reason).toContain("exact recommended product and variant");
  expect(alpha.productKey).toBeUndefined();
  const record = result.catalogMatches.find(match => match.productKey === alpha.catalogProductKey)!;
  expect(record.variant).toBe("Light Olive Oil 500ml");
  expect(record.recommendationIdentityVerified).toBe(false);
  expect(record.shoppingSelection?.eligible).toBe(false);
  expect(record.shoppingReference).toBeUndefined();
  expect(alpha.reference).toBeUndefined();
  expect(result.recommendationChecks.filter(check => check.status === "eligible")).toHaveLength(2);
});

test("Production does not enable Development's explicit related-catalog reference review", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const f = fixture();
    f.records[0].variant = "Light Olive Oil 500ml";
    const result = await f.run();
    const record = result.catalogMatches.find(match => match.brand === "Synthetic Alpha")!;
    expect(record.recommendationIdentityVerified).toBe(false);
    expect(record.shoppingSelection?.eligible).toBe(false);
    expect(record.shoppingReference).toBeUndefined();
  } finally { process.env.NODE_ENV = previous; }
});

test("a named product may be an unverified shopping reference without pretending a package-size match is verified", async () => {
  const f = fixture();
  (f.recommend as jest.Mock).mockImplementation(async () => ({
    ...analysis(), betterAlternatives: analysis().betterAlternatives!.map(alt => ({
      ...alt, category: alt.category.replace(" 500ml", ""),
    })),
  }));
  const result = await f.run();
  expect(result.recommendationChecks).toHaveLength(3);
  for (const check of result.recommendationChecks) {
    expect(check.status).toBe("review_only");
    expect(check.productKey).toBeUndefined();
    const reference = parseShoppingProductReference(check.reference);
    expect(reference.product.assessment.status).toBe("review_required");
    expect(shoppingRecommendationNamesProduct(check.recommendationCategory, reference.product)).toBe(true);
  }
});

test.each<[string, string, boolean]>([
  ["Primal Kitchen Avocado Oil", "Avocado Oil", true],
  ["Primal Kitchen Avocado Oil", "Hot Buffalo Sauce Made With Avocado Oil", false],
  ["Primal Kitchen Avocado Oil", "Avocado Oil Mayonnaise", false],
  ["Primal Kitchen Avocado Oil", "Extra Virgin Olive Oil", false],
])("shopping name binding keeps %s separate from %s", (suggestion, name, expected) => {
  expect(shoppingRecommendationNamesProduct(suggestion, { brand: "Primal Kitchen", name, variant: "Original" })).toBe(expected);
});

test("near variants cannot exhaust the eligible-result target before exact variants are inspected", async () => {
  const f = fixture();
  const exact = clone(f.records);
  const near = exact.map((record, index) => ({
    ...clone(record), sourceRecordId: `near-${index}`, variant: "Light Olive Oil 500ml",
  }));
  f.records.splice(0, f.records.length, ...near, ...exact);
  (f.adapter.search as jest.Mock).mockImplementation(async (_intent, cursor, limit) => {
    const offset = Number(cursor || 0), end = Math.min(offset + limit, f.records.length);
    return { references: f.records.slice(offset, end).map(record => ({
      source: record.source, sourceRecordId: record.sourceRecordId,
    })), nextCursor: end < f.records.length ? String(end) : null };
  });
  const result = await f.run();
  expect(result.recommendationChecks.filter(check => check.status === "eligible")).toHaveLength(3);
  expect(result.catalogMatches.every(match => match.recommendationIdentityVerified &&
    !match.sourceRecordId.startsWith("near-"))).toBe(true);
  expect(result.searched).toBe(6);
});

test.each([
  ["Synthetic Alpha Olive Oil 500 ml", true],
  ["SYNTHETIC ALPHA OLIVE OIL 500ML", true],
  ["Synthetic Alpha Light Olive Oil 500ml", false],
  ["Synthetic Alpha Olive Oil", false],
  ["Synthetic Alpha Olive Oil 750ml", false],
  ["Synthetic Beta Olive Oil 500ml", false],
  ["Olive Oil 500ml", false],
])("exact identity binding for %s is %s", (name, expected) => {
  const f = fixture();
  expect(shoppingRecommendationIdentityMatches(name, normalizeProductEvidence(f.records[0]))).toBe(expected);
});
test("catalog records unrelated to every suggested exact product are never chosen", async () => {
  const f = fixture();
  f.records.forEach(record => { record.brand = "Unrelated Mill"; });
  const result = await f.run();
  expect(result.catalogMatches).toEqual([]);
  expect(result.recommendationCount).toBe(3);
});

test("a brand-only suggestion does not verify an unspecified product variant", async () => {
  const f = fixture();
  f.recommend.mockResolvedValueOnce(analysis([{
    category: "Synthetic Alpha", whyBetter: ["Knowledge-based brand suggestion"], targetCriteria: "",
  }]));
  expect((await f.run()).catalogMatches).toEqual([]);
});

test("missing product facts cannot acquire evidence from the AI explanation", async () => {
  const result = await fixture({ missing: true }).run();
  expect(result.catalogMatches).toEqual([]);
  expect(result.recommendationNotice).toContain("exact products or required checks");
  expect(result.recommendations).toHaveLength(3);
  expect(result.recommendationChecks.every(check => check.status === "review_only" &&
    /required product information/.test(check.reason))).toBe(true);
});

test.each(["missing_facts", "unverified_identity"])(
  "three eligible choices take priority before the display cap when other brands have %s",
  async gap => {
    const f = fixture();
    const eligible = [0, 1, 2].map(index => ({
      ...clone(f.records[index]), sourceRecordId: `eligible-${index}`,
    }));
    const incomplete = [1, 2].map(index => {
      const record = clone(f.records[index]);
      record.sourceRecordId = `incomplete-${index}`;
      record.variant = "Light Olive Oil 500ml";
      if (gap === "missing_facts") record.facts = record.facts.filter(fact => fact.kind !== "ingredients");
      else record.identityObservedAt = undefined;
      return record;
    });
    f.records.splice(0, f.records.length, eligible[0], ...incomplete, eligible[1], eligible[2]);
    (f.adapter.search as jest.Mock).mockImplementation(async (_intent, cursor, limit) => {
      const offset = Number(cursor || 0), end = Math.min(offset + limit, f.records.length);
      return { references: f.records.slice(offset, end).map(record => ({
        source: record.source, sourceRecordId: record.sourceRecordId,
      })), nextCursor: end < f.records.length ? String(end) : null };
    });
    const result = await f.run();
    expect(result.catalogMatches).toHaveLength(3);
    expect(result.catalogMatches.every(match => match.shoppingSelection?.eligible)).toBe(true);
    expect(result.catalogMatches.every(match => match.productKey.includes("eligible-"))).toBe(true);
  },
);

test("a failed explanation uses governed catalog evidence without claiming a personalized recommendation", async () => {
  const f = fixture();
  f.recommend.mockResolvedValueOnce({ ...analysis(), fallbackUsed: true });
  const result = await f.run();
  expect(f.adapter.search).toHaveBeenCalled();
  expect(result).not.toHaveProperty("recommendations");
  expect(result.recommendationNotice).toMatch(/explanations are temporarily unavailable/);
  expect(result.catalogMatches.length).toBeGreaterThan(0);
  expect(f.sources.resolveFoodContext).toHaveBeenCalledTimes(2);
});

test("catalog fallback still rejects known ingredient conflicts", async () => {
  const f = fixture({ avoided: ["quinoa"], ingredients: "Olive oil, quinoa" });
  f.recommend.mockResolvedValueOnce({ ...analysis(), fallbackUsed: true });
  const result = await f.run();
  expect(result.catalogMatches).toEqual([]);
  expect(result).not.toHaveProperty("recommendations");
});

test("empty recommendations use bounded governed discovery while duplicate leads are deduplicated", async () => {
  const f = fixture();
  f.recommend.mockResolvedValueOnce(analysis([]));
  const result = await f.run();
  expect(result).not.toHaveProperty("recommendations");
  expect(f.adapter.search).toHaveBeenCalled();
  f.recommend.mockResolvedValueOnce(analysis(Array(10).fill(suggestion("Synthetic Alpha"))));
  const deduplicated = await f.run();
  expect(deduplicated.recommendationCount).toBe(1);
  expect(deduplicated.catalogMatches).toHaveLength(1);
});

test("repeated catalog references are read only once per request within the existing search budget", async () => {
  const f = fixture({ avoided: ["synthetic-avoidance"] });
  (f.adapter.search as jest.Mock).mockImplementation(async (_intent, cursor) => ({
    references: f.records.map(record => ({ source: record.source, sourceRecordId: record.sourceRecordId })),
    nextCursor: String(Number(cursor || 0) + 1),
  }));
  const result = await f.run();
  expect(f.adapter.search).toHaveBeenCalledTimes(6);
  expect(f.adapter.read).toHaveBeenCalledTimes(3);
  expect(result.searched).toBeLessThanOrEqual(18);
  expect(result.catalogMatches).toHaveLength(3);
  expect(result.catalogMatches.every(match => !match.shoppingSelection?.eligible)).toBe(true);
});

test("an unavailable source cannot turn recommendations into eligible choices", async () => {
  const f = fixture();
  (f.adapter.search as jest.Mock).mockRejectedValueOnce(new Error("offline fixture unavailable"));
  const result = await f.run();
  expect(result.catalogSearchAvailable).toBe(false);
  expect(result.catalogMatches).toEqual([]);
  expect(result.recommendationCount).toBe(3);
  expect(result.recommendations).toHaveLength(3);
  expect(result.recommendationChecks.every(check => check.status === "review_only" &&
    /catalog is temporarily unavailable/.test(check.reason))).toBe(true);
});

test("an oversized recommended name stays review-only without truncation or an extra catalog search", async () => {
  const f = fixture();
  const recommendation = { ...suggestion("Synthetic Alpha"), category: "Olive oil " + "long brand ".repeat(9) };
  f.recommend.mockResolvedValueOnce(analysis([recommendation]));
  const result = await f.run();
  expect(result.recommendations).toEqual([recommendation]);
  expect(result.recommendationChecks[0]).toMatchObject({
    recommendationCategory: recommendation.category.trim(), status: "review_only",
  });
  expect(result.recommendationChecks[0].reason).toContain("lookup limit");
  expect(f.adapter.search).not.toHaveBeenCalled();
});

test("Production runs the same governed Shopping recommendations without opt-in flags", async () => {
  const previous = process.env.NODE_ENV;
  const f = fixture();
  process.env.NODE_ENV = "production";
  try {
    const result = await f.run();
    expect(f.recommend).toHaveBeenCalledTimes(1);
    expect(result.catalogMatches).toHaveLength(3);
    expect(result.recommendationChecks).toHaveLength(3);
    // Existing verification determines selection status, not the environment.
    for (const match of result.catalogMatches) {
      expect(match.shoppingSelection).toBeDefined();
    }
  } finally { process.env.NODE_ENV = previous; }
});

test("Production still refuses unrelated generic Development catalog discovery", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await expect(findProductDevelopment(owner, "olive oil")).rejects.toThrow(
      "Development product discovery is not available in Production",
    );
  } finally { process.env.NODE_ENV = previous; }
});

test("reports an offline comparison of the former broad scan and the targeted bounded lookup", async () => {
  const old = fixture({ readDelay: 20 }), integrated = fixture({ readDelay: 20 });
  for (const f of [old, integrated]) {
    for (let index = 3; index < 9; index++) f.records.push({
      ...clone(f.records[index % 3]), sourceRecordId: `extra-${index}`,
      variant: `Olive Oil package ${index}`, barcode: `012345678900${index}`,
    });
  }
  const started = performance.now();
  await findProductDevelopment(owner, ingredient.originalName, {
    sources: old.sources, adapter: old.adapter, shoppingIngredient: ingredient,
  });
  const broadScanMs = performance.now() - started;
  const result = await integrated.run();
  expect(old.adapter.read).toHaveBeenCalledTimes(9);
  expect(integrated.adapter.read).toHaveBeenCalledTimes(3);
  console.info("[Offline Shopping timing]", JSON.stringify({
    syntheticOnly: true, simulatedReadDelayMs: 20,
    broadScanMs: Math.round(broadScanMs), oldReads: 9,
    integrated: result.lookupTiming, integratedReads: 3, maxConcurrentReads: integrated.maxActive(),
  }));
});
