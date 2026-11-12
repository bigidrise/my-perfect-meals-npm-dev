import { apiRequest } from "@/lib/apiRequest";
import { shoppingAccount } from "@/lib/mealShoppingApi";
import { assertShoppingMetadataEndpoint } from "@/lib/shoppingMetadataTransport";
import { prepareShoppingSelection, stableShoppingJson, type ShoppingSelection } from "@shared/mealShoppingSelection";

const inFlight = new Map<string, Promise<{ alreadyAdded: boolean }>>();

/** Saved-card entry to the aggregate bar's existing grocery endpoint. */
export async function sendSavedMealToShopping(
  selection: ShoppingSelection,
  metadataEnabled: boolean,
) {
  const account = shoppingAccount();
  if (!account) throw new Error("Sign in before Shopping.");
  const key = `saved-meal-shopping:v1:${account}:${selection.selectionId}`;
  const send = () => persistSavedMeal(selection, metadataEnabled, account, key);
  if (inFlight.has(key)) return inFlight.get(key)!;
  const pending = typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request(key, send) : send();
  inFlight.set(key, pending);
  try { return await pending; } finally { inFlight.delete(key); }
}

async function persistSavedMeal(selection: ShoppingSelection, metadataEnabled: boolean, account: string, key: string) {
  const ingredients = prepareShoppingSelection(selection);
  const signature = stableShoppingJson(selection);
  const readiness = await apiRequest("/api/shopping-list-v2/");
  if (!Array.isArray(readiness?.items)) {
    throw new Error("Shopping list readiness could not be confirmed. Nothing was saved.");
  }
  if (shoppingAccount() !== account) throw new Error("Account changed; reopen Saved Meals.");
  if (readiness.ownerUserId != null && readiness.ownerUserId !== account) {
    throw new Error("Shopping account changed. Refresh before saving.");
  }
  let includeMetadata = false;
  if (metadataEnabled && readiness.shoppingMetadataVersion != null) {
    assertShoppingMetadataEndpoint(readiness, account);
    includeMetadata = true;
  }
  const storedReceipt = localStorage.getItem(key);
  if (storedReceipt) {
    let receipt;
    try {
      receipt = JSON.parse(storedReceipt);
      if (!Array.isArray(receipt.ids) || typeof receipt.signature !== "string") throw new Error();
    } catch {
      throw new Error("Shopping save history could not be read. Check the list before adding this recipe again.");
    }
    const present = new Set(readiness.items.map((item: any) => item.id));
    const remaining = receipt.ids.filter((id: string) => present.has(id));
    if (remaining.length || !receipt.ids.length && readiness.items.length) {
      if (receipt.signature === signature && remaining.length === receipt.ids.length) {
        return { alreadyAdded: true };
      }
      throw new Error("This recipe was already added. Review its existing shopping ingredients before adding it again.");
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
  const ids = Array.isArray(response.items)
    ? response.items.map((item: any) => item.id).filter((id: any) => typeof id === "string") : [];
  try {
    localStorage.setItem(key, JSON.stringify({ signature, ids }));
  } catch {
    // The database save is confirmed: a browser-cache failure must not report
    // "not saved" and encourage another write.
    console.warn("Shopping was saved, but browser repeat protection could not be stored. Check the list before adding again.");
  }
  return { alreadyAdded: false };
}
