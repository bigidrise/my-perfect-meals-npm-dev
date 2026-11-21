/** Culinary relevance only. This never verifies identity, evidence or safety. */
export function shoppingCatalogPreservesIntent(
  query: string, product: { name: string; variant?: string },
): boolean {
  const normalize = (text: string) => text.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const requested = normalize(query);
  const name = normalize(product.name);
  if (!requested || !name) return false;
  // Search indexes include foods merely containing the ingredient. An oil
  // search must not offer buffalo sauce, mayonnaise, chips or an oil spray.
  if (/\boil\b/.test(requested) &&
      /\b(sauce|mayonnaise|mayo|dressing|chips|crackers|popcorn|spray)\b/.test(name)) return false;
  if (/\b(oatmeal|oats)\b/.test(requested) &&
      /\b(cookies?|bars?|granola|flour|yogurt|yoghurt)\b/.test(name)) return false;
  if (/\b(yogurt|yoghurt)\b/.test(requested) &&
      /\b(coated|cookies?|bars?|dressing|candy|pretzels)\b/.test(name)) return false;
  if (/\btomato sauce\b/.test(requested) &&
      /\b(soup|ketchup|juice|chips)\b/.test(name)) return false;
  const aliases = (text: string) => text.replace(/\byoghurt\b/g, "yogurt")
    .replace(/\brolled oats\b|\boatmeal\b/g, "oats")
    .replace(/\bseasonings\b|\bseasoned salt\b/g, "seasoning")
    .replace(/\bmarinara\b/g, "tomato sauce");
  const terms = aliases(requested).split(" ").filter(term =>
    // Packaging words need not be repeated in the catalog's product name.
    !["canned", "packaged", "brand", "branded"].includes(term));
  const identity = new Set(aliases(name).split(" "));
  return terms.length > 0 && terms.every(term => identity.has(term));
}
