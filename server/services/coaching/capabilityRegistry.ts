/**
 * MPM Capability Registry — Phase 1 (Coaching Intelligence Layer)
 *
 * Canonical list of every MPM feature the coaching engine may recommend.
 *
 * DESIGN RULES:
 * 1. This file is the single source of truth. No hardcoded feature lists in adapters.
 * 2. Every feature has applicableSituations so the engine knows WHEN to recommend it,
 *    not just that it exists.
 * 3. eligibilityNote describes who can access it — prevents recommending a clinical
 *    feature to a standard user.
 * 4. recommendable: false means the engine knows it exists but must NOT suggest it
 *    (e.g., admin or clinical-only tools).
 * 5. scope drives which specializations receive which features. The engine filters
 *    by scope before injecting the registry into any prompt.
 *
 * Adding a new feature: add one entry here. No other file changes needed.
 */

export type CapabilityScope =
  | "all"            // any authenticated user
  | "performance"    // user with performance_mode_enabled
  | "glp1"           // user with glp1 in specialty_conditions
  | "pregnancy"      // pregnancy coach specialization
  | "anti_inflam"    // user with anti-inflammatory overlay
  | "diabetic"       // user with diabetic overlay
  | "procare"        // ProCare client
  | "clinical";      // clinical overlay (any specialty condition)

export interface MPMCapability {
  /** Stable machine-readable identifier — never changes */
  id: string;
  /** Human-readable label shown in coaching redirects */
  label: string;
  /**
   * One sentence describing what this feature solves for the USER.
   * Written from the user's perspective, not the system's.
   * The engine uses this when deciding whether to recommend the feature.
   */
  description: string;
  /** Client-side route the engine redirects to */
  route: string;
  /**
   * Which coaching situations make this feature relevant.
   * The engine uses these to decide whether to recommend the feature,
   * not just list it. Kept as strings so patterns can reference them.
   */
  applicableSituations: string[];
  /**
   * Which user populations have access to this feature.
   * "all" means any authenticated user regardless of plan or overlay.
   */
  scopes: CapabilityScope[];
  /**
   * Optional brief note about eligibility constraints.
   * Only include when access is non-obvious (e.g., requires a paid tier).
   */
  eligibilityNote?: string;
  /**
   * Whether the coaching engine may actively recommend this feature.
   * false = engine knows it exists for context but should not direct users there.
   */
  recommendable: boolean;
}

