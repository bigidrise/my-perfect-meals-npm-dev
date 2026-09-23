/** @jest-environment jsdom */

import {
  cachedOneTouchNamesForMeal, clearOneTouchBatch, isCachedOneTouchBatch, loadOneTouchBatch,
  requestOneTouchMeals, restoreOneTouchBatch, saveOneTouchBatch,
} from "@/lib/oneTouchCreate";
jest.mock("@/lib/oneTouchAvailability", () => ({ ONE_TOUCH_CREATE_ENABLED: true }));

describe("One-Touch client request contract", () => {
  const fingerprint = "a".repeat(43);
  const choices = {
    servings: 4,
    cuisine: { mode: "surprise" as const },
    eatingStyle: { mode: "explicit" as const, value: "vegan" },
  };
  const names = ["Lentil Skillet", "Stuffed Peppers", "Herb Flatbread"];
  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it("restores the previous choices only for the same account and completed three-card set", () => {
    saveOneTouchBatch("create_a_dish", "owner-1", choices, names, fingerprint);
    expect(isCachedOneTouchBatch("create_a_dish", names)).toBe(true);
    expect(cachedOneTouchNamesForMeal("create_a_dish", names[0])).toEqual(names);
    expect(cachedOneTouchNamesForMeal("create_a_dish", "Manual Meal")).toBeNull();
    expect(loadOneTouchBatch("create_a_dish", "owner-1", names)).toEqual({ choices, contextFingerprint: fingerprint });
    expect(loadOneTouchBatch("create_a_dish", "other-owner", names)).toBeNull();
    expect(loadOneTouchBatch("craving_creator", "owner-1", names)).toBeNull();
    expect(loadOneTouchBatch("create_a_dish", "owner-1", ["Manual Meal", ...names.slice(1)])).toBeNull();
    expect(loadOneTouchBatch("create_a_dish", "owner-1", names.slice(0, 2))).toBeNull();
    clearOneTouchBatch("create_a_dish");
    expect(isCachedOneTouchBatch("create_a_dish", names)).toBe(false);
  });

  it("keeps cards across navigation only while the authenticated authority matches", async () => {
    saveOneTouchBatch("craving_creator", "owner-1", choices, names, fingerprint);
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ contextFingerprint: fingerprint }),
    });
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchMock });
    expect(await restoreOneTouchBatch("craving_creator", "owner-1", names)).toEqual(choices);
    expect(await restoreOneTouchBatch("craving_creator", "owner-1", names)).toEqual(choices);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/one-touch-create/context-fingerprint"),
      expect.objectContaining({
        credentials: "include",
        body: JSON.stringify({ creator: "craving_creator", ...choices }),
      }),
    );
    expect(await restoreOneTouchBatch("craving_creator", "owner-2", names)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ contextFingerprint: "b".repeat(43) }) });
    expect(await restoreOneTouchBatch("craving_creator", "owner-1", names)).toBeNull();
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    expect(await restoreOneTouchBatch("craving_creator", "owner-1", names)).toBeNull();
  });

  it("fails closed on legacy records without a fingerprint and unavailable authority", async () => {
    localStorage.setItem("oneTouch.completedBatch.create_a_dish.v1", JSON.stringify({ ownerId: "owner-1", choices, names }));
    expect(isCachedOneTouchBatch("create_a_dish", names)).toBe(true);
    expect(await restoreOneTouchBatch("create_a_dish", "owner-1", names)).toBeNull();
    saveOneTouchBatch("create_a_dish", "owner-1", choices, names, fingerprint);
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: jest.fn().mockRejectedValue(new Error("offline")),
    });
    expect(await restoreOneTouchBatch("create_a_dish", "owner-1", names)).toBeNull();
  });

  it("sends request-scoped controls and requires exactly three meals", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ meals: [{ id: "1" }, { id: "2" }, { id: "3" }], contextFingerprint: fingerprint }),
    });
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchMock });
    const result = await requestOneTouchMeals({
      creator: "create_a_dish",
      servings: 4,
      cuisine: { mode: "explicit", value: "chinese" },
      eatingStyle: { mode: "profile" },
    });

    expect(result.meals).toHaveLength(3);
    expect(result.contextFingerprint).toBe(fingerprint);
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