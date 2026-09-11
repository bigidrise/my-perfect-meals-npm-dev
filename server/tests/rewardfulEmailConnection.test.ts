import fs from "fs";
import path from "path";

const root = process.cwd();
const routes = fs.readFileSync(path.join(root, "server/routes/affiliateRoutes.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "server/db/schema/rewardfulConnectionConfirmations.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "server/db/migrations/runOrganizationPartnerRevenueMigration.ts"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "client/src/pages/AffiliateDashboard.tsx"), "utf8");
const confirmationPage = fs.readFileSync(path.join(root, "client/src/pages/RewardfulConnectionConfirm.tsx"), "utf8");
const payoutGuidance = fs.readFileSync(path.join(root, "client/src/components/business/RewardfulPayoutGuidance.tsx"), "utf8");

describe("Development-only Rewardful email connection", () => {
  test("email discovery is gated, bounded, and never attaches by lookup alone", () => {
    const requestRoute = routes.slice(
      routes.indexOf('router.post("/organization/attach-existing/request-confirmation"'),
      routes.indexOf('router.post("/organization/attach-existing/confirm"'),
    );
    expect(requestRoute).toContain("requireDevelopmentRewardfulConnection");
    expect(requestRoute).toContain("requireAuth");
    expect(requestRoute).toContain("requireOrganizationPartnerManager(workspace)");
    expect(requestRoute).toContain("allowRewardfulConfirmationAttempt");
    expect(requestRoute).toContain("getRewardfulAffiliateByEmail(email)");
    expect(requestRoute).toContain("REWARDFUL_AFFILIATE_NOT_FOUND");
    expect(requestRoute).toContain("REWARDFUL_AFFILIATE_ALREADY_ASSIGNED");
    expect(requestRoute).toContain("sendRewardfulConnectionConfirmationEmail");
    expect(requestRoute).not.toContain("rewardfulAffiliateId: affiliate.id,\n        rewardfulState");
  });

  test("confirmation binds identity and is expiring, hashed, and single use", () => {
    expect(schema).toContain("organizationId:");
    expect(schema).toContain("locationId:");
    expect(schema).toContain("requesterUserId:");
    expect(schema).toContain("rewardfulAffiliateId:");
    expect(schema).toContain("destinationEmail:");
    expect(schema).toContain("tokenHash:");
    expect(schema).toContain("expiresAt:");
    expect(schema).toContain("consumedAt:");
    expect(schema).not.toContain("rawToken");
    expect(migration).toContain("rewardful_connection_confirmations");
    expect(routes).toContain('createHash("sha256")');
    expect(routes).toContain("randomBytes(32)");
    expect(routes).toContain("gt(rewardfulConnectionConfirmations.expiresAt");
    expect(routes).toContain("isNull(rewardfulConnectionConfirmations.consumedAt)");
  });

  test("confirmation revalidates organization authority, provider identity, and uniqueness before attachment", () => {
    const confirmRoute = routes.slice(
      routes.indexOf('router.post("/organization/attach-existing/confirm"'),
      routes.indexOf('router.post("/organization/setup"'),
    );
    expect(confirmRoute).toContain("resolveActiveWorkspace(confirmation.requesterUserId");
    expect(confirmRoute).toContain("organizationId: confirmation.organizationId");
    expect(confirmRoute).toContain("locationId: confirmation.locationId");
    expect(confirmRoute).toContain("requireOrganizationPartnerManager(workspace)");
    expect(confirmRoute).toContain("resolveOrganizationPartnerLifecycle");
    expect(confirmRoute).toContain("getRewardfulAffiliate(confirmation.rewardfulAffiliateId)");
    expect(confirmRoute).toContain("verified.email.trim().toLowerCase() !== confirmation.destinationEmail");
    expect(confirmRoute).toContain("already attached to another organization");
    expect(confirmRoute).toContain("organization_rewardful_attached_by_email_confirmation");
    expect(confirmRoute).toContain("isNull(userAffiliateAccounts.rewardfulAffiliateId)");
  });

  test("client keeps create, email connection, exact-ID fallback, and payout management separate", () => {
    expect(dashboard).toContain("Create New Rewardful Account");
    expect(dashboard).toContain("Connect Existing Rewardful Account");
    expect(dashboard).toContain("Business email used with Rewardful");
    expect(dashboard).toContain("Finding an account does not attach it");
    expect(dashboard).toContain("Exact affiliate ID fallback");
    expect(dashboard).toContain("/api/affiliate/organization/attach-existing");
    expect(confirmationPage).toContain("/api/affiliate/organization/attach-existing/confirm");
    expect(payoutGuidance).toContain("Set Up / Manage Payouts in Rewardful");
  });

  test("MPM does not collect payout credentials and Academy remains unrelated", () => {
    const combined = `${routes}\n${dashboard}\n${confirmationPage}`;
    expect(combined).not.toMatch(/routingNumber|bankAccountNumber|paypalEmail|wiseEmail/);
    expect(routes).not.toContain("userCertifications");
    expect(routes).not.toContain("academy");
  });
});