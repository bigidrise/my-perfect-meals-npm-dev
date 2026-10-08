import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { identityAccountColumns, requestColumns } from "./professionalIdentityDecisionRepository";
import { isDevelopmentFounderDemoAccount } from "../config/developmentFounderPhysicianDemo";
import { ProfessionalRequestError } from "./professionalOnboardingService";
import type { IdentityAccountSnapshot } from "./professionalIdentityDecisionService";
import type { CredentialContext, CredentialReviewRepository } from "./professionalCredentialReviewService";

type Executor = { execute(query: SQL): Promise<unknown> };
async function rows<T>(executor: Executor, query: SQL): Promise<T[]> {
  return (await executor.execute(query) as { rows: T[] }).rows;
}
export async function readCredentialContext(executor: Executor, selector: { requestId: string } | { userId: string }): Promise<CredentialContext | null> {
  const condition = "requestId" in selector ? sql`id = ${selector.requestId}` : sql`owner_user_id = ${selector.userId}`;
  // One statement snapshot: never combine a former account identity with a
  // later approval/credential event during a concurrent identity transition.
  const [context] = await rows<CredentialContext>(executor, sql`
    SELECT row_to_json(r) AS request, row_to_json(a) AS account,
      CASE WHEN approval.id IS NOT NULL THEN jsonb_build_object('id',approval.id,
        'actorUserId',approval.actor_user_id,'eventType',approval.event_type,
        'metadata',approval.metadata,'createdAt',approval.created_at) END AS approval,
      CASE WHEN latest.id IS NOT NULL THEN jsonb_build_object('id',latest.id,
        'actorUserId',latest.actor_user_id,'eventType',latest.event_type,
        'metadata',latest.metadata,'createdAt',latest.created_at) END AS latest,
      EXISTS(SELECT 1 FROM professional_identity_events e WHERE e.request_id=r.id
        AND e.event_type='identity_approved' AND e.metadata->>'roleChanged'='true'
        AND e.metadata->>'approvedIdentity'=a."professionalRole") AS required,
      EXISTS(SELECT 1 FROM demo_professional_grants g WHERE g.user_id=a.id) AS demo
    FROM (SELECT ${requestColumns} FROM professional_identity_requests WHERE ${condition}) r
    JOIN (SELECT ${identityAccountColumns} FROM users) a ON a.id=r."ownerUserId"
    LEFT JOIN LATERAL (SELECT * FROM professional_identity_events e WHERE e.request_id=r.id
      AND e.event_type='identity_approved' AND e.metadata->>'approvedIdentity'=a."professionalRole"
      ORDER BY e.request_revision DESC LIMIT 1) approval ON true
    LEFT JOIN LATERAL (SELECT * FROM professional_identity_events e WHERE e.request_id=r.id
      AND e.event_type IN ('credentials_verified','credentials_rejected','credentials_pending')
      ORDER BY e.request_revision DESC LIMIT 1) latest ON true`);
  if (context && isDevelopmentFounderDemoAccount(context.account.id)) context.demo = true;
  return context ?? null;
}
export const credentialReviewRepository: CredentialReviewRepository = {
  transaction: work => db.transaction(async tx => {
    await tx.execute(sql.raw("SET LOCAL lock_timeout = '3000ms'"));
    await tx.execute(sql.raw("SET LOCAL statement_timeout = '10000ms'"));
    return work({
      context: id => readCredentialContext(tx, { requestId: id }),
      async lockOwner(id) { await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"professional_request:" + id}))`); },
      async accounts(ids) {
        const result: IdentityAccountSnapshot[] = [];
        for (const id of ids) result.push(...await rows<IdentityAccountSnapshot>(tx, sql`SELECT ${identityAccountColumns} FROM users WHERE id=${id} FOR UPDATE`));
        return result;
      },
      async isDemo(id) {
        if (isDevelopmentFounderDemoAccount(id)) return true;
        return (await rows<{ demo: boolean }>(tx, sql`SELECT EXISTS(SELECT 1 FROM demo_professional_grants WHERE user_id=${id}) AS demo`))[0]?.demo !== false;
      },
      async append(context, reviewer, input) {
        const [schema] = await rows<{ ready: boolean }>(tx, sql`
          SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='professional_identity_events'::regclass
            AND tgname='professional_identity_events_append_only' AND tgenabled='O' AND NOT tgisinternal)
          AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='users'::regclass
            AND tgname='users_professional_lifecycle_erasure' AND tgenabled='O' AND NOT tgisinternal)
          AND EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='professional_lifecycle_erasure_audit'::regclass
            AND conname='professional_lifecycle_erasure_audit_event_type_check'
            AND position('credentials_verified' in pg_get_constraintdef(oid)) > 0) AS ready`);
        if (schema?.ready !== true) throw new ProfessionalRequestError(503, "CREDENTIAL_SCHEMA_NOT_READY", "The credential audit/erasure migration must be installed before any decision.");
        const changed = await rows<{ revision: number }>(tx, sql`UPDATE professional_identity_requests
          SET revision=revision+1, updated_at=now() WHERE id=${context.request.id}
          AND state='approved' AND revision=${input.revision} RETURNING revision`);
        if (!changed[0]) throw new ProfessionalRequestError(409, "CREDENTIAL_REVIEW_STATE_CHANGED", "Review changed. Reload before deciding.");
        // Existing append-only lifecycle trigger and account-erasure policy apply.
        // There is deliberately no UPDATE of users, Studios, grants or billing.
        await tx.execute(sql`INSERT INTO professional_identity_events
          (id,request_id,actor_user_id,event_type,request_revision,metadata)
          VALUES(${randomUUID()},${context.request.id},${reviewer.id},${"credentials_" + input.decision},
            ${changed[0].revision},${JSON.stringify({
              ...input, reviewerAuthority: "authenticated_admin_with_current_mfa",
              reviewerSecurityVersion: reviewer.securityVersion,
            })}::jsonb)`);
      },
    });
  }),
};
