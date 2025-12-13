import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { and, eq, gte, desc } from "drizzle-orm";
import { mealLogsEnhanced } from "@shared/schema"; // Using your actual table

const router = Router();

// Dev convenience: allow the known dev user without auth
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

const ParamsSchema = z.object({
  userId: z.string().min(1),
});
const QuerySchema = z.object({
  days: z
    .string()
    .transform((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : 30;
    })
    .optional(),
});

router.get("/api/users/:userId/alcohol-logs", async (req: any, res) => {
  try {
    // --- Validate params & query
    const p = ParamsSchema.safeParse(req.params);
    const q = QuerySchema.safeParse(req.query);
    if (!p.success) return res.status(400).json({ error: "ValidationError", issues: p.error.issues });
    if (!q.success) return res.status(400).json({ error: "ValidationError", issues: q.error.issues });

    const userId = p.data.userId;
    const days = q.data.days ?? 30;

    // --- Compute since date
    const since = new Date();
    since.setDate(since.getDate() - days);

    // --- Query your mealLogsEnhanced table (using your exact column names)
    const rows = await db
      .select()
      .from(mealLogsEnhanced)
      .where(
        and(
          eq(mealLogsEnhanced.userId, userId),
          eq(mealLogsEnhanced.source, "alcohol"), // Your schema uses 'source' column
          gte(mealLogsEnhanced.date, since.toISOString().split('T')[0]) // Your schema uses 'date' (date type)
        )
      )
      .orderBy(desc(mealLogsEnhanced.date));

    // --- Transform rows -> events (using your exact column names)
    const events = rows.map((row: any) => {
      // Your date is already YYYY-MM-DD format
      const dateStr = typeof row.date === 'string' ? row.date : row.date.toISOString().split('T')[0];
      
      // Get servings and calories from your schema
      const servings = Number(row.servings ?? 1) || 1;
      const calories = Number(row.calories ?? 0) || 0;

      return {
        id: row.id,
        date: dateStr,
        label: row.customName || "Alcohol",
        amount_oz: servings, // Use servings as amount_oz
        kcal: calories,
        notes: ""
      };
    });

    // --- Aggregate daily summaries
    const dailyMap = new Map<string, { date: string; drinks: number; kcal: number; carbs: number }>();
    for (const e of events) {
      const key = e.date;
      if (!dailyMap.has(key)) {
        dailyMap.set(key, { date: key, drinks: 0, kcal: 0, carbs: 0 });
      }
      const day = dailyMap.get(key)!;
      day.drinks += 1;
      day.kcal += e.kcal;
      day.carbs += 0; // Your schema has carbs column if needed later
    }
    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    console.log(`✅ Fetched ${events.length} alcohol logs for user ${userId} (${days} days)`);
    return res.json({ events, daily });
  } catch (err: any) {
    // Never leak stack traces
    console.error("❌ Failed to fetch alcohol logs:", err);
    return res.status(500).json({ 
      error: "Failed to fetch alcohol logs",
      message: "Database query failed"
    });
  }
});

export default router;