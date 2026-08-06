/**
 * pediatricProtocolRegistry.ts
 *
 * Versioned protocol blocks for pediatric medical conditions.
 * Each block injects as a conditionGuidanceBlock[] entry into the AI prompt,
 * exactly mirroring the adult engine pattern in universalMedicalGuidance.ts.
 *
 * Priority tiers (hardcoded, not AI-decided):
 *   1  = Life-threatening safety (allergens, PKU, G-tube, early_infant)
 *   2  = Developmental stage hard stops
 *   3  = Medical condition hard limits
 *   4  = Growth context
 *   5  = Sensory and feeding development
 *   6  = Medical optimization
 *   7  = Family goals and preferences
 *   8  = Kitchen reality
 *
 * Design rules:
 *   - Each block is self-contained — no cross-block references in text.
 *   - Guidance is directive, not conversational.
 *   - No medication dosing, clinical diagnosis, or treatment instruction language.
 *   - Never label a child's body. Weight-neutral framing always.
 */

import { getApprovedProtocolIds } from "./clinicalEvidenceRegistry";

export type ProtocolPriorityTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface PediatricProtocolBlock {
  /** Matches conditionId in clinicalEvidenceRegistry */
  conditionId: string;
  /** Human-readable name — used in conflict log */
  conditionName: string;
  /** Priority tier — lower number wins conflicts */
  priorityTier: ProtocolPriorityTier;
  /**
   * Condition keys that trigger this protocol from the child profile's
   * medical_conditions array (lowercase, normalized).
   */
  triggerKeys: string[];
  /**
   * When true: meal generation is completely blocked. The resolver returns
   * a hard-stop response without calling AI. Used for PKU, G-tube, and
   * any condition where meal generation is clinically unsafe without
   * specialist oversight.
   */
  hardStop?: boolean;
  /** Human-readable reason shown to the parent when hardStop is true. */
  hardStopMessage?: string;
  /**
   * When true: every generated output must include a mandatory note
   * directing the family to their pediatrician before acting on this meal.
   * Displayed prominently in the Resolver Inspector.
   */
  requiresClinicianFlag: boolean;
  /**
   * When true: every generated output must include a mandatory note
   * directing the family to a registered pediatric dietitian.
   * Displayed prominently in the Resolver Inspector.
   */
  requiresDietitianFlag: boolean;
  /**
   * Prompt-ready guidance block.
   * Injected verbatim into the system prompt — must be directive and precise.
   */
  guidance: string;
  /**
   * Specific foods/ingredients this protocol REQUIRES or PREFERS.
   * Used for conflict detection (e.g., "spinach" required here but blocked there).
   */
  requiresOrPrefers?: string[];
  /**
   * Specific foods/ingredients this protocol BLOCKS.
   * Used for conflict detection.
   */
  blocks?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1 — Life-threatening safety hard stops (no meal generation)
// ─────────────────────────────────────────────────────────────────────────────

const PKU_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "pku",
  conditionName: "Phenylketonuria (PKU)",
  priorityTier: 1,
  triggerKeys: ["pku", "phenylketonuria", "phenylketonuria classic", "classic pku", "hyperphenylalaninemia"],
  hardStop: true,
  hardStopMessage:
    "PKU (phenylketonuria) requires a strictly phenylalanine-controlled diet that must be " +
    "individually calculated by a metabolic dietitian. Standard recipe generation cannot safely " +
    "produce meals for this child. Please work with your metabolic care team for all meal planning.",
  requiresClinicianFlag: true,
  requiresDietitianFlag: true,
  guidance: "", // never injected — hardStop blocks generation before guidance is used
};

const GTUBE_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "g_tube",
  conditionName: "G-Tube / Enteral Feeding",
  priorityTier: 1,
  triggerKeys: ["g-tube", "g tube", "gtube", "gastrostomy tube", "enteral feeding", "tube feeding", "peg tube", "ng tube", "nasogastric tube", "enteral nutrition"],
  hardStop: true,
  hardStopMessage:
    "This child is receiving enteral (tube) feeding. Oral meal generation is not safe without " +
    "explicit clinician clearance for oral feeding. Please consult your child's care team before " +
    "introducing or changing oral meals.",
  requiresClinicianFlag: true,
  requiresDietitianFlag: true,
  guidance: "", // never injected — hardStop blocks generation before guidance is used
};

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3 — Medical condition hard limits
// ─────────────────────────────────────────────────────────────────────────────

const T1D_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "t1d",
  conditionName: "Type 1 Diabetes",
  priorityTier: 3,
  triggerKeys: ["t1d", "type 1 diabetes", "type1 diabetes", "type 1 diabetic", "t1 diabetes", "insulin-dependent diabetes"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: true,
  requiresOrPrefers: ["whole grains", "lean protein", "non-starchy vegetables", "fiber-rich foods"],
  blocks: ["added sugar", "white bread", "white rice as primary starch", "sugary beverages", "candy", "pastries"],
  guidance: `
🩺 TYPE 1 DIABETES PROTOCOL — MANDATORY (pediatric, clinician-verified):
CARBOHYDRATE AWARENESS — this child uses insulin. Every recipe MUST include a carbohydrate count estimate so caregivers can dose accurately.
- Include a field: "estimatedCarbsPerServing" with a gram range (e.g., "22–28g").
- CONSISTENT CARB PORTIONS: Avoid very-high-carb meals (>60g per serving). Prefer balanced meals with 20–45g carbohydrate per meal.
- LOW GLYCEMIC INDEX preferred: whole grain bread/pasta, legumes, non-starchy vegetables, berries. Avoid refined white flour as the primary starch.
- NO added sugars, sugary drinks, juice (unless treating hypoglycemia — not a meal), candy, pastries, or dessert-style foods unless explicitly requested.
- HIGH FIBER: Fiber slows glucose absorption — prioritize vegetables, legumes, and whole grains at every meal.
- PROTEIN AND FAT at every meal: help blunt post-meal glucose rise.
- DO NOT label foods as "forbidden" or use fear-based language. Frame positively: "this version uses whole wheat to support steadier blood sugar."
- NEVER suggest insulin dosing, medication changes, or treatment decisions. Nutrition only.
- Note in recipe: "Carb count estimate provided to support insulin management. Always verify with your care team."
`.trim(),
};

