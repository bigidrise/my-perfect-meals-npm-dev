import { lookupUsdaIngredient, type IngredientComposition } from "./productDiscovery/usdaIngredientAdapter";
import { dessertIngredientGrams } from "./dessertNutrition";
import { GATHERINGS_NUTRITION_VERSION, GATHERINGS_MACROS, gatheringsRecipeSignature, type GatheringsMacros, type GatheringsNutritionResult } from "../../shared/gatheringsNutrition";
import type { GatheringsIngredient } from "./gatheringsIngredientParser";

export const GATHERINGS_USDA_BUDGET = { lookups: 32, httpRequests: 64, sourceMs: 30_000, fetchMs: 6_000, ingredients: 40 };
/** Pilot only: never change the deployed/Production recipe path implicitly. */
export function gatheringsNutritionEnabled(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.REPLIT_DEPLOYMENT;
}

// Local identities only; numeric composition still comes from the existing USDA
// adapter. No fuzzy matching, invented density, or changes to other generators.
const IDENTITIES: Record<string, string> = {
  potato: "Potatoes, flesh and skin, raw", potatoes: "Potatoes, flesh and skin, raw",
  "raw potatoes": "Potatoes, flesh and skin, raw",
  onion: "Onions, raw", onions: "Onions, raw",
  ginger: "Ginger root, raw", "fresh ginger": "Ginger root, raw",
  "sweet potato": "Sweet potato, raw, unprepared",
  "sweet potatoes": "Sweet potato, raw, unprepared",
  "glutinous rice flour": "Rice flour, white, glutinous",
};

// Reviewed USDA SR Legacy identities, scoped to this Development pilot.
// Pin the record as well as its description; never strip preparation words or
// infer salmon species, edible bone-in weight, milk formulation or hydration.
const REVIEWED_IDENTITIES: Record<string, { description: string; fdcId: number; portionForm?: string }> = {
  "ground ginger": { description: "Spices, ginger, ground", fdcId: 170926 },
  "ground nutmeg": { description: "Spices, nutmeg, ground", fdcId: 171326 },
  "sesame oil": { description: "Oil, sesame, salad or cooking", fdcId: 171016 },
  "miso paste": { description: "Miso", fdcId: 172442 },
  "finely chopped green onions": {
    description: "Onions, spring or scallions (includes tops and bulb), raw",
    fdcId: 170005, portionForm: "chopped",
  },
  "green onions, finely chopped": {
    description: "Onions, spring or scallions (includes tops and bulb), raw",
    fdcId: 170005, portionForm: "chopped",
  },
};

export interface GatheringsLookup {
  lookup: (name: string) => Promise<IngredientComposition | null>;
  metrics: { lookups: number; httpRequests: number; sourceMs: number; cacheReuses: number };
}
/** One budget per gathering; AI/image time does not consume USDA source time. */
export function createGatheringsLookup(fetcher: typeof fetch = fetch): GatheringsLookup {
  const metrics = { lookups: 0, httpRequests: 0, sourceMs: 0, cacheReuses: 0 };
  const cache = new Map<string, IngredientComposition | null>();
  return {
    metrics,
    async lookup(name) {
      const key = name.toLowerCase().trim();
      if (cache.has(key)) { metrics.cacheReuses++; return cache.get(key)!; }
      if (metrics.lookups >= GATHERINGS_USDA_BUDGET.lookups || metrics.sourceMs >= GATHERINGS_USDA_BUDGET.sourceMs) {
        throw new Error("source_budget_exhausted");
      }
      metrics.lookups++;
      const boundedFetch: typeof fetch = async (input, init) => {
        const remaining = GATHERINGS_USDA_BUDGET.sourceMs - metrics.sourceMs;
        if (metrics.httpRequests >= GATHERINGS_USDA_BUDGET.httpRequests || remaining <= 0) {
          throw new Error("source_budget_exhausted");
        }
        metrics.httpRequests++;
        const controller = new AbortController();
        const started = Date.now();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error("source_timeout")); },
            Math.min(GATHERINGS_USDA_BUDGET.fetchMs, remaining));
        });
        try {
          return await Promise.race([
            (async () => {
              const response = await fetcher(input, {
                ...init, signal: init?.signal
                  ? AbortSignal.any([init.signal, controller.signal]) : controller.signal,
              });
              // Bound body download/JSON decoding as well as response headers.
              const body = await response.json();
              return { ok: response.ok, json: async () => body } as Response;
            })(),
            timeout,
          ]);
        } finally {
          clearTimeout(timer);
          metrics.sourceMs += Date.now() - started;
        }
      };
      const reviewed = REVIEWED_IDENTITIES[key];
      let source = await lookupUsdaIngredient(reviewed?.description ?? IDENTITIES[key] ?? name, boundedFetch);
      if (source && reviewed) {
        // The existing converter already understands explicit portion forms.
        // Supply "chopped" only for these reviewed aliases, not other callers.
        source = source.fdcId === reviewed.fdcId && source.description === reviewed.description &&
          source.dataType === "SR Legacy"
          ? { ...source, ...(reviewed.portionForm ? { portionForm: reviewed.portionForm } : {}) }
          : null;
      }
      cache.set(key, source);
      return source;
    },
  };
}

