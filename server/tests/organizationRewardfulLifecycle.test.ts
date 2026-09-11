import fs from "fs";
import path from "path";
import { deriveOrganizationPartnerLifecycle } from "../services/organizationPartnerRevenueService";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("organization-owned Rewardful lifecycle", () => {
  const activePilot = {
    status: "active" as const,
    commercialAccessMode: "onboarding_pilot" as const,
    commercialAccessStartedAt: new Date("2026-01-01T00:00:00Z"),
    commercialAccessEndsAt: new Date("2026-01-31T00:00:00Z"),
  };

  test("an active 30-day pilot cannot start Rewardful setup", () => {
    expect(deriveOrganizationPartnerLifecycle({
      rewardfulAffiliateId: null,
      rewardfulState: "not_activated",
      business: activePilot,
      now: new Date("2026-01-15T00:00:00Z"),
    })).toMatchObject({
      state: "not_available",
      setupAvailable: false,
      reason: "onboarding_pilot_active",
    });
  });

  test("pilot completion exposes setup without creating or inferring an identity", () => {
    expect(deriveOrganizationPartnerLifecycle({
      rewardfulAffiliateId: null,
      rewardfulState: "not_activated",
      business: activePilot,
      now: new Date("2026-01-31T00:00:00Z"),
    })).toMatchObject({
      state: "setup_available",
      setupAvailable: true,
      reason: "onboarding_pilot_completed",
    });
  });

  test("paid and authorized organizations can set up before a pilot clock", () => {
    for (const commercialAccessMode of ["paid", "authorized_arrangement"] as const) {
      expect(deriveOrganizationPartnerLifecycle({
        rewardfulAffiliateId: null,
        rewardfulState: "not_activated",
        business: {
          ...activePilot,
          commercialAccessMode,
          commercialAccessEndsAt: null,
        },
      }).state).toBe("setup_available");
    }
  });

  test("an existing organization Rewardful identity is preserved across commercial changes", () => {
    expect(deriveOrganizationPartnerLifecycle({
      rewardfulAffiliateId: "affiliate-for-this-organization",
      rewardfulState: "active",
      business: { ...activePilot, status: "cancelled" },
    })).toMatchObject({
      state: "active",
      setupAvailable: true,
      reason: "rewardful_active",
    });
  });

  test("setup claims have their own state and cannot start a second creation", () => {
    expect(deriveOrganizationPartnerLifecycle({
      rewardfulAffiliateId: null,
      rewardfulState: "setup_in_progress",
      business: activePilot,
    })).toMatchObject({
      state: "setup_in_progress",
      setupAvailable: false,
    });
  });

  test("attach and create routes require the selected organization and owner/admin role", () => {
    const routes = read("server/routes/affiliateRoutes.ts");
    expect(routes).toContain('["owner", "admin"].includes(workspace.organizationRole)');
    expect(routes).toContain('router.post("/organization/attach-existing"');
    expect(routes).toContain('router.post("/organization/setup"');
    expect(routes).toContain("requireOrganizationPartnerManager(workspace)");
    expect(routes).toContain("affiliateAccountScope(workspace.organizationId)");
    expect(routes).toContain("verified.id !== affiliateId");
    expect(routes).toContain("REWARDFUL_AFFILIATE_ALREADY_ASSIGNED");
    const attachRoute = routes.slice(
      routes.indexOf('router.post("/organization/attach-existing"'),
      routes.indexOf('router.post("/organization/setup"'),
    );
    expect(attachRoute).toContain("resolveOrganizationPartnerLifecycle");
    expect(attachRoute).toContain("ORGANIZATION_PARTNER_SETUP_NOT_AVAILABLE");
    for (const marker of [
      'router.get("/dashboard-link"',
      'router.get("/rewardful-status"',
      'router.post("/sync-link"',
    ]) {
      const routeStart = routes.indexOf(marker);
      const nextRoute = routes.indexOf("\nrouter.", routeStart + marker.length);
      const route = routes.slice(routeStart, nextRoute > routeStart ? nextRoute : undefined);
      expect(route).toContain("requireOrganizationPartnerManager(workspace)");
    }
  });

  test("organization creation never reconciles the first Rewardful affiliate by email", () => {
    const rewardful = read("server/services/rewardfulApi.ts");
    const organizationCreate = rewardful.slice(
      rewardful.indexOf("export async function createOrganizationRewardfulAffiliate"),
      rewardful.indexOf("export async function getRewardfulAffiliateByEmail"),
    );
    expect(organizationCreate).toContain("RewardfulAffiliateConflictError");
    expect(organizationCreate).not.toContain("getRewardfulAffiliateByEmail");
  });

  test("Academy stays personal and no longer triggers organization activation", () => {
    const overview = read("client/src/pages/AffiliateProgramOverview.tsx");
    const personalActivation = read("server/services/affiliateActivation.ts");
    const certificationRoutes = read("server/routes/certificationRoutes.ts");
    expect(overview).not.toContain('apiRequest("/api/affiliate/activate-retry"');
    expect(certificationRoutes).not.toContain("evaluateAffiliateActivation");
    expect(certificationRoutes).not.toContain("../services/affiliateActivation");
    expect(personalActivation).toContain("isNull(userAffiliateAccounts.organizationId)");
    expect(personalActivation).toContain("isNull(partnerRecords.organizationId)");
  });

  test("external delegated administrators are distinct from internal staff", () => {
    const businessSchema = read("server/db/schema/business.ts");
    const workspaceSchema = read("server/db/schema/workspaces.ts");
    const businessRoutes = read("server/routes/businessRoutes.ts");
    expect(businessSchema).toContain('"internal_staff" | "external_contractor"');
    expect(workspaceSchema).toContain('"internal_staff" | "external_contractor"');
    expect(businessRoutes).toContain('relationshipType: "internal_staff"');
    expect(businessRoutes).not.toContain('relationshipType: "external_contractor",\n          status: "active"');
  });

  test("organization Rewardful changes write an organization-scoped audit event", () => {
    const routes = read("server/routes/affiliateRoutes.ts");
    expect(routes).toContain('action: "organization_rewardful_attached"');
    expect(routes).toContain('action: "organization_rewardful_created"');
    expect(routes).toContain("organizationId: workspace.organizationId");
    expect(routes).toContain("actorId: userId");
  });

  test("organization business contact email is persisted with the Partner record", () => {
    const partnerSchema = read("server/db/schema/partnerRecords.ts");
    const partnerMigration = read("server/db/migrations/runOrganizationPartnerRevenueMigration.ts");
    const routes = read("server/routes/affiliateRoutes.ts");
    expect(partnerSchema).toContain('contactEmail: text("contact_email")');
    expect(partnerMigration).toContain("ADD COLUMN IF NOT EXISTS contact_email text");
    expect(routes).toContain("contactEmail: email");
    expect(routes).toContain("contactEmail: verified.email");
  });

  test("an unlinked Rewardful account cannot leave the user on a blank portal tab", () => {
    const dashboard = read("client/src/pages/AffiliateDashboard.tsx");
    expect(dashboard).toContain('window.open("about:blank", "_blank")');
    expect(dashboard).toContain("Rewardful is not available yet");
    expect(dashboard).toContain("!account.hasLinkedRewardful");
    expect(dashboard).toContain("Rewardful is not linked yet");
    expect(dashboard).toContain("escapeRewardfulMessage(message)");
    expect(dashboard).not.toContain('window.open("", "_blank", "noopener,noreferrer")');
  });
});