import type { PoolClient } from "pg";
import { pool } from "../../db";
import {
  HEALTH_PROTOCOLS,
  type FoodBuilderStrategy,
  type HealthProtocol,
  type HealthProtocolRecord,
  type HealthProtocolStatus,
  type HealthProtocolSource,
} from "../../../shared/healthProtocolState";
import { resolveHealthProtocolState } from "./resolveHealthProtocolState";

export function devOnly() {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Shadow health-protocol storage is DEV-only.");
  }
}

function knownProtocol(protocol: HealthProtocol) {
  if (!HEALTH_PROTOCOLS.includes(protocol)) throw new Error("Unsupported health protocol.");
}

export async function shadowTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  devOnly();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

type ClaimInput = {
  subjectUserId: string;
  actorUserId: string | null;
  protocol: HealthProtocol;
  source: HealthProtocolSource;
  evidenceRef: string;
  status: HealthProtocolStatus;
  ownerUserId?: string;
  careRelationshipId?: string;
  acceptedRecommendation?: boolean;
  currentMedicationUse?: boolean;
  reasonCode: string;
};

export async function putClaim(client: PoolClient, input: ClaimInput): Promise<string> {
  knownProtocol(input.protocol);
  if (!input.subjectUserId || !input.evidenceRef || !input.reasonCode) {
    throw new Error("Protocol claim requires subject, evidence identity, and reason.");
  }
  // Serialize writers for one identity, including its first insert. Unique indexes
  // separately protect against collisions and mistaken duplicate user claims.
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `${input.subjectUserId}:${input.protocol}:${input.source}:${input.evidenceRef}`,
  ]);
  const key = [input.subjectUserId, input.protocol, input.source, input.evidenceRef];
  const { rows: existing } = await client.query(
    `SELECT id, status, owner_user_id FROM health_protocol_sources
     WHERE subject_user_id=$1 AND protocol_key=$2 AND source_kind=$3 AND evidence_ref=$4
     FOR UPDATE`,
    key,
  );
  if (existing[0]?.owner_user_id && existing[0].owner_user_id !== input.ownerUserId) {
    throw new Error("A different owner controls this protocol source.");
  }
  const changed = !existing[0] || existing[0].status !== input.status;
  const values = [
    ...key, input.status, input.ownerUserId ?? null,
    input.careRelationshipId ?? null, input.acceptedRecommendation ?? null,
    input.currentMedicationUse ?? null,
  ];
  const { rows } = existing[0]
    ? await client.query(
      `UPDATE health_protocol_sources SET status=$5, owner_user_id=$6,
        care_relationship_id=$7, accepted_recommendation=$8,
        current_medication_use=$9, updated_at=now(),
        activated_at=CASE WHEN $5='active' AND status <> 'active' THEN now() ELSE activated_at END,
        ended_at=CASE WHEN $5 IN ('inactive','historical') AND status <> $5 THEN now()
                      WHEN $5='active' THEN NULL ELSE ended_at END,
        reviewed_at=CASE WHEN $5='pending_review' THEN NULL ELSE now() END
       WHERE id=$10 RETURNING id`,
      [...values, existing[0].id],
    )
    : await client.query(
      `INSERT INTO health_protocol_sources
        (subject_user_id, protocol_key, source_kind, evidence_ref, status,
         owner_user_id, care_relationship_id, accepted_recommendation,
         current_medication_use, activated_at, ended_at, reviewed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
         CASE WHEN $5='active' THEN now() END,
         CASE WHEN $5 IN ('inactive','historical') THEN now() END,
         CASE WHEN $5='pending_review' THEN NULL ELSE now() END)
       RETURNING id`,
      values,
    );
  const id: string = rows[0].id;
  if (changed) {
    await client.query(
      `INSERT INTO health_protocol_events
        (source_id, actor_user_id, old_status, new_status, reason_code)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, input.actorUserId, existing[0]?.status ?? null, input.status, input.reasonCode],
    );
  }
  return id;
}

/** No HTTP exposure: authenticated actor identity must be supplied by the caller. */
export async function setUserNutritionSupport(input: {
  actorUserId: string;
  subjectUserId: string;
  protocol: HealthProtocol;
  enabled: boolean;
}) {
  if (input.actorUserId !== input.subjectUserId) {
    throw new Error("Only the subject can change their personal nutrition support.");
  }
  await shadowTransaction((client) => putClaim(client, {
    ...input, actorUserId: input.actorUserId, source: "user",
    evidenceRef: "personal_support", status: input.enabled ? "active" : "inactive",
    reasonCode: input.enabled ? "user_enabled" : "user_discontinued",
  }));
  return readShadowProtocolState(input.subjectUserId, "standard");
}

/**
 * Requires an active verified clinic membership owned by the acting provider.
 * Future HTTP callers must ALSO enforce physician training and clinical access
 * middleware; this service is not exposed as a route in Phase 2.
 */
export async function setProviderProtocol(input: {
  actorUserId: string;
  subjectUserId: string;
  membershipId: string;
  protocol: HealthProtocol;
  enabled: boolean;
}) {
  await shadowTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT sm.id FROM studio_memberships sm JOIN studios s ON s.id=sm.studio_id
       WHERE sm.id=$1 AND sm.client_user_id=$2 AND sm.status='active'
         AND sm.is_archived=false AND s.owner_user_id=$3 AND s.type='clinic'
         AND s.status='active' AND s.verification_status='verified'`,
      [input.membershipId, input.subjectUserId, input.actorUserId],
    );
    if (!rows[0]) throw new Error("Active verified clinical relationship required.");
    await putClaim(client, {
      subjectUserId: input.subjectUserId, actorUserId: input.actorUserId,
      protocol: input.protocol, source: "provider",
      evidenceRef: `membership:${input.membershipId}`,
      careRelationshipId: input.membershipId, ownerUserId: input.actorUserId,
      status: input.enabled ? "active" : "inactive",
      reasonCode: input.enabled ? "provider_assigned" : "provider_discontinued",
    });
  });
  return readShadowProtocolState(input.subjectUserId, "standard");
}

