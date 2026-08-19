import { db } from "../db";
import { users } from "@shared/schema";
import type { LookupKey } from "../../client/src/data/planSkus";
import { getEntitlementsForPlan } from "../entitlements";
import { and, eq } from "drizzle-orm";

/**
 * Derive the entitlements array for any plan lookup key.
 * Uses the shared tier mapping so iOS plans and Stripe plans are both covered.
 */
export function entitlementsForSubscriptionLookupKey(lookupKey: string): string[] {
  return getEntitlementsForPlan(lookupKey);
}

export async function updateUserSubscription(opts: {
  userId: string;
  lookupKey: LookupKey | string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}) {
  const { userId, lookupKey, stripeCustomerId, stripeSubscriptionId } = opts;

  // A webhook metadata value is only a selector until this exact primary-key
  // lookup verifies it names one account. Never fall back to an email match.
  const [verifiedUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!verifiedUser) {
    console.error(`❌ [subscription] Refusing activation for unknown user ID ${userId}`);
    return { updated: false, reason: "USER_NOT_FOUND" as const };
  }

  const entitlements = entitlementsForSubscriptionLookupKey(lookupKey);

  const updateFields: Record<string, unknown> = {
    planLookupKey: lookupKey,
    entitlements,
    subscriptionStatus: "active",
    trialEndsAt: null,
  };
  if (stripeCustomerId !== undefined) updateFields.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId !== undefined) updateFields.stripeSubscriptionId = stripeSubscriptionId;

  const result = await db
    .update(users)
    .set(updateFields as any)
    .where(eq(users.id, verifiedUser.id));

  console.log(`✅ [subscription] Activated user ${userId} on plan ${lookupKey} — ${entitlements.length} entitlements`);

  if (!result) {
    console.warn(`⚠️ [subscription] No user updated for activation: ${userId}`);
  }
  return { updated: Boolean(result) };
}

export async function cancelUserSubscription(
  stripeCustomerId: string,
  stripeSubscriptionId?: string | null,
) {
  const user = await resolveSubscriptionUser(stripeCustomerId, stripeSubscriptionId);
  if (!user) return { updated: false, reason: "AMBIGUOUS_OR_NOT_FOUND" as const, user: null };

  const result = await db
    .update(users)
    .set({
      planLookupKey: null,
      stripeSubscriptionId: null,
      entitlements: [],
      subscriptionStatus: "cancelled",
    } as any)
    .where(eq(users.id, user.id));

  console.log(`⚠️ [subscription] Cancelled subscription for Stripe customer ${stripeCustomerId} — entitlements cleared`);

  if (!result) {
    console.warn(`⚠️ [subscription] No user found for Stripe customer ${stripeCustomerId}`);
  }
  return { updated: Boolean(result), user };
}

export async function resolveSubscriptionUser(
  stripeCustomerId: string,
  stripeSubscriptionId?: string | null,
) {
  const conditions = [eq(users.stripeCustomerId, stripeCustomerId)];
  if (stripeSubscriptionId) {
    conditions.push(eq(users.stripeSubscriptionId, stripeSubscriptionId));
  }

  const matches = await db
    .select({
      id: users.id,
      planLookupKey: users.planLookupKey,
      subscriptionStatus: users.subscriptionStatus,
      isProCare: users.isProCare,
    })
    .from(users)
    .where(and(...conditions))
    .limit(2);

  if (matches.length !== 1) {
    console.error(
      `❌ [subscription] Refusing billing mutation: expected one user for customer ${stripeCustomerId}, found ${matches.length}`,
    );
    return null;
  }

  return matches[0];
}
