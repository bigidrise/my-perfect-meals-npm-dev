import express from "express";
import { db } from "../db";
import { clinicalLabs } from "../db/schema/clinicalLabs";
import { clinicalProtocolRecommendations } from "../db/schema/clinicalProtocolRecommendations";
import { studioMemberships, studios } from "../db/schema/studio";
import { users } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getAuthUserId } from "../utils/getAuthUserId";
import { z } from "zod";
import { resolveProtocolFromLabs, resolveThyroidFromLabs, resolveDowngradeSignals, labSignalToSubtitle } from "../services/resolveProtocolFromLabs";
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
 * bilirubin, albumin, tsh, crp, glucose, cortisol, triglycerides) are identical
 * in all three layers — no mapping needed.
 * Multi-word fields require explicit snake→camel mapping in the POST handler
 * and explicit camel→snake mapping in the GET response.
 *
 * Protocol precedence (must match resolveProtocolFromLabs exactly):
 *   liver-disease > kidney-disease > heart-failure > liver-support >
 *   metabolic-support > inflammation-support > metabolic-stress > null
 *
 * Authorization model:
 *   A requester may read or write clinical data for targetUserId only if:
 *   (a) requester IS the target user (self-access), OR
 *   (b) requester owns a studio that the target user is a member of
 */

const labsPayloadSchema = z.object({
  userId: z.string().optional(),
  // ── Existing fields ────────────────────────────────────────────────────────
  a1c: z.number().optional().nullable(),
  ldl: z.number().optional().nullable(),
  hdl: z.number().optional().nullable(),
  blood_pressure_systolic: z.number().optional().nullable(),
  blood_pressure_diastolic: z.number().optional().nullable(),
  ejection_fraction: z.number().optional().nullable(),
  creatinine: z.number().optional().nullable(),
  bun: z.number().optional().nullable(),
  inr: z.number().optional().nullable(),
  alt:       z.number().optional().nullable(),
  ast:       z.number().optional().nullable(),
  bilirubin: z.number().optional().nullable(),
  albumin:   z.number().optional().nullable(),
  tsh:                      z.number().optional().nullable(),
  free_t4:                  z.number().optional().nullable(),
  free_t3:                  z.number().optional().nullable(),
  tpo_antibodies:           z.number().optional().nullable(),
  thyroglobulin_antibodies: z.number().optional().nullable(),
  // ── Phase 4 fields ────────────────────────────────────────────────────────
  // Metabolic / Insulin Resistance
  fasting_insulin: z.number().optional().nullable(),  // µIU/mL
  glucose:         z.number().optional().nullable(),  // mg/dL (fasting)
  triglycerides:   z.number().optional().nullable(),  // mg/dL
  // Inflammation
  crp:             z.number().optional().nullable(),  // mg/L — C-Reactive Protein
  // Hormonal / Stress
  cortisol:        z.number().optional().nullable(),  // µg/dL
  // Oncology & Recovery — nutrition status markers
  prealbumin:      z.number().optional().nullable(),  // mg/dL (transthyretin)
  // ── Metadata ───────────────────────────────────────────────────────────────
  notes: z.string().optional().nullable(),
  recorded_at: z.string().optional(),
  lab_date: z.string().optional().nullable(),
});

/**
 * Check whether a physician has already explicitly assigned a builder to this user.
 */
