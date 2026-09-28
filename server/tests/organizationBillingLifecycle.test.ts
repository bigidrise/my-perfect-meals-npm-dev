import { PgDialect } from "drizzle-orm/pg-core";
import { businesses } from "../db/schema/business";
import { serviceBillingSnapshots } from "../db/schema/serviceBillingSnapshots";
import { stripeIdentityOwners } from "../db/schema/stripeBilling";

type Row = Record<string, any>;
type TestState = { businesses: Row[]; snapshots: Row[]; owners: Row[] };
let state: TestState;
const dialect = new PgDialect();
const key = (column: string) => column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

function rowsFor(current: TestState, table: any): Row[] {
  if (table === businesses) return current.businesses;
  if (table === serviceBillingSnapshots) return current.snapshots;
  if (table === stripeIdentityOwners) return current.owners;
  throw new Error("Unexpected table in Organization billing test");
}

function matches(table: any, row: Row, condition: any): boolean {
  const { params } = dialect.sqlToQuery(condition);
  if (table === businesses) return row.id === params[0] && row.ownerUserId === params[1];
  if (table === serviceBillingSnapshots) return row.stripeSubscriptionId === params[0];
  if (table === stripeIdentityOwners) {
    return row.identityType === params[0] && row.identityValue === params[1];
  }
  return false;
}

function fakeDb(current: TestState): any {
  return {
    transaction: async (callback: (tx: any) => Promise<any>) => {
      const working = structuredClone(current);
      const result = await callback(fakeDb(working));
      state = working;
      return result;
    },
    execute: async () => [],
    select: () => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: async (count: number) =>
            rowsFor(current, table).filter((row) => matches(table, row, condition)).slice(0, count),
        }),
      }),
    }),
    insert: (table: any) => ({
      values: (values: Row) => ({
        onConflictDoUpdate: ({ set }: { set: Row }) => ({
          returning: async () => {
            const rows = rowsFor(current, table);
            const existing = rows.find((row) =>
              row.stripeSubscriptionId === values.stripeSubscriptionId);
            if (existing) Object.assign(existing, set);
            else rows.push({ ...values });
            return [{ stripeSubscriptionId: values.stripeSubscriptionId }];
          },
        }),
      }),
    }),
  };
}

jest.mock("../db", () => ({
  db: {
    transaction: (callback: any) => fakeDb(state).transaction(callback),
    execute: (...args: any[]) => fakeDb(state).execute(...args),
    select: (...args: any[]) => fakeDb(state).select(...args),
    insert: (...args: any[]) => fakeDb(state).insert(...args),
  },
}));

import {
  changeOrganizationRenewal,
  getExpiredOrganizationForReconnect,
  OrganizationBillingReviewError,
} from "../services/organizationBillingLifecycleService";

const priceId = process.env.STRIPE_CLINICAL_BUSINESS_MONTHLY_PRICE_ID!;

function setup(status: "active" | "cancelled" = "active") {
  const now = new Date();
  const periodEnd = new Date(Math.floor(
    (now.getTime() + 24 * 60 * 60 * 1000) / 1000,
  ) * 1000);
  state = {
    businesses: [{
      id: "business-owner-only",
      name: "My organization",
      ownerUserId: "owner-1",
      plan: "clinical_business_monthly",
      status,
      commercialAccessMode: "paid",
      stripeCustomerId: "cus_business_only",
      stripeSubscriptionId: "sub_business_only",
      stripeCheckoutReservationId: "reservation-old",
      stripeCheckoutSessionId: "cs-old",
      stripeLastEventCreatedAt: new Date(now.getTime() - 60_000),
      stripeLastEventRank: 50,
      stripeLastEventId: "evt_previous",
    }],
    snapshots: [{
      stripeSubscriptionId: "sub_business_only",
      stripeCustomerId: "cus_business_only",
      serviceType: "organization",
      ownerUserId: "owner-1",
      businessId: "business-owner-only",
      studioId: null,
      priceId,
      productId: "prod_business",
      trustedPlanKey: "clinical_business_monthly",
      status: status === "active" ? "active" : "canceled",
      currentPeriodEnd: status === "active"
        ? periodEnd
        : new Date(now.getTime() - 60_000),
      cancelAtPeriodEnd: false,
      terminalAt: status === "active" ? null : new Date(now.getTime() - 30_000),
      sourceEventId: "evt_previous",
      source: "webhook",
      eventCreatedAt: new Date(now.getTime() - 60_000),
      eventRank: 50,
      verifiedAt: new Date(now.getTime() - 30_000),
    }],
    owners: [
      { identityType: "customer", identityValue: "cus_business_only", ownerUserId: "owner-1", businessId: "business-owner-only" },
      { identityType: "subscription", identityValue: "sub_business_only", ownerUserId: "owner-1", businessId: "business-owner-only" },
    ],
  };
  return { periodEnd };
}

