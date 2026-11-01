/**
 * Fixture-only PostgreSQL contract test. No application imports, no DATABASE_URL,
 * no TCP listener. Creates and removes a private /tmp PostgreSQL cluster.
 */
const { execFileSync } = require("node:child_process");
const { mkdtempSync, mkdirSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { Client } = require("pg");

const root = mkdtempSync(path.join(tmpdir(), "reconcile-pg-"));
const data = path.join(root, "data");
const socket = path.join(root, "socket");
mkdirSync(socket);
const childEnv = { PATH: process.env.PATH, HOME: root, LANG: "C.UTF-8" };
let started = false;
let client;
let checks = 0;
async function denied(sql, params) {
  await assert.rejects(() => client.query(sql, params));
  checks++;
}
async function main() {
  try {
    execFileSync("initdb", ["-D", data, "-U", "postgres", "--auth=trust", "--no-locale"], { env: childEnv, stdio: "pipe" });
    execFileSync("pg_ctl", ["-D", data, "-l", path.join(root, "postgres.log"),
      "-o", `-F -k ${socket} -p 6547 -c listen_addresses=''`, "-w", "start"],
      { env: childEnv, stdio: "pipe" });
    started = true;
    client = new Client({ host: socket, port: 6547, user: "postgres", database: "postgres" });
    await client.connect();
    await client.query(`
      CREATE TABLE users (id varchar PRIMARY KEY, email text, is_founder boolean, is_admin boolean,
        plan_lookup_key text, personal_plan_lookup_key text, subscription_status text);
      CREATE TABLE businesses (id uuid PRIMARY KEY, name text, owner_user_id varchar REFERENCES users(id),
        plan text, status text, commercial_access_mode text, commercial_access_started_at timestamptz,
        commercial_access_ends_at timestamptz);
      INSERT INTO users VALUES ('owner','owner@example.test',false,false,'mpm_basic_monthly',NULL,'active'),
        ('other','other@example.test',false,false,NULL,NULL,NULL),
        ('operator','operator@example.test',true,false,NULL,NULL,NULL),
        ('eric-fixture','eric@drericfete.com',false,false,NULL,NULL,'active');
      INSERT INTO businesses VALUES ('00000000-0000-4000-8000-000000000001','Fixture Business','owner',
        'clinical_business_monthly','active',
        'onboarding_pilot',date_trunc('milliseconds',now()) - interval '360 hours',
        date_trunc('milliseconds',now()) + interval '360 hours');
      INSERT INTO businesses VALUES ('00000000-0000-4000-8000-000000000002',
        'Dr. Eric Prime-X','eric-fixture','clinical_business_monthly','active',
        'onboarding_pilot','2026-10-12T15:41:27.737Z','2026-11-11T15:41:27.737Z');
    `);
    await client.query(readFileSync(path.join(__dirname, "../../migrations/20261027_personal_clinical_reconciliation.sql"), "utf8"));
    const operate = name => {
      const output = execFileSync("psql", [
      "-X", "-h", socket, "-p", "6547", "-U", "postgres", "-d", "postgres",
      "-v", "approved_by_user_id=operator", "-v", "approval_reference=approved-fixture-reference",
      ...(name.includes("-apply") ? ["-v", "apply=true"] : []),
      "-f", path.join(__dirname, `../operations/${name.replace("-apply", "")}-dr-eric-personal-clinical.sql`),
      ], { env: childEnv, stdio: "pipe" }).toString();
      return output;
    };
    const countEric = async () => (await client.query(
      `SELECT count(*)::int AS n FROM personal_clinical_reconciliation_grants WHERE user_id='eric-fixture' AND status='active'`
    )).rows[0].n;
    const preOperation = (await client.query(`SELECT commercial_access_started_at,
      commercial_access_ends_at FROM businesses WHERE owner_user_id='eric-fixture'`)).rows[0];
    operate("reconcile"); assert.equal(await countEric(), 0); checks++;
    operate("reconcile-apply"); assert.equal(await countEric(), 1); checks++;
    operate("reconcile-apply"); assert.equal(await countEric(), 1); checks++;
    operate("revoke"); assert.equal(await countEric(), 1); checks++;
    operate("revoke-apply"); assert.equal(await countEric(), 0); checks++;
    assert.throws(() => operate("reconcile-apply")); checks++;
    assert.deepEqual((await client.query(`SELECT commercial_access_started_at,
      commercial_access_ends_at FROM businesses WHERE owner_user_id='eric-fixture'`)).rows[0], preOperation);
    checks++;
    const snapshot = async () => (await client.query(`SELECT
      (SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM users u) AS users,
      (SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM businesses b) AS businesses`)).rows[0];
    const before = await snapshot();
    const grantSql = `INSERT INTO personal_clinical_reconciliation_grants
      (user_id,business_id,starts_at,ends_at,approved_by_user_id,approval_reference,reason)
      SELECT $1,b.id,b.commercial_access_started_at,b.commercial_access_ends_at,$2,
        'approved-fixture-reference','Restore missing personal access'
      FROM businesses b WHERE b.id='00000000-0000-4000-8000-000000000001' RETURNING id`;
    await denied(grantSql, ["other", "operator"]); // wrong owner
    await denied(grantSql, ["owner", "other"]); // unauthorized approver
    const grantId = (await client.query(grantSql, ["owner", "operator"])).rows[0].id;
    checks++;
    await denied(grantSql, ["owner", "operator"]); // duplicate issuance
    await denied(`UPDATE personal_clinical_reconciliation_grants SET ends_at=ends_at+interval '1 second'`);
    await denied(`UPDATE personal_clinical_reconciliation_grants SET
      starts_at=starts_at+interval '1 day',ends_at=ends_at+interval '1 day'`);
    await denied(`UPDATE personal_clinical_reconciliation_grants SET user_id='other'`);
    await denied(`UPDATE personal_clinical_reconciliation_grants SET reason='Replace original evidence'`);
    await denied(`UPDATE personal_clinical_reconciliation_grants SET
      status='revoked',revoked_at=now(),revoked_by_user_id='other',
      revocation_reason='Unauthorized operation',revocation_approval_reference='fixture-reference'`);
    const read = `SELECT g.id FROM personal_clinical_reconciliation_grants g
      JOIN businesses b ON b.id=g.business_id WHERE g.user_id=$1 AND g.status='active'
      AND g.revoked_at IS NULL AND g.starts_at <= $2 AND g.ends_at > $2
      AND b.owner_user_id=g.user_id AND b.status='active'
      AND b.commercial_access_mode='onboarding_pilot'
      AND b.commercial_access_started_at=g.starts_at AND b.commercial_access_ends_at=g.ends_at`;
    const window = (await client.query(
      "SELECT starts_at,ends_at FROM personal_clinical_reconciliation_grants WHERE user_id='owner'"
    )).rows[0];
    for (const [user, at, count] of [
      ["owner", window.starts_at, 1],
      ["owner", new Date(window.ends_at.getTime() - 1), 1],
      ["owner", window.ends_at, 0],
      ["owner", new Date(window.starts_at.getTime() - 1), 0],
      ["other", window.starts_at, 0],
    ]) {
      assert.equal((await client.query(read, [user, at])).rowCount, count);
      checks++;
    }
    // An organization-window change or owner change makes the grant fail closed.
    for (const update of [
      "commercial_access_ends_at=commercial_access_ends_at+interval '1 day'",
      "owner_user_id='other'", "status='inactive'", "commercial_access_mode='paid'",
    ]) {
      await client.query("BEGIN");
      await client.query(`UPDATE businesses SET ${update}`);
      assert.equal((await client.query(read, ["owner", window.starts_at])).rowCount, 0);
      await client.query("ROLLBACK");
      checks++;
    }
    await client.query(`UPDATE personal_clinical_reconciliation_grants SET status='revoked',
      revoked_at=now(),revoked_by_user_id='operator',revocation_reason='Approved fixture revocation',
      revocation_approval_reference='approved-fixture-revocation' WHERE id=$1`, [grantId]);
    assert.equal((await client.query(read, ["owner", window.starts_at])).rowCount, 0);
    checks++;
    await denied(`UPDATE personal_clinical_reconciliation_grants SET status='active',revoked_at=NULL,
      revoked_by_user_id=NULL,revocation_reason=NULL,revocation_approval_reference=NULL`);
    await denied(`UPDATE personal_clinical_reconciliation_grants SET revocation_reason='Rewrite revoked audit history'`);
    assert.deepEqual(await snapshot(), before); // no billing/account/organization writes by grant/revoke
    checks++;
    // Account erasure clears actor identity without invalidating revocation history.
    await client.query("DELETE FROM users WHERE id='operator'");
    const audit = (await client.query("SELECT approved_by_user_id,revoked_by_user_id,status,reason,revocation_reason FROM personal_clinical_reconciliation_grants")).rows[0];
    assert.equal(audit.approved_by_user_id, null);
    assert.equal(audit.revoked_by_user_id, null);
    assert.equal(audit.status, "revoked");
    checks++;
    await client.query("DELETE FROM businesses");
    assert.equal((await client.query("SELECT count(*)::int AS n FROM personal_clinical_reconciliation_grants")).rows[0].n, 0);
    checks++;
    console.log(`PASS: ${checks} isolated PostgreSQL assertions; no shared DB connection or application bootstrap.`);
  } finally {
    if (client) await client.end();
    if (started) execFileSync("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"], { env: childEnv, stdio: "pipe" });
    rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
