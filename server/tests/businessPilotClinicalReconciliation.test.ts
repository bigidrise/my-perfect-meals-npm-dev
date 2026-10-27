/** Fully isolated SQL/transaction fixtures; no application DB or live services. */
import { PgDialect } from "drizzle-orm/pg-core";
import {
  BUSINESS_PILOT_RECONCILIATION_SOURCE, createBusinessPilotClinicalReconciliation,
  getActiveBusinessPilotClinicalReconciliation, revokeBusinessPilotClinicalReconciliation,
  reconciliationWindowIsActive,
} from "../services/businessPilotClinicalReconciliation";
import { canAccessHydration } from "../../client/src/lib/entitlements";
import { isEssentialOrAbove, isProOrAbove, isClinicalOrAbove } from "../../client/src/lib/subscriptionCheck";
import { requireClinicalAccess } from "../middleware/requireClinicalAccess";
import { requireProAccess } from "../middleware/requireProAccess";
import { requireHydrationCenterAccess } from "../middleware/requirePurchasedPlanEntitlement";

const dialect = new PgDialect();
const now = new Date("2026-10-27T16:00:00Z");
// Synthetic period. No real account IDs, grant records or approval references.
const start = new Date("2026-10-12T15:41:27.737Z");
const end = new Date("2026-11-11T15:41:27.737Z");
const approval = () => ({
  userId: "fixture-user", expectedEmail: "fixture@example.invalid", businessId: "fixture-business",
  organizationId: "fixture-organization", originalStartedAt: start, expectedExpiresAt: end,
  approvedByUserId: "fixture-operator", approvalReference: "a".repeat(64),
  reason: "Explicitly approved correction of missing consumer access.",
});
let stored: any;
let operator: boolean;
let source: any;
let statements: { sql: string; params: unknown[] }[];
let inserts: number;
let failInsert: boolean;
let executor: any;
let oldSwitch: string | undefined;
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(now);
  oldSwitch = process.env.BUSINESS_PILOT_RECONCILIATION_ENABLED;
  process.env.BUSINESS_PILOT_RECONCILIATION_ENABLED = "true";
  stored = null; operator = true; statements = []; inserts = 0; failInsert = false;
  source = {
    matched_user_id: "fixture-user", matched_business_id: "fixture-business",
    matched_organization_id: "fixture-organization", matched_start: start, matched_end: end,
    matched_status: "active", matched_mode: "onboarding_pilot", matched_org_status: "active",
    matched_member_role: "owner", matched_member_status: "active",
  };
  let tail = Promise.resolve();
  executor = {
    execute: jest.fn(async (query: any) => {
      const { sql, params } = dialect.sqlToQuery(query); statements.push({ sql, params });
      if (sql.startsWith("SET LOCAL")) return { rows: [] };
      if (sql.startsWith("SELECT id FROM users")) return { rows: operator ? [{ id: "fixture-operator" }] : [] };
      if (sql.startsWith("SELECT b.id")) {
        const match = params[0] === source.matched_user_id && params[1] === "fixture@example.invalid"
          && params[2] === source.matched_business_id && params[3] === source.matched_organization_id
          && Number(params[4]) === Number(source.matched_start) && Number(params[5]) === Number(source.matched_end)
          && source.matched_status === "active" && source.matched_mode === "onboarding_pilot"
          && source.matched_member_role === "owner" && source.matched_member_status === "active";
        return { rows: match ? [{ id: source.matched_business_id }] : [] };
      }
      if (sql.startsWith("INSERT INTO business_pilot_clinical_reconciliations")) {
        if (stored) return { rows: [] };
        inserts++;
        stored = {
          id: "fixture-reconciliation", user_id: params[0], organization_id: params[1], source_business_id: params[2],
          authorization_source: params[3], approval_reference: params[4], approved_by_user_id: params[5],
          correction_reason: params[6], original_pilot_started_at: params[7], original_pilot_ends_at: params[8],
          expires_at: params[9], granted_at: params[10], revoked_at: null,
        };
        if (failInsert) throw new Error("fixture failure after insert");
        return { rows: [{ ...stored }] };
      }
      if (sql.startsWith("SELECT r.*")) return { rows: stored ? [{ ...stored, ...source }] : [] };
      if (sql.startsWith("UPDATE business_pilot_clinical_reconciliations")) {
        if (!stored || stored.revoked_at) return { rows: [] };
        stored = { ...stored, revoked_at: params[0], revoked_by_user_id: params[1], revocation_reference: params[2] };
        return { rows: [{ ...stored }] };
      }
      if (sql.startsWith("SELECT * FROM business_pilot_clinical_reconciliations")) return { rows: stored ? [{ ...stored }] : [] };
      throw new Error("Unexpected fixture SQL");
    }),
    transaction: async (callback: any) => {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      const snapshot = stored ? { ...stored } : null;
      try { return await callback(executor); }
      catch (error) { stored = snapshot; throw error; }
      finally { release(); }
    },
  };
});
afterEach(() => {
  if (oldSwitch === undefined) delete process.env.BUSINESS_PILOT_RECONCILIATION_ENABLED;
  else process.env.BUSINESS_PILOT_RECONCILIATION_ENABLED = oldSwitch;
  jest.useRealTimers();
});

