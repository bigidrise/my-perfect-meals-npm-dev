// shared/types.ts

// ============================================================================
// UNIFIED INGREDIENT CONTRACT (December 2024)
// Existing generator format and restrictions remain unchanged.
// Optional canonical metadata does not activate new units or calculations.
// ============================================================================

/**
 * U.S.-only measurement units for ingredients.
 * NEVER use grams, ml, or "pieces" for proteins.
 */
export const US_SOLID_UNITS = ['oz', 'lb', 'cup', 'tbsp', 'tsp', 'each'] as const;
export const US_LIQUID_UNITS = ['cup', 'tbsp', 'tsp', 'fl oz'] as const;
export type USSolidUnit = typeof US_SOLID_UNITS[number];
export type USLiquidUnit = typeof US_LIQUID_UNITS[number];

// Canonical metadata is descriptive, not clinical authorization.
// Existing generator restrictions and meal nutrition remain unchanged.

export type IngredientResolution<T> =
  | { status: "resolved"; value: T }
  | {
      status: "unresolved" | "ambiguous";
      value: null;
      reasonCode: string;
    };

export interface IngredientEvidenceReference {
  sourceKind: "user_input" | "model_output" | "reviewed_registry" | "verified_source";
  sourceId: string | null;
  sourceVersion: string | null;
  retrievedAt: string | null;
}

export interface IngredientIdentity {
  ingredientKey: string;
  registry: string;
  registryVersion: string;
  evidenceRefs: readonly IngredientEvidenceReference[];
}

export interface IngredientOriginalInput {
  text: string | null;
  name: string | null;
  amount: string | number | null;
  unit: string | null;
  preparationNote: string | null;
  languageTag: string | null;
}

export interface IngredientFoodForm {
  cookingState: IngredientResolution<"raw" | "cooked">;
  preservation: IngredientResolution<"fresh" | "frozen" | "dried" | "canned">;
  drainingState: IngredientResolution<"drained" | "undrained">;
  physicalForm: IngredientResolution<string>;
  eggPart: IngredientResolution<"whole" | "white" | "yolk">;
  eggSize: IngredientResolution<"small" | "medium" | "large" | "extra_large" | "jumbo">;
}

export interface IngredientCompositionQualifiers {
  fatLevel: IngredientResolution<"fat_free" | "low_fat" | "reduced_fat" | "full_fat">;
  sourceSpecies: IngredientResolution<string>;
  productFormulation: IngredientResolution<"single_ingredient" | "compound" | "substitute" | "replacer">;
  productRef: IngredientEvidenceReference | null;
  evidenceRefs: readonly IngredientEvidenceReference[];
}

export interface IngredientQuantity {
  // Future runtime validation must require finite, positive quantities.
  value: number;
  originalExpression: string;
}

// Representational codes only; existing validators determine permission.
export type IngredientCanonicalUnit =
  | { dimension: "mass"; code: "mg" | "g" | "kg" | "oz" | "lb" }
  | { dimension: "volume"; code: "ml" | "l" | "tsp" | "tbsp" | "cup" | "fl_oz" }
  | { dimension: "count"; code: "each" | "clove" | "slice" | "scoop" };

export interface IngredientConversionEvidence {
  method: "exact_dimensional" | "ingredient_specific_portion";
  inputQuantity: IngredientQuantity;
  inputUnit: IngredientCanonicalUnit;
  outputQuantity: IngredientQuantity;
  outputUnit: IngredientCanonicalUnit;
  evidenceRefs: readonly IngredientEvidenceReference[];
}

export interface IngredientNutritionEvidence {
  basis: "per_100g" | "per_ingredient_amount";
  nutrients: {
    caloriesKcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    dietaryFiberG: number | null;
    sodiumMg: number | null;
    starchyCarbsG: number | null;
    fibrousCarbsG: number | null;
  };
  evidenceRefs: readonly IngredientEvidenceReference[];
  // Claimed assurance must be validated at a trusted server boundary.
  assurance: "estimate" | "source_backed";
  // Completeness is relative to the consuming workflow's required nutrients.
  completeness: "complete" | "partial";
}

export interface IngredientLocalizedPresentation {
  labelsByLanguageTag: Readonly<Record<string, string>>;
}

export interface IngredientCanonicalV1 {
  version: 1;
  originalInput: IngredientOriginalInput;
  identity: IngredientResolution<IngredientIdentity>;
  foodForm: IngredientFoodForm;
  compositionQualifiers: IngredientCompositionQualifiers;
  quantity: IngredientResolution<IngredientQuantity>;
  canonicalUnit: IngredientResolution<IngredientCanonicalUnit>;
  quantityScope: "recipe_total" | "per_serving" | "unknown";
  conversionEvidence: IngredientConversionEvidence | null;
  nutritionEvidence: IngredientNutritionEvidence | null;
  presentation?: IngredientLocalizedPresentation;
}

/**
 * Unified Ingredient interface - the ONLY format for ingredient data.
 * 
 * Rules:
 * - amount: numeric string like "6", "1/2", "2"
 * - unit: ONLY oz, lb, cup, tbsp, tsp, each (for eggs only), fl oz
 * - NO grams/ml/pieces for proteins (use oz/lb)
 * - Meal macros remain authoritative under the existing contract.
 * - Optional canonical evidence is descriptive and does not replace meal nutrition.
 */
export interface Ingredient {
  canonical?: IngredientCanonicalV1;
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
  canonical?: IngredientCanonicalV1;
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
