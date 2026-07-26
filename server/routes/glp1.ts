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
// Read-only. Resolves today's GLP-1 tolerance state from ace_daily_checkins +
// water_logs and returns the resolved DailyMedicationTolerance.
//
// This endpoint is IDEMPOTENT and SIDE-EFFECT-FREE.
// It does not write to the database. To persist a resolved snapshot, use
// POST /api/glp1/daily-tolerance (below), which writes to glp1_daily_tolerance.
router.get("/daily-tolerance", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = String(req.user.id);
    const today = new Date().toISOString().slice(0, 10);

    const tolerance = await resolveDailyMedicationTolerance({ userId, dateStr: today });
    return res.json({ tolerance });
  } catch (error) {
    console.error("[GET /glp1/daily-tolerance] Resolution error:", error);
    return res.status(500).json({ error: "Failed to resolve daily tolerance" });
  }
});

// POST /api/glp1/daily-tolerance
// Resolves today's tolerance state and persists it as a dated snapshot in
// glp1_daily_tolerance. Uses upsert on (user_id, tolerance_date) so re-running
// after a later check-in updates the existing row rather than creating duplicates.
//
// Designed to be called:
//   - After the user submits their daily check-in (ACE modal)
//   - After a shot-tracker entry (triggers check-in prompt)
//   - Proactively on first GLP-1 builder access each day
router.post("/daily-tolerance", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = String(req.user.id);
    const today = new Date().toISOString().slice(0, 10);

    const tolerance = await resolveDailyMedicationTolerance({ userId, dateStr: today });

    // Persist as a dated snapshot. UNIQUE(user_id, tolerance_date) ensures
    // re-resolving the same day updates rather than duplicates.
    await db.execute(
      sql`
        INSERT INTO glp1_daily_tolerance (
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
          rules_applied,
          rules_withheld,
          rules_evaluated,
          nutrition_adaptations,
          safety_escalations,
          resolver_version,
          resolved_at
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
          ${sql.raw(`ARRAY[${tolerance.rulesApplied.map(r => `'${r}'`).join(",")}]::text[]`)},
          ${sql.raw(`ARRAY[${tolerance.rulesWithheld.map(r => `'${r}'`).join(",")}]::text[]`)},
          ${sql.raw(`ARRAY[${tolerance.rulesEvaluated.map(r => `'${r}'`).join(",")}]::text[]`)},
          ${sql.raw(`ARRAY[${tolerance.nutritionAdaptations.map(s => `'${s.replace(/'/g, "''")}'`).join(",")}]::text[]`)},
          ${sql.raw(`ARRAY[${tolerance.safetyEscalations.map(s => `'${s.replace(/'/g, "''")}'`).join(",")}]::text[]`)},
          '1.0',
          NOW()
        )
        ON CONFLICT (user_id, tolerance_date) DO UPDATE SET
          nausea_level          = EXCLUDED.nausea_level,
          has_vomiting          = EXCLUDED.has_vomiting,
          hydration_risk        = EXCLUDED.hydration_risk,
          has_reflux            = EXCLUDED.has_reflux,
          has_diarrhea          = EXCLUDED.has_diarrhea,
          has_constipation      = EXCLUDED.has_constipation,
          appetite_level        = EXCLUDED.appetite_level,
          should_escalate       = EXCLUDED.should_escalate,
          escalation_reason     = EXCLUDED.escalation_reason,
          water_ml_logged       = EXCLUDED.water_ml_logged,
          rules_applied         = EXCLUDED.rules_applied,
          rules_withheld        = EXCLUDED.rules_withheld,
          rules_evaluated       = EXCLUDED.rules_evaluated,
          nutrition_adaptations = EXCLUDED.nutrition_adaptations,
          safety_escalations    = EXCLUDED.safety_escalations,
          resolver_version      = EXCLUDED.resolver_version,
          resolved_at           = NOW()
      `
    );

    return res.json({ ok: true, tolerance });
  } catch (error) {
    console.error("[POST /glp1/daily-tolerance] Persistence error:", error);
    return res.status(500).json({ error: "Failed to persist daily tolerance snapshot" });
  }
});

// GET /api/glp1/hub-checkin/today
// Returns the most recent hub check-in for today + the current resolved tolerance.
// Idempotent and side-effect-free — safe to call on page load.
router.get("/hub-checkin/today", async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    const userId = String(req.user.id);
    const today = new Date().toISOString().slice(0, 10);

    const rows = await db.execute(
      sql`
        SELECT id, submitted_at, check_in_date, source,
               nausea, constipation, diarrhea, reflux, bloating,
               early_fullness, food_aversions, fatigue, dizziness, headache,
               vomiting, can_keep_fluids_down, can_eat_without_worsening,
               reduced_urination, symptom_trend, symptoms_after_dose,
               appetite_level, medication_name, medication_class, notify_care_team
        FROM glp1_daily_checkins
        WHERE user_id = ${userId} AND check_in_date = ${today}::date
        ORDER BY submitted_at DESC
        LIMIT 1
      `
    );

    const checkin = rows.rows[0] ?? null;
    const tolerance = await resolveDailyMedicationTolerance({ userId, dateStr: today });
    return res.json({ checkin, tolerance });
  } catch (error) {
    console.error("[GET /glp1/hub-checkin/today]", error);
    return res.status(500).json({ error: "Failed to fetch today's check-in" });
  }
});

