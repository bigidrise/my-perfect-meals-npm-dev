import { pool } from "../../db";
import type { PoolClient } from "pg";
import {
  exactFoodDirectiveSchema,
  clinicalReviewDispositionSchema,
  type ClinicalDirectiveRecord,
  type ClinicalReviewDecision,
  type ExactFoodDirective,
} from "../../../shared/clinicalMealAuthority";
import type { FoodBuilderStrategy, HealthProtocol } from "../../../shared/healthProtocolState";
import { readShadowProtocolRecords, shadowTransaction, devOnly } from "./persistence";
import { resolveClinicalMealAuthority } from "./resolveClinicalMealAuthority";

type ProviderWrite = {
  actorUserId: string;
  subjectUserId: string;
  membershipId: string;
  sourceId: string;
};

async function lockVerifiedProviderSource(client: PoolClient, input: ProviderWrite) {
  const { rows } = await client.query<{ protocol_key: HealthProtocol }>(
    `SELECT p.protocol_key FROM health_protocol_sources p
     JOIN studio_memberships sm ON sm.id=p.care_relationship_id
     JOIN studios s ON s.id=sm.studio_id
     WHERE p.id=$1 AND p.subject_user_id=$2 AND p.source_kind='provider'
       AND p.status='active' AND p.owner_user_id=$3
       AND p.care_relationship_id=$4 AND p.evidence_ref='membership:' || sm.id::text
       AND sm.client_user_id=$2 AND sm.status='active' AND sm.is_archived=false
       AND s.owner_user_id=$3 AND s.type='clinic' AND s.status='active'
       AND s.verification_status='verified'
     FOR UPDATE OF p`,
    [input.sourceId, input.subjectUserId, input.actorUserId, input.membershipId],
  );
  if (!rows[0]) throw new Error("An active verified provider-owned source is required.");
  return rows[0].protocol_key;
}

/**
 * Server-service entry only, not an HTTP route. A future caller must enforce
 * clinical role, training, consent, and CSRF before supplying the actor.
 * No legacy label, lab row, or free-text note can create a directive here.
 */
