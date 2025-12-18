// Normalizes any meal object into the biometrics logging contract
export type BiometricsLog = {
  date_iso: string;
  meal_type: "breakfast"|"lunch"|"dinner"|"snack";
  calories_kcal: number; protein_g: number; carbs_g: number; fat_g: number;
  source: string; title?: string; meal_id?: string;
};

function toNum(v: any): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export function normalizeMealToMacros(meal: any, opts?: { defaultMealType?: BiometricsLog["meal_type"]; source?: string }): BiometricsLog {
  const n = meal?.nutrition ?? {};
  const calories = toNum(n.calories ?? meal.calories);
  const protein  = toNum(n.protein  ?? n.protein_g ?? meal.protein);
  const carbs    = toNum(n.carbs    ?? n.carbohydrates ?? meal.carbs);
  const fat      = toNum(n.fat      ?? n.fats ?? meal.fat);

  const mealType = (meal?.mealType?.toLowerCase() as BiometricsLog["meal_type"]) ?? (opts?.defaultMealType ?? "lunch");
  return {
    date_iso: new Date().toISOString(),
    meal_type: ["breakfast","lunch","dinner","snack"].includes(mealType) ? mealType : "lunch",
    calories_kcal: calories, protein_g: protein, carbs_g: carbs, fat_g: fat,
    source: opts?.source ?? "craving_creator",
    title: meal?.name ?? "Meal",
    meal_id: meal?.id
  };
}