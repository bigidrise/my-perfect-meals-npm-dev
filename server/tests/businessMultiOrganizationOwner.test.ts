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
const start = fs.readFileSync(path.join(root, "client/src/pages/BusinessStart.tsx"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "client/src/pages/BusinessDashboard.tsx"), "utf8");
const businessCardState = fs.readFileSync(path.join(root, "client/src/lib/businessCardState.ts"), "utf8");
const stripeCheckout = fs.readFileSync(path.join(root, "server/routes/stripeCheckout.ts"), "utf8");
const pilotAuthorization = fs.readFileSync(
  path.join(root, "server/services/organizationalPilotAuthorizationService.ts"),
  "utf8",
);
const pilotAdmin = fs.readFileSync(
  path.join(root, "client/src/pages/PilotProgramAdmin.tsx"),
  "utf8",
);

describe("multi-organization owner setup", () => {
  test("pilot organization creation is separate from paid create-org", () => {
    expect(businessRoutes).toContain('router.post("/pilot-organizations"');
    expect(setup).toContain('pilotCreateMode ? "/api/business/pilot-organizations" : "/api/business/create-org"');
    expect(setup).toContain("if (pilotCreateMode)");
    expect(setup).toContain('fetch("/api/business/workspace/select"');
    expect(setup).toContain('setLocation("/business-dashboard")');
  });

  test("pilot organizations use per-attempt idempotency and preserve owner metadata", () => {
    expect(businessSchema).toContain('ownerUserId: text("owner_user_id").notNull()');
    expect(businessSchema).not.toContain('ownerUserId: text("owner_user_id").notNull().unique()');
    expect(pilotAuthorization).toContain("businesses.creationRequestId, input.creationRequestId");
    expect(pilotAuthorization).toContain("ownerUserId: input.userId");
    expect(pilotAuthorization).toContain('role: "admin"');
  });

  test("each free organization consumes one exact server-approved authorization", () => {
    expect(pilotAuthorization).toContain("input.authorizationId");
    expect(pilotAuthorization).toContain("authorization.status !== \"approved\"");
    expect(pilotAuthorization).toContain("authorization.normalizedChampionEmail !== normalizedEmail");
    expect(pilotAuthorization).toContain("status: \"claimed\"");
    expect(pilotAuthorization).toContain("businessId: business.id");
    expect(pilotAuthorization).not.toContain("const [template]");
    expect(setup).toContain("authorizationId: pilotAuthorizationId");
    expect(setup).toContain("const isPilotSetup = pilotMode || pilotCreateMode");
    expect(setup).toContain('{isComplimentarySetup ? (isFounderComplimentary ? "Complimentary Organization Access" : "Pilot Access") : "Organization Plan"}');
    expect(setup).toContain("30-Day Complimentary Organization Pilot");
    expect(setup).toContain("$0 today");
    expect(setup).toContain('isComplimentarySetup ? "Set Up Organization"');
  });

  test("founder administration creates, lists, and safely revokes organization grants", () => {
    expect(businessRoutes).toContain('router.post("/pilot-authorizations", requireAuth, requireAdmin');
    expect(businessRoutes).toContain('router.get("/pilot-authorizations", requireAuth, requireAdmin');
    expect(businessRoutes).toContain('router.post("/pilot-authorizations/:authorizationId/revoke", requireAuth, requireAdmin');
    expect(pilotAuthorization).toContain('authorization.status !== "approved" || authorization.businessId');
    expect(pilotAdmin).toContain("Authorize New Pilot");
    expect(pilotAdmin).toContain("Revoke unused authorization");
    expect(pilotAdmin).toContain("if (!user?.isAdmin)");
  });

  test("hub supports first and subsequent independent organizations", () => {
    expect(hub).toContain("You don't have any organizations yet.");
    expect(hub).toContain("pendingPilots.map");
    expect(hub).toContain("pilotAuthorization=${encodeURIComponent(pilot.authorizationId)}");
    expect(hub).toContain('onClick={() => setLocation("/business/setup?createNew=1")}');
    expect(hub).toContain("<Plus className=\"h-4 w-4\" /> Add Organization");
  });

  test("explicit Add Organization intent cannot fall back to opening an existing dashboard", () => {
    expect(hub).not.toContain('onClick={() => setLocation("/business/start")}');
    expect(setup).toContain('get("createNew") === "1"');
    expect(setup).toContain('creationIntent: createNewMode ? "create-new" : "initial-setup"');
    expect(start).toContain('setLocation("/business-dashboard")');
  });

  test("Development founders share complimentary setup without consuming pilot grants", () => {
    expect(businessRoutes).toContain('router.get("/organization-creation-access"');
    expect(businessRoutes).toContain('process.env.NODE_ENV !== "production" && actor?.isAdmin === true');
    expect(setup).toContain('"Complimentary Organization Access"');
    expect(setup).toContain(">$0 today<");
    expect(setup).toContain("no pilot authorization is consumed");
    expect(setup).toContain("createData.paymentRequired === false");
  });

  test("explicit new organization creation is independent and idempotent", () => {
    const route = businessRoutes.slice(
      businessRoutes.indexOf('router.post("/create-org"'),
      businessRoutes.indexOf('// ── POST /api/business/dev-seed'),
    );
    expect(route).toContain('req.body?.creationIntent === "create-new"');
    expect(route).toContain("businesses.creationRequestId, creationRequestId");
    expect(route).toContain("ownerUserId: userId");
    expect(route).toContain("ensureCanonicalWorkspaceForBusiness(result.business.id)");
    expect(route).toContain("paymentRequired: !founderComplimentary");
    expect(setup).toContain('fetch("/api/business/workspace/select"');
    expect(setup).toContain("organizationId: createData.organizationId");
    expect(setup).toContain("locationId: createData.locationId");
    expect(setup).toContain('setLocation("/business-dashboard")');
  });

  test("every selected owner or admin can edit that organization's display name", () => {
    const renameRoute = businessRoutes.slice(
      businessRoutes.indexOf('router.patch("/name"'),
      businessRoutes.indexOf('// ── POST /api/business/seats'),
    );
    expect(renameRoute).toContain('resolveDashboardBusiness(req, "admin_or_owner")');
    expect(renameRoute).toContain(".update(businesses)");
    expect(renameRoute).toContain(".update(organizations)");
    expect(renameRoute).toContain("resolved.organizationId");
    expect(dashboard).toContain('aria-label="Edit organization name"');
    expect(dashboard).not.toContain("{!isAdminView && (");
  });

  test("an approved pilot user with zero organizations is routed to the Hub", () => {
    expect(businessCardState).toContain('request("/api/business/workspaces")');
    expect(businessCardState).toContain('return { state: "pilot-ready" }');
    expect(businessCardState).toContain('description: "Your complimentary organization access is ready"');
    expect(businessCardState).toContain('destination: "/business-organizations"');
  });

  test("pilot creation provisions a canonical organization and default location", () => {
    expect(businessRoutes).toContain("ensureCanonicalWorkspaceForBusiness(created.business.id)");
    expect(businessRoutes).toContain("organizationId: workspace.organizationId");
    expect(businessRoutes).toContain("locationId: workspace.locationId");
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
    expect(setup).toContain("businessId: createData.businessId");
    expect(stripeCheckout).toContain("eq(bizTable.id, businessId)");
    expect(setup).toContain("This organization uses your approved complimentary pilot access. No payment is required.");
  });
});