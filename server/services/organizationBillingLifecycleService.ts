import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { businesses } from "../db/schema/business";
import { serviceBillingSnapshots } from "../db/schema/serviceBillingSnapshots";
import { stripeIdentityOwners } from "../db/schema/stripeBilling";
import { resolveServiceBillingStatus } from "./serviceBillingStatus";
import {
  persistVerifiedServiceSnapshot,
  verifySubscriptionBillingFacts,
} from "./verifiedServiceBillingWriter";

export type OrganizationRenewalAction = "end" | "keep";

export class OrganizationBillingReviewError extends Error {
  constructor(message = "Organization billing needs review. No renewal change was made.") {
    super(message);
    this.name = "OrganizationBillingReviewError";
  }
}

function requireVerified(condition: unknown): asserts condition {
  if (!condition) throw new OrganizationBillingReviewError();
}

type OrganizationBillingIdentity = {
  ownerUserId: string;
  businessId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
};

async function assertStripeIdentityOwnership(
  executor: any,
  identity: OrganizationBillingIdentity,
) {
  const [customerBinding] = await executor.select().from(stripeIdentityOwners).where(and(
    eq(stripeIdentityOwners.identityType, "customer"),
    eq(stripeIdentityOwners.identityValue, identity.stripeCustomerId),
  )).limit(1);
  const [subscriptionBinding] = await executor.select().from(stripeIdentityOwners).where(and(
    eq(stripeIdentityOwners.identityType, "subscription"),
    eq(stripeIdentityOwners.identityValue, identity.stripeSubscriptionId),
  )).limit(1);
  requireVerified([customerBinding, subscriptionBinding].every((binding) =>
    binding?.ownerUserId === identity.ownerUserId &&
    binding.businessId === identity.businessId));
}

/**
 * Reconnect is allowed only for an owner-held paid Organization whose latest
 * verified Stripe snapshot has expired. The old identity remains bound until
 * the new checkout is verified and applied by the Stripe reconciliation path.
 */
export async function getExpiredOrganizationForReconnect(
  ownerUserId: string,
  businessId: string,
): Promise<OrganizationBillingIdentity> {
  if (process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED !== "true") {
    throw new OrganizationBillingReviewError();
  }
  const [business] = await db.select().from(businesses).where(and(
    eq(businesses.id, businessId),
    eq(businesses.ownerUserId, ownerUserId),
  )).limit(1);
  requireVerified(business &&
    business.status === "cancelled" &&
    business.commercialAccessMode === "paid" &&
    business.stripeCustomerId &&
    business.stripeSubscriptionId);

  const identity: OrganizationBillingIdentity = {
    ownerUserId,
    businessId,
    stripeCustomerId: business.stripeCustomerId!,
    stripeSubscriptionId: business.stripeSubscriptionId!,
  };
  const [snapshot] = await db.select().from(serviceBillingSnapshots)
    .where(eq(serviceBillingSnapshots.stripeSubscriptionId, identity.stripeSubscriptionId))
    .limit(1);
  requireVerified(resolveServiceBillingStatus({
    serviceType: "organization",
    ...identity,
    trustedPlanKey: "clinical_business_monthly",
  }, snapshot ?? null).state === "expired");
  await assertStripeIdentityOwnership(db, identity);
  return identity;
}

