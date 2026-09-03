jest.mock("../resolveApiBase", () => ({
  apiUrl: (path: string) => path,
}));

import fs from "fs";
import path from "path";
import {
  createWaterLog,
  getWaterLogs,
  isWaterHistoryResponseCurrent,
  waterLogsQueryKey,
} from "../waterLogsApi";

const tokenStorage = new Map<string, string>();
const mockFetch = jest.fn();

beforeAll(() => {
  Object.defineProperty(global, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => tokenStorage.get(key) ?? null,
      setItem: (key: string, value: string) => tokenStorage.set(key, value),
      removeItem: (key: string) => tokenStorage.delete(key),
      clear: () => tokenStorage.clear(),
    },
  });
  Object.defineProperty(global, "fetch", {
    configurable: true,
    value: mockFetch,
  });
});

beforeEach(() => {
  tokenStorage.clear();
  tokenStorage.set("mpm_auth_token", "native-water-log-token");
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    headers: { get: () => "application/json" },
    json: async () => ({ items: [] }),
  });
});

describe("water-log authenticated transport", () => {
  it("sends the mobile auth token when reading water logs without a caller-supplied userId", async () => {
    await getWaterLogs({ from: "2026-08-01", to: "2026-08-02", limit: 50 });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/water-logs?from=2026-08-01&to=2026-08-02&limit=50",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "x-auth-token": "native-water-log-token",
        }),
      }),
    );
  });

  it("sends the mobile auth token when creating a water log without a caller-supplied userId", async () => {
    await createWaterLog({ amount: 8, unit: "oz" });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/water-logs",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "x-auth-token": "native-water-log-token",
        }),
        body: JSON.stringify({ amount: 8, unit: "oz" }),
      }),
    );
  });
});

describe("water-log account isolation in the client", () => {
  const range = { from: "2026-08-01", to: "2026-08-02" };

  it("uses distinct React Query cache keys for distinct signed-in accounts", () => {
    expect(waterLogsQueryKey("account-a", range)).not.toEqual(
      waterLogsQueryKey("account-b", range),
    );
  });

  it("rejects a hydration-history response that belongs to the previous account", () => {
    expect(isWaterHistoryResponseCurrent("account-a", "account-b")).toBe(false);
    expect(isWaterHistoryResponseCurrent("account-b", "account-b")).toBe(true);
  });

  it("remounts and clears rendered history when the signed-in account changes", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../pages/my-biometrics.tsx"),
      "utf8",
    );

    expect(source).toMatch(/<WaterLog\s+key=\{user\?\.id \?\? "anonymous"\}/);
    expect(source).toMatch(
      /historyOwnerRef\.current = userId;\s+setWeekHistory\(\[\]\);/,
    );
    expect(source).toMatch(/\}, \[userId\]\);/);
  });
});