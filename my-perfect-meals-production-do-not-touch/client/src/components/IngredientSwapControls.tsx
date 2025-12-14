import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { SWAP_OPTIONS, ARCHETYPE_EXCLUDES, MEDICAL_BLOCKERS, type Slot } from "@/data/swap.rules";
import { recalculateNutritionWithSwaps } from "@/utils/macros";
import type { MealTemplateBase } from "@/data/models";
import { toast } from "@/hooks/use-toast";

interface IngredientSwapControlsProps {
  meal: MealTemplateBase;
  servings: number;
  currentSwaps: Record<string, string>;
  onSwapChange: (swaps: Record<string, string>) => void;
  onNutritionUpdate: (nutrition: { calories: number; protein: number; carbs: number; fat: number }) => void;
  disabled?: boolean;
}

export default function IngredientSwapControls({
  meal,
  servings,
  currentSwaps,
  onSwapChange,
  onNutritionUpdate,
  disabled = false
}: IngredientSwapControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group ingredients by slot type for easier swapping
  const ingredientSlots = (meal.ingredients || []).reduce((acc, ingredient) => {
    // Simple heuristic to categorize ingredients
    if (!ingredient?.name) return acc; // Skip ingredients without names
    const name = ingredient.name.toLowerCase();
    
    let slot: Slot;
    if (name.includes("chicken") || name.includes("turkey") || name.includes("salmon") || 
        name.includes("cod") || name.includes("tofu") || name.includes("egg") || 
        name.includes("beef") || name.includes("shrimp")) {
      slot = "protein";
    } else if (name.includes("rice") || name.includes("quinoa") || name.includes("pasta") || 
               name.includes("potato") || name.includes("farro") || name.includes("noodles")) {
      slot = "carb";
    } else if (name.includes("oil") || name.includes("avocado") || name.includes("nuts") || 
               name.includes("butter") || name.includes("almond")) {
      slot = "fat";
    } else {
      slot = "veg";
    }
    
    if (!acc[slot]) acc[slot] = [];
    acc[slot].push(ingredient.name);
    return acc;
  }, {} as Record<Slot, string[]>);

  const getFilteredSwapOptions = (slot: Slot, originalIngredient: string) => {
    let options = SWAP_OPTIONS[slot] || [];
    
    // Filter out archetype-excluded options
    if (meal.archetype && ARCHETYPE_EXCLUDES[meal.archetype]?.[slot]) {
      const excludes = ARCHETYPE_EXCLUDES[meal.archetype][slot] || [];
      options = options.filter(option => !excludes.includes(option));
    }
    
    // Filter out medical blockers (simplified - would use real user data)
    Object.values(MEDICAL_BLOCKERS).forEach(blockedItems => {
      options = options.filter(option => !blockedItems.includes(option));
    });
    
    // Include original ingredient if not already in options
    if (!options.includes(originalIngredient)) {
      options.unshift(originalIngredient);
    }
    
    return options;
  };

  const handleSwap = (originalIngredient: string, newIngredient: string, slot: Slot) => {
    if (originalIngredient === newIngredient) {
      // Remove swap (revert to original)
      const newSwaps = { ...currentSwaps };
      delete newSwaps[originalIngredient];
      onSwapChange(newSwaps);
    } else {
      // Add or update swap
      const newSwaps = { ...currentSwaps, [originalIngredient]: newIngredient };
      onSwapChange(newSwaps);
    }
    
    // Recalculate nutrition
    const newNutrition = recalculateNutritionWithSwaps(
      meal.ingredients,
      currentSwaps,
      servings
    );
    onNutritionUpdate(newNutrition);
    
    toast({
      title: "Ingredient Swapped",
      description: `${originalIngredient} → ${newIngredient}`,
      variant: "default",
    });
  };

  const resetAllSwaps = () => {
    onSwapChange({});
    
    // Recalculate with original ingredients
    const originalNutrition = recalculateNutritionWithSwaps(
      meal.ingredients,
      {},
      servings
    );
    onNutritionUpdate(originalNutrition);
    
    toast({
      title: "Swaps Reset",
      description: "All ingredients restored to original",
      variant: "default",
    });
  };

  const hasSwaps = Object.keys(currentSwaps).length > 0;

  // Don't render if no meal or no ingredients
  if (!meal || !meal.ingredients || Object.keys(ingredientSlots).length === 0) {
    return null; // No swappable ingredients
  }

  return (
    <div className="space-y-3">
      {/* Toggle Header */}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={disabled}
          className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs"
        >
          {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
          Customize Ingredients
        </Button>
        
        {hasSwaps && (
          <Button
            size="sm"
            variant="outline"
            onClick={resetAllSwaps}
            disabled={disabled}
            className="bg-orange-500/20 border-orange-500/30 text-white hover:bg-orange-500/30 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Swap Controls */}
      {isExpanded && (
        <div className="space-y-3 bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-3">
          {Object.entries(ingredientSlots).map(([slot, ingredients]) => (
            <div key={slot} className="space-y-2">
              <h4 className="text-white font-medium text-sm capitalize">
                {slot === "veg" ? "Vegetables" : slot} 
                {ingredients.length > 1 && ` (${ingredients.length})`}
              </h4>
              
              <div className="space-y-2">
                {ingredients.map(ingredient => {
                  const swapOptions = getFilteredSwapOptions(slot as Slot, ingredient);
                  const currentValue = currentSwaps[ingredient] || ingredient;
                  const isSwapped = currentSwaps[ingredient] !== undefined;
                  
                  return (
                    <div key={ingredient} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Select
                          value={currentValue}
                          onValueChange={(value) => handleSwap(ingredient, value, slot as Slot)}
                          disabled={disabled}
                        >
                          <SelectTrigger className="bg-white/10 border-white/20 text-white text-xs h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-white/20">
                            {swapOptions.map(option => (
                              <SelectItem 
                                key={option} 
                                value={option}
                                className="text-white hover:bg-white/10 text-xs"
                              >
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {isSwapped && (
                        <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-200 border-orange-500/30">
                          Swapped
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          
          <div className="text-xs text-white/60 mt-2">
            Swaps respect your dietary preferences and medical restrictions.
          </div>
        </div>
      )}
    </div>
  );
}