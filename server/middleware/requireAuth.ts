import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { resolveAccessTier, type AccessTier } from "../lib/accessTier";
import { loadOrgContext } from "../lib/orgContext";
import { computeEffectiveAccess } from "../services/effectiveAccess";

// ── Idle session timeout thresholds ───────────────────────────────────────────
// Clinical roles (coach, admin) require a shorter timeout to meet HIPAA
// §164.312(a)(2)(iii) automatic logoff requirements.
// Token-based (mobile) auth is exempt — these timeouts only apply to
// browser sessions where an unattended workstation is a real threat.
const IDLE_TIMEOUT_MS: Record<string, number> = {
  coach: 15 * 60 * 1000,  // 15 minutes
  admin: 15 * 60 * 1000,  // 15 minutes
  client: 60 * 60 * 1000, // 60 minutes
};
const IDLE_TIMEOUT_FALLBACK_MS = 60 * 60 * 1000; // 60 minutes for unknown roles

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: "admin" | "coach" | "client";
  plan: string;
  entitlements: string[];
  planLookupKey: string | null;
  selectedMealBuilder: string | null;
  isAdmin: boolean;
  isTester: boolean;
  isSandbox: boolean;
  accessTier: AccessTier;
  activeSystem: string;
  /** Effective org ID. Null means the user belongs to MPM_PUBLIC_ORG_ID. */
  organizationId: string | null;
  /**
   * Non-null when this user's access is sponsored by an active business seat.
   * Cleared immediately when membership status changes to "removed" — the next
   * authenticated request will recompute from the personal plan.
   */
  sponsoredByBusinessId: string | null;
  sponsoredByBusinessName: string | null;
}

export interface AuthenticatedRequest extends Request {
  authUser: AuthenticatedUser;
}

function buildAuthUser(user: any): Omit<AuthenticatedUser, "sponsoredByBusinessId" | "sponsoredByBusinessName"> {
  const now = new Date();
  const accessTier = resolveAccessTier(user, now);

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: (user.role as "admin" | "coach" | "client") ?? "client",
    plan: user.plan,
    entitlements: user.entitlements || [],
    planLookupKey: user.planLookupKey || null,
    selectedMealBuilder: user.selectedMealBuilder || null,
    isAdmin: user.isAdmin || false,
    isTester: user.isTester || false,
    isSandbox: user.isSandbox || false,
    accessTier,
    activeSystem: user.activeSystem || "default",
    organizationId: user.organizationId ?? null,
  };
}

async function buildAuthUserWithEffectiveAccess(user: any): Promise<AuthenticatedUser> {
  const base = buildAuthUser(user);

  try {
    const effective = await computeEffectiveAccess({
      id: user.id,
      planLookupKey: user.planLookupKey,
      personalPlanLookupKey: user.personalPlanLookupKey,
      isSandbox: user.isSandbox,
      isFounder: user.isFounder,
      isTester: user.isTester,
    });

    const now = new Date();
    const accessTier = resolveAccessTier(
      { ...user, planLookupKey: effective.planLookupKey },
      now
    );

    return {
      ...base,
      planLookupKey: effective.planLookupKey,
      entitlements: effective.entitlements,
      accessTier,
      sponsoredByBusinessId: effective.sponsoredByBusinessId,
      sponsoredByBusinessName: effective.sponsoredByBusinessName,
    };
  } catch (err) {
    console.error("[requireAuth] effectiveAccess computation failed, falling back to raw plan:", err);
    return {
      ...base,
      sponsoredByBusinessId: null,
      sponsoredByBusinessName: null,
    };
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const route = `${req.method} ${req.path}`;
  const token = req.headers["x-auth-token"] as string;
  const sessionUser = (req as any).session?.userId;

  if (token) {
    // ── Token-based auth (mobile / native) ────────────────────────────────────
    // Idle timeout is NOT applied here — mobile OS handles app lifecycle and
    // the auth token has its own revocation path.
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.authToken, token))
        .limit(1);

      if (user) {
        (req as AuthenticatedRequest).authUser = await buildAuthUserWithEffectiveAccess(user);
        (req as any).orgContext = await loadOrgContext(user.organizationId ?? null);
        return next();
      }

      // Token present but not found in DB
      console.warn(`[requireAuth] 401 token_not_found — route: ${route}, tokenPrefix: ${token.slice(0, 8)}…`);
    } catch (error) {
      console.error(`[requireAuth] 401 db_error (token lookup) — route: ${route}`, error);
    }
  } else if (sessionUser) {
    // ── Session-based auth (browser) ──────────────────────────────────────────
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, sessionUser))
        .limit(1);

      if (user) {
        // ── Idle session timeout (HIPAA §164.312(a)(2)(iii)) ──────────────────
        const role = (user.role as string) ?? "client";
        const idleThreshold = IDLE_TIMEOUT_MS[role] ?? IDLE_TIMEOUT_FALLBACK_MS;
        const lastActive = (req as any).session?.lastActiveAt as number | undefined;
        const now = Date.now();

        if (lastActive && now - lastActive > idleThreshold) {
          // Destroy the session before responding so it cannot be reused
          (req as any).session.destroy?.(() => {});
          res.status(401).json({
            error: "Your session has expired due to inactivity. Please sign in again.",
            code: "SESSION_IDLE_TIMEOUT",
          });
          return;
        }

        // Stamp last-active time so subsequent requests can measure idle gap
        if ((req as any).session) {
          (req as any).session.lastActiveAt = now;
        }
        // ── End idle timeout ──────────────────────────────────────────────────

        (req as AuthenticatedRequest).authUser = await buildAuthUserWithEffectiveAccess(user);
        (req as any).orgContext = await loadOrgContext(user.organizationId ?? null);
        return next();
      }

      // Session userId present but user not found
      console.warn(`[requireAuth] 401 session_user_not_found — route: ${route}, userId: ${sessionUser}`);
    } catch (error) {
      console.error(`[requireAuth] 401 db_error (session lookup) — route: ${route}`, error);
    }
  } else {
    // No token and no session
    console.warn(`[requireAuth] 401 missing_credentials — route: ${route}, hasToken: false, hasSession: false`);
  }

  res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
  return;
}

export function generateAuthToken(): string {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}
