const VERIFICATION_FAILURE_CODES = new Set([
  "INGREDIENT_SANITY_RETRY_EXHAUSTED",
  "NUTRITION_PLAUSIBILITY_RETRY_EXHAUSTED",
]);

/** Never return exception text, prompts, stack traces or profile data to clients. */
export function mealVerificationFailure(error: unknown): {
  success: false;
  source: "error";
  error: string;
  code: string;
  status: number;
} {
  const code = typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string" && VERIFICATION_FAILURE_CODES.has(error.code)
    ? error.code : "RECIPE_VERIFICATION_FAILED";
  return {
    success: false,
    source: "error",
    error: "Chef couldn't complete recipe verification safely. No meal was added. Please try again.",
    code,
    status: code === "RECIPE_VERIFICATION_FAILED" ? 500 : 422,
  };
}
