import {
  type Entitlement,
  type PlanTier,
  type CheckoutLookupKey,
  getTierForLookupKey,
  getMinTierForEntitlement,
  tierIncludesEntitlement,
} from "@shared/planFeatures";

export type { Entitlement };

export interface UserWithEntitlements {
  id: string;
  entitlements?: string[];
  planLookupKey?: string | null;
  personalClinicalReconciliationEndsAt?: string | null;
  accessTier?: string;
  isTester?: boolean;
  [key: string]: any;
}

export function hasFeature(
  user: UserWithEntitlements | null | undefined,
  feature: Entitlement
): boolean {
  if (!user) return false;
  if (user.isTester) return true;
  // A server-issued reconciliation opens personal product features while the
  // original window is active. It does not make someone a ProCare provider.
  if (feature !== "procare" && user.accessTier === "PAID_FULL"
    && user.personalClinicalReconciliationEndsAt
    && Date.parse(user.personalClinicalReconciliationEndsAt) > Date.now()) {
    return tierIncludesEntitlement("ultimate", feature);
  }
  if (user.accessTier === "PAID_FULL") {
    const tier = !user.planLookupKey
      ? "ultimate"
      : getTierForLookupKey(user.planLookupKey);
    return tierIncludesEntitlement(tier, feature);
  }
  return user.entitlements?.includes(feature) || false;
}

/**
 * Strict storefront entitlement check.
 *
 * Unlike hasFeature(), this does not grant access from tester, founder, trial,
 * sandbox, or BILLING_ENFORCED bypass state. Use it for features that must be
 * visibly paywalled by the customer's purchased plan even in QA accounts.
 */
export function purchasedPlanIncludesFeature(
  user: UserWithEntitlements | null | undefined,
  feature: Entitlement,
): boolean {
  if (feature === "hydration_center" && user?.accessTier === "PAID_FULL"
    && user.personalClinicalReconciliationEndsAt
    && Date.parse(user.personalClinicalReconciliationEndsAt) > Date.now()) return true;
  if (!user?.planLookupKey) return false;
  const tier = getTierForLookupKey(user.planLookupKey);
  return tierIncludesEntitlement(tier, feature);
}

export function hasPlanFeature(
  user: UserWithEntitlements | null | undefined,
  feature: Entitlement
): boolean {
  return hasFeature(user, feature);
}

const TIER_TO_CHEAPEST_LOOKUP: Record<PlanTier, CheckoutLookupKey> = {
  free: "mpm_basic_monthly",
  basic: "mpm_basic_monthly",
  premium: "mpm_premium_monthly",
  ultimate: "mpm_ultimate_monthly",
};

export function getUpgradePlanForFeature(
  feature: Entitlement,
): CheckoutLookupKey {
  if (feature === "procare") {
    return "mpm_trainer_5";
  }
  const minTier = getMinTierForEntitlement(feature);
  return TIER_TO_CHEAPEST_LOOKUP[minTier];
}

export function getPlanDisplayName(lookupKey: string | null | undefined): string {
  const names: Record<string, string> = {
    mpm_basic_monthly: "Essential",
    mpm_upgrade_monthly: "Pro",
    mpm_upgrade_beta_monthly: "Pro (Beta)",
    mpm_premium_monthly: "Pro",
    mpm_premium_beta_monthly: "Pro (Beta)",
    mpm_ultimate_monthly: "Clinical",
    mpm_family_base_monthly: "Family Essential",
    mpm_family_premium: "Family Pro",
    mpm_family_all_upgrade_monthly: "Family Pro",
    mpm_family_all_premium_monthly: "Family Pro",
    mpm_family_all_ultimate_monthly: "Family Clinical",
    mpm_procare_monthly: "ProCare",
  };

  return lookupKey ? names[lookupKey] || lookupKey : "Free";
}

export function getUserTier(user: UserWithEntitlements | null | undefined): PlanTier {
  if (!user) return "free";
  if (user.isTester) return "ultimate";
  if (user.accessTier === "PAID_FULL") {
    return user.planLookupKey ? getTierForLookupKey(user.planLookupKey) : "ultimate";
  }
  return getTierForLookupKey(user.planLookupKey);
}
