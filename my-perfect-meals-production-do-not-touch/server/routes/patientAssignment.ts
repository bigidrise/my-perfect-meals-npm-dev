import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { diabetesProfile, guardrailAuditLog, glp1Profile } from "../db/schema";
import { careTeamMember } from "../db/schema/careTeam";
// Removed import for 'users' as it's causing issues and will be addressed later.
// import { users } from "../db/schema";
import { z } from "zod";
import crypto from "crypto";

const r = Router();

function proRole(req: any, res: any, next: any) {
  const role = req.user?.role;
  if (!role || !["doctor", "coach", "trainer"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

const GuardrailsZ = z.object({
  fastingMin: z.number().int().optional(),
  fastingMax: z.number().int().optional(),
  postMealMax: z.number().int().optional(),
  carbLimit: z.number().int().optional(),
  fiberMin: z.number().int().optional(),
  giCap: z.number().int().optional(),
  mealFrequency: z.number().int().optional(),
  presetId: z.string().nullable().optional(),
}).partial();

function computeInRange(glucose: number | null, gr?: any): boolean | null {
  if (glucose == null) return null;
  const fmin = gr?.fastingMin ?? 80;
  const fmax = gr?.fastingMax ?? 120;
  return glucose >= fmin && glucose <= fmax;
}

r.get("/api/patients", proRole, async (req: any, res) => {
  const clinicianId = req.user.id;

  // Get care team relationships for this clinician
  const careTeamRelations = await db
    .select()
    .from(careTeamMember)
    .where(
      and(
        eq(careTeamMember.proUserId, clinicianId),
        eq(careTeamMember.status, "active")
      )
    );

  if (careTeamRelations.length === 0) {
    return res.json([]);
  }

  const patientIds = careTeamRelations.map(r => r.userId);

  // Get all diabetes profiles for assigned patients
  const diabetesProfiles = await db
    .select()
    .from(diabetesProfile);

  // Get all GLP-1 profiles for assigned patients
  const glp1Profiles = await db
    .select()
    .from(glp1Profile);

  // Create lookup maps
  const diabetesMap = new Map(diabetesProfiles.map(p => [p.userId, p]));
  const glp1Map = new Map(glp1Profiles.map(p => [p.userId, p]));
  const careTeamMap = new Map(careTeamRelations.map(r => [r.userId, r]));

  // Combine data for all patients
  const results = patientIds.map((patientId) => {
    const diabetes = diabetesMap.get(patientId);
    const glp1 = glp1Map.get(patientId);
    const careTeam = careTeamMap.get(patientId);

    const latestGlucose = null;
    const inRange = computeInRange(latestGlucose, diabetes?.guardrails ?? undefined);

    return {
      id: patientId,
      name: careTeam?.name ?? `Patient ${patientId.slice(0, 8)}`,
      email: careTeam?.email ?? "",
      condition: diabetes?.type === "T2D" ? "T2D" : (glp1 ? "GLP1" : "OTHER") as const,
      latestGlucose,
      inRange,
      preset: diabetes?.guardrails?.presetId ?? null,
      carbLimit: diabetes?.guardrails?.carbLimit ?? null,
      lastUpdated: diabetes?.updatedAt ?? glp1?.updatedAt ?? null,
      diabetesGuardrails: diabetes?.guardrails ?? null,
      diabetesType: diabetes?.type ?? null,
      diabetesA1c: diabetes?.a1cPercent ?? null,
      glp1Guardrails: glp1?.guardrails ?? null,
      lastShot: glp1?.lastShotDate ?? null,
      clinicianRole: careTeam?.role ?? null,
    };
  });

  res.json(results);
});

r.get("/api/patients/:id", proRole, async (req: any, res) => {
  const patientId = req.params.id;
  const clinicianId = req.user.id;

  // Verify clinician has access to this patient
  const careTeamRelation = await db.query.careTeamMember.findFirst({
    where: and(
      eq(careTeamMember.userId, patientId),
      eq(careTeamMember.proUserId, clinicianId),
      eq(careTeamMember.status, "active")
    ),
  });

  if (!careTeamRelation) {
    return res.status(403).json({ error: "Access denied to this patient" });
  }

  const diabetesProfileData = await db.query.diabetesProfile.findFirst({
    where: eq(diabetesProfile.userId, patientId),
  });

  const glp1ProfileData = await db.query.glp1Profile.findFirst({
    where: eq(glp1Profile.userId, patientId),
  });

  res.json({
    profile: diabetesProfileData ?? null,
    guardrails: diabetesProfileData?.guardrails ?? null,
    diabetesType: diabetesProfileData?.type ?? null,
    diabetesA1c: diabetesProfileData?.a1cPercent ?? null,
    diabetesMedications: diabetesProfileData?.medications ?? null,
    glucose: [], // Glucose data is not fetched here
    glp1Profile: glp1ProfileData ?? null,
    glp1Guardrails: glp1ProfileData?.guardrails ?? null,
    lastShot: glp1ProfileData?.lastShotDate ?? null,
    clinicianRole: careTeamRelation.role ?? null,
  });
});

r.put("/api/patients/:id/guardrails", proRole, async (req: any, res) => {
  const doctorId = req.user.id;
  const patientId = req.params.id;

  const parsed = GuardrailsZ.safeParse(req.body?.guardrails ?? {});
  if (!parsed.success) return res.status(400).json(parsed.error.format());

  const newGR = parsed.data;

  const existing = await db.query.diabetesProfile.findFirst({
    where: eq(diabetesProfile.userId, patientId),
  });

  const oldGR = existing?.guardrails ?? null;

  if (!existing) {
    await db.insert(diabetesProfile).values({
      userId: patientId,
      type: "T2D",
      medications: null,
      hypoHistory: false,
      a1cPercent: null,
      guardrails: newGR,
    });
  } else {
    await db
      .update(diabetesProfile)
      .set({ guardrails: newGR })
      .where(eq(diabetesProfile.userId, patientId));
  }

  await db.insert(guardrailAuditLog).values({
    id: crypto.randomUUID(),
    doctorId,
    patientId,
    field: "guardrails",
    oldValue: JSON.stringify(oldGR),
    newValue: JSON.stringify(newGR),
  });

  res.json({ ok: true });
});

r.get("/api/patients/:id/audit", proRole, async (req: any, res) => {
  const patientId = req.params.id;

  const rows = await db
    .select({
      id: guardrailAuditLog.id,
      doctorId: guardrailAuditLog.doctorId,
      patientId: guardrailAuditLog.patientId,
      field: guardrailAuditLog.field,
      oldValue: guardrailAuditLog.oldValue,
      newValue: guardrailAuditLog.newValue,
      updatedAt: guardrailAuditLog.updatedAt,
    })
    .from(guardrailAuditLog)
    .where(eq(guardrailAuditLog.patientId, patientId))
    .orderBy(desc(guardrailAuditLog.updatedAt));

  res.json(rows);
});

export default r;