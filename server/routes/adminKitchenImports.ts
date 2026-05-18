// server/routes/adminKitchenImports.ts
// Admin API for YouTube recipe imports into Chef Signature Library (Phase 2B).
// Mounted at /api/admin/chef-kitchens (same prefix as adminSignatureLibrary).
// All routes require requireAuth + requireAdmin (enforced at mount point in index.ts).
//
// OWNERSHIP GATE:
//   - POST /:slug/imports — submits a YouTube URL → triggers workflow → status: 'needs_review'
//   - PATCH /:slug/imports/:importId/confirm-ownership — admin confirms ownership
//   - PATCH /:slug/imports/:importId/approve — moves to 'approved'; requires ownership_confirmed
//   - PATCH /:slug/imports/:importId/reject — moves to 'rejected'
//   - GET /:slug/imports — list all imports for this kitchen

import { Router } from "express";
import { db } from "../db";
import { chefSignatureImports } from "../db/schema/chefSignatureImports";
import { chefSignatureItems } from "../db/schema/chefSignatureLibrary";
import { creators } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const importSubmitSchema = z.object({
  sourceUrl: z.string().url("Must be a valid URL").max(500),
});

// GET /:slug/imports — list all imports for a kitchen
router.get("/:slug/imports", async (req, res) => {
  const { slug } = req.params;
  try {
    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    const imports = await db
      .select()
      .from(chefSignatureImports)
      .where(eq(chefSignatureImports.creatorId, creator.id))
      .orderBy(desc(chefSignatureImports.createdAt));

    return res.json({ imports });
  } catch (err: any) {
    console.error("[AdminImports] list error:", err);
    return res.status(500).json({ error: "Failed to list imports" });
  }
});

// POST /:slug/imports — submit a YouTube URL for import
router.post("/:slug/imports", async (req, res) => {
  const { slug } = req.params;
  try {
    const parsed = importSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    const { importFromYouTube } = await import("../services/chefSignatureImports/workflow");
    const adminId = (req.session as any)?.userId ?? "admin";

    const result = await importFromYouTube(slug, parsed.data.sourceUrl, adminId);

    return res.status(201).json({
      success: true,
      message: `Import queued — "${result.title}" needs ownership confirmation before it can be published.`,
      ...result,
    });
  } catch (err: any) {
    console.error("[AdminImports] submit error:", err);
    return res.status(500).json({ error: err?.message ?? "Import failed" });
  }
});

// PATCH /:slug/imports/:importId/confirm-ownership
// Admin explicitly confirms they own the rights to publish this content.
router.patch("/:slug/imports/:importId/confirm-ownership", async (req, res) => {
  const { slug, importId } = req.params;
  try {
    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    const [row] = await db
      .select({ id: chefSignatureImports.id, creatorId: chefSignatureImports.creatorId })
      .from(chefSignatureImports)
      .where(and(eq(chefSignatureImports.id, importId), eq(chefSignatureImports.creatorId, creator.id)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Import not found" });

    const adminId = (req.session as any)?.userId ?? "admin";
    await db
      .update(chefSignatureImports)
      .set({
        ownershipConfirmed: true,
        ownershipConfirmedBy: adminId,
        ownershipConfirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(chefSignatureImports.id, importId));

    return res.json({ success: true, ownershipConfirmed: true });
  } catch (err: any) {
    console.error("[AdminImports] confirm-ownership error:", err);
    return res.status(500).json({ error: "Failed to confirm ownership" });
  }
});

// PATCH /:slug/imports/:importId/approve
// Moves import to 'approved'. Requires ownership_confirmed = true.
router.patch("/:slug/imports/:importId/approve", async (req, res) => {
  const { slug, importId } = req.params;
  try {
    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    const [importRow] = await db
      .select()
      .from(chefSignatureImports)
      .where(and(eq(chefSignatureImports.id, importId), eq(chefSignatureImports.creatorId, creator.id)))
      .limit(1);
    if (!importRow) return res.status(404).json({ error: "Import not found" });

    // OWNERSHIP GATE — hard enforcement
    if (!importRow.ownershipConfirmed) {
      return res.status(403).json({
        error: "OWNERSHIP_NOT_CONFIRMED",
        message: "You must confirm ownership of this content before approving it for publication.",
      });
    }

    await db
      .update(chefSignatureImports)
      .set({ importStatus: "approved", updatedAt: new Date() })
      .where(eq(chefSignatureImports.id, importId));

    return res.json({ success: true, importStatus: "approved" });
  } catch (err: any) {
    console.error("[AdminImports] approve error:", err);
    return res.status(500).json({ error: "Failed to approve import" });
  }
});

// PATCH /:slug/imports/:importId/reject
router.patch("/:slug/imports/:importId/reject", async (req, res) => {
  const { slug, importId } = req.params;
  try {
    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    await db
      .update(chefSignatureImports)
      .set({ importStatus: "rejected", updatedAt: new Date() })
      .where(and(eq(chefSignatureImports.id, importId), eq(chefSignatureImports.creatorId, creator.id)));

    return res.json({ success: true, importStatus: "rejected" });
  } catch (err: any) {
    console.error("[AdminImports] reject error:", err);
    return res.status(500).json({ error: "Failed to reject import" });
  }
});

export default router;
