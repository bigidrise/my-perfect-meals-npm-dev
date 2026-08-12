/**
 * Pregnancy Support Nutritional Protocol — Prompt Builder
 *
 * Additive modifier layered on top of existing meal generation.
 * Fires when "pregnancy-support" is in the user's specialtyConditions array.
 *
 * Architecture: follows the same Additive Modifier pattern as Thyroid Support,
 * Menopause, and Metabolic Recovery. Does NOT replace the primary builder.
 *
 * SAFETY RULES:
 *   1. NEVER suggest food can ensure a healthy pregnancy, prevent complications,
 *      or treat any pregnancy condition.
 *   2. NEVER recommend supplements, medications, or prenatal vitamin dosing.
 *   3. NEVER reference miscarriage, birth defects, or adverse pregnancy outcomes
 *      in meal names, descriptions, or instructions.
 *   4. All output is adaptive nutrition support — not obstetric or medical advice.
 *   5. Always defer to OB/GYN, midwife, and registered dietitian.
 *
 * Sources: ACOG, SMFM, Academy of Nutrition and Dietetics, NIH ODS,
 *          CDC, FDA, EPA, AAP, WHO.
 */

export type PregnancyStage =
  | "trying-to-conceive"
  | "trimester-1"
  | "trimester-2"
  | "trimester-3"
  | "breastfeeding"
  | "postpartum";

export type PregnancySymptom =
  | "nausea"
  | "heartburn"
  | "constipation"
  | "fatigue"
  | "food_aversions"
  | "swelling"
  | "shortness_of_breath"
  | "low_appetite";

