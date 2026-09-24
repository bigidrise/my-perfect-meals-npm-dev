/** Read-only DEV shadow comparison. Prints categories/counts, never identities. */
import { Pool } from "pg";
import { getDatabaseTlsConfig } from "../server/lib/databaseTls";
import { detectLegacyGLP1ActivationSources } from "../server/services/glp1/activationSources";
import { resolveHealthProtocolState } from "../server/services/healthProtocols/resolveHealthProtocolState";
import type { FoodBuilderStrategy, HealthProtocolRecord } from "../shared/healthProtocolState";

async function main() {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Shadow comparison is DEV-only.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Development database is unavailable.");
  const pool = new Pool({
    connectionString: url, ssl: getDatabaseTlsConfig(url), max: 1,
    connectionTimeoutMillis: 5000,
  });
  try {
    const [users, sources, membership, acceptedLabs] = await Promise.all([
      pool.query(`SELECT id, selected_meal_builder,
                         medical_conditions, specialty_conditions
                  FROM users`),
      pool.query(`SELECT subject_user_id, id, protocol_key, source_kind, status,
                         care_relationship_id, accepted_recommendation, current_medication_use
                  FROM health_protocol_sources`),
      pool.query(`SELECT id, client_user_id, status, is_archived
                  FROM studio_memberships`),
      pool.query(`SELECT r.user_id, r.recommended_protocol FROM clinical_protocol_recommendations r
                  JOIN clinical_labs l ON l.id=r.clinical_lab_id AND l.user_id=r.user_id
                  WHERE r.status='accepted'`),
    ]);
    const sourcesByUser = new Map<string, HealthProtocolRecord[]>();
    for (const source of sources.rows) {
      const records = sourcesByUser.get(source.subject_user_id) ?? [];
      records.push({
        id: source.id, protocol: source.protocol_key, source: source.source_kind,
        status: source.status, relationshipId: source.care_relationship_id ?? undefined,
        acceptedRecommendation: source.accepted_recommendation ?? undefined,
        currentMedicationUse: source.current_medication_use ?? undefined,
      });
      sourcesByUser.set(source.subject_user_id, records);
    }
    const relationships: Record<string, "active" | "ended"> = {};
    const endedMembershipByUser = new Set<string>();
    for (const row of membership.rows) {
      const active = row.status === "active" && !row.is_archived;
      relationships[row.id] = active ? "active" : "ended";
      if (!active) endedMembershipByUser.add(row.client_user_id);
    }
    const categories: Record<string, number> = {
      legacy_glp1_active_new_review_pending: 0,
      legacy_glp1_builder_only_not_new_health_context: 0,
      legacy_glp1_medical_with_ended_membership_owner_unproven: 0,
      legacy_anti_inflammatory_builder_only: 0,
      legacy_anti_inflammatory_condition_new_review_pending: 0,
      legacy_renal_condition_new_review_pending: 0,
      legacy_cardiac_condition_new_review_pending: 0,
      new_active_source_independent_of_builder: 0,
    };
    const reviewReasons: Record<string, number> = {};
    for (const row of users.rows) {
      const oldSources = detectLegacyGLP1ActivationSources({
        selectedMealBuilder: row.selected_meal_builder,
        medicalConditions: row.medical_conditions,
        specialtyConditions: row.specialty_conditions,
      });
      const builder: FoodBuilderStrategy = row.selected_meal_builder === "glp1" ||
        row.selected_meal_builder === "anti_inflammatory" ||
        row.selected_meal_builder === "diabetic" ||
        row.selected_meal_builder === "performance_competition"
        ? row.selected_meal_builder : "standard";
      const newState = resolveHealthProtocolState({
        builder, records: sourcesByUser.get(row.id) ?? [], relationshipStatus: relationships,
      });
      for (const item of newState.needsReview) {
        reviewReasons[item.reason] = (reviewReasons[item.reason] ?? 0) + 1;
      }
      const review = (protocol: string) => newState.needsReview.some((v) => v.protocol === protocol);
      if (oldSources.length && review("glp1")) categories.legacy_glp1_active_new_review_pending++;
      if (oldSources.length === 1 && oldSources[0] === "selectedMealBuilder" &&
          !newState.activeHealthContext.includes("glp1")) {
        categories.legacy_glp1_builder_only_not_new_health_context++;
      }
      if (oldSources.includes("medicalConditions") && endedMembershipByUser.has(row.id)) {
        categories.legacy_glp1_medical_with_ended_membership_owner_unproven++;
      }
      if (builder === "anti_inflammatory" && !review("anti_inflammatory")) {
        categories.legacy_anti_inflammatory_builder_only++;
      }
      for (const protocol of ["anti_inflammatory", "renal", "cardiac"] as const) {
        if (review(protocol)) categories[`legacy_${protocol}_condition_new_review_pending`]++;
      }
      if (newState.activeHealthContext.some((protocol) => protocol !== newState.builderStrategy)) {
        categories.new_active_source_independent_of_builder++;
      }
    }
    console.log("DEV shadow comparison (people per category; categories may overlap):", categories);
    console.log("Shadow review reasons (source claims, not people):", reviewReasons);
    const labCounts: Record<string, number> = {};
    for (const row of acceptedLabs.rows) {
      labCounts[row.recommended_protocol] = (labCounts[row.recommended_protocol] ?? 0) + 1;
    }
    console.log("Accepted lab decisions with matching lab rows, by protocol (not yet backfilled):", labCounts);
    console.log("Comparison basis: exact legacy GLP-1 activation predicate shared with live resolver; "
      + "other categories compare legacy stored fields/accepted lab decisions to shadow state, "
      + "not a full food-generation or protocol-envelope resolution.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("DEV shadow comparison failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});