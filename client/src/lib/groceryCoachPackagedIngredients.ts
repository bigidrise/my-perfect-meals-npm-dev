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
export function packagedProductEligibility(
  item: string,
  options: { surface?: "smart_shopping" } = {},
): {
  eligible: boolean;
  reason: "packaged_product" | "ordinary_or_unknown";
} {
  const name = item.trim().toLowerCase();
  const excluded = /\b(homemade|home-made|from scratch|spaghetti squash|fresh tomatoes?|cherry tomatoes?|cucumbers?|lemons?|mixed greens|chicken breast|ground turkey)\b/.test(name);
  const packaged = /\b(sauce|marinara|pasta|spaghetti|noodles|parmesan|cheese|yogurt|bread|tortillas?|crackers?|cereal|broth|stock|tofu|plant-based milk|almond milk|soy milk|oat milk|salad dressing)\b/.test(name)
    || /^(?:plain\s+)?milk$/.test(name);
  // Opt in only on Smart Shopping; other product workflows keep their existing
  // recognition. This controls a lookup affordance, never product suitability.
  const smartShopping = options.surface === "smart_shopping";
  const freshOrHomemade = smartShopping &&
    /\b(fresh|raw|home[\s-]?made|from scratch)\b/.test(name);
  const additionalPackaged = smartShopping && (
    /\b(oatmeal|oats|seasonings?|spices?|spice blends?|spice mixes?|salt|black pepper|ground pepper|paprika|cumin|cinnamon|chili powder|garlic powder|onion powder|dried herbs?|dried oregano|dried basil|condiments?|ketchup|mustard|mayonnaise|mayo|relish|salsa|vinegar|tamari|honey|maple syrup|peanut butter|nut butter|jam|jelly|preserves)\b/.test(name) ||
    /\b(cooking|olive|avocado|canola|sunflower|safflower|sesame|vegetable|coconut|peanut|grapeseed|corn|soybean)\s+oils?\b/.test(name) ||
    /^oils?$/.test(name) ||
    /\b(canned|tinned|jarred)\s+(?:(?:black|kidney|pinto|white|navy|green|baked|refried|garbanzo|diced|crushed|whole|sliced|organic|low[- ]sodium|no[- ]salt[- ]added)\s+)*(?:beans?|chickpeas?|lentils?|tomatoes?|tomato paste|corn|peas|carrots?|pumpkin|tuna|salmon|sardines?|anchovies?|peaches?|pears?|pineapple|applesauce|coconut milk)\b/.test(name)
  );
  return !excluded && !freshOrHomemade && (packaged || additionalPackaged)
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
