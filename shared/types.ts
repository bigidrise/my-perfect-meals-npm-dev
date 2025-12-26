// shared/types.ts

// ============================================================================
// UNIFIED INGREDIENT CONTRACT (December 2024)
// All generators MUST use this format. No metric units, no ingredient macros.
// ============================================================================

/**
 * U.S.-only measurement units for ingredients.
 * NEVER use grams, ml, or "pieces" for proteins.
 */
export const US_SOLID_UNITS = ['oz', 'lb', 'cup', 'tbsp', 'tsp', 'each'] as const;
export const US_LIQUID_UNITS = ['cup', 'tbsp', 'tsp', 'fl oz'] as const;
export type USSolidUnit = typeof US_SOLID_UNITS[number];
export type USLiquidUnit = typeof US_LIQUID_UNITS[number];

/**
 * Unified Ingredient interface - the ONLY format for ingredient data.
 * 
 * Rules:
 * - amount: numeric string like "6", "1/2", "2"
 * - unit: ONLY oz, lb, cup, tbsp, tsp, each (for eggs only), fl oz
 * - NO grams/ml/pieces for proteins (use oz/lb)
 * - NO macro data on ingredients (macros live on the meal)
 */
export interface Ingredient {
  name: string;           // "chicken thigh", "Greek yogurt"
  amount: string;         // "6", "1/2", "2" - always a string for fractions
  unit: string;           // oz, lb, cup, tbsp, tsp, each, fl oz
  preparationNote?: string; // "boneless, skinless", "diced", "grilled"
}

/**
 * Legacy ingredient format (for backwards compatibility during migration)
 * DO NOT use in new code - convert to Ingredient immediately
 */
export interface LegacyIngredient {
  item?: string;
  name?: string;
  amount?: number | string;
  quantity?: number | string;
  unit?: string;
  notes?: string;
  protein?: number;
  carbs?: number;
  fat?: number;
  calories?: number;
}

// ============================================================================
// ORIGINAL TYPES BELOW
// ============================================================================

// Still keep your old request interface (used by weekly planner etc.)
export interface MealPlanRequest {
  diet?: string;
  planDuration?: number;
  mealsPerDay?: number;
  snacksPerDay?: number;
  selectedIngredients: string[];
}

// --- Newer types for AI Meal Creator, Craving Creator, Potluck Planner ---

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface GeneratedMeal {
  id: string;
  name: string;
  description?: string;
  ingredients?: string[];
  instructions?: string[];
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    starchyCarbs?: number;
    fibrousCarbs?: number;
  };
  mealType?: MealType;
  suggestedTime?: string;
}

export interface PlanResponse {
  meals: GeneratedMeal[];
}

export interface MacroLogInput {
  mealId?: string;
  mealName: string;
  source: "ai_meal_creator" | "craving_creator" | "potluck_planner";
  servings: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  };
  loggedAtISO: string;
  idempotencyKey?: string;
}
