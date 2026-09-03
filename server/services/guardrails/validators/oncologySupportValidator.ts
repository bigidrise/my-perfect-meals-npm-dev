/**
 * Cancer Support Nutrition — Post-Generation Safety Validator
 *
 * Second line of defense after the prompt guardrail.
 * Two checks:
 * 1. Scans generated meal text for forbidden clinical/treatment language.
 * 2. Scans ingredient lists for hard-blocked ingredients (bacon, processed meats, etc.).
 *
 * If either check fails, the meal is flagged invalid and must be rejected/regenerated.
 *
 * Feature flag: oncology_support_v1
 */

import type { ValidationResult } from "../types";
import { ONCOLOGY_HARD_BLOCKED_INGREDIENTS } from "../prompt/oncologySupportPromptBuilder";

interface MealToValidate {
  name: string;
  description?: string;
  ingredients?: Array<{ name?: string; item?: string } | string>;
  instructions?: string | string[];
}

/**
 * Patterns that constitute unsafe clinical/treatment language.
 * These must NEVER appear in a generated meal name, description, or instructions.
 */
const FORBIDDEN_LANGUAGE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(cure[sd]?|curing|fights? cancer|anti.?cancer|tumor.?reduc|fight.?tumor)\b/i,
    reason: "Implies disease treatment or cure",
  },
  {
    pattern: /\b(chemotherapy|chemo|radiation therapy|oncology treatment|clinical trial)\b/i,
    reason: "References specific medical treatment",
  },
  {
    pattern: /\b(kills? cancer|destroys? tumor|shrinks? tumor|targets? cancer)\b/i,
    reason: "Implies direct oncological effect",
  },
  {
    pattern: /\b(recommended (dose|dosage|supplement)|take \d+ mg|supplement (with|daily))\b/i,
    reason: "Implies supplement or medication dosing recommendation",
  },
  {
    pattern: /\b(treat(s|ing|ment of) (cancer|tumor|malignancy|disease))\b/i,
    reason: "Implies disease treatment",
  },
  {
    pattern: /\b(clinically proven|medically proven|studies show this (helps?|treats?))\b/i,
    reason: "Implies clinical efficacy claim",
  },
  {
    pattern: /\b(replaces? (chemo|radiation|treatment|medication))\b/i,
    reason: "Implies replacement of medical treatment",
  },
  {
    pattern: /\b(boosts? immune system to fight cancer|immune.?boosting for cancer)\b/i,
    reason: "Implies direct immune-oncological claim",
  },
];

/**
 * Extract all ingredient name strings from a meal for scanning.
 */
function extractIngredientNames(meal: MealToValidate): string[] {
  if (!meal.ingredients || !Array.isArray(meal.ingredients)) return [];
  return meal.ingredients.map((ing) => {
    if (typeof ing === "string") return ing.toLowerCase();
    return ((ing.name || ing.item || "")).toLowerCase();
  });
}

/**
 * Check a single ingredient name string against the hard-blocked list.
 * Returns the matched blocked term if found, null otherwise.
 */
function findBlockedIngredient(ingredientName: string): string | null {
  const lower = ingredientName.toLowerCase();
  for (const blocked of ONCOLOGY_HARD_BLOCKED_INGREDIENTS) {
    if (lower.includes(blocked.toLowerCase())) {
      return blocked;
    }
  }
  return null;
}

/**
 * Validate a generated meal for oncology safety compliance.
 * Returns isValid=false if any forbidden language OR forbidden ingredient is found.
 *
 * @param meal - The generated meal object to validate
 * @returns ValidationResult with violations listed if invalid
 */
export function validateOncologyMealSafety(meal: MealToValidate): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // --- Check 1: Forbidden clinical language in text fields ---
  const textToScan: string[] = [
    meal.name || "",
    meal.description || "",
  ];

  if (Array.isArray(meal.instructions)) {
    textToScan.push(...meal.instructions);
  } else if (typeof meal.instructions === "string") {
    textToScan.push(meal.instructions);
  }

  const fullText = textToScan.join(" ");

  for (const { pattern, reason } of FORBIDDEN_LANGUAGE_PATTERNS) {
    if (pattern.test(fullText)) {
      const match = fullText.match(pattern)?.[0];
      violations.push(`Unsafe clinical language detected: "${match}" — ${reason}`);
    }
  }

  // --- Check 2: Hard-blocked ingredients in ingredient list ---
  const ingredientNames = extractIngredientNames(meal);
  for (const ingredientName of ingredientNames) {
    const blocked = findBlockedIngredient(ingredientName);
    if (blocked) {
      violations.push(
        `Hard-blocked ingredient found: "${ingredientName}" matches blocked term "${blocked}" — not allowed under Cancer Support Nutrition protocol`
      );
    }
  }

  // --- Also scan the meal name itself for obvious blocked ingredients ---
  // (guards against AI embedding blocked items in the dish name e.g. "Bacon Egg Bowl")
  const mealNameLower = (meal.name || "").toLowerCase();
  for (const blocked of ONCOLOGY_HARD_BLOCKED_INGREDIENTS) {
    if (mealNameLower.includes(blocked.toLowerCase())) {
      const alreadyCaught = violations.some((v) => v.includes(`"${blocked}"`));
      if (!alreadyCaught) {
        violations.push(
          `Hard-blocked ingredient appears in meal name: "${meal.name}" contains "${blocked}" — not allowed under Cancer Support Nutrition protocol`
        );
      }
    }
  }

  if (violations.length > 0) {
    console.warn(`[oncologySupportValidator] Meal "${meal.name}" failed safety check:`, violations);
  }

  return {
    isValid: violations.length === 0,
    violations,
    warnings,
    dietType: "anti-inflammatory",
  };
}

/**
 * Validate an array of generated meals.
 * Returns only the meals that pass the safety check.
 * Logs rejected meals for observability.
 *
 * @param meals - Array of meals to validate
 * @returns Filtered array of safe meals
 */
export function filterOncologySafeMeals<T extends MealToValidate>(meals: T[]): T[] {
  return meals.filter((meal) => {
    const result = validateOncologyMealSafety(meal);
    if (!result.isValid) {
      console.warn(
        `[oncologySupportValidator] REJECTED meal "${meal.name}" — violations: ${result.violations.join("; ")}`
      );
    }
    return result.isValid;
  });
}
