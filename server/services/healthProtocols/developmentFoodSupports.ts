import { pool } from "../../db";
import {
  PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED,
  ANTI_INFLAMMATORY_SUPPORT_ENABLED,
  ANTI_INFLAMMATORY_SUPPORT_OPT_IN,
} from "../../../shared/personalFoodSupportFreeze";

export type PersonalFoodSupport = "glp1" | "anti_inflammatory";

/** Current subject-owned choices only, never inferred clinical authority.
 * The legacy function name is retained for existing consumers. Anti-Inflammatory
 * is released independently; all other optional overlays retain their freeze. */
export async function readDevelopmentPersonalFoodSupports(subjectUserId: string): Promise<Set<PersonalFoodSupport>> {
  const otherSupportsEnabled = PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED &&
    process.env.NODE_ENV === "development" && !process.env.REPLIT_DEPLOYMENT;
  if (!ANTI_INFLAMMATORY_SUPPORT_ENABLED && !otherSupportsEnabled) {
    return new Set();
  }
  const { rows } = await pool.query(
    `SELECT DISTINCT s.protocol_key, s.evidence_ref,
       EXISTS (SELECT 1 FROM health_protocol_events e
         WHERE e.source_id=s.id AND e.reason_code=$2) AS explicit_opt_in
     FROM health_protocol_sources s
     WHERE s.subject_user_id=$1 AND s.source_kind='user' AND s.status='active'
       AND s.evidence_ref='personal_support'
       AND ((s.protocol_key='anti_inflammatory' AND EXISTS (
           SELECT 1 FROM health_protocol_events e WHERE e.source_id=s.id AND e.reason_code=$2))
         OR ($3::boolean AND s.protocol_key='glp1'))`,
    [subjectUserId, ANTI_INFLAMMATORY_SUPPORT_OPT_IN, otherSupportsEnabled],
  );
  return new Set(rows.filter(row =>
    (ANTI_INFLAMMATORY_SUPPORT_ENABLED && row.protocol_key === "anti_inflammatory" && row.evidence_ref === "personal_support" && row.explicit_opt_in === true) ||
    (otherSupportsEnabled && row.protocol_key === "glp1" && row.evidence_ref === "personal_support")
  ).map((row) => row.protocol_key as PersonalFoodSupport));
}

/** No mutations, backfill, or migration on read. Used by the independent profile control. */
export async function readAntiInflammatorySupportPreference(subjectUserId: string) {
  if (!ANTI_INFLAMMATORY_SUPPORT_ENABLED) {
    throw new Error("Anti-Inflammatory support is unavailable.");
  }
  const { rows } = await pool.query(
    `SELECT u.app_preferences->>'antiInflammatorySupport' AS legacy_preference
     FROM users u WHERE u.id=$1`,
    [subjectUserId],
  );
  if (!rows[0]) throw new Error("Profile unavailable.");
  // The indicator and profile control use the exact resolver consumed by meal
  // generation, not an independent clinical/profile interpretation.
  const supports = await readDevelopmentPersonalFoodSupports(subjectUserId);
  return { enabled: supports.has("anti_inflammatory"), legacyPreferenceSaved: rows[0].legacy_preference === "true" };
}