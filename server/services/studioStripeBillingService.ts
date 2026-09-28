import type Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { studios, studioBilling } from "../db/schema/studio";
import { stripeIdentityOwners } from "../db/schema/stripeBilling";
import { serviceBillingSnapshots } from "../db/schema/serviceBillingSnapshots";
import { claimStripeIdentityOwnership } from "./stripeIdentityOwnershipService";
import {
  persistVerifiedServiceSnapshot,
  verifySubscriptionBillingFacts,
} from "./verifiedServiceBillingWriter";
import { resolveTrustedStudioSubscription } from "./studioStripePlanCatalog";
import { resolveServiceBillingStatus } from "./serviceBillingStatus";

export type StudioStripeMutation = {
  eventId: string;
  eventCreatedAt: Date;
  eventRank: number;
  source: "webhook" | "reconciliation";
};

export class StudioStripeBillingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioStripeBillingConflictError";
  }
}

export type StudioStripeTransitionResult = {
  updated: boolean;
  reason?: "STALE_EVENT";
  planLookupKey: string;
  status: string;
  currentPeriodEnd: Date;
};

function objectId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

/**
 * Persist a Studio subscription without touching Personal users billing fields.
 * Every new Studio subscription is bound to the pre-existing Studio row and
 * its exact checkout reservation; renewal webhooks must match that binding.
 */
