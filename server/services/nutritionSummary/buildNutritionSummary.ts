/**
 * buildNutritionSummary.ts
 *
 * Converts the assembled UserProtocolEnvelope + raw user extras into a
 * structured, human-readable NutritionPersonalizationSummary DTO.
 *
 * Rules:
 *   - No AI. Fully deterministic templates.
 *   - No new protocol logic. Only reads what the envelope already computed.
 *   - Conflict policy is a fixed string — never changes.
 *   - Composite explanation is template-assembled from active inputs.
 */

import type { UserProtocolEnvelope } from "../protocolEnvelope";

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT DTO
// ─────────────────────────────────────────────────────────────────────────────

export interface NutritionSummaryHealthItem {
  label: string;
  priority: "high" | "moderate";
}

export interface NutritionPersonalizationSummary {
  activeInputs: {
    health: NutritionSummaryHealthItem[];
    performance: { label: string; detail: string } | null;
    pregnancy: { label: string; detail: string } | null;
    dietary: string[];
    goal: string | null;
    macros: {
      calories: number | null;
      proteinG: number | null;
      carbsG: number | null;
      fatG: number | null;
    } | null;
  };
  nutritionPriorities: string[];
  compositeExplanation: string;
  conflictPolicy: string;
  hasAnyActiveProtocol: boolean;
  meta: { generatedAt: string };
}

export interface UserExtrasForSummary {
  dailyCalorieTarget?: number | null;
  dailyProteinTarget?: number | null;
  dailyCarbTarget?: number | null;
  dailyFatTarget?: number | null;
  goalType?: string | null;
  goalTarget?: string | null;
  fitnessGoal?: string | null;
  performanceContext?: any | null;
  weeklyTrainingSchedule?: any | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION → LABEL MAP
// Mirrors ProtocolVisibilityPanel's PROTOCOL_MAP, server-side.
// ─────────────────────────────────────────────────────────────────────────────

interface ConditionEntry {
  label: string;
  priority: "high" | "moderate";
  priorities: string[];
}

const CONDITION_MAP: Record<string, ConditionEntry> = {
  // Diabetes family
  diabetes:           { label: "Diabetes Support",        priority: "high",     priorities: ["Blood sugar management", "Low-glycemic food choices"] },
  diabetic:           { label: "Diabetes Support",        priority: "high",     priorities: ["Blood sugar management", "Low-glycemic food choices"] },
  "diabetes-type1":   { label: "Type 1 Diabetes Support", priority: "high",     priorities: ["Blood sugar management", "Carbohydrate awareness"] },
  "diabetes-type2":   { label: "Type 2 Diabetes Support", priority: "high",     priorities: ["Blood sugar management", "Low-glycemic food choices"] },
  prediabetes:        { label: "Prediabetes Support",     priority: "high",     priorities: ["Blood sugar awareness", "Reduced refined carbohydrates"] },
  // GLP-1
  "glp-1":            { label: "GLP-1 Protocol",          priority: "high",     priorities: ["Portion control", "High protein, low fat meals", "No carbonated beverages"] },
  glp1:               { label: "GLP-1 Protocol",          priority: "high",     priorities: ["Portion control", "High protein, low fat meals", "No carbonated beverages"] },
  // Anti-inflammatory
  "anti-inflammatory":{ label: "Anti-Inflammatory Diet",  priority: "high",     priorities: ["Anti-inflammatory foods", "No seed oils", "Omega-3 priority"] },
  "anti_inflammatory":{ label: "Anti-Inflammatory Diet",  priority: "high",     priorities: ["Anti-inflammatory foods", "No seed oils", "Omega-3 priority"] },
  arthritis:          { label: "Anti-Inflammatory Diet",  priority: "high",     priorities: ["Anti-inflammatory foods", "Joint-supportive nutrition"] },
  // Cardiac
  cardiac:            { label: "Cardiac Support",         priority: "high",     priorities: ["Sodium awareness", "No saturated fats", "Heart-healthy foods"] },
  "heart-disease":    { label: "Cardiac Support",         priority: "high",     priorities: ["Sodium awareness", "No saturated fats", "Heart-healthy foods"] },
  hypertension:       { label: "Cardiac Support",         priority: "high",     priorities: ["Sodium awareness", "Blood pressure support"] },
  // Renal
  renal:              { label: "Renal Support",           priority: "high",     priorities: ["Kidney-safe filtering", "Low potassium and phosphorus", "Limited protein"] },
  "kidney-disease":   { label: "Renal Support",           priority: "high",     priorities: ["Kidney-safe filtering", "Low potassium and phosphorus", "Limited protein"] },
  ckd:                { label: "Renal Support",           priority: "high",     priorities: ["Kidney-safe filtering", "Low potassium and phosphorus", "Limited protein"] },
  // Oncology
  oncology:           { label: "Oncology Support",        priority: "high",     priorities: ["Nutrient density", "Immune-supportive foods", "Symptom-aware meals"] },
  "oncology-support": { label: "Oncology Support",        priority: "high",     priorities: ["Nutrient density", "Immune-supportive foods", "Symptom-aware meals"] },
  // Liver
  "liver-support":    { label: "Liver Support",           priority: "moderate", priorities: ["No alcohol", "Low added sugar", "Liver-protective foods"] },
  "liver-disease":    { label: "Liver Support",           priority: "moderate", priorities: ["No alcohol", "Low added sugar", "Liver-protective foods"] },
  // Thyroid
  "thyroid-support":  { label: "Thyroid Support",         priority: "moderate", priorities: ["Selenium-rich proteins", "Thyroid medication timing awareness"] },
  hashimotos:         { label: "Hashimoto's Support",     priority: "moderate", priorities: ["Anti-inflammatory emphasis", "Selenium and zinc priority", "Gluten-minimal preference"] },
  hypothyroid:        { label: "Hypothyroid Support",     priority: "moderate", priorities: ["Selenium-rich proteins", "Metabolic regularity", "Iron support"] },
  hyperthyroid:       { label: "Hyperthyroid Support",    priority: "moderate", priorities: ["High-calcium foods", "Iodine-smart choices", "Caloric support"] },
  // Hormone
  "hormone-optimization": { label: "Hormone Optimization", priority: "moderate", priorities: ["Hormone-supportive nutrition", "Healthy fat support", "Mineral balance"] },
  menopause:          { label: "Menopause Support",       priority: "moderate", priorities: ["Bone density support", "Phytoestrogen foods", "Calcium priority"] },
  perimenopause:      { label: "Perimenopause Support",   priority: "moderate", priorities: ["Hormone-balancing foods", "Magnesium support", "Reduced refined carbs"] },
  "metabolic-recovery": { label: "Metabolic Recovery",   priority: "moderate", priorities: ["Insulin sensitivity support", "Nutrient density", "Blood sugar stability"] },
  // Cholesterol / gout
  cholesterol:        { label: "Cholesterol Support",     priority: "moderate", priorities: ["Low saturated fat", "Fiber-rich foods", "Omega-3 priority"] },
  gout:               { label: "Gout Support",            priority: "moderate", priorities: ["Low purine foods", "Uric acid management"] },
  // Pregnancy
  "pregnancy-support":{ label: "Pregnancy Nutrition",    priority: "high",     priorities: ["Prenatal nutrient priority", "Food safety focus", "Folate and iron support"] },
};

const DIET_LABEL_MAP: Record<string, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  pescatarian: "Pescatarian",
  keto: "Ketogenic",
  "low-carb": "Low-Carb",
  paleo: "Paleo",
  "gluten-free": "Gluten-Free",
  "dairy-free": "Dairy-Free",
  halal: "Halal",
  kosher: "Kosher",
  carnivore: "Carnivore",
  mediterranean: "Mediterranean",
};

