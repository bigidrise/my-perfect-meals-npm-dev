import { useShoppingListStore } from "@/stores/shoppingListStore";
import { shoppingMetadataEnabled } from "@/lib/shoppingMetadataGate";
import { shoppingProductOptionsEnabled } from "@/lib/shoppingProductOptionsGate";
import { saveProductionShoppingProductChoice } from "@/lib/productionShoppingProductChoice";
import type { ShoppingListItem } from "@/stores/shoppingListStore";
import { canonicalShoppingIngredient, type ShoppingProductSelection, type ShoppingProductReference } from "@shared/shoppingProductSelection";

export function shoppingIngredientFor(item: Pick<ShoppingListItem, "name" | "ingredientMetadata">) {
  return canonicalShoppingIngredient({
    originalName: item.ingredientMetadata?.ingredient.originalName || item.name,
    requirements: item.ingredientMetadata?.ingredient.requirements || [],
  });
}

/** Explicit member choice in every build; no automatic product selection. */
export function applyShoppingProductChoice(ids: string[], selection: ShoppingProductSelection | null) {
  const state = useShoppingListStore.getState() as ReturnType<typeof useShoppingListStore.getState> & {
    chooseProduct?: (ids: string[], selection: ShoppingProductSelection | null) => Promise<void>;
  };
  if (!shoppingProductOptionsEnabled) {
    return Promise.reject(new Error("Product Options are not enabled."));
  }
  if (shoppingMetadataEnabled && typeof state.chooseProduct === "function") {
    return state.chooseProduct(ids, selection);
  }
  return saveProductionShoppingProductChoice(ids, selection);
}

/** Distinct intent-only entry point; never falls back to the verified action. */
export function applyShoppingProductReference(ids: string[], reference: ShoppingProductReference) {
  const state = useShoppingListStore.getState() as ReturnType<typeof useShoppingListStore.getState> & {
    chooseReference?: (ids: string[], reference: ShoppingProductReference) => Promise<void>;
  };
  if (!shoppingProductOptionsEnabled) {
    return Promise.reject(new Error("Product Options are not enabled."));
  }
  if (shoppingMetadataEnabled && typeof state.chooseReference === "function") {
    return state.chooseReference(ids, reference);
  }
  return saveProductionShoppingProductChoice(ids, reference, true);
}