async function getPhysicianLock(userId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ assignedBuilder: studioMemberships.assignedBuilder })
      .from(studioMemberships)
      .where(
        and(
          eq(studioMemberships.clientUserId, userId as any),
          eq(studioMemberships.status, "active"),
          eq(studioMemberships.isArchived, false)
        )
      )
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

    const hasAccess = await verifyClinicalAccess(requesterId as string, targetUserId as string);
    if (!hasAccess) {
      console.warn(`[clinicalLabs POST] UNAUTHORIZED: requester ${requesterId} attempted to write labs for user ${targetUserId}`);
      return res.status(403).json({ error: "You are not authorized to submit labs for this user" });
    }

    // ── Pre-insert: fetch user state + previous labs for downgrade detection ──
    const [userState, previousLabRows] = await Promise.all([
      db.select({ specialtyConditions: users.specialtyConditions, specialtyCondition: users.specialtyCondition })
        .from(users)
        .where(eq(users.id, targetUserId as any))
        .limit(1),
      db.select()
        .from(clinicalLabs)
        .where(eq(clinicalLabs.userId, targetUserId as any))
        .orderBy(desc(clinicalLabs.recordedAt))
        .limit(1),
    ]);

    const currentSpecialtyConditions = (userState[0]?.specialtyConditions as string[]) ?? [];

    // Derive previous protocol by running resolver on prior lab record
    let previousProtocol: string | null = null;
    if (previousLabRows.length > 0) {
      const pr = previousLabRows[0];
      const prevSignal = resolveProtocolFromLabs({
        alt: pr.alt, ast: pr.ast, bilirubin: pr.bilirubin, albumin: pr.albumin,
        creatinine: pr.creatinine, bun: pr.bun,
        ldl: pr.ldl, hdl: pr.hdl,
        bloodPressureSystolic: pr.bloodPressureSystolic,
        ejectionFraction: pr.ejectionFraction,
        a1c: pr.a1c,
        glucose: pr.glucose,
        fastingInsulin: pr.fastingInsulin,
        triglycerides: pr.triglycerides,
        crp: pr.crp,
        cortisol: pr.cortisol,
      });
      previousProtocol = prevSignal?.protocol ?? null;
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
        tsh:                     body.tsh                      != null ? String(body.tsh)                      : null,
        freeT4:                  body.free_t4                  != null ? String(body.free_t4)                  : null,
        freeT3:                  body.free_t3                  != null ? String(body.free_t3)                  : null,
        tpoAntibodies:           body.tpo_antibodies           != null ? String(body.tpo_antibodies)           : null,
        thyroglobulinAntibodies: body.thyroglobulin_antibodies != null ? String(body.thyroglobulin_antibodies) : null,
        // Phase 4 — snake→camel mapping
        fastingInsulin: body.fasting_insulin != null ? String(body.fasting_insulin) : null,
        glucose:        body.glucose         != null ? String(body.glucose)         : null,
        triglycerides:  body.triglycerides   != null ? String(body.triglycerides)   : null,
        crp:            body.crp             != null ? String(body.crp)             : null,
        cortisol:       body.cortisol        != null ? String(body.cortisol)        : null,
        prealbumin:     body.prealbumin      != null ? String(body.prealbumin)      : null,
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
      hdl:                   body.hdl,
      bloodPressureSystolic: body.blood_pressure_systolic,
      ejectionFraction:      body.ejection_fraction,
      a1c:                   body.a1c,
      glucose:               body.glucose,
      fastingInsulin:        body.fasting_insulin,
      triglycerides:         body.triglycerides,
      crp:                   body.crp,
      cortisol:              body.cortisol,
    });

    // Thyroid resolver — additive modifier, separate signal
    const thyroidSignalRaw = resolveThyroidFromLabs({
      tsh:                     body.tsh,
      freeT4:                  body.free_t4,
      freeT3:                  body.free_t3,
      tpoAntibodies:           body.tpo_antibodies,
      thyroglobulinAntibodies: body.thyroglobulin_antibodies,
    });

    // Downgrade detection — runs against new values vs. previous state
    const downgradeSignals = resolveDowngradeSignals(
      {
        alt:                   body.alt,
        ast:                   body.ast,
        bilirubin:             body.bilirubin,
        albumin:               body.albumin,
        creatinine:            body.creatinine,
        bun:                   body.bun,
        ldl:                   body.ldl,
        hdl:                   body.hdl,
        bloodPressureSystolic: body.blood_pressure_systolic,
        ejectionFraction:      body.ejection_fraction,
        tsh:                   body.tsh,
        freeT4:                body.free_t4,
        freeT3:                body.free_t3,
        tpoAntibodies:         body.tpo_antibodies,
        thyroglobulinAntibodies: body.thyroglobulin_antibodies,
        a1c:                   body.a1c,
        glucose:               body.glucose,
        fastingInsulin:        body.fasting_insulin,
        triglycerides:         body.triglycerides,
        crp:                   body.crp,
        cortisol:              body.cortisol,
      },
      { currentSpecialtyConditions, previousProtocol },
    );

    const alreadyOnThyroid   = currentSpecialtyConditions.includes('thyroid-support');
    const alreadyOnProtocol  = protocolSignal?.protocol === previousProtocol && previousProtocol !== null;

    const effectiveProtocolSignal = alreadyOnProtocol ? null : protocolSignal;
    const effectiveThyroidSignal  = alreadyOnThyroid  ? null : (thyroidSignalRaw.hasThyroidIndicators ? thyroidSignalRaw : null);

    const thyroidMonitoring =
      alreadyOnThyroid &&
      thyroidSignalRaw.hasThyroidIndicators &&
      downgradeSignals.length === 0;

    const [physicianLocked] = await Promise.all([getPhysicianLock(targetUserId as string)]);

    res.status(201).json({
      success: true,
      labId,
      protocolSignal: effectiveProtocolSignal,
      protocolSubtitle: labSignalToSubtitle(effectiveProtocolSignal),
      thyroidSignal: effectiveThyroidSignal,
      downgradeSignals,
      thyroidMonitoring,
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
  status:          z.enum(["accepted", "rejected", "advisory", "removed"]),
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

    // ── On "removed" (downgrade accepted): remove the protocol from user's state ──
    if (body.status === "removed") {
      const [currentUser] = await db
        .select({ specialtyConditions: users.specialtyConditions, specialtyCondition: users.specialtyCondition })
        .from(users)
        .where(eq(users.id, userId as any))
        .limit(1);

      const currentConditions = (currentUser?.specialtyConditions as string[]) ?? [];
      const newConditions = currentConditions.filter(c => c !== body.protocol);
      const newPrimary = currentUser?.specialtyCondition === body.protocol
        ? (newConditions[0] ?? null)
        : (currentUser?.specialtyCondition ?? null);

      await db
        .update(users)
        .set({ specialtyConditions: newConditions, specialtyCondition: newPrimary, updatedAt: new Date() } as any)
        .where(eq(users.id, userId as any));

      console.log(`[labs/recommendation] User ${userId} removed ${body.protocol} → specialty_conditions updated`);
    }

    // ── On accept: activate the protocol ─────────────────────────────────────
    if (body.status === "accepted") {
      if (body.protocol === "thyroid-support") {
        // Thyroid is ADDITIVE — does not change the meal builder.
        const [currentUser] = await db
          .select({ specialtyConditions: users.specialtyConditions, specialtyCondition: users.specialtyCondition })
          .from(users)
          .where(eq(users.id, userId as any))
          .limit(1);

        const currentConditions = (currentUser?.specialtyConditions as string[]) ?? [];
        if (!currentConditions.includes("thyroid-support")) {
          const newConditions = [...currentConditions, "thyroid-support"];
          const newPrimary = currentUser?.specialtyCondition ?? "thyroid-support";
          await db
            .update(users)
            .set({ specialtyConditions: newConditions, specialtyCondition: newPrimary, updatedAt: new Date() } as any)
            .where(eq(users.id, userId as any));
        }
        console.log(`[labs/recommendation] User ${userId} accepted thyroid-support → specialty_conditions updated`);
      } else {
        // All non-thyroid clinical protocols:
        //   1. Switch meal builder to anti_inflammatory (enables clinical protocol routing)
        //   2. Write protocol to specialtyCondition + specialtyConditions (explicit state,
        //      enables downgrade detection and indicator lights without re-running resolver)
        const [currentUser] = await db
          .select({ specialtyConditions: users.specialtyConditions, specialtyCondition: users.specialtyCondition })
          .from(users)
          .where(eq(users.id, userId as any))
          .limit(1);

        const currentConditions = (currentUser?.specialtyConditions as string[]) ?? [];
        // Add to conditions array if not already present
        const newConditions = currentConditions.includes(body.protocol)
          ? currentConditions
          : [...currentConditions, body.protocol];
        // Promote to primary only if no existing primary specialty condition
        const newPrimary = currentUser?.specialtyCondition ?? body.protocol;

        await db
          .update(users)
          .set({
            selectedMealBuilder: "anti_inflammatory",
            specialtyConditions: newConditions,
            specialtyCondition:  newPrimary,
            updatedAt: new Date(),
          } as any)
          .where(eq(users.id, userId as any));

        // Stamp active studio memberships as clinically assigned
        await db
          .update(studioMemberships)
          .set({ assignedBuilder: "anti_inflammatory", builderSource: "clinical", updatedAt: new Date() } as any)
          .where(
            and(
              eq(studioMemberships.clientUserId, userId as any),
              eq(studioMemberships.status, "active"),
              eq(studioMemberships.isArchived, false)
            )
          );

        console.log(`[labs/recommendation] User ${userId} accepted ${body.protocol} → builder=anti_inflammatory, specialty_conditions updated`);
      }
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
      const userRows0 = await db
        .select({ oncologySupportContext: users.oncologySupportContext, specialtyCondition: users.specialtyCondition, specialtyConditions: users.specialtyConditions })
        .from(users)
        .where(eq(users.id, userId as any))
        .limit(1);
      const oncologyCtx0 = userRows0[0]?.oncologySupportContext as { enabled?: boolean } | null ?? null;
      return res.json({
        labs: null,
        oncologySupportEnabled: !!(oncologyCtx0?.enabled),
        oncologySupportContext: userRows0[0]?.oncologySupportContext ?? null,
        specialtyCondition: userRows0[0]?.specialtyCondition ?? null,
        specialtyConditions: (userRows0[0]?.specialtyConditions as string[]) ?? [],
      });
    }

    const r = rows[0];

    const protocolSignal = resolveProtocolFromLabs({
      alt:                   r.alt,
      ast:                   r.ast,
      bilirubin:             r.bilirubin,
      albumin:               r.albumin,
      creatinine:            r.creatinine,
      bun:                   r.bun,
      ldl:                   r.ldl,
      hdl:                   r.hdl,
      bloodPressureSystolic: r.bloodPressureSystolic,
      ejectionFraction:      r.ejectionFraction,
      a1c:                   r.a1c,
      glucose:               r.glucose,
      fastingInsulin:        r.fastingInsulin,
      triglycerides:         r.triglycerides,
      crp:                   r.crp,
      cortisol:              r.cortisol,
    });

    const thyroidSignal = resolveThyroidFromLabs({
      tsh:                     r.tsh,
      freeT4:                  r.freeT4,
      freeT3:                  r.freeT3,
      tpoAntibodies:           r.tpoAntibodies,
      thyroglobulinAntibodies: r.thyroglobulinAntibodies,
    });

    const userRows = await db
      .select({ oncologySupportContext: users.oncologySupportContext, specialtyCondition: users.specialtyCondition, specialtyConditions: users.specialtyConditions })
      .from(users)
      .where(eq(users.id, userId as any))
      .limit(1);
    const oncologyCtx = userRows[0]?.oncologySupportContext as { enabled?: boolean } | null ?? null;

    res.json({
      labs: {
        id: r.id,
        userId: r.userId,
        // ── Existing fields ─────────────────────────────────────────────────
        a1c: r.a1c ? parseFloat(r.a1c) : null,
        ldl: r.ldl ? parseFloat(r.ldl) : null,
        hdl: r.hdl ? parseFloat(r.hdl) : null,
        blood_pressure_systolic:  r.bloodPressureSystolic  ? parseFloat(r.bloodPressureSystolic)  : null,
        blood_pressure_diastolic: r.bloodPressureDiastolic ? parseFloat(r.bloodPressureDiastolic) : null,
        ejection_fraction: r.ejectionFraction ? parseFloat(r.ejectionFraction) : null,
        creatinine: r.creatinine ? parseFloat(r.creatinine) : null,
        bun: r.bun ? parseFloat(r.bun) : null,
        inr: r.inr ? parseFloat(r.inr) : null,
        alt:       r.alt       ? parseFloat(r.alt)       : null,
        ast:       r.ast       ? parseFloat(r.ast)       : null,
        bilirubin: r.bilirubin ? parseFloat(r.bilirubin) : null,
        albumin:   r.albumin   ? parseFloat(r.albumin)   : null,
        tsh:                     r.tsh                     ? parseFloat(r.tsh)                     : null,
        free_t4:                 r.freeT4                  ? parseFloat(r.freeT4)                  : null,
        free_t3:                 r.freeT3                  ? parseFloat(r.freeT3)                  : null,
        tpo_antibodies:          r.tpoAntibodies           ? parseFloat(r.tpoAntibodies)           : null,
        thyroglobulin_antibodies:r.thyroglobulinAntibodies ? parseFloat(r.thyroglobulinAntibodies) : null,
        // ── Phase 4 fields — camel→snake ─────────────────────────────────────
        fasting_insulin: r.fastingInsulin ? parseFloat(r.fastingInsulin) : null,
        glucose:         r.glucose        ? parseFloat(r.glucose)        : null,
        triglycerides:   r.triglycerides  ? parseFloat(r.triglycerides)  : null,
        crp:             r.crp            ? parseFloat(r.crp)            : null,
        cortisol:        r.cortisol       ? parseFloat(r.cortisol)       : null,
        prealbumin:      r.prealbumin     ? parseFloat(r.prealbumin)     : null,
        // ── Metadata ──────────────────────────────────────────────────────────
        notes: r.notes,
        lab_date: r.labDate || null,
        recorded_at: r.recordedAt,
      },
      protocolSignal,
      protocolSubtitle: labSignalToSubtitle(protocolSignal),
      thyroidSignal,
      oncologySupportEnabled: !!(oncologyCtx?.enabled),
      oncologySupportContext: userRows[0]?.oncologySupportContext ?? null,
      specialtyCondition: userRows[0]?.specialtyCondition ?? null,
      specialtyConditions: (userRows[0]?.specialtyConditions as string[]) ?? [],
    });
  } catch (error: any) {
    console.error("[clinicalLabs GET]", error);
    res.status(500).json({ error: "Failed to fetch labs" });
  }
});

export default router;
