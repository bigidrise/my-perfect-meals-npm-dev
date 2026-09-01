import { Router } from "express";
import Stripe from "stripe";
import type { LookupKey } from "../../client/src/data/planSkus";
import { requireAuth } from "../middleware/requireAuth";
import { getTrustedCheckoutPlan } from "../services/stripePlanCatalog";
import { assertStripeBillingOwnership } from "../services/stripeRuntimePolicy";
import { reconcileCheckoutSession } from "../services/stripeReconciliationService";
import { randomUUID } from "node:crypto";

const router = Router();

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";

const keyMode = stripeKey.startsWith("sk_live_")
  ? "LIVE"
  : stripeKey.startsWith("sk_test_")
    ? "TEST"
    : "UNKNOWN";

const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: "2024-06-20" as any })
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
  stripePromoCodeId?: string; // Stripe promotion code ID to pre-apply (from Promotion Engine)
}

router.post("/checkout", requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({
      error: "Payment system not configured — STRIPE_SECRET_KEY is missing",
    });
  }

  try {
    assertStripeBillingOwnership(stripeKey);
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

    const trustedPlan = getTrustedCheckoutPlan(lookupKey);
    const priceId = trustedPlan?.priceId;

    if (!trustedPlan || !priceId) {
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
      process.env.PUBLIC_APP_URL ||
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

    const stripePromoCodeId =
      typeof body.stripePromoCodeId === "string" &&
      body.stripePromoCodeId.trim().length > 0
        ? body.stripePromoCodeId.trim()
        : undefined;

    if (stripePromoCodeId) {
      console.log(
        `🏷️  Promotion code pre-applied | promoCodeId=${stripePromoCodeId} | user=${userId}`,
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

      // Promotion Engine: pre-apply a partner discount code if provided.
      // Cannot be combined with allow_promotion_codes (Stripe rejects both).
      ...(stripePromoCodeId
        ? { discounts: [{ promotion_code: stripePromoCodeId }] }
        : { allow_promotion_codes: true }),

      ...(rewardfulReferralId && {
        client_reference_id: rewardfulReferralId,
      }),

      metadata: {
        userId,
        sku: trustedPlan.planLookupKey,
        context: body.context ?? "unknown",
        ...(stripePromoCodeId && { promoCodeId: stripePromoCodeId }),
      },
      subscription_data: {
        metadata: {
          userId,
          sku: trustedPlan.planLookupKey,
          context: body.context ?? "unknown",
        },
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
    if (msg.includes("disabled outside the production billing runtime")) {
      return res.status(503).json({
        error: "Live billing is only available from the production application.",
      });
    }

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

router.post("/reconcile-checkout", requireAuth, async (req: any, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Payment system not configured" });
  }

  try {
    assertStripeBillingOwnership(stripeKey);
    const sessionId = typeof req.body?.sessionId === "string"
      ? req.body.sessionId.trim()
      : "";
    if (!sessionId) {
      return res.status(400).json({ error: "Missing checkout session ID" });
    }

    const result = await reconcileCheckoutSession({
      stripe,
      userId: req.authUser.id,
      sessionId,
    });
    return res.json(result);
  } catch (error: any) {
    const message = error?.message ?? "Subscription reconciliation failed";
    const forbidden = message.includes("does not belong")
      || message.includes("identity does not match");
    console.error("[stripe/reconcile-checkout]", message);
    return res.status(forbidden ? 403 : 409).json({
      error: forbidden
        ? "Checkout session does not belong to this account."
        : "Payment is still being verified. Please try again shortly.",
    });
  }
});

/**
 * POST /api/stripe/checkout/business
 * Creates a Stripe Checkout Session for Clinical Business (multi-seat).
 * Seat count is validated server-side (1–250). Price ID is resolved through
 * the same server-owned trusted catalog used by consumer checkout.
 * Soft tier guidance (11-50: recommend call; 51+: contact sales) is enforced in UI only —
 * the backend accepts any value up to 250 so enterprise orders via sales can still proceed.
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
  if (!Number.isInteger(requestedSeats) || requestedSeats < 1 || requestedSeats > 250) {
    return res.status(400).json({
      error: "Seat count must be between 1 and 250. Contact us for larger teams.",
    });
  }

  const trustedBusinessPlan = getTrustedCheckoutPlan("clinical_business_monthly");
  if (!trustedBusinessPlan) {
    console.error("❌ Business checkout price is missing or conflicts with another trusted plan");
    return res.status(500).json({
      error: "Business subscription not configured. Please contact support.",
    });
  }

  const appUrl =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : null) ||
    (process.env.RAILWAY_STATIC_URL
      ? `https://${process.env.RAILWAY_STATIC_URL}`
      : null) ||
    "http://localhost:5000";

  try {
    assertStripeBillingOwnership(stripeKey);
    const { db: checkoutDb } = await import("../db");
    const { businesses: bizTable } = await import("../db/schema/business");
    const { and, eq, isNull, sql: drizzleSql } = await import("drizzle-orm");
    const proposedReservationId = randomUUID();
    const [reservedBusiness] = await checkoutDb
      .update(bizTable)
      .set({
        stripeCheckoutReservationId: drizzleSql`
          COALESCE(${bizTable.stripeCheckoutReservationId}, ${proposedReservationId})
        `,
        stripeCheckoutSeatCount: drizzleSql`
          COALESCE(${bizTable.stripeCheckoutSeatCount}, ${requestedSeats})
        `,
        updatedAt: new Date(),
      })
      .where(and(
        eq(bizTable.ownerUserId, userId),
        eq(bizTable.status, "pending_billing"),
        isNull(bizTable.stripeSubscriptionId),
      ))
      .returning({
        id: bizTable.id,
        reservationId: bizTable.stripeCheckoutReservationId,
        reservedSeatCount: bizTable.stripeCheckoutSeatCount,
      });

    if (!reservedBusiness) {
      const [existingBusiness] = await checkoutDb
        .select({ id: bizTable.id, status: bizTable.status })
        .from(bizTable)
        .where(eq(bizTable.ownerUserId, userId))
        .limit(1);
      return res.status(existingBusiness ? 409 : 403).json({
        code: existingBusiness ? "ORGANIZATION_CHECKOUT_UNAVAILABLE" : "ORGANIZATION_REQUIRED",
        error: existingBusiness
          ? "This organization already has active or conflicting billing."
          : "Please complete organization setup before purchasing seats.",
      });
    }

    if (
      !reservedBusiness.reservationId
      || reservedBusiness.reservedSeatCount !== requestedSeats
    ) {
      return res.status(409).json({
        code: "ORGANIZATION_CHECKOUT_CONFLICT",
        error: "A checkout with a different seat count is already in progress.",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: trustedBusinessPlan.priceId,
          quantity: requestedSeats,
        },
      ],
      success_url: `${appUrl}/business-dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/business/setup`,
      metadata: {
        userId,
        businessId: reservedBusiness.id,
        checkoutReservationId: reservedBusiness.reservationId,
        sku: "clinical_business_monthly",
        subscriptionType: "business_seat",
        seatCount: String(requestedSeats),
        context: "business_checkout",
      },
      subscription_data: {
        metadata: {
          userId,
          businessId: reservedBusiness.id,
          checkoutReservationId: reservedBusiness.reservationId,
          sku: "clinical_business_monthly",
          subscriptionType: "business_seat",
          seatCount: String(requestedSeats),
        },
      },
    }, {
      idempotencyKey: `mpm-business-checkout:${reservedBusiness.id}:${reservedBusiness.reservationId}`,
    });

    if (!session.url) {
      throw new Error("Stripe session created but no checkout URL returned");
    }

    const [sessionBound] = await checkoutDb
      .update(bizTable)
      .set({
        stripeCheckoutSessionId: session.id,
        updatedAt: new Date(),
      })
      .where(and(
        eq(bizTable.id, reservedBusiness.id),
        eq(bizTable.stripeCheckoutReservationId, reservedBusiness.reservationId),
        isNull(bizTable.stripeSubscriptionId),
      ))
      .returning({ id: bizTable.id });
    if (!sessionBound) {
      throw new Error("Business checkout reservation changed before the session could be bound");
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
