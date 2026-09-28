import { readFileSync } from "node:fs";
import {
  resolveHistoricalProfessionalBilling,
  resolveServiceBillingStatus,
  type BillingIdentity,
} from "../services/serviceBillingStatus";
import { resolveOwnedOrganizationEntry } from "../services/organizationAccessStatus";
import type { ServiceBillingSnapshot } from "../db/schema/serviceBillingSnapshots";

const now = new Date("2026-10-15T12:00:00.000Z");
const end = new Date("2026-10-31T23:59:00.000Z");
const identity: BillingIdentity = {
  serviceType: "professional",
  ownerUserId: "person-1",
  stripeCustomerId: "cus_test_one",
  stripeSubscriptionId: "sub_test_one",
  studioId: "11111111-1111-4111-8111-111111111111",
  trustedPlanKey: "mpm_trainer_5",
};
const snapshot: ServiceBillingSnapshot = {
  serviceType: "professional",
  ownerUserId: "person-1",
  stripeCustomerId: "cus_test_one",
  stripeSubscriptionId: "sub_test_one",
  businessId: null,
  studioId: identity.studioId!,
  priceId: "price_test_one",
  productId: "prod_test_one",
  trustedPlanKey: "mpm_trainer_5",
  status: "active",
  currentPeriodEnd: end,
  cancelAtPeriodEnd: false,
  terminalAt: null,
  sourceEventId: "evt_test_one",
  source: "webhook",
  eventCreatedAt: new Date("2026-10-15T11:00:00.000Z"),
  eventRank: 75,
  verifiedAt: new Date("2026-10-15T11:00:00.000Z"),
};
const trustedPrice = (priceId: string) =>
  priceId === "price_test_one" ? { planLookupKey: "mpm_trainer_5" } : null;
const resolve = (
  record: ServiceBillingSnapshot | null = snapshot,
  binding: BillingIdentity = identity,
) => resolveServiceBillingStatus(binding, record, now, trustedPrice);

describe("verified service billing status", () => {
  it("resolves an active professional subscription without changing account data", () => {
    const person = { id: identity.ownerUserId, personalPlanLookupKey: "mpm_trainer_5" };
    expect(resolve()).toEqual({ state: "active", paidThrough: end.toISOString() });
    expect(person).toEqual({ id: "person-1", personalPlanLookupKey: "mpm_trainer_5" });
  });

  it("reports ending only at the verified Stripe period end", () => {
    expect(resolve({ ...snapshot, cancelAtPeriodEnd: true }))
      .toEqual({ state: "ending", paidThrough: "2026-10-31T23:59:00.000Z" });
    expect(snapshot.status).toBe("active");
    expect(snapshot.cancelAtPeriodEnd).toBe(false);
  });

  it("reports an ended subscription as expired, not an inferred 30-day grace period", () => {
    expect(resolve({ ...snapshot, status: "canceled", terminalAt: new Date("2026-10-14") }))
      .toEqual({ state: "expired", paidThrough: null });
    expect(resolve({ ...snapshot, status: "canceled" }).state).toBe("needs_review");
    expect(resolve({ ...snapshot, currentPeriodEnd: new Date("2026-10-14") }))
      .toEqual({ state: "needs_review", paidThrough: null });
  });

  it("fails closed when a snapshot is absent, untrusted, ambiguous, or stale", () => {
    const review = { state: "needs_review", paidThrough: null };
    expect(resolve(null)).toEqual(review);
    expect(resolve({ ...snapshot, priceId: "other_price" })).toEqual(review);
    expect(resolve({ ...snapshot, productId: "" })).toEqual(review);
    expect(resolve({ ...snapshot, sourceEventId: "" })).toEqual(review);
    expect(resolve({ ...snapshot, trustedPlanKey: "mpm_ultimate" })).toEqual(review);
    expect(resolve({ ...snapshot, status: "past_due" })).toEqual(review);
    expect(resolve({ ...snapshot, status: "trialing" })).toEqual(review);
    expect(resolve({ ...snapshot, verifiedAt: new Date("2026-10-16") })).toEqual(review);
    expect(resolve(snapshot, { ...identity, stripeSubscriptionId: "sub_other" })).toEqual(review);
    expect(resolve({ ...snapshot, ownerUserId: "other" })).toEqual(review);
    expect(resolve({ ...snapshot, studioId: "22222222-2222-4222-8222-222222222222" })).toEqual(review);
  });

  it("keeps organization subscription identity separate from personal billing", () => {
    const org: BillingIdentity = {
      serviceType: "organization", ownerUserId: "person-1",
      businessId: "33333333-3333-4333-8333-333333333333",
      stripeCustomerId: "cus_test_org", stripeSubscriptionId: "sub_test_org",
    };
    const orgSnapshot = { ...snapshot, serviceType: "organization" as const,
      businessId: org.businessId!, studioId: null, stripeCustomerId: org.stripeCustomerId!,
      stripeSubscriptionId: org.stripeSubscriptionId!, trustedPlanKey: "clinical_business_monthly" };
    const orgPrice = () => ({ planLookupKey: "clinical_business_monthly" });
    expect(resolveServiceBillingStatus(org, orgSnapshot, now, orgPrice).state).toBe("active");
    expect(resolve(orgSnapshot)).toEqual({ state: "needs_review", paidThrough: null });
    expect(resolveServiceBillingStatus({ ...org, businessId: "other" }, orgSnapshot, now, orgPrice).state)
      .toBe("needs_review");
  });

  it("retains an expired Studio billing identity after the current user subscription ID is cleared", () => {
    const user = { id: "person-1", stripeSubscriptionId: null };
    const ended = { ...snapshot, status: "canceled", terminalAt: new Date("2026-10-14") };
    const ownership = [
      { identityType: "customer", identityValue: "cus_test_one" },
      { identityType: "subscription", identityValue: "sub_test_one" },
    ];
    expect(user.stripeSubscriptionId).toBeNull();
    expect(resolveHistoricalProfessionalBilling(ended, user.id, identity.studioId!, ownership, now, trustedPrice))
      .toEqual({ state: "expired", paidThrough: null });
    expect(resolveHistoricalProfessionalBilling(ended, user.id, "wrong-studio", ownership).state).toBe("needs_review");
    expect(resolveHistoricalProfessionalBilling(ended, "wrong-owner", identity.studioId!, ownership).state).toBe("needs_review");
    expect(resolveHistoricalProfessionalBilling(ended, user.id, identity.studioId!, ownership.slice(0, 1)).state)
      .toBe("needs_review");
  });

  it("defines one unique snapshot per subscription without creating a second billing identity", () => {
    const migration = readFileSync("server/db/migrations/manual/service-billing-snapshots.sql", "utf8");
    expect(migration).toMatch(/stripe_subscription_id text PRIMARY KEY/);
    expect(migration).not.toMatch(/CREATE SUBSCRIPTION|CREATE CUSTOMER/);
  });
});