export async function recordProviderFoodDirective(input: ProviderWrite & {
  rule: ExactFoodDirective;
  effectiveAt: Date;
  expiresAt?: Date | null;
  supersedesId?: string | null;
  reasonCode: string;
}): Promise<string> {
  const rule = exactFoodDirectiveSchema.parse(input.rule);
  if (!Number.isFinite(input.effectiveAt.getTime()) ||
      (input.expiresAt && (!Number.isFinite(input.expiresAt.getTime()) ||
        input.expiresAt <= input.effectiveAt)) ||
      !/^[a-z][a-z0-9_]{2,79}$/.test(input.reasonCode)) {
    throw new Error("A valid exact directive, interval, and reason code are required.");
  }
  return shadowTransaction(async (client) => {
    const protocol = await lockVerifiedProviderSource(client, input);
    if (input.supersedesId) {
      const { rows: prior } = await client.query(
        `SELECT d.id, (
           SELECT r.disposition FROM health_protocol_review_decisions r
           WHERE r.directive_id=d.id ORDER BY r.decided_at DESC, r.id DESC LIMIT 1
         ) AS current_disposition
         FROM health_protocol_food_directives d
         WHERE d.id=$1 AND d.subject_user_id=$2 AND d.source_id=$3 AND d.protocol_key=$4`,
        [input.supersedesId, input.subjectUserId, input.sourceId, protocol],
      );
      if (prior[0]?.current_disposition !== "verified_provider_directive") {
        throw new Error("A current directive from this source is required for supersession.");
      }
      await client.query(
        `INSERT INTO health_protocol_review_decisions
         (subject_user_id, source_id, directive_id, disposition, actor_user_id, reason_code)
         VALUES ($1,$2,$3,'historical',$4,'provider_superseded')`,
        [input.subjectUserId, input.sourceId, input.supersedesId, input.actorUserId],
      );
    }
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO health_protocol_food_directives
       (subject_user_id, source_id, protocol_key, rule, effective_at, expires_at, supersedes_id)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7) RETURNING id`,
      [input.subjectUserId, input.sourceId, protocol, JSON.stringify(rule),
        input.effectiveAt, input.expiresAt ?? null, input.supersedesId ?? null],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("Exact clinical directive was not saved.");
    await client.query(
      `INSERT INTO health_protocol_review_decisions
       (subject_user_id, source_id, directive_id, disposition, actor_user_id, reason_code)
       VALUES ($1,$2,$3,'verified_provider_directive',$4,$5)`,
      [input.subjectUserId, input.sourceId, id, input.actorUserId, input.reasonCode],
    );
    return id;
  });
}

/** A provider ends only their own exact directive; source history is retained. */
export async function discontinueProviderFoodDirective(input: ProviderWrite & {
  directiveId: string;
}): Promise<void> {
  await shadowTransaction(async (client) => {
    const protocol = await lockVerifiedProviderSource(client, input);
    const { rows } = await client.query(
      `SELECT d.id, (
         SELECT r.disposition FROM health_protocol_review_decisions r
         WHERE r.directive_id=d.id ORDER BY r.decided_at DESC, r.id DESC LIMIT 1
       ) AS current_disposition
       FROM health_protocol_food_directives d
       WHERE d.id=$1 AND d.subject_user_id=$2 AND d.source_id=$3 AND d.protocol_key=$4`,
      [input.directiveId, input.subjectUserId, input.sourceId, protocol],
    );
    if (!rows[0]) throw new Error("Directive belongs to another source.");
    if (rows[0].current_disposition === "historical") return;
    if (rows[0].current_disposition !== "verified_provider_directive") {
      throw new Error("Only a current provider directive can be discontinued.");
    }
    await client.query(
      `INSERT INTO health_protocol_review_decisions
       (subject_user_id, source_id, directive_id, disposition, actor_user_id, reason_code)
       VALUES ($1,$2,$3,'historical',$4,'provider_discontinued')`,
      [input.subjectUserId, input.sourceId, input.directiveId, input.actorUserId],
    );
  });
}

/** Patient review cannot alter provider-owned claims or declare medication use. */
export async function recordSubjectClinicalReview(input: {
  actorUserId: string;
  subjectUserId: string;
  sourceId: string;
  disposition: "history_only" | "current_guidance" | "historical" | "unresolved";
  reasonCode: string;
}): Promise<void> {
  if (input.actorUserId !== input.subjectUserId ||
      !/^[a-z][a-z0-9_]{2,79}$/.test(input.reasonCode)) {
    throw new Error("Subject-owned review and a reason code are required.");
  }
  clinicalReviewDispositionSchema.parse(input.disposition);
  await shadowTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id FROM health_protocol_sources
       WHERE id=$1 AND subject_user_id=$2
         AND source_kind IN ('user','lab','legacy_migrated')
         AND ($3::text <> 'current_guidance' OR
           (status='active' AND
             (source_kind='user' OR
               (source_kind='lab' AND accepted_recommendation=true))))
       FOR UPDATE`,
      [input.sourceId, input.subjectUserId, input.disposition],
    );
    if (!rows[0]) throw new Error("Subject cannot review this clinical source.");
    await client.query(
      `INSERT INTO health_protocol_review_decisions
       (subject_user_id, source_id, disposition, actor_user_id, reason_code)
       VALUES ($1,$2,$3,$4,$5)`,
      [input.subjectUserId, input.sourceId, input.disposition, input.actorUserId, input.reasonCode],
    );
  });
}

/**
 * Explicit subject-owned hard restriction, separate from a condition name.
 * Existing allergies and other hard safety mechanisms remain independent.
 * This is not exposed as a patient-facing endpoint during the overlay freeze.
 */
