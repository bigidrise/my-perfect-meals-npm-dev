/**
 * awayFromHomeTranslator
 *
 * Pure mapping utilities: AwayFromHomeRecommendation → API payload shapes.
 *
 * This is the only place in the codebase that knows how to translate the
 * shared recommendation model into the biometrics log and meal plan APIs.
 * No component should build these payloads inline.
 */

import type { AwayFromHomeRecommendation } from "@shared/awayFromHome";

// ── Biometrics log payload ────────────────────────────────────────────────────

export interface MacroLogPayload {
  date_iso: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: string;
  title: string;
  away_from_home_id?: string;
}

/**
 * Build the biometrics log payload from a recommendation.
 * Macro values may be user-overridden before calling this.
 */
export function toMacroLogPayload(
  rec: AwayFromHomeRecommendation,
  overrides: {
    dateIso: string;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    calories?: number;
    proteinGrams?: number;
    carbohydrateGrams?: number;
    fatGrams?: number;
  }
): MacroLogPayload {
  return {
    date_iso: overrides.dateIso,
    meal_type: overrides.mealType,
    calories_kcal: overrides.calories ?? rec.meal.calories ?? 0,
    protein_g: overrides.proteinGrams ?? rec.meal.proteinGrams ?? 0,
    carbs_g: overrides.carbohydrateGrams ?? rec.meal.carbohydrateGrams ?? 0,
    fat_g: overrides.fatGrams ?? rec.meal.fatGrams ?? 0,
    source: `away_from_home_${rec.source}`,
    title: rec.meal.name,
    away_from_home_id: rec.id,
  };
}

// ── Meal plan item payload ────────────────────────────────────────────────────

export interface MealPlanItemPayload {
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  away_from_home_id?: string;
}

/**
 * Build the meal plan item payload from a recommendation.
 * This shape is accepted by the weekly board slot API.
 */
export function toMealPlanItemPayload(
  rec: AwayFromHomeRecommendation,
  overrides?: {
    calories?: number;
    proteinGrams?: number;
    carbohydrateGrams?: number;
    fatGrams?: number;
  }
): MealPlanItemPayload {
  return {
    title: rec.meal.name,
    calories: overrides?.calories ?? rec.meal.calories ?? 0,
    protein: overrides?.proteinGrams ?? rec.meal.proteinGrams ?? 0,
    carbs: overrides?.carbohydrateGrams ?? rec.meal.carbohydrateGrams ?? 0,
    fat: overrides?.fatGrams ?? rec.meal.fatGrams ?? 0,
    source: `away_from_home_${rec.source}`,
    away_from_home_id: rec.id,
  };
}

// ── Macro display helpers ─────────────────────────────────────────────────────

/** True when the user should be allowed/encouraged to edit macros before logging. */
export function macrosAreEditable(
  rec: AwayFromHomeRecommendation
): boolean {
  return rec.nutritionStatus === "estimated" || rec.nutritionStatus === "mixed";
}

/** Label prefix for an estimated value ("~200 cal" vs "200 cal"). */
export function macroLabel(
  value: number | undefined,
  status: "official" | "estimated" | "mixed",
  unit: string
): string {
  if (value == null) return "—";
  const prefix = status === "official" ? "" : "~";
  return `${prefix}${value}${unit}`;
}
