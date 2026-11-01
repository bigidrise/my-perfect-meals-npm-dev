/** Hermetic: never import the application bootstrap or connect to a database. */
jest.mock("../db", () => {
  const query: any = {
    from: jest.fn().mockReturnThis(), innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(), limit: jest.fn(async () => []),
  };
  return { db: { execute: jest.fn(), select: jest.fn(() => query) }, query };
});
jest.mock("../services/pilotProcareAccess", () => ({
  getActivePilotProCareGrant: jest.fn(async () => null),
  getPilotClientSponsorshipState: jest.fn(async () => ({ linked: false, active: false })),
}));
jest.mock("../services/pilotProgramAccess", () => ({ getActivePilotFullAccess: jest.fn(async () => null) }));
jest.mock("../services/clinicPilotEnrollmentService", () => ({
  getActiveClinicTrialEntitlement: jest.fn(async () => null),
  getActiveProfessionalTemporaryAccess: jest.fn(async () => null),
}));
jest.mock("../services/businessOfferLinkService", () => ({ getActiveBusinessOfferEntitlement: jest.fn(async () => null) }));
jest.mock("../services/businessPilotActivationService", () => ({
  getActiveBusinessPilotClinicalAccess: jest.fn(async () => null),
}));

process.env.BILLING_ENFORCED = "true";
import { PgDialect } from "drizzle-orm/pg-core";
import { getActivePersonalClinicalReconciliation } from "../services/personalClinicalReconciliation";
import { computeEffectiveAccess } from "../services/effectiveAccess";
import { resolveAccessTier } from "../lib/accessTier";
import { hasPersonalClinicalReconciliationAccess } from "../lib/personalClinicalReconciliationAccess";
import { requireEssentialAccess } from "../middleware/requireEssentialAccess";
import { requireProAccess } from "../middleware/requireProAccess";
import { requireClinicalAccess, requireStrictClinicalAccess } from "../middleware/requireClinicalAccess";
import { requireClinicalLabsAccess } from "../middleware/requireClinicalLabsAccess";
import { requirePurchasedPlanEntitlement } from "../middleware/requirePurchasedPlanEntitlement";
import { canAccessProCareStudio } from "../../shared/planFeatures";

const { db, query } = jest.requireMock("../db");
const start = new Date("2026-10-12T15:41:27.737Z");
const end = new Date("2026-11-11T15:41:27.737Z");
const now = new Date("2026-10-27T15:00:00Z");
const fixture = () => ({ id: "grant-fixture", starts_at: start, ends_at: end });
const dialect = new PgDialect();
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(now);
  process.env.BUSINESS_PILOT_RECONCILIATION_ENABLED = "true";
  process.env.BUSINESS_PILOT_RECONCILIATION_SCHEMA_APPROVED = "true";
  db.execute.mockReset().mockResolvedValue({ rows: [fixture()] });
  query.limit.mockResolvedValue([]);
});
afterEach(() => jest.useRealTimers());

test.each(["BUSINESS_PILOT_RECONCILIATION_ENABLED", "BUSINESS_PILOT_RECONCILIATION_SCHEMA_APPROVED"])(
  "disabled %s performs no SQL", async key => {
    delete process.env[key];
    expect(await getActivePersonalClinicalReconciliation("owner", now)).toBeNull();
    expect(db.execute).not.toHaveBeenCalled();
  },
);
test("reader binds the exact actor, revocation, dates, active organization and ownership", async () => {
  expect((await getActivePersonalClinicalReconciliation("owner", now))?.endsAt).toEqual(end);
  const compiled = dialect.sqlToQuery(db.execute.mock.calls[0][0]);
  expect(compiled.params).toContain("owner");
  for (const clause of [
    "g.user_id =", "g.status = 'active'", "g.revoked_at IS NULL",
    "g.starts_at <=", "g.ends_at >", "b.owner_user_id = g.user_id",
    "b.commercial_access_started_at = g.starts_at", "b.commercial_access_ends_at = g.ends_at",
    "b.status = 'active'", "b.commercial_access_mode = 'onboarding_pilot'",
  ]) expect(compiled.sql).toContain(clause);
});
test.each([
  [start, start, true],
  [new Date(end.getTime() - 1), start, true],
  [end, start, false],
  [new Date(end.getTime() + 1), start, false],
  [new Date(start.getTime() - 1), start, false],
])("reader exact boundary %s", async (at, from, allowed) => {
  db.execute.mockResolvedValue({ rows: [{ ...fixture(), starts_at: from }] });
  expect(Boolean(await getActivePersonalClinicalReconciliation("owner", at as Date))).toBe(allowed);
});
test.each([null, "infinity", "invalid", new Date(end.getTime() + 1)])(
  "invalid or extended stored end is denied: %s", async value => {
    db.execute.mockResolvedValue({ rows: [{ ...fixture(), ends_at: value }] });
    expect(await getActivePersonalClinicalReconciliation("owner", now)).toBeNull();
  },
);
test("missing, revoked and unrelated users receive no grant", async () => {
  db.execute.mockResolvedValue({ rows: [] });
  expect(await getActivePersonalClinicalReconciliation("other", now)).toBeNull();
});
test("schema/read errors do not become an entitlement", async () => {
  db.execute.mockRejectedValue(new Error("missing schema"));
  await expect(getActivePersonalClinicalReconciliation("owner", now)).rejects.toThrow("missing schema");
});