describe("organization access is distinct from billing", () => {
  const business = {
    id: "33333333-3333-4333-8333-333333333333", name: "Organization",
    ownerUserId: "person-1", organizationId: null,
    status: "active" as const, commercialAccessMode: "paid" as const,
    commercialAccessStartedAt: null,
    commercialAccessEndsAt: null,
    stripeCustomerId: "cus_test_org", stripeSubscriptionId: "sub_test_org",
  };

  it("keeps the workspace attached while renewal is scheduled to end", () => {
    expect(resolveOwnedOrganizationEntry(business, { state: "ending", paidThrough: end.toISOString() }))
      .toEqual({ name: "Organization", state: "ending", accessSource: "paid", paidThrough: end.toISOString() });
    expect(business.status).toBe("active");
  });

  it("does not call a pilot or arrangement a paid subscription", () => {
    expect(resolveOwnedOrganizationEntry({
      ...business, commercialAccessMode: "onboarding_pilot",
      commercialAccessStartedAt: new Date("2026-10-01"),
      commercialAccessEndsAt: end, stripeSubscriptionId: null,
    }, null, now).accessSource).toBe("pilot");
    expect(resolveOwnedOrganizationEntry({
      ...business, commercialAccessMode: "authorized_arrangement", stripeSubscriptionId: null,
    }, null).state).toBe("managed_access");
    expect(resolveOwnedOrganizationEntry({
      ...business, commercialAccessMode: "onboarding_pilot",
      commercialAccessStartedAt: new Date("2026-10-01"),
      commercialAccessEndsAt: new Date("2026-10-01"), stripeSubscriptionId: null,
    }, null, now).state).toBe("not_active");
    expect(resolveOwnedOrganizationEntry({
      ...business, commercialAccessMode: "onboarding_pilot",
      commercialAccessStartedAt: new Date("2026-10-20"),
      commercialAccessEndsAt: end, stripeSubscriptionId: null,
    }, null, now).state).toBe("not_active");
  });

  it("requires review for absent or conflicting paid billing evidence", () => {
    expect(resolveOwnedOrganizationEntry(business, null).state).toBe("needs_review");
    expect(resolveOwnedOrganizationEntry({
      ...business, status: "cancelled",
    }, { state: "active", paidThrough: end.toISOString() }).state).toBe("needs_review");
    expect(resolveOwnedOrganizationEntry(business, { state: "expired", paidThrough: null }).state)
      .toBe("needs_review");
    expect(resolveOwnedOrganizationEntry({ ...business, status: "cancelled" }, {
      state: "expired", paidThrough: null,
    }).state).toBe("expired");
  });
});