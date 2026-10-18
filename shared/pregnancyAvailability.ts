/** Temporary customer-availability pause. Does not change plans or saved support. */
export const PREGNANCY_CUSTOMER_AVAILABLE: boolean = false;
export const PREGNANCY_PAUSE_MESSAGE =
  "My Perfect Pregnancy — Coming Soon in Clinical. Existing Pregnancy settings are preserved. Daily calorie and macro targets are not pregnancy-adjusted. Breastfeeding/postpartum-specific automated guidance is paused; follow your healthcare provider's advice.";

export function pregnancyRecommendationsPaused(context?: {
  active?: boolean;
  stage?: string;
  isBreastfeeding?: boolean;
} | null): boolean {
  return !PREGNANCY_CUSTOMER_AVAILABLE && !!context?.active &&
    (context.stage === "breastfeeding" || context.stage === "postpartum" || context.isBreastfeeding === true);
}

export function assertPregnancyRecommendationsAvailable(
  context: Parameters<typeof pregnancyRecommendationsPaused>[0],
): void {
  if (pregnancyRecommendationsPaused(context)) {
    throw Object.assign(new Error(PREGNANCY_PAUSE_MESSAGE), {
      code: "pregnancy_recommendations_paused", status: 503, statusCode: 503,
    });
  }
}

/** Keep the approved pause explanation intact through generic generator catches. */
export function isPregnancyRecommendationPause(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "code" in error && error.code === "pregnancy_recommendations_paused";
}

/** Omission in an unrelated health edit must never silently remove saved support. */
export function retainPregnancySupport(requested: string[], stored: string[]): string[] {
  if (PREGNANCY_CUSTOMER_AVAILABLE) return requested;
  if (requested.includes("pregnancy-support") && !stored.includes("pregnancy-support")) {
    throw new Error(PREGNANCY_PAUSE_MESSAGE);
  }
  return stored.includes("pregnancy-support")
    ? Array.from(new Set([...requested, "pregnancy-support"]))
    : requested;
}
