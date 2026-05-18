import { useEffect, useState, useRef } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeDiet, mealMatchesDiet } from "@/utils/dietaryFilter";
import {
  DietGuardIntercept,
  DietAdaptedNotice,
} from "@/components/DietGuardIntercept";
import { useDietGuardPrecheck } from "@/hooks/useDietGuardPrecheck";
import DietStyleBadge from "@/components/DietStyleBadge";
import MealClassificationPill from "@/components/MealClassificationPill";
import KosherProTip from "@/components/KosherProTip";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Sparkles,
  ChefHat,
  Loader2,
  Users,
  Brain,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";
import { useToast } from "@/hooks/use-toast";
import {
  isAllergyRelatedError,
  formatAllergyAlertDescription,
} from "@/utils/allergyAlert";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import {
  generateMedicalBadges,
  getUserMedicalProfile,
} from "@/utils/medicalPersonalization";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { GlucoseGuardToggle } from "@/components/GlucoseGuardToggle";
import { FlavorToggle } from "@/components/FlavorToggle";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import { setQuickView } from "@/lib/macrosQuickView";
import {
  extractTimerSeconds,
  formatTimeRemaining,
} from "@/components/chefs-kitchen/timerUtils";
import {
  KITCHEN_COOK_READY,
  KITCHEN_TIMER_START,
  KITCHEN_TIMER_DONE,
  KITCHEN_PLATING,
  KITCHEN_COOK_SETUP,
  extractEquipmentFromInstructions,
} from "@/components/copilot/scripts/kitchenStudioScripts";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import FavoriteButton from "@/components/FavoriteButton";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import ServingInstructionsBlock from "@/components/ServingInstructionsBlock";
import { normalizeInstructions } from "@/utils/normalizeInstructions";

type KitchenMode = "studio" | "prepare";

function getInitialMode(): { mode: KitchenMode; meal: GeneratedMeal | null } {
  try {
    const externalPrepare = localStorage.getItem(
      "mpm_chefs_kitchen_external_prepare",
    );
    const saved = localStorage.getItem("mpm_chefs_kitchen_meal");
    if (externalPrepare === "true" && saved) {
      const parsed = JSON.parse(saved) as GeneratedMeal;
      parsed.instructions = normalizeInstructions(parsed.instructions);
      return { mode: "prepare", meal: parsed };
    }
  } catch {}
  return { mode: "studio", meal: null };
}

interface GeneratedMeal {
  id: string;
  name: string;
  description?: string;
  mealType?: string;
  ingredients: Array<{
    name: string;
    quantity?: string;
    amount?: number;
    unit?: string;
    notes?: string;
  }>;
  instructions: string[] | string;
  imageUrl?: string | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  medicalBadges?: string[];
  flags?: string[];
  servingSize?: string;
  servings?: number;
  reasoning?: string;
  dietaryComplianceVerified?: boolean;
  dietClassification?: import("@/components/MealClassificationPill").DietClassification | null;
}

const COOK_METHODS: { label: string; emoji: string }[] = [
  { label: "Stovetop", emoji: "🍳" },
  { label: "Oven", emoji: "🔥" },
  { label: "Air Fryer", emoji: "💨" },
  { label: "Grill", emoji: "🥩" },
  { label: "Instant Pot", emoji: "⚡" },
  { label: "Slow Cooker", emoji: "🫕" },
  { label: "No-Cook", emoji: "🥗" },
];

