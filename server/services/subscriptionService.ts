import { db } from "../db";
import { users } from "@shared/schema";
import type { LookupKey } from "../../client/src/data/planSkus";
import { getEntitlementsForPlan } from "../entitlements";
import { getTierForLookupKey } from "@shared/planFeatures";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

export interface SubscriptionMutationContext {
  eventId: string;
  eventCreatedAt: Date;
  eventRank: number;
  source: "webhook" | "reconciliation";
}

function legacyPlanName(lookupKey: string): string {
  const tier = getTierForLookupKey(lookupKey);
  return tier === "basic" ? "basic" : tier === "premium" ? "premium" : "ultimate";
}

function eventOrderingCondition(context?: SubscriptionMutationContext) {
  if (!context) return undefined;
  return or(
    isNull(users.stripeLastEventCreatedAt),
    lt(users.stripeLastEventCreatedAt, context.eventCreatedAt),
    and(
      eq(users.stripeLastEventCreatedAt, context.eventCreatedAt),
      lt(users.stripeLastEventRank, context.eventRank),
    ),
    and(
      eq(users.stripeLastEventCreatedAt, context.eventCreatedAt),
      eq(users.stripeLastEventRank, context.eventRank),
      eq(users.stripeLastEventId, context.eventId),
    ),
  );
}

function isStripeIdentityUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  const code = candidate.code ?? candidate.cause?.code;
  const constraint = candidate.constraint ?? candidate.cause?.constraint ?? "";
  return code === "23505" && (
    constraint === "users_stripe_customer_id_uniq"
    || constraint === "users_stripe_subscription_id_uniq"
  );
}

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
  mutation?: SubscriptionMutationContext;
  storeAsPersonalPlan?: boolean;
}) {
  const {
    userId,
    lookupKey,
    stripeCustomerId,
    stripeSubscriptionId,
    mutation,
    storeAsPersonalPlan = true,
  } = opts;

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

  if (stripeCustomerId || stripeSubscriptionId) {
    const identityConditions = [];
    if (stripeCustomerId) {
      identityConditions.push(eq(users.stripeCustomerId, stripeCustomerId));
    }
    if (stripeSubscriptionId) {
      identityConditions.push(eq(users.stripeSubscriptionId, stripeSubscriptionId));
    }

    const claimedIdentities = await db
      .select({ id: users.id })
      .from(users)
      .where(or(...identityConditions))
      .limit(2);
    if (claimedIdentities.some((claimed) => claimed.id !== verifiedUser.id)) {
      console.error(
        `❌ [subscription] Refusing activation: Stripe identity is already linked to another account`,
      );
      return { updated: false, reason: "IDENTITY_CONFLICT" as const };
    }
  }

  const entitlements = entitlementsForSubscriptionLookupKey(lookupKey);

  const updateFields: Record<string, unknown> = {
    planLookupKey: lookupKey,
    subscriptionPlan: legacyPlanName(lookupKey),
    entitlements,
    subscriptionStatus: "active",
    trialEndsAt: null,
    ...(mutation ? {
      stripeLastEventCreatedAt: mutation.eventCreatedAt,
      stripeLastEventRank: mutation.eventRank,
      stripeLastEventId: mutation.eventId,
      stripeEntitlementSource: mutation.source,
      ...(mutation.source === "reconciliation" ? { stripeReconciledAt: new Date() } : {}),
    } : {}),
  };
  if (storeAsPersonalPlan) {
    updateFields.personalPlanLookupKey = lookupKey;
    updateFields.personalEntitlements = entitlements;
    updateFields.personalSubscriptionStatus = "active";
  }
  if (stripeCustomerId !== undefined) updateFields.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId !== undefined) updateFields.stripeSubscriptionId = stripeSubscriptionId;

  const ordering = eventOrderingCondition(mutation);
  let result: Array<{ id: string }>;
  try {
    result = await db
      .update(users)
      .set(updateFields as any)
      .where(ordering ? and(eq(users.id, verifiedUser.id), ordering) : eq(users.id, verifiedUser.id))
      .returning({ id: users.id });
  } catch (error) {
    if (isStripeIdentityUniqueViolation(error)) {
      console.error(
        "❌ [subscription] Refusing activation: database rejected a duplicate Stripe identity claim",
      );
      return { updated: false, reason: "IDENTITY_CONFLICT" as const };
    }
    throw error;
  }

  console.log(`✅ [subscription] Activated user ${userId} on plan ${lookupKey} — ${entitlements.length} entitlements`);

  if (result.length === 0) {
    console.warn(`⚠️ [subscription] Activation ignored as stale or missing: ${userId}`);
  }
  return { updated: result.length === 1, reason: result.length === 1 ? undefined : "STALE_EVENT" as const };
}

