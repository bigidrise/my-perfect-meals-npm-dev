const USER_SAFE_CREATE_DISH_ERROR_CODES = new Set([
  "HUMAN_FOOD_CONTEXT_UNRESOLVED",
  "HUMAN_FOOD_FINAL_REVIEW_REQUIRED",
  "HUMAN_FOOD_FINAL_VALIDATION_FAILED",
  "HUMAN_FOOD_CONTEXT_VALIDATION_FAILED",
  "glp1_context_unavailable",
  "glp1_validation_unavailable",
  "glp1_compliance_retry_exhausted",
  "create_dish_intent_not_preserved",
]);

export function getCreateDishServerErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const response = data as {
    code?: unknown;
    reasonCode?: unknown;
    message?: unknown;
    outcome?: {
      type?: unknown;
      explanation?: unknown;
    };
  };
  if (
    (response.outcome?.type === "REQUEST_BLOCKED_WITH_REASON" ||
      response.outcome?.type === "REVIEW_REQUIRED_WITH_REASON") &&
    typeof response.outcome.explanation === "string"
  ) {
    const explanation = response.outcome.explanation.trim();
    if (explanation.length > 0 && explanation.length <= 500) {
      return explanation;
    }
  }

  const code =
    typeof response.code === "string"
      ? response.code
      : typeof response.reasonCode === "string"
        ? response.reasonCode
        : null;

  if (
    !code ||
    !USER_SAFE_CREATE_DISH_ERROR_CODES.has(code) ||
    typeof response.message !== "string"
  ) {
    return null;
  }

  const message = response.message.trim();
  return message.length > 0 && message.length <= 500 ? message : null;
}