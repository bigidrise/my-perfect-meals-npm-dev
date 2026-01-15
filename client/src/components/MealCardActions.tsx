import { useState } from "react";
import { useLocation } from "wouter";
import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  showPrepareButton?: boolean;
  source?: string;
  className?: string;
}

export default function MealCardActions({ 
  meal, 
  onContentUpdate,
  showTranslate = true,
  showPrepareButton = true,
  source = "unknown",
  className 
}: MealCardActionsProps) {
  const [, setLocation] = useLocation();
  const [displayContent, setDisplayContent] = useState<Partial<MealData>>({});
  
  const hasInstructions = meal.instructions && 
    (Array.isArray(meal.instructions) ? meal.instructions.length > 0 : meal.instructions.length > 0);
  
  const handlePrepareWithChef = () => {
    if (!hasInstructions) return;
    
    const mealData = {
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
    
    // Check if already on Chef's Kitchen page
    const isOnChefsKitchen = window.location.pathname.includes("/lifestyle/chefs-kitchen");
    
    if (isOnChefsKitchen) {
      // Already on page - dispatch event to switch to prepare mode directly
      window.dispatchEvent(new CustomEvent("chefs-kitchen-prepare", { detail: mealData }));
    } else {
      // Store meal FIRST, then set flag, then navigate
      // This ensures Chef's Kitchen reads the data reliably on mount
      localStorage.setItem("mpm_chefs_kitchen_meal", JSON.stringify(mealData));
      localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");
      // Clear any stale prep state
      localStorage.removeItem("mpm_chefs_kitchen_prep");
      setLocation("/lifestyle/chefs-kitchen");
    }
  };

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
      {showPrepareButton && hasInstructions && (
        <Button
          size="sm"
          className="w-full bg-lime-600 hover:bg-lime-500 text-black font-semibold shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-1.5"
          onClick={handlePrepareWithChef}
        >
          <ChefHat className="h-4 w-4" />
          Prepare with Chef
        </Button>
      )}
    </div>
  );
}
