/**
 * therapeuticGuidance.ts
 *
 * Builds directive nutrition guidance blocks for Therapeutic Nutrition Intelligence.
 * These are appended to conditionGuidanceBlocks in the Protocol Envelope so that
 * EVERY generator honors them automatically — no route-level changes needed.
 *
 * Architecture rule: each block is self-contained and directive. No role-play framing.
 * Follows the exact pattern of universalMedicalGuidance.ts.
 *
 * Hierarchy position: Tier 3 — Therapeutic Support
 * (below Clinical Safety & Medical Hard Limits; above Performance & Preferences)
 *
 * Data model: structured entries with type, dose, unit, frequency.
 * Active = entry.dose > 0.
 */

export interface TherapeuticEntry {
  type: string;       // e.g. "testosterone-cypionate", "bpc-157", "prednisone"
  dose: number;       // e.g. 200 — REQUIRED, must be > 0 to be active
  unit: string;       // e.g. "mg/week", "mcg/day", "IU/day"
  frequency?: string; // e.g. "weekly", "daily" — optional, often implied by unit
  label?: string;     // display name for custom entries
  custom?: boolean;   // true for user-added custom entries
}

export interface TherapeuticSupportCtx {
  peptides: TherapeuticEntry[];
  hormones: TherapeuticEntry[];
  medications: TherapeuticEntry[];
  therapies: string[];        // pill selection — no dosage needed
  recoveryGoals: string[];    // pill selection — no dosage needed
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — extract active type strings from entries (dose > 0)
// ─────────────────────────────────────────────────────────────────────────────

export function activeTypes(entries: TherapeuticEntry[]): string[] {
  return (entries ?? []).filter(e => e.dose > 0).map(e => e.type);
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPLAY LABEL MAPS  (type → human label for modal text)
// ─────────────────────────────────────────────────────────────────────────────

export const PEPTIDE_LABELS: Record<string, string> = {
  "bpc-157": "BPC-157",
  "tb-500": "TB-500",
  "sermorelin": "Sermorelin",
  "ipamorelin": "Ipamorelin / CJC-1295",
  "ghk-cu": "GHK-Cu (Copper Peptide)",
  "pt-141": "PT-141",
  "nad+": "NAD+",
};

export const HORMONE_LABELS: Record<string, string> = {
  "testosterone-cypionate": "Testosterone Cypionate (TRT)",
  "testosterone-enanthate": "Testosterone Enanthate",
  "estradiol": "Estradiol (Estrogen Therapy)",
  "progesterone": "Progesterone",
  "hgh": "Growth Hormone (HGH)",
  "dhea": "DHEA",
  "thyroid-t3": "T3 (Liothyronine)",
};

export const MEDICATION_LABELS: Record<string, string> = {
  "prednisone": "Prednisone / Corticosteroids",
  "metformin": "Metformin",
  "semaglutide": "Semaglutide (Ozempic / Wegovy)",
  "tirzepatide": "Tirzepatide (Mounjaro)",
  "tamoxifen": "Tamoxifen",
  "anastrozole": "Anastrozole (Aromatase Inhibitor)",
};

export const THERAPY_LABELS: Record<string, string> = {
  "connective-tissue-recovery": "Connective Tissue Recovery",
  "gut-support": "Gut Support",
  "red-light-therapy": "Red Light Therapy",
  "sauna-recovery": "Sauna / Heat Recovery",
  "cold-therapy": "Cold Therapy / Ice Bath",
  "iv-therapy": "IV Nutrient Therapy",
};

export const RECOVERY_GOAL_LABELS: Record<string, string> = {
  "joint-recovery": "Joint Recovery",
  "muscle-recovery": "Muscle Recovery",
  "sleep-optimization": "Sleep Optimization",
  "inflammation-reduction": "Inflammation Reduction",
  "gut-healing": "Gut Healing",
  "stress-recovery": "Stress & Adrenal Recovery",
};

// ─────────────────────────────────────────────────────────────────────────────
// GUIDANCE BLOCKS
// ─────────────────────────────────────────────────────────────────────────────

const TRT_GUIDANCE = `⚡ TESTOSTERONE REPLACEMENT THERAPY (TRT) — NUTRITIONAL SUPPORT PROTOCOL:
This user is on testosterone therapy. Meal generation must support hormonal optimization, muscle maintenance, and metabolic health.
PRIORITY NUTRIENTS: High-quality complete protein (≥1.8g/kg — chicken, lean beef, eggs, salmon, Greek yogurt); healthy fats essential for hormone synthesis (avocado, olive oil, salmon, sardines, mackerel, egg yolks, walnuts, flaxseed); zinc-rich foods (lean beef, pumpkin seeds, oysters, dark chocolate); magnesium (leafy greens, almonds, black beans, dark chocolate); vitamin D (salmon, sardines, egg yolks, fortified foods); cruciferous vegetables for estrogen clearance support (broccoli, cauliflower, Brussels sprouts).
HARD BLOCKS: NO soy protein or soy-dominant meals (phytoestrogen content); NO processed foods with endocrine-disrupting additives; NO alcohol as a featured ingredient; NO seed oils (canola, soybean, vegetable) — use olive oil or avocado oil only.
MEAL STRUCTURE: Every meal anchors on high-quality complete protein. Include at least one healthy fat source per meal. Anti-inflammatory ingredients prioritized. Pair carbohydrates with protein and fat to avoid blood sugar spikes.
TONE: Frame as "hormone-supportive," "anabolic-recovery," or "metabolically optimized." No medical claims. No supplement recommendations.`.trim();

const ESTROGEN_GUIDANCE = `⚡ ESTROGEN THERAPY — NUTRITIONAL SUPPORT PROTOCOL:
This user is on estrogen therapy. Meal generation must support hormonal balance, bone density, and cardiovascular health.
PRIORITY NUTRIENTS: Phytoestrogen-containing foods in moderation to complement therapy (flaxseed, edamame, tempeh); calcium-rich foods for bone protection (dairy, fortified plant milks, leafy greens, sardines, almonds); vitamin D (salmon, eggs, fortified foods, mushrooms); magnesium (pumpkin seeds, dark leafy greens, dark chocolate); omega-3 fats (salmon, sardines, walnuts, chia seeds); liver-supportive cruciferous vegetables for healthy estrogen metabolism (broccoli, Brussels sprouts, cauliflower).
HARD BLOCKS: NO excess saturated fat from processed or fried sources; NO alcohol; NO processed foods with synthetic additives; NO refined sugars as primary carbohydrate source.
MEAL STRUCTURE: High fiber intake to support healthy estrogen clearance (minimum 25g daily target — include legumes, whole grains, vegetables). Antioxidant-rich foods at every meal (berries, colorful vegetables). Lean protein for muscle preservation.
TONE: Frame as "hormone-supportive," "bone-protective," or "cardiovascular-supportive." No medical claims.`.trim();

const PROGESTERONE_GUIDANCE = `⚡ PROGESTERONE THERAPY — NUTRITIONAL SUPPORT PROTOCOL:
This user is on progesterone therapy. Meal generation must support blood sugar stability, sleep quality, and nervous system calm.
PRIORITY NUTRIENTS: Magnesium-rich foods (pumpkin seeds, dark leafy greens, almonds, dark chocolate — critical for progesterone receptor sensitivity); complex carbohydrates for blood sugar stability (sweet potato, oats, quinoa, legumes); vitamin B6 (salmon, poultry, bananas, chickpeas — progesterone co-factor); zinc (lean beef, pumpkin seeds, oysters); omega-3 fats (salmon, sardines, walnuts, chia seeds); calcium (dairy, sardines, almonds, fortified foods).
HARD BLOCKS: NO refined sugars or high-glycemic foods as meal anchors; NO caffeine-heavy ingredients in evening meals; NO alcohol.
MEAL STRUCTURE: Regular moderate-sized meals to maintain blood sugar stability. Include magnesium-rich food at every meal. Evening meals prioritize calming nutrients. Complex carbohydrates paired with protein and fat.
TONE: Frame as "hormone-balancing," "blood sugar-stable," or "sleep-supportive." No medical claims.`.trim();

const GROWTH_HORMONE_GUIDANCE = `⚡ GROWTH HORMONE SUPPORT — NUTRITIONAL SUPPORT PROTOCOL:
This user is using growth hormone support. Meal generation must support anabolic recovery, lean muscle, and metabolic optimization.
PRIORITY NUTRIENTS: High complete protein at every meal (≥2.0g/kg — lean beef, chicken, salmon, eggs, Greek yogurt, cottage cheese); amino acids supporting GH secretion (arginine — pumpkin seeds, salmon, almonds; lysine — lean beef, chicken, eggs; glutamine — beef, chicken, eggs, spinach); healthy fats for hormone metabolism (avocado, olive oil, salmon, mackerel, walnuts); complex carbohydrates for recovery fueling (sweet potato, oats, quinoa, brown rice); antioxidants for IGF-1 support (berries, colorful vegetables, leafy greens).
HARD BLOCKS: NO refined sugars or high-glycemic carbohydrates (blunt GH pulse); NO processed foods with additives; NO alcohol.
MEAL STRUCTURE: Protein at every meal. Pre and post-workout meals are high priority. Anti-inflammatory ingredients throughout. Avoid simple sugars — especially around dosing windows.
TONE: Frame as "anabolic," "recovery-focused," or "growth-supportive." No medical claims.`.trim();

const PREDNISONE_GUIDANCE = `⚡ CORTICOSTEROID / PREDNISONE THERAPY — NUTRITIONAL SUPPORT PROTOCOL:
This user is on corticosteroid therapy. Meal generation must actively mitigate known nutritional side effects while supporting immune function.
PRIORITY NUTRIENTS: Calcium (dairy, sardines, kale, almonds, fortified foods — bone loss protection); vitamin D (salmon, eggs, fortified milks, mushrooms); potassium (bananas, sweet potato, spinach, white beans, avocado — counteracts fluid retention); protein for muscle preservation (≥1.6g/kg — chicken, fish, eggs, Greek yogurt, legumes); magnesium (pumpkin seeds, spinach, black beans, almonds); vitamin C (bell peppers, citrus, strawberries, broccoli — immune support); omega-3 fats (salmon, sardines, walnuts, chia — anti-inflammatory).
HARD BLOCKS: NO high-sodium processed foods (fluid retention and blood pressure); NO refined sugars or high-glycemic foods (blood sugar elevation); NO excess saturated fat (cardiovascular risk); NO alcohol.
MEAL STRUCTURE: Blood sugar-stabilizing meals at consistent times. High protein to offset muscle catabolism. Bone-protective nutrients at every meal. Anti-inflammatory ingredients prioritized. Potassium-rich foods with every meal.
TONE: Frame as "anti-inflammatory," "bone-protective," or "blood sugar-stabilizing." No medical claims.`.trim();

const GLP1_MEDICATION_GUIDANCE = `⚡ GLP-1 THERAPY (SEMAGLUTIDE / TIRZEPATIDE) — NUTRITIONAL SUPPORT PROTOCOL:
This user is on a GLP-1 receptor agonist. Meal generation must support reduced appetite, nausea management, lean muscle preservation, and metabolic optimization.
PRIORITY NUTRIENTS: High protein for muscle preservation (≥1.6g/kg — focus on compact protein sources: eggs, Greek yogurt, cottage cheese, edamame, canned salmon, chicken); small, nutrient-dense meals; complex carbohydrates with high fiber (oats, legumes, vegetables — slow digestion); healthy fats in moderate portions (avocado, olive oil, nuts in small amounts); high-fiber vegetables for satiety and gut health.
HARD BLOCKS: NO large portions; NO fried or greasy foods (worsens nausea); NO carbonated beverage ingredients; NO high-fat heavy meals; NO refined sugars as meal anchors.
MEAL STRUCTURE: Smaller portions, nutrient-dense per calorie. Protein always first. Meals should not be overwhelming in volume. Snacks should be high-protein, compact. Easy-to-digest preparations preferred (steamed, baked, poached).
TONE: Frame as "nutrient-dense," "protein-first," or "easy-on-digestion." No medical claims.`.trim();

const CONNECTIVE_TISSUE_GUIDANCE = `⚡ CONNECTIVE TISSUE RECOVERY — NUTRITIONAL SUPPORT PROTOCOL:
This user is pursuing connective tissue recovery (peptide therapy, injury recovery, or rehabilitation). Meal generation must support collagen synthesis, tendon and ligament repair, and anti-inflammatory healing.
PRIORITY NUTRIENTS: Vitamin C (bell peppers, citrus, strawberries, kiwi, broccoli — essential collagen synthesis cofactor); glycine-rich foods (bone broth, chicken skin, gelatin, pork; supports collagen formation); proline sources (egg whites, dairy, asparagus, cabbage); copper (liver, oysters, sesame seeds, cashews, dark chocolate — lysyl oxidase activation); vitamin A (sweet potato, carrots, leafy greens — tissue repair); omega-3 fats (salmon, sardines, walnuts — anti-inflammatory); zinc (lean beef, pumpkin seeds, oysters); sulfur-containing foods (garlic, onion, eggs, cruciferous vegetables — MSM precursors).
HARD BLOCKS: NO inflammatory oils (canola, soybean, vegetable oil — use olive oil or avocado oil only); NO refined sugars as meal anchors; NO alcohol.
MEAL STRUCTURE: Vitamin C source at every meal (collagen synthesis requires it in real-time). Include glycine-rich or collagen-supportive foods. Anti-inflammatory base throughout. Protein anchored at every meal.
TONE: Frame as "recovery-supportive," "collagen-building," or "tissue-repair." No medical claims.`.trim();

const GUT_SUPPORT_GUIDANCE = `⚡ GUT SUPPORT PROTOCOL — NUTRITIONAL SUPPORT:
This user is actively supporting gut health and microbiome diversity. Meal generation must prioritize digestive repair and barrier function.
PRIORITY NUTRIENTS: Diverse prebiotic fiber (chicory, garlic, onion, asparagus, green bananas, oats, leeks); probiotic-rich foods (Greek yogurt, kefir, kimchi, sauerkraut, miso, tempeh); L-glutamine sources (bone broth, beef, eggs, cabbage — intestinal barrier repair); omega-3 fats (salmon, sardines, walnuts — gut lining); polyphenol-rich foods (blueberries, dark chocolate, extra virgin olive oil, green tea); zinc (lean beef, pumpkin seeds, oysters — gut healing); vitamin D (salmon, eggs — mucosal immunity).
HARD BLOCKS: NO artificial sweeteners; NO processed foods with emulsifiers or preservatives; NO refined sugars as primary carbohydrate; NO excessive alcohol; NO highly processed seed oils.
MEAL STRUCTURE: Fermented or probiotic food with at least one daily meal. High fiber variety (aim for 30+ different plant sources weekly). Meals gentle on digestion. Avoid gut-disrupting additives.
TONE: Frame as "gut-supportive," "microbiome-diverse," or "digestive-healing." No medical claims.`.trim();

const RECOVERY_OPTIMIZATION_GUIDANCE = `⚡ RECOVERY OPTIMIZATION — NUTRITIONAL SUPPORT PROTOCOL:
This user is prioritizing recovery, sleep optimization, and inflammation reduction. Meal generation must support systemic recovery and restorative sleep.
PRIORITY NUTRIENTS: Magnesium (pumpkin seeds, dark leafy greens, almonds, dark chocolate — critical for sleep and recovery); tryptophan (turkey, eggs, pumpkin seeds, cottage cheese, bananas — serotonin/melatonin precursor); omega-3 fats (salmon, sardines, walnuts, chia — anti-inflammatory); antioxidants (blueberries, tart cherries, beets, spinach — exercise recovery); complex carbohydrates for evening meals (sweet potato, oats, quinoa — facilitate tryptophan uptake); protein for muscle repair (≥1.6g/kg throughout the day).
HARD BLOCKS: NO refined sugars in evening meals; NO alcohol; NO heavy saturated fat meals; NO high-caffeine ingredients in evening meals.
MEAL STRUCTURE: Evening meals include tryptophan + complex carbohydrate combination (facilitates sleep). Anti-inflammatory ingredients at every meal. Magnesium-rich food daily. Morning meals high in protein and antioxidants.
TONE: Frame as "recovery-optimizing," "anti-inflammatory," or "sleep-supportive." No medical claims.`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// GUIDANCE BLOCK BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export function buildTherapeuticGuidanceBlocks(ctx: TherapeuticSupportCtx): string[] {
  const blocks: string[] = [];

  const hormoneSlugs = activeTypes(ctx.hormones ?? []);
  const medicationSlugs = activeTypes(ctx.medications ?? []);
  const peptideSlugs = activeTypes(ctx.peptides ?? []);
  const therapies = ctx.therapies ?? [];
  const recoveryGoals = ctx.recoveryGoals ?? [];

  // Testosterone (any form)
  const isTRT = hormoneSlugs.some(t => t.startsWith("testosterone-"));
  if (isTRT) blocks.push(TRT_GUIDANCE);

  if (hormoneSlugs.includes("estradiol")) blocks.push(ESTROGEN_GUIDANCE);
  if (hormoneSlugs.includes("progesterone")) blocks.push(PROGESTERONE_GUIDANCE);
  if (hormoneSlugs.includes("hgh")) blocks.push(GROWTH_HORMONE_GUIDANCE);

  if (medicationSlugs.includes("prednisone")) blocks.push(PREDNISONE_GUIDANCE);

  const isGLP1 = medicationSlugs.includes("semaglutide") || medicationSlugs.includes("tirzepatide");
  if (isGLP1) blocks.push(GLP1_MEDICATION_GUIDANCE);

  const needsConnectiveTissue =
    peptideSlugs.some(p => ["bpc-157", "tb-500", "ghk-cu"].includes(p)) ||
    therapies.includes("connective-tissue-recovery") ||
    recoveryGoals.includes("joint-recovery");
  if (needsConnectiveTissue) blocks.push(CONNECTIVE_TISSUE_GUIDANCE);

  const needsGutSupport =
    therapies.includes("gut-support") ||
    recoveryGoals.includes("gut-healing");
  if (needsGutSupport) blocks.push(GUT_SUPPORT_GUIDANCE);

  const needsRecoveryOptimization =
    recoveryGoals.some(g => ["muscle-recovery", "inflammation-reduction", "sleep-optimization", "stress-recovery"].includes(g)) &&
    !needsConnectiveTissue;
  if (needsRecoveryOptimization) blocks.push(RECOVERY_OPTIMIZATION_GUIDANCE);

  return blocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERSECTION MODAL BUILDER — called by the setup route
// ─────────────────────────────────────────────────────────────────────────────

export interface TherapeuticModalContent {
  headline: string;
  selectedItems: string[];
  activeProtocols: string[];
  priorities: string[];
  body: string;
  conflictPolicy: string;
}

function formatEntryLabel(entry: TherapeuticEntry, labelMap: Record<string, string>): string {
  const name = entry.label || labelMap[entry.type] || entry.type;
  if (entry.dose > 0 && entry.unit) {
    return `${name} (${entry.dose} ${entry.unit})`;
  }
  return name;
}

export function buildTherapeuticModalContent(
  ctx: TherapeuticSupportCtx,
  user: {
    healthConditions?: string | string[] | null;
    specialtyConditions?: string | string[] | null;
    specialtyCondition?: string | null;
    performanceContext?: any;
    fitnessGoal?: string | null;
  }
): TherapeuticModalContent {
  const parseArr = (v: any): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String);
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : []; } catch { return []; }
  };

  const specialtyArr = parseArr(user.specialtyConditions);
  const healthArr = parseArr(user.healthConditions).map(c => c.toLowerCase());

  const activeHormones = (ctx.hormones ?? []).filter(e => e.dose > 0);
  const activePeptides = (ctx.peptides ?? []).filter(e => e.dose > 0);
  const activeMedications = (ctx.medications ?? []).filter(e => e.dose > 0);

  const selectedItems: string[] = [
    ...activeHormones.map(e => formatEntryLabel(e, HORMONE_LABELS)),
    ...activePeptides.map(e => formatEntryLabel(e, PEPTIDE_LABELS)),
    ...activeMedications.map(e => formatEntryLabel(e, MEDICATION_LABELS)),
    ...(ctx.therapies ?? []).map(s => THERAPY_LABELS[s] ?? s),
    ...(ctx.recoveryGoals ?? []).map(s => RECOVERY_GOAL_LABELS[s] ?? s),
  ];

  const activeProtocols: string[] = [];
  const priorities: string[] = [];

  const DIABETIC_KEYS = ["diabetes", "type 2 diabetes", "type 1 diabetes", "prediabetes", "diabetic"];
  const hasDiabetes = healthArr.some(c => DIABETIC_KEYS.some(k => c.includes(k)));
  if (hasDiabetes) { activeProtocols.push("Diabetes Support"); priorities.push("blood sugar management"); }

  const hasThyroid = specialtyArr.includes("thyroid-support") || specialtyArr.includes("hashimotos") ||
    user.specialtyCondition === "thyroid-support" ||
    healthArr.some(c => ["thyroid", "hashimoto", "hypothyroid", "hyperthyroid"].some(k => c.includes(k)));
  if (hasThyroid) { activeProtocols.push("Thyroid Support"); priorities.push("thyroid-supportive nutrition"); }

  if (specialtyArr.includes("pregnancy-support")) { activeProtocols.push("Pregnancy Support"); priorities.push("prenatal nutrient adequacy"); }

  if (specialtyArr.includes("performance-nutrition")) {
    const pCtx = user.performanceContext as any;
    const trainingLabel = pCtx?.trainingType ?? "Athletic Training";
    activeProtocols.push(trainingLabel.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) + " Training");
    priorities.push("performance fueling");
  }

  if (specialtyArr.includes("hormone-optimization")) { activeProtocols.push("Hormone Optimization"); priorities.push("hormonal balance"); }

  const CARDIAC_KEYS = ["cardiac", "heart disease", "cardiovascular", "coronary"];
  if (healthArr.some(c => CARDIAC_KEYS.some(k => c.includes(k)))) {
    activeProtocols.push("Cardiac Support"); priorities.push("cardiovascular protection");
  }

  const RENAL_KEYS = ["renal", "kidney", "ckd", "nephro"];
  if (healthArr.some(c => RENAL_KEYS.some(k => c.includes(k)))) {
    activeProtocols.push("Renal Support"); priorities.push("kidney-protective nutrition");
  }

  if (specialtyArr.includes("anti-inflammatory") || healthArr.some(c => c.includes("inflammatory"))) {
    activeProtocols.push("Anti-Inflammatory Protocol"); priorities.push("inflammation reduction");
  }

  const therapeuticPriorities: string[] = [];
  const hormoneSlugs = activeHormones.map(e => e.type);
  const peptideSlugs = activePeptides.map(e => e.type);
  const medicationSlugs = activeMedications.map(e => e.type);

  if (hormoneSlugs.some(t => t.startsWith("testosterone-"))) therapeuticPriorities.push("hormone-supportive protein adequacy");
  if (hormoneSlugs.includes("estradiol")) therapeuticPriorities.push("estrogen metabolism support");
  if (hormoneSlugs.includes("progesterone")) therapeuticPriorities.push("blood sugar stability");
  if (hormoneSlugs.includes("hgh")) therapeuticPriorities.push("anabolic protein synthesis");
  if (medicationSlugs.includes("prednisone")) therapeuticPriorities.push("bone protection and blood sugar management");
  if (medicationSlugs.includes("semaglutide") || medicationSlugs.includes("tirzepatide")) {
    therapeuticPriorities.push("nutrient density per calorie and muscle preservation");
  }
  if (peptideSlugs.some(p => ["bpc-157", "tb-500", "ghk-cu"].includes(p)) || (ctx.therapies ?? []).includes("connective-tissue-recovery")) {
    therapeuticPriorities.push("connective tissue recovery and collagen synthesis");
  }
  if ((ctx.therapies ?? []).includes("gut-support") || (ctx.recoveryGoals ?? []).includes("gut-healing")) {
    therapeuticPriorities.push("gut microbiome and digestive health");
  }
  if ((ctx.recoveryGoals ?? []).some(g => ["muscle-recovery", "inflammation-reduction", "sleep-optimization", "stress-recovery"].includes(g))) {
    therapeuticPriorities.push("recovery optimization and anti-inflammatory nutrition");
  }
  if ((ctx.recoveryGoals ?? []).includes("joint-recovery")) therapeuticPriorities.push("joint-protective nutrition");

  const allPriorities = [...therapeuticPriorities, ...priorities];

  const selectedText = selectedItems.length === 1
    ? selectedItems[0]
    : selectedItems.slice(0, -1).join(", ") + " and " + selectedItems[selectedItems.length - 1];

  let body: string;
  if (activeProtocols.length > 0) {
    const protocolText = activeProtocols.length === 1
      ? activeProtocols[0]
      : activeProtocols.slice(0, -1).join(", ") + " and " + activeProtocols[activeProtocols.length - 1];
    body = `You entered ${selectedText}. Because ${protocolText} ${activeProtocols.length === 1 ? "is" : "are"} also active, your meals will be built to support: ${allPriorities.join(", ")}.`;
  } else {
    body = `You entered ${selectedText}. Your meals will be built to support: ${allPriorities.length > 0 ? allPriorities.join(", ") : "your therapeutic nutrition goals"}.`;
  }

  body += "\n\nClinical safety requirements always take priority when protocols conflict.";

  return {
    headline: "Your Therapeutic Protocol Is Active",
    selectedItems,
    activeProtocols,
    priorities: allPriorities,
    body,
    conflictPolicy: "Clinical safety requirements always take priority when protocols conflict.",
  };
}
