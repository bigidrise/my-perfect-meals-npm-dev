/**
 * shared/units.ts
 *
 * Canonical unit conversion and display utilities for My Perfect Meals.
 * All oz↔g, lbs↔kg, cups↔ml conversions go through here — NEVER scatter them.
 *
 * Usage:
 *   import { convertWeightDisplay, convertVolumeDisplay, getMeasurementPromptBlock } from "@shared/units";
 */

export type MeasurementSystem = "imperial" | "metric";
/** Saved intent is distinct from the two-value contract consumed by converters. */
export type MeasurementPreference = "auto" | MeasurementSystem;
export const MEASUREMENT_COUNTRIES = ["US", "CA", "AU", "UK", "NZ"] as const;
export const DEFAULT_MEASUREMENT_COUNTRY = "US";

export function measurementPreference(value: unknown): MeasurementPreference {
  return value === "imperial" || value === "metric" ? value : "auto";
}

/** Missing/unsupported country retains the existing US fallback, never device locale. */
export function resolveMeasurementSystem(preference: unknown, country?: unknown): MeasurementSystem {
  if (preference === "imperial" || preference === "metric") return preference;
  return country === "CA" || country === "AU" || country === "UK" || country === "NZ"
    ? "metric" : "imperial";
}

/**
 * Strict numeric quantity parsing, not punctuation stripping. A lone comma with
 * three trailing digits is ambiguous grouping and remains unconverted.
 */
export function parseMeasurementNumber(value: string | number): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const glyphs: Record<string, string> = { "¼": "1/4", "½": "1/2", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8" };
  const text = value.trim().replace(/(\d)([¼½¾⅓⅔⅛⅜⅝⅞])/g, "$1 $2")
    .replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, glyph => glyphs[glyph]);
  const fraction = text.match(/^([+-])?(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[4]);
    if (!denominator) return null;
    return (fraction[1] === "-" ? -1 : 1) * (Number(fraction[2] || 0) + Number(fraction[3]) / denominator);
  }
  if (/^[+-]?[1-9]\d{0,2},\d{3}$/.test(text)) return null;
  if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text)) return null;
  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

// ─── Weight ──────────────────────────────────────────────────────────────────

/** Display a weight value in the user's preferred system. Input is always grams internally. */
export function convertWeightDisplay(grams: number, system: MeasurementSystem): string {
  if (system === "metric") {
    if (grams >= 1000) {
      const kg = grams / 1000;
      return `${+kg.toFixed(2).replace(/\.?0+$/, "")} kg`;
    }
    return `${Math.round(grams)} g`;
  }
  // Imperial
  const oz = grams / 28.3495;
  if (oz >= 16) {
    const lbs = oz / 16;
    return `${+lbs.toFixed(1).replace(/\.?0+$/, "")} lb`;
  }
  return `${+oz.toFixed(1).replace(/\.?0+$/, "")} oz`;
}

/** Convert a lbs value to display string in the user's preferred system. */
export function convertWeightLbsDisplay(lbs: number, system: MeasurementSystem): string {
  if (system === "metric") {
    const kg = lbs * 0.453592;
    return `${+kg.toFixed(1).replace(/\.?0+$/, "")} kg`;
  }
  return `${+lbs.toFixed(1)} lbs`;
}

/** Convert a kg value to display string in the user's preferred system. */
export function convertWeightKgDisplay(kg: number, system: MeasurementSystem): string {
  if (system === "metric") {
    return `${+kg.toFixed(1).replace(/\.?0+$/, "")} kg`;
  }
  const lbs = kg / 0.453592;
  return `${Math.round(lbs)} lbs`;
}

/** Normalize numeric input to lbs; callers must respect their own storage unit. */
export function parseWeightToLbs(value: string, system: MeasurementSystem): number | null {
  const num = parseMeasurementNumber(value);
  if (num === null || num < 0) return null;
  return system === "metric" ? num / 0.453592 : num;
}

// ─── Height ──────────────────────────────────────────────────────────────────

