import { useState } from "react";
import { useLocation } from "wouter";
import { ChefHat } from "lucide-react";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";

interface MealData {
  id?: string;
  name: string;
  description?: string;
  mealType?: string;
  instructions?: string[] | string;
  notes?: string;
  ingredients?: Array<{ name: string; amount?: string | number; unit?: string } | string>;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  imageUrl?: string | null;
  servings?: number;
  servingSize?: string;
  medicalBadges?: string[];
}

interface MealCardActionsProps {
  meal: MealData;
  onContentUpdate?: (updated: Partial<MealData>) => void;
  showTranslate?: boolean;
  className?: string;
}

export default function MealCardActions({ 
  meal, 
  onContentUpdate,
  showTranslate = true,
  className 
}: MealCardActionsProps) {
  const [, setLocation] = useLocation();
  const [displayContent, setDisplayContent] = useState<Partial<MealData>>({});

  const hasInstructions = meal.instructions && 
    (Array.isArray(meal.instructions) ? meal.instructions.length > 0 : meal.instructions.length > 0);

  const currentName = displayContent.name || meal.name;
  const currentDescription = displayContent.description || meal.description;

  const handleTranslate = (translated: { name: string; description?: string; instructions?: string[] | string; notes?: string }) => {
    setDisplayContent(translated);
    if (onContentUpdate) {
      onContentUpdate(translated);
    }
  };

  const normalizedIngredients = (meal.ingredients || []).map(ing => {
    if (typeof ing === "string") {
      return { name: ing };
    }
    return { 
      name: ing.name || "", 
      amount: ing.amount !== undefined ? String(ing.amount) : undefined, 
      unit: ing.unit 
    };
  });

  return (
    <div className={`flex flex-col gap-2 ${className || ""}`}>
      <div className="flex gap-2">
        <ShareRecipeButton
          recipe={{
            name: currentName,
            description: currentDescription,
            nutrition: meal.nutrition,
            ingredients: normalizedIngredients,
          }}
          className="flex-1"
        />
        {showTranslate && (
          <TranslateToggle
            content={{
              name: meal.name,
              description: meal.description,
              instructions: meal.instructions,
              notes: meal.notes,
            }}
            onTranslate={handleTranslate}
          />
        )}
      </div>
      {hasInstructions && (
        <button
          onClick={() => {
            const mealForKitchen = {
              id: meal.id || crypto.randomUUID(),
              name: meal.name,
              description: meal.description,
              mealType: meal.mealType,
              ingredients: meal.ingredients || [],
              instructions: meal.instructions,
              imageUrl: meal.imageUrl,
              calories: meal.nutrition?.calories || meal.calories,
              protein: meal.nutrition?.protein || meal.protein,
              carbs: meal.nutrition?.carbs || meal.carbs,
              fat: meal.nutrition?.fat || meal.fat,
              servings: meal.servings,
              servingSize: meal.servingSize,
              medicalBadges: meal.medicalBadges || [],
            };
            localStorage.setItem("mpm_chefs_kitchen_meal", JSON.stringify(mealForKitchen));
            localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");
            localStorage.removeItem("mpm_chefs_kitchen_prep");
            setLocation("/lifestyle/chefs-kitchen");
          }}
          className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm transition flex items-center justify-center gap-2"
        >
          <ChefHat className="h-4 w-4" />
          Prepare This Meal
        </button>
      )}
    </div>
  );
}