const T2D_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "t2d",
  conditionName: "Type 2 Diabetes / Prediabetes",
  priorityTier: 3,
  triggerKeys: ["t2d", "type 2 diabetes", "type2 diabetes", "type 2 diabetic", "prediabetes", "pre-diabetes", "insulin resistance"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: true,
  requiresOrPrefers: ["whole grains", "lean protein", "non-starchy vegetables", "legumes", "fiber-rich foods"],
  blocks: ["added sugar", "refined flour", "sugary beverages", "deep-fried foods", "ultra-processed foods"],
  guidance: `
🩺 TYPE 2 DIABETES / PREDIABETES PROTOCOL — MANDATORY (pediatric):
GLYCEMIC MANAGEMENT through whole-food nutrition. This is not a calorie-restriction prescription.
- LOW GLYCEMIC INDEX: whole grain bread, oats, legumes, non-starchy vegetables. No white bread, white rice as primary starch, or refined flour as main ingredient.
- NO added sugars: no candy, cookies, pastries, sugary cereals, juice, soda, sports drinks, sweetened yogurt.
- HIGH FIBER at every meal: beans, lentils, vegetables, whole grains — fiber is the most effective food-level glucose modifier.
- LEAN PROTEIN at every meal: chicken, turkey, fish, eggs, Greek yogurt (unsweetened), legumes.
- HEALTHY FATS: olive oil, avocado, nuts — never seed oils or trans fats.
- AVOID: deep-fried foods, ultra-processed snacks, fast-food-style preparations.
- WEIGHT-NEUTRAL LANGUAGE: Never mention weight loss, dieting, or body size. Frame as "supporting steady energy" and "nourishing the body."
- NEVER suggest medication changes, clinical dosing, or diagnosis. Nutrition only.
`.trim(),
};

const CELIAC_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "celiac",
  conditionName: "Celiac Disease (Confirmed)",
  priorityTier: 3,
  triggerKeys: ["celiac", "celiac disease", "coeliac", "coeliac disease", "celiac confirmed", "biopsy confirmed celiac"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: true,
  blocks: ["wheat", "barley", "rye", "spelt", "kamut", "farro", "semolina", "durum", "triticale", "malt", "brewer's yeast", "regular oats"],
  guidance: `
⚠️ CELIAC DISEASE — STRICT GLUTEN-FREE PROTOCOL (medical necessity, not preference):
ABSOLUTE GLUTEN BAN: This child has confirmed celiac disease. Gluten causes intestinal damage regardless of symptoms.
HARD-BLOCKED INGREDIENTS (never include in any form):
- Wheat in all forms: all-purpose flour, whole wheat flour, bread flour, wheat starch, wheat bran, wheat germ, durum, semolina, spelt, kamut, farro, triticale, einkorn.
- Barley and all barley derivatives: barley flour, barley malt, malt extract, malt vinegar, malt syrup.
- Rye and rye flour.
- Regular oats (cross-contaminated unless explicitly certified gluten-free oats).
- Any sauce or condiment containing wheat: soy sauce (use tamari or coconut aminos only), teriyaki, most Worcestershire sauces, regular gravies, cream soups (flour-thickened).
- Breaded or battered foods (unless confirmed GF breadcrumbs or batter).
SAFE GLUTEN-FREE STARCHES TO USE:
- White rice, brown rice, rice flour, rice pasta.
- Corn, cornmeal, polenta, corn tortillas (check labels).
- Potatoes, sweet potatoes, cassava, tapioca.
- Quinoa, buckwheat, amaranth, sorghum, millet.
- Certified gluten-free oats (only when explicitly labeled as such).
- Legumes: beans, lentils, chickpeas.
CROSS-CONTAMINATION WARNING: Include in askPediatricianNote: "Use dedicated gluten-free cooking utensils, surfaces, and pans. Always read ingredient labels for hidden gluten."
DO NOT use terms like "low-gluten," "gluten-reduced," or "gluten-friendly." There is no safe threshold for celiac disease.
`.trim(),
};

