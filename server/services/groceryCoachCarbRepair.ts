import { groceryCoachCarbBreakdown } from "@shared/groceryCoachCarbs";
import type { GroceryCoachCarbReview } from "@shared/groceryCoachCarbReview";
import { dessertIngredientGrams } from "./dessertNutrition";
import { lookupUsdaIngredient, type IngredientComposition } from "./productDiscovery/usdaIngredientAdapter";

type Category = "starchy" | "fibrous" | "other";
type Row = { item: string; quantity: string; unit: string };
type Recommendation = {
  macros: { carbs: number; starchyCarbs?: number | null; fibrousCarbs?: number | null; [key: string]: unknown };
  ownedIngredients?: Row[];
  shoppingList?: Row[];
  carbohydrateReview?: GroceryCoachCarbReview;
};
const norm = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
// Deliberately bounded identity mappings, not nutrient numbers. Unknown forms,
// mixed sauces, brands, and unspecified cooked/dry grains remain unresolved.
const GROUPS: Array<{ names: string[]; description: string; category: Category }> = [
  { names: ["broccoli", "raw broccoli", "broccoli florets"], description: "Broccoli, raw", category: "fibrous" },
  { names: ["spinach", "raw spinach"], description: "Spinach, raw", category: "fibrous" },
  { names: ["carrot", "carrots", "raw carrots"], description: "Carrots, raw", category: "fibrous" },
  { names: ["red bell pepper", "red bell peppers"], description: "Peppers, sweet, red, raw", category: "fibrous" },
  { names: ["green bell pepper", "green bell peppers"], description: "Peppers, sweet, green, raw", category: "fibrous" },
  { names: ["zucchini", "raw zucchini"], description: "Squash, summer, zucchini, includes skin, raw", category: "fibrous" },
  { names: ["cauliflower", "raw cauliflower", "raw cauliflower rice"], description: "Cauliflower, raw", category: "fibrous" },
  { names: ["asparagus", "raw asparagus"], description: "Asparagus, raw", category: "fibrous" },
  { names: ["onion", "onions", "raw onion"], description: "Onions, raw", category: "fibrous" },
  { names: ["garlic", "raw garlic"], description: "Garlic, raw", category: "fibrous" },
  { names: ["raw potato", "raw potatoes"], description: "Potatoes, flesh and skin, raw", category: "starchy" },
  { names: ["cooked brown rice"], description: "Rice, brown, long-grain, cooked", category: "starchy" },
  { names: ["dry brown rice", "uncooked brown rice"], description: "Rice, brown, long-grain, raw", category: "starchy" },
  { names: ["cooked white rice"], description: "Rice, white, long-grain, regular, enriched, cooked", category: "starchy" },
  { names: ["cooked spaghetti"], description: "Spaghetti, cooked, enriched, without added salt", category: "starchy" },
  { names: ["cooked lentils"], description: "Lentils, mature seeds, cooked, boiled, without salt", category: "starchy" },
  { names: ["sugar", "granulated sugar"], description: "Sugars, granulated", category: "starchy" },
  { names: ["honey"], description: "Honey", category: "starchy" },
  { names: ["firm tofu"], description: "Tofu, raw, firm, prepared with calcium sulfate", category: "other" },
  { names: ["olive oil", "extra virgin olive oil"], description: "Oil, olive, salad or cooking", category: "other" },
  { names: ["salt", "table salt"], description: "Salt, table", category: "other" },
  { names: ["lime juice", "fresh lime juice"], description: "Lime juice, raw", category: "other" },
  { names: ["lemon juice", "fresh lemon juice"], description: "Lemon juice, raw", category: "other" },
];

export type CarbLookup = (description: string) => Promise<IngredientComposition | null>;

/**
 * No generation, DB access, or recipe edits. Repair only from full-coverage USDA
 * composition and ingredient-specific weight conversions. Preserve other macros.
 * One gram absolute tolerance permits whole-recipe rounding, never a percentage.
 */
