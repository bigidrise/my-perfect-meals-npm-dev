// server/routes/manualMacros.ts
import express from "express";
import { db } from "../db";
import { macroLogs, users } from "../../shared/schema";
import { and, gte, lte, eq, sql } from "drizzle-orm";

const router = express.Router();

// util: parse incoming ISO with TZ to Date
function parseAt(at?: string): Date {
  const d = at ? new Date(at) : new Date();
  if (isNaN(d.getTime())) throw new Error("Invalid 'at' timestamp.");
  return d;
}
function kcalFrom(p = 0, c = 0, f = 0, alc = 0) {
  return 4 * p + 4 * c + 9 * f + 2 * alc;
}

// POST /api/macros/log - Legacy endpoint for backward compatibility
router.post("/macros/log", async (req, res) => {
  try {
    const deviceId = req.get("x-device-id") || "missing";
    const {
      userId = "00000000-0000-0000-0000-000000000001",
      loggedAt,
      mealType,
      kcal,
      protein,
      carbs,
      fat,
      source = "manual",
      mealId,
      starchyCarbs,
      fibrousCarbs,
      nutrition,
    } = req.body ?? {};

    // Extract values from nutrition object if present (new format)
    const proteinVal = nutrition?.protein_g ?? protein ?? 0;
    const carbsVal = nutrition?.carbs_g ?? carbs ?? 0;
    const fatVal = nutrition?.fat_g ?? fat ?? 0;
    const kcalVal = nutrition?.calories ?? kcal;
    
    // Starchy/fibrous carbs - use explicit values if provided
    const starchyCarbsVal = Number(starchyCarbs) || 0;
    const fibrousCarbsVal = Number(fibrousCarbs) || 0;

    // DEBUG: Log exactly what we're writing
    console.log("[MACROS/LOG] device=%s userId=%s protein=%s carbs=%s fat=%s starchy=%s fibrous=%s loggedAt=%s",
      deviceId, userId, proteinVal, carbsVal, fatVal, starchyCarbsVal, fibrousCarbsVal, loggedAt);

    const when = parseAt(loggedAt);
    const resolvedKcal = typeof kcalVal === "number" && kcalVal > 0 ? kcalVal : Math.round(kcalFrom(Number(proteinVal), Number(carbsVal), Number(fatVal)));

    const insertData = {
      userId,
      at: when,
      source: source || "manual",
      kcal: resolvedKcal.toString(),
      protein: (Number(proteinVal) || 0).toString(),
      carbs: (Number(carbsVal) || 0).toString(),
      fat: (Number(fatVal) || 0).toString(),
      fiber: "0",
      alcohol: "0",
      starchyCarbs: starchyCarbsVal.toString(),
      fibrousCarbs: fibrousCarbsVal.toString(),
    };

    const [row] = await db
      .insert(macroLogs)
      .values(insertData)
      .returning();

    res.json({ success: true, log: row });
  } catch (e: any) {
    console.error("macros/log error:", e);
    res.status(400).json({ error: e.message || "Failed to log macros." });
  }
});

// POST /api/users/:userId/macros/quick
router.post("/users/:userId/macros/quick", async (req, res) => {
  try {
    const userId = req.params.userId;
    const {
      at,
      protein = 0,
      carbs = 0,
      fat = 0,
      fiber = 0,
      alcohol = 0,
      starchyCarbs = 0,
      fibrousCarbs = 0,
      kcal,
    } = req.body ?? {};
    if ([protein, carbs, fat, fiber, alcohol, starchyCarbs, fibrousCarbs].some((v: any) => v < 0)) {
      return res.status(400).json({ error: "Macros cannot be negative." });
    }

    const when = parseAt(at); // local w/ offset → Date (UTC internally)
    const resolvedKcal =
      typeof kcal === "number" && kcal > 0
        ? kcal
        : Math.round(
            kcalFrom(
              Number(protein),
              Number(carbs),
              Number(fat),
              Number(alcohol),
            ),
          );

    const [row] = await db
      .insert(macroLogs)
      .values({
        userId,
        at: when, // drizzle pg withTimezone expects Date (UTC stored)
        source: "quick",
        kcal: resolvedKcal.toString(),
        protein: (Number(protein) || 0).toString(),
        carbs: (Number(carbs) || 0).toString(),
        fat: (Number(fat) || 0).toString(),
        fiber: (Number(fiber) || 0).toString(),
        alcohol: (Number(alcohol) || 0).toString(),
        starchyCarbs: (Number(starchyCarbs) || 0).toString(),
        fibrousCarbs: (Number(fibrousCarbs) || 0).toString(),
      })
      .returning();

    res.json({ ok: true, row });
  } catch (e: any) {
    console.error("quick add error:", e);
    res.status(400).json({ error: e.message || "Failed to add macros." });
  }
});

