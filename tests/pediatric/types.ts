/**
 * Pediatric Test Scenario — Shared Types
 *
 * These types define the contract between test scenarios and the resolver.
 * The resolver at server/services/pediatric/pediatricResolver.ts must satisfy
 * this interface for all scenarios to pass.
 */

// ── Developmental Stages ──────────────────────────────────────────────────────

export const DEVELOPMENTAL_STAGES = [
  "early_infant",        // birth–~5 months — hard stop, no recipes
  "beginning_foods",     // ~6–11 months
  "young_toddler",       // 12–23 months
  "toddler",             // 2–3 years
  "preschool",           // 4–5 years
  "early_school_age",    // 6–8 years
  "growing_child",       // 9–12 years
] as const;

export type DevelopmentalStage = (typeof DEVELOPMENTAL_STAGES)[number];

// ── Allergy Types ─────────────────────────────────────────────────────────────

export const ALLERGEN_IDS = [
  "peanut", "tree_nuts", "milk", "egg", "wheat",
  "soy", "sesame", "fish", "shellfish", "other",
] as const;
export type AllergenId = (typeof ALLERGEN_IDS)[number];

export const ALLERGY_SEVERITIES = [
  "confirmed_allergy",
  "suspected_reaction",
  "intolerance",
  "preference_avoid",
  "clinician_elimination",
] as const;
export type AllergySeverity = (typeof ALLERGY_SEVERITIES)[number];

export interface AllergyEntry {
  allergenId: AllergenId;
  customAllergenName?: string;
  severity: AllergySeverity;
  emergencyMedication?: boolean;
}

// ── Medical Conditions ────────────────────────────────────────────────────────

export type MedicalCondition =
  | "type1_diabetes"
  | "type2_diabetes"
  | "iron_deficiency_anemia"
  | "failure_to_thrive"
  | "pediatric_obesity"
  | "adhd"
  | "autism_spectrum"
  | "crohns_disease"
  | "ckd"                  // chronic kidney disease
  | "cystic_fibrosis"
  | "pku"                  // phenylketonuria — hard stop
  | "g_tube"               // gastrostomy tube — hard stop
  | "celiac_disease";

export type CrohnsPhase = "flare" | "remission";

// ── Behavioral Flags ──────────────────────────────────────────────────────────

export type BehavioralFlag =
  | "picky_eater"
  | "food_exposure_tracking"    // acceptance score 30–70%
  | "food_neophobia"
  | "sensory_texture_restriction"
  | "limited_food_repertoire";

// ── Child Profile ─────────────────────────────────────────────────────────────

export interface ChildProfile {
  childId: string;
  /** Normally a DevelopmentalStage — accept string so unknown-stage tests can pass invalid values */
  ageStage: string;
  allergies: AllergyEntry[];
  medicalConditions: MedicalCondition[];
  behavioralFlags?: BehavioralFlag[];
  crohnPhase?: CrohnsPhase;
  /** Acceptance score 0–100 for food exposure tracking mode */
  foodAcceptanceScore?: number;
  /** Ingredients the parent has flagged as "never recommend again" */
  neverRecommendIngredients?: string[];
  /** Parent-requested substitution overrides */
  parentSubstitutes?: Record<string, string>;
}

// ── Meal Request ──────────────────────────────────────────────────────────────

export type MealContext =
  | "standard"
  | "school_lunch"
  | "birthday_party"
  | "pantry_only"
  | "family_meal";

export interface PediatricMealRequest {
  foodRequest: string;
  mealContext?: MealContext;
  /** In family_meal mode, include all child profiles */
  familyProfiles?: ChildProfile[];
  /** Available pantry ingredients (pantry_only mode) */
  pantryIngredients?: string[];
  requiresSchoolSafe?: boolean;
  requiresPackable?: boolean;
  servings?: number;
}

// ── Resolver Output (what the resolver must produce) ─────────────────────────

export interface FiredRule {
  ruleId: string;
  level: "A" | "B" | "C";
  description: string;
  action: string;
}

export interface PediatricContext {
  stage: string;
  rulesFired: FiredRule[];
  /** Ingredient / allergen names that are excluded */
  exclusions: string[];
  /** Active protocol identifiers */
  protocols: string[];
  hardStop: boolean;
  hardStopReason?: string;
  /** True when profile.ageStage was missing or unrecognised */
  stageError?: boolean;
  /** Language patterns the prompt must never produce */
  languageFlags: string[];
  /** Condition guidance block IDs to inject */
  conditionGuidanceBlocks: string[];
  mealType?: string;
}

// ── Test Scenario ─────────────────────────────────────────────────────────────

export type ScenarioCategory =
  | "healthy"
  | "allergy"
  | "medical"
  | "behavioral"
  | "context"
  | "hard_stop"
  | "family"
  | "multi_condition";

export interface PediatricScenario {
  id: string;
  description: string;
  category: ScenarioCategory;
  /**
   * hard_stop scenarios must reach 100% pass rate.
   * soft scenarios must reach 95%+ aggregate pass rate.
   */
  isHardStop: boolean;
  childProfile: ChildProfile;
  request: PediatricMealRequest;
  /** Rule IDs that MUST appear in context.rulesFired */
  expectedRulesFired: string[];
  /** Strings that MUST appear in context.exclusions */
  expectedExclusions: string[];
  /** Protocol IDs that MUST appear in context.protocols */
  expectedProtocols: string[];
  /**
   * Strings that MUST appear in context.languageFlags.
   * These represent language patterns the resolver must flag as banned.
   */
  mustFlagLanguage: string[];
  /** If true, context.hardStop must be true */
  expectHardStop: boolean;
  expectHardStopReason?: string;
  /** If true, context.stageError must be true (missing / unrecognised ageStage) */
  expectStageError?: boolean;
  /** Optional: expected meal type in context */
  expectedMealType?: string;
}

// ── Scenario Result ───────────────────────────────────────────────────────────

export interface ScenarioResult {
  scenario: PediatricScenario;
  passed: boolean;
  failures: string[];
  context?: PediatricContext;
  error?: string;
}
