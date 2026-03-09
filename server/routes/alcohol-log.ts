import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { and, eq, gte, desc } from "drizzle-orm";
import { mealLogsEnhanced } from "@shared/schema";
import { requireAuth } from "../middleware/requireAuth";
import { getAuthUserId } from "../utils/getAuthUserId";

const router = Router();

const QuerySchema = z.object({
  days: z
    .string()
    .transform((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : 30;
    })
    .optional(),
});

router.get("/api/users/:userId/alcohol-logs", requireAuth, async (req: any, res) => {
  try {
    const userId = getAuthUserId(req);
    const q = QuerySchema.safeParse(req.query);
    if (!q.success) return res.status(400).json({ error: "ValidationError", issues: q.error.issues });

    const days = q.data.days ?? 30;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await db
      .select()
      .from(mealLogsEnhanced)
      .where(
        and(
          eq(mealLogsEnhanced.userId, userId),
          eq(mealLogsEnhanced.source, "alcohol"),
          gte(mealLogsEnhanced.date, since.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(mealLogsEnhanced.date));

    const events = rows.map((row: any) => {
      const dateStr = typeof row.date === 'string' ? row.date : row.date.toISOString().split('T')[0];
      const servings = Number(row.servings ?? 1) || 1;
      const calories = Number(row.calories ?? 0) || 0;

      return {
        id: row.id,
        date: dateStr,
        label: row.customName || "Alcohol",
        amount_oz: servings,
        kcal: calories,
        notes: ""
      };
    });

    const dailyMap = new Map<string, { date: string; drinks: number; kcal: number; carbs: number }>();
    for (const e of events) {
      const key = e.date;
      if (!dailyMap.has(key)) {
        dailyMap.set(key, { date: key, drinks: 0, kcal: 0, carbs: 0 });
      }
      const day = dailyMap.get(key)!;
      day.drinks += 1;
      day.kcal += e.kcal;
      day.carbs += 0;
    }
    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return res.json({ events, daily });
  } catch (err: any) {
    console.error("Failed to fetch alcohol logs:", err);
    return res.status(500).json({ 
      error: "Failed to fetch alcohol logs",
      message: "Database query failed"
    });
  }
});

export default router;
