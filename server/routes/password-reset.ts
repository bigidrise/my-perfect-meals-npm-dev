import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import { sendPasswordResetEmail } from "../services/emailService";

const router = Router();

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * POST /api/auth/forgot-password
 * Initiates password reset flow by sending email with reset link
 */
router.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await db
        .update(users)
        .set({
          resetTokenHash: tokenHash,
          resetTokenExpires: expiresAt,
        })
        .where(eq(users.email, normalizedEmail));

      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5000";
      const baseUrl = process.env.FRONTEND_URL || `${protocol}://${host}`;
      const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

      try {
        await sendPasswordResetEmail({
          to: email,
          resetLink,
          userName: user.firstName || user.username || email.split("@")[0],
        });
        console.log(`✅ Password reset email sent`);
      } catch (emailError) {
        console.error(`❌ Failed to send password reset email:`, emailError);
      }
    }

    res.json({
      message: "If that email exists in our system, a password reset link has been sent.",
    });
  } catch (error: any) {
    console.error("❌ Forgot password error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid email address", details: error.errors });
    }
    res.status(500).json({ error: "An error occurred. Please try again later." });
  }
});

/**
 * POST /api/auth/reset-password
 * Resets user password using valid reset token
 */
router.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date();

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.resetTokenHash, tokenHash),
          gt(users.resetTokenExpires, now)
        )
      )
      .limit(1);

    if (!user) {
      return res.status(400).json({
        error: "Invalid or expired reset token. Please request a new password reset.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db
      .update(users)
      .set({
        password: passwordHash,
        resetTokenHash: null,
        resetTokenExpires: null,
      })
      .where(eq(users.id, user.id));

    console.log(`✅ Password successfully reset for user ${user.id}`);

    res.json({
      message: "Password reset successful. You can now log in with your new password.",
    });
  } catch (error: any) {
    console.error("❌ Reset password error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    res.status(500).json({ error: "An error occurred. Please try again later." });
  }
});

export default router;
