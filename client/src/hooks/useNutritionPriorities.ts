import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type FoodInclusionPriorityId,
} from "@shared/nutritionPriorities";
import {
  invalidateNutritionPriorityPersonalization,
  invalidateChildNutritionPriorities,
  loadAdultNutritionPriorities,
  loadChildNutritionPriorities,
  replaceAdultNutritionPriorities,
  replaceChildNutritionPriorities,
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

export const childNutritionPrioritiesQueryKey = (
  actorUserId?: string | null,
  childProfileId?: string | null,
) => [
  "nutrition-priorities",
  "child",
  actorUserId ?? "anonymous",
  childProfileId ?? "new",
] as const;

export type ChildNutritionPrioritiesDraftState = {
  identity: string | null;
  selectedPriorityIds: FoodInclusionPriorityId[];
  isDirty: boolean;
};

export function scopeChildNutritionPrioritiesDraft(
  state: ChildNutritionPrioritiesDraftState,
  identity: string | null,
): ChildNutritionPrioritiesDraftState {
  return state.identity === identity
    ? state
    : { identity, selectedPriorityIds: [], isDirty: false };
}

export function useChildNutritionPriorities(
  actorUserId?: string | null,
  childProfileId?: string | null,
) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const identity = actorUserId
    ? `${actorUserId}:${childProfileId ?? "new"}`
    : null;
  const [draftState, setDraftState] = useState<ChildNutritionPrioritiesDraftState>({
    identity,
    selectedPriorityIds: [],
    isDirty: false,
  });
  const currentDraft = scopeChildNutritionPrioritiesDraft(draftState, identity);

  const query = useQuery<NutritionPrioritiesResponse>({
    queryKey: childNutritionPrioritiesQueryKey(actorUserId, childProfileId),
    queryFn: () => loadChildNutritionPriorities(childProfileId!),
    enabled: Boolean(actorUserId && childProfileId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!identity || !childProfileId || !query.data) return;
    setDraftState((previous) => {
      const scoped = scopeChildNutritionPrioritiesDraft(previous, identity);
      return scoped.isDirty
        ? scoped
        : {
            identity,
            selectedPriorityIds: query.data!.document.selectedPriorityIds,
            isDirty: false,
          };
    });
  }, [childProfileId, identity, query.data]);

  useEffect(() => {
    setDraftState((previous) => scopeChildNutritionPrioritiesDraft(previous, identity));
  }, [identity]);

  const updateSelection = useCallback((next: FoodInclusionPriorityId[]) => {
    setDraftState({
      identity,
      selectedPriorityIds: next,
      isDirty: true,
    });
  }, [identity]);

  const save = useCallback(async (options?: {
    force?: boolean;
    childProfileId?: string;
  }) => {
    if (!actorUserId) throw new Error("Your account is not available yet.");
    const targetChildId = options?.childProfileId ?? childProfileId;
    if (!targetChildId) throw new Error("Create the child profile before saving Nutrition Priorities.");
    if (!options?.force && !currentDraft.isDirty) return query.data?.document ?? null;

    const targetIdentity = `${actorUserId}:${targetChildId}`;
    setDraftState({ ...currentDraft, identity: targetIdentity });
    setIsSaving(true);
    try {
      const response = await replaceChildNutritionPriorities(
        targetChildId,
        currentDraft.selectedPriorityIds,
      );
      queryClient.setQueryData(
        childNutritionPrioritiesQueryKey(actorUserId, targetChildId),
        response,
      );
      setDraftState({
        identity: targetIdentity,
        selectedPriorityIds: response.document.selectedPriorityIds,
        isDirty: false,
      });
      await invalidateChildNutritionPriorities(queryClient, actorUserId, targetChildId);
      return response.document;
    } finally {
      setIsSaving(false);
    }
  }, [actorUserId, childProfileId, currentDraft, query.data?.document, queryClient]);

  return {
    selectedPriorityIds: currentDraft.selectedPriorityIds,
    setSelectedPriorityIds: updateSelection,
    save,
    isDirty: currentDraft.isDirty,
    isLoading: Boolean(childProfileId) && query.isLoading,
    isSaving,
    error: query.error instanceof Error ? query.error : null,
    retry: query.refetch,
  };
}
