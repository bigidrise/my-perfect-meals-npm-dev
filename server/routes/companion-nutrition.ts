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
import { buildFelineProtocolEnvelope } from "../services/felineProtocolEnvelope";
import { scanRecipeForFelineToxins } from "../services/felineToxicFirewall";
import { checkIngredientSafety, scanRecipeForToxins } from "../services/companionToxicFirewall";
import { checkFelineIngredientSafety } from "../services/felineToxicFirewall";
import OpenAI from "openai";
import { findUserByValidAuthToken } from "../services/authTokenService";

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

const MAX_ACTIVE_COMPANIONS_PER_SPECIES = 8;
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
      const tokenUser = await findUserByValidAuthToken(token);
      if (tokenUser) req.user = { id: tokenUser.id };
    } catch {}
  }
  if (!req.user) req.user = {};
  next();
};

// Returns serve-URL strings (not base64). Primary image first.
async function getProfileImages(profileId: string): Promise<string[]> {
  try {
    const imgs = await db
      .select({ id: companionProfileImages.id, isPrimary: companionProfileImages.isPrimary, sortOrder: companionProfileImages.sortOrder })
      .from(companionProfileImages)
      .where(eq(companionProfileImages.profileId, profileId))
      .orderBy(companionProfileImages.sortOrder);
    return imgs
      .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
      .map((i) => `/api/companion/profiles/${profileId}/images/${i.id}/serve`);
  } catch {
    return [];
  }
}

