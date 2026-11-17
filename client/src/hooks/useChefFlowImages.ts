import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { IMAGE_CLIENT_TIMEOUT_MS, photographFromResponse, isPlaceholderImage } from "@shared/imageResult";
import { isPermanentImageUrl } from "@/lib/imageUrlUtils";
import { chefFlowImageRequests, restaurantImageContentIdentity } from "@/lib/chefFlowImageRequests";

export interface ChefFlowMeal {
  id?: string;
  name?: string;
  meal?: string;
  imageUrl?: string;
  /** Ingredient list from the meal's recipe — forwarded to the image generator
   *  so the prompt is bound to the actual recipe rather than just the dish name. */
  ingredients?: string[];
}

// Module-level session cache — survives SPA navigation within the same tab
const sessionCache = new Map<string, string>();

// localStorage persistence for stable https:// URLs — survives tab close / reload
const LS_PREFIX = "mpm.imgcache.cf.";

// sessionStorage persistence for base64/data: URIs — survives HMR and SPA
// navigation within the same tab (clears on tab close, which is acceptable)
const SS_PREFIX = "mpm.imgss.cf.";

function readFromLS(id: string): string | null {
  try {
    // Check sessionStorage first (base64 / data: URIs stored here)
    const ss = sessionStorage.getItem(SS_PREFIX + id);
    if (ss && !isPlaceholderImage(ss)) return ss;
    // Fall back to localStorage (https:// URLs stored here)
    const v = localStorage.getItem(LS_PREFIX + id);
    return v && isPermanentImageUrl(v) ? v : null;
  } catch { return null; }
}

function writeToLS(id: string, url: string): void {
  if (isPlaceholderImage(url)) return;
  if (isPermanentImageUrl(url)) {
    try { localStorage.setItem(LS_PREFIX + id, url); } catch {}
  } else if (url.startsWith("data:")) {
    // Store base64 in sessionStorage — tab-scoped, no cross-session quota risk
    try { sessionStorage.setItem(SS_PREFIX + id, url); } catch {}
  }
}

export function chefFlowMealId(meal: ChefFlowMeal, mealType: string): string {
  if (meal.id) return meal.id;
  const name = (meal.name || meal.meal || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);
  return `cfm-${mealType}-${name}`;
}

export function chefFlowCacheIdentity(meal: ChefFlowMeal, mealType: string): string {
  return chefFlowMealId(meal, mealType) + JSON.stringify([meal.name || meal.meal || "", mealType, meal.ingredients ?? []]);
}

export interface ChefFlowImagesResult {
  imageMap: Record<string, string>;
  failedSet: Set<string>;
}

