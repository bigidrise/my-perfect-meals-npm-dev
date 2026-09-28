import type Stripe from "stripe";
import { STRIPE_PRICE_IDS } from "../config/stripePrices";
import {
  classifySnapshotWrite,
  compareSnapshotWatermark,
  verifySubscriptionBillingFacts,
} from "../services/verifiedServiceBillingWriter";
import type { ServiceBillingSnapshot } from "../db/schema/serviceBillingSnapshots";
import { reconcileExistingServiceBillingBatch } from "../services/serviceBillingBackfill";

const priceId = STRIPE_PRICE_IDS.mpm_trainer_5;
const orgPriceId = STRIPE_PRICE_IDS.clinical_business_monthly;
const at = new Date("2026-10-01T12:00:00.000Z");
function subscription(input: {
  priceId?: string;
  productId?: string;
  customerId?: string;
  ownerUserId?: string;
  status?: string;
  ending?: boolean;
  periodEnd?: number;
  business?: boolean;
  studio?: string;
} = {}): Stripe.Subscription {
  return {
    id: "sub_test_one",
    customer: input.customerId ?? "cus_test_one",
    metadata: { userId: input.ownerUserId ?? "person-1", sku: input.business ? "clinical_business_monthly" : "mpm_trainer_5" },
    status: input.status ?? "active",
    cancel_at_period_end: input.ending ?? false,
    items: { data: [{
      quantity: 1,
      current_period_end: input.periodEnd ?? 1790812740,
      price: {
        id: input.priceId ?? (input.business ? orgPriceId : priceId),
        product: input.productId ?? "prod_test_one",
        lookup_key: null,
      },
    }] },
  } as unknown as Stripe.Subscription;
}
const mutation = { source: "webhook" as const, eventCreatedAt: at, eventRank: 75, sourceEventId: "evt_test_one" };
const stripe = (priceProduct = "prod_test_one") => ({
  prices: { retrieve: jest.fn(async (id: string) => ({
    id, product: priceProduct,
  })) },
}) as unknown as Pick<Stripe, "prices">;

const facts = (sub = subscription(), client = stripe(), paymentFailed = false) =>
  verifySubscriptionBillingFacts({
    stripe: client, subscription: sub, customerId: "cus_test_one",
    ownerUserId: "person-1",
    expectedPlanKey: sub.metadata.sku,
    mutation, paymentFailed,
  });

describe("verified Stripe subscription facts", () => {
  it("binds professional and Organization prices to their actual Stripe products", async () => {
    const professional = await facts();
    expect(professional).toMatchObject({
      serviceType: "professional", ownerUserId: "person-1",
      stripeSubscriptionId: "sub_test_one", priceId, productId: "prod_test_one",
      status: "active", cancelAtPeriodEnd: false,
    });
    const organization = await facts(subscription({ business: true }));
    expect(organization.serviceType).toBe("organization");
    expect(organization.priceId).toBe(orgPriceId);
  });

  it("records scheduled ending, reversal, terminal state and payment failure without inventing paid-through", async () => {
    expect((await facts(subscription({ ending: true }))).cancelAtPeriodEnd).toBe(true);
    expect((await facts(subscription({ ending: false }))).cancelAtPeriodEnd).toBe(false);
    expect((await facts(subscription({ status: "canceled" }))).terminalAt).toBeInstanceOf(Date);
    expect((await facts(subscription({ status: "trialing" }))).status).toBe("trialing");
    expect((await facts(subscription({ status: "past_due" }))).status).toBe("past_due");
    expect((await facts(subscription(), stripe(), true)).status).toBe("payment_failed");
  });

  it("rejects owner, customer, price, product, and ambiguous items", async () => {
    await expect(facts(subscription({ ownerUserId: "other" }))).rejects.toThrow(/identity/);
    await expect(facts(subscription({ customerId: "cus_other" }))).rejects.toThrow(/identity/);
    await expect(facts(subscription({ priceId: "price_other" }))).rejects.toThrow(/price/);
    await expect(facts(subscription(), stripe("prod_other"))).rejects.toThrow(/product/);
    const twoItems = subscription();
    twoItems.items.data.push(twoItems.items.data[0]);
    await expect(facts(twoItems)).rejects.toThrow(/item count/);
  });
});

