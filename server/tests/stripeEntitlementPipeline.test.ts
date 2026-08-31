import fs from "fs";
import path from "path";
import type Stripe from "stripe";
import { STRIPE_PRICE_IDS } from "../config/stripePrices";
import {
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
    expect(service).toContain("stripeLastEventCreatedAt");
    expect(service).toContain("eventOrderingCondition");
    expect(legacy).toContain("LEGACY_WEBHOOK_RETIRED");
    expect(legacy).not.toContain("customers.list({");
    expect(legacy).not.toContain(".where(eq(users.email");
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