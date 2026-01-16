// client/src/pages/MacroCounter.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Calculator } from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";
import {
  MACRO_CALC_ENTRY,
  MACRO_CALC_GOAL,
  MACRO_CALC_BODY_TYPE,
  MACRO_CALC_UNITS,
  MACRO_CALC_SEX,
  MACRO_CALC_AGE,
  MACRO_CALC_HEIGHT,
  MACRO_CALC_WEIGHT,
  MACRO_CALC_ACTIVITY,
  MACRO_CALC_SYNC_WEIGHT,
  MACRO_CALC_METABOLIC,
  MACRO_CALC_RESULTS,
  MACRO_CALC_STARCH,
  MACRO_CALC_SAVE,
  MACRO_CALC_DONE,
} from "@/components/copilot/scripts/macroCalculatorScripts";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import {
  Activity,
  User2,
  Info,
  Ruler,
  Scale,
  Target,
  X,
  Home,
  ChefHat,
  Check,
  Sparkles,
} from "lucide-react";

// Guided flow step type
type GuidedStep =
  | "entry"
  | "goal"
  | "bodyType"
  | "units"
  | "sex"
  | "age"
  | "height"
  | "weight"
  | "activity"
  | "syncWeight"
  | "metabolic"
  | "results"
  | "starch"
  | "save"
  | "done";
import { useToast } from "@/hooks/use-toast";
import {
  setMacroTargets,
  getMacroTargets,
  type StarchStrategy,
} from "@/lib/dailyLimits";
import ReadOnlyNote from "@/components/ReadOnlyNote";
import { useAuth } from "@/contexts/AuthContext";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { getAssignedBuilderFromStorage } from "@/lib/assignedBuilder";
import MetabolicConsiderations from "@/components/macro-targeting/MetabolicConsiderations";
import { MacroDeltas } from "@/lib/clinicalAdvisory";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import { isGuestMode, markMacrosCompleted } from "@/lib/guestMode";

type Goal = "loss" | "maint" | "gain";
type Sex = "male" | "female";
type Units = "imperial" | "metric";
type BodyType = "ecto" | "meso" | "endo";

const toNum = (v: string | number) => {
  const n = typeof v === "string" ? v.trim() : v;
  const out = Number(n || 0);
  return Number.isFinite(out) ? out : 0;
};

const kgFromLbs = (lbs: number) => lbs * 0.45359237;
const cmFromFeetInches = (ft: number, inch: number) => ft * 30.48 + inch * 2.54;

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

function calcMacrosBase({ calories, kg, proteinPerKg, fatPct, sex }: any) {
  const pG = Math.round(kg * proteinPerKg);
  const pK = pG * 4;
  const fK = Math.round(calories * fatPct);
  const fG = Math.round(fK / 9);
  const cK = Math.max(0, calories - pK - fK);
  const cG = Math.round(cK / 4);
  return {
    calories,
    protein: { g: pG, kcal: pK },
    fat: { g: fG, kcal: fK },
    carbs: { g: cG, kcal: cK },
  };
}

