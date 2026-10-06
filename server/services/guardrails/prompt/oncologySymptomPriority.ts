import type { OncologySymptomSelection } from "../../../../shared/oncologySupportSelection";
import { oncologyDevelopmentReviewAllowed } from "../../../../shared/oncologyDevelopmentGate";

/** Deliberately inactive in every published/production runtime until separately approved. */
export function oncologySymptomPriorityEnabled(): boolean {
  return oncologyDevelopmentReviewAllowed({
    developmentRuntime: process.env.NODE_ENV === "development",
    publishedRuntime: Boolean(process.env.REPLIT_DEPLOYMENT),
    productionProject: process.env.VITE_IS_PRODUCTION_PROJECT === "true",
    explicitDevelopmentReview: process.env.VITE_ONCOLOGY_DEVELOPMENT_REVIEW_ENABLED === "true",
  });
}

export function activeOncologySymptoms(symptoms: readonly OncologySymptomSelection[] = []): readonly OncologySymptomSelection[] {
  return oncologySymptomPriorityEnabled() ? symptoms : [];
}

/** Resolve only generic oncology optimization; never edit hard safety or another protocol. */
export function applyOncologySymptomPriority(prompt: string, symptoms: readonly OncologySymptomSelection[] = []): string {
  const active = activeOncologySymptoms(symptoms);
  if (!active.length) return prompt;
  const gi = active.includes("gi_sensitivity");
  const mouth = active.includes("mouth_sensitivity");
  const nausea = active.includes("nausea");
  let resolved = prompt;
  if (gi || mouth || nausea || active.includes("low_appetite") || active.includes("fatigue_low_prep")) {
    resolved = resolved.replace(/=== QUALITY CHECKLIST[\s\S]*?=== MEAL FORMAT GUIDANCE ===/,
      "=== TOLERANCE-AWARE QUALITY CHECKLIST ===\nKeep protein and nutrient density, but choose a manageable, practical format. " +
      "Do not require conflicting fiber, acidic boosters, large portions, high-fat additions, or extra preparation steps.\n\n=== MEAL FORMAT GUIDANCE ===");
  }
  if (gi) {
    resolved = resolved.replace(/=== MANDATORY FIBER ANCHOR ===[\s\S]*?=== FRESH > PRESERVED BIAS ===/,
      "=== DIGESTIVE TOLERANCE ===\nDo not require a fiber anchor or high-fiber ingredients. Use the existing cooked, softened, low-residue guidance.\n\n=== FRESH > PRESERVED BIAS ===");
    resolved = resolved.split("\n").map(line => {
      if (/FIBER ANCHOR:|✅ FIBER ANCHOR|✅ ANTI-INFLAMMATORY VEGETABLES/.test(line)) {
        return "TOLERANCE FIRST: Cooked, softened vegetables and tolerated plain grains; no required fiber quantity or cruciferous food.";
      }
      if (/^- (Cruciferous vegetables|Complex carbs):/.test(line)) return "Choose cooked, softened vegetables and tolerated grains according to digestive sensitivity.";
      return line;
    }).join("\n");
  }
  if (mouth || gi || nausea) {
    resolved = resolved.split("\n").map(line => {
      // Change affirmative generic ingredient recommendations only, not symptom avoidance instructions.
      if (/THERAPEUTIC BOOSTER|BOOSTERS:|THERAPEUTIC BOOSTERS/.test(line)) {
        return "TOLERATED FLAVOR: Herbs or mild flavoring only when tolerated; optional, never a mandatory booster.";
      }
      if (/^TOMATOES:/.test(line) && mouth) return "Mouth sensitivity: omit acidic tomato preparations.";
      if (/^ALLIUMS/.test(line) && (gi || nausea)) return "Digestive/nausea tolerance: do not require garlic, onions, or pungent flavoring.";
      if (/^- Healthy fats:|^HEALTHY FATS:|✅ HEALTHY FAT/.test(line) && (gi || nausea)) {
        return "Use modest amounts of tolerated fats; do not require high-fat additions.";
      }
      if (/lemon\/lemon zest|lemon juice|garlic clove \+ turmeric|HIGH-FIBER COMPLEX CARBS:/.test(line)) {
        return "Choose only ingredients compatible with the active symptom guidance; no mandatory acidic, pungent, or high-fiber additions.";
      }
      return line;
    }).join("\n");
  }
  return resolved + "\n\nONCOLOGY TOLERANCE PRIORITY (DEVELOPMENT):\n" +
    "Allergies, intolerances, dietary identity, clinician-directed eliminations, prohibited ingredients, and other active medical safety rules remain authoritative. " +
    "Within those boundaries, the active symptom guidance overrides conflicting GENERIC oncology optimization and quality templates. " +
    (gi ? "Digestive sensitivity: no mandatory fiber anchor, roughage, large legume portions, excess garlic/onion, or greasy additions. White rice and oatmeal remain available when compatible with other active restrictions. " : "") +
    (mouth ? "Mouth sensitivity: omit citrus, lemon, vinegar, tomato-heavy sauces, spicy foods and sharp/crunchy textures; do not add them to satisfy a booster checklist. " : "") +
    (nausea ? "Nausea: no mandatory pungent herbs, strong aromas, greasy or heavily spiced additions; choose gentler, lower-aroma meals. " : "") +
    (active.includes("low_appetite") ? "Low appetite: keep portions small and manageable; do not enlarge a plate merely to satisfy the generic complete-plate checklist. " : "") +
    (active.includes("fatigue_low_prep") ? "Fatigue: no extra sides or complex steps merely to satisfy generic quality; under 15 minutes active preparation. " : "") +
    "Never override another clinical restriction to meet a symptom preference. Explain unresolved conflicts rather than relaxing a hard safety rule.";
}
