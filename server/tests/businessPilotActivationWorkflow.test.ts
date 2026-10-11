/** Hermetic: every DB/API dependency is mocked; no application bootstrap is imported. */
import { PgDialect } from "drizzle-orm/pg-core";
import {
  assertOrganizationChargeAllowed, businessPilotActivationEnabled,
  clinicalPilotWindow, ORGANIZATION_BILLING_TERMS_VERSION,
  requirePilotClaim, validateOrganizationBillingConsent,
  validateClinicalPilotWindow,
} from "../services/businessPilotActivationPolicy";
import {
  activateBusinessPilotLink, founderOrganizationWindow, getActiveBusinessPilotClinicalAccess, bindFounderOrganization,
  issueBusinessPilotLink,
} from "../services/businessPilotActivationService";
import { computeEffectiveAccess } from "../services/effectiveAccess";
import { resolveAccessTier } from "../lib/accessTier";
import { organizationQuoteFromPrice, recordOrganizationCheckoutConsent } from "../services/organizationCheckoutConsent";
import { invitationDestination } from "../../client/src/lib/businessPilotJourney";

jest.mock("../db", () => {
  const query: any = {
    from: jest.fn().mockReturnThis(), innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(), limit: jest.fn(async () => []),
  };
  const db: any = { execute: jest.fn(), select: jest.fn(() => query) };
  db.transaction = jest.fn(async (callback: any) => callback(db));
  return { db };
});
jest.mock("../services/businessPilotAuthorizationService", () => ({
  createBusinessPilotAuthorization: jest.fn(async () => ({ id: "authorization-fixture" })),
}));
jest.mock("../services/pilotProcareAccess", () => ({
  getActivePilotProCareGrant: jest.fn(async () => null),
  getPilotClientSponsorshipState: jest.fn(async () => ({ linked: false, active: false })),
}));
jest.mock("../services/pilotProgramAccess", () => ({ getActivePilotFullAccess: jest.fn(async () => null) }));
jest.mock("../services/clinicPilotEnrollmentService", () => ({
  getActiveClinicTrialEntitlement: jest.fn(async () => null),
  getActiveProfessionalTemporaryAccess: jest.fn(async () => null),
}));
jest.mock("../services/businessOfferLinkService", () => ({ getActiveBusinessOfferEntitlement: jest.fn(async () => null) }));

const { db } = jest.requireMock("../db");
const clinic = jest.requireMock("../services/clinicPilotEnrollmentService");
const dialect = new PgDialect();
const now = new Date("2026-11-01T12:00:00Z");
const token = "a".repeat(64);
const grant = () => ({
  authorization_id: "authorization-fixture", normalized_authorized_email: "physician@example.test",
  status: "pending", invitation_expires_at: new Date("2026-11-14T12:00:00Z"),
  activated_user_id: null, claimed_user_id: null, business_id: null,
  personal_access_started_at: null, personal_access_ends_at: null,
});

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(now);
  jest.clearAllMocks();
  process.env.BUSINESS_PILOT_ACTIVATION_ENABLED = "true";
  process.env.BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED = "true";
  db.execute.mockReset();
  db.execute.mockResolvedValue({ rows: [] });
  clinic.getActiveClinicTrialEntitlement.mockResolvedValue(null);
});
afterEach(() => jest.useRealTimers());

test("both explicit approvals are required, and disabled service performs no database work", async () => {
  delete process.env.BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED;
  expect(businessPilotActivationEnabled()).toBe(false);
  await expect(issueBusinessPilotLink("physician@example.test", "founder-fixture")).rejects.toMatchObject({ code: "PILOT_NOT_RELEASED" });
  await expect(getActiveBusinessPilotClinicalAccess("user-fixture")).resolves.toBeNull();
  expect(db.execute).not.toHaveBeenCalled();
  expect(db.transaction).not.toHaveBeenCalled();
});

test("activation creates exactly one 720-hour personal window, not a calendar label", () => {
  expect(clinicalPilotWindow(now).endsAt.toISOString()).toBe("2026-12-01T12:00:00.000Z");
});

test("issuance uses existing authorization transaction, stores a hash, and returns a fragment link", async () => {
  const issued = await issueBusinessPilotLink("physician@example.test", "founder-fixture");
  expect(issued.activationPath).toMatch(/^\/activate\/business-pilot#token=[a-f0-9]{64}$/);
  const raw = issued.activationPath.split("=")[1];
  const insert = dialect.sqlToQuery(db.execute.mock.calls[0][0]);
  expect(insert.sql).toContain("INSERT INTO business_pilot_activation_links");
  expect(insert.params).not.toContain(raw);
  expect(insert.params.some(value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value))).toBe(true);
});