function applyBodyTypeTilt(base: any, bodyType: BodyType) {
  let tilt = 0;
  if (bodyType === "ecto") tilt = +0.14;
  if (bodyType === "endo") tilt = -0.18;
  if (tilt === 0) return base;
  const shiftKcal = Math.round(base.calories * Math.abs(tilt));
  if (tilt > 0) {
    const nextFatK = Math.max(0, base.fat.kcal - shiftKcal);
    const nextCarbK = base.carbs.kcal + shiftKcal;
    return {
      ...base,
      fat: { kcal: nextFatK, g: Math.round(nextFatK / 9) },
      carbs: { kcal: nextCarbK, g: Math.round(nextCarbK / 4) },
    };
  } else {
    const nextCarbK = Math.max(0, base.carbs.kcal - shiftKcal);
    const nextFatK = base.fat.kcal + shiftKcal;
    return {
      ...base,
      fat: { kcal: nextFatK, g: Math.round(nextFatK / 9) },
      carbs: { kcal: nextCarbK, g: Math.round(nextCarbK / 4) },
    };
  }
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

export default function MacroCounter() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

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
  const [advisoryDeltas, setAdvisoryDeltas] = useState<MacroDeltas>({
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  // Starch Meal Strategy: "one" = 1 starch meal/day (default), "flex" = split across 2 meals
  const existingTargets = getMacroTargets(user?.id);
  const [starchStrategy, setStarchStrategy] = useState<StarchStrategy>(
    existingTargets?.starchStrategy ?? "one",
  );

  // Guided Mode State
  const hasExistingSettings = savedSettings !== null;
  const [guidedStep, setGuidedStep] = useState<GuidedStep>(
    hasExistingSettings ? "done" : "entry"
  );
  const [showResults, setShowResults] = useState(hasExistingSettings);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasSpokenEntry, setHasSpokenEntry] = useState(false);
  
  // Chef Voice for guided walkthrough
  const { speak, stop } = useChefVoice(setIsPlaying);
  
  // Map of step to voice script - memoized to avoid recreation
  const stepScripts = useMemo<Record<GuidedStep, string>>(() => ({
    entry: MACRO_CALC_ENTRY,
    goal: MACRO_CALC_GOAL,
    bodyType: MACRO_CALC_BODY_TYPE,
    units: MACRO_CALC_UNITS,
    sex: MACRO_CALC_SEX,
    age: MACRO_CALC_AGE,
    height: MACRO_CALC_HEIGHT,
    weight: MACRO_CALC_WEIGHT,
    activity: MACRO_CALC_ACTIVITY,
    syncWeight: MACRO_CALC_SYNC_WEIGHT,
    metabolic: MACRO_CALC_METABOLIC,
    results: MACRO_CALC_RESULTS,
    starch: MACRO_CALC_STARCH,
    save: MACRO_CALC_SAVE,
    done: MACRO_CALC_DONE,
  }), []);

  // Helper to advance to next step with voice
  const advanceGuided = useCallback((nextStep: GuidedStep) => {
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
  }, [speak, stepScripts]);
  
  // Speak entry script when component mounts in guided mode
  useEffect(() => {
    if (guidedStep === "entry" && !hasExistingSettings && !hasSpokenEntry) {
      // Slight delay to ensure component is mounted
      const timer = setTimeout(() => {
        speak(MACRO_CALC_ENTRY);
        setHasSpokenEntry(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [guidedStep, hasExistingSettings, hasSpokenEntry, speak]);
  
  // Cleanup: stop voice when navigating away
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);
  
  // Reset guided flow to start over
  const resetGuidedFlow = useCallback(() => {
    setHasSpokenEntry(false);
    setGuidedStep("entry");
    setShowResults(false);
    // Speak entry after a brief delay
    setTimeout(() => {
      speak(MACRO_CALC_ENTRY);
      setHasSpokenEntry(true);
    }, 500);
  }, [speak]);

  // Check if we're past a certain step (for showing completed items)
  const isPastStep = (step: GuidedStep): boolean => {
    const stepOrder: GuidedStep[] = [
      "entry", "goal", "bodyType", "units", "sex", "age", "height", "weight",
      "activity", "syncWeight", "metabolic", "results", "starch", "save", "done"
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
        units,
        sex,
        age,
        heightFt,
        heightIn,
        weightLbs,
        heightCm,
        weightKg,
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
    units,
    sex,
    age,
    heightFt,
    heightIn,
    weightLbs,
    heightCm,
    weightKg,
    activity,
    proteinPerKg,
    fatPct,
    sugarCapMode,
  ]);

  const kg = units === "imperial" ? kgFromLbs(weightLbs) : weightKg;
  const cm =
    units === "imperial" ? cmFromFeetInches(heightFt, heightIn) : heightCm;

  const results = useMemo(() => {
    // Don't calculate until activity is selected
    if (!activity) return null;

    const bmr = mifflin({ sex, kg, cm, age });
    const tdee = Math.round(
      bmr * ACTIVITY_FACTORS[activity as keyof typeof ACTIVITY_FACTORS],
    );
    const target = goalAdjust(tdee, goal);
    const base = calcMacrosBase({
      calories: target,
      kg,
      sex,
      proteinPerKg,
      fatPct,
    });
    const macros = applyBodyTypeTilt(base, bodyType);
    return { bmr, tdee, target, macros };
  }, [sex, kg, cm, age, activity, goal, proteinPerKg, fatPct, bodyType]);

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
        {/* Universal Safe-Area Header */}
        <div
          className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-8 py-3 flex items-center gap-3">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Macro Calculator</span>
            </h1>

            <div className="flex-grow" />

            <MedicalSourcesInfo asIconButton />
            <QuickTourButton onClick={quickTour.openTour} />
          </div>
        </div>

        {/* Main Content */}
        <div
          className="max-w-5xl mx-auto space-y-6 px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
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
                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-6 w-6 text-orange-500" />
                      <h2 className="text-xl font-bold text-white">
                        Welcome to Macro Calculator
                      </h2>
                    </div>
                    <p className="text-white/80 text-sm leading-relaxed">
                      Let's set up your personalized nutrition targets together. I'll walk you through each step to make sure we get it right.
                    </p>
                    <Button
                      onClick={() => advanceGuided("goal")}
                      className="w-full py-4 bg-lime-600 hover:bg-lime-500 text-black font-semibold text-lg rounded-xl"
                      data-testid="guided-talk-to-chef"
                    >
                      <ChefHat className="h-5 w-5 mr-2" />
                      Talk to Chef
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
                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">Step 1</h3>
                    </div>
                    <p className="text-white text-base">
                      What are we trying to do with our nutrition? What's your ultimate goal?
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { v: "loss", label: "Cut", desc: "Lose Weight" },
                        { v: "maint", label: "Maintain", desc: "Stay Same" },
                        { v: "gain", label: "Gain", desc: "Build Muscle" },
                      ].map((g) => (
                        <Button
                          key={g.v}
                          onClick={() => {
                            setGoal(g.v as Goal);
                            advanceGuided("bodyType");
                          }}
                          className={`py-4 flex flex-col items-center ${goal === g.v ? "bg-lime-600 text-black" : "bg-black/40 text-white border border-white/20 hover:bg-black/50"}`}
                        >
                          <span className="font-semibold">{g.label}</span>
                          <span className="text-xs opacity-80">{g.desc}</span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 2: Body Type */}
            {guidedStep === "bodyType" && (
              <motion.div
                key="guided-bodytype"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {/* Completed: Goal */}
                <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                  <p className="text-sm text-white/90 font-medium flex items-center gap-2">
                    <Check className="h-4 w-4 text-lime-500 flex-shrink-0" />
                    Goal: {goal === "loss" ? "Cut" : goal === "maint" ? "Maintain" : "Gain"}
                  </p>
                </div>

                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">Step 2</h3>
                    </div>
                    <p className="text-white text-base">
                      What's your body type?
                    </p>
                    <BodyTypeGuide />
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { v: "ecto", label: "Ectomorph" },
                        { v: "meso", label: "Mesomorph" },
                        { v: "endo", label: "Endomorph" },
                      ].map((b) => (
                        <Button
                          key={b.v}
                          onClick={() => {
                            setBodyType(b.v as BodyType);
                            advanceGuided("units");
                          }}
                          className={`py-3 ${bodyType === b.v ? "bg-lime-600 text-black" : "bg-black/40 text-white border border-white/20 hover:bg-black/50"}`}
                        >
                          {b.label}
                        </Button>
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
                      Goal: {goal === "loss" ? "Cut" : goal === "maint" ? "Maintain" : "Gain"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                    <p className="text-sm text-white/90 font-medium flex items-center gap-2">
                      <Check className="h-4 w-4 text-lime-500" />
                      Body Type: {bodyType === "ecto" ? "Ectomorph" : bodyType === "meso" ? "Mesomorph" : "Endomorph"}
                    </p>
                  </div>
                </div>

                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">Step 3</h3>
                    </div>
                    <p className="text-white text-base">
                      What units are you measuring in?
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => {
                          setUnits("imperial");
                          advanceGuided("sex");
                        }}
                        className={`py-4 flex flex-col items-center ${units === "imperial" ? "bg-lime-600 text-black" : "bg-black/40 text-white border border-white/20 hover:bg-black/50"}`}
                      >
                        <span className="font-semibold">US / Imperial</span>
                        <span className="text-xs opacity-80">lbs, ft/in</span>
                      </Button>
                      <Button
                        onClick={() => {
                          setUnits("metric");
                          advanceGuided("sex");
                        }}
                        className={`py-4 flex flex-col items-center ${units === "metric" ? "bg-lime-600 text-black" : "bg-black/40 text-white border border-white/20 hover:bg-black/50"}`}
                      >
                        <span className="font-semibold">Metric</span>
                        <span className="text-xs opacity-80">kg, cm</span>
                      </Button>
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
                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">Step 4</h3>
                    </div>
                    <p className="text-white text-base">
                      What is your biological sex? (for metabolic calculations)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => {
                          setSex("female");
                          advanceGuided("age");
                        }}
                        className={`py-4 ${sex === "female" ? "bg-lime-600 text-black" : "bg-black/40 text-white border border-white/20 hover:bg-black/50"}`}
                      >
                        Female
                      </Button>
                      <Button
                        onClick={() => {
                          setSex("male");
                          advanceGuided("age");
                        }}
                        className={`py-4 ${sex === "male" ? "bg-lime-600 text-black" : "bg-black/40 text-white border border-white/20 hover:bg-black/50"}`}
                      >
                        Male
                      </Button>
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
                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">Step 5</h3>
                    </div>
                    <p className="text-white text-base">
                      How old are you?
                    </p>
                    <Input
                      type="number"
                      placeholder="Enter your age..."
                      className="w-full bg-black/60 border-white/30 text-white h-12 text-lg"
                      value={age || ""}
                      onChange={(e) => setAge(e.target.value === "" ? 0 : toNum(e.target.value))}
                    />
                    <Button
                      onClick={() => advanceGuided("height")}
                      disabled={!age || age <= 0}
                      className="w-full py-3 bg-lime-600 hover:bg-lime-500 text-black font-semibold rounded-xl disabled:opacity-50"
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
                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">Step 6</h3>
                    </div>
                    <p className="text-white text-base">
                      What's your height?
                    </p>
                    {units === "imperial" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm text-white/70 mb-1 block">Feet</label>
                          <Input
                            type="number"
                            placeholder="ft"
                            className="w-full bg-black/60 border-white/30 text-white h-12 text-lg"
                            value={heightFt || ""}
                            onChange={(e) => setHeightFt(e.target.value === "" ? 0 : toNum(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="text-sm text-white/70 mb-1 block">Inches</label>
                          <Input
                            type="number"
                            placeholder="in"
                            className="w-full bg-black/60 border-white/30 text-white h-12 text-lg"
                            value={heightIn || ""}
                            onChange={(e) => setHeightIn(e.target.value === "" ? 0 : toNum(e.target.value))}
                          />
                        </div>
                      </div>
                    ) : (
                      <Input
                        type="number"
                        placeholder="Enter height in cm..."
                        className="w-full bg-black/60 border-white/30 text-white h-12 text-lg"
                        value={heightCm || ""}
                        onChange={(e) => setHeightCm(e.target.value === "" ? 0 : toNum(e.target.value))}
                      />
                    )}
                    <Button
                      onClick={() => advanceGuided("weight")}
                      disabled={units === "imperial" ? (!heightFt && !heightIn) : !heightCm}
                      className="w-full py-3 bg-lime-600 hover:bg-lime-500 text-black font-semibold rounded-xl disabled:opacity-50"
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
                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">Step 7</h3>
                    </div>
                    <p className="text-white text-base">
                      What's your current weight?
                    </p>
                    <Input
                      type="number"
                      placeholder={units === "imperial" ? "Enter weight in lbs..." : "Enter weight in kg..."}
                      className="w-full bg-black/60 border-white/30 text-white h-12 text-lg"
                      value={units === "imperial" ? (weightLbs || "") : (weightKg || "")}
                      onChange={(e) => {
                        const val = e.target.value === "" ? 0 : toNum(e.target.value);
                        if (units === "imperial") {
                          setWeightLbs(val);
                        } else {
                          setWeightKg(val);
                        }
                      }}
                    />
                    <Button
                      onClick={() => advanceGuided("activity")}
                      disabled={units === "imperial" ? !weightLbs : !weightKg}
                      className="w-full py-3 bg-lime-600 hover:bg-lime-500 text-black font-semibold rounded-xl disabled:opacity-50"
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
                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">Step 8</h3>
                    </div>
                    <p className="text-white text-base">
                      What is your activity level?
                    </p>
                    <div className="space-y-2">
                      {[
                        { v: "sedentary", label: "Sedentary", desc: "Little or no exercise" },
                        { v: "light", label: "Light", desc: "1-3 days/week" },
                        { v: "moderate", label: "Moderate", desc: "3-5 days/week" },
                        { v: "very", label: "Very Active", desc: "6-7 days/week" },
                        { v: "extra", label: "Extra Active", desc: "2x/day" },
                      ].map((a) => (
                        <Button
                          key={a.v}
                          onClick={() => {
                            setActivity(a.v as keyof typeof ACTIVITY_FACTORS);
                            advanceGuided("syncWeight");
                          }}
                          className={`w-full py-3 flex justify-between items-center ${activity === a.v ? "bg-lime-600 text-black" : "bg-black/40 text-white border border-white/20 hover:bg-black/50"}`}
                        >
                          <span className="font-semibold">{a.label}</span>
                          <span className="text-sm opacity-80">{a.desc}</span>
                        </Button>
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
                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">Step 9</h3>
                    </div>
                    <p className="text-white text-base">
                      Would you like to save your weight to biometrics?
                    </p>
                    <Button
                      onClick={() => {
                        const weight = units === "imperial" ? weightLbs : weightKg;
                        localStorage.setItem(
                          "pending-weight-sync",
                          JSON.stringify({ weight, units, timestamp: Date.now() })
                        );
                        toast({
                          title: "Weight ready to sync",
                          description: "Go to My Biometrics to save it to your history.",
                        });
                        advanceGuided("metabolic");
                      }}
                      className="w-full py-3 bg-lime-700 hover:bg-lime-600 text-white font-semibold rounded-xl"
                    >
                      <Scale className="h-4 w-4 mr-2" />
                      Save Weight to Biometrics
                    </Button>
                    <Button
                      onClick={() => advanceGuided("metabolic")}
                      variant="outline"
                      className="w-full py-3 border-white/30 text-white hover:bg-white/10"
                    >
                      Skip for now
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
                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h3 className="text-lg font-semibold text-white">Step 10</h3>
                    </div>
                    <p className="text-white text-base">
                      Any metabolic or hormonal considerations? These help fine-tune your targets.
                    </p>
                    <p className="text-sm text-white/60">
                      You can adjust these now or skip and do it later.
                    </p>
                    {results && (
                      <MetabolicConsiderations
                        currentTargets={{
                          protein: results.macros.protein.g + advisoryDeltas.protein,
                          carbs: results.macros.carbs.g + advisoryDeltas.carbs,
                          fat: results.macros.fat.g + advisoryDeltas.fat,
                        }}
                        onApplyAdjustments={(deltas) => {
                          setAdvisoryDeltas({
                            protein: advisoryDeltas.protein + deltas.protein,
                            carbs: advisoryDeltas.carbs + deltas.carbs,
                            fat: advisoryDeltas.fat + deltas.fat,
                          });
                          toast({
                            title: "Adjustments Applied",
                            description: "Your macro targets have been fine-tuned.",
                          });
                        }}
                      />
                    )}
                    <Button
                      onClick={() => {
                        setShowResults(true);
                        advanceGuided("results");
                      }}
                      className="w-full py-3 bg-lime-600 hover:bg-lime-500 text-black font-semibold rounded-xl"
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
                        <div className="text-base font-bold text-white">Total Calories</div>
                        <div className="text-2xl font-bold text-emerald-300">{results.target} kcal</div>
                      </div>
                      <MacroRow label="Protein" grams={Math.max(0, results.macros.protein.g + advisoryDeltas.protein)} />
                      <MacroRow label="Carbs - Starchy" grams={Math.max(0, getStarchyCarbs(sex, goal) + Math.round(advisoryDeltas.carbs * 0.5))} />
                      <MacroRow label="Carbs - Fibrous" grams={Math.max(0, results.macros.carbs.g - getStarchyCarbs(sex, goal) + Math.round(advisoryDeltas.carbs * 0.5))} />
                      <MacroRow label="Fats" grams={Math.max(0, results.macros.fat.g + advisoryDeltas.fat)} />
                    </div>
                  </CardContent>
                </Card>
                <Button
                  onClick={() => advanceGuided("starch")}
                  className="w-full py-3 bg-lime-600 hover:bg-lime-500 text-black font-semibold rounded-xl"
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {/* GUIDED STEP 12: Starch Strategy */}
            {guidedStep === "starch" && (
              <motion.div
                key="guided-starch"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 text-xl">🌾</span>
                      <h3 className="text-lg font-semibold text-white">Your Starch Game Plan</h3>
                    </div>
                    <p className="text-white text-base">
                      How are you going to eat your starches? One meal or split across two?
                    </p>
                    <div className="space-y-2">
                      <Button
                        onClick={() => {
                          setStarchStrategy("one");
                          advanceGuided("save");
                        }}
                        className={`w-full py-4 flex flex-col items-start ${starchStrategy === "one" ? "bg-lime-600 text-black" : "bg-black/40 text-white border border-white/20 hover:bg-black/50"}`}
                      >
                        <span className="font-semibold">One Starch Meal</span>
                        <span className="text-sm opacity-80">Recommended - all starches in one meal</span>
                      </Button>
                      <Button
                        onClick={() => {
                          setStarchStrategy("flex");
                          advanceGuided("save");
                        }}
                        className={`w-full py-4 flex flex-col items-start ${starchStrategy === "flex" ? "bg-lime-600 text-black" : "bg-black/40 text-white border border-white/20 hover:bg-black/50"}`}
                      >
                        <span className="font-semibold">Flex Split</span>
                        <span className="text-sm opacity-80">Split starches across two meals</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* GUIDED STEP 13: Final Save */}
            {guidedStep === "save" && results && (
              <motion.div
                key="guided-save"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <Card className="bg-black/30 backdrop-blur-lg border border-lime-500/30 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-lime-500" />
                      <h3 className="text-lg font-semibold text-white">All Set!</h3>
                    </div>
                    <p className="text-white text-base">
                      Your personalized macro targets are ready. Save them and head to your meal builder!
                    </p>
                    
                    {/* Summary */}
                    <div className="bg-black/40 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/70">Calories:</span>
                        <span className="text-white font-semibold">{results.target} kcal</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/70">Protein:</span>
                        <span className="text-white font-semibold">{Math.max(0, results.macros.protein.g + advisoryDeltas.protein)}g</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/70">Carbs:</span>
                        <span className="text-white font-semibold">{Math.max(0, results.macros.carbs.g + advisoryDeltas.carbs)}g</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/70">Fats:</span>
                        <span className="text-white font-semibold">{Math.max(0, results.macros.fat.g + advisoryDeltas.fat)}g</span>
                      </div>
                    </div>

                    <Button
                      disabled={isSaving}
                      onClick={async () => {
                        setIsSaving(true);
                        try {
                          const adjustedProtein = Math.max(0, results.macros.protein.g + advisoryDeltas.protein);
                          const adjustedCarbs = Math.max(0, results.macros.carbs.g + advisoryDeltas.carbs);
                          const adjustedFat = Math.max(0, results.macros.fat.g + advisoryDeltas.fat);
                          const adjustedStarchy = Math.max(0, getStarchyCarbs(sex, goal) + Math.round(advisoryDeltas.carbs * 0.5));
                          const adjustedFibrous = Math.max(0, adjustedCarbs - adjustedStarchy);

                          await setMacroTargets(
                            {
                              calories: results.target,
                              protein_g: adjustedProtein,
                              carbs_g: adjustedCarbs,
                              fat_g: adjustedFat,
                              starchyCarbs_g: adjustedStarchy,
                              fibrousCarbs_g: adjustedFibrous,
                              starchStrategy,
                            },
                            user?.id,
                          );

                          window.dispatchEvent(new CustomEvent("mpm:targetsUpdated"));

                          if (isGuestMode()) {
                            markMacrosCompleted();
                          }

                          const assignedBuilder = getAssignedBuilderFromStorage();
                          toast({
                            title: "Macro Targets Set!",
                            description: `Heading to ${assignedBuilder.name} to build your meals.`,
                          });
                          
                          advanceGuided("done");
                          setLocation(assignedBuilder.path);
                        } catch (error) {
                          console.error("Failed to save macro targets:", error);
                          toast({
                            title: "Save Failed",
                            description: "Failed to save your macro targets. Please try again.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      className="w-full py-4 bg-lime-600 hover:bg-lime-500 text-black font-semibold text-lg rounded-xl"
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
          {/* Recalculate with Chef Button */}
          <Card className="bg-black/30 backdrop-blur-lg border border-lime-500/30 shadow-lg">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChefHat className="h-6 w-6 text-lime-500" />
                <div>
                  <p className="text-white font-medium">Need to recalculate?</p>
                  <p className="text-white/60 text-sm">Walk through the setup again with Chef</p>
                </div>
              </div>
              <Button
                onClick={resetGuidedFlow}
                variant="outline"
                className="border-lime-500/50 text-lime-400 hover:bg-lime-500/20"
                data-testid="recalculate-with-chef"
              >
                <ChefHat className="h-4 w-4 mr-2" />
                Recalculate
              </Button>
            </CardContent>
          </Card>
          
          {/* Apple 1.4.1 Compliance: Prominent citation banner - MUST be visible */}
          <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-400/30 rounded-xl p-4">
            <p className="text-sm text-white/90 leading-relaxed">
              <span className="font-semibold text-blue-300">Scientific Sources:</span>{" "}
              Calculations based on{" "}
              <a
                href="https://pubmed.ncbi.nlm.nih.gov/2305711/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline font-medium"
              >
                Mifflin-St Jeor (NCBI/NIH)
              </a>
              {" "}and{" "}
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
              <CardContent className="p-5">
                <h3 className="text-lg font-semibold flex items-center">
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
                  <div className="text-xs text-white font-semibold">Units</div>
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

                  <div className="text-xs text-white font-semibold">Sex</div>
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
                            e.target.value === "" ? 0 : toNum(e.target.value),
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

          {/* Metabolic & Hormonal Considerations - V1 Clinical Advisory */}
          {results && (
            <MetabolicConsiderations
              currentTargets={{
                protein: results.macros.protein.g + advisoryDeltas.protein,
                carbs: results.macros.carbs.g + advisoryDeltas.carbs,
                fat: results.macros.fat.g + advisoryDeltas.fat,
              }}
              onApplyAdjustments={(deltas) => {
                setAdvisoryDeltas({
                  protein: advisoryDeltas.protein + deltas.protein,
                  carbs: advisoryDeltas.carbs + deltas.carbs,
                  fat: advisoryDeltas.fat + deltas.fat,
                });
                toast({
                  title: "Adjustments Applied",
                  description:
                    "Your macro targets have been fine-tuned based on your metabolic considerations.",
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
                    <Target className="h-5 w-5 mr-2 text-emerald-300" /> Your
                    Daily Macro Targets
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
                    <MacroRow
                      label="Carbs - Starchy"
                      grams={Math.max(
                        0,
                        getStarchyCarbs(sex, goal) +
                          Math.round(advisoryDeltas.carbs * 0.5),
                      )}
                    />
                    <MacroRow
                      label="Carbs - Fibrous"
                      grams={Math.max(
                        0,
                        results.macros.carbs.g -
                          getStarchyCarbs(sex, goal) +
                          Math.round(advisoryDeltas.carbs * 0.5),
                      )}
                    />
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
                      Detailed methodology and clinical references available below.
                    </p>
                    <MedicalSourcesInfo
                      trigger={
                        <button className="text-xs text-lime-400/80 hover:text-lime-400 underline flex items-center gap-1">
                          <Info className="w-3 h-3" /> View all sources & methodology
                        </button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Starch Meal Strategy - Your Starch Game Plan */}
              <Card className="bg-zinc-900/80 border border-amber-500/30 text-white">
                <CardContent className="p-5">
                  <h3 className="text-lg font-semibold flex items-center mb-3">
                    <span className="text-amber-400 mr-2">🌾</span> Your Starch
                    Game Plan
                  </h3>
                  <p className="text-sm text-white/70 mb-4">
                    Starchy carbs (rice, pasta, potatoes, bread) need to be
                    managed. Choose how you'll use your daily starch budget:
                  </p>

                  <RadioGroup
                    value={starchStrategy}
                    onValueChange={(v) =>
                      setStarchStrategy(v as StarchStrategy)
                    }
                    className="space-y-3"
                  >
                    <div
                      className={`flex items-start space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        starchStrategy === "one"
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-white/20 hover:border-white/40"
                      }`}
                      onClick={() => setStarchStrategy("one")}
                    >
                      <RadioGroupItem
                        value="one"
                        id="starch-one"
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="starch-one"
                          className="text-base font-semibold text-white cursor-pointer"
                        >
                          One Starch Meal
                          <span className="ml-2 text-xs bg-emerald-600 px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        </Label>
                        <p className="text-sm text-white/60 mt-1">
                          Use your full starch allowance (
                          {getStarchyCarbs(sex, goal)}g) in one meal. Best for
                          appetite control and fat loss.
                        </p>
                      </div>
                    </div>

                    <div
                      className={`flex items-start space-x-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        starchStrategy === "flex"
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-white/20 hover:border-white/40"
                      }`}
                      onClick={() => setStarchStrategy("flex")}
                    >
                      <RadioGroupItem
                        value="flex"
                        id="starch-flex"
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="starch-flex"
                          className="text-base font-semibold text-white cursor-pointer"
                        >
                          Flex Split
                        </Label>
                        <p className="text-sm text-white/60 mt-1">
                          Divide starch across two meals (~
                          {Math.round(getStarchyCarbs(sex, goal) / 2)}g each).
                          Useful for training days or larger schedules.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Save Targets - Two Options */}
              <div className="flex flex-col gap-3">
                {/* Secondary: Save & Go to Biometrics (restores original flow for weight sync) */}
                <Button
                  data-testid="macro-save-biometrics-button"
                  disabled={isSaving}
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
                      const adjustedStarchy = Math.max(
                        0,
                        getStarchyCarbs(sex, goal) +
                          Math.round(advisoryDeltas.carbs * 0.5),
                      );
                      const adjustedFibrous = Math.max(
                        0,
                        adjustedCarbs - adjustedStarchy,
                      );

                      await setMacroTargets(
                        {
                          calories: results.target,
                          protein_g: adjustedProtein,
                          carbs_g: adjustedCarbs,
                          fat_g: adjustedFat,
                          starchyCarbs_g: adjustedStarchy,
                          fibrousCarbs_g: adjustedFibrous,
                          starchStrategy,
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

                      toast({
                        title: "Macro Targets Saved",
                        description: "Your biometrics have been updated.",
                      });

                      // ❌ REMOVE this:
                      // setLocation("/my-biometrics");
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
                  className="w-full bg-lime-600 border-2 border-lime-400 text-white hover:bg-lime-800 hover:border-lime-300 text-lg font-semibold mt-4"
                >
                  <Target className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "1st Step → Save to Biometrics"}
                </Button>

                {/* Primary CTA: Use These Macros → Build Meals */}
                <Button
                  data-testid="macro-build-meals-button"
                  disabled={isSaving}
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
                      const adjustedStarchy = Math.max(
                        0,
                        getStarchyCarbs(sex, goal) +
                          Math.round(advisoryDeltas.carbs * 0.5),
                      );
                      const adjustedFibrous = Math.max(
                        0,
                        adjustedCarbs - adjustedStarchy,
                      );

                      await setMacroTargets(
                        {
                          calories: results.target,
                          protein_g: adjustedProtein,
                          carbs_g: adjustedCarbs,
                          fat_g: adjustedFat,
                          starchyCarbs_g: adjustedStarchy,
                          fibrousCarbs_g: adjustedFibrous,
                          starchStrategy,
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

                      const assignedBuilder = getAssignedBuilderFromStorage();
                      toast({
                        title: "Macro Targets Set!",
                        description: `Heading to ${assignedBuilder.name} to build your meals.`,
                      });
                      setLocation(assignedBuilder.path);
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
                  className="w-full bg-black/90 border-2 border-white/90 text-white hover:bg-black/60 hover:border-black/20 text-white font-semi-bold px-8 text-lg py-4 rounded-2xl shadow-2xl hover:shadow-orange-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
