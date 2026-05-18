// server/routes/adminChefKitchens.ts
// Admin-only CRUD for Chef Kitchen infrastructure (Phase 1 — dormant).
// All routes require requireAuth + requireAdmin middleware applied at mount point.

import { Router } from "express";
import { db } from "../db";
import { creators, creatorSystemConfigs } from "@shared/schema";
import { eq, asc, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ─── GET / — list all kitchens ────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const kitchens = await db
      .select({
        id: creators.id,
        slug: creators.slug,
        displayName: creators.displayName,
        type: creators.type,
        source: creators.source,
        creatorCategory: creators.creatorCategory,
        status: creators.status,
        isActive: creators.isActive,
        isVisible: creators.isVisible,
        isFeatured: creators.isFeatured,
        displayPriority: creators.displayPriority,
        bio: creators.bio,
        logoUrl: creators.logoUrl,
        heroImageUrl: creators.heroImageUrl,
        brandingImageUrl: creators.brandingImageUrl,
        userId: creators.userId,
        activatedAt: creators.activatedAt,
        createdAt: creators.createdAt,
        updatedAt: creators.updatedAt,
      })
      .from(creators)
      .orderBy(asc(creators.displayPriority), desc(creators.createdAt));

    return res.json({ kitchens });
  } catch (err: any) {
    console.error("[AdminKitchens] list error:", err);
    return res.status(500).json({ error: "Failed to list kitchens" });
  }
});

// ─── GET /:slug/config — get single kitchen + config ─────────────────────────
router.get("/:slug/config", async (req, res) => {
  const { slug } = req.params;
  try {
    const [row] = await db
      .select({
        id: creators.id,
        slug: creators.slug,
        displayName: creators.displayName,
        type: creators.type,
        source: creators.source,
        creatorCategory: creators.creatorCategory,
        status: creators.status,
        isActive: creators.isActive,
        isVisible: creators.isVisible,
        isFeatured: creators.isFeatured,
        displayPriority: creators.displayPriority,
        bio: creators.bio,
        logoUrl: creators.logoUrl,
        heroImageUrl: creators.heroImageUrl,
        brandingImageUrl: creators.brandingImageUrl,
        userId: creators.userId,
        configJson: creatorSystemConfigs.configJson,
        configVersion: creatorSystemConfigs.version,
      })
      .from(creators)
      .leftJoin(creatorSystemConfigs, eq(creatorSystemConfigs.creatorId, creators.id))
      .where(eq(creators.slug, slug))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Kitchen not found" });
    return res.json({ kitchen: row });
  } catch (err: any) {
    console.error("[AdminKitchens] get config error:", err);
    return res.status(500).json({ error: "Failed to fetch kitchen config" });
  }
});

// ─── POST / — create a new kitchen ───────────────────────────────────────────
const createSchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9_-]+$/, "Slug must be lowercase letters, numbers, hyphens or underscores"),
  displayName: z.string().min(2).max(80),
  type: z.string().default("chef"),
  creatorCategory: z.enum(["standard_creator", "chef_kitchen", "supplement_partner", "athlete_partner"]).default("chef_kitchen"),
  bio: z.string().max(600).optional(),
  logoUrl: z.string().optional(),
  heroImageUrl: z.string().optional(),
  brandingImageUrl: z.string().optional(),
  displayPriority: z.number().int().min(0).default(0),
  personaPrompt: z.string().max(1200).optional(),
  flavorProfiles: z.array(z.string()).optional(),
  cuisineTypes: z.array(z.string()).optional(),
  techniques: z.array(z.string()).optional(),
  primaryColor: z.string().max(20).optional().nullable(),
  accentColor: z.string().max(20).optional().nullable(),
});

router.post("/", async (req, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const data = parsed.data;

    const [slugConflict] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, data.slug))
      .limit(1);
    if (slugConflict) return res.status(409).json({ error: "That slug is already taken" });

    const [kitchen] = await db
      .insert(creators)
      .values({
        slug: data.slug,
        displayName: data.displayName,
        type: data.type,
        source: "admin_created",
        creatorCategory: data.creatorCategory,
        status: "invited",
        tier: "gifted",
        isActive: false,
        isVisible: false,
        isFeatured: false,
        displayPriority: data.displayPriority,
        bio: data.bio ?? null,
        logoUrl: data.logoUrl ?? null,
        heroImageUrl: data.heroImageUrl ?? null,
        brandingImageUrl: data.brandingImageUrl ?? null,
      })
      .returning();

    const configJson = {
      id: kitchen.slug,
      name: kitchen.displayName,
      type: "chef",
      supports: { meals: true, desserts: true, beverages: true },
      personaPrompt: data.personaPrompt ?? null,
      cuisineTypes: data.cuisineTypes ?? [],
      primaryColor: data.primaryColor ?? null,
      accentColor: data.accentColor ?? null,
      style: {
        techniques: data.techniques ?? [],
        flavorProfiles: data.flavorProfiles ?? [],
        ingredientBias: [],
        naming: { pattern: "technique-first", includeSauce: false },
        instructionRules: {
          requireHighHeatProtein: false,
          requireSauceBuild: false,
          requireLayering: false,
        },
        description: { tone: "chef", forbidWords: [] },
      },
    };

    await db.insert(creatorSystemConfigs).values({
      creatorId: kitchen.id,
      configJson,
      version: 1,
    });

    console.log(`[AdminKitchens] Created kitchen "${kitchen.displayName}" (${kitchen.slug})`);
    return res.status(201).json({ success: true, kitchen });
  } catch (err: any) {
    console.error("[AdminKitchens] create error:", err);
    return res.status(500).json({ error: "Failed to create kitchen" });
  }
});