// POST /api/glp1/hub-checkin
// Validates structured symptom payload, persists to glp1_daily_checkins,
// calls the governed resolver, and returns the resolved tolerance.
// Zero clinical logic in this route — all classification is in the resolver.
router.post("/hub-checkin", async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    const userId = String(req.user.id);
    const today = new Date().toISOString().slice(0, 10);

    const { HubCheckinPayloadZ } = await import("../../shared/glp1-schema");
    const parse = HubCheckinPayloadZ.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: "Invalid check-in payload", details: parse.error.flatten() });
    }
    const p = parse.data;

    // Persist raw observation — multiple rows per day allowed (no unique constraint)
    const insertResult = await db.execute(
      sql`
        INSERT INTO glp1_daily_checkins (
          user_id, check_in_date, submitted_at, source,
          nausea, constipation, diarrhea, reflux, bloating,
          early_fullness, food_aversions, fatigue, dizziness, headache,
          vomiting, can_keep_fluids_down, can_eat_without_worsening,
          reduced_urination, symptom_trend, symptoms_after_dose,
          appetite_level, medication_name, medication_class, notify_care_team
        ) VALUES (
          ${userId}, ${today}::date, NOW(), 'hub',
          ${p.nausea}, ${p.constipation}, ${p.diarrhea}, ${p.reflux}, ${p.bloating},
          ${p.earlyFullness}, ${p.foodAversions}, ${p.fatigue}, ${p.dizziness}, ${p.headache},
          ${p.vomiting}, ${p.canKeepFluidsDown}, ${p.canEatWithoutWorsening},
          ${p.reducedUrination}, ${p.symptomTrend}, ${p.symptomsAfterDose},
          ${p.appetiteLevel}, ${p.medicationName ?? null}, ${p.medicationClass ?? null},
          ${p.notifyCareTeam}
        )
        RETURNING id, submitted_at
      `
    );

    const inserted = insertResult.rows[0] as { id: string; submitted_at: string } | undefined;

    // Re-resolve tolerance after the new check-in is persisted
    const tolerance = await resolveDailyMedicationTolerance({ userId, dateStr: today });

    // Also upsert the dated snapshot in glp1_daily_tolerance for audit/history
    await db.execute(
      sql`
        INSERT INTO glp1_daily_tolerance (
          user_id, tolerance_date, nausea_level, has_vomiting, hydration_risk,
          has_reflux, has_diarrhea, has_constipation, appetite_level,
          should_escalate, escalation_reason, water_ml_logged,
          rules_applied, rules_withheld, rules_evaluated,
          nutrition_adaptations, safety_escalations,
          resolver_version, resolved_at
        ) VALUES (
          ${userId}, ${today}::date,
          ${tolerance.nauseaLevel}, ${tolerance.hasVomiting}, ${tolerance.hydrationRisk},
          ${tolerance.hasReflux}, ${tolerance.hasDiarrhea}, ${tolerance.hasConstipation},
          ${tolerance.appetiteLevel}, ${tolerance.shouldEscalate}, ${tolerance.escalationReason},
          ${tolerance.waterMlLogged},
          ${sql.raw(`ARRAY[${tolerance.rulesApplied.map(r => `'${r}'`).join(",")}]::text[]`)},
          ${sql.raw(`ARRAY[${tolerance.rulesWithheld.map(r => `'${r}'`).join(",")}]::text[]`)},
          ${sql.raw(`ARRAY[${tolerance.rulesEvaluated.map(r => `'${r}'`).join(",")}]::text[]`)},
          ${sql.raw(`ARRAY[${tolerance.nutritionAdaptations.map(s => `'${s.replace(/'/g, "''")}'`).join(",")}]::text[]`)},
          ${sql.raw(`ARRAY[${tolerance.safetyEscalations.map(s => `'${s.replace(/'/g, "''")}'`).join(",")}]::text[]`)},
          '2.0', NOW()
        )
        ON CONFLICT (user_id, tolerance_date) DO UPDATE SET
          nausea_level          = EXCLUDED.nausea_level,
          has_vomiting          = EXCLUDED.has_vomiting,
          hydration_risk        = EXCLUDED.hydration_risk,
          has_reflux            = EXCLUDED.has_reflux,
          has_diarrhea          = EXCLUDED.has_diarrhea,
          has_constipation      = EXCLUDED.has_constipation,
          appetite_level        = EXCLUDED.appetite_level,
          should_escalate       = EXCLUDED.should_escalate,
          escalation_reason     = EXCLUDED.escalation_reason,
          water_ml_logged       = EXCLUDED.water_ml_logged,
          rules_applied         = EXCLUDED.rules_applied,
          rules_withheld        = EXCLUDED.rules_withheld,
          rules_evaluated       = EXCLUDED.rules_evaluated,
          nutrition_adaptations = EXCLUDED.nutrition_adaptations,
          safety_escalations    = EXCLUDED.safety_escalations,
          resolver_version      = EXCLUDED.resolver_version,
          resolved_at           = NOW()
      `
    );

    return res.json({
      ok: true,
      checkinId: inserted?.id ?? null,
      tolerance,
    });
  } catch (error) {
    console.error("[POST /glp1/hub-checkin]", error);
    return res.status(500).json({ error: "Failed to save check-in" });
  }
});

export default router;
