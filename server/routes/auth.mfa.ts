/**
 * MFA Routes — TOTP setup, challenge, and management
 *
 * POST /api/auth/mfa/setup/begin    — generate secret + QR code (stored in session, not DB)
 * POST /api/auth/mfa/setup/confirm  — verify first TOTP code, save secret + backup codes
 * GET  /api/auth/mfa/status         — return mfaEnabled + enrolledAt for current user
 * POST /api/auth/mfa/challenge      — verify TOTP during login (uses session.pendingMfaUserId)
 * POST /api/auth/mfa/challenge/backup — verify backup code during login
 * DELETE /api/auth/mfa              — disable MFA (requires current TOTP)
 */

import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import {
  generateTotpSecret,
  getTotpQrDataUri,
  verifyTotp,
  generateBackupCodes,
  hashBackupCode,
  verifyAndConsumeBackupCode,
} from "../lib/mfa";
import { logAudit, getClientIp } from "../lib/auditLog";
import { autoAcceptPendingInvites, lookupExistingMembership } from "../services/inviteAutoAccept";
import { selfHealProCareState } from "../services/procareActivation";
import {
  clearSessionCookie,
  destroySession,
  regenerateSession,
} from "../lib/sessionSecurity";
import {
  AuthSecurityStateChangedError,
  rotateAuthToken,
} from "../services/authTokenService";
import { AUTH_ATTEMPT_SCOPES, createAuthAttemptSubject } from "../services/authAttemptTracker";
import { authAttemptTracker } from "../services/authAttemptTrackingService";

const router = Router();

async function isVerificationThrottled(res: any, userId: string, scope: string): Promise<boolean> {
  const subject = createAuthAttemptSubject("mfa-user", userId);
  if (!(await authAttemptTracker.isLocked(subject, scope))) return false;
  res.status(429).json({ error: "Too many failed verification attempts. Try again in 15 minutes." });
  return true;
}

async function recordVerificationFailure(res: any, userId: string, scope: string): Promise<boolean> {
  const state = await authAttemptTracker.recordFailure(createAuthAttemptSubject("mfa-user", userId), scope);
  if (!state.lockedUntil) return false;
  res.status(429).json({ error: "Too many failed verification attempts. Try again in 15 minutes." });
  return true;
}

async function clearVerificationFailures(userId: string, scope: string): Promise<void> {
  await authAttemptTracker.clear(createAuthAttemptSubject("mfa-user", userId), scope);
}

async function ensureAuthToken(user: any): Promise<any> {
  const { authToken, authTokenCreatedAt, authTokenMfaVerifiedAt } =
    await rotateAuthToken(user.id, {
      mfaVerified: true,
      expectedSecurityVersion: user.authSecurityVersion,
      requireMfaEnabled: true,
    });
  return { ...user, authToken, authTokenCreatedAt, authTokenMfaVerifiedAt };
}

// ── Shared helper: build the full login response object ──────────────────────
// Must stay in sync with the login handler in auth.session.ts
async function buildLoginResponse(user: any, req: any) {
  const inviteResult = await autoAcceptPendingInvites(user.id, user.email);
  if (!inviteResult.accepted) await selfHealProCareState(user.id);
  const membership = inviteResult.membership || await lookupExistingMembership(user.id);

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    authToken: user.authToken,
    isProCare: user.isProCare || false,
    professionalRole: user.professionalRole || null,
    role: user.role || "client",
    selectedMealBuilder: user.selectedMealBuilder || null,
    activeBoard: user.activeBoard || null,
    studioMembership: membership || null,
    mfaEnabled: user.mfaEnabled || false,
  };
}

