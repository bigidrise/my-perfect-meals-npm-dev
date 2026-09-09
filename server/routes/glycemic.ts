// 🔒 LOCKED FEATURE - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
// Feature: Glycemic API Routes | Locked: 20250108-1925 | Status: DATABASE INTEGRATION COMPLETE
// User Warning: "I'm gonna be pissed off" if this gets messed up later  
// Complete API with GET/POST endpoints, foreign key constraints resolved

import express from "express";
import { saveGlycemicSettings, getGlycemicSettings } from "../services/glycemicSettingsService";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { diabetesProfile } from "../../shared/diabetes-schema";
import { isDiabetesFoodPreferenceEligible } from "@shared/diabetesEligibility";

const router = express.Router();

async function userCanConfigureGlycemicPreferences(userId: string): Promise<boolean> {
  const [[user], [diabetesProfile]] = await Promise.all([
    db.select({
      medicalConditions: users.medicalConditions,
      healthConditions: users.healthConditions,
      specialtyConditions: users.specialtyConditions,
    }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ diabetesType: diabetesProfile.type })
      .from(diabetesProfile)
      .where(and(eq(diabetesProfile.userId, userId), ne(diabetesProfile.type, "NONE")))
      .limit(1),
  ]);
  return isDiabetesFoodPreferenceEligible({
    ...user,
    diabetesType: diabetesProfile?.diabetesType,
  });
}

async function requireGlycemicEligibility(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const userId = (req as AuthenticatedRequest).authUser.id;
  if (!(await userCanConfigureGlycemicPreferences(userId))) {
    return res.status(403).json({
      error: "Diabetes or blood-sugar eligibility is required.",
      code: "DIABETES_ELIGIBILITY_REQUIRED",
    });
  }
  next();
}

// GET glycemic settings for a user
router.get("/glycemic-settings", requireAuth, requireGlycemicEligibility, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    if (req.query.userId && String(req.query.userId) !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const settings = await getGlycemicSettings(userId);
    res.json(settings || {});
  } catch (error) {
    console.error("Error getting glycemic settings:", error);
    res.status(500).json({ error: "Failed to get glycemic settings" });
  }
});

// POST save glycemic settings
async function saveSettings(req: express.Request, res: express.Response) {
  try {
    const {
      userId: requestedUserId, bloodGlucose, preferredCarbs, defaultPortion,
      lowRangeCarbs, midRangeCarbs, highRangeCarbs,
    } = req.body;
    const userId = (req as AuthenticatedRequest).authUser.id;
    if (requestedUserId && String(requestedUserId) !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const settings = {
      userId,
      bloodGlucose,
      preferredCarbs: preferredCarbs ?? [],
      lowRangeCarbs: lowRangeCarbs ?? [],
      midRangeCarbs: midRangeCarbs ?? [],
      highRangeCarbs: highRangeCarbs ?? [],
      defaultPortion: defaultPortion ?? 1,
      glycemicPreferencesConfigured: true,
    };

    await saveGlycemicSettings(settings);
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Error saving glycemic settings:", error);
    res.status(500).json({ error: "Failed to save glycemic settings" });
  }
}

router.post("/glycemic-settings", requireAuth, requireGlycemicEligibility, saveSettings);
router.put("/glycemic-settings", requireAuth, requireGlycemicEligibility, saveSettings);

export default router;