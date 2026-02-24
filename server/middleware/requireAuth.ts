import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { resolveAccessTier, getTrialDaysRemaining, type AccessTier } from "../lib/accessTier";

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
  accessTier: AccessTier;
  trialDaysRemaining: number | null;
  hasHadTrial: boolean;
}

export interface AuthenticatedRequest extends Request {
  authUser: AuthenticatedUser;
}

function buildAuthUser(user: any): AuthenticatedUser {
  const now = new Date();
  const accessTier = resolveAccessTier(user, now);
  const trialDaysRemaining = getTrialDaysRemaining(user, now);
  const hasHadTrial = !!user.trialStartedAt;

  if (accessTier === "FREE" && hasHadTrial && user.trialEndsAt && now >= user.trialEndsAt) {
    console.log(`[Access] Trial expired for user ${user.id}. Tier resolved to FREE.`);
  }

  return {
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
    accessTier,
    trialDaysRemaining,
    hasHadTrial,
  };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.headers["x-auth-token"] as string;
  const sessionUser = (req as any).session?.userId;

  if (token) {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.authToken, token))
        .limit(1);

      if (user) {
        (req as AuthenticatedRequest).authUser = buildAuthUser(user);
        return next();
      }
    } catch (error) {
      console.error("Auth token lookup error:", error);
    }
  }

  if (sessionUser) {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, sessionUser))
        .limit(1);

      if (user) {
        (req as AuthenticatedRequest).authUser = buildAuthUser(user);
        return next();
      }
    } catch (error) {
      console.error("Session lookup error:", error);
    }
  }

  res.status(401).json({ error: "Authentication required" });
  return;
}

export function generateAuthToken(): string {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}
