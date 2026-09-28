import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveOwnedOrganizationEntry } from "../services/organizationAccessStatus";

const paidBusiness = {
  id: "business-opaque-owner-scoped",
  name: "My Organization",
  organizationId: "organization-row",
  ownerUserId: "owner-1",
  status: "active" as const,
  commercialAccessMode: "paid" as const,
  commercialAccessStartedAt: new Date("2026-01-01T00:00:00.000Z"),
  commercialAccessEndsAt: null,
  stripeCustomerId: "cus_server_only",
  stripeSubscriptionId: "sub_server_only",
};

describe("Organization Access lifecycle presentation", () => {
  it("exposes owner-scoped controls for verified active and ending billing only", () => {
    const active = resolveOwnedOrganizationEntry(paidBusiness, {
      state: "active",
      paidThrough: "2026-10-31T23:59:59.000Z",
    });
    expect(active).toMatchObject({
      state: "active",
      accessSource: "paid",
      businessId: "business-opaque-owner-scoped",
      canManageRenewal: true,
      canReconnect: false,
    });

    const ending = resolveOwnedOrganizationEntry(paidBusiness, {
      state: "ending",
      paidThrough: "2026-10-31T23:59:59.000Z",
    });
    expect(ending).toMatchObject({
      state: "ending",
      businessId: "business-opaque-owner-scoped",
      canManageRenewal: true,
      canReconnect: false,
    });
  });

  it("offers reconnect only after paid Organization billing expires", () => {
    const expired = resolveOwnedOrganizationEntry({
      ...paidBusiness,
      status: "cancelled",
    }, { state: "expired", paidThrough: null });
    expect(expired).toMatchObject({
      state: "expired",
      accessSource: "paid",
      businessId: "business-opaque-owner-scoped",
      canManageRenewal: false,
      canReconnect: true,
    });

    expect(resolveOwnedOrganizationEntry({
      ...paidBusiness,
      status: "active",
    }, { state: "expired", paidThrough: null })).toMatchObject({
      state: "needs_review",
      businessId: null,
      canReconnect: false,
    });
  });

  it("does not expose billing controls for pilot, arrangement, or review-only entries", () => {
    const pilot = resolveOwnedOrganizationEntry({
      ...paidBusiness,
      status: "active",
      commercialAccessMode: "onboarding_pilot",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    }, null);
    expect(pilot).toMatchObject({
      accessSource: "pilot",
      businessId: null,
      canManageRenewal: false,
      canReconnect: false,
    });
    const review = resolveOwnedOrganizationEntry(paidBusiness, null);
    expect(review).toMatchObject({
      state: "needs_review",
      businessId: null,
      canManageRenewal: false,
      canReconnect: false,
    });
  });

  it("keeps Organization lifecycle operations out of Personal subscription state", () => {
    const transition = readFileSync(join(
      process.cwd(),
      "server/services/businessSubscriptionService.ts",
    ), "utf8");
    const card = readFileSync(join(
      process.cwd(),
      "client/src/components/OrganizationAccessCard.tsx",
    ), "utf8");
    expect(transition).not.toContain("users.stripeSubscriptionId =");
    expect(transition).not.toContain("stripeSubscriptionId: null");
    expect(card).toContain("/api/stripe/checkout/business");
    expect(card).toContain("organization.businessId");
  });

  it("requires Development checkout to use Stripe test keys and verifies expired reconnects", () => {
    const checkout = readFileSync(join(
      process.cwd(),
      "server/routes/stripeCheckout.ts",
    ), "utf8");
    const routes = readFileSync(join(
      process.cwd(),
      "server/routes/organizationWorkspaceRoutes.ts",
    ), "utf8");
    expect(checkout).toContain('getStripeKeyMode(stripeKey) !== "TEST"');
    expect(checkout).toContain("getExpiredOrganizationForReconnect(userId, businessId)");
    expect(checkout).toContain("mpm-business-reconnect:");
    expect(routes).toContain('router.post("/organization-access/:businessId/:action"');
    expect(routes).toContain('getStripeKeyMode(stripeKey) !== "TEST"');
  });
});