// ── GET /api/auth/mfa/status ──────────────────────────────────────────────────
router.get("/status", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  try {
    const [user] = await db
      .select({ mfaEnabled: users.mfaEnabled, mfaEnrolledAt: users.mfaEnrolledAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    res.json({
      mfaEnabled: user?.mfaEnabled ?? false,
      enrolledAt: user?.mfaEnrolledAt ?? null,
      sessionVerified: (req as any).session?.mfaVerified === true,
    });
  } catch (err) {
    console.error("[mfa/status] error:", err);
    res.status(500).json({ error: "Failed to fetch MFA status" });
  }
});

// ── POST /api/auth/mfa/setup/begin ───────────────────────────────────────────
// Generates a fresh TOTP secret and QR code. Stores the secret in the session
// temporarily — NOT saved to DB until the user confirms with a valid code.
router.post("/setup/begin", requireAuth, async (req, res) => {
  const user = (req as AuthenticatedRequest).authUser;
  try {
    const [current] = await db
      .select({ mfaEnabled: users.mfaEnabled })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (!current) return res.status(401).json({ error: "Authentication required" });
    if (current.mfaEnabled) {
      return res.status(409).json({
        error: "MFA is already enabled. Disable the current factor before enrolling a replacement.",
        code: "MFA_ALREADY_ENABLED",
      });
    }

    const secret = generateTotpSecret();
    (req as any).session.pendingMfaSecret = secret;

    const qrDataUri = await getTotpQrDataUri(secret, user.email);

    res.json({
      secret,   // shown once so user can manually enter if QR fails
      qrDataUri,
    });
  } catch (err) {
    console.error("[mfa/setup/begin] error:", err);
    res.status(500).json({ error: "Failed to generate MFA setup" });
  }
});

// ── POST /api/auth/mfa/setup/confirm ─────────────────────────────────────────
// Verifies the first TOTP code, then saves the secret + hashed backup codes.
router.post("/setup/confirm", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const { code } = req.body;
  const secret: string | undefined = (req as any).session?.pendingMfaSecret;

  if (!secret) {
    return res.status(400).json({ error: "No pending MFA setup. Call /setup/begin first." });
  }
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "A 6-digit authenticator code is required." });
  }

  try {
    if (await isVerificationThrottled(res, userId, AUTH_ATTEMPT_SCOPES.mfaSetupConfirm)) return;

    if (!(await verifyTotp(secret, code))) {
      if (await recordVerificationFailure(res, userId, AUTH_ATTEMPT_SCOPES.mfaSetupConfirm)) return;
      logAudit({ actor: userId, action: "MFA_CHALLENGE_FAILED", resourceType: "auth", route: req.path, ip: getClientIp(req as any), meta: { phase: "setup_confirm" } });
      return res.status(400).json({ error: "Invalid code. Check your authenticator app and try again." });
    }
    await clearVerificationFailures(userId, AUTH_ATTEMPT_SCOPES.mfaSetupConfirm);

    const rawBackupCodes = generateBackupCodes();
    const hashedCodes = rawBackupCodes.map(hashBackupCode);

    const sessionSecurityVersion = (req as any).session?.authSecurityVersion;
    const [enrolled] = await db.update(users)
      .set({
        mfaEnabled: true,
        mfaSecret: secret,
        mfaBackupCodes: hashedCodes as any,
        mfaEnrolledAt: new Date(),
        authToken: null,
        authTokenCreatedAt: null,
        authTokenMfaVerifiedAt: null,
        authSecurityVersion: sql`${users.authSecurityVersion} + 1`,
      })
      .where(and(
        eq(users.id, userId),
        eq(users.mfaEnabled, false),
        eq(users.authSecurityVersion, sessionSecurityVersion),
      ))
      .returning({ authSecurityVersion: users.authSecurityVersion });

    if (!enrolled) throw new Error("MFA enrollment update returned no user");
    const credential = await rotateAuthToken(userId, {
      mfaVerified: true,
      expectedSecurityVersion: enrolled.authSecurityVersion,
      requireMfaEnabled: true,
    });
    await regenerateSession(req);
    (req as any).session.userId = userId;
    (req as any).session.authSecurityVersion = enrolled.authSecurityVersion;
    (req as any).session.mfaVerified = true;

    logAudit({ actor: userId, action: "MFA_ENROLLED", resourceType: "auth", route: req.path, ip: getClientIp(req as any) });

    res.json({
      success: true,
      authToken: credential.authToken,
      backupCodes: rawBackupCodes, // shown ONCE — user must save these
    });
  } catch (err) {
    if (err instanceof AuthSecurityStateChangedError) {
      return res.status(401).json({
        error: "Authentication state changed. Please sign in and try again.",
        code: "AUTH_REAUTHENTICATION_REQUIRED",
      });
    }
    console.error("[mfa/setup/confirm] error:", err);
    res.status(500).json({ error: "Failed to save MFA settings" });
  }
});

