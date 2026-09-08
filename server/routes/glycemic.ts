// 🔒 LOCKED FEATURE - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
// Feature: Glycemic API Routes | Locked: 20250108-1925 | Status: DATABASE INTEGRATION COMPLETE
// User Warning: "I'm gonna be pissed off" if this gets messed up later  
// Complete API with GET/POST endpoints, foreign key constraints resolved

import express from "express";
import { saveGlycemicSettings, getGlycemicSettings } from "../services/glycemicSettingsService";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";

const router = express.Router();

// GET glycemic settings for a user
router.get("/glycemic-settings", requireAuth, async (req, res) => {
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

router.post("/glycemic-settings", requireAuth, saveSettings);
router.put("/glycemic-settings", requireAuth, saveSettings);

export default router;