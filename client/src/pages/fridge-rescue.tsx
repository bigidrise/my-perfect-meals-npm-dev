// STATUS: Production-ready, locked January 8, 2025
// BACKUP: backups/fridge-rescue-stable-version.tsx
// FEATURES: Perfect fridge ingredient rescue, AI meal generation, ingredient optimization, medical personalization
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { apiUrl } from "@/lib/resolveApiBase";
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
import { hasAccess, getCurrentUserPlan, FEATURE_KEYS } from "@/features/access";
import { FeaturePlaceholder } from "@/components/FeaturePlaceholder";
import MacroBridgeButton from "@/components/biometrics/MacroBridgeButton";
import TrashButton from "@/components/ui/TrashButton";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import PhaseGate from "@/components/PhaseGate";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";

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

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

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
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  // 🔋 Progress bar state (real-time ticker like Restaurant Guide)
  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const [expandedInstructions, setExpandedInstructions] = useState<string[]>(
    [],
  );
  const [expandedIngredients, setExpandedIngredients] = useState<string[]>(
    [],
  );
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

  const handleGenerateMeals = async () => {
    // Dispatch "interacted" event
    const interactedEvent = new CustomEvent("walkthrough:event", {
      detail: { testId: "fridge-rescue-interacted", event: "interacted" },
    });
    window.dispatchEvent(interactedEvent);

    if (!ingredients.trim()) {
      alert("Please enter some ingredients first!");
      return;
    }

    setIsLoading(true);
    startProgressTicker();
    try {
      const response = await fetch(apiUrl("/api/meals/fridge-rescue"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fridgeItems: ingredients
            .split(",")
            .map((i) => i.trim())
            .filter((i) => i),
          userId: DEV_USER_ID,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate meal");
      }

      const data = await response.json();
      console.log("🧊 Frontend received data:", data);

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

      console.log("✅ Setting meals:", mealsArray.length);
      stopProgressTicker();
      setMeals(mealsArray);
      setShowResults(true);

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
    } catch (error) {
      console.error("Error generating meals:", error);
      stopProgressTicker();
      alert("Failed to generate meals. Please try again.");
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
    const { replaceOne } = useWeeklyPlan(DEV_USER_ID, replaceCtx.weekKey);

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
      badges: meal.medicalBadges?.map((b: any) => typeof b === 'string' ? b : (b.badge || b.id || b.condition || b.label)) || [],
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fridgeItems: ingredients
          .trim()
          .split(",")
          .map((i) => i.trim())
          .filter((i) => i),
        goal: selectedGoal,
        userId: DEV_USER_ID,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
    if (!data?.meals?.length) throw new Error("No meals returned");

    await addMealToPlan(data.meals[0]); // send to weekly slot
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ingredients: ingredients.trim(),
          goal: undefined, // You can add selectedGoal if needed
          userId: DEV_USER_ID,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

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
        <div
          className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
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
            <QuickTourButton
              onClick={quickTour.openTour}
              className="flex-shrink-0"
            />
          </div>
        </div>

        {/* Main Content */}
        <div
          className="max-w-4xl mx-auto px-6"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          {/* Create with Chef Entry Point - Gated for production stability */}
          {isFeatureEnabled('studioCreators') && (
            <div className="relative mb-4 max-w-2xl mx-auto">
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
                <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-black via-orange-600 to-black rounded-full border border-orange-400/30 shadow-lg z-10">
                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></div>
                  <span className="text-white font-semibold text-[9px]">
                    Powered by Emotion AI™
                  </span>
                </div>
                <CardContent className="p-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Refrigerator className="h-4 w-4 flex-shrink-0 text-orange-500" />
                      <h3 className="text-sm font-semibold text-white">
                        Create with Chef
                      </h3>
                    </div>
                    <p className="text-xs text-white/80 ml-6">
                      Step-by-step guided meal creation from your ingredients with Chef voice assistance
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="bg-black/10 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl p-8 max-w-2xl mx-auto">
            <div className="space-y-2">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-white">Quick Create</h2>
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

                {/* Progress Bar */}
                {isLoading && (
                  <div className="w-full mb-4">
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
                  </div>
                )}

                <button
                  onClick={handleGenerateMeals}
                  disabled={isLoading}
                  data-testid="fridge-generate"
                  className="w-full bg-lime-600 backdrop-blur-lg hover:bg-lime-600 border border-white/20 disabled:bg-black/10 disabled:opacity-50 text-white font-semibold py-4 px-6 rounded-xl transition-colors text-lg flex items-center justify-center gap-3"
                >
                  <div className="flex items-center gap-2">
                    Generate 3 Meals
                  </div>
                </button>
              </div>
            </div>
          </div>

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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {meals.map((meal, index) => (
                  <Card
                    key={meal.id}
                    data-testid="fridge-result-card"
                    className="overflow-hidden bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl flex flex-col h-full"
                  >
                    <div className="relative">
                      <img
                        src={
                          meal.imageUrl ||
                          `https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop&auto=format`
                        }
                        alt={meal.name}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop&auto=format`;
                        }}
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
                      <CardTitle className="text-lg text-white">
                        {meal.name}
                      </CardTitle>
                      <CardDescription className="text-sm text-white/80">
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
                          {typeof meal.starchyCarbs === "number" &&
                          typeof meal.fibrousCarbs === "number" ? (
                            <div className="flex flex-col leading-tight">
                              <div className="text-sm font-bold text-orange-400">
                                {meal.starchyCarbs + meal.fibrousCarbs}g
                              </div>
                              <div className="text-[10px] text-white/70">
                                Starch: {meal.starchyCarbs}g
                              </div>
                              <div className="text-[10px] text-white/70">
                                Fibrous: {meal.fibrousCarbs}g
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-sm font-bold text-orange-400">
                                {meal.carbs}g
                              </div>
                              <div className="text-xs text-white/70">Carbs</div>
                            </>
                          )}
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-2 rounded-md">
                          <div className="text-sm font-bold text-purple-400">
                            {meal.fat}g
                          </div>
                          <div className="text-xs text-white/70">Fat</div>
                        </div>
                      </div>


                      {/* Medical Badges */}
                      <div className="flex items-center gap-2">
                        <HealthBadgesPopover
                          badges={
                            meal.medicalBadges?.map(
                              (b: any) =>
                                typeof b === 'string' ? b : (b.badge || b.id || b.condition || b.label),
                            ) || []
                          }
                        />
                        <h3 className="font-semibold text-white text-sm">Medical Safety</h3>
                      </div>

                      {/* Ingredients */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-white">
                          Ingredients:
                        </h4>
                        <ul className="text-xs text-white/80 space-y-1">
                          {meal.ingredients.slice(0, 4).map((ingredient: any, i: number) => {
                            if (typeof ingredient === "string") {
                              return (
                                <li key={i} className="flex items-start">
                                  <span className="text-green-400 mr-1">•</span>
                                  <span>{ingredient}</span>
                                </li>
                              );
                            }

                            const name = ingredient.item || ingredient.name;
                            const amount = ingredient.amount || ingredient.quantity;
                            const unit = ingredient.unit;

                            // Priority 1: Use pre-formatted displayText from backend
                            if (ingredient.displayText) {
                              return (
                                <li key={i} className="flex items-start">
                                  <span className="text-green-400 mr-1">•</span>
                                  <span>{ingredient.displayText}</span>
                                </li>
                              );
                            }

                            // Priority 2: Show amount + unit + name
                            if (amount && unit) {
                              return (
                                <li key={i} className="flex items-start">
                                  <span className="text-green-400 mr-1">•</span>
                                  <span>{amount} {unit} {name}</span>
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
                          {meal.ingredients.length > 4 && !expandedIngredients.includes(meal.id) && (
                            <li 
                              className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 transition-colors"
                              onClick={() => setExpandedIngredients(prev => [...prev, meal.id])}
                            >
                              + {meal.ingredients.length - 4} more ingredients
                            </li>
                          )}
                          {expandedIngredients.includes(meal.id) && meal.ingredients.slice(4).map((ingredient: any, i: number) => {
                            if (typeof ingredient === "string") {
                              return (
                                <li key={i + 4} className="flex items-start">
                                  <span className="text-green-400 mr-1">•</span>
                                  <span>{ingredient}</span>
                                </li>
                              );
                            }
                            const name = ingredient.item || ingredient.name;
                            const amount = ingredient.amount || ingredient.quantity;
                            const unit = ingredient.unit;
                            if (ingredient.displayText) {
                              return (
                                <li key={i + 4} className="flex items-start">
                                  <span className="text-green-400 mr-1">•</span>
                                  <span>{ingredient.displayText}</span>
                                </li>
                              );
                            }
                            if (amount && unit) {
                              return (
                                <li key={i + 4} className="flex items-start">
                                  <span className="text-green-400 mr-1">•</span>
                                  <span>{amount} {unit} {name}</span>
                                </li>
                              );
                            }
                            return (
                              <li key={i + 4} className="flex items-start">
                                <span className="text-green-400 mr-1">•</span>
                                <span>{name}</span>
                              </li>
                            );
                          })}
                          {expandedIngredients.includes(meal.id) && meal.ingredients.length > 4 && (
                            <li 
                              className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 transition-colors"
                              onClick={() => setExpandedIngredients(prev => prev.filter(id => id !== meal.id))}
                            >
                              Show less
                            </li>
                          )}
                        </ul>
                      </div>

                      {/* Cooking Instructions */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-white">
                          Instructions:
                        </h4>
                        <div className="text-xs text-white/80">
                          {meal.instructions.length > 120 ? (
                            <div>
                              <p className="mb-2">
                                {expandedInstructions.includes(meal.id)
                                  ? meal.instructions
                                  : `${meal.instructions.substring(0, 120)}...`}
                              </p>
                              <button
                                onClick={() => toggleInstructions(meal.id)}
                                className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs font-medium"
                              >
                                {expandedInstructions.includes(meal.id) ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" />
                                    Show Less
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    Show Full Instructions
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <p>{meal.instructions}</p>
                          )}
                        </div>
                      </div>

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
                            }}
                            onTranslate={() => {}}
                          />
                        </div>

                        {/* Row 3: Prepare with Chef + Share (50/50) */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-semibold flex items-center justify-center gap-1.5"
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
                          >
                            <ChefHat className="h-4 w-4" />
                            Prepare with Chef
                          </Button>
                          <ShareRecipeButton
                            recipe={{
                              name: meal.name,
                              description: meal.description,
                              nutrition: { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat },
                              ingredients: (meal.ingredients ?? []).map((ing: any) => ({
                                name: typeof ing === "string" ? ing : ing.name,
                                amount: typeof ing === "string" ? "" : ing.quantity,
                                unit: typeof ing === "string" ? "" : ing.unit,
                              })),
                            }}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
      </motion.div>
    </PhaseGate>
  );
};

export default FridgeRescuePage;
