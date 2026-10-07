import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import type { ProfessionalIdentityRequest } from "@shared/professionalOnboarding";
import type { ProfessionalRequestRepository, ProfessionalRequestTransaction } from "./professionalOnboardingService";

type DatabaseTransaction = { execute(query: SQL): Promise<unknown> };
const columns = sql.raw(`id, owner_user_id AS "ownerUserId", requested_role AS "requestedRole",
  professional_category AS "professionalCategory", credential_type AS "credentialType",
  credential_body AS "credentialBody", credential_number AS "credentialNumber", credential_year AS "credentialYear",
  state, revision, created_at AS "createdAt", updated_at AS "updatedAt", submitted_at AS "submittedAt",
  decision_reason AS "decisionReason", decided_at AS "decidedAt"`);
async function rows<T>(tx: DatabaseTransaction, query: SQL): Promise<T[]> {
  return (await tx.execute(query) as { rows: T[] }).rows;
}
function adapter(tx: DatabaseTransaction): ProfessionalRequestTransaction {
  return {
    async lockAccount(id) {
      await tx.execute(sql.raw("SET LOCAL lock_timeout = '3000ms'"));
      await tx.execute(sql.raw("SET LOCAL statement_timeout = '10000ms'"));
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"professional_request:" + id}))`);
    },
    async accountRole(id) {
      return (await rows<{ professionalRole: string | null }>(tx, sql`SELECT professional_role AS "professionalRole" FROM users WHERE id = ${id}`))[0] ?? null;
    },
    async request(id) {
      return (await rows<ProfessionalIdentityRequest>(tx, sql`SELECT ${columns} FROM professional_identity_requests WHERE owner_user_id = ${id} FOR UPDATE`))[0] ?? null;
    },
    async create(id) {
      return (await rows<ProfessionalIdentityRequest>(tx, sql`INSERT INTO professional_identity_requests (id, owner_user_id) VALUES (${randomUUID()}, ${id}) RETURNING ${columns}`))[0];
    },
    async save(row) {
      return (await rows<ProfessionalIdentityRequest>(tx, sql`UPDATE professional_identity_requests
        SET requested_role = ${row.requestedRole}, professional_category = ${row.professionalCategory},
            credential_type = ${row.credentialType}, credential_body = ${row.credentialBody},
            credential_number = ${row.credentialNumber}, credential_year = ${row.credentialYear},
            state = ${row.state}, revision = ${row.revision}, submitted_at = ${row.submittedAt}, updated_at = now()
        WHERE id = ${row.id} AND owner_user_id = ${row.ownerUserId} RETURNING ${columns}`))[0];
    },
    async event(row, kind, changedFields) {
      await tx.execute(sql`INSERT INTO professional_identity_events
        (id, request_id, actor_user_id, event_type, request_revision, metadata)
        VALUES (${randomUUID()}, ${row.id}, ${row.ownerUserId}, ${kind}, ${row.revision}, ${JSON.stringify({ changedFields })}::jsonb)`);
    },
  };
}
export const professionalOnboardingRepository: ProfessionalRequestRepository = {
  transaction: work => db.transaction(tx => work(adapter(tx))),
};
