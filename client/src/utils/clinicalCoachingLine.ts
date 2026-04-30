/**
 * Derives the coaching confirmation line shown below every meal card.
 * Pass the builderType (clinical mode) or source string — order of checks matters.
 * Most-specific protocols first, anti-inflammatory last (it's the default mode).
 */
export function getClinicalCoachingLine(builderTypeOrSource?: string | null): string {
  const s = (builderTypeOrSource || "").toLowerCase();

  if (s.includes("oncolog") || s.includes("cancer")) {
    return "Built for your Cancer Support protocol — nutrient-dense, anti-inflammatory, no processed meats.";
  }
  if (s.includes("liver-disease") || s.includes("liver disease") || s.includes("liverdisease")) {
    return "Built for your Liver Disease protocol — low-fat, easy on the liver, no alcohol.";
  }
  if (s.includes("liver-support") || s.includes("liver support") || s.includes("liversupport") || s.includes("liver")) {
    return "Built for your Liver Support protocol — liver-nourishing, anti-inflammatory ingredients.";
  }
  if (s.includes("kidney") || s.includes("renal")) {
    return "Built for your Kidney Disease protocol — phosphorus and potassium aware.";
  }
  if (s.includes("cardiac") || s.includes("heart-failure") || s.includes("heart failure") || s.includes("heart health")) {
    return "Built for your Cardiac Health protocol — heart-healthy, low sodium.";
  }
  if (s.includes("glp1") || s.includes("glp-1")) {
    return "Built for your GLP-1 phase — small portion, protein-first, easy to digest.";
  }
  if (s.includes("diabet")) {
    return "Built to keep you within your glucose target range.";
  }
  if (s.includes("anti") || s.includes("inflam")) {
    return "Built around anti-inflammatory principles — whole foods, clean carbs, low-inflammatory fats.";
  }

  return "Built for your current plan and targets.";
}
