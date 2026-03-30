/**
 * Cancer Support Nutrition — Post-Generation Safety Validator
 *
 * Second line of defense after the prompt guardrail.
 * Scans generated meal names, descriptions, and instructions for
 * language that implies clinical treatment, cures, or medical decision-making.
 *
 * If any forbidden pattern is matched, the meal is flagged as invalid
 * and should be rejected/regenerated.
 *
 * Feature flag: oncology_support_v1
 */

import type { ValidationResult } from "../types";

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
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
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
 * Validate a generated meal for oncology safety compliance.
 * Returns isValid=false if any forbidden pattern is found.
 *
 * @param meal - The generated meal object to validate
 * @returns ValidationResult with violations listed if invalid
 */
export function validateOncologyMealSafety(meal: MealToValidate): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

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

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(fullText)) {
      const match = fullText.match(pattern)?.[0];
      violations.push(`Unsafe clinical language detected: "${match}" — ${reason}`);
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
        `[oncologySupportValidator] REJECTED meal "${meal.name}" — unsafe language. Violations: ${result.violations.join("; ")}`
      );
    }
    return result.isValid;
  });
}
