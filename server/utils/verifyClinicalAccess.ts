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
import { resolveProfessionalGlucoseAccess } from "../services/professionalGlucoseAccess";

export async function verifyClinicalAccess(
  requesterId: string,
  targetUserId: string
): Promise<boolean> {
  if (requesterId === targetUserId) return true;

  // Detailed medical records require the established verified clinical identity,
  // exact active relationship, organization and current consent policy. Protocol
  // indicator visibility has its own, less privileged endpoint.
  return (await resolveProfessionalGlucoseAccess(requesterId, targetUserId)).allowed;
}
