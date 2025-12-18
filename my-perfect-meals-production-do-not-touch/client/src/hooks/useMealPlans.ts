import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface MealSlot {
  day: string;
  time: string;
  label: string;
  mealType: "meal" | "snack";
  name: string;
  description: string;
  ingredients: string[];
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface MealPlan {
  id?: string;
  title: string;
  dietOverride?: string;
  durationDays: number;
  mealsPerDay: number;
  snacksPerDay: number;
  selectedIngredients: string[];
  schedule: { name: string; time: string }[];
  slots: MealSlot[];
  status: "accepted" | "archived";
  createdAt?: string;
}

export function useMealPlans() {
  return useQuery({
    queryKey: ["/api/meal-plans"],
    queryFn: () => apiRequest("/api/meal-plans"),
  });
}

export function useMealPlan(id?: string) {
  return useQuery({
    queryKey: ["/api/meal-plans", id],
    queryFn: () => apiRequest(`/api/meal-plans/${id}`),
    enabled: !!id,
  });
}

export function useCreateMealPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (mealPlan: MealPlan) => 
      apiRequest("/api/meal-plans", {
        method: "POST",
        body: JSON.stringify(mealPlan),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
    },
  });
}

export function useDeleteMealPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/meal-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
    },
  });
}

export function useRepeatMealPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, weeks, startDate }: { id: string; weeks?: number; startDate?: string }) =>
      apiRequest(`/api/meal-plans/${id}/repeat`, {
        method: "POST",
        body: JSON.stringify({ weeks, startDate }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
    },
  });
}