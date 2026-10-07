import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import type { DemoGrant, DemoPatient, DemoWorkspace } from "@shared/demoProfessional";
import type { DemoRepository } from "./demoProfessionalService";
import { getAcademyProgression } from "./academyProgression";
import { identityAccountColumns } from "./professionalIdentityDecisionRepository";
import type { IdentityAccountSnapshot } from "./professionalIdentityDecisionService";
import { ProfessionalRequestError } from "./professionalOnboardingService";
type Executor = { execute(query: SQL): Promise<unknown> };
async function rows<T>(tx: Executor, query: SQL): Promise<T[]> { return (await tx.execute(query) as { rows: T[] }).rows; }
const grantColumns = sql.raw(`id, user_id AS "userId", workspace_id AS "workspaceId", persona,
  operating_status AS "operatingStatus", state, revision, capabilities, expires_at AS "expiresAt",
  approver_id AS "approverId", reason, training_basis AS "trainingBasis", training_waiver_reason AS "trainingWaiverReason",
  acknowledged_at AS "acknowledgedAt", acknowledgment_version AS "acknowledgmentVersion", identity_request_id AS "identityRequestId"`);
function normalizeGrant(row: DemoGrant | undefined): DemoGrant | null {
  return row ? { ...row, expiresAt: new Date(row.expiresAt).toISOString(), acknowledgedAt: row.acknowledgedAt ? new Date(row.acknowledgedAt).toISOString() : null } : null;
}
type PatientRow = { id: string; workspaceId: string; classification: DemoPatient["classification"]; label: string; data: Omit<DemoPatient, "id" | "workspaceId" | "classification" | "label" | "revision">; revision: number };
const patientColumns = sql.raw(`id, workspace_id AS "workspaceId", classification, label, data, revision`);
function patient(row: PatientRow): DemoPatient { return { ...row.data, id: row.id, workspaceId: row.workspaceId, classification: row.classification, label: row.label, revision: row.revision }; }
export const demoProfessionalRepository: DemoRepository = {
  transaction: work => db.transaction(async tx => {
    await tx.execute(sql.raw("SET LOCAL lock_timeout = '3000ms'"));
    await tx.execute(sql.raw("SET LOCAL statement_timeout = '10000ms'"));
    return work({
      async accounts(ids) {
        const result: IdentityAccountSnapshot[] = [];
        for (const id of [...new Set(ids)].sort()) result.push(...await rows<IdentityAccountSnapshot>(tx, sql`SELECT ${identityAccountColumns} FROM users WHERE id=${id} FOR UPDATE`));
        return result;
      },
      grant: async userId => normalizeGrant((await rows<DemoGrant>(tx, sql`SELECT ${grantColumns} FROM demo_professional_grants WHERE user_id=${userId} FOR UPDATE`))[0]),
      workspace: async id => (await rows<DemoWorkspace>(tx, sql`SELECT id,label,classification FROM demo_professional_workspaces WHERE id=${id}`))[0] ?? null,
      patients: async workspaceId => (await rows<PatientRow>(tx, sql`SELECT ${patientColumns} FROM demo_professional_patients
        WHERE workspace_id=${workspaceId} AND classification='synthetic' ORDER BY id`)).map(patient),
      patient: async (workspaceId, id) => {
        const row = (await rows<PatientRow>(tx, sql`SELECT ${patientColumns} FROM demo_professional_patients
          WHERE id=${id} AND workspace_id=${workspaceId} AND classification='synthetic' FOR UPDATE`))[0];
        return row ? patient(row) : null;
      },
      academyComplete: async id => { const evidence = await getAcademyProgression(id); return evidence.phase1.complete && evidence.proCare.complete; },
      approvedIdentityRequest: async (id, requestId) => (await rows(tx, sql`SELECT request.id FROM professional_identity_requests request
        JOIN professional_identity_events event ON event.request_id=request.id AND event.event_type='identity_approved'
        WHERE request.id=${requestId} AND request.owner_user_id=${id} AND request.state='approved'
          AND request.requested_role='physician' AND event.metadata->>'approvedIdentity'='physician'
          AND event.request_revision=request.revision`)).length > 0,
      async createDataset(workspace, record) {
        await tx.execute(sql`INSERT INTO demo_professional_workspaces(id,label,classification) VALUES(${workspace.id},${workspace.label},'synthetic')`);
        const { id, workspaceId, label, classification, revision, ...data } = record;
        await tx.execute(sql`INSERT INTO demo_professional_patients(id,workspace_id,label,classification,data)
          VALUES(${id},${workspaceId},${label},'synthetic',${JSON.stringify(data)}::jsonb)`);
      },
      async saveGrant(grant) {
        const result = await rows(tx, sql`INSERT INTO demo_professional_grants
          (id,user_id,workspace_id,persona,operating_status,state,revision,capabilities,expires_at,approver_id,reason,
           training_basis,training_waiver_reason,acknowledged_at,acknowledgment_version,identity_request_id)
          VALUES (${grant.id},${grant.userId},${grant.workspaceId},'physician','demo_only',${grant.state},${grant.revision},
            ${JSON.stringify(grant.capabilities)}::jsonb,${grant.expiresAt}::timestamptz,${grant.approverId},${grant.reason},
            ${grant.trainingBasis},${grant.trainingWaiverReason},${grant.acknowledgedAt}::timestamptz,${grant.acknowledgmentVersion},${grant.identityRequestId})
          ON CONFLICT(user_id) DO UPDATE SET state=excluded.state, revision=excluded.revision,
            acknowledged_at=excluded.acknowledged_at,acknowledgment_version=excluded.acknowledgment_version,
            identity_request_id=excluded.identity_request_id,updated_at=clock_timestamp()
          WHERE demo_professional_grants.id=excluded.id AND demo_professional_grants.revision=${grant.revision - 1}
          RETURNING id`);
        if (!result.length) throw new ProfessionalRequestError(409, "DEMO_GRANT_CHANGED", "Demo grant changed; reload.");
      },
      async savePlan(record, plan) {
        const result = await rows<PatientRow>(tx, sql`UPDATE demo_professional_patients
          SET data=jsonb_set(data,'{plan}',${JSON.stringify(plan)}::jsonb), revision=revision+1
          WHERE id=${record.id} AND workspace_id=${record.workspaceId} AND classification='synthetic' AND revision=${record.revision}
          RETURNING ${patientColumns}`);
        if (!result[0]) throw new ProfessionalRequestError(409, "DEMO_PATIENT_CHANGED", "Synthetic patient changed; reload.");
        return patient(result[0]);
      },
      async saveInvitation(record, invitation) {
        const result = await rows<PatientRow>(tx, sql`UPDATE demo_professional_patients
          SET data=jsonb_set(data,'{connectionInvitation}',${JSON.stringify(invitation)}::jsonb), revision=revision+1
          WHERE id=${record.id} AND workspace_id=${record.workspaceId} AND classification='synthetic' AND revision=${record.revision}
          RETURNING ${patientColumns}`);
        if (!result[0]) throw new ProfessionalRequestError(409, "DEMO_PATIENT_CHANGED", "Synthetic patient changed; reload.");
        return patient(result[0]);
      },
      async invalidateSessions(account) {
        const changed = await rows(tx, sql`UPDATE users SET auth_security_version=auth_security_version+1,
          auth_token=NULL,auth_token_created_at=NULL,auth_token_mfa_verified_at=NULL
          WHERE id=${account.id} AND auth_security_version=${account.authSecurityVersion} RETURNING id`);
        if (!changed.length) throw new ProfessionalRequestError(409, "DEMO_TARGET_CHANGED", "Target security state changed.");
      },
      async event(grant, actorId, kind, metadata) {
        await tx.execute(sql`INSERT INTO demo_professional_events(id,grant_id,actor_user_id,event_type,metadata)
          VALUES(${randomUUID()},${grant.id},${actorId},${kind},${JSON.stringify({
            ...metadata, grantRevision: grant.revision, workspaceId: grant.workspaceId,
            operatingStatus: "demo_only", persona: "physician",
          })}::jsonb)`);
      },
    });
  }),
};
export async function readDemoRestriction(userId: string) {
  return normalizeGrant((await rows<DemoGrant>(db, sql`SELECT ${grantColumns} FROM demo_professional_grants WHERE user_id=${userId}`))[0]);
}
export async function readDemoGrantHistory(userId: string) {
  return rows(db, sql`SELECT event.id,event.actor_user_id AS "actorUserId",event.event_type AS "eventType",event.metadata,event.created_at AS "createdAt"
    FROM demo_professional_events event JOIN demo_professional_grants grant ON grant.id=event.grant_id
    WHERE grant.user_id=${userId} ORDER BY event.created_at,event.id`);
}
