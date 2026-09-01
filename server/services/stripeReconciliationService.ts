import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
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

export async function reconcileCheckoutSession(args: {
  stripe: Stripe;
  userId: string;
  sessionId: string;
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

  if (subscription.metadata?.userId !== args.userId) {
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

  try {
    if (claim === "claimed") {
      const result = trustedPlan.planLookupKey === "clinical_business_monthly"
        ? await applyBusinessSubscriptionTransition({
            ownerUserId: args.userId,
            businessId: session.metadata?.businessId,
            checkoutReservationId: session.metadata?.checkoutReservationId,
            checkoutSessionId: session.id,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            status: "active",
            seatLimit: subscription.items.data[0]?.quantity,
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
      await completeBillingEvent(
        eventId,
        result.updated ? "processed" : "ignored",
        args.userId,
      );
    }

    const [user] = await db
      .select({
        planLookupKey: users.planLookupKey,
        entitlements: users.entitlements,
        subscriptionStatus: users.subscriptionStatus,
      })
      .from(users)
      .where(eq(users.id, args.userId))
      .limit(1);

    if (!user || user.planLookupKey !== trustedPlan.planLookupKey) {
      throw new Error("Verified Stripe subscription could not be persisted");
    }

    return {
      status: "active",
      planLookupKey: user.planLookupKey,
      entitlements: user.entitlements ?? [],
      subscriptionStatus: user.subscriptionStatus ?? "active",
    };
  } catch (error) {
    if (claim === "claimed") {
      await failBillingEvent(eventId, error);
    }
    throw error;
  }
}
