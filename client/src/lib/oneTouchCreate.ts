import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

// Do not expose entry points until the canonical Creator path can honor all
// request-scoped dietary choices without weakening manual Creator authority.
export const ONE_TOUCH_CREATE_ENABLED = false;

export type OneTouchCreator = "create_a_dish" | "craving_creator";
export type OneTouchCuisine =
  | { mode: "profile" }
  | { mode: "surprise" }
  | { mode: "explicit"; value: string };
export type OneTouchEatingStyle =
  | { mode: "profile" }
  | { mode: "explicit"; value: string };

export interface OneTouchRequest {
  creator: OneTouchCreator;
  servings: number;
  cuisine: OneTouchCuisine;
  eatingStyle: OneTouchEatingStyle;
}

export async function requestOneTouchMeals<T>(
  request: OneTouchRequest,
  signal?: AbortSignal,
): Promise<T[]> {
  const response = await fetch(apiUrl("/api/one-touch-create"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(request),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || "We couldn't finish creating three ideas. Please try again.");
  }
  if (!Array.isArray(payload.meals) || payload.meals.length !== 3) {
    throw new Error("We couldn't finish creating three ideas. Please try again.");
  }
  return payload.meals as T[];
}