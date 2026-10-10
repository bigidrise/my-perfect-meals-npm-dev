import { USDA_NUTRIENT_FIELDS } from "./usdaBrandedAdapter";

export type IngredientMacros = Record<"calories" | "protein" | "carbs" | "fat", number | null>;
export interface IngredientComposition {
  fdcId: number;
  description: string;
  dataType: string;
  retrievedAt: string;
  macrosPer100g: IngredientMacros;
  portions: { amount: number; grams: number; measure: string }[];
  /** Food-source allocation, not measured chemical starch or a daily allocation proof. */
  carbSource: "starchy" | "non_starchy" | "unknown";
  portionForm?: string;
}
interface IngredientRule {
  names: string[];
  description: string;
  carbSource: IngredientComposition["carbSource"];
  portionForm?: string;
}
// Identity mappings only: all numeric composition and portion weights come from USDA.
// Generic full-fat ground almonds are represented by ground whole almonds, not defatted flour.
const RULES: IngredientRule[] = [
  { names: ["almond flour", "almond meal"], description: "Nuts, almonds", carbSource: "non_starchy", portionForm: "ground" },
  { names: ["almonds", "raw almonds"], description: "Nuts, almonds", carbSource: "non_starchy", portionForm: "whole" },
  { names: ["blanched almond flour", "blanched almonds"], description: "Nuts, almonds, blanched", carbSource: "non_starchy", portionForm: "ground" },
  { names: ["almond butter", "unsweetened almond butter"], description: "Nuts, almond butter, plain, without salt added", carbSource: "non_starchy" },
  { names: ["coconut oil"], description: "Oil, coconut", carbSource: "non_starchy" },
  { names: ["olive oil", "extra virgin olive oil"], description: "Oil, olive, salad or cooking", carbSource: "non_starchy" },
  { names: ["honey"], description: "Honey", carbSource: "starchy" },
  { names: ["sugar", "granulated sugar", "white sugar"], description: "Sugars, granulated", carbSource: "starchy" },
  { names: ["brown sugar", "light brown sugar", "dark brown sugar"], description: "Sugars, brown", carbSource: "starchy" },
  { names: ["maple syrup", "pure maple syrup"], description: "Syrups, maple", carbSource: "starchy" },
  { names: ["cinnamon", "ground cinnamon"], description: "Spices, cinnamon, ground", carbSource: "non_starchy" },
  { names: ["lemon zest", "fresh lemon zest", "lemon peel", "grated lemon zest"], description: "Lemon peel, raw", carbSource: "non_starchy" },
  { names: ["lemon juice", "fresh lemon juice"], description: "Lemon juice, raw", carbSource: "non_starchy" },
  { names: ["vanilla extract", "pure vanilla extract"], description: "Vanilla extract", carbSource: "non_starchy" },
  { names: ["salt", "sea salt", "table salt", "fine sea salt"], description: "Salt, table", carbSource: "non_starchy" },
  { names: ["all purpose flour", "all-purpose flour", "plain flour", "wheat flour"], description: "Wheat flour, white, all-purpose, unenriched", carbSource: "starchy" },
  { names: ["unsalted butter", "butter"], description: "Butter, without salt", carbSource: "non_starchy" },
  { names: ["salted butter"], description: "Butter, salted", carbSource: "non_starchy" },
  { names: ["egg", "eggs", "large egg", "large eggs"], description: "Egg, whole, raw, fresh", carbSource: "non_starchy", portionForm: "large" },
  { names: ["egg whites", "egg white"], description: "Egg, white, raw, fresh", carbSource: "non_starchy", portionForm: "large" },
  { names: ["whole milk", "milk"], description: "Milk, whole, 3.25% milkfat, with added vitamin D", carbSource: "non_starchy" },
  { names: ["cream cheese", "full fat cream cheese"], description: "Cheese, cream", carbSource: "non_starchy" },
  { names: ["heavy cream", "heavy whipping cream"], description: "Cream, fluid, heavy whipping", carbSource: "non_starchy" },
  { names: ["cocoa powder", "unsweetened cocoa powder", "cocoa"], description: "Cocoa, dry powder, unsweetened", carbSource: "non_starchy" },
  { names: ["apples", "apple", "raw apples"], description: "Apples, raw, with skin", carbSource: "non_starchy" },
  { names: ["baking soda"], description: "Leavening agents, baking soda", carbSource: "non_starchy" },
  { names: ["baking powder"], description: "Leavening agents, baking powder, double-acting, sodium aluminum sulfate", carbSource: "starchy" },
];
const norm = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const cache = new Map<string, { expires: number; value: IngredientComposition | null }>();
const inFlight = new Map<string, Promise<IngredientComposition | null>>();
let sourceUnavailableUntil = 0;
const targetName = (id: number) => {
  const field = USDA_NUTRIENT_FIELDS[id]?.target;
  return field?.replace("_kcal_per_100g", "").replace("_g_per_100g", "");
};
export function parseUsdaIngredient(food: any, carbSource: IngredientComposition["carbSource"] = "unknown"): IngredientComposition {
  if (!Number.isInteger(food?.fdcId) || !["SR Legacy", "Foundation"].includes(food?.dataType)) {
    throw new Error("Unsupported USDA ingredient record");
  }
  const macros: IngredientMacros = { calories: null, protein: null, carbs: null, fat: null };
  for (const row of food.foodNutrients ?? []) {
    const id = row.nutrient?.id;
    const key = targetName(id) as keyof IngredientMacros;
    const value = row.amount;
    const expected = USDA_NUTRIENT_FIELDS[id]?.unit;
    if (key in macros && String(row.nutrient?.unitName).toLowerCase() === expected &&
        typeof value === "number" && Number.isFinite(value) && value >= 0) macros[key] = value;
  }
  // Foundation may supply energy under an explicitly identified Atwater energy nutrient.
  if (macros.calories === null) {
    const energy = (food.foodNutrients ?? []).find((row: any) =>
      [2048, 2047].includes(row.nutrient?.id) &&
      String(row.nutrient?.unitName).toLowerCase() === "kcal" &&
      typeof row.amount === "number" && Number.isFinite(row.amount) && row.amount >= 0);
    if (energy) macros.calories = energy.amount;
  }
  return {
    fdcId: food.fdcId, description: String(food.description), dataType: food.dataType,
    retrievedAt: new Date().toISOString(), macrosPer100g: macros, carbSource,
    portions: (food.foodPortions ?? []).flatMap((row: any) => {
      const measure = row.modifier || row.measureUnit?.name;
      return typeof row.amount === "number" && row.amount > 0 &&
        typeof row.gramWeight === "number" && row.gramWeight > 0 && typeof measure === "string"
        ? [{ amount: row.amount, grams: row.gramWeight, measure }] : [];
    }),
  };
}
export async function lookupUsdaIngredient(name: string, fetcher: typeof fetch = fetch): Promise<IngredientComposition | null> {
  const key = norm(name);
  const rule = RULES.find(rule => rule.names.some(alias => norm(alias) === key));
  const description = rule?.description ?? name;
  const cacheKey = norm(description);
  const previous = cache.get(cacheKey);
  if (previous && previous.expires > Date.now()) return previous.value ? { ...previous.value, portionForm: rule?.portionForm } : null;
  const pending = inFlight.get(cacheKey);
  if (pending) {
    const value = await pending;
    return value ? { ...value, portionForm: rule?.portionForm } : null;
  }
  if (sourceUnavailableUntil > Date.now()) throw new Error("USDA source temporarily unavailable");
  const request = (async () => {
    // The existing public demo credential supports Development exploration only.
    // No credential is exposed in the meal response or logged.
    const apiKey = process.env.USDA_FDC_API_KEY || process.env.USDA_API_KEY || "DEMO_KEY";
    const search = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    search.searchParams.set("api_key", apiKey);
    search.searchParams.set("query", description);
    search.searchParams.set("dataType", "SR Legacy,Foundation");
    search.searchParams.set("pageSize", "20");
    const response = await fetcher(search, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("USDA source unavailable");
    const result = await response.json() as any;
    const match = (result.foods ?? []).find((food: any) =>
      norm(food.description ?? "") === norm(description) &&
      ["SR Legacy", "Foundation"].includes(food.dataType));
    let value: IngredientComposition | null = null;
    if (match) {
      const detailUrl = `https://api.nal.usda.gov/fdc/v1/food/${match.fdcId}?api_key=${encodeURIComponent(apiKey)}`;
      const detail = await fetcher(detailUrl, { signal: AbortSignal.timeout(10000) });
      if (!detail.ok) throw new Error("USDA source unavailable");
      const food = await detail.json();
      value = parseUsdaIngredient(food, rule?.carbSource);
      if (value.fdcId !== match.fdcId || norm(value.description) !== norm(description)) {
        throw new Error("USDA ingredient identity mismatch");
      }
    }
    cache.set(cacheKey, { expires: Date.now() + (value ? 86400000 : 60000), value });
    return value;
  })();
  inFlight.set(cacheKey, request);
  try {
    const value = await request;
    return value ? { ...value, portionForm: rule?.portionForm } : null;
  } catch {
    // Bound failed-source retry traffic across users and recipes; preserve valid cached evidence.
    sourceUnavailableUntil = Date.now() + 60000;
    throw new Error("USDA source unavailable");
  } finally { inFlight.delete(cacheKey); }
}
