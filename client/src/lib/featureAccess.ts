import {
  type PlanTier,
  type Entitlement,
  LOOKUP_KEY_TO_TIER,
  getTierForLookupKey,
  tierIncludesEntitlement,
  getEntitlementsForTier,
} from "@shared/planFeatures";

import type { LookupKey } from "@/data/planSkus";

export type FeatureKey = Entitlement;

export function getPlanKeyFromLookup(lookup?: LookupKey | null): PlanTier | null {
  if (!lookup) return null;
  return LOOKUP_KEY_TO_TIER[lookup] ?? null;
}

export function hasFeatureAccess(lookup: LookupKey | null | undefined, feature: FeatureKey): boolean {
  const tier = getTierForLookupKey(lookup ?? undefined);
  if (tier === "free" && !lookup) return false;
  return tierIncludesEntitlement(tier, feature);
}

export function getPlanFeatures(lookup: LookupKey | null | undefined): FeatureKey[] {
  const tier = getTierForLookupKey(lookup ?? undefined);
  return getEntitlementsForTier(tier);
}