/** Display height in cm as the user's preferred system. */
export function convertHeightDisplay(cm: number, system: MeasurementSystem): string {
  if (system === "metric") return `${Math.round(cm)} cm`;
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}' ${inches}"`;
}

// ─── Volume ──────────────────────────────────────────────────────────────────

/** Display a volume in ml in the user's preferred system. */
export function convertVolumeDisplay(ml: number, system: MeasurementSystem): string {
  if (!Number.isFinite(ml) || ml < 0) return "—";
  if (ml === 0) return system === "metric" ? "0 ml" : "0 cup";
  if (system === "metric") {
    if (ml >= 1000) {
      const liters = ml / 1000;
      return `${+liters.toFixed(2).replace(/\.?0+$/, "")} L`;
    }
    return `${Math.round(ml)} ml`;
  }
  // Imperial: cups / tbsp / tsp
  if (ml >= 240) {
    const cups = ml / 240;
    if (cups >= 1) {
      let whole = Math.floor(cups);
      const frac = cups - whole;
      const fracStr = frac < 0.1 ? "" : frac < 0.3 ? " 1/4" : frac < 0.55 ? " 1/2" : frac < 0.85 ? " 3/4" : "";
      if (frac >= 0.85) whole += 1;
      return whole > 0 ? `${whole}${fracStr} cup` : `${fracStr.trim()} cup`;
    }
  }
  if (ml >= 15) {
    const tbsp = Math.round(ml / 15);
    return `${tbsp} tbsp`;
  }
  const tsp = Math.round(ml / 5);
  return `${tsp || 1} tsp`;
}

// ─── Serving display (for recipe ingredients) ────────────────────────────────

/** Convert a serving amount+unit from generated recipe to display string. */
export function convertServingDisplay(
  amount: string | number,
  unit: string,
  system: MeasurementSystem
): string {
  const original = `${amount} ${unit}`.trim();
  const num = parseMeasurementNumber(amount);
  if (num === null || num < 0) return original;

  const u = unit.toLowerCase().trim();
  if (system === "imperial") {
    if (u === "g" || u === "gram" || u === "grams") return convertWeightDisplay(num, system);
    if (u === "kg" || u === "kilogram" || u === "kilograms") return convertWeightDisplay(num * 1000, system);
    if (u === "ml" || u === "milliliter" || u === "milliliters") return convertVolumeDisplay(num, system);
    if (u === "l" || u === "liter" || u === "liters") return convertVolumeDisplay(num * 1000, system);
    return original;
  }

  // Weight: oz → g
  if (u === "oz" || u === "ounce" || u === "ounces") {
    const g = num * 28.3495;
    return convertWeightDisplay(g, "metric");
  }
  // Weight: lb / lbs → kg
  if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") {
    const g = num * 453.592;
    return convertWeightDisplay(g, "metric");
  }
  // Volume: cup / cups → ml
  if (u === "cup" || u === "cups") {
    return convertVolumeDisplay(num * 240, "metric");
  }
  // Volume: fl oz → ml
  if (u === "fl oz" || u === "fl. oz") {
    return convertVolumeDisplay(num * 29.574, "metric");
  }
  // tbsp → ml
  if (u === "tbsp" || u === "tablespoon" || u === "tablespoons") {
    return convertVolumeDisplay(num * 14.787, "metric");
  }
  // tsp → ml  (small enough to keep as ml or just show as-is)
  if (u === "tsp" || u === "teaspoon" || u === "teaspoons") {
    const ml = num * 4.929;
    return ml < 5 ? `${num} tsp` : convertVolumeDisplay(ml, "metric");
  }

  // Unknown unit — return as-is
  return original;
}

/** Length display accepts an explicit source tag; never guesses history units. */
export function convertLengthDisplay(value: number, unit: string, system: MeasurementSystem): string {
  if (!Number.isFinite(value)) return "—";
  if (unit !== "cm" && unit !== "in" && unit !== "inches") return `${value} ${unit}`;
  const cm = unit === "cm" ? value : value * 2.54;
  return system === "metric" ? `${+cm.toFixed(1)} cm` : `${+(cm / 2.54).toFixed(1)} in`;
}

