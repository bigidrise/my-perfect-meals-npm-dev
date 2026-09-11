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
const checkout = fs.readFileSync(path.join(root, "server/routes/stripeCheckout.ts"), "utf8");

describe("multi-organization owner setup", () => {
  test("create-org does not reject an owner merely for active staff membership elsewhere", () => {
    const route = businessRoutes.slice(
      businessRoutes.indexOf('router.post("/create-org"'),
      businessRoutes.indexOf('// ── POST /api/business/dev-seed'),
    );
    expect(route).not.toContain("activeElsewhere");
    expect(route).not.toContain("ALREADY_IN_ANOTHER_BUSINESS");
    expect(route).toContain('setupRelationship === "owner_manager" ? "owner" : "admin"');
    expect(route).toContain('status: "active"');
  });

  test("creation is idempotent per setup attempt rather than per user", () => {
    expect(businessSchema).not.toContain('ownerUserId: text("owner_user_id").notNull().unique()');
    expect(businessRoutes).toContain("businesses.creationRequestId, creationRequestId");
    expect(businessRoutes).not.toContain("Idempotent: return existing record if user is already an owner");
  });

  test("on-behalf setup does not designate the creator as owner", () => {
    expect(businessRoutes).toContain('ownerUserId: setupRelationship === "owner_manager" ? userId : null');
    expect(businessRoutes).toContain('role: setupRelationship === "owner_manager" ? "owner" : "admin"');
    expect(setup).toContain("This does not designate you as its legal owner.");
  });

  test("hub supports first and subsequent independent organizations", () => {
    expect(hub).toContain("You don't have any organizations yet.");
    expect(hub.match(/Add Organization/g)?.length).toBeGreaterThanOrEqual(2);
    expect(hub).toContain('setLocation("/business/setup?new=1")');
  });

  test("checkout targets the exact newly created organization", () => {
    expect(setup).toContain("JSON.stringify({ businessId: createData.businessId })");
    expect(checkout).toContain("eq(bizTable.id, businessId)");
    expect(checkout).toContain("memberTable.role} IN ('owner', 'admin')");
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

  test("checkout remains strictly after successful organization creation", () => {
    const createFetch = setup.indexOf('fetch("/api/business/create-org"');
    const createSuccessGate = setup.indexOf("if (!createRes.ok)", createFetch);
    const checkoutFetch = setup.indexOf('fetch("/api/stripe/checkout/business"', createSuccessGate);
    expect(createFetch).toBeGreaterThan(-1);
    expect(createSuccessGate).toBeGreaterThan(createFetch);
    expect(checkoutFetch).toBeGreaterThan(createSuccessGate);
  });
});