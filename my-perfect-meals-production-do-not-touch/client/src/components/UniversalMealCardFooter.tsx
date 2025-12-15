import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { GlassButton } from "@/components/ui/glass-button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Check } from "lucide-react";
import type { MealTemplateBase, NutritionInfo } from "@/data/models";

interface UniversalMealCardFooterProps {
  meal: MealTemplateBase;
  currentServings: number;
  className?: string;
  onReplace?: (meal: MealTemplateBase) => void;
  isLoading?: boolean;
}

export default function UniversalMealCardFooter({
  meal,
  currentServings,
  className = "",
  onReplace,
  isLoading = false,
}: UniversalMealCardFooterProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isLoggingMacros, setIsLoggingMacros] = useState(false);
  const [macrosLogged, setMacrosLogged] = useState(false);
  const [planAdded, setPlanAdded] = useState(false);

  // Log to Macros handler
  const handleLogMacros = async () => {
    if (!meal.nutritionPerServing) {
      toast({
        title: "Missing Nutrition Data",
        description: "This meal doesn't have nutrition information available.",
        variant: "destructive",
      });
      return;
    }

    setIsLoggingMacros(true);

    try {
      // Calculate total nutrition for current servings
      const totalNutrition = {
        calories: Math.round(meal.nutritionPerServing.calories * currentServings),
        protein: Math.round(meal.nutritionPerServing.protein * currentServings),
        carbs: Math.round(meal.nutritionPerServing.carbs * currentServings),
        fat: Math.round(meal.nutritionPerServing.fat * currentServings),
      };

      // Create the meal log entry for unified endpoint
      const logEntry = {
        userId: "00000000-0000-0000-0000-000000000001",
        mealId: meal.id,
        mealType: meal.mealType || "snack",
        source: "template_hub",
        nutrition: {
          calories: totalNutrition.calories,
          protein_g: totalNutrition.protein,
          carbs_g: totalNutrition.carbs,
          fat_g: totalNutrition.fat,
        },
        meta: {
          mealName: `${meal.name} (${currentServings} serving${currentServings !== 1 ? "s" : ""})`,
          servings: currentServings,
          source: "template_hub"
        },
        qty: currentServings,
        unit: "serving"
      };

      // Post to the unified macro logging endpoint
      const { post } = await import("@/lib/api");
      await post("/api/macros/log", logEntry);

      // Invalidate macro queries for instant UI update
      queryClient.invalidateQueries({ queryKey: ["macros"] });
      
      // Emit the macros updated event for biometrics dashboard
      window.dispatchEvent(new Event("macros:updated"));

      setMacrosLogged(true);
      toast({
        title: "Logged Successfully",
        description: `${meal.name} has been logged to your macros for ${currentServings} serving${currentServings !== 1 ? "s" : ""}.`,
      });
      
      // Reset success state after 3 seconds
      setTimeout(() => {
        setMacrosLogged(false);
      }, 3000);
    } catch (error) {
      console.error("Error logging meal:", error);
      toast({
        title: "Logging Failed",
        description: "There was an error logging this meal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingMacros(false);
    }
  };

  // Replace handler
  const handleReplace = () => {
    if (onReplace) {
      onReplace(meal);
    } else {
      toast({
        title: "Replace Coming Soon",
        description: "Meal replacement functionality will be available soon.",
      });
    }
  };

  // Add to Weekly Plan handler - proper integration
  const handleAddToWeeklyPlan = () => {
    // Check if we came from weekly plan
    const returnContext = localStorage.getItem("weeklyPlanContext");
    
    if (returnContext) {
      try {
        const context = JSON.parse(returnContext);
        
        // Add meal to weekly plan
        const mealToAdd = {
          id: meal.id,
          name: meal.name,
          servings: currentServings,
          ingredients: meal.ingredients || [],
          instructions: meal.instructions || [],
          nutritionPerServing: meal.nutritionPerServing,
          cookingTime: "30 minutes",
          difficulty: "Medium",
          source: "template"
        };
        
        // Store the meal to be added
        localStorage.setItem("weeklyPlanMealToAdd", JSON.stringify({
          meal: mealToAdd,
          targetDay: context.targetDay,
          targetSlot: context.targetSlot
        }));
        
        // Return to weekly plan
        setLocation("/weekly-meal-board");
        
        setPlanAdded(true);
        toast({
          title: "Meal Added!",
          description: `${meal.name} will be added to your weekly plan.`,
        });
        
        // Reset success state after 2 seconds
        setTimeout(() => {
          setPlanAdded(false);
        }, 2000);
      } catch (error) {
        console.error("Failed to parse weekly plan context:", error);
        directToWeeklyPlan();
      }
    } else {
      // No weekly plan context - direct to weekly plan anyway for template hub
      directToWeeklyPlan();
    }
  };

  const directToWeeklyPlan = () => {
    // Create a meal object for the weekly plan
    const mealToAdd = {
      id: meal.id,
      name: meal.name,
      servings: currentServings,
      ingredients: meal.ingredients || [],
      instructions: meal.instructions || [],
      nutritionPerServing: meal.nutritionPerServing,
      cookingTime: "30 minutes",
      difficulty: "Medium",
      source: "template"
    };
    
    // Store the meal to be added (without specific day/slot targeting)
    localStorage.setItem("weeklyPlanMealToAdd", JSON.stringify({
      meal: mealToAdd,
      targetDay: null, // User will choose
      targetSlot: null // User will choose
    }));
    
    // Navigate to weekly plan
    setLocation("/weekly-meal-board");
    
    setPlanAdded(true);
    toast({
      title: "Redirecting to Weekly Plan",
      description: `${meal.name} ready to add - choose your day and time slot.`,
    });
    
    // Reset success state after 2 seconds
    setTimeout(() => {
      setPlanAdded(false);
    }, 2000);
  };
  

  const canLogMacros = !!meal.nutritionPerServing && !isLoading;

  return (
    <div className={`border-t border-white/20 pt-4 space-y-2 ${className}`}>
      <div className="grid grid-cols-1 gap-2">
        {/* Log to Macros */}
        <Button
          size="sm"
          className={`${
            macrosLogged
              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          } disabled:opacity-50 transition-all duration-200`}
          onClick={handleLogMacros}
          disabled={!canLogMacros || isLoggingMacros || macrosLogged}
          data-testid={`log-macros-${meal.id}`}
        >
          {macrosLogged ? (
            <><Check className="h-4 w-4 mr-1" /> Logged ✓</>
          ) : isLoggingMacros ? (
            "Logging..."
          ) : (
            "Log to Macros"
          )}
        </Button>
        
        {/* Tooltip for disabled Log button */}
        {!canLogMacros && !isLoading && (
          <p className="text-xs text-white/60 text-center">
            Nutrition data not available
          </p>
        )}

        {/* Replace */}
        <GlassButton
          size="sm"
          onClick={handleReplace}
          disabled={isLoading}
          data-testid={`replace-${meal.id}`}
        >
          Replace
        </GlassButton>

        {/* Add to Weekly Plan */}
        <GlassButton
          size="sm"
          className={`${
            planAdded
              ? "border-green-400/40 text-green-300 hover:bg-green-600/20"
              : "border-purple-400/40 text-purple-300 hover:bg-purple-600/20"
          } transition-all duration-200`}
          onClick={handleAddToWeeklyPlan}
          disabled={isLoading || planAdded}
          data-testid={`add-to-weekly-plan-${meal.id}`}
        >
          {planAdded ? (
            <><Check className="h-4 w-4 mr-1" /> Added ✓</>
          ) : (
            "Add to Plan"
          )}
        </GlassButton>
      </div>
    </div>
  );
}