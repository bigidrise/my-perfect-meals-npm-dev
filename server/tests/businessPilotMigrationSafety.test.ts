/** Real PostgreSQL semantics, entirely inside a disposable local Unix-socket
 * cluster. Never imports application bootstrap or uses DATABASE_URL.
 */
jest.mock("../db", () => ({ db: {} }));
jest.mock("../services/businessPilotAuthorizationService", () => ({ createBusinessPilotAuthorization: jest.fn() }));
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { disposablePostgres } from "./helpers/disposablePostgres";
import { runProfessionalOnboardingMigration } from "../db/migrations/runProfessionalOnboardingMigration";
import { runProfessionalDecisionMigration } from "../db/migrations/runProfessionalDecisionMigration";
import { runDemoProfessionalMigration } from "../db/migrations/runDemoProfessionalMigration";
import { runProfessionalErasureMigration } from "../db/migrations/runProfessionalErasureMigration";
import { eraseAccount } from "../services/professionalAccountErasure";
import { deleteDevelopmentBusinessRecords } from "../services/developmentBusinessCleanup";
import { activateBusinessPilotLink, bindFounderOrganization, founderOrganizationWindow, getActiveBusinessPilotClinicalAccess } from "../services/businessPilotActivationService";
import { assertOrganizationCheckoutConsent } from "../services/organizationCheckoutConsent";

