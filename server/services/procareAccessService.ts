/**
 * procareAccessService.ts
 *
 * Server-side authorization helpers for ProCare physician-to-client access.
 * These are the same checks performed by requireWorkspaceAccess middleware,
 * extracted as a pure async function so they can be called inline from
 * route handlers that don't mount the full workspace middleware.
 *
 * Authorization model (mirrors requireWorkspaceAccess.ts):
 *   1. Org isolation — assertSameOrg ensures physician and client belong to
 *      the same organization. Cross-org access throws OrgIsolationError.
 *   2. Active direct clientLink (proUserId → clientUserId, active=true)
 *   3. Fallback: studio membership where the studio owner is the physician
 *
 * Security contract:
 *   - physicianId MUST come from req.authUser.id, never from req.body.
 *   - clientId from req.body is untrusted user input and must be validated
 *     against ALL checks above before being used for data access.
 *   - Callers must wrap calls in try/catch and handle OrgIsolationError via
 *     handleOrgIsolationError(err, res) to return a 403 response.
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { clientLinks } from "../db/schema/procare";
import { studioMemberships, studios } from "../db/schema/studio";
import { assertSameOrg } from "../lib/orgIsolation";

/**
 * Returns true when `physicianId` has an active ProCare relationship with
 * `clientId` — either a direct clientLink or a studio membership.
 *
 * Throws OrgIsolationError (→ HTTP 403) when physician and client belong to
 * different organizations. Callers must handle this via handleOrgIsolationError.
 *
 * @param physicianId  Authenticated physician's user ID (from req.authUser.id).
 * @param clientId     Proposed client user ID (from req.body — untrusted).
 */
export async function verifyPhysicianClientAccess(
  physicianId: string,
  clientId: string,
): Promise<boolean> {
  // 0. Org isolation — must be checked before any data access.
  //    Throws OrgIsolationError if the two users belong to different orgs.
  await assertSameOrg(physicianId, clientId);

  // 1. Direct clientLink — the primary ProCare relationship table.
  const links = await db
    .select({ id: clientLinks.id })
    .from(clientLinks)
    .where(
      and(
        eq(clientLinks.proUserId, physicianId),
        eq(clientLinks.clientUserId, clientId),
        eq(clientLinks.active, true),
      ),
    )
    .limit(1);

  if (links.length > 0) return true;

  // 2. Fallback: studio membership where the physician owns the studio.
  const memberships = await db
    .select({ id: studioMemberships.id })
    .from(studioMemberships)
    .innerJoin(studios, eq(studios.id, studioMemberships.studioId))
    .where(
      and(
        eq(studios.ownerUserId, physicianId),
        eq(studioMemberships.clientUserId, clientId),
        eq(studioMemberships.status, "active"),
        eq(studioMemberships.isArchived, false),
      ),
    )
    .limit(1);

  return memberships.length > 0;
}
