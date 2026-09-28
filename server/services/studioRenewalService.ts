import { createHash, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { studios } from "../db/schema/studio";
import { stripeIdentityOwners } from "../db/schema/stripeBilling";
import { serviceBillingSnapshots } from "../db/schema/serviceBillingSnapshots";
import { isPersonalStudioRenewalEligible } from "@shared/studioAccess";
import { getStudioAccessStatus } from "./workspaceAvailabilityService";
import { resolveServiceBillingStatus } from "./serviceBillingStatus";
import {
  persistVerifiedServiceSnapshot,
  verifySubscriptionBillingFacts,
} from "./verifiedServiceBillingWriter";

export type StudioRenewalAction = "end" | "keep";

export class StudioBillingReviewError extends Error {
  constructor() {
    super("Studio billing needs review. No renewal change was made.");
  }
}

function requireVerified(condition: unknown): asserts condition {
  if (!condition) throw new StudioBillingReviewError();
}

/** Never accepts a subscription ID, customer ID, owner, or plan from the browser. */
export async function changeStudioRenewal(input: {
  userId: string;
  action: StudioRenewalAction;
  stripe: Pick<Stripe, "subscriptions" | "prices">;
}): Promise<{ state: "active" | "ending"; paidThrough: string }> {
  if (process.env.SERVICE_BILLING_SNAPSHOTS_ENABLED !== "true") {
    throw new StudioBillingReviewError();
  }
  const access = await getStudioAccessStatus(input.userId);
  requireVerified(isPersonalStudioRenewalEligible(access));
  const desired = input.action === "end";

  return db.transaction(async (tx) => {
    const [user] = await tx.select({
      id: users.id,
      customerId: users.stripeCustomerId,
      subscriptionId: users.stripeSubscriptionId,
      planKey: users.personalPlanLookupKey,
      fallbackPlanKey: users.planLookupKey,
      isFounder: users.isFounder,
      isSandbox: users.isSandbox,
      isTester: users.isTester,
    }).from(users).where(eq(users.id, input.userId)).limit(1);
    requireVerified(user?.customerId && user.subscriptionId &&
      !user.isFounder && !user.isSandbox && !user.isTester);

    // Serialize repeated End/Keep requests for this exact subscription. No
    // unrelated account, entitlement, workspace, or relationship is updated.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.subscriptionId}))`);
    const owned = await tx.select({ id: studios.id, status: studios.status })
      .from(studios).where(eq(studios.ownerUserId, input.userId)).limit(2);
    requireVerified(owned.length === 1 && owned[0].status === "active");
    const [snapshot] = await tx.select().from(serviceBillingSnapshots)
      .where(eq(serviceBillingSnapshots.stripeSubscriptionId, user.subscriptionId)).limit(1);
    requireVerified(snapshot);
    const planKey = user.planKey ?? user.fallbackPlanKey;
    const identity = {
      serviceType: "professional" as const,
      ownerUserId: input.userId,
      stripeCustomerId: user.customerId,
      stripeSubscriptionId: user.subscriptionId,
      studioId: owned[0].id,
      trustedPlanKey: planKey,
    };
    const prior = resolveServiceBillingStatus(identity, snapshot);
    requireVerified(prior.state === "active" || prior.state === "ending");
    requireVerified(snapshot.source === "webhook" || snapshot.source === "reconciliation" ||
      snapshot.source === "backfill");
    requireVerified(snapshot.eventCreatedAt <= new Date() && snapshot.eventRank >= 0);
    // Cross-table ownership is immutable; neither metadata nor a client ID can
    // select a different billing subject.
    // Check each canonical ID directly; another identity owned by this user
    // must never satisfy this authorization check.
    const [customerBinding] = await tx.select().from(stripeIdentityOwners).where(and(
      eq(stripeIdentityOwners.identityType, "customer"),
      eq(stripeIdentityOwners.identityValue, user.customerId),
    )).limit(1);
    const [subscriptionBinding] = await tx.select().from(stripeIdentityOwners).where(and(
      eq(stripeIdentityOwners.identityType, "subscription"),
      eq(stripeIdentityOwners.identityValue, user.subscriptionId),
    )).limit(1);
    requireVerified([customerBinding, subscriptionBinding].every((binding) =>
      binding?.ownerUserId === input.userId && binding.businessId === null));

    const current = await input.stripe.subscriptions.retrieve(user.subscriptionId);
    requireVerified(current.id === user.subscriptionId && current.status === "active");
    const mutation = {
      source: "reconciliation" as const,
      sourceEventId: `studio-renewal:${randomUUID()}`,
      eventCreatedAt: new Date(),
      eventRank: 90,
    };
    const verify = (subscription: Stripe.Subscription) => verifySubscriptionBillingFacts({
      stripe: input.stripe,
      subscription,
      customerId: user.customerId!,
      ownerUserId: input.userId,
      expectedPlanKey: planKey!,
      mutation,
    });
    let before;
    try {
      before = await verify(current);
    } catch {
      throw new StudioBillingReviewError();
    }
    requireVerified(before.serviceType === "professional" &&
      before.priceId === snapshot.priceId &&
      before.productId === snapshot.productId &&
      before.currentPeriodEnd.getTime() === snapshot.currentPeriodEnd.getTime() &&
      before.status === "active" && !before.terminalAt &&
      (before.cancelAtPeriodEnd === snapshot.cancelAtPeriodEnd ||
       before.cancelAtPeriodEnd === desired));

    if (before.cancelAtPeriodEnd === desired &&
        snapshot.cancelAtPeriodEnd === desired) {
      return { state: desired ? "ending" : "active", paidThrough: prior.paidThrough! };
    }
    if (before.cancelAtPeriodEnd !== desired) {
      const idempotencyKey = createHash("sha256")
        .update(`studio-renewal:${input.action}:${user.subscriptionId}:${snapshot.sourceEventId}`)
        .digest("hex");
      await input.stripe.subscriptions.update(user.subscriptionId, {
        cancel_at_period_end: desired,
      }, { idempotencyKey: `mpm-studio-renewal:${idempotencyKey}` });
    }
    // A failed local write can be retried without updating Stripe again.
    // Re-retrieve instead of trusting a client response or optimistic state.
    const after = await input.stripe.subscriptions.retrieve(user.subscriptionId);
    let facts;
    try {
      facts = await verify(after);
    } catch {
      throw new StudioBillingReviewError();
    }
    requireVerified(facts.stripeSubscriptionId === user.subscriptionId &&
      facts.stripeCustomerId === user.customerId &&
      facts.serviceType === "professional" && facts.status === "active" &&
      facts.cancelAtPeriodEnd === desired &&
      facts.priceId === snapshot.priceId && facts.productId === snapshot.productId &&
      facts.currentPeriodEnd.getTime() === snapshot.currentPeriodEnd.getTime() &&
      mutation.eventCreatedAt > snapshot.eventCreatedAt);
    await persistVerifiedServiceSnapshot(tx, {
      ...facts, businessId: null, studioId: owned[0].id,
    });
    const [saved] = await tx.select().from(serviceBillingSnapshots)
      .where(eq(serviceBillingSnapshots.stripeSubscriptionId, user.subscriptionId)).limit(1);
    const resolved = resolveServiceBillingStatus(identity, saved ?? null);
    requireVerified(resolved.state === (desired ? "ending" : "active") && resolved.paidThrough);
    return { state: resolved.state, paidThrough: resolved.paidThrough };
  });
}