/** Never accepts Stripe IDs, plan keys, or owner identity from the browser. */
export async function changeOrganizationRenewal(input: {
  ownerUserId: string;
  businessId: string;
  action: OrganizationRenewalAction;
  stripe: Pick<Stripe, "subscriptions" | "prices">;
}): Promise<{ state: "active" | "ending"; paidThrough: string }> {
  if (process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED !== "true") {
    throw new OrganizationBillingReviewError();
  }
  const desired = input.action === "end";

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id FROM businesses
      WHERE id = ${input.businessId} AND owner_user_id = ${input.ownerUserId}
      FOR UPDATE
    `);
    const [business] = await tx.select().from(businesses).where(and(
      eq(businesses.id, input.businessId),
      eq(businesses.ownerUserId, input.ownerUserId),
    )).limit(1);
    requireVerified(business &&
      business.status === "active" &&
      business.commercialAccessMode === "paid" &&
      business.stripeCustomerId &&
      business.stripeSubscriptionId);

    const customerId = business.stripeCustomerId!;
    const subscriptionId = business.stripeSubscriptionId!;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${subscriptionId}))`);
    const [snapshot] = await tx.select().from(serviceBillingSnapshots)
      .where(eq(serviceBillingSnapshots.stripeSubscriptionId, subscriptionId)).limit(1);
    requireVerified(snapshot);
    const identity = {
      serviceType: "organization" as const,
      ownerUserId: input.ownerUserId,
      businessId: input.businessId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      trustedPlanKey: "clinical_business_monthly",
    };
    const prior = resolveServiceBillingStatus(identity, snapshot);
    requireVerified(prior.state === "active" || prior.state === "ending");
    requireVerified(snapshot.source === "webhook" ||
      snapshot.source === "reconciliation" ||
      snapshot.source === "backfill");
    requireVerified(snapshot.eventCreatedAt <= new Date() &&
      snapshot.eventRank >= 0);
    await assertStripeIdentityOwnership(tx, {
      ownerUserId: input.ownerUserId,
      businessId: input.businessId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    });

    const current = await input.stripe.subscriptions.retrieve(subscriptionId);
    requireVerified(current.id === subscriptionId &&
      current.status === "active");
    const mutation = {
      source: "reconciliation" as const,
      sourceEventId: `organization-renewal:${randomUUID()}`,
      eventCreatedAt: new Date(Math.max(Date.now(), snapshot.eventCreatedAt.getTime() + 1)),
      eventRank: 90,
    };
    const verify = (subscription: Stripe.Subscription) =>
      verifySubscriptionBillingFacts({
        stripe: input.stripe,
        subscription,
        customerId,
        ownerUserId: input.ownerUserId,
        expectedPlanKey: "clinical_business_monthly",
        mutation,
      });

    let before;
    try {
      before = await verify(current);
    } catch {
      throw new OrganizationBillingReviewError();
    }
    requireVerified(before.serviceType === "organization" &&
      before.stripeSubscriptionId === subscriptionId &&
      before.stripeCustomerId === customerId &&
      before.priceId === snapshot.priceId &&
      before.productId === snapshot.productId &&
      before.currentPeriodEnd.getTime() === snapshot.currentPeriodEnd.getTime() &&
      before.status === "active" &&
      !before.terminalAt &&
      (before.cancelAtPeriodEnd === snapshot.cancelAtPeriodEnd ||
        before.cancelAtPeriodEnd === desired));

    if (before.cancelAtPeriodEnd !== desired) {
      await input.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: desired,
      }, {
        idempotencyKey: `mpm-organization-renewal:${input.businessId}:${subscriptionId}:${input.action}:${snapshot.sourceEventId}`,
      });
    }

    // Re-retrieve Stripe's state and persist only verified facts. A retry after
    // a provider update but failed local write does not issue another mutation.
    const after = await input.stripe.subscriptions.retrieve(subscriptionId);
    let facts;
    try {
      facts = await verify(after);
    } catch {
      throw new OrganizationBillingReviewError();
    }
    requireVerified(facts.stripeSubscriptionId === subscriptionId &&
      facts.stripeCustomerId === customerId &&
      facts.serviceType === "organization" &&
      facts.status === "active" &&
      facts.cancelAtPeriodEnd === desired &&
      facts.priceId === snapshot.priceId &&
      facts.productId === snapshot.productId &&
      facts.currentPeriodEnd.getTime() === snapshot.currentPeriodEnd.getTime() &&
      mutation.eventCreatedAt > snapshot.eventCreatedAt);
    await persistVerifiedServiceSnapshot(tx, {
      ...facts,
      businessId: input.businessId,
      studioId: null,
    });

    const [saved] = await tx.select().from(serviceBillingSnapshots)
      .where(eq(serviceBillingSnapshots.stripeSubscriptionId, subscriptionId)).limit(1);
    const resolved = resolveServiceBillingStatus(identity, saved ?? null);
    requireVerified(resolved.state === (desired ? "ending" : "active") &&
      !!resolved.paidThrough);
    return { state: resolved.state, paidThrough: resolved.paidThrough };
  });
}