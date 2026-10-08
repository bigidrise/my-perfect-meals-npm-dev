import { Client } from "pg";
import { PgDialect } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";
import { runProfessionalOnboardingMigration } from "../db/migrations/runProfessionalOnboardingMigration";
import { runProfessionalDecisionMigration } from "../db/migrations/runProfessionalDecisionMigration";
import { runDemoProfessionalMigration } from "../db/migrations/runDemoProfessionalMigration";
import { runProfessionalErasureMigration } from "../db/migrations/runProfessionalErasureMigration";
import { getDatabaseTlsConfig } from "../lib/databaseTls";

// Real PostgreSQL triggers/FKs, only fictional rows in a temporary schema,
// rolled back after EACH test. Never touch public account or billing records.
describe("professional lifecycle erasure transaction", () => {
  let client: Client;
  let schema: string;
  const dialect = new PgDialect();
  const subject = "fictional-subject", reviewer = "fictional-reviewer", other = "fictional-other";
  const request = "ccbe89e7-1a4f-45cb-8b3d-96558e153a71";
  const grant = "ccb52706-cdc2-4ee0-89a0-d68c5c454b18";
  const workspace = "37e010aa-c441-4881-bf2a-3f402654cd10";
  const patient = "37e010aa-c441-4881-bf2a-3f402654cd11";

  beforeEach(async () => {
    if (!process.env.DATABASE_URL) throw new Error("PostgreSQL required for erasure integration tests");
    client = new Client({ connectionString: process.env.DATABASE_URL, ssl: getDatabaseTlsConfig(process.env.DATABASE_URL) });
    await client.connect();
    await client.query("BEGIN");
    schema = "erasure_test_" + randomUUID().replace(/-/g, "");
    await client.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path="${schema}",pg_catalog`);
    await client.query("CREATE TABLE users(id text PRIMARY KEY); INSERT INTO users VALUES ('fictional-subject'),('fictional-reviewer'),('fictional-other')");
    // Nested migration transactions are savepoints within this rollback-only fixture.
    let savepoint = 0;
    const database = { transaction: async (work: any) => {
      const name = `migration_${++savepoint}`;
      await client.query(`SAVEPOINT ${name}`);
      try {
        const value = await work({ execute: async (q: any) => {
          const query = dialect.sqlToQuery(q);
          return client.query(query.sql, query.params);
        } });
        await client.query(`RELEASE SAVEPOINT ${name}`);
        return value;
      } catch (error) { await client.query(`ROLLBACK TO SAVEPOINT ${name}`); throw error; }
    } };
    await runProfessionalOnboardingMigration(database);
    await runProfessionalDecisionMigration(database);
    await runDemoProfessionalMigration(database);
    await runProfessionalErasureMigration(database, schema);
    await client.query(`INSERT INTO professional_identity_requests
      (id,owner_user_id,requested_role,credential_number,state,submitted_at,decision_reason,revision)
      VALUES ($1,$2,'physician','fictional-secret-license','approved',now(),'fictional private note',1)`, [request, subject]);
    await client.query(`INSERT INTO professional_identity_events
      (id,request_id,actor_user_id,event_type,request_revision,metadata) VALUES
      (gen_random_uuid(),$1,$2,'identity_approved',1,
       '{"previousIdentity":"business","approvedIdentity":"physician","reason":"fictional private note","reviewedStateHash":"identifying-hash","injectedPII":"erase me"}')`, [request, reviewer]);
    await client.query(`INSERT INTO demo_professional_grants
      (id,user_id,workspace_id,persona,operating_status,state,revision,capabilities,expires_at,approver_id,reason,
       training_basis,training_waiver_reason,identity_request_id)
      VALUES ($1,$2,$3,'physician','demo_only','active',1,'["patient.read"]',now()+interval '1 day',$4,
        'fictional identifying reason','demo_only_waiver','fictional private waiver',$5)`, [grant, subject, workspace, reviewer, request]);
    await client.query(`INSERT INTO demo_professional_events
      (id,grant_id,actor_user_id,event_type,metadata) VALUES
      (gen_random_uuid(),$1,$2,'demo_activated','{"reason":"fictional private reason","reviewerSecurityVersion":7}')`, [grant, reviewer]);
    await client.query(`UPDATE demo_professional_patients SET data=jsonb_set(data,'{connectionInvitation}',
      '{"providerUserId":"fictional-subject","clientUserId":"fictional-synthetic","token":"fictional-token"}')
      WHERE id=$1`, [patient]);
  }, 30000);

  afterEach(async () => {
    if (client) { try { await client.query("ROLLBACK"); } finally { await client.end(); } }
  });
  async function count(table: string) { return Number((await client.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n); }

  test.each(["prepared", "active", "revoked"])("subject erasure handles %s grants without retaining credentials", async state => {
    await client.query("UPDATE demo_professional_grants SET state=$1 WHERE id=$2", [state, grant]);
    await client.query("DELETE FROM users WHERE id=$1", [subject]);
    for (const table of ["professional_identity_requests","professional_identity_events","demo_professional_grants","demo_professional_events"]) {
      expect(await count(table)).toBe(0);
    }
    const audit = (await client.query("SELECT event_type,outcome,transition_facts FROM professional_lifecycle_erasure_audit")).rows;
    expect(audit).toHaveLength(2);
    expect(JSON.stringify(audit)).not.toMatch(/fictional|license|waiver|hash|reason|userId|workspaceId|injectedPII/);
    expect(audit.find(row => row.event_type==="identity_approved").transition_facts).toEqual({ previousIdentity:"business",approvedIdentity:"physician" });
    expect(await count("demo_professional_workspaces")).toBe(1);
    expect(await count("demo_professional_patients")).toBe(1);
    expect((await client.query("SELECT data FROM demo_professional_patients WHERE id=$1",[patient])).rows[0].data.connectionInvitation).toBeUndefined();
  });

  test("reviewer erasure preserves another person's credential application and demo restriction", async () => {
    await client.query("DELETE FROM users WHERE id=$1",[reviewer]);
    const r = (await client.query("SELECT * FROM professional_identity_requests")).rows[0];
    expect(r.credential_number).toBe("fictional-secret-license");
    expect(r.decision_reason).toBeNull();
    const e = (await client.query("SELECT * FROM professional_identity_events")).rows[0];
    expect(e.actor_user_id).toMatch(/^erased:/);
    expect(e.metadata).toEqual({previousIdentity:"business",approvedIdentity:"physician"});
    const g = (await client.query("SELECT * FROM demo_professional_grants")).rows[0];
    expect(g).toMatchObject({ user_id:subject,approver_id:null,state:"active",operating_status:"demo_only",reason:"[erased]",training_waiver_reason:"[erased]" });
    const de = (await client.query("SELECT * FROM demo_professional_events")).rows[0];
    expect(de.actor_user_id).toBeNull();
    expect(de.metadata).toEqual({operatingStatus:"demo_only",persona:"physician"});
    expect(await count("professional_lifecycle_erasure_audit")).toBe(0);
  });

  test.each([
    "UPDATE professional_identity_events SET metadata='{}'",
    "DELETE FROM professional_identity_events",
    "TRUNCATE professional_identity_events",
    "UPDATE demo_professional_events SET metadata='{}'",
    "DELETE FROM demo_professional_events",
    "DELETE FROM demo_professional_grants",
  ])("setting an erasure subject cannot authorize an ordinary history edit: %s", async statement => {
    await client.query("SELECT set_config('mpm.professional_erasure_subject',$1,true)", [subject]);
    await expect(client.query(statement)).rejects.toThrow(/immutable|append-only/);
  });

  test("a later account deletion failure rolls back credentials, grants, events and anonymous audit", async () => {
    await client.query(`CREATE FUNCTION fail_erasure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'fictional later failure'; END $$;
      CREATE TRIGGER zz_fail AFTER DELETE ON users FOR EACH ROW EXECUTE FUNCTION fail_erasure()`);
    await client.query("SAVEPOINT before_erasure");
    await expect(client.query("DELETE FROM users WHERE id=$1",[subject])).rejects.toThrow("fictional later failure");
    await client.query("ROLLBACK TO SAVEPOINT before_erasure");
    expect(await count("professional_identity_requests")).toBe(1);
    expect(await count("professional_identity_events")).toBe(1);
    expect(await count("demo_professional_grants")).toBe(1);
    expect(await count("demo_professional_events")).toBe(1);
    expect(await count("professional_lifecycle_erasure_audit")).toBe(0);
    expect((await client.query("SELECT data FROM demo_professional_patients WHERE id=$1",[patient])).rows[0].data.connectionInvitation).toBeDefined();
  });

  test("migration repeats without deleting or duplicating any lifecycle records", async () => {
    await runProfessionalErasureMigration({ transaction: async work => work({
      execute: async q => { const query=dialect.sqlToQuery(q); return client.query(query.sql,query.params); },
    }) },schema);
    expect(await count("professional_identity_requests")).toBe(1);
    expect(await count("demo_professional_grants")).toBe(1);
    expect(await count("professional_lifecycle_erasure_audit")).toBe(0);
  });

  test("a stale authorized writer cannot recreate credentials for an erased account", async () => {
    await client.query("DELETE FROM users WHERE id=$1",[subject]);
    await expect(client.query(`INSERT INTO professional_identity_requests
      (id,owner_user_id,requested_role,credential_number) VALUES (gen_random_uuid(),$1,'physician','fictional-stale-license')`,
      [subject])).rejects.toThrow(/professional_identity_requests_owner_fk/);
  });
});
