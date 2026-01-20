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
  age: z.number().int().min(0).max(120).nullable().optional(),
  height: z.number().int().min(0).max(300).nullable().optional(),
  weight: z.number().int().min(0).max(500).nullable().optional(),
  activityLevel: z.string().max(40).optional(),
  fitnessGoal: z.string().max(40).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
});

router.put("/profile", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
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
    if (patch.age !== undefined) updateData.age = patch.age;
    if (patch.height !== undefined) updateData.height = patch.height;
    if (patch.weight !== undefined) updateData.weight = patch.weight;
    if (patch.activityLevel !== undefined) updateData.activityLevel = patch.activityLevel;
    if (patch.fitnessGoal !== undefined) updateData.fitnessGoal = patch.fitnessGoal;
    if (patch.dietaryRestrictions !== undefined) updateData.dietaryRestrictions = patch.dietaryRestrictions;
    if (patch.allergies !== undefined) updateData.allergies = patch.allergies;

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
