// server/routes/adminSignatureLibrary.ts
// Admin CRUD for chef signature items and collections (Phase 1).
// Phase 2A: Added fingerprint rebuild on publish/unpublish.
// Phase 2B: Added ownership publish gate for import-sourced items.
// Mounted at /api/admin/chef-kitchens — requires requireAuth + requireAdmin.

import { Router } from "express";
import { db } from "../db";
import {
  creators,
  chefSignatureItems,
  chefSignatureCollections,
  chefSignatureCollectionItems,
  chefSignatureImports,
} from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ─── ITEMS ────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  kind: z.enum(["dish", "sauce", "beverage", "snack", "recipe"]).default("dish"),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional().nullable(),
  description: z.string().max(800).optional().nullable(),
  mediaUrl: z.string().max(500).optional().nullable(),
  tags: z.array(z.string().max(40)).max(12).optional(),
  techniques: z.array(z.string().max(60)).max(10).optional(),
  ingredients: z.array(z.string().max(60)).max(30).optional(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// GET /:slug/items — list all items (admin sees unpublished too)
router.get("/:slug/items", async (req, res) => {
  const { slug } = req.params;
  try {
    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    const items = await db
      .select()
      .from(chefSignatureItems)
      .where(eq(chefSignatureItems.creatorId, creator.id))
      .orderBy(asc(chefSignatureItems.sortOrder), asc(chefSignatureItems.createdAt));

    return res.json({ items });
  } catch (err: any) {
    console.error("[AdminLib] list items error:", err);
    return res.status(500).json({ error: "Failed to list items" });
  }
});

// POST /:slug/items — create an item
router.post("/:slug/items", async (req, res) => {
  const { slug } = req.params;
  try {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    const d = parsed.data;
    const now = new Date();
    const [item] = await db
      .insert(chefSignatureItems)
      .values({
        creatorId: creator.id,
        kind: d.kind,
        title: d.title,
        subtitle: d.subtitle ?? null,
        description: d.description ?? null,
        mediaUrl: d.mediaUrl ?? null,
        tags: d.tags ?? [],
        techniques: d.techniques ?? [],
        ingredients: d.ingredients ?? [],
        isFeatured: d.isFeatured ?? false,
        isPublished: d.isPublished ?? false,
        sortOrder: d.sortOrder ?? 0,
        publishedAt: d.isPublished ? now : null,
      })
      .returning();

    return res.status(201).json({ success: true, item });
  } catch (err: any) {
    console.error("[AdminLib] create item error:", err);
    return res.status(500).json({ error: "Failed to create item" });
  }
});

// PATCH /:slug/items/:itemId — update an item
router.patch("/:slug/items/:itemId", async (req, res) => {
  const { slug, itemId } = req.params;
  try {
    const parsed = itemSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    const d = parsed.data;
    const update: Record<string, any> = { updatedAt: new Date() };
    if (d.kind !== undefined) update.kind = d.kind;
    if (d.title !== undefined) update.title = d.title;
    if (d.subtitle !== undefined) update.subtitle = d.subtitle;
    if (d.description !== undefined) update.description = d.description;
    if (d.mediaUrl !== undefined) update.mediaUrl = d.mediaUrl;
    if (d.tags !== undefined) update.tags = d.tags;
    if (d.techniques !== undefined) update.techniques = d.techniques;
    if (d.ingredients !== undefined) update.ingredients = d.ingredients;
    if (d.isFeatured !== undefined) update.isFeatured = d.isFeatured;
    if (d.sortOrder !== undefined) update.sortOrder = d.sortOrder;
    if (d.isPublished !== undefined) {
      // OWNERSHIP GATE (Phase 2B): if trying to publish, check if this item came from an
      // unconfirmed import. ownership_confirmed must be true before a sourced item can go live.
      if (d.isPublished === true) {
        const [linkedImport] = await db
          .select({ id: chefSignatureImports.id, ownershipConfirmed: chefSignatureImports.ownershipConfirmed })
          .from(chefSignatureImports)
          .where(eq(chefSignatureImports.parsedItemId, itemId))
          .limit(1);
        if (linkedImport && !linkedImport.ownershipConfirmed) {
          return res.status(403).json({
            error: "OWNERSHIP_NOT_CONFIRMED",
            message: "This item was created from an import. You must confirm ownership before publishing.",
          });
        }
      }
      update.isPublished = d.isPublished;
      if (d.isPublished) update.publishedAt = new Date();
    }

    await db
      .update(chefSignatureItems)
      .set(update)
      .where(and(eq(chefSignatureItems.id, itemId), eq(chefSignatureItems.creatorId, creator.id)));

    // FINGERPRINT REBUILD (Phase 2A): triggered whenever publish state changes.
    // Fires async — does not block the response.
    if (d.isPublished !== undefined) {
      import("../services/creatorSystems/buildChefFingerprint").then(({ rebuildAndStoreFingerprint }) => {
        rebuildAndStoreFingerprint(slug).catch(err =>
          console.error("[AdminLib] fingerprint rebuild failed:", err)
        );
      }).catch(() => {});
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AdminLib] update item error:", err);
    return res.status(500).json({ error: "Failed to update item" });
  }
});

// DELETE /:slug/items/:itemId
router.delete("/:slug/items/:itemId", async (req, res) => {
  const { slug, itemId } = req.params;
  try {
    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    await db.delete(chefSignatureCollectionItems).where(eq(chefSignatureCollectionItems.itemId, itemId));
    await db
      .delete(chefSignatureItems)
      .where(and(eq(chefSignatureItems.id, itemId), eq(chefSignatureItems.creatorId, creator.id)));

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AdminLib] delete item error:", err);
    return res.status(500).json({ error: "Failed to delete item" });
  }
});

