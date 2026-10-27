/** Hermetic SQL fixtures only: no app bootstrap, network, or real DB imports. */
import { PgDialect } from "drizzle-orm/pg-core";
import { provisionUnifiedPilotBusiness } from "../services/unifiedBusinessPilotProvisioning";
import { clinicalPilotWindow } from "../services/businessPilotActivationPolicy";

const dialect = new PgDialect();
const now = new Date("2026-10-27T12:00:00Z");
const environmentKeys = ["NODE_ENV", "REPLIT_DEPLOYMENT", "BUSINESS_PILOT_ACTIVATION_ENABLED", "BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED"] as const;
const originalEnv = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
const grant = () => ({ authorizationId: "grant-fixture", ...clinicalPilotWindow(now) });
let owned: any[];
let link: any;
let membership: boolean;
let statements: string[];
let created: number;
let tx: any;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(now);
  process.env.NODE_ENV = "development";
  delete process.env.REPLIT_DEPLOYMENT;
  process.env.BUSINESS_PILOT_ACTIVATION_ENABLED = "true";
  process.env.BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED = "true";
  owned = []; link = { business_id: null, organization_consumed: false };
  membership = true; statements = []; created = 0;
  tx = { execute: jest.fn(async (statement: any) => {
    const { sql, params } = dialect.sqlToQuery(statement);
    statements.push(sql);
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.startsWith("SELECT business_id")) return { rows: link ? [{ ...link }] : [] };
    if (sql.startsWith("SELECT id, name")) return { rows: owned };
    if (sql.startsWith("SELECT id FROM businesses")) return { rows: membership ? [{ id: link.business_id }] : [] };
    if (sql.startsWith("SELECT id FROM business_members")) return { rows: membership ? [{ id: "member" }] : [] };
    if (sql.startsWith("INSERT INTO businesses")) {
      created++;
      const business = { id: "business-fixture", name: params[0] };
      owned.push(business);
      return { rows: [business] };
    }
    if (sql.startsWith("UPDATE business_pilot_activation_links")) {
      link.business_id = params[0]; link.organization_consumed = true;
      return { rows: [{ authorization_id: "grant-fixture" }] };
    }
    return { rows: [] };
  }) };
});
afterEach(() => {
  for (const key of environmentKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  jest.useRealTimers();
});

test.each(["new-account", "existing-account"])("%s atomically binds one business with the grant's exact dates", async userId => {
  await expect(provisionUnifiedPilotBusiness(tx, userId, grant(), { organizationName: "Fixture Organization" }))
    .resolves.toEqual({ businessId: "business-fixture" });
  const inserts = tx.execute.mock.calls.map(([query]: any) => dialect.sqlToQuery(query))
    .filter((query: any) => query.sql.startsWith("INSERT INTO businesses"));
  expect(inserts).toHaveLength(1);
  expect(inserts[0].params.slice(-2)).toEqual([now, grant().endsAt]);
  expect(statements.some(sql => sql.includes("pg_advisory_xact_lock"))).toBe(true);
  expect(statements.some(sql => sql.includes("FOR UPDATE"))).toBe(true);
  expect(statements.join(" ")).not.toMatch(/UPDATE users|stripe.*=|INSERT INTO studio|affiliate|rewardful/i);
});

test("repeated activation and partial canonical-workspace recovery reuse the persisted business", async () => {
  await provisionUnifiedPilotBusiness(tx, "user", grant(), { organizationName: "Fixture" });
  const checkpoint = { ...link };
  for (let i = 0; i < 3; i++) await provisionUnifiedPilotBusiness(tx, "user", grant());
  expect(created).toBe(1);
  expect(link).toEqual(checkpoint);
  expect(statements.filter(sql => sql.startsWith("UPDATE business_pilot_activation_links"))).toHaveLength(1);
});

test("concurrent fixture transactions serialize on the owner checkpoint and create one business", async () => {
  // Model PostgreSQL's transaction-scoped advisory lock with a fixture queue.
  // This proves replay behavior, not a live PostgreSQL concurrency/load test.
  let tail = Promise.resolve();
  const transaction = async () => {
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      return await provisionUnifiedPilotBusiness(tx, "user", grant(), { organizationName: "Fixture" });
    } finally { release(); }
  };
  const results = await Promise.all(Array.from({ length: 5 }, transaction));
  expect(results.every(result => result.businessId === "business-fixture")).toBe(true);
  expect(created).toBe(1);
  expect(statements.filter(sql => sql.includes("pg_advisory_xact_lock"))).toHaveLength(5);
});

