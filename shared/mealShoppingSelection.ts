import { z } from "zod";
import { prepareShoppingRecipeIngredient, readShoppingQuantity } from "./shoppingRecipeIngredient";
import { parseIngredientMetadata, type ShoppingIngredientMetadata } from "./shoppingIngredientMetadata";

export const shoppingSelectionSchema = z.object({
  selectionId: z.string().trim().min(1).max(256),
  recipeName: z.string().trim().min(1).max(500),
  source: z.string().trim().min(1).max(100),
  quantityBasis: z.enum(["recipe_total", "per_serving"]),
  recipeYield: z.number().finite().positive().max(10000),
  shoppingServings: z.number().finite().positive().max(10000),
  subjectKind: z.enum(["human", "pet"]).default("human"),
  ingredients: z.array(z.unknown()).min(1).max(300),
  expectedVersion: z.number().int().positive().optional(),
}).strict();
export const shoppingTransferSchema = z.object({
  operation: z.enum(["add", "replace"]).default("add"),
  selections: z.array(shoppingSelectionSchema).min(1).max(100),
}).strict().refine(value => value.selections.reduce((n, s) => n + s.ingredients.length, 0) <= 2000,
  "Too many ingredients in one transfer");
export type ShoppingSelection = z.infer<typeof shoppingSelectionSchema>;
export type ShoppingTransfer = z.infer<typeof shoppingTransferSchema>;
export type SelectionResult = {
  selectionId: string; version: number;
  status: "added" | "updated" | "already_added" | "update_required" | "not_added";
};
export type TransferResult = { committed: boolean; results: SelectionResult[] };
export function templateShoppingSelectionId(slug: string, templateKey = "classic") {
  return `template:${slug}:${templateKey}`;
}
export type PreparedShoppingIngredient = {
  name: string; quantity: number; unit: string; ingredientMetadata: ShoppingIngredientMetadata;
  productKey?: string | null;
};
export function stableShoppingJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableShoppingJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([,v]) => v !== undefined)
    .sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${stableShoppingJson(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const units: Record<string, [string, number]> = {
  g: ["g", 1], gram: ["g", 1], grams: ["g", 1], kg: ["g", 1000],
  oz: ["g", 28.349523125], ounce: ["g", 28.349523125], ounces: ["g", 28.349523125],
  lb: ["g", 453.59237], lbs: ["g", 453.59237], pound: ["g", 453.59237], pounds: ["g", 453.59237],
  ml: ["ml", 1], l: ["ml", 1000], liter: ["ml", 1000], liters: ["ml", 1000],
  cup: ["ml", 236.5882365], cups: ["ml", 236.5882365],
  tbsp: ["ml", 14.78676478125], tablespoon: ["ml", 14.78676478125], tablespoons: ["ml", 14.78676478125],
  tsp: ["ml", 4.92892159375], teaspoon: ["ml", 4.92892159375], teaspoons: ["ml", 4.92892159375],
};
export const shoppingRound = (value: number) => Math.round(value * 1e9) / 1e9;
export class ShoppingSelectionValidationError extends Error {}
export function shoppingUnit(quantity: number, unit: string | null | undefined) {
  const normalized = (unit || "").trim().toLowerCase();
  const [base, factor] = units[normalized] || [normalized, 1];
  return { quantity: shoppingRound(quantity * factor), unit: base, factor };
}
export function prepareShoppingSelection(selection: ShoppingSelection): PreparedShoppingIngredient[] {
  const multiplier = selection.quantityBasis === "recipe_total"
    ? selection.shoppingServings / selection.recipeYield : selection.shoppingServings;
  return selection.ingredients.map(raw => {
    const prepared = prepareShoppingRecipeIngredient(raw, {
      id: selection.selectionId, name: selection.recipeName, source: selection.source,
    });
    const original = typeof raw === "string" ? prepared.ingredientMetadata.contributions[0]?.quantity
      : (raw as any)?.quantity ?? (raw as any)?.qty ?? (raw as any)?.amount ?? (raw as any)?.amountOz;
    const quantity = readShoppingQuantity(original);
    if (!prepared.name?.trim() || quantity == null || quantity <= 0 ||
        !Number.isFinite(quantity * multiplier) || quantity * multiplier > 1e8) {
      throw new ShoppingSelectionValidationError("Review ingredient names and quantities; unknown/to-taste amounts cannot be transferred.");
    }
    const metadata = typeof raw === "object" && raw !== null
      ? parseIngredientMetadata((raw as any).ingredientMetadata) : undefined;
    return {
      name: prepared.name.trim(), quantity: shoppingRound(quantity * multiplier),
      unit: (prepared.unit || ((raw as any)?.amountOz != null ? "oz" : "")).trim().toLowerCase(),
      ingredientMetadata: metadata || prepared.ingredientMetadata,
      productKey: metadata?.selectedProduct?.productKey || null,
    };
  });
}

/** Never infer yield from macro-per-serving values or from the current slider. */
export function selectionForRecipe(
  recipe: any, source: string,
  options: { recipeYield?: number; shoppingServings?: number; subjectKind?: "human" | "pet" } = {},
): { selection?: ShoppingSelection; reason?: string } {
  if (!recipe) return { reason: "A finalized recipe is required." };
  const id = recipe.shoppingSelectionId || recipe.shoppingOriginId || recipe.id || recipe.mealId;
  const recipeYield = Number(recipe.shoppingRecipeYield ?? recipe.recipeYield ?? recipe.servings ?? options.recipeYield);
  const shoppingServings = Number(options.shoppingServings ?? recipe.shoppingServings ?? recipeYield);
  if (!id) return { reason: "This recipe needs a saved, stable recipe identity before Shopping." };
  if (!Number.isFinite(recipeYield) || recipeYield <= 0) return { reason: "Confirm this recipe's original yield before Shopping." };
  const parsed = shoppingSelectionSchema.safeParse({
    selectionId: recipe.shoppingSelectionId || `recipe:${id}`,
    recipeName: recipe.name || recipe.recipeName || recipe.title, source,
    quantityBasis: recipe.shoppingQuantityBasis || "recipe_total",
    recipeYield, shoppingServings, subjectKind: options.subjectKind || "human",
    ingredients: recipe.shoppingCanonicalIngredients || recipe.ingredients,
  });
  if (!parsed.success) return { reason: "A complete recipe and valid serving quantities are required." };
  try { prepareShoppingSelection(parsed.data); }
  catch (error) { return { reason: (error as Error).message }; }
  return { selection: parsed.data };
}
