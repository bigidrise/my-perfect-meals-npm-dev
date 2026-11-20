import type { IngredientScanResult } from "../ingredientScanService";
import { canonicalShoppingIngredient, type ShoppingIngredientRequest } from "../../../shared/shoppingProductSelection";
import { findProductDevelopment } from "./findProductDevelopment";
import type { ShoppingLookupStage } from "./shoppingEvidenceAdapter";

/**
 * Compose existing Find a Product suggestions with existing Shopping evidence
 * checks. Recommendations and their explanations never become source evidence.
 */
export async function findShoppingProductRecommendationsDevelopment(
  userId: string,
  input: ShoppingIngredientRequest,
  options: {
    recommend?: (name: string, userId: string) => Promise<IngredientScanResult>;
    discoveryOptions?: Pick<NonNullable<Parameters<typeof findProductDevelopment>[2]>, "sources" | "adapter" | "fallbackAdapter">;
  } = {},
) {
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
    throw new Error("Shopping recommendation integration is Development-only.");
  }
  const ingredient = canonicalShoppingIngredient(input);
  const started = performance.now();
  const recommend = options.recommend ?? (async (name, owner) =>
    (await import("../ingredientScanService")).analyzeProductByName(name, owner));
  const analysis = await recommend(ingredient.originalName, userId);
  const recommendationMs = performance.now() - started;
  if (analysis.analysisMethod !== "by_name" || analysis.fallbackUsed) {
    throw new Error("Personalized product recommendations are temporarily unavailable.");
  }
  const recommendations = analysis.betterAlternatives
    .filter(alt => typeof alt.category === "string" && alt.category.trim())
    .filter((alt, index, all) => all.findIndex(other =>
      other.category.trim().toLowerCase() === alt.category.trim().toLowerCase()) === index)
    .slice(0, 3);
  const leads = recommendations.map(alt => alt.category.trim()).filter(name => name.length <= 80);
  const workMs: Record<ShoppingLookupStage, number> = {
    profile: 0, catalogSearch: 0, exactRecordWork: 0, enrichment: 0,
  };
  const catalogStarted = performance.now();
  const result = leads.length ? await findProductDevelopment(userId, ingredient.originalName, {
    ...options.discoveryOptions, shoppingIngredient: ingredient, recommendationLeads: leads,
    onStageTiming: (stage, milliseconds) => { workMs[stage] += milliseconds; },
  }) : {
    catalogMatches: [], searched: 0, rejected: 0, excludedReasons: [], sourceFailures: [],
    catalogSearchAvailable: true, unresolved: [], profileUsed: [],
  };
  const catalogMatches = result.catalogMatches.map(match => {
    const recommendation = recommendations.find(alt => alt.category.trim() === match.recommendationLead);
    return {
      ...match,
      ...(recommendation ? { recommendationExplanation: {
        whyBetter: recommendation.whyBetter, targetCriteria: recommendation.targetCriteria,
      } } : {}),
      ...(match.shoppingSelection?.eligible === false && match.shoppingSelection.reason
        ? { shoppingCaution: match.shoppingSelection.reason } : {}),
    };
  }).sort((a, b) => Number(b.shoppingSelection?.eligible === true) - Number(a.shoppingSelection?.eligible === true))
    .slice(0, 3);
  const timing = {
    recommendationMs: Math.round(recommendationMs),
    catalogMs: Math.round(performance.now() - catalogStarted),
    totalMs: Math.round(performance.now() - started),
    stageWorkMs: Object.fromEntries(Object.entries(workMs).map(([stage, ms]) => [stage, Math.round(ms)])),
  };
  return {
    ...result, catalogMatches, recommendationCount: recommendations.length,
    recommendationNotice: recommendations.length && !catalogMatches.some(match => match.shoppingSelection?.eligible)
      ? result.excludedReasons.length && !catalogMatches.length
        ? "Catalog products were excluded for a known conflict with your food requirements. No eligible replacement was verified; your ingredient and saved choice are unchanged."
        : "Personalized recommendations were found, but their exact products or required checks could not be fully verified. Your ingredient and saved choice are unchanged."
      : !recommendations.length ? "Find a Product could not identify supported branded recommendations for this ingredient." : "",
    lookupTiming: timing,
  };
}
