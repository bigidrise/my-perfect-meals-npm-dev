import fs from "node:fs";
import path from "node:path";
import {
  HYDRATION_MODIFIER_REGISTRY_VERSION,
  createHydrationModifierFromRegistry,
  type HydrationRegistryClaimInput,
} from "@shared/hydration/modifierRegistry";
import type {
  HydrationIntakeEvent,
  HydrationPlanningEligibilityInput,
} from "@shared/hydration/contracts";
import {
  createHydrationCanonicalIntakeSnapshot,
  evaluateHydrationPlanningEligibility,
  type CreateHydrationCanonicalIntakeSnapshotInput,
} from "../services/hydration/hydrationPlanningEligibility";

const POLICY_VERSION = HYDRATION_MODIFIER_REGISTRY_VERSION;
const SUBJECT_ID = "subject-eligibility-1";
const LOCAL_DATE = "2026-08-27";
const TIMEZONE = "America/Chicago";

function snapshot(
  overrides: Partial<CreateHydrationCanonicalIntakeSnapshotInput> = {},
) {
  return createHydrationCanonicalIntakeSnapshot({
    subjectUserId: SUBJECT_ID,
    localDate: LOCAL_DATE,
    timezone: TIMEZONE,
    status: "complete",
    observedAt: "2026-08-27T18:30:00.000Z",
    events: [event()],
    ...overrides,
  });
}

