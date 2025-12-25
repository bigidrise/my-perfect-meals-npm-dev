import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";

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
    const { email, password } = req.body;

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

    // Create user in database with auth token
    const [newUser] = await db.insert(users).values({
      email,
      username: email.split("@")[0], // Use email prefix as username
      password: hashedPassword,
      authToken,
      authTokenCreatedAt: new Date(),
      isTester,
    }).returning();

    // Set session cookie for mobile compatibility (guard for PROD where session may be undefined)
    if (req.session) {
      (req.session as any).userId = newUser.id;
    }

    console.log("✅ Created new user:", newUser.email, "ID:", newUser.id);

    // Return user data with auth token (without password)
    res.json({
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      authToken,
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
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

    // Find user by email
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
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

    // Return user data with auth token (without password)
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      authToken,
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

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = await bcrypt.hash(resetToken, 10);
      const resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);

      await db.update(users).set({
        resetTokenHash,
        resetTokenExpires,
      }).where(eq(users.id, user.id));

      const appUrl = process.env.NEXT_PUBLIC_APP_URL 
        || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
        || "http://localhost:5000";
      const resetLink = `${appUrl}/reset-password?token=${resetToken}`;

      const { sendPasswordResetEmail } = await import("../services/emailService");
      await sendPasswordResetEmail({
        to: normalizedEmail,
        resetLink,
        userName: user.username || user.email.split("@")[0],
      });

      console.log(`✅ Password reset email sent to: ${normalizedEmail}`);
    } else {
      console.log(`⚠️ Password reset requested for non-existent email: ${normalizedEmail}`);
    }

    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (error: any) {
    console.error("Forgot password error:", error);
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