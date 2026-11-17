/** @jest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { useChefFlowImages, type ChefFlowMeal } from "@/hooks/useChefFlowImages";
import { placeholderResult } from "@shared/imageResult";

jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({ "x-fixture-auth": "offline" }) }));
const originalFetch = global.fetch;
let pending: Array<(response: any) => void>;
const response = (imageUrl: string) => ({ ok: true, json: async () => ({ imageUrl }) });
const meals = (prefix: string, count = 6): ChefFlowMeal[] => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}-${index}`, name: `${prefix} meal ${index}`, ingredients: ["chicken", `vegetable ${index}`],
}));
const options = (ownerId: string) => ({ developmentRestaurantImages: true, ownerId });
const flush = async () => { await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  pending = [];
  global.fetch = jest.fn(() => new Promise(resolve => pending.push(resolve))) as any;
});
afterEach(async () => {
  // Finish only local mocked promises so the global queue cannot leak between
  // cases. No timers, app/database requests or external providers are used.
  for (let pass = 0; pass < 15 && pending.length; pass++) {
    await act(async () => { pending.splice(0).forEach((resolve, i) => resolve(response(`/public-objects/cleanup-${i}.jpg`))); });
  }
  global.fetch = originalFetch;
});

test("Development Find Meals starts all six image requests without a second batch", async () => {
  const input = meals("six");
  renderHook(() => useChefFlowImages(input, "restaurant", options("owner-six")));
  await flush();
  expect(fetch).toHaveBeenCalledTimes(6);
  for (const [url, init] of jest.mocked(fetch).mock.calls) {
    expect(url).toBe("/api/meals/generate-image");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(JSON.parse(init!.body as string)).toMatchObject({ sourceType: "meal", mealType: "restaurant" });
  }
});

test("Production/default callers retain the original three-request limit", async () => {
  const input = meals("default");
  renderHook(() => useChefFlowImages(input, "restaurant"));
  await flush();
  expect(fetch).toHaveBeenCalledTimes(3);
});

test.each(["snack", "beverage"])("other surfaces do not get the restaurant burst: %s", async mealType => {
  const input = meals(mealType);
  renderHook(() => useChefFlowImages(input, mealType, options(`owner-${mealType}`)));
  await flush();
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("a missing account fails closed to the standard scheduler", async () => {
  const input = meals("missing-owner");
  renderHook(() => useChefFlowImages(input, "restaurant", { developmentRestaurantImages: true }));
  await flush();
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("identical recipes in different restaurant cards share one request and update both cards", async () => {
  const ingredients = Array.from({ length: 14 }, (_, index) => `ingredient ${index}`);
  const input = [{ id: "restaurant-one", name: "Exact soup", ingredients }, { id: "restaurant-two", name: "Exact soup", ingredients }];
  const { result } = renderHook(() => useChefFlowImages(input, "restaurant", options("owner-shared")));
  await flush();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(jest.mocked(fetch).mock.calls[0][1]!.body as string).ingredients).toEqual(ingredients);
  await act(async () => { pending.shift()!(response("/public-objects/shared.jpg")); });
  expect(result.current.imageMap["restaurant-one"]).toBe("/public-objects/shared.jpg");
  expect(result.current.imageMap["restaurant-two"]).toBe("/public-objects/shared.jpg");
});

test("exact recipe reuse survives a changed restaurant card ID without a new generation", async () => {
  const recipe = { id: "reuse-one", name: "Reuse soup", ingredients: ["broccoli", "beans"] };
  const { result, rerender } = renderHook(({ input }) => useChefFlowImages(input, "restaurant", options("owner-reuse")), {
    initialProps: { input: [recipe] },
  });
  await act(async () => { pending.shift()!(response("/public-objects/reuse.jpg")); });
  rerender({ input: [{ ...recipe, id: "reuse-two" }] });
  await flush();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(result.current.imageMap["reuse-two"]).toBe("/public-objects/reuse.jpg");
});

test("changed ingredients cannot reuse a prior image or accept its late response", async () => {
  const recipe = { id: "change-card", name: "Changing soup", ingredients: ["beans"] };
  const { result, rerender } = renderHook(({ input }) => useChefFlowImages(input, "restaurant", options("owner-change")), {
    initialProps: { input: [recipe] },
  });
  const old = pending.shift()!;
  rerender({ input: [{ ...recipe, ingredients: ["beans", "broccoli"] }] });
  await flush();
  expect(fetch).toHaveBeenCalledTimes(2);
  await act(async () => { pending.shift()!(response("/public-objects/new-recipe.jpg")); });
  await act(async () => { old(response("/public-objects/old-recipe.jpg")); });
  expect(result.current.imageMap["change-card"]).toBe("/public-objects/new-recipe.jpg");
});

test("account switching cannot share requests, cache entries or late image responses", async () => {
  const input = meals("account", 1);
  const { result, rerender } = renderHook(({ owner }) => useChefFlowImages(input, "restaurant", options(owner)), {
    initialProps: { owner: "owner-a" },
  });
  const old = pending.shift()!;
  rerender({ owner: "owner-b" });
  await flush();
  expect(fetch).toHaveBeenCalledTimes(2);
  await act(async () => { old(response("/public-objects/account-a.jpg")); });
  expect(result.current.imageMap[input[0].id!]).toBeUndefined();
  await act(async () => { pending.shift()!(response("/public-objects/account-b.jpg")); });
  expect(result.current.imageMap[input[0].id!]).toBe("/public-objects/account-b.jpg");
});

test("leaving results skips queued image work instead of making another paid request", async () => {
  const input = meals("obsolete", 7);
  const { unmount } = renderHook(() => useChefFlowImages(input, "restaurant", options("owner-obsolete")));
  await flush();
  expect(fetch).toHaveBeenCalledTimes(6);
  unmount();
  await act(async () => { pending.splice(0).forEach(resolve => resolve(response("/public-objects/finished.jpg"))); });
  expect(fetch).toHaveBeenCalledTimes(6);
});

test("typed validation failures remain failures even with a permanent-looking URL", async () => {
  const input = meals("invalid", 1);
  const { result } = renderHook(() => useChefFlowImages(input, "restaurant", options("owner-invalid")));
  await act(async () => { pending.shift()!({
    ok: true, json: async () => ({
      imageUrl: "/public-objects/not-verified.jpg",
      imageResult: placeholderResult("/images/fallback/meal.svg", "verification_unavailable"),
    }),
  }); });
  expect(result.current.imageMap[input[0].id!]).toBeUndefined();
  expect(result.current.failedSet.has(input[0].id!)).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});
