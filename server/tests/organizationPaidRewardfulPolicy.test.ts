import { deriveOrganizationPartnerLifecycle } from "../services/organizationPartnerRevenueService";
import { organizationRewardfulCampaignId, verifyOrganizationRewardfulPayment } from "../services/organizationRewardfulPolicy";
jest.mock("../db", () => ({ db: {} }));
jest.mock("../services/stripePlanCatalog", () => ({
  planFromSubscription: (subscription: any) => subscription.items?.data[0]?.price?.id === "price_organization"
    ? { planLookupKey: "clinical_business_monthly" } : null,
}));
const previous = { ...process.env };
const now = new Date("2026-11-12T12:00:00Z");
const business = { status: "active" as const, commercialAccessMode: "paid" as const,
  commercialAccessStartedAt: new Date("2026-11-11"), commercialAccessEndsAt: null,
  createdAt: new Date("2026-10-01"), stripeCustomerId: "cus_organization",
  stripeSubscriptionId: "sub_organization", stripeLastEventCreatedAt: new Date("2026-11-11") };
beforeEach(() => {
  process.env.NODE_ENV = "production";
  process.env.ORGANIZATION_PAID_CONTINUATION_ENABLED = "true";
  process.env.BUSINESS_PILOT_ACTIVATION_ENABLED = "false";
  process.env.BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED = "false";
});
afterAll(() => { process.env = previous; });
function lifecycle(change: any = {}, affiliateId: string | null = null) {
  return deriveOrganizationPartnerLifecycle({ business: { ...business, ...change },
    rewardfulAffiliateId: affiliateId, rewardfulState: affiliateId ? "active" : "not_activated", now });
}
test("approved paid-only eligibility works in compiled Production mode without founder switches", () => {
  expect(lifecycle()).toMatchObject({ setupAvailable: true, reason: "organization_paid_activation" });
});
test("existing paid subscriptions need no artificial Organization age or new pilot clock", () => {
  expect(lifecycle({ createdAt: new Date("2026-11-11") }).setupAvailable).toBe(true);
});
test.each([
  { commercialAccessMode: "onboarding_pilot", commercialAccessEndsAt: new Date("2026-11-20") },
  { commercialAccessMode: "onboarding_pilot", commercialAccessEndsAt: new Date("2026-11-01") },
  { status: "past_due" }, { status: "cancelled" }, { status: "pending_billing" },
  { commercialAccessMode: null }, { stripeSubscriptionId: null }, { stripeLastEventCreatedAt: null },
])("unpaid, failed, canceled, or unconfirmed Organization cannot onboard: %j", change => {
  expect(lifecycle(change).setupAvailable).toBe(false);
});
test("personal or professional entitlement cannot substitute for an Organization payment", () => {
  expect(lifecycle({ commercialAccessMode: "onboarding_pilot", commercialAccessEndsAt: new Date("2026-11-01"),
    personalPlanLookupKey: "mpm_ultimate_monthly", planLookupKey: "mpm_trainer_5" }).setupAvailable).toBe(false);
});
test("an explicit active authorized arrangement remains a separately identified legacy exception", async () => {
  const exception = { ...business, commercialAccessMode: "authorized_arrangement", stripeSubscriptionId: null };
  expect(lifecycle(exception)).toMatchObject({ setupAvailable: true, reason: "authorized_legacy_arrangement" });
  const provider = stripe();
  await expect(verifyOrganizationRewardfulPayment(exception, provider as any)).resolves.toBe(true);
  expect(provider.subscriptions.retrieve).not.toHaveBeenCalled();
  expect(lifecycle({ ...exception, status: "cancelled" }).setupAvailable).toBe(false);
});
test("existing affiliate identity and historical management survive cancellation", () => {
  expect(lifecycle({ status: "cancelled" }, "existing-organization-affiliate")).toMatchObject({
    state: "active", setupAvailable: true, reason: "rewardful_active",
  });
});
test("default-off Production rollout retains legacy contractual setup rules and campaign selection", () => {
  delete process.env.ORGANIZATION_PAID_CONTINUATION_ENABLED;
  expect(lifecycle({ commercialAccessMode: "authorized_arrangement" }).setupAvailable).toBe(true);
  process.env.REWARDFUL_CAMPAIGN_ID = "fixture-existing-campaign";
  expect(organizationRewardfulCampaignId()).toBe("fixture-existing-campaign");
  process.env.ORGANIZATION_PAID_CONTINUATION_ENABLED = "true";
  expect(organizationRewardfulCampaignId()).toBe("fixture-existing-campaign");
});
function stripe(subscriptionChange: any = {}, invoiceChange: any = {}) {
  return { subscriptions: { retrieve: jest.fn(async () => ({ status: "active", customer: "cus_organization",
    trial_end: null, latest_invoice: "invoice-fixture",
    items: { data: [{ quantity: 1, price: { id: "price_organization" } }] }, ...subscriptionChange })) },
    invoices: { retrieve: jest.fn(async () => ({ status: "paid", amount_paid: 4499, ...invoiceChange })) } };
}
test("onboarding verifies active Organization product and a positive paid invoice using read-only transports", async () => {
  await expect(verifyOrganizationRewardfulPayment(business, stripe() as any)).resolves.toBe(true);
});
test.each([
  { status: "past_due" }, { status: "canceled" }, { status: "trialing" }, { customer: "cus_other" },
  { latest_invoice: null }, { items: { data: [{ quantity: 1, price: { id: "price_personal_or_procare" } }] } },
  { items: { data: [{ quantity: 2, price: { id: "price_organization" } }] } },
])("wrong, failed, or incomplete subscription cannot unlock Rewardful: %j", change => {
  return expect(verifyOrganizationRewardfulPayment(business, stripe(change) as any)).resolves.toBe(false);
});
test.each([{ status: "open" }, { status: "void" }, { amount_paid: 0 }])("unpaid invoice cannot unlock Rewardful: %j", invoice => {
  return expect(verifyOrganizationRewardfulPayment(business, stripe({}, invoice) as any)).resolves.toBe(false);
});
