import type { ExistingDeterministicChecks } from "../../services/pairingAdvisor/deterministicSafetyBridge";
import {
  createStrictOwnerAuthority, type StrictOwnerReceipt,
} from "../../services/pairingAdvisor/readiness/authority";
import { createDeterministicValidation } from "../../services/pairingAdvisor/readiness/deterministic";
import { harness, intent, owner, strictReceipt, water } from "./fixtures";

jest.mock("../../services/safetyPinService", () => new Proxy({}, {
  get: (_target, key) => key === "__esModule" ? false : () => { throw new Error("Override forbidden"); },
}));
jest.mock("../../lib/auditLog", () => ({ logAudit: () => { throw new Error("Audit forbidden"); } }));
const protocol = jest.requireActual("../../services/protocolEnvelope") as {
  buildGuestEnvelope: () => Record<string, unknown>;
  scanGeneratedOutput: ExistingDeterministicChecks["scanGeneratedOutput"];
};
const pureSafety = jest.requireActual("../../services/safetyProfileService") as Pick<ExistingDeterministicChecks, "enforceSafetyProfileSync">;
const evidence = jest.requireActual("../../services/foodCompositionEvidence") as Pick<ExistingDeterministicChecks, "requiresVerifiedIngredientEvidence">;
const alcohol = jest.requireActual("../../services/guardrails/beverageMedicalRules") as Pick<ExistingDeterministicChecks, "containsAlcoholContent">;
const storage = require("../pairingAdvisorSafety/storageStub.cjs");
const checks: ExistingDeterministicChecks = {
  ...pureSafety, ...evidence, ...alcohol, scanGeneratedOutput: protocol.scanGeneratedOutput,
};
const deterministic = createDeterministicValidation(checks);
function clinicalHarness(extra: Record<string, unknown> = {}, gate: "eligible" | "restricted" = "eligible") {
  const receipt = strictReceipt();
  receipt.envelope = { ...protocol.buildGuestEnvelope(), userId: owner.accountId, ...extra };
  const resolveOwner = jest.fn(async () => receipt);
  const h = harness({
    authority: {
      resolveOwner, requiresVerifiedIngredients: checks.requiresVerifiedIngredientEvidence,
      consumptionGate: () => gate, constraints: () => "Synthetic established constraints",
    },
    deterministic,
  });
  h.state.assessment = intent("consumption"); h.state.response = water();
  return { ...h, receipt, strictResolve: resolveOwner };
}
beforeEach(() => storage.reset());
afterEach(() => {
  expect(storage.calls.direct).toEqual([]); expect(storage.calls.client).toEqual([]);
  expect(storage.calls.connects).toBe(0); expect(storage.calls.inserts).toBe(0);
  expect(storage.calls.selects).toEqual([]);
});