/** Explicitly end only the claims tied to a revoked membership; retain events. */
export async function markEndedProviderRelationship(input: {
  subjectUserId: string;
  membershipId: string;
}) {
  await shadowTransaction(async (client) => {
    const { rows: memberships } = await client.query(
      `SELECT id FROM studio_memberships
       WHERE id=$1 AND client_user_id=$2 AND (status <> 'active' OR is_archived=true)`,
      [input.membershipId, input.subjectUserId],
    );
    if (!memberships[0]) throw new Error("Relationship has not ended.");
    const { rows } = await client.query(
      `UPDATE health_protocol_sources SET status='pending_review', reviewed_at=NULL, updated_at=now()
       WHERE care_relationship_id=$1 AND subject_user_id=$2
         AND source_kind='provider' AND status='active'
       RETURNING id`,
      [input.membershipId, input.subjectUserId],
    );
    for (const row of rows) {
      await client.query(
        `INSERT INTO health_protocol_events
         (source_id, actor_user_id, old_status, new_status, reason_code)
         VALUES ($1,NULL,'active','pending_review','provider_relationship_ended')`,
        [row.id],
      );
    }
  });
  return readShadowProtocolState(input.subjectUserId, "standard");
}

export const LAB_PROTOCOLS: Partial<Record<string, HealthProtocol>> = {
  "kidney-disease": "renal", renal: "renal",
  "heart-failure": "cardiac", cardiac: "cardiac",
  "inflammation-support": "anti_inflammatory",
  "thyroid-support": "thyroid",
  "hormone-optimization": "hormone_optimization",
  "liver-disease": "liver_disease", "liver-support": "liver_support",
  hashimotos: "hashimotos", hypothyroid: "hypothyroid", hyperthyroid: "hyperthyroid",
  menopause: "menopause", perimenopause: "perimenopause",
};

async function endActiveLabClaims(
  client: PoolClient,
  subjectUserId: string,
  protocol: HealthProtocol,
  actorUserId: string,
  reason: string,
) {
  const { rows } = await client.query(
    `UPDATE health_protocol_sources
     SET status='inactive', ended_at=now(), reviewed_at=now(), updated_at=now()
     WHERE subject_user_id=$1 AND protocol_key=$2
       AND source_kind='lab' AND status='active'
     RETURNING id`,
    [subjectUserId, protocol],
  );
  for (const row of rows) {
    await client.query(
      `INSERT INTO health_protocol_events
       (source_id, actor_user_id, old_status, new_status, reason_code)
       VALUES ($1,$2,'active','inactive',$3)`,
      [row.id, actorUserId, reason],
    );
  }
}

