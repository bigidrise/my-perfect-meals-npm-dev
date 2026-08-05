import { Router } from "express";
import Stripe from "stripe";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { requireProAccess } from "../middleware/requireProAccess";

const router = Router();

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-06-20" as any }) : null;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/promotions — create a promotion (Pro+)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", requireAuth, requireProAccess, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const {
    name,
    type,          // 'extended_trial' | 'discount'
    trialDays,     // for extended_trial
    discountPercent, // for discount (1-100)
    discountDuration, // 'once' | 'repeating' | 'forever'
    discountMonths,  // for 'repeating'
    maxUses,
    expiresAt,
  } = req.body as {
    name: string;
    type: "extended_trial" | "discount";
    trialDays?: number;
    discountPercent?: number;
    discountDuration?: "once" | "repeating" | "forever";
    discountMonths?: number;
    maxUses?: number;
    expiresAt?: string;
  };

  if (!name || !type) {
    return res.status(400).json({ error: "name and type are required" });
  }
  if (!["extended_trial", "discount"].includes(type)) {
    return res.status(400).json({ error: "type must be extended_trial or discount" });
  }
  if (type === "extended_trial" && (!trialDays || trialDays < 1 || trialDays > 365)) {
    return res.status(400).json({ error: "trialDays must be 1–365 for extended_trial" });
  }
  if (type === "discount") {
    if (!discountPercent || discountPercent < 1 || discountPercent > 100) {
      return res.status(400).json({ error: "discountPercent must be 1–100 for discount" });
    }
    if (!discountDuration || !["once", "repeating", "forever"].includes(discountDuration)) {
      return res.status(400).json({ error: "discountDuration must be once, repeating, or forever" });
    }
    if (discountDuration === "repeating" && (!discountMonths || discountMonths < 1)) {
      return res.status(400).json({ error: "discountMonths required for repeating duration" });
    }
  }

  try {
    let stripeCouponId: string | null = null;
    let stripePromoCodeId: string | null = null;
    let stripePromoCode: string | null = null;

    // For discount type — create Stripe coupon + promo code
    if (type === "discount" && stripe) {
      const expiryTs = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : undefined;
      const coupon = await stripe.coupons.create({
        percent_off: discountPercent!,
        duration: discountDuration!,
        ...(discountDuration === "repeating" && { duration_in_months: discountMonths }),
        ...(maxUses && { max_redemptions: maxUses }),
        ...(expiryTs && { redeem_by: expiryTs }),
        name: name,
        metadata: { owner_user_id: userId, source: "mpm_promotion_engine" },
      });

      const promoCode = await stripe.promotionCodes.create({
        coupon: coupon.id,
        ...(maxUses && { max_redemptions: maxUses }),
        ...(expiryTs && { expires_at: expiryTs }),
        metadata: { owner_user_id: userId },
      });

      stripeCouponId = coupon.id;
      stripePromoCodeId = promoCode.id;
      stripePromoCode = promoCode.code;
    }

    const result = await db.execute(sql`
      INSERT INTO partner_promotions (
        owner_user_id, name, type,
        trial_days, discount_percent, discount_duration, discount_months,
        max_uses, expires_at,
        stripe_coupon_id, stripe_promo_code_id, stripe_promo_code
      ) VALUES (
        ${userId}, ${name}, ${type},
        ${trialDays ?? null}, ${discountPercent ?? null}, ${discountDuration ?? null}, ${discountMonths ?? null},
        ${maxUses ?? null}, ${expiresAt ?? null},
        ${stripeCouponId}, ${stripePromoCodeId}, ${stripePromoCode}
      )
      RETURNING *
    `);

    const promo = (result.rows as any[])[0];

    console.log(`✅ [promotions] Created | type=${type} | owner=${userId} | id=${promo.id}`);
    return res.json({ promotion: promo });
  } catch (err: any) {
    console.error("[promotions/create] error:", err);
    return res.status(500).json({ error: err.message || "Failed to create promotion" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/promotions — list my promotions (Pro+)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", requireAuth, requireProAccess, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  try {
    const result = await db.execute(sql`
      SELECT p.*,
        (SELECT count(*)::int FROM promotion_redemptions r WHERE r.promotion_id = p.id) AS redemption_count
      FROM partner_promotions p
      WHERE p.owner_user_id = ${userId}
        AND p.status != 'deleted'
      ORDER BY p.created_at DESC
    `);
    return res.json({ promotions: result.rows });
  } catch (err) {
    console.error("[promotions/list] error:", err);
    return res.status(500).json({ error: "Failed to fetch promotions" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/promotions/preview/:token — public: preview a promotion
// ─────────────────────────────────────────────────────────────────────────────
router.get("/preview/:token", async (req, res) => {
  const { token } = req.params;
  try {
    const result = await db.execute(sql`
      SELECT p.id, p.name, p.type, p.trial_days,
             p.discount_percent, p.discount_duration, p.discount_months,
             p.max_uses, p.used_count, p.expires_at, p.status,
             u.username AS owner_name
      FROM partner_promotions p
      LEFT JOIN users u ON u.id = p.owner_user_id
      WHERE p.invite_token = ${token}
      LIMIT 1
    `);

    const promo = (result.rows as any[])[0];
    if (!promo) return res.status(404).json({ error: "Promotion not found" });
    if (promo.status !== "active") return res.status(410).json({ error: "This promotion is no longer active", status: promo.status });
    if (promo.expires_at && new Date() > new Date(promo.expires_at)) {
      return res.status(410).json({ error: "This promotion has expired" });
    }
    if (promo.max_uses && promo.used_count >= promo.max_uses) {
      return res.status(410).json({ error: "This promotion has reached its usage limit" });
    }

    return res.json({ promotion: promo });
  } catch (err) {
    console.error("[promotions/preview] error:", err);
    return res.status(500).json({ error: "Failed to fetch promotion" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/promotions/redeem/:token — authenticated: apply promotion
// ─────────────────────────────────────────────────────────────────────────────
router.post("/redeem/:token", requireAuth, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { token } = req.params;

  try {
    // Fetch + validate promotion
    const result = await db.execute(sql`
      SELECT * FROM partner_promotions
      WHERE invite_token = ${token}
      LIMIT 1
    `);
    const promo = (result.rows as any[])[0];

    if (!promo) return res.status(404).json({ error: "Promotion not found" });
    if (promo.status !== "active") return res.status(410).json({ error: "This promotion is no longer active" });
    if (promo.expires_at && new Date() > new Date(promo.expires_at)) {
      return res.status(410).json({ error: "This promotion has expired" });
    }
    if (promo.max_uses && promo.used_count >= promo.max_uses) {
      return res.status(410).json({ error: "This promotion has reached its usage limit" });
    }

    // ── Atomic claim + side-effects in a single transaction ─────────────────
    // Strategy:
    //  1. INSERT the redemption record first. ON CONFLICT means only one
    //     concurrent request can "win" the claim — the loser gets 0 rows back.
    //  2. Atomically increment used_count only when the claim succeeds AND
    //     the limit hasn't been reached yet (prevents over-redemption races).
    //  3. Apply the trial extension / return promo code only after both DB
    //     writes succeed. If the transaction rolls back nothing is applied.

    let appliedTrialDays: number | null = null;
    let appliedPromoCode: string | null = null;
    let appliedPromoCodeId: string | null = null;

    // For extended_trial: check active subscription BEFORE entering the transaction
    // so we can return a clear 409 without a partial write.
    if (promo.type === "extended_trial") {
      const subCheck = await db.execute(sql`
        SELECT stripe_subscription_id, subscription_status,
               personal_plan_lookup_key, personal_subscription_status
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `);
      const subUser = (subCheck.rows as any[])[0];
      const hasActiveSub =
        (subUser?.stripe_subscription_id && subUser?.subscription_status === "active") ||
        (subUser?.personal_plan_lookup_key && subUser?.personal_subscription_status === "active");

      if (hasActiveSub) {
        return res.status(409).json({
          error: "Trial extensions don't apply to active subscribers. Your existing plan already gives you full access.",
          code: "ALREADY_SUBSCRIBED",
        });
      }
    }

    // Determine effect values before the transaction (pure computation, no DB).
    if (promo.type === "discount") {
      appliedPromoCode = promo.stripe_promo_code;
      appliedPromoCodeId = promo.stripe_promo_code_id;
    } else {
      appliedTrialDays = promo.trial_days;
    }

    // ── Single atomic transaction: claim + usage + effect ────────────────────
    // All writes succeed together or none do.
    const claimed = await db.transaction(async (tx) => {
      // Step 1: Claim the redemption slot — one winner per (promotion, user).
      const claimResult = await tx.execute(sql`
        INSERT INTO promotion_redemptions (promotion_id, redeemed_by_user_id, applied_trial_days, applied_stripe_promo_code)
        VALUES (${promo.id}, ${userId}, ${appliedTrialDays}, ${appliedPromoCode})
        ON CONFLICT (promotion_id, redeemed_by_user_id) DO NOTHING
        RETURNING id
      `);

      if ((claimResult.rows as any[]).length === 0) {
        // Another request already claimed this slot — signal duplicate to caller.
        return null;
      }

      // Step 2: Atomically increment used_count only while under the limit.
      const usageResult = await tx.execute(sql`
        UPDATE partner_promotions
        SET used_count = used_count + 1, updated_at = now()
        WHERE id = ${promo.id}
          AND (max_uses IS NULL OR used_count < max_uses)
        RETURNING used_count
      `);

      if ((usageResult.rows as any[]).length === 0) {
        // Limit hit between outer check and this update — roll back everything.
        throw Object.assign(new Error("This promotion has reached its usage limit"), { status: 410 });
      }

      // Step 3: Apply the benefit inside the same transaction so a failure here
      // rolls back the claim and usage increment together — no consumed slot without benefit.
      if (promo.type === "extended_trial") {
        await tx.execute(sql`
          UPDATE users
          SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, now()), now()) + (${promo.trial_days} || ' days')::interval,
              trial_started_at = COALESCE(trial_started_at, now()),
              updated_at = now()
          WHERE id = ${userId}
        `);
      }
      // discount type: no DB write needed for the benefit — the promo code is
      // already stored on the redemption record and returned in the response.

      return claimResult.rows[0];
    });

    if (claimed === null) {
      return res.status(409).json({ error: "You have already redeemed this promotion" });
    }

    console.log(`✅ [promotions] Redeemed | type=${promo.type} | user=${userId} | promo=${promo.id}`);

    return res.json({
      success: true,
      type: promo.type,
      appliedTrialDays,
      appliedPromoCode,
      appliedPromoCodeId,
      message: promo.type === "extended_trial"
        ? `Your account has been extended by ${promo.trial_days} days.`
        : `Your discount has been applied. Use it at checkout.`,
    });
  } catch (err: any) {
    if (err.status === 410) {
      return res.status(410).json({ error: err.message });
    }
    console.error("[promotions/redeem] error:", err);
    return res.status(500).json({ error: err.message || "Failed to redeem promotion" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/promotions/:id/status — pause or reactivate (Pro+)
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id/status", requireAuth, requireProAccess, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { id } = req.params;
  const { status } = req.body as { status: "active" | "paused" };

  if (!["active", "paused"].includes(status)) {
    return res.status(400).json({ error: "status must be active or paused" });
  }

  try {
    const result = await db.execute(sql`
      UPDATE partner_promotions
      SET status = ${status}, updated_at = now()
      WHERE id = ${id} AND owner_user_id = ${userId}
      RETURNING id
    `);
    if ((result.rows as any[]).length === 0) {
      return res.status(404).json({ error: "Promotion not found" });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("[promotions/status] error:", err);
    return res.status(500).json({ error: "Failed to update promotion" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/promotions/:id — soft-delete (Pro+)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, requireProAccess, async (req, res) => {
  const userId = (req as any).authUser?.id as string;
  const { id } = req.params;
  try {
    const result = await db.execute(sql`
      UPDATE partner_promotions
      SET status = 'deleted', updated_at = now()
      WHERE id = ${id} AND owner_user_id = ${userId}
      RETURNING id
    `);
    if ((result.rows as any[]).length === 0) {
      return res.status(404).json({ error: "Promotion not found" });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("[promotions/delete] error:", err);
    return res.status(500).json({ error: "Failed to delete promotion" });
  }
});

export default router;
