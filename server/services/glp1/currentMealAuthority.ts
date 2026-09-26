import { pool } from "../../db";
import { detectLegacyGLP1ActivationSources, type GLP1ActivationSource } from "./activationSources";

export type CurrentGLP1Source = GLP1ActivationSource | "verifiedProvider" | "verifiedMedication";

export function currentGLP1AuthorityEnabled(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.REPLIT_DEPLOYMENT;
}

/**
 * Only explicit current sources can authorize GLP-1 food rules in Development.
 * Legacy arrays remain as history-compatible data, not evidence of current use.
 * No owner clinical source crosses into a household member's food context.
 */
export async function resolveCurrentGLP1MealAuthority(
  subject: {
    id: string;
    selectedMealBuilder?: string | null;
    medicalConditions?: unknown;
    specialtyConditions?: unknown;
    activeHouseholdProfileId?: string | null;
  },
  householdSubject = false,
): Promise<CurrentGLP1Source[]> {
  if (!currentGLP1AuthorityEnabled()) {
    return detectLegacyGLP1ActivationSources(subject);
  }
  const sources: CurrentGLP1Source[] = [];
  if (householdSubject || subject.activeHouseholdProfileId) return sources;
  if (subject.selectedMealBuilder === "glp1") sources.push("selectedMealBuilder");

  // Fail explicitly if authority cannot be checked. Never silently serve food
  // without a potentially current clinical source during a DB outage.
  const { rows } = await pool.query(
    `SELECT DISTINCT s.source_kind
       FROM health_protocol_sources s
      WHERE s.subject_user_id=$1 AND s.protocol_key='glp1'
        AND s.status='active' AND s.ended_at IS NULL
        AND (
          (s.source_kind='medication' AND s.current_medication_use=true)
          OR
          (s.source_kind='provider' AND s.care_relationship_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM studio_memberships sm
             JOIN studios st ON st.id=sm.studio_id
             WHERE sm.id=s.care_relationship_id
               AND sm.client_user_id=s.subject_user_id
               AND sm.status='active' AND sm.is_archived=false
               AND st.owner_user_id=s.owner_user_id
               AND st.type='clinic' AND st.status='active'
               AND st.verification_status='verified'
           ))
        )`,
    [subject.id],
  );
  if (rows.some((row) => row.source_kind === "provider")) sources.push("verifiedProvider");
  if (rows.some((row) => row.source_kind === "medication")) sources.push("verifiedMedication");
  return sources;
}