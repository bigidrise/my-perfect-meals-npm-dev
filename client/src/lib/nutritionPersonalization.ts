/**
 * nutritionPersonalization.ts
 *
 * Shared client-side utilities for mapping user profile data to
 * human-readable protocol and diet labels.
 *
 * Extracted from ProtocolVisibilityPanel.tsx so both the dashboard
 * NutritionPersonalizationSummaryCard and meal-level panels share the same maps.
 */

export interface ProtocolEntry {
  outcomeLabel: string;
  displayLabel: string;
  level: "high" | "moderate";
}

export const PROTOCOL_MAP: Record<string, ProtocolEntry> = {
  diabetes:                { outcomeLabel: "Blood Glucose",         displayLabel: "Diabetes Support",       level: "high" },
  diabetic:                { outcomeLabel: "Blood Glucose",         displayLabel: "Diabetes Support",       level: "high" },
  "diabetes-type1":        { outcomeLabel: "Blood Glucose",         displayLabel: "Diabetes Support",       level: "high" },
  "diabetes-type2":        { outcomeLabel: "Blood Glucose",         displayLabel: "Diabetes Support",       level: "high" },
  prediabetes:             { outcomeLabel: "Blood Glucose",         displayLabel: "Prediabetes Support",    level: "high" },
  "glp-1":                 { outcomeLabel: "Metabolic Support",     displayLabel: "GLP-1 Protocol",         level: "high" },
  glp1:                    { outcomeLabel: "Metabolic Support",     displayLabel: "GLP-1 Protocol",         level: "high" },
  semaglutide:             { outcomeLabel: "Metabolic Support",     displayLabel: "GLP-1 Protocol",         level: "high" },
  ozempic:                 { outcomeLabel: "Metabolic Support",     displayLabel: "GLP-1 Protocol",         level: "high" },
  wegovy:                  { outcomeLabel: "Metabolic Support",     displayLabel: "GLP-1 Protocol",         level: "high" },
  mounjaro:                { outcomeLabel: "Metabolic Support",     displayLabel: "GLP-1 Protocol",         level: "high" },
  tirzepatide:             { outcomeLabel: "Metabolic Support",     displayLabel: "GLP-1 Protocol",         level: "high" },
  "anti-inflammatory":     { outcomeLabel: "Anti-Inflammatory",     displayLabel: "Anti-Inflammatory Diet", level: "high" },
  "anti_inflammatory":     { outcomeLabel: "Anti-Inflammatory",     displayLabel: "Anti-Inflammatory Diet", level: "high" },
  arthritis:               { outcomeLabel: "Anti-Inflammatory",     displayLabel: "Anti-Inflammatory Diet", level: "high" },
  "rheumatoid arthritis":  { outcomeLabel: "Anti-Inflammatory",     displayLabel: "Anti-Inflammatory Diet", level: "high" },
  autoimmune:              { outcomeLabel: "Anti-Inflammatory",     displayLabel: "Anti-Inflammatory Diet", level: "high" },
  cardiac:                 { outcomeLabel: "Sodium Control",        displayLabel: "Cardiac Support",        level: "high" },
  "heart disease":         { outcomeLabel: "Sodium Control",        displayLabel: "Cardiac Support",        level: "high" },
  "heart-disease":         { outcomeLabel: "Sodium Control",        displayLabel: "Cardiac Support",        level: "high" },
  hypertension:            { outcomeLabel: "Sodium Control",        displayLabel: "Cardiac Support",        level: "high" },
  "high blood pressure":   { outcomeLabel: "Sodium Control",        displayLabel: "Cardiac Support",        level: "high" },
  renal:                   { outcomeLabel: "Kidney-Safe Filtering", displayLabel: "Renal Support",          level: "high" },
  "kidney disease":        { outcomeLabel: "Kidney-Safe Filtering", displayLabel: "Renal Support",          level: "high" },
  "kidney-disease":        { outcomeLabel: "Kidney-Safe Filtering", displayLabel: "Renal Support",          level: "high" },
  ckd:                     { outcomeLabel: "Kidney-Safe Filtering", displayLabel: "Renal Support",          level: "high" },
  oncology:                { outcomeLabel: "Oncology Protocol",     displayLabel: "Oncology Protocol",      level: "high" },
  cancer:                  { outcomeLabel: "Oncology Protocol",     displayLabel: "Oncology Protocol",      level: "high" },
  "oncology-support":      { outcomeLabel: "Oncology Protocol",     displayLabel: "Oncology Protocol",      level: "high" },
  "thyroid-support":       { outcomeLabel: "Thyroid Support",       displayLabel: "Thyroid Support",        level: "moderate" },
  thyroid:                 { outcomeLabel: "Thyroid Support",       displayLabel: "Thyroid Support",        level: "moderate" },
  hashimotos:              { outcomeLabel: "Thyroid Support",       displayLabel: "Hashimoto's Support",    level: "moderate" },
  hypothyroid:             { outcomeLabel: "Thyroid Support",       displayLabel: "Hypothyroid Support",    level: "moderate" },
  hyperthyroid:            { outcomeLabel: "Thyroid Support",       displayLabel: "Hyperthyroid Support",   level: "moderate" },
  "hormone-optimization":  { outcomeLabel: "Hormone Balance",       displayLabel: "Hormone Optimization",   level: "moderate" },
  hormone:                 { outcomeLabel: "Hormone Balance",       displayLabel: "Hormone Optimization",   level: "moderate" },
  menopause:               { outcomeLabel: "Menopause Support",     displayLabel: "Menopause Support",      level: "moderate" },
  perimenopause:           { outcomeLabel: "Menopause Support",     displayLabel: "Perimenopause Support",  level: "moderate" },
  "metabolic-recovery":    { outcomeLabel: "Metabolic Support",     displayLabel: "Metabolic Recovery",     level: "moderate" },
  "liver-disease":         { outcomeLabel: "Liver Support",         displayLabel: "Liver Support",          level: "moderate" },
  "liver-support":         { outcomeLabel: "Liver Support",         displayLabel: "Liver Support",          level: "moderate" },
  nafld:                   { outcomeLabel: "Liver Support",         displayLabel: "Liver Support",          level: "moderate" },
  cholesterol:             { outcomeLabel: "Cholesterol Support",   displayLabel: "Cholesterol Support",    level: "moderate" },
  "high cholesterol":      { outcomeLabel: "Cholesterol Support",   displayLabel: "Cholesterol Support",    level: "moderate" },
  gout:                    { outcomeLabel: "Uric Acid Management",  displayLabel: "Gout Support",           level: "moderate" },
  "pregnancy-support":     { outcomeLabel: "Prenatal Nutrition",    displayLabel: "Pregnancy Nutrition",    level: "high" },
  "performance-nutrition": { outcomeLabel: "Athletic Performance",  displayLabel: "Performance Nutrition",  level: "moderate" },
  "competition-prep":      { outcomeLabel: "Competition Prep",      displayLabel: "Competition Prep",       level: "moderate" },
  // Alpha-gal Syndrome — clinical allergy; joins the same system as Cardiac/Renal/Diabetes
  "alpha-gal-syndrome":    { outcomeLabel: "Allergy-Safe Meals",    displayLabel: "Alpha-gal Protocol",     level: "high" },
  "alpha-gal syndrome":    { outcomeLabel: "Allergy-Safe Meals",    displayLabel: "Alpha-gal Protocol",     level: "high" },
  "alpha-gal":             { outcomeLabel: "Allergy-Safe Meals",    displayLabel: "Alpha-gal Protocol",     level: "high" },
};

