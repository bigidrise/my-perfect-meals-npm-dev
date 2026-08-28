import type {
  HydrationModifierInput,
  HydrationModifierMetric,
} from "@shared/hydration/contracts";
import {
  createBuilderHydrationContextContribution,
  hydrationModifierResolver,
} from "../services/hydration/hydrationModifierResolver";

const POLICY_VERSION = "hydration-modifier-foundation-v1";

function modifier(
  id: string,
  overrides: Partial<HydrationModifierInput> = {},
): HydrationModifierInput {
  return {
    id,
    modifierType: "performance_context",
    metric: "fluid",
    effect: "supports",
    authority: "performance",
    source: "performance",
    sourceId: `source:${id}`,
    rationaleCode: `${id}_rationale`,
    policyVersion: POLICY_VERSION,
    ...overrides,
  };
}

function restriction(
  id: string,
  metric: HydrationModifierMetric,
  overrides: Partial<HydrationModifierInput> = {},
): HydrationModifierInput {
  return modifier(id, {
    modifierType: `${metric}_restriction`,
    metric,
    effect: "limits",
    authority: "organ_safety",
    source: "safety",
    ...overrides,
  });
}

function resolve(modifiers: readonly unknown[] = []) {
  return hydrationModifierResolver.resolve({
    modifiers,
    policyVersion: POLICY_VERSION,
  });
}

