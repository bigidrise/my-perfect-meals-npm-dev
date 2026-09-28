import type Stripe from "stripe";
import { users } from "@shared/schema";
import { studios } from "../db/schema/studio";
import { serviceBillingSnapshots } from "../db/schema/serviceBillingSnapshots";
import { stripeIdentityOwners } from "../db/schema/stripeBilling";
import { STRIPE_PRICE_IDS } from "../config/stripePrices";
import { changeStudioRenewal, StudioBillingReviewError } from "../services/studioRenewalService";
import { buildWorkspaceAvailability } from "../services/workspaceAvailabilityService";

let mockState: any;
jest.mock("../db", () => ({
  db: {
    transaction: async (callback: (tx: any) => Promise<unknown>) => {
      mockState.bindingRead = 0;
      const tx = {
        execute: jest.fn(async () => {}),
        select: () => ({
          from: (table: unknown) => ({
            where: () => ({
              limit: async () => {
                if (table === users) return mockState.user ? [mockState.user] : [];
                if (table === studios) return mockState.studios;
                if (table === serviceBillingSnapshots) return mockState.snapshot ? [mockState.snapshot] : [];
                if (table === stripeIdentityOwners) return [mockState.bindings[mockState.bindingRead++]];
                throw new Error("Unexpected table read");
              },
            }),
          }),
        }),
      };
      return callback(tx);
    },
  },
}));
jest.mock("../services/workspaceAvailabilityService", () => ({
  getStudioAccessStatus: jest.fn(async () => mockState.access),
  buildWorkspaceAvailability: jest.requireActual("../services/workspaceAvailabilityService").buildWorkspaceAvailability,
}));
jest.mock("../services/verifiedServiceBillingWriter", () => ({
  ...jest.requireActual("../services/verifiedServiceBillingWriter"),
  persistVerifiedServiceSnapshot: jest.fn(async (_tx: unknown, facts: any) => {
    if (mockState.failWrite) {
      mockState.failWrite = false;
      throw new Error("simulated database outage");
    }
    mockState.snapshot = facts;
    mockState.access.billing = {
      state: facts.cancelAtPeriodEnd ? "ending" : "active",
      paidThrough: facts.currentPeriodEnd.toISOString(),
    };
  }),
}));

const studioId = "11111111-1111-4111-8111-111111111111";
const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86400;
const priceId = STRIPE_PRICE_IDS.mpm_trainer_5;
let stripe: Pick<Stripe, "subscriptions" | "prices">;
let update: jest.Mock;
const originalGate = process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED;

beforeEach(() => {
  process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED = "true";
  const date = new Date(periodEnd * 1000);
  mockState = {
    user: {
      id: "person-1", customerId: "cus_test_one", subscriptionId: "sub_test_one",
      planKey: "mpm_trainer_5", fallbackPlanKey: "mpm_trainer_5",
      isFounder: false, isSandbox: false, isTester: false,
    },
    studios: [{ id: studioId, status: "active" }],
    snapshot: {
      serviceType: "professional", ownerUserId: "person-1",
      stripeCustomerId: "cus_test_one", stripeSubscriptionId: "sub_test_one",
      businessId: null, studioId, priceId, productId: "prod_test_one",
      trustedPlanKey: "mpm_trainer_5", status: "active",
      currentPeriodEnd: date, cancelAtPeriodEnd: false, terminalAt: null,
      sourceEventId: "evt_original", source: "webhook",
      eventCreatedAt: new Date(Date.now() - 60000), eventRank: 75,
      verifiedAt: new Date(Date.now() - 60000),
    },
    bindings: [
      { ownerUserId: "person-1", businessId: null },
      { ownerUserId: "person-1", businessId: null },
    ],
    access: {
      state: "active", sources: ["personal"], studioActive: true, studioReady: true,
      authorized: true, ownsOrganization: false, setupDestination: null,
      billing: { state: "active", paidThrough: date.toISOString() },
      canManageRenewal: true,
    },
    subscription: {
      id: "sub_test_one", customer: "cus_test_one", status: "active",
      cancel_at_period_end: false, metadata: { userId: "person-1", sku: "mpm_trainer_5" },
      items: { data: [{
        quantity: 1, current_period_end: periodEnd,
        price: { id: priceId, product: "prod_test_one", lookup_key: "mpm_trainer_5" },
      }] },
    },
  };
  update = jest.fn(async (_id: string, args: any) => {
    mockState.subscription.cancel_at_period_end = args.cancel_at_period_end;
    return mockState.subscription;
  });
  stripe = {
    subscriptions: {
      retrieve: jest.fn(async () => mockState.subscription),
      update,
    } as unknown as Stripe.SubscriptionsResource,
    prices: {
      retrieve: jest.fn(async (id: string) => ({ id, product: "prod_test_one" })),
    } as unknown as Stripe.PricesResource,
  };
});

