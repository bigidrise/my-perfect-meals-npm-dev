import {
  getOrSet,
  invalidateClientTabletCache,
  setCached,
} from "../services/queryCache";

describe("client tablet cache invalidation", () => {
  it("makes a professional's newly ready message visible on the next client read", async () => {
    const clientId = "client-video-ready";
    const key = `client-tablet:${clientId}`;
    setCached(key, { messages: ["before-send"] }, 60_000);

    invalidateClientTabletCache(clientId);

    const value = await getOrSet(key, 60_000, async () => ({ messages: ["new-ready-video"] }));
    expect(value).toEqual({ messages: ["new-ready-video"] });
  });
});