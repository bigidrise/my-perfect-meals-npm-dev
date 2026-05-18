// server/routes/kitchenLibrary.ts
// Public read-only endpoints for the Signature Library (Phase 1).
// Auth required; no admin role needed.

import { Router } from "express";
import { db } from "../db";
import {
  creators,
  chefSignatureItems,
  chefSignatureCollections,
  chefSignatureCollectionItems,
} from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

// GET /api/kitchens/:slug/items
// Returns all published signature items for this kitchen, ordered by sortOrder.
router.get("/:slug/items", async (req, res) => {
  const { slug } = req.params;
  try {
    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(and(eq(creators.slug, slug), eq(creators.isVisible, true)))
      .limit(1);

    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    const items = await db
      .select({
        id: chefSignatureItems.id,
        kind: chefSignatureItems.kind,
        title: chefSignatureItems.title,
        subtitle: chefSignatureItems.subtitle,
        description: chefSignatureItems.description,
        mediaUrl: chefSignatureItems.mediaUrl,
        tags: chefSignatureItems.tags,
        techniques: chefSignatureItems.techniques,
        ingredients: chefSignatureItems.ingredients,
        isFeatured: chefSignatureItems.isFeatured,
        sortOrder: chefSignatureItems.sortOrder,
        publishedAt: chefSignatureItems.publishedAt,
      })
      .from(chefSignatureItems)
      .where(
        and(
          eq(chefSignatureItems.creatorId, creator.id),
          eq(chefSignatureItems.isPublished, true)
        )
      )
      .orderBy(asc(chefSignatureItems.sortOrder), asc(chefSignatureItems.publishedAt));

    return res.json({ items });
  } catch (err: any) {
    console.error("[KitchenLibrary] items error:", err);
    return res.status(500).json({ error: "Failed to fetch items" });
  }
});

// GET /api/kitchens/:slug/collections
// Returns published collections with their published items.
router.get("/:slug/collections", async (req, res) => {
  const { slug } = req.params;
  try {
    const [creator] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(and(eq(creators.slug, slug), eq(creators.isVisible, true)))
      .limit(1);

    if (!creator) return res.status(404).json({ error: "Kitchen not found" });

    const collections = await db
      .select({
        id: chefSignatureCollections.id,
        slug: chefSignatureCollections.slug,
        title: chefSignatureCollections.title,
        description: chefSignatureCollections.description,
        coverMediaUrl: chefSignatureCollections.coverMediaUrl,
        isFeatured: chefSignatureCollections.isFeatured,
        sortOrder: chefSignatureCollections.sortOrder,
      })
      .from(chefSignatureCollections)
      .where(
        and(
          eq(chefSignatureCollections.creatorId, creator.id),
          eq(chefSignatureCollections.isPublished, true)
        )
      )
      .orderBy(asc(chefSignatureCollections.sortOrder));

    const collectionIds = collections.map((c) => c.id);
    let itemsByCollection: Record<string, any[]> = {};

    if (collectionIds.length > 0) {
      for (const coll of collections) {
        const rows = await db
          .select({
            id: chefSignatureItems.id,
            kind: chefSignatureItems.kind,
            title: chefSignatureItems.title,
            subtitle: chefSignatureItems.subtitle,
            mediaUrl: chefSignatureItems.mediaUrl,
            position: chefSignatureCollectionItems.position,
          })
          .from(chefSignatureCollectionItems)
          .innerJoin(
            chefSignatureItems,
            and(
              eq(chefSignatureCollectionItems.itemId, chefSignatureItems.id),
              eq(chefSignatureItems.isPublished, true)
            )
          )
          .where(eq(chefSignatureCollectionItems.collectionId, coll.id))
          .orderBy(asc(chefSignatureCollectionItems.position));
        itemsByCollection[coll.id] = rows;
      }
    }

    const result = collections.map((c) => ({
      ...c,
      items: itemsByCollection[c.id] ?? [],
    }));

    return res.json({ collections: result });
  } catch (err: any) {
    console.error("[KitchenLibrary] collections error:", err);
    return res.status(500).json({ error: "Failed to fetch collections" });
  }
});

export default router;
