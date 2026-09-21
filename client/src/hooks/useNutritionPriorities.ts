import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type FoodInclusionPriorityId,
} from "@shared/nutritionPriorities";
import {
  invalidateNutritionPriorityPersonalization,
  loadAdultNutritionPriorities,
  replaceAdultNutritionPriorities,
  type NutritionPrioritiesResponse,
} from "@/lib/nutritionPrioritiesClient";

export const adultNutritionPrioritiesQueryKey = (userId?: string | null) => [
  "nutrition-priorities",
  "adult",
  userId ?? "anonymous",
] as const;

export function useAdultNutritionPriorities(userId?: string | null) {
  const queryClient = useQueryClient();
  const [selectedPriorityIds, setSelectedPriorityIds] = useState<FoodInclusionPriorityId[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const loadedIdentityRef = useRef<string | null>(null);

  const query = useQuery<NutritionPrioritiesResponse>({
    queryKey: adultNutritionPrioritiesQueryKey(userId),
    queryFn: loadAdultNutritionPriorities,
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!userId || !query.data) return;
    if (loadedIdentityRef.current !== userId || !isDirty) {
      setSelectedPriorityIds(query.data.document.selectedPriorityIds);
      setIsDirty(false);
      loadedIdentityRef.current = userId;
    }
  }, [isDirty, query.data, userId]);

  useEffect(() => {
    if (loadedIdentityRef.current && loadedIdentityRef.current !== userId) {
      setSelectedPriorityIds([]);
      setIsDirty(false);
      loadedIdentityRef.current = null;
    }
  }, [userId]);

  const updateSelection = useCallback((next: FoodInclusionPriorityId[]) => {
    setSelectedPriorityIds(next);
    setIsDirty(true);
  }, []);

  const save = useCallback(async (options?: { force?: boolean }) => {
    if (!userId) throw new Error("Your profile is not available yet.");
    if (!options?.force && !isDirty) return query.data?.document ?? null;

    setIsSaving(true);
    try {
      const response = await replaceAdultNutritionPriorities(selectedPriorityIds);
      queryClient.setQueryData(adultNutritionPrioritiesQueryKey(userId), response);
      setSelectedPriorityIds(response.document.selectedPriorityIds);
      setIsDirty(false);
      await invalidateNutritionPriorityPersonalization(queryClient, userId);
      return response.document;
    } finally {
      setIsSaving(false);
    }
  }, [isDirty, query.data?.document, queryClient, selectedPriorityIds, userId]);

  return {
    selectedPriorityIds,
    setSelectedPriorityIds: updateSelection,
    save,
    isDirty,
    isLoading: query.isLoading,
    isSaving,
    error: query.error instanceof Error ? query.error : null,
    retry: query.refetch,
  };
}
