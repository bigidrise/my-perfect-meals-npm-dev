// Shared data models for Template-First Meal Planning System

export interface Ingredient {
  name: string;
  quantity: number;
  unit?: string;
  role?: IngredientRole; // For scaling and swapping logic
}

export type IngredientRole = 
  | "protein"   // Primary protein source
  | "carb"      // Starchy carbs (rice, pasta, bread)
  | "veg"       // Vegetables  
  | "fat"       // Added fats (oils, nuts)
  | "spice"     // Seasonings, herbs
  | "sauce"     // Condiments, dressings
  | "other";    // Everything else

export type GoalTag = "loss" | "maintenance" | "gain";

export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type MealArchetype = 
  | "HP/LC"      // High Protein / Low Carb
  | "HP/HC"      // High Protein / High Carb  
  | "Balanced"   // Balanced macros
  | "Diabetic"   // Diabetic-friendly
  | "Vegetarian" // Vegetarian
  | "Vegan"      // Vegan
  | "Paleo"      // Paleo
  | "Mediterranean" // Mediterranean
  | "Other";     // Other/Custom

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type MealSource = "template" | "preset" | "craving" | "fridge" | "kids";

export type RoundingMode = "tenth" | "half" | "whole";

export interface MealTemplateBase {
  id: string;
  name: string;
  goalTag?: GoalTag; // AI picks templates based on user's goal
  archetype: MealArchetype;
  mealType: MealType;
  image?: string;
  summary?: string;
  baseServings: number; // Usually 1
  ingredients: Ingredient[]; // Base quantities for baseServings with roles
  instructions: string[];
  nutritionPerServing?: NutritionInfo;
  badges?: string[]; // Medical/safety labels
  source: MealSource;
  cuisines?: string[]; // For filtering (e.g., ["Indian", "Mexican"])
  allergens?: string[]; // For medical safety
  version?: number; // For content versioning
}

// Utility type for scaled templates (computed, not stored)
export interface ScaledMealTemplate extends Omit<MealTemplateBase, 'ingredients' | 'nutritionPerServing'> {
  ingredients: Ingredient[]; // Scaled ingredients
  currentServings: number;
  nutritionTotal?: NutritionInfo; // Total nutrition for currentServings
  nutritionPerServing?: NutritionInfo; // Original per-serving nutrition
}

// Filter options for Template Hub
export interface TemplateFilters {
  archetype?: MealArchetype;
  mealType?: MealType;
  search?: string;
  servings: number;
  rounding: RoundingMode;
}

// Universal card action types
export interface CardActions {
  onLogMacros?: (nutrition: NutritionInfo, servings: number) => void;
  onReplace?: (currentMeal: MealTemplateBase) => void;
  onAddFromCraving?: () => void;
}

// Replace picker source tabs
export type ReplaceSource = "templates" | "presets" | "craving" | "fridge" | "kids";

export interface ReplacePickerOptions {
  currentMeal: MealTemplateBase;
  currentServings: number;
  availableSources: ReplaceSource[];
  onReplace: (newMeal: MealTemplateBase) => void;
  onCancel: () => void;
}