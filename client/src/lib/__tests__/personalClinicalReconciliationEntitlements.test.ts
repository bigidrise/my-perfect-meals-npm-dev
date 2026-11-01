import { hasFeature, purchasedPlanIncludesFeature } from "../entitlements";

const end = Date.parse("2026-11-11T15:41:27.737Z");
beforeEach(() => jest.useFakeTimers().setSystemTime(end - 1));
afterEach(() => jest.useRealTimers());

test("reconciled personal Hydration access works with no paid key or a lower paid key", () => {
  for (const planLookupKey of [null, "mpm_basic_monthly"]) {
    const user = {
      id: "fixture-owner", planLookupKey, accessTier: "PAID_FULL",
      personalClinicalReconciliationEndsAt: new Date(end).toISOString(),
    };
    expect(purchasedPlanIncludesFeature(user, "hydration_center")).toBe(true);
    expect(purchasedPlanIncludesFeature(user, "procare")).toBe(false);
    expect(hasFeature(user, "lab_metrics")).toBe(true);
    expect(hasFeature(user, "procare")).toBe(false);
    jest.setSystemTime(end);
    expect(purchasedPlanIncludesFeature(user, "hydration_center")).toBe(false);
    if (planLookupKey === "mpm_basic_monthly") {
      expect(hasFeature(user, "lab_metrics")).toBe(false);
    }
    jest.setSystemTime(end - 1);
  }
});
test("no server-granted reconciliation marker means no Hydration access", () => {
  expect(purchasedPlanIncludesFeature({ id: "fixture-owner", accessTier: "PAID_FULL", planLookupKey: null }, "hydration_center")).toBe(false);
  expect(purchasedPlanIncludesFeature({
    id: "fixture-owner", accessTier: "FREE", planLookupKey: null,
    personalClinicalReconciliationEndsAt: new Date(end).toISOString(),
  }, "hydration_center")).toBe(false);
});
