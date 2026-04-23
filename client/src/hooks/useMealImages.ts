import { useState, useCallback } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

export interface HasMealImage {
  id: string;
  name: string;
  imageUrl?: string | null;
  mealType?: string;
}

export function useMealImages<T extends HasMealImage>(
  setMeals: React.Dispatch<React.SetStateAction<T[]>>,
  options?: { mealType?: string; concurrency?: number; dietType?: string }
) {
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const concurrency = options?.concurrency ?? 3;
  const mealType = options?.mealType ?? "dinner";
  const dietType = options?.dietType;

  const hydrateImages = useCallback(
    async (meals: T[]) => {
      if (!meals.length) return;

      // Only hydrate meals that don't already have an image
      const mealsNeedingImages = meals.filter((m) => !m.imageUrl);
      if (!mealsNeedingImages.length) return;

      const loadingState: Record<string, boolean> = {};
      mealsNeedingImages.forEach((m) => { loadingState[m.id] = true; });
      setLoadingImages((prev) => ({ ...prev, ...loadingState }));

      for (let i = 0; i < mealsNeedingImages.length; i += concurrency) {
        const batch = mealsNeedingImages.slice(i, i + concurrency);
        await Promise.all(
          batch.map(async (meal) => {
            try {
              const res = await fetch(apiUrl("/api/meals/generate-image"), {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({
                  mealName: meal.name,
                  mealType: meal.mealType || mealType,
                  ingredients: (meal as any).ingredients || [],
                  dietType,
                }),
              });
              const data = await res.json();
              if (data.imageUrl) {
                setMeals((prev) =>
                  prev.map((m) => m.id === meal.id ? { ...m, imageUrl: data.imageUrl } : m)
                );
              }
            } catch {
              // silent — card still shows without image
            } finally {
              setLoadingImages((prev) => ({ ...prev, [meal.id]: false }));
            }
          })
        );
      }
    },
    [concurrency, mealType, setMeals]
  );

  return { loadingImages, hydrateImages };
}
