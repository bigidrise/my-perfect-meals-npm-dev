import { and, eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { businesses, businessMembers } from "../db/schema/business";
import { stripeBillingEvents, stripeIdentityOwners } from "../db/schema/stripeBilling";
import { serviceBillingSnapshots } from "../db/schema/serviceBillingSnapshots";
import { users } from "@shared/schema";

type Row = Record<string, any>;
type State = {
  users: Row[];
  businesses: Row[];
  owners: Row[];
  members: Row[];
  events: Row[];
  snapshots: Row[];
};

let mockState: State;
const dialect = new PgDialect();
const key = (column: string) => column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
function tableRows(state: State, table: any): Row[] {
  if (table === users) return state.users;
  if (table === businesses) return state.businesses;
  if (table === stripeIdentityOwners) return state.owners;
  if (table === businessMembers) return state.members;
  if (table === stripeBillingEvents) return state.events;
  if (table === serviceBillingSnapshots) return state.snapshots;
  throw new Error("Unexpected table in billing test");
}

function matches(table: any, row: Row, condition: any): boolean {
  const { sql, params } = dialect.sqlToQuery(condition);
  if (table === businesses) return row.id === params[0];
  if (table === users) {
    if (sql.includes('"stripe_customer_id"') && !sql.includes('"id" =')) {
      return row.stripeCustomerId === params[0] || row.stripeSubscriptionId === params[1];
    }
    if (row.id !== params[0]) return false;
    if (sql.includes('"stripe_customer_id"')) {
      return row.stripeCustomerId === params[1] && row.stripeSubscriptionId === params[2];
    }
    return true;
  }
  if (table === stripeIdentityOwners) {
    return row.identityType === params[0] && row.identityValue === params[1];
  }
  if (table === stripeBillingEvents) {
    return row.eventId === params[0] && (
      !sql.includes('"status"') || row.status === "failed"
    );
  }
  if (table === serviceBillingSnapshots) {
    return row.stripeSubscriptionId === params[0];
  }
  throw new Error("Unexpected billing test predicate");
}

function fakeDatabase(state: State): any {
  return {
    transaction: async (callback: (tx: any) => Promise<any>) => {
      const working = structuredClone(state);
      const result = await callback(fakeDatabase(working));
      mockState = working;
      return result;
    },
    execute: async () => [],
    select: (fields?: Row) => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: async (count: number) => tableRows(state, table)
            .filter((row) => matches(table, row, condition))
            .slice(0, count)
            .map((row) => fields
              ? Object.fromEntries(Object.entries(fields).map(([alias, col]: [string, any]) =>
                [alias, row[key(col.name)]]))
              : { ...row }),
        }),
      }),
    }),
    insert: (table: any) => ({
      values: (values: Row) => ({
        onConflictDoNothing: () => {
          const insert = () => {
            const rows = tableRows(state, table);
            const duplicate = table === stripeIdentityOwners
              ? rows.some((row) => row.identityType === values.identityType && row.identityValue === values.identityValue)
              : table === businessMembers
                ? rows.some((row) => row.businessId === values.businessId && row.userId === values.userId)
                : rows.some((row) => row.eventId === values.eventId);
            if (!duplicate) rows.push({ ...values });
            return duplicate ? [] : [values];
          };
          return {
            returning: async () => insert(),
            then: (resolve: any, reject: any) => Promise.resolve(insert()).then(resolve, reject),
          };
        },
      }),
    }),
    update: (table: any) => ({
      set: (values: Row) => ({
        where: (condition: any) => {
          const update = () => {
            const rows = tableRows(state, table).filter((row) => matches(table, row, condition));
            for (const row of rows) Object.assign(row, values);
            return rows;
          };
          return {
            returning: async () => update(),
            then: (resolve: any, reject: any) => Promise.resolve(update()).then(resolve, reject),
          };
        },
      }),
    }),
  };
}

// The real services and real Drizzle conditions execute against isolated, transactional
// in-memory rows. Neither this suite nor its Stripe fixture touches Neon or Stripe.
jest.mock("../db", () => ({
  db: {
    transaction: (callback: any) => fakeDatabase(mockState).transaction(callback),
    execute: (...args: any[]) => fakeDatabase(mockState).execute(...args),
    select: (...args: any[]) => fakeDatabase(mockState).select(...args),
    insert: (...args: any[]) => fakeDatabase(mockState).insert(...args),
    update: (...args: any[]) => fakeDatabase(mockState).update(...args),
  },
}));

