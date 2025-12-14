
import type { LookupKey } from "@/data/planSkus";

// List every "feature flag" your app cares about
export type FeatureKey =
  | "weeklyMealBoard"
  | "macroCalculator"
  | "basicPresets"
  | "biometrics"
  | "cravingCreator"
  | "fridgeRescue"
  | "restaurantGuide"
  | "kidsHub"
  | "holidayPlanner"
  | "clinicalHubs"
  | "glp1Hub"
  | "diabeticHub"
  | "crohnsIbsHub"
  | "shoppingListExport"
  | "shoppingDelivery"
  | "proCollaboration"
  | "labValues"
  | "advancedAnalytics"
  | "medicalDietHub"
  | "eliteAthleteMode"
  | "voiceCommands";

type PlanKey = "basic" | "premium" | "ultimate";

const PLAN_BY_LOOKUP: Record<LookupKey, PlanKey> = {
  mpm_basic_monthly: "basic",
  mpm_premium_monthly: "premium",
  mpm_premium_beta_monthly: "premium",
  mpm_ultimate_monthly: "ultimate",
  mpm_family_base_monthly: "premium",
  mpm_family_all_premium_monthly: "premium",
  mpm_family_all_ultimate_monthly: "ultimate",
  mpm_procare_monthly: "ultimate",
};

const FEATURE_ACCESS: Record<PlanKey, FeatureKey[]> = {
  basic: [
    "weeklyMealBoard",
    "macroCalculator",
    "basicPresets",
    "biometrics",
  ],
  premium: [
    "weeklyMealBoard",
    "macroCalculator",
    "basicPresets",
    "biometrics",
    "cravingCreator",
    "fridgeRescue",
    "restaurantGuide",
    "kidsHub",
    "holidayPlanner",
    "shoppingListExport",
    "clinicalHubs",
    "glp1Hub",
    "diabeticHub",
    "crohnsIbsHub",
  ],
  ultimate: [
    "weeklyMealBoard",
    "macroCalculator",
    "basicPresets",
    "biometrics",
    "cravingCreator",
    "fridgeRescue",
    "restaurantGuide",
    "kidsHub",
    "holidayPlanner",
    "shoppingListExport",
    "clinicalHubs",
    "glp1Hub",
    "diabeticHub",
    "crohnsIbsHub",
    "shoppingDelivery",
    "proCollaboration",
    "labValues",
    "advancedAnalytics",
    "medicalDietHub",
    "eliteAthleteMode",
    "voiceCommands",
  ],
};

export function getPlanKeyFromLookup(lookup?: LookupKey | null): PlanKey | null {
  if (!lookup) return null;
  return PLAN_BY_LOOKUP[lookup] ?? null;
}

export function hasFeatureAccess(lookup: LookupKey | null | undefined, feature: FeatureKey): boolean {
  const planKey = getPlanKeyFromLookup(lookup ?? undefined);
  if (!planKey) return false;
  return FEATURE_ACCESS[planKey].includes(feature);
}

export function getPlanFeatures(lookup: LookupKey | null | undefined): FeatureKey[] {
  const planKey = getPlanKeyFromLookup(lookup ?? undefined);
  if (!planKey) return [];
  return FEATURE_ACCESS[planKey];
}