describe("B: strict-owner adapter completeness without synthetic-only contracts", () => {
  test("complete strict resolver projection is accepted, immutable and owner-scoped", async () => {
    const receipt = strictReceipt();
    const resolveOwner = jest.fn(async () => receipt);
    const resolve = createStrictOwnerAuthority({
      resolveOwner, requiresVerifiedIngredients: () => false, consumptionGate: () => "eligible",
      constraints: () => "Synthetic constraints",
    });
    const signal = new AbortController().signal;
    const result = await resolve(owner.accountId, signal);
    expect(resolveOwner).toHaveBeenCalledWith(owner.accountId, signal);
    expect(result.kind).toBe("strict_owner_authority");
    expect(result).not.toHaveProperty("mode", "synthetic_test_only");
    expect(Object.isFrozen(result.envelope)).toBe(true);
  });
  test.each([
    "owner_profile", "timezone", "glp1_activation", "personal_supports", "provider_interventions",
    "diabetes_context", "glp1_tolerance", "competition", "condition_guidance", "daily_state",
    "prescription", "glp1_guardrails", "performance", "write_boundary",
  ] as const)("missing required source %s fails before interpretation", async key => {
    const h = harness();
    const receipt = strictReceipt(); delete receipt.sources[key];
    h.state.authority = receipt;
    expect(await h.send()).toMatchObject({ code: "AUTHORITY_UNAVAILABLE" });
    expect(h.execute).not.toHaveBeenCalled();
  });
  test.each([
    ["owner mismatch", (r: ReturnType<typeof strictReceipt>) => { r.ownerId = "other"; }],
    ["subject mismatch", (r: ReturnType<typeof strictReceipt>) => { r.subjectId = "household-member"; }],
    ["envelope mismatch", (r: ReturnType<typeof strictReceipt>) => { r.envelope = { ...r.envelope as object, userId: "other" }; }],
    ["missing nested result", (r: ReturnType<typeof strictReceipt>) => { delete (r.envelope as Record<string, unknown>).dailyNutritionState; }],
    ["required failure hidden by envelope", (r: ReturnType<typeof strictReceipt>) => { r.sources.daily_state = { status: "incomplete", reasonCode: "read_failed" }; }],
    ["unobserved source value", (r: ReturnType<typeof strictReceipt>) => { r.sources.performance = { status: "success", basis: "existing_default" }; }],
    ["invalid timezone", (r: ReturnType<typeof strictReceipt>) => { r.sources.timezone = { status: "success", value: { timezone: "not-a-zone", localDate: "2026-10-19" }, basis: "stored" }; }],
    ["missing prescription", (r: ReturnType<typeof strictReceipt>) => { r.sources.prescription = { status: "success", value: {}, basis: "calculated" }; }],
    ["unaccounted writes", (r: ReturnType<typeof strictReceipt>) => { r.sources.write_boundary = { status: "success", value: "unknown", basis: "calculated" }; }],
  ] as const)("%s cannot issue a ready receipt", async (_name, corrupt) => {
    const h = harness(); const receipt = strictReceipt(); corrupt(receipt); h.state.authority = receipt;
    expect(await h.send()).toMatchObject({ code: "AUTHORITY_UNAVAILABLE" });
    expect(h.execute).not.toHaveBeenCalled();
  });
  test("a synthetic-only legacy receipt cannot masquerade as strict authority", async () => {
    const h = harness();
    h.state.authority = {
      source: "synthetic_fixture", ownerId: owner.accountId, subjectId: owner.accountId,
      scope: "account_owner", required: { allergies: true, protocols: true, clinical: true, nestedResolution: true },
      sideEffects: "none", envelope: {}, constraints: "", consumptionGate: "eligible",
    } as unknown as StrictOwnerReceipt;
    expect(await h.send()).toMatchObject({ code: "AUTHORITY_UNAVAILABLE" });
  });
  test("optional preference failure does not replace or invalidate complete safety authority", async () => {
    const h = harness(); const receipt = strictReceipt();
    receipt.sources.preferences = { status: "incomplete", reasonCode: "read_failed" };
    h.state.authority = receipt;
    expect((await h.send()).status).toBe("accepted");
  });
  test("resolver exceptions map to controlled authority errors without provider calls", async () => {
    const h = harness(); h.resolveOwner.mockRejectedValueOnce(new Error("private database details"));
    const result = await h.send();
    expect(result).toMatchObject({ code: "AUTHORITY_UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toContain("database details");
    expect(h.execute).not.toHaveBeenCalled();
  });
  test("successful clinical prescription source must match the returned prescription", async () => {
    const h = harness(); const receipt = strictReceipt();
    receipt.prescription = { synthetic: "a" };
    receipt.sources.prescription = { status: "success", value: { synthetic: "b" }, basis: "calculated" };
    h.state.authority = receipt;
    expect(await h.send()).toMatchObject({ code: "AUTHORITY_UNAVAILABLE" });
  });
});

describe("B: actual unchanged deterministic rules with synthetic envelopes only", () => {
  test.each([
    { allergies: ["peanut"] },
    { alphaGalContext: { active: true, dairyTolerance: "no", gelatinRestriction: "yes" } },
    { pregnancySupportContext: { active: true, stage: "trimester-2" } },
  ])("ingredient evidence requirement blocks consumption: %j", async profile => {
    const h = clinicalHarness(profile);
    expect(await h.send()).toMatchObject({ response: { outcome: "restricted", reason: "INGREDIENT_EVIDENCE_REQUIRED" } });
    expect(h.execute).toHaveBeenCalledTimes(1);
  });
  test("restricted owner can ask education without being offered personal consumption", async () => {
    const h = clinicalHarness({ allergies: ["milk"] });
    h.state.assessment = intent("education");
    // A closed education schema must be used; no hidden recommendation cards.
    h.state.response = {
      version: 1, requestId: "ignored", conversationId: "ignored", contextRevision: 0,
      outcome: "education", education: { paragraphs: ["General acidity principles."], followUps: [] },
    };
    expect(await h.send()).toMatchObject({ response: { outcome: "education" } });
  });
  test("mixed request retains fixed restriction and reviews education without consumption constraints", async () => {
    const h = clinicalHarness({ allergies: ["milk"] });
    h.state.assessment = intent("mixed");
    h.state.response = {
      version: 1, requestId: "ignored", conversationId: "ignored", contextRevision: 0,
      outcome: "education", education: { paragraphs: ["General tannin principles."], followUps: [] },
    };
    expect(await h.send()).toMatchObject({
      response: { outcome: "restricted", reason: "INGREDIENT_EVIDENCE_REQUIRED", education: { paragraphs: ["General tannin principles."] } },
    });
    expect(h.execute.mock.calls[1][0].input).toHaveProperty("ownerConstraints", null);
    expect(h.execute.mock.calls[2][0].input).toHaveProperty("candidate.outcome", "restricted");
  });
  test("established active consumption restriction is not rewritten by the model", async () => {
    const h = clinicalHarness({}, "restricted");
    expect(await h.send()).toMatchObject({ response: { outcome: "restricted", reason: "ACTIVE_SAFETY_RESTRICTION" } });
    expect(h.execute).toHaveBeenCalledTimes(1);
  });
  test("actual vegan input check blocks an explicit conflict before generation", async () => {
    const h = clinicalHarness({ dietaryIdentity: ["vegan"] });
    expect(await h.send({ message: "Choose a milk drink." })).toMatchObject({
      response: { outcome: "restricted", reason: "ACTIVE_SAFETY_RESTRICTION" },
    });
    expect(h.execute).toHaveBeenCalledTimes(1);
  });
  test("safe synthetic recommendation passes actual scanners", async () => {
    expect(await clinicalHarness().send()).toMatchObject({ response: { outcome: "recommendation" } });
  });
  test.each(["name", "explanation", "servingAdvice", "narrative", "followUps", "alternative"] as const)(
    "alcohol prohibited by established Halal rule is found in %s", async field => {
      const h = clinicalHarness({ dietaryIdentity: ["halal"] });
      const response = water();
      if (response.outcome !== "recommendation") throw new Error("Expected card");
      if (field === "narrative" || field === "followUps") response[field] = [{ text: "Try whiskey.", recommendationIds: ["water"] }];
      else if (field === "alternative") {
        response.recommendations.push({ ...response.recommendations[0], id: "alt", name: "whiskey" });
        response.recommendations[0].alternativeIds = ["alt"];
      } else response.recommendations[0][field] = "Try whiskey.";
      h.state.response = response;
      expect(await h.send()).toMatchObject({ code: "VALIDATION_FAILED" });
      expect(h.execute).toHaveBeenCalledTimes(2);
    },
  );
  test("fresh owner resolution applies new ingredient requirements on the next turn", async () => {
    const h = clinicalHarness();
    expect((await h.send()).status).toBe("accepted");
    h.receipt.envelope = { ...h.receipt.envelope as object, allergies: ["peanut"] };
    expect(await h.send()).toMatchObject({ response: { reason: "INGREDIENT_EVIDENCE_REQUIRED" } });
    expect(h.strictResolve).toHaveBeenCalledTimes(2);
  });
});
