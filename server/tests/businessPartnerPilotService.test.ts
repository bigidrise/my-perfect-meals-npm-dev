/** All database operations are mocked; no invitations or grants are redeemed. */
import { PgDialect } from "drizzle-orm/pg-core";
import { inspectBusinessPartnerPilot, activateBusinessPartnerPilot } from "../services/businessPartnerPilotService";
import { createBusinessPilotAuthorization } from "../services/businessPilotAuthorizationService";

jest.mock("../db", () => {
  const db: any = { execute: jest.fn() };
  db.transaction = jest.fn(async (callback: any) => callback(db));
  return { db };
});
jest.mock("../services/businessPilotAuthorizationService", () => ({
  createBusinessPilotAuthorization: jest.fn(async () => ({ id: "new-grant" })),
}));
const { db } = jest.requireMock("../db");
const dialect = new PgDialect();
const now = new Date("2026-10-12T12:00:00Z");
const originalEnvironment = { ...process.env };
const queries = () => db.execute.mock.calls.map(([query]: any) => dialect.sqlToQuery(query));
const previous = {
  authorization_id: "old-grant", status: "active", activated_user_id: "partner-one",
  personal_access_started_at: now, personal_access_ends_at: new Date("2026-11-11T12:00:00Z"),
};
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(now);
  jest.clearAllMocks();
  db.execute.mockReset();
  process.env.NODE_ENV = "development";
  delete process.env.REPLIT_DEPLOYMENT;
  process.env.BUSINESS_PILOT_ACTIVATION_ENABLED = "true";
  process.env.BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED = "true";
});
afterEach(() => {
  process.env = { ...originalEnvironment };
  jest.useRealTimers();
});
function enrollment(existing?: any) {
  db.execute.mockResolvedValue({ rows: [] });
  db.execute.mockResolvedValueOnce({ rows: [{ created_by_user_id: "approved-founder" }] })
    .mockResolvedValueOnce({ rows: [{ email: "partner@example.invalid" }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: existing ? [existing] : [] });
}
test("the public campaign is reusable and has no invitation deadline or consumption", async () => {
  db.execute.mockResolvedValue({ rows: [{ created_by_user_id: "approved-founder" }] });
  for (let i = 0; i < 2; i++) {
    await expect(inspectBusinessPartnerPilot()).resolves.toMatchObject({ available: true, reusable: true });
  }
  expect(queries().every(query => query.sql.startsWith("SELECT"))).toBe(true);
});
test.each(["partner-one", "partner-two"])("each independent partner receives their own grant: %s", async userId => {
  enrollment();
  const result = await activateBusinessPartnerPilot(userId);
  expect(result).toMatchObject({ alreadyActivated: false, startedAt: now, endsAt: previous.personal_access_ends_at });
  expect(createBusinessPilotAuthorization).toHaveBeenCalledWith(expect.objectContaining({
    authorizedEmail: "partner@example.invalid", createdByUserId: "approved-founder",
    internalMetadata: expect.objectContaining({ enrollmentSource: "reusable_business_partner_link" }),
  }), db);
  const insert = queries().find(query => query.sql.startsWith("INSERT"));
  expect(insert?.params).toContain(userId);
  expect(insert?.params).not.toContain("business-partners");
  expect(queries().some(query => query.sql.includes("FOR UPDATE"))).toBe(true);
  expect(queries().some(query => query.sql.includes("pg_advisory_xact_lock"))).toBe(true);
  expect(queries().some(query => /UPDATE users|INSERT INTO businesses|stripe/i.test(query.sql))).toBe(false);
});
test.each(["active", "expired", "converted"])("returning %s grants retain their original window", async status => {
  enrollment({ ...previous, status });
  jest.setSystemTime(new Date("2026-12-01T12:00:00Z"));
  await expect(activateBusinessPartnerPilot("partner-one")).resolves.toMatchObject({
    alreadyActivated: true, endsAt: previous.personal_access_ends_at,
  });
  expect(createBusinessPilotAuthorization).not.toHaveBeenCalled();
  expect(queries().every(query => !/^(UPDATE|INSERT)/.test(query.sql))).toBe(true);
});
test("an unactivated recipient invitation is reused without an additional authorization", async () => {
  enrollment({
    authorization_id: "pending-grant", status: "pending",
    activated_user_id: null, claimed_user_id: null,
    personal_access_started_at: null, personal_access_ends_at: null,
  });
  await expect(activateBusinessPartnerPilot("partner-one")).resolves.toMatchObject({ authorizationId: "pending-grant" });
  expect(createBusinessPilotAuthorization).not.toHaveBeenCalled();
  expect(queries().some(query => query.sql.startsWith("INSERT"))).toBe(false);
});
test.each([
  { ...previous, status: "revoked" },
  { ...previous, activated_user_id: "someone-else" },
  { ...previous, activated_user_id: null, claimed_user_id: "someone-else" },
])("revocation and another account's ownership never produce replacement access", async existing => {
  enrollment(existing);
  await expect(activateBusinessPartnerPilot("partner-one")).rejects.toMatchObject({ code: "PILOT_UNAVAILABLE" });
  expect(createBusinessPilotAuthorization).not.toHaveBeenCalled();
  expect(queries().every(query => !/^(UPDATE|INSERT)/.test(query.sql))).toBe(true);
});
test("missing founder attribution fails closed before creating grants", async () => {
  db.execute.mockResolvedValue({ rows: [] });
  await expect(activateBusinessPartnerPilot("partner-one")).rejects.toMatchObject({ code: "PILOT_NOT_RELEASED" });
  expect(createBusinessPilotAuthorization).not.toHaveBeenCalled();
});
test.each(["production", "deployment", "disabled", "schema-unapproved"])("%s cannot enable the public campaign", async mode => {
  if (mode === "production") process.env.NODE_ENV = "production";
  if (mode === "deployment") process.env.REPLIT_DEPLOYMENT = "true";
  if (mode === "disabled") process.env.BUSINESS_PILOT_ACTIVATION_ENABLED = "false";
  if (mode === "schema-unapproved") process.env.BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED = "false";
  await expect(activateBusinessPartnerPilot("partner-one")).rejects.toMatchObject({ code: "PILOT_NOT_RELEASED" });
  expect(db.execute).not.toHaveBeenCalled();
});