describe("Business Pilot local PostgreSQL safety", () => {
  let local: Awaited<ReturnType<typeof disposablePostgres>>;
  let database: any;
  let savepoint = 0;
  const subject = "fictional-physician", other = "fictional-other";
  const authorization = "c5ce6354-1244-4fe1-944c-836fbeefca82";
  const business = "a462a09b-cfef-4a68-97c2-05009bd7e7b5";
  const secondBusiness = "a462a09b-cfef-4a68-97c2-05009bd7e7b6";
  const request = "c5ce6354-1244-4fe1-944c-836fbeefca83";
  const token = "a".repeat(64);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const start = new Date(Date.now() - 3600000);
  const end = new Date(start.getTime() + 720 * 3600000);
  const dialect = new PgDialect();
  const migration = readFileSync("migrations/20261011_business_pilot_activation.sql", "utf8");
  const previousFlags = [process.env.BUSINESS_PILOT_ACTIVATION_ENABLED, process.env.BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED];
  const query = (sql: string, params?: any[]) => local.client.query(sql, params);

  beforeAll(async () => {
    local = await disposablePostgres();
    const orm = drizzle(local.client);
    database = {
      execute: (sql: any) => { const q = dialect.sqlToQuery(sql); return query(q.sql, q.params); },
      delete: orm.delete.bind(orm),
      transaction: async (work: any) => {
        const name = `fixture_app_${++savepoint}`;
        await query(`SAVEPOINT ${name}`);
        try { const result = await work(database); await query(`RELEASE SAVEPOINT ${name}`); return result; }
        catch (error) { await query(`ROLLBACK TO SAVEPOINT ${name}`); await query(`RELEASE SAVEPOINT ${name}`); throw error; }
      },
    };
    Object.assign(jest.requireMock("../db").db, database);
    await query(`CREATE TABLE public.users(id varchar PRIMARY KEY, email text NOT NULL UNIQUE);
      CREATE TABLE public.businesses(id uuid PRIMARY KEY);
      CREATE TABLE public.business_pilot_authorizations(
        id uuid PRIMARY KEY, status varchar NOT NULL DEFAULT 'active',
        normalized_authorized_email text NOT NULL DEFAULT 'physician@example.test',
        claimed_user_id varchar REFERENCES users(id) ON DELETE SET NULL);
      CREATE TABLE public.business_invitations(id integer PRIMARY KEY, business_id uuid REFERENCES businesses(id));
      CREATE TABLE public.business_members(id integer PRIMARY KEY, business_id uuid REFERENCES businesses(id),
        user_id varchar REFERENCES users(id) ON DELETE CASCADE);`);
    // Exercise the unchanged professional-lifecycle trigger on this private fixture.
    await query("BEGIN");
    await runProfessionalOnboardingMigration(database);
    await runProfessionalDecisionMigration(database);
    await runDemoProfessionalMigration(database);
    await runProfessionalErasureMigration(database, "public");
    await query("COMMIT");
    await query(migration);
    process.env.BUSINESS_PILOT_ACTIVATION_ENABLED = "true";
    process.env.BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED = "true";
  }, 60000);

  beforeEach(async () => {
    await query("BEGIN");
    await query("INSERT INTO users(id,email) VALUES ($1,'physician@example.test'),($2,'other@example.test')", [subject, other]);
    await query("INSERT INTO businesses VALUES ($1),($2)", [business, secondBusiness]);
    await query("INSERT INTO business_pilot_authorizations(id,claimed_user_id) VALUES ($1,$2)", [authorization, subject]);
  });
  afterEach(async () => { await query("ROLLBACK"); });
  afterAll(async () => {
    for (const [index, key] of ["BUSINESS_PILOT_ACTIVATION_ENABLED", "BUSINESS_PILOT_ACTIVATION_SCHEMA_APPROVED"].entries()) {
      if (previousFlags[index] === undefined) delete process.env[key]; else process.env[key] = previousFlags[index];
    }
    if (local) await local.close();
  });

  async function insertActivation(from: any = start, to: any = end) {
    await query(`INSERT INTO business_pilot_activation_links
      (authorization_id,token_hash,invitation_expires_at,activated_user_id,personal_access_started_at,
       personal_access_ends_at,business_id,organization_consumed)
      VALUES ($1,$2,now()+interval '14 days',$3,$4,$5,$6,true)`,
    [authorization, tokenHash, subject, from, to, business]);
  }
  async function insertConsent() {
    await query(`INSERT INTO organization_checkout_consents
      (reservation_id,business_id,actor_user_id,price_id,unit_amount,currency,billing_interval,interval_count,terms_version)
      VALUES ('fixture-reservation',$1,$2,'price-fixture',4499,'usd','month',1,'organization-monthly-v1')`,
    [business, subject]);
  }
  async function rejectsSql(sql: string, params: any[], code: string) {
    await query("SAVEPOINT expected_rejection");
    try { await expect(query(sql, params)).rejects.toMatchObject({ code }); }
    finally { await query("ROLLBACK TO SAVEPOINT expected_rejection"); await query("RELEASE SAVEPOINT expected_rejection"); }
  }

  test.each([
    [null, end], [start, null], ["infinity", "infinity"], ["-infinity", "-infinity"],
    [start, "infinity"], ["-infinity", end], [start, new Date(end.getTime() + 1)],
    [start, new Date(end.getTime() - 1)], [end, start],
  ])("database rejects incomplete/non-finite/non-720-hour window %p → %p", async (from, to) => {
    await rejectsSql(`INSERT INTO business_pilot_activation_links
      (authorization_id,token_hash,invitation_expires_at,activated_user_id,personal_access_started_at,personal_access_ends_at)
      VALUES ($1,$2,now()+interval '14 days',$3,$4,$5)`, [authorization, tokenHash, subject, from, to], "23514");
  });
  test("invalid timestamp text is rejected by PostgreSQL itself", async () => {
    await rejectsSql(`INSERT INTO business_pilot_activation_links
      (authorization_id,token_hash,invitation_expires_at) VALUES ($1,$2,$3)`,
    [authorization, tokenHash, "not-a-date"], "22007");
  });
  test("non-finite invitation deadline is rejected", async () => {
    await rejectsSql(`INSERT INTO business_pilot_activation_links
      (authorization_id,token_hash,invitation_expires_at) VALUES ($1,$2,'infinity')`,
    [authorization, tokenHash], "23514");
  });
  test("unactivated invitation accepts null dates; partial activation does not", async () => {
    await query(`INSERT INTO business_pilot_activation_links
      (authorization_id,token_hash,invitation_expires_at) VALUES ($1,$2,now()+interval '14 days')`, [authorization, tokenHash]);
    await rejectsSql("UPDATE business_pilot_activation_links SET personal_access_started_at=$1", [start], "23514");
  });
  test("720-hour window is exact across DST and replay performs no reset", async () => {
    await query("SET LOCAL TIME ZONE 'America/Chicago'");
    const dstStart = new Date("2026-10-25T12:00:00Z"), dstEnd = new Date("2026-11-24T12:00:00Z");
    await insertActivation(dstStart, dstEnd);
    const replay = await activateBusinessPilotLink(token, subject);
    expect(replay).toMatchObject({ startedAt: dstStart, endsAt: dstEnd, alreadyActivated: true });
    const row = (await query("SELECT personal_access_started_at,personal_access_ends_at FROM business_pilot_activation_links")).rows[0];
    expect(row.personal_access_started_at).toEqual(dstStart); expect(row.personal_access_ends_at).toEqual(dstEnd);
  });
  test("migration replay retains existing capability and consent snapshots", async () => {
    await insertActivation(); await insertConsent();
    // The reviewed SQL owns BEGIN/COMMIT; a separate fixture outer savepoint is not required here.
    await query("COMMIT");
    try {
      await query(migration);
      expect((await query("SELECT personal_access_ends_at FROM business_pilot_activation_links")).rows[0].personal_access_ends_at).toEqual(end);
      expect((await query("SELECT unit_amount FROM organization_checkout_consents")).rows[0].unit_amount).toBe(4499);
    } finally {
      await query("BEGIN");
      await query("DELETE FROM business_pilot_activation_links; DELETE FROM organization_checkout_consents; DELETE FROM business_pilot_authorizations; DELETE FROM businesses; DELETE FROM users");
      await query("COMMIT");
      await query("BEGIN");
    }
  });
  test("account erasure removes capability and identity but preserves minimal consent and existing lifecycle audit", async () => {
    await insertActivation(); await insertConsent();
    await query(`INSERT INTO professional_identity_requests
      (id,owner_user_id,requested_role,credential_number,state,submitted_at,revision)
      VALUES ($1,$2,'physician','fictional-license','approved',now(),1)`, [request, subject]);
    await query(`INSERT INTO professional_identity_events
      (id,request_id,actor_user_id,event_type,request_revision,metadata)
      VALUES (gen_random_uuid(),$1,$2,'identity_approved',1,'{"previousIdentity":"business","approvedIdentity":"physician","reason":"erase"}')`,
    [request, other]);
    await eraseAccount(subject, database);
    expect((await query("SELECT id FROM users WHERE id=$1", [subject])).rowCount).toBe(0);
    expect((await query("SELECT * FROM business_pilot_activation_links")).rowCount).toBe(0);
    expect((await query("SELECT * FROM professional_identity_requests")).rowCount).toBe(0);
    expect((await query("SELECT * FROM professional_identity_events")).rowCount).toBe(0);
    expect((await query("SELECT * FROM professional_lifecycle_erasure_audit")).rowCount).toBe(1);
    const receipt = (await query("SELECT * FROM organization_checkout_consents")).rows[0];
    expect(receipt).toMatchObject({ actor_user_id: null, business_id: business, unit_amount: 4499, quantity: 1 });
    expect((await query("SELECT id FROM users WHERE id=$1", [other])).rowCount).toBe(1);
    await expect(activateBusinessPilotLink(token, subject)).rejects.toMatchObject({ code: "PILOT_NOT_FOUND" });
    await expect(assertOrganizationCheckoutConsent("fixture-reservation", business, subject, "price-fixture"))
      .rejects.toMatchObject({ code: "BILLING_CONSENT_NOT_VERIFIED" });
  });
  test("business cleanup detaches references without changing the personal window or allowing another Organization", async () => {
    await insertActivation(); await insertConsent();
    await query("INSERT INTO business_members VALUES (1,$1,$2),(2,$3,$2)", [business, subject, secondBusiness]);
    await query("INSERT INTO business_invitations VALUES (1,$1),(2,$2)", [business, secondBusiness]);
    await deleteDevelopmentBusinessRecords(database, business);
    const row = (await query("SELECT * FROM business_pilot_activation_links")).rows[0];
    expect(row).toMatchObject({ business_id: null, organization_consumed: true, personal_access_started_at: start, personal_access_ends_at: end });
    expect((await query("SELECT * FROM organization_checkout_consents")).rows[0]).toMatchObject({ business_id: null, actor_user_id: subject, unit_amount: 4499 });
    expect((await query("SELECT * FROM business_members")).rowCount).toBe(1);
    expect((await query("SELECT * FROM business_invitations")).rowCount).toBe(1);
    await expect(getActiveBusinessPilotClinicalAccess(subject)).resolves.toMatchObject({ endsAt: end });
    await expect(founderOrganizationWindow(database, subject)).rejects.toMatchObject({ code: "PILOT_ORGANIZATION_ALREADY_ATTACHED" });
    await expect(bindFounderOrganization(database, authorization, secondBusiness)).rejects.toMatchObject({ code: "PILOT_ORGANIZATION_ALREADY_ATTACHED" });
    await expect(assertOrganizationCheckoutConsent("fixture-reservation", secondBusiness, subject, "price-fixture"))
      .rejects.toMatchObject({ code: "BILLING_CONSENT_NOT_VERIFIED" });
    await eraseAccount(subject, database);
    expect((await query("SELECT * FROM organization_checkout_consents")).rows[0]).toMatchObject({ business_id: null, actor_user_id: null });
  });
  test("physician erasure does not delete another person's independent clinical trial", async () => {
    await insertActivation(); await insertConsent();
    await query(`CREATE TABLE fixture_clinic_trial(
      user_id varchar REFERENCES users(id) ON DELETE CASCADE,
      business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
      ends_at timestamptz NOT NULL)`);
    await query("INSERT INTO fixture_clinic_trial VALUES ($1,$2,$3)", [other, business, end]);
    await eraseAccount(subject, database);
    expect((await query("SELECT * FROM fixture_clinic_trial")).rows[0])
      .toMatchObject({ user_id: other, business_id: business, ends_at: end });
  });
  test("unrelated account-erasure failures preserve capability, receipt identity, and the account", async () => {
    await insertActivation(); await insertConsent();
    await query("CREATE TABLE fixture_protected_owner(user_id varchar REFERENCES users(id) ON DELETE RESTRICT)");
    await query("INSERT INTO fixture_protected_owner VALUES ($1)", [subject]);
    await expect(eraseAccount(subject, database)).rejects.toMatchObject({ cause: { code: "23503" } });
    expect((await query("SELECT * FROM users WHERE id=$1", [subject])).rowCount).toBe(1);
    expect((await query("SELECT * FROM business_pilot_activation_links")).rows[0])
      .toMatchObject({ activated_user_id: subject, token_hash: tokenHash });
    expect((await query("SELECT * FROM organization_checkout_consents")).rows[0].actor_user_id).toBe(subject);
  });
  test("other legacy FK failures roll the entire Business reset back", async () => {
    await query("CREATE TABLE fixture_retained_record(business_id uuid REFERENCES businesses(id) ON DELETE RESTRICT)");
    await query("INSERT INTO fixture_retained_record VALUES ($1)", [business]);
    await query("INSERT INTO business_members VALUES (1,$1,$2)", [business, subject]);
    await query("INSERT INTO business_invitations VALUES (1,$1)", [business]);
    await expect(deleteDevelopmentBusinessRecords(database, business)).rejects.toMatchObject({ code: "23503" });
    expect((await query("SELECT * FROM business_members")).rowCount).toBe(1);
    expect((await query("SELECT * FROM business_invitations")).rowCount).toBe(1);
  });
  test("referential integrity still rejects missing actors and permits null audit identities only after authorization is gone", async () => {
    await insertActivation(); await insertConsent();
    await rejectsSql("UPDATE organization_checkout_consents SET actor_user_id='missing-account'", [], "23503");
    await rejectsSql("UPDATE organization_checkout_consents SET business_id='00000000-0000-0000-0000-000000000000'", [], "23503");
    await rejectsSql("UPDATE business_pilot_activation_links SET business_id='00000000-0000-0000-0000-000000000000'", [], "23503");
    await rejectsSql("DELETE FROM business_pilot_authorizations WHERE id=$1", [authorization], "23503");
    await rejectsSql("UPDATE business_pilot_activation_links SET activated_user_id=NULL", [], "23514");
  });
});
