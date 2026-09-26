import { db } from "../../db";
import { users } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import { currentGLP1AuthorityEnabled, resolveCurrentGLP1MealAuthority } from "./currentMealAuthority";
import { putClaim, shadowTransaction } from "../healthProtocols/persistence";

export async function readClinicalGLP1Active(clientUserId: string, medicalConditions: string[]): Promise<boolean> {
  if (!currentGLP1AuthorityEnabled()) return medicalConditions.includes("glp1");
  return (await resolveCurrentGLP1MealAuthority({ id: clientUserId })).includes("verifiedProvider");
}

export async function setClinicalGLP1Authority(input: {
  clientUserId: string;
  requesterId: string;
  enabled: boolean;
  existing: string[];
  updated: string[];
}): Promise<string[]> {
  const { clientUserId, requesterId, enabled, existing, updated } = input;
  if (!currentGLP1AuthorityEnabled()) {
    await db.update(users)
      .set({ medicalConditions: updated as any, updatedAt: new Date() } as any)
      .where(eq(users.id, clientUserId as any));
    return updated;
  }

  // Do not rewrite the ambiguous legacy array: it may contain historical
  // medication or earlier clinician data. The current claim is independent.
  await shadowTransaction(async (client) => {
    const { rows: memberships } = await client.query(
      `SELECT sm.id FROM studio_memberships sm JOIN studios st ON st.id=sm.studio_id
        WHERE sm.client_user_id=$1 AND sm.status='active' AND sm.is_archived=false
          AND st.owner_user_id=$2 AND st.type='clinic' AND st.status='active'
          AND st.verification_status='verified' ORDER BY sm.id LIMIT 1`,
      [clientUserId, requesterId],
    );
    if (!memberships[0]) throw new Error("Verified current clinic relationship required.");
    await putClaim(client, {
      subjectUserId: clientUserId, actorUserId: requesterId,
      protocol: "glp1", source: "provider",
      evidenceRef: `membership:${memberships[0].id}`,
      careRelationshipId: memberships[0].id,
      ownerUserId: requesterId,
      status: enabled ? "active" : "inactive",
      reasonCode: enabled ? "provider_assigned" : "provider_discontinued",
    });
  });
  return existing;
}