export function useChefFlowImages(
  meals: ChefFlowMeal[],
  mealType: string,
  options?: { restaurantImageOptimization?: boolean; ownerId?: string },
): ChefFlowImagesResult {
  const ownerId = options?.ownerId;
  const optimized = options?.restaurantImageOptimization === true &&
    mealType === "restaurant" && Boolean(ownerId);
  const cacheIdentity = (meal: ChefFlowMeal) => optimized
    ? restaurantImageContentIdentity(meal, mealType, ownerId!)
    : chefFlowCacheIdentity(meal, mealType);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [failedSet, setFailedSet] = useState<Set<string>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());
  const failedRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const imageIdentityRef = useRef(new Map<string, string>());
  const currentRecipeRef = useRef(new Map<string, string>());
  currentRecipeRef.current = new Map(meals.map(meal => {
    const id = chefFlowMealId(meal, mealType);
    return [id, cacheIdentity(meal)];
  }));

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

      // Priority 1: imageUrl already provided by API response — use immediately
      const cacheId = cacheIdentity(meal);
      if (imageIdentityRef.current.get(id) !== cacheId) {
        imageIdentityRef.current.set(id, cacheId);
        setImageMap(prev => {
          if (!prev[id]) return prev;
          const next = { ...prev }; delete next[id]; return next;
        });
        if (optimized) setFailedSet(prev => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev); next.delete(id); return next;
        });
      }
      if (meal.imageUrl && !isPlaceholderImage(meal.imageUrl)) {
        sessionCache.set(cacheId, meal.imageUrl);
        writeToLS(cacheId, meal.imageUrl);
        setImageMap((prev) =>
          prev[id] === meal.imageUrl ? prev : { ...prev, [id]: meal.imageUrl! },
        );
        return;
      }

      // Priority 2: session cache hit — no network request needed
      if (sessionCache.has(cacheId)) {
        const cached = sessionCache.get(cacheId)!;
        setImageMap((prev) =>
          prev[id] === cached ? prev : { ...prev, [id]: cached },
        );
        return;
      }

      // Priority 2.5: localStorage hit — populate sessionCache and use (survives reload)
      const lsHit = readFromLS(cacheId);
      if (lsHit) {
        sessionCache.set(cacheId, lsHit);
        setImageMap((prev) => prev[id] === lsHit ? prev : { ...prev, [id]: lsHit });
        return;
      }

      // Priority 3: already failed — do not retry
      if (failedRef.current.has(cacheId)) return;

      // Priority 4: already queued or in-flight — do not duplicate
      // Exact recipe requests can have several independent presentation cards.
      // Each card subscribes, while the shared queue performs just one request.
      const requestId = optimized ? JSON.stringify([id, cacheId]) : cacheId;
      if (inFlightRef.current.has(requestId)) return;

      // Mark in-flight immediately to prevent duplicate queuing
      inFlightRef.current.add(requestId);

      // Waits for a concurrency slot before firing the network request.
      // Meals earlier in the array (top of screen) acquire slots first.
      const fire = async () => {
        try {
          const result = await chefFlowImageRequests.request({
            concurrency: optimized ? 6 : 3,
            ...(optimized ? {
              key: cacheId,
              isCurrent: () => mountedRef.current && currentRecipeRef.current.get(id) === cacheId,
            } : {}),
            generate: async () => {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), IMAGE_CLIENT_TIMEOUT_MS);
              try {
                const res = await fetch(apiUrl("/api/meals/generate-image"), {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                  body: JSON.stringify({
                    mealName,
                    mealType,
                    sourceType: mealType === "beverage" || mealType === "drink" ? "beverage" : mealType === "snack" ? "snack" : "meal",
                    ...(meal.ingredients && meal.ingredients.length > 0 ? { ingredients: meal.ingredients } : {}),
                  }),
                  signal: controller.signal,
                });
                const data = await res.json();
                return res.ok ? photographFromResponse(data) : null;
              } finally {
                clearTimeout(timeoutId);
              }
            },
          });
          if (result.status === "skipped") return;
          const photograph = result.photograph;
          if (photograph) {
            sessionCache.set(cacheId, photograph);
            writeToLS(cacheId, photograph);
            if (mountedRef.current && currentRecipeRef.current.get(id) === cacheId) {
              setImageMap((prev) => ({ ...prev, [id]: prev[id] || photograph }));
            }
          } else {
            failedRef.current.add(cacheId);
            if (mountedRef.current && currentRecipeRef.current.get(id) === cacheId) {
              setFailedSet((prev) => new Set([...prev, id]));
            }
          }
        } catch {
          failedRef.current.add(cacheId);
          if (mountedRef.current && currentRecipeRef.current.get(id) === cacheId) {
            setFailedSet((prev) => new Set([...prev, id]));
          }
        } finally {
          inFlightRef.current.delete(requestId);
        }
      };

      fire();
    });
  }, [meals, mealType, optimized, ownerId]);

  return {
    imageMap: optimized ? Object.fromEntries(Object.entries(imageMap).filter(([id]) =>
      imageIdentityRef.current.get(id) === currentRecipeRef.current.get(id),
    )) : imageMap,
    failedSet,
  };
}
