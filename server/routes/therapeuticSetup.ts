/**
 * therapeuticSetup.ts
 *
 * GET  /api/therapeutic/context  — returns saved TherapeuticSupportContext for the authenticated user
 * POST /api/therapeutic/setup    — saves context, activates "therapeutic-support" in specialtyConditions,
 *                                  returns intersection-aware modal content
 *
 * Auth: requireAuth middleware applied at mount point in routes.ts / prod.ts
 */

import { Router } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { buildTherapeuticModalContent } from "../services/therapeuticGuidance";
import type { TherapeuticSupportCtx } from "../services/therapeuticGuidance";

const router = Router();

function parseSpecialtyConditions(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function isEmptyCtx(ctx: TherapeuticSupportCtx): boolean {
  return (
    ctx.peptides.length === 0 &&
    ctx.hormones.length === 0 &&
    ctx.medications.length === 0 &&
    ctx.therapies.length === 0 &&
    ctx.recoveryGoals.length === 0
  );
}

router.get("/context", async (req, res) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });

    const raw = (user as any).therapeuticSupportContext;
    const ctx: TherapeuticSupportCtx = raw && typeof raw === "object"
      ? {
          peptides: Array.isArray(raw.peptides) ? raw.peptides : [],
          hormones: Array.isArray(raw.hormones) ? raw.hormones : [],
          medications: Array.isArray(raw.medications) ? raw.medications : [],
          therapies: Array.isArray(raw.therapies) ? raw.therapies : [],
          recoveryGoals: Array.isArray(raw.recoveryGoals) ? raw.recoveryGoals : [],
        }
      : { peptides: [], hormones: [], medications: [], therapies: [], recoveryGoals: [] };

    return res.json({ context: ctx });
  } catch (err: any) {
    console.error("[TherapeuticSetup] GET /context error:", err.message);
    return res.status(500).json({ error: "Failed to load therapeutic context" });
  }
});

router.post("/setup", async (req, res) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const body = req.body as Partial<TherapeuticSupportCtx>;

    const ctx: TherapeuticSupportCtx = {
      peptides: Array.isArray(body.peptides) ? body.peptides.map(String) : [],
      hormones: Array.isArray(body.hormones) ? body.hormones.map(String) : [],
      medications: Array.isArray(body.medications) ? body.medications.map(String) : [],
      therapies: Array.isArray(body.therapies) ? body.therapies.map(String) : [],
      recoveryGoals: Array.isArray(body.recoveryGoals) ? body.recoveryGoals.map(String) : [],
    };

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });

    const currentSpecialty = parseSpecialtyConditions((user as any).specialtyConditions);

    let updatedSpecialty: string[];
    if (isEmptyCtx(ctx)) {
      updatedSpecialty = currentSpecialty.filter(c => c !== "therapeutic-support");
    } else {
      updatedSpecialty = currentSpecialty.includes("therapeutic-support")
        ? currentSpecialty
        : [...currentSpecialty, "therapeutic-support"];
    }

    await db
      .update(users)
      .set({
        therapeuticSupportContext: ctx as any,
        specialtyConditions: JSON.stringify(updatedSpecialty) as any,
      } as any)
      .where(eq(users.id, userId));

    const modalContent = isEmptyCtx(ctx)
      ? null
      : buildTherapeuticModalContent(ctx, user as any);

    return res.json({ saved: true, context: ctx, modalContent });
  } catch (err: any) {
    console.error("[TherapeuticSetup] POST /setup error:", err.message);
    return res.status(500).json({ error: "Failed to save therapeutic context" });
  }
});

export default router;
