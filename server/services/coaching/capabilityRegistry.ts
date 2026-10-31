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
 * Legacy registry entries do not authorize Chef buttons. Development navigation
 * remains restricted to the independently reviewed COACH_DESTINATIONS allowlist.
 */

import { COACH_DESTINATIONS, type CoachDestinationId } from "../../../shared/coaching/navigation";

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

/** Knowledge only, never an extension of the approved destination allowlist. */
export const CORNER_UNSUPPORTED_FEATURES = [
  { id: "meal_planning", label: "Meal planning and My Perfect Menu",
    description: "Builders hold dated meal boards; My Perfect Menu provides category ideas and hands selected ideas to the subject's effective creator/builder. Requires the correct member, date, category and builder context. Chef has no approved navigation or request-transfer contract for these workflows. Explain that limitation without substituting Create a Dish or bypassing a builder hub." },
  { id: "clinical_hubs", label: "Clinical and nutrition protocol hubs",
    description: "Diabetes, GLP-1, anti-inflammatory and professional clinical workflows use their own authorized hub, profile, consent, protocol and builder context. Chef cannot activate support, read unauthorized clinical evidence, invent medical targets or deep-link directly into a clinical builder. These are not approved Chef destinations." },
  { id: "performance_hub", label: "Performance Hub",
    description: "Sport-specific training context and nutrition setup, distinct from the approved Athlete Beverage Creator. No approved Chef hub navigation contract. Explain ordinary nutrition questions conversationally; do not substitute a drink creator for a performance plan." },
];