export interface PregnancySupportContext {
  active: boolean;
  stage: PregnancyStage;
  weekOfPregnancy: number | null;
  dueDate: string | null;
  symptoms: PregnancySymptom[];
  isBreastfeeding: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HARD-BLOCKED INGREDIENTS — enforced at both prompt and validator level
// Based on FDA, CDC, EPA, and ACOG food safety guidance for pregnancy.
// ─────────────────────────────────────────────────────────────────────────────

export const PREGNANCY_HARD_BLOCKED_INGREDIENTS = new Set([
  // Alcohol
  "alcohol", "wine", "beer", "spirits", "liquor", "champagne", "sake",
  "bourbon", "whiskey", "vodka", "rum", "tequila", "gin", "brandy",
  "mead", "hard cider", "hard seltzer", "wine vinegar",
  // Raw/undercooked proteins
  "raw fish", "sushi", "sashimi", "raw salmon", "raw tuna", "raw shrimp",
  "raw oysters", "oysters on the half shell", "raw clams", "raw mussels",
  "raw scallops", "raw crab", "ceviche", "poké bowl", "raw eggs",
  "soft-boiled egg", "runny yolk", "steak tartare", "beef tartare",
  // Unpasteurized products
  "unpasteurized milk", "raw milk", "unpasteurized cheese",
  "unpasteurized juice", "raw juice",
  // High-listeria risk — deli / cold cuts (listeria can grow in refrigerated meats)
  "deli meat", "lunch meat", "cold cuts", "bologna", "salami",
  "refrigerated smoked salmon", "smoked salmon", "lox",
  "refrigerated smoked seafood",
  // Soft cheeses (listeria risk when unpasteurized)
  "brie", "camembert", "feta", "queso fresco", "queso blanco",
  "panela", "soft blue cheese", "gorgonzola", "roquefort",
  // High-mercury fish — FDA/EPA avoid list
  "shark", "swordfish", "king mackerel", "tilefish", "bigeye tuna",
  "orange roughy", "marlin",
  // Raw sprouts (listeria/salmonella risk)
  "raw sprouts", "alfalfa sprouts", "bean sprouts", "raw bean sprouts",
]);

// Mercury tiers (for prompt guidance — not hard blocked)
const MERCURY_LIMIT_FISH = [
  "albacore tuna", "white tuna", "yellowfin tuna", "grouper",
  "halibut", "mahi-mahi", "Chilean sea bass", "bluefish",
];

const MERCURY_PREFERRED_FISH = [
  "salmon", "sardines", "trout", "tilapia", "cod", "catfish",
  "pollock", "shrimp", "canned light tuna",
];

// ─────────────────────────────────────────────────────────────────────────────
// FOOD SAFETY BLOCK — universal across all stages
// ─────────────────────────────────────────────────────────────────────────────

const FOOD_SAFETY_BLOCK = `
=== PREGNANCY FOOD SAFETY — HARD RULES (FDA/CDC/EPA/ACOG) ===
These are absolute restrictions. No exceptions regardless of preparation method or cuisine.

ALCOHOL — ZERO TOLERANCE:
- No alcohol of any kind in any amount. No wine, beer, spirits, wine-based sauces, or
  alcohol-containing marinades. Cooking does not fully eliminate alcohol — avoid entirely.

RAW / UNDERCOOKED PROTEINS — BANNED:
- No raw fish (sushi, sashimi, ceviche, poké, raw salmon, raw tuna, raw shellfish).
- No raw or undercooked eggs (soft-boiled, runny yolk, raw egg in dressings or desserts).
- No steak tartare or raw beef of any kind. All meat must be fully cooked.

LISTERIA RISK FOODS — AVOID:
- No deli meats, cold cuts, bologna, salami, or refrigerated lunch meats unless heated
  until steaming hot (165°F). If generating a sandwich, use cooked protein alternatives.
- No refrigerated smoked seafood (lox, smoked salmon) unless in a cooked dish.
- No unpasteurized dairy — no raw milk, no unpasteurized cheese.
- No raw sprouts (alfalfa, bean sprouts) — listeria contamination risk.

SOFT CHEESES — AVOID UNLESS PASTEURIZED AND EXPLICITLY STATED:
- Default to hard, fully pasteurized cheeses. Do not generate dishes with brie, camembert,
  queso fresco, queso blanco, feta (unless pasteurized label confirmed), soft blue cheese,
  gorgonzola, or roquefort as primary ingredients.
- Safe alternatives: cheddar, mozzarella (pasteurized), Swiss, Parmesan, ricotta (pasteurized),
  cottage cheese (pasteurized), cream cheese (pasteurized).

MERCURY IN FISH — TIERED GUIDANCE (FDA/EPA):
- AVOID (do not generate): shark, swordfish, king mackerel, tilefish, bigeye tuna, orange roughy, marlin.
- LIMIT (max 6 oz/week — prefer other options): albacore tuna, halibut, mahi-mahi, grouper.
- PREFERRED (safe 2-3 servings/week): salmon, sardines, trout, tilapia, cod, catfish, shrimp, canned light tuna.
- When generating a fish dish, default to the preferred list. If using a limit fish, note the serving size.

CAFFEINE: Moderate levels acceptable. Do not generate beverages or dishes that would provide
more than 200mg caffeine in a single serving (approximately 1 standard coffee equivalent).
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// TRIMESTER-SPECIFIC NUTRIENT GUIDANCE
// Source: ACOG, NIH ODS, Academy of Nutrition and Dietetics
// ─────────────────────────────────────────────────────────────────────────────

const TRIMESTER_1_GUIDANCE = `
=== FIRST TRIMESTER NUTRITION PRIORITIES (Weeks 1–13) ===
KEY FOCUS: Neural tube development, nausea management, foundational nutrition.
CALORIE ADJUSTMENT: Maintain pre-pregnancy calorie intake — no increase needed in T1.

PRIORITY NUTRIENTS — emphasize in meal generation:
- FOLATE/FOLIC ACID (600–800 mcg/day): Critical for neural tube development.
  Rich sources: fortified cereals, dark leafy greens (spinach, arugula, romaine),
  lentils, black-eyed peas, asparagus, broccoli, avocado, oranges.
- IRON (27mg/day): Supports rapidly expanding blood volume.
  Rich sources: lean beef, chicken, turkey, lentils, fortified cereals, spinach
  (pair with vitamin C to enhance absorption — e.g., lemon, orange, bell pepper).
- VITAMIN B6 (1.9mg/day): Reduces nausea; supports early brain development.
  Rich sources: chicken, fish, potatoes, bananas, whole grain cereals.
- CHOLINE: Supports brain and spinal cord development.
  Rich sources: eggs, lean beef, salmon, legumes.

MEAL STRUCTURE FOR FIRST TRIMESTER:
- Small, frequent meals — nausea is common in T1.
- Easy-to-digest formats: soups, soft grains, yogurt bowls, smoothies.
- Bland-leaning but still nutritionally complete — not processed or low-nutrient.
- Avoid heavy, greasy, or strongly aromatic meals.
`.trim();

const TRIMESTER_2_GUIDANCE = `
=== SECOND TRIMESTER NUTRITION PRIORITIES (Weeks 14–27) ===
KEY FOCUS: Rapid fetal growth, bone development, increased maternal blood volume.
CALORIE ADJUSTMENT: +340 calories above pre-pregnancy baseline.

PRIORITY NUTRIENTS — emphasize in meal generation:
- PROTEIN (75–100g/day, +25g above pre-pregnancy): Supports rapid fetal tissue growth.
  Rich sources: lean meats, chicken, turkey, fish (preferred mercury tier), eggs,
  Greek yogurt, cottage cheese, legumes, tofu, edamame.
- CALCIUM (1,000mg/day): Essential for baby's bone and tooth mineralization.
  Rich sources: dairy (milk, yogurt, hard cheese), fortified plant milks,
  sardines (with bones), kale, bok choy, broccoli, almonds.
- VITAMIN D (600 IU/day): Enhances calcium absorption; supports bone development.
  Rich sources: salmon, sardines, egg yolks, fortified milk, mushrooms.
- MAGNESIUM: Supports muscle function, prevents leg cramps common in T2.
  Rich sources: dark leafy greens, nuts, seeds, whole grains, black beans.
- FIBER (25–35g/day): Prevents constipation, common in second trimester.
  Rich sources: vegetables, legumes, whole grains, fruits, chia seeds, oats.

MEAL STRUCTURE FOR SECOND TRIMESTER:
- Heartburn is common — avoid very spicy or acidic dishes; smaller meals.
- Larger portions than T1 but not overly heavy.
- Prioritize protein-rich main courses with calcium-rich sides.
`.trim();

const TRIMESTER_3_GUIDANCE = `
=== THIRD TRIMESTER NUTRITION PRIORITIES (Weeks 28–40) ===
KEY FOCUS: Brain development, iron reserves for birth, birth preparation.
CALORIE ADJUSTMENT: +450 calories above pre-pregnancy baseline.

PRIORITY NUTRIENTS — emphasize in meal generation:
- DHA (Omega-3, 200–300mg/day): Critical for baby's brain and eye development.
  Rich sources: salmon, sardines, trout, walnuts, chia seeds, flaxseed,
  DHA-fortified eggs. Prioritize preferred-mercury fish for DHA delivery.
- IRON (27mg/day): Peaks in importance — prevents third-trimester anemia.
  Pair iron-rich foods with vitamin C for absorption. Avoid calcium-rich foods
  in the same meal as high-iron foods (competes for absorption).
- CHOLINE (450mg/day): Supports final brain development and memory formation.
  Rich sources: eggs, beef, salmon, soybeans, wheat germ.
- VITAMIN K: Supports blood clotting for delivery.
  Rich sources: dark leafy greens, broccoli, Brussels sprouts, fermented dairy.
- POTASSIUM: Manages swelling common in T3; supports blood pressure regulation.
  Rich sources: bananas, sweet potato, avocado, spinach, white beans.

MEAL STRUCTURE FOR THIRD TRIMESTER:
- Smaller, more frequent meals — stomach space compressed by growing baby.
- No large, heavy meals — shortness of breath worsens with full stomach.
- High-nutrient density: every bite should count.
- Reduce sodium to help manage swelling (edema common in T3).
`.trim();

const BREASTFEEDING_GUIDANCE = `
=== BREASTFEEDING NUTRITION PRIORITIES ===
KEY FOCUS: Maternal recovery, milk production support, infant nourishment via breast milk.
CALORIE ADJUSTMENT: +500 calories above pre-pregnancy baseline.

PRIORITY NUTRIENTS — emphasize in meal generation:
- PROTEIN (71g/day): Supports milk protein synthesis and maternal tissue repair.
  Rich sources: lean meats, fish (preferred mercury tier), eggs, dairy, legumes.
- CALCIUM (1,000mg/day): Drawn from maternal reserves for breast milk — replenish actively.
  Rich sources: dairy, fortified plant milks, sardines, kale, broccoli, almonds.
- IODINE (290mcg/day): Critical for infant thyroid and brain development via breast milk.
  Rich sources: dairy, eggs, seafood (preferred list), iodized salt, seaweed (in moderation).
- DHA (200–300mg/day): Continues to support infant brain development through milk.
  Rich sources: salmon, sardines, trout, walnuts, chia seeds, flaxseed.
- VITAMIN D (600 IU/day): Important for maternal bone recovery and infant needs.
  Rich sources: salmon, sardines, fortified dairy/plant milk, egg yolks.
- HYDRATION: Increased fluid intake supports milk supply.
  Prioritize water-rich meals and beverages; avoid excess caffeine.

MERCURY RULE APPLIES DURING BREASTFEEDING:
Same fish safety tiers as pregnancy apply. Preferred fish list only (salmon, sardines,
trout, tilapia, cod, shrimp, canned light tuna).

ALCOHOL: Still zero tolerance — alcohol passes into breast milk.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// POSTPARTUM RECOVERY GUIDANCE — separate from breastfeeding
// For women who are postpartum but NOT breastfeeding.
// Focus: body recomposition, recovery, inflammation, hormone support.
// NOT a weight-loss protocol. Language must reflect recovery and nourishment.
// Sources: Academy of Nutrition and Dietetics, ACOG, NIH, Harvard T.H. Chan.
// ─────────────────────────────────────────────────────────────────────────────

const POSTPARTUM_RECOVERY_GUIDANCE = `
=== POSTPARTUM RECOVERY — BODY RECOMPOSITION & HEALING NUTRITION ===
FOCUS: Recovery after birth, inflammation reduction, hormone support, gut restoration,
skin elasticity, strength, and sustainable body recomposition.

LANGUAGE RULES — MANDATORY:
This is NOT a weight-loss protocol. Do NOT use: "lose weight," "fat burning," "belly slim,"
"shed baby weight," "get your body back," or any transformation-oriented framing.
USE INSTEAD: "recovery-supporting," "anti-inflammatory," "hormone-nourishing,"
"digestion-supportive," "collagen-building," "fiber-rich," "strength-building,"
"postpartum nourishment," "restorative."

CALORIE APPROACH — CRITICAL:
Do NOT restrict below maintenance calories. Return to pre-pregnancy maintenance baseline.
Crash dieting and extreme elimination diets (carnivore, ketogenic, very low carb)
are contraindicated in postpartum recovery because they:
- Disrupt cortisol regulation and worsen postpartum hormone imbalance
- Suppress thyroid T3 conversion, slowing metabolic recovery
- Deprive the gut microbiome of the fiber required to restore itself after birth
- Increase systemic inflammation rather than reducing it
- Impair skin elasticity and collagen rebuilding
Meals must be satisfying, nutrient-dense, and built around whole foods — not elimination.

PRIORITY NUTRIENTS — emphasize in every meal:

FIBER — FOUNDATIONAL FOR POSTPARTUM RECOVERY (25–35g/day):
Fiber supports gut restoration, estrogen clearance through the bowel, microbiome
recovery, and stable blood sugar. It is non-negotiable in this protocol.
Rich sources: oats, lentils, black beans, chickpeas, split peas, chia seeds, flaxseed,
broccoli, carrots, berries, apples with skin, whole grain bread, brown rice, quinoa,
sweet potato, avocado.
Every meal generated for a postpartum user must include a meaningful fiber source.

COMPLEX CARBOHYDRATES — KEEP THEM IN:
Complex carbs regulate cortisol, support thyroid T3 conversion, and sustain mood,
energy, and digestion. Eliminating them is the single most common postpartum mistake.
Whole grains: oats, brown rice, quinoa, farro, whole grain bread, barley.
Legumes: lentils, chickpeas, black beans, edamame — dual role as fiber and protein.
Starchy vegetables: sweet potato, squash, plantain — anti-inflammatory, nutrient-dense.
Do NOT generate low-carbohydrate, grain-free, or carnivore-style meals for postpartum.

PROTEIN (80–100g/day): Tissue repair, muscle recovery, skin collagen synthesis.
Rich sources: lean meats, poultry, fish (preferred mercury tier), eggs, Greek yogurt,
cottage cheese, legumes, tofu, edamame.
Always pair protein with fiber and complex carbs — never protein alone.

ANTI-INFLAMMATORY FATS:
Omega-3: salmon, sardines, walnuts, chia seeds, flaxseed, hemp seeds.
Monounsaturated: olive oil, avocado, avocado oil.
Avoid: excess refined seed oils, heavily processed dressings, fried foods.

SKIN ELASTICITY SUPPORT — COLLAGEN PRECURSORS:
- Vitamin C (required for collagen synthesis): bell peppers, citrus, kiwi,
  strawberries, broccoli, tomatoes.
- Zinc: pumpkin seeds, beef, chickpeas, cashews, oats, yogurt.
- Glycine-rich proteins: bone broth, quality poultry, collagen-containing cuts.

IRON REPLENISHMENT (27mg/day — recovery from birth blood loss):
Lean red meat, chicken, turkey, lentils, fortified cereals, spinach.
Always pair iron-rich foods with vitamin C to maximize absorption.

GUT HEALTH RESTORATION:
Prebiotic foods (feed beneficial bacteria): garlic, onion, leeks, asparagus,
bananas, oats, apples.
Fermented foods (rebuild microbiome): yogurt with live cultures, kefir, kimchi, miso.
Avoid heavily processed, high-sodium, low-fiber meals — they suppress microbiome recovery.

TARGETED ELIMINATIONS — WHAT ACTUALLY CAUSES PROBLEMS (not whole food groups):
- Refined sugar and ultra-processed snack foods — drive inflammation, crash energy, impair recovery.
- Ultra-processed foods: packaged snacks, fast food, refined grain products.
- Excess sodium — contributes to lingering postpartum swelling.
- Excess alcohol — disrupts hormone recovery and postpartum sleep.
NOT eliminated: whole grains, legumes, fruit, starchy vegetables, dairy, or carbohydrates.
These are recovery foods — not the problem.

MEAL STRUCTURE:
Regular balanced meals — do not skip. Skipping worsens cortisol dysregulation.
Every meal: protein + fiber source + complex carb + healthy fat. Balanced plates always.
Warm, satisfying formats: grain bowls, soups, stews, stir-fries, egg dishes.
Mood and energy support: complex carbs, omega-3s, B vitamins, iron, magnesium.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// POSTPARTUM + BREASTFEEDING SUPPLEMENT
// Used when a user is postpartum AND breastfeeding simultaneously.
// Breastfeeding calorie and nutrient needs take priority; this block adds
// the recovery/fiber/anti-inflammatory layer on top.
// ─────────────────────────────────────────────────────────────────────────────

const POSTPARTUM_BREASTFEEDING_SUPPLEMENT = `
=== POSTPARTUM BODY RECOVERY (STACKED — BREASTFEEDING TAKES CALORIE PRIORITY) ===
This user is both breastfeeding and in postpartum recovery. The +500 calorie adjustment
and milk-production nutrients above take priority. Within that framework, also apply:
- Include fiber-rich foods in every meal (legumes, whole grains, vegetables, fruit).
  Fiber supports gut recovery, estrogen clearance, and microbiome restoration.
- Include anti-inflammatory fats: salmon, sardines, walnuts, chia seeds, olive oil.
- Include collagen precursors for skin elasticity: vitamin C-rich vegetables (bell
  peppers, citrus, broccoli), zinc from seeds and legumes, quality protein with glycine.
- Do NOT restrict complex carbohydrates. They support milk supply, hormone balance,
  and postpartum recovery simultaneously.
- Include iron-rich foods paired with vitamin C to replenish birth blood loss.
- Avoid ultra-processed foods, refined sugar, and excess sodium.
- Language: use "recovery-supporting," "nourishing," "restorative" framing only.
  Do NOT use weight-loss or transformation language.
`.trim();

const TRYING_TO_CONCEIVE_GUIDANCE = `
=== PRECONCEPTION NUTRITION PRIORITIES ===
KEY FOCUS: Optimizing nutrient stores before conception; folate loading.
CALORIE ADJUSTMENT: No change from maintenance.

PRIORITY NUTRIENTS — emphasize in meal generation:
- FOLATE/FOLIC ACID: Begin 400–800 mcg/day before conception to establish neural tube
  protection reserves. Rich sources: dark leafy greens, legumes, fortified cereals,
  avocado, asparagus, broccoli, oranges.
- IRON: Establishing strong pre-conception iron stores reduces risk of deficiency.
  Rich sources: lean red meat, lentils, fortified cereals, spinach (pair with vitamin C).
- ANTIOXIDANTS: Support reproductive health. Prioritize colorful fruits and vegetables,
  berries, tomatoes, bell peppers, leafy greens. Include vitamin E (nuts, seeds, olive oil).
- OMEGA-3 DHA: Supports reproductive hormonal health and prepares for fetal brain development.
  Rich sources: salmon, sardines, walnuts, chia seeds, flaxseed.
- CHOLINE: Begin building stores before pregnancy.
  Rich sources: eggs, lean beef, salmon, legumes.

FOOD SAFETY DURING PRECONCEPTION:
- Limit high-mercury fish. Prefer the preferred fish tier.
- Avoid alcohol — no safe level established.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// SYMPTOM GUIDANCE
// ─────────────────────────────────────────────────────────────────────────────

const SYMPTOM_GUIDANCE: Record<PregnancySymptom, string> = {
  nausea:
    "NAUSEA ADAPTATION: Avoid greasy, heavily spiced, or strongly aromatic meals. " +
    "Prefer bland-leaning but nutritionally complete formats: crackers, plain rice, oatmeal, " +
    "toast-adjacent dishes, bananas, ginger-containing options (ginger tea, ginger broth, " +
    "ginger-infused smoothies). Small portions. Easy to eat slowly. No large heavy plates.",

  heartburn:
    "HEARTBURN ADAPTATION: Avoid acidic ingredients (tomato-heavy sauces, citrus as a primary " +
    "component, vinegar-forward dressings), spicy ingredients, fried or fatty foods, large " +
    "portions. Prefer alkaline-leaning, well-cooked, soft textures. Oatmeal, bananas, Greek " +
    "yogurt, baked chicken, steamed vegetables are excellent options.",

  constipation:
    "CONSTIPATION ADAPTATION: Emphasize high-fiber ingredients — vegetables, legumes, whole " +
    "grains, prunes, figs, pears, flaxseed, chia seeds, oats. Avoid low-fiber, heavily " +
    "processed carbohydrates. Include hydrating foods. Target ingredient-level dietary fiber " +
    "of 8–12g for this meal (calculated from the actual ingredients chosen, not from any " +
    "daily carbohydrate allocation target).",

  fatigue:
    "FATIGUE ADAPTATION: Prioritize iron-rich foods paired with vitamin C for maximum " +
    "absorption (spinach + lemon, beef + bell pepper, lentils + orange). Include complex " +
    "carbohydrates for sustained energy. Avoid high-sugar, high-glycemic foods that spike " +
    "then crash energy. Emphasize B vitamins: whole grains, legumes, eggs, lean meats.",

  food_aversions:
    "FOOD AVERSIONS ADAPTATION: Keep ingredients mild and familiar. Avoid strong aromas, " +
    "pungent cheeses, or any heavily seasoned preparations. Prioritize neutral, " +
    "well-cooked proteins, plain starches, and mild vegetables. " +
    "Soft textures preferred. Do not generate dishes with strong-smelling ingredients.",

  swelling:
    "SWELLING/EDEMA ADAPTATION: Keep sodium low throughout. Avoid processed or canned " +
    "ingredients with high sodium content. No added salt as a primary seasoning — " +
    "use herbs and lemon instead. Emphasize potassium-rich foods: banana, sweet potato, " +
    "avocado, spinach, white beans, salmon. Hydrating foods support fluid balance.",

  shortness_of_breath:
    "SHORTNESS OF BREATH ADAPTATION: Generate smaller portion meals (compressed stomach " +
    "and diaphragm space). No large, heavy, dense, or bloating-risk dishes. Avoid " +
    "carbonated beverages, large legume portions, or gas-producing cruciferous vegetables " +
    "in large amounts. Light, nutrient-dense, easy-to-eat formats only.",

  low_appetite:
    "LOW APPETITE ADAPTATION: Prioritize smaller, calorie-dense, nutrient-packed portions. " +
    "Avoid heavy or oversized meals. Smoothies, yogurt bowls, protein oatmeal, small " +
    "soup portions, and soft grain bowls are excellent formats. Every bite should deliver " +
    "maximum folate, iron, and protein within a small volume.",
};

// ─────────────────────────────────────────────────────────────────────────────
// SAFETY DISCLAIMER — injected into every pregnancy meal prompt
// ─────────────────────────────────────────────────────────────────────────────

const MANDATORY_SAFETY_DISCLAIMER = `
IMPORTANT — PREGNANCY SUPPORT CONTEXT:
These meals are intended as adaptive nutritional support during pregnancy only.
Do NOT include language suggesting these meals can ensure a healthy pregnancy, prevent
complications, treat gestational diabetes, prevent preeclampsia, ensure fetal health,
or guarantee any specific pregnancy outcome. Do NOT reference miscarriage, birth defects,
or specific pregnancy complications in meal descriptions.
Do NOT recommend supplements, prenatal vitamins, medications, or dosing.
All meal descriptions should be practical, nourishing, encouraging, and clinically neutral.
Frame as "pregnancy-nourishing," "folate-rich," "DHA-supportive," or "gentle on digestion"
— never as treatment, cure, prevention, or medical guarantee.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the pregnancy support guidance block for injection into the protocol envelope.
 * Returns a self-contained directive string suitable for any generator.
 */
export function buildPregnancySupportPrompt(context: PregnancySupportContext): string {
  const parts: string[] = [];

  parts.push(MANDATORY_SAFETY_DISCLAIMER);
  parts.push("");
  parts.push(FOOD_SAFETY_BLOCK);
  parts.push("");

  // Stage-specific nutrient guidance
  switch (context.stage) {
    case "trying-to-conceive":
      parts.push(TRYING_TO_CONCEIVE_GUIDANCE);
      break;
    case "trimester-1":
      parts.push(TRIMESTER_1_GUIDANCE);
      break;
    case "trimester-2":
      parts.push(TRIMESTER_2_GUIDANCE);
      break;
    case "trimester-3":
      parts.push(TRIMESTER_3_GUIDANCE);
      break;
    case "breastfeeding":
      parts.push(BREASTFEEDING_GUIDANCE);
      break;
    case "postpartum":
      if (context.isBreastfeeding) {
        // Stacked: breastfeeding calorie needs win, recovery layer added on top
        parts.push(BREASTFEEDING_GUIDANCE);
        parts.push("");
        parts.push(POSTPARTUM_BREASTFEEDING_SUPPLEMENT);
      } else {
        // Dedicated postpartum recovery protocol — body recomposition, not milk production
        parts.push(POSTPARTUM_RECOVERY_GUIDANCE);
      }
      break;
  }

  // Week context if available (T2/T3 only — adds precision)
  if (context.weekOfPregnancy && context.weekOfPregnancy > 0) {
    const week = context.weekOfPregnancy;
    parts.push(`\n=== CURRENT WEEK ===\nThis user is at Week ${week} of pregnancy. ` +
      `Tailor nutrient emphasis to this specific point in development.`);
  }

  // Symptom adaptations
  if (context.symptoms && context.symptoms.length > 0) {
    parts.push("\n=== ACTIVE PREGNANCY SYMPTOMS — ADAPT MEALS ACCORDINGLY ===");
    for (const symptom of context.symptoms) {
      if (SYMPTOM_GUIDANCE[symptom]) {
        parts.push(SYMPTOM_GUIDANCE[symptom]);
      }
    }
  }

  return parts.join("\n").trim();
}
