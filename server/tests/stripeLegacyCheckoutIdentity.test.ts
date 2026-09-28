import { hasVerifiedCheckoutSubscriptionIdentity } from "../services/stripeReconciliationService";

const base = {
  userId: "account-1",
  sessionUserId: "account-1",
  paymentStatus: "paid",
};

describe("legacy Checkout identity repair", () => {
  it("accepts the exact paid personal session only when privileged repair is enabled", () => {
    expect(hasVerifiedCheckoutSubscriptionIdentity({
      ...base, subscriptionUserId: null, allowLegacySessionIdentity: true,
    })).toBe(true);
    expect(hasVerifiedCheckoutSubscriptionIdentity({
      ...base, subscriptionUserId: null,
    })).toBe(false);
  });

  it.each([
    { sessionUserId: "someone-else" },
    { subscriptionUserId: "someone-else" },
    { paymentStatus: "unpaid" },
    { businessId: "organization-1" },
  ])("refuses conflicting, unpaid, or business evidence: %p", (override) => {
    expect(hasVerifiedCheckoutSubscriptionIdentity({
      ...base, subscriptionUserId: null, allowLegacySessionIdentity: true, ...override,
    })).toBe(false);
  });

  it("keeps ordinary matching subscription metadata valid", () => {
    expect(hasVerifiedCheckoutSubscriptionIdentity({
      ...base, subscriptionUserId: "account-1",
    })).toBe(true);
  });
});