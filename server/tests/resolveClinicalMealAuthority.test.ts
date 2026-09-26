import type { ClinicalDirectiveRecord, ClinicalReviewDecision } from
  "../../shared/clinicalMealAuthority";
import { exactFoodDirectiveSchema } from "../../shared/clinicalMealAuthority";
import type { HealthProtocolRecord } from "../../shared/healthProtocolState";
import { resolveClinicalMealAuthority } from "../services/healthProtocols/resolveClinicalMealAuthority";

const now = new Date("2026-09-26T12:00:00.000Z");
const source = (overrides: Partial<HealthProtocolRecord> = {}): HealthProtocolRecord => ({
  id: "source-1", protocol: "cardiac", source: "user", status: "active", ...overrides,
});
const directive = (overrides: Partial<ClinicalDirectiveRecord> = {}): ClinicalDirectiveRecord => ({
  id: "directive-1", subjectUserId: "subject", sourceId: "source-1",
  protocol: "cardiac", rule: {
    kind: "nutrient_bound", nutrient: "sodium", comparator: "at_most",
    amount: 700, unit: "mg", scope: "per_serving",
  },
  effectiveAt: new Date("2026-09-01T00:00:00.000Z"), expiresAt: null,
  supersedesId: null, ...overrides,
});
const decision = (overrides: Partial<ClinicalReviewDecision> = {}): ClinicalReviewDecision => ({
  id: "decision-1", subjectUserId: "subject", sourceId: "source-1",
  directiveId: null, disposition: "current_guidance",
  actorUserId: "subject", decidedAt: new Date("2026-09-20T00:00:00.000Z"),
  ...overrides,
});
const resolve = (overrides: Partial<Parameters<typeof resolveClinicalMealAuthority>[0]> = {}) =>
  resolveClinicalMealAuthority({
    subjectUserId: "subject", history: ["Cardiac"], builder: "standard",
    sources: [], directives: [], decisions: [], relationshipStatus: {}, now, ...overrides,
  });

