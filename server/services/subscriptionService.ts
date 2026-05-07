import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { LookupKey } from "../../client/src/data/planSkus";
import { getTierForLookupKey, getEntitlementsForTier } from "../../shared/planFeatures";

/**
 * Derive the entitlements array for any plan lookup key.
 * Uses the shared tier mapping so iOS plans and Stripe plans are both covered.
 */
function entitlementsForKey(lookupKey: string): string[] {
  const tier = getTierForLookupKey(lookupKey);
  return getEntitlementsForTier(tier) as string[];
}

export async function updateUserSubscription(opts: {
  userId: string;
  lookupKey: LookupKey | string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}) {
  const { userId, lookupKey, stripeCustomerId, stripeSubscriptionId } = opts;

  const entitlements = entitlementsForKey(lookupKey);

  const updateFields: Record<string, unknown> = {
    planLookupKey: lookupKey,
    entitlements,
    subscriptionStatus: "active",
  };
  if (stripeCustomerId !== undefined) updateFields.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId !== undefined) updateFields.stripeSubscriptionId = stripeSubscriptionId;

  const result = await db
    .update(users)
    .set(updateFields as any)
    .where(eq(users.id, userId));

  console.log(`✅ [subscription] Activated user ${userId} on plan ${lookupKey} — ${entitlements.length} entitlements`);

  if (!result) {
    console.warn(`⚠️ [subscription] No user updated for activation: ${userId}`);
  }
}

export async function cancelUserSubscription(stripeCustomerId: string) {
  const result = await db
    .update(users)
    .set({
      planLookupKey: null,
      stripeSubscriptionId: null,
      entitlements: [],
      subscriptionStatus: "cancelled",
    } as any)
    .where(eq(users.stripeCustomerId, stripeCustomerId));

  console.log(`⚠️ [subscription] Cancelled subscription for Stripe customer ${stripeCustomerId} — entitlements cleared`);

  if (!result) {
    console.warn(`⚠️ [subscription] No user found for Stripe customer ${stripeCustomerId}`);
  }
}
