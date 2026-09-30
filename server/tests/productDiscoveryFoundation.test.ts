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
import { createOpenFoodFactsSearchAdapter } from "../services/productDiscovery/openFoodFactsSearchAdapter";
import { lookupOpenFoodFactsByBarcode, offEvidenceForExactUsdaProduct } from
  "../services/productDiscovery/openFoodFactsLookup";

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
  allergies?: string[];
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
      allergies: options.allergies ?? [], avoidedFoods: options.avoided ?? [],
      dislikedFoods: options.dislikes ?? [], glp1MealAuthorityActive: false,
    },
    nutrition: null,
    gaps: options.gaps ?? [],
  } as unknown as HumanFoodContext;
  const envelope = {
    userId: "owner",
    dietaryIdentity: options.envelopeDiet ?? options.diet ?? [],
    allergies: options.allergies ?? [],
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
  test("fresh exact barcode identity does not make old or unknown ingredient facts fresh", () => {
    const product = normalizeProductEvidence(record({
      observedAt: null, identityObservedAt: new Date().toISOString(),
    }));
    expect(product.identity.provenance.observedAt).not.toBe("");
    expect(product.facts[0].provenance.observedAt).toBe("");
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
  test("Development milk search does not approve an old catalog identity", async () => {
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
    expect(result.catalogMatches[0].verificationMessage).toContain("Exact, current product and variant identity is unavailable.");
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
    })).rejects.toThrow("current food profile could not be resolved");
  });
  test("Development decision handoff recommends exact sourced ordinary products and continues past missing facts", async () => {
    const fresh = new Date().toISOString();
    const result = await findProductDevelopment("owner", "rice", {
      sources: sources(),
      adapter: adapter([
        record({ sourceRecordId: "incomplete", observedAt: null,
          identityObservedAt: fresh, facts: [] }),
        record({ sourceRecordId: "complete", observedAt: null,
          identityObservedAt: fresh, name: "Brown rice", facts: [
            { kind: "ingredients", originalStatement: "Brown rice", completeness: "unknown" },
            { kind: "nutrition", target: "carbs_g_per_100g",
              originalStatement: "Carbohydrates: 78 g per 100g", completeness: "unknown",
              nutritionMeasurement: { value: 78, unit: "g", basis: "per_100g" } },
          ] }),
      ]),
    });
    expect(result.catalogMatches.map((match) => match.evidenceStatus))
      .toEqual(["eligible", "needs_verification"]);
    expect(result.catalogMatches[0].verificationMessage)
      .toContain("no unresolved hard product rule");
    expect(result.catalogMatches[1].verificationMessage)
      .toContain("missing ingredients and nutrition");
    expect(result.catalogMatches[1].needsProfileReview).toBe(false);
  });
  test("a fresh context fingerprint on the second healthy profile read does not abort discovery", async () => {
    const changing = sources();
    const original = changing.resolveFoodContext;
    let reads = 0;
    changing.resolveFoodContext = async (request) => ({
      ...await original(request), internalFingerprint: `generation-${++reads}`,
    });
    const interpret = jest.fn(async (_actor, subject, _candidate, decision) => {
      expect(subject.fingerprint).toBe(decision.contextFingerprint);
      return "Same resolved subject used for the decision.";
    });
    const result = await findProductDevelopment("owner", "peanut butter", {
      sources: changing,
      adapter: adapter([record({
        observedAt: null, identityObservedAt: new Date().toISOString(),
        facts: [
          { kind: "ingredients", originalStatement: "Peanuts", completeness: "unknown" },
          { kind: "nutrition", target: "fat_g_per_100g",
            originalStatement: "Fat: 48 g per 100g", completeness: "unknown",
            nutritionMeasurement: { value: 48, unit: "g", basis: "per_100g" } },
        ],
      })]),
      interpret,
    });
    expect(reads).toBe(2);
    expect(result.catalogMatches[0].evidenceStatus).toBe("eligible");
    expect(interpret).toHaveBeenCalledTimes(1);
  });
  test("Development presents distinct brands before same-brand flavors, without approving hard rules", async () => {
    const fresh = new Date().toISOString();
    const product = (id: string, brand: string, name: string, carbs = 18) => record({
      sourceRecordId: id, barcode: `0000000000${id.padStart(3, "0")}`,
      identityObservedAt: fresh, observedAt: null, brand, name,
      facts: [
        { kind: "ingredients", originalStatement: "Peanuts, salt", completeness: "unknown" },
        { kind: "nutrition", target: "carbs_g_per_100g",
          originalStatement: `Carbohydrates: ${carbs} g per 100g`, completeness: "unknown",
          nutritionMeasurement: { value: carbs, unit: "g", basis: "per_100g" } },
      ],
    });
    const result = await findProductDevelopment("owner", "peanut butter", {
      sources: sources({ diet: ["low_carb"], allergies: ["shellfish"] }),
      adapter: adapter([
        product("1", "Peanut Butter & Co", "Peanut Butter", 35),
        product("2", "Peanut Butter & Co.", "Unsweetened Peanut Butter", 9),
        product("3", "Peanut Butter & Co Inc.", "Cinnamon Swirl Peanut Butter", 20),
        product("4", "Creamy peanut butter", "Creamy peanut butter"),
        product("5", "Pic's", "Crunchy Peanut Butter"),
        product("6", "Smucker's", "Natural Peanut Butter"),
      ]),
    });
    expect(result.catalogMatches.map(({ brand }) => brand))
      .toEqual(["Peanut Butter & Co.", "Pic's", "Smucker's"]);
    expect(result.catalogMatches[0].name).toBe("Unsweetened Peanut Butter");
    expect(result.catalogMatches.every(({ evidenceStatus, needsProfileReview, policyUnresolved, profileInsight }) =>
      evidenceStatus === "needs_verification" && !needsProfileReview && policyUnresolved &&
      profileInsight?.includes("not an allergen or product-policy clearance"))).toBe(true);
    expect(result.unresolved).not.toContain("dietary_identity:low_carb");
  });
  test("Product Scan's profile factor labels come from the same resolved subject used for the choices", async () => {
    const context = sources();
    const load = context.loadEnvelope;
    context.loadEnvelope = async (request) => ({
      ...(await load(request))!, goalType: "lose", conditionGuidanceBlocks: [],
    });
    const result = await findProductDevelopment("owner", "rice", {
      sources: context,
      adapter: adapter([record({
        observedAt: null, identityObservedAt: new Date().toISOString(),
        facts: [
          { kind: "ingredients", originalStatement: "Brown rice", completeness: "unknown" },
          { kind: "nutrition", target: "carbs_g_per_100g",
            originalStatement: "Carbohydrates: 76 g per 100g", completeness: "unknown",
            nutritionMeasurement: { value: 76, unit: "g", basis: "per_100g" } },
        ],
      })]),
    });
    expect(result.profileUsed).toContain("Weight-loss goal");
    expect(result.catalogMatches[0].profileInsight).toContain("your weight-loss goal");
  });
  test("Development treats low-carb as day-level fit, not a hard packaged-product ban", async () => {
    const result = await findProductDevelopment("owner", "peanut butter", {
      sources: sources({ diet: ["low_carb"] }),
      adapter: adapter([record({
        name: "Unsweetened Peanut Butter", identityObservedAt: new Date().toISOString(),
        observedAt: null, facts: [
          { kind: "ingredients", originalStatement: "Peanuts, salt", completeness: "unknown" },
          { kind: "nutrition", target: "carbs_g_per_100g",
            originalStatement: "Carbohydrates: 11 g per 100g", completeness: "unknown",
            nutritionMeasurement: { value: 11, unit: "g", basis: "per_100g" } },
        ],
      })]),
      interpret: async () => null,
    });
    expect(result.unresolved).not.toContain("dietary_identity:low_carb");
    expect(result.catalogMatches[0]).toMatchObject({
      evidenceStatus: "eligible", needsProfileReview: false, policyUnresolved: false,
    });
    expect(result.catalogMatches[0].profileInsight).toContain("Serving and today's meals still determine low-carb fit");
    expect(result.catalogMatches[0].verificationMessage).toContain("not a guarantee about today's package");
  });
  test("Development can search a second OFF page for distinct branded choices", async () => {
    const fetcher = jest.fn(async (url: URL) => ({
      ok: true, status: 200,
      json: async () => ({ hits: [{
        code: url.searchParams.get("page") === "2" ? "1234567890123" : "0001234567890",
        product_name: "Peanut Butter",
        brands: url.searchParams.get("page") === "2" ? "Second Brand" : "First Brand",
        countries_tags: ["en:united-states"],
      }] }),
    })) as unknown as typeof fetch;
    const provider = createOpenFoodFactsSearchAdapter(fetcher, 2);
    const intent = { requestedFood: "peanut butter", purpose: "unknown" as const,
      searchCategories: [{ category: "peanut butter", preservesPurpose: true,
        adaptationReasonRequirementIds: [] }] };
    const first = await provider.search(intent, null, 25);
    const second = await provider.search(intent, first.nextCursor, 25);
    expect(first.nextCursor).toBe("2:0");
    expect(second.nextCursor).toBeNull();
    expect(first.references[0].sourceRecordId).not.toBe(second.references[0].sourceRecordId);
    expect(String(fetcher.mock.calls[1][0])).toContain("page=2");
  });
  test("a chocolate bar named Dairy Milk is not a milk drink choice", async () => {
    const fetcher = jest.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ hits: [
        { code: "1234567890123", product_name: "Dairy Milk", brands: "Cadbury",
          countries_tags: ["en:united-states"], categories_tags: ["en:chocolates"] },
        { code: "0001234567890", product_name: "2% Milk", brands: "Hollandia",
          countries_tags: ["en:united-states"], categories_tags: ["en:milks"] },
      ] }),
    })) as unknown as typeof fetch;
    const provider = createOpenFoodFactsSearchAdapter(fetcher, 1, 8);
    const page = await provider.search({ requestedFood: "milk", purpose: "drink",
      searchCategories: [{ category: "milk", preservesPurpose: true,
        adaptationReasonRequirementIds: [] }] }, null, 25);
    expect(page.references.map((reference) => reference.sourceRecordId)).toEqual(["0001234567890"]);
  });
  test("an exact Open Food Facts barcode record can be recommended for an ordinary profile", async () => {
    const fetcher = jest.fn(async (url: URL) => ({
      ok: true, status: 200,
      json: async () => String(url).includes("search.openfoodfacts.org")
        ? { hits: [{
          code: "1234567890123", product_name: "Brown Rice", brands: "Field",
          countries_tags: ["en:united-states"], quantity: "1 kg",
        }] }
        : { status: 1, code: "1234567890123", product: {
          product_name: "Brown Rice", brands: "Field", quantity: "1 kg",
          countries_tags: ["en:united-states"], ingredients_text: "Brown rice",
          nutrition_data_per: "100g", nutriments: { carbohydrates_100g: 78 },
        } },
    })) as unknown as typeof fetch;
    const provider = createOpenFoodFactsSearchAdapter(fetcher);
    const result = await findProductDevelopment("owner", "rice", {
      sources: sources(), adapter: provider,
    });
    expect(result.catalogMatches).toHaveLength(1);
    expect(result.catalogMatches[0]).toMatchObject({
      name: "Brown Rice", source: "Open Food Facts", evidenceStatus: "eligible",
      barcode: "1234567890123", ingredients: "Brown rice",
    });
    expect(result.catalogMatches[0].nutrition.length).toBeGreaterThan(0);
    expect(fetcher).toHaveBeenCalledTimes(2); // search lead and exact barcode record
  });
  test("a hard ingredient conflict disappears and low-carb review never gets conflicting AI praise", async () => {
    const fresh = new Date().toISOString();
    const interpret = jest.fn(async () => "Carbohydrates fuel recovery.");
    const result = await findProductDevelopment("owner", "pasta", {
      sources: sources({ diet: ["low_carb"], avoided: ["shellfish"],
        optimization: ["performance"] }),
      adapter: adapter([
        record({ sourceRecordId: "conflict", identityObservedAt: fresh,
          facts: [{ kind: "ingredients", originalStatement: "Wheat, shellfish",
            completeness: "unknown" }] }),
        record({ sourceRecordId: "review", identityObservedAt: fresh,
          name: "Wheat pasta", facts: [
            { kind: "ingredients", originalStatement: "Wheat semolina", completeness: "unknown" },
            { kind: "nutrition", target: "carbs_g_per_100g",
              originalStatement: "Carbohydrates: 70 g per 100g", completeness: "unknown",
              nutritionMeasurement: { value: 70, unit: "g", basis: "per_100g" } },
          ] }),
      ]),
      interpret,
    });
    expect(result.rejected).toBe(1);
    expect(result.excludedReasons).toEqual([
      "Ingredient declaration contains an explicitly avoided food: shellfish.",
    ]);
    expect(result.catalogMatches).toHaveLength(1);
    expect(result.catalogMatches[0]).toMatchObject({
      name: "Wheat pasta", evidenceStatus: "needs_verification",
      needsProfileReview: false, policyUnresolved: true,
    });
    expect(result.catalogMatches[0].verificationMessage)
      .not.toContain("dietary_identity:low_carb");
    expect(result.catalogMatches[0].verificationMessage).toContain("explicit_avoidance:shellfish");
    expect(result.catalogMatches[0].profileInsight).toContain("For your low-carb pattern");
    expect(result.catalogMatches[0].profileInsight).toContain("not an allergen or product-policy clearance");
    expect(interpret).not.toHaveBeenCalled();
  });
  test("a declared shellfish trace excludes the exact product for a shellfish allergy", async () => {
    const result = await findProductDevelopment("owner", "pasta", {
      sources: sources({ allergies: ["shellfish"] }),
      adapter: adapter([
        record({ sourceRecordId: "trace", identityObservedAt: new Date().toISOString(),
          facts: [
            { kind: "ingredients", originalStatement: "Wheat semolina", completeness: "unknown" },
            { kind: "precautionary_allergens", target: "shellfish",
              originalStatement: "May contain shellfish", completeness: "partial",
              precautionaryStatus: "declared_present" },
          ] }),
        record({ sourceRecordId: "next", name: "Other pasta",
          facts: [{ kind: "ingredients", originalStatement: "Wheat semolina",
            completeness: "unknown" }] }),
      ]),
    });
    expect(result.rejected).toBe(1);
    expect(result.excludedReasons).toContain("Ingredient declaration conflicts with an allergy or intolerance.");
    expect(result.catalogMatches.map((item) => item.name)).toEqual(["Other pasta"]);
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
  test("exact USDA detail and same-GTIN OFF evidence keep independent provenance", async () => {
    const food = {
      fdcId: 2078244, description: "MILK", brandName: "WINN-DIXIE",
      gtinUpc: "02114029705", marketCountry: "United States",
      packageWeight: "1 GAL/3.78 L", foodCategory: "Milk",
      publishedDate: "2021-10-28", ingredients: "MILK, VITAMIN D3.",
      servingSize: 240, servingSizeUnit: "ml",
      foodNutrients: [{ nutrientId: 1005, nutrientName: "Carbohydrate, by difference",
        unitName: "G", value: 4.58 }],
    };
    const fetcher = jest.fn(async (url: URL) => {
      const path = new URL(String(url)).pathname;
      const value = path.endsWith("/foods/search")
        ? { foods: [food] }
        : path.endsWith("/food/2078244")
          ? { fdcId: food.fdcId, gtinUpc: food.gtinUpc,
            ingredients: food.ingredients, foodNutrients: [
              { nutrient: { id: 1005, name: "Carbohydrate, by difference",
                unitName: "G" }, amount: 4.58 },
            ] }
          : { status: 1, code: "0002114029705", product: {
            code: "0002114029705", brands: "Winn Dixie", product_name: "Milk",
            countries_tags: ["en:united-states"], quantity: "1 gal",
            ingredients_text: "Milk, vitamin D3.",
            allergens_tags: ["en:milk"], traces_tags: [],
            nutrition_data_per: "100ml",
            nutriments: { carbohydrates_100ml: 4.58 },
          } };
      return { ok: true, status: 200, json: async () => value };
    }) as unknown as typeof fetch;
    const provider = createUsdaBrandedAdapter(fetcher);
    const page = await provider.search(INTENT, null, 8);
    const initial = await provider.read(page.references[0]);
    const enriched = await provider.enrich!(page.references[0], initial);
    const candidate = normalizeProductEvidence(enriched);
    expect(enriched.research).toEqual([
      { source: "usda_branded", result: "matched", phase: "search" },
      { source: "usda_branded", result: "matched", phase: "detail" },
      { source: "open_food_facts", result: "matched", phase: "barcode_lookup" },
    ]);
    expect(candidate.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "nutrition", target: "carbs_g_per_100g",
        provenance: expect.objectContaining({ source: "usda_branded" }) }),
      expect.objectContaining({ kind: "nutrition", target: "carbs_g_per_100ml",
        provenance: expect.objectContaining({
          source: "open_food_facts", observedAt: "", barcode: "0002114029705",
          identityKey: candidate.identity.key,
        }) }),
    ]));
  });
  test("OFF rejects different variant and conflicting ingredients despite a matching barcode", () => {
    const original = record({
      name: "Ragu Marinara Sauce", brand: "Ragu", barcode: "123456789012",
      market: "United States", packageSize: "24 oz",
      facts: [{ kind: "ingredients", originalStatement: "Tomato, salt",
        completeness: "unknown" }],
    });
    const sameCode = { status: "matched" as const, barcode: "00123456789012",
      product: { brands: "Ragu", product_name: "Marinara Sauce",
        countries_tags: ["en:united-states"], quantity: "24 oz",
        ingredients_text: "Tomato, sugar, salt" } };
    expect(offEvidenceForExactUsdaProduct(sameCode, original, NOW).result)
      .toBe("evidence_conflict");
    expect(offEvidenceForExactUsdaProduct({ ...sameCode, product: {
      ...sameCode.product, quantity: "48 oz",
    } }, original, NOW).result).toBe("identity_mismatch");
    expect(offEvidenceForExactUsdaProduct({ ...sameCode, barcode: "123456789013" },
      original, NOW).facts).toHaveLength(0);
  });
  test("identifiable Ragu sauce retains declared soy evidence, not a clean-label assertion", () => {
    const ragu = record({
      name: "Ragu Old World Style Marinara Sauce", brand: "Ragu",
      barcode: "036200004005", market: "United States",
      facts: [{ kind: "ingredients", completeness: "unknown",
        originalStatement: "Tomato puree (water, tomato paste), tomatoes in puree (tomatoes, tomato puree, calcium chloride, citric acid), soybean oil, extra virgin olive oil, salt, sugar, dehydrated onions, spices, natural flavors." }],
    });
    const off = offEvidenceForExactUsdaProduct({
      status: "matched", barcode: "0036200004005", product: {
        product_name: "Old World Style Marinara Sauce", brands: "RAGÚ",
        countries_tags: ["en:united-states", "en:world"],
        ingredients_text: ragu.facts[0].originalStatement,
        allergens_tags: ["en:soybeans"], traces_tags: [],
      },
    }, ragu, NOW);
    expect(off.result).toBe("matched");
    expect(off.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "declared_allergens",
        originalStatement: "Catalog declared allergens: en:soybeans",
        supplementalProvenance: expect.objectContaining({
          source: "open_food_facts", barcode: "0036200004005", observedAt: null,
        }) }),
    ]));
    expect(off.facts.some((fact) => fact.kind === "precautionary_allergens")).toBe(false);
  });
  test("OFF unavailable is explicit, not fabricated as a clean label", async () => {
    const lookup = await lookupOpenFoodFactsByBarcode("02114029705",
      (async () => ({ ok: false, status: 503 })) as typeof fetch);
    expect(lookup.status).toBe("unavailable");
    expect(offEvidenceForExactUsdaProduct(lookup, record(), NOW)).toEqual({
      result: "unavailable", facts: [],
    });
  });
  test("sauce avoidances discard a candidate before research, then research the next", async () => {
    const first = record({ name: "Ragu Sauce", sourceRecordId: "ragu-1",
      facts: [{ kind: "ingredients", originalStatement: "Tomato, sugar, salt",
        completeness: "unknown" }] });
    const second = record({ name: "Ragu Unsweetened Sauce", sourceRecordId: "ragu-2",
      facts: [{ kind: "ingredients", originalStatement: "Tomato, olive oil, salt",
        completeness: "unknown" }] });
    const provider = adapter([first, second]);
    const enrich = jest.fn(async (_reference, original: SourceProductRecord) => ({
      ...original, research: [{ source: "usda_branded" as const, result: "matched" as const }],
    }));
    provider.enrich = enrich;
    const result = await findProductDevelopment("owner", "pasta sauce", {
      sources: sources({ avoided: ["sugar"] }), adapter: provider,
      interpret: async () => "Catalog ingredients show tomato and olive oil.",
    });
    expect(result.rejected).toBe(1);
    expect(enrich).toHaveBeenCalledTimes(1);
    expect(enrich.mock.calls[0][1].sourceRecordId).toBe("ragu-2");
    expect(result.catalogMatches[0]).toMatchObject({
      name: "Ragu Unsweetened Sauce", evidenceStatus: "needs_verification",
    });
    expect(result.catalogMatches[0].profileInsight).toContain("not an allergen or product-policy clearance");
  });
  test("a conflict discovered only during exact-product enrichment is rejected", async () => {
    const first = record({ name: "Ragu Sauce", sourceRecordId: "ragu-1", facts: [] });
    const second = record({ name: "Ragu Unsweetened Sauce", sourceRecordId: "ragu-2",
      facts: [{ kind: "ingredients", originalStatement: "Tomato, olive oil, salt",
        completeness: "unknown" }] });
    const provider = adapter([first, second]);
    provider.enrich = async (_, original) => original.sourceRecordId === "ragu-1"
      ? { ...original, facts: [{ kind: "ingredients",
        originalStatement: "Tomato, sugar, salt", completeness: "unknown" }] }
      : original;
    const result = await findProductDevelopment("owner", "pasta sauce", {
      sources: sources({ avoided: ["sugar"] }), adapter: provider,
    });
    expect(result.rejected).toBe(1);
    expect(result.catalogMatches.map((item) => item.sourceRecordId)).toEqual(["ragu-2"]);
  });
  test("a positive catalog allergen declaration excludes milk for a milk-allergic subject", async () => {
    const provider = adapter([record({ name: "Milk Drink", facts: [] })]);
    provider.enrich = async (_, initial) => ({
      ...initial, facts: [{ kind: "declared_allergens",
        originalStatement: "Catalog declared allergens: en:milk",
        completeness: "partial" }],
    });
    const result = await findProductDevelopment("owner", "milk", {
      sources: sources({ allergies: ["MILK"] }), adapter: provider,
    });
    expect(result.rejected).toBe(1);
    expect(result.catalogMatches).toHaveLength(0);
  });
  test("USDA 429 falls back to exact OFF rice records and continues past an avoided ingredient", async () => {
    const primary = adapter([]);
    primary.search = async () => { throw new Error("USDA 429"); };
    const hits = [
      { code: "0859278003295", product_name: "Rice & Quinoa",
        brands: ["Supreme Rice"], countries_tags: ["en:united-states"], quantity: "2 lbs" },
      { code: "0859278003066", product_name: "White Long Grain Rice",
        brands: ["Louisiana Rice Mill Llc"], countries_tags: ["en:united-states"] },
      { code: "9310140006451", product_name: "Australian Brown Rice",
        brands: ["Sun Rice"], countries_tags: ["en:australia"] },
    ];
    const fetcher = jest.fn(async (url: URL) => {
      const path = new URL(String(url)).pathname;
      const value = path === "/search" ? { hits } : {
        status: 1, product: path.includes("0859278003295")
          ? { code: "0859278003295", product_name: "Rice & Quinoa",
            brands: "Supreme Rice", countries_tags: ["en:united-states"],
            quantity: "2 lbs", ingredients_text: "Rice, quinoa" }
          : { code: "0859278003066", product_name: "White Long Grain Rice",
            brands: "Louisiana Rice Mill Llc", countries_tags: ["en:united-states"],
            ingredients_text: "Rice", nutriments: { carbohydrates_100g: 77.8 } },
      };
      return { ok: true, status: 200, json: async () => value };
    }) as unknown as typeof fetch;
    const result = await findProductDevelopment("owner", "rice", {
      sources: sources({ diet: ["low_carb"], avoided: ["quinoa"] }),
      adapter: primary, fallbackAdapter: createOpenFoodFactsSearchAdapter(fetcher),
    });
    expect(result.sourceFailures).toContain("Product source search was unavailable.");
    expect(result.catalogSearchAvailable).toBe(true);
    expect(result.rejected).toBe(1);
    expect(result.catalogMatches).toEqual([
      expect.objectContaining({
        name: "White Long Grain Rice", source: "Open Food Facts",
        barcode: "0859278003066", evidenceStatus: "needs_verification",
        ingredients: "Rice",
        nutrition: [expect.objectContaining({ source: "open_food_facts" })],
        research: [
          { source: "open_food_facts", result: "matched", phase: "search" },
          { source: "open_food_facts", result: "matched", phase: "barcode_lookup" },
        ],
      }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  test("an empty but working fallback search is not reported as a catalog outage", async () => {
    const primary = adapter([]);
    primary.search = async () => { throw new Error("USDA 429"); };
    const fallback = createOpenFoodFactsSearchAdapter(
      (async () => ({ ok: true, status: 200, json: async () => ({ hits: [] }) })) as typeof fetch,
    );
    const result = await findProductDevelopment("owner", "rice", {
      sources: sources(), adapter: primary, fallbackAdapter: fallback,
    });
    expect(result.catalogMatches).toHaveLength(0);
    expect(result.catalogSearchAvailable).toBe(true);
  });
});