// server/routes/manualMacros.ts
import express from "express";
import { db } from "../db";
import { macroLogs, users } from "../../shared/schema";
import { and, gte, lte, eq, sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { getAuthUserId } from "../utils/getAuthUserId";
import { careTeamMember } from "../db/schema/careTeam";
import { clientLinks } from "../db/schema/procare";
import { pushToUser, pushToCoachOfClient } from "../services/pushNotify";
import { getUserCompliance } from "../services/complianceEngine";
import { macroProgramHistory } from "../../shared/schema";

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
router.post("/macros/log", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const deviceId = req.get("x-device-id") || "missing";
    const {
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
      fiber: (Number(nutrition?.fiber_g ?? req.body?.fiber) || 0).toString(),
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
router.post("/users/:userId/macros/quick", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
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
router.get("/users/:userId/macro-logs/summary", requireAuth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const hasAccess = await assertSelfOrProAccess(req as AuthenticatedRequest, targetUserId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied." });

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
          eq(macroLogs.userId, targetUserId),
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
router.get("/users/:userId/macros", requireAuth, async (req, res) => {
  try {
    const requesterId = getAuthUserId(req);
    const targetUserId = req.params.userId;
    const start = req.query.start ? new Date(String(req.query.start)) : null;
    const end = req.query.end ? new Date(String(req.query.end)) : null;
    if (!start || !end)
      return res.status(400).json({ error: "start & end required (ISO)." });

    // Allow access if requester is the user themselves, or a linked pro
    if (requesterId !== targetUserId) {
      const link = await db
        .select({ id: clientLinks.id })
        .from(clientLinks)
        .where(
          and(
            eq(clientLinks.clientUserId, targetUserId),
            eq(clientLinks.proUserId, requesterId),
            eq(clientLinks.active, true),
          ),
        )
        .limit(1);
      if (!link.length) {
        return res.status(403).json({ error: "Access denied." });
      }
    }

    // Query all logs in the time range for the target user
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
          eq(macroLogs.userId, targetUserId),
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
router.get("/users/:userId/macro-logs/daily", requireAuth, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const hasAccess = await assertSelfOrProAccess(req as AuthenticatedRequest, targetUserId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied." });

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
      WHERE ${macroLogs.userId} = ${targetUserId}
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

async function assertSelfOrProAccess(req: AuthenticatedRequest, targetUserId: string): Promise<boolean> {
  const authUser = req.authUser;
  if (!authUser) return false;
  if (authUser.id === targetUserId) return true;
  const [ctm] = await db
    .select({ id: careTeamMember.id })
    .from(careTeamMember)
    .where(
      and(
        eq(careTeamMember.userId, targetUserId),
        eq(careTeamMember.proUserId, authUser.id),
        eq(careTeamMember.status, "active")
      )
    )
    .limit(1);
  if (ctm) return true;
  const [link] = await db
    .select({ id: clientLinks.id })
    .from(clientLinks)
    .where(
      and(
        eq(clientLinks.clientUserId, targetUserId),
        eq(clientLinks.proUserId, authUser.id),
        eq(clientLinks.active, true)
      )
    )
    .limit(1);
  return !!link;
}

// GET /api/users/:userId/macro-targets - Get user's macro targets from database
router.get("/users/:userId/macro-targets", requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const hasAccess = await assertSelfOrProAccess(req as AuthenticatedRequest, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const [user] = await db
      .select({
        dailyCalorieTarget: users.dailyCalorieTarget,
        dailyProteinTarget: users.dailyProteinTarget,
        dailyCarbsTarget: users.dailyCarbsTarget,
        dailyFatTarget: users.dailyFatTarget,
        dailyStarchyCarbsTarget: users.dailyStarchyCarbsTarget,
        dailyFibrousCarbsTarget: users.dailyFibrousCarbsTarget,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      calories: user.dailyCalorieTarget || 0,
      protein_g: user.dailyProteinTarget || 0,
      carbs_g: user.dailyCarbsTarget || 0,
      fat_g: user.dailyFatTarget || 0,
      starchyCarbs_g: user.dailyStarchyCarbsTarget || 0,
      fibrousCarbs_g: user.dailyFibrousCarbsTarget || 0,
      hasTargets: !!(
        user.dailyCalorieTarget ||
        user.dailyProteinTarget ||
        user.dailyCarbsTarget ||
        user.dailyFatTarget
      ),
    });
  } catch (e: any) {
    console.error("get macro targets error:", e);
    res.status(500).json({ error: e.message || "Failed to get macro targets" });
  }
});

// POST /api/users/:userId/macro-targets - Save user's macro targets
router.post("/users/:userId/macro-targets", requireAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const hasAccess = await assertSelfOrProAccess(req as AuthenticatedRequest, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { calories, protein_g, carbs_g, fat_g, starchyCarbs_g, fibrousCarbs_g, reason } = req.body;

    if (typeof calories !== 'number' || typeof protein_g !== 'number' || 
        typeof carbs_g !== 'number' || typeof fat_g !== 'number') {
      return res.status(400).json({ error: "All macro values must be numbers" });
    }

    const authUserId = (req as AuthenticatedRequest).authUser?.id ?? null;

    const updatedUser = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(users)
        .set({
          dailyCalorieTarget: calories,
          dailyProteinTarget: protein_g,
          dailyCarbsTarget: carbs_g,
          dailyFatTarget: fat_g,
          dailyStarchyCarbsTarget: typeof starchyCarbs_g === 'number' ? starchyCarbs_g : null,
          dailyFibrousCarbsTarget: typeof fibrousCarbs_g === 'number' ? fibrousCarbs_g : null,
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updated) return null;

      await tx.insert(macroProgramHistory).values({
        clientUserId: userId,
        coachUserId: authUserId,
        calories,
        proteinG: protein_g,
        carbsG: carbs_g,
        fatG: fat_g,
        reason: typeof reason === "string" ? reason : null,
      });

      return updated;
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`✅ Saved macro targets for user ${userId}: ${calories}cal, ${protein_g}p/${carbs_g}c/${fat_g}f (starchy:${starchyCarbs_g ?? '-'} fibrous:${fibrousCarbs_g ?? '-'})`);

    if (authUserId && authUserId !== userId) {
      pushToUser(userId, {
        title: "Your coach updated your targets",
        body: `New macro targets: ${calories} cal, ${protein_g}g protein.`,
        url: "/my-biometrics",
      });
    }

    res.json({ 
      ok: true, 
      targets: {
        calories,
        protein_g,
        carbs_g,
        fat_g,
        starchyCarbs_g: starchyCarbs_g ?? null,
        fibrousCarbs_g: fibrousCarbs_g ?? null,
      }
    });
  } catch (e: any) {
    console.error("save macro targets error:", e);
    res.status(500).json({ error: e.message || "Failed to save macro targets" });
  }
});

// POST /api/users/:userId/macros/daily-summary
// Upserts a locked-day summary row into macro_logs.
// If userId !== auth user, enforces ProCare access via careTeamMember or clientLinks.
router.post("/users/:userId/macros/daily-summary", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const targetUserId = req.params.userId;
    const authUserId = authReq.authUser.id;

    if (targetUserId !== authUserId) {
      const [teamRow] = await db
        .select()
        .from(careTeamMember)
        .where(
          and(
            eq(careTeamMember.userId, targetUserId),
            eq(careTeamMember.proUserId, authUserId),
          ),
        )
        .limit(1);

      if (!teamRow) {
        const [linkRow] = await db
          .select()
          .from(clientLinks)
          .where(
            and(
              eq(clientLinks.clientUserId, targetUserId),
              eq(clientLinks.proUserId, authUserId),
              eq(clientLinks.active, true),
            ),
          )
          .limit(1);

        if (!linkRow) {
          return res.status(403).json({ error: "No access to this client" });
        }
      }
    }

    const {
      dateISO,
      calories = 0,
      protein = 0,
      carbs = 0,
      fat = 0,
      starchyCarbs = 0,
      fibrousCarbs = 0,
      source = "locked-day",
    } = req.body ?? {};

    if (!dateISO) {
      return res.status(400).json({ error: "dateISO is required" });
    }

    const when = new Date(dateISO + "T12:00:00Z");
    if (isNaN(when.getTime())) {
      return res.status(400).json({ error: "Invalid dateISO" });
    }

    const resolvedKcal = typeof calories === "number" && calories > 0
      ? calories
      : Math.round(4 * Number(protein) + 4 * Number(carbs) + 9 * Number(fat));

    const [row] = await db.execute(sql`
      INSERT INTO macro_logs (user_id, at, source, kcal, protein, carbs, fat, fiber, alcohol, starchy_carbs, fibrous_carbs)
      VALUES (
        ${targetUserId},
        ${when},
        ${source},
        ${resolvedKcal.toString()},
        ${(Number(protein) || 0).toString()},
        ${(Number(carbs) || 0).toString()},
        ${(Number(fat) || 0).toString()},
        ${"0"},
        ${"0"},
        ${(Number(starchyCarbs) || 0).toString()},
        ${(Number(fibrousCarbs) || 0).toString()}
      )
      ON CONFLICT (user_id, source, (timezone('UTC', at)::date))
      DO UPDATE SET
        kcal = EXCLUDED.kcal,
        protein = EXCLUDED.protein,
        carbs = EXCLUDED.carbs,
        fat = EXCLUDED.fat,
        starchy_carbs = EXCLUDED.starchy_carbs,
        fibrous_carbs = EXCLUDED.fibrous_carbs,
        at = EXCLUDED.at
      RETURNING *
    `);

    console.log(`✅ Daily summary upserted for user ${targetUserId}: ${dateISO} (source=${source})`);
    res.json({ ok: true, row: row ?? null });
  } catch (e: any) {
    console.error("daily-summary upsert error:", e);
    res.status(400).json({ error: e.message || "Failed to upsert daily summary." });
  }
});

// GET /api/users/:userId/macro-logs/daily-with-source?start&end
// Returns per-day rows with locked-day priority for biometrics charts.
// If a locked-day row exists for a date, only that row is used; otherwise all sources are summed.
router.get("/users/:userId/macro-logs/daily-with-source", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = req.params.userId;
    const authUserId = authReq.authUser.id;

    if (userId !== authUserId) {
      const [teamRow] = await db
        .select()
        .from(careTeamMember)
        .where(
          and(
            eq(careTeamMember.userId, userId),
            eq(careTeamMember.proUserId, authUserId),
          ),
        )
        .limit(1);

      if (!teamRow) {
        const [linkRow] = await db
          .select()
          .from(clientLinks)
          .where(
            and(
              eq(clientLinks.clientUserId, userId),
              eq(clientLinks.proUserId, authUserId),
              eq(clientLinks.active, true),
            ),
          )
          .limit(1);

        if (!linkRow) {
          return res.status(403).json({ error: "No access to this client" });
        }
      }
    }

    const start = req.query.start ? new Date(String(req.query.start)) : null;
    const end = req.query.end ? new Date(String(req.query.end)) : null;
    if (!start || !end)
      return res.status(400).json({ error: "start & end required (ISO)." });

    const rows = await db.execute(sql`
      WITH day_data AS (
        SELECT
          (${macroLogs.at})::date AS date,
          ${macroLogs.source} AS source,
          SUM(${macroLogs.kcal})::int AS kcal,
          SUM(${macroLogs.protein})::int AS protein,
          SUM(${macroLogs.carbs})::int AS carbs,
          SUM(${macroLogs.fat})::int AS fat,
          SUM(${macroLogs.starchyCarbs})::int AS "starchyCarbs",
          SUM(${macroLogs.fibrousCarbs})::int AS "fibrousCarbs"
        FROM ${macroLogs}
        WHERE ${macroLogs.userId} = ${userId}
          AND ${macroLogs.at} >= ${start}
          AND ${macroLogs.at} <= ${end}
        GROUP BY 1, 2
      ),
      locked_dates AS (
        SELECT DISTINCT date FROM day_data WHERE source = 'locked-day'
      )
      SELECT
        d.date,
        SUM(d.kcal)::int AS kcal,
        SUM(d.protein)::int AS protein,
        SUM(d.carbs)::int AS carbs,
        SUM(d.fat)::int AS fat,
        SUM(d."starchyCarbs")::int AS "starchyCarbs",
        SUM(d."fibrousCarbs")::int AS "fibrousCarbs",
        BOOL_OR(d.source = 'locked-day') AS "hasLockedDay"
      FROM day_data d
      WHERE
        (d.date IN (SELECT date FROM locked_dates) AND d.source = 'locked-day')
        OR
        (d.date NOT IN (SELECT date FROM locked_dates))
      GROUP BY d.date
      ORDER BY d.date ASC
    `);

    res.json(rows.rows);
  } catch (e: any) {
    console.error("daily-with-source error:", e);
    res.status(400).json({ error: e.message || "Failed to load daily." });
  }
});

router.get("/users/:userId/compliance", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = req.params.userId;
    const authUserId = authReq.authUser.id;

    if (userId !== authUserId) {
      const [teamRow] = await db
        .select()
        .from(careTeamMember)
        .where(
          and(
            eq(careTeamMember.userId, userId),
            eq(careTeamMember.proUserId, authUserId),
          ),
        )
        .limit(1);

      if (!teamRow) {
        const [linkRow] = await db
          .select()
          .from(clientLinks)
          .where(
            and(
              eq(clientLinks.clientUserId, userId),
              eq(clientLinks.proUserId, authUserId),
              eq(clientLinks.active, true),
            ),
          )
          .limit(1);

        if (!linkRow) {
          return res.status(403).json({ error: "No access to this client" });
        }
      }
    }

    const rawWindow = req.query.window ? parseInt(String(req.query.window), 10) : 7;
    const windowDays = Number.isFinite(rawWindow) ? rawWindow : 7;
    const result = await getUserCompliance(userId, windowDays);
    res.json(result);
  } catch (e: any) {
    console.error("compliance error:", e);
    res.status(500).json({ error: e.message || "Failed to compute compliance." });
  }
});

export default router;