const NCGS_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "ncgs",
  conditionName: "Non-Celiac Gluten Sensitivity",
  priorityTier: 3,
  triggerKeys: ["non-celiac gluten sensitivity", "ncgs", "gluten sensitivity", "gluten intolerance", "gluten-sensitive"],
  requiresClinicianFlag: false,
  requiresDietitianFlag: true,
  blocks: ["wheat", "barley", "rye"],
  guidance: `
⚠️ GLUTEN SENSITIVITY PROTOCOL — GLUTEN-FREE APPROACH:
This child has non-celiac gluten sensitivity. While intestinal damage is not confirmed, gluten causes significant symptoms.
AVOID: wheat (all forms), barley, rye. Use gluten-free alternatives.
- Replace wheat flour with rice flour, almond flour, or a certified GF blend.
- Use tamari or coconut aminos instead of soy sauce.
- Prefer naturally gluten-free whole foods: rice, potatoes, legumes, quinoa, vegetables, fruits, meats, eggs, dairy.
LABEL AWARENESS: Advise parents to check for wheat-derived ingredients in packaged goods (sauces, seasonings, marinades).
Note: Unlike celiac disease, cross-contamination thresholds may differ. Still prefer clearly gluten-free preparations.
`.trim(),
};

const CKD_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "ckd",
  conditionName: "Chronic Kidney Disease",
  priorityTier: 3,
  triggerKeys: ["ckd", "chronic kidney disease", "kidney disease", "renal disease", "pediatric ckd", "renal failure", "kidney failure"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: true,
  blocks: ["banana", "orange", "avocado", "tomato large amounts", "spinach large amounts", "potato", "sweet potato", "dried fruit", "chocolate", "cheese large amounts", "milk large amounts", "nuts", "seeds", "beans large amounts", "salt", "processed meats"],
  requiresOrPrefers: ["egg whites", "white fish", "white rice", "apple", "blueberries", "cabbage", "cauliflower", "green beans", "peppers"],
  guidance: `
🫘 CHRONIC KIDNEY DISEASE PROTOCOL — MANDATORY (pediatric, strict mineral limits):
POTASSIUM — HARD LIMIT: High-potassium foods can cause dangerous heart arrhythmias in CKD.
BANNED HIGH-POTASSIUM FOODS: banana, plantain, orange, orange juice, all citrus juice, tomato (large amounts), avocado, spinach (large amounts), potato, sweet potato, beets, dried fruit, raisins, prunes, apricots.
SAFE LOW-POTASSIUM OPTIONS: apple, blueberries, cranberries, grapes, cabbage, cauliflower, green beans, peppers, onions, white rice, white bread.

PHOSPHORUS — HARD LIMIT: Excess phosphorus damages blood vessels in CKD.
BANNED HIGH-PHOSPHORUS FOODS: large amounts of dairy (no cheese, no milk, no yogurt as a primary component), chocolate, cocoa, cacao, nuts and seeds, peanut butter, almond butter, beans and lentils in large quantities, dark cola, energy drinks, processed foods with phosphate additives.
SAFE: egg whites, small amounts of chicken or white fish.

SODIUM — HARD LIMIT: No added salt. No canned foods with sodium. No processed meats. No soy sauce. No high-sodium condiments.

PROTEIN — MODERATE ONLY: Do NOT suggest high-protein meals. Excess protein burdens kidneys.
Prefer egg whites, small portions of white-meat chicken or white fish. No protein powders.

INCLUDE in askPediatricianNote: "Potassium and phosphorus limits depend on your child's kidney function and lab values. Always confirm with the nephrology dietitian before introducing new foods."
`.trim(),
};

const LIVER_DISEASE_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "liver_disease",
  conditionName: "Pediatric Liver Disease",
  priorityTier: 3,
  triggerKeys: ["liver disease", "cholestasis", "nafld", "pediatric nafld", "fatty liver", "liver failure", "cirrhosis", "biliary atresia", "hepatitis", "liver support"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: true,
  blocks: ["alcohol", "fried foods", "added sugar", "ultra-processed foods", "large amounts of fat"],
  requiresOrPrefers: ["cruciferous vegetables", "leafy greens", "omega-3 fish", "whole grains", "legumes", "olive oil"],
  guidance: `
🌱 PEDIATRIC LIVER DISEASE PROTOCOL — MANDATORY:
ABSOLUTE BAN: No alcohol in food, cooking, or sauces. No wine-based preparations.
NO FRIED FOODS: No deep frying, no heavy oil use.
NO ADDED SUGAR: No candy, pastries, soda, flavored syrups, sweetened condensed milk. Whole fruit sweetness is acceptable.
NO ULTRA-PROCESSED FOODS: No fast food, instant noodles, packaged snack foods.
LIMIT: Processed meats (bacon, sausage), heavy butter/cream-based dishes, high-sodium foods.
PREFER:
- Cruciferous vegetables: broccoli, cauliflower, Brussels sprouts, cabbage.
- Leafy greens: spinach, kale, arugula.
- Omega-3 rich fish: salmon, sardines. Avoid very high-fat preparations.
- Whole grains: oats, quinoa, brown rice.
- Legumes: beans, lentils.
- Olive oil for any fat use.
COOKING: Baking, steaming, grilling, light sautéing in olive oil only.
NOTE: Children with advanced liver disease may have fat-soluble vitamin deficiencies (A, D, E, K) — flag in askPediatricianNote.
`.trim(),
};