afterAll(() => {
  if (originalGate === undefined) delete process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED;
  else process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED = originalGate;
});

const act = (action: "end" | "keep") =>
  changeStudioRenewal({ userId: "person-1", action, stripe });
const refused = async () => {
  await expect(act("end")).rejects.toBeInstanceOf(StudioBillingReviewError);
  expect(update).not.toHaveBeenCalled();
};

describe("Studio renewal on the exact verified subscription", () => {
  it("ends at the paid-through date, keeps access, then reverses on the same subscription repeatedly", async () => {
    const personalAccount = { ...mockState.user };
    expect(await act("end")).toEqual({
      state: "ending", paidThrough: mockState.snapshot.currentPeriodEnd.toISOString(),
    });
    expect(update).toHaveBeenLastCalledWith(
      "sub_test_one", { cancel_at_period_end: true }, expect.any(Object),
    );
    expect(buildWorkspaceAvailability({
      onboardingCompletedAt: new Date(),
      professionalRole: "trainer", organizations: [],
      studioEntitled: mockState.access.authorized,
      existingStudioStatus: mockState.studios[0].status,
      studioReady: mockState.access.studioReady,
    }).studio.available).toBe(true);
    await act("end");
    expect(update).toHaveBeenCalledTimes(1);
    expect(await act("keep")).toMatchObject({ state: "active" });
    await act("keep");
    expect(update).toHaveBeenCalledTimes(2);
    await act("end");
    await act("keep");
    expect(update.mock.calls.map(([id, args]) => [id, args.cancel_at_period_end]))
      .toEqual([["sub_test_one", true], ["sub_test_one", false],
        ["sub_test_one", true], ["sub_test_one", false]]);
    expect(mockState.user).toEqual(personalAccount);
    expect(mockState.studios).toEqual([{ id: studioId, status: "active" }]);
    expect((stripe.subscriptions as any).retrieve).toHaveBeenCalled();
    expect(Object.keys(stripe.subscriptions)).not.toContain("create");
  });

  it.each([
    ["wrong subscription", () => { mockState.subscription.id = "sub_other"; }],
    ["wrong owner", () => { mockState.subscription.metadata.userId = "person-other"; }],
    ["wrong customer", () => { mockState.subscription.customer = "cus_other"; }],
    ["wrong price", () => { mockState.subscription.items.data[0].price.id = "price_other"; }],
    ["wrong product", () => { mockState.subscription.items.data[0].price.product = "prod_other"; }],
    ["stale snapshot", () => { mockState.snapshot.currentPeriodEnd = new Date(Date.now() - 1000); }],
    ["missing snapshot provenance", () => { mockState.snapshot.sourceEventId = ""; }],
    ["future snapshot event", () => { mockState.snapshot.eventCreatedAt = new Date(Date.now() + 60000); }],
    ["wrong Studio", () => { mockState.snapshot.studioId = "22222222-2222-4222-8222-222222222222"; }],
    ["wrong registry owner", () => { mockState.bindings[1].ownerUserId = "person-other"; }],
    ["business-owned customer", () => { mockState.bindings[0].businessId = studioId; }],
    ["terminal subscription", () => { mockState.subscription.status = "canceled"; }],
    ["needs review", () => { mockState.access.billing.state = "needs_review"; }],
    ["managed", () => { mockState.access.sources = ["internal"]; mockState.access.state = "managed_access"; }],
    ["sponsored", () => { mockState.access.sources = ["sponsored"]; }],
    ["pilot", () => { mockState.access.sources = ["pilot"]; }],
    ["mixed sources", () => { mockState.access.sources = ["personal", "sponsored"]; }],
  ])("does not mutate Stripe for %s", async (_name, alter) => {
    alter();
    await refused();
  });

  it("does not touch Stripe while the snapshot gate is off", async () => {
    process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED = "false";
    await refused();
  });

  it("retries safely if Stripe fails or persistence fails after Stripe succeeds", async () => {
    update.mockRejectedValueOnce(new Error("simulated Stripe outage"));
    await expect(act("end")).rejects.toThrow("simulated Stripe outage");
    expect(mockState.snapshot.cancelAtPeriodEnd).toBe(false);
    mockState.failWrite = true;
    await expect(act("end")).rejects.toThrow("simulated database outage");
    expect(mockState.subscription.cancel_at_period_end).toBe(true);
    expect(mockState.snapshot.cancelAtPeriodEnd).toBe(false);
    expect(await act("end")).toMatchObject({ state: "ending" });
    expect(update).toHaveBeenCalledTimes(2);
  });
});