// =====================================================================
// HYBRID MEAL ENGINE - SHARED TYPES
// =====================================================================

import { CookingMethodId } from "./techniques.catalog";

export interface MealTemplate {
  id: string;
  name: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  category: "egg-based" | "all-protein" | "protein-carb" | "protein-fiber" | "protein-fat" | "lean-plates" | "balanced" | "comfort";
  ingredients: {
    ingredientId: string;
    grams: number;
  }[];
  defaultCookingMethods?: {
    [ingredientId: string]: CookingMethodId;
  };
  imageKey: string;
  tags: string[];
  dietProfileIds?: string[];
  baseInstructions?: string;
}

export interface MealVariant {
  id: string;
  baseTemplateId: string;
  userId?: string | null;
  source: "catalog" | "user_custom" | "ai_assisted";
  ingredients: {
    ingredientId: string;
    techniqueId?: CookingMethodId;
    quantity: number;
    unit: string;
  }[];
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
  instructions: string;
  imageUrl: string;
  mealSignatureHash: string;
  createdAt: string;
}