const PERFORMANCE_OVERLAY_LABELS: Record<string, string> = {
  performance:       "Athletic Performance",
  competition_prep:  "Competition Preparation",
  recovery:          "Recovery Phase",
  recomp:            "Body Recomposition",
  standard:          "",
};

const GOAL_LABELS: Record<string, string> = {
  lose:     "Fat Loss",
  maintain: "Weight Maintenance",
  gain:     "Muscle Building",
};

const FITNESS_GOAL_LABELS: Record<string, string> = {
  weight_loss:    "Fat Loss",
  muscle_gain:    "Muscle Building",
  maintenance:    "Maintenance",
  endurance:      "Endurance Performance",
  performance:    "Athletic Performance",
  body_recomp:    "Body Recomposition",
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY → PRIORITY STRING MAP
// Each active condition contributes nutrition priorities to the bullet list.
// Duplicates are removed. Order is: clinical safety first, then performance.
// ─────────────────────────────────────────────────────────────────────────────

const PERFORMANCE_OVERLAY_PRIORITIES: Record<string, string[]> = {
  performance:      ["Strategic carbohydrate timing", "Protein for muscle support", "Performance fuel optimization"],
  competition_prep: ["Competition-phase nutrition", "Body composition management", "Peak performance fueling"],
  recovery:         ["Recovery nutrition support", "Anti-inflammatory foods", "Protein for tissue repair"],
  recomp:           ["Protein priority for recomposition", "Calorie-controlled performance fuel", "Body composition optimization"],
};

const GOAL_PRIORITIES: Record<string, string[]> = {
  lose:     ["Calorie control for fat loss"],
  gain:     ["Calorie surplus for muscle building"],
  maintain: [],
};

const CONFLICT_POLICY =
  "Clinical safety requirements always take priority when protocols conflict.";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export function buildNutritionSummary(
  envelope: UserProtocolEnvelope,
  extras: UserExtrasForSummary
): NutritionPersonalizationSummary {
  const generatedAt = new Date().toISOString();

  // ── 1. Health conditions ──────────────────────────────────────────────────
  const seenHealthLabel = new Set<string>();
  const healthItems: NutritionSummaryHealthItem[] = [];
  const allPriorities: string[] = [];

  const checkCondition = (slug: string) => {
    const key = slug.toLowerCase().trim();
    const entry = CONDITION_MAP[key];
    if (entry && !seenHealthLabel.has(entry.label)) {
      seenHealthLabel.add(entry.label);
      healthItems.push({ label: entry.label, priority: entry.priority });
      for (const p of entry.priorities) {
        if (!allPriorities.includes(p)) allPriorities.push(p);
      }
    }
  };

  // Pull from all condition sources the envelope assembled
  for (const c of envelope.medicalHardLimits) checkCondition(c);
  for (const c of envelope.medicalOptimization) checkCondition(c);

  // Specialty conditions (thyroid, hormone, pregnancy, etc.)
  if (envelope.thyroidSupport) {
    const key = envelope.thyroidType ?? "thyroid-support";
    checkCondition(key);
    if (!seenHealthLabel.has("Thyroid Support") && !seenHealthLabel.has("Hashimoto's Support")) {
      checkCondition("thyroid-support");
    }
  }
  if (envelope.hormoneOptimization) checkCondition("hormone-optimization");
  // menopause / perimenopause come through medicalOptimization already

  // ── 2. Performance ────────────────────────────────────────────────────────
  let performanceSummary: { label: string; detail: string } | null = null;
  const overlayKey = envelope.performanceOverlay;
  if (overlayKey && overlayKey !== "standard") {
    const overlayLabel = PERFORMANCE_OVERLAY_LABELS[overlayKey] ?? overlayKey;
    let detail = "";
    const pCtx = extras.performanceContext;
    if (pCtx?.trainingType) {
      const typeLabels: Record<string, string> = {
        strength: "Strength Training", powerlifting: "Powerlifting", bodybuilding: "Bodybuilding",
        crossfit: "CrossFit", running: "Running", cycling: "Cycling", swimming: "Swimming",
        basketball: "Basketball", soccer: "Soccer", baseball: "Baseball", football: "Football",
        volleyball: "Volleyball", tennis: "Tennis", martial_arts: "Martial Arts", other: pCtx.customSportName ?? "Custom Sport",
      };
      detail = typeLabels[pCtx.trainingType] ?? pCtx.trainingType;
    }

    // Check today's session if weekly schedule exists
    if (extras.weeklyTrainingSchedule?.schedule) {
      const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      const todayKey = days[new Date().getDay()];
      const todayType = extras.weeklyTrainingSchedule.schedule[todayKey];
      if (todayType && todayType !== "off") {
        const sessionLabels: Record<string, string> = {
          strength: "Strength Day", power: "Power Day", endurance: "Endurance Day",
          sport_practice: "Sport Practice Day", competition: "Competition Day",
          recovery: "Recovery Day", off: "Rest Day",
        };
        detail = sessionLabels[todayType] ?? todayType;
      }
    }

    performanceSummary = { label: overlayLabel, detail };

    const perfPriorities = PERFORMANCE_OVERLAY_PRIORITIES[overlayKey] ?? [];
    for (const p of perfPriorities) {
      if (!allPriorities.includes(p)) allPriorities.push(p);
    }
  }

  // ── 3. Pregnancy ──────────────────────────────────────────────────────────
  let pregnancySummary: { label: string; detail: string } | null = null;
  if (envelope.pregnancySupport && envelope.pregnancySupportContext) {
    const ctx = envelope.pregnancySupportContext;
    const stageLabels: Record<string, string> = {
      "trying-to-conceive": "Trying to Conceive",
      "trimester-1": "First Trimester",
      "trimester-2": "Second Trimester",
      "trimester-3": "Third Trimester",
      breastfeeding: "Breastfeeding",
      postpartum: "Postpartum",
    };
    const stageLabel = stageLabels[ctx.stage] ?? ctx.stage;
    const detail = ctx.weekOfPregnancy ? `Week ${ctx.weekOfPregnancy}` : stageLabel;
    pregnancySummary = { label: "Pregnancy Nutrition", detail };
    const pregPriorities = ["Prenatal nutrient priority", "Food safety focus", "Folate and iron support"];
    for (const p of pregPriorities) {
      if (!allPriorities.includes(p)) allPriorities.push(p);
    }
  }

  // ── 4. Dietary identity ───────────────────────────────────────────────────
  const dietItems: string[] = [];
  for (const d of envelope.dietaryIdentity) {
    const label = DIET_LABEL_MAP[d.toLowerCase().trim()];
    if (label && !dietItems.includes(label)) dietItems.push(label);
  }

  // ── 5. Goal ───────────────────────────────────────────────────────────────
  let goalLabel: string | null = null;
  if (extras.goalType) {
    goalLabel = GOAL_LABELS[extras.goalType] ?? null;
    const goalPriorities = GOAL_PRIORITIES[extras.goalType] ?? [];
    for (const p of goalPriorities) {
      if (!allPriorities.includes(p)) allPriorities.push(p);
    }
  } else if (extras.fitnessGoal) {
    goalLabel = FITNESS_GOAL_LABELS[extras.fitnessGoal] ?? extras.fitnessGoal;
  }

  // ── 6. Macros ─────────────────────────────────────────────────────────────
  const hasMacros =
    extras.dailyCalorieTarget ||
    extras.dailyProteinTarget ||
    extras.dailyCarbTarget ||
    extras.dailyFatTarget;

  const macros = hasMacros
    ? {
        calories: extras.dailyCalorieTarget ?? null,
        proteinG: extras.dailyProteinTarget ?? null,
        carbsG: extras.dailyCarbTarget ?? null,
        fatG: extras.dailyFatTarget ?? null,
      }
    : null;

  // ── 7. hasAnyActiveProtocol ───────────────────────────────────────────────
  const hasAnyActiveProtocol =
    healthItems.length > 0 ||
    !!performanceSummary ||
    !!pregnancySummary ||
    (dietItems.length > 0 && dietItems.some(d => ![""].includes(d)));

  // ── 8. Composite explanation ──────────────────────────────────────────────
  const compositeExplanation = buildCompositeExplanation({
    healthItems,
    performanceSummary,
    pregnancySummary,
    dietItems,
    goalLabel,
    nutritionPriorities: allPriorities,
    hasAnyActiveProtocol,
  });

  return {
    activeInputs: {
      health: healthItems,
      performance: performanceSummary,
      pregnancy: pregnancySummary,
      dietary: dietItems,
      goal: goalLabel,
      macros,
    },
    nutritionPriorities: allPriorities.slice(0, 8),
    compositeExplanation,
    conflictPolicy: CONFLICT_POLICY,
    hasAnyActiveProtocol,
    meta: { generatedAt },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE EXPLANATION BUILDER
// Deterministic template — no AI. Reads active inputs and fills a template.
// ─────────────────────────────────────────────────────────────────────────────

function buildCompositeExplanation(args: {
  healthItems: NutritionSummaryHealthItem[];
  performanceSummary: { label: string; detail: string } | null;
  pregnancySummary: { label: string; detail: string } | null;
  dietItems: string[];
  goalLabel: string | null;
  nutritionPriorities: string[];
  hasAnyActiveProtocol: boolean;
}): string {
  const {
    healthItems, performanceSummary, pregnancySummary,
    dietItems, goalLabel, nutritionPriorities, hasAnyActiveProtocol,
  } = args;

  if (!hasAnyActiveProtocol) {
    return "Your meals are personalized using your dietary preferences and macro targets. Every meal generated respects your active food choices and nutritional goals.";
  }

  const parts: string[] = [];

  // Collect all active inputs into a natural-language list
  const activeNames: string[] = [
    ...healthItems.map(h => h.label),
    ...(pregnancySummary ? [pregnancySummary.label] : []),
    ...(performanceSummary ? [performanceSummary.label + (performanceSummary.detail ? ` (${performanceSummary.detail})` : "")] : []),
    ...(dietItems.length > 0 ? [`${dietItems.join(", ")} dietary rules`] : []),
    ...(goalLabel ? [`${goalLabel} goal`] : []),
  ];

  const nameStr = formatList(activeNames);

  // Priorities list
  const topPriorities = nutritionPriorities.slice(0, 6);
  const priorityStr = topPriorities.length > 0
    ? formatList(topPriorities.map(p => p.toLowerCase()))
    : "your active nutritional needs";

  if (activeNames.length === 1) {
    parts.push(`Because you have ${nameStr} active, your meals will prioritize ${priorityStr}.`);
  } else {
    parts.push(`Because you have ${nameStr} active simultaneously, your meals will prioritize ${priorityStr}.`);
  }

  // Always append conflict policy
  parts.push(CONFLICT_POLICY);

  return parts.join(" ");
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const last = items[items.length - 1];
  const rest = items.slice(0, -1).join(", ");
  return `${rest}, and ${last}`;
}
