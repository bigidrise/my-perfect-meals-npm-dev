/**
 * FEATURE LOCKS - Production Stability System
 * 
 * This file controls which features are locked (protected from changes) vs unlocked.
 * 
 * WORKFLOW:
 * 1. To make changes to a feature, set its value to `false` (unlocked)
 * 2. Make your changes and test thoroughly
 * 3. Set the value back to `true` (locked)
 * 4. Push with ./push.sh "description"
 * 
 * When locked = true, the feature code should NOT be modified.
 * This is an honor-system lockdown enforced by developer discipline.
 */

export const FEATURE_LOCKS = {
  // ===== CORE NAVIGATION & HUBS =====
  dashboard: true,
  planner: true,
  lifestyleHub: true,
  proCare: true,

  // ===== LIFESTYLE HUB FEATURES =====
  socializingHub: true,
  alcoholHub: true,
  healthyKidsMeals: true,
  supplementHub: true,

  // ===== MEAL BUILDERS =====
  weeklyMealBoard: true,
  glp1Builder: true,
  diabeticBuilder: true,
  beachBodyBoard: true,
  proBuilders: true,
  antiInflammatoryBuilder: true,

  // ===== MEAL GENERATORS =====
  cravingCreator: true,        // PERMANENTLY LOCKED per user demand
  cravingDessertCreator: true,
  cravingPresets: true,
  fridgeRescue: true,          // PERMANENTLY LOCKED per user demand
  restaurantGuide: true,

  // ===== TRACKING & BIOMETRICS =====
  myBiometrics: true,
  macroCounter: true,
  sleepTracking: true,
  bodyComposition: true,

  // ===== PRO/CARE TEAM =====
  careTeam: true,
  proPortal: true,
  proClients: true,
  proClientDashboard: true,

  // ===== SHOPPING & EXTRAS =====
  shoppingList: true,
  getInspiration: true,
  tutorialHub: true,

  // ===== COPILOT SYSTEM =====
  copilotCore: true,           // Phase B LOCKED
  copilotSheet: true,          // Phase B LOCKED
  copilotCommandRegistry: true, // Phase B LOCKED

  // ===== ALCOHOL FEATURES =====
  winePairing: true,
  beerPairing: true,
  bourbonSpirits: true,
  mocktails: true,
  alcoholLog: true,
  mealPairingAI: true,
  weaningOffTool: true,
  leanAndSocial: true,
  smartSips: true,

  // ===== KIDS FEATURES =====
  kidsMealsHub: true,
  toddlersMealsHub: true,

  // ===== PHYSICIAN/MEDICAL FEATURES =====
  diabeticHub: true,
  glp1Hub: true,
  diabetesSupportPage: true,

  // ===== AUTH & ONBOARDING =====
  auth: true,
  onboarding: true,            // Now using onboarding-standalone.tsx
  pricing: true,
  welcome: true,

  // ===== SOCIAL FEATURES =====
  socialFindMeals: true,

  // ===== OTHER =====
  profile: true,
  familyInfo: true,
  founders: true,
  learn: true,
} as const satisfies Record<string, boolean>;

export type FeatureName = keyof typeof FEATURE_LOCKS;

/**
 * Check if a feature is currently locked
 */
export function isFeatureLocked(feature: FeatureName): boolean {
  return FEATURE_LOCKS[feature];
}

/**
 * Get list of all locked features
 */
export function getLockedFeatures(): FeatureName[] {
  return (Object.keys(FEATURE_LOCKS) as FeatureName[]).filter(
    (key) => FEATURE_LOCKS[key]
  );
}

/**
 * Get list of all unlocked features (for development)
 */
export function getUnlockedFeatures(): FeatureName[] {
  return (Object.keys(FEATURE_LOCKS) as FeatureName[]).filter(
    (key) => !FEATURE_LOCKS[key]
  );
}
