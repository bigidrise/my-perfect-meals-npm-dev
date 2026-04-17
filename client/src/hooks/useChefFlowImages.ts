import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

export interface ChefFlowMeal {
  id?: string;
  name?: string;
  meal?: string;
  imageUrl?: string;
}

// Module-level session cache — survives navigation
const sessionCache = new Map<string, string>();

// Module-level concurrency control — max 3 image requests at once globally
// so the first visible cards get images before below-the-fold ones even start
const MAX_CONCURRENT = 3;
let globalInFlight = 0;
const globalQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (globalInFlight < MAX_CONCURRENT) {
      globalInFlight++;
      resolve();
    } else {
      globalQueue.push(() => {
        globalInFlight++;
        resolve();
      });
    }
  });
}

function releaseSlot(): void {
  globalInFlight--;
  const next = globalQueue.shift();
  if (next) next();
}

export function chefFlowMealId(meal: ChefFlowMeal, mealType: string): string {
  if (meal.id) return meal.id;
  const name = (meal.name || meal.meal || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);
  return `cfm-${mealType}-${name}`;
}

export interface ChefFlowImagesResult {
  imageMap: Record<string, string>;
  failedSet: Set<string>;
}

export function useChefFlowImages(
  meals: ChefFlowMeal[],
  mealType: string,
): ChefFlowImagesResult {
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [failedSet, setFailedSet] = useState<Set<string>>(new Set());
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

      // Priority 1: imageUrl already provided by API response — use immediately
      if (meal.imageUrl) {
        sessionCache.set(id, meal.imageUrl);
        setImageMap((prev) =>
          prev[id] === meal.imageUrl ? prev : { ...prev, [id]: meal.imageUrl! },
        );
        return;
      }

      // Priority 2: session cache hit — no network request needed
      if (sessionCache.has(id)) {
        const cached = sessionCache.get(id)!;
        setImageMap((prev) =>
          prev[id] === cached ? prev : { ...prev, [id]: cached },
        );
        return;
      }

      // Priority 3: already failed — do not retry
      if (failedRef.current.has(id)) return;

      // Priority 4: already queued or in-flight — do not duplicate
      if (inFlightRef.current.has(id)) return;

      // Mark in-flight immediately to prevent duplicate queuing
      inFlightRef.current.add(id);

      // Waits for a concurrency slot before firing the network request.
      // Meals earlier in the array (top of screen) acquire slots first.
      const fire = async () => {
        await acquireSlot();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
          const res = await fetch(apiUrl("/api/meals/generate-image"), {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ mealName, mealType }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          const data = await res.json();
          inFlightRef.current.delete(id);
          releaseSlot();

          if (data.imageUrl) {
            sessionCache.set(id, data.imageUrl);
            if (mountedRef.current) {
              setImageMap((prev) => ({ ...prev, [id]: data.imageUrl }));
            }
          } else {
            failedRef.current.add(id);
            if (mountedRef.current) {
              setFailedSet((prev) => new Set([...prev, id]));
            }
          }
        } catch {
          clearTimeout(timeoutId);
          inFlightRef.current.delete(id);
          releaseSlot();
          failedRef.current.add(id);
          if (mountedRef.current) {
            setFailedSet((prev) => new Set([...prev, id]));
          }
        }
      };

      fire();
    });
  }, [meals, mealType]);

  return { imageMap, failedSet };
}