// ─── COLLECTIONS ──────────────────────────────────────────────────────────────

const collectionSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/),
  title: z.string().min(1).max(120),
  description: z.string().max(400).optional().nullable(),
  coverMediaUrl: z.string().max(500).optional().nullable(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// GET /:slug/collections — list all collections (admin)
router.get("/:slug/collections", async (req, res) => {
  const { slug } = req.params;
  try {
    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    const collections = await db
      .select()
      .from(chefSignatureCollections)
      .where(eq(chefSignatureCollections.creatorId, creator.id))
      .orderBy(asc(chefSignatureCollections.sortOrder));

    return res.json({ collections });
  } catch (err: any) {
    console.error("[AdminLib] list collections error:", err);
    return res.status(500).json({ error: "Failed to list collections" });
  }
});

// POST /:slug/collections — create a collection
router.post("/:slug/collections", async (req, res) => {
  const { slug } = req.params;
  try {
    const parsed = collectionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    const d = parsed.data;
    const [collection] = await db
      .insert(chefSignatureCollections)
      .values({
        creatorId: creator.id,
        slug: d.slug,
        title: d.title,
        description: d.description ?? null,
        coverMediaUrl: d.coverMediaUrl ?? null,
        isFeatured: d.isFeatured ?? false,
        isPublished: d.isPublished ?? false,
        sortOrder: d.sortOrder ?? 0,
      })
      .returning();

    return res.status(201).json({ success: true, collection });
  } catch (err: any) {
    console.error("[AdminLib] create collection error:", err);
    return res.status(500).json({ error: "Failed to create collection" });
  }
});

// PATCH /:slug/collections/:collectionId
router.patch("/:slug/collections/:collectionId", async (req, res) => {
  const { slug, collectionId } = req.params;
  try {
    const parsed = collectionSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    const d = parsed.data;
    const update: Record<string, any> = { updatedAt: new Date() };
    if (d.slug !== undefined) update.slug = d.slug;
    if (d.title !== undefined) update.title = d.title;
    if (d.description !== undefined) update.description = d.description;
    if (d.coverMediaUrl !== undefined) update.coverMediaUrl = d.coverMediaUrl;
    if (d.isFeatured !== undefined) update.isFeatured = d.isFeatured;
    if (d.isPublished !== undefined) update.isPublished = d.isPublished;
    if (d.sortOrder !== undefined) update.sortOrder = d.sortOrder;

    await db
      .update(chefSignatureCollections)
      .set(update)
      .where(and(eq(chefSignatureCollections.id, collectionId), eq(chefSignatureCollections.creatorId, creator.id)));

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AdminLib] update collection error:", err);
    return res.status(500).json({ error: "Failed to update collection" });
  }
});

// DELETE /:slug/collections/:collectionId
router.delete("/:slug/collections/:collectionId", async (req, res) => {
  const { slug, collectionId } = req.params;
  try {
    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    await db.delete(chefSignatureCollectionItems).where(eq(chefSignatureCollectionItems.collectionId, collectionId));
    await db
      .delete(chefSignatureCollections)
      .where(and(eq(chefSignatureCollections.id, collectionId), eq(chefSignatureCollections.creatorId, creator.id)));

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AdminLib] delete collection error:", err);
    return res.status(500).json({ error: "Failed to delete collection" });
  }
});

// POST /:slug/collections/:collectionId/items — add item to collection
router.post("/:slug/collections/:collectionId/items", async (req, res) => {
  const { collectionId } = req.params;
  const schema = z.object({ itemId: z.string().uuid(), position: z.number().int().min(0).optional() });
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const [link] = await db
      .insert(chefSignatureCollectionItems)
      .values({ collectionId, itemId: parsed.data.itemId, position: parsed.data.position ?? 0 })
      .returning();

    return res.status(201).json({ success: true, link });
  } catch (err: any) {
    console.error("[AdminLib] add item to collection error:", err);
    return res.status(500).json({ error: "Failed to add item to collection" });
  }
});

// DELETE /:slug/collections/:collectionId/items/:itemId
router.delete("/:slug/collections/:collectionId/items/:itemId", async (req, res) => {
  const { collectionId, itemId } = req.params;
  try {
    await db
      .delete(chefSignatureCollectionItems)
      .where(
        and(
          eq(chefSignatureCollectionItems.collectionId, collectionId),
          eq(chefSignatureCollectionItems.itemId, itemId)
        )
      );
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AdminLib] remove item from collection error:", err);
    return res.status(500).json({ error: "Failed to remove item from collection" });
  }
});

export default router;
