import { readOncologySupportSelection, type OncologySymptomSelection } from "../../../../shared/oncologySupportSelection";
import type { UserProtocolEnvelope } from "../../protocolEnvelope";
import { oncologySymptomPriorityEnabled, applyOncologySymptomPriority } from "./oncologySymptomPriority";
import { validateOncologyMealSafety } from "../validators/oncologySupportValidator";

type Context = Pick<UserProtocolEnvelope, "oncologySupportContext">;

/** Carry the authorized subject's record using the same gate as its consumers. */
export function projectOncologyRecommendationContext(
  record: Context["oncologySupportContext"],
): Context {
  return oncologySymptomPriorityEnabled() ? { oncologySupportContext: record ?? null } : {};
}

/** A projection of the existing record, never another settings store. */
export function recommendationOncologySymptoms(context?: Context): readonly OncologySymptomSelection[] {
  if (!oncologySymptomPriorityEnabled() || !context?.oncologySupportContext?.enabled) return [];
  return readOncologySupportSelection(context.oncologySupportContext).symptoms;
}

export function oncologyPracticalGuidance(context?: Context): string {
  const symptoms = recommendationOncologySymptoms(context);
  const guidance = [
    symptoms.includes("mouth_sensitivity") ? "Skip citrus, acidic or spicy flavoring; choose smooth, mild options." : "",
    symptoms.includes("nausea") ? "Choose gentler options, not greasy, heavily spiced or strongly aromatic drinks." : "",
    symptoms.includes("gi_sensitivity") ? "Avoid greasy additions and rough, very high-fiber add-ins; favor smooth, easily digestible options." : "",
    symptoms.includes("low_appetite") ? "Keep individual portions small and manageable, not oversized." : "",
    symptoms.includes("fatigue_low_prep") ? "Choose ready-to-sip or simple options without extra preparation or garnish steps." : "",
  ].filter(Boolean);
  return guidance.length ? `${guidance.join(" ")} Existing allergies, dietary restrictions and clinician instructions still take precedence.` : "";
}

export function adaptHydrationOption<T extends Record<string, unknown>>(option: T, context?: Context): T {
  const guidance = oncologyPracticalGuidance(context);
  if (!guidance) return option;
  return { ...option, description: `${String(option.description ?? "")} Current tolerance guidance: ${guidance}` };
}

/** Override only conflicting category defaults; the original protocol remains intact. */
export function oncologyBeverageCategoryRules(rules: string, context: Context): string {
  const symptoms = recommendationOncologySymptoms(context);
  if (!symptoms.length) return rules;
  let result = rules;
  if (symptoms.includes("gi_sensitivity")) {
    result = result.replace("- Suggest optional add-ins (chia seeds, flax, etc.)", "- Do not require seed or rough/high-fiber add-ins; use the existing digestive-tolerance guidance.");
  }
  if (symptoms.includes("nausea") || symptoms.includes("gi_sensitivity")) {
    result = result.replace("- Rich, indulgent, and satisfying", "- Keep the requested drink recognizable, using gentler, non-greasy ingredients.")
      .replace("- Include ice cream or frozen yogurt base", "- Use a tolerated base compatible with current restrictions; do not require a rich/high-fat base.");
  }
  if (symptoms.includes("fatigue_low_prep")) {
    result = result.replace("- Include garnish and presentation notes", "- Keep preparation simple; no required garnish or presentation steps.")
      .replace("- Include topping/garnish suggestions", "- Do not add optional topping or garnish work.");
  }
  return applyOncologySymptomPriority(result, symptoms) +
    "\nBEVERAGE TOLERANCE: " + oncologyPracticalGuidance(context) +
    "\nREQUEST ADAPTATION: Active symptom guidance takes precedence over conflicting requested ingredients or flavors. " +
    "When practical, preserve the drink format and refreshing intent while substituting only the conflicting ingredients with compatible mild options. " +
    "Do not repeat a conflicting ingredient merely because the user explicitly requested it. " +
    "\nA requested pitcher or party batch may contain multiple small servings; never present the whole batch as one person's serving. " +
    "Report activePrepMinutes as a number. Explain any symptom-driven flavor, ingredient or portion adaptation briefly in the description. " +
    "Do not infer a fluid target, electrolyte dose, supplement, treatment benefit or medical prescription.";
}

