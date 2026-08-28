import fs from "node:fs";
import path from "node:path";
import {
  HYDRATION_CLINICAL_MODIFIER_REGISTRY,
  HYDRATION_MODIFIER_REGISTRY_COUNTS,
  HYDRATION_MODIFIER_REGISTRY_VERSION,
  HydrationModifierRegistryError,
  createHydrationModifierFromRegistry,
  getHydrationModifierDefinition,
  getHydrationModifierRegistrySnapshotHash,
  listHydrationModifierDefinitions,
  validateHydrationModifierRegistry,
  type HydrationModifierRegistryEntry,
  type HydrationRegistryClaimInput,
} from "@shared/hydration/modifierRegistry";
import type {
  HydrationModifierAuthority,
  HydrationModifierEffect,
  HydrationModifierMetric,
  HydrationModifierSource,
} from "@shared/hydration/contracts";
import { hydrationModifierResolver } from "../services/hydration/hydrationModifierResolver";

const POLICY_VERSION = HYDRATION_MODIFIER_REGISTRY_VERSION;

function claim(
  definitionId: string,
  overrides: Partial<HydrationRegistryClaimInput> = {},
): HydrationRegistryClaimInput {
  return {
    definitionId,
    instanceId: `instance:${definitionId}`,
    source: "condition",
    sourceId: `source:${definitionId}`,
    authority: "condition_overlay",
    policyVersion: POLICY_VERSION,
    provenance: {
      sourceRecordId: `record:${definitionId}`,
      sourceTimestamp: "2026-08-27T18:30:00.000Z",
      authorityIdentity: "authority:verified",
      protocolRevision: "protocol:v1",
      populationContext: "subject-context",
    },
    ...overrides,
  };
}

function registryClaim(
  definitionId: string,
  source: HydrationModifierSource,
  authority: HydrationModifierAuthority,
  effect?: HydrationModifierEffect,
  metric?: HydrationModifierMetric,
) {
  return createHydrationModifierFromRegistry(
    claim(definitionId, {
      source,
      authority,
      ...(effect ? { effect } : {}),
      ...(metric ? { metric } : {}),
    }),
  );
}