const CYSTIC_FIBROSIS_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "cystic_fibrosis",
  conditionName: "Cystic Fibrosis",
  priorityTier: 3,
  triggerKeys: ["cystic fibrosis", "cf", "cftr", "mucoviscidosis"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: true,
  requiresOrPrefers: ["calorie-dense foods", "healthy fats", "whole milk", "avocado", "nut butter", "olive oil", "full-fat dairy", "extra protein"],
  guidance: `
🫁 CYSTIC FIBROSIS PROTOCOL — MANDATORY (unique: HIGH calorie density required):
CRITICAL REVERSAL: Unlike most pediatric nutrition guidelines, children with CF need HIGHER calories and fat than typical guidelines.
CALORIE TARGET: 110–200% of standard DRI depending on disease severity. Meals should be calorie-dense.
HIGH FAT IS REQUIRED: Full-fat dairy, avocado, olive oil, nut butters, whole milk, cream — all encouraged. Fat malabsorption means these children often need extra fat to meet needs.
HIGH PROTEIN: Target ≥130% of age-appropriate DRI protein. Include protein at every meal.
SALT / SODIUM: Unlike other conditions, EXTRA SALT is often needed — CF causes excessive sodium losses through sweat. Do not restrict sodium.
ENZYME REMINDER: Include in instructions: "Reminder: PERT (pancreatic enzyme replacement therapy) should be taken with this meal as prescribed."
PREFER: Full-fat dairy (whole milk, full-fat yogurt, cheese), fatty proteins (salmon, chicken thighs, eggs), healthy calorie-dense additions (avocado, nut butter, olive oil drizzle), complex carbohydrates for energy.
AVOID: Low-fat or fat-free products, artificially reduced-calorie versions of foods.
BONE HEALTH: CF reduces fat-soluble vitamin absorption. Vitamin D and calcium-rich foods are important — dairy, fortified milks, fatty fish.
INCLUDE in askPediatricianNote: "Enzyme therapy (PERT) is typically required with meals and snacks. Confirm dose with your CF care team."
`.trim(),
};

const CROHNS_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "crohns",
  conditionName: "Crohn's Disease",
  priorityTier: 3,
  triggerKeys: ["crohn's", "crohns", "crohn's disease", "crohns disease", "ibd crohns", "inflammatory bowel disease crohns"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: true,
  blocks: ["raw cruciferous vegetables large amounts", "fried foods", "ultra-processed foods", "high-fat greasy meals", "large amounts of seeds or skin"],
  requiresOrPrefers: ["well-cooked vegetables", "lean protein", "easily digestible starches", "low-fiber options during flares"],
  guidance: `
🔥 CROHN'S DISEASE PROTOCOL — MANDATORY (pediatric IBD, remission defaults):
PRINCIPLE: Easily digestible, anti-inflammatory, gentle on the gut. High nutritional density matters because malabsorption is common.
AVOID:
- Raw cruciferous vegetables in large amounts (broccoli, cauliflower, cabbage) — cook thoroughly.
- High-fat, greasy, or fried foods — worsen diarrhea and inflammation.
- Large amounts of seeds, skins, or hulls (can irritate inflamed tissue).
- Ultra-processed foods, fast food, heavily spiced preparations.
- High-sugar foods and drinks.
PREFER:
- Well-cooked vegetables (steamed, roasted until soft): carrots, zucchini, squash, green beans.
- Easily digestible starches: white rice, white potato (peeled), oatmeal, plain pasta.
- Lean protein: chicken breast, turkey, fish, well-cooked eggs.
- Omega-3 fatty acids: salmon, sardines (anti-inflammatory).
- Low-lactose dairy or lactose-free options if dairy is tolerated.
NUTRITIONAL DENSITY: Malnutrition is a common risk. Meals should be nutrient-dense even if small in volume.
FLARE vs. REMISSION: These guidelines are for remission. During active flare, more restrictive texture and fiber limits apply. Note in askPediatricianNote: "During active flare, consult your GI dietitian for adjusted recommendations."
INCLUDE in askPediatricianNote: "Crohn's disease can affect nutrient absorption. Regular monitoring of vitamin B12, iron, vitamin D, and zinc levels is important."
`.trim(),
};

const UC_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "uc",
  conditionName: "Ulcerative Colitis",
  priorityTier: 3,
  triggerKeys: ["ulcerative colitis", "uc", "colitis", "ibd uc", "inflammatory bowel disease uc", "inflammatory bowel disease colitis"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: true,
  blocks: ["raw high-fiber vegetables during flares", "fried foods", "high-fat greasy foods", "spicy foods during flares"],
  requiresOrPrefers: ["well-cooked vegetables", "lean protein", "easily digestible starches", "omega-3 fish"],
  guidance: `
🔥 ULCERATIVE COLITIS PROTOCOL — MANDATORY (pediatric IBD):
PRINCIPLE: Gentle, anti-inflammatory, well-cooked foods. Focus on reducing gut irritation while maintaining nutrition.
AVOID:
- High-fiber raw vegetables during active symptoms — cook all vegetables until soft.
- Fried, greasy, or high-fat foods.
- Very spicy preparations (during symptoms — mild spice generally tolerated in remission).
- Ultra-processed foods, high-sugar foods.
- Excessive dairy if lactose intolerant (common secondary to colitis).
PREFER:
- Well-cooked, soft vegetables: carrots, zucchini, squash, sweet potato (in remission).
- Easily digestible proteins: chicken, turkey, eggs, white fish.
- Omega-3 foods: salmon, sardines — anti-inflammatory effect.
- Probiotic-containing foods (if tolerated): plain yogurt, kefir, miso.
- Simple starches: white rice, oatmeal, plain pasta, white potato.
POTASSIUM AND ELECTROLYTES: Diarrhea can deplete electrolytes. Banana, cooked potato (remission), and dilute oral rehydration are beneficial.
INCLUDE in askPediatricianNote: "Dietary needs change significantly between flare and remission. Consult your GI care team for personalized guidance."
`.trim(),
};