describe("shadow canonical clinical meal authority (not connected to food reads)", () => {
  it("never converts a condition label or Builder strategy into an exact hard restriction", () => {
    const result = resolve({ builder: "diabetic", history: ["Cardiac", "Cardiac"] });
    expect(result.healthHistory).toEqual(["Cardiac"]);
    expect(result.builderStrategy).toBe("diabetes");
    expect(result.hardFoodRestrictions).toEqual([]);
    expect(result.candidateForFood).toEqual({ guidance: [], hardRestrictions: [] });
    expect(result.effectiveForFood).toBeNull();
    expect(result.activationGate).toBe("shadow_only_reconciliation_required");
  });

  it("holds ambiguous earlier claims for review instead of promoting or silently dropping them", () => {
    const result = resolve({ sources: [source({ source: "legacy_migrated", status: "pending_review" })] });
    expect(result.effectiveForFood).toBeNull();
    expect(result.needsReview[0].reason).toBe("legacy_unverified");
  });

  it("treats a subject-confirmed support source as guidance, not a hard food rule", () => {
    const result = resolve({ sources: [source()], decisions: [decision()] });
    expect(result.nutritionGuidance).toEqual([{ protocol: "cardiac", sourceId: "source-1" }]);
    expect(result.hardFoodRestrictions).toEqual([]);
    expect(result.candidateForFood).not.toBeNull();
    expect(result.effectiveForFood).toBeNull();
    expect(resolve({ sources: [source()] }).candidateForFood).toBeNull();
  });

  it("requires an explicit exact rule and current verified provider ownership", () => {
    const provider = source({
      source: "provider", ownerUserId: "doctor", relationshipId: "care-1",
    });
    const reviewed = decision({
      directiveId: "directive-1", disposition: "verified_provider_directive",
      actorUserId: "doctor",
    });
    const good = resolve({
      sources: [provider], directives: [directive()], decisions: [reviewed],
      relationshipStatus: { "care-1": "active" },
    });
    expect(good.verifiedProviderDirectives).toHaveLength(1);
    expect(good.hardFoodRestrictions[0].rule).toEqual(directive().rule);
    expect(good.candidateForFood).not.toBeNull();
    expect(good.effectiveForFood).toBeNull();
    expect(resolve({
      sources: [provider], directives: [], relationshipStatus: { "care-1": "active" },
    }).candidateForFood).toBeNull();
    expect(resolve({
      sources: [provider], directives: [directive()], decisions: [reviewed],
      relationshipStatus: { "care-1": "ended" },
    }).candidateForFood).toBeNull();
    expect(resolve({
      sources: [provider], directives: [directive()],
      decisions: [decision({ ...reviewed, actorUserId: "subject" })],
      relationshipStatus: { "care-1": "active" },
    }).candidateForFood).toBeNull();
  });

  it("cannot be cleared by a patient's source-level review of an active provider claim", () => {
    const result = resolve({
      sources: [source({ source: "provider", ownerUserId: "doctor", relationshipId: "care-1" })],
      directives: [directive()],
      relationshipStatus: { "care-1": "active" },
      decisions: [
        decision({ directiveId: "directive-1", disposition: "verified_provider_directive", actorUserId: "doctor" }),
        decision({ id: "patient", disposition: "historical", actorUserId: "subject" }),
      ],
    });
    expect(result.candidateForFood).toBeNull();
    expect(result.needsReview.some((item) => item.reason === "review_actor_unverified")).toBe(true);
  });

  it("retains a subject-confirmed exact restriction independently of condition guidance", () => {
    const result = resolve({
      sources: [source()], directives: [directive()],
      decisions: [decision({
        directiveId: "directive-1", disposition: "current_hard_restriction",
      })],
    });
    expect(result.hardFoodRestrictions).toHaveLength(1);
    expect(result.hardFoodRestrictions[0].authority).toBe("reviewed_subject");
    expect(result.nutritionGuidance).toEqual([]);
    expect(result.candidateForFood).not.toBeNull();
    expect(result.effectiveForFood).toBeNull();
  });

  it("requires review if an active provider directive expires or is discontinued without ending its source", () => {
    const provider = source({ source: "provider", ownerUserId: "doctor", relationshipId: "care-1" });
    const active = decision({
      directiveId: "directive-1", disposition: "verified_provider_directive",
      actorUserId: "doctor",
    });
    const base = {
      sources: [provider], directives: [directive()], decisions: [active],
      relationshipStatus: { "care-1": "active" as const },
    };
    expect(resolve({ ...base, directives: [directive({
      expiresAt: new Date("2026-09-25T00:00:00.000Z"),
    })] }).candidateForFood).toBeNull();
    expect(resolve({ ...base, decisions: [active, decision({
      id: "decision-2", directiveId: "directive-1",
      disposition: "historical", actorUserId: "doctor",
      decidedAt: new Date("2026-09-26T00:00:00.000Z"),
    })] }).candidateForFood).toBeNull();
  });

  it("rejects a foreign actor's terminal decision even when another guidance decision exists", () => {
    const result = resolve({
      sources: [source()], directives: [directive()],
      decisions: [
        decision(),
        decision({
          id: "active-rule", directiveId: "directive-1",
          disposition: "current_hard_restriction",
        }),
        decision({
          id: "foreign-end", directiveId: "directive-1",
          disposition: "historical", actorUserId: "stranger",
          decidedAt: new Date("2026-09-26T01:00:00.000Z"),
        }),
      ],
    });
    expect(result.candidateForFood).toBeNull();
    expect(result.needsReview.some((item) => item.reason === "review_actor_unverified")).toBe(true);
  });

  it("keeps superseded provider history while activating only the reviewed replacement", () => {
    const provider = source({ source: "provider", ownerUserId: "doctor", relationshipId: "care-1" });
    const old = directive();
    const replacement = directive({
      id: "directive-2", supersedesId: "directive-1",
      rule: { kind: "avoid_ingredient", ingredientKey: "peanut" },
    });
    const result = resolve({
      sources: [provider], directives: [old, replacement],
      relationshipStatus: { "care-1": "active" },
      decisions: [
        decision({ id: "old-current", directiveId: old.id,
          disposition: "verified_provider_directive", actorUserId: "doctor" }),
        decision({ id: "old-ended", directiveId: old.id, disposition: "historical",
          actorUserId: "doctor", decidedAt: new Date("2026-09-21T00:00:00Z") }),
        decision({ id: "new-current", directiveId: replacement.id,
          disposition: "verified_provider_directive", actorUserId: "doctor" }),
      ],
    });
    expect(result.verifiedProviderDirectives.map((item) => item.id)).toEqual(["directive-2"]);
    expect(result.candidateForFood?.hardRestrictions).toHaveLength(1);
    expect(result.effectiveForFood).toBeNull();
  });

  it("rejects cross-subject decisions, source mismatches and untyped nutrition", () => {
    expect(() => resolve({
      sources: [source()], directives: [directive({ subjectUserId: "another" })],
    })).toThrow("source mismatch");
    expect(() => resolve({
      sources: [source()], directives: [directive()],
      decisions: [decision({ subjectUserId: "another", directiveId: "directive-1" })],
    })).toThrow("identity mismatch");
    expect(exactFoodDirectiveSchema.safeParse({
      kind: "nutrient_bound", nutrient: "sodium", amount: 700,
      comparator: "at_most", unit: "g", scope: "per_serving",
    }).success).toBe(false);
    expect(exactFoodDirectiveSchema.safeParse({
      kind: "avoid_ingredient", ingredientKey: "Cardiac advice",
    }).success).toBe(false);
  });
});