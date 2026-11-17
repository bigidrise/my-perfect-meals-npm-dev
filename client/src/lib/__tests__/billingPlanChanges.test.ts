import { changePersonalSubscriptionPlan } from "../checkout";

jest.mock("@/lib/platform", () => ({ isIosNativeShell: () => false }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({ "X-CSRF-Token": "fixture-csrf" }) }));
jest.mock("@/lib/storekit", () => ({ purchaseProduct: jest.fn(), isStoreKitAvailable: jest.fn() }));

describe("existing-subscription plan-change consent", () => {
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  let fetchMock: jest.Mock;
  let confirmMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    confirmMock = jest.fn().mockReturnValue(true);
    global.fetch = fetchMock;
    (global as any).window = { confirm: confirmMock };
  });
  afterAll(() => { global.fetch = originalFetch; (global as any).window = originalWindow; });
  const preview = () => ({ ok: true, json: async () => ({
    operationId: "fixture-operation", currency: "usd", monthlyAmount: 2999, amountDueNow: 0,
    nextRenewalAt: 2_000_000_000,
    disclosure: "No charge or prorated credit is created now. Your renewal date stays the same.",
  }) });
  it("shows price and billing disclosure before sending explicit confirmation", async () => {
    fetchMock.mockResolvedValueOnce(preview()).mockResolvedValueOnce({ ok: true, json: async () => ({ applied: true }) });
    await expect(changePersonalSubscriptionPlan("mpm_premium")).resolves.toBe(true);
    expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining("No charge or prorated credit"));
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      "/api/stripe/plan-change/preview", "/api/stripe/plan-change/confirm",
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      operationId: "fixture-operation", acceptedDisclosure: true,
    });
    expect(fetchMock.mock.calls[1][1].headers["X-CSRF-Token"]).toBe("fixture-csrf");
  });
  it("does not change billing when the user declines confirmation", async () => {
    confirmMock.mockReturnValue(false);
    fetchMock.mockResolvedValueOnce(preview());
    await expect(changePersonalSubscriptionPlan("mpm_premium")).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("never falls back to a new subscription after a failed or timed-out confirmation", async () => {
    fetchMock.mockResolvedValueOnce(preview()).mockRejectedValueOnce(new Error("fixture provider timeout"));
    await expect(changePersonalSubscriptionPlan("mpm_premium")).rejects.toThrow("fixture provider timeout");
    expect(fetchMock.mock.calls.every(call => String(call[0]).includes("/plan-change/"))).toBe(true);
  });
});
