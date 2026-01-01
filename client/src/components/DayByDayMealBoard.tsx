import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, ShoppingCart } from "lucide-react";
import { DayChips } from "@/components/DayChips";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { addMealsToShopping } from "@/lib/shoppingListApi";
import { apiRequest } from "@/lib/queryClient";
import type { Meal } from "@/components/MealCard";
import { weekDates } from "@/lib/boardApi";
import { formatDateDisplay } from "@/utils/midnight";

export interface DayMeals {
  breakfast: Meal[];
  lunch: Meal[];
  dinner: Meal[];
  snacks: Meal[];
}

export interface DayByDayMealBoardProps {
  weekStartISO: string;
  mealsByDay: Record<string, DayMeals>;
  onAddMeal?: (day: string, mealType: "breakfast" | "lunch" | "dinner" | "snacks") => void;
  children?: (activeDayISO: string, dayMeals: DayMeals) => React.ReactNode;
}

export function DayByDayMealBoard({ 
  weekStartISO, 
  mealsByDay, 
  onAddMeal,
  children 
}: DayByDayMealBoardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const weekDatesList = useMemo(() => weekDates(weekStartISO), [weekStartISO]);
  const [activeDayISO, setActiveDayISO] = useState(weekDatesList[0] || '');

  // Get meals for the active day
  const dayMeals = mealsByDay[activeDayISO] || {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: []
  };

  // Calculate daily totals
  const allDayMeals = [
    ...dayMeals.breakfast,
    ...dayMeals.lunch,
    ...dayMeals.dinner,
    ...dayMeals.snacks
  ];

  const dailyTotals = {
    calories: Math.round(allDayMeals.reduce((sum, m) => sum + (m.nutrition?.calories ?? 0), 0)),
    protein: Math.round(allDayMeals.reduce((sum, m) => sum + (m.nutrition?.protein ?? 0), 0)),
    carbs: Math.round(allDayMeals.reduce((sum, m) => sum + (m.nutrition?.carbs ?? 0), 0)),
    fat: Math.round(allDayMeals.reduce((sum, m) => sum + (m.nutrition?.fat ?? 0), 0))
  };

  // Send day's meals to macros
  const handleSendToMacros = async () => {
    if (allDayMeals.length === 0) {
      toast({
        title: "No meals to log",
        description: "Add meals to this day first",
        variant: "destructive"
      });
      return;
    }

    try {
      const { post } = await import("@/lib/api");
      const userId = "00000000-0000-0000-0000-000000000001";
      const logDate = activeDayISO;

      // Log each meal
      for (const meal of allDayMeals) {
        await post("/api/food-logs", {
          userId,
          logDate,
          foodName: meal.title || meal.name || "Meal",
          calories: meal.nutrition?.calories || 0,
          protein: meal.nutrition?.protein || 0,
          carbs: meal.nutrition?.carbs || 0,
          fat: meal.nutrition?.fat || 0,
          servingSize: meal.servings || 1
        });
      }

      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "macros", "today"] });
      await queryClient.refetchQueries({ queryKey: ["/api/users", userId, "macros", "today"] });

      toast({
        title: "✅ Logged to macros",
        description: `${allDayMeals.length} meals logged for ${formatDateDisplay(activeDayISO, { weekday: 'long' })}`
      });
    } catch (error) {
      console.error("Failed to log macros:", error);
      toast({
        title: "Failed to log macros",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  // Send day's meals to shopping list
  const handleSendToShopping = async () => {
    if (allDayMeals.length === 0) {
      toast({
        title: "No meals to add",
        description: "Add meals to this day first",
        variant: "destructive"
      });
      return;
    }

    try {
      await addMealsToShopping(weekStartISO, allDayMeals);
      
      // Invalidate and refetch shopping list
      await queryClient.invalidateQueries({ queryKey: ["/api/shopping-list", weekStartISO] });
      await queryClient.refetchQueries({ queryKey: ["/api/shopping-list", weekStartISO] });

      toast({
        title: "✅ Added to shopping list",
        description: `${allDayMeals.length} meals added for ${formatDateDisplay(activeDayISO, { weekday: 'long' })}`
      });
    } catch (error) {
      console.error("Failed to add to shopping:", error);
      toast({
        title: "Failed to add to shopping list",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Day chips for switching between days */}
      <DayChips 
        weekDates={weekDatesList}
        activeDayISO={activeDayISO}
        onDayChange={setActiveDayISO}
      />

      {/* Meal content (custom per page) */}
      {children && children(activeDayISO, dayMeals)}

      {/* Daily Totals Card */}
      <Card className="col-span-full border-emerald-500/30 bg-gradient-to-r from-emerald-900/20 to-emerald-800/20">
        <CardHeader>
          <CardTitle className="text-center text-white">
            Daily Totals - {formatDateDisplay(activeDayISO, { weekday: 'long', month: 'short', day: 'numeric' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{dailyTotals.calories}</div>
              <div className="text-xs uppercase tracking-wide text-emerald-200/70 mt-1">Calories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{dailyTotals.protein}g</div>
              <div className="text-xs uppercase tracking-wide text-emerald-200/70 mt-1">Protein</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{dailyTotals.carbs}g</div>
              <div className="text-xs uppercase tracking-wide text-emerald-200/70 mt-1">Carbs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{dailyTotals.fat}g</div>
              <div className="text-xs uppercase tracking-wide text-emerald-200/70 mt-1">Fat</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 py-6 px-4 border border-zinc-800 bg-zinc-900/60 backdrop-blur rounded-2xl">
        <Button
          onClick={handleSendToMacros}
          className="bg-emerald-600/20 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-600/30"
          data-testid="button-send-to-macros"
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          <span className="mx-2 font-medium">Send to Macros</span>
        </Button>
        <Button
          onClick={handleSendToShopping}
          className="bg-amber-600/20 border border-amber-400/40 text-amber-200 hover:bg-amber-600/30"
          data-testid="button-send-to-shopping"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          <span className="mx-2 font-medium">Send to Shopping</span>
        </Button>
      </div>
    </div>
  );
}
