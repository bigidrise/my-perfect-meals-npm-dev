type Source = {
  id: string; subject_user_id: string; protocol_key: string; source_kind: string;
  evidence_ref: string; status: string; owner_user_id: string | null;
  current_medication_use: boolean | null; ended_at: string | null;
};
const mockRows: Source[] = [];
let mockBuilder = "diabetic";
const mockQuery = jest.fn(async (sql: string, args: any[] = []) => {
  if (sql.includes("FROM users")) return { rows: [{ selected_meal_builder: mockBuilder }] };
  if (sql.includes("SELECT DISTINCT s.source_kind")) {
    return { rows: mockRows.filter(r => r.subject_user_id === args[0] && r.status === "active" &&
      !r.ended_at && (r.source_kind === "provider" || r.current_medication_use === true)) };
  }
  if (sql.includes("SELECT evidence_ref, owner_user_id")) return {
    rows: mockRows.filter(r => r.subject_user_id === args[0] && r.source_kind === "medication" &&
      r.status === "active" && !r.ended_at && r.current_medication_use === true),
  };
  if (sql.includes("SELECT id, status, owner_user_id")) return {
    rows: mockRows.filter(r => r.subject_user_id === args[0] && r.protocol_key === args[1] &&
      r.source_kind === args[2] && r.evidence_ref === args[3]),
  };
  if (sql.includes("INSERT INTO health_protocol_sources")) {
    const row: Source = {
      id: `source-${mockRows.length}`, subject_user_id: args[0], protocol_key: args[1],
      source_kind: args[2], evidence_ref: args[3], status: args[4], owner_user_id: args[5],
      current_medication_use: args[8], ended_at: args[4] === "active" ? null : "ended",
    };
    mockRows.push(row);
    return { rows: [{ id: row.id }] };
  }
  if (sql.includes("UPDATE health_protocol_sources SET status=$1")) {
    const row = mockRows.find(r => r.id === args[5])!;
    Object.assign(row, {
      status: args[0], owner_user_id: args[1], current_medication_use: args[4],
      ended_at: args[0] === "active" ? null : "ended",
    });
    return { rows: [{ id: row.id }] };
  }
  if (/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL)/.test(sql) ||
      sql.includes("pg_advisory_xact_lock") || sql.includes("INSERT INTO health_protocol_events")) {
    return { rows: [] };
  }
  throw new Error(`Unexpected SQL: ${sql}`);
});
jest.mock("../db", () => ({
  pool: { query: (sql: string, args?: any[]) => mockQuery(sql, args),
    connect: async () => ({ query: (sql: string, args?: any[]) => mockQuery(sql, args), release: jest.fn() }) },
}));

import { MEMBER_GLP1_EVIDENCE, readMemberGLP1CurrentUse, setMemberGLP1CurrentUse } from "../services/glp1/memberCurrentUse";
import { resolveCurrentGLP1MealAuthority } from "../services/glp1/currentMealAuthority";

describe("member-reported GLP-1 current use (isolated source store)", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  const input = { actorUserId: "member", subjectUserId: "member" };
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    mockRows.length = 0;
    mockBuilder = "diabetic";
    mockQuery.mockClear();
  });
  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
  });
  it("persists On, Off and On again through the real claim writer without duplicate records", async () => {
    await setMemberGLP1CurrentUse({ ...input, currentUse: true });
    expect(await readMemberGLP1CurrentUse("member")).toMatchObject({
      memberReportedCurrentUse: true, effectiveActive: true, physicianManaged: false,
    });
    expect(mockRows[0]).toMatchObject({
      source_kind: "medication", evidence_ref: MEMBER_GLP1_EVIDENCE,
      current_medication_use: true, status: "active", owner_user_id: "member",
    });
    await setMemberGLP1CurrentUse({ ...input, currentUse: false });
    expect(await readMemberGLP1CurrentUse("member")).toMatchObject({
      memberReportedCurrentUse: false, effectiveActive: false,
    });
    expect(mockRows[0].status).toBe("historical");
    await setMemberGLP1CurrentUse({ ...input, currentUse: true });
    expect(mockRows).toHaveLength(1);
    expect((await readMemberGLP1CurrentUse("member")).effectiveActive).toBe(true);
  });
  it("Off leaves physician records unchanged and effective guidance active", async () => {
    mockRows.push({
      id: "provider", subject_user_id: "member", protocol_key: "glp1", source_kind: "provider",
      evidence_ref: "clinic", status: "active", owner_user_id: "physician",
      current_medication_use: null, ended_at: null,
    });
    const providerBefore = { ...mockRows[0] };
    await setMemberGLP1CurrentUse({ ...input, currentUse: true });
    await setMemberGLP1CurrentUse({ ...input, currentUse: false });
    expect(mockRows[0]).toEqual(providerBefore);
    expect(await readMemberGLP1CurrentUse("member")).toMatchObject({
      memberReportedCurrentUse: false, physicianManaged: true, effectiveActive: true,
    });
  });
  it("a member report reaches the existing diabetic generation authority resolver", async () => {
    await setMemberGLP1CurrentUse({ ...input, currentUse: true });
    expect(await resolveCurrentGLP1MealAuthority({
      id: "member", selectedMealBuilder: "diabetic", medicalConditions: [],
    })).toEqual(["memberReportedMedication"]);
  });
  it("does not convert legacy GLP-1 history or a nutrition preference into current use", async () => {
    expect(await resolveCurrentGLP1MealAuthority({
      id: "member", selectedMealBuilder: "diabetic", medicalConditions: ["glp1"],
      specialtyConditions: ["glp1"],
    })).toEqual([]);
    expect((await readMemberGLP1CurrentUse("member")).effectiveActive).toBe(false);
  });
  it("accurately distinguishes Builder guidance from reported medication", async () => {
    mockBuilder = "glp1";
    expect(await readMemberGLP1CurrentUse("member")).toMatchObject({
      memberReportedCurrentUse: false, builderActive: true, effectiveActive: true,
    });
  });
  it("refuses another member's identity before writing", async () => {
    await expect(setMemberGLP1CurrentUse({
      actorUserId: "attacker", subjectUserId: "member", currentUse: true,
    })).rejects.toThrow("subject mismatch");
    expect(mockRows).toHaveLength(0);
  });
  it.each(["production", "deployment"])("cannot write in %s", async mode => {
    if (mode === "production") process.env.NODE_ENV = "production";
    else process.env.REPLIT_DEPLOYMENT = "1";
    await expect(setMemberGLP1CurrentUse({ ...input, currentUse: true })).rejects.toThrow("DEV-only");
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
