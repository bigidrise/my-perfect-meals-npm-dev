import { Router } from "express";
import { db } from "../db";
import { trialAccessInvites, users } from "@shared/schema";
import { eq, sql, and, isNotNull, gt, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { autoAcceptPendingInvites, lookupExistingMembership } from "../services/inviteAutoAccept";
import { selfHealProCareState } from "../services/procareActivation";
import { checkLegalAcceptance } from "../services/legalCheck";
import { logAudit, getClientIp } from "../lib/auditLog";
import { emailServiceAvailable } from "../middleware/requireEmailService";
import { sendTrialStartEmail } from "../services/emailService";
import { normalizeEmailIdentity, resolveEmailIdentityForEmail } from "../services/emailIdentityService";
import {
  findPendingPreRegistrationAccess,
  resolveSignupTrial,
} from "../services/preRegistrationAccess";
import { findOrganizationalPilotInvitation } from "../services/organizationalPilotInvitationService";
import { inspectPilotAuthorizationToken } from "../services/organizationalPilotAuthorizationService";

const router = Router();

function generateAuthToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ─── Account lockout (in-memory, resets on server restart) ───────────────────
// Protects against brute-force credential stuffing.
// Using email as key so unauthenticated callers can't enumerate by userId.
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LockoutEntry { count: number; lockedUntil: number | null }
const loginAttempts = new Map<string, LockoutEntry>();

function getLockoutEntry(email: string): LockoutEntry {
  return loginAttempts.get(email) ?? { count: 0, lockedUntil: null };
}

function isLockedOut(email: string): boolean {
  const entry = getLockoutEntry(email);
  if (!entry.lockedUntil) return false;
  if (Date.now() < entry.lockedUntil) return true;
  loginAttempts.delete(email);
  return false;
}

function recordFailedAttempt(email: string): { locked: boolean } {
  const entry = getLockoutEntry(email);
  const count = entry.count + 1;
  if (count >= MAX_LOGIN_ATTEMPTS) {
    loginAttempts.set(email, { count, lockedUntil: Date.now() + LOCKOUT_DURATION_MS });
    return { locked: true };
  }
  loginAttempts.set(email, { count, lockedUntil: null });
  return { locked: false };
}

function clearLockout(email: string): void {
  loginAttempts.delete(email);
}

// ─── Password policy (NIST SP 800-63B aligned) ───────────────────────────────
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

function validatePassword(password: string): string | null {
  if (typeof password !== "string") return "Password must be a string";
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
  return null;
}

// Common/compromised passwords block-list (basic subset — extend as needed)
const COMMON_PASSWORDS = new Set([
  "password123456", "qwerty123456789", "123456789012", "iloveyou123456",
  "password1234567", "admin12345678", "welcome12345678", "monkey12345678",
]);

function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

function isTesterEmail(email: string): boolean {
  // Allowlist-based: only explicit emails get isTester=true at signup.
  // Set MPM_TESTER_EMAILS as a comma-separated list in env.
  // Example: "coach@example.com,partner@example.com"
  const allowlist = (process.env.MPM_TESTER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase().trim());
}

function isAdminEmail(email: string): boolean {
  // Allowlist-based: emails listed here get isAdmin=true at signup.
  // Set MPM_ADMIN_EMAILS as a comma-separated list in env.
  // Example: "amber@dramie.com,partner@example.com"
  const allowlist = (process.env.MPM_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase().trim());
}

/**
 * POST /api/auth/signup
 * Creates a new user account in the database
 */
router.post("/api/auth/signup", async (req, res) => {
  try {
    const { password, procare } = req.body;
    const email = typeof req.body.email === "string" ? req.body.email.toLowerCase().trim() : req.body.email;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });
    if (isCommonPassword(password)) return res.status(400).json({ error: "This password is too common. Please choose a stronger passphrase." });

    // Do not create another case-variant account when a legacy spelling exists.
    const existingIdentity = await resolveEmailIdentityForEmail(email);
    if (existingIdentity.status !== "not_found") {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate auth token
    const authToken = generateAuthToken();
    
    // Check if email is in tester/admin allowlists
    const isTester = isTesterEmail(email);
    const isAdmin = isAdminEmail(email);

    // Build user values. Professional signup intent is deliberately kept
    // pending until the new account is authenticated and has recorded the
    // current versioned legal acceptances through upgrade-to-procare.
    const isBusinessAccount = req.body.businessAccount === true;
    const inviteToken = typeof req.body.inviteToken === "string" ? req.body.inviteToken : null;
    const pilotInvite = inviteToken
      ? await findOrganizationalPilotInvitation(inviteToken)
      : null;
    if (pilotInvite && normalizeEmailIdentity(pilotInvite.email) !== normalizeEmailIdentity(email)) {
      return res.status(403).json({ error: "This invitation was issued to a different email address.", code: "EMAIL_MISMATCH" });
    }
    const isValidPilotSignup = Boolean(
      pilotInvite &&
      pilotInvite.status === "pending" &&
      pilotInvite.expiresAt > new Date(),
    );
    const isPilotClientSignup = isValidPilotSignup && pilotInvite?.populationType === "client";
    const pilotAuthorizationToken = typeof req.body.pilotAuthorizationToken === "string"
      ? req.body.pilotAuthorizationToken
      : null;
    const pilotAuthorization = pilotAuthorizationToken
      ? await inspectPilotAuthorizationToken(pilotAuthorizationToken)
      : null;
    if (pilotAuthorizationToken && !pilotAuthorization) {
      return res.status(404).json({ error: "Organizational authorization not found.", code: "AUTHORIZATION_NOT_FOUND" });
    }
    if (pilotAuthorization && normalizeEmailIdentity(pilotAuthorization.championEmail) !== normalizeEmailIdentity(email)) {
      return res.status(403).json({ error: "This organizational authorization was issued to a different email address.", code: "EMAIL_MISMATCH" });
    }
    const isValidPilotAuthorizationSignup = Boolean(
      pilotAuthorization &&
      pilotAuthorization.status === "approved" &&
      (!pilotAuthorization.claimTokenExpiresAt || pilotAuthorization.claimTokenExpiresAt > new Date()),
    );
    if (pilotAuthorizationToken && !isValidPilotAuthorizationSignup) {
      return res.status(410).json({ error: "This organizational authorization is no longer available.", code: "AUTHORIZATION_NOT_AVAILABLE" });
    }
    const professionalSetupRequested = !!procare?.professionalCategory;

    // Tester accounts get immediate full access via planLookupKey. Normal
    // consumers get a 7-day signup trial unless their email has a pending
    // pre-registration access record. Pilot/Client records grant 30 days by
    // default, but their clock still starts only here at account activation.
    // ProCare accounts get their plan directly and do not receive a trial.
    const isNormalConsumer = !isTester
      && !professionalSetupRequested
      && !isValidPilotSignup
      && !isValidPilotAuthorizationSignup
      && !isBusinessAccount;
    const trialNow = isNormalConsumer ? new Date() : null;
    const pendingPreRegistrationAccess = isNormalConsumer
      ? await findPendingPreRegistrationAccess(email)
      : null;
    const signupTrial = trialNow
      ? resolveSignupTrial(trialNow, pendingPreRegistrationAccess)
      : null;
    const userValues: any = {
      email,
      username: email.split("@")[0],
      password: hashedPassword,
      authToken,
      authTokenCreatedAt: new Date(),
      isTester,
      isAdmin,
      isFounder: isTester, // tester-allowlisted signups are founder/partner accounts
      ...(isTester ? { planLookupKey: 'mpm_ultimate_monthly' } : {}),
      ...(signupTrial ? {
        trialStartedAt: signupTrial.trialStartedAt,
        trialEndsAt: signupTrial.trialEndsAt,
        trialSource: signupTrial.trialSource,
        trialAccessType: signupTrial.trialAccessType,
      } : {}),
    };

    // Business / Organization account — not a ProCare practitioner.
    // Gets professionalRole="business" only; no isProCare, no role=coach, no plan override.
    if (isBusinessAccount && !isPilotClientSignup) {
      userValues.professionalRole = "business";
    }

    // Acquisition source — optional, captured from ?source= or ?ref= URL param
    const signupSource = typeof req.body.signupSource === "string" ? req.body.signupSource.trim().slice(0, 100) : null;
    if (signupSource) {
      userValues.signupSource = signupSource;
    }

    if (professionalSetupRequested) {
      const validRoles = ["trainer", "physician", "dietitian", "nurse_practitioner"];
      const validCategories = ["certified", "experienced", "non_certified"];
      const licensedRoles = ["physician", "dietitian", "nurse_practitioner"];
      if (!procare.professionalRole || !validRoles.includes(procare.professionalRole)) {
        return res.status(400).json({ error: "Invalid professional role" });
      }
      if (!validCategories.includes(procare.professionalCategory)) {
        return res.status(400).json({ error: "Invalid professional category" });
      }
      // Licensed roles (physician / dietitian / NP-PA) must supply license number + state
      if (licensedRoles.includes(procare.professionalRole) && procare.professionalCategory === "certified") {
        if (!procare.credentialNumber?.trim()) {
          return res.status(400).json({ error: "License number is required for licensed professionals" });
        }
        if (!procare.credentialBody?.trim()) {
          return res.status(400).json({ error: "License state is required for licensed professionals" });
        }
      }
      // Do not activate ProCare here. This unauthenticated endpoint cannot
      // create legal acceptance records on the user's behalf. The authenticated
      // upgrade endpoint is the sole professional activation boundary.
    }

    // Create the user and claim any pre-registration record atomically. If the
    // record was claimed by another request, the user insert rolls back rather
    // than issuing an untracked 30-day entitlement.
    const newUser = await db.transaction(async (tx) => {
      const [createdUser] = await tx.insert(users).values(userValues).returning();

      if (pendingPreRegistrationAccess) {
        const [claimed] = await tx
          .update(trialAccessInvites)
          .set({
            activatedAt: trialNow!,
            activatedUserId: createdUser.id,
          })
          .where(and(
            eq(trialAccessInvites.id, pendingPreRegistrationAccess.id),
            isNull(trialAccessInvites.activatedAt),
            isNull(trialAccessInvites.revokedAt),
          ))
          .returning({ id: trialAccessInvites.id });

        if (!claimed) {
          throw new Error("Pre-registration access was already activated");
        }
      }

      return createdUser;
    });

  // Set session cookie for mobile compatibility (guard for prod where session may be undefined)
  if (req.session) {
    (req.session as any).userId = newUser.id;
  }

  console.log("✅ Created new user ID:", newUser.id);
  logAudit({
    actor: newUser.id,
    action: "AUTH_SIGNUP",
    resourceType: "auth",
    route: "/api/auth/signup",
    ip: getClientIp(req as any),
    meta: {
      isProCare: newUser.isProCare || false,
        professionalSetupRequested,
      trialAccessType: signupTrial?.trialAccessType ?? null,
    },
  });

    // Send trial-start confirmation email for standard consumer trial (non-fatal)
    if (isNormalConsumer && signupTrial && emailServiceAvailable()) {
      sendTrialStartEmail({
        to: newUser.email,
        userName: newUser.username || newUser.email.split('@')[0],
        trialSource: signupTrial.trialSource,
        durationDays: signupTrial.durationDays,
        trialEndsAt: signupTrial.trialEndsAt,
      }).catch((err) =>
        console.error('[signup] Trial start email failed (non-fatal):', err)
      );
    }

    const inviteResult = await autoAcceptPendingInvites(newUser.id, newUser.email);

    if (!inviteResult.accepted) {
      await selfHealProCareState(newUser.id);
    }

    const membership = inviteResult.membership || await lookupExistingMembership(newUser.id);

    res.json({
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      authToken,
      isProCare: newUser.isProCare || false,
      professionalRole: newUser.professionalRole || null,
      role: newUser.role || "client",
      isTester: newUser.isTester || false,
      isFounder: newUser.isFounder || false,
      planLookupKey: newUser.planLookupKey || null,
      professionalSetupRequired: professionalSetupRequested,
      ...(membership && { studioMembership: membership }),
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

/**
 * POST /api/auth/upgrade-to-procare
 * Retired: professional profile assertions and legal acceptance are not
 * payment authority. ProCare access is granted only by verified billing or
 * an explicit audited administrative/pilot entitlement path.
 */
router.post("/api/auth/upgrade-to-procare", requireAuth, async (req: any, res) => {
  return res.status(410).json({
    code: "PROCARE_SELF_UPGRADE_RETIRED",
    error: "ProCare access can only be activated through verified billing.",
  });
});

/**
 * POST /api/auth/login
 * Authenticates user and returns user data
 */
router.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = (email as string).toLowerCase().trim();

    const identity = await resolveEmailIdentityForEmail(email);
    const [user] = identity.status === "unique" || identity.status === "legacy_exact"
      ? await db.select().from(users).where(eq(users.id, identity.user.id)).limit(1)
      : [];
    const lockoutKey = user ? `user:${user.id}` : normalizedEmail;

    // A normalized address with multiple legacy accounts cannot select one by
    // position. The caller must use the precise stored spelling or seek review.
    if (identity.status === "ambiguous") {
      return res.status(409).json({
        error: "Multiple accounts use this email address. Sign in using the exact email capitalization for this account or contact support.",
      });
    }

    // ── Lockout check ─────────────────────────────────────────────────────────
    if (isLockedOut(lockoutKey)) {
      return res.status(429).json({ error: "Account temporarily locked due to too many failed attempts. Try again in 15 minutes." });
    }
    
    if (!user) {
      const result = recordFailedAttempt(lockoutKey);
      logAudit({ actor: "anonymous", action: "AUTH_FAILED_LOGIN", resourceType: "auth", route: "/api/auth/login", ip: getClientIp(req as any), meta: { reason: "user_not_found" } });
      if (result.locked) {
        logAudit({ actor: "anonymous", action: "AUTH_LOCKOUT", resourceType: "auth", route: "/api/auth/login", ip: getClientIp(req as any) });
      }
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const result = recordFailedAttempt(lockoutKey);
      logAudit({ actor: user.id, action: "AUTH_FAILED_LOGIN", resourceType: "auth", route: "/api/auth/login", ip: getClientIp(req as any), meta: { reason: "bad_password", attempt: getLockoutEntry(lockoutKey).count } });
      if (result.locked) {
        logAudit({ actor: user.id, action: "AUTH_LOCKOUT", resourceType: "auth", route: "/api/auth/login", ip: getClientIp(req as any) });
        return res.status(429).json({ error: "Account temporarily locked due to too many failed attempts. Try again in 15 minutes." });
      }
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Successful login — clear failed attempt counter
    clearLockout(lockoutKey);

    // ── MFA gate ──────────────────────────────────────────────────────────────
    // If the user has MFA enabled, pause here and require a TOTP challenge.
    // Set pendingMfaUserId on the session so the /mfa/challenge endpoint can
    // verify the code and promote to a full session.
    if (user.mfaEnabled) {
      if (req.session) {
        (req.session as any).pendingMfaUserId = user.id;
        delete (req.session as any).userId; // no full session until TOTP verified
      }
      logAudit({ actor: user.id, action: "AUTH_LOGIN", resourceType: "auth", route: req.path, ip: getClientIp(req as any), meta: { mfaRequired: true } });
      return res.json({ mfaRequired: true });
    }

    // Login: only regenerate auth token if missing — never overwrite isTester from login
    const authToken = user.authToken || generateAuthToken();
    const updateFields: any = {};
    if (!user.authToken) {
      updateFields.authToken = authToken;
      updateFields.authTokenCreatedAt = new Date();
    }
    if (Object.keys(updateFields).length > 0) {
      await db.update(users).set(updateFields).where(eq(users.id, user.id));
    }

    // Set session cookie for mobile compatibility (guard for PROD where session may be undefined)
    if (req.session) {
      (req.session as any).userId = user.id;
    }

    console.log("✅ User logged in, ID:", user.id);
    logAudit({ actor: user.id, action: "AUTH_LOGIN", resourceType: "auth", route: "/api/auth/login", ip: getClientIp(req as any) });

    const inviteResult = await autoAcceptPendingInvites(user.id, user.email);

    if (!inviteResult.accepted) {
      await selfHealProCareState(user.id);
    }

    const membership = inviteResult.membership || await lookupExistingMembership(user.id);

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      authToken,
      isProCare: user.isProCare || false,
      professionalRole: user.professionalRole || null,
      role: user.role || "client",
      selectedMealBuilder: user.selectedMealBuilder || null,
      activeBoard: user.activeBoard || null,
      onboardingCompletedAt: user.onboardingCompletedAt || null,
      isTester: user.isTester || false,
      isFounder: user.isFounder || false,
      planLookupKey: user.planLookupKey || null,
      ...(membership && { studioMembership: membership }),
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});

/**
 * GET /api/auth/session
 * Validates auth token and returns user data if authenticated.
 */
router.get("/api/auth/session", async (req: any, res) => {
  const token = req.headers["x-auth-token"] as string;
  
  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }
  
  try {
    const [user] = await db.select().from(users).where(eq(users.authToken, token)).limit(1);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid auth token" });
    }
    
    res.json({
      userId: user.id,
      id: user.id,
      email: user.email,
      username: user.username,
      isTester: user.isTester || false,
      isFounder: user.isFounder || false,
      planLookupKey: user.planLookupKey || null,
      role: user.role || "client",
      isProCare: user.isProCare || false,
    });
  } catch (error) {
    console.error("Session validation error:", error);
    res.status(500).json({ error: "Session validation failed" });
  }
});

/**
 * POST /api/auth/logout
 * Invalidates the auth token in the database so it cannot be reused after sign-out.
 * Client must also clear localStorage regardless of whether this call succeeds.
 */
router.post("/api/auth/logout", requireAuth, async (req: any, res) => {
  const userId = req.authUser.id;
  try {
    await db.update(users).set({ authToken: null, authTokenCreatedAt: null }).where(eq(users.id, userId));
    if (req.session) {
      req.session.destroy?.(() => {});
    }
    console.log(`✅ [logout] Token invalidated for user ${userId}`);
    logAudit({ actor: userId, action: "AUTH_LOGOUT", resourceType: "auth", route: "/api/auth/logout", ip: getClientIp(req as any) });
    return res.json({ success: true });
  } catch (err: any) {
    console.error(`[logout] DB error for user ${userId}:`, err.message);
    return res.status(500).json({ error: "Logout failed" });
  }
});

/**
 * DELETE /api/auth/delete-account
 * Permanently deletes the authenticated user's account and all associated data.
 * Apple App Store requirement 5.1.1 - self-service account deletion.
 */
router.delete("/api/auth/delete-account", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser.id;
  const userEmail = authReq.authUser.email;

  try {
    console.log(`🗑️ Account deletion requested for user ID: ${userId}`);
    logAudit({ actor: userId, action: "AUTH_ACCOUNT_DELETED", resourceType: "auth", route: "/api/auth/delete-account", ip: getClientIp(req as any) });

    await db.delete(users).where(eq(users.id, userId));

    console.log(`✅ Account deleted successfully, user ID: ${userId}`);

    res.status(204).send();
  } catch (error: any) {
    console.error("Account deletion error:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

/**
 * POST /api/auth/forgot-password
 * Generates a password reset token and sends email via Resend.
 * Always returns 200 to avoid leaking whether email exists.
 */
router.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`📧 [FORGOT-PASSWORD] Request received`);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`📧 [FORGOT-PASSWORD] Email normalized`);

    const identity = await resolveEmailIdentityForEmail(email);
    const [user] = identity.status === "unique" || identity.status === "legacy_exact"
      ? await db.select().from(users).where(eq(users.id, identity.user.id)).limit(1)
      : [];
    console.log(`📧 [FORGOT-PASSWORD] User found: ${user ? 'YES' : 'NO'}`);

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = await bcrypt.hash(resetToken, 10);
      const resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);

      await db.update(users).set({
        resetTokenHash,
        resetTokenExpires,
      }).where(eq(users.id, user.id));
      logAudit({ actor: user.id, action: "AUTH_RESET_REQUESTED", resourceType: "auth", route: "/api/auth/forgot-password", ip: getClientIp(req as any) });
      console.log(`📧 [FORGOT-PASSWORD] Token saved to database`);

      const fwdProto = req.headers["x-forwarded-proto"];
      const fwdHost = req.headers["x-forwarded-host"];
      let appUrl: string;
      if (fwdProto && fwdHost) {
        appUrl = `${fwdProto}://${fwdHost}`;
      } else if (process.env.PUBLIC_APP_URL) {
        appUrl = process.env.PUBLIC_APP_URL;
      } else if (process.env.REPLIT_DEV_DOMAIN) {
        appUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
      } else {
        appUrl = `${req.protocol}://${req.headers.host || "localhost:5000"}`;
      }
      const resetLink = `${appUrl}/reset-password?token=${resetToken}`;
      console.log(`📧 [FORGOT-PASSWORD] Reset link generated`);

      if (!emailServiceAvailable()) {
        console.warn(`⚠️ [FORGOT-PASSWORD] RESEND_API_KEY not configured — password reset email skipped for ${normalizedEmail}`);
      } else {
        try {
          const { sendPasswordResetEmail } = await import("../services/emailService");
          console.log(`📧 [FORGOT-PASSWORD] Calling sendPasswordResetEmail...`);
          await sendPasswordResetEmail({
            to: normalizedEmail,
            resetLink,
            userName: user.username || user.email.split("@")[0],
          });
          console.log(`✅ [FORGOT-PASSWORD] Email sent successfully`);
        } catch (emailError: any) {
          console.error(`❌ [FORGOT-PASSWORD] Email sending failed:`, emailError.message);
        }
      }
    } else {
      console.log(`⚠️ [FORGOT-PASSWORD] Email not found in database`);
    }

    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (error: any) {
    console.error("❌ [FORGOT-PASSWORD] Error:", error);
    res.status(500).json({ error: "Failed to process password reset request" });
  }
});

