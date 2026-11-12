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
  if (metadataEnabled) {
    const readiness = await apiRequest("/api/shopping-list-v2/");
    assertShoppingMetadataEndpoint(readiness, account);
  }
  if (shoppingAccount() !== account) throw new Error("Account changed; reopen Saved Meals.");
  const response = await apiRequest("/api/shopping-list", {
    method: "POST",
    body: JSON.stringify({
      scopeType: "adhoc", scopeKey: "inbox",
      items: ingredients.map(item => ({
        name: item.name, quantity: item.quantity, unit: item.unit,
        sourceBuilder: selection.source,
        ...(metadataEnabled ? { ingredientMetadata: item.ingredientMetadata } : {}),
      })),
    }),
  });
  if (shoppingAccount() !== account) throw new Error("Account changed; reopen the shopping list.");
  if (metadataEnabled) assertShoppingMetadataEndpoint(response, account);
  if (response?.ok !== true || response.added !== ingredients.length) {
    throw new Error("Shopping save was not confirmed. Check the list before trying again.");
  }
}
