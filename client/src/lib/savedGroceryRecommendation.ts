import type { BetterAlternative } from "@/lib/photoIngredientCapture";

export interface GroceryProductIdentity {
  productName: string;
  brand?: string | null;
}

/** Keep the supplied name verbatim; never infer a brand by splitting AI prose. */
export function recommendationIdentity(alternative: BetterAlternative): GroceryProductIdentity {
  return {
    productName: alternative.productName?.trim() || alternative.category.trim(),
    brand: alternative.brand?.trim() || undefined,
  };
}

export function groceryProductLabel(product: GroceryProductIdentity): string {
  const name = product.productName.trim();
  const brand = product.brand?.trim();
  return !brand || name.toLocaleLowerCase().startsWith(`${brand.toLocaleLowerCase()} `)
    || name.toLocaleLowerCase() === brand.toLocaleLowerCase()
    ? name : `${brand} ${name}`;
}

export function recommendationProductKey(product: GroceryProductIdentity): string {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `name::${normalize(product.brand || "")}::${normalize(product.productName)}`;
}

export function recommendationSavePayload(
  alternative: BetterAlternative,
  context: { query: string; educationalFooter: string },
) {
  return {
    ...recommendationIdentity(alternative),
    source: "grocery-coach",
    category: context.query,
    productMeta: {
      // These are the alternative's claims, not the analyzed product's grade,
      // ingredients, barcode, or nutrition. Saving does not verify a product.
      recommendationWhyBetter: [...alternative.whyBetter],
      recommendationTargetCriteria: alternative.targetCriteria,
      educationalFooter: context.educationalFooter,
      evidenceStatus: "unverified",
      verificationMessage: context.educationalFooter,
      analysisMethod: "by_name",
    },
  };
}

export interface SavedRecommendationMetadata {
  recommendationWhyBetter?: unknown;
  recommendationTargetCriteria?: unknown;
  educationalFooter?: unknown;
}

export function savedRecommendationDetails(meta: SavedRecommendationMetadata) {
  if (!Array.isArray(meta.recommendationWhyBetter)) return {};
  const reasons = meta.recommendationWhyBetter.filter((value): value is string => typeof value === "string");
  const criteria = typeof meta.recommendationTargetCriteria === "string"
    ? meta.recommendationTargetCriteria : "";
  return {
    overallSummary: reasons.join(" "),
    ingredientConsiderations: [...reasons, ...(criteria ? [criteria] : [])],
    educationalFooter: typeof meta.educationalFooter === "string" ? meta.educationalFooter : "",
    gradeUnavailable: true,
    fallbackUsed: true,
  };
}
