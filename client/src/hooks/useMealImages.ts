import { useState, useCallback } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

export interface HasMealImage {
  id: string;
  name: string;
  imageUrl?: string | null;
}

export function useMealImages<T extends HasMealImage>(
  setMeals: React.Dispatch<React.SetStateAction<T[]>>,
  options?: { mealType?: string; concurrency?: number }
) {
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const concurrency = options?.concurrency ?? 3;
  const mealType = options?.mealType ?? "dinner";

  const hydrateImages = useCallback(
    async (meals: T[]) => {
      if (!meals.length) return;

      const loadingState: Record<string, boolean> = {};
      meals.forEach((m) => { loadingState[m.id] = true; });
      setLoadingImages((prev) => ({ ...prev, ...loadingState }));

      for (let i = 0; i < meals.length; i += concurrency) {
        const batch = meals.slice(i, i + concurrency);
        await Promise.all(
          batch.map(async (meal) => {
            try {
              const res = await fetch(apiUrl("/api/meals/generate-image"), {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ mealName: meal.name, mealType }),
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