export async function applyStudioStripeSubscription(input: {
  stripe: Pick<Stripe, "prices">;
  subscription: Stripe.Subscription;
  customerId: string;
  ownerUserId: string;
  studioId: string;
  reservationId: string;
  checkoutSessionId?: string;
  paymentFailed?: boolean;
  mutation: StudioStripeMutation;
}): Promise<StudioStripeTransitionResult> {
  if (process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED !== "true") {
    throw new StudioStripeBillingConflictError("Verified Studio billing is not enabled.");
  }
  const subscription = input.subscription;
  const metadata = subscription.metadata ?? {};
  if (
    metadata.serviceType !== "studio" ||
    metadata.subscriptionType !== "studio" ||
    metadata.userId !== input.ownerUserId ||
    metadata.studioId !== input.studioId ||
    metadata.checkoutReservationId !== input.reservationId ||
    objectId(subscription.customer as any) !== input.customerId
  ) {
    throw new StudioStripeBillingConflictError("Studio subscription owner or reservation metadata does not match.");
  }

  const periodEnd = subscription.items.data[0]?.current_period_end;
  if (!Number.isSafeInteger(periodEnd) || !periodEnd || periodEnd <= 0) {
    throw new StudioStripeBillingConflictError("Studio subscription has no verified billing period.");
  }
  if (!["active", "canceled", "past_due", "unpaid", "paused", "incomplete", "incomplete_expired", "trialing"]
    .includes(subscription.status)) {
    throw new StudioStripeBillingConflictError("Studio subscription has an unsupported status.");
  }

  const [studioContext] = await db.select({
    id: studios.id,
    ownerUserId: studios.ownerUserId,
    type: studios.type,
  }).from(studios).where(eq(studios.id, input.studioId)).limit(1);
  if (!studioContext || studioContext.ownerUserId !== input.ownerUserId) {
    throw new StudioStripeBillingConflictError("The Studio does not belong to the authenticated account.");
  }
  const trustedPlan = resolveTrustedStudioSubscription(subscription, studioContext.type);
  if (!trustedPlan || metadata.sku !== trustedPlan.planLookupKey) {
    throw new StudioStripeBillingConflictError("Studio subscription price is not a trusted professional plan.");
  }
  const facts = await verifySubscriptionBillingFacts({
    stripe: input.stripe,
    subscription,
    customerId: input.customerId,
    ownerUserId: input.ownerUserId,
    expectedPlanKey: trustedPlan.planLookupKey,
    paymentFailed: input.paymentFailed,
    mutation: {
      sourceEventId: input.mutation.eventId,
      eventCreatedAt: input.mutation.eventCreatedAt,
      eventRank: input.mutation.eventRank,
      source: input.mutation.source,
    },
  });
  if (facts.serviceType !== "professional") {
    throw new StudioStripeBillingConflictError("Studio checkout resolved to a non-professional service.");
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM studios WHERE id = ${input.studioId} FOR UPDATE`);
    const [studio] = await tx.select({
      id: studios.id,
      ownerUserId: studios.ownerUserId,
      type: studios.type,
    }).from(studios).where(eq(studios.id, input.studioId)).limit(1);
    if (!studio || studio.ownerUserId !== input.ownerUserId) {
      throw new StudioStripeBillingConflictError("The Studio does not belong to the authenticated account.");
    }
    const [billing] = await tx.select().from(studioBilling)
      .where(eq(studioBilling.studioId, input.studioId)).limit(1);
    if (!billing || billing.stripeCustomerId !== input.customerId) {
      throw new StudioStripeBillingConflictError("Studio billing customer does not match the subscription.");
    }
    if (
      billing.stripeCheckoutReservationId !== input.reservationId ||
      (input.checkoutSessionId && billing.stripeCheckoutSessionId !== input.checkoutSessionId)
    ) {
      throw new StudioStripeBillingConflictError("Studio checkout does not match its saved reservation.");
    }

    if (studio.type !== studioContext.type) {
      throw new StudioStripeBillingConflictError("Studio type changed while its subscription was being verified.");
    }
    if (billing.planCode !== trustedPlan.planLookupKey) {
      throw new StudioStripeBillingConflictError("Studio plan does not match its trusted checkout price.");
    }

    const ownership = await tx.select({
      identityType: stripeIdentityOwners.identityType,
      identityValue: stripeIdentityOwners.identityValue,
      ownerUserId: stripeIdentityOwners.ownerUserId,
      businessId: stripeIdentityOwners.businessId,
    }).from(stripeIdentityOwners).where(and(
      eq(stripeIdentityOwners.ownerUserId, input.ownerUserId),
      eq(stripeIdentityOwners.identityValue, input.customerId),
    ));
    const customerClaim = ownership.find((row: any) => row.identityType === "customer");
    if (!customerClaim || customerClaim.businessId !== null) {
      throw new StudioStripeBillingConflictError("Studio Stripe customer ownership is not verified.");
    }

    if (billing.stripeSubscriptionId && billing.stripeSubscriptionId !== subscription.id) {
      const [previous] = await tx.select().from(serviceBillingSnapshots)
        .where(eq(serviceBillingSnapshots.stripeSubscriptionId, billing.stripeSubscriptionId)).limit(1);
      const [priorClaim] = await tx.select({
        ownerUserId: stripeIdentityOwners.ownerUserId,
        businessId: stripeIdentityOwners.businessId,
      }).from(stripeIdentityOwners).where(and(
        eq(stripeIdentityOwners.identityType, "subscription"),
        eq(stripeIdentityOwners.identityValue, billing.stripeSubscriptionId),
      )).limit(1);
      if (!previous || !priorClaim || priorClaim.ownerUserId !== input.ownerUserId ||
          priorClaim.businessId !== null ||
          resolveServiceBillingStatus({
            serviceType: "professional",
            ownerUserId: input.ownerUserId,
            stripeCustomerId: input.customerId,
            stripeSubscriptionId: billing.stripeSubscriptionId,
            studioId: input.studioId,
            trustedPlanKey: billing.planCode,
          }, previous).state !== "expired") {
        throw new StudioStripeBillingConflictError("Previous Studio subscription has not been verified as expired.");
      }
    }

    await claimStripeIdentityOwnership(tx, {
      ownerUserId: input.ownerUserId,
      stripeCustomerId: input.customerId,
      stripeSubscriptionId: subscription.id,
    });

    const [existingSnapshot] = await tx.select().from(serviceBillingSnapshots)
      .where(eq(serviceBillingSnapshots.stripeSubscriptionId, subscription.id)).limit(1);
    if (existingSnapshot && (
      existingSnapshot.ownerUserId !== input.ownerUserId ||
      existingSnapshot.serviceType !== "professional" ||
      existingSnapshot.stripeCustomerId !== input.customerId ||
      existingSnapshot.businessId !== null ||
      existingSnapshot.studioId !== input.studioId
    )) {
      throw new StudioStripeBillingConflictError("Studio subscription has an ambiguous legacy billing binding.");
    }
    if (existingSnapshot) {
      const oldTime = existingSnapshot.eventCreatedAt.getTime();
      const nextTime = input.mutation.eventCreatedAt.getTime();
      const newer = nextTime > oldTime ||
        (nextTime === oldTime && input.mutation.eventRank > existingSnapshot.eventRank);
      const duplicate = nextTime === oldTime &&
        input.mutation.eventRank === existingSnapshot.eventRank &&
        input.mutation.eventId === existingSnapshot.sourceEventId;
      if (!newer && !duplicate) {
        return {
          updated: false,
          reason: "STALE_EVENT",
          planLookupKey: trustedPlan.planLookupKey,
          status: subscription.status,
          currentPeriodEnd: new Date(periodEnd * 1000),
        };
      }
    }

    await persistVerifiedServiceSnapshot(tx, {
      ...facts,
      businessId: null,
      studioId: input.studioId,
    });

    const [updated] = await tx.update(studioBilling).set({
      stripeCustomerId: input.customerId,
      stripeSubscriptionId: subscription.id,
      planCode: trustedPlan.planLookupKey,
      status: subscription.status,
      currentPeriodEnd: new Date(periodEnd * 1000),
      updatedAt: new Date(),
    }).where(and(
      eq(studioBilling.studioId, input.studioId),
      eq(studioBilling.stripeCustomerId, input.customerId),
    )).returning({ studioId: studioBilling.studioId });
    if (!updated) {
      throw new StudioStripeBillingConflictError("Studio billing changed before the verified subscription could be saved.");
    }
    return {
      updated: true,
      planLookupKey: trustedPlan.planLookupKey,
      status: subscription.status,
      currentPeriodEnd: new Date(periodEnd * 1000),
    };
  });
}