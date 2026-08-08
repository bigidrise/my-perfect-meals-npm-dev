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
  key: string;
  label: string;
  priority: "high" | "moderate";
}

export interface NutritionPersonalizationSummary {
  activeInputs: {
    health: NutritionSummaryHealthItem[];
    performance: { label: string; detail: string } | null;
    pregnancy: { label: string; detail: string } | null;
    therapeutic: { label: string; detail: string } | null;
    cuisine: string | null;
    dietary: string[];
    goal: string | null;
    macros: {
      calories: number | null;
      proteinG: number | null;
      carbsG: number | null;
      starchyCarbsG: number | null;
      fibrousCarbsG: number | null;
      fatG: number | null;
    } | null;
  };
  dietaryIdentity: string[];
  mealBuilderLabel: string | null;
  nutritionDrivers: {
    medicalConditions: NutritionSummaryHealthItem[];
    therapeuticInputs: Array<{ name: string; dose: string }>;
    liveMetrics: Array<{ label: string; value: string }>;
  } | null;
  nutritionPriorities: string[];
  compositeExplanation: string;
  conflictPolicy: string;
  hasAnyActiveProtocol: boolean;
  carbCycleActive: boolean;
  /** Alpha-gal protocol detail — null if not active */
  alphaGal: {
    dairyTolerance: "yes" | "no" | "unsure";
    gelatinRestriction: "yes" | "no" | "unsure";
    profileComplete: boolean;
  } | null;
  meta: { generatedAt: string };
}

export interface UserExtrasForSummary {
  dailyCalorieTarget?: number | null;
  dailyProteinTarget?: number | null;
  dailyCarbTarget?: number | null;
  dailyStarchyCarbsTarget?: number | null;
  dailyFibrousCarbsTarget?: number | null;
  dailyFatTarget?: number | null;
  goalType?: string | null;
  goalTarget?: string | null;
  goalTimelineWeeks?: number | null;
  fitnessGoal?: string | null;
  performanceContext?: any | null;
  weeklyTrainingSchedule?: any | null;
  latestGlucose?: number | null;
  selectedMealBuilder?: string | null;
  activeBoard?: string | null;
  carbCycleState?: any | null;
  /** Alpha-gal profile JSONB — passed to populate detail card in summary */
  alphaGalProfile?: {
    dairyTolerance: "yes" | "no" | "unsure";
    gelatinRestriction: "yes" | "no" | "unsure";
    profileComplete: boolean;
  } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION → LABEL MAP
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
  "glp-1":            { label: "GLP-1 Protocol",          priority: "high",     priorities: ["Portion density priority", "High protein, low fat meals", "No carbonated beverages"] },
  glp1:               { label: "GLP-1 Protocol",          priority: "high",     priorities: ["Portion density priority", "High protein, low fat meals", "No carbonated beverages"] },
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
  // Therapeutic support (fallback — detail filled from entries below)
  "therapeutic-support": { label: "Therapeutic Support", priority: "moderate", priorities: ["Therapeutic nutrition support"] },
  // Alpha-gal Syndrome — clinical allergy; mammalian meat/fat hard blocks
  "alpha-gal-syndrome": { label: "Alpha-gal Syndrome",   priority: "high",     priorities: ["Mammalian meat excluded", "Mammalian fat excluded", "Allergy-safe meal generation"] },
  "alpha-gal syndrome":  { label: "Alpha-gal Syndrome",   priority: "high",     priorities: ["Mammalian meat excluded", "Mammalian fat excluded", "Allergy-safe meal generation"] },
  "alpha-gal":           { label: "Alpha-gal Syndrome",   priority: "high",     priorities: ["Mammalian meat excluded", "Allergy-safe meal generation"] },
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
  "high-protein": "High Protein",
  "plant-based": "Plant-Based",
};

