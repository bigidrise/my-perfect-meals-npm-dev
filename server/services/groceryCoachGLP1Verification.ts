import { groceryCoachPerServingMacros } from "../../shared/groceryCoachCarbs";
import { hasMeasuredCheeseQuantity, isGLP1CompositionSensitiveCheese } from "../../shared/glp1CheesePolicy";

type GroceryIngredient = { item?: string; quantity?: string; unit?: string };
type GroceryRecipe = {
  meal?: { servings?: unknown };
  macros?: Record<string, unknown>;
  shoppingList?: readonly GroceryIngredient[];
  ownedIngredients?: readonly GroceryIngredient[];
};

/**
 * Final invariant for every Grocery Coach return, including protocol retries.
 * Does not issue product clearance or change the existing protein-warning policy.
 */
export function groceryCoachGLP1Issue(
  recipe: GroceryRecipe,
  targets: { maximumToleratedFatGrams: number } | null,
): "ingredient_measurement" | "nutrition_evidence" | "fat_allowance" | null {
  if (!targets) return null;
  const ingredients = [...(recipe.shoppingList ?? []), ...(recipe.ownedIngredients ?? [])];
  if (ingredients.some(ingredient =>
    isGLP1CompositionSensitiveCheese(ingredient.item ?? "") &&
    !hasMeasuredCheeseQuantity(ingredient))) return "ingredient_measurement";
  const servings = recipe.meal?.servings;
  if (typeof servings !== "number" || !Number.isFinite(servings) || servings < 1 ||
      !Number.isFinite(targets.maximumToleratedFatGrams) || targets.maximumToleratedFatGrams < 0 ||
      ["calories", "fat", "protein"].some(field => {
        const value = recipe.macros?.[field];
        return typeof value !== "number" || !Number.isFinite(value) || value < 0;
      })) return "nutrition_evidence";
  const macros = groceryCoachPerServingMacros(recipe.macros ?? {}, servings);
  return macros.fat > targets.maximumToleratedFatGrams ? "fat_allowance" : null;
}

export function groceryCoachGLP1IssueMessage(
  issue: NonNullable<ReturnType<typeof groceryCoachGLP1Issue>>,
  language = "en",
): string {
  const messages = /^es(?:-|$)/i.test(language) ? {
    ingredient_measurement: "No se pudo verificar la cantidad de queso. Prueba un tipo de queso y una cantidad medible, sin cambiar tus límites.",
    nutrition_evidence: "No se pudo verificar la información nutricional por porción. Inténtalo de nuevo.",
    fat_allowance: "La grasa de la comida completa por porción supera tu límite actual de GLP-1. Prueba otro tipo o cantidad de ingrediente, u otra preparación.",
  } : {
    ingredient_measurement: "The cheese quantity couldn't be verified. Try a cheese type and a measured amount without changing your limits.",
    nutrition_evidence: "The per-serving nutrition couldn't be verified. Please try again.",
    fat_allowance: "The whole meal's per-serving fat exceeds your current GLP-1 allowance. Try another ingredient type or amount, or another preparation.",
  };
  return messages[issue];
}