describe("Hydration Clinical Modifier Registry", () => {
  it("has stable, sorted, unique canonical IDs and a deterministic snapshot", () => {
    const first = listHydrationModifierDefinitions();
    const replay = listHydrationModifierDefinitions();
    const ids = first.map((definition) => definition.id);

    expect(first).toBe(replay);
    expect(Object.isFrozen(first)).toBe(true);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
    expect(HYDRATION_MODIFIER_REGISTRY_COUNTS).toEqual({
      total: 43,
      active: 41,
      inactive: 2,
    });
    expect(getHydrationModifierRegistrySnapshotHash()).toBe("65efe914");
    expect(getHydrationModifierRegistrySnapshotHash(first)).toBe(
      getHydrationModifierRegistrySnapshotHash(replay),
    );
  });

  it("fails closed when a registry definition ID is duplicated", () => {
    const first = HYDRATION_CLINICAL_MODIFIER_REGISTRY[0];
    expect(() =>
      validateHydrationModifierRegistry([first, { ...first }]),
    ).toThrow(
      expect.objectContaining<Partial<HydrationModifierRegistryError>>({
        code: "DUPLICATE_ID",
      }),
    );
  });

  it("does not silently make unknown or unsupported modifiers actionable", () => {
    expect(() =>
      createHydrationModifierFromRegistry(claim("unsupported.condition")),
    ).toThrow(
      expect.objectContaining<Partial<HydrationModifierRegistryError>>({
        code: "UNKNOWN_DEFINITION",
      }),
    );

    expect(() =>
      createHydrationModifierFromRegistry(
        claim("dysautonomia.pots", {
          effect: "supports",
        }),
      ),
    ).toThrow(
      expect.objectContaining<Partial<HydrationModifierRegistryError>>({
        code: "EFFECT_NOT_ALLOWED",
      }),
    );

    expect(() =>
      hydrationModifierResolver.resolve({
        policyVersion: POLICY_VERSION,
        modifiers: [
          {
            id: "raw:unsupported",
            modifierType: "unsupported",
            metric: "fluid",
            effect: "supports",
            authority: "condition_overlay",
            source: "condition",
            sourceId: "raw-source",
            rationaleCode: "raw_unsupported",
            policyVersion: POLICY_VERSION,
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining<Partial<HydrationModifierRegistryError>>({
        code: "UNKNOWN_DEFINITION",
      }),
    );
  });

  it("prevents inactive future data seams from becoming active modifiers", () => {
    expect(
      getHydrationModifierDefinition(
        "performance_environment.future_sweat_rate",
      ).status,
    ).toBe("inactive");
    expect(() =>
      createHydrationModifierFromRegistry(
        claim("performance_environment.future_sweat_rate", {
          source: "wearable",
          authority: "performance",
        }),
      ),
    ).toThrow(
      expect.objectContaining<Partial<HydrationModifierRegistryError>>({
        code: "INACTIVE_DEFINITION",
      }),
    );
  });

  it("rejects governance-version mismatches at the registry boundary", () => {
    expect(() =>
      createHydrationModifierFromRegistry(
        claim("metabolic_endocrine.diabetes", {
          policyVersion: "unapproved-registry-version",
        }),
      ),
    ).toThrow(
      expect.objectContaining<Partial<HydrationModifierRegistryError>>({
        code: "POLICY_VERSION_MISMATCH",
      }),
    );
  });

  it("keeps POTS as an ordinary dysautonomia family with self-report context-only", () => {
    const selfReported = getHydrationModifierDefinition("dysautonomia.pots");
    const clinicianProtocol = getHydrationModifierDefinition(
      "dysautonomia.pots_clinician_protocol",
    );
    const modifier = registryClaim(
      selfReported.id,
      "condition",
      "condition_overlay",
    );

    expect(selfReported.family).toBe("dysautonomia");
    expect(clinicianProtocol.family).toBe("dysautonomia");
    expect(selfReported.governanceMode).toBe("context_only");
    expect(modifier).toMatchObject({
      modifierType: "pots",
      registryDefinitionId: "dysautonomia.pots",
      registryFamily: "dysautonomia",
      effect: "context_only",
    });
    expect(modifier).not.toHaveProperty("targetMl");
    expect(modifier).not.toHaveProperty("sodiumMg");
  });

  it("preserves renal and fluid safety precedence through the existing resolver", () => {
    const performance = registryClaim(
      "performance_environment.endurance_activity",
      "builder",
      "performance",
      "supports",
      "fluid",
    );
    const renalRestriction = registryClaim(
      "renal.fluid_restriction",
      "clinician_directive",
      "organ_safety",
      "limits",
      "fluid",
    );
    const result = hydrationModifierResolver.resolve({
      modifiers: [performance, renalRestriction],
      policyVersion: POLICY_VERSION,
    });

    expect(result.activeRestrictions[0]).toMatchObject({
      id: renalRestriction.id,
      registryDefinitionId: "renal.fluid_restriction",
      authority: "organ_safety",
    });
    expect(result.suppressedModifiers[0]).toMatchObject({
      id: performance.id,
      suppressedByInputIds: [renalRestriction.id],
      suppressionReasonCodes: ["organ_safety_precedence"],
    });
    expect(result.numericPlanAllowed).toBe(false);
  });

  it("withholds a clinician POTS protocol when renal sodium safety conflicts", () => {
    const potsProtocol = registryClaim(
      "dysautonomia.pots_clinician_protocol",
      "clinician_directive",
      "clinician",
      "supports",
      "sodium",
    );
    const sodiumRestriction = registryClaim(
      "renal.sodium_electrolyte_restriction",
      "clinician_directive",
      "organ_safety",
      "limits",
      "sodium",
    );
    const result = hydrationModifierResolver.resolve({
      modifiers: [potsProtocol, sodiumRestriction],
      policyVersion: POLICY_VERSION,
    });

    expect(result).toMatchObject({
      status: "needs_review",
      potsState: "conflict_review",
      clinicianDirectiveState: "needs_review",
      clinicalConflictState: "unresolved",
      escalationRequired: true,
      numericPlanAllowed: false,
      targetMl: null,
      minimumMl: null,
      maximumMl: null,
      remainingMl: null,
    });
    expect(result.suppressedModifiers[0].id).toBe(potsProtocol.id);
  });

  it("withholds a clinician POTS protocol behind an equal-authority clinician fluid restriction in either order", () => {
    const potsProtocol = registryClaim(
      "dysautonomia.pots_clinician_protocol",
      "clinician_directive",
      "clinician",
      "supports",
      "fluid",
    );
    const fluidRestriction = registryClaim(
      "cardiovascular.clinician_fluid_restriction",
      "clinician_directive",
      "clinician",
      "limits",
      "fluid",
    );

    for (const modifiers of [
      [potsProtocol, fluidRestriction],
      [fluidRestriction, potsProtocol],
    ]) {
      const result = hydrationModifierResolver.resolve({
        modifiers,
        policyVersion: POLICY_VERSION,
      });
      expect(result).toMatchObject({
        status: "needs_review",
        potsState: "conflict_review",
        clinicianDirectiveState: "needs_review",
        clinicalConflictState: "unresolved",
        escalationRequired: true,
        numericPlanAllowed: false,
      });
      expect(result.suppressedModifiers[0]).toMatchObject({
        id: potsProtocol.id,
        suppressedByInputIds: [fluidRestriction.id],
      });
    }
  });

  it.each([
    "bariatric.preoperative_liquid_diet",
    "bariatric.postoperative_stage",
    "bariatric.clear_liquid_diet",
    "bariatric.full_liquid_diet",
  ])(
    "represents %s without generating numeric recommendations",
    (definitionId) => {
      const modifier = registryClaim(
        definitionId,
        "builder",
        "condition_overlay",
      );

      expect(modifier).toMatchObject({
        registryDefinitionId: definitionId,
        registryFamily: "bariatric",
        effect: "context_only",
      });
      expect(modifier).not.toHaveProperty("targetMl");
      expect(modifier).not.toHaveProperty("remainingMl");
      expect(modifier).not.toHaveProperty("recommendation");
    },
  );

  it("produces the same canonical interpretation regardless of builder order", () => {
    const modifiers = [
      registryClaim(
        "metabolic_endocrine.diabetes",
        "builder",
        "condition_overlay",
      ),
      registryClaim(
        "medication_treatment.glp1_therapy",
        "builder",
        "condition_overlay",
      ),
      registryClaim(
        "life_stage.pregnancy",
        "builder",
        "condition_overlay",
      ),
    ];
    const forward = hydrationModifierResolver.resolve({
      modifiers,
      policyVersion: POLICY_VERSION,
    });
    const reverse = hydrationModifierResolver.resolve({
      modifiers: [...modifiers].reverse(),
      policyVersion: POLICY_VERSION,
    });

    expect(forward).toEqual(reverse);
    expect(forward.activeModifiers.map(
      (modifier) => modifier.registryDefinitionId,
    ).sort()).toEqual([
      "life_stage.pregnancy",
      "medication_treatment.glp1_therapy",
      "metabolic_endocrine.diabetes",
    ]);
  });

  it("preserves source authority and provenance identity in the resolver claim", () => {
    const modifier = registryClaim(
      "cardiovascular.clinician_fluid_restriction",
      "clinician_directive",
      "clinician",
      "limits",
      "fluid",
    );

    expect(modifier).toMatchObject({
      source: "clinician_directive",
      sourceId:
        "source:cardiovascular.clinician_fluid_restriction",
      authority: "clinician",
      policyVersion: POLICY_VERSION,
      registryDefinitionId:
        "cardiovascular.clinician_fluid_restriction",
    });
  });

  it("contains no persistence, route, LLM, or numeric-planning implementation", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "shared/hydration/modifierRegistry.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/server\/db|drizzle|\.insert\(|\.update\(|\.delete\(/);
    expect(source).not.toMatch(/express|Router\(|app\.(get|post|put|patch|delete)\(/);
    expect(source).not.toMatch(/openai|llm|generateText|chat\.completions/i);
    expect(source).not.toMatch(
      /\b(targetMl|minimumMl|maximumMl|remainingMl|sodiumMg|electrolyteAmount)\b/,
    );
  });
});