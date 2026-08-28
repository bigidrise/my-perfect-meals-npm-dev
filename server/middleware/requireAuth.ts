import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { resolveAccessTier, type AccessTier } from "../lib/accessTier";
import { loadOrgContext } from "../lib/orgContext";
import { computeEffectiveAccess } from "../services/effectiveAccess";

// ── Idle session timeout thresholds ───────────────────────────────────────────
// Clinical roles require a 15-minute timeout per HIPAA §164.312(a)(2)(iii).
// This applies to both system roles (coach, admin) AND professional roles
// (physician, trainer, dietitian, nurse_practitioner) which carry role="client"
// in the schema but have the same clinical-access obligations.
// Token-based (mobile) auth is exempt — these timeouts only apply to
// browser sessions where an unattended workstation is a real threat.
const IDLE_TIMEOUT_MS: Record<string, number> = {
  coach: 15 * 60 * 1000,  // 15 minutes
  admin: 15 * 60 * 1000,  // 15 minutes
  client: 60 * 60 * 1000, // 60 minutes
};

const CLINICAL_PROFESSIONAL_ROLES = new Set([
  "physician",
  "trainer",
  "dietitian",
  "nurse_practitioner",
]);

const IDLE_TIMEOUT_FALLBACK_MS = 60 * 60 * 1000; // 60 minutes for unknown roles

export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: "admin" | "coach" | "client";
  /**
   * Set for ProCare professionals whose system role is "client".
   * Drives MFA enforcement and idle-timeout tier for clinical professionals.
   */
  professionalRole: "physician" | "trainer" | "dietitian" | "nurse_practitioner" | null;
  plan: string;
  entitlements: string[];
  planLookupKey: string | null;
  selectedMealBuilder: string | null;
  isAdmin: boolean;
  /** Trusted DB marker for permanent internal/founder access. */
  isFounder: boolean;
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
  /** Clinical-role authorization derived from an active business membership. */
  sponsoredProCareAccess: boolean;
  /** Founder-approved, time-bounded private ProCare grant. */
  pilotProCareAccess: boolean;
  pilotProCareGrantId: string | null;
  pilotProCareEndsAt: Date | null;
  preferredLanguage: string;
}

export interface AuthenticatedRequest extends Request {
  authUser: AuthenticatedUser;
}

function buildAuthUser(user: any): Omit<AuthenticatedUser, "sponsoredByBusinessId" | "sponsoredByBusinessName" | "sponsoredProCareAccess" | "pilotProCareAccess" | "pilotProCareGrantId" | "pilotProCareEndsAt"> {
  const now = new Date();
  const accessTier = resolveAccessTier(user, now);

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: (user.role as "admin" | "coach" | "client") ?? "client",
    professionalRole: (user.professionalRole as AuthenticatedUser["professionalRole"]) ?? null,
    plan: user.plan,
    entitlements: user.entitlements || [],
    planLookupKey: user.planLookupKey || null,
    selectedMealBuilder: user.selectedMealBuilder || null,
    isAdmin: user.isAdmin || false,
    isFounder: user.isFounder || false,
    isTester: user.isTester || false,
    isSandbox: user.isSandbox || false,
    accessTier,
    activeSystem: user.activeSystem || "default",
    organizationId: user.organizationId ?? null,
    preferredLanguage: (user as any).preferredLanguage || "auto",
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
      trialEndsAt: user.trialEndsAt,
      trialAccessType: user.trialAccessType,
    });

    const now = new Date();
    const accessTier = resolveAccessTier(
      {
        ...user,
        planLookupKey: effective.planLookupKey,
        hasPilotProCareAccess: effective.pilotProCareAccess,
      },
      now
    );

    return {
      ...base,
      planLookupKey: effective.planLookupKey,
      entitlements: effective.entitlements,
      accessTier,
      sponsoredByBusinessId: effective.sponsoredByBusinessId,
      sponsoredByBusinessName: effective.sponsoredByBusinessName,
      sponsoredProCareAccess: effective.sponsoredProCareAccess,
      pilotProCareAccess: effective.pilotProCareAccess,
      pilotProCareGrantId: effective.pilotProCareGrantId,
      pilotProCareEndsAt: effective.pilotProCareEndsAt,
    };
  } catch (err) {
    console.error("[requireAuth] effectiveAccess computation failed, falling back to raw plan:", err);
    return {
      ...base,
      sponsoredByBusinessId: null,
      sponsoredByBusinessName: null,
      sponsoredProCareAccess: false,
      pilotProCareAccess: false,
      pilotProCareGrantId: null,
      pilotProCareEndsAt: null,
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
        const professionalRole = (user.professionalRole as string) ?? null;
        const lastActive = (req as any).session?.lastActiveAt as number | undefined;
        const now = Date.now();

        // Clinical professionals carry role="client" in the schema but must
        // receive the 15-minute clinical timeout, not the 60-minute patient timeout.
        const idleThreshold =
          IDLE_TIMEOUT_MS[role] ??
          (professionalRole && CLINICAL_PROFESSIONAL_ROLES.has(professionalRole)
            ? 15 * 60 * 1000
            : IDLE_TIMEOUT_FALLBACK_MS);

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
