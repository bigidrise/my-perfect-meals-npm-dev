/**
 * Effective Access Service
 *
 * Computes a user's effective plan from two sources:
 *   1. Active business membership (sponsor pays → sponsored gets clinical tier)
 *   2. Personal plan (what the user owns independently)
 *
 * Business membership takes precedence while active. When membership ends
 * (status = "removed", or the business goes inactive), the user automatically
 * falls back to their personal plan — no manual DB writes required.
 *
 * Rule: billing authority ≠ data ownership. This service only controls access
 * tier; it says nothing about who owns the client relationships.
 */

import { db } from "../db";
import { businessMembers, businesses } from "../db/schema/business";
import { eq, and } from "drizzle-orm";
import {
  getTierForLookupKey,
  getEntitlementsForTier,
  type PlanTier,
} from "../../shared/planFeatures";

export interface EffectiveAccess {
  planLookupKey: string | null;
  entitlements: string[];
  tier: PlanTier;
  /** Non-null when access is sponsored by an active business membership. */
  sponsoredByBusinessId: string | null;
  sponsoredByBusinessName: string | null;
}

interface UserSnapshot {
  id: string;
  planLookupKey?: string | null;
  /** Snapshot of personal plan taken at business invite accept time. */
  personalPlanLookupKey?: string | null;
  personalEntitlements?: string[] | null;
  isSandbox?: boolean | null;
  isFounder?: boolean | null;
  isTester?: boolean | null;
}

export async function computeEffectiveAccess(
  user: UserSnapshot
): Promise<EffectiveAccess> {
  const ultimateEntitlements = getEntitlementsForTier("ultimate") as string[];

  const BILLING_ENFORCED = process.env.BILLING_ENFORCED === "true";

  // Founders always get ultimate (permanent access regardless of billing mode).
  // Sandbox accounts get ultimate only in pre-launch mode — once billing is enforced
  // they use their real plan/trial so each tier can be tested by assigning the
  // appropriate plan_lookup_key to the test account.
  //
  // IMPORTANT — entitlements and subscription identity are separate concepts:
  //   • Founder status elevates entitlements to ultimate.
  //   • The real planLookupKey must be preserved so downstream middleware
  //     (e.g. requireProCareAccess) can still recognise the actual product
  //     this account owns.
  //
  // We fall back to the synthetic "mpm_ultimate_monthly" key only when the
  // founder has no real paid plan on record (pure internal/founder accounts).
  if (user.isFounder || (!BILLING_ENFORCED && user.isSandbox)) {
    // Prefer the real plan key; treat empty strings as absent.
    const realKey = user.planLookupKey || user.personalPlanLookupKey || null;
    return {
      planLookupKey: realKey ?? "mpm_ultimate_monthly",
      entitlements: ultimateEntitlements,
      tier: "ultimate",
      sponsoredByBusinessId: null,
      sponsoredByBusinessName: null,
    };
  }

  const [membership] = await db
    .select({
      businessId: businesses.id,
      businessName: businesses.name,
      plan: businesses.plan,
    })
    .from(businessMembers)
    .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
    .where(
      and(
        eq(businessMembers.userId, user.id),
        eq(businessMembers.status, "active"),
        eq(businesses.status, "active")
      )
    )
    .limit(1);

  if (membership) {
    const tier = getTierForLookupKey(membership.plan);
    return {
      planLookupKey: membership.plan,
      entitlements: getEntitlementsForTier(tier) as string[],
      tier,
      sponsoredByBusinessId: membership.businessId,
      sponsoredByBusinessName: membership.businessName,
    };
  }

  const effectiveLookupKey =
    user.personalPlanLookupKey ?? user.planLookupKey ?? null;
  const tier = getTierForLookupKey(effectiveLookupKey);
  return {
    planLookupKey: effectiveLookupKey,
    entitlements: getEntitlementsForTier(tier) as string[],
    tier,
    sponsoredByBusinessId: null,
    sponsoredByBusinessName: null,
  };
}
