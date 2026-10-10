import {
  lookupUsdaIngredient, type IngredientComposition,
} from "./productDiscovery/usdaIngredientAdapter";

export const DESSERT_NUTRIENTS = ["calories", "protein", "carbs", "fat", "starchyCarbs"] as const;
type Nutrient = typeof DESSERT_NUTRIENTS[number];
type Nutrition = Record<Nutrient, number>;
export interface DessertIngredient {
  name: string;
  amount: string;
  unit: string;
}
export interface IngredientNutritionEstimate {
  ingredientIndex: number;
  amount: string;
  unit: string;
  grams: number;
  nutrition: Nutrition;
  provenance?: {
    source: "USDA FoodData Central";
    fdcId: number;
    description: string;
    dataType: string;
    retrievedAt: string;
    basis: "per_100g";
    conversion: string;
    carbSource: IngredientComposition["carbSource"];
  };
}

export class DessertNutritionError extends Error {
  readonly status = 422;
  readonly code = "DESSERT_NUTRITION_UNVERIFIED";
  constructor(readonly fields: string[]) {
    super("Dessert nutrition could not be verified from the ingredient quantities.");
  }
}

/** Diagnostic field names only: no recipe, profile, or ingredient logging. */
export function dessertNutritionDiscrepancies(candidate: any, servings: number): string[] {
  const fields: string[] = [];
  if (candidate?.servings !== servings) fields.push("servings");
  for (const key of DESSERT_NUTRIENTS) {
    const total = candidate?.nutrition?.[key];
    const portion = candidate?.perServingNutrition?.[key];
    if (typeof total !== "number" || !Number.isFinite(total)) fields.push(`nutrition.${key}`);
    if (typeof portion !== "number" || !Number.isFinite(portion)) fields.push(`perServingNutrition.${key}`);
    if (typeof total === "number" && Number.isFinite(total) &&
        typeof portion === "number" && Number.isFinite(portion) &&
        Math.abs(total - portion * servings) > 1) fields.push(`scaling.${key}`);
  }
  return fields;
}

export function dessertQuantity(value: string): number | null {
  const fractions: Record<string, string> = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3" };
  const text = value.replace(/[½¼¾⅓⅔]/g, character => ` ${fractions[character]}`).trim();
  const match = /^(?:(\d+)\s+)?(\d+)\/(\d+)$/.exec(text);
  const amount = match ? Number(match[1] ?? 0) + Number(match[2]) / Number(match[3])
    : /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}
const unitName = (value: string) => value.trim().toLowerCase()
  .replace(/^grams?$/, "g").replace(/^kilograms?$/, "kg")
  .replace(/^ounces?$/, "oz").replace(/^pounds?$/, "lb")
  .replace(/^teaspoons?$/, "tsp").replace(/^tablespoons?$/, "tbsp")
  .replace(/^cups$/, "cup").replace(/^millilit(?:er|re)s?$/, "ml")
  .replace(/^lit(?:er|re)s?$/, "l");
export function dessertIngredientGrams(row: DessertIngredient, source: IngredientComposition): { grams: number; conversion: string } | null {
  const amount = dessertQuantity(row.amount);
  if (amount === null) return null;
  const unit = unitName(row.unit);
  const mass: Record<string, number> = { g: 1, kg: 1000, mg: 0.001, oz: 28.349523125, lb: 453.59237 };
  if (mass[unit]) return { grams: amount * mass[unit], conversion: `Exact mass conversion: ${unit} to g` };
  const volume: Record<string, number> = { tsp: 1, tbsp: 3, cup: 48, ml: 1 / 4.92892159375, l: 1000 / 4.92892159375, "fl oz": 6 };
  const matches = source.portions.flatMap(portion => {
    const text = portion.measure.toLowerCase().trim();
    // Never use "cup whole", "cup sliced", etc. for ground flour.
    const measure = unitName(text);
    let compatible = measure === unit;
    if (source.portionForm) {
      if (source.portionForm === "large" && ["whole", "unit", "piece", "pieces", "large", ""].includes(unit)) {
        compatible = text === "large";
      } else {
        const formMatch = new RegExp(`^(cup|tsp|tbsp)(?:,?\\s+)${source.portionForm}$`).exec(text);
        if (formMatch && volume[unit]) return [{
          grams: amount * volume[unit] / volume[formMatch[1]] * portion.grams / portion.amount,
          conversion: `USDA portion: ${portion.amount} ${portion.measure} = ${portion.grams} g`,
          exact: formMatch[1] === unit,
        }];
        if (/^(cup|tsp|tbsp)[, ]/.test(text)) return [];
      }
    }
    if (compatible) return [{ grams: amount * portion.grams / portion.amount,
      conversion: `USDA portion: ${portion.amount} ${portion.measure} = ${portion.grams} g`, exact: true }];
    if (volume[measure] && volume[unit]) return [{
      grams: amount * volume[unit] / volume[measure] * portion.grams / portion.amount,
      conversion: `USDA ingredient-specific portion: ${portion.amount} ${portion.measure} = ${portion.grams} g`, exact: false,
    }];
    return [];
  }).sort((a, b) => Number(b.exact) - Number(a.exact));
  const selected = matches[0];
  return selected && Number.isFinite(selected.grams) && selected.grams > 0 ? selected : null;
}
/** No AI calls, skipped ingredients, invented density, or unknown-to-zero fallback. */
export async function estimateDessertIngredientNutrition(
  ingredients: DessertIngredient[],
  lookup: (name: string) => Promise<IngredientComposition | null> = lookupUsdaIngredient,
): Promise<IngredientNutritionEstimate[]> {
  if (ingredients.length > 40) throw new DessertNutritionError(["ingredient_sources.coverage_limit"]);
  const sourceDeadline = Date.now() + 30000;
  const entries: IngredientNutritionEstimate[] = [];
  for (const [ingredientIndex, row] of ingredients.entries()) {
    if (Date.now() > sourceDeadline) throw new DessertNutritionError(["ingredient_sources.time_budget"]);
    let source: IngredientComposition | null;
    try { source = await lookup(row.name); }
    catch { throw new DessertNutritionError([`ingredient_sources.${ingredientIndex}.unavailable`]); }
    if (!source) throw new DessertNutritionError([`ingredient_sources.${ingredientIndex}.identity`]);
    const conversion = dessertIngredientGrams(row, source);
    if (!conversion) throw new DessertNutritionError([`ingredient_sources.${ingredientIndex}.quantity`]);
    const nutrition = {} as Nutrition;
    for (const key of ["calories", "protein", "carbs", "fat"] as const) {
      const value = source.macrosPer100g[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new DessertNutritionError([`ingredient_sources.${ingredientIndex}.${key}`]);
      }
      nutrition[key] = value * conversion.grams / 100;
    }
    if (source.carbSource === "unknown" && nutrition.carbs !== 0) {
      throw new DessertNutritionError([`ingredient_sources.${ingredientIndex}.carb_source`]);
    }
    // Zero is established non-starchy food identity, never a missing nutrient fallback.
    nutrition.starchyCarbs = source.carbSource === "starchy" ? nutrition.carbs : 0;
    entries.push({
      ingredientIndex, amount: row.amount, unit: row.unit, grams: conversion.grams, nutrition,
      provenance: { source: "USDA FoodData Central", fdcId: source.fdcId,
        description: source.description, dataType: source.dataType, retrievedAt: source.retrievedAt,
        basis: "per_100g", conversion: conversion.conversion, carbSource: source.carbSource },
    });
  }
  return entries;
}

