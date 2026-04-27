import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Brain, Wine, Zap, Lightbulb, Wheat } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassButton } from "@/components/glass";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  isAllergyRelatedError,
  formatAllergyAlertDescription,
} from "@/utils/allergyAlert";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import { useCopilot } from "@/components/copilot/CopilotContext";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import { normalizeDiet, mealMatchesDiet } from "@/utils/dietaryFilter";
import DietStyleBadge from "@/components/DietStyleBadge";
import MealClassificationPill from "@/components/MealClassificationPill";
import KosherProTip from "@/components/KosherProTip";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { GlucoseGuardToggle } from "@/components/GlucoseGuardToggle";
import { FlavorToggle } from "@/components/FlavorToggle";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import {
  DietGuardIntercept,
  DietAdaptedNotice,
} from "@/components/DietGuardIntercept";
import { useDietGuardPrecheck } from "@/hooks/useDietGuardPrecheck";
import { useStarchGuardPrecheck } from "@/hooks/useStarchGuardPrecheck";
import FavoriteButton from "@/components/FavoriteButton";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import TrashButton from "@/components/ui/TrashButton";
import ThinkingDots from "@/components/ThinkingDots";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import { deriveSplitCarbs } from "@/utils/ingredientClassifier";
import { PillButton } from "@/components/ui/pill-button";

const SERVING_SIZES = [
  { value: "single", label: "Single Drink" },
  { value: "two", label: "Two Drinks" },
  { value: "pitcher", label: "Pitcher (4–6)" },
];

const PHASES = [
  { value: "pre", label: "Pre-Workout", emoji: "⚡" },
  { value: "intra", label: "Intra", emoji: "💧" },
  { value: "post", label: "Post-Workout", emoji: "🔄" },
];

const FORMATS = [
  { value: "protein shake", label: "Protein", emoji: "💪" },
  { value: "smoothie", label: "Smoothie", emoji: "🍓" },
  { value: "electrolyte drink", label: "Electrolyte", emoji: "⚗️" },
  { value: "juice blend", label: "Juice Blend", emoji: "🥝" },
  { value: "shake", label: "Shake", emoji: "🥤" },
];

const GOALS = [
  { value: "muscle gain", label: "Muscle Gain", emoji: "⬆️" },
  { value: "endurance", label: "Endurance", emoji: "🏃" },
  { value: "fat loss", label: "Fat Loss", emoji: "🔥" },
  { value: "hydration", label: "Hydration", emoji: "💦" },
  { value: "strength", label: "Strength", emoji: "🏋️" },
];

const PRO_TIPS_SCRIPT = {
  title: "Athletes Beverage Creator — Pro Tips",
  description: "Performance drinks built clean — functional ingredients, no dyes, no fillers. Every drink respects your dietary profile.",
  spokenText: "Here's what this system is designed to do. Every drink is built around your training phase. Pre-workout drinks prioritize energy and mental focus — clean caffeine, adaptogens, and fast-acting carbs. Intra-workout drinks focus on hydration and endurance — electrolytes, BCAAs, and light sugars to keep you going. Post-workout drinks are built for recovery — protein timing, anti-inflammatory ingredients, and muscle repair support. No artificial dyes. No cheap fillers. Every ingredient serves a specific purpose in your body. And your dietary profile travels with every request. If you're vegan, anti-inflammatory, or have food allergies, the same guardrails that protect every other meal in this app are active here too.",
  autoClose: false,
};

