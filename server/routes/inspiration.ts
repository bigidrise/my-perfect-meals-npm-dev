import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireActiveAccess } from "../middleware/requireActiveAccess";
import { db } from "../db";
import { savedMeals as savedMealsTable } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import OpenAI from "openai";
import {
  loadUserProtocolEnvelope,
  scanGeneratedOutput,
  type UserProtocolEnvelope,
} from "../services/protocolEnvelope";
import { processMealImageForSave } from "../services/imageLifecycle";

const router = Router();

function mealSignature(
  title: string,
  sourceType: string,
  macros?: { calories?: number; protein?: number; carbs?: number; fat?: number }
): string {
  const raw = `${title.trim().toLowerCase()}|${sourceType}|${macros?.calories ?? 0}|${macros?.protein ?? 0}|${macros?.carbs ?? 0}|${macros?.fat ?? 0}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 64);
}

function buildInspirationComplianceText(envelope: UserProtocolEnvelope): string {
  const lines: string[] = [];

  if (envelope.dietaryIdentity?.length) {
    lines.push(
      `DIETARY IDENTITY (non-negotiable outer wall): ${envelope.dietaryIdentity.join(", ")}`
    );
  }
  if (envelope.allergies?.length) {
    lines.push(
      `ALLERGIES — ABSOLUTE HARD STOPS (never include any of these): ${envelope.allergies.join(", ")}`
    );
  }
  if (envelope.medicalHardLimits?.length) {
    lines.push(`MEDICAL HARD LIMITS: ${envelope.medicalHardLimits.join(", ")}`);
  }
  if (envelope.diabeticGuidance) {
    lines.push(`DIABETIC GUIDANCE: ${envelope.diabeticGuidance}`);
  }
  if (envelope.conditionGuidanceBlocks?.length) {
    lines.push(`CONDITION GUIDANCE:\n${envelope.conditionGuidanceBlocks.join("\n")}`);
  }
  if (envelope.medicalOptimization?.length) {
    lines.push(`MEDICAL OPTIMIZATION: ${envelope.medicalOptimization.join(", ")}`);
  }
  if (envelope.avoidances?.length) {
    lines.push(`FOODS TO AVOID: ${envelope.avoidances.join(", ")}`);
  }
  if (envelope.cuisinePreference) {
    lines.push(
      `CUISINE PREFERENCE: ${envelope.cuisinePreference} (${envelope.cuisineIntensity || "balanced"} intensity)`
    );
  }
  if (envelope.fitnessGoal) {
    lines.push(
      `FITNESS GOAL: ${envelope.fitnessGoal}${envelope.goalType ? ` (${envelope.goalType})` : ""}`
    );
  }
  if (envelope.measurementSystem === "metric") {
    lines.push(`UNITS: Use metric (g, ml, kg)`);
  }

  return lines.join("\n");
}

router.post(
  "/inspiration/capture",
  requireAuth,
  requireActiveAccess,
  async (req: any, res) => {
    try {
      const userId = req.authUser?.id || req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { inputType, content, imageBase64 } = req.body;

      if (!inputType || (!content && !imageBase64)) {
        return res
          .status(400)
          .json({ error: "inputType and content or imageBase64 required" });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "AI service not configured" });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Step 1 — Load user protocol envelope
      const envelope = await loadUserProtocolEnvelope(userId);
      const complianceText = envelope
        ? buildInspirationComplianceText(envelope)
        : "";

      // Step 2 — Interpret input into a meal description
      let mealDescription = "";

      if ((inputType === "camera" || inputType === "upload") && imageBase64) {
        const visionResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract the meal idea from this image. Identify the dish name, visible ingredients, cooking style, cuisine, and any sauces or sides. Return a plain-text description of the meal as a meal idea — not a formal recipe. Do not include specific nutritional numbers.",
                },
                {
                  type: "image_url",
                  image_url: { url: imageBase64, detail: "low" },
                },
              ],
            },
          ],
          max_tokens: 400,
        });
        mealDescription =
          visionResponse.choices[0]?.message?.content?.trim() ||
          content ||
          "";
      } else {
        mealDescription = (content || "").trim();
      }

      if (!mealDescription) {
        return res.status(400).json({
          error:
            "Could not extract a meal idea from your input. Please try again.",
        });
      }

      // Step 3 — Adaptive reconstruction
      const systemPrompt = `You are the personalized meal engine for My Perfect Meals.

A user has brought in a meal idea. Create a complete, personalized meal card that:
- Preserves the emotional identity and core flavor profile of the original meal
- Adapts all ingredients, portions, and preparation to the user's personal nutritional profile below
- Produces a meal that feels like THEIR version — not a diet substitute
${
  complianceText
    ? `\nUSER NUTRITIONAL PROFILE (strictly follow all of these):\n${complianceText}`
    : ""
}

Output ONLY valid JSON — no markdown fences, no explanation:
{
  "name": "meal title that captures its identity",
  "description": "1-2 sentences describing this personalized version",
  "ingredients": [
    { "item": "ingredient name", "amount": "quantity and unit" }
  ],
  "instructions": "numbered step-by-step cooking instructions as one string",
  "nutrition": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0
  },
  "cuisine": "cuisine type",
  "mealType": "breakfast or lunch or dinner or snack",
  "protocolTags": ["e.g. High Protein", "GLP-1 Friendly", "Anti-Inflammatory"]
}`;

      const generationResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Create my personalized version of: "${mealDescription}"`,
          },
        ],
        max_tokens: 1400,
        temperature: 0.7,
      });

      const rawContent =
        generationResponse.choices[0]?.message?.content?.trim() || "";

      let mealCard: any;
      try {
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        mealCard = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
      } catch {
        console.error(
          "[inspiration] Failed to parse meal card JSON:",
          rawContent
        );
        return res
          .status(500)
          .json({ error: "Failed to generate meal card. Please try again." });
      }

      // Step 4 — Compliance scan (non-blocking in V1)
      if (envelope) {
        try {
          const scanResult = scanGeneratedOutput(mealCard, envelope, {
            generatorName: "inspiration",
          });
          if (!scanResult.passed) {
            console.warn(
              `[inspiration] Protocol scan violations for user ${userId}:`,
              scanResult.violations?.map((v: any) => v.term)
            );
          }
        } catch (e) {
          console.warn("[inspiration] Compliance scan error (non-blocking):", e);
        }
      }

      const title = (mealCard.name || "My Personalized Meal").trim();
      const mealData: any = {
        ...mealCard,
        title,
        imageUrl: null,
        _inspiration: {
          inputType,
          originalDescription: mealDescription,
          capturedAt: new Date().toISOString(),
        },
      };

      // Step 5 — Generate meal image (non-blocking)
      try {
        const imgResult = await processMealImageForSave(null, title);
        mealData.imageUrl = imgResult.imageUrl ?? null;
      } catch (e) {
        console.warn("[inspiration] Image generation skipped:", e);
      }

      // Step 6 — Auto-save to Favorites
      const macros = mealCard.nutrition || {};
      const hash = mealSignature(title, "my-inspiration", macros);

      const existing = await db
        .select()
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
      } else {
        const [row] = await db
          .insert(savedMealsTable)
          .values({
            userId: String(userId),
            title,
            sourceType: "my-inspiration",
            signatureHash: hash,
            mealData,
          })
          .returning();
        savedId = row.id;
      }

      return res.json({ success: true, id: savedId, title, mealData });
    } catch (error: any) {
      console.error("[inspiration] capture error:", error);
      res
        .status(500)
        .json({
          error: "Failed to create your personalized meal. Please try again.",
        });
    }
  }
);

export default router;