import { reconcileCheckoutSession } from "../services/stripeReconciliationService";
import { applyBusinessSubscriptionTransition } from "../services/businessSubscriptionService";
import { cancelUserSubscription, updateUserSubscription } from "../services/subscriptionService";

const priceId = process.env.STRIPE_CLINICAL_BUSINESS_MONTHLY_PRICE_ID;
const metadata = {
  userId: "owner-1",
  businessId: "business-1",
  checkoutReservationId: "reservation-1",
  sku: "clinical_business_monthly",
  subscriptionType: "business_seat",
};
const makeSession = () => ({
  id: "cs_business_1",
  mode: "subscription",
  status: "complete",
  payment_status: "paid",
  customer: "cus_business_1",
  metadata: { ...metadata },
  subscription: {
    id: "sub_business_1",
    status: "active",
    customer: "cus_business_1",
    metadata: { ...metadata },
    items: { data: [{ quantity: 1, price: { id: priceId, lookup_key: "clinical_business_monthly" } }] },
  },
});

function resetRows() {
  mockState = {
    users: [{
      id: "owner-1",
      stripeCustomerId: "cus_personal_separate",
      stripeSubscriptionId: "sub_personal_separate",
      planLookupKey: "mpm_ultimate_monthly",
      subscriptionStatus: "active",
    }],
    businesses: [{
      id: "business-1",
      name: "Fixture organization",
      ownerUserId: "owner-1",
      plan: "clinical_business_monthly",
      status: "pending_billing",
      commercialAccessMode: null,
      stripeCheckoutReservationId: "reservation-1",
      stripeCheckoutSessionId: "cs_business_1",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeLastEventCreatedAt: null,
      stripeLastEventRank: 0,
    }],
    owners: [],
    members: [],
    events: [],
      snapshots: [],
  };
}

function stripeFixture(session = makeSession()) {
  return { checkout: { sessions: { retrieve: jest.fn().mockResolvedValue(session) } } } as any;
}

async function reconcile(session = makeSession(), userId = "owner-1") {
  return reconcileCheckoutSession({
    stripe: stripeFixture(session),
    userId,
    sessionId: session.id,
  });
}

