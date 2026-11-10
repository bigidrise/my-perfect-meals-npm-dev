/** Hermetic: no application bootstrap, database connection, or provider calls. */
import { assertOrganizationContinuationPrice, assertOrganizationPaidContinuationPurchaseAllowed, organizationPaidContinuationEnabled } from "../services/organizationPaidContinuationPolicy";
import { businessPilotActivationEnabled, ORGANIZATION_BILLING_TERMS_VERSION, validateOrganizationBillingConsent } from "../services/businessPilotActivationPolicy";
import { verifyOrganizationCheckoutConsentEvidence, verifyOrganizationSubscriptionConsentEvidence } from "../services/organizationCheckoutConsent";
import { PgDialect } from "drizzle-orm/pg-core";

jest.mock("../db", () => ({ db: { execute: jest.fn() } }));
const { db } = jest.requireMock("../db");
const now = new Date("2026-11-11T15:41:27.737Z");
const expired = { status: "active", commercialAccessMode: "onboarding_pilot", commercialAccessEndsAt: now };
const quote = { unitAmount: 4499, currency: "usd", interval: "month", intervalCount: 1 };
const tagged = { billingTermsVersion: ORGANIZATION_BILLING_TERMS_VERSION };
const evidence = { sessionMetadata: tagged, subscriptionMetadata: tagged, userId: "owner-fixture",
  businessId: "organization-fixture", reservationId: "reservation-fixture", priceId: "price_fixture",
  subscriptionStatus: "active" };
const previous = { ...process.env };
beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.ORGANIZATION_PAID_CONTINUATION_ENABLED;
  process.env.BUSINESS_PILOT_ACTIVATION_ENABLED = "false";
  process.env.BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED = "false";
});
afterAll(() => { process.env = previous; });

test("default OFF independently of founder flags; denied before persistence", () => {
  expect(organizationPaidContinuationEnabled()).toBe(false);
  expect(() => assertOrganizationPaidContinuationPurchaseAllowed(expired, now)).toThrow(/release approval/);
  process.env.BUSINESS_PILOT_ACTIVATION_ENABLED = "true";
  process.env.BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED = "true";
  expect(() => assertOrganizationPaidContinuationPurchaseAllowed(expired, now)).toThrow(/release approval/);
  expect(db.execute).not.toHaveBeenCalled();
});
test("independent continuation works at the exact expiration with both founder switches OFF", () => {
  process.env.ORGANIZATION_PAID_CONTINUATION_ENABLED = "true";
  expect(businessPilotActivationEnabled()).toBe(false);
  expect(() => assertOrganizationPaidContinuationPurchaseAllowed(expired, now)).not.toThrow();
  expect(() => assertOrganizationPaidContinuationPurchaseAllowed(expired, new Date(now.getTime() + 7 * 86400000))).not.toThrow();
});
test.each([null, new Date("invalid"), new Date(now.getTime() + 1)])("active/unknown pilot end %s fails closed", end => {
  process.env.ORGANIZATION_PAID_CONTINUATION_ENABLED = "true";
  expect(() => assertOrganizationPaidContinuationPurchaseAllowed({ ...expired, commercialAccessEndsAt: end }, now)).toThrow();
});
test.each(["past_due", "cancelled", "pending_billing"])("pilot status %s cannot start continuation", status => {
  process.env.ORGANIZATION_PAID_CONTINUATION_ENABLED = "true";
  expect(() => assertOrganizationPaidContinuationPurchaseAllowed({ ...expired, status }, now)).toThrow();
});
test("existing paid and legacy purchases are not gated by the new pilot purchase flag", () => {
  for (const commercialAccessMode of ["paid", "authorized_arrangement", null]) {
    expect(() => assertOrganizationPaidContinuationPurchaseAllowed({ ...expired, commercialAccessMode }, now)).not.toThrow();
  }
});
test.each([{ unitAmount: 4500 }, { currency: "eur" }, { interval: "year" }, { intervalCount: 12 }])("rejects wrong price or interval %j", change => {
  expect(() => assertOrganizationContinuationPrice({ ...quote, ...change })).toThrow();
});
test("accepts only the intended monthly USD price", () => {
  expect(() => assertOrganizationContinuationPrice(quote)).not.toThrow();
});
test.each([null, { accepted: false }, { accepted: true, priceId: "other", termsVersion: ORGANIZATION_BILLING_TERMS_VERSION }])("explicit matching consent required %j", consent => {
  expect(() => validateOrganizationBillingConsent(consent, "price_fixture")).toThrow();
});
test("new consent-tagged payments verify minimal persisted evidence with exact subject and financial terms", async () => {
  db.execute.mockResolvedValue({ rows: [{ reservation_id: "reservation-fixture" }] });
  await expect(verifyOrganizationCheckoutConsentEvidence(evidence)).resolves.toBeUndefined();
  const sql = new PgDialect().sqlToQuery(db.execute.mock.calls[0][0]);
  expect(sql.params).toEqual(expect.arrayContaining(["reservation-fixture", "organization-fixture", "owner-fixture", "price_fixture", ORGANIZATION_BILLING_TERMS_VERSION]));
  expect(sql.sql).toMatch(/unit_amount = 4499/);
  expect(sql.sql).toMatch(/quantity = 1/);
});
test("lost consent evidence fails closed without granting access", async () => {
  db.execute.mockResolvedValue({ rows: [] });
  await expect(verifyOrganizationCheckoutConsentEvidence(evidence)).rejects.toMatchObject({ code: "BILLING_CONSENT_NOT_VERIFIED" });
});
test.each([
  { subscriptionMetadata: {} }, { sessionMetadata: {} },
  { subscriptionStatus: "trialing" }, { subscriptionStatus: "incomplete" },
  { subscriptionStatus: "past_due" }, { subscriptionStatus: "canceled" },
])("unverified new payment is rejected %j", change => {
  return expect(verifyOrganizationCheckoutConsentEvidence({ ...evidence, ...change })).rejects.toMatchObject({ code: "BILLING_CONSENT_NOT_VERIFIED" });
});
test("legacy untagged paid delivery remains compatible; changing rollout flag cannot strand a completed payment", async () => {
  await expect(verifyOrganizationCheckoutConsentEvidence({ ...evidence, sessionMetadata: {}, subscriptionMetadata: {} })).resolves.toBeUndefined();
  expect(db.execute).not.toHaveBeenCalled();
  db.execute.mockResolvedValue({ rows: [{ reservation_id: "reservation-fixture" }] });
  await expect(verifyOrganizationCheckoutConsentEvidence(evidence)).resolves.toBeUndefined();
});
test("invoice and subscription events cannot bypass new-purchase consent or grant trialing access", async () => {
  const input = { metadata: { ...tagged, businessId: evidence.businessId, checkoutReservationId: evidence.reservationId },
    userId: evidence.userId, priceId: evidence.priceId, subscriptionStatus: "active" };
  db.execute.mockResolvedValue({ rows: [] });
  await expect(verifyOrganizationSubscriptionConsentEvidence(input)).rejects.toMatchObject({ code: "BILLING_CONSENT_NOT_VERIFIED" });
  db.execute.mockResolvedValue({ rows: [{ reservation_id: evidence.reservationId }] });
  await expect(verifyOrganizationSubscriptionConsentEvidence(input)).resolves.toBeUndefined();
  await expect(verifyOrganizationSubscriptionConsentEvidence({ ...input, subscriptionStatus: "trialing" })).rejects.toMatchObject({ code: "BILLING_CONSENT_NOT_VERIFIED" });
});
