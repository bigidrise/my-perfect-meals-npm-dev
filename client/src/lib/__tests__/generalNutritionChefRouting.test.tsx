/** @jest-environment jsdom */
import fs from "node:fs";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useCreateWithChefRequest, type DietType } from "@/hooks/useCreateWithChefRequest";

jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/lib/authRequired", () => ({
  handleDefinitiveAuthFailure: () => false, SESSION_EXPIRED_MESSAGE: "Session expired",
}));
const mockFetch = jest.fn();
const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = mockFetch;
  mockFetch.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, meals: [{
      id: "synthetic-meal", name: "Vegetable Soup", ingredients: [], calories: 300,
    }] }),
  });
});
afterEach(() => { cleanup(); global.fetch = originalFetch; });

test("General Nutrition explicitly supplies its supported identity to the existing modal", () => {
  const page = fs.readFileSync("client/src/pages/pro/GeneralNutritionBuilder.tsx", "utf8");
  const modal = page.match(/<CreateWithChefModal\b[\s\S]*?\/>/)?.[0];
  expect(modal).toBeDefined();
  expect(modal).toContain('dietType="general-nutrition"');
  const component = fs.readFileSync("client/src/components/CreateWithChefModal.tsx", "utf8");
  expect(component).toMatch(/generateMeal\(\s*mealDescription,\s*mealType,\s*dietType,/);
});

test.each<DietType>(["general-nutrition", "glp1"])(
  "the real request hook serializes explicit %s without changing safety or subject context",
  async dietType => {
    const { result } = renderHook(() => useCreateWithChefRequest("synthetic-actor", "synthetic-client"));
    await act(async () => {
      await result.current.generateMeal("Vegetable soup", "lunch", dietType);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/meals/generate");
    expect(JSON.parse(options.body)).toMatchObject({
      type: "create-with-chef", dietType, safetyMode: "STRICT",
      proClientId: "synthetic-client", input: "Vegetable soup", mealType: "lunch",
    });
    expect(result.current.error).toBeNull();
  },
);
