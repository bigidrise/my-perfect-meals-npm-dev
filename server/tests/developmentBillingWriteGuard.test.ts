const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; jest.resetModules(); });

function guard(runtime = "development") {
  jest.resetModules();
  process.env.NODE_ENV = runtime;
  return require("../services/developmentBillingWriteGuard");
}

const billingWrites = [
  "UPDATE users SET stripe_customer_id = $1 WHERE id = $2",
  'UPDATE "users" SET "personal_subscription_status" = $1 WHERE id = $2',
  'UPDATE public.users SET studio_stripe_subscription_id = $1 WHERE id = $2',
  "UPDATE users SET subscription_plan = $1",
  "UPDATE users SET entitlements = $1",
  "UPDATE businesses SET stripe_subscription_id = $1",
  "UPDATE businesses SET status = $1",
  "INSERT INTO stripe_billing_events (event_id) VALUES ($1)",
  "INSERT INTO stripe_identity_owners (user_id) VALUES ($1)",
  "DELETE FROM stripe_service_subscription_snapshots",
  "INSERT INTO organization_checkout_consents (reservation_id) VALUES ($1)",
  "INSERT INTO partner_promotions (name) VALUES ($1)",
  "WITH changed AS (UPDATE users SET plan_lookup_key=$1 RETURNING id) SELECT * FROM changed",
  "DELETE FROM users WHERE id=$1", // financial FK effects
  "DELETE FROM businesses WHERE id=$1",
  "TRUNCATE meal_logs, stripe_billing_events",
  "DO $$ BEGIN UPDATE users SET subscription_status='active'; END $$",
  "CALL billing_update($1)",
];

