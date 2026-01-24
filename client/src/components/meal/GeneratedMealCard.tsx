import { Sparkles, Users, Brain, ChefHat, CalendarPlus } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import { generateMedicalBadges, getUserMedicalProfile } from "@/utils/medicalPersonalization";
import { setQuickView } from "@/lib/macrosQuickView";
import type { MacroSourceSlug } from "@/lib/macroSourcesConfig";
import { isFeatureEnabled } from "@/lib/productionGates";

export interface GeneratedMealData {
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
  starchyCarbs?: number;
  fibrousCarbs?: number;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    starchyCarbs?: number;
    fibrousCarbs?: number;
  };
  medicalBadges?: string[];
  flags?: string[];
  servingSize?: string;
  servings?: number;
  reasoning?: string;
}

interface GeneratedMealCardProps {
  generatedMeal: GeneratedMealData;
  mealToShow: GeneratedMealData;
  servings: number;
  onRestart: () => void;
  onContentUpdate?: (updated: Partial<GeneratedMealData>) => void;
  source?: string;
  macroSource?: MacroSourceSlug;
}

export default function GeneratedMealCard({
  generatedMeal,
  mealToShow,
  servings,
  onRestart,
  onContentUpdate,
  source = "unknown",
  macroSource,
}: GeneratedMealCardProps) {
  const [, setLocation] = useLocation();
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

  const hasInstructions =
    generatedMeal.instructions &&
    (Array.isArray(generatedMeal.instructions)
      ? generatedMeal.instructions.length > 0
      : generatedMeal.instructions.length > 0);

  const handlePrepareWithChef = () => {
    if (!hasInstructions) return;

    const mealData = {
      id: generatedMeal.id || crypto.randomUUID(),
      name: generatedMeal.name,
      description: generatedMeal.description,
      mealType: generatedMeal.mealType,
      ingredients: generatedMeal.ingredients || [],
      instructions: generatedMeal.instructions,
      imageUrl: generatedMeal.imageUrl,
      calories: generatedMeal.nutrition?.calories || generatedMeal.calories,
      protein: generatedMeal.nutrition?.protein || generatedMeal.protein,
      carbs: generatedMeal.nutrition?.carbs || generatedMeal.carbs,
      fat: generatedMeal.nutrition?.fat || generatedMeal.fat,
      servings: generatedMeal.servings,
      servingSize: generatedMeal.servingSize,
      medicalBadges: generatedMeal.medicalBadges || [],
    };

    localStorage.setItem("mpm_chefs_kitchen_meal", JSON.stringify(mealData));
    localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");

    setLocation("/lifestyle/chefs-kitchen");
  };

  const handleAddToMacros = () => {
    const s = Math.max(1, Math.round(servings ?? 1));
    const protein = generatedMeal.nutrition?.protein || generatedMeal.protein || 0;
    const carbs = generatedMeal.nutrition?.carbs || generatedMeal.carbs || 0;
    const fat = generatedMeal.nutrition?.fat || generatedMeal.fat || 0;
    const starchyCarbs = generatedMeal.nutrition?.starchyCarbs || generatedMeal.starchyCarbs || 0;
    const fibrousCarbs = generatedMeal.nutrition?.fibrousCarbs || generatedMeal.fibrousCarbs || 0;
    const calories = generatedMeal.nutrition?.calories || generatedMeal.calories || (protein * 4 + carbs * 4 + fat * 9);

    setQuickView({
      protein: Math.round(protein * s),
      carbs: Math.round(carbs * s),
      starchyCarbs: Math.round(starchyCarbs * s),
      fibrousCarbs: Math.round(fibrousCarbs * s),
      fat: Math.round(fat * s),
      calories: Math.round(calories * s),
      dateISO: new Date().toISOString().slice(0, 10),
      mealSlot: null,
    });

    const url = macroSource 
      ? `/biometrics?from=${macroSource}&view=macros`
      : "/biometrics?view=macros";
    setLocation(url);
  };

  const normalizedIngredients = (generatedMeal.ingredients || []).map((ing) => ({
    name: ing.name || "",
    amount: ing.amount !== undefined ? String(ing.amount) : ing.quantity,
    unit: ing.unit,
  }));

  return (
    <div className="space-y-4">
      {/* 1. Title + Description */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-yellow-600" />
          <h3 className="text-xl font-bold text-white">
            {mealToShow.name}
          </h3>
        </div>
        <button
          onClick={onRestart}
          className="text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors"
        >
          Create New
        </button>
      </div>

      {mealToShow.description && (
        <p className="text-white/90">{mealToShow.description}</p>
      )}

      {/* 2. Image */}
      {mealToShow.imageUrl && (
        <div className="rounded-lg overflow-hidden">
          <img
            src={mealToShow.imageUrl}
            alt={mealToShow.name}
            className="w-full h-64 object-cover"
          />
        </div>
      )}

      {/* 3. Serving Size */}
      <div className="p-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-white">
          <Users className="h-4 w-4" />
          <span className="font-medium">Serving Size:</span>
          <span>
            {mealToShow.servingSize ||
              `${servings} ${servings === 1 ? "serving" : "servings"}`}
          </span>
        </div>
      </div>

      {/* 4. Macros Grid */}
      <div className="grid grid-cols-4 gap-4 text-center">
        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
          <div className="text-lg font-bold text-white">
            {mealToShow.calories || 0}
          </div>
          <div className="text-xs text-white">Calories</div>
        </div>
        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
          <div className="text-lg font-bold text-white">
            {mealToShow.protein || 0}g
          </div>
          <div className="text-xs text-white">Protein</div>
        </div>
        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
          <div className="text-lg font-bold text-white">
            {mealToShow.carbs || 0}g
          </div>
          <div className="text-xs text-white">Carbs</div>
        </div>
        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
          <div className="text-lg font-bold text-white">
            {mealToShow.fat || 0}g
          </div>
          <div className="text-xs text-white">Fat</div>
        </div>
      </div>

      {/* 5. Medical Badges */}
      {medicalBadges && medicalBadges.length > 0 && (
        <div className="flex items-center gap-3">
          <HealthBadgesPopover
            badges={medicalBadges.map((b: any) =>
              typeof b === "string"
                ? b
                : b.badge || b.id || b.condition || b.label,
            )}
          />
          <h3 className="font-semibold text-white">
            Medical Safety
          </h3>
        </div>
      )}

      {/* 6. Ingredients */}
      {generatedMeal.ingredients?.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 text-white">
            Ingredients:
          </h4>
          <ul className="text-sm text-white/80 space-y-1">
            {generatedMeal.ingredients.map((ing, i) => (
              <li key={i}>
                {ing.amount ?? ing.quantity} {ing.unit} {ing.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 7. Instructions */}
      {mealToShow.instructions && (
        <div>
          <h4 className="font-semibold mb-2 text-white">
            Instructions:
          </h4>
          <div className="text-sm text-white/80 whitespace-pre-line max-h-40 overflow-y-auto">
            {Array.isArray(mealToShow.instructions)
              ? mealToShow.instructions.join("\n")
              : mealToShow.instructions}
          </div>
        </div>
      )}

      {/* 8. Reasoning (if present) */}
      {mealToShow.reasoning && (
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
            <Brain className="h-4 w-4" />
            Why This Works For You:
          </h4>
          <p className="text-sm text-white/80">
            {mealToShow.reasoning}
          </p>
        </div>
      )}

      {/* 9. Action Buttons - Standardized 3-Row Layout */}
      <div className="space-y-2">
        {/* Row 1: Add to Macros (full width) */}
        <button
          type="button"
          onClick={handleAddToMacros}
          className="w-full px-3 py-2 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-black hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-900 text-white text-center text-sm border border-white/30 shadow-sm active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          Add to Macros
        </button>

        {/* Row 2: Add to Plan + Translate (50/50) */}
        <div className="grid grid-cols-2 gap-2">
          <AddToMealPlanButton meal={generatedMeal as any} />
          <TranslateToggle
            content={{
              name: generatedMeal.name,
              description: generatedMeal.description,
              instructions: generatedMeal.instructions,
            }}
            onTranslate={(translated) => {
              if (onContentUpdate) {
                onContentUpdate({
                  name: translated.name || generatedMeal.name,
                  description: translated.description || generatedMeal.description,
                  instructions: translated.instructions || generatedMeal.instructions,
                });
              }
            }}
          />
        </div>

        {/* Row 3: Prepare with Chef + Share (50/50) - Chef's Kitchen enabled */}
        <div className="grid grid-cols-2 gap-2">
          {isFeatureEnabled('chefsKitchen') && (
            <Button
              size="sm"
              className="flex-1 bg-lime-600 hover:bg-lime-500 text-white font-semibold shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-1.5"
              onClick={handlePrepareWithChef}
              disabled={!hasInstructions}
            >
              <ChefHat className="h-4 w-4" />
              Cook w/ Chef
            </Button>
          )}
          <ShareRecipeButton
            recipe={{
              name: generatedMeal.name,
              description: generatedMeal.description,
              nutrition: generatedMeal.nutrition,
              ingredients: normalizedIngredients,
            }}
            className={isFeatureEnabled('chefsKitchen') ? "flex-1" : "col-span-2"}
          />
        </div>
      </div>
    </div>
  );
}