export default function AthleteBeverageCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = user?.id || "";
  const { open: openCopilot, setLastResponse } = useCopilot();

  // Primary AI input
  const [performanceRequest, setPerformanceRequest] = useState("");
  // Optional pill selectors
  const [phase, setPhase] = useState("");
  const [format, setFormat] = useState("");
  const [goal, setGoal] = useState("");
  const [servingSize, setServingSize] = useState("single");
  const [flavorPersonal, setFlavorPersonal] = useState(true);
  const [safetyEnabled, setSafetyEnabled] = useState(true);
  const [pendingGeneration, setPendingGeneration] = useState(false);
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [generatedBeverage, setGeneratedBeverage] = useState<any | null>(null);
  const [beverageImageLoading, setBeverageImageLoading] = useState(false);
  const [dietAdaptedNotice, setDietAdaptedNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const tickerRef = useRef<number | null>(null);

  // Guards
  const {
    checking: safetyChecking,
    alert: safetyAlert,
    checkSafety,
    clearAlert: clearSafetyAlert,
    setAlert: setSafetyAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride,
  } = useSafetyGuardPrecheck();

  const {
    alert: dietAlert,
    decision: dietDecision,
    checkDiet,
    clearAlert: clearDietAlert,
    setDecision: setDietDecision,
    triggerAlert: triggerDietAlert,
    activeDiet,
  } = useDietGuardPrecheck();

  const {
    alert: starchAlert,
    checkStarch: checkBeverageStarch,
    clearAlert: clearBeverageStarchAlert,
  } = useStarchGuardPrecheck();

  const [dietAdaptedNoticeStr, setDietAdaptedNoticeStr] = useState<string | null>(null);

  // Post-generation starch scan
  useEffect(() => {
    if (!generatedBeverage) return;
    const ingredientTexts = (generatedBeverage.ingredients || [])
      .map((ing: any) => (typeof ing === "string" ? ing : ing?.name || ""))
      .filter(Boolean);
    checkBeverageStarch(
      ingredientTexts.length ? ingredientTexts : [generatedBeverage.name || ""]
    );
  }, [generatedBeverage]);

  useCopilotPageExplanation();

  useEffect(() => {
    document.title = "Athletes Beverage Creator | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (pendingGeneration && overrideToken && !isGenerating && !safetyChecking) {
      setPendingGeneration(false);
      handleGenerateBeverage(false, overrideToken);
    }
  }, [pendingGeneration, overrideToken, isGenerating, safetyChecking]);

  const startProgressTicker = () => {
    if (tickerRef.current) return;
    setProgress(0);
    tickerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p < 90) return Math.min(p + Math.max(1, Math.floor((90 - p) * 0.07)), 90);
        return p;
      });
    }, 150);
  };

  const stopProgressTicker = () => {
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
    setProgress(100);
  };

  function buildRequestDescription() {
    const parts: string[] = [];
    if (performanceRequest.trim()) parts.push(performanceRequest.trim());
    if (phase) parts.push(`${PHASES.find(p => p.value === phase)?.label || phase} phase`);
    if (goal) parts.push(`goal: ${goal}`);
    if (format) parts.push(`format: ${format}`);
    if (parts.length === 0) return "";
    return `Performance athlete drink — ${parts.join(", ")}. Use functional, clean ingredients with no artificial dyes or fillers. Every ingredient must serve a specific athletic performance purpose.`;
  }

  function buildDietaryPayload() {
    const restrictions: string[] = [];
    if (user?.dietaryRestrictions) {
      if (Array.isArray(user.dietaryRestrictions)) restrictions.push(...user.dietaryRestrictions);
      else if (typeof user.dietaryRestrictions === "string" && user.dietaryRestrictions.trim()) restrictions.push(user.dietaryRestrictions.trim());
    }
    return restrictions;
  }

  const handleSafetyOverride = (enabled: boolean, token?: string) => {
    setSafetyEnabled(enabled);
    if (token) {
      setOverrideToken(token);
      clearSafetyAlert();
      setPendingGeneration(true);
    }
  };

  async function handleGenerateBeverage(skipDietPreflight = false, overrideToken?: string, dietAdaptOverride = false, userDietOverride = false) {
    const desc = buildRequestDescription();
    const hasInput = performanceRequest.trim().length > 0 || phase || format || goal;

    if (!hasInput) {
      toast({ title: "Tell me what you want", description: "Describe your performance drink or select a phase, format, or goal below.", variant: "destructive" });
      return;
    }

    if (safetyEnabled && !hasActiveOverride && !overrideToken) {
      const isSafe = await checkSafety(desc || performanceRequest || format || phase, "athlete-beverage-creator");
      if (!isSafe) return;
    }

    if (!skipDietPreflight && activeDiet && dietDecision !== "let_chef_adapt") {
      const dietInput = performanceRequest.trim() || desc;
      const dietOk = checkDiet(dietInput);
      if (!dietOk) return;
    }

    setIsGenerating(true);
    startProgressTicker();

    try {
      const res = await fetch(apiUrl("/api/meals/beverage-creator"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          beverageCategory: format || "protein shake",
          flavorFamily: "performance",
          customBeverageDescription: desc,
          servingSize,
          dietaryPreferences: buildDietaryPayload(),
          userId,
          safetyMode: !safetyEnabled && overrideToken ? "CUSTOM_AUTHENTICATED" : "STRICT",
          overrideToken: !safetyEnabled ? overrideToken : undefined,
          skipPalate: !flavorPersonal,
          dietAdaptOverride,
          userDietOverride,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (data?.safetyBlocked) {
          setSafetyAlert({ show: true, result: "BLOCKED", blockedTerms: [], blockedCategories: [], ambiguousTerms: [], message: data.message || "Flagged by SafetyGuard.", suggestion: undefined });
          return;
        }
        throw new Error(data?.message || data?.error || "Generation failed");
      }

      const meal = data.meal || data;
      const userDiet = normalizeDiet(user?.dietaryRestrictions);
      if (data.dietAdapted) {
        setDietAdaptedNoticeStr(data.dietNotice || `Adapted for your ${userDiet} diet.`);
        clearDietAlert();
      } else if (!skipDietPreflight && activeDiet && !mealMatchesDiet(userDiet, meal)) {
        stopProgressTicker();
        setIsGenerating(false);
        triggerDietAlert([], `This drink may not fully match your ${userDiet} diet.`);
        return;
      }

      stopProgressTicker();
      setGeneratedBeverage(meal);

      setBeverageImageLoading(true);
      fetch(apiUrl("/api/meals/generate-image"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId: meal.id, mealName: meal.name, mealType: "beverages", ingredients: meal.ingredients }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.imageUrl) setGeneratedBeverage((prev: any) => prev ? { ...prev, imageUrl: d.imageUrl } : prev); })
        .catch(() => {})
        .finally(() => setBeverageImageLoading(false));

      toast({ title: "✨ Performance Drink Ready!", description: `${meal.name} is ready for you.` });
    } catch (err: any) {
      stopProgressTicker();
      const errorMsg = err?.message || String(err) || "";
      if (isAllergyRelatedError(errorMsg)) {
        toast({ title: "⚠️ ALLERGY ALERT", description: formatAllergyAlertDescription(errorMsg), variant: "destructive", duration: 8000 });
      } else {
        toast({ title: "Something went wrong", description: errorMsg || "Please try again.", variant: "destructive" });
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function getNutrition(meal: any) {
    const n = meal?.nutrition || {};
    return {
      calories: Number(n.calories ?? meal.calories ?? 0),
      protein: Number(n.protein ?? meal.protein ?? 0),
      carbs: Number(n.carbs ?? meal.carbs ?? 0),
      fat: Number(n.fat ?? meal.fat ?? 0),
    };
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 flex items-center gap-2 flex-nowrap overflow-hidden">
            <button
              onClick={() => setLocation("/lifestyle/beverage-hub")}
              className="flex items-center gap-2 text-white active:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <h1 className="text-lg font-bold text-white truncate min-w-0">
              Athletes Beverage Creator
            </h1>
            <div className="flex-grow" />
            {/* Pro Tips pill */}
            <button
              onClick={() => {
                setLastResponse({ title: PRO_TIPS_SCRIPT.title, description: PRO_TIPS_SCRIPT.description, spokenText: PRO_TIPS_SCRIPT.spokenText, autoClose: PRO_TIPS_SCRIPT.autoClose });
                openCopilot();
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-200 text-xs font-semibold active:bg-orange-500/30 transition-colors shrink-0"
            >
              <Lightbulb className="h-3 w-3" />
              Pro Tips
            </button>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="max-w-2xl mx-auto px-4 pb-24"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <Card className="shadow-2xl bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Zap className="h-5 w-5 text-orange-400" />
                Build Your Performance Drink
              </CardTitle>
              <button
                onClick={() => {
                  setLastResponse({ title: PRO_TIPS_SCRIPT.title, description: PRO_TIPS_SCRIPT.description, spokenText: PRO_TIPS_SCRIPT.spokenText, autoClose: PRO_TIPS_SCRIPT.autoClose });
                  openCopilot();
                }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-200 text-xs font-semibold active:bg-orange-500/30 transition-colors shrink-0"
              >
                <Lightbulb className="h-3 w-3" />
                How it Works
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Primary AI request input */}
            <div>
              <label className="block text-md font-medium text-white mb-1">
                What performance drink do you want?
                <span className="ml-2 text-xs text-orange-300 font-normal">(or choose below)</span>
              </label>
              <div className="relative">
                <textarea
                  value={performanceRequest}
                  onChange={(e) => setPerformanceRequest(e.target.value)}
                  placeholder='e.g. "Post-workout protein shake with creatine and banana" or "Pre-workout energy smoothie, vegan, no dairy"'
                  rows={3}
                  className="w-full rounded-lg bg-black/60 border border-orange-400/40 text-white placeholder-white/30 text-sm px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-orange-400/60 resize-none"
                />
                {performanceRequest && (
                  <TrashButton
                    onClick={() => setPerformanceRequest("")}
                    size="sm"
                    ariaLabel="Clear request"
                    title="Clear"
                    className="absolute top-2 right-2"
                  />
                )}
              </div>
              {performanceRequest.trim().length > 0 && (
                <p className="text-xs text-orange-300 mt-1">
                  Phase and format selections below are optional — your description takes priority.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 text-white/30">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs">or choose from options below</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Workout Phase — PillButton with emoji + label below */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Training phase <span className="text-white/40 font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {PHASES.map(({ value, label, emoji }) => (
                  <div key={value} className="flex flex-col items-center gap-1">
                    <PillButton
                      active={phase === value}
                      variant="amber"
                      onClick={() => setPhase(phase === value ? "" : value)}
                    >
                      {emoji}
                    </PillButton>
                    <span className="text-[10px] text-white leading-tight text-center">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Drink Format — PillButton with emoji + label below */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Drink format <span className="text-white/40 font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {FORMATS.map(({ value, label, emoji }) => (
                  <div key={value} className="flex flex-col items-center gap-1">
                    <PillButton
                      active={format === value}
                      variant="amber"
                      onClick={() => setFormat(format === value ? "" : value)}
                    >
                      {emoji}
                    </PillButton>
                    <span className="text-[10px] text-white leading-tight text-center">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Training Goal — PillButton with emoji + label below */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Training goal <span className="text-white/40 font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {GOALS.map(({ value, label, emoji }) => (
                  <div key={value} className="flex flex-col items-center gap-1">
                    <PillButton
                      active={goal === value}
                      variant="amber"
                      onClick={() => setGoal(goal === value ? "" : value)}
                    >
                      {emoji}
                    </PillButton>
                    <span className="text-[10px] text-white leading-tight text-center">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Serving size */}
            <div>
              <label className="block text-md font-medium text-white mb-1">
                Serving Size <span className="text-orange-400">*</span>
              </label>
              <Select value={servingSize} onValueChange={setServingSize}>
                <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-60 overflow-y-auto">
                  {SERVING_SIZES.map((size) => (
                    <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <SafetyGuardBanner
              alert={safetyAlert}
              mealRequest={buildRequestDescription() || performanceRequest}
              onDismiss={clearSafetyAlert}
              onOverrideSuccess={(token) => handleSafetyOverride(false, token)}
            />

            <div className="mb-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
              <span className="text-xs text-white/60 block mb-2">Meal Safety</span>
              <SafetyGuardToggle safetyEnabled={safetyEnabled} onSafetyChange={handleSafetyOverride} disabled={isGenerating || safetyChecking} />
              <GlucoseGuardToggle disabled={isGenerating || safetyChecking} />
            </div>

            <div className="mb-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10">
              <span className="text-xs text-white/60 block mb-2">Flavor Preference</span>
              <FlavorToggle flavorPersonal={flavorPersonal} onFlavorChange={setFlavorPersonal} disabled={isGenerating} />
              <p className="text-xs text-white/40 mt-1">
                {flavorPersonal ? "Using your palate preferences" : "Neutral profile"}
              </p>
            </div>

            {isGenerating || safetyChecking ? (
              <div className="max-w-md mx-auto mb-4 flex justify-center">
                <ThinkingDots label={safetyChecking ? "Checking safety…" : "Building your performance drink…"} />
              </div>
            ) : (
              <GlassButton onClick={() => handleGenerateBeverage()} className="w-full bg-orange-600 flex items-center justify-center">
                Build Performance Drink
              </GlassButton>
            )}
          </CardContent>
        </Card>

        {isGenerating && (
          <div className="w-full max-w-xl mx-auto mb-4">
            <Progress value={progress} className="h-1 bg-white/10" />
          </div>
        )}

        <DietGuardIntercept
          alert={dietAlert}
          onDecision={(decision) => {
            if (decision === "pick_something_else") {
              clearDietAlert();
            } else if (decision === "let_chef_adapt") {
              setDietDecision("let_chef_adapt");
              clearDietAlert();
              handleGenerateBeverage(true, undefined, true, false);
            } else if (decision === "continue_anyway") {
              clearDietAlert();
              handleGenerateBeverage(true, undefined, false, true);
            }
          }}
        />

        {generatedBeverage && (
          <div className="space-y-6">
            <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl">
              <CardContent className="p-6">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-5 w-5 text-orange-400 shrink-0" />
                    <h3 className="text-xl font-bold text-white truncate leading-tight">
                      {generatedBeverage.name}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <FavoriteButton title={generatedBeverage.name} sourceType="athlete-beverage-creator" mealData={generatedBeverage} />
                    <button
                      onClick={() => setGeneratedBeverage(null)}
                      className="text-sm text-white/70 bg-white/10 px-3 py-1 rounded-lg transition-colors active:scale-[0.98]"
                    >
                      Create New
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <DietStyleBadge />
                  <MealClassificationPill dietClassification={generatedBeverage.dietClassification} />
                  {dietAdaptedNoticeStr && (
                    <DietAdaptedNotice diet={normalizeDiet(user?.dietaryRestrictions)} />
                  )}
                  <KosherProTip dietClassification={generatedBeverage.dietClassification} isAdapted={!!dietAdaptedNoticeStr} />
                </div>

                <p className="text-white/90 mb-4">{generatedBeverage.description}</p>

                <MealImageSlot imageUrl={generatedBeverage.imageUrl} mealName={generatedBeverage.name} isLoading={beverageImageLoading} />

                {generatedBeverage.servingSize && (
                  <div className="mb-4 p-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-white">
                      <Zap className="h-4 w-4 text-orange-400" />
                      <span className="font-medium">Serving Size:</span>{" "}
                      {generatedBeverage.servingSize}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                  {(["calories", "protein"] as const).map((key) => {
                    const value = Number(getNutrition(generatedBeverage)[key] ?? 0);
                    return (
                      <div key={key} className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                        <div className="text-lg font-bold text-white">{value}{key !== "calories" && "g"}</div>
                        <div className="text-xs text-white capitalize">{key}</div>
                      </div>
                    );
                  })}
                  {(() => {
                    const totalCarbs = Number(getNutrition(generatedBeverage).carbs ?? 0);
                    const { starchyCarbs, fibrousCarbs } = deriveSplitCarbs(generatedBeverage.ingredients ?? [], totalCarbs);
                    return (
                      <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                        <div className="text-lg font-bold text-white">{totalCarbs}g</div>
                        <div className="text-xs text-white">Carbs</div>
                        {(totalCarbs > 0 || starchyCarbs > 0 || fibrousCarbs > 0) && (
                          <div className="text-xs text-white/80 mt-1 font-medium">
                            <span className="text-amber-300">{Math.round(starchyCarbs)}S</span>
                            {" / "}
                            <span className="text-green-300">{Math.round(fibrousCarbs)}F</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                    <div className="text-lg font-bold text-white">{Number(getNutrition(generatedBeverage).fat ?? 0)}g</div>
                    <div className="text-xs text-white">Fat</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <HealthBadgesPopover badges={generatedBeverage.medicalBadges || []} align="start" />
                      <h3 className="font-semibold text-white">Medical Safety</h3>
                    </div>
                    <TrashButton size="sm" ariaLabel="Remove beverage" title="Remove beverage" confirm={true} confirmMessage="Remove this beverage?" onClick={() => setGeneratedBeverage(null)} />
                  </div>
                </div>

                {generatedBeverage.ingredients?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2 text-white">Ingredients:</h4>
                    <ul className="text-sm text-white/80 space-y-1">
                      {generatedBeverage.ingredients.map((ing: any, i: number) => (
                        <li key={i}>{ing.displayText || `${ing.amount || ""} ${ing.unit || ""} ${ing.name || ing.item}`}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(() => {
                  const steps = normalizeInstructions(generatedBeverage.instructions);
                  if (steps.length === 0) return null;
                  const visibleSteps = instructionsExpanded ? steps : steps.slice(0, 3);
                  return (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2 text-white">Instructions:</h4>
                      <div className="space-y-2">
                        {visibleSteps.map((step, index) => (
                          <div
                            key={index}
                            className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors select-none ${activeStep === index ? "bg-orange-500/20 border border-orange-500/40" : "hover:bg-white/5"}`}
                            onClick={() => setActiveStep(activeStep === index ? null : index)}
                          >
                            <div className="min-w-[26px] h-[26px] w-[26px] rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{index + 1}</div>
                            <p className="text-sm leading-relaxed text-white/85">{step}</p>
                          </div>
                        ))}
                      </div>
                      {steps.length > 3 && (
                        <button
                          className="mt-2 text-xs text-orange-400 font-medium cursor-pointer active:text-orange-300 select-none"
                          onClick={() => { setInstructionsExpanded(!instructionsExpanded); if (instructionsExpanded) setActiveStep(null); }}
                        >
                          {instructionsExpanded ? "Show less" : `Show all ${steps.length} steps`}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {generatedBeverage.reasoning && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                      <Brain className="h-4 w-4" />
                      Why This Works For You:
                    </h4>
                    <p className="text-sm text-white/80">{generatedBeverage.reasoning}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <GlassButton
                    onClick={() => setLocation("/biometrics?from=athlete-beverage-creator&view=macros")}
                    className="w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-black text-white flex items-center justify-center text-center border border-white/30"
                  >
                    Add to Macros
                  </GlassButton>

                  {starchAlert.show && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-950/40 border border-amber-600/40 px-3 py-2.5 mb-1">
                      <Wheat className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-amber-300 text-xs font-medium">Starchy Carbs Already Covered</p>
                        <p className="text-amber-400/70 text-xs mt-0.5">{starchAlert.message}</p>
                      </div>
                      <button onClick={clearBeverageStarchAlert} className="text-amber-500/60 hover:text-amber-300 text-xs shrink-0">✕</button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <AddToMealPlanButton meal={generatedBeverage} />
                    <TranslateToggle
                      content={{ name: generatedBeverage.name, description: generatedBeverage.description, instructions: generatedBeverage.instructions, ingredients: generatedBeverage.ingredients }}
                      onTranslate={(translated) => {
                        setGeneratedBeverage((prev: any) => prev ? { ...prev, name: translated.name, description: translated.description || prev.description, instructions: typeof translated.instructions === "string" ? translated.instructions : prev.instructions, ingredients: translated.ingredients || prev.ingredients } : prev);
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <GlassButton
                      onClick={() => {
                        const mealData = { id: crypto.randomUUID(), name: generatedBeverage.name, description: generatedBeverage.description, ingredients: generatedBeverage.ingredients || [], instructions: generatedBeverage.instructions, imageUrl: generatedBeverage.imageUrl };
                        localStorage.setItem("mpm_chefs_kitchen_meal", JSON.stringify(mealData));
                        localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");
                        setLocation("/lifestyle/chefs-kitchen");
                      }}
                      className="flex-1 bg-blue-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                    >
                      Prepare w/ Chef
                    </GlassButton>
                    <ShareRecipeButton
                      recipe={{ name: generatedBeverage.name, description: generatedBeverage.description, nutrition: generatedBeverage.nutrition, ingredients: (generatedBeverage.ingredients ?? []).map((ing: any) => ({ name: ing.name || ing.item, amount: ing.amount, unit: ing.unit })) }}
                      className="flex-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="h-20" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
