export interface MealSlot {
  day: string;
  time: string;
  label: string;
  mealType: "meal" | "snack";
  name: string;
  description: string;
  ingredients: string[];
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface MealPlan {
  id?: string;
  title: string;
  dietOverride?: string;
  durationDays: number;
  mealsPerDay: number;
  snacksPerDay: number;
  selectedIngredients: string[];
  schedule: { name: string; time: string }[];
  slots: MealSlot[];
  status: "accepted" | "archived";
  createdAt?: string;
}

export type InsertMealPlan = Omit<MealPlan, "id" | "createdAt">;