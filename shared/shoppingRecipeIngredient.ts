import { makeIngredientMetadata } from "./shoppingIngredientMetadata";

const amountPrefix = /^((?:\d+\s+)?\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?(?:\s*[½¼¾⅓⅔⅛⅜⅝⅞])?|[½¼¾⅓⅔⅛⅜⅝⅞])(?:\s+|$)(.*)$/;
const unitPrefix = /^(cups?|tbsp|tsp|tablespoons?|teaspoons?|g|grams?|kg|oz|ounces?|lb|lbs|pounds?|ml|liters?|heads?|slices?|cloves?)(?:\s+|$)(.*)$/i;
function numericAmount(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const prefix = value.trim().match(amountPrefix)?.[1];
  if (!prefix) return undefined;
  const fractions: Record<string, number> = { "½": .5, "¼": .25, "¾": .75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": .125, "⅜": .375, "⅝": .625, "⅞": .875 };
  const unicode = Object.keys(fractions).find(f => prefix.includes(f));
  if (unicode) return Number(prefix.replace(unicode, "").trim() || 0) + fractions[unicode];
  const fraction = prefix.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return Number(fraction[3]) ? Number(fraction[1] || 0) + Number(fraction[2]) / Number(fraction[3]) : undefined;
  return Number(prefix.replace(",", "."));
}

/** Capture text and recipe amounts before display/retail normalization. */
export function prepareShoppingRecipeIngredient(
  raw: any, recipe: { id?: string; name?: string; source?: string } = {},
) {
  let name: string, unit: string, originalQuantity: number | string | undefined;
  if (typeof raw === "string") {
    const match = raw.trim().match(amountPrefix);
    const rest = match?.[2] || raw.trim();
    const unitMatch = match && rest.match(unitPrefix);
    name = unitMatch ? unitMatch[2] : rest;
    unit = unitMatch ? unitMatch[1] : "";
    originalQuantity = match?.[1];
  } else {
    name = raw?.item || raw?.name || raw?.ingredient;
    originalQuantity = raw?.quantity ?? raw?.qty ?? raw?.amount ?? raw?.amountOz;
    const rest = typeof originalQuantity === "string" ? originalQuantity.trim().match(amountPrefix)?.[2] : "";
    unit = raw?.unit || rest?.match(unitPrefix)?.[1] || "";
  }
  return {
    name, qty: numericAmount(originalQuantity) ?? 1, unit,
    ingredientMetadata: makeIngredientMetadata({
      name, quantity: originalQuantity, unit,
      originalText: typeof raw === "string" ? raw : raw?.originalText || name,
      recipeId: recipe.id, recipeName: recipe.name, source: recipe.source,
      ingredientMetadata: typeof raw === "object" ? raw?.ingredientMetadata : undefined,
    }),
  };
}