export interface GatheringsEstimate {
  nutrition?: GatheringsMacros;
  nutritionResult: GatheringsNutritionResult;
}
export async function calculateGatheringsNutrition(
  recipe: { ingredients: GatheringsIngredient[]; instructions?: string[]; name?: string },
  servings: number,
  lookup: GatheringsLookup["lookup"],
): Promise<GatheringsEstimate> {
  const result: GatheringsNutritionResult = {
    version: GATHERINGS_NUTRITION_VERSION, status: "needs_review", basis: "whole_recipe",
    servings, reasons: [], assumptions: [], sources: [],
  };
  const unresolved = (reason: string, unavailable = false): GatheringsEstimate => {
    result.status = unavailable ? "unavailable" : "needs_review";
    result.reasons.push(reason);
    return { nutritionResult: result };
  };
  if (!Number.isInteger(servings) || servings < 1 || servings > 50) return unresolved("invalid_recipe_yield");
  if (!recipe.ingredients.length || recipe.ingredients.length > GATHERINGS_USDA_BUDGET.ingredients) {
    return unresolved("ingredient_coverage_unresolved");
  }
  const text = [recipe.name, ...(recipe.instructions ?? []), ...recipe.ingredients.map(i => i.originalText)].join(" ").toLowerCase();
  const frying = /\b(fry|fried|frying|pan[- ]fry|deep[- ]fry|shallow[- ]fry|latkes?|tempura|fritters?)\b/.test(text);
  if (frying) {
    result.assumptions.push("Frying-fat retention is unknown; neither all pan oil nor zero oil is assumed.");
    return unresolved("frying_fat_retention_unknown");
  }
  const totals: GatheringsMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const [index, ingredient] of recipe.ingredients.entries()) {
    if (ingredient.parseIssue || ingredient.amount == null || !ingredient.unit) {
      return unresolved(`ingredient.${index}.quantity_unresolved`);
    }
    // No retention percentage can be inferred from an AI instruction. Frying
    // fats require measured retention or a separately reviewed method policy.
    if (/\b(oil|butter|ghee|shortening|lard|fat)\b/i.test(ingredient.name) &&
        /\b(greasing|grease|discard|divided|as needed)\b/i.test(ingredient.originalText + " " + text)) {
      return unresolved(`ingredient.${index}.fat_consumption_unresolved`);
    }
    let source: IngredientComposition | null;
    try { source = await lookup(ingredient.name); }
    catch { return unresolved(`ingredient.${index}.source_unavailable_or_budget`, true); }
    if (!source) return unresolved(`ingredient.${index}.identity_unresolved`);
    const converted = dessertIngredientGrams({
      name: ingredient.name, amount: String(ingredient.amount), unit: ingredient.unit,
    }, source);
    if (!converted) return unresolved(`ingredient.${index}.portion_unresolved`);
    for (const nutrient of GATHERINGS_MACROS) {
      const value = source.macrosPer100g[nutrient];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return unresolved(`ingredient.${index}.${nutrient}_missing`, true);
      }
      totals[nutrient] += value * converted.grams / 100;
    }
    result.sources.push({
      ingredientIndex: index, fdcId: source.fdcId, description: source.description,
      dataType: source.dataType, retrievedAt: source.retrievedAt,
      grams: converted.grams, conversion: converted.conversion,
    });
    if (/\b(oil|butter|ghee|shortening|lard)\b/i.test(ingredient.name)) {
      result.assumptions.push(`Ingredient ${index + 1}: counted the stated incorporated fat; no cooking loss deducted.`);
    }
  }
  if (!GATHERINGS_MACROS.every(key => Number.isFinite(totals[key]))) return unresolved("non_finite_totals", true);
  const energy = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
  if (Math.abs(totals.calories - energy) > Math.max(20 * servings, totals.calories * 0.10)) {
    return unresolved("energy_macro_difference_requires_review");
  }
  result.status = "available";
  result.recipeSignature = gatheringsRecipeSignature(recipe, servings, totals);
  return { nutrition: totals, nutritionResult: result };
}