test("claim updates only the grant and existing authorization, never roles or payment identity", async () => {
  db.execute.mockResolvedValueOnce({ rows: [grant()] })
    .mockResolvedValueOnce({ rows: [{ email: "physician@example.test" }] });
  const result = await activateBusinessPilotLink(token, "user-fixture");
  expect(result.endsAt).toEqual(new Date("2026-12-01T12:00:00Z"));
  const writes = db.execute.mock.calls.map(([query]: any) => dialect.sqlToQuery(query).sql).filter((q: string) => q.startsWith("UPDATE"));
  expect(writes).toHaveLength(2);
  expect(writes.join(" ")).not.toMatch(/UPDATE users|is_admin|is_founder|is_pro_care|plan_lookup_key|stripe/i);
  expect(dialect.sqlToQuery(db.execute.mock.calls[0][0]).sql).toContain("FOR UPDATE OF l, a");
});

test("replay returns the original expiration without another write", async () => {
  db.execute.mockResolvedValueOnce({ rows: [{
    ...grant(), status: "active", activated_user_id: "user-fixture",
    personal_access_started_at: now, personal_access_ends_at: new Date("2026-12-01T12:00:00Z"),
  }] }).mockResolvedValueOnce({ rows: [{ email: "physician@example.test" }] });
  jest.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  await expect(activateBusinessPilotLink(token, "user-fixture")).resolves.toMatchObject({
    alreadyActivated: true, endsAt: new Date("2026-12-01T12:00:00Z"),
  });
  expect(db.execute).toHaveBeenCalledTimes(2);
});

test.each([
  ["wrong email", { accountEmail: "other@example.test" }, "EMAIL_MISMATCH"],
  ["revoked", { revoked: true }, "PILOT_REVOKED"],
  ["expired invitation", { invitationExpiresAt: now }, "PILOT_INVITATION_EXPIRED"],
  ["another account", { activatedUserId: "other" }, "PILOT_ALREADY_CLAIMED"],
])("%s cannot claim", (_label, change, code) => {
  try {
    requirePilotClaim({
      authorizedEmail: "physician@example.test", accountEmail: "physician@example.test",
      revoked: false, invitationExpiresAt: new Date("2026-11-14"), activatedUserId: null,
      userId: "user-fixture", ...change,
    }, now);
    throw new Error("unexpectedly allowed");
  } catch (error: any) { expect(error.code).toBe(code); }
});

test("malformed tokens do not query the database", async () => {
  await expect(activateBusinessPilotLink("invalid", "user-fixture")).rejects.toMatchObject({ code: "PILOT_NOT_FOUND" });
  expect(db.execute).not.toHaveBeenCalled();
});

test("signup binding without token activation cannot bypass invitation expiration", async () => {
  db.execute.mockResolvedValueOnce({ rows: [{
    ...grant(), claimed_user_id: "user-fixture", invitation_expires_at: now,
  }] }).mockResolvedValueOnce({ rows: [{ email: "physician@example.test" }] });
  await expect(activateBusinessPilotLink(token, "user-fixture")).rejects.toMatchObject({ code: "PILOT_INVITATION_EXPIRED" });
  expect(db.execute).toHaveBeenCalledTimes(2);
});

test("delayed organization creation inherits the original window", async () => {
  jest.setSystemTime(new Date("2026-11-10T12:00:00Z"));
  db.execute.mockResolvedValueOnce({ rows: [{
    ...grant(), status: "active", activated_user_id: "user-fixture",
    personal_access_started_at: now, personal_access_ends_at: new Date("2026-12-01T12:00:00Z"),
  }] });
  await expect(founderOrganizationWindow(db, "user-fixture")).resolves.toMatchObject({
    startedAt: now, endsAt: new Date("2026-12-01T12:00:00Z"),
  });
});

test("an attached invitation cannot gift a second organization a new pilot", async () => {
  db.execute.mockResolvedValueOnce({ rows: [{
    ...grant(), business_id: "business-fixture", activated_user_id: "user-fixture",
    personal_access_started_at: now, personal_access_ends_at: clinicalPilotWindow(now).endsAt,
  }] });
  await expect(founderOrganizationWindow(db, "user-fixture")).rejects.toMatchObject({ code: "PILOT_ORGANIZATION_ALREADY_ATTACHED" });
});

test.each([null, undefined, "", "not-a-date", "infinity", "-infinity", Infinity, -Infinity, new Date(NaN)])(
  "missing or non-finite window timestamp %p is rejected on either side", value => {
    expect(() => validateClinicalPilotWindow(value, clinicalPilotWindow(now).endsAt)).toThrow();
    expect(() => validateClinicalPilotWindow(now, value)).toThrow();
  },
);

test.each([-1, 1, 3600000])("a window offset by %i milliseconds is rejected", delta => {
  expect(() => validateClinicalPilotWindow(now, new Date(clinicalPilotWindow(now).endsAt.getTime() + delta))).toThrow();
});

