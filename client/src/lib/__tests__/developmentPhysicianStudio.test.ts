jest.mock("../queryClient", () => ({ apiRequest: jest.fn() }));
import { authorizedDevelopmentStudio, isOriginalDevelopmentStudioPath, dashboardPath, writeDevelopmentDashboard } from "../developmentPhysicianStudio";
import { initialDevelopmentDashboard } from "@shared/developmentStudio";
import type { DemoContext } from "@shared/demoProfessional";
import { apiRequest } from "../queryClient";

function context(): DemoContext {
  return {
    operatingStatus: "demo_only", persona: "physician", acknowledgmentRequired: false,
    workspace: { id: "synthetic-workspace", label: "Test", classification: "synthetic" },
    clinic: { id: "existing-clinic", name: "Existing Clinic", type: "clinic", syntheticOnly: true },
    realClinicalReadiness: false, credentialVerificationGranted: false, academyCompletionGranted: false,
    realAgreementsGranted: false, paidSubscriptionGranted: false,
    grant: { id: "grant", userId: "actor", workspaceId: "synthetic-workspace",
      operatingStatus: "demo_only", persona: "physician", state: "active", revision: 1,
      authority: "development_founder", lifetime: "permanent_founder", expiresAt: null,
      approverId: "authorization", reason: "Authorized synthetic test", capabilities: ["patient.read", "clinical.read", "clinical.write"],
      trainingBasis: "demo_only_waiver", trainingWaiverReason: "Only synthetic use",
      acknowledgedAt: "2026-01-01", acknowledgmentVersion: "demo-only-v1", identityRequestId: null },
  };
}
test("original interface authorization is separate from live readiness and stored Business identity", () => {
  expect(authorizedDevelopmentStudio(context(), "actor")).toBe(true);
  expect(context().realClinicalReadiness).toBe(false);
  expect(authorizedDevelopmentStudio(context(), "different-actor")).toBe(false);
});
test("revoked, live, mismatched, ordinary demo and absent Clinic contexts cannot mount original synthetic pages", () => {
  for (const mutate of [
    (c: DemoContext) => { c.grant.state = "revoked"; },
    (c: DemoContext) => { c.workspace.classification = "live"; },
    (c: DemoContext) => { c.grant.workspaceId = "another-workspace"; },
    (c: DemoContext) => { c.grant.authority = "founder_admin"; },
    (c: DemoContext) => { delete c.clinic; },
    (c: DemoContext) => { c.grant.trainingWaiverReason = null; },
  ]) {
    const c = context(); mutate(c);
    expect(authorizedDevelopmentStudio(c, "actor")).toBe(false);
  }
});
test("only restored original Physician paths select the adapter; no broad pro or patient route bypass", () => {
  for (const path of ["/pro-portal", "/pro/physician", "/pro/physician-clients", "/pro/clients", "/care-team", "/care-team/physician", "/pro/clients/37e010aa-c441-4881-bf2a-3f402654cd11/clinician"])
    expect(isOriginalDevelopmentStudioPath(path)).toBe(true);
  for (const path of ["/business-organizations", "/care-team/trainer", "/pro/clients/real/clinician", "/pro/clients/37e010aa-c441-4881-bf2a-3f402654cd11/diabetic-builder"])
    expect(isOriginalDevelopmentStudioPath(path)).toBe(false);
});
test("saves use only the isolated endpoint with an explicit revision and no live identity selector", async () => {
  const dashboard = initialDevelopmentDashboard();
  await writeDevelopmentDashboard("workspace", "patient", 7, dashboard);
  expect(apiRequest).toHaveBeenCalledWith("/api/demo-professional/workspaces/workspace/patients/patient/development-dashboard", {
    method: "PUT", body: JSON.stringify({ revision: 7, dashboard }),
  });
  expect(dashboardPath("../workspace", "patient/extra")).toContain("..%2Fworkspace/patients/patient%2Fextra/");
});