function stripeFixture(periodEnd: Date) {
  const subscription: Row = {
    id: "sub_business_only",
    customer: "cus_business_only",
    status: "active",
    cancel_at_period_end: false,
    items: {
      data: [{
        quantity: 1,
        current_period_end: Math.floor(periodEnd.getTime() / 1000),
        price: {
          id: priceId,
          lookup_key: "clinical_business_monthly",
          product: "prod_business",
        },
      }],
    },
    metadata: { userId: "owner-1", businessId: "business-owner-only", sku: "clinical_business_monthly" },
  };
  return {
    subscription,
    stripe: {
      subscriptions: {
        retrieve: jest.fn(async () => subscription),
        update: jest.fn(async (_id: string, update: Row) => {
          subscription.cancel_at_period_end = update.cancel_at_period_end;
          return subscription;
        }),
      },
      prices: {
        retrieve: jest.fn(async () => ({ id: priceId, product: "prod_business" })),
      },
    } as any,
  };
}

describe("independent Organization billing lifecycle", () => {
  const originalSnapshotsFlag = process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED;
  beforeAll(() => {
    if (!priceId) throw new Error("Clinical Business price is required for billing fixtures");
    process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED = "true";
  });
  afterAll(() => {
    if (originalSnapshotsFlag === undefined) delete process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED;
    else process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED = originalSnapshotsFlag;
  });

  it("ends only the exact paid Organization renewal and preserves its verified paid-through date", async () => {
    const { periodEnd } = setup();
    const { stripe } = stripeFixture(periodEnd);
    await expect(changeOrganizationRenewal({
      ownerUserId: "owner-1",
      businessId: "business-owner-only",
      action: "end",
      stripe,
    })).resolves.toEqual({ state: "ending", paidThrough: periodEnd.toISOString() });
    expect(stripe.subscriptions.update).toHaveBeenCalledWith(
      "sub_business_only",
      { cancel_at_period_end: true },
      expect.objectContaining({ idempotencyKey: expect.stringContaining("business-owner-only") }),
    );
    expect(state.businesses[0].stripeSubscriptionId).toBe("sub_business_only");
    expect(state.snapshots[0]).toMatchObject({
      stripeSubscriptionId: "sub_business_only",
      cancelAtPeriodEnd: true,
    });
  });

  it("keeps the same ending Organization subscription active without creating another subscription", async () => {
    const { periodEnd } = setup();
    const { stripe } = stripeFixture(periodEnd);
    await changeOrganizationRenewal({
      ownerUserId: "owner-1",
      businessId: "business-owner-only",
      action: "end",
      stripe,
    });
    await expect(changeOrganizationRenewal({
      ownerUserId: "owner-1",
      businessId: "business-owner-only",
      action: "keep",
      stripe,
    })).resolves.toMatchObject({ state: "active", paidThrough: periodEnd.toISOString() });
    expect(stripe.subscriptions.update).toHaveBeenCalledTimes(2);
    expect(stripe.subscriptions.update).toHaveBeenLastCalledWith(
      "sub_business_only",
      { cancel_at_period_end: false },
      expect.any(Object),
    );
  });

  it("rejects non-owner billing actions before retrieving or mutating Stripe", async () => {
    const { periodEnd } = setup();
    const { stripe } = stripeFixture(periodEnd);
    await expect(changeOrganizationRenewal({
      ownerUserId: "someone-else",
      businessId: "business-owner-only",
      action: "end",
      stripe,
    })).rejects.toBeInstanceOf(OrganizationBillingReviewError);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it("allows reconnect only when the same owner-held business has verified expired billing", async () => {
    setup("cancelled");
    await expect(getExpiredOrganizationForReconnect("owner-1", "business-owner-only"))
      .resolves.toMatchObject({
        ownerUserId: "owner-1",
        businessId: "business-owner-only",
        stripeCustomerId: "cus_business_only",
        stripeSubscriptionId: "sub_business_only",
      });
    await expect(getExpiredOrganizationForReconnect("other-owner", "business-owner-only"))
      .rejects.toBeInstanceOf(OrganizationBillingReviewError);
  });
});