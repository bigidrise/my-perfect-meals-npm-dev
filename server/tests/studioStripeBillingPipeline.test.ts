import { db } from "../db";
import {
  getTrustedStudioPlan,
  hasStudioBillingMetadata,
  resolveTrustedStudioSubscription,
} from "../services/studioStripePlanCatalog";
import {
  applyStudioStripeSubscription,
  StudioStripeBillingConflictError,
} from "../services/studioStripeBillingService";

const planCatalog = jest.requireMock("../services/stripePlanCatalog") as {
  getTrustedCheckoutPlan: jest.Mock;
  planFromSubscription: jest.Mock;
};

jest.mock("../db", () => ({
  db: {
    select: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock("../services/stripePlanCatalog", () => ({
  getTrustedCheckoutPlan: jest.fn(),
  planFromSubscription: jest.fn(),
}));

describe("independent Studio Stripe billing pipeline", () => {
  const originalSnapshotGate = process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED = "true";
    planCatalog.getTrustedCheckoutPlan.mockImplementation((key: string) => ({
      planLookupKey: key,
      priceId: `price_${key}`,
    }));
    planCatalog.planFromSubscription.mockImplementation((subscription: any) => ({
      planLookupKey: subscription.items.data[0].price.lookup_key,
      priceId: subscription.items.data[0].price.id,
    }));
  });

  afterAll(() => {
    if (originalSnapshotGate === undefined) delete process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED;
    else process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED = originalSnapshotGate;
  });

  it("selects trusted professional SKUs from Studio type, not Personal plan data", () => {
    expect(getTrustedStudioPlan("studio")?.planLookupKey).toBe("mpm_trainer_5");
    expect(getTrustedStudioPlan("clinic")?.planLookupKey).toBe("mpm_physician_50");
    expect(getTrustedStudioPlan("unknown")).toBeNull();

    const subscription = {
      metadata: { sku: "mpm_trainer_5" },
      items: { data: [{ price: { id: "price_mpm_trainer_5", lookup_key: "mpm_trainer_5" } }] },
    };
    expect(resolveTrustedStudioSubscription(subscription as any, "studio")?.planLookupKey)
      .toBe("mpm_trainer_5");
    expect(resolveTrustedStudioSubscription(subscription as any, "clinic")).toBeNull();
  });

  it("treats incomplete Studio metadata as Studio billing so it cannot fall through to Personal", () => {
    expect(hasStudioBillingMetadata({ serviceType: "studio" })).toBe(true);
    expect(hasStudioBillingMetadata({ studioId: "studio-1" })).toBe(true);
    expect(hasStudioBillingMetadata({ subscriptionType: "studio" })).toBe(true);
    expect(hasStudioBillingMetadata({ subscriptionType: "individual" })).toBe(false);
  });

  it("fails closed on missing or mismatched immutable Studio checkout identity before DB/Stripe work", async () => {
    const badSubscription: any = {
      id: "sub_studio",
      customer: "cus_studio",
      status: "active",
      metadata: {
        serviceType: "studio",
        subscriptionType: "studio",
        userId: "owner-1",
        studioId: "studio-other",
        checkoutReservationId: "reservation-1",
        sku: "mpm_trainer_5",
      },
      items: { data: [{ current_period_end: 2_000_000_000 }] },
    };
    await expect(applyStudioStripeSubscription({
      stripe: { prices: { retrieve: jest.fn() } } as any,
      subscription: badSubscription,
      customerId: "cus_studio",
      ownerUserId: "owner-1",
      studioId: "studio-1",
      reservationId: "reservation-1",
      checkoutSessionId: "cs_studio",
      mutation: {
        eventId: "evt_studio",
        eventCreatedAt: new Date(),
        eventRank: 50,
        source: "webhook",
      },
    })).rejects.toBeInstanceOf(StudioStripeBillingConflictError);
    expect(db.select).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});