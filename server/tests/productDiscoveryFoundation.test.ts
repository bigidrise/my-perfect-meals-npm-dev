import type { HumanFoodContext } from "../../shared/humanFoodContext";
import type { ProductSearchIntent } from "../../shared/productCandidateContract";
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";
import { resolveProductSubjectAuthority, type ProductSubjectSources } from
  "../services/productDiscovery/subjectAuthority";
import { resolveProductRulePolicy, type ProductRuleEvidenceRegistry } from
  "../services/productDiscovery/ruleEvidenceRegistry";
import { legacyBarcodeIdentityLead, normalizeProductEvidence, type ProductEvidenceAdapter, type SourceProductRecord } from
  "../services/productDiscovery/productEvidenceAdapters";
import { discoverProductCandidates, type ProductRuleAssessor } from
  "../services/productDiscovery/discoverProductCandidates";
import { findProductDevelopment } from "../services/productDiscovery/findProductDevelopment";
import { createUsdaBrandedAdapter } from "../services/productDiscovery/usdaBrandedAdapter";

const NOW = "2026-09-30T12:00:00.000Z";
const SUBJECT = { actorUserId: "owner", subjectUserId: "owner", subjectKind: "account" as const, dateISO: "2026-09-30" };
const INTENT: ProductSearchIntent = {
  requestedFood: "milk",
  purpose: "drink",
  searchCategories: [{ category: "milk", preservesPurpose: true, adaptationReasonRequirementIds: [] }],
};
const EMPTY_REVIEW: ProductRuleEvidenceRegistry = {
  version: "reviewed-v1", identityMaxAgeDays: 30, reviewedRules: [],
};
const AVOID_REVIEW: ProductRuleEvidenceRegistry = {
  ...EMPTY_REVIEW,
  reviewedRules: [{
    id: "explicit_avoidance:milk",
    type: "explicit_avoidance",
    authorityReference: "subject-owned explicit avoided food",
    evidenceNeeds: [{ kind: "ingredients", minimum: "approved_source_record", maxAgeDays: 30 }],
  }],
};
function sources(options: {
  diet?: string[];
  envelopeDiet?: string[];
  dislikes?: string[];
  avoided?: string[];
  hard?: string[];
  optimization?: string[];
  activeHousehold?: string | null;
  contextSubject?: string;
  requestDiet?: boolean;
  status?: "resolved" | "review_required";
  gaps?: string[];
  provider?: string[];
} = {}): ProductSubjectSources {
  const food = {
    actorUserId: "owner",
    subjectUserId: options.contextSubject ?? "owner",
    status: options.status ?? "resolved",
    internalFingerprint: "server-food-fingerprint",
    diet: {
      stored: options.diet ?? [],
      source: options.requestDiet ? "request" : "profile",
    },
    safety: {
      allergies: [], avoidedFoods: options.avoided ?? [],
      dislikedFoods: options.dislikes ?? [], glp1MealAuthorityActive: false,
    },
    nutrition: null,
    gaps: options.gaps ?? [],
  } as unknown as HumanFoodContext;
  const envelope = {
    userId: "owner",
    dietaryIdentity: options.envelopeDiet ?? options.diet ?? [],
    allergies: [],
    medicalHardLimits: options.hard ?? [],
    medicalOptimization: options.optimization ?? [],
    preferences: [],
    providerInterventions: (options.provider ?? []).map((conditionKey) => ({ conditionKey })),
  } as unknown as UserProtocolEnvelope;
  return {
    resolveFoodContext: async () => food,
    loadEnvelope: async () => envelope,
    activeHouseholdProfileId: async () => options.activeHousehold ?? null,
  };
}
function record(overrides: Partial<SourceProductRecord> = {}): SourceProductRecord {
  return {
    source: "usda_branded",
    sourceRecordId: "record-1",
    observedAt: "2026-09-29T12:00:00.000Z",
    retrievedAt: NOW,
    name: "Unsweetened oat beverage",
    brand: "Example",
    variant: "Unsweetened 1L",
    barcode: "0123456789012",
    market: "US",
    exactVariantMatch: true,
    facts: [{ kind: "ingredients", originalStatement: "Oats, water", completeness: "complete" }],
    ...overrides,
  };
}
function adapter(records: SourceProductRecord[], pages?: number): ProductEvidenceAdapter {
  return {
    source: "usda_branded",
    search: async (_intent, cursor) => {
      const offset = Number(cursor ?? "0");
      const end = Math.min(offset + (pages ?? records.length), records.length);
      return {
        references: records.slice(offset, end).map((item) => ({
          source: "usda_branded" as const, sourceRecordId: item.sourceRecordId,
        })),
        nextCursor: end < records.length ? String(end) : null,
      };
    },
    read: async (reference) => records.find((item) => item.sourceRecordId === reference.sourceRecordId)!,
  };
}
const assessor = (outcome: "pass" | "conflict" | "unknown"): ProductRuleAssessor => ({
  assess: async ({ candidate }) => ({
    outcome,
    factIds: candidate.facts.map((fact) => fact.id),
    reason: outcome,
  }),
});
function discovery(options: {
  authority?: ProductSubjectSources;
  registry?: ProductRuleEvidenceRegistry;
  records?: SourceProductRecord[];
  assessor?: ProductRuleAssessor;
  maxCandidates?: number;
  maxPages?: number;
  targetCount?: number;
  adapter?: ProductEvidenceAdapter;
} = {}) {
  return discoverProductCandidates({
    subject: SUBJECT,
    intent: INTENT,
    sources: options.authority ?? sources(),
    registry: options.registry ?? EMPTY_REVIEW,
    adapters: [options.adapter ?? adapter(options.records ?? [record()])],
    assessor: options.assessor,
    evaluatedAt: NOW,
    maxCandidates: options.maxCandidates ?? 4,
    maxPages: options.maxPages ?? 4,
    targetCount: options.targetCount ?? 1,
  });
}