function event(
  overrides: Partial<
    Pick<
      HydrationIntakeEvent,
      | "id"
      | "subjectUserId"
      | "localDate"
      | "occurredTimezone"
      | "source"
      | "sourceEventId"
      | "payloadHash"
      | "occurredAt"
      | "enteredAt"
    >
  > = {},
) {
  return {
    id: "event-1",
    subjectUserId: SUBJECT_ID,
    localDate: LOCAL_DATE,
    occurredTimezone: "UTC",
    source: "legacy_manual" as const,
    sourceEventId: "legacy-1",
    payloadHash: "payload-v1",
    occurredAt: "2026-08-27T18:00:00.000Z",
    enteredAt: "2026-08-27T18:01:00.000Z",
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<HydrationPlanningEligibilityInput> = {},
): HydrationPlanningEligibilityInput {
  return {
    subjectUserId: SUBJECT_ID,
    localDate: LOCAL_DATE,
    timezone: TIMEZONE,
    policyVersion: POLICY_VERSION,
    access: {
      authenticatedUserId: SUBJECT_ID,
      subjectUserId: SUBJECT_ID,
      mode: "self",
      authorizationStatus: "allowed",
    },
    intake: snapshot(),
    modifiers: [],
    dataQuality: {
      stale: false,
      provenanceComplete: true,
      missingDataCodes: [],
      unsupportedContextCodes: [],
    },
    ...overrides,
  };
}

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

function registeredModifier(
  definitionId: string,
  overrides: Partial<HydrationRegistryClaimInput> = {},
) {
  return createHydrationModifierFromRegistry(
    claim(definitionId, overrides),
  );
}

function assertNonnumericResult(result: unknown) {
  expect(result).toMatchObject({
    numericPlanningPermission: "disabled",
  });
  expect(result).not.toHaveProperty("targetMl");
  expect(result).not.toHaveProperty("minimumMl");
  expect(result).not.toHaveProperty("maximumMl");
  expect(result).not.toHaveProperty("remainingMl");
  expect(result).not.toHaveProperty("sodiumMg");
  expect(result).not.toHaveProperty("electrolyteAmount");
}

describe("Hydration Planning Eligibility Gate", () => {
  it("returns PLAN_ELIGIBLE for complete, authorized, governed context only", () => {
    const result = evaluateHydrationPlanningEligibility(baseInput());

    expect(result).toMatchObject({
      outcome: "PLAN_ELIGIBLE",
      resolverStatus: "neutral",
      policyVersion: POLICY_VERSION,
      subjectUserId: SUBJECT_ID,
      localDate: LOCAL_DATE,
      timezone: TIMEZONE,
    });
    expect(result.reasons).toEqual([
      expect.objectContaining({
        code: "ELIGIBILITY_INPUTS_GOVERNED",
        disposition: "informational",
      }),
    ]);
    assertNonnumericResult(result);
  });

  it("returns PLAN_WITHHELD for a hard safety restriction", () => {
    const result = evaluateHydrationPlanningEligibility(
      baseInput({
        modifiers: [
          registeredModifier("renal.fluid_restriction", {
            source: "clinician_directive",
            authority: "organ_safety",
            hardStop: true,
          }),
        ],
      }),
    );

    expect(result).toMatchObject({
      outcome: "PLAN_WITHHELD",
      resolverStatus: "blocked",
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "RESOLVER_HARD_STOP",
          disposition: "withhold",
        }),
      ]),
    );
    assertNonnumericResult(result);
  });

  it("returns NEEDS_REVIEW for unresolved POTS and renal safety conflict", () => {
    const result = evaluateHydrationPlanningEligibility(
      baseInput({
        modifiers: [
          registeredModifier("dysautonomia.pots_clinician_protocol", {
            source: "clinician_directive",
            authority: "clinician",
            metric: "sodium",
          }),
          registeredModifier("renal.sodium_electrolyte_restriction", {
            source: "clinician_directive",
            authority: "organ_safety",
            effect: "limits",
            metric: "sodium",
          }),
        ],
      }),
    );

    expect(result).toMatchObject({
      outcome: "NEEDS_REVIEW",
      resolverStatus: "needs_review",
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "RESOLVER_REVIEW_REQUIRED",
          disposition: "review",
        }),
      ]),
    );
    assertNonnumericResult(result);
  });

  it("withholds unsupported contexts and reviews stale or incomplete intake", () => {
    const unsupported = evaluateHydrationPlanningEligibility(
      baseInput({
        dataQuality: {
          stale: false,
          provenanceComplete: true,
          missingDataCodes: [],
          unsupportedContextCodes: ["unapproved_heat_adjustment"],
        },
      }),
    );
    const stale = evaluateHydrationPlanningEligibility(
      baseInput({
        intake: snapshot({ status: "partial" }),
        dataQuality: {
          stale: true,
          provenanceComplete: false,
          missingDataCodes: ["intake_page_incomplete"],
          unsupportedContextCodes: [],
        },
      }),
    );

    expect(unsupported.outcome).toBe("PLAN_WITHHELD");
    expect(unsupported.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNSUPPORTED_CONTEXT",
          detailCodes: ["unapproved_heat_adjustment"],
        }),
      ]),
    );
    expect(stale.outcome).toBe("NEEDS_REVIEW");
    expect(stale.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INTAKE_PARTIAL" }),
        expect.objectContaining({ code: "INTAKE_STALE" }),
        expect.objectContaining({
          code: "INTAKE_PROVENANCE_INCOMPLETE",
        }),
        expect.objectContaining({
          code: "MISSING_REQUIRED_INPUT",
          detailCodes: ["intake_page_incomplete"],
        }),
      ]),
    );
    assertNonnumericResult(unsupported);
    assertNonnumericResult(stale);
  });

  it("fails closed for denied, unavailable, and cross-subject access", () => {
    const denied = evaluateHydrationPlanningEligibility(
      baseInput({
        access: {
          authenticatedUserId: "professional-1",
          subjectUserId: SUBJECT_ID,
          mode: "delegated",
          authorizationStatus: "denied",
        },
      }),
    );
    const unavailable = evaluateHydrationPlanningEligibility(
      baseInput({
        access: {
          authenticatedUserId: SUBJECT_ID,
          subjectUserId: SUBJECT_ID,
          mode: "self",
          authorizationStatus: "unavailable",
        },
      }),
    );
    const mismatch = evaluateHydrationPlanningEligibility(
      baseInput({
        access: {
          authenticatedUserId: "other-subject",
          subjectUserId: "other-subject",
          mode: "self",
          authorizationStatus: "allowed",
        },
      }),
    );

    for (const result of [denied, unavailable, mismatch]) {
      expect(result.outcome).toBe("NEEDS_REVIEW");
      assertNonnumericResult(result);
    }
    expect(denied.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ACCESS_NOT_AUTHORIZED" }),
      ]),
    );
    expect(unavailable.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ACCESS_AUTHORIZATION_UNAVAILABLE",
        }),
      ]),
    );
    expect(mismatch.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ACCESS_SUBJECT_MISMATCH" }),
      ]),
    );
  });

  it("changes the canonical snapshot hash when intake is corrected and stays order-independent", () => {
    const original = snapshot();
    const corrected = snapshot({
      events: [
        event({
          payloadHash: "payload-v2",
        }),
      ],
    });
    const forward = evaluateHydrationPlanningEligibility(
      baseInput({ intake: original }),
    );
    const reverse = evaluateHydrationPlanningEligibility(
      baseInput({
        intake: original,
        modifiers: [
          registeredModifier("life_stage.pregnancy"),
          registeredModifier("metabolic_endocrine.diabetes"),
        ],
      }),
    );
    const reversedAgain = evaluateHydrationPlanningEligibility(
      baseInput({
        intake: original,
        modifiers: [
          registeredModifier("metabolic_endocrine.diabetes"),
          registeredModifier("life_stage.pregnancy"),
        ],
      }),
    );

    expect(original.snapshotHash).not.toBe(corrected.snapshotHash);
    expect(original.eventIds).toEqual(["event-1"]);
    expect(corrected.eventIds).toEqual(["event-1"]);
    expect(original.eventFingerprints).not.toEqual(
      corrected.eventFingerprints,
    );
    expect(forward.outcome).toBe("PLAN_ELIGIBLE");
    expect(reverse).toEqual(reversedAgain);
    assertNonnumericResult(forward);
    assertNonnumericResult(reverse);
  });

  it("rejects cross-subject events and reviews tampered intake snapshots", () => {
    expect(() =>
      snapshot({
        events: [event({ subjectUserId: "other-subject" })],
      }),
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_INPUT",
      }),
    );

    const canonical = snapshot();
    const result = evaluateHydrationPlanningEligibility(
      baseInput({
        intake: {
          ...canonical,
          snapshotHash: "tampered-snapshot",
        },
      }),
    );

    expect(result.outcome).toBe("NEEDS_REVIEW");
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INTAKE_SNAPSHOT_INVALID",
          disposition: "review",
        }),
      ]),
    );
    assertNonnumericResult(result);
  });

  it("deduplicates identical event replays and rejects conflicting event or source identities", () => {
    expect(snapshot({ events: [event(), event()] })).toEqual(snapshot());
    expect(() => snapshot({
      events: [event(), event({ payloadHash: "different-payload" })],
    })).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
    expect(() => snapshot({
      events: [event(), event({ id: "second-event-same-source" })],
    })).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it.each([
    { payloadHash: "" },
    { occurredAt: "not-a-timestamp" },
    { enteredAt: "not-a-timestamp" },
    { occurredTimezone: "Not/A_Timezone" },
    { localDate: "2026-02-30" },
    { sourceEventId: "" },
  ])("rejects incomplete canonical event evidence %j", (overrides) => {
    expect(() => snapshot({ events: [event(overrides)] })).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("scopes canonical events by the requested local day, not their legacy UTC date", () => {
    const lateLocalEvent = event({
      occurredAt: "2026-08-28T03:30:00.000Z",
      localDate: "2026-08-28",
    });
    expect(snapshot({ events: [lateLocalEvent] }).eventIds).toEqual(["event-1"]);
    expect(() => snapshot({
      events: [event({ occurredAt: "2026-08-28T06:30:00.000Z" })],
    })).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
    expect(() => snapshot({ timezone: "Not/A_Timezone" })).toThrow(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("reflects removed events without creating a competing intake ledger", () => {
    const before = snapshot();
    const after = snapshot({ events: [] });
    expect(after.snapshotHash).not.toBe(before.snapshotHash);
    expect(after.eventIds).toEqual([]);
    const result = evaluateHydrationPlanningEligibility(baseInput({ intake: after }));
    expect(result.outcome).toBe("PLAN_ELIGIBLE");
    expect(result.provenance.intakeEventIds).toEqual([]);
    expect(result).toEqual(evaluateHydrationPlanningEligibility(baseInput({ intake: after })));
    assertNonnumericResult(result);
  });

  it.each(["withheld", "expired"] as const)(
    "reviews otherwise valid %s registry claims instead of ignoring them",
    (status) => {
      const modifier = registeredModifier("metabolic_endocrine.diabetes", { status });
      const result = evaluateHydrationPlanningEligibility(baseInput({ modifiers: [modifier] }));
      expect(result.outcome).toBe("NEEDS_REVIEW");
      expect(result.reasons).toContainEqual(expect.objectContaining({
        code: "REGISTRY_CLAIM_INACTIVE",
        inputIds: [modifier.id],
        sourceIds: [`${modifier.source}:${modifier.sourceId}`],
        detailCodes: [status],
      }));
      expect(result.provenance.resolverInputIds).toEqual([modifier.id]);
      expect(result.provenance.resolverSourceIds).toEqual([`${modifier.source}:${modifier.sourceId}`]);
      assertNonnumericResult(result);
    },
  );

  it("returns deterministic review reasons for reordered invalid claims including malformed IDs", () => {
    const modifiers = [
      { id: "unknown-z", status: "active" },
      { id: "unknown-a", status: "expired" },
      { id: "" },
      { id: "x".repeat(201) },
    ];
    const forward = evaluateHydrationPlanningEligibility(baseInput({ modifiers }));
    expect(forward).toEqual(evaluateHydrationPlanningEligibility(
      baseInput({ modifiers: [...modifiers].reverse() }),
    ));
    expect(forward.outcome).toBe("NEEDS_REVIEW");
    assertNonnumericResult(forward);
  });

  it("returns structured review at the full supported invalid-claim batch size", () => {
    const modifiers = Array.from({ length: 500 }, (_, index) => ({ id: `invalid-${index}` }));
    const result = evaluateHydrationPlanningEligibility(baseInput({ modifiers }));
    expect(result.outcome).toBe("NEEDS_REVIEW");
    expect(result.reasons.filter((reason) => reason.code === "REGISTRY_CLAIM_INVALID")).toHaveLength(500);
    expect(result.reasons.some((reason) => reason.code === "RESOLVER_REVIEW_REQUIRED")).toBe(true);
    assertNonnumericResult(result);
  });

  it("requires a delegated authorization reference and preserves allowed delegated scope", () => {
    const access = {
      authenticatedUserId: "verified-professional",
      subjectUserId: SUBJECT_ID,
      mode: "delegated" as const,
      authorizationStatus: "allowed" as const,
    };
    expect(evaluateHydrationPlanningEligibility(baseInput({ access })).outcome).toBe("NEEDS_REVIEW");
    const result = evaluateHydrationPlanningEligibility(baseInput({
      access: { ...access, authorizationReference: "verified-current-relationship" },
    }));
    expect(result.outcome).toBe("PLAN_ELIGIBLE");
    expect(result.subjectUserId).toBe(SUBJECT_ID);
    assertNonnumericResult(result);
  });

  it("preserves the full source reference when a governed source ID is at its allowed limit", () => {
    const modifier = registeredModifier("metabolic_endocrine.diabetes", {
      sourceId: "s".repeat(200),
    });
    const result = evaluateHydrationPlanningEligibility(baseInput({ modifiers: [modifier] }));
    expect(result.outcome).toBe("PLAN_ELIGIBLE");
    expect(result.provenance.resolverSourceIds).toEqual([`condition:${"s".repeat(200)}`]);
    assertNonnumericResult(result);
  });

  it("reuses general-scope POTS conflict detection from the shared resolver", () => {
    const modifiers = [
      registeredModifier("dysautonomia.pots", { metric: "general" }),
      registeredModifier("cardiovascular.clinician_fluid_restriction", {
        source: "clinician_directive", authority: "clinician", effect: "limits", metric: "fluid",
      }),
    ];
    const result = evaluateHydrationPlanningEligibility(baseInput({ modifiers }));
    expect(result).toEqual(evaluateHydrationPlanningEligibility(
      baseInput({ modifiers: [...modifiers].reverse() }),
    ));
    expect(result).toMatchObject({ outcome: "NEEDS_REVIEW", resolverStatus: "needs_review" });
    assertNonnumericResult(result);
  });

  it("turns resolver validation failures into NEEDS_REVIEW instead of fallback eligibility", () => {
    const result = evaluateHydrationPlanningEligibility(
      baseInput({
        modifiers: [
          {
            id: "unknown-raw-claim",
            modifierType: "unsupported",
            metric: "fluid",
            effect: "supports",
            authority: "condition_overlay",
            source: "condition",
            sourceId: "raw-source",
            rationaleCode: "raw_claim",
            policyVersion: POLICY_VERSION,
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      outcome: "NEEDS_REVIEW",
      resolverStatus: "unavailable",
    });
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "RESOLVER_REVIEW_REQUIRED",
          source: "resolver",
        }),
      ]),
    );
    assertNonnumericResult(result);
  });

  it("rejects non-registry policy versions and unregistered claims at the eligibility boundary", () => {
    const result = evaluateHydrationPlanningEligibility(
      baseInput({
        policyVersion: "unapproved-eligibility-policy",
        modifiers: [
          {
            id: "unregistered-claim",
            modifierType: "unregistered",
            metric: "fluid",
            effect: "context_only",
            authority: "condition_overlay",
            source: "condition",
            sourceId: "unregistered-source",
            rationaleCode: "unregistered",
            policyVersion: "unapproved-eligibility-policy",
          },
        ],
      }),
    );

    expect(result.outcome).toBe("NEEDS_REVIEW");
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "REGISTRY_POLICY_NOT_APPROVED",
          disposition: "review",
        }),
        expect.objectContaining({
          code: "REGISTRY_CLAIM_INVALID",
          inputIds: ["unregistered-claim"],
        }),
      ]),
    );
    assertNonnumericResult(result);
  });

  it.each(["active", "withheld", "expired"] as const)(
    "rejects a %s registry claim when required provenance is missing",
    (status) => {
      const valid = registeredModifier(
        "metabolic_endocrine.diabetes",
      );
      const { registryProvenance: _removed, ...withoutProvenance } =
        valid;
      const result = evaluateHydrationPlanningEligibility(
        baseInput({
          modifiers: [
            {
              ...withoutProvenance,
              status,
            },
          ],
        }),
      );

      expect(result.outcome).toBe("NEEDS_REVIEW");
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "REGISTRY_CLAIM_INVALID",
            inputIds: [valid.id],
          }),
        ]),
      );
      assertNonnumericResult(result);
    },
  );

  it("contains no persistence, route, numeric-plan, or recommendation implementation", () => {
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "server/services/hydration/hydrationPlanningEligibility.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/from\s+["'][^"']*(?:server\/db|drizzle)/);
    expect(source).not.toMatch(/\bdb\.(insert|update|delete)\(/);
    expect(source).not.toMatch(/express|Router\(|app\.(get|post|put|patch|delete)\(/);
    expect(source).not.toMatch(
      /\b(targetMl|minimumMl|maximumMl|remainingMl|sodiumMg|electrolyteAmount|recommendation)\b/,
    );
  });
});