type MiddlewareResult = {
  nextCalled: boolean;
  statusCode?: number;
  body?: Record<string, unknown>;
};

async function invokeGate(
  authUser: Record<string, unknown> | undefined,
  billingEnforced: boolean,
): Promise<MiddlewareResult> {
  process.env.BILLING_ENFORCED = billingEnforced ? "true" : "false";
  jest.resetModules();
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

  requireProCareAccess(
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

  it("allows a Clinical Business Studio owner", async () => {
    const result = await invokeGate({
      id: "clinical-business-owner",
      accessTier: "PAID_FULL",
      planLookupKey: "clinical_business_monthly",
    }, true);
    expect(result.nextCalled).toBe(true);
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