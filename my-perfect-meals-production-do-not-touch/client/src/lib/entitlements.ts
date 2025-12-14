/**
 * Frontend entitlements utilities for feature gating
 */

import { LookupKey } from "@/data/planSkus";

export type Entitlement =
  | "smart_menu_builder"
  | "weekly_meal_board"
  | "shopping_list"
  | "biometrics"
  | "alcohol_hub"
  | "hormones_women"
  | "hormones_men"
  | "restaurant_guide"
  | "fridge_rescue"
  | "potluck_planner"
  | "holiday_feast"
  | "learn_cook"
  | "lab_metrics"
  | "care_team"
  | "procare";

export interface UserWithEntitlements {
  id: string;
  entitlements?: string[];
  planLookupKey?: string | null;
  [key: string]: any;
}

/**
 * Check if a user has a specific feature entitlement
 */
export function hasFeature(
  user: UserWithEntitlements | null | undefined,
  feature: Entitlement
): boolean {
  if (!user) return false;
  return user.entitlements?.includes(feature) || false;
}

/**
 * Get the upgrade plan needed for a feature
 * Returns the lookup_key of the cheapest plan that includes the feature
 */
export function getUpgradePlanForFeature(feature: Entitlement): LookupKey {
  // Basic features (no upgrade needed - included in free/basic)
  const basicFeatures: Entitlement[] = [
    "smart_menu_builder",
    "weekly_meal_board",
    "shopping_list",
    "biometrics",
    "alcohol_hub",
    "hormones_women",
    "hormones_men",
  ];

  // Premium features
  const premiumFeatures: Entitlement[] = [
    "restaurant_guide",
    "fridge_rescue",
    "potluck_planner",
    "holiday_feast",
    "learn_cook",
  ];

  // Ultimate features
  const ultimateFeatures: Entitlement[] = ["lab_metrics", "care_team"];

  // ProCare exclusive
  if (feature === "procare") {
    return "mpm_procare_monthly";
  }

  if (ultimateFeatures.includes(feature)) {
    return "mpm_ultimate_monthly";
  }

  if (premiumFeatures.includes(feature)) {
    return "mpm_premium_monthly";
  }

  return "mpm_basic_monthly";
}

/**
 * Get display name for a plan lookup key
 */
export function getPlanDisplayName(lookupKey: string | null | undefined): string {
  const names: Record<string, string> = {
    mpm_basic_monthly: "Basic",
    mpm_upgrade_monthly: "Premium",
    mpm_upgrade_beta_monthly: "Premium (Beta)",
    mpm_ultimate_monthly: "Ultimate",
    mpm_family_base_monthly: "Family Base",
    mpm_family_all_upgrade_monthly: "Family All-Premium",
    mpm_family_all_ultimate_monthly: "Family All-Ultimate",
    mpm_procare_monthly: "ProCare",
  };
  
  return lookupKey ? names[lookupKey] || lookupKey : "Free";
}
