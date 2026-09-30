import type {
  ProductCandidate,
  ProductEvaluationContext,
  ProductEvidenceNeed,
  ProductEvidenceProvenance,
  ProductFact,
  ProductHardRequirement,
  ProductRuleAssessment,
  ProductSearchIntent,
} from "../../shared/productCandidateContract";
import {
  evaluateProductCandidate as evaluateContractCandidate,
  isWellFormedProductSearchIntent,
  productCandidateSignature,
  shouldContinueProductDiscovery,
} from "../services/productDiscovery/evaluateProductCandidate";

const NOW = "2026-09-30T12:00:00.000Z";
const PRODUCT_KEY = "gtin:0123456789012:unsweetened";

function provenance(overrides: Partial<ProductEvidenceProvenance> = {}): ProductEvidenceProvenance {
  return {
    source: "usda_branded",
    sourceRecordId: "branded-record-1",
    observedAt: "2026-09-29T12:00:00.000Z",
    identityKey: PRODUCT_KEY,
    barcode: "0123456789012",
    exactVariantMatch: true,
    ...overrides,
  };
}

function fact(
  kind: ProductFact["kind"],
  overrides: Partial<ProductFact> = {},
): ProductFact {
  return {
    id: kind,
    kind,
    statement: "Source-reported product fact",
    completeness: "complete",
    provenance: provenance(),
    ...overrides,
  };
}

function candidate(facts: ProductFact[] = []): ProductCandidate {
  return {
    identity: {
      key: PRODUCT_KEY,
      name: "Unsweetened oat beverage",
      brand: "Example Foods",
      variant: "Unsweetened 1L",
      barcode: "0123456789012",
      match: "exact_variant",
      provenance: provenance(),
    },
    facts,
  };
}

function hard(
  id: string,
  evidenceNeeds: ProductEvidenceNeed[],
  type: ProductHardRequirement["type"] = "allergy",
): ProductHardRequirement {
  return { id, type, evidenceNeeds };
}

function need(
  kind: ProductEvidenceNeed["kind"],
  overrides: Partial<ProductEvidenceNeed> = {},
): ProductEvidenceNeed {
  return { kind, minimum: "approved_source_record", maxAgeDays: 30, ...overrides };
}

function context(
  hardRequirements: ProductHardRequirement[] = [],
  overrides: Partial<ProductEvaluationContext> = {},
): ProductEvaluationContext {
  return {
    subjectId: "subject-a",
    contextFingerprint: "profile-a:today-a",
    policyVersion: "policy-fixture-v1",
    resolved: true,
    policyStatus: "resolved",
    activeHardRestrictionIds: hardRequirements.map((rule) => rule.id),
    evaluatedAt: NOW,
    identityMaxAgeDays: 30,
    hardRequirements,
    rankingFactors: [],
    ...overrides,
  };
}

function check(
  requirementId: string,
  outcome: ProductRuleAssessment["outcome"],
  factIds: string[],
): Pick<ProductRuleAssessment, "requirementId" | "outcome" | "factIds" | "reason"> {
  return { requirementId, outcome, factIds, reason: `${requirementId}: ${outcome}` };
}

type FixtureAssessment = ReturnType<typeof check>;

function evaluateProductCandidate(
  product: ProductCandidate,
  subjectContext: ProductEvaluationContext,
  assessments: FixtureAssessment[],
  ranking: Parameters<typeof evaluateContractCandidate>[3] = [],
) {
  return evaluateContractCandidate(product, subjectContext, assessments.map((assessment) => ({
    ...assessment,
    subjectId: subjectContext.subjectId,
    contextFingerprint: subjectContext.contextFingerprint,
    policyVersion: subjectContext.policyVersion,
    candidateSignature: productCandidateSignature(product),
  })), ranking);
}

