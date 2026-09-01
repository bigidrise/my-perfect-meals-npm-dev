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

  test("Champion participation remains separate and does not activate entitlement", () => {
    expect(service).toContain('participantRole: "champion"');
    expect(service).toContain('populationType: "professional"');
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
});