/**
 * Shared clinical authorization utility
 *
 * Verifies that a requester is permitted to read or write clinical data
 * for a target user. Used by clinicalLabs.ts and procareRoutes.ts.
 *
 * A requester is authorized if ALL of the following hold:
 *   (a) They ARE the target user (self-access), OR
 *   (b) They own a studio that the target user is a member of
 *       (verified clinician-client relationship)
 *   AND
 *   (c) Both users share the same organization (org isolation boundary)
 */

import { db } from "../db";
import { studioMemberships, studios } from "../db/schema/studio";
import { eq, and } from "drizzle-orm";
import { isSameOrg } from "../lib/orgIsolation";

export async function verifyClinicalAccess(
  requesterId: string,
  targetUserId: string
): Promise<boolean> {
  if (requesterId === targetUserId) return true;

  try {
    // Org isolation check — must share the same organization
    const sameOrg = await isSameOrg(requesterId, targetUserId);
    if (!sameOrg) {
      console.warn(
        "[verifyClinicalAccess] DENIED (cross-org): requester=%s targetUser=%s",
        requesterId, targetUserId
      );
      return false;
    }

    // Relationship check — requester must own a studio the target actively belongs to.
    // Revoked or archived memberships must never satisfy this check.
    const membershipRows = await db
      .select({ studioId: studioMemberships.studioId })
      .from(studioMemberships)
      .where(
        and(
          eq(studioMemberships.clientUserId, targetUserId as any),
          eq(studioMemberships.status, "active"),
          eq(studioMemberships.isArchived, false)
        )
      )
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