/** Development-only concierge extension; other coaches and Production stay unchanged. */
export function getCornerCapabilities(activeScopes: CapabilityScope[]): MPMCapability[] {
  const existing = getCapabilitiesForUser(activeScopes, true);
  if (process.env.NODE_ENV !== "development") return existing;
  const descriptions: Record<CoachDestinationId, string> = {
    sushi_creator: "Prepare sushi: rolls, nigiri, and other sushi. Requires preparation intent or an explicit Sushi Creator request; wanting to eat sushi alone may need making-versus-going-out clarification. Sushi education stays conversational.",
    craving_creator: "Prepare a SMALL savory craving, snack or smaller meal described by what the member craves, using its free-text craving and optional category. Appropriate for a small savory preparation request even when the exact finished dish is not selected. Not a default for light, flavorful, spicy, hunger or indecision alone, full chosen dishes, restaurant food, desserts, sushi or drinks.",
    dessert_creator: "Prepare a dessert, including a small dessert or a whole cake, pie, or pan of brownies. Requires dessert preparation intent or an explicit Dessert Creator request. Sweet preference alone is insufficient.",
    beverage_creator: "Create regular smoothies, shakes, drinks, cocktails, or mocktails from free-text drink description or category/flavor selections. Use for regular beverage preparation, not workout-specific drinks, hydration targets, or nutrition questions about drinks.",
    athlete_beverage_creator: "Create pre-workout drinks, post-workout recovery shakes, or sports beverages with a performance goal, via description or goal/drink/flavor selections. Use for actual workout beverage preparation, not an exercise nutrition explanation, general meal, ordinary cocktail or a fluid prescription.",
    hydration_center: "Get hydration education and support. Never invent fluid or electrolyte targets.",
    restaurant_guide: "Help choose what to order at a restaurant the member has already chosen. Do not use for finding a restaurant.",
    find_meals_near_me: "Discover somewhere to eat when the member wants to find a restaurant or has not chosen one. Consider their food preferences, location and budget when relevant; do not use for ordering at an already-selected restaurant.",
    my_perfect_buffet: "Help choose food at a buffet.",
    my_perfect_getaway: "Help with food while traveling, at an airport, theme park, or Disneyland.",
    my_perfect_gatherings: "Plan food for a gathering or dinner party.",
    fridge_rescue: "Help make food from ingredients the member wants to use, such as chicken, rice, and broccoli already in their refrigerator. Recommend when explicitly requested or for an expressed or grounded ingredient-use need, not hunger, indecision, eating at home, or general meal-prep education alone.",
    create_a_dish: "Create meal options for a member-selected specific dish or full meal from an editable dish description. A chicken Caesar salad selected in a food-discovery conversation is a complete creator request, including when the member asks 'what do you think?'; stop discovery and offer Create a Dish. Do not require home, portions or ingredients first: the creator collects them. Do not infer preparation from merely discussing a dish, nutrition questions, undecided food preferences or eating-out requests. Small savory cravings, sushi, desserts and drinks have dedicated creators. Transfer only the member's chosen dish, with no invented ingredients or preparation location.",
    macro_calculator: "Optionally open the calculator after explaining macros; do not force navigation for an explanation.",
    my_perfect_beginning: "Open the child-selection hub for child feeding questions; select an authorized child before Parent's Corner. Never assume a child.",
  };
  const inputs: Record<CoachDestinationId, string> = {
    create_a_dish: "Dish/request description; servings and preferences are collected by the creator. Reviewed Chef handoff: editable idea text only; generation still requires the member's action.",
    craving_creator: "Free-text craving, servings and optional category/preferences. No general Chef request prefill; replace/name parameters are replacement context, not discovery text.",
    dessert_creator: "Free-text dessert idea or dessert type/flavor/style, serving size and optional dietary preferences. No general Chef request prefill.",
    sushi_creator: "Sushi description, servings and optional dietary preferences. No general Chef request prefill; replacement parameters are not request transfer.",
    beverage_creator: "Free-text drink idea or type/flavor, serving size and preferences. Only Hydration Center's verified hydrationHandoff is supported; Chef must not manufacture/reuse it for ordinary requests.",
    athlete_beverage_creator: "Free-text performance drink or performance goal/type/flavor, serving size and preferences. Hydration-specific handoff exists, not a general Chef request prefill.",
    fridge_rescue: "Member enters ingredients they want to use and relevant meal preferences. No approved Chef prefill. 'Home' alone does not mean using existing ingredients; generation retains its active-access and safety gates.",
    restaurant_guide: "Food/craving and selected restaurant; location or ZIP when needed. No approved Chef prefill. Order assistance, not restaurant discovery; results depend on available restaurant evidence.",
    find_meals_near_me: "ZIP or permitted location, radius and optional cuisine/budget/preferences. No approved Chef prefill. Discover restaurants, not order from an already chosen one; do not promise live menu availability.",
    my_perfect_buffet: "Available buffet foods, buffet type and appetite/context. No approved Chef prefill. Choose among actual buffet offerings; not a restaurant finder or recipe creator.",
    hydration_center: "Member hydration context/preferences and any verified professional guidance. No arbitrary request prefill. Education/support, not inventing fluid/electrolyte targets or overriding care plans.",
    macro_calculator: "Member measurements, activity and goals in the existing calculator. No Chef prefill. Do not overwrite saved targets or force this tool when a nutrition explanation is enough.",
    my_perfect_beginning: "Authorized child selection in the existing hub before child-specific help. No Chef prefill; do not fabricate child context or treat adult nutrition advice as a child plan.",
    my_perfect_getaway: "Travel situation/location and preferences collected by the destination. No Chef prefill. Travel assistance, not general cravings or a replacement for a clinical hub.",
    my_perfect_gatherings: "Gathering occasion, guests, preferences and constraints collected by the destination. No Chef prefill. Hosting assistance, not personal meal-board planning.",
  };
  const additions: MPMCapability[] = (Object.keys(COACH_DESTINATIONS) as CoachDestinationId[])
    .map(id => ({
      id, label: COACH_DESTINATIONS[id].label, route: COACH_DESTINATIONS[id].route,
      description: `${descriptions[id]} Required inputs and handoff: ${inputs[id]} Verified destination: ${COACH_DESTINATIONS[id].route}. Navigation access class: ${COACH_DESTINATIONS[id].access}; current access is rechecked on click and destination guards still apply.`,
      applicableSituations: id === "fridge_rescue" ? ["has_ingredients", "use_available_ingredients"] : ["general_inquiry"], scopes: ["all"], recommendable: true,
      eligibilityNote: "Navigation does not grant access; current access is checked on click.",
    }));
  // Legacy registry entries include internal builders that are not approved
  // concierge destinations. Do not advertise them as callable navigation.
  return additions;
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
