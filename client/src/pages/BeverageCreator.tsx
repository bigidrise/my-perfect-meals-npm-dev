import { useState, useEffect, useRef } from "react";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import ThinkingDots from "@/components/ThinkingDots";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
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
import { Sparkles, ArrowLeft, Brain, Wine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  isAllergyRelatedError,
  formatAllergyAlertDescription,
} from "@/utils/allergyAlert";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import PhaseGate from "@/components/PhaseGate";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { useStarchGuardPrecheck } from "@/hooks/useStarchGuardPrecheck";
import { Wheat } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
import FavoriteButton from "@/components/FavoriteButton";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";
import TrashButton from "@/components/ui/TrashButton";
import { deriveSplitCarbs } from "@/utils/ingredientClassifier";
import { DietCuisineControlRow } from "@/components/ui/DietCuisineControlRow";

const BEVERAGE_CATEGORIES = [
  { value: "surprise", label: "Surprise Me!" },
  { value: "cocktail", label: "Cocktail" },
  { value: "mocktail", label: "Mocktail" },
  { value: "smoothie", label: "Smoothie" },
  { value: "protein-shake", label: "Protein Shake" },
  { value: "milkshake", label: "Milkshake" },
  { value: "coffee", label: "Coffee Drink" },
  { value: "tea", label: "Tea Drink" },
  { value: "frozen", label: "Frozen Drink" },
  { value: "hydration", label: "Hydration Drink" },
];

const FLAVOR_FAMILIES = [
  { value: "no-preference", label: "No Preference" },
  { value: "citrus", label: "Citrus" },
  { value: "berry", label: "Berry" },
  { value: "tropical", label: "Tropical" },
  { value: "chocolate", label: "Chocolate" },
  { value: "vanilla", label: "Vanilla" },
  { value: "coffee", label: "Coffee" },
  { value: "caramel", label: "Caramel" },
  { value: "herbal", label: "Herbal" },
  { value: "spicy", label: "Spicy" },
];

const SERVING_SIZES = [
  { value: "single", label: "Single Drink" },
  { value: "two", label: "Two Drinks" },
  { value: "pitcher", label: "Pitcher (4–6 drinks)" },
  { value: "party", label: "Party Batch (8–12 drinks)" },
];

const DIETARY_OPTIONS = [
  { value: "low-sugar", label: "Low sugar" },
  { value: "dairy-free", label: "Dairy-free" },
  { value: "high-protein", label: "High protein" },
  { value: "vegan", label: "Vegan" },
  { value: "low-calorie", label: "Low calorie" },
  { value: "no-alcohol", label: "No alcohol" },
];

const BEVERAGE_TOUR_STEPS: TourStep[] = [
  {
    title: "Choose Drink Type",
    description:
      "Pick what kind of drink you want — cocktails, smoothies, protein shakes, coffee drinks, frozen drinks, and more.",
  },
  {
    title: "Choose a Flavor Direction",
    description:
      "Select a flavor family like citrus, berry, tropical, chocolate, or herbal. You can add extra details later.",
  },
  {
    title: "Add Specific Notes (Optional)",
    description:
      "Want something specific? Add notes like 'with coconut milk', 'extra strong', 'topped with whipped cream', or any other details.",
  },
  {
    title: "Select Serving Size",
    description:
      "Choose how many drinks you want — a single drink, two drinks, a pitcher, or a party batch.",
  },
  {
    title: "Add Dietary Preferences",
    description:
      "Optional. Choose things like low sugar, dairy-free, high protein, vegan, or no alcohol.",
  },
  {
    title: "Create Your Drink",
    description:
      "Tap Create and the AI will design a drink that matches your flavor preferences and respects your nutrition goals.",
  },
];

