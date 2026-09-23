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
export type OneTouchCravingType = "surprise" | "food" | "dessert";
export type OneTouchCravingFeel = "surprise" | "salty" | "sweet" | "light" | "hearty";

export interface OneTouchRequest {
  creator: OneTouchCreator;
  servings: number;
  cuisine: OneTouchCuisine;
  eatingStyle: OneTouchEatingStyle;
  cravingType?: OneTouchCravingType;
  cravingFeel?: OneTouchCravingFeel;
}

type OneTouchChoices = Omit<OneTouchRequest, "creator">;
export interface OneTouchCompletedBatch {
  choices: OneTouchChoices;
  contextFingerprint: string;
}

function batchKey(creator: OneTouchCreator) {
  return `oneTouch.completedBatch.${creator}.v2`;
}
function legacyBatchKey(creator: OneTouchCreator) {
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
    localStorage.removeItem(legacyBatchKey(creator));
  } catch {}
}

function validFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** Detect the exact cached set before rendering it, including old records without a stamp. */
export function isCachedOneTouchBatch(creator: OneTouchCreator, names: string[]): boolean {
  if (names.length !== 3) return false;
  return [batchKey(creator), legacyBatchKey(creator)]
    .some((key) => matchesBatchNames(readStoredBatch(key), names));
}

function readStoredBatch(key: string): any {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function matchesBatchNames(batch: any, names: string[]): boolean {
  return Array.isArray(batch?.names) &&
    JSON.stringify(batch.names) === JSON.stringify(names);
}

/** A picked card may survive even if the separate three-option cache is missing. */
export function cachedOneTouchNamesForMeal(creator: OneTouchCreator, mealName: string | undefined): string[] | null {
  if (!mealName) return null;
  // Prefer an older marker when both identify a picked card: only a fresh
  // authenticated v2 batch may restore it, never the old name-only record.
  for (const key of [legacyBatchKey(creator), batchKey(creator)]) {
    const value = readStoredBatch(key);
    if (Array.isArray(value?.names) && value.names.length === 3 &&
        value.names.every((name: unknown) => typeof name === "string") &&
        value.names.includes(mealName)) return value.names;
  }
  return null;
}

export function clearOneTouchBatch(creator: OneTouchCreator): void {
  try {
    localStorage.removeItem(batchKey(creator));
    localStorage.removeItem(legacyBatchKey(creator));
  } catch {}
}

export function loadOneTouchBatch(
  creator: OneTouchCreator,
  ownerId: string | undefined,
  names: string[],
): OneTouchCompletedBatch | null {
  if (!ownerId || names.length !== 3) return null;
  try {
    const value = readStoredBatch(batchKey(creator));
    if (matchesBatchNames(readStoredBatch(legacyBatchKey(creator)), names)) return null;
    if (value?.ownerId !== ownerId || JSON.stringify(value.names) !== JSON.stringify(names) ||
      !validFingerprint(value.contextFingerprint)) return null;
    const choices = value.choices;
    if (!Number.isInteger(choices?.servings) || choices.servings < 1 || choices.servings > 10 ||
      !["profile", "surprise", "explicit"].includes(choices.cuisine?.mode) ||
      !["profile", "explicit"].includes(choices.eatingStyle?.mode) ||
      (creator === "craving_creator" && (
        !["surprise", "food", "dessert"].includes(choices.cravingType) ||
        !["surprise", "salty", "sweet", "light", "hearty"].includes(choices.cravingFeel)
      )) ||
      (creator === "create_a_dish" && (choices.cravingType || choices.cravingFeel)) ||
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