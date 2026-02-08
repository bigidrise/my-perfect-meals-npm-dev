// 🔒🔒🔒 CRAVING CREATOR FINAL LOCKDOWN (JANUARY 3, 2025) - DO NOT MODIFY
// Complete system lockdown per user command: API endpoints, JSX structure, macro logging, medical badges, image generation
// Zero-tolerance policy for modifications - system working perfectly for production deployment
// STABLE VERSION - Craving Creator (January 8, 2025)
// This is the working version with:
// - Enhanced craving matching logic (prevents incorrect partial matches)
// - GPT-4 fallback for complex requests (chicken burrito, chocolate chip cookies)
// - Disabled shopping list integration (Under Construction)
// - Removed food log functionality from Accept button
// - Accurate meal generation for any craving
// DO NOT MODIFY WITHOUT USER APPROVAL

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { isFeatureEnabled } from "@/lib/productionGates";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { GlassButton } from "@/components/glass";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Brain, Target, Sparkles, Home, Users, ArrowLeft, ChefHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isAllergyRelatedError, formatAllergyAlertDescription } from "@/utils/allergyAlert";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import {
  generateMedicalBadges,
  getUserMedicalProfile,
} from "@/utils/medicalPersonalization";
import { post } from "@/lib/api";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import { ProDietaryDirectives } from "@/components/ProDietaryDirectives";
import PhaseGate from "@/components/PhaseGate";
import { useAuth } from "@/contexts/AuthContext";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { GlucoseGuardToggle } from "@/components/GlucoseGuardToggle";
import { FlavorToggle } from "@/components/FlavorToggle";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import { useStarchGuardPrecheck } from "@/hooks/useStarchGuardPrecheck";
import { StarchGuardIntercept, StarchSubstitutionNotice } from "@/components/StarchGuardIntercept";

interface StructuredIngredient {
  name: string;
  quantity?: string | number;
  unit?: string;
  category?: string;
}

interface MealData {
  id: string;
  name: string;
  description: string;
  ingredients: StructuredIngredient[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  };
  instructions: string;
  cookingInstructions?: string[];
  reasoning: string;
  servingSize: string;
  medicalBadges: Array<{
    condition: string;
    compatible: boolean;
    reason: string;
    color: string;
  }>;
  imageUrl?: string;
}
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import { setQuickView } from "@/lib/macrosQuickView";
import TrashButton from "@/components/ui/TrashButton";
import { useCopilot } from "@/components/copilot/CopilotContext";
import FavoriteButton from "@/components/FavoriteButton";

// ---- Persist the generated meal so it never "disappears" ----
const CACHE_KEY = "cravingCreator.cache.v1";

type CachedCravingState = {
  generatedMeal: MealData | null;
  craving: string;
  servings: number;
  mealType: string;
  generatedAtISO: string;
};

function saveCravingCache(state: CachedCravingState) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {}
}

function loadCravingCache(): CachedCravingState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Minimal sanity checks
    if (!parsed?.generatedMeal?.id) return null;
    return parsed as CachedCravingState;
  } catch {
    return null;
  }
}

function clearCravingCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

// Utility to normalize macros shape from either meal.nutrition or top-level fields
function getMealNutrition(meal: any) {
  const n = meal?.nutrition || {};
  return {
    calories: Number(n.calories ?? meal.calories ?? 0),
    protein_g: Number(n.protein ?? n.protein_g ?? meal.protein ?? 0),
    carbs_g: Number(n.carbs ?? n.carbs_g ?? meal.carbs ?? 0),
    fat_g: Number(n.fat ?? n.fat_g ?? meal.fat ?? 0),
    starchyCarbs: Number(n.starchyCarbs ?? meal.starchyCarbs ?? 0),
    fibrousCarbs: Number(n.fibrousCarbs ?? meal.fibrousCarbs ?? 0),
  };
}

const CRAVING_TOUR_STEPS: TourStep[] = [
  {
    title: "Describe Your Craving",
    description: "Tell us what you’re craving by flavor, texture, or style.",
  },
  {
    title: "Set Preferences",
    description:
      "Add dietary preferences or restrictions like dairy-free or gluten-free.",
  },
  {
    title: "Create Your Meal",
    description:
      "Choose your servings and press Create to generate a healthier version of your craving.",
  },
];

