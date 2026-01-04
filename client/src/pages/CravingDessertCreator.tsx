// 🔒 DESSERT CREATOR - RESTRUCTURED (December 9, 2025)
// New 5-field structure: Category, Flavor Family, Specific Dessert, Serving Size, Dietary

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
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
import { Sparkles, ArrowLeft, Users, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import PhaseGate from "@/components/PhaseGate";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import CopyRecipeButton from "@/components/CopyRecipeButton";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

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
      "Select the type of dessert you want — cake, pie, cookies, brownies, frozen treats, or Surprise Me.",
  },
  {
    title: "Add Flavor or Inspiration",
    description:
      "Optional. Describe what you’re craving in your own words, or leave it blank and let the AI decide.",
  },
  {
    title: "Select Serving Size",
    description:
      "Choose how many servings you want so portions stay realistic and balanced.",
  },
  {
    title: "Add Dietary Requirements",
    description:
      "Optional. Choose any dietary needs like low sugar, gluten-free, or high protein.",
  },
  {
    title: "Create Your Dessert",
    description:
      "Tap Create to generate a healthier dessert that fits your craving and your lifestyle.",
  },
];

export default function DessertCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const quickTour = useQuickTour("craving-desserts");

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

  async function handleGenerateDessert() {
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

    setIsGenerating(true);
    startProgressTicker();
    console.log("🍨 [DESSERT] Starting generation...", { dessertCategory, flavorFamily, specificDessert, servingSize });

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
          cakeType: dessertCategory === "cake" && cakeType && cakeType !== "standard" ? cakeType : undefined,
          dietaryPreferences: [
            ...(dietaryPreference && dietaryPreference !== "none"
              ? [dietaryPreference]
              : []),
            ...(customDietary.trim() ? [customDietary.trim()] : []),
          ],
          userId: DEV_USER_ID,
        }),
      });

      console.log("🍨 [DESSERT] API response received:", res.status);
      
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        console.error("🍨 Dessert Creator API Error:", res.status, errorBody);
        throw new Error(errorBody?.error || "Generation failed");
      }

      const data = await res.json();
      console.log("🍨 [DESSERT] Parsed response data:", data);
      const meal = data.meal || data;

      stopProgressTicker();
      setGeneratedDessert(meal);

      toast({
        title: "✨ Dessert Created!",
        description: `${meal.name} is ready for you.`,
      });
    } catch (err) {
      console.error("🍨 [DESSERT] Generation error:", err);
      stopProgressTicker();
      toast({
        title: "Generation Failed",
        description: "Please try again.",
        variant: "destructive",
      });
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
          <Card className="shadow-2xl bg-black/30 backdrop-blur-lg border border-white/20 w-full max-w-xl mx-auto mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                Create Your Dessert
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
                </div>
              ) : (
                <GlassButton
                  onClick={handleGenerateDessert}
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
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                    {(["calories", "protein", "carbs", "fat"] as const).map(
                      (key) => (
                        <div
                          key={key}
                          className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md"
                        >
                          <div className="text-lg font-bold text-white">
                            {getNutrition(generatedDessert)[key]}
                            {key !== "calories" && "g"}
                          </div>
                          <div className="text-xs text-white capitalize">
                            {key}
                          </div>
                        </div>
                      ),
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
                    <div className="flex gap-2 mb-4">
                      <AddToMealPlanButton meal={generatedDessert} />
                      <CopyRecipeButton
                        recipe={{
                          name: generatedDessert.name,
                          ingredients: (generatedDessert.ingredients ?? []).map(
                            (ing: any) => ({
                              name: ing.name || ing.item,
                              amount: ing.amount,
                              unit: ing.unit,
                            }),
                          ),
                          instructions: Array.isArray(
                            generatedDessert.instructions,
                          )
                            ? generatedDessert.instructions
                            : generatedDessert.instructions
                              ? generatedDessert.instructions
                                  .split("\n")
                                  .filter((s: string) => s.trim())
                              : [],
                        }}
                      />
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

                  <GlassButton
                    onClick={() => {
                      setLocation(
                        "/biometrics?from=dessert-creator&view=macros",
                      );
                    }}
                    className="w-full bg-black hover:bg-black/80 text-white"
                  >
                    Add Your Macros
                  </GlassButton>
                </CardContent>
              </Card>

              <ShoppingAggregateBar
                ingredients={generatedDessert.ingredients.map((ing: any) => ({
                  name: ing.name,
                  qty: ing.amount,
                  unit: ing.unit,
                }))}
                source="Dessert Creator"
                hideCopyButton={true}
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
