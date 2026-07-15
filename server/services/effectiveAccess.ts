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

  if (user.isSandbox || user.isFounder) {
    return {
      planLookupKey: "mpm_ultimate_monthly",
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
