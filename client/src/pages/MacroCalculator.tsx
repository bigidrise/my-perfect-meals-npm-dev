// client/src/pages/MacroCounter.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Calculator } from "lucide-react";
import { useLocation } from "wouter";
import { estimateBodyFatHybrid } from "@/lib/bodyFatEstimation";
import { motion, AnimatePresence } from "framer-motion";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";
import {
  MACRO_CALC_ENTRY,
  MACRO_CALC_GOAL,
  MACRO_CALC_COMMITMENT_LEVEL,
  MACRO_CALC_BODY_TYPE,
  MACRO_CALC_UNITS,
  MACRO_CALC_SEX,
  MACRO_CALC_AGE,
  MACRO_CALC_HEIGHT,
  MACRO_CALC_WEIGHT,
  MACRO_CALC_WAIST,
  MACRO_CALC_ACTIVITY,
  MACRO_CALC_SYNC_WEIGHT,
  MACRO_CALC_METABOLIC,
  MACRO_CALC_RESULTS,
  MACRO_CALC_STARCH,
  MACRO_CALC_BODY_COMPOSITION,
  MACRO_CALC_SAVE,
  MACRO_CALC_DONE,
} from "@/components/copilot/scripts/macroCalculatorScripts";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import {
  Activity,
  User2,
  Info,
  Ruler,
  Scale,
  LifeBuoy,
  Target,
  Compass,
  X,
  Home,
  ChefHat,
  Check,
  Sparkles,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Save,
} from "lucide-react";

// Guided flow step type
type GuidedStep =
  | "entry"
  | "goal"
  | "commitmentLevel"
  | "bodyType"
  | "units"
  | "sex"
  | "age"
  | "height"
  | "weight"
  | "waist"
  | "activity"
  | "syncWeight"
  | "metabolic"
  | "results"
  | "nutritionStrategy"
  | "starch"
  | "bodyComposition"
  | "save"
  | "done";
import { useToast } from "@/hooks/use-toast";
import {
  setMacroTargets,
  getMacroTargets,
  type StarchStrategy,
  type CutIntensity,
  type CutStyle,
} from "@/lib/dailyLimits";
import ReadOnlyNote from "@/components/ReadOnlyNote";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { TrialBanner } from "@/components/TrialBanner";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { getAssignedBuilderFromStorage } from "@/lib/assignedBuilder";
import MetabolicConsiderations from "@/components/macro-targeting/MetabolicConsiderations";
import BodyCompositionSection from "@/components/macro-targeting/BodyCompositionSection";
import WaistRiskSection from "@/components/macro-targeting/WaistRiskSection";
import {
  MacroDeltas,
  AdvisorySources,
  ClinicalAdvisoryState,
  sumAdvisorySources,
  capCombinedDeltas,
  loadUserAdvisory,
} from "@/lib/clinicalAdvisory";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { calculateWaistHeightRatio, classifyWaistRisk } from "@shared/waistRisk";
import { isGuestMode, markMacrosCompleted } from "@/lib/guestMode";
import { getCurrentUser } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { buildBiometricsUrl } from "@/lib/biometricsNavigation";

type Goal = "loss" | "maint" | "gain";
type Sex = "male" | "female";
type Units = "imperial" | "metric";
type BodyType = "ecto" | "meso" | "endo";
type UserType = "general" | "committed" | "athlete";

const toNum = (v: string | number) => {
  const n = typeof v === "string" ? v.trim() : v;
  const out = Number(n || 0);
  return Number.isFinite(out) ? out : 0;
};

const kgFromLbs = (lbs: number) => lbs * 0.45359237;
const cmFromFeetInches = (ft: number, inch: number) => ft * 30.48 + inch * 2.54;

function WaistEducationBlock({ waistCm, heightCm }: { waistCm: number; heightCm: number }) {
  const [isOpen, setIsOpen] = React.useState(false);

  const hasRatio = waistCm > 0 && heightCm > 0;
  const ratio = hasRatio ? calculateWaistHeightRatio(waistCm, heightCm) : 0;
  const risk = hasRatio ? classifyWaistRisk(ratio) : null;

  const riskColorMap = {
    green: "text-emerald-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
  };
  const riskBgMap = {
    green: "bg-emerald-500/10 border-emerald-500/20",
    yellow: "bg-yellow-500/10 border-yellow-500/20",
    red: "bg-red-500/10 border-red-500/20",
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/50">
        Healthy guideline: your waist should be less than half your height.
      </p>

      {hasRatio && risk && (
        <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${riskBgMap[risk.level]}`}>
          <div>
            <span className="text-xs text-white/50">Waist-to-Height Ratio: </span>
            <span className={`text-sm font-bold ${riskColorMap[risk.level]}`}>
              {ratio.toFixed(2)}
            </span>
          </div>
          <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${riskColorMap[risk.level]} bg-white/5`}>
            {risk.label}
          </div>
        </div>
      )}

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between text-xs text-white/40 hover:text-white/60 transition-colors py-1.5">
            <span className="flex items-center gap-1.5">
              <Info className="h-3 w-3" />
              Why does My Perfect Meals ask for waist size?
            </span>
            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-black/30 border border-white/10 rounded-lg p-3 mt-1 space-y-2 text-xs text-white/70 leading-relaxed">
            <p>
              Doctors and nutrition scientists use waist circumference to estimate visceral fat.
              Visceral fat is the fat stored around your organs, and it is strongly linked to heart disease,
              insulin resistance, and metabolic syndrome.
            </p>
            <p>
              Instead of using BMI alone, My Perfect Meals uses a measurement called the waist-to-height ratio.
            </p>
            <p>
              Research from organizations such as the World Health Organization (WHO), National Institutes of
              Health (NIH), and American Diabetes Association (ADA) shows that keeping your waist less than
              half of your height is associated with better metabolic health.
            </p>
            <p>Your waist measurement helps My Perfect Meals:</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Estimate visceral fat risk</li>
              <li>Adjust carbohydrate targets when necessary</li>
              <li>Improve macro precision for long-term metabolic health</li>
            </ul>
            <p className="text-white/50 italic">
              This measurement does not diagnose disease. It simply helps the system make smarter nutrition recommendations.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

function mifflin({
  sex,
  kg,
  cm,
  age,
}: {
  sex: Sex;
  kg: number;
  cm: number;
  age: number;
}) {
  const b = 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161);
  return Math.max(800, Math.round(b));
}

function goalAdjust(tdee: number, goal: Goal) {
  if (goal === "loss") return Math.round(tdee * 0.85);
  if (goal === "gain") return Math.round(tdee * 1.1);
  return Math.round(tdee);
}

// Macro-first multipliers — macros drive the system, calories are a result
const PROTEIN_MULT: Record<Goal, number> = { loss: 1.1,  maint: 0.9,  gain: 1.3  };
const STARCHY_MULT: Record<Goal, number> = { loss: 0.25, maint: 0.55, gain: 1.25 }; // maint 0.55 = livable (was 0.8 = athlete-only)
const FAT_MULT:     Record<Goal, number> = { loss: 0.35, maint: 0.42, gain: 0.5  };

// Tiered protein model — scaled by user type for realistic compliance
function calcProtein(lb: number, goal: Goal, userType: UserType = "general"): number {
  let raw: number;

  if (userType === "general") {
    // Most users — adherence-first, still above RDA
    if (goal === "loss")  raw = lb * 0.8;
    else if (goal === "gain") raw = lb * 0.9;
    else                  raw = lb * 0.7; // maint
  } else if (userType === "committed") {
    // Dedicated dieters / gym-goers — coach-level targets
    if (goal === "loss")  raw = lb * 1.0;
    else if (goal === "gain") raw = lb * 1.1;
    else                  raw = lb * 0.9; // maint
  } else {
    // athlete — performance-level; same regardless of goal
    raw = lb * 1.1;
  }

  return Math.min(260, Math.round(raw)); // global hard cap
}

function calcMacrosBase({ lb, goal, userType }: { lb: number; goal: Goal; userType: UserType }) {
  // Step 1: Protein (anchor — tiered, user-type-aware, capped at 260g)
  const proteinG = calcProtein(lb, goal, userType);

  // Step 2: Fibrous carbs (non-negotiable floor — raised for satiety)
  const fibrousG = Math.max(40, Math.round(lb * 0.25));

  // Step 3: Starchy carbs (controlled variable by goal)
  let starchyG = Math.round(lb * (STARCHY_MULT[goal] ?? 0.45));

  // Step 4: Fat (support macro — NOT residual)
  const fatG = Math.round(lb * (FAT_MULT[goal] ?? 0.35));

  // Step 5: Totals derived from macros
  let carbsG = starchyG + fibrousG;

  // Step 6: Calories computed last — never used to determine macros
  let calories = proteinG * 4 + carbsG * 4 + fatG * 9;

  // Step 7: Safety — only starchy carbs adjusted, protein and fibrous stay fixed
  if (calories < 1200) {
    starchyG += Math.ceil((1200 - calories) / 4);
    carbsG = starchyG + fibrousG;
    calories = proteinG * 4 + carbsG * 4 + fatG * 9;
  } else if (calories > 4000) {
    starchyG = Math.max(0, starchyG - Math.ceil((calories - 4000) / 4));
    carbsG = starchyG + fibrousG;
    calories = proteinG * 4 + carbsG * 4 + fatG * 9;
  }

  return {
    calories,
    protein: { g: proteinG, kcal: proteinG * 4 },
    fat: { g: fatG, kcal: fatG * 9 },
    carbs: { g: carbsG, kcal: carbsG * 4, starchy: starchyG, fibrous: fibrousG },
  };
}

function applyBodyTypeTilt(base: any, bodyType: BodyType, activity: string) {
  if (bodyType === "meso") return base; // mesomorph: no adjustment

  const fibrousG = base.carbs.fibrous as number;
  let starchyG = base.carbs.starchy as number;

  if (bodyType === "endo") {
    // Endomorph: reduce starchy carbs only — fat is never touched
    const shiftPct = activity === "sedentary" ? 0.10 : activity === "light" ? 0.12 : 0.15;
    starchyG = Math.max(0, Math.round(starchyG * (1 - shiftPct)));
  } else if (bodyType === "ecto") {
    // Ectomorph: increase starchy carbs — fat is never touched
    starchyG = Math.round(starchyG * 1.15);
  }

  // Recompute derived totals — fat unchanged, fibrous unchanged
  const carbsG = fibrousG + starchyG;
  const calories = base.protein.g * 4 + carbsG * 4 + base.fat.g * 9;

  return {
    ...base,
    calories,
    carbs: { g: carbsG, kcal: carbsG * 4, starchy: starchyG, fibrous: fibrousG },
  };
}

// Pipeline step 1.5: Input adjustments — clinical flags, activity, waist risk
// Inserted AFTER calcMacrosBase, BEFORE applyStrategyLayer
interface InputAdjConfig {
  age: number;
  activity: string;
  highWaistRisk: boolean;
  menopause: boolean;
  insulinResistance: boolean;
  highStress: boolean;
  mealsPerDay: number;
  fibrousCarbSafetyCap_g: number;
}

function applyInputAdjustments(base: any, cfg: InputAdjConfig) {
  const fibrousBase = base.carbs.fibrous as number;

  // Activity starchy multiplier — direct lever on starchy, not just TDEE
  const ACTIVITY_STARCH: Record<string, number> = {
    sedentary: 0.85,
    light:     0.95,
    moderate:  1.00,
    very:      1.10,
    extra:     1.20,
  };
  let starchyG = Math.round((base.carbs.starchy as number) * (ACTIVITY_STARCH[cfg.activity] ?? 1.0));
  const baselineAfterActivity = starchyG; // snapshot for fibrous scaling

  // Priority-based clinical adjustments — capped stacking, not blind multiplication
  let starchyMult = 1.0;
  let proteinMult = 1.0;
  let fatMult     = 1.0;
  let extraCupsPerMeal = 0;

  // Tier 1 — Insulin Resistance (strongest; waist risk softens when stacked)
  if (cfg.insulinResistance) {
    starchyMult *= 0.60;
    if (cfg.highWaistRisk) starchyMult *= 0.85; // controlled stack, not full 0.75
  } else if (cfg.highWaistRisk) {
    starchyMult *= 0.75;
  }

  // Tier 2 — Age > 55
  if (cfg.age > 55) {
    starchyMult *= 0.90;
    proteinMult *= 1.05;
  }

  // Tier 2 — Menopause
  if (cfg.menopause) {
    starchyMult *= 0.85;
    fatMult     *= 1.10;
  }

  // Tier 3 — High Stress / Poor Sleep
  if (cfg.highStress) {
    starchyMult  *= 0.80;
    proteinMult  *= 1.10;
    extraCupsPerMeal += 1;
  }

  // Hard cap — starchy never drops below 50% of what activity already set
  starchyMult = Math.max(starchyMult, 0.50);

  starchyG = Math.max(0, Math.round(starchyG * starchyMult));
  // Cap at 260g — clinical boosts can raise but never beyond the hard ceiling
  let proteinG = Math.min(260, Math.round((base.protein.g as number) * proteinMult));
  let fatG     = Math.round((base.fat.g as number)     * fatMult);

  // Fibrous scales harder based on how much starchy dropped (not flat +1 cup)
  const starchyReduction = baselineAfterActivity > 0 ? starchyG / baselineAfterActivity : 0;
  if (starchyG === 0) {
    extraCupsPerMeal += 2; // zero starch: maximum vegetable volume
  } else if (starchyReduction < 0.50) {
    extraCupsPerMeal += 2; // deep cut
  } else if (starchyReduction < 0.75) {
    extraCupsPerMeal += 1; // moderate cut
  }

  const addedFibrous = extraCupsPerMeal > 0 ? Math.round(cfg.mealsPerDay * extraCupsPerMeal * 5) : 0;
  const fibrousG = Math.min(cfg.fibrousCarbSafetyCap_g, fibrousBase + addedFibrous);

  const carbsG   = starchyG + fibrousG;
  const calories = proteinG * 4 + carbsG * 4 + fatG * 9;

  return {
    calories,
    protein: { g: proteinG, kcal: proteinG * 4 },
    fat:     { g: fatG,     kcal: fatG * 9 },
    carbs:   { g: carbsG,   kcal: carbsG * 4, starchy: starchyG, fibrous: fibrousG },
  };
}

// Strategy layer configuration
type StrategyConfig = {
  lb: number;
  mealsPerDay: number;
  cutIntensity: CutIntensity;
  cutStyle: CutStyle;
  starchyCarbCap_g: number | null;
  allowZeroStarchyOnLowDay: boolean;
  fibrousCarbSafetyCap_g: number;
  strictMode: boolean;
};