export default function BeverageCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const quickTour = useQuickTour("beverage-creator");
  const { user } = useAuth();
  const userId = user?.id || "";

  const [beverageCategory, setBeverageCategory] = useState("");
  const [flavorFamily, setFlavorFamily] = useState("");
  const [specificDrink, setSpecificDrink] = useState("");
  const [customBeverageDescription, setCustomBeverageDescription] = useState("");
  const [servingSize, setServingSize] = useState("single");
  const [dietaryPreference, setDietaryPreference] = useState("");
  const [customDietary, setCustomDietary] = useState("");
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [generatedBeverage, setGeneratedBeverage] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem("mpm_beverage_creator_result");
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Strip server-computed diet fields — they can go stale if user settings change
      const { dietClassification: _dc, complianceSection: _cs, ...rest } = parsed;
      return rest;
    } catch {
      return null;
    }
  });

  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [beverageImageLoading, setBeverageImageLoading] = useState(false);

  const [safetyEnabled, setSafetyEnabled] = useState(true);
  const [pendingGeneration, setPendingGeneration] = useState(false);

  const [flavorPersonal, setFlavorPersonal] = useState(true);

  const [dietOverrideEnabled, setDietOverrideEnabled] = useState(false);
  const [dietOverrideValue, setDietOverrideValue] = useState("");
  const [cuisineOverrideEnabled, setCuisineOverrideEnabled] = useState(false);
  const [cuisineOverrideValue, setCuisineOverrideValue] = useState("");

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

  const [dietAdaptedNotice, setDietAdaptedNotice] = useState<string | null>(null);

  const {
    alert: beverageStarchAlert,
    checkStarch: checkBeverageStarch,
    clearAlert: clearBeverageStarchAlert,
  } = useStarchGuardPrecheck();

  useEffect(() => {
    if (!generatedBeverage) return;
    const ingredientTexts = (generatedBeverage.ingredients || []).map((ing: any) =>
      typeof ing === "string" ? ing : ing?.name || ""
    ).filter(Boolean);
    checkBeverageStarch(ingredientTexts.length ? ingredientTexts : [generatedBeverage.name || ""]);
  }, [generatedBeverage]);

  const handleSafetyOverride = (enabled: boolean, token?: string) => {
    setSafetyEnabled(enabled);
    if (token) {
      setOverrideToken(token);
      clearSafetyAlert();
      setPendingGeneration(true);
    }
  };

  useEffect(() => {
    if (
      pendingGeneration &&
      overrideToken &&
      !isGenerating &&
      !safetyChecking
    ) {
      setPendingGeneration(false);
      handleGenerateBeverage(false, overrideToken);
    }
  }, [pendingGeneration, overrideToken, isGenerating, safetyChecking]);

  useCopilotPageExplanation();

  useEffect(() => {
    document.title = "Beverage Creator | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (generatedBeverage) {
      try {
        localStorage.setItem(
          "mpm_beverage_creator_result",
          JSON.stringify(generatedBeverage),
        );
      } catch {}
    }
  }, [generatedBeverage]);

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

  async function handleGenerateBeverage(skipDietPreflight = false, overrideToken?: string, dietAdaptOverride = false, userDietOverride = false) {
    const hasCustomDesc = customBeverageDescription.trim().length > 0;

    if (!hasCustomDesc && !beverageCategory) {
      toast({
        title: "Missing Information",
        description: "Select a drink type or describe your own idea above.",
        variant: "destructive",
      });
      return;
    }

    if (!hasCustomDesc && !flavorFamily) {
      toast({
        title: "Missing Information",
        description: "Select a flavor family or describe your idea above.",
        variant: "destructive",
      });
      return;
    }

    if (safetyEnabled && !hasActiveOverride && !overrideToken) {
      const requestDescription =
        `${beverageCategory} ${flavorFamily} ${specificDrink}`.trim();
      const isSafe = await checkSafety(requestDescription, "beverage-creator");
      if (!isSafe) {
        return;
      }
    }

    // 🥗 DietGuard preflight — advisory, skipped on "Let Chef Adapt" retry
    if (!skipDietPreflight && activeDiet && dietDecision !== "let_chef_adapt") {
      const dietInput = customBeverageDescription.trim() || `${beverageCategory} ${flavorFamily} ${specificDrink}`.trim();
      const dietOk = checkDiet(dietInput);
      if (!dietOk) return;
    }

    setIsGenerating(true);
    startProgressTicker();
    console.log("🍹 [BEVERAGE] Starting generation...", {
      beverageCategory,
      flavorFamily,
      specificDrink,
      servingSize,
      safetyEnabled,
      hasOverrideToken: !!overrideToken,
    });

    try {
      console.log("🍹 [BEVERAGE] Calling API...");
      const res = await fetch(apiUrl("/api/meals/beverage-creator"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          beverageCategory,
          flavorFamily,
          specificDrink,
          customBeverageDescription: customBeverageDescription.trim() || undefined,
          servingSize,
          dietaryPreferences: [
            ...(dietaryPreference && dietaryPreference !== "none"
              ? [dietaryPreference]
              : []),
            ...(customDietary.trim() ? [customDietary.trim()] : []),
          ],
          userId: userId,
          safetyMode:
            !safetyEnabled && overrideToken ? "CUSTOM_AUTHENTICATED" : "STRICT",
          overrideToken: !safetyEnabled ? overrideToken : undefined,
          skipPalate: !flavorPersonal,
          dietAdaptOverride,
          userDietOverride,
          dietOverride: dietOverrideEnabled && dietOverrideValue ? dietOverrideValue : undefined,
          cultureOverride: cuisineOverrideEnabled && cuisineOverrideValue ? cuisineOverrideValue : undefined,
        }),
      });

      console.log("🍹 [BEVERAGE] API response received:", res.status);

      const data = await res.json().catch(() => null);

      if (data?.safetyBlocked || data?.safetyAmbiguous) {
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

      setSafetyEnabled(true);
      clearSafetyAlert();

      if (!res.ok) {
        console.error("🍹 Beverage Creator API Error:", res.status, data);

        if (data?.error === "ALLERGY_SAFETY_BLOCK") {
          throw new Error(`🚨 Safety Alert: ${data.message}`);
        }

        throw new Error(data?.error || "Generation failed");
      }

      console.log("🍹 [BEVERAGE] Parsed response data:", data);
      const meal = data.meal || data;

      // 🥗 Scenario A: server flagged diet adaptation — accept result, show soft notice
      const userDiet = normalizeDiet(user?.dietaryRestrictions);
      if (data.dietAdapted) {
        setDietAdaptedNotice(data.dietNotice || `Adapted for your ${userDiet} diet.`);
        clearDietAlert();
      } else if (!skipDietPreflight && activeDiet && !mealMatchesDiet(userDiet, meal)) {
        // 🥗 Scenario B fallback — only fires on initial generate, never on "let chef adapt" retry
        stopProgressTicker();
        setIsGenerating(false);
        triggerDietAlert([], `This drink may not fully match your ${userDiet} diet.`);
        return;
      }

      stopProgressTicker();
      setGeneratedBeverage(meal);
      // Fire image async — non-blocking
      setBeverageImageLoading(true);
      fetch(apiUrl("/api/meals/generate-image"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId: meal.id, mealName: meal.name, mealType: "beverages", ingredients: meal.ingredients }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.imageUrl) setGeneratedBeverage((prev: any) => prev ? { ...prev, imageUrl: d.imageUrl } : prev);
        })
        .catch(() => {})
        .finally(() => setBeverageImageLoading(false));

      toast({
        title: "✨ Drink Created!",
        description: `${meal.name} is ready for you.`,
      });
    } catch (err: any) {
      console.error("🍹 [BEVERAGE] Generation error:", err);
      stopProgressTicker();
      const errorMsg = err?.message || String(err) || "";
      if (isAllergyRelatedError(errorMsg)) {
        toast({
          title: "⚠️ ALLERGY ALERT",
          description: formatAllergyAlertDescription(errorMsg),
          variant: "warning",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: "Please try again.",
          variant: "destructive",
        });
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
    <PhaseGate phase="PHASE_1_CORE" feature="beverage-creator">
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
              onClick={() => setLocation("/lifestyle")}
              className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
              data-testid="beveragecreator-back"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>

            <h1 className="text-lg font-bold text-white truncate min-w-0">
              Beverage Creator
            </h1>

            <div className="flex-grow" />
          </div>
        </div>
        </MobileHeaderGuard>

        <div
          className="max-w-2xl mx-auto px-4 pb-24"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          <Card className="shadow-2xl bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Wine className="h-5 w-5 text-blue-400" />
                Create Your Drink
                <div className="flex-grow" />
                <HowThisWorksLink
                  videoUrl="https://youtube.com/shorts/JLqrxVdS2kI?feature=share"
                  label="How It Works"
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Free-text idea input — fills in dropdowns when used */}
              <div>
                <label className="block text-md font-medium text-white mb-1">
                  What do you want to drink?
                  <span className="ml-2 text-xs text-blue-300 font-normal">
                    (type here to skip everything below)
                  </span>
                </label>
                <div className="relative">
                  <textarea
                    value={customBeverageDescription}
                    onChange={(e) => setCustomBeverageDescription(e.target.value)}
                    placeholder='e.g. "A frozen mango margarita with tajin rim" or "Iced lavender oat milk latte"'
                    rows={3}
                    className="w-full rounded-lg bg-black/60 border border-blue-400/40 text-white placeholder-white/30 text-sm px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-400/60 resize-none"
                  />
                  {customBeverageDescription && (
                    <TrashButton
                      onClick={() => setCustomBeverageDescription("")}
                      size="sm"
                      ariaLabel="Clear beverage description"
                      title="Clear"
                      className="absolute top-2 right-2"
                    />
                  )}
                </div>
                {customBeverageDescription.trim().length > 0 && (
                  <p className="text-xs text-blue-300 mt-1">
                    We'll use your description — selections below are now optional.
                  </p>
                )}
              </div>

              <DietCuisineControlRow
                savedCuisine={user?.cuisinePreference}
                dietOverrideEnabled={dietOverrideEnabled}
                dietOverrideValue={dietOverrideValue}
                onDietToggle={setDietOverrideEnabled}
                onDietChange={setDietOverrideValue}
                cuisineOverrideEnabled={cuisineOverrideEnabled}
                cuisineOverrideValue={cuisineOverrideValue}
                onCuisineToggle={setCuisineOverrideEnabled}
                onCuisineChange={setCuisineOverrideValue}
              />

              <div className="flex items-center gap-2 text-white/30">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs">
                  {customBeverageDescription.trim() ? "Options below are now optional" : "Or build step-by-step below"}
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div>
                <label className="block text-md font-medium text-white mb-1">
                  Beverage Category{" "}
                  {!customBeverageDescription.trim() && <span className="text-blue-400">*</span>}
                </label>
                <Select
                  value={beverageCategory}
                  onValueChange={setBeverageCategory}
                >
                  <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                    <SelectValue placeholder="Select drink type" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-60 overflow-y-auto">
                    {BEVERAGE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-md font-medium text-white mb-1">
                  Flavor Family{" "}
                  {!customBeverageDescription.trim() && <span className="text-blue-400">*</span>}
                </label>
                <Select value={flavorFamily} onValueChange={setFlavorFamily}>
                  <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                    <SelectValue placeholder="Select flavor" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-60 overflow-y-auto">
                    {FLAVOR_FAMILIES.map((flavor) => (
                      <SelectItem key={flavor.value} value={flavor.value}>
                        {flavor.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-md font-medium text-white mb-1">
                  Additional Notes (optional)
                </label>
                <div className="relative">
                  <input
                    value={specificDrink}
                    onChange={(e) => setSpecificDrink(e.target.value)}
                    placeholder="e.g., with coconut milk, extra strong, frozen..."
                    className="w-full bg-black text-white border border-white/30 px-3 py-2 pr-8 rounded-lg text-sm placeholder:text-white/50"
                    maxLength={150}
                  />
                  {specificDrink && (
                    <TrashButton
                      onClick={() => setSpecificDrink("")}
                      size="sm"
                      ariaLabel="Clear additional notes"
                      title="Clear"
                      className="absolute top-1/2 -translate-y-1/2 right-2"
                    />
                  )}
                </div>
                <p className="text-xs text-white/60 mt-1">
                  Add specific details or leave empty
                </p>
              </div>

              <div>
                <label className="block text-md font-medium text-white mb-1">
                  Serving Size <span className="text-blue-400">*</span>
                </label>
                <Select value={servingSize} onValueChange={setServingSize}>
                  <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-60 overflow-y-auto">
                    {SERVING_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-md font-medium text-white mb-1">
                  Dietary Requirements (optional)
                </label>
                <Select
                  value={dietaryPreference}
                  onValueChange={setDietaryPreference}
                >
                  <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                    <SelectValue placeholder="Select dietary requirement" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" sideOffset={4} className="max-h-60 overflow-y-auto">
                    <SelectItem value="none">None</SelectItem>
                    {DIETARY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <SafetyGuardBanner
                alert={safetyAlert}
                mealRequest={`${beverageCategory} ${flavorFamily} ${specificDrink}`.trim()}
                onDismiss={clearSafetyAlert}
                onOverrideSuccess={(token) =>
                  handleSafetyOverride(false, token)
                }
              />

              <div className="mb-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
                <span className="text-xs text-white/60 block mb-2">
                  Meal Safety
                </span>
                <SafetyGuardToggle
                  safetyEnabled={safetyEnabled}
                  onSafetyChange={handleSafetyOverride}
                  disabled={isGenerating || safetyChecking}
                />
                <GlucoseGuardToggle disabled={isGenerating || safetyChecking} />
              </div>

              <div className="mb-4 py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                <span className="text-xs text-white/60 block mb-2">
                  Flavor Preference
                </span>
                <FlavorToggle
                  flavorPersonal={flavorPersonal}
                  onFlavorChange={setFlavorPersonal}
                  disabled={isGenerating}
                />
                <p className="text-xs text-white/40 mt-1">
                  {flavorPersonal
                    ? "Using your palate preferences"
                    : "Neutral seasoning for others"}
                </p>
              </div>

              {isGenerating || safetyChecking ? (
                <div className="max-w-md mx-auto mb-4 flex justify-center">
                  <ThinkingDots label={safetyChecking ? "Checking safety…" : "Creating your beverage…"} />
                </div>
              ) : (
                <GlassButton
                  onClick={() => handleGenerateBeverage()}
                  className="w-full bg-lime-600 flex items-center justify-center"
                >
                  Create My Drink
                </GlassButton>
              )}
            </CardContent>
          </Card>

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
                      <Wine className="h-5 w-5 text-blue-400 shrink-0" />
                      <h3 className="text-xl font-bold text-white truncate leading-tight">
                        {generatedBeverage.name}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <FavoriteButton
                        title={generatedBeverage.name}
                        sourceType="beverage-creator"
                        mealData={generatedBeverage}
                      />
                      <button
                        onClick={() => {
                          setGeneratedBeverage(null);
                          localStorage.removeItem("mpm_beverage_creator_result");
                        }}
                        className="text-sm text-white/70 bg-white/10 px-3 py-1 rounded-lg transition-colors active:scale-[0.98]"
                      >
                        Create New
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <DietStyleBadge />
                    <MealClassificationPill dietClassification={generatedBeverage.dietClassification} />
                    {dietAdaptedNotice && (
                      <DietAdaptedNotice
                        diet={normalizeDiet(user?.dietaryRestrictions)}
                      />
                    )}
                    <KosherProTip
                      dietClassification={generatedBeverage.dietClassification}
                      isAdapted={!!dietAdaptedNotice}
                    />
                  </div>

                  <p className="text-white/90 mb-4">
                    {generatedBeverage.description}
                  </p>

                  <MealImageSlot
                    imageUrl={generatedBeverage.imageUrl}
                    mealName={generatedBeverage.name}
                    sourceType="beverage"
                    isLoading={beverageImageLoading}
                  />

                  <div className="mb-4 p-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-white">
                      <Wine className="h-4 w-4 text-blue-400" />
                      <span className="font-medium">Serving Size:</span>{" "}
                      {generatedBeverage.servingSize}
                    </div>
                  </div>

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
                      const storedS = generatedBeverage.nutrition?.starchyCarbs ?? generatedBeverage.starchyCarbs;
                      const storedF = generatedBeverage.nutrition?.fibrousCarbs ?? generatedBeverage.fibrousCarbs;
                      const { starchyCarbs, fibrousCarbs } = (typeof storedS === "number" && typeof storedF === "number")
                        ? { starchyCarbs: storedS, fibrousCarbs: storedF }
                        : deriveSplitCarbs(generatedBeverage.ingredients ?? [], totalCarbs);
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
                        <HealthBadgesPopover
                          badges={generatedBeverage.medicalBadges || []}
                          align="start"
                        />
                        <h3 className="font-semibold text-white">
                          Medical Safety
                        </h3>
                      </div>
                      <TrashButton
                        size="sm"
                        ariaLabel="Remove beverage"
                        title="Remove beverage"
                        confirm={true}
                        confirmMessage="Remove this beverage?"
                        onClick={() => setGeneratedBeverage(null)}
                      />
                    </div>
                  </div>

                  {generatedBeverage.ingredients?.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2 text-white">
                        Ingredients:
                      </h4>
                      <ul className="text-sm text-white/80 space-y-1">
                        {generatedBeverage.ingredients.map(
                          (ing: any, i: number) => (
                            <li key={i}>
                              {ing.displayText ||
                                `${ing.amount || ""} ${ing.unit || ""} ${ing.name || ing.item}`}
                            </li>
                          ),
                        )}
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
                            <div key={index}
                              className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors select-none ${activeStep === index ? "bg-orange-500/20 border border-orange-500/40" : "hover:bg-white/5"}`}
                              onClick={() => setActiveStep(activeStep === index ? null : index)}>
                              <div className="min-w-[26px] h-[26px] w-[26px] rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{index + 1}</div>
                              <p className="text-sm leading-relaxed text-white/85">{step}</p>
                            </div>
                          ))}
                        </div>
                        {steps.length > 3 && (
                          <button className="mt-2 text-xs text-orange-400 font-medium cursor-pointer active:text-orange-300 select-none"
                            onClick={() => { setInstructionsExpanded(!instructionsExpanded); if (instructionsExpanded) setActiveStep(null); }}>
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
                      <p className="text-sm text-white/80">
                        {generatedBeverage.reasoning}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <GlassButton
                      onClick={() => {
                        setLocation(
                          "/biometrics?from=beverage-creator&view=macros",
                        );
                      }}
                      className="w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-black hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-900 text-white flex items-center justify-center text-center border border-white/30"
                    >
                      Add to Macros
                    </GlassButton>

                    {beverageStarchAlert.show && (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-950/40 border border-amber-600/40 px-3 py-2.5 mb-1">
                        <Wheat className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-amber-300 text-xs font-medium">Starchy Carbs Already Covered</p>
                          <p className="text-amber-400/70 text-xs mt-0.5">{beverageStarchAlert.message}</p>
                        </div>
                        <button
                          onClick={clearBeverageStarchAlert}
                          className="text-amber-500/60 hover:text-amber-300 text-xs shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <AddToMealPlanButton meal={generatedBeverage} />
                      <TranslateToggle
                        content={{
                          name: generatedBeverage.name,
                          description: generatedBeverage.description,
                          instructions: generatedBeverage.instructions,
                          ingredients: generatedBeverage.ingredients,
                        }}
                        onTranslate={(translated) => {
                          setGeneratedBeverage((prev: any) =>
                            prev
                              ? {
                                  ...prev,
                                  name: translated.name,
                                  description:
                                    translated.description || prev.description,
                                  instructions:
                                    typeof translated.instructions === "string"
                                      ? translated.instructions
                                      : prev.instructions,
                                  ingredients:
                                    translated.ingredients || prev.ingredients,
                                }
                              : prev,
                          );
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <GlassButton
                        onClick={() => {
                          const mealData = {
                            id: crypto.randomUUID(),
                            name: generatedBeverage.name,
                            description: generatedBeverage.description,
                            ingredients: generatedBeverage.ingredients || [],
                            instructions: generatedBeverage.instructions,
                            imageUrl: generatedBeverage.imageUrl,
                          };
                          localStorage.setItem(
                            "mpm_chefs_kitchen_meal",
                            JSON.stringify(mealData),
                          );
                          localStorage.setItem(
                            "mpm_chefs_kitchen_external_prepare",
                            "true",
                          );
                          localStorage.setItem("mpm_chefs_kitchen_origin", window.location.pathname);
                          setLocation("/lifestyle/chefs-kitchen");
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                      >
                        Prepare w/ Chef
                      </GlassButton>
                      <ShareRecipeButton
                        recipe={{
                          name: generatedBeverage.name,
                          description: generatedBeverage.description,
                          nutrition: generatedBeverage.nutrition,
                          ingredients: (generatedBeverage.ingredients ?? []).map(
                            (ing: any) => ({
                              name: ing.name || ing.item,
                              amount: ing.amount,
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

              {/* Spacer so bar doesn't cover last card */}
              <div className="h-20" />
            </div>
          )}
        </div>

        {/* Shopping Aggregate Bar — anchored above bottom nav, matching Chef's Kitchen pattern */}
        {generatedBeverage && generatedBeverage.ingredients?.length > 0 && (
          <ShoppingAggregateBar
            ingredients={generatedBeverage.ingredients.map((ing: any) => ({
              name: ing.name,
              qty: ing.amount,
              unit: ing.unit,
            }))}
            source="Beverage Creator"
            hideShareButton={true}
            aboveBottomNav={true}
          />
        )}

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Use Beverage Creator"
          steps={BEVERAGE_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />
      </motion.div>
    </PhaseGate>
  );
}
