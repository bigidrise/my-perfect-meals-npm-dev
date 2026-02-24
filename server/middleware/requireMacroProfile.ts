import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "./requireAuth";

export async function requireMacroProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.authUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [user] = await db
    .select({
      age: users.age,
      height: users.height,
      weight: users.weight,
      activityLevel: users.activityLevel,
      fitnessGoal: users.fitnessGoal,
    })
    .from(users)
    .where(eq(users.id, authReq.authUser.id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const missing = [];
  if (!user.age) missing.push("age");
  if (!user.height) missing.push("height");
  if (!user.weight) missing.push("weight");
  if (!user.activityLevel) missing.push("activityLevel");
  if (!user.fitnessGoal) missing.push("fitnessGoal");

  if (missing.length > 0) {
    res.status(412).json({
      error: "Macro profile must be completed before using AI meal generation",
      code: "MACRO_PROFILE_REQUIRED",
      redirect: "/macro-counter",
      missingFields: missing,
    });
    return;
  }

  next();
}
