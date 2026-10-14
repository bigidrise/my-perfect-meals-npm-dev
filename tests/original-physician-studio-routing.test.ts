import fs from "node:fs";
import { DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO, isDevelopmentFounderDemoAccount } from "../server/config/developmentFounderPhysicianDemo";

const read = (path: string) => fs.readFileSync(path, "utf8");
const router = read("client/src/components/Router.tsx");

describe("original Physician Studio restoration", () => {
  test.each([
    ["/pro-portal", "GuardedProPortal"],
    ["/care-team/physician", "GuardedPhysicianCareTeam"],
    ["/pro/physician-clients", "GuardedProClientsPhysician"],
    ["/pro/clients", "GuardedProClients"],
    ["/pro/clients/:id/clinician", "GuardedClinicianClientDashboard"],
    ["/care-team/trainer", "GuardedTrainerCareTeam"],
    ["/pro/clients/:id/trainer", "GuardedTrainerClientDashboard"],
  ])("route %s uses the original guarded component %s", (path, component) => {
    expect(router).toContain(`<Route path="${path}" component={${component}} />`);
  });

  test("October demo wrappers no longer substitute Physician pages", () => {
    expect(router).not.toContain("DevelopmentFounderClinicEntry");
    expect(router).not.toContain("DevelopmentFounderPhysicianClientsRoute");
    expect(router).not.toContain("DevelopmentFounderPhysicianCareTeamRoute");
    expect(router).not.toContain("DevelopmentFounderClinicClientsRoute");
    expect(router).not.toContain('setLocation("/pro/physician-clients")');
    expect(router).toContain('component={isOriginalPhysicianStudio ? GuardedProClientsPhysician : DemoPhysicianWorkspaceRoute}');
  });

  test("Development founder navigation does not change Production or other demo restrictions", () => {
    expect(router).toContain("const isFounderDevelopmentSession = import.meta.env.DEV && founderIsCurrentAccount");
    expect(router).toContain('user?.operatingStatus === "demo_only" && !isAuthRoute && !isFounderPilotRoute && !isOriginalPhysicianStudio');
    expect(router).toContain('grant.userId === accountId');
    expect(router).toContain('grant.authority === "development_founder"');
    expect(router).toContain('grant.lifetime === "permanent_founder"');
    expect(router).toContain('grant.expiresAt === null');
    expect(router).toContain('const current = isDemoGrantCurrent(grant)');
  });

  test("the original application provider tree is selected by Development presentation, not clinical authority", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('const originalDevelopmentStudio = import.meta.env.DEV');
    expect(app).toContain('user?.developmentPhysicianStudioInterface === "original"');
    expect(app).toContain('user?.operatingStatus !== "demo_only" || originalDevelopmentStudio');
    expect(app).toContain("<UpgradeModalProvider>");
    expect(app).toContain("<ProClientProvider>");
    expect(router).toContain('const isOriginalPhysicianStudio = import.meta.env.DEV');
    expect(router).toContain('user?.developmentPhysicianStudioInterface === "original"');
    const runtime = read("server/middleware/demoDataBoundaryRuntime.ts");
    expect(runtime).toContain('if (grant.authority !== "development_founder" || !isDevelopmentFounderDemoAccount(actor.id)) return null');
    expect(runtime).toContain('developmentPhysicianStudioInterface: "original"');
    expect(runtime).toContain('operatingStatus: "demo_only"');
    const auth = read("client/src/contexts/AuthContext.tsx");
    expect(auth).toContain('developmentPhysicianStudioInterface: userData.developmentPhysicianStudioInterface === "original" ? "original" : undefined');
  });

  test("the server presentation scope excludes other accounts and deployed runtimes", () => {
    const previousEnvironment = process.env.NODE_ENV;
    const previousDeployment = process.env.REPLIT_DEPLOYMENT;
    try {
      process.env.NODE_ENV = "development";
      delete process.env.REPLIT_DEPLOYMENT;
      expect(isDevelopmentFounderDemoAccount(DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO.userId)).toBe(true);
      expect(isDevelopmentFounderDemoAccount("unrelated-account")).toBe(false);
      process.env.NODE_ENV = "production";
      expect(isDevelopmentFounderDemoAccount(DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO.userId)).toBe(false);
      process.env.NODE_ENV = "development";
      process.env.REPLIT_DEPLOYMENT = "1";
      expect(isDevelopmentFounderDemoAccount(DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO.userId)).toBe(false);
    } finally {
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
      if (previousDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
      else process.env.REPLIT_DEPLOYMENT = previousDeployment;
    }
  });

  test("original Physician clients reuse the shared list without syntheticSource", () => {
    const clients = read("client/src/pages/pro/ProClientsPhysician.tsx");
    expect(clients).toContain('<ProClients workspace="clinician" />');
    expect(clients).not.toContain("syntheticSource");
    const list = read("client/src/pages/pro/ProClients.tsx");
    expect(list).toContain('<ProClientFolderModal');
    expect(list).toContain("isPhysician={isPhysician}");
    const folder = read("client/src/components/pro/ProClientFolderModal.tsx");
    expect(folder).toContain('const workspace = isPhysician ? "clinician" : "trainer"');
    expect(folder).toContain('onNavigate(`/pro/clients/${client.id}/${workspace}`)');
  });

  test("complete original clinical dashboard and starch correction remain present", () => {
    const dashboard = read("client/src/pages/pro/ClinicianClientDashboard.tsx");
    for (const component of ["ClinicalProtocolCard", "ClinicalInterventionPanel", "ClinicalDirectiveReviewPanel",
      "ProHydrationControls", "NutritionPersonalizationSummaryCard", "StudioStarchGamePlan"]) {
      expect(dashboard).toContain(`<${component}`);
    }
    expect(dashboard).not.toContain("DemoSyntheticPatientView");
    expect(router).toContain('<ProCareStudioGuard component={SafeClinicianClientDashboard}');
  });
});