export async function repairGroceryCoachCarbs<T extends Recommendation>(
  recommendation: T,
  options: { enabled?: boolean; lookup?: CarbLookup } = {},
): Promise<T & { carbohydrateReview?: GroceryCoachCarbReview }> {
  if (!(options.enabled ?? process.env.NODE_ENV === "development")) return recommendation;
  const original = groceryCoachCarbBreakdown(recommendation.macros);
  const unresolved = (reason: string): T => ({
    ...recommendation,
    macros: { ...recommendation.macros, ...original },
    carbohydrateReview: { version: 1, status: "unresolved", reason },
  });
  const rows = [...(recommendation.ownedIngredients ?? []), ...(recommendation.shoppingList ?? [])];
  if (!rows.length || rows.length > 24) return unresolved("ingredient_coverage");
  if (rows.some(row => !row || typeof row.item !== "string" || !row.item.trim() ||
      typeof row.unit !== "string" || !["string", "number"].includes(typeof row.quantity))) {
    return unresolved("ingredient_quantity_or_composition_unresolved");
  }
  if (new Set(rows.map(row => norm(row.item ?? ""))).size !== rows.length) {
    return unresolved("duplicate_ingredient_quantities");
  }
  const timeout = AbortSignal.timeout(25000);
  const lookup: CarbLookup = options.lookup ?? (name => lookupUsdaIngredient(name, (input, init) =>
    fetch(input, { ...init, signal: AbortSignal.any([timeout, ...(init?.signal ? [init.signal] : [])]) })));
  const evidence: NonNullable<GroceryCoachCarbReview["evidence"]> = [];
  let reason = "";
  let next = 0;
  // Bounded concurrency and overall source deadline. Unknown data never becomes zero.
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async () => {
    while (!reason && next < rows.length) {
      const ingredientIndex = next++;
      const row = rows[ingredientIndex];
      const rule = GROUPS.find(group => group.names.some(name => norm(name) === norm(row.item ?? "")));
      if (!rule) { reason = "ingredient_identity_unresolved"; break; }
      try {
        if (timeout.aborted) { reason = "source_unavailable"; break; }
        const source = await lookup(rule.description);
        if (!source || norm(source.description) !== norm(rule.description) ||
            !Number.isInteger(source.fdcId) || source.fdcId <= 0 ||
            !["SR Legacy", "Foundation"].includes(source.dataType)) {
          reason = "ingredient_source_unresolved"; break;
        }
        const conversion = dessertIngredientGrams({
          name: row.item, amount: String(row.quantity), unit: row.unit,
        }, source);
        const carbs = source.macrosPer100g.carbs;
        if (!conversion || typeof carbs !== "number" || !Number.isFinite(carbs) || carbs < 0) {
          reason = "ingredient_quantity_or_composition_unresolved"; break;
        }
        evidence.push({
          ingredientIndex, name: row.item, quantity: row.quantity, unit: row.unit,
          grams: conversion.grams, source: "USDA FoodData Central",
          fdcId: source.fdcId, description: source.description,
          dataType: source.dataType, basis: "per_100g", carbsPer100g: carbs,
          retrievedAt: source.retrievedAt, conversion: conversion.conversion,
          category: rule.category, carbs: carbs * conversion.grams / 100,
        });
      } catch { reason = "source_unavailable"; }
    }
  }));
  if (reason || evidence.length !== rows.length) return unresolved(reason || "ingredient_coverage");
  evidence.sort((a, b) => a.ingredientIndex - b.ingredientIndex);
  const sum = (category?: Category) => evidence.reduce((total, row) =>
    total + (!category || row.category === category ? row.carbs : 0), 0);
  const sourced = { starchyCarbs: sum("starchy"), fibrousCarbs: sum("fibrous") };
  const total = recommendation.macros.carbs;
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(sum()) ||
      Math.abs(sum() - total) > 1) return unresolved("total_carbs_conflict");
  // Keep previously valid category estimates, but do not certify conflicting ones.
  for (const key of ["starchyCarbs", "fibrousCarbs"] as const) {
    if (original[key] !== null && Math.abs(original[key]! - sourced[key]) > 1) {
      return unresolved("existing_estimate_conflict");
    }
  }
  const split = {
    starchyCarbs: original.starchyCarbs ?? sourced.starchyCarbs,
    fibrousCarbs: original.fibrousCarbs ?? sourced.fibrousCarbs,
  };
  const checked = groceryCoachCarbBreakdown({ carbs: total, ...split });
  if (checked.starchyCarbs === null || checked.fibrousCarbs === null) return unresolved("invalid_category_totals");
  return {
    ...recommendation, macros: { ...recommendation.macros, ...split },
    carbohydrateReview: { version: 1, status: "validated", reason: "ingredient_sources_verified", evidence },
  };
}