export default function ChefsKitchenPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const quickTour = useQuickTour("chefs-kitchen");

  const initialState = getInitialMode();
  const [mode, setMode] = useState<KitchenMode>(initialState.mode);
  const [externalMeal] = useState<GeneratedMeal | null>(initialState.meal);

  // Capture origin before clearing it — used by the back button to return
  // the user to whichever page launched Guided Cooking.
  const [originPath] = useState<string>(() => {
    try {
      return localStorage.getItem("mpm_chefs_kitchen_origin") || "/lifestyle";
    } catch {
      return "/lifestyle";
    }
  });

  useEffect(() => {
    if (initialState.mode === "prepare") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    localStorage.removeItem("mpm_chefs_kitchen_external_prepare");
    localStorage.removeItem("mpm_chefs_kitchen_origin");
    localStorage.removeItem("mpm_chefs_kitchen_prep");
  }, []);

  // Phase 1 inputs
  const [dishIdea, setDishIdea] = useState("");
  const [cookMethod, setCookMethod] = useState("");
  const [ingredientNotes, setIngredientNotes] = useState("");
  const [servings, setServings] = useState<number>(2);

  // Phase 2 state
  const [prepStep, setPrepStep] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voice (Phase 2 only)
  const [isPlaying, setIsPlaying] = useState(false);
  const { speak, stop: stopChef } = useChefVoice(setIsPlaying);

  // Timer countdown effect
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            speak(KITCHEN_TIMER_DONE);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTimerRunning, timerSeconds > 0]);

  // Generation state
  const [isGeneratingMeal, setIsGeneratingMeal] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedMeal, setGeneratedMeal] = useState<GeneratedMeal | null>(
    externalMeal,
  );
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [mealOptions, setMealOptions] = useState<any[]>([]);
  const [isPlatingMeal, setIsPlatingMeal] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Display meal (for translations)
  const [displayMeal, setDisplayMeal] = useState<GeneratedMeal | null>(null);
  const [kitchenInstructionsExpanded, setKitchenInstructionsExpanded] = useState(false);
  const [kitchenActiveStep, setKitchenActiveStep] = useState<number | null>(null);
  const mealToShow = displayMeal || generatedMeal;

  // Diet guard
  const {
    alert: dietAlert,
    decision: dietDecision,
    checkDiet,
    clearAlert: clearDietAlert,
    setDecision: setDietDecision,
    triggerAlert: triggerDietAlert,
    activeDiet,
  } = useDietGuardPrecheck();
  const [dietAdaptedNotice, setDietAdaptedNotice] = useState<string | null>(null);

  // Safety guard
  const [safetyEnabled, setSafetyEnabled] = useState(true);
  const [flavorPersonal, setFlavorPersonal] = useState(true);
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

  const mealOptionsRef = useRef<HTMLDivElement | null>(null);

  // Scroll meal options into view whenever they appear
  useEffect(() => {
    if (mealOptions.length > 0 && mealOptionsRef.current) {
      setTimeout(() => {
        mealOptionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, [mealOptions.length]);

  // Same pattern as CreateWithChefModal: set flag + token only, useEffect fires generation
  const handleSafetyOverride = (enabled: boolean, token?: string) => {
    setSafetyEnabled(enabled);
    if (token) {
      setOverrideToken(token);
      setPendingGeneration(true);
    }
  };

  // Retry gate — fires once override token lands and generation is idle
  useEffect(() => {
    if (pendingGeneration && overrideToken && !isGeneratingMeal && !safetyChecking) {
      setPendingGeneration(false);
      executeGeneration();
    }
  }, [pendingGeneration, overrideToken, isGeneratingMeal, safetyChecking]);

  // Recent meals
  const getRecentMealsChef = (): string[] => {
    try { return JSON.parse(sessionStorage.getItem("ck_recent_meals") || "[]"); } catch { return []; }
  };
  const addRecentMealChef = (mealName: string): void => {
    try {
      const recent = getRecentMealsChef();
      const updated = [mealName, ...recent.filter((m: string) => m !== mealName)].slice(0, 3);
      sessionStorage.setItem("ck_recent_meals", JSON.stringify(updated));
    } catch {}
  };

  const CHEF_MEAL_KEY = "mpm_chefs_kitchen_meal";

  // Load persisted meal on mount
  useEffect(() => {
    if (externalMeal) return;
    try {
      const saved = localStorage.getItem(CHEF_MEAL_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GeneratedMeal;
        setGeneratedMeal(parsed);
        if (parsed.servings) setServings(parsed.servings);
        setMode("studio");
      }
    } catch {}
  }, [externalMeal]);

  // Persist meal when generated
  useEffect(() => {
    if (generatedMeal) {
      try {
        localStorage.setItem(CHEF_MEAL_KEY, JSON.stringify(generatedMeal));
      } catch {}
    }
  }, [generatedMeal]);

  // Persist prep state
  useEffect(() => {
    if (mode === "prepare" && generatedMeal) {
      try {
        localStorage.setItem(
          "mpm_chefs_kitchen_prep",
          JSON.stringify({ prepStep, timerSeconds, isTimerRunning, mealId: generatedMeal.id }),
        );
      } catch {}
    }
  }, [mode, prepStep, timerSeconds, isTimerRunning, generatedMeal]);

  // Load prep state when meal is restored
  useEffect(() => {
    if (generatedMeal && mode === "studio") {
      try {
        const saved = localStorage.getItem("mpm_chefs_kitchen_prep");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.mealId === generatedMeal.id && parsed.prepStep > 0) {
            setPrepStep(parsed.prepStep);
            setTimerSeconds(parsed.timerSeconds || 0);
            setIsTimerRunning(parsed.isTimerRunning || false);
            setMode("prepare");
          }
        }
      } catch {}
    }
  }, [generatedMeal?.id]);

  // Phase 2: voice cue on entering first cooking step
  useEffect(() => {
    if (mode === "prepare" && prepStep === 1) {
      speak(KITCHEN_COOK_READY);
    }
  }, [prepStep, mode]);

  // Reset displayMeal when generatedMeal changes
  useEffect(() => {
    setDisplayMeal(null);
  }, [generatedMeal]);

  useEffect(() => {
    document.title = "Create a Dish | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Restart — clears Phase 1 inputs and generation state, returns to studio input
  const restartKitchenStudio = () => {
    setDishIdea("");
    setCookMethod("");
    setIngredientNotes("");
    setServings(2);
    setIsGeneratingMeal(false);
    setGenerationProgress(0);
    setGeneratedMeal(null);
    setGenerationError(null);
    setMealOptions([]);
    setPrepStep(0);
    setIsTimerRunning(false);
    setTimerSeconds(0);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    try {
      localStorage.removeItem("mpm_chefs_kitchen_meal");
      localStorage.removeItem("mpm_chefs_kitchen_prep");
    } catch {}
    setMode("studio");
  };

  // Unified execution function — reads live state, same contract as CreateWithChefModal.
  // Called from startOpenKitchen on first attempt, and from the retry useEffect after override.
  const executeGeneration = async (dietAdaptOverride = false) => {
    const chefPromptParts = [`Create with Chef: ${dishIdea}`];
    if (cookMethod) chefPromptParts.push(`Cooking method: ${cookMethod}`);
    if (ingredientNotes) chefPromptParts.push(`Preferences: ${ingredientNotes}`);
    const cravingInput = chefPromptParts.join(". ");

    setIsGeneratingMeal(true);
    setGenerationProgress(10);
    setGenerationError(null);

    progressIntervalRef.current = setInterval(() => {
      setGenerationProgress((p) => {
        if (p >= 90) return p;
        return p + Math.floor(Math.random() * 8) + 4;
      });
    }, 700);

    try {
      const response = await fetch(apiUrl("/api/meals/craving-creator"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          cravingInput,
          targetMealType: "dinner",
          servings,
          dietaryRestrictions: normalizeDiet(user?.dietaryRestrictions),
          skipPalate: !flavorPersonal,
          excludeMeals: getRecentMealsChef(),
          safetyMode: overrideToken ? "CUSTOM_AUTHENTICATED" : "STRICT",
          overrideToken: overrideToken || undefined,
          dietAdaptOverride,
        }),
      });

      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      if (!response.ok) {
        let errorData: any = null;
        try { errorData = await response.json(); } catch { /* non-fatal */ }
        if (errorData?.safetyBlocked || errorData?.safetyAmbiguous) {
          setGenerationProgress(0);
          setIsGeneratingMeal(false);
          setSafetyAlert({
            show: true,
            result: errorData.safetyBlocked ? "BLOCKED" : "AMBIGUOUS",
            blockedTerms: errorData.blockedTerms || [],
            blockedCategories: [],
            ambiguousTerms: errorData.ambiguousTerms || [],
            message: errorData.error || "Safety alert detected",
            suggestion: errorData.suggestion,
          });
          return;
        }
        const errText = errorData ? JSON.stringify(errorData) : `${response.status}`;
        throw new Error(`Failed to generate meal: ${errText}`);
      }

      const data = await response.json();

      if (data.safetyBlocked || data.safetyAmbiguous) {
        setGenerationProgress(0);
        setIsGeneratingMeal(false);
        setSafetyAlert({
          show: true,
          result: data.safetyBlocked ? "BLOCKED" : "AMBIGUOUS",
          blockedTerms: data.blockedTerms || [],
          blockedCategories: [],
          ambiguousTerms: data.ambiguousTerms || [],
          message: data.error || "Safety alert detected",
          suggestion: data.suggestion,
        });
        return;
      }

      if (data.meals && Array.isArray(data.meals) && data.meals.length > 0) {
        setGenerationProgress(0);
        setIsGeneratingMeal(false);
        const userDiet2 = normalizeDiet(user?.dietaryRestrictions);
        if (data.dietAdapted) {
          setDietAdaptedNotice(data.dietNotice || `Adapted for your ${userDiet2} diet.`);
          clearDietAlert();
        }
        setMealOptions(data.meals);
        return;
      }

      const meal = data.meal;
      if (!meal) throw new Error("No meal data returned from API");

      const userDiet2 = normalizeDiet(user?.dietaryRestrictions);
      if (data.dietAdapted) {
        setDietAdaptedNotice(data.dietNotice || `Adapted for your ${userDiet2} diet.`);
        clearDietAlert();
      } else if (!overrideToken && activeDiet && dietDecision !== "let_chef_adapt" && !mealMatchesDiet(userDiet2, meal)) {
        setGenerationProgress(0);
        setIsGeneratingMeal(false);
        triggerDietAlert([], `This meal may not fully match your ${userDiet2} diet.`);
        return;
      }

      const srcNutrition = meal.nutrition || {};
      const nutritionCalories = srcNutrition.calories ?? meal.calories ?? 0;
      const nutritionProtein = srcNutrition.protein ?? meal.protein ?? 0;
      const nutritionCarbs = srcNutrition.carbs ?? meal.carbs ?? 0;
      const nutritionFat = srcNutrition.fat ?? meal.fat ?? 0;

      const normalizedMeal: GeneratedMeal = {
        id: meal.id || crypto.randomUUID(),
        name: meal.name || "Chef's Creation",
        description: meal.description || meal.reasoning,
        mealType: meal.mealType || "dinner",
        ingredients: Array.isArray(meal.ingredients)
          ? meal.ingredients.map((ing: any) => {
              if (typeof ing === "string") return { name: ing };
              return {
                name: ing.name || ing.item || "",
                quantity: ing.quantity,
                amount: ing.amount ?? ing.grams,
                unit: ing.unit ?? "g",
                notes: ing.notes ?? "",
              };
            })
          : [],
        instructions: normalizeInstructions(meal.cookingInstructions || meal.instructions),
        imageUrl: meal.imageUrl ?? null,
        calories: nutritionCalories,
        protein: nutritionProtein,
        carbs: nutritionCarbs,
        fat: nutritionFat,
        nutrition: { calories: nutritionCalories, protein: nutritionProtein, carbs: nutritionCarbs, fat: nutritionFat },
        medicalBadges: Array.isArray(meal.medicalBadges) ? meal.medicalBadges : [],
        flags: Array.isArray(meal.flags) ? meal.flags : [],
        servingSize: meal.servingSize || `${servings} ${servings === 1 ? "serving" : "servings"}`,
        servings: meal.servings || servings,
        reasoning: meal.reasoning,
        dietClassification: meal.dietClassification ?? null,
      };

      setGenerationProgress(100);
      setIsGeneratingMeal(false);
      setGeneratedMeal(normalizedMeal);
      addRecentMealChef(normalizedMeal.name);
    } catch (error) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setIsGeneratingMeal(false);
      const errorMessage = error instanceof Error ? error.message : "Something went wrong";
      if (isAllergyRelatedError(errorMessage)) {
        setGenerationError(`⚠️ ALLERGY ALERT: ${formatAllergyAlertDescription(errorMessage)}`);
      } else {
        setGenerationError(`${errorMessage}. Please try again.`);
      }
    }
  };

  // Entry point from UI — runs preflights then executes generation.
  const startOpenKitchen = async (skipDietCheck = false, dietAdaptOverride = false) => {
    if (!dishIdea.trim()) {
      toast({
        title: "Tell us what you want to make",
        description: "Enter a dish idea to get started.",
        variant: "destructive",
      });
      return;
    }

    setDietAdaptedNotice(null);

    if (!hasActiveOverride) {
      const requestDescription = `${dishIdea} ${cookMethod} ${ingredientNotes}`.trim();
      const isSafe = await checkSafety(requestDescription, "chefs-kitchen");
      if (!isSafe) return;
    }

    if (activeDiet && !skipDietCheck) {
      const requestText = `${dishIdea} ${cookMethod} ${ingredientNotes}`.trim();
      const dietOk = checkDiet(requestText);
      if (!dietOk) return;
    }

    await executeGeneration(dietAdaptOverride);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* Header */}
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 h-14 flex items-center gap-3">
            <button
              onClick={() => setLocation(originPath)}
              className="flex items-center justify-center text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
              data-testid="button-back-to-lifestyle"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-white truncate">Create a Dish</h1>
            <img
              src="/icons/chef.png"
              alt="Chef"
              className="w-8 h-8 rounded-full ring-2 ring-white/10 shadow flex-shrink-0"
              draggable={false}
            />
            <div className="flex-grow" />
            <QuickTourButton onClick={quickTour.openTour} className="flex-shrink-0" />
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="px-4 space-y-4 pb-32"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 68px)" }}
      >
        {/* STUDIO MODE */}
        {mode === "studio" && (
          <div className="space-y-4">

            {/* PHASE 1 INPUT CARD — shown when no meal has been generated yet and no options pending */}
            {!generatedMeal && !isGeneratingMeal && mealOptions.length === 0 && (
              <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                <CardContent className="p-4 space-y-5">
                  {/* Header */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      <h2 className="text-lg font-bold text-white">Create a Dish</h2>
                    </div>
                    <p className="text-sm text-white/70">
                      Tell us what you want to make — we'll build it with you.
                    </p>
                  </div>

                  {/* Dish Idea */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">
                      What are we making? <span className="text-orange-400">*</span>
                    </label>
                    <textarea
                      value={dishIdea}
                      onChange={(e) => setDishIdea(e.target.value)}
                      placeholder="Describe the dish, flavor, or vibe — e.g. spicy chicken bowl, something creamy with pasta..."
                      rows={3}
                      className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 resize-none focus:outline-none focus:border-orange-500/50 transition"
                    />
                  </div>

                  {/* Cooking Method */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Cooking method <span className="text-white/40 font-normal">(optional)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COOK_METHODS.map(({ label, emoji }) => (
                        <div key={label} className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCookMethod(cookMethod === label ? "" : label)}
                            className={`w-12 h-12 rounded-xl text-xl flex items-center justify-center border transition ${
                              cookMethod === label
                                ? "bg-orange-600 border-orange-500"
                                : "bg-black/40 border-white/20 hover:border-white/40"
                            }`}
                          >
                            {emoji}
                          </button>
                          <span className="text-[10px] text-white leading-tight text-center">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ingredient Notes */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">
                      Ingredients to include or avoid <span className="text-white/40 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={ingredientNotes}
                      onChange={(e) => setIngredientNotes(e.target.value)}
                      placeholder="e.g. no dairy, add spinach, avoid nuts..."
                      className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-orange-500/50 transition"
                    />
                  </div>

                  {/* Servings */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Servings
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          onClick={() => setServings(n)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                            servings === n
                              ? "bg-orange-600 border-orange-500 text-white"
                              : "bg-black/40 border-white/20 text-white/70 hover:border-white/40"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Guards */}
                  <div className="flex flex-row items-center justify-end gap-3">
                    <GlucoseGuardToggle />
                    <SafetyGuardToggle
                      safetyEnabled={safetyEnabled}
                      onSafetyChange={handleSafetyOverride}
                      disabled={isGeneratingMeal || safetyChecking}
                    />
                  </div>

                  <div className="py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                    <FlavorToggle
                      flavorPersonal={flavorPersonal}
                      onFlavorChange={setFlavorPersonal}
                      disabled={isGeneratingMeal || safetyChecking}
                    />
                  </div>

                  {/* Safety Banner */}
                  <SafetyGuardBanner
                    alert={safetyAlert}
                    mealRequest={`${dishIdea} ${cookMethod}`}
                    onDismiss={clearSafetyAlert}
                    onOverrideSuccess={(token) => handleSafetyOverride(false, token)}
                  />

                  {/* Diet Guard */}
                  <DietGuardIntercept
                    alert={dietAlert}
                    onDecision={(decision) => {
                      if (decision === "pick_something_else") {
                        clearDietAlert();
                      } else if (decision === "let_chef_adapt" || decision === "continue_anyway") {
                        setDietDecision(decision);
                        startOpenKitchen(true, true);
                      }
                    }}
                  />

                  {/* Create Button */}
                  <button
                    className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-white font-semibold text-sm transition disabled:opacity-50"
                    onClick={() => startOpenKitchen()}
                    disabled={safetyChecking}
                    data-testid="button-generate-meal"
                  >
                    {safetyChecking ? "Checking..." : "Create in Kitchen"}
                  </button>
                </CardContent>
              </Card>
            )}

            {/* GENERATING */}
            {isGeneratingMeal && !generatedMeal && (
              <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                <CardContent className="p-4">
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 text-lime-500 mx-auto mb-4 animate-spin" />
                    <p className="text-sm text-white/80 mb-4">Creating your dish...</p>
                    <div className="w-full bg-black/40 border border-white/20 rounded-lg h-3 overflow-hidden">
                      <div
                        className="bg-lime-600 h-full transition-all duration-500"
                        style={{ width: `${generationProgress}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ERROR */}
            {generationError && !isGeneratingMeal && (
              <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                <CardContent className="p-4 text-center py-6">
                  <p className="text-sm text-red-400 mb-4">{generationError}</p>
                  <button
                    className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-white font-semibold text-sm transition"
                    onClick={() => { setGenerationError(null); startOpenKitchen(); }}
                  >
                    Try Again
                  </button>
                </CardContent>
              </Card>
            )}

            {/* MEAL OPTIONS PANEL */}
            {!isGeneratingMeal && mealOptions.length > 0 && (
              <Card ref={mealOptionsRef as any} className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold text-base">Pick your favorite</span>
                    <span className="text-white/50 text-sm">{mealOptions.length} options</span>
                  </div>
                  {isPlatingMeal && (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <div className="w-8 h-8 border-4 border-lime-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-white/80 text-sm font-medium">Chef is plating your meal…</p>
                    </div>
                  )}
                  {!isPlatingMeal && mealOptions.map((option, idx) => (
                    <div key={idx} className="bg-black/30 border border-white/20 rounded-xl p-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm mb-1 truncate">{option.name}</p>
                        <p className="text-white/60 text-xs mb-2 line-clamp-2">{option.description}</p>
                        <div className="flex gap-3 text-xs text-white/50 flex-wrap">
                          <span>{option.nutrition?.calories ?? option.calories ?? "—"} cal</span>
                          <span>{option.nutrition?.protein ?? option.protein ?? "—"}g protein</span>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          addRecentMealChef(option.name);
                          setIsPlatingMeal(true);
                          let finalMeal = { ...option };
                          try {
                            const controller = new AbortController();
                            const timeout = setTimeout(() => controller.abort(), 20000);
                            const imgRes = await fetch(apiUrl("/api/meal-images/generate"), {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              signal: controller.signal,
                              body: JSON.stringify({
                                mealName: option.name,
                                ingredients: (option.ingredients || []).map((i: any) => i.name || i),
                                style: "overhead",
                                mealType: "dinner",
                              }),
                            });
                            clearTimeout(timeout);
                            if (imgRes.ok) {
                              const imgData = await imgRes.json();
                              if (imgData.success && imgData.image?.url) {
                                finalMeal = { ...finalMeal, imageUrl: imgData.image.url };
                              }
                            }
                          } catch {}
                          const srcN = finalMeal.nutrition || {};
                          const normalizedOption: GeneratedMeal = {
                            id: finalMeal.id || crypto.randomUUID(),
                            name: finalMeal.name || "Chef's Creation",
                            description: finalMeal.description || "",
                            mealType: finalMeal.mealType || "dinner",
                            ingredients: Array.isArray(finalMeal.ingredients)
                              ? finalMeal.ingredients.map((ing: any) =>
                                  typeof ing === "string" ? { name: ing } : { name: ing.name || ing.item || "", quantity: ing.quantity, amount: ing.amount, unit: ing.unit, notes: ing.notes || "" }
                                )
                              : [],
                            instructions: normalizeInstructions(finalMeal.cookingInstructions || finalMeal.instructions),
                            imageUrl: finalMeal.imageUrl ?? null,
                            calories: srcN.calories ?? finalMeal.calories ?? 0,
                            protein: srcN.protein ?? finalMeal.protein ?? 0,
                            carbs: srcN.carbs ?? finalMeal.carbs ?? 0,
                            fat: srcN.fat ?? finalMeal.fat ?? 0,
                            nutrition: { calories: srcN.calories ?? finalMeal.calories ?? 0, protein: srcN.protein ?? finalMeal.protein ?? 0, carbs: srcN.carbs ?? finalMeal.carbs ?? 0, fat: srcN.fat ?? finalMeal.fat ?? 0 },
                            medicalBadges: Array.isArray(finalMeal.medicalBadges) ? finalMeal.medicalBadges : [],
                            flags: Array.isArray(finalMeal.flags) ? finalMeal.flags : [],
                            servingSize: finalMeal.servingSize || `${servings} ${servings === 1 ? "serving" : "servings"}`,
                            servings: finalMeal.servings || servings,
                            reasoning: finalMeal.reasoning,
                            dietClassification: finalMeal.dietClassification ?? null,
                          };
                          setMealOptions([]);
                          setGeneratedMeal(normalizedOption);
                          setIsPlatingMeal(false);
                        }}
                        className="shrink-0 bg-lime-600 hover:bg-lime-500 active:scale-95 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all"
                      >
                        Pick This
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setMealOptions([])} className="w-full text-xs text-white/40 hover:text-white/70 py-1 transition-colors">Dismiss</button>
                </CardContent>
              </Card>
            )}

            {/* MEAL CARD */}
            {generatedMeal && mealToShow && !isGeneratingMeal && (
              <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
                <CardContent className="p-4 space-y-4">
                  {/* DietGuard Intercept */}
                  <DietGuardIntercept
                    alert={dietAlert}
                    onDecision={(decision) => {
                      if (decision === "pick_something_else") {
                        clearDietAlert();
                        setGeneratedMeal(null);
                        setMealOptions([]);
                      } else if (decision === "let_chef_adapt" || decision === "continue_anyway") {
                        setDietDecision(decision);
                        startOpenKitchen(true, true);
                      }
                    }}
                    className="mt-3"
                  />

                  {/* Title Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-6 w-6 text-yellow-600" />
                      <h3 className="text-xl font-bold text-white">{mealToShow.name}</h3>
                      <FavoriteButton
                        title={generatedMeal.name}
                        sourceType="chefs-kitchen"
                        mealData={generatedMeal}
                      />
                    </div>
                    <button
                      onClick={restartKitchenStudio}
                      className="text-sm text-white/70 bg-white/10 px-3 py-1 rounded-lg transition-colors active:scale-[0.98]"
                    >
                      Create New
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <DietStyleBadge />
                    <MealClassificationPill dietClassification={mealToShow.dietClassification} />
                    {dietAdaptedNotice && (
                      <DietAdaptedNotice
                        diet={normalizeDiet(user?.dietaryRestrictions)}
                      />
                    )}
                    <KosherProTip
                      dietClassification={mealToShow.dietClassification}
                      isAdapted={!!dietAdaptedNotice}
                    />
                  </div>

                  {mealToShow.description && (
                    <p className="text-white/90">{mealToShow.description}</p>
                  )}

                  {/* Image */}
                  {mealToShow.imageUrl && (
                    <div className="rounded-lg overflow-hidden">
                      <img
                        key={mealToShow.imageUrl}
                        src={mealToShow.imageUrl}
                        alt={mealToShow.name}
                        className="w-full h-64 object-cover"
                      />
                    </div>
                  )}

                  {/* Serving Size */}
                  <div className="p-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-white">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">Serving Size:</span>
                      <span>{mealToShow.servingSize || `${servings} ${servings === 1 ? "serving" : "servings"}`}</span>
                    </div>
                  </div>

                  <ServingInstructionsBlock
                    servings={servings}
                    mealName={mealToShow.name}
                    description={mealToShow.description}
                  />

                  {/* Macros */}
                  {(() => {
                    const s = Math.max(1, Math.round(servings ?? 1));
                    return (
                      <>
                        {s > 1 && <p className="text-xs text-white/60 text-center">Macros shown per serving</p>}
                        <div className="grid grid-cols-4 gap-4 text-center">
                          {[
                            { label: "Calories", value: Math.round((mealToShow.calories || 0) / s), unit: "" },
                            { label: "Protein", value: Math.round((mealToShow.protein || 0) / s), unit: "g" },
                            { label: "Carbs", value: Math.round((mealToShow.carbs || 0) / s), unit: "g" },
                            { label: "Fat", value: Math.round((mealToShow.fat || 0) / s), unit: "g" },
                          ].map(({ label, value, unit }) => (
                            <div key={label} className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                              <div className="text-lg font-bold text-white">{value}{unit}</div>
                              <div className="text-xs text-white">{label}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}

                  {/* Medical Badges */}
                  {(() => {
                    const profile = getUserMedicalProfile(1);
                    const mealForBadges = {
                      name: generatedMeal.name,
                      calories: generatedMeal.calories || 0,
                      protein: generatedMeal.protein || 0,
                      carbs: generatedMeal.carbs || 0,
                      fat: generatedMeal.fat || 0,
                      ingredients: generatedMeal.ingredients.map((ing) => ({
                        name: ing.name,
                        amount: ing.amount ?? 1,
                        unit: (ing.unit ?? "serving").toLowerCase(),
                      })),
                    };
                    const medicalBadges = generatedMeal.medicalBadges?.length
                      ? generatedMeal.medicalBadges
                      : generateMedicalBadges(mealForBadges as any, profile);
                    return medicalBadges && medicalBadges.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <HealthBadgesPopover
                          badges={medicalBadges.map((b: any) =>
                            typeof b === "string" ? b : b.badge || b.id || b.condition || b.label,
                          )}
                        />
                        <h3 className="font-semibold text-white">Medical Safety</h3>
                      </div>
                    ) : null;
                  })()}

                  {/* Ingredients */}
                  {mealToShow.ingredients?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 text-white">
                        Ingredients{(servings ?? 1) > 1 ? ` (for ${servings} servings)` : ""}:
                      </h4>
                      <ul className="text-sm text-white/80 space-y-1">
                        {mealToShow.ingredients.map((ing, i) => (
                          <li key={i}>{ing.amount ?? ing.quantity} {ing.unit} {ing.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Instructions */}
                  {(() => {
                    const steps = normalizeInstructions(mealToShow.instructions);
                    if (steps.length === 0) return null;
                    const visibleSteps = kitchenInstructionsExpanded ? steps : steps.slice(0, 3);
                    return (
                      <div>
                        <h4 className="font-semibold mb-2 text-white">Instructions:</h4>
                        <div className="space-y-2">
                          {visibleSteps.map((step, index) => (
                            <div key={index}
                              className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors select-none ${kitchenActiveStep === index ? "bg-orange-500/20 border border-orange-500/40" : "hover:bg-white/5"}`}
                              onClick={() => setKitchenActiveStep(kitchenActiveStep === index ? null : index)}>
                              <div className="min-w-[26px] h-[26px] w-[26px] rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{index + 1}</div>
                              <p className="text-sm leading-relaxed text-white/85">{step}</p>
                            </div>
                          ))}
                        </div>
                        {steps.length > 3 && (
                          <button className="mt-2 text-xs text-orange-400 font-medium cursor-pointer active:text-orange-300 select-none"
                            onClick={() => { setKitchenInstructionsExpanded(!kitchenInstructionsExpanded); if (kitchenInstructionsExpanded) setKitchenActiveStep(null); }}>
                            {kitchenInstructionsExpanded ? "Show less" : `Show all ${steps.length} steps`}
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Reasoning */}
                  {mealToShow.reasoning && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                        <Brain className="h-4 w-4" />
                        Why This Works For You:
                      </h4>
                      <p className="text-sm text-white/80">{mealToShow.reasoning}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        const s = Math.max(1, Math.round(servings ?? 1));
                        setQuickView({
                          protein: Math.round((generatedMeal.protein || 0) / s),
                          carbs: Math.round((generatedMeal.carbs || 0) / s),
                          starchyCarbs: 0,
                          fibrousCarbs: 0,
                          fat: Math.round((generatedMeal.fat || 0) / s),
                          calories: Math.round((generatedMeal.calories || 0) / s),
                          dateISO: new Date().toISOString().slice(0, 10),
                          mealSlot: "snacks",
                        });
                        setLocation("/biometrics?from=chefs-kitchen&view=macros");
                      }}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-black hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-900 text-white font-semibold text-sm transition border border-white/30"
                    >
                      Add to Macros
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <AddToMealPlanButton meal={generatedMeal} />
                      <TranslateToggle
                        content={{
                          name: generatedMeal.name,
                          description: generatedMeal.description,
                          instructions: generatedMeal.instructions,
                          ingredients: generatedMeal.ingredients,
                        }}
                        onTranslate={(updated) => {
                          setDisplayMeal({
                            ...generatedMeal,
                            name: updated.name || generatedMeal.name,
                            description: updated.description || generatedMeal.description,
                            instructions: updated.instructions || generatedMeal.instructions,
                            ingredients: (updated.ingredients as any) || generatedMeal.ingredients,
                          });
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          stopChef();
                          setPrepStep(0);
                          setMode("prepare");
                        }}
                        className="flex-1 py-2 rounded-xl bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400 hover:from-red-400 hover:via-orange-400 hover:to-yellow-300 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5"
                        data-testid="button-prepare-meal"
                      >
                        Guided Cooking
                      </button>
                      <ShareRecipeButton
                        recipe={{
                          name: generatedMeal.name,
                          description: generatedMeal.description,
                          nutrition: generatedMeal.nutrition,
                          ingredients: generatedMeal.ingredients.map((ing) => ({
                            name: ing.name,
                            amount: String(ing.amount ?? ing.quantity ?? ""),
                            unit: ing.unit,
                          })),
                        }}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* PHASE TWO — PREPARE MODE (unchanged) */}
        {mode === "prepare" && generatedMeal && (
          <div className="space-y-4">
            <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
              <CardContent className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-orange-500" />
                    Preparing: {generatedMeal.name}
                  </h2>
                  <button
                    onClick={() => setMode("studio")}
                    className="text-sm text-white/70 hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>

                {/* STEP 0 — Mise en Place */}
                {prepStep === 0 && (
                  <div className="space-y-4">
                    <p className="text-sm text-white/80">
                      Before we start cooking, let's get everything ready.
                    </p>

                    <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 p-3">
                      <p className="text-sm font-semibold text-amber-300 mb-2">Equipment You'll Need</p>
                      <ul className="space-y-1">
                        {extractEquipmentFromInstructions(generatedMeal.instructions).map((item, i) => (
                          <li key={i} className="text-sm text-white/70 flex items-center gap-2">
                            <span className="text-amber-400">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-white/20 bg-black/40 p-3">
                      <p className="text-sm font-semibold text-white mb-2">Ingredients</p>
                      <ul className="space-y-1">
                        {(Array.isArray(generatedMeal.ingredients) ? generatedMeal.ingredients : []).map((ing, i) => (
                          <li key={i} className="text-sm text-white/70 flex items-center gap-2">
                            <span className="text-lime-500">•</span>
                            {typeof ing === "string"
                              ? ing
                              : `${(ing.amount ?? ing.quantity) || ""} ${ing.unit || ""} ${ing.name || ""}`.trim()}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 border border-orange-400/50 text-white text-sm font-medium hover:from-orange-500 hover:to-amber-400 animate-pulse transition"
                      onClick={() => speak(KITCHEN_COOK_SETUP)}
                    >
                      👉 Press to Start
                    </button>

                    <button
                      className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm"
                      onClick={() => {
                        stopChef();
                        setPrepStep(1);
                      }}
                    >
                      I'm Ready — Let's Cook
                    </button>
                  </div>
                )}

                {/* COOKING STEPS */}
                {prepStep > 0 &&
                  (() => {
                    const instructions = Array.isArray(generatedMeal.instructions)
                      ? generatedMeal.instructions
                      : [generatedMeal.instructions || ""];
                    const totalSteps = instructions.length;
                    const currentInstruction = instructions[prepStep - 1] || "";
                    const detectedTimer = extractTimerSeconds(currentInstruction);
                    const isFinalStep = prepStep === totalSteps;
                    const isPastFinalStep = prepStep > totalSteps;

                    if (isPastFinalStep) {
                      return (
                        <div className="space-y-4">
                          <div className="text-center py-4">
                            <Sparkles className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-white mb-2">Plating & Serving</h3>
                            <p className="text-sm text-white/80">
                              Divide evenly into {servings} {servings === 1 ? "portion" : "portions"}. Serve warm.
                            </p>
                            <p className="text-sm text-white/60 mt-2">
                              Optional: garnish with herbs, lemon, or fresh greens.
                            </p>
                          </div>

                          <button
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 border border-orange-400/50 text-white text-sm font-medium hover:from-orange-500 hover:to-amber-400 animate-pulse transition"
                            onClick={() => speak(KITCHEN_PLATING)}
                          >
                            👉 Press to Start
                          </button>

                          <div className="flex gap-3">
                            <button
                              className="flex-1 py-3 rounded-xl bg-black/40 border border-white/20 text-white text-sm"
                              onClick={() => {
                                stopChef();
                                setPrepStep(0);
                                setMode("studio");
                                try { localStorage.removeItem("mpm_chefs_kitchen_prep"); } catch {}
                              }}
                            >
                              Back to Meal Card
                            </button>
                            <button
                              className="flex-1 py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm"
                              onClick={() => {
                                stopChef();
                                restartKitchenStudio();
                              }}
                            >
                              Cook Another Meal
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {/* Step Progress */}
                        <div className="flex items-center justify-between text-sm text-white/70">
                          <span>Step {prepStep} of {totalSteps}</span>
                          <div className="flex gap-1">
                            {Array.from({ length: totalSteps }, (_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-full ${i < prepStep ? "bg-lime-500" : "bg-white/30"}`}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/20 bg-black/40 p-4">
                          <p className="text-sm text-white/90 leading-relaxed">{currentInstruction}</p>
                        </div>

                        <button
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 border border-orange-400/50 text-white text-sm font-medium hover:from-orange-500 hover:to-amber-400 animate-pulse transition"
                          onClick={() => speak(currentInstruction)}
                        >
                          👉 Press to Start
                        </button>

                        {(detectedTimer || isTimerRunning || timerSeconds > 0) && (
                          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                            {!isTimerRunning && timerSeconds === 0 && detectedTimer && (
                              <button
                                className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-medium text-sm flex items-center justify-center gap-2"
                                onClick={() => {
                                  stopChef();
                                  setTimerSeconds(detectedTimer);
                                  setIsTimerRunning(true);
                                  speak(KITCHEN_TIMER_START);
                                }}
                              >
                                <Play className="h-4 w-4" />
                                Start Timer ({Math.round(detectedTimer / 60)} min)
                              </button>
                            )}
                            {(isTimerRunning || timerSeconds > 0) && (
                              <div className="text-center space-y-3">
                                <p className="text-3xl font-mono font-bold text-white">
                                  {formatTimeRemaining(timerSeconds)}
                                </p>
                                <div className="flex gap-2 justify-center">
                                  {isTimerRunning ? (
                                    <button
                                      className="px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white text-sm flex items-center gap-2"
                                      onClick={() => { stopChef(); setIsTimerRunning(false); }}
                                    >
                                      <Pause className="h-4 w-4" />
                                      Pause
                                    </button>
                                  ) : (
                                    <button
                                      className="px-4 py-2 rounded-lg bg-lime-600 text-black text-sm flex items-center gap-2"
                                      onClick={() => { stopChef(); setIsTimerRunning(true); }}
                                    >
                                      <Play className="h-4 w-4" />
                                      Resume
                                    </button>
                                  )}
                                  <button
                                    className="px-4 py-2 rounded-lg bg-black/40 border border-white/20 text-white text-sm flex items-center gap-2"
                                    onClick={() => { stopChef(); setTimerSeconds(0); setIsTimerRunning(false); }}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                    Reset
                                  </button>
                                </div>
                                {timerSeconds === 0 && (
                                  <p className="text-lime-400 font-medium">Timer finished!</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex gap-3">
                          {prepStep > 1 && (
                            <button
                              className="flex-1 py-3 rounded-xl bg-black/40 border border-white/20 text-white text-sm"
                              onClick={() => {
                                stopChef();
                                setTimerSeconds(0);
                                setIsTimerRunning(false);
                                setPrepStep((s) => s - 1);
                              }}
                            >
                              Previous
                            </button>
                          )}
                          <button
                            className="flex-1 py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm"
                            onClick={() => {
                              stopChef();
                              setTimerSeconds(0);
                              setIsTimerRunning(false);
                              setPrepStep((s) => s + 1);
                            }}
                          >
                            {isFinalStep ? "Finish Cooking" : "Next Step"}
                          </button>
                        </div>

                        <button
                          className="w-full py-2 rounded-xl bg-black/40 border border-white/20 text-white/70 text-sm"
                          onClick={() => {
                            stopChef();
                            setMode("studio");
                          }}
                        >
                          Back to Meal Card
                        </button>
                      </div>
                    );
                  })()}
              </CardContent>
            </Card>
          </div>
        )}

        {generatedMeal && generatedMeal.ingredients?.length > 0 && (
          <div className="h-28" />
        )}
      </div>

      {/* Shopping Aggregate Bar */}
      {generatedMeal && generatedMeal.ingredients?.length > 0 && (
        <ShoppingAggregateBar
          ingredients={generatedMeal.ingredients.map((ing) => ({
            name: ing.name,
            qty: ing.amount ?? ing.quantity,
            unit: ing.unit || "",
          }))}
          source="Chef's Kitchen"
          sourceSlug="chefs-kitchen"
          aboveBottomNav={true}
        />
      )}
    </motion.div>
  );
}
