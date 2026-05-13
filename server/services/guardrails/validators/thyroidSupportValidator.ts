/**
 * Thyroid Support Post-Generation Validator
 *
 * A second-layer safety check that runs after meal generation when
 * Thyroid Support is active. Enforces hard blocks and flags
 * pseudoscientific language patterns.
 *
 * This validator deliberately does NOT block cruciferous vegetables,
 * soy in normal amounts, or any food that wellness mythology wrongly bans.
 * Precision over paranoia.
 *
 * Sources: ATA, AACE, Endocrine Society, NIH ODS.
 */

export interface ThyroidValidationResult {
  passed: boolean;
  violations: string[];
  /** Whether a regen is required (hard violations) vs. advisory only. */
  requiresRegen: boolean;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HARD BLOCKED — these should never appear in a thyroid support meal
// ─────────────────────────────────────────────────────────────────────────────

const THYROID_HARD_BLOCKED: Array<{ pattern: RegExp; label: string }> = [
  // Iodine extremes
  { pattern: /\b(kelp\s+supplement|seaweed\s+supplement|iodine\s+supplement|kelp\s+powder)\b/i, label: "Iodine supplement (kelp/seaweed supplement)" },
  // Alcohol
  { pattern: /\b(beer|wine|liquor|whiskey|whisky|vodka|rum|gin|tequila|brandy|champagne|cocktail|spirits)\b/i, label: "Alcohol" },
  // Energy drinks / soda
  { pattern: /\benergy\s+drink\b/i, label: "Energy drink" },
  { pattern: /\b(cola|pepsi|mountain\s+dew|red\s+bull|monster\s+energy)\b/i, label: "Soda / energy drink" },
  // Deep fried
  { pattern: /\bdeep.fried\b/i, label: "Deep fried preparation" },
  // Ultra-processed
  { pattern: /\bfast\s+food\b/i, label: "Fast food" },
];

// ─────────────────────────────────────────────────────────────────────────────
// PSEUDOSCIENCE LANGUAGE — patterns that destroy platform credibility
// ─────────────────────────────────────────────────────────────────────────────

const PSEUDOSCIENCE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /thyroid\s+detox/i,               label: "'thyroid detox' claim" },
  { pattern: /thyroid\s+cleanse/i,             label: "'thyroid cleanse' claim" },
  { pattern: /heal\s+(your\s+)?thyroid/i,      label: "'heal your thyroid' claim" },
  { pattern: /reverse\s+hashimoto/i,           label: "'reverse Hashimoto's' claim" },
  { pattern: /boost\s+(your\s+)?thyroid/i,     label: "'boost your thyroid' claim" },
  { pattern: /cure\s+(your\s+)?thyroid/i,      label: "'cure thyroid' claim" },
  { pattern: /thyroid\s+healing\s+protocol/i,  label: "'thyroid healing protocol' claim" },
  { pattern: /fix\s+(your\s+)?thyroid/i,       label: "'fix your thyroid' claim" },
  { pattern: /naturally\s+treat\s+thyroid/i,   label: "'naturally treat thyroid' claim" },
  { pattern: /thyroid\s+superfoods?\b/i,       label: "'thyroid superfood' wellness trope" },
];

// ─────────────────────────────────────────────────────────────────────────────
// SMART CHECKS — context-sensitive, not blanket bans
// ─────────────────────────────────────────────────────────────────────────────

/** Check if soy protein ISOLATE (not regular soy) appears as a primary ingredient. */
function hasSoyIsolateAsMainIngredient(mealText: string): boolean {
  return (
    /soy\s+protein\s+isolate/i.test(mealText) ||
    /textured\s+soy\s+protein/i.test(mealText) ||
    /TSP\s+protein/i.test(mealText)
  );
}

/** Check if millet appears as the PRIMARY grain (not just a garnish). */
function hasMilletAsPrimaryGrain(mealText: string): boolean {
  return /\bmillet\b/i.test(mealText) && !/small\s+amount|garnish|sprinkle/i.test(mealText);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

function getMealText(meal: {
  title?: string;
  name?: string;
  description?: string;
  ingredients?: Array<{ item?: string; name?: string }>;
  instructions?: string | string[];
}): string {
  const parts: string[] = [];
  if (meal.title)       parts.push(meal.title);
  if (meal.name)        parts.push(meal.name);
  if (meal.description) parts.push(meal.description);
  if (meal.ingredients) {
    for (const ing of meal.ingredients) {
      if (ing.item) parts.push(ing.item);
      if (ing.name) parts.push(ing.name);
    }
  }
  if (meal.instructions) {
    if (Array.isArray(meal.instructions)) {
      parts.push(...meal.instructions);
    } else {
      parts.push(meal.instructions);
    }
  }
  return parts.join(" ");
}

export function validateThyroidSupportMeal(meal: {
  title?: string;
  name?: string;
  description?: string;
  ingredients?: Array<{ item?: string; name?: string }>;
  instructions?: string | string[];
}): ThyroidValidationResult {
  const text = getMealText(meal);
  const violations: string[] = [];
  let requiresRegen = false;

  // Check hard blocks
  for (const { pattern, label } of THYROID_HARD_BLOCKED) {
    if (pattern.test(text)) {
      violations.push(`Hard block: ${label}`);
      requiresRegen = true;
    }
  }

  // Check pseudoscience language
  for (const { pattern, label } of PSEUDOSCIENCE_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Pseudoscientific claim detected: ${label}`);
      requiresRegen = true;
    }
  }

  // Check smart context-sensitive flags
  if (hasSoyIsolateAsMainIngredient(text)) {
    violations.push("Advisory: Soy protein isolate detected as primary ingredient — prefer whole-food soy (tofu, edamame) instead");
  }

  if (hasMilletAsPrimaryGrain(text)) {
    violations.push("Advisory: Millet detected as primary grain — consider swapping for quinoa, oats, or brown rice for thyroid support");
  }

  const passed = !requiresRegen;

  return {
    passed,
    violations,
    requiresRegen,
    message: passed
      ? violations.length > 0
        ? `Thyroid support: passed (${violations.length} advisory note(s))`
        : "Thyroid support: passed"
      : `Thyroid support: failed — ${violations.filter(v => !v.startsWith("Advisory")).join("; ")}`,
  };
}
