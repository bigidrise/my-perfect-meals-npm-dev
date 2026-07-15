import { Router } from "express";
import Stripe from "stripe";
import { STRIPE_PRICE_IDS } from "../config/stripePrices";
import type { LookupKey } from "../../client/src/data/planSkus";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";

const keyMode = stripeKey.startsWith("sk_live_")
  ? "LIVE"
  : stripeKey.startsWith("sk_test_")
    ? "TEST"
    : "UNKNOWN";

const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: "2024-06-20" })
  : null;

function getUserId(req: any): string | null {
  if (req.authUser?.id) return req.authUser.id as string;

  if (req.session?.userId) return req.session.userId as string;

  return null;
}

interface CheckoutRequestBody {
  sku?: LookupKey;
  priceLookupKey?: LookupKey;
  context?: string;
  rewardfulReferralId?: string;
}

router.post("/checkout", requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: "Payment system not configured — STRIPE_SECRET_KEY is missing",
    });
  }

  try {
    const body = req.body as CheckoutRequestBody;

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }

    const lookupKey = body.sku || body.priceLookupKey;

    if (!lookupKey) {
      return res.status(400).json({
        error: "Missing plan selection (sku or priceLookupKey)",
      });
    }

    const priceId = STRIPE_PRICE_IDS[lookupKey];

    if (!priceId) {
      console.error(
        `❌ No Stripe price configured for plan "${lookupKey}". Check environment variables.`,
      );

      return res.status(500).json({
        error: `No Stripe price configured for plan "${lookupKey}".`,
      });
    }

    console.log(
      `📋 Checkout request | plan=${lookupKey} | priceId=${priceId} | keyMode=${keyMode} | user=${userId}`,
    );

    const appUrl =
      process.env.APP_URL ||
      (process.env.RAILWAY_STATIC_URL
        ? `https://${process.env.RAILWAY_STATIC_URL}`
        : null) ||
      "http://localhost:5000";

    const rewardfulReferralId =
      typeof body.rewardfulReferralId === "string" &&
      body.rewardfulReferralId.trim().length > 0
        ? body.rewardfulReferralId.trim()
        : undefined;

    if (rewardfulReferralId) {
      console.log(
        `🎯 Rewardful referral attached | referralId=${rewardfulReferralId} | user=${userId}`,
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${appUrl}/billing/cancel`,

      ...(rewardfulReferralId && {
        client_reference_id: rewardfulReferralId,
      }),

      metadata: {
        userId,
        sku: lookupKey,
        context: body.context ?? "unknown",
      },
    });

    if (!session.url) {
      throw new Error("Stripe session created but no checkout URL returned");
    }

    console.log(
      `✅ Checkout session created | plan=${lookupKey} | sessionId=${session.id}`,
    );

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("❌ Stripe checkout error:", err?.message || err);

    const msg = err?.message || "";

    if (msg.includes("No such price")) {
      return res.status(500).json({
        error:
          "Invalid Stripe price ID. The configured price does not exist in this Stripe account/mode.",
      });
    }

    return res.status(500).json({
      error: "Failed to create checkout session. Please try again.",
    });
  }
});

/**
 * POST /api/stripe/checkout/business
 * Creates a Stripe Checkout Session for Clinical Business (multi-seat).
 * Seat count is validated server-side (1–4). Price ID is read from env only.
 */
router.post("/checkout/business", requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: "Payment system not configured — STRIPE_SECRET_KEY is missing",
    });
  }

  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  const requestedSeats = Number(req.body.seats);
  if (!Number.isInteger(requestedSeats) || requestedSeats < 1 || requestedSeats > 4) {
    return res.status(400).json({
      error: "Clinical Business supports 1–4 seats. Please provide a valid seat count.",
    });
  }

  const priceId = process.env.STRIPE_CLINICAL_BUSINESS_MONTHLY_PRICE_ID?.trim();
  if (!priceId) {
    console.error("❌ Missing STRIPE_CLINICAL_BUSINESS_MONTHLY_PRICE_ID");
    return res.status(500).json({
      error: "Business subscription not configured. Please contact support.",
    });
  }

  const appUrl =
    process.env.APP_URL ||
    (process.env.RAILWAY_STATIC_URL
      ? `https://${process.env.RAILWAY_STATIC_URL}`
      : null) ||
    "http://localhost:5000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: requestedSeats,
        },
      ],
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
      metadata: {
        userId,
        sku: "clinical_business_monthly",
        subscriptionType: "business_seat",
        seatCount: String(requestedSeats),
        context: "business_checkout",
      },
      subscription_data: {
        metadata: {
          subscriptionType: "business_seat",
          seatCount: String(requestedSeats),
        },
      },
    });

    if (!session.url) {
      throw new Error("Stripe session created but no checkout URL returned");
    }

    console.log(
      `✅ Business checkout session created | seats=${requestedSeats} | total=$${(44.99 * requestedSeats).toFixed(2)}/mo | user=${userId}`,
    );

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("❌ Business checkout error:", err?.message || err);

    if (err?.message?.includes("No such price")) {
      return res.status(500).json({
        error: "Invalid Stripe price ID. Please contact support.",
      });
    }

    return res.status(500).json({
      error: "Failed to create checkout session. Please try again.",
    });
  }
});

export default router;