const BUILDER_LABEL_MAP: Record<string, string> = {
  weekly:                  "Weekly Meal Planner",
  diabetic:                "Diabetic Builder",
  glp1:                    "GLP-1 Builder",
  anti_inflammatory:       "Anti-Inflammatory Builder",
  beach_body:              "Performance Nutrition Builder",
  general_nutrition:       "General Nutrition Builder",
  performance_competition: "Competition Builder",
};

const CUISINE_LABEL_MAP: Record<string, string> = {
  mexican:      "Mexican Cuisine",
  italian:      "Italian Cuisine",
  asian:        "Asian Cuisine",
  japanese:     "Japanese Cuisine",
  chinese:      "Chinese Cuisine",
  indian:       "Indian Cuisine",
  mediterranean:"Mediterranean Cuisine",
  middle_eastern:"Middle Eastern Cuisine",
  thai:         "Thai Cuisine",
  greek:        "Greek Cuisine",
  french:       "French Cuisine",
  american:     "American Cuisine",
  southern:     "Southern Cuisine",
  caribbean:    "Caribbean Cuisine",
  african:      "African Cuisine",
  korean:       "Korean Cuisine",
  vietnamese:   "Vietnamese Cuisine",
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
// PRIORITY STRING MAPS
// ─────────────────────────────────────────────────────────────────────────────

const PERFORMANCE_OVERLAY_PRIORITIES: Record<string, string[]> = {
  performance:      ["Strategic carbohydrate timing", "Protein for muscle support", "Performance fuel optimization"],
  competition_prep: ["Competition-phase nutrition", "Body composition management", "Peak performance fueling"],
  recovery:         ["Recovery nutrition support", "Anti-inflammatory foods", "Protein for tissue repair"],
  recomp:           ["Protein priority for recomposition", "Calorie-controlled performance fuel", "Body composition optimization"],
};

const PERF_GOAL_PRIORITIES: Record<string, string[]> = {
  fat_loss:    ["Calorie-controlled performance fuel", "Body composition management"],
  muscle_gain: ["Anabolic muscle-building nutrition", "Caloric surplus for growth"],
  maintenance: [],
  performance: ["Peak output and power fueling", "Glycogen replenishment strategy"],
};

const PERF_PHASE_PRIORITIES: Record<string, string[]> = {
  off_season:  ["Volume-focused base building", "Nutrient density for recovery"],
  pre_season:  ["Conditioning ramp-up nutrition", "Carbohydrate periodization"],
  in_season:   ["Performance maintenance nutrition", "Competition-day fuel timing"],
  weight_cut:  ["Controlled deficit with muscle preservation", "Hydration optimization"],
  recovery:    ["Recovery nutrition support", "Anti-inflammatory food focus"],
};

const CARDIO_FOCUS_PRIORITIES: Record<string, string[]> = {
  zone_2:    ["Zone 2 cardio fat oxidation support"],
  hiit:      ["High-intensity glycolytic fuel replenishment"],
  threshold: ["Lactate threshold nutrition support"],
  tempo:     ["Aerobic efficiency fueling"],
  none:      [],
  recovery:  [],
  mixed:     ["Mixed-zone cardio fuel strategy"],
};

const GOAL_PRIORITIES: Record<string, string[]> = {
  lose:     ["Calorie control for fat loss"],
  gain:     ["Calorie surplus for muscle building"],
  maintain: [],
};

const CONFLICT_POLICY =
  "Clinical safety requirements always take priority when protocols conflict.";

// ─────────────────────────────────────────────────────────────────────────────
// THERAPEUTIC ENTRY → PRIORITY MAPPING
// ─────────────────────────────────────────────────────────────────────────────

interface TherapeuticEntry {
  type: string;
  dose: number;
  unit: string;
  frequency?: string;
  label?: string;
  custom?: boolean;
}

function buildTherapeuticSummary(ctx: {
  peptides: TherapeuticEntry[];
  hormones: TherapeuticEntry[];
  medications: TherapeuticEntry[];
  therapies: string[];
  recoveryGoals: string[];
} | null): { label: string; detail: string; priorities: string[] } | null {
  if (!ctx) return null;

  const activeHormones = ctx.hormones.filter(e => e.dose > 0);
  const activePeptides = ctx.peptides.filter(e => e.dose > 0);
  const activeMeds     = ctx.medications.filter(e => e.dose > 0);

  const hasAny = activeHormones.length > 0 || activePeptides.length > 0 || activeMeds.length > 0 || ctx.therapies.length > 0;
  if (!hasAny) return null;

  const priorities: string[] = [];
  const labels: string[] = [];

  // Hormones
  for (const h of activeHormones) {
    const t = h.type.toLowerCase();
    if (t.startsWith("testosterone")) {
      labels.push(h.label ?? "Testosterone Therapy");
      if (!priorities.includes("Muscle preservation and anabolic nutrition support"))
        priorities.push("Muscle preservation and anabolic nutrition support");
      if (!priorities.includes("Protein-first meal construction"))
        priorities.push("Protein-first meal construction");
      if (!priorities.includes("Healthy fat support for hormone production"))
        priorities.push("Healthy fat support for hormone production");
    } else if (t.includes("hgh") || t.includes("growth-hormone")) {
      labels.push(h.label ?? "HGH");
      if (!priorities.includes("Anabolic recovery nutrition"))
        priorities.push("Anabolic recovery nutrition");
    } else if (t.includes("estradiol") || t.includes("progesterone")) {
      labels.push(h.label ?? "Hormone Therapy");
      if (!priorities.includes("Hormone-supportive nutrition"))
        priorities.push("Hormone-supportive nutrition");
    } else if (t.includes("dhea")) {
      labels.push(h.label ?? "DHEA");
      if (!priorities.includes("Adrenal-supportive nutrition"))
        priorities.push("Adrenal-supportive nutrition");
    } else if (t.includes("t3") || t.includes("liothyronine")) {
      labels.push(h.label ?? "T3 Therapy");
      if (!priorities.includes("Metabolic rate nutritional support"))
        priorities.push("Metabolic rate nutritional support");
    } else {
      labels.push(h.label ?? h.type);
      if (!priorities.includes("Hormone-optimized macronutrient ratio"))
        priorities.push("Hormone-optimized macronutrient ratio");
    }
  }

  // Peptides
  const recoveryPeptides = ["bpc-157", "tb-500", "ghk-cu"];
  for (const p of activePeptides) {
    const t = p.type.toLowerCase();
    labels.push(p.label ?? p.type.toUpperCase());
    if (recoveryPeptides.some(r => t.includes(r))) {
      if (!priorities.includes("Recovery-optimized food selection"))
        priorities.push("Recovery-optimized food selection");
      if (!priorities.includes("Anti-inflammatory food emphasis"))
        priorities.push("Anti-inflammatory food emphasis");
    } else if (t.includes("sermorelin") || t.includes("ipamorelin") || t.includes("cjc")) {
      if (!priorities.includes("Growth hormone support nutrition"))
        priorities.push("Growth hormone support nutrition");
    } else if (t.includes("nad")) {
      if (!priorities.includes("Cellular energy and mitochondrial nutrition support"))
        priorities.push("Cellular energy and mitochondrial nutrition support");
    } else {
      if (!priorities.includes("Peptide-compatible nutritional support"))
        priorities.push("Peptide-compatible nutritional support");
    }
  }

  // Medications
  for (const m of activeMeds) {
    const t = m.type.toLowerCase();
    labels.push(m.label ?? m.type);
    if (t.includes("semaglutide") || t.includes("ozempic") || t.includes("tirzepatide") || t.includes("mounjaro")) {
      if (!priorities.includes("GLP-1 medication compatibility"))
        priorities.push("GLP-1 medication compatibility");
      if (!priorities.includes("Portion density priority"))
        priorities.push("Portion density priority");
      if (!priorities.includes("Nutrient density over volume"))
        priorities.push("Nutrient density over volume");
    } else if (t.includes("metformin")) {
      if (!priorities.includes("Blood sugar management"))
        priorities.push("Blood sugar management");
    } else if (t.includes("prednisone")) {
      if (!priorities.includes("Sodium and potassium awareness"))
        priorities.push("Sodium and potassium awareness");
      if (!priorities.includes("Blood sugar stability under corticosteroid therapy"))
        priorities.push("Blood sugar stability under corticosteroid therapy");
    } else if (t.includes("tamoxifen") || t.includes("anastrozole")) {
      if (!priorities.includes("Estrogen-aware food selection"))
        priorities.push("Estrogen-aware food selection");
    } else {
      if (!priorities.includes("Medication-compatible nutrition support"))
        priorities.push("Medication-compatible nutrition support");
    }
  }

  // Therapies
  if (ctx.therapies.length > 0) {
    if (!priorities.includes("Recovery-optimized food selection"))
      priorities.push("Recovery-optimized food selection");
  }

  // Build summary label + detail
  const uniqueLabels = [...new Set(labels)];
  const detail = uniqueLabels.slice(0, 3).join(", ") + (uniqueLabels.length > 3 ? ` +${uniqueLabels.length - 3} more` : "");

  return {
    label: "Therapeutic Support",
    detail,
    priorities,
  };
}

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
      healthItems.push({ key, label: entry.label, priority: entry.priority });
      for (const p of entry.priorities) {
        if (!allPriorities.includes(p)) allPriorities.push(p);
      }
    }
  };

  for (const c of envelope.medicalHardLimits) checkCondition(c);
  for (const c of envelope.medicalOptimization) checkCondition(c);

  if (envelope.thyroidSupport) {
    const key = envelope.thyroidType ?? "thyroid-support";
    checkCondition(key);
    if (!seenHealthLabel.has("Thyroid Support") && !seenHealthLabel.has("Hashimoto's Support")) {
      checkCondition("thyroid-support");
    }
  }
  if (envelope.hormoneOptimization) checkCondition("hormone-optimization");

  // ── 2. Performance ────────────────────────────────────────────────────────
  let performanceSummary: { label: string; detail: string } | null = null;
  const overlayKey = envelope.performanceOverlay;
  if (overlayKey && overlayKey !== "standard") {
    const overlayLabel = PERFORMANCE_OVERLAY_LABELS[overlayKey] ?? overlayKey;
    let detail = "";
    const pCtx = extras.performanceContext;

    if (pCtx?.trainingType) {
      const typeLabels: Record<string, string> = {
        strength: "Strength Training", powerlifting: "Powerlifting", hypertrophy: "Hypertrophy",
        bodybuilding: "Bodybuilding", crossfit: "CrossFit", endurance_running: "Running",
        cycling: "Cycling", triathlon: "Triathlon", mma: "MMA", boxing: "Boxing",
        wrestling: "Wrestling", bjj: "BJJ", tactical: "Tactical", general_fitness: "General Fitness",
        swimming: "Swimming", basketball: "Basketball", soccer: "Soccer", other: pCtx.customSportName ?? "Custom Sport",
      };
      detail = typeLabels[pCtx.trainingType] ?? pCtx.trainingType;
    }

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

    // Deepen from performanceContext fields
    if (extras.performanceContext) {
      const pCtx = extras.performanceContext;
      const goalPriorities = PERF_GOAL_PRIORITIES[pCtx.primaryGoal ?? ""] ?? [];
      for (const p of goalPriorities) {
        if (!allPriorities.includes(p)) allPriorities.push(p);
      }
      const phasePriorities = PERF_PHASE_PRIORITIES[pCtx.trainingPhase ?? ""] ?? [];
      for (const p of phasePriorities) {
        if (!allPriorities.includes(p)) allPriorities.push(p);
      }
      const cardioPriorities = CARDIO_FOCUS_PRIORITIES[pCtx.cardioFocus ?? ""] ?? [];
      for (const p of cardioPriorities) {
        if (!allPriorities.includes(p)) allPriorities.push(p);
      }
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

  // ── 4. Therapeutic support ────────────────────────────────────────────────
  let therapeuticSummary: { label: string; detail: string } | null = null;
  if (envelope.therapeuticSupport && envelope.therapeuticSupportContext) {
    const result = buildTherapeuticSummary(envelope.therapeuticSupportContext);
    if (result) {
      therapeuticSummary = { label: result.label, detail: result.detail };
      for (const p of result.priorities) {
        if (!allPriorities.includes(p)) allPriorities.push(p);
      }
    }
  }

  // ── 5. Dietary identity ───────────────────────────────────────────────────
  const dietItems: string[] = [];
  for (const d of envelope.dietaryIdentity) {
    const label = DIET_LABEL_MAP[d.toLowerCase().trim()];
    if (label && !dietItems.includes(label)) dietItems.push(label);
  }

  // ── 6. Cuisine preference ─────────────────────────────────────────────────
  let cuisineLabel: string | null = null;
  if (envelope.cuisinePreference) {
    const key = envelope.cuisinePreference.toLowerCase().replace(/\s+/g, "_");
    cuisineLabel = CUISINE_LABEL_MAP[key] ?? (
      envelope.cuisinePreference.charAt(0).toUpperCase() + envelope.cuisinePreference.slice(1) + " Cuisine"
    );
  }

  // ── 7. Goal ───────────────────────────────────────────────────────────────
  let goalLabel: string | null = null;
  if (extras.goalType) {
    goalLabel = GOAL_LABELS[extras.goalType] ?? null;
    if (goalLabel) {
      const parts: string[] = [];
      if (extras.goalTarget) parts.push(extras.goalTarget);
      if (extras.goalTimelineWeeks) {
        const w = extras.goalTimelineWeeks;
        parts.push(`in ${w >= 52 ? "1 year" : w >= 26 ? "6 months" : `${w} weeks`}`);
      }
      if (parts.length > 0) goalLabel = `${goalLabel} · ${parts.join(" · ")}`;
    }
    const goalPriorities = GOAL_PRIORITIES[extras.goalType] ?? [];
    for (const p of goalPriorities) {
      if (!allPriorities.includes(p)) allPriorities.push(p);
    }
  } else if (extras.fitnessGoal) {
    goalLabel = FITNESS_GOAL_LABELS[extras.fitnessGoal] ?? extras.fitnessGoal;
  }

  // ── 8. Macros ─────────────────────────────────────────────────────────────
  const hasMacros =
    extras.dailyCalorieTarget ||
    extras.dailyProteinTarget ||
    extras.dailyCarbTarget ||
    extras.dailyFatTarget;

  const macros = hasMacros
    ? {
        calories:      extras.dailyCalorieTarget      ?? null,
        proteinG:      extras.dailyProteinTarget      ?? null,
        carbsG:        extras.dailyCarbTarget         ?? null,
        starchyCarbsG: extras.dailyStarchyCarbsTarget ?? null,
        fibrousCarbsG: extras.dailyFibrousCarbsTarget ?? null,
        fatG:          extras.dailyFatTarget          ?? null,
      }
    : null;

  // ── 8b. Alpha-gal protocol detail ────────────────────────────────────────
  const hasAlphaGalInHealthItems = healthItems.some(h =>
    h.key === "alpha-gal-syndrome" || h.key === "alpha-gal syndrome" || h.key === "alpha-gal"
  );
  const alphaGalDetail = hasAlphaGalInHealthItems && extras.alphaGalProfile
    ? {
        dairyTolerance: extras.alphaGalProfile.dairyTolerance,
        gelatinRestriction: extras.alphaGalProfile.gelatinRestriction,
        profileComplete: extras.alphaGalProfile.profileComplete,
      }
    : null;

  // ── 9. hasAnyActiveProtocol ───────────────────────────────────────────────
  const hasAnyActiveProtocol =
    healthItems.length > 0 ||
    !!performanceSummary ||
    !!pregnancySummary ||
    !!therapeuticSummary ||
    (dietItems.length > 0 && dietItems.some(d => ![""].includes(d)));

  // ── 9b. Carb Cycle Active ─────────────────────────────────────────────────
  const carbCycleActive = !!(
    extras.carbCycleState &&
    (extras.carbCycleState as any).phase &&
    (extras.carbCycleState as any).phase !== "inactive"
  );

  // ── 10. Composite explanation ─────────────────────────────────────────────
  const compositeExplanation = buildCompositeExplanation({
    healthItems,
    performanceSummary,
    pregnancySummary,
    therapeuticSummary,
    dietItems,
    goalLabel,
    nutritionPriorities: allPriorities,
    hasAnyActiveProtocol,
  });

  // ── 11. Nutrition Drivers (granular values for the expanded view) ─────────
  const therapeuticInputsForDrivers: Array<{ name: string; dose: string }> = [];
  if (envelope.therapeuticSupport && envelope.therapeuticSupportContext) {
    const ctx = envelope.therapeuticSupportContext as any;
    const allEntries = [
      ...(ctx.hormones ?? []),
      ...(ctx.peptides ?? []),
      ...(ctx.medications ?? []),
    ];
    for (const e of allEntries) {
      if (e && e.dose > 0) {
        therapeuticInputsForDrivers.push({
          name: resolveTherapeuticDisplayName(e.type ?? "", e.label),
          dose: `${e.dose} ${e.unit ?? ""}`.trim(),
        });
      }
    }
  }

  const liveMetricsForDrivers: Array<{ label: string; value: string }> = [];
  const hasDiabeticProtocol = healthItems.some(
    h => h.label.toLowerCase().includes("diabet") || h.label.toLowerCase().includes("blood sugar")
  );
  if (extras.latestGlucose != null && hasDiabeticProtocol) {
    liveMetricsForDrivers.push({ label: "Blood Glucose", value: `${extras.latestGlucose} mg/dL` });
  }
  if (performanceSummary && extras.performanceContext) {
    const pCtx = extras.performanceContext as any;
    if (pCtx.trainingPhase) {
      const phaseLabels: Record<string, string> = {
        off_season: "Off-Season", pre_season: "Pre-Season", in_season: "In-Season",
        peak: "Peak Training", weight_cut: "Weight Cut", recovery: "Recovery Phase",
      };
      liveMetricsForDrivers.push({ label: "Training Phase", value: phaseLabels[pCtx.trainingPhase] ?? pCtx.trainingPhase });
    }
    if (pCtx.trainingFrequency) {
      liveMetricsForDrivers.push({ label: "Training Frequency", value: `${pCtx.trainingFrequency}× / week` });
    }
  }
  if (pregnancySummary && envelope.pregnancySupportContext) {
    const pregCtx = envelope.pregnancySupportContext as any;
    if (pregCtx.weekOfPregnancy) {
      liveMetricsForDrivers.push({ label: "Pregnancy Week", value: `Week ${pregCtx.weekOfPregnancy}` });
    }
  }

  const nutritionDrivers =
    healthItems.length > 0 || therapeuticInputsForDrivers.length > 0 || liveMetricsForDrivers.length > 0
      ? { medicalConditions: healthItems, therapeuticInputs: therapeuticInputsForDrivers, liveMetrics: liveMetricsForDrivers }
      : null;

  const builderSlug = envelope.selectedMealBuilder || extras.selectedMealBuilder || extras.activeBoard || null;
  const mealBuilderLabel = builderSlug ? (BUILDER_LABEL_MAP[builderSlug] ?? null) : null;

  return {
    activeInputs: {
      health: healthItems,
      performance: performanceSummary,
      pregnancy: pregnancySummary,
      therapeutic: therapeuticSummary,
      cuisine: cuisineLabel,
      dietary: dietItems,
      goal: goalLabel,
      macros,
    },
    dietaryIdentity: dietItems,
    mealBuilderLabel,
    nutritionDrivers,
    nutritionPriorities: allPriorities.slice(0, 8),
    compositeExplanation,
    conflictPolicy: CONFLICT_POLICY,
    hasAnyActiveProtocol,
    carbCycleActive,
    alphaGal: alphaGalDetail,
    meta: { generatedAt },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THERAPEUTIC DISPLAY NAME RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

function resolveTherapeuticDisplayName(type: string, label?: string): string {
  if (label) return label;
  const map: Record<string, string> = {
    "testosterone-cypionate": "Testosterone Cypionate",
    "testosterone-enanthate": "Testosterone Enanthate",
    "testosterone-propionate": "Testosterone Propionate",
    "estradiol": "Estradiol",
    "estradiol-valerate": "Estradiol Valerate",
    "progesterone": "Progesterone",
    "hgh": "Growth Hormone (HGH)",
    "dhea": "DHEA",
    "thyroid-t3": "T3 (Liothyronine)",
    "thyroid-t4": "T4 (Levothyroxine)",
    "thyroid-t3-t4": "T3/T4 Combo",
    "bpc-157": "BPC-157",
    "tb-500": "TB-500",
    "sermorelin": "Sermorelin",
    "ipamorelin": "Ipamorelin / CJC-1295",
    "ghk-cu": "GHK-Cu",
    "pt-141": "PT-141",
    "nad+": "NAD+",
    "mk-677": "MK-677 (Ibutamoren)",
    "prednisone": "Prednisone",
    "metformin": "Metformin",
    "semaglutide": "Semaglutide",
    "tirzepatide": "Tirzepatide",
    "tamoxifen": "Tamoxifen",
    "anastrozole": "Anastrozole",
    "letrozole": "Letrozole",
    "clomid": "Clomiphene (Clomid)",
  };
  return map[type.toLowerCase()] ?? type.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE EXPLANATION BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildCompositeExplanation(args: {
  healthItems: NutritionSummaryHealthItem[];
  performanceSummary: { label: string; detail: string } | null;
  pregnancySummary: { label: string; detail: string } | null;
  therapeuticSummary: { label: string; detail: string } | null;
  dietItems: string[];
  goalLabel: string | null;
  nutritionPriorities: string[];
  hasAnyActiveProtocol: boolean;
}): string {
  const {
    healthItems, performanceSummary, pregnancySummary, therapeuticSummary,
    dietItems, goalLabel, nutritionPriorities, hasAnyActiveProtocol,
  } = args;

  if (!hasAnyActiveProtocol) {
    return "Your meals are personalized using your dietary preferences and macro targets. Every meal generated respects your active food choices and nutritional goals.";
  }

  const activeNames: string[] = [
    ...healthItems.map(h => h.label),
    ...(pregnancySummary ? [pregnancySummary.label] : []),
    ...(performanceSummary ? [performanceSummary.label + (performanceSummary.detail ? ` (${performanceSummary.detail})` : "")] : []),
    ...(therapeuticSummary ? [therapeuticSummary.label + (therapeuticSummary.detail ? ` (${therapeuticSummary.detail})` : "")] : []),
    ...(dietItems.length > 0 ? [`${dietItems.join(", ")} dietary rules`] : []),
    ...(goalLabel ? [`${goalLabel} goal`] : []),
  ];

  const nameStr = formatList(activeNames);
  const topPriorities = nutritionPriorities.slice(0, 6);
  const priorityStr = topPriorities.length > 0
    ? formatList(topPriorities.map(p => p.toLowerCase()))
    : "your active nutritional needs";

  const sentence = activeNames.length === 1
    ? `Because you have ${nameStr} active, your meals will prioritize ${priorityStr}.`
    : `Because you have ${nameStr} active simultaneously, your meals will prioritize ${priorityStr}.`;

  return `${sentence} ${CONFLICT_POLICY}`;
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const last = items[items.length - 1];
  const rest = items.slice(0, -1).join(", ");
  return `${rest}, and ${last}`;
}
