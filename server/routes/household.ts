import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { db } from "../db";
import { users, householdProfiles } from "@shared/schema";
import { eq, and, count } from "drizzle-orm";
import { isHouseholdPlan, getMaxHouseholdProfiles } from "@shared/planFeatures";

const router = Router();

const ProfileCreateSchema = z.object({
  displayName: z.string().min(1).max(60),
  avatarEmoji: z.string().max(8).optional(),
  age: z.number().int().min(0).max(120).nullable().optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  healthConditions: z.array(z.string()).optional(),
  medicalConditions: z.array(z.string()).optional(),
  specialtyCondition: z.string().nullable().optional(),
  specialtyConditions: z.array(z.string()).optional(),
  dislikedFoods: z.array(z.string()).optional(),
  avoidedFoods: z.array(z.string()).optional(),
  likedFoods: z.array(z.string()).optional(),
  preferredSweeteners: z.array(z.string()).optional(),
  cuisinePreference: z.string().nullable().optional(),
  cuisineIntensity: z.enum(["light", "balanced", "authentic"]).nullable().optional(),
  palateSpiceTolerance: z.enum(["none", "mild", "medium", "hot"]).optional(),
  palateSeasoningIntensity: z.enum(["light", "balanced", "bold"]).optional(),
  palateFlavorStyle: z.enum(["classic", "herb", "savory", "bright"]).optional(),
  fitnessGoal: z.string().nullable().optional(),
  activityLevel: z.string().nullable().optional(),
  dailyCalorieTarget: z.number().int().nullable().optional(),
  dailyProteinTarget: z.number().int().nullable().optional(),
  dailyCarbsTarget: z.number().int().nullable().optional(),
  dailyFatTarget: z.number().int().nullable().optional(),
});

const ProfileUpdateSchema = ProfileCreateSchema.partial();

router.get("/profiles", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const profiles = await db
      .select()
      .from(householdProfiles)
      .where(eq(householdProfiles.ownerUserId, userId))
      .orderBy(householdProfiles.sortOrder, householdProfiles.createdAt);

    return res.json({ profiles });
  } catch (err) {
    console.error("[household] GET /profiles error:", err);
    return res.status(500).json({ error: "Failed to load profiles" });
  }
});

router.get("/profiles/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [profile] = await db
      .select()
      .from(householdProfiles)
      .where(
        and(
          eq(householdProfiles.id, req.params.id),
          eq(householdProfiles.ownerUserId, userId),
        ),
      )
      .limit(1);

    if (!profile) return res.status(404).json({ error: "Profile not found" });
    return res.json({ profile });
  } catch (err) {
    console.error("[household] GET /profiles/:id error:", err);
    return res.status(500).json({ error: "Failed to load profile" });
  }
});

router.post("/profiles", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [user] = await db
      .select({ planLookupKey: users.planLookupKey })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return res.status(401).json({ error: "User not found" });

    if (!isHouseholdPlan(user.planLookupKey)) {
      return res.status(403).json({
        error: "Household profiles require a Family plan",
        code: "NOT_HOUSEHOLD_PLAN",
      });
    }

    const [{ profileCount }] = await db
      .select({ profileCount: count() })
      .from(householdProfiles)
      .where(eq(householdProfiles.ownerUserId, userId));

    const maxProfiles = getMaxHouseholdProfiles(user.planLookupKey);
    if (profileCount >= maxProfiles) {
      return res.status(403).json({
        error: `Your plan supports up to ${maxProfiles} household profiles`,
        code: "PROFILE_LIMIT_REACHED",
        limit: maxProfiles,
        current: profileCount,
      });
    }

    const parsed = ProfileCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid profile data", details: parsed.error.flatten() });
    }

    const [profile] = await db
      .insert(householdProfiles)
      .values({
        ownerUserId: userId,
        ...parsed.data,
        sortOrder: profileCount,
      })
      .returning();

    console.log(`[household] Created profile "${profile.displayName}" for user ${userId}`);
    return res.status(201).json({ profile });
  } catch (err) {
    console.error("[household] POST /profiles error:", err);
    return res.status(500).json({ error: "Failed to create profile" });
  }
});

router.put("/profiles/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [existing] = await db
      .select({ id: householdProfiles.id })
      .from(householdProfiles)
      .where(
        and(
          eq(householdProfiles.id, req.params.id),
          eq(householdProfiles.ownerUserId, userId),
        ),
      )
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Profile not found" });

    const parsed = ProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid profile data", details: parsed.error.flatten() });
    }

    const [profile] = await db
      .update(householdProfiles)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(householdProfiles.id, req.params.id))
      .returning();

    return res.json({ profile });
  } catch (err) {
    console.error("[household] PUT /profiles/:id error:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

router.delete("/profiles/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [existing] = await db
      .select({ id: householdProfiles.id, isOwnerProfile: householdProfiles.isOwnerProfile })
      .from(householdProfiles)
      .where(
        and(
          eq(householdProfiles.id, req.params.id),
          eq(householdProfiles.ownerUserId, userId),
        ),
      )
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Profile not found" });
    if (existing.isOwnerProfile) {
      return res.status(403).json({ error: "Cannot delete the owner profile" });
    }

    await db
      .delete(householdProfiles)
      .where(eq(householdProfiles.id, req.params.id));

    const [currentUser] = await db
      .select({ activeHouseholdProfileId: users.activeHouseholdProfileId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (currentUser?.activeHouseholdProfileId === req.params.id) {
      await db
        .update(users)
        .set({ activeHouseholdProfileId: null } as any)
        .where(eq(users.id, userId));
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[household] DELETE /profiles/:id error:", err);
    return res.status(500).json({ error: "Failed to delete profile" });
  }
});

router.post("/active", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { profileId } = req.body as { profileId: string | null };

    if (profileId === null || profileId === undefined) {
      await db
        .update(users)
        .set({ activeHouseholdProfileId: null } as any)
        .where(eq(users.id, userId));
      console.log(`[household] Cleared active profile for user ${userId}`);
      return res.json({ activeProfileId: null });
    }

    const [profile] = await db
      .select({ id: householdProfiles.id, displayName: householdProfiles.displayName })
      .from(householdProfiles)
      .where(
        and(
          eq(householdProfiles.id, profileId),
          eq(householdProfiles.ownerUserId, userId),
        ),
      )
      .limit(1);

    if (!profile) return res.status(404).json({ error: "Profile not found" });

    await db
      .update(users)
      .set({ activeHouseholdProfileId: profileId } as any)
      .where(eq(users.id, userId));

    console.log(`[household] Set active profile "${profile.displayName}" for user ${userId}`);
    return res.json({ activeProfileId: profileId });
  } catch (err) {
    console.error("[household] POST /active error:", err);
    return res.status(500).json({ error: "Failed to set active profile" });
  }
});

export default router;