describe("snapshot ordering and identity", () => {
  const base: ServiceBillingSnapshot = {
    stripeSubscriptionId: "sub_test_one", stripeCustomerId: "cus_test_one",
    serviceType: "professional", ownerUserId: "person-1",
    businessId: null, studioId: "11111111-1111-4111-8111-111111111111",
    priceId, productId: "prod_test_one", trustedPlanKey: "mpm_trainer_5",
    status: "active", currentPeriodEnd: new Date("2026-11-01"),
    cancelAtPeriodEnd: false, terminalAt: null, sourceEventId: "evt_test_one",
    source: "webhook", eventCreatedAt: at, eventRank: 75, verifiedAt: at,
  };
  it("makes duplicates idempotent and refuses out-of-order events", () => {
    expect(compareSnapshotWatermark({
      ...base, eventCreatedAt: new Date(0), eventRank: 0, sourceEventId: "backfill:sub_test_one",
    }, base)).toBe("newer");
    expect(compareSnapshotWatermark(base, {
      eventCreatedAt: new Date(0), eventRank: 0, sourceEventId: "backfill:sub_test_one",
    })).toBe("stale");
    expect(compareSnapshotWatermark(base, base)).toBe("duplicate");
    expect(compareSnapshotWatermark(base, {
      eventCreatedAt: new Date(at.getTime() - 1000), eventRank: 100, sourceEventId: "older",
    })).toBe("stale");
    expect(classifySnapshotWrite(base, { ...base, sourceEventId: "evt_older", eventRank: 50 })).toBe("stale");
    expect(classifySnapshotWrite(base, { ...base, cancelAtPeriodEnd: true })).toBe("duplicate");
    expect(classifySnapshotWrite(base, {
      ...base, sourceEventId: "evt_new", eventCreatedAt: new Date(at.getTime() + 1000),
      cancelAtPeriodEnd: true,
    })).toBe("write");
    expect(classifySnapshotWrite(base, {
      ...base, sourceEventId: "evt_restore", eventCreatedAt: new Date(at.getTime() + 2000),
      cancelAtPeriodEnd: false,
    })).toBe("write");
  });

  it("never reassigns a subscription to a different owner or workspace", () => {
    expect(classifySnapshotWrite(base, { ...base, ownerUserId: "other" })).toBe("conflict");
    expect(classifySnapshotWrite(base, { ...base, stripeCustomerId: "cus_other" })).toBe("conflict");
    expect(classifySnapshotWrite(base, { ...base, studioId: "22222222-2222-4222-8222-222222222222" })).toBe("conflict");
    expect(classifySnapshotWrite(base, { ...base, businessId: "33333333-3333-4333-8333-333333333333" })).toBe("conflict");
    expect(classifySnapshotWrite(base, { ...base, serviceType: "organization" })).toBe("conflict");
  });
});

describe("bounded backfill activation", () => {
  const enabled = process.env.SERVICE_BILLING_BACKFILL_ENABLED;
  afterEach(() => {
    if (enabled === undefined) delete process.env.SERVICE_BILLING_BACKFILL_ENABLED;
    else process.env.SERVICE_BILLING_BACKFILL_ENABLED = enabled;
  });
  it("cannot run without explicit approval and a separate feature gate", async () => {
    delete process.env.SERVICE_BILLING_BACKFILL_ENABLED;
    const provider = { subscriptions: { retrieve: jest.fn() }, prices: { retrieve: jest.fn() } } as any;
    await expect(reconcileExistingServiceBillingBatch({
      stripe: provider, candidates: [], approved: true,
    })).rejects.toThrow(/not authorized/);
    process.env.SERVICE_BILLING_BACKFILL_ENABLED = "true";
    await expect(reconcileExistingServiceBillingBatch({
      stripe: provider, candidates: [], approved: false,
    })).rejects.toThrow(/not authorized/);
    expect(provider.subscriptions.retrieve).not.toHaveBeenCalled();
  });
  it("refuses oversized batches and leaves incomplete identities for review", async () => {
    process.env.SERVICE_BILLING_BACKFILL_ENABLED = "true";
    const provider = { subscriptions: { retrieve: jest.fn() }, prices: { retrieve: jest.fn() } } as any;
    const incomplete = { ownerUserId: "person-1", businessId: null, customerId: "", subscriptionId: "" };
    await expect(reconcileExistingServiceBillingBatch({
      stripe: provider, candidates: Array(26).fill(incomplete), approved: true,
    })).rejects.toThrow(/25-subscription/);
    expect(await reconcileExistingServiceBillingBatch({
      stripe: provider, candidates: [incomplete], approved: true,
    })).toEqual({ verified: 0, needsReview: 1 });
    expect(provider.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});