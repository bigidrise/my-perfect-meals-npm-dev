import express from "express";
import { db } from "../db";
import { clinicalLabs } from "../db/schema/clinicalLabs";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { getAuthUserId } from "../utils/getAuthUserId";
import { z } from "zod";

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
  notes: z.string().optional().nullable(),
  recorded_at: z.string().optional(),
  lab_date: z.string().optional().nullable(),
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const requesterId = getAuthUserId(req);
    const body = labsPayloadSchema.parse(req.body);

    const targetUserId = body.userId || requesterId;

    await db.insert(clinicalLabs).values({
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
      notes: body.notes || null,
      labDate: body.lab_date || new Date().toISOString().split("T")[0],
      recordedAt: body.recorded_at ? new Date(body.recorded_at) : new Date(),
    });

    res.status(201).json({ success: true });
  } catch (error: any) {
    console.error("[clinicalLabs POST]", error);
    res.status(400).json({ error: "Failed to save labs", detail: error?.message });
  }
});

router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const rows = await db
      .select()
      .from(clinicalLabs)
      .where(eq(clinicalLabs.userId, userId))
      .orderBy(desc(clinicalLabs.recordedAt))
      .limit(1);

    if (rows.length === 0) {
      return res.json({ labs: null });
    }

    const r = rows[0];
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
        notes: r.notes,
        lab_date: r.labDate || null,
        recorded_at: r.recordedAt,
      },
    });
  } catch (error: any) {
    console.error("[clinicalLabs GET]", error);
    res.status(500).json({ error: "Failed to fetch labs" });
  }
});

export default router;
