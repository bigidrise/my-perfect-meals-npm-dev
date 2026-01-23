// 🔒 DESSERT CREATOR - RESTRUCTURED (December 9, 2025)
// New 5-field structure: Category, Flavor Family, Specific Dessert, Serving Size, Dietary
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { isFeatureEnabled } from "@/lib/productionGates";
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
import { Sparkles, ArrowLeft, Users, Brain, ChefHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isAllergyRelatedError, formatAllergyAlertDescription } from "@/utils/allergyAlert";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import PhaseGate from "@/components/PhaseGate";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { useAuth } from "@/contexts/AuthContext";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";

const DESSERT_CATEGORIES = [
  { value: "surprise", label: "Surprise Me!" },
  { value: "pie", label: "Pie" },
  { value: "cake", label: "Cake" },
  { value: "cookies", label: "Cookies" },
  { value: "brownies", label: "Brownies" },
  { value: "cheesecake", label: "Cheesecake" },
  { value: "smoothie", label: "Smoothie" },
  { value: "frozen", label: "Frozen Dessert" },
  { value: "pudding", label: "Pudding / Custard" },
  { value: "nobake", label: "No-Bake Dessert" },
  { value: "bars", label: "Bars" },
  { value: "muffins", label: "Muffins" },
  { value: "cupcakes", label: "Cupcakes" },
];

const FLAVOR_FAMILIES = [
  { value: "apple", label: "Apple" },
  { value: "strawberry", label: "Strawberry" },
  { value: "blueberry", label: "Blueberry" },
  { value: "lemon-lime", label: "Lemon / Lime" },
  { value: "peach", label: "Peach" },
  { value: "cherry", label: "Cherry" },
  { value: "mango", label: "Mango" },
  { value: "chocolate", label: "Chocolate" },
  { value: "vanilla", label: "Vanilla" },
  { value: "peanut-butter", label: "Peanut Butter" },
  { value: "cinnamon-spice", label: "Cinnamon / Spice" },
  { value: "coffee", label: "Coffee" },
  { value: "caramel", label: "Caramel" },
];

const SERVING_SIZES = [
  { value: "single", label: "Single serving" },
  { value: "two", label: "Two servings" },
  { value: "family", label: "Family-style" },
  { value: "batch", label: "Batch" },
];

const WEDDING_SERVING_SIZES = [
  { value: "small-wedding", label: "Small Wedding (30–50 guests)" },
  { value: "medium-wedding", label: "Medium Wedding (75–100 guests)" },
  { value: "large-wedding", label: "Large Wedding (120–150 guests)" },
  { value: "extra-large-wedding", label: "Large Event (200+ guests)" },
];

const DIETARY_OPTIONS = [
  { value: "low-sugar", label: "Low sugar" },
  { value: "gluten-free", label: "Gluten-free" },
  { value: "dairy-free", label: "Dairy-free" },
  { value: "high-protein", label: "High protein" },
  { value: "vegan", label: "Vegan" },
  { value: "low-calorie", label: "Low calorie" },
];

const CAKE_STYLES = [
  { value: "classic", label: "Classic Frosted" },
  { value: "semi-naked", label: "Semi-Naked (Light Frosting)" },
  { value: "naked", label: "Naked Cake (Minimal Frosting)" },
];

const CAKE_SPECIALTIES = [
  { value: "wedding-cake", label: "Wedding Cake" },
  { value: "birthday-cake", label: "Birthday Cake" },
  { value: "celebration-cake", label: "Celebration Cake" },
];
const DESSERT_TOUR_STEPS: TourStep[] = [
  {
    title: "Choose Dessert Type",
    description:
      "Pick what you’re in the mood for — cakes (including celebration and wedding-style cakes), pies, cookies, brownies, frozen desserts, or Surprise Me.",
  },
  {
    title: "Choose a Flavor Direction",
    description:
      "Select a flavor family like chocolate, vanilla, fruit, or spice. You can add extra details later if you want something specific.",
  },
  {
    title: "Customize the Style (Optional)",
    description:
      "Want something special? Add notes like layered cake, naked cake, wedding-style, rustic, bakery-style, or simple and clean.",
  },
  {
    title: "Select Serving Size",
    description:
      "Choose how many people you’re serving — from single portions to family-style, batches, or larger celebration desserts.",
  },
  {
    title: "Add Dietary Preferences",
    description:
      "Optional. Choose things like lower sugar, gluten-free, dairy-free, high-protein, or vegan.",
  },
  {
    title: "Create Your Dessert",
    description:
      "Tap Create and I’ll design a dessert that satisfies the craving, fits the occasion, and still respects your nutrition goals.",
  },
];

