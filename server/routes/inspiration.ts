import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireActiveAccess } from "../middleware/requireActiveAccess";
import { db } from "../db";
import { savedMeals as savedMealsTable } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import OpenAI from "openai";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import { processMealImageForSave } from "../services/imageLifecycle";

const router = Router();

const INTERNAL_API_BASE =
  process.env.INTERNAL_API_BASE || "http://127.0.0.1:5000";

function mealSignature(
  title: string,
  sourceType: string,
  macros?: { calories?: number; protein?: number; carbs?: number; fat?: number }
): string {
  const raw = `${title.trim().toLowerCase()}|${sourceType}|${macros?.calories ?? 0}|${macros?.protein ?? 0}|${macros?.carbs ?? 0}|${macros?.fat ?? 0}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 64);
}

function buildEnrichedCravingInput(
  baseDescription: string,
  opts: {
    healthMode: string;
    proteinPriority: string;
    prepStyle: string;
  }
): string {
  let input = baseDescription;

  if (opts.healthMode === "healthier") {
    input = `Healthier version of: ${input}`;
  } else if (opts.healthMode === "authentic") {
    input = `${input} [Keep this authentic — preserve traditional ingredients and preparation style, do not over-healthify]`;
  }

  if (opts.proteinPriority === "high") {
    input += " [Boost protein significantly — aim for high-protein ingredient choices]";
  } else if (opts.proteinPriority === "athlete") {
    input += " [Athlete performance optimized — maximize protein, support recovery and energy]";
  }

  if (opts.prepStyle === "easy") {
    input += " [Simplify ingredients and prep — use commonly available items, minimize active cooking time]";
  }

  return input;
}

// ── POST /api/inspiration/capture ────────────────────────────────────────────
// Extracts a meal idea from any input (image, voice, text), enriches it with
// the user's chosen options, then generates via the unified craving-creator
// pipeline. Does NOT auto-save — returns meal data for preview workspace.
router.post(
  "/inspiration/capture",
  requireAuth,
  requireActiveAccess,
  async (req: any, res) => {
    try {
      const userId = req.authUser?.id || req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const {
        inputType,
        content,
        imageBase64,
        servings = 2,
        cuisineOverride,
        healthMode = "balanced",
        proteinPriority = "standard",
        prepStyle = "any",
      } = req.body;

      if (!inputType || (!content && !imageBase64)) {
        return res
          .status(400)
          .json({ error: "inputType and content or imageBase64 required" });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "AI service not configured" });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Step 1 — Extract meal description from input
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

      // Step 2 — Enrich the description with the user's chosen options
      const validatedServings = Math.max(
        1,
        Math.min(10, parseInt(String(servings)) || 2)
      );
      const enrichedInput = buildEnrichedCravingInput(mealDescription, {
        healthMode: String(healthMode),
        proteinPriority: String(proteinPriority),
        prepStyle: String(prepStyle),
      });

      // Step 3 — Generate via the unified craving-creator pipeline
      // No logic duplication: we call the same endpoint that powers the full app.
      const authHeaders: Record<string, string> = {};
      const authToken = req.headers["x-auth-token"];
      if (authToken) authHeaders["x-auth-token"] = String(authToken);
      if (req.headers.cookie)
        authHeaders["cookie"] = req.headers.cookie as string;

      const cravingRes = await fetch(
        `${INTERNAL_API_BASE}/api/meals/craving-creator`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            cravingInput: enrichedInput,
            targetMealType: "dinner",
            servings: validatedServings,
            strictMode: healthMode === "healthier",
            generationMode: "meal",
            ...(cuisineOverride && typeof cuisineOverride === "string" && cuisineOverride.trim()
              ? { cultureOverride: cuisineOverride.trim() }
              : {}),
          }),
        }
      );

      if (!cravingRes.ok) {
        const errData = await cravingRes.json().catch(() => ({}));
        console.error("[inspiration] craving-creator call failed:", errData);
        throw new Error((errData as any).error || "Generation failed");
      }

      const cravingData: any = await cravingRes.json();
      const firstMeal =
        cravingData.meals?.[0] ||
        cravingData.meal ||
        cravingData.options?.[0];

      if (!firstMeal) {
        throw new Error("No meal returned from generator");
      }

      const title = (firstMeal.name || "My Personalized Meal").trim();

      // Step 4 — Generate meal image (non-blocking)
      let imageUrl: string | null = null;
      try {
        const imgResult = await processMealImageForSave(null, title);
        imageUrl = imgResult.imageUrl ?? null;
      } catch (e) {
        console.warn("[inspiration] Image generation skipped:", e);
      }

      const mealData: any = {
        ...firstMeal,
        title,
        imageUrl,
        _inspiration: {
          inputType,
          originalDescription: mealDescription,
          capturedAt: new Date().toISOString(),
        },
      };

      return res.json({
        success: true,
        title,
        mealData,
        extractedDescription: mealDescription,
      });
    } catch (error: any) {
      console.error("[inspiration] capture error:", error);
      res.status(500).json({
        error: "Failed to create your personalized meal. Please try again.",
      });
    }
  }
);

// ── POST /api/inspiration/save ────────────────────────────────────────────────
// Saves a confirmed meal to Favorites under "My Inspirations".
// Called only after the user reviews and approves in the preview workspace.
router.post(
  "/inspiration/save",
  requireAuth,
  requireActiveAccess,
  async (req: any, res) => {
    try {
      const userId = req.authUser?.id || req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { mealData } = req.body;
      if (!mealData)
        return res.status(400).json({ error: "mealData required" });

      const title = (
        mealData.title ||
        mealData.name ||
        "My Personalized Meal"
      ).trim();
      const macros = mealData.nutrition || {};
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

      return res.json({ success: true, id: savedId, title });
    } catch (error: any) {
      console.error("[inspiration] save error:", error);
      res
        .status(500)
        .json({ error: "Failed to save meal. Please try again." });
    }
  }
);

export default router;
