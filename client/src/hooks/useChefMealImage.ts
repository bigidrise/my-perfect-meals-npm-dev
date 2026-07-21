import { useCallback } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

function resolveSourceType(mealType: string): string {
  const t = mealType.toLowerCase();
  if (t === "beverage" || t === "drink" || t === "hydration") return "beverage";
  if (t === "snack" || t === "snacks") return "snack";
  return "meal";
}

export function useChefMealImage() {
  const fetchImageForMeal = useCallback(async (
    meal: { id: string; name: string; ingredients?: any[] },
    mealType: string,
    onImageReady: (mealId: string, imageUrl: string) => void,
    dietType?: string
  ) => {
    const normalizedMealType = mealType === 'snacks' ? 'snack' : mealType;
    const sourceType = resolveSourceType(normalizedMealType);

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
        onImageReady(meal.id, data.imageUrl);
      }
    } catch {
      // silent — card still renders without image
    }
  }, []);

  return { fetchImageForMeal };
}