function gate(middleware: any, authUser?: any) {
  const next = jest.fn();
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  middleware({ authUser } as any, res, next);
  return { next, res };
}
const personalGates = [
  ["Essential", requireEssentialAccess],
  ["Pro", requireProAccess],
  ["Clinical", requireClinicalAccess],
  ["Strict Clinical", requireStrictClinicalAccess],
  ["Clinical Labs", requireClinicalLabsAccess],
  ["Hydration", requirePurchasedPlanEntitlement("hydration_center")],
] as const;

test.each([null, "mpm_basic_monthly", "mpm_premium_monthly", "mpm_ultimate_monthly"])(
  "real resolver preserves billing identity and grants personal access over %s", async key => {
    const input = Object.freeze({ id: "owner", planLookupKey: key, personalPlanLookupKey: key });
    const before = JSON.stringify(input);
    const effective = await computeEffectiveAccess(input);
    const accessTier = resolveAccessTier({
      ...input, hasTemporaryClinicalAccess: effective.temporaryClinicalAccess,
    }, now);
    expect(effective.planLookupKey).toBe(key);
    expect(effective.tier).toBe("ultimate");
    expect(effective.entitlements).toEqual(expect.arrayContaining(["hydration_center", "lab_metrics"]));
    expect(effective.personalClinicalReconciliationEndsAt).toEqual(end);
    expect(JSON.stringify(input)).toBe(before);
    const authUser = { ...effective, accessTier };
    for (const [, middleware] of personalGates) expect(gate(middleware, authUser).next).toHaveBeenCalledTimes(1);
    expect(canAccessProCareStudio({
      billingEnforced: true, accessTier, planLookupKey: effective.planLookupKey,
      sponsoredProCareAccess: effective.sponsoredProCareAccess,
      pilotProCareAccess: effective.pilotProCareAccess,
      sponsoredByBusinessId: effective.sponsoredByBusinessId,
    })).toBe(false);
  },
);
test("existing flat-fee owner receives personal access, not sponsored practitioner access", async () => {
  query.limit.mockResolvedValue([{
    businessId: "business-fixture", businessName: "Example Clinic",
    businessOwnerUserId: "owner", membershipRole: "owner", plan: "clinical_business_monthly",
  }]);
  const effective = await computeEffectiveAccess({ id: "owner", planLookupKey: null });
  expect(effective.planLookupKey).toBeNull();
  expect(effective.temporaryClinicalAccess).toBe(true);
  expect(effective.sponsoredProCareAccess).toBe(false);
  expect(effective.pilotProCareAccess).toBe(false);
});
test.each(personalGates)("%s still denies unauthenticated requests", (_label, middleware) => {
  const { next, res } = gate(middleware);
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(401);
});
test.each(["mpm_basic_monthly", "mpm_premium_monthly"])(
  "revoked/absent grant leaves lower plan %s unchanged", async key => {
    db.execute.mockResolvedValue({ rows: [] });
    const effective = await computeEffectiveAccess({ id: "owner", planLookupKey: key });
    const authUser = { ...effective, accessTier: "PAID_FULL" };
    expect(effective.temporaryClinicalAccess).toBe(false);
    expect(effective.personalClinicalReconciliationEndsAt).toBeNull();
    expect(gate(requireClinicalAccess, authUser).next).not.toHaveBeenCalled();
    if (key === "mpm_basic_monthly") {
      expect(gate(requirePurchasedPlanEntitlement("hydration_center"), authUser).next).not.toHaveBeenCalled();
    }
  },
);
test("marker expires at the exact millisecond even on an already-resolved auth snapshot", () => {
  const auth = { accessTier: "PAID_FULL", planLookupKey: "mpm_basic_monthly",
    personalClinicalReconciliationEndsAt: end };
  expect(hasPersonalClinicalReconciliationAccess(auth, new Date(end.getTime() - 1))).toBe(true);
  jest.setSystemTime(end);
  expect(hasPersonalClinicalReconciliationAccess(auth)).toBe(false);
  expect(gate(requireClinicalAccess, auth).next).not.toHaveBeenCalled();
  expect(gate(requirePurchasedPlanEntitlement("hydration_center"), auth).next).not.toHaveBeenCalled();
});
test("request fields cannot grant access without a server-authenticated marker", () => {
  expect(hasPersonalClinicalReconciliationAccess({ accessTier: "FREE",
    personalClinicalReconciliationEndsAt: end })).toBe(false);
  expect(hasPersonalClinicalReconciliationAccess({ accessTier: "PAID_FULL",
    personalClinicalReconciliationEndsAt: "infinity" })).toBe(false);
  expect(gate(requireClinicalAccess, { accessTier: "PAID_FULL",
    planLookupKey: "mpm_basic_monthly" }).next).not.toHaveBeenCalled();
});
