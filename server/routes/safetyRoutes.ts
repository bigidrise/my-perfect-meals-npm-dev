/**
 * Safety Routes — PIN management + preflight safety check
 *
 * Previously defined as inline app.* handlers inside registerRoutes() in routes.ts.
 * Extracted to a proper router so prod.ts can mount it without duplicating code.
 *
 * Mount with:
 *   app.use("/api", safetyRouter);
 */

import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../shared/schema";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import {
  hasUserSetPin,
  setUserPin,
  changeUserPin,
  removeUserPin,
  verifyPinAndIssueOverrideToken,
  createAllergyEditToken,
} from "../services/safetyPinService";
import { enforceSafetyProfile } from "../services/safetyProfileService";

const router = Router();

// ── Safety PIN: status ────────────────────────────────────────────────────────
router.get("/safety-pin/status", requireAuth, async (req: any, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const hasPin = await hasUserSetPin(userId);
    res.json({ hasPin });
  } catch (error: any) {
    console.error("Error checking Safety PIN status:", error);
    res.status(500).json({ error: "Failed to check PIN status" });
  }
});

// ── Safety PIN: set (first time) ──────────────────────────────────────────────
router.post("/safety-pin/set", requireAuth, async (req: any, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: "PIN is required" });
    }

    const hasPin = await hasUserSetPin(userId);
    if (hasPin) {
      // Allow overwrite during onboarding (network-drop retry case)
      const [userRow] = await db
        .select({ onboardingCompletedAt: users.onboardingCompletedAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (userRow?.onboardingCompletedAt) {
        return res.status(400).json({ error: "PIN already set. Use change endpoint." });
      }
    }

    const result = await setUserPin(userId, pin);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: "Safety PIN set successfully" });
  } catch (error: any) {
    console.error("Error setting Safety PIN:", error);
    res.status(500).json({ error: "Failed to set Safety PIN" });
  }
});

// ── Safety PIN: change ────────────────────────────────────────────────────────
router.post("/safety-pin/change", requireAuth, async (req: any, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { currentPin, newPin } = req.body;

    if (!currentPin || !newPin) {
      return res.status(400).json({ error: "Current PIN and new PIN are required" });
    }

    const result = await changeUserPin(userId, currentPin, newPin);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: "Safety PIN changed successfully" });
  } catch (error: any) {
    console.error("Error changing Safety PIN:", error);
    res.status(500).json({ error: "Failed to change Safety PIN" });
  }
});

// ── Safety PIN: remove ────────────────────────────────────────────────────────
router.post("/safety-pin/remove", requireAuth, async (req: any, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: "Current PIN is required" });
    }

    const result = await removeUserPin(userId, pin);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: "Safety PIN removed successfully" });
  } catch (error: any) {
    console.error("Error removing Safety PIN:", error);
    res.status(500).json({ error: "Failed to remove Safety PIN" });
  }
});

// ── Safety PIN: verify + issue one-time override token ────────────────────────
router.post("/safety-pin/verify-override", requireAuth, async (req: any, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { pin, allergen, mealRequest } = req.body;

    if (!pin) {
      return res.status(400).json({ error: "PIN is required" });
    }
    if (!allergen || !mealRequest) {
      return res.status(400).json({ error: "Allergen and meal request context required" });
    }

    const result = await verifyPinAndIssueOverrideToken(userId, pin, allergen, mealRequest);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json({
      success: true,
      overrideToken: result.overrideToken,
      message: "Override authorized for this meal only",
    });
  } catch (error: any) {
    console.error("Error verifying Safety PIN:", error);
    res.status(500).json({ error: "Failed to verify PIN" });
  }
});

// ── Safety: verify PIN for allergy editing ────────────────────────────────────
router.post("/safety/verify-pin", requireAuth, async (req: any, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: "PIN is required" });
    }

    const result = await createAllergyEditToken(userId, pin);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json({
      success: true,
      allergyEditToken: result.token,
      message: "Allergy editing authorized for 10 minutes",
    });
  } catch (error: any) {
    console.error("Error verifying Safety PIN for allergy edit:", error);
    res.status(500).json({ error: "Failed to verify PIN" });
  }
});

// ── SafetyGuard preflight check ───────────────────────────────────────────────
// Called by the client BEFORE generation for instant feedback (no progress-bar-then-fail UX).
// Supports authenticated users (DB profile) and guests (request-provided allergies).
router.post("/safety-check", async (req: any, res) => {
  try {
    const { input, builderId = "preflight", guestAllergies } = req.body;

    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "input text is required" });
    }

    // Resolve user — prefer requireAuth-set authUser, then x-auth-token header fallback
    let resolvedUserId: string | undefined = req.authUser?.id;
    if (!resolvedUserId) {
      const token = req.headers["x-auth-token"] as string | undefined;
      if (token) {
        try {
          const { findUserByValidAuthToken } = await import("../services/authTokenService");
          const tokenUser = await findUserByValidAuthToken(token);
          if (tokenUser) resolvedUserId = tokenUser.id;
        } catch { /* non-fatal */ }
      }
    }

    if (resolvedUserId) {
      const safetyCheck = await enforceSafetyProfile(resolvedUserId, input, builderId, {
        safetyMode: "STRICT",
        correlationId: (req as any).id,
      });
      return res.json({
        result: safetyCheck.result,
        blockedTerms: safetyCheck.blockedTerms,
        blockedCategories: safetyCheck.blockedCategories,
        ambiguousTerms: safetyCheck.ambiguousTerms,
        message: safetyCheck.message,
        suggestion: safetyCheck.suggestion,
        allergyConflict: safetyCheck.allergyConflict ?? null,
      });
    }

    // Guest with allergies provided in the request
    if (guestAllergies && Array.isArray(guestAllergies) && guestAllergies.length > 0) {
      const { enforceSafetyProfileSync } = await import("../services/safetyProfileService");
      const guestProfile = {
        userId: "guest",
        allergies: guestAllergies,
        dietaryRestrictions: [],
        healthConditions: [],
        avoidIngredients: [],
      };
      const safetyCheck = enforceSafetyProfileSync(guestProfile, input);
      return res.json({
        result: safetyCheck.result,
        blockedTerms: safetyCheck.blockedTerms,
        blockedCategories: safetyCheck.blockedCategories,
        ambiguousTerms: safetyCheck.ambiguousTerms,
        message: safetyCheck.message,
        suggestion: safetyCheck.suggestion,
        allergyConflict: safetyCheck.allergyConflict ?? null,
      });
    }

    // No auth, no guest allergies — allow
    console.log("[SafetyCheck] Guest request with no allergies - allowing");
    return res.json({
      result: "SAFE",
      blockedTerms: [],
      blockedCategories: [],
      ambiguousTerms: [],
      message: "No safety profile configured",
    });
  } catch (error: any) {
    console.error("Error in safety preflight check:", error);
    res.status(500).json({ error: "Failed to perform safety check" });
  }
});

export default router;
