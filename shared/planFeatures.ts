export type PlanTier = "free" | "basic" | "premium" | "ultimate";

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

export interface PlanDefinition {
  tier: PlanTier;
  displayFeatures: string[];
  entitlements: Entitlement[];
}

export const PLAN_FEATURES: Record<PlanTier, PlanDefinition> = {
  free: {
    tier: "free",
    displayFeatures: [
      "Copilot Voice Guidance",
      "Biometrics Tracking",
      "MacroScan",
      "Spirits & Alcohol Hub",
      "Daily Health Journal",
      "Supplement Hub",
      "View Saved Meals",
      "Profile & Settings",
    ],
    entitlements: [
      "shopping_list",
      "biometrics",
    ],
  },
  basic: {
    tier: "basic",
    displayFeatures: [
      "Everything in Free",
      "Copilot Voice Guidance",
      "Multi-Language Voice Input & Translation",
      "Weekly Meal Builder",
      "GLP-1 Hub and Meal Builder",
      "Diabetic Hub and Meal Builder",
      "Anti-Inflammatory Meal Builder",
      "SafeGuard Allergy Protection",
      "Master Shopping List",
    ],
    entitlements: [
      "smart_menu_builder",
      "weekly_meal_board",
      "shopping_list",
      "biometrics",
      "alcohol_hub",
      "hormones_women",
      "hormones_men",
    ],
  },
  premium: {
    tier: "premium",
    displayFeatures: [
      "Everything in Basic",
      "Chef's Kitchen Studio (create & customize meals)",
      "Craving Presets (healthy AI-created favorites)",
      "Craving Creator plus Studio (healthy versions of your favorite cravings)",
      "Dessert Creator plus Studio (healthy versions of your favorite desserts)",
      "Fridge Rescue plus Studio (turn what you have into meals)",
      "Restaurant Guide",
      "Find Meals Near Me",
    ],
    entitlements: [
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
  },
  ultimate: {
    tier: "ultimate",
    displayFeatures: [
      "Everything in Premium",
      "Physicians Care Team / Pro Access",
      "Trainers Care Team / Pro Access",
      "Beach Body / Hard Body Meal Builder",
    ],
    entitlements: [
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
  },
};

export const IOS_DISPLAY_FEATURES: Record<string, string[]> = {
  basic: [
    "Copilot Voice Guidance",
    "Multi-Language Voice Input & Translation",
    "Weekly Meal Board",
    "GLP-1 & Diabetic Support",
    "Anti-Inflammatory Builder",
    "Daily Macro Calculator",
    "Master Shopping Lists",
    "Biometrics Tracking",
    "Spirits & Alcohol Hub",
    "SafetyGuard Allergy Protection",
  ],
  premium: [
    "Everything in Basic, plus:",
    "Chef's Kitchen Studio",
    "Craving Creator / Studio",
    "Craving Presets",
    "Dessert Creator / Studio",
    "Fridge Rescue / Studio",
    "Restaurant Guide",
    "Find Meals Near Me",
    "Spirits & Alcohol Hub",
    "Kids & Toddler Meals",
  ],
  ultimate: [
    "Everything in Premium, plus:",
    "Pro Care Team Access",
    "Beach Body Meal Builder",
    "Competition Prep Builder",
    "Lab Metrics Integration",
    "Priority Support",
    "Coach Workspace",
    "Clinical Advisory System",
  ],
};

export type PlanLookupKey =
  | "mpm_free"
  | "mpm_basic_monthly"
  | "mpm_upgrade_monthly"
  | "mpm_upgrade_beta_monthly"
  | "mpm_premium_monthly"
  | "mpm_premium_beta_monthly"
  | "mpm_ultimate_monthly"
  | "mpm_family_base_monthly"
  | "mpm_family_all_upgrade_monthly"
  | "mpm_family_all_premium_monthly"
  | "mpm_family_all_ultimate_monthly"
  | "mpm_procare_monthly";

export const LOOKUP_KEY_TO_TIER: Record<string, PlanTier> = {
  mpm_free: "free",
  mpm_basic_monthly: "basic",
  mpm_upgrade_monthly: "premium",
  mpm_upgrade_beta_monthly: "premium",
  mpm_premium_monthly: "premium",
  mpm_premium_beta_monthly: "premium",
  mpm_ultimate_monthly: "ultimate",
  mpm_family_base_monthly: "basic",
  mpm_family_all_upgrade_monthly: "premium",
  mpm_family_all_premium_monthly: "premium",
  mpm_family_all_ultimate_monthly: "ultimate",
  mpm_procare_monthly: "ultimate",
};

export const TRIAL_UNLOCKS_TIER: PlanTier = "ultimate";

export function getTierForLookupKey(lookupKey: string | null | undefined): PlanTier {
  if (!lookupKey) return "free";
  return LOOKUP_KEY_TO_TIER[lookupKey] ?? "free";
}

export function getEntitlementsForTier(tier: PlanTier): Entitlement[] {
  return PLAN_FEATURES[tier].entitlements;
}

export function getDisplayFeaturesForTier(tier: PlanTier): string[] {
  return PLAN_FEATURES[tier].displayFeatures;
}

export function tierIncludesEntitlement(tier: PlanTier, entitlement: Entitlement): boolean {
  return PLAN_FEATURES[tier].entitlements.includes(entitlement);
}

export function getMinTierForEntitlement(entitlement: Entitlement): PlanTier {
  const tierOrder: PlanTier[] = ["free", "basic", "premium", "ultimate"];
  for (const tier of tierOrder) {
    if (PLAN_FEATURES[tier].entitlements.includes(entitlement)) {
      return tier;
    }
  }
  return "ultimate";
}

export const PROCARE_ENTITLEMENTS: Entitlement[] = ["procare", "care_team", "lab_metrics"];
