import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "../storage";
import { sendPasswordResetEmail } from "../services/emailService";

const router = Router();

// Validation schemas
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

    // Check if user exists (don't reveal if they don't for security)
    const user = await storage.getUserByEmail(email.toLowerCase().trim());
    
    if (user) {
      // Generate secure token
      const resetToken = crypto.randomBytes(32).toString("hex");
      
      // Hash token before storing (security best practice)
      const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
      
      // Set expiry to 30 minutes from now
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      
      // Store hashed token in database
      await storage.setPasswordResetToken(email.toLowerCase().trim(), tokenHash, expiresAt);
      
      // Send email with unhashed token in the link
      const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5000"}/reset-password?token=${resetToken}`;
      await sendPasswordResetEmail({
        to: email,
        resetLink,
        userName: user.username || email.split("@")[0],
      });
      
      console.log(`✅ Password reset email sent to ${email}`);
    }

    // Always return the same message (don't reveal if account exists)
    res.json({ 
      message: "If that email exists in our system, a password reset link has been sent." 
    });
  } catch (error: any) {
    console.error("❌ Forgot password error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid email address",
        details: error.errors 
      });
    }
    
    res.status(500).json({ 
      error: "An error occurred. Please try again later." 
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Resets user password using valid reset token
 */
router.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    // Hash the token from URL to compare with stored hash
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    
    // Verify token and get user
    const user = await storage.getUserByResetToken(tokenHash);
    
    if (!user) {
      return res.status(400).json({ 
        error: "Invalid or expired reset token. Please request a new password reset." 
      });
    }

    // Hash the new password (bcrypt with work factor 12)
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Update password and clear reset token
    const success = await storage.updatePasswordByResetToken(tokenHash, passwordHash);
    
    if (!success) {
      return res.status(500).json({ 
        error: "Failed to reset password. Please try again." 
      });
    }

    console.log(`✅ Password successfully reset for user ${user.id}`);
    
    res.json({ 
      message: "Password reset successful. You can now log in with your new password." 
    });
  } catch (error: any) {
    console.error("❌ Reset password error:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid request",
        details: error.errors 
      });
    }
    
    res.status(500).json({ 
      error: "An error occurred. Please try again later." 
    });
  }
});

export default router;
