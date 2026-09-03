import { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./requireAuth";
import { getTierForLookupKey } from "@shared/planFeatures";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { businessMembers } from "../db/schema/business";

/**
 * requireProOrOrgAdmin — variant of requireProAccess that also passes when the
 * caller is an active Organization Admin in any business.
 *
 * Passes when ANY of the following are true:
 *   1. BILLING_ENFORCED=false (pre-launch bypass — same as requireProAccess)
 *   2. The user has PAID_FULL accessTier AND a premium/ultimate plan
 *   3. The user is an active `role = "admin"` member of any business org
 *      (org admins typically have no personal paid plan)
 *
 * Seat purchasing and billing are kept owner-only at the business-logic layer
 * via resolveAuthorizedBusiness("owner_only"), so admins reaching these routes
 * are still correctly blocked at the data layer.
 */

const BILLING_ENFORCED = process.env.BILLING_ENFORCED === "true";

export async function requireProOrOrgAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Pre-launch bypass
  if (!BILLING_ENFORCED) {
    next();
    return;
  }

  const { accessTier, planLookupKey, id: userId } = authReq.authUser;

  // Standard paid-user path
  if (accessTier === "PAID_FULL") {
    // No planLookupKey = internal/founder account
    if (!planLookupKey) {
      next();
      return;
    }
    const tier = getTierForLookupKey(planLookupKey);
    if (tier === "premium" || tier === "ultimate") {
      next();
      return;
    }
    // Paid but wrong tier — fall through to org-admin check before rejecting
  }

  // Org-admin path — active admin member of any business org
  try {
    const [adminRow] = await db
      .select({ id: businessMembers.id })
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.userId, userId),
          eq(businessMembers.role, "admin"),
          eq(businessMembers.status, "active"),
        ),
      )
      .limit(1);

    if (adminRow) {
      next();
      return;
    }
  } catch {
    // DB error — fall through to 403 rather than crashing the request
  }

  res.status(403).json({
    error: "This feature requires a Pro subscription or higher",
    code: "PRO_REQUIRED",
    requiredTier: "pro",
    accessTier,
  });
}
