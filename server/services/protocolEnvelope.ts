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
import { eq } from "drizzle-orm";
import {
  AVOIDANCE_EXPANSION,
  RESTRICTION_EXPANSION,
  scanForHiddenDietaryViolations,
  classifyKosherMealCategory,
  normalizeForDietaryScan,
  type HiddenViolation,
  type KosherCategory,
} from "./allergyGuardrails";
import {
  getDiabeticContext,
  getGlucoseBasedMealGuidance,
  type GlucoseState,
} from "./diabeticContextService";
import { buildUniversalConditionGuidance } from "./universalMedicalGuidance";

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

  /** Tier 5 — Avoidances: foods the user has marked as unwanted.
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
    avoidances: string;
    procedural: string;
    preferences: string;
  };

  /** Whether this envelope contains any active restrictions (false = open generation) */
  hasRestrictions: boolean;
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
]);

const MEDICAL_OPTIMIZATION_CONDITIONS = new Set([
  "anti-inflammatory", "anti inflammatory",
  "glp-1", "glp1", "semaglutide", "ozempic", "wegovy", "tirzepatide", "mounjaro",
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
        cuisinePreference: users.cuisinePreference,
        cuisineIntensity: users.cuisineIntensity,
        oncologySupportContext: users.oncologySupportContext,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      console.warn(`[ProtocolEnvelope] User not found: ${userId}`);
      return null;
    }

    const dietaryRestrictions: string[] = (user.dietaryRestrictions as string[]) || [];
    const allergies: string[] = (user.allergies as string[]) || [];
    const healthConditions: string[] = (user.healthConditions as string[]) || [];
    const dislikedFoods: string[] = (user.dislikedFoods as string[]) || [];
    const avoidedFoods: string[] = (user.avoidedFoods as string[]) || [];
    const likedFoods: string[] = (user.likedFoods as string[]) || [];
    const preferredSweeteners: string[] = (user.preferredSweeteners as string[]) || [];

    const { hardLimits, optimization } = classifyHealthConditions(healthConditions);
    const avoidances = [...new Set([...dislikedFoods, ...avoidedFoods])];
    const preferences = [...new Set([...likedFoods, ...preferredSweeteners])];
    const procedural = deriveProcedureRules(dietaryRestrictions);

    // ── REAL-TIME DIABETIC CONTEXT ─────────────────────────────────────────────
    // If the user has any diabetic condition in their hard limits, fetch their
    // diabetes profile and latest glucose log. This makes blood glucose data
    // available to EVERY generator — not only the Diabetic Hub.
    const DIABETES_KEYS = new Set(["diabetes", "diabetic", "type 2 diabetes", "type 1 diabetes", "prediabetes"]);
    const hasDiabetes = hardLimits.some(c => DIABETES_KEYS.has(c));
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

    const conditionGuidanceBlocks = buildUniversalConditionGuidance({
      userId,
      healthConditions,
      oncologySupportContext,
    });

    return {
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
      diabeticGlucoseState,
      conditionGuidanceBlocks,
    };
  } catch (error) {
    console.error("[ProtocolEnvelope] Failed to load envelope:", error);
    return null;
  }
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
    diabeticGlucoseState: null,
    conditionGuidanceBlocks: [],
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
  }
): ProtocolPromptBlock {
  const generatorName = context?.generatorName || "unknown_generator";
  const layers: ProtocolPromptBlock["layers"] = {
    dietaryIdentity: "",
    allergies: "",
    medicalHardLimits: "",
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

    // Universal condition guidance — GLP-1, Anti-Inflammatory, Renal, Cardiac, Liver, Oncology.
    // Each block is a self-contained directive string assembled at envelope load time.
    const conditionBlocks = (envelope.conditionGuidanceBlocks ?? [])
      .map(block => `\n\n${block}`)
      .join("");

    layers.medicalHardLimits = `\n⚕️ MEDICAL HARD LIMITS (apply inside the dietary identity container):
This user has: ${limitList}.
Respect the medical constraints for these conditions while staying inside the dietary identity.
Example: if diabetic + vegan, optimize carbs WITHIN vegan-safe foods only — never add animal products.${glucoseBlock}${conditionBlocks}

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

  // ── TIER 5: Avoidances ────────────────────────────────────────────────────
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

  // ── TIER 6: Preferences ───────────────────────────────────────────────────
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

  const combined = [
    layers.dietaryIdentity,
    layers.allergies,
    layers.medicalHardLimits,
    layers.procedural,
    layers.avoidances,
    layers.preferences,
  ]
    .filter(Boolean)
    .join("\n");

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

  return { combined, layers, hasRestrictions };
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
 * Scan a generated meal against the user's full protocol envelope.
 *
 * Checks BOTH:
 *   1. Ingredient-level violations (hidden ingredients, avoidances, kosher/halal hidden terms)
 *   2. Instruction-level violations (forbidden preparation phrases from the procedural layer)
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
  context?: { generatorName?: string; skipAdaptableConflicts?: boolean }
): ProtocolScanResult {
  const generatorName = context?.generatorName || "unknown_generator";
  const mealText = extractMealTextForScan(meal);
  const instructionsText = extractInstructionsText(meal);

  // ── Ingredient-level scan ─────────────────────────────────────────────────
  const ingredientViolations = scanForHiddenDietaryViolations(
    mealText,
    envelope.dietaryIdentity,
    envelope.avoidances,
    { skipMeatDairyCombinationCheck: context?.skipAdaptableConflicts === true }
  );

  // ── Instruction-level scan ────────────────────────────────────────────────
  const instructionViolations = scanInstructionsForViolations(
    instructionsText,
    envelope.procedural
  );

  const totalPassed = ingredientViolations.length === 0 && instructionViolations.length === 0;

  if (totalPassed) {
    return {
      passed: true,
      violations: [],
      instructionViolations: [],
      message: `[ProtocolEnvelope:${generatorName}] "${meal.name}" passed full protocol scan (ingredients + instructions).`,
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
  context?: { generatorName?: string; skipAdaptableConflicts?: boolean }
): T[] {
  return meals.filter(meal => {
    const result = scanGeneratedOutput(meal, envelope, context);
    return result.passed;
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