// GET /api/companion/profiles — returns all profiles with their images
// Optional ?type=dog|cat filter
router.get("/profiles", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.json({ profiles: [] });

    const petTypeFilter = req.query.type as string | undefined;

    const rows = await db
      .select()
      .from(companionProfiles)
      .where(
        petTypeFilter
          ? and(eq(companionProfiles.userId, userId), eq(companionProfiles.petType, petTypeFilter))
          : eq(companionProfiles.userId, userId)
      )
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
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

// POST /api/companion/profiles
router.post("/profiles", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const {
      petType, name, breed, isMixedBreed, ageYears, ageMonths, sex, isNeutered,
      weightLbs, goalWeightLbs, activityLevel, bodyConditionScore,
      foodSensitivities, allergies, currentDietType, treatsPerDay,
      behaviorNotes, vetDietaryRestrictions, medications, wellnessGoals, photoUrl,
    } = req.body;

    if (!name || !breed || !ageYears || !sex || !weightLbs) {
      return res.status(400).json({ error: "Required fields: name, breed, ageYears, sex, weightLbs" });
    }

    // Enforce per-species cap: count only profiles of the same petType
    const resolvedPetType = petType ?? "dog";
    const speciesLabel = resolvedPetType === "cat" ? "cat" : "dog";
    const [{ total }] = await db
      .select({ total: count() })
      .from(companionProfiles)
      .where(
        and(
          eq(companionProfiles.userId, userId),
          eq(companionProfiles.status, "active"),
          eq(companionProfiles.petType, resolvedPetType)
        )
      );
    if (Number(total) >= MAX_ACTIVE_COMPANIONS_PER_SPECIES) {
      return res.status(400).json({
        error: `You can have up to ${MAX_ACTIVE_COMPANIONS_PER_SPECIES} active ${speciesLabel} profiles. Move a ${speciesLabel} to Previous Companions to free a slot.`,
      });
    }

    const [profile] = await db
      .insert(companionProfiles)
      .values({
        userId,
        petType: resolvedPetType,
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
    res.status(500).json({ error: "Failed to create companion profile" });
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

    // Look up the profile's species so the cap is applied per-species
    const [profileToRestore] = await db
      .select({ petType: companionProfiles.petType })
      .from(companionProfiles)
      .where(and(eq(companionProfiles.id, req.params.id), eq(companionProfiles.userId, userId)))
      .limit(1);
    if (!profileToRestore) return res.status(404).json({ error: "Profile not found" });

    const speciesLabel = profileToRestore.petType === "cat" ? "cat" : "dog";
    const [{ total }] = await db
      .select({ total: count() })
      .from(companionProfiles)
      .where(
        and(
          eq(companionProfiles.userId, userId),
          eq(companionProfiles.status, "active"),
          eq(companionProfiles.petType, profileToRestore.petType)
        )
      );
    if (Number(total) >= MAX_ACTIVE_COMPANIONS_PER_SPECIES) {
      return res.status(400).json({
        error: `You already have ${MAX_ACTIVE_COMPANIONS_PER_SPECIES} active ${speciesLabel} profiles. Move one to Previous Companions first.`,
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

// GET /api/companion/profiles/:id/images  — lightweight metadata only (no base64)
router.get("/profiles/:id/images", requireAuth, async (req, res) => {
  try {
    const profileId = req.params.id;
    const imgs = await db
      .select({
        id: companionProfileImages.id,
        profileId: companionProfileImages.profileId,
        isPrimary: companionProfileImages.isPrimary,
        sortOrder: companionProfileImages.sortOrder,
        createdAt: companionProfileImages.createdAt,
      })
      .from(companionProfileImages)
      .where(eq(companionProfileImages.profileId, profileId))
      .orderBy(companionProfileImages.sortOrder);
    const sorted = imgs
      .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
      .map((img) => ({ ...img, serveUrl: `/api/companion/profiles/${profileId}/images/${img.id}/serve` }));
    res.json({ images: sorted });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

// GET /api/companion/profiles/:id/images/:imageId/serve  — serves binary image (no auth: UUID is unguessable)
router.get("/profiles/:id/images/:imageId/serve", async (req, res) => {
  try {
    const [img] = await db
      .select({ imageUrl: companionProfileImages.imageUrl })
      .from(companionProfileImages)
      .where(eq(companionProfileImages.id, req.params.imageId))
      .limit(1);

    if (!img?.imageUrl) return res.status(404).json({ error: "Image not found" });

    // imageUrl is a data URL: "data:<mime>;base64,<data>"
    const match = img.imageUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) return res.status(422).json({ error: "Invalid image format" });

    const [, mime, b64] = match;
    const buf = Buffer.from(b64, "base64");
    res.set({
      "Content-Type": mime,
      "Content-Length": buf.length,
      "Cache-Control": "private, max-age=86400",
    });
    res.end(buf);
  } catch (err) {
    res.status(500).json({ error: "Failed to serve image" });
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

    // Return only lightweight fields — omit imageUrl (large base64) to keep response small
    res.json({
      image: {
        id: img.id,
        profileId: img.profileId,
        isPrimary: img.isPrimary,
        sortOrder: img.sortOrder,
        createdAt: img.createdAt,
      },
    });
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
  // Declared outside try so the outer catch can reference it in its error message
  let petType = "dog";
  try {
    const userId = resolveUserId(req);
    const { profileId, mealType = "main", specialRequest } = req.body;

    if (!profileId) return res.status(400).json({ error: "profileId required" });

    const [profile] = await db
      .select()
      .from(companionProfiles)
      .where(eq(companionProfiles.id, profileId))
      .limit(1);

    if (!profile) return res.status(404).json({ error: "Pet profile not found" });

    petType = (profile.petType as string) || "dog";

    if (profile.status === "memorial") {
      return res.status(400).json({
        error: `${profile.name}'s profile is a memorial. New meal generation is disabled to preserve their memory.`,
      });
    }

    // ── Branch on petType — NEVER fall through cat profiles to canine logic ──
    let envelope;
    if (petType === "cat") {
      try {
        envelope = buildFelineProtocolEnvelope(profile as any);
      } catch (felineErr) {
        console.error("[companion] feline protocol engine error:", felineErr);
        return res.status(422).json({
          error: "Feline engine unavailable — unable to generate a safe cat meal at this time. Please try again or contact support.",
          code: "FELINE_ENGINE_ERROR",
        });
      }
    } else {
      envelope = buildCompanionProtocolEnvelope(profile as any);
    }

    const mealTypeInstructions: Record<string, Record<string, string>> = {
      dog: {
        main: "Generate a complete, nutritious main meal suitable for this dog's profile.",
        treat: "Generate a healthy homemade dog treat recipe — small, bite-sized, easily digestible.",
        snack: "Generate a healthy snack or light between-meal food for this dog.",
        "meal-prep": "Generate a meal prep plan — a batch recipe that makes 5–7 servings, with storage instructions.",
      },
      cat: {
        main: "Generate a complete, nutritious main meal suitable for this cat's profile. Ensure taurine-rich animal protein is the anchor ingredient.",
        treat: "Generate a healthy homemade cat treat recipe — small, bite-sized, fully cooked, no raw fish, no dairy.",
        snack: "Generate a healthy snack or light between-meal food for this cat. Must be fully cooked animal protein.",
        "meal-prep": "Generate a meal prep plan — a batch recipe that makes 5–7 feline-appropriate servings with storage instructions. Refrigerate or freeze portions.",
      },
    };

    const typeInstructionMap = mealTypeInstructions[petType] ?? mealTypeInstructions.dog;
    const typeInstruction = typeInstructionMap[mealType] || typeInstructionMap.main;
    const specialNote = specialRequest ? `Special request from owner: ${specialRequest}` : "";

    const systemPrompt =
      petType === "cat"
        ? `You are a feline nutrition intelligence specialist creating personalized, safe, homemade cat food recipes for an obligate carnivore.

You have expert knowledge of feline-specific nutritional requirements:
- Taurine is an essential amino acid for cats (cannot be synthesized — must come from animal protein)
- Cats require preformed vitamin A from animal tissue (cannot convert beta-carotene)
- Cats require arachidonic acid from animal fat (cannot convert plant-derived linoleic acid)
- Cats have very limited carbohydrate metabolism (minimal glucokinase activity)
- Cats have a low thirst drive — high dietary moisture is always beneficial

${envelope.promptBlock}

IMPORTANT: You are NOT a veterinarian. Do NOT make medical claims. Use language like "wellness support", "may help support", "nutrition guidance only".

You must respond with valid JSON in exactly this structure:
{
  "title": "Recipe name",
  "description": "2-3 sentence warm description of why this meal is great for this cat",
  "mealType": "${mealType}",
  "servingSize": "e.g. 1/3 cup per meal for a 10-lb cat",
  "estimatedCalories": 150,
  "proteinGrams": 18,
  "ingredients": [
    { "name": "Ingredient name", "amount": "Amount", "notes": "Optional prep note" }
  ],
  "instructions": [
    "Step 1...",
    "Step 2..."
  ],
  "wellnessNotes": [
    "Note about taurine source and why it benefits this cat",
    "Note about another key ingredient's feline benefit"
  ],
  "citationReferences": [
    "Brief source reference relevant to wellness goals"
  ],
  "storageNote": "How long this keeps and how to store",
  "veterinaryNote": "This recipe is for feline wellness nutrition support only. Consult your veterinarian for medical conditions, kidney disease, diabetes, or significant dietary changes."
}`
        : `You are a companion nutrition intelligence specialist creating personalized, safe, homemade dog food recipes.

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

    const userPrompt =
      petType === "cat"
        ? `${typeInstruction}
${specialNote}

Cat profile: ${profile.name}, ${profile.breed}, ${profile.ageYears} years old, ${profile.weightLbs} lbs, ${profile.activityLevel} activity level.
Wellness goals: ${(profile.wellnessGoals as string[] || []).join(", ") || "general feline wellness"}
Remember: obligate carnivore — taurine-rich animal protein must anchor this recipe. No raw fish, no dairy, no plant protein substitution.

Generate a recipe now.`
        : `${typeInstruction}
${specialNote}

Dog profile: ${profile.name}, ${profile.breed}, ${profile.ageYears} years old, ${profile.weightLbs} lbs, ${profile.activityLevel} activity level.
Wellness goals: ${(profile.wellnessGoals as string[] || []).join(", ") || "general wellness"}

Generate a recipe now.`;

    // ── Pre-generation feline firewall assertion ──────────────────────────────
    // Confirm the safety block was not accidentally stripped before sending
    // anything to the AI. The Feline Toxic Ingredient Firewall layer MUST be
    // present in the envelope for every cat recipe request.
    if (petType === "cat" && !envelope.activeLayers.includes("Feline Toxic Ingredient Firewall")) {
      console.error("[companion] Feline firewall layer missing from envelope — aborting generation. activeLayers:", envelope.activeLayers);
      return res.status(422).json({
        error: "Feline safety firewall is not active — recipe generation blocked for your cat's safety. Please try again or contact support.",
        code: "FELINE_FIREWALL_MISSING",
      });
    }

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
    const scanResult =
      petType === "cat"
        ? scanRecipeForFelineToxins(ingredientScanText)
        : scanRecipeForToxins(ingredientScanText);

    if (!scanResult.safe) {
      console.warn(`[companion] ${petType} toxic firewall triggered, regenerating:`, scanResult.violations);
      return res.status(422).json({
        error: `Generated recipe contained flagged ingredients and was blocked for your ${petType}'s safety. Please try again.`,
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
    res.status(500).json({ error: "Failed to generate companion meal" });
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
    const { ingredient, profileId, species } = req.body;
    const isCat = species === "cat";

    if (!ingredient?.trim()) {
      return res.status(400).json({ error: "ingredient required" });
    }

    // Fetch pet profile if profileId provided — gives personalized results
    let petProfile: (typeof companionProfiles.$inferSelect) | null = null;
    if (profileId && userId) {
      try {
        const [found] = await db
          .select()
          .from(companionProfiles)
          .where(and(eq(companionProfiles.id, profileId), eq(companionProfiles.userId, userId)));
        petProfile = found || null;
      } catch {}
    }

    // Branch to feline firewall for cat species
    const safetyResult = isCat
      ? checkFelineIngredientSafety(ingredient.trim())
      : checkIngredientSafety(ingredient.trim());

    // Check for profile-specific conflicts (allergies, sensitivities)
    const profileConflicts: string[] = [];
    if (petProfile) {
      const allergies = (petProfile.allergies as string[]) || [];
      const sensitivities = (petProfile.foodSensitivities as string[]) || [];
      const ingredientLower = ingredient.trim().toLowerCase();
      for (const a of allergies) {
        if (ingredientLower.includes(a.toLowerCase()) || a.toLowerCase().includes(ingredientLower)) {
          profileConflicts.push(`${petProfile.name} is allergic to this ingredient`);
          break;
        }
      }
      if (profileConflicts.length === 0) {
        for (const s of sensitivities) {
          if (ingredientLower.includes(s.toLowerCase()) || s.toLowerCase().includes(ingredientLower)) {
            profileConflicts.push(`${petProfile.name} has a known sensitivity to this`);
            break;
          }
        }
      }
    }

    let wellnessScore: number | null = null;
    let wellnessNotes: string | null = null;
    let betterOptions: string[] = [];
    let profileWellnessMatch: string[] = [];

    const speciesLabel = isCat ? "cat" : "dog";
    const expertLabel = isCat ? "feline nutrition expert" : "canine nutrition expert";

    try {
      const profileContext = petProfile
        ? `${isCat ? "Cat" : "Dog"} Profile — ${petProfile.name}:
- Breed: ${petProfile.breed}${petProfile.isMixedBreed ? " mix" : ""}
- Age: ${petProfile.ageYears}yr${petProfile.ageMonths ? ` ${petProfile.ageMonths}mo` : ""}  Weight: ${petProfile.weightLbs} lbs  Activity: ${petProfile.activityLevel}
- Wellness Goals: ${((petProfile.wellnessGoals as string[]) || []).join(", ") || "general wellness"}
- Known Allergies: ${((petProfile.allergies as string[]) || []).join(", ") || "none"}
- Food Sensitivities: ${((petProfile.foodSensitivities as string[]) || []).join(", ") || "none"}
- Medications: ${((petProfile.medications as string[]) || []).join(", ") || "none"}
- Vet Dietary Notes: ${petProfile.vetDietaryRestrictions || "none"}`
        : null;

      const systemContent = petProfile
        ? `You are a ${expertLabel} evaluating an ingredient specifically for ${petProfile.name}. Respond with JSON:
{
  "wellnessScore": 1-10,
  "wellnessNotes": "1-2 sentences on how this specifically benefits or affects ${petProfile.name} given their breed, age, and wellness goals",
  "betterOptions": ["alternative 1", "alternative 2"],
  "wellnessGoalMatches": ["any wellness goal from the profile this ingredient supports"]
}
Be specific to this ${speciesLabel}. Mention their name. Keep it concise.`
        : `You are a ${expertLabel}. Rate this ingredient for ${speciesLabel}s and respond with JSON:
{
  "wellnessScore": 1-10,
  "wellnessNotes": "1-2 sentences on nutritional value for ${speciesLabel}s",
  "betterOptions": ["alternative 1", "alternative 2"]
}
Keep it brief and ${speciesLabel}-specific.`;

      const userContent = profileContext
        ? `${profileContext}\n\nIngredient to evaluate: ${ingredient}`
        : `Evaluate for ${speciesLabel}s: ${ingredient}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 250,
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
      wellnessScore = parsed.wellnessScore || null;
      wellnessNotes = parsed.wellnessNotes || null;
      betterOptions = parsed.betterOptions || [];
      profileWellnessMatch = parsed.wellnessGoalMatches || [];
    } catch {}

    // Escalate safe ingredients to CAUTION when profile conflicts exist
    const finalStatus =
      profileConflicts.length > 0 && safetyResult.severity !== "TOXIC"
        ? "CAUTION"
        : safetyResult.severity;

    if (userId) {
      try {
        await db.insert(companionIngredientScans).values({
          userId,
          profileId: profileId || null,
          ingredient: ingredient.trim(),
          safetyStatus: finalStatus,
          toxicityReason: safetyResult.reason || (profileConflicts[0] || null),
          safeSubstitution: safetyResult.substitution || null,
        });
      } catch {}
    }

    res.json({
      ingredient: ingredient.trim(),
      safetyStatus: finalStatus,
      safe: safetyResult.safe && profileConflicts.length === 0,
      reason: safetyResult.reason || (profileConflicts[0] || null),
      substitution: safetyResult.substitution || null,
      wellnessScore,
      wellnessNotes,
      betterOptions,
      // Return species-appropriate name field
      ...(isCat ? { catName: petProfile?.name || null } : { dogName: petProfile?.name || null }),
      profileConflicts,
      profileWellnessMatch,
    });
  } catch (err) {
    console.error("[companion] scan-ingredient error:", err);
    res.status(500).json({ error: "Failed to scan ingredient" });
  }
});

export default router;
