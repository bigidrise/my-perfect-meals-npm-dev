/** @jest-environment jsdom */

import { loadOneTouchBatch, requestOneTouchMeals, saveOneTouchBatch } from "@/lib/oneTouchCreate";
jest.mock("@/lib/oneTouchAvailability", () => ({ ONE_TOUCH_CREATE_ENABLED: true }));

describe("One-Touch client request contract", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it("restores the previous choices only for the same account and completed three-card set", () => {
    const choices = {
      servings: 4,
      cuisine: { mode: "surprise" as const },
      eatingStyle: { mode: "explicit" as const, value: "vegan" },
    };
    const names = ["Lentil Skillet", "Stuffed Peppers", "Herb Flatbread"];
    saveOneTouchBatch("create_a_dish", "owner-1", choices, names);
    expect(loadOneTouchBatch("create_a_dish", "owner-1", names)).toEqual(choices);
    expect(loadOneTouchBatch("create_a_dish", "other-owner", names)).toBeNull();
    expect(loadOneTouchBatch("craving_creator", "owner-1", names)).toBeNull();
    expect(loadOneTouchBatch("create_a_dish", "owner-1", ["Manual Meal", ...names.slice(1)])).toBeNull();
    expect(loadOneTouchBatch("create_a_dish", "owner-1", names.slice(0, 2))).toBeNull();
  });

  it("sends request-scoped controls and requires exactly three meals", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ meals: [{ id: "1" }, { id: "2" }, { id: "3" }] }),
    });
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchMock });
    const result = await requestOneTouchMeals({
      creator: "create_a_dish",
      servings: 4,
      cuisine: { mode: "explicit", value: "chinese" },
      eatingStyle: { mode: "profile" },
    });

    expect(result).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/one-touch-create"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          creator: "create_a_dish",
          servings: 4,
          cuisine: { mode: "explicit", value: "chinese" },
          eatingStyle: { mode: "profile" },
        }),
      }),
    );
  });

  it("rejects a partial response without allowing the page to replace cards", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ meals: [{ id: "1" }, { id: "2" }] }),
    });
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchMock });

    await expect(requestOneTouchMeals({
      creator: "craving_creator",
      servings: 1,
      cuisine: { mode: "surprise" },
      eatingStyle: { mode: "profile" },
    })).rejects.toThrow("three ideas");
  });
});