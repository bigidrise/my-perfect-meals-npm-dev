import type { ProductCandidate } from "../../../shared/productCandidateContract";

/** No flavor, processing, negation, size or variant words may be silently dropped. */
function identityTerms(value: string): string[] {
  return [...new Set(value.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f'’]/g, "")
    .replace(/(\d)([a-z])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2")
    .match(/[a-z0-9]+/g) ?? [])].sort();
}

/**
 * Relevance may find a candidate, but only an exact, unambiguous named variant
 * may inherit the recommendation's action. This never awards profile eligibility.
 */
export function shoppingRecommendationIdentityMatches(
  recommendation: string, candidate: ProductCandidate,
): boolean {
  if (candidate.identity.match !== "exact_variant" || !candidate.identity.brand.trim() ||
    !candidate.identity.name.trim() || !candidate.identity.variant.trim()) return false;
  const recommended = identityTerms(recommendation);
  const exact = identityTerms([
    candidate.identity.brand, candidate.identity.name, candidate.identity.variant,
    candidate.identity.packageSize ?? "",
  ].join(" "));
  return recommended.length > 1 && recommended.join("|") === exact.join("|");
}
