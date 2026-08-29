import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isValidIanaTimezone, setUserTimezone } from "../services/nutritionDayService";

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
  heatPreference: z.enum(["none", "mild", "medium", "hot", "very-hot", "unsure"]).optional().nullable(),
  preferredBuilder: z.string().max(60).optional(),
  palateSpiceTolerance: z.enum(["none", "mild", "medium", "hot"]).optional(),
  palateSeasoningIntensity: z.enum(["light", "balanced", "bold"]).optional(),
  palateFlavorStyle: z.enum(["classic", "herb", "savory", "bright"]).optional(),
  cuisinePreference: z.string().max(120).optional().nullable(),
  cuisineIntensity: z.enum(["light", "balanced", "authentic"]).optional().nullable(),
  fontSizePreference: z.enum(["standard", "large", "xl"]).optional(),
  narrationSpeedPreference: z.enum(["0.75", "1.0", "1.25", "1.5"]).optional(),
  sweetenerPreferences: z.array(z.string()).optional(),
  avoidedFoods: z.array(z.string()).optional(),
  fromOnboarding: z.boolean().optional(),
  // Client goals
  goalType: z.enum(["lose", "maintain", "gain"]).optional().nullable(),
  goalTarget: z.string().max(100).optional().nullable(),
  goalTimelineWeeks: z.number().int().min(1).max(260).optional().nullable(),
  goalStartDate: z.string().optional().nullable(),
  // Performance Overlay
  performanceOverlay: z.enum(["standard", "performance", "competition_prep", "recovery", "recomp"]).optional(),
  performanceControlMode: z.enum(["self_guided", "coach_controlled"]).optional(),
  timezone: z.string().max(100).optional(),
  timezoneChangeConfirmed: z.literal(true).optional(),
}).superRefine((value, ctx) => {
  if (value.timezone !== undefined) {
    if (!value.timezoneChangeConfirmed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["timezoneChangeConfirmed"], message: "Timezone changes require confirmation" });
    }
    if (!isValidIanaTimezone(value.timezone)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["timezone"], message: "Invalid IANA timezone" });
    }
  }
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
    if (patch.heatPreference !== undefined) updateData.heatPreference = patch.heatPreference;
    if (patch.preferredBuilder !== undefined) {
      updateData.preferredBuilder = patch.preferredBuilder;
      // Sync activeBoard when set during onboarding so the builder guard works for new users
      if (patch.fromOnboarding) {
        (updateData as any).activeBoard = patch.preferredBuilder;
      }
    }
    if (patch.palateSpiceTolerance !== undefined) updateData.palateSpiceTolerance = patch.palateSpiceTolerance;
    if (patch.palateSeasoningIntensity !== undefined) updateData.palateSeasoningIntensity = patch.palateSeasoningIntensity;
    if (patch.palateFlavorStyle !== undefined) updateData.palateFlavorStyle = patch.palateFlavorStyle;
    if (patch.cuisinePreference !== undefined) updateData.cuisinePreference = patch.cuisinePreference;
    if (patch.cuisineIntensity !== undefined) updateData.cuisineIntensity = patch.cuisineIntensity;
    if (patch.fontSizePreference !== undefined) updateData.fontSizePreference = patch.fontSizePreference;
    if (patch.narrationSpeedPreference !== undefined) updateData.narrationSpeedPreference = patch.narrationSpeedPreference;
    if (patch.sweetenerPreferences !== undefined) {
      // Normalize legacy vocabulary (old onboarding stored "sugar"/"avoid"/"monk-fruit")
      const normalizeSweetener = (v: string): string => {
        if (v === "sugar") return "regular_sugar";
        if (v === "avoid") return "avoid_sweeteners";
        if (v === "monk-fruit") return "monk_fruit";
        return v;
      };
      const prefs = patch.sweetenerPreferences.map(normalizeSweetener);
      updateData.sweetenerPreferences = prefs;

      // Bridge to the AI-facing columns so every generator sees the user's choices
      if (prefs.includes("avoid_sweeteners")) {
        updateData.preferredSweeteners = [];
        updateData.avoidSweeteners = ["all sweeteners"];
      } else if (prefs.length > 0) {
        updateData.preferredSweeteners = prefs;
        // If regular sugar is not explicitly selected, ban it so AI won't default to it
        // When regular sugar is NOT selected, ban all sugar variants so brown sugar,
        // cane sugar, agave, maple syrup, etc. don't slip through as "close enough"
        updateData.avoidSweeteners = prefs.includes("regular_sugar")
          ? []
          : ["white sugar", "brown sugar", "cane sugar", "raw sugar", "granulated sugar",
             "demerara sugar", "turbinado sugar", "coconut sugar", "powdered sugar",
             "agave", "agave nectar", "maple syrup", "corn syrup", "molasses"];
      } else {
        updateData.preferredSweeteners = [];
        updateData.avoidSweeteners = [];
      }
    }
    if (patch.avoidedFoods !== undefined) updateData.avoidedFoods = patch.avoidedFoods;
    if (patch.goalType !== undefined) updateData.goalType = patch.goalType;
    if (patch.goalTarget !== undefined) updateData.goalTarget = patch.goalTarget;
    if (patch.goalTimelineWeeks !== undefined) updateData.goalTimelineWeeks = patch.goalTimelineWeeks;
    if (patch.goalStartDate !== undefined) updateData.goalStartDate = patch.goalStartDate ? new Date(patch.goalStartDate) : null;
    if (patch.performanceOverlay !== undefined) updateData.performanceOverlay = patch.performanceOverlay;
    if (patch.performanceControlMode !== undefined) updateData.performanceControlMode = patch.performanceControlMode;
    if (patch.timezone !== undefined) {
      await setUserTimezone(userId, patch.timezone);
    }

    const updatedFields = Object.keys(updateData).filter(k => k !== 'updatedAt').join(', ');
    console.log(`✅ Profile updated for user ${userId}: ${updatedFields}`);

    if (Object.keys(updateData).some((key) => key !== "updatedAt")) {
      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId));
    }
    const { invalidatePrefix } = await import("../services/queryCache");
    invalidatePrefix(`profile:${userId}`);

    return res.json({ ok: true, timezone: patch.timezone });
  } catch (e) {
    console.error("Update profile error:", e);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
