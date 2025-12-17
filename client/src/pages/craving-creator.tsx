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
import { Brain, Target, Sparkles, Home, Users, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import {
  generateMedicalBadges,
  getUserMedicalProfile,
} from "@/utils/medicalPersonalization";
import { post } from "@/lib/api";
import CopyRecipeButton from "@/components/CopyRecipeButton";
import { ProDietaryDirectives } from "@/components/ProDietaryDirectives";
import PhaseGate from "@/components/PhaseGate";

// Development user ID - consistent across all components (UUID format)
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
  };
}

const CRAVING_TOUR_STEPS: TourStep[] = [
  { title: "Describe Your Craving", description: "Tell us what you're in the mood for — sweet, crunchy, creamy, tangy, or any flavor you want." },
  { title: "Select Servings", description: "Choose how many servings you need for your personalized meal." },
  { title: "Create & Enjoy", description: "Press Create and get a recipe that fits your taste and lifestyle. You never have to ignore cravings again!" },
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
  // Development user ID - consistent across app
  const userId = DEV_USER_ID;

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
          userId: DEV_USER_ID,
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

  const handleGenerateMeal = async () => {
    if (!cravingInput.trim()) {
      toast({
        title: "Missing Information",
        description: "Please describe what you're craving first!",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    startProgressTicker();

    try {
      const response = await fetch(apiUrl("/api/meals/craving-creator"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMealType: "snacks",
          cravingInput,
          dietaryRestrictions: selectedDiet || dietaryRestrictions,
          userId: DEV_USER_ID,
          servings: servings, // NEW: Send serving size to backend
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate meal");
      }

      const data = await response.json();
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
      toast({
        title: "Generation Failed",
        description:
          error.message || "Failed to generate meal. Please try again.",
        variant: "destructive",
      });
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
          className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-8 py-3 flex items-center gap-3">
            {/* Back Button */}
            <button
              onClick={() => setLocation("/craving-creator-landing")}
              className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg"
              data-testid="button-back-to-hub"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>

            {/* Title */}
            <h1 className="text-lg font-bold text-white">Craving Creator</h1>

            <div className="flex-grow" />
            <QuickTourButton onClick={quickTour.openTour} />
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
                  <CardTitle className="flex items-center gap-2 text-lg text-white">
                    Describe Your Craving
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
                    <p className="text-md text-white mt-1">
                      Ingredients and nutrition will be scaled for {servings}{" "}
                      {servings === 1 ? "serving" : "servings"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="block text-md font-medium mb-1 text-white">
                      Medical Safety Profile (Always Enabled)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled={true}
                        className="h-5 w-5 text-green-600 border-gray-300 rounded focus:ring-green-500 opacity-50"
                      />
                      <span className="text-md text-green-300 font-medium">
                        ✓ Protected
                      </span>
                    </div>
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
            onClick={handleGenerateMeal}
            disabled={isGenerating}
            className="w-full bg-lime-500 hover:bg-lime-600 overflow-hidden text-ellipsis whitespace-nowrap flex items-center justify-center gap-2"
          >
            Create My Craving
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
                        </div>
                        <TrashButton
                          onClick={() => {
                            setGeneratedMeals([]);
                            clearCravingCache();
                            toast({
                              title: "🗑️ Meal Deleted",
                              description:
                                "Your generated meal has been removed.",
                            });
                          }}
                          size="sm"
                          ariaLabel="Delete meal"
                          title="Delete meal"
                          data-testid="button-delete-meal"
                        />
                      </div>

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

                      {/* Medical Badges - ALWAYS SHOW */}
                      {(() => {
                        const profile = getUserMedicalProfile(1); // Use numeric ID for development
                        // or your real user id
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
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <h3 className="font-semibold text-white">
                                Medical Safety
                              </h3>
                              <CopyRecipeButton
                                recipe={{
                                  name: meal.name,
                                  ingredients: (meal.ingredients ?? []).map(
                                    (ing: any) => ({
                                      name: ing.item || ing.name,
                                      amount: ing.amount || ing.quantity,
                                      unit: ing.unit,
                                    }),
                                  ),
                                  instructions: Array.isArray(meal.instructions)
                                    ? meal.instructions
                                    : meal.instructions
                                      ? meal.instructions
                                          .split("\n")
                                          .filter((s: string) => s.trim())
                                      : [],
                                }}
                              />
                            </div>
                            <HealthBadgesPopover
                              badges={medicalBadges.map((b: any) => b.badge)}
                              className="mt-2"
                            />
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

                      {/* Add Your Macros - standardized black button */}
                      <div className="space-y-2 mb-3">
                        <GlassButton
                          onClick={() => {
                            const macros = getMealNutrition(meal);
                            setQuickView({
                              protein: Math.round(macros.protein_g),
                              carbs: Math.round(macros.carbs_g),
                              fat: Math.round(macros.fat_g),
                              calories: Math.round(macros.calories),
                              dateISO: new Date().toISOString().slice(0, 10),
                              mealSlot: "snacks",
                            });
                            setLocation(
                              "/biometrics?from=craving-creator&view=macros",
                            );
                          }}
                          className="w-full bg-black hover:bg-black/80 text-white flex items-center justify-center"
                          data-testid="button-add-your-macros"
                        >
                          Add Your Macros
                        </GlassButton>
                        {replaceCtx && (
                          <GlassButton
                            onClick={() => addMealToPlan(meal)}
                            className="w-full bg-white/10 hover:bg-white/20 border border-white/20 overflow-hidden text-ellipsis whitespace-nowrap"
                            data-testid="add-to-meal-plan-button"
                          >
                            Add to Meal Plan
                          </GlassButton>
                        )}
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
            hideCopyButton={true}
          />
        )}

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Use Craving Creator"
          steps={CRAVING_TOUR_STEPS}
        />
      </motion.div>
    </PhaseGate>
  );
}
