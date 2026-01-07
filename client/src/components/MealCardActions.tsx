import { useState } from "react";
import ShareRecipeButton from "@/components/ShareRecipeButton";
import TranslateToggle from "@/components/TranslateToggle";

interface MealData {
  name: string;
  description?: string;
  instructions?: string[] | string;
  notes?: string;
  ingredients?: Array<{ name: string; amount?: string; unit?: string } | string>;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
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
  const [displayContent, setDisplayContent] = useState<Partial<MealData>>({});

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
      amount: ing.amount, 
      unit: ing.unit 
    };
  });

  return (
    <div className={`flex gap-2 ${className || ""}`}>
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
  );
}
