import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Dumbbell, Trophy, Zap, Settings,
  Loader2, ChevronRight, Target, RefreshCcw, CheckCircle2, Check, Copy,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { getResolvedTargets, setPerfSelectedDate } from "@/lib/macroResolver";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  computeDemandProfile,
  FUEL_DEMAND_LABELS,
  FUEL_DEMAND_COLORS,
  RECOVERY_DEMAND_LABELS,
  RECOVERY_DEMAND_COLORS,
  ADAPTATION_DEMAND_LABELS,
  TRAINING_LOAD_LABELS,
  TRAINING_LOAD_COLORS,
} from "@shared/performanceDemandEngine";

// ── Label maps ───────────────────────────────────────────────────────────────
const GOAL_LABELS: Record<string, string> = {
  fat_loss: "Fat Loss", muscle_gain: "Muscle Gain",
  maintenance: "Maintenance", performance: "Peak Performance",
};
const TYPE_LABELS: Record<string, string> = {
  strength: "Strength", hypertrophy: "Hypertrophy", powerlifting: "Powerlifting",
  olympic_lifting: "Olympic Lifting", mma: "MMA", boxing: "Boxing",
  wrestling: "Wrestling", bjj: "BJJ", crossfit: "CrossFit",
  endurance_running: "Running", cycling: "Cycling", triathlon: "Triathlon",
  tactical: "Tactical / Military", general_fitness: "General Fitness",
};
const PHASE_LABELS: Record<string, string> = {
  off_season: "Off Season", pre_season: "Pre-Season", in_season: "In Season",
  weight_cut: "Weight Cut", recovery: "Recovery",
};
const CARDIO_LABELS: Record<string, string> = {
  none: "No Cardio", recovery: "Recovery Cardio", zone_2: "Zone 2",
  tempo: "Tempo", threshold: "Threshold", hiit: "HIIT", mixed: "Mixed Zones",
};
const COMP_TYPE_LABELS: Record<string, string> = {
  bodybuilding_show: "Bodybuilding", mens_physique: "Men's Physique",
  classic_physique: "Classic Physique", figure: "Figure", bikini: "Bikini",
  wellness: "Wellness", powerlifting_meet: "Powerlifting Meet",
  strongman_competition: "Strongman", olympic_weightlifting_meet: "Olympic Weightlifting",
  fight_camp: "Fight Camp", wrestling_season: "Wrestling Season",
  crossfit_competition: "CrossFit Competition", hyrox: "Hyrox",
  marathon: "Marathon", triathlon_race: "Triathlon", spartan_race: "Spartan Race",
};

const SESSION_DURATION_LABELS: Record<string, string> = {
  under_30: "<30 min sessions",
  "30_60":  "30–60 min sessions",
  "60_90":  "60–90 min sessions",
  "90_plus":"90+ min sessions",
};
const RECOVERY_STATUS_LABELS: Record<string, string> = {
  good:    "Good Recovery",
  average: "Average Recovery",
  poor:    "Poor Recovery",
};
const ADAPTATION_TARGET_LABELS: Record<string, string> = {
  endurance:      "Endurance Adaptation",
  recovery:       "Recovery Adaptation",
  conditioning:   "Conditioning",
  work_capacity:  "Work Capacity",
  speed:          "Speed",
  power:          "Power",
  fat_loss:       "Fat Loss Adaptation",
  muscle_gain:    "Muscle Gain Adaptation",
};

const PERF_SESSION_LABELS: Record<string, string> = {
  strength:       "Strength",
  power:          "Power",
  endurance:      "Endurance",
  sport_practice: "Sport Practice",
  competition:    "Competition",
  recovery:       "Recovery",
  off:            "Rest Day",
};

const PERF_SESSION_WHY: Record<string, string[]> = {
  power: [
    "Higher carbohydrate intake is assigned today — explosive output relies heavily on muscle glycogen.",
    "Protein remains constant to maintain recovery and muscle protein synthesis.",
    "Fibrous vegetables stay unchanged — gut stability is critical on high-output days.",
  ],
  strength: [
    "Moderate carbohydrate support is active to fuel resistance training and drive post-session recovery.",
    "Protein remains consistent at your daily target to sustain muscle protein synthesis.",
    "Fat intake stays at baseline — hormonal support is maintained throughout the training phase.",
  ],
  endurance: [
    "Elevated carbohydrate availability is active — aerobic work steadily depletes muscle glycogen.",
    "Protein targets remain unchanged to support repair of endurance-trained muscle fibers.",
    "Anti-inflammatory food sources are prioritized to manage systemic training stress.",
  ],
  sport_practice: [
    "Moderate carbohydrate support matches the mixed-demand nature of sport practice.",
    "Protein stays at your daily target for consistent recovery signaling.",
    "Starchy carb timing around the session supports glycogen availability without over-fueling.",
  ],
  competition: [
    "Maximum carbohydrate availability is active — every meal is carb-anchored for peak glycolytic output.",
    "Protein remains at your performance baseline to support muscle integrity throughout competition.",
    "Fast-digesting carbohydrate sources are prioritized for rapid glycogen replenishment.",
  ],
  recovery: [
    "Carbohydrate targets are reduced — glycogen stores do not require full replacement on active recovery days.",
    "Protein stays consistent — muscle repair continues even when training volume drops.",
    "Anti-inflammatory foods are prioritized: omega-3s, colorful vegetables, and polyphenol-rich sources.",
  ],
  off: [
    "Caloric targets are slightly reduced — energy expenditure is lower on full rest days.",
    "Lean protein and fibrous vegetables are the priority — no large carbohydrate anchor is needed.",
    "Use this day to hydrate, sleep, and prepare your body for the next training block.",
  ],
};

const DOW_SCHED_KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;
const DOW_SHORT_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DOW_FULL_LABELS  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function getThisWeekDates() {
  const now = new Date();
  const todayDow = now.getDay();
  return DOW_SCHED_KEYS.map((day, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - todayDow + i);
    return {
      day,
      dateStr:  d.toISOString().split("T")[0],
      short:    DOW_SHORT_LABELS[i],
      full:     DOW_FULL_LABELS[i],
      isPast:   i < todayDow,
      isToday:  i === todayDow,
    };
  });
}

