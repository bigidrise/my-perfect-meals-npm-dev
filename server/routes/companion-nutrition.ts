import express from "express";
import multer from "multer";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, and, count } from "drizzle-orm";
import {
  companionProfiles,
  companionProfileImages,
  companionMeals,
  companionIngredientScans,
} from "../db/schema/companionProfiles";
import { buildCompanionProtocolEnvelope } from "../services/companionProtocolEnvelope";
import { checkIngredientSafety, scanRecipeForToxins } from "../services/companionToxicFirewall";
import OpenAI from "openai";

const router = express.Router();
const openai = new OpenAI();

// Multer: accept image files up to 8MB directly in memory (no object storage needed)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are accepted"));
  },
});

const MAX_ACTIVE_DOGS = 8;
const MAX_IMAGES_PER_DOG = 4;

function resolveUserId(req: any): string | undefined {
  return (
    req.authUser?.id ||
    (req.session as any)?.userId ||
    (req.user?.id !== "mock-user-id" ? req.user?.id : undefined)
  );
}

const requireAuth = async (req: any, res: any, next: any) => {
  const token = req.headers["x-auth-token"] as string | undefined;
  if (token) {
    try {
      const [tokenUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.authToken, token))
        .limit(1);
      if (tokenUser) req.user = { id: tokenUser.id };
    } catch {}
  }
  if (!req.user) req.user = {};
  next();
};

async function getProfileImages(profileId: string): Promise<string[]> {
  try {
    const imgs = await db
      .select()
      .from(companionProfileImages)
      .where(eq(companionProfileImages.profileId, profileId))
      .orderBy(companionProfileImages.sortOrder);
    return imgs.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)).map((i) => i.imageUrl);
  } catch {
    return [];
  }
}

// GET /api/companion/profiles — returns all profiles with their images
router.get("/profiles", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.json({ profiles: [] });

    const rows = await db
      .select()
      .from(companionProfiles)
      .where(eq(companionProfiles.userId, userId))
      .orderBy(companionProfiles.createdAt);

    const profilesWithImages = await Promise.all(
      rows.map(async (p) => ({
        ...p,
        images: await getProfileImages(p.id),
      }))
    );

    res.json({ profiles: profilesWithImages });
  } catch (err) {
    console.error("[companion] GET profiles error:", err);
    res.status(500).json({ error: "Failed to fetch dog profiles" });
  }
});

// POST /api/companion/profiles
router.post("/profiles", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    // Enforce max 8 active dogs
    const [{ total }] = await db
      .select({ total: count() })
      .from(companionProfiles)
      .where(and(eq(companionProfiles.userId, userId), eq(companionProfiles.status, "active")));
    if (Number(total) >= MAX_ACTIVE_DOGS) {
      return res.status(400).json({
        error: `You can have up to ${MAX_ACTIVE_DOGS} active dog profiles. Move a dog to Previous Companions to free a slot.`,
      });
    }

    const {
      name, breed, isMixedBreed, ageYears, ageMonths, sex, isNeutered,
      weightLbs, goalWeightLbs, activityLevel, bodyConditionScore,
      foodSensitivities, allergies, currentDietType, treatsPerDay,
      behaviorNotes, vetDietaryRestrictions, medications, wellnessGoals, photoUrl,
    } = req.body;

    if (!name || !breed || !ageYears || !sex || !weightLbs) {
      return res.status(400).json({ error: "Required fields: name, breed, ageYears, sex, weightLbs" });
    }

    const [profile] = await db
      .insert(companionProfiles)
      .values({
        userId,
        name,
        breed,
        isMixedBreed: isMixedBreed ?? false,
        ageYears: parseInt(ageYears),
        ageMonths: parseInt(ageMonths ?? 0),
        sex,
        isNeutered: isNeutered ?? false,
        weightLbs: parseInt(weightLbs),
        goalWeightLbs: goalWeightLbs ? parseInt(goalWeightLbs) : null,
        activityLevel: activityLevel ?? "moderate",
        bodyConditionScore: bodyConditionScore ? parseInt(bodyConditionScore) : null,
        foodSensitivities: foodSensitivities ?? [],
        allergies: allergies ?? [],
        currentDietType: currentDietType ?? "commercial",
        treatsPerDay: treatsPerDay ? parseInt(treatsPerDay) : 0,
        behaviorNotes: behaviorNotes ?? null,
        vetDietaryRestrictions: vetDietaryRestrictions ?? null,
        medications: medications ?? [],
        wellnessGoals: wellnessGoals ?? [],
        photoUrl: photoUrl ?? null,
        status: "active",
      })
      .returning();

    res.json({ profile: { ...profile, images: [] } });
  } catch (err) {
    console.error("[companion] POST profile error:", err);
    res.status(500).json({ error: "Failed to create dog profile" });
  }
});

