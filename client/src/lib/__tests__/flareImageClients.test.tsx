/** @jest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { useChefMealImage } from "@/hooks/useChefMealImage";
import { useChefFlowImages, chefFlowCacheIdentity } from "@/hooks/useChefFlowImages";
import { isPermanentImageUrl, shouldProtectExistingImage } from "@/lib/imageUrlUtils";
import { IMAGE_CLIENT_TIMEOUT_MS, placeholderResult } from "@shared/imageResult";

jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (p: string) => p }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
const originalFetch = global.fetch;
const recipe = { id: "fixture-card", name: "Fixture parfait", ingredients: ["chia", "berries"] };
const response = (data: unknown) => ({ ok: true, json: async () => data });
beforeEach(() => {
  global.fetch = jest.fn() as any;
  Object.defineProperty(global.crypto, "randomUUID", { configurable: true, value: () => "fixture-token" });
  localStorage.clear(); sessionStorage.clear();
});
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

it("does not let placeholder results reach image-persistence callbacks", async () => {
  jest.mocked(fetch).mockResolvedValue(response({ imageUrl: "/images/fallback/meal.svg" }) as any);
  const { result } = renderHook(() => useChefMealImage());
  const ready = jest.fn();
  await act(async () => { await result.current.fetchImageForMeal(recipe, "snack", ready); });
  expect(ready).not.toHaveBeenCalled();
});
it("rejects typed unavailable verification, even if the URL looks permanent", async () => {
  jest.mocked(fetch).mockResolvedValue(response({
    imageUrl: "/public-objects/fixture.png", imageResult: placeholderResult("/public-objects/fixture.png", "verification_unavailable"),
  }) as any);
  const { result } = renderHook(() => useChefMealImage()); const ready = jest.fn();
  await act(async () => { await result.current.fetchImageForMeal(recipe, "snack", ready); });
  expect(ready).not.toHaveBeenCalled();
});
it("preserves older valid URL-only responses and joins a pending request instead of duplicating it", async () => {
  let complete!: (value: any) => void;
  jest.mocked(fetch).mockImplementation(() => new Promise(r => { complete = r; }));
  const { result } = renderHook(() => useChefMealImage()); const ready = jest.fn();
  let first!: Promise<void>;
  await act(async () => {
    first = result.current.fetchImageForMeal(recipe, "snack", ready);
    await result.current.fetchImageForMeal(recipe, "snack", ready);
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => { complete(response({ imageUrl: "/public-objects/old.png" })); await first; });
  expect(ready).toHaveBeenCalledWith(recipe.id, "/public-objects/old.png");
});
it("protects saved photographs and never classifies fallback artwork as permanent", () => {
  expect(isPermanentImageUrl("/images/fallback/meal.svg")).toBe(false);
  expect(shouldProtectExistingImage("/public-objects/original.png", "/images/fallback/meal.svg")).toBe(true);
  expect(shouldProtectExistingImage("/public-objects/original.png", "/public-objects/new.png")).toBe(true);
  expect(shouldProtectExistingImage(null, "/images/fallback/meal.svg")).toBe(true);
});
it("includes the complete recipe ingredients in the Chef session-cache identity", () => {
  expect(chefFlowCacheIdentity(recipe, "snack")).not.toBe(chefFlowCacheIdentity({ ...recipe, ingredients: ["chia", "peanuts"] }, "snack"));
});
it("waits beyond 30 seconds, then records terminal failure at the client deadline without retry", async () => {
  jest.useFakeTimers();
  let signal!: AbortSignal;
  jest.mocked(fetch).mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    signal = init!.signal as AbortSignal;
    signal.addEventListener("abort", () => reject(new Error("fixture abort")));
  }));
  const meals = [{ ...recipe, id: "deadline-fixture" }];
  const { result } = renderHook(() => useChefFlowImages(meals, "snack"));
  await act(async () => { await jest.advanceTimersByTimeAsync(30001); });
  expect(signal.aborted).toBe(false);
  await act(async () => { await jest.advanceTimersByTimeAsync(IMAGE_CLIENT_TIMEOUT_MS - 30000); });
  expect(signal.aborted).toBe(true);
  expect(result.current.failedSet.has("deadline-fixture")).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("viewing an existing photograph performs no generation and cannot overwrite it", async () => {
  const meals = [{ ...recipe, id: "saved-view-fixture", imageUrl: "/public-objects/original.png" }];
  const { result } = renderHook(() => useChefFlowImages(meals, "snack"));
  await act(async () => { await Promise.resolve(); });
  expect(result.current.imageMap["saved-view-fixture"]).toBe("/public-objects/original.png");
  expect(fetch).not.toHaveBeenCalled();
});
