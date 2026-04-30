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
 * Hard-blocked ingredients for Cancer Support Nutrition.
 * These must NEVER appear in any generated meal while this protocol is active.
 * The post-generation validator (oncologySupportValidator.ts) also enforces this list.
 */
export const ONCOLOGY_HARD_BLOCKED_INGREDIENTS = [
  "bacon",
  "turkey bacon",
  "canadian bacon",
  "pork belly",
  "sausage",
  "breakfast sausage",
  "italian sausage",
  "chorizo",
  "pepperoni",
  "salami",
  "prosciutto",
  "pancetta",
  "ham",
  "deli meat",
  "lunch meat",
  "hot dog",
  "bratwurst",
  "kielbasa",
  "bologna",
  "mortadella",
  "spam",
  "beef jerky",
  "pork rinds",
  "lard",
  "margarine",
  "shortening",
  "hydrogenated oil",
  "partially hydrogenated",
];

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
    "=== HARD BLOCK — NEVER INCLUDE ANY OF THESE ===",
    "The following ingredients are STRICTLY FORBIDDEN and must NEVER appear in any meal,",
    "ingredient list, cooking instruction, or suggestion while Cancer Support Nutrition is active.",
    "No exceptions. No substitution logic. Simply do not use them:",
    "",
    "PROCESSED AND CURED MEATS (ALL FORMS): bacon, turkey bacon, Canadian bacon, pork belly,",
    "sausage (all types: breakfast sausage, Italian sausage, chorizo, bratwurst, kielbasa),",
    "pepperoni, salami, prosciutto, pancetta, ham, deli meats, lunch meats, hot dogs, bologna,",
    "mortadella, spam, beef jerky.",
    "",
    "HEAVILY PROCESSED FATS: lard, margarine, shortening, hydrogenated oils, partially hydrogenated",
    "oils, trans fat-containing spreads. Use olive oil, avocado oil, or small amounts of butter only.",
    "",
    "REFINED WHITE CARBS AS PRIMARY STARCH: white bread (toast included), white pasta, refined",
    "crackers, white bagels. If bread or toast is a component, upgrade to whole grain, sprouted grain,",
    "or sweet potato. If pasta is requested, default to whole wheat or legume-based pasta.",
    "",
    "CHARRED OR HEAVILY CHARRED PREPARATIONS: no blackened meats, no charcoal-grilled to blackening,",
    "no heavily charred skin. Grilling and broiling are allowed — just not to the point of charring.",
    "",
    "=== PRIORITY FOODS — ACTIVELY INCLUDE THESE ===",
    "When building meals under this protocol, lean into these ingredients and food groups.",
    "They should appear regularly across the meal plan:",
    "",
    "LEAFY GREENS: spinach, kale, arugula, Swiss chard, collard greens, romaine.",
    "CRUCIFEROUS VEGETABLES: broccoli, cauliflower, Brussels sprouts, cabbage, bok choy.",
    "MUSHROOMS: shiitake, cremini, portobello, maitake — anti-inflammatory and nutrient-dense.",
    "BERRIES: blueberries, strawberries, raspberries, blackberries — antioxidant-rich.",
    "TOMATOES: fresh, roasted, or cooked in sauces (unless mouth_sensitivity is active).",
    "ALLIUMS (if gi_sensitivity is NOT active): garlic, onions, leeks, shallots.",
    "HEALTHY FATS: olive oil, avocado, nuts (walnuts, almonds), seeds (flaxseed, chia).",
    "HIGH-FIBER COMPLEX CARBS: oats, quinoa, sweet potatoes, lentils, chickpeas, black beans,",
    "farro, barley, brown rice, whole grain bread.",
    "CLEAN PROTEINS: eggs, salmon, sardines, white fish (cod, tilapia, halibut), chicken breast,",
    "turkey breast, Greek yogurt, cottage cheese, silken tofu, tempeh, edamame.",
    "",
    "=== INGREDIENT TIER SYSTEM ===",
    "Ingredients are classified into three tiers. Apply this logic when choosing proteins and",
    "other components:",
    "",
    "🟢 GREEN TIER — Default choices. Use freely in every meal:",
    "Fresh wild salmon, fresh white fish (cod, halibut, tilapia), eggs, chicken breast,",
    "turkey breast, Greek yogurt, cottage cheese, silken tofu, tempeh, edamame, lentils,",
    "chickpeas, black beans. Fresh vegetables and fruits — all preferred.",
    "",
    "🟡 YELLOW TIER — Acceptable occasionally (once or twice per week max), NOT a default.",
    "Smoked salmon: acceptable but cured and often high-sodium — use at most 2 oz, not 4 oz,",
    "and only when the user explicitly requests it or when no green-tier protein is practical.",
    "Prefer fresh salmon over smoked salmon in every case where it is an option.",
    "Canned tuna/sardines in water: fine in moderation, lower priority than fresh fish.",
    "Aged or sharp cheeses: small amounts only.",
    "",
    "🔴 RED TIER — Hard blocked. Never include (see HARD BLOCK list above).",
    "",
    "RULE: When generating a meal, always default to GREEN TIER proteins. Only use YELLOW TIER",
    "if explicitly requested by the user or if no green-tier alternative exists. Never suggest",
    "smoked, cured, or preserved proteins as a default Cancer Support meal.",
    "",
    "=== MANDATORY FIBER ANCHOR ===",
    "Every meal under this protocol MUST include a meaningful fiber component. 'Fiber-Based'",
    "means more than just leafy greens — spinach alone does not meet the fiber requirement.",
    "Include at least ONE of the following in every meal:",
    "- Legumes: lentils, chickpeas, black beans, edamame (strong fiber, also protein)",
    "- Whole grains: oats, quinoa, farro, brown rice, barley, whole grain toast",
    "- Starchy vegetables: sweet potato, butternut squash, beets",
    "- Berries (as a side): blueberries, raspberries, blackberries (fiber + antioxidants)",
    "- Cruciferous vegetables in a meaningful quantity: broccoli, Brussels sprouts, cabbage",
    "This supports gut health, blood sugar stability, and microbiome health during treatment.",
    "",
    "=== FRESH > PRESERVED BIAS ===",
    "Always prefer fresh over preserved, smoked, cured, or pickled versions of any ingredient.",
    "Fresh salmon > smoked salmon. Fresh turkey > deli turkey. Fresh herbs > pickled.",
    "When a user asks for a dish that typically uses a preserved protein, substitute a fresh",
    "version unless the user has explicitly and specifically requested the preserved form.",
    "",
    "=== CORE APPROACH ===",
    "- Anti-inflammatory foundation applies (all anti-inflammatory rules remain active)",
    "- Gentle, nutrient-dense, appetite-friendly meal design",
    "- Practical and easy to tolerate",
    "- Red meat is allowed in small portions (4–6 oz lean cuts: sirloin, tenderloin, flank) but",
    "  should not be the primary protein more than once per day. Fish, eggs, and plant proteins",
    "  are preferred defaults.",
    "",
  ];

  if (context.emphasis.highProteinNutrientDensity) {
    lines.push("=== PROTEIN & NUTRIENT DENSITY EMPHASIS ===");
    lines.push(PROTEIN_EMPHASIS_GUIDANCE);
    lines.push("");
  }

  if (context.symptoms.length > 0) {
    lines.push("=== ACTIVE SYMPTOM GUIDANCE ===");
    lines.push("The following symptom-aware rules are active and must be respected:");
    lines.push("");
    for (const symptom of context.symptoms) {
      const label = symptom.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      lines.push(`[${label}]`);
      lines.push(SYMPTOM_GUIDANCE[symptom]);
      lines.push("");
    }
  }

  lines.push("=== MEAL FORMAT GUIDANCE ===");
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
