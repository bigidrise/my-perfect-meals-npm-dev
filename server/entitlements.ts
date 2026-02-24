import {
  type Entitlement,
  type PlanTier,
  PLAN_FEATURES,
  LOOKUP_KEY_TO_TIER,
  PROCARE_ENTITLEMENTS,
  getEntitlementsForTier,
  getTierForLookupKey,
} from "../shared/planFeatures";

export type { Entitlement };

export type PlanKey =
  | "mpm_free"
  | "mpm_basic_monthly"
  | "mpm_upgrade_monthly"
  | "mpm_upgrade_beta_monthly"
  | "mpm_ultimate_monthly"
  | "mpm_family_base_monthly"
  | "mpm_family_all_upgrade_monthly"
  | "mpm_family_all_ultimate_monthly"
  | "mpm_procare_monthly";

export const PLAN_ENTITLEMENTS: Record<PlanKey, Entitlement[]> = {
  mpm_free: getEntitlementsForTier("free"),
  mpm_basic_monthly: getEntitlementsForTier("basic"),
  mpm_upgrade_monthly: getEntitlementsForTier("premium"),
  mpm_upgrade_beta_monthly: getEntitlementsForTier("premium"),
  mpm_ultimate_monthly: getEntitlementsForTier("ultimate"),
  mpm_family_base_monthly: getEntitlementsForTier("basic"),
  mpm_family_all_upgrade_monthly: getEntitlementsForTier("premium"),
  mpm_family_all_ultimate_monthly: getEntitlementsForTier("ultimate"),
  mpm_procare_monthly: [...PROCARE_ENTITLEMENTS],
};

export function getEntitlementsForPlan(planKey: PlanKey): Entitlement[] {
  return PLAN_ENTITLEMENTS[planKey] || [];
}

export function userHasEntitlement(
  entitlements: Entitlement[] | undefined,
  need: Entitlement
): boolean {
  return entitlements?.includes(need) || false;
}
