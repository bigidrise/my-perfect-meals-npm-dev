import { MacroLogInput } from "../../../shared/types";
import { localYYYYMMDD } from "./dates";
import { INGREDIENT_MACROS } from "@/data/ingredients.nutrition";

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function kcal(p: number, c: number, f: number) {
  return p * 4 + c * 4 + f * 9;
}

export function percentBreakdown(p: number, c: number, f: number) {
  const calories = kcal(p, c, f);
  if (calories <= 0) return { p: 0, c: 0, f: 0, calories: 0 };
  return {
    p: Math.round(((p * 4) / calories) * 100),
    c: Math.round(((c * 4) / calories) * 100),
    f: Math.round(((f * 9) / calories) * 100),
    calories,
  };
}

export function buildMacroLogEntryFromMeal(
  meal: {
    id?: string;
    name: string;
    nutrition: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  },
  servings = 1,
  source: MacroLogInput["source"] = "ai_meal_creator",
): MacroLogInput {
  const s = Math.max(0.25, servings || 1);
  const loggedAtISO = new Date().toISOString();
  const day = localYYYYMMDD(new Date());
  const idem = meal.id ? `${meal.id}:${day}` : undefined;

  return {
    mealId: meal.id,
    mealName: meal.name,
    source,
    servings: s,
    macros: {
      calories: Math.round(meal.nutrition.calories * s),
      protein: round1(meal.nutrition.protein * s),
      carbs: round1(meal.nutrition.carbs * s),
      fat: round1(meal.nutrition.fat * s),
    },
    loggedAtISO,
    idempotencyKey: idem,
  };
}

// New utilities for ingredient swaps and nutrition calculation
export function gramsOrUnitsTo100gFactor(
  name: string,
  quantity: number,
  unit?: string,
) {
  const entry = INGREDIENT_MACROS[name];
  if (!entry) return 0;
  if (entry.unit === "unit" && entry.unitSize && unit === "unit") {
    return (entry.unitSize * quantity) / 100; // units → 100g factor
  }
  // default assume grams/ml
  return quantity / 100;
}

export function macrosForIngredient(
  name: string,
  quantity: number,
  unit?: string,
) {
  const entry = INGREDIENT_MACROS[name];
  if (!entry) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const factor = gramsOrUnitsTo100gFactor(name, quantity, unit);
  return {
    calories: +(entry.calories * factor).toFixed(1),
    protein: +(entry.protein * factor).toFixed(1),
    carbs: +(entry.carbs * factor).toFixed(1),
    fat: +(entry.fat * factor).toFixed(1),
  };
}

export function sumMacros(
  items: { name: string; quantity: number; unit?: string }[],
) {
  return items.reduce(
    (acc, it) => {
      const m = macrosForIngredient(it.name, it.quantity, it.unit);
      acc.calories += m.calories;
      acc.protein += m.protein;
      acc.carbs += m.carbs;
      acc.fat += m.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// Utility to recalculate nutrition for a meal with ingredient swaps
export function recalculateNutritionWithSwaps(
  originalIngredients: { name: string; quantity: number; unit?: string }[],
  swaps: Record<string, string>, // old ingredient name -> new ingredient name
  servingsMultiplier: number = 1,
) {
  const modifiedIngredients = originalIngredients.map((ingredient) => ({
    ...ingredient,
    name: swaps[ingredient.name] || ingredient.name,
  }));

  const totalMacros = sumMacros(modifiedIngredients);

  return {
    calories: Math.round(totalMacros.calories * servingsMultiplier),
    protein: Math.round(totalMacros.protein * servingsMultiplier),
    carbs: Math.round(totalMacros.carbs * servingsMultiplier),
    fat: Math.round(totalMacros.fat * servingsMultiplier),
  };
}

// New utilities for macro summary display
export type MacroNumbers = { 
  protein?: number; 
  carbs?: number; 
  fat?: number; 
  calories?: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
};

export function calcCalories(m: MacroNumbers) {
  const p = Number(m.protein || 0), c = Number(m.carbs || 0), f = Number(m.fat || 0);
  const k = Number(m.calories || 0);
  return k > 0 ? Math.round(k) : Math.round(p * 4 + c * 4 + f * 9);
}

export function roundTotals(m: MacroNumbers) {
  return {
    protein: Math.round(Number(m.protein || 0)),
    carbs:   Math.round(Number(m.carbs   || 0)),
    fat:     Math.round(Number(m.fat     || 0)),
    calories: calcCalories(m),
  };
}

export function sumMacroNumbers(items: MacroNumbers[]) {
  const tot = items.reduce((a, x) => {
    const starchy = Number(x.starchyCarbs || 0);
    const fibrous = Number(x.fibrousCarbs || 0);
    const carbs = Number(x.carbs || 0) || (starchy + fibrous);
    return {
      protein: (a.protein || 0) + Number(x.protein || 0),
      carbs: (a.carbs || 0) + carbs,
      fat: (a.fat || 0) + Number(x.fat || 0),
      calories: (a.calories || 0) + Number(x.calories || 0),
      starchyCarbs: (a.starchyCarbs || 0) + starchy,
      fibrousCarbs: (a.fibrousCarbs || 0) + fibrous,
    };
  }, { protein: 0, carbs: 0, fat: 0, calories: 0, starchyCarbs: 0, fibrousCarbs: 0 } as MacroNumbers);
  return {
    ...roundTotals(tot),
    starchyCarbs: Math.round(tot.starchyCarbs || 0),
    fibrousCarbs: Math.round(tot.fibrousCarbs || 0),
  };
}

export function formatClipboard(m: {protein:number; carbs:number; fat:number; calories:number; starchyCarbs?: number; fibrousCarbs?: number}) {
  const hasStarchyFibrous = typeof m.starchyCarbs === "number" && typeof m.fibrousCarbs === "number" && (m.starchyCarbs > 0 || m.fibrousCarbs > 0);
  const carbLine = hasStarchyFibrous
    ? `Carbs: ${m.carbs} g (Starchy: ${m.starchyCarbs} g / Fibrous: ${m.fibrousCarbs} g)`
    : `Carbs: ${m.carbs} g`;
  return `Protein: ${m.protein} g\n${carbLine}\nFat: ${m.fat} g\nCalories: ${m.calories}`;
}
