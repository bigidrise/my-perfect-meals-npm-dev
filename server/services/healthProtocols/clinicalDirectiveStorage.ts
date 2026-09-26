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
import { readShadowProtocolRecords, shadowTransaction, devOnly, putClaim } from "./persistence";
import { resolveClinicalMealAuthority } from "./resolveClinicalMealAuthority";

type ProviderWrite = {
  actorUserId: string;
  subjectUserId: string;
  membershipId: string;
  sourceId: string;
};

async function lockVerifiedMembership(client: PoolClient, input: Pick<ProviderWrite, "actorUserId" | "subjectUserId" | "membershipId">) {
  const { rows } = await client.query(
    `SELECT sm.id FROM studio_memberships sm JOIN studios s ON s.id=sm.studio_id
     WHERE sm.id=$1 AND sm.client_user_id=$2 AND sm.status='active'
       AND sm.is_archived=false AND s.owner_user_id=$3 AND s.type='clinic'
       AND s.status='active' AND s.verification_status='verified'
     FOR UPDATE OF sm, s`,
    [input.membershipId, input.subjectUserId, input.actorUserId],
  );
  if (!rows[0]) throw new Error("An active verified physician relationship is required.");
}

async function lockVerifiedProviderSource(client: PoolClient, input: ProviderWrite) {
  // Take membership/clinic locks before source locks in every provider write,
  // so revocation cannot race the final instruction commit.
  await lockVerifiedMembership(client, input);
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

/**
 * A physician verifies one pending historical claim against a current,
 * exact instruction. The legacy source remains intact; its historical
 * transition event names the created directive ID for an auditable link.
 * Provider source ownership and membership are checked under one transaction.
 */
export async function verifyLegacyClaimAsProviderDirective(input: Omit<ProviderWrite, "sourceId"> & {
  legacySourceId: string;
  rule: ExactFoodDirective;
  effectiveAt: Date;
  expiresAt?: Date | null;
}): Promise<{ providerSourceId: string; directiveId: string }> {
  const rule = exactFoodDirectiveSchema.parse(input.rule);
  if (!Number.isFinite(input.effectiveAt.getTime()) ||
      (input.expiresAt && (!Number.isFinite(input.expiresAt.getTime()) ||
        input.expiresAt <= input.effectiveAt))) {
    throw new Error("A valid exact directive interval is required.");
  }
  return shadowTransaction(async (client) => {
    const { rows: legacy } = await client.query<{ protocol_key: HealthProtocol }>(
      `SELECT protocol_key FROM health_protocol_sources
       WHERE id=$1 AND subject_user_id=$2 AND source_kind='legacy_migrated'
         AND status='pending_review' FOR UPDATE`,
      [input.legacySourceId, input.subjectUserId],
    );
    if (!legacy[0]) throw new Error("A pending historical claim is required.");
    await lockVerifiedMembership(client, input);
    const providerSourceId = await putClaim(client, {
      actorUserId: input.actorUserId, subjectUserId: input.subjectUserId,
      protocol: legacy[0].protocol_key, source: "provider",
      evidenceRef: `membership:${input.membershipId}`, status: "active",
      ownerUserId: input.actorUserId, careRelationshipId: input.membershipId,
      reasonCode: "provider_verified_legacy_claim",
    });
    const lockedProtocol = await lockVerifiedProviderSource(client, {
      actorUserId: input.actorUserId, subjectUserId: input.subjectUserId,
      sourceId: providerSourceId, membershipId: input.membershipId,
    });
    if (lockedProtocol !== legacy[0].protocol_key) throw new Error("Clinical source protocol mismatch.");
    const { rows: directives } = await client.query<{ id: string }>(
      `INSERT INTO health_protocol_food_directives
       (subject_user_id, source_id, protocol_key, rule, effective_at, expires_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING id`,
      [input.subjectUserId, providerSourceId, lockedProtocol,
        JSON.stringify(rule), input.effectiveAt, input.expiresAt ?? null],
    );
    const directiveId = directives[0]?.id;
    if (!directiveId) throw new Error("Verified instruction was not saved.");
    await client.query(
      `INSERT INTO health_protocol_review_decisions
       (subject_user_id, source_id, directive_id, disposition, actor_user_id, reason_code)
       VALUES ($1,$2,$3,'verified_provider_directive',$4,'provider_verified_legacy_claim')`,
      [input.subjectUserId, providerSourceId, directiveId, input.actorUserId],
    );
    const { rows: reviewed } = await client.query<{ id: string }>(
      `INSERT INTO health_protocol_review_decisions
       (subject_user_id, source_id, disposition, actor_user_id, reason_code)
       VALUES ($1,$2,'history_only',$3,'legacy_replaced_by_provider_directive') RETURNING id`,
      [input.subjectUserId, input.legacySourceId, input.actorUserId],
    );
    if (!reviewed[0]) throw new Error("The original claim review was not recorded.");
    await client.query(
      `INSERT INTO health_protocol_review_links
       (origin_source_id, subject_user_id, review_decision_id,
        result_source_id, directive_id, actor_user_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [input.legacySourceId, input.subjectUserId, reviewed[0].id,
        providerSourceId, directiveId, input.actorUserId],
    );
    await client.query(
      `UPDATE health_protocol_sources
       SET status='historical', ended_at=now(), reviewed_at=now(), updated_at=now()
       WHERE id=$1 AND subject_user_id=$2 AND status='pending_review'`,
      [input.legacySourceId, input.subjectUserId],
    );
    // The append-only link row is the relational provenance edge.
    await client.query(
      `INSERT INTO health_protocol_events
       (source_id, actor_user_id, old_status, new_status, reason_code)
       VALUES ($1,$2,'pending_review','historical',$3)`,
      [input.legacySourceId, input.actorUserId, "legacy_verified_provider_directive"],
    );
    return { providerSourceId, directiveId };
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
      `SELECT id, source_kind, status FROM health_protocol_sources
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
    if ((input.disposition === "historical" || input.disposition === "history_only") &&
        rows[0].source_kind === "user" && rows[0].status !== "active") {
      throw new Error("Only a current personal source can be marked past.");
    }
    await client.query(
      `INSERT INTO health_protocol_review_decisions
       (subject_user_id, source_id, disposition, actor_user_id, reason_code)
       VALUES ($1,$2,$3,$4,$5)`,
      [input.subjectUserId, input.sourceId, input.disposition, input.actorUserId, input.reasonCode],
    );
    if ((input.disposition === "historical" || input.disposition === "history_only") &&
        rows[0].source_kind === "user") {
      // The same transaction ends any typed personal rules linked to this
      // source. No provider-owned source can satisfy the locked selector.
      await client.query(
        `INSERT INTO health_protocol_review_decisions
         (subject_user_id, source_id, directive_id, disposition, actor_user_id, reason_code)
         SELECT d.subject_user_id, d.source_id, d.id, 'historical', $3, 'subject_rule_ended'
         FROM health_protocol_food_directives d
         WHERE d.subject_user_id=$1 AND d.source_id=$2 AND
           (SELECT r.disposition FROM health_protocol_review_decisions r
            WHERE r.directive_id=d.id ORDER BY r.decided_at DESC, r.id DESC LIMIT 1)
            = 'current_hard_restriction'`,
        [input.subjectUserId, input.sourceId, input.actorUserId],
      );
      await client.query(
        `UPDATE health_protocol_sources
         SET status='historical', ended_at=now(), reviewed_at=now(), updated_at=now()
         WHERE id=$1 AND subject_user_id=$2 AND source_kind='user' AND status='active'`,
        [input.sourceId, input.subjectUserId],
      );
      await client.query(
        `INSERT INTO health_protocol_events
         (source_id, actor_user_id, old_status, new_status, reason_code)
         VALUES ($1,$2,'active','historical','subject_reviewed_source_past')`,
        [input.sourceId, input.actorUserId],
      );
    }
  });
}

/**
 * Explicit subject-owned hard restriction, separate from a condition name.
 * Existing allergies and other hard safety mechanisms remain independent.
 * Development review may expose this typed, subject-owned decision without
 * activating it for live food generation.
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