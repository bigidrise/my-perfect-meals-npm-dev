/** @jest-environment jsdom */
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
import { mealMacroSnapshot } from "@/lib/mealMacroSnapshot";
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