/** A lab row alone cannot create an active claim: require a recorded acceptance. */
export async function recordLabDecision(input: {
  subjectUserId: string;
  actorUserId: string;
  recommendationId: number;
}) {
  if (input.actorUserId !== input.subjectUserId) {
    throw new Error("Lab recommendation must be accepted by its subject.");
  }
  const protocol = await shadowTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT r.recommended_protocol, r.status FROM clinical_protocol_recommendations r
       JOIN clinical_labs l ON l.id=r.clinical_lab_id AND l.user_id=r.user_id
       WHERE r.id=$1 AND r.user_id=$2 AND r.status IN ('accepted','rejected')
       FOR UPDATE OF r`,
      [input.recommendationId, input.subjectUserId],
    );
    const row = rows[0];
    const mapped = row && LAB_PROTOCOLS[row.recommended_protocol];
    if (!mapped) throw new Error("Verified, supported lab decision required.");
    await putClaim(client, {
      subjectUserId: input.subjectUserId, actorUserId: input.actorUserId,
      protocol: mapped, source: "lab", evidenceRef: `recommendation:${input.recommendationId}`,
      acceptedRecommendation: row.status === "accepted",
      status: row.status === "accepted" ? "active" : "inactive",
      reasonCode: `lab_${row.status}`,
    });
    return mapped;
  });
  return { protocol, state: await readShadowProtocolState(input.subjectUserId, "standard") };
}

/** Explicit subject-owned discontinuation; old lab rows remain immutable. */
export async function discontinueLabProtocol(input: {
  subjectUserId: string;
  actorUserId: string;
  protocol: HealthProtocol;
}) {
  if (input.actorUserId !== input.subjectUserId) {
    throw new Error("Only the subject can discontinue their accepted lab protocol.");
  }
  knownProtocol(input.protocol);
  await shadowTransaction((client) =>
    endActiveLabClaims(client, input.subjectUserId, input.protocol, input.actorUserId, "lab_user_discontinued"));
  return readShadowProtocolState(input.subjectUserId, "standard");
}

/** No verified medication feed exists in this phase; store it for review only. */
export async function recordUnverifiedMedicationContext(input: {
  actorUserId: string;
  subjectUserId: string;
  protocol: HealthProtocol;
  evidenceRef: string;
}) {
  if (input.actorUserId !== input.subjectUserId) throw new Error("Medication subject mismatch.");
  await shadowTransaction((client) => putClaim(client, {
    ...input, source: "medication", status: "pending_review",
    currentMedicationUse: false, reasonCode: "medication_use_unverified",
  }));
  return readShadowProtocolState(input.subjectUserId, "standard");
}

/** A system suggestion never self-activates; an accepted choice becomes user-owned. */
export async function recordSystemRecommendation(input: {
  subjectUserId: string;
  protocol: HealthProtocol;
  evidenceRef: string;
}) {
  await shadowTransaction((client) => putClaim(client, {
    ...input, actorUserId: null, source: "system_recommendation",
    status: "pending_review", reasonCode: "system_suggested",
  }));
  return readShadowProtocolState(input.subjectUserId, "standard");
}

/** An explicit subject decision is required; accepted support is user-owned. */
export async function decideSystemRecommendation(input: {
  subjectUserId: string;
  actorUserId: string;
  recommendationId: string;
  accept: boolean;
}) {
  if (input.actorUserId !== input.subjectUserId) {
    throw new Error("Only the subject can decide on a system recommendation.");
  }
  await shadowTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, protocol_key, status FROM health_protocol_sources
       WHERE id=$1 AND subject_user_id=$2 AND source_kind='system_recommendation'
       FOR UPDATE`,
      [input.recommendationId, input.subjectUserId],
    );
    const suggestion = rows[0];
    if (!suggestion || suggestion.status !== "pending_review") {
      throw new Error("No undecided recommendation belongs to this subject.");
    }
    await client.query(
      `UPDATE health_protocol_sources
       SET status='inactive', ended_at=now(), reviewed_at=now(), updated_at=now()
       WHERE id=$1`,
      [suggestion.id],
    );
    await client.query(
      `INSERT INTO health_protocol_events
       (source_id, actor_user_id, old_status, new_status, reason_code)
       VALUES ($1,$2,'pending_review','inactive',$3)`,
      [suggestion.id, input.actorUserId,
        input.accept ? "system_suggestion_accepted" : "system_suggestion_declined"],
    );
    if (input.accept) {
      await putClaim(client, {
        subjectUserId: input.subjectUserId, actorUserId: input.actorUserId,
        protocol: suggestion.protocol_key, source: "user",
        evidenceRef: "personal_support", status: "active",
        reasonCode: "user_accepted_system_suggestion",
      });
    }
  });
  return readShadowProtocolState(input.subjectUserId, "standard");
}

export async function readShadowProtocolState(subjectUserId: string, builder: FoodBuilderStrategy) {
  devOnly();
  const { rows } = await pool.query(
    `SELECT id, protocol_key, source_kind, status, care_relationship_id,
            accepted_recommendation, current_medication_use
     FROM health_protocol_sources WHERE subject_user_id=$1 ORDER BY id`,
    [subjectUserId],
  );
  const records: HealthProtocolRecord[] = rows.map((row) => ({
    id: row.id, protocol: row.protocol_key, source: row.source_kind, status: row.status,
    relationshipId: row.care_relationship_id ?? undefined,
    acceptedRecommendation: row.accepted_recommendation ?? undefined,
    currentMedicationUse: row.current_medication_use ?? undefined,
  }));
  const membershipIds = [...new Set(records.map((row) => row.relationshipId).filter(Boolean))];
  const relationshipStatus: Record<string, "active" | "ended"> = {};
  if (membershipIds.length) {
    const { rows: memberships } = await pool.query(
      `SELECT id, status, is_archived FROM studio_memberships
       WHERE client_user_id=$1 AND id=ANY($2::uuid[])`,
      [subjectUserId, membershipIds],
    );
    for (const membership of memberships) {
      relationshipStatus[membership.id] = membership.status === "active" && !membership.is_archived
        ? "active" : "ended";
    }
  }
  return resolveHealthProtocolState({ records, relationshipStatus, builder });
}