import { resolveStudioAccessStatus } from "../services/studioAccessStatus";
import type { EffectiveAccess } from "../services/effectiveAccess";

const provider = {
  id: "provider-1",
  planLookupKey: null,
  personalPlanLookupKey: null,
  professionalRole: "trainer",
  isProCare: true,
};

const baseAccess: EffectiveAccess = {
  planLookupKey: null,
  entitlements: [],
  tier: "free",
  sponsoredByBusinessId: null,
  sponsoredByBusinessName: null,
  sponsoredProCareAccess: false,
  pilotProCareAccess: false,
  pilotProCareGrantId: null,
  pilotProCareEndsAt: null,
  pilotFullAccess: false,
  pilotParticipantId: null,
  pilotProgramName: null,
  pilotFullAccessEndsAt: null,
};

describe("server-resolved Studio access", () => {
  const resolve = (
    user = provider,
    access = baseAccess,
    studioStatus: string | null = null,
    owner = false,
    billingEnforced = true,
    studioReady = studioStatus === "active",
  ) => resolveStudioAccessStatus(user, access, studioStatus, owner, billingEnforced, studioReady);

  it("does not turn ordinary or temporary-only personal access into Studio", () => {
    expect(resolve().state).toBe("inactive");
    expect(resolve(provider, { ...baseAccess, tier: "ultimate" }).state).toBe("inactive");
    expect(resolve(provider, baseAccess, null, false, false).state).toBe("inactive");
  });

  it("shows personally paid access with a Studio, or setup before one exists", () => {
    const user = { ...provider, planLookupKey: "mpm_trainer_5" };
    const access = { ...baseAccess, planLookupKey: "mpm_trainer_5", tier: "ultimate" as const };
    expect(resolve(user, access).state).toBe("setup_available");
    expect(resolve(user, access, "active")).toMatchObject({
      state: "active", sources: ["personal"], studioActive: true, authorized: true,
    });
  });

  it("hides a stale Studio row when the professional entitlement is gone", () => {
    expect(resolve(provider, baseAccess, "active")).toMatchObject({
      state: "needs_review", authorized: false, studioActive: true,
    });
  });

  it("recognizes qualifying sponsored and Pilot ProCare sources", () => {
    const sponsored = { ...baseAccess, tier: "ultimate" as const, planLookupKey: "mpm_trainer_5",
      sponsoredByBusinessId: "business-1", sponsoredProCareAccess: true };
    expect(resolve(provider, sponsored, "active", true)).toMatchObject({
      state: "active", sources: ["sponsored"], ownsOrganization: true,
    });
    const pilot = { ...baseAccess, tier: "ultimate" as const, pilotProCareAccess: true };
    expect(resolve(provider, pilot, "active")).toMatchObject({ state: "active", sources: ["pilot"] });
  });

  it("does not treat organization membership or generic pilot access as Studio entitlement", () => {
    const unrelatedSeat = { ...baseAccess, tier: "ultimate" as const, planLookupKey: "mpm_ultimate",
      sponsoredByBusinessId: "business-1", sponsoredProCareAccess: false };
    expect(resolve(provider, unrelatedSeat, "active").state).toBe("needs_review");
    const genericPilot = { ...baseAccess, tier: "ultimate" as const, pilotFullAccess: true };
    expect(resolve(provider, genericPilot).state).toBe("inactive");
  });

  it("does not claim a sponsored business plan is personally paid", () => {
    const sponsoredUser = { ...provider, planLookupKey: "clinical_business_monthly" };
    const sponsored = { ...baseAccess, tier: "ultimate" as const, planLookupKey: "clinical_business_monthly",
      sponsoredByBusinessId: "business-1", sponsoredProCareAccess: true };
    expect(resolve(sponsoredUser, sponsored, "active").sources).toEqual(["sponsored"]);
  });

  it("does not offer setup to someone without provider setup eligibility", () => {
    const user = { ...provider, planLookupKey: "mpm_trainer_5", professionalRole: "general_nutrition" };
    const access = { ...baseAccess, planLookupKey: "mpm_trainer_5", tier: "ultimate" as const };
    expect(resolve(user, access).state).toBe("needs_review");
  });

  it("keeps paid entitlement but not ready navigation during required training", () => {
    const user = { ...provider, planLookupKey: "mpm_trainer_5" };
    const access = { ...baseAccess, planLookupKey: "mpm_trainer_5", tier: "ultimate" as const };
    expect(resolve(user, access, "active", false, true, false)).toMatchObject({
      state: "active", studioReady: false, authorized: true,
    });
  });

  it("retains all overlapping access sources rather than guessing one", () => {
    const user = { ...provider, personalPlanLookupKey: "mpm_trainer_5" };
    const access = { ...baseAccess, tier: "ultimate" as const, planLookupKey: "mpm_trainer_5",
      pilotProCareAccess: true };
    expect(resolve(user, access, "active").sources).toEqual(["personal", "pilot"]);
  });

  it("keeps internal access managed and distinguishes untraceable legacy access", () => {
    expect(resolve({ ...provider, isFounder: true }, { ...baseAccess, tier: "ultimate", planLookupKey: "mpm_ultimate_monthly" }, "active"))
      .toMatchObject({ state: "managed_access", sources: ["internal"] });
    expect(resolve(provider, baseAccess, "active", false, false))
      .toMatchObject({ state: "needs_review", sources: [] });
  });

  it("does not advertise navigation for suspended Studios", () => {
    const user = { ...provider, planLookupKey: "mpm_trainer_5" };
    const access = { ...baseAccess, planLookupKey: "mpm_trainer_5", tier: "ultimate" as const };
    expect(resolve(user, access, "suspended").state).toBe("needs_review");
  });
});