type MiddlewareResult = {
  nextCalled: boolean;
  statusCode?: number;
  body?: Record<string, unknown>;
};

jest.mock("../services/independentStudioAccess", () => ({
  readIndependentStudioAccess: jest.fn(async () => ({
    studioId: "legacy-studio", studioActive: true, hasSubscription: false,
    legacyEligible: true, billing: null,
  })),
}));

async function invokeGate(
  authUser: Record<string, unknown> | undefined,
  billingEnforced: boolean,
  studioStatus?: { hasSubscription: boolean; legacyEligible: boolean; studioActive: boolean;
    billing: { state: string; paidThrough: string | null } | null },
): Promise<MiddlewareResult> {
  process.env.BILLING_ENFORCED = billingEnforced ? "true" : "false";
  jest.resetModules();
  if (studioStatus) {
    const { readIndependentStudioAccess } = await import("../services/independentStudioAccess");
    (readIndependentStudioAccess as jest.Mock).mockResolvedValueOnce(studioStatus);
  }
  const { requireProCareAccess } = await import("../middleware/requireProCareAccess");

  const result: MiddlewareResult = { nextCalled: false };
  const res = {
    status(code: number) {
      result.statusCode = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      result.body = body;
      return this;
    },
  };

  await requireProCareAccess(
    { authUser } as any,
    res as any,
    () => { result.nextCalled = true; },
  );
  return result;
}

describe("requireProCareAccess — production billing enforcement", () => {
  const originalBillingEnforced = process.env.BILLING_ENFORCED;

  afterAll(() => {
    if (originalBillingEnforced === undefined) delete process.env.BILLING_ENFORCED;
    else process.env.BILLING_ENFORCED = originalBillingEnforced;
  });

  it("does not grant Studio merely from owning a Clinical Business", async () => {
    const result = await invokeGate({
      id: "clinical-business-owner",
      accessTier: "PAID_FULL",
      planLookupKey: "clinical_business_monthly",
    }, true);
    expect(result).toMatchObject({
      nextCalled: false, statusCode: 403,
      body: { code: "PROCARE_SUBSCRIPTION_REQUIRED" },
    });
  });

  it("allows a verified standalone Studio while the Personal account stays Basic", async () => {
    const result = await invokeGate({
      id: "standalone-studio-owner", accessTier: "PAID_BASIC", planLookupKey: "mpm_basic_monthly",
    }, true, {
      hasSubscription: true, legacyEligible: false, studioActive: true,
      billing: { state: "ending", paidThrough: new Date(Date.now() + 86400000).toISOString() },
    });
    expect(result.nextCalled).toBe(true);
  });

  it("does not revive an expired Studio with a Personal professional plan", async () => {
    const result = await invokeGate({
      id: "expired-studio-owner", accessTier: "PAID_FULL", planLookupKey: "mpm_trainer_5",
    }, true, {
      hasSubscription: true, legacyEligible: false, studioActive: true,
      billing: { state: "expired", paidThrough: null },
    });
    expect(result).toMatchObject({ nextCalled: false, statusCode: 403 });
  });

  it("rejects a personal Ultimate subscriber from Studio access", async () => {
    const result = await invokeGate({
      id: "personal-ultimate",
      accessTier: "PAID_FULL",
      planLookupKey: "mpm_ultimate_monthly",
    }, true);
    expect(result).toMatchObject({
      nextCalled: false,
      statusCode: 403,
      body: { code: "PROCARE_SUBSCRIPTION_REQUIRED" },
    });
  });

  it("allows an explicit active Pilot ProCare entitlement without changing the plan", async () => {
    const result = await invokeGate({
      id: "pilot-provider",
      accessTier: "PAID_FULL",
      planLookupKey: "mpm_ultimate_monthly",
      pilotProCareAccess: true,
      isFounder: false,
    }, true);
    expect(result.nextCalled).toBe(true);
  });

  it("rejects generic no-plan trial access from Studio", async () => {
    const result = await invokeGate({
      id: "generic-trial",
      accessTier: "PAID_FULL",
      planLookupKey: null,
      pilotProCareAccess: false,
      isFounder: false,
    }, true);
    expect(result).toMatchObject({
      nextCalled: false,
      statusCode: 403,
      body: { code: "PROCARE_SUBSCRIPTION_REQUIRED" },
    });
  });

  it("rejects clinic patient entitlement and attribution without explicit ProCare access", async () => {
    const result = await invokeGate({
      id: "clinic-patient",
      accessTier: "PAID_FULL",
      planLookupKey: null,
      clinicTrialEntitlementId: "clinic-entitlement-1",
      attributionOrganizationId: "clinic-organization-1",
      pilotProCareAccess: false,
      sponsoredProCareAccess: false,
      isFounder: false,
    }, true);
    expect(result).toMatchObject({
      nextCalled: false,
      statusCode: 403,
      body: { code: "PROCARE_SUBSCRIPTION_REQUIRED" },
    });
  });

  it("rejects a non-clinical sponsored business seat", async () => {
    const result = await invokeGate({
      id: "sponsored-staff",
      accessTier: "PAID_FULL",
      planLookupKey: "clinical_business_monthly",
      sponsoredByBusinessId: "business-1",
      sponsoredProCareAccess: false,
      isFounder: false,
    }, true);
    expect(result).toMatchObject({
      nextCalled: false,
      statusCode: 403,
      body: { code: "PROCARE_SUBSCRIPTION_REQUIRED" },
    });
  });

  it("allows a sponsored clinical professional", async () => {
    const result = await invokeGate({
      id: "sponsored-trainer",
      accessTier: "PAID_FULL",
      planLookupKey: "clinical_business_monthly",
      sponsoredByBusinessId: "business-1",
      sponsoredProCareAccess: true,
      isFounder: false,
    }, true);
    expect(result.nextCalled).toBe(true);
  });

  it("retains founder Studio access through the synthetic Ultimate key", async () => {
    const result = await invokeGate({
      id: "founder",
      accessTier: "PAID_FULL",
      planLookupKey: "mpm_ultimate_monthly",
      isFounder: true,
    }, true);
    expect(result.nextCalled).toBe(true);
  });

  it("allows an explicit internal sandbox account without a Stripe plan", async () => {
    const result = await invokeGate({
      id: "dummy-trainer",
      accessTier: "PAID_FULL",
      planLookupKey: null,
      isSandbox: true,
      isFounder: false,
    }, true);
    expect(result.nextCalled).toBe(true);
  });

  it("keeps the pre-launch billing bypass behavior", async () => {
    const result = await invokeGate({
      id: "basic-user",
      accessTier: "FREE",
      planLookupKey: "mpm_basic_monthly",
    }, false);
    expect(result.nextCalled).toBe(true);
  });
});