describe("Development billing database firewall", () => {
  it.each(billingWrites)("rejects billing SQL before the underlying query: %s", async text => {
    const query = jest.fn();
    const target = { query };
    guard().installDevelopmentBillingWriteGuard(target);
    await expect(target.query(text, ["fixture", "fixture"])).rejects.toMatchObject({
      code: "DEVELOPMENT_STRIPE_ISOLATION",
    });
    expect(query).not.toHaveBeenCalled();
  });
  it.each([
    "SELECT * FROM users WHERE id=$1",
    "SELECT 1", "BEGIN", "COMMIT", "ROLLBACK",
    "UPDATE users SET professional_role=$1 WHERE id=$2",
    "UPDATE users SET last_login_at=now() WHERE id=$1",
    "UPDATE business_pilot_authorizations SET status=$1 WHERE id=$2",
    "INSERT INTO business_pilot_activation_links (authorization_id, token_hash) VALUES ($1,$2)",
    "INSERT INTO business_members (business_id,user_id,role) VALUES ($1,$2,$3)",
    "INSERT INTO organizations (id) VALUES ($1)",
  ])("permits nonbilling/free-workflow SQL: %s", async text => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const target = { query };
    guard().installDevelopmentBillingWriteGuard(target);
    await target.query(text, ["fixture", "fixture", "owner"]);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it.each(["onboarding_pilot", "business_pilot"])("permits a free Organization mode %s", async mode => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const target = { query };
    guard().installDevelopmentBillingWriteGuard(target);
    await target.query('INSERT INTO "businesses" ("name","status","commercial_access_mode") VALUES ($1,$2,$3)', ["Fixture","active",mode]);
    await target.query("UPDATE businesses SET status=$1, commercial_access_mode=$2 WHERE id=$3", ["active",mode,"fixture"]);
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("rejects a paid Organization state before sending SQL", async () => {
    const query = jest.fn();
    const target = { query };
    guard().installDevelopmentBillingWriteGuard(target);
    await expect(target.query("UPDATE businesses SET commercial_access_mode=$1", ["paid"]))
      .rejects.toMatchObject({ code: "DEVELOPMENT_STRIPE_ISOLATION" });
    expect(query).not.toHaveBeenCalled();
  });
  it("handles config queries, named statements, callbacks and checked-out clients", async () => {
    const query = jest.fn();
    const transactionClient = { query };
    guard().installDevelopmentBillingWriteGuard(transactionClient);
    await expect(transactionClient.query({ name: "billing", text: "UPDATE users SET stripe_customer_id=$1", values: ["fixture"] }))
      .rejects.toMatchObject({ code: "DEVELOPMENT_STRIPE_ISOLATION" });
    await expect(transactionClient.query({ name: "unknown", values: [] }))
      .rejects.toMatchObject({ code: "DEVELOPMENT_STRIPE_ISOLATION" });
    await new Promise<void>(resolve => {
      transactionClient.query("UPDATE users SET stripe_customer_id=$1", ["fixture"], (error: any) => {
        expect(error.code).toBe("DEVELOPMENT_STRIPE_ISOLATION");
        resolve();
      });
    });
    expect(query).not.toHaveBeenCalled();
  });
  it("does not inspect or replace Production query handling", () => {
    const query = jest.fn();
    const target = { query };
    guard("production").installDevelopmentBillingWriteGuard(target);
    expect(target.query).toBe(query);
    target.query("UPDATE users SET stripe_customer_id=$1", ["fixture"]);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("guards actual Drizzle-generated mutations without loading the application or pg", async () => {
    const { drizzle } = require("drizzle-orm/node-postgres");
    const { pgTable, text } = require("drizzle-orm/pg-core");
    const { eq } = require("drizzle-orm");
    const users = pgTable("users", { id: text("id"), stripeCustomerId: text("stripe_customer_id") });
    const query = jest.fn();
    const target = { query };
    guard().installDevelopmentBillingWriteGuard(target);
    const db = drizzle(target);
    await expect(db.update(users).set({ stripeCustomerId: "cus_fixture" }).where(eq(users.id, "fixture")))
      .rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it("allows actual free Organization inserts with Drizzle's inert billing-column defaults", async () => {
    const { drizzle } = require("drizzle-orm/node-postgres");
    const { businesses } = require("../db/schema/business");
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const target = { query };
    guard().installDevelopmentBillingWriteGuard(target);
    const db = drizzle(target);
    await db.insert(businesses).values({
      name: "Free fixture", ownerUserId: "fixture", plan: "clinical_business_monthly",
      seatLimit: 1, status: "active", commercialAccessMode: "onboarding_pilot",
      commercialAccessStartedAt: new Date("2026-10-11T00:00:00Z"),
      commercialAccessEndsAt: new Date("2026-11-10T00:00:00Z"),
    }).returning();
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("rejects an explicitly Stripe-backed Organization insert despite a free-mode label", async () => {
    const { drizzle } = require("drizzle-orm/node-postgres");
    const { businesses } = require("../db/schema/business");
    const query = jest.fn();
    const target = { query };
    guard().installDevelopmentBillingWriteGuard(target);
    await expect(drizzle(target).insert(businesses).values({
      name: "Blocked fixture", ownerUserId: "fixture", commercialAccessMode: "onboarding_pilot",
      stripeSubscriptionId: "sub_fixture",
    })).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it.each([
    "INSERT INTO organizations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
    "INSERT INTO organization_locations (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET name=$2",
  ])("permits free canonical workspace upserts: %s", async text => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const target = { query };
    guard().installDevelopmentBillingWriteGuard(target);
    await target.query(text, ["fixture", "Free fixture"]);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("rejects a parent upsert hiding a Stripe assignment outside its INSERT columns", async () => {
    const query = jest.fn();
    const target = { query };
    guard().installDevelopmentBillingWriteGuard(target);
    await expect(target.query("INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET stripe_customer_id=$2", ["fixture","cus_fixture"]))
      .rejects.toMatchObject({ code: "DEVELOPMENT_STRIPE_ISOLATION" });
    expect(query).not.toHaveBeenCalled();
  });
});
