import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { GLP1GuardrailsZ, DEFAULT_GLP1_GUARDRAILS } from "../../shared/glp1-schema";
import { glp1AuditLog } from "../db/schema";
import crypto from "crypto";

const router = Router();

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

export default router;
