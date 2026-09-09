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

describe("multi-organization owner setup", () => {
  test("create-org does not reject an owner merely for active staff membership elsewhere", () => {
    const route = businessRoutes.slice(
      businessRoutes.indexOf('router.post("/create-org"'),
      businessRoutes.indexOf('// ── POST /api/business/dev-seed'),
    );
    expect(route).not.toContain("activeElsewhere");
    expect(route).not.toContain("ALREADY_IN_ANOTHER_BUSINESS");
    expect(route).toContain('role: "owner"');
    expect(route).toContain('status: "active"');
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