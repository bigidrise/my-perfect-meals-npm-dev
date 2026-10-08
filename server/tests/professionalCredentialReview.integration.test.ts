import { Client } from "pg";
import { PgDialect } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { getDatabaseTlsConfig } from "../lib/databaseTls";
import { runProfessionalOnboardingMigration } from "../db/migrations/runProfessionalOnboardingMigration";
import { runDemoProfessionalMigration } from "../db/migrations/runDemoProfessionalMigration";
import { runProfessionalCredentialMigration } from "../db/migrations/runProfessionalCredentialMigration";

let mockClient: Client;
let mockSavepoint = 0;
const mockDialect = new PgDialect();
async function mockExecute(query: any) {
  const compiled = mockDialect.sqlToQuery(query);
  return mockClient.query(compiled.sql, compiled.params);
}
async function mockTransaction(work: any) {
  const name = `credential_fixture_${++mockSavepoint}`;
  await mockClient.query(`SAVEPOINT ${name}`);
  try {
    const result = await work({ execute: mockExecute });
    await mockClient.query(`RELEASE SAVEPOINT ${name}`); return result;
  } catch (error) { await mockClient.query(`ROLLBACK TO SAVEPOINT ${name}`); throw error; }
}
jest.mock("../db", () => ({ db: {
  execute: (query: any) => mockExecute(query),
  transaction: (work: any) => mockTransaction(work),
} }));
import { credentialReviewRepository, readCredentialContext } from "../services/professionalCredentialReviewRepository";
import { createCredentialReviewService, credentialSubjectHash, credentialReviewStatus } from "../services/professionalCredentialReviewService";
import { identityRequiresIndependentCredentialReview } from "../services/professionalIdentityCredentialBoundary";

