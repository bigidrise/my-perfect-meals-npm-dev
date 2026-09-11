import fs from "fs";
import path from "path";

const root = process.cwd();
const businessRoutes = fs.readFileSync(
  path.join(root, "server/routes/businessRoutes.ts"),
  "utf8",
);
const productionBoot = fs.readFileSync(
  path.join(root, "server/prod.ts"),
  "utf8",
);
const businessSchema = fs.readFileSync(
  path.join(root, "server/db/schema/business.ts"),
  "utf8",
);
const setup = fs.readFileSync(
  path.join(root, "client/src/pages/BusinessSetup.tsx"),
  "utf8",
);
const hub = fs.readFileSync(path.join(root, "client/src/pages/OrganizationHub.tsx"), "utf8");
const businessCardState = fs.readFileSync(path.join(root, "client/src/lib/businessCardState.ts"), "utf8");
const pilotAuthorization = fs.readFileSync(
  path.join(root, "server/services/organizationalPilotAuthorizationService.ts"),
  "utf8",
);

describe("multi-organization owner setup", () => {
  test("pilot organization creation is separate from paid create-org", () => {
    expect(businessRoutes).toContain('router.post("/pilot-organizations"');
    expect(setup).toContain('pilotCreateMode ? "/api/business/pilot-organizations" : "/api/business/create-org"');
    expect(setup).toContain("if (pilotCreateMode)");
    expect(setup).toContain('setLocation("/business-organizations")');
  });

  test("pilot organizations use per-attempt idempotency and preserve owner metadata", () => {
    expect(businessSchema).toContain('ownerUserId: text("owner_user_id").notNull()');
    expect(businessSchema).not.toContain('ownerUserId: text("owner_user_id").notNull().unique()');
    expect(pilotAuthorization).toContain("businesses.creationRequestId, input.creationRequestId");
    expect(pilotAuthorization).toContain("ownerUserId: input.userId");
    expect(pilotAuthorization).toContain('role: "admin"');
  });

  test("hub supports first and subsequent independent organizations", () => {
    expect(hub).toContain("You don't have any organizations yet.");
    expect(hub.match(/Add Organization/g)?.length).toBeGreaterThanOrEqual(2);
    expect(hub).toContain('setLocation("/business/setup?pilotCreate=1")');
  });

  test("an approved pilot user with zero organizations is routed to the Hub", () => {
    expect(businessCardState).toContain('request("/api/business/workspaces")');
    expect(businessCardState).toContain('return { state: "pilot-ready" }');
    expect(businessCardState).toContain('description: "Your complimentary organization access is ready"');
    expect(businessCardState).toContain('destination: "/business-organizations"');
  });

  test("pilot creation provisions a canonical organization and default location", () => {
    expect(businessRoutes).toContain("ensureCanonicalWorkspaceForBusiness(created.business.id)");
    expect(businessRoutes).toContain("organizationId: workspace.organization.id");
    expect(businessRoutes).toContain("locationId: workspace.defaultLocation.id");
    expect(pilotAuthorization).toContain('plan: "organizational_pilot"');
    expect(pilotAuthorization).toContain('status: "preparing"');
  });

  test("business, owner membership, and role update remain one transaction", () => {
    const route = businessRoutes.slice(
      businessRoutes.indexOf('router.post("/create-org"'),
      businessRoutes.indexOf('// ── POST /api/business/dev-seed'),
    );
    const transaction = route.indexOf("db.transaction");
    const businessInsert = route.indexOf("tx.insert(businesses)", transaction);
    const membershipInsert = route.indexOf("tx.insert(businessMembers)", transaction);
    const roleUpdate = route.indexOf("tx.update(users)", transaction);
    const transactionEnd = route.indexOf("return biz", roleUpdate);

    expect(transaction).toBeGreaterThan(-1);
    expect(businessInsert).toBeGreaterThan(transaction);
    expect(membershipInsert).toBeGreaterThan(businessInsert);
    expect(roleUpdate).toBeGreaterThan(membershipInsert);
    expect(transactionEnd).toBeGreaterThan(roleUpdate);
  });

  test("same-business duplicate membership protection is preserved", () => {
    expect(businessSchema).toContain("unique().on(t.businessId, t.userId)");
    expect(productionBoot).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_business_members_active");
    expect(productionBoot).toContain("ON business_members (business_id, user_id)");
  });

  test("server boot removes the invalid global active-membership index", () => {
    expect(productionBoot).toContain("DROP INDEX IF EXISTS idx_business_members_one_active_per_user");
    expect(productionBoot).not.toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_business_members_one_active_per_user");
  });

  test("paid checkout remains after ordinary paid organization creation only", () => {
    const createFetch = setup.indexOf('"/api/business/create-org"');
    const createSuccessGate = setup.indexOf("if (!createRes.ok)", createFetch);
    const checkoutFetch = setup.indexOf('fetch("/api/stripe/checkout/business"', createSuccessGate);
    expect(createFetch).toBeGreaterThan(-1);
    expect(createSuccessGate).toBeGreaterThan(createFetch);
    expect(checkoutFetch).toBeGreaterThan(createSuccessGate);
    expect(setup).toContain("This organization uses your approved complimentary pilot access. No payment is required.");
  });
});