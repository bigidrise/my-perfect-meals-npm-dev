import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { createDevelopmentFounderDemoStore } from "../services/developmentFounderDemoStore";
import { createDemoProfessionalService } from "../services/demoProfessionalService";
import { createDemoDataBoundary } from "../middleware/demoDataBoundary";
import { DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO as authority, developmentFounderDemoEnabled, isDevelopmentFounderDemoAccount } from "../config/developmentFounderPhysicianDemo";
import { isDemoGrantCurrent } from "@shared/demoProfessional";
import type { IdentityAccountSnapshot } from "../services/professionalIdentityDecisionService";

// Authenticated actor/ownership fixtures and local temporary files only.
// No shared database module, credentials, memberships, or SQL writers.
let directory: string;
let enabled: boolean;
let account: IdentityAccountSnapshot;
let clinicId: string;
const oldEnvironment = process.env.NODE_ENV;
const oldDeployment = process.env.REPLIT_DEPLOYMENT;
function store() {
  return createDevelopmentFounderDemoStore({
    filename: path.join(directory, "demo.json"), enabled: () => enabled,
    owner: async () => ({ account: { ...account }, clinic: { id: clinicId, name: "Dr. Test's Clinic", type: "clinic", syntheticOnly: true } }),
  });
}
beforeEach(async () => {
  process.env.NODE_ENV = "development"; delete process.env.REPLIT_DEPLOYMENT;
  directory = await mkdtemp(path.join(tmpdir(), "physician-demo-"));
  enabled = true; clinicId = authority.clinicId;
  account = { id: authority.userId, professionalRole: "business", authSecurityVersion: 4,
    professionalCategory: null, credentialType: null, credentialBody: null, credentialNumber: null,
    credentialYear: null, isProCare: false, organizationId: null, isAdmin: false, mfaEnabled: false };
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
  process.env.NODE_ENV = oldEnvironment;
  if (oldDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
  else process.env.REPLIT_DEPLOYMENT = oldDeployment;
});
test("permanent authority uses the existing Clinic while Business identity and real readiness remain unchanged", async () => {
  const before = structuredClone(account);
  const context = await createDemoProfessionalService(store().repository).context(account.id);
  expect(context.clinic).toEqual({ id: authority.clinicId, name: "Dr. Test's Clinic", type: "clinic", syntheticOnly: true });
  expect(context.grant).toMatchObject({ lifetime: "permanent_founder", authority: "development_founder", expiresAt: null });
  expect(isDemoGrantCurrent(context.grant, Date.parse("2099-01-01"))).toBe(true);
  expect(context).toMatchObject({ realClinicalReadiness: false, credentialVerificationGranted: false,
    academyCompletionGranted: false, realAgreementsGranted: false, paidSubscriptionGranted: false });
  expect(account).toEqual(before);
});
test("logout/login, fresh sessions, reload, restart and renewal do not recreate or expire authority", async () => {
  const initial = await createDemoProfessionalService(store().repository).context(account.id);
  await createDemoProfessionalService(store().repository).acknowledge(account.id);
  for (const lifecycle of ["fresh-incognito", "logout-login", "reload", "restart", "session-renewal"]) {
    if (lifecycle === "session-renewal") account.authSecurityVersion++;
    const service = createDemoProfessionalService(store().repository, () => new Date("2070-01-01"));
    const current = await service.context(account.id);
    expect(current.grant.id).toBe(initial.grant.id);
    expect(current.acknowledgmentRequired).toBe(false);
    expect(current.clinic?.id).toBe(authority.clinicId);
    expect((await service.list(account.id, authority.workspaceId))).toHaveLength(3);
  }
  expect(account.professionalRole).toBe("business");
});
test("ordinary Development display-name/language edits persist without changing identity or authority", async () => {
  await store().updateProfile({ firstName: "Demo", lastName: "Physician", preferredLanguage: "en" });
  expect(await store().profile()).toEqual({ firstName: "Demo", lastName: "Physician", preferredLanguage: "en" });
  const context = await createDemoProfessionalService(store().repository).context(account.id);
  expect(isDemoGrantCurrent(context.grant)).toBe(true);
  expect(account.professionalRole).toBe("business");
});
test.each(["professionalRole", "isProCare", "isAdmin", "isFounder", "planLookupKey", "credentialNumber", "organizationId"])(
  "profile editing cannot grant or change protected field %s", async field => {
    await expect(store().updateProfile({ [field]: "physician" })).rejects.toMatchObject({ code: "DEMO_PROFILE_FIELD_DENIED" });
    expect(account.professionalRole).toBe("business");
  });
test("plans and simulated exact-patient invitations survive restart without live relationship writes", async () => {
  const service = createDemoProfessionalService(store().repository);
  await service.acknowledge(account.id);
  const [patient] = await service.list(account.id, authority.workspaceId);
  await service.savePlan(account.id, authority.workspaceId, patient.id, { nutritionFocus: "carb_awareness", followupDays: 7 });
  const invitation = await service.invite(account.id, authority.workspaceId, patient.id);
  expect(invitation).toMatchObject({ classification: "synthetic", providerUserId: account.id, clientUserId: patient.id });
  const reopened = createDemoProfessionalService(store().repository);
  await reopened.acceptInvitation(account.id, authority.workspaceId, patient.id, invitation.code);
  expect(await reopened.read(account.id, authority.workspaceId, patient.id)).toMatchObject({ plan: { nutritionFocus: "carb_awareness", followupDays: 7 } });
  expect(await reopened.invitation(account.id, authority.workspaceId, patient.id)).toMatchObject({ state: "accepted" });
  expect(account.professionalRole).toBe("business");
});
test("live IDs and different workspaces are denied; only synthetic exports and media exist", async () => {
  const service = createDemoProfessionalService(store().repository);
  await service.acknowledge(account.id);
  const [patient] = await service.list(account.id, authority.workspaceId);
  await expect(service.read(account.id, authority.workspaceId, authority.userId)).rejects.toMatchObject({ code: "DEMO_DATA_SCOPE_DENIED" });
  await expect(service.read(account.id, authority.clinicId, patient.id)).rejects.toMatchObject({ code: "DEMO_DATA_SCOPE_DENIED" });
  const exported = JSON.stringify(await service.export(account.id, authority.workspaceId, patient.id));
  expect(exported).toContain("synthetic");
  expect(exported).not.toContain("membership");
});
test("changed Clinic ownership, disabled overlay, and corrupt state fail closed", async () => {
  const local = store();
  await local.grant(account.id);
  clinicId = authority.workspaceId;
  await expect(local.grant(account.id)).rejects.toMatchObject({ code: "DEVELOPMENT_DEMO_OWNERSHIP_CHANGED" });
  clinicId = authority.clinicId; enabled = false;
  await expect(local.grant(account.id)).rejects.toMatchObject({ code: "DEVELOPMENT_DEMO_DISABLED" });
  enabled = true;
  const state = JSON.parse(await readFile(path.join(directory, "demo.json"), "utf8"));
  state.patients[0].classification = "live";
  await writeFile(path.join(directory, "demo.json"), JSON.stringify(state));
  await expect(local.grant(account.id)).rejects.toMatchObject({ code: "DEVELOPMENT_DEMO_STATE_INVALID" });
});
test.each(["production", "test"])("normal %s runtimes cannot obtain the Development founder overlay", mode => {
  process.env.NODE_ENV = mode;
  expect(developmentFounderDemoEnabled()).toBe(false);
  expect(isDevelopmentFounderDemoAccount(account.id)).toBe(false);
});
test.each(["1", "true"])("published Development runtime (%s) also excludes the overlay", deployment => {
  process.env.REPLIT_DEPLOYMENT = deployment;
  expect(developmentFounderDemoEnabled()).toBe(false);
});
test("another actor cannot acquire founder authority", async () => {
  expect(isDevelopmentFounderDemoAccount("different-account")).toBe(false);
  await expect(createDemoProfessionalService(store().repository).context("different-account"))
    .rejects.toMatchObject({ code: "DEMO_AUTHORITY_REQUIRED" });
});
test.each([
  ["GET", "/api/studios/my-studio"], ["GET", `/api/studios/${authority.clinicId}/clients`],
  ["GET", "/api/pro/tablet/all-messages"], ["GET", "/api/care-team"], ["POST", "/api/care-team/connect"],
  ["GET", "/api/professional/glucose"], ["GET", "/objects/private-media"], ["GET", "/api/user/health-profile"],
  ["GET", "/api/demo-professional/workspaces/not-a-uuid/patients"],
])("demo boundary denies live/direct/alternate %s %s", async (method, endpoint) => {
  const local = store(), app = express();
  app.use(createDemoDataBoundary({ actor: async () => ({ id: account.id, username: "demo", email: "synthetic@example.invalid",
    role: "coach", professionalRole: "business", isProCare: false, planLookupKey: null }), restriction: id => local.grant(id) }));
  app.use((_req, res) => res.json({ leaked: true }));
  const response = method === "POST" ? await request(app).post(endpoint) : await request(app).get(endpoint);
  expect(response.status).toBe(403);
  expect(response.body.code).toBe("DEMO_LIVE_DATA_DENIED");
  expect(response.body.leaked).toBeUndefined();
});
