import { hasActiveBusinessPilotAccess } from "../../shared/businessPilotAccess";
import { canAccessHydration, hasFeature, getUserTier, purchasedPlanIncludesFeature } from "../../client/src/lib/entitlements";
import { isProOrAbove, isClinicalOrAbove, canAccessClinicalLabs, canAccessTherapeuticNutrition } from "../../client/src/lib/subscriptionCheck";
import { requireClinicalAccess } from "../middleware/requireClinicalAccess";
import { requireHydrationCenterAccess } from "../middleware/requirePurchasedPlanEntitlement";

const now = Date.parse("2026-10-27T12:00:00Z");
const end = "2026-11-26T12:00:00Z";
const pilot = (key: string | null = null) => ({
  id: "fixture", accessTier: "PAID_FULL", planLookupKey: key,
  businessPilotUnifiedAccess: true, businessPilotClinicalAccessEndsAt: end,
  temporaryClinicalAccess: true, trialEndsAt: "2026-08-21T12:00:00Z",
});
function gate(middleware: any, user: any) {
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  middleware({ authUser: user }, res, next);
  return { res, next };
}
beforeEach(() => jest.useFakeTimers().setSystemTime(now));
afterEach(() => jest.useRealTimers());

test.each([null, "mpm_basic_monthly", "mpm_premium_monthly"])("Clinical overrides lower plan %s, not its billing identity", key => {
  const user = pilot(key);
  expect(hasActiveBusinessPilotAccess(user)).toBe(true);
  for (const check of [isProOrAbove, isClinicalOrAbove, canAccessClinicalLabs, canAccessTherapeuticNutrition, canAccessHydration]) {
    expect(check(user)).toBe(true);
  }
  expect(hasFeature(user, "hydration_center")).toBe(true);
  expect(getUserTier(user)).toBe("ultimate");
  expect(gate(requireClinicalAccess, user).next).toHaveBeenCalledTimes(1);
  expect(gate(requireHydrationCenterAccess, user).next).toHaveBeenCalledTimes(1);
  expect(user.planLookupKey).toBe(key);
});

test("Hydration frontend and backend close at exact expiration without losing a real paid plan", () => {
  jest.setSystemTime(Date.parse(end));
  for (const key of [null, "mpm_basic_monthly", "mpm_premium_monthly"]) {
    const user = pilot(key);
    expect(hasActiveBusinessPilotAccess(user)).toBe(false);
    expect(canAccessHydration(user)).toBe(purchasedPlanIncludesFeature(user, "hydration_center"));
    expect(gate(requireHydrationCenterAccess, user).next.mock.calls.length > 0)
      .toBe(purchasedPlanIncludesFeature(user, "hydration_center"));
  }
});

test.each([undefined, null, "", "invalid"])("malformed expiration %s never grants pilot authority", date => {
  expect(hasActiveBusinessPilotAccess({ ...pilot(), businessPilotClinicalAccessEndsAt: date })).toBe(false);
});

test("ordinary sign-in, generic trials and roles do not imply Business Pilot enrollment", () => {
  for (const extra of [{}, { professionalRole: "physician" }, { pilotFullAccess: true }, { temporaryClinicalAccess: true }]) {
    const user = { id: "ordinary", accessTier: "PAID_FULL", planLookupKey: null, ...extra };
    expect(hasActiveBusinessPilotAccess(user)).toBe(false);
    expect(canAccessHydration(user)).toBe(false);
  }
  expect(gate(requireHydrationCenterAccess, null).res.status).toHaveBeenCalledWith(401);
});
