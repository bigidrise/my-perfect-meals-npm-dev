import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";

export interface SavedMealRow {
  id: string;
  userId: string;
  title: string;
  sourceType: string;
  signatureHash: string;
  mealData: any;
  createdAt: string;
}

export function useSavedMealsCheck() {
  return useQuery<string[]>({
    queryKey: ["saved-meals-check"],
    queryFn: () => get<string[]>("/api/saved-meals/check"),
    staleTime: 30_000,
  });
}

export function useSavedMealsList() {
  return useQuery<SavedMealRow[]>({
    queryKey: ["saved-meals-list"],
    queryFn: () => get<SavedMealRow[]>("/api/saved-meals"),
    staleTime: 10_000,
  });
}

export function useToggleSavedMeal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { title: string; sourceType: string; mealData: any }) => {
      return post<{ saved: boolean; id: string | null }>("/api/saved-meals/toggle", params);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-meals-check"] });
      qc.invalidateQueries({ queryKey: ["saved-meals-list"] });
    },
  });
}

export function makeMealKey(title: string, sourceType: string): string {
  return `${title.trim().toLowerCase()}|${sourceType}`;
}

export function isMealSaved(keys: string[] | undefined, title: string, sourceType: string): boolean {
  if (!keys || keys.length === 0) return false;
  return keys.includes(makeMealKey(title, sourceType));
}
