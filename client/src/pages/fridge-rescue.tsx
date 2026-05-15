// STATUS: Production-ready, locked January 8, 2025
// BACKUP: backups/fridge-rescue-stable-version.tsx
// FEATURES: Perfect fridge ingredient rescue, AI meal generation, ingredient optimization, medical personalization
import { useState, useRef, useEffect } from "react";
import { useMealImages } from "@/hooks/useMealImages";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import { PillButton } from "@/components/ui/pill-button";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import ThinkingDots from "@/components/ThinkingDots";
import { motion } from "framer-motion";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { isFreeTier } from "@/lib/subscriptionCheck";
import { useFreeLock } from "@/hooks/useFreeLock";
import { UpgradeLockModal } from "@/components/upgrade/UpgradeLockModal";
import { Lock } from "lucide-react";
import { isFeatureEnabled } from "@/lib/productionGates";
import {
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Clock,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Home,
  Loader2,
  Refrigerator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useLogMacros } from "@/hooks/useLogMacros";
import { useToast } from "@/hooks/use-toast";
import {
  isAllergyRelatedError,
  formatAllergyAlertDescription,
} from "@/utils/allergyAlert";
import { hasAccess, getCurrentUserPlan, FEATURE_KEYS } from "@/features/access";
import { FeaturePlaceholder } from "@/components/FeaturePlaceholder";
import MacroBridgeButton from "@/components/biometrics/MacroBridgeButton";
import TrashButton from "@/components/ui/TrashButton";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import PhaseGate from "@/components/PhaseGate";
import { LockedBuilderCard } from "@/components/upgrade/LockedBuilderCard";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { useStarchGuardPrecheck } from "@/hooks/useStarchGuardPrecheck";
import { StarchGuardIntercept } from "@/components/StarchGuardIntercept";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeDiet, mealMatchesDiet, filterMealsByDiet } from "@/utils/dietaryFilter";
import { getEffectiveDietPreference } from "@/utils/getEffectiveDietPreference";
import { DietCuisineControlRow } from "@/components/ui/DietCuisineControlRow";
import DietStyleBadge from "@/components/DietStyleBadge";
import MealClassificationPill from "@/components/MealClassificationPill";
import KosherProTip from "@/components/KosherProTip";
import {
  DietGuardIntercept,
  DietAdaptedNotice,
} from "@/components/DietGuardIntercept";
import { useDietGuardPrecheck } from "@/hooks/useDietGuardPrecheck";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { GlucoseGuardToggle } from "@/components/GlucoseGuardToggle";
import { FlavorToggle } from "@/components/FlavorToggle";
import { KeepItSimpleToggle } from "@/components/KeepItSimpleToggle";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import { deriveSplitCarbs } from "@/utils/ingredientClassifier";
import FavoriteButton from "@/components/FavoriteButton";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";

const FRIDGE_RESCUE_TOUR_STEPS: TourStep[] = [
  {
    title: "Enter Your Ingredients",
    description: "Type or speak the ingredients you already have at home.",
  },
  {
    title: "Generate Meals",
    description:
      "Tap generate to get three meals built entirely from your ingredients.",
  },
  {
    title: "Cook Without Shopping",
    description: "Use what you have and skip unnecessary grocery trips.",
  },
];

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
  starchyCarbs?: number;
  fibrousCarbs?: number;
  instructions: string;
  cookingTime: string;
  difficulty: "Easy" | "Medium";
  imageUrl?: string;
  dietClassification?: import("@/components/MealClassificationPill").DietClassification | null;
  medicalBadges: Array<{
    id: string;
    label: string;
    description: string;
    color: string;
    textColor: string;
    category:
      | "metabolic"
      | "digestive"
      | "cardiovascular"
      | "allergies"
      | "fitness"
      | "dietary";
  }>;
}

