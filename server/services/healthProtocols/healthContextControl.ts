import { pool } from "../../db";
import { HEALTH_PROTOCOLS, type HealthProtocol } from "../../../shared/healthProtocolState";
import type { HealthContextView, HealthSupportSource, HealthSupportSummary } from "../../../shared/healthContextControl";
import { LAB_PROTOCOLS, devOnly, putClaim, readShadowProtocolState, shadowTransaction } from "./persistence";
import type { ResolvedHealthProtocolState } from "./resolveHealthProtocolState";

const KINDS: Record<string, HealthSupportSource["kind"]> = {
  user: "you", provider: "care_team", lab: "lab_recommendation",
  medication: "medication_information", legacy_migrated: "earlier_profile",
  system_recommendation: "suggestion",
};

type SourceRow = {
  id: string; protocol_key: HealthProtocol; source_kind: string; status: string;
};

/** Pure view: no evidence refs, lab values, or owner identifiers reach the browser. */
export function presentHealthContext(
  rows: readonly SourceRow[],
  resolved: ResolvedHealthProtocolState,
  builder: string | null,
): HealthContextView {
  const reviewById = new Map(resolved.needsReview.map((item) => [item.sourceRecordId, item.reason]));
  const supports = HEALTH_PROTOCOLS.map((protocol): HealthSupportSummary => {
    const sources: HealthSupportSource[] = rows.filter((row) => row.protocol_key === protocol).map((row) => {
      const review = reviewById.get(row.id);
      const status: HealthSupportSource["status"] = review ? "needs_confirmation"
        : row.status === "active" ? "active"
        : row.status === "historical" ? "previous" : "off";
      const note = review === "provider_relationship_ended"
        ? "This care relationship ended. Your care team can help review its guidance."
        : review === "provider_relationship_unverified"
          ? "This care relationship needs review."
          : review === "medication_use_unverified"
            ? "Medication information is unconfirmed; this does not say you currently take it."
            : undefined;
      return { id: row.id, kind: KINDS[row.source_kind], status, ...(note ? { note } : {}) };
    });
    return {
      protocol,
      status: sources.some((source) => source.status === "active") ? "active"
        : sources.some((source) => source.status === "needs_confirmation") ? "needs_confirmation"
        : sources.some((source) => source.status === "previous") ? "previous" : "off",
      personalEnabled: sources.some((source) => source.kind === "you" && source.status === "active"),
      sources,
    };
  });
  return {
    shadowOnly: true, builder, supports,
    legacyAntiPreferenceNeedsReview: false, labReviews: [], history: [],
  };
}

export async function readHealthContextView(subjectUserId: string): Promise<HealthContextView> {
  devOnly();
  const { rows: profile } = await pool.query(
    `SELECT selected_meal_builder,
       app_preferences->>'antiInflammatorySupport' AS current_anti
     FROM users WHERE id=$1`, [subjectUserId],
  );
  if (!profile[0]) throw new Error("Profile unavailable.");
  const builder = profile[0].selected_meal_builder as string | null;
  const mappedBuilder = builder === "glp1" || builder === "anti_inflammatory" ||
    builder === "diabetic" || builder === "performance_competition"
    ? builder : "standard";
  const state = await readShadowProtocolState(subjectUserId, mappedBuilder);
  const { rows } = await pool.query(
    `SELECT id, protocol_key, source_kind, status, evidence_ref
     FROM health_protocol_sources WHERE subject_user_id=$1 ORDER BY created_at, id`,
    [subjectUserId],
  );
  const { rows: labRows } = await pool.query(
    `SELECT r.id, r.recommended_protocol, r.status FROM clinical_protocol_recommendations r
     JOIN clinical_labs l ON l.id=r.clinical_lab_id AND l.user_id=r.user_id
     WHERE r.user_id=$1 AND r.status IN ('accepted','rejected')
       AND NOT EXISTS (
         SELECT 1 FROM health_protocol_sources s
         WHERE s.subject_user_id=r.user_id AND s.source_kind='lab'
           AND s.evidence_ref='recommendation:' || r.id::text
       ) ORDER BY r.id`,
    [subjectUserId],
  );
  const labReviews: HealthContextView["labReviews"] = labRows.flatMap((row) => {
    const protocol = LAB_PROTOCOLS[row.recommended_protocol];
    return protocol ? [{
      id: row.id as number, protocol, earlierDecision: row.status as "accepted" | "rejected",
    }] : [];
  });
  const { rows: events } = await pool.query(
    `SELECT e.new_status, e.reason_code, e.created_at, s.protocol_key, s.source_kind
     FROM health_protocol_events e
     JOIN health_protocol_sources s ON s.id=e.source_id
     WHERE s.subject_user_id=$1
     ORDER BY e.created_at DESC, e.id DESC LIMIT 50`,
    [subjectUserId],
  );
  const history = events.map((event): HealthContextView["history"][number] => ({
    protocol: event.protocol_key,
    source: KINDS[event.source_kind],
    activity: ({
      user_enabled: "You turned personal support on",
      user_discontinued: "You turned personal support off",
      user_confirmed_legacy_support: "You confirmed current support",
      legacy_confirmed_support: "Earlier profile information was reviewed",
      legacy_discontinued_support: "Earlier profile information was marked as past",
      user_reported_medication_past: "Medication information was marked as past",
      provider_assigned: "Care team added guidance",
      provider_discontinued: "Care team ended guidance",
      provider_relationship_ended: "Care relationship ended; guidance needs review",
      lab_accepted: "An accepted lab recommendation was reviewed",
      lab_rejected: "A declined lab recommendation was recorded",
      lab_user_discontinued: "Lab-based support was stopped",
      system_suggestion_accepted: "Suggested support was accepted",
      system_suggestion_declined: "Suggested support was declined",
    } as Record<string, string>)[event.reason_code] || "Support information was updated",
    occurredAt: new Date(event.created_at).toISOString(),
  }));
  const legacyAntiPreferenceNeedsReview = profile[0].current_anti === "true" &&
    !rows.some((row) => row.source_kind === "legacy_migrated" &&
      row.protocol_key === "anti_inflammatory" &&
      row.evidence_ref === "legacy:app_preferences_anti_inflammatory");
  return {
    ...presentHealthContext(rows, state, builder),
    legacyAntiPreferenceNeedsReview, labReviews, history,
  };
}