// Pipeline step 2: strategy layer — applied after calcMacrosBase, before bodyType tilt
function applyStrategyLayer(base: any, cfg: StrategyConfig) {
  let proteinG   = base.protein.g as number;
  let fatG       = base.fat.g as number;
  let starchyG   = base.carbs.starchy as number;
  const fibrousBase = Math.min(base.carbs.fibrous as number, cfg.fibrousCarbSafetyCap_g);
  const baselineStarchyG = starchyG; // snapshot before any strategy modifications

  // 1. Hard cut — adjusts protein, starchy, AND fat
  if (cfg.cutIntensity === "hard") {
    proteinG = Math.round(proteinG * 1.1);
    if (cfg.cutStyle === "balanced") {
      starchyG = Math.round(starchyG * 0.7);
      fatG     = Math.round(cfg.lb * 0.30);
    } else if (cfg.cutStyle === "lowCarb") {
      starchyG = Math.round(starchyG * 0.4);
      fatG     = Math.round(cfg.lb * 0.55);
    }
  }

  // 2. Optional starchy cap (post-multiplier)
  if (cfg.starchyCarbCap_g !== null && cfg.starchyCarbCap_g !== undefined) {
    starchyG = Math.min(starchyG, cfg.starchyCarbCap_g);
  }

  // 5. Floor starchy at 0 — it can legally be 0
  starchyG = Math.max(0, Math.round(starchyG));

  // 6. ADAPTIVE FIBROUS — fiber goes UP when starch goes DOWN
  //    Vegetable prescription: cups per meal × meals per day × 5g per cup
  //    Rule: starch drop → more vegetables, never fewer than baseline
  const starchyRatio = baselineStarchyG > 0 ? starchyG / baselineStarchyG : 0;
  let cupsPerMeal: number;
  if (starchyG === 0) {
    cupsPerMeal = 6;    // zero starch day: maximum vegetable volume
  } else if (starchyRatio < 0.25) {
    cupsPerMeal = 5;    // deep cut: high vegetable replacement
  } else if (starchyRatio < 0.5) {
    cupsPerMeal = 4;    // low carb: elevated vegetables
  } else if (starchyRatio < 0.75) {
    cupsPerMeal = 3.5;  // moderate cut: slightly elevated
  } else {
    cupsPerMeal = 3;    // standard day: baseline vegetables (3 cups/meal)
  }
  const computedFibrous = Math.round(cfg.mealsPerDay * cupsPerMeal * 5);
  // Never below baseline, never above safety cap
  const fibrousG = Math.min(cfg.fibrousCarbSafetyCap_g, Math.max(fibrousBase, computedFibrous));
  const vegetableCupsPerDay = Math.round(cfg.mealsPerDay * cupsPerMeal);

  const carbsG   = starchyG + fibrousG;
  const calories = proteinG * 4 + carbsG * 4 + fatG * 9;

  return {
    calories,
    protein: { g: proteinG, kcal: proteinG * 4 },
    fat: { g: fatG, kcal: fatG * 9 },
    carbs: { g: carbsG, kcal: carbsG * 4, starchy: starchyG, fibrous: fibrousG },
    vegetableCupsPerMeal: cupsPerMeal,
    vegetableCupsPerDay,
  };
}

// Pipeline step 4 (final): safety pass — starchy-only correction; strict mode bypasses all
function finalSafetyPass(base: any, { strictMode }: { strictMode: boolean }) {
  if (strictMode) return base; // strict: no adjustments, raw macros only

  let starchyG   = base.carbs.starchy as number;
  const fibrousG = base.carbs.fibrous as number;
  const proteinG = base.protein.g as number;
  const fatG     = base.fat.g as number;

  let carbsG   = starchyG + fibrousG;
  let calories = proteinG * 4 + carbsG * 4 + fatG * 9;

  if (calories < 1200) {
    if (starchyG > 0) {
      starchyG += Math.ceil((1200 - calories) / 4);
      carbsG    = starchyG + fibrousG;
      calories  = proteinG * 4 + carbsG * 4 + fatG * 9;
    } else {
      // starchy already at 0 — flag it, do NOT touch protein/fibrous/fat
      // safetyFallbackAvailable = true (reserved for ProCare / advanced mode)
      return { ...base, safetyFloorUnmet: true, safetyFloorReason: "starchy_at_zero" };
    }
  } else if (calories > 4000) {
    starchyG = Math.max(0, starchyG - Math.ceil((calories - 4000) / 4));
    carbsG   = starchyG + fibrousG;
    calories = proteinG * 4 + carbsG * 4 + fatG * 9;
  }

  return {
    calories,
    protein: { g: proteinG, kcal: proteinG * 4 },
    fat: { g: fatG, kcal: fatG * 9 },
    carbs: { g: carbsG, kcal: carbsG * 4, starchy: starchyG, fibrous: fibrousG },
  };
}