test("disabled mechanism performs no database operations", async () => {
  delete process.env.BUSINESS_PILOT_RECONCILIATION_ENABLED;
  expect(await getActiveBusinessPilotClinicalReconciliation("fixture-user", executor)).toBeNull();
  await expect(createBusinessPilotClinicalReconciliation(approval(), executor))
    .rejects.toMatchObject({ code: "RECONCILIATION_NOT_OPERATIONAL" });
  expect(executor.execute).not.toHaveBeenCalled();
});

test("controlled grant records original dates, source, approval, actor and correction time without invitation history", async () => {
  const result = await createBusinessPilotClinicalReconciliation(approval(), executor);
  expect(result).toMatchObject({ active: true, alreadyExisted: false, expiresAt: end, correctedAt: now,
    authorizationSource: BUSINESS_PILOT_RECONCILIATION_SOURCE });
  expect(stored).toMatchObject({ original_pilot_started_at: start, original_pilot_ends_at: end,
    granted_at: now, approved_by_user_id: "fixture-operator", approval_reference: "a".repeat(64) });
  expect(JSON.stringify(result)).not.toContain("fixture@example.invalid");
  const writes = statements.filter(query => /^(INSERT|UPDATE|DELETE)/.test(query.sql));
  expect(writes).toHaveLength(1);
  expect(writes[0].sql).toMatch(/^INSERT INTO business_pilot_clinical_reconciliations/);
  expect(writes[0].sql).not.toMatch(/activation_links|auth_token|stripe|affiliate|UPDATE users|UPDATE businesses/i);
});

test("repeated and concurrent fixture transactions preserve one grant and one unchanged clock", async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () => createBusinessPilotClinicalReconciliation(approval(), executor)));
  expect(inserts).toBe(1);
  expect(results.filter(result => !result.alreadyExisted)).toHaveLength(1);
  expect(results.every(result => result.expiresAt.getTime() === end.getTime())).toBe(true);
  expect(new Set(results.map(result => result.reconciliationId)).size).toBe(1);
});

test.each([
  ["userId", "someone-else"], ["expectedEmail", "another@example.invalid"],
  ["businessId", "other-business"], ["organizationId", "other-organization"],
  ["expectedExpiresAt", new Date(end.getTime() + 1)],
  ["originalStartedAt", new Date(start.getTime() + 1)],
])("write rejects changed approval binding %s", async (key, value) => {
  await expect(createBusinessPilotClinicalReconciliation({ ...approval(), [key as string]: value }, executor))
    .rejects.toMatchObject({ code: "RECONCILIATION_SOURCE_MISMATCH" });
  expect(stored).toBeNull();
});

test("ownership and organization access alone do not create reconciliation authority", async () => {
  expect(await getActiveBusinessPilotClinicalReconciliation("fixture-user", executor)).toBeNull();
  operator = false;
  await expect(createBusinessPilotClinicalReconciliation(approval(), executor))
    .rejects.toMatchObject({ code: "RECONCILIATION_OPERATOR_REQUIRED" });
  expect(stored).toBeNull();
});

test.each(["matched_user_id", "matched_business_id", "matched_organization_id", "matched_status",
  "matched_mode", "matched_org_status", "matched_member_role", "matched_member_status"])(
  "reader rejects mismatched or inactive source field %s", async field => {
    await createBusinessPilotClinicalReconciliation(approval(), executor);
    source[field] = "mismatch";
    expect(await getActiveBusinessPilotClinicalReconciliation("fixture-user", executor)).toBeNull();
  },
);
test.each(["matched_start", "matched_end"])("reader rejects changed original source timestamp %s", async field => {
  await createBusinessPilotClinicalReconciliation(approval(), executor);
  source[field] = new Date(Number(source[field]) + 1);
  expect(await getActiveBusinessPilotClinicalReconciliation("fixture-user", executor)).toBeNull();
});

