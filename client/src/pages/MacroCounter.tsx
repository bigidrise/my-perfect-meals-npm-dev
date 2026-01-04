// client/src/pages/MacroCounter.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
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
  Activity,
  User2,
  Info,
  Ruler,
  Scale,
  Target,
  X,
  Home,
  ChefHat,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { setMacroTargets } from "@/lib/dailyLimits";
import ReadOnlyNote from "@/components/ReadOnlyNote";
import { useAuth } from "@/contexts/AuthContext";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { getAssignedBuilderFromStorage } from "@/lib/assignedBuilder";
import MetabolicConsiderations from "@/components/macro-targeting/MetabolicConsiderations";
import { MacroDeltas } from "@/lib/clinicalAdvisory";

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
  const [advisoryDeltas, setAdvisoryDeltas] = useState<MacroDeltas>({ protein: 0, carbs: 0, fat: 0 });

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

            <QuickTourButton onClick={quickTour.openTour} />
          </div>
        </div>

        {/* Main Content */}
        <div
          className="max-w-5xl mx-auto space-y-6 px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
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
                  description: "Your macro targets have been fine-tuned based on your metabolic considerations.",
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
                  <h3 className="text-lg font-semibold flex items-center mb-4">
                    <Target className="h-5 w-5 mr-2 text-emerald-300" /> Your
                    Daily Macro Targets
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
                      grams={Math.max(0, results.macros.protein.g + advisoryDeltas.protein)}
                    />
                    <MacroRow
                      label="Carbs - Starchy"
                      grams={Math.max(0, getStarchyCarbs(sex, goal) + Math.round(advisoryDeltas.carbs * 0.5))}
                    />
                    <MacroRow
                      label="Carbs - Fibrous"
                      grams={Math.max(0,
                        (results.macros.carbs.g - getStarchyCarbs(sex, goal)) + Math.round(advisoryDeltas.carbs * 0.5)
                      )}
                    />
                    <MacroRow label="Fats" grams={Math.max(0, results.macros.fat.g + advisoryDeltas.fat)} />
                  </div>
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
                        },
                        user?.id,
                      );

                      // Keep this so Biometrics screen updates if they go there later
                      window.dispatchEvent(
                        new CustomEvent("mpm:targetsUpdated"),
                      );

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
                  {isSaving
                    ? "Saving..."
                    : "1st Step → Save to Biometrics"}
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
                        },
                        user?.id,
                      );

                      // Dispatch event for real-time refresh on Biometrics/other pages
                      window.dispatchEvent(
                        new CustomEvent("mpm:targetsUpdated"),
                      );

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
                  {isSaving ? "Saving..." : "2nd Step → Go To Meal Planner"}
                </Button>
              </div>
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
