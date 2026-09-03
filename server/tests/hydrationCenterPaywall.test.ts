import { purchasedPlanIncludesFeature } from "../../client/src/lib/entitlements";
import { requirePurchasedPlanEntitlement } from "../middleware/requirePurchasedPlanEntitlement";

describe("My Perfect Hydration Center purchased-plan paywall", () => {
  const middleware = requirePurchasedPlanEntitlement("hydration_center");

  function runServerGate(planLookupKey: string | null, overrides: Record<string, unknown> = {}) {
    const next = jest.fn();
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const req = {
      authUser: {
        planLookupKey,
        accessTier: "PAID_FULL",
        isTester: false,
        isFounder: false,
        isSandbox: false,
        ...overrides,
      },
    } as any;
    const res = { status, json } as any;

    middleware(req, res, next);
    return { next, status, json };
  }

  it.each([
    [null, false],
    ["mpm_free", false],
    ["mpm_basic_monthly", false],
    ["mpm_premium_monthly", true],
    ["mpm_ultimate_monthly", true],
    ["mpm_family_all_premium_monthly", true],
    ["mpm_family_all_ultimate_monthly", true],
  ])("resolves plan %s as access=%s on the client", (planLookupKey, expected) => {
    expect(
      purchasedPlanIncludesFeature(
        {
          id: "test-user",
          planLookupKey,
          accessTier: "PAID_FULL",
        },
        "hydration_center",
      ),
    ).toBe(expected);
  });

  it("blocks a Free tester instead of inheriting the tester bypass", () => {
    const result = runServerGate(null, { isTester: true });
    expect(result.next).not.toHaveBeenCalled();
    expect(result.status).toHaveBeenCalledWith(403);
    expect(result.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "PRO_REQUIRED",
        feature: "hydration_center",
        requiredTier: "premium",
      }),
    );
  });

  it("blocks Essential and permits Pro and Clinical", () => {
    expect(runServerGate("mpm_basic_monthly").next).not.toHaveBeenCalled();
    expect(runServerGate("mpm_premium_monthly").next).toHaveBeenCalledTimes(1);
    expect(runServerGate("mpm_ultimate_monthly").next).toHaveBeenCalledTimes(1);
  });
});