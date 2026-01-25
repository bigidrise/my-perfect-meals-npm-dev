import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { get, post } from "@/lib/api";
import { apiUrl } from '@/lib/resolveApiBase';

export type DiabetesType = "NONE" | "T1D" | "T2D";
export type GlucoseContext = "FASTED" | "PRE_MEAL" | "POST_MEAL_1H" | "POST_MEAL_2H" | "RANDOM";

export interface DiabetesProfile {
  userId: string;
  type: DiabetesType;
  medications?: { name: string; dose?: string }[] | null;
  hypoHistory: boolean;
  a1cPercent?: number;
  guardrails?: {
    fastingMin?: number;
    fastingMax?: number;
    postMealMax?: number;
    carbLimit?: number;
    fiberMin?: number;
    giCap?: number;
    mealFrequency?: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface GlucoseLog {
  id: string;
  userId: string;
  valueMgdl: number;
  context: GlucoseContext;
  relatedMealId?: string;
  recordedAt: string;
  insulinUnits?: number;
  notes?: string;
}

export interface MealConstraints {
  maxCarbsGrams: number;
  preferLowGlycemic: boolean;
  restrictedIngredients: string[];
  recommendedProteinGrams?: number;
  recommendedFiberGrams?: number;
  maxSodiumMg?: number;
  alertLevel: "none" | "caution" | "warning";
  alertReason?: string;
}

// Hook to get diabetes profile
export function useDiabetesProfile(userId?: string) {
  return useQuery({
    queryKey: ["/api/diabetes/profile", userId],
    queryFn: () => get(`/api/diabetes/profile?userId=${userId}`),
    enabled: !!userId,
  });
}

// Hook to get glucose logs
export function useGlucoseLogs(userId?: string, limit = 50) {
  return useQuery({
    queryKey: ["/api/diabetes/glucose", userId, limit],
    queryFn: () => get(`/api/diabetes/glucose?userId=${userId}&limit=${limit}`),
    enabled: !!userId,
  });
}

// Hook to get meal constraints based on glucose data
export function useMealConstraints(userId?: string) {
  return useQuery({
    queryKey: ["/api/meal-engine/constraints", userId],
    queryFn: () => get(`/api/meal-engine/constraints?userId=${userId}`),
    enabled: !!userId,
  });
}

// Mutation to save diabetes profile
export function useSaveDiabetesProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (profile: Partial<DiabetesProfile>) => {
      const response = await fetch(apiUrl("/api/diabetes/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile),
      });
      if (!response.ok) throw new Error("Failed to save profile");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/diabetes/profile", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/meal-engine/constraints", variables.userId] });
    },
  });
}

// Mutation to log glucose reading
export function useLogGlucose() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (glucose: Partial<GlucoseLog>) =>
      post("/api/diabetes/glucose", glucose),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/diabetes/glucose", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/meal-engine/constraints", variables.userId] });
    },
  });
}