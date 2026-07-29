import { useState, useCallback } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

export interface HasMealImage {
  id: string;
  name: string;
  imageUrl?: string | null;
  mealType?: string;
}

const IMAGE_CACHE_PREFIX = "mpm.imgcache.";

/**
 * Persist an imageUrl to localStorage.  Only writes stable https:// URLs —
 * base64 data: URLs are ~1–2 MB each and would exhaust the 5 MB localStorage
 * quota within 3–5 images, silently breaking every other cache in the app.
 */
function persistImageUrl(mealId: string, imageUrl: string) {
  if (!imageUrl.startsWith("https://")) return;
  try { localStorage.setItem(IMAGE_CACHE_PREFIX + mealId, imageUrl); } catch {}
}

/**
 * Lookup a previously-hydrated imageUrl by mealId.
 * Call this in each page's mount/restore handler to fill in imageUrls that
 * were fetched in a prior session before the user navigated away.
 */
export function lookupHydratedImageUrl(mealId: string): string | null {
  try { return localStorage.getItem(IMAGE_CACHE_PREFIX + mealId) ?? null; } catch { return null; }
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
                // Persist to localStorage BEFORE setMeals — survives component unmount
                // so the reactive cache-save useEffect doesn't race with navigation.
                persistImageUrl(meal.id, data.imageUrl);
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
