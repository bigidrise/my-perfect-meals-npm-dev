import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { glucoseLogs } from "../../shared/diabetes-schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";

const router = Router();

const createGlucoseLogSchema = z.object({
  valueMgdl: z.number().positive(),
  context: z.enum(["FASTED", "PRE_MEAL", "POST_MEAL_1H", "POST_MEAL_2H", "RANDOM"]),
  relatedMealId: z.string().optional(),
  insulinUnits: z.number().optional(),
  notes: z.string().optional(),
});

// GET /api/users/:userId/glucose-logs
router.get("/api/users/:userId/glucose-logs", async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const conditions = [eq(glucoseLogs.userId, userId)];
    
    if (startDate) {
      conditions.push(gte(glucoseLogs.recordedAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(glucoseLogs.recordedAt, new Date(endDate as string)));
    }

    const logs = await db.select()
      .from(glucoseLogs)
      .where(and(...conditions))
      .orderBy(desc(glucoseLogs.recordedAt));

    res.json(logs);
  } catch (error) {
    console.error("Error fetching glucose logs:", error);
    res.status(500).json({ error: "Failed to fetch glucose logs" });
  }
});

// GET /api/users/:userId/glucose-logs/latest
router.get("/api/users/:userId/glucose-logs/latest", async (req, res) => {
  try {
    const { userId } = req.params;

    const [latestLog] = await db.select()
      .from(glucoseLogs)
      .where(eq(glucoseLogs.userId, userId))
      .orderBy(desc(glucoseLogs.recordedAt))
      .limit(1);

    if (!latestLog) {
      return res.status(404).json({ error: "No glucose readings found" });
    }

    res.json(latestLog);
  } catch (error) {
    console.error("Error fetching latest glucose log:", error);
    res.status(500).json({ error: "Failed to fetch latest glucose log" });
  }
});

// POST /api/users/:userId/glucose-logs
router.post("/api/users/:userId/glucose-logs", async (req, res) => {
  try {
    const { userId } = req.params;
    const data = createGlucoseLogSchema.parse(req.body);

    const [newLog] = await db.insert(glucoseLogs).values({
      userId,
      valueMgdl: data.valueMgdl,
      context: data.context,
      relatedMealId: data.relatedMealId,
      insulinUnits: data.insulinUnits?.toString(),
      notes: data.notes,
      recordedAt: new Date(),
    }).returning();

    res.json(newLog);
  } catch (error) {
    console.error("Error creating glucose log:", error);
    res.status(400).json({ error: "Failed to create glucose log" });
  }
});

export default router;
