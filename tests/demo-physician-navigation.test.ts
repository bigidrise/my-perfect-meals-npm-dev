import fs from "node:fs";
import { demoPhysicianPage, demoPhysicianClientPath, DEMO_PHYSICIAN_NAVIGATION } from "../client/src/lib/demoPhysicianNavigation";

describe("isolated Physician navigation", () => {
  test.each(["/", "/dashboard", "/professional-dashboard", "/pro-launchpad"])("opens Studio home at %s", path => {
    expect(demoPhysicianPage(path)).toEqual({ kind: "home" });
  });
  test.each(["/pro-portal", "/pro/physician"])("opens the portal at %s", path => {
    expect(demoPhysicianPage(path)).toEqual({ kind: "portal" });
  });
  test.each(["/care-team", "/care-team/physician"])("opens Care Team at %s", path => {
    expect(demoPhysicianPage(path)).toEqual({ kind: "care-team" });
  });
  test.each(["/pro/clients", "/pro/physician-clients", "/demo-physician"])("opens clients at %s", path => {
    expect(demoPhysicianPage(path)).toEqual({ kind: "clients" });
  });
  test("navigation targets are distinct and reachable", () => {
    expect(new Set(DEMO_PHYSICIAN_NAVIGATION.map(item => item.path)).size).toBe(4);
    DEMO_PHYSICIAN_NAVIGATION.forEach(item => expect(demoPhysicianPage(item.path).kind).toBe(item.kind));
  });
  test("client dashboard preserves exact patient identity through deep links", () => {
    const patientId = "synthetic case A";
    expect(demoPhysicianPage(demoPhysicianClientPath(patientId))).toEqual({ kind: "client", patientId });
    expect(demoPhysicianPage(`${demoPhysicianClientPath(patientId)}?tab=plan`)).toEqual({ kind: "client", patientId });
    expect(demoPhysicianPage("/pro/clients/case-B/clinician")).toEqual({ kind: "client", patientId: "case-B" });
  });
  test.each(["/admin", "/pro/clients/A/trainer", "/pro/clients/A/clinician/extra",
    "/pro/clients/%2F/clinician", "/pro/clients/%5C/clinician", "/pro/clients/%ZZ/clinician"])(
    "does not route unsupported path %s into a live page or unsafe lookup", path => {
      expect(demoPhysicianPage(path)).toEqual({ kind: "unavailable" });
    },
  );
  test("workspace selects only known authorized synthetic patients and exposes separate pages", () => {
    const source = fs.readFileSync("client/src/pages/pro/DemoPhysicianWorkspace.tsx", "utf8");
    expect(source).toContain('page.kind === "client" && canReadPatients');
    expect(source).toContain("patients.some(item => item.id === page.patientId)");
    expect(source).toContain("selectedId !== page.patientId");
    expect(source).toContain("<PhysicianCareTeam syntheticContent=");
    expect(source).toContain("<PhysicianPortal studioHome=");
    expect(source).not.toContain("ClinicianClientDashboard");
    expect(source).not.toContain('"/api/care-team"');
  });
});
