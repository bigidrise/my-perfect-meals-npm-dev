import { readFileSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
import { runProfessionalOnboardingMigration } from "../db/migrations/runProfessionalOnboardingMigration";

describe("Stage 1 additive storage and no-authority write contract", () => {
  test("DDL only creates new request/event storage and ledger protection", async () => {
    const queries: string[] = [];
    const dialect = new PgDialect();
    await runProfessionalOnboardingMigration({
      transaction: work => work({ execute: async sql => { queries.push(dialect.sqlToQuery(sql).sql); } }),
    });
    expect(queries.join("\n")).not.toMatch(/\b(?:ALTER|UPDATE|INSERT INTO|DELETE FROM)\s+(?:TABLE\s+)?users\b/i);
    expect(queries.filter(sql => sql.startsWith("CREATE TABLE"))).toHaveLength(2);
    expect(queries.join("\n")).toContain("BEFORE UPDATE OR DELETE OR TRUNCATE");
    expect(queries.join("\n")).toContain("SET LOCAL lock_timeout");
    expect(queries.join("\n")).toContain("UNIQUE (request_id, request_revision)");
  });
  test("repository mutations target only requests and lifecycle events", () => {
    const source = readFileSync("server/services/professionalOnboardingRepository.ts", "utf8");
    const targets = [...source.matchAll(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+([a-z_]+)/g)].map(match => match[1]);
    expect(targets).toEqual(["professional_identity_requests", "professional_identity_requests", "professional_identity_events"]);
    expect(source).toContain('FROM users WHERE id = ${id}');
    expect(source).toContain("pg_advisory_xact_lock");
  });
  test("retired endpoint remains 410 and application UI never invokes it", () => {
    const auth = readFileSync("server/routes/auth.session.ts", "utf8");
    expect(auth).toMatch(/router\.post\("\/api\/auth\/upgrade-to-procare"[\s\S]*?res\.status\(410\)/);
    for (const file of ["client/src/pages/procare/ProCareAttestation.tsx", "client/src/pages/procare/ProfessionalRequestReview.tsx"]) {
      expect(readFileSync(file, "utf8")).not.toContain("upgradeToProCare");
    }
    expect(readFileSync("client/src/pages/procare/ProfessionalRequestReview.tsx", "utf8")).not.toContain("/api/legal/accept");
  });
  test("request schema has no second authorized role or credential verification column", () => {
    const source = readFileSync("server/db/schema/professionalOnboarding.ts", "utf8");
    expect(source).not.toMatch(/\bprofessionalRole:|\bverificationStatus:|\bisProCare:/);
  });
});
