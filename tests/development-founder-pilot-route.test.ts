import fs from "node:fs";
import path from "node:path";
import { isDevelopmentFounderPilotRoute } from "../client/src/lib/developmentFounderPilotRoute";

const router = fs.readFileSync(path.join(process.cwd(), "client/src/components/Router.tsx"), "utf8");

describe("Development founder pilot route boundary", () => {
  test("only a recognized Development founder gets the exact pilot exception", () => {
    expect(isDevelopmentFounderPilotRoute(true, true, "/admin/pilots")).toBe(true);
    expect(isDevelopmentFounderPilotRoute(true, false, "/admin/pilots")).toBe(false);
    expect(isDevelopmentFounderPilotRoute(false, true, "/admin/pilots")).toBe(false);
    expect(isDevelopmentFounderPilotRoute(false, false, "/admin/pilots")).toBe(false);
  });

  test.each(["/admin", "/more", "/admin/pilots/extra", "/pro/physician-clients", "/activate/business-pilot"])(
    "does not exempt unrelated route %s",
    (route) => expect(isDevelopmentFounderPilotRoute(true, true, route)).toBe(false),
  );

  test("both founder redirect and demo rendering use the exception", () => {
    expect(router).toContain("if (isFounderDevelopmentSession && !isAuthRoute && !isFounderPilotRoute && location !==");
    expect(router).toContain("if (isFounderDevelopmentSession && !isAuthRoute && !isFounderPilotRoute)");
    expect(router).toContain("user?.operatingStatus === \"demo_only\" && !isFounderPilotRoute");
    expect(router).toContain("user?.operatingStatus === \"demo_only\" && !isAuthRoute && !isFounderPilotRoute");
    expect(router).toContain("isUngatedRoute || isMacroRoute || isFounderPilotRoute");
    expect(router).toContain("import.meta.env.DEV, isFounderDevelopmentSession, location");
    expect(router).toContain("<PilotProgramAdmin showDevelopmentMfaStatus={isFounderPilotRoute} />");
  });

  test("invitation issuance still requires authentication, MFA, and founder authorization", () => {
    const routes = fs.readFileSync(path.join(process.cwd(), "server/routes/businessPilotActivationRoutes.ts"), "utf8");
    expect(routes).toContain('router.post("/issue", requireAuth, requireMfa,');
    expect(routes).toContain("if (!req.authUser.isFounder) return res.status(403)");
  });
});