test("only the exact authorization source and unchanged expiration are recognized", async () => {
  await createBusinessPilotClinicalReconciliation(approval(), executor);
  stored.authorization_source = "organization-owner";
  expect(await getActiveBusinessPilotClinicalReconciliation("fixture-user", executor)).toBeNull();
  stored.authorization_source = BUSINESS_PILOT_RECONCILIATION_SOURCE;
  stored.expires_at = new Date(end.getTime() + 1);
  expect(await getActiveBusinessPilotClinicalReconciliation("fixture-user", executor)).toBeNull();
});

test("valid consumer authority opens actual Essential/Pro/Clinical/Hydration helpers and backend gates", async () => {
  await createBusinessPilotClinicalReconciliation(approval(), executor);
  const grant = await getActiveBusinessPilotClinicalReconciliation("fixture-user", executor);
  expect(grant).toMatchObject({ reconciliationId: "fixture-reconciliation", endsAt: end });
  for (const planLookupKey of [null, "mpm_basic_monthly", "mpm_premium_monthly"]) {
    const user = { id: "fixture-user", accessTier: "PAID_FULL", planLookupKey, temporaryClinicalAccess: true,
      businessPilotUnifiedAccess: true, businessPilotClinicalAccessEndsAt: grant!.endsAt };
    for (const check of [isEssentialOrAbove, isProOrAbove, isClinicalOrAbove, canAccessHydration]) expect(check(user)).toBe(true);
    for (const gate of [requireClinicalAccess, requireProAccess, requireHydrationCenterAccess]) {
      const next = jest.fn(); const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      gate({ authUser: user } as any, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    }
    expect(user.planLookupKey).toBe(planLookupKey);
  }
});

test("authority closes at the exact existing expiration, not another 30 days", async () => {
  await createBusinessPilotClinicalReconciliation(approval(), executor);
  expect(reconciliationWindowIsActive(stored, "fixture-user", new Date(end.getTime() - 1))).toBe(true);
  expect(reconciliationWindowIsActive(stored, "fixture-user", end)).toBe(false);
  jest.setSystemTime(end);
  expect(await getActiveBusinessPilotClinicalReconciliation("fixture-user", executor)).toBeNull();
  await expect(createBusinessPilotClinicalReconciliation(approval(), executor))
    .rejects.toMatchObject({ code: "RECONCILIATION_INVALID" });
});

test("revocation changes only reconciliation authority and cannot be undone by repeat approval", async () => {
  await createBusinessPilotClinicalReconciliation(approval(), executor);
  const result = await revokeBusinessPilotClinicalReconciliation({
    reconciliationId: stored.id, approvedByUserId: "fixture-operator", approvalReference: "b".repeat(64),
  }, executor);
  expect(result).toMatchObject({ active: false, revoked: true, expiresAt: end });
  expect(await getActiveBusinessPilotClinicalReconciliation("fixture-user", executor)).toBeNull();
  expect(await createBusinessPilotClinicalReconciliation(approval(), executor)).toMatchObject({ active: false, revoked: true, alreadyExisted: true });
  expect(statements.filter(query => query.sql.startsWith("UPDATE")).every(query =>
    query.sql.startsWith("UPDATE business_pilot_clinical_reconciliations"))).toBe(true);
});

test("a partial transaction failure rolls back and can retry without extending the approved window", async () => {
  failInsert = true;
  await expect(createBusinessPilotClinicalReconciliation(approval(), executor)).rejects.toThrow("fixture failure");
  expect(stored).toBeNull();
  failInsert = false;
  expect(await createBusinessPilotClinicalReconciliation(approval(), executor)).toMatchObject({ active: true, expiresAt: end });
});

test("expiry while waiting for source locks cannot be reported as an active correction", async () => {
  const execute = executor.execute.getMockImplementation();
  executor.execute.mockImplementation(async (query: any) => {
    const result = await execute(query);
    if (dialect.sqlToQuery(query).sql.startsWith("SELECT b.id")) jest.setSystemTime(end);
    return result;
  });
  await expect(createBusinessPilotClinicalReconciliation(approval(), executor))
    .rejects.toMatchObject({ code: "RECONCILIATION_EXPIRED" });
  expect(stored).toBeNull();
});