test("invalid activation clock is rejected before any database work", async () => {
  jest.setSystemTime(new Date(8640000000000000));
  await expect(issueBusinessPilotLink("physician@example.test", "founder-fixture")).rejects.toMatchObject({ code: "PILOT_WINDOW_INVALID" });
  expect(db.transaction).not.toHaveBeenCalled();
});

test.each([null, "infinity", new Date(NaN), new Date("2026-12-02T12:00:00Z")])(
  "corrupt replay expiration %p does not reset the original activation", async endsAt => {
    db.execute.mockResolvedValueOnce({ rows: [{
      ...grant(), activated_user_id: "user-fixture", status: "active",
      personal_access_started_at: now, personal_access_ends_at: endsAt,
    }] }).mockResolvedValueOnce({ rows: [{ email: "physician@example.test" }] });
    await expect(activateBusinessPilotLink(token, "user-fixture")).rejects.toMatchObject({ code: "PILOT_WINDOW_INVALID" });
    expect(db.execute).toHaveBeenCalledTimes(2);
  },
);

test("infinite invitation deadline cannot be used to activate", async () => {
  db.execute.mockResolvedValueOnce({ rows: [{ ...grant(), invitation_expires_at: Infinity }] })
    .mockResolvedValueOnce({ rows: [{ email: "physician@example.test" }] });
  await expect(activateBusinessPilotLink(token, "user-fixture")).rejects.toMatchObject({ code: "PILOT_WINDOW_INVALID" });
  expect(db.execute).toHaveBeenCalledTimes(2);
});

test("persisted infinite personal access is rejected instead of becoming indefinite", async () => {
  db.execute.mockResolvedValueOnce({ rows: [{
    ...grant(), status: "active", personal_access_started_at: Infinity, personal_access_ends_at: Infinity,
  }] });
  await expect(getActiveBusinessPilotClinicalAccess("user-fixture")).rejects.toMatchObject({ code: "PILOT_WINDOW_INVALID" });
});

test("business cleanup does not permit consuming the same invitation again", async () => {
  db.execute.mockResolvedValueOnce({ rows: [{
    ...grant(), organization_consumed: true, business_id: null,
    personal_access_started_at: now, personal_access_ends_at: clinicalPilotWindow(now).endsAt,
  }] });
  await expect(founderOrganizationWindow(db, "user-fixture")).rejects.toMatchObject({ code: "PILOT_ORGANIZATION_ALREADY_ATTACHED" });
});

test("binding records consumption atomically and fails closed on an already-consumed reservation", async () => {
  await expect(bindFounderOrganization(db, "authorization-fixture", "business-fixture")).rejects.toMatchObject({
    code: "PILOT_ORGANIZATION_ALREADY_ATTACHED",
  });
  const query = dialect.sqlToQuery(db.execute.mock.calls[0][0]);
  expect(query.sql).toContain("organization_consumed = true");
  expect(query.sql).toContain("organization_consumed = false");
  db.execute.mockResolvedValueOnce({ rows: [{ authorization_id: "authorization-fixture" }] });
  await expect(bindFounderOrganization(db, "authorization-fixture", "business-fixture")).resolves.toBeUndefined();
});

test("legacy signup binding without activation cannot start an organization clock", async () => {
  db.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: "authorization-fixture" }] });
  await expect(founderOrganizationWindow(db, "user-fixture")).rejects.toMatchObject({ code: "FOUNDER_ACTIVATION_REQUIRED" });
});

test("pausing activation does not let a reserved founder pilot fall through to a fresh universal clock", async () => {
  delete process.env.BUSINESS_PILOT_ACTIVATION_ENABLED;
  db.execute.mockResolvedValueOnce({ rows: [{ id: "authorization-fixture" }] });
  await expect(founderOrganizationWindow(db, "user-fixture")).rejects.toMatchObject({ code: "FOUNDER_ACTIVATION_REQUIRED" });
  expect(dialect.sqlToQuery(db.execute.mock.calls[0][0]).sql).not.toContain("business_pilot_activation_links");
});

test("expired founder access cannot restart through organization creation", async () => {
  jest.setSystemTime(new Date("2026-12-10T12:00:00Z"));
  db.execute.mockResolvedValueOnce({ rows: [{
    ...grant(), status: "active", personal_access_started_at: now,
    personal_access_ends_at: new Date("2026-12-01T12:00:00Z"),
  }] });
  const window = await founderOrganizationWindow(db, "user-fixture");
  expect(window?.endsAt).toEqual(new Date("2026-12-01T12:00:00Z"));
});

