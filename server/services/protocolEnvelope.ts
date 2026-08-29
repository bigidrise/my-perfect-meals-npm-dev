/**
 * protocolEnvelope.ts
 *
 * THE UNIVERSAL PROTOCOL-FIRST ENFORCEMENT MODEL
 *
 * This is the single canonical rule object for the entire application.
 * Every generator — Craving Creator, Create a Dish, Fridge Rescue,
 * Beverage Creator, Dessert Creator, Snack Creator, Create with Chef,
 * Wine helpers, Restaurant Guide, Find Meals Near Me — MUST receive
 * a UserProtocolEnvelope before doing anything with AI.
 *
 * Priority order (outer → inner):
 *   1. dietaryIdentity   — the outer wall. Nothing is generated outside it.
 *   2. allergies         — absolute hard stops within the identity container.
 *   3. medicalHardLimits — carb/sodium/etc. limits that cannot be violated.
 *   4. medicalOptimization — optimization layers applied inside hard limits.
 *   5. avoidances        — foods the user has marked as unwanted.
 *   6. preferences       — flavor, convenience, style — applied last.
 *
 * Procedural layer (cross-cutting — applies to ALL tiers):
 *   - preparationRules    — how food must/must not be prepared
 *   - storageRules        — separation and refrigeration requirements
 *   - equipmentRules      — cookware, utensil, and contact constraints
 *   - instructionConstraints — what must/must not appear in cooking instructions
 *   - crossContaminationRules — contact and contamination prevention
 *
 * Non-negotiable rules:
 *   - No medical optimization may violate the dietaryIdentity container.
 *   - No avoidance can override a medical hard limit.
 *   - No preference can override anything above it.
 *   - No generator may produce AI output without calling enforceBeforeGenerate().
 *   - No generator may return AI output without calling scanGeneratedOutput().
 *   - Instruction-level compliance is required, not just ingredient-level.
 */

import { db } from "../db";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import {
  AVOIDANCE_EXPANSION,
  RESTRICTION_EXPANSION,
  scanForHiddenDietaryViolations,
  ALLERGEN_EXPANSION,
  allergenKeysMatch,
  classifyKosherMealCategory,
  normalizeForDietaryScan,
  type HiddenViolation,
  type KosherCategory,
  DAIRY_ALLERGEN_KEYS,
  NUT_ALLERGEN_KEYS,
  maskPlantMilks,
  maskNutButters,
} from "./allergyGuardrails";
import {
  getDiabeticContext,
  getGlucoseBasedMealGuidance,
  type GlucoseState,
} from "./diabeticContextService";
import { buildUniversalConditionGuidance } from "./universalMedicalGuidance";
import { validateDishIdentity } from "./dishAdaptation/dishIdentityValidator";
import { deriveCompPrepStatus } from "./protocol/competitionPrepDateEngine";
import { sanitizeIdentifiers } from "./promptSanitizer";
import { logAudit } from "../lib/auditLog";
import { computeDemandProfile, type DemandProfile } from "../../shared/performanceDemandEngine";
import { resolveDailyNutritionState, type DailyNutritionState } from "./dailyNutritionState";
import { buildInterventionPrompts, type ActiveIntervention } from "./interventions/interventionPromptBuilder";
import { providerClinicalInterventions } from "../db/schema/providerInterventions";
import {
  resolveDailyMedicationTolerance,
} from "./glp1/resolveDailyMedicationTolerance";
import {
  type DailyMedicationTolerance,
  type ToleranceAppetiteLevel,
} from "../../shared/glp1-schema";

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL RULES — The third enforcement dimension
// Ingredient-level compliance is necessary but not sufficient.
// A meal can be ingredient-correct and still be protocol-wrong if the
// preparation, storage, equipment, or instructions violate the protocol.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProtocolProcedureRules {
  /** How food must/must not be prepared.
   * Examples: "use kosher-salted meat", "no blood remaining", "no deglaze with wine" */
  preparationRules: string[];

  /** Separation and refrigeration requirements.
   * Examples: "meat and dairy must be stored separately" */
  storageRules: string[];

  /** Cookware, utensil, and surface constraints.
   * Examples: "separate pans/utensils for meat and dairy",
   *           "never use a pan previously used for pork without kashering" */
  equipmentRules: string[];

  /** Phrases or instructions that must NEVER appear in generated cooking steps.
   * Examples: "deglaze with wine", "add butter to the meat pan", "top with cheese" */
  forbiddenInstructions: string[];

  /** What must be noted or explicitly required in generated instructions.
   * Examples: "note: use kosher-certified ingredients",
   *           "use separate utensils for meat and dairy" */
  requiredInstructionNotes: string[];

  /** Contact and cross-contamination prevention rules.
   * Examples: "meat and dairy must never share surfaces or utensils",
   *           "no contact with pork products" */
  crossContaminationRules: string[];
}

/**
 * Protocol-to-procedure rule map.
 * Defines the procedural requirements for each dietary identity.
 * This is the authoritative source for instruction-level enforcement.
 */
const PROTOCOL_PROCEDURE_MAP: Record<string, ProtocolProcedureRules> = {

  kosher: {
    preparationRules: [
      "Use kosher-certified or pre-salted kosher meat — no blood should remain in the meat",
      "Fruits and vegetables should be inspected for insects before use",
      "Do not cook meat and dairy in the same dish, pot, or pan",
      "Do not use non-kosher wine in cooking — use kosher wine or grape juice if wine is needed",
      "Do not include gelatin unless it is kosher-certified",
      "Do not include lard, suet, or non-kosher animal fats",
      "Shellfish and pork are absolutely forbidden in all forms",
    ],
    storageRules: [
      "Meat and dairy must be stored in completely separate containers",
      "Meat and dairy must never be placed in the same serving dish or on the same plate",
    ],
    equipmentRules: [
      "Use separate pots, pans, utensils, and cutting boards for meat dishes and dairy dishes",
      "A pan used for meat cannot be used for dairy without specific kashering — use dedicated cookware",
      "Never use the same serving spoon or spatula for meat and dairy dishes",
    ],
    forbiddenInstructions: [
      "deglaze with wine",
      "add butter to the pan after adding meat",
      "top with cheese",
      "finish with cream",
      "serve with a cream sauce",
      "melt butter over the chicken",
      "add parmesan",
      "use the same pan for",
      "add milk to the meat",
      "stir in cream",
    ],
    requiredInstructionNotes: [
      "Use only kosher-compliant ingredients, avoiding any forbidden substances",
      "Use a dedicated meat pan and utensils — do not mix with dairy equipment",
      "If a sauce or marinade is called for, ensure all components comply with kosher preparation rules",
    ],
    crossContaminationRules: [
      "Meat and dairy must never share surfaces, utensils, pans, or storage",
      "Fish should not be cooked in the same pan immediately after meat without washing",
      "No contact between pork products and any other ingredients in this meal",
    ],
  },

  halal: {
    preparationRules: [
      "Meat should be halal-certified (hand-slaughtered with proper blessing) — note this in sourcing",
      "No alcohol may be used at any step of preparation — no wine, beer, sake, rum, bourbon, or spirits",
      "No pork or pork derivatives (lard, gelatin, L-cysteine) in any form",
      "Do not use vanilla extract — use vanilla bean or halal-certified vanilla flavoring instead",
      "Do not use mirin — substitute with a non-alcoholic sweetener if needed",
      "Oyster sauce must be halal-certified or omitted",
    ],
    storageRules: [
      "No storage in contact with pork products",
      "No alcohol-containing sauces or marinades in the same storage area",
    ],
    equipmentRules: [
      "Utensils or cookware previously used for pork or alcohol must be thoroughly cleaned before use",
      "Use dedicated halal-compliant equipment when possible",
    ],
    forbiddenInstructions: [
      "deglaze with wine",
      "add wine",
      "add beer",
      "add sake",
      "add rum",
      "add bourbon",
      "add brandy",
      "add cognac",
      "add mirin",
      "marinate in wine",
      "add vanilla extract",
      "splash of alcohol",
      "add lard",
      "use pork fat",
    ],
    requiredInstructionNotes: [
      "Use halal-appropriate meat prepared according to halal standards",
      "All preparation steps must be completely alcohol-free",
      "Use vanilla bean or halal-compliant vanilla flavoring in place of vanilla extract",
    ],
    crossContaminationRules: [
      "No contact with pork products or alcohol at any point in preparation",
      "Ensure all shared equipment has been properly cleaned of pork or alcohol residue",
    ],
  },

  "kosher-halal": {
    preparationRules: [
      "Use kosher-certified and halal-certified ingredients throughout — both sets of rules apply simultaneously",
      "No pork, shellfish, blood, or non-certified meat in any form",
      "No alcohol in any step",
      "No meat and dairy in the same dish",
      "No lard, gelatin (unless certified), L-cysteine, or non-certified animal fats",
    ],
    storageRules: [
      "Meat and dairy stored separately (kosher)",
      "No storage in contact with pork or alcohol products (halal)",
    ],
    equipmentRules: [
      "Separate pans and utensils for meat vs. dairy (kosher)",
      "Equipment must be free of pork/alcohol residue (halal)",
    ],
    forbiddenInstructions: [
      "deglaze with wine", "add wine", "add beer", "add alcohol",
      "add butter to meat", "top with cheese", "finish with cream", "melt butter over",
      "add lard", "use pork fat", "add vanilla extract",
    ],
    requiredInstructionNotes: [
      "Ingredients must be both kosher-certified and halal-certified",
      "No alcohol at any step",
      "Use separate meat and dairy equipment",
    ],
    crossContaminationRules: [
      "Meat/dairy separation required (kosher)",
      "No contact with pork or alcohol (halal)",
    ],
  },

  vegan: {
    preparationRules: [
      "No animal products at any step — no butter, cream, eggs, honey, or dairy of any kind",
      "Do not grease pans with butter — use olive oil, coconut oil, or cooking spray",
      "Do not use egg wash — use plant milk wash or aquafaba",
      "Do not use gelatin — use agar-agar or cornstarch as a setting agent",
      "Do not use honey — use maple syrup, agave, or date syrup",
    ],
    storageRules: [],
    equipmentRules: [
      "Avoid cast iron seasoned with lard or animal fat — use well-seasoned plant-oil cast iron or stainless steel",
    ],
    forbiddenInstructions: [
      "brush with egg wash",
      "add butter",
      "stir in cream",
      "add honey",
      "top with parmesan",
      "add milk",
      "whisk in egg",
      "add cheese",
    ],
    requiredInstructionNotes: [
      "All ingredients must be entirely plant-based",
      "Use plant-based alternatives for any greasing, binding, or finishing steps",
    ],
    crossContaminationRules: [],
  },

  vegetarian: {
    preparationRules: [
      "No meat, poultry, or seafood at any step",
      "Do not use chicken broth, beef broth, or bone broth — use vegetable broth",
      "Do not use gelatin — use agar-agar or cornstarch",
      "Do not use anchovies, fish sauce, or Worcestershire sauce unless certified vegetarian",
      "Lard and animal fats are not allowed",
    ],
    storageRules: [],
    equipmentRules: [],
    forbiddenInstructions: [
      "add chicken broth",
      "add beef broth",
      "add bone broth",
      "use fish sauce",
      "add anchovies",
      "add lard",
    ],
    requiredInstructionNotes: [
      "Use vegetable broth in place of any meat-based broth",
      "Ensure sauces and condiments are vegetarian-certified",
    ],
    crossContaminationRules: [],
  },

  pescatarian: {
    preparationRules: [
      "No meat or poultry at any step",
      "Do not use chicken broth or beef broth — use seafood broth or vegetable broth",
      "Do not use lard or animal fats from land animals",
    ],
    storageRules: [],
    equipmentRules: [],
    forbiddenInstructions: [
      "add chicken broth",
      "add beef broth",
      "add bone broth",
      "add lard",
      "add bacon",
    ],
    requiredInstructionNotes: [
      "Use seafood broth or vegetable broth in place of meat-based broth",
    ],
    crossContaminationRules: [],
  },

  "gluten-free": {
    preparationRules: [
      "Use only certified gluten-free ingredients throughout",
      "Do not use wheat flour — use almond flour, rice flour, tapioca, or certified GF blends",
      "Do not use soy sauce — use tamari (gluten-free) or coconut aminos",
      "Do not use barley, rye, spelt, or any wheat-derived ingredient",
      "Check all sauces, seasonings, and condiments for hidden gluten",
    ],
    storageRules: [
      "Store gluten-free ingredients away from wheat products to prevent cross-contamination",
    ],
    equipmentRules: [
      "Use dedicated gluten-free cookware and utensils if possible, or thoroughly clean shared equipment",
      "Do not use the same toaster, baking sheets, or pasta water as wheat products",
    ],
    forbiddenInstructions: [
      "use flour",
      "add wheat flour",
      "use soy sauce",
      "dust with flour",
      "add bread crumbs",
      "use pasta water",
    ],
    requiredInstructionNotes: [
      "Use certified gluten-free alternatives for all flour, thickener, and sauce ingredients",
      "Use tamari or coconut aminos in place of soy sauce",
      "Verify all packaged ingredients are labeled gluten-free",
    ],
    crossContaminationRules: [
      "Gluten-free dishes must never share surfaces, utensils, or cookware with wheat-containing products without thorough cleaning",
    ],
  },

  low_carb: {
    preparationRules: [
      "Reduce carbohydrates significantly — avoid white bread, white rice, regular pasta, pastries, and refined grains",
      "Do not use added sugar, sugary sauces, or sweetened condiments",
      "Do not use corn syrup, honey glaze, or sugar-based marinades",
      "Favor protein, healthy fats, and non-starchy vegetables as the bulk of the dish",
      "Small amounts of whole grains (quinoa, oats, legumes) are acceptable; refined starches are not",
    ],
    storageRules: [],
    equipmentRules: [],
    forbiddenInstructions: [
      "serve with white rice",
      "serve with pasta",
      "serve with bread",
      "add sugar",
      "add corn syrup",
      "serve with a roll",
      "add croutons",
    ],
    requiredInstructionNotes: [
      "Keep the dish low in refined carbohydrates — replace starchy sides with non-starchy vegetables or salad",
    ],
    crossContaminationRules: [],
  },
  keto: {
    preparationRules: [
      "Keep net carbs minimal — prioritize fats and proteins in every step",
      "Do not use sugar, honey, maple syrup, or other high-carb sweeteners",
      "Do not use wheat flour, cornstarch, potato starch, or any high-carb thickener",
      "Use almond flour, coconut flour, or xanthan gum for any thickening or binding",
      "Do not use bread, rice, pasta, or any grain-based component",
    ],
    storageRules: [],
    equipmentRules: [],
    forbiddenInstructions: [
      "add sugar",
      "add flour",
      "serve with rice",
      "serve with pasta",
      "add honey",
      "add bread crumbs",
      "thicken with cornstarch",
    ],
    requiredInstructionNotes: [
      "Keep all additions low-carb — check net carbs of any sauces or seasonings",
      "Use keto-friendly thickeners (xanthan gum, almond flour) if needed",
    ],
    crossContaminationRules: [],
  },
};

/**
 * Derive procedure rules for a given set of dietary identities.
 * Merges rules from all matching protocols (e.g. kosher + vegan stacks).
 */
