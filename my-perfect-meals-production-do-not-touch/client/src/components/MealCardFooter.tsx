import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, RotateCcw, Plus, Loader2, Undo2 } from "lucide-react";
import type { MealTemplateBase } from "@/data/models";
import ReplacePicker from "./ReplacePicker";
import { buildMacroLogEntryFromMeal } from "@/utils/macros";

interface MealCardFooterProps {
  meal: MealTemplateBase;
  servings: number;
  onReplace: (newMeal: MealTemplateBase) => void;
  onLog?: () => Promise<void>;
  source: "template" | "preset" | "craving" | "fridge" | "kids";
  disabled?: boolean;
}

export default function MealCardFooter({
  meal,
  servings,
  onReplace,
  onLog,
  source,
  disabled = false
}: MealCardFooterProps) {
  const [isReplacePickerOpen, setIsReplacePickerOpen] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [lastReplacedMeal, setLastReplacedMeal] = useState<MealTemplateBase | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const { toast } = useToast();

  const handleLogToMacros = async () => {
    if (!meal.nutritionPerServing || isLogging) return;
    
    setIsLogging(true);
    try {
      if (onLog) {
        await onLog();
      } else {
        // Default logging behavior - POST to database API
        const logEntry = {
          timestamp: new Date().toISOString(),
          mealType: meal.mealType || "snack",
          calories: Math.round(meal.nutritionPerServing.calories * servings),
          protein: Math.round(meal.nutritionPerServing.protein * servings),
          carbs: Math.round(meal.nutritionPerServing.carbs * servings),
          fat: Math.round(meal.nutritionPerServing.fat * servings),
          source: source === "template" ? "plan" : source,
          mealId: meal.id,
        };
        
        // POST to the correct API endpoint
        const { post } = await import("@/lib/api");
        const result = await post("/api/food-logs", logEntry);
        console.log("✅ Meal logged successfully:", result);
        
        // Emit the macros:updated event for dashboard refresh
        window.dispatchEvent(new CustomEvent('macros:updated', { 
          detail: logEntry 
        }));
      }
      
      toast({
        title: "Logged to Macros!",
        description: `${meal.name} (${servings} serving${servings !== 1 ? 's' : ''}) added to your daily tracking.`,
        variant: "default",
      });
    } catch (error) {
      console.error("❌ Failed to log meal:", error);
      toast({
        title: "Logging Failed",
        description: "Could not add meal to macro tracking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLogging(false);
    }
  };

  const handleReplace = (newMeal: MealTemplateBase) => {
    setLastReplacedMeal(meal);
    onReplace(newMeal);
    setShowUndo(true);
    
    toast({
      title: "Meal Replaced!",
      description: `Replaced with ${newMeal.name}`,
      variant: "default",
    });

    // Auto-hide undo after 10 seconds
    setTimeout(() => setShowUndo(false), 10000);
  };

  const handleUndo = () => {
    if (lastReplacedMeal) {
      onReplace(lastReplacedMeal);
      setLastReplacedMeal(null);
      setShowUndo(false);
      
      toast({
        title: "Undo Complete",
        description: `Restored ${lastReplacedMeal.name}`,
        variant: "default",
      });
    }
  };

  const handleAddFromCravingCreator = () => {
    // Phase 2: Link to craving presets with return context
    const returnUrl = encodeURIComponent(window.location.pathname);
    window.location.href = `/craving-presets?return=${returnUrl}&context=add`;
  };

  const scaledNutrition = meal.nutritionPerServing ? {
    calories: Math.round(meal.nutritionPerServing.calories * servings),
    protein: Math.round(meal.nutritionPerServing.protein * servings),
    carbs: Math.round(meal.nutritionPerServing.carbs * servings),
    fat: Math.round(meal.nutritionPerServing.fat * servings)
  } : null;

  const hasNutrition = !!scaledNutrition;

  return (
    <>
      <div className="space-y-3">
        {/* Undo Banner */}
        {showUndo && lastReplacedMeal && (
          <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-2 flex items-center justify-between">
            <span className="text-white text-sm">
              Meal replaced. 
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleUndo}
              className="bg-orange-500/20 border-orange-500/50 text-white hover:bg-orange-500/30 text-xs"
            >
              <Undo2 className="h-3 w-3 mr-1" />
              Undo
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 overflow-hidden">
          {/* Log to Macros */}
          <Button
            size="sm"
            onClick={handleLogToMacros}
            disabled={!hasNutrition || isLogging || disabled}
            className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-xs overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {isLogging ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <TrendingUp className="h-3 w-3 mr-1" />
            )}
            {isLogging ? "Logging..." : "Log"}
          </Button>

          {/* Replace */}
          <Button
            size="sm"
            onClick={() => setIsReplacePickerOpen(true)}
            disabled={disabled}
            className="bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-xs overflow-hidden text-ellipsis whitespace-nowrap"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Replace
          </Button>

          {/* Add From Craving Creator */}
          <Button
            size="sm"
            onClick={handleAddFromCravingCreator}
            disabled={disabled}
            className="bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed text-xs overflow-hidden text-ellipsis whitespace-nowrap"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Replace Picker Modal */}
      <ReplacePicker
        isOpen={isReplacePickerOpen}
        onClose={() => setIsReplacePickerOpen(false)}
        onSelect={handleReplace}
        servings={servings}
        currentArchetype={meal.archetype}
        currentMealType={meal.mealType}
      />
    </>
  );
}