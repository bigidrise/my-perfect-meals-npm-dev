import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { businesses } from "../db/schema/business";
import { stripeIdentityOwners } from "../db/schema/stripeBilling";
import { claimBillingEvent, completeBillingEvent, failBillingEvent } from "./stripeBillingEventService";
import { planFromSubscription } from "./stripePlanCatalog";
import { updateUserSubscription } from "./subscriptionService";
import { applyBusinessSubscriptionTransition } from "./businessSubscriptionService";

export type ReconciliationResult =
  | {
      status: "active";
      planLookupKey: string;
      entitlements: string[];
      subscriptionStatus: string;
    }
  | {
      status: "pending";
      subscriptionStatus: string;
    };

async function verifyBusinessCheckoutState(input: {
  businessId: string;
  ownerUserId: string;
  customerId: string;
  subscriptionId: string;
  sessionId: string;
}): Promise<void> {
  const [business] = await db.select({
    ownerUserId: businesses.ownerUserId,
    status: businesses.status,
    customerId: businesses.stripeCustomerId,
    subscriptionId: businesses.stripeSubscriptionId,
    sessionId: businesses.stripeCheckoutSessionId,
  }).from(businesses).where(eq(businesses.id, input.businessId)).limit(1);
  if (
    !business
    || business.ownerUserId !== input.ownerUserId
    || business.status !== "active"
    || business.customerId !== input.customerId
    || business.subscriptionId !== input.subscriptionId
    || business.sessionId !== input.sessionId
  ) {
    throw new Error("Business checkout is paid but business billing is not active");
  }
  for (const [identityType, identityValue] of [
    ["customer", input.customerId],
    ["subscription", input.subscriptionId],
  ] as const) {
    const [owner] = await db.select({
      ownerUserId: stripeIdentityOwners.ownerUserId,
      businessId: stripeIdentityOwners.businessId,
    }).from(stripeIdentityOwners).where(and(
      eq(stripeIdentityOwners.identityType, identityType),
      eq(stripeIdentityOwners.identityValue, identityValue),
    )).limit(1);
    if (!owner || owner.businessId !== input.businessId || owner.ownerUserId !== input.ownerUserId) {
      throw new Error("Business checkout is paid but Stripe ownership is not verified");
    }
  }
}

export function hasVerifiedCheckoutSubscriptionIdentity(input: {
  userId: string;
  sessionUserId?: string | null;
  subscriptionUserId?: string | null;
  paymentStatus?: string | null;
  businessId?: string | null;
  allowLegacySessionIdentity?: boolean;
}): boolean {
  if (input.sessionUserId !== input.userId) return false;
  if (input.subscriptionUserId === input.userId) return true;
  return Boolean(
    input.allowLegacySessionIdentity &&
    !input.subscriptionUserId &&
    input.paymentStatus === "paid" &&
    !input.businessId
  );
}