/** Check every accepted candidate and repair using unchanged existing symptom rules.
 * No new nutrient/volume threshold: reject explicit contradictions, not all fats,
 * all fiber, all creamy drinks or requested multi-person batches. */
export function oncologyBeverageViolations(meal: any, context: Context): string[] {
  if (!oncologySymptomPriorityEnabled() || !context.oncologySupportContext?.enabled) return [];
  const symptoms = recommendationOncologySymptoms(context);
  const ingredients = (meal.ingredients ?? []).map((item: any) => typeof item === "string" ? item : item?.name ?? item?.item ?? "").join(" ");
  const instructions = Array.isArray(meal.instructions) ? meal.instructions.join(" ") : String(meal.instructions ?? "");
  const prose = [meal.name, meal.description, meal.reasoning, meal.dietFitExplanation, meal.coachingNote].filter(Boolean).join(" ");
  const safety = validateOncologyMealSafety({
    ...meal, description: prose, instructions: meal.instructions,
  }, [...symptoms]);
  const violations = [...safety.violations];
  // Whole-fruit aliases implement the existing citrus avoidance rule, not a
  // new food restriction. The shared validator already handles juice/lemon.
  if (symptoms.includes("mouth_sensitivity") &&
      /\b(oranges?|mandarins?|tangerines?|clementines?|grapefruits?|lemons?|limes?|pineapples?)\b/i.test(ingredients) &&
      !violations.some(violation => violation.includes("mouth sensitivity"))) {
    violations.push("Acidic/citrus ingredients conflict with the existing mouth-sensitivity guidance.");
  }
  if ((symptoms.includes("nausea") || symptoms.includes("gi_sensitivity")) &&
      (/\b(heavy (?:whipping )?cream|deep.fried|greasy|extra.rich)\b/i.test(ingredients) ||
       /\b(rich and indulgent|rich, indulgent|high.fat|greasy|heavily spiced)\b/i.test(prose))) {
    violations.push("The beverage conflicts with active nausea/digestive guidance: avoid greasy, heavy/high-fat preparations.");
  }
  if (symptoms.includes("gi_sensitivity") &&
      (/\b(raw (?:kale|broccoli|cabbage)|whole (?:chia|flax)(?:seeds)?|roughage)\b/i.test(ingredients) ||
       /\b(very high.fiber|high.fiber roughage)\b/i.test(prose))) {
    violations.push("The beverage conflicts with digestive sensitivity: rough/high-fiber additions.");
  }
  if (symptoms.includes("low_appetite") && /\b(oversized|supersized|large single serving)\b/i.test(prose)) {
    violations.push("Use small manageable individual servings for low appetite; keep batch servings separate.");
  }
  if (symptoms.includes("fatigue_low_prep")) {
    if (typeof meal.activePrepMinutes !== "number" || !Number.isFinite(meal.activePrepMinutes) ||
        meal.activePrepMinutes < 0 || meal.activePrepMinutes >= 15) {
      violations.push("Fatigue guidance requires verified preparation metadata under 15 minutes of active preparation.");
    }
    if (/\b(?:carve|sculpt|candy|torch)\b.{0,40}\b(?:garnish|decoration)\b/i.test(instructions)) {
      violations.push("Remove elaborate garnish work for fatigue/low preparation capacity.");
    }
  }
  return violations;
}

export function withOncologyBeverageProof<T extends { passed: boolean; message?: string }>(proof: T, meal: any, context: Context): T {
  const violations = oncologyBeverageViolations(meal, context);
  return violations.length ? { ...proof, passed: false, message: [proof.message, ...violations].filter(Boolean).join(" ") } : proof;
}