// PUT /api/companion/profiles/:id
router.put("/profiles/:id", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const profileId = req.params.id;
    const updates = { ...req.body, updatedAt: new Date() };
    delete updates.id;
    delete updates.userId;

    const [updated] = await db
      .update(companionProfiles)
      .set(updates)
      .where(eq(companionProfiles.id, profileId))
      .returning();

    const images = await getProfileImages(profileId);
    res.json({ profile: { ...updated, images } });
  } catch (err) {
    console.error("[companion] PUT profile error:", err);
    res.status(500).json({ error: "Failed to update dog profile" });
  }
});

// PUT /api/companion/profiles/:id/archive  →  moves to "Previous Companions"
router.put("/profiles/:id/archive", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    await db
      .update(companionProfiles)
      .set({ status: "archived", isActive: false, updatedAt: new Date() })
      .where(and(eq(companionProfiles.id, req.params.id), eq(companionProfiles.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile status" });
  }
});

// PUT /api/companion/profiles/:id/memorial  →  moves to "In Memory"
router.put("/profiles/:id/memorial", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const { memorialMessage } = req.body;
    await db
      .update(companionProfiles)
      .set({
        status: "memorial",
        isActive: false,
        memorialMessage: memorialMessage ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(companionProfiles.id, req.params.id), eq(companionProfiles.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update profile status" });
  }
});

// PUT /api/companion/profiles/:id/restore  →  returns to "Active Companions"
router.put("/profiles/:id/restore", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const [{ total }] = await db
      .select({ total: count() })
      .from(companionProfiles)
      .where(and(eq(companionProfiles.userId, userId), eq(companionProfiles.status, "active")));
    if (Number(total) >= MAX_ACTIVE_DOGS) {
      return res.status(400).json({
        error: `You already have ${MAX_ACTIVE_DOGS} active dogs. Move one to Previous Companions first.`,
      });
    }

    await db
      .update(companionProfiles)
      .set({ status: "active", isActive: true, updatedAt: new Date() })
      .where(and(eq(companionProfiles.id, req.params.id), eq(companionProfiles.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to restore profile" });
  }
});

// DELETE /api/companion/profiles/:id  →  soft-archive (never hard delete)
router.delete("/profiles/:id", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    await db
      .update(companionProfiles)
      .set({ status: "archived", isActive: false, updatedAt: new Date() })
      .where(and(eq(companionProfiles.id, req.params.id), eq(companionProfiles.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to archive profile" });
  }
});

// ── Image endpoints ────────────────────────────────────────────────────────────

// GET /api/companion/profiles/:id/images
router.get("/profiles/:id/images", requireAuth, async (req, res) => {
  try {
    const imgs = await db
      .select()
      .from(companionProfileImages)
      .where(eq(companionProfileImages.profileId, req.params.id))
      .orderBy(companionProfileImages.sortOrder);
    const sorted = imgs.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
    res.json({ images: sorted });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

// POST /api/companion/profiles/:id/images
router.post("/profiles/:id/images", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const profileId = req.params.id;
    const { imageUrl, isPrimary } = req.body;
    if (!imageUrl) return res.status(400).json({ error: "imageUrl required" });

    const existing = await db
      .select()
      .from(companionProfileImages)
      .where(eq(companionProfileImages.profileId, profileId));

    if (existing.length >= MAX_IMAGES_PER_DOG) {
      return res.status(400).json({ error: `Maximum ${MAX_IMAGES_PER_DOG} images per dog.` });
    }

    const shouldBePrimary = isPrimary || existing.length === 0;

    if (shouldBePrimary && existing.length > 0) {
      await db
        .update(companionProfileImages)
        .set({ isPrimary: false })
        .where(eq(companionProfileImages.profileId, profileId));
    }

    const [img] = await db
      .insert(companionProfileImages)
      .values({
        profileId,
        userId,
        imageUrl,
        isPrimary: shouldBePrimary,
        sortOrder: existing.length,
      })
      .returning();

    if (shouldBePrimary) {
      await db
        .update(companionProfiles)
        .set({ photoUrl: imageUrl, primaryImageId: img.id, updatedAt: new Date() })
        .where(eq(companionProfiles.id, profileId));
    }

    res.json({ image: img });
  } catch (err) {
    console.error("[companion] POST image error:", err);
    res.status(500).json({ error: "Failed to add image" });
  }
});

// POST /api/companion/profiles/:id/images/upload  (direct multipart — no object storage needed)
router.post("/profiles/:id/images/upload", requireAuth, imageUpload.single("image"), async (req: any, res: any) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const profileId = req.params.id;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No image file provided" });

    const existing = await db
      .select()
      .from(companionProfileImages)
      .where(eq(companionProfileImages.profileId, profileId));

    if (existing.length >= MAX_IMAGES_PER_DOG) {
      return res.status(400).json({ error: `Maximum ${MAX_IMAGES_PER_DOG} images per dog.` });
    }

    const base64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const shouldBePrimary = existing.length === 0;

    if (shouldBePrimary && existing.length > 0) {
      await db
        .update(companionProfileImages)
        .set({ isPrimary: false })
        .where(eq(companionProfileImages.profileId, profileId));
    }

    const [img] = await db
      .insert(companionProfileImages)
      .values({
        profileId,
        userId,
        imageUrl: base64,
        isPrimary: shouldBePrimary,
        sortOrder: existing.length,
      })
      .returning();

    if (shouldBePrimary) {
      await db
        .update(companionProfiles)
        .set({ photoUrl: base64, primaryImageId: img.id, updatedAt: new Date() })
        .where(eq(companionProfiles.id, profileId));
    }

    res.json({ image: img });
  } catch (err) {
    console.error("[companion] POST image/upload error:", err);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// DELETE /api/companion/profiles/:id/images/:imageId
router.delete("/profiles/:id/images/:imageId", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const [img] = await db
      .select()
      .from(companionProfileImages)
      .where(eq(companionProfileImages.id, req.params.imageId))
      .limit(1);

    if (!img) return res.status(404).json({ error: "Image not found" });

    await db
      .delete(companionProfileImages)
      .where(eq(companionProfileImages.id, req.params.imageId));

    if (img.isPrimary) {
      const remaining = await db
        .select()
        .from(companionProfileImages)
        .where(eq(companionProfileImages.profileId, req.params.id))
        .orderBy(companionProfileImages.sortOrder)
        .limit(1);

      if (remaining.length > 0) {
        await db
          .update(companionProfileImages)
          .set({ isPrimary: true })
          .where(eq(companionProfileImages.id, remaining[0].id));
        await db
          .update(companionProfiles)
          .set({ photoUrl: remaining[0].imageUrl, primaryImageId: remaining[0].id, updatedAt: new Date() })
          .where(eq(companionProfiles.id, req.params.id));
      } else {
        await db
          .update(companionProfiles)
          .set({ photoUrl: null, primaryImageId: null, updatedAt: new Date() })
          .where(eq(companionProfiles.id, req.params.id));
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete image" });
  }
});

// PUT /api/companion/profiles/:id/images/:imageId/set-primary
router.put("/profiles/:id/images/:imageId/set-primary", requireAuth, async (req, res) => {
  try {
    const profileId = req.params.id;

    await db
      .update(companionProfileImages)
      .set({ isPrimary: false })
      .where(eq(companionProfileImages.profileId, profileId));

    const [img] = await db
      .update(companionProfileImages)
      .set({ isPrimary: true })
      .where(eq(companionProfileImages.id, req.params.imageId))
      .returning();

    await db
      .update(companionProfiles)
      .set({ photoUrl: img.imageUrl, primaryImageId: img.id, updatedAt: new Date() })
      .where(eq(companionProfiles.id, profileId));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to set primary image" });
  }
});

// ── Meal generation ────────────────────────────────────────────────────────────

// POST /api/companion/generate-meal
router.post("/generate-meal", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const { profileId, mealType = "main", specialRequest } = req.body;

    if (!profileId) return res.status(400).json({ error: "profileId required" });

    const [profile] = await db
      .select()
      .from(companionProfiles)
      .where(eq(companionProfiles.id, profileId))
      .limit(1);

    if (!profile) return res.status(404).json({ error: "Dog profile not found" });

    if (profile.status === "memorial") {
      return res.status(400).json({
        error: `${profile.name}'s profile is a memorial. New meal generation is disabled to preserve their memory.`,
      });
    }

    const envelope = buildCompanionProtocolEnvelope(profile as any);

    const mealTypeInstructions: Record<string, string> = {
      main: "Generate a complete, nutritious main meal suitable for this dog's profile.",
      treat: "Generate a healthy homemade dog treat recipe — small, bite-sized, easily digestible.",
      snack: "Generate a healthy snack or light between-meal food for this dog.",
      "meal-prep": "Generate a meal prep plan — a batch recipe that makes 5–7 servings, with storage instructions.",
    };

    const typeInstruction = mealTypeInstructions[mealType] || mealTypeInstructions.main;
    const specialNote = specialRequest ? `Special request from owner: ${specialRequest}` : "";

    const systemPrompt = `You are a companion nutrition intelligence specialist creating personalized, safe, homemade dog food recipes.

${envelope.promptBlock}

IMPORTANT: You are NOT a veterinarian. Do NOT make medical claims. Use language like "wellness support", "may help support", "nutrition guidance only".

You must respond with valid JSON in exactly this structure:
{
  "title": "Recipe name",
  "description": "2-3 sentence warm description of why this meal is great for this dog",
  "mealType": "${mealType}",
  "servingSize": "e.g. 1 cup per meal for a 30-lb dog",
  "estimatedCalories": 250,
  "proteinGrams": 20,
  "ingredients": [
    { "name": "Ingredient name", "amount": "Amount", "notes": "Optional prep note" }
  ],
  "instructions": [
    "Step 1...",
    "Step 2..."
  ],
  "wellnessNotes": [
    "Note about why an ingredient benefits this dog",
    "Note about another key ingredient"
  ],
  "citationReferences": [
    "Brief source reference relevant to wellness goals"
  ],
  "storageNote": "How long this keeps and how to store",
  "veterinaryNote": "This recipe is for wellness nutrition support only. Consult your veterinarian for medical conditions or significant dietary changes."
}`;

    const userPrompt = `${typeInstruction}
${specialNote}

Dog profile: ${profile.name}, ${profile.breed}, ${profile.ageYears} years old, ${profile.weightLbs} lbs, ${profile.activityLevel} activity level.
Wellness goals: ${(profile.wellnessGoals as string[] || []).join(", ") || "general wellness"}

Generate a recipe now.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1200,
    });

    const rawContent = completion.choices[0]?.message?.content || "{}";
    let meal: any;
    try {
      meal = JSON.parse(rawContent);
    } catch {
      return res.status(500).json({ error: "Generation failed — invalid AI response" });
    }

    if (!Array.isArray(meal.ingredients)) meal.ingredients = [];
    if (!Array.isArray(meal.instructions)) meal.instructions = [];
    if (!Array.isArray(meal.wellnessNotes)) meal.wellnessNotes = meal.wellnessNotes ? [String(meal.wellnessNotes)] : [];
    if (!Array.isArray(meal.citationReferences)) meal.citationReferences = [];
    if (typeof meal.estimatedCalories !== "number") meal.estimatedCalories = meal.estimatedCalories ? parseInt(meal.estimatedCalories) || null : null;
    if (typeof meal.proteinGrams !== "number") meal.proteinGrams = meal.proteinGrams ? parseInt(meal.proteinGrams) || null : null;

    const ingredientScanText = (Array.isArray(meal.ingredients) ? meal.ingredients : [])
      .map((ing: any) => (typeof ing === "string" ? ing : JSON.stringify(ing)))
      .join(" | ");
    const scanResult = scanRecipeForToxins(ingredientScanText);

    if (!scanResult.safe) {
      console.warn("[companion] Toxic firewall triggered, regenerating:", scanResult.violations);
      return res.status(422).json({
        error: "Generated recipe contained flagged ingredients and was blocked for your dog's safety. Please try again.",
        violations: scanResult.violations.map((v) => ({
          ingredient: v.ingredient,
          reason: v.reason,
          substitution: v.substitution,
        })),
      });
    }

    let savedMeal = null;
    if (userId) {
      try {
        const [dbMeal] = await db
          .insert(companionMeals)
          .values({
            userId,
            profileId,
            mealType,
            title: meal.title,
            description: meal.description,
            ingredients: meal.ingredients || [],
            instructions: meal.instructions || [],
            servingSize: meal.servingSize,
            estimatedCalories: meal.estimatedCalories || null,
            proteinGrams: meal.proteinGrams || null,
            wellnessGoalsAddressed: profile.wellnessGoals as string[] || [],
            citationSources: envelope.citationSources,
            isSaved: false,
          })
          .returning();
        savedMeal = dbMeal;
      } catch (dbErr) {
        console.error("[companion] DB save error:", dbErr);
      }
    }

    res.json({
      meal: {
        ...meal,
        id: savedMeal?.id,
        citationSources: envelope.citationSources,
        activeLayers: envelope.activeLayers,
      },
    });
  } catch (err) {
    console.error("[companion] generate-meal error:", err);
    res.status(500).json({ error: "Failed to generate dog meal" });
  }
});

// POST /api/companion/save-meal/:id
router.post("/save-meal/:id", requireAuth, async (req, res) => {
  try {
    await db
      .update(companionMeals)
      .set({ isSaved: true })
      .where(eq(companionMeals.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save meal" });
  }
});

// GET /api/companion/meals/:profileId
router.get("/meals/:profileId", requireAuth, async (req, res) => {
  try {
    const meals = await db
      .select()
      .from(companionMeals)
      .where(eq(companionMeals.profileId, req.params.profileId))
      .orderBy(companionMeals.generatedAt);
    res.json({ meals });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch meals" });
  }
});

// POST /api/companion/scan-ingredient
router.post("/scan-ingredient", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const { ingredient, profileId } = req.body;

    if (!ingredient?.trim()) {
      return res.status(400).json({ error: "ingredient required" });
    }

    const safetyResult = checkIngredientSafety(ingredient.trim());

    let wellnessScore: number | null = null;
    let wellnessNotes: string | null = null;
    let betterOptions: string[] = [];

    if (safetyResult.safe) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a canine nutrition expert. Rate this ingredient for dogs and respond with JSON:
{
  "wellnessScore": 1-10,
  "wellnessNotes": "1-2 sentences on nutritional value for dogs",
  "betterOptions": ["alternative 1", "alternative 2"]
}
Keep it brief and dog-specific.`,
            },
            { role: "user", content: `Evaluate for dogs: ${ingredient}` },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 200,
        });
        const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
        wellnessScore = parsed.wellnessScore || null;
        wellnessNotes = parsed.wellnessNotes || null;
        betterOptions = parsed.betterOptions || [];
      } catch {}
    }

    if (userId) {
      try {
        await db.insert(companionIngredientScans).values({
          userId,
          profileId: profileId || null,
          ingredient: ingredient.trim(),
          safetyStatus: safetyResult.severity,
          toxicityReason: safetyResult.reason || null,
          safeSubstitution: safetyResult.substitution || null,
        });
      } catch {}
    }

    res.json({
      ingredient: ingredient.trim(),
      safetyStatus: safetyResult.severity,
      safe: safetyResult.safe,
      reason: safetyResult.reason || null,
      substitution: safetyResult.substitution || null,
      wellnessScore,
      wellnessNotes,
      betterOptions,
    });
  } catch (err) {
    console.error("[companion] scan-ingredient error:", err);
    res.status(500).json({ error: "Failed to scan ingredient" });
  }
});

export default router;
