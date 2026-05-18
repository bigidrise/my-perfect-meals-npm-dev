// server/routes/kitchens.ts
// Public-facing kitchen endpoints (auth required, no admin required).
// Phase 1: Only featured + visible kitchens are returned.

import { Router } from "express";
import { db } from "../db";
import { creators, creatorSystemConfigs } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

// GET /api/kitchens/featured
// Returns kitchens where isVisible=true and isActive=true, ordered by displayPriority.
// Phase 1: All kitchens are isVisible=false → returns [] → Lifestyle Hub shows placeholder.
router.get("/featured", async (_req, res) => {
  try {
    const kitchens = await db
      .select({
        slug: creators.slug,
        displayName: creators.displayName,
        bio: creators.bio,
        logoUrl: creators.logoUrl,
        heroImageUrl: creators.heroImageUrl,
        brandingImageUrl: creators.brandingImageUrl,
        isFeatured: creators.isFeatured,
        displayPriority: creators.displayPriority,
        creatorCategory: creators.creatorCategory,
      })
      .from(creators)
      .where(and(eq(creators.isVisible, true), eq(creators.isActive, true)))
      .orderBy(asc(creators.displayPriority));

    return res.json({ kitchens });
  } catch (err: any) {
    console.error("[Kitchens] featured error:", err);
    return res.status(500).json({ error: "Failed to fetch featured kitchens" });
  }
});

// GET /api/kitchens/:slug
// Returns a single visible kitchen's public profile + partial config.
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const [row] = await db
      .select({
        slug: creators.slug,
        displayName: creators.displayName,
        bio: creators.bio,
        logoUrl: creators.logoUrl,
        heroImageUrl: creators.heroImageUrl,
        brandingImageUrl: creators.brandingImageUrl,
        isFeatured: creators.isFeatured,
        creatorCategory: creators.creatorCategory,
        isActive: creators.isActive,
        isVisible: creators.isVisible,
        configJson: creatorSystemConfigs.configJson,
      })
      .from(creators)
      .leftJoin(creatorSystemConfigs, eq(creatorSystemConfigs.creatorId, creators.id))
      .where(eq(creators.slug, slug))
      .limit(1);

    if (!row || !row.isActive || !row.isVisible) {
      return res.status(404).json({ error: "Kitchen not found" });
    }

    const config = (row.configJson as any) ?? {};
    return res.json({
      slug: row.slug,
      displayName: row.displayName,
      bio: row.bio,
      logoUrl: row.logoUrl,
      heroImageUrl: row.heroImageUrl,
      brandingImageUrl: row.brandingImageUrl,
      isFeatured: row.isFeatured,
      creatorCategory: row.creatorCategory,
      cuisineTypes: config.cuisineTypes ?? [],
      flavorProfiles: config.style?.flavorProfiles ?? [],
    });
  } catch (err: any) {
    console.error("[Kitchens] get error:", err);
    return res.status(500).json({ error: "Failed to fetch kitchen" });
  }
});

export default router;
