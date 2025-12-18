import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const useAcceptMealPlan = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (planData: {
      title: string;
      dietOverride?: string;
      durationDays?: number;
      mealsPerDay?: number;
      snacksPerDay?: number;
      selectedIngredients?: string[];
      schedule?: any[];
      slots?: any[];
    }) => {
      console.log("🎯 Accepting meal plan:", planData);

      const response = await apiRequest("/api/meal-plan-archive", {
        method: "POST",
        body: JSON.stringify(planData),
      });

      console.log("✅ Meal plan accepted successfully:", response);
      return response;
    },
    onSuccess: (data) => {
      console.log("✅ Meal plan accepted, invalidating queries");
      // Refresh meal plans in the archive/calendar
      qc.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      qc.invalidateQueries({ queryKey: ["/api/meal-plan-archive"] });
    },
    onError: (error) => {
      console.error("❌ Failed to accept meal plan:", error);
    },
  });
};