import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import type { AcceptedSubscriptionHook } from "./subscriptionService";
import { businesses, businessMembers } from "../db/schema/business";
import { users } from "@shared/schema";
import { serviceBillingSnapshots } from "../db/schema/serviceBillingSnapshots";
import { stripeIdentityOwners } from "../db/schema/stripeBilling";
import { resolveServiceBillingStatus } from "./serviceBillingStatus";
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
  onAccepted?: AcceptedSubscriptionHook;
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
    let reconnectingExpiredBusiness = false;
    if (alreadyBound) {
      if (
        business.stripeCustomerId !== input.stripeCustomerId
        || business.stripeSubscriptionId !== input.stripeSubscriptionId
      ) {
        if (business.status !== "cancelled" ||
            business.commercialAccessMode !== "paid" ||
            !business.stripeCustomerId ||
            !business.stripeSubscriptionId ||
            !input.checkoutSessionId ||
            !input.checkoutReservationId ||
            business.stripeCheckoutSessionId !== input.checkoutSessionId ||
            business.stripeCheckoutReservationId !== input.checkoutReservationId) {
          return { updated: false, reason: "IDENTITY_CONFLICT" };
        }
        const previousCustomerId = business.stripeCustomerId;
        const previousSubscriptionId = business.stripeSubscriptionId;
        const [previousSnapshot] = await tx.select().from(serviceBillingSnapshots)
          .where(eq(serviceBillingSnapshots.stripeSubscriptionId, previousSubscriptionId))
          .limit(1);
        const previousStatus = resolveServiceBillingStatus({
          serviceType: "organization",
          ownerUserId: input.ownerUserId,
          businessId: business.id,
          stripeCustomerId: previousCustomerId,
          stripeSubscriptionId: previousSubscriptionId,
          trustedPlanKey: "clinical_business_monthly",
        }, previousSnapshot ?? null);
        const [previousCustomerBinding] = await tx.select().from(stripeIdentityOwners).where(and(
          eq(stripeIdentityOwners.identityType, "customer"),
          eq(stripeIdentityOwners.identityValue, previousCustomerId),
        )).limit(1);
        const [previousSubscriptionBinding] = await tx.select().from(stripeIdentityOwners).where(and(
          eq(stripeIdentityOwners.identityType, "subscription"),
          eq(stripeIdentityOwners.identityValue, previousSubscriptionId),
        )).limit(1);
        if (previousStatus.state !== "expired" ||
            previousCustomerBinding?.ownerUserId !== input.ownerUserId ||
            previousCustomerBinding.businessId !== business.id ||
            previousSubscriptionBinding?.ownerUserId !== input.ownerUserId ||
            previousSubscriptionBinding.businessId !== business.id) {
          return { updated: false, reason: "IDENTITY_CONFLICT" };
        }
        reconnectingExpiredBusiness = true;
      }
    } else if (
      (
        business.status !== "pending_billing"
        && business.commercialAccessMode !== "onboarding_pilot"
      )
      || !business.stripeCheckoutSessionId
      || !input.checkoutReservationId
      || business.stripeCheckoutReservationId !== input.checkoutReservationId
    ) {
      return { updated: false, reason: "RESERVATION_CONFLICT" };
    }

    const userIdentityClaims = await tx
      .select({
        id: users.id,
      })
      .from(users)
      .where(sql`
        ${users.stripeCustomerId} = ${input.stripeCustomerId}
        OR ${users.stripeSubscriptionId} = ${input.stripeSubscriptionId}
      `)
      .limit(2);
    if (userIdentityClaims.some((claim) => claim.id !== input.ownerUserId)) {
      return { updated: false, reason: "IDENTITY_CONFLICT" };
    }
    if (userIdentityClaims.length) {
      // Organization subscriptions have their own billing partition. Even an
      // exact same-owner match is not permission to clear or replace Personal
      // subscription fields; conflicting legacy state requires reconciliation.
      return { updated: false, reason: "IDENTITY_CONFLICT" };
    }

    if (reconnectingExpiredBusiness && (
      !input.checkoutSessionId ||
      !input.checkoutReservationId ||
      business.stripeCheckoutSessionId !== input.checkoutSessionId ||
      business.stripeCheckoutReservationId !== input.checkoutReservationId
    )) {
      return { updated: false, reason: "RESERVATION_CONFLICT" };
    }
    if (
      input.checkoutSessionId
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

    await tx
      .update(businesses)
      .set({
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        ...(input.checkoutSessionId
          ? { stripeCheckoutSessionId: input.checkoutSessionId }
          : {}),
        status: input.status,
        ...(input.status === "active"
          ? {
              commercialAccessMode: "paid" as const,
              commercialAccessStartedAt: new Date(),
              commercialAccessEndsAt: null,
            }
          : {}),
        // clinical_business_monthly is a flat organization product. Its Stripe
        // line-item quantity is always one and is never an authority for
        // professional capacity. Keep the legacy argument for non-flat
        // business products only.
        ...(business.plan !== "clinical_business_monthly"
          && input.seatLimit != null
          && input.seatLimit > 0
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

    await input.onAccepted?.(tx, input.ownerUserId, business.id);

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