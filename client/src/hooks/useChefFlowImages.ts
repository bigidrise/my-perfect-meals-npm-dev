import { useEffect, useRef, useState, useMemo } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

export interface ChefFlowMeal {
  id?: string;
  name?: string;
  meal?: string;
  imageUrl?: string;
  photoUrl?: string;
}

// Module-level cache: persists for the full browser session across navigation
const sessionCache = new Map<string, string>();

export function chefFlowMealId(meal: ChefFlowMeal, mealType: string): string {
  if (meal.id) return meal.id;
  const name = (meal.name || meal.meal || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);
  return `cfm-${mealType}-${name}`;
}

export function useChefFlowImages(
  meals: ChefFlowMeal[],
  mealType: string,
): Record<string, string> {
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const inFlightRef = useRef<Set<string>>(new Set());
  const failedRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!meals || meals.length === 0) return;

    meals.forEach((meal) => {
      const id = chefFlowMealId(meal, mealType);
      const mealName = meal.name || meal.meal || "";
      if (!mealName) return;

      // Priority 1: external photo (Google Places etc.) — cache immediately, skip AI generation
      if (meal.photoUrl) {
        sessionCache.set(id, meal.photoUrl);
        setImageMap((prev) =>
          prev[id] === meal.photoUrl ? prev : { ...prev, [id]: meal.photoUrl! },
        );
        return;
      }

      // Priority 2: imageUrl already provided by API response
      if (meal.imageUrl) {
        sessionCache.set(id, meal.imageUrl);
        setImageMap((prev) =>
          prev[id] === meal.imageUrl ? prev : { ...prev, [id]: meal.imageUrl! },
        );
        return;
      }

      // Priority 3: session cache hit — no new request needed
      if (sessionCache.has(id)) {
        const cached = sessionCache.get(id)!;
        setImageMap((prev) =>
          prev[id] === cached ? prev : { ...prev, [id]: cached },
        );
        return;
      }

      // Priority 4: already failed — do not retry
      if (failedRef.current.has(id)) return;

      // Priority 5: request already in-flight — do not duplicate
      if (inFlightRef.current.has(id)) return;

      // Priority 6: fire a new generation request
      inFlightRef.current.add(id);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      fetch(apiUrl("/api/meals/generate-image"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ mealName, mealType }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          clearTimeout(timeoutId);
          inFlightRef.current.delete(id);
          if (data.imageUrl) {
            sessionCache.set(id, data.imageUrl);
            if (mountedRef.current) {
              setImageMap((prev) => ({ ...prev, [id]: data.imageUrl }));
            }
          } else {
            failedRef.current.add(id);
          }
        })
        .catch(() => {
          clearTimeout(timeoutId);
          inFlightRef.current.delete(id);
          failedRef.current.add(id);
        });
    });
  }, [meals, mealType]);

  return imageMap;
}