describe("Phase 2B internal authority and product evidence foundation", () => {
  test("separates soft dislikes from explicit hard avoidances", async () => {
    const subject = await resolveProductSubjectAuthority(
      SUBJECT, sources({ dislikes: ["mushroom"], avoided: ["milk"] }),
    );
    const policy = resolveProductRulePolicy(subject, AVOID_REVIEW, NOW);
    expect(policy.context.activeHardRestrictionIds).toEqual(["explicit_avoidance:milk"]);
    expect(policy.context.rankingFactors).toContainEqual({
      id: "dislike:mushroom", type: "dislike", weight: 1,
    });
  });
  test("does not let request-level diet replace stored identity", async () => {
    const subject = await resolveProductSubjectAuthority(
      SUBJECT, sources({ diet: ["vegan"], requestDiet: true }),
    );
    expect(subject.dietaryIdentity).toEqual(["vegan"]);
    expect(subject.status).toBe("unresolved");
  });
  test("fails closed when food context and envelope disagree on identity", async () => {
    const subject = await resolveProductSubjectAuthority(
      SUBJECT, sources({ diet: ["vegan"], envelopeDiet: ["omnivore"] }),
    );
    expect(subject.issues).toContain("subject_profile_sources_disagree");
  });
  test("implicit household selection never masquerades as account authority", async () => {
    const subject = await resolveProductSubjectAuthority(
      SUBJECT, sources({ activeHousehold: "household-1" }),
    );
    expect(subject.status).toBe("unresolved");
    expect(subject.issues).toContain("implicit_household_selection_requires_explicit_subject");
  });
  test("explicit household uses the household ID and owner-scoped envelope", async () => {
    const request = { ...SUBJECT, subjectUserId: "child", subjectKind: "household" as const };
    let received: typeof request | null = null;
    const mock = sources({ contextSubject: "child" });
    mock.loadEnvelope = async (input) => {
      received = input as typeof request;
      return { userId: "owner", dietaryIdentity: [], allergies: [],
        medicalHardLimits: [], medicalOptimization: [] } as unknown as UserProtocolEnvelope;
    };
    const result = await resolveProductSubjectAuthority(request, mock);
    expect(received).toMatchObject(request);
    expect(result.subjectId).toBe("child");
    expect(result.status).toBe("resolved");
  });
  test("mismatched subject identity throws instead of returning an empty policy", async () => {
    await expect(resolveProductSubjectAuthority(SUBJECT, sources({ contextSubject: "stranger" })))
      .rejects.toThrow("different actor or nutrition subject");
  });
  test("unauthorized subject access does not fall back to guest", async () => {
    const mock = sources();
    mock.resolveFoodContext = async () => { throw new Error("Not authorized"); };
    await expect(resolveProductSubjectAuthority(SUBJECT, mock)).rejects.toThrow("Not authorized");
  });
  test("clinical/nutrition resolution failures remain unresolved", async () => {
    const subject = await resolveProductSubjectAuthority(
      SUBJECT, sources({ status: "review_required", gaps: ["daily_nutrition_state"] }),
    );
    expect(subject.issues).toContain("authoritative_nutrition_or_glucose_unavailable");
    expect(resolveProductRulePolicy(subject, EMPTY_REVIEW, NOW).context.policyStatus).toBe("unresolved");
  });
  test("unreviewed allergy, pregnancy, and alpha-gal requirements cannot vanish", async () => {
    const subject = await resolveProductSubjectAuthority(SUBJECT, sources());
    const policy = resolveProductRulePolicy({
      ...subject, allergies: ["peanut"], pregnancyActive: true, alphaGalActive: true,
    }, EMPTY_REVIEW, NOW);
    expect(policy.unresolved.filter((item) => item.classification === "hard").map((item) => item.id))
      .toEqual(["allergy:peanut", "alpha_gal:active", "pregnancy:active"]);
    expect(policy.context.policyStatus).toBe("unresolved");
  });
  test("condition name does not generate a numeric threshold", async () => {
    const subject = await resolveProductSubjectAuthority(
      SUBJECT, sources({ hard: ["cardiac"], optimization: ["heart support"] }),
    );
    const policy = resolveProductRulePolicy(subject, EMPTY_REVIEW, NOW);
    expect(policy.unresolved).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "clinical:cardiac", classification: "hard" }),
      expect.objectContaining({ id: "support:heart support", classification: "support_context" }),
    ]));
    expect(policy.context.hardRequirements).toEqual([]);
  });
  test("heart-support optimization alone is not a hard product ban", async () => {
    const subject = await resolveProductSubjectAuthority(
      SUBJECT, sources({ optimization: ["heart support"] }),
    );
    expect(resolveProductRulePolicy(subject, EMPTY_REVIEW, NOW).context.policyStatus).toBe("resolved");
  });
  test("provider prompt intervention is not presumed a reviewed product directive", async () => {
    const subject = await resolveProductSubjectAuthority(
      SUBJECT, sources({ provider: ["renal"] }),
    );
    expect(resolveProductRulePolicy(subject, EMPTY_REVIEW, NOW).unresolved)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "provider_intervention:renal", classification: "hard" }),
      ]));
  });
  test("a clinical evidence template cannot promote a diagnosis or provider prompt into authority", async () => {
    const subject = await resolveProductSubjectAuthority(
      SUBJECT, sources({ hard: ["cardiac"], provider: ["renal"] }),
    );
    const policy = resolveProductRulePolicy(subject, {
      ...EMPTY_REVIEW,
      reviewedRules: [
        { id: "clinical:cardiac", type: "clinical", authorityReference: "unreviewed condition name",
          evidenceNeeds: [{ kind: "nutrition", target: "sodium_mg_per_serving",
            minimum: "approved_source_record", maxAgeDays: 30 }] },
        { id: "provider_intervention:renal", type: "clinical", authorityReference: "legacy prompt",
          evidenceNeeds: [{ kind: "ingredients", minimum: "approved_source_record", maxAgeDays: 30 }] },
      ],
    }, NOW);
    expect(policy.context.hardRequirements).toHaveLength(0);
    expect(policy.context.policyStatus).toBe("unresolved");
    expect(policy.unresolved.filter((item) => item.classification === "hard")).toHaveLength(2);
  });
  test("missing reviewed identity freshness never becomes an infinite allowance", async () => {
    const result = await discovery({ registry: { ...EMPTY_REVIEW, identityMaxAgeDays: null } });
    expect(result.status).toBe("authority_unresolved");
    expect(result.inspectedCount).toBe(0);
  });
  test("unreviewed hard restrictions stop discovery before reading catalog records", async () => {
    const result = await discovery({ authority: sources({ avoided: ["milk"] }) });
    expect(result.status).toBe("authority_unresolved");
    expect(result.inspectedCount).toBe(0);
  });
  test("record retains exact variant, market, provenance, and original declaration", () => {
    const product = normalizeProductEvidence(record());
    expect(product.identity).toMatchObject({
      match: "exact_variant", market: "US", barcode: "0123456789012",
    });
    expect(product.facts[0]).toMatchObject({
      statement: "Oats, water",
      provenance: { sourceRecordId: "record-1", observedAt: "2026-09-29T12:00:00.000Z" },
    });
  });
  test("unknown source observation is not backfilled with retrieval time", () => {
    const product = normalizeProductEvidence(record({ observedAt: null }));
    expect(product.identity.provenance.observedAt).toBe("");
  });
  test.each([
    { variant: "" },
    { market: undefined },
    { barcode: undefined },
    { exactVariantMatch: false },
  ])("ambiguous catalog identity is not exact: %p", (override) => {
    expect(normalizeProductEvidence(record(override)).identity.match).toBe("uncertain");
  });
  test("AI and user assertions are not approved evidence sources", () => {
    expect(() => normalizeProductEvidence(record({
      source: "model_suggestion" as SourceProductRecord["source"],
    }))).toThrow("server-owned source");
  });
  test("legacy barcode verified flag only supplies a search lead, never product facts", () => {
    expect(legacyBarcodeIdentityLead({
      barcode: "0123456789012", name: "Example milk",
      brand: "Example", verified: true,
    })).toEqual({
      barcode: "0123456789012", name: "Example milk",
      brand: "Example", evidenceStatus: "identity_lead_only",
    });
  });
  test("per-100g numbers cannot be mislabeled as per-serving", () => {
    expect(() => normalizeProductEvidence(record({ facts: [{
      kind: "nutrition", target: "sodium_mg_per_serving",
      originalStatement: "Sodium 200mg per 100g", completeness: "complete",
      nutritionMeasurement: { value: 200, unit: "mg", basis: "per_100g" },
    }] }))).toThrow("serving basis");
  });
  test("missing real serving size cannot substantiate per-serving nutrition", () => {
    expect(() => normalizeProductEvidence(record({ facts: [{
      kind: "nutrition", target: "carbs_g_per_serving",
      originalStatement: "Carbs 7g", completeness: "complete",
      nutritionMeasurement: { value: 7, unit: "g", basis: "per_serving" },
    }] }))).toThrow("measurement basis");
  });
  test("unknown validator cannot qualify a candidate with a reviewed hard rule", async () => {
    const result = await discovery({
      authority: sources({ avoided: ["milk"] }),
      registry: AVOID_REVIEW,
    });
    expect(result.qualified).toHaveLength(0);
    expect(result.needsVerification).toHaveLength(1);
  });
  test("trusted positive assessment can qualify matching complete evidence", async () => {
    const result = await discovery({
      authority: sources({ avoided: ["milk"] }),
      registry: AVOID_REVIEW, assessor: assessor("pass"),
    });
    expect(result.qualified).toHaveLength(1);
    expect(result.status).toBe("complete");
  });
  test("positive conflict rejects only that candidate and continues", async () => {
    const result = await discovery({
      authority: sources({ avoided: ["milk"] }),
      registry: AVOID_REVIEW,
      records: [record(), record({ sourceRecordId: "record-2" })],
      assessor: { assess: async ({ candidate }) => ({
        outcome: candidate.identity.provenance.sourceRecordId === "record-1" ? "conflict" : "pass",
        factIds: candidate.facts.map((fact) => fact.id), reason: "rule-specific result",
      }) },
    });
    expect(result.rejectedCount).toBe(1);
    expect(result.qualified).toHaveLength(1);
    expect(result.inspectedCount).toBe(2);
  });
  test("missing evidence continues to another variant without qualifying the first", async () => {
    const result = await discovery({
      authority: sources({ avoided: ["milk"] }),
      registry: AVOID_REVIEW,
      records: [record({ facts: [] }), record({ sourceRecordId: "record-2" })],
      assessor: assessor("pass"),
    });
    expect(result.needsVerification).toHaveLength(1);
    expect(result.qualified).toHaveLength(1);
  });
  test("search budget stops at maxCandidates even when results are inconclusive", async () => {
    const result = await discovery({
      records: [record({ sourceRecordId: "a", observedAt: null }),
        record({ sourceRecordId: "b", observedAt: null }),
        record({ sourceRecordId: "c" })],
      maxCandidates: 2,
    });
    expect(result.status).toBe("search_exhausted");
    expect(result.inspectedCount).toBe(2);
    expect(result.qualified).toHaveLength(0);
  });
  test("search stops at page budget", async () => {
    const result = await discovery({
      records: [record({ sourceRecordId: "a", observedAt: null }),
        record({ sourceRecordId: "b" })],
      adapter: adapter([record({ sourceRecordId: "a", observedAt: null }),
        record({ sourceRecordId: "b" })], 1),
      maxPages: 1,
    });
    expect(result.inspectedCount).toBe(1);
    expect(result.status).toBe("search_exhausted");
  });
  test("provider cannot return an unrelated record", async () => {
    const faulty: ProductEvidenceAdapter = {
      source: "usda_branded",
      search: async () => ({ references: [{ source: "usda_branded", sourceRecordId: "one" }], nextCursor: null }),
      read: async () => record({ sourceRecordId: "two" }),
    };
    await expect(discovery({ adapter: faulty })).rejects.toThrow("different source record");
  });
  test("an unavailable source record is reported and does not stop the next candidate", async () => {
    const provider = adapter([record({ sourceRecordId: "missing" }),
      record({ sourceRecordId: "available" })]);
    const originalRead = provider.read;
    provider.read = async (reference) => {
      if (reference.sourceRecordId === "missing") throw new Error("fetch failed");
      return originalRead(reference);
    };
    const result = await discovery({ adapter: provider });
    expect(result.sourceFailures).toEqual([{
      source: "usda_branded", sourceRecordId: "missing",
      reason: "Exact source product record could not be retrieved.",
    }]);
    expect(result.qualified).toHaveLength(1);
    expect(result.inspectedCount).toBe(2);
  });
  test("source search failure is explicit rather than an empty successful result", async () => {
    const provider = adapter([]);
    provider.search = async () => { throw new Error("catalog unavailable"); };
    const result = await discovery({ adapter: provider });
    expect(result.qualified).toHaveLength(0);
    expect(result.sourceFailures).toEqual([{
      source: "usda_branded", reason: "Product source search was unavailable.",
    }]);
  });
  test("bad identity cannot be made eligible even without hard requirements", async () => {
    const result = await discovery({ records: [record({ market: undefined })] });
    expect(result.qualified).toHaveLength(0);
    expect(result.needsVerification[0].reasons[0].code).toBe("identity_unverified");
  });
  test("support-only context may search, without inventing a clinical cutoff", async () => {
    const result = await discovery({ authority: sources({ optimization: ["heart support"] }) });
    expect(result.status).toBe("complete");
    expect(result.unresolved).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "support:heart support" }),
    ]));
  });
  test("Development milk search yields real-source leads, never verified recommendations", async () => {
    const result = await findProductDevelopment("owner", "milk", {
      sources: sources(),
      adapter: adapter([record({ name: "Whole Milk", facts: [{
        kind: "ingredients", originalStatement: "Milk, vitamin D", completeness: "unknown",
      }] })]),
    });
    expect(result.catalogMatches).toHaveLength(1);
    expect(result.catalogMatches[0]).toMatchObject({
      name: "Whole Milk", source: "USDA FoodData Central",
      evidenceStatus: "needs_verification",
    });
    expect(result.unresolved).toContain("identity:freshness");
  });
  test("vegan milk intent searches a functional alternative and skips a known dairy conflict", async () => {
    const foods = [
      record({ name: "Dairy milk", facts: [{
        kind: "ingredients", originalStatement: "MILK, VITAMIN D3",
        completeness: "unknown",
      }] }),
      record({
        sourceRecordId: "oat-1", name: "Oat beverage", variant: "Unsweetened oat beverage",
        facts: [{ kind: "ingredients", originalStatement: "Water, oats, sea salt", completeness: "unknown" }],
      }),
    ];
    let categories: string[] = [];
    const provider = adapter(foods);
    const originalSearch = provider.search;
    provider.search = async (intent, cursor, limit) => {
      categories = intent.searchCategories.map((item) => item.category);
      return originalSearch(intent, cursor, limit);
    };
    const result = await findProductDevelopment("owner", "milk", {
      sources: sources({ diet: ["vegan"] }), adapter: provider,
    });
    expect(categories).toContain("oat milk");
    expect(result.rejected).toBe(1);
    expect(result.catalogMatches.map((item) => item.name)).toEqual(["Oat beverage"]);
    expect(result.catalogMatches[0].evidenceStatus).toBe("needs_verification");
  });
  test("missing ingredients are shown as unverified rather than fabricated", async () => {
    const result = await findProductDevelopment("owner", "milk", {
      sources: sources(), adapter: adapter([record({ facts: [] })]),
    });
    expect(result.catalogMatches).toHaveLength(1);
    expect(result.catalogMatches[0].ingredients).toBeNull();
    expect(result.catalogMatches[0].evidenceStatus).toBe("needs_verification");
  });
  test("active subject ambiguity prevents catalog search even in lead mode", async () => {
    const provider = adapter([record()]);
    provider.search = async () => { throw new Error("Must not search"); };
    await expect(findProductDevelopment("owner", "milk", {
      sources: sources({ activeHousehold: "child" }), adapter: provider,
    })).rejects.toThrow("subject context is unavailable");
  });
  test("USDA adapter preserves GTIN, date, ingredients, nutrients and original serving", async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      json: async () => ({ foods: [{
        fdcId: 555,
        description: "Oat milk", brandName: "Real Brand", gtinUpc: "1234567890123",
        foodCategory: "Plant Based Milk",
        marketCountry: "United States", packageWeight: "1 L",
        ingredients: "Water, oats", publishedDate: "2025-01-01",
        householdServingFullText: "1 cup", servingSize: 240, servingSizeUnit: "ml",
        foodNutrients: [{ nutrientId: 1005, nutrientName: "Carbohydrate, by difference",
          unitName: "G", value: 6 }],
      }] }),
    })) as unknown as typeof fetch;
    const provider = createUsdaBrandedAdapter(fetcher);
    const page = await provider.search(INTENT, null, 8);
    const normalized = normalizeProductEvidence(await provider.read(page.references[0]));
    expect(normalized.identity).toMatchObject({
      barcode: "1234567890123", servingDescription: "1 cup · 240 ml",
      provenance: { observedAt: "2025-01-01", sourceRecordId: "555" },
    });
    expect(normalized.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ statement: "Water, oats", completeness: "unknown" }),
      expect.objectContaining({ target: "carbs_g_per_100g",
        nutritionMeasurement: { value: 6, unit: "g", basis: "per_100g" } }),
    ]));
  });
  test("drink discovery excludes chocolate and frozen dessert catalog hits", async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      json: async () => ({ foods: [
        { fdcId: 1, description: "Oat milk chocolate", foodCategory: "Chocolate" },
        { fdcId: 2, description: "Plain oat milk", foodCategory: "Plant Based Milk" },
      ] }),
    })) as unknown as typeof fetch;
    const provider = createUsdaBrandedAdapter(fetcher);
    const page = await provider.search(INTENT, null, 8);
    expect(page.references.map((item) => item.sourceRecordId)).toEqual(["2"]);
  });
});