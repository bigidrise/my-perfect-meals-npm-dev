import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export function requireEntitlement(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const userEntitlements = user.entitlements || [];
      
      if (!userEntitlements.includes(feature)) {
        return res.status(403).json({ 
          error: "Insufficient permissions",
          required_feature: feature,
          user_plan: user.planLookupKey || "free",
        });
      }

      next();
    } catch (error) {
      console.error("[requireEntitlement] Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
