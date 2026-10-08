/** Isolated transaction/route fixtures. No real account, billing, or email writes. */
import fs from "node:fs";
import path from "node:path";
import { PgDialect } from "drizzle-orm/pg-core";
import { users } from "@shared/schema";
import { studios, studioBilling } from "../db/schema/studio";

let mockRows: Map<object, any[]>;
let mockFailure: "studio" | "billing" | null;
let mockTransactionTail = Promise.resolve();
const mockReadiness = jest.fn();
const mockLocks: string[] = [];
const mockWrites: object[] = [];

function fixtureExecutor() {
  return {
    select: () => {
      let table: object;
      let id: unknown;
      const query: any = {
        from(value: object) { table = value; return query; },
        where(clause: any) { id = new PgDialect().sqlToQuery(clause).params[0]; return query; },
        limit() { return query; },
        for(lock: string) { mockLocks.push(lock); return query; },
        then(resolve: any, reject: any) {
          const rows = (mockRows.get(table) ?? []).filter(row =>
            table === users ? row.id === id : row.ownerUserId === id);
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return query;
    },
    insert: (table: object) => ({
      values: (values: any) => ({
        onConflictDoNothing: async (conflict: any) => {
          expect(conflict.target).toBe(table === studios ? studios.ownerUserId : studioBilling.studioId);
          if (mockFailure === (table === studios ? "studio" : "billing")) {
            mockFailure = null;
            throw new Error("injected interrupted write");
          }
          const rows = mockRows.get(table) ?? [];
          const duplicate = rows.some(row => table === studios
            ? row.ownerUserId === values.ownerUserId : row.studioId === values.studioId);
          if (!duplicate) {
            rows.push({ id: table === studios ? "fictional-clinic" : "fictional-billing", orgId: null, ...values });
            mockRows.set(table, rows);
            mockWrites.push(table);
          }
        },
      }),
    }),
  };
}
jest.mock("../db", () => ({
  db: {
    transaction: async (callback: any) => {
      const previous = mockTransactionTail;
      let release!: () => void;
      mockTransactionTail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      const snapshot = new Map([...mockRows].map(([table, rows]) => [table, rows.map(row => ({ ...row }))]));
      try { return await callback(fixtureExecutor()); }
      catch (error) { mockRows = snapshot; throw error; }
      finally { release(); }
    },
  },
}));
jest.mock("../services/procareStudioReadiness", () => ({
  getProviderStudioReadiness: (...args: any[]) => mockReadiness(...args),
}));
import { provisionManualStudio, ManualStudioProvisioningError } from "../services/manualStudioProvisioning";

const ownerId = "fictional-physician";
const owner = () => ({
  id: ownerId, role: "coach", professionalRole: "physician", isProCare: true,
  organizationId: "fictional-owned-organization", authSecurityVersion: 7,
});
const existingClinic = () => ({
  id: "existing-fictional-clinic", ownerUserId: ownerId, type: "clinic", status: "active",
  name: "Existing Clinic", contactEmail: "existing@example.invalid",
  orgId: "explicit-clinic-organization", themeColor: "#123456",
});
beforeEach(() => {
  mockRows = new Map([[users, [owner()]], [studios, []], [studioBilling, []]]);
  mockFailure = null; mockLocks.length = 0; mockWrites.length = 0;
  mockTransactionTail = Promise.resolve();
  mockReadiness.mockReset().mockResolvedValue({ ok: true });
});

test("atomic physician creation commits one Clinic and its billing row without changing identity or Organization", async () => {
  const before = { ...mockRows.get(users)![0] };
  const clinic = await provisionManualStudio(ownerId, { name: "Authorized Clinic" });
  expect(clinic).toMatchObject({ ownerUserId: ownerId, type: "clinic", status: "active", orgId: null });
  expect(mockRows.get(studios)).toHaveLength(1);
  expect(mockRows.get(studioBilling)).toEqual([expect.objectContaining({ studioId: clinic.id, planCode: "clinic_69" })]);
  expect(mockRows.get(users)).toEqual([before]);
  expect(mockLocks).toEqual(["share", "update"]);
});
test.each(["studio", "billing"] as const)("interrupted %s write rolls back all new provisioning and retry succeeds", async stage => {
  mockFailure = stage;
  await expect(provisionManualStudio(ownerId, { name: "Authorized Clinic" })).rejects.toThrow("injected interrupted write");
  expect(mockRows.get(studios)).toHaveLength(0);
  expect(mockRows.get(studioBilling)).toHaveLength(0);
  const recovered = await provisionManualStudio(ownerId, { name: "Authorized Clinic" });
  expect(recovered.type).toBe("clinic");
  expect(mockRows.get(studios)).toHaveLength(1);
  expect(mockRows.get(studioBilling)).toHaveLength(1);
});
test("repairs missing billing on an existing Clinic without changing its ID, Organization or presentation", async () => {
  const existing = existingClinic();
  mockRows.set(studios, [existing]);
  const recovered = await provisionManualStudio(ownerId, { name: "Do not overwrite", contactEmail: "new@example.invalid" });
  expect(recovered).toEqual(existing);
  expect(mockRows.get(studios)).toEqual([existing]);
  expect(mockRows.get(studioBilling)).toHaveLength(1);
  expect(mockRows.get(users)![0]).toEqual(owner());
});
test("failed existing-Clinic repair retains original ownership and safe retry finishes missing billing", async () => {
  const existing = existingClinic();
  mockRows.set(studios, [existing]); mockFailure = "billing";
  await expect(provisionManualStudio(ownerId, { name: "Ignored" })).rejects.toThrow();
  expect(mockRows.get(studios)).toEqual([existing]);
  expect(mockRows.get(studioBilling)).toHaveLength(0);
  expect((await provisionManualStudio(ownerId, { name: "Ignored" })).id).toBe(existing.id);
  expect(mockRows.get(studioBilling)).toHaveLength(1);
});
test("duplicate concurrent creation and repeat calls return the same Clinic and billing record", async () => {
  const results = await Promise.all(Array.from({ length: 4 }, () => provisionManualStudio(ownerId, { name: "Clinic" })));
  expect(new Set(results.map(row => row.id)).size).toBe(1);
  await provisionManualStudio(ownerId, { name: "Replay" });
  expect(mockRows.get(studios)).toHaveLength(1);
  expect(mockRows.get(studioBilling)).toHaveLength(1);
  expect(mockRows.get(studios)![0].name).toBe("Clinic");
});
test("retry preserves existing Stripe identifiers, plan and paid-through status byte-for-byte", async () => {
  mockRows.set(studios, [existingClinic()]);
  const billing = { id: "paid-billing", studioId: "existing-fictional-clinic", status: "active",
    planCode: "existing-paid-plan", stripeAccountId: "fictional-stripe-account",
    stripeSubscriptionId: "fictional-subscription", currentPeriodEnd: "2027-01-01" };
  mockRows.set(studioBilling, [billing]);
  await provisionManualStudio(ownerId, { name: "Ignored" });
  expect(mockRows.get(studioBilling)).toEqual([billing]);
  expect(mockWrites).toHaveLength(0);
});
test("another physician's Clinic is never returned or repaired", async () => {
  const other = { ...existingClinic(), ownerUserId: "different-physician" };
  mockRows.set(studios, [other]);
  const result = await provisionManualStudio(ownerId, { name: "My Clinic" });
  expect(result.ownerUserId).toBe(ownerId);
  expect(mockRows.get(studios)).toContainEqual(other);
  expect(mockRows.get(studioBilling)![0].studioId).toBe(result.id);
});
test("Business ownership never becomes practitioner identity or creates a Clinic", async () => {
  mockRows.get(users)![0].professionalRole = "business";
  await expect(provisionManualStudio(ownerId, { name: "Clinic" })).rejects.toMatchObject({ code: "PROVIDER_ROLE_REQUIRED" });
  expect(mockRows.get(users)![0].professionalRole).toBe("business");
  expect(mockWrites).toHaveLength(0);
});
test.each(["INDEPENDENT_CREDENTIAL_VERIFICATION_REQUIRED", "PHASE1_CERT_REQUIRED", "LEGAL_REACCEPT_REQUIRED", "PROCARE_ACCESS_REQUIRED"])(
  "%s still blocks creation AND existing-Clinic recovery", async code => {
    mockReadiness.mockResolvedValue({ ok: false, code, message: "Real readiness required", missing: ["current-document"] });
    mockRows.set(studios, [existingClinic()]);
    await expect(provisionManualStudio(ownerId, { name: "Ignored" })).rejects.toMatchObject({ status: 403, code });
    expect(mockWrites).toHaveLength(0);
    expect(mockRows.get(studioBilling)).toHaveLength(0);
  });
test("physician cannot request a trainer Studio type", async () => {
  await expect(provisionManualStudio(ownerId, { name: "Clinic", type: "studio" })).rejects.toMatchObject({ code: "STUDIO_TYPE_MISMATCH" });
  expect(mockWrites).toHaveLength(0);
});
test.each([{ status: "inactive" }, { type: "studio" }])("existing incompatible Clinic is never replaced or reactivated: %p", async change => {
  const existing = { ...existingClinic(), ...change }; mockRows.set(studios, [existing]);
  await expect(provisionManualStudio(ownerId, { name: "Replacement" })).rejects.toMatchObject({ code: "EXISTING_STUDIO_REVIEW_REQUIRED" });
  expect(mockRows.get(studios)).toEqual([existing]);
  expect(mockRows.get(studioBilling)).toHaveLength(0);
});
test("trainer remains a trainer and receives the existing canonical Studio billing plan", async () => {
  mockRows.get(users)![0].professionalRole = "trainer";
  const result = await provisionManualStudio(ownerId, { name: "Trainer Studio", type: "studio" });
  expect(result.type).toBe("studio");
  expect(mockRows.get(users)![0].professionalRole).toBe("trainer");
  expect(mockRows.get(studioBilling)![0].planCode).toBe("studio_59");
});

function creationHandler() {
  const source = fs.readFileSync(path.resolve("server/routes/studioRoutes.ts"), "utf8");
  const start = source.indexOf('router.post("/", async (req, res) => {');
  const end = source.indexOf("\n});", start);
  let handler: any;
  new Function("router", "getUserId", "provisionManualStudio", "ManualStudioProvisioningError", source.slice(start, end + 4))(
    { post: (_path: string, fn: any) => { handler = fn; } },
    async (req: any) => req.session?.userId ?? null, provisionManualStudio, ManualStudioProvisioningError,
  );
  return handler;
}
const response = () => ({ statusCode: 200, body: null as any,
  status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } });
test("actual manual POST returns 500 with no partial records, then succeeds and remains idempotent", async () => {
  const handler = creationHandler();
  const req = { session: { userId: ownerId }, body: { name: "Clinic", type: "clinic", ownerUserId: "spoofed" } };
  mockFailure = "billing";
  const first = response(); await handler(req, first);
  expect(first.statusCode).toBe(500);
  expect(mockRows.get(studios)).toHaveLength(0);
  for (let retry = 0; retry < 2; retry++) {
    const res = response(); await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.studio.ownerUserId).toBe(ownerId);
  }
  expect(mockRows.get(studios)).toHaveLength(1); expect(mockRows.get(studioBilling)).toHaveLength(1);
});
test("actual manual POST retains legal/readiness error details and does not repair an unauthorized Clinic", async () => {
  mockRows.set(studios, [existingClinic()]);
  mockReadiness.mockResolvedValue({ ok: false, code: "LEGAL_REACCEPT_REQUIRED", flow: "physician", missing: ["current-agreement"] });
  const res = response(); await creationHandler()({ session: { userId: ownerId }, body: { name: "Clinic" } }, res);
  expect(res.statusCode).toBe(403);
  expect(res.body).toMatchObject({ code: "LEGAL_REACCEPT_REQUIRED", flow: "physician", missing: ["current-agreement"], setupRequired: true });
  expect(mockWrites).toHaveLength(0);
});
test("actual manual POST requires authentication before all provisioning", async () => {
  const res = response(); await creationHandler()({ body: { name: "Clinic" } }, res);
  expect(res.statusCode).toBe(401); expect(mockWrites).toHaveLength(0);
});
