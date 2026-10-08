import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import type { ProfessionalIdentityRequest } from "@shared/professionalOnboarding";
import type { IdentityAccountSnapshot, IdentityDecisionRepository } from "./professionalIdentityDecisionService";
import { ProfessionalRequestError } from "./professionalOnboardingService";

type Transaction = { execute(query: SQL): Promise<unknown> };
export const requestColumns = sql.raw(`id, owner_user_id AS "ownerUserId", requested_role AS "requestedRole",
  professional_category AS "professionalCategory", credential_type AS "credentialType",
  credential_body AS "credentialBody", credential_number AS "credentialNumber", credential_year AS "credentialYear",
  state, revision, created_at AS "createdAt", updated_at AS "updatedAt", submitted_at AS "submittedAt",
  decision_reason AS "decisionReason", decided_at AS "decidedAt"`);
export const identityAccountColumns = sql.raw(`id, professional_role AS "professionalRole",
  auth_security_version AS "authSecurityVersion", professional_category AS "professionalCategory",
  credential_body AS "credentialBody", credential_number AS "credentialNumber", credential_type AS "credentialType",
  credential_year AS "credentialYear", is_pro_care AS "isProCare", organization_id AS "organizationId",
  is_admin AS "isAdmin", mfa_enabled AS "mfaEnabled"`);
async function rows<T>(tx: Transaction, query: SQL): Promise<T[]> { return (await tx.execute(query) as { rows: T[] }).rows; }

export const identityDecisionRepository: IdentityDecisionRepository = {
  transaction: work => db.transaction(async tx => {
    await tx.execute(sql.raw("SET LOCAL lock_timeout = '3000ms'"));
    await tx.execute(sql.raw("SET LOCAL statement_timeout = '10000ms'"));
    return work({
      request: async id => (await rows<ProfessionalIdentityRequest>(tx, sql`SELECT ${requestColumns} FROM professional_identity_requests WHERE id = ${id}`))[0] ?? null,
      async lockOwner(id) { await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"professional_request:" + id}))`); },
      async accounts(ids) {
        const result: IdentityAccountSnapshot[] = [];
        for (const id of ids) result.push(...await rows<IdentityAccountSnapshot>(tx, sql`SELECT ${identityAccountColumns} FROM users WHERE id = ${id} FOR UPDATE`));
        return result;
      },
      async transition(account, role) {
        const changed = await rows<{ version: number }>(tx, sql`UPDATE users
          SET professional_role = ${role}, auth_security_version = auth_security_version + 1,
              auth_token = NULL, auth_token_created_at = NULL, auth_token_mfa_verified_at = NULL
          WHERE id = ${account.id} AND auth_security_version = ${account.authSecurityVersion}
            AND professional_role IS NOT DISTINCT FROM ${account.professionalRole}
          RETURNING auth_security_version AS version`);
        if (!changed[0]) throw new ProfessionalRequestError(409, "TARGET_IDENTITY_CHANGED", "Account identity changed.");
        return changed[0].version;
      },
      async decide(row, state, reason) {
        const result = await rows<ProfessionalIdentityRequest>(tx, sql`UPDATE professional_identity_requests
          SET state = ${state}, revision = revision + 1, decision_reason = ${reason}, decided_at = now(), updated_at = now()
          WHERE id = ${row.id} AND state = 'submitted' AND revision = ${row.revision} RETURNING ${requestColumns}`);
        if (!result[0]) throw new ProfessionalRequestError(409, "REQUEST_STATE_CHANGED", "Request changed.");
        return result[0];
      },
      async event(row, reviewer, kind, metadata) {
        await tx.execute(sql`INSERT INTO professional_identity_events
          (id, request_id, actor_user_id, event_type, request_revision, metadata)
          VALUES (${randomUUID()}, ${row.id}, ${reviewer}, ${kind}, ${row.revision}, ${JSON.stringify(metadata)}::jsonb)`);
      },
    });
  }),
};

export async function listProfessionalReviewRequests() {
  return rows<ProfessionalIdentityRequest>(db, sql`SELECT ${requestColumns} FROM professional_identity_requests
    WHERE state = 'submitted' OR (state = 'approved' AND requested_role IN ('physician','dietitian','nurse_practitioner'))
    ORDER BY (state = 'submitted') DESC, updated_at DESC, id LIMIT 50`);
}
export async function readProfessionalReviewRequest(id: string) {
  const request = (await rows<ProfessionalIdentityRequest>(db, sql`SELECT ${requestColumns} FROM professional_identity_requests WHERE id = ${id}`))[0];
  if (!request) return null;
  const account = (await rows<IdentityAccountSnapshot>(db, sql`SELECT ${identityAccountColumns} FROM users WHERE id = ${request.ownerUserId}`))[0];
  return account ? { request, account } : null;
}
