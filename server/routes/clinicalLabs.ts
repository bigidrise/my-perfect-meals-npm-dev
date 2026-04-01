import express from "express";
import { db } from "../db";
import { clinicalLabs } from "../db/schema/clinicalLabs";
import { clinicalProtocolRecommendations } from "../db/schema/clinicalProtocolRecommendations";
import { studioMemberships, studios } from "../db/schema/studio";
import { users } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getAuthUserId } from "../utils/getAuthUserId";
import { z } from "zod";
import { resolveProtocolFromLabs, labSignalToSubtitle } from "../services/resolveProtocolFromLabs";
import { verifyClinicalAccess } from "../utils/verifyClinicalAccess";

const router = express.Router();

/**
 * API CONTRACT — Clinical Labs
 *
 * Casing convention (LOCKED — do not deviate):
 *   Client  →  POST body / GET response: snake_case  (e.g. blood_pressure_systolic)
 *   Route   →  Drizzle insert/select:   camelCase   (e.g. bloodPressureSystolic)
 *   Database→  column names:            snake_case  (e.g. blood_pressure_systolic)
 *
 * Single-word fields (a1c, ldl, hdl, creatinine, bun, inr, alt, ast,
 * bilirubin, albumin) are identical in all three layers — no mapping needed.
 * Multi-word fields require explicit snake→camel mapping in the POST handler
 * and explicit camel→snake mapping in the GET response.
 *
 * Protocol precedence (must match clinicalModeResolver.ts exactly):
 *   liver-disease > kidney-disease > heart-failure > liver-support > base
 *
 * Future fields: follow this convention. Add to labsPayloadSchema,
 * the Drizzle schema, the POST insert, and the GET response shape.
 *
 * Authorization model:
 *   A requester may read or write clinical data for targetUserId only if:
 *   (a) requester IS the target user (self-access), OR
 *   (b) requester owns a studio that the target user is a member of
 *       (verified clinician-client relationship — see verifyClinicalAccess).
 *   Any other attempt returns 403.
 */

const labsPayloadSchema = z.object({
  userId: z.string().optional(),
  a1c: z.number().optional().nullable(),
  ldl: z.number().optional().nullable(),
  hdl: z.number().optional().nullable(),
  blood_pressure_systolic: z.number().optional().nullable(),
  blood_pressure_diastolic: z.number().optional().nullable(),
  ejection_fraction: z.number().optional().nullable(),
  creatinine: z.number().optional().nullable(),
  bun: z.number().optional().nullable(),
  inr: z.number().optional().nullable(),
  // Liver panel — single-word fields, identical across all three layers (no mapping needed)
  alt:       z.number().optional().nullable(),
  ast:       z.number().optional().nullable(),
  bilirubin: z.number().optional().nullable(),
  albumin:   z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  recorded_at: z.string().optional(),
  lab_date: z.string().optional().nullable(),
});

/** Check whether a physician has already explicitly assigned a builder to this user. */
async function getPhysicianLock(userId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ assignedBuilder: studioMemberships.assignedBuilder })
      .from(studioMemberships)
      .where(eq(studioMemberships.clientUserId, userId as any))
      .limit(1);

    return rows.length > 0 && !!rows[0].assignedBuilder;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// POST /api/biometrics/labs
