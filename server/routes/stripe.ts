import express from "express";
import Stripe from "stripe";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { PLAN_ENTITLEMENTS, PlanKey, getEntitlementsForPlan } from "../entitlements";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-09-30.clover",
});

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { priceLookupKey, customerEmail, metadata } = req.body;

    if (!priceLookupKey) {
      return res.status(400).json({ error: "Missing priceLookupKey" });
    }

    const prices = await stripe.prices.list({
      lookup_keys: [priceLookupKey],
      active: true,
      limit: 1,
    });

    const price = prices.data[0];
    if (!price) {
      return res.status(400).json({
        error: "Invalid or inactive lookup_key",
        lookupKey: priceLookupKey,
      });
    }

    const successUrl = process.env.APP_SUCCESS_URL || `${req.protocol}://${req.get("host")}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = process.env.APP_CANCEL_URL || `${req.protocol}://${req.get("host")}/pricing?cancel=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      customer_email: customerEmail,
      allow_promotion_codes: false,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        priceLookupKey,
        ...(metadata || {}),
      },
    });

    res.json({ url: session.url });
  } catch (e: any) {
    console.error("[Stripe Checkout Error]", e);
    res.status(500).json({ error: e.message });
  }
});

router.post("/create-portal-session", async (req, res) => {
  try {
    const { customerId, returnUrl } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: "Missing customerId" });
    }

    const defaultReturnUrl = process.env.APP_SUCCESS_URL || `${req.protocol}://${req.get("host")}/settings/billing`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || defaultReturnUrl,
    });

    res.json({ url: portalSession.url });
  } catch (e: any) {
    console.error("[Stripe Portal Error]", e);
    res.status(500).json({ error: e.message });
  }
});

// Checkout success - retrieve session and activate subscription
router.get("/checkout-success", async (req, res) => {
  try {
    const { session_id, user_id } = req.query;

    if (!session_id || !user_id) {
      return res.status(400).json({ error: "Missing session_id or user_id" });
    }

    // Retrieve the checkout session with expanded data
    const session = await stripe.checkout.sessions.retrieve(session_id as string, {
      expand: ["subscription", "line_items.data.price"],
    });

    // Security: Validate that the session belongs to this user
    const sessionUserId = session.metadata?.user_id;
    
    if (sessionUserId !== user_id) {
      console.error(
        `[Stripe] Security violation: User ${user_id} attempted to claim session for user ${sessionUserId}`
      );
      return res.status(403).json({ error: "Session does not belong to this user" });
    }

    // Extract the lookup key from the price
    const price = session.line_items?.data?.[0]?.price as Stripe.Price | undefined;
    const lookupKey = (price?.lookup_key || session.metadata?.priceLookupKey) as PlanKey | undefined;

    if (!lookupKey) {
      return res.status(400).json({ error: "Missing lookup_key in session" });
    }

    // Map lookup key to entitlements
    const entitlements = getEntitlementsForPlan(lookupKey);

    // Update user with subscription data
    await db
      .update(users)
      .set({
        planLookupKey: lookupKey,
        entitlements,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: (session.subscription as Stripe.Subscription)?.id,
        subscriptionStatus: (session.subscription as Stripe.Subscription)?.status || "active",
      })
      .where(eq(users.id, user_id as string));

    console.log(`[Stripe] Activated subscription for user ${user_id}:`, {
      plan: lookupKey,
      entitlements,
    });

    res.json({
      success: true,
      plan: lookupKey,
      entitlements,
    });
  } catch (e: any) {
    console.error("[Stripe Checkout Success Error]", e);
    res.status(500).json({ error: e.message });
  }
});

// Get subscription status for restore purchases (Apple App Store requirement 3.1.2)
router.get("/subscription-status", async (req, res) => {
  try {
    const authToken = req.headers["x-auth-token"] as string;
    
    if (!authToken) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Authenticate user by looking up their auth token in the database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.authToken, authToken))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    // Check if user has an active subscription in our database
    if (user.subscriptionStatus === "active" && user.stripeSubscriptionId) {
      // Verify with Stripe that subscription is still active
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        
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

    // If user has Stripe customer ID, check for any active subscriptions
    if (user.stripeCustomerId) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const activeSub = subscriptions.data[0];
          const price = activeSub.items.data[0]?.price;
          const planName = (price?.lookup_key || "premium_monthly") as PlanKey;
          const entitlements = getEntitlementsForPlan(planName);

          // Update user's subscription status with entitlements
          await db
            .update(users)
            .set({
              stripeSubscriptionId: activeSub.id,
              subscriptionStatus: activeSub.status,
              planLookupKey: planName,
              entitlements,
            })
            .where(eq(users.id, user.id));

          console.log(`[Stripe] Restored subscription for user ${user.id}:`, {
            plan: planName,
            entitlements,
          });

          return res.json({
            hasActiveSubscription: true,
            planName,
            status: activeSub.status,
          });
        }
      } catch (stripeError) {
        console.error("[Stripe] Error checking customer subscriptions:", stripeError);
      }
    }

    // Check by email as fallback
    if (user.email) {
      try {
        const customers = await stripe.customers.list({
          email: user.email,
          limit: 1,
        });

        if (customers.data.length > 0) {
          const customer = customers.data[0];
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: "active",
            limit: 1,
          });

          if (subscriptions.data.length > 0) {
            const activeSub = subscriptions.data[0];
            const price = activeSub.items.data[0]?.price;
            const planName = (price?.lookup_key || "premium_monthly") as PlanKey;
            const entitlements = getEntitlementsForPlan(planName);

            // Update user with found subscription and entitlements
            await db
              .update(users)
              .set({
                stripeCustomerId: customer.id,
                stripeSubscriptionId: activeSub.id,
                subscriptionStatus: activeSub.status,
                planLookupKey: planName,
                entitlements,
              })
              .where(eq(users.id, user.id));

            console.log(`[Stripe] Restored subscription by email for user ${user.id}:`, {
              plan: planName,
              entitlements,
            });

            return res.json({
              hasActiveSubscription: true,
              planName,
              status: activeSub.status,
            });
          }
        }
      } catch (stripeError) {
        console.error("[Stripe] Error searching by email:", stripeError);
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

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).send("Missing stripe-signature header");
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[Stripe] Checkout completed:", {
          customerId: session.customer,
          subscriptionId: session.subscription,
          metadata: session.metadata,
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const price = subscription.items.data[0]?.price;
        const lookupKey = price?.lookup_key as PlanKey | undefined;

        if (lookupKey) {
          // Find user by Stripe customer ID
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, subscription.customer as string))
            .limit(1);

          if (user) {
            const entitlements = getEntitlementsForPlan(lookupKey);
            await db
              .update(users)
              .set({
                planLookupKey: lookupKey,
                entitlements,
                subscriptionStatus: subscription.status,
              })
              .where(eq(users.id, user.id));

            console.log(`[Stripe] Updated subscription for user ${user.id}:`, {
              plan: lookupKey,
              status: subscription.status,
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        // Find user by Stripe customer ID
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.stripeCustomerId, subscription.customer as string))
          .limit(1);

        if (user) {
          // Revert to basic plan entitlements or clear entitlements
          await db
            .update(users)
            .set({
              planLookupKey: null,
              entitlements: [],
              subscriptionStatus: "canceled",
            })
            .where(eq(users.id, user.id));

          console.log(`[Stripe] Subscription canceled for user ${user.id}`);
        }
        break;
      }

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("[Stripe Webhook Error]", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;
