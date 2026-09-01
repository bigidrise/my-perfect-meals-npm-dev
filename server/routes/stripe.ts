import express from "express";
import Stripe from "stripe";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { assertStripeBillingOwnership } from "../services/stripeRuntimePolicy";

const router = express.Router();

let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-09-30.clover" as any,
  });
}

function requireStripe(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!stripe) {
    return res.status(503).json({ error: "Payment system not configured" });
  }
  next();
}

function getStripe(): Stripe {
  return stripe!;
}

router.use(requireStripe);

router.post("/create-checkout-session", requireAuth, async (req, res) => {
  return res.status(410).json({
    code: "LEGACY_CHECKOUT_RETIRED",
    error: "This checkout path has been retired. Use the authenticated checkout flow.",
  });
});

router.post("/create-portal-session", requireAuth, async (req: any, res) => {
  try {
    assertStripeBillingOwnership(process.env.STRIPE_SECRET_KEY ?? "");
    const { returnUrl } = req.body;
    const [user] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, req.authUser.id))
      .limit(1);
    const customerId = user?.stripeCustomerId;

    if (!customerId) {
      return res.status(409).json({ error: "No verified Stripe customer is linked to this account" });
    }

    const defaultReturnUrl = process.env.APP_SUCCESS_URL || `${req.protocol}://${req.get("host")}/settings/billing`;

    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || defaultReturnUrl,
    });

    res.json({ url: portalSession.url });
  } catch (e: any) {
    console.error("[Stripe Portal Error]", e);
    const blocked = String(e?.message).includes("disabled outside the production billing runtime");
    res.status(blocked ? 503 : 500).json({
      error: blocked
        ? "Billing management is only available from the production application."
        : e.message,
    });
  }
});

// Checkout success - retrieve session and activate subscription
router.get("/checkout-success", requireAuth, async (_req, res) => {
  return res.status(410).json({
    code: "CHECKOUT_SUCCESS_ACTIVATION_RETIRED",
    error: "Checkout confirmation no longer grants subscription access.",
  });
});

// Get subscription status for restore purchases (Apple App Store requirement 3.1.2)
router.get("/subscription-status", requireAuth, async (req: any, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.authUser.id))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    if (user.subscriptionStatus === "active" && user.stripeSubscriptionId) {
      try {
        const subscription = await getStripe().subscriptions.retrieve(user.stripeSubscriptionId);
        if (subscription.status === "active" || subscription.status === "trialing") {
          return res.json({
            hasActiveSubscription: true,
            planName: user.planLookupKey || "Premium",
            status: subscription.status,
          });
        }
      } catch (stripeError) {
        console.error("[Stripe] Error verifying subscription:", stripeError);
      }
    }

    return res.json({
      hasActiveSubscription: false,
    });
  } catch (e: any) {
    console.error("[Stripe Subscription Status Error]", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/webhook", async (_req, res) => {
  return res.status(410).json({
    code: "LEGACY_WEBHOOK_RETIRED",
    error: "This webhook path is handled only by the canonical raw-body webhook.",
  });
});

export default router;
