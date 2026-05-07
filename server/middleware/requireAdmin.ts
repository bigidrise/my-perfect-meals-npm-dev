import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { AuthenticatedRequest } from "./requireAuth";

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.authUser) {
    res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    return;
  }

  try {
    const [user] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, authReq.authUser.id))
      .limit(1);

    if (!user || !user.isAdmin) {
      console.warn(`[requireAdmin] 403 forbidden — userId: ${authReq.authUser.id}, email: ${authReq.authUser.email}`);
      res.status(403).json({ error: "Forbidden", code: "ADMIN_REQUIRED" });
      return;
    }

    next();
  } catch (error) {
    console.error("[requireAdmin] DB error during admin check:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
