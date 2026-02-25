import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().max(120).optional(),
  nickname: z.string().max(60).optional().nullable(),
  age: z.number().int().min(0).max(120).nullable().optional(),
  height: z.number().int().min(0).max(300).nullable().optional(),
  weight: z.number().int().min(0).max(500).nullable().optional(),
  activityLevel: z.string().max(40).optional(),
  fitnessGoal: z.string().max(40).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  medicalConditions: z.array(z.string()).optional(),
  flavorPreference: z.string().max(60).optional(),
  preferredBuilder: z.string().max(60).optional(),
  palateSpiceTolerance: z.enum(["none", "mild", "medium", "hot"]).optional(),
  palateSeasoningIntensity: z.enum(["light", "balanced", "bold"]).optional(),
  palateFlavorStyle: z.enum(["classic", "herb", "savory", "bright"]).optional(),
  fontSizePreference: z.enum(["standard", "large", "xl"]).optional(),
  fromOnboarding: z.boolean().optional(),
});

router.put("/profile", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error("Profile update validation error:", parsed.error.flatten());
      return res.status(400).json({ 
        error: "Invalid payload", 
        details: parsed.error.flatten() 
      });
    }

    const patch = parsed.data;

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (patch.firstName !== undefined) updateData.firstName = patch.firstName;
    if (patch.lastName !== undefined) updateData.lastName = patch.lastName;
    if (patch.nickname !== undefined) updateData.nickname = patch.nickname;
    if (patch.age !== undefined) updateData.age = patch.age;
    if (patch.height !== undefined) updateData.height = patch.height;
    if (patch.weight !== undefined) updateData.weight = patch.weight;
    if (patch.activityLevel !== undefined) updateData.activityLevel = patch.activityLevel;
    if (patch.fitnessGoal !== undefined) updateData.fitnessGoal = patch.fitnessGoal;
    if (patch.dietaryRestrictions !== undefined) updateData.dietaryRestrictions = patch.dietaryRestrictions;
    if (patch.allergies !== undefined) updateData.allergies = patch.allergies;
    if (patch.medicalConditions !== undefined) updateData.medicalConditions = patch.medicalConditions;
    if (patch.flavorPreference !== undefined) updateData.flavorPreference = patch.flavorPreference;
    if (patch.preferredBuilder !== undefined) updateData.preferredBuilder = patch.preferredBuilder;
    if (patch.palateSpiceTolerance !== undefined) updateData.palateSpiceTolerance = patch.palateSpiceTolerance;
    if (patch.palateSeasoningIntensity !== undefined) updateData.palateSeasoningIntensity = patch.palateSeasoningIntensity;
    if (patch.palateFlavorStyle !== undefined) updateData.palateFlavorStyle = patch.palateFlavorStyle;
    if (patch.fontSizePreference !== undefined) updateData.fontSizePreference = patch.fontSizePreference;

    const updatedFields = Object.keys(updateData).filter(k => k !== 'updatedAt').join(', ');
    console.log(`✅ Profile updated for user ${userId}: ${updatedFields}`);

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    return res.json({ ok: true });
  } catch (e) {
    console.error("Update profile error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
