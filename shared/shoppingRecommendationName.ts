/** Name binding for shopping intent only; never product/clinical verification. */
export function shoppingRecommendationNamesProduct(
  recommendation: string,
  product: { name: string; brand?: string; variant?: string },
): boolean {
  const terms = (text: string) => [...new Set(text.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f'’]/g, "")
    .replace(/(\d)([a-z])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2")
    .match(/[a-z0-9]+/g) ?? [])].sort().join("|");
  if (!product.brand?.trim() || !product.name.trim()) return false;
  const requested = terms(recommendation);
  // Only package/unspecified variant may be absent from the suggestion. Never
  // accept a substring: avocado oil is not buffalo sauce made with avocado oil.
  return requested === terms(`${product.brand} ${product.name}`) ||
    (!!product.variant?.trim() && requested === terms(`${product.brand} ${product.name} ${product.variant}`));
}
