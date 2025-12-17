
import { Router } from "express";
import Stripe from "stripe";
import { STRIPE_PRICE_IDS } from "../config/stripePrices";
import type { LookupKey } from "../../client/src/data/planSkus";

const router = Router();

let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-09-30.clover",
  });
}

function getUserId(req: any): string {
  if (req.session?.userId) return req.session.userId as string;
  const headerUserId = req.headers["x-user-id"] as string;
  if (headerUserId) return headerUserId;
  return "00000000-0000-0000-0000-000000000001";
}

router.post("/checkout", async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: "Payment system not configured" });
  }
  try {
    const { sku, priceLookupKey, context } = req.body;
    const userId = getUserId(req);

    // Accept either 'sku' or 'priceLookupKey' for compatibility
    const lookupKey = (sku || priceLookupKey) as LookupKey;
    
    if (!lookupKey) {
      return res.status(400).json({ error: "Missing SKU or priceLookupKey" });
    }

    const priceId = STRIPE_PRICE_IDS[lookupKey];
    if (!priceId) {
      return res.status(400).json({ 
        error: "Invalid SKU", 
        receivedKey: lookupKey,
        validKeys: Object.keys(STRIPE_PRICE_IDS)
      });
    }

    console.log(`📋 Checkout request - Lookup Key: ${lookupKey}`);
    console.log(`📋 Resolved Price ID: "${priceId}"`);
    console.log(`📋 Price ID length: ${priceId.length} characters`);

    const appUrl = process.env.APP_URL 
      || (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : null)
      || "http://localhost:5000";

    console.log(`📋 Sending to Stripe - Price ID: "${priceId}"`);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
      metadata: {
        userId,
        sku: lookupKey,
        context: context ?? "unknown",
      },
    });

    console.log(`✅ Created checkout session for user ${userId}, plan ${lookupKey}`);
    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("❌ Stripe checkout error:", err);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
});

export default router;
