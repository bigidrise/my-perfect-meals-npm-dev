/**
 * INGREDIENT NORMALIZER — SINGLE SOURCE OF TRUTH
 *
 * Maps ingredient name variants to canonical names so duplicates
 * collapse into a single item during Smart Grocery List aggregation.
 *
 * Apply BEFORE canMerge in shoppingListStore.ts.
 * Do NOT use for macro math or meal builder logic.
 */

export function normalizeIngredient(name: string): string {
  const n = name.toLowerCase().trim();

  if (n.includes("boneless") && n.includes("chicken breast")) return "skinless chicken breast";
  if (n.includes("chicken breast")) return "skinless chicken breast";
  if (n.includes("skinless chicken breast")) return "skinless chicken breast";

  if (n.includes("chicken thigh")) return "chicken thigh";
  if (n.includes("chicken leg")) return "chicken leg";
  if (n.includes("chicken wing")) return "chicken wing";

  if (n.includes("ground turkey")) return "ground turkey";
  if (n.includes("turkey breast")) return "turkey breast";

  return name;
}
