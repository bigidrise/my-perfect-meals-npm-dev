/**
 * 🔒 LOCKED COMPONENT - DO NOT MODIFY UI STRUCTURE
 *
 * This file is PROTECTED under the Meal Picker Lockdown Protocol (November 24, 2025)
 * See LOCKDOWN.md for complete guidelines before making ANY changes.
 *
 * ❌ PROHIBITED CHANGES:
 * - Adding new UI sections (banners, displays, input fields)
 * - Modifying modal layout or structure
 * - Changing ingredient grid rendering
 * - Adding extra state or complexity
 *
 * ✅ ALLOWED (with approval):
 * - Bug fixes that don't alter UI structure
 * - Performance optimizations
 * - Backend API updates
 *
 * REASON FOR LOCK: Recent UI additions (Beach Body banner, selected ingredients
 * display, custom ingredients input) caused modal crowding and broke the category
 * tabs/ingredient grid. Structure must remain stable.
 *
 * LAST LOCKED: November 24, 2025
 * LOCKED BY: User explicit request
 */

import { useState, useRef, useEffect } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import PreparationModal, {
  normalizeIngredientName,
} from "@/components/PreparationModal";
import { SNACK_CATEGORIES } from "@/data/snackIngredients";
import { DIABETIC_SNACK_CATEGORIES } from "@/data/diabeticPremadeSnacks";
import { mealIngredients } from "@/data/mealIngredients";
import competitionIngredients from "@/data/competitionIngredients";
import { useMacroTargeting } from "@/hooks/useMacroTargeting";
import { MacroTargetingControls } from "@/components/macro-targeting/MacroTargetingControls";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";

interface AIMealCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMealGenerated: (meal: any, slot: "breakfast" | "lunch" | "dinner" | "snacks") => void;
  mealSlot: "breakfast" | "lunch" | "dinner" | "snacks";
  showMacroTargeting?: boolean;
  dietType?: "weekly" | "diabetic" | "competition";
  beachBodyMode?: boolean;
}

