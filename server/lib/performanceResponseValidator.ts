/**
 * Performance AI Response Validator
 *
 * Validates AI coach responses against two authoritative sources:
 *   1. Authoritative Baseline — the Macro Calculator's stored prescription.
 *   2. Today's Resolved Targets — the Performance Protocol Resolver's daily application.
 *
 * The AI explains and executes these targets. It does not create a third set.
 *
 * Validation rules:
 * - Daily protein must exactly match resolvedProteinG (no AI adjustment).
 * - Daily carbs must exactly match resolvedCarbsG (session modifier already applied by resolver).
 * - Daily fat must exactly match resolvedFatG.
 * - Daily calories must exactly match resolvedCalories.
 * - Per-meal allocations are permitted when they are clearly partitions of the daily total.
 * - Additive language that places nutrients ON TOP OF the resolved daily total is a violation.
 * - `maxSaturatedFat_g: 10` is a ceiling on saturated fat, not a total-fat floor — never used here.
 */

export interface NutritionBaseline {
  proteinG: number;
  carbsG: number;
  fatG: number;
  calories: number;
}

export interface ResolvedSession {
  proteinG: number;
  carbsG: number;
  fatG: number;
  calories: number;
  sessionLabel: string;
  sessionType: string;
}

export interface AuthoritativeTargets {
  baseline: NutritionBaseline;
  resolved: ResolvedSession;
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

// Tolerance bands for exact-match comparisons (floating-point rounding only)
const GRAM_TOLERANCE   = 2;   // ±2g
const CALORIE_TOLERANCE = 15; // ±15 kcal

// Context classifiers
const DAILY_CONTEXT_RE = /\bper\s+day\b|\bdaily\b|\beach\s+day\b|\ba\s+day\b|\bper\s*\/\s*day\b|\btotal\b.*?\b(?:intake|target|goal)\b|\bday(?:'s)?\s+(?:total|target)\b/i;
const PER_MEAL_CONTEXT_RE = /\bper\s+meal\b|\beach\s+meal\b|\bat\s+(?:breakfast|lunch|dinner)\b|\b(?:pre|post|intra)\s*-?\s*workout\b|\bbefore\s+(?:training|workout)\b|\bafter\s+(?:training|workout)\b|\bmorning\b|\bevening\b|\bsnack\b|\bin\s+this\s+meal\b/i;

// Additive language — always a violation (adding nutrients on top of resolved daily total)
const ADDITIVE_LANGUAGE_RE = /\bon\s+top\s+of\b|\bin\s+addition\s+to\b|\bplus\s+(?:an?\s+)?(?:extra|additional)\b|\badditional\s+\d+\s*g\b|\bextra\s+\d+\s*g\b/i;

type NutrientKey = "protein" | "carbs" | "fat" | "calories";

interface ExtractedMention {
  nutrient: NutrientKey;
  value:    number;
  context:  "daily" | "per_meal" | "ambiguous";
  raw:      string;
}

/**
 * Split text into sentence-like segments and extract nutrient+value pairs with context.
 */
function extractNutrientMentions(text: string): ExtractedMention[] {
  const mentions: ExtractedMention[] = [];

  // Split on sentence boundaries (. ! ?) or newlines
  const segments = text.split(/(?<=[.!?\n])\s*/);

  for (const seg of segments) {
    if (!seg.trim()) continue;

    const isDaily   = DAILY_CONTEXT_RE.test(seg);
    const isPerMeal = PER_MEAL_CONTEXT_RE.test(seg);
    // A segment can be both (e.g., "split your daily carbs across each meal") — treat as per_meal
    const context: "daily" | "per_meal" | "ambiguous" =
      isPerMeal ? "per_meal" : isDaily ? "daily" : "ambiguous";

    const segLower = seg.toLowerCase();

    // Scan every gram value in the segment
    for (const match of seg.matchAll(/(\d+(?:\.\d+)?)\s*g(?:rams?)?\b/gi)) {
      const value    = parseFloat(match[1]);
      const matchIdx = match.index ?? 0;
      // Look at ±40 chars around the number for the nutrient label
      const window = segLower.substring(Math.max(0, matchIdx - 40), matchIdx + 40);

      let nutrient: NutrientKey | null = null;
      if (/protein/.test(window)) nutrient = "protein";
      else if (/carb(?:ohydrate)?s?/.test(window)) nutrient = "carbs";
      else if (/\bfat\b/.test(window)) nutrient = "fat";

      if (nutrient) mentions.push({ nutrient, value, context, raw: seg.trim() });
    }

    // Scan calorie / kcal values
    for (const match of seg.matchAll(/(\d+(?:\.\d+)?)\s*(?:calories?|kcal)\b/gi)) {
      const value = parseFloat(match[1]);
      mentions.push({ nutrient: "calories", value, context, raw: seg.trim() });
    }
  }

  return mentions;
}

/**
 * Validate an AI-generated coaching response against authoritative targets.
 *
 * Returns { valid: true } when no violations are found.
 * Returns { valid: false, violations: [...descriptions] } otherwise.
 */
export function validatePerformanceResponse(
  text: string,
  targets: AuthoritativeTargets,
): ValidationResult {
  const violations: string[] = [];

  // ── Additive language check ───────────────────────────────────────────────
  const additiveMatch = text.match(ADDITIVE_LANGUAGE_RE);
  if (additiveMatch) {
    violations.push(
      `Response contains additive nutrient language outside authorized protocol: "${additiveMatch[0]}". ` +
      `All timing allocations must come from the daily total — not add to it.`,
    );
  }

  // ── Nutrient value checks ─────────────────────────────────────────────────
  const mentions = extractNutrientMentions(text);
  const { resolved } = targets;

  for (const m of mentions) {
    if (m.context === "per_meal") {
      // Per-meal: only flag if value exceeds daily total (clearly impossible partition)
      if (m.nutrient === "protein" && m.value > resolved.proteinG + GRAM_TOLERANCE) {
        violations.push(
          `Per-meal protein (${m.value}g) exceeds the full daily protein target (${resolved.proteinG}g). ` +
          `Per-meal values must be partitions of the daily total.`,
        );
      }
      if (m.nutrient === "carbs" && m.value > resolved.carbsG + GRAM_TOLERANCE) {
        violations.push(
          `Per-meal carbs (${m.value}g) exceeds the full daily carb target (${resolved.carbsG}g). ` +
          `Per-meal values must be partitions of the daily total.`,
        );
      }
      // Permit valid per-meal partitions — no further checks
      continue;
    }

    // Daily or ambiguous context: validate against exact resolved targets
    if (m.nutrient === "protein") {
      if (Math.abs(m.value - resolved.proteinG) > GRAM_TOLERANCE) {
        violations.push(
          `Daily protein (${m.value}g) does not match the authoritative target (${resolved.proteinG}g). ` +
          `Protein is PROTECTED — only a deterministic Macro Calculator recalculation may change it.`,
        );
      }
    } else if (m.nutrient === "carbs") {
      if (Math.abs(m.value - resolved.carbsG) > GRAM_TOLERANCE) {
        violations.push(
          `Daily carbohydrates (${m.value}g) do not match today's resolved target (${resolved.carbsG}g). ` +
          `The session modifier has already been applied by the deterministic resolver.`,
        );
      }
    } else if (m.nutrient === "fat") {
      if (Math.abs(m.value - resolved.fatG) > GRAM_TOLERANCE) {
        violations.push(
          `Daily fat (${m.value}g) does not match the authoritative target (${resolved.fatG}g). ` +
          `Fat is anchored to the Macro Calculator baseline.`,
        );
      }
    } else if (m.nutrient === "calories") {
      if (Math.abs(m.value - resolved.calories) > CALORIE_TOLERANCE) {
        violations.push(
          `Daily calorie recommendation (${m.value}kcal) does not match today's resolved target (${resolved.calories}kcal).`,
        );
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Safe deterministic fallback when both AI attempts fail validation.
 * Uses TODAY'S RESOLVED targets (not unchanged baseline) per approved spec.
 */
export function buildDeterministicFallback(targets: AuthoritativeTargets): string {
  const { resolved } = targets;
  return (
    `Your targets for today are ${resolved.proteinG}g protein, ` +
    `${resolved.carbsG}g carbohydrates, ${resolved.fatG}g fat, and ` +
    `${resolved.calories} calories based on your ${resolved.sessionLabel}. ` +
    `These targets come from your Macro Calculator and today's Performance Protocol.`
  );
}
