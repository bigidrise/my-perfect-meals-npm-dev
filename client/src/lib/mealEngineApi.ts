// Minimal client wrapper for the Meal Engine

export type { Ingredient } from "@/types/meal";
import type { Ingredient } from "@/types/meal";

/**
 * EngineMeal — the raw shape returned by the Meal Engine API.
 * Nutrition fields use the `_g` suffix (protein_g / carbs_g / fat_g).
 * Do NOT use this type for board / UI-layer components; import Meal from
 * "@/types/meal" instead (which uses protein / carbs / fat without suffix).
 */
export type EngineMeal = {
  id: string;
  name: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: string[];
  nutrition: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g?: number; sugar_g?: number };
  servings: number;
  prepTime?: number; // in minutes
  imageUrl?: string | null;
  source: "craving" | "weekly" | "potluck" | "fridge-rescue";
  compliance: { allergiesCleared: boolean; medicalCleared: boolean; unitsStandardized: boolean };
};

type GenerateSingleMealReq = {
  userId: string;
  source: "craving" | "fridge-rescue" | "potluck";
  selectedIngredients?: string[];
  tempDietOverride?: string;
  tempDietPreference?: string;
  tempMedicalOverride?: string;
  servings?: number;
  fridgeItems?: string[];
  potluckServings?: number;
  generateImages?: boolean;
};

const API = (path: string) => `/api${path}`;

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = "Request failed";
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/** Weekly Plan Response Type */
export type PlanResponse = {
  plan: EngineMeal[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
};

/** Single meal generator (Craving / Fridge Rescue / Potluck) */
export function generateSingleMeal(req: GenerateSingleMealReq) {
  return postJSON<EngineMeal>("/meal-engine/generate", req);
}

/** Weekly meal plan generator */
export function generateWeeklyPlan(req: GenerateSingleMealReq): Promise<PlanResponse> {
  // Use working fallback endpoint
  return postJSON<PlanResponse>("/meal-engine/weekly", req);
}

/** Optional helpers if/when you wire them */
export function generateFridgeRescue(req: Omit<GenerateSingleMealReq, "source"> & { fridgeItems: string[] }) {
  return postJSON<EngineMeal>("/meal-engine/generate", { ...req, source: "fridge-rescue" });
}
export function generatePotluckMeal(req: Omit<GenerateSingleMealReq, "source"> & { potluckServings: number }) {
  return postJSON<EngineMeal>("/meal-engine/potluck", { ...req, source: "potluck" });
}

/** Replace existing meal with brand new recipe */
export function replaceMeal(userId: string, mealId: string, dietPreference?: string, mealType?: string): Promise<EngineMeal> {
  return postJSON<EngineMeal>("/meal-engine/replace", {
    userId,
    mealId,
    dietPreference,
    mealType,
  });
}