export type PlanTier = "free" | "basic" | "premium" | "ultimate";

export type Entitlement =
  | "smart_menu_builder"
  | "weekly_meal_board"
  | "shopping_list"
  | "saved_meals"
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
  | "procare"
  | "pregnancy"
  | "getaway"
  | "grocery_coach"
  | "performance_nutrition";

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
      "AI Fridge Rescue",
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
      "Recipe Scan — Import any recipe from a photo, text, or image description and instantly rebuild it around your dietary needs, nutrition goals, and active protocols.",
      "Smart Scan — Analyze ingredients, detect safety concerns, explain food quality, and recommend healthier alternatives based on your nutrition profile.",
      "Master Shopping List & Grocery Organization",
      "Saved Meals & Favorites — save any AI-generated meal to your personal collection",
      "Weekly Meal Planner",
      "Snack Creator (built into every Meal Builder)",
      "Metabolic Medication Hub and Meal Builder",
      "Diabetic Hub and Meal Builder",
      "Anti-Inflammatory Meal Builder",
      "SafeGuard Allergy Protection (2-layer enforcement)",
      "Multi-Language Voice Input & Translation",
    ],
    entitlements: [
      "smart_menu_builder",
      "weekly_meal_board",
      "shopping_list",
      "saved_meals",
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
      "Craving Creator — healthy versions of any craving, built around your protocols",
      "Dessert Creator",
      "Beverage Creator",
      "Sushi Creator (rolls, nigiri, sashimi & bowls)",
      "Spirits & Wine Pairing Hub",
      "Restaurant Guide with protocol-aware ordering",
      "Fast Food Guide (smart ordering at McDonald's, Chick-fil-A, and more)",
      "Find Meals Near Me",
      "My Perfect Gatherings — AI meal planning for holidays, parties, camping, date nights, tailgates, and special occasions.",
      "My Perfect Pets — AI-generated nutrition and meal plans for your pets",
      "My Perfect Beginning — age-appropriate nutrition guidance and meal support for children from infancy through the early years.",
      "Grocery Store Coach — AI grocery advisor personalized to your full nutrition protocol",
      "Athlete Beverage Creator — performance drinks calibrated to your training phase, sport, and recovery goals.",
      "My Perfect Getaway™ — stay on track anywhere: theme parks, airports, resorts, and cruises with venue-specific, protocol-aware dining recommendations.",
      "Business Center — access partner programs, referral and marketing tools, organization setup, team management, and business growth resources.",
    ],
    entitlements: [
      "smart_menu_builder",
      "weekly_meal_board",
      "shopping_list",
      "saved_meals",
      "biometrics",
      "alcohol_hub",
      "hormones_women",
      "hormones_men",
      "restaurant_guide",
      "fridge_rescue",
      "potluck_planner",
      "holiday_feast",
      "learn_cook",
      "grocery_coach",
      "getaway",
    ],
  },
  ultimate: {
    tier: "ultimate",
    displayFeatures: [
      "Everything in Pro",
      "Clinical Lab Results Integration — connect your blood work and let the system adjust your meal protocols automatically based on your biomarkers",
      "Care Team Access — Connect with physicians, registered dietitians, nutrition coaches, and trainers inside My Perfect Meals for collaborative clinical guidance.",
      "Hormone Biomarker Integration — Track hormone values and incorporate them into your Clinical nutrition profile and personalized guidance.",
      "Performance Nutrition Builder — sport-specific fueling protocols, starch cycling, and competition prep meal builder",
      "Clinical Advisory System — AI that continuously interprets your health data, medications, biomarkers, and nutrition history to deliver personalized clinical guidance.",
      "My Perfect Pregnancy™ — trimester-aware nutrition, Pregnancy Coach, food safety guidance (mercury, listeria, raw foods), and pregnancy-support meal generation",
      "Therapeutic Nutrition Intelligence — hormone, peptide, and medication-aware meal generation that adapts to your active therapies and recovery goals",
    ],
    entitlements: [
      "smart_menu_builder",
      "weekly_meal_board",
      "shopping_list",
      "saved_meals",
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
      "pregnancy",
      "getaway",
      "grocery_coach",
      "performance_nutrition",
    ],
  },
};