// GET /api/users/:userId/macro-logs/summary?start&end
router.get("/users/:userId/macro-logs/summary", async (req, res) => {
  try {
    const userId = req.params.userId;
    const start = req.query.start ? new Date(String(req.query.start)) : null;
    const end = req.query.end ? new Date(String(req.query.end)) : null;
    if (!start || !end)
      return res.status(400).json({ error: "start & end required (ISO)." });

    const rows = await db
      .select({
        kcal: sql<number>`COALESCE(SUM(${macroLogs.kcal}), 0)`,
        protein: sql<number>`COALESCE(SUM(${macroLogs.protein}), 0)`,
        carbs: sql<number>`COALESCE(SUM(${macroLogs.carbs}), 0)`,
        fat: sql<number>`COALESCE(SUM(${macroLogs.fat}), 0)`,
        fiber: sql<number>`COALESCE(SUM(${macroLogs.fiber}), 0)`,
        alcohol: sql<number>`COALESCE(SUM(${macroLogs.alcohol}), 0)`,
      })
      .from(macroLogs)
      .where(
        and(
          eq(macroLogs.userId, userId),
          gte(macroLogs.at, start),
          lte(macroLogs.at, end),
        ),
      );

    res.json(
      rows[0] || {
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        alcohol: 0,
      },
    );
  } catch (e: any) {
    console.error("summary error:", e);
    res.status(400).json({ error: e.message || "Failed to load summary." });
  }
});

// GET /api/users/:userId/macros?start&end - Returns totals with separated food and alcohol
router.get("/users/:userId/macros", async (req, res) => {
  try {
    const userId = req.params.userId;
    const start = req.query.start ? new Date(String(req.query.start)) : null;
    const end = req.query.end ? new Date(String(req.query.end)) : null;
    if (!start || !end)
      return res.status(400).json({ error: "start & end required (ISO)." });

    // Query all logs in the time range
    const rows = await db
      .select({
        kcal: sql<number>`COALESCE(SUM(${macroLogs.kcal}), 0)`,
        protein: sql<number>`COALESCE(SUM(${macroLogs.protein}), 0)`,
        carbs: sql<number>`COALESCE(SUM(${macroLogs.carbs}), 0)`,
        fat: sql<number>`COALESCE(SUM(${macroLogs.fat}), 0)`,
        fiber: sql<number>`COALESCE(SUM(${macroLogs.fiber}), 0)`,
        alcohol: sql<number>`COALESCE(SUM(${macroLogs.alcohol}), 0)`,
        starchyCarbs: sql<number>`COALESCE(SUM(${macroLogs.starchyCarbs}), 0)`,
        fibrousCarbs: sql<number>`COALESCE(SUM(${macroLogs.fibrousCarbs}), 0)`,
        // Separate food totals (exclude alcohol source)
        foodKcal: sql<number>`COALESCE(SUM(CASE WHEN ${macroLogs.source} != 'alcohol' THEN ${macroLogs.kcal} ELSE 0 END), 0)`,
        foodProtein: sql<number>`COALESCE(SUM(CASE WHEN ${macroLogs.source} != 'alcohol' THEN ${macroLogs.protein} ELSE 0 END), 0)`,
        foodCarbs: sql<number>`COALESCE(SUM(CASE WHEN ${macroLogs.source} != 'alcohol' THEN ${macroLogs.carbs} ELSE 0 END), 0)`,
        foodFat: sql<number>`COALESCE(SUM(CASE WHEN ${macroLogs.source} != 'alcohol' THEN ${macroLogs.fat} ELSE 0 END), 0)`,
        // Separate alcohol totals
        alcoholKcal: sql<number>`COALESCE(SUM(CASE WHEN ${macroLogs.source} = 'alcohol' THEN ${macroLogs.kcal} ELSE 0 END), 0)`,
        alcoholProtein: sql<number>`COALESCE(SUM(CASE WHEN ${macroLogs.source} = 'alcohol' THEN ${macroLogs.protein} ELSE 0 END), 0)`,
        alcoholCarbs: sql<number>`COALESCE(SUM(CASE WHEN ${macroLogs.source} = 'alcohol' THEN ${macroLogs.carbs} ELSE 0 END), 0)`,
        alcoholFat: sql<number>`COALESCE(SUM(CASE WHEN ${macroLogs.source} = 'alcohol' THEN ${macroLogs.fat} ELSE 0 END), 0)`,
      })
      .from(macroLogs)
      .where(
        and(
          eq(macroLogs.userId, userId),
          gte(macroLogs.at, start),
          lte(macroLogs.at, end),
        ),
      );

    const result = rows[0] || {
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      alcohol: 0,
      starchyCarbs: 0,
      fibrousCarbs: 0,
      foodKcal: 0,
      foodProtein: 0,
      foodCarbs: 0,
      foodFat: 0,
      alcoholKcal: 0,
      alcoholProtein: 0,
      alcoholCarbs: 0,
      alcoholFat: 0,
    };

    res.json({
      kcal: result.kcal,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      starchyCarbs: result.starchyCarbs,
      fibrousCarbs: result.fibrousCarbs,
      foodTotals: {
        kcal: result.foodKcal,
        protein: result.foodProtein,
        carbs: result.foodCarbs,
        fat: result.foodFat,
      },
      alcoholTotals: {
        kcal: result.alcoholKcal,
        protein: result.alcoholProtein,
        carbs: result.alcoholCarbs,
        fat: result.alcoholFat,
      },
    });
  } catch (e: any) {
    console.error("macros totals error:", e);
    res.status(400).json({ error: e.message || "Failed to load macros." });
  }
});

