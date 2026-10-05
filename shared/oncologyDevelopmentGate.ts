/** Oncology-only review eligibility. Never grants access in Production or a deployment. */
export function oncologyDevelopmentReviewAllowed(input: {
  developmentRuntime: boolean;
  publishedRuntime: boolean;
  productionProject: boolean;
  explicitDevelopmentReview: boolean;
}): boolean {
  return input.developmentRuntime && !input.publishedRuntime &&
    (!input.productionProject || input.explicitDevelopmentReview);
}