export const DIET_MAP: Record<string, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  pescatarian: "Pescatarian",
  keto: "Ketogenic",
  "low-carb": "Low-Carb",
  paleo: "Paleo",
  "gluten-free": "Gluten-Free",
  "dairy-free": "Dairy-Free",
  halal: "Halal",
  kosher: "Kosher",
  carnivore: "Carnivore",
  mediterranean: "Mediterranean",
};

export function getActiveProtocols(user: any): ProtocolEntry[] {
  const seenLabel = new Set<string>();
  const results: ProtocolEntry[] = [];

  const checkSlug = (slug: string) => {
    if (!slug) return;
    const normalized = slug.toLowerCase().trim();
    const match = PROTOCOL_MAP[normalized];
    if (match && !seenLabel.has(match.displayLabel)) {
      seenLabel.add(match.displayLabel);
      results.push(match);
    }
  };

  if (user?.specialtyCondition) checkSlug(user.specialtyCondition);
  if (Array.isArray(user?.specialtyConditions)) user.specialtyConditions.forEach(checkSlug);
  if (Array.isArray(user?.medicalConditions)) user.medicalConditions.forEach(checkSlug);
  if (Array.isArray(user?.healthConditions)) user.healthConditions.forEach(checkSlug);
  if (user?.thyroidType) checkSlug(user.thyroidType);
  // Alpha-gal is stored as a dedicated alphaGalProfile object (not in specialtyConditions),
  // so it must be detected here to appear in the "Built using → Alpha-gal Protocol" row
  // on generated meals. Any non-null profile means the condition is active.
  if (user?.alphaGalProfile) checkSlug("alpha-gal-syndrome");
  if (user?.oncologySupportContext && !seenLabel.has("Oncology Protocol")) {
    seenLabel.add("Oncology Protocol");
    results.push({ outcomeLabel: "Oncology Protocol", displayLabel: "Oncology Protocol", level: "high" });
  }

  return results;
}

/**
 * Convert the user's active protocols into ProtocolBadge objects for BuilderHeader.
 *
 * This is the SINGLE shared converter used by every meal builder so future protocols
 * added to PROTOCOL_MAP automatically appear in every builder's Active Protocol row
 * without touching each builder individually.
 *
 * Color scheme mirrors the builder gradient theme:
 *   "high"     → orange  (clinical hard limits: diabetes, cardiac, renal, alpha-gal, etc.)
 *   "moderate" → amber   (supportive: thyroid, menopause, performance, metabolic, etc.)
 */
export function getBuilderProtocolBadges(
  user: any
): Array<{ label: string; cls: string }> {
  return getActiveProtocols(user).map((entry) => ({
    label: entry.displayLabel,
    cls:
      entry.level === "high"
        ? "bg-orange-600 text-white"
        : "bg-amber-500 text-white",
  }));
}

export function getActiveDiets(user: any): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  const checkDiet = (d: string) => {
    if (!d) return;
    const label = DIET_MAP[d.toLowerCase().trim()];
    if (label && !seen.has(label)) {
      seen.add(label);
      results.push(label);
    }
  };

  if (Array.isArray(user?.dietaryRestrictions)) user.dietaryRestrictions.forEach(checkDiet);
  if (user?.dietType) checkDiet(user.dietType);

  return results;
}

export function getMacroSummary(user: any): string | null {
  const cal = user?.dailyCalorieTarget;
  const prot = user?.dailyProteinTarget;
  if (!cal && !prot) return null;
  const parts: string[] = [];
  if (cal) parts.push(`${cal} cal/day`);
  if (prot) parts.push(`${prot}g protein`);
  return parts.join(" · ");
}
