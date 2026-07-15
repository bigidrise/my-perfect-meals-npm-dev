/**
 * requireActiveBusinessMembership
 *
 * Middleware that gates routes to users who are currently active members of
 * an active business. Used on any route that is ONLY accessible via a business
 * sponsorship (not a general paid subscription).
 *
 * Must be placed after requireAuth so that req.authUser is already set.
 */

import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { businessMembers, businesses } from "../db/schema/business";
import { eq, and } from "drizzle-orm";
import type { AuthenticatedRequest } from "./requireAuth";

export async function requireActiveBusinessMembership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as AuthenticatedRequest).authUser?.id;

  if (!userId) {
    res
      .status(401)
      .json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    return;
  }

  try {
    const [row] = await db
      .select({ id: businessMembers.id })
      .from(businessMembers)
      .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
      .where(
        and(
          eq(businessMembers.userId, userId),
          eq(businessMembers.status, "active"),
          eq(businesses.status, "active")
        )
      )
      .limit(1);

    if (!row) {
      res.status(403).json({
        error: "Active business membership required.",
        code: "NO_ACTIVE_BUSINESS_MEMBERSHIP",
      });
      return;
    }

    next();
  } catch (err) {
    console.error("[requireActiveBusinessMembership] error:", err);
    res.status(500).json({ error: "Server error." });
  }
}