const JIA_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "jia",
  conditionName: "Juvenile Idiopathic Arthritis",
  priorityTier: 3,
  triggerKeys: ["jia", "juvenile idiopathic arthritis", "juvenile arthritis", "pediatric arthritis", "juvenile rheumatoid arthritis", "jra"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: false,
  blocks: ["seed oils", "processed meats", "added sugars", "trans fats"],
  requiresOrPrefers: ["omega-3 fish", "colorful vegetables", "berries", "turmeric", "ginger", "olive oil", "calcium-rich foods", "vitamin D foods"],
  guidance: `
🦴 JUVENILE IDIOPATHIC ARTHRITIS PROTOCOL — MANDATORY:
ANTI-INFLAMMATORY PRIORITY: Reduce dietary contributors to inflammation.
HARD BLOCKS:
- NO seed oils (canola, vegetable, soybean, corn, sunflower) — use olive oil only.
- NO processed meats (bacon, sausage, deli meat, hot dogs).
- NO added sugars, sweetened drinks, candy, pastries.
- NO trans fats or partially hydrogenated oils.
ACTIVELY INCLUDE:
- Omega-3 fatty acids: salmon, sardines, mackerel, walnuts, chia seeds, flaxseed.
- Colorful vegetables: bell peppers, tomatoes (remission), leafy greens, purple cabbage.
- Berries: blueberries, strawberries, raspberries.
- Anti-inflammatory spices: turmeric, ginger, garlic, rosemary.
- Olive oil as primary fat.
BONE HEALTH (critical — steroid medications can affect bone density):
- Calcium-rich foods at every meal: dairy, fortified plant milk, sardines, broccoli.
- Vitamin D: salmon, eggs, fortified foods, mushrooms (UV-exposed).
COOKING: Soft textures during flares — easier to manage with joint pain. Avoid meals requiring extensive cutting/effort.
`.trim(),
};