test("active clinic entitlement agrees with paid request gate after shared pilot expiration", async () => {
  jest.setSystemTime(new Date("2026-12-01T12:00:00Z"));
  clinic.getActiveClinicTrialEntitlement.mockResolvedValue({ endsAt: new Date("2026-12-05T12:00:00Z") });
  const user = { id: "user-fixture", planLookupKey: null, trialEndsAt: null };
  const effective = await computeEffectiveAccess(user);
  expect(effective.tier).toBe("ultimate");
  expect(effective.sponsoredProCareAccess).toBe(false);
  expect(effective.pilotProCareAccess).toBe(false);
  expect(resolveAccessTier({ ...user, hasTemporaryClinicalAccess: effective.temporaryClinicalAccess })).toBe("PAID_FULL");
});

test("personal founder grant upgrades consumer access but never Studio sponsorship", async () => {
  db.execute.mockResolvedValueOnce({ rows: [{
    ...grant(), status: "active", personal_access_started_at: now,
    personal_access_ends_at: new Date("2026-12-01T12:00:00Z"),
  }] });
  const effective = await computeEffectiveAccess({ id: "user-fixture", planLookupKey: "mpm_premium_monthly" });
  expect(effective.tier).toBe("ultimate");
  expect(effective.planLookupKey).toBe("mpm_premium_monthly");
  expect(effective.pilotProCareAccess).toBe(false);
  expect(effective.sponsoredProCareAccess).toBe(false);
});

test("expired independent access falls back to Free without erasing identity", async () => {
  const effective = await computeEffectiveAccess({ id: "user-fixture", planLookupKey: null });
  expect(effective.tier).toBe("free");
  expect(resolveAccessTier({ hasTemporaryClinicalAccess: effective.temporaryClinicalAccess })).toBe("FREE");
});

test.each([7, 14, 30])("client %i-day window is independent of the physician's cutoff", days => {
  const { clinicTrialEnd } = jest.requireActual("../services/clinicPilotEnrollmentService");
  const accepted = new Date("2026-11-20T12:00:00Z");
  const end = clinicTrialEnd(accepted, days);
  expect(end.getTime() - accepted.getTime()).toBe(days * 86400000);
  if (days === 30) expect(end.toISOString()).toBe("2026-12-20T12:00:00.000Z");
});

test.each([
  [{ invitationType: "client" }, false, "/onboarding"],
  [{ populationType: "client" }, false, "/onboarding"],
  [{ invitationType: "client" }, true, "/dashboard"],
  [{ invitationType: "team_member" }, true, "/business-dashboard"],
])("invitation return destination is role-aware", (invitation, completed, destination) => {
  expect(invitationDestination(invitation, completed)).toBe(destination);
});

test("complimentary organization cannot start paid checkout, including a missing cutoff", () => {
  expect(() => assertOrganizationChargeAllowed({ commercialAccessMode: "onboarding_pilot", commercialAccessEndsAt: "2026-12-01" }, now)).toThrow();
  expect(() => assertOrganizationChargeAllowed({ commercialAccessMode: "onboarding_pilot", commercialAccessEndsAt: null }, now)).toThrow();
  expect(() => assertOrganizationChargeAllowed({ commercialAccessMode: "onboarding_pilot", commercialAccessEndsAt: now }, now)).not.toThrow();
});

test.each([undefined, {}, { accepted: false }, { accepted: true, priceId: "wrong", termsVersion: ORGANIZATION_BILLING_TERMS_VERSION }])("no implicit billing consent", value => {
  expect(() => validateOrganizationBillingConsent(value, "price-fixture")).toThrow();
});

test("current explicit terms and exact price are required", () => {
  expect(() => validateOrganizationBillingConsent({
    accepted: true, priceId: "price-fixture", termsVersion: ORGANIZATION_BILLING_TERMS_VERSION,
  }, "price-fixture")).not.toThrow();
});

test("quote comes from an active, recurring exact Stripe price, never a fallback amount", () => {
  const price = { id: "price-fixture", active: true, unit_amount: 4499, currency: "usd", recurring: { interval: "month", interval_count: 1 } };
  expect(organizationQuoteFromPrice(price, price.id).unitAmount).toBe(4499);
  expect(() => organizationQuoteFromPrice({ ...price, unit_amount: null }, price.id)).toThrow();
  expect(() => organizationQuoteFromPrice({ ...price, active: false }, price.id)).toThrow();
  expect(() => organizationQuoteFromPrice(price, "other-price")).toThrow();
});

test("reservation replay cannot change the consenting organization or price", async () => {
  db.execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
  await expect(recordOrganizationCheckoutConsent("reservation", "business", "user", {
    priceId: "price-fixture", unitAmount: 4499, currency: "usd", interval: "month", intervalCount: 1,
    termsVersion: ORGANIZATION_BILLING_TERMS_VERSION,
  })).rejects.toMatchObject({ code: "BILLING_CONSENT_NOT_VERIFIED" });
});
