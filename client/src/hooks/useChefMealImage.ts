import { useCallback } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

export function useChefMealImage() {
  const fetchImageForMeal = useCallback(async (
    meal: { id: string; name: string; ingredients?: any[] },
    mealType: string,
    onImageReady: (mealId: string, imageUrl: string) => void,
    dietType?: string
  ) => {
    // Normalize plural 'snacks' → 'snack' so the server image pipeline
    // routes correctly through the snack-aware path
    const normalizedMealType = mealType === 'snacks' ? 'snack' : mealType;

    try {
      const res = await fetch(apiUrl("/api/meals/generate-image"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          mealName: meal.name,
          mealType: normalizedMealType,
          dietType,
          ingredients: meal.ingredients || [],
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        onImageReady(meal.id, data.imageUrl);
      }
    } catch {
      // silent — card still renders without image
    }
  }, []);

  return { fetchImageForMeal };
}