const LUPUS_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "lupus",
  conditionName: "Pediatric Lupus (SLE)",
  priorityTier: 3,
  triggerKeys: ["lupus", "sle", "systemic lupus erythematosus", "pediatric lupus", "juvenile lupus"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: false,
  blocks: ["alfalfa sprouts", "seed oils", "processed meats", "added sugars", "high-sodium foods"],
  requiresOrPrefers: ["omega-3 fish", "colorful vegetables", "berries", "olive oil", "calcium-rich foods", "vitamin D foods"],
  guidance: `
🩺 PEDIATRIC LUPUS PROTOCOL — MANDATORY:
ANTI-INFLAMMATORY FOUNDATION:
HARD BLOCKS:
- NO alfalfa sprouts — contain L-canavanine which can trigger lupus flares.
- NO seed oils — olive oil only.
- NO processed meats.
- NO added sugars, sweetened drinks.
- Limit high-sodium foods — kidney involvement is common in lupus; protect renal function.
ACTIVELY INCLUDE:
- Omega-3 fatty acids: salmon, sardines, mackerel, walnuts, chia, flaxseed.
- Colorful antioxidant-rich vegetables and fruits.
- Anti-inflammatory spices: turmeric, ginger, garlic.
- Olive oil as primary fat.
BONE HEALTH (steroids are commonly used in lupus and deplete bone density):
- Calcium at every meal: dairy, fortified milk, broccoli, sardines.
- Vitamin D: salmon, eggs, fortified foods, mushrooms.
KIDNEY CONSIDERATIONS: If renal lupus (nephritis) is present, potassium and sodium limits similar to CKD apply — flag in askPediatricianNote.
SUN SENSITIVITY: No dietary implications, but parents may be managing sun avoidance — mention briefly if relevant.
INCLUDE in askPediatricianNote: "Lupus nutrition needs vary based on organ involvement and current medications. Consult your rheumatology care team."
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4 — Growth context
// ─────────────────────────────────────────────────────────────────────────────

const IRON_DEFICIENCY_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "iron_deficiency",
  conditionName: "Iron Deficiency Anemia",
  priorityTier: 4,
  triggerKeys: ["iron deficiency", "iron deficiency anemia", "iron deficiency anaemia", "anemia", "anaemia iron", "iron-deficiency anemia"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: false,
  requiresOrPrefers: ["lean red meat", "chicken", "turkey", "fish", "legumes", "fortified cereal", "spinach", "broccoli", "vitamin C foods"],
  guidance: `
🩸 IRON DEFICIENCY ANEMIA PROTOCOL — MANDATORY:
IRON IS THE PRIORITY NUTRIENT at every meal.
HEME IRON SOURCES (best absorbed) — include when appropriate for dietary pattern:
- Lean red meat: beef, lamb (small age-appropriate portions).
- Poultry: chicken, turkey (dark meat has more iron).
- Fish and shellfish.
NON-HEME IRON SOURCES — for vegetarian/vegan patterns:
- Legumes: lentils, chickpeas, kidney beans, black beans.
- Fortified cereals and grains (iron-fortified).
- Leafy greens: spinach, kale, Swiss chard.
- Tofu, tempeh.
- Pumpkin seeds, quinoa.
VITAMIN C PAIRING — MANDATORY: Always pair non-heme iron sources with vitamin C to enhance absorption.
- Vitamin C sources: bell peppers (especially red/yellow), strawberries, citrus (age-appropriate), broccoli, tomatoes, kiwi.
- Example: lentil soup + squeeze of lemon; spinach salad + strawberries; fortified cereal + small orange.
ABSORPTION BLOCKERS — LIMIT with iron-rich meals:
- Calcium-rich foods (milk, cheese) consumed simultaneously can reduce iron absorption — serve dairy separately from iron-rich meals when possible.
- Tea and coffee contain tannins that block iron — not recommended for children anyway.
COOKING TIP: Cooking in cast-iron pans increases the iron content of food — worth mentioning.
INCLUDE in askPediatricianNote: "Iron supplementation timing should be confirmed with your pediatrician. Dietary iron supports supplementation but rarely replaces it in deficiency."
`.trim(),
};

const FAILURE_TO_THRIVE_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "failure_to_thrive",
  conditionName: "Failure to Thrive / Pediatric Undernutrition",
  priorityTier: 4,
  triggerKeys: ["failure to thrive", "ftt", "undernutrition", "pediatric undernutrition", "growth faltering", "weight faltering"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: true,
  requiresOrPrefers: ["calorie-dense foods", "healthy fats", "fortified foods", "high-protein foods", "nutrient-dense additions"],
  guidance: `
📈 FAILURE TO THRIVE / UNDERNUTRITION PROTOCOL — MANDATORY:
CALORIC DENSITY IS THE PRIMARY GOAL: Every ingredient should contribute meaningfully to caloric and nutritional density.
CALORIE FORTIFICATION STRATEGIES:
- Add healthy fats to every dish: olive oil drizzled on vegetables, nut butters added to oatmeal, avocado mashed into purees.
- Full-fat dairy: whole milk, full-fat yogurt, full-fat cheese (unless dairy allergy).
- Fortified foods: iron-fortified cereals, vitamin D-fortified milk.
- Add nut butters, seeds (age-appropriate textures), and oils generously.
HIGH PROTEIN at every meal: eggs, full-fat Greek yogurt, legumes, chicken, fish.
NEVER restrict calories, fat, or macronutrients in this context — the goal is maximizing intake, not limiting it.
SMALL, FREQUENT MEALS: Structure and frequency matter more than large portions. Suggest snack ideas alongside main meals.
WEIGHT-NEUTRAL LANGUAGE: Never say "gain weight," "too small," or other labels. Frame as "supporting your child's growth and energy."
TEXTURE: Match calorie-dense foods to the child's developmental texture level — always.
INCLUDE in askPediatricianNote: "Calorie and protein targets should be set by your pediatric dietitian. A growth monitoring plan is important for children with growth faltering."
`.trim(),
};

const PEDIATRIC_OBESITY_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "pediatric_obesity",
  conditionName: "Pediatric Obesity / Overweight",
  priorityTier: 4,
  triggerKeys: ["pediatric obesity", "obesity", "overweight", "childhood obesity", "pediatric overweight", "high bmi"],
  requiresClinicianFlag: false,
  requiresDietitianFlag: true,
  blocks: ["added sugar", "sugary beverages", "fried foods", "ultra-processed foods", "refined flour as primary starch"],
  requiresOrPrefers: ["whole grains", "lean protein", "non-starchy vegetables", "fiber-rich foods", "water as beverage"],
  guidance: `
🌱 PEDIATRIC WEIGHT MANAGEMENT PROTOCOL — MANDATORY:
WHOLE-FOOD, QUALITY-FIRST APPROACH: Focus on nutrient quality and whole foods — not calorie restriction, dieting, or deprivation.
WEIGHT-NEUTRAL LANGUAGE — STRICT: Never mention weight loss, BMI, being "too heavy," dieting, or body size. Frame as "eating to feel great" and "fueling your body."
FOOD QUALITY PRIORITIES:
- Whole grains over refined: whole wheat bread, oats, brown rice, quinoa, legumes.
- Lean protein at every meal: chicken, turkey, fish, eggs, legumes, low-fat dairy.
- Non-starchy vegetables at every meal: aim for half the plate in colorful vegetables.
- Healthy fats: avocado, olive oil, nuts, seeds (age-appropriate).
- Whole fruit instead of juice or sweetened snacks.
AVOID:
- Added sugar in any form: no candy, sugary cereal, pastries, cookies, soda, juice, sports drinks.
- Fried foods, fast-food-style preparations.
- Ultra-processed snack foods.
- Refined white flour as the primary base (white bread, white pasta as the main starch).
BEVERAGE: Water should be the primary beverage. Mention this naturally.
NEVER restrict meals to the point of hunger or use fear-based food labeling.
INCLUDE in askPediatricianNote: "A whole-family approach to eating and activity is most effective. A pediatric dietitian can provide personalized guidance."
`.trim(),
};

const UNDERWEIGHT_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "underweight",
  conditionName: "Underweight (Growth Monitoring Context)",
  priorityTier: 4,
  triggerKeys: ["underweight", "low weight", "thin", "growth monitoring underweight", "pediatric underweight"],
  requiresClinicianFlag: false,
  requiresDietitianFlag: false,
  requiresOrPrefers: ["calorie-dense foods", "healthy fats", "protein-rich foods", "whole milk dairy"],
  guidance: `
📊 UNDERWEIGHT PROTOCOL — MANDATORY:
CALORIC DENSITY: Meals should be nutrient-dense and calorie-appropriate — no fat-free or diet versions of foods.
INCLUDE HEALTHY FATS at every meal: olive oil, avocado, nut butters (texture-appropriate), whole milk dairy, eggs.
HIGH PROTEIN: Include a protein source at every meal — eggs, meat, fish, legumes, dairy.
WHOLE MILK DAIRY: For children under 2, whole milk is already standard. For older children, full-fat dairy is appropriate here.
DO NOT restrict calories, fat, or portions. Never label foods as "too calorie-dense."
WEIGHT-NEUTRAL LANGUAGE: Frame as "supporting your child's growth and strength."
INCLUDE in askPediatricianNote: "If your child is consistently underweight, a full growth assessment with your pediatrician is recommended."
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// TIER 5 — Sensory and feeding development
// ─────────────────────────────────────────────────────────────────────────────

const ADHD_EATING_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "adhd_eating",
  conditionName: "ADHD — Eating Pattern Support",
  priorityTier: 5,
  triggerKeys: ["adhd", "attention deficit", "attention-deficit", "adhd eating", "adhd nutrition", "adhd food"],
  requiresClinicianFlag: false,
  requiresDietitianFlag: false,
  requiresOrPrefers: ["omega-3 fish", "iron-rich foods", "protein at breakfast", "complex carbohydrates", "zinc-rich foods"],
  blocks: ["artificial food dyes", "high added sugar", "ultra-processed foods", "heavily caffeinated foods"],
  guidance: `
🧠 ADHD EATING SUPPORT PROTOCOL — MANDATORY:
EVIDENCE-BASED NUTRITION SUPPORT — not a treatment claim. These guidelines support general wellbeing.
PRIORITY NUTRIENTS (strongest evidence for ADHD support):
- OMEGA-3 FATTY ACIDS: salmon, sardines, mackerel, walnuts, chia seeds, flaxseed. Include at least one source per recipe where appropriate.
- IRON: lean red meat, chicken, turkey, lentils, fortified cereals, spinach. Iron deficiency is disproportionately common in children with ADHD.
- ZINC: pumpkin seeds, lean beef, chicken, chickpeas, lentils.
- PROTEIN AT BREAKFAST: Protein-containing breakfast helps stabilize blood sugar and may support morning focus — eggs, Greek yogurt, nut butter on whole grain toast.
- COMPLEX CARBOHYDRATES: oats, whole grain bread, sweet potato, legumes — stabilize blood sugar and sustained energy.
MINIMIZE:
- Artificial food dyes (Red 40, Yellow 5, Yellow 6): avoid brightly colored processed foods with these additives. Use natural food colors where relevant.
- High added sugar: spikes and crashes worsen attention. No sugary cereals, candy, cookies, sugary drinks.
- Ultra-processed foods.
MEAL TIMING NOTE: Include note for parents: "Children with ADHD may have appetite suppression during medication hours — a nutritious breakfast before medication can help."
MEDICATION TIMING SAFETY: NEVER give medication advice. Frame only as nutrition support.
DO NOT make clinical claims about treating or curing ADHD through diet.
`.trim(),
};

