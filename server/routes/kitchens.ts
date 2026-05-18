// server/routes/kitchens.ts
// Public-facing kitchen endpoints (auth required, no admin required).

import { Router } from "express";
import { db } from "../db";
import { creators, creatorSystemConfigs, users } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

// GET /api/kitchens/featured
// Returns kitchens where isVisible=true, ordered by displayPriority.
// Admins also see isVisible=false kitchens so they can preview their own.
router.get("/featured", async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const [adminRow] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, authReq.authUser.id))
      .limit(1);

    const isAdmin = adminRow?.isAdmin ?? false;

    const kitchens = await db
      .select({
        slug: creators.slug,
        displayName: creators.displayName,
        bio: creators.bio,
        logoUrl: creators.logoUrl,
        heroImageUrl: creators.heroImageUrl,
        brandingImageUrl: creators.brandingImageUrl,
        isFeatured: creators.isFeatured,
        isActive: creators.isActive,
        displayPriority: creators.displayPriority,
        creatorCategory: creators.creatorCategory,
      })
      .from(creators)
      .where(
        isAdmin
          ? eq(creators.creatorCategory, "chef_kitchen")
          : and(eq(creators.isVisible, true), eq(creators.creatorCategory, "chef_kitchen"))
      )
      .orderBy(asc(creators.displayPriority));

    return res.json({ kitchens, isAdmin });
  } catch (err: any) {
    console.error("[Kitchens] featured error:", err);
    return res.status(500).json({ error: "Failed to fetch featured kitchens" });
  }
});

// GET /api/kitchens/:slug
// Admins see any kitchen regardless of visibility/active status.
// Regular users see kitchens where isVisible=true (advertised), with isActive in the response.
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const authReq = req as AuthenticatedRequest;
    const [adminRow] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, authReq.authUser.id))
      .limit(1);

    const isAdmin = adminRow?.isAdmin ?? false;

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

    if (!row) {
      return res.status(404).json({ error: "Kitchen not found" });
    }

    // Admins bypass all gates; regular users need isVisible=true
    if (!isAdmin && !row.isVisible) {
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
      isActive: row.isActive,
      isAdmin,
      cuisineTypes: config.cuisineTypes ?? [],
      flavorProfiles: config.style?.flavorProfiles ?? [],
      primaryColor: config.primaryColor ?? null,
      accentColor: config.accentColor ?? null,
    });
  } catch (err: any) {
    console.error("[Kitchens] get error:", err);
    return res.status(500).json({ error: "Failed to fetch kitchen" });
  }
});

export default router;
