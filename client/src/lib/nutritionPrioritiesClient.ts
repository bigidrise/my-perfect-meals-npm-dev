import type { QueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  FOOD_INCLUSION_PRIORITIES_SCHEMA_VERSION,
  NUTRITION_PRIORITIES_REGISTRY_VERSION,
  type FoodInclusionPrioritiesDocument,
  type FoodInclusionPriorityId,
} from "@shared/nutritionPriorities";

export type NutritionPrioritiesResponse = {
  document: FoodInclusionPrioritiesDocument;
};

export async function loadAdultNutritionPriorities(): Promise<NutritionPrioritiesResponse> {
  return apiRequest<NutritionPrioritiesResponse>("/api/nutrition-priorities");
}

export async function replaceAdultNutritionPriorities(
  selectedPriorityIds: FoodInclusionPriorityId[],
): Promise<NutritionPrioritiesResponse> {
  return apiRequest<NutritionPrioritiesResponse>("/api/nutrition-priorities", {
    method: "PUT",
    body: JSON.stringify({
      schemaVersion: FOOD_INCLUSION_PRIORITIES_SCHEMA_VERSION,
      registryVersion: NUTRITION_PRIORITIES_REGISTRY_VERSION,
      selectedPriorityIds,
    }),
  });
}

export async function invalidateNutritionPriorityPersonalization(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  userId: string,
): Promise<void> {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("mpm:dietaryUpdated"));
  }
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ["nutrition-priorities", "adult", userId],
    }),
    queryClient.invalidateQueries({ queryKey: ["nutrition-summary"] }),
  ]);
}
