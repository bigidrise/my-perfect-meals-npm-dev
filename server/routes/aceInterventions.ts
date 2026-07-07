import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const result = await db.execute(
      sql`SELECT * FROM coaching_interventions WHERE is_active = true ORDER BY severity DESC, key ASC`
    );
    return res.json({ interventions: result.rows });
  } catch (err: any) {
    console.error("[ACE] GET /interventions error:", err.message);
    return res.status(500).json({ error: "Failed to load interventions" });
  }
});

router.get("/:key", requireAuth, async (req, res) => {
  const { key } = req.params;
  try {
    const result = await db.execute(
      sql`SELECT * FROM coaching_interventions WHERE key = ${key} AND is_active = true LIMIT 1`
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Intervention not found" });
    }
    return res.json({ intervention: result.rows[0] });
  } catch (err: any) {
    console.error("[ACE] GET /interventions/:key error:", err.message);
    return res.status(500).json({ error: "Failed to load intervention" });
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const {
    key,
    situation,
    coaching_objective,
    strategies,
    avoid,
    evidence_tags,
    suggested_builders,
    severity,
  } = req.body;

  if (!key || !situation || !coaching_objective) {
    return res
      .status(400)
      .json({ error: "key, situation, and coaching_objective are required" });
  }

  const validSeverities = ["low", "moderate", "high", "crisis"];
  if (severity && !validSeverities.includes(severity)) {
    return res.status(400).json({ error: "Invalid severity value" });
  }

  try {
    const result = await db.execute(sql`
      INSERT INTO coaching_interventions
        (key, situation, coaching_objective, strategies, avoid, evidence_tags, suggested_builders, severity)
      VALUES (
        ${key},
        ${situation},
        ${coaching_objective},
        ${strategies ?? []},
        ${avoid ?? []},
        ${evidence_tags ?? []},
        ${suggested_builders ?? []},
        ${severity ?? "low"}
      )
      RETURNING *
    `);
    return res.status(201).json({ intervention: result.rows[0] });
  } catch (err: any) {
    if (err.message?.includes("unique") || err.code === "23505") {
      return res
        .status(409)
        .json({ error: "An intervention with this key already exists" });
    }
    console.error("[ACE] POST /interventions error:", err.message);
    return res.status(500).json({ error: "Failed to create intervention" });
  }
});

router.put("/:key", requireAuth, requireAdmin, async (req, res) => {
  const { key } = req.params;
  const {
    situation,
    coaching_objective,
    strategies,
    avoid,
    evidence_tags,
    suggested_builders,
    severity,
    is_active,
  } = req.body;

  const validSeverities = ["low", "moderate", "high", "crisis"];
  if (severity && !validSeverities.includes(severity)) {
    return res.status(400).json({ error: "Invalid severity value" });
  }

  try {
    const result = await db.execute(sql`
      UPDATE coaching_interventions SET
        situation         = COALESCE(${situation ?? null}, situation),
        coaching_objective = COALESCE(${coaching_objective ?? null}, coaching_objective),
        strategies        = COALESCE(${strategies ?? null}, strategies),
        avoid             = COALESCE(${avoid ?? null}, avoid),
        evidence_tags     = COALESCE(${evidence_tags ?? null}, evidence_tags),
        suggested_builders = COALESCE(${suggested_builders ?? null}, suggested_builders),
        severity          = COALESCE(${severity ?? null}, severity),
        is_active         = COALESCE(${is_active ?? null}, is_active),
        updated_at        = now()
      WHERE key = ${key}
      RETURNING *
    `);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Intervention not found" });
    }
    return res.json({ intervention: result.rows[0] });
  } catch (err: any) {
    console.error("[ACE] PUT /interventions/:key error:", err.message);
    return res.status(500).json({ error: "Failed to update intervention" });
  }
});

router.delete("/:key", requireAuth, requireAdmin, async (req, res) => {
  const { key } = req.params;
  try {
    const result = await db.execute(sql`
      UPDATE coaching_interventions SET is_active = false, updated_at = now()
      WHERE key = ${key}
      RETURNING key
    `);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Intervention not found" });
    }
    return res.json({ success: true, key });
  } catch (err: any) {
    console.error("[ACE] DELETE /interventions/:key error:", err.message);
    return res.status(500).json({ error: "Failed to deactivate intervention" });
  }
});

export default router;