export default function CravingCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { startWalkthrough } = useCopilot();
  const quickTour = useQuickTour("craving-creator");
  const [useOnboarding, setUseOnboarding] = useState(true); // ENFORCED: Always use onboarding for medical safety
  const [cravingInput, setCravingInput] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [savedMeals, setSavedMeals] = useState(new Set<string>());
  const [generatedMeals, setGeneratedMeals] = useState<MealData[]>([]);
  const [selectedDiet, setSelectedDiet] = useState<string>("");
  const [servings, setServings] = useState<number>(1); // NEW: Serving size support (1-10)
  const [isDeclinedMeal, setIsDeclinedMeal] = useState(false);
  const [declinedMealDate, setDeclinedMealDate] = useState("");
  const [declinedMealName, setDeclinedMealName] = useState("");
  const [replacingMeal, setReplacingMeal] = useState<any>(null);
  // 🔋 Progress bar state (real-time ticker like Restaurant Guide)
  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<number | null>(null);
  // Get actual user ID from auth context for medical safety
  const { user } = useAuth();
  const userId = user?.id || "";

  // 🎯 Auto-start walkthrough on first visit
  useEffect(() => {
    const hasSeenWalkthrough = localStorage.getItem(
      "walkthrough-seen-craving-creator",
    );
    if (!hasSeenWalkthrough) {
      // Small delay to ensure page is fully rendered
      const timer = setTimeout(() => {
        startWalkthrough("craving-creator");
        localStorage.setItem("walkthrough-seen-craving-creator", "true");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [startWalkthrough]);

  const urlParams = new URLSearchParams(window.location.search);
  const replaceId = urlParams.get("replace");
  const replaceName = urlParams.get("name");

  // Import replacement context functions
  const [replaceCtx, setReplaceCtx] = useState<any>(null);

  // Check for replacement context on mount
  useEffect(() => {
    import("@/lib/replacementContext").then(({ getReplaceCtx }) => {
      const ctx = getReplaceCtx();
      if (ctx) {
        setReplaceCtx(ctx);
      }
    });
  }, []);

  // Restore cached meal on mount (so generated meal comes back)
  useEffect(() => {
    const cached = loadCravingCache();
    if (cached?.generatedMeal?.id) {
      setGeneratedMeals([cached.generatedMeal]);
      setCravingInput(cached.craving || "");
      setServings(cached.servings || 1); // Restore servings
      toast({
        title: "🔄 Meal Restored",
        description:
          "Your generated meal will remain saved on this page until you create a new one.",
      });
    }

    // Emit ready event after page loads
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "cravingcreator-ready", event: "ready" },
      });
      window.dispatchEvent(event);
    }, 500);
  }, []); // Only run once on mount

  // Auto-save whenever relevant state changes (so it's always fresh)
  useEffect(() => {
    if (generatedMeals.length > 0 && generatedMeals[0]?.id) {
      saveCravingCache({
        generatedMeal: generatedMeals[0],
        craving: cravingInput,
        servings: servings,
        mealType: "snacks", // Default meal type
        generatedAtISO: new Date().toISOString(),
      });
    }
  }, [generatedMeals, cravingInput, servings]);

  useEffect(() => {
    const declined = localStorage.getItem("declinedMeal");
    if (declined) {
      const data = JSON.parse(declined);
      setIsDeclinedMeal(true);
      setDeclinedMealDate(data.date);
      setDeclinedMealName(data.name);
    }

    const replacing = localStorage.getItem("replacingMeal");
    if (replacing) {
      setReplacingMeal(JSON.parse(replacing));
    }
  }, []);

  // 🔋 Progress ticker functions (same as Restaurant Guide)
  const startProgressTicker = () => {
    if (tickerRef.current) return;
    setProgress(0); // Reset progress
    tickerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p < 90) {
          const next = p + Math.max(1, Math.floor((90 - p) * 0.07));
          return Math.min(next, 90);
        }
        return p;
      });
    }, 150);
  };

  const stopProgressTicker = () => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    setProgress(100); // Complete progress
  };

  // Handle meal saving
  const handleSaveMeal = async (
    mealId: string,
    mealName: string,
    ingredients: StructuredIngredient[],
  ) => {
    try {
      const response = await fetch(apiUrl("/api/meals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: mealId,
          name: mealName,
          ingredients: ingredients.map((ing) => ({
            item: ing.name,
            amount: ing.quantity || 1,
            unit: ing.unit || "unit",
          })),
          userId: userId,
        }),
      });

      if (response.ok) {
        setSavedMeals((prev) => new Set([...prev, mealId]));
        toast({
          title: "✅ Meal Saved!",
          description: `${mealName} has been saved to your meals.`,
        });
      } else {
        throw new Error("Failed to save meal");
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to save meal. Please try again.",
        variant: "destructive",
      });
    }
  };

  // 🔥 SIMPLIFIED: Use same pattern as Fridge Rescue (working system)
  const [isGenerating, setIsGenerating] = useState(false);

  // Safety override integration - always starts ON, auto-resets after generation
  const [safetyEnabled, setSafetyEnabled] = useState(true);
  
  // Flavor preference toggle - Personal = use user's palate, Neutral = for others
  const [flavorPersonal, setFlavorPersonal] = useState(true);
  
  // 🔐 SafetyGuard preflight system
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
  
  // 🥔 StarchGuard preflight system (Phase 3 Nutrition Budget Engine)
  const {
    alert: starchAlert,
    decision: starchDecision,
    checkStarch,
    clearAlert: clearStarchAlert,
    setDecision: setStarchDecision,
    isBlocked: starchBlocked,
  } = useStarchGuardPrecheck();
  
  // Track substituted terms for post-generation notice
  const [substitutedStarchTerms, setSubstitutedStarchTerms] = useState<string[]>([]);
  
  // 🔐 Pending request for SafetyGuard continuation bridge
  const [pendingGeneration, setPendingGeneration] = useState(false);
  
  // Handle safety override continuation - auto-generate when override token received
  const handleSafetyOverride = (enabled: boolean, token?: string) => {
    setSafetyEnabled(enabled);
    if (token) {
      setOverrideToken(token);
      clearSafetyAlert(); // Clear banner on successful override
      // Set pending flag - generation will auto-trigger
      setPendingGeneration(true);
    }
  };
  
  // Effect: Auto-generate when override token is set and generation is pending
  useEffect(() => {
    if (pendingGeneration && overrideToken && !isGenerating) {
      setPendingGeneration(false);
      handleGenerateMeal(true); // true = skip preflight (already have override)
    }
  }, [pendingGeneration, overrideToken, isGenerating]);
  
  // 🥔 Real-time Starch Guard check - triggers immediately as user types starchy ingredients
  useEffect(() => {
    if (cravingInput.trim().length >= 3 && starchDecision === 'pending') {
      checkStarch(cravingInput);
    }
  }, [cravingInput, starchDecision, checkStarch]);

  const handleGenerateMeal = async (skipPreflight = false) => {
    console.log("🔥 handleGenerateMeal called - craving:", cravingInput);

    if (!cravingInput.trim()) {
      console.log("❌ Empty craving input - showing toast");
      toast({
        title: "Missing Information",
        description: "Please describe what you're craving first!",
        variant: "destructive",
      });
      return;
    }

    // 🔐 Preflight safety check - BEFORE starting progress bar
    if (!skipPreflight && !hasActiveOverride) {
      const isSafe = await checkSafety(cravingInput, "craving-creator");
      if (!isSafe) {
        // Banner will show automatically via safetyAlert state
        return;
      }
    }
    
    // 🥔 Starch Guard preflight check - blocks if starchy + budget exhausted
    if (!skipPreflight && starchDecision !== 'let_chef_pick') {
      const starchOk = checkStarch(cravingInput);
      if (!starchOk) {
        // Intercept will show - user must choose before proceeding
        return;
      }
    }
    
    // Track if Chef is substituting starches (for post-generation notice)
    const chefSubstituting = starchDecision === 'let_chef_pick' && starchAlert.matchedTerms.length > 0;
    if (chefSubstituting) {
      setSubstitutedStarchTerms(starchAlert.matchedTerms);
    } else {
      setSubstitutedStarchTerms([]);
    }

    console.log("✅ Starting generation with:", {
      cravingInput,
      servings,
      selectedDiet,
      safetyEnabled,
      hasOverrideToken: !!overrideToken,
    });
    setIsGenerating(true);
    startProgressTicker();

    try {
      const url = apiUrl("/api/meals/craving-creator");
      console.log("📡 Fetching:", url);
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMealType: "snacks",
          cravingInput,
          dietaryRestrictions: selectedDiet || dietaryRestrictions,
          userId: userId,
          servings: servings,
          safetyMode: hasActiveOverride ? "CUSTOM_AUTHENTICATED" : "STRICT",
          overrideToken: hasActiveOverride ? overrideToken : undefined,
          skipPalate: !flavorPersonal,
        }),
      });

      const data = await response.json();
      
      // Check for safety blocks/ambiguous - show banner instead of error
      if (data.safetyBlocked || data.safetyAmbiguous) {
        stopProgressTicker();
        setIsGenerating(false);
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
      
      // Auto-reset safety state after generation attempt
      setSafetyEnabled(true);
      clearSafetyAlert();
      
      if (!response.ok) {
        if (data.error === "ALLERGY_SAFETY_BLOCK") {
          throw new Error(`🚨 Safety Alert: ${data.message}`);
        }
        throw new Error(data.message || "Failed to generate meal");
      }
      const meal = data.meal || data; // Handle both response formats

      stopProgressTicker();
      setGeneratedMeals([meal]);

      // Immediately cache the new meal so it survives navigation/refresh
      saveCravingCache({
        generatedMeal: meal,
        craving: cravingInput,
        servings: servings, // Use actual serving size from state
        mealType: "snacks",
        generatedAtISO: new Date().toISOString(),
      });

      toast({
        title: "✨ Meal Created!",
        description: `${meal.name} is ready for you.`,
      });

      // Emit generated event after successful meal creation
      setTimeout(() => {
        const event = new CustomEvent("walkthrough:event", {
          detail: { testId: "cravingcreator-generated", event: "done" },
        });
        window.dispatchEvent(event);
      }, 500);
    } catch (error: any) {
      stopProgressTicker();
      const errorMsg = error.message || "";
      if (isAllergyRelatedError(errorMsg)) {
        toast({
          title: "⚠️ ALLERGY ALERT",
          description: formatAllergyAlertDescription(errorMsg),
          variant: "warning",
        });
      } else {
        toast({
          title: "⚠️ ALLERGY ALERT",
          description: "SafetyGuard™ detected a potential concern. Try a different meal or adjust your request.",
          variant: "warning",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // helper to clear diet selection
  const clearDiet = () => {
    setSelectedDiet("");
    toast({
      title: "Preference cleared",
      description: "No dietary preference selected.",
    });
  };

  // Timezone-safe date helper
  function todayLocalISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  // Add meal to plan using replacement context
  async function addMealToPlan(meal: any) {
    if (!replaceCtx) return;

    const { useWeeklyPlan } = await import("@/hooks/useWeeklyPlan");
    const { clearReplaceCtx } = await import("@/lib/replacementContext");
    const { replaceOne } = useWeeklyPlan(userId, replaceCtx.weekKey);

    // Create meal object compatible with Weekly Plan
    const planMeal = {
      id: replaceCtx.mealId, // Use the original meal ID to replace it
      name: meal.name,
      mealType: replaceCtx.mealType,
      dayIndex: replaceCtx.dayIndex,
      weekKey: replaceCtx.weekKey,
      calories: meal.calories || 0,
      protein: meal.protein || 0,
      carbs: meal.carbs || 0,
      fat: meal.fat || 0,
      badges: meal.medicalBadges?.map((b: any) => b.condition) || [],
      ingredients: meal.ingredients || [],
      instructions:
        typeof meal.instructions === "string"
          ? [meal.instructions]
          : meal.instructions || [],
      source: "craving",
    };

    // Replace the meal
    replaceOne(replaceCtx.mealId, planMeal);

    // Clear replacement context
    clearReplaceCtx();

    toast({
      title: "✅ Meal Added to Plan!",
      description: `${meal.name} has been added to your weekly meal plan.`,
    });

    // Emit added event after successful add to plan
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "cravingcreator-added", event: "done" },
      });
      window.dispatchEvent(event);
    }, 300);

    // Navigate back to Weekly Meal Board
    setLocation("/weekly-meal-board");
  }

  return (
    <PhaseGate phase="PHASE_1_CORE" feature="craving-creator">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
      >
        {/* Universal Safe-Area Header */}
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-2 flex-nowrap overflow-hidden">
            {/* Back Button */}
            <button
              onClick={() => setLocation("/craving-creator-landing")}
              className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
              data-testid="button-back-to-hub"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>

            {/* Title */}
            <h1 className="text-lg font-bold text-white truncate min-w-0">
              Craving Creator
            </h1>

            <div className="flex-grow" />
            <QuickTourButton
              onClick={quickTour.openTour}
              className="flex-shrink-0"
            />
          </div>
        </div>

        {/* Main Content */}
        <div
          className={`max-w-2xl mx-auto px-4 ${generatedMeals.length > 0 ? "pb-32" : "pb-8"}`}
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          <div className="flex items-center justify-between mb-6">
            {/* Spacer for layout */}

            {replaceId && (
              <GlassButton
                onClick={() => {
                  setLocation("/emotion-ai");
                  localStorage.removeItem("replacingMeal");
                }}
                className="bg-black/10 backdrop-blur-none text-gray-700 border-white/30 hover:bg-white"
              >
                Return to Meal Hub Now
              </GlassButton>
            )}
          </div>

          {/* Create with Chef Entry Point */}
          <div className="relative mb-6">
            <div
              className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-50"
              style={{
                background:
                  "radial-gradient(120% 120% at 50% 0%, rgba(251,146,60,0.5), rgba(239,68,68,0.25), rgba(0,0,0,0))",
              }}
            />
            <Card
              className="relative cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-gradient-to-r from-black via-orange-950/40 to-black backdrop-blur-lg border border-orange-400/30 rounded-xl shadow-md overflow-hidden hover:shadow-[0_0_30px_rgba(251,146,60,0.4)] hover:border-orange-500/50"
              data-testid="cravingcreator-chef-studio"
              onClick={() => setLocation("/craving-studio")}
            >
              <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-black via-orange-600 to-black rounded-full border border-orange-400/30 shadow-lg z-10">
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
                <span className="text-white font-semibold text-[8px] tracking-wide">
                  Powered by Emotion AI™
                </span>
              </div>
              <CardContent className="p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 flex-shrink-0 text-orange-500" />
                    <h3 className="text-sm font-semibold text-white">
                      Chef's Kitchen Studio
                    </h3>
                  </div>
                  <p className="text-xs text-white/80 ml-6">
                    Step-by-step guided craving creation with Chef assistance
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {isDeclinedMeal && (
            <Card className="mb-6 w-full max-w-xl mx-auto bg-black/20 backdrop-blur-lg border border-white/20 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Target className="w-5 h-5 text-yellow-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-yellow-800">
                      Replacing Declined Meal
                    </h3>
                    <p className="text-sm text-yellow-700">
                      You declined "<strong>{declinedMealName}</strong>" on{" "}
                      {declinedMealDate}.
                      <br />
                      Your new creation will be automatically logged in your
                      food log.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create Craving Form */}
          <div className="w-full max-w-4xl mx-auto">
            <div>
              <Card className="shadow-2xl bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-xl text-white">
                    Quick Create
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-md font-medium text-white">
                        What are you craving?
                      </label>
                    </div>
                    <div className="relative">
                      <textarea
                        data-testid="cravingcreator-input-box"
                        data-wt="cc-description-input"
                        value={cravingInput}
                        onChange={(e) => setCravingInput(e.target.value)}
                        placeholder="e.g., I want something creamy chocolate with peanut butter swirl and crunchy topping - BE SPECIFIC and describe what you crave!"
                        className="w-full px-3 py-2 pr-10 bg-black text-white placeholder:text-white/50 border border-white/30 rounded-lg h-20 resize-none text-sm"
                        maxLength={300}
                      />
                      {cravingInput && (
                        <TrashButton
                          onClick={() => setCravingInput("")}
                          size="sm"
                          ariaLabel="Clear craving input"
                          title="Clear craving input"
                          className="absolute top-2 right-2"
                          data-testid="button-clear-craving"
                        />
                      )}
                    </div>
                    <p className="text-md text-white mt-1 text-center">
                      Use keyboard or voice texting for input.
                    </p>
                    <p className="text-xs text-white/70 mt-1 text-right">
                      {cravingInput.length}/300
                    </p>
                  </div>

                  {/* Dietary Preferences with clear support */}
                  <div>
                    <label className="block text-md mb-1 text-white">
                      Dietary Preferences (Optional)
                    </label>

                    <div className="flex items-center gap-2">
                      <Select
                        data-wt="cc-dietary-flags"
                        value={selectedDiet || "__none__"}
                        onValueChange={(v) =>
                          setSelectedDiet(v === "__none__" ? "" : v)
                        }
                      >
                        <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                          <SelectValue placeholder="Select dietary preferences" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            No preference (Clear)
                          </SelectItem>
                          <SelectItem value="keto">Keto/Low Carb</SelectItem>
                          <SelectItem value="paleo">Paleo</SelectItem>
                          <SelectItem value="vegan">Vegan</SelectItem>
                          <SelectItem value="vegetarian">Vegetarian</SelectItem>
                          <SelectItem value="gluten-free">
                            Gluten-Free
                          </SelectItem>
                          <SelectItem value="dairy-free">Dairy-Free</SelectItem>
                          <SelectItem value="mediterranean">
                            Mediterranean
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <GlassButton
                        data-wt="cc-clear-flags-button"
                        onClick={clearDiet}
                        disabled={!selectedDiet}
                        className="shrink-0 px-3 py-1 text-sm"
                        title="Clear dietary preference"
                      >
                        Clear
                      </GlassButton>
                    </div>
                  </div>

                  {/* NEW: Serving Size Dropdown */}
                  <div>
                    <label className="block text-md font-medium mb-1 text-white">
                      Number of Servings
                    </label>
                    <Select
                      data-wt="cc-servings-selector"
                      value={servings.toString()}
                      onValueChange={(v) => setServings(parseInt(v))}
                    >
                      <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 serving (just me)</SelectItem>
                        <SelectItem value="2">2 servings</SelectItem>
                        <SelectItem value="3">3 servings</SelectItem>
                        <SelectItem value="4">4 servings</SelectItem>
                        <SelectItem value="5">5 servings</SelectItem>
                        <SelectItem value="6">6 servings</SelectItem>
                        <SelectItem value="7">7 servings</SelectItem>
                        <SelectItem value="8">8 servings</SelectItem>
                        <SelectItem value="9">9 servings</SelectItem>
                        <SelectItem value="10">10 servings</SelectItem>
                      </SelectContent>
                    </Select>
                    
                  </div>

                  

                  {!selectedDiet && (
                    <div>
                      <label className="block text-md font-medium mb-1 text-white">
                        Custom Dietary Restrictions
                      </label>
                      <textarea
                        data-wt="cc-custom-restrictions"
                        value={dietaryRestrictions}
                        onChange={(e) => setDietaryRestrictions(e.target.value)}
                        placeholder="e.g., no nuts, low sodium, diabetic-friendly..."
                        className="w-full px-3 py-2 bg-black text-white placeholder:text-white/50 border border-white/30 rounded-lg h-16 resize-none text-md"
                        maxLength={250}
                      />
                      <p className="text-xs text-white/70 mt-1 text-right">
                        {dietaryRestrictions.length}/250
                      </p>
                    </div>
                  )}

                  {!replaceId && (
                    <p className="text-white/80 text-sm mt-2 text-center"></p>
                  )}

                  {/* SafetyGuard Preflight Banner */}
                  <SafetyGuardBanner
                    alert={safetyAlert}
                    mealRequest={cravingInput}
                    onDismiss={clearSafetyAlert}
                    onOverrideSuccess={(token) => handleSafetyOverride(false, token)}
                  />
                  
                  {/* StarchGuard Intercept (Phase 3 Nutrition Budget Engine) */}
                  <StarchGuardIntercept
                    alert={starchAlert}
                    onDecision={(decision) => {
                      if (decision === 'order_something_else') {
                        clearStarchAlert();
                        setCravingInput('');
                        toast({
                          title: "Try a different ingredient",
                          description: "Choose something without starches like meat, fish, or veggies.",
                          duration: 4000,
                        });
                      } else if (decision === 'let_chef_pick') {
                        setStarchDecision(decision);
                        handleGenerateMeal(true);
                      }
                    }}
                    className="mt-3"
                  />

                  {/* Meal Safety Section */}
                  <div className="mt-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
                    <span className="text-xs text-white/60 block mb-2">Meal Safety</span>
                    <SafetyGuardToggle
                      safetyEnabled={safetyEnabled}
                      onSafetyChange={handleSafetyOverride}
                      disabled={isGenerating || safetyChecking}
                    />
                    <GlucoseGuardToggle disabled={isGenerating || safetyChecking} />
                  </div>
                  
                  {/* Flavor Preference Section */}
                  <div className="mt-2 py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                    <span className="text-xs text-white/60 block mb-2">Flavor Preference</span>
                    <FlavorToggle
                      flavorPersonal={flavorPersonal}
                      onFlavorChange={setFlavorPersonal}
                      disabled={isGenerating}
                    />
                    <p className="text-xs text-white/40 mt-1">
                      {flavorPersonal ? "Using your palate preferences" : "Neutral seasoning for others"}
                    </p>
                  </div>

                  {isGenerating ? (
                    <div className="max-w-md mx-auto mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white/80">
                          AI Analysis Progress
                        </span>
                        <span className="text-sm text-white/80">
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <Progress
                        value={progress}
                        className="h-3 bg-black/30 border border-white/20"
                      />
                      <p className="text-white/70 text-sm text-center mt-3"></p>
                    </div>
                  ) : (
                    <GlassButton
                      data-testid="cravingcreator-create-button"
                      data-wt="cc-generate-button"
                      onClick={() => handleGenerateMeal()}
                      disabled={isGenerating || safetyChecking || starchBlocked}
                      className="w-full bg-lime-600 overflow-hidden text-ellipsis whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      {safetyChecking ? "Checking Safety..." : "Create My Craving"}
                    </GlassButton>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {generatedMeals.length > 0 && (
            <div className="mt-8 space-y-6">
              {generatedMeals.map((meal, index) => (
                <div key={index}>
                  <Card
                    data-testid="cravingcreator-results"
                    data-wt="cc-meal-card"
                    className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl rounded 2xl"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Sparkles className="h-6 w-6 text-yellow-600" />
                          <h3 className="text-xl font-bold text-white">
                            {meal.name}
                          </h3>
                          <FavoriteButton
                            title={meal.name}
                            sourceType="craving-creator"
                            mealData={meal}
                          />
                        </div>
                        <button
                          onClick={() => {
                            setGeneratedMeals([]);
                            clearCravingCache();
                            setCravingInput("");
                            setSubstitutedStarchTerms([]);
                            clearStarchAlert();
                          }}
                          className="text-sm text-white/70 bg-white/10 px-3 py-1 rounded-lg transition-colors active:scale-[0.98]"
                          data-testid="button-create-new"
                        >
                          Create New
                        </button>
                      </div>
                      
                      {/* Starch Substitution Notice (when Chef picked alternatives) */}
                      {substitutedStarchTerms.length > 0 && (
                        <StarchSubstitutionNotice 
                          originalTerms={substitutedStarchTerms} 
                          className="mb-4"
                        />
                      )}

                      <p className="text-white/90 mb-4">{meal.description}</p>

                      {/* Meal Image - Show if available */}
                      {meal.imageUrl && (
                        <div className="mb-6 rounded-lg overflow-hidden">
                          <img
                            src={meal.imageUrl}
                            alt={meal.name}
                            className="w-full h-64 object-cover"
                            onError={(e) => {
                              console.log("Image load error:", e);
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                      )}

                      {/* Serving Size Display - ALWAYS SHOW */}
                      <div className="mb-4 p-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-white">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">
                            Serving Size:
                          </span>{" "}
                          {meal.servingSize || "1 serving"}
                        </div>
                      </div>

                      {/* Per-Serving Info for Multiple Servings */}
                      {servings > 1 && (
                        <div className="mb-3 p-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/20">
                          <div className="text-xs text-white text-center">
                            <strong>
                              Total nutrition below is for {servings} servings.
                            </strong>
                            <br />
                            Per serving:{" "}
                            {Math.round(
                              (meal.nutrition?.calories || meal.calories || 0) /
                                servings,
                            )}{" "}
                            cal |{" "}
                            {Math.round(
                              (meal.nutrition?.protein || meal.protein || 0) /
                                servings,
                            )}
                            g protein |{" "}
                            {Math.round(
                              (meal.nutrition?.carbs || meal.carbs || 0) /
                                servings,
                            )}
                            g carbs |{" "}
                            {Math.round(
                              (meal.nutrition?.fat || meal.fat || 0) / servings,
                            )}
                            g fat
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">
                            {meal.nutrition?.calories || meal.calories || 0}
                          </div>
                          <div className="text-xs text-white">Calories</div>
                        </div>
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">
                            {meal.nutrition?.protein || meal.protein || 0}g
                          </div>
                          <div className="text-xs text-white">Protein</div>
                        </div>
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">
                            {meal.nutrition?.carbs || meal.carbs || 0}g
                          </div>
                          <div className="text-xs text-white">Carbs</div>
                        </div>
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
                          <div className="text-lg font-bold text-white">
                            {meal.nutrition?.fat || meal.fat || 0}g
                          </div>
                          <div className="text-xs text-white">Fat</div>
                        </div>
                      </div>


                      {/* Medical Badges */}
                      {(() => {
                        const profile = getUserMedicalProfile(1);
                        const mealForBadges = {
                          name: meal.name,
                          calories:
                            meal.nutrition?.calories ?? meal.calories ?? 0,
                          protein: meal.nutrition?.protein ?? meal.protein ?? 0,
                          carbs: meal.nutrition?.carbs ?? meal.carbs ?? 0,
                          fat: meal.nutrition?.fat ?? meal.fat ?? 0,
                          ingredients: (meal.ingredients ?? []).map(
                            (ing: any) => ({
                              name: ing.name ?? ing.item,
                              amount:
                                typeof ing.quantity === "number"
                                  ? ing.quantity
                                  : typeof ing.amount === "number"
                                    ? ing.amount
                                    : parseFloat(
                                        String(
                                          ing.quantity ?? ing.amount ?? "1",
                                        ),
                                      ) || 1,
                              unit: (ing.unit ?? "serving")
                                .toString()
                                .toLowerCase(),
                            }),
                          ),
                        };

                        const medicalBadges =
                          (meal as any).medicalBadges &&
                          (meal as any).medicalBadges.length
                            ? (meal as any).medicalBadges
                            : generateMedicalBadges(
                                mealForBadges as any,
                                profile,
                              );

                        return medicalBadges && medicalBadges.length > 0 ? (
                          <div className="mb-4">
                            <div className="flex items-center gap-3">
                              <HealthBadgesPopover
                                badges={medicalBadges.map((b: any) =>
                                  typeof b === "string"
                                    ? b
                                    : (b.badge || b.id || b.condition || b.label)
                                )}
                              />

                              <h3 className="font-semibold text-white">Medical Safety</h3>
                            </div>
                          </div>

                        ) : null;
                      })()}

                      {meal.ingredients && meal.ingredients.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2 text-white">
                            Ingredients:
                          </h4>
                          <ul className="text-sm text-white/80 space-y-1">
                            {meal.ingredients.map(
                              (ingredient: any, i: number) => {
                                const name = ingredient.item || ingredient.name;
                                const amount =
                                  ingredient.amount || ingredient.quantity;
                                const unit = ingredient.unit;

                                if (ingredient.displayText) {
                                  return (
                                    <li key={i}>{ingredient.displayText}</li>
                                  );
                                }

                                if (amount && unit) {
                                  return (
                                    <li key={i}>
                                      {amount} {unit} {name}
                                    </li>
                                  );
                                }

                                return <li key={i}>{name}</li>;
                              },
                            )}
                          </ul>
                        </div>
                      )}

                      {meal.instructions && (
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2 text-white">
                            Instructions:
                          </h4>
                          <div className="text-sm text-white/80 whitespace-pre-line max-h-40 overflow-y-auto">
                            {meal.instructions}
                          </div>
                        </div>
                      )}

                      {meal.reasoning && (
                        <div className="mb-4">
                          <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                            <Brain className="h-4 w-4" />
                            Why This Works For You:
                          </h4>
                          <p className="text-sm text-white/80">
                            {meal.reasoning}
                          </p>
                        </div>
                      )}

                      {/* Standardized 3-Row Button Layout */}
                      <div className="space-y-2 mb-3">
                        {/* Row 1: Add to Macros (full width) */}
                        <GlassButton
                          onClick={() => {
                            const macros = getMealNutrition(meal);
                            setQuickView({
                              protein: Math.round(macros.protein_g),
                              carbs: Math.round(macros.carbs_g),
                              starchyCarbs: Math.round(macros.starchyCarbs),
                              fibrousCarbs: Math.round(macros.fibrousCarbs),
                              fat: Math.round(macros.fat_g),
                              calories: Math.round(macros.calories),
                              dateISO: new Date().toISOString().slice(0, 10),
                              mealSlot: "snacks",
                            });
                            setLocation("/biometrics?from=craving-creator&view=macros");
                          }}
                          className="w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-black hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-900 text-white flex items-center justify-center border border-white/30"
                          data-testid="button-add-your-macros"
                        >
                          Add to Macros
                        </GlassButton>

                        {/* Row 2: Add to Plan + Translate (50/50) */}
                        <div className="grid grid-cols-2 gap-2">
                          <AddToMealPlanButton meal={meal} />
                          <TranslateToggle
                            content={{
                              name: meal.name,
                              description: meal.description,
                              instructions: meal.instructions,
                              ingredients: meal.ingredients,
                            }}
                            onTranslate={(translated) => {
                              setGeneratedMeals((prev) =>
                                prev.map((m) =>
                                  m.id === meal.id
                                    ? {
                                        ...m,
                                        name: translated.name,
                                        description: translated.description || m.description,
                                        instructions: typeof translated.instructions === "string"
                                          ? translated.instructions
                                          : m.instructions,
                                        ingredients: (translated.ingredients as StructuredIngredient[]) || m.ingredients,
                                      }
                                    : m
                                )
                              );
                            }}
                          />
                        </div>

                        {/* Row 3: Prepare with Chef + Share (50/50) */}
                        <div className="grid grid-cols-2 gap-2">
                          <GlassButton
                            onClick={() => {
                              const mealData = {
                                id: meal.id || crypto.randomUUID(),
                                name: meal.name,
                                description: meal.description,
                                ingredients: meal.ingredients || [],
                                instructions: meal.instructions,
                                imageUrl: meal.imageUrl,
                              };
                              localStorage.setItem("mpm_chefs_kitchen_meal", JSON.stringify(mealData));
                              localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");
                              setLocation("/lifestyle/chefs-kitchen");
                            }}
                            className="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                          >
                            Cook w/ Chef
                          </GlassButton>
                          <ShareRecipeButton
                            recipe={{
                              name: meal.name,
                              description: meal.description,
                              nutrition: meal.nutrition,
                              ingredients: (meal.ingredients ?? []).map((ing: any) => ({
                                name: ing.item || ing.name,
                                amount: ing.amount || ing.quantity,
                                unit: ing.unit,
                              })),
                            }}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Voice ingredient capture feature removed per user request */}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shopping Aggregate Bar */}
        {generatedMeals.length > 0 && (
          <ShoppingAggregateBar
            ingredients={generatedMeals.flatMap((meal) =>
              meal.ingredients.map((ing: StructuredIngredient) => ({
                name: ing.name,
                qty:
                  typeof ing.quantity === "string"
                    ? parseFloat(ing.quantity) || undefined
                    : ing.quantity,
                unit: ing.unit,
              })),
            )}
            source="Craving Creator"
            hideShareButton={true}
          />
        )}

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Use Craving Creator"
          steps={CRAVING_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />

      </motion.div>
    </PhaseGate>
  );
}
