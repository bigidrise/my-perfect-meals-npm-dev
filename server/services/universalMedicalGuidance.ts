/**
 * universalMedicalGuidance.ts
 *
 * Builds concise, directive medical guidance strings for ALL major conditions.
 * These are injected into the ProtocolEnvelope's medical hard limits block so
 * that EVERY generator — Beverage Creator, Craving Creator, Restaurant Guide,
 * Snack Creator, Fridge Rescue, Chef's Kitchen, etc. — automatically honors the
 * user's active medical conditions without any route-level changes.
 *
 * Diabetes is handled separately via diabeticContextService (real-time glucose).
 * This file covers: GLP-1, Anti-Inflammatory, Renal, Cardiac, Liver, Oncology.
 *
 * Architecture rule: each condition produces a self-contained block of text that
 * can be appended to any prompt without context from the rest of the prompt.
 * Guidance is directive, not role-play. No system-prompt framing here.
 */

export type OncologySymptom =
  | "low_appetite"
  | "nausea"
  | "mouth_sensitivity"
  | "fatigue_low_prep"
  | "gi_sensitivity";

export interface UniversalGuidanceInput {
  userId: string;
  healthConditions: string[];
  oncologySupportContext?: {
    enabled: boolean;
    symptoms: OncologySymptom[];
    emphasis?: { highProteinNutrientDensity?: boolean };
  } | null;
  /** Thyroid Support context — self-selected or lab-driven. */
  thyroidSupportContext?: {
    active: boolean;
    medication: string | null;
    labDriven: boolean;
    isAutoimmune: boolean;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GLP-1
// ─────────────────────────────────────────────────────────────────────────────

const GLP1_GUIDANCE = `
💊 GLP-1 MEDICATION PROTOCOL — MANDATORY (user is on semaglutide, tirzepatide, or similar):
- SMALL PORTIONS ONLY — max ~400 kcal/meal. Do NOT generate large, heavy, or volume-dense meals.
- HIGH PROTEIN, LOW FAT — target ≥25g protein and ≤15g fat per meal.
- No fried foods of any kind — no deep frying, pan frying in heavy oil, or breading.
- No heavy fat sources: no butter, cream, heavy cream, cream cheese, full-fat mayo, rich sauces.
- No carbonated drinks — no soda, sparkling water, seltzer, tonic; carbonation worsens GLP-1 side effects.
- No high-sugar foods: no candy, pastries, donuts, cake, ice cream, syrup, honey, agave.
- No high-fat meats: no ribeye, pork belly, bacon, sausage, lamb shoulder, duck.
- No raw cruciferous vegetables in large quantities (hard to digest on GLP-1): cook all broccoli, cauliflower, cabbage, kale.
- No large legume servings (hard-to-digest): limit beans, lentils, chickpeas to small garnish portions.
- PREFER: chicken breast, turkey, white fish (cod, tilapia, halibut), egg whites, Greek yogurt (plain), cottage cheese, shrimp; steamed or roasted soft vegetables; oatmeal, white rice, sweet potato mash; small portions with soft textures.
- Eat slowly — mention small portions in the meal description, not large plates or heaping servings.
- If a beverage is being generated: no carbonation, no sugar, no heavy cream — water, herbal tea, diluted juice, plain yogurt-based drinks only.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-INFLAMMATORY
// ─────────────────────────────────────────────────────────────────────────────

const ANTI_INFLAMMATORY_GUIDANCE = `
🌿 ANTI-INFLAMMATORY PROTOCOL — MANDATORY:
- NO seed oils — canola oil, vegetable oil, soybean oil, corn oil, sunflower oil, safflower oil are BANNED. Use only olive oil or avocado oil.
- NO trans fats or hydrogenated oils — no margarine, shortening, partially hydrogenated anything.
- NO processed meats — bacon, ham, sausage, hot dogs, bratwurst, salami, pepperoni, bologna, prosciutto, pancetta are BANNED.
- NO fried foods — no deep frying, no pan frying in seed oils.
- NO refined sugars — no white sugar, corn syrup, high fructose corn syrup, candy, pastries, donuts, cake.
- NO refined flour products — no white bread, white pasta; prefer whole grain versions.
- Red meat: when included and no specific cut is requested, default to lean cuts only (sirloin, tenderloin, flank, eye of round) at 4–6 oz. If user explicitly names a cut, use it — optimize preparation instead.
- PREFER: fatty fish (salmon, mackerel, sardines), colorful vegetables, berries, turmeric, ginger, garlic, leafy greens, walnuts, flaxseed, olive oil, avocado, whole grains, legumes.
- Anti-inflammatory spices are encouraged: turmeric, ginger, garlic, rosemary, cinnamon.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// RENAL / KIDNEY DISEASE / CKD
// ─────────────────────────────────────────────────────────────────────────────

const RENAL_GUIDANCE = `
🫘 RENAL / KIDNEY DISEASE PROTOCOL — MANDATORY (strict mineral limits required):

POTASSIUM — HARD LIMIT: Avoid ALL high-potassium foods:
- BANNED: banana, plantain, orange, orange juice, all citrus juice, tomato (large amounts), avocado, spinach (large amounts), potato, sweet potato, beets, dried fruit.
- LOW-POTASSIUM SAFE: apple, blueberries, cranberries, grapes, cabbage, cauliflower, green beans, peppers, onions, white rice.

PHOSPHORUS — HARD LIMIT: Avoid high-phosphorus foods:
- BANNED: dairy in large amounts (no cheese, no milk, no yogurt as a primary component), chocolate, cocoa, cacao, nuts and seeds (no peanut butter, no almond butter), beans and lentils in large quantities, cola/dark soda, energy drinks, processed foods with phosphate additives.
- SAFE: egg whites, small amounts of chicken or white fish.

SODIUM — HARD LIMIT: No added salt. No canned foods with sodium. No processed meats. No soy sauce. No high-sodium condiments or broths.

PROTEIN — MODERATE only: Do NOT suggest high-protein meals. Excess protein burdens the kidneys. Prefer egg whites, small portions of white-meat chicken or white fish. No protein powders, no protein-fortified additions.

SAFE FOODS TO PREFER: egg whites, chicken breast (small portions), white fish (cod, tilapia), white rice, cabbage, cauliflower, peppers, onions, garlic, apples, blueberries, cranberries, green beans, herbs (fresh or dried, unsalted).
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// CARDIAC / HEART DISEASE / HYPERTENSION
// ─────────────────────────────────────────────────────────────────────────────

const CARDIAC_GUIDANCE = `
🫀 CARDIAC / HEART DISEASE PROTOCOL — MANDATORY:
- SODIUM — STRICT LIMIT: No added salt. No high-sodium ingredients — no soy sauce, no canned goods with sodium, no processed meats, no deli meat, no fast food, no instant noodles, no salted broths. Use herbs, lemon, garlic, vinegar for flavor.
- SATURATED FAT — STRICT LIMIT: No butter, no lard, no coconut cream, no full-fat dairy (no heavy cream, cream cheese, whole milk, full-fat sour cream). Use plant milk, low-fat dairy, olive oil only.
- NO TRANS FATS: No partially hydrogenated oils, no margarine, no shortening.
- NO PROCESSED MEATS: Bacon, sausage, hot dogs, salami, pepperoni, deli meat, ham — all BANNED.
- NO ALCOHOL of any kind.
- No fried foods — no deep frying, no heavy pan frying.
- PREFER: fatty fish (salmon, mackerel, sardines), leafy greens, berries, oats, legumes (beans, lentils), olive oil, avocado, nuts (unsalted), seeds, whole grains, colorful vegetables, plant-based proteins.
- Cooking methods: baking, steaming, grilling, broiling, poaching, or light sautéing in olive oil only.
- Beverages: water, herbal tea, unsweetened plant milk only — no alcohol, no soda, no energy drinks.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// LIVER SUPPORT / LIVER DISEASE / NAFLD / FATTY LIVER
// ─────────────────────────────────────────────────────────────────────────────

const LIVER_GUIDANCE = `
🌱 LIVER SUPPORT PROTOCOL — MANDATORY:
- ALCOHOL — ABSOLUTE BAN: No alcohol of any kind in food, beverages, or cooking. No beer, wine, liquor, spirits, cocktail ingredients, or wine-based sauces. Zero exceptions. This is a clinical hard stop.
- NO FRIED FOODS: No deep frying, no heavy oil use, no battered/breaded preparations.
- NO ADDED SUGAR: No candy, pastries, soda, sweet tea, energy drinks, flavored syrups, sweetened condensed milk, or processed desserts. Natural whole-food sweetness from fruit is acceptable.
- NO ULTRA-PROCESSED FOODS: No fast food, instant noodles, packaged snack foods.
- LIMIT: Processed meats (bacon, sausage, deli meat), heavy butter/cream-based dishes, high-sodium foods.
- PREFER: Cruciferous vegetables (broccoli, cauliflower, Brussels sprouts, cabbage), leafy greens (spinach, kale, arugula), omega-3 rich fish (salmon, sardines, tuna), whole grains (oats, quinoa, brown rice), legumes (beans, lentils), olive oil, avocado, berries, garlic, turmeric, ginger, green tea, beets.
- Cooking methods: baking, steaming, grilling, light sautéing in olive oil only.
- Beverages: water, herbal tea, green tea, unsweetened plant milk, small amounts of fresh fruit juice — NO alcohol, no soda, no energy drinks, no sweet tea.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// ONCOLOGY SUPPORT
// ─────────────────────────────────────────────────────────────────────────────

const ONCOLOGY_SYMPTOM_GUIDANCE: Record<OncologySymptom, string> = {
  low_appetite:
    "Low appetite active: Prioritize smaller, calorie-dense, nutrient-packed portions. Avoid heavy oversized meals. Smoothies, soft bowls, protein-enriched oatmeal are ideal. Never suggest large plates. Make food look and sound appealing — achievable, not overwhelming.",
  nausea:
    "Nausea active: Avoid greasy, heavily spiced, or strongly aromatic foods. Prefer chilled or room-temperature options, broth-based dishes, plain rice, ginger-containing items (ginger tea, ginger broth), and light proteins. No fried foods, no strong sauces, no pungent cheeses.",
  mouth_sensitivity:
    "Mouth sensitivity active: Avoid acidic ingredients (citrus, vinegar, tomato-heavy sauces), crunchy textures (raw carrots, crackers, chips, crusty bread), and spicy ingredients. Strongly prefer soft, smooth, creamy, or cool textures: yogurt, smoothies, mashed sweet potato, soft scrambled eggs, silken tofu, well-cooked oatmeal.",
  fatigue_low_prep:
    "Low energy/fatigue active: All meals MUST be minimal-effort. No complex multi-step recipes. Prioritize one-bowl meals, sheet-pan simplicity, no-cook options, or meals requiring under 15 minutes of active prep. Avoid long cook times or multiple pots.",
  gi_sensitivity:
    "GI sensitivity active: Avoid gas-producing foods (raw cruciferous vegetables, large amounts of legumes, excess garlic/onion), high-fat or greasy items, very high-fiber roughage, spicy foods. Prefer cooked and softened vegetables, easily digestible proteins (eggs, white fish, tofu, soft chicken), plain grains (white rice, oatmeal).",
};

function buildOncologyGuidance(
  symptoms: OncologySymptom[],
  highProtein: boolean
): string {
  const lines: string[] = [
    `🎗️ CANCER SUPPORT NUTRITION PROTOCOL — MANDATORY (physician-assigned):`,
    `SAFETY RULE: Generate practical, nourishing meals only. Do NOT use clinical language, treatment claims, cure language, or any implication of medical decision-making. This is nutrition support only.`,
    ``,
    `HARD-BLOCKED INGREDIENTS (never include in any form):`,
    `- ALL processed and cured meats: bacon, turkey bacon, Canadian bacon, pork belly, sausage (all types), chorizo, bratwurst, kielbasa, pepperoni, salami, prosciutto, pancetta, ham, all deli meats, hot dogs, bologna, mortadella, spam, beef jerky.`,
    `- Heavily processed fats: lard, margarine, shortening, hydrogenated oils, trans fat-containing spreads.`,
    `- Added sweeteners: maple syrup, honey, agave, corn syrup, high fructose corn syrup, refined sugar, brown sugar, powdered sugar.`,
    `- Charred preparations: no blackened or charcoal-burned meats.`,
    `- Refined white carbs as the primary starch: white bread, white pasta, refined crackers. Upgrade to whole grain, sprouted grain, or sweet potato when bread/pasta is needed.`,
    ``,
    `PRIORITY FOODS (actively include):`,
    `- Leafy greens: spinach, kale, arugula, Swiss chard, collard greens.`,
    `- Cruciferous vegetables: broccoli, cauliflower, Brussels sprouts, cabbage, bok choy.`,
    `- Berries: blueberries, strawberries, raspberries, blackberries.`,
    `- Healthy fats: olive oil, avocado, walnuts, almonds, flaxseed, chia.`,
    `- Clean proteins (prefer fresh over cured/smoked): eggs, salmon, white fish (cod, tilapia, halibut), chicken breast, turkey breast, Greek yogurt, cottage cheese, silken tofu, lentils, chickpeas, black beans.`,
    `- Complex carbs: oats, quinoa, sweet potatoes, lentils, farro, brown rice, whole grain bread.`,
    `FIBER ANCHOR: Every meal must include at least one meaningful fiber source — legumes, whole grains, starchy vegetables, berries, or meaningful cruciferous vegetables.`,
    `FRESH > PRESERVED: Always prefer fresh over smoked, cured, or pickled proteins.`,
  ];

  if (highProtein) {
    lines.push(
      ``,
      `HIGH PROTEIN EMPHASIS: Prioritize protein at every meal. Use easily digestible complete proteins: Greek yogurt, eggs, soft chicken, white fish, cottage cheese, silken tofu. Every meal must be nutrient-dense — no empty calories.`
    );
  }

  if (symptoms.length > 0) {
    lines.push(``, `ACTIVE SYMPTOM ADAPTATIONS (apply these on top of base rules):`);
    for (const symptom of symptoms) {
      lines.push(`- ${ONCOLOGY_SYMPTOM_GUIDANCE[symptom]}`);
    }
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

const GLP1_CONDITION_KEYS = new Set([
  "glp-1", "glp1", "semaglutide", "ozempic", "wegovy",
  "tirzepatide", "mounjaro", "rybelsus",
]);

const ANTI_INFLAMMATORY_KEYS = new Set([
  "anti-inflammatory", "anti inflammatory",
  "rheumatoid-arthritis", "rheumatoid arthritis", "psoriasis", "lupus",
  "autoimmune",
]);

const RENAL_KEYS = new Set([
  "renal", "kidney disease", "ckd", "chronic kidney disease",
]);

const CARDIAC_KEYS = new Set([
  "cardiac", "heart disease", "heart failure", "hypertension",
]);

const LIVER_KEYS = new Set([
  "fatty liver", "nafld", "liver disease", "liver support",
  "non-alcoholic fatty liver", "non alcoholic fatty liver",
]);

const THYROID_KEYS = new Set([
  "thyroid-support", "thyroid support", "hashimoto's", "hashimotos",
  "hypothyroidism", "thyroid disease", "autoimmune thyroid",
]);

/**
 * Build all active condition guidance blocks for injection into the protocol envelope.
 * Returns an array of directive strings — one per active condition.
 * Diabetes is intentionally excluded here (handled by diabeticContextService).
 */
export async function buildUniversalConditionGuidance(
  input: UniversalGuidanceInput
): Promise<string[]> {
  const blocks: string[] = [];
  const conditions = input.healthConditions.map(c => c.trim().toLowerCase());

  if (conditions.some(c => GLP1_CONDITION_KEYS.has(c))) {
    blocks.push(GLP1_GUIDANCE);
  }

  if (conditions.some(c => ANTI_INFLAMMATORY_KEYS.has(c))) {
    blocks.push(ANTI_INFLAMMATORY_GUIDANCE);
  }

  if (conditions.some(c => RENAL_KEYS.has(c))) {
    blocks.push(RENAL_GUIDANCE);
  }

  if (conditions.some(c => CARDIAC_KEYS.has(c))) {
    blocks.push(CARDIAC_GUIDANCE);
  }

  if (conditions.some(c => LIVER_KEYS.has(c))) {
    blocks.push(LIVER_GUIDANCE);
  }

  if (input.oncologySupportContext?.enabled) {
    const symptoms = (input.oncologySupportContext.symptoms ?? []) as OncologySymptom[];
    const highProtein = input.oncologySupportContext.emphasis?.highProteinNutrientDensity ?? false;
    blocks.push(buildOncologyGuidance(symptoms, highProtein));
  }

  // Thyroid Support — fires when:
  //   (a) explicitly passed via thyroidSupportContext.active, OR
  //   (b) a thyroid key exists in healthConditions (e.g., "thyroid-support", "hashimoto's")
  //   (c) specialtyCondition = 'thyroid-support' is wired up at the envelope level
  const thyroidActiveViaCondition = conditions.some(c => THYROID_KEYS.has(c));
  const thyroidActiveViaContext   = !!input.thyroidSupportContext?.active;

  if (thyroidActiveViaContext || thyroidActiveViaCondition) {
    // Import inline to avoid circular dependency with protocolEnvelope
    const { buildThyroidSupportPrompt } = await import('./guardrails/prompt/thyroidSupportPromptBuilder');
    const thyroidCtx = input.thyroidSupportContext ?? {
      active: true,
      medication: null,
      labDriven: false,
      isAutoimmune: thyroidActiveViaCondition &&
        conditions.some(c => ["hashimoto's", "hashimotos", "autoimmune thyroid"].includes(c)),
    };
    const overlay = buildThyroidSupportPrompt(thyroidCtx);
    if (overlay.trim()) blocks.push(overlay);
  }

  return blocks;
}
