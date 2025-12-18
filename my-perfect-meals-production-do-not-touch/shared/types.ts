// shared/types.ts

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
