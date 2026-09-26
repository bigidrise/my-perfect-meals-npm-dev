const mockQuery = jest.fn();
const mockPoolQuery = jest.fn();
const mockDevOnly = jest.fn();
const mockReadRecords = jest.fn();
jest.mock("../db", () => ({ pool: { query: (...args: unknown[]) => mockPoolQuery(...args) } }));
jest.mock("../services/healthProtocols/persistence", () => ({
  devOnly: () => mockDevOnly(),
  readShadowProtocolRecords: (...args: unknown[]) => mockReadRecords(...args),
  shadowTransaction: (work: (client: { query: typeof mockQuery }) => Promise<unknown>) =>
    work({ query: mockQuery }),
}));

import {
  recordProviderFoodDirective,
  discontinueProviderFoodDirective,
  recordSubjectClinicalReview,
  recordSubjectHardFoodRestriction,
  readClinicalMealAuthorityShadow,
} from "../services/healthProtocols/clinicalDirectiveStorage";

const base = {
  actorUserId: "doctor", subjectUserId: "subject",
  membershipId: "care-1", sourceId: "source-1",
};
const exactRule = {
  kind: "nutrient_bound" as const, nutrient: "sodium" as const,
  comparator: "at_most" as const, amount: 700,
  unit: "mg" as const, scope: "per_serving" as const,
};
const create = () => recordProviderFoodDirective({
  ...base, rule: exactRule,
  effectiveAt: new Date("2026-09-26T00:00:00Z"),
  reasonCode: "provider_order",
});

describe("Development-only clinical directive storage boundary", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockPoolQuery.mockReset();
    mockDevOnly.mockReset();
    mockReadRecords.mockReset();
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT p.protocol_key")) return { rows: [{ protocol_key: "cardiac" }] };
      if (sql.includes("INSERT INTO health_protocol_food_directives")) return { rows: [{ id: "directive-1" }] };
      return { rows: [] };
    });
  });

  it("writes a typed rule and an append-only provider decision under the exact verified source lock", async () => {
    expect(await create()).toBe("directive-1");
    const authorization = mockQuery.mock.calls[0];
    expect(authorization[0]).toContain("s.verification_status='verified'");
    expect(authorization[0]).toContain("p.owner_user_id=$3");
    expect(authorization[0]).toContain("sm.client_user_id=$2");
    expect(authorization[1]).toEqual(["source-1", "subject", "doctor", "care-1"]);
    const insert = mockQuery.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO health_protocol_food_directives"));
    expect(JSON.parse(insert![1][3])).toEqual(exactRule);
    expect(mockQuery.mock.calls.at(-1)?.[0]).toContain("'verified_provider_directive'");
  });

  it("rejects a wrong provider or subject before writing a directive", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await expect(create()).rejects.toThrow("verified provider-owned source");
    expect(mockQuery).toHaveBeenCalledTimes(1);
    await expect(recordProviderFoodDirective({
      ...base, rule: { ...exactRule, unit: "g" },
      effectiveAt: new Date("2026-09-26T00:00:00Z"), reasonCode: "provider_order",
    })).rejects.toThrow();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("does not supersede a missing or already ended directive", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT p.protocol_key")) return { rows: [{ protocol_key: "cardiac" }] };
      return { rows: [{ id: "directive-old", current_disposition: "historical" }] };
    });
    await expect(recordProviderFoodDirective({
      ...base, rule: exactRule, effectiveAt: new Date("2026-09-26T00:00:00Z"),
      supersedesId: "directive-old", reasonCode: "provider_update",
    })).rejects.toThrow("current directive");
    expect(mockQuery.mock.calls.some(([sql]) =>
      sql.includes("INSERT INTO health_protocol_food_directives"))).toBe(false);
  });

  it("does not allow the subject to review provider-owned sources as personal guidance", async () => {
    await expect(recordSubjectClinicalReview({
      actorUserId: "another", subjectUserId: "subject", sourceId: "source-1",
      disposition: "current_guidance", reasonCode: "subject_review",
    })).rejects.toThrow("Subject-owned");
    expect(mockQuery).not.toHaveBeenCalled();
    mockQuery.mockResolvedValue({ rows: [] });
    await expect(recordSubjectClinicalReview({
      actorUserId: "subject", subjectUserId: "subject", sourceId: "source-1",
      disposition: "current_guidance", reasonCode: "subject_review",
    })).rejects.toThrow("cannot review");
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toContain("source_kind IN ('user','lab','legacy_migrated')");
  });

  it("requires a reviewed subject or accepted lab source before recording an exact personal hard rule", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await expect(recordSubjectHardFoodRestriction({
      actorUserId: "subject", subjectUserId: "subject", sourceId: "source-1",
      rule: exactRule, effectiveAt: new Date("2026-09-26T00:00:00Z"),
      reasonCode: "subject_confirmed",
    })).rejects.toThrow("reviewed, subject-owned active source");
    expect(mockQuery.mock.calls[0][0]).toContain("accepted_recommendation=true");
    expect(mockQuery).toHaveBeenCalledTimes(1);
    await expect(recordSubjectHardFoodRestriction({
      actorUserId: "doctor", subjectUserId: "subject", sourceId: "source-1",
      rule: exactRule, effectiveAt: new Date("2026-09-26T00:00:00Z"),
      reasonCode: "subject_confirmed",
    })).rejects.toThrow("Subject ownership");
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("provider discontinuation requires exact source ownership and a currently active directive", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT p.protocol_key")) return { rows: [{ protocol_key: "cardiac" }] };
      if (sql.includes("SELECT d.id")) return { rows: [{ id: "directive-1", current_disposition: "verified_provider_directive" }] };
      return { rows: [] };
    });
    await discontinueProviderFoodDirective({ ...base, directiveId: "directive-1" });
    expect(mockQuery.mock.calls.at(-1)?.[0]).toContain("'provider_discontinued'");
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql: string) =>
      sql.includes("SELECT p.protocol_key") ? { rows: [{ protocol_key: "cardiac" }] } :
      { rows: [{ id: "directive-1", current_disposition: "historical" }] });
    await discontinueProviderFoodDirective({ ...base, directiveId: "directive-1" });
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("shadow reader scopes every query by subject and never implies a missing table is empty", async () => {
    mockReadRecords.mockResolvedValue({
      records: [{ id: "source-1", protocol: "cardiac", source: "user", status: "active" }],
      relationshipStatus: {},
    });
    mockPoolQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{
      id: "decision-1", subject_user_id: "subject", source_id: "source-1",
      directive_id: null, disposition: "current_guidance",
      actor_user_id: "subject", decided_at: new Date("2026-09-26T00:00:00Z"),
    }] });
    const result = await readClinicalMealAuthorityShadow({
      subjectUserId: "subject", history: ["Cardiac"], builder: "standard",
      now: new Date("2026-09-26T12:00:00Z"),
    });
    expect(result.nutritionGuidance).toEqual([{ protocol: "cardiac", sourceId: "source-1" }]);
    expect(mockPoolQuery.mock.calls.every(([, params]) => params[0] === "subject")).toBe(true);
    expect(mockDevOnly).toHaveBeenCalled();
    mockPoolQuery.mockReset().mockRejectedValue(new Error("relation does not exist"));
    await expect(readClinicalMealAuthorityShadow({
      subjectUserId: "subject", history: [], builder: "standard",
    })).rejects.toThrow("relation does not exist");
  });
});