/** Materialize a review-pending legacy preference only after a subject acts. */
export async function decideEarlierAntiPreference(input: {
  actorUserId: string; subjectUserId: string; current: boolean;
}): Promise<HealthContextView> {
  if (input.actorUserId !== input.subjectUserId) throw new Error("Subject ownership required.");
  const sourceId = await shadowTransaction(async (client) => {
    const { rows: profile } = await client.query(
      `SELECT app_preferences->>'antiInflammatorySupport' AS current_anti
       FROM users WHERE id=$1`, [input.subjectUserId],
    );
    if (profile[0]?.current_anti !== "true") throw new Error("No current preference to review.");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${input.subjectUserId}:anti_inflammatory:legacy_migrated:legacy:app_preferences_anti_inflammatory`,
    ]);
    const { rows: existing } = await client.query(
      `SELECT id FROM health_protocol_sources
       WHERE subject_user_id=$1 AND protocol_key='anti_inflammatory'
         AND source_kind='legacy_migrated'
         AND evidence_ref='legacy:app_preferences_anti_inflammatory'
       FOR UPDATE`,
      [input.subjectUserId],
    );
    if (existing[0]) return existing[0].id as string;
    return putClaim(client, {
      actorUserId: input.actorUserId, subjectUserId: input.subjectUserId,
      protocol: "anti_inflammatory", source: "legacy_migrated",
      evidenceRef: "legacy:app_preferences_anti_inflammatory",
      status: "pending_review", reasonCode: "legacy_preference_needs_review",
    });
  });
  return decideLegacySupport({ ...input, sourceId });
}

/** Existing Yes/No entry point delegates to a single-origin audited review. */
export async function decideLegacySupport(input: {
  actorUserId: string;
  subjectUserId: string;
  sourceId: string;
  current: boolean;
}): Promise<HealthContextView> {
  return reconcileLegacyClaim({
    actorUserId: input.actorUserId, subjectUserId: input.subjectUserId,
    sourceId: input.sourceId,
    decision: input.current ? "current_guidance" : "history_only",
  });
}

/** Resolve exactly one legacy origin; the original source and audit survive. */
export async function reconcileLegacyClaim(input: {
  actorUserId: string;
  subjectUserId: string;
  sourceId: string;
  decision: "history_only" | "current_guidance" | "current_hard_restriction" | "unresolved";
  rule?: import("../../../shared/clinicalMealAuthority").ExactFoodDirective;
}): Promise<HealthContextView> {
  if (input.actorUserId !== input.subjectUserId) throw new Error("Subject ownership required.");
  const rule = input.decision === "current_hard_restriction"
    ? (await import("../../../shared/clinicalMealAuthority")).exactFoodDirectiveSchema.parse(input.rule)
    : undefined;
  if (input.decision !== "current_hard_restriction" && input.rule !== undefined) {
    throw new Error("A history or guidance review cannot impose a food rule.");
  }
  await shadowTransaction(async (client) => {
    const { rows: identified } = await client.query(
      `SELECT protocol_key, status FROM health_protocol_sources
       WHERE id=$1 AND subject_user_id=$2 AND source_kind='legacy_migrated'
       FOR UPDATE`,
      [input.sourceId, input.subjectUserId],
    );
    if (!identified[0]) throw new Error("This earlier profile entry is unavailable.");
    const protocol: HealthProtocol = identified[0].protocol_key;
    if (identified[0].status !== "pending_review") return;
    const { rows: decisions } = await client.query<{ id: string }>(
      `INSERT INTO health_protocol_review_decisions
       (subject_user_id, source_id, disposition, actor_user_id, reason_code)
       VALUES ($1,$2,$3,$4,'legacy_explicit_review') RETURNING id`,
      [input.subjectUserId, input.sourceId,
        input.decision === "unresolved" ? "unresolved" : "history_only", input.actorUserId],
    );
    const reviewDecisionId = decisions[0]?.id;
    if (!reviewDecisionId) throw new Error("The original claim review was not recorded.");
    if (input.decision === "unresolved") return;
    await client.query(
      `UPDATE health_protocol_sources
       SET status='historical', ended_at=now(), reviewed_at=now(), updated_at=now()
       WHERE id=$1`, [input.sourceId],
    );
    await client.query(
      `INSERT INTO health_protocol_events
       (source_id, actor_user_id, old_status, new_status, reason_code)
       VALUES ($1,$2,'pending_review','historical',$3)`,
      [input.sourceId, input.actorUserId,
        input.decision === "history_only" ? "legacy_discontinued_support" : "legacy_confirmed_support"],
    );
    if (input.decision === "history_only") return;
    // There is exactly one personal source per subject/protocol in the
    // existing schema. Reuse it, and link every reviewed origin explicitly.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${input.subjectUserId}:${protocol}:user:personal_support`,
    ]);
    const { rows: existingUserSources } = await client.query<{ evidence_ref: string }>(
      `SELECT evidence_ref FROM health_protocol_sources
       WHERE subject_user_id=$1 AND protocol_key=$2 AND source_kind='user'
       FOR UPDATE`,
      [input.subjectUserId, protocol],
    );
    const currentSourceId = await putClaim(client, {
      subjectUserId: input.subjectUserId, actorUserId: input.actorUserId,
      protocol, source: "user", evidenceRef: existingUserSources[0]?.evidence_ref ?? "personal_support",
      status: "active", reasonCode: "user_confirmed_legacy_support",
    });
    let directiveId: string | null = null;
    if (rule) {
      const { rows: directives } = await client.query<{ id: string }>(
        `INSERT INTO health_protocol_food_directives
         (subject_user_id, source_id, protocol_key, rule, effective_at)
         VALUES ($1,$2,$3,$4::jsonb,now()) RETURNING id`,
        [input.subjectUserId, currentSourceId, protocol, JSON.stringify(rule)],
      );
      if (!directives[0]) throw new Error("Exact restriction was not saved.");
      directiveId = directives[0].id;
      await client.query(
        `INSERT INTO health_protocol_review_decisions
         (subject_user_id, source_id, directive_id, disposition, actor_user_id, reason_code)
         VALUES ($1,$2,$3,'current_hard_restriction',$4,'legacy_explicit_exact_rule')`,
        [input.subjectUserId, currentSourceId, directives[0].id, input.actorUserId],
      );
    } else {
      await client.query(
        `INSERT INTO health_protocol_review_decisions
         (subject_user_id, source_id, disposition, actor_user_id, reason_code)
         VALUES ($1,$2,'current_guidance',$3,'legacy_explicit_guidance')`,
        [input.subjectUserId, currentSourceId, input.actorUserId],
      );
    }
    await client.query(
      `INSERT INTO health_protocol_review_links
       (origin_source_id, subject_user_id, review_decision_id,
        result_source_id, directive_id, actor_user_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [input.sourceId, input.subjectUserId, reviewDecisionId,
        currentSourceId, directiveId, input.actorUserId],
    );
  });
  return readHealthContextView(input.subjectUserId);
}

/** A subject can mark medication information outdated; they cannot certify use. */
export async function markMedicationInformationPast(input: {
  actorUserId: string;
  subjectUserId: string;
  sourceId: string;
}): Promise<HealthContextView> {
  if (input.actorUserId !== input.subjectUserId) throw new Error("Subject ownership required.");
  await shadowTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, status FROM health_protocol_sources
       WHERE id=$1 AND subject_user_id=$2 AND protocol_key='glp1'
         AND source_kind='medication' FOR UPDATE`,
      [input.sourceId, input.subjectUserId],
    );
    const record = rows[0];
    if (!record) throw new Error("Medication information unavailable.");
    if (record.status === "historical" || record.status === "inactive") return;
    await client.query(
      `UPDATE health_protocol_sources
       SET status='historical', ended_at=now(), reviewed_at=now(), updated_at=now()
       WHERE id=$1`,
      [record.id],
    );
    await client.query(
      `INSERT INTO health_protocol_events
       (source_id, actor_user_id, old_status, new_status, reason_code)
       VALUES ($1,$2,$3,'historical','user_reported_medication_past')`,
      [record.id, input.actorUserId, record.status],
    );
  });
  return readHealthContextView(input.subjectUserId);
}