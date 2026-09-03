/**
 * Meal Sharing Routes
 *
 * POST /api/meals/share   — authenticated; creates a shareable meal record,
 *                           auto-attaches Rewardful token for active affiliates.
 * GET  /api/share/:token  — public (no auth); returns safe meal preview data.
 */

import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "../db";
import { mealShares } from "../db/schema/mealShares";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { processMealImageForSave } from "../services/imageLifecycle";

const router = Router();

// ─── Generate a short URL-safe token ─────────────────────────────────────────
function makeShareToken(): string {
  return randomBytes(6).toString("base64url").slice(0, 8);
}

// ─── POST /api/meals/share ────────────────────────────────────────────────────
const ShareBodySchema = z.object({
  mealName:        z.string().min(1).max(200),
  mealDescription: z.string().max(500).optional(),
  mealImage:       z.string().url().optional().or(z.literal("")),
  calories:        z.number().int().nonnegative().optional(),
  protein:         z.number().nonnegative().optional(),
  carbs:           z.number().nonnegative().optional(),
  fat:             z.number().nonnegative().optional(),
});

router.post("/share", requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const parsed = ShareBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid share data", details: parsed.error.flatten() });
    }

    const data = parsed.data;

    // ── Media lifecycle gate ───────────────────────────────────────────────
    // The Zod schema already rejects base64 (z.string().url() blocks data: URIs).
    // This gate additionally blocks expired DALL-E CDN URLs.
    const TEMP_PATTERNS = ["oaidalleapiprodscus", "blob.core.windows.net", "openai.com"];
    let safeMealImage = data.mealImage || null;
    if (safeMealImage && TEMP_PATTERNS.some(p => safeMealImage!.includes(p))) {
      try {
        const imgResult = await processMealImageForSave(safeMealImage, data.mealName);
        safeMealImage = imgResult.imageUrl;
      } catch {
        safeMealImage = null;
      }
    }

    // Generate a unique token (retry once on collision — astronomically unlikely)
    let shareToken = makeShareToken();
    const existing = await db.select().from(mealShares).where(eq(mealShares.shareToken, shareToken)).limit(1);
    if (existing.length > 0) shareToken = makeShareToken();

    await db.insert(mealShares).values({
      shareToken,
      userId,
      mealName:        data.mealName,
      mealDescription: data.mealDescription ?? null,
      mealImage:       safeMealImage,
      calories:        data.calories ?? null,
      protein:         data.protein != null ? String(data.protein) : null,
      carbs:           data.carbs   != null ? String(data.carbs)   : null,
      fat:             data.fat     != null ? String(data.fat)     : null,
    });

    // Check if the sharing user is an active affiliate with a Rewardful token
    const [affiliateRow] = await db
      .select({ rewardfulReferralToken: userAffiliateAccounts.rewardfulReferralToken, activatedAt: userAffiliateAccounts.activatedAt })
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.userId, userId))
      .limit(1);

    const isActiveAffiliate =
      !!affiliateRow?.activatedAt && !!affiliateRow?.rewardfulReferralToken;

    // Build the public share URL — affiliate token travels as ?via= (Rewardful's standard param)
    const origin = process.env.NEXT_PUBLIC_APP_URL || "https://app.myperfectmeals.com";
    const baseUrl = `${origin}/m/${shareToken}`;
    const shareUrl = isActiveAffiliate
      ? `${baseUrl}?via=${affiliateRow.rewardfulReferralToken}`
      : baseUrl;

    return res.json({ shareUrl, shareToken });
  } catch (err) {
    console.error("[mealShares] POST /share error:", err);
    return res.status(500).json({ error: "Failed to create share link" });
  }
});

// ─── GET /api/share/:token  (PUBLIC — no auth) ────────────────────────────────
router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length > 20) return res.status(404).json({ error: "Not found" });

    const [row] = await db
      .select()
      .from(mealShares)
      .where(eq(mealShares.shareToken, token))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Meal not found" });

    // Return ONLY the meal data — no userId, no internal identifiers
    return res.json({
      mealName:        row.mealName,
      mealDescription: row.mealDescription ?? null,
      mealImage:       row.mealImage ?? null,
      calories:        row.calories ?? null,
      protein:         row.protein != null ? parseFloat(String(row.protein)) : null,
      carbs:           row.carbs   != null ? parseFloat(String(row.carbs))   : null,
      fat:             row.fat     != null ? parseFloat(String(row.fat))     : null,
    });
  } catch (err) {
    console.error("[mealShares] GET /:token error:", err);
    return res.status(500).json({ error: "Failed to load meal" });
  }
});

export default router;
