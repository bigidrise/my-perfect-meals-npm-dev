import { Router } from "express";
import { db } from "../db";
import { diabetesProfile, glucoseLogs } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { enforceAssignedBuilder } from "../middleware/studioAccess";
import type { AuthenticatedRequest } from "../middleware/requireAuth";

export const diabetesRouter = Router();

// Studio clients must be assigned to the Diabetic builder to access these routes
diabetesRouter.use(enforceAssignedBuilder(["diabetic"]));

// GET /api/diabetes/profile
diabetesRouter.get("/profile", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;

    const profile = await db.query.diabetesProfile.findFirst({ where: (p, { eq }) => eq(p.userId, userId as string) });
    if (!profile) return res.status(404).json({ error: "profile_not_found" });

    res.json({ data: profile });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed_to_fetch_profile" });
  }
});

// PUT /api/diabetes/profile
// body: { type, medications?, hypoHistory?, a1cPercent?, guardrails? }
diabetesRouter.put("/profile", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { type, medications, hypoHistory, a1cPercent, guardrails } = req.body;
    if (!type) return res.status(400).json({ error: "type required" });

    const existing = await db.query.diabetesProfile.findFirst({ where: (p, { eq }) => eq(p.userId, userId as string) });
    if (existing) {
      await db.update(diabetesProfile)
        .set({ type, medications, hypoHistory, a1cPercent, guardrails, updatedAt: new Date() })
        .where(eq(diabetesProfile.userId, userId as string));
    } else {
      await db.insert(diabetesProfile).values({ userId: userId as string, type, medications, hypoHistory, a1cPercent, guardrails });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed_to_upsert_profile" });
  }
});

// GET /api/diabetes/glucose
diabetesRouter.get("/glucose", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { limit = "50" } = req.query;

    const logs = await db.query.glucoseLogs.findMany({
      where: (l, { eq }) => eq(l.userId, userId as string),
      orderBy: (l, { desc }) => [desc(l.recordedAt)],
      limit: parseInt(limit as string, 10),
    });

    res.json({ data: logs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed_to_fetch_glucose" });
  }
});

// POST /api/diabetes/glucose
// body: { valueMgdl, context, relatedMealId?, recordedAt?, insulinUnits?, notes? }
diabetesRouter.post("/glucose", async (req, res) => {
  try {
    console.log("[Diabetes] POST /glucose request received:", {
      body: req.body,
      headers: { contentType: req.headers["content-type"], deviceId: req.headers["x-device-id"] },
    });

    const userId = (req as AuthenticatedRequest).authUser.id;
    const { valueMgdl, context, relatedMealId, recordedAt, insulinUnits, notes } = req.body;

    if (!valueMgdl || !context) {
      console.log("[Diabetes] Missing fields:", { valueMgdl: !!valueMgdl, context: !!context });
      return res.status(400).json({ error: "missing_fields" });
    }
    if (valueMgdl < 20 || valueMgdl > 600) return res.status(422).json({ error: "value_out_of_range" });

    const row = await db.insert(glucoseLogs).values({
      userId: userId as string,
      valueMgdl,
      context,
      relatedMealId,
      recordedAt: recordedAt ? new Date(recordedAt) : undefined,
      insulinUnits,
      notes,
    }).returning();

    if (valueMgdl < 54) return res.status(201).json({ ok: true, row: row[0], alert: "LOW_CRITICAL" });
    if (valueMgdl > 400) return res.status(201).json({ ok: true, row: row[0], alert: "HIGH_CRITICAL" });

    res.status(201).json({ ok: true, row: row[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed_to_log_glucose" });
  }
});
