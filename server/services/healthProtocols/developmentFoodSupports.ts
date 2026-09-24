import { pool } from "../../db";

export type PersonalFoodSupport = "glp1" | "anti_inflammatory";

/** Phase 2B activation only: a current, subject-owned choice, never an inferred
 * medication, legacy preference, lab result, or provider claim. Production
 * remains on the established clinical path until the all-surface cutover. */
export async function readDevelopmentPersonalFoodSupports(subjectUserId: string): Promise<Set<PersonalFoodSupport>> {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
    return new Set();
  }
  const { rows } = await pool.query(
    `SELECT DISTINCT protocol_key FROM health_protocol_sources
     WHERE subject_user_id=$1 AND source_kind='user' AND status='active'
       AND evidence_ref='personal_support'
       AND protocol_key IN ('glp1', 'anti_inflammatory')`,
    [subjectUserId],
  );
  return new Set(rows.map((row) => row.protocol_key as PersonalFoodSupport));
}