import {
  type Entitlement,
  LOOKUP_KEY_TO_TIER,
  PROCARE_ENTITLEMENTS,
  getEntitlementsForTier,
  getTierForLookupKey,
  isProCarePlanKey,
} from "../shared/planFeatures";

export type { Entitlement };

export type PlanKey = string;

/**
 * All checkout and webhook entitlement writes derive from shared plan policy.
 * This prevents product-specific maps from drifting away from Studio access.
 */
export function getEntitlementsForPlan(planKey: PlanKey | null | undefined): Entitlement[] {
  if (!planKey || !Object.prototype.hasOwnProperty.call(LOOKUP_KEY_TO_TIER, planKey)) {
    return [];
  }

  const tierEntitlements = getEntitlementsForTier(getTierForLookupKey(planKey));
  return isProCarePlanKey(planKey)
    ? [...new Set([...tierEntitlements, ...PROCARE_ENTITLEMENTS])]
    : tierEntitlements;
}

export const PLAN_ENTITLEMENTS: Record<string, Entitlement[]> = Object.fromEntries(
  Object.keys(LOOKUP_KEY_TO_TIER).map((planKey) => [planKey, getEntitlementsForPlan(planKey)])
);

export function userHasEntitlement(
  entitlements: Entitlement[] | undefined,
  need: Entitlement
): boolean {
  return entitlements?.includes(need) || false;
}