const FridgeRescuePage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { runAction, open, startWalkthrough } = useCopilot();
  const quickTour = useQuickTour("fridge-rescue");
  // Get actual user ID from auth context for medical safety
  const { user } = useAuth();
  const userId = user?.id || "";

  // 🎯 Auto-start walkthrough on first visit
  useEffect(() => {
    const hasSeenWalkthrough = localStorage.getItem(
      "walkthrough-seen-fridge-rescue",
    );
    if (!hasSeenWalkthrough) {
      const timer = setTimeout(() => {
        startWalkthrough("fridge-rescue");
        localStorage.setItem("walkthrough-seen-fridge-rescue", "true");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [startWalkthrough]);

  // Auto-mark info as seen since Copilot provides guidance now
  useEffect(() => {
    if (!localStorage.getItem("hasSeenFridgeInfo")) {
      localStorage.setItem("hasSeenFridgeInfo", "true");
    }
  }, []);

  // Check if user has access to Fridge Rescue feature
  const userPlan = getCurrentUserPlan();
  const hasFeatureAccess = hasAccess(userPlan, "FRIDGE_RESCUE");

  // Show upgrade prompt if user doesn't have access
  if (!hasFeatureAccess) {
    return (
      <FeaturePlaceholder
        title="Fridge Rescue"
        planLabel="Upgrade Plan"
        price="$19.99/month"
        bullets={[
          "Turn leftover items into meals",
          "1–3 quick suggestions, step-by-step",
          "Nutrition estimates per serving",
          "AI-powered ingredient optimization",
        ]}
        ctaText="Unlock Upgrade Plan"
        ctaHref="/pricing"
      />
    );
  }
  const [ingredients, setIngredients] = useState("");
  const [meals, setMeals] = useState<MealData[]>([]);
  const { loadingImages, hydrateImages } = useMealImages(setMeals, { mealType: "dinner" });
  const [isLoading, setIsLoading] = useState(false);
  const [servings, setServings] = useState(2);
  const [quotaInfo, setQuotaInfo] = useState<{ remaining: number; limit: number; used: number; resetAt: string } | null>(null);
  const [dailyLimitHit, setDailyLimitHit] = useState(false);
  const userIsFree = isFreeTier(user);
  const { isFree, showLockModal, lockMessage, guardAction, closeLockModal } = useFreeLock();

  // Safety override integration - always starts ON, auto-resets after generation
  const [safetyEnabled, setSafetyEnabled] = useState(true);
  const [showResults, setShowResults] = useState(false);

  // Flavor preference toggle - Personal = use user's palate, Neutral = for others
  const [flavorPersonal, setFlavorPersonal] = useState(true);
  const [keepItSimple, setKeepItSimple] = useState(false);
  const [cookMethod, setCookMethod] = useState("");

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
    if (pendingGeneration && overrideToken && !isLoading) {
      setPendingGeneration(false);
      handleGenerateMeals(true); // true = skip preflight (already have override)
    }
  }, [pendingGeneration, overrideToken, isLoading]);

  useEffect(() => {
    if (userIsFree) {
      fetch(`${apiUrl}/api/ai-quota/fridge-rescue`, {
        credentials: "include",
        headers: getAuthHeaders(),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) {
            setQuotaInfo(data);
            if (data.remaining === 0) setDailyLimitHit(true);
          }
        })
        .catch(() => {});
    }
  }, [userIsFree]);

  // 🔋 Progress bar state (real-time ticker like Restaurant Guide)
  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const continueAnywayRef = useRef(false);
  // 🥗 Diet guard — hook-based precheck (mirrors StarchGuard)
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
  const [dietOverrideEnabled, setDietOverrideEnabled] = useState(false);
  const [dietOverrideValue, setDietOverrideValue] = useState("");
  const [cuisineOverrideEnabled, setCuisineOverrideEnabled] = useState(false);
  const [cuisineOverrideValue, setCuisineOverrideValue] = useState("");
  const [pendingFridgeMeal, setPendingFridgeMeal] = useState<any>(null);
  const {
    alert: starchAlert,
    checkStarch,
    clearAlert: clearStarchAlert,
  } = useStarchGuardPrecheck();
  const [stepsExpanded, setStepsExpanded] = useState<Record<string, boolean>>({});
  const [activeSteps, setActiveSteps] = useState<Record<string, number | null>>({});
  const [expandedInstructions, setExpandedInstructions] = useState<string[]>(
    [],
  );
  const [expandedIngredients, setExpandedIngredients] = useState<string[]>([]);
  const [isReplacing, setIsReplacing] = useState<{ [key: string]: boolean }>(
    {},
  );

  // Replacement context state
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

  // Cache key for localStorage persistence
  const CACHE_KEY = "fridge-rescue-cached-state";

  // Cache interface for Fridge Rescue state
  interface CachedFridgeRescueState {
    generatedMeals: MealData[];
    ingredients: string;
    generatedAtISO: string;
  }

  // Save state to localStorage
  function saveFridgeRescueCache(state: CachedFridgeRescueState) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(state));
    } catch {}
  }

  // Load state from localStorage
  function loadFridgeRescueCache(): CachedFridgeRescueState | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Minimal sanity checks
      if (!parsed?.generatedMeals?.length) return null;
      return parsed as CachedFridgeRescueState;
    } catch {
      return null;
    }
  }

  // Clear cache
  function clearFridgeRescueCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
  }

  const resultsRef = useRef<HTMLDivElement>(null);

  // Restore cached meals on mount (so generated meals come back)
  useEffect(() => {
    const cached = loadFridgeRescueCache();
    if (cached?.generatedMeals?.length) {
      setMeals(cached.generatedMeals);
      setIngredients(cached.ingredients || "");
      setShowResults(true);
    }

    // Dispatch "opened" event (500ms setTimeout)
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "fridge-rescue-opened", event: "opened" },
      });
      window.dispatchEvent(event);
    }, 500);
  }, []); // Only run once on mount

  // Auto-save whenever meals or ingredients change (so it's always fresh)
  useEffect(() => {
    if (meals.length > 0 && ingredients.trim()) {
      saveFridgeRescueCache({
        generatedMeals: meals,
        ingredients: ingredients,
        generatedAtISO: new Date().toISOString(),
      });
    }
  }, [meals, ingredients]); // Save when either changes

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

  const handleGenerateMeals = async (skipPreflight = false, dietAdaptOverride = false) => {
    const userDietOverride = continueAnywayRef.current;
    continueAnywayRef.current = false;
    setDietAdaptedNotice(null);
    // Dispatch "interacted" event
    const interactedEvent = new CustomEvent("walkthrough:event", {
      detail: { testId: "fridge-rescue-interacted", event: "interacted" },
    });
    window.dispatchEvent(interactedEvent);

    if (!ingredients.trim()) {
      alert("Please enter some ingredients first!");
      return;
    }

    // 🔐 Preflight safety check - BEFORE starting progress bar
    if (!skipPreflight && !hasActiveOverride) {
      const isSafe = await checkSafety(ingredients, "fridge-rescue");
      if (!isSafe) {
        // Banner will show automatically via safetyAlert state
        return;
      }
    }

    // 🥗 Diet Guard precheck — skip entirely when user has explicitly overridden diet
    if (!dietOverrideEnabled && !skipPreflight && activeDiet && dietDecision !== "let_chef_adapt") {
      const dietOk = checkDiet(ingredients);
      if (!dietOk) {
        return; // DietGuardIntercept will show inline
      }
    }

    setIsLoading(true);
    startProgressTicker();
    try {
      const response = await fetch(apiUrl("/api/meals/fridge-rescue"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          fridgeItems: ingredients
            .split(",")
            .map((i) => i.trim())
            .filter((i) => i),
          servings,
          dietaryRestrictions: getEffectiveDietPreference(user?.dietaryRestrictions, dietOverrideValue, dietOverrideEnabled),
          safetyMode: hasActiveOverride ? "CUSTOM_AUTHENTICATED" : "STRICT",
          overrideToken: hasActiveOverride ? overrideToken : undefined,
          skipPalate: !flavorPersonal,
          strictMode: keepItSimple,
          dietAdaptOverride,
          userDietOverride,
          cookMethod: cookMethod || undefined,
          ...(cuisineOverrideEnabled && cuisineOverrideValue ? { cultureOverride: cuisineOverrideValue } : {}),
        }),
      });

      const data = await response.json();
      console.log("🧊 Frontend received data:", data);

      if (data.limitCode === "FREE_DAILY_LIMIT_REACHED") {
        stopProgressTicker();
        setDailyLimitHit(true);
        setIsLoading(false);
        return;
      }

      if (data.safetyBlocked || data.safetyAmbiguous) {
        stopProgressTicker();
        setSafetyAlert({
          show: true,
          result: data.safetyBlocked ? "BLOCKED" : "AMBIGUOUS",
          blockedTerms: data.blockedTerms || [],
          blockedCategories: [],
          ambiguousTerms: data.ambiguousTerms || [],
          message: data.error || "Allergy alert detected",
          suggestion: data.suggestion,
        });
        setIsLoading(false);
        return; // Don't throw error, let banner handle it
      }

      // Auto-reset safety state after successful generation
      setSafetyEnabled(true);
      clearSafetyAlert();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Failed to generate meal",
        );
      }

      // Handle both response formats: {meals: [...]} or {meal: {...}}
      let mealsArray;
      if (data.meals && Array.isArray(data.meals)) {
        mealsArray = data.meals;
      } else if (data.meal) {
        // Backend returned single meal, wrap in array
        mealsArray = [data.meal];
      } else {
        console.error("❌ Invalid data structure:", data);
        throw new Error("No meals found in response");
      }

      // 🥗 Scenario A: server already flagged diet adaptation — accept all meals, show soft notice
      const userDiet = normalizeDiet(user?.dietaryRestrictions);
      const effectiveDiet = normalizeDiet(
        getEffectiveDietPreference(user?.dietaryRestrictions, dietOverrideValue, dietOverrideEnabled)
      );
      if (data.dietAdapted) {
        setDietAdaptedNotice(data.dietNotice || `Adapted for your ${effectiveDiet} diet.`);
        clearDietAlert();
      } else if (!dietOverrideEnabled && !skipPreflight && activeDiet) {
        // 🥗 Scenario B fallback — only fires on initial generate when using onboarding diet
        const compliantMeals = filterMealsByDiet(userDiet, mealsArray, (m) => m);
        if (compliantMeals.length === 0) {
          stopProgressTicker();
          setIsLoading(false);
          triggerDietAlert([], `None of the generated meals matched your ${userDiet} diet.`);
          return;
        }
        mealsArray = compliantMeals;
      }

      console.log("✅ Setting meals:", mealsArray.length);
      stopProgressTicker();
      setMeals(mealsArray);
      hydrateImages(mealsArray);
      setShowResults(true);

      if (data.quota) {
        setQuotaInfo(data.quota);
      }

      // Dispatch "completed" event after successful meal generation
      const completedEvent = new CustomEvent("walkthrough:event", {
        detail: { testId: "fridge-rescue-completed", event: "completed" },
      });
      window.dispatchEvent(completedEvent);

      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 100);
    } catch (error: any) {
      console.error("Error generating meals:", error);
      stopProgressTicker();
      const errorMsg = error?.message || String(error) || "";
      if (isAllergyRelatedError(errorMsg)) {
        toast({
          title: "⚠️ ALLERGY ALERT",
          description: formatAllergyAlertDescription(errorMsg),
          variant: "warning",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: "Failed to generate meals. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewSearch = () => {
    setIngredients("");
    setMeals([]);
    setShowResults(false);
    setExpandedInstructions([]);
    clearFridgeRescueCache(); // Clear the cache when starting new search
  };

  const toggleInstructions = (mealId: string) => {
    setExpandedInstructions((prev) =>
      prev.includes(mealId)
        ? prev.filter((id) => id !== mealId)
        : [...prev, mealId],
    );
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
      badges:
        meal.medicalBadges?.map((b: any) =>
          typeof b === "string" ? b : b.badge || b.id || b.condition || b.label,
        ) || [],
      ingredients: meal.ingredients || [],
      instructions:
        typeof meal.instructions === "string"
          ? [meal.instructions]
          : meal.instructions || [],
      source: "fridge-rescue",
    };

    // Replace the meal
    replaceOne(replaceCtx.mealId, planMeal);

    // Clear replacement context
    clearReplaceCtx();

    // Navigate back to Weekly Meal Board
    setLocation("/weekly-meal-board");
  }

  // Quick generate then replace for calendar slot
  async function quickReplaceFromFridge(
    ingredients: string,
    selectedGoal?: string,
  ) {
    const resp = await fetch(apiUrl("/api/meals/fridge-rescue"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        fridgeItems: ingredients
          .trim()
          .split(",")
          .map((i) => i.trim())
          .filter((i) => i),
        goal: selectedGoal,
        skipPalate: !flavorPersonal,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
    if (!data?.meals?.length) throw new Error("No meals returned");

    const generatedMeal = data.meals[0];
    const ingredientTexts = (generatedMeal.ingredients || []).map((ing: any) =>
      typeof ing === "string" ? ing : ing?.name || ""
    ).filter(Boolean);
    const starchOk = checkStarch(ingredientTexts.length ? ingredientTexts : [generatedMeal.name || ""]);
    if (starchOk) {
      await addMealToPlan(generatedMeal);
    } else {
      setPendingFridgeMeal(generatedMeal);
    }
  }

  // Local list replace (for non-replace mode)
  const replaceMeal = async (mealId: string) => {
    if (!ingredients.trim()) return;

    setIsReplacing((prev) => ({ ...prev, [mealId]: true }));

    try {
      // If in replace mode, use quick replace function
      if (replaceCtx) {
        await quickReplaceFromFridge(ingredients);
        return;
      }

      // Otherwise, do local list replacement
      const response = await fetch(apiUrl("/api/meals/fridge-rescue"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ingredients: ingredients.trim(),
          goal: undefined,
          skipPalate: !flavorPersonal,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if this is an allergy safety block
        if (data.error === "ALLERGY_SAFETY_BLOCK") {
          throw new Error(`🚨 Safety Alert: ${data.message}`);
        }
        throw new Error(
          data.message || `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      if (data?.meals?.length > 0) {
        const next = { ...data.meals[0] };
        if (!next.imageUrl) {
          next.imageUrl = "/assets/meals/default-dinner.jpg"; // fallback image
        }
        setMeals((prev) =>
          prev.map((meal) =>
            meal.id === mealId ? { ...next, id: mealId } : meal,
          ),
        );
        console.log("✅ Meal replaced locally:", next.name);
      }
    } catch (error) {
      console.error("Replace meal error:", error);
      alert("Failed to replace meal. Please try again.");
    } finally {
      setIsReplacing((prev) => ({ ...prev, [mealId]: false }));
    }
  };

  return (
    <PhaseGate phase="PHASE_1_CORE" feature="fridge-rescue">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
      >
        {/* Universal Safe-Area Header */}
        <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-8 py-3 flex items-center gap-3 flex-nowrap">
            {/* Title */}
            <h1
              data-wt="fridge-rescue-header"
              className="text-lg font-bold text-white truncate min-w-0"
            >
              Fridge Rescue
            </h1>

            <div className="flex-grow" />
          </div>
        </div>
        </MobileHeaderGuard>

        {/* Main Content */}
        <div
          className="max-w-4xl mx-auto px-6"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          {/* Create with Chef Entry Point — Studio hidden */}
          <div className="relative mb-4 max-w-2xl mx-auto hidden">
            <div
              className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-80"
              style={{
                background:
                  "radial-gradient(120% 120% at 50% 0%, rgba(251,146,60,0.75), rgba(239,68,68,0.35), rgba(0,0,0,0))",
              }}
            />
            <Card
              className="relative cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-gradient-to-r from-black via-orange-950/40 to-black backdrop-blur-lg border border-orange-400/30 rounded-xl shadow-md overflow-hidden hover:shadow-[0_0_30px_rgba(251,146,60,0.4)] hover:border-orange-500/50"
              onClick={() => setLocation("/fridge-rescue-studio")}
              data-testid="fridge-rescue-studio-entry"
            >
              <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-black via-orange-600 to-black rounded-full border border-orange-400/30 shadow-lg z-10">
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></div>
                <span className="text-white font-semibold text-[8px] tracking-wide">
                  Powered by Emotion AI™
                </span>
              </div>
              <CardContent className="p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Refrigerator className="h-4 w-4 flex-shrink-0 text-orange-500" />
                    <h3 className="text-sm font-semibold text-white">
                      Chef's Fridge Rescue Studio
                    </h3>
                  </div>
                  <p className="text-xs text-white/80 ml-6">
                    Step-by-step guided meal creation from your ingredients with
                    Chef voice assistance
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {userIsFree && quotaInfo && (
            <div className="max-w-2xl mx-auto mb-4">
              <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-white/70">Free AI Meals Today</span>
                  <span className="font-semibold text-white">
                    {quotaInfo.used} / {quotaInfo.limit}
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${(quotaInfo.used / quotaInfo.limit) * 100}%` }}
                  />
                </div>
                {quotaInfo.remaining === 0 && (
                  <p className="text-xs text-amber-400 mt-2">
                    You've used today's free AI meal.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-black/10 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl p-8 max-w-2xl mx-auto">
            <div className="space-y-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Quick Create</h2>
                <HowThisWorksLink
                  videoUrl="https://youtube.com/shorts/hctXRUOuCW4?feature=share"
                  label="How It Works"
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <label
                    htmlFor="ingredients"
                    className="block text-lg font-medium text-white"
                  >
                    Enter ingredients from your fridge:
                  </label>
                  <div className="relative">
                    <textarea
                      id="ingredients"
                      data-testid="fridge-input"
                      value={ingredients}
                      onChange={(e) => setIngredients(e.target.value)}
                      placeholder="e.g., chicken breast, broccoli, rice, onions, eggs"
                      className="w-full p-3 pr-10 border border-white/20 bg-black/20 rounded-xl focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm text-white"
                      rows={3}
                    />
                    {ingredients.trim() && (
                      <TrashButton
                        data-wt="fridge-clear-ingredients-button"
                        onClick={() => setIngredients("")}
                        size="sm"
                        ariaLabel="Clear ingredients"
                        title="Clear ingredients"
                        data-testid="button-clear-ingredients"
                        className="absolute top-2 right-2"
                      />
                    )}
                  </div>
                  <p className="text-md text-white mt-1 text-center">
                    Use keyboard or speech-to-text for input
                  </p>
                </div>

                <DietCuisineControlRow
                  savedCuisine={user?.cuisinePreference}
                  dietOverrideEnabled={dietOverrideEnabled}
                  dietOverrideValue={dietOverrideValue}
                  onDietToggle={(enabled) => {
                    setDietOverrideEnabled(enabled);
                    if (!enabled) clearDietAlert();
                  }}
                  onDietChange={setDietOverrideValue}
                  cuisineOverrideEnabled={cuisineOverrideEnabled}
                  cuisineOverrideValue={cuisineOverrideValue}
                  onCuisineToggle={setCuisineOverrideEnabled}
                  onCuisineChange={setCuisineOverrideValue}
                />

                {/* SafetyGuard Preflight Banner - Black/Yellow Alert */}
                <SafetyGuardBanner
                  alert={safetyAlert}
                  mealRequest={ingredients}
                  onDismiss={clearSafetyAlert}
                  onOverrideSuccess={(token) =>
                    handleSafetyOverride(false, token)
                  }
                />

                {/* DietGuard Intercept — advisory panel, fires at generate time */}
                <DietGuardIntercept
                  alert={dietAlert}
                  onDecision={(decision) => {
                    if (decision === "pick_something_else") {
                      clearDietAlert();
                      setMeals([]);
                      setShowResults(false);
                    } else if (decision === "let_chef_adapt") {
                      setDietDecision("let_chef_adapt");
                      clearDietAlert();
                      handleGenerateMeals(true, true);
                    } else if (decision === "continue_anyway") {
                      continueAnywayRef.current = true;
                      clearDietAlert();
                      handleGenerateMeals(true);
                    }
                  }}
                  className="mt-3"
                />

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Cooking method <span className="text-white/40 font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Stovetop", emoji: "🍳" },
                      { label: "Oven", emoji: "🔥" },
                      { label: "Air Fryer", emoji: "💨" },
                      { label: "Grill", emoji: "🥩" },
                      { label: "Slow Cooker", emoji: "🫕" },
                      { label: "No-Cook", emoji: "🥗" },
                    ].map(({ label, emoji }) => (
                      <div key={label} className="flex flex-col items-center gap-1">
                        <PillButton
                          active={cookMethod === label}
                          variant="amber"
                          onClick={() => setCookMethod(cookMethod === label ? "" : label)}
                        >
                          {emoji}
                        </PillButton>
                        <span className="text-[10px] text-white leading-tight text-center">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Meal Safety Section */}
                <div className="mb-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
                  <span className="text-xs text-white/60 block mb-2">
                    Meal Safety
                  </span>
                  <SafetyGuardToggle
                    safetyEnabled={safetyEnabled}
                    onSafetyChange={handleSafetyOverride}
                    disabled={isLoading || safetyChecking}
                  />
                  <GlucoseGuardToggle disabled={isLoading || safetyChecking} />
                </div>

                {/* Flavor Preference Section */}
                <div className="mb-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                  <span className="text-xs text-white/60 block mb-2">
                    Flavor Preference
                  </span>
                  <FlavorToggle
                    flavorPersonal={flavorPersonal}
                    onFlavorChange={setFlavorPersonal}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-white/40 mt-1">
                    {flavorPersonal
                      ? "Using your palate preferences"
                      : "Neutral seasoning for others"}
                  </p>
                </div>

                {/* Keep It Simple Section */}
                <div className="mb-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                  <span className="text-xs text-white/60 block mb-2">
                    Ingredient Control
                  </span>
                  <KeepItSimpleToggle
                    keepItSimple={keepItSimple}
                    onToggle={setKeepItSimple}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-white/40 mt-1">
                    {keepItSimple
                      ? "AI will use only what you listed — nothing added"
                      : "AI may add complementary ingredients"}
                  </p>
                </div>

                {/* Serving Size Selector */}
                <div className="mb-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                  <span className="text-xs text-white/60 block mb-2">
                    Servings
                  </span>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={isLoading}
                        onClick={() => setServings(n)}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                          servings === n
                            ? "bg-black/70 text-white border border-orange-800 shadow-lg shadow-orange-500/30"
                            : "bg-black/20 text-white/70 border border-white/10 hover:border-white/30"
                        } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-white/40 mt-1">
                    {servings === 1
                      ? "Single serving"
                      : `${servings} servings — great for ${servings <= 2 ? "a couple" : "the family"}`}
                  </p>
                </div>

                {isLoading || safetyChecking ? (
                  <div className="flex justify-center">
                    <ThinkingDots label={safetyChecking ? "Checking safety…" : "Rescuing your meal…"} />
                  </div>
                ) : (
                  <button
                    onClick={() => handleGenerateMeals()}
                    data-testid="fridge-generate"
                    className="w-full bg-lime-600 backdrop-blur-lg border border-white/20 text-white font-semibold py-4 px-6 rounded-xl transition-colors text-lg flex items-center justify-center gap-3"
                  >
                    <div className="flex items-center gap-2">
                      Generate 3 Meals
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>

          {starchAlert.show && pendingFridgeMeal && (
            <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-6xl mx-auto mt-8">
              <StarchGuardIntercept
                alert={starchAlert}
                onDecision={async (decision) => {
                  if (decision === "continue_anyway") {
                    await addMealToPlan(pendingFridgeMeal);
                  }
                  clearStarchAlert();
                  setPendingFridgeMeal(null);
                }}
                showContinueAnyway
                continueAnywayLabel="Add It Anyway"
                chooseAnotherLabel="Try Different Ingredients"
              />
            </div>
          )}

          {showResults && meals.length > 0 && (
            <div
              ref={resultsRef}
              data-testid="fridge-results"
              className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl p-8 max-w-6xl mx-auto mt-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-white">
                  🍽️ Your Fridge Rescue Meals
                </h2>
                <button
                  onClick={handleNewSearch}
                  className="text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors"
                  data-testid="button-create-new"
                >
                  Create New
                </button>
              </div>

              {/* Diet Adapted Notice (soft chip when AI adapted for dietary preference) */}
              {dietAdaptedNotice && (
                <DietAdaptedNotice
                  diet={normalizeDiet(user?.dietaryRestrictions)}
                  notice={dietAdaptedNotice}
                  className="mb-6"
                />
              )}

              <div className="grid grid-cols-1 gap-6 mb-8 max-w-2xl mx-auto">
                {meals.map((meal, index) => (
                  <Card
                    key={meal.id}
                    data-testid="fridge-result-card"
                    className="overflow-hidden bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl flex flex-col h-full"
                  >
                    <div className="relative">
                      <MealImageSlot
                        imageUrl={meal.imageUrl}
                        mealName={meal.name}
                        isLoading={!!loadingImages[meal.id]}
                        height="h-48"
                      />
                      <div className="absolute top-3 left-3">
                        <Badge
                          variant={
                            meal.difficulty === "Easy" ? "default" : "secondary"
                          }
                          className="bg-white/10 border border-white/20 text-white"
                        >
                          <ChefHat className="h-3 w-3 mr-1" />
                          {meal.difficulty}
                        </Badge>
                      </div>
                      <div className="absolute top-3 right-3">
                        <Badge variant="outline" className="bg-white">
                          <Clock className="h-3 w-3 mr-1" />
                          {meal.cookingTime}
                        </Badge>
                      </div>
                    </div>

                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-white">
                          {meal.name}
                        </CardTitle>
                        <FavoriteButton
                          title={meal.name}
                          sourceType="fridge-rescue"
                          mealData={meal}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <DietStyleBadge />
                        <MealClassificationPill dietClassification={meal.dietClassification} />
                        <KosherProTip
                          dietClassification={meal.dietClassification}
                        />
                      </div>
                      <CardDescription className="text-sm text-white/80 mt-2">
                        {meal.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 flex-1 flex flex-col">
                      {/* Nutrition Grid */}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-2 rounded-md">
                          <div className="text-sm font-bold text-green-400">
                            {meal.calories}
                          </div>
                          <div className="text-xs text-white/70">Cal</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-2 rounded-md">
                          <div className="text-sm font-bold text-blue-400">
                            {meal.protein}g
                          </div>
                          <div className="text-xs text-white/70">Protein</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-2 rounded-md">
                          <div className="text-sm font-bold text-orange-400">{meal.carbs}g</div>
                          <div className="text-xs text-white/70">Carbs</div>
                          {(() => {
                            const totalCarbs = meal.carbs || 0;
                            const { starchyCarbs, fibrousCarbs } = (typeof meal.starchyCarbs === "number" && typeof meal.fibrousCarbs === "number")
                              ? { starchyCarbs: meal.starchyCarbs, fibrousCarbs: meal.fibrousCarbs }
                              : deriveSplitCarbs(meal.ingredients ?? [], totalCarbs);
                            if (!totalCarbs && !starchyCarbs && !fibrousCarbs) return null;
                            return (
                              <div className="text-xs text-white/80 mt-1 font-medium">
                                <span className="text-amber-300">{Math.round(starchyCarbs)}S</span>
                                {" / "}
                                <span className="text-green-300">{Math.round(fibrousCarbs)}F</span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-2 rounded-md">
                          <div className="text-sm font-bold text-purple-400">
                            {meal.fat}g
                          </div>
                          <div className="text-xs text-white/70">Fat</div>
                        </div>
                      </div>

                      {/* Medical Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <HealthBadgesPopover
                            badges={
                              meal.medicalBadges?.map((b: any) =>
                                typeof b === "string"
                                  ? b
                                  : b.badge || b.id || b.condition || b.label,
                              ) || []
                            }
                          />
                          <h3 className="font-semibold text-white text-sm">
                            Medical Safety
                          </h3>
                        </div>
                        <TrashButton
                          size="sm"
                          ariaLabel="Remove meal"
                          title="Remove meal"
                          confirm={true}
                          confirmMessage="Remove this meal?"
                          onClick={() => setMeals(prev => prev.filter((_, i) => i !== index))}
                        />
                      </div>

                      {/* Ingredients */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-white">
                          Ingredients:
                        </h4>
                        <ul className="text-xs text-white/80 space-y-1">
                          {meal.ingredients
                            .slice(0, 4)
                            .map((ingredient: any, i: number) => {
                              if (typeof ingredient === "string") {
                                return (
                                  <li key={i} className="flex items-start">
                                    <span className="text-green-400 mr-1">
                                      •
                                    </span>
                                    <span>{ingredient}</span>
                                  </li>
                                );
                              }

                              const name = ingredient.item || ingredient.name;
                              const amount =
                                ingredient.amount || ingredient.quantity;
                              const unit = ingredient.unit;

                              // Priority 1: Use pre-formatted displayText from backend
                              if (ingredient.displayText) {
                                return (
                                  <li key={i} className="flex items-start">
                                    <span className="text-green-400 mr-1">
                                      •
                                    </span>
                                    <span>{ingredient.displayText}</span>
                                  </li>
                                );
                              }

                              // Priority 2: Show amount + unit + name
                              if (amount && unit) {
                                return (
                                  <li key={i} className="flex items-start">
                                    <span className="text-green-400 mr-1">
                                      •
                                    </span>
                                    <span>
                                      {amount} {unit} {name}
                                    </span>
                                  </li>
                                );
                              }

                              // Priority 3: Just show name
                              return (
                                <li key={i} className="flex items-start">
                                  <span className="text-green-400 mr-1">•</span>
                                  <span>{name}</span>
                                </li>
                              );
                            })}
                          {meal.ingredients.length > 4 &&
                            !expandedIngredients.includes(meal.id) && (
                              <li
                                className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 transition-colors"
                                onClick={() =>
                                  setExpandedIngredients((prev) => [
                                    ...prev,
                                    meal.id,
                                  ])
                                }
                              >
                                + {meal.ingredients.length - 4} more ingredients
                              </li>
                            )}
                          {expandedIngredients.includes(meal.id) &&
                            meal.ingredients
                              .slice(4)
                              .map((ingredient: any, i: number) => {
                                if (typeof ingredient === "string") {
                                  return (
                                    <li
                                      key={i + 4}
                                      className="flex items-start"
                                    >
                                      <span className="text-green-400 mr-1">
                                        •
                                      </span>
                                      <span>{ingredient}</span>
                                    </li>
                                  );
                                }
                                const name = ingredient.item || ingredient.name;
                                const amount =
                                  ingredient.amount || ingredient.quantity;
                                const unit = ingredient.unit;
                                if (ingredient.displayText) {
                                  return (
                                    <li
                                      key={i + 4}
                                      className="flex items-start"
                                    >
                                      <span className="text-green-400 mr-1">
                                        •
                                      </span>
                                      <span>{ingredient.displayText}</span>
                                    </li>
                                  );
                                }
                                if (amount && unit) {
                                  return (
                                    <li
                                      key={i + 4}
                                      className="flex items-start"
                                    >
                                      <span className="text-green-400 mr-1">
                                        •
                                      </span>
                                      <span>
                                        {amount} {unit} {name}
                                      </span>
                                    </li>
                                  );
                                }
                                return (
                                  <li key={i + 4} className="flex items-start">
                                    <span className="text-green-400 mr-1">
                                      •
                                    </span>
                                    <span>{name}</span>
                                  </li>
                                );
                              })}
                          {expandedIngredients.includes(meal.id) &&
                            meal.ingredients.length > 4 && (
                              <li
                                className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 transition-colors"
                                onClick={() =>
                                  setExpandedIngredients((prev) =>
                                    prev.filter((id) => id !== meal.id),
                                  )
                                }
                              >
                                Show less
                              </li>
                            )}
                        </ul>
                      </div>

                      {/* Cooking Instructions - step-by-step */}
                      {(() => {
                        const steps = normalizeInstructions(meal.instructions);
                        if (steps.length === 0) return null;
                        const expanded = !!stepsExpanded[meal.id];
                        const visibleSteps = expanded ? steps : steps.slice(0, 3);
                        return (
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-white">Instructions:</h4>
                            <div className="space-y-2">
                              {visibleSteps.map((step, index) => (
                                <div key={index}
                                  className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors select-none ${activeSteps[meal.id] === index ? "bg-orange-500/20 border border-orange-500/40" : "hover:bg-white/5"}`}
                                  onClick={() => setActiveSteps((prev) => ({ ...prev, [meal.id]: prev[meal.id] === index ? null : index }))}>
                                  <div className="min-w-[26px] h-[26px] w-[26px] rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{index + 1}</div>
                                  <p className="text-sm leading-relaxed text-white/80">{step}</p>
                                </div>
                              ))}
                            </div>
                            {steps.length > 3 && (
                              <button className="mt-1 text-xs text-orange-400 font-medium cursor-pointer active:text-orange-300 select-none"
                                onClick={() => { setStepsExpanded((prev) => ({ ...prev, [meal.id]: !expanded })); if (expanded) setActiveSteps((prev) => ({ ...prev, [meal.id]: null })); }}>
                                {expanded ? "Show less" : `Show all ${steps.length} steps`}
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Standardized 3-Row Button Layout */}
                      <div className="mt-auto pt-4 space-y-2">
                        {/* Row 1: Add to Macros (full width) */}
                        <MacroBridgeButton
                          data-testid="fridge-add-to-shopping"
                          meal={{
                            protein: meal.protein || 0,
                            carbs: meal.carbs || 0,
                            fat: meal.fat || 0,
                            calories: meal.calories || 0,
                          }}
                          source="fridge-rescue"
                        />

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
                              setMeals((prev) =>
                                prev.map((m) =>
                                  m.id === meal.id
                                    ? {
                                        ...m,
                                        name: translated.name,
                                        description:
                                          translated.description ||
                                          m.description,
                                        instructions:
                                          typeof translated.instructions ===
                                          "string"
                                            ? translated.instructions
                                            : m.instructions,
                                        ingredients: translated.ingredients
                                          ? (translated.ingredients as StructuredIngredient[]).map((ing: any) => ({ ...ing, displayText: undefined }))
                                          : m.ingredients,
                                      }
                                    : m,
                                ),
                              );
                            }}
                          />
                        </div>

                        {/* Row 3: Prepare with Chef + Share (50/50) */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                            onClick={() => {
                              guardAction("Enter Studio is a premium feature. Upgrade to cook meals step-by-step with our AI chef.", () => {
                                const mealData = {
                                  id: meal.id || crypto.randomUUID(),
                                  name: meal.name,
                                  description: meal.description,
                                  ingredients: meal.ingredients || [],
                                  instructions: meal.instructions,
                                  imageUrl: meal.imageUrl,
                                  cookMethod: cookMethod || undefined,
                                };
                                localStorage.setItem(
                                  "mpm_chefs_kitchen_meal",
                                  JSON.stringify(mealData),
                                );
                                localStorage.setItem(
                                  "mpm_chefs_kitchen_external_prepare",
                                  "true",
                                );
                                setLocation("/lifestyle/chefs-kitchen");
                              });
                            }}
                          >
                            {isFree && <Lock className="h-3 w-3" />}
                            Guided Cooking
                          </Button>
                          <ShareRecipeButton
                            recipe={{
                              name: meal.name,
                              description: meal.description,
                              nutrition: {
                                calories: meal.calories,
                                protein: meal.protein,
                                carbs: meal.carbs,
                                fat: meal.fat,
                              },
                              ingredients: (meal.ingredients ?? []).map(
                                (ing: any) => ({
                                  name:
                                    typeof ing === "string" ? ing : ing.name,
                                  amount:
                                    typeof ing === "string" ? "" : ing.quantity,
                                  unit: typeof ing === "string" ? "" : ing.unit,
                                }),
                              ),
                            }}
                            className="flex-1"
                            locked={isFree}
                            onLockedClick={() => guardAction("Share Recipe is a premium feature. Upgrade to share your meals with friends and family.", () => {})}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {userIsFree && quotaInfo && quotaInfo.remaining === 0 && (
                <div className="mt-6 bg-gradient-to-r from-orange-600/30 to-orange-500/20 border border-orange-500/40 rounded-xl p-5">
                  <div className="flex items-start gap-4">
                    <Sparkles className="h-6 w-6 text-orange-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-base mb-1">Want unlimited Fridge Rescue?</h3>
                      <p className="text-white/70 text-sm mb-3">
                        You've used today's free generation. Upgrade to generate unlimited meals every day, plus unlock Craving Creator, Dessert Builder, and more.
                      </p>
                      <button
                        onClick={() => setLocation("/pricing")}
                        className="bg-black/70 hover:bg-orange-800 text-white font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
                      >
                        View Plans
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {dailyLimitHit && !showResults && (
            <div className="max-w-2xl mx-auto mt-8">
              <div className="bg-gradient-to-br from-black/60 via-orange-600/20 to-black/60 border border-orange-500/40 rounded-2xl p-8 text-center">
                <div className="w-14 h-14 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-7 w-7 text-orange-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Daily Limit Reached</h2>
                <p className="text-white/70 text-sm mb-1">
                  Free accounts get 1 Fridge Rescue per day. Your next generation resets at midnight UTC.
                </p>
                <p className="text-white/50 text-xs mb-6">
                  Upgrade for unlimited AI meal generation across all builders.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setLocation("/pricing")}
                    className="bg-orange-600 hover:bg-orange-500 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
                  >
                    Upgrade Now
                  </button>
                  <button
                    onClick={() => setLocation("/dashboard")}
                    className="bg-white/10 hover:bg-white/20 text-white/80 font-medium px-6 py-2.5 rounded-lg transition-colors"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}

          {userIsFree && (showResults || dailyLimitHit) && (
            <div className="max-w-4xl mx-auto mt-8">
              <h3 className="text-white/60 text-sm font-medium uppercase tracking-wider mb-4">More AI Builders with Upgrade</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <LockedBuilderCard
                  icon="🍫"
                  title="Craving Creator"
                  description="Turn any craving into a macro-friendly meal"
                />
                <LockedBuilderCard
                  icon="🍰"
                  title="Dessert Builder"
                  description="Guilt-free desserts that fit your macros"
                />
                <LockedBuilderCard
                  icon="🍹"
                  title="Beverage Creator"
                  description="Custom drinks from smoothies to cocktails"
                />
                <LockedBuilderCard
                  icon="📋"
                  title="Weekly Meal Planner"
                  description="Full AI-generated weekly meal plans"
                />
              </div>
            </div>
          )}
        </div>

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Use Fridge Rescue"
          steps={FRIDGE_RESCUE_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />
        <UpgradeLockModal
          open={showLockModal}
          onClose={closeLockModal}
          message={lockMessage}
        />
      </motion.div>
    </PhaseGate>
  );
};

export default FridgeRescuePage;
