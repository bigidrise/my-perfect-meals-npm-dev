import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { autoAcceptPendingInvites, lookupExistingMembership } from "../services/inviteAutoAccept";

const router = Router();

function generateAuthToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function isTesterEmail(email: string): boolean {
  const testerEmails = process.env.MPM_TESTER_EMAILS || "";
  if (!testerEmails.trim()) return false;
  const allowlist = testerEmails.split(",").map(e => e.trim().toLowerCase());
  return allowlist.includes(email.toLowerCase());
}

/**
 * POST /api/auth/signup
 * Creates a new user account in the database
 */
router.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, procare } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate auth token
    const authToken = generateAuthToken();
    
    // Check if email is in tester allowlist
    const isTester = isTesterEmail(email);

    // Build user values with optional ProCare professional fields
    const userValues: any = {
      email,
      username: email.split("@")[0],
      password: hashedPassword,
      authToken,
      authTokenCreatedAt: new Date(),
      isTester,
    };

    if (procare && procare.professionalCategory) {
      const validRoles = ["trainer", "physician"];
      const validCategories = ["certified", "experienced", "non_certified"];
      if (!procare.professionalRole || !validRoles.includes(procare.professionalRole)) {
        return res.status(400).json({ error: "Professional role (trainer or physician) is required" });
      }
      if (!validCategories.includes(procare.professionalCategory)) {
        return res.status(400).json({ error: "Invalid professional category" });
      }
      if (!procare.attestationText || !procare.attestedAt) {
        return res.status(400).json({ error: "Attestation is required for professional accounts" });
      }
      userValues.role = "coach";
      userValues.isProCare = true;
      userValues.professionalRole = procare.professionalRole;
      userValues.professionalCategory = procare.professionalCategory;
      userValues.procareEntryPath = procare.procareEntryPath || procare.professionalCategory;
      userValues.attestationText = procare.attestationText;
      userValues.attestedAt = new Date(procare.attestedAt);
      userValues.plan = "procare";
      userValues.subscriptionPlan = "procare";
      userValues.subscriptionStatus = "active";
      userValues.planLookupKey = "mpm_procare_monthly";
      userValues.entitlements = ["procare", "care_team", "lab_metrics"];
      if (procare.credentialType) userValues.credentialType = procare.credentialType;
      if (procare.credentialBody) userValues.credentialBody = procare.credentialBody;
      if (procare.credentialNumber) userValues.credentialNumber = procare.credentialNumber;
      if (procare.credentialYear) userValues.credentialYear = procare.credentialYear;
    }

    // Create user in database with auth token
    const [newUser] = await db.insert(users).values(userValues).returning();

  // Set session cookie for mobile compatibility (guard for prod where session may be undefined)
  if (req.session) {
    (req.session as any).userId = newUser.id;
  }

  console.log("✅ Created new user:", newUser.email, "ID:", newUser.id);

    const inviteResult = await autoAcceptPendingInvites(newUser.id, newUser.email);

    const membership = inviteResult.membership || await lookupExistingMembership(newUser.id);

    res.json({
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      authToken,
      isProCare: newUser.isProCare || false,
      professionalRole: newUser.professionalRole || null,
      role: newUser.role || "client",
      ...(membership && { studioMembership: membership }),
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

/**
 * POST /api/auth/upgrade-to-procare
 * Upgrades an existing authenticated user to coach/ProCare role
 */
router.post("/api/auth/upgrade-to-procare", requireAuth, async (req: any, res) => {
  try {
    const userId = req.authUser.id;
    const { procare } = req.body;

    if (!procare || !procare.professionalCategory) {
      return res.status(400).json({ error: "Professional category is required" });
    }

    const validRoles = ["trainer", "physician"];
    const validCategories = ["certified", "experienced", "non_certified"];

    if (!procare.professionalRole || !validRoles.includes(procare.professionalRole)) {
      return res.status(400).json({ error: "Professional role (trainer or physician) is required" });
    }
    if (!validCategories.includes(procare.professionalCategory)) {
      return res.status(400).json({ error: "Invalid professional category" });
    }
    if (!procare.attestationText || !procare.attestedAt) {
      return res.status(400).json({ error: "Attestation is required for professional accounts" });
    }

    const updateValues: any = {
      role: "coach",
      isProCare: true,
      professionalRole: procare.professionalRole,
      professionalCategory: procare.professionalCategory,
      procareEntryPath: procare.procareEntryPath || procare.professionalCategory,
      attestationText: procare.attestationText,
      attestedAt: new Date(procare.attestedAt),
      plan: "procare",
      subscriptionPlan: "procare",
      subscriptionStatus: "active",
      planLookupKey: "mpm_procare_monthly",
      entitlements: ["procare", "care_team", "lab_metrics"],
    };

    if (procare.credentialType) updateValues.credentialType = procare.credentialType;
    if (procare.credentialBody) updateValues.credentialBody = procare.credentialBody;
    if (procare.credentialNumber) updateValues.credentialNumber = procare.credentialNumber;
    if (procare.credentialYear) updateValues.credentialYear = procare.credentialYear;

    const [updatedUser] = await db
      .update(users)
      .set(updateValues)
      .where(eq(users.id, userId))
      .returning();

    console.log("✅ Upgraded user to ProCare:", updatedUser.email, "ID:", updatedUser.id);

    res.json({
      success: true,
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      isProCare: updatedUser.isProCare,
      professionalRole: updatedUser.professionalRole,
    });
  } catch (error: any) {
    console.error("ProCare upgrade error:", error);
    res.status(500).json({ error: "Failed to upgrade account" });
  }
});

/**
 * POST /api/auth/login
 * Authenticates user and returns user data
 */
router.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 Login attempt for email:", email);

    if (!email || !password) {
      console.log("❌ Missing email or password");
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user by email (case-insensitive)
    const normalizedEmail = email.toLowerCase().trim();
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    
    if (!user) {
      console.log("❌ User not found for email:", normalizedEmail);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    console.log("✅ User found:", user.email, "has password:", !!user.password, "password length:", user.password?.length);

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log("🔐 Password comparison result:", isValidPassword);
    if (!isValidPassword) {
      console.log("❌ Password mismatch for user:", user.email);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate new auth token on login and sync tester status
    const authToken = generateAuthToken();
    const isTester = isTesterEmail(email);
    await db.update(users).set({
      authToken,
      authTokenCreatedAt: new Date(),
      isTester,
    }).where(eq(users.id, user.id));

    // Set session cookie for mobile compatibility (guard for PROD where session may be undefined)
    if (req.session) {
      (req.session as any).userId = user.id;
    }

    console.log("✅ User logged in:", user.email, "ID:", user.id);

    const inviteResult = await autoAcceptPendingInvites(user.id, user.email);

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
    });
  } catch (error) {
    console.error("Session validation error:", error);
    res.status(500).json({ error: "Session validation failed" });
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
    console.log(`🗑️ Account deletion requested for user: ${userEmail} (${userId})`);

    await db.delete(users).where(eq(users.id, userId));

    console.log(`✅ Account deleted successfully: ${userEmail} (${userId})`);

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
    console.log(`📧 [FORGOT-PASSWORD] Request received for email: ${email}`);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`📧 [FORGOT-PASSWORD] Normalized email: ${normalizedEmail}`);

    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    console.log(`📧 [FORGOT-PASSWORD] User found: ${user ? 'YES' : 'NO'}`);

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = await bcrypt.hash(resetToken, 10);
      const resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);

      await db.update(users).set({
        resetTokenHash,
        resetTokenExpires,
      }).where(eq(users.id, user.id));
      console.log(`📧 [FORGOT-PASSWORD] Token saved to database`);

      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
      const resetLink = `${appUrl}/reset-password?token=${resetToken}`;
      console.log(`📧 [FORGOT-PASSWORD] Reset link generated: ${resetLink}`);

      try {
        const { sendPasswordResetEmail } = await import("../services/emailService");
        console.log(`📧 [FORGOT-PASSWORD] Calling sendPasswordResetEmail...`);
        await sendPasswordResetEmail({
          to: normalizedEmail,
          resetLink,
          userName: user.username || user.email.split("@")[0],
        });
        console.log(`✅ [FORGOT-PASSWORD] Email sent successfully to: ${normalizedEmail}`);
      } catch (emailError: any) {
        console.error(`❌ [FORGOT-PASSWORD] Email sending failed:`, emailError.message);
      }
    } else {
      console.log(`⚠️ [FORGOT-PASSWORD] Email not found in database: ${normalizedEmail}`);
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

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const usersWithValidExpiry = await db.select().from(users).where(
      sql`${users.resetTokenHash} IS NOT NULL AND ${users.resetTokenExpires} > NOW()`
    );

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

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAuthToken = generateAuthToken();

    await db.update(users).set({
      password: hashedPassword,
      authToken: newAuthToken,
      authTokenCreatedAt: new Date(),
      resetTokenHash: null,
      resetTokenExpires: null,
    }).where(eq(users.id, matchedUser.id));

    console.log(`✅ Password reset successful for: ${matchedUser.email}`);

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