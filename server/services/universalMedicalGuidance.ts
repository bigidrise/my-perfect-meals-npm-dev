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
    /** Thyroid subtype — routes to subtype-specific guidance blocks. */
    thyroidType?: "hypothyroid" | "hyperthyroid" | "hashimotos" | null;
  } | null;
  /** Hormone Optimization protocol — active when "hormone-optimization" is in specialtyConditions. */
  hormoneOptimization?: boolean;
  /** Menopause protocol — active when "menopause" is in specialtyConditions. */
  menopause?: boolean;
  /** Perimenopause protocol — active when "perimenopause" is in specialtyConditions. */
  perimenopause?: boolean;
  /** Metabolic Recovery protocol — active when "metabolic-recovery" is in specialtyConditions. */
  metabolicRecovery?: boolean;
  /** Pregnancy Support context — active when "pregnancy-support" is in specialtyConditions. */
  pregnancySupportContext?: {
    active: boolean;
    stage: "trying-to-conceive" | "trimester-1" | "trimester-2" | "trimester-3" | "breastfeeding" | "postpartum";
    weekOfPregnancy: number | null;
    dueDate: string | null;
    symptoms: Array<"nausea" | "heartburn" | "constipation" | "fatigue" | "food_aversions" | "swelling" | "shortness_of_breath" | "low_appetite">;
    isBreastfeeding: boolean;
  } | null;
  /** Performance Nutrition context — active when "performance-nutrition" is in specialtyConditions. */
  performanceNutritionContext?: {
    active: boolean;
    primaryGoal: string;
    trainingType: string;
    trainingFrequency: string;
    cardioFocus: string;
    trainingPhase: string;
    twoADays: boolean;
  } | null;
  /** Competition Prep context — active when "competition-prep" is in specialtyConditions. */
  competitionPrepContext?: {
    active: boolean;
    competitionType: string;
    competitionTypeLabel: string;
    division?: string;
    eventDate: string;
    weeksOut: number;
    currentPhase: string;
    currentPhaseLabel: string;
    isPeakWeek: boolean;
    isEventDay: boolean;
    isPostEvent: boolean;
    category: "physique" | "strength" | "combat" | "wrestling" | "functional" | "endurance";
    currentWeight?: string;
    targetWeight?: string;
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
// HORMONE OPTIMIZATION
// ─────────────────────────────────────────────────────────────────────────────

const HORMONE_OPTIMIZATION_GUIDANCE = `
⚡ HORMONE OPTIMIZATION PROTOCOL — MANDATORY:
This user is actively supporting their hormonal health through nutrition. Meal generation must follow these guidelines.

PRIORITY NUTRIENTS — actively include:
- HEALTHY FATS (essential for hormone synthesis): avocado, olive oil, salmon, sardines, mackerel, egg yolks, walnuts, flaxseed, chia seeds. Every meal should include at least one healthy fat source.
- ZINC (critical for testosterone production): oysters, pumpkin seeds, lean beef, chicken, chickpeas, lentils.
- VITAMIN D / SELENIUM (hormonal signaling): salmon, sardines, eggs, Brazil nuts (1-2 only), mushrooms.
- PROTEIN FOUNDATION: lean meats (chicken, turkey, lean beef), fatty fish, eggs, Greek yogurt, legumes. Adequate protein is required at every meal — minimum 25g per meal.
- MAGNESIUM (hormone regulation, sleep quality): pumpkin seeds, dark leafy greens, dark chocolate (high cacao), almonds, black beans.
- COMPLEX CARBS (cortisol regulation): sweet potato, oats, quinoa, brown rice, lentils. Never refined or high-glycemic carbs as the primary base.

HARD BLOCKS — never include:
- NO refined sugars, sweetened beverages, candy, pastries, or high-fructose corn syrup.
- NO processed meats (bacon, sausage, deli meat, hot dogs) — these contain endocrine-disrupting compounds.
- NO seed oils (canola, vegetable, soybean, corn, sunflower) — inflammatory and hormone-disrupting. Use olive oil or avocado oil only.
- NO trans fats, partially hydrogenated oils, margarine, shortening.
- NO soy protein isolate concentrates in large amounts (normal tofu, edamame, miso are fine).
- NO alcohol of any kind.
- NO excessive caffeine as primary beverage focus; suggest water, herbal teas, green tea.

MEAL STRUCTURE:
- Every meal: protein + healthy fat + complex carb + vegetable. No single-macronutrient meals.
- Emphasize meals that support steady blood sugar — no blood sugar spikes that elevate cortisol.
- Cruciferous vegetables (broccoli, cauliflower, Brussels sprouts) are encouraged — they support healthy estrogen metabolism. Cooked or raw is fine.
- Fiber-rich meals support healthy hormone clearance — prioritize legumes, whole grains, and vegetables.

TONE: Do NOT suggest foods "boost testosterone" or use clinical hormone language. Frame meals as "hormone-supportive," "nutrient-dense," or "built to support hormonal balance." No medical claims.
`.trim();

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
      thyroidType: null,
    };
    const overlay = buildThyroidSupportPrompt(thyroidCtx);
    if (overlay.trim()) blocks.push(overlay);
  }

  if (input.hormoneOptimization) {
    blocks.push(HORMONE_OPTIMIZATION_GUIDANCE);
  }

  if (input.menopause) {
    blocks.push(`⚡ MENOPAUSE NUTRITION PROTOCOL — MANDATORY:
This user is navigating menopause. Meal generation must support hormonal stability, bone density, and metabolic health.
PRIORITY NUTRIENTS: calcium-rich foods (dairy, fortified plant milks, leafy greens, sardines); vitamin D (salmon, eggs, fortified foods, mushrooms); phytoestrogens in moderation (flaxseed, edamame, tempeh); magnesium (almonds, pumpkin seeds, dark leafy greens); omega-3s (salmon, walnuts, chia seeds).
HARD BLOCKS: NO refined sugars or high-glycemic foods as primary base; NO alcohol; NO excess caffeine as primary beverage; NO trans fats or seed oils.
MEAL STRUCTURE: Prioritize anti-inflammatory ingredients. Include lean protein (25g+ per meal) to preserve muscle mass. Complex carbohydrates only. Fiber-rich meals to support healthy estrogen metabolism.
TONE: Frame as "hormone-balancing," "bone-supportive," or "metabolically steady." No medical claims.`.trim());
  }

  if (input.perimenopause) {
    blocks.push(`⚡ PERIMENOPAUSE NUTRITION PROTOCOL — MANDATORY:
This user is in perimenopause — the hormonal transition phase. Meal generation must support fluctuating hormones, energy stability, and long-term metabolic health.
PRIORITY NUTRIENTS: phytoestrogens (flaxseed, edamame, tempeh — moderate amounts); calcium and vitamin D (dairy, fortified milks, salmon, eggs); magnesium (leafy greens, almonds, pumpkin seeds); B vitamins (whole grains, legumes, eggs); iron (lean beef, lentils, spinach).
HARD BLOCKS: NO refined sugars or blood-sugar-spiking foods; NO alcohol; NO excess caffeine; NO processed foods with endocrine-disrupting additives.
MEAL STRUCTURE: Every meal should include lean protein + healthy fat + complex carb + vegetables. Prioritize blood sugar stability — no single-macronutrient meals. Include fiber-rich foods to support estrogen clearance.
TONE: Frame as "hormone-supportive," "energy-stabilizing," or "transition-friendly." No medical claims.`.trim());
  }

  // Pregnancy Support — fires when pregnancySupportContext.active is true
  if (input.pregnancySupportContext?.active) {
    const { buildPregnancySupportPrompt } = await import('./guardrails/prompt/pregnancySupportPromptBuilder');
    const pregnancyBlock = buildPregnancySupportPrompt({
      active: true,
      stage: input.pregnancySupportContext.stage,
      weekOfPregnancy: input.pregnancySupportContext.weekOfPregnancy,
      dueDate: input.pregnancySupportContext.dueDate,
      symptoms: input.pregnancySupportContext.symptoms as any,
      isBreastfeeding: input.pregnancySupportContext.isBreastfeeding,
    });
    if (pregnancyBlock.trim()) blocks.push(pregnancyBlock);
  }

  // Competition Prep — fires when competitionPrepContext.active is true
  if (input.competitionPrepContext?.active) {
    const cCtx = input.competitionPrepContext;

    const phaseDirectives: Record<string, string> = {
      fat_loss: `FAT LOSS PHASE (${cCtx.weeksOut} weeks out):
Moderate caloric deficit (300–500 kcal/day below TDEE). Very high protein — minimum 2g/kg body weight, every meal must anchor on lean protein (≥30g). Complex carbohydrates timed around training sessions only. High fiber and volume foods for satiety. Avoid calorie-dense processed foods. All meals should be whole-food, precision-tracked.`,
      conditioning: `CONDITIONING PHASE (${cCtx.weeksOut} weeks out):
Caloric control tightening — precision matters now. Continue very high protein (≥2g/kg). Reduce simple and refined carbohydrates; concentrate complex carbs in the pre/post-training window. Anti-inflammatory ingredients prioritized to support elevated training volume. Avoid alcohol, fried foods, and high-sodium processed items. Every meal should support recovery as much as fuel.`,
      peak_prep: `PEAK PREP PHASE (${cCtx.weeksOut} weeks out):
Calorie and macro precision is critical. Begin sodium reduction — avoid high-sodium ingredients (canned foods, sauces, deli meats). Carb timing is strict: carbs pre/post training only, lower on rest days. Lean easily digestible proteins prioritized (chicken breast, white fish, egg whites). Minimize gut irritants (cruciferous veg reduced).`,
      peak_week: `⚡ PEAK WEEK — MANDATORY OVERRIDES:
LOW FIBER: Avoid high-fiber foods (no cruciferous vegetables, no beans/legumes, no whole grains with husks). Digestibility is paramount — gut distention affects stage appearance.
LOW SODIUM: Zero added sodium. No canned goods, no sauces, no deli meats. Potassium-rich foods acceptable (banana, sweet potato — moderate).
PROTEIN: Easily digestible lean proteins ONLY — chicken breast, white fish (tilapia, cod), egg whites. No red meat, no high-fat proteins.
CARBS: White rice, white potato, banana, rice cakes — fast-digesting, gut-safe. No complex whole grains.
FATS: Minimal — avoid oils, butter, full-fat dairy. Small amounts of avocado acceptable.`,
      show_day: `🏆 SHOW DAY — STRICT PROTOCOL:
All meals must be rapidly digestible. Pre-show: white rice or rice cakes + lean protein for pump. Low sodium. Minimal fiber. Avoid anything that causes bloating or water retention.`,
      meet_day: `🏋️ MEET DAY:
Pre-meet: easily digestible carbs for energy (white rice, bagel, banana). High-quality lean protein. Avoid high-fiber foods, cruciferous vegetables, beans. Hydration is critical. Between attempts: quick carbs (fruit, sports drink — no supplements mentioned).`,
      fight_day: `🥊 FIGHT DAY:
Easily digestible meals only — no fiber, no heavy fat, no complex carbs. Pre-fight: easily digestible carbs + lean protein (4–5 hours out). Hydration and electrolyte balance critical (sodium, potassium, magnesium).`,
      competition_day: `🏅 COMPETITION DAY:
Easily digestible carbs for energy. Avoid high-fiber, high-fat foods. Lean protein. Gut comfort is priority. Hydration optimized for performance.`,
      race_day: `🏃 RACE DAY:
Pre-race: high-carb, easily digestible meal 3–4 hours before start (oatmeal, banana, white rice, toast). Minimal fiber and fat. During: carb-dense easily digestible options. Post-race: carb + protein recovery meal within 45 minutes.`,
      taper: `TAPER PHASE (${cCtx.weeksOut} weeks out — endurance):
Carb loading begins now — increase carbohydrate intake to 8–10g/kg. Reduce training volume, increase calorie intake. In the final 2–3 days: reduce fiber (no raw cruciferous, no legumes, no whole grains with husks). Day-before: high-carb, gut-safe meal (white pasta, white rice, banana). Lean protein maintained throughout.`,
      weight_cut: `⚠️ WEIGHT CUT — MANDATORY OVERRIDES:
VERY LOW SODIUM: Zero added sodium. No canned foods, no sauces, no processed meats. Fresh ingredients only.
LOW CARB: Glycogen depletion strategy — minimal starchy carbs. Non-starchy vegetables only (greens, zucchini, cucumber).
MINIMAL FIBER: Easy-digesting foods only. Avoid cruciferous vegetables, legumes, beans.
LEAN PROTEIN: Chicken breast, white fish, egg whites. Minimize fats.
REHYDRATION: After weigh-in, rapidly digestible carbs + electrolytes (sodium, potassium, magnesium). This is critical — rehydration meals must be included.`,
      fight_week: `⚠️ FIGHT WEEK:
Water and sodium manipulation protocol. Low sodium, low fiber, easily digestible. Controlled carbs. Rehydration and electrolyte recovery meals are critical between weigh-in and fight.`,
      championship_week: `CHAMPIONSHIP WEEK (wrestling):
Weight management precision. Low sodium, controlled carbs, lean protein. Easily digestible foods for weigh-in management. Recovery nutrition after weigh-in critical.`,
      in_season: `IN-SEASON MAINTENANCE (wrestling):
Performance nutrition — maintain weight class while fueling training. High protein, moderate carbs timed around training, anti-inflammatory recovery foods. Weight management awareness throughout.`,
      intensity_phase: `INTENSITY PHASE (${cCtx.weeksOut} weeks out — strength):
High caloric intake to support maximal strength training. Very high protein (≥1.8g/kg). High carbohydrate intake — carb load around heavy training sessions. CNS recovery foods: magnesium-rich (leafy greens, dark chocolate), zinc-rich (lean beef, pumpkin seeds), omega-3 rich (salmon, sardines).`,
      meet_week: `MEET WEEK (strength):
Carb loading — increase total carbohydrates significantly (target 8–10g/kg body weight). Maintain high protein. Reduce fiber 24h before meet (no beans, legumes, cruciferous veg). Day of: easily digestible high-carb meals (white rice, white potato, banana, bagel). Between attempts: quick carbs only.`,
      strength_building: `STRENGTH BUILDING PHASE (${cCtx.weeksOut} weeks out):
High caloric surplus — support maximum strength and hypertrophy. Very high protein (≥1.8g/kg). High carbohydrates for fuel and glycogen. Calorie-dense whole foods. CNS-supportive nutrients: iron, zinc, magnesium. No caloric restriction.`,
      conditioning_combat: `CONDITIONING CAMP (${cCtx.weeksOut} weeks out):
High energy demand — multiple daily sessions. High carbohydrate intake to fuel aerobic and anaerobic systems. High protein for recovery. Electrolyte-rich foods. Anti-inflammatory ingredients. No caloric restriction — fuel the work.`,
      fight_prep: `FIGHT PREP PHASE (${cCtx.weeksOut} weeks out):
Performance + weight management balance. Moderate calorie deficit if weight cut is needed later. High protein. Carbs timed around training. Anti-inflammatory recovery focus. Electrolyte awareness begins.`,
      event_prep: `EVENT PREP (${cCtx.weeksOut} weeks out — functional fitness):
High carbohydrate intake for mixed-modality demands. High protein recovery. Gut-friendly foods — avoid gut irritants before training. Zone 2–5 fuel coverage: carb timing around sessions. Anti-inflammatory support.`,
      base_conditioning: `BASE CONDITIONING (${cCtx.weeksOut} weeks out — functional fitness):
Build aerobic base and strength simultaneously. Balanced macros. High protein for recovery. Moderate-high carbohydrates. Whole food priority. No caloric restriction.`,
      build_phase: `BUILD PHASE (${cCtx.weeksOut} weeks out — endurance):
Volume is increasing. High carbohydrate intake (6–8g/kg). High protein for tissue repair. Electrolytes and sodium important for long sessions. Anti-inflammatory post-workout foods. No caloric restriction.`,
      base_building: `BASE BUILDING (${cCtx.weeksOut} weeks out — endurance):
Aerobic foundation. Moderate-high carbohydrates for long slow distance work. High protein for adaptation. Emphasis on whole foods, anti-inflammatory ingredients. Fat adaptation foods acceptable (nuts, olive oil, fatty fish).`,
      race_prep: `RACE PREP / PEAK TRAINING (${cCtx.weeksOut} weeks out — endurance):
Highest volume phase — maximum carbohydrate needs (7–10g/kg). Very high caloric intake. Lean protein for tissue repair. Electrolytes critical. Gut training — practicing race-day foods in training.`,
      post_competition: `POST-COMPETITION RECOVERY:
INCREASE calories — do NOT restrict. Reverse diet or refeed as appropriate. Anti-inflammatory foods prioritized: omega-3 rich fish, colorful vegetables, tart cherries, turmeric, ginger. Nutritional diversity — eat a wide variety of whole foods after weeks of restriction. Sleep and recovery supporting foods. No caloric limitation.`,
      post_race: `POST-RACE RECOVERY:
INCREASE calories. Immediate post-race: carb + protein meal (within 45 minutes). Next 48h: anti-inflammatory foods, lean protein, complex carbs. Rehydration with electrolytes. Nutritional diversity encouraged. No restrictions.`,
      off_season: `OFF-SEASON (wrestling):
Recovery and rebuilding. Increase calories to healthy maintenance. Diverse whole foods. High protein for muscle recovery and maintenance. No weight class restrictions. Anti-inflammatory focus.`,
      pre_season: `PRE-SEASON (wrestling):
Begin conditioning nutrition. Moderate caloric intake. High protein. Carbs timed around increasing training load. Weight management awareness as season approaches.`,
    };

    const directive = phaseDirectives[cCtx.currentPhase] ?? `COMPETITION PREP — ${cCtx.currentPhaseLabel} (${cCtx.weeksOut} weeks out): High protein, precision macros, whole foods only.`;

    blocks.push(`🏆 COMPETITION PREP PROTOCOL — MANDATORY:
This athlete is in active competition preparation. All meal generation MUST align with their competition timeline and current phase. This overrides general nutrition defaults.
COMPETITION PROFILE:
- Event: ${cCtx.competitionTypeLabel}${cCtx.division ? ` — ${cCtx.division}` : ""}
- Event Date: ${cCtx.eventDate}
- Weeks Out: ${cCtx.weeksOut < 0 ? "Event complete" : `${cCtx.weeksOut} weeks`}
- Current Phase: ${cCtx.currentPhaseLabel}${cCtx.currentWeight ? `\n- Current Weight: ${cCtx.currentWeight}` : ""}${cCtx.targetWeight ? `\n- Target: ${cCtx.targetWeight}` : ""}
${directive}
HARD BLOCKS: NO alcohol. NO processed fast food. NO deep-fried foods. NO high-sodium processed meats (especially during weight management phases). NO meal that contradicts the phase protocol above.
TONE: Frame meals as "competition prep," "fueling your prep," "phase-specific," or "event-ready." Science-informed. No supplement recommendations. No medical claims.`.trim());
  }

  // Performance Nutrition — fires when performanceNutritionContext.active is true
  if (input.performanceNutritionContext?.active) {
    const pCtx = input.performanceNutritionContext;
    const goalMap: Record<string, string> = {
      fat_loss: "fat loss while preserving lean mass",
      muscle_gain: "muscle hypertrophy and anabolism",
      maintenance: "performance maintenance and body composition stability",
      performance: "peak athletic output and energy system efficiency",
    };
    const phaseMap: Record<string, string> = {
      off_season: "off-season (volume focus, caloric surplus acceptable)",
      pre_season: "pre-season (conditioning ramp, moderate deficit allowed)",
      in_season: "in-season (performance maintenance, recovery priority)",
      weight_cut: "active weight cut (short-term aggressive deficit, rehydration focus)",
      recovery: "recovery phase (anti-inflammatory foods, repair priority)",
    };
    const trainingMap: Record<string, string> = {
      strength: "strength training (compound lifts, neural adaptation)",
      hypertrophy: "hypertrophy training (high volume, muscle damage/repair cycle)",
      powerlifting: "powerlifting (maximal force, CNS intensive)",
      olympic_lifting: "Olympic lifting (explosive power, skill-based)",
      mma: "mixed martial arts (multiple energy systems, weight class management)",
      boxing: "boxing (glycolytic/aerobic mix, hand speed and endurance)",
      wrestling: "wrestling (explosive strength, lactate tolerance)",
      bjj: "Brazilian jiu-jitsu (endurance-dominant, positional strength)",
      crossfit: "CrossFit (mixed modality, aerobic + anaerobic)",
      endurance_running: "endurance running (aerobic base, carbohydrate dependency)",
      cycling: "cycling (aerobic power, glycogen management)",
      triathlon: "triathlon (three-discipline aerobic endurance)",
      tactical: "tactical/military fitness (occupational readiness, load-bearing endurance)",
      general_fitness: "general fitness (balanced energy systems)",
    };
    const cardioMap: Record<string, string> = {
      none: "no dedicated cardio",
      recovery: "active recovery cardio only (Zone 1)",
      zone_2: "Zone 2 aerobic base building (fat oxidation priority)",
      tempo: "tempo/aerobic threshold work (Zone 3)",
      threshold: "lactate threshold training (Zone 4)",
      hiit: "HIIT/sprint intervals (Zone 5, high glycolytic demand)",
      mixed: "mixed cardio modalities across zones",
    };

    const goalLabel = goalMap[pCtx.primaryGoal] ?? pCtx.primaryGoal;
    const phaseLabel = phaseMap[pCtx.trainingPhase] ?? pCtx.trainingPhase;
    const trainingLabel = trainingMap[pCtx.trainingType] ?? pCtx.trainingType;
    const cardioLabel = cardioMap[pCtx.cardioFocus] ?? pCtx.cardioFocus;

    // Carb strategy based on training type + cardio focus
    const isHighGlycolytic = ["mma", "boxing", "wrestling", "bjj", "crossfit", "hiit", "threshold"].includes(pCtx.trainingType + " " + pCtx.cardioFocus) ||
      ["hiit", "threshold"].includes(pCtx.cardioFocus) ||
      ["mma", "boxing", "wrestling", "bjj", "crossfit"].includes(pCtx.trainingType);
    const isStrengthDominant = ["strength", "powerlifting", "olympic_lifting", "hypertrophy"].includes(pCtx.trainingType);
    const isEnduranceDominant = ["endurance_running", "cycling", "triathlon"].includes(pCtx.trainingType) || pCtx.cardioFocus === "zone_2";

    let carbDirective = "";
    if (isEnduranceDominant) {
      carbDirective = "CARBOHYDRATE PRIORITY: High — glycogen is the primary limiting fuel. Prioritize complex carbohydrates at every meal. Pre-workout: fast-digesting carbs (banana, white rice, oats). Post-workout: carb+protein combination for glycogen resynthesis.";
    } else if (isHighGlycolytic) {
      carbDirective = "CARBOHYDRATE PRIORITY: Moderate-High — glycolytic system demands rapid glucose availability. Include starchy carbs around training windows. Pre-training: moderate carb load. Post-training: fast carb + protein for recovery.";
    } else if (isStrengthDominant) {
      carbDirective = "CARBOHYDRATE PRIORITY: Moderate — creatine phosphate and glycolytic systems; carb timing around sessions matters more than total volume. Pre-workout: moderate carbs. Post-workout: protein-forward with supporting carbs.";
    } else {
      carbDirective = "CARBOHYDRATE PRIORITY: Balanced — match carb intake to training demand. Concentrate starchy carbs in the pre/post-training window.";
    }

    blocks.push(`🏋️ PERFORMANCE NUTRITION PROTOCOL — MANDATORY:
This athlete is on a sport-specific fueling protocol. All meal generation must align with their training demands and phase.
ATHLETE PROFILE:
- Sport/Training: ${trainingLabel}
- Training Frequency: ${pCtx.trainingFrequency} sessions/week${pCtx.twoADays ? " (2-a-days active)" : ""}
- Primary Goal: ${goalLabel}
- Current Phase: ${phaseLabel}
- Cardio Focus: ${cardioLabel}
${carbDirective}
PROTEIN REQUIREMENT: Minimum 1.6–2.2g/kg body weight daily. Every meal must be protein-anchored (≥30g). Protein sources should match training type — ${isStrengthDominant ? "lean meats, eggs, dairy, whey-compatible foods" : "lean meats, fish, legumes, whole food sources"}.
MEAL TIMING AWARENESS: Pre-workout meals should be easily digestible (lower fiber, moderate fat). Post-workout meals prioritize protein + carbs within 45-60 minutes of training. Rest day meals can be slightly lower in total calories and carbs.
${pCtx.trainingPhase === "weight_cut" ? "WEIGHT CUT ALERT: This athlete is in an active weight cut. Prioritize low-sodium, easily digestible, calorie-controlled meals. Support rehydration with electrolyte-conscious ingredients (potassium-rich vegetables, low-sodium options)." : ""}
${pCtx.trainingPhase === "recovery" ? "RECOVERY PHASE: Prioritize anti-inflammatory ingredients (omega-3 rich fish, colorful vegetables, tart cherries, turmeric, ginger). Moderate calorie intake. Sleep and gut health supporting foods." : ""}
${pCtx.twoADays ? "2-A-DAYS: This athlete trains twice per day. Intermediate recovery meals between sessions are critical — suggest quick-digesting carb + protein options (rice cakes + turkey, banana + Greek yogurt, etc.)." : ""}
HARD BLOCKS: NO processed fast food, deep-fried foods, or sugar-dense meals as primary output unless user explicitly describes a treat meal. NO alcohol in any performance-focused meal.
TONE: Frame meals as "fueling," "recovery," "pre-training," or "post-training" where relevant. Science-informed, practical, no supplements mentioned.`.trim());
  }

  if (input.metabolicRecovery) {
    blocks.push(`⚡ METABOLIC RECOVERY PROTOCOL — MANDATORY:
This user is actively recovering metabolic function. Meal generation must support insulin sensitivity, energy regulation, and cellular repair.
PRIORITY NUTRIENTS: lean proteins (chicken, turkey, fish, legumes — 25–35g per meal); fiber (vegetables, legumes, whole grains — minimum 25g/day); healthy fats (avocado, olive oil, walnuts, fatty fish); chromium-supportive foods (broccoli, whole grains, lean beef); antioxidant-rich foods (berries, leafy greens, colorful vegetables).
HARD BLOCKS: NO refined sugars, high-fructose corn syrup, or sweetened beverages; NO refined white carbohydrates as primary base; NO seed oils (canola, soybean, vegetable, sunflower); NO trans fats; NO processed snack foods.
MEAL STRUCTURE: Every meal must stabilize blood sugar — pair protein with fiber and fat at every meal. Prioritize complex carbohydrates with low glycemic impact. Avoid large gaps between meals that trigger cortisol spikes.
TONE: Frame as "metabolically restorative," "insulin-supportive," or "energy-regulating." No medical claims.`.trim());
  }

  return blocks;
}