export async function recordSubjectHardFoodRestriction(input: {
  actorUserId: string;
  subjectUserId: string;
  sourceId: string;
  rule: ExactFoodDirective;
  effectiveAt: Date;
  expiresAt?: Date | null;
  reasonCode: string;
}): Promise<string> {
  if (input.actorUserId !== input.subjectUserId) throw new Error("Subject ownership required.");
  const rule = exactFoodDirectiveSchema.parse(input.rule);
  if (!Number.isFinite(input.effectiveAt.getTime()) ||
      (input.expiresAt && (!Number.isFinite(input.expiresAt.getTime()) ||
        input.expiresAt <= input.effectiveAt)) ||
      !/^[a-z][a-z0-9_]{2,79}$/.test(input.reasonCode)) {
    throw new Error("A valid exact directive, interval, and reason code are required.");
  }
  return shadowTransaction(async (client) => {
    const { rows: sources } = await client.query<{ protocol_key: HealthProtocol }>(
      `SELECT protocol_key FROM health_protocol_sources
       WHERE id=$1 AND subject_user_id=$2 AND status='active'
         AND (source_kind='user' OR
           (source_kind='lab' AND accepted_recommendation=true))
       FOR UPDATE`,
      [input.sourceId, input.subjectUserId],
    );
    if (!sources[0]) throw new Error("A reviewed, subject-owned active source is required.");
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO health_protocol_food_directives
       (subject_user_id, source_id, protocol_key, rule, effective_at, expires_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING id`,
      [input.subjectUserId, input.sourceId, sources[0].protocol_key,
        JSON.stringify(rule), input.effectiveAt, input.expiresAt ?? null],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("Exact subject directive was not saved.");
    await client.query(
      `INSERT INTO health_protocol_review_decisions
       (subject_user_id, source_id, directive_id, disposition, actor_user_id, reason_code)
       VALUES ($1,$2,$3,'current_hard_restriction',$4,$5)`,
      [input.subjectUserId, input.sourceId, id, input.actorUserId, input.reasonCode],
    );
    return id;
  });
}

/** Explicit shadow observation only; food consumers do not import this loader. */
export async function readClinicalMealAuthorityShadow(input: {
  subjectUserId: string;
  history: readonly string[];
  builder: FoodBuilderStrategy;
  now?: Date;
}) {
  devOnly();
  const { records, relationshipStatus } = await readShadowProtocolRecords(input.subjectUserId);
  const { rows: directiveRows } = await pool.query(
    `SELECT id, subject_user_id, source_id, protocol_key, rule, effective_at,
            expires_at, supersedes_id
     FROM health_protocol_food_directives WHERE subject_user_id=$1 ORDER BY created_at, id`,
    [input.subjectUserId],
  );
  const directives: ClinicalDirectiveRecord[] = directiveRows.map((row) => ({
    id: row.id, subjectUserId: row.subject_user_id, sourceId: row.source_id,
    protocol: row.protocol_key, rule: exactFoodDirectiveSchema.parse(row.rule),
    effectiveAt: row.effective_at, expiresAt: row.expires_at,
    supersedesId: row.supersedes_id,
  }));
  const { rows: decisionRows } = await pool.query(
    `SELECT id, subject_user_id, source_id, directive_id, disposition,
            actor_user_id, decided_at
     FROM health_protocol_review_decisions WHERE subject_user_id=$1
     ORDER BY decided_at, id`,
    [input.subjectUserId],
  );
  const decisions: ClinicalReviewDecision[] = decisionRows.map((row) => ({
    id: row.id, subjectUserId: row.subject_user_id, sourceId: row.source_id,
    directiveId: row.directive_id,
    disposition: clinicalReviewDispositionSchema.parse(row.disposition),
    actorUserId: row.actor_user_id, decidedAt: row.decided_at,
  }));
  return resolveClinicalMealAuthority({
    subjectUserId: input.subjectUserId, history: input.history, builder: input.builder,
    sources: records, directives, decisions, relationshipStatus, now: input.now ?? new Date(),
  });
}