describe("product candidate evidence and eligibility contract (not wired to live routes)", () => {
  it("qualifies an exact, current source record when no stronger rule applies", () => {
    const decision = evaluateProductCandidate(candidate(), context(), []);
    expect(decision).toMatchObject({
      status: "eligible",
      presentation: "recommended_for_you",
      contextFingerprint: "profile-a:today-a",
      productKey: PRODUCT_KEY,
      continueDiscovery: false,
    });
  });

  it("allows complete catalog ingredient evidence for a rule that permits it", () => {
    const rule = hard("diet:vegan", [need("ingredients")], "dietary_identity");
    const decision = evaluateProductCandidate(
      candidate([fact("ingredients")]), context([rule]), [check(rule.id, "pass", ["ingredients"])],
    );
    expect(decision.status).toBe("eligible");
  });

  it("does not promote catalog evidence to a required confirmed current-package label", () => {
    const rule = hard("allergy:peanut", [
      need("ingredients", { minimum: "confirmed_current_label" }),
    ]);
    const assessment = check(rule.id, "pass", ["ingredients"]);
    const unconfirmed = evaluateProductCandidate(
      candidate([fact("ingredients")]), context([rule]), [assessment],
    );
    expect(unconfirmed).toMatchObject({
      status: "needs_verification",
      presentation: "check_the_label",
      continueDiscovery: true,
    });

    const currentLabel = fact("ingredients", {
      provenance: provenance({
        source: "current_package_label",
        sourceRecordId: "opaque-capture-1",
        labelCompletenessConfirmed: true,
        captureConfidence: "high",
      }),
    });
    const upgraded = evaluateProductCandidate(
      candidate([currentLabel]), context([rule]), [assessment],
    );
    expect(upgraded.status).toBe("eligible");
  });

  it.each([
    ["allergy", "allergy:peanut"],
    ["alpha_gal", "alpha-gal:active"],
    ["pregnancy", "pregnancy:trimester-2"],
  ] as const)("applies a stronger threshold only when the %s rule requires it", (type, id) => {
    const rule = hard(id, [need("ingredients", { minimum: "confirmed_current_label" })], type);
    const declaration = fact("ingredients");
    expect(evaluateProductCandidate(
      candidate([declaration]), context([rule]), [check(id, "pass", [declaration.id])],
    ).status).toBe("needs_verification");
    // This fixture does not assert that these are the actual live clinical
    // rules. The authoritative policy resolver must supply them later.
  });

  it("a less restrictive intolerance policy can qualify from adequate source-backed evidence", () => {
    const rule = hard("intolerance:lactose", [need("ingredients")], "intolerance");
    const declaration = fact("ingredients");
    expect(evaluateProductCandidate(
      candidate([declaration]), context([rule]), [check(rule.id, "pass", [declaration.id])],
    ).status).toBe("eligible");
  });

  it("a partial or unreviewed scan cannot silently upgrade a passing rule", () => {
    const rule = hard("allergy:peanut", [
      need("ingredients", { minimum: "confirmed_current_label" }),
    ]);
    for (const partial of [true, false]) {
      const scanned = fact("ingredients", {
        completeness: partial ? "partial" : "complete",
        provenance: provenance({
          source: "current_package_label",
          labelCompletenessConfirmed: partial,
          captureConfidence: "high",
        }),
      });
      expect(evaluateProductCandidate(
        candidate([scanned]), context([rule]), [check(rule.id, "pass", [scanned.id])],
      ).status).toBe("needs_verification");
    }
  });

  it("missing precautionary allergen information is unknown when this rule requires it", () => {
    const rule = hard("allergy:peanut", [
      need("ingredients"),
      need("precautionary_allergens", { target: "peanut" }),
    ]);
    const ingredients = fact("ingredients");
    const unknown = fact("precautionary_allergens", {
      target: "peanut",
      completeness: "unknown",
      precautionaryStatus: "unknown",
      statement: "No precautionary statement supplied in this record",
    });
    const decision = evaluateProductCandidate(
      candidate([ingredients, unknown]), context([rule]),
      [check(rule.id, "pass", [ingredients.id, unknown.id])],
    );
    expect(decision.status).toBe("needs_verification");
    expect(decision.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "evidence_missing", detail: expect.stringContaining("precautionary_allergens") }),
    ]));
    // A dietary preference does not inherit an allergy-only precautionary rule.
    const vegan = hard("diet:vegan", [need("ingredients")], "dietary_identity");
    expect(evaluateProductCandidate(
      candidate([ingredients]), context([vegan]), [check(vegan.id, "pass", [ingredients.id])],
    ).status).toBe("eligible");
  });

  it("rejects an established hard conflict even when its current label is partial", () => {
    const rule = hard("allergy:peanut", [
      need("ingredients", { minimum: "confirmed_current_label" }),
    ]);
    const partial = fact("ingredients", {
      completeness: "partial",
      statement: "Peanuts listed in the visible ingredient panel",
      provenance: provenance({
        source: "current_package_label",
        labelCompletenessConfirmed: false,
        captureConfidence: "high",
      }),
    });
    const decision = evaluateProductCandidate(
      candidate([partial]), context([rule]), [check(rule.id, "conflict", [partial.id])],
    );
    expect(decision).toMatchObject({
      status: "rejected",
      presentation: "not_shown",
      ranking: [],
      continueDiscovery: true,
    });
  });

  it("does not treat low-confidence OCR as conclusive conflict evidence", () => {
    const rule = hard("allergy:peanut", [
      need("ingredients", { minimum: "confirmed_current_label" }),
    ]);
    const uncertain = fact("ingredients", {
      completeness: "partial",
      provenance: provenance({
        source: "current_package_label",
        captureConfidence: "low",
      }),
    });
    expect(evaluateProductCandidate(
      candidate([uncertain]), context([rule]), [check(rule.id, "conflict", [uncertain.id])],
    ).status).toBe("needs_verification");
  });

  it("does not accept a low-confidence capture even if marked complete", () => {
    const rule = hard("allergy:peanut", [
      need("ingredients", { minimum: "confirmed_current_label" }),
    ]);
    const uncertain = fact("ingredients", {
      provenance: provenance({
        source: "current_package_label",
        captureConfidence: "low",
        labelCompletenessConfirmed: true,
      }),
    });
    expect(evaluateProductCandidate(
      candidate([uncertain]), context([rule]), [check(rule.id, "pass", [uncertain.id])],
    ).status).toBe("needs_verification");
  });

  it("a complete catalog row with no explicit cross-contact finding is still unknown", () => {
    const rule = hard("allergy:peanut", [
      need("precautionary_allergens", { target: "peanut" }),
    ]);
    const omitted = fact("precautionary_allergens", {
      target: "peanut",
      precautionaryStatus: "unknown",
      statement: "Catalog field was empty",
    });
    expect(evaluateProductCandidate(
      candidate([omitted]), context([rule]), [check(rule.id, "pass", [omitted.id])],
    ).status).toBe("needs_verification");
    const explicitlyAddressed = { ...omitted, precautionaryStatus: "explicitly_absent_for_target" as const };
    expect(evaluateProductCandidate(
      candidate([explicitlyAddressed]), context([rule]),
      [check(rule.id, "pass", [explicitlyAddressed.id])],
    ).status).toBe("eligible");
  });

  it("a credible hard conflict outranks missing evidence for another restriction", () => {
    const allergy = hard("allergy:peanut", [need("ingredients")]);
    const clinical = hard("clinical:sodium", [need("nutrition", { target: "sodium_mg_per_serving" })], "clinical");
    const declaration = fact("ingredients");
    const decision = evaluateProductCandidate(
      candidate([declaration]), context([allergy, clinical]),
      [check(allergy.id, "conflict", [declaration.id]), check(clinical.id, "unknown", [])],
    );
    expect(decision.status).toBe("rejected");
    expect(decision.reasons.map((reason) => reason.code)).toContain("hard_conflict");
  });

  it.each([
    ["model-generated", { source: "model_suggestion" as const }],
    ["user-entered", { source: "user_entered" as const }],
    ["wrong variant", { identityKey: "gtin:different-variant" }],
    ["stale", { observedAt: "2025-01-01T00:00:00.000Z" }],
    ["future timestamp", { observedAt: "2027-01-01T00:00:00.000Z" }],
    ["missing source record", { sourceRecordId: "" }],
  ])("does not treat %s fact claims as a verified pass", (_name, change) => {
    const rule = hard("diet:vegan", [need("ingredients")], "dietary_identity");
    const claim = fact("ingredients", { provenance: provenance(change) });
    expect(evaluateProductCandidate(
      candidate([claim]), context([rule]), [check(rule.id, "pass", [claim.id])],
    ).status).toBe("needs_verification");
  });

  it("keeps an unidentified brand suggestion out of the recommended class", () => {
    const suggestion = candidate();
    suggestion.identity.match = "brand_only";
    expect(evaluateProductCandidate(suggestion, context(), [])).toMatchObject({
      status: "needs_verification",
      presentation: "check_the_label",
    });
  });

  it("does not pass an assessment citing a nonexistent or unrelated fact", () => {
    const rule = hard("clinical:sodium", [
      need("nutrition", { target: "sodium_mg_per_serving" }),
    ], "clinical");
    for (const refs of [["missing"], ["ingredients"]]) {
      expect(evaluateProductCandidate(
        candidate([fact("ingredients")]), context([rule]), [check(rule.id, "pass", refs)],
      ).status).toBe("needs_verification");
    }
  });

  it("requires an explicit serving basis for a nutrition limit", () => {
    const rule = hard("clinical:sodium", [
      need("nutrition", { target: "sodium_mg_per_serving" }),
    ], "clinical");
    const wrongBasis = fact("nutrition", { target: "sodium_mg_per_100g" });
    expect(evaluateProductCandidate(
      candidate([wrongBasis]), context([rule]), [check(rule.id, "pass", [wrongBasis.id])],
    ).status).toBe("needs_verification");
    const perServing = fact("nutrition", { target: "sodium_mg_per_serving" });
    expect(evaluateProductCandidate(
      candidate([perServing]), context([rule]), [check(rule.id, "pass", [perServing.id])],
    ).status).toBe("eligible");
  });

  it("respects the source list and freshness threshold of the particular rule", () => {
    const rule = hard("diet:certified", [
      need("certification", {
        target: "kosher",
        acceptedSources: ["manufacturer", "current_package_label"],
        maxAgeDays: 7,
      }),
    ], "dietary_identity");
    const catalogClaim = fact("certification", { target: "kosher" });
    expect(evaluateProductCandidate(
      candidate([catalogClaim]), context([rule]), [check(rule.id, "pass", [catalogClaim.id])],
    ).status).toBe("needs_verification");
    const manufacturer = fact("certification", {
      target: "kosher",
      provenance: provenance({ source: "manufacturer" }),
    });
    expect(evaluateProductCandidate(
      candidate([manufacturer]), context([rule]), [check(rule.id, "pass", [manufacturer.id])],
    ).status).toBe("eligible");
    const outdated = fact("certification", {
      target: "kosher",
      provenance: provenance({ source: "manufacturer", observedAt: "2026-09-01T12:00:00.000Z" }),
    });
    expect(evaluateProductCandidate(
      candidate([outdated]), context([rule]), [check(rule.id, "pass", [outdated.id])],
    ).status).toBe("needs_verification");
  });

  it("does not allow optimization, preference, dislike, or sponsorship to override hard rules", () => {
    const rule = hard("allergy:peanut", [need("ingredients")]);
    const rankedContext = context([rule], {
      rankingFactors: [
        { id: "nlp:lower-sodium", type: "optimization", weight: 2 },
        { id: "palate:oat", type: "preference", weight: 1 },
        { id: "palate:dislike", type: "dislike", weight: -1 },
      ],
    });
    const highScore = [{ factorId: "nlp:lower-sodium", score: 100, reason: "Better sodium fit" }];
    const unresolved = evaluateProductCandidate(
      candidate(), rankedContext, [check(rule.id, "unknown", [])], highScore,
    );
    expect(unresolved).toMatchObject({ status: "needs_verification", ranking: [] });
    const declaration = fact("ingredients");
    const eligible = evaluateProductCandidate(
      candidate([declaration]), rankedContext, [check(rule.id, "pass", [declaration.id])],
      [...highScore, { factorId: "sponsor", score: 1000, reason: "Paid placement" }],
    );
    expect(eligible.status).toBe("eligible");
    expect(eligible.ranking).toEqual(highScore);
  });

  it("fails closed when the subject context is unavailable or stale proofs are missing", () => {
    const rule = hard("allergy:peanut", [need("ingredients")]);
    const unavailable = evaluateProductCandidate(
      candidate(), context([rule], { resolved: false }), [],
    );
    expect(unavailable).toMatchObject({
      status: "needs_verification",
      reasons: [expect.objectContaining({ code: "context_unavailable" })],
    });
    expect(evaluateProductCandidate(
      candidate([fact("ingredients")]), context([rule], { contextFingerprint: "new-profile" }), [],
    ).status).toBe("needs_verification");
    expect(evaluateProductCandidate(
      candidate([fact("ingredients")]), context([rule], {
        activeHardRestrictionIds: ["allergy:peanut", "clinical:missing-policy"],
      }), [check(rule.id, "pass", ["ingredients"])],
    ).status).toBe("needs_verification");
    expect(evaluateProductCandidate(
      candidate([fact("ingredients")]), context([rule], { policyStatus: "unresolved" }),
      [check(rule.id, "pass", ["ingredients"])],
    ).status).toBe("needs_verification");
  });

  it("will not replay a trusted assessment against a different label or subject context", () => {
    const rule = hard("diet:vegan", [need("ingredients")], "dietary_identity");
    const original = candidate([fact("ingredients")]);
    const originalContext = context([rule]);
    const proof: ProductRuleAssessment = {
      ...check(rule.id, "pass", ["ingredients"]),
      subjectId: originalContext.subjectId,
      contextFingerprint: originalContext.contextFingerprint,
      policyVersion: originalContext.policyVersion,
      candidateSignature: productCandidateSignature(original),
    };
    expect(evaluateContractCandidate(original, originalContext, [proof]).status).toBe("eligible");
    const modified = candidate([fact("ingredients", { statement: "New formulation" })]);
    expect(evaluateContractCandidate(modified, originalContext, [proof]).status).toBe("needs_verification");
    expect(evaluateContractCandidate(original, context([rule], {
      subjectId: "subject-b", contextFingerprint: "profile-b",
    }), [proof]).status).toBe("needs_verification");
    expect(evaluateContractCandidate(original, context([rule], {
      policyVersion: "policy-fixture-v2",
    }), [proof]).status).toBe("needs_verification");
  });

  it("rejects a barcode contradiction even when source identity keys match", () => {
    const mismatched = candidate();
    mismatched.identity.provenance.barcode = "another-package";
    expect(evaluateProductCandidate(mismatched, context(), []).status).toBe("needs_verification");
    const rule = hard("diet:vegan", [need("ingredients")], "dietary_identity");
    const wrongFact = fact("ingredients", { provenance: provenance({ barcode: "another-package" }) });
    expect(evaluateProductCandidate(
      candidate([wrongFact]), context([rule]), [check(rule.id, "pass", [wrongFact.id])],
    ).status).toBe("needs_verification");
  });

  it("rejects invalid evaluation policy instead of silently treating it as unrestricted", () => {
    const invalid = hard("allergy:peanut", []);
    expect(() => evaluateProductCandidate(candidate(), context([invalid]), [])).toThrow(
      "Invalid product hard-requirement policy",
    );
    expect(() => evaluateProductCandidate(candidate(), context([
      hard("clinical:missing-nutrient", [need("nutrition")], "clinical"),
    ]), [])).toThrow("Invalid product hard-requirement policy");
    const rule = hard("allergy:peanut", [need("ingredients")]);
    expect(() => evaluateProductCandidate(candidate([fact("ingredients")]), context([rule]), [
      check(rule.id, "pass", ["ingredients"]),
      check(rule.id, "conflict", ["ingredients"]),
    ])).toThrow("Ambiguous product evidence or rule assessments");
  });

  it("keeps functional search adaptation distinct from product approval", () => {
    const intent: ProductSearchIntent = {
      requestedFood: "milk",
      purpose: "baking",
      searchCategories: [
        { category: "milk", adaptationReasonRequirementIds: [], preservesPurpose: true },
        {
          category: "unsweetened plant milk",
          adaptationReasonRequirementIds: ["diet:vegan"],
          preservesPurpose: true,
        },
      ],
    };
    expect(intent.searchCategories[1].category).toBe("unsweetened plant milk");
    expect(isWellFormedProductSearchIntent(intent, ["diet:vegan"])).toBe(true);
    expect(isWellFormedProductSearchIntent(intent, [])).toBe(false);
    expect(isWellFormedProductSearchIntent({
      ...intent, searchCategories: [{ ...intent.searchCategories[1], preservesPurpose: false }],
    }, ["diet:vegan"])).toBe(false);
    expect(evaluateProductCandidate(candidate(), context([
      hard("diet:vegan", [need("ingredients")], "dietary_identity"),
    ]), []).status).toBe("needs_verification");
  });

  it("continues past rejected or unverified candidates until the bounded search ends", () => {
    expect(shouldContinueProductDiscovery({
      qualifiedCount: 0, targetCount: 3, inspectedCount: 2, maxCandidates: 20,
      moreCandidatesAvailable: true,
    })).toBe(true);
    expect(shouldContinueProductDiscovery({
      qualifiedCount: 0, targetCount: 3, inspectedCount: 20, maxCandidates: 20,
      moreCandidatesAvailable: true,
    })).toBe(false);
    expect(shouldContinueProductDiscovery({
      qualifiedCount: 3, targetCount: 3, inspectedCount: 5, maxCandidates: 20,
      moreCandidatesAvailable: true,
    })).toBe(false);
  });
});