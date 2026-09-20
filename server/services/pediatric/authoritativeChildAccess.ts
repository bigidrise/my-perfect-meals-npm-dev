import { sql } from "drizzle-orm";
import { db } from "../../db";

export type AuthoritativeChildProfile = {
  id: string;
  user_id: string;
  name: string;
  age_stage: string;
  date_of_birth: string | null;
  sex: string | null;
  allergies: any[];
  allergy_details: any[];
  dietary_preferences: any[];
  medical_conditions: any[];
  feeding_concerns: any[];
  feeding_ability: any;
  sensory_issues: any[];
  dislikes: any[];
  cultural_preferences: string | null;
  birth_history: any;
  growth_context: any;
  height_cm: number | null;
  weight_kg: number | null;
  school_safe_required: boolean | null;
  medication_affects_appetite: boolean | null;
  is_archived: boolean;
};

export async function loadOwnedActiveChildProfile(
  actorUserId: string,
  childProfileId: string,
): Promise<AuthoritativeChildProfile | null> {
  const result = await db.execute(sql`
    SELECT id, user_id, name, age_stage, date_of_birth, sex,
           allergies, allergy_details, dietary_preferences, medical_conditions,
           feeding_concerns, feeding_ability, sensory_issues, dislikes,
           cultural_preferences, birth_history, growth_context,
           height_cm, weight_kg, school_safe_required,
           medication_affects_appetite, is_archived
    FROM child_profiles
    WHERE id = ${childProfileId}
      AND user_id = ${actorUserId}
      AND is_archived = false
    LIMIT 1
  `);
  const rows = (result as any).rows ?? (Array.isArray(result) ? result : []);
  return rows[0] ?? null;
}

export async function loadOwnedActiveChildProfiles(
  actorUserId: string,
  childProfileIds: string[],
): Promise<AuthoritativeChildProfile[] | null> {
  const uniqueIds = [...new Set(childProfileIds)];
  const profiles = await Promise.all(
    uniqueIds.map((id) => loadOwnedActiveChildProfile(actorUserId, id)),
  );
  if (profiles.some((profile) => profile === null)) return null;
  return profiles as AuthoritativeChildProfile[];
}