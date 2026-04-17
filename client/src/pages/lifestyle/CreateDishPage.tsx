import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useMealImages } from "@/hooks/useMealImages";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import ThinkingDots from "@/components/ThinkingDots";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
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
import { Brain, Sparkles, ArrowLeft, ChefHat, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  isAllergyRelatedError,
  formatAllergyAlertDescription,
} from "@/utils/allergyAlert";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import {
  generateMedicalBadges,
  getUserMedicalProfile,
} from "@/utils/medicalPersonalization";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeDiet, mealMatchesDiet } from "@/utils/dietaryFilter";
import { GlucoseGuardToggle } from "@/components/GlucoseGuardToggle";
import { FlavorToggle } from "@/components/FlavorToggle";
import { KeepItSimpleToggle } from "@/components/KeepItSimpleToggle";
import { useStarchGuardPrecheck } from "@/hooks/useStarchGuardPrecheck";
import {
  StarchGuardIntercept,
  StarchSubstitutionNotice,
} from "@/components/StarchGuardIntercept";
import {
  DietGuardIntercept,
  DietAdaptedNotice,
} from "@/components/DietGuardIntercept";
import { useDietGuardPrecheck } from "@/hooks/useDietGuardPrecheck";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import { setQuickView } from "@/lib/macrosQuickView";
import TrashButton from "@/components/ui/TrashButton";
import FavoriteButton from "@/components/FavoriteButton";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import ServingInstructionsBlock from "@/components/ServingInstructionsBlock";
import PhaseGate from "@/components/PhaseGate";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import DietStyleBadge from "@/components/DietStyleBadge";
import MealClassificationPill from "@/components/MealClassificationPill";
import KosherProTip from "@/components/KosherProTip";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";

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
  dietaryComplianceVerified?: boolean;
  dietClassification?: import("@/components/MealClassificationPill").DietClassification | null;
}

// ============================================================
// CACHE KEY: v2 — intentionally bumped from v1 to invalidate
// all stale localStorage data that caused the black overlay bug.
// Do NOT downgrade this key — stale v1 data resurrects the bug.
// ============================================================
const CACHE_KEY = "createDish.cache.v2";
const CACHE_KEY_LEGACY = "createDish.cache.v1";

// Only the final meal card is persisted — NOT dishInput, cookMethod,
// or notes. Restoring dishInput triggers the starch-guard useEffect
// on mount, which causes overlay intercepts before user interaction.
type CachedDishState = {
  generatedMeal: MealData | null;
  servings: number;
  generatedAtISO: string;
};

function saveDishCache(state: CachedDishState) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {}
}

function loadDishCache(): CachedDishState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.generatedMeal?.id) return null;
    return parsed as CachedDishState;
  } catch {
    return null;
  }
}

function clearDishCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_KEY_LEGACY);
  } catch {}
}

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

const COOK_METHODS = [
  "Stovetop",
  "Oven",
  "Air Fryer",
  "Slow Cooker",
  "Grill",
  "No-Bake",
  "Any",
];

