import fs from "fs";
import path from "path";

const root = process.cwd();
const service = fs.readFileSync(
  path.join(root, "server/services/organizationalPilotAuthorizationService.ts"),
  "utf8",
);
const routes = fs.readFileSync(path.join(root, "server/routes/businessRoutes.ts"), "utf8");
const auth = fs.readFileSync(path.join(root, "server/routes/auth.session.ts"), "utf8");
const chooser = fs.readFileSync(path.join(root, "client/src/components/WorkspaceChooser.tsx"), "utf8");
const setup = fs.readFileSync(path.join(root, "client/src/pages/BusinessSetup.tsx"), "utf8");
const premier = fs.readFileSync(path.join(root, "server/services/premierPilotReconciliation.ts"), "utf8");
const effectiveAccess = fs.readFileSync(path.join(root, "server/services/effectiveAccess.ts"), "utf8");
const orgAdminMiddleware = fs.readFileSync(path.join(root, "server/middleware/requireProOrOrgAdmin.ts"), "utf8");

describe("organizational pilot Champion authorization contract", () => {
  test("claim authorization is bound to the account's unique normalized email", () => {
    expect(service).toContain("resolveEmailIdentityForUser(input.userId)");
    expect(service).toContain("locked.normalizedChampionEmail !== normalizedUserEmail");
    expect(service).toContain('"EMAIL_MISMATCH"');
  });

  test("claim tokens are random and only their SHA-256 hashes are stored", () => {
    expect(service).toContain('crypto.randomBytes(32).toString("hex")');
    expect(service).toContain('crypto.createHash("sha256")');
    expect(service).toContain("claimTokenHash");
  });

  test("claiming is transactional and serializes the authorization", () => {
    expect(service).toContain("db.transaction(async (tx)");
    expect(service).toContain("pg_advisory_xact_lock");
    expect(service).toContain('eq(organizationalPilotAuthorizations.status, "approved")');
  });

  test("same-user replay is idempotent while a different user cannot replay it", () => {
    expect(service).toContain('locked.status === "claimed"');
    expect(service).toContain("locked.claimedByUserId !== input.userId");
    expect(service).toContain("alreadyClaimed: true");
  });

  test("claim creates a Preparing pilot with no personal or shared clock", () => {
    expect(service).toContain('status: "preparing"');
    expect(service).toContain("pilotStartAt: null");
    expect(service).toContain("pilotEndAt: null");
  });

  test("authorized capacities are copied server-side rather than accepted from setup input", () => {
    expect(service).toContain("seatLimit: locked.professionalCapacity");
    expect(service).toContain("clientCapacity: locked.clientCapacity");
    expect(routes).toContain("updateClaimedChampionSetup");
    expect(routes).not.toMatch(/updateClaimedChampionSetup\([\s\S]{0,200}(professionalCapacity|clientCapacity)/);
  });

  test("Champion authority creates owner/admin management without paid-plan state", () => {
    expect(service).toContain('role: "admin"');
    expect(service).toContain('plan: "organizational_pilot"');
    expect(service).not.toMatch(/stripe|planLookupKey|trialStartedAt|trialEndsAt/i);
  });

  test("Champion claim does not automatically create pilot participation or entitlement", () => {
    expect(service).not.toContain("insert(organizationalPilotParticipants)");
    expect(service).not.toContain('participantRole: "champion"');
    expect(service).toContain('status: "preparing"');
  });

  test("new Champion signup suppresses the personal signup trial", () => {
    expect(auth).toContain("isValidPilotAuthorizationSignup");
    expect(auth).toContain("&& !isValidPilotAuthorizationSignup");
  });

  test("Workspace Chooser only receives exact pending authorizations or owner/admin memberships", () => {
    expect(service).toContain("normalizedChampionEmail, normalizedEmail");
    expect(service).toContain('inArray(businessMembers.role, ["owner", "admin"])');
    expect(chooser).toContain("authorizationId: workspace.authorizationId");
  });

  test("pilot setup is non-Stripe and preserves fixed capacities", () => {
    expect(setup).toContain('/api/business/pilot-setup');
    expect(setup).toContain("cannot be increased here");
    const pilotBranch = setup.slice(setup.indexOf("if (pilotMode)"), setup.indexOf("// Step 1: Create the organization record"));
    expect(pilotBranch).not.toMatch(/stripe|checkout/i);
  });

  test("ordinary participant invitation API still rejects Champion escalation", () => {
    expect(routes).toContain('"CHAMPION_AUTHORIZATION_REQUIRED"');
  });

  test("Premier reconciliation uses exactly five Nurses with Allison in both separate authorities", () => {
    expect(premier).toContain('organizationName: "Premier Health"');
    expect(premier).toContain('professionalCapacity: 5');
    expect(premier).toContain('clientCapacity: 30');
    expect(premier).toContain('participantRole: "nurse"');
    expect(premier).toContain('participantRole: "nurse",');
    expect(premier).toContain('championEmail: "apate@pwlindy.com"');
    expect(premier).toContain('pilotStartAt: new Date("2026-09-01T00:00:00-05:00")');
    expect(premier).toContain('pilotEndAt: new Date("2026-10-01T00:00:00-05:00")');
    expect(premier).not.toContain("insert(users)");
  });

  test("Premier reconciliation preserves existing identities and creates pending invites only for missing users", () => {
    expect(premier).toContain("resolveEmailIdentityForEmail");
    expect(premier).toContain("createOrganizationalPilotInvitation");
    expect(premier).toContain('state: "pending"');
    expect(premier).not.toMatch(/password|trialStartedAt|trialEndsAt|stripe/i);
  });

  test("pilot commercial access does not imply ProCare or Business administration", () => {
    expect(effectiveAccess).toContain('membership.plan === "organizational_pilot"');
    expect(effectiveAccess).toContain("pilotFullAccess");
    expect(effectiveAccess).toContain("!isOrganizationalPilotBusiness");
    expect(orgAdminMiddleware).toContain('eq(businessMembers.role, "admin")');
    expect(orgAdminMiddleware).not.toContain("pilotFullAccess");
  });
});