export const IOS_DISPLAY_FEATURES: Record<string, string[]> = {
  basic: [
    "Create a Dish (AI meal generator)",
    "Recipe Scan — Import any recipe from a photo, text, or image description and instantly rebuild it around your dietary needs, nutrition goals, and active protocols.",
    "Smart Scan — Analyze ingredients, detect safety concerns, explain food quality, and recommend healthier alternatives based on your nutrition profile.",
    "Copilot Voice Guidance",
    "Multi-Language Voice Input & Translation",
    "Weekly Meal Planner",
    "Snack Creator (built into every Meal Builder)",
    "Saved Meals & Favorites",
    "Master Shopping List & Grocery Organization",
    "Metabolic Medication & Diabetic Support",
    "Anti-Inflammatory Builder",
    "Macro Calculator",
    "MacroScan",
    "Biometrics Tracking",
    "Spirits & Alcohol Hub",
    "SafeGuard Allergy Protection",
  ],
  premium: [
    "Everything in Essential, plus:",
    "Craving Creator",
    "Dessert Creator",
    "Beverage Creator",
    "Sushi Creator",
    "Spirits & Wine Pairing Hub",
    "Restaurant Guide with protocol-aware ordering",
    "Fast Food Guide",
    "Find Meals Near Me",
    "My Perfect Gatherings (incl. Great Outdoors)",
    "Kids & Toddler Meals",
    "My Perfect Pets",
    "Grocery Store Coach (AI grocery advisor, protocol-aware)",
    "Athlete Beverage Creator — performance drinks calibrated to your training phase, sport, and recovery goals.",
    "My Perfect Getaway™ (stay on track at theme parks, airports, resorts & cruises)",
    "Business Center (partner programs, referral tools, organization setup & team management)",
  ],
  ultimate: [
    "Everything in Pro, plus:",
    "Clinical Lab Results Integration (biomarker-aware meal protocols)",
    "Physicians & Trainers Care Team Access",
    "Hormone Biomarker Integration — Track hormone values and incorporate them into your Clinical nutrition profile.",
    "Performance Nutrition Builder (sport fueling protocols + starch cycling)",
    "Clinical Advisory System — AI that continuously interprets your health data, medications, biomarkers, and nutrition history to deliver personalized clinical guidance.",
    "My Perfect Pregnancy™ (trimester nutrition + Pregnancy Coach)",
    "Therapeutic Nutrition Intelligence (hormone, peptide & therapy-aware meal generation)",
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
  // Legacy / _monthly-suffixed keys (kept for backward compatibility)
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
  // Frontend short keys — written to DB by checkout.session.completed webhook via metadata.sku
  mpm_basic: "basic",
  mpm_premium: "premium",
  mpm_ultimate: "ultimate",
  mpm_family_base: "basic",
  mpm_family_ultimate: "ultimate",
  mpm_trainer_5: "ultimate",
  mpm_trainer_10: "ultimate",
  mpm_trainer_25: "ultimate",
  mpm_trainer_50: "ultimate",
  mpm_physician_50: "ultimate",
  mpm_physician_150: "ultimate",
  mpm_guidance: "premium",
  // Legacy price-ID-style keys (kept for backward compatibility)
  mpm_basic_plan_999: "basic",
  mpm_premium_plan_1999: "premium",
  mpm_ultimate_plan_2999: "ultimate",
  // Clinical Business — same Clinical (ultimate) access, business billing type
  clinical_business_monthly: "ultimate",
  // Internal / contributor / special-access — full Clinical access, no Stripe subscription
  mpm_contributor: "ultimate",
  mpm_special_access: "ultimate",
};

/**
 * Every plan key that grants PAID_FULL access on the server.
 * Derived directly from LOOKUP_KEY_TO_TIER so the two lists can never drift.
 * Import this in server/lib/accessTier.ts instead of maintaining a separate array.
 */
export const PAID_PLAN_KEYS: ReadonlySet<string> = new Set(
  Object.entries(LOOKUP_KEY_TO_TIER)
    .filter(([, tier]) => tier !== "free")
    .map(([key]) => key),
);

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

/**
 * All planLookupKey values that represent an active ProCare subscription.
 * Used by requireProCareAccess and the profile endpoint to compute proCareEligible.
 * Rule: certification completion is NOT a substitute for subscription entitlement.
 */
export const PROCARE_PLAN_KEYS: ReadonlySet<string> = new Set([
  // Full canonical keys
  "mpm_procare_monthly",
  "mpm_procare_trainer_5",
  "mpm_procare_trainer_10",
  "mpm_procare_trainer_25",
  "mpm_procare_trainer_50",
  "mpm_procare_trainer_150",
  // Short keys written by Stripe webhook via metadata.sku
  "mpm_trainer_5",
  "mpm_trainer_10",
  "mpm_trainer_25",
  "mpm_trainer_50",
  "mpm_physician_50",
  "mpm_physician_150",
]);

export function isProCarePlanKey(lookupKey: string | null | undefined): boolean {
  if (!lookupKey) return false;
  return PROCARE_PLAN_KEYS.has(lookupKey);
}

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
