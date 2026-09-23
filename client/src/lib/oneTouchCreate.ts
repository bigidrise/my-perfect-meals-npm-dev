import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
export { ONE_TOUCH_CREATE_ENABLED } from "./oneTouchAvailability";

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

type OneTouchChoices = Omit<OneTouchRequest, "creator">;

function batchKey(creator: OneTouchCreator) {
  return `oneTouch.completedBatch.${creator}.v1`;
}

/** Keeps the last successful batch's request choices beside the existing card cache. */
export function saveOneTouchBatch(
  creator: OneTouchCreator,
  ownerId: string | undefined,
  choices: OneTouchChoices,
  names: string[],
): void {
  if (!ownerId || names.length !== 3) return;
  try {
    localStorage.setItem(batchKey(creator), JSON.stringify({ ownerId, choices, names }));
  } catch {}
}

export function loadOneTouchBatch(
  creator: OneTouchCreator,
  ownerId: string | undefined,
  names: string[],
): OneTouchChoices | null {
  if (!ownerId || names.length !== 3) return null;
  try {
    const value = JSON.parse(localStorage.getItem(batchKey(creator)) || "null");
    if (value?.ownerId !== ownerId || JSON.stringify(value.names) !== JSON.stringify(names)) return null;
    const choices = value.choices;
    if (!Number.isInteger(choices?.servings) || choices.servings < 1 || choices.servings > 10 ||
      !["profile", "surprise", "explicit"].includes(choices.cuisine?.mode) ||
      !["profile", "explicit"].includes(choices.eatingStyle?.mode) ||
      (choices.cuisine.mode === "explicit" && typeof choices.cuisine.value !== "string") ||
      (choices.eatingStyle.mode === "explicit" && typeof choices.eatingStyle.value !== "string")) return null;
    return choices as OneTouchChoices;
  } catch {
    return null;
  }
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