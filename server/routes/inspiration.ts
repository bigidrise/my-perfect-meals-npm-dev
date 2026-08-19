import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireActiveAccess } from "../middleware/requireActiveAccess";
import { db } from "../db";
import { savedMeals as savedMealsTable } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import OpenAI from "openai";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import { computeNdeSummary } from "./inspiration-nde-helper";
import { computeAlphaGalBadge } from "../services/medicalBadges";
import { processMealImageForSave } from "../services/imageLifecycle";
import { generateMealImageUnified } from "../services/mealImageGenerator";

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
        excludedOptionNames,
        skipImages = false,
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
            ...(skipImages ? { skipImages: true } : {}),
            ...(cuisineOverride && typeof cuisineOverride === "string" && cuisineOverride.trim()
              ? { cultureOverride: cuisineOverride.trim() }
              : {}),
            ...(Array.isArray(excludedOptionNames) && excludedOptionNames.length > 0
              ? {
                  excludeMeals: excludedOptionNames
                    .filter((n: unknown): n is string => typeof n === 'string' && n.trim().length > 0)
                    .slice(0, 9),  // up to 3 rounds × 3 cards
                }
              : {}),
          }),
        }
      );

      if (!cravingRes.ok) {
        const errData = await cravingRes.json().catch(() => ({}));
        console.error("[inspiration] craving-creator call failed:", errData);
        // Surface the craving-creator's user-facing message (constraint_conflict,
        // safety_block, etc.) instead of swallowing it into a generic 500.
        const userMessage: string =
          (errData as any).message ||
          (errData as any).error ||
          "We couldn't create a meal for this request. Try a different dish or adjust your settings.";
        const reasonCode: string | undefined = (errData as any).reasonCode;
        return res.status(422).json({
          error: userMessage,
          reasonCode,
          suggestedActions: (errData as any).suggestedActions ?? [],
        });
      }

      const cravingData: any = await cravingRes.json();
      const rawMeals: any[] = cravingData.meals ||
        (cravingData.meal ? [cravingData.meal] : cravingData.options || []);
      const allMeals = rawMeals.slice(0, 3);

      if (allMeals.length === 0) {
        // craving-creator returned 200 with no meals — this happens when the
        // BGL/protocol gate correctly eliminated every generated option.  It is
        // not a crash.  Surface it as a typed constraint_conflict so the client
        // can show a "no compliant options" message and leave existing cards intact.
        return res.status(422).json({
          error: "We created additional versions of this recipe, but none met today's nutrition requirements.",
          reasonCode: "constraint_conflict",
          suggestedActions: [],
        });
      }

      // Step 4 — Generate meal images server-side in parallel for all options.
      // When skipImages is true (e.g. Try 3 More), we skip server-side generation
      // and return imageUrl: null so the client can display cards immediately and
      // hydrate images lazily via useMealImages.  When skipImages is false (initial
      // scan), the server generates images and embeds them in the response.
      let imageResults: PromiseSettledResult<string | null>[] = allMeals.map(() => ({
        status: "fulfilled" as const,
        value: null,
      }));

      if (!skipImages) {
        imageResults = await Promise.allSettled(
          allMeals.map(async (meal: any) => {
            const mealTitle = (meal.name || "My Personalized Meal").trim();
            const ingredientNames: string[] = ((meal.ingredients ?? []) as any[])
              .map((i: any) => i.name || i.item || "")
              .filter(Boolean);
            try {
              return await generateMealImageUnified(mealTitle, ingredientNames, "meal");
            } catch {
              return null;
            }
          })
        );
      }

      // Build options array — each option gets its imageUrl and inspiration metadata
      const mealOptions: any[] = allMeals.map((meal: any, i: number) => {
        const mealTitle = (meal.name || "My Personalized Meal").trim();
        const imageUrl =
          imageResults[i]?.status === "fulfilled"
            ? (imageResults[i] as PromiseFulfilledResult<string | null>).value
            : null;
        return {
          ...meal,
          title: mealTitle,
          imageUrl,
          _inspiration: {
            inputType,
            originalDescription: mealDescription,
            capturedAt: new Date().toISOString(),
          },
        };
      });

      // First option is the primary mealData (backward compat for clients that read result.mealData)
      const mealData = mealOptions[0];
      const title = mealData.title;

      // ── Nutrition Decision Engine (NDE) summary ──────────────────────────
      // Surface which constraints *actually governed* this generation so the
      // client can show an honest "Adapted for today" banner.
      //
      // wasAdapted is true only when a clinical or dietary constraint was
      // actively injected into the generation prompt AND — for starch-only
      // flags — the generated meals' actual carb values confirm restriction.
      // It is never based solely on profile state flags.
      let ndeSummary: import("./inspiration-nde-helper").NdeSummary | null = null;

      try {
        const envelope = await loadUserProtocolEnvelope(String(userId));
        if (!envelope) throw new Error("envelope unavailable");

        ndeSummary = computeNdeSummary(envelope, allMeals);

        // Alpha-gal badge — server-evaluated per option so the client never
        // independently decides what is or isn't safe for this condition.
        const agCtx = (envelope as any).alphaGalContext;
        if (agCtx?.active) {
          for (const option of mealOptions) {
            const ingText = ((option.ingredients ?? []) as any[])
              .map((i: any) => (i.name || i.item || "").toLowerCase())
              .join(" ");
            const fullText = `${option.name || option.title || ""} ${option.description || ""} ${ingText}`;
            option.alphaGalBadge = computeAlphaGalBadge(fullText, ingText.split(/\s+/), true);
          }
        }
      } catch {
        // Non-blocking — ndeSummary stays null
      }

      return res.json({
        success: true,
        title,
        mealData,            // first option — backward compat for clients reading result.mealData
        options: mealOptions, // all personalized options for the 3-card selector
        extractedDescription: mealDescription,
        ...(ndeSummary && { ndeSummary }),
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

      // Enforce the permanent-image rule: never persist an ephemeral OpenAI URL.
      // processMealImageForSave uploads to Object Storage and returns a /public-objects/
      // URL, or null if upload fails. Either way, a temporary CDN URL is never stored.
      //
      // Guard: strip base64 data URIs before the lifecycle gate — client-side
      // localStorage may cache meals with raw base64 before the permanent URL is
      // available.  Passing base64 to processMealImageForSave triggers a
      // lifecycle_violation ERROR log.  Null it out here so the meal saves with
      // no image rather than producing a false-alarm error.
      const rawImageUrl: string | null = mealData?.imageUrl ?? null;
      const sanitisedImageUrl: string | null =
        rawImageUrl?.startsWith("data:") ? null : rawImageUrl;
      if (rawImageUrl && !sanitisedImageUrl) {
        console.warn(
          `[inspiration/save] Stripped base64 imageUrl from client payload for "${title}" — client sent stale localStorage data`,
        );
      }
      let permanentImageUrl: string | null = sanitisedImageUrl;
      if (sanitisedImageUrl) {
        const { imageUrl: processed } = await processMealImageForSave(sanitisedImageUrl, title);
        permanentImageUrl = processed;
      }
      const safeMealData =
        permanentImageUrl !== rawImageUrl
          ? { ...mealData, imageUrl: permanentImageUrl }
          : mealData;

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
            mealData: safeMealData,
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
