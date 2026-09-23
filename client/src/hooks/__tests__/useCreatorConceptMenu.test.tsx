/** @jest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { useCreatorConceptMenu } from "../useCreatorConceptMenu";

jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));

const choices = {
  servings: 3,
  cuisine: { mode: "explicit" as const, value: "italian" },
  eatingStyle: { mode: "explicit" as const, value: "vegan" },
};
const concepts = (prefix: string) => [1, 2, 3].map((n) => ({
  id: `${prefix}-${n}`, title: `${prefix} idea ${n}`,
}));
const response = (payload: unknown, status = 200) => ({
  ok: status < 400, status, json: async () => payload,
});
const cacheKey = "oneTouch.conceptChoices.create_a_dish.owner-1.v1";

describe("Creator concept client boundary", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
    Object.defineProperty(global, "fetch", {
      configurable: true, writable: true, value: jest.fn(),
    });
  });

  it("keeps only request choices in browser storage and sends the selected server ID", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(response({ concepts: concepts("first") }) as any)
      .mockResolvedValueOnce(response({ meal: { name: "Finished idea" } }) as any);
    const { result } = renderHook(() => useCreatorConceptMenu("create_a_dish", "owner-1"));
    await act(async () => { await result.current.generate(choices); });
    expect(result.current.concepts).toHaveLength(3);
    expect(JSON.parse(localStorage.getItem(cacheKey)!)).toEqual(choices);
    expect(localStorage.getItem(cacheKey)).not.toContain("first idea");
    let selected: unknown;
    await act(async () => { selected = await result.current.choose("first-2"); });
    expect(selected).toEqual({ name: "Finished idea" });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/one-touch-create/choose");
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({
      request: { creator: "create_a_dish", ...choices }, conceptId: "first-2",
    });
  });

  it("ignores a late restoration once a new three-idea set has been generated", async () => {
    localStorage.setItem(cacheKey, JSON.stringify(choices));
    let settleRestore!: (value: any) => void;
    const restore = new Promise<any>((resolve) => { settleRestore = resolve; });
    jest.spyOn(global, "fetch")
      .mockImplementationOnce(() => restore)
      .mockResolvedValueOnce(response({ concepts: concepts("new") }) as any);
    const { result } = renderHook(() => useCreatorConceptMenu("create_a_dish", "owner-1"));
    await waitFor(() => expect(result.current.restoring).toBe(true));
    await act(async () => { await result.current.generate(choices); });
    await act(async () => { settleRestore(response({ concepts: concepts("old") })); await restore; });
    expect(result.current.concepts.map((concept) => concept.title)).toEqual([
      "new idea 1", "new idea 2", "new idea 3",
    ]);
  });

  it("discards concepts on account change and on a stale-authority response", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(response({ concepts: concepts("first") }) as any)
      .mockResolvedValueOnce(response({ code: "ONE_TOUCH_CONTEXT_UNRESOLVED", error: "Changed." }, 409) as any);
    const { result, rerender } = renderHook(
      ({ ownerId }) => useCreatorConceptMenu("create_a_dish", ownerId),
      { initialProps: { ownerId: "owner-1" } },
    );
    await act(async () => { await result.current.generate(choices); });
    await act(async () => {
      await expect(result.current.choose("first-1")).rejects.toThrow("Changed.");
    });
    expect(result.current.concepts).toEqual([]);
    expect(localStorage.getItem(cacheKey)).toBeNull();
    await act(async () => { rerender({ ownerId: "owner-2" }); });
    expect(result.current.concepts).toEqual([]);
  });

  it("does not restore ideas from the old completed-card marker", async () => {
    localStorage.setItem("oneTouch.completedBatch.create_a_dish.v2", JSON.stringify({
      ownerId: "owner-1", names: ["Previously finished meal"],
    }));
    const fetchMock = jest.spyOn(global, "fetch");
    const { result } = renderHook(() => useCreatorConceptMenu("create_a_dish", "owner-1"));
    expect(result.current.concepts).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});