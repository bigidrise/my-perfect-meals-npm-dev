export function dessertRecipeServings(meal: any): number {
  // `servings` is the recipe's authoritative yield. totalSlices is descriptive
  // metadata and must never silently replace a server-provided serving count.
  const count = meal?.servings ?? meal?.servingCount ?? meal?.totalSlices;
  return typeof count === "number" && Number.isInteger(count) && count > 0 ? count : 1;
}

export function dessertFavoritePayload(meal: any) {
  return { ...meal, servings: dessertRecipeServings(meal) };
}

/** Safe, Dessert-only copy; do not echo server findings or exception text. */
export function dessertFailureCopy(status?: number, data?: any) {
  const nutritionFailure = data?.code === "DESSERT_NUTRITION_UNVERIFIED" ||
    (Array.isArray(data?.findings) && data.findings.some((finding: any) =>
      ["final_nutrition_invalid", "final_serving_mismatch"].includes(finding?.code)));
  if (nutritionFailure) return {
    show: true,
    message: "We couldn't verify the nutrition for this dessert and its serving count, so we haven't shown the recipe. Your dessert request and dietary choices are unchanged.",
    suggestedActions: ["Specify plain ingredients and exact measurements, preferably grams. Nutrition sources may also be temporarily unavailable."],
  };
  if (status === 401 || status === 403) return {
    show: true,
    message: status === 401
      ? "Your session has expired. Sign in again to create your dessert."
      : "Your account access couldn't be confirmed for Dessert Creator. Check your subscription or account access.",
    suggestedActions: [],
  };
  if (status == null) return {
    show: true,
    message: "We couldn't connect to Dessert Creator. Check your connection and try again.",
    suggestedActions: [],
  };
  if (status === 409 || status === 422) return {
    show: true,
    message: "We couldn't verify this dessert against your current dietary and safety requirements. Your settings have been preserved.",
    suggestedActions: ["Try again to generate a different version"],
  };
  return {
    show: true,
    message: "Dessert Creator couldn't finish this request. Please try again.",
    suggestedActions: [],
  };
}
