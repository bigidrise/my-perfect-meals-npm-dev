/**
 * Clinical Interventions API
 *
 * Provider-facing routes for setting and reading active clinical interventions
 * per patient. These interventions are loaded by the Protocol Envelope on every
 * generation call, so they automatically affect every generator.
 *
 * All routes require the caller to be an authenticated provider with an active
 * studio that the target client belongs to.
 */

import { Router } from "express";
import { db } from "../db";
import { providerClinicalInterventions } from "../db/schema/providerInterventions";
import { studioMemberships, studios } from "../db/schema/studio";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ── Validation schemas ────────────────────────────────────────────────────────
const CONDITION_KEYS = [
  "nausea", "vomiting", "constipation", "diarrhea", "early_fullness",
  "poor_appetite", "poor_hydration", "low_protein", "low_calorie",
  "muscle_preservation_risk", "fatigue", "food_aversion",
  "rapid_weight_loss", "glucose_concerns", "reflux",
  "transitioning_off_medication",
] as const;

const SEVERITY_VALUES = ["none", "mild", "moderate", "severe"] as const;

const upsertSchema = z.object({
  conditionKey: z.enum(CONDITION_KEYS),
  severity:     z.enum(SEVERITY_VALUES),
  notes:        z.string().max(2000).optional().nullable(),
});

// ── Helper: verify provider owns a studio that has this client ────────────────
async function getProviderStudio(providerUserId: string, clientUserId: string) {
  const [studio] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.ownerUserId, providerUserId))
    .limit(1);

  if (!studio) return null;

  const [membership] = await db
    .select({ id: studioMemberships.id })
    .from(studioMemberships)
    .where(
      and(
        eq(studioMemberships.studioId, studio.id),
        eq(studioMemberships.clientUserId, clientUserId)
      )
    )
    .limit(1);

  if (!membership) return null;
  return studio;
}

// ── GET /api/pro/clients/:clientId/interventions ──────────────────────────────
// Returns all active interventions for a patient.
router.get("/pro/clients/:clientId/interventions", requireAuth, async (req, res) => {
  const { clientId } = req.params;
  const providerUserId = (req as AuthenticatedRequest).authUser?.id;
  if (!providerUserId) return res.status(401).json({ error: "Unauthorized" });

  const studio = await getProviderStudio(providerUserId, clientId);
  if (!studio) return res.status(403).json({ error: "No provider relationship with this client" });

  const interventions = await db
    .select()
    .from(providerClinicalInterventions)
    .where(
      and(
        eq(providerClinicalInterventions.clientUserId, clientId),
        eq(providerClinicalInterventions.isActive, true)
      )
    );

  return res.json({ interventions });
});

// ── PUT /api/pro/clients/:clientId/interventions ──────────────────────────────
// Upsert a single intervention. If severity is "none", deactivates it.
// Only one active row per (clientUserId, conditionKey) is allowed.
router.put("/pro/clients/:clientId/interventions", requireAuth, async (req, res) => {
  const { clientId } = req.params;
  const providerUserId = (req as AuthenticatedRequest).authUser?.id;
  if (!providerUserId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });

  const studio = await getProviderStudio(providerUserId, clientId);
  if (!studio) return res.status(403).json({ error: "No provider relationship with this client" });

  const { conditionKey, severity, notes } = parsed.data;

  // Deactivate if severity is "none"
  if (severity === "none") {
    await db
      .update(providerClinicalInterventions)
      .set({ isActive: false, resolvedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(providerClinicalInterventions.clientUserId, clientId),
          eq(providerClinicalInterventions.conditionKey, conditionKey),
          eq(providerClinicalInterventions.isActive, true)
        )
      );
    return res.json({ ok: true, action: "deactivated" });
  }

  // Deactivate any existing active row for this condition, then insert new one
  await db
    .update(providerClinicalInterventions)
    .set({ isActive: false, resolvedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(providerClinicalInterventions.clientUserId, clientId),
        eq(providerClinicalInterventions.conditionKey, conditionKey),
        eq(providerClinicalInterventions.isActive, true)
      )
    );

  const escalationFlag =
    (conditionKey === "vomiting" || conditionKey === "rapid_weight_loss" || conditionKey === "glucose_concerns") &&
    severity === "severe";

  const [inserted] = await db
    .insert(providerClinicalInterventions)
    .values({
      studioId:       studio.id,
      clientUserId:   clientId,
      providerUserId,
      conditionKey,
      severity,
      notes:          notes ?? null,
      isActive:       true,
      escalationFlag,
    })
    .returning();

  return res.json({ ok: true, action: "upserted", intervention: inserted });
});

// ── DELETE /api/pro/clients/:clientId/interventions/:conditionKey ─────────────
// Explicitly deactivate a single condition.
router.delete("/pro/clients/:clientId/interventions/:conditionKey", requireAuth, async (req, res) => {
  const { clientId, conditionKey } = req.params;
  const providerUserId = (req as any).user?.id;
  if (!providerUserId) return res.status(401).json({ error: "Unauthorized" });

  const studio = await getProviderStudio(providerUserId, clientId);
  if (!studio) return res.status(403).json({ error: "No provider relationship with this client" });

  await db
    .update(providerClinicalInterventions)
    .set({ isActive: false, resolvedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(providerClinicalInterventions.clientUserId, clientId),
        eq(providerClinicalInterventions.conditionKey, conditionKey as any),
        eq(providerClinicalInterventions.isActive, true)
      )
    );

  return res.json({ ok: true });
});

// ── GET /api/pro/clients/:clientId/interventions/summary ─────────────────────
// Patient-facing: returns active interventions in a safe, non-clinical format.
router.get("/pro/clients/:clientId/interventions/summary", requireAuth, async (req, res) => {
  const { clientId } = req.params;
  const requestingUserId = (req as any).user?.id;
  if (!requestingUserId) return res.status(401).json({ error: "Unauthorized" });

  // Only the patient themselves can access their own summary
  if (requestingUserId !== clientId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const interventions = await db
    .select({
      conditionKey: providerClinicalInterventions.conditionKey,
      severity:     providerClinicalInterventions.severity,
    })
    .from(providerClinicalInterventions)
    .where(
      and(
        eq(providerClinicalInterventions.clientUserId, clientId),
        eq(providerClinicalInterventions.isActive, true)
      )
    );

  return res.json({ interventions });
});

export default router;
