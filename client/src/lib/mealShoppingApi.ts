import { apiRequest } from "@/lib/apiRequest";
import { stableShoppingJson, type ShoppingSelection, type TransferResult } from "@shared/mealShoppingSelection";

export const shoppingAccount = () => localStorage.getItem("userId") || "";
type Capability = { available: boolean; reason?: string };
const capabilities = new Map<string, { at: number; promise: Promise<Capability> }>();
export function mealShoppingCapabilities(): Promise<Capability> {
  const account = shoppingAccount();
  if (!account) return Promise.resolve({ available: false, reason: "Sign in before Shopping." });
  const cached = capabilities.get(account);
  if (cached && Date.now() - cached.at < 15000) return cached.promise;
  const promise = apiRequest("/api/shopping-list-v2/selections/capabilities").then((value: Capability) => {
    if (shoppingAccount() !== account) throw new Error("Account changed; reopen Shopping.");
    if (typeof value?.available !== "boolean") throw new Error("Shopping readiness was not confirmed.");
    return value;
  });
  capabilities.set(account, { at: Date.now(), promise });
  return promise;
}
export async function sendShoppingSelections(
  selections: ShoppingSelection[], operation: "add" | "replace" = "add",
  request = apiRequest,
  reconcile = async () => (await import("@/stores/shoppingListStore")).useShoppingListStore.getState().hydrate(),
): Promise<TransferResult> {
  const account = shoppingAccount();
  if (!account) throw new Error("Sign in before Shopping.");
  const result = await request("/api/shopping-list-v2/selections", {
    method: "POST", body: JSON.stringify({ selections, operation }),
  });
  if (shoppingAccount() !== account) throw new Error("Account changed. Reopen Shopping to see this account's list.");
  if (typeof result?.committed !== "boolean" || !Array.isArray(result.results) ||
      result.results.length !== new Set(selections.map(s => s.selectionId)).size ||
      new Set(result.results.map((r: any) => r.selectionId)).size !== result.results.length ||
      result.results.some((r: any) => !selections.some(s => s.selectionId === r.selectionId) ||
        !["added", "updated", "already_added", "update_required", "not_added"].includes(r.status) ||
        result.committed && (!["added", "updated", "already_added"].includes(r.status) || !(r.version > 0)))) {
    throw new Error("Shopping persistence was not confirmed. Retry safely.");
  }
  if (result.committed) {
    // The server already applied quantities. Never optimistically add them again.
    try { await reconcile(); }
    catch { throw new Error("Shopping was saved, but the list could not be refreshed. Reopen it or retry safely."); }
    if (shoppingAccount() !== account) throw new Error("Account changed; reopen the list.");
  }
  return result;
}

type CanonicalRecord = { recipe: any; signature: string; aliases: string[] };
const registries = new Map<string, Map<string, CanonicalRecord>>();
function registry() {
  const account = shoppingAccount(), key = `mpm:shopping-canonical:${account}`;
  if (!registries.has(account)) {
    try { registries.set(account, new Map(JSON.parse(sessionStorage.getItem(key) || "[]"))); }
    catch { registries.set(account, new Map()); }
  }
  return { records: registries.get(account)!, key };
}
function persistRegistry() {
  const { records, key } = registry();
  while (records.size > 200) records.delete(records.keys().next().value!);
  try { sessionStorage.setItem(key, JSON.stringify([...records])); } catch { /* Never substitute or corrupt recipe data on cache failure. */ }
}
/** Canonical food evidence is distinct from translated presentation. */
export function canonicalShoppingRecipe(recipe: any, originalYield?: number) {
  if (!recipe) return recipe;
  const id = recipe.shoppingSelectionId || recipe.shoppingOriginId || recipe.id || recipe.mealId;
  if (!id) return recipe;
  const { records } = registry();
  const signature = stableShoppingJson(recipe.ingredients);
  const old = records.get(String(id));
  if (old && (signature === old.signature || old.aliases.includes(signature))) return old.recipe;
  const canonical = {
    ...recipe,
    shoppingCanonicalIngredients: recipe.shoppingCanonicalIngredients || recipe.ingredients,
    shoppingRecipeYield: recipe.shoppingRecipeYield ?? recipe.recipeYield ?? recipe.servings ?? old?.recipe.shoppingRecipeYield ?? originalYield,
  };
  records.set(String(id), { recipe: canonical, signature, aliases: [] });
  persistRegistry();
  return canonical;
}
export function rememberShoppingTranslation(recipe: any, translated: any, originalYield?: number) {
  canonicalShoppingRecipe(recipe, originalYield);
  const id = recipe?.shoppingSelectionId || recipe?.shoppingOriginId || recipe?.id || recipe?.mealId;
  const record = registry().records.get(String(id));
  if (record && translated.ingredients) {
    record.aliases.push(stableShoppingJson(translated.ingredients));
    persistRegistry();
  }
}
export function withShoppingProvenance(recipe: any, source: string) {
  const canonical = canonicalShoppingRecipe(recipe);
  if (!canonical) return recipe;
  return { ...recipe, shoppingOriginId: canonical.shoppingOriginId || canonical.id || canonical.mealId,
    shoppingCanonicalIngredients: canonical.shoppingCanonicalIngredients,
    shoppingRecipeYield: canonical.shoppingRecipeYield, shoppingOriginSource: source };
}
