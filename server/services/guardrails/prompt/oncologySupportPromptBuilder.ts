/**
 * Cancer Support Nutrition Overlay Prompt Builder
 *
 * Builds on top of the existing anti-inflammatory prompt to add
 * symptom-aware, treatment-supportive guidance.
 *
 * Feature flag: oncology_support_v1
 * Physician-assigned only — not self-selectable by public users.
 *
 * SAFETY RULE: This prompt must NEVER suggest clinical treatment, cures,
 * dosing recommendations, or any language implying medical decision-making.
 * All output is "nutrition support" only. The post-generation validator
 * (oncologySupportValidator.ts) enforces this as a second layer of protection.
 */

export type OncologySupportSymptom =
  | "low_appetite"
  | "nausea"
  | "mouth_sensitivity"
  | "fatigue_low_prep"
  | "gi_sensitivity";

export interface OncologySupportContext {
  enabled: boolean;
  symptoms: OncologySupportSymptom[];
  emphasis: { highProteinNutrientDensity: boolean };
  source: "physician" | "self";
  updatedBy: string | null;
  updatedAt: string | null;
}

const SYMPTOM_GUIDANCE: Record<OncologySupportSymptom, string> = {
  low_appetite:
    "Prioritize smaller, calorie-dense, nutrient-packed portions. Avoid heavy, oversized meals. " +
    "Bias toward appealing, high-value foods that feel achievable to eat. Smoothies, yogurt bowls, " +
    "protein oatmeal, and soft rice bowls are excellent formats. Never suggest large plates.",

  nausea:
    "Avoid greasy, heavily spiced, or strongly aromatic foods. Prefer chilled or room-temperature " +
    "options, bland-leaning but still nourishing meals, broth-based dishes, plain rice, toast-adjacent " +
    "foods, ginger-containing options (ginger tea, ginger broth), and light protein sources. " +
    "No fried foods, no strong sauces, no pungent cheeses.",

  mouth_sensitivity:
    "Avoid acidic ingredients (citrus, vinegar, tomato-heavy sauces), crunchy or sharp textures " +
    "(raw carrots, crackers, chips, crusty bread), spicy ingredients, and anything requiring significant " +
    "chewing effort. Strongly prefer soft, smooth, creamy, or cool textures: yogurt, smoothies, " +
    "mashed sweet potato, soft scrambled eggs, silken tofu, well-cooked oatmeal, pudding-style desserts.",

  fatigue_low_prep:
    "All meals must be minimal-effort. No complex multi-step recipes. Prioritize one-bowl meals, " +
    "fridge-rescue style assembly, sheet-pan simplicity, no-cook options, and meals that require " +
    "under 15 minutes of active preparation. Avoid recipes requiring long cook times, multiple pots, " +
    "or any technique requiring sustained attention.",

  gi_sensitivity:
    "Avoid gas-producing foods (raw cruciferous vegetables, legumes in large quantities, onions, " +
    "garlic in excess), high-fat or greasy items, very high-fiber roughage, and spicy foods. " +
    "Prefer cooked and well-softened vegetables, easily digestible proteins (eggs, white fish, " +
    "tofu, soft chicken), plain grains (white rice, oatmeal), and low-residue options.",
};

const PROTEIN_EMPHASIS_GUIDANCE =
  "Emphasize protein at every meal and snack. Aim for easily digestible, complete protein sources: " +
  "Greek yogurt, eggs, soft chicken, white fish, cottage cheese, silken tofu, protein-enriched " +
  "smoothies, lentil soups. Protein supports lean mass, recovery, and strength during treatment. " +
  "Every meal should be nutrient-dense — no empty calories.";

const MANDATORY_SAFETY_DISCLAIMER =
  "IMPORTANT — NUTRITION SUPPORT CONTEXT: These meals are intended as supportive nutrition only. " +
  "Do not include any language suggesting clinical treatment, disease management, cure, tumor effect, " +
  "chemotherapy support, or medical decision-making. Do not recommend supplements or medications. " +
  "All meal names, descriptions, and instructions should be practical, comforting, and nourishing — " +
  "never clinical or treatment-focused in tone.";

/**
 * Build the oncology support overlay prompt section.
 * This is injected AFTER the anti-inflammatory base prompt.
 *
 * @param context - The user's oncologySupportContext from the DB
 * @returns Prompt string to append to the base anti-inflammatory prompt
 */
export function buildOncologySupportPrompt(context: OncologySupportContext): string {
  if (!context.enabled) return "";

  const lines: string[] = [
    "--- CANCER SUPPORT NUTRITION OVERLAY ---",
    "",
    "This meal plan is being generated for a user receiving Cancer Support Nutrition guidance.",
    "This is a nutrition support tool only, assigned by their care provider.",
    "",
    MANDATORY_SAFETY_DISCLAIMER,
    "",
  ];

  lines.push("CORE APPROACH:");
  lines.push("- Anti-inflammatory foundation applies (all anti-inflammatory rules remain active)");
  lines.push("- Gentle, nutrient-dense, appetite-friendly meal design");
  lines.push("- Practical and easy to tolerate");
  lines.push("");
  lines.push("RED MEAT DEFAULT RULE:");
  lines.push("When beef, steak, lamb, or pork is included and the user has not named a specific cut, default to a lean cut: sirloin, tenderloin, eye of round, or filet mignon.");
  lines.push("If the user explicitly names a cut (e.g., 'ribeye', 'T-bone'), use that cut — do not substitute it. Naming a cut only overrides the cut choice, NOT the portion. Portion still defaults to 6–8 oz regardless of the cut, unless the user also specifies a different amount (e.g., '12 oz ribeye'). Optimize preparation method (grilled or broiled preferred) and pair with appropriate sides.");
  lines.push("If any requested ingredient conflicts with this protocol, include it — but optimize preparation method, portion, and pairing to reduce impact where possible.");
  lines.push("");

  if (context.emphasis.highProteinNutrientDensity) {
    lines.push("PROTEIN & NUTRIENT DENSITY EMPHASIS:");
    lines.push(PROTEIN_EMPHASIS_GUIDANCE);
    lines.push("");
  }

  if (context.symptoms.length > 0) {
    lines.push("ACTIVE SYMPTOM GUIDANCE:");
    lines.push("The following symptom-aware rules are active and must be respected:");
    lines.push("");
    for (const symptom of context.symptoms) {
      const label = symptom.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      lines.push(`[${label}]`);
      lines.push(SYMPTOM_GUIDANCE[symptom]);
      lines.push("");
    }
  }

  lines.push("MEAL FORMAT GUIDANCE:");
  lines.push("- Prefer smaller, manageable portions over large plates");
  lines.push("- Soft textures unless mouth sensitivity is not active");
  lines.push("- Minimal prep effort unless fatigue is not active");
  lines.push("- Warm, comforting, and familiar where possible");
  lines.push("- All meals should feel achievable and inviting, not clinical or medicalized");
  lines.push("");
  lines.push("--- END CANCER SUPPORT NUTRITION OVERLAY ---");

  return lines.join("\n");
}

/**
 * Check whether the feature flag is active.
 * Currently hardcoded on — wrap in env var or DB flag later for instant disable.
 */
export function isOncologySupportEnabled(): boolean {
  return process.env.ONCOLOGY_SUPPORT_V1 !== "off";
}