export default function AIMealCreatorModal({
  open,
  onOpenChange,
  onMealGenerated,
  mealSlot,
  showMacroTargeting = false,
  dietType = "weekly",
  beachBodyMode = false,
}: AIMealCreatorModalProps) {
  const { user } = useAuth();
  const userId = user?.id?.toString() || "";
  
  const ACTIVE_SNACK_CATEGORIES =
    dietType === "diabetic" && mealSlot === "snacks"
      ? DIABETIC_SNACK_CATEGORIES
      : SNACK_CATEGORIES;

  const activeMealIngredients =
    dietType === "competition" ? competitionIngredients : mealIngredients;

  const [activeCategory, setActiveCategory] = useState<string>("proteins");
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [prepModalOpen, setPrepModalOpen] = useState(false);
  const [currentIngredient, setCurrentIngredient] = useState("");
  const [pendingIngredients, setPendingIngredients] = useState<string[]>([]);
  const [cookingStyles, setCookingStyles] = useState<Record<string, string>>(
    {},
  );
  const [needsPrepQueue, setNeedsPrepQueue] = useState<string[]>([]);
  const [currentPrepIndex, setCurrentPrepIndex] = useState(0);
  const tickerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Macro targeting for trainer features
  const macroTargetingState = useMacroTargeting(
    "macroTargets::trainer::aiMealCreator",
  );
  
  // 🔐 SafetyGuard preflight system
  const [pendingGeneration, setPendingGeneration] = useState(false);
  const {
    checking: safetyChecking,
    alert: safetyAlert,
    checkSafety,
    clearAlert: clearSafetyAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride,
  } = useSafetyGuardPrecheck();
  
  const handleSafetyOverride = (token: string) => {
    setOverrideToken(token);
    setPendingGeneration(true);
  };
  
  // Effect: Auto-generate when override token is set and generation is pending
  useEffect(() => {
    if (pendingGeneration && overrideToken && !generating && !safetyChecking) {
      setPendingGeneration(false);
      generateMeal(selectedIngredients, cookingStyles, true);
    }
  }, [pendingGeneration, overrideToken, generating, safetyChecking]);

  // List of ingredients that need cooking style selection (matching MealPremadePicker)
  const NEEDS_PREP = [
    "Eggs",
    "Egg Whites",
    "Whole Eggs",
    "Steak",
    "Ribeye",
    "Ribeye Steak",
    "Sirloin Steak",
    "Top Sirloin",
    "Filet Mignon",
    "New York Strip",
    "NY Strip",
    "Strip Steak",
    "Porterhouse",
    "Porterhouse Steak",
    "T-Bone",
    "T-Bone Steak",
    "TBone Steak",
    "Skirt Steak",
    "Flank Steak",
    "Flat Iron Steak",
    "Tri-Tip",
    "Tri-Tip Steak",
    "Hanger Steak",
    "Kobe Steak",
    "Kobe Beef",
    "Wagyu Steak",
    "Wagyu Beef",
    "Chicken",
    "Chicken Breast",
    "Chicken Thighs",
    "Chicken Sausage",
    "Ground Chicken",
    "Turkey",
    "Turkey Breast",
    "Ground Turkey",
    "Turkey Sausage",
    "Salmon",
    "Tilapia",
    "Cod",
    "Tuna",
    "Tuna Steak",
    "Halibut",
    "Mahi Mahi",
    "Trout",
    "Sardines",
    "Anchovies",
    "Catfish",
    "Sea Bass",
    "Red Snapper",
    "Flounder",
    "Orange Roughy",
    "Sole",
    "Potatoes",
    "Red Potatoes",
    "Sweet Potatoes",
    "Yams",
    "Rice",
    "White Rice",
    "Brown Rice",
    "Jasmine Rice",
    "Basmati Rice",
    "Wild Rice",
    "Broccoli",
    "Asparagus",
    "Green Beans",
    "Mixed Vegetables",
    "Cauliflower",
    "Brussels Sprouts",
    "Kale",
    "Spinach",
    "Carrots",
    "Celery",
    "Cucumber",
    "Lettuce",
    "Romaine Lettuce",
    "Spring Mix",
  ];

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

  const cleanupGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }

    setGenerating(false);
    setProgress(0);
    setPendingIngredients([]);
    setCookingStyles({});
  };

  useEffect(() => {
    return () => {
      cleanupGeneration();
    };
  }, []);

  const toggleIngredient = (ingredientName: string) => {
    const isSelected = selectedIngredients.some(
      (i) => i.toLowerCase() === ingredientName.toLowerCase(),
    );

    if (isSelected) {
      // Remove from selected
      setSelectedIngredients((prev) =>
        prev.filter((i) => i.toLowerCase() !== ingredientName.toLowerCase()),
      );
      // Also remove its cooking style if it had one
      setCookingStyles((prev) => {
        const updated = { ...prev };
        delete updated[ingredientName];
        return updated;
      });
    } else {
      // Check if this ingredient needs prep
      const normalizedIng = normalizeIngredientName(ingredientName);
      const needsPrep = NEEDS_PREP.some(
        (prep) => normalizeIngredientName(prep) === normalizedIng,
      );

      if (needsPrep) {
        // Show prep modal IMMEDIATELY
        setCurrentIngredient(ingredientName);
        setPrepModalOpen(true);
      } else {
        // No prep needed, just add to selected list
        setSelectedIngredients((prev) => [...prev, ingredientName]);
      }
    }
  };

  const handleGenerateMeal = async () => {
    if (selectedIngredients.length === 0) {
      toast({
        title: "No ingredients selected",
        description: "Please select at least one ingredient",
        variant: "destructive",
      });
      return;
    }

    // 🔐 Preflight safety check - BEFORE starting progress bar
    if (!hasActiveOverride) {
      const inputForSafetyCheck = selectedIngredients.join(" ");
      const isSafe = await checkSafety(inputForSafetyCheck, "ai-meal-creator");
      if (!isSafe) {
        // Banner will show automatically via safetyAlert state
        return;
      }
    }

    // All prep should already be done (happened when clicking ingredients)
    // Just generate the meal with selected ingredients and their styles
    generateMeal(selectedIngredients, cookingStyles, false);
  };

  const handlePrepSelect = (ingredient: string, style: string) => {
    // Save the cooking style
    setCookingStyles((prev) => ({ ...prev, [ingredient]: style }));

    // Add ingredient to selected list
    setSelectedIngredients((prev) => [...prev, ingredient]);

    // Close prep modal - user can continue selecting more ingredients
    setPrepModalOpen(false);
    setCurrentIngredient("");
  };

  const generateMeal = async (
    ingredients: string[],
    styles: Record<string, string>,
    skipPreflight = false,
  ) => {
    setGenerating(true);
    startProgressTicker();

    abortControllerRef.current = new AbortController();

    try {
      // Apply cooking styles to ingredients that have them
      const ingredientsWithStyles = ingredients.map((ing) => {
        const style = styles[ing];
        return style ? `${style} ${ing}` : ing;
      });

      // Beach Body Mode: Fixed guardrails for lean-out meals
      // 35g protein (macronutrient) | 25g starchy carbs (macronutrient) | 150g fibrous carbs (macronutrient)
      const beachBodyGuardrails = beachBodyMode
        ? {
            protein_g: 35,
            starchy_carbs_g: 25,
            fibrous_carbs_g: 150,
          }
        : null;

      // Get custom macro targets if enabled (ignored if Beach Body mode)
      const customMacroTargets = beachBodyMode
        ? beachBodyGuardrails
        : macroTargetingState.serializeForRequest();

      // Use unified meal generation endpoint - SAME as Fridge Rescue
      const response = await fetch(apiUrl("/api/meals/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "fridge-rescue",
          mealType: mealSlot,
          input: ingredientsWithStyles,
          userId,
          ...(customMacroTargets && { macroTargets: customMacroTargets }),
          count: 1,
          safetyMode: hasActiveOverride ? "CUSTOM_AUTHENTICATED" : "STRICT",
          overrideToken: hasActiveOverride ? overrideToken : undefined,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to generate meal");
      }

      const data = await response.json();
      console.log("🍳 AI Meal Creator received data:", data);

      // Unified pipeline returns { success, meals, source } - use meals[0] like Fridge Rescue
      if (!data.success || !data.meals?.[0]) {
        console.error("❌ Invalid data structure:", data);
        throw new Error(data.error || "No meal returned from AI generator");
      }

      const meal = data.meals[0];

      // Unified pipeline guarantees imageUrl, but add fallback just in case
      if (!meal.imageUrl) {
        meal.imageUrl = `/images/cravings/satisfy-cravings.jpg`;
      }
      if (!meal.id) {
        meal.id = `ai-meal-${Date.now()}`;
      }

      console.log("✅ Generated meal:", meal.name);
      stopProgressTicker();

      onMealGenerated(meal, mealSlot);

      toast({
        title: "Meal Created!",
        description: `${meal.name} has been added`,
      });

      // Clean up and close
      cleanupGeneration();
      setSelectedIngredients([]);
      setSearchQuery("");
      onOpenChange(false);
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Meal generation cancelled by user");
        return;
      }

      console.error("Error generating meal:", error);
      stopProgressTicker();
      toast({
        title: "Error",
        description: "Failed to generate meal. Please try again.",
        variant: "destructive",
      });

      cleanupGeneration();
    }
  };

  const handleCancel = () => {
    cleanupGeneration();
    setSelectedIngredients([]);
    setSearchQuery("");
    onOpenChange(false);
  };

  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      cleanupGeneration();
      setSelectedIngredients([]);
      setSearchQuery("");
      onOpenChange(false);
    }
  };

  // Get ingredients for current category
  const categoryIngredients =
    mealSlot !== "snacks"
      ? activeMealIngredients[
          activeCategory as keyof typeof activeMealIngredients
        ] || []
      : [];

  const filteredIngredients = searchQuery.trim()
    ? categoryIngredients.filter((item: any) => {
        const itemName = typeof item === "string" ? item : item.name;
        return itemName.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : categoryIngredients;

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[90vh] max-h-[90vh] bg-gradient-to-br from-zinc-900 via-zinc-800 to-black border border-white/20 rounded-2xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold">
            Create with AI Picker
          </DialogTitle>
        </DialogHeader>

        <div className="text-center mb-4">
          <p className="text-white/90 text-sm">
            Select ingredients and we'll create a delicious{" "}
            <span className="font-semibold text-white">{mealSlot}</span> recipe
            for you!
          </p>
        </div>

        {/* Macro Targeting Controls - Trainer Features Only */}
        {showMacroTargeting && (
          <MacroTargetingControls state={macroTargetingState} />
        )}

        {/* Category Tabs - Purple Style (Matching MealPremadePicker) */}
        {!generating && mealSlot !== "snacks" && (
          <div className="flex flex-nowrap gap-2 mb-3 overflow-x-auto w-full min-w-0 pb-2 overscroll-x-contain touch-pan-x">
            {Object.keys(activeMealIngredients).map((category) => {
              const displayName =
                category === "proteins"
                  ? "Proteins"
                  : category === "starchyCarbs"
                    ? "Starchy Carbs"
                    : category === "fibrousCarbs"
                      ? "Fibrous Carbs"
                      : category === "fats"
                        ? "Fats"
                        : category === "fruits"
                          ? "Fruits"
                          : category;
              const dataWtAttr =
                category === "proteins"
                  ? "wmb-protein-category-tab"
                  : category === "starchyCarbs"
                    ? "wmb-starchy-carbs-category-tab"
                    : category === "fibrousCarbs"
                      ? "wmb-fibrous-carbs-category-tab"
                      : category === "fats"
                        ? "wmb-fats-category-tab"
                        : category === "fruits"
                          ? "wmb-fruits-category-tab"
                          : undefined;
              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-2xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    activeCategory === category
                      ? "bg-purple-600/40 border-2 border-purple-400 text-white shadow-md"
                      : "bg-black/40 border border-white/20 text-white/70 hover:bg-white/10"
                  }`}
                  data-wt={dataWtAttr}
                >
                  {displayName}
                </button>
              );
            })}
          </div>
        )}

        {/* Snack Category Suggestions */}
        {mealSlot === "snacks" && !generating && (
          <div className="flex flex-wrap gap-2 mb-3">
            {ACTIVE_SNACK_CATEGORIES.map((category) => (
              <button
                key={category.name}
                type="button"
                onClick={() => {
                  const categoryItems = category.items.slice(0, 5);
                  setSelectedIngredients((prev) => [
                    ...new Set([...prev, ...categoryItems]),
                  ]);
                }}
                className="px-3 py-1 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-400/30 rounded-lg text-xs text-white/90 transition-colors"
              >
                {category.emoji} {category.name}
              </button>
            ))}
          </div>
        )}

        {/* Search Input */}
        <div className="mb-3">
          <Input
            placeholder="Search ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black/40 text-white border-white/20 placeholder:text-white/50"
            data-wt="wmb-ingredient-search"
          />
        </div>

        {/* Ingredient Toggle Buttons - OrangeGlow Toggle Pattern */}
        {!generating && mealSlot !== "snacks" && (
          <div className="overflow-y-auto flex-1 mb-3 min-h-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filteredIngredients.map((item: any) => {
                const itemName = typeof item === "string" ? item : item.name;
                const isSelected = selectedIngredients.includes(itemName);
                const dataWtAttr =
                  activeCategory === "proteins"
                    ? "wmb-protein-item"
                    : activeCategory === "starchyCarbs"
                      ? "wmb-starchy-item"
                      : activeCategory === "fibrousCarbs"
                        ? "wmb-fibrous-item"
                        : undefined;
                return (
                  <button
                    key={itemName}
                    type="button"
                    onClick={() => toggleIngredient(itemName)}
                    aria-pressed={isSelected}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px] ${
                      isSelected
                        ? "bg-gradient-to-r from-lime-500 to-lime-600  text-white"
                        : "bg-black/60 border border-white/20 text-white hover:bg-white/10"
                    }`}
                    data-wt={dataWtAttr}
                  >
                    {itemName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SafetyGuard Preflight Banner */}
        <SafetyGuardBanner
          alert={safetyAlert}
          mealRequest={selectedIngredients.join(" ")}
          onDismiss={clearSafetyAlert}
          onOverrideSuccess={handleSafetyOverride}
          className="mb-3"
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mb-3">
          <Button
            onClick={handleGenerateMeal}
            disabled={generating || safetyChecking || selectedIngredients.length === 0}
            className="flex-1 bg-lime-600 hover:bg-lime-700 text-white border-0"
            data-wt="wmb-generate-meal-button"
          >
            {safetyChecking ? "Checking Safety..." : "Generate AI Meal"}
          </Button>
          <Button
            onClick={handleCancel}
            variant="outline"
            className="bg-black/40 border-white/20 text-white hover:bg-white/10"
            disabled={generating}
          >
            Cancel
          </Button>
        </div>

        {/* Progress Bar */}
        {generating && (
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
      </DialogContent>

      {/* Preparation Style Modal */}
      <PreparationModal
        open={prepModalOpen}
        ingredientName={currentIngredient}
        onClose={() => setPrepModalOpen(false)}
        onSelect={handlePrepSelect}
      />
    </Dialog>
  );
}