export const MPM_CAPABILITIES: MPMCapability[] = [
  // ── Meal Creation ──────────────────────────────────────────────────────────
  {
    id: "meal_builder",
    label: "Meal Builder",
    description: "Build a custom meal that precisely fits today's remaining macro targets.",
    route: "/meals",
    applicableSituations: [
      "protein_gap",
      "calorie_gap",
      "macro_shortfall",
      "meal_planning",
      "wants_new_meal",
      "general_inquiry",
    ],
    scopes: ["all"],
    recommendable: true,
  },
  {
    id: "fridge_rescue",
    label: "Fridge Rescue",
    description: "Build a meal from whatever ingredients are already available — no grocery trip needed.",
    route: "/fridge-rescue",
    applicableSituations: [
      "no_grocery",
      "eating_at_home",
      "has_ingredients",
      "spontaneous_meal",
      "meal_planning",
    ],
    scopes: ["all"],
    recommendable: true,
  },
  {
    id: "craving_creator",
    label: "Craving Creator",
    description: "Satisfy a specific food craving in a way that fits the nutrition plan.",
    route: "/craving-creator-landing",
    applicableSituations: [
      "cravings",
      "hedonic_craving",
      "wants_specific_food",
      "off_plan_risk",
      "emotional_eating_risk",
    ],
    scopes: ["all"],
    recommendable: true,
  },
  {
    id: "dessert_creator",
    label: "Dessert Creator",
    description: "Build a dessert that fits the nutrition plan — satisfies sweet cravings without derailing macros.",
    route: "/craving-desserts",
    applicableSituations: [
      "cravings",
      "sweet_craving",
      "hedonic_craving",
    ],
    scopes: ["all"],
    recommendable: true,
  },

  // ── Beverages ──────────────────────────────────────────────────────────────
  {
    id: "beverage_creator",
    label: "Beverage Creator",
    description: "Build a protein shake, smoothie, or other drink that closes a macro gap without requiring another full meal.",
    route: "/lifestyle/beverage-creator",
    applicableSituations: [
      "protein_gap",
      "liquid_nutrition",
      "appetite_low",
      "protein_shortfall_during_dieting",
      "calorie_gap",
      "convenience",
    ],
    scopes: ["all"],
    recommendable: true,
  },

  // ── Eating Out ─────────────────────────────────────────────────────────────
  {
    id: "restaurant_guide",
    label: "Restaurant Guide",
    description: "Find on-plan meal options at restaurants near you or ones you visit regularly.",
    route: "/social-hub/restaurant-guide",
    applicableSituations: [
      "restaurant_eating",
      "eating_out",
      "travel",
      "social_eating",
      "convenience",
    ],
    scopes: ["all"],
    recommendable: true,
  },
  {
    id: "find_meals_near_me",
    label: "Find Meals Near Me",
    description: "Discover nearby restaurants and menu items that fit the current nutrition plan.",
    route: "/social-hub/restaurant-finder",
    applicableSituations: [
      "restaurant_eating",
      "eating_out",
      "travel",
      "convenience",
    ],
    scopes: ["all"],
    recommendable: true,
  },

  // ── Product Scanning ───────────────────────────────────────────────────────
  {
    id: "smart_scan",
    label: "Product Intelligence",
    description: "Scan or search any food or supplement product to evaluate it against the current nutrition goals and health profile.",
    route: "/smart-scan",
    applicableSituations: [
      "supplement_question",
      "product_evaluation",
      "label_reading",
      "processed_food",
    ],
    scopes: ["all"],
    recommendable: true,
  },

  // ── Check-In ──────────────────────────────────────────────────────────────
  {
    id: "daily_checkin",
    label: "Daily Check-In",
    description: "Log today's hunger, energy, mood, and cravings so the coach has current evidence to reason from.",
    route: "/check-in",
    applicableSituations: [
      "low_data",
      "missing_checkin",
      "coach_needs_info",
      "general_inquiry",
    ],
    scopes: ["all"],
    recommendable: true,
  },

  // ── Macro Logging ──────────────────────────────────────────────────────────
  {
    id: "macro_logger",
    label: "Macro Logger",
    description: "Log meals and macros so the coach can compare actual intake against the nutrition prescription.",
    route: "/macros",
    applicableSituations: [
      "low_data",
      "missing_meals",
      "coach_needs_info",
      "general_inquiry",
    ],
    scopes: ["all"],
    recommendable: true,
  },

  // ── Performance ────────────────────────────────────────────────────────────
  {
    id: "performance_hub",
    label: "Performance Hub",
    description: "View and adjust sport-specific fueling — training day vs. rest day targets, competition nutrition, and energy system strategy.",
    route: "/performance",
    applicableSituations: [
      "training_nutrition",
      "sport_fueling",
      "pre_workout",
      "post_workout",
      "competition_prep",
      "performance_question",
    ],
    scopes: ["performance"],
    eligibilityNote: "Available when Performance Mode is active.",
    recommendable: true,
  },
  {
    id: "performance_competition_builder",
    label: "Competition Nutrition Builder",
    description: "Build a race-day or competition-day nutrition plan around specific event timing and demands.",
    route: "/performance-competition-builder",
    applicableSituations: [
      "competition_prep",
      "race_day",
      "event_nutrition",
    ],
    scopes: ["performance"],
    eligibilityNote: "Available when Performance Mode is active.",
    recommendable: true,
  },

  // ── GLP-1 ──────────────────────────────────────────────────────────────────
  {
    id: "glp1_hub",
    label: "GLP-1 Hub",
    description: "Track GLP-1 medication doses, check-ins, and side-effect patterns alongside nutrition.",
    route: "/glp1-hub",
    applicableSituations: [
      "glp1_question",
      "medication_side_effects",
      "appetite_suppression",
      "nausea",
      "dose_timing",
    ],
    scopes: ["glp1"],
    eligibilityNote: "Available for users enrolled in GLP-1 protocol.",
    recommendable: true,
  },
  {
    id: "glp1_meal_builder",
    label: "GLP-1 Meal Builder",
    description: "Build GLP-1-optimized meals — high protein, high nutrient density, easy on the stomach.",
    route: "/glp1-meal-builder",
    applicableSituations: [
      "glp1_question",
      "appetite_suppression",
      "nausea",
      "protein_gap",
      "small_volume_eating",
    ],
    scopes: ["glp1"],
    eligibilityNote: "Available for users enrolled in GLP-1 protocol.",
    recommendable: true,
  },

  // ── Anti-Inflammatory ──────────────────────────────────────────────────────
  {
    id: "anti_inflammatory_builder",
    label: "Anti-Inflammatory Meal Builder",
    description: "Build meals optimized to reduce inflammation — relevant for joint pain, autoimmune conditions, or recovery.",
    route: "/anti-inflammatory-menu-builder",
    applicableSituations: [
      "joint_pain",
      "inflammation",
      "recovery",
      "autoimmune",
      "anti_inflammatory_overlay",
    ],
    scopes: ["anti_inflam"],
    eligibilityNote: "Available when Anti-Inflammatory overlay is active.",
    recommendable: true,
  },

  // ── Pregnancy ─────────────────────────────────────────────────────────────
  {
    id: "pregnancy_coach",
    label: "Pregnancy Nutrition Coach",
    description: "Trimester-specific nutrition coaching, supplement guidance, and pregnancy-safe meal planning.",
    route: "/pregnancy-coach",
    applicableSituations: [
      "pregnancy_nutrition",
      "trimester_question",
      "prenatal_supplements",
      "nausea",
      "food_safety",
    ],
    scopes: ["pregnancy"],
    eligibilityNote: "Available when Pregnancy Support overlay is active.",
    recommendable: true,
  },
];

/**
 * Returns the capability list filtered for a given user's active scopes.
 * This is what the coaching engine injects into prompts — never the full registry.
 *
 * @param activeScopes - which scopes the user qualifies for (always includes "all")
 * @param onlyRecommendable - if true, strips non-recommendable entries
 */
export function getCapabilitiesForUser(
  activeScopes: CapabilityScope[],
  onlyRecommendable = true
): MPMCapability[] {
  const scopeSet = new Set(["all", ...activeScopes]);
  return MPM_CAPABILITIES.filter((cap) => {
    const scopeMatch = cap.scopes.some((s) => scopeSet.has(s));
    const recMatch = !onlyRecommendable || cap.recommendable;
    return scopeMatch && recMatch;
  });
}

/**
 * Converts a capability list to the condensed format the engine injects into prompts.
 * Keeps only what the LLM needs — no internal metadata.
 */
export function formatCapabilitiesForPrompt(
  capabilities: MPMCapability[]
): Array<{ id: string; label: string; route: string; description: string; applicableSituations: string[] }> {
  return capabilities.map((cap) => ({
    id: cap.id,
    label: cap.label,
    route: cap.route,
    description: cap.description,
    applicableSituations: cap.applicableSituations,
  }));
}