/**
 * POST /api/auth/reset-password
 * Validates reset token and updates password.
 */
router.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }

    const pwResetError = validatePassword(password);
    if (pwResetError) return res.status(400).json({ error: pwResetError });
    if (isCommonPassword(password)) return res.status(400).json({ error: "This password is too common. Please choose a stronger passphrase." });

    const now = new Date();
    const usersWithValidExpiry = await db.select().from(users).where(
      and(
        isNotNull(users.resetTokenHash),
        gt(users.resetTokenExpires!, now)
      )
    );
    console.log(`🔑 [RESET-PASSWORD] Users with valid tokens: ${usersWithValidExpiry.length}`);

    let matchedUser = null;
    for (const user of usersWithValidExpiry) {
      if (user.resetTokenHash) {
        const isValidToken = await bcrypt.compare(token, user.resetTokenHash);
        if (isValidToken) {
          matchedUser = user;
          break;
        }
      }
    }

    if (!matchedUser) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newAuthToken = generateAuthToken();

    await db.update(users).set({
      password: hashedPassword,
      authToken: newAuthToken,
      authTokenCreatedAt: new Date(),
      resetTokenHash: null,
      resetTokenExpires: null,
    }).where(eq(users.id, matchedUser.id));

    // Verify the update actually landed
    const [verify] = await db.select({ password: users.password })
      .from(users)
      .where(eq(users.id, matchedUser.id))
      .limit(1);

    const verifyOk = verify && await bcrypt.compare(password, verify.password);
    console.log(`✅ Password reset for user ${matchedUser.id} — verify bcrypt: ${verifyOk}`);
    logAudit({ actor: matchedUser.id, action: "AUTH_RESET_COMPLETED", resourceType: "auth", route: "/api/auth/reset-password", ip: getClientIp(req as any) });

    res.json({
      message: "Password reset successful",
      authToken: newAuthToken,
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

export default router;