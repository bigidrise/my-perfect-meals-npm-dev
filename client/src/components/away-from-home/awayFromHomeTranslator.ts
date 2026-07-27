/**
 * awayFromHomeTranslator
 *
 * Two responsibilities:
 *
 * 1. Legacy adapter — fromLegacyRecommendation()
 *    Maps the old page-level meal data shape (meal.protein, meal.carbs, etc.)
 *    into the shared AwayFromHomeRecommendation model. This is the ONLY place
 *    that knows how to bridge the old and new shapes. All user-visible fields
 *    are mapped: title, description, reason, ordering instructions, modifications,
 *    swaps, waiter script, buffet notes, optional adjustments, warnings.
 *
 * 2. API payload builders — toMacroLogPayload(), toMealPlanItemPayload()
 *    Map AwayFromHomeRecommendation → the biometrics log and meal plan APIs.
 *    No component should build these payloads inline.
 */

import type { AwayFromHomeRecommendation, NutritionDataStatus } from "@shared/awayFromHome";

// ── Legacy shape (what Restaurant Guide + Fast Food pages currently produce) ──

export interface LegacyMeal {
  id?: string;
  name?: string;
  /** Alternate name field — prefer name, fall back to meal. */
  meal?: string;
  description?: string;
  /** Why this meal is healthy / fits the user's profile. */
  reason?: string;
  reasoning?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  imageUrl?: string;
  ingredients?: string[];
  /** Flat modification string (pre-howToOrder era). */
  modifications?: string;
  orderInstructions?: string;
  /** Medical waiter script — present when user has clinical conditions. */
  medicalWaiterScript?: string;
  howToOrder?: {
    askFor: string;
    modify: string[];
    swap: string[];
  };
}

export interface LegacyRestaurantInfo {
  name?: string;
  address?: string;
  rating?: number;
  cuisine?: string;
  photoUrl?: string;
}

/**
 * Map the legacy recommendation shape → AwayFromHomeRecommendation.
 *
 * This adapter is the single bridge between the old per-page data models
 * and the shared domain model. Every user-visible field is mapped here:
 *   - title, description
 *   - why it fits (reason)
 *   - ordering instructions (howToOrder → askFor / modify / swap)
 *   - modifications / orderInstructions fallback
 *   - waiter script
 *   - protocol alignment summary
 *
 * @param meal          - Legacy meal object from the API response
 * @param restaurantInfo - Restaurant metadata (name, address, rating, cuisine)
 * @param source        - Which feature produced this recommendation
 * @param imageUrl      - Resolved image URL (e.g. from ChefFlow), overrides meal.imageUrl
 */
export function fromLegacyRecommendation(
  meal: LegacyMeal,
  restaurantInfo: LegacyRestaurantInfo | null | undefined,
  source: AwayFromHomeRecommendation["source"],
  imageUrl?: string
): AwayFromHomeRecommendation {
  const name = meal.name || meal.meal || "Meal";
  const reason = meal.reason || meal.reasoning;

  // Build structured howToOrder from either the new howToOrder field
  // or the legacy flat modifications/orderInstructions string.
  const howToOrder: AwayFromHomeRecommendation["recommendation"]["howToOrder"] =
    meal.howToOrder
      ? {
          askFor: meal.howToOrder.askFor,
          modify: meal.howToOrder.modify ?? [],
          swap: meal.howToOrder.swap ?? [],
        }
      : meal.modifications || meal.orderInstructions
      ? {
          askFor: name,
          modify: [meal.modifications || meal.orderInstructions!],
          swap: [],
        }
      : undefined;

  return {
    id: meal.id ?? `legacy-${source}-${Date.now()}`,
    source,

    // ── Venue ───────────────────────────────────────────────────────────────
    restaurantName: restaurantInfo?.name ?? "Restaurant",
    restaurantAddress: restaurantInfo?.address,
    restaurantCuisine: restaurantInfo?.cuisine,
    restaurantRating: restaurantInfo?.rating,
    restaurantPhotoUrl: restaurantInfo?.photoUrl,

    // ── Nutrition confidence ─────────────────────────────────────────────────
    // Legacy AI-generated recommendations are always estimated unless the new
    // engine marks them otherwise.
    nutritionStatus: "estimated" as NutritionDataStatus,

    // ── Meal / Plate ─────────────────────────────────────────────────────────
    meal: {
      name,
      description: meal.description || reason,
      imageUrl: imageUrl || meal.imageUrl,
      calories: meal.calories,
      // Legacy fields use protein/carbs/fat; model uses proteinGrams/carbohydrateGrams/fatGrams
      proteinGrams: meal.protein,
      carbohydrateGrams: meal.carbs,
      fatGrams: meal.fat,
      ingredients: meal.ingredients,
    },

    // ── Recommendation intelligence ──────────────────────────────────────────
    recommendation: {
      reason,              // why it fits — the full text explanation
      howToOrder,          // structured ordering instructions (askFor / modify / swap)
      medicalWaiterScript: meal.medicalWaiterScript,
    },

    // ── Protocol alignment ───────────────────────────────────────────────────
    protocol: {
      alignmentSummary: reason,
    },
  };
}

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
export function macrosAreEditable(rec: AwayFromHomeRecommendation): boolean {
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
