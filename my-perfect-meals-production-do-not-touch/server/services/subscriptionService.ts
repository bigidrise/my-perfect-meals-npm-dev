
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

  await db
    .update(users)
    .set({
      planLookupKey: lookupKey,
      stripeCustomerId: stripeCustomerId ?? undefined,
      stripeSubscriptionId: stripeSubscriptionId ?? undefined,
    })
    .where(eq(users.id, userId));

  console.log(`✅ Updated user ${userId} to plan ${lookupKey}`);
}

export async function cancelUserSubscription(userId: string) {
  await db
    .update(users)
    .set({
      planLookupKey: null,
      stripeSubscriptionId: null,
    })
    .where(eq(users.id, userId));

  console.log(`✅ Cancelled subscription for user ${userId}`);
}
