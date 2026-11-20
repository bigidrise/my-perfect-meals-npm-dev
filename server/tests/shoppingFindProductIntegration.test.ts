import { findShoppingProductRecommendationsDevelopment as lookup } from
  "../services/productDiscovery/findShoppingProductRecommendationsDevelopment";
import type { ProductSubjectSources } from "../services/productDiscovery/subjectAuthority";
import type { ProductEvidenceAdapter, SourceProductRecord } from "../services/productDiscovery/productEvidenceAdapters";
import type { IngredientScanResult } from "../services/ingredientScanService";
import { findProductDevelopment } from "../services/productDiscovery/findProductDevelopment";

const owner = "synthetic-shopping-member";
const ingredient = { originalName: "olive oil", requirements: [] };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const suggestion = (brand: string) => ({
  category: `${brand} Olive Oil`, whyBetter: [`${brand} personalized explanation, not source evidence`],
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

test("reuses one by-name recommendation, source evidence and the existing selection bridge", async () => {
  const f = fixture({ readDelay: 15 });
  const before = clone(f.records);
  const result = await f.run();
  expect(f.recommend).toHaveBeenCalledTimes(1);
  expect(f.recommend).toHaveBeenCalledWith("olive oil", owner);
  expect(f.adapter.search).toHaveBeenCalledWith(expect.objectContaining({
    requestedFood: "olive oil", searchCategories: expect.arrayContaining([
      expect.objectContaining({ category: "Synthetic Alpha Olive Oil" }),
    ]),
  }), null, 3);
  expect(f.sources.resolveFoodContext).toHaveBeenCalledTimes(2);
  expect(result.catalogMatches).toHaveLength(3);
  expect(result.catalogMatches.every(match => match.shoppingSelection?.eligible)).toBe(true);
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

test("recommendations and Add-style names never bypass unresolved profile policy", async () => {
  const result = await fixture({ avoided: ["synthetic-avoidance"] }).run();
  expect(result.catalogMatches).toHaveLength(3);
  expect(result.catalogMatches.every(match => !match.shoppingSelection?.eligible)).toBe(true);
  expect(result.catalogMatches[0].shoppingCaution).toContain("Reviewed checks aren't available");
  expect(result.recommendationNotice).toContain("could not be fully verified");
});

test("known conflicts remain excluded instead of being exposed as review-only suggestions", async () => {
  const result = await fixture({ avoided: ["synthetic-avoidance"],
    ingredients: "Olive oil, synthetic-avoidance" }).run();
  expect(result.catalogMatches).toEqual([]);
  expect(result.rejected).toBe(3);
  expect(result.excludedReasons[0]).toContain("explicitly avoided");
  expect(result.recommendationNotice).toContain("known conflict");
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
});

test.each(["missing_facts", "unverified_identity"])(
  "three eligible choices take priority before the display cap when other brands have %s",
  async gap => {
    const f = fixture();
    const eligible = [0, 1, 2].map(index => ({
      ...clone(f.records[0]), sourceRecordId: `eligible-${index}`, variant: `Olive Oil package ${index}`,
    }));
    const incomplete = [1, 2].map(index => {
      const record = clone(f.records[index]);
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

test("a failed recommendation stops before catalog requests rather than silently changing engines", async () => {
  const f = fixture();
  f.recommend.mockResolvedValueOnce({ ...analysis(), fallbackUsed: true });
  await expect(f.run()).rejects.toThrow("temporarily unavailable");
  expect(f.adapter.search).not.toHaveBeenCalled();
});

test("empty or duplicate recommendations do not trigger excessive generic searches", async () => {
  const f = fixture();
  f.recommend.mockResolvedValueOnce(analysis([]));
  const result = await f.run();
  expect(result.recommendationCount).toBe(0);
  expect(f.adapter.search).not.toHaveBeenCalled();
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
});

test("Production refuses the integration before recommendation generation", async () => {
  const previous = process.env.NODE_ENV;
  const f = fixture();
  process.env.NODE_ENV = "production";
  try {
    await expect(f.run()).rejects.toThrow("Development-only");
    expect(f.recommend).not.toHaveBeenCalled();
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
