const VERIFICATION_FAILURE_CODES = new Set([
  "INGREDIENT_SANITY_RETRY_EXHAUSTED",
  "NUTRITION_PLAUSIBILITY_RETRY_EXHAUSTED",
  "glp1_compliance_retry_exhausted",
]);

/** Never return exception text, prompts, stack traces or profile data to clients. */
export function mealVerificationFailure(error: unknown, language = "en"): {
  success: false;
  source: "error";
  error: string;
  code: string;
  status: number;
  failureReason: "ingredient_measurement" | "nutrition_plausibility" | "glp1_requirements" | "verification";
} {
  const code = typeof error === "object" && error !== null && "code" in error &&
    typeof error.code === "string" && VERIFICATION_FAILURE_CODES.has(error.code)
    ? error.code : "RECIPE_VERIFICATION_FAILED";
  const failureReason = code === "INGREDIENT_SANITY_RETRY_EXHAUSTED" ? "ingredient_measurement"
    : code === "NUTRITION_PLAUSIBILITY_RETRY_EXHAUSTED" ? "nutrition_plausibility"
    : code === "glp1_compliance_retry_exhausted" ? "glp1_requirements" : "verification";
  const spanish = /^es(?:-|$)/i.test(language);
  const messages = spanish ? {
    ingredient_measurement: "Chef no pudo verificar las cantidades de los ingredientes. No se agregó ninguna comida. Inténtalo de nuevo.",
    nutrition_plausibility: "Chef no pudo verificar que la información nutricional coincida con las cantidades de la receta. No se agregó ninguna comida. Inténtalo de nuevo.",
    glp1_requirements: "Chef no pudo verificar una adaptación que cumpla tus requisitos actuales de GLP-1. No se agregó ninguna comida. Prueba otro tipo o cantidad de ingrediente, u otra preparación, sin cambiar tus límites.",
    verification: "Chef no pudo completar la verificación de la receta. No se agregó ninguna comida. Inténtalo de nuevo.",
  } : {
    ingredient_measurement: "Chef couldn't verify the ingredient quantities. No meal was added. Please try again.",
    nutrition_plausibility: "Chef couldn't verify that the nutrition matches the recipe quantities. No meal was added. Please try again.",
    glp1_requirements: "Chef couldn't verify an adaptation within your current GLP-1 requirements. No meal was added. Try another ingredient type or amount, or another preparation, without changing your limits.",
    verification: "Chef couldn't complete recipe verification safely. No meal was added. Please try again.",
  };
  return {
    success: false,
    source: "error",
    error: messages[failureReason],
    failureReason,
    code,
    status: code === "RECIPE_VERIFICATION_FAILED" ? 500 : 422,
  };
}
