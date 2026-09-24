import type { HealthProtocolRecord } from "../../shared/healthProtocolState";
import { resolveHealthProtocolState } from "../services/healthProtocols/resolveHealthProtocolState";

const user = (protocol: HealthProtocolRecord["protocol"], status: HealthProtocolRecord["status"] = "active"): HealthProtocolRecord =>
  ({ id: `${protocol}-user`, protocol, source: "user", status });
const resolve = (
  records: HealthProtocolRecord[],
  builder: Parameters<typeof resolveHealthProtocolState>[0]["builder"] = "anti_inflammatory",
  relationshipStatus: Record<string, "active" | "ended"> = {},
) => resolveHealthProtocolState({ records, builder, relationshipStatus });

describe("future health-protocol source-of-truth contract (not yet live)", () => {
  it("keeps anti-inflammatory Builder separate from GLP-1 health state", () => {
    const onlyBuilder = resolve([]);
    expect(onlyBuilder.activeHealthContext).toEqual([]);
    expect(onlyBuilder.effectiveForFood).toEqual(["anti_inflammatory"]);
    const combined = resolve([user("glp1")]);
    expect(combined.activeHealthContext).toEqual(["glp1"]);
    expect(combined.effectiveForFood).toEqual(["glp1", "anti_inflammatory"]);
  });

  it("does not activate discontinued or historical GLP-1 use", () => {
    for (const status of ["inactive", "historical"] as const) {
      expect(resolve([user("glp1", status)]).effectiveForFood).toEqual(["anti_inflammatory"]);
    }
  });

  it("allows diabetes + GLP-1 and renal + anti-inflammatory without collapsing sources", () => {
    expect(resolve([user("glp1"), user("diabetes")], "diabetic").effectiveForFood)
      .toEqual(["glp1", "diabetes"]);
    expect(resolve([user("renal")]).effectiveForFood).toEqual(["renal", "anti_inflammatory"]);
  });

  it("switches strategy without deleting or permanently activating a Builder-only protocol", () => {
    const records = [user("renal")];
    expect(resolve(records, "glp1").effectiveForFood).toEqual(["glp1", "renal"]);
    expect(resolve(records, "standard").effectiveForFood).toEqual(["renal"]);
    expect(resolve([], "glp1").effectiveForFood).toEqual(["glp1"]);
    expect(resolve([], "standard").effectiveForFood).toEqual([]);
  });

  it("lets the user discontinue their own source while leaving another active source visible", () => {
    const provider: HealthProtocolRecord = {
      id: "physician-1", protocol: "glp1", source: "provider", status: "active",
      relationshipId: "care-1",
    };
    const result = resolve([user("glp1", "inactive"), provider], "standard", { "care-1": "active" });
    expect(result.activeSourceIds.glp1).toEqual(["physician-1"]);
    expect(result.effectiveForFood).toEqual(["glp1"]);
  });

  it("requires review after a provider disconnect instead of silently keeping its authority", () => {
    const provider: HealthProtocolRecord = {
      id: "physician-1", protocol: "glp1", source: "provider", status: "active",
      relationshipId: "care-1",
    };
    expect(resolve([provider], "standard", { "care-1": "active" }).activeHealthContext)
      .toEqual(["glp1"]);
    const ended = resolve([provider], "standard", { "care-1": "ended" });
    expect(ended.activeHealthContext).toEqual([]);
    expect(ended.effectiveForFood).toBeNull();
    expect(ended.needsReview).toEqual([{
      protocol: "glp1", sourceRecordId: "physician-1", reason: "provider_relationship_ended",
    }]);
  });

  it("does not mistake a lab signal or recommendation for an accepted active protocol", () => {
    const lab: HealthProtocolRecord = {
      id: "lab-1", protocol: "renal", source: "lab", status: "active",
    };
    expect(resolve([lab], "standard").needsReview[0].reason).toBe("lab_acceptance_unverified");
    expect(resolve([{ ...lab, acceptedRecommendation: true }], "standard").activeHealthContext)
      .toEqual(["renal"]);
    expect(resolve([{ ...lab, status: "historical", acceptedRecommendation: true }], "standard")
      .effectiveForFood).toEqual([]);
  });

  it("does not infer current medication use or active GLP-1 from ambiguous legacy entries", () => {
    const medication: HealthProtocolRecord = {
      id: "med-1", protocol: "glp1", source: "medication", status: "active",
    };
    const legacy: HealthProtocolRecord = {
      id: "old-array-1", protocol: "glp1", source: "legacy_migrated", status: "pending_review",
    };
    expect(resolve([medication, legacy], "standard").effectiveForFood).toBeNull();
    expect(resolve([medication, legacy], "standard").needsReview).toHaveLength(2);
    expect(resolve([{ ...medication, currentMedicationUse: true }], "standard").activeHealthContext)
      .toEqual(["glp1"]);
  });

  it("rejects duplicate or unrecognized source records rather than silently merging them", () => {
    expect(() => resolve([user("glp1"), user("glp1")])).toThrow(/unique/);
    expect(() => resolve([{
      id: "bad", protocol: "unknown" as HealthProtocolRecord["protocol"], source: "user", status: "active",
    }])).toThrow(/Unknown/);
    expect(() => resolve([{
      id: "bad-status", protocol: "glp1", source: "user",
      status: "undocumented" as HealthProtocolRecord["status"],
    }])).toThrow(/Unknown/);
  });
});