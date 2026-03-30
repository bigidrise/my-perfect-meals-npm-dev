/**
 * Shared clinical authorization utility
 *
 * Verifies that a requester is permitted to read or write clinical data
 * for a target user. Used by clinicalLabs.ts and procareRoutes.ts.
 *
 * A requester is authorized if:
 *   (a) They ARE the target user (self-access), OR
 *   (b) They own a studio that the target user is a member of
 *       (verified clinician-client relationship)
 */

import { db } from "../db";
import { studioMemberships, studios } from "../db/schema/studio";
import { eq } from "drizzle-orm";

export async function verifyClinicalAccess(
  requesterId: string,
  targetUserId: string
): Promise<boolean> {
  if (requesterId === targetUserId) return true;

  try {
    const membershipRows = await db
      .select({ studioId: studioMemberships.studioId })
      .from(studioMemberships)
      .where(eq(studioMemberships.clientUserId, targetUserId as any))
      .limit(1);

    if (membershipRows.length === 0) return false;

    const { studioId } = membershipRows[0];

    const studioRows = await db
      .select({ ownerUserId: studios.ownerUserId })
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1);

    if (studioRows.length === 0) return false;

    return studioRows[0].ownerUserId === requesterId;
  } catch {
    return false;
  }
}
