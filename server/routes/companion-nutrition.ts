import express from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { companionProfiles, companionMeals, companionIngredientScans } from "../db/schema/companionProfiles";
import { buildCompanionProtocolEnvelope } from "../services/companionProtocolEnvelope";
import { checkIngredientSafety, scanRecipeForToxins } from "../services/companionToxicFirewall";
import OpenAI from "openai";

const router = express.Router();
const openai = new OpenAI();

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

// GET /api/companion/profiles
router.get("/profiles", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.json({ profiles: [] });

    const profiles = await db
      .select()
      .from(companionProfiles)
      .where(eq(companionProfiles.userId, userId));

    res.json({ profiles });
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
      })
      .returning();

    res.json({ profile });
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

    res.json({ profile: updated });
  } catch (err) {
    console.error("[companion] PUT profile error:", err);
    res.status(500).json({ error: "Failed to update dog profile" });
  }
});

// DELETE /api/companion/profiles/:id
router.delete("/profiles/:id", requireAuth, async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    await db
      .update(companionProfiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(companionProfiles.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    console.error("[companion] DELETE profile error:", err);
    res.status(500).json({ error: "Failed to delete dog profile" });
  }
});

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

    // Normalize: ensure array fields are always arrays, never strings or objects
    if (!Array.isArray(meal.ingredients)) meal.ingredients = [];
    if (!Array.isArray(meal.instructions)) meal.instructions = [];
    if (!Array.isArray(meal.wellnessNotes)) meal.wellnessNotes = meal.wellnessNotes ? [String(meal.wellnessNotes)] : [];
    if (!Array.isArray(meal.citationReferences)) meal.citationReferences = [];
    if (typeof meal.estimatedCalories !== "number") meal.estimatedCalories = meal.estimatedCalories ? parseInt(meal.estimatedCalories) || null : null;
    if (typeof meal.proteinGrams !== "number") meal.proteinGrams = meal.proteinGrams ? parseInt(meal.proteinGrams) || null : null;

    // Run output through toxic firewall
    const scanText = JSON.stringify(meal);
    const scanResult = scanRecipeForToxins(scanText);

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

    // Save to DB if user is logged in
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