export default function CreateDishPage() {
  useCopilotPageExplanation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [dishInput, setDishInput] = useState("");
  const [servings, setServings] = useState<number>(2);
  const [cookMethod, setCookMethod] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [generatedMeals, setGeneratedMeals] = useState<MealData[]>([]);
  const { loadingImages, hydrateImages } = useMealImages(setGeneratedMeals, { mealType: "dinner", concurrency: 1 });
  // ============================================================
  // GUARD: generatedInSession controls ShoppingAggregateBar visibility.
  // It MUST start false and remain false during auto-restore on mount.
  // Only explicit user actions (generate / select a meal) may set it true.
  // This prevents the bar from cold-mounting as a black overlay on page load.
  //
  // RULE FOR FUTURE AGENTS: Do NOT set generatedInSession=true inside the
  // cache-restore useEffect. Doing so re-introduces the black overlay bug
  // (MPM-2026-CreateDish-Overlay). The fix was deliberately architected this way.
  // ============================================================
  const [generatedInSession, setGeneratedInSession] = useState(false);
  const [mealOptions, setMealOptions] = useState<any[]>([]);
  const [isPlatingMeal, setIsPlatingMeal] = useState(false);

  const getRecentMeals = (): string[] => {
    try {
      return JSON.parse(sessionStorage.getItem("cd_recent_meals") || "[]");
    } catch {
      return [];
    }
  };
  const addRecentMeal = (mealName: string): void => {
    try {
      const recent = getRecentMeals();
      const updated = [
        mealName,
        ...recent.filter((m: string) => m !== mealName),
      ].slice(0, 3);
      sessionStorage.setItem("cd_recent_meals", JSON.stringify(updated));
    } catch {}
  };

  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<number | null>(null);

  const {
    alert: dietAlert,
    decision: dietDecision,
    checkDiet,
    clearAlert: clearDietAlert,
    setDecision: setDietDecision,
    triggerAlert: triggerDietAlert,
    activeDiet,
  } = useDietGuardPrecheck();
  const [dietAdaptedNotice, setDietAdaptedNotice] = useState<string | null>(
    null,
  );

  // 🔐 SafetyGuard preflight system
  const {
    alert: safetyAlert,
    checkSafety,
    clearAlert: clearSafetyAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride,
  } = useSafetyGuardPrecheck();
  const [pendingGeneration, setPendingGeneration] = useState(false);

  const { user } = useAuth();
  const sweetenerPreferences = user?.sweetenerPreferences || [];
  const userId = user?.id || "";

  const mealOptionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (mealOptions.length > 0 && mealOptionsRef.current) {
      setTimeout(() => {
        mealOptionsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    }
  }, [mealOptions.length]);

  useEffect(() => {
    document.title = "Create a Dish | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // ============================================================
  // SAFE RESTORE: Only restores the final meal card display data.
  // generatedInSession intentionally stays FALSE here — this is not
  // a user-initiated generation, so ShoppingAggregateBar must NOT mount.
  // Do NOT add setGeneratedInSession(true) here. See GUARD comment above.
  // Do NOT restore dishInput — it triggers starch-guard on mount.
  // Do NOT show a restore toast — it fires on page exit and confuses users.
  // ============================================================
  useEffect(() => {
    // Clear stale v1 cache that caused the overlay bug before this fix.
    try {
      localStorage.removeItem("createDish.cache.v1");
    } catch {}

    const cached = loadDishCache();
    if (cached?.generatedMeal?.id) {
      setGeneratedMeals([cached.generatedMeal]);
      setServings(cached.servings || 2);
      // generatedInSession remains false — bar will not cold-mount
    }
  }, []);

  useEffect(() => {
    if (generatedMeals.length > 0 && generatedMeals[0]?.id) {
      saveDishCache({
        generatedMeal: generatedMeals[0],
        servings,
        generatedAtISO: new Date().toISOString(),
      });
    }
  }, [generatedMeals, servings]);

  const handleSelectMeal = async (meal: any) => {
    setMealOptions([]);
    addRecentMeal(meal.name);
    setIsPlatingMeal(true);

    // Show card immediately — image hydrates in parallel
    setGeneratedMeals([meal]);
    setGeneratedInSession(true);
    setIsPlatingMeal(false);
    saveDishCache({
      generatedMeal: meal,
      servings,
      generatedAtISO: new Date().toISOString(),
    });
    hydrateImages([meal]);
  };

  const startProgressTicker = () => {
    if (tickerRef.current) return;
    setProgress(0);
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
    setProgress(100);
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState<Record<string, boolean>>(
    {},
  );
  const [activeSteps, setActiveSteps] = useState<Record<string, number | null>>(
    {},
  );
  const [flavorPersonal, setFlavorPersonal] = useState(true);
  const [keepItSimple, setKeepItSimple] = useState(false);

  const {
    alert: starchAlert,
    decision: starchDecision,
    checkStarch,
    clearAlert: clearStarchAlert,
    setDecision: setStarchDecision,
    isBlocked: starchBlocked,
  } = useStarchGuardPrecheck();

  const [substitutedStarchTerms, setSubstitutedStarchTerms] = useState<
    string[]
  >([]);

  useEffect(() => {
    if (dishInput.trim().length >= 3 && starchDecision === "pending") {
      checkStarch(dishInput);
    }
  }, [dishInput, starchDecision, checkStarch]);

  const buildPrompt = () => {
    const parts: string[] = [];
    if (dishInput.trim()) parts.push(dishInput.trim());
    if (cookMethod && cookMethod !== "Any")
      parts.push(`Cooking method: ${cookMethod}`);
    if (notes.trim()) parts.push(`Notes: ${notes.trim()}`);
    return parts.join(". ");
  };

  const handleSafetyOverride = (_enabled: boolean, token?: string) => {
    if (token) {
      setOverrideToken(token);
      clearSafetyAlert();
      setPendingGeneration(true);
    }
  };

  useEffect(() => {
    if (pendingGeneration && overrideToken && !isGenerating) {
      setPendingGeneration(false);
      handleGenerateDish(true);
    }
  }, [pendingGeneration, overrideToken, isGenerating]);

  const handleGenerateDish = async (skipPreflight = false, dietAdaptOverride = false) => {
    setDietAdaptedNotice(null);

    if (!dishInput.trim()) {
      toast({
        title: "Missing Information",
        description: "Please describe the dish you want to create!",
        variant: "destructive",
      });
      return;
    }

    const prompt = buildPrompt();

    // 🥗 DietGuard pre-flight — cultural/dietary identity gets highest priority.
    // Must run BEFORE SafetyGuard so protocol conflicts (halal/kosher/vegan)
    // show the Protocol Conflict modal instead of the generic safety banner.
    if (!skipPreflight && activeDiet && dietDecision !== "let_chef_adapt") {
      const dietOk = checkDiet(prompt);
      if (!dietOk) {
        return;
      }
    }

    // 🔐 SafetyGuard pre-flight — allergy/intolerance check (runs after diet so
    // cultural protocol conflicts are never shadowed by the safety banner).
    if (!skipPreflight && !hasActiveOverride) {
      const isSafe = await checkSafety(prompt, "create-dish");
      if (!isSafe) {
        return;
      }
    }

    if (!skipPreflight && starchDecision !== "let_chef_pick") {
      const starchOk = checkStarch(prompt);
      if (!starchOk) {
        return;
      }
    }

    const chefSubstituting =
      starchDecision === "let_chef_pick" && starchAlert.matchedTerms.length > 0;
    if (chefSubstituting) {
      setSubstitutedStarchTerms(starchAlert.matchedTerms);
    } else {
      setSubstitutedStarchTerms([]);
    }

    setIsGenerating(true);
    startProgressTicker();

    try {
      const url = apiUrl("/api/meals/craving-creator");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMealType: "dinner",
          cravingInput: prompt,
          dietaryRestrictions: normalizeDiet(user?.dietaryRestrictions),
          userId,
          servings,
          sweetenerPreferences,
          skipPalate: !flavorPersonal,
          excludeMeals: getRecentMeals(),
          strictMode: keepItSimple,
          dietAdaptOverride,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to generate meal");
      }

      if (data.meals && Array.isArray(data.meals) && data.meals.length > 0) {
        stopProgressTicker();
        setIsGenerating(false);
        const userDiet = normalizeDiet(user?.dietaryRestrictions);
        if (data.dietAdapted) {
          setDietAdaptedNotice(
            data.dietNotice || `Adapted for your ${userDiet} diet.`,
          );
          clearDietAlert();
        }
        setMealOptions(data.meals);
        return;
      }

      const meal = data.meal || data;

      const userDiet = normalizeDiet(user?.dietaryRestrictions);
      if (data.dietAdapted) {
        setDietAdaptedNotice(
          data.dietNotice || `Adapted for your ${userDiet} diet.`,
        );
        clearDietAlert();
      } else if (
        !skipPreflight &&
        activeDiet &&
        !mealMatchesDiet(userDiet, meal)
      ) {
        stopProgressTicker();
        setIsGenerating(false);
        triggerDietAlert(
          [],
          `This meal may not fully match your ${userDiet} diet.`,
        );
        return;
      }

      stopProgressTicker();
      setGeneratedMeals([meal]);
      setGeneratedInSession(true);

      saveDishCache({
        generatedMeal: meal,
        servings,
        generatedAtISO: new Date().toISOString(),
      });

      toast({
        title: "Dish Created!",
        description: `${meal.name} is ready for you.`,
      });
    } catch (error: any) {
      stopProgressTicker();
      const errorMsg = error.message || "";
      if (isAllergyRelatedError(errorMsg)) {
        toast({
          title: "Allergy Alert",
          description: formatAllergyAlertDescription(errorMsg),
          variant: "warning",
        });
      } else {
        toast({
          title: "Something went wrong",
          description: "Unable to create the dish. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <PhaseGate phase="PHASE_1_CORE" feature="create-dish">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
      >
        <MobileHeaderGuard>
          <div
            className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-lg border-b border-orange-400/20"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            <div className="px-4 py-3 flex items-center gap-2 flex-nowrap overflow-hidden">
              <button
                onClick={() => setLocation("/lifestyle")}
                className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Back</span>
              </button>

              <h1 className="text-lg font-bold text-white truncate min-w-0">
                Create a Dish
              </h1>

              <div className="flex-grow" />
            </div>
          </div>
        </MobileHeaderGuard>

        <div
          className={`max-w-2xl mx-auto px-4 pt-28 ${generatedMeals.length > 0 ? "pb-32" : "pb-8"}`}
        >
          <div className="w-full max-w-4xl mx-auto">
            <div>
              <Card className="shadow-2xl bg-black/40 backdrop-blur-lg border border-orange-400/20 w-full max-w-xl mx-auto">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-xl text-white">
                    Create a Dish
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-md font-medium text-white">
                        What dish do you want to create?
                      </label>
                    </div>
                    <div className="relative">
                      <textarea
                        value={dishInput}
                        onChange={(e) => setDishInput(e.target.value)}
                        placeholder="e.g., a hearty chicken stir-fry with vegetables and garlic sauce, or spicy salmon tacos..."
                        className="w-full px-3 py-2 pr-10 bg-black text-white placeholder:text-white/40 border border-orange-400/20 rounded-lg h-20 resize-none text-sm"
                        maxLength={300}
                      />
                      {dishInput && (
                        <TrashButton
                          onClick={() => setDishInput("")}
                          size="sm"
                          ariaLabel="Clear dish input"
                          title="Clear dish input"
                          className="absolute top-2 right-2"
                        />
                      )}
                    </div>
                    <p className="text-xs text-white/50 mt-1 text-right">
                      {dishInput.length}/300
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">
                      Servings (1–12)
                    </label>
                    <Select
                      value={servings.toString()}
                      onValueChange={(v) => setServings(parseInt(v))}
                    >
                      <SelectTrigger className="w-full text-sm bg-black text-white border-orange-400/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (n) => (
                            <SelectItem key={n} value={n.toString()}>
                              {n === 1
                                ? "1 serving (just me)"
                                : `${n} servings`}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">
                      Cooking Method
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COOK_METHODS.map((method) => (
                        <button
                          key={method}
                          onClick={() =>
                            setCookMethod(cookMethod === method ? "" : method)
                          }
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                            cookMethod === method
                              ? "bg-orange-500 border-orange-400 text-white"
                              : "bg-black/40 border-white/20 text-white/70 hover:border-orange-400/50 hover:text-white"
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-white">
                      Optional Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g., no dairy, extra spicy, low sodium, for meal prep..."
                      className="w-full px-3 py-2 bg-black text-white placeholder:text-white/40 border border-orange-400/20 rounded-lg h-16 resize-none text-sm"
                      maxLength={250}
                    />
                    <p className="text-xs text-white/50 mt-1 text-right">
                      {notes.length}/250
                    </p>
                  </div>

                  {/* SafetyGuard Preflight Banner */}
                  <SafetyGuardBanner
                    alert={safetyAlert}
                    mealRequest={dishInput}
                    onDismiss={clearSafetyAlert}
                    onOverrideSuccess={(token) =>
                      handleSafetyOverride(false, token)
                    }
                    className="mt-3"
                  />

                  <StarchGuardIntercept
                    alert={starchAlert}
                    onDecision={(decision) => {
                      if (decision === "order_something_else") {
                        clearStarchAlert();
                        setDishInput("");
                        toast({
                          title: "Try a different ingredient",
                          description:
                            "Choose something without starches like meat, fish, or veggies.",
                          duration: 4000,
                        });
                      } else if (decision === "let_chef_pick") {
                        setStarchDecision(decision);
                        handleGenerateDish(true);
                      }
                    }}
                    className="mt-3"
                  />

                  <DietGuardIntercept
                    alert={dietAlert}
                    onDecision={(decision) => {
                      if (decision === "pick_something_else") {
                        clearDietAlert();
                        setGeneratedMeals([]);
                        setMealOptions([]);
                        setDishInput("");
                      } else if (decision === "let_chef_adapt") {
                        setDietDecision("let_chef_adapt");
                        handleGenerateDish(true, true);
                      }
                    }}
                    className="mt-3"
                  />

                  <div className="mt-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
                    <span className="text-xs text-white/60 block mb-2">
                      Meal Safety
                    </span>

                    <GlucoseGuardToggle disabled={isGenerating} />
                  </div>

                  <div className="mt-2 py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                    <span className="text-xs text-white/60 block mb-2">
                      Flavor Profile
                    </span>
                    <FlavorToggle
                      flavorPersonal={flavorPersonal}
                      onFlavorChange={setFlavorPersonal}
                      disabled={isGenerating}
                    />
                  </div>

                  {/* Keep It Simple Section */}
                  <div className="mt-2 py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                    <span className="text-xs text-white/60 block mb-2">
                      Ingredient Control
                    </span>
                    <KeepItSimpleToggle
                      keepItSimple={keepItSimple}
                      onToggle={setKeepItSimple}
                      disabled={isGenerating}
                    />
                    <p className="text-xs text-white/40 mt-1">
                      {keepItSimple
                        ? "AI will use only what you listed — nothing added"
                        : "AI may add complementary ingredients"}
                    </p>
                  </div>

                  {isGenerating && (
                    <div className="flex justify-center mt-2">
                      <ThinkingDots label="Chef is crafting your dish…" />
                    </div>
                  )}

                  {!isGenerating ? (
                    <GlassButton
                      onClick={() => handleGenerateDish()}
                      disabled={isGenerating || starchBlocked}
                      className="w-full bg-lime-600 overflow-hidden text-ellipsis whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      <ChefHat className="h-4 w-4" />
                      {"Create My Dish"}
                    </GlassButton>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>

          {isPlatingMeal && (
            <div className="mt-8 flex justify-center py-10">
              <ThinkingDots label="Chef is plating your dish…" />
            </div>
          )}

          {!isPlatingMeal && mealOptions.length > 0 && (
            <div className="mt-8 space-y-4" ref={mealOptionsRef}>
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="h-5 w-5 text-orange-400" />
                <h3 className="text-lg font-bold text-white">
                  Pick your favorite
                </h3>
                <span className="text-sm text-white/60">
                  {mealOptions.length} options created for you
                </span>
              </div>
              {mealOptions.map((option, idx) => (
                <Card
                  key={idx}
                  className="bg-black/40 backdrop-blur-lg border border-orange-400/20 shadow-xl rounded-2xl"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-bold text-base mb-1 truncate">
                          {option.name}
                        </h4>
                        <p className="text-white/70 text-sm mb-2 line-clamp-2">
                          {option.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <MealClassificationPill dietClassification={option.dietClassification ?? null} />
                          <KosherProTip dietClassification={option.dietClassification ?? null} isAdapted={false} />
                        </div>
                        <div className="flex gap-4 text-xs text-white/60 flex-wrap">
                          <span>
                            {option.nutrition?.calories ??
                              option.calories ??
                              "—"}{" "}
                            cal
                          </span>
                          <span>
                            {option.nutrition?.protein ?? option.protein ?? "—"}
                            g protein
                          </span>
                          <span>
                            {option.nutrition?.fat ?? option.fat ?? "—"}g fat
                          </span>
                          {option.cookingTime && (
                            <span>{option.cookingTime}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelectMeal(option)}
                        className="shrink-0 bg-lime-600 active:scale-95 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all"
                      >
                        Pick This
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <button
                onClick={() => {
                  setMealOptions([]);
                  setDishInput("");
                }}
                className="w-full text-sm text-white/50 hover:text-white/80 py-2 transition-colors"
              >
                Start over with a different dish
              </button>
            </div>
          )}

          {generatedMeals.length > 0 && (
            <div className="mt-8 space-y-6">
              {generatedMeals.map((meal, index) => (
                <div key={index}>
                  <Card className="bg-black/40 backdrop-blur-lg border border-orange-400/20 shadow-xl rounded-2xl">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <ChefHat className="h-6 w-6 text-orange-400" />
                          <h3 className="text-xl font-bold text-white">
                            {meal.name}
                          </h3>
                          <FavoriteButton
                            title={meal.name}
                            sourceType="create-dish"
                            mealData={meal}
                          />
                        </div>
                        <button
                          onClick={() => {
                            setGeneratedMeals([]);
                            setGeneratedInSession(false);
                            clearDishCache();
                            setDishInput("");
                            setSubstitutedStarchTerms([]);
                            clearStarchAlert();
                          }}
                          className="text-sm text-white/70 bg-white/10 px-3 py-1 rounded-lg transition-colors active:scale-[0.98]"
                        >
                          Create New
                        </button>
                      </div>

                      {substitutedStarchTerms.length > 0 && (
                        <StarchSubstitutionNotice
                          originalTerms={substitutedStarchTerms}
                          className="mb-4"
                        />
                      )}

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <DietStyleBadge />
                        <MealClassificationPill dietClassification={meal.dietClassification} />
                        {dietAdaptedNotice && (
                          <DietAdaptedNotice
                            diet={normalizeDiet(user?.dietaryRestrictions)}
                          />
                        )}
                        <KosherProTip
                          dietClassification={meal.dietClassification}
                          isAdapted={!!dietAdaptedNotice}
                        />
                      </div>

                      <p className="text-white/90 mb-4">{meal.description}</p>

                      <MealImageSlot
                        imageUrl={meal.imageUrl}
                        mealName={meal.name}
                        isLoading={!!loadingImages[meal.id]}
                      />

                      <div className="mb-4 p-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-white">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">
                            Serving Size:
                          </span>{" "}
                          {meal.servingSize || "1 serving"}
                        </div>
                      </div>

                      <ServingInstructionsBlock
                        servings={servings}
                        mealName={meal.name}
                        description={meal.description}
                      />

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
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <HealthBadgesPopover
                                  badges={medicalBadges.map((b: any) =>
                                    typeof b === "string"
                                      ? b
                                      : b.badge ||
                                        b.id ||
                                        b.condition ||
                                        b.label,
                                  )}
                                />
                                <h3 className="font-semibold text-white">
                                  Medical Safety
                                </h3>
                              </div>
                              <TrashButton
                                size="sm"
                                ariaLabel="Remove meal"
                                title="Remove meal"
                                confirm={true}
                                confirmMessage="Remove this meal?"
                                onClick={() => {
                                  setGeneratedMeals([]);
                                  setGeneratedInSession(false);
                                }}
                              />
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

                      {(() => {
                        const steps = normalizeInstructions(meal.instructions);
                        if (steps.length === 0) return null;
                        const expanded = !!stepsExpanded[meal.id];
                        const visibleSteps = expanded
                          ? steps
                          : steps.slice(0, 3);
                        return (
                          <div className="mb-4">
                            <h4 className="font-semibold mb-2 text-white">
                              Instructions:
                            </h4>
                            <div className="space-y-2">
                              {visibleSteps.map((step, index) => (
                                <div
                                  key={index}
                                  className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors select-none ${activeSteps[meal.id] === index ? "bg-orange-500/20 border border-orange-500/40" : "hover:bg-white/5"}`}
                                  onClick={() =>
                                    setActiveSteps((prev) => ({
                                      ...prev,
                                      [meal.id]:
                                        prev[meal.id] === index ? null : index,
                                    }))
                                  }
                                >
                                  <div className="min-w-[26px] h-[26px] w-[26px] rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                    {index + 1}
                                  </div>
                                  <p className="text-sm leading-relaxed text-white/85">
                                    {step}
                                  </p>
                                </div>
                              ))}
                            </div>
                            {steps.length > 3 && (
                              <button
                                className="mt-2 text-xs text-orange-400 font-medium cursor-pointer active:text-orange-300 select-none"
                                onClick={() => {
                                  setStepsExpanded((prev) => ({
                                    ...prev,
                                    [meal.id]: !expanded,
                                  }));
                                  if (expanded)
                                    setActiveSteps((prev) => ({
                                      ...prev,
                                      [meal.id]: null,
                                    }));
                                }}
                              >
                                {expanded
                                  ? "Show less"
                                  : `Show all ${steps.length} steps`}
                              </button>
                            )}
                          </div>
                        );
                      })()}

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

                      <div className="space-y-2 mb-3">
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
                              mealSlot: "dinner",
                            });
                            setLocation(
                              "/biometrics?from=create-dish&view=macros",
                            );
                          }}
                          className="w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-black hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-900 text-white flex items-center justify-center border border-white/30"
                        >
                          Add to Macros
                        </GlassButton>

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
                                        description:
                                          translated.description ||
                                          m.description,
                                        instructions:
                                          typeof translated.instructions ===
                                          "string"
                                            ? translated.instructions
                                            : m.instructions,
                                        ingredients:
                                          (translated.ingredients as StructuredIngredient[]) ||
                                          m.ingredients,
                                      }
                                    : m,
                                ),
                              );
                            }}
                          />
                        </div>

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
                              localStorage.setItem(
                                "mpm_chefs_kitchen_meal",
                                JSON.stringify(mealData),
                              );
                              localStorage.setItem(
                                "mpm_chefs_kitchen_external_prepare",
                                "true",
                              );
                              setLocation("/lifestyle/chefs-kitchen");
                            }}
                            className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                          >
                            Prepare with Chef
                          </GlassButton>
                          <ShareRecipeButton
                            recipe={{
                              name: meal.name,
                              description: meal.description,
                              nutrition: meal.nutrition,
                              ingredients: (meal.ingredients ?? []).map(
                                (ing: any) => ({
                                  name: ing.item || ing.name,
                                  amount: ing.amount || ing.quantity,
                                  unit: ing.unit,
                                }),
                              ),
                            }}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>

        {generatedMeals.length > 0 && generatedInSession && (
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
            source="Create a Dish"
            hideShareButton={true}
            aboveBottomNav={true}
          />
        )}
      </motion.div>
    </PhaseGate>
  );
}
