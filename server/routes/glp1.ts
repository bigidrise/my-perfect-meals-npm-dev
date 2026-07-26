import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { GLP1GuardrailsZ, DEFAULT_GLP1_GUARDRAILS } from "../../shared/glp1-schema";
import { glp1AuditLog } from "../db/schema";
import crypto from "crypto";
import { enforceAssignedBuilder } from "../middleware/studioAccess";
import { resolveDailyMedicationTolerance } from "../services/glp1/resolveDailyMedicationTolerance";

const router = Router();

// Studio clients must be assigned to the GLP-1 builder to access these routes
router.use(enforceAssignedBuilder(["glp1"]));

// GET /api/glp1/profile
router.get("/profile", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = req.user.id;

    const result = await db.execute(
      sql`SELECT guardrails FROM glp1_profile WHERE user_id = ${userId}`
    );

    const profile = result.rows?.[0] as { guardrails?: unknown } | undefined;

    if (!profile) {
      return res.json({ guardrails: DEFAULT_GLP1_GUARDRAILS });
    }

    res.json({ guardrails: profile.guardrails ?? DEFAULT_GLP1_GUARDRAILS });
  } catch (error) {
    console.error("Error fetching GLP-1 profile:", error);
    res.status(500).json({ error: "Failed to fetch GLP-1 profile" });
  }
});

// PUT /api/glp1/profile
router.put("/profile", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = req.user.id;
    const { guardrails } = req.body;

    const validated = GLP1GuardrailsZ.parse(guardrails);

    // Fetch existing values for audit trail
    const existingResult = await db.execute(
      sql`SELECT guardrails FROM glp1_profile WHERE user_id = ${userId}`
    );
    const existing = existingResult.rows?.[0] as { guardrails?: unknown } | undefined;

    await db.execute(
      sql`
        INSERT INTO glp1_profile (user_id, guardrails, updated_at)
        VALUES (${userId}, ${JSON.stringify(validated)}, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET guardrails = ${JSON.stringify(validated)}, updated_at = NOW()
      `
    );

    // Log the change
    await db.insert(glp1AuditLog).values({
      id: crypto.randomUUID(),
      userId,
      clinicianId: null,
      action: "update_guardrails",
      previousValues: existing?.guardrails ?? null,
      newValues: validated,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Error saving GLP-1 profile:", error);
    res.status(400).json({ error: "Failed to save GLP-1 profile" });
  }
});

// GET /api/glp1/daily-tolerance
// Resolves today's GLP-1 tolerance state from ace_daily_checkins + water_logs,
// caches the result to glp1_profile for fast reads by other surfaces,
// and returns the resolved DailyMedicationTolerance.
router.get("/daily-tolerance", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = String(req.user.id);
    const today = new Date().toISOString().slice(0, 10);

    const tolerance = await resolveDailyMedicationTolerance({ userId, dateStr: today });

    // Cache resolved tolerance in glp1_profile so the protocol envelope and
    // surfaces can read it on next request without re-resolving.
    try {
      await db.execute(
        sql`
          INSERT INTO glp1_profile (
            user_id,
            tolerance_date,
            nausea_level,
            has_vomiting,
            hydration_risk,
            has_reflux,
            has_diarrhea,
            has_constipation,
            appetite_level,
            should_escalate,
            escalation_reason,
            water_ml_logged,
            tolerance_rules_fired,
            updated_at
          )
          VALUES (
            ${userId},
            ${today}::date,
            ${tolerance.nauseaLevel},
            ${tolerance.hasVomiting},
            ${tolerance.hydrationRisk},
            ${tolerance.hasReflux},
            ${tolerance.hasDiarrhea},
            ${tolerance.hasConstipation},
            ${tolerance.appetiteLevel},
            ${tolerance.shouldEscalate},
            ${tolerance.escalationReason},
            ${tolerance.waterMlLogged},
            ${tolerance.rulesFired},
            NOW()
          )
          ON CONFLICT (user_id) DO UPDATE SET
            tolerance_date      = EXCLUDED.tolerance_date,
            nausea_level        = EXCLUDED.nausea_level,
            has_vomiting        = EXCLUDED.has_vomiting,
            hydration_risk      = EXCLUDED.hydration_risk,
            has_reflux          = EXCLUDED.has_reflux,
            has_diarrhea        = EXCLUDED.has_diarrhea,
            has_constipation    = EXCLUDED.has_constipation,
            appetite_level      = EXCLUDED.appetite_level,
            should_escalate     = EXCLUDED.should_escalate,
            escalation_reason   = EXCLUDED.escalation_reason,
            water_ml_logged     = EXCLUDED.water_ml_logged,
            tolerance_rules_fired = EXCLUDED.tolerance_rules_fired,
            updated_at          = NOW()
        `
      );
    } catch (cacheErr) {
      console.warn("[GET /glp1/daily-tolerance] Cache write failed (non-fatal):", cacheErr);
    }

    return res.json({ tolerance });
  } catch (error) {
    console.error("Error resolving GLP-1 daily tolerance:", error);
    return res.status(500).json({ error: "Failed to resolve daily tolerance" });
  }
});

export default router;
