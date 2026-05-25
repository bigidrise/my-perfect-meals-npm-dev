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
      "Macro Calculator",
      "MacroScan — scan any nutrition label for an instant macro breakdown",
      "Ingredient Intelligence (3 scans/day — see protocol-aware safety alerts personalized to your profile)",
      "AI Fridge Rescue (3x per week)",
      "Biometrics Tracking",
      "Copilot Voice Guidance (limited)",
      "Daily Journal",
    ],
    entitlements: [
      "biometrics",
      "fridge_rescue",
    ],
  },
  basic: {
    tier: "basic",
    displayFeatures: [
      "Everything in Free",
      "Create a Dish — AI meal generator built around your full nutritional profile",
      "Recipe Scan — import any recipe from a photo, text, or image description and rebuild it around your macros and protocols",
      "Ingredient Intelligence (unlimited scans with full protocol personalization)",
      "AI Fridge Rescue (unlimited)",
      "Master Shopping List & Grocery Organization",
      "Weekly Meal Planner",
      "GLP-1 Hub and Meal Builder",
      "Diabetic Hub and Meal Builder",
      "Anti-Inflammatory Meal Builder",
      "SafeGuard Allergy Protection (2-layer enforcement)",
      "Multi-Language Voice Input & Translation",
    ],
    entitlements: [
      "smart_menu_builder",
      "weekly_meal_board",
      "shopping_list",
      "biometrics",
      "alcohol_hub",
      "hormones_women",
      "hormones_men",
      "fridge_rescue",
    ],
  },
  premium: {
    tier: "premium",
    displayFeatures: [
      "Everything in Essential",
      "Full Recipe Scan — camera, voice, text, and photo capture with 5-control customization (servings, adaptation style, protein level, prep style, cuisine) and preview before saving",
      "Craving Creator — healthy versions of any craving, built around your protocols",
      "Snack Creator",
      "Dessert Creator",
      "Beverage Creator",
      "Sushi Creator (rolls, nigiri, sashimi & bowls)",
      "Spirits & Wine Pairing Hub",
      "Restaurant Guide with protocol-aware ordering",
      "Fast Food Guide (smart ordering at McDonald's, Chick-fil-A, and more)",
      "Find Meals Near Me",
      "My Perfect Gatherings (AI-designed multi-course meals for holidays, camping, date nights, and more)",
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
      "Everything in Pro",
      "Clinical Lab Results Integration — connect your blood work and let the system adjust your meal protocols automatically based on your biomarkers",
      "Physicians Care Team / Pro Access",
      "Trainers Care Team / Pro Access",
      "Athlete Beverage Creator (performance drinks calibrated to training phases)",
      "Beach Body / Hard Body Meal Builder",
      "Competition Prep Builder",
      "Clinical Advisory System",
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
    "Create a Dish (AI meal generator)",
    "Recipe Scan — photo or text, rebuilt for your profile",
    "Ingredient Intelligence (unlimited)",
    "Copilot Voice Guidance",
    "Multi-Language Voice Input & Translation",
    "Unlimited AI Fridge Rescue",
    "Weekly Meal Planner",
    "Master Shopping List & Grocery Organization",
    "GLP-1 & Diabetic Support",
    "Anti-Inflammatory Builder",
    "Macro Calculator",
    "MacroScan",
    "Biometrics Tracking",
    "Spirits & Alcohol Hub",
    "SafeGuard Allergy Protection",
  ],
  premium: [
    "Everything in Essential, plus:",
    "Full Recipe Scan (camera, voice, photo — with 5-control customize screen)",
    "Craving Creator",
    "Snack Creator",
    "Dessert Creator",
    "Beverage Creator",
    "Sushi Creator",
    "Spirits & Wine Pairing Hub",
    "Restaurant Guide with protocol-aware ordering",
    "Fast Food Guide",
    "Find Meals Near Me",
    "My Perfect Gatherings",
    "Kids & Toddler Meals",
  ],
  ultimate: [
    "Everything in Pro, plus:",
    "Clinical Lab Results Integration (biomarker-aware meal protocols)",
    "Athlete Beverage Creator",
    "Physicians & Trainers Care Team Access",
    "Beach Body Meal Builder",
    "Competition Prep Builder",
    "Clinical Advisory System",
    "Priority Support",
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
  | "mpm_family_premium"
  | "mpm_family_all_upgrade_monthly"
  | "mpm_family_all_premium_monthly"
  | "mpm_family_all_ultimate_monthly"
  | "mpm_procare_monthly"
  | "mpm_procare_trainer_5"
  | "mpm_procare_trainer_10"
  | "mpm_procare_trainer_25"
  | "mpm_procare_trainer_50"
  | "mpm_procare_trainer_150";

export const LOOKUP_KEY_TO_TIER: Record<string, PlanTier> = {
  mpm_free: "free",
  mpm_basic_monthly: "basic",
  mpm_upgrade_monthly: "premium",
  mpm_upgrade_beta_monthly: "premium",
  mpm_premium_monthly: "premium",
  mpm_premium_beta_monthly: "premium",
  mpm_ultimate_monthly: "ultimate",
  mpm_family_base_monthly: "basic",
  mpm_family_premium: "premium",
  mpm_family_all_upgrade_monthly: "premium",
  mpm_family_all_premium_monthly: "premium",
  mpm_family_all_ultimate_monthly: "ultimate",
  mpm_procare_monthly: "ultimate",
  mpm_procare_trainer_5: "ultimate",
  mpm_procare_trainer_10: "ultimate",
  mpm_procare_trainer_25: "ultimate",
  mpm_procare_trainer_50: "ultimate",
  mpm_procare_trainer_150: "ultimate",
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

// ── Household / Family Plan Helpers ──────────────────────────────────────────

const HOUSEHOLD_PLAN_KEYS = new Set([
  "mpm_family_base",
  "mpm_family_base_monthly",
  "mpm_family_premium",
  "mpm_family_all_upgrade_monthly",
  "mpm_family_all_premium_monthly",
  "mpm_family_ultimate",
  "mpm_family_all_ultimate_monthly",
]);

export function isHouseholdPlan(lookupKey: string | null | undefined): boolean {
  if (!lookupKey) return false;
  return HOUSEHOLD_PLAN_KEYS.has(lookupKey);
}

export function getMaxHouseholdProfiles(lookupKey: string | null | undefined): number {
  return isHouseholdPlan(lookupKey) ? 4 : 1;
}
