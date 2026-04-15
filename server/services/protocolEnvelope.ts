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
 *   1. dietaryIdentity  — the outer wall. Nothing is generated outside it.
 *   2. allergies        — absolute hard stops within the identity container.
 *   3. medicalHardLimits — carb/sodium/etc. limits that cannot be violated.
 *   4. medicalOptimization — optimization layers applied inside hard limits.
 *   5. avoidances       — foods the user has marked as unwanted.
 *   6. preferences      — flavor, convenience, style — applied last.
 *
 * Non-negotiable rules:
 *   - No medical optimization may violate the dietaryIdentity container.
 *   - No avoidance can override a medical hard limit.
 *   - No preference can override anything above it.
 *   - No generator may produce AI output without calling enforceBeforeGenerate().
 *   - No generator may return AI output without calling scanGeneratedOutput().
 */

import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  AVOIDANCE_EXPANSION,
  RESTRICTION_EXPANSION,
  scanForHiddenDietaryViolations,
  type HiddenViolation,
} from "./allergyGuardrails";

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
      // Unknown conditions default to optimization (not hard limits)
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
 * Makes a single DB query and returns the fully-structured rule stack.
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

    // Merge dislikedFoods + avoidedFoods — both represent "do not serve this"
    const avoidances = [...new Set([...dislikedFoods, ...avoidedFoods])];

    // Preferences = liked foods + sweetener preferences
    const preferences = [...new Set([...likedFoods, ...preferredSweeteners])];

    return {
      userId,
      dietaryIdentity: dietaryRestrictions,
      allergies,
      medicalHardLimits: hardLimits,
      medicalOptimization: optimization,
      avoidances,
      preferences,
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
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-GENERATION ENFORCEMENT
// Call this before any AI prompt is built.
// Returns a structured prompt block to inject into the generator.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the full expanded avoidance term list from an envelope's avoidances.
 * Expands categories (e.g. "seafood" → lobster, shrimp, crab, fish, etc.)
 */
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

/**
 * Build the full expanded forbidden ingredient list from an envelope's dietary identity.
 * Expands protocols (e.g. "vegan" → full forbidden list, "kosher" → pork/shellfish/etc.)
 */
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
 * Priority order is enforced in the output text:
 *   Dietary Identity → Allergies → Medical Hard Limits → Avoidances → Preferences
 */
export function enforceBeforeGenerate(
  envelope: UserProtocolEnvelope,
  context?: {
    /** What the user is asking for (e.g. "lobster bisque") — used for substitution hints */
    userInput?: string;
    /** Generator name for logging (e.g. "create_dish", "fridge_rescue") */
    generatorName?: string;
  }
): ProtocolPromptBlock {
  const generatorName = context?.generatorName || "unknown_generator";
  const layers: ProtocolPromptBlock["layers"] = {
    dietaryIdentity: "",
    allergies: "",
    medicalHardLimits: "",
    avoidances: "",
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
    layers.medicalHardLimits = `\n⚕️ MEDICAL HARD LIMITS (apply inside the dietary identity container):
This user has: ${limitList}.
Respect the medical constraints for these conditions while staying inside the dietary identity.
Example: if diabetic + vegan, optimize carbs WITHIN vegan-safe foods only — never add animal products.`;
  }

  // ── TIER 5: Avoidances ────────────────────────────────────────────────────
  // (Tier 4 = medical optimization — handled at prompt-build time per generator)
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

  const combined = [
    layers.dietaryIdentity,
    layers.allergies,
    layers.medicalHardLimits,
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
      `[ProtocolEnvelope:${generatorName}] Enforcement active — identity: [${envelope.dietaryIdentity.join(",")}] allergies: [${envelope.allergies.join(",")}] medical: [${envelope.medicalHardLimits.join(",")}] avoid: [${envelope.avoidances.join(",")}]`
    );
  }

  return { combined, layers, hasRestrictions };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST-GENERATION VALIDATION
// Call this before returning any AI-generated meal to the user.
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

/**
 * Scan a generated meal against the user's full protocol envelope.
 *
 * Call this after every AI generation, before returning the result to the user.
 * Uses the hidden ingredient scan for kosher/halal/religious rules AND
 * checks all expanded avoidances.
 *
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
  context?: { generatorName?: string }
): ProtocolScanResult {
  const generatorName = context?.generatorName || "unknown_generator";
  const mealText = extractMealTextForScan(meal);

  const violations = scanForHiddenDietaryViolations(
    mealText,
    envelope.dietaryIdentity,
    envelope.avoidances
  );

  if (violations.length === 0) {
    return {
      passed: true,
      violations: [],
      message: `[ProtocolEnvelope:${generatorName}] "${meal.name}" passed post-generation scan.`,
    };
  }

  const primary = violations[0];
  console.log(
    `🚫 [ProtocolEnvelope:${generatorName}] "${meal.name}" FAILED — violations: ${violations.map(v => v.term).join(", ")}`
  );

  return {
    passed: false,
    violations,
    primaryViolation: primary,
    message: `This meal contains "${primary.term}" which conflicts with your ${primary.category} rules. ${primary.reason}`,
  };
}

/**
 * Filter an array of generated meals — remove any that fail the protocol scan.
 * Returns only the meals that passed.
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
  context?: { generatorName?: string }
): T[] {
  return meals.filter(meal => {
    const result = scanGeneratedOutput(meal, envelope, context);
    return result.passed;
  });
}
