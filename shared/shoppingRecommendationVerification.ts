/** Recommendation claims stay separate from exact catalog evidence and selections. */
export interface ShoppingRecommendationVerification {
  recommendationCategory: string;
  status: "eligible" | "review_only";
  reason: string;
  /** References an independently verified catalogMatches entry, never an AI identity. */
  productKey?: string;
  /** Reviewable source record only; this field never grants selection eligibility. */
  catalogProductKey?: string;
}