function BodyTypeGuide() {
  return (
    <div className="mb-3">
      <details
        data-wt="mc-bodytype-info"
        className="rounded-xl border border-white/15 bg-white/5 p-3"
      >
        <summary className="cursor-pointer select-none text-sm font-semibold text-white/90">
          Body Type Guide (tap to expand)
        </summary>

        <div className="mt-2 space-y-3 text-sm text-white/80">
          <div>
            <div className="font-semibold text-white">Ectomorph</div>
            <p className="mt-1 leading-relaxed">
              Naturally lean or "hard gainer." Smaller frame, narrower
              shoulders/hips, and tends to struggle gaining weight or muscle.
              Often a faster metabolism.{" "}
              <span className="text-white/90">Strategy:</span> a bit more
              calories and carbs; keep protein protein steady.
            </p>
          </div>

          <div>
            <div className="font-semibold text-white">Mesomorph</div>
            <p className="mt-1 leading-relaxed">
              Athletic middle build—can gain muscle and lose fat more easily.
              Medium frame and usually responds well to training and nutrition
              changes. <span className="text-white/90">Strategy:</span> balanced
              calories and macros; adjust up/down with goals.
            </p>
          </div>

          <div>
            <div className="font-semibold text-white">Endomorph</div>
            <p className="mt-1 leading-relaxed">
              Bigger frame ("full house") that gains weight more easily and may
              lose it more slowly. Often benefits from tighter calorie control
              and mindful carbs.{" "}
              <span className="text-white/90">Strategy:</span> slightly fewer
              starchy carbs, a bit more fat for satiety.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/30 p-2">
            <div className="text-white/90 font-medium text-[13px]">
              How to choose quickly
            </div>
            <ul className="mt-1 list-disc pl-5 space-y-1">
              <li>
                If you've always been naturally thin and struggle to gain →{" "}
                <b>Ectomorph</b>
              </li>
              <li>
                If you build/lean fairly easily with training → <b>Mesomorph</b>
              </li>
              <li>
                If you gain easily and fat loss feels slower → <b>Endomorph</b>
              </li>
            </ul>
            <p className="mt-2 text-[12px] text-white/60">
              Not exact? Pick the one that best matches your history and how
              your body responds. This just sets a smart starting split.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}

// Advance the guided tour to the next step
const advance = (step: string) => {
  const coachMode = localStorage.getItem("coachMode") === "guided";
  if (!coachMode) return;

  window.dispatchEvent(new CustomEvent("macro:nextStep", { detail: { step } }));
};

function BodyCompositionGuidedStep({
  sex,
  goal,
  getStarchyCarbs: getStarch,
  onSkip,
  onContinue,
  onApplyAdjustments,
}: {
  sex: Sex;
  goal: Goal;
  getStarchyCarbs: (s: Sex, g: Goal) => number;
  onSkip: () => void;
  onContinue: () => void;
  onApplyAdjustments?: (deltas: MacroDeltas) => void;
}) {
  const [bodyCompData, setBodyCompData] = useState<{
    currentBF: number;
    goalBF: number | null;
  } | null>(null);

  const userId = getCurrentUser()?.id;

  useEffect(() => {
    if (!userId) return;
    const poll = async () => {
      try {
        const data = await apiRequest(`/api/users/${userId}/body-composition/latest`);
        if (data.entry) {
          setBodyCompData({
            currentBF: parseFloat(data.entry.currentBodyFatPct),
            goalBF: data.entry.goalBodyFatPct ? parseFloat(data.entry.goalBodyFatPct) : null,
          });
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [userId]);

  const baseStarch = getStarch(sex, goal);

  const getStarchImpact = () => {
    if (!bodyCompData || bodyCompData.goalBF === null) return null;
    const { currentBF, goalBF } = bodyCompData;
    if (isNaN(currentBF) || isNaN(goalBF)) return null;
    const diff = currentBF - goalBF;

    if (diff >= 5) {
      return {
        direction: "reduce" as const,
        slots: -1,
        label: "Reducing starchy carbs by 1 slot",
        detail: `You're ${diff.toFixed(1)}% above your goal — we'll cut starchy carbs to help you lean out.`,
        color: "amber",
        newStarch: Math.max(0, baseStarch - 25),
      };
    } else if (diff >= -3 && diff < 5) {
      return {
        direction: "neutral" as const,
        slots: 0,
        label: "Standard starchy carb allocation",
        detail: `You're within range of your goal — your starchy carbs stay at the standard level.`,
        color: "green",
        newStarch: baseStarch,
      };
    } else {
      const isPerformance = goal === "gain";
      return {
        direction: "increase" as const,
        slots: isPerformance ? 1 : 0,
        label: isPerformance
          ? "Adding 1 bonus starch slot for performance"
          : "Standard starchy carb allocation",
        detail: isPerformance
          ? `You're ${Math.abs(diff).toFixed(1)}% below your goal — extra carbs to fuel your performance.`
          : `You're below your goal body fat — starchy carbs stay standard for your current goal.`,
        color: isPerformance ? "blue" : "green",
        newStarch: isPerformance ? baseStarch + 25 : baseStarch,
      };
    }
  };

  const impact = getStarchImpact();

  return (
    <motion.div
      key="guided-body-composition"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4"
    >
      <Card className="bg-zinc-900/80 border border-white/30 text-white">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">
              Body Composition
            </h3>
            <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">
              Optional
            </span>
          </div>

          <p className="text-white/80 text-sm leading-relaxed">
            If you've had your body fat professionally measured — like a DEXA scan, BodPod, calipers, or smart scale — you can add that here. It helps fine-tune your starchy carb allocation in the Beach Body and Performance builders.
          </p>

          <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-200/90">
                Most people don't have this number — and that's perfectly fine. Your macros work great without it. This is only for people who actively track their body composition.
              </p>
            </div>
          </div>

          <BodyCompositionSection onApplyAdjustments={onApplyAdjustments} />

          {impact && bodyCompData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl border ${
                impact.color === "amber"
                  ? "bg-amber-900/20 border-amber-500/30"
                  : impact.color === "blue"
                  ? "bg-blue-900/20 border-blue-500/30"
                  : "bg-emerald-900/20 border-emerald-500/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className={`h-4 w-4 ${
                  impact.color === "amber"
                    ? "text-amber-400"
                    : impact.color === "blue"
                    ? "text-blue-400"
                    : "text-emerald-400"
                }`} />
                <span className={`text-sm font-semibold ${
                  impact.color === "amber"
                    ? "text-amber-200"
                    : impact.color === "blue"
                    ? "text-blue-200"
                    : "text-emerald-200"
                }`}>
                  Starch Impact Preview
                </span>
              </div>
              <p className={`text-xs mb-3 ${
                impact.color === "amber"
                  ? "text-amber-200/80"
                  : impact.color === "blue"
                  ? "text-blue-200/80"
                  : "text-emerald-200/80"
              }`}>
                {impact.detail}
              </p>
              <div className="flex items-center gap-3">
                <div className="text-center flex-1 p-2 bg-black/30 rounded-lg">
                  <div className="text-xs text-white/50 mb-1">Current BF%</div>
                  <div className="text-lg font-bold text-white">{bodyCompData.currentBF}%</div>
                </div>
                <div className="text-white/30">→</div>
                <div className="text-center flex-1 p-2 bg-black/30 rounded-lg">
                  <div className="text-xs text-white/50 mb-1">Goal BF%</div>
                  <div className="text-lg font-bold text-white">{bodyCompData.goalBF}%</div>
                </div>
                <div className="text-white/30">→</div>
                <div className="text-center flex-1 p-2 bg-black/30 rounded-lg">
                  <div className="text-xs text-white/50 mb-1">Starchy Carbs</div>
                  <div className={`text-lg font-bold ${
                    impact.direction === "reduce"
                      ? "text-amber-400"
                      : impact.direction === "increase"
                      ? "text-blue-400"
                      : "text-emerald-400"
                  }`}>
                    {impact.newStarch}g
                    {impact.direction === "reduce" && (
                      <span className="text-xs ml-1">↓</span>
                    )}
                    {impact.direction === "increase" && (
                      <span className="text-xs ml-1">↑</span>
                    )}
                  </div>
                </div>
              </div>
              <p className={`text-xs mt-2 font-medium ${
                impact.color === "amber"
                  ? "text-amber-300"
                  : impact.color === "blue"
                  ? "text-blue-300"
                  : "text-emerald-300"
              }`}>
                {impact.label}
              </p>
            </motion.div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={onSkip}
              variant="outline"
              className="flex-1 py-4 bg-white/5 border-white/20 text-white text-base font-semibold rounded-xl"
            >
              Skip
            </Button>
            <Button
              onClick={onContinue}
              className="flex-1 py-4 bg-blue-600 text-white text-base font-semibold rounded-xl"
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Gender-based starchy carb logic
const getStarchyCarbs = (sex: Sex, goal: Goal) => {
  if (sex === "female") {
    if (goal === "loss") return 25;
    if (goal === "maint") return 50;
    if (goal === "gain") return 75;
  }
  if (sex === "male") {
    if (goal === "loss") return 50;
    if (goal === "maint") return 75;
    if (goal === "gain") return 100;
  }
  return 25;
};

function getFibrousBaseline(weightKg: number): number {
  if (weightKg < 70) return 25;
  if (weightKg < 100) return 30;
  if (weightKg < 130) return 35;
  return 40;
}

function splitStarchyFibrous(totalCarbs: number, starchyBase: number, fibrousMin: number): { starchy: number; fibrous: number } {
  const floor = Math.max(25, Math.round(fibrousMin));
  const safeBase = Math.max(0, Math.round(starchyBase));
  const carbs = Math.max(0, Math.round(totalCarbs));
  const starchy = carbs < floor + safeBase ? Math.max(0, carbs - floor) : safeBase;
  const fibrous = carbs - starchy; // strict reconciliation: no clamping that creates overflow
  return { starchy, fibrous };
}

export default function MacroCounter() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyFirstRenderRef = useRef(true);
  const [isProSession] = useState(() => localStorage.getItem("pro-session") === "true");

  const isFromOnboarding = window.location.search.includes("from=onboarding");

  // usePageWalkthrough('macro-calculator'); // Disabled - conflicts with Copilot intro

  // Load calculator settings from localStorage
  const loadCalculatorSettings = () => {
    try {
      const saved = localStorage.getItem("macro_calculator_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log("📥 Loaded macro settings:", parsed);
        return parsed;
      }
    } catch (error) {
      console.error("Failed to load macro settings:", error);
    }
    return null;
  };

  const savedSettings = loadCalculatorSettings();

  const [goal, setGoal] = useState<Goal>(savedSettings?.goal ?? "maint");
  const [bodyType, setBodyType] = useState<BodyType>(
    savedSettings?.bodyType ?? "meso",
  );
  const [userType, setUserType] = useState<UserType>(
    savedSettings?.userType ?? "general",
  );
  const [units, setUnits] = useState<Units>(savedSettings?.units ?? "imperial");
  const [sex, setSex] = useState<Sex>(savedSettings?.sex ?? "female");
  const [age, setAge] = useState<number>(savedSettings?.age ?? 30);
  const [heightFt, setHeightFt] = useState<number>(
    savedSettings?.heightFt ?? 5,
  );
  const [heightIn, setHeightIn] = useState<number>(
    savedSettings?.heightIn ?? 7,
  );
  const [weightLbs, setWeightLbs] = useState<number>(
    savedSettings?.weightLbs ?? 160,
  );
  const [heightCm, setHeightCm] = useState<number>(
    savedSettings?.heightCm ?? 170,
  );
  const [weightKg, setWeightKg] = useState<number>(
    savedSettings?.weightKg ?? 72.5,
  );
  const [waistIn, setWaistIn] = useState<number>(
    savedSettings?.waistIn ?? 0,
  );
  const [waistCm, setWaistCm] = useState<number>(
    savedSettings?.waistCm ?? 0,
  );
  const [activity, setActivity] = useState<keyof typeof ACTIVITY_FACTORS | "">(
    savedSettings?.activity ?? "sedentary",
  );
  const [proteinPerKg, setProteinPerKg] = useState<number>(
    savedSettings?.proteinPerKg ?? 1.8,
  );
  const [fatPct, setFatPct] = useState<number>(savedSettings?.fatPct ?? 0.3);
  const [sugarCapMode, setSugarCapMode] = useState<"AHA" | "DGA">(
    savedSettings?.sugarCapMode ?? "AHA",
  );
  const [advisorySources, setAdvisorySources] = useState<AdvisorySources>({
    metabolic: null,
    bodyComposition: null,
    waistRisk: null,
  });

  // Clinical flags feed directly into the macro pipeline (applyInputAdjustments)
  const [clinicalFlags, setClinicalFlags] = useState<ClinicalAdvisoryState>(
    () => loadUserAdvisory() || {}
  );

  // Starch Meal Strategy: "one" = 1 starch meal/day, "flex" = split across 2 meals
  // Start with undefined so user must make an active choice (UX improvement)
  const existingTargets = getMacroTargets(user?.id);
  const [starchStrategy, setStarchStrategy] = useState<
    StarchStrategy | undefined
  >(existingTargets?.starchStrategy ?? undefined);

  // Strategy layer state
  const [cutIntensity, setCutIntensity] = useState<CutIntensity>(
    existingTargets?.cutIntensity ?? "standard"
  );
  const [cutStyle, setCutStyle] = useState<CutStyle>(
    existingTargets?.cutStyle ?? "balanced"
  );
  const [starchyCarbCap_g, setStarchyCarbCap_g] = useState<number | null>(
    existingTargets?.starchyCarbCap_g ?? null
  );
  const [allowZeroStarchyOnLowDay] = useState<boolean>(true);
  const fibrousCarbSafetyCap_g = 200;
  const [strictMode, setStrictMode] = useState<boolean>(
    existingTargets?.strictMode ?? false
  );
  const [mealsPerDay, setMealsPerDay] = useState<number>(
    existingTargets?.mealsPerDay ?? 4
  );

  // Guided Mode State
  const hasExistingSettings = savedSettings !== null && !isFromOnboarding;

  const resolveInitialStep = (): GuidedStep => {
    if (hasExistingSettings) return "done";
    try {
      const persisted = sessionStorage.getItem("macro_guided_step");
      if (persisted) {
        const stepOrder: GuidedStep[] = ["entry","goal","commitmentLevel","bodyType","units","sex","age","height","weight","waist","activity","syncWeight","metabolic","results","nutritionStrategy","starch","bodyComposition","save","done"];
        if (stepOrder.includes(persisted as GuidedStep)) return persisted as GuidedStep;
      }
    } catch {}
    return "entry";
  };

  const [guidedStep, setGuidedStepRaw] = useState<GuidedStep>(resolveInitialStep);
  const setGuidedStep = (step: GuidedStep) => {
    setGuidedStepRaw(step);
    try { sessionStorage.setItem("macro_guided_step", step); } catch {}
  };
  const [showResults, setShowResults] = useState(hasExistingSettings || resolveInitialStep() !== "entry");
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasSpokenEntry, setHasSpokenEntry] = useState(resolveInitialStep() !== "entry");
  const [syncingWeight, setSyncingWeight] = useState(false);
  const entrySpokenRef = useRef(resolveInitialStep() !== "entry");

  // Chef Voice for guided walkthrough
  const { speak, stop } = useChefVoice(setIsPlaying);

  // Map of step to voice script - memoized to avoid recreation
  const stepScripts = useMemo<Record<GuidedStep, string>>(
    () => ({
      entry: MACRO_CALC_ENTRY,
      goal: MACRO_CALC_GOAL,
      commitmentLevel: MACRO_CALC_COMMITMENT_LEVEL,
      bodyType: MACRO_CALC_BODY_TYPE,
      units: MACRO_CALC_UNITS,
      sex: MACRO_CALC_SEX,
      age: MACRO_CALC_AGE,
      height: MACRO_CALC_HEIGHT,
      weight: MACRO_CALC_WEIGHT,
      waist: MACRO_CALC_WAIST,
      activity: MACRO_CALC_ACTIVITY,
      syncWeight: MACRO_CALC_SYNC_WEIGHT,
      metabolic: MACRO_CALC_METABOLIC,
      results: MACRO_CALC_RESULTS,
      nutritionStrategy: "",
      starch: MACRO_CALC_STARCH,
      bodyComposition: MACRO_CALC_BODY_COMPOSITION,
      save: MACRO_CALC_SAVE,
      done: MACRO_CALC_DONE,
    }),
    [],
  );

  // Helper to advance to next step with voice
  const advanceGuided = useCallback(
    (nextStep: GuidedStep) => {
      stop(); // Stop any currently playing voice first
      setGuidedStep(nextStep);
      // Speak the script for this step (skip entry since it's handled by mount effect)
      if (nextStep !== "entry") {
        const script = stepScripts[nextStep];
        if (script) {
          speak(script);
        }
      }
      // Smooth scroll to top when advancing
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    },
    [speak, stop, stepScripts],
  );

  // Speak entry script when component mounts in guided mode
  useEffect(() => {
    if (guidedStep === "entry" && !hasExistingSettings && !entrySpokenRef.current) {
      entrySpokenRef.current = true;
      const timer = setTimeout(() => {
        speak(MACRO_CALC_ENTRY);
        setHasSpokenEntry(true);
      }, 500);
      return () => {
        clearTimeout(timer);
        entrySpokenRef.current = false;
      };
    }
  }, [guidedStep, hasExistingSettings, speak]);

  // Cleanup: stop voice when navigating away
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // Prefill from server profile when no saved settings exist (e.g. after reinstall)
  useEffect(() => {
    if (!user) return;
    const hasSaved = !!localStorage.getItem("macro_calculator_settings");
    if (hasSaved) return;

    if (user.age) setAge(user.age);

    if (user.activityLevel) {
      const validActivity = [
        "sedentary", "lightly_active", "moderately_active", "very_active", "extremely_active"
      ];
      if (validActivity.includes(user.activityLevel)) {
        setActivity(user.activityLevel as typeof activity);
      }
    }

    if (user.fitnessGoal) {
      const goalMap: Record<string, Goal> = {
        weight_loss: "loss",
        muscle_gain: "gain",
        maintenance: "maint",
        endurance: "maint",
        lean_gain: "lean_gain",
      };
      const mapped = goalMap[user.fitnessGoal];
      if (mapped) setGoal(mapped);
    }

    // height is stored in cm, weight in lbs
    if (user.height && user.height > 0) {
      setHeightCm(user.height);
      const totalIn = Math.round(user.height / 2.54);
      setHeightFt(Math.floor(totalIn / 12));
      setHeightIn(totalIn % 12);
    }

    if (user.weight && user.weight > 0) {
      setWeightLbs(user.weight);
      setWeightKg(Math.round((user.weight / 2.205) * 10) / 10);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Global click handler: stop voice on any click when playing
  useEffect(() => {
    const handleGlobalClick = () => {
      if (isPlaying) {
        stop();
      }
    };
    // Use capture phase to catch clicks before they bubble
    document.addEventListener("click", handleGlobalClick, true);
    return () => {
      document.removeEventListener("click", handleGlobalClick, true);
    };
  }, [isPlaying, stop]);

  // Reset guided flow to start over
  const resetGuidedFlow = useCallback(() => {
    setHasSpokenEntry(false);
    entrySpokenRef.current = false;
    setGuidedStep("entry");
    setShowResults(false);
  }, []);

  // Check if we're past a certain step (for showing completed items)
  const isPastStep = (step: GuidedStep): boolean => {
    const stepOrder: GuidedStep[] = [
      "entry",
      "goal",
      "bodyType",
      "units",
      "sex",
      "age",
      "height",
      "weight",
      "waist",
      "activity",
      "syncWeight",
      "metabolic",
      "results",
      "nutritionStrategy",
      "starch",
      "bodyComposition",
      "save",
      "done",
    ];
    const currentIndex = stepOrder.indexOf(guidedStep);
    const checkIndex = stepOrder.indexOf(step);
    return currentIndex > checkIndex;
  };

  const macroCalculatorTourSteps: TourStep[] = [
    {
      title: "Choose Your Goal",
      description:
        "Cut = lose weight (15% deficit), Maintain = stay the same, Gain = build muscle (10% surplus).",
    },
    {
      title: "Commitment Level",
      description:
        "General = realistic, sustainable targets for everyday eaters. Committed = higher protein and tighter carb targets for consistent gym-goers. Athlete = maximum protein regardless of goal, built for training load. This shapes your numbers — not how hard the plan is to follow.",
    },
    {
      title: "Select Body Type",
      description:
        "Ectomorph = thin, fast metabolism, higher carb tolerance. Mesomorph = balanced. Endomorph = stores weight more easily, lower carb tolerance.",
    },
    {
      title: "Enter Your Stats",
      description:
        "Age, height, weight, and activity level are used to calculate your baseline calorie needs using the Mifflin formula.",
    },
    {
      icon: "🥔",
      title: "Starch Meal Strategy",
      description:
        "Choose how to manage starchy carbs. One Starch Meal (default) puts all starch in one meal for appetite control. Flex Split divides starch across two meals. Fibrous carbs are unlimited!",
    },
    {
      title: "Optional: Metabolic & Hormone Factors",
      description:
        "If applicable, you can preview how factors like menopause, insulin resistance, or high stress may influence your macro targets. These adjustments are advisory only — you stay in control.",
    },
    {
      title: "Preview & Apply Changes",
      description:
        "Preview shows how these factors would adjust protein, carbs, or fats. Nothing is changed unless you tap Apply.",
    },
    {
      title: "Save Your Macros",
      description:
        "Tap 'Set Macro Targets' to lock them in. Your targets stay persistent on Biometrics until you recalculate or update them.",
    },
    {
      icon: "💡",
      title: "Pro Tip: Time Your Carbs",
      description:
        "Try to eat your starchy carbs earlier in the day. It's harder to get quality REM sleep when your body is busy metabolizing sugars. Front-load your carbs and sleep better.",
    },
    {
      icon: "📐",
      title: "Body Composition (Optional)",
      description:
        "This step is completely optional — most people skip it. If you've had your body fat professionally measured (DEXA, BodPod, calipers, or smart scale), you can enter it here to fine-tune your starchy carb allocation. If you haven't, just skip it — your macros will still work great without it.",
    },
  ];

  const quickTour = useQuickTour("macro-calculator");

  // Walkthrough disabled - conflicts with Copilot intro TTS
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     startSimpleWalkthrough("macro-calculator", [
  //       {
  //         selector: "#goal-card",
  //         text: "Pick your fitness goal - weight loss, maintenance, or muscle gain",
  //         showArrow: true,
  //       },
  //       {
  //         selector: "#bodytype-card",
  //         text: "Pick your body type - ectomorph burns fast, mesomorph is balanced, endomorph holds weight",
  //         showArrow: true,
  //       },
  //       {
  //         selector: "#details-card",
  //         text: "Enter your stats - age, height, weight, and activity level",
  //         showArrow: true,
  //       },
  //       {
  //         selector: "#set-targets-button",
  //         text: "Tap here to save your personalized macros",
  //         showArrow: true,
  //       },
  //     ]);
  //   }, 3000);
  //   return () => clearTimeout(timer);
  // }, []);

  // Nutrition Profile state
  // Save calculator settings to localStorage whenever they change
  useEffect(() => {
    try {
      const settings = {
        goal,
        bodyType,
        userType,
        units,
        sex,
        age,
        heightFt,
        heightIn,
        weightLbs,
        heightCm,
        weightKg,
        waistIn,
        waistCm,
        activity,
        proteinPerKg,
        fatPct,
        sugarCapMode,
      };
      localStorage.setItem(
        "macro_calculator_settings",
        JSON.stringify(settings),
      );
      console.log("💾 Saved macro settings:", settings);
    } catch (error) {
      console.error("Failed to save macro settings:", error);
    }
  }, [
    goal,
    bodyType,
    userType,
    units,
    sex,
    age,
    heightFt,
    heightIn,
    weightLbs,
    heightCm,
    weightKg,
    waistIn,
    waistCm,
    activity,
    proteinPerKg,
    fatPct,
    sugarCapMode,
  ]);

  useEffect(() => {
    if (!user?.id || user.id.startsWith("guest-")) return;
    if (savedSettings?.waistIn || savedSettings?.waistCm) return;
    const ctrl = new AbortController();
    fetch(apiUrl("/api/biometrics/latest"), {
      credentials: "include",
      headers: getAuthHeaders(),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.waist_circumference && data.waist_circumference > 0) {
          const wcCm = data.waist_circumference;
          setWaistCm(Math.round(wcCm * 10) / 10);
          setWaistIn(Math.round(wcCm / 2.54 * 10) / 10);
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [user?.id]);

  useEffect(() => {
    if (isDirtyFirstRenderRef.current) {
      isDirtyFirstRenderRef.current = false;
      return;
    }
    setIsDirty(true);
  }, [goal, bodyType, userType, age, heightFt, heightIn, weightLbs, heightCm, weightKg, waistIn, waistCm, activity, starchStrategy, strictMode, mealsPerDay]);

  const kg = units === "imperial" ? kgFromLbs(weightLbs) : weightKg;
  const cm =
    units === "imperial" ? cmFromFeetInches(heightFt, heightIn) : heightCm;
  const waistVal = units === "imperial" ? waistIn : waistCm;

  const isCalcInputValid =
    age > 0 &&
    cm > 0 &&
    kg > 0 &&
    !!activity;

  const saveWaistToBiometrics = async () => {
    if (!user?.id || user.id.startsWith("guest-")) return;
    try {
      const wUnit = units === "imperial" ? "in" : "cm";
      const wVal = units === "imperial" ? waistIn : waistCm;
      if (!wVal || wVal <= 0) return;
      await fetch(apiUrl("/api/biometrics/ingest"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          samples: [{ type: "waist_circumference", value: wVal, unit: wUnit }],
        }),
      });
    } catch (err) {
      console.error("Failed to save waist to biometrics:", err);
    }
  };

  const saveBiometricsToProfile = async () => {
    if (!user?.id || user.id.startsWith("guest-")) return;
    try {
      const heightVal = Math.round(cm);
      const weightVal = Math.round(kg * 2.205);
      await fetch(apiUrl("/api/users/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          age,
          height: heightVal,
          weight: weightVal,
          activityLevel: activity,
          fitnessGoal: goal,
        }),
      });
      await refreshUser();
    } catch (err) {
      console.error("Failed to save biometrics to profile:", err);
    }
  };

  const results = useMemo(() => {
    if (!isCalcInputValid) return null;

    // BMR / TDEE kept for display purposes only — they no longer drive macro allocation
    const bmr = mifflin({ sex, kg, cm, age });
    const tdee = Math.round(
      bmr * ACTIVITY_FACTORS[activity as keyof typeof ACTIVITY_FACTORS],
    );

    // Macro-first engine — full 5-step pipeline
    const lb = Math.round(kg * 2.20462);

    // Compute waist risk for pipeline (separate from UI advisory)
    const waistCmForPipeline = units === "imperial" ? waistIn * 2.54 : waistCm;
    let highWaistRisk = false;
    if (waistCmForPipeline > 0 && cm > 0) {
      const ratio = calculateWaistHeightRatio(waistCmForPipeline, cm);
      const risk  = classifyWaistRisk(ratio);
      highWaistRisk = risk.level === "red"; // red = waist/height > 0.6 — metabolic high risk
    }

    // Step 1: Base macros (protein → fibrous → starchy → fat → calories)
    const base = calcMacrosBase({ lb, goal, userType });

    // Step 1.5: Input adjustments (age, activity, waist risk, clinical flags)
    const adjResult = applyInputAdjustments(base, {
      age,
      activity: activity || "moderate",
      highWaistRisk,
      menopause:         !!(clinicalFlags.menopause?.enabled),
      insulinResistance: !!(clinicalFlags.insulinResistance?.enabled),
      highStress:        !!(clinicalFlags.highStress?.enabled),
      mealsPerDay,
      fibrousCarbSafetyCap_g,
    });

    // Step 2: Strategy layer (hard cut, carb/fat cycle, starchy cap, adaptive fibrous)
    const stratResult = applyStrategyLayer(adjResult, {
      lb, mealsPerDay, cutIntensity, cutStyle,
      starchyCarbCap_g, allowZeroStarchyOnLowDay, fibrousCarbSafetyCap_g, strictMode,
    });

    // Step 3: Body-type tilt (starchy-only ecto/endo adjustment)
    const tiltResult = applyBodyTypeTilt(stratResult, bodyType, activity);

    // Step 4: Final safety pass (starchy-only correction; honours strictMode)
    const macros = finalSafetyPass(tiltResult, { strictMode });

    return { bmr, tdee, target: macros.calories, macros };
  }, [
    isCalcInputValid, sex, kg, cm, age, activity, goal, bodyType, userType,
    mealsPerDay, cutIntensity, cutStyle,
    starchyCarbCap_g, allowZeroStarchyOnLowDay, fibrousCarbSafetyCap_g, strictMode,
    waistIn, waistCm, units, clinicalFlags,
  ]);

  const estimatedBodyFat = useMemo(() => {
    const waistCmVal = units === "imperial" ? waistIn * 2.54 : waistCm;
    if (!kg || !cm || !waistCmVal || !age || !sex) return null;
    return estimateBodyFatHybrid({ weightKg: kg, heightCm: cm, waistCm: waistCmVal, age, sex });
  }, [kg, cm, waistIn, waistCm, age, sex, units]);

  const saveEstimatedBodyFat = async () => {
    if (!user?.id || user.id.startsWith("guest-") || !estimatedBodyFat) return;
    try {
      const latestRes = await fetch(apiUrl(`/api/users/${user.id}/body-composition/latest`), {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      let existingGoalBF: number | null = null;
      if (latestRes.ok) {
        const latest = await latestRes.json();
        if (latest?.source === "trainer" || latest?.source === "physician") return;
        if (latest?.entry?.goalBodyFatPct) {
          existingGoalBF = parseFloat(latest.entry.goalBodyFatPct);
        }
      }

      await fetch(apiUrl(`/api/users/${user.id}/body-composition`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          currentBodyFatPct: estimatedBodyFat,
          goalBodyFatPct: existingGoalBF,
          scanMethod: "Other",
          source: "client",
          recordedAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("Failed to save estimated body fat:", err);
    }
  };

  const handleQuickSave = async () => {
    if (!results || !isCalcInputValid || isSaving) return;
    setIsSaving(true);
    try {
      const adjustedProtein = Math.max(0, results.macros.protein.g + advisoryDeltas.protein);
      const adjustedCarbs = Math.max(0, results.macros.carbs.g + advisoryDeltas.carbs);
      const adjustedFat = Math.max(0, results.macros.fat.g + advisoryDeltas.fat);
      const fibrousCarbs_g = results.macros.carbs.fibrous;
      const starchyCarbs_g = Math.max(0, adjustedCarbs - fibrousCarbs_g);
      const vegetableCupsPerMeal = (results.macros as any).vegetableCupsPerMeal ?? 3;
      const vegetableCupsPerDay = (results.macros as any).vegetableCupsPerDay ?? (mealsPerDay * 3);
      await setMacroTargets(
        {
          calories: results.target,
          protein_g: adjustedProtein,
          carbs_g: adjustedCarbs,
          fat_g: adjustedFat,
          starchyCarbs_g,
          fibrousCarbs_g,
          starchStrategy,
          cutIntensity,
          cutStyle,
          starchyCarbCap_g,
          allowZeroStarchyOnLowDay,
          fibrousCarbSafetyCap_g,
          strictMode,
          mealsPerDay,
          vegetableCupsPerMeal,
          vegetableCupsPerDay,
        },
        user?.id,
      );
      window.dispatchEvent(new CustomEvent("mpm:targetsUpdated"));
      saveBiometricsToProfile().catch(() => {});
      saveWaistToBiometrics().catch(() => {});
      saveEstimatedBodyFat().catch(() => {});
      setIsDirty(false);
      toast({
        title: "Macro Targets Updated",
        description: "Your daily macro targets have been recalculated and saved.",
      });
    } catch (error) {
      console.error("Failed to update macro targets:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update your macro targets. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const advisoryDeltas = useMemo(() => {
    const raw = sumAdvisorySources(advisorySources);
    if (!results) return raw;
    return capCombinedDeltas(
      {
        protein: results.macros.protein.g,
        carbs: results.macros.carbs.g,
        fat: results.macros.fat.g,
      },
      raw,
    );
  }, [advisorySources, results]);

  // Dispatch "completed" event when results are calculated (500ms debounce)
  useEffect(() => {
    if (!results) return;

    const timeout = setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "macro-calculator-completed", event: "completed" },
      });
      window.dispatchEvent(event);
    }, 500);

    return () => clearTimeout(timeout);
  }, [results]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white pb-32"
      >
        <TrialBanner />
        {/* Universal Safe-Area Header */}
        <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-8 pb-3 flex items-center gap-3">
            {isProSession && (
              <button
                onClick={() => {
                  const returnRoute = localStorage.getItem("pro-return-route") || "/pro/clients";
                  localStorage.removeItem("pro-session");
                  localStorage.removeItem("pro-client-id");
                  localStorage.removeItem("pro-return-route");
                  setLocation(returnRoute);
                }}
                className="flex items-center gap-1 text-purple-400 hover:bg-purple-500/10 px-2 py-1 rounded-lg text-sm font-medium -ml-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Return to Pro Portal
              </button>
            )}
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Macro Calculator</span>
            </h1>

            <div className="flex-grow" />

            <MedicalSourcesInfo asIconButton />
            <QuickTourButton onClick={quickTour.openTour} />
          </div>
        </div>
        </MobileHeaderGuard>

        {/* Main Content */}
        <div
          className="max-w-5xl mx-auto space-y-6 px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          <div className="flex justify-start mb-2">
            <HowThisWorksLink />
          </div>

          {/* Scientific Sources - Apple App Store Compliance (must be visible immediately) */}
          {(guidedStep === "entry" || guidedStep === "goal") && (
            <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-400/30 rounded-xl p-4">
              <p className="text-sm text-white/90 leading-relaxed">
                <span className="font-semibold text-blue-300">
                  Scientific Sources:
                </span>{" "}
                Calculations based on{" "}
                <a
                  href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline font-medium"
                >
                  Mifflin-St Jeor (NCBI/NIH)
                </a>{" "}
                and{" "}
                <a
                  href="https://ods.od.nih.gov/HealthInformation/Dietary_Reference_Intakes.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline font-medium"
                >
                  NIH Dietary Reference Intakes
                </a>
                . Nutrient data from{" "}
                <a
                  href="https://fdc.nal.usda.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline font-medium"
                >
                  USDA FoodData Central
                </a>
                .
              </p>
            </div>
          )}

          {/* GUIDED MODE - Entry Point */}
          <AnimatePresence mode="wait">
            {guidedStep === "entry" && (
              <motion.div
                key="guided-entry"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-6 w-6 text-orange-500" />
                      <h2 className="text-xl font-bold text-white">
                        Welcome to Macro Calculator
                      </h2>
                    </div>
                    <p className="text-white/80 text-sm leading-relaxed">
                      Let's set up your personalized nutrition targets together.
                      I'll walk you through each step to make sure we get it
                      right.
                    </p>
                    <Button
                      onClick={() => advanceGuided("goal")}
                      className="
                        w-full py-4
                        bg-black/30
                        text-white font-semibold text-lg
                        rounded-xl
                        border border-white/60
                      "
                      data-testid="guided-talk-to-chef"
                    >
                      <LifeBuoy className="h-5 w-5 mr-2" />
                      Start Chef-Assisted Setup
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 1: Goal */}
            {guidedStep === "goal" && (
              <motion.div
                key="guided-goal"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">
                        Step 1
                      </h3>
                    </div>
                    <p className="text-white text-base">
                      What are we trying to do with our nutrition? What's your
                      ultimate goal?
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { v: "loss", label: "Cut" },
                        { v: "maint", label: "Maintain" },
                        { v: "gain", label: "Gain" },
                      ].map((g) => (
                        <div
                          key={g.v}
                          onClick={() => {
                            setGoal(g.v as Goal);
                            advanceGuided("commitmentLevel");
                          }}
                          className={`px-3 py-2 border rounded-lg cursor-pointer text-center ${goal === g.v ? "bg-white/15 border-white" : "border-white/40 hover:border-white/70"}`}
                        >
                          {g.label}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 2: Commitment Level */}
            {guidedStep === "commitmentLevel" && (
              <motion.div
                key="guided-commitment"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {/* Completed: Goal */}
                <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                  <p className="text-sm text-white/60">
                    Goal:{" "}
                    {goal === "loss"
                      ? "Cut"
                      : goal === "maint"
                        ? "Maintain"
                        : "Gain"}
                  </p>
                </div>

                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">
                        Step 2
                      </h3>
                    </div>
                    <p className="text-white text-base">
                      What's your commitment level?
                    </p>
                    <p className="text-sm text-white/60">
                      This shapes how aggressive your protein and carb targets are — not how hard the plan is to follow.
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {([
                        {
                          v: "general",
                          label: "General",
                          sub: "Everyday eater — realistic, sustainable targets most people can actually follow.",
                        },
                        {
                          v: "committed",
                          label: "Committed",
                          sub: "Consistent gym-goer or dieter — higher protein, more structured carb targets.",
                        },
                        {
                          v: "athlete",
                          label: "Athlete",
                          sub: "Performance focus — maximum protein regardless of goal, built for training load.",
                        },
                      ] as { v: UserType; label: string; sub: string }[]).map((u) => (
                        <div
                          key={u.v}
                          onClick={() => {
                            setUserType(u.v);
                            advanceGuided("bodyType");
                          }}
                          className={`flex flex-col gap-1 px-4 py-3 border rounded-xl cursor-pointer transition-colors ${userType === u.v ? "bg-orange-500/20 border-orange-400 text-orange-200" : "border-white/30 text-white/80 hover:border-white/60"}`}
                        >
                          <span className="font-semibold text-base">{u.label}</span>
                          <span className="text-xs opacity-70 leading-snug">{u.sub}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 3: Body Type */}
            {guidedStep === "bodyType" && (
              <motion.div
                key="guided-bodytype"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {/* Completed: Goal + Commitment Level */}
                <div className="flex flex-col gap-2">
                  <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                    <p className="text-sm text-white/90 font-medium flex items-center gap-2">
                      <Check className="h-4 w-4 text-lime-500 flex-shrink-0" />
                      Goal:{" "}
                      {goal === "loss"
                        ? "Cut"
                        : goal === "maint"
                          ? "Maintain"
                          : "Gain"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-orange-400/30 bg-orange-500/10 p-3">
                    <p className="text-sm text-orange-200 font-medium flex items-center gap-2">
                      <Check className="h-4 w-4 text-orange-400 flex-shrink-0" />
                      Commitment:{" "}
                      {userType === "general"
                        ? "General"
                        : userType === "committed"
                          ? "Committed"
                          : "Athlete"}
                    </p>
                  </div>
                </div>

                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">
                        Step 3
                      </h3>
                    </div>
                    <p className="text-white text-base">
                      What's your body type?
                    </p>
                    <BodyTypeGuide />
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { v: "ecto", label: "Ecto" },
                        { v: "meso", label: "Meso" },
                        { v: "endo", label: "Endo" },
                      ].map((b) => (
                        <div
                          key={b.v}
                          onClick={() => {
                            setBodyType(b.v as BodyType);
                            advanceGuided("units");
                          }}
                          className={`px-3 py-2 border rounded-lg cursor-pointer text-center ${bodyType === b.v ? "bg-white/15 border-white" : "border-white/40 hover:border-white/70"}`}
                        >
                          {b.label}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 3: Units */}
            {guidedStep === "units" && (
              <motion.div
                key="guided-units"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {/* Completed steps */}
                <div className="space-y-2">
                  <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                    <p className="text-sm text-white/90 font-medium flex items-center gap-2">
                      <Check className="h-4 w-4 text-lime-500" />
                      Goal:{" "}
                      {goal === "loss"
                        ? "Cut"
                        : goal === "maint"
                          ? "Maintain"
                          : "Gain"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                    <p className="text-sm text-white/90 font-medium flex items-center gap-2">
                      <Check className="h-4 w-4 text-lime-500" />
                      Body Type:{" "}
                      {bodyType === "ecto"
                        ? "Ectomorph"
                        : bodyType === "meso"
                          ? "Mesomorph"
                          : "Endomorph"}
                    </p>
                  </div>
                </div>

                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">
                        Step 3
                      </h3>
                    </div>
                    <p className="text-white text-base">
                      What units are you measuring in?
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => {
                          setUnits("imperial");
                          advanceGuided("sex");
                        }}
                        className={`px-3 py-2 border rounded-lg cursor-pointer text-center ${units === "imperial" ? "bg-white/15 border-white" : "border-white/40 hover:border-white/70"}`}
                      >
                        US / Imperial
                      </div>
                      <div
                        onClick={() => {
                          setUnits("metric");
                          advanceGuided("sex");
                        }}
                        className={`px-3 py-2 border rounded-lg cursor-pointer text-center ${units === "metric" ? "bg-white/15 border-white" : "border-white/40 hover:border-white/70"}`}
                      >
                        Metric
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 4: Sex */}
            {guidedStep === "sex" && (
              <motion.div
                key="guided-sex"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">
                        Step 4
                      </h3>
                    </div>
                    <p className="text-white text-base">
                      What is your biological sex? (for metabolic calculations)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => {
                          setSex("female");
                          advanceGuided("age");
                        }}
                        className={`px-3 py-2 border rounded-lg cursor-pointer text-center ${sex === "female" ? "bg-white/15 border-white" : "border-white/40 hover:border-white/70"}`}
                      >
                        Female
                      </div>
                      <div
                        onClick={() => {
                          setSex("male");
                          advanceGuided("age");
                        }}
                        className={`px-3 py-2 border rounded-lg cursor-pointer text-center ${sex === "male" ? "bg-white/15 border-white" : "border-white/40 hover:border-white/70"}`}
                      >
                        Male
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 5: Age */}
            {guidedStep === "age" && (
              <motion.div
                key="guided-age"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">
                        Step 5
                      </h3>
                    </div>
                    <p className="text-white text-base">How old are you?</p>
                    <Input
                      type="number"
                      placeholder="Enter your age..."
                      className="w-full bg-black/60 border-white/30 text-white h-12 text-lg"
                      value={age || ""}
                      onChange={(e) =>
                        setAge(
                          e.target.value === "" ? 0 : toNum(e.target.value),
                        )
                      }
                    />
                    <Button
                      onClick={() => advanceGuided("height")}
                      disabled={!age || age <= 0}
                      className="
                        w-full py-4
                        bg-black/30 
                        text-white font-semibold text-lg
                        rounded-xl
                        border border-white/60
                        disabled:opacity-40 disabled:cursor-not-allowed
                      "
                    >
                      Continue
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 6: Height */}
            {guidedStep === "height" && (
              <motion.div
                key="guided-height"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">
                        Step 6
                      </h3>
                    </div>
                    <p className="text-white text-base">What's your height?</p>
                    {units === "imperial" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm text-white/70 mb-1 block">
                            Feet
                          </label>
                          <Input
                            type="number"
                            placeholder="ft"
                            className="w-full bg-black/60 border-white/30 text-white h-12 text-lg"
                            value={heightFt || ""}
                            onChange={(e) =>
                              setHeightFt(
                                e.target.value === ""
                                  ? 0
                                  : toNum(e.target.value),
                              )
                            }
                          />
                        </div>
                        <div>
                          <label className="text-sm text-white/70 mb-1 block">
                            Inches
                          </label>
                          <Input
                            type="number"
                            placeholder="in"
                            className="w-full bg-black/60 border-white/30 text-white h-12 text-lg"
                            value={heightIn || ""}
                            onChange={(e) =>
                              setHeightIn(
                                e.target.value === ""
                                  ? 0
                                  : toNum(e.target.value),
                              )
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <Input
                        type="number"
                        placeholder="Enter height in cm..."
                        className="w-full bg-black/60 border-white/30 text-white h-12 text-lg"
                        value={heightCm || ""}
                        onChange={(e) =>
                          setHeightCm(
                            e.target.value === "" ? 0 : toNum(e.target.value),
                          )
                        }
                      />
                    )}
                    <Button
                      onClick={() => advanceGuided("weight")}
                      disabled={
                        units === "imperial"
                          ? !heightFt && !heightIn
                          : !heightCm
                      }
                      className="
                        w-full py-4
                        bg-black/30
                        text-white font-semibold text-lg
                        rounded-xl
                        border border-white/60
                        disabled:opacity-40 disabled:cursor-not-allowed
                      "
                    >
                      Continue
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 7: Weight */}
            {guidedStep === "weight" && (
              <motion.div
                key="guided-weight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">
                        Step 7
                      </h3>
                    </div>
                    <p className="text-white text-base">
                      What's your current weight?
                    </p>
                    <Input
                      type="number"
                      placeholder={
                        units === "imperial"
                          ? "Enter weight in lbs..."
                          : "Enter weight in kg..."
                      }
                      className="w-full bg-black/60 border-white/30 text-white h-12 text-lg"
                      value={
                        units === "imperial" ? weightLbs || "" : weightKg || ""
                      }
                      onChange={(e) => {
                        const val =
                          e.target.value === "" ? 0 : toNum(e.target.value);
                        if (units === "imperial") {
                          setWeightLbs(val);
                        } else {
                          setWeightKg(val);
                        }
                      }}
                    />
                    <Button
                      onClick={() => advanceGuided("waist")}
                      disabled={units === "imperial" ? !weightLbs : !weightKg}
                      className="
                        w-full py-4
                        bg-black/30
                        text-white font-semibold text-lg
                        rounded-xl
                        border border-white/60
                        disabled:opacity-40 disabled:cursor-not-allowed
                      "
                    >
                      Continue
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {guidedStep === "waist" && (
              <motion.div
                key="guided-waist"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">
                        Waist Measurement
                      </h3>
                    </div>
                    <p className="text-white text-base">
                      What's your waist circumference?
                    </p>
                    <Input
                      type="number"
                      placeholder={
                        units === "imperial"
                          ? "Enter waist in inches..."
                          : "Enter waist in cm..."
                      }
                      className="w-full bg-black/60 border-white/30 text-white h-12 text-lg"
                      value={
                        units === "imperial" ? waistIn || "" : waistCm || ""
                      }
                      onChange={(e) => {
                        const val =
                          e.target.value === "" ? 0 : toNum(e.target.value);
                        if (units === "imperial") {
                          setWaistIn(val);
                          setWaistCm(Math.round(val * 2.54 * 10) / 10);
                        } else {
                          setWaistCm(val);
                          setWaistIn(Math.round((val / 2.54) * 10) / 10);
                        }
                      }}
                    />
                    <WaistEducationBlock waistCm={waistCm} heightCm={cm} />
                    <Button
                      onClick={() => advanceGuided("activity")}
                      disabled={!waistVal}
                      className="
                        w-full py-4
                        bg-black/30
                        text-white font-semibold text-lg
                        rounded-xl
                        border border-white/60
                        disabled:opacity-40 disabled:cursor-not-allowed
                      "
                    >
                      Continue
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 8: Activity Level */}
            {guidedStep === "activity" && (
              <motion.div
                key="guided-activity"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">
                        Step 8
                      </h3>
                    </div>
                    <p className="text-white text-base">
                      What is your activity level?
                    </p>
                    <div className="space-y-2">
                      {[
                        {
                          v: "sedentary",
                          label: "Sedentary",
                          desc: "Little or no exercise",
                        },
                        { v: "light", label: "Light", desc: "1-3 days/week" },
                        {
                          v: "moderate",
                          label: "Moderate",
                          desc: "3-5 days/week",
                        },
                        {
                          v: "very",
                          label: "Very Active",
                          desc: "6-7 days/week",
                        },
                        { v: "extra", label: "Extra Active", desc: "2x/day" },
                      ].map((a) => (
                        <div
                          key={a.v}
                          onClick={() => {
                            setActivity(a.v as keyof typeof ACTIVITY_FACTORS);
                            advanceGuided("syncWeight");
                          }}
                          className={`w-full px-3 py-2 border rounded-lg cursor-pointer flex justify-between items-center ${activity === a.v ? "bg-white/15 border-white" : "border-white/40 hover:border-white/70"}`}
                        >
                          <span>{a.label}</span>
                          <span className="text-sm opacity-80">{a.desc}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 9: Sync Weight */}
            {guidedStep === "syncWeight" && (
              <motion.div
                key="guided-sync"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">
                        Step 9
                      </h3>
                    </div>
                    <p className="text-white text-base">
                      Would you like to save your weight to biometrics?
                    </p>
                    <p className="text-white/60 text-sm">
                      This helps track your progress and adjust your plan over time.
                    </p>
                    <Button
                      disabled={syncingWeight}
                      onClick={async () => {
                        const weightValue = units === "imperial" ? weightLbs : weightKg;
                        if (!weightValue || weightValue <= 0) {
                          toast({ title: "Enter weight first", description: "Please enter a valid weight before saving.", variant: "destructive" });
                          return;
                        }
                        setSyncingWeight(true);
                        try {
                          const today = new Date().toISOString().split("T")[0];
                          const res = await fetch(apiUrl("/api/biometrics/weight"), {
                            method: "POST",
                            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                            body: JSON.stringify({ value: weightLbs, unit: "lb", localDate: today }),
                          });
                          if (!res.ok) throw new Error("Save failed");
                          toast({ title: "Weight saved to biometrics", description: "Your progress is being tracked." });
                          advanceGuided("metabolic");
                        } catch {
                          toast({ title: "Couldn't save weight", description: "Please try again.", variant: "destructive" });
                        } finally {
                          setSyncingWeight(false);
                        }
                      }}
                      className="w-full py-3 bg-lime-600 border border-lime-300 text-white font-semibold rounded-xl disabled:opacity-60"
                    >
                      <Scale className="h-4 w-4 mr-2" />
                      {syncingWeight ? "Saving…" : "Save Weight to Biometrics"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => advanceGuided("metabolic")}
                      className="w-full text-white/60 hover:text-white"
                    >
                      Skip for Now
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 10: Metabolic Considerations */}
            {guidedStep === "metabolic" && (
              <motion.div
                key="guided-metabolic"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">
                        Step 10
                      </h3>
                    </div>
                    <p className="text-white text-base">
                      Any metabolic or hormonal considerations? These help
                      fine-tune your targets.
                    </p>
                    <p className="text-sm text-white/60">
                      You can adjust these now or skip and do it later.
                    </p>
                    {results && (
                      <WaistRiskSection
                        waistCm={waistCm}
                        heightCm={cm}
                        baseTargets={{
                          protein: results.macros.protein.g,
                          carbs: results.macros.carbs.g,
                          fat: results.macros.fat.g,
                        }}
                        onApplyAdjustments={(deltas) => {
                          setAdvisorySources((prev) => ({
                            ...prev,
                            waistRisk: deltas,
                          }));
                          toast({
                            title: "Adjustments Applied",
                            description:
                              "Waist risk adjustments have been applied.",
                          });
                        }}
                        onClearAdjustments={() => {
                          setAdvisorySources((prev) => ({
                            ...prev,
                            waistRisk: null,
                          }));
                        }}
                      />
                    )}
                    {results && (
                      <MetabolicConsiderations
                        baseTargets={{
                          protein: results.macros.protein.g,
                          carbs: results.macros.carbs.g,
                          fat: results.macros.fat.g,
                        }}
                        onFlagsChange={(flags) => setClinicalFlags(flags)}
                        onApplyAdjustments={(deltas) => {
                          setAdvisorySources((prev) => ({
                            ...prev,
                            metabolic: deltas,
                          }));
                          toast({
                            title: "Adjustments Applied",
                            description:
                              "Your macro targets have been fine-tuned.",
                          });
                        }}
                      />
                    )}
                    <Button
                      onClick={() => {
                        setShowResults(true);
                        advanceGuided("results");
                      }}
                      className="w-full py-4 bg-black/30  border border-white/60 text-white font-semibold text-lg rounded-xl"
                    >
                      Let's See What We Got!
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 11: Results Reveal */}
            {guidedStep === "results" && results && (
              <motion.div
                key="guided-results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-5">
                    <h3 className="text-lg font-semibold flex items-center mb-4">
                      <Target className="h-5 w-5 mr-2 text-emerald-300" />
                      Your Daily Macro Targets
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 mb-2">
                        <div className="text-base font-bold text-white">
                          Total Calories
                        </div>
                        <div className="text-2xl font-bold text-emerald-300">
                          {results.target} kcal
                        </div>
                      </div>
                      <MacroRow
                        label="Protein"
                        grams={Math.max(
                          0,
                          results.macros.protein.g + advisoryDeltas.protein,
                        )}
                      />
                      {(() => {
                        const starchy = results.macros.carbs.starchy;
                        const fibrous = results.macros.carbs.fibrous;
                        const cupsPerMeal = (results.macros as any).vegetableCupsPerMeal ?? 3;
                        const cupsPerDay = (results.macros as any).vegetableCupsPerDay ?? (mealsPerDay * 3);
                        return (
                          <>
                            <MacroRow label="Carbs - Starchy" grams={starchy} />
                            <MacroRow label="Carbs - Fibrous (Vegetables)" grams={fibrous} />
                            <div className="flex items-center justify-between text-xs text-green-400/80 px-1 -mt-1">
                              <span>🥦 {cupsPerMeal} cups/meal · {cupsPerDay} cups/day</span>
                              <span>1 cup ≈ 5g</span>
                            </div>
                          </>
                        );
                      })()}
                      <MacroRow
                        label="Fats"
                        grams={Math.max(
                          0,
                          results.macros.fat.g + advisoryDeltas.fat,
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
                <Button
                  onClick={() => advanceGuided("starch")}
                  className="
                    w-full py-4
                    bg-lime-600
                    text-white font-semibold text-lg
                    rounded-xl
                    border border-white/60
                  "
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {/* GUIDED STEP 12: Nutrition Strategy (hidden — managed via ProCare settings) */}
            {guidedStep === "nutritionStrategy" && (
              <motion.div
                key="guided-nutrition-strategy"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card data-wt="mc-nutrition-strategy" className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 text-xl">⚡</span>
                      <h3 className="text-lg font-semibold text-white">Nutrition Strategy</h3>
                    </div>

                    {/* Meals Per Day */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-white/80">Meals Per Day</p>
                      <p className="text-xs text-white/50">Drives your daily vegetable prescription — more meals = more vegetable volume</p>
                      <div className="space-y-3">
                        {([3, 4, 5] as const).map((n) => (
                          <div key={n} className={`p-4 rounded-xl border transition-all ${mealsPerDay === n ? "bg-black/60 border-white/20" : "bg-white/5 border-white/10"}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium text-white">{n} Meals</span>
                                <p className="text-xs text-white/60 mt-0.5">
                                  {n === 3 ? "3 meals, no snacks — simple structure" : n === 4 ? "3 meals + 1 snack — most common" : "5 smaller meals — frequent fueling"}
                                </p>
                              </div>
                              <PillButton onClick={() => setMealsPerDay(n)} active={mealsPerDay === n}>
                                {mealsPerDay === n ? "On" : "Off"}
                              </PillButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cut Intensity */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-white/80">Cut Intensity</p>
                      <div className="space-y-3">
                        <div className={`p-4 rounded-xl border transition-all ${cutIntensity === "standard" ? "bg-black/60 border-white/20" : "bg-white/5 border-white/10"}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-white">Standard</span>
                              <p className="text-xs text-white/60 mt-0.5">Balanced deficit — recommended for most goals</p>
                            </div>
                            <PillButton onClick={() => setCutIntensity("standard")} active={cutIntensity === "standard"}>
                              {cutIntensity === "standard" ? "On" : "Off"}
                            </PillButton>
                          </div>
                        </div>
                        <div className={`p-4 rounded-xl border transition-all ${cutIntensity === "hard" ? "bg-black/60 border-white/20" : "bg-white/5 border-white/10"}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-white">Hard Cut</span>
                              <p className="text-xs text-white/60 mt-0.5">Aggressive deficit with protein boost</p>
                            </div>
                            <PillButton onClick={() => setCutIntensity("hard")} active={cutIntensity === "hard"}>
                              {cutIntensity === "hard" ? "On" : "Off"}
                            </PillButton>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cut Style — only when hard cut selected */}
                    {cutIntensity === "hard" && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-white/80">Cut Style</p>
                        <div className="space-y-3">
                          <div className={`p-4 rounded-xl border transition-all ${cutStyle === "balanced" ? "bg-black/60 border-white/20" : "bg-white/5 border-white/10"}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium text-white">Balanced</span>
                                <p className="text-xs text-white/60 mt-0.5">Moderate carb reduction, fat held steady</p>
                              </div>
                              <PillButton onClick={() => setCutStyle("balanced")} active={cutStyle === "balanced"}>
                                {cutStyle === "balanced" ? "On" : "Off"}
                              </PillButton>
                            </div>
                          </div>
                          <div className={`p-4 rounded-xl border transition-all ${cutStyle === "lowCarb" ? "bg-black/60 border-white/20" : "bg-white/5 border-white/10"}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium text-white">Low Carb</span>
                                <p className="text-xs text-white/60 mt-0.5">Deep carb cut, fat raised to compensate</p>
                              </div>
                              <PillButton onClick={() => setCutStyle("lowCarb")} active={cutStyle === "lowCarb"}>
                                {cutStyle === "lowCarb" ? "On" : "Off"}
                              </PillButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Starchy Carb Cap (optional) */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-white/80">Starchy Carb Cap <span className="text-white/40 font-normal">(optional)</span></p>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min={0}
                          max={400}
                          placeholder="No cap"
                          value={starchyCarbCap_g ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setStarchyCarbCap_g(v === "" ? null : Math.max(0, parseInt(v) || 0));
                          }}
                          className="w-28 bg-white/10 border-white/20 text-white placeholder:text-white/30"
                        />
                        <span className="text-sm text-white/50">g / day</span>
                        {starchyCarbCap_g !== null && (
                          <button
                            onClick={() => setStarchyCarbCap_g(null)}
                            className="text-xs text-white/40 hover:text-white/70 underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Strict Mode toggle */}
                    <div className={`p-4 rounded-xl border transition-all ${strictMode ? "bg-black/60 border-white/20" : "bg-white/5 border-white/10"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-white">Strict Mode</span>
                          <p className="text-xs text-white/60 mt-0.5">No auto-corrections — raw macros only (competition / ProCare)</p>
                        </div>
                        <PillButton onClick={() => setStrictMode(!strictMode)} active={strictMode} variant="amber">
                          {strictMode ? "On" : "Off"}
                        </PillButton>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={() => advanceGuided("starch")}
                  className="
                    w-full py-4
                    bg-lime-600
                    text-white font-semibold text-lg
                    rounded-xl
                    border border-white/60
                  "
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {/* GUIDED STEP 13: Starch Strategy */}
            {guidedStep === "starch" && (
              <motion.div
                key="guided-starch"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card data-wt="mc-starch-game-plan" className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 text-xl">🌾</span>
                      <h3 className="text-lg font-semibold text-white">
                        Your Starch Game Plan
                      </h3>
                    </div>
                    <p className="text-white text-base">
                      How are you going to eat your starches? One meal or split
                      across two?
                    </p>
                    <div className="space-y-3">
                      <div
                        className={`p-4 rounded-xl border transition-all ${
                          starchStrategy === "one"
                            ? "bg-black/60 border-white/20"
                            : "bg-white/5 border-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">
                              One Starch Meal
                            </span>
                            <span className="text-xs bg-emerald-600 px-2 py-0.5 rounded-full">
                              Recommended
                            </span>
                          </div>
                          <PillButton
                            onClick={() => {
                              setStarchStrategy("one");
                              advanceGuided("bodyComposition");
                            }}
                            active={starchStrategy === "one"}
                          >
                            {starchStrategy === "one" ? "On" : "Off"}
                          </PillButton>
                        </div>
                        <p className="text-xs text-white/60">
                          All starches in one meal - best for appetite control
                        </p>
                      </div>

                      <div
                        className={`p-4 rounded-xl border transition-all ${
                          starchStrategy === "flex"
                            ? "bg-black/60 border-white/20"
                            : "bg-white/5 border-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white">
                            Flex Split
                          </span>
                          <PillButton
                            onClick={() => {
                              setStarchStrategy("flex");
                              advanceGuided("bodyComposition");
                            }}
                            active={starchStrategy === "flex"}
                          >
                            {starchStrategy === "flex" ? "On" : "Off"}
                          </PillButton>
                        </div>
                        <p className="text-xs text-white/60">
                          Split starches across two meals
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 14: Body Composition (Optional) */}
            {guidedStep === "bodyComposition" && (
              <BodyCompositionGuidedStep
                sex={sex}
                goal={goal}
                getStarchyCarbs={getStarchyCarbs}
                onSkip={() => advanceGuided("save")}
                onContinue={() => advanceGuided("save")}
                onApplyAdjustments={(deltas) => {
                  setAdvisorySources((prev) => ({
                    ...prev,
                    bodyComposition: deltas,
                  }));
                  toast({
                    title: "Adjustments Applied",
                    description:
                      "Body composition adjustments have been applied to your macros.",
                  });
                }}
              />
            )}

            {/* GUIDED STEP 14: Final Save */}
            {guidedStep === "save" && results && (
              <motion.div
                key="guided-save"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-zinc-900/80 border border-white/30 text-white">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-lime-500" />
                      <h3 className="text-lg font-semibold text-white">
                        All Set!
                      </h3>
                    </div>
                    <p className="text-white text-base">
                      Your personalized macro targets are ready. Save them and
                      head to your meal builder!
                    </p>

                    {/* Summary */}
                    <div className="bg-black/40 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/70">Calories:</span>
                        <span className="text-white font-semibold">
                          {results.target} kcal
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/70">Protein:</span>
                        <span className="text-white font-semibold">
                          {Math.max(
                            0,
                            results.macros.protein.g + advisoryDeltas.protein,
                          )}
                          g
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/70">Carbs:</span>
                        <span className="text-white font-semibold">
                          {Math.max(
                            0,
                            results.macros.carbs.g + advisoryDeltas.carbs,
                          )}
                          g
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/70">Fats:</span>
                        <span className="text-white font-semibold">
                          {Math.max(
                            0,
                            results.macros.fat.g + advisoryDeltas.fat,
                          )}
                          g
                        </span>
                      </div>
                    </div>

                    <Button
                      disabled={!isCalcInputValid || isSaving}
                      onClick={async () => {
                        setIsSaving(true);
                        try {
                          const adjustedProtein = Math.max(
                            0,
                            results.macros.protein.g + advisoryDeltas.protein,
                          );
                          const adjustedCarbs = Math.max(
                            0,
                            results.macros.carbs.g + advisoryDeltas.carbs,
                          );
                          const adjustedFat = Math.max(
                            0,
                            results.macros.fat.g + advisoryDeltas.fat,
                          );
                          const fibrousCarbs_g = results.macros.carbs.fibrous;
                          const starchyCarbs_g = Math.max(0, adjustedCarbs - fibrousCarbs_g);
                          const vegetableCupsPerMeal = (results.macros as any).vegetableCupsPerMeal ?? 3;
                          const vegetableCupsPerDay = (results.macros as any).vegetableCupsPerDay ?? (mealsPerDay * 3);

                          await setMacroTargets(
                            {
                              calories: results.target,
                              protein_g: adjustedProtein,
                              carbs_g: adjustedCarbs,
                              fat_g: adjustedFat,
                              starchyCarbs_g,
                              fibrousCarbs_g,
                              starchStrategy,
                              cutIntensity,
                              cutStyle,
                              starchyCarbCap_g,
                              allowZeroStarchyOnLowDay,
                              fibrousCarbSafetyCap_g,
                              strictMode,
                              mealsPerDay,
                              vegetableCupsPerMeal,
                              vegetableCupsPerDay,
                            },
                            user?.id,
                          );

                          window.dispatchEvent(
                            new CustomEvent("mpm:targetsUpdated"),
                          );

                          if (isGuestMode()) {
                            markMacrosCompleted();
                          }

                          const assignedBuilder =
                            getAssignedBuilderFromStorage();
                          toast({
                            title: "Macro Targets Set!",
                            description: `Heading to ${assignedBuilder.name} to build your meals.`,
                          });

                          advanceGuided("done");
                          try { sessionStorage.removeItem("macro_guided_step"); } catch {}
                          setLocation(assignedBuilder.path);

                          saveBiometricsToProfile().catch(() => {});
                          saveWaistToBiometrics().catch(() => {});
                          saveEstimatedBodyFat().catch(() => {});
                        } catch (error) {
                          console.error("Failed to save macro targets:", error);
                          toast({
                            title: "Save Failed",
                            description:
                              "Failed to save your macro targets. Please try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      className="w-full py-4 bg-lime-600  border border-lime-300 text-white font-semibold text-lg rounded-xl"
                    >
                      <ChefHat className="h-5 w-5 mr-2" />
                      {isSaving ? "Saving..." : "Save & Go to Meal Builder"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* FULL CALCULATOR VIEW - Only shown after guided flow is complete OR if user has existing settings */}
          {guidedStep === "done" && (
            <>
              {/* Quick Edit fixed summary bar — always visible, never scrolls */}
              {results && (
                <div
                  className="fixed left-0 md:left-60 right-0 z-40 bg-black/85 backdrop-blur-md border-b border-white/10 px-4 py-3"
                  style={{ top: "calc(env(safe-area-inset-top, 0px) + 56px)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-lime-400" />
                      <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">Your Macros</span>
                      <span className="text-[10px] text-lime-400/80 bg-lime-400/10 px-1.5 py-0.5 rounded-full">Live update</span>
                    </div>
                    <Button
                      size="sm"
                      disabled={!isDirty || !isCalcInputValid || isSaving}
                      onClick={handleQuickSave}
                      className={`text-white font-semibold text-xs rounded-lg px-3 py-1.5 h-auto disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 ${isDirty && isCalcInputValid ? "bg-lime-600 hover:bg-lime-500 ring-2 ring-orange-400 shadow-[0_0_14px_rgba(251,146,60,0.55)] animate-pulse" : "bg-lime-600 hover:bg-lime-500"}`}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      {isSaving ? "Saving..." : isDirty ? "Update Macros" : "Saved"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Calories", value: `${results.target}`, unit: "kcal" },
                      { label: "Protein", value: `${Math.max(0, results.macros.protein.g + advisoryDeltas.protein)}`, unit: "g" },
                      { label: "Carbs", value: `${Math.max(0, results.macros.carbs.g + advisoryDeltas.carbs)}`, unit: "g" },
                      { label: "Fat", value: `${Math.max(0, results.macros.fat.g + advisoryDeltas.fat)}`, unit: "g" },
                    ].map((m) => (
                      <div key={m.label} className="bg-white/5 rounded-lg px-2 py-1.5 text-center">
                        <div className="text-white font-bold text-sm leading-tight">{m.value}<span className="text-[10px] text-white/50 ml-0.5">{m.unit}</span></div>
                        <div className="text-[10px] text-white/50 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Spacer matching the fixed bar height so content isn't hidden underneath */}
              {results && <div className="h-28" />}

              {/* Recalculate with Chef Button */}
              <Card className="bg-black/30 backdrop-blur-lg border border-lime-500/30 shadow-lg">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ChefHat className="h-6 w-6 text-lime-500" />
                    <div>
                      <p className="text-white font-medium">
                        Need to recalculate?
                      </p>
                      <p className="text-white/60 text-sm">
                        Walk through the setup again with Chef
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={resetGuidedFlow}
                    variant="outline"
                    className="bg-black/60 text-white  border border-white/60 hover:bg-black/80 hover:text-white"
                    data-testid="recalculate-with-chef"
                  >
                    <ChefHat className="h-4 w-4 mr-2 text-white" />
                    Recalculate
                  </Button>
                </CardContent>
              </Card>

              {/* Apple 1.4.1 Compliance: Prominent citation banner - MUST be visible */}
              <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-400/30 rounded-xl p-4">
                <p className="text-sm text-white/90 leading-relaxed">
                  <span className="font-semibold text-blue-300">
                    Scientific Sources:
                  </span>{" "}
                  Calculations based on{" "}
                  <a
                    href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline font-medium"
                  >
                    Mifflin-St Jeor (NCBI/NIH)
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://ods.od.nih.gov/HealthInformation/Dietary_Reference_Intakes.aspx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline font-medium"
                  >
                    NIH Dietary Reference Intakes
                  </a>
                  . Nutrient data from{" "}
                  <a
                    href="https://fdc.nal.usda.gov/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline font-medium"
                  >
                    USDA FoodData Central
                  </a>
                  .
                </p>
              </div>

              {/* ⚠️ RENDER GUARD: Goal & Body Type cards MUST ALWAYS render */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card
                  id="goal-card"
                  className="bg-zinc-900/80 border border-white/30 text-white"
                >
                  <CardContent className="p-5">
                    <h3 className="text-lg font-semibold flex items-center">
                      <Activity className="h-5 w-5 mr-2 text-emerald-300" />
                      Choose Your Goal
                    </h3>
                    <RadioGroup
                      data-testid="macro-goal"
                      value={goal}
                      onValueChange={(v: Goal) => {
                        setGoal(v);
                        advance("goal");
                      }}
                      className="mt-3 grid grid-cols-3 gap-3"
                    >
                      {[
                        { v: "loss", label: "Cut" },
                        { v: "maint", label: "Maintain" },
                        { v: "gain", label: "Gain" },
                      ].map((g) => (
                        <Label
                          key={g.v}
                          htmlFor={g.v}
                          onClick={() => {
                            setGoal(g.v as Goal);
                            advance("goal");
                            // Auto-scroll to body type card on every click
                            setTimeout(() => {
                              const bodyCard =
                                document.getElementById("bodytype-card");
                              if (bodyCard) {
                                bodyCard.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                              }
                            }, 200);
                          }}
                          className={`px-3 py-2 border rounded-lg cursor-pointer text-center ${goal === g.v ? "bg-white/15 border-white" : "border-white/40 hover:border-white/70"}`}
                        >
                          <RadioGroupItem
                            id={g.v}
                            value={g.v}
                            className="sr-only"
                          />
                          {g.label}
                        </Label>
                      ))}
                    </RadioGroup>
                  </CardContent>
                </Card>

                <Card
                  id="bodytype-card"
                  className="bg-zinc-900/80 border border-white/30 text-white"
                >
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-lg font-semibold flex items-center">
                      <User2 className="h-5 w-5 mr-2 text-pink-300" />
                      Commitment Level
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { v: "general",   label: "General",   sub: "Everyday habits" },
                        { v: "committed", label: "Committed", sub: "Consistent dieter" },
                        { v: "athlete",   label: "Athlete",   sub: "Performance focus" },
                      ] as { v: UserType; label: string; sub: string }[]).map((u) => (
                        <div
                          key={u.v}
                          onClick={() => setUserType(u.v)}
                          className={`px-2 py-3 border rounded-lg cursor-pointer text-center ${userType === u.v ? "bg-orange-500/20 border-orange-400 text-orange-300" : "border-white/30 text-white/70 hover:border-white/60"}`}
                        >
                          <div className="text-sm font-semibold">{u.label}</div>
                          <div className="text-[11px] opacity-70 mt-0.5">{u.sub}</div>
                        </div>
                      ))}
                    </div>

                    <h3 className="text-lg font-semibold flex items-center pt-1">
                      <User2 className="h-5 w-5 mr-2 text-pink-300" />
                      What's Your Body Type
                    </h3>
                    <BodyTypeGuide />
                    <RadioGroup
                      data-testid="macro-body-type-selector"
                      value={bodyType}
                      onValueChange={(v: BodyType) => {
                        setBodyType(v);
                        advance("body-type");
                      }}
                      className="mt-3 grid grid-cols-3 gap-3"
                    >
                      {[
                        { v: "ecto", label: "Ecto" },
                        { v: "meso", label: "Meso" },
                        { v: "endo", label: "Endo" },
                      ].map((b) => (
                        <Label
                          key={b.v}
                          htmlFor={b.v}
                          onClick={() => {
                            setBodyType(b.v as BodyType);
                            advance("body-type");
                            // Auto-scroll to details card on every click
                            setTimeout(() => {
                              const detailsCard =
                                document.getElementById("details-card");
                              if (detailsCard) {
                                detailsCard.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                              }
                            }, 200);
                          }}
                          className={`px-3 py-2 border rounded-lg cursor-pointer text-center ${bodyType === b.v ? "bg-white/15 border-white" : "border-white/40 hover:border-white/70"}`}
                        >
                          <RadioGroupItem
                            id={b.v}
                            value={b.v}
                            className="sr-only"
                          />
                          {b.label}
                        </Label>
                      ))}
                    </RadioGroup>
                  </CardContent>
                </Card>
              </div>

              {/* ⚠️ RENDER GUARD: This card MUST ALWAYS render - DO NOT wrap in conditionals */}
              {/* Inputs - Always show */}
              <Card
                id="details-card"
                data-testid="macro-details-card"
                className="bg-zinc-900/80 rounded-2xl border border-white/30 text-white mt-5"
              >
                <CardContent className="p-5">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Ruler className="h-5 w-5 mr-2" /> Your Details
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-3">
                      <div className="text-xs text-white font-semibold">
                        Units
                      </div>
                      <RadioGroup
                        data-wt="mc-units-toggle"
                        value={units}
                        onValueChange={(v: Units) => setUnits(v)}
                        className="grid grid-cols-2 gap-2"
                      >
                        {(["imperial", "metric"] as const).map((u) => (
                          <Label
                            key={u}
                            htmlFor={`u-${u}`}
                            className={`px-3 py-2 border rounded-lg text-sm cursor-pointer text-white ${
                              units === u
                                ? "border-white bg-white/15"
                                : "border-white/40 hover:border-white/70"
                            }`}
                          >
                            <RadioGroupItem
                              id={`u-${u}`}
                              value={u}
                              className="sr-only"
                            />
                            {u === "imperial" ? "US / Imperial" : "Metric"}
                          </Label>
                        ))}
                      </RadioGroup>

                      <div className="text-xs text-white font-semibold">
                        Sex
                      </div>
                      <RadioGroup
                        data-wt="mc-sex-selector"
                        value={sex}
                        onValueChange={(v: Sex) => setSex(v)}
                        className="grid grid-cols-2 gap-2"
                      >
                        {(["female", "male"] as const).map((s) => (
                          <Label
                            key={s}
                            htmlFor={`sex-${s}`}
                            className={`px-3 py-2 border rounded-lg text-sm cursor-pointer text-white ${
                              sex === s
                                ? "border-white bg-white/15"
                                : "border-white/40 hover:border-white/70"
                            }`}
                          >
                            <RadioGroupItem
                              id={`sex-${s}`}
                              value={s}
                              className="sr-only"
                            />
                            {s}
                          </Label>
                        ))}
                      </RadioGroup>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-3">
                          <div className="text-xs text-white font-semibold">
                            Age
                          </div>
                          <Input
                            data-testid="macro-age"
                            type="number"
                            className="bg-black/60 border-white/50 text-white placeholder-white"
                            value={age || ""}
                            onChange={(e) =>
                              setAge(
                                e.target.value === ""
                                  ? 0
                                  : toNum(e.target.value),
                              )
                            }
                          />
                        </div>

                        {units === "imperial" ? (
                          <>
                            <div>
                              <div className="text-xs text-white font-semibold">
                                Height (ft)
                              </div>
                              <Input
                                data-testid="macro-height"
                                type="number"
                                className="bg-black/60 border-white/50 text-white placeholder-white"
                                value={heightFt || ""}
                                onChange={(e) =>
                                  setHeightFt(
                                    e.target.value === ""
                                      ? 0
                                      : toNum(e.target.value),
                                  )
                                }
                              />
                            </div>
                            <div>
                              <div className="text-xs text-white font-semibold">
                                Height (in)
                              </div>
                              <Input
                                data-testid="macro-height"
                                type="number"
                                className="bg-black/60 border-white/50 text-white placeholder-white"
                                value={heightIn || ""}
                                onChange={(e) =>
                                  setHeightIn(
                                    e.target.value === ""
                                      ? 0
                                      : toNum(e.target.value),
                                  )
                                }
                              />
                            </div>
                            <div>
                              <div className="text-xs text-white font-semibold">
                                Weight (lbs)
                              </div>
                              <Input
                                data-testid="macro-weight"
                                type="number"
                                className="bg-black/60 border-white/50 text-white placeholder-white"
                                value={weightLbs || ""}
                                onChange={(e) =>
                                  setWeightLbs(
                                    e.target.value === ""
                                      ? 0
                                      : toNum(e.target.value),
                                  )
                                }
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="col-span-2">
                              <div className="text-xs text-white font-semibold">
                                Height (cm)
                              </div>
                              <Input
                                type="number"
                                className="bg-black/60 border-white/50 text-white placeholder-white"
                                value={heightCm || ""}
                                onChange={(e) =>
                                  setHeightCm(
                                    e.target.value === ""
                                      ? 0
                                      : toNum(e.target.value),
                                  )
                                }
                              />
                            </div>
                            <div>
                              <div className="text-xs text-white font-semibold">
                                Weight (kg)
                              </div>
                              <Input
                                type="number"
                                className="bg-black/60 border-white/50 text-white placeholder-white"
                                value={weightKg || ""}
                                onChange={(e) =>
                                  setWeightKg(
                                    e.target.value === ""
                                      ? 0
                                      : toNum(e.target.value),
                                  )
                                }
                              />
                            </div>
                          </>
                        )}

                        <div className="col-span-3">
                          <div className="text-xs text-white font-semibold">
                            Waist ({units === "imperial" ? "in" : "cm"})
                          </div>
                          <Input
                            data-testid="macro-waist"
                            type="number"
                            placeholder={units === "imperial" ? "e.g. 32" : "e.g. 81"}
                            className="bg-black/60 border-white/50 text-white placeholder-white/50"
                            value={
                              units === "imperial"
                                ? waistIn || ""
                                : waistCm || ""
                            }
                            onChange={(e) => {
                              const v =
                                e.target.value === ""
                                  ? 0
                                  : toNum(e.target.value);
                              if (units === "imperial") {
                                setWaistIn(v);
                                setWaistCm(
                                  Math.round(v * 2.54 * 10) / 10,
                                );
                              } else {
                                setWaistCm(v);
                                setWaistIn(
                                  Math.round((v / 2.54) * 10) / 10,
                                );
                              }
                            }}
                          />
                          {!waistVal && (
                            <p className="text-xs text-white/50 mt-1">
                              Optional — add for deeper metabolic insights
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="col-span-6 mt-1">
                        <WaistEducationBlock waistCm={waistCm} heightCm={cm} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs text-white font-semibold">
                        Activity
                      </div>
                      <RadioGroup
                        data-testid="macro-activity-selector"
                        value={activity}
                        onValueChange={(v: keyof typeof ACTIVITY_FACTORS) => {
                          setActivity(v);
                          advance("details");
                          // Auto-scroll to Sync Weight button after activity is selected
                          setTimeout(() => {
                            const button =
                              document.getElementById("sync-weight-button");
                            if (button) {
                              button.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                            }
                          }, 300);
                        }}
                        className="grid grid-cols-2 md:grid-cols-3 gap-2"
                      >
                        {(
                          [
                            ["sedentary", "Sedentary"],
                            ["light", "Light"],
                            ["moderate", "Moderate"],
                            ["very", "Very Active"],
                            ["extra", "Extra"],
                          ] as const
                        ).map(([k, label]) => (
                          <Label
                            key={k}
                            htmlFor={`act-${k}`}
                            onClick={() => {
                              setActivity(k);
                              advance("details");
                              // Auto-scroll to Sync Weight button on every click
                              setTimeout(() => {
                                const button =
                                  document.getElementById("sync-weight-button");
                                if (button) {
                                  button.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center",
                                  });
                                }
                              }, 300);
                            }}
                            className={`px-3 py-2 border rounded-lg text-sm cursor-pointer text-white ${
                              activity === k
                                ? "border-white bg-white/15"
                                : "border-white/40 hover:border-white/70"
                            }`}
                          >
                            <RadioGroupItem
                              id={`act-${k}`}
                              value={k}
                              className="sr-only"
                            />
                            {label}
                          </Label>
                        ))}
                      </RadioGroup>

                      {/* Sync Weight Button - appears after activity is selected */}
                      {activity && (
                        <Button
                          data-testid="macro-sync-weight-button"
                          id="sync-weight-button"
                          onClick={() => {
                            const weight =
                              units === "imperial" ? weightLbs : weightKg;
                            if (!weight || weight <= 0) {
                              toast({
                                title: "Enter weight first",
                                description:
                                  "Please enter a valid weight before syncing.",
                                variant: "destructive",
                              });
                              return;
                            }
                            localStorage.setItem(
                              "pending-weight-sync",
                              JSON.stringify({
                                weight,
                                units,
                                timestamp: Date.now(),
                              }),
                            );
                            toast({
                              title: "✓ Weight ready to sync",
                              description:
                                "Go to My Biometrics to save it to your history.",
                            });
                            advance("sync-weight");
                          }}
                          className="w-full bg-lime-700 border-2 border-lime-300 text-white hover:bg-lime-800 hover:border-lime-300 font-semibold mt-4"
                        >
                          <Scale className="h-4 w-4 mr-2" />
                          Save Weight To Biometrics
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {results && (
                <WaistRiskSection
                  waistCm={waistCm}
                  heightCm={cm}
                  baseTargets={{
                    protein: results.macros.protein.g,
                    carbs: results.macros.carbs.g,
                    fat: results.macros.fat.g,
                  }}
                  onApplyAdjustments={(deltas) => {
                    setAdvisorySources((prev) => ({
                      ...prev,
                      waistRisk: deltas,
                    }));
                    toast({
                      title: "Adjustments Applied",
                      description:
                        "Waist risk adjustments have been applied to your macros.",
                    });
                  }}
                  onClearAdjustments={() => {
                    setAdvisorySources((prev) => ({
                      ...prev,
                      waistRisk: null,
                    }));
                    toast({
                      title: "Adjustment Cleared",
                      description:
                        "Waist risk adjustments have been removed.",
                    });
                  }}
                />
              )}

              {/* Metabolic & Hormonal Considerations - V1 Clinical Advisory */}
              {results && (
                <MetabolicConsiderations
                  baseTargets={{
                    protein: results.macros.protein.g,
                    carbs: results.macros.carbs.g,
                    fat: results.macros.fat.g,
                  }}
                  onFlagsChange={(flags) => setClinicalFlags(flags)}
                  onApplyAdjustments={(deltas) => {
                    setAdvisorySources((prev) => ({
                      ...prev,
                      metabolic: deltas,
                    }));
                    toast({
                      title: "Adjustments Applied",
                      description:
                        "Your macro targets have been fine-tuned based on your metabolic considerations.",
                    });
                  }}
                />
              )}

              {/* Body Composition - affects starchy carb allocation */}
              {results && (
                <BodyCompositionSection
                  onApplyAdjustments={(deltas) => {
                    setAdvisorySources((prev) => ({
                      ...prev,
                      bodyComposition: deltas,
                    }));
                    toast({
                      title: "Adjustments Applied",
                      description:
                        "Your macro targets have been adjusted based on your body composition.",
                    });
                  }}
                />
              )}

              {/* Results - Only show when activity is selected */}
              {results && (
                <>
                  <Card
                    data-testid="macro-results"
                    className="bg-zinc-900/80 border border-white/30 text-white"
                  >
                    <CardContent className="p-5">
                      <h3 className="text-lg font-semibold flex items-center mb-2">
                        <Target className="h-5 w-5 mr-2 text-emerald-300" />{" "}
                        Your Daily Macro Targets
                      </h3>
                      {/* Apple 1.4.1 Compliance: Inline citation BEFORE results for maximum visibility */}
                      <p className="text-xs text-white/70 mb-4 leading-relaxed">
                        Calculated using the{" "}
                        <a
                          href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-lime-400 underline"
                        >
                          Mifflin–St Jeor equation
                        </a>{" "}
                        and{" "}
                        <a
                          href="https://ods.od.nih.gov/HealthInformation/Dietary_Reference_Intakes.aspx"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-lime-400 underline"
                        >
                          NIH Dietary Reference Intakes
                        </a>
                        .
                      </p>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 mb-2">
                          <div className="text-base font-bold text-white">
                            Total Calories
                          </div>
                          <div className="text-2xl font-bold text-emerald-300">
                            {results.target} kcal
                          </div>
                        </div>
                        <MacroRow
                          label="Protein"
                          grams={Math.max(
                            0,
                            results.macros.protein.g + advisoryDeltas.protein,
                          )}
                        />
                        {(() => {
                          const starchy = results.macros.carbs.starchy;
                          const fibrous = results.macros.carbs.fibrous;
                          const cupsPerMeal = (results.macros as any).vegetableCupsPerMeal ?? 3;
                          const cupsPerDay = (results.macros as any).vegetableCupsPerDay ?? (mealsPerDay * 3);
                          return (
                            <>
                              <MacroRow label="Carbs - Starchy" grams={starchy} />
                              <MacroRow label="Carbs - Fibrous (Vegetables)" grams={fibrous} />
                              <div className="flex items-center justify-between text-xs text-green-400/80 px-1 -mt-1">
                                <span>🥦 {cupsPerMeal} cups/meal · {cupsPerDay} cups/day</span>
                                <span>1 cup ≈ 5g</span>
                              </div>
                            </>
                          );
                        })()}
                        <MacroRow
                          label="Fats"
                          grams={Math.max(
                            0,
                            results.macros.fat.g + advisoryDeltas.fat,
                          )}
                        />
                      </div>

                      {/* Secondary methodology link - Primary citation is ABOVE results */}
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <p className="text-xs text-white/50 leading-relaxed mb-2">
                          Detailed methodology and clinical references available
                          below.
                        </p>
                        <MedicalSourcesInfo
                          trigger={
                            <button className="text-xs text-lime-400/80 hover:text-lime-400 underline flex items-center gap-1">
                              <Info className="w-3 h-3" /> View all sources &
                              methodology
                            </button>
                          }
                        />
                      </div>

                      <Button
                        disabled={!isDirty || !isCalcInputValid || isSaving}
                        onClick={handleQuickSave}
                        className={`w-full mt-4 text-white font-semibold text-base rounded-xl disabled:opacity-40 transition-all duration-300 ${isDirty && isCalcInputValid ? "bg-lime-600 ring-2 ring-orange-400 shadow-[0_0_18px_rgba(251,146,60,0.55)] animate-pulse" : "bg-lime-600"}`}
                        data-testid="macro-update-button"
                      >
                        <Target className="h-4 w-4 mr-2" />
                        {isSaving ? "Updating..." : isDirty ? "Update Macros" : "Saved"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Starch Meal Strategy - Your Starch Game Plan */}
                  <Card className="bg-zinc-900/80 border border-amber-500/30 text-white">
                    <CardContent className="p-5">
                      <h3 className="text-lg font-semibold flex items-center mb-3">
                        <span className="text-amber-400 mr-2">🌾</span> Your
                        Starch Game Plan
                      </h3>
                      <p className="text-sm text-white/70 mb-4">
                        Starchy carbs (rice, pasta, potatoes, bread) need to be
                        managed. Choose how you'll use your daily starch budget:
                      </p>

                      <div className="space-y-3">
                        <div
                          className={`p-4 rounded-xl border transition-all ${
                            starchStrategy === "one"
                              ? "bg-black/60 border-white/20"
                              : "bg-white/5 border-white/10"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                One Starch Meal
                              </span>
                              <span className="text-xs bg-emerald-600 px-2 py-0.5 rounded-full">
                                Recommended
                              </span>
                            </div>
                            <PillButton
                              onClick={() => setStarchStrategy("one")}
                              active={starchStrategy === "one"}
                            >
                              {starchStrategy === "one" ? "On" : "Off"}
                            </PillButton>
                          </div>
                          <p className="text-xs text-white/60">
                            Use your full starch allowance (
                            {getStarchyCarbs(sex, goal)}g) in one meal. Best for
                            appetite control and fat loss.
                          </p>
                        </div>

                        <div
                          className={`p-4 rounded-xl border transition-all ${
                            starchStrategy === "flex"
                              ? "bg-black/60 border-white/20"
                              : "bg-white/5 border-white/10"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white">
                              Flex Split
                            </span>
                            <PillButton
                              onClick={() => setStarchStrategy("flex")}
                              active={starchStrategy === "flex"}
                            >
                              {starchStrategy === "flex" ? "On" : "Off"}
                            </PillButton>
                          </div>
                          <p className="text-xs text-white/60">
                            Divide starch across two meals (~
                            {Math.round(getStarchyCarbs(sex, goal) / 2)}g each).
                            Useful for training days or larger schedules.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {estimatedBodyFat && (
                    <Card className="bg-zinc-900/80 border border-orange-500/30 text-white">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-white/60">Estimated Body Fat</div>
                            <div className="text-xl font-bold text-orange-400">{estimatedBodyFat}%</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-white/40">Deurenberg + Waist hybrid</div>
                            <div className="text-xs text-white/30">Saved when you confirm macros</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Save Targets - Two Options */}
                  <div className="flex flex-col gap-3">
                    {/* Secondary: Save & Go to Biometrics (restores original flow for weight sync) */}
                    <Button
                      data-testid="macro-save-biometrics-button"
                      disabled={!isCalcInputValid || isSaving}
                      onClick={async () => {
                        advance("calc");
                        setIsSaving(true);

                        try {
                          const adjustedProtein = Math.max(
                            0,
                            results.macros.protein.g + advisoryDeltas.protein,
                          );
                          const adjustedCarbs = Math.max(
                            0,
                            results.macros.carbs.g + advisoryDeltas.carbs,
                          );
                          const adjustedFat = Math.max(
                            0,
                            results.macros.fat.g + advisoryDeltas.fat,
                          );
                          const fibrousCarbs_g_s3 = results.macros.carbs.fibrous;
                          const starchyCarbs_g_s3 = Math.max(0, adjustedCarbs - fibrousCarbs_g_s3);
                          const vegetableCupsPerMeal_s3 = (results.macros as any).vegetableCupsPerMeal ?? 3;
                          const vegetableCupsPerDay_s3 = (results.macros as any).vegetableCupsPerDay ?? (mealsPerDay * 3);

                          await setMacroTargets(
                            {
                              calories: results.target,
                              protein_g: adjustedProtein,
                              carbs_g: adjustedCarbs,
                              fat_g: adjustedFat,
                              starchyCarbs_g: starchyCarbs_g_s3,
                              fibrousCarbs_g: fibrousCarbs_g_s3,
                              starchStrategy,
                              cutIntensity,
                              cutStyle,
                              starchyCarbCap_g,
                              allowZeroStarchyOnLowDay,
                              fibrousCarbSafetyCap_g,
                              strictMode,
                              mealsPerDay,
                              vegetableCupsPerMeal: vegetableCupsPerMeal_s3,
                              vegetableCupsPerDay: vegetableCupsPerDay_s3,
                            },
                            user?.id,
                          );

                          // Keep this so Biometrics screen updates if they go there later
                          window.dispatchEvent(
                            new CustomEvent("mpm:targetsUpdated"),
                          );

                          // Guest mode: Mark macros completed to unlock Weekly Meal Builder
                          if (isGuestMode()) {
                            markMacrosCompleted();
                          }

                          saveBiometricsToProfile().catch(() => {});
                          saveWaistToBiometrics().catch(() => {});
                          saveEstimatedBodyFat().catch(() => {});

                          toast({
                            title: "Macro Targets Saved",
                            description: "Your biometrics have been updated.",
                          });
                        } catch (error) {
                          console.error("Failed to save macro targets:", error);
                          toast({
                            title: "Save Failed",
                            description:
                              "Failed to save your macro targets. Please try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      id="save-biometrics-button"
                      className="w-full bg-lime-600 border-2 border-lime-400 text-white text-lg font-semibold mt-4"
                    >
                      <Target className="h-4 w-4 mr-2" />
                      {isSaving ? "Saving..." : "1st Step → Save to Biometrics"}
                    </Button>

                    {/* Primary CTA: Use These Macros → Build Meals */}
                    <Button
                      data-testid="macro-build-meals-button"
                      disabled={!isCalcInputValid || isSaving}
                      onClick={async () => {
                        const interactedEvent = new CustomEvent(
                          "walkthrough:event",
                          {
                            detail: {
                              testId: "macro-calculator-interacted",
                              event: "interacted",
                            },
                          },
                        );
                        window.dispatchEvent(interactedEvent);

                        advance("calc");
                        setIsSaving(true);

                        try {
                          const adjustedProtein = Math.max(
                            0,
                            results.macros.protein.g + advisoryDeltas.protein,
                          );
                          const adjustedCarbs = Math.max(
                            0,
                            results.macros.carbs.g + advisoryDeltas.carbs,
                          );
                          const adjustedFat = Math.max(
                            0,
                            results.macros.fat.g + advisoryDeltas.fat,
                          );
                          const fibrousCarbs_g_s4 = results.macros.carbs.fibrous;
                          const starchyCarbs_g_s4 = Math.max(0, adjustedCarbs - fibrousCarbs_g_s4);
                          const vegetableCupsPerMeal_s4 = (results.macros as any).vegetableCupsPerMeal ?? 3;
                          const vegetableCupsPerDay_s4 = (results.macros as any).vegetableCupsPerDay ?? (mealsPerDay * 3);

                          await setMacroTargets(
                            {
                              calories: results.target,
                              protein_g: adjustedProtein,
                              carbs_g: adjustedCarbs,
                              fat_g: adjustedFat,
                              starchyCarbs_g: starchyCarbs_g_s4,
                              fibrousCarbs_g: fibrousCarbs_g_s4,
                              starchStrategy,
                              cutIntensity,
                              cutStyle,
                              starchyCarbCap_g,
                              allowZeroStarchyOnLowDay,
                              fibrousCarbSafetyCap_g,
                              strictMode,
                              mealsPerDay,
                              vegetableCupsPerMeal: vegetableCupsPerMeal_s4,
                              vegetableCupsPerDay: vegetableCupsPerDay_s4,
                            },
                            user?.id,
                          );

                          // Dispatch event for real-time refresh on Biometrics/other pages
                          window.dispatchEvent(
                            new CustomEvent("mpm:targetsUpdated"),
                          );

                          // Guest mode: Mark macros completed to unlock Weekly Meal Builder
                          if (isGuestMode()) {
                            markMacrosCompleted();
                          }

                          const assignedBuilder =
                            getAssignedBuilderFromStorage();
                          toast({
                            title: "Macro Targets Set!",
                            description: `Heading to ${assignedBuilder.name} to build your meals.`,
                          });
                          setLocation(assignedBuilder.path);

                          saveBiometricsToProfile().catch(() => {});
                          saveWaistToBiometrics().catch(() => {});
                          saveEstimatedBodyFat().catch(() => {});
                        } catch (error) {
                          console.error("Failed to save macro targets:", error);
                          toast({
                            title: "Save Failed",
                            description:
                              "Failed to save your macro targets. Please try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      id="build-meals-button"
                      className="w-full bg-black/90 border-2 border-white/90 text-white text-white font-semi-bold px-8 text-lg py-4 rounded-2xl shadow-2xl hover:shadow-orange-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChefHat className="h-5 w-5 mr-2" />
                      {isSaving ? "Saving..." : "2nd Step → Your Meal Builder"}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>

      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        steps={macroCalculatorTourSteps}
        title="How to Use the Macro Calculator"
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </>
  );
}

function MacroRow({ label, grams }: { label: string; grams: number }) {
  return (
    <div className="flex justify-between items-center rounded-xl border border-white/20 bg-black/40 p-4">
      <div className="text-sm font-semibold text-white/90">{label}</div>
      <div className="text-lg font-bold text-white">
        {Math.round(grams)} grams
      </div>
    </div>
  );
}
