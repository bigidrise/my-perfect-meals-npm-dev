/** @jest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (url: string) => url }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
import { useMealImages } from "../useMealImages";

const recipe: { id: string; name: string; ingredients: string[]; imageUrl?: string } =
  { id: "offline-recipe", name: "Turkey stew", ingredients: ["turkey", "carrots"] };
beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn(async () => ({
    ok: true, json: async () => ({ imageUrl: "/public-objects/fixture/meal-images/original.jpg" }),
  })) as any;
});
function useImages() {
  const [meals, setMeals] = useState([recipe]);
  return { meals, ...useMealImages(setMeals) };
}
test("restored cards explicitly request a read-only lookup", async () => {
  const { result } = renderHook(useImages);
  await act(async () => result.current.hydrateImages([recipe]));
  expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).generationIntent).toBe("restore");
});
test("only the new-generation caller supplies initial intent", async () => {
  const { result } = renderHook(useImages);
  await act(async () => result.current.hydrateImages([recipe], { initialGeneration: true }));
  expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).generationIntent).toBe("initial");
});
test("cards with a stored reference do not request generation or lookup", async () => {
  const { result } = renderHook(useImages);
  await act(async () => result.current.hydrateImages([{
    ...recipe, imageUrl: "/public-objects/fixture/meal-images/original.jpg",
  }]));
  expect(fetch).not.toHaveBeenCalled();
});