const AUTISM_SENSORY_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "autism_sensory",
  conditionName: "Autism Spectrum Disorder — Sensory Eating",
  priorityTier: 5,
  triggerKeys: ["autism", "asd", "autism spectrum", "autism spectrum disorder", "autistic", "sensory eating autism", "sensory food aversion"],
  requiresClinicianFlag: false,
  requiresDietitianFlag: false,
  guidance: `
🎨 AUTISM / SENSORY EATING PROTOCOL — MANDATORY:
SENSORY EXPERIENCE IS CENTRAL: Texture, color, smell, and visual appearance matter as much as nutrition.
TEXTURE CONSISTENCY: Keep textures predictable and consistent. Avoid mixed textures (e.g., crunchy pieces in smooth puree) unless the child's profile indicates tolerance.
- If smooth textures preferred: purees, mashed, blended preparations.
- If crunchy preferred: foods with uniform crunch — baked chips, crackers, raw carrots (when age-safe).
- If dry foods preferred: avoid sauces and gravies or serve separately.
- If soft/mushy avoided: no soggy textures, overcooked vegetables, wet sandwiches.
VISUAL PREDICTABILITY: Keep the meal familiar-looking. Mixed dishes may be refused — serve components separately when possible.
FLAVOR INTENSITY: Mild, familiar flavors first. Avoid strong spices unless the child's profile indicates tolerance.
AROMA: Low-aromatic cooking preferred. Strong-smelling fish, strongly spiced preparations, or pungent cheeses may be aversive.
NUTRITIONAL ADEQUACY: Despite restricted intake, ensure nutrient density. Use accepted foods to meet nutritional needs where possible.
- Vitamin and mineral gaps are common with restricted eating — include multivitamin note in askPediatricianNote.
NEVER use pressure or hiding vegetables in ways that could erode trust with food.
INCLUDE in askPediatricianNote: "Many children with autism benefit from working with a feeding therapist alongside nutritional support. Consult your care team."
NO CLAIMS about dietary therapy for autism. This is sensory and nutritional support only.
`.trim(),
};

