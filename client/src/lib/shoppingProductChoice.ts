import { useShoppingListStore } from "@/stores/shoppingListStore";
import { shoppingMetadataEnabled } from "@/lib/shoppingMetadataGate";
import type { ShoppingListItem } from "@/stores/shoppingListStore";
import { canonicalShoppingIngredient, type ShoppingProductSelection } from "@shared/shoppingProductSelection";

export function shoppingIngredientFor(item: Pick<ShoppingListItem, "name" | "ingredientMetadata">) {
  return canonicalShoppingIngredient({
    originalName: item.ingredientMetadata?.ingredient.originalName || item.name,
    requirements: item.ingredientMetadata?.ingredient.requirements || [],
  });
}

/** Only the Development UI calls this; no legacy API or library auto-save. */
export function applyShoppingProductChoice(ids: string[], selection: ShoppingProductSelection | null) {
  const state = useShoppingListStore.getState() as ReturnType<typeof useShoppingListStore.getState> & {
    chooseProduct?: (ids: string[], selection: ShoppingProductSelection | null) => Promise<void>;
  };
  if (!shoppingMetadataEnabled || typeof state.chooseProduct !== "function") {
    return Promise.reject(new Error("Structured product choices are only available on the Development shopping list."));
  }
  return state.chooseProduct(ids, selection);
}
