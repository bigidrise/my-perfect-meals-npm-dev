import express from "express";
import request from "supertest";

let mockLocked = false;
let mockConditions: string[] = [];
let mockPrimary: string | null = null;
let mockDecisionWrites: any[] = [];
let mockFailWrite = false;
let mockLabOwner = "member-a";
const mockMeasurement = {
  id: 7, userId: "member-a", bloodPressureSystolic: "160", bloodPressureDiastolic: "90",
};
const tableName = (table: any) => table?.[Symbol.for("drizzle:Name")];
const mockDb: any = {
  select: () => {
    let table: any;
    const query: any = {
      from: (value: any) => { table = value; return query; },
      where: () => query, for: () => query, orderBy: () => query,
      limit: async () => tableName(table) === "clinical_labs"
        ? mockLabOwner === "member-a" ? [mockMeasurement] : []
        : [{ specialtyConditions: [...mockConditions], specialtyCondition: mockPrimary }],
    };
    return query;
  },
  insert: (table: any) => ({
    values: (value: any) => {
      const write = Promise.resolve().then(() => {
        if (mockFailWrite) throw new Error("Simulated failed write");
        if (tableName(table) === "clinical_labs") return { id: 7, ...value };
        mockDecisionWrites.push(value);
        return value;
      });
      return Object.assign(write, { returning: () => write.then(row => [row]) });
    },
  }),
  update: () => ({
    set: (value: any) => ({ where: async () => {
      if (mockFailWrite) throw new Error("Simulated failed write");
      mockConditions = value.specialtyConditions;
      mockPrimary = value.specialtyCondition;
    } }),
  }),
  transaction: async (run: any) => run(mockDb),
};
jest.mock("../db", () => ({ db: {
  select: (...args: any[]) => mockDb.select(...args),
  insert: (...args: any[]) => mockDb.insert(...args),
  update: (...args: any[]) => mockDb.update(...args),
  transaction: (...args: any[]) => mockDb.transaction(...args),
} }));
jest.mock("../middleware/requireAuth", () => ({ requireAuth: (_req: any, _res: any, next: any) => next() }));
jest.mock("../utils/getAuthUserId", () => ({ getAuthUserId: () => "member-a" }));
jest.mock("../utils/verifyClinicalAccess", () => ({ verifyClinicalAccess: async () => true }));
jest.mock("../services/labProtocolOwnership", () => ({ getPhysicianLockStatus: async () => mockLocked }));
jest.mock("../services/queryCache", () => ({ invalidatePrefix: jest.fn() }));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn(), getClientIp: () => "synthetic" }));
import router from "../routes/clinicalLabs";
const app = express();
app.use(express.json());
app.use("/api/biometrics/labs", router);

beforeEach(() => {
  mockLocked = false; mockFailWrite = false; mockLabOwner = "member-a";
  mockConditions = []; mockPrimary = null; mockDecisionWrites = [];
});
const decide = (body: any) => request(app).post("/api/biometrics/labs/recommendation").send(body);

test.each(["accepted", "removed"])("backend rejects %s for protected or ambiguous clinical settings", async status => {
  mockLocked = true; mockConditions = ["cardiac", "liver-support"];
  const result = await decide({ protocol: "heart-failure", status, labId: 7 });
  expect(result.status).toBe(403);
  expect(mockConditions).toEqual(["cardiac", "liver-support"]);
  expect(mockDecisionWrites).toHaveLength(0);
});
test.each(["rejected", "advisory"])("%s is recorded without altering protected state", async status => {
  mockLocked = true; mockConditions = ["cardiac"];
  expect((await decide({ protocol: "heart-failure", status, labId: 7 })).status).toBe(200);
  expect(mockConditions).toEqual(["cardiac"]);
  expect(mockDecisionWrites[0].status).toBe(status);
});
test.each(["independent", "trainer-connected"])("%s acceptance normalizes Cardiac and preserves multiple protocols", async () => {
  mockConditions = ["liver-support", "anti-inflammatory"]; mockPrimary = "liver-support";
  expect((await decide({ protocol: "heart-failure", status: "accepted", labId: 7 })).status).toBe(200);
  expect(mockConditions).toEqual(["liver-support", "anti-inflammatory", "cardiac"]);
  expect(mockPrimary).toBe("liver-support");
  expect(mockDecisionWrites[0].reason).not.toBe("subject_disabled_lab_cardiac_support");
});
test("exact removal removes both legacy and canonical Cardiac, not other protocols", async () => {
  mockConditions = ["heart-failure", "cardiac", "liver-support", "anti-inflammatory"];
  mockPrimary = "cardiac";
  expect((await decide({ protocol: "heart-failure", status: "removed", labId: 7 })).status).toBe(200);
  expect(mockConditions).toEqual(["liver-support", "anti-inflammatory"]);
});
test("an unrelated subject's measurement cannot authorize acceptance", async () => {
  mockLabOwner = "someone-else";
  expect((await decide({ protocol: "heart-failure", status: "accepted", labId: 7 })).status).toBe(400);
  expect(mockDecisionWrites).toHaveLength(0);
});
test("unsupported recommendation cannot be accepted using Cardiac measurement evidence", async () => {
  expect((await decide({ protocol: "kidney-disease", status: "accepted", labId: 7 })).status).toBe(409);
  expect(mockDecisionWrites).toHaveLength(0);
});
test("unknown clinical protocol is rejected", async () => {
  expect((await decide({ protocol: "invented-protocol", status: "accepted", labId: 7 })).status).toBe(400);
});
test.each(["physician_directed_protocol_decision", "subject_profile_protocol_decision"])("a client cannot forge reserved provenance %s", async reason => {
  expect((await decide({ protocol: "heart-failure", status: "accepted", labId: 7, reason })).status).toBe(400);
  expect(mockDecisionWrites).toHaveLength(0);
});
test.each(["metabolic-support", "metabolic-stress", "inflammation-support"])("%s cannot be activated or presented as active nutrition", async protocol => {
  mockConditions = ["cardiac", "liver-support"];
  const result = await decide({ protocol, status: "accepted", labId: 7 });
  expect(result.status).toBe(422);
  expect(result.body.code).toBe("advisory_only");
  expect(mockConditions).toEqual(["cardiac", "liver-support"]);
  expect(mockDecisionWrites).toHaveLength(0);
  expect((await decide({ protocol, status: "advisory", labId: 7 })).status).toBe(200);
  expect(mockDecisionWrites[0].status).toBe("advisory");
  expect(mockConditions).toEqual(["cardiac", "liver-support"]);
});
test("a failed persistence operation does not return success", async () => {
  mockFailWrite = true;
  expect((await decide({ protocol: "heart-failure", status: "accepted", labId: 7 })).status).toBe(400);
  expect(mockConditions).toEqual([]);
});
test("saving unsupported metabolic measurements preserves an advisory record without changing nutrition", async () => {
  const response = await request(app).post("/api/biometrics/labs").send({ a1c: 6 });
  expect(response.status).toBe(201);
  expect(response.body.protocolSignal.protocol).toBe("metabolic-support");
  expect(response.body.protocolSignal.reason).toContain("No nutrition settings have been changed");
  expect(mockDecisionWrites).toEqual([expect.objectContaining({
    recommendedProtocol: "metabolic-support", clinicalLabId: 7, status: "advisory",
  })]);
  expect(mockConditions).toEqual([]);
});
