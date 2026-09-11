import fs from "fs";
import path from "path";

const root = process.cwd();
const affiliateRoutes = fs.readFileSync(path.join(root, "server/routes/affiliateRoutes.ts"), "utf8");
const partnerRoutes = fs.readFileSync(path.join(root, "server/routes/partnerRoutes.ts"), "utf8");
const activation = fs.readFileSync(path.join(root, "server/services/affiliateActivation.ts"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "client/src/pages/AffiliateDashboard.tsx"), "utf8");
const workspaceService = fs.readFileSync(path.join(root, "server/services/organizationWorkspaceService.ts"), "utf8");

describe("organization-scoped Partner and Revenue Center", () => {
  test("dashboard requests resolve and query the selected organization", () => {
    expect(affiliateRoutes).toContain("resolveActiveWorkspace(userId, sessionSelection(req))");
    expect(affiliateRoutes).toContain("affiliateAccountScope(userId, workspace.organizationId)");
    expect(partnerRoutes).toContain("partnerRecordScope(userId, workspace.organizationId)");
  });

  test("organization reads do not inherit personal certifications or Rewardful identity by email", () => {
    const dashboardRoute = affiliateRoutes.slice(
      affiliateRoutes.indexOf('router.get("/dashboard"'),
      affiliateRoutes.indexOf('// ─── GET /api/affiliate/dashboard-link'),
    );
    expect(dashboardRoute).not.toContain("userCertifications");
    expect(affiliateRoutes).not.toContain("getRewardfulAffiliateByEmail");
    expect(partnerRoutes.slice(
      partnerRoutes.indexOf('router.get("/identity"'),
      partnerRoutes.indexOf("// ─── Admin: GET"),
    )).not.toContain("userAffiliateAccounts");
    expect(affiliateRoutes).toContain("ORGANIZATION_PARTNER_NOT_ACTIVATED");
    expect(affiliateRoutes).not.toContain('import("../services/affiliateActivation")');
  });

  test("personal certification activation cannot mutate organization affiliate accounts", () => {
    expect(activation).toContain("isNull(userAffiliateAccounts.organizationId)");
    expect(activation).toContain("isNull(partnerRecords.organizationId)");
  });

  test("new organizations receive an isolated zero-state shell", () => {
    expect(workspaceService).toContain("ensureOrganizationPartnerRevenueShell(tx");
    expect(dashboard).toContain("This organization does not have a referral account yet.");
    expect(dashboard).toContain("◌ Not Activated");
    expect(dashboard).toContain('"Not completed"');
    expect(dashboard).not.toContain("Certified — link generating");
  });

  test("Rewardful webhooks update only the matched affiliate row", () => {
    const webhook = affiliateRoutes.slice(affiliateRoutes.indexOf("export async function handleRewardfulWebhook"));
    expect(webhook).toContain("eq(userAffiliateAccounts.id, account.id)");
    expect(webhook).not.toContain("eq(userAffiliateAccounts.userId, account.userId)");
  });
});