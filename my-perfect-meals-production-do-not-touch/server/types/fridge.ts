// 🔒 LOCKED: Fridge Rescue Type Definitions - DO NOT MODIFY
// These types support the working deterministic engine perfectly
// User confirmed system is working - any changes will break compatibility
export type DietFlag =
  | 'low_glycemic'
  | 'diary_free' // kept for backward typo-compat if exists
  | 'dairy_free'
  | 'gluten_free'
  | 'shellfish_allergy'
  | 'vegetarian'
  | 'vegan';

export interface GenerateFridgeMealsRequest {
  items: string[];            // freeform list from user
  servings?: number;          // default 2
  dietFlags?: DietFlag[];     // optional constraints
}

export interface MealIngredient {
  name: string;         // e.g., "chicken breast"
  amount: string;       // e.g., "300 g" or "2 cups"
  category: 'protein' | 'veg' | 'carb' | 'fat' | 'aroma' | 'condiment' | 'other';
}

export interface MealNutritionEstimate {
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
}

export interface Meal {
  id: string;          // stable templateId + picked ingredients hash
  title: string;
  summary: string;
  servings: number;
  ingredients: MealIngredient[];
  instructions: string[];    // step-by-step, specific
  tags: string[];             // e.g. ["30-min", "one-pan"]
  nutrition: MealNutritionEstimate;
  safetyBadges?: string[];    // surface your medical badges here if desired
  templateRef: string;        // internal ref
}

export interface SlotCandidate {
  tag: string;      // canonical tag, e.g., 'chicken'
  label: string;    // human friendly, e.g., 'chicken breast'
}

export interface Pantry {
  proteins: SlotCandidate[];
  vegs: SlotCandidate[];
  carbs: SlotCandidate[];
  fats: SlotCandidate[];
  aromas: SlotCandidate[];   // onions, garlic, herbs
  condiments: string[];      // sauces, salsa, soy
  allTags: Set<string>;      // for quick lookup
}