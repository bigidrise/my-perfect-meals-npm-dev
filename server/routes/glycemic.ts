// 🔒 LOCKED FEATURE - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
// Feature: Glycemic API Routes | Locked: 20250108-1925 | Status: DATABASE INTEGRATION COMPLETE
// User Warning: "I'm gonna be pissed off" if this gets messed up later  
// Complete API with GET/POST endpoints, foreign key constraints resolved

import express from "express";
import { saveGlycemicSettings, getGlycemicSettings } from "../services/glycemicSettingsService";

const router = express.Router();

// GET glycemic settings for a user
router.get("/glycemic-settings", async (req, res) => {
  try {
    const userId = req.query.userId as string || "1"; // Default to user 1
    const settings = await getGlycemicSettings(userId);
    res.json(settings || {});
  } catch (error) {
    console.error("Error getting glycemic settings:", error);
    res.status(500).json({ error: "Failed to get glycemic settings" });
  }
});

// POST save glycemic settings
router.post("/glycemic-settings", async (req, res) => {
  try {
    const { userId = "1", bloodGlucose, preferredCarbs, defaultPortion } = req.body;
    
    const settings = {
      userId,
      bloodGlucose,
      preferredCarbs,
      defaultPortion
    };
    
    await saveGlycemicSettings(settings);
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Error saving glycemic settings:", error);
    res.status(500).json({ error: "Failed to save glycemic settings" });
  }
});

export default router;