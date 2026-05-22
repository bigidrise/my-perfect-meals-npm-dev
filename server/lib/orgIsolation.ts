/**
 * Org Isolation Guard — Phase 1 Tenant Isolation
 *
 * Enforces that cross-user access (professional → client, clinician → patient)
 * never crosses an organization boundary. Every request that touches another
 * user's PHI must pass through one of these checks.
 *
 * Rules:
 *   - Users with no org (organizationId = null) belong to MPM_PUBLIC_ORG_ID.
 *   - A professional can only access a client if they share the same effective org.
 *   - Self-access (requestingUserId === targetUserId) always passes.
 */

import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { MPM_PUBLIC_ORG_ID } from "@shared/constants";

export class OrgIsolationError extends Error {
  readonly statusCode = 403;
  readonly code = "ORG_ISOLATION_VIOLATION";

  constructor(requestingUserId: string, targetUserId: string) {
    super(
      `Org isolation violation: user ${requestingUserId} attempted to access data for user ${targetUserId} across an organization boundary.`
    );
    this.name = "OrgIsolationError";
  }
}

/**
 * Returns the effective org ID for a user.
 * Users with no organizationId are treated as belonging to MPM_PUBLIC_ORG_ID.
 */
export async function getUserOrgId(userId: string): Promise<string> {
  try {
    const [row] = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, userId as any))
      .limit(1);

    return row?.organizationId ?? MPM_PUBLIC_ORG_ID;
  } catch {
    return MPM_PUBLIC_ORG_ID;
  }
}

/**
 * Asserts that two users share the same organization.
 * Throws OrgIsolationError (403) if they do not.
 * No-ops on self-access.
 */
export async function assertSameOrg(
  requestingUserId: string,
  targetUserId: string
): Promise<void> {
  if (requestingUserId === targetUserId) return;

  const [requestingOrg, targetOrg] = await Promise.all([
    getUserOrgId(requestingUserId),
    getUserOrgId(targetUserId),
  ]);

  if (requestingOrg !== targetOrg) {
    console.warn(
      "[OrgIsolation] VIOLATION: user=%s (org=%s) attempted to access user=%s (org=%s)",
      requestingUserId, requestingOrg, targetUserId, targetOrg
    );
    throw new OrgIsolationError(requestingUserId, targetUserId);
  }
}

/**
 * Checks (without throwing) whether two users share the same org.
 * Returns false on cross-org access.
 */
export async function isSameOrg(
  requestingUserId: string,
  targetUserId: string
): Promise<boolean> {
  if (requestingUserId === targetUserId) return true;

  const [a, b] = await Promise.all([
    getUserOrgId(requestingUserId),
    getUserOrgId(targetUserId),
  ]);

  return a === b;
}

/**
 * Express error handler helper — converts OrgIsolationError to a 403 response.
 * Use in catch blocks: if (handleOrgIsolationError(err, res)) return;
 */
export function handleOrgIsolationError(
  err: unknown,
  res: { status: (n: number) => { json: (body: object) => void } }
): boolean {
  if (err instanceof OrgIsolationError) {
    res.status(403).json({
      ok: false,
      error: err.code,
      message: "Access denied: cross-organization data access is not permitted.",
    });
    return true;
  }
  return false;
}
