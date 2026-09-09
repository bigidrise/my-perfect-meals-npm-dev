describe("Stripe environment isolation", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    jest.resetModules();
  });

  it("uses only the test key and test prices in Development", async () => {
    delete process.env.REPLIT_DEPLOYMENT;
    process.env.STRIPE_SECRET_KEY = "sk_live_must_not_be_used";
    process.env.STRIPE_TEST_SECRET_KEY = "sk_test_development";

    const {
      getStripePriceEnvName,
      getStripeSecretKey,
    } = await import("../config/stripeEnvironment");

    expect(getStripeSecretKey()).toBe("sk_test_development");
    expect(getStripePriceEnvName("STRIPE_PRICE_PREMIUM"))
      .toBe("STRIPE_TEST_PRICE_PREMIUM");
  });

  it("fails closed when Development has no test key", async () => {
    delete process.env.REPLIT_DEPLOYMENT;
    process.env.STRIPE_SECRET_KEY = "sk_live_must_not_be_used";
    delete process.env.STRIPE_TEST_SECRET_KEY;

    const { getStripeSecretKey } = await import("../config/stripeEnvironment");
    expect(getStripeSecretKey()).toBe("");
  });

  it("uses existing live variables only in Production", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_live_production";
    process.env.STRIPE_TEST_SECRET_KEY = "sk_test_development";

    const {
      getStripePriceEnvName,
      getStripeSecretKey,
    } = await import("../config/stripeEnvironment");

    expect(getStripeSecretKey()).toBe("sk_live_production");
    expect(getStripePriceEnvName("STRIPE_PRICE_PREMIUM"))
      .toBe("STRIPE_PRICE_PREMIUM");
  });
});