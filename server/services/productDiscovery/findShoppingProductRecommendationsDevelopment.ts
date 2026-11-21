import type { IngredientScanResult } from "../ingredientScanService";
import { canonicalShoppingIngredient, type ShoppingIngredientRequest } from "../../../shared/shoppingProductSelection";
import { findProductDevelopment } from "./findProductDevelopment";
import type { ShoppingLookupStage } from "./shoppingEvidenceAdapter";
import type { ShoppingRecommendationVerification } from "../../../shared/shoppingRecommendationVerification";
import { boundedProductNames, developmentGroceryChoiceStore, groceryChoiceKey } from "../groceryChoiceMemory";

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
    findNewOptions?: boolean;
  } = {},
) {
  // Released Shopping Product Options uses this same governed pipeline in every
  // runtime. The historical function name does not imply a release restriction.
  const ingredient = canonicalShoppingIngredient(input);
  const started = performance.now();
  const recommend = options.recommend ?? (async (name, owner) =>
    (await import("../ingredientScanService")).analyzeProductByName(name, owner, {
      ingredient, findNewOptions: options.findNewOptions,
    }));
  const analysis = await recommend(ingredient.originalName, userId);
  const recommendationMs = performance.now() - started;
  if (analysis.analysisMethod !== "by_name" || analysis.fallbackUsed ||
      !Array.isArray(analysis.betterAlternatives) || !analysis.betterAlternatives.some(
        alternative => typeof alternative?.category === "string" && alternative.category.trim(),
      )) {
    // A provider failure says nothing about catalog availability or dietary fit.
    // Discover exact products through the existing governed path instead; all
    // current profile, evidence, reference and selection checks still run.
    if (analysis.failureReason === "unsupported_medical_claim") {
      console.warn("[ShoppingProductLookup]", { stage: "recommendation", reason: "unsupported_medical_claim", next: "governed_catalog" });
    }
    const store = await developmentGroceryChoiceStore();
    const memory = store ? await store.read(userId, groceryChoiceKey(ingredient.originalName, ingredient), ingredient.originalName) : null;
    const rememberedLeads = memory && !options.findNewOptions ? boundedProductNames([
      ...(memory.preferredName ? [memory.preferredName] : []), ...memory.shownNames,
    ]).filter(name => name.length <= 80) : [];
    const result = await findProductDevelopment(userId, ingredient.originalName, {
      ...options.discoveryOptions, shoppingIngredient: ingredient,
      ...(rememberedLeads.length ? { recommendationLeads: rememberedLeads } : {}),
    });
    return {
      ...result,
      recommendationNotice: "Personalized explanations are temporarily unavailable. These catalog options use the existing product checks; review the current package label.",
    };
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
    catalogSearchAvailable: true, unresolved: [], profileUsed: [], excludedRecommendationLeads: [],
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
  }).sort((a, b) => (Number(b.shoppingSelection?.eligible === true) * 2 + Number(!!b.shoppingReference)) -
    (Number(a.shoppingSelection?.eligible === true) * 2 + Number(!!a.shoppingReference)))
    .slice(0, 3);
  const excluded = new Set(result.excludedRecommendationLeads ?? []);
  const visibleRecommendations = recommendations.filter(alt => !excluded.has(alt.category.trim()));
  const recommendationChecks: ShoppingRecommendationVerification[] = visibleRecommendations.map(alt => {
    const category = alt.category.trim();
    const exactMatches = catalogMatches.filter(match => match.recommendationLead === category);
    const eligible = exactMatches.find(match => match.shoppingSelection?.eligible);
    if (eligible) return {
      recommendationCategory: category, status: "eligible",
      productKey: eligible.productKey, catalogProductKey: eligible.productKey,
      reason: "This exact catalog product passed the existing Shopping selection checks. Check the current package label before buying.",
    };
    return {
      recommendationCategory: category, status: "review_only",
      ...(exactMatches[0] ? { catalogProductKey: exactMatches[0].productKey } : {}),
      ...(exactMatches[0]?.recommendationIdentityVerified && exactMatches[0]?.shoppingReference
        ? { reference: exactMatches[0].shoppingReference } : {}),
      reason: category.length > 80
        ? "The recommendation exceeds the exact-product lookup limit. Its identity and suitability have not been verified."
        : !result.catalogSearchAvailable
          ? "The product catalog is temporarily unavailable. This recommendation has not been verified and cannot be selected."
          : exactMatches[0]?.shoppingSelection?.reason ||
            "An exact catalog product with all required product information could not be verified. This recommendation cannot be selected.",
    };
  });
  const timing = {
    recommendationMs: Math.round(recommendationMs),
    catalogMs: Math.round(performance.now() - catalogStarted),
    totalMs: Math.round(performance.now() - started),
    stageWorkMs: Object.fromEntries(Object.entries(workMs).map(([stage, ms]) => [stage, Math.round(ms)])),
  };
  return {
    ...result, catalogMatches, recommendationCount: recommendations.length,
    recommendations: visibleRecommendations,
    recommendationChecks,
    recommendationContext: {
      query: ingredient.originalName, educationalFooter: analysis.educationalFooter ?? "",
      verdictLevel: analysis.verdictLevel ?? "caution",
    },
    recommendationNotice: recommendations.length && !catalogMatches.some(match => match.shoppingSelection?.eligible)
      ? result.excludedReasons.length && !catalogMatches.length
        ? "Catalog products were excluded for a known conflict with your food requirements. No eligible replacement was verified; your ingredient and saved choice are unchanged."
        : catalogMatches.some(match => match.shoppingReference)
          ? "These exact products can be saved as unverified shopping references only. Their suitability is not cleared; all unresolved warnings remain. Your recipe quantities stay unchanged."
          : "Personalized recommendations were found, but their exact products or required checks could not be fully verified. Your ingredient and saved choice are unchanged."
      : !recommendations.length ? "Find a Product could not identify supported branded recommendations for this ingredient." : "",
    lookupTiming: timing,
  };
}
