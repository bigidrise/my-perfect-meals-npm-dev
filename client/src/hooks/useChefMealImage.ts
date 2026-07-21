import { useCallback, useRef } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

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
    meal: { id: string; name: string; ingredients?: any[] },
    mealType: string,
    onImageReady: (mealId: string, imageUrl: string) => void,
    dietType?: string
  ) => {
    const normalizedMealType = mealType === 'snacks' ? 'snack' : mealType;
    const sourceType = resolveSourceType(normalizedMealType);

    // Mint a fresh token. Any previous in-flight request for this mealId is now
    // superseded — its response will be silently dropped when it arrives.
    const requestToken = crypto.randomUUID();
    activeTokensRef.current.set(meal.id, requestToken);

    try {
      const res = await fetch(apiUrl("/api/meals/generate-image"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          mealName: meal.name,
          mealType: normalizedMealType,
          sourceType,
          dietType,
          ingredients: meal.ingredients || [],
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        // Only fire the callback if this is still the active request for this meal.
        // A regeneration or concurrent duplicate call will have replaced our token.
        if (activeTokensRef.current.get(meal.id) === requestToken) {
          activeTokensRef.current.delete(meal.id);
          onImageReady(meal.id, data.imageUrl);
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