const DYSPHAGIA_PROTOCOL: PediatricProtocolBlock = {
  conditionId: "dysphagia",
  conditionName: "Feeding Disorder / Dysphagia",
  priorityTier: 5,
  triggerKeys: ["dysphagia", "swallowing disorder", "feeding disorder", "swallowing difficulty", "feeding therapy", "aspiration risk", "iddsi", "modified texture", "thickened liquids"],
  requiresClinicianFlag: true,
  requiresDietitianFlag: true,
  blocks: ["whole grapes", "whole nuts", "raw hard vegetables", "sticky foods", "mixed textures", "thin liquids unless prescribed"],
  guidance: `
⚠️ DYSPHAGIA / FEEDING DISORDER PROTOCOL — MANDATORY:
CLINICIAN-PRESCRIBED TEXTURE LEVEL SUPERSEDES ALL OTHER GUIDANCE.
If a specific IDDSI (International Dysphagia Diet Standardization Initiative) level is provided in the child's profile, follow it exactly.
IDDSI TEXTURE LEVELS — apply the appropriate one:
- Level 3 (Liquidised): fully blended, pourable, no lumps.
- Level 4 (Puréed): smooth, cohesive, no lumps or chunks.
- Level 5 (Minced & Moist): small soft pieces (4mm or less), moist with sauce/gravy.
- Level 6 (Soft & Bite-Sized): soft, moist, easily mashable, pieces ≤15mm.
- Level 7 (Regular/Easy to Chew): normal adult food.
ABSOLUTE CHOKING HAZARDS — HARD BLOCK for ALL dysphagia levels except 7:
- Whole grapes, cherry tomatoes (uncut), round candy, whole nuts, hard raw vegetables.
- Sticky or stringy foods (gummy candy, stringy celery, long noodles unless modified).
- Mixed textures (e.g., soup with chunks, cereal in milk) — serve components separately or fully blended.
LIQUID THICKNESS: Only specify thin liquids if the child's profile confirms they are safe. If swallowing difficulty is noted, recommend: "liquid consistency should be confirmed with your SLP."
NUTRITIONAL DENSITY: Modified texture often reduces food volume — ensure calorie and nutrient density in smaller portions.
INCLUDE in textureAndChokingPreparation: explicit instruction for the texture modification applied and why.
INCLUDE in askPediatricianNote: "Texture and liquid requirements should be confirmed with your speech-language pathologist (SLP) or feeding therapist."
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const PEDIATRIC_PROTOCOL_REGISTRY: PediatricProtocolBlock[] = [
  // Tier 1 — Hard stops (no meal generation)
  PKU_PROTOCOL,
  GTUBE_PROTOCOL,
  // Tier 3 — Medical condition hard limits
  T1D_PROTOCOL,
  T2D_PROTOCOL,
  CELIAC_PROTOCOL,
  NCGS_PROTOCOL,
  CKD_PROTOCOL,
  LIVER_DISEASE_PROTOCOL,
  CYSTIC_FIBROSIS_PROTOCOL,
  CROHNS_PROTOCOL,
  UC_PROTOCOL,
  JIA_PROTOCOL,
  LUPUS_PROTOCOL,
  // Tier 4 — Growth context
  IRON_DEFICIENCY_PROTOCOL,
  FAILURE_TO_THRIVE_PROTOCOL,
  PEDIATRIC_OBESITY_PROTOCOL,
  UNDERWEIGHT_PROTOCOL,
  // Tier 5 — Sensory and feeding development
  ADHD_EATING_PROTOCOL,
  AUTISM_SENSORY_PROTOCOL,
  DYSPHAGIA_PROTOCOL,
];

/** Index by conditionId */
export const PROTOCOL_BY_ID: Map<string, PediatricProtocolBlock> =
  new Map(PEDIATRIC_PROTOCOL_REGISTRY.map(p => [p.conditionId, p]));

/**
 * Given a list of condition keys (from child_profiles.medical_conditions),
 * returns all matching protocol blocks, sorted by priority tier (ascending).
 * Only returns blocks whose conditionId is in the approved evidence registry.
 * Hard-stop protocols are included and will appear first (Tier 1).
 */
export function matchProtocols(conditions: string[]): PediatricProtocolBlock[] {
  const approvedIds = getApprovedProtocolIds();
  const normalizedConditions = conditions.map(c => c.trim().toLowerCase());
  const matched: PediatricProtocolBlock[] = [];

  for (const protocol of PEDIATRIC_PROTOCOL_REGISTRY) {
    if (!approvedIds.has(protocol.conditionId)) continue;
    const isMatch = protocol.triggerKeys.some(key =>
      normalizedConditions.some(c => c.includes(key) || key.includes(c))
    );
    if (isMatch) {
      matched.push(protocol);
    }
  }

  // Sort ascending by priority tier — lower tier number = higher priority
  return matched.sort((a, b) => a.priorityTier - b.priorityTier);
}

/**
 * Returns the first hard-stop protocol that matches the condition list,
 * or undefined if no hard stop applies. Call this before building guidance
 * blocks — if a hard stop is present, generation must be blocked immediately.
 */
export function checkHardStop(conditions: string[]): PediatricProtocolBlock | undefined {
  const approvedIds = getApprovedProtocolIds();
  const normalizedConditions = conditions.map(c => c.trim().toLowerCase());

  for (const protocol of PEDIATRIC_PROTOCOL_REGISTRY) {
    if (!protocol.hardStop) continue;
    if (!approvedIds.has(protocol.conditionId)) continue;
    const isMatch = protocol.triggerKeys.some(key =>
      normalizedConditions.some(c => c.includes(key) || key.includes(c))
    );
    if (isMatch) return protocol;
  }
  return undefined;
}
