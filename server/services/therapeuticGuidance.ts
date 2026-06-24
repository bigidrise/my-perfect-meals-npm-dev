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
 */

export interface TherapeuticSupportCtx {
  peptides: string[];
  hormones: string[];
  medications: string[];
  therapies: string[];
  recoveryGoals: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPLAY LABEL MAPS  (slug → human label for modal text)
// ─────────────────────────────────────────────────────────────────────────────

export const PEPTIDE_LABELS: Record<string, string> = {
  "bpc-157": "BPC-157",
  "tb-500": "TB-500",
  "sermorelin": "Sermorelin",
  "ipamorelin": "Ipamorelin",
  "ghk-cu": "GHK-Cu (Copper Peptide)",
};

export const HORMONE_LABELS: Record<string, string> = {
  "trt": "TRT / Testosterone Therapy",
  "estrogen": "Estrogen Therapy",
  "progesterone": "Progesterone Therapy",
  "growth-hormone": "Growth Hormone Support",
};

export const MEDICATION_LABELS: Record<string, string> = {
  "prednisone": "Prednisone / Corticosteroids",
  "metformin-therapeutic": "Metformin (Therapeutic)",
};

export const THERAPY_LABELS: Record<string, string> = {
  "connective-tissue-recovery": "Connective Tissue Recovery",
  "gut-support": "Gut Support",
  "red-light-therapy": "Red Light Therapy",
  "sauna-recovery": "Sauna / Heat Recovery",
  "cold-therapy": "Cold Therapy / Ice Bath",
};

export const RECOVERY_GOAL_LABELS: Record<string, string> = {
  "joint-recovery": "Joint Recovery",
  "muscle-recovery": "Muscle Recovery",
  "sleep-optimization": "Sleep Optimization",
  "inflammation-reduction": "Inflammation Reduction",
  "gut-healing": "Gut Healing",
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
This user is on progesterone therapy. Meal generation must support hormonal balance, blood sugar stability, and sleep quality.
PRIORITY NUTRIENTS: Magnesium-rich foods (pumpkin seeds, dark leafy greens, almonds, dark chocolate, avocado); vitamin B6 (salmon, poultry, potatoes, bananas); zinc (lean beef, pumpkin seeds, legumes); healthy fats (avocado, olive oil, walnuts, flaxseed); blood sugar stabilizing fiber (vegetables, legumes, whole grains).
HARD BLOCKS: NO high-glycemic refined carbohydrates as the primary base; NO processed foods with synthetic additives; NO alcohol; NO excess caffeine-containing foods.
MEAL STRUCTURE: Every meal must pair protein + fiber + healthy fat to stabilize blood sugar. Anti-inflammatory ingredients prioritized. Evening meals should include magnesium-rich foods to support sleep quality and progesterone's calming effects.
TONE: Frame as "hormone-balancing," "blood sugar-stabilizing," or "sleep-supportive." No medical claims.`.trim();

const GROWTH_HORMONE_GUIDANCE = `⚡ GROWTH HORMONE SUPPORT — NUTRITIONAL PROTOCOL:
This user is on growth hormone support. Meal generation must prioritize protein synthesis, fat metabolism, and insulin sensitivity.
PRIORITY NUTRIENTS: High-quality lean protein at every meal (≥30g — chicken breast, white fish, egg whites, Greek yogurt, lean turkey); healthy fats (avocado, olive oil, wild salmon, sardines); complex carbohydrates with low glycemic impact (sweet potato, oats, quinoa, legumes); arginine-containing foods (pumpkin seeds, turkey, chicken, fish, lentils).
HARD BLOCKS: NO high-glycemic simple sugars or refined carbohydrates; NO large carbohydrate loads at dinner (insulin spikes interfere with GH response); NO alcohol; NO seed oils; NO processed foods.
MEAL STRUCTURE: Protein-anchored meals at every sitting. Carbohydrate timing is critical — concentrate complex carbs around training windows, reduce at dinner. Healthy fats at each meal for hormonal support. Avoid late-night high-carbohydrate meals.
TONE: Frame as "anabolic recovery," "growth-supportive," or "metabolically efficient." No medical claims.`.trim();

const PREDNISONE_GUIDANCE = `⚠️ CORTICOSTEROID (PREDNISONE) NUTRITION PROTOCOL — MANDATORY:
This user is on corticosteroid therapy. Meal generation must mitigate nutritional side effects and support health during treatment.
PRIORITY NUTRIENTS: Calcium-rich foods for bone protection (dairy, fortified plant milks, leafy greens, sardines, almonds); vitamin D (salmon, eggs, fortified foods); potassium-rich foods to offset urinary potassium loss (bananas, sweet potato, avocado, leafy greens, white beans); lean protein for muscle preservation (≥25g per meal); anti-inflammatory omega-3 sources (salmon, sardines, walnuts, flaxseed, chia seeds); magnesium (leafy greens, pumpkin seeds, dark chocolate).
HARD BLOCKS: NO high-sodium processed foods, canned soups, or deli meats (corticosteroids cause sodium retention and blood pressure elevation); NO simple sugars or refined carbohydrates as primary base (corticosteroids raise blood glucose); NO alcohol; NO deep-fried foods.
MEAL STRUCTURE: Every meal must pair protein with fiber and healthy fat to manage blood sugar response. Include a potassium-rich vegetable or fruit at each meal. Prioritize anti-inflammatory whole foods. Limit sodium-heavy ingredients.
BLOOD SUGAR AWARENESS: Corticosteroid therapy elevates blood glucose. Avoid high-glycemic meals. Pair all carbohydrate sources with protein and fiber.
TONE: Frame as "treatment-supportive," "anti-inflammatory," or "bone-protective." No medical claims. No mention of drug interactions.`.trim();

const CONNECTIVE_TISSUE_GUIDANCE = `⚡ CONNECTIVE TISSUE RECOVERY NUTRITION PROTOCOL:
This user is focused on connective tissue recovery and repair. Meal generation must support collagen synthesis, anti-inflammation, and tissue healing.
PRIORITY NUTRIENTS: Collagen-supporting foods rich in glycine and proline (bone broth, chicken skin, gelatin-containing foods, lean meats — cook methods that preserve collagen); vitamin C at every meal (bell peppers, strawberries, kiwi, citrus, broccoli — critical for collagen cross-linking); high-quality protein for tissue repair (≥1.6g/kg — chicken, fish, eggs, lean meats); zinc for wound healing (pumpkin seeds, lean beef); anti-inflammatory omega-3 sources (salmon, sardines, walnuts, flaxseed, chia seeds); antioxidant-rich vegetables (colorful bell peppers, leafy greens, berries, turmeric, ginger).
HARD BLOCKS: NO inflammatory ingredients as primary components (refined sugars, seed oils, processed foods, fried foods, alcohol); NO nutritionally empty meals lacking collagen-supportive micronutrients.
MEAL STRUCTURE: At least one vitamin C source per meal. Protein at every meal — collagen synthesis requires adequate amino acid availability. Include anti-inflammatory ingredients — omega-3 sources, turmeric, ginger, colorful vegetables.
TONE: Frame as "recovery-focused," "tissue-repair," or "healing-supportive." No medical claims.`.trim();

const GUT_SUPPORT_GUIDANCE = `⚡ GUT SUPPORT NUTRITION PROTOCOL:
This user requires gut-supportive nutrition. Meal generation must prioritize digestive health, microbiome balance, and gut healing.
PRIORITY NUTRIENTS: Probiotic-rich fermented foods (yogurt, kefir, sauerkraut, kimchi, miso, tempeh — include one source per meal where possible); prebiotic fiber foods (garlic, onion, leeks, asparagus, bananas, oats — feed beneficial bacteria); gut-healing glutamine-containing foods (bone broth, eggs, red cabbage, parsley); easily digestible lean proteins (chicken, fish, eggs, tofu); anti-inflammatory omega-3 sources (salmon, sardines, walnuts, chia seeds); colorful vegetables for microbiome diversity.
HARD BLOCKS: NO artificial sweeteners (disrupt microbiome composition); NO refined sugars as primary base; NO alcohol; NO deep-fried foods; NO high-fat processed foods.
MEAL STRUCTURE: Every meal should include at least one probiotic or prebiotic source. Lean proteins over processed protein products. Gentle cooking methods preferred (steamed, baked, lightly sautéed). High variety of vegetables to support microbiome diversity.
TONE: Frame as "gut-supportive," "microbiome-friendly," or "digestive-health-focused." No medical claims.`.trim();

const RECOVERY_OPTIMIZATION_GUIDANCE = `⚡ RECOVERY OPTIMIZATION PROTOCOL:
This user is in active recovery optimization mode. Meal generation must maximize tissue repair, inflammation reduction, and restorative nutrition.
PRIORITY NUTRIENTS: Anti-inflammatory omega-3 sources at every meal (salmon, sardines, mackerel, walnuts, flaxseed, chia seeds); antioxidant-rich recovery foods (tart cherries, berries, colorful vegetables, turmeric, ginger); magnesium for muscle recovery and sleep quality (leafy greens, pumpkin seeds, dark chocolate, almonds); zinc for tissue repair (pumpkin seeds, lean beef, oysters); adequate protein for muscle protein synthesis (≥1.6g/kg — lean meats, fish, eggs, legumes); vitamin C for collagen repair (bell peppers, citrus, kiwi, broccoli).
HARD BLOCKS: NO inflammatory ingredients (refined sugars, seed oils, processed snack foods); NO alcohol; NO deep-fried foods.
MEAL STRUCTURE: Every meal must be anti-inflammatory as the default. Include at least one omega-3 source daily. Include magnesium-rich food daily. Color diversity in vegetables — target 3+ colors per meal. Protein at every meal.
TONE: Frame as "recovery-focused," "anti-inflammatory," or "restorative." No medical claims.`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// MAIN BUILDER — called by universalMedicalGuidance
// ─────────────────────────────────────────────────────────────────────────────

export function buildTherapeuticGuidanceBlocks(ctx: TherapeuticSupportCtx): string[] {
  const blocks: string[] = [];

  const hormones = ctx.hormones ?? [];
  const medications = ctx.medications ?? [];
  const peptides = ctx.peptides ?? [];
  const therapies = ctx.therapies ?? [];
  const recoveryGoals = ctx.recoveryGoals ?? [];

  if (hormones.includes("trt")) blocks.push(TRT_GUIDANCE);
  if (hormones.includes("estrogen")) blocks.push(ESTROGEN_GUIDANCE);
  if (hormones.includes("progesterone")) blocks.push(PROGESTERONE_GUIDANCE);
  if (hormones.includes("growth-hormone")) blocks.push(GROWTH_HORMONE_GUIDANCE);

  if (medications.includes("prednisone")) blocks.push(PREDNISONE_GUIDANCE);

  const needsConnectiveTissue =
    peptides.some(p => ["bpc-157", "tb-500", "ghk-cu"].includes(p)) ||
    therapies.includes("connective-tissue-recovery") ||
    recoveryGoals.includes("joint-recovery");
  if (needsConnectiveTissue) blocks.push(CONNECTIVE_TISSUE_GUIDANCE);

  const needsGutSupport =
    therapies.includes("gut-support") ||
    recoveryGoals.includes("gut-healing");
  if (needsGutSupport) blocks.push(GUT_SUPPORT_GUIDANCE);

  const needsRecoveryOptimization =
    recoveryGoals.some(g => ["muscle-recovery", "inflammation-reduction", "sleep-optimization"].includes(g)) &&
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

  const selectedItems: string[] = [
    ...ctx.peptides.map(s => PEPTIDE_LABELS[s] ?? s),
    ...ctx.hormones.map(s => HORMONE_LABELS[s] ?? s),
    ...ctx.medications.map(s => MEDICATION_LABELS[s] ?? s),
    ...ctx.therapies.map(s => THERAPY_LABELS[s] ?? s),
    ...ctx.recoveryGoals.map(s => RECOVERY_GOAL_LABELS[s] ?? s),
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
  if (specialtyArr.includes("pregnancy-support")) { /* already handled */ }

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
  if (ctx.hormones.includes("trt")) therapeuticPriorities.push("hormone-supportive protein adequacy");
  if (ctx.hormones.includes("estrogen")) therapeuticPriorities.push("estrogen metabolism support");
  if (ctx.hormones.includes("progesterone")) therapeuticPriorities.push("blood sugar stability");
  if (ctx.hormones.includes("growth-hormone")) therapeuticPriorities.push("anabolic protein synthesis");
  if (ctx.medications.includes("prednisone")) therapeuticPriorities.push("bone protection and blood sugar management");
  if (ctx.peptides.some(p => ["bpc-157", "tb-500", "ghk-cu"].includes(p)) || ctx.therapies.includes("connective-tissue-recovery")) {
    therapeuticPriorities.push("connective tissue recovery and collagen synthesis");
  }
  if (ctx.therapies.includes("gut-support") || ctx.recoveryGoals.includes("gut-healing")) {
    therapeuticPriorities.push("gut microbiome and digestive health");
  }
  if (ctx.recoveryGoals.some(g => ["muscle-recovery", "inflammation-reduction", "sleep-optimization"].includes(g))) {
    therapeuticPriorities.push("recovery optimization and anti-inflammatory nutrition");
  }
  if (ctx.recoveryGoals.includes("joint-recovery")) therapeuticPriorities.push("joint-protective nutrition");

  const allPriorities = [...therapeuticPriorities, ...priorities];

  const selectedText = selectedItems.length === 1
    ? selectedItems[0]
    : selectedItems.slice(0, -1).join(", ") + " and " + selectedItems[selectedItems.length - 1];

  let body: string;
  if (activeProtocols.length > 0) {
    const protocolText = activeProtocols.length === 1
      ? activeProtocols[0]
      : activeProtocols.slice(0, -1).join(", ") + " and " + activeProtocols[activeProtocols.length - 1];
    body = `You selected ${selectedText}. Because ${protocolText} ${activeProtocols.length === 1 ? "is" : "are"} also active, your meals will be built to support: ${allPriorities.join(", ")}.`;
  } else {
    body = `You selected ${selectedText}. Your meals will be built to support: ${allPriorities.length > 0 ? allPriorities.join(", ") : "your therapeutic nutrition goals"}.`;
  }

  return {
    headline: "Your Therapeutic Protocol Is Active",
    selectedItems,
    activeProtocols,
    priorities: allPriorities,
    body,
    conflictPolicy: "Clinical safety requirements always take priority when protocols conflict.",
  };
}
