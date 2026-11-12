import { apiRequest } from "@/lib/apiRequest";
import { shoppingAccount } from "@/lib/mealShoppingApi";
import { assertShoppingMetadataEndpoint } from "@/lib/shoppingMetadataTransport";
import { prepareShoppingSelection, type ShoppingSelection } from "@shared/mealShoppingSelection";

/** Saved-card entry to the aggregate bar's existing grocery endpoint. */
export async function sendSavedMealToShopping(
  selection: ShoppingSelection,
  metadataEnabled: boolean,
) {
  const account = shoppingAccount();
  if (!account) throw new Error("Sign in before Shopping.");
  const ingredients = prepareShoppingSelection(selection);
  let includeMetadata = false;
  if (metadataEnabled) {
    const readiness = await apiRequest("/api/shopping-list-v2/");
    if (!Array.isArray(readiness?.items)) {
      throw new Error("Shopping list readiness could not be confirmed. Nothing was saved.");
    }
    if (readiness.shoppingMetadataVersion != null) {
      assertShoppingMetadataEndpoint(readiness, account);
      includeMetadata = true;
    } else if (readiness.ownerUserId != null && readiness.ownerUserId !== account) {
      throw new Error("Shopping account changed. Refresh before saving.");
    }
  }
  if (shoppingAccount() !== account) throw new Error("Account changed; reopen Saved Meals.");
  const response = await apiRequest("/api/shopping-list", {
    method: "POST",
    body: JSON.stringify({
      scopeType: "adhoc", scopeKey: "inbox",
      sourceBuilder: selection.source,
      items: ingredients.map(item => ({
        name: item.name, quantity: item.quantity, unit: item.unit,
        sourceBuilder: selection.source,
        ...(includeMetadata ? { ingredientMetadata: item.ingredientMetadata } : {}),
      })),
    }),
  });
  if (shoppingAccount() !== account) throw new Error("Account changed; reopen the shopping list.");
  if (response?.ownerUserId != null && response.ownerUserId !== account) {
    throw new Error("Shopping account changed. Reopen the shopping list.");
  }
  const savedCount = response?.added ?? response?.itemsAdded;
  if ((response?.ok !== true && response?.success !== true) || savedCount !== ingredients.length) {
    throw new Error("Shopping save was not confirmed. Check the list before trying again.");
  }
}
