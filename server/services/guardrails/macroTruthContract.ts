/**
 * MACRO TRUTH CONTRACT v1.0
 *
 * The single source of truth for macro semantics across all pipelines.
 *
 * ── SEMANTICS ──────────────────────────────────────────────────────────────
 *   null  = unknown. The AI or ingredient source did not provide this value.
 *           DO NOT invent a substitute. Log it. Surface it honestly.
 *   0     = known zero. The food genuinely contains none of this macro.
 *           (e.g. pure fat has 0 carbs — that is truth, not an error)
 *
 * ── RULES (NON-NEGOTIABLE) ─────────────────────────────────────────────────
 *   1. Macro truth can only come from ingredients or verified AI output.
 *   2. No layer may invent a macro value. No numeric fallbacks like || 30 or || 40.
 *   3. Validation layers may REJECT or REGENERATE — they may NOT mutate macro values.
 *   4. Guidance layers may SUGGEST — they may NOT enter the generation pipeline.
 *
 * ── LAYERS ─────────────────────────────────────────────────────────────────
 *   Truth Layer      → ingredient/AI macros only. null is valid and honest.
 *   Validation Layer → diet rules run AFTER truth. Can reject/flag. Cannot mutate.
 *   Guidance Layer   → coaching suggestions in UI only. Never in pipeline.
 */

export const MACRO_TRUTH_CONTRACT = {
  version: "1.0.0",
  nullMeansUnknown: true,
  zeroMeansKnownZero: true,
  noMutationInValidation: true,
  noInventedFallbacks: true,
} as const;

/**
 * Builder/diet contexts where baseline carb-minimum injection is ALWAYS blocked.
 * Any context not explicitly recognized as "general/balanced" is blocked by default.
 */
export const BASELINE_BLOCKED_CONTEXTS = new Set([
  "keto",
  "ketogenic",
  "diabetic",
  "diabetes",
  "glp1",
  "glp-1",
  "carnivore",
  "anti_inflammatory",
  "anti-inflammatory",
  "antiinflammatory",
  "liver_support",
  "liver-support",
  "beach_body",
  "beachbody",
  "performance_competition",
  "performance",
  "competition",
  "snack",
  "single_ingredient",
  "fridge_rescue",
  "fridge-rescue",
  "restaurant",
]);

/** Contexts where balanced-meal guidance MAY be injected (never as "mandatory"). */
const BASELINE_ALLOWED_CONTEXTS = new Set([
  "general",
  "general_nutrition",
  "weekly",
  "balanced",
  "standard",
]);

/**
 * Returns true ONLY if this context is explicitly recognized as general/balanced.
 * Conservative default: unknown contexts are blocked.
 */
export function canInjectBaselineMacros(context: string | undefined): boolean {
  if (!context) return false;
  const normalized = context.toLowerCase().replace(/[\s-]/g, "_");
  if (BASELINE_BLOCKED_CONTEXTS.has(normalized)) return false;
  return BASELINE_ALLOWED_CONTEXTS.has(normalized);
}

/**
 * Safe macro coercion — returns the number if valid and non-negative, otherwise null.
 * NEVER returns a fabricated default.
 */
export function safeMacroValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (isNaN(n) || n < 0) return null;
  return n;
}

/**
 * Resolve total carbs from an AI response object without inventing a value.
 * Returns null if the AI provided no carb data at all.
 *
 * Logic:
 *   1. If AI returned a direct `carbs` field, use it.
 *   2. If AI returned starchy + fibrous splits (even if one is 0), sum them.
 *   3. If AI returned nothing → null (unknown, do not invent).
 */
export function resolveAICarbsStrict(aiMeal: {
  carbs?: unknown;
  carbs_g?: unknown;
  starchyCarbs?: unknown;
  fibrousCarbs?: unknown;
}): number | null {
  const direct = safeMacroValue(aiMeal.carbs) ?? safeMacroValue(aiMeal.carbs_g);
  if (direct !== null) return direct;

  const hasStarchy = aiMeal.starchyCarbs !== undefined && aiMeal.starchyCarbs !== null;
  const hasFibrous = aiMeal.fibrousCarbs !== undefined && aiMeal.fibrousCarbs !== null;

  if (hasStarchy || hasFibrous) {
    const starchy = safeMacroValue(aiMeal.starchyCarbs) ?? 0;
    const fibrous = safeMacroValue(aiMeal.fibrousCarbs) ?? 0;
    return starchy + fibrous;
  }

  return null;
}

/**
 * Format a nullable macro for display.
 * Returns the number string if known, or "—" if unknown.
 */
export function displayMacro(value: number | null | undefined, unit = ""): string {
  if (value === null || value === undefined) return "—";
  return `${value}${unit}`;
}
