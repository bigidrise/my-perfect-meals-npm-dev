/**
 * Thyroid Support Nutritional Protocol Overlay Prompt Builder
 *
 * Builds on top of the existing anti-inflammatory prompt to add
 * thyroid-aware adaptive guidance. This is an ADDITIVE MODIFIER —
 * it does NOT replace the primary clinical mode.
 *
 * Activation: specialtyCondition === 'thyroid-support' OR thyroid lab thresholds crossed.
 *
 * SAFETY RULES:
 *   1. NEVER suggest food can cure, reverse, heal, or treat thyroid disease.
 *   2. NEVER recommend supplements, medications, or dosing.
 *   3. NEVER block cruciferous vegetables — this is wellness mythology. Smart limits only.
 *   4. Medication timing awareness (Levothyroxine) is the highest-value clinical feature.
 *   5. All output is adaptive nutrition support — not medical decision-making.
 *
 * Sources: American Thyroid Association (ATA), American Association of Clinical
 * Endocrinology (AACE), Endocrine Society, NIH ODS.
 */

export interface ThyroidSupportContext {
  /** Whether the thyroid support protocol is active for this user. */
  active: boolean;
  /**
   * The user's thyroid medication name if disclosed (e.g., "Levothyroxine", "Synthroid",
   * "Armour Thyroid", "Liothyronine"). null = no medication disclosed.
   * Used for medication timing awareness in meal planning.
   */
  medication: string | null;
  /**
   * Whether the protocol was activated by abnormal lab values (true) vs. self-selection (false).
   * Used to calibrate guidance intensity.
   */
  labDriven: boolean;
  /** Whether antibody markers were elevated (autoimmune pattern — Hashimoto's). */
  isAutoimmune: boolean;
  /**
   * Thyroid subtype — routes to subtype-specific guidance blocks.
   * 'hypothyroid' = underactive thyroid (selenium/zinc focus, metabolic regularity)
   * 'hyperthyroid' = overactive thyroid (iodine restriction, caloric density)
   * 'hashimotos' = autoimmune thyroid (strengthened anti-inflammatory, gluten-minimal)
   * null = generic thyroid support (existing behavior)
   */
  thyroidType?: "hypothyroid" | "hyperthyroid" | "hashimotos" | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEDICATION TIMING AWARENESS
// This is the highest-value clinical differentiator. Most nutrition apps
// don't think about this. We do.
// ─────────────────────────────────────────────────────────────────────────────

const LEVOTHYROXINE_MEDICATIONS = new Set([
  "levothyroxine", "synthroid", "tirosint", "unithroid", "levoxyl",
  "levo-t", "armour thyroid", "nature-throid", "wp thyroid",
  "liothyronine", "cytomel", "np thyroid",
]);

function isLevothyroxineType(medication: string | null): boolean {
  if (!medication) return false;
  return LEVOTHYROXINE_MEDICATIONS.has(medication.toLowerCase().trim());
}

const MEDICATION_TIMING_GUIDANCE = `
=== THYROID MEDICATION TIMING AWARENESS ===
This user takes thyroid hormone replacement medication. Thyroid medications are typically
taken first thing in the morning on an empty stomach and require a waiting period before
eating. The following foods can interfere with thyroid hormone absorption when eaten too
close to medication time. This is about TIMING, not total elimination.

TIMING-SENSITIVE FOODS (avoid in the meal immediately following medication — typically breakfast):
- HIGH FIBER MEALS immediately after dosing: large amounts of bran, oat bran, psyllium husk,
  high-fiber cereal. Normal fiber amounts throughout the day are completely fine and encouraged.
- CALCIUM-RICH FOODS at the same time as medication: milk, yogurt, calcium-fortified juice.
  These can reduce absorption by up to 25%. Fine to eat later in the day — not a daily ban.
- IRON-RICH FOODS close to medication time: iron supplements, iron-fortified foods, red meat
  as a primary breakfast protein immediately after dosing.
- COFFEE: coffee (especially with calcium-containing creamers) can reduce levothyroxine
  absorption when consumed within 30-60 minutes of the medication. Plain water is ideal
  at medication time. Coffee is completely fine later in the morning.

WHAT THIS MEANS FOR MEAL PLANNING:
- Breakfast meals for this user should be moderate-fiber, relatively low-calcium, and
  not centered on iron supplementation or iron-heavy proteins.
- Eggs, avocado toast on whole grain, fruit and oatmeal (not bran-heavy), and light protein
  smoothies are excellent thyroid-friendly breakfasts.
- Full-fat Greek yogurt, large milk-based smoothies, or high-bran cereals are better
  as mid-morning snacks or later meals — not as the primary post-medication breakfast.
- Do NOT tell the user when to take their medication. Only shape the meal content and
  describe it as "thyroid medication-friendly" or "gentle on thyroid absorption timing."
`;

const NON_MEDICATED_TIMING_NOTE = `
=== THYROID SUPPORT MEAL TIMING NOTE ===
For optimal thyroid and metabolic function, prefer meals that:
- Distribute protein and fiber throughout the day rather than front-loading fiber in isolation.
- Include selenium-rich foods daily — this supports thyroid hormone conversion.
- Avoid prolonged fasting or very large meals, which can stress metabolic thyroid regulation.
`;

// ─────────────────────────────────────────────────────────────────────────────
// CORE OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

const MANDATORY_SAFETY_DISCLAIMER = `
IMPORTANT — THYROID SUPPORT CONTEXT:
These meals are intended as adaptive nutritional support only. Do NOT include language
suggesting these meals can heal, reverse, cure, treat, or fix thyroid disease or autoimmune
thyroid conditions. Do NOT reference "thyroid detox", "thyroid cleanse", "thyroid healing
protocol", "reverse Hashimoto's", or "boost your thyroid naturally."
All meal descriptions should be practical, nourishing, and clinically neutral in tone.
Do NOT recommend supplements, herbs, iodine doses, or any specific therapeutic agents.
`;

const SELENIUM_GUIDANCE = `
=== SELENIUM PRIORITY (THYROID HORMONE CONVERSION) ===
Selenium is required for T4→T3 thyroid hormone conversion. Include selenium-rich foods
regularly across meals:
- Protein anchors: salmon, sardines, tuna, shrimp, chicken, eggs
- Nuts: Brazil nuts (highest dietary selenium — 1-2 Brazil nuts meets daily needs; do not
  suggest eating handfuls, only 1-2 as a garnish/snack)
- Legumes: chickpeas, lentils
Include at least one selenium-rich protein as the primary protein anchor in every meal.
`;

const ANTI_INFLAMMATORY_AUTOIMMUNE_NOTE = `
=== AUTOIMMUNE THYROID SUPPORT (ANTI-INFLAMMATORY EMPHASIS) ===
This user's thyroid indicators include an autoimmune pattern. Anti-inflammatory nutrition
is especially important. Emphasize:
- Omega-3 rich proteins: salmon, sardines, mackerel (reduce systemic inflammation)
- Colorful antioxidant vegetables: spinach, arugula, beets, bell peppers, broccoli
- Polyphenol-rich fruits: blueberries, raspberries, strawberries, tart cherries
- Turmeric with black pepper (curcumin + piperine bioavailability)
- Ginger, garlic, rosemary
- Minimal ultra-processed food, no added sugars, no refined grains as primary carbs
`;

const HASHIMOTOS_EXTENDED_NOTE = `
=== HASHIMOTO'S THYROIDITIS — ENHANCED AUTOIMMUNE PROTOCOL ===
This user has Hashimoto's Thyroiditis (autoimmune hypothyroid). Apply these additional guidelines:
- GLUTEN-MINIMAL preference: many Hashimoto's patients benefit from reducing gluten. Default to gluten-free
  or whole-grain versions of any bread, pasta, or grain component unless the user has explicitly chosen otherwise.
  This is a preference, not an absolute ban — do not refuse gluten-containing meals, but prefer alternatives.
- NO REFINED CARBS as primary starch: white bread, white pasta, refined crackers as the main carb base are discouraged.
  Upgrade to sweet potato, quinoa, brown rice, or whole grain alternatives.
- DAIRY-LIGHT: some Hashimoto's patients are dairy-sensitive. When including dairy, prefer Greek yogurt, aged
  hard cheeses, or goat cheese over large amounts of milk or soft cheese. Do not eliminate dairy.
- BONE BROTH and collagen-rich preparations are excellent and encouraged — gut lining support.
- SELENIUM + ZINC emphasis is especially critical for Hashimoto's: Brazil nuts (1-2 only), pumpkin seeds,
  salmon, eggs. Include at every opportunity.
- FERMENTED FOODS encouraged: yogurt, kefir, kimchi, sauerkraut, miso — gut microbiome supports autoimmune balance.
- NO HARD BLOCK on soy — normal culinary soy in food-based amounts is acceptable. Avoid soy protein isolate supplements.
`;

const HYPOTHYROID_NOTE = `
=== HYPOTHYROID SUPPORT (UNDERACTIVE THYROID) ===
This user has hypothyroidism (underactive thyroid). The following guidance applies:
- METABOLIC REGULARITY: prefer balanced, regular-interval meals over large infrequent meals.
  Skipping meals can worsen hypothyroid fatigue and metabolic sluggishness.
- IRON-RICH FOODS at non-medication meal times: lean red meat, chicken, legumes, pumpkin seeds.
  Iron supports red blood cell oxygen delivery, which is often reduced in hypothyroid patients.
- AVOID EXCESSIVE RAW GOITROGENIC FOODS: limit very large amounts of raw cruciferous vegetables
  (kale, Brussels sprouts, broccoli, cabbage) at a single meal. Cooked cruciferous is completely fine
  and encouraged. This is a "smart limit" for raw/juiced concentrations only — do not eliminate these foods.
- CALORIC AWARENESS: hypothyroid patients often have slowed metabolism. Prefer nutrient-dense but
  not calorie-excessive meals. Avoid very heavy, calorie-dense preparations as a default.
- SELENIUM and ZINC are especially important (see core overlay above).
`;

const HYPERTHYROID_NOTE = `
=== HYPERTHYROID SUPPORT (OVERACTIVE THYROID) ===
This user has hyperthyroidism (overactive thyroid). The following guidance applies:
- IODINE RESTRICTION — IMPORTANT: Excess dietary iodine can worsen hyperthyroid symptoms by stimulating
  thyroid hormone production. Apply the following smart restrictions:
  • LIMIT high-iodine seafood: no kelp, no seaweed sheets/wraps as a featured ingredient. Occasional small
    amounts of nori in sushi are acceptable. Avoid sea vegetables (kombu, wakame, dulse) as primary ingredients.
  • Standard seafood (salmon, tuna, shrimp, cod, tilapia) is completely fine — these are moderate-iodine and important
    for selenium. Do not restrict general seafood.
  • DAIRY CAUTION: milk, cheese, and yogurt are moderate-iodine sources. They are not banned, but avoid making
    dairy a dominant ingredient across multiple components of the same meal. One dairy element per meal is fine.
  • IODIZED SALT: prefer sea salt or kosher salt references over iodized table salt.
  • No iodine supplements mentioned.
- CALORIC SUPPORT: hyperthyroid patients often have elevated metabolism and may lose weight unintentionally.
  Prefer more calorie-dense, satisfying meals. Include healthy fats (avocado, olive oil, nuts) and protein
  generously. Do not default to light or diet-style meals.
- HIGH CALCIUM emphasis: hyperthyroidism can accelerate bone loss. Include calcium-rich foods: Greek yogurt,
  low-fat dairy, broccoli, kale, almonds, fortified plant milk. Pair with Vitamin D sources (salmon, eggs).
- PROTEIN PRIORITY: adequate protein supports muscle preservation. Minimum 25-30g per main meal.
- AVOID STIMULANTS as primary beverage features: no energy drinks, no high-caffeine drinks as the featured
  beverage. Water, herbal teas, and non-stimulant options preferred.
`;

const SOY_NOTE = `
=== SOY GUIDANCE (SMART LIMITS, NOT ELIMINATION) ===
Regular culinary soy — tofu, edamame, miso, tempeh, soy sauce in small amounts — is
completely acceptable and should not be avoided. This is NOT a soy-free protocol.
The smart limit applies only to soy ISOLATE concentrates (protein powders, textured soy
protein, soy flour as a primary ingredient) in very large quantities, as these may interfere
with thyroid hormone absorption when consumed in excess. Normal food-based soy is fine.
`;

/**
 * Build the thyroid support overlay prompt section.
 * Injected AFTER the anti-inflammatory base prompt.
 */
export function buildThyroidSupportPrompt(context: ThyroidSupportContext): string {
  if (!context.active) return "";

  const lines: string[] = [
    "--- THYROID SUPPORT NUTRITIONAL OVERLAY ---",
    "",
    "This meal is being generated for a user with Thyroid Support active.",
    "This is an adaptive nutritional modifier — anti-inflammatory rules remain fully active.",
    "",
    MANDATORY_SAFETY_DISCLAIMER.trim(),
    "",
    "=== HARD BLOCK — NEVER INCLUDE ===",
    "- Iodine supplements, kelp supplements, seaweed supplements (not nori in small food amounts)",
    "- Alcohol of any kind",
    "- Ultra-processed foods, fast food, deep fried foods, soda, energy drinks",
    "",
    "=== SMART LIMITS (excessive amounts only — not elimination) ===",
    "- Soy protein ISOLATE / textured soy protein in very large quantities",
    "  (Regular tofu, edamame, miso, soy sauce are ALL acceptable — no culinary soy ban)",
    "- Very large volumes of raw cruciferous vegetables in a single meal",
    "  (Cooking cruciferous is always fine and encouraged — never tell user to avoid them)",
    "- Millet as a primary grain (mild goitrogenic potential when eaten in bulk)",
    "",
    SELENIUM_GUIDANCE.trim(),
    "",
  ];

  // Subtype routing — applied after the core overlay
  const subtype = context.thyroidType ?? null;

  if (subtype === "hashimotos") {
    // Hashimoto's: full autoimmune base + extended Hashimoto's-specific overlay
    lines.push(ANTI_INFLAMMATORY_AUTOIMMUNE_NOTE.trim());
    lines.push("");
    lines.push(HASHIMOTOS_EXTENDED_NOTE.trim());
    lines.push("");
  } else if (subtype === "hyperthyroid") {
    // Hyperthyroid: iodine restriction + caloric density support
    lines.push(HYPERTHYROID_NOTE.trim());
    lines.push("");
  } else if (subtype === "hypothyroid") {
    // Hypothyroid: metabolic regularity + iron + smart cruciferous limits
    lines.push(HYPOTHYROID_NOTE.trim());
    lines.push("");
  } else if (context.isAutoimmune) {
    // Legacy / lab-driven autoimmune signal with no explicit subtype
    lines.push(ANTI_INFLAMMATORY_AUTOIMMUNE_NOTE.trim());
    lines.push("");
  }

  lines.push(SOY_NOTE.trim());
  lines.push("");

  if (context.medication && isLevothyroxineType(context.medication)) {
    lines.push(MEDICATION_TIMING_GUIDANCE.trim());
    lines.push("");
    lines.push(`Note: This user's disclosed thyroid medication is ${context.medication}.`);
    lines.push("Shape meal content as described above — especially for breakfast.");
    lines.push("Do NOT tell the user when to take their medication.");
    lines.push("");
  } else if (!context.medication) {
    lines.push(NON_MEDICATED_TIMING_NOTE.trim());
    lines.push("");
  }

  lines.push("=== PRIORITY FOODS — INCLUDE REGULARLY ===");
  lines.push("PROTEINS (selenium-rich): salmon, sardines, tuna, eggs, chicken, shrimp");
  lines.push("VEGETABLES: broccoli (cooked preferred), spinach, arugula, cauliflower, beets, bell peppers");
  lines.push("FRUITS: blueberries, raspberries, strawberries");
  lines.push("HEALTHY FATS: olive oil, avocado, walnuts");
  lines.push("ZINC-RICH: pumpkin seeds, chickpeas, lentils, lean beef");
  lines.push("FIBER BASE: oats, quinoa, brown rice, sweet potato");
  lines.push("SPICES: turmeric (with black pepper), ginger, garlic, rosemary");
  lines.push("");
  lines.push("=== QUALITY CHECKLIST — EVERY THYROID SUPPORT MEAL ===");
  lines.push("✅ SELENIUM-RICH PROTEIN — salmon, sardines, tuna, eggs, chicken, or shrimp");
  lines.push("✅ ANTI-INFLAMMATORY VEGETABLES — at least one colorful vegetable");
  lines.push("✅ HEALTHY FAT — olive oil, avocado, walnuts, or seeds");
  lines.push("✅ FIBER ANCHOR — oats, quinoa, brown rice, sweet potato, or legumes");
  lines.push("✅ LANGUAGE CHECK — no healing, detox, cure, or boost claims");
  lines.push("");
  lines.push("If medication timing is relevant, describe breakfast as 'thyroid medication-friendly' naturally,");
  lines.push("not as a medical instruction. Keep tone warm, practical, and nourishing.");
  lines.push("");
  lines.push("--- END THYROID SUPPORT NUTRITIONAL OVERLAY ---");

  return lines.join("\n");
}

/**
 * Check whether thyroid support is active for a user
 * based on their specialtyCondition or explicit flag.
 */
export function isThyroidSupportActive(
  specialtyCondition: string | null | undefined,
  hasThyroidFlag?: boolean,
): boolean {
  return specialtyCondition === "thyroid-support" || !!hasThyroidFlag;
}