export function deriveProcedureRules(dietaryIdentity: string[]): ProtocolProcedureRules {
  const merged: ProtocolProcedureRules = {
    preparationRules: [],
    storageRules: [],
    equipmentRules: [],
    forbiddenInstructions: [],
    requiredInstructionNotes: [],
    crossContaminationRules: [],
  };

  for (const identity of dietaryIdentity) {
    const key = identity.trim().toLowerCase();
    const rules = PROTOCOL_PROCEDURE_MAP[key];
    if (!rules) continue;

    for (const field of Object.keys(merged) as (keyof ProtocolProcedureRules)[]) {
      for (const rule of rules[field]) {
        if (!merged[field].includes(rule)) {
          (merged[field] as string[]).push(rule);
        }
      }
    }
  }

  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The canonical rule stack. Every generator works from this object.
 * Never pass loose arrays directly to a generator — always use this envelope.
 */
export interface UserProtocolEnvelope {
  userId: string;

  /** Tier 1 — Dietary identity: the outer wall.
   * Examples: vegan, vegetarian, pescatarian, keto, paleo, Mediterranean,
   *           kosher, halal, kosher-halal, gluten-free.
   * Nothing generated may violate these rules. */
  dietaryIdentity: string[];

  /** Tier 2 — Allergy blocks: absolute hard stops.
   * Examples: shellfish, peanuts, dairy, tree-nuts, soy, gluten, eggs.
   * These are medically serious. Double-blocked when they also appear in dietaryIdentity. */
  allergies: string[];

  /** Tier 3 — Medical hard limits: non-negotiable constraints inside the identity wall.
   * Examples: diabetes (carb limits), renal (sodium/potassium/phosphorus),
   *           cardiac (saturated fat/sodium), GLP-1 (portion size/trigger foods). */
  medicalHardLimits: string[];

  /** Tier 4 — Medical optimization: shaping applied inside the hard limits.
   * Examples: anti-inflammatory (omega-3 preference, anti-oxidant priority),
   *           GLP-1 optimization (high protein, soft textures, smaller volume). */
  medicalOptimization: string[];

  /**
   * Tier 5 — Performance Intent: metabolic operating mode stored on the user profile.
   * Shapes macro bias, protein floor, carb structure, and AI meal generation emphasis.
   * NEVER overrides Tiers 1–4. Medical safety and dietary identity always win.
   * "standard" = no performance shaping applied (default for all users).
   */
  performanceOverlay: "standard" | "performance" | "competition_prep" | "recovery" | "recomp";
  performanceControlMode: "self_guided" | "coach_controlled";

  /** Tier 6 — Avoidances: foods the user has marked as unwanted.
   * Examples: seafood, pork, mushrooms, cilantro, spicy.
   * Expanded automatically via AVOIDANCE_EXPANSION. */
  avoidances: string[];

  /** Tier 6 — Preferences: flavor, style, convenience.
   * Examples: Mediterranean flavors, simple prep, no raw onion, low spice. */
  preferences: string[];

  /** Cuisine Identity — stylistic cultural layer (below all safety/diet tiers).
   * Guides flavor profiles, ingredients, and cooking techniques.
   * NEVER overrides diet, allergies, or medical rules. */
  cuisinePreference: string | null;
  cuisineIntensity: "light" | "balanced" | "authentic" | null;

  /**
   * Procedural layer — derived from dietaryIdentity.
   * Covers preparation, storage, equipment, instruction constraints,
   * and cross-contamination rules. Applied to ALL tiers.
   * A meal can be ingredient-correct and still be protocol-wrong
   * if the instructions violate these rules.
   */
  procedural: ProtocolProcedureRules;

  /**
   * Real-time blood glucose guidance — populated when the user has diabetes
   * AND has recent glucose log data. This is glucose-state-responsive text
   * (e.g., "glucose is 220 mg/dL — keep carbs under 15g, prioritize protein
   * and fiber"). Injected into the medical hard limits block for ALL generators.
   * Null when user has no diabetes or no recent glucose data.
   */
  diabeticGuidance: string | null;

  /**
   * True when the user has any diabetic condition in their medical hard limits
   * (diabetes, diabetic, type 2 diabetes, type 1 diabetes, prediabetes).
   * Used to gate post-generation ingredient validators that must run even when
   * no recent glucose log exists (i.e., diabeticGlucoseState is null).
   * Ingredient blocking (potatoes, white rice, sugar, etc.) applies to ALL
   * diabetic users — not just those with a recent glucose reading.
   */
  hasDiabetes: boolean;

  /**
   * The classified glucose state — used by post-generation validators to apply
   * hard carb and ingredient checks. Separate from the text guidance so
   * validators can branch on the actual state without parsing text.
   * Null when user has no diabetes or no recent glucose data.
   */
  diabeticGlucoseState: GlucoseState | null;

  /**
   * Universal condition guidance blocks — one entry per active non-diabetic
   * medical condition (GLP-1, Anti-Inflammatory, Renal, Cardiac, Liver,
   * Oncology). Each block is a self-contained directive string injected into
   * the medical hard limits section of EVERY generator automatically.
   * Empty array when no conditions are active.
   */
  conditionGuidanceBlocks: string[];

  /**
   * User's preferred language — BCP-47 base code ("es", "fr", "zh", etc.)
   * or "auto" (use device language). Injected into every AI system prompt
   * so meals, coaching, and recommendations generate in the user's language
   * without a Translate button. Null/auto = English (no instruction added).
   */
  preferredLanguage: string | null;

  /**
   * GLP-1 daily medication tolerance state — resolved from ace_daily_checkins
   * and water_logs for today's date. Null when the user is not on a GLP-1 /
   * metabolic medication, or when no check-in data exists for today.
   *
   * Injected into conditionGuidanceBlocks as a real-time dietary directive block
   * so all generators automatically honor today's GI tolerance state.
   *
   * Governed by the GLP-1 Rule Registry (ruleRegistry.ts):
   *   - glp1_vomiting_escalate
   *   - glp1_dehydration_difficulty_escalate
   */
  glp1DailyTolerance: DailyMedicationTolerance | null;

  /**
   * Thyroid Support active flag — true when specialtyCondition === 'thyroid-support'
   * OR thyroid lab values triggered resolveThyroidFromLabs().
   * Used by post-generation validators (thyroidSupportValidator) and the
   * physician dashboard indicator light.
   */
  thyroidSupport: boolean;

  /**
   * Thyroid medication name if the user disclosed one (e.g., "Levothyroxine").
   * Null when not disclosed. Used for medication timing guidance in meal generation.
   */
  thyroidMedication: string | null;

  /**
   * Thyroid subtype — narrows the Thyroid Support protocol to the specific condition.
   * Routes buildThyroidSupportPrompt to subtype-specific guidance blocks.
   * Null when thyroid support is inactive or subtype not specified.
   */
  thyroidType: "hypothyroid" | "hyperthyroid" | "hashimotos" | null;

  /**
   * Hormone Optimization protocol active flag.
   * True when "hormone-optimization" is in the user's specialtyConditions array.
   * Injects HORMONE_OPTIMIZATION_GUIDANCE block into all generators.
   */
  hormoneOptimization: boolean;

  /**
   * Measurement system preference — drives unit display and AI prompt formatting.
   * Defaults to "imperial" for all users. Metric users get g/ml/kg in AI output.
   */
  measurementSystem: "imperial" | "metric";

  /**
   * User's primary fitness/nutrition goal — from onboarding.
   * Examples: "weight_loss", "muscle_gain", "maintenance", "endurance"
   * Null when not set.
   */
  fitnessGoal: string | null;

  /**
   * User's goal direction — from onboarding goals step.
   * "lose" | "maintain" | "gain" — the directional intent behind the fitness goal.
   * Null when not set.
   */
  goalType: "lose" | "maintain" | "gain" | null;

  /**
   * User's goal target description — from onboarding (e.g. "20 lbs", "10 kg").
   * Null when not set.
   */
  goalTarget: string | null;

  /**
   * Pregnancy Support protocol active flag.
   * True when "pregnancy-support" is in the user's specialtyConditions array.
   * Injects pregnancy-aware nutrient guidance, food safety blocks, and symptom
   * adaptations into all generators via conditionGuidanceBlocks[].
   */
  pregnancySupport: boolean;

  /**
   * Pregnancy Support context — stage, derived week, symptoms, tracking mode.
   * Null when pregnancy support is not active.
   * weekOfPregnancy is derived server-side from dueDate when trackingMode = "due-date".
   */
  pregnancySupportContext: {
    active: boolean;
    stage: "trying-to-conceive" | "trimester-1" | "trimester-2" | "trimester-3" | "breastfeeding" | "postpartum";
    weekOfPregnancy: number | null;
    dueDate: string | null;
    symptoms: Array<"nausea" | "heartburn" | "constipation" | "fatigue" | "food_aversions" | "swelling" | "shortness_of_breath" | "low_appetite">;
    isBreastfeeding: boolean;
  } | null;

  /**
   * Active carb-cycle protocol — populated when carbCycleState.phase is "low_carb"
   * or "refeed". Injected as a hard constraint in the performanceIntent prompt layer
   * of every meal generator. Null when no active carb cycle.
   */
  carbCycleContext: {
    phase: "low_carb" | "refeed";
    carbBudgetG: number;
    isRefeedDay: boolean;
  } | null;

  /**
   * Performance Nutrition protocol active flag.
   * True when "performance-nutrition" is in specialtyConditions.
   */
  performanceNutrition: boolean;

  /**
   * Processed performance context — structured fields from the user's athletic profile.
   * Null when performance-nutrition is not active or context is incomplete.
   */
  performanceContext: {
    active: boolean;
    primaryGoal: string;
    trainingType: string;
    trainingFrequency: string;
    cardioFocus: string;
    trainingPhase: string;
    twoADays: boolean;
    sessionDuration?: string;
    recoveryStatus?: string;
    adaptationTarget?: string;
    adaptationTargets?: string[];
  } | null;

  /**
   * Performance Demand Profile — computed by computeDemandProfile() from the user's
   * performanceContext. Encodes fuel demand, recovery demand, adaptation focus,
   * training load, and ordered nutrition priorities.
   * Null when performance-nutrition is not active.
   * Sits between Tier 4 (medical optimization) and Tier 6 (avoidances) — additive only.
   * NEVER overrides Tiers 1–4. Medical safety always wins.
   */
  performanceLayer: DemandProfile | null;

  /**
   * Resolved daily nutrition state — populated when performance-nutrition is active
   * and the user has a configured weekly training schedule.
   * Contains today's session type, starchy carb target, confirmed consumption,
   * remaining budget, and a ready-to-inject preGenerationConstraint string.
   * Null when performance-nutrition is off or schedule is not yet configured.
   */
  dailyNutritionState: DailyNutritionState | null;

  /**
   * Therapeutic Nutrition Intelligence active flag.
   * True when "therapeutic-support" is in the user's specialtyConditions array.
   * Guidance blocks are injected into conditionGuidanceBlocks automatically.
   * Tier 3 — below Clinical Safety, above Performance and Preferences.
   */
  therapeuticSupport: boolean;

  /** The active meal builder slug (e.g. "weekly", "diabetic", "beach_body").
   * Null when not yet selected. */
  selectedMealBuilder: string | null;

  /** Palate preferences — loaded from user profile, available to every generator.
   * Routes no longer need a second DB query to access these. */
  flavorPreference: string | null;
  heatPreference: string | null;
  palateSpiceTolerance: string | null;
  palateSeasoningIntensity: string | null;
  palateFlavorStyle: string | null;

  /**
   * Therapeutic Support context — peptides, hormones, medications, therapies, recoveryGoals.
   * Null when therapeutic support is not active.
   */
  therapeuticSupportContext: {
    peptides: { type: string; dose: number; unit: string; frequency?: string; label?: string; custom?: boolean }[];
    hormones: { type: string; dose: number; unit: string; frequency?: string; label?: string; custom?: boolean }[];
    medications: { type: string; dose: number; unit: string; frequency?: string; label?: string; custom?: boolean }[];
    therapies: string[];
    recoveryGoals: string[];
  } | null;

  /**
   * Active provider clinical interventions — loaded from provider_clinical_interventions table.
   * These represent conditions a clinician has flagged for this patient (e.g., Nausea: Moderate).
   * Their prompt directives are already merged into medicalHardLimits and medicalOptimization
   * above, so every generator automatically honors them. This field is available for:
   *  - UI display (show the patient what's being adjusted and why)
   *  - Audit logging (record which provider directives were active at generation time)
   *  - Escalation flag surfacing
   * Empty array when no interventions are active.
   */
  providerInterventions: Array<{
    conditionKey: string;
    severity: string;
    notes: string | null;
    escalationFlag: boolean;
    activatedAt: Date;
  }>;

  /**
   * Patient-facing coaching summary lines generated from active interventions.
   * Each line explains what the system is adjusting and why, in plain language.
   * Empty when no interventions are active.
   */
  interventionPatientSummary: string[];
}

/**
 * Pre-generation prompt block — structured layers ready to inject into any AI prompt.
 * Returned by enforceBeforeGenerate().
 */
export interface ProtocolPromptBlock {
  /** Full combined text block to inject into the AI system/user prompt */
  combined: string;

  /** Individual layers — use if you need to inject at specific prompt positions */
  layers: {
    dietaryIdentity: string;
    allergies: string;
    medicalHardLimits: string;
    performanceIntent: string;
    avoidances: string;
    procedural: string;
    preferences: string;
  };

  /** Whether this envelope contains any active restrictions (false = open generation) */
  hasRestrictions: boolean;

  /**
   * T1/T2 PHI field names that were present in this envelope and sent to AI.
   * Values are never included — only field name strings.
   * Populated by enforceBeforeGenerate() for downstream audit logging.
   */
  phiFields: string[];
}

/**
 * Post-generation scan result — returned by scanGeneratedOutput().
 */
export interface ProtocolScanResult {
  passed: boolean;
  violations: HiddenViolation[];
  /** Instruction-level violations found in the cooking steps */
  instructionViolations: string[];
  primaryViolation?: HiddenViolation;
  /** Human-readable message suitable for logging or error responses */
  message: string;
  /**
   * Starch budget soft flag — present when starchyBudgetExhausted is true
   * and the generated meal contains identifiable starchy ingredients.
   * v1: informational only — does NOT change `passed`. Callers may choose
   * to reject, warn, or log. v2 will hard-block.
   */
  starchBudgetViolation?: {
    detected: boolean;
    terms: string[];
    message: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CONDITION CLASSIFICATION
// Maps health conditions to their correct tier in the rule stack.
// ─────────────────────────────────────────────────────────────────────────────

const MEDICAL_HARD_LIMIT_CONDITIONS = new Set([
  "diabetes", "diabetic", "type 2 diabetes", "type 1 diabetes", "prediabetes",
  "renal", "kidney disease", "ckd", "chronic kidney disease",
  "cardiac", "heart disease", "heart failure", "hypertension",
  "celiac", "celiac disease",
  "phenylketonuria", "pku",
  "crohn's disease", "crohns", "colitis", "ibd", "ibs",
  "gerd", "acid reflux",
  // Alpha-gal Syndrome — clinical allergy; mammalian meat/fat hard blocks
  "alpha-gal-syndrome", "alpha-gal syndrome", "alpha gal syndrome", "alpha-gal", "alpha gal",
]);

const MEDICAL_OPTIMIZATION_CONDITIONS = new Set([
  "anti-inflammatory", "anti inflammatory",
  "glp-1", "glp1", "semaglutide", "ozempic", "wegovy", "tirzepatide", "mounjaro", "zepbound",
  "liraglutide", "saxenda", "victoza", "dulaglutide", "trulicity",
  "exenatide", "byetta", "bydureon", "rybelsus",
  "weight loss", "obesity",
  "high cholesterol", "hypercholesterolemia",
  "metabolic syndrome",
  "fatty liver", "nafld",
  "pcos", "polycystic ovary",
  "thyroid", "hypothyroidism",
  "autoimmune",
]);

function classifyHealthConditions(conditions: string[]): {
  hardLimits: string[];
  optimization: string[];
} {
  const hardLimits: string[] = [];
  const optimization: string[] = [];

  for (const c of conditions) {
    const key = c.trim().toLowerCase();
    if (MEDICAL_HARD_LIMIT_CONDITIONS.has(key)) {
      hardLimits.push(key);
    } else if (MEDICAL_OPTIMIZATION_CONDITIONS.has(key)) {
      optimization.push(key);
    } else {
      optimization.push(key);
    }
  }

  return { hardLimits, optimization };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVELOPE LOADER
// Single database query — call once per request.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the UserProtocolEnvelope for a given user ID.
 * Makes a single DB query and returns the fully-structured rule stack,
 * including the derived procedural layer.
 * Returns null if the user is not found.
 */
export async function loadUserProtocolEnvelope(
  userId: string
): Promise<UserProtocolEnvelope | null> {
  try {
    const [user] = await db
      .select({
        id: users.id,
        dietaryRestrictions: users.dietaryRestrictions,
        allergies: users.allergies,
        healthConditions: users.healthConditions,
        dislikedFoods: users.dislikedFoods,
        avoidedFoods: users.avoidedFoods,
        likedFoods: users.likedFoods,
        preferredSweeteners: users.preferredSweeteners,
        avoidSweeteners: users.avoidSweeteners,
        sweetenerPreferences: users.sweetenerPreferences,
        cuisinePreference: users.cuisinePreference,
        cuisineIntensity: users.cuisineIntensity,
        oncologySupportContext: users.oncologySupportContext,
        selectedMealBuilder: users.selectedMealBuilder,
        specialtyCondition: users.specialtyCondition,
        specialtyConditions: users.specialtyConditions,
        thyroidMedication: users.thyroidMedication,
        thyroidType: (users as any).thyroidType,
        activeHouseholdProfileId: (users as any).activeHouseholdProfileId,
        measurementSystem: users.measurementSystem,
        fitnessGoal: users.fitnessGoal,
        goalType: (users as any).goalType,
        goalTarget: (users as any).goalTarget,
        performanceOverlay: (users as any).performanceOverlay,
        performanceControlMode: (users as any).performanceControlMode,
        carbCycleState: users.carbCycleState,
        performanceContext: users.performanceContext,
        weeklyTrainingSchedule: (users as any).weeklyTrainingSchedule,
        performanceProtocolConfig: (users as any).performanceProtocolConfig,
        dailyCalorieTarget: (users as any).dailyCalorieTarget,
        dailyProteinTarget: (users as any).dailyProteinTarget,
        dailyCarbsTarget:   (users as any).dailyCarbsTarget,
        dailyFatTarget:     (users as any).dailyFatTarget,
        dailyStarchyCarbsTarget: (users as any).dailyStarchyCarbsTarget,
        dailyFibrousCarbsTarget: (users as any).dailyFibrousCarbsTarget,
        timezone: (users as any).timezone,
        therapeuticSupportContext: (users as any).therapeuticSupportContext,
        alphaGalProfile: (users as any).alphaGalProfile,
        pregnancySupportContext: (users as any).pregnancySupportContext,
        flavorPreference: users.flavorPreference,
        heatPreference: users.heatPreference,
        palateSpiceTolerance: users.palateSpiceTolerance,
        palateSeasoningIntensity: users.palateSeasoningIntensity,
        palateFlavorStyle: users.palateFlavorStyle,
        preferredLanguage: (users as any).preferredLanguage,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      console.warn(`[ProtocolEnvelope] User not found: ${userId}`);
      return null;
    }

    // ── HOUSEHOLD PROFILE OVERLAY ─────────────────────────────────────────────
    // When the owner has switched to a household member's profile, overlay that
    // profile's preference fields onto the envelope. Medical supervision fields
    // (oncologySupportContext, thyroidMedication) always remain from the owner.
    if ((user as any).activeHouseholdProfileId) {
      try {
        const { householdProfiles } = await import("@shared/schema");
        const [hProfile] = await db
          .select()
          .from(householdProfiles)
          .where(eq(householdProfiles.id, (user as any).activeHouseholdProfileId))
          .limit(1);

        if (hProfile && hProfile.ownerUserId === userId) {
          console.log(`[ProtocolEnvelope] Applying household profile "${hProfile.displayName}" for user ${userId}`);
          (user as any).dietaryRestrictions = hProfile.dietaryRestrictions ?? [];
          (user as any).allergies = hProfile.allergies ?? [];
          (user as any).healthConditions = hProfile.healthConditions ?? [];
          (user as any).dislikedFoods = hProfile.dislikedFoods ?? [];
          (user as any).avoidedFoods = hProfile.avoidedFoods ?? [];
          (user as any).likedFoods = hProfile.likedFoods ?? [];
          (user as any).preferredSweeteners = hProfile.preferredSweeteners ?? [];
          (user as any).cuisinePreference = hProfile.cuisinePreference ?? null;
          (user as any).cuisineIntensity = hProfile.cuisineIntensity ?? null;
          (user as any).specialtyCondition = hProfile.specialtyCondition ?? null;
          (user as any).specialtyConditions = hProfile.specialtyConditions ?? [];
          // medicalConditions glp1 check uses household profile's conditions
          (user as any)._householdMedicalConditions = hProfile.medicalConditions ?? [];
          (user as any)._householdProfileName = hProfile.displayName;
        }
      } catch (hErr) {
        console.warn("[ProtocolEnvelope] Could not load household profile, falling back to owner:", hErr);
      }
    }

    const dietaryRestrictions: string[] = (user.dietaryRestrictions as string[]) || [];
    const allergies: string[] = (user.allergies as string[]) || [];
    const healthConditions: string[] = (user.healthConditions as string[]) || [];
    // Stack all active specialty conditions into healthConditions so EVERY active protocol
    // gets its guidance block injected simultaneously via buildUniversalConditionGuidance.
    // Falls back to single specialtyCondition value for backward compat with existing users.
    const _rawSpecialtyConditions: string[] = ((user as any).specialtyConditions as string[] | null) ?? [];
    const specialtyConditionsArr: string[] = _rawSpecialtyConditions.length > 0
      ? _rawSpecialtyConditions
      : (user.specialtyCondition ? [user.specialtyCondition] : []);
    // Also pull 'glp1' out of medicalConditions so diabetic-builder generation stacks the GLP-1
    // protocol automatically when a user is on GLP-1 medication. Only 'glp1' is extracted —
    // other medicalConditions values (e.g. 'diabetes-type2') are builder-routing flags, not
    // guidance-layer condition keys, so they must not be injected into healthConditions.
    // When a household profile is active, use its medicalConditions for GLP-1 detection.
    const _activeMedicalConditions: string[] =
      (user as any)._householdMedicalConditions ||
      ((user as any).medicalConditions as string[] | null) ||
      [];
    const GLP1_MC_KEYS = new Set(["glp1", "glp-1", "semaglutide", "ozempic", "wegovy", "tirzepatide", "mounjaro", "zepbound", "rybelsus", "liraglutide", "saxenda", "victoza", "dulaglutide", "trulicity", "exenatide", "byetta", "bydureon"]);
    const medicalConditionsGlp1 = _activeMedicalConditions.filter((c: string) => GLP1_MC_KEYS.has(c.toLowerCase()));
    const mergedHealthConditions = [...new Set([...healthConditions, ...specialtyConditionsArr, ...medicalConditionsGlp1])];
    const dislikedFoods: string[] = (user.dislikedFoods as string[]) || [];
    const avoidedFoods: string[] = (user.avoidedFoods as string[]) || [];
    const likedFoods: string[] = (user.likedFoods as string[]) || [];
    // Resolve sweeteners with fallback: if AI-facing columns are empty (user
    // saved preferences before the bridge was deployed), derive from the legacy
    // sweetenerPreferences column so no re-save is required.
    const { resolveSweetenerAllowlist } = await import("./promptBuilder");
    const { preferred: resolvedSweeteners } = resolveSweetenerAllowlist(
      (user.preferredSweeteners as string[]) || [],
      ((user as any).avoidSweeteners as string[]) || [],
      ((user as any).sweetenerPreferences as string[]) || []
    );
    const preferredSweeteners: string[] = resolvedSweeteners;

    const { hardLimits, optimization } = classifyHealthConditions(mergedHealthConditions);
    const avoidances = [...new Set([...dislikedFoods, ...avoidedFoods])];
    const preferences = [...new Set([...likedFoods, ...preferredSweeteners])];
    const procedural = deriveProcedureRules(dietaryRestrictions);

    // ── REAL-TIME DIABETIC CONTEXT ─────────────────────────────────────────────
    // If the user has any diabetic condition in their hard limits, fetch their
    // diabetes profile and latest glucose log. This makes blood glucose data
    // available to EVERY generator — not only the Diabetic Hub.
    const DIABETES_KEYS = new Set(["diabetes", "diabetic", "type 2 diabetes", "type 1 diabetes", "prediabetes"]);
    // hasDiabetes is true when EITHER:
    //   (a) a diabetes-family condition is in the user's medical hard limits, OR
    //   (b) the user has selected the diabetic meal builder
    // Both paths mean the same clinical reality: potatoes, white rice, sugar, and
    // other high-GI ingredients must be blocked in post-generation validation.
    const hasDiabetes: boolean =
      hardLimits.some(c => DIABETES_KEYS.has(c)) ||
      user.selectedMealBuilder === "diabetic";
    let diabeticGuidance: string | null = null;
    let diabeticGlucoseState: GlucoseState | null = null;
    if (hasDiabetes) {
      try {
        const diabCtx = await getDiabeticContext(userId);
        diabeticGuidance = getGlucoseBasedMealGuidance(diabCtx);
        diabeticGlucoseState = diabCtx.latestGlucose?.state ?? null;
      } catch (err) {
        console.warn("[ProtocolEnvelope] Could not load diabetic context:", err);
      }
    }

    // ── UNIVERSAL CONDITION GUIDANCE (GLP-1, Anti-Inflammatory, Renal, Cardiac, Liver, Oncology)
    // Builds directive guidance blocks for all active non-diabetic medical conditions.
    // These travel with the user into every generator automatically via the envelope.
    const oncologySupportContext = user.oncologySupportContext as {
      enabled: boolean;
      symptoms: Array<"low_appetite" | "nausea" | "mouth_sensitivity" | "fatigue_low_prep" | "gi_sensitivity">;
      emphasis?: { highProteinNutrientDensity?: boolean };
    } | null;

    // ── THYROID SUPPORT — first-class protocol slot ──────────────────────────
    // Activation cascade (any of these triggers the modifier):
    //   1. specialtyCondition === 'thyroid-support' (self-selected in profile/onboarding)
    //   2. healthConditions includes a thyroid key (e.g. 'hashimoto\'s', 'hypothyroidism')
    //   3. Lab-resolved thyroid signal: on acceptance, the /api/biometrics/labs/recommendation
    //      endpoint appends 'thyroid-support' to the user's specialtyConditions array,
    //      which is then picked up on the next request via specialtyConditionsArr check above.
    const THYROID_ACTIVATION_KEYS = new Set([
      "thyroid-support", "thyroid support", "hashimoto's", "hashimotos",
      "hypothyroidism", "autoimmune thyroid", "thyroid disease",
      "hypothyroid", "hyperthyroid",
    ]);
    const thyroidSupport: boolean =
      user.specialtyCondition === "thyroid-support" ||
      specialtyConditionsArr.includes("thyroid-support") ||
      specialtyConditionsArr.includes("hashimotos") ||
      specialtyConditionsArr.includes("hypothyroid") ||
      specialtyConditionsArr.includes("hyperthyroid") ||
      mergedHealthConditions.some(c => THYROID_ACTIVATION_KEYS.has(c.trim().toLowerCase()));

    const thyroidMedication: string | null = (user.thyroidMedication as string | null) ?? null;
    const thyroidType = ((user as any).thyroidType as "hypothyroid" | "hyperthyroid" | "hashimotos" | null) ?? null;

    // Hormone Optimization: detected when "hormone-optimization" is in specialtyConditions
    const hormoneOptimization: boolean = specialtyConditionsArr.includes("hormone-optimization");
    const menopause: boolean = specialtyConditionsArr.includes("menopause");
    const perimenopause: boolean = specialtyConditionsArr.includes("perimenopause");
    const metabolicRecovery: boolean = specialtyConditionsArr.includes("metabolic-recovery");

    // ── PREGNANCY SUPPORT — additive modifier ────────────────────────────────
    const pregnancySupport: boolean = specialtyConditionsArr.includes("pregnancy-support");

    // Build pregnancy context — derive trimester + week from dueDate server-side
    let pregnancySupportCtx: {
      active: boolean;
      stage: "trying-to-conceive" | "trimester-1" | "trimester-2" | "trimester-3" | "breastfeeding" | "postpartum";
      weekOfPregnancy: number | null;
      dueDate: string | null;
      symptoms: Array<"nausea" | "heartburn" | "constipation" | "fatigue" | "food_aversions" | "swelling" | "shortness_of_breath" | "low_appetite">;
      isBreastfeeding: boolean;
    } | null = null;

    if (pregnancySupport) {
      const rawDueDate = ((user as any).pregnancyDueDate as string | null) ?? null;
      const rawStage = ((user as any).pregnancyStage as string | null) ?? null;
      const rawCtx = ((user as any).pregnancySupportContext as {
        symptoms?: string[];
        trackingMode?: string;
        isBreastfeeding?: boolean;
      } | null) ?? null;

      let derivedStage: "trying-to-conceive" | "trimester-1" | "trimester-2" | "trimester-3" | "breastfeeding" | "postpartum" =
        (rawStage as any) ?? "trimester-2";
      let derivedWeek: number | null = null;

      // Auto-derive trimester + week from due date when trackingMode = "due-date"
      if (rawDueDate && rawCtx?.trackingMode !== "manual") {
        try {
          const due = new Date(rawDueDate);
          const now = new Date();
          const msPerWeek = 7 * 24 * 60 * 60 * 1000;
          const weeksUntilDue = (due.getTime() - now.getTime()) / msPerWeek;
          const currentWeek = Math.max(1, Math.min(42, Math.round(40 - weeksUntilDue)));
          derivedWeek = currentWeek;
          if (currentWeek <= 13) derivedStage = "trimester-1";
          else if (currentWeek <= 27) derivedStage = "trimester-2";
          else derivedStage = "trimester-3";
        } catch {
          // Due date parse failed — fall back to manual stage
        }
      }

      pregnancySupportCtx = {
        active: true,
        stage: derivedStage,
        weekOfPregnancy: derivedWeek,
        dueDate: rawDueDate,
        symptoms: (rawCtx?.symptoms as any[] ?? []),
        isBreastfeeding: rawCtx?.isBreastfeeding ?? false,
      };
    }

    // ── THERAPEUTIC NUTRITION INTELLIGENCE — additive modifier ────────────────
    const therapeuticSupport: boolean = specialtyConditionsArr.includes("therapeutic-support");
    let therapeuticSupportCtx: {
      peptides: { type: string; dose: number; unit: string; frequency?: string; label?: string; custom?: boolean }[];
      hormones: { type: string; dose: number; unit: string; frequency?: string; label?: string; custom?: boolean }[];
      medications: { type: string; dose: number; unit: string; frequency?: string; label?: string; custom?: boolean }[];
      therapies: string[];
      recoveryGoals: string[];
    } | null = null;

    if (therapeuticSupport) {
      const raw = ((user as any).therapeuticSupportContext as any) ?? null;
      if (raw && typeof raw === "object") {
        const parseTherapeuticEntries = (arr: any[]) => {
          if (!Array.isArray(arr)) return [];
          return arr
            .filter(e => e && typeof e === "object" && e.type && Number(e.dose) > 0)
            .map(e => ({
              type: String(e.type),
              dose: Number(e.dose),
              unit: String(e.unit ?? ""),
              frequency: e.frequency ? String(e.frequency) : undefined,
              label: e.label ? String(e.label) : undefined,
              custom: !!e.custom,
            }));
        };
        therapeuticSupportCtx = {
          peptides: parseTherapeuticEntries(raw.peptides ?? []),
          hormones: parseTherapeuticEntries(raw.hormones ?? []),
          medications: parseTherapeuticEntries(raw.medications ?? []),
          therapies: Array.isArray(raw.therapies) ? raw.therapies.map(String) : [],
          recoveryGoals: Array.isArray(raw.recoveryGoals) ? raw.recoveryGoals.map(String) : [],
        };
      }
    }

    // ── ALPHA-GAL SYNDROME — clinical allergy protocol ────────────────────────
    // Fires when "alpha-gal-syndrome" is found in healthConditions or specialtyConditions.
    // Fails closed: if profile is absent or incomplete, conservative defaults apply.
    const ALPHA_GAL_CONDITION_KEYS = new Set([
      "alpha-gal-syndrome", "alpha-gal syndrome", "alpha gal syndrome", "alpha-gal", "alpha gal",
    ]);
    const alphaGalActive =
      specialtyConditionsArr.some(c => ALPHA_GAL_CONDITION_KEYS.has(c.trim().toLowerCase())) ||
      mergedHealthConditions.some(c => ALPHA_GAL_CONDITION_KEYS.has(c.trim().toLowerCase()));

    let alphaGalCtx: {
      active: boolean;
      dairyTolerance: "yes" | "no" | "unsure";
      gelatinRestriction: "yes" | "no" | "unsure";
      severeReactionHistory: "yes" | "no" | "unsure";
      profileComplete: boolean;
    } | null = null;

    if (alphaGalActive) {
      const rawAlphaGal = (user as any).alphaGalProfile as any;
      if (rawAlphaGal && typeof rawAlphaGal === "object" && rawAlphaGal.profileComplete) {
        alphaGalCtx = {
          active: true,
          dairyTolerance: rawAlphaGal.dairyTolerance ?? "unsure",
          gelatinRestriction: rawAlphaGal.gelatinRestriction ?? "unsure",
          severeReactionHistory: rawAlphaGal.severeReactionHistory ?? "unsure",
          profileComplete: true,
        };
      } else {
        // ALPHAGAL-EMERGENCY-001: No profile or incomplete — conservative fail-closed defaults
        alphaGalCtx = {
          active: true,
          dairyTolerance: "unsure",
          gelatinRestriction: "unsure",
          severeReactionHistory: "unsure",
          profileComplete: false,
        };
      }
    }

    // ── PERFORMANCE NUTRITION — additive modifier ─────────────────────────────
    const performanceNutrition: boolean = specialtyConditionsArr.includes("performance-nutrition");
    let performanceNutritionCtx: {
      active: boolean;
      primaryGoal: string;
      trainingType: string;
      trainingFrequency: string;
      cardioFocus: string;
      trainingPhase: string;
      twoADays: boolean;
      sessionDuration?: string;
      recoveryStatus?: string;
      adaptationTarget?: string;
      adaptationTargets?: string[];
    } | null = null;

    let performanceDemandProfile: DemandProfile | null = null;

    if (performanceNutrition) {
      const rawPerf = ((user as any).performanceContext as {
        primaryGoal?: string;
        trainingType?: string;
        trainingFrequency?: string;
        cardioFocus?: string;
        trainingPhase?: string;
        twoADays?: boolean;
        sessionDuration?: string;
        recoveryStatus?: string;
        adaptationTarget?: string;
        adaptationTargets?: string[];
      } | null) ?? null;

      if (rawPerf?.primaryGoal && rawPerf?.trainingType) {
        performanceNutritionCtx = {
          active: true,
          primaryGoal: rawPerf.primaryGoal,
          trainingType: rawPerf.trainingType,
          trainingFrequency: rawPerf.trainingFrequency ?? "3-4",
          cardioFocus: rawPerf.cardioFocus ?? "mixed",
          trainingPhase: rawPerf.trainingPhase ?? "in_season",
          twoADays: rawPerf.twoADays ?? false,
          sessionDuration: rawPerf.sessionDuration,
          recoveryStatus: rawPerf.recoveryStatus,
          adaptationTarget: rawPerf.adaptationTarget,
          adaptationTargets: rawPerf.adaptationTargets,
        };
        performanceDemandProfile = computeDemandProfile(rawPerf as any);
      }
    }

    // ── COMPETITION PREP — date-driven additive modifier ─────────────────────
    const competitionPrep: boolean = specialtyConditionsArr.includes("competition-prep");
    let competitionPrepCtx: {
      active: boolean;
      competitionType: string;
      competitionTypeLabel: string;
      division?: string;
      eventDate: string;
      weeksOut: number;
      currentPhase: string;
      currentPhaseLabel: string;
      isPeakWeek: boolean;
      isEventDay: boolean;
      isPostEvent: boolean;
      category: "physique" | "strength" | "combat" | "wrestling" | "functional" | "endurance";
      currentWeight?: string;
      targetWeight?: string;
    } | null = null;

    if (competitionPrep) {
      const rawComp = ((user as any).competitionPrepContext as {
        competitionType?: string;
        division?: string;
        eventDate?: string;
        currentWeight?: string;
        targetWeight?: string;
      } | null) ?? null;

      if (rawComp?.competitionType && rawComp?.eventDate) {
        const compTypeLabels: Record<string, string> = {
          bodybuilding_show: "Bodybuilding Show", mens_physique: "Men's Physique",
          classic_physique: "Classic Physique", figure: "Figure", bikini: "Bikini",
          wellness: "Wellness", powerlifting_meet: "Powerlifting Meet",
          strongman_competition: "Strongman Competition",
          olympic_weightlifting_meet: "Olympic Weightlifting Meet",
          fight_camp: "Fight Camp", wrestling_season: "Wrestling Season",
          crossfit_competition: "CrossFit Competition", hyrox: "Hyrox",
          marathon: "Marathon", triathlon_race: "Triathlon Race", spartan_race: "Spartan Race",
        };
        try {
          const status = deriveCompPrepStatus(rawComp.eventDate, rawComp.competitionType as any);
          competitionPrepCtx = {
            active: true,
            competitionType: rawComp.competitionType,
            competitionTypeLabel: compTypeLabels[rawComp.competitionType] ?? rawComp.competitionType,
            division: rawComp.division,
            eventDate: rawComp.eventDate,
            weeksOut: status.weeksOut,
            currentPhase: status.currentPhase,
            currentPhaseLabel: status.currentPhaseLabel,
            isPeakWeek: status.isPeakWeek,
            isEventDay: status.isEventDay,
            isPostEvent: status.isPostEvent,
            category: status.category,
            currentWeight: rawComp.currentWeight,
            targetWeight: rawComp.targetWeight,
          };
        } catch {
          // Date engine failed — don't crash the envelope
        }
      }
    }

    const conditionGuidanceBlocks = await buildUniversalConditionGuidance({
      userId,
      healthConditions: mergedHealthConditions,
      oncologySupportContext,
      thyroidSupportContext: thyroidSupport
        ? {
            active: true,
            medication: thyroidMedication,
            labDriven: false,
            isAutoimmune: healthConditions.some(c =>
              ["hashimoto's", "hashimotos", "autoimmune thyroid"].includes(c.trim().toLowerCase())
            ) || specialtyConditionsArr.includes("hashimotos"),
            thyroidType: thyroidType ?? (
              specialtyConditionsArr.includes("hashimotos") ? "hashimotos" :
              specialtyConditionsArr.includes("hypothyroid") ? "hypothyroid" :
              specialtyConditionsArr.includes("hyperthyroid") ? "hyperthyroid" :
              null
            ),
          }
        : null,
      hormoneOptimization,
      menopause,
      perimenopause,
      metabolicRecovery,
      pregnancySupportContext: pregnancySupportCtx,
      performanceNutritionContext: performanceNutritionCtx,
      performanceDemandProfile,
      competitionPrepContext: competitionPrepCtx,
      therapeuticSupportContext: therapeuticSupportCtx,
      alphaGalContext: alphaGalCtx,
    });

    // ── GLP-1 DAILY BEHAVIORAL TOLERANCE ────────────────────────────────────
    // Resolved only for users who have a GLP-1 / metabolic medication in their
    // medical conditions. Falls back to null on any failure so the envelope
    // never crashes due to missing check-in data.
    // The resolved guidance string is pushed into conditionGuidanceBlocks so
    // every generator automatically receives today's tolerance state without
    // any per-generator wiring.
    let glp1DailyTolerance: DailyMedicationTolerance | null = null;
    if (medicalConditionsGlp1.length > 0) {
      try {
        glp1DailyTolerance = await resolveDailyMedicationTolerance({
          userId: String(userId),
        });
        conditionGuidanceBlocks.push(buildGlp1ToleranceBlock(glp1DailyTolerance));
      } catch (err) {
        console.warn("[ProtocolEnvelope] GLP-1 daily tolerance resolution failed:", err);
      }
    }

    const rawCarbCycle = ((user as any).carbCycleState as any);
    const carbCycleContext: UserProtocolEnvelope["carbCycleContext"] =
      rawCarbCycle && (rawCarbCycle.phase === "low_carb" || rawCarbCycle.phase === "refeed") && rawCarbCycle.carbTargetG > 0
        ? { phase: rawCarbCycle.phase as "low_carb" | "refeed", carbBudgetG: rawCarbCycle.carbTargetG, isRefeedDay: rawCarbCycle.phase === "refeed" }
        : null;

    // ── PROVIDER CLINICAL INTERVENTIONS ───────────────────────────────────────
    // Query active provider interventions for this patient and inject their
    // prompt directives into medicalHardLimits / medicalOptimization so that
    // every generator automatically honors provider directives with zero
    // per-generator wiring.
    let providerInterventions: UserProtocolEnvelope["providerInterventions"] = [];
    let interventionPatientSummary: string[] = [];

    try {
      const activeInterventions = await db
        .select({
          conditionKey:   providerClinicalInterventions.conditionKey,
          severity:       providerClinicalInterventions.severity,
          notes:          providerClinicalInterventions.notes,
          escalationFlag: providerClinicalInterventions.escalationFlag,
          activatedAt:    providerClinicalInterventions.activatedAt,
        })
        .from(providerClinicalInterventions)
        .where(
          and(
            eq(providerClinicalInterventions.clientUserId, userId),
            eq(providerClinicalInterventions.isActive, true)
          )
        );

      if (activeInterventions.length > 0) {
        providerInterventions = activeInterventions.map(i => ({
          conditionKey:   i.conditionKey as string,
          severity:       i.severity as string,
          notes:          i.notes ?? null,
          escalationFlag: i.escalationFlag ?? false,
          activatedAt:    i.activatedAt,
        }));

        const promptResult = buildInterventionPrompts(
          activeInterventions.map(i => ({
            conditionKey: i.conditionKey as ActiveIntervention["conditionKey"],
            severity:     i.severity as ActiveIntervention["severity"],
            notes:        i.notes ?? null,
          }))
        );

        if (promptResult.hardLimits.length > 0) {
          conditionGuidanceBlocks.push(...promptResult.hardLimits);
        }
        if (promptResult.optimization.length > 0) {
          optimization.push(...promptResult.optimization);
        }
        interventionPatientSummary = promptResult.patientSummaryLines;

        if (promptResult.escalationWarnings.length > 0) {
          console.warn(
            `[ProtocolEnvelope] ⚠️ Escalation warnings for user ${userId}:`,
            promptResult.escalationWarnings
          );
        }

        console.log(
          `[ProtocolEnvelope] 🏥 Provider interventions active for user ${userId}:`,
          activeInterventions.map(i => `${i.conditionKey}:${i.severity}`).join(", ")
        );
      }
    } catch (err) {
      // Never crash envelope loading due to intervention query failure
      console.error(`[ProtocolEnvelope] Failed to load provider interventions for user ${userId}:`, err);
    }

    const envelope: any = {
      userId,
      dietaryIdentity: dietaryRestrictions,
      allergies,
      medicalHardLimits: hardLimits,
      medicalOptimization: optimization,
      avoidances,
      preferences,
      procedural,
      cuisinePreference: user.cuisinePreference ?? null,
      cuisineIntensity: (user.cuisineIntensity as "light" | "balanced" | "authentic" | null) ?? null,
      diabeticGuidance,
      hasDiabetes,
      diabeticGlucoseState,
      conditionGuidanceBlocks,
      glp1DailyTolerance,
      thyroidSupport,
      thyroidMedication,
      thyroidType,
      hormoneOptimization,
      measurementSystem: ((user as any).measurementSystem as "imperial" | "metric") ?? "imperial",
      fitnessGoal: (user.fitnessGoal as string | null) ?? null,
      goalType: ((user as any).goalType as "lose" | "maintain" | "gain" | null) ?? null,
      goalTarget: ((user as any).goalTarget as string | null) ?? null,
      performanceOverlay: (((user as any).performanceOverlay as string | null) ?? "standard") as "standard"|"performance"|"competition_prep"|"recovery"|"recomp",
      performanceControlMode: (((user as any).performanceControlMode as string | null) ?? "self_guided") as "self_guided"|"coach_controlled",
      pregnancySupport,
      pregnancySupportContext: pregnancySupportCtx,
      carbCycleContext,
      performanceNutrition,
      performanceContext: performanceNutritionCtx,
      performanceLayer: performanceDemandProfile,
      therapeuticSupport,
      therapeuticSupportContext: therapeuticSupportCtx,
      selectedMealBuilder: (user.selectedMealBuilder ?? null) as string | null,
      preferredLanguage: (user as any).preferredLanguage || null,
      flavorPreference: (user as any).flavorPreference ?? null,
      heatPreference: (user as any).heatPreference ?? null,
      palateSpiceTolerance: (user as any).palateSpiceTolerance ?? null,
      palateSeasoningIntensity: (user as any).palateSeasoningIntensity ?? null,
      palateFlavorStyle: (user as any).palateFlavorStyle ?? null,
      dailyNutritionState: null,
      providerInterventions,
      interventionPatientSummary,
    };

    // ── DAILY NUTRITION STATE — resolve only when performance-nutrition is active ─
    if (performanceNutrition) {
      try {
        const wts = (user as any).weeklyTrainingSchedule ?? null;
        const ppc = (user as any).performanceProtocolConfig ?? null;
        const baseCarbsG = Number((user as any).dailyCarbsTarget ?? 200);
        const rawStarchy = (user as any).dailyStarchyCarbsTarget;
        const rawFibrous = (user as any).dailyFibrousCarbsTarget;
        const baseline = {
          calories:      Number((user as any).dailyCalorieTarget ?? 2000),
          proteinG:      Number((user as any).dailyProteinTarget ?? 150),
          carbsG:        baseCarbsG,
          fatG:          Number((user as any).dailyFatTarget ?? 65),
          starchyCarbsG: rawStarchy !== null && rawStarchy !== undefined
            ? Number(rawStarchy)
            : Math.round(baseCarbsG * 0.7),
          fibrousCarbsG: rawFibrous !== null && rawFibrous !== undefined
            ? Number(rawFibrous)
            : Math.round(baseCarbsG * 0.3),
        };
        envelope.dailyNutritionState = await resolveDailyNutritionState({
          userId:           String(userId),
          schedule:         wts,
          config:           ppc,
          baseline,
          timezone:         ((user as any).timezone as string | null) ?? "America/Chicago",
          performanceActive: true,
        });
      } catch (err) {
        console.warn("[ProtocolEnvelope] Daily nutrition state resolution failed:", err);
      }
    }

    return envelope;
  } catch (error) {
    console.error("[ProtocolEnvelope] Failed to load envelope:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GLP-1 TOLERANCE BLOCK BUILDER
// Converts a DailyMedicationTolerance into a self-contained directive string
// for injection into conditionGuidanceBlocks. Directional language only —
// no invented calorie or macro numbers.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the GLP-1 daily tolerance block for injection into generator prompts.
 *
 * Layout (order is mandatory):
 *   1. SAFETY ESCALATIONS — first, unmistakably urgent, visually distinct.
 *      These are provider-contact directives. They must not be treated as
 *      nutrition preferences and must not be reframed as meal modifications
 *      by any generator. If present, they override normal meal guidance.
 *   2. NUTRITION ADAPTATIONS — dietary modification directives derived from
 *      current GI symptoms. Safe for prompt injection as meal constraints.
 *
 * Uses t.safetyEscalations[] and t.nutritionAdaptations[] directly — the
 * resolver owns the content, the envelope owns the injection format.
 */
function buildGlp1ToleranceBlock(t: DailyMedicationTolerance): string {
  const sections: string[] = [`[GLP-1 Daily Tolerance — ${t.date}]`];

  // ── Safety escalations FIRST ─────────────────────────────────────────────
  // These are SAFETY DIRECTIVES, not dietary preferences.
  // Any generator receiving this block must surface them to the user as urgent
  // patient safety guidance — never dilute them into a meal recommendation.
  if (t.safetyEscalations.length > 0) {
    sections.push(
      "━━━ ⚠️  SAFETY DIRECTIVES — READ BEFORE GENERATING ━━━",
      ...t.safetyEscalations,
      "━━━ END SAFETY DIRECTIVES ━━━"
    );
  }

  // ── Nutrition adaptations ─────────────────────────────────────────────────
  // Meal and food modification constraints. Safe for meal planning context.
  if (t.nutritionAdaptations.length > 0) {
    sections.push("── Nutrition Adaptations ──", ...t.nutritionAdaptations);
  }

  return sections.join("\n");
}

/**
 * Build an empty envelope for unauthenticated or guest contexts.
 * Generators should use this instead of skipping enforcement entirely.
 */
export function buildGuestEnvelope(): UserProtocolEnvelope {
  return {
    userId: "guest",
    dietaryIdentity: [],
    allergies: [],
    medicalHardLimits: [],
    medicalOptimization: [],
    avoidances: [],
    preferences: [],
    procedural: deriveProcedureRules([]),
    cuisinePreference: null,
    cuisineIntensity: null,
    diabeticGuidance: null,
    hasDiabetes: false,
    diabeticGlucoseState: null,
    conditionGuidanceBlocks: [],
    glp1DailyTolerance: null,
    thyroidSupport: false,
    thyroidMedication: null,
    thyroidType: null,
    hormoneOptimization: false,
    measurementSystem: "imperial",
    fitnessGoal: null,
    goalType: null,
    goalTarget: null,
    performanceOverlay: "standard",
    performanceControlMode: "self_guided",
    pregnancySupport: false,
    pregnancySupportContext: null,
    carbCycleContext: null,
    performanceNutrition: false,
    performanceContext: null,
    performanceLayer: null,
    dailyNutritionState: null,
    therapeuticSupport: false,
    therapeuticSupportContext: null,
    selectedMealBuilder: null,
    preferredLanguage: null,
    flavorPreference: null,
    heatPreference: null,
    palateSpiceTolerance: null,
    palateSeasoningIntensity: null,
    palateFlavorStyle: null,
    providerInterventions: [],
    interventionPatientSummary: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-GENERATION ENFORCEMENT
// Call this before any AI prompt is built.
// Returns a structured prompt block to inject into the generator.
// ─────────────────────────────────────────────────────────────────────────────

function expandAvoidances(avoidances: string[]): string[] {
  const expanded = new Set<string>();
  for (const item of avoidances) {
    const key = item.trim().toLowerCase();
    expanded.add(key);
    const mapped = AVOIDANCE_EXPANSION[key];
    if (mapped) mapped.forEach(t => expanded.add(t));
  }
  return Array.from(expanded);
}

function expandDietaryIdentity(dietaryIdentity: string[]): string[] {
  const expanded = new Set<string>();
  for (const identity of dietaryIdentity) {
    const key = identity.trim().toLowerCase();
    const mapped = RESTRICTION_EXPANSION[key];
    if (mapped) mapped.forEach(t => expanded.add(t));
  }
  return Array.from(expanded);
}

/**
 * Enforce the protocol envelope before generation begins.
 *
 * Call this at the start of every generator, before constructing the AI prompt.
 * The returned ProtocolPromptBlock must be injected into the prompt.
 *
 * Priority order enforced in the output text:
 *   Dietary Identity → Allergies → Medical Hard Limits → Procedural → Avoidances → Preferences
 */
export function enforceBeforeGenerate(
  envelope: UserProtocolEnvelope,
  context?: {
    userInput?: string;
    generatorName?: string;
    /** Actor user ID — when provided, triggers a PROMPT_PHI_AUDIT log entry for any T1/T2 fields present */
    actorId?: string;
    /** Organization ID for the audit log entry */
    orgId?: string | null;
  }
): ProtocolPromptBlock {
  const generatorName = context?.generatorName || "unknown_generator";
  const layers: ProtocolPromptBlock["layers"] = {
    dietaryIdentity: "",
    allergies: "",
    medicalHardLimits: "",
    performanceIntent: "",
    avoidances: "",
    procedural: "",
    preferences: "",
  };

  // ── TIER 1: Dietary Identity ───────────────────────────────────────────────
  if (envelope.dietaryIdentity.length > 0) {
    const identityList = envelope.dietaryIdentity.join(", ");
    const expandedForbidden = expandDietaryIdentity(envelope.dietaryIdentity);
    const forbiddenText = expandedForbidden.length > 0
      ? `\n   Forbidden ingredients for this protocol: ${expandedForbidden.slice(0, 40).join(", ")}${expandedForbidden.length > 40 ? ", and more" : ""}.`
      : "";
    layers.dietaryIdentity = `\n🔒 DIETARY IDENTITY — OUTERMOST RULE (applies before everything else):
This user follows: ${identityList}.
ALL generated content must exist entirely within this dietary universe.
No medical optimization, flavor preference, or craving may generate food outside this protocol.${forbiddenText}`;
  }

  // ── TIER 2: Allergies ──────────────────────────────────────────────────────
  if (envelope.allergies.length > 0) {
    const allergyList = envelope.allergies.join(", ");
    layers.allergies = `\n🚨 ALLERGY BLOCK — ABSOLUTE MEDICAL SAFETY (cannot be overridden by any rule):
This user has confirmed allergies to: ${allergyList}.
Do NOT include these or any derivative, hidden, or compound form in the output.
This is a hard stop — not a preference.`;
  }

  // ── TIER 3: Medical Hard Limits ────────────────────────────────────────────
  if (envelope.medicalHardLimits.length > 0) {
    const limitList = envelope.medicalHardLimits.join(", ");

    // Real-time blood glucose guidance — injected here so it travels universally
    // to every generator, not only the Diabetic Hub.
    const glucoseBlock = envelope.diabeticGuidance
      ? `\n\n🩸 REAL-TIME BLOOD GLUCOSE GUIDANCE (current reading — HIGHEST PRIORITY within diabetic constraints):\n${envelope.diabeticGuidance}\nThis guidance is based on the user's actual current glucose reading and overrides generic diabetic defaults. Adjust carb targets, meal composition, and food choices accordingly.`
      : "";

    layers.medicalHardLimits = `\n⚕️ MEDICAL HARD LIMITS (apply inside the dietary identity container):
This user has: ${limitList}.
Respect the medical constraints for these conditions while staying inside the dietary identity.
Example: if diabetic + vegan, optimize carbs WITHIN vegan-safe foods only — never add animal products.${glucoseBlock}

MULTI-CONSTRAINT ADAPTATION RULE (REQUIRED — enforces the exact priority hierarchy):
When multiple constraints are present (medical condition + diet identity + cultural cuisine), resolve them in this exact order:
  1. MEDICAL SAFETY FIRST — diabetic carb control, renal limits, GLP-1 considerations, cardiac, oncology, allergies. These are not suggestions. They cannot be overridden.
  2. DIET IDENTITY SECOND — vegan, vegetarian, pescatarian, kosher, halal. These must not be broken under any circumstance, including medical adaptation.
  3. CULTURAL CUISINE THIRD — Korean, Vietnamese, Ethiopian, Cambodian, Japanese, Mexican. Preserve the cultural dish structure and flavor system inside layers 1 and 2.
  4. PREFERENCE LAST — spice level, taste, simple meals, favorite foods.

When conflicts occur between cultural authenticity and constraints 1 or 2:
  - Keep the original cultural dish archetype and core flavor profile
  - Replace or adjust ONLY the non-compliant components — using culturally local alternatives, not Western substitutes
  - Control glycemic load through portioning and fiber/protein pairing, not by eliminating the dish
  - Do NOT default to Western meals or generic "healthy bowls" — this is always wrong
  - Do NOT eliminate culturally essential staples — instead reduce portions or balance them with protein/fiber

If a traditional dish absolutely cannot be safely adapted within all constraints:
  → Select a different authentic dish from that same cuisine that satisfies all constraints
  → NEVER default to a Western alternative

CULTURAL STAPLE CARB RULE: For staple carbohydrates tied to a cuisine (rice, injera, rice noodles, tortillas, bread):
  - Allow in controlled portions — do NOT hard-ban them for diabetic users
  - Pair with protein, fiber, or fat to reduce glycemic impact
  - Ensure total meal carbs stay within the diabetic limit
  - Prefer lower-glycemic preparation when possible (e.g., cooled rice has lower GI than hot)
  - A smaller injera portion with extra lentils and greens is CORRECT. A "low-carb bowl" replacing the entire cultural base is NOT.

For vegan users: all adaptations must remain fully plant-based — no exceptions even when adapting for medical constraints.`;
  }

  // ── CONDITION GUIDANCE BLOCKS (unconditional — fires for all active specialty conditions) ───
  // GLP-1, Anti-Inflammatory, Renal, Cardiac, Liver, Oncology, Pregnancy, Thyroid,
  // Hormone Optimization, Menopause, Performance Nutrition, Competition Prep, etc.
  // Previously this block was only injected when medicalHardLimits was non-empty,
  // which meant athletes with ONLY performance-nutrition (no medical hard limits)
  // never received their condition guidance. This is fixed: condition blocks now fire
  // unconditionally so every specialty condition's directives reach the AI prompt.
  const conditionGuidanceBlocks = envelope.conditionGuidanceBlocks ?? [];
  if (conditionGuidanceBlocks.length > 0) {
    const conditionBlockText = conditionGuidanceBlocks
      .map(block => `\n\n${block}`)
      .join("");
    if (layers.medicalHardLimits) {
      // Append after existing medical hard limits text
      layers.medicalHardLimits += conditionBlockText;
    } else {
      // No medical hard limits but specialty conditions are active
      layers.medicalHardLimits = conditionBlockText.trimStart();
    }
  }

  // ── PROCEDURAL LAYER ──────────────────────────────────────────────────────
  // Instruction-level compliance: applies to how the food is prepared,
  // stored, handled, and presented — not just what ingredients are used.
  const p = envelope.procedural;
  const proceduralParts: string[] = [];

  if (p.preparationRules.length > 0) {
    proceduralParts.push(`PREPARATION RULES:\n${p.preparationRules.map(r => `   - ${r}`).join("\n")}`);
  }
  if (p.storageRules.length > 0) {
    proceduralParts.push(`STORAGE AND SEPARATION RULES:\n${p.storageRules.map(r => `   - ${r}`).join("\n")}`);
  }
  if (p.equipmentRules.length > 0) {
    proceduralParts.push(`EQUIPMENT AND UTENSIL RULES:\n${p.equipmentRules.map(r => `   - ${r}`).join("\n")}`);
  }
  if (p.forbiddenInstructions.length > 0) {
    proceduralParts.push(`FORBIDDEN INSTRUCTION PHRASES (must NEVER appear in cooking steps):\n${p.forbiddenInstructions.map(r => `   - "${r}"`).join("\n")}`);
  }
  if (p.requiredInstructionNotes.length > 0) {
    proceduralParts.push(`REQUIRED INSTRUCTION NOTES (must appear in cooking steps):\n${p.requiredInstructionNotes.map(r => `   - ${r}`).join("\n")}`);
  }
  if (p.crossContaminationRules.length > 0) {
    proceduralParts.push(`CROSS-CONTAMINATION RULES:\n${p.crossContaminationRules.map(r => `   - ${r}`).join("\n")}`);
  }

  if (proceduralParts.length > 0) {
    layers.procedural = `\n📋 PROCEDURAL COMPLIANCE — INSTRUCTION-LEVEL RULES (applies to how the food is made, not just what is in it):
A meal can be ingredient-correct and still be protocol-wrong if the instructions violate these rules.
${proceduralParts.join("\n")}`;
  }

  // ── TIER 5: Performance Intent ────────────────────────────────────────────
  // Shapes macro bias, protein floor, carb allocation, and AI generation emphasis.
  // Sits below all medical/safety tiers — never overrides them.
  if (envelope.performanceOverlay && envelope.performanceOverlay !== "standard") {
    const overlayLabels: Record<string, string> = {
      performance:      "Performance",
      competition_prep: "Competition Prep",
      recovery:         "Recovery",
      recomp:           "Body Recomposition",
    };
    const overlayLabel = overlayLabels[envelope.performanceOverlay] ?? envelope.performanceOverlay;
    const directives: Record<string, string> = {
      performance: `This user is in Performance mode. Within all medical/dietary constraints above:\n- Prioritize adequate protein for muscle recovery (lean sources preferred)\n- Include balanced complex carbohydrates for training energy\n- Emphasize whole food nutrient density\n- Support meal timing context (pre/post workout when relevant)`,
      competition_prep: `This user is in Competition Prep mode. Within all medical/dietary constraints above:\n- Prioritize high protein from lean sources (chicken breast, white fish, egg whites, lean turkey, Greek yogurt)\n- Minimize starchy carbs — prefer fibrous carbohydrates (leafy greens, non-starchy vegetables)\n- Avoid sugar and heavily processed ingredients\n- Use lean preparation methods (grilled, baked, steamed — not fried or cream-sauced)\n- Maximize satiety despite lower caloric density\nThis tightens within active constraints — it never replaces medical or dietary rules.`,
      recovery: `This user is in Recovery mode. Within all medical/dietary constraints above:\n- Prioritize anti-inflammatory foods (omega-3 proteins, colorful vegetables, berries)\n- Adequate protein for muscle repair\n- Complex carbohydrates for glycogen replenishment\n- Easy-to-digest preparations and gentle cooking methods`,
      recomp: `This user is in Body Recomposition mode. Within all medical/dietary constraints above:\n- Protein-first in every meal (lean, high-quality sources)\n- Moderate complex carbohydrates timed around activity\n- Controlled portions with high nutrient density\n- Balanced macros without aggressive caloric deficit`,
    };
    const directive = directives[envelope.performanceOverlay];
    if (directive) {
      layers.performanceIntent = `\n🏋️ PERFORMANCE INTENT — ${overlayLabel.toUpperCase()} (applies within all safety and medical rules above):\n${directive}`;
    }
  }

  // ── CARB CYCLE HARD CONSTRAINT (appended to performanceIntent layer) ──────
  if (envelope.carbCycleContext) {
    const cc = envelope.carbCycleContext;
    const phaseLabel = cc.isRefeedDay ? "REFEED DAY — STARCH LOAD" : "LOW-STARCH DAY";
    const ccDirective = cc.isRefeedDay
      ? `STARCH ALLOCATION: ${cc.carbBudgetG}g. This is a metabolic refeed. Increase starchy carbohydrates (rice, oats, potatoes, sweet potato, cream of rice) to meet the allocation. Fibrous vegetables (broccoli, spinach, zucchini, asparagus, greens) are UNRESTRICTED — do NOT reduce them. Protein target is unchanged.`
      : `STARCH ALLOCATION: ${cc.carbBudgetG}g. This is a starch-restriction day. Keep all starchy carb sources (rice, oats, bread, pasta, potatoes, corn, beans) at or below ${cc.carbBudgetG}g total. Fibrous vegetables (broccoli, spinach, zucchini, asparagus, greens) are UNRESTRICTED and should fill volume. Protein and healthy fats are the priority.`;
    layers.performanceIntent += `\n\n⚡ STARCH RESPONSE PROTOCOL — HARD CONSTRAINT (${phaseLabel}):\n${ccDirective}\nThis limit applies to STARCH ONLY. It does not restrict fibrous vegetables. It operates alongside existing macro constraints.`;
  }

  // ── PERFORMANCE DEMAND LAYER (Tier 5b — fires unconditionally for all performance-nutrition users) ──
  // Uses the computed DemandProfile from shared/performanceDemandEngine.ts to inject
  // precise, session-specific fuel/recovery/adaptation directives into the AI prompt.
  // Additive only — positioned below all medical/dietary Tiers 1–4 and never overrides them.
  // This calls the same logic as buildPerformanceTimingBlock() in promptBuilder.ts,
  // inlined here to avoid circular imports (promptBuilder.ts → mealEngineService.ts → protocolEnvelope.ts).
  if (envelope.performanceLayer && envelope.performanceNutrition) {
    const d = envelope.performanceLayer;
    const fuelDirectiveMap: Record<string, string> = {
      low:         "FUEL DEMAND — LOW: Low-volume or deficit phase. Minimal carbohydrate support. Lean protein and fibrous vegetables are the priority. Avoid calorie-dense starchy carb sources.",
      moderate:    "FUEL DEMAND — MODERATE: Include a moderate complex carbohydrate component. No restriction, but carb timing around training is preferred.",
      glycogen:    "FUEL DEMAND — GLYCOGEN SUPPORT: High training volume demands substantial carbohydrate support. Include a meaningful complex carbohydrate source at every meal. Post-workout: fast carb + protein combination required.",
      competition: "FUEL DEMAND — COMPETITION LEVEL: Maximum glycolytic demand. Every meal must include a substantial complex carbohydrate source. Post-training carb + protein within 45 minutes is critical.",
    };
    const recoveryDirectiveMap: Record<string, string> = {
      low:      "",
      moderate: "RECOVERY: Include anti-inflammatory ingredients where possible (omega-3 sources, colorful vegetables, turmeric, ginger).",
      high:     "RECOVERY PRIORITY — HIGH: Heavy training load detected. Every meal must support tissue repair. Prioritize omega-3 rich fish (salmon, sardines), antioxidant vegetables, turmeric, ginger, magnesium-rich foods (leafy greens, pumpkin seeds). Protein ≥30g per meal.",
    };
    const adaptDirectiveMap: Record<string, string> = {
      endurance_focused:        "ADAPTATION — ENDURANCE: Prioritize aerobic fuels: oats, sweet potato, banana, whole grains, healthy fats.",
      power_focused:            "ADAPTATION — POWER/SPEED: Explosive output nutrition. Lean red meat or fish, zinc-rich foods, magnesium-rich greens, fast-digesting post-workout carbs.",
      recovery_focused:         "ADAPTATION — RECOVERY: Anti-inflammatory and repair nutrition. Omega-3s, antioxidants, adequate protein, magnesium sources.",
      body_composition_focused: "ADAPTATION — BODY COMPOSITION: High protein floor (≥30g/meal), controlled carbohydrate timing, quality fats.",
    };
    const loadNoteMap: Record<string, string> = {
      elite:    "TRAINING LOAD — ELITE: Two-a-days or 7+ sessions/week. Intermediate recovery meals are critical: easily digestible carb + protein options between sessions.",
      high:     "TRAINING LOAD — HIGH: 5–6 sessions/week or 90+ min sessions. Ensure adequate total caloric density.",
      moderate: "",
      light:    "",
    };
    const priorityLine = d.nutritionPriorities.length > 0
      ? `NUTRITION PRIORITIES (ordered): ${d.nutritionPriorities.join(" → ")}.`
      : "";
    const demandLines = [
      fuelDirectiveMap[d.fuelDemand] ?? "",
      recoveryDirectiveMap[d.recoveryDemand] ?? "",
      adaptDirectiveMap[d.adaptationDemand] ?? "",
      loadNoteMap[d.trainingLoad] ?? "",
      priorityLine,
    ].filter(Boolean).join("\n");
    if (demandLines) {
      layers.performanceIntent += `\n\n⚡ PERFORMANCE DEMAND LAYER — ACTIVE (computed from athlete training profile):\n${demandLines}\nThis demand profile is derived from the user's training type, frequency, duration, recovery status, and adaptation target. It operates as an additive shaping layer — it tightens or shifts meal composition within all active medical and dietary constraints above. It never overrides Tiers 1–4.`;
    }
  }

  // ── DAILY NUTRITION STATE — day-specific carb constraint (Tier 5c) ─────────
  // Injected after the general performance demand layer so it can tighten or
  // override the generic carb guidance with today's actual schedule and budget.
  // Only fires when the performance schedule is configured and today's session
  // type has been resolved. Never fires for guest envelopes or users without
  // an active performance-nutrition protocol.
  if (
    envelope.dailyNutritionState?.scheduleConfigured &&
    envelope.dailyNutritionState.preGenerationConstraint
  ) {
    layers.performanceIntent +=
      `\n\n${envelope.dailyNutritionState.preGenerationConstraint}\n` +
      `This day-specific rule is derived from the user's weekly training schedule and ` +
      `today's confirmed consumption. It is a hard constraint — it supersedes any general ` +
      `carbohydrate guidance above for this specific recommendation. Medical safety rules ` +
      `(Tiers 1–4) still take absolute precedence.`;
  }

  // ── TIER 6: Avoidances ────────────────────────────────────────────────────
  if (envelope.avoidances.length > 0) {
    const expandedAvoidances = expandAvoidances(envelope.avoidances);
    const avoidList = expandedAvoidances.join(", ");
    const inputHint = context?.userInput
      ? `\n   If the user's request ("${context.userInput}") names an avoided ingredient, substitute with a compliant alternative and keep the dish style.`
      : "";
    layers.avoidances = `\n⛔ FOODS TO AVOID (user preference — applies after dietary identity and medical rules):
The user has marked these as foods they do not eat: ${avoidList}
- Do NOT include any of these as a main ingredient, in a sauce, broth, seasoning, garnish, or coating.${inputHint}
- This rule has no exceptions once dietary identity and medical limits are satisfied.`;
  }

  // ── TIER 7: Preferences ───────────────────────────────────────────────────
  if (envelope.preferences.length > 0) {
    const prefList = envelope.preferences.join(", ");
    layers.preferences = `\n✅ PREFERENCES (apply last, only within all constraints above):
When possible, incorporate: ${prefList}.`;
  }

  // ── CUISINE CULTURAL GROUNDING (culture-first generation — below all safety/diet tiers) ───
  if (envelope.cuisinePreference) {
    const intensity = envelope.cuisineIntensity ?? "balanced";

    // Determine whether this user has active health-directive constraints.
    // Allergies are always enforced regardless — this only controls whether
    // nutritional optimization is applied on top of cultural authenticity.
    const isHealthConstrained =
      envelope.medicalHardLimits.length > 0 ||
      envelope.medicalOptimization.length > 0 ||
      envelope.dietaryIdentity.length > 0;

    // True authentic = user chose "authentic" AND has no active health constraints.
    // In this mode, traditional ingredients (lard, butter, sugar, cream, etc.) are
    // fully permitted. The user has explicitly chosen real cultural food over optimization.
    const trueAuthentic = intensity === "authentic" && !isHealthConstrained;

    const intensityDepth: Record<string, string> = {
      light: "Keep the dish exactly as it is culturally — same cut, same format, same name — and make it lighter by changing what you ADD to it, not what it is. CRITICAL: Do NOT swap the protein cut (chicken thighs stay thighs — do NOT change to chicken breast), do NOT rename the dish, do NOT replace it with a different dish format. The lightening happens through ingredient-level adjustments: swap lard for olive oil or a small amount of heart-healthy fat, drain excess fat after cooking, skip added sugar, use a smaller amount of the cooking fat, choose a leaner preparation of the same protein. The dish identity is completely preserved. A light soul food plate is still soul food: chicken thighs (drained, not breast), braised collard greens (olive oil not lard), cornbread without added sugar — NOT a 'Grilled Chicken Salad.' A light Mexican meal is still Mexican: same tortillas, same proteins, less oil in the pan — NOT a 'burrito bowl.' Do NOT produce any output that looks like a generic health-food version of the cuisine. If the output could pass for a meal from a different cuisine or a generic 'healthy' restaurant, it is WRONG — rebuild it inside the original cuisine.",
      balanced: "Apply full cultural structure — meal format, ingredients, and flavor system must reflect how people in this cuisine actually eat. Avoid Western defaults. Smart health-aware ingredient choices are applied.",
      authentic: trueAuthentic
        ? "Apply strict cultural authenticity — every element (dish format, proteins, starches, vegetables, cooking fats, seasoning) must be drawn from this cuisine's real food traditions. Traditional ingredients including butter, lard, rendered animal fats, cream, honey, sugars, and culturally authentic carbohydrates are fully permitted and expected. Do NOT make healthy substitutions."
        : "Apply strict cultural authenticity — every element (dish format, proteins, starches, vegetables, seasoning) must be drawn from this cuisine's real food traditions. Cultural dish structure is preserved as closely as possible within the user's active health constraints. When adapting, use culturally local alternatives — never Western substitutes.",
    };
    const depthInstruction = intensityDepth[intensity] || intensityDepth["balanced"];

    // Build the optional authentic mode block
    const authenticModeBlock = trueAuthentic
      ? `
AUTHENTIC MODE — HEALTH OPTIMIZATION SUSPENDED (user choice):
This user has no active dietary restrictions or medical conditions and has explicitly chosen Authentic cuisine mode.
Traditional ingredients are fully permitted and expected: butter, lard, rendered animal fats (duck fat, tallow, manteca),
cream, full-fat dairy, honey, brown sugar, refined sugars, white rice, white bread, and any cooking method traditional
to this cuisine including deep frying and slow braising in traditional fats.
Do NOT make healthy substitutions. Do NOT reduce fat or sugar for health reasons. Do NOT swap traditional protein cuts
for leaner alternatives. Serve the dish exactly as it is traditionally prepared in its culture of origin.
Allergies (if any) remain the only active safety stop — all other nutritional optimization is intentionally suspended.
`
      : intensity === "authentic"
        ? `
AUTHENTIC WITH PROTECTION: This user has chosen Authentic cuisine mode but has active health settings.
Cultural dish structure and flavor system are preserved as closely as possible within those constraints.
When adapting for health requirements, use culturally local alternatives — not Western substitutes.
The meal must still feel authentically from this cuisine to someone who grew up eating it.
`
        : "";

    const sectionHeader = trueAuthentic
      ? `\n\n🌍 AUTHENTIC MODE — TRUE CULTURAL FOOD (health optimization suspended by user choice):`
      : `\n\n🌍 CULTURAL GROUNDING — REQUIRED (never overrides diet, allergy, or medical rules):`;

    layers.preferences = (layers.preferences || "") + `${sectionHeader}
Cuisine: ${envelope.cuisinePreference}
Intensity: ${intensity} — ${depthInstruction}
${authenticModeBlock}

BEFORE GENERATING THE MEAL, internally determine all four of the following:
1. EATING PATTERN — What do people in ${envelope.cuisinePreference} cuisine actually eat at the requested meal time? Do NOT assume Western breakfast/lunch/dinner patterns. Identify the real-world eating pattern for this culture (e.g., rice porridge for breakfast, noodle soup, grilled meat with rice — not scrambled eggs or oatmeal).
2. DISH FORMAT — What is the culturally appropriate dish structure? (e.g., bowl, soup, grilled plate, stir-fry, wrapped dish, porridge, flatbread with sides) — the format must match how this cuisine is typically served, not a generic Western container.
3. CORE INGREDIENT SET — What proteins, starches, and vegetables are commonly used in ${envelope.cuisinePreference} cuisine? Prefer culturally authentic ingredients. Only substitute when required by dietary, allergy, or medical constraints.
4. FLAVOR SYSTEM — What defines the flavor architecture of this cuisine? (e.g., fish sauce + lime + palm sugar + garlic for Southeast Asian; miso + dashi + soy for Japanese; berbere + niter kibbeh for Ethiopian) Apply this flavor system, not a generic "exotic spice" approximation.

GENERATION RULES:
- Build the meal ONLY from the cultural framework determined above
- Do NOT start from a Western meal template and add cultural elements on top
- Do NOT produce hybrid meals unless required by dietary or medical constraints
- Prefer culturally authentic proteins, starches, and vegetables — avoid substituting culturally foreign ingredients (e.g., ground turkey in Cambodian food, quinoa in traditional cuisines) unless the user's diet/medical rules require it
- If a conflict exists between cultural authenticity and dietary/medical/allergy constraints, safety and diet always win — but find the nearest culturally plausible compliant alternative, not the nearest Western alternative. Adapt the dish inside the cuisine: keep the flavor profile, adjust the components. Examples of correct adaptation: Vietnamese diabetic vegan → Gỏi Chay (tofu/herb salad with fish sauce substitute + lime) instead of pho with rice noodles; Ethiopian diabetic → smaller injera portion with extra Misir Wat and Gomen instead of a full injera platter; Japanese diabetic → half-portion rice with extra protein and seaweed instead of a full donburi. The meal must still feel like the cuisine to someone who grew up eating it.

REJECTION RULE:
If the meal you are about to generate resembles a Western template (scramble, wrap, sandwich, yogurt bowl, quinoa bowl, oatmeal) with minor cultural additions — DISCARD it and rebuild using the cultural framework above.

STRUCTURAL ENFORCEMENT RULE:
The dish format MUST match a real, commonly consumed meal structure within ${envelope.cuisinePreference} cuisine at the requested meal time. Do NOT assume that a format common in other cuisines (e.g., stir-fry for Southeast Asian breakfast, congee for all East Asian cuisines, curry for all South Asian cuisines) is automatically correct for this specific cuisine. Ask: do people in ${envelope.cuisinePreference} actually eat this dish format at this meal time? If the answer is no or uncertain — REJECT the format and rebuild using a structure that is genuinely typical for this cuisine and meal time.

FORMAT AUTHENTICITY RULE:
Do NOT default to globally generic formats such as "salad", "bowl", "wrap", or "balanced plate" unless those formats are clearly and commonly part of ${envelope.cuisinePreference} cuisine specifically. These formats are universal AI fallbacks — they signal that the AI is unsure and chose a safe container instead of thinking culturally. If the format you are considering is globally common but not culturally specific to ${envelope.cuisinePreference}, treat it as invalid and rebuild using a format that is distinctly and commonly found in that cuisine's real food traditions.

INGREDIENT AUTHENTICITY RULE:
Avoid generic "healthy" vegetables (e.g., broccoli, red bell pepper, kale, spinach, zucchini) UNLESS they are commonly used in ${envelope.cuisinePreference} cuisine. These ingredients signal that the AI defaulted to a generic health-food template instead of thinking culturally. Prefer vegetables, herbs, proteins, and starches that are genuinely and commonly found in ${envelope.cuisinePreference} home cooking and restaurants. When in doubt, choose the more culturally specific ingredient over the generically "healthy" one.

FLAVOR COMPLETENESS RULE:
Ensure the core flavor components of ${envelope.cuisinePreference} cuisine are present in the meal. Do NOT strip out foundational condiments, sauces, or seasoning agents in an attempt to "clean up" a dish — these are the flavor identity of the cuisine. Examples of non-negotiable flavor elements that MUST be included when the dish calls for them: Vietnamese dishes require fish sauce and citrus (lime); Japanese dishes require dashi, soy sauce, or mirin as appropriate; Ethiopian dishes require berbere and/or niter kibbeh; Cambodian dishes require fish sauce, lemongrass, and galangal; Mexican dishes require chiles and lime. If the dish you are generating traditionally includes these elements, they MUST appear in the ingredients — omitting them produces an inauthentic, flavorless version of the dish.

DISH CONTEXT RULE:
If referencing a known or named cultural dish (e.g., Amok, Pho, Injera, Rendang, Bobotie, Mole, etc.), that dish MUST be used in the correct cultural context: (a) the meal type must match how that dish is typically consumed in ${envelope.cuisinePreference} culture, and (b) the format and ingredients must match how that dish is actually prepared. Do NOT borrow a real cultural dish name and apply it to a different meal time or format — for example, Amok is a Cambodian steamed curry eaten at lunch or dinner, NOT a breakfast dish. If a known dish does not fit the requested meal time or context, DO NOT use it. Generate a different culturally appropriate meal that genuinely fits the meal time instead.

DISH COMPOSITION RULE:
If a known or named cultural dish is being generated, preserve its traditional composition exactly. Do NOT modify core ingredients or add new primary components to satisfy fitness or nutritional goals (e.g., adding chicken breast to Firfir, adding quinoa to a traditional stew, adding lean protein to a dish that does not traditionally contain it). Nutritional goals MUST be achieved through portioning or the dish's existing ingredients only — NOT by altering the dish's fundamental identity. The dish must remain what it is, not what the AI decides it should be.
Additionally, preserve the traditional protein type, cut, and preparation method exactly — this is a hard requirement, not a suggestion. Do NOT substitute bone-in cuts with boneless, do NOT swap traditional cuts for "lean" alternatives (e.g., chicken breast in place of bone-in thighs/drumsticks in Doro Wat), do NOT replace fatty or skin-on cuts with trimmed versions. The protein cut is part of the dish's cultural identity. If the dish traditionally uses bone-in chicken, you MUST use bone-in chicken — fitness goals do not override this.

STRICT DISH EXECUTION RULE:
When a known cultural dish is being generated (e.g., Firfir, Doro Wat, Pho, Rendang, Injera-based dish), generate it exactly as it is traditionally prepared. Do NOT modify it, reinterpret it, "enhance" it, or create a variation of it. Do NOT add new primary ingredients, create a wrap version, bowl version, or "twist." If the output deviates from the traditional form in any way — REJECT it and rebuild the dish exactly as it is known. Creativity is NOT permitted when executing a named traditional dish.
Do NOT describe known cultural dishes using modern nutrition language — words like "healthy", "balanced", "nutritious", "light", "clean", or "twist" are BANNED when describing a named traditional dish. Present the dish as it is traditionally understood, not as a nutrition-app product.
Do NOT assign Western meal-time labels (breakfast, lunch, dinner) to a dish unless that label is culturally accurate for how the dish is actually eaten in its cuisine of origin. Many traditional dishes are not meal-time-specific — do not force them into a Western eating structure.

CUISINE BOUNDARY RULE:
All ingredients, dishes, and preparations must originate from or be commonly used within ${envelope.cuisinePreference} cuisine. Do NOT combine elements from different cuisines (e.g., Egyptian ful medames with Ethiopian injera, Japanese miso with Indian roti). Do NOT introduce globally common dishes unless they are also genuinely part of ${envelope.cuisinePreference} cuisine specifically. If any component does not belong to the selected cuisine — REJECT and rebuild using only ingredients and preparations authentic to ${envelope.cuisinePreference}.

SERVING CONTEXT RULE:
Meals must reflect how they are traditionally served and consumed in ${envelope.cuisinePreference} cuisine. If a dish is typically served with a specific base or delivery medium, that element MUST be included — for example, Doro Wat requires injera (not "vegetable sides"), sushi requires rice, tacos require tortillas. Do NOT reinterpret meals as generic "main + sides" if the cuisine does not follow that plating structure. Prefer authentic serving formats: shared platters, layered dishes, wrapped preparations, or communal formats as appropriate for the cuisine. If the serving structure is incomplete or wrong, reject and rebuild.

DISH NAMING COMMITMENT RULE:
When the generated meal clearly corresponds to a known or widely recognized dish within ${envelope.cuisinePreference} cuisine, use the authentic dish name. Optionally include a short English descriptor in parentheses if helpful for clarity (e.g., "Gỏi Gà (Vietnamese Chicken Salad)", "Doro Wat (Ethiopian Chicken Stew) with Injera"). Do NOT default to generic descriptive names like "Herb Salad", "Flatbread Plate", or "Fish Rice Meal" when a specific dish identity is apparent. Commit to the real name. NEVER use hedging qualifiers such as "inspired", "style", "influenced", or "based" (e.g., "Ethiopian-Inspired Stew" is WRONG — if it is Doro Wat, name it Doro Wat).

SELF-CHECK before responding: Verify the meal reflects at least 3 of these authentic signals — (a) culturally appropriate dish format for this cuisine AND this meal time, (b) culturally typical protein or starch (not a generic fitness substitute), (c) culturally authentic vegetables or herbs (not generic health vegetables), (d) correct flavor system for this cuisine. If fewer than 3 signals are present, revise before returning.`;
  }

  const rawCombined = [
    layers.dietaryIdentity,
    layers.allergies,
    layers.medicalHardLimits,
    layers.procedural,
    layers.performanceIntent,
    layers.avoidances,
    layers.preferences,
  ]
    .filter(Boolean)
    .join("\n");

  // Phase 4 — sanitize direct identifiers from the prompt block before it
  // leaves the application boundary toward OpenAI.
  let combined = sanitizeIdentifiers(rawCombined);

  const hasRestrictions =
    envelope.dietaryIdentity.length > 0 ||
    envelope.allergies.length > 0 ||
    envelope.medicalHardLimits.length > 0 ||
    envelope.avoidances.length > 0;

  if (hasRestrictions) {
    console.log(
      `[ProtocolEnvelope:${generatorName}] Enforcement active — identity: [${envelope.dietaryIdentity.join(",")}] allergies: [${envelope.allergies.join(",")}] medical: [${envelope.medicalHardLimits.join(",")}] avoid: [${envelope.avoidances.join(",")}] procedural: ${proceduralParts.length} rule groups`
    );
  }

  // Phase 4 — detect which T1/T2 PHI field categories are present in this envelope.
  // Only field names are collected; no values are stored or logged.
  const phiFields: string[] = [];
  if (envelope.medicalHardLimits.length > 0) phiFields.push("medical_hard_limits");
  if ((envelope.conditionGuidanceBlocks ?? []).length > 0) {
    phiFields.push("condition_guidance_blocks");
    if (envelope.conditionGuidanceBlocks.some(b => /oncolog|cancer/i.test(b))) phiFields.push("oncology_context");
    if (envelope.conditionGuidanceBlocks.some(b => /glp-?1/i.test(b))) phiFields.push("glp1_context");
    if (envelope.conditionGuidanceBlocks.some(b => /renal|kidney/i.test(b))) phiFields.push("renal_context");
    if (envelope.conditionGuidanceBlocks.some(b => /cardiac|heart/i.test(b))) phiFields.push("cardiac_context");
  }
  if (envelope.diabeticGuidance) phiFields.push("diabetic_guidance");
  if (envelope.thyroidMedication) phiFields.push("thyroid_medication");
  if (envelope.thyroidSupport) phiFields.push("thyroid_support");

  // Emit audit event when T1 fields are present and an actor is known.
  if (phiFields.length > 0 && context?.actorId) {
    logAudit({
      actor: context.actorId,
      orgId: context.orgId ?? null,
      action: "AI_PROMPT_PHI",
      resourceType: "prompt_context",
      route: `generator:${generatorName}`,
      meta: { phiFields, generatorName },
    });
  }

  // ── LANGUAGE INJECTION ────────────────────────────────────────────────────
  // Phase 1 internationalization: AI generates directly in the user's language.
  // This means meals, coaching, recipes, and explanations arrive in Spanish,
  // French, Chinese, etc. — no Translate button needed for normal use.
  if (envelope.preferredLanguage && envelope.preferredLanguage !== "auto") {
    const base = envelope.preferredLanguage.split("-")[0].toLowerCase();
    const LANGUAGE_NAMES: Record<string, string> = {
      es: "Spanish", fr: "French", de: "German", it: "Italian", pt: "Portuguese",
      zh: "Chinese (Simplified)", ja: "Japanese", ko: "Korean", ar: "Arabic",
      hi: "Hindi", ru: "Russian", vi: "Vietnamese", tl: "Filipino (Tagalog)",
    };
    const langName = LANGUAGE_NAMES[base];
    if (langName) {
      combined +=
        `\n\n🌐 LANGUAGE REQUIREMENT — MANDATORY: Generate ALL content entirely in ${langName}. ` +
        `This includes meal names, descriptions, ingredient names, cooking instructions, ` +
        `nutritional explanations, recommendations, and every other word in your response. ` +
        `Do NOT use English. Every word must be in ${langName}.`;
    }
  }

  return { combined, layers, hasRestrictions, phiFields };
}

// ─────────────────────────────────────────────────────────────────────────────
// INSTRUCTION-LEVEL VIOLATION SCAN
// Scans cooking instructions for forbidden phrases defined in procedural rules.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scan cooking instructions for forbidden instruction phrases from the procedural layer.
 * Returns all forbidden phrases found in the instruction text.
 */
function scanInstructionsForViolations(
  instructionsText: string,
  procedural: ProtocolProcedureRules
): string[] {
  const lower = instructionsText.toLowerCase();
  const found: string[] = [];
  for (const phrase of procedural.forbiddenInstructions) {
    if (lower.includes(phrase.toLowerCase())) {
      found.push(phrase);
    }
  }
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST-GENERATION VALIDATION
// Call this before returning any AI-generated meal to the user.
// Scans BOTH ingredients AND instructions.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract all searchable text from a generated meal object.
 * Works with any meal shape (unified pipeline, universal generator, etc.)
 */
export function extractMealTextForScan(meal: {
  name?: string;
  description?: string;
  ingredients?: Array<{ name?: string; item?: string } | string>;
  instructions?: string | string[];
}): string {
  const parts: string[] = [];
  if (meal.name) parts.push(meal.name);
  if (meal.description) parts.push(meal.description);
  if (Array.isArray(meal.ingredients)) {
    for (const ing of meal.ingredients) {
      if (typeof ing === "string") {
        parts.push(ing);
      } else if (ing && typeof ing === "object") {
        const i = ing as any;
        if (i.name) parts.push(i.name);
        if (i.item) parts.push(i.item);
      }
    }
  }
  if (meal.instructions) {
    const instr = Array.isArray(meal.instructions)
      ? meal.instructions.join(" ")
      : String(meal.instructions);
    parts.push(instr);
  }
  return parts.join(" ");
}

function extractInstructionsText(meal: {
  instructions?: string | string[];
}): string {
  if (!meal.instructions) return "";
  return Array.isArray(meal.instructions)
    ? meal.instructions.join(" ")
    : String(meal.instructions);
}

/**
 * Known starchy carbohydrate terms used by the post-generation starch budget scan.
 * Matched case-insensitively against ingredient names, meal name, and description.
 * Fibrous vegetables, legumes-as-protein, and culturally-integral bases are excluded
 * from this list — only clear glycemic-load starches are included.
 */
const STARCH_BUDGET_TERMS = [
  "rice", "pasta", "bread", "potato", "potatoes", "oats", "oatmeal",
  "corn", "tortilla", "noodle", "noodles", "couscous", "quinoa", "barley",
  "farro", "wheat", "flour", "bagel", "pita", "roll", "bun", "buns",
  "spaghetti", "penne", "linguine", "fettuccine", "ramen", "udon", "soba",
  "polenta", "grits", "macaroni", "mashed", "hash brown", "hashbrown",
  "tater", "sweet potato", "yam", "plantain", "crouton", "croutons",
  "cracker", "crackers", "pretzel", "pretzels", "pancake", "pancakes",
  "waffle", "waffles", "muffin", "muffins", "toast",
];

/**
 * Scan a generated meal against the user's full protocol envelope.
 *
 * Checks BOTH:
 *   1. Ingredient-level violations (hidden ingredients, avoidances, kosher/halal hidden terms)
 *   2. Instruction-level violations (forbidden preparation phrases from the procedural layer)
 *
 * Also checks a STARCH BUDGET soft flag (v1 — informational, does not change `passed`):
 *   3. When starchyBudgetExhausted is true, detects identifiable starchy ingredients
 *      and reports them in starchBudgetViolation for the caller to handle.
 *
 * Call this after every AI generation, before returning the result to the user.
 * Returns a ProtocolScanResult — check `.passed` before serving the meal.
 */
export function scanGeneratedOutput(
  meal: {
    name?: string;
    description?: string;
    ingredients?: Array<{ name?: string; item?: string } | string>;
    instructions?: string | string[];
  },
  envelope: UserProtocolEnvelope,
  context?: {
    generatorName?: string;
    skipAdaptableConflicts?: boolean;
    overriddenAllergens?: string[];
    /**
     * ALLERGEN_ADAPT dish-name exemption — lowercase pure dish-name terms
     * (from getRequestedDishExemptTerms) that must NOT count as violations.
     * Only ever contains cultural dish labels the user explicitly requested
     * ("gumbo", "pad thai") — never ingredient or derivative terms, so
     * shrimp/crab/shellfish-stock detection remains fully active.
     */
    exemptDishNameTerms?: Set<string>;
  }
): ProtocolScanResult {
  const generatorName = context?.generatorName || "unknown_generator";
  const mealText = extractMealTextForScan(meal);
  const instructionsText = extractInstructionsText(meal);

  // ── Ingredient-level scan ─────────────────────────────────────────────────
  const rawIngredientViolations = scanForHiddenDietaryViolations(
    mealText,
    envelope.dietaryIdentity,
    envelope.avoidances,
    { skipMeatDairyCombinationCheck: context?.skipAdaptableConflicts === true }
  );

  // ── Allergen derivative scan (universal) ─────────────────────────────────
  // Scan envelope.allergies against ALLERGEN_EXPANSION so allergen leaks are
  // caught at every surface that calls scanGeneratedOutput — not only in the
  // Phase 3 ALLERGEN_ADAPT scan. Matching mirrors scanMealsForAllergenViolations:
  // word-bounded, case-insensitive, against the raw meal text (name +
  // ingredients + instructions + description). Allergens the user explicitly
  // overrode are excluded entirely (their derivative terms are authorized).
  //
  // Masking is applied per-allergen key so plant milks don't false-positive
  // on dairy "milk" scans, while nut allergen keys still catch "almond milk":
  //   • Dairy key  → use plant-milk-masked text (almond milk ≠ dairy violation)
  //   • Non-nut key + "butter" term → use nut-butter-masked text
  //   • Nut key    → use raw text ("almond milk" IS a nut violation)
  const mealTextLower = mealText.toLowerCase();
  const mealTextPlantMilkMasked = maskPlantMilks(mealTextLower);
  const mealTextNutButterMasked = maskNutButters(mealTextLower);

  // Exact canonical-key matching only (allergenKeysMatch) — substring matching
  // was a safety bug: a "fish" override must never unlock the distinct
  // "shellfish" allergy just because one label contains the other.
  const overriddenLower = (context?.overriddenAllergens || []).map(a => a.toLowerCase());
  const effectiveAllergies = envelope.allergies.filter(
    a => !(context?.overriddenAllergens || []).some(oa => allergenKeysMatch(a, oa))
  );
  for (const allergen of effectiveAllergies) {
    const key = allergen.trim().toLowerCase();
    if (!key) continue;
    const isDairyKey = DAIRY_ALLERGEN_KEYS.has(key);
    const isNutKey   = NUT_ALLERGEN_KEYS.has(key);
    const expanded = ALLERGEN_EXPANSION[key] || [key];
    for (const term of expanded) {
      const termLower = term.toLowerCase();
      // Select the appropriate text surface for this allergen key + term.
      let textToScan = mealTextLower;
      if (!isNutKey && isDairyKey) {
        // Mask plant milks so "almond milk"/"oat milk" don't trigger dairy "milk" term.
        textToScan = mealTextPlantMilkMasked;
      } else if (!isNutKey && termLower === "butter") {
        // Mask nut butters so "almond butter" doesn't trigger non-nut "butter" term.
        textToScan = mealTextNutButterMasked;
      }
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${esc}\\b`, "i").test(textToScan)) {
        if (!rawIngredientViolations.find(v => v.term.toLowerCase() === termLower)) {
          rawIngredientViolations.push({
            term,
            category: `allergy:${key}`,
            reason: `"${term}" is a derivative of the user's "${allergen}" allergy (absolute medical hard stop)`,
          });
        }
      }
    }
  }

  // ── Allergen override filter — suppress violations for explicitly authorized allergens only.
  // All other allergies, dietary restrictions, medical rules, and protocol constraints remain active.
  //
  // Category-aware suppression: violations generated by the allergen loop carry
  // category="allergy:<key>" and are only suppressible by an override whose name
  // matches that exact allergen key. This prevents cross-allergen suppression —
  // e.g. overriding "lactose intolerance" must never suppress violations produced
  // by the "dairy" allergen key, even though both share "milk" as a forbidden term.
  //
  // Non-allergen violations (dietary identity, avoidance scans) are NEVER
  // suppressed by an allergen PIN override. A PIN authorizes exactly one
  // allergy constraint — an independent "seafood" avoidance or a dietary
  // identity rule that also forbids shrimp must remain fully enforced even
  // when the shellfish allergy itself was overridden.
  let ingredientViolations = context?.overriddenAllergens?.length
    ? rawIngredientViolations.filter(v => {
        // ── Allergen-loop violations: category-aware, no cross-allergen suppression ──
        if (v.category.startsWith("allergy:")) {
          const allergenKey = v.category.slice("allergy:".length);
          // Suppress only when the violation's allergen key exactly matches an
          // explicitly overridden allergen category (canonical-key match — never
          // substring: a "fish" override must not suppress "shellfish" violations).
          return !overriddenLower.some(oa => allergenKeysMatch(allergenKey, oa));
        }
        // ── Dietary / avoidance violations: always enforced ──
        return true;
      })
    : rawIngredientViolations;

  // ── ALLERGEN_ADAPT dish-name exemption ────────────────────────────────────
  // When the user picked "Make it safe for me" for a named dish, the adapted
  // meal intentionally keeps the dish's own name ("gumbo"). That pure
  // dish-name term must not condemn the meal here — otherwise the universal
  // filter strips every adapted option before the Phase 3 scan can serve it.
  // Exact term match only: ingredient/derivative violations are unaffected.
  if (context?.exemptDishNameTerms?.size) {
    ingredientViolations = ingredientViolations.filter(v => {
      if (context.exemptDishNameTerms!.has(v.term.toLowerCase())) {
        console.log(
          `[ProtocolEnvelope:${generatorName}] "${meal.name}" — violation term "${v.term}" exempted (ALLERGEN_ADAPT requested-dish name)`
        );
        return false;
      }
      return true;
    });
  }

  // ── Instruction-level scan ────────────────────────────────────────────────
  const instructionViolations = scanInstructionsForViolations(
    instructionsText,
    envelope.procedural
  );

  const totalPassed = ingredientViolations.length === 0 && instructionViolations.length === 0;

  // ── Starch budget soft flag (v1 — informational, does not block) ──────────
  // Fires only when starchyBudgetExhausted is true AND the meal contains
  // identifiable starchy ingredients. Caller decides whether to reject or warn.
  let starchBudgetViolation: ProtocolScanResult["starchBudgetViolation"];
  if (envelope.dailyNutritionState?.starchyBudgetExhausted) {
    const mealLower = mealText.toLowerCase();
    const foundTerms = STARCH_BUDGET_TERMS.filter(term =>
      mealLower.includes(term.toLowerCase())
    );
    if (foundTerms.length > 0) {
      const termList = foundTerms.slice(0, 5).join(", ");
      console.warn(
        `⚠️ [ProtocolEnvelope:${generatorName}] "${meal.name}" STARCH BUDGET soft flag — ` +
        `starchyBudgetExhausted=true but meal contains: ${termList}`
      );
      starchBudgetViolation = {
        detected: true,
        terms: foundTerms,
        message: `Today's starchy carb budget is exhausted, but this meal contains: ${termList}. ` +
          `The AI may not have fully honored the day-specific constraint. ` +
          `Consider regenerating or substituting fibrous vegetables.`,
      };
    }
  }

  if (totalPassed) {
    return {
      passed: true,
      violations: [],
      instructionViolations: [],
      message: `[ProtocolEnvelope:${generatorName}] "${meal.name}" passed full protocol scan (ingredients + instructions).`,
      starchBudgetViolation,
    };
  }

  if (ingredientViolations.length > 0) {
    const primary = ingredientViolations[0];
    console.log(
      `🚫 [ProtocolEnvelope:${generatorName}] "${meal.name}" INGREDIENT violation — ${ingredientViolations.map(v => v.term).join(", ")}`
    );
    if (instructionViolations.length > 0) {
      console.log(
        `🚫 [ProtocolEnvelope:${generatorName}] "${meal.name}" INSTRUCTION violation — ${instructionViolations.join(", ")}`
      );
    }
    return {
      passed: false,
      violations: ingredientViolations,
      instructionViolations,
      primaryViolation: primary,
      message: `This meal contains "${primary.term}" which conflicts with your ${primary.category} rules. ${primary.reason}`,
      starchBudgetViolation,
    };
  }

  // Instruction-only violation
  const primaryInstruction = instructionViolations[0];
  console.log(
    `🚫 [ProtocolEnvelope:${generatorName}] "${meal.name}" INSTRUCTION violation — found forbidden phrase: "${primaryInstruction}"`
  );
  return {
    passed: false,
    violations: [],
    instructionViolations,
    message: `The cooking instructions for this meal contain a step that violates your dietary protocol: "${primaryInstruction}". Regenerating with compliant instructions.`,
    starchBudgetViolation,
  };
}

/**
 * Filter an array of generated meals — remove any that fail the protocol scan.
 * Returns only the meals that passed both ingredient and instruction checks.
 *
 * If all meals fail, returns an empty array (caller must handle regeneration or error).
 */
export function filterMealsByProtocol<T extends {
  name?: string;
  description?: string;
  ingredients?: Array<{ name?: string; item?: string } | string>;
  instructions?: string | string[];
}>(
  meals: T[],
  envelope: UserProtocolEnvelope,
  context?: {
    generatorName?: string;
    skipAdaptableConflicts?: boolean;
    overriddenAllergens?: string[];
    /** See scanGeneratedOutput — ALLERGEN_ADAPT requested-dish-name exemption. */
    exemptDishNameTerms?: Set<string>;
    /**
     * Dish Adaptation Layer — when the surface received a named dish, the
     * dish identity validator runs alongside the protocol scan. Meals with a
     * catastrophic identity deviation (a completely different dish) are
     * removed — a silently substituted meal must never reach the user.
     * Results are pushed into `results` so callers can build an explicit
     * dishIdentityFailure error instead of a silent generic fallback.
     */
    dishIdentity?: {
      requestedDish: string;
      directive?: import("./dishAdaptation/types").DishAdaptationDirective | null;
      results?: Array<{ mealName: string; result: import("./dishAdaptation/types").DishIdentityResult }>;
    };
  }
): T[] {
  return meals.filter(meal => {
    const result = scanGeneratedOutput(meal, envelope, context);
    if (!result.passed) return false;

    // ── Dish identity validation (Phase 4 — Dish Adaptation Layer) ────────
    const di = context?.dishIdentity;
    if (di?.requestedDish) {
      try {
        const identity = validateDishIdentity(di.requestedDish, meal, di.directive);
        di.results?.push({ mealName: meal.name ?? "(unnamed)", result: identity });
        if (identity.catastrophicDeviation) {
          console.warn(
            `🚫 [DishIdentity:${context?.generatorName ?? "unknown"}] "${meal.name}" REJECTED — ` +
            `not "${di.requestedDish}" (score ${identity.score}): ${identity.failures.join("; ")}`
          );
          return false;
        }
        if (!identity.passed) {
          console.warn(
            `⚠️ [DishIdentity:${context?.generatorName ?? "unknown"}] "${meal.name}" weak identity match ` +
            `for "${di.requestedDish}" (score ${identity.score}) — kept (non-catastrophic)`
          );
        }
      } catch (err) {
        // Validator errors never drop a protocol-compliant meal.
        console.warn(`⚠️ [DishIdentity] Validator error for "${meal.name}":`, err);
      }
    }
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLIANCE SECTION BUILDER — Phase 3
// Generates the user-facing compliance surface for every meal card.
// Called AFTER scanGeneratedOutput passes. No AI calls — pure rule logic.
// ─────────────────────────────────────────────────────────────────────────────

export interface MealComplianceSection {
  /** Short label shown at the top of the compliance panel.
   * Examples: "Kosher ✓ (Meat)", "Vegan ✓", "Halal ✓", "Keto ✓ (~12g net carbs)" */
  statusLabel: string;

  /** One dish-specific sentence explaining WHY this meal complies. */
  whyThisComplies: string;

  /** Actionable preparation checklist sourced from PROTOCOL_PROCEDURE_MAP. */
  prepRules: string[];

  /** What to pair (and what NOT to pair) with this meal based on its protocol. */
  pairingGuidance: string[];
}

/** Pairing guidance per protocol + kosher sub-category */
const PAIRING_GUIDANCE_MAP: Record<string, string[]> = {
  "kosher-meat": [
    "Serve with pareve or meat-designated sides only",
    "Avoid dairy desserts — choose pareve desserts or fresh fruit",
    "Do not serve dairy beverages with or immediately after this meal",
    "Wait the halachically required time before eating dairy after this meat dish",
  ],
  "kosher-dairy": [
    "Serve with dairy-compatible sides only",
    "Do not serve meat dishes at the same meal",
    "Choose dairy or pareve desserts to follow this dish",
  ],
  "kosher-pareve": [
    "This pareve dish can be served with either meat or dairy meals",
    "Use pareve utensils to maintain full flexibility",
    "Avoid adding meat or dairy to this dish to preserve its pareve status",
  ],
  halal: [
    "Avoid alcohol-based beverages — serve water, juice, or halal-certified drinks",
    "Pair only with halal-certified meat dishes for additional protein",
    "Avoid pork-based side dishes, condiments, or sauces",
  ],
  vegan: [
    "All pairings must remain entirely plant-based",
    "Use plant-based sauces, dressings, and condiments only",
    "Avoid honey-based dressings or animal-derived garnishes",
  ],
  vegetarian: [
    "Avoid meat-based sides, sauces, and broths",
    "Use vegetable broth in any additional dishes",
    "Dairy and egg-based sides are permitted",
  ],
  pescatarian: [
    "Pair with seafood-based or plant-based sides",
    "Avoid meat or poultry-based accompaniments",
    "Vegetable broths and seafood stocks are appropriate",
  ],
  keto: [
    "Keep all side dishes low-carb (under 5g net carbs per serving)",
    "Avoid starchy sides, bread, or grain-based accompaniments",
    "Maintain the stated serving size to stay within daily carb targets",
  ],
  paleo: [
    "Pair with vegetables, fruits, nuts, and seeds",
    "Avoid grains, dairy, and legume-based sides",
    "Use olive oil, avocado oil, or coconut oil for any additional cooking",
  ],
  "gluten-free": [
    "Ensure all paired items are certified gluten-free",
    "Use gluten-free sauces, soy sauce alternatives (tamari or coconut aminos), and condiments",
    "Avoid shared cooking surfaces with gluten-containing products",
  ],
};

/** Build a dish-specific "why this complies" sentence */
function buildWhyThisComplies(
  mealName: string,
  primaryIdentity: string,
  kosherCategory?: KosherCategory,
): string {
  const name = mealName || "This dish";

  switch (primaryIdentity) {
    case "kosher":
      if (kosherCategory === "meat") {
        return `${name} is a fleishig (meat) dish. No dairy ingredients are present. Any cream or creamy elements use pareve alternatives (cashew cream, coconut cream, or olive oil).`;
      }
      if (kosherCategory === "dairy") {
        return `${name} is a milchig (dairy) dish. No meat or poultry ingredients are present. Dairy components are used throughout.`;
      }
      return `${name} is pareve — it contains neither meat nor dairy, making it compatible with both meat and dairy meals when prepared with appropriate utensils.`;

    case "halal":
      return `${name} contains no pork, alcohol, or blood products. All meat components should be sourced from halal-certified suppliers. No alcohol-based sauces, extracts, or marinades are used.`;

    case "vegan":
      return `${name} is entirely plant-based. No animal products, derivatives, or hidden animal-based ingredients (broth, gelatin, honey) are present.`;

    case "vegetarian":
      return `${name} contains no meat, poultry, or seafood. Any broths or stocks used are vegetable-based. Dairy and eggs may be present.`;

    case "pescatarian":
      return `${name} contains no land meat or poultry. Seafood and plant-based ingredients are used. Vegetable or seafood broths replace meat stocks.`;

    case "low_carb":
      return `${name} is low-carbohydrate. Refined grains, sugary sauces, white bread, and regular pasta are excluded. Protein and healthy fats anchor the dish.`;

    case "keto":
      return `${name} is low-carbohydrate and fits standard keto targets. It prioritizes protein and healthy fats. Avoid adding any high-carb sauces, thickeners, or accompaniments.`;

    case "paleo":
      return `${name} uses only whole-food ingredients in line with paleo principles — no grains, dairy, legumes, or refined sweeteners. Fats come from whole-food sources.`;

    case "gluten-free":
      return `${name} contains no gluten-bearing grains (wheat, barley, rye, spelt). All thickeners and sauces are gluten-free. Use certified gluten-free ingredients when preparing this dish.`;

    default:
      return `${name} has been generated in compliance with your dietary protocol. All ingredients and preparation steps meet your protocol requirements.`;
  }
}

/**
 * Build the compliance section for a generated meal.
 *
 * Call this AFTER scanGeneratedOutput passes (meal is clean).
 * Attach the result to the meal object before returning it to the client.
 *
 * Returns null if no dietary identity is active (open generation).
 */
export function buildComplianceSection(
  meal: {
    name?: string;
    description?: string;
    ingredients?: Array<{ name?: string; item?: string } | string>;
    instructions?: string | string[];
  },
  envelope: UserProtocolEnvelope,
  options?: {
    isChefAdapted?: boolean;
    /** Pre-computed from the route — pass this to guarantee a single classifyKosherMealCategory() call per meal */
    precomputedKosherCategory?: KosherCategory;
  },
): MealComplianceSection | null {
  if (envelope.dietaryIdentity.length === 0) return null;

  const primaryIdentity = envelope.dietaryIdentity[0].trim().toLowerCase();
  const mealText = extractMealTextForScan(meal);
  const mealName = meal.name || "This dish";

  // ── Kosher category classification ───────────────────────────────────────
  // Single source of truth: classifyKosherMealCategory(). If a pre-computed
  // value was passed from the route (where it was computed once for both this
  // function and buildDietClassification), use it. Otherwise compute now.
  let kosherCategory: KosherCategory | undefined;
  if (primaryIdentity === "kosher" || primaryIdentity === "kosher-halal") {
    kosherCategory = options?.precomputedKosherCategory ?? classifyKosherMealCategory(mealText);
  }

  // ── Status label ─────────────────────────────────────────────────────────
  let statusLabel: string;
  if (primaryIdentity === "kosher") {
    const cat = kosherCategory === "meat" ? "Meat" : kosherCategory === "dairy" ? "Dairy" : "Pareve";
    statusLabel = `Kosher ✓ (${cat})`;
  } else if (primaryIdentity === "kosher-halal") {
    const cat = kosherCategory === "meat" ? "Meat" : kosherCategory === "dairy" ? "Dairy" : "Pareve";
    statusLabel = `Kosher-Halal ✓ (${cat})`;
  } else if (primaryIdentity === "halal") {
    statusLabel = "Halal ✓";
  } else if (primaryIdentity === "vegan") {
    statusLabel = "Vegan ✓";
  } else if (primaryIdentity === "vegetarian") {
    statusLabel = "Vegetarian ✓";
  } else if (primaryIdentity === "pescatarian") {
    statusLabel = "Pescatarian ✓";
  } else if (primaryIdentity === "keto") {
    statusLabel = "Keto ✓";
  } else if (primaryIdentity === "paleo") {
    statusLabel = "Paleo ✓";
  } else if (primaryIdentity === "gluten-free") {
    statusLabel = "Gluten-Free ✓";
  } else {
    statusLabel = `${envelope.dietaryIdentity[0]} ✓`;
  }

  if (options?.isChefAdapted) {
    statusLabel += " (Chef Adapted)";
  }

  // ── Why this complies ─────────────────────────────────────────────────────
  const whyThisComplies = buildWhyThisComplies(mealName, primaryIdentity, kosherCategory);

  // ── Prep rules — category-aware for kosher ──────────────────────────────
  //
  // Kosher prep rules in PROTOCOL_PROCEDURE_MAP are written generically and
  // include meat-specific language (e.g. "dedicated meat pan", "salted kosher
  // meat") that is INCORRECT for pareve or dairy dishes.
  //
  // We build a category-specific set here instead of blindly pulling from the
  // envelope's combinedPreparationRules.
  let prepRules: string[];

  if ((primaryIdentity === "kosher" || primaryIdentity === "kosher-halal") && kosherCategory) {
    if (kosherCategory === "meat") {
      prepRules = [
        "Use kosher-certified or pre-salted kosher meat — no blood should remain",
        "Fruits and vegetables should be inspected for insects before use",
        "Do not cook meat and dairy in the same dish, pot, or pan",
        "Do not use non-kosher wine in cooking — use kosher wine or grape juice",
        "Do not include gelatin unless it is kosher-certified",
        "Shellfish and pork are absolutely forbidden in all forms",
      ];
    } else if (kosherCategory === "dairy") {
      prepRules = [
        "Use dairy-designated cookware only — do not use pots or pans previously used for meat",
        "Fruits and vegetables should be inspected for insects before use",
        "Do not cook this dish in the same pot used for meat without proper kashering",
        "Do not use non-kosher wine — use kosher wine or grape juice if wine is needed",
        "Do not include gelatin unless it is kosher-certified (pareve)",
        "Shellfish and pork are absolutely forbidden in all forms",
      ];
    } else {
      // pareve
      prepRules = [
        "Use neutral (pareve) cookware — pots and utensils not designated for meat or dairy",
        "Fruits and vegetables should be inspected for insects before use",
        "Non-dairy milk (cashew, oat, almond, coconut) is acceptable — this dish contains no actual dairy",
        "Do not use non-kosher wine — use kosher wine or grape juice if wine is needed",
        "Do not include gelatin unless it is kosher-certified (pareve)",
        "Shellfish and pork are absolutely forbidden in all forms",
      ];
    }
  } else {
    const procedural = envelope.procedural;
    prepRules = procedural.preparationRules.slice(0, 6);
  }

  // ── Pairing guidance ──────────────────────────────────────────────────────
  let pairingKey = primaryIdentity;
  if (primaryIdentity === "kosher" || primaryIdentity === "kosher-halal") {
    pairingKey = `kosher-${kosherCategory ?? "pareve"}`;
  }
  const pairingGuidance = PAIRING_GUIDANCE_MAP[pairingKey] || [];

  return {
    statusLabel,
    whyThisComplies,
    prepRules,
    pairingGuidance,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DIET CLASSIFICATION — structured per-meal classification data
// Drives the secondary meal pill in the UI.
// Both buildDietClassification and buildComplianceSection use
// classifyKosherMealCategory() as their single source of truth.
// Routes pass a pre-computed kosherCategory to guarantee one call per meal.
// ─────────────────────────────────────────────────────────────────────────────

export interface DietClassification {
  kosherCategory?: KosherCategory;
  halalFlags?: {
    alcoholFree: boolean;
    porkFree: boolean;
  };
  veganFlags?: {
    plantBased: boolean;
  };
}

/** Alcohol terms scanned for halal flag derivation */
const HALAL_ALCOHOL_SCAN_TERMS = [
  "wine", "beer", "spirits", "vodka", "rum", "whiskey", "bourbon",
  "brandy", "cognac", "sake", "mirin", "marsala", "champagne",
  "prosecco", "cooking wine", "vanilla extract",
];

/** Pork terms scanned for halal flag derivation */
const HALAL_PORK_SCAN_TERMS = [
  "pork", "bacon", "ham", "prosciutto", "pancetta", "lard",
  "chorizo", "salami", "pepperoni", "sausage", "lard",
];

/**
 * Build the diet classification object for a generated meal.
 *
 * This is the structured data that powers the secondary meal-level pill in the UI.
 * It does NOT replace the primary diet identity pill (which comes from user profile).
 *
 * @param options.kosherCategory  Pre-computed by the route (single source of truth).
 *                                 If not provided, computed internally.
 */
export function buildDietClassification(
  meal: {
    name?: string;
    description?: string;
    ingredients?: Array<{ name?: string; item?: string } | string>;
    instructions?: string | string[];
    nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  },
  envelope: UserProtocolEnvelope,
  options?: { kosherCategory?: KosherCategory },
): DietClassification | null {
  if (envelope.dietaryIdentity.length === 0) return null;

  const primaryIdentity = envelope.dietaryIdentity[0].trim().toLowerCase();
  const mealText = extractMealTextForScan(meal);
  const lower = mealText.toLowerCase();

  const result: DietClassification = {};

  // ── Kosher ──────────────────────────────────────────────────────────────
  if (primaryIdentity === "kosher" || primaryIdentity === "kosher-halal") {
    result.kosherCategory = options?.kosherCategory ?? classifyKosherMealCategory(mealText);
  }

  // ── Halal ────────────────────────────────────────────────────────────────
  if (primaryIdentity === "halal" || primaryIdentity === "kosher-halal") {
    const alcoholFree = !HALAL_ALCOHOL_SCAN_TERMS.some(t => lower.includes(t));
    const porkFree = !HALAL_PORK_SCAN_TERMS.some(t => {
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${esc}\\b`, "i").test(lower);
    });
    result.halalFlags = { alcoholFree, porkFree };
  }

  // ── Vegan ────────────────────────────────────────────────────────────────
  // Meal reached here only after passing the protocol scan — it's plant-based.
  if (primaryIdentity === "vegan") {
    result.veganFlags = { plantBased: true };
  }

  // Keto: no secondary pill — "Keto ✓" from DietStyleBadge is sufficient.

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Validate consistency between a diet classification and the meal it describes.
 *
 * If a mismatch is detected (e.g., halalFlags.alcoholFree=true but alcohol term
 * found in ingredients), logs an error and returns false. The caller should
 * suppress the dietClassification from the response when this returns false.
 */
export function validateDietConsistency(
  meal: {
    name?: string;
    description?: string;
    ingredients?: Array<{ name?: string; item?: string } | string>;
    instructions?: string | string[];
  },
  classification: DietClassification | null,
): boolean {
  if (!classification) return true;

  const mealText = normalizeForDietaryScan(extractMealTextForScan(meal));
  const lower = mealText.toLowerCase();
  const name = meal.name ?? "unnamed";

  // Halal: alcoholFree must actually be alcohol-free
  if (classification.halalFlags?.alcoholFree === true) {
    const hasAlcohol = HALAL_ALCOHOL_SCAN_TERMS.some(t => lower.includes(t));
    if (hasAlcohol) {
      console.error(`[DietConsistency] MISMATCH: halalFlags.alcoholFree=true but alcohol term detected in "${name}"`);
      return false;
    }
  }

  // Halal: porkFree must actually have no pork
  if (classification.halalFlags?.porkFree === true) {
    const hasPork = HALAL_PORK_SCAN_TERMS.some(t => {
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${esc}\\b`, "i").test(lower);
    });
    if (hasPork) {
      console.error(`[DietConsistency] MISMATCH: halalFlags.porkFree=true but pork term detected in "${name}"`);
      return false;
    }
  }

  // Vegan: plantBased=true must have no animal products
  if (classification.veganFlags?.plantBased === true) {
    const ANIMAL_CHECK = ["beef", "chicken", "pork", "lamb", "bacon", "ham", "fish",
      "salmon", "tuna", "shrimp", "gelatin", "lard", "tallow", "anchovies"];
    const hasAnimal = ANIMAL_CHECK.some(t => {
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${esc}\\b`, "i").test(lower);
    });
    if (hasAnimal) {
      console.error(`[DietConsistency] MISMATCH: veganFlags.plantBased=true but animal term detected in "${name}"`);
      return false;
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUNDLE HELPER — single call per meal in route handlers
// Guarantees one classifyKosherMealCategory() call per meal (single source of truth)
// and automatically runs validateDietConsistency before returning.
// ─────────────────────────────────────────────────────────────────────────────

export interface MealComplianceBundle {
  complianceSection: MealComplianceSection | null;
  dietClassification: DietClassification | null;
}

/**
 * Compute both complianceSection and dietClassification for a meal in one call.
 *
 * Guarantees:
 *  - classifyKosherMealCategory() is called exactly ONCE per meal
 *  - The same kosherCategory drives both outputs (single source of truth)
 *  - validateDietConsistency() runs automatically; dietClassification is
 *    suppressed (set to null) if a mismatch is detected
 *
 * Call this instead of calling buildComplianceSection + buildDietClassification
 * separately in route handlers.
 */
export function buildMealComplianceBundle(
  meal: {
    name?: string;
    description?: string;
    ingredients?: Array<{ name?: string; item?: string } | string>;
    instructions?: string | string[];
    nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  },
  envelope: UserProtocolEnvelope,
  options?: { isChefAdapted?: boolean },
): MealComplianceBundle {
  const mealText = extractMealTextForScan(meal);

  // ── Single classification call per meal ──────────────────────────────────
  const primaryIdentity = envelope.dietaryIdentity[0]?.trim().toLowerCase() ?? "";
  const isKosher = primaryIdentity === "kosher" || primaryIdentity === "kosher-halal";
  const kosherCategory: KosherCategory | undefined = isKosher
    ? classifyKosherMealCategory(mealText)
    : undefined;

  // ── Build both outputs with the same kosherCategory ──────────────────────
  const complianceSection = buildComplianceSection(meal, envelope, {
    isChefAdapted: options?.isChefAdapted,
    precomputedKosherCategory: kosherCategory,
  });

  let dietClassification = buildDietClassification(meal, envelope, { kosherCategory });

  // ── Validation gate — suppress pill if inconsistency detected ────────────
  if (!validateDietConsistency(meal, dietClassification)) {
    dietClassification = null;
  }

  return { complianceSection, dietClassification };
}
