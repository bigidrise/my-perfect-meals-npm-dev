/** @jest-environment jsdom */
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
import { mealMacroSnapshot, creatorMealNutrition } from "@/lib/mealMacroSnapshot";
import { setQuickView, getQuickView } from "@/lib/macrosQuickView";
import { logMacros } from "@/lib/logMacros";

it("keeps Grocery Coach, saved nutrition, and the Biometrics handoff on the same one-serving basis", async () => {
  const nutrition = { calories: 2040, protein: 225, carbs: 180, fat: 36, starchyCarbs: 144, fibrousCarbs: 36 };
  const coach = mealMacroSnapshot({ macros: nutrition, servingCount: 3 });
  const favorite = mealMacroSnapshot({ nutrition, servings: 3 });
  expect(coach).toEqual(favorite);
  expect(favorite).toMatchObject({ calories: 680, protein: 75, carbs: 60, starchyCarbs: 48, fibrousCarbs: 12, fat: 12 });
  setQuickView({ ...favorite, dateISO: "2026-10-08", source: "saved_meal" });
  expect(getQuickView()).toMatchObject(favorite);
  const fetchMock = jest.fn().mockResolvedValue({ ok: true });
  global.fetch = fetchMock;
  await logMacros({ ...favorite, carbohydrates: favorite.carbs, source: "saved_meal" });
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body).toMatchObject({ kcal: 680, carbs: 60, starchyCarbs: 48, fibrousCarbs: 12, fiber: null });
});
it("prefers canonical zeros over stale top-level values and keeps missing categories unknown", () => {
  expect(mealMacroSnapshot({ nutrition: { carbs: 20, starchyCarbs: 0, fibrousCarbs: 0 }, starchyCarbs: 20, fibrousCarbs: 20 }))
    .toMatchObject({ starchyCarbs: 0, fibrousCarbs: 0 });
  expect(mealMacroSnapshot({ nutrition: { carbs: 20 } })).toMatchObject({ carbs: 20, starchyCarbs: null, fibrousCarbs: null });
  expect(mealMacroSnapshot({ nutrition: { carbs: 20, starchyCarbs: null, fibrousCarbs: null }, starchyCarbs: 20, fibrousCarbs: 0 }))
    .toMatchObject({ starchyCarbs: null, fibrousCarbs: null });
});
it("propagates server rejection so the caller can keep the entry available for retry", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "Unavailable" });
  await expect(logMacros({ calories: 100, protein: 10, carbohydrates: 10, fat: 2, fibrousCarbs: 3, source: "saved_meal" })).rejects.toThrow("Macro log failed");
});
it.each([1, 2, 3, 4, 5, 6])("Creator and Favorites handoffs acknowledge one serving of a %i-serving recipe", servings => {
  const recipe = {
    servings,
    ingredients: [{ name: "chicken", quantity: servings * 150, unit: "g" }],
    nutrition: { calories: servings * 500, protein: servings * 45, carbs: servings * 30, fat: servings * 15, starchyCarbs: servings * 20, fibrousCarbs: servings * 10 },
  };
  const before = JSON.stringify(recipe);
  const snapshot = creatorMealNutrition(recipe);
  expect(snapshot).toMatchObject({ calories: 500, protein_g: 45, carbs_g: 30, fat_g: 15, starchyCarbs: 20, fibrousCarbs: 10, servings });
  expect(mealMacroSnapshot(JSON.parse(JSON.stringify(recipe)))).toMatchObject({
    calories: 500, protein: 45, carbs: 30, fat: 15, starchyCarbs: 20, fibrousCarbs: 10,
  });
  setQuickView({ ...snapshot, source: "craving-creator", dateISO: "2026-10-08" });
  expect(getQuickView()).toMatchObject({ calories: 500, protein: 45, carbs: 30, fat: 15 });
  expect(JSON.stringify(recipe)).toBe(before);
});
it("handles Fridge Rescue flat totals and dessert batch slices without multiplying or dividing twice", () => {
  expect(creatorMealNutrition({ calories: 1800, protein: 120, carbs: 90, fat: 60 }, 3))
    .toMatchObject({ calories: 600, protein: 40, carbs: 30, fat: 20 });
  expect(creatorMealNutrition({ totalSlices: 6, nutrition: { calories: 1200, protein: 30, carbs: 90, fat: 60 } }))
    .toMatchObject({ calories: 200, protein: 5, carbs: 15, fat: 10 });
  const oneServing = creatorMealNutrition({ servings: 4, protein: 160, carbs: 80, fat: 40, calories: 1320 });
  expect(mealMacroSnapshot({ ...oneServing, servings: 1 })).toMatchObject({
    protein: 40, carbs: 20, fat: 10, calories: 330,
  });
});