// ── POST /api/auth/mfa/challenge ──────────────────────────────────────────────
// Called after the login password step when mfaRequired=true.
// Verifies the TOTP code, issues a full session, returns user payload.
router.post("/challenge", async (req, res) => {
  const pendingUserId: string | undefined = (req as any).session?.pendingMfaUserId;
  const { code } = req.body;

  if (!pendingUserId) {
    return res.status(400).json({ error: "No pending MFA challenge. Please log in first." });
  }
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "A 6-digit authenticator code is required." });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, pendingUserId)).limit(1);
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return res.status(400).json({ error: "MFA not configured for this account." });
    }

    if (await isVerificationThrottled(res, user.id, AUTH_ATTEMPT_SCOPES.mfaTotp)) return;
    if (!(await verifyTotp(user.mfaSecret, code))) {
      if (await recordVerificationFailure(res, user.id, AUTH_ATTEMPT_SCOPES.mfaTotp)) return;
      logAudit({ actor: user.id, action: "MFA_CHALLENGE_FAILED", resourceType: "auth", route: req.path, ip: getClientIp(req as any), meta: { method: "totp" } });
      return res.status(401).json({ error: "Invalid code. Try again or use a backup code." });
    }
    await clearVerificationFailures(user.id, AUTH_ATTEMPT_SCOPES.mfaTotp);

    const authenticatedUser = await ensureAuthToken(user);

    // Rotate away from the pre-authentication session before promotion.
    await regenerateSession(req);
    (req as any).session.userId = user.id;
    (req as any).session.authSecurityVersion = user.authSecurityVersion;
    (req as any).session.mfaVerified = true;

    logAudit({ actor: user.id, action: "MFA_CHALLENGE_SUCCESS", resourceType: "auth", route: req.path, ip: getClientIp(req as any), meta: { method: "totp" } });

    const payload = await buildLoginResponse(authenticatedUser, req);
    res.json(payload);
  } catch (err) {
    if (err instanceof AuthSecurityStateChangedError) {
      return res.status(401).json({
        error: "Authentication state changed. Please sign in again.",
        code: "AUTH_REAUTHENTICATION_REQUIRED",
      });
    }
    console.error("[mfa/challenge] error:", err);
    res.status(500).json({ error: "MFA challenge failed" });
  }
});