export async function cancelUserSubscription(
  stripeCustomerId: string,
  stripeSubscriptionId?: string | null,
  mutation?: SubscriptionMutationContext,
  storeAsPersonalPlan = true,
) {
  const user = await resolveSubscriptionUser(stripeCustomerId, stripeSubscriptionId);
  if (!user) return { updated: false, reason: "AMBIGUOUS_OR_NOT_FOUND" as const, user: null };

  const ordering = eventOrderingCondition(mutation);
  const cancellationFields: Record<string, unknown> = storeAsPersonalPlan
    ? {
        planLookupKey: null,
        subscriptionPlan: "basic",
        entitlements: [],
        subscriptionStatus: "cancelled",
        personalPlanLookupKey: null,
        personalEntitlements: [],
        personalSubscriptionStatus: "cancelled",
      }
    : {
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
      };

  const result = await db
    .update(users)
    .set({
      stripeSubscriptionId: null,
      ...cancellationFields,
      ...(mutation ? {
        stripeLastEventCreatedAt: mutation.eventCreatedAt,
        stripeLastEventRank: mutation.eventRank,
        stripeLastEventId: mutation.eventId,
        stripeEntitlementSource: mutation.source,
      } : {}),
    } as any)
    .where(ordering ? and(eq(users.id, user.id), ordering) : eq(users.id, user.id))
    .returning({ id: users.id });

  console.log(`⚠️ [subscription] Cancelled subscription for Stripe customer ${stripeCustomerId} — entitlements cleared`);

  if (result.length === 0) {
    console.warn(`⚠️ [subscription] Cancellation ignored as stale or missing for Stripe customer ${stripeCustomerId}`);
  }
  return { updated: result.length === 1, user, reason: result.length === 1 ? undefined : "STALE_EVENT" as const };
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

export async function resolveStripeEventUser(input: {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  metadataUserId?: string | null;
  allowMetadataBootstrap?: boolean;
}) {
  const exactOwner = await resolveSubscriptionUser(
    input.stripeCustomerId,
    input.stripeSubscriptionId,
  );
  if (exactOwner) {
    if (input.metadataUserId && input.metadataUserId !== exactOwner.id) {
      console.error(
        `❌ [subscription] Refusing billing mutation: Stripe metadata conflicts with the stored owner`,
      );
      return null;
    }
    return exactOwner;
  }

  if (!input.allowMetadataBootstrap || !input.metadataUserId) {
    return null;
  }

  const [metadataUser] = await db
    .select({
      id: users.id,
      planLookupKey: users.planLookupKey,
      subscriptionStatus: users.subscriptionStatus,
      isProCare: users.isProCare,
    })
    .from(users)
    .where(eq(users.id, input.metadataUserId))
    .limit(1);
  if (!metadataUser) {
    console.error(
      `❌ [subscription] Refusing billing mutation: metadata names an unknown account`,
    );
    return null;
  }

  const identityClaims = await db
    .select({ id: users.id })
    .from(users)
    .where(or(
      eq(users.stripeCustomerId, input.stripeCustomerId),
      eq(users.stripeSubscriptionId, input.stripeSubscriptionId),
    ))
    .limit(2);
  if (identityClaims.some((claim) => claim.id !== metadataUser.id)) {
    console.error(
      `❌ [subscription] Refusing billing mutation: Stripe identity is already linked to another account`,
    );
    return null;
  }

  return metadataUser;
}
