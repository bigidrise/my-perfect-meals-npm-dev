import crypto from "crypto";
import OpenAI from "openai";
import { db } from "../db";
import { savedMeals as savedMealsTable } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import {
  loadUserProtocolEnvelope,
  enforceBeforeGenerate,
  scanGeneratedOutput,
  type UserProtocolEnvelope,
} from "./protocolEnvelope";
import { generateMealImageUnified } from "./mealImageGenerator";
import { processMealImageForSave } from "./imageLifecycle";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IngredientItem {
  item: string;
  quantity: string;
  unit: string;
  category?: string;
}

export interface FinalizeInput {
  recommendation: {
    meal: { name: string; description: string; prepTime: string; servings: number };
    macros: { calories: number; protein: number; carbs: number; fat: number };
    ownedIngredients?: IngredientItem[];
    shoppingList?: IngredientItem[];
    reasoning?: string[];
  };
  userId: string;
  sourceType?: string;
}

export interface FinalizeResult {
  id: string;
  imageUrl: string | null;
  title: string;
  destination: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mealSignature(
  title: string,
  sourceType: string,
  macros?: { calories?: number; protein?: number; carbs?: number; fat?: number }
): string {
  const raw = `${title.trim().toLowerCase()}|${sourceType}|${macros?.calories ?? 0}|${macros?.protein ?? 0}|${macros?.carbs ?? 0}|${macros?.fat ?? 0}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 64);
}

function isGuestEnvelope(envelope: UserProtocolEnvelope): boolean {
  return (
    !envelope.userId &&
    envelope.dietaryIdentity.length === 0 &&
    envelope.allergies.length === 0 &&
    envelope.medicalHardLimits.length === 0 &&
    !envelope.hasDiabetes &&
    !envelope.pregnancySupport &&
    !envelope.thyroidSupport
  );
}

function buildClinicalProvenance(envelope: UserProtocolEnvelope) {
  const hasGlucose = !!envelope.diabeticGlucoseState;
  const isStale =
    typeof envelope.diabeticGuidance === "string" &&
    envelope.diabeticGuidance.includes("over 4 hours old");

  let glucoseState: string = "not-applicable";
  if (envelope.hasDiabetes) {
    if (!hasGlucose) glucoseState = "unavailable";
    else if (isStale) glucoseState = "stale";
    else glucoseState = envelope.diabeticGlucoseState ?? "unavailable";
  }

  let glp1CheckInSource: "today" | "baseline" | "not-applicable" = "not-applicable";
  if (envelope.glp1DailyTolerance) {
    const tol = envelope.glp1DailyTolerance as any;
    glp1CheckInSource = tol.source === "checkin" ? "today" : "baseline";
  }

  const hasMedications =
    (envelope.therapeuticSupportContext?.medications?.length ?? 0) > 0 ||
    !!envelope.thyroidMedication;

  return {
    generatedAt: new Date().toISOString(),
    glucoseReadingUsed: hasGlucose && !isStale,
    glucoseAgeMinutes: null as number | null,
    glucoseState,
    glucoseTrendAvailable: false as const,
    glp1CheckInSource,
    rawLabsAvailable: false as const,
    medicationContextSource: hasMedications ? "user-entered" : "none",
    protocolEnvelopeWasGuest: false,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function finalizeMealCard(input: FinalizeInput): Promise<FinalizeResult> {
  const { recommendation, userId, sourceType = "grocery-coach" } = input;
  const {
    meal,
    macros,
    ownedIngredients = [],
    shoppingList = [],
    reasoning = [],
  } = recommendation;

  // ── 1. Load full protocol envelope ─────────────────────────────────────────
  const envelope = await loadUserProtocolEnvelope(userId);
  if (!envelope) {
    throw new Error("Could not load protocol envelope for authenticated user");
  }
  if (isGuestEnvelope(envelope)) {
    throw new Error(
      "Guest envelope detected for authenticated user — refusing to finalize meal card"
    );
  }

  // ── 2. Combine owned + shopping → unified recipe ingredient list ────────────
  const ownedMapped = ownedIngredients.map((i) => ({
    name: i.item,
    amount: i.quantity,
    unit: i.unit,
  }));
  const shoppingMapped = shoppingList.map((i) => ({
    name: i.item,
    amount: i.quantity,
    unit: i.unit,
  }));

  const seen = new Set<string>();
  const dedupedIngredients = [...ownedMapped, ...shoppingMapped].filter((i) => {
    const key = i.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (dedupedIngredients.length === 0) {
    throw new Error("No ingredients available to finalize meal card");
  }

  // ── 3. Build constraint block from envelope ─────────────────────────────────
  const constraintBlock = enforceBeforeGenerate(envelope, {
    generatorName: "grocery_coach_finalizer",
  }).combined;

  // ── 4. Generate cooking instructions (targeted AI call) ─────────────────────
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const ingredientList = dedupedIngredients
    .map((i) => `${i.amount} ${i.unit} ${i.name}`.trim())
    .join(", ");

  const instructionResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.45,
    max_tokens: 900,
    messages: [
      {
        role: "system",
        content: `You are a recipe writer. Write clear, numbered cooking instructions for a home cook.

MANDATORY CONSTRAINTS — THESE OVERRIDE EVERYTHING:
${constraintBlock}

Rules:
- Use ONLY the listed ingredients — do not introduce new ones
- Scale quantities for ${meal.servings} serving(s)
- Output ONLY valid JSON: { "steps": ["string", ...] }
- 5–8 steps maximum. Each step is a complete, action-oriented sentence.`,
      },
      {
        role: "user",
        content: `Meal: ${meal.name}
Description: ${meal.description}
Ingredients: ${ingredientList}
Servings: ${meal.servings}

Write cooking instructions.`,
      },
    ],
  });

  let steps: string[] = [];
  try {
    const parsed = JSON.parse(
      instructionResponse.choices[0]?.message?.content ?? "{}"
    );
    steps = Array.isArray(parsed.steps)
      ? parsed.steps.filter((s: any) => typeof s === "string" && s.trim())
      : [];
  } catch {
    steps = [];
  }
  if (steps.length === 0) {
    steps = ["Prepare all ingredients. Cook until done according to standard methods for this dish."];
  }

  // ── 5. Post-generation safety scan ─────────────────────────────────────────
  const scanResult = scanGeneratedOutput(
    {
      name: meal.name,
      description: meal.description,
      ingredients: dedupedIngredients.map((i) => ({ name: i.name })),
      instructions: steps,
    },
    envelope,
    { generatorName: "grocery_coach_finalizer" }
  );

  if (!scanResult.passed) {
    throw new Error(
      `Meal card blocked by protocol safety scan: ${
        scanResult.primaryViolation?.reason ?? "safety violation"
      }`
    );
  }

  // ── 6. Validate nutrition vs. diabetes carb limits (informational) ──────────
  if (envelope.hasDiabetes && envelope.diabeticGuidance) {
    const carbLimitMatch = envelope.diabeticGuidance.match(/under (\d+)g carbs/);
    if (carbLimitMatch) {
      const limit = parseInt(carbLimitMatch[1], 10);
      if (macros.carbs > limit) {
        console.warn(
          `[MealCardFinalizer] Carb limit advisory: ${macros.carbs}g > ${limit}g limit for user ${userId}`
        );
      }
    }
  }

  // ── 7. Generate image ─────────────────────────────────────────────────────
  let imageUrl: string | null = null;
  try {
    imageUrl = await generateMealImageUnified(
      meal.name,
      dedupedIngredients.map((i) => i.name),
      "meal"
    );
  } catch (imgErr) {
    console.warn("[MealCardFinalizer] Image generation failed:", imgErr);
  }

  // ── 8. Clinical provenance metadata ────────────────────────────────────────
  const clinicalProvenance = buildClinicalProvenance(envelope);

  // ── Permanent-image rule ──────────────────────────────────────────────────
  // processMealImageForSave enforces the canonical media lifecycle:
  //   • base64 data URIs → uploaded to Object Storage (never written to Postgres)
  //   • temporary CDN URLs (DALL-E oaidalleapiprodscus, etc.) → uploaded and replaced
  //   • already-permanent /public-objects/ URLs → passed through
  //   • upload failure → imageUrl set to null (not the ephemeral URL)
  let finalMediaAssetId: string | null = null;
  if (imageUrl) {
    try {
      const imgResult = await processMealImageForSave(imageUrl, meal.name);
      if (imgResult.imagePending && !imgResult.imageUrl) {
        console.warn(
          `[MealCardFinalizer] Image processing pending/failed for "${meal.name}" — saving with null imageUrl. mediaAssetId: ${imgResult.mediaAssetId}`
        );
      }
      imageUrl = imgResult.imageUrl;
      finalMediaAssetId = imgResult.mediaAssetId;
    } catch (imgErr) {
      console.error(
        `[MealCardFinalizer] processMealImageForSave threw for "${meal.name}" — saving with null imageUrl:`,
        imgErr
      );
      imageUrl = null;
    }
  }

  // ── 9. Compose mealData blob ───────────────────────────────────────────────
  const mealData = {
    title: meal.name,
    name: meal.name,
    description: meal.description,
    imageUrl,
    ingredients: dedupedIngredients,
    instructions: steps,
    nutrition: {
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
    },
    servings: meal.servings,
    prepTime: meal.prepTime,
    _groceryCoach: {
      ownedIngredients,
      shoppingList,
      reasoning,
    },
    _clinicalProvenance: clinicalProvenance,
  };

  // ── 10. Idempotent save ────────────────────────────────────────────────────
  const hash = mealSignature(meal.name, sourceType, macros);

  const existing = await db
    .select({ id: savedMealsTable.id })
    .from(savedMealsTable)
    .where(
      and(
        eq(savedMealsTable.userId, String(userId)),
        eq(savedMealsTable.signatureHash, hash)
      )
    )
    .limit(1);

  let savedId: string;
  if (existing.length > 0) {
    savedId = existing[0].id;
    console.log(`[MealCardFinalizer] Idempotent hit — returning existing card ${savedId}`);
  } else {
    const [row] = await db
      .insert(savedMealsTable)
      .values({
        userId: String(userId),
        title: meal.name,
        sourceType,
        signatureHash: hash,
        mealData,
        ...(finalMediaAssetId ? { mediaAssetId: finalMediaAssetId } : {}),
      })
      .returning({ id: savedMealsTable.id });
    savedId = row.id;
    console.log(`[MealCardFinalizer] ✅ Saved meal card ${savedId} for user ${userId}`);
  }

  return {
    id: savedId,
    imageUrl,
    title: meal.name,
    destination: `/saved-meals?mealId=${savedId}`,
  };
}