// ─── PATCH /:slug — update kitchen fields + config ───────────────────────────
const updateSchema = z.object({
  displayName: z.string().min(2).max(80).optional(),
  bio: z.string().max(600).optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  heroImageUrl: z.string().optional().nullable(),
  brandingImageUrl: z.string().optional().nullable(),
  displayPriority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  creatorCategory: z.enum(["standard_creator", "chef_kitchen", "supplement_partner", "athlete_partner"]).optional(),
  personaPrompt: z.string().max(1200).optional().nullable(),
  flavorProfiles: z.array(z.string()).optional(),
  cuisineTypes: z.array(z.string()).optional(),
  techniques: z.array(z.string()).optional(),
  primaryColor: z.string().max(20).optional().nullable(),
  accentColor: z.string().max(20).optional().nullable(),
});

router.patch("/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const data = parsed.data;

    const [existing] = await db
      .select({ id: creators.id })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Kitchen not found" });

    const creatorUpdate: Record<string, any> = { updatedAt: new Date() };
    if (data.displayName !== undefined) creatorUpdate.displayName = data.displayName;
    if (data.bio !== undefined) creatorUpdate.bio = data.bio;
    if (data.logoUrl !== undefined) creatorUpdate.logoUrl = data.logoUrl;
    if (data.heroImageUrl !== undefined) creatorUpdate.heroImageUrl = data.heroImageUrl;
    if (data.brandingImageUrl !== undefined) creatorUpdate.brandingImageUrl = data.brandingImageUrl;
    if (data.displayPriority !== undefined) creatorUpdate.displayPriority = data.displayPriority;
    if (data.isVisible !== undefined) creatorUpdate.isVisible = data.isVisible;
    if (data.isFeatured !== undefined) creatorUpdate.isFeatured = data.isFeatured;
    if (data.creatorCategory !== undefined) creatorUpdate.creatorCategory = data.creatorCategory;
    if (data.isActive !== undefined) {
      creatorUpdate.isActive = data.isActive;
      creatorUpdate.status = data.isActive ? "active" : "invited";
      if (data.isActive) creatorUpdate.activatedAt = new Date();
    }

    await db.update(creators).set(creatorUpdate).where(eq(creators.id, existing.id));

    const configChanged =
      data.personaPrompt !== undefined ||
      data.flavorProfiles !== undefined ||
      data.cuisineTypes !== undefined ||
      data.techniques !== undefined ||
      data.primaryColor !== undefined ||
      data.accentColor !== undefined;

    if (configChanged) {
      const [configRow] = await db
        .select({ id: creatorSystemConfigs.id, configJson: creatorSystemConfigs.configJson })
        .from(creatorSystemConfigs)
        .where(eq(creatorSystemConfigs.creatorId, existing.id))
        .limit(1);

      if (configRow) {
        const current = (configRow.configJson as any) ?? {};
        const updatedStyle = {
          ...((current.style as any) ?? {}),
          ...(data.techniques !== undefined ? { techniques: data.techniques } : {}),
          ...(data.flavorProfiles !== undefined ? { flavorProfiles: data.flavorProfiles } : {}),
        };
        const updatedConfig = {
          ...current,
          style: updatedStyle,
          ...(data.personaPrompt !== undefined ? { personaPrompt: data.personaPrompt } : {}),
          ...(data.cuisineTypes !== undefined ? { cuisineTypes: data.cuisineTypes } : {}),
          ...(data.primaryColor !== undefined ? { primaryColor: data.primaryColor } : {}),
          ...(data.accentColor !== undefined ? { accentColor: data.accentColor } : {}),
        };
        await db
          .update(creatorSystemConfigs)
          .set({ configJson: updatedConfig, updatedAt: new Date() })
          .where(eq(creatorSystemConfigs.id, configRow.id));
      }
    }

    console.log(`[AdminKitchens] Updated kitchen "${slug}"`);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AdminKitchens] update error:", err);
    return res.status(500).json({ error: "Failed to update kitchen" });
  }
});

// ─── DELETE /:slug — soft deactivate ─────────────────────────────────────────
router.delete("/:slug", async (req, res) => {
  const { slug } = req.params;
  try {
    const [existing] = await db
      .select({ id: creators.id, displayName: creators.displayName })
      .from(creators)
      .where(eq(creators.slug, slug))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Kitchen not found" });

    await db.update(creators).set({
      isActive: false,
      isVisible: false,
      isFeatured: false,
      status: "rejected",
      updatedAt: new Date(),
    }).where(eq(creators.id, existing.id));

    console.log(`[AdminKitchens] Deactivated kitchen "${existing.displayName}" (${slug})`);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("[AdminKitchens] delete error:", err);
    return res.status(500).json({ error: "Failed to deactivate kitchen" });
  }
});

export default router;
