/** Execute real quote/checkout handlers against fixture-only DB and Stripe transports. */
import { PgDialect } from "drizzle-orm/pg-core";
const mockStripe = { prices: { retrieve: jest.fn() }, checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } } };
jest.mock("../services/isolatedStripeClient", () => ({ __esModule: true, default: jest.fn(() => mockStripe) }));
jest.mock("../middleware/requireAuth", () => ({ requireAuth: jest.fn() }));
jest.mock("../services/stripeRuntimePolicy", () => ({ assertStripeBillingOwnership: jest.fn(), getStripeKeyMode: () => "TEST" }));
jest.mock("../services/stripePlanCatalog", () => ({ getTrustedCheckoutPlan: () => ({ planLookupKey: "clinical_business_monthly", priceId: "price_fixture" }) }));
jest.mock("../services/stripeReconciliationService", () => ({ reconcileCheckoutSession: jest.fn() }));
jest.mock("../services/subscriptionService", () => ({ updateUserSubscription: jest.fn() }));
jest.mock("../services/stripeIdentityOwnershipService", () => ({ claimStripeIdentityOwnership: jest.fn() }));
jest.mock("../services/stripeCheckoutGuard", () => ({ CheckoutBillingConflictError: class extends Error {} }));
jest.mock("../services/businessOfferLinkService", () => ({ getBusinessOfferCheckoutAttribution: jest.fn() }));
jest.mock("../services/rewardfulApi", () => ({ validateRewardfulReferralForAffiliate: jest.fn() }));
jest.mock("../services/organizationBillingLifecycleService", () => ({ getExpiredOrganizationForReconnect: jest.fn() }));
jest.mock("../db", () => ({ db: { select: jest.fn(), update: jest.fn(), execute: jest.fn() } }));
jest.mock("node:crypto", () => ({ ...jest.requireActual("node:crypto"), randomUUID: () => "reservation-fixture" }));
const { db } = jest.requireMock("../db");
const previous = { ...process.env };
let router: any;
let business: any;
let reserved: any;
let quoteOwner = true;
beforeAll(async () => {
  // A synthetic child-process fixture, never a real provider credential.
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture_not_a_credential";
  router = (await import("../routes/stripeCheckout")).default;
});
beforeEach(() => {
  jest.clearAllMocks();
  process.env.ORGANIZATION_PAID_CONTINUATION_ENABLED = "true";
  process.env.BUSINESS_PILOT_ACTIVATION_ENABLED = "false";
  process.env.BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED = "false";
  business = { id: "organization-fixture", ownerUserId: "owner-fixture", status: "active",
    commercialAccessMode: "onboarding_pilot", commercialAccessEndsAt: new Date("2026-01-01"), stripeSubscriptionId: null };
  reserved = { id: business.id, reservationId: "reservation-fixture", reservedSeatCount: 1, savedSessionId: null };
  quoteOwner = true;
  const dialect = new PgDialect();
  db.execute.mockImplementation(async (q: any) => {
    const text = dialect.sqlToQuery(q).sql;
    if (text.includes("SELECT status, commercial_access_mode")) return { rows: quoteOwner ? [{
      status: business.status, commercial_access_mode: business.commercialAccessMode, commercial_access_ends_at: business.commercialAccessEndsAt,
    }] : [] };
    return { rows: [{ reservation_id: "reservation-fixture" }] };
  });
  db.select.mockImplementation(() => ({ from: () => ({ where: () => ({ limit: async () => quoteOwner ? [business] : [] }) }) }));
  db.update.mockImplementation(() => ({ set: () => ({ where: () => ({ returning: async () => [reserved] }) }) }));
  mockStripe.prices.retrieve.mockResolvedValue({ id: "price_fixture", active: true, unit_amount: 4499, currency: "usd", recurring: { interval: "month", interval_count: 1 } });
  mockStripe.checkout.sessions.create.mockResolvedValue({ id: "cs_fixture", url: "https://checkout.stripe.com/fixture" });
});
afterAll(() => { process.env = previous; });
async function invoke(method: string, body: any = {}) {
  const route = router.stack.find((l: any) => l.route?.path === `/checkout/business${method === "get" ? "/quote" : ""}` && l.route.methods[method]);
  const res: any = { status: jest.fn(() => res), json: jest.fn(() => res), setHeader: jest.fn() };
  await route.route.stack.at(-1).handle({ authUser: { id: "owner-fixture" }, query: { businessId: business.id }, body }, res);
  return res;
}
const consent = { accepted: true, priceId: "price_fixture", termsVersion: "organization-monthly-v1" };
test("owner can review and purchase after expiry with founder switches OFF", async () => {
  const quote = await invoke("get");
  expect(quote.json).toHaveBeenCalledWith(expect.objectContaining({ unitAmount: 4499, currency: "usd" }));
  const checkout = await invoke("post", { businessId: business.id, seats: 1, billingConsent: consent });
  expect(checkout.json).toHaveBeenCalledWith({ url: "https://checkout.stripe.com/fixture" });
  const [session, options] = mockStripe.checkout.sessions.create.mock.calls[0];
  expect(session.line_items).toEqual([{ price: "price_fixture", quantity: 1 }]);
  expect(session.metadata).toMatchObject({ businessId: business.id, userId: "owner-fixture", billingTermsVersion: consent.termsVersion });
  expect(session.subscription_data.metadata.billingTermsVersion).toBe(consent.termsVersion);
  expect(options.idempotencyKey).toContain("organization-fixture:reservation-fixture");
});
test("default-off switch blocks quote and direct POST before checkout reservations", async () => {
  delete process.env.ORGANIZATION_PAID_CONTINUATION_ENABLED;
  expect((await invoke("get")).status).toHaveBeenCalledWith(503);
  expect((await invoke("post", { businessId: business.id, billingConsent: consent })).status).toHaveBeenCalledWith(503);
  expect(db.update).not.toHaveBeenCalled();
  expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
});
test("another organization owner cannot review or purchase", async () => {
  quoteOwner = false;
  expect((await invoke("get")).status).toHaveBeenCalledWith(403);
  expect((await invoke("post", { businessId: business.id, billingConsent: consent })).status).toHaveBeenCalledWith(403);
  expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
});
test("still-active pilot and missing consent cannot create checkout", async () => {
  business.commercialAccessEndsAt = new Date("2099-01-01");
  expect((await invoke("post", { businessId: business.id, billingConsent: consent })).status).toHaveBeenCalledWith(409);
  business.commercialAccessEndsAt = new Date("2026-01-01");
  expect((await invoke("post", { businessId: business.id })).status).toHaveBeenCalledWith(400);
  expect(db.update).not.toHaveBeenCalled();
});
test("incorrect Stripe amount fails closed in quote and POST", async () => {
  mockStripe.prices.retrieve.mockResolvedValue({ id: "price_fixture", active: true, unit_amount: 7999, currency: "usd", recurring: { interval: "month", interval_count: 1 } });
  expect((await invoke("get")).status).toHaveBeenCalledWith(503);
  expect((await invoke("post", { businessId: business.id, billingConsent: consent })).status).toHaveBeenCalledWith(503);
  expect(db.update).not.toHaveBeenCalled();
});
test("open session is reused and completed payment goes to reconciliation, not another charge", async () => {
  reserved.savedSessionId = "cs_fixture";
  const session = { id: "cs_fixture", status: "open", url: "https://checkout.stripe.com/fixture",
    metadata: { userId: "owner-fixture", businessId: business.id, checkoutReservationId: "reservation-fixture", sku: "clinical_business_monthly" } };
  mockStripe.checkout.sessions.retrieve.mockResolvedValue(session);
  expect((await invoke("post", { businessId: business.id, billingConsent: consent })).json).toHaveBeenCalledWith({ url: session.url });
  mockStripe.checkout.sessions.retrieve.mockResolvedValue({ ...session, status: "complete", payment_status: "paid" });
  const done = await invoke("post", { businessId: business.id, billingConsent: consent });
  expect(done.status).toHaveBeenCalledWith(409);
  expect(done.json).toHaveBeenCalledWith(expect.objectContaining({ code: "BILLING_VERIFICATION_PENDING" }));
  expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled();
});