test("a provisioning failure is recoverable by rolling back the enclosing claim transaction", async () => {
  const snapshot = { owned: [...owned], link: { ...link } };
  const execute = tx.execute.getMockImplementation();
  tx.execute.mockImplementation(async (statement: any) => {
    if (dialect.sqlToQuery(statement).sql.startsWith("UPDATE business_pilot_activation_links")) {
      throw new Error("fixture binding failure");
    }
    return execute(statement);
  });
  await expect((async () => {
    try { await provisionUnifiedPilotBusiness(tx, "user", grant(), { organizationName: "Fixture" }); }
    catch (error) { owned = snapshot.owned; link = snapshot.link; throw error; }
  })()).rejects.toThrow("fixture binding failure");
  expect(owned).toEqual([]);
  expect(link).toEqual({ business_id: null, organization_consumed: false });
});

test("an existing unpaid organization pilot requires reconciliation without changing its window", async () => {
  owned = [{ id: "old-business", status: "active", commercial_access_mode: "onboarding_pilot",
    commercial_access_started_at: "2026-10-12T15:41:27.737Z", commercial_access_ends_at: "2026-11-11T15:41:27.737Z" }];
  await expect(provisionUnifiedPilotBusiness(tx, "user", grant())).rejects.toMatchObject({ code: "PILOT_RECONCILIATION_REQUIRED" });
  expect(statements.every(sql => !/^(INSERT|UPDATE)/.test(sql))).toBe(true);
});

test("an already-coordinated legacy partial activation is attached without another period", async () => {
  owned = [{ id: "existing", status: "active", commercial_access_mode: "onboarding_pilot",
    commercial_access_started_at: now, commercial_access_ends_at: grant().endsAt }];
  await expect(provisionUnifiedPilotBusiness(tx, "user", grant())).resolves.toEqual({ businessId: "existing" });
  expect(created).toBe(0);
  expect(statements.some(sql => sql.startsWith("UPDATE businesses"))).toBe(false);
});

test("existing paid organization is reused without replacing its commercial or Stripe history", async () => {
  owned = [{ id: "paid", status: "active", commercial_access_mode: "paid", stripe_subscription_id: "fixture-only" }];
  await expect(provisionUnifiedPilotBusiness(tx, "user", grant())).resolves.toEqual({ businessId: "paid" });
  expect(statements.some(sql => sql.startsWith("UPDATE businesses"))).toBe(false);
});

test("multiple organizations need an explicit authorized selection", async () => {
  owned = ["one", "two"].map(id => ({ id, status: "active", commercial_access_mode: "paid" }));
  await expect(provisionUnifiedPilotBusiness(tx, "user", grant())).rejects.toMatchObject({ code: "PILOT_ORGANIZATION_SELECTION_REQUIRED" });
  await expect(provisionUnifiedPilotBusiness(tx, "user", grant(), { businessId: "unowned" }))
    .rejects.toMatchObject({ code: "PILOT_ORGANIZATION_FORBIDDEN" });
  await expect(provisionUnifiedPilotBusiness(tx, "user", grant(), { businessId: "two" })).resolves.toEqual({ businessId: "two" });
});

test("removed owner membership cannot be restored by activation", async () => {
  owned = [{ id: "paid", status: "active", commercial_access_mode: "paid" }]; membership = false;
  await expect(provisionUnifiedPilotBusiness(tx, "user", grant())).rejects.toMatchObject({ code: "PILOT_ORGANIZATION_FORBIDDEN" });
});

test("expired grant cannot create a workspace or additional trial time", async () => {
  jest.setSystemTime(grant().endsAt);
  await expect(provisionUnifiedPilotBusiness(tx, "user", grant(), { organizationName: "Late" })).resolves.toEqual({});
  expect(statements.every(sql => !/^(INSERT|UPDATE)/.test(sql))).toBe(true);
});

test.each(["production", "deployment", "disabled"])("%s does not activate the repair", async mode => {
  if (mode === "production") process.env.NODE_ENV = "production";
  if (mode === "deployment") process.env.REPLIT_DEPLOYMENT = "1";
  if (mode === "disabled") process.env.BUSINESS_PILOT_ACTIVATION_ENABLED = "false";
  await expect(provisionUnifiedPilotBusiness(tx, "user", grant(), { organizationName: "No" })).resolves.toEqual({});
  expect(tx.execute).not.toHaveBeenCalled();
});
