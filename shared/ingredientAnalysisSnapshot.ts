/** Shared completeness check, not a new analysis or verification policy. */
export function isCompleteIngredientAnalysis(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return !result.fallbackUsed && !result.isFrontLabel &&
    typeof result.overallSummary === "string" && !!result.overallSummary.trim() &&
    typeof result.verdict === "string" && !!result.verdict.trim() &&
    Array.isArray(result.betterAlternatives) &&
    ["by_name", "by_label", "full_product_advisor"].includes(String(result.analysisMethod));
}