// ── POST /api/auth/mfa/challenge/backup ──────────────────────────────────────
// Same as /challenge but uses a one-time backup code instead of TOTP.
router.post("/challenge/backup", async (req, res) => {
  const pendingUserId: string | undefined = (req as any).session?.pendingMfaUserId;
  const { code } = req.body;

  if (!pendingUserId) {
    return res.status(400).json({ error: "No pending MFA challenge. Please log in first." });
  }
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "A backup code is required." });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, pendingUserId)).limit(1);
    if (!user || !user.mfaEnabled || !user.mfaBackupCodes) {
      return res.status(400).json({ error: "MFA not configured for this account." });
    }

    if (await isVerificationThrottled(res, user.id, AUTH_ATTEMPT_SCOPES.mfaBackup)) return;
    const hashedCodes = user.mfaBackupCodes as string[];
    const { valid, remaining } = verifyAndConsumeBackupCode(hashedCodes, code);

    if (!valid) {
      if (await recordVerificationFailure(res, user.id, AUTH_ATTEMPT_SCOPES.mfaBackup)) return;
      logAudit({ actor: user.id, action: "MFA_CHALLENGE_FAILED", resourceType: "auth", route: req.path, ip: getClientIp(req as any), meta: { method: "backup" } });
      return res.status(401).json({ error: "Invalid backup code." });
    }

    // Consume the used backup code atomically. Matching the original code list
    // prevents two concurrent submissions from both succeeding.
    const [consumed] = await db.update(users)
      .set({ mfaBackupCodes: remaining as any })
      .where(and(
        eq(users.id, user.id),
        eq(users.mfaBackupCodes, hashedCodes as any),
      ))
      .returning({ id: users.id });

    if (!consumed) {
      if (await recordVerificationFailure(res, user.id, AUTH_ATTEMPT_SCOPES.mfaBackup)) return;
      logAudit({ actor: user.id, action: "MFA_CHALLENGE_FAILED", resourceType: "auth", route: req.path, ip: getClientIp(req as any), meta: { method: "backup", reason: "already_consumed" } });
      return res.status(401).json({ error: "Invalid backup code." });
    }
    await clearVerificationFailures(user.id, AUTH_ATTEMPT_SCOPES.mfaBackup);

    const authenticatedUser = await ensureAuthToken(user);

    // Rotate away from the pre-authentication session before promotion.
    await regenerateSession(req);
    (req as any).session.userId = user.id;
    (req as any).session.authSecurityVersion = user.authSecurityVersion;
    (req as any).session.mfaVerified = true;

    logAudit({ actor: user.id, action: "MFA_CHALLENGE_SUCCESS", resourceType: "auth", route: req.path, ip: getClientIp(req as any), meta: { method: "backup" } });
    logAudit({ actor: user.id, action: "MFA_BACKUP_USED", resourceType: "auth", route: req.path, ip: getClientIp(req as any), meta: { remaining: remaining.length } });

    const payload = await buildLoginResponse(authenticatedUser, req);
    res.json(payload);
  } catch (err) {
    if (err instanceof AuthSecurityStateChangedError) {
      return res.status(401).json({
        error: "Authentication state changed. Please sign in again.",
        code: "AUTH_REAUTHENTICATION_REQUIRED",
      });
    }
    console.error("[mfa/challenge/backup] error:", err);
    res.status(500).json({ error: "Backup code verification failed" });
  }
});

// ── DELETE /api/auth/mfa ──────────────────────────────────────────────────────
// Disable MFA. Requires either a valid TOTP code or a backup code.
router.delete("/", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).authUser.id;
  const { code, backupCode } = req.body;

  if (!code && !backupCode) {
    return res.status(400).json({ error: "A current authenticator code or backup code is required to disable MFA." });
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return res.status(400).json({ error: "MFA is not enabled on this account." });
    }

    if (await isVerificationThrottled(res, user.id, AUTH_ATTEMPT_SCOPES.mfaDisable)) return;
    let verified = false;
    if (code) {
      verified = await verifyTotp(user.mfaSecret, code);
    } else if (backupCode) {
      const hashedCodes = user.mfaBackupCodes as string[];
      const result = verifyAndConsumeBackupCode(hashedCodes, backupCode);
      verified = result.valid;
    }

    if (!verified) {
      if (await recordVerificationFailure(res, user.id, AUTH_ATTEMPT_SCOPES.mfaDisable)) return;
      logAudit({ actor: userId, action: "MFA_CHALLENGE_FAILED", resourceType: "auth", route: req.path, ip: getClientIp(req as any), meta: { phase: "disable" } });
      return res.status(401).json({ error: "Invalid code. MFA not disabled." });
    }
    await clearVerificationFailures(user.id, AUTH_ATTEMPT_SCOPES.mfaDisable);

    await db.update(users)
      .set({
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: null,
        mfaEnrolledAt: null,
        authToken: null,
        authTokenCreatedAt: null,
        authTokenMfaVerifiedAt: null,
        authSecurityVersion: sql`${users.authSecurityVersion} + 1`,
      })
      .where(eq(users.id, userId));

    await destroySession(req);
    clearSessionCookie(res);

    logAudit({ actor: userId, action: "MFA_DISABLED", resourceType: "auth", route: req.path, ip: getClientIp(req as any) });

    res.json({ success: true, requiresLogin: true });
  } catch (err) {
    console.error("[mfa/disable] error:", err);
    res.status(500).json({ error: "Failed to disable MFA" });
  }
});

export default router;
