import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { LookupKey } from "../../client/src/data/planSkus";

export async function updateUserSubscription(opts: {
  userId: string;
  lookupKey: LookupKey;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}) {
  const { userId, lookupKey, stripeCustomerId, stripeSubscriptionId } = opts;

  const result = await db
    .update(users)
    .set({
      planLookupKey: lookupKey,
      stripeCustomerId,
      stripeSubscriptionId,
    })
    .where(eq(users.id, userId));

  console.log(`✅ Updated user ${userId} to plan ${lookupKey}`);

  if (!result) {
    console.warn(`⚠️ No user updated for subscription activation: ${userId}`);
  }
}

export async function cancelUserSubscription(stripeCustomerId: string) {
  const result = await db
    .update(users)
    .set({
      planLookupKey: null,
      stripeSubscriptionId: null,
    })
    .where(eq(users.stripeCustomerId, stripeCustomerId));

  console.log(
    `⚠️ Cancelled subscription for Stripe customer ${stripeCustomerId}`,
  );

  if (!result) {
    console.warn(`⚠️ No user found for Stripe customer ${stripeCustomerId}`);
  }
}