export async function reconcileCheckoutSession(args: {
  stripe: Stripe;
  userId: string;
  sessionId: string;
  // Only an MFA-protected administrator may opt into a legacy subscription
  // whose completed, paid Checkout Session names the exact account.
  allowLegacySessionIdentity?: boolean;
}): Promise<ReconciliationResult> {
  const session = await args.stripe.checkout.sessions.retrieve(args.sessionId, {
    expand: ["subscription", "subscription.items.data.price"],
  });

  if (session.mode !== "subscription" || session.status !== "complete") {
    return { status: "pending", subscriptionStatus: session.status ?? "open" };
  }

  if (session.metadata?.userId !== args.userId) {
    throw new Error("Checkout session does not belong to the authenticated user");
  }

  const subscription = session.subscription as Stripe.Subscription | null;
  if (!subscription || typeof subscription === "string") {
    throw new Error("Checkout session subscription was not available");
  }

  if (!hasVerifiedCheckoutSubscriptionIdentity({
    userId: args.userId,
    sessionUserId: session.metadata?.userId,
    subscriptionUserId: subscription.metadata?.userId,
    paymentStatus: session.payment_status,
    businessId: session.metadata?.businessId,
    allowLegacySessionIdentity: args.allowLegacySessionIdentity,
  })) {
    throw new Error("Subscription identity does not match the authenticated user");
  }

  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
  if (!customerId || session.customer !== customerId) {
    throw new Error("Checkout customer and subscription customer do not match");
  }

  const trustedPlan = planFromSubscription(subscription, session.metadata?.sku);
  if (!trustedPlan) {
    throw new Error("Stripe price is not mapped to a trusted MPM plan");
  }
  if (
    trustedPlan.planLookupKey === "clinical_business_monthly"
    && subscription.items.data[0]?.quantity !== 1
  ) {
    throw new Error("Flat organization subscriptions must retain Stripe quantity 1");
  }

  const isBusiness = trustedPlan.planLookupKey === "clinical_business_monthly";
  const businessId = session.metadata?.businessId;
  if (isBusiness) {
    if (
      session.payment_status !== "paid"
      || session.metadata?.subscriptionType !== "business_seat"
      || subscription.metadata?.subscriptionType !== "business_seat"
      || !businessId
      || subscription.metadata?.businessId !== businessId
      || !session.metadata?.checkoutReservationId
      || subscription.metadata?.checkoutReservationId !== session.metadata.checkoutReservationId
    ) {
      throw new Error("Business checkout payment or identity could not be verified");
    }
    const [reserved] = await db.select({
      ownerUserId: businesses.ownerUserId,
      plan: businesses.plan,
      sessionId: businesses.stripeCheckoutSessionId,
      reservationId: businesses.stripeCheckoutReservationId,
    }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
    if (
      !reserved
      || reserved.ownerUserId !== args.userId
      || reserved.plan !== "clinical_business_monthly"
      || reserved.sessionId !== session.id
      || reserved.reservationId !== session.metadata.checkoutReservationId
    ) {
      throw new Error("Business checkout does not match the owner's saved reservation");
    }
  }

  if (subscription.status !== "active" && subscription.status !== "trialing") {
    return { status: "pending", subscriptionStatus: subscription.status };
  }

  const eventId = `reconcile:${session.id}:${subscription.id}`;
  const eventCreatedAt = new Date();
  const claim = await claimBillingEvent({
    eventId,
    eventType: "subscription.reconciled",
    eventCreatedAt,
    customerId,
    subscriptionId: subscription.id,
    userId: args.userId,
    source: "reconciliation",
  });
  if (claim === "in_progress") {
    throw new Error("Checkout reconciliation is still processing; retry shortly");
  }

  try {
    if (claim === "claimed") {
      const result = isBusiness
        ? await applyBusinessSubscriptionTransition({
            ownerUserId: args.userId,
            businessId,
            checkoutReservationId: session.metadata?.checkoutReservationId,
            checkoutSessionId: session.id,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            status: "active",
            // The ordinary organization plan is flat; Stripe quantity is not
            // professional capacity.
            mutation: {
              eventId,
              eventCreatedAt,
              eventRank: 90,
              source: "reconciliation",
            },
          })
        : await updateUserSubscription({
            userId: args.userId,
            lookupKey: trustedPlan.planLookupKey,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            mutation: {
              eventId,
              eventCreatedAt,
              eventRank: 90,
              source: "reconciliation",
            },
          });
      if (!result.updated && result.reason !== "STALE_EVENT") {
        throw new Error(
          `Verified Stripe subscription could not be persisted (${result.reason})`,
        );
      }
    }

    if (isBusiness) {
      await verifyBusinessCheckoutState({
        businessId: businessId!,
        ownerUserId: args.userId,
        customerId,
        subscriptionId: subscription.id,
        sessionId: session.id,
      });
    }

    const [user] = await db
      .select({
        planLookupKey: users.planLookupKey,
        entitlements: users.entitlements,
        subscriptionStatus: users.subscriptionStatus,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.id, args.userId))
      .limit(1);

    if (!user || (!isBusiness && (
      user.planLookupKey !== trustedPlan.planLookupKey ||
      user.stripeCustomerId !== customerId ||
      user.stripeSubscriptionId !== subscription.id
    ))) {
      throw new Error("Verified Stripe subscription could not be persisted");
    }

    if (claim === "claimed") {
      await completeBillingEvent(eventId, "processed", args.userId);
    }
    return {
      status: "active",
      planLookupKey: isBusiness ? trustedPlan.planLookupKey : user.planLookupKey!,
      entitlements: user.entitlements ?? [],
      subscriptionStatus: isBusiness ? "active" : user.subscriptionStatus ?? "active",
    };
  } catch (error) {
    if (claim === "claimed") {
      await failBillingEvent(eventId, error);
    }
    throw error;
  }
}
