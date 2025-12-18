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

export type PlanKey =
  | "mpm_basic_monthly"
  | "mpm_upgrade_monthly"
  | "mpm_upgrade_beta_monthly"
  | "mpm_ultimate_monthly"
  | "mpm_family_base_monthly"
  | "mpm_family_all_upgrade_monthly"
  | "mpm_family_all_ultimate_monthly"
  | "mpm_procare_monthly";

export const PLAN_ENTITLEMENTS: Record<PlanKey, Entitlement[]> = {
  mpm_basic_monthly: [
    "smart_menu_builder",
    "weekly_meal_board",
    "shopping_list",
    "biometrics",
    "alcohol_hub",
    "hormones_women",
    "hormones_men",
  ],
  // Premium Plan (UI shows "Premium", lookup_key stays mpm_upgrade_monthly)
  mpm_upgrade_monthly: [
    "smart_menu_builder",
    "weekly_meal_board",
    "shopping_list",
    "biometrics",
    "alcohol_hub",
    "hormones_women",
    "hormones_men",
    "restaurant_guide",
    "fridge_rescue",
    "potluck_planner",
    "holiday_feast",
    "learn_cook",
  ],
  // Beta lock = same features as Upgrade (price differs)
  mpm_upgrade_beta_monthly: [
    "smart_menu_builder",
    "weekly_meal_board",
    "shopping_list",
    "biometrics",
    "alcohol_hub",
    "hormones_women",
    "hormones_men",
    "restaurant_guide",
    "fridge_rescue",
    "potluck_planner",
    "holiday_feast",
    "learn_cook",
  ],
  mpm_ultimate_monthly: [
    "smart_menu_builder",
    "weekly_meal_board",
    "shopping_list",
    "biometrics",
    "alcohol_hub",
    "hormones_women",
    "hormones_men",
    "restaurant_guide",
    "fridge_rescue",
    "potluck_planner",
    "holiday_feast",
    "learn_cook",
    "lab_metrics",
    "care_team",
  ],
  // Family bundles (seat-based; same features as the tier indicated)
  mpm_family_base_monthly: [
    // 4 seats of Basic
    "smart_menu_builder",
    "weekly_meal_board",
    "shopping_list",
    "biometrics",
    "alcohol_hub",
    "hormones_women",
    "hormones_men",
  ],
  mpm_family_all_upgrade_monthly: [
    // 4 seats of Upgrade
    "smart_menu_builder",
    "weekly_meal_board",
    "shopping_list",
    "biometrics",
    "alcohol_hub",
    "hormones_women",
    "hormones_men",
    "restaurant_guide",
    "fridge_rescue",
    "potluck_planner",
    "holiday_feast",
    "learn_cook",
  ],
  mpm_family_all_ultimate_monthly: [
    // 4 seats of Ultimate
    "smart_menu_builder",
    "weekly_meal_board",
    "shopping_list",
    "biometrics",
    "alcohol_hub",
    "hormones_women",
    "hormones_men",
    "restaurant_guide",
    "fridge_rescue",
    "potluck_planner",
    "holiday_feast",
    "learn_cook",
    "lab_metrics",
    "care_team",
  ],
  mpm_procare_monthly: ["procare", "care_team", "lab_metrics"], // Pro/coach tools
};

/**
 * Get entitlements for a given plan lookup key
 */
export function getEntitlementsForPlan(planKey: PlanKey): Entitlement[] {
  return PLAN_ENTITLEMENTS[planKey] || [];
}

/**
 * Check if a user has a specific entitlement
 */
export function userHasEntitlement(
  entitlements: Entitlement[] | undefined,
  need: Entitlement
): boolean {
  return entitlements?.includes(need) || false;
}
