import { and, eq, or, sql } from "drizzle-orm";
import { db } from "../db";
import { businesses, businessMembers } from "../db/schema/business";
import { users } from "@shared/schema";
import { getEntitlementsForPlan } from "../entitlements";
import type { SubscriptionMutationContext } from "./subscriptionService";
import {
  claimStripeIdentityOwnership,
  StripeIdentityOwnershipConflictError,
} from "./stripeIdentityOwnershipService";

type BusinessBillingStatus = "active" | "cancelled" | "past_due";

export type BusinessSubscriptionTransitionResult =
  | {
      updated: true;
      reason?: undefined;
      businessId: string;
      businessName: string;
      ownerUserId: string;
    }
  | {
      updated: false;
      reason:
        | "BUSINESS_NOT_FOUND"
        | "IDENTITY_CONFLICT"
        | "RESERVATION_CONFLICT"
        | "STALE_EVENT"
        | "USER_NOT_FOUND";
    };

function eventIsNewer(
  business: typeof businesses.$inferSelect,
  mutation: SubscriptionMutationContext,
): boolean {
  const previousCreatedAt = business.stripeLastEventCreatedAt;
  if (!previousCreatedAt) return true;

  const currentTime = mutation.eventCreatedAt.getTime();
  const previousTime = previousCreatedAt.getTime();
  if (currentTime > previousTime) return true;
  if (currentTime < previousTime) return false;
  if (mutation.eventRank > business.stripeLastEventRank) return true;
  return (
    mutation.eventRank === business.stripeLastEventRank
    && mutation.eventId === business.stripeLastEventId
  );
}

export async function applyBusinessSubscriptionTransition(input: {
  ownerUserId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: BusinessBillingStatus;
  mutation: SubscriptionMutationContext;
  seatLimit?: number | null;
  businessId?: string | null;
  checkoutReservationId?: string | null;
  checkoutSessionId?: string | null;
}): Promise<BusinessSubscriptionTransitionResult> {
  try {
    return await db.transaction(async (tx) => {
    let businessId = input.businessId ?? null;
    if (!businessId) {
      const [identityMatch] = await tx
        .select({ id: businesses.id })
        .from(businesses)
        .where(and(
          eq(businesses.stripeCustomerId, input.stripeCustomerId),
          eq(businesses.stripeSubscriptionId, input.stripeSubscriptionId),
        ))
        .limit(1);
      businessId = identityMatch?.id ?? null;
    }
    if (!businessId) return { updated: false, reason: "BUSINESS_NOT_FOUND" };

    await tx.execute(sql`SELECT id FROM businesses WHERE id = ${businessId} FOR UPDATE`);
    const [business] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!business || business.ownerUserId !== input.ownerUserId) {
      return { updated: false, reason: "BUSINESS_NOT_FOUND" };
    }

    const alreadyBound = Boolean(
      business.stripeCustomerId || business.stripeSubscriptionId,
    );
    if (alreadyBound) {
      if (
        business.stripeCustomerId !== input.stripeCustomerId
        || business.stripeSubscriptionId !== input.stripeSubscriptionId
      ) {
        return { updated: false, reason: "IDENTITY_CONFLICT" };
      }
    } else if (
      business.status !== "pending_billing"
      || !input.checkoutReservationId
      || business.stripeCheckoutReservationId !== input.checkoutReservationId
    ) {
      return { updated: false, reason: "RESERVATION_CONFLICT" };
    }

    const userIdentityClaims = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`
        ${users.stripeCustomerId} = ${input.stripeCustomerId}
        OR ${users.stripeSubscriptionId} = ${input.stripeSubscriptionId}
      `)
      .limit(2);
    if (userIdentityClaims.some((claim) => claim.id !== input.ownerUserId)) {
      return { updated: false, reason: "IDENTITY_CONFLICT" };
    }

    if (
      input.checkoutSessionId
      && business.stripeCheckoutSessionId
      && business.stripeCheckoutSessionId !== input.checkoutSessionId
    ) {
      return { updated: false, reason: "RESERVATION_CONFLICT" };
    }

    await claimStripeIdentityOwnership(tx, {
      ownerUserId: input.ownerUserId,
      businessId: business.id,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    });

    if (!eventIsNewer(business, input.mutation)) {
      return { updated: false, reason: "STALE_EVENT" };
    }

    const [owner] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.ownerUserId))
      .limit(1);
    if (!owner) return { updated: false, reason: "USER_NOT_FOUND" };

    // A legacy same-owner duplicate is repaired only after this verified
    // business transition has passed reservation, identity, and ordering
    // checks. Never repair customer records directly or from client claims.
    await tx
      .update(users)
      .set({
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      })
      .where(and(
        eq(users.id, input.ownerUserId),
        or(
          eq(users.stripeCustomerId, input.stripeCustomerId),
          eq(users.stripeSubscriptionId, input.stripeSubscriptionId),
        ),
      ));

    if (input.status === "active") {
      const entitlements = getEntitlementsForPlan("clinical_business_monthly");
      await tx
        .update(users)
        .set({
          planLookupKey: "clinical_business_monthly",
          subscriptionPlan: "ultimate",
          entitlements,
          subscriptionStatus: "active",
        })
        .where(eq(users.id, input.ownerUserId));
    } else {
      await tx
        .update(users)
        .set({
          planLookupKey: users.personalPlanLookupKey,
          subscriptionPlan: sql`
            CASE
              WHEN ${users.personalPlanLookupKey} IS NULL THEN 'basic'
              WHEN ${users.personalPlanLookupKey} LIKE '%ultimate%' THEN 'ultimate'
              WHEN ${users.personalPlanLookupKey} LIKE '%premium%'
                OR ${users.personalPlanLookupKey} LIKE '%upgrade%'
                OR ${users.personalPlanLookupKey} = 'mpm_guidance' THEN 'premium'
              ELSE 'basic'
            END
          `,
          entitlements: users.personalEntitlements,
          subscriptionStatus: users.personalSubscriptionStatus,
        })
        .where(eq(users.id, input.ownerUserId));
    }

    await tx
      .update(businesses)
      .set({
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        ...(input.checkoutSessionId
          ? { stripeCheckoutSessionId: input.checkoutSessionId }
          : {}),
        status: input.status,
        ...(input.seatLimit != null && input.seatLimit > 0
          ? { seatLimit: input.seatLimit }
          : {}),
        stripeLastEventCreatedAt: input.mutation.eventCreatedAt,
        stripeLastEventRank: input.mutation.eventRank,
        stripeLastEventId: input.mutation.eventId,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, business.id));

    await tx
      .insert(businessMembers)
      .values({
        businessId: business.id,
        userId: input.ownerUserId,
        role: "owner",
        status: "active",
      })
      .onConflictDoNothing();

    return {
      updated: true,
      businessId: business.id,
      businessName: business.name,
      ownerUserId: input.ownerUserId,
    };
    });
  } catch (error) {
    if (error instanceof StripeIdentityOwnershipConflictError) {
      return { updated: false, reason: "IDENTITY_CONFLICT" };
    }
    throw error;
  }
}