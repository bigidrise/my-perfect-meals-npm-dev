import express from "express";
import { db } from "../db";
import { mealLog, mealLogsEnhanced, insertMealLogSchema } from "../../shared/schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";

const router = express.Router();

const insertMealLogEnhancedSchema = createInsertSchema(mealLogsEnhanced).omit({
  id: true,
  createdAt: true,
});

router.post("/meal-logs", async (req, res) => {
  try {
    const validation = insertMealLogEnhancedSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.issues 
      });
    }

    const [row] = await db.insert(mealLogsEnhanced).values(validation.data).returning();
    console.log("[meal-log][create]", { saved: row });
    
    res.json(row);
  } catch (e: any) {
    console.error("create meal-log error", e);
    return res.status(500).json({ error: "Failed to create meal log" });
  }
});

router.get("/meal-logs", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId required" });

    const fromStr = (req.query.from as string) || null;
    const toStr = (req.query.to as string) || null;
    const limit = Math.min(Number(req.query.limit || 100), 200);

    const from = fromStr || "1970-01-01";
    const to = toStr || "2999-12-31";

    const whereParts: any[] = [
      eq(mealLogsEnhanced.userId, userId),
      gte(mealLogsEnhanced.date, from),
      lte(mealLogsEnhanced.date, to)
    ];

    const rows = await db.select().from(mealLogsEnhanced)
      .where(and(...whereParts))
      .orderBy(desc(mealLogsEnhanced.date))
      .limit(limit);

    res.json({ items: rows });
  } catch (e: any) {
    console.error("get meal-logs error", e);
    res.status(500).json({ error: "Failed to fetch meal logs" });
  }
});

export default router;