// GET /api/users/:userId/macro-logs/daily?start&end
router.get("/users/:userId/macro-logs/daily", async (req, res) => {
  try {
    const userId = req.params.userId;
    const start = req.query.start ? new Date(String(req.query.start)) : null;
    const end = req.query.end ? new Date(String(req.query.end)) : null;
    if (!start || !end)
      return res.status(400).json({ error: "start & end required (ISO)." });

    // Group by YYYY-MM-DD (UTC); if you prefer local-day bucketing, shift here
    const rows = await db.execute(sql/*sql*/ `
      SELECT
        DATE_TRUNC('day', ${macroLogs.at})::date AS date,
        COALESCE(SUM(${macroLogs.kcal}), 0)::int    AS kcal,
        COALESCE(SUM(${macroLogs.protein}), 0)::int AS protein,
        COALESCE(SUM(${macroLogs.carbs}), 0)::int   AS carbs,
        COALESCE(SUM(${macroLogs.fat}), 0)::int     AS fat,
        COALESCE(SUM(${macroLogs.fiber}), 0)::int   AS fiber,
        COALESCE(SUM(${macroLogs.alcohol}), 0)::int AS alcohol
      FROM ${macroLogs}
      WHERE ${macroLogs.userId} = ${userId}
        AND ${macroLogs.at} >= ${start}
        AND ${macroLogs.at} <= ${end}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    res.json(rows.rows);
  } catch (e: any) {
    console.error("daily error:", e);
    res.status(400).json({ error: e.message || "Failed to load daily." });
  }
});

// POST /api/users/:userId/macro-targets - Save user's macro targets
router.post("/users/:userId/macro-targets", async (req, res) => {
  try {
    const userId = req.params.userId;
    const { calories, protein_g, carbs_g, fat_g } = req.body;

    // Validate inputs
    if (typeof calories !== 'number' || typeof protein_g !== 'number' || 
        typeof carbs_g !== 'number' || typeof fat_g !== 'number') {
      return res.status(400).json({ error: "All macro values must be numbers" });
    }

    // Update user's macro targets
    const [updatedUser] = await db
      .update(users)
      .set({
        dailyCalorieTarget: calories,
        dailyProteinTarget: protein_g,
        dailyCarbsTarget: carbs_g,
        dailyFatTarget: fat_g,
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`✅ Saved macro targets for user ${userId}: ${calories}cal, ${protein_g}p/${carbs_g}c/${fat_g}f`);

    res.json({ 
      ok: true, 
      targets: {
        calories,
        protein_g,
        carbs_g,
        fat_g
      }
    });
  } catch (e: any) {
    console.error("save macro targets error:", e);
    res.status(500).json({ error: e.message || "Failed to save macro targets" });
  }
});

export default router;