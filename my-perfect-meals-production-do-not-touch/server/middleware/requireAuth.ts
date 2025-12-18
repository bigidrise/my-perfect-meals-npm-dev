import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  plan: string;
  entitlements: string[];
  planLookupKey: string | null;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  selectedMealBuilder: string | null;
  isTester: boolean;
}

export interface AuthenticatedRequest extends Request {
  authUser: AuthenticatedUser;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.headers["x-auth-token"] as string;

  if (!token) {
    res.status(401).json({ error: "Missing auth token" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.authToken, token))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid auth token" });
      return;
    }

    (req as AuthenticatedRequest).authUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      plan: user.plan,
      entitlements: user.entitlements || [],
      planLookupKey: user.planLookupKey || null,
      trialStartedAt: user.trialStartedAt || null,
      trialEndsAt: user.trialEndsAt || null,
      selectedMealBuilder: user.selectedMealBuilder || null,
      isTester: user.isTester || false,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

export function generateAuthToken(): string {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}