// Real PostgreSQL SQL/constraint/trigger checks. Only fictional users in a
// rollback-only temporary schema; public accounts and billing are never touched.
const requestId = "cce13b2d-7f33-4ff4-8be3-44a5c67c0d21";
const approvalId = "cce13b2d-7f33-4ff4-8be3-44a5c67c0d22";
const proof = { id: "fictional-reviewer", securityVersion: 4, mfaVerified: true as const };
const service = createCredentialReviewService(credentialReviewRepository);
const database = { transaction: mockTransaction };
let schemaName: string;
beforeEach(async () => {
  if (!process.env.DATABASE_URL) throw new Error("PostgreSQL is required for isolated credential fixtures");
  mockClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: getDatabaseTlsConfig(process.env.DATABASE_URL) });
  await mockClient.connect(); await mockClient.query("BEGIN");
  schemaName = "credential_test_" + randomUUID().replace(/-/g, "");
  await mockClient.query(`CREATE SCHEMA "${schemaName}"; SET LOCAL search_path="${schemaName}",pg_catalog`);
  await mockClient.query(`CREATE TABLE users (
    id text PRIMARY KEY, professional_role text, auth_security_version integer NOT NULL,
    professional_category text, credential_body text, credential_number text, credential_type text, credential_year text,
    is_pro_care boolean NOT NULL DEFAULT false, organization_id text, is_admin boolean NOT NULL DEFAULT false,
    mfa_enabled boolean NOT NULL DEFAULT true);
    INSERT INTO users (id,professional_role,auth_security_version,is_admin)
      VALUES ('fictional-subject','physician',7,false),('fictional-reviewer','trainer',4,true)`);
  await runProfessionalOnboardingMigration(database);
  await runDemoProfessionalMigration(database);
  await runProfessionalCredentialMigration(database, schemaName);
  await mockClient.query(`INSERT INTO professional_identity_requests
    (id,owner_user_id,requested_role,professional_category,credential_body,credential_number,state,revision,submitted_at)
    VALUES ($1,'fictional-subject','physician','certified','Fictional authority','SYNTHETIC-NOT-A-LICENSE','approved',3,now())`, [requestId]);
  await mockClient.query(`INSERT INTO professional_identity_events
    (id,request_id,actor_user_id,event_type,request_revision,metadata)
    VALUES($1,$2,'fictional-reviewer','identity_approved',3,'{"approvedIdentity":"physician","roleChanged":true}')`, [approvalId, requestId]);
});
afterEach(async () => { if (mockClient) { try { await mockClient.query("ROLLBACK"); } finally { await mockClient.end(); } } });
async function input() {
  const context = (await readCredentialContext({ execute: mockExecute }, { requestId }))!;
  return {
    revision: context.request.revision, approvalEventId: context.approval!.id,
    reviewedCredentialHash: credentialSubjectHash(context), decision: "verified" as const,
    verificationBasis: "FICTIONAL FIXTURE: issuing-authority registry reference SYNTHETIC-1 confirms matching active credentials.",
    checkedAt: "2020-01-01T00:00:00Z", validUntil: "2028-01-01T00:00:00Z",
    independentVerificationAcknowledged: true as const,
  };
}
test("real SQL commits an auditable clearance and opens ONLY the independent credential gate", async () => {
  const before = (await mockClient.query("SELECT * FROM users ORDER BY id")).rows;
  expect(await identityRequiresIndependentCredentialReview("fictional-subject")).toBe(true);
  await service.decide(requestId, proof, await input());
  expect(await identityRequiresIndependentCredentialReview("fictional-subject")).toBe(false);
  expect((await mockClient.query("SELECT * FROM users ORDER BY id")).rows).toEqual(before);
  const event = (await mockClient.query("SELECT * FROM professional_identity_events WHERE event_type='credentials_verified'")).rows[0];
  expect(event.actor_user_id).toBe(proof.id);
  expect(event.created_at).toBeInstanceOf(Date);
  expect(event.metadata).toMatchObject({ verificationBasis: (await input()).verificationBasis, approvalEventId: approvalId, reviewerSecurityVersion: 4 });
});
test.each(["rejected", "pending"] as const)("real SQL %s supersedes verified clearance without altering approved identity", async decision => {
  await service.decide(requestId, proof, await input());
  await service.decide(requestId, proof, { ...await input(), decision });
  expect(await identityRequiresIndependentCredentialReview("fictional-subject")).toBe(true);
  expect((await mockClient.query("SELECT state,revision FROM professional_identity_requests")).rows[0]).toEqual({ state: "approved", revision: 5 });
});
test("real duplicate decision fails with no duplicate audit event or revision", async () => {
  const data = await input(); await service.decide(requestId, proof, data);
  await expect(service.decide(requestId, proof, data)).rejects.toMatchObject({ code: "CREDENTIAL_REVIEW_STATE_CHANGED" });
  expect((await mockClient.query("SELECT count(*)::int n FROM professional_identity_events WHERE event_type='credentials_verified'")).rows[0].n).toBe(1);
});
test("failed audit insertion rolls back the revision and leaves clearance blocked", async () => {
  await mockClient.query(`CREATE FUNCTION fail_credential_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.event_type='credentials_verified' THEN RAISE EXCEPTION 'fixture interruption'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fixture_interruption BEFORE INSERT ON professional_identity_events FOR EACH ROW EXECUTE FUNCTION fail_credential_insert()`);
  await expect(service.decide(requestId, proof, await input())).rejects.toThrow();
  expect((await mockClient.query("SELECT revision FROM professional_identity_requests")).rows[0].revision).toBe(3);
  expect(await identityRequiresIndependentCredentialReview("fictional-subject")).toBe(true);
});
test("credential evidence is append-only and cannot be edited into verification", async () => {
  await service.decide(requestId, proof, { ...await input(), decision: "pending" });
  await expect(mockTransaction(async () => mockClient.query("UPDATE professional_identity_events SET event_type='credentials_verified' WHERE event_type='credentials_pending'"))).rejects.toThrow("append-only");
  expect(await identityRequiresIndependentCredentialReview("fictional-subject")).toBe(true);
});
test("subject erasure removes identifying credential evidence and keeps only de-identified decision evidence", async () => {
  await service.decide(requestId, proof, await input());
  await mockClient.query("DELETE FROM users WHERE id='fictional-subject'");
  expect((await mockClient.query("SELECT * FROM professional_identity_events")).rows).toEqual([]);
  const audit = (await mockClient.query("SELECT * FROM professional_lifecycle_erasure_audit WHERE event_type='credentials_verified'")).rows[0];
  expect(audit).toMatchObject({ event_type: "credentials_verified", outcome: "verified", transition_facts: {} });
  expect(JSON.stringify(audit)).not.toContain("SYNTHETIC");
});
test("reviewer erasure redacts their evidence without deleting the subject and fails closed", async () => {
  await service.decide(requestId, proof, await input());
  await mockClient.query("DELETE FROM users WHERE id='fictional-reviewer'");
  expect(await identityRequiresIndependentCredentialReview("fictional-subject")).toBe(true);
  const context = (await readCredentialContext({ execute: mockExecute }, { requestId }))!;
  expect(credentialReviewStatus(context).status).toBe("stale");
  expect(context.latest!.metadata).toEqual({});
  expect(context.account.id).toBe("fictional-subject");
});
test("missing audit schema protection fails closed before a decision is written", async () => {
  await mockClient.query("ALTER TABLE professional_identity_events DISABLE TRIGGER professional_identity_events_append_only");
  await expect(service.decide(requestId, proof, await input())).rejects.toMatchObject({ code: "CREDENTIAL_SCHEMA_NOT_READY" });
  expect((await mockClient.query("SELECT revision FROM professional_identity_requests")).rows[0].revision).toBe(3);
});
