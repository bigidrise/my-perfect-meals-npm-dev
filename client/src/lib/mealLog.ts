import { apiRequest } from "@/lib/queryClient";
import { getTodayISOSafe } from "@/utils/midnight";

interface MealLogInput {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source?: string;
  mealSlot?: "breakfast" | "lunch" | "dinner" | "snack";
}

export async function addMealToLog(meal: MealLogInput): Promise<void> {
  const userId = localStorage.getItem("userId") || "1";
  const today = getTodayISOSafe();
  
  const slot = meal.mealSlot || inferMealSlot();
  
  await apiRequest("/api/meal-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      date: today,
      mealSlot: slot,
      source: meal.source || "manual",
      customName: meal.name,
      calories: String(meal.calories || 0),
      protein: String(meal.protein || 0),
      carbs: String(meal.carbs || 0),
      fat: String(meal.fat || 0),
    }),
  });
}

function inferMealSlot(): "breakfast" | "lunch" | "dinner" | "snack" {
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  if (hour < 14) return "lunch";
  if (hour < 20) return "dinner";
  return "snack";
}