// ─── AI Prompt instruction block ─────────────────────────────────────────────

/**
 * Returns the measurement instruction block to inject into AI meal generation prompts.
 * Metric users get grams/ml/kg; Imperial users get the existing oz/cups/lbs rules.
 *
 * Usage in prompt builders:
 *   ${getMeasurementPromptBlock(user.measurementSystem ?? "imperial")}
 */
export function getMeasurementPromptBlock(system: MeasurementSystem): string {
  if (system === "metric") {
    return `\
🌍 METRIC MEASUREMENT RULES (CRITICAL - EXACT MEASUREMENTS REQUIRED):
- Use ONLY these units: g (grams), kg, ml, L, tbsp, tsp, each (for eggs only)
- NEVER use oz, lb, lbs, cups, or imperial units
- Proteins (chicken, beef, fish, pork) MUST be measured in grams (120–250g typical serving)
- DEFAULT LEAN CUT RULE: When beef, steak, lamb, or pork is included and no specific cut is named, always default to a lean cut — rotate through: sirloin, tenderloin, eye of round, flank steak, or filet mignon (vary the cut, do not always pick the same one). Red meat portion defaults to 120–180g. Only use a fatty cut (ribeye, T-bone, porterhouse, brisket) if the user explicitly names it.
- Dairy (yogurt, cheese, milk) use grams or ml
- Liquids use ml or L (e.g. 250ml milk, 500ml broth)
- Oils use tbsp or tsp
- Eggs use "each" (e.g. 2 each eggs)
- ALWAYS provide EXACT numeric measurements — never use "a pinch", "dash", "to taste"
- Use precise amounts like 200g, 250ml, 2 tbsp — no vague measurements
- For small amounts use fractions in tbsp/tsp: 1/4 tsp, 1/2 tbsp
- Scale output for the requested servings exactly
- Every ingredient MUST have a specific amount and unit
- DO NOT include macro/nutrition data in ingredient rows — macros go in the nutrition object only

⚠️ PROTEIN POWDER & SUPPLEMENT EXCEPTION (overrides all weight rules above):
- Protein powder, whey protein, casein protein, plant-based protein, vegan protein, collagen powder, creatine, pre-workout powder, or ANY supplement powder MUST use "scoop" or "scoops" as the unit — NEVER grams, oz, or any weight unit.
- Scoop sizes vary by brand. Do NOT convert to weight. The user knows their brand's scoop size.
- Use whole numbers: 1 scoop, 2 scoops, 1/2 scoop — nothing else.
- Example: {"name": "vegan protein powder", "amount": "1", "unit": "scoop"} ✅
- Example: {"name": "whey protein", "amount": "40", "unit": "g"} ❌ WRONG — always use scoop

EXAMPLES OF CORRECT METRIC INGREDIENT FORMAT:
- {"name": "chicken breast", "amount": "180", "unit": "g", "preparationNote": "boneless, skinless"}
- {"name": "Greek yogurt", "amount": "200", "unit": "g"}
- {"name": "olive oil", "amount": "2", "unit": "tbsp"}
- {"name": "eggs", "amount": "2", "unit": "each", "preparationNote": "scrambled"}
- {"name": "broccoli florets", "amount": "150", "unit": "g", "preparationNote": "steamed"}
- {"name": "mixed greens", "amount": "60", "unit": "g"}
- {"name": "milk", "amount": "250", "unit": "ml"}
- {"name": "chicken broth", "amount": "500", "unit": "ml"}
- {"name": "vegan protein powder", "amount": "1", "unit": "scoop"}
- {"name": "whey protein", "amount": "2", "unit": "scoops"}

EXAMPLES OF INCORRECT FORMAT (NEVER DO THIS FOR METRIC USERS):
- {"name": "chicken", "amount": "6", "unit": "oz"} ❌ (use grams)
- {"name": "yogurt", "amount": "1", "unit": "cup"} ❌ (use grams or ml)
- {"name": "milk", "amount": "2", "unit": "cups"} ❌ (use ml)
- {"name": "protein powder", "amount": "40", "unit": "g"} ❌ (use scoops — brand scoop size varies)
- {"name": "whey protein", "amount": "1.4", "unit": "oz"} ❌ (use scoops — never weight for powders)`;
  }

  // Imperial (existing rules — preserved exactly)
  return `\
🚨 U.S. MEASUREMENT RULES (CRITICAL - EXACT MEASUREMENTS REQUIRED):
- Use ONLY these units: oz, lb, cup, tbsp, tsp, each (for eggs only), fl oz
- NEVER use grams (g), milliliters (ml), or metric units
- NEVER use "piece" or "pieces" for meats/proteins - always use oz or lb
- Proteins (chicken, beef, fish, pork) MUST be measured in oz (4-8 oz typical serving)
- DEFAULT LEAN CUT RULE: When beef, steak, lamb, or pork is included and no specific cut is named, always default to a lean cut — rotate through: sirloin, tenderloin, eye of round, flank steak, or filet mignon (vary the cut, do not always pick the same one). Red meat portion defaults to 4–6 oz. Only use a fatty cut (ribeye, T-bone, porterhouse, brisket) if the user explicitly needs it. Naming a cut overrides the cut choice only — portion still defaults to 4–6 oz unless the user also specifies a different amount.
- Dairy (yogurt, cheese, milk) use oz or cups
- Liquids use cup, tbsp, tsp, or fl oz
- ALWAYS provide EXACT numeric measurements - never use "a pinch", "dash", "to taste"
- Use precise amounts like 6 oz, 1/2 cup, 2 tbsp - no vague measurements
- For small amounts, use fractions: 1/4 tsp, 1/2 cup
- Scale output for the requested servings exactly
- Every ingredient MUST have a specific amount and unit
- DO NOT include macro/nutrition data in ingredient rows - macros go in the nutrition object only

⚠️ PROTEIN POWDER & SUPPLEMENT EXCEPTION (overrides all weight rules above):
- Protein powder, whey protein, casein protein, plant-based protein, vegan protein, collagen powder, creatine, pre-workout powder, or ANY supplement powder MUST use "scoop" or "scoops" as the unit — NEVER oz, grams, or any weight unit.
- Scoop sizes vary by brand. Do NOT convert to weight. The user knows their brand's scoop size.
- Use whole numbers: 1 scoop, 2 scoops, 1/2 scoop — nothing else.
- Example: {"name": "whey protein powder", "amount": "1", "unit": "scoop"} ✅
- Example: {"name": "protein powder", "amount": "1.4", "unit": "oz"} ❌ WRONG — always use scoop

EXAMPLES OF CORRECT INGREDIENT FORMAT:
- {"name": "chicken breast", "amount": "6", "unit": "oz", "preparationNote": "boneless, skinless"}
- {"name": "Greek yogurt", "amount": "1", "unit": "cup"}
- {"name": "olive oil", "amount": "2", "unit": "tbsp"}
- {"name": "eggs", "amount": "2", "unit": "each", "preparationNote": "scrambled"}
- {"name": "broccoli florets", "amount": "2", "unit": "cup", "preparationNote": "steamed"}
- {"name": "mixed greens", "amount": "3", "unit": "cup"}
- {"name": "spinach", "amount": "2", "unit": "cup", "preparationNote": "fresh"}
- {"name": "whey protein powder", "amount": "1", "unit": "scoop"}
- {"name": "vegan protein powder", "amount": "2", "unit": "scoops"}

EXAMPLES OF INCORRECT FORMAT (NEVER DO THIS):
- {"name": "chicken", "amount": "1", "unit": "piece"} ❌ (use oz instead)
- {"name": "yogurt", "amount": "340", "unit": "g"} ❌ (use cups instead)
- {"name": "chicken", "amount": "150", "unit": "g", "protein": 30} ❌ (no grams, no macros)
- {"name": "broccoli", "amount": "100", "unit": "g"} ❌ (use cups instead)
- {"name": "protein powder", "amount": "1.4", "unit": "oz"} ❌ (use scoops — brand scoop size varies)
- {"name": "whey protein", "amount": "40", "unit": "g"} ❌ (use scoops — never weight for powders)`;
}