export async function prepareDessertNutrition<T extends Record<string, any>>(
  candidate: T,
  servings: number,
  estimate: (ingredients: DessertIngredient[]) => Promise<IngredientNutritionEstimate[]>,
): Promise<T & { servings: number; nutrition: Nutrition; perServingNutrition: Nutrition }> {
  if (!Number.isInteger(servings) || servings < 1) throw new DessertNutritionError(["requested_servings"]);
  // A returned contradictory yield cannot be fixed by relabeling the same recipe.
  if (candidate.servings != null && candidate.servings !== servings) {
    throw new DessertNutritionError(["servings"]);
  }
  if (!Array.isArray(candidate.ingredients) || candidate.ingredients.length === 0) {
    throw new DessertNutritionError(["ingredients"]);
  }
  const ingredients: DessertIngredient[] = candidate.ingredients.map((row: any, index: number) => {
    const name = row?.name ?? row?.item;
    const amount = row?.amount;
    if (typeof name !== "string" || !name.trim() ||
        !["string", "number"].includes(typeof amount) || !String(amount).trim()) {
      throw new DessertNutritionError([`ingredients.${index}.quantity`]);
    }
    return { name, amount: String(amount), unit: String(row.unit ?? "") };
  });
  const estimates = await estimate(ingredients);
  if (!Array.isArray(estimates) || estimates.length !== ingredients.length) {
    throw new DessertNutritionError(["ingredient_estimates.coverage"]);
  }
  const totals: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0 };
  const seen = new Set<number>();
  for (const entry of estimates) {
    if (!entry || !Number.isInteger(entry.ingredientIndex) || entry.ingredientIndex < 0) {
      throw new DessertNutritionError(["ingredient_estimates.index"]);
    }
    const row = ingredients[entry?.ingredientIndex];
    if (!row || seen.has(entry.ingredientIndex) ||
        row.amount !== entry.amount || row.unit !== entry.unit ||
        typeof entry.grams !== "number" || !Number.isFinite(entry.grams) || entry.grams <= 0) {
      throw new DessertNutritionError(["ingredient_estimates.quantity"]);
    }
    seen.add(entry.ingredientIndex);
    for (const key of DESSERT_NUTRIENTS) {
      const value = entry.nutrition?.[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new DessertNutritionError([`ingredient_estimates.${entry.ingredientIndex}.${key}`]);
      }
      totals[key] += value;
    }
    if (entry.nutrition.starchyCarbs > entry.nutrition.carbs) {
      throw new DessertNutritionError(["ingredient_estimates.starchyCarbs"]);
    }
  }
  if (!DESSERT_NUTRIENTS.every((key) => Number.isFinite(totals[key]))) {
    throw new DessertNutritionError(["ingredient_estimates.total"]);
  }
  const perServingNutrition = Object.fromEntries(
    DESSERT_NUTRIENTS.map((key) => [key, totals[key] / servings]),
  ) as Nutrition;
  return { ...candidate, servings, nutrition: totals, perServingNutrition,
    nutritionProvenance: estimates.map(entry => ({
      ingredientIndex: entry.ingredientIndex, amount: entry.amount, unit: entry.unit, grams: entry.grams,
      ...entry.provenance,
    })),
    recipeIngredientQuantities: ingredients,
  };
}
