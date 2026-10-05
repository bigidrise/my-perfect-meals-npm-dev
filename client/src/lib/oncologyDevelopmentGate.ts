import { oncologyDevelopmentReviewAllowed } from "@shared/oncologyDevelopmentGate";

// Keep Vite-only configuration separate from testable domain helpers.
export function oncologyDevelopmentReviewEnabled(): boolean {
  return oncologyDevelopmentReviewAllowed({
    developmentRuntime: import.meta.env.DEV && !import.meta.env.PROD,
    publishedRuntime: import.meta.env.PROD,
    productionProject: import.meta.env.VITE_IS_PRODUCTION_PROJECT === "true",
    explicitDevelopmentReview: import.meta.env.VITE_ONCOLOGY_DEVELOPMENT_REVIEW_ENABLED === "true",
  });
}
