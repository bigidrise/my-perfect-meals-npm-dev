import express from "express";
import { db } from "../db";
import { foodDiary, foods, insertFoodDiarySchema } from "../../shared/schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";

const router = express.Router();

router.post("/food-logs", async (req, res) => {
  try {
    const validation = insertFoodDiarySchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.issues 
      });
    }

    const [row] = await db.insert(foodDiary).values(validation.data).returning();
    console.log("[food-log][create]", { saved: row });
    
    res.json(row);
  } catch (e: any) {
    console.error("create food-log error", e);
    return res.status(500).json({ error: "Failed to create food log" });
  }
});

router.get("/food-logs", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId required" });

    const fromStr = (req.query.from as string) || null;
    const toStr = (req.query.to as string) || null;
    const limit = Math.min(Number(req.query.limit || 100), 200);

    const from = fromStr || "1970-01-01";
    const to = toStr || "2999-12-31";

    const whereParts: any[] = [
      eq(foodDiary.userId, userId),
      gte(foodDiary.dateLocal, from),
      lte(foodDiary.dateLocal, to)
    ];

    const rows = await db.select().from(foodDiary)
      .where(and(...whereParts))
      .orderBy(desc(foodDiary.dateLocal))
      .limit(limit);

    res.json({ items: rows });
  } catch (e: any) {
    console.error("get food-logs error", e);
    res.status(500).json({ error: "Failed to fetch food logs" });
  }
});

export default router;
