// Minimal client wrapper for the Meal Engine

export type Ingredient = { item: string; amount: number; unit: string; notes?: string };
export type Meal = {
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

/** Single meal generator (Craving / Fridge Rescue / Potluck) */
export function generateSingleMeal(req: GenerateSingleMealReq) {
  return postJSON<Meal>("/meal-engine/generate", req);
}

/** Weekly Plan Response Type */
export type PlanResponse = {
  plan: Meal[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
};

/** Weekly meal plan generator */
export function generateWeeklyPlan(req: GenerateSingleMealReq): Promise<PlanResponse> {
  // Use working fallback endpoint
  return postJSON<PlanResponse>("/meal-engine/weekly", req);
}

/** Optional helpers if/when you wire them */
export function generateFridgeRescue(req: Omit<GenerateSingleMealReq, "source"> & { fridgeItems: string[] }) {
  return postJSON<Meal>("/meal-engine/generate", { ...req, source: "fridge-rescue" });
}
export function generatePotluckMeal(req: Omit<GenerateSingleMealReq, "source"> & { potluckServings: number }) {
  return postJSON<Meal>("/meal-engine/potluck", { ...req, source: "potluck" });
}

/** Replace existing meal with brand new recipe */
export function replaceMeal(userId: string, mealId: string, dietPreference?: string, mealType?: string): Promise<Meal> {
  return postJSON<Meal>("/meal-engine/replace", { 
    userId, 
    mealId, 
    dietPreference, 
    mealType 
  });
}