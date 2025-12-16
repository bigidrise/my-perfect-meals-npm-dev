import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { avatarState, avatarDay } from "../../shared/fitlife-schema";
import { tickDay } from "../services/fitlifeSim";

const router = Router();
const ENABLED = process.env.FITLIFE_ENABLED !== "false"; // Default to enabled

// Feature flag guard for all endpoints
router.use((req, res, next) => {
  if (!ENABLED) {
    return res.status(404).json({ error: "FitLife disabled" });
  }
  next();
});

const todayKey = () => new Date().toISOString().slice(0, 10);

// GET or initialize user's avatar state
router.get("/state", async (req, res) => {
  try {
    const userId = String(req.query.userId || "1");
    let row = (await db.select().from(avatarState).where(eq(avatarState.userId, userId))).at(0);
    
    if (!row) {
      // Initialize new avatar state
      await db.insert(avatarState).values({ 
        userId, 
        lastSimDate: todayKey() 
      });
      row = (await db.select().from(avatarState).where(eq(avatarState.userId, userId))).at(0);
    }
    
    res.json({ state: row });
  } catch (error) {
    console.error("Error fetching avatar state:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Set today's inputs (nutrition/training/lifestyle scores)
router.post("/day/set", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "1");
    const dateKey = String(req.body?.dateKey || todayKey());
    const nutritionScore = Number(req.body?.nutritionScore ?? 50);
    const trainingScore = Number(req.body?.trainingScore ?? 0);
    const lifestyleScore = Number(req.body?.lifestyleScore ?? 50);
    const meta = req.body?.meta || {};

    // Upsert today's inputs
    const existing = (await db.select().from(avatarDay)
      .where(and(eq(avatarDay.userId, userId), eq(avatarDay.dateKey, dateKey)))).at(0);

    if (!existing) {
      await db.insert(avatarDay).values({ 
        userId, 
        dateKey, 
        nutritionScore: nutritionScore.toString(), 
        trainingScore: trainingScore.toString(), 
        lifestyleScore: lifestyleScore.toString(), 
        meta 
      });
    } else {
      await db.update(avatarDay).set({ 
        nutritionScore: nutritionScore.toString(), 
        trainingScore: trainingScore.toString(), 
        lifestyleScore: lifestyleScore.toString(), 
        meta 
      }).where(and(eq(avatarDay.userId, userId), eq(avatarDay.dateKey, dateKey)));
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error("Error setting day inputs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Advance simulation for a date (defaults to today)
router.post("/day/tick", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "1");
    const dateKey = String(req.body?.dateKey || todayKey());

    const st = (await db.select().from(avatarState).where(eq(avatarState.userId, userId))).at(0);
    if (!st) {
      return res.status(404).json({ error: "No avatar state found" });
    }

    const d = (await db.select().from(avatarDay)
      .where(and(eq(avatarDay.userId, userId), eq(avatarDay.dateKey, dateKey)))).at(0)
      || { 
        nutritionScore: "50", 
        trainingScore: "0", 
        lifestyleScore: "50", 
        meta: {} as any 
      };

    const next = tickDay({
      weightLbs: Number(st.weightLbs),
      bodyFatPct: Number(st.bodyFatPct),
      muscleMassLbs: Number(st.muscleMassLbs),
      energy: Number(st.energy),
      mood: Number(st.mood),
      lifestyleScore: Number(st.lifestyleScore),
      visualStage: (st.visualStage as any) || "average"
    }, {
      nutritionScore: Number(d.nutritionScore),
      trainingScore: Number(d.trainingScore),
      lifestyleScore: Number(d.lifestyleScore)
    });

    // Update avatar state
    await db.update(avatarState).set({
      weightLbs: next.weightLbs.toString(),
      bodyFatPct: next.bodyFatPct.toString(),
      muscleMassLbs: next.muscleMassLbs.toString(),
      energy: next.energy.toString(),
      mood: next.mood.toString(),
      lifestyleScore: next.lifestyleScore.toString(),
      visualStage: next.visualStage,
      lastSimDate: dateKey
    }).where(eq(avatarState.userId, userId));

    // Update day record with results
    await db.update(avatarDay).set({
      weightLbs: next.weightLbs.toString(),
      bodyFatPct: next.bodyFatPct.toString(),
      muscleMassLbs: next.muscleMassLbs.toString(),
      energy: next.energy.toString(),
      mood: next.mood.toString(),
      visualStage: next.visualStage
    }).where(and(eq(avatarDay.userId, userId), eq(avatarDay.dateKey, dateKey)));

    res.json({ state: next, dateKey });
  } catch (error) {
    console.error("Error ticking day:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get history (last N days)
router.get("/history", async (req, res) => {
  try {
    const userId = String(req.query.userId || "1");
    const limit = Number(req.query.limit || 30);
    
    const rows = await db.select().from(avatarDay)
      .where(eq(avatarDay.userId, userId))
      .orderBy(avatarDay.dateKey)
      .limit(limit);
    
    res.json({ days: rows });
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset avatar (dev/testing only)
router.post("/reset", async (req, res) => {
  try {
    const userId = String(req.body?.userId || "1");
    
    // Delete all day records
    await db.delete(avatarDay).where(eq(avatarDay.userId, userId));
    
    // Reset avatar state to defaults
    await db.update(avatarState).set({
      weightLbs: "185",
      bodyFatPct: "28",
      muscleMassLbs: "70",
      energy: "60",
      mood: "60",
      lifestyleScore: "60",
      visualStage: "average",
      lastSimDate: ""
    }).where(eq(avatarState.userId, userId));
    
    res.json({ ok: true });
  } catch (error) {
    console.error("Error resetting avatar:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;