export default function DessertCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const quickTour = useQuickTour("craving-desserts");
  // Get actual user ID from auth context for medical safety
  const { user } = useAuth();
  const userId = user?.id || "";

  const [dessertCategory, setDessertCategory] = useState("");
  const [flavorFamily, setFlavorFamily] = useState("");
  const [specificDessert, setSpecificDessert] = useState("");
  const [servingSize, setServingSize] = useState("single");
  const [dietaryPreference, setDietaryPreference] = useState("");
  const [customDietary, setCustomDietary] = useState("");
  const [cakeStyle, setCakeStyle] = useState("classic");
  const [cakeType, setCakeType] = useState("");
  const [showPerSlice, setShowPerSlice] = useState(true);
  const [generatedDessert, setGeneratedDessert] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem("mpm_dessert_creator_result");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [progress, setProgress] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Safety PIN integration
  const [safetyEnabled, setSafetyEnabled] = useState(true);
  const [pendingGeneration, setPendingGeneration] = useState(false);
  
  // SafetyGuard preflight hook
  const {
    checking: safetyChecking,
    alert: safetyAlert,
    checkSafety,
    clearAlert: clearSafetyAlert,
    setAlert: setSafetyAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride
  } = useSafetyGuardPrecheck();
  
  // Handle safety override continuation - auto-generate when override token received
  const handleSafetyOverride = (enabled: boolean, token?: string) => {
    setSafetyEnabled(enabled);
    if (token) {
      setOverrideToken(token);
      clearSafetyAlert(); // Clear banner on successful override
      setPendingGeneration(true);
    }
  };
  
  // Effect: Auto-generate when override token is set and generation is pending
  useEffect(() => {
    if (pendingGeneration && overrideToken && !isGenerating && !safetyChecking) {
      setPendingGeneration(false);
      handleGenerateDessert(overrideToken);
    }
  }, [pendingGeneration, overrideToken, isGenerating, safetyChecking]);

  useCopilotPageExplanation();

  useEffect(() => {
    document.title = "Dessert Creator | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (generatedDessert) {
      try {
        localStorage.setItem(
          "mpm_dessert_creator_result",
          JSON.stringify(generatedDessert),
        );
      } catch {}
    }
  }, [generatedDessert]);

  useEffect(() => {
    if (cakeType === "wedding-cake") {
      setServingSize("medium-wedding");
    } else if (servingSize.includes("wedding")) {
      setServingSize("single");
    }
  }, [cakeType]);

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

  async function handleGenerateDessert(overrideToken?: string) {
    if (!dessertCategory) {
      toast({
        title: "Missing Information",
        description: "Please select a dessert category.",
        variant: "destructive",
      });
      return;
    }

    if (!flavorFamily) {
      toast({
        title: "Missing Information",
        description: "Please select a flavor family.",
        variant: "destructive",
      });
      return;
    }

    // SafetyGuard preflight check if safety is enabled and no override
    if (safetyEnabled && !hasActiveOverride && !overrideToken) {
      const requestDescription = `${dessertCategory} ${flavorFamily} ${specificDessert}`.trim();
      const isSafe = await checkSafety(requestDescription, "dessert-creator");
      if (!isSafe) {
        return; // Banner will show automatically
      }
    }

    setIsGenerating(true);
    startProgressTicker();
    console.log("🍨 [DESSERT] Starting generation...", {
      dessertCategory,
      flavorFamily,
      specificDessert,
      servingSize,
      safetyEnabled,
      hasOverrideToken: !!overrideToken,
    });

    try {
      console.log("🍨 [DESSERT] Calling API...");
      const res = await fetch(apiUrl("/api/meals/dessert-creator"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dessertCategory,
          flavorFamily,
          specificDessert,
          servingSize,
          cakeStyle: dessertCategory === "cake" ? cakeStyle : undefined,
          cakeType:
            dessertCategory === "cake" && cakeType && cakeType !== "standard"
              ? cakeType
              : undefined,
          dietaryPreferences: [
            ...(dietaryPreference && dietaryPreference !== "none"
              ? [dietaryPreference]
              : []),
            ...(customDietary.trim() ? [customDietary.trim()] : []),
          ],
          userId: userId,
          safetyMode: !safetyEnabled && overrideToken ? "CUSTOM_AUTHENTICATED" : "STRICT",
          overrideToken: !safetyEnabled ? overrideToken : undefined,
        }),
      });

      console.log("🍨 [DESSERT] API response received:", res.status);
      
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        console.error("🍨 Dessert Creator API Error:", res.status, errorBody);
        
        if (errorBody?.error === "ALLERGY_SAFETY_BLOCK") {
          throw new Error(`🚨 Safety Alert: ${errorBody.message}`);
        }
        
        throw new Error(errorBody?.error || "Generation failed");
      }

      const data = await res.json();
      
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
        });
        return;
      }
      
      // Auto-reset safety to ON after generation attempt
      setSafetyEnabled(true);
      clearSafetyAlert();
      console.log("🍨 [DESSERT] Parsed response data:", data);
      const meal = data.meal || data;

      stopProgressTicker();
      setGeneratedDessert(meal);

      toast({
        title: "✨ Dessert Created!",
        description: `${meal.name} is ready for you.`,
      });
    } catch (err: any) {
      console.error("🍨 [DESSERT] Generation error:", err);
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
    <PhaseGate phase="PHASE_1_CORE" feature="dessert-creator">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
      >
        <div
          className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-2 flex-nowrap overflow-hidden">
            <button
              onClick={() => setLocation("/craving-creator-landing")}
              className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
              data-testid="dessertcreator-back"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>

            <h1 className="text-lg font-bold text-white truncate min-w-0">
              Dessert Creator
            </h1>

            <div className="flex-grow" />
            <QuickTourButton
              onClick={quickTour.openTour}
              className="flex-shrink-0"
            />
          </div>
        </div>

        <div
          className="max-w-2xl mx-auto px-4 pb-32"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
        >
          {/* Create with Chef Entry Point - Coming Soon */}
          <div className="relative mb-4">
            <div
              className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-50"
              style={{
                background:
                  "radial-gradient(120% 120% at 50% 0%, rgba(251,146,60,0.5), rgba(239,68,68,0.25), rgba(0,0,0,0))",
              }}
            />
            <Card
              className="relative cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-gradient-to-r from-black via-orange-950/40 to-black backdrop-blur-lg border border-orange-400/30 rounded-xl shadow-md overflow-hidden hover:shadow-[0_0_30px_rgba(251,146,60,0.4)] hover:border-orange-500/50"
              data-testid="dessert-studio-entry"
            >
              <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-black via-orange-600 to-black rounded-full border border-orange-400/30 shadow-lg z-10">
                <span className="text-white font-semibold text-[9px]">
                  Coming Soon
                </span>
              </div>
              <CardContent className="p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 flex-shrink-0 text-orange-500" />
                    <h3 className="text-sm font-semibold text-white">
                      Chef's Kitchen Studio
                    </h3>
                  </div>
                  <p className="text-xs text-white/80 ml-6">
                    Step-by-step guided dessert creation with Chef voice
                    assistance
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-2xl bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                Quick Create
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div>
                <label className="block text-md font-medium text-white mb-1">
                  Dessert Category <span className="text-orange-400">*</span>
                </label>
                <Select
                  value={dessertCategory}
                  onValueChange={setDessertCategory}
                >
                  <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                    <SelectValue placeholder="Select dessert type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DESSERT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {dessertCategory === "cake" && (
                <>
                  <div>
                    <label className="block text-md font-medium text-white mb-1">
                      Cake Type (optional)
                    </label>
                    <Select value={cakeType} onValueChange={setCakeType}>
                      <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                        <SelectValue placeholder="Standard cake" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        {CAKE_SPECIALTIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-md font-medium text-white mb-1">
                      Cake Style
                    </label>
                    <Select value={cakeStyle} onValueChange={setCakeStyle}>
                      <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                        <SelectValue placeholder="Select cake style" />
                      </SelectTrigger>
                      <SelectContent>
                        {CAKE_STYLES.map((style) => (
                          <SelectItem key={style.value} value={style.value}>
                            {style.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-md font-medium text-white mb-1">
                  Flavor Family <span className="text-orange-400">*</span>
                </label>
                <Select value={flavorFamily} onValueChange={setFlavorFamily}>
                  <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                    <SelectValue placeholder="Select flavor" />
                  </SelectTrigger>
                  <SelectContent>
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
                  Additional Flavor Notes (optional)
                </label>
                <input
                  value={specificDessert}
                  onChange={(e) => setSpecificDessert(e.target.value)}
                  placeholder="e.g., with cream cheese frosting, extra cinnamon..."
                  className="w-full bg-black text-white border border-white/30 px-3 py-2 rounded-lg text-sm placeholder:text-white/50"
                  maxLength={150}
                />
                <p className="text-xs text-white/60 mt-1">
                  Add specific details or leave empty
                </p>
              </div>

              <div>
                <label className="block text-md font-medium text-white mb-1">
                  Serving Size <span className="text-orange-400">*</span>
                </label>
                <Select value={servingSize} onValueChange={setServingSize}>
                  <SelectTrigger className="w-full text-sm bg-black text-white border-white/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(cakeType === "wedding-cake"
                      ? WEDDING_SERVING_SIZES
                      : SERVING_SIZES
                    ).map((size) => (
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
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {DIETARY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* SafetyGuard Preflight Banner */}
              <SafetyGuardBanner
                alert={safetyAlert}
                mealRequest={`${dessertCategory} ${flavorFamily} ${specificDessert}`.trim()}
                onDismiss={clearSafetyAlert}
                onOverrideSuccess={(token) => handleSafetyOverride(false, token)}
              />

              {/* Safety Guard Toggle */}
              <div className="mb-4 flex justify-end">
                <SafetyGuardToggle
                  safetyEnabled={safetyEnabled}
                  onSafetyChange={handleSafetyOverride}
                  disabled={isGenerating || safetyChecking}
                />
              </div>

              {(isGenerating || safetyChecking) ? (
                <div className="max-w-md mx-auto mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">
                      {safetyChecking ? "Checking Safety Profile" : "AI Analysis Progress"}
                    </span>
                    <span className="text-sm text-white/80">
                      {safetyChecking ? "..." : `${Math.round(progress)}%`}
                    </span>
                  </div>
                  <Progress
                    value={safetyChecking ? 30 : progress}
                    className="h-3 bg-black/30 border border-white/20"
                  />
                </div>
              ) : (
                <GlassButton
                  onClick={() => handleGenerateDessert()}
                  className="w-full bg-lime-600 hover:bg-lime-600 flex items-center justify-center"
                >
                  Create My Dessert
                </GlassButton>
              )}
            </CardContent>
          </Card>

          {generatedDessert && (
            <div className="space-y-6">
              <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-6 w-6 text-yellow-500" />
                      <h3 className="text-xl font-bold text-white">
                        {generatedDessert.name}
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setGeneratedDessert(null);
                        localStorage.removeItem("mpm_dessert_creator_result");
                      }}
                      className="text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors"
                    >
                      Create New
                    </button>
                  </div>

                  <p className="text-white/90 mb-4">
                    {generatedDessert.description}
                  </p>

                  {generatedDessert.imageUrl && (
                    <div className="mb-6 rounded-lg overflow-hidden">
                      <img
                        src={generatedDessert.imageUrl}
                        alt={generatedDessert.name}
                        className="w-full h-64 object-cover"
                      />
                    </div>
                  )}

                  <div className="mb-4 p-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-white">
                      <Users className="h-4 w-4 text-white" />
                      <span className="font-medium">Serving Size:</span>{" "}
                      {generatedDessert.servingSize}
                      {generatedDessert.totalSlices && (
                        <span className="text-white/70">
                          ({generatedDessert.totalSlices} slices)
                        </span>
                      )}
                    </div>
                  </div>

                  {generatedDessert.perSliceNutrition && (
                    <div className="mb-4 flex items-center justify-center gap-2">
                      <button
                        onClick={() => setShowPerSlice(true)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          showPerSlice
                            ? "bg-orange-600 text-white"
                            : "bg-white/10 text-white/70 hover:bg-white/20"
                        }`}
                      >
                        Per Slice
                      </button>
                      <button
                        onClick={() => setShowPerSlice(false)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          !showPerSlice
                            ? "bg-orange-600 text-white"
                            : "bg-white/10 text-white/70 hover:bg-white/20"
                        }`}
                      >
                        Whole Cake
                      </button>
                    </div>
                  )}

                  {generatedDessert.perSliceNutrition && showPerSlice && (
                    <p className="text-xs text-center text-white/60 mb-2">
                      Per slice (
                      {generatedDessert.perSliceNutrition.sliceSize || "1 oz"})
                    </p>
                  )}

                  <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                    {(["calories", "protein", "carbs", "fat"] as const).map(
                      (key) => {
                        const nutritionSource =
                          generatedDessert.perSliceNutrition && showPerSlice
                            ? generatedDessert.perSliceNutrition
                            : getNutrition(generatedDessert);
                        const value = Number(nutritionSource[key] ?? 0);
                        return (
                          <div
                            key={key}
                            className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md"
                          >
                            <div className="text-lg font-bold text-white">
                              {value}
                              {key !== "calories" && "g"}
                            </div>
                            <div className="text-xs text-white capitalize">
                              {key}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <HealthBadgesPopover
                          badges={generatedDessert.medicalBadges || []}
                          align="start"
                        />
                        <h3 className="font-semibold text-white">
                          Medical Safety
                        </h3>
                      </div>
                    </div>
                  </div>

                  {generatedDessert.ingredients?.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2 text-white">
                        Ingredients:
                      </h4>
                      <ul className="text-sm text-white/80 space-y-1">
                        {generatedDessert.ingredients.map(
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

                  {generatedDessert.instructions && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2 text-white">
                        Instructions:
                      </h4>
                      <div className="text-sm text-white/80 whitespace-pre-line max-h-40 overflow-y-auto">
                        {generatedDessert.instructions}
                      </div>
                    </div>
                  )}

                  {generatedDessert.reasoning && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                        <Brain className="h-4 w-4" />
                        Why This Works For You:
                      </h4>
                      <p className="text-sm text-white/80">
                        {generatedDessert.reasoning}
                      </p>
                    </div>
                  )}

                  {/* Standardized 3-Row Button Layout */}
                  <div className="space-y-2">
                    {/* Row 1: Add to Macros (full width) */}
                    <GlassButton
                      onClick={() => {
                        setLocation(
                          "/biometrics?from=dessert-creator&view=macros",
                        );
                      }}
                      className="w-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-black hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-900 text-white flex items-center justify-center text-center border border-white/30"
                    >
                      Add to Macros
                    </GlassButton>

                    {/* Row 2: Add to Plan + Translate (50/50) */}
                    <div className="grid grid-cols-2 gap-2">
                      <AddToMealPlanButton meal={generatedDessert} />
                      <TranslateToggle
                        content={{
                          name: generatedDessert.name,
                          description: generatedDessert.description,
                          instructions: generatedDessert.instructions,
                        }}
                        onTranslate={() => {}}
                      />
                    </div>

                    {/* Row 3: Prepare with Chef + Share (50/50) */}
                    <div className="grid grid-cols-2 gap-2">
                      <GlassButton
                        onClick={() => {
                          const mealData = {
                            id: crypto.randomUUID(),
                            name: generatedDessert.name,
                            description: generatedDessert.description,
                            ingredients: generatedDessert.ingredients || [],
                            instructions: generatedDessert.instructions,
                            imageUrl: generatedDessert.imageUrl,
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
                        className="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                      >
                        Cook w/ Chef
                      </GlassButton>
                      <ShareRecipeButton
                        recipe={{
                          name: generatedDessert.name,
                          description: generatedDessert.description,
                          nutrition: generatedDessert.nutrition,
                          ingredients: (generatedDessert.ingredients ?? []).map(
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

              <ShoppingAggregateBar
                ingredients={generatedDessert.ingredients.map((ing: any) => ({
                  name: ing.name,
                  qty: ing.amount,
                  unit: ing.unit,
                }))}
                source="Dessert Creator"
                hideShareButton={true}
              />
            </div>
          )}
        </div>

        <QuickTourModal
          isOpen={quickTour.shouldShow}
          onClose={quickTour.closeTour}
          title="How to Use Dessert Creator"
          steps={DESSERT_TOUR_STEPS}
          onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
        />

      </motion.div>
    </PhaseGate>
  );
}
