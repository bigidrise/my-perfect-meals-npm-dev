// --- NEW: server/routes/ai-voice-journal.ts ---
import express from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { users, journalEntries, emotionalCheckins } from "@shared/schema";

const router = express.Router();

// User preferences schema
const prefsSchema = z.object({
  voiceEnabled: z.boolean().optional(),
  journalingEnabled: z.boolean().optional(),
  dailyJournalReminderEnabled: z.boolean().optional(),
  dailyJournalReminderTime: z.string().optional(), // "HH:mm"
  dailyJournalReminderChannel: z.enum(["sms", "push", "in-app"]).optional(),
});

// Check-in schema
const checkinSchema = z.object({
  moodLabel: z.string(),
  moodScore: z.number().min(1).max(10),
  note: z.string().optional(),
});

// GET /api/ai-voice-journal/prefs - Fetch user preferences
router.get("/prefs", async (req, res) => {
  try {
    // In a real app, get userId from session/auth
    const userId = "mock-user-id"; // Replace with actual auth
    
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = user[0];
    res.json({
      voiceEnabled: userData.voiceEnabled || false,
      journalingEnabled: userData.journalingEnabled || false,
      dailyJournalReminderEnabled: userData.dailyJournalReminderEnabled || false,
      dailyJournalReminderTime: userData.dailyJournalReminderTime || "09:00",
      dailyJournalReminderChannel: userData.dailyJournalReminderChannel || "sms",
    });
  } catch (error) {
    console.error("Error fetching AI voice journal prefs:", error);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

// POST /api/ai-voice-journal/prefs - Save user preferences
router.post("/prefs", async (req, res) => {
  try {
    const prefs = prefsSchema.parse(req.body);
    const userId = "mock-user-id"; // Replace with actual auth

    await db.update(users)
      .set(prefs)
      .where(eq(users.id, userId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving AI voice journal prefs:", error);
    res.status(500).json({ error: "Failed to save preferences" });
  }
});

// POST /api/ai-voice-journal/check-in - Submit emotional check-in
router.post("/check-in", async (req, res) => {
  try {
    const checkin = checkinSchema.parse(req.body);
    const userId = "mock-user-id"; // Replace with actual auth

    await db.insert(emotionalCheckins).values({
      userId,
      moodLabel: checkin.moodLabel,
      moodScore: checkin.moodScore,
      note: checkin.note || null,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving check-in:", error);
    res.status(500).json({ error: "Failed to save check-in" });
  }
});

// GET /api/ai-voice-journal/mood-timeline - Get mood history
router.get("/mood-timeline", async (req, res) => {
  try {
    const userId = "mock-user-id"; // Replace with actual auth

    const checkins = await db.select()
      .from(emotionalCheckins)
      .where(eq(emotionalCheckins.userId, userId))
      .orderBy(desc(emotionalCheckins.createdAt))
      .limit(50);

    const timeline = checkins.map(checkin => ({
      type: "checkin",
      moodLabel: checkin.moodLabel,
      moodScore: checkin.moodScore,
      note: checkin.note,
      createdAt: checkin.createdAt,
    }));

    res.json(timeline);
  } catch (error) {
    console.error("Error fetching mood timeline:", error);
    res.status(500).json({ error: "Failed to fetch timeline" });
  }
});

export default router;