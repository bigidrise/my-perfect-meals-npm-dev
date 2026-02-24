import {
  type Entitlement,
  type PlanTier,
  PLAN_FEATURES,
  LOOKUP_KEY_TO_TIER,
  getTierForLookupKey,
  getMinTierForEntitlement,
  tierIncludesEntitlement,
  TRIAL_UNLOCKS_TIER,
} from "@shared/planFeatures";

import type { LookupKey } from "@/data/planSkus";

export type { Entitlement };

export interface UserWithEntitlements {
  id: string;
  entitlements?: string[];
  planLookupKey?: string | null;
  accessTier?: string;
  isTester?: boolean;
  trialEndsAt?: string | null;
  [key: string]: any;
}

export function hasFeature(
  user: UserWithEntitlements | null | undefined,
  feature: Entitlement
): boolean {
  if (!user) return false;
  if (user.isTester) return true;
  if (user.accessTier === "PAID_FULL" || user.accessTier === "TRIAL_FULL") {
    const tier = user.accessTier === "TRIAL_FULL"
      ? TRIAL_UNLOCKS_TIER
      : getTierForLookupKey(user.planLookupKey);
    return tierIncludesEntitlement(tier, feature);
  }
  return user.entitlements?.includes(feature) || false;
}

export function hasPlanFeature(
  user: UserWithEntitlements | null | undefined,
  feature: Entitlement
): boolean {
  return hasFeature(user, feature);
}

const TIER_TO_CHEAPEST_LOOKUP: Record<PlanTier, LookupKey> = {
  free: "mpm_basic_monthly",
  basic: "mpm_basic_monthly",
  premium: "mpm_premium_monthly",
  ultimate: "mpm_ultimate_monthly",
};

export function getUpgradePlanForFeature(feature: Entitlement): LookupKey {
  if (feature === "procare") {
    return "mpm_procare_monthly";
  }
  const minTier = getMinTierForEntitlement(feature);
  return TIER_TO_CHEAPEST_LOOKUP[minTier];
}

export function getPlanDisplayName(lookupKey: string | null | undefined): string {
  const names: Record<string, string> = {
    mpm_basic_monthly: "Basic",
    mpm_upgrade_monthly: "Premium",
    mpm_upgrade_beta_monthly: "Premium (Beta)",
    mpm_premium_monthly: "Premium",
    mpm_premium_beta_monthly: "Premium (Beta)",
    mpm_ultimate_monthly: "Ultimate",
    mpm_family_base_monthly: "Family Base",
    mpm_family_all_upgrade_monthly: "Family All-Premium",
    mpm_family_all_premium_monthly: "Family All-Premium",
    mpm_family_all_ultimate_monthly: "Family All-Ultimate",
    mpm_procare_monthly: "ProCare",
  };

  return lookupKey ? names[lookupKey] || lookupKey : "Free";
}

export function getUserTier(user: UserWithEntitlements | null | undefined): PlanTier {
  if (!user) return "free";
  if (user.isTester) return "ultimate";
  if (user.accessTier === "TRIAL_FULL") return TRIAL_UNLOCKS_TIER;
  return getTierForLookupKey(user.planLookupKey);
}
