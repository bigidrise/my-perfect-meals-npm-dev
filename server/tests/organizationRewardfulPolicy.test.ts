import {
  FOUNDING_ORGANIZATION_CAMPAIGN,
  assertFoundingOrganizationCampaign,
  hasRecordedOrganizationPaidActivation,
  organizationRewardfulCampaignId,
  verifyOrganizationRewardfulPayment,
} from "../services/organizationRewardfulPolicy";
import { deriveOrganizationPartnerLifecycle } from "../services/organizationPartnerRevenueService";

jest.mock("../db", () => ({ db: {} }));

const paidBusiness = {
  status: "active" as const,
  commercialAccessMode: "paid" as const,
  commercialAccessStartedAt: new Date("2026-02-01"),
  commercialAccessEndsAt: null,
  stripeCustomerId: "cus_organization",
  stripeSubscriptionId: "sub_organization",
  stripeLastEventCreatedAt: new Date("2026-02-01"),
  createdAt: new Date("2026-01-01"),
};
const campaign = {
  id: FOUNDING_ORGANIZATION_CAMPAIGN.id,
  name: FOUNDING_ORGANIZATION_CAMPAIGN.name,
  reward_type: "percent",
  commission_percent: 50,
  max_commission_period_months: 48,
};

describe("Development-only future organization Rewardful policy", () => {
  const priorEnvironment = process.env.NODE_ENV;
  const priorCampaign = process.env.REWARDFUL_CAMPAIGN_ID;
  beforeEach(() => { process.env.NODE_ENV = "development"; });
  afterAll(() => {
    process.env.NODE_ENV = priorEnvironment;
    if (priorCampaign === undefined) delete process.env.REWARDFUL_CAMPAIGN_ID;
    else process.env.REWARDFUL_CAMPAIGN_ID = priorCampaign;
  });

  test("uses the exact founding campaign ID rather than the legacy shared setting", () => {
    process.env.REWARDFUL_CAMPAIGN_ID = "legacy-30-percent";
    expect(organizationRewardfulCampaignId()).toBe(campaign.id);
    expect(process.env.REWARDFUL_CAMPAIGN_ID).toBe("legacy-30-percent");
  });
  test("Production retains its existing campaign selection", () => {
    process.env.NODE_ENV = "production";
    process.env.REWARDFUL_CAMPAIGN_ID = "legacy-30-percent";
    expect(organizationRewardfulCampaignId()).toBe("legacy-30-percent");
  });
  test("validates full approved campaign identity and terms", () => {
    expect(() => assertFoundingOrganizationCampaign(campaign)).not.toThrow();
    for (const changed of [
      { id: "wrong" }, { name: "Other program" }, { reward_type: "amount" },
      { commission_percent: 30 }, { max_commission_period_months: 60 },
      { max_commission_period_months: null },
    ]) expect(() => assertFoundingOrganizationCampaign({ ...campaign, ...changed })).toThrow();
  });
  test.each(["onboarding_pilot", "authorized_arrangement", null])(
    "trial/complimentary/legacy access (%s) does not qualify as paid activation",
    commercialAccessMode => {
      expect(hasRecordedOrganizationPaidActivation({ ...paidBusiness, commercialAccessMode })).toBe(false);
    },
  );
  test.each([
    { status: "past_due" }, { status: "cancelled" }, { status: "pending_billing" },
    { stripeCustomerId: null }, { stripeSubscriptionId: null },
    { stripeSubscriptionId: "dev_subscription" }, { stripeLastEventCreatedAt: null },
    { createdAt: null }, { createdAt: new Date() },
    { commercialAccessEndsAt: new Date("2035-01-01") },
  ])("requires complete authoritative paid evidence: %j", changed => {
    expect(hasRecordedOrganizationPaidActivation({ ...paidBusiness, ...changed })).toBe(false);
  });
  test("expired trial alone never enables setup", () => {
    expect(deriveOrganizationPartnerLifecycle({
      rewardfulAffiliateId: null, rewardfulState: "not_activated",
      business: { ...paidBusiness, commercialAccessMode: "onboarding_pilot",
        commercialAccessStartedAt: new Date("2026-01-01"),
        commercialAccessEndsAt: new Date("2026-01-31") },
      now: new Date("2026-02-01"),
    })).toMatchObject({ setupAvailable: false, reason: "organization_paid_activation_required" });
  });
  test("recorded paid activation exposes setup", () => {
    expect(deriveOrganizationPartnerLifecycle({
      rewardfulAffiliateId: null, rewardfulState: "not_activated", business: paidBusiness,
    })).toMatchObject({ setupAvailable: true, reason: "organization_paid_activation" });
  });
  test("existing linked identities are unchanged even without paid evidence", () => {
    expect(deriveOrganizationPartnerLifecycle({
      rewardfulAffiliateId: "existing-affiliate", rewardfulState: "active", business: null,
    })).toMatchObject({ state: "active", setupAvailable: true, reason: "rewardful_active" });
  });

  function client(changedSubscription = {}, changedInvoice = {}) {
    return {
      subscriptions: { retrieve: jest.fn().mockResolvedValue({
        status: "active", customer: "cus_organization", trial_end: null,
        latest_invoice: "in_paid", ...changedSubscription,
      }) },
      invoices: { retrieve: jest.fn().mockResolvedValue({
        status: "paid", paid: true, amount_paid: 4499, ...changedInvoice,
      }) },
    };
  }
  test("checks Stripe subscription and a positive paid invoice using only reads", async () => {
    const stripe = client();
    expect(await verifyOrganizationRewardfulPayment(paidBusiness, stripe as any)).toBe(true);
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_organization");
    expect(stripe.invoices.retrieve).toHaveBeenCalledWith("in_paid");
  });
  test.each([
    { status: "trialing" }, { status: "past_due" }, { customer: "cus_other_organization" },
    { trial_end: 9999999999 }, { latest_invoice: null },
  ])("rejects nonqualifying live subscription: %j", async changed => {
    expect(await verifyOrganizationRewardfulPayment(paidBusiness, client(changed) as any)).toBe(false);
  });
  test.each([{ status: "open" }, { status: "void" }, { amount_paid: 0 }, { amount_paid: -1 }])(
    "rejects unpaid or zero-payment invoices: %j", async changed => {
      expect(await verifyOrganizationRewardfulPayment(paidBusiness, client({}, changed) as any)).toBe(false);
    },
  );
  test("unpaid recorded state never calls Stripe", async () => {
    const stripe = client();
    expect(await verifyOrganizationRewardfulPayment({
      ...paidBusiness, commercialAccessMode: "onboarding_pilot",
    }, stripe as any)).toBe(false);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
  test("verification failures fail closed rather than authorizing creation", async () => {
    const stripe = client();
    stripe.subscriptions.retrieve.mockRejectedValue(new Error("unavailable"));
    await expect(verifyOrganizationRewardfulPayment(paidBusiness, stripe as any)).rejects.toThrow("unavailable");
  });
});
