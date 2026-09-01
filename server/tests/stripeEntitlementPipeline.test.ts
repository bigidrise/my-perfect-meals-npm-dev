import fs from "fs";
import path from "path";
import type Stripe from "stripe";
import { STRIPE_PRICE_IDS } from "../config/stripePrices";
import {
  getStripePriceConfigurationStatus,
  planFromSubscription,
  resolveTrustedStripePlan,
} from "../services/stripePlanCatalog";
import {
  assertStripeBillingOwnership,
  canOwnStripeBilling,
} from "../services/stripeRuntimePolicy";

const root = path.resolve(__dirname, "../..");
const source = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("trusted Stripe entitlement pipeline", () => {
  it("maps configured price IDs and rejects metadata that disagrees with the price", () => {
    const priceId = STRIPE_PRICE_IDS.mpm_premium;
    expect(priceId).toBeTruthy();
    expect(resolveTrustedStripePlan({
      priceId,
      metadataSku: "mpm_premium",
    })?.planLookupKey)
      .toBe("mpm_premium");
    expect(resolveTrustedStripePlan({
      priceId,
      metadataSku: "mpm_ultimate",
    })).toBeNull();
    expect(resolveTrustedStripePlan({ priceId: "price_unconfigured" })).toBeNull();
  });

  it("does not depend on a Stripe lookup_key when the configured price is trusted", () => {
    const subscription = {
      items: {
        data: [{
          price: {
            id: STRIPE_PRICE_IDS.mpm_premium,
            lookup_key: null,
          },
        }],
      },
    } as unknown as Stripe.Subscription;

    expect(planFromSubscription(subscription, "mpm_premium")?.planLookupKey)
      .toBe("mpm_premium");
  });

  it("rejects a conflicting Stripe lookup_key even when the price ID is configured", () => {
    expect(resolveTrustedStripePlan({
      priceId: STRIPE_PRICE_IDS.mpm_premium,
      metadataSku: "mpm_premium",
      stripeLookupKey: "unexpected_lookup_key",
    })).toBeNull();
  });

  it("exposes duplicate configured price mappings as invalid configuration", () => {
    const originalUltimate = STRIPE_PRICE_IDS.mpm_ultimate;
    try {
      STRIPE_PRICE_IDS.mpm_ultimate = STRIPE_PRICE_IDS.mpm_premium;
      const status = getStripePriceConfigurationStatus();
      expect(status.valid).toBe(false);
      expect(status.duplicatePriceIds).toEqual(expect.arrayContaining([
        expect.objectContaining({
          priceId: STRIPE_PRICE_IDS.mpm_premium,
          planLookupKeys: expect.arrayContaining(["mpm_premium", "mpm_ultimate"]),
        }),
      ]));
    } finally {
      STRIPE_PRICE_IDS.mpm_ultimate = originalUltimate;
    }
  });

  it("blocks a live Stripe key outside the production billing owner", () => {
    const previousDeployment = process.env.REPLIT_DEPLOYMENT;
    const previousOwner = process.env.STRIPE_LIVE_BILLING_OWNER;
    try {
      delete process.env.REPLIT_DEPLOYMENT;
      delete process.env.STRIPE_LIVE_BILLING_OWNER;
      expect(canOwnStripeBilling("sk_live_example")).toBe(false);
      expect(canOwnStripeBilling("sk_test_example")).toBe(true);
      expect(() => assertStripeBillingOwnership("sk_live_example"))
        .toThrow(/disabled outside/);

      process.env.REPLIT_DEPLOYMENT = "1";
      expect(canOwnStripeBilling("sk_live_example")).toBe(true);
    } finally {
      if (previousDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
      else process.env.REPLIT_DEPLOYMENT = previousDeployment;
      if (previousOwner === undefined) delete process.env.STRIPE_LIVE_BILLING_OWNER;
      else process.env.STRIPE_LIVE_BILLING_OWNER = previousOwner;
    }
  });

  it("has one durable raw-body webhook with event claiming and stale-write ordering", () => {
    const webhook = source("server/routes/stripeWebhook.ts");
    const legacy = source("server/routes/stripe.ts");
    const service = source("server/services/subscriptionService.ts");
    const events = source("server/services/stripeBillingEventService.ts");

    expect(webhook).toContain("claimBillingEvent");
    expect(webhook).toContain("completeBillingEvent");
    expect(webhook).toContain("failBillingEvent");
    expect(events).toContain(".onConflictDoNothing()");
    expect(events).toContain("staleProcessingCutoff");
    expect(service).toContain("stripeLastEventCreatedAt");
    expect(service).toContain("eventOrderingCondition");
    expect(service).toContain("IDENTITY_CONFLICT");
    expect(service).toContain("metadata conflicts with the stored owner");
    expect(legacy).toContain("LEGACY_WEBHOOK_RETIRED");
    expect(legacy).not.toContain("customers.list({");
    expect(legacy).not.toContain(".where(eq(users.email");
  });

  it("keeps Clinical Business renewals out of the owner's personal plan snapshot", () => {
    const webhook = source("server/routes/stripeWebhook.ts");
    const service = source("server/services/subscriptionService.ts");

    expect(webhook).toContain("storesAsPersonalPlan");
    expect(webhook).toContain('planLookupKey !== "clinical_business_monthly"');
    expect(webhook).toContain("syncBusinessBillingState");
    expect(webhook).toContain("Deliberately do not mutate businessMembers");
    expect(service).toContain("planLookupKey: users.personalPlanLookupKey");
    expect(service).toContain("personalEntitlements");
  });

  it("makes stale subscription events no-ops for destructive and business side effects", () => {
    const webhook = source("server/routes/stripeWebhook.ts");

    expect(webhook).toContain("stale event ignored without side effects");
    expect(webhook).toContain("mutationResult.updated\n            && trustedPlan.planLookupKey");
  });

  it("routes business checkout through the same trusted catalog as consumer checkout", () => {
    const checkout = source("server/routes/stripeCheckout.ts");
    const businessHandler = checkout.slice(checkout.indexOf('router.post("/checkout/business"'));

    expect(businessHandler).toContain('getTrustedCheckoutPlan("clinical_business_monthly")');
    expect(businessHandler).toContain("price: trustedBusinessPlan.priceId");
    expect(businessHandler).not.toContain("process.env.STRIPE_CLINICAL_BUSINESS_MONTHLY_PRICE_ID");
  });

  it("database-enforces unique Stripe ownership for users and businesses", () => {
    const migration = source("server/db/migrations/runStripeBillingMigration.ts");
    const service = source("server/services/subscriptionService.ts");

    expect(migration).toContain("users_stripe_customer_id_uniq");
    expect(migration).toContain("users_stripe_subscription_id_uniq");
    expect(migration).toContain("businesses_stripe_customer_id_uniq");
    expect(migration).toContain("businesses_stripe_subscription_id_uniq");
    expect(service).toContain('code === "23505"');
    expect(service).toContain('"IDENTITY_CONFLICT"');
  });

  it("keeps checkout success client data non-authoritative", () => {
    const checkout = source("server/routes/stripeCheckout.ts");
    const legacy = source("server/routes/stripe.ts");
    const client = source("client/src/pages/CheckoutSuccess.tsx");

    expect(checkout).toContain("subscription_data");
    expect(checkout).toContain("userId");
    expect(checkout).toContain("reconcileCheckoutSession");
    expect(legacy).toContain("CHECKOUT_SUCCESS_ACTIVATION_RETIRED");
    expect(client).toContain("/api/stripe/reconcile-checkout");
    expect(client).toContain("await refreshUser()");
    expect(client).not.toContain("localStorage.setItem");
  });

  it("runs the billing migration in development and production boot paths", () => {
    expect(source("server/index.ts")).toContain("runStripeBillingMigration");
    expect(source("server/prod.ts")).toContain("runStripeBillingMigration");
  });
});