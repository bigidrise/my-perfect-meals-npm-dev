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
export interface OneTouchCompletedBatch {
  choices: OneTouchChoices;
  contextFingerprint: string;
}

function batchKey(creator: OneTouchCreator) {
  return `oneTouch.completedBatch.${creator}.v1`;
}

/** Keeps the last successful batch's request choices beside the existing card cache. */
export function saveOneTouchBatch(
  creator: OneTouchCreator,
  ownerId: string | undefined,
  choices: OneTouchChoices,
  names: string[],
  contextFingerprint: string,
): void {
  if (!ownerId || names.length !== 3 || !validFingerprint(contextFingerprint)) return;
  try {
    localStorage.setItem(batchKey(creator), JSON.stringify({ ownerId, choices, names, contextFingerprint }));
  } catch {}
}

function validFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** Detect the exact cached set before rendering it, including old records without a stamp. */
export function isCachedOneTouchBatch(creator: OneTouchCreator, names: string[]): boolean {
  if (names.length !== 3) return false;
  try {
    const value = JSON.parse(localStorage.getItem(batchKey(creator)) || "null");
    return JSON.stringify(value?.names) === JSON.stringify(names);
  } catch {
    return false;
  }
}

/** A picked card may survive even if the separate three-option cache is missing. */
export function cachedOneTouchNamesForMeal(creator: OneTouchCreator, mealName: string | undefined): string[] | null {
  if (!mealName) return null;
  try {
    const value = JSON.parse(localStorage.getItem(batchKey(creator)) || "null");
    return Array.isArray(value?.names) && value.names.length === 3 &&
      value.names.every((name: unknown) => typeof name === "string") &&
      value.names.includes(mealName) ? value.names : null;
  } catch {
    return null;
  }
}

export function clearOneTouchBatch(creator: OneTouchCreator): void {
  try { localStorage.removeItem(batchKey(creator)); } catch {}
}

export function loadOneTouchBatch(
  creator: OneTouchCreator,
  ownerId: string | undefined,
  names: string[],
): OneTouchCompletedBatch | null {
  if (!ownerId || names.length !== 3) return null;
  try {
    const value = JSON.parse(localStorage.getItem(batchKey(creator)) || "null");
    if (value?.ownerId !== ownerId || JSON.stringify(value.names) !== JSON.stringify(names) ||
      !validFingerprint(value.contextFingerprint)) return null;
    const choices = value.choices;
    if (!Number.isInteger(choices?.servings) || choices.servings < 1 || choices.servings > 10 ||
      !["profile", "surprise", "explicit"].includes(choices.cuisine?.mode) ||
      !["profile", "explicit"].includes(choices.eatingStyle?.mode) ||
      (choices.cuisine.mode === "explicit" && typeof choices.cuisine.value !== "string") ||
      (choices.eatingStyle.mode === "explicit" && typeof choices.eatingStyle.value !== "string")) return null;
    return { choices: choices as OneTouchChoices, contextFingerprint: value.contextFingerprint };
  } catch {
    return null;
  }
}

export async function requestOneTouchFingerprint(request: OneTouchRequest, signal?: AbortSignal): Promise<string> {
  const response = await fetch(apiUrl("/api/one-touch-create/context-fingerprint"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) throw new Error("Your current food protections could not be verified.");
  const payload = await response.json();
  if (!validFingerprint(payload?.contextFingerprint)) throw new Error("Invalid food context fingerprint.");
  return payload.contextFingerprint;
}

/** The browser cache is hidden until this fresh, authenticated check succeeds. */
export async function restoreOneTouchBatch(
  creator: OneTouchCreator,
  ownerId: string,
  names: string[],
  signal?: AbortSignal,
): Promise<OneTouchChoices | null> {
  const cached = loadOneTouchBatch(creator, ownerId, names);
  if (!cached) return null;
  try {
    const current = await requestOneTouchFingerprint({ creator, ...cached.choices }, signal);
    return current === cached.contextFingerprint ? cached.choices : null;
  } catch {
    return null;
  }
}

export async function requestOneTouchMeals<T>(
  request: OneTouchRequest,
  signal?: AbortSignal,
): Promise<{ meals: T[]; contextFingerprint: string }> {
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
  if (!Array.isArray(payload.meals) || payload.meals.length !== 3 ||
    !validFingerprint(payload.contextFingerprint)) {
    throw new Error("We couldn't finish creating three ideas. Please try again.");
  }
  return { meals: payload.meals as T[], contextFingerprint: payload.contextFingerprint };
}