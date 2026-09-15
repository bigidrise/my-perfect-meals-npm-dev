import fs from "fs";
import path from "path";
import { businessOfferJoinPath, BUSINESS_OFFER_DURATIONS } from "../services/businessOfferLinkService";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Business Offer Links BP1 contracts", () => {
  const schema = read("server/db/schema/businessOfferLinks.ts");
  const migration = read("server/db/migrations/runBusinessOfferLinksMigration.ts");
  const service = read("server/services/businessOfferLinkService.ts");
  const routes = read("server/routes/businessOfferRoutes.ts");
  const auth = read("server/routes/auth.session.ts");
  const checkout = read("server/routes/stripeCheckout.ts");
  const dev = read("server/index.ts");
  const prod = read("server/prod.ts");
  const page = read("client/src/pages/BusinessOfferJoinPage.tsx");
  const dashboard = read("client/src/pages/AffiliateDashboard.tsx");

  test("exposes only the approved 7, 14, and 30 day defaults", () => {
    expect(BUSINESS_OFFER_DURATIONS).toEqual([7, 14, 30]);
    expect(migration).toContain("CHECK (trial_days IN (7, 14, 30))");
    expect(migration).toContain("CHECK (granted_duration_days IN (7, 14, 30))");
  });

  test("binds every offer and entitlement to organization, location, and affiliate identity", () => {
    for (const field of [
      "organizationId",
      "locationId",
      "affiliateAccountId",
      "rewardfulAffiliateId",
      "rewardfulReferralToken",
    ]) {
      expect(schema).toContain(`${field}:`);
    }
    expect(migration).toContain("business_offer_links_org_location_duration_uq");
    expect(migration).toContain("business_offer_entitlements_user_offer_uq");
  });

  test("derives management scope from the canonical active workspace", () => {
    expect(routes).toContain("resolveActiveWorkspace(actor(req), selection(req))");
    expect(routes).toContain('["owner", "admin"].includes(workspace.organizationRole)');
    expect(routes).toContain("organizationId: workspace.organizationId");
    expect(routes).toContain("locationId: workspace.locationId");
    expect(routes).not.toContain("req.body?.organizationId");
    expect(routes).not.toContain("req.body?.rewardful");
    expect(routes).not.toContain("req.body?.trialDays");
  });

  test("uses an opaque fragment token and header-only public inspection", () => {
    const path = businessOfferJoinPath(
      "11111111-1111-4111-8111-111111111111",
      "partner-token",
    );
    expect(path).toBe(
      "/join/business-offer?via=partner-token#token=11111111-1111-4111-8111-111111111111",
    );
    expect(routes).toContain('req.get("x-business-offer-token")');
    expect(routes).not.toMatch(/\/inspect\/:token/);
    expect(page).toContain('"x-business-offer-token": token');
    expect(page).toContain('window.history.replaceState(null, "", "/join/business-offer")');
  });

  test("serializes capacity and prevents duplicate user redemptions", () => {
    expect(service).toContain("pg_advisory_xact_lock");
    expect(schema).toContain("userOfferUnique");
    expect(service).toContain("if (existing) return { entitlement: existing, alreadyRedeemed: true }");
    expect(service).toContain("BUSINESS_OFFER_CAPACITY");
    expect(service).toContain('eq(businessOfferLinks.status, "active")');
  });

  test("redeems new-account offers in the account creation transaction", () => {
    expect(auth).toContain("db.transaction(async (tx)");
    expect(auth).toContain("redeemBusinessOffer(businessOfferToken, createdUser.id, tx)");
    expect(auth).toContain("inspectBusinessOffer(businessOfferToken)");
  });

  test("keeps Business Offer access separate from personal and paid plan fields", () => {
    expect(service).not.toMatch(/trialEndsAt|planLookupKey|stripeSubscriptionId/);
    expect(read("server/services/effectiveAccess.ts")).toContain("getActiveBusinessOfferEntitlement");
  });

  test("preserves authoritative organization attribution into Stripe metadata", () => {
    expect(checkout).toContain("getBusinessOfferCheckoutAttribution(userId)");
    expect(checkout).toContain("attributionOrganizationId: businessOfferAttribution.organizationId");
    expect(checkout).toContain("rewardfulAffiliateId: businessOfferAttribution.affiliateId");
    expect(checkout).toContain("rewardfulReferralToken: businessOfferAttribution.referralToken");
    expect(checkout).toContain("validateRewardfulReferralForAffiliate");
    expect(checkout).toContain("businessOfferAttribution.affiliateId");
    expect(checkout).toContain("REWARDFUL_ATTRIBUTION_REQUIRED");
  });

  test("runs migration and routes in development and production", () => {
    for (const source of [dev, prod]) {
      expect(source).toContain("runBusinessOfferLinksMigration");
      expect(source).toContain('"/api/business-offers"');
    }
  });

  test("adds the three Business Offer controls without removing the existing referral link", () => {
    expect(dashboard).toContain("Business Offer Links");
    expect(dashboard).toContain("Referral Link");
    expect(dashboard).toContain("Copy Link");
    expect(dashboard).toContain("Open");
  });
});