export interface GroceryIngredient {
  item: string;
  quantity: string;
  unit: string;
}

/**
 * Conservative discovery eligibility, NOT a nutrition or safety verdict.
 * Unknown names stay ordinary ingredients; categories never grant eligibility.
 * Keep this independent of generation so restored meals work without rewriting them.
 */
export function packagedProductEligibility(item: string): {
  eligible: boolean;
  reason: "packaged_product" | "ordinary_or_unknown";
} {
  const name = item.trim().toLowerCase();
  const excluded = /\b(homemade|home-made|from scratch|spaghetti squash|fresh tomatoes?|cherry tomatoes?|cucumbers?|lemons?|mixed greens|chicken breast|ground turkey)\b/.test(name);
  const packaged = /\b(sauce|marinara|pasta|spaghetti|noodles|parmesan|cheese|yogurt|bread|tortillas?|crackers?|cereal|broth|stock|tofu|plant-based milk|almond milk|soy milk|oat milk|salad dressing)\b/.test(name)
    || /^(?:plain\s+)?milk$/.test(name);
  return !excluded && packaged
    ? { eligible: true, reason: "packaged_product" }
    : { eligible: false, reason: "ordinary_or_unknown" };
}

export function catalogProductLabel(product: { brand: string; name: string }): string {
  return product.name.toLowerCase().startsWith(product.brand.toLowerCase())
    ? product.name : `${product.brand} ${product.name}`;
}

/** Exact recipe quantities only. Never turn a range or "to taste" into a package count. */
export function recipeShoppingQuantity(raw: string): number | null {
  const text = raw.trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const amount = Number(text);
    return amount > 0 && Number.isFinite(amount) ? amount : null;
  }
  const fraction = text.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  if (fraction && Number(fraction[3]) > 0) {
    const amount = Number(fraction[1] || 0) + Number(fraction[2]) / Number(fraction[3]);
    return amount > 0 ? amount : null;
  }
  const unicode = text.match(/^(\d*)\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (unicode) {
    const parts: Record<string, number> = { "¼": .25, "½": .5, "¾": .75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": .125, "⅜": .375, "⅝": .625, "⅞": .875 };
    return Number(unicode[1] || 0) + parts[unicode[2]];
  }
  return null;
}
