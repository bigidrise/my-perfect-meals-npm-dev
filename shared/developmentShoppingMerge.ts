import {
  parseIngredientMetadata, preserveRecipeContributions, shoppingIdentityKey,
  type ShoppingIdentityInput, type ShoppingIngredientMetadata,
} from "./shoppingIngredientMetadata";

/** Development-only callers. Keep the stricter, existing identity contract intact. */
function ingredientKey(item: ShoppingIdentityInput): string {
  const metadata = parseIngredientMetadata(item.ingredientMetadata);
  if (!metadata) return shoppingIdentityKey(item);
  return shoppingIdentityKey({
    name: item.name,
    ingredientMetadata: { ...metadata, selectedProduct: null },
  });
}

function compatibleMetadata(a: ShoppingIdentityInput, b: ShoppingIdentityInput): boolean {
  if (ingredientKey(a) !== ingredientKey(b)) return false;
  const left = parseIngredientMetadata(a.ingredientMetadata);
  const right = parseIngredientMetadata(b.ingredientMetadata);
  if (!left || !right) return shoppingIdentityKey(a) === shoppingIdentityKey(b);
  // An orphan/different top-level identity must not be discarded by a merge.
  if ([a, b].some(item => item.productKey &&
      item.productKey !== item.ingredientMetadata?.selectedProduct?.productKey)) return false;
  if (left.selectedProduct && right.selectedProduct &&
      shoppingIdentityKey(a) !== shoppingIdentityKey(b)) return false;
  const contributions = new Map(left.contributions.map(c => [c.id, c]));
  return right.contributions.every(c =>
    !contributions.has(c.id) || JSON.stringify(contributions.get(c.id)) === JSON.stringify(c));
}

/**
 * Exact snapshots remain distinct. A generic group can join just ONE compatible
 * selected snapshot; never guess between brands, assessments or evidence.
 */
export function developmentShoppingGroups<T extends ShoppingIdentityInput>(
  items: T[],
  canCombine: (a: T, b: T) => boolean = () => true,
): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    const group = groups.find(g => shoppingIdentityKey(g[0]) === shoppingIdentityKey(item) &&
      g.every(other => canCombine(other, item) && compatibleMetadata(other, item)));
    if (group) group.push(item);
    else groups.push([item]);
  }
  for (const generic of [...groups]) {
    if (!generic.length || !generic[0].ingredientMetadata ||
        generic[0].ingredientMetadata.selectedProduct || generic[0].productKey) continue;
    const choices = groups.filter(g => g.length && g[0].ingredientMetadata?.selectedProduct &&
      generic.every(a => g.every(b => canCombine(a, b) && compatibleMetadata(a, b))));
    if (choices.length === 1) {
      choices[0].push(...generic);
      generic.length = 0;
    }
  }
  return groups.filter(g => g.length);
}

/** Call only for a compatible group returned above; never awards eligibility. */
export function mergeDevelopmentShoppingMetadata(
  left?: ShoppingIngredientMetadata | null,
  right?: ShoppingIngredientMetadata | null,
): ShoppingIngredientMetadata | undefined {
  const a = parseIngredientMetadata(left), b = parseIngredientMetadata(right);
  if (!a) return b;
  if (!b) return a;
  if (!compatibleMetadata({ name: "", ingredientMetadata: a }, { name: "", ingredientMetadata: b })) {
    throw new Error("Incompatible shopping ingredient metadata");
  }
  return preserveRecipeContributions(a, {
    ...a, contributions: b.contributions,
    selectedProduct: a.selectedProduct || b.selectedProduct || a.selectedProduct,
  });
}
