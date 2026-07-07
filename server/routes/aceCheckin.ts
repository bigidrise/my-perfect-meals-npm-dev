import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { computeTopInterventions } from "../services/ace/aceDecisionEngine";
import type { AceDailyCheckin, CoachingProfile, CoachingIntervention } from "../db/schema/ace";

const router = Router();

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseSmallint(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

const VALID_SCHEDULES = ["normal", "busy", "travel", "rest"] as const;

router.post("/", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser.id;
  const today = todayUTC();

  const energy = parseSmallint(req.body.energy);
  const stress = parseSmallint(req.body.stress);
  const sleep = parseSmallint(req.body.sleep);
  const mood = parseSmallint(req.body.mood);
  const cravings = parseSmallint(req.body.cravings);
  const hunger = parseSmallint(req.body.hunger);
  const digestion = parseSmallint(req.body.digestion);
  const soreness = parseSmallint(req.body.soreness);
  const motivation = parseSmallint(req.body.motivation);
  const emotionalEatingRisk = parseSmallint(req.body.emotional_eating_risk);

  const rawSchedule = req.body.schedule ?? null;
  const schedule =
    rawSchedule && VALID_SCHEDULES.includes(rawSchedule) ? rawSchedule : null;

  const symptoms: string[] = Array.isArray(req.body.symptoms)
    ? req.body.symptoms.filter((s: unknown) => typeof s === "string").slice(0, 20)
    : [];

  const freeText =
    typeof req.body.free_text === "string"
      ? req.body.free_text.slice(0, 1000)
      : null;

  try {
    await db.execute(sql`
      INSERT INTO ace_daily_checkins (
        user_id, date,
        energy, stress, sleep, mood, cravings, hunger, digestion, soreness,
        schedule, motivation, emotional_eating_risk, symptoms, free_text,
        updated_at
      ) VALUES (
        ${userId}, ${today},
        ${energy}, ${stress}, ${sleep}, ${mood}, ${cravings}, ${hunger}, ${digestion}, ${soreness},
        ${schedule}, ${motivation}, ${emotionalEatingRisk}, ${symptoms}, ${freeText},
        now()
      )
      ON CONFLICT (user_id, date) DO UPDATE SET
        energy = EXCLUDED.energy,
        stress = EXCLUDED.stress,
        sleep = EXCLUDED.sleep,
        mood = EXCLUDED.mood,
        cravings = EXCLUDED.cravings,
        hunger = EXCLUDED.hunger,
        digestion = EXCLUDED.digestion,
        soreness = EXCLUDED.soreness,
        schedule = EXCLUDED.schedule,
        motivation = EXCLUDED.motivation,
        emotional_eating_risk = EXCLUDED.emotional_eating_risk,
        symptoms = EXCLUDED.symptoms,
        free_text = EXCLUDED.free_text,
        updated_at = now()
    `);

    const checkinRow = await db.execute(
      sql`SELECT * FROM ace_daily_checkins WHERE user_id = ${userId} AND date = ${today} LIMIT 1`
    );
    const checkin = checkinRow.rows[0] as AceDailyCheckin;

    const profileRow = await db.execute(
      sql`SELECT * FROM coaching_profiles WHERE user_id = ${userId} LIMIT 1`
    );
    const profile = (profileRow.rows[0] as CoachingProfile) ?? null;

    const ivRows = await db.execute(
      sql`SELECT * FROM coaching_interventions WHERE is_active = true`
    );
    const interventions = ivRows.rows as CoachingIntervention[];

    const matched = computeTopInterventions(checkin, profile, interventions, 3);

    return res.json({ checkin, interventions: matched });
  } catch (err: any) {
    console.error("[ACE] POST /checkin error:", err.message);
    return res.status(500).json({ error: "Failed to save check-in" });
  }
});

router.get("/today", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser.id;
  const today = todayUTC();

  try {
    const checkinRow = await db.execute(
      sql`SELECT * FROM ace_daily_checkins WHERE user_id = ${userId} AND date = ${today} LIMIT 1`
    );

    if (checkinRow.rows.length === 0) {
      return res.json({ checkin: null, interventions: [] });
    }

    const checkin = checkinRow.rows[0] as AceDailyCheckin;

    const profileRow = await db.execute(
      sql`SELECT * FROM coaching_profiles WHERE user_id = ${userId} LIMIT 1`
    );
    const profile = (profileRow.rows[0] as CoachingProfile) ?? null;

    const ivRows = await db.execute(
      sql`SELECT * FROM coaching_interventions WHERE is_active = true`
    );
    const interventions = ivRows.rows as CoachingIntervention[];

    const matched = computeTopInterventions(checkin, profile, interventions, 3);

    return res.json({ checkin, interventions: matched });
  } catch (err: any) {
    console.error("[ACE] GET /checkin/today error:", err.message);
    return res.status(500).json({ error: "Failed to load today's check-in" });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser.id;
  const days = Math.min(Number(req.query.days ?? 7), 30);

  try {
    const result = await db.execute(
      sql`
        SELECT * FROM ace_daily_checkins
        WHERE user_id = ${userId}
          AND date >= (CURRENT_DATE - (${days} - 1) * INTERVAL '1 day')
        ORDER BY date DESC
      `
    );
    return res.json({ checkins: result.rows });
  } catch (err: any) {
    console.error("[ACE] GET /checkin/history error:", err.message);
    return res.status(500).json({ error: "Failed to load check-in history" });
  }
});

export default router;
