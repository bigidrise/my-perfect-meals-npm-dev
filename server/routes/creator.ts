// server/routes/creator.ts
// Self-serve creator onboarding + studio endpoints
//
// POST /api/creator/onboard  — intake form → creator row + config → activate
// GET  /api/creator/me       — returns current user's creator profile

import type { Express } from "express";
import { db } from "../db";
import { users, creators, creatorSystemConfigs, creatorMeals } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { mapQuestionnaireToSystemConfig, type OnboardingAnswers } from "../services/creatorSystems/mapQuestionnaireToSystemConfig";
import { z } from "zod";

const onboardSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9_-]+$/, "Slug must be lowercase letters, numbers, hyphens, or underscores"),
  type: z.enum(["chef", "baker", "nutrition_coach", "performance_coach", "physician"]),
  supports: z.array(z.enum(["Meals", "Desserts", "Beverages"])).min(1),
  techniques: z.array(z.string()),
  flavors: z.array(z.string()),
  ingredients: z.array(z.string()),
  namingPattern: z.enum(["technique-first", "flavor-first"]),
  includeSauce: z.boolean(),
  highHeat: z.boolean(),
  sauceBuild: z.boolean(),
  layering: z.boolean(),
  tone: z.enum(["chef", "coaching", "clinical"]),
  forbiddenWords: z.array(z.string()).optional(),
});

export function registerCreatorRoutes(app: Express) {

  // POST /api/creator/onboard
  // Takes intake form answers → creates creator + config → activates them
  app.post("/api/creator/onboard", requireAuth, async (req: any, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser.id;

    try {
      const parsed = onboardSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid intake form", details: parsed.error.flatten() });
      }
      const answers = parsed.data as OnboardingAnswers;

      // Check if user already has a creator record
      const [existing] = await db
        .select({ id: creators.id, status: creators.status })
        .from(creators)
        .where(eq(creators.userId, userId))
        .limit(1);

      if (existing) {
        return res.status(409).json({ error: "Creator account already exists", creatorId: existing.id });
      }

      // Check slug uniqueness
      const [slugConflict] = await db
        .select({ id: creators.id })
        .from(creators)
        .where(eq(creators.slug, answers.slug))
        .limit(1);

      if (slugConflict) {
        return res.status(409).json({ error: "That studio name is already taken. Please choose a different one." });
      }

      // Build config from answers (deterministic — no AI)
      const config = mapQuestionnaireToSystemConfig(answers);

      // Create creator row — intake_submitted, not auto-activated
      // A human reviews every application before activation
      const [creator] = await db
        .insert(creators)
        .values({
          userId,
          slug: answers.slug,
          displayName: answers.name,
          type: answers.type,
          status: "intake_submitted",
          tier: "self_serve",
          isActive: false,
        })
        .returning();

      // Save config to DB (unpublished until reviewed and activated)
      await db.insert(creatorSystemConfigs).values({
        creatorId: creator.id,
        configJson: config as any,
        version: 1,
      });

      console.log(`[Creator] New application received: "${answers.name}" (slug: ${answers.slug}) for userId: ${userId}`);

      return res.status(201).json({
        success: true,
        creatorId: creator.id,
        slug: creator.slug,
        displayName: creator.displayName,
        message: "Your application has been received. We'll be in touch within 2–3 business days.",
      });

    } catch (err: any) {
      console.error("[Creator] Onboard error:", err);
      return res.status(500).json({ error: "Failed to create studio" });
    }
  });

  // GET /api/creator/me
  // Returns the current user's creator profile + catalog summary
  app.get("/api/creator/me", requireAuth, async (req: any, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser.id;

    try {
      const [creator] = await db
        .select()
        .from(creators)
        .where(eq(creators.userId, userId))
        .limit(1);

      if (!creator) {
        return res.status(404).json({ error: "No creator profile found" });
      }

      const meals = await db
        .select({
          id: creatorMeals.id,
          title: creatorMeals.title,
          description: creatorMeals.description,
          isPublished: creatorMeals.isPublished,
          createdAt: creatorMeals.createdAt,
        })
        .from(creatorMeals)
        .where(eq(creatorMeals.creatorId, creator.id))
        .orderBy(desc(creatorMeals.createdAt))
        .limit(50);

      return res.json({
        id: creator.id,
        userId: creator.userId,
        slug: creator.slug,
        displayName: creator.displayName,
        type: creator.type,
        status: creator.status,
        tier: creator.tier,
        isActive: creator.isActive,
        activatedAt: creator.activatedAt,
        catalogMeals: meals,
      });

    } catch (err: any) {
      console.error("[Creator] /me error:", err);
      return res.status(500).json({ error: "Failed to fetch creator profile" });
    }
  });

  // POST /api/creator/catalog/save
  // Saves a generated meal to the creator's signature catalog
  app.post("/api/creator/catalog/save", requireAuth, async (req: any, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser.id;

    try {
      const [creator] = await db
        .select({ id: creators.id, slug: creators.slug, isActive: creators.isActive })
        .from(creators)
        .where(eq(creators.userId, userId))
        .limit(1);

      if (!creator || !creator.isActive) {
        return res.status(403).json({ error: "Active creator account required" });
      }

      const { meal } = req.body;
      if (!meal || typeof meal !== "object") {
        return res.status(400).json({ error: "meal object required" });
      }

      const title = meal.name || meal.title || "Untitled Meal";
      const description = meal.description || null;

      const [saved] = await db
        .insert(creatorMeals)
        .values({
          creatorId: creator.id,
          creatorSystemId: creator.slug,
          title,
          description,
          mealJson: meal,
          isPublished: true,
        })
        .returning({ id: creatorMeals.id });

      return res.status(201).json({ success: true, catalogMealId: saved.id, title });

    } catch (err: any) {
      console.error("[Creator] Catalog save error:", err);
      return res.status(500).json({ error: "Failed to save to catalog" });
    }
  });
}
