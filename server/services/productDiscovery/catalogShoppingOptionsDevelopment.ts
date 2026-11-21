import type { ShoppingIngredientRequest } from "../../../shared/shoppingProductSelection";
import type { ShoppingRecommendationVerification } from "../../../shared/shoppingRecommendationVerification";
import { findProductDevelopment } from "./findProductDevelopment";

type DiscoveryOptions = Pick<NonNullable<Parameters<typeof findProductDevelopment>[2]>,
  "sources" | "adapter" | "fallbackAdapter">;

/** Build cards from evaluated exact records, never invent a catalog for AI names. */
export async function catalogShoppingOptionsDevelopment(
  userId: string, ingredient: ShoppingIngredientRequest, options?: DiscoveryOptions,
) {
  const result = await findProductDevelopment(userId, ingredient.originalName, {
    ...options, shoppingIngredient: ingredient, catalogFirstShopping: true,
  });
  const seen = new Set<string>();
  const catalogMatches = result.catalogMatches.filter(match => {
    const supported = match.shoppingDisplay !== "hidden" &&
      (match.shoppingSelection?.eligible === true || !!match.shoppingReference);
    const label = `${match.brand} ${match.name}`.toLowerCase().trim();
    if (!supported || seen.has(label)) return false;
    seen.add(label);
    return true;
  }).slice(0, 3).map(match => {
    const category = match.name.toLowerCase().startsWith(match.brand.toLowerCase())
      ? match.name : `${match.brand} ${match.name}`;
    return {
      ...match, recommendationLead: category,
      // The displayed name was taken from this very record, not matched to an
      // AI suggestion. Eligibility still comes exclusively from the bridge.
      recommendationIdentityVerified: match.shoppingSelection?.eligible === true,
    };
  });
  const recommendations = catalogMatches.map(match => ({
    category: match.recommendationLead, brand: match.brand, productName: match.name,
    whyBetter: [
      ...(match.ingredients ? [`Catalog ingredient declaration (${match.source}): ${match.ingredients.slice(0, 500)}`] : []),
      ...match.nutrition.slice(0, 2).map(fact => `Catalog nutrition (${match.source}): ${fact.statement}`),
    ],
    targetCriteria: "Retailer availability is not verified. Search for this exact brand and product.",
  }));
  const recommendationChecks: ShoppingRecommendationVerification[] = catalogMatches.map(match =>
    match.shoppingSelection?.eligible === true ? {
      recommendationCategory: match.recommendationLead, status: "eligible",
      productKey: match.productKey, catalogProductKey: match.productKey,
      reason: "This exact catalog product passed the existing Shopping selection checks.",
    } : {
      recommendationCategory: match.recommendationLead, status: "review_only",
      catalogProductKey: match.productKey, reference: match.shoppingReference,
      reason: "Product details not fully verified.",
    });
  return {
    ...result, catalogMatches, recommendations, recommendationChecks,
    recommendationCount: recommendations.length,
    recommendationContext: {
      query: ingredient.originalName, verdictLevel: "caution",
      educationalFooter: "Catalog information is not medical approval. Check the current package label.",
    },
    recommendationNotice: recommendations.length ? "" : result.catalogSearchAvailable
      ? "No identifiable product with a supported shopping action was found. Your ingredient and saved choice are unchanged."
      : "The product catalog is temporarily unavailable. Your ingredient and saved choice are unchanged.",
  };
}