// Save lab values → run resolver → return protocolSignal + physician lock info
// ---------------------------------------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  try {
    const requesterId = getAuthUserId(req);
    const body = labsPayloadSchema.parse(req.body);

    const targetUserId = body.userId || requesterId;

    // Security: verify the requester is allowed to write for this target user
    const hasAccess = await verifyClinicalAccess(requesterId as string, targetUserId as string);
    if (!hasAccess) {
      console.warn(`[clinicalLabs POST] UNAUTHORIZED: requester ${requesterId} attempted to write labs for user ${targetUserId}`);
      return res.status(403).json({ error: "You are not authorized to submit labs for this user" });
    }

    const inserted = await db
      .insert(clinicalLabs)
      .values({
        userId: targetUserId as any,
        recordedById: requesterId as any,
        a1c: body.a1c != null ? String(body.a1c) : null,
        ldl: body.ldl != null ? String(body.ldl) : null,
        hdl: body.hdl != null ? String(body.hdl) : null,
        bloodPressureSystolic: body.blood_pressure_systolic != null ? String(body.blood_pressure_systolic) : null,
        bloodPressureDiastolic: body.blood_pressure_diastolic != null ? String(body.blood_pressure_diastolic) : null,
        ejectionFraction: body.ejection_fraction != null ? String(body.ejection_fraction) : null,
        creatinine: body.creatinine != null ? String(body.creatinine) : null,
        bun: body.bun != null ? String(body.bun) : null,
        inr: body.inr != null ? String(body.inr) : null,
        alt:       body.alt       != null ? String(body.alt)       : null,
        ast:       body.ast       != null ? String(body.ast)       : null,
        bilirubin: body.bilirubin != null ? String(body.bilirubin) : null,
        albumin:   body.albumin   != null ? String(body.albumin)   : null,
        notes: body.notes || null,
        labDate: body.lab_date || new Date().toISOString().split("T")[0],
        recordedAt: body.recorded_at ? new Date(body.recorded_at) : new Date(),
      })
      .returning({ id: clinicalLabs.id });

    const labId = inserted[0]?.id ?? null;

    // Run protocol resolver on the just-saved values
    const protocolSignal = resolveProtocolFromLabs({
      alt:                   body.alt,
      ast:                   body.ast,
      bilirubin:             body.bilirubin,
      albumin:               body.albumin,
      creatinine:            body.creatinine,
      bun:                   body.bun,
      ldl:                   body.ldl,
      bloodPressureSystolic: body.blood_pressure_systolic,
      ejectionFraction:      body.ejection_fraction,
    });

    const [physicianLocked] = await Promise.all([
      getPhysicianLock(targetUserId as string),
    ]);

    res.status(201).json({
      success: true,
      labId,
      protocolSignal,
      protocolSubtitle: labSignalToSubtitle(protocolSignal),
      physicianLocked,
    });
  } catch (error: any) {
    console.error("[clinicalLabs POST]", error);
    res.status(400).json({ error: "Failed to save labs", detail: error?.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/biometrics/labs/recommendation
// Record the user's accept / reject decision and (on accept) switch builder
// ---------------------------------------------------------------------------
const recommendationPayloadSchema = z.object({
  protocol:        z.string(),
  status:          z.enum(["accepted", "rejected", "advisory"]),
  labId:           z.number().nullable().optional(),
  triggerFields:   z.array(z.string()).optional(),
  confidenceLevel: z.string().optional(),
  reason:          z.string().optional(),
});

router.post("/recommendation", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const body = recommendationPayloadSchema.parse(req.body);

    // Audit record — always write regardless of status
    await db.insert(clinicalProtocolRecommendations).values({
      userId:              userId as any,
      clinicalLabId:       body.labId ?? null,
      recommendedProtocol: body.protocol,
      status:              body.status,
      confidenceLevel:     body.confidenceLevel ?? null,
      triggerFields:       body.triggerFields ? (body.triggerFields as any) : null,
      reason:              body.reason ?? null,
    });

    // On accept: switch the user's meal builder to anti_inflammatory
    // (all clinical protocol variants live under this builder)
    if (body.status === "accepted") {
      await db
        .update(users)
        .set({ selectedMealBuilder: "anti_inflammatory", updatedAt: new Date() })
        .where(eq(users.id, userId as any));

      // Stamp all studio memberships for this user as clinically assigned
      await db
        .update(studioMemberships)
        .set({ assignedBuilder: "anti_inflammatory", builderSource: "clinical", updatedAt: new Date() } as any)
        .where(eq(studioMemberships.clientUserId, userId as any));

      console.log(`[labs/recommendation] User ${userId} accepted ${body.protocol} → builder set to anti_inflammatory (source: clinical)`);
    }

    res.json({ ok: true, status: body.status });
  } catch (error: any) {
    console.error("[labs/recommendation POST]", error);
    res.status(400).json({ error: "Failed to record recommendation", detail: error?.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/biometrics/labs/:userId
// Return most-recent labs + protocol signal derived from those values
// ---------------------------------------------------------------------------
router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const requesterId = getAuthUserId(req);
    const { userId } = req.params;

    // Security: verify the requester is allowed to read data for this user
    const hasAccess = await verifyClinicalAccess(requesterId as string, userId);
    if (!hasAccess) {
      console.warn(`[clinicalLabs GET] UNAUTHORIZED: requester ${requesterId} attempted to read labs for user ${userId}`);
      return res.status(403).json({ error: "You are not authorized to view labs for this user" });
    }

    const rows = await db
      .select()
      .from(clinicalLabs)
      .where(eq(clinicalLabs.userId, userId))
      .orderBy(desc(clinicalLabs.recordedAt))
      .limit(1);

    if (rows.length === 0) {
      // Still check oncologySupportEnabled even with no labs on file
      const userRows0 = await db
        .select({ oncologySupportContext: users.oncologySupportContext })
        .from(users)
        .where(eq(users.id, userId as any))
        .limit(1);
      const oncologyCtx0 = userRows0[0]?.oncologySupportContext as { enabled?: boolean } | null ?? null;
      return res.json({ labs: null, oncologySupportEnabled: !!(oncologyCtx0?.enabled) });
    }

    const r = rows[0];

    // Run the resolver against the raw Drizzle row (accepts string | number | null).
    // Returns LabProtocolSignal | null — null means base anti-inflammatory.
    const protocolSignal = resolveProtocolFromLabs({
      alt:                   r.alt,
      ast:                   r.ast,
      bilirubin:             r.bilirubin,
      albumin:               r.albumin,
      creatinine:            r.creatinine,
      bun:                   r.bun,
      ldl:                   r.ldl,
      bloodPressureSystolic: r.bloodPressureSystolic,
      ejectionFraction:      r.ejectionFraction,
    });

    // Fetch the user's oncologySupportContext to include in the response
    const userRows = await db
      .select({ oncologySupportContext: users.oncologySupportContext })
      .from(users)
      .where(eq(users.id, userId as any))
      .limit(1);
    const oncologyCtx = userRows[0]?.oncologySupportContext as { enabled?: boolean } | null ?? null;

    res.json({
      labs: {
        id: r.id,
        userId: r.userId,
        a1c: r.a1c ? parseFloat(r.a1c) : null,
        ldl: r.ldl ? parseFloat(r.ldl) : null,
        hdl: r.hdl ? parseFloat(r.hdl) : null,
        blood_pressure_systolic: r.bloodPressureSystolic ? parseFloat(r.bloodPressureSystolic) : null,
        blood_pressure_diastolic: r.bloodPressureDiastolic ? parseFloat(r.bloodPressureDiastolic) : null,
        ejection_fraction: r.ejectionFraction ? parseFloat(r.ejectionFraction) : null,
        creatinine: r.creatinine ? parseFloat(r.creatinine) : null,
        bun: r.bun ? parseFloat(r.bun) : null,
        inr: r.inr ? parseFloat(r.inr) : null,
        alt:       r.alt       ? parseFloat(r.alt)       : null,
        ast:       r.ast       ? parseFloat(r.ast)       : null,
        bilirubin: r.bilirubin ? parseFloat(r.bilirubin) : null,
        albumin:   r.albumin   ? parseFloat(r.albumin)   : null,
        notes: r.notes,
        lab_date: r.labDate || null,
        recorded_at: r.recordedAt,
      },
      // Protocol signal derived from the lab values.
      // null  → no threshold crossed, patient stays on base anti-inflammatory.
      // value → the resolver's recommended protocol with reason and confidence.
      protocolSignal,
      protocolSubtitle: labSignalToSubtitle(protocolSignal),
      // Physician-assigned oncology support overlay (independent of lab values)
      oncologySupportEnabled: !!(oncologyCtx?.enabled),
    });
  } catch (error: any) {
    console.error("[clinicalLabs GET]", error);
    res.status(500).json({ error: "Failed to fetch labs" });
  }
});

export default router;
