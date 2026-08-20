import { useCallback, useRef } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import type { Meal } from "@/types/meal";

function resolveSourceType(mealType: string): string {
  const t = mealType.toLowerCase();
  if (t === "beverage" || t === "drink" || t === "hydration") return "beverage";
  if (t === "snack" || t === "snacks") return "snack";
  return "meal";
}

export function useChefMealImage() {
  // Per-instance token map: mealId → requestToken
  // When fetchImageForMeal is called again for the same mealId, the old token is
  // replaced, causing any in-flight response from the previous request to be
  // silently discarded. This prevents stale callbacks from overwriting a correct
  // image that arrived first.
  const activeTokensRef = useRef<Map<string, string>>(new Map());

  const fetchImageForMeal = useCallback(async (
    meal: Pick<Meal, "id" | "name" | "title" | "ingredients">,
    mealType: string,
    onImageReady: (mealId: string, imageUrl: string) => void,
    dietType?: string
  ) => {
    const normalizedMealType = mealType === 'snacks' ? 'snack' : mealType;
    const sourceType = resolveSourceType(normalizedMealType);
    const mealName = meal.name ?? meal.title ?? "Meal";

    // Mint a fresh token. Any previous in-flight request for this mealId is now
    // superseded — its response will be silently dropped when it arrives.
    const requestToken = crypto.randomUUID();
    const prevToken = activeTokensRef.current.get(meal.id);
    if (prevToken) {
      console.warn(`[IMG-LIFECYCLE:client] SECOND-REQUEST | mealId=${meal.id} | superseding token ${prevToken.substring(0,8)} with ${requestToken.substring(0,8)} | meal="${mealName}"`);
    } else {
      console.log(`[IMG-LIFECYCLE:client] REQUEST-START | mealId=${meal.id} | token=${requestToken.substring(0,8)} | meal="${mealName}" | sourceType=${sourceType}`);
    }
    activeTokensRef.current.set(meal.id, requestToken);

    try {
      const res = await fetch(apiUrl("/api/meals/generate-image"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          mealName,
          mealType: normalizedMealType,
          sourceType,
          dietType,
          ingredients: meal.ingredients || [],
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        const stillActive = activeTokensRef.current.get(meal.id) === requestToken;
        if (stillActive) {
          activeTokensRef.current.delete(meal.id);
          const urlType = data.imageUrl.startsWith('data:') ? 'base64-ephemeral' : 'permanent';
          console.log(`[IMG-LIFECYCLE:client] RESPONSE-DELIVERED | mealId=${meal.id} | token=${requestToken.substring(0,8)} | urlType=${urlType} | meal="${mealName}"`);
          onImageReady(meal.id, data.imageUrl);
        } else {
          console.warn(`[IMG-LIFECYCLE:client] RESPONSE-DISCARDED (stale token) | mealId=${meal.id} | token=${requestToken.substring(0,8)} — a newer request superseded this one`);
          activeTokensRef.current.delete(meal.id);
        }
      } else {
        activeTokensRef.current.delete(meal.id);
      }
    } catch {
      activeTokensRef.current.delete(meal.id);
      // silent — card still renders without image
    }
  }, []);

  // Invalidate any pending request for a given mealId (call before regenerating).
  const cancelImageRequest = useCallback((mealId: string) => {
    activeTokensRef.current.delete(mealId);
  }, []);

  return { fetchImageForMeal, cancelImageRequest };
}