describe("Hydration modifier resolver", () => {
  it("returns a neutral, nonnumeric state when no modifiers exist", () => {
    const result = resolve();

    expect(result).toMatchObject({
      status: "neutral",
      activeModifiers: [],
      activeRestrictions: [],
      suppressedModifiers: [],
      suppressions: [],
      clinicianDirectiveState: "none",
      potsState: "not_present",
      clinicalConflictState: "none",
      escalationRequired: false,
      targetMl: null,
      minimumMl: null,
      maximumMl: null,
      remainingMl: null,
      numericPlanAllowed: false,
    });
    expect(result.inputSnapshotHash).toHaveLength(64);
  });

  it("keeps unrestricted performance context active without calculating a dose", () => {
    const performance = modifier("performance:scheduled-workout", {
      contextKey: "workout_scheduled",
    });
    const result = resolve([performance]);

    expect(result.status).toBe("resolved");
    expect(result.activeModifiers).toHaveLength(1);
    expect(result.activeModifiers[0]).toMatchObject({
      id: performance.id,
      disposition: "active",
      metric: "fluid",
    });
    expect(result.suppressedModifiers).toEqual([]);
    expect(result.numericPlanAllowed).toBe(false);
  });

  it("suppresses a performance fluid modifier behind a clinical fluid restriction", () => {
    const performance = modifier("performance:fluid-emphasis");
    const fluidRestriction = restriction(
      "clinical:fluid-restriction",
      "fluid",
    );
    const result = resolve([performance, fluidRestriction]);

    expect(result.status).toBe("withheld");
    expect(result.activeRestrictions.map((claim) => claim.id)).toEqual([
      fluidRestriction.id,
    ]);
    expect(result.suppressedModifiers[0]).toMatchObject({
      id: performance.id,
      disposition: "suppressed",
      suppressionReasonCodes: ["organ_safety_precedence"],
      suppressedByInputIds: [fluidRestriction.id],
    });
    expect(result.clinicalConflictState).toBe("detected");
  });

  it("suppresses sodium-increasing context behind a sodium restriction without inventing a ceiling", () => {
    const sodiumContext = modifier("performance:sodium-context", {
      metric: "sodium",
      contextKey: "future_sodium_support",
    });
    const sodiumRestriction = restriction(
      "clinical:sodium-restriction",
      "sodium",
    );
    const result = resolve([sodiumRestriction, sodiumContext]);

    expect(result.suppressedModifiers.map((claim) => claim.id)).toEqual([
      sodiumContext.id,
    ]);
    expect(result.activeRestrictions[0]).not.toHaveProperty("value");
    expect(result.activeRestrictions[0]).not.toHaveProperty("threshold");
    expect(result.targetMl).toBeNull();
  });

  it("lets a clinician directive outrank performance context on the same scope", () => {
    const performance = modifier("performance:post-training");
    const clinicianDirective = modifier("clinician:fluid-protocol", {
      modifierType: "clinician_protocol",
      effect: "supports",
      authority: "clinician",
      source: "clinician_directive",
      sourceId: "directive:fluid-protocol",
      conflictGroup: "daily-fluid-policy",
      contextKey: "clinician_defined_protocol",
    });
    const result = resolve([
      performance,
      clinicianDirective,
    ]);

    expect(result.activeModifiers.map((claim) => claim.id)).toEqual([
      clinicianDirective.id,
    ]);
    expect(result.suppressedModifiers[0]).toMatchObject({
      id: performance.id,
      suppressionReasonCodes: ["clinician_directive_precedence"],
      suppressedByInputIds: [clinicianDirective.id],
    });
    expect(result.clinicianDirectiveState).toBe("represented");
  });

  it("keeps POTS self-report context-only with no automatic fluid or sodium increase", () => {
    const potsSelfReport = modifier("condition:pots-self-report", {
      modifierType: "pots",
      metric: "general",
      effect: "context_only",
      authority: "condition_overlay",
      source: "condition",
      sourceId: "condition:pots:self_reported",
      contextKey: "self_reported",
    });
    const result = resolve([potsSelfReport]);

    expect(result).toMatchObject({
      status: "context_only",
      potsState: "context_only",
      clinicianDirectiveState: "none",
      targetMl: null,
      minimumMl: null,
      maximumMl: null,
      remainingMl: null,
      numericPlanAllowed: false,
    });
    expect(result.activeModifiers[0]).toMatchObject({
      id: potsSelfReport.id,
      effect: "context_only",
    });
    expect(result.activeModifiers[0]).not.toHaveProperty("amount");
    expect(result.activeModifiers[0]).not.toHaveProperty("sodiumMg");
  });

  it("represents a clinician-defined POTS protocol without turning it into a numeric plan", () => {
    const potsDirective = modifier("clinician:pots-protocol", {
      modifierType: "pots",
      effect: "supports",
      authority: "clinician",
      source: "clinician_directive",
      sourceId: "directive:pots:current",
      conflictGroup: "pots-fluid-policy",
      contextKey: "clinician_defined",
    });
    const result = resolve([potsDirective]);

    expect(result).toMatchObject({
      status: "resolved",
      potsState: "clinician_defined",
      clinicianDirectiveState: "represented",
      clinicalConflictState: "none",
      escalationRequired: false,
      numericPlanAllowed: false,
      targetMl: null,
    });
    expect(result.activeModifiers[0].sourceId).toBe(
      "directive:pots:current",
    );
  });

  it.each([
    ["renal", "fluid"],
    ["cardiac", "fluid"],
    ["sodium", "sodium"],
  ] as const)(
    "withholds a clinician POTS protocol when a %s restriction conflicts",
    (restrictionKind, metric) => {
      const potsDirective = modifier(`clinician:pots-${metric}`, {
        modifierType: "pots",
        metric,
        effect: "supports",
        authority: "clinician",
        source: "clinician_directive",
        sourceId: `directive:pots:${metric}`,
        contextKey: "clinician_defined",
      });
      const safetyRestriction = restriction(
        `clinical:${restrictionKind}-restriction`,
        metric,
        {
          modifierType: `${restrictionKind}_restriction`,
        },
      );
      const result = resolve([potsDirective, safetyRestriction]);

      expect(result).toMatchObject({
        status: "needs_review",
        potsState: "conflict_review",
        clinicianDirectiveState: "needs_review",
        clinicalConflictState: "unresolved",
        escalationRequired: true,
        numericPlanAllowed: false,
      });
      expect(result.suppressedModifiers[0]).toMatchObject({
        id: potsDirective.id,
        suppressedByInputIds: [safetyRestriction.id],
      });
    },
  );

  it("combines multiple builder contexts in stable order without overwriting any builder", () => {
    const builders = [
      "performance_nutrition",
      "diabetic",
      "glp1",
      "anti_inflammatory",
      "pregnancy",
      "fertility",
      "kids",
      "toddlers",
    ] as const;
    const contributions = builders.map((builder) =>
      createBuilderHydrationContextContribution({
        builder,
        policyVersion: POLICY_VERSION,
      }),
    );

    const forward = resolve(contributions);
    const reverse = resolve([...contributions].reverse());

    expect(forward).toEqual(reverse);
    expect(forward.status).toBe("context_only");
    expect(forward.activeModifiers).toHaveLength(builders.length);
    expect(
      forward.activeModifiers.map((claim) => claim.contextKey).sort(),
    ).toEqual([...builders].sort());
    expect(new Set(forward.activeModifiers.map((claim) => claim.id)).size).toBe(
      builders.length,
    );

    const withSpecificDirective = resolve([
      ...contributions,
      modifier("clinician:specific-fluid-directive", {
        modifierType: "clinician_protocol",
        authority: "clinician",
        source: "clinician_directive",
      }),
    ]);
    expect(withSpecificDirective.activeModifiers.filter(
      (claim) => claim.source === "builder",
    )).toHaveLength(builders.length);
  });

  it("is reproducible across input ordering and preserves source provenance", () => {
    const environment = modifier("environment:heat-exposure", {
      modifierType: "environment_context",
      effect: "context_only",
      authority: "performance",
      source: "environment",
      sourceId: "environment:manual-observation",
      contextKey: "heat_exposure",
    });
    const baseline = modifier("baseline:monitor-only", {
      modifierType: "wellness_baseline",
      metric: "general",
      effect: "context_only",
      authority: "wellness_baseline",
      source: "baseline",
      sourceId: "baseline:monitor-only",
      contextKey: "monitor_only",
    });

    const first = resolve([environment, baseline]);
    const replay = resolve([baseline, environment]);

    expect(first).toEqual(replay);
    expect(first.provenance).toEqual({
      inputIds: ["baseline:monitor-only", "environment:heat-exposure"],
      sourceIds: [
        "baseline:baseline:monitor-only",
        "environment:environment:manual-observation",
      ],
      policyVersion: POLICY_VERSION,
    });
  });

  it("ignores withheld and expired inputs and rejects numeric claims at this boundary", () => {
    const inactive = [
      modifier("performance:withheld", { status: "withheld" }),
      modifier("performance:expired", { status: "expired" }),
    ];
    expect(resolve(inactive).status).toBe("neutral");

    expect(() =>
      resolve([
        {
          ...modifier("condition:unsafe-numeric"),
          targetMl: 3_000,
        },
      ]),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("blocks on an active hard stop and escalates an explicit review claim", () => {
    const hardStop = resolve([
      restriction("safety:fluid-hard-stop", "fluid", {
        effect: "blocks",
        authority: "emergency_safety",
        hardStop: true,
      }),
    ]);
    expect(hardStop).toMatchObject({
      status: "blocked",
      escalationRequired: true,
      clinicalConflictState: "unresolved",
      numericPlanAllowed: false,
    });

    const review = resolve([
      modifier("medication:review", {
        modifierType: "medication_constraint",
        metric: "general",
        effect: "requires_review",
        authority: "organ_safety",
        source: "medication",
      }),
    ]);
    expect(review).toMatchObject({
      status: "needs_review",
      escalationRequired: true,
      clinicalConflictState: "unresolved",
      numericPlanAllowed: false,
    });
  });

  it("rejects mixed governance versions instead of silently merging them", () => {
    expect(() =>
      resolve([
        modifier("performance:wrong-policy", {
          policyVersion: "different-policy-version",
        }),
      ]),
    ).toThrow(
      expect.objectContaining({ code: "POLICY_VERSION_MISMATCH" }),
    );
  });

  it("rejects duplicate IDs instead of allowing registration order to decide", () => {
    expect(() =>
      resolve([
        modifier("duplicate"),
        modifier("duplicate", { sourceId: "different-source" }),
      ]),
    ).toThrow(expect.objectContaining({ code: "DUPLICATE_ID" }));
  });
});