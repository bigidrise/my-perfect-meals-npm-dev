import type Stripe from "stripe";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import { businesses } from "../db/schema/business";
import { stripeIdentityOwners } from "../db/schema/stripeBilling";
import { serviceBillingSnapshots } from "../db/schema/serviceBillingSnapshots";
import { studios } from "../db/schema/studio";
import { users } from "@shared/schema";
import { isProCarePlanKey } from "@shared/planFeatures";
import { planFromSubscription } from "./stripePlanCatalog";
import {
  persistVerifiedServiceSnapshot,
  verifySubscriptionBillingFacts,
} from "./verifiedServiceBillingWriter";

export type ExistingBillingCandidate = {
  ownerUserId: string;
  businessId: string | null;
  customerId: string;
  subscriptionId: string;
};

/** Not mounted in a route, worker, migration, or startup. Approval required. */
export async function reconcileExistingServiceBillingBatch(input: {
  stripe: Pick<Stripe, "subscriptions" | "prices">;
  candidates: ExistingBillingCandidate[];
  approved: boolean;
}): Promise<{ verified: number; needsReview: number }> {
  if (!input.approved || process.env.SERVICE_BILLING_BACKFILL_ENABLED !== "true") {
    throw new Error("Service billing backfill is not authorized");
  }
  if (input.candidates.length > 25) throw new Error("Backfill exceeds the 25-subscription batch limit");
  let verified = 0;
  let needsReview = 0;
  for (const candidate of input.candidates) {
    const startedAt = new Date();
    try {
      if (!candidate.ownerUserId || !candidate.customerId || !candidate.subscriptionId) {
        throw new Error("Incomplete exact subscription identity");
      }
      const subscription = await input.stripe.subscriptions.retrieve(candidate.subscriptionId);
      const plan = planFromSubscription(subscription);
      if (!plan) throw new Error("Untrusted Stripe price");
      const serviceType = plan.planLookupKey === "clinical_business_monthly"
        ? "organization"
        : isProCarePlanKey(plan.planLookupKey) ? "professional" : "personal";
      if ((serviceType === "organization") !== Boolean(candidate.businessId)) {
        throw new Error("Subscription service does not match the stored billing subject");
      }
      const facts = await verifySubscriptionBillingFacts({
        stripe: input.stripe,
        subscription,
        customerId: candidate.customerId,
        ownerUserId: candidate.ownerUserId,
        expectedPlanKey: plan.planLookupKey,
        mutation: {
          source: "backfill",
          sourceEventId: `backfill:${candidate.subscriptionId}`,
          // Backfill only seeds missing history. Every real Stripe event must
          // outrank it, even when the event arrives during a provider fetch.
          eventCreatedAt: new Date(0),
          eventRank: 0,
        },
      });
      await db.transaction(async (tx) => {
        // The two immutable ledger claims and the current account binding
        // must all agree. Do not create/repair identity claims in backfill.
        const claims = await tx.select({
          identityType: stripeIdentityOwners.identityType,
          identityValue: stripeIdentityOwners.identityValue,
        }).from(stripeIdentityOwners).where(and(
          eq(stripeIdentityOwners.ownerUserId, candidate.ownerUserId),
          candidate.businessId
            ? eq(stripeIdentityOwners.businessId, candidate.businessId)
            : isNull(stripeIdentityOwners.businessId),
        ));
        if (!claims.some((row) => row.identityType === "customer" && row.identityValue === candidate.customerId) ||
            !claims.some((row) => row.identityType === "subscription" && row.identityValue === candidate.subscriptionId)) {
          throw new Error("Stored Stripe identity ownership is incomplete");
        }
        let studioId: string | null = null;
        if (candidate.businessId) {
          const [business] = await tx.select({
            ownerUserId: businesses.ownerUserId,
            customerId: businesses.stripeCustomerId,
            subscriptionId: businesses.stripeSubscriptionId,
            eventCreatedAt: businesses.stripeLastEventCreatedAt,
          }).from(businesses).where(eq(businesses.id, candidate.businessId)).limit(1);
          if (!business || business.ownerUserId !== candidate.ownerUserId ||
              business.customerId !== candidate.customerId ||
              business.subscriptionId !== candidate.subscriptionId ||
              (business.eventCreatedAt && business.eventCreatedAt > startedAt) ||
              (subscription.metadata?.businessId && subscription.metadata.businessId !== candidate.businessId)) {
            throw new Error("Organization ownership changed or is ambiguous");
          }
        } else {
          const [user] = await tx.select({
            customerId: users.stripeCustomerId,
            subscriptionId: users.stripeSubscriptionId,
            eventCreatedAt: users.stripeLastEventCreatedAt,
          }).from(users).where(eq(users.id, candidate.ownerUserId)).limit(1);
          if (!user || user.customerId !== candidate.customerId ||
              user.subscriptionId !== candidate.subscriptionId ||
              (user.eventCreatedAt && user.eventCreatedAt > startedAt)) {
            throw new Error("Personal ownership changed or is ambiguous");
          }
          if (serviceType === "professional") {
            const owned = await tx.select({ id: studios.id }).from(studios)
              .where(eq(studios.ownerUserId, candidate.ownerUserId)).limit(2);
            if (owned.length > 1) throw new Error("Studio association is ambiguous");
            studioId = owned[0]?.id ?? null;
          }
        }
        const [previous] = await tx.select({ verifiedAt: serviceBillingSnapshots.verifiedAt })
          .from(serviceBillingSnapshots)
          .where(eq(serviceBillingSnapshots.stripeSubscriptionId, candidate.subscriptionId))
          .limit(1);
        if (previous?.verifiedAt && previous.verifiedAt > startedAt) {
          throw new Error("Subscription was verified again while backfill was running");
        }
        if (previous) return;
        await persistVerifiedServiceSnapshot(tx, {
          ...facts,
          businessId: candidate.businessId,
          studioId,
        });
      });
      verified++;
    } catch {
      // Never guess a different account, subscription, or workspace.
      needsReview++;
    }
  }
  return { verified, needsReview };
}