describe("verified Clinical Business checkout reconciliation (no external services)", () => {
  beforeAll(() => {
    if (!priceId) throw new Error("Clinical Business price must be configured for the regression fixture");
  });
  beforeEach(resetRows);

  it("rolls back and retries a personal transition when snapshot persistence fails", async () => {
    const mutation = {
      eventId: "evt_personal_retry", eventCreatedAt: new Date("2026-09-09T01:37:26Z"),
      eventRank: 75, source: "webhook" as const,
    };
    const transition = (onAccepted: any) => updateUserSubscription({
      userId: "owner-1", lookupKey: "mpm_premium", mutation, onAccepted,
    });
    await expect(transition(async () => { throw new Error("snapshot write failed"); }))
      .rejects.toThrow("snapshot write failed");
    expect(mockState.users[0].planLookupKey).toBe("mpm_ultimate_monthly");
    const persisted = jest.fn(async () => {});
    await expect(transition(persisted)).resolves.toMatchObject({ updated: true });
    expect(persisted).toHaveBeenCalledTimes(1);
    expect(mockState.users[0].planLookupKey).toBe("mpm_premium");
  });

  it("rolls back and retries a business transition when snapshot persistence fails", async () => {
    const mutation = {
      eventId: "evt_business_retry", eventCreatedAt: new Date("2026-09-09T01:37:26Z"),
      eventRank: 50, source: "webhook" as const,
    };
    const transition = (onAccepted: any) => applyBusinessSubscriptionTransition({
      ownerUserId: "owner-1", businessId: "business-1",
      checkoutReservationId: "reservation-1", checkoutSessionId: "cs_business_1",
      stripeCustomerId: "cus_business_1", stripeSubscriptionId: "sub_business_1",
      status: "active", mutation, onAccepted,
    });
    await expect(transition(async () => { throw new Error("snapshot write failed"); }))
      .rejects.toThrow("snapshot write failed");
    expect(mockState.businesses[0].status).toBe("pending_billing");
    expect(mockState.owners).toHaveLength(0);
    const persisted = jest.fn(async () => {});
    await expect(transition(persisted)).resolves.toMatchObject({ updated: true });
    expect(persisted).toHaveBeenCalledTimes(1);
    expect(mockState.businesses[0].status).toBe("active");
  });

  it("rolls back a personal revocation if its adverse-status snapshot cannot persist", async () => {
    const mutation = {
      eventId: "evt_past_due", eventCreatedAt: new Date("2026-09-09T01:37:26Z"),
      eventRank: 75, source: "webhook" as const,
    };
    await expect(cancelUserSubscription(
      "cus_personal_separate", "sub_personal_separate", mutation, true,
      async () => { throw new Error("snapshot write failed"); },
    )).rejects.toThrow("snapshot write failed");
    expect(mockState.users[0].stripeSubscriptionId).toBe("sub_personal_separate");
    const result = await cancelUserSubscription(
      "cus_personal_separate", "sub_personal_separate", mutation, true,
      async () => {},
    );
    expect(result.updated).toBe(true);
    expect(mockState.users[0].stripeSubscriptionId).toBeNull();
  });

  it("revokes a bound business on an adverse subscription update without clearing personal billing", async () => {
    const activeMutation = {
      eventId: "evt_activation", eventCreatedAt: new Date("2026-09-09T01:37:26Z"),
      eventRank: 50, source: "webhook" as const,
    };
    const adverseMutation = {
      eventId: "evt_past_due", eventCreatedAt: new Date("2026-09-10T01:37:26Z"),
      eventRank: 75, source: "webhook" as const,
    };
    const input = {
      ownerUserId: "owner-1", businessId: "business-1",
      checkoutReservationId: "reservation-1", checkoutSessionId: "cs_business_1",
      stripeCustomerId: "cus_business_1", stripeSubscriptionId: "sub_business_1",
    };
    await applyBusinessSubscriptionTransition({ ...input, status: "active", mutation: activeMutation });
    await expect(applyBusinessSubscriptionTransition({
      ...input, status: "past_due", mutation: adverseMutation,
      onAccepted: async () => { throw new Error("snapshot write failed"); },
    })).rejects.toThrow("snapshot write failed");
    expect(mockState.businesses[0].status).toBe("active");
    await expect(applyBusinessSubscriptionTransition({
      ...input, status: "past_due", mutation: adverseMutation, onAccepted: async () => {},
    })).resolves.toMatchObject({ updated: true });
    expect(mockState.businesses[0].status).toBe("past_due");
    expect(mockState.users[0].stripeSubscriptionId).toBe("sub_personal_separate");
  });

  it("activates the saved business atomically, claims both identities, and preserves personal billing", async () => {
    await expect(reconcile()).resolves.toMatchObject({ status: "active", planLookupKey: "clinical_business_monthly" });
    expect(mockState.businesses[0]).toMatchObject({
      status: "active",
      commercialAccessMode: "paid",
      stripeCustomerId: "cus_business_1",
      stripeSubscriptionId: "sub_business_1",
      stripeCheckoutSessionId: "cs_business_1",
      ownerUserId: "owner-1",
    });
    expect(mockState.owners).toEqual(expect.arrayContaining([
      expect.objectContaining({ identityType: "customer", identityValue: "cus_business_1", businessId: "business-1", ownerUserId: "owner-1" }),
      expect.objectContaining({ identityType: "subscription", identityValue: "sub_business_1", businessId: "business-1", ownerUserId: "owner-1" }),
    ]));
    expect(mockState.members).toHaveLength(1);
    expect(mockState.users[0]).toMatchObject({ stripeCustomerId: "cus_personal_separate", stripeSubscriptionId: "sub_personal_separate" });
    expect(mockState.events[0]).toMatchObject({ status: "processed", source: "reconciliation" });
    const firstEntitlements = mockState.users[0].entitlements;
    await expect(reconcile()).resolves.toMatchObject({ status: "active" });
    expect(mockState.owners).toHaveLength(2);
    expect(mockState.members).toHaveLength(1);
    expect(mockState.events).toHaveLength(1);
    expect(mockState.users[0].entitlements).toEqual(firstEntitlements);
  });

  it("accepts webhook-first and return-first ordering without duplicate ownership", async () => {
    const event = { eventId: "evt_checkout_1", eventCreatedAt: new Date("2026-09-09T01:37:26Z"), eventRank: 50, source: "webhook" as const };
    await expect(applyBusinessSubscriptionTransition({
      ownerUserId: "owner-1", businessId: "business-1", checkoutReservationId: "reservation-1",
      checkoutSessionId: "cs_business_1", stripeCustomerId: "cus_business_1",
      stripeSubscriptionId: "sub_business_1", status: "active", mutation: event,
    })).resolves.toMatchObject({ updated: true });
    await reconcile();
    expect(mockState.owners).toHaveLength(2);
    expect(mockState.members).toHaveLength(1);
    resetRows();
    await reconcile();
    await expect(applyBusinessSubscriptionTransition({
      ownerUserId: "owner-1", businessId: "business-1", checkoutReservationId: "reservation-1",
      checkoutSessionId: "cs_business_1", stripeCustomerId: "cus_business_1",
      stripeSubscriptionId: "sub_business_1", status: "active", mutation: event,
    })).resolves.toMatchObject({ updated: false, reason: "STALE_EVENT" });
    expect(mockState.businesses[0].status).toBe("active");
    expect(mockState.owners).toHaveLength(2);
  });

  it.each([
    ["wrong user", (session: any) => session, "other-user"],
    ["wrong business metadata", (session: any) => { session.subscription.metadata.businessId = "business-2"; return session; }, "owner-1"],
    ["wrong business price", (session: any) => { session.subscription.items.data[0].price.id = "price_wrong"; return session; }, "owner-1"],
    ["unpaid checkout", (session: any) => { session.payment_status = "unpaid"; return session; }, "owner-1"],
    ["wrong saved session", (session: any) => { session.id = "cs_other"; return session; }, "owner-1"],
  ])("rejects %s without activating or claiming ownership", async (_name, mutate, userId) => {
    await expect(reconcile(mutate(makeSession()), userId)).rejects.toThrow();
    expect(mockState.businesses[0].status).toBe("pending_billing");
    expect(mockState.owners).toHaveLength(0);
    expect(mockState.users[0].stripeCustomerId).toBe("cus_personal_separate");
  });

  it("leaves an incomplete checkout pending without changing billing", async () => {
    const session = makeSession();
    session.status = "open";
    await expect(reconcile(session)).resolves.toMatchObject({ status: "pending" });
    expect(mockState.businesses[0].status).toBe("pending_billing");
    expect(mockState.owners).toHaveLength(0);
    expect(mockState.events).toHaveLength(0);
  });

  it("rolls back a conflicting identity owner and leaves the paid session recoverable", async () => {
    mockState.owners.push({ identityType: "customer", identityValue: "cus_business_1", ownerUserId: "other-user", businessId: "another-business" });
    await expect(reconcile()).rejects.toThrow("IDENTITY_CONFLICT");
    expect(mockState.businesses[0].status).toBe("pending_billing");
    expect(mockState.businesses[0].stripeSubscriptionId).toBeNull();
    expect(mockState.owners).toHaveLength(1);
    expect(mockState.members).toHaveLength(0);
    expect(mockState.events[0].status).toBe("failed");
  });

  it("fails closed on an exact legacy identity collision instead of changing Personal billing", async () => {
    mockState.users[0].stripeCustomerId = "cus_business_1";
    mockState.users[0].stripeSubscriptionId = "sub_business_1";
    await expect(reconcile()).rejects.toThrow("IDENTITY_CONFLICT");
    expect(mockState.users[0]).toMatchObject({
      stripeCustomerId: "cus_business_1",
      stripeSubscriptionId: "sub_business_1",
    });
    expect(mockState.businesses[0]).toMatchObject({
      status: "pending_billing", stripeCustomerId: null, stripeSubscriptionId: null,
    });
    expect(mockState.owners).toHaveLength(0);
  });

  it.each(["customer", "subscription"] as const)(
    "rejects a partial same-owner %s match without clearing independent personal billing",
    async (matchingIdentity) => {
      if (matchingIdentity === "customer") mockState.users[0].stripeCustomerId = "cus_business_1";
      else mockState.users[0].stripeSubscriptionId = "sub_business_1";
      const personalBefore = { ...mockState.users[0] };
      await expect(reconcile()).rejects.toThrow("IDENTITY_CONFLICT");
      expect(mockState.users[0]).toMatchObject({
        stripeCustomerId: personalBefore.stripeCustomerId,
        stripeSubscriptionId: personalBefore.stripeSubscriptionId,
      });
      expect(mockState.businesses[0]).toMatchObject({
        status: "pending_billing", stripeCustomerId: null, stripeSubscriptionId: null,
      });
      expect(mockState.owners).toHaveLength(0);
      expect(mockState.events[0].status).toBe("failed");
    },
  );

  it("refuses to bind a webhook checkout before its saved session is attached", async () => {
    mockState.businesses[0].stripeCheckoutSessionId = null;
    await expect(applyBusinessSubscriptionTransition({
      ownerUserId: "owner-1", businessId: "business-1", checkoutReservationId: "reservation-1",
      checkoutSessionId: "cs_business_1", stripeCustomerId: "cus_business_1",
      stripeSubscriptionId: "sub_business_1", status: "active",
      mutation: { eventId: "evt_early", eventCreatedAt: new Date("2026-09-09T01:37:26Z"), eventRank: 50, source: "webhook" },
    })).resolves.toMatchObject({ updated: false, reason: "RESERVATION_CONFLICT" });
    expect(mockState.owners).toHaveLength(0);
    expect(mockState.businesses[0].status).toBe("pending_billing");
  });

  it("refuses invoice-first activation until the checkout session is saved", async () => {
    mockState.businesses[0].stripeCheckoutSessionId = null;
    await expect(applyBusinessSubscriptionTransition({
      ownerUserId: "owner-1", businessId: "business-1", checkoutReservationId: "reservation-1",
      stripeCustomerId: "cus_business_1", stripeSubscriptionId: "sub_business_1",
      status: "active",
      mutation: { eventId: "evt_invoice", eventCreatedAt: new Date("2026-09-09T01:37:26Z"), eventRank: 60, source: "webhook" },
    })).resolves.toMatchObject({ updated: false, reason: "RESERVATION_CONFLICT" });
    expect(mockState.businesses[0].stripeSubscriptionId).toBeNull();
    expect(mockState.owners).toHaveLength(0);
  });

  it("uses verified business state rather than a later personal plan as the success condition", async () => {
    await reconcile();
    mockState.users[0].planLookupKey = "mpm_ultimate_monthly";
    await expect(reconcile()).resolves.toMatchObject({ status: "active", planLookupKey: "clinical_business_monthly" });
  });

  it("does not report success from the owner's plan if a duplicate claim lacks business activation", async () => {
    mockState.users[0].planLookupKey = "clinical_business_monthly";
    mockState.events.push({ eventId: "reconcile:cs_business_1:sub_business_1", status: "processed" });
    await expect(reconcile()).rejects.toThrow("business billing is not active");
    expect(mockState.businesses[0].status).toBe("pending_billing");
  });

  it("reconnects the same expired Organization only through its current saved reservation", async () => {
    const now = new Date();
    const periodEnd = new Date(now.getTime() - 60_000);
    const terminalAt = new Date(now.getTime() - 30_000);
    mockState.businesses[0] = {
      ...mockState.businesses[0],
      status: "cancelled",
      commercialAccessMode: "paid",
      stripeCustomerId: "cus_business_1",
      stripeSubscriptionId: "sub_business_old",
      stripeCheckoutReservationId: "reservation-reconnect",
      stripeCheckoutSessionId: "cs_business_reconnect",
      stripeLastEventCreatedAt: new Date(now.getTime() - 20_000),
      stripeLastEventRank: 50,
      stripeLastEventId: "evt_business_expired",
    };
    mockState.owners.push(
      { identityType: "customer", identityValue: "cus_business_1", ownerUserId: "owner-1", businessId: "business-1" },
      { identityType: "subscription", identityValue: "sub_business_old", ownerUserId: "owner-1", businessId: "business-1" },
    );
    mockState.snapshots.push({
      stripeSubscriptionId: "sub_business_old",
      stripeCustomerId: "cus_business_1",
      ownerUserId: "owner-1",
      serviceType: "organization",
      businessId: "business-1",
      studioId: null,
      priceId: priceId!,
      productId: "prod_business",
      trustedPlanKey: "clinical_business_monthly",
      status: "canceled",
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: true,
      terminalAt,
      sourceEventId: "evt_business_expired",
      source: "webhook",
      eventCreatedAt: new Date(now.getTime() - 20_000),
      eventRank: 50,
      verifiedAt: new Date(now.getTime() - 10_000),
    });

    await expect(applyBusinessSubscriptionTransition({
      ownerUserId: "owner-1",
      businessId: "business-1",
      checkoutReservationId: "reservation-reconnect",
      checkoutSessionId: "cs_business_reconnect",
      stripeCustomerId: "cus_business_1",
      stripeSubscriptionId: "sub_business_new",
      status: "active",
      mutation: {
        eventId: "evt_business_reconnect",
        eventCreatedAt: now,
        eventRank: 50,
        source: "webhook",
      },
    })).resolves.toMatchObject({ updated: true, businessId: "business-1" });
    expect(mockState.businesses[0]).toMatchObject({
      status: "active",
      commercialAccessMode: "paid",
      stripeCustomerId: "cus_business_1",
      stripeSubscriptionId: "sub_business_new",
      stripeCheckoutSessionId: "cs_business_reconnect",
    });
    expect(mockState.snapshots[0].stripeSubscriptionId).toBe("sub_business_old");
    expect(mockState.users[0]).toMatchObject({
      stripeCustomerId: "cus_personal_separate",
      stripeSubscriptionId: "sub_personal_separate",
      planLookupKey: "mpm_ultimate_monthly",
    });
  });

  it("rejects Organization reconnection if the old billing evidence is not expired", async () => {
    const now = new Date();
    mockState.businesses[0] = {
      ...mockState.businesses[0],
      status: "cancelled",
      commercialAccessMode: "paid",
      stripeCustomerId: "cus_business_1",
      stripeSubscriptionId: "sub_business_old",
      stripeCheckoutReservationId: "reservation-reconnect",
      stripeCheckoutSessionId: "cs_business_reconnect",
    };
    mockState.owners.push(
      { identityType: "customer", identityValue: "cus_business_1", ownerUserId: "owner-1", businessId: "business-1" },
      { identityType: "subscription", identityValue: "sub_business_old", ownerUserId: "owner-1", businessId: "business-1" },
    );
    mockState.snapshots.push({
      stripeSubscriptionId: "sub_business_old",
      stripeCustomerId: "cus_business_1",
      ownerUserId: "owner-1",
      serviceType: "organization",
      businessId: "business-1",
      studioId: null,
      priceId: priceId!,
      productId: "prod_business",
      trustedPlanKey: "clinical_business_monthly",
      status: "active",
      currentPeriodEnd: new Date(now.getTime() + 60_000),
      cancelAtPeriodEnd: false,
      terminalAt: null,
      sourceEventId: "evt_business_active",
      source: "webhook",
      eventCreatedAt: new Date(now.getTime() - 20_000),
      eventRank: 50,
      verifiedAt: new Date(now.getTime() - 10_000),
    });

    await expect(applyBusinessSubscriptionTransition({
      ownerUserId: "owner-1",
      businessId: "business-1",
      checkoutReservationId: "reservation-reconnect",
      checkoutSessionId: "cs_business_reconnect",
      stripeCustomerId: "cus_business_1",
      stripeSubscriptionId: "sub_business_new",
      status: "active",
      mutation: {
        eventId: "evt_business_reconnect",
        eventCreatedAt: now,
        eventRank: 50,
        source: "webhook",
      },
    })).resolves.toMatchObject({ updated: false, reason: "IDENTITY_CONFLICT" });
    expect(mockState.businesses[0].stripeSubscriptionId).toBe("sub_business_old");
    expect(mockState.users[0].stripeSubscriptionId).toBe("sub_personal_separate");
  });

  it("does not clear or overwrite a conflicting Personal Stripe identity for Organization billing", async () => {
    mockState.users[0].stripeCustomerId = "cus_business_1";
    mockState.users[0].stripeSubscriptionId = "sub_business_1";

    await expect(reconcile()).rejects.toThrow("IDENTITY_CONFLICT");
    expect(mockState.users[0]).toMatchObject({
      stripeCustomerId: "cus_business_1",
      stripeSubscriptionId: "sub_business_1",
      planLookupKey: "mpm_ultimate_monthly",
    });
    expect(mockState.businesses[0].stripeSubscriptionId).toBeNull();
  });
});