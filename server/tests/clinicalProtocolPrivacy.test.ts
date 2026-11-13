import express from "express";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";

let mockActor = "trainer";
let mockSameOrg = true;
let mockActive = true;
let mockArchived = false;
let mockOwner = "trainer";
let mockSubject = "member";
let mockClinicalAllowed = false;
const mockWhere: any[] = [];
jest.mock("../db", () => ({ db: {
  select: () => {
    let table: any;
    let condition: any;
    const query: any = {
      from(value: any) { table = value; return query; },
      innerJoin() { return query; },
      where(value: any) { condition = value; return query; },
      async limit() {
        if (table[Symbol.for("drizzle:Name")] === "users") return [{
          id: mockSubject, specialtyConditions: ["heart-failure", "private-diagnosis", "metabolic-stress"],
          oncologySupportContext: { enabled: false, physicianNotes: "not-for-trainer" },
          tsh: 99, medication: "private",
        }];
        const compiled = new (require("drizzle-orm/pg-core").PgDialect)().sqlToQuery(condition);
        mockWhere.push(compiled);
        return mockActive && !mockArchived && mockOwner === mockActor && compiled.params.includes(mockSubject)
          ? [{ id: "exact-active-relationship" }] : [];
      },
    };
    return query;
  },
} }));
jest.mock("../lib/orgIsolation", () => ({ isSameOrg: async () => mockSameOrg }));
jest.mock("../middleware/requireAuth", () => ({ requireAuth: (req: any, _res: any, next: any) => {
  req.authUser = { id: mockActor }; next();
} }));
jest.mock("../services/glp1/currentMealAuthority", () => ({ currentGLP1AuthorityEnabled: () => false }));
jest.mock("../services/healthProtocols/developmentFoodSupports", () => ({ readDevelopmentPersonalFoodSupports: async () => new Set() }));
jest.mock("../services/professionalGlucoseAccess", () => ({ resolveProfessionalGlucoseAccess: async () => ({ allowed: mockClinicalAllowed }) }));
import createRouter, { canReadClinicalProtocolIndicators } from "../routes/effectiveClinicalProtocols";
import { verifyClinicalAccess } from "../utils/verifyClinicalAccess";
const app = express();
app.use("/api/clinical-protocols", createRouter());
beforeEach(() => {
  mockActor = "trainer"; mockSameOrg = true; mockActive = true; mockArchived = false;
  mockOwner = "trainer"; mockSubject = "member"; mockClinicalAllowed = false; mockWhere.length = 0;
});
test("a member can see their own status without a professional relationship", async () => {
  expect(await canReadClinicalProtocolIndicators("member", "member")).toBe(true);
  expect(mockWhere).toHaveLength(0);
});
test.each(["trainer", "physician"])("%s receives only exact-subject status, never raw medical fields", async actor => {
  mockActor = actor; mockOwner = actor;
  const result = await request(app).get("/api/clinical-protocols/member");
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ subjectUserId: "member", protocols: ["cardiac"], specialtyConditions: ["cardiac"] });
  expect(result.headers["cache-control"]).toBe("private, no-store");
  expect(JSON.stringify(result.body)).not.toMatch(/physicianNotes|not-for-trainer|tsh|medication|private-diagnosis|metabolic-stress/);
  expect(mockWhere[0].params).toEqual(expect.arrayContaining([actor, "member", "active", false]));
  expect(mockWhere[0].sql).toMatch(/is_archived/);
});
test.each(["disconnected", "archived", "different-owner", "different-organization"])("%s cannot read another subject's indicators", async scenario => {
  if (scenario === "disconnected") mockActive = false;
  if (scenario === "archived") mockArchived = true;
  if (scenario === "different-owner") mockOwner = "someone-else";
  if (scenario === "different-organization") mockSameOrg = false;
  expect((await request(app).get("/api/clinical-protocols/member")).status).toBe(403);
});
test("subject switching cannot reuse the previous subject's relationship", async () => {
  expect((await request(app).get("/api/clinical-protocols/member")).status).toBe(200);
  expect((await request(app).get("/api/clinical-protocols/someone-else")).status).toBe(403);
});
test("ordinary trainer status visibility never grants detailed lab access", async () => {
  expect(await canReadClinicalProtocolIndicators("trainer", "member")).toBe(true);
  expect(await verifyClinicalAccess("trainer", "member")).toBe(false);
});
test("detailed access follows the verified clinician and consent decision", async () => {
  mockClinicalAllowed = true;
  expect(await verifyClinicalAccess("physician", "member")).toBe(true);
  mockClinicalAllowed = false;
  expect(await verifyClinicalAccess("physician", "member")).toBe(false);
  expect(await verifyClinicalAccess("member", "member")).toBe(true);
});
