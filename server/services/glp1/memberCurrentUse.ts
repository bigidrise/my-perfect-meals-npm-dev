import { pool } from "../../db";
import { devOnly, putClaim, shadowTransaction } from "../healthProtocols/persistence";
import { resolveCurrentGLP1MealAuthority } from "./currentMealAuthority";
import { MEMBER_GLP1_EVIDENCE, type GLP1CurrentUseStatus } from "../../../shared/glp1CurrentUse";
export { MEMBER_GLP1_EVIDENCE } from "../../../shared/glp1CurrentUse";

export async function readMemberGLP1CurrentUse(subjectUserId: string): Promise<GLP1CurrentUseStatus> {
  devOnly();
  const { rows } = await pool.query(
    `SELECT selected_meal_builder FROM users WHERE id=$1`, [subjectUserId],
  );
  if (!rows[0]) throw new Error("Member unavailable.");
  const sources = await resolveCurrentGLP1MealAuthority({
    id: subjectUserId, selectedMealBuilder: rows[0].selected_meal_builder,
  });
  const { rows: medication } = await pool.query(
    `SELECT evidence_ref, owner_user_id FROM health_protocol_sources
      WHERE subject_user_id=$1 AND protocol_key='glp1' AND source_kind='medication'
        AND status='active' AND ended_at IS NULL AND current_medication_use=true`,
    [subjectUserId],
  );
  return {
    memberReportedCurrentUse: medication.some((row) =>
      row.evidence_ref === MEMBER_GLP1_EVIDENCE && row.owner_user_id === subjectUserId),
    physicianManaged: sources.includes("verifiedProvider"),
    otherMedicationActive: medication.some((row) =>
      row.evidence_ref !== MEMBER_GLP1_EVIDENCE || row.owner_user_id !== subjectUserId),
    builderActive: sources.includes("selectedMealBuilder"),
    effectiveActive: sources.length > 0,
  };
}

/** Only this member-owned medication claim is writable here. Provider claims
 * and physician-controlled settings are never updated by this operation. */
export async function setMemberGLP1CurrentUse(input: {
  actorUserId: string; subjectUserId: string; currentUse: boolean;
}): Promise<void> {
  devOnly();
  if (input.actorUserId !== input.subjectUserId) throw new Error("Medication subject mismatch.");
  await shadowTransaction((client) => putClaim(client, {
    subjectUserId: input.subjectUserId,
    actorUserId: input.actorUserId,
    ownerUserId: input.subjectUserId,
    protocol: "glp1",
    source: "medication",
    evidenceRef: MEMBER_GLP1_EVIDENCE,
    status: input.currentUse ? "active" : "historical",
    currentMedicationUse: input.currentUse,
    reasonCode: input.currentUse ? "member_reported_current_use" : "member_reported_use_ended",
  }));
}
