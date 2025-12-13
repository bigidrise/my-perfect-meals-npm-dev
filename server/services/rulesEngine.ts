// services/rulesEngine.ts
type MealType = "breakfast"|"lunch"|"dinner"|"snack";
type Difficulty = "easy"|"medium"|"hard";
type Template = {
  id: string; slug: string; name: string; type: MealType;
  calories: number; protein: number; carbs: number; fat: number; fiber?: number;
  vegetables?: number; dietTags: string[]; badges: string[]; allergens: string[];
  ingredients: { name: string; amount: number; unit: string; role?: string }[];
  steps: string[]; prepTime?: number; cookTime?: number; servings?: number;
  imageUrl?: string; description?: string; cuisine?: string; difficulty?: Difficulty;
};

export type PlanParams = {
  weeks: number; mealsPerDay: number; snacksPerDay: number;
  targets: { calories: number; protein: number; carbs?: number; fats?: number };
  diet?: string; medicalFlags?: string[];
  userAllergens?: string[];
  vegOptOut?: boolean; // "no vegetables" toggle
  dislikes?: string[]; // disliked foods
};

export type HardRules = {
  maxUniqueIngredientsPerWeek: number;  // ≤ 25
  minVegCupsPerMainMeal: number;        // ≥ 2
  maxExoticPerWeek: number;             // ≤ 3 (you define list)
  minUniquePerType: Record<MealType, number>;
  maxRepeatsPerWeek: number;
  minDistinctCuisinesPerWeek: number;
  proteinPerMainMeal: { min: number; max: number };
  calorieDailyTolerancePct: number;     // ±10%
  carbPctRange: { min: number; max: number }; // 45–65%
  giLowBadge?: string;                   // "diabetes-friendly" (badge)
  maxCookMinutesPerMeal: number;         // ≤ 45
  maxIngredientsPerRecipe: number;       // ≤ 8
  minEasyPerDay: number;                 // ≥ 1
  exoticList?: string[];                 // define in config
};

export const defaultRules: HardRules = {
  maxUniqueIngredientsPerWeek: 25,
  minVegCupsPerMainMeal: 2,
  maxExoticPerWeek: 3,
  minUniquePerType: { breakfast: 3, lunch: 3, dinner: 3, snack: 0 },
  maxRepeatsPerWeek: 2,
  minDistinctCuisinesPerWeek: 3,
  proteinPerMainMeal: { min: 30, max: 40 },
  calorieDailyTolerancePct: 0.10,
  carbPctRange: { min: 0.45, max: 0.65 },
  giLowBadge: "diabetes-friendly",
  maxCookMinutesPerMeal: 45,
  maxIngredientsPerRecipe: 8,
  minEasyPerDay: 1,
  exoticList: ["saffron", "black garlic", "sumac", "yuzu", "asafoetida"],
};

export function rejectReason(t: any, params: PlanParams, rules=defaultRules): string | null {
  // normalize
  const type = String(t.type || "").toLowerCase(); // "breakfast"|"lunch"|"dinner"|"snack"
  const prep = Number(t.prepTime ?? 0), cook = Number(t.cookTime ?? 0);
  const total = prep + cook;
  const veggies = Number(t.vegetables ?? 0);
  const ingCount = (t.ingredients ?? []).length;
  const calories = Number(t.calories ?? 0);
  const carbs = (typeof t.carbs === "number") ? t.carbs : null;

  // 0) Hard safety
  if (params.userAllergens?.some(a => (t.allergens ?? []).includes(a))) return "allergen";
  if (params.medicalFlags?.includes("diabetes") && !t.badges?.includes(rules.giLowBadge!)) return "missing-diabetes-badge";
  
  // 0.5) Dislikes filter - hard reject if any ingredient is disliked
  if (params.dislikes?.length) {
    const ingredientNames = (t.ingredients ?? []).map(i => i.name.toLowerCase());
    if (params.dislikes.some(dislike => ingredientNames.includes(dislike.toLowerCase()))) {
      return "contains-disliked-ingredient";
    }
  }

  // 1) Per-recipe simplicity caps
  if (ingCount > rules.maxIngredientsPerRecipe) return "too-many-ingredients";
  if (total > rules.maxCookMinutesPerMeal) return "too-long-to-cook";

  // 2) Mains-only nutrition (do NOT apply to breakfast/snack)
  if (type === "lunch" || type === "dinner") {
    if (typeof t.protein !== "number") return "missing-protein";
    if (t.protein < rules.proteinPerMainMeal.min || t.protein > rules.proteinPerMainMeal.max) return "protein-out-of-range";
    // Only enforce vegetable requirement if user hasn't opted out
    if (!params.vegOptOut && veggies < rules.minVegCupsPerMainMeal) return "not-enough-veg";
  }

  // 3) Carb % sanity (skip if calories or carbs missing/small)
  if (calories >= 120 && carbs !== null) {
    const carbPct = (carbs * 4) / calories;
    if (carbPct < rules.carbPctRange.min || carbPct > rules.carbPctRange.max) return "carb-percent-out-of-range";
  }

  return null;
}

export function fitsBaseSafety(t: any, params: PlanParams, rules=defaultRules) {
  return rejectReason(t, params, rules) === null;
}

export function scoreTemplateForUser(t: Template, params: PlanParams) {
  // Simple scoring to break ties: prefer diet match, fewer ingredients, shorter time
  let score = 0;
  if (params.diet && t.dietTags.includes(params.diet)) score += 2;
  score += Math.max(0, 8 - t.ingredients.length) * 0.1;
  const totalCook = (t.prepTime ?? 0) + (t.cookTime ?? 0);
  score += Math.max(0, 45 - totalCook) * 0.02;
  return score;
}

export function enforceWeeklyCaps(week: Template[][], rules=defaultRules) {
  // week = [days][meals in a day]; collect unique ingredients & exotic count
  const uniq = new Set<string>();
  let exoticCount = 0;
  for (const day of week) {
    for (const meal of day) {
      for (const ing of meal.ingredients) {
        if (!ing.name || typeof ing.name !== 'string') continue;
        const key = ing.name.trim().toLowerCase();
        if (!uniq.has(key)) {
          uniq.add(key);
          if (rules.exoticList!.includes(key)) exoticCount++;
        }
      }
    }
  }
  return {
    uniqueIngredientCount: uniq.size,
    exoticCount,
    withinCaps:
      uniq.size <= rules.maxUniqueIngredientsPerWeek &&
      exoticCount <= rules.maxExoticPerWeek,
  };
}

export function meetsVariety(week: Template[][], rules=defaultRules) {
  // Count per type and cuisines and repeats
  const byType = { breakfast: new Set<string>(), lunch: new Set<string>(), dinner: new Set<string>(), snack: new Set<string>() };
  const cuisines = new Set<string>();
  const seen = new Map<string, number>();
  for (const day of week) {
    for (const meal of day) {
      byType[meal.type].add(meal.slug);
      if (meal.cuisine) cuisines.add(meal.cuisine);
      seen.set(meal.slug, (seen.get(meal.slug) ?? 0) + 1);
    }
  }
  const repeats = [...seen.values()].filter(n => n > 1).reduce((a,b)=>a+(b-1),0);
  const typeOk = (Object.keys(byType) as MealType[]).every(
    mt => byType[mt].size >= rules.minUniquePerType[mt]
  );
  return {
    repeats,
    cuisines: cuisines.size,
    ok:
      typeOk &&
      repeats <= rules.maxRepeatsPerWeek &&
      cuisines.size >= rules.minDistinctCuisinesPerWeek,
  };
}