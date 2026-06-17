/**
 * Pregnancy Support — Post-Generation Safety Validator
 *
 * Second line of defense after the prompt guardrail.
 * Checks:
 *   1. Scans generated meal text for forbidden clinical/outcome language.
 *   2. Scans ingredient lists for hard-blocked ingredients (alcohol, raw fish,
 *      deli meats, high-mercury fish, unpasteurized products, raw eggs).
 *
 * If either check fails, the meal must be rejected and regenerated.
 *
 * Sources: FDA, CDC, EPA, ACOG, AAP pregnancy food safety guidelines.
 */

import type { ValidationResult } from "../types";
import { PREGNANCY_HARD_BLOCKED_INGREDIENTS } from "../prompt/pregnancySupportPromptBuilder";
export type { ValidationResult };

interface MealToValidate {
  name: string;
  description?: string;
  ingredients?: Array<{ name?: string; item?: string } | string>;
  instructions?: string | string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// FORBIDDEN LANGUAGE PATTERNS
// Language that implies clinical outcomes, guarantees, or treatment claims.
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN_LANGUAGE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(ensures?|guarantees?)\s+(healthy|safe)\s+(baby|pregnancy|birth|delivery|fetal)/i,
    reason: "Implies guaranteed pregnancy outcome — not permitted",
  },
  {
    pattern: /\b(prevents?|reduces?\s+risk\s+of)\s+(miscarriage|birth\s+defect|preeclampsia|gestational\s+diabetes|preterm)/i,
    reason: "Implies prevention of specific pregnancy complication",
  },
  {
    pattern: /\b(treats?|cures?|heals?)\s+(pregnancy|nausea|morning\s+sickness|preeclampsia|gestational)/i,
    reason: "Implies treatment of a pregnancy condition",
  },
  {
    pattern: /\b(clinically\s+proven|medically\s+proven|studies\s+show\s+this\s+(helps?|prevents?))\b/i,
    reason: "Implies clinical efficacy claim",
  },
  {
    pattern: /\b(take\s+\d+\s*(mg|mcg|iu)|supplement\s+(with|daily|dose))\b/i,
    reason: "Implies supplement or medication dosing recommendation",
  },
  {
    pattern: /\b(replaces?\s+(prenatal|supplement|medication|vitamin))\b/i,
    reason: "Implies replacement of prenatal care or supplementation",
  },
  {
    pattern: /\b(safe\s+for\s+(all|every)\s+pregnant|safe\s+during\s+(all\s+(stages|trimesters)))\b/i,
    reason: "Makes universal pregnancy safety claim",
  },
  {
    pattern: /\b(boosts?\s+(fertility|conception|fetal\s+iq|baby\s+brain))\b/i,
    reason: "Implies fertility or fetal intelligence enhancement claim",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// INGREDIENT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function extractIngredientNames(meal: MealToValidate): string[] {
  if (!meal.ingredients || !Array.isArray(meal.ingredients)) return [];
  return meal.ingredients.map((ing) => {
    if (typeof ing === "string") return ing.toLowerCase();
    return ((ing.name || ing.item || "")).toLowerCase();
  });
}

function findBlockedIngredient(ingredientName: string): string | null {
  const lower = ingredientName.toLowerCase();
  for (const blocked of PREGNANCY_HARD_BLOCKED_INGREDIENTS) {
    if (lower.includes(blocked)) return blocked;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a generated meal for pregnancy food safety compliance.
 * Returns { valid: true } if safe, or { valid: false, violations: [...] } if rejected.
 */
export function validatePregnancyMealSafety(meal: MealToValidate): ValidationResult {
  const violations: string[] = [];

  // 1. Language check — scan name, description, instructions
  const textToScan = [
    meal.name ?? "",
    meal.description ?? "",
    ...(Array.isArray(meal.instructions)
      ? meal.instructions
      : meal.instructions
        ? [meal.instructions]
        : []),
  ].join(" ");

  for (const { pattern, reason } of FORBIDDEN_LANGUAGE_PATTERNS) {
    if (pattern.test(textToScan)) {
      violations.push(`Forbidden language: ${reason}`);
    }
  }

  // 2. Ingredient hard-block check
  const ingredientNames = extractIngredientNames(meal);
  for (const name of ingredientNames) {
    const blocked = findBlockedIngredient(name);
    if (blocked) {
      violations.push(`Blocked ingredient detected: "${blocked}" — pregnancy food safety rule`);
    }
  }

  if (violations.length > 0) {
    console.warn(`[pregnancySupportValidator] Meal "${meal.name}" failed safety check:`, violations);
    return { valid: false, violations };
  }

  return { valid: true, violations: [] };
}

/**
 * Check if a single ingredient is blocked for pregnancy.
 * Used by Ingredient Intelligence and Smart Scan for real-time flagging.
 */
export function isIngredientPregnancyBlocked(ingredientName: string): {
  blocked: boolean;
  reason?: string;
} {
  const lower = ingredientName.toLowerCase();

  // Alcohol check
  if (/\balcohol|wine|beer|spirits|liquor|champagne|bourbon|whiskey|vodka|rum|tequila|gin|brandy\b/i.test(lower)) {
    return { blocked: true, reason: "Alcohol — zero tolerance during pregnancy (no safe amount established)" };
  }

  // Raw fish/shellfish check
  if (/\braw\s+(fish|salmon|tuna|shrimp|oyster|clam|mussel|scallop|crab)|sushi|sashimi|ceviche\b/i.test(lower)) {
    return { blocked: true, reason: "Raw seafood — listeria and foodborne illness risk during pregnancy" };
  }

  // High-mercury fish
  if (/\bshark|swordfish|king\s+mackerel|tilefish|bigeye\s+tuna|orange\s+roughy|marlin\b/i.test(lower)) {
    return { blocked: true, reason: "High-mercury fish — avoid during pregnancy (FDA/EPA guidance)" };
  }

  // Deli meats
  if (/\bdeli\s+meat|cold\s+cuts?|lunch\s+meat|bologna|salami\b/i.test(lower)) {
    return { blocked: true, reason: "Deli meats — listeria risk; heat to 165°F before eating during pregnancy" };
  }

  // Unpasteurized
  if (/\bunpasteurized|raw\s+milk\b/i.test(lower)) {
    return { blocked: true, reason: "Unpasteurized products — listeria risk during pregnancy" };
  }

  // Raw eggs
  if (/\braw\s+eggs?\b/i.test(lower)) {
    return { blocked: true, reason: "Raw eggs — salmonella risk; use pasteurized eggs during pregnancy" };
  }

  // Soft cheeses (flag as caution, not hard block — some are pasteurized)
  if (/\bbrie|camembert|queso\s+fresco|queso\s+blanco|soft\s+blue\s+cheese|roquefort|gorgonzola\b/i.test(lower)) {
    return { blocked: true, reason: "Soft cheese — verify pasteurized before consuming during pregnancy (listeria risk)" };
  }

  return { blocked: false };
}