// ── Competition phase engine ─────────────────────────────────────────────────
function deriveCompPrepPhase(eventDate: string, competitionType: string): {
  weeksOut: number; phase: string; phaseLabel: string; phaseColor: string;
} {
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((event.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const weeksOut = Math.floor(days / 7);

  if (days < 0) return { weeksOut, phase: "post_competition", phaseLabel: "Post-Event Recovery", phaseColor: "blue" };
  if (days === 0) return { weeksOut, phase: "event_day", phaseLabel: "Event Day", phaseColor: "orange" };

  const isPhysique = ["bodybuilding_show", "mens_physique", "classic_physique", "figure", "bikini", "wellness"].includes(competitionType);
  if (isPhysique) {
    if (weeksOut <= 2) return { weeksOut, phase: "peak_week",    phaseLabel: "Peak Week",          phaseColor: "orange" };
    if (weeksOut <= 7) return { weeksOut, phase: "peak_prep",    phaseLabel: "Peak Prep",           phaseColor: "yellow" };
    if (weeksOut <= 15) return { weeksOut, phase: "conditioning", phaseLabel: "Conditioning Phase", phaseColor: "yellow" };
    return { weeksOut, phase: "fat_loss", phaseLabel: "Fat Loss Phase", phaseColor: "green" };
  }

  const isStrength = ["powerlifting_meet", "strongman_competition", "olympic_weightlifting_meet"].includes(competitionType);
  if (isStrength) {
    if (weeksOut <= 1) return { weeksOut, phase: "meet_week",       phaseLabel: "Meet Week",        phaseColor: "orange" };
    if (weeksOut <= 3) return { weeksOut, phase: "taper",           phaseLabel: "Taper Phase",       phaseColor: "yellow" };
    if (weeksOut <= 9) return { weeksOut, phase: "intensity_phase", phaseLabel: "Intensity Phase",   phaseColor: "yellow" };
    return { weeksOut, phase: "strength_building", phaseLabel: "Strength Building", phaseColor: "green" };
  }

  if (competitionType === "fight_camp") {
    if (weeksOut <= 1) return { weeksOut, phase: "fight_week",  phaseLabel: "Fight Week",       phaseColor: "red" };
    if (weeksOut <= 3) return { weeksOut, phase: "weight_cut",  phaseLabel: "Weight Cut",        phaseColor: "red" };
    if (weeksOut <= 11) return { weeksOut, phase: "fight_prep", phaseLabel: "Fight Prep",        phaseColor: "yellow" };
    return { weeksOut, phase: "conditioning_combat", phaseLabel: "Conditioning Camp", phaseColor: "green" };
  }

  if (competitionType === "wrestling_season") {
    if (weeksOut <= 1) return { weeksOut, phase: "championship_week", phaseLabel: "Championship Week", phaseColor: "orange" };
    if (weeksOut <= 7) return { weeksOut, phase: "in_season",         phaseLabel: "In-Season",          phaseColor: "yellow" };
    return { weeksOut, phase: "pre_season", phaseLabel: "Pre-Season", phaseColor: "green" };
  }

  const isFunctional = ["crossfit_competition", "hyrox"].includes(competitionType);
  if (isFunctional) {
    if (weeksOut <= 1) return { weeksOut, phase: "competition_week", phaseLabel: "Competition Week", phaseColor: "orange" };
    if (weeksOut <= 3) return { weeksOut, phase: "peak_prep",        phaseLabel: "Peak Prep",         phaseColor: "yellow" };
    if (weeksOut <= 7) return { weeksOut, phase: "event_prep",       phaseLabel: "Event Prep",         phaseColor: "yellow" };
    return { weeksOut, phase: "base_conditioning", phaseLabel: "Base Conditioning", phaseColor: "green" };
  }

  const isEndurance = ["marathon", "triathlon_race", "spartan_race"].includes(competitionType);
  if (isEndurance) {
    if (weeksOut <= 3) return { weeksOut, phase: "taper",       phaseLabel: "Taper Phase",              phaseColor: "orange" };
    if (weeksOut <= 7) return { weeksOut, phase: "race_prep",   phaseLabel: "Race Prep (Peak Training)", phaseColor: "yellow" };
    if (weeksOut <= 15) return { weeksOut, phase: "build_phase", phaseLabel: "Build Phase",              phaseColor: "yellow" };
    return { weeksOut, phase: "base_building", phaseLabel: "Base Building", phaseColor: "green" };
  }

  return { weeksOut, phase: "prep", phaseLabel: "Prep Phase", phaseColor: "green" };
}

// ── Sport-specific timeline phases ───────────────────────────────────────────
function getCompTimeline(competitionType: string, customSportGroup?: string): { phase: string; label: string }[] {
  const type = competitionType === "other" ? (customSportGroup ?? "") : competitionType;

  const physique = ["bodybuilding_show", "mens_physique", "classic_physique", "figure", "bikini", "wellness", "physique"];
  if (physique.some(p => type.includes(p))) return [
    { phase: "fat_loss",    label: "Fat Loss" },
    { phase: "conditioning", label: "Conditioning" },
    { phase: "peak_prep",   label: "Peak Prep" },
    { phase: "peak_week",   label: "Peak Week" },
  ];

  if (type.includes("fight_camp")) return [
    { phase: "conditioning_combat", label: "Camp" },
    { phase: "fight_prep",          label: "Fight Prep" },
    { phase: "weight_cut",          label: "Weight Cut" },
    { phase: "fight_week",          label: "Fight Week" },
  ];

  if (type.includes("wrestling_season")) return [
    { phase: "pre_season",        label: "Pre-Season" },
    { phase: "in_season",         label: "In-Season" },
    { phase: "championship_week", label: "Championship" },
  ];

  const strength = ["powerlifting_meet", "strongman_competition", "olympic_weightlifting_meet", "strength"];
  if (strength.some(s => type.includes(s))) return [
    { phase: "strength_building", label: "Building" },
    { phase: "intensity_phase",   label: "Intensity" },
    { phase: "taper",             label: "Taper" },
    { phase: "meet_week",         label: "Meet Week" },
  ];

  const functional = ["crossfit_competition", "hyrox", "functional", "mixed"];
  if (functional.some(f => type.includes(f))) return [
    { phase: "base_conditioning", label: "Base" },
    { phase: "event_prep",        label: "Event Prep" },
    { phase: "peak_prep",         label: "Peak Prep" },
    { phase: "competition_week",  label: "Comp Week" },
  ];

  const endurance = ["marathon", "triathlon_race", "spartan_race", "endurance"];
  if (endurance.some(e => type.includes(e))) return [
    { phase: "base_building", label: "Base" },
    { phase: "build_phase",   label: "Build" },
    { phase: "race_prep",     label: "Race Prep" },
    { phase: "taper",         label: "Taper" },
  ];

  return [
    { phase: "prep",      label: "Prep" },
    { phase: "peak_prep", label: "Peak Prep" },
    { phase: "peak_week", label: "Peak Week" },
  ];
}

// ── Nutrient priorities ──────────────────────────────────────────────────────
const NUTRIENT_PRIORITIES: Record<string, { label: string; items: string[] }> = {
  strength:          { label: "Strength Focus",    items: ["High protein (≥1.8g/kg)", "Moderate carbs", "Peri-workout carb timing", "Creatine-compatible foods"] },
  hypertrophy:       { label: "Hypertrophy Focus", items: ["High protein (≥2g/kg)", "High training volume carbs", "Leucine-rich sources", "Caloric surplus"] },
  powerlifting:      { label: "Powerlifting",      items: ["High protein", "CNS recovery nutrients", "Calorie-dense options", "Low-fiber pre-workout"] },
  olympic_lifting:   { label: "Olympic Lifting",   items: ["Explosive power fueling", "Fast-digesting carbs pre-session", "Joint-supportive foods", "Protein recovery"] },
  mma:               { label: "MMA / Combat",      items: ["Glycolytic + aerobic mix", "Weight class awareness", "High protein", "Electrolyte-rich foods"] },
  boxing:            { label: "Boxing",             items: ["Glycolytic fueling", "Hand speed recovery", "Lean protein", "Anti-inflammatory support"] },
  wrestling:         { label: "Wrestling",          items: ["Explosive strength fueling", "Lactate tolerance support", "Weight management foods", "Rapid recovery macros"] },
  bjj:               { label: "BJJ",                items: ["Aerobic endurance fueling", "Positional strength recovery", "Anti-inflammatory foods", "High protein"] },
  crossfit:          { label: "CrossFit",           items: ["Mixed modality carbs", "High protein recovery", "Zone 2–5 fuel coverage", "Gut-friendly pre-workout"] },
  endurance_running: { label: "Endurance Running", items: ["Glycogen priority", "Carb loading protocol", "Electrolytes & sodium", "Anti-inflammatory post-run"] },
  cycling:           { label: "Cycling",            items: ["Aerobic carb priority", "Glycogen storage", "Fat adaptation foods", "Recovery anti-inflammatories"] },
  triathlon:         { label: "Triathlon",          items: ["Three-sport carb needs", "Transition nutrition", "Gut-stable race fuel", "High protein recovery"] },
  tactical:          { label: "Tactical / Military",items: ["Load-bearing endurance fuel", "Stress-resilient nutrients", "Calorie-dense field-ready options", "Recovery protein"] },
  general_fitness:   { label: "General Fitness",   items: ["Balanced macros", "Whole food priority", "Consistent timing", "Anti-inflammatory baseline"] },
  other:             { label: "Sport-Specific Fueling", items: ["High protein for recovery (≥1.6g/kg)", "Training-load matched carb intake", "Anti-inflammatory food base", "Consistent meal timing around sessions"] },
};

// ── Deterministic meal influence text ────────────────────────────────────────
// Generates 2-4 plain-language sentences describing how the demand matrix
// translates into meal composition. No LLM involved — pure template logic.
function buildMealInfluenceText(demand: ReturnType<typeof computeDemandProfile>): string[] {
  const sentences: string[] = [];

  const fuelSentences: Record<string, string> = {
    low:         "Your low fuel demand means meals focus on lean protein and fibrous vegetables, with minimal starchy carbohydrates — this is a deficit or low-volume training phase.",
    moderate:    "Your moderate fuel demand means each meal includes a balanced complex carbohydrate source to sustain training energy without over-fueling.",
    glycogen:    "Your glycogen fuel demand means every meal is built around a meaningful complex carbohydrate source — high training volume requires substantial carbohydrate availability, with fast carbs prioritized after sessions.",
    competition: "Your competition-level fuel demand means maximum carbohydrate support across all meals — every dish is carb-anchored for peak glycolytic output and rapid glycogen replenishment.",
  };
  if (fuelSentences[demand.fuelDemand]) sentences.push(fuelSentences[demand.fuelDemand]);

  const recoverySentences: Record<string, string> = {
    moderate: "Anti-inflammatory ingredients are incorporated where possible — omega-3 sources, colorful vegetables, turmeric, and ginger — to support your training recovery.",
    high:     "Your high recovery demand means omega-3-rich proteins, antioxidant-dense vegetables, turmeric, ginger, and magnesium-rich foods are actively prioritized in every meal to support tissue repair.",
  };
  if (recoverySentences[demand.recoveryDemand]) sentences.push(recoverySentences[demand.recoveryDemand]);

  const adaptSentences: Record<string, string> = {
    endurance_focused:        "Aerobic fuels — oats, sweet potato, whole grains, healthy fats — are emphasized to support your endurance adaptation.",
    power_focused:            "Explosive output nutrients — lean red meat, zinc-rich foods, magnesium-rich leafy greens, and fast-digesting post-workout carbs — are emphasized for your power and speed adaptation.",
    recovery_focused:         "Repair-priority foods — omega-3s, antioxidants, magnesium-rich ingredients — are the backbone of meals designed for your recovery adaptation target.",
    body_composition_focused: "High protein per meal and strategic carbohydrate timing around training are the core levers for your body composition adaptation.",
  };
  if (adaptSentences[demand.adaptationDemand]) sentences.push(adaptSentences[demand.adaptationDemand]);

  const loadSentences: Record<string, string> = {
    elite: "Your elite training load means between-session nutrition is critical — easily digestible carb and protein options are suggested for rapid recovery between sessions.",
    high:  "Your high training load means adequate caloric density is maintained across meals so you can sustain output without relying on large, hard-to-digest portions.",
  };
  if (loadSentences[demand.trainingLoad]) sentences.push(loadSentences[demand.trainingLoad]);

  return sentences;
}

// ── Pro View: Medical protocol labels ────────────────────────────────────────
const CONDITION_PROTOCOL_LABELS: Record<string, { name: string; category: string; note: string }> = {
  "performance-nutrition": { name: "Performance Nutrition Layer", category: "Athletic", note: "Sport-specific fueling protocol, starch cycling, and demand matrix are active for this user." },
  "anti_inflammatory":     { name: "Anti-Inflammatory Protocol",  category: "Clinical", note: "Pro-inflammatory ingredients are reduced; omega-3s and polyphenols are actively prioritized." },
  "diabetic":              { name: "Diabetic Nutrition Protocol", category: "Clinical", note: "Glycemic index management active; starchy carb sources are controlled and distributed across meals." },
  "glp1":                  { name: "GLP-1 / Metabolic Protocol",  category: "Clinical", note: "Protein-first meal structure enforced; satiety-optimized portions; low glycemic anchoring." },
  "oncology_support":      { name: "Oncology Support Protocol",   category: "Clinical", note: "Hard-blocked ingredients enforced at prompt and post-generation. Physician-assigned; no treatment claims made." },
  "pregnancy-support":     { name: "Pregnancy Nutrition Protocol",category: "Clinical", note: "Trimester-aware nutrient targets; mercury, listeria, and raw food safety blocks active." },
  "hypothyroid":           { name: "Thyroid Support — Hypo",      category: "Clinical", note: "Iodine-supportive food base; goitrogen awareness; selenium and zinc prioritized." },
  "hyperthyroid":          { name: "Thyroid Support — Hyper",     category: "Clinical", note: "Iodine-limited food base; elevated caloric support for increased metabolic rate." },
  "hashimotos":            { name: "Hashimoto's Protocol",         category: "Clinical", note: "Autoimmune nutrition framework; gluten and dairy awareness; anti-inflammatory food base." },
  "heart_health":          { name: "Cardiovascular Protocol",     category: "Clinical", note: "Saturated fat management; fiber and omega-3 prioritization." },
};

// ── Pro View: Nutrition priority educational rationales ───────────────────────
const PRIORITY_RATIONALES: Record<string, string> = {
  "Recovery support":          "Tissue repair requires rapid amino acid availability post-session. Anti-inflammatory cofactors (omega-3s, antioxidants) blunt systemic inflammation and accelerate repair.",
  "Carbohydrate availability": "High-intensity glycolytic work depletes muscle glycogen. Carbohydrate availability is the rate-limiting variable for sustained output at high training frequencies.",
  "Protein distribution":      "Muscle protein synthesis is maximized when the leucine threshold (~2.5g/meal) is reached at each sitting — distribution across meals matters as much as daily total.",
  "Aerobic fuel utilization":  "Endurance adaptation requires fat-and-carbohydrate co-oxidation. Meal composition drives mitochondrial fuel substrate selection and fat-oxidation efficiency.",
  "Explosive power nutrients": "Creatine-compatible foods, zinc, magnesium, and fast-digesting post-workout carbs support neuromuscular output and phosphocreatine resynthesis.",
  "Fat oxidation priority":    "Caloric deficit combined with low-starch meals shifts primary fuel toward fat. Dietary fat sources are calibrated to support hormonal function in a sustained deficit.",
  "Lean muscle support":       "Anabolic signaling requires consistent leucine stimulus above threshold at each meal. Dense protein sources are prioritized to sustain a positive nitrogen balance.",
  "Anti-inflammatory nutrition":"Chronic training stress elevates IL-6 and CRP. Omega-3s, polyphenols, and antioxidant-dense vegetables blunt systemic inflammation and accelerate tissue repair.",
  "Carbohydrate timing":       "Peri-workout carbohydrate delivery (30–60 min pre and within 30 min post) maximizes glycogen resynthesis and blunts cortisol-driven catabolism.",
  "Hydration emphasis":        "High training load increases sweat sodium losses. Electrolyte-rich foods and hydration cues are embedded to preserve plasma volume and sustain aerobic power.",
};

// ── Pro View: Signal trace — which inputs drove each demand value ─────────────
function buildDemandSignalTrace(pCtx: any): {
  fuel: string[]; recovery: string[]; adaptation: string[]; load: string[];
} {
  const freqLabel: Record<string, string> = {
    "1-2": "1–2 sessions/wk", "3-4": "3–4 sessions/wk",
    "5-6": "5–6 sessions/wk", "7+":  "Daily training",
  };
  const durShort: Record<string, string> = {
    under_30: "<30 min", "30_60": "30–60 min", "60_90": "60–90 min", "90_plus": "90+ min",
  };

  const fuel: string[] = [];
  if (pCtx?.trainingFrequency) fuel.push(freqLabel[pCtx.trainingFrequency] ?? pCtx.trainingFrequency);
  if (pCtx?.cardioFocus && pCtx.cardioFocus !== "none") fuel.push(CARDIO_LABELS[pCtx.cardioFocus] ?? pCtx.cardioFocus);
  if (pCtx?.sessionDuration) fuel.push(durShort[pCtx.sessionDuration] ?? pCtx.sessionDuration);
  if (pCtx?.twoADays) fuel.push("2-a-Days");

  const recovery: string[] = [];
  if (pCtx?.trainingFrequency) recovery.push(freqLabel[pCtx.trainingFrequency] ?? pCtx.trainingFrequency);
  if (pCtx?.recoveryStatus) recovery.push(RECOVERY_STATUS_LABELS[pCtx.recoveryStatus] ?? pCtx.recoveryStatus);
  if (pCtx?.trainingPhase === "recovery") recovery.push("Recovery phase selected");
  if (pCtx?.twoADays) recovery.push("2-a-Days");
  if (pCtx?.sessionDuration) recovery.push(durShort[pCtx.sessionDuration] ?? pCtx.sessionDuration);

  const adaptation: string[] = [];
  if ((pCtx as any)?.adaptationTargets?.length) {
    for (const t of (pCtx as any).adaptationTargets as string[]) {
      adaptation.push(ADAPTATION_TARGET_LABELS[t]?.replace(" Adaptation","") ?? t);
    }
  } else if (pCtx?.adaptationTarget) {
    adaptation.push(ADAPTATION_TARGET_LABELS[pCtx.adaptationTarget]?.replace(" Adaptation","") ?? pCtx.adaptationTarget);
  }
  if (pCtx?.trainingType) adaptation.push(TYPE_LABELS[pCtx.trainingType] ?? pCtx.trainingType);
  if (pCtx?.primaryGoal) adaptation.push(GOAL_LABELS[pCtx.primaryGoal] ?? pCtx.primaryGoal);

  const load: string[] = [];
  if (pCtx?.trainingFrequency) load.push(freqLabel[pCtx.trainingFrequency] ?? pCtx.trainingFrequency);
  if (pCtx?.twoADays) load.push("2-a-Days");
  if (pCtx?.cardioFocus && pCtx.cardioFocus !== "none") load.push(CARDIO_LABELS[pCtx.cardioFocus] ?? pCtx.cardioFocus);
  if (pCtx?.sessionDuration) load.push(durShort[pCtx.sessionDuration] ?? pCtx.sessionDuration);

  return { fuel, recovery, adaptation, load };
}

// ── Pro View: AI meal logic categories activated by demand profile ─────────────
function buildMealLogicCategories(demand: ReturnType<typeof computeDemandProfile>): string[] {
  const cats: string[] = [];
  if (demand.fuelDemand === "glycogen" || demand.fuelDemand === "competition") cats.push("Carbohydrate timing emphasis");
  if (demand.fuelDemand === "low")      cats.push("Lean protein and vegetable anchoring");
  if (demand.fuelDemand === "moderate") cats.push("Balanced substrate distribution");
  if (demand.recoveryDemand === "high")     cats.push("Anti-inflammatory recovery ingredient activation");
  if (demand.recoveryDemand === "moderate") cats.push("Omega-3 and antioxidant incorporation");
  if (demand.adaptationDemand === "endurance_focused")        cats.push("Aerobic substrate optimization");
  if (demand.adaptationDemand === "power_focused")            cats.push("Explosive output nutrient activation");
  if (demand.adaptationDemand === "body_composition_focused") cats.push("High protein density per meal");
  if (demand.adaptationDemand === "recovery_focused")         cats.push("Repair-priority food selection");
  if (demand.trainingLoad === "elite") cats.push("Between-session rapid-recovery nutrition");
  if (demand.trainingLoad === "high" || demand.trainingLoad === "elite") cats.push("Caloric density management");
  return cats;
}

interface CarbCycleData {
  state: {
    phase: "inactive" | "low_carb" | "refeed";
    carbTargetG: number;
    fatTargetAdjustG: number;
    weightLog: Array<{ date: string; weight: number; carbsG: number }>;
    refeedStartWeightLb?: number | null;
    manualOverride?: boolean;
  };
  engine: {
    stallDetected: boolean;
    recommendation: string;
  };
}

type ActiveTab = "protocol" | "starch" | "protocols";

interface PerformanceHubSharedProps {
  /** When set, hub renders in shared/training-schedule mode for non-Performance builders */
  continueLabel?: string; // label for the launch/continue button (e.g. "Launch General Nutrition Builder")
  continueTo?: string;    // where the launch button navigates
  returnTo?: string;      // where the back button goes
  pageTitle?: string;     // overrides the header title
}

export default function TrainingNutritionHub({ continueTo, returnTo, pageTitle, continueLabel }: PerformanceHubSharedProps = {}) {
  usePageTitle(pageTitle ?? "Performance Hub");
  const [, setLocation] = useLocation();
  // Shared-mode helpers — derived once, used throughout
  const setupPath = continueTo
    ? `/performance/setup?returnTo=${encodeURIComponent(window.location.pathname)}`
    : "/performance/setup";
  const builderPath = continueTo ?? "/beach-body-meal-board";
  const backPath = returnTo ?? "/";
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const param = new URLSearchParams(window.location.search).get("tab");
    if (param === "starch" || param === "protocols" || param === "protocol") return param as ActiveTab;
    return "protocol";
  });
  // Pro View toggle — gated to procare / care_team / isAdmin
  // Only restore persisted "pro" from localStorage if user is still entitled;
  // otherwise force "user" and clear the stale key.
  const [viewMode, setViewMode] = useState<"user" | "pro">("user");

  // Starch / carb cycle state
  const [carbCycleData, setCarbCycleData] = useState<CarbCycleData | null>(null);
  const [carbCycleLoading, setCarbCycleLoading] = useState(false);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  // Check-in state
  const [checkInWeight, setCheckInWeight] = useState("");
  const [checkInStarch, setCheckInStarch] = useState("");
  const [checkInEnergy, setCheckInEnergy] = useState<"low" | "moderate" | "high" | "">("");
  const [checkInStrength, setCheckInStrength] = useState<"declining" | "holding" | "increasing" | "">("");
  const [checkInResult, setCheckInResult] = useState<string | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);

  // Date-aware coaching plan — selectedDate drives which day's plan is shown
  const todayDateStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);
  const isViewingToday = selectedDate === todayDateStr;

  // Today's adaptive session — fetched from /api/performance/today when schedule is set
  const [todaySession, setTodaySession] = useState<{
    sessionType: string; sessionLabel: string; trainingPhase: string;
    calories: number; proteinG: number; carbsG: number; fatG: number;
    starchyCarbsG: number; fibrousCarbsG: number;
    description: string;
    logged: { calories: number; proteinG: number; carbsG: number; fatG: number; starchyCarbsG: number; fibrousCarbsG: number };
    dailyState?: {
      starchPolicy: string;
      ledgerReliability: string;
      starchyBudgetExhausted: boolean;
      starchyCarbsRemainingG: number;
      scheduleConfigured: boolean;
    } | null;
  } | null>(null);

  const [macroCalcRequired, setMacroCalcRequired] = useState(false);
  const [protocolCopied, setProtocolCopied] = useState(false);

  // ── Clinical paywall ─────────────────────────────────────────────────────
  const entitlements: string[] = (user as any)?.entitlements || [];
  const hasPerformanceAccess =
    entitlements.includes("performance_nutrition") || entitlements.includes("FULL_ACCESS");

  // Pro View eligibility: procare professionals, care team members, or admins
  const canSeeProView =
    entitlements.includes("procare") ||
    entitlements.includes("care_team") ||
    !!(user as any)?.isAdmin;

  // Restore persisted viewMode from localStorage only when the user is entitled.
  // If they are not (or have lost) the entitlement, force "user" and clear the key
  // so a manual localStorage edit cannot bypass the Pro View gate.
  useEffect(() => {
    if (canSeeProView) {
      const stored = localStorage.getItem("mpm.perfHub.viewMode") as "user" | "pro" | null;
      if (stored === "pro") setViewMode("pro");
    } else {
      setViewMode("user");
      localStorage.removeItem("mpm.perfHub.viewMode");
    }
  }, [canSeeProView]);

  // Derived: only show Pro content when the user is actively entitled AND has selected Pro.
  // This is the single source of truth for gating all Pro-only sections.
  const isProView = canSeeProView && viewMode === "pro";

  const pCtx = (user as any)?.performanceContext;
  const compCtx = (user as any)?.competitionPrepContext;
  const activeTrack: "athletic" | "competition" | null =
    (user as any)?.activeProtocolTrack ?? (pCtx ? "athletic" : null);

  const isActive = !!activeTrack;

  const resolvedTargets = getResolvedTargets(String((user as any)?.id ?? ""));

  useEffect(() => {
    if (!isActive || activeTrack !== "athletic") return;
    const hasSchedule = !!(user as any)?.weeklyTrainingSchedule;
    if (!hasSchedule) return;
    const dateQs = selectedDate !== todayDateStr ? `?date=${selectedDate}` : "";
    fetch(apiUrl(`/api/performance/today${dateQs}`), { headers: getAuthHeaders(), credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.macroCalculatorRequired) {
          setMacroCalcRequired(true);
        } else if (d?.configured) {
          setMacroCalcRequired(false);
          setTodaySession(d);
        }
      })
      .catch(() => {});
  }, [isActive, activeTrack, user, selectedDate]);

  useEffect(() => {
    if (!isActive) return;
    async function fetchCarbCycle() {
      setCarbCycleLoading(true);
      try {
        const res = await fetch(apiUrl("/api/performance/carb-cycle"), {
          headers: getAuthHeaders(),
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setCarbCycleData(data);
        }
      } catch { /* non-blocking */ } finally {
        setCarbCycleLoading(false);
      }
    }
    fetchCarbCycle();
  }, [isActive]);

  async function handleRefeedToggle(action: "start_refeed" | "end_refeed") {
    setOverrideSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/performance/carb-cycle/override"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Override failed");
      const data = await res.json();
      setCarbCycleData({ state: data.state, engine: data.engine });
      queryClient.invalidateQueries({ queryKey: ["carbCycleDashboard"] });
      sessionStorage.removeItem("mpm.carbCyclePickerState");
      toast({
        title: action === "start_refeed" ? "Refeed day started" : "Low-carb phase resumed",
        description: action === "start_refeed"
          ? `Starch allocation raised to ${data.state.carbTargetG}g today.`
          : `Starch allocation reset to ${data.state.carbTargetG}g.`,
      });
    } catch {
      toast({ title: "Could not update phase", variant: "destructive" });
    } finally {
      setOverrideSubmitting(false);
    }
  }

  // ── Deterministic protocol table (no LLM) ───────────────────────────────
  function computeProtocolDirective(
    todayWeight: number,
    updatedLog: Array<{ date: string; weight: number; carbsG: number }>,
    energy: "low" | "moderate" | "high",
    strength: "declining" | "holding" | "increasing",
    carbTargetG: number,
    phase: string,
    refeedStartWeightLb?: number | null,
  ): string {
    // Sort descending — most recent first
    const sorted = [...updatedLog].sort((a, b) => b.date.localeCompare(a.date));
    const prevWeight = sorted.length > 1 ? sorted[1].weight : null;

    // Scale direction (0.4 lb threshold to filter noise)
    const diff = prevWeight !== null ? todayWeight - prevWeight : 0;
    const scaleDir: "down" | "flat" | "up" =
      prevWeight === null ? "flat" :
      diff <= -0.4 ? "down" :
      diff >=  0.4 ? "up"   : "flat";

    // Consecutive stall days from the log
    let stallDays = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (Math.abs(sorted[i].weight - sorted[i + 1].weight) < 0.4) stallDays++;
      else break;
    }

    const refeedTarget = carbTargetG > 0 ? Math.round(carbTargetG * 1.8) : 0;
    const starchLine   = carbTargetG > 0 ? `${carbTargetG}g starch` : "current starch allocation";

    // ── Priority 1: Post-refeed water retention ──────────────────────────
    if (phase === "low_carb" && refeedStartWeightLb != null && scaleDir === "up" && diff <= 3.5) {
      return `Action: Return to low-carb phase.\nExpected: +1–3 lbs from refeed is normal water retention — resolves in 48–72h. Maintain ${starchLine}.`;
    }

    // ── Priority 2: Stall confirmed (7+ days) ───────────────────────────
    if (stallDays >= 7) {
      const rft = refeedTarget > 0 ? `${refeedTarget}g` : "1.8× baseline";
      return `Action: Increase starch to ${rft} for 1–2 days, then return to ${starchLine} baseline.\nExpected: +1–3 lbs (water) — resolves in 48–72h, followed by accelerated loss.`;
    }

    // ── Priority 3: Approaching stall (4–6 days) ────────────────────────
    if (stallDays >= 4) {
      return `Action: Maintain current protocol — day ${stallDays + 1} of flat scale.\nNote: Refeed triggers at day 7 if stall continues. Hold ${starchLine}.`;
    }

    // ── Scale DOWN ───────────────────────────────────────────────────────
    if (scaleDir === "down") {
      if (energy === "low" && strength === "declining") {
        return `Action: Reduce deficit — cut cardio by one session this week or add 50–75 kcal via protein.\nNote: Scale moving correctly but recovery signals are under stress. Maintain ${starchLine}.`;
      }
      // All other combinations: on track
      return `Action: Maintain current protocol.\nExpected: Scale responding correctly. Continue ${starchLine}.`;
    }

    // ── Scale FLAT (< 4 days) ────────────────────────────────────────────
    if (scaleDir === "flat") {
      if (energy === "low" && strength === "declining") {
        return `Action: Increase protein intake today — target one additional lean protein source.\nNote: Hold ${starchLine} and reassess in 72h before any starch adjustment.`;
      }
      if (energy === "high" && strength === "increasing") {
        return `Action: Maintain current protocol.\nNote: Performance adapting well. Scale holding is normal in early phases — ${starchLine} is appropriate.`;
      }
      return `Action: Maintain current protocol.\nNote: Day ${stallDays + 1} of flat scale. Continue logging daily. ${starchLine}.`;
    }

    // ── Scale UP ────────────────────────────────────────────────────────
    if (energy === "high" && strength === "increasing") {
      return `Action: Hold protocol — do not adjust starch.\nNote: Scale up +${diff.toFixed(1)} lbs but all performance indicators are positive. Likely glycogen or muscle. Reassess over 2 weeks. ${starchLine}.`;
    }
    if (energy === "low" && strength === "declining") {
      return `Action: Audit food sources and total daily intake — recalculate baseline.\nNote: Scale up +${diff.toFixed(1)} lbs with declining performance signals. Compliance or intake tracking issue. Hold ${starchLine} until root cause is identified.`;
    }
    return `Action: Hold protocol and log daily this week.\nNote: Scale up +${diff.toFixed(1)} lbs — investigate adherence. Maintain ${starchLine}.`;
  }

  async function evaluateProtocol() {
    if (!checkInWeight || !checkInEnergy || !checkInStrength) {
      toast({ title: "Enter all check-in values", description: "Weight, energy, and strength are required.", variant: "destructive" });
      return;
    }
    setCheckInLoading(true);
    try {
      const weightVal = parseFloat(checkInWeight);
      if (isNaN(weightVal) || weightVal <= 0) {
        toast({ title: "Invalid weight", variant: "destructive" });
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const carbTargetG = carbCycleData?.state.carbTargetG ?? 0;
      const starchVal = checkInStarch ? parseFloat(checkInStarch) : (carbTargetG || 0);

      // 1. Log weight → get updated state with refreshed weightLog
      let updatedState = carbCycleData?.state;
      let updatedEngine = carbCycleData?.engine;
      try {
        const logRes = await fetch(apiUrl("/api/performance/carb-cycle/log"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({ date: today, weight: weightVal, carbsG: starchVal }),
        });
        if (logRes.ok) {
          const logData = await logRes.json();
          if (logData?.state) {
            updatedState = logData.state;
            updatedEngine = logData.engine;
            setCarbCycleData({ state: logData.state, engine: logData.engine });
            sessionStorage.removeItem("mpm.carbCyclePickerState");
          }
        }
      } catch { /* non-blocking — still run protocol table */ }

      // 2. Deterministic protocol table — zero LLM involvement
      const weightLog = updatedState?.weightLog ?? [];
      const directive = computeProtocolDirective(
        weightVal,
        weightLog,
        checkInEnergy as "low" | "moderate" | "high",
        checkInStrength as "declining" | "holding" | "increasing",
        updatedState?.carbTargetG ?? 0,
        updatedState?.phase ?? "inactive",
        updatedState?.refeedStartWeightLb,
      );

      setCheckInResult(directive);
    } catch {
      toast({ title: "Evaluation failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setCheckInLoading(false);
    }
  }

  const compPhase = compCtx?.eventDate ? deriveCompPrepPhase(compCtx.eventDate, compCtx.competitionType) : null;
  const demandProfile = computeDemandProfile(pCtx ?? undefined);

  const phaseColorMap: Record<string, string> = {
    green:  "bg-green-950/40 border-green-500/30 text-green-300",
    yellow: "bg-yellow-950/40 border-yellow-500/30 text-yellow-300",
    orange: "bg-orange-950/40 border-orange-500/30 text-orange-300",
    blue:   "bg-blue-950/40 border-blue-500/30 text-blue-300",
    red:    "bg-red-950/40 border-red-500/30 text-red-300",
  };

  // Tab labels differ by track
  const tabLabel = (tab: ActiveTab): string => {
    if (tab === "protocol") return activeTrack === "competition" ? "Meal Builder" : "Nutrient Plan";
    if (tab === "starch") return "Carbohydrates";
    return "Protocols";
  };

  // ── Clinical paywall gate ─────────────────────────────────────────────────
  if (!hasPerformanceAccess && !continueTo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white pb-20">
        {!isDesktop && (
          <div
            className="sticky top-0 z-10 bg-black/60 backdrop-blur-md border-b border-white/10 px-4 pb-3 flex items-center gap-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
          >
            <button
              onClick={() => setLocation(backPath)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
            <p className="text-white font-bold text-base leading-none">Performance Hub</p>
          </div>
        )}
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
            <span className="text-4xl">⚡</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Performance Nutrition Hub</h2>
            <p className="text-white/60 text-sm max-w-xs leading-relaxed">
              Sport-specific fueling protocols, starch cycling, competition prep, and performance check-ins.
            </p>
          </div>
          <div className="bg-orange-950/40 border border-orange-500/30 rounded-2xl px-5 py-4 max-w-xs w-full space-y-3">
            <p className="text-orange-300 font-semibold text-sm">Clinical Plan Required</p>
            <ul className="text-white/70 text-xs text-left space-y-1.5">
              <li>✓ Athletic &amp; competition prep protocols</li>
              <li>✓ Starch cycling with protocol tracking</li>
              <li>✓ Weekly check-in with protocol directives</li>
              <li>✓ Sport-specific nutrient priorities</li>
              <li>✓ Performance Nutrition Builder</li>
            </ul>
          </div>
          <button
            onClick={() => setLocation("/pricing")}
            className="bg-orange-600 text-white font-semibold rounded-xl px-8 py-3 text-sm w-full max-w-xs"
          >
            View Clinical Plan
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-32"
    >
      {/* Header — mobile only; DesktopHeader shows the title on desktop */}
      {!isDesktop && (
        <div
          className="sticky top-0 z-10 bg-black/60 backdrop-blur-md border-b border-white/10 px-4 pb-3 flex items-center gap-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <button
            onClick={() => setLocation(backPath)}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="flex-1">
            <p className="text-white font-bold text-base leading-none">{pageTitle ?? "Performance Hub"}</p>
            <p className="text-orange-300 text-xs mt-0.5">
              {continueTo ? "Training schedule & daily macro adjustments" : activeTrack === "competition" ? "Competition prep protocol" : "Sport-specific nutrition protocol"}
            </p>
          </div>
          <button
            onClick={() => setLocation(setupPath)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-300 text-xs font-semibold"
          >
            <Settings className="w-3.5 h-3.5" />
            {isActive ? "Update" : "Setup"}
          </button>
        </div>
      )}

      {/* ── Macro Calculator gate — shown when targets are missing ── */}
      {macroCalcRequired && (
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <div className="rounded-2xl bg-orange-600/15 border border-orange-500/30 px-5 py-5">
            <p className="text-white font-bold text-base mb-1">Macro Calculator Required</p>
            <p className="text-white/75 text-sm leading-relaxed mb-4">
              Your performance targets and coaching are personalized from your Macro Calculator results.
              Complete it first to unlock your daily targets, weekly schedule, and AI coaching.
            </p>
            <button
              onClick={() => setLocation("/macro-calculator")}
              className="w-full bg-orange-600 text-white font-semibold text-sm py-3 rounded-xl active:scale-[0.98] transition-transform"
            >
              Run My Macro Calculator
            </button>
          </div>
        </div>
      )}

      {/* ── No protocol — track selector empty state ── */}
      {!isActive && !macroCalcRequired && (
        <div className="px-4 pt-10 max-w-lg mx-auto">
          <div className="text-center mb-8">
            <p className="text-white font-bold text-xl mb-2">{pageTitle ?? "Performance Nutrition Hub"}</p>
            <p className="text-white/80 text-sm leading-relaxed">
              {continueTo
                ? "Set up your weekly training schedule to automatically adjust your daily macro targets."
                : "Two separate protocol engines. Choose the one that matches your goal."}
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setLocation(setupPath)}
              className="w-full text-left px-4 py-4 rounded-2xl bg-black/50 border border-white/10 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <Dumbbell className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">Athletic Performance</p>
                  <p className="text-white/70 text-xs mt-0.5">MMA, boxing, CrossFit, endurance, tactical, strength sports</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/60 mt-1 flex-shrink-0" />
              </div>
            </button>
            <button
              onClick={() => setLocation(setupPath)}
              className="w-full text-left px-4 py-4 rounded-2xl bg-black/50 border border-white/10 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">Competition Prep</p>
                  <p className="text-white/70 text-xs mt-0.5">Bodybuilding, physique, powerlifting, fight camp — calendar-driven</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/60 mt-1 flex-shrink-0" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Desktop: Update Setup button (restored — was hidden by isDesktop header guard) ── */}
      {isDesktop && isActive && (
        <div className="px-4 pt-4 max-w-xl mx-auto flex justify-end">
          <button
            onClick={() => setLocation(setupPath)}
            className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold overflow-hidden group"
            style={{ background: "linear-gradient(135deg, #ea580c, #f97316, #fb923c, #ea580c)", backgroundSize: "300% 300%", animation: "gradientShift 3s ease infinite" }}
          >
            {/* Animated glow ring */}
            <span className="absolute inset-0 rounded-xl opacity-60 blur-sm group-hover:opacity-90 transition-opacity duration-300" style={{ background: "linear-gradient(135deg, #ea580c, #f97316)", animation: "pulse 2s ease-in-out infinite" }} />
            {/* Shimmer sweep */}
            <span className="absolute inset-0 rounded-xl overflow-hidden">
              <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
            </span>
            <Settings className="relative w-4 h-4 drop-shadow" />
            <span className="relative drop-shadow">Update Setup</span>
          </button>
          <style>{`
            @keyframes gradientShift {
              0%   { background-position: 0% 50%; }
              50%  { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
          `}</style>
        </div>
      )}

      {/* ── Active: Competition Prep ── */}
      {isActive && activeTrack === "competition" && compCtx && (
        <div className="px-4 pt-4 max-w-xl mx-auto space-y-4">

          {/* ── Quick Launch ── */}
          <button
            onClick={() => setLocation(builderPath)}
            className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-orange-600/20 border border-orange-500/30 text-white"
          >
            <div className="text-left">
              <p className="font-bold text-sm">{continueLabel ?? (continueTo ? "Continue to Builder" : "Launch Performance Nutrition Builder")}</p>
              <p className="text-white/80 text-xs mt-0.5">Build meals calibrated for your prep phase</p>
            </div>
            <ChevronRight className="w-5 h-5 text-orange-400 flex-shrink-0" />
          </button>

          {/* Event countdown card */}
          <div className="rounded-2xl bg-black/50 border border-orange-500/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <p className="text-xs text-orange-300 font-semibold">Competition Prep Active</p>
            </div>

            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-white font-bold text-2xl leading-none">
                  {compCtx.competitionType === "other"
                    ? (compCtx.customSportName ?? "Custom Sport")
                    : (COMP_TYPE_LABELS[compCtx.competitionType] ?? compCtx.competitionType)}
                </p>
                {compCtx.division && (
                  <p className="text-orange-300 text-sm font-medium mt-0.5">{compCtx.division}</p>
                )}
              </div>
              {compPhase && (
                <div className="text-right flex-shrink-0">
                  <p className="text-white font-bold text-3xl leading-none">
                    {compPhase.weeksOut < 0 ? "✓" : compPhase.weeksOut}
                  </p>
                  <p className="text-white/70 text-xs mt-0.5">
                    {compPhase.weeksOut < 0 ? "complete" : compPhase.weeksOut === 0 ? "show day" : "weeks out"}
                  </p>
                </div>
              )}
            </div>

            {/* Current phase */}
            {compPhase && (
              <div className={`rounded-xl border px-3 py-2 mb-3 ${phaseColorMap[compPhase.phaseColor] ?? phaseColorMap.orange}`}>
                <p className="text-xs font-bold">Current Phase: {compPhase.phaseLabel}</p>
              </div>
            )}

            {/* Event date + weights */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-xl px-3 py-2">
                <p className="text-white/70 text-xs">Event Date</p>
                <p className="text-white font-semibold text-sm mt-0.5">
                  {new Date(compCtx.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              {compCtx.currentWeight && (
                <div className="bg-white/5 rounded-xl px-3 py-2">
                  <p className="text-white/70 text-xs">Current Weight</p>
                  <p className="text-white font-semibold text-sm mt-0.5">{compCtx.currentWeight}</p>
                </div>
              )}
              {compCtx.targetWeight && (
                <div className="bg-white/5 rounded-xl px-3 py-2">
                  <p className="text-white/70 text-xs">Target</p>
                  <p className="text-white font-semibold text-sm mt-0.5">{compCtx.targetWeight}</p>
                </div>
              )}
            </div>

            {/* Sport-specific timeline */}
            {compPhase && compPhase.weeksOut > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                {(() => {
                  const tl = getCompTimeline(compCtx.competitionType, compCtx.customSportGroup);
                  const currentIdx = tl.findIndex(t => t.phase === compPhase.phase);
                  const nextPhase = currentIdx >= 0 && currentIdx < tl.length - 1 ? tl[currentIdx + 1] : null;
                  return (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-white/70 text-xs">Protocol Timeline</p>
                        {nextPhase && (
                          <p className="text-white/60 text-xs">Next: <span className="text-white/80 font-medium">{nextPhase.label}</span></p>
                        )}
                      </div>
                      <div className="flex gap-1 mb-2">
                        {tl.map(({ phase: ph, label }, i) => {
                          const isCurrent = ph === compPhase.phase;
                          const isPast = currentIdx > i;
                          return (
                            <div key={ph} className="flex-1 text-center">
                              <div className={`h-2 rounded-full mb-1.5 transition-all ${isCurrent ? "bg-orange-400" : isPast ? "bg-orange-400/40" : "bg-white/10"}`} />
                              <p className={`leading-tight ${isCurrent ? "text-orange-300 font-semibold" : "text-white/60"}`} style={{ fontSize: "9px" }}>
                                {label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                        <p className="text-orange-300 text-xs font-semibold">{compPhase.phaseLabel}</p>
                        <span className="text-white/70 text-xs">— {compPhase.weeksOut} wks out</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Tabs — Starch and Protocols hidden in shared/training-schedule mode */}
          {!continueTo && (
            <div className="flex bg-black/30 rounded-xl p-1 gap-1">
              {(["protocol", "starch", "protocols"] as ActiveTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === tab ? "bg-orange-600 text-white" : "text-white/40"
                  }`}
                >
                  {tabLabel(tab)}
                </button>
              ))}
            </div>
          )}

          {!continueTo && activeTab === "starch"    && renderStarchTab()}
          {!continueTo && activeTab === "protocols" && renderProtocolsTab()}

          {(continueTo || activeTab === "protocol") && (
            <div className="space-y-4">
              {compPhase?.phase === "fat_loss" && (
                <div className="rounded-2xl bg-black/50 border border-white/10 p-4">
                  <p className="text-white font-bold text-sm mb-2">Fat Loss Phase — Protocol</p>
                  <div className="space-y-2">
                    {["Moderate caloric deficit (300–500 cal/day)", "High protein to preserve lean mass (≥1.8g/kg)", "Resistance training maintained — do not reduce volume", "Cardio gradually increasing toward conditioning phase", "Track weekly weight averages — not daily fluctuations"].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                        <p className="text-white/70 text-sm">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {compPhase?.phase === "conditioning" && (
                <div className="rounded-2xl bg-black/50 border border-white/10 p-4">
                  <p className="text-white font-bold text-sm mb-2">Conditioning Phase — Protocol</p>
                  <div className="space-y-2">
                    {["Calories tightening — precision matters now", "Carb cycling may begin based on training load", "Posing practice adds to calorie expenditure", "Cardio increasing — monitor fatigue and recovery", "Continue high protein — muscle preservation critical"].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                        <p className="text-white/70 text-sm">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {compPhase?.phase === "peak_week" && (
                <div className="rounded-2xl bg-orange-950/40 border border-orange-500/30 p-4">
                  <p className="text-orange-300 font-bold text-sm mb-2">⚡ Peak Week</p>
                  <div className="space-y-2">
                    {["Water manipulation protocol begins", "Carb loading strategy based on competition type", "Sodium management for muscle fullness", "Reduce fiber — prioritize easily digestible foods", "Training volume significantly reduced"].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                        <p className="text-white/70 text-sm">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {compPhase?.phase === "post_competition" && (
                <div className="rounded-2xl bg-blue-950/40 border border-blue-500/30 p-4">
                  <p className="text-blue-300 font-bold text-sm mb-2">Post-Competition Recovery</p>
                  <div className="space-y-2">
                    {["Reverse diet — increase calories slowly (50–100 cal/week)", "Do not binge immediately — metabolic recovery takes time", "Prioritize sleep and nutrient-dense whole foods", "Reduce cardio — allow CNS recovery", "Set new goals and establish your next protocol"].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                        <p className="text-white/70 text-sm">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily Macro Targets */}
              <div className="space-y-1.5">
                <p className="text-white text-[11px] font-semibold uppercase tracking-wider">Today's Targets</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { label: "Calories", value: resolvedTargets.calories > 0 ? Math.round(resolvedTargets.calories).toLocaleString() : "—", unit: "kcal" },
                    { label: "Protein",  value: resolvedTargets.protein_g > 0 ? Math.round(resolvedTargets.protein_g) : "—",               unit: "g" },
                    { label: "Starchy",  value: resolvedTargets.starchy_carbs_g > 0 ? Math.round(resolvedTargets.starchy_carbs_g) : resolvedTargets.carbs_g > 0 ? Math.round(resolvedTargets.carbs_g * 0.7) : "—", unit: "g" },
                    { label: "Fibrous",  value: resolvedTargets.fibrous_carbs_g > 0 ? Math.round(resolvedTargets.fibrous_carbs_g) : resolvedTargets.carbs_g > 0 ? Math.round(resolvedTargets.carbs_g * 0.3) : "—", unit: "g" },
                    { label: "Fat",      value: resolvedTargets.fat_g > 0 ? Math.round(resolvedTargets.fat_g) : "—",                       unit: "g" },
                  ].map(m => (
                    <div key={m.label} className="bg-white/10 rounded-xl px-1.5 py-2.5 text-center">
                      <p className="text-white font-bold text-sm leading-none">{m.value}</p>
                      <p className="text-white/70 text-[10px] mt-0.5">{m.unit}</p>
                      <p className="text-white/70 text-[9px] mt-0.5 uppercase tracking-wide">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setLocation(builderPath)}
                className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-orange-600/20 border border-orange-500/30 text-white"
              >
                <div className="text-left">
                  <p className="font-bold text-sm">{continueLabel ?? (continueTo ? "Continue to Builder" : "Launch Performance Nutrition Builder")}</p>
                  <p className="text-white/80 text-xs mt-0.5">Build meals calibrated for your prep phase</p>
                </div>
                <ChevronRight className="w-5 h-5 text-orange-400 flex-shrink-0" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Active: Athletic Performance ── */}
      {isActive && activeTrack === "athletic" && pCtx && (
        <div className="px-4 pt-4 max-w-xl mx-auto space-y-4">

          {/* ── Quick Launch ── */}
          <button
            onClick={() => setLocation(builderPath)}
            className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-orange-600/20 border border-orange-500/30 text-white"
          >
            <div className="text-left">
              <p className="font-bold text-sm">{continueLabel ?? (continueTo ? "Continue to Builder" : "Launch Performance Nutrition Builder")}</p>
              <p className="text-white/80 text-xs mt-0.5">Build meals calibrated for your training phase</p>
            </div>
            <ChevronRight className="w-5 h-5 text-orange-400 flex-shrink-0" />
          </button>

          {/* ── Weekly Coaching Schedule card ── */}
          {(() => {
            const sched = (user as any)?.weeklyTrainingSchedule;
            if (!sched) return null;
            const weekDates = getThisWeekDates();
            return (
              <div className="rounded-2xl bg-black/50 border border-orange-500/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    <p className="text-xs text-orange-300 font-semibold uppercase tracking-wider">Weekly Coaching Schedule</p>
                  </div>
                  <button
                    onClick={() => setLocation(setupPath)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-white/70 text-xs font-medium"
                  >
                    <Settings className="w-3 h-3" />
                    Edit Schedule
                  </button>
                </div>

                <div className="space-y-1.5">
                  {weekDates.map(({ day, dateStr, short, full, isPast, isToday }) => {
                    const sessionType: string = (sched as any)[day] ?? "off";
                    const sessionLabel = PERF_SESSION_LABELS[sessionType] ?? sessionType;
                    const isSelected = selectedDate === dateStr;

                    return (
                      <button
                        key={day}
                        onClick={() => { setSelectedDate(dateStr); setPerfSelectedDate(dateStr); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                          isSelected
                            ? "bg-orange-600/30 border border-orange-500/50"
                            : "bg-white/5 border border-transparent"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isPast   ? "bg-green-600/30 border border-green-500/40" :
                          isToday  ? "bg-orange-500/30 border border-orange-400/60" :
                                     "bg-white/10 border border-white/10"
                        }`}>
                          {isPast
                            ? <Check className="w-3 h-3 text-green-400" />
                            : isToday
                            ? <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse block" />
                            : <span className="w-1.5 h-1.5 rounded-full bg-white/30 block" />
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold w-7 ${isSelected ? "text-orange-300" : isPast ? "text-white/50" : isToday ? "text-orange-300" : "text-white/70"}`}>
                              {short}
                            </span>
                            <span className={`text-xs font-semibold ${isSelected ? "text-white" : isPast ? "text-white/50" : isToday ? "text-white" : "text-white/70"}`}>
                              {sessionLabel}
                            </span>
                            {isToday && !isSelected && (
                              <span className="text-[9px] text-orange-400 font-semibold uppercase tracking-wider">Today</span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <ChevronRight className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── Coaching Plan card — updates when a different day is selected ── */}
          {todaySession && (
            <div className="rounded-2xl bg-black/50 border border-orange-500/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isViewingToday && <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
                  <p className="text-xs text-orange-300 font-semibold uppercase tracking-wider">
                    {isViewingToday ? "Today's Training" : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })}
                  </p>
                </div>
                <span className="text-xs text-white/60 font-medium">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>

              <p className="text-white font-bold text-2xl leading-none mb-1">{todaySession.sessionLabel}</p>

              {/* Why explanation */}
              {(() => {
                const bullets = PERF_SESSION_WHY[todaySession.sessionType];
                if (!bullets) return null;
                return (
                  <div className="mb-4 space-y-1">
                    {bullets.map((line, i) => (
                      <p key={i} className="text-white/70 text-xs leading-relaxed flex gap-1.5">
                        <span className="text-orange-400 mt-0.5 flex-shrink-0">·</span>
                        {line}
                      </p>
                    ))}
                  </div>
                );
              })()}

              {/* Coaching Plan Targets */}
              <p className="text-white text-[11px] font-semibold uppercase tracking-wider mb-2">Coaching Plan Targets</p>
              <div className="grid grid-cols-5 gap-1.5 mb-4">
                {[
                  { label: "Calories", value: todaySession.calories.toLocaleString(), unit: "kcal" },
                  { label: "Protein",  value: `${todaySession.proteinG}`,             unit: "g" },
                  { label: "Starchy",  value: `${todaySession.starchyCarbsG}`,        unit: "g" },
                  { label: "Fibrous",  value: `${todaySession.fibrousCarbsG}`,        unit: "g" },
                  { label: "Fat",      value: `${todaySession.fatG}`,                 unit: "g" },
                ].map(m => (
                  <div key={m.label} className="bg-white/10 rounded-xl px-1.5 py-2.5 text-center">
                    <p className="text-white font-bold text-sm leading-none">{m.value}</p>
                    <p className="text-white/70 text-[10px] mt-0.5">{m.unit}</p>
                    <p className="text-white/70 text-[9px] mt-0.5 uppercase tracking-wide">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* Remaining Today — only shown when viewing today */}
              {isViewingToday && todaySession.logged && (() => {
                const rem = {
                  calories:      Math.max(0, todaySession.calories      - todaySession.logged.calories),
                  proteinG:      Math.max(0, todaySession.proteinG      - todaySession.logged.proteinG),
                  starchyCarbsG: Math.max(0, todaySession.starchyCarbsG - todaySession.logged.starchyCarbsG),
                  fibrousCarbsG: Math.max(0, todaySession.fibrousCarbsG - todaySession.logged.fibrousCarbsG),
                  fatG:          Math.max(0, todaySession.fatG          - todaySession.logged.fatG),
                };
                const anyLogged = todaySession.logged.calories > 0;
                return (
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-white text-[11px] font-semibold uppercase tracking-wider mb-2">
                      Remaining Today
                    </p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { label: "Calories", value: rem.calories.toLocaleString(), unit: "kcal" },
                        { label: "Protein",  value: `${rem.proteinG}`,             unit: "g" },
                        { label: "Starchy",  value: `${rem.starchyCarbsG}`,        unit: "g" },
                        { label: "Fibrous",  value: `${rem.fibrousCarbsG}`,        unit: "g" },
                        { label: "Fat",      value: `${rem.fatG}`,                 unit: "g" },
                      ].map(m => (
                        <div key={m.label} className="bg-orange-600/20 rounded-xl px-1.5 py-2 text-center">
                          <p className={`font-bold text-sm leading-none ${anyLogged ? "text-orange-300" : "text-white/60"}`}>{m.value}</p>
                          <p className="text-white/70 text-[10px] mt-0.5">{m.unit}</p>
                          <p className="text-white/70 text-[9px] mt-0.5 uppercase tracking-wide">{m.label}</p>
                        </div>
                      ))}
                    </div>
                    {!anyLogged && (
                      <p className="text-white/60 text-[10px] mt-2 text-center">Log meals to see remaining</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Daily Nutrition Intelligence Card ── */}
          {isViewingToday && todaySession?.dailyState?.scheduleConfigured && (() => {
            const ds = todaySession.dailyState!;

            const policyLabel: Record<string, string> = {
              zero:       "No starchy carbs today",
              restricted: "Minimize starchy carbs",
              moderate:   "One starchy source per meal",
              generous:   "Include full starchy carbs — training demands it",
              unlimited:  "No starch limit active",
            };
            const ledgerLabel: Record<string, { text: string; color: string }> = {
              high:   { text: "Fully tracked",                                                color: "text-green-400" },
              medium: { text: "Partially tracked — some meals unclassified",                  color: "text-yellow-400" },
              low:    { text: "Not yet tracked — log meals to update your remaining balance",  color: "text-white/50" },
            };
            const ledger = ledgerLabel[ds.ledgerReliability] ?? ledgerLabel.low;

            return (
              <div className={`rounded-2xl border p-4 space-y-3 ${
                ds.starchyBudgetExhausted
                  ? "bg-orange-900/30 border-orange-500/50"
                  : "bg-black/50 border-orange-500/30"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  <p className="text-xs text-orange-300 font-semibold uppercase tracking-wider">Today's Nutrition Strategy</p>
                </div>

                {/* Starch policy */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-white font-semibold text-sm">
                      {policyLabel[ds.starchPolicy] ?? ds.starchPolicy}
                    </p>
                    {ds.starchyBudgetExhausted && (
                      <p className="text-orange-300 text-xs mt-0.5">
                        You've reached today's starchy carb limit. Remaining meals will favor protein and fibrous vegetables.
                      </p>
                    )}
                  </div>
                  {ds.starchyBudgetExhausted && (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-orange-600/40 border border-orange-500/40 text-orange-300 text-[10px] font-semibold uppercase tracking-wide">
                      Limit Reached
                    </span>
                  )}
                </div>

                {/* Ledger status */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${ledger.color}`}>
                    Tracking: {ledger.text}
                  </span>
                </div>

                {/* App-wide impact */}
                <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                  <p className="text-orange-300 text-[11px] font-semibold uppercase tracking-wider mb-1">Affects the whole app</p>
                  <p className="text-white/70 text-xs leading-relaxed">
                    This strategy applies everywhere — Create a Dish, Snack Creator, Beverages, Desserts, Restaurant Guide, Fridge Rescue, Getaway Coach, Gatherings, Meal Planner, and more. Every recommendation starts with today's training day.
                  </p>
                </div>

                {/* Logging nudge when nothing is logged yet */}
                {ds.ledgerReliability === "low" && (
                  <p className="text-white/50 text-[10px] text-center">
                    Only confirmed meals reduce your daily starch balance. Viewing or generating a meal does not count.
                  </p>
                )}
              </div>
            );
          })()}

          {/* ── Section 1: Performance Profile ── */}
          <div className="rounded-2xl bg-black/50 border border-orange-500/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <p className="text-xs text-orange-300 font-semibold">Athletic Protocol Active</p>
            </div>
            <p className="text-white font-bold text-2xl leading-none mb-0.5">
              {pCtx.trainingType === "other"
                ? (pCtx.customSportName ?? "Custom Sport")
                : (TYPE_LABELS[pCtx.trainingType] ?? pCtx.trainingType)}
            </p>
            <p className="text-orange-300 text-sm font-medium mb-3">
              {GOAL_LABELS[pCtx.primaryGoal] ?? pCtx.primaryGoal}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                PHASE_LABELS[pCtx.trainingPhase] ?? pCtx.trainingPhase,
                `${pCtx.trainingFrequency} sessions/wk`,
                CARDIO_LABELS[pCtx.cardioFocus] ?? pCtx.cardioFocus,
                pCtx.twoADays ? "2-a-Days" : null,
                pCtx.sessionDuration ? (SESSION_DURATION_LABELS[pCtx.sessionDuration] ?? pCtx.sessionDuration) : null,
                pCtx.recoveryStatus ? (RECOVERY_STATUS_LABELS[pCtx.recoveryStatus] ?? pCtx.recoveryStatus) : null,
                ...((pCtx as any).adaptationTargets?.length
                  ? ((pCtx as any).adaptationTargets as string[]).map((t: string) => ADAPTATION_TARGET_LABELS[t] ?? t)
                  : pCtx.adaptationTarget ? [ADAPTATION_TARGET_LABELS[pCtx.adaptationTarget] ?? pCtx.adaptationTarget] : []),
              ].filter(Boolean).map((label, i) => (
                <span key={i} className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 text-xs font-medium">
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Tabs — Starch and Protocols hidden in shared/training-schedule mode */}
          {!continueTo && (
            <div className="flex bg-black/30 rounded-xl p-1 gap-1">
              {(["protocol", "starch", "protocols"] as ActiveTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === tab ? "bg-orange-600 text-white" : "text-white/40"
                  }`}
                >
                  {tabLabel(tab)}
                </button>
              ))}
            </div>
          )}

          {!continueTo && activeTab === "starch"    && renderStarchTab()}
          {!continueTo && activeTab === "protocols" && renderProtocolsTab()}

          {(continueTo || activeTab === "protocol") && (
            <div className="space-y-4">

              {/* ── Pro View toggle (procare / care_team / admin only) ── */}
              {canSeeProView && (
                <div className="flex bg-black/30 rounded-xl p-1 gap-1">
                  {(["user", "pro"] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => {
                        setViewMode(mode);
                        localStorage.setItem("mpm.perfHub.viewMode", mode);
                      }}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        viewMode === mode ? "bg-orange-600 text-white" : "text-white/40"
                      }`}
                    >
                      {mode === "user" ? "My View" : "Pro View"}
                    </button>
                  ))}
                </div>
              )}

              {/* ── PRO VIEW: Medical Protocols Active ── */}
              {isProView && (() => {
                const conditions: string[] = (user as any)?.specialtyConditions ?? [];
                const protos = conditions
                  .map(c => ({ key: c, ...CONDITION_PROTOCOL_LABELS[c] }))
                  .filter(p => p.name);
                if (protos.length === 0) return null;
                return (
                  <div className="rounded-2xl bg-black/50 border border-orange-500/20 p-4">
                    <p className="text-xs text-orange-300 font-semibold uppercase tracking-wider mb-3">Medical &amp; Protocol Stack Active</p>
                    <div className="space-y-2.5">
                      {protos.map((proto) => (
                        <div key={proto.key} className="bg-white/5 rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${proto.category === "Athletic" ? "bg-orange-600/30 text-orange-300" : "bg-blue-600/20 text-blue-300"}`}>
                              {proto.category}
                            </span>
                            <p className="text-white font-semibold text-xs">{proto.name}</p>
                          </div>
                          <p className="text-white/70 text-xs leading-relaxed">{proto.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── Section 2: Active Performance Factors ── */}
              <div className="rounded-2xl bg-black/50 border border-orange-500/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-3.5 h-3.5 text-orange-400" />
                  <p className="text-white font-bold text-sm">Active Performance Factors</p>
                </div>
                {isProView ? (() => {
                  const trace = buildDemandSignalTrace(pCtx);
                  return (
                    <div className="space-y-2">
                      {[
                        { label: "Fuel Demand",       value: FUEL_DEMAND_LABELS[demandProfile.fuelDemand],         cls: FUEL_DEMAND_COLORS[demandProfile.fuelDemand],         signals: trace.fuel },
                        { label: "Recovery Demand",   value: RECOVERY_DEMAND_LABELS[demandProfile.recoveryDemand], cls: RECOVERY_DEMAND_COLORS[demandProfile.recoveryDemand], signals: trace.recovery },
                        { label: "Adaptation Focus",  value: ADAPTATION_DEMAND_LABELS[demandProfile.adaptationDemand], cls: "bg-white/5 border-white/10 text-white",           signals: trace.adaptation },
                        { label: "Training Load",     value: TRAINING_LOAD_LABELS[demandProfile.trainingLoad],     cls: TRAINING_LOAD_COLORS[demandProfile.trainingLoad],     signals: trace.load },
                      ].map(({ label, value, cls, signals }) => (
                        <div key={label} className={`rounded-xl border px-3 py-2.5 ${cls}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs opacity-80 mb-0.5">{label}</p>
                              <p className="font-bold text-xs">{value}</p>
                            </div>
                          </div>
                          {signals.length > 0 && (
                            <p className="text-xs opacity-70 mt-1.5">← {signals.join(" · ")}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })() : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`rounded-xl border px-3 py-2.5 ${FUEL_DEMAND_COLORS[demandProfile.fuelDemand]}`}>
                      <p className="text-xs opacity-80 mb-0.5">Fuel Demand</p>
                      <p className="font-bold text-xs">{FUEL_DEMAND_LABELS[demandProfile.fuelDemand]}</p>
                    </div>
                    <div className={`rounded-xl border px-3 py-2.5 ${RECOVERY_DEMAND_COLORS[demandProfile.recoveryDemand]}`}>
                      <p className="text-xs opacity-80 mb-0.5">Recovery Demand</p>
                      <p className="font-bold text-xs">{RECOVERY_DEMAND_LABELS[demandProfile.recoveryDemand]}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                      <p className="text-white/70 text-xs mb-0.5">Adaptation Focus</p>
                      <p className="text-white font-bold text-xs">{ADAPTATION_DEMAND_LABELS[demandProfile.adaptationDemand]}</p>
                    </div>
                    <div className={`rounded-xl border px-3 py-2.5 ${TRAINING_LOAD_COLORS[demandProfile.trainingLoad]}`}>
                      <p className="text-xs opacity-80 mb-0.5">Training Load</p>
                      <p className="font-bold text-xs">{TRAINING_LOAD_LABELS[demandProfile.trainingLoad]}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Section 3: Nutrition Priorities ── */}
              {demandProfile.nutritionPriorities.length > 0 && (
                <div className="rounded-2xl bg-black/50 border border-white/10 p-4">
                  <p className="text-white font-bold text-sm mb-3">Nutrition Priorities</p>
                  <div className="space-y-2">
                    {demandProfile.nutritionPriorities.map((priority, i) => (
                      <div key={i} className={isProView ? "pb-2.5 border-b border-white/5 last:border-0" : "flex items-center gap-3"}>
                        {isProView ? (
                          <>
                            <div className="flex items-center gap-2.5 mb-1">
                              <span className="w-5 h-5 rounded-full bg-orange-600/30 border border-orange-500/40 flex items-center justify-center flex-shrink-0">
                                <span className="text-orange-300 font-bold" style={{ fontSize: "10px" }}>{i + 1}</span>
                              </span>
                              <p className="text-white font-semibold text-sm">{priority}</p>
                            </div>
                            {PRIORITY_RATIONALES[priority] && (
                              <p className="text-white/70 text-xs leading-relaxed pl-7">{PRIORITY_RATIONALES[priority]}</p>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="w-6 h-6 rounded-full bg-orange-600/30 border border-orange-500/40 flex items-center justify-center flex-shrink-0">
                              <span className="text-orange-300 font-bold text-xs">{i + 1}</span>
                            </span>
                            <p className="text-white/80 text-sm">{priority}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── PRO VIEW: Meal Logic Summary ── */}
              {isProView && (() => {
                const cats = buildMealLogicCategories(demandProfile);
                if (cats.length === 0) return null;
                return (
                  <div className="rounded-2xl bg-black/50 border border-white/10 p-4">
                    <p className="text-white font-bold text-sm mb-1">AI Instruction Categories</p>
                    <p className="text-white/70 text-xs mb-3">What the system instructs the AI to prioritize for this profile</p>
                    <div className="space-y-1.5">
                      {cats.map((cat, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-orange-400 flex-shrink-0" />
                          <p className="text-white/70 text-sm">{cat}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── Section 4: How This Influences Your Meals ── */}
              {(() => {
                const influenceLines = buildMealInfluenceText(demandProfile);
                if (influenceLines.length === 0) return null;
                return (
                  <div className="rounded-2xl bg-black/50 border border-white/10 p-4">
                    <p className="text-white font-bold text-sm mb-3">How This Influences Your Meals</p>
                    <div className="space-y-2">
                      {influenceLines.map((line, i) => (
                        <p key={i} className="text-white/70 text-sm leading-relaxed">{line}</p>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Phase-specific notes */}
              {pCtx.trainingPhase === "weight_cut" && (
                <div className="rounded-2xl bg-red-950/40 border border-red-500/30 p-4">
                  <p className="text-red-300 font-bold text-sm mb-1">⚠️ Weight Cut Mode Active</p>
                  <p className="text-white/60 text-xs leading-relaxed">
                    Meals are optimized for low-sodium, calorie-controlled fueling with rehydration support. Electrolyte-rich vegetables and lean proteins are prioritized.
                  </p>
                </div>
              )}
              {pCtx.trainingPhase === "recovery" && (
                <div className="rounded-2xl bg-blue-950/40 border border-blue-500/30 p-4">
                  <p className="text-blue-300 font-bold text-sm mb-1">Recovery Phase Active</p>
                  <p className="text-white/60 text-xs leading-relaxed">
                    Anti-inflammatory ingredients are prioritized — omega-3 rich fish, colorful vegetables, tart cherries, turmeric, and ginger feature heavily in meal suggestions.
                  </p>
                </div>
              )}
              {pCtx.twoADays && (
                <div className="rounded-2xl bg-orange-950/40 border border-orange-500/30 p-4">
                  <p className="text-orange-300 font-bold text-sm mb-1">2-a-Days Protocol</p>
                  <p className="text-white/60 text-xs leading-relaxed">
                    Between-session recovery meals are critical. Quick-digesting carb + protein options (rice cakes + turkey, banana + Greek yogurt) are suggested between sessions.
                  </p>
                </div>
              )}

              <button
                onClick={() => setLocation(builderPath)}
                className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-orange-600/20 border border-orange-500/30 text-white"
              >
                <div className="text-left">
                  <p className="font-bold text-sm">{continueLabel ?? (continueTo ? "Continue to Builder" : "Launch Performance Nutrition Builder")}</p>
                  <p className="text-white/80 text-xs mt-0.5">Build sport-calibrated meals now</p>
                </div>
                <ChevronRight className="w-5 h-5 text-orange-400 flex-shrink-0" />
              </button>
            </div>
          )}
        </div>
      )}

    </motion.div>
  );

  // ── Starch Protocol Tab ───────────────────────────────────────────────────
  function renderStarchTab() {
    const cycleState = carbCycleData?.state;
    const engine = carbCycleData?.engine;
    const phase = cycleState?.phase ?? "inactive";
    const carbTargetG = cycleState?.carbTargetG ?? 0;

    const phaseBadge: Record<string, { label: string; cls: string }> = {
      inactive: { label: "Inactive",      cls: "bg-white/10 border-white/10 text-white/50" },
      low_carb: { label: "Low-Carb Phase",cls: "bg-orange-600/20 border-orange-500/30 text-orange-300" },
      refeed:   { label: "Refeed Phase",  cls: "bg-green-600/20 border-green-500/30 text-green-300" },
    };
    const badge = phaseBadge[phase] ?? phaseBadge.inactive;

    if (carbCycleLoading && !carbCycleData) return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
      </div>
    );

    return (
      <div className="space-y-3">

        {/* Current phase */}
        <div className="rounded-2xl bg-black/50 border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCcw className="w-4 h-4 text-orange-400" />
              <p className="text-white font-bold text-sm">Starch Response Protocol</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.cls}`}>{badge.label}</span>
          </div>

          {phase !== "inactive" ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-xl px-3 py-2">
                <p className="text-white/70 text-xs">Starch Allocation</p>
                <p className="text-white font-bold text-2xl mt-0.5">{carbTargetG}<span className="text-sm font-normal text-white/70 ml-0.5">g</span></p>
              </div>
              <div className="bg-white/5 rounded-xl px-3 py-2">
                <p className="text-white/70 text-xs">Fibrous Carbs</p>
                <p className="text-green-300 font-semibold text-sm mt-1">Unrestricted</p>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs leading-relaxed">
                Log daily weight via the Protocols tab check-in to activate stall detection and automatic phase management.
              </p>
            </div>
          )}

          {engine?.stallDetected && (
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-2.5">
              <p className="text-amber-300 text-xs font-semibold">⚡ Weight Stall Detected</p>
              <p className="text-amber-200/60 text-xs mt-0.5">7 consecutive days without scale movement. Check in via the Protocols tab to get a directive.</p>
            </div>
          )}
        </div>

        {/* Protocol rules */}
        <div className="rounded-2xl bg-black/50 border border-white/10 p-4 space-y-2.5">
          <p className="text-white font-bold text-sm mb-1">Protocol Rules</p>
          {[
            { label: "Starch target",    value: carbTargetG > 0 ? `${carbTargetG}g/day` : "Not yet active" },
            { label: "Refeed trigger",   value: "7 consecutive days of no scale movement" },
            { label: "Refeed duration",  value: "1–2 days" },
            { label: "Post-refeed",      value: "Automatic return to low-carb phase" },
            { label: "Floor limit",      value: "50g minimum — protocol cycles, never drops below" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <p className="text-white/70 text-xs flex-shrink-0 w-28">{label}</p>
              <p className="text-white/80 text-xs text-right">{value}</p>
            </div>
          ))}
        </div>

        {/* Scale response expectations */}
        <div className="rounded-2xl bg-black/50 border border-white/10 p-4 space-y-2.5">
          <p className="text-white font-bold text-sm mb-1">Expected Scale Response</p>
          {[
            { phase: "Low-carb phase",    response: "−0.5 to −1 lb/week after initial water drop" },
            { phase: "Refeed days",       response: "+1 to +3 lbs (temporary water retention)" },
            { phase: "Post-refeed",       response: "Accelerated loss resumes within 48–72h" },
            { phase: "Stall (>7 days)",   response: "Refeed trigger activates → protocol adjusts" },
          ].map(({ phase: ph, response }) => (
            <div key={ph} className="flex items-start justify-between gap-3">
              <p className="text-white/70 text-xs flex-shrink-0 w-28">{ph}</p>
              <p className="text-white/80 text-xs text-right">{response}</p>
            </div>
          ))}
        </div>

        {/* Engine recommendation */}
        {engine?.recommendation && (
          <div className="rounded-2xl bg-orange-950/40 border border-orange-500/30 p-4">
            <p className="text-orange-300 font-bold text-xs uppercase tracking-wide mb-1">Current Adjustment</p>
            <p className="text-white/80 text-sm leading-relaxed">{engine.recommendation}</p>
          </div>
        )}

        {/* Manual override controls */}
        {phase !== "inactive" && (
          <div className="rounded-2xl bg-black/50 border border-white/10 p-4">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wide mb-3">Manual Override</p>
            <div className="flex gap-2">
              {phase !== "refeed" ? (
                <button
                  onClick={() => handleRefeedToggle("start_refeed")}
                  disabled={overrideSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-green-600/20 border border-green-500/30 text-green-300 text-sm font-semibold disabled:opacity-40"
                >
                  {overrideSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Start Refeed"}
                </button>
              ) : (
                <button
                  onClick={() => handleRefeedToggle("end_refeed")}
                  disabled={overrideSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-300 text-sm font-semibold disabled:opacity-40"
                >
                  {overrideSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "End Refeed"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Protocols + Check-In Tab ──────────────────────────────────────────────
  function renderProtocolsTab() {
    const starchTarget = carbCycleData?.state?.carbTargetG ?? 0;
    const starchPhase  = carbCycleData?.state?.phase ?? "inactive";
    const trackLabel   = activeTrack === "competition" ? "Competition Prep" : "Athletic Performance";
    const currentPhaseLabel = activeTrack === "competition"
      ? (compPhase?.phaseLabel ?? "—")
      : (pCtx ? (PHASE_LABELS[pCtx.trainingPhase] ?? pCtx.trainingPhase) : "—");
    const canEvaluate = !!checkInWeight && !!checkInEnergy && !!checkInStrength;

    function buildProtocolSummaryText(): string {
      const lines: string[] = ["🏋️ My Performance Protocol"];
      lines.push(`Track: ${trackLabel}`);
      lines.push(`Phase: ${currentPhaseLabel}`);
      lines.push(`Starch Allocation: ${starchTarget > 0 ? `${starchTarget}g` : "Not set"}`);
      lines.push(`Starch Phase: ${starchPhase === "low_carb" ? "Low-Carb" : starchPhase === "refeed" ? "Refeed" : "Inactive"}`);
      if (pCtx?.primaryGoal) lines.push(`Goal: ${GOAL_LABELS[pCtx.primaryGoal] ?? pCtx.primaryGoal}`);
      if (pCtx?.trainingType) lines.push(`Sport/Type: ${TYPE_LABELS[pCtx.trainingType] ?? pCtx.trainingType}`);
      return lines.join("\n");
    }

    function handleCopyProtocol() {
      navigator.clipboard.writeText(buildProtocolSummaryText()).then(() => {
        setProtocolCopied(true);
        setTimeout(() => setProtocolCopied(false), 1500);
      });
    }

    return (
      <div className="space-y-4">

        {/* Active Protocol Summary */}
        <div className="rounded-2xl bg-black/50 border border-white/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-orange-400" />
            <p className="text-white font-bold text-sm flex-1">Active Protocol</p>
            <button
              onClick={handleCopyProtocol}
              className="flex items-center gap-1 bg-white/10 hover:bg-white/15 rounded-full px-3 py-1 text-xs font-semibold text-white transition-colors"
              aria-label="Copy protocol summary to clipboard"
            >
              {protocolCopied ? (
                <><Check className="h-3 w-3 text-green-400" /><span className="text-green-400">Copied!</span></>
              ) : (
                <><Copy className="h-3 w-3" />Copy</>
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Track",            value: trackLabel },
              { label: "Phase",            value: currentPhaseLabel },
              { label: "Starch Allocation",value: starchTarget > 0 ? `${starchTarget}g` : "Not set" },
              { label: "Starch Phase",     value: starchPhase === "low_carb" ? "Low-Carb" : starchPhase === "refeed" ? "Refeed" : "Inactive" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl px-3 py-2">
                <p className="text-white/70 text-xs">{label}</p>
                <p className="text-white font-semibold text-sm mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Check-In Panel */}
        <div className="rounded-2xl bg-black/50 border border-white/10 p-4 space-y-4">
          <p className="text-white font-bold text-sm">Check-In</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/80 text-xs mb-1.5 block">Scale (lbs)</label>
              <input
                type="number"
                value={checkInWeight}
                onChange={e => setCheckInWeight(e.target.value)}
                placeholder="175"
                min={0}
                className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 outline-none focus:border-orange-500/60"
              />
            </div>
            <div>
              <label className="text-white/80 text-xs mb-1.5 block">Starch Today (g) <span className="text-white/50">opt.</span></label>
              <input
                type="number"
                value={checkInStarch}
                onChange={e => setCheckInStarch(e.target.value)}
                placeholder="80"
                min={0}
                className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 outline-none focus:border-orange-500/60"
              />
            </div>
          </div>

          <div>
            <label className="text-white/80 text-xs mb-2 block">Energy Level</label>
            <div className="flex gap-2">
              {(["low", "moderate", "high"] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setCheckInEnergy(level)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    checkInEnergy === level
                      ? "bg-orange-600/30 border-orange-400/60 text-white"
                      : "bg-white/5 border-white/10 text-white/50"
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-white/80 text-xs mb-2 block">Strength</label>
            <div className="flex gap-2">
              {(["declining", "holding", "increasing"] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setCheckInStrength(level)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    checkInStrength === level
                      ? "bg-orange-600/30 border-orange-400/60 text-white"
                      : "bg-white/5 border-white/10 text-white/50"
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={evaluateProtocol}
            disabled={!canEvaluate || checkInLoading}
            className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              canEvaluate && !checkInLoading
                ? "bg-orange-600 text-white active:scale-[0.98]"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            {checkInLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Evaluating...</>
            ) : (
              <><Zap className="w-4 h-4" /> Evaluate Protocol</>
            )}
          </button>
        </div>

        {/* Directive Result */}
        {checkInResult && (
          <div className="rounded-2xl bg-orange-950/40 border border-orange-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-orange-400" />
              <p className="text-orange-300 font-bold text-xs uppercase tracking-wide">Protocol Directive</p>
            </div>
            <p className="text-white font-semibold text-sm leading-relaxed">{checkInResult}</p>
          </div>
        )}

        {/* Weight Response Reference */}
        <div className="rounded-2xl bg-black/50 border border-white/10 p-4 space-y-0">
          <p className="text-white/80 text-xs font-semibold uppercase tracking-wide mb-3">Weight Response Reference</p>
          {[
            { signals: "Scale ↓ · Energy good · Strength good",  directive: "On track — maintain protocol" },
            { signals: "Scale flat >7 days · any signals",        directive: "Refeed trigger — starch allocation raised" },
            { signals: "Scale ↑ · Energy ↓ · Strength ↓",        directive: "Deficit too aggressive — 50g protein swap" },
            { signals: "Scale +1–3 lbs after refeed",             directive: "Normal water retention — return to low-carb" },
            { signals: "Scale ↓ · Energy ↓",                     directive: "Hold 72h — monitor before adjusting" },
          ].map(({ signals, directive }, i) => (
            <div key={i} className={`py-2.5 ${i > 0 ? "border-t border-white/5" : ""}`}>
              <p className="text-orange-300/70 text-xs">{signals}</p>
              <p className="text-white/60 text-xs mt-0.